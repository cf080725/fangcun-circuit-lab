import assert from 'node:assert/strict';
import test from 'node:test';
import {createStm32Adc} from '../dist/stm32-adc.js';

const SR = 0x00, CR1 = 0x04, CR2 = 0x08, SMPR2 = 0x10, SQR1 = 0x2c, SQR3 = 0x34, DR = 0x4c;
const ADON = 1, EOC = 2, CAL = 4, RSTCAL = 8, STRT = 16, ALIGN = 1 << 11;
const EXTERNAL_TRIGGER = 1 << 20, SOFTWARE_TRIGGER = (7 << 17) | EXTERNAL_TRIGGER, SWSTART = 1 << 22;

function fixture(options = {}) {
  const inputs = {clocked: true, coreHz: 8_000_000, adcHz: 4_000_000, volts: 1.65, ...options};
  const samples = [];
  const adc = createStm32Adc({
    isClocked: () => inputs.clocked,
    clockHz: () => inputs,
    readVoltage: pin => { samples.push(pin); return inputs.volts; },
  });
  return {adc, inputs, samples, write: (offset, value) => adc.write(offset, 4, value)};
}

test('ADC1 respects clock gating, powers on and clears calibration flags in ADC clock time', () => {
  const {adc, inputs, write} = fixture({clocked: false});
  write(CR2, ADON);
  assert.equal(adc.getState().enabled, false);
  assert.equal(adc.read(CR2), 0);

  inputs.clocked = true;
  assert.equal(adc.read(CR2), 0);
  assert.equal(adc.read(0x24), 4095);
  write(CR2, ADON);
  assert.equal(adc.getState().enabled, true);
  assert.equal(adc.getState().busy, false);

  write(CR2, ADON | RSTCAL);
  assert.equal(adc.read(CR2), ADON | RSTCAL);
  adc.advance(3);
  assert.equal(adc.getState().calibrating, true);
  adc.advance(1);
  assert.equal(adc.read(CR2), ADON);

  write(CR2, ADON | CAL);
  adc.advance(165);
  assert.equal(adc.read(CR2), ADON | CAL);
  adc.advance(1);
  assert.equal(adc.read(CR2), ADON);
  assert.equal(adc.getState().calibrated, true);
  assert.equal(adc.getState().result, null);
});

test('ADC1 SWSTART samples PB1 at the programmed aperture and sets EOC at completion', () => {
  const {adc, inputs, samples, write} = fixture();
  write(CR2, ADON);
  write(SMPR2, 3 << 27); // Channel 9, 28.5 ADC clocks of sampling
  write(SQR3, 9);
  write(CR2, ADON | SOFTWARE_TRIGGER | SWSTART);
  assert.equal(adc.read(CR2), ADON | SOFTWARE_TRIGGER);
  assert.equal(adc.read(SR), STRT);
  assert.equal(adc.getState().pin, 'PB1');
  assert.equal(adc.getState().busy, true);

  adc.advance(56);
  assert.deepEqual(samples, []);
  adc.advance(1);
  assert.deepEqual(samples, ['PB1']);
  inputs.volts = 3.3;
  adc.advance(24);
  assert.equal(adc.getState().result, null);
  adc.advance(1);
  assert.equal(adc.read(SR), EOC | STRT);
  assert.equal(adc.getState().voltage, 1.65);
  assert.equal(adc.getState().result, 2048);
  assert.equal(adc.getState().resultPin, 'PB1');
  assert.equal(adc.read(DR, 2), 2048);
  assert.equal(adc.read(SR), STRT);
  assert.equal(adc.getState().result, 2048);
});

