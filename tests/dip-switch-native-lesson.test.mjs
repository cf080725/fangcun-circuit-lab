import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {mountedConnections,signalStrip} from '../dist/breadboard-mount.js';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {dipSwitchLessonId,dipSwitchLessonInputs,dipSwitchLessonLed,dipSwitchLessonPart,makeDipSwitchLesson} from '../dist/dip-switch-lesson.js';
import {evaluatePartMount,mountedPartContacts} from '../dist/part-mount.js';
import {validateCircuit} from '../dist/project-import.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

test('the DIP lesson seats all eight contacts and connects the right exposed strips',()=>{
  const lesson=makeDipSwitchLesson(),circuit=validateCircuit(lesson.circuitData);
  assert.equal(lesson.id,dipSwitchLessonId);
  assert.equal(lesson.nativeOnly,true);
  assert.equal(lesson.nativeSourceParameter,'MATCH_MASK');
  assert.deepEqual(circuit.board.mount,{column:6,rotation:90});
  const part=circuit.components.find(({id})=>id===dipSwitchLessonPart);
  assert.deepEqual(part.mount,{hole:'bb:f27',rotation:0});
  assert.equal(part.switchMask,10);
  const profile=getBoardProfile(lesson.boardId);
  const insertion=evaluatePartMount(circuit,profile,part,part.mount);
  assert.ok(insertion.ok,insertion.reason);
  const contacts=new Map(mountedPartContacts(part).map(({a,b})=>[a,b]));
  const boardPins=new Map(mountedConnections(circuit,profile).map(({a,b})=>[a,b]));
  dipSwitchLessonInputs.forEach((pin,index)=>{
    const rowColumn=27+index,signalColumn=17+index;
    assert.deepEqual(signalStrip(boardPins.get(`mcu:${pin}`)),signalStrip(`bb:a${signalColumn}`));
    assert.equal(contacts.get(`${part.id}:${8-index}`),`bb:e${rowColumn}`);
    assert.equal(contacts.get(`${part.id}:${1+index}`),`bb:f${rowColumn}`);
    assert.ok(circuit.wires.some(({a,b})=>a===`bb:a${signalColumn}`&&b===`bb:d${rowColumn}`));
    assert.ok(circuit.wires.some(({a,b})=>a===`bb:h${rowColumn}`&&b===`bb:n${46+index}`));
  });
  assert.deepEqual(signalStrip(boardPins.get('mcu:PA0')),signalStrip('bb:a21'));
  assert.deepEqual(signalStrip(boardPins.get('mcu:GND1')),signalStrip('bb:j24'));
  assert.ok(circuit.wires.some(({a,b})=>a==='bb:n50'&&b==='bb:j24'));
});

test('real STM32 C firmware changes the match result with all DIP contacts unchanged',async t=>{
  const {boardId,circuitData:circuit,nativeSourceAssets}=makeDipSwitchLesson();
  const files=Object.fromEntries(Object.entries(nativeSourceAssets)
    .map(([name,asset])=>[name,readFileSync(new URL(asset,new URL('../dist/',import.meta.url)),'utf8')]));
  const header='dip_switch_policy.h';
  const policy=value=>({...files,[header]:files[header].replace('#define MATCH_MASK 5',`#define MATCH_MASK ${value}`)});
  await assert.rejects(compileStm32C(policy(16),{boardId}),error=>error.diagnostics?.some(issue=>
    issue.file===header&&issue.severity==='error'&&/MATCH_MASK/.test(issue.message)));

  const original=structuredClone(circuit);
  const part=circuit.components.find(({id})=>id===dipSwitchLessonPart);
  for(const value of [5,10]){
    const {binary,diagnostics}=await compileStm32C(value===5?files:policy(value),{boardId});
    assert.deepEqual(diagnostics,[]);
    const solver=new CircuitSimulator();
    const runtime=await createStm32FirmwareRuntime(parseStm32Bin(binary,boardId),
      {...createAvrCircuitIO(()=>circuit,solver),boardId});
    t.after(()=>runtime.dispose());
    async function check(mask) {
      await runtime.advanceTime(2);
      const state=await runtime.advanceTime(2);
      assert.equal(state.error,null);
      assert.deepEqual(dipSwitchLessonInputs.map(pin=>state.pins[pin].mode),Array(4).fill('GPIO_Mode_IPU'));
      const levels=dipSwitchLessonInputs.map(pin=>state.pins[pin].level);
      const actual=levels.reduce((bits,level,index)=>bits|((1-level)<<index),0);
      assert.equal(actual,mask);
      const solved=solver.solve(circuit,state);
      assert.equal(solved.converged,true);
      assert.equal(state.pins.PA0.level,Number(mask===value));
      assert.equal(solved.parts[dipSwitchLessonLed].currentMa>0,mask===value);
      assert.equal(solved.parts[dipSwitchLessonPart].switchMask,mask);
    }
    await check(10);
    assert.deepEqual(circuit,original);
    if(value===10){
      part.switchMask=5;
      await check(5);
      part.switchMask=10;
      await check(10);
      assert.deepEqual(circuit,original);
    }
    runtime.dispose();
  }
});
