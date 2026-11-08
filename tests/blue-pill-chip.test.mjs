import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIP_FUNCTIONS, CHIP_PINS, chipPinForSignal, chipPinLayout } from '../dist/blue-pill-chip-data.js';

test('LQFP48 lead map has the official numbered corners and ADC, SWD and power pins', () => {
  assert.equal(CHIP_PINS.length, 48);
  assert.equal(new Set(CHIP_PINS.map(pin => pin.signal)).size, 48);
  assert.deepEqual(CHIP_PINS.map(pin => pin.number), Array.from({ length: 48 }, (_, index) => index + 1));
  const expected = { VBAT: 1, NRST: 7, VSSA: 8, VDDA: 9, PA0: 10, PA2: 12, PA3: 13, VDD_1: 24,
    PB12: 25, PA13: 34, VDD_2: 36, PA14: 37, BOOT0: 44, PB9: 46, VDD_3: 48 };
  for (const [signal, number] of Object.entries(expected)) assert.equal(chipPinForSignal(signal), number);
  assert.equal(chipPinForSignal(' mcu:pa0 '), 10);
  assert.equal(chipPinForSignal('SWDIO'), 34);
  assert.equal(chipPinForSignal('SWCLK'), 37);
  assert.equal(chipPinForSignal('OSC_IN'), 5);
  for (const rail of ['3V3', 'GND', 'GND1', '5V', '3V3b']) assert.equal(chipPinForSignal(rail), null);
});

test('package positions follow the 1-dot corner and advance counterclockwise from the top view', () => {
  const positions = CHIP_PINS.map(({ number }) => chipPinLayout(number));
  assert.deepEqual(positions.filter((_, index) => index % 12 === 0).map(position => position.side), ['left', 'bottom', 'right', 'top']);
  assert.deepEqual([positions[0].labelX, positions[0].labelZ], [-4.98, -2.75]);
  assert.deepEqual([positions[11].labelX, positions[11].labelZ], [-4.98, 2.75]);
  assert.deepEqual([positions[12].labelX, positions[12].labelZ], [-2.75, 4.98]);
  assert.deepEqual([positions[47].labelX, positions[47].labelZ], [-2.75, -4.98]);
  assert.equal(chipPinLayout(49), null);
  assert.equal(new Set(positions.map(({ labelX, labelZ }) => `${labelX},${labelZ}`)).size, 48);
});

test('internal functional examples point to valid corresponding package leads', () => {
  for (const block of CHIP_FUNCTIONS) {
    assert.ok(block.title && block.detail);
    assert.ok((block.pins ?? []).every(number => CHIP_PINS[number - 1]?.number === number));
  }
  assert.equal(CHIP_PINS[CHIP_FUNCTIONS.find(block => block.id === 'adc').pins[0] - 1].signal, 'PA0');
  assert.equal(CHIP_PINS[CHIP_FUNCTIONS.find(block => block.id === 'comm').pins.at(-1) - 1].signal, 'PA12');
});
