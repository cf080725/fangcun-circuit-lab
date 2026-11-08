import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {parseEmbeddedBoard} from '../dist/board-glb.js';

test('PDV-P8103 Blender model has a clipped upward optical face and removable native leads',async()=>{
  const file=await readFile(new URL('../dist/models/pdv-p8103.glb',import.meta.url));
  const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const scene=await parseEmbeddedBoard(bytes);
  const root=scene.getObjectByName('PDV_P8103_COMMON');
  const body=root.getObjectByName('PDV_P8103_BODY');
  const nativeLeads=root.getObjectByName('PDV_P8103_NATIVE_LEADS');
  root.updateMatrixWorld(true);
  const closeTo=(actual,expected)=>{
    assert.ok(Math.abs(actual-expected)<.0001,`${actual} must match ${expected}`);
  };

  const bounds=new Box3().setFromObject(body);
  closeTo(bounds.max.x-bounds.min.x,.51);
  closeTo(bounds.max.z-bounds.min.z,.43);
  closeTo(bounds.min.y,0);
  closeTo(bounds.max.y,.20);
  const downward=new Vector3(0,-1,0);
  const face=new Raycaster(new Vector3(0,.4,-.005),downward).intersectObject(body,true);
  assert.equal(face[0].object.name,'PDV_P8103_EPOXY_FACE');
  assert.ok(face[0].object.material.transparent);
  closeTo(face[0].point.y,.20);
  assert.ok(face.some(hit=>hit.object.name==='PDV_P8103_CDS_TRACK'));
  const clippedCorner=new Raycaster(new Vector3(.23,.4,.19),downward);
  assert.equal(clippedCorner.intersectObject(body,true).length,0);

  for(const [index,x] of [-.17,.17].entries()){
    const lead=nativeLeads.getObjectByName(`PDV_P8103_LEAD_${index+1}`);
    assert.equal(lead.userData.Endpoint.length,3);
    closeTo(lead.userData.Endpoint[0],x);
    closeTo(lead.userData.Endpoint[1],0);
    closeTo(lead.userData.Endpoint[2],0);
    const leadBounds=new Box3().setFromObject(lead);
    closeTo(leadBounds.min.y,-3);
    closeTo(leadBounds.max.z-leadBounds.min.z,.05);
    const ray=new Raycaster(new Vector3(x,-.40,.20),new Vector3(0,0,-1));
    assert.ok(ray.intersectObject(root,true)[0]?.object===lead,`radial lead ${index+1}`);
  }
  nativeLeads.removeFromParent();
  closeTo(new Box3().setFromObject(root).min.y,0);
});
