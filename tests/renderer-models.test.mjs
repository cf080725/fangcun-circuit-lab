import test from 'node:test';
import assert from 'node:assert/strict';
import { resistorVisual, formatResistance, formatCapacitance, componentPins, componentPin, componentLabel, boardVisual, visualBounds } from '../dist/model-renderer.js';
import { PARTS } from '../dist/circuit.js';
import { BOARD_PROFILE_LIST } from '../dist/board-profiles.js';
import { rotateBoardPoint, signalHole } from '../dist/breadboard-mount.js';
import { mountedPartContacts, partPose } from '../dist/part-mount.js';

function decodeColorBands(appearance) {
  const names=['黑','棕','红','橙','黄','绿','蓝','紫','灰','白'];
  const significant=Number(appearance.bands.filter(b=>b.kind==='digit').map(b=>names.indexOf(b.name)).join(''));
  const multiplier=appearance.bands.find(b=>b.kind==='multiplier');
  const exponent=multiplier.name==='金'?-1:multiplier.name==='银'?-2:names.indexOf(multiplier.name);
  return significant*10**exponent;
}

test('resistor colours encode the entered value, including 999 Ω overflow boundary',()=>{
  const cases=[
    [.1,['棕','黑','银','金']], [1,['棕','黑','金','金']], [4.7,['黄','紫','金','金']],
    [330,['橙','橙','棕','金']], [4700,['黄','紫','红','金']],
    [999,['白','白','白','黑','棕']], [99.9,['白','白','白','金','棕']],
    [1230,['棕','红','橙','棕','棕']], [1e10,['棕','黑','白','金']]
  ];
  for(const [value,colors] of cases){
    const result=resistorVisual(value);assert.equal(result.mode,'bands',String(value));
    assert.deepEqual(result.bands.map(b=>b.name),colors);
    assert.ok(Math.abs(decodeColorBands(result)-value)<=Math.abs(value)*1e-12);
    assert.match(result.note,/不模拟公差/);
  }
});

test('arbitrary values are printed rather than silently rounded to another resistor',()=>{
  for(const value of [1234,999.9,.0999,1e12]){
    const result=resistorVisual(value);assert.equal(result.mode,'printed');assert.deepEqual(result.bands,[]);
    assert.equal(result.value,value);assert.equal(result.label,formatResistance(value));
  }
});

test('zero-ohm rendering is a single black band; invalid values do not become 330 Ω',()=>{
  const zero=resistorVisual(0);assert.equal(zero.mode,'jumper');assert.equal(zero.label,'0 Ω');
  assert.deepEqual(zero.bands.map(b=>b.name),['黑']);
  for(const value of [-1,Infinity,NaN,'bad',''])assert.equal(resistorVisual(value).mode,'invalid');
  assert.equal(resistorVisual({}).label,'330 Ω');
  // This verifies rendering only. The circuit's own validation controls allowed values.
});

test('labels preserve zero and use the actual edited resistance or capacitance',()=>{
  assert.equal(componentLabel({id:'rv1',type:'pot',resistance:47000}),'rv1 · 47 kΩ');
  assert.equal(componentLabel({id:'r2',type:'resistor',resistance:1234}),'r2 · 1.234 kΩ');
  assert.equal(componentLabel({id:'c1',type:'capacitor',capacitance:0}),'c1 · 0 µF');
  assert.equal(formatCapacitance(1000),'1 mF');
  assert.equal(formatCapacitance(.1),'100 nF');
  assert.equal(formatCapacitance(.00001),'10 pF');
  assert.equal(formatCapacitance(-5),'容量无效');
});

test('each simulated part exposes exactly its solver pin names with finite shared contacts',()=>{
  for(const [type,definition] of Object.entries(PARTS)){
    const pins=componentPins({type},definition);
    assert.deepEqual(pins.map(pin=>pin.id).sort(),[...definition.pins].sort(),type);
    assert.equal(new Set(pins.map(pin=>pin.id)).size,pins.length,type);
    for(const pin of pins){assert.ok([pin.x,pin.z,pin.y].every(Number.isFinite));assert.deepEqual(componentPin({type},pin.id,definition),pin);}
  }
});

test('LED, capacitor, and buzzer contacts remain exposed and preserve polarity/lead length',()=>{
  const ledA=componentPin({type:'led'},'A'),ledK=componentPin({type:'led'},'K');
  assert.ok(ledA.x<ledK.x);assert.ok(ledA.z>ledK.z);assert.match(ledK.label,/−/);
  const capPlus=componentPin({type:'capacitor'},'+'),capMinus=componentPin({type:'capacitor'},'-');
  assert.ok(capPlus.x<0&&capMinus.x>0);assert.ok(capPlus.z>capMinus.z&&capMinus.z>.24);
  for(const pin of componentPins({type:'buzzer'}))assert.ok(pin.z>.49,'buzzer terminal must be outside the case, not hidden at z=0');
});

test('mounted model terminals land on their sockets and scene bounds use their mounted pose',()=>{
  const breadboard={x:2.5,z:.6};
  const components=[
    {id:'led1',type:'led',x:28,z:18,rotation:90,mount:{hole:'bb:a10',rotation:0}},
    {id:'r1',type:'resistor',x:-28,z:18,rotation:180,mount:{hole:'bb:g15',rotation:90}}
  ];
  for(const part of components){
    const pose=partPose(part,breadboard);
    assert.equal(pose.mounted,true);
    for(const {a,b} of mountedPartContacts(part)){
      const pin=componentPin(part,a.split(':')[1]);
      const {x,z}=rotateBoardPoint(pin.x,pin.z,pose.rotation);
      const hole=signalHole(b[3],Number(b.slice(4)));
      assert.ok(Math.abs(pose.x+x-breadboard.x-hole.x)<1e-8,a);
      assert.ok(Math.abs(pose.z+z-breadboard.z-hole.z)<1e-8,a);
    }
  }
  const profile=BOARD_PROFILE_LIST.find(item=>item.id==='bluepill');
  const circuit={breadboard,components};
  const withResolvedParts={...circuit,components:components.map(part=>({...part,...partPose(part,breadboard),mount:undefined}))};
  assert.deepEqual(visualBounds(circuit,profile),visualBounds(withResolvedParts,profile));
});

test('unknown modules retain all supplied pins without pretending to add a bus model',()=>{
  const pins=componentPins({type:'custom-sensor',pins:['VCC','GND','SDA','SCL','INT']});
  assert.deepEqual(pins.map(pin=>pin.id),['VCC','GND','SDA','SCL','INT']);
  assert.ok(pins.every(pin=>Number.isFinite(pin.x)&&Number.isFinite(pin.z)));
});

test('all registered board geometries preserve every physical profile pin coordinate',()=>{
  for(const profile of BOARD_PROFILE_LIST){
    const visual=boardVisual(profile);assert.equal(visual.width,profile.width);assert.equal(visual.height,profile.height);
    assert.equal(new Set(visual.pins.map(pin=>pin.id)).size,profile.pins.length,profile.id);
    for(const source of profile.pins){
      const shown=visual.pins.find(pin=>pin.id===source.id);assert.ok(shown,profile.id+':'+source.id);
      assert.equal(shown.x,source.x);assert.equal(shown.z,source.z);assert.equal(shown.label,source.label);
    }
  }
});
