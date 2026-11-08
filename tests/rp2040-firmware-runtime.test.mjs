import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {CircuitSimulator, createCircuit} from '../dist/circuit.js';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {
  parseRp2040Uf2, RP2040_FLASH_BASE, RP2040_SRAM_BASE, RP2040_SRAM_BYTES, RP2040_VECTOR_OFFSET,
} from '../dist/rp2040-firmware-image.js';
import {createRp2040FirmwareRuntime} from '../dist/rp2040-firmware-runtime.js';

function fixture(name) {
  const file = new URL('../dist/firmware/pico/' + name + '.uf2', import.meta.url);
  return parseRp2040Uf2(readFileSync(file));
}

async function advanceTo(runtime, target) {
  let state = runtime.getState();
  while (state.timeMs < target) {
    const next = await runtime.advanceTime(Math.min(target - state.timeMs, 20));
    assert.equal(next.error, null);
    assert(next.cycles > state.cycles);
    state = next;
  }
  return state;
}

test('Pico boots compiled XIP UF2, steps one Thumb instruction and drives both LEDs', async t => {
  const image = fixture('blink');
  const runtime = await createRp2040FirmwareRuntime(image);
  t.after(() => runtime.dispose());
  const circuit = createCircuit('blink', 'pico');
  const solver = new CircuitSimulator();
  const boot = runtime.getState();
  assert.equal(boot.pc.byteAddress, image.resetAddress);
  assert.equal(boot.dialect, 'rp2040-firmware');
  assert.equal(boot.cycles, 0);
  assert.equal(boot.pins.GP25.configured, false);

  const one = await runtime.step();
  assert.equal(one.steps, 1);
  assert.equal(one.executedSteps, 1);
  assert.notEqual(one.pc.byteAddress, boot.pc.byteAddress);

  const on = await advanceTo(runtime, 20);
  assert.equal(on.coreClockHz, 12_000_000);
  assert.equal(on.pins.GP25.level, 1);
  assert.equal(on.pins.GP15.level, 1);
  assert(solver.solve(circuit, on).parts.onboard.brightness > 0);
  const off = await advanceTo(runtime, 510);
  assert.equal(off.pins.GP25.level, 0);
  assert.equal(off.pins.GP15.level, 0);
  assert.equal(solver.solve(circuit, off).parts.onboard.brightness, 0);
  assert.equal((await advanceTo(runtime, 1010)).pins.GP25.level, 1);

  const reset = await runtime.reset();
  assert.equal(reset.pc.byteAddress, boot.pc.byteAddress);
  assert.equal(reset.cycles, 0);
  assert.equal(reset.pins.GP25.configured, false);
});

test('Pico native button reads the wired GP14 pull-up and drives GP15 LED', async t => {
  const circuit = createCircuit('button', 'pico');
  const solver = new CircuitSimulator();
  const button = circuit.components.find(part => part.type === 'button');
  const runtime = await createRp2040FirmwareRuntime(fixture('button'), {
    readInputs: state => ({GP14: solver.solve(circuit, state).readPin('GP14')}),
  });
  t.after(() => runtime.dispose());
  await advanceTo(runtime, 1);
  const released = await advanceTo(runtime, 2);
  assert.equal(released.pins.GP14.mode, 'GPIO_Mode_IPU');
  assert.equal(released.pins.GP14.level, 1);
  assert.equal(released.pins.GP15.level, 0);

  button.pressed = true;
  const pressed = await advanceTo(runtime, 3);
  assert.equal(pressed.pins.GP14.level, 0);
  assert.equal(pressed.pins.GP15.level, 1);
  assert(solver.solve(circuit, pressed).parts.led1.brightness > 0);

  button.pressed = false;
  assert.equal((await advanceTo(runtime, 4)).pins.GP15.level, 0);
});

