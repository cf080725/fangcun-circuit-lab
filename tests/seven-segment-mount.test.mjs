import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {rotateBoardPoint,signalHole,signalPitch} from '../dist/breadboard-mount.js';
import {CircuitSimulator,createCircuit,makePart,PARTS} from '../dist/circuit.js';
import {evaluatePartMount,mountedPartBodyBounds,mountedPartContacts,nearestPartMount,partMountPins,
  partMountRotations,partPose,sevenSegmentAnchorRows,sevenSegmentObscuresHole} from '../dist/part-mount.js';
import {validateCircuit} from '../dist/project-import.js';

const bluePill=getBoardProfile('bluepill');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const wire=(id,a,b)=>({id,a,b});
const output=(level,timeMs=0)=>({timeMs,pins:{PA0:{mode:'GPIO_Mode_Out_PP',clock:true,level}}});

test('SC56-11EWA has all ten numbered leads at the measured top-view coordinates',()=>{
  const pins=partMountPins('sevenseg');
  assert.deepEqual(pins.map(pin=>pin.id),PARTS.sevenseg.pins);
  assert.deepEqual(pins.map(({id,number})=>[id,number]),
    [['e',1],['d',2],['COM',3],['c',4],['dp',5],['g',10],['f',9],['COM2',8],['a',7],['b',6]]);
  for(const [index,pin] of pins.entries()){
    near(pin.x,(index%5-2)*signalPitch);
    near(pin.z,index<5?.762:-.762);
  }
  assert.deepEqual(partMountRotations('sevenseg'),[0,180]);
  assert.equal(sevenSegmentAnchorRows(0),'fghi');
  assert.equal(sevenSegmentAnchorRows(180),'bcde');
  assert.equal(sevenSegmentAnchorRows(90),'');
});

test('both orientations land all ten leads in each of the four possible cross-groove row pairs',()=>{
  const circuit=createCircuit('onboard'),display=makePart('sevenseg','display');
  for(const [upper,lower] of [['b','f'],['c','g'],['d','h'],['e','i']]){
    for(const rotation of [0,180]){
      const upright=rotation===0,anchor=upright?lower:upper,column=upright?9:13;
      const mount={hole:`bb:${anchor}${column}`,rotation};
      const planned=evaluatePartMount(circuit,bluePill,display,mount);
      assert.equal(planned.ok,true,planned.reason);
      assert.deepEqual(planned.contacts.map(contact=>contact.b),[anchor,upright?upper:lower].flatMap(row=>
        Array.from({length:5},(_,index)=>`bb:${row}${column+index*(upright?1:-1)}`)));
      assert.deepEqual(nearestPartMount(display,circuit.breadboard,{...planned.pose,rotation}),mount);
      for(const [index,{b}] of planned.contacts.entries()){
        const {x,z}=partMountPins('sevenseg')[index],offset=rotateBoardPoint(x,z,rotation);
        const socket=signalHole(b[3],Number(b.slice(4)));
        near(planned.pose.x+offset.x,circuit.breadboard.x+socket.x);
        near(planned.pose.z+offset.z,circuit.breadboard.z+socket.z);
      }
      const {left,right,top,bottom}=mountedPartBodyBounds(display,planned.pose);
      near(right-left,1.27);
      near(bottom-top,1.905);
    }
  }
  const result=(hole,rotation)=>evaluatePartMount(circuit,bluePill,display,{hole,rotation});
  assert.ok(result('bb:f26',0).ok);
  assert.ok(result('bb:b5',180).ok);
  assert.match(result('bb:f27',0).reason,/第 5 脚对不上/);
  assert.match(result('bb:b4',180).reason,/第 5 脚对不上/);
  assert.match(result('bb:j9',0).reason,/F \/ G \/ H \/ I/);
  assert.match(result('bb:a13',180).reason,/B \/ C \/ D \/ E/);
  assert.match(result('bb:g9',90).reason,/跨过中央沟槽/);
});

