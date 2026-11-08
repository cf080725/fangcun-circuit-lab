import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { breadboardDimensions, breadboardSockets, socketTileGeometry, socketSpringGeometry, throughSocketGeometry, ledLensGeometry } from '../dist/geometry-3d.js';

const down = new THREE.Vector3(0,-1,0);
function fromAbove(geometry,x,z) {
  const face = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry,[face,face]);
  return new THREE.Raycaster(new THREE.Vector3(x,1,z),down).intersectObject(mesh);
}

test('400 3D sockets retain unique endpoints and the 2.54 mm pitch with isolated rails', () => {
  const {pitch} = breadboardDimensions;
  const sockets = breadboardSockets(), byId = new Map(sockets.map(socket => [socket.endpoint,socket]));
  assert.equal(sockets.length,400);
  assert.equal(byId.size,400);
  assert.equal(sockets.filter(socket => socket.rail).length,100);
  assert.ok(Math.abs(byId.get('bb:a2').x - byId.get('bb:a1').x - pitch) < 1e-9);
  assert.ok(Math.abs(byId.get('bb:p6').x - byId.get('bb:p5').x - 2*pitch) < 1e-9);
  assert.ok(byId.get('bb:e1').z < 0 && byId.get('bb:f1').z > 0);
  assert.ok(byId.get('bb:p1').z < 0 && byId.get('bb:p26').z > 0);
});

test('signal and power-rail shells have real through holes with front-facing tops and inner walls', () => {
  const {pitch,coverTop,coverBottom} = breadboardDimensions;
  for(const depth of [pitch,.26]) {
    const tile = socketTileGeometry(depth);
    assert.equal(fromAbove(tile,0,0).length,0,'a central ray passes through the shell');
    const top = fromAbove(tile,.08,.08)[0];
    assert.ok(top,'face outside the hole is visible from above');
    assert.ok(Math.abs(top.point.y - (coverTop-coverBottom)) < 1e-8);
    const shell = new THREE.Mesh(tile,[new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial()]);
    const side = new THREE.Raycaster(new THREE.Vector3(0,.06,0),new THREE.Vector3(1,0,0)).intersectObject(shell)[0];
    assert.ok(side && side.face.normal.x<0,'the aperture wall faces the void');
    tile.dispose();
  }
});

test('socket clips expose two separate spring leaves below the cover', () => {
  const spring = socketSpringGeometry();
  assert.equal(fromAbove(spring,0,0).length,0,'the central plug channel is open');
  assert.ok(fromAbove(spring,-.026,0)[0].point.y>.02);
  assert.ok(fromAbove(spring,.026,0)[0].point.y>.02);
  spring.computeBoundingBox();
  assert.ok(spring.boundingBox.max.y+.018 < breadboardDimensions.coverTop-breadboardDimensions.coverBottom);
  spring.dispose();
});

test('female board headers use a hollow housing with a recessed contact channel', () => {
  const header = throughSocketGeometry(.24,.254,.50,.112);
  assert.equal(fromAbove(header,0,0).length,0);
  assert.equal(fromAbove(header,.078,0)[0].point.y,.50);
  header.dispose();
});

test('LED uses a connected solid silhouette with a height and cathode flat', () => {
  const lens = ledLensGeometry(true);
  lens.computeBoundingBox();
  assert.ok(lens.index.count>1000);
  assert.ok(Math.abs(lens.boundingBox.max.y-.525)<1e-6);
  assert.ok(lens.boundingBox.min.x<-.27);
  assert.equal(lens.boundingBox.max.x,.25);
  const lamp = new THREE.Mesh(lens,new THREE.MeshBasicMaterial());
  assert.ok(new THREE.Raycaster(new THREE.Vector3(0,1,.10),down).intersectObject(lamp).length);
  lens.dispose();
});
