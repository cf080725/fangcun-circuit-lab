import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitSimulator, createCircuit, makePart } from '../dist/circuit.js';
import { componentRemoval, copyComponent, nextComponentId } from '../dist/scene-objects.js';

test('batch delete lists the shared wire once and leaves locks, fixed objects and lookalike ids alone', () => {
  const circuit = createCircuit();
  circuit.components.push(makePart('led', 'led10'), { ...makePart('led', 'locked'), locked: true });
  circuit.wires.push({ id: 'customWire', a: 'led10:A', b: 'locked:K' });
  const plan = componentRemoval(circuit, ['r1', 'led1', 'led1', 'mcu', 'breadboard', 'locked']);
  assert.deepEqual(new Set(plan.parts.map(p => p.id)), new Set(['led1', 'r1']));
  assert.equal(plan.wires.length, 3);
  assert.equal(new Set(plan.wires.map(w => w.id)).size, 3);
  assert.ok(!plan.wires.some(w => w.id === 'customWire'));
  assert.equal(circuit.wires.length, 4);
});

test('hiding and locking an LED do not change its live circuit, deletion opens the branch', () => {
  const circuit = createCircuit();
  const simulator = new CircuitSimulator();
  const drive = { pins: { PA0: { mode: 'GPIO_Mode_Out_PP', level: 1, clock: true } }, timeMs: 1 };
  const before = simulator.solve(circuit, drive).parts.led1.currentMa;
  Object.assign(circuit.components.find(p => p.id === 'led1'), { locked: true, hidden: true });
  assert.equal(simulator.solve(circuit, drive).parts.led1.currentMa, before);
  const { parts, wires } = componentRemoval(circuit, ['r1', 'led1']);
  assert.deepEqual(parts.map(p => p.id), ['r1']);
  assert.equal(wires.length, 2);
  circuit.components = circuit.components.filter(p => !parts.includes(p));
  circuit.wires = circuit.wires.filter(w => !wires.includes(w));
  assert.equal(simulator.solve(circuit, drive).parts.led1.brightness, 0);
});

test('reusing a removed component id starts fresh while keeping other solver state', () => {
  const simulator = new CircuitSimulator();
  simulator.capVoltages = { cap1: 3.3, cap2: 1.4 };
  simulator.motorStates = { motor1: { omega: 10, angle: 20 }, motor2: { omega: 8, angle: 3 } };
  simulator.removeParts(new Set(['cap1', 'motor2']));
  assert.deepEqual(simulator.capVoltages, { cap2: 1.4 });
  assert.deepEqual(simulator.motorStates, { motor1: { omega: 10, angle: 20 } });
});

test('copy retains configuration and rotation, respects existing wire ids, and clears view and held-button flags', () => {
  const original = {
    ...makePart('button', 'button1', 29.9, 19.9),
    displayName: '启动键', locked: true, hidden: true, pressed: true, rotation: 270
  };
  const circuit = { components: [original], wires: [{ id: 'button2' }] };
  const copy = copyComponent(original, circuit);
  assert.equal(nextComponentId('button', circuit), 'button3');
  assert.equal(copy.id, 'button3');
  assert.equal(copy.displayName, original.displayName);
  assert.equal(copy.rotation, 270);
  assert.equal(copy.pressed, false);
  assert.equal(copy.locked, undefined);
  assert.equal(copy.hidden, undefined);
  assert.ok(Math.abs(copy.x) <= 29 && Math.abs(copy.z) <= 19);
  assert.ok(Math.hypot(copy.x - original.x, copy.z - original.z) >= 1.6);
  assert.equal(original.pressed, true);
});

test('copying an inserted component never reserves the original sockets', () => {
  const circuit=createCircuit('plugged-led');
  const original=circuit.components.find(part=>part.id==='led1');
  original.mount={hole:'bb:a11',rotation:180};
  const copy=copyComponent(original,circuit);
  assert.equal(copy.mount,undefined);
  assert.equal(copy.rotation,180);
  assert.deepEqual(original.mount,{hole:'bb:a11',rotation:180});
});
