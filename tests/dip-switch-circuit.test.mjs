import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {rotateBoardPoint,signalHole,signalPitch} from '../dist/breadboard-mount.js';
import {CircuitSimulator,createCircuit,makePart,PARTS} from '../dist/circuit.js';
import {dipSwitchAnchorRows,evaluatePartMount,mountedPartContacts,nearestPartMount,partMountPins,partMountRotations} from '../dist/part-mount.js';
import {parseLabProject,validateCircuit} from '../dist/project-import.js';

const profile=getBoardProfile('bluepill');
const referencePins=['PA4','PA3','PA2','PA1'];
const wires=(...pairs)=>pairs.map(([a,b],i)=>({id:'w'+(i+1),a,b}));
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

function fixture() {
  const circuit=createCircuit('onboard');
  const part=makePart('dipswitch','dip1');
  circuit.components.push(part);
  return {circuit,part};
}

test('Omron A6D-4100 pin spacing and both seated orientations map all eight physical leads',()=>{
  const {circuit,part}=fixture();
  circuit.breadboard={x:3.72,z:-2.51};
  const pins=partMountPins(part.type);
  assert.deepEqual(pins.map(pin=>pin.id),PARTS.dipswitch.pins);
  near(pins[1].x-pins[0].x,signalPitch);
  near(pins[0].z-pins[7].z,3*signalPitch);
  assert.deepEqual(partMountRotations(part.type),[0,180]);
  assert.deepEqual([0,90,180,270].map(dipSwitchAnchorRows),['f','','e','']);
  const cases=[
    [{hole:'bb:f27',rotation:0},['f27','f28','f29','f30','e30','e29','e28','e27']],
    [{hole:'bb:e4',rotation:180},['e4','e3','e2','e1','f1','f2','f3','f4']]
  ];
  for(const [mount,expected] of cases){
    const placement=evaluatePartMount(circuit,profile,part,mount);
    assert.equal(placement.ok,true,placement.reason);
    assert.deepEqual(placement.contacts.map(({b})=>b),expected.map(hole=>'bb:'+hole));
    assert.deepEqual(mountedPartContacts({...part,mount}),placement.contacts);
    assert.deepEqual(nearestPartMount(part,circuit.breadboard,placement.pose),mount);
    for(const [index,{a,b}] of placement.contacts.entries()){
      const pin=pins[index],offset=rotateBoardPoint(pin.x,pin.z,mount.rotation);
      const hole=signalHole(b[3],Number(b.slice(4)));
      assert.equal(a,part.id+':'+pin.id);
      near(placement.pose.x+offset.x,circuit.breadboard.x+hole.x);
      near(placement.pose.z+offset.z,circuit.breadboard.z+hole.z);
    }
  }
});

test('DIP insertion rejects the wrong row, overhang, occupied holes and board interference',()=>{
  const {circuit,part}=fixture();
  const tryMount=(hole,rotation)=>evaluatePartMount(circuit,profile,part,{hole,rotation});
  assert.match(tryMount('bb:g15',0).reason,/F 排/);
  assert.match(tryMount('bb:f15',180).reason,/E 排/);
  assert.match(tryMount('bb:f15',90).reason,/180°/);
  assert.match(tryMount('bb:f28',0).reason,/第 4 脚/);
  assert.match(tryMount('bb:e3',180).reason,/第 4 脚/);
  circuit.wires=wires(['bb:e29','mcu:PA0']);
  assert.match(tryMount('bb:f27',0).reason,/E29 孔已有跳线/);
  circuit.wires=[];
  circuit.board.mount={column:6,rotation:90};
  assert.match(tryMount('bb:f15',0).reason,/开发板/);
  assert.equal(tryMount('bb:f27',0).ok,true);
});

