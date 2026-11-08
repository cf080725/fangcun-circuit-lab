import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {advancePdvPhotocell,pdvPhotocellMaxLux,pdvPhotocellModel} from '../dist/pdv-photocell.js';
import {parseLabProject,validateCircuit} from '../dist/project-import.js';
import {sourceCircuitKey} from '../dist/source-hardware.js';

const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const state=(timeMs,pins={})=>({boardId:'bluepill',timeMs,pins});
const wires=(...pairs)=>pairs.map(([a,b],i)=>({id:'w'+(i+1),a,b}));
const dark=500000;

function fixture() {
  const circuit=createCircuit('onboard');
  const cell={...makePart('ldr','ldr1'),ldrModel:pdvPhotocellModel,ldrCovered:false,lux:20};
  const load={...makePart('resistor','r1'),resistance:22000};
  circuit.components.push(cell,load);
  circuit.wires=wires(['mcu:3V3','ldr1:1'],['ldr1:2','r1:1'],['r1:1','mcu:PA1'],['r1:2','mcu:GND']);
  return {circuit,cell,load};
}

test('covering the named photocell changes the comparison condition without changing wires',()=>{
  const {circuit,cell}=fixture(),profile=getBoardProfile(circuit.boardId);
  const light=sourceCircuitKey(circuit,profile);
  cell.ldrCovered=true;
  assert.notEqual(sourceCircuitKey(circuit,profile),light);
  cell.ldrCovered=false;
  assert.equal(sourceCircuitKey(circuit,profile),light);
});

test('PDV-P8103 targets the documented resistance curve within finite teaching limits',()=>{
  const sample=(lux,ldrCovered=false)=>advancePdvPhotocell({lux,ldrCovered},null,0).reading;
  assert.deepEqual(sample(10),{ambientLux:10,targetLux:10,covered:false,resistance:24000,targetResistance:24000,settling:false});
  near(sample(100).resistance,24000/10**.75);
  assert.equal(sample(0).resistance,dark);
  assert.equal(sample(Number.MIN_VALUE).resistance,dark);
  assert.equal(sample(200,true).targetResistance,dark);
  assert.equal(sample(200,true).ambientLux,200);
  assert.equal(sample(Number.MAX_VALUE).ambientLux,pdvPhotocellMaxLux);
  assert.equal(sample(Number.MAX_VALUE).resistance,100);
  assert.equal(sample(-1).targetLux,0);
  assert.equal(sample(NaN).ambientLux,100);
});

test('generic LDR remains its original immediate lux curve and ignores named-cell cover metadata',()=>{
  const {circuit,cell}=fixture(),sim=new CircuitSimulator();
  delete cell.ldrModel;
  cell.ldrCovered=true;
  cell.lux=100;
  let reading=sim.solve(circuit,state(5)).parts.ldr1;
  assert.equal(reading.resistance,10000);
  assert.equal(reading.covered,undefined);
  assert.equal(reading.targetResistance,undefined);
  cell.lux=1000;
  reading=sim.solve(circuit,state(5)).parts.ldr1;
  near(reading.resistance,10000*(100/1000)**.7);
});

test('the named photocell changes the actual divider, preserving each light command until its boundary',()=>{
  const {circuit,cell,load}=fixture(),sim=new CircuitSimulator();
  const readAt=time=>sim.solve(circuit,state(time));
  const voltage=result=>result.measureBetween('mcu:PA1','mcu:GND').voltage;
  const expectVoltage=resistance=>3.3*load.resistance/(load.resistance+resistance);
  const initial=readAt(0),bright=initial.parts.ldr1.resistance;
  const brightG=1/bright,darkG=1/dark;
  near(voltage(initial),expectVoltage(bright));
  assert.equal(initial.readADC('PA1'),2484);

  cell.ldrCovered=true;
  const change=readAt(20);
  assert.equal(change.parts.ldr1.targetResistance,dark);
  assert.equal(change.parts.ldr1.ambientLux,20);
  assert.equal(change.parts.ldr1.targetLux,0);
  assert.equal(change.parts.ldr1.settling,true);
  near(change.parts.ldr1.resistance,bright);
  near(readAt(20).parts.ldr1.resistance,bright);
  const falling=readAt(45),afterFall=darkG+(brightG-darkG)/9;
  near(1/falling.parts.ldr1.resistance,afterFall,1e-12);
  near(voltage(falling),expectVoltage(1/afterFall));
  assert.ok(falling.readADC('PA1')<initial.readADC('PA1'));
  const settled=readAt(220);
  near(1/settled.parts.ldr1.resistance,darkG+(brightG-darkG)*9**(-200/25),1e-12);
  assert.equal(settled.parts.ldr1.settling,false);
  assert.equal(settled.readADC('PA1'),173);

  cell.ldrCovered=false;
  near(readAt(300).parts.ldr1.resistance,dark,.03);
  const rising=readAt(360),afterRise=brightG+(darkG-brightG)/9;
  near(1/rising.parts.ldr1.resistance,afterRise,1e-12);
  near(voltage(rising),expectVoltage(1/afterRise));
  assert.ok(rising.readADC('PA1')>settled.readADC('PA1'));
  near(readAt(1000).parts.ldr1.resistance,bright,.0001);
});

