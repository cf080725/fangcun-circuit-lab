import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readStm32Pwm, stm32Apb1TimerClock} from '../dist/stm32-pwm.js';
import initializeWasm, * as core from '../dist/vendor/stm32f1-emu/stm32_bluepill_wasm.js';

const TIM2 = 0x40000000;
const TIM3 = 0x40000400;
const TIM4 = 0x40000800;
const RCC = 0x40021000;
const AFIO = 0x40010000;

function preset(base, channels = {}) {
  return {
    [base]: 1,
    [base + 0x18]: 0x6868,
    [base + 0x1c]: 0x6868,
    [base + 0x20]: 0x1111,
    [base + 0x24]: 249,
    [base + 0x28]: 7,
    [base + 0x2c]: 999,
    [base + 0x34]: 250,
    [base + 0x38]: 250,
    [base + 0x3c]: 250,
    [base + 0x40]: 250,
    ...channels,
  };
}

function readRegisters(registers, {mapr = 0, clocked = [2, 3, 4], clockHz = 8_000_000} = {}) {
  return readStm32Pwm({
    read: address => registers[address] ?? 0,
    timerClockHz: clockHz,
    afioMapr: mapr,
    isClocked: timer => clocked.includes(timer),
  });
}

test('TIM2 reads live CNT, PSC, ARR and CCMR/CCER for edge-aligned PWM', () => {
  const regs = preset(TIM2, {
    [TIM2 + 0x18]: 0x7868, // CH1 PWM1, CH2 PWM2
    [TIM2 + 0x1c]: 0x6868,
    [TIM2 + 0x20]: 0x1331, // CH1 active high, CH2/3 active low, CH4 active high
    [TIM2 + 0x3c]: 750,
    [TIM2 + 0x40]: 1000,
  });
  assert.deepEqual(readRegisters(regs), {
    PA0: {timer: 2, channel: 1, frequencyHz: 1000, activeLow: false, highFirst: true, phaseMs: .249, duty: 0.25, level: 1},
    PA1: {timer: 2, channel: 2, frequencyHz: 1000, activeLow: true, highFirst: true, phaseMs: .249, duty: 0.25, level: 1},
    PA2: {timer: 2, channel: 3, frequencyHz: 1000, activeLow: true, highFirst: false, phaseMs: .249, duty: 0.25, level: 0},
    PA3: {timer: 2, channel: 4, frequencyHz: 1000, activeLow: false, highFirst: true, phaseMs: .249, duty: 1, level: 1},
  });
  regs[TIM2 + 0x24] = 250;
  const atCompare = readRegisters(regs);
  assert.equal(atCompare.PA0.level, 0);
  assert.equal(atCompare.PA1.level, 0);
  regs[TIM2 + 0x34] = 0;
  assert.equal(readRegisters(regs).PA0.duty, 0);
});

test('TIM2–4 use RM0008 pin routes and omit pins absent from Blue Pill or still reserved for debug', () => {
  const regs = {...preset(TIM2), ...preset(TIM3), ...preset(TIM4)};
  const defaultPins = ['PA0', 'PA1', 'PA2', 'PA3', 'PA6', 'PA7', 'PB0', 'PB1', 'PB6', 'PB7', 'PB8', 'PB9'];
  assert.deepEqual(Object.keys(readRegisters(regs)), defaultPins);
  const tim2Routes = [
    ['PA0', 'PA1', 'PA2', 'PA3'],
    ['PA15', 'PB3', 'PA2', 'PA3'],
    ['PA0', 'PA1', 'PB10', 'PB11'],
    ['PA15', 'PB3', 'PB10', 'PB11'],
  ];
  for (const [remap, pins] of tim2Routes.entries()) {
    const outputs = readRegisters(regs, {mapr: (2 << 24) | (remap << 8), clocked: [2]});
    assert.deepEqual(Object.keys(outputs), pins);
    assert.deepEqual(Object.values(outputs).map(output => output.channel), [1, 2, 3, 4]);
  }
  assert.deepEqual(Object.keys(readRegisters(regs, {mapr: 1 << 8, clocked: [2]})), ['PA2', 'PA3']);
  assert.deepEqual(Object.keys(readRegisters(regs, {mapr: 2 << 10, clocked: [3]})), ['PB5', 'PB0', 'PB1']);
  assert.deepEqual(Object.keys(readRegisters(regs, {mapr: (1 << 24) | (2 << 10), clocked: [3]})), ['PB4', 'PB5', 'PB0', 'PB1']);
  assert.deepEqual(readRegisters(regs, {mapr: (3 << 10) | (1 << 12), clocked: [3, 4]}), {});
  assert.deepEqual(readRegisters(regs, {mapr: 1 << 10, clocked: [3]}), {});
});

