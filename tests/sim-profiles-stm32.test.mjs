import test from 'node:test';
import assert from 'node:assert/strict';
import { boardPinNumber, canonicalPin, getBoardProfile } from '../dist/board-profiles.js';
import { boardPose, getMountOptions, rotateBoardPoint } from '../dist/breadboard-mount.js';
import { visualBounds } from '../dist/model-renderer.js';

test('each new STM32 exposes the mapped Arduino headers and marks the remaining connectors as unmodeled', () => {
  const profiles = [
    ['nucleo-f411re', 'PA3', 'PB10', 'PC1', 46],
    ['nucleo-f446re', 'PA3', 'PB10', 'PC1', 46],
    ['nucleo-l476rg', 'PA3', 'PB10', 'PC1', 45],
    ['nucleo-g071rb', 'PC5', 'PB14', 'PB11', 53],
    ['nucleo-h743zi', 'PG9', 'PE9', 'PF5', 73],
    ['nucleo-u575zi-q', 'PG8', 'PE9', 'PC1', 73],
    ['nucleo-h563zi', 'PB7', 'PE9', 'PC2', 73],
    ['stm32f746g-disco', 'PC7', 'PH6', 'PF7', 'PA0']
  ];
  for (const [id, d0, d6, a4, a0Number] of profiles) {
    const profile = getBoardProfile(id);
    assert.equal(profile.partialPinout, true, id);
    assert.equal(profile.pins.length, 32, id);
    assert.equal(canonicalPin('mcu:D0', id), d0, id);
    assert.equal(canonicalPin('mcu:D6', id), d6, id);
    assert.equal(canonicalPin('mcu:A4', id), a4, id);
    assert.equal(boardPinNumber('A0', id), a0Number, id);
    assert.notEqual(canonicalPin('SDA', id), a4, id);
    assert.deepEqual(profile.dialects, ['arduino'], id);
    assert.equal(profile.capabilities.binaryFirmware, false, id);
    assert.equal(getMountOptions(profile), null, id);
  }
});

test('camera fit includes the rotated free board and uses the mounted pose after insertion', () => {
  const profile = getBoardProfile('bluepill');
  const circuit = { board: {x: -10, z: -8, rotation: 90}, breadboard: {x: 2, z: 1}, components: [] };
  const free = visualBounds(circuit, profile);
  assert.ok(free.left <= circuit.board.x - profile.height / 2);
  assert.ok(free.top <= circuit.board.z - profile.width / 2);

  const options = getMountOptions(profile);
  circuit.board.mount = {column: options.defaultColumn, rotation: 270};
  const mounted = visualBounds(circuit, profile);
  const pose = boardPose(circuit, profile);
  assert.ok(pose.mounted);
  assert.ok(mounted.left > free.left && mounted.top > free.top);
  for (const pin of profile.pins) {
    const {x,z} = rotateBoardPoint(pin.x, pin.z, pose.rotation);
    assert.ok(pose.x + x >= mounted.left && pose.x + x <= mounted.right);
    assert.ok(pose.z + z >= mounted.top && pose.z + z <= mounted.bottom);
  }
});
