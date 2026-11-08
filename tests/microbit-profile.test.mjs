import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber,canonicalPin,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {getMountOptions} from '../dist/breadboard-mount.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';

const id='microbit-v2';

test('micro:bit V2.2x preserves the five ring contacts, guard aliases and GPIO exclusions',()=>{
  const board=getBoardProfile(id);
  assert.equal(board.pins.length,25);
  assert.deepEqual(board.pins.filter(pin=>pin.contact==='ring').map(pin=>[pin.id,pin.x,pin.z]),[
    ['P0',-2.159,1.414],['P1',-1.143,1.414],['P2',0,1.414],['3V3',1.143,1.414],['GND',2.159,1.414]
  ]);
  assert.equal(canonicalPin('P9',id),'P0.09');
  assert.equal(boardPinNumber('P1',id),1);
  assert.equal(canonicalPin('3V3c',id),'3V3');
  assert.equal(canonicalPin('GND3',id),'GND');
  assert.deepEqual(board.analogPins,['P0.02','P0.03','P0.04']);
  assert.equal(board.gpioPins.length,9);
  assert.equal(board.reservedPins.length,10);
  assert.equal(board.arduinoExport,false);
  assert.equal(getMountOptions(board),null);
});

test('micro:bit starter drives the physical P0 ring using the specified low-current LED branch',()=>{
  const starter=makeBoardStarter(id,'blink');
  assert.equal(starter.circuit.components.find(part=>part.id==='r1').resistance,3300);
  assert.ok(starter.circuit.wires.some(wire=>wire.a==='mcu:P0' && wire.b==='r1:1'));
  assert.ok(starter.circuit.wires.some(wire=>wire.a==='led1:K' && wire.b==='mcu:GND'));
  const runtime=createBoardRuntime(compileForBoard(starter.files,id));
  const state=runtime.runUntilDelay(200);
  assert.equal(state.error,null);
  const result=new CircuitSimulator().solve(starter.circuit,state);
  assert.ok(result.parts.led1.currentMa>.3 && result.parts.led1.currentMa<.5);
  assert.equal(result.netVoltages['mcu:P0'],result.netVoltages['mcu:P0.02']);
});

test('micro:bit does not silently drive shared matrix, button, accessibility or I2C pins',()=>{
  for(const pin of [3,5,12,19]){
    const files={'sketch.ino':`void setup(){pinMode(${pin},OUTPUT);} void loop(){delay(1);}`};
    const state=createBoardRuntime(compileForBoard(files,id)).runUntilDelay(200);
    assert.equal(state.error?.code,'BOARD_PIN_RESERVED',`P${pin}`);
  }
});
