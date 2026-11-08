import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapToBreadboard } from '../dist/model-renderer.js';
import { hardwareGeometryLabel } from '../dist/catalog-ui.js';

test('snap aligns the real lead offset to the nearest physical hole', () => {
  const holes = [{ id: 'bb:a1', x: 2, z: .5 }, { id: 'bb:b1', x: 2, z: .754 }];
  const lead = { x: -.18, z: .48 };
  const aligned = snapToBreadboard({ x: 2.17, z: .08 }, lead, holes);
  assert.equal(aligned.id, 'bb:a1');
  assert.equal(aligned.x + lead.x, 2);
  assert.equal(aligned.z + lead.z, .5);
  assert.equal(snapToBreadboard({ x: 2.17, z: 1 }, lead, holes), null);
});

test('snap stays within bounds accepted by project import', () => {
  assert.equal(snapToBreadboard({ x: 30, z: 0 }, { x: -.2, z: 0 }, [{ id: 'bb:a1', x: 29.9, z: 0 }]), null);
});

test('catalog distinguishes board detail, generic package geometry and reference material', () => {
  for (const profileId of ['bluepill','uno-r3','esp32-devkitc','pico','nano','nucleo-f103rb']) {
    assert.equal(hardwareGeometryLabel({ profileId }, 'board'), '精细 3D · 可运行');
  }
  assert.equal(hardwareGeometryLabel({ profileId: 'nano-every' }, 'board'), '教学 3D · 可运行');
  assert.equal(hardwareGeometryLabel({ profileId: 'microbit-v2' }, 'board'), '教学 3D · 部分接口可运行');
  assert.equal(hardwareGeometryLabel({ profileId: null }, 'board'), '仅资料 · 无实验台模型');
  assert.equal(hardwareGeometryLabel({ modelType: 'resistor' }, 'part'), '封装示意 3D · 可运行');
  assert.equal(hardwareGeometryLabel({ modelType: 'encoder' }, 'part'), '实物封装 3D · 可转动');
  assert.equal(hardwareGeometryLabel({ modelType: 'joystick' }, 'part'), '实物封装 3D · 可推摇杆');
  assert.equal(hardwareGeometryLabel({modelType:'rgbled',defaults:{rgbModel:'kingbright-wp154a4'}},'part'),'实物封装 3D · PWM 混色');
  assert.equal(hardwareGeometryLabel({ modelType: 'unimplemented' }, 'part'), '仅资料与选型');
});
