import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { inspectionBoardVisual } from '../dist/board-inspection-geometry.js';
import { PICO_INSPECTION } from '../dist/pico-inspection.js';
import { parsePicoRp2040Model } from '../dist/pico-rp2040-model.js';
import { boardPose, getMountOptions, mountedConnections, rotateBoardPoint, signalHole } from '../dist/breadboard-mount.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

const profile = BOARD_PROFILES.pico;
const layout = inspectionBoardVisual(profile, PICO_INSPECTION.pins);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .002, `${label}: ${actual} ≠ ${expected}`);

test('Pico Rev3 has 43 open plated drills, castellations and four mounting holes', async () => {
  const create = await readModel();
  const model = create(true);
  model.updateMatrixWorld(true);
  const pcb = model.getObjectByName('PICO_PCB');
  const gpio = model.getObjectByName('PICO_GPIO_PLATING');
  const swd = model.getObjectByName('PICO_SWD_PLATING');
  const dimensions = new Box3().setFromObject(pcb).getSize(new Vector3());
  near(dimensions.x, 2.1, 'PCB width');
  near(dimensions.y, .10, 'PCB thickness');
  near(dimensions.z, 5.10, 'PCB length');

  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  const hits = (x,z,objects) => {
    ray.ray.origin.set(x, 2, z);
    return ray.intersectObjects(objects, true);
  };
  assert.equal(layout.pins.length, 43);
  for (const {id,x,z,side,edge} of layout.pins) {
    const plating = side === 'bottom' ? swd : gpio;
    assert.equal(hits(x,z,[pcb,plating]).length, 0, `${id} has an open through-drill`);
    const inward = side === 'bottom' ? [x,z-.067] : [x-Math.sign(x)*.067,z];
    assert.equal(hits(...inward,[plating])[0]?.object.userData.inspectionPicoPad, true, `${id} has clickable plating`);
    const [innerX,innerZ] = edge.arc[4];
    assert.equal(hits((edge.x+innerX)/2,(edge.z+innerZ)/2,[pcb]).length, 0, `${id} has a castellated edge notch`);
  }
  for (const [x,z] of layout.holes) assert.equal(hits(x,z,[pcb]).length, 0, 'mounting hole is open');
  assert.ok(hits(0,0,[pcb]).length, 'PCB between the drills is solid');
});

test('the actual RP2040 top is clickable, and the 40 bench pins still match all legal insertions', async () => {
  const create = await readModel();
  const inspection = create(true);
  const bench = create(false);
  inspection.updateMatrixWorld(true);
  const packageMesh = inspection.getObjectByName('PICO_RP2040_PACKAGE');
  const center = new Box3().setFromObject(packageMesh).getCenter(new Vector3());
  const ray = new Raycaster(new Vector3(center.x, 2, center.z), new Vector3(0, -1, 0));
  const hit = ray.intersectObject(inspection, true)[0];
  assert.equal(hit?.object.userData.inspectionChip, 'RP2040');
  near(hit.point.y, .44, 'RP2040 package top');
  assert.equal(bench.getObjectByName(packageMesh.name).userData.inspectionChip, undefined);
  assert.equal(layout.features.find(f=>f.id==='onboard').type, 'led');
  assert.ok(!layout.features.find(f=>f.squareCap).boardReset);

  const options = getMountOptions(profile);
  const pins = new Map(layout.pins.map(pin=>[pin.id,pin]));
  for (const rows of options.rowPairs) for (const rotation of options.rotations) {
    const circuit = { board:{mount:{column:options.defaultColumn,rotation,rows}}, breadboard:{x:1.8,z:.5} };
    const pose = boardPose(circuit, profile);
    const contacts = mountedConnections(circuit, profile);
    assert.equal(contacts.length, 40);
    for (const {a,b} of contacts) {
      const pin = pins.get(a.slice(4));
      const { x,z } = rotateBoardPoint(pin.x,pin.z,rotation);
      const hole = signalHole(b[3],Number(b.slice(4)));
      near(pose.x + x, circuit.breadboard.x + hole.x, `${pin.id} socket x`);
      near(pose.z + z, circuit.breadboard.z + hole.z, `${pin.id} socket z`);
    }
  }
});

async function readModel() {
  const bytes = await readFile(new URL('../dist/models/pico-rp2040-detail.glb', import.meta.url));
  return parsePicoRp2040Model(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
