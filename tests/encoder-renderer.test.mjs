import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {componentPins, encoderAppearance, encoderVisual, moveEncoderShaft, pointerIntent} from '../dist/model-renderer.js';
import {encoderPins} from '../dist/rotary-encoder.js';
import {parseEncoderPec11rModel} from '../dist/encoder-pec11r-model.js';
import {Box3, Raycaster, Vector3} from '../dist/vendor/three.module.js';

test('encoder shaft motion crosses signed detents and retries a partially accepted batch', () => {
  const drag = {id: 'encoder1', x: 50, sent: 0};
  const observed = [];
  const send = (id, delta) => { observed.push([id, delta]); return delta; };
  moveEncoderShaft(drag, 61, send);
  assert.deepEqual(observed, []);
  moveEncoderShaft(drag, 86, send);
  moveEncoderShaft(drag, 86, send);
  moveEncoderShaft(drag, 38, send);
  assert.deepEqual(observed, [['encoder1', 3], ['encoder1', -4]]);
  assert.equal(drag.sent, -1);

  moveEncoderShaft(drag, 74, () => 1);
  assert.equal(drag.sent, 0);
  moveEncoderShaft(drag, 74, () => 0);
  assert.equal(drag.sent, 0);
  moveEncoderShaft(drag, 74, send);
  assert.deepEqual(observed.at(-1), ['encoder1', 2]);
  moveEncoderShaft(drag, 800, send);
  assert.deepEqual(observed.at(-1), ['encoder1', 12]);
});

test('shaft turning is scoped to Select and separate from moving the case and wiring pins', () => {
  const shaft = {id: 'encoder1', kind: 'encoder-shaft'};
  const body = {id: 'encoder1', kind: 'component'};
  const pin = {id: 'encoder1', kind: 'pin', endpoint: 'encoder1:A'};
  assert.equal(pointerIntent(shaft), 'turn-encoder');
  assert.equal(pointerIntent(shaft, {mode: 'move'}), 'drag');
  assert.equal(pointerIntent(shaft, {mode: 'wire'}), 'select');
  assert.equal(pointerIntent(shaft, {pendingPin: 'mcu:PB0'}), 'select');
  assert.equal(pointerIntent(shaft, {spacePan: true}), 'pan');
  assert.equal(pointerIntent(body), 'drag');
  assert.equal(pointerIntent(pin, {mode: 'wire'}), 'wire');
  assert.equal(pointerIntent(pin, {pendingPin: 'mcu:PB0'}), 'connect');
  assert.deepEqual(encoderAppearance({angle: 35, detents: 2, switchClosed: true}), {angle: 35, pressed: true});
  assert.deepEqual(encoderAppearance({detents: -1}), {angle: 345, pressed: false});
});

test('actual GLB contacts match both renderers and the native shaft moves independently', async () => {
  const bytes = await readFile(new URL('../dist/models/encoder-pec11r.glb', import.meta.url));
  const create = await parseEncoderPec11rModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const {root, shaft} = create();
  root.updateMatrixWorld(true);
  const body = root.getObjectByName('ENCODER_BODY');
  const terminals = componentPins({type: 'encoder'});
  assert.deepEqual(terminals.map(pin => pin.id), encoderPins);
  for (const {id, x, y, z} of terminals) {
    const object = root.getObjectByName('ENCODER_CONTACT_' + id);
    assert.deepEqual(object.userData.Endpoint, [x, y, z]);
    assert.equal(object.userData.encoderTerminal, id);
    const side = Math.sign(z);
    const hit = new Raycaster(new Vector3(x, y, side * 2), new Vector3(0, 0, -side)).intersectObject(root, true)[0];
    assert.equal(hit?.object.name, object.name);
  }
  const initial = new Box3().setFromObject(body);
  assert.ok(Math.abs(new Box3().setFromObject(shaft).max.y - encoderVisual.shaftTop) < .002);
  shaft.position.y -= encoderVisual.pressTravel;
  shaft.rotation.y = -Math.PI / 2;
  root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(body).equals(initial));
  assert.ok(Math.abs(new Box3().setFromObject(shaft).max.y - (encoderVisual.shaftTop - encoderVisual.pressTravel)) < .002);
  assert.equal(create().shaft.rotation.y, 0, 'a second renderer starts at the unturned state');
});
