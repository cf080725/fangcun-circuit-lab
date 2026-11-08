import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {parseEmbeddedBoard} from '../dist/board-glb.js';

async function loadSwitch(){
  const data=await readFile(new URL('../dist/models/dip-switch-a6d.glb',import.meta.url));
  const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const scene=await parseEmbeddedBoard(bytes);
  const root=scene.getObjectByName('A6D_COMMON');
  assert.ok(root);
  root.updateMatrixWorld(true);
  return root;
}

function closeTo(actual,expected){
  assert.ok(Math.abs(actual-expected)<.001,`expected ${expected}, received ${actual}`);
}

function firstHit(root,origin,direction){
  const ray=new Raycaster(new Vector3(...origin),new Vector3(...direction));
  return ray.intersectObject(root,true)[0];
}

function belongsTo(hit,group){
  for(let object=hit?.object;object;object=object.parent) if(object===group) return true;
  return false;
}

test('Blender A6D housing and eight stamped terminals match the seating datum and footprint',async()=>{
  const root=await loadSwitch();
  const housing=root.getObjectByName('A6D_BODY');
  const body=new Box3().setFromObject(housing);
  closeTo(body.max.x-body.min.x,1.22);
  closeTo(body.max.z-body.min.z,.66);
  closeTo(body.min.y,.10);
  closeTo(body.max.y,.44);

  const leads=root.getObjectByName('A6D_NATIVE_LEADS');
  assert.equal(leads.children.length,8);
  for(const sign of [1,-1]){
    for(let column=0;column<4;column++){
      const number=sign===1?column+1:8-column;
      const x=(column-1.5)*.254;
      const lead=leads.getObjectByName(`A6D_LEAD_${number}`);
      assert.ok(lead?.isMesh);
      closeTo(new Box3().setFromObject(lead).min.y,-.36);
      const [leadX,leadY,leadZ]=lead.userData.Endpoint;
      closeTo(leadX,x);
      closeTo(leadY,0);
      closeTo(leadZ,sign*.381);
      const hit=firstHit(root,[x,-.16,sign*.7],[0,0,-sign]);
      assert.ok(hit?.object===lead,`physical terminal ${number}`);
    }
  }
});

test('Blender A6D four recessed sliders can be hit at both stops independently',async()=>{
  const root=await loadSwitch();
  const cover=root.getObjectByName('A6D_RECESSED_COVER');
  const sliderNodes=Array.from({length:4},(_,index)=>root.getObjectByName(`A6D_SLIDER_${index+1}`));
  const onTrack=(x,z)=>firstHit(root,[x,1,z],[0,-1,0]);

  for(const [index,slider] of sliderNodes.entries()){
    const x=(index-1.5)*.254;
    closeTo(slider.position.x,x);
    closeTo(slider.position.y,.415);
    closeTo(slider.position.z,.070);
    assert.ok(belongsTo(onTrack(x,.070),slider),`actuator ${index+1} at OFF`);
    const recess=onTrack(x,-.070);
    assert.ok(recess&&recess.point.y<.35&&recess.object!==cover,`open recessed track ${index+1}`);
    slider.position.z-=.140;
    root.updateMatrixWorld(true);
    assert.ok(belongsTo(onTrack(x,-.070),slider),`actuator ${index+1} at ON`);
    assert.ok(!belongsTo(onTrack(x,.070),slider),`actuator ${index+1} left its OFF point`);
    for(const unmoved of sliderNodes.slice(index+1)) closeTo(unmoved.position.z,.070);
  }
});
