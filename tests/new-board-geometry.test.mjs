import test from 'node:test';
import assert from 'node:assert/strict';
import {getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {BOARD_CATALOG} from '../dist/catalog-data.js';
import {breadboardDimensions} from '../dist/geometry-3d.js';
import {boardVisual} from '../dist/model-renderer.js';

test('micro:bit uses plated rings and edge strips instead of pin headers', () => {
  const model = boardVisual(getBoardProfile('microbit-v2'));
  assert.deepEqual([model.width,model.height,model.thickness],[5.16,4.2,.16]);
  const rings = model.pins.filter(pin=>pin.contact==='ring');
  assert.deepEqual(rings.map(pin=>pin.x),[-2.159,-1.143,0,1.143,2.159]);
  assert.ok(rings.every(pin=>pin.z===1.414 && pin.holeRadius>0 && pin.padOutline.length>10));
  assert.equal(model.pins.filter(pin=>pin.contact==='edge').length,20);
  assert.ok(model.pins.every(pin=>pin.side==='bottom'));
  assert.ok(model.outline.some(([x,z])=>x===.12 && z<2.1 && z>2));
  assert.deepEqual(model.features.filter(f=>f.type==='button'&&!f.back).map(f=>f.label),['A','B']);
  const display=model.features.filter(f=>f.type==='matrix-led' && f.z>=-.7);
  assert.equal(display.length,25);
  assert.equal(new Set(display.map(f=>f.x)).size,5);
  assert.equal(new Set(display.map(f=>f.z)).size,5);
  assert.ok(model.features.some(f=>f.type==='usb' && f.back && f.kind==='micro'));
  assert.ok(model.features.some(f=>f.type==='qfn' && f.back && f.label==='nRF52833'));
});

test('Nordic DK connector geometry distinguishes the shield boards and three expansion headers', () => {
  for(const id of ['nrf52840-dk','nrf5340-dk']) {
    const model=boardVisual(getBoardProfile(id));
    assert.equal(model.header,'female');
    assert.equal(model.usbDirection,'↑');
    const ports=model.features.filter(f=>f.type==='usb');
    assert.equal(ports.length,2);
    assert.ok(ports.every(f=>f.kind==='micro'));
    assert.equal(Math.sign(ports[1].x),id==='nrf52840-dk'?-1:1);
    assert.ok(model.features.some(f=>f.type==='qfn' && f.label===model.profile.mcu));
  }
  const model=boardVisual(getBoardProfile('nrf54l15-dk'));
  assert.equal(model.header,'male');
  assert.equal(model.usbDirection,'←');
  assert.ok(model.features.some(f=>f.type==='usb' && f.kind==='C' && f.x<0));
  const headers=model.features.filter(f=>f.type==='unmodeled-header');
  assert.equal(headers.length,3);
  assert.deepEqual(headers.map(f=>f.active.length),[4,6,7]);
  for(const header of headers)for(const pin of header.active) {
    const column=(pin.x-header.x)/.254+4.5,row=(pin.z-header.z)/.254+.5;
    assert.ok(Math.abs(column-Math.round(column))<1e-6 && column>=-1e-6 && column<=9+1e-6);
    assert.ok(Math.abs(row-Math.round(row))<1e-6 && row>=-1e-6 && row<=1+1e-6);
  }
});

test('catalog MCUs and the three Raspberry Pi GPIO boards have executable profiles', () => {
  const missing=BOARD_CATALOG.filter(item=>!item.profileId);
  assert.equal(missing.length,4);
  assert.ok(missing.every(item=>item.category==='Linux / AI 开发板'));
  assert.equal(BOARD_CATALOG.length-missing.length,52);
});

test('the final six MCU profiles have their own connectors, chip packages and clear starter placement', () => {
  const ids=['lp-mspm0g3507','msp430fr2355','frdm-k64f','frdm-mcxn947','ch32v003-evt','ch32v307-evt'];
  const models=ids.map(id=>boardVisual(getBoardProfile(id)));
  for(const model of models){
    assert.equal(model.thickness,.16);
    assert.ok(model.features.some(f=>['ic','bga'].includes(f.type)&&model.profile.mcu.startsWith(f.label)),model.profile.id);
    const {circuit}=makeBoardStarter(model.profile.id,'blink');
    assert.ok(circuit.board.x+model.width/2<circuit.breadboard.x-breadboardDimensions.width/2);
  }
  for(const model of models.slice(0,2)){
    assert.equal(model.pins.length,40);
    assert.ok(model.pins.every(pin=>pin.contact==='male'));
    assert.ok(model.features.some(f=>f.label==='J101'));
  }
  for(const model of models.slice(2,4)){
    assert.equal(model.features.filter(f=>f.type==='ethernet').length,1);
    assert.deepEqual(model.features.filter(f=>f.type==='unmodeled-header'&&f.active.length).map(f=>f.rows),[8,10,8,6]);
    assert.ok(model.pins.every(pin=>pin.contact==='female'));
  }
  const [v003,v307]=models.slice(4);
  assert.equal(v003.features.find(f=>f.label==='CH32V003F4P6').leadRows,2);
  assert.equal(v003.holes.length,0);
  assert.equal(v307.features.filter(f=>f.type==='usb').length,3);
  assert.equal(v307.features.filter(f=>f.type==='header'&&f.rows===27).length,2);
});
