import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {parseNucleoF103rbModel} from '../dist/nucleo-f103rb-model.js';
import {Box3, Raycaster, Vector3} from '../dist/vendor/three.module.js';

const asset = await readFile(new URL('../dist/models/nucleo-f103rb.glb', import.meta.url));
const createAppearance = await parseNucleoF103rbModel(asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength));
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .003, `${label}: ${actual} ≠ ${expected}`);

function downward(object, x, z) {
  return new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0)).intersectObject(object, true)[0];
}

test('NUCLEO-F103RB PCB holes, 76 Morpho posts and 32 Arduino sockets align with the 3D endpoint profile', () => {
  const profile = getBoardProfile('nucleo-f103rb');
  const board = createAppearance();
  board.updateMatrixWorld(true);
  const pcb = board.getObjectByName('NUCLEO_PCB_WHITE_MASK_AND_LAMINATE');
  const sockets = board.getObjectByName('NUCLEO_ARDUINO_32_OPEN_FEMALE_SOCKETS');
  const morpho = board.getObjectByName('NUCLEO_MORPHO_76_POSTS');
  const bounds = new Box3().setFromObject(pcb);
  const size = bounds.getSize(new Vector3());
  close(size.x, profile.width, 'board width');
  close(size.z, profile.height, 'board length');
  close(bounds.min.y, .21, 'PCB base');
  close(bounds.max.y, .35, 'PCB top');
  assert.equal(profile.pins.filter(pin => pin.contact === 'male').length, 76);
  assert.equal(profile.pins.filter(pin => pin.contact === 'female').length, 32);
  for (const {id, x, z, contact, contactY} of profile.pins) {
    assert.ok(!downward(pcb, x, z), `${id} PCB drill remains open`);
    if (contact === 'male') {
      close(downward(morpho, x, z)?.point.y, contactY, `${id} post tip`);
    } else {
      assert.ok(!downward(sockets, x, z), `${id} socket bore remains open`);
      close(downward(sockets, x + .109, z)?.point.y, contactY, `${id} socket rim`);
    }
  }
});

test('NUCLEO-F103RB bench and inspection clone independent caps and lamps and share the fixed assembly', () => {
  const bench = createAppearance();
  const comparison = createAppearance(true);
  const lamp = board => board.getObjectByName('NUCLEO_LD2_LENS');
  assert.notEqual(lamp(bench).material, lamp(comparison).material);
  assert.equal(lamp(bench).geometry, lamp(comparison).geometry);
  assert.equal(lamp(bench).material.userData.shared, false);
  assert.equal(lamp(bench).material.emissiveIntensity, 0);
  lamp(bench).material.emissiveIntensity = 2.1;
  assert.equal(lamp(comparison).material.emissiveIntensity, 0);

  for (const [name, x, z] of [['NUCLEO_B1_CAP', -.84, -1.26], ['NUCLEO_B2_CAP', .84, -1.26]]) {
    const cap = bench.getObjectByName(name);
    const unpressed = comparison.getObjectByName(name);
    assert.equal(cap.userData.travel_cm, .025);
    cap.position.y -= cap.userData.travel_cm;
    bench.updateMatrixWorld(true);
    comparison.updateMatrixWorld(true);
    close(downward(cap, x, z)?.point.y, .714, name + ' pressed top');
    close(downward(unpressed, x, z)?.point.y, .739, name + ' comparison top');
  }

  const target = 'NUCLEO_TARGET_MCU';
  const benchChip = downward(bench.getObjectByName(target), -.28, 1.65);
  const inspectionChip = downward(comparison.getObjectByName(target), -.28, 1.65);
  assert.equal(benchChip?.object.userData.inspectionChip, undefined);
  assert.equal(inspectionChip?.object.userData.inspectionChip, 'STM32F103RBT6');
  const shell = comparison.getObjectByName('NUCLEO_CN1_MINI_B_OPEN_SHELL');
  const nose = y => new Raycaster(new Vector3(1.19, y, -5), new Vector3(0, 0, 1)).intersectObject(shell, true);
  assert.equal(nose(.56).length, 0);
  assert.ok(nose(.716).length, 'Mini-B rim is visible around the opening on the negative-Z edge');
});