test('ADC1 repeat ADON starts one conversion, supports alignment and clears flags on writes of zero', () => {
  const {adc, samples, write} = fixture({volts: 3.5});
  write(SQR3, 7);
  write(CR2, ADON | ALIGN);
  adc.advance(100);
  assert.deepEqual(samples, []);

  adc.write(CR2 + 1, 1, ALIGN >>> 8);
  assert.equal(adc.getState().busy, false);
  write(CR2, ADON | ALIGN);
  adc.advance(28);
  assert.deepEqual(samples, ['PA7']);
  assert.equal(adc.getState().result, 4095);
  write(SR, 0xffffffff);
  assert.equal(adc.read(SR), EOC | STRT);
  adc.write(SR, 1, STRT);
  assert.equal(adc.read(SR), STRT);
  assert.equal(adc.read(DR + 1, 1), 0xff);
  assert.equal(adc.read(DR), 0xfff0);
});

test('ADC1 clock gating pauses a conversion and clearing ADON cancels it', () => {
  const {adc, inputs, samples, write} = fixture({volts: -0.1});
  write(SQR3, 8);
  write(CR2, ADON);
  write(CR2, ADON);
  inputs.clocked = false;
  adc.advance(2000);
  assert.equal(adc.getState().busy, true);
  assert.deepEqual(samples, []);
  inputs.clocked = true;
  adc.advance(28);
  assert.equal(adc.getState().result, 0);
  assert.equal(adc.getState().resultPin, 'PB0');

  write(CR2, ADON);
  assert.equal(adc.getState().busy, true);
  write(CR2, 0);
  adc.advance(1000);
  assert.equal(adc.getState().busy, false);
  assert.deepEqual(samples, ['PB0']);
  adc.reset();
  assert.equal(adc.getState().enabled, false);
  assert.equal(adc.getState().result, null);
});

test('ADC1 diagnoses unsupported scan, DMA, channel, trigger and clock configurations', () => {
  for (const [register, value, extra, code] of [
    [SQR1, 1 << 20, 0, 'STM32_ADC_MODE'],
    [CR1, 1 << 5, 0, 'STM32_ADC_MODE'],
    [CR1, 0, 1 << 8, 'STM32_ADC_MODE'],
    [SQR3, 16, 0, 'STM32_ADC_CHANNEL'],
  ]) {
    const {adc, write} = fixture();
    write(register, value);
    write(CR2, ADON);
    write(CR2, ADON | SOFTWARE_TRIGGER | SWSTART | extra);
    assert.equal(adc.getState().error?.code, code);
    assert.equal(adc.getState().result, null);
  }
  const trigger = fixture();
  trigger.write(CR2, ADON | EXTERNAL_TRIGGER);
  trigger.adc.advance(28);
  assert.equal(trigger.adc.getState().error?.code, 'STM32_ADC_TRIGGER');

  const clock = fixture({coreHz: 72_000_000, adcHz: 36_000_000});
  clock.write(CR2, ADON);
  clock.write(CR2, ADON | SOFTWARE_TRIGGER | SWSTART);
  assert.equal(clock.adc.getState().error?.code, 'STM32_ADC_CLOCK');
});

test('Nucleo ADC1 channel 15 samples PC5 with its own SMPR1 timing', () => {
  const pins = [];
  const adc = createStm32Adc({
    isClocked: () => true, clockHz: () => ({coreHz: 8_000_000, adcHz: 4_000_000}),
    inputPins: ['PC5'], readVoltage: pin => { pins.push(pin); return 1.65; },
  });
  adc.write(0x0c, 4, 3 << 15); // Channel 15, SMPR1 sample time 28.5 cycles.
  adc.write(SQR3, 4, 15);
  adc.write(CR2, 4, ADON);
  adc.write(CR2, 4, ADON | SOFTWARE_TRIGGER | SWSTART);
  adc.advance(56);
  assert.deepEqual(pins, []);
  adc.advance(25);
  assert.deepEqual(pins, ['PC5']);
  assert.equal(adc.getState().result, null);
  adc.advance(1);
  assert.equal(adc.getState().result, 2048);
  assert.equal(adc.getState().resultPin, 'PC5');
});