test('all 16 masks set only their own mounted contacts and GPIO pull-up inputs',()=>{
  const {circuit,part}=fixture(),solver=new CircuitSimulator();
  part.mount={hole:'bb:f27',rotation:0};
  circuit.wires=wires(...referencePins.flatMap((pin,index)=>[
    [`mcu:${pin}`,`bb:d${27+index}`],[`bb:h${27+index}`,'mcu:GND']
  ]));
  const pins=Object.fromEntries(referencePins.map(pin=>[pin,{mode:'GPIO_Mode_IPU',clock:true}]));
  for(let switchMask=0;switchMask<16;switchMask++){
    part.switchMask=switchMask;
    const result=solver.solve(circuit,{pins,timeMs:switchMask});
    assert.equal(result.converged,true);
    assert.equal(result.parts[part.id].switchMask,switchMask);
    for(const [index,contact] of result.parts[part.id].switches.entries()){
      const closed=Boolean(switchMask&(1<<index)),pin=referencePins[index];
      const current=closed ? 3.3/40000.1*1000 : 0;
      assert.equal(contact.closed,closed);
      assert.equal(result.readPin(pin),closed?0:1);
      near(contact.currentMa,-current);
      near(result.measureBetween(`mcu:${pin}`,'mcu:GND').voltage,closed?current*.0001:3.3,1e-6);
    }
  }
});

test('a closed unmounted DIP supplies a real bias path through its 0.1 Ω branch',()=>{
  const {circuit,part}=fixture(),solver=new CircuitSimulator();
  const resistor=makePart('resistor','load');
  circuit.components.push(resistor);
  circuit.wires=wires(['mcu:3V3','dip1:1'],['dip1:8','mcu:PA0'],['mcu:PA0','load:1'],['load:2','mcu:GND'],
    ['dip1:7','mcu:PA1'],['dip1:2','mcu:GND']);
  const pins={PA0:{mode:'GPIO_Mode_IN_FLOATING'},PA1:{mode:'GPIO_Mode_IN_FLOATING'}};
  part.switchMask=1;
  const first=solver.solve(circuit,{pins,timeMs:1});
  const expected=3.3/(resistor.resistance+.1)*1000;
  near(first.parts.dip1.switches[0].currentMa,expected);
  near(first.measureBetween('dip1:1','dip1:8').voltage,expected*.0001);
  assert.equal(first.readPin('PA0'),1);
  assert.equal(first.measureBetween('mcu:PA1','mcu:GND').status,'floating');
  assert.ok(first.issues.some(issue=>issue.code==='INPUT_FLOATING'&&issue.part==='PA1'));
  part.switchMask=2;
  const second=solver.solve(circuit,{pins,timeMs:2});
  assert.equal(second.readPin('PA0'),0);
  assert.equal(second.measureBetween('mcu:PA1','mcu:GND').status,'measured');
  assert.ok(!second.issues.some(issue=>issue.code==='INPUT_FLOATING'&&issue.part==='PA1'));
  part.switchMask=Infinity;
  const invalid=solver.solve(circuit,{pins,timeMs:3});
  assert.equal(invalid.parts.dip1.switchMask,0);
  assert.ok(invalid.parts.dip1.switches.every(contact=>!contact.closed&&contact.currentMa===0));
});

test('project roundtrip retains DIP position and mask and rejects corrupt states or terminal IDs',()=>{
  const {circuit,part}=fixture();
  part.mount={hole:'bb:f27',rotation:0};
  part.switchMask=10;
  circuit.wires=wires(['mcu:GND','bb:h27'],['mcu:PA1','bb:d27']);
  const restored=parseLabProject(JSON.stringify({version:2,files:{'main.c':'int main(void) {}'},circuit}));
  assert.deepEqual(restored.circuit.components[0].mount,part.mount);
  assert.equal(restored.circuit.components[0].switchMask,10);
  for(const switchMask of [-1,16,2.5,'10',false,null,Infinity]){
    part.switchMask=switchMask;
    assert.throws(()=>validateCircuit(circuit),/0～15 的整数/);
  }
  delete part.switchMask;
  assert.equal(validateCircuit(circuit).components[0].switchMask,0);
  delete part.mount;
  circuit.wires=wires(['mcu:GND','dip1:8']);
  assert.equal(validateCircuit(circuit).wires[0].b,'dip1:8');
  circuit.wires[0].b='dip1:9';
  assert.throws(()=>validateCircuit(circuit),/不存在的引脚/);
});
