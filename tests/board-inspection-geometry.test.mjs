import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { BOARD_PROFILES } from '../dist/board-profiles.js';
import { inspectionBoardVisual } from '../dist/board-inspection-geometry.js';
import { boardVisual } from '../dist/model-renderer.js';
import { UNO_R3_INSPECTION } from '../dist/uno-r3-inspection.js';
import { ESP32_DEVKITC_INSPECTION } from '../dist/esp32-devkitc-inspection.js';
import { PICO_INSPECTION } from '../dist/pico-inspection.js';

test('UNO comparison registers both 2×3 ICSPs without adding simulator pins', () => {
  const profile=BOARD_PROFILES['uno-r3'];
  const model=inspectionBoardVisual(profile,UNO_R3_INSPECTION.pins);
  assert.equal(model.pins.length,44);
  assert.equal(model.pins.filter(pin=>pin.contact==='female').length,32);
  assert.equal(model.pins.filter(pin=>pin.contact==='male').length,12);
  assert.equal(profile.pins.length,32);
  const usb=model.features.find(feature=>feature.type==='usb');
  assert.equal(usb.kind,'B');
  assert.ok(usb.z<0);
  assert.deepEqual(model.features.filter(feature=>feature.inspectionChip).map(feature=>feature.label),['ATmega328P']);
  for(const source of UNO_R3_INSPECTION.pins){
    const pin=model.pins.find(candidate=>candidate.id===source.id);
    assert.deepEqual([pin.x,pin.z],[source.modelX,source.modelZ]);
  }
});

test('ESP comparison keeps photographed header orientation, shield, and NC distinctions', () => {
  const profile=BOARD_PROFILES['esp32-devkitc'];
  const model=inspectionBoardVisual(profile,ESP32_DEVKITC_INSPECTION.pins);
  assert.equal(model.pins.length,38);
  assert.ok(model.pins.every(pin=>pin.contact==='soldered'));
  const pin=id=>model.pins.find(candidate=>candidate.id===id);
  assert.ok(pin('3V3').x<0 && pin('3V3').z<0);
  assert.ok(pin('GPIO23').x>0 && pin('GPIO23').z<0);
  assert.ok(pin('5V').x<0 && pin('5V').z>0);
  assert.equal(pin('GPIO6').canonical,'NC');
  assert.equal(profile.pins.find(candidate=>candidate.id==='GPIO6').canonical,'GPIO6');
  assert.ok(model.features.find(feature=>feature.type==='usb').z>0);
  assert.ok(model.features.find(feature=>feature.type==='antenna').z<0);
  assert.deepEqual(model.features.filter(feature=>feature.inspectionChip).map(feature=>feature.label),['ESP32-WROOM-32E']);
});

test('Pico comparison has through-drills and edge castellations without changing the bench board', () => {
  const profile=BOARD_PROFILES.pico;
  const model=inspectionBoardVisual(profile,PICO_INSPECTION.pins);
  assert.deepEqual([model.width,model.height,model.thickness,model.mountHoleRadius],[2.1,5.1,.10,.105]);
  assert.equal(model.pins.length,43);
  assert.equal(new Set(model.pins.map(pin=>pin.id)).size,43);
  assert.deepEqual(new Set(model.pins.map(pin=>pin.id)),new Set(PICO_INSPECTION.pins.map(pin=>pin.id)));
  assert.equal(boardVisual(profile).pins.length,40);
  assert.equal(boardVisual(profile).header,'pad');
  const byId=id=>model.pins.find(pin=>pin.id===id);
  assert.deepEqual(['GP0','GP15','VBUS','GP16'].map(id=>Math.sign(byId(id).x)),[-1,-1,1,1]);
  assert.ok(byId('GP0').z<byId('GP15').z&&byId('VBUS').z<byId('GP16').z);
  assert.deepEqual(['SWD_CLK','SWD_GND','SWD_IO'].map(id=>byId(id).x),[-.254,0,.254]);
  assert.ok(model.features.find(feature=>feature.type==='usb').z<0);
  assert.deepEqual(model.features.filter(feature=>feature.inspectionChip).map(feature=>[feature.label,feature.contactPitch,feature.pinsPerSide]),[['RP2040',.04,14]]);

  const outline=new THREE.Shape(model.outline.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const {x,z,radius} of [
    ...model.pins.map(pin=>({...pin,radius:pin.holeRadius})),
    ...model.holes.map(([x,z])=>({x,z,radius:model.mountHoleRadius}))
  ]){
    const hole=new THREE.Path();hole.absarc(x,-z,radius,0,2*Math.PI,true);outline.holes.push(hole);
  }
  const pcb=new THREE.Mesh(new THREE.ShapeGeometry(outline,18).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial());
  const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0));
  const solid=(x,z)=>{ray.ray.origin.set(x,1,z);return Boolean(ray.intersectObject(pcb).length);};
  for(const {id,x,z,edge} of model.pins){
    assert.equal(solid(x,z),false,id+' through-drill');
    const [insideX,insideZ]=edge.arc[4];
    assert.equal(solid((edge.x+insideX)/2,(edge.z+insideZ)/2),false,id+' edge notch');
    assert.equal(solid((edge.x+x)/2,(edge.z+z)/2),true,id+' bridge between both openings');
  }
  for(const [x,z] of model.holes)assert.equal(solid(x,z),false,'fixing hole');
  assert.equal(solid(0,0),true,'solid center');
  pcb.geometry.dispose();pcb.material.dispose();
});
