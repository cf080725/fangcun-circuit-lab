import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { BLUE_PILL_PHOTO_PINS } from '../dist/blue-pill-photo.js';
import { BLUE_PILL_SWD } from '../dist/blue-pill-pins.js';

test('authentic comparison photo is byte-for-byte the original licensed JPEG', () => {
  const asset = readFileSync(new URL('../dist/assets/blue-pill-avandalen.jpg', import.meta.url));
  assert.equal(createHash('sha1').update(asset).digest('hex'), '4104febc42734a9ccb5349fb315c84c65b7f922c');
});

test('all photo targets represent separate, correctly oriented physical pins', () => {
  const pins = BLUE_PILL_PHOTO_PINS;
  assert.deepEqual(pins.map(pin => pin.id), [...BOARD_PROFILES.bluepill.pins, ...BLUE_PILL_SWD].map(pin => pin.id));
  assert.equal(new Set(pins.map(pin => pin.id)).size, 44);
  const find = id => pins.find(pin => pin.id === id);
  assert.ok(find('PB12').x < .25 && find('PB12').y < .10);
  assert.ok(find('GND2').x > .75 && find('GND2').y < .10);
  assert.ok(find('PA0').x > .75 && find('PA0').y > .65);
  assert.ok(find('GND1').x < .25 && find('GND1').y > .80);
  for (const side of ['left', 'right', 'swd']) {
    const row = pins.filter(pin => pin.side === side);
    const axis = side === 'swd' ? 'x' : 'y';
    assert.ok(row.every((pin, index) => index === 0 || pin[axis] > row[index - 1][axis]));
  }
});
