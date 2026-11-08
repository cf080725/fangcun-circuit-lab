import assert from 'node:assert/strict';
import test from 'node:test';
import {joystickState, resetJoystickState, setJoystickState} from '../dist/analog-joystick.js';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';

function setup() {
  const circuit = createCircuit('onboard');
  const joystick = makePart('joystick','joy1',.6,2);
  circuit.components = [joystick];
  circuit.wires = [
    ['joy1:VCC','mcu:3V3'],['joy1:GND','mcu:GND1'],['joy1:HORIZ','mcu:PA0'],
    ['joy1:VERT','mcu:PA1'],['joy1:SEL','mcu:PB1']
  ].map(([a,b],index)=>({id:'w'+(index+1),a,b,color:'#24384a'}));
  return {circuit,joystick};
}

const state = timeMs => ({timeMs,pins:{
  PA0:{mode:'GPIO_Mode_AIN'}, PA1:{mode:'GPIO_Mode_AIN'}, PB1:{mode:'GPIO_Mode_IPU'}
}});
const near = (actual,expected,tolerance=1e-6) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual-expected)<tolerance,`${actual} ≈ ${expected}`);

test('3.3 V axis readings match the SparkFun V-arrow orientation and circular travel',()=>{
  const {circuit,joystick}=setup(),solver=new CircuitSimulator();
  let frame=solver.solve(circuit,state(0));
  near(frame.parts.joy1.supplyVoltage,3.3);
  near(frame.parts.joy1.horizontalVoltage,1.65);
  near(frame.parts.joy1.verticalVoltage,1.65);
  assert.equal(frame.readADC(0),2047); // Numerical leakage puts the ideal midpoint just below the half count.

  for(const [x,y,horizontal,vertical] of [[1,0,0,2047],[-1,0,4095,2047],[0,1,2047,4095],[0,-1,2047,0]]){
    setJoystickState(joystick,{x,y});
    frame=solver.solve(circuit,state(0));
    assert.equal(frame.readADC(0),horizontal);
    assert.equal(frame.readADC(1),vertical);
  }
  setJoystickState(joystick,{x:1,y:1});
  frame=solver.solve(circuit,state(0));
  const diagonal=1/Math.sqrt(2),sample=frame.parts.joy1;
  near(sample.x,diagonal);
  near(sample.y,diagonal);
  near(sample.horizontalVoltage,1.65*(1-diagonal));
  near(sample.verticalVoltage,1.65*(1+diagonal));
  const io=createAvrCircuitIO(()=>circuit,solver);
  near(io.readAnalog('PA0',state(0)),sample.horizontalVoltage);
  near(io.readAnalog('PA1',state(0)),sample.verticalVoltage);
});

test('loads and real supply/return wires change the voltages and no axis drives a disconnected net',()=>{
  const {circuit,joystick}=setup(),solver=new CircuitSimulator();
  const resistor=makePart('resistor','load');
  resistor.resistance=5000;
  circuit.components.push(resistor);
  circuit.wires.push(
    {id:'load1',a:'load:1',b:'joy1:HORIZ',color:'#24384a'},
    {id:'load2',a:'load:2',b:'mcu:GND1',color:'#24384a'}
  );
  let frame=solver.solve(circuit,state(0));
  near(frame.parts.joy1.horizontalVoltage,1.1);
  near(frame.parts.joy1.verticalVoltage,1.65);
  circuit.wires=circuit.wires.filter(wire=>wire.id!=='w1');
  setJoystickState(joystick,{x:-1,y:1});
  frame=solver.solve(circuit,state(0));
  near(frame.parts.joy1.supplyVoltage,0);
  assert.equal(frame.readADC(0),0);
  assert.equal(frame.readADC(1),0);
  circuit.wires=circuit.wires.filter(wire=>!['w2','load1','load2'].includes(wire.id));
  circuit.wires.push({id:'w1',a:'joy1:VCC',b:'mcu:3V3',color:'#24384a'});
  frame=solver.solve(circuit,state(0));
  near(frame.parts.joy1.supplyVoltage,0);
  near(frame.parts.joy1.horizontalVoltage,0);
  near(frame.parts.joy1.verticalVoltage,0);
  assert.equal(frame.readADC(0),4095); // With no return, the passive wipers follow the only attached rail.
  assert.equal(frame.readADC(1),4095);
  circuit.wires=circuit.wires.filter(wire=>wire.id!=='w3');
  frame=solver.solve(circuit,state(0));
  assert.equal(frame.measureBetween('mcu:PA0','mcu:GND').status,'floating');
});

test('SEL is an independent momentary closure and live gestures do not enter project data',()=>{
  const {circuit,joystick}=setup(),solver=new CircuitSimulator(),io=createAvrCircuitIO(()=>circuit,solver);
  const {PB1:released}=io.readInputs(state(0));
  assert.equal(released,1);
  setJoystickState(joystick,{x:.5,y:-.25});
  assert.equal(setJoystickState(joystick,{pressed:true}),true);
  assert.equal(setJoystickState(joystick,{pressed:true}),false);
  assert.equal(setJoystickState(joystick,{x:NaN}),false);
  assert.deepEqual(joystickState(joystick),{x:.5,y:-.25,pressed:true});
  assert.equal(io.readInputs(state(0)).PB1,0);
  assert.equal(solver.lastResult.parts.joy1.selectVoltage,0);
  circuit.wires=circuit.wires.filter(wire=>wire.id!=='w1');
  assert.equal(io.readInputs(state(0)).PB1,0);
  const restored=validateCircuit(JSON.parse(JSON.stringify(circuit))).components[0];
  assert.equal(restored.x,.6);
  assert.equal(restored.z,2);
  assert.deepEqual(joystickState(restored),{x:0,y:0,pressed:false});
  assert.equal(resetJoystickState(joystick),true);
  assert.deepEqual(joystickState(joystick),{x:0,y:0,pressed:false});
  assert.equal(io.readInputs(state(0)).PB1,1);
  const floating=state(0);
  floating.pins.PB1.mode='GPIO_Mode_IN_FLOATING';
  assert.equal(solver.solve(circuit,floating).parts.joy1.selectVoltage,null);
});
