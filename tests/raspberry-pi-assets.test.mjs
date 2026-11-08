import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseEmbeddedBoard } from '../dist/board-glb.js';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

const boardParts = {
  'raspberry-pi-4': ['USB_C_POWER', 'ETHERNET_OPEN_SHELL', 'USB3_SHELL_2', 'AUDIO_JACK'],
  'raspberry-pi-5': ['USB_C_POWER', 'ETHERNET_OPEN_SHELL', 'PCIE_FFC', 'POWER_BUTTON_RTC_AND_POE'],
  'pi-zero-2-w': ['MINI_HDMI', 'MICRO_USB_OTG', 'MICRO_USB_POWER', 'CAMERA_CSI']
};

function closeTo(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < .001, `${label}: expected ${expected}, received ${actual}`);
}

function topHits(object, x, z) {
  return new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0)).intersectObject(object, true);
}

for (const [id, ports] of Object.entries(boardParts)) {
  test(`${id} Blender mesh has its own ports and aligns all 40 physical GPIO tips`, async () => {
    const buffer = await readFile(new URL(`../dist/models/${id}.glb`, import.meta.url));
    const scene = await parseEmbeddedBoard(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    const root = scene.getObjectByName('PI_SBC_COMMON');
    assert.equal(root?.userData['Board ID'], id);
    root.updateMatrixWorld(true);
    for (const port of ports) assert.ok(root.getObjectByName('PI_SBC_' + port), port);
    const profile = BOARD_PROFILES[id];
    const board = root.getObjectByName('PI_SBC_PCB');
    const bounds = new Box3().setFromObject(board);
    closeTo(bounds.max.x - bounds.min.x, profile.width, 'PCB width');
    closeTo(bounds.max.z - bounds.min.z, profile.height, 'PCB depth');
    closeTo(bounds.max.y - bounds.min.y, .16, 'PCB thickness');
    for (const x of [.35 - profile.width / 2, 6.15 - profile.width / 2]) {
      for (const z of [.35 - profile.height / 2, profile.height / 2 - .35]) {
        assert.equal(topHits(board, x, z).length, 0, 'physical mounting bore');
      }
    }
    const posts = root.getObjectByName('PI_SBC_GPIO_POSTS');
    assert.equal(posts?.userData['Pin count'], 40);
    for (const pin of profile.pins) {
      const hit = topHits(posts, pin.x, pin.z)[0];
      assert.ok(hit, pin.id);
      closeTo(hit.point.y, pin.contactY, pin.id);
      assert.equal(topHits(board, pin.x, pin.z).length, 0, pin.id + ' PCB bore');
    }
  });
}
