import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator, createCircuit} from '../dist/circuit.js';
import {parseStm32Bin, parseStm32Hex} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

const boardId = 'nucleo-f103rb';

async function loadSample(t, name, options) {
  const source = extension => new URL(`../dist/firmware/${boardId}/${name}.${extension}`, import.meta.url);
  const image = parseStm32Hex(readFileSync(source('hex'), 'utf8'), boardId);
  const binary = parseStm32Bin(readFileSync(source('bin')), boardId);
  assert.deepEqual(image.flash, binary.flash);
  assert.equal(image.flash.length, 128 * 1024);
  assert.equal(image.initialStack, 0x20005000);
  const runtime = await createStm32FirmwareRuntime(image, {boardId, ...options});
  t.after(() => runtime.dispose());
  return runtime;
}

async function advanceTo(runtime, target) {
  let state = runtime.getState();
  while (state.timeMs < target - 1e-6) {
    const previousCycles = state.cycles;
    state = await runtime.advanceTime(Math.min(20, target - state.timeMs));
    assert.equal(state.error, null);
    assert(state.cycles > previousCycles);
  }
  return state;
}

test('NUCLEO-F103RB executes the compiled PA5 blink and lights its active-high LD2', async t => {
  const circuit = createCircuit('blink', boardId);
  const solver = new CircuitSimulator();
  const runtime = await loadSample(t, 'blink');
  const resetVector = runtime.getState().pc.byteAddress;

  for (const [time, level] of [[10, 1], [490, 1], [510, 0], [990, 0], [1010, 1]]) {
    const state = await advanceTo(runtime, time);
    assert.equal(state.pins.PA5.level, level);
    assert.equal(solver.solve(circuit, state).parts.onboard.brightness > 0, Boolean(level));
  }

  const reset = await runtime.reset();
  assert.equal(reset.pc.byteAddress, resetVector);
  assert.equal(reset.cycles, 0);
  assert.equal((await advanceTo(runtime, 10)).pins.PA5.level, 1);
});

test('NUCLEO-F103RB compiled button program reads the onboard B1 pull-up through the circuit', async t => {
  const circuit = createCircuit('blink', boardId);
  const solver = new CircuitSimulator();
  const io = createAvrCircuitIO(() => circuit, solver);
  const runtime = await loadSample(t, 'button', io);
  await runtime.advanceTime(1);

  for (const pressed of [false, true, false]) {
    circuit.board.userButtonPressed = pressed;
    const state = await runtime.advanceTime(1);
    assert.equal(state.error, null);
    assert.equal(state.pins.PC13.mode, 'GPIO_Mode_IN_FLOATING');
    assert.equal(state.pins.PC13.level, pressed ? 0 : 1);
    assert.equal(state.pins.PA5.level, pressed ? 1 : 0);
    assert.equal(solver.solve(circuit, state).parts.onboard.brightness > 0, pressed);
  }
});

test('NUCLEO-F103RB samples its PA0 potentiometer and prints the threshold result on USART2', async t => {
  const circuit = createCircuit('adc', boardId);
  const solver = new CircuitSimulator();
  const pot = circuit.components.find(part => part.type === 'pot');
  const io = createAvrCircuitIO(() => circuit, solver);
  let serial = '';
  pot.position = .1;
  const runtime = await loadSample(t, 'adc', {...io, onSerial(text, port) {
    assert.equal(port, 'USART2');
    serial += text;
  }});

  for (const [position, time, expected, level] of [[.1, 120, 410, 0], [.9, 220, 3686, 1], [.1, 320, 410, 0]]) {
    pot.position = position;
    io.invalidateAnalog();
    const state = await advanceTo(runtime, time);
    const adc = state.adc.ADC1;
    assert.equal(adc.calibrated, true);
    assert.equal(adc.resultPin, 'PA0');
    assert(Math.abs(adc.result - expected) <= 1);
    assert.equal(state.pins.PA5.level, level);
    assert.equal(solver.solve(circuit, state).parts.onboard.brightness > 0, Boolean(level));
    assert.equal(Number(serial.trim().split(/\r?\n/).at(-1)), adc.result);
  }
  assert.equal((await runtime.reset()).adc.ADC1.result, null);
});

test('NUCLEO-F103RB PWM firmware remaps TIM3_CH1 to PB4 and changes the wired LED brightness', async t => {
  const circuit = createCircuit('pwm', boardId);
  const solver = new CircuitSimulator();
  const runtime = await loadSample(t, 'pwm');
  const initial = await advanceTo(runtime, 20);
  const raised = await advanceTo(runtime, 510);
  const restored = await advanceTo(runtime, 1010);
  const brightness = state => solver.solve(circuit, state).parts.led1.displayBrightness;

  for (const [state, expectedDuty] of [[initial, .25], [raised, .75], [restored, .25]]) {
    const {frequencyHz, duty, timer, channel} = state.pins.PB4.pwm;
    assert.deepEqual({frequencyHz, duty, timer, channel}, {frequencyHz: 1000, duty: expectedDuty, timer: 3, channel: 1});
  }
  assert(brightness(raised) > brightness(initial));
  assert.equal(brightness(restored), brightness(initial));
});
