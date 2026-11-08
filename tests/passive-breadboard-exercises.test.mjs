import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator} from '../dist/circuit.js';
import {compileProject,createRuntime} from '../dist/engine.js';
import {mountedPartContacts} from '../dist/part-mount.js';
import {makePassiveBreadboardExercises} from '../dist/passive-breadboard-exercises.js';
import {validateCircuit} from '../dist/project-import.js';

test('the diode lesson keeps the original jumpers and compares forward current with a flipped part', () => {
  const lesson = makePassiveBreadboardExercises().find(example=>example.id==='plugged-diode');
  const circuit = validateCircuit(lesson.circuitData);
  const wires = structuredClone(circuit.wires);
  const diode = circuit.components.find(part=>part.id==='d1');
  const original = diode.mount;
  assert.deepEqual(mountedPartContacts(diode).map(({b})=>b),['bb:a10','bb:a13']);
  const engine = createRuntime(compileProject(lesson.files));
  const state = engine.runUntilDelay(1000);
  assert.equal(state.error,null);
  const simulator = new CircuitSimulator();
  const forward = simulator.solve(circuit,state);
  assert.ok(forward.converged);
  assert.ok(forward.parts.d1.currentMa>1 && forward.parts.d1.currentMa<3);
  assert.ok(Math.abs(forward.parts.led1.currentMa-forward.parts.d1.currentMa)<1e-6);

  diode.mount = {hole:'bb:a13',rotation:180};
  const reverse = simulator.solve(circuit,state);
  assert.ok(reverse.converged);
  assert.ok(reverse.parts.led1.currentMa<.001);
  assert.ok(reverse.parts.d1.currentMa<.001);
  assert.deepEqual(circuit.wires,wires);
  diode.mount = original;
  assert.equal(simulator.solve(circuit,state).parts.d1.currentMa,forward.parts.d1.currentMa);
});

test('the RC lesson runs its annotated program and measures the seated capacitor on PA1', () => {
  const lesson = makePassiveBreadboardExercises().find(example=>example.id==='plugged-rc');
  const circuit = validateCircuit(lesson.circuitData);
  const capacitor = circuit.components.find(part=>part.id==='c1');
  assert.deepEqual(mountedPartContacts(capacitor).map(({b})=>b),['bb:h14','bb:h15']);
  const engine = createRuntime(compileProject(lesson.files));
  const simulator = new CircuitSimulator();
  const samples = new Map();
  for (let i=0;i<120;i++) {
    const state = engine.runSlice(50,1000);
    const result = simulator.solve(circuit,state);
    assert.equal(state.error,null);
    assert.ok(result.converged);
    const measured = result.netVoltages['mcu:'+lesson.watchPin];
    assert.ok(Math.abs(measured-result.parts.c1.voltage)<1e-8);
    samples.set(state.timeMs,measured);
    if (state.timeMs===3000) {
      const mount = capacitor.mount;
      delete capacitor.mount;
      const detached = simulator.solve(circuit,state);
      assert.ok(detached.converged);
      assert.ok(detached.netVoltages['mcu:PA1']>3.29);
      assert.ok(Math.abs(detached.parts.c1.voltage-measured)<1e-8);
      capacitor.mount = mount;
    }
  }
  assert.ok(samples.get(50)<.2);
  assert.ok(samples.get(1000)>2 && samples.get(1000)<2.2);
  assert.ok(samples.get(3000)>3);
  assert.ok(samples.get(6000)<.2);
  delete capacitor.mount;
  const next = simulator.solve(circuit,engine.runSlice(50,1000));
  assert.ok(next.netVoltages['mcu:PA1']>3.29);
});
