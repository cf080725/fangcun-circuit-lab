import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_PROFILE_LIST,canonicalPin,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {planFault} from '../dist/fault-exercises.js';
import {exportProject} from '../dist/project-export.js';

const teachingBoards=BOARD_PROFILE_LIST.filter(profile=>profile.arduinoExport===false).map(profile=>profile.id);

test('Nordic DK starters measure the configured physical power rail',()=>{
 for(const [id,level] of [['nrf52840-dk',3],['nrf5340-dk',3],['nrf54l15-dk',3.3]]){
  const profile=getBoardProfile(id),{circuit}=makeBoardStarter(id,'adc');
  const power=circuit.wires.find(wire=>wire.b==='pot1:VCC').a;
  assert.equal(canonicalPin(power,id),profile.logicRail);
  assert.equal(canonicalPin('VLOGIC',id),profile.logicRail);
  const simulator=new CircuitSimulator();
  assert.ok(Math.abs(simulator.solve(circuit).netVoltages[power]-level)<.001,id);
  const fault=planFault('short',circuit,{});
  assert.equal(fault.circuit.wires.at(-1).a,power);
  assert.ok(simulator.solve(fault.circuit).issues.some(issue=>issue.code==='SUPPLY_SHORT'),id);
 }
});

test('the micro:bit blink starter uses a low-current external LED on an edge ring',()=>{
 const id='microbit-v2',starter=makeBoardStarter(id,'blink');
 assert.ok(starter.circuit.wires.some(wire=>wire.a==='mcu:P0'&&wire.b==='r1:1'));
 assert.equal(starter.circuit.components.find(part=>part.type==='resistor').resistance,3300);
 const runtime=createBoardRuntime(compileForBoard(starter.files,id));
 const on=runtime.runUntilDelay(200),result=new CircuitSimulator().solve(starter.circuit,on);
 assert.equal(on.error,null);
 assert.ok(result.parts.led1.currentMa>.3&&result.parts.led1.currentMa<.5);
});

test('teaching sketches export their source and wiring without a target-specific Arduino bundle',()=>{
 for(const id of teachingBoards){
  const {files,circuit}=makeBoardStarter(id,'blink');
  assert.throws(()=>exportProject({files,circuit,boardId:id,format:'arduino'}),/实验台教学接口/);
  const bundle=exportProject({files,circuit,boardId:id,format:'source'});
  assert.equal(bundle.files['sketch.ino'],files['sketch.ino']);
  assert.equal(JSON.parse(bundle.files['接线项目.json']).circuit.boardId,id);
  assert.match(bundle.files['README_源码.md'],/移植到实物/);
 }
});
