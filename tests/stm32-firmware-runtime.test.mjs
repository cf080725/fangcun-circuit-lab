import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {CircuitSimulator, createCircuit} from '../dist/circuit.js';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

const FLASH = 0x08000000;
const firmware = name => readFileSync(new URL('../dist/firmware/bluepill/' + name + '.bin', import.meta.url));

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

test('Blue Pill executes compiled SysTick IRQ blink, steps one ordinary Thumb instruction and resets', async t => {
  const runtime = await createStm32FirmwareRuntime({flash: firmware('blink')});
  t.after(() => runtime.dispose());
  const circuit = createCircuit('onboard');
  const solver = new CircuitSimulator();
  const reset = runtime.getState();
  assert.equal(reset.dialect, 'stm32-firmware');
  assert.equal(reset.coreClockHz, 8_000_000);
  assert.equal(reset.pins.PC13.mode, 'GPIO_Mode_IN_FLOATING');
  assert.equal(reset.cycles, 0);

  const one = await runtime.step();
  assert.equal(one.steps, 1);
  assert.equal(one.executedSteps, 1);
  assert([2, 4].includes(one.pc.byteAddress - reset.pc.byteAddress));

  const on = await advanceTo(runtime, 20);
  assert.equal(on.pins.PC13.level, 0);
  assert(solver.solve(circuit, on).parts.onboard.brightness > 0);
  const off = await advanceTo(runtime, 510);
  assert.equal(off.pins.PC13.level, 1);
  assert.equal(solver.solve(circuit, off).parts.onboard.brightness, 0);
  assert.equal((await advanceTo(runtime, 1010)).pins.PC13.level, 0);

  const reloaded = await runtime.reset();
  assert.equal(reloaded.cycles, 0);
  assert.equal(reloaded.pc.byteAddress, reset.pc.byteAddress);
  assert.equal(reloaded.pins.PC13.mode, 'GPIO_Mode_IN_FLOATING');
});

test('Blue Pill reads the real PB1 pull-up circuit and drives the wired PA0 LED', async t => {
  const circuit = createCircuit('button');
  const solver = new CircuitSimulator();
  const button = circuit.components.find(part => part.type === 'button');
  const runtime = await createStm32FirmwareRuntime({flash: firmware('button')}, {
    readInputs: state => ({PB1: solver.solve(circuit, state).readPin('PB1')}),
  });
  t.after(() => runtime.dispose());

  await runtime.advanceTime(1);
  const released = await runtime.advanceTime(1);
  assert.equal(released.error, null);
  assert.equal(released.pins.PB1.mode, 'GPIO_Mode_IPU');
  assert.equal(released.pins.PB1.level, 1);
  assert.equal(released.pins.PA0.level, 0);

  button.pressed = true;
  const pressed = await runtime.advanceTime(1);
  assert.equal(pressed.pins.PB1.level, 0);
  assert.equal(pressed.pins.PA0.level, 1);
  assert(solver.solve(circuit, pressed).parts.led1.brightness > 0);

  button.pressed = false;
  assert.equal((await runtime.advanceTime(1)).pins.PA0.level, 0);
});

test('Blue Pill executes calibrated ADC1 conversion of the PA1 potentiometer and reports it over USART1', async t => {
  const circuit = createCircuit('adc');
  const solver = new CircuitSimulator();
  const pot = circuit.components.find(part => part.id === 'pot1');
  pot.position = .1;
  const io = createAvrCircuitIO(() => circuit, solver);
  const runtime = await createStm32FirmwareRuntime({flash: firmware('adc')}, io);
  t.after(() => runtime.dispose());
  const low = await advanceTo(runtime, 130);
  assert.equal(low.adc.ADC1.calibrated, true);
  assert.equal(low.adc.ADC1.resultPin, 'PA1');
  assert(Math.abs(low.adc.ADC1.result - 410) <= 1);
  assert(low.serial.split(/\r?\n/).includes(String(low.adc.ADC1.result)));
  assert.equal(low.uarts.USART1.baudRate, 9604);
  assert.equal(solver.solve(circuit, low).parts.led1.brightness, 0);

  pot.position = .9;
  io.invalidateAnalog();
  const high = await advanceTo(runtime, 240);
  assert(Math.abs(high.adc.ADC1.result - 3686) <= 1);
  assert(high.serial.split(/\r?\n/).includes(String(high.adc.ADC1.result)));
  assert(solver.solve(circuit, high).parts.led1.brightness > 0);
  assert.equal((await runtime.reset()).adc.ADC1.result, null);
});

test('Blue Pill runs compiled TIM2 CH1 PWM and changes the brightness of the wired PA0 LED', async t => {
  const circuit = createCircuit('pwm');
  const solver = new CircuitSimulator();
  const runtime = await createStm32FirmwareRuntime({flash: firmware('pwm')});
  t.after(() => runtime.dispose());

  const low = await advanceTo(runtime, 50);
  assert.equal(low.pins.PA0.mode, 'GPIO_Mode_AF_PP');
  const {frequencyHz, duty, timer, channel} = low.pins.PA0.pwm;
  assert.deepEqual({frequencyHz, duty, timer, channel}, {frequencyHz:1000,duty:.25,timer:2,channel:1});
  const lowLed = solver.solve(circuit, low).parts.led1;
  assert.equal(lowLed.pwmAverage.duty, .25);
  assert(lowLed.displayBrightness > 0);

  const high = await advanceTo(runtime, 520);
  assert.equal(high.pins.PA0.pwm.duty, .75);
  const highLed = solver.solve(circuit, high).parts.led1;
  assert.equal(highLed.pwmAverage.duty, .75);
  assert(Math.abs(highLed.displayBrightness - 3 * lowLed.displayBrightness) < .0001);
  assert.equal((await advanceTo(runtime, 1020)).pins.PA0.pwm.duty, .25);
  assert.equal((await runtime.reset()).pins.PA0.pwm, undefined);
});