test('placing and moving a display checks occupied contacts and low body clearance',()=>{
  const circuit=createCircuit('onboard'),display=makePart('sevenseg','display');
  const mount={hole:'bb:g9',rotation:0},move={hole:'bb:c13',rotation:180};
  circuit.components=[display];
  const result=()=>evaluatePartMount(circuit,bluePill,display,mount);
  circuit.wires=[wire('w1','mcu:PA0','bb:c13')];
  assert.match(result().reason,/C13 孔已有跳线/);
  circuit.wires=[wire('w1','mcu:PA0','bb:d10')];
  assert.match(result().reason,/外壳会遮住 D10 孔/);
  circuit.wires=[wire('w1','mcu:PA0','bb:a10')];
  assert.ok(result().ok);
  display.mount=mount;
  assert.ok(evaluatePartMount(circuit,bluePill,display,move).ok);
  const pose=partPose(display,{x:0,z:0});
  assert.ok(sevenSegmentObscuresHole(pose,signalHole('d',10)));
  assert.ok(!sevenSegmentObscuresHole(pose,signalHole('a',10)));
  const led=makePart('led','led');
  circuit.components.push(led);
  assert.match(evaluatePartMount(circuit,bluePill,led,{hole:'bb:d9',rotation:0}).reason,/D9 孔被数码管 display/);
  assert.deepEqual(display.mount,mount);
});

test('either physical common lead powers the mounted display through the exposed breadboard strips',()=>{
  const circuit=createCircuit('onboard');
  circuit.components=[{...makePart('sevenseg','display'),mount:{hole:'bb:g9',rotation:0}},makePart('resistor','limit')];
  assert.deepEqual(mountedPartContacts(circuit.components[0]).filter(({a})=>a.includes('COM')),
    [{a:'display:COM',b:'bb:g11'},{a:'display:COM2',b:'bb:c11'}]);
  const base=[wire('w1','mcu:PA0','limit:1'),wire('w2','limit:2','bb:a12')];
  for(const returnHole of ['bb:j11','bb:a11']){
    circuit.wires=[...base,wire('w3',returnHole,'mcu:GND1')];
    const valid=validateCircuit(circuit),solver=new CircuitSimulator();
    const high=solver.solve(valid,output(1)),low=solver.solve(valid,output(0,10));
    assert.ok(high.converged&&low.converged);
    near(high.parts.display.segments.a.currentMa,(3.3-1.9)/(47+330+10)*1000);
    near(low.parts.display.segments.a.currentMa,0);
    for(const pin of ['COM','COM2'])near(high.netVoltages['display:'+pin],0);
    assert.deepEqual(high.measureBetween('bb:a11','bb:j11'),{status:'measured',voltage:0});
    near(high.parts.display.segments.dp.currentMa,0);
  }
  circuit.wires=[...base,wire('w3','bb:j11','mcu:GND1'),wire('w4','bb:a11','mcu:3V3')];
  assert.ok(new CircuitSimulator().solve(circuit,output(1)).issues.some(issue=>issue.code==='SUPPLY_SHORT'));
});

test('legacy direct COM wiring remains loadable and common-anode behavior works through COM2',()=>{
  const model=createCircuit('onboard');
  model.components=[makePart('sevenseg','display'),makePart('resistor','limit')];
  const base=[wire('w1','mcu:PA0','limit:1'),wire('w2','limit:2','display:a')];
  model.wires=[...base,wire('w3','mcu:GND1','display:COM')];
  const old=new CircuitSimulator().solve(validateCircuit(model),output(1));
  assert.ok(old.parts.display.segments.a.currentMa>3);

  model.components[0].common='anode';
  model.wires=[...base,wire('w3','mcu:3V3','display:COM2')];
  const solver=new CircuitSimulator(),valid=validateCircuit(model);
  const low=solver.solve(valid,output(0)),high=solver.solve(valid,output(1,10));
  near(low.parts.display.segments.a.currentMa,old.parts.display.segments.a.currentMa);
  near(high.parts.display.segments.a.currentMa,0);
  near(low.netVoltages['display:COM'],3.3);
  near(low.netVoltages['display:COM2'],3.3);
});
