import test from 'node:test';
import assert from 'node:assert/strict';
import { boardPinNumber, canonicalPin, getBoardProfile } from '../dist/board-profiles.js';
import { getMountOptions } from '../dist/breadboard-mount.js';

test('PCA10056 and PCA10095 keep their documented shield mappings', () => {
  const variants = [
    ['nrf52840-dk', 'PCA10056', ['P1.01', 'P1.02', 'P1.03', 'P1.04', 'P1.15', 'P0.03']],
    ['nrf5340-dk', 'PCA10095', ['P1.00', 'P1.01', 'P1.04', 'P1.05', 'P1.15', 'P0.04']]
  ];
  const labels = ['D0', 'D1', 'D2', 'D3', 'D13', 'A0'];
  for (const [id, marking, expected] of variants) {
    const profile = getBoardProfile(id);
    assert.equal(profile.boardMarking, marking);
    assert.deepEqual(labels.map(pin => canonicalPin(pin, id)), expected);
    assert.deepEqual(expected.map(pin => boardPinNumber(pin, id)), [0, 1, 2, 3, 13, 16]);
    assert.equal(new Set(profile.pins.map(pin => pin.id)).size, profile.pins.length);
    assert.equal(profile.pins.find(pin => pin.id === '5V').kind, 'power');
    assert.equal(profile.logicRail, 'VDD');
    assert.equal(profile.logicVoltage, 3);
    assert.equal(profile.logicHighThreshold, 2.1);
    assert.equal(getMountOptions(profile), null);
  }
});

test('PCA10156 uses distinct physical port headers and configured VDDIO', () => {
  const id = 'nrf54l15-dk';
  const profile = getBoardProfile(id);
  assert.equal(profile.boardMarking, 'PCA10156');
  assert.deepEqual(profile.analogPins, ['P1.11', 'P1.12']);
  assert.deepEqual(profile.pwmPins, ['P1.11', 'P1.12']);
  const expected = [['P1.11', 'p1-top', 43], ['P1.12', 'p1-bottom', 44], ['P2.08', 'p2-bottom', 72]];
  for (const [pin, side, number] of expected) {
    const contact = profile.pins.find(contact => contact.id === pin);
    assert.equal(contact.side, side);
    assert.equal(contact.contact, 'male');
    assert.equal(boardPinNumber(pin, id), number);
    assert.equal(canonicalPin(number, id), pin);
  }
  assert.equal(profile.pins.some(pin => pin.id === 'P2.05' || pin.id === 'D13'), false);
  assert.equal(profile.logicRail, 'VDDIO');
  assert.equal(profile.logicVoltage, 3.3);
  assert.equal(profile.logicHighThreshold, 2.31);
  assert.equal(getMountOptions(profile), null);
  assert.equal(profile.arduinoExport, false);
});
