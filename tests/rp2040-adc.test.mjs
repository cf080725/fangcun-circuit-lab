import assert from 'node:assert/strict';
import test from 'node:test';
import {installRp2040Adc, rp2040AdcClockHz} from '../dist/rp2040-adc.js';
import {RP2040, SimulationClock} from '../dist/vendor/rp2040js/core.js';

const ADC = 0x4004c000;
const CS = 0, RESULT = 4, FCS = 8, FIFO = 12, DIV = 16, INTE = 24;
const EN = 1, START_ONCE = 4, START_MANY = 8;
const READY = 1 << 8, ERR = 1 << 9, ERR_STICKY = 1 << 10;
const FIFO_UNDER = 1 << 10, FIFO_OVER = 1 << 11, ADC_IRQ = 1 << 22;
const SET_ALIAS = 0x2000;

function setup({volts = {GP26: 0.33, GP27: 1.65, GP28: 2.97}, frequency, reference = 3.3} = {}) {
  const clock = new SimulationClock();
  const rp = new RP2040(clock);
  const bridge = installRp2040Adc({
    adc: rp.adc, clock, readVoltage: pin => volts[pin], readReference: () => reference,
    clockHz: frequency ?? (() => rp2040AdcClockHz(rp)),
  });
  const write = (offset, value) => rp.writeUint32(ADC + offset, value);
  const read = offset => rp.readUint32(ADC + offset);
  return {rp, clock, bridge, write, read};
}

test('Pico ADC honors the selected clock, latches one sample and reports READY after 96 cycles', () => {
  const volts = {GP26: 1.65};
  const {rp, clock, bridge, write, read} = setup({volts});
  rp.writeUint32(0x40008060, (1 << 11) | (3 << 5)); // Enable clk_adc from 12 MHz XOSC
  rp.writeUint32(0x40008064, 1 << 8);
  assert.equal(rp2040AdcClockHz(rp), 12_000_000);
  assert.equal(read(CS) & READY, 0);
  write(CS, EN);
  assert.equal(read(CS) & READY, READY);
  write(SET_ALIAS + CS, START_ONCE);
  assert.equal(read(CS) & (START_ONCE | READY), 0);
  assert.equal(bridge.getState().busy, true);
  assert.equal(bridge.getState().result, null);
  volts.GP26 = 3.3;
  clock.tick(7999);
  assert.equal(read(CS) & READY, 0);
  clock.tick(1);
  assert.equal(read(CS) & READY, READY);
  assert.equal(read(RESULT), 2048);
  assert.equal(bridge.getState().resultPin, 'GP26');
  assert.equal(bridge.getState().voltage, 1.65);
  assert.equal(bridge.getState().referenceVoltage, 3.3);
});

test('Pico ADC free-run pacing and round-robin feed shifted FIFO entries and IRQ thresholds', () => {
  const {rp, clock, bridge, write, read} = setup({frequency: () => 48_000_000});
  write(FCS, (2 << 24) | 3); // FIFO enable, shift to 8-bit, IRQ threshold 2
  write(INTE, 1);
  write(DIV, 191 << 8); // 192 ADC cycles between starts, or 4 us
  const control = EN | START_MANY | (7 << 16);
  write(CS, control);
  clock.tick(2000);
  assert.equal(bridge.getState().resultPin, 'GP26');
  assert.equal(bridge.getState().fifoLevel, 1);
  assert.equal(rp.core.pendingInterrupts & ADC_IRQ, 0);

  write(CS, read(CS)); // Rewriting CS in the gap must preserve the existing pace.
  clock.tick(3999);
  assert.equal(bridge.getState().fifoLevel, 1);
  clock.tick(1);
  assert.equal(bridge.getState().resultPin, 'GP27');
  assert.equal(rp.core.pendingInterrupts & ADC_IRQ, ADC_IRQ);
  clock.tick(4000);
  assert.equal(bridge.getState().resultPin, 'GP28');
  assert.equal((read(CS) >>> 12) & 7, 0);
  write(CS, EN);
  assert.equal(read(FIFO), 410 >> 4);
  assert.equal(read(FIFO), 2048 >> 4);
  assert.equal(rp.core.pendingInterrupts & ADC_IRQ, 0);
  assert.equal(read(FIFO), 3686 >> 4);
  assert.equal(read(FIFO), 0);
  assert.equal(read(FCS) & FIFO_UNDER, FIFO_UNDER);
});

test('Pico ADC keeps eight FIFO results and clears overflow and ADC errors only when written', () => {
  const {clock, bridge, write, read} = setup({frequency: () => 48_000_000});
  write(FCS, 5); // FIFO enable and error tag
  for (let i = 0; i < 9; i++) {
    write(CS, EN | START_ONCE);
    clock.tick(2000);
  }
  assert.equal(bridge.getState().fifoLevel, 8);
  assert.equal(read(FCS) & FIFO_OVER, FIFO_OVER);
  write(SET_ALIAS + FCS, 1 << 24);
  assert.equal(read(FCS) & FIFO_OVER, FIFO_OVER);
  write(SET_ALIAS + FCS, FIFO_OVER);
  assert.equal(read(FCS) & FIFO_OVER, 0);
  for (let i = 0; i < 8; i++) assert.equal(read(FIFO), 410);

  write(CS, EN | START_ONCE | (4 << 12));
  clock.tick(2000);
  assert.equal(read(CS) & (ERR | ERR_STICKY), ERR | ERR_STICKY);
  assert.equal(read(FIFO), 1 << 15);
  assert.equal(bridge.getState().error?.code, 'RP2040_ADC_CHANNEL');
  assert.equal(bridge.getState().result, null);
  write(CS, EN);
  write(SET_ALIAS + CS, START_ONCE);
  clock.tick(2000);
  assert.equal(read(CS) & (ERR | ERR_STICKY), ERR_STICKY);
  assert.equal(bridge.getState().result, 410);
  write(SET_ALIAS + CS, ERR_STICKY);
  assert.equal(read(CS) & ERR_STICKY, 0);
});

test('Pico ADC flags missing circuit voltage or clock and cancels a powered-off sample', () => {
  const missingClock = setup();
  missingClock.write(CS, EN | START_ONCE);
  missingClock.clock.tick(2000);
  assert.equal(missingClock.bridge.getState().error?.code, 'RP2040_ADC_CLOCK');
  assert.equal(missingClock.bridge.getState().result, null);

  const missingVoltage = setup({frequency: () => 48_000_000, volts: {}});
  missingVoltage.write(CS, EN | START_ONCE);
  missingVoltage.clock.tick(2000);
  assert.equal(missingVoltage.bridge.getState().error?.code, 'RP2040_ADC_VOLTAGE');

  const canceled = setup({frequency: () => 48_000_000});
  canceled.write(CS, EN | START_ONCE);
  canceled.write(CS, 0);
  canceled.clock.tick(10_000);
  assert.equal(canceled.bridge.getState().busy, false);
  assert.equal(canceled.bridge.getState().result, null);
});
