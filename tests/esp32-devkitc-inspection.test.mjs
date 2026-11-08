import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBoardProfile } from '../dist/board-profiles.js';
import { ESP32_DEVKITC_INSPECTION as devkit } from '../dist/esp32-devkitc-inspection.js';

test('DevKitC photo is a rotated viewport onto Espressif’s unchanged original PNG', async () => {
  const svg = await readFile(devkit.photo.url, 'utf8');
  const [encoded] = svg.match(/(?<=data:image\/png;base64,)[\w+/=]+/) ?? [];
  assert.ok(encoded);
  const png = Buffer.from(encoded, 'base64');
  assert.equal(createHash('sha256').update(png).digest('hex'), 'e078f94904c5396ac7475c1e2349b368b31db7bb4d2716954bc3f72fdad7ab3c');
  assert.match(svg, /viewBox="182 -1235 426 841"/);
  assert.match(svg, /transform="rotate\(-90\)"/);
  assert.equal(devkit.photo.licenseLabel, 'CC BY-SA 4.0');
});

test('the antenna-up photo has 38 independently addressable pins matching the board profile', () => {
  const profile = getBoardProfile(devkit.id);
  const left = profile.pins.filter(pin => pin.side === 'right').reverse();
  const right = profile.pins.filter(pin => pin.side === 'left').reverse();
  assert.deepEqual(devkit.pins.map(pin => pin.id), [...left, ...right].map(pin => pin.id));
  assert.equal(new Set(devkit.pins.map(pin => pin.id)).size, 38);
  const groups = [devkit.pins.slice(0, 19), devkit.pins.slice(19)];
  for (const [row, pins] of groups.entries()) {
    for (const [index, pin] of pins.entries()) {
      assert.ok(pin.x > 0 && pin.x < 1 && pin.y > 0 && pin.y < 1);
      assert.equal(Math.sign(pin.modelX), row === 0 ? -1 : 1);
      if (index) {
        assert.ok(pin.y > pins[index - 1].y);
        assert.ok(Math.abs(pin.modelZ - pins[index - 1].modelZ - .254) < 1e-8);
      }
    }
  }
});

test('module jumps follow WROOM-32E numbering and do not misidentify board rails or legacy Flash labels', () => {
  const byId = new Map(devkit.pins.map(pin => [pin.id, pin]));
  assert.equal(devkit.chip.pins.length, 39);
  assert.equal(devkit.chip.pins[38].signal, 'GND');
  assert.equal(byId.get('GPIO34').chipPin, 6);
  assert.equal(byId.get('GPIO0').chipPin, 25);
  assert.equal(byId.get('GPIO23').chipPin, 37);
  assert.equal(byId.get('3V3').chipPin, 2);
  assert.equal(byId.get('EN').chipPin, 3);
  for (const id of ['GND1', 'GND2', 'GND3', '5V']) assert.equal(byId.get(id).chipPin, null, id);
  for (let gpio = 6; gpio <= 11; gpio++) {
    const pin = byId.get(`GPIO${gpio}`);
    assert.equal(pin.chipPin, null, pin.id);
    assert.equal(pin.canonical, 'NC', pin.id);
  }
  for (const number of [17, 18, 19, 20, 21, 22, 32]) assert.equal(devkit.chip.pins[number - 1].signal, 'NC');
  for (const block of devkit.chip.blocks) {
    assert.ok((block.pins ?? []).every(number => devkit.chip.pins[number - 1]?.signal !== 'NC'));
  }
});
