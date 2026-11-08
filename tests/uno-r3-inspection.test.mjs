import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNO_R3_INSPECTION as uno } from '../dist/uno-r3-inspection.js';
import { BOARD_PROFILES } from '../dist/board-profiles.js';

const byId = new Map(uno.pins.map(pin => [pin.id, pin]));
const chipByNumber = new Map(uno.chip.pins.map(pin => [pin.number, pin]));

test('UNO R3 photo and all 44 socket/contact targets are available locally', () => {
  const jpeg = readFileSync(uno.photo.url);
  assert.deepEqual([...jpeg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.equal(uno.photo.licenseLabel, 'CC BY-SA 4.0');
  assert.equal(uno.pins.length, 44);
  assert.equal(byId.size, 44);
  for (const pin of BOARD_PROFILES[uno.id].pins) assert.equal(byId.get(pin.id)?.canonical, pin.canonical);
  assert.ok(uno.pins.every(pin => pin.x > 0 && pin.x < 1 && pin.y > 0 && pin.y < 1));
  assert.ok(uno.pins.every(pin => Number.isFinite(pin.modelX) && Number.isFinite(pin.modelZ)));
});

test('UNO DIP leads distinguish MCU pin numbers from Arduino labels and shared nets', () => {
  assert.deepEqual(uno.chip.pins.map(pin => pin.number), Array.from({ length: 28 }, (_, index) => index + 1));
  for (const [id, number, signal] of [['D13', 19, 'PB5'], ['A0', 23, 'PC0'], ['SDA', 27, 'PC4'], ['A4', 27, 'PC4'], ['RESET', 1, 'PC6'], ['AREF', 21, 'AREF']]) {
    assert.equal(byId.get(id).chipPin, number);
    assert.equal(chipByNumber.get(number).signal, signal);
  }
  const grounds = uno.pins.filter(pin => pin.canonical === 'GND');
  assert.equal(grounds.length, 5);
  assert.equal(new Set(grounds.map(pin => `${pin.x}/${pin.y}`)).size, 5);
  assert.ok(grounds.every(pin => pin.chipPin === null));
  assert.ok(uno.pins.every(pin => pin.chipPin === null || chipByNumber.has(pin.chipPin)));
});

test('UNO main and USB bridge programming headers have their own physical layouts', () => {
  assert.deepEqual([1,2,3,4,5,6].map(n => byId.get('ICSP_' + n).chipPin), [18, null, 19, 17, 1, null]);
  assert.ok([1,2,3,4,5,6].every(n => byId.get('ICSP_USB_' + n).chipPin === null));
  assert.ok(byId.get('ICSP_5').x < byId.get('ICSP_3').x && byId.get('ICSP_3').x < byId.get('ICSP_1').x);
  assert.ok(byId.get('ICSP_USB_5').y < byId.get('ICSP_USB_3').y && byId.get('ICSP_USB_3').y < byId.get('ICSP_USB_1').y);
  assert.ok(uno.chip.blocks.flatMap(block => block.pins || []).every(number => chipByNumber.has(number)));
});
