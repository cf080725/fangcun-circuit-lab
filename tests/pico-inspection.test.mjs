import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PICO_INSPECTION } from '../dist/pico-inspection.js';
import { BOARD_PROFILES } from '../dist/board-profiles.js';

test('Pico comparison links the photographed castellated holes to the official board numbers and chip pads', () => {
  const { pins, photo, chip } = PICO_INSPECTION;
  assert.ok(existsSync(photo.url));
  assert.ok(photo.width > photo.height && photo.rotation === -90, 'the display orientation is Micro-USB up');
  assert.equal(pins.length, 43);
  assert.equal(new Set(pins.map(pin => pin.id)).size, 43);
  const edge = pins.filter(pin => pin.number);
  assert.deepEqual(edge.map(pin => pin.number), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.deepEqual(new Set(edge.map(pin => pin.id)), new Set(BOARD_PROFILES.pico.pins.map(pin => pin.id)));
  const byId = id => pins.find(pin => pin.id === id);
  for (const [id, number, pad] of [
    ['GP0', 1, 2], ['GP15', 20, 18], ['GP16', 21, 27], ['GP26', 31, 38],
    ['RUN', 30, 26], ['GP28', 34, 40], ['VBUS', 40, null], ['ADC_VREF', 35, 43]
  ]) {
    const pin = byId(id);
    assert.equal(pin.number, number, id);
    assert.equal(pin.chipPin, pad, id);
  }
  const ground = chip.pins.find(pin => pin.signal === 'GND');
  assert.equal(ground.number, 57);
  assert.equal(byId('GND1').chipPin, ground.number);
  assert.equal(byId('AGND').chipPin, ground.number);
  assert.equal(byId('SWD_GND').chipPin, ground.number);
  assert.equal(byId('SWD_CLK').chipPin, 24);
  assert.equal(byId('SWD_IO').chipPin, 25);
  assert.ok(byId('SWD_CLK').x < byId('SWD_GND').x && byId('SWD_GND').x < byId('SWD_IO').x);
  for (const pin of pins) assert.ok(pin.x > 0 && pin.x < 1 && pin.y > 0 && pin.y < 1, pin.id);
  for (const row of [edge.slice(0, 20), edge.slice(20).reverse()]) {
    assert.ok(row.every((pin, index) => index === 0 || pin.y > row[index - 1].y));
  }
});
