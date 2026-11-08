import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {breadboardBlinkBoardIds, makeBreadboardBlink} from '../dist/breadboard-blink.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';
import {evaluateMountPlacement} from '../dist/mount-placement.js';
import {validateCircuit} from '../dist/project-import.js';

for (const id of breadboardBlinkBoardIds) {
  test(`${id} runs the external LED lesson through the two exposed breadboard strips`, () => {
    const lesson = makeBreadboardBlink(id);
    assert.ok(lesson);
    const {circuit, files, ledPin, mount, outputHole, groundHole} = lesson;
    const profile = getBoardProfile(id);
    const solver = new CircuitSimulator();
    const compiled = compileForBoard(files, id);
    assert(!compiled.diagnostics.some(issue => issue.severity === 'error'));
    const cpu = createBoardRuntime(compiled, {}, id);
    const high = cpu.runUntilDelay(2000);
    assert.equal(high.pins[ledPin].output, 1);
    assert.equal(solver.solve(circuit, high).parts.led1.currentMa, 0);
    assert(circuit.wires.every(({a,b}) => !a.startsWith('mcu:') && !b.startsWith('mcu:')));
    assert.match(outputHole, /^bb:[aj]\d+$/);
    assert.match(groundHole, /^bb:[aj]\d+$/);

    const {candidate} = evaluateMountPlacement(circuit, profile, mount);
    assert.equal(candidate.connectedNets, 2);
    assert.equal(candidate.blockers.length, 0);
    circuit.board.mount = candidate.mount;
    assert.deepEqual(validateCircuit(circuit), circuit);
    const on = solver.solve(circuit, high);
    assert(on.parts.led1.currentMa > 3);
    assert.equal(on.netVoltages[outputHole], on.netVoltages[`mcu:${ledPin}`]);
    assert.equal(on.netVoltages[groundHole], 0);
    assert.equal(solver.solve(circuit, cpu.runUntilDelay(2000)).parts.led1.currentMa, 0);

    delete circuit.board.mount;
    assert.equal(solver.solve(circuit, high).parts.led1.currentMa, 0);
  });
}

test('mounted Nano D13 supplies both the onboard L and external LED branches', () => {
  const {circuit,mount,outputHole,groundHole} = makeBreadboardBlink('nano');
  const solver = new CircuitSimulator();
  const high = {timeMs:1,pins:{D13:{mode:'OUTPUT',level:1}}};
  const detached = solver.solve(circuit,high);
  assert.equal(detached.parts.led1.currentMa,0);
  assert.ok(detached.parts.onboard.currentMa>7.7);
  circuit.board.mount = mount;
  const seated = solver.solve(circuit,high);
  assert.ok(seated.converged);
  assert.deepEqual(seated.issues,[]);
  const voltage = seated.netVoltages['mcu:D13'];
  assert.equal(seated.netVoltages[outputHole],voltage);
  assert.equal(seated.netVoltages[groundHole],0);
  assert.ok(Math.abs(seated.parts.onboard.currentMa-(voltage-2)/340*1000)<1e-7);
  assert.ok(Math.abs(seated.parts.led1.currentMa-(voltage-1.9)/480*1000)<1e-7);
  assert.ok(Math.abs(seated.parts.onboard.currentMa+seated.parts.led1.currentMa-(5-voltage)/47*1000)<1e-7);
  const low = solver.solve(circuit,{timeMs:2,pins:{D13:{mode:'OUTPUT',level:0}}});
  assert.equal(low.parts.onboard.currentMa,0);
  assert.equal(low.parts.led1.currentMa,0);
});
