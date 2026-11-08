import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { NANO_INSPECTION } from '../dist/nano-inspection.js';
import { tqfp32PinLayout } from '../dist/chip-inspection-layout.js';

const { pins, photo, chip } = NANO_INSPECTION;
const byId = new Map(pins.map(pin => [pin.id, pin]));

test('Nano uses the unmodified licensed V3.0 board photo and 36 distinct hotspots', async () => {
  const original = await readFile(photo.url);
  assert.equal(createHash('sha256').update(original).digest('hex'), 'dfc68dfbff2d8a639420eb909fff6295b2c5cca9977dab0ae408cff9d84ef431');
  assert.deepEqual([photo.width, photo.height, photo.rotation, photo.licenseLabel], [397,855,180,'CC BY 2.0']);
  assert.equal(byId.size, 36);
  assert.equal(new Set(pins.map(pin => `${pin.x}/${pin.y}`)).size, pins.length);
  assert.ok(pins.every(pin => pin.x > 0 && pin.x < 1 && pin.y > 0 && pin.y < 1 && pin.summary));
  assert.ok(photo.chip.x > byId.get('D13').x && photo.chip.x < byId.get('D12').x);
  assert.ok(photo.chip.y < byId.get('ICSP_1').y);
});

test('Nano photo has the same USB-up edge order and electrical aliases as the modeled board', () => {
  for (const side of ['left','right']) {
    const model = BOARD_PROFILES.nano.pins.filter(pin => pin.side === side);
    const photographed = pins.filter(pin => pin.side === side);
    assert.equal(photographed.length, 15);
    assert.deepEqual(photographed.map(({id,canonical}) => [id,canonical]), model.map(({id,canonical}) => [id,canonical]));
    photographed.forEach((pin, index) => {
      assert.equal(pin.x < .5, side === 'left');
      if (index) assert.ok(pin.y > photographed[index - 1].y);
    });
  }
  assert.deepEqual(pins.filter(pin => pin.side === 'icsp').map(({canonical,chipPin}) => [canonical,chipPin]),
    [['D12',16],['5V',null],['D13',17],['D11',15],['RESET',29],['GND',null]]);
  const at = number => byId.get(`ICSP_${number}`);
  assert.ok(at(1).x < at(3).x && at(3).x < at(5).x);
  for (const odd of [1,3,5]) {
    assert.equal(at(odd).x, at(odd + 1).x);
    assert.ok(at(odd).y > at(odd + 1).y);
  }
});

test('Nano opens the TQFP signals, including both analog-only inputs, using package numbers', () => {
  assert.equal(chip.packageName, 'TQFP-32');
  assert.equal(chip.style, 'tqfp');
  assert.equal(chip.pinPitch, '0.80 mm');
  assert.deepEqual(chip.pins.map(pin => pin.number), Array.from({length:32}, (_, i) => i + 1));
  assert.deepEqual(chip.pins.map(pin => pin.signal), [
    'PD3','PD4','GND','VCC','GND','VCC','PB6','PB7','PD5','PD6','PD7','PB0','PB1','PB2','PB3','PB4',
    'PB5','AVCC','ADC6','AREF','GND','ADC7','PC0','PC1','PC2','PC3','PC4','PC5','PC6','PD0','PD1','PD2'
  ]);
  assert.deepEqual(['D13','A6','A7','AREF','RESET1','RESET2','D0','D1'].map(id => byId.get(id).chipPin), [17,19,22,20,29,29,30,31]);
  for (const id of ['A6','A7']) assert.match(byId.get(id).summary, /仅可模拟输入/);
  for (const block of chip.blocks) assert.ok((block.pins ?? []).every(number => chip.pins[number - 1]));
});

test('TQFP geometry places eight gull-wing leads per side with a .80 mm pitch', () => {
  assert.equal(tqfp32PinLayout(0), null);
  assert.equal(tqfp32PinLayout(33), null);
  for (const [start, axis, direction] of [[1,'labelZ',1],[9,'labelX',1],[17,'labelZ',-1],[25,'labelX',-1]]) {
    const first = tqfp32PinLayout(start);
    const next = tqfp32PinLayout(start + 1);
    const last = tqfp32PinLayout(start + 7);
    const fixedAxis = axis === 'labelX' ? 'labelZ' : 'labelX';
    assert.ok(Math.abs((next[axis] - first[axis]) * direction - .80) < 1e-10);
    assert.ok(Math.abs((last[axis] - first[axis]) * direction - 5.60) < 1e-10);
    assert.equal(first[fixedAxis], last[fixedAxis]);
  }
  assert.ok(tqfp32PinLayout(1).labelX < 0 && tqfp32PinLayout(1).labelZ < 0);
  assert.ok(tqfp32PinLayout(9).labelZ > 0 && tqfp32PinLayout(17).labelX > 0 && tqfp32PinLayout(25).labelZ < 0);
});
