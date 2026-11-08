import assert from 'node:assert/strict';
import test from 'node:test';
import {makeD13PullupExercise} from '../dist/d13-pullup-exercise.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {validateCircuit,validateSources} from '../dist/project-import.js';

test('only Uno R3 and classic Nano offer the same D13 experiment with a protected button circuit',()=>{
  const uno=makeD13PullupExercise('uno-r3'),nano=makeD13PullupExercise('nano');
  assert.deepEqual(uno.files,nano.files);
  for (const id of ['uno-r4-minima','nano-every','nano-esp32','bluepill','uno']) {
    assert.equal(makeD13PullupExercise(id),null,id);
  }
  for (const {circuit,files} of [uno,nano]) {
    const valid=validateCircuit(circuit);
    assert.equal(valid.boardId,circuit.boardId);
    assert.equal(valid.board.mount,undefined);
    assert.deepEqual(valid.components.map(part=>part.id),['r1','button1']);
    assert.equal(valid.components[0].resistance,1000);
    assert.equal(valid.components[1].pressed,false);
    assert.deepEqual(valid.wires.map(({a,b})=>[a,b]),[
      ['mcu:D13','r1:1'],['r1:2','button1:1'],
      ['button1:3',valid.boardId==='uno-r3'?'mcu:GND3':'mcu:GND1']
    ]);
    assert.deepEqual(validateSources(Object.entries(files)),files);
  }
});

test('the shared sketch prints the actual D13 read every 250 ms',()=>{
  for (const id of ['uno-r3','nano']) {
    const {files}=makeD13PullupExercise(id);
    const compiled=compileForBoard(files,id);
    assert.deepEqual(compiled.diagnostics.filter(item=>item.severity==='error'),[]);
    const reads=[];
    let level=1;
    const runtime=createBoardRuntime(compiled,{readPin(pin){reads.push(pin);return level;}},id);
    const first=runtime.runUntilDelay();
    level=0;
    const second=runtime.runUntilDelay();
    assert.deepEqual(reads,['D13','D13']);
    assert.equal(first.pins.D13.mode,'GPIO_Mode_IPU');
    assert.equal(first.timeMs,250);
    assert.equal(second.timeMs,500);
    assert.equal(second.serial,'1\r\n0\r\n');
  }
});

test('the same wiring and source demonstrate the physical D13 loading difference',()=>{
  function run(boardId, mode='INPUT_PULLUP') {
    const {files,circuit}=makeD13PullupExercise(boardId);
    files['sketch.ino']=files['sketch.ino'].replace('pinMode(TEST_PIN, INPUT_PULLUP)',`pinMode(TEST_PIN, ${mode})`);
    const sim=new CircuitSimulator();
    const runtime=createBoardRuntime(compileForBoard(files,boardId),{
      readPin:(pin,state)=>sim.solve(circuit,state,{averagePWM:false}).readPin(pin)
    },boardId);
    return pressed=>{
      circuit.components[1].pressed=pressed;
      const state=runtime.runUntilDelay();
      assert.equal(state.error,null);
      const result=sim.solve(circuit,state);
      assert.ok(result.converged);
      return {serial:state.serial,voltage:result.netVoltages['mcu:D13'],currentMa:result.parts.onboard.currentMa,issues:result.issues};
    };
  }
  const uno=run('uno-r3'),nano=run('nano');
  const unoReleased=uno(false),nanoReleased=nano(false);
  assert.equal(unoReleased.serial,'1\r\n');
  assert.ok(unoReleased.voltage>4.9 && unoReleased.currentMa>2.9);
  assert.equal(nanoReleased.serial,'0\r\n');
  assert.ok(nanoReleased.voltage>1.9 && nanoReleased.voltage<2.2);
  assert.ok(nanoReleased.currentMa>0 && nanoReleased.currentMa<.1);
  for (const sample of [uno(true),nano(true)]) {
    assert.match(sample.serial,/0\r\n$/);
    assert.ok(sample.voltage>.1 && sample.voltage<.15);
    assert.equal(sample.currentMa,0);
  }
  for (const id of ['uno-r3','nano']) {
    assert.ok(run(id,'INPUT')(false).issues.some(issue=>issue.code==='INPUT_FLOATING' && issue.part==='D13'));
  }
});