test('partitioned solves agree with one frame, while dry-run observations do not commit illumination or elapsed time',()=>{
  const {circuit,cell}=fixture(),one=new CircuitSimulator(),many=new CircuitSimulator();
  for(const sim of [one,many])sim.solve(circuit,state(0));
  cell.ldrCovered=true;
  for(const sim of [one,many])sim.solve(circuit,state(5));
  const direct=one.solve(circuit,state(72)).parts.ldr1;
  for(const time of [7,10,19,30,46,62])many.solve(circuit,state(time));
  near(many.solve(circuit,state(72)).parts.ldr1.resistance,direct.resistance);
  const preview=structuredClone(circuit);
  preview.components[0].ldrCovered=false;
  const sampled=many.sampleAtCurrentTime(preview,state(105));
  assert.equal(sampled.parts.ldr1.covered,false);
  assert.equal(sampled.parts.ldr1.targetLux,20);
  near(sampled.parts.ldr1.resistance,direct.resistance);
  assert.equal(many.lastTime,72);
  assert.equal(many.lastResult.parts.ldr1.covered,true);
  near(many.solve(circuit,state(111)).parts.ldr1.resistance,one.solve(circuit,state(111)).parts.ldr1.resistance);
});

test('PWM phase re-solves use the same actual photocell resistance during the optical transient',()=>{
  const {circuit,cell}=fixture(),sim=new CircuitSimulator();
  const led=makePart('led','led1');
  circuit.components=[cell,led];
  circuit.wires=wires(['mcu:PA0','ldr1:1'],['ldr1:2','led1:A'],['led1:K','mcu:GND']);
  const pins={PA0:{clock:true,mode:'GPIO_Mode_AF_PP',pwm:{frequencyHz:1000,duty:.25,level:1}}};
  sim.solve(circuit,state(0,pins));
  cell.ldrCovered=true;
  sim.solve(circuit,state(0,pins));
  const result=sim.solve(circuit,state(15,pins));
  const {currentMa,pwmAverage}=result.parts.led1;
  assert.ok(currentMa>0);
  assert.ok(result.parts.ldr1.resistance<dark);
  near(pwmAverage.currentMa,.25*currentMa);
});

test('CPU reset and undo can retain the current optical state; replacement projects and removed cells start settled',()=>{
  const {circuit,cell}=fixture(),sim=new CircuitSimulator();
  sim.solve(circuit,state(0));
  cell.ldrCovered=true;
  sim.solve(circuit,state(0));
  const before=sim.solve(circuit,state(10)).parts.ldr1.resistance;
  sim.reset({preservePhotocellStates:true});
  near(sim.solve(circuit,state(0)).parts.ldr1.resistance,before);
  const further=sim.solve(circuit,state(20)).parts.ldr1.resistance;
  assert.ok(further>before);

  const undone=structuredClone(circuit);
  undone.components[0].ldrCovered=false;
  sim.reset({preserveTime:true,preservePhotocellStates:true});
  assert.equal(sim.lastTime,20);
  near(sim.solve(undone,state(20)).parts.ldr1.resistance,further);
  assert.ok(sim.solve(undone,state(30)).parts.ldr1.resistance<further);

  sim.removeParts(['ldr1']);
  assert.equal(sim.solve(circuit,state(30)).parts.ldr1.resistance,dark);
  sim.reset();
  near(sim.solve(undone,state(0)).parts.ldr1.resistance,24000*.5**.75);
});

test('saved projects keep the named cell ambient and cover, and cannot load arbitrary optical simulation history',()=>{
  const {circuit,cell}=fixture();
  cell.ldrCovered=true;
  cell.conductance=.001;
  const raw=JSON.stringify({version:2,files:{'main.c':'int main(void) {}'},circuit});
  const restored=parseLabProject(raw).circuit.components[0];
  assert.equal(restored.lux,20);
  assert.equal(restored.ldrCovered,true);
  assert.equal(restored.ldrModel,pdvPhotocellModel);
  assert.equal(restored.conductance,undefined);
  cell.ldrCovered=1;
  assert.throws(()=>validateCircuit(circuit),/遮光状态必须是布尔值/);
  delete cell.ldrCovered;
  assert.equal(validateCircuit(circuit).components[0].ldrCovered,false);
  cell.ldrModel='generic';
  assert.equal(validateCircuit(circuit).components[0].ldrModel,undefined);
  cell.ldrModel='unrecognized';
  assert.throws(()=>validateCircuit(circuit),/型号无效/);
});
