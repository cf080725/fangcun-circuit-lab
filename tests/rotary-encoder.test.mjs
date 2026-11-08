import assert from 'node:assert/strict';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';
import {validateCircuit} from '../dist/project-import.js';
import {encoderContact, scheduleEncoderDetent, setEncoderSwitch, settleEncoderContact, turnEncoderAtRest} from '../dist/rotary-encoder.js';

const closed = ({aClosed,bClosed}) => Number(aClosed)*2+Number(bClosed);

function setup() {
  const circuit=createCircuit('onboard'),encoder=makePart('encoder','encoder1');
  circuit.components=[encoder];
  circuit.wires=[
    ['mcu:PA0','encoder1:A'], ['mcu:PA1','encoder1:B'], ['encoder1:C','bb:a14'], ['bb:e14','mcu:GND1'],
    ['mcu:PA2','encoder1:SW1'], ['encoder1:SW2','mcu:GND1']
  ].map(([a,b],i)=>({id:'w'+(i+1),a,b,color:'#24384a'}));
  return {circuit,encoder};
}

const inputState = timeMs => ({timeMs,pins:Object.fromEntries(['PA0','PA1','PA2'].map(pin=>[pin,{mode:'GPIO_Mode_IPU',clock:true}]))});

test('queued PEC11R turns preserve exact edge order and spacing in both directions', () => {
  const part=makePart('encoder','knob');
  assert.equal(scheduleEncoderDetent(part,1,.25,{notBeforeMs:4.25}),true);
  assert.equal(scheduleEncoderDetent(part,-1,.25),true);
  assert.equal(scheduleEncoderDetent(part,0,.25),false);
  assert.deepEqual(encoderContact(part,1),{
    aClosed:false,bClosed:false,switchClosed:false,angle:0,detents:0,moving:false,queued:2,nextEdgeMs:16.25
  });
  const times=[4.25,16.25,28.25,40.25,52.25,64.25,76.25,88.25,100.25];
  const frames=times.map(time=>encoderContact(part,time));
  assert.deepEqual(frames.map(closed),[0,2,3,1,0,1,3,2,0]);
  assert.deepEqual(frames.map(frame=>frame.nextEdgeMs),[...times.slice(1),null]);
  assert.deepEqual(frames.map(frame=>frame.detents),[0,0,0,0,1,1,1,1,0]);
  assert.equal(frames[4].angle,15);
  assert.equal(frames.at(-1).angle,0);
  assert.equal(frames.at(-1).moving,false);
  assert.equal(frames.at(-1).queued,0);
  assert.equal(closed(encoderContact(part,16.249999)),0);
  assert.equal(closed(encoderContact(part,16.25)),2);
});

test('actual pull-ups and common return produce quadrature voltage without driving other contacts', () => {
  const {circuit,encoder}=setup(),solver=new CircuitSimulator();
  scheduleEncoderDetent(encoder,1,0);
  scheduleEncoderDetent(encoder,-1,0);
  const times=[0,12,24,36,48,60,72,84,96];
  const io=createAvrCircuitIO(()=>circuit,solver);
  const frames=times.map(time=>io.readInputs(inputState(time)));
  assert.deepEqual(frames.map(({PA0,PA1})=>PA0*2+PA1),[3,1,0,2,3,2,0,1,3]);
  assert(frames.every(frame=>frame.PA2===1));
  assert.equal(setEncoderSwitch(encoder,true),true);
  assert.equal(setEncoderSwitch(encoder,true),false);
  assert.deepEqual(io.readInputs(inputState(97)),{PA0:1,PA1:1,PA2:0});
  assert.equal(setEncoderSwitch(encoder,false),true);
  assert.deepEqual(io.readInputs(inputState(98)),{PA0:1,PA1:1,PA2:1});
  circuit.wires=circuit.wires.filter(wire=>wire.id!=='w4');
  scheduleEncoderDetent(encoder,1,98);
  const open=solver.solve(circuit,inputState(122));
  assert.equal(open.parts.encoder1.aClosed,true);
  assert.equal(open.parts.encoder1.bClosed,true);
  assert.equal(open.readPin('PA0'),1);
  assert.equal(open.readPin('PA1'),1);
  assert.equal(open.measureBetween('encoder1:A','encoder1:C').voltage,0);
  assert.ok(open.measureBetween('encoder1:C','mcu:GND').voltage>3.29);
});

