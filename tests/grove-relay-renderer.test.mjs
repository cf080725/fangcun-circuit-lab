import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {componentPins,groveRelayPinDescription,groveRelayState,groveRelayVisual} from '../dist/model-renderer.js';
import {parseGroveRelayModel} from '../dist/grove-relay-model.js';

test('Grove v1.2 has four control pins and only two load terminals',()=>{
  const pins=componentPins({type:'grove-relay'});
  assert.deepEqual(pins.map(({id})=>id),['SIG','NC','VCC','GND','COM','NO']);
  assert.deepEqual(pins.filter(({connector})=>connector==='screw').map(({id})=>id),['COM','NO']);
  assert.deepEqual(pins.slice(0,4).map(({z})=>z),[.3,.1,-.1,-.3]);
  assert.match(groveRelayPinDescription(pins[1]),/板上未接/);
  assert.match(groveRelayPinDescription(pins[5]),/常开/);
});

test('Grove physical SIG indicator and COM/NO teaching marker use independent solver values',()=>{
  assert.deepEqual(groveRelayState(),{indicator:false,closed:false});
  assert.deepEqual(groveRelayState({indicator:true,closed:false}),{indicator:true,closed:false});
  assert.deepEqual(groveRelayState({indicator:false,closed:true}),{indicator:false,closed:true});
  assert.deepEqual(groveRelayState({indicator:true,closed:true}),{indicator:true,closed:true});
});

test('Blender Grove relay exposes six distinct contact objects and a private emissive lens',async()=>{
  const bytes=await readFile(new URL('../dist/models/grove-relay-v12.glb',import.meta.url));
  const create=await parseGroveRelayModel(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const {root,lens}=create();
  const another=create();
  assert.notStrictEqual(lens.material,another.lens.material);
  assert.strictEqual(lens.geometry,another.lens.geometry);
  root.updateMatrixWorld(true);
  for(const {id,x,y,z,connector} of groveRelayVisual.pins){
    const head=connector==='screw'?new Vector3(x,3,groveRelayVisual.screw.z):new Vector3(x,3,z);
    const hit=new Raycaster(head,new Vector3(0,-1,0)).intersectObject(root,true)[0];
    assert.equal(hit?.object.userData.relayTerminal,id,`top-facing ${id} target`);
    if(connector==='screw'){
      const side=new Raycaster(new Vector3(x,y,2),new Vector3(0,0,-1)).intersectObject(root,true)[0];
      assert.equal(side?.object.userData.relayTerminal,id,`forward screw mouth ${id} target`);
    }
  }
});
