import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { inspectionBoardVisual } from '../dist/board-inspection-geometry.js';
import { UNO_R3_INSPECTION } from '../dist/uno-r3-inspection.js';
import { parseUnoR3Model } from '../dist/uno-r3-model.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

const profile = BOARD_PROFILES['uno-r3'];
const layout = inspectionBoardVisual(profile, UNO_R3_INSPECTION.pins);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .005, `${label}: ${actual} ≠ ${expected}`);

test('the Blender UNO R3 aligns 32 open sockets and 12 ICSP posts to the runtime targets', async () => {
  const create = await readModel();
  const model = create(true);
  model.updateMatrixWorld(true);
  const sockets = model.getObjectByName('UNO_FEMALE_SOCKET_HOUSINGS');
  const posts = model.getObjectByName('UNO_ICSP_POSTS');
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  const hit = (target, x, z) => {
    ray.ray.origin.set(x, 2, z);
    return ray.intersectObject(target, true)[0];
  };
  assert.equal(layout.pins.length, 44);
  assert.equal(profile.pins.length, 32);
  for (const { id, contact, contactY, x, z } of layout.pins) {
    if (contact === 'female') {
      assert.equal(hit(sockets, x, z), undefined, `${id} has an open socket`);
      near(hit(sockets, x + .085, z)?.point.y, contactY, `${id} socket rim height`);
    } else {
      near(hit(posts, x, z)?.point.y, contactY, `${id} post tip height`);
    }
  }
});

test('UNO R3 CAD holes stay open and the DIP body opens chip inspection', async () => {
  const create = await readModel();
  const bench = create(false);
  const inspection = create(true);
  bench.position.set(2, .3, 4);
  bench.rotation.y = Math.PI / 2;
  assert.deepEqual(inspection.position.toArray(), [0, 0, 0]);
  assert.equal(inspection.rotation.y, 0);

  inspection.updateMatrixWorld(true);
  const pcb = inspection.getObjectByName('UNO_PCB_MASK_AND_LAMINATE');
  const bounds = new Box3().setFromObject(pcb).getSize(new Vector3());
  near(bounds.x, 5.334, 'PCB width');
  near(bounds.y, .14, 'PCB thickness');
  near(bounds.z, 6.858, 'PCB length');
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const [x,z] of layout.holes) {
    ray.ray.origin.set(x, 2, z);
    assert.equal(ray.intersectObject(pcb, true).length, 0, `mount hole at ${x},${z}`);
  }
  ray.ray.origin.set(-1.0287, 2, 1.2065);
  const hit = ray.intersectObject(inspection, true)[0];
  assert.equal(hit?.object.userData.inspectionChip, 'ATmega328P');
  near(hit.point.y, 1.126, 'DIP top');
  assert.equal(bench.getObjectByName('UNO_DIP_BODY').userData.inspectionChip, undefined);
});

async function readModel() {
  const bytes = await readFile(new URL('../dist/models/uno-r3-detail.glb', import.meta.url));
  return parseUnoR3Model(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
