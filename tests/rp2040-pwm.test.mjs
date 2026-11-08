import test from 'node:test';
import assert from 'node:assert/strict';
import {RP2040, SimulationClock, FUNCTION_SIO} from '../dist/vendor/rp2040js/core.js';
import {readRp2040Pwm, RP2040_FUNCTION_PWM} from '../dist/rp2040-pwm.js';

const GPIO_CTRL = index => 0x40014004 + index * 8;
const GPIO_PAD = index => 0x4001c004 + index * 4;
const PWM = slice => 0x40050000 + slice * 20;
const RESET = 0x4000c000;

function setup({slice = 7, indices = [15], divider = 125 << 4, top = 999, a = 400, b = 250, control = 1} = {}) {
  const clock = new SimulationClock();
  const rp = new RP2040(clock);
  const base = PWM(slice);
  for (const index of indices) rp.writeUint32(GPIO_CTRL(index), RP2040_FUNCTION_PWM);
  rp.writeUint32(base + 4, divider);
  rp.writeUint32(base + 12, ((b << 16) | a) >>> 0);
  rp.writeUint32(base + 16, top);
  rp.writeUint32(base, control);
  return {clock, rp, base};
}

test('GP15 reads slice 7B nominal frequency, physical duty, and live pad level', () => {
  const {clock, rp} = setup();
  clock.tick(1_001_000);
  assert.deepEqual(readRp2040Pwm(rp, 15), {slice: 7, channel: 'B', frequencyHz: 1000, duty: 0.25, activeLow: false, level: 1});
  clock.tick(250_000);
  assert.equal(readRp2040Pwm(rp, 15).level, 0);
  assert.equal(readRp2040Pwm(rp, 14), undefined);
  rp.writeUint32(GPIO_CTRL(15), FUNCTION_SIO);
  assert.equal(readRp2040Pwm(rp, 15), undefined);
});

test('PWM metadata uses active compare and top while firmware writes are buffered', () => {
  const {clock, rp, base} = setup();
  clock.tick(1_001_000);
  rp.writeUint32(base + 12, 750 << 16);
  rp.writeUint32(base + 16, 1249);
  assert.equal(rp.readUint32(base + 12) >>> 16, 750);
  assert.equal(rp.readUint32(base + 16), 1249);
  assert.equal(readRp2040Pwm(rp, 15).duty, 0.25);
  assert.equal(readRp2040Pwm(rp, 15).frequencyHz, 1000);
  clock.tick(1_000_000);
  assert.equal(readRp2040Pwm(rp, 15).duty, 0.6);
  assert.equal(readRp2040Pwm(rp, 15).frequencyHz, 800);
});

test('A/B channels and pin aliases use the active divider, polarity and GPIO override', () => {
  const {clock, rp} = setup({slice: 1, indices: [2, 3, 18], divider: (2 << 4) | 8, top: 999, a: 250, b: 0, control: 0x0d});
  clock.tick(25_500);
  assert.deepEqual(readRp2040Pwm(rp, 2), {slice: 1, channel: 'A', frequencyHz: 50_000, duty: 0.75, activeLow: true, level: 1});
  assert.deepEqual(readRp2040Pwm(rp, 3), {slice: 1, channel: 'B', frequencyHz: 50_000, duty: 1, activeLow: true, level: 1});
  assert.deepEqual(readRp2040Pwm(rp, 18), readRp2040Pwm(rp, 2));
  rp.writeUint32(GPIO_CTRL(18), RP2040_FUNCTION_PWM | (1 << 8));
  assert.deepEqual(readRp2040Pwm(rp, 18), {slice: 1, channel: 'A', frequencyHz: 50_000, duty: 0.25, activeLow: false, level: 0});
});

test('frequency follows active clk_sys and permits nominal 0%/100% endpoints', () => {
  const {clock, rp} = setup({indices: [14, 15], divider: 1 << 4, a: 0, b: 1000});
  rp.writeUint32(0x40008030, 2); // clk_ref = XOSC, clk_sys uses clk_ref.
  assert.equal(rp.clkSys, 12_000_000);
  clock.tick(100_000);
  assert.equal(readRp2040Pwm(rp, 14).frequencyHz, 12_000);
  assert.equal(readRp2040Pwm(rp, 14).duty, 0);
  assert.equal(readRp2040Pwm(rp, 14).level, 0);
  assert.equal(readRp2040Pwm(rp, 15).duty, 1);
  assert.equal(readRp2040Pwm(rp, 15).level, 1);
  rp.writeUint32(PWM(7) + 4, 0); // Pinned core treats a zero divider integer as 256.
  assert.equal(readRp2040Pwm(rp, 15).frequencyHz, 46.875);
});

test('no PWM metadata for stopped/reset, phase-correct, gated, forced or disabled outputs', () => {
  const {rp, base} = setup({indices: [14, 15]});
  for (const mode of [0, 3, 0x11, 0x21, 0x31]) {
    rp.writeUint32(base, mode);
    assert.equal(readRp2040Pwm(rp, 14), undefined);
    assert.equal(readRp2040Pwm(rp, 15), undefined);
  }
  rp.writeUint32(base, 1);
  rp.writeUint32(RESET, 1 << 14);
  assert.equal(readRp2040Pwm(rp, 15), undefined);
  rp.writeUint32(RESET, 0);
  rp.writeUint32(GPIO_CTRL(15), RP2040_FUNCTION_PWM | (3 << 8)); // Forced high.
  assert.equal(readRp2040Pwm(rp, 15), undefined);
  rp.writeUint32(GPIO_CTRL(15), RP2040_FUNCTION_PWM | (2 << 12)); // OE forced low.
  assert.equal(readRp2040Pwm(rp, 15), undefined);
  rp.writeUint32(GPIO_CTRL(15), RP2040_FUNCTION_PWM);
  rp.writeUint32(GPIO_PAD(15), 1 << 7); // Pad output disable.
  assert.equal(readRp2040Pwm(rp, 15), undefined);
});
