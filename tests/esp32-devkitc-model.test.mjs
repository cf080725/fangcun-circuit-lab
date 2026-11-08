import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { esp32BenchVisual, inspectionBoardVisual } from '../dist/board-inspection-geometry.js';
import { ESP32_DEVKITC_INSPECTION } from '../dist/esp32-devkitc-inspection.js';
import { parseEsp32DevkitcModel } from '../dist/esp32-devkitc-model.js';
import { getMountOptions, mountedConnections } from '../dist/breadboard-mount.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

const profile = BOARD_PROFILES['esp32-devkitc'];
const inspectionLayout = inspectionBoardVisual(profile, ESP32_DEVKITC_INSPECTION.pins);
const benchLayout = esp32BenchVisual(profile);

test('the ESP32 model keeps 38 real header drills aligned in both orientations', async () => {
  const create = await readModel();
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const [forInspection, layout] of [[true,inspectionLayout],[false,benchLayout]]) {
    const model = create(forInspection);
    model.updateMatrixWorld(true);
    const pcb = model.getObjectByName('ESP32_PCB_MASK_AND_LAMINATE');
    const plating = model.getObjectByName('ESP32_PCB_PLATED_HEADER_HOLES');
    const bounds = new Box3().setFromObject(pcb).getSize(new Vector3());
    assert.ok(Math.abs(bounds.x - 2.794) < .005);
    assert.ok(Math.abs(bounds.z - 4.826) < .005);
    assert.equal(layout.pins.length, 38);
    for (const { id, x, z } of layout.pins) {
      ray.ray.origin.set(x, 2, z);
      assert.equal(ray.intersectObjects([pcb, plating], true).length, 0, `${id} drill is open`);
      ray.ray.origin.set(x + Math.sign(x) * .074, 2, z);
      assert.ok(ray.intersectObject(plating, true).length, `${id} drill has plated rim`);
    }
  }
  const mount = getMountOptions(profile);
  const circuit = { board:{ mount:{ column:mount.defaultColumn, rotation:90 } } };
  assert.equal(mountedConnections(circuit, profile).length, 38);
});

test('the ESP32 photo shows the antenna above and the WROOM metal shield opens the module view', async () => {
  const create = await readModel();
  const inspection = create(true);
  const bench = create(false);
  inspection.updateMatrixWorld(true);
  bench.updateMatrixWorld(true);
  const shield = inspection.getObjectByName('ESP32_WROOM_SHIELD');
  const usb = 'ESP32_USB_MICRO_B_OPEN_SHELL';
  const antenna = inspection.getObjectByName('ESP32_WROOM_ANTENNA');
  const center = object => new Box3().setFromObject(object).getCenter(new Vector3());
  assert.ok(center(antenna).z < center(shield).z);
  assert.ok(center(inspection.getObjectByName(usb)).z > 0);
  assert.ok(center(bench.getObjectByName(usb)).z < 0);
  const { x,z } = center(shield);
  const ray = new Raycaster(new Vector3(x, 2, z), new Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(inspection, true)[0]?.object.userData.inspectionChip, 'ESP32-WROOM-32E');
  assert.equal(bench.getObjectByName(shield.name).userData.inspectionChip, undefined);
  assert.deepEqual(inspectionLayout.features.filter(f=>f.boardReset).map(f=>[f.label,f.x,f.z]), [['EN',-.80,2.02]]);
  assert.deepEqual(benchLayout.features.filter(f=>f.boardReset).map(f=>[f.label,f.x,f.z]), [['EN',.80,-2.02]]);
});

async function readModel() {
  const bytes = await readFile(new URL('../dist/models/esp32-devkitc-v4-detail.glb', import.meta.url));
  return parseEsp32DevkitcModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