test('manual step cannot overrun its budget on SVC, and a queued Worker command can be disposed', async t => {
  const flash = new Uint8Array(0x48);
  const view = new DataView(flash.buffer);
  view.setUint32(0, 0x20005000, true);
  view.setUint32(4, FLASH + 0x41, true);
  view.setUint32(11 * 4, FLASH + 0x45, true);
  view.setUint16(0x40, 0xdf00, true); // SVC #0
  view.setUint16(0x42, 0xe7fe, true);
  view.setUint16(0x44, 0xbf30, true); // WFI in an ISR
  view.setUint16(0x46, 0xe7fe, true);
  const runtime = await createStm32FirmwareRuntime({flash});
  t.after(() => runtime.dispose());

  const single = await runtime.step();
  assert.equal(single.steps, 0);
  assert.equal(single.status, 'waiting');
  assert.equal(single.pc.byteAddress, FLASH + 0x40);
  assert.equal(single.error, null);
  const reloaded = await runtime.reset();
  assert.equal(reloaded.error, null);
  assert.equal(reloaded.pc.byteAddress, FLASH + 0x40);
  const command = runtime.advanceTime(20);
  await Promise.resolve();
  runtime.dispose();
  assert.equal((await command).status, 'disposed');
  assert.equal(runtime.getState().status, 'disposed');
});

test('NUCLEO-F103RB executes high Flash GPIO writes and routes each USART separately', async t => {
  const codeOffset = 0x18000;
  const words = [], literals = [];
  function ldr(register, value) {
    literals.push({index: words.length, register, value});
    words.push(0);
  }
  function store(base, offset, value) {
    ldr(0, base);
    ldr(1, value);
    words.push(0x6001 | ((offset / 4) << 6)); // str r1,[r0,#offset]
  }
  store(0x40021018, 0, (1 << 14) | (1 << 5) | (1 << 2)); // USART1, GPIOD, GPIOA
  store(0x4002101c, 0, 1 << 17); // USART2
  store(0x40010800, 0, 0x44244444); // GPIOA CRL, PA5 output
  store(0x40010800, 16, 1 << 5); // GPIOA BSRR
  store(0x40011400, 0, 0x44444244); // GPIOD CRL, PD2 output
  store(0x40011400, 16, 1 << 2);
  for (const [base, character] of [[0x40013800, 49], [0x40004400, 50]]) {
    store(base, 8, 833); // BRR, approximately 9600 baud
    store(base, 12, 0x200c); // CR1, UE, TE, RE
    store(base, 4, character); // DR
  }
  words.push(0x6801, 0x0689, 0xd5fc, 0x6841, 0x6041, 0xe7f9); // Poll USART2 RXNE then echo DR
  const literalOffset = (words.length * 2 + 3) & ~3;
  const flash = new Uint8Array(codeOffset + literalOffset + literals.length * 4).fill(0xff);
  const view = new DataView(flash.buffer);
  view.setUint32(0, 0x20005000, true);
  view.setUint32(4, FLASH + codeOffset + 1, true);
  literals.forEach(({index, register, value}, i) => {
    const address = literalOffset + 4 * i;
    const pc = (2 * index + 4) & ~3;
    words[index] = 0x4800 | (register << 8) | ((address - pc) >>> 2);
    view.setUint32(codeOffset + address, value, true);
  });
  words.forEach((word, index) => view.setUint16(codeOffset + 2 * index, word, true));

  const tx = [];
  const runtime = await createStm32FirmwareRuntime({flash}, {
    boardId: 'nucleo-f103rb', onSerial: (text, port) => tx.push([text, port]),
  });
  t.after(() => runtime.dispose());
  const boot = runtime.getState();
  assert.equal(boot.boardId, 'nucleo-f103rb');
  assert.equal(boot.capabilities.flashBytes, 128 * 1024);
  assert.equal(boot.pc.byteAddress, FLASH + codeOffset);
  assert.equal((await runtime.step()).pc.byteAddress, FLASH + codeOffset + 2);
  const configured = await advanceTo(runtime, 1);
  assert.equal(configured.pins.PA5.level, 1);
  assert.equal(configured.pins.PD2.level, 1);
  assert.equal(configured.uarts.USART1.baudRate, 9604);
  assert.equal(configured.uarts.USART2.baudRate, 9604);
  assert.equal(configured.serial, '12');
  assert.deepEqual(tx, [['1', 'USART1'], ['2', 'USART2']]);

  await runtime.injectSerial('A');
  assert.equal((await advanceTo(runtime, 2)).serial, '12A');
  assert.deepEqual(tx.at(-1), ['A', 'USART2']);
  const reset = await runtime.reset();
  assert.equal(reset.pc.byteAddress, FLASH + codeOffset);
  assert.equal(reset.serial, '');
  assert.equal(reset.uarts.USART2.enabled, false);
});
