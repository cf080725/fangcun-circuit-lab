import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { inspectionBoardVisual, nanoBoardVisual } from '../dist/board-inspection-geometry.js';
import { NANO_INSPECTION } from '../dist/nano-inspection.js';
import { parseArduinoNanoModel } from '../dist/arduino-nano-model.js';
import { boardPose, getMountOptions, mountedConnections, rotateBoardPoint, signalHole } from '../dist/breadboard-mount.js';
import { Box3, Raycaster, Vector3 } from '../dist/vendor/three.module.js';

const profile = BOARD_PROFILES.nano;
const bench = nanoBoardVisual(profile);
const inspection = inspectionBoardVisual(profile, NANO_INSPECTION.pins);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .002, `${label}: ${actual} ≠ ${expected}`);
const model = (async () => {
  const bytes = await readFile(new URL('../dist/models/arduino-nano-detail.glb', import.meta.url));
  return parseArduinoNanoModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
})();

test('Nano V3.0 photo comparison uses all 30 GPIO solder points and six real ICSP posts', async () => {
  const create = await model;
  const assembly = create(true);
  assembly.updateMatrixWorld(true);
  const pcb = assembly.getObjectByName('NANO_PCB');
  const gpio = assembly.getObjectByName('NANO_GPIO_PLATING');
  const posts = assembly.getObjectByName('NANO_ICSP_POSTS');
  const dimensions = new Box3().setFromObject(pcb).getSize(new Vector3());
  near(dimensions.x, bench.width, 'PCB width');
  near(dimensions.y, .14, 'PCB thickness');
  near(dimensions.z, bench.height, 'PCB length');

  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  const hits = (x,z,objects) => {
    ray.ray.origin.set(x, 2, z);
    return ray.intersectObjects(objects, true);
  };
  assert.equal(bench.pins.length, 30);
  assert.equal(inspection.pins.length, 36);
  assert.deepEqual(inspection.pins.map(pin=>pin.id), NANO_INSPECTION.pins.map(pin=>pin.id));
  for (const {id,x,z} of bench.pins) {
    assert.equal(hits(x,z,[pcb,gpio]).length, 0, `${id} has an actual PCB bore`);
    assert.ok(hits(x-Math.sign(x)*.065,z,[gpio]).length, `${id} is surrounded by plating`);
  }
  for (const {id,x,z,contactY} of inspection.pins.filter(pin=>pin.side==='icsp')) {
    assert.equal(hits(x,z,[pcb]).length, 0, `${id} aligns with a PCB bore`);
    near(hits(x,z,[posts])[0]?.point.y, contactY, `${id} post tip`);
  }
  for (const [x,z] of bench.holes) assert.equal(hits(x,z,[pcb]).length, 0, 'mounting hole is open');
  assert.ok(hits(0,0,[pcb]).length, 'PCB between the drills is solid');

  const chip = hits(0,-.66,[assembly])[0];
  assert.equal(chip?.object.userData.inspectionChip, 'ATmega328P');
  near(chip.point.y, .47, 'ATmega328P top');
  const labChip = create(false).getObjectByName(chip.object.name);
  assert.equal(labChip.userData.inspectionChip, undefined);
  assert.ok(labChip.geometry === chip.object.geometry, 'renderers reuse the same model resources');
  assert.ok(assembly.getObjectByName('NANO_FT232RL_PACKAGE'));
  assert.equal(bench.features.find(f=>f.id==='onboard').label, 'L');
  assert.equal(bench.features.find(f=>f.boardReset).label, 'RST');
});

test('the 30 Nano lab endpoints align with the same saved mount contacts at every allowed orientation', () => {
  const options = getMountOptions(profile);
  const pins = new Map(bench.pins.map(pin=>[pin.id,pin]));
  for (const rows of options.rowPairs) for (const rotation of options.rotations) {
    const circuit = {board:{mount:{column:options.defaultColumn,rotation,rows}},breadboard:{x:1.8,z:.5}};
    const pose = boardPose(circuit, profile);
    const contacts = mountedConnections(circuit, profile);
    assert.equal(contacts.length, 30);
    for (const {a,b} of contacts) {
      const pin = pins.get(a.slice(4));
      const {x,z} = rotateBoardPoint(pin.x,pin.z,rotation);
      const hole = signalHole(b[3],Number(b.slice(4)));
      near(pose.x+x,circuit.breadboard.x+hole.x,`${pin.id} socket x`);
      near(pose.z+z,circuit.breadboard.z+hole.z,`${pin.id} socket z`);
    }
  }
});
