import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {componentPins,rgbLedLight,rgbLedVisual} from '../dist/model-renderer.js';
import {parseKingbrightRgbLedModel} from '../dist/rgbled-kingbright-model.js';

test('named Kingbright RGB has numbered physical lead order with an explicit enlarged top diagram',()=>{
  const named=componentPins({type:'rgbled',rgbModel:'kingbright-wp154a4'});
  assert.deepEqual(named.map(({id,number})=>[id,number]),[['R',1],['COM',2],['B',3],['G',4]]);
  assert.deepEqual(rgbLedVisual.diagram.map(({id})=>id),named.map(({id})=>id));
  assert.deepEqual(named.map(({y})=>y),[.33,.08,.18,.33]);
  assert.ok(named.slice(1).every(({x},index)=>Math.abs(x-named[index].x-.127)<1e-9));
  const generic=componentPins({type:'rgbled'});
  assert.deepEqual(generic.map(({id,z})=>[id,z]),[['R',.62],['G',.62],['B',.62],['COM',.76]]);
});

test('named RGB uses averaged display levels for independent additive channels and clears on missing measurement',()=>{
  const reading={channels:{
    R:{brightness:0,displayBrightness:.4},
    G:{brightness:1,displayBrightness:0},
    B:{brightness:1,displayBrightness:.2},
  }};
  assert.deepEqual(rgbLedLight(reading),{channels:[.4,0,.2],level:.4,hue:[1,0,.5]});
  assert.deepEqual(rgbLedLight(),{channels:[0,0,0],level:0,hue:[0,0,0]});
});

test('named Blender lens has independent emissive materials and four separately pickable real lead meshes',async()=>{
  const bytes=await readFile(new URL('../dist/models/rgbled-kingbright.glb',import.meta.url));
  const create=await parseKingbrightRgbLedModel(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const {root,lens}=create(),another=create();
  root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(lens);
  assert.ok(Math.abs(bounds.min.x-rgbLedVisual.flatX)<1e-4);
  assert.ok(Math.abs(bounds.min.y-rgbLedVisual.baseY)<1e-4);
  assert.ok(Math.abs(bounds.max.y-rgbLedVisual.baseY-rgbLedVisual.height)<1e-4);
  assert.notStrictEqual(lens.material,another.lens.material);
  assert.strictEqual(lens.geometry,another.lens.geometry);
  for(const {id,x,y,z} of rgbLedVisual.pins){
    const hit=new Raycaster(new Vector3(x,y,z+2),new Vector3(0,0,-1)).intersectObject(root,true)[0];
    assert.equal(hit?.object.name,'RGBLED_LEAD_'+id);
    assert.equal(hit?.object.userData.rgbLedTerminal,id);
  }
});
