import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { parseBluePillModel } from '../dist/blue-pill-model.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

test('the Blender Blue Pill keeps all 40 simulator pins aligned to open plated drills', async () => {
  const create = await readModel();
  const model = create(false);
  const pcb = model.getObjectByName('BP_PCB_MASK_AND_LAMINATE');
  const plating = model.getObjectByName('BP_PLATED_HEADER_HOLES');
  const dimensions = new Box3().setFromObject(pcb).getSize(new Vector3());
  assert.ok(Math.abs(dimensions.x - 2.30) < .001);
  assert.ok(Math.abs(dimensions.y - .146) < .001);
  assert.ok(Math.abs(dimensions.z - 5.30) < .001);

  model.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  assert.equal(BOARD_PROFILES.bluepill.pins.length, 40);
  for (const { id, x, z } of BOARD_PROFILES.bluepill.pins) {
    ray.ray.origin.set(x, 1, z);
    assert.equal(ray.intersectObjects([pcb, plating], true).length, 0, `${id} drill is open`);
    ray.ray.origin.set(x + Math.sign(x) * .075, 1, z);
    assert.equal(ray.intersectObject(plating, true)[0]?.object, plating, `${id} has plating around the drill`);
  }
});

test('lab and comparison get independent transforms and comparison chip meshes receive clicks', async () => {
  const create = await readModel();
  const bench = create(false);
  const inspection = create(true);
  assert.ok(bench.getObjectByName('BP_CHIP_BENCH_PACKAGE')?.isMesh);
  assert.ok(!bench.getObjectByName('BP_INSPECTION_DETAILS'));
  assert.ok(!inspection.getObjectByName('BP_BENCH_DETAILS'));

  const benchPads = bench.getObjectByName('BP_PLATED_HEADER_HOLES');
  const inspectionPads = inspection.getObjectByName('BP_PLATED_HEADER_HOLES');
  assert.notEqual(benchPads, inspectionPads);
  assert.equal(benchPads.geometry, inspectionPads.geometry);
  assert.equal(benchPads.geometry.userData.shared, true);
  bench.position.set(3, .4, 2);
  bench.rotation.y = Math.PI / 2;
  assert.deepEqual(inspection.position.toArray(), [0, 0, 0]);
  assert.equal(inspection.rotation.y, 0);

  inspection.updateMatrixWorld(true);
  const chip = inspection.getObjectByName('BP_CHIP_INSPECTION_PACKAGE');
  const center = new Box3().setFromObject(chip).getCenter(new Vector3());
  const ray = new Raycaster(new Vector3(center.x, 2, center.z), new Vector3(0, -1, 0));
  const hit = ray.intersectObject(inspection, true)[0];
  assert.equal(hit?.object, chip);
  assert.equal(hit.object.userData.inspectionChip, true);
});

async function readModel() {
  const bytes = await readFile(new URL('../dist/models/blue-pill-detail.glb', import.meta.url));
  return parseBluePillModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