test('isolated sampling, reset and project import do not replay old detent or press inputs', () => {
  const {circuit,encoder}=setup(),solver=new CircuitSimulator();
  for(let i=0;i<32;i++)assert.equal(scheduleEncoderDetent(encoder,1,0),true);
  assert.equal(scheduleEncoderDetent(encoder,1,0),false);
  assert.equal(scheduleEncoderDetent(encoder,1,48),true);
  solver.solve(circuit,inputState(49));
  const future=solver.sampleAtCurrentTime(circuit,inputState(60));
  assert.equal(future.parts.encoder1.aClosed,true);
  assert.equal(solver.lastTime,49);
  assert.equal(solver.solve(circuit,inputState(49)).parts.encoder1.aClosed,false);
  setEncoderSwitch(encoder,true);
  assert.equal(turnEncoderAtRest(encoder,-1,61),true);
  const paused=encoderContact(encoder,61);
  assert.equal(paused.detents,0);
  assert.equal(paused.queued,0);
  assert.equal(paused.switchClosed,true);
  assert.equal(turnEncoderAtRest(encoder,-1,61),true);
  assert.equal(encoderContact(encoder,61).angle,345);
  scheduleEncoderDetent(encoder,1,61);
  const restored=validateCircuit(JSON.parse(JSON.stringify(circuit)));
  assert.equal(restored.wires.length,6);
  assert.deepEqual(encoderContact(restored.components[0],100),encoderContact(makePart('encoder','fresh'),100));
  settleEncoderContact(encoder,80);
  solver.reset();
  const reset=solver.solve(circuit,inputState(0)).parts.encoder1;
  assert.equal(reset.angle,345);
  assert.equal(reset.detents,-1);
  assert.equal(reset.nextEdgeMs,null);
  assert.equal(reset.switchClosed,false);
});

test('source firmware polls physical quadrature, and unplugging C prevents decoded steps', () => {
  const source=`
#include "stm32f10x.h"
#include "Delay.h"
int previous = 3;
int edgeCount = 0;
int signedEdges = 0;
int main(void) {
  RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
  GPIO_InitTypeDef input;
  input.GPIO_Pin = GPIO_Pin_0 | GPIO_Pin_1;
  input.GPIO_Mode = GPIO_Mode_IPU;
  input.GPIO_Speed = GPIO_Speed_50MHz;
  GPIO_Init(GPIOA, &input);
  while (1) {
    int a = GPIO_ReadInputDataBit(GPIOA, GPIO_Pin_0);
    int b = GPIO_ReadInputDataBit(GPIOA, GPIO_Pin_1);
    int ab = a * 2 + b;
    if (ab != previous) {
      if ((previous == 3 && ab == 1) || (previous == 1 && ab == 0) ||
          (previous == 0 && ab == 2) || (previous == 2 && ab == 3)) signedEdges++;
      else signedEdges--;
      edgeCount++;
      previous = ab;
    }
    Delay_ms(1);
  }
}`;
  const built=compileForBoard({'main.c':source},'bluepill');
  assert.deepEqual(built.diagnostics.filter(diagnostic=>diagnostic.severity==='error'),[]);
  const {circuit,encoder}=setup(),solver=new CircuitSimulator();
  const runtime=createBoardRuntime(built,{
    readPin:(pin,state)=>solver.solve(circuit,state,{averagePWM:false}).readPin(pin)
  },'bluepill');
  const reach=timeMs=>{
    while(runtime.getState().timeMs<timeMs) {
      const state=runtime.runUntilDelay(1000);
      assert.equal(state.error,null);
    }
    return runtime.getState().variables;
  };
  scheduleEncoderDetent(encoder,1,0);
  let state=reach(49);
  assert.equal(state.signedEdges,4);
  assert.equal(state.edgeCount,4);
  scheduleEncoderDetent(encoder,-1,49);
  state=reach(98);
  assert.equal(state.signedEdges,0);
  assert.equal(state.edgeCount,8);
  circuit.wires=circuit.wires.filter(wire=>wire.id!=='w4');
  scheduleEncoderDetent(encoder,1,98);
  state=reach(147);
  assert.equal(state.signedEdges,0);
  assert.equal(state.edgeCount,8);
});