test('unsupported counting/output modes and unavailable clocks do not create a PWM source', () => {
  const cases = [
    [TIM2, 0], [TIM2, 0x09], [TIM2, 0x11], [TIM2, 0x21],
    [TIM2 + 0x08, 7], [TIM2 + 0x08, 1 << 14],
    [TIM2 + 0x18, 0x69], [TIM2 + 0x18, 0x38], [TIM2 + 0x20, 0],
    [TIM2 + 0x2c, 0], [TIM2 + 0x2c, 65536],
  ];
  for (const [address, value] of cases) {
    assert.deepEqual(readRegisters(preset(TIM2, {[TIM2 + 0x20]: 1, [address]: value})), {});
  }
  assert.deepEqual(readRegisters(preset(TIM2), {clocked: [3, 4]}), {});
  assert.deepEqual(readRegisters(preset(TIM2), {clockHz: 0}), {});
});

test('APB1 timer frequency doubles only when PPRE1 divides the bus clock', () => {
  for (let ppre = 0; ppre < 8; ppre++) {
    assert.equal(stm32Apb1TimerClock(4_000_000, (ppre << 8) | (7 << 11)), ppre < 4 ? 4_000_000 : 8_000_000);
  }
});

test('pinned Wasm exposes TIM2 compare values and its running counter to the decoder', async () => {
  const binary = await readFile(new URL('../dist/vendor/stm32f1-emu/stm32_bluepill_wasm_bg.wasm', import.meta.url));
  await initializeWasm({module_or_path: binary});
  core.init();
  const read = address => core.periph_read(address, 4);
  const write = (address, value) => core.periph_write(address, 4, value);
  write(RCC + 0x04, 4 << 8); // APB1 /2, so the timer still receives 8 MHz.
  write(RCC + 0x18, 1); // AFIO clock
  write(RCC + 0x1c, 1); // TIM2 clock
  for (const [address, value] of Object.entries(preset(TIM2, {[TIM2]: 0, [TIM2 + 0x20]: 1, [TIM2 + 0x24]: 0}))) {
    write(Number(address), value);
  }
  write(TIM2 + 0x14, 1); // UG
  write(TIM2, 1);
  const output = () => readStm32Pwm({
    read,
    timerClockHz: stm32Apb1TimerClock(core.rcc_clocks_hz()[2], read(RCC + 0x04)),
    afioMapr: read(AFIO + 0x04),
    isClocked: timer => Boolean(read(RCC + 0x1c) & (1 << (timer - 2))),
  });
  assert.deepEqual(output().PA0, {timer: 2, channel: 1, frequencyHz: 1000, activeLow: false, highFirst: true, phaseMs: 0, duty: 0.25, level: 1});
  core.process_batch(2000);
  assert.equal(read(TIM2 + 0x24), 250);
  assert.equal(output().PA0.phaseMs,.25);
  assert.equal(output().PA0.level, 0);
  write(TIM2 + 0x34, 750);
  assert.equal(output().PA0.duty, 0.75);
  assert.equal(output().PA0.level, 1);
  write(AFIO + 0x04, (2 << 24) | (1 << 8));
  assert.equal(output().PA15.channel, 1);
  assert.equal(output().PA0, undefined);
});
