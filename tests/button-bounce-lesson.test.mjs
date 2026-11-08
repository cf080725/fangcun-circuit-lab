import assert from 'node:assert/strict';
import test from 'node:test';
import {makeButtonBounceLesson} from '../dist/button-bounce-lesson.js';
import {buttonContact,scheduleButtonPress,setButtonContact,settleButtonContact} from '../dist/button-contact.js';
import {CircuitSimulator,createCircuit} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {parseLabProject} from '../dist/project-import.js';

test('the Blue Pill bounce lesson reuses the inserted button circuit and restores the option without a held key', () => {
  const lesson = makeButtonBounceLesson();
  assert.equal(lesson.id,'button-bounce');
  assert.equal(lesson.watchPin,'PB1');
  const expected = createCircuit('plugged-button');
  expected.components.find(part=>part.id==='button1').bounce = true;
  assert.deepEqual(lesson.circuitData,expected);
  assert.match(lesson.files['main.c'],/^#define DEBOUNCE_MS 0$/m);
  const button=lesson.circuitData.components.find(part=>part.id==='button1');
  setButtonContact(button,true,10);
  const restored=parseLabProject({version:2,circuit:lesson.circuitData,files:lesson.files,activeFile:'main.c'});
  const restoredButton=restored.circuit.components.find(part=>part.id==='button1');
  assert.equal(restoredButton.bounce,true);
  assert.equal(restoredButton.pressed,false);
  assert.deepEqual(buttonContact(restoredButton,11),{closed:false,bouncing:false});
});

test('one press and release changes the external LED five times raw and once with 10 ms debounce', () => {
  const {boardId,files,circuitData} = makeButtonBounceLesson();
  const debouncedSource=files['main.c'].replace('#define DEBOUNCE_MS 0','#define DEBOUNCE_MS 10');

  function replay(code) {
    const circuit=structuredClone(circuitData),button=circuit.components.find(part=>part.id==='button1');
    const solver=new CircuitSimulator(),edges=[],frames=[];
    scheduleButtonPress(button,0,25);
    const built=compileForBoard({'main.c':code},boardId);
    assert.deepEqual(built.diagnostics.filter(issue=>issue.severity==='error'),[]);
    const runtime=createBoardRuntime(built,{
      readPin:(pin,state)=>solver.solve(circuit,state,{averagePWM:false}).readPin(pin)
    },boardId);
    let lit=false;
    for(let time=0;time<45;time++){
      const state=runtime.runUntilDelay(1000);
      assert.equal(state.timeMs,time+1);
      assert.deepEqual(state.diagnostics,[]);
      const next=solver.solve(circuit,state).parts.led1.currentMa>.001;
      if(next!==lit)edges.push(time);
      lit=next;frames.push(state.variables.stableLevel);
    }
    return {edges,frames,state:runtime.getState()};
  }

  const raw=replay(files['main.c']);
  assert.deepEqual(raw.edges,[0,2,4,26,28]);
  assert.equal(raw.state.variables.pressCount,5);
  assert.equal(raw.state.serial,'1\r\n2\r\n3\r\n4\r\n5\r\n');
  const filtered=replay(debouncedSource);
  assert.deepEqual(filtered.edges,[14]);
  assert.equal(filtered.frames[13],1);
  assert.equal(filtered.frames[14],0);
  assert.equal(filtered.frames[38],0);
  assert.equal(filtered.frames[39],1);
  assert.equal(filtered.state.variables.pressCount,1);
  assert.equal(filtered.state.serial,'1\r\n');
});

test('a held cap stays down while the manual contact opens, and its release settles',()=>{
  const circuit=makeButtonBounceLesson().circuitData;
  const button=circuit.components.find(part=>part.id==='button1');
  const solver=new CircuitSimulator();
  const read=timeMs=>solver.solve(circuit,{timeMs,pins:{PB1:{mode:'GPIO_Mode_IPU'}}}).readPin('PB1');
  assert.equal(read(10),1);
  assert.equal(setButtonContact(button,true,10),true);
  assert.deepEqual([10,11,12,13,14].map(read),[0,1,0,1,0]);
  assert.equal(button.pressed,true);
  assert.equal(setButtonContact(button,false,20),true);
  assert.deepEqual([20,21,22,23,24].map(read),[1,0,1,0,1]);
  assert.equal(button.pressed,false);
  setButtonContact(button,true,30);
  settleButtonContact(button);
  assert.equal(read(31),0);
});
