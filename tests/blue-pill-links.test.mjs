import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLUE_PILL_HEADERS, BLUE_PILL_HEADER_PINS, chipSignalForHeader, headerForChipSignal, headerLabel } from '../dist/blue-pill-links.js';
import { chipPinForSignal } from '../dist/blue-pill-chip-data.js';

test('physical headers have independent pad identities, including parallel power rails', () => {
  assert.deepEqual(BLUE_PILL_HEADERS.map(group => group.pins.length), [20, 20, 4]);
  assert.equal(new Set(BLUE_PILL_HEADER_PINS.map(pin => pin.id)).size, 44);
  const groundPads = BLUE_PILL_HEADER_PINS.filter(pin => pin.canonical === 'GND');
  assert.equal(new Set(groundPads.map(headerLabel)).size, 4);
  const rails = BLUE_PILL_HEADER_PINS.filter(pin => ['GND','3V3','5V'].includes(pin.canonical));
  assert.ok(rails.every(pin => chipSignalForHeader(pin) === null));
});

test('every direct board signal has a matching LQFP48 lead and resolves back to its physical pad', () => {
  const direct = BLUE_PILL_HEADER_PINS.filter(chipSignalForHeader);
  assert.equal(direct.length, 36);
  for (const pad of direct) {
    const signal = chipSignalForHeader(pad);
    assert.ok(chipPinForSignal(signal), signal);
    assert.equal(headerForChipSignal(signal), pad);
  }
  assert.equal(chipPinForSignal(chipSignalForHeader(headerForChipSignal('PA0'))), 10);
  assert.equal(headerForChipSignal('PA13').id, 'SWD_IO');
  assert.equal(headerForChipSignal('PA14').id, 'SWD_CLK');
  assert.equal(headerForChipSignal('VDD_1'), null);
});