test('Pico native ADC reads the GP26 circuit voltage and prints the hardware result', async t => {
  const circuit = createCircuit('adc', 'pico');
  const solver = new CircuitSimulator();
  const pot = circuit.components.find(part => part.id === 'pot1');
  const io = createAvrCircuitIO(() => circuit, solver);
  pot.position = .1;
  const runtime = await createRp2040FirmwareRuntime(fixture('adc'), io);
  t.after(() => runtime.dispose());

  const low = await advanceTo(runtime, 130);
  assert.equal(low.pins.GP26.mode, 'GPIO_Mode_AIN');
  assert.equal(low.adc.ADC0.resultPin, 'GP26');
  assert(Math.abs(low.adc.ADC0.result - 409) <= 1);
  assert(low.serial.split(/\r?\n/).includes(String(low.adc.ADC0.result)));
  assert.equal(solver.solve(circuit, low).parts.led1.brightness, 0);

  pot.position = .9;
  io.invalidateAnalog();
  const high = await advanceTo(runtime, 240);
  assert(Math.abs(high.adc.ADC0.result - 3686) <= 1);
  assert(high.serial.split(/\r?\n/).includes(String(high.adc.ADC0.result)));
  assert(solver.solve(circuit, high).parts.led1.brightness > 0);
  assert.equal((await runtime.reset()).adc.ADC0.result, null);
});

test('Pico native PWM drives GP15 on slice 7B and changes the average LED brightness', async t => {
  const circuit = createCircuit('pwm', 'pico');
  const solver = new CircuitSimulator();
  const runtime = await createRp2040FirmwareRuntime(fixture('pwm'));
  t.after(() => runtime.dispose());

  const low = await advanceTo(runtime, 30);
  assert.equal(low.pins.GP15.mode, 'GPIO_Mode_AF_PP');
  const {frequencyHz, duty, slice, channel, level} = low.pins.GP15.pwm;
  assert.deepEqual({frequencyHz, duty, slice, channel}, {frequencyHz:1000,duty:.25,slice:7,channel:'B'});
  assert.equal(low.pins.GP15.level, level);
  const lowLed = solver.solve(circuit, low).parts.led1;
  assert.equal(lowLed.pwmAverage.duty, .25);
  assert(lowLed.displayBrightness > 0);

  const high = await advanceTo(runtime, 530);
  assert.equal(high.pins.GP15.pwm.duty, .75);
  const highLed = solver.solve(circuit, high).parts.led1;
  assert.equal(highLed.pwmAverage.duty, .75);
  assert(Math.abs(highLed.displayBrightness - 3 * lowLed.displayBrightness) < .0001);
  assert.equal((await advanceTo(runtime, 1030)).pins.GP15.pwm.duty, .25);
  assert.equal((await runtime.reset()).pins.GP15.pwm, undefined);
});

test('Pico CPU reads and writes the UART0 data register through the byte console', async t => {
  const start = RP2040_VECTOR_OFFSET + 8;
  const flash = new Uint8Array(start + 32);
  const view = new DataView(flash.buffer);
  view.setUint32(RP2040_VECTOR_OFFSET, RP2040_SRAM_BASE + RP2040_SRAM_BYTES, true);
  view.setUint32(RP2040_VECTOR_OFFSET + 4, RP2040_FLASH_BASE + start + 1, true);
  const code = [
    0x4805, 0x4906, 0x6301, // Load UART0 base and CR, then enable UART, TX, RX
    0x2141, 0x6001, // Transmit A
    0x6981, 0x06c9, 0xd4fc, // Wait for UARTFR.RXFE to clear
    0x6801, 0x6001, 0xe7f9, 0xbf00, // Echo UARTDR and return to the poll
  ];
  code.forEach((word, index) => view.setUint16(start + index * 2, word, true));
  view.setUint32(start + 24, 0x40034000, true);
  view.setUint32(start + 28, 0x301, true);
  const chunks = [];
  const runtime = await createRp2040FirmwareRuntime({flash}, {onSerial: (text, port) => chunks.push([text, port])});
  t.after(() => runtime.dispose());
  const initial = await runtime.step(12);
  assert.equal(initial.error, null);
  assert.equal(initial.uarts.UART0.rxEnabled, true);
  assert.equal(initial.serial, 'A');
  await runtime.injectSerial('Z', 'UART0');
  assert.equal((await runtime.step(12)).serial, 'AZ');
  assert.deepEqual(chunks, [['A', 'UART0'], ['Z', 'UART0']]);
  assert.equal((await runtime.reset()).serial, '');
});

test('Pico execution yields within the command budget and supports disposing a pending command', async t => {
  const runtime = await createRp2040FirmwareRuntime(fixture('button'));
  t.after(() => runtime.dispose());
  const slice = await runtime.advanceTime(1000);
  assert.equal(slice.error, null);
  assert(slice.timeMs > 0 && slice.timeMs < 20.001);
  assert.equal(slice.budgetReached, true);

  const pending = runtime.advanceTime(20);
  await Promise.resolve();
  runtime.dispose();
  assert.equal((await pending).status, 'disposed');
});
