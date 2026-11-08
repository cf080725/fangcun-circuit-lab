import test from 'node:test';
import assert from 'node:assert/strict';
import {getBoardProfile} from '../dist/board-profiles.js';
import {mountedPinRoutes} from '../dist/breadboard-mount.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {makeDevkitcHeaderExercise} from '../dist/devkitc-header-exercise.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {evaluateMountPlacement} from '../dist/mount-placement.js';
import {parseLabProject,validateCircuit} from '../dist/project-import.js';

const jumper = {id:'w5',a:'mcu:GPIO32',b:'button1:1',color:'#ea7246'};

test('DevKitC exercise uses the accessible J row and leaves the covered GPIO32 header jumper to the learner', () => {
  const {circuit} = makeDevkitcHeaderExercise();
  const profile = getBoardProfile(circuit.boardId);
  const routes = new Map(mountedPinRoutes(circuit,profile).map(route=>[route.endpoint,route]));
  assert.equal(routes.size,38);
  assert.equal(routes.get('mcu:GPIO32').socket,'bb:a18');
  assert.deepEqual(routes.get('mcu:GPIO32').exposed,[]);
  assert.deepEqual(routes.get('mcu:GPIO23').exposed,['bb:j23']);
  assert.deepEqual(routes.get('mcu:GND2').exposed,['bb:j24']);
  assert.deepEqual(routes.get('mcu:GND3').exposed,['bb:j18']);
  assert.equal(circuit.wires.length,4);
  assert.ok(circuit.wires.every(wire=>!Object.values(wire).includes('button1:1')));
  assert.equal(circuit.components.find(part=>part.id==='r1').resistance,330);
  assert.deepEqual(validateCircuit(circuit),circuit);

  const {mount,...board} = circuit.board;
  const {candidate} = evaluateMountPlacement({...circuit,board},profile,mount);
  assert.ok(candidate);
  assert.deepEqual(candidate.blockers,[]);
  assert.equal(candidate.connectedNets,3);
});

test('the missing jumper enables GPIO32 and the external LED only through the mounted DevKitC circuit', () => {
  const {circuit,files} = makeDevkitcHeaderExercise();
  const button = circuit.components.find(part=>part.id==='button1');
  const sim = new CircuitSimulator();
  const runtime = createBoardRuntime(compileForBoard(files,circuit.boardId),{
    readPin: name=>sim.solve(circuit,runtime.getState(),{averagePWM:false}).readPin(name)
  },circuit.boardId);

  function read(inputHigh, lit) {
    const state = runtime.runUntilDelay(2000);
    assert.equal(state.error,null,state.error?.plain);
    const result = sim.solve(circuit,state);
    assert.ok(result.converged);
    assert.deepEqual(result.issues.filter(issue=>issue.severity==='error'),[]);
    assert.equal(result.readPin('GPIO32'),inputHigh?1:0);
    assert.ok(Math.abs(result.netVoltages['mcu:GPIO32']-(inputHigh?3.3:0))<.001);
    if (lit) assert.ok(result.parts.led1.currentMa>3 && result.parts.led1.currentMa<4);
    else assert.equal(result.parts.led1.currentMa,0);
  }

  button.pressed = true;
  read(true,false);
  circuit.wires.push({...jumper});
  read(false,true);
  button.pressed = false;
  read(true,false);
  button.pressed = true;
  read(false,true);
  circuit.wires.pop();
  read(true,false);
  circuit.wires.push({...jumper});
  delete circuit.board.mount;
  read(true,false);
});

test('project reload retains the new GPIO32 jumper and the DevKitC placement with the button released', () => {
  const {circuit,files} = makeDevkitcHeaderExercise();
  circuit.wires.push({...jumper});
  circuit.components.find(part=>part.id==='button1').pressed = true;
  const project = {format:'physical-lab',version:2,exampleId:'esp32-devkitc:header',files,circuit};
  const loaded = parseLabProject(JSON.stringify(project));
  assert.deepEqual(loaded.circuit.board,circuit.board);
  assert.deepEqual(loaded.circuit.wires,circuit.wires);
  assert.equal(loaded.circuit.components.find(part=>part.id==='button1').pressed,false);
});
