import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEmbeddedBoard} from '../dist/board-glb.js';
import {componentPins,sevenSegmentIntensity,sevenSegmentPinDescription,sevenSegmentVisual} from '../dist/model-renderer.js';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';

const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} ≠ ${expected}`);

test('the SC56 Blender case, eight recessed lenses and ten real leads match the renderer footprint',async()=>{
  const bytes=await readFile(new URL('../dist/models/sevenseg-sc56.glb',import.meta.url));
  const scene=await parseEmbeddedBoard(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  scene.updateMatrixWorld(true);
  const root=scene.getObjectByName('SC56_COMMON');
  const body=root.getObjectByName('SC56_BODY'),leads=root.getObjectByName('SC56_LEADS');
  const size=new Box3().setFromObject(body,true).getSize(new Vector3());
  near(size.x,sevenSegmentVisual.width,'case width');
  near(size.y,sevenSegmentVisual.height,'case height');
  near(size.z,sevenSegmentVisual.depth,'case depth');
  const loose={type:'sevenseg'},mounted={...loose,mount:{hole:'bb:g11',rotation:0}};
  const contacts=componentPins(loose);
  assert.deepEqual(componentPins(mounted),contacts);
  assert.deepEqual(contacts.map(({id,number})=>[id,number]),[
    ['e',1],['d',2],['COM',3],['c',4],['dp',5],['g',10],['f',9],['COM2',8],['a',7],['b',6]
  ]);
  for(const {id,number,x,z} of contacts){
    const lead=leads.getObjectByName('Pin_'+number);
    const box=new Box3().setFromObject(lead,true),center=box.getCenter(new Vector3());
    near(center.x,x,id+' lead X');
    near(center.z,z,id+' lead Z');
    near(box.min.y,-sevenSegmentVisual.leadLength,id+' tip depth');
  }
  const lenses=root.getObjectByName('SC56_LENSES');
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  for(const name of ['a','b','c','d','e','f','g','dp']){
    const lens=lenses.getObjectByName('Segment_'+name);
    assert.ok(lens.isMesh&&lens.material.emissive,name+' has an independent emissive mesh');
    const center=new Box3().setFromObject(lens,true).getCenter(new Vector3());
    ray.ray.origin.set(center.x,2,center.z);
    assert.equal(ray.intersectObjects([body,lens],true)[0]?.object,lens,name+' is visible through the real aperture');
  }
});

test('both views use current-derived intensity and preserve the pin numbers and common aliases',()=>{
  const result={segments:{a:{currentMa:3.5,brightness:.5,displayBrightness:.25},b:{brightness:.8,displayBrightness:0},g:{brightness:1.2}}};
  assert.equal(sevenSegmentIntensity(result,'a'),.25);
  assert.equal(sevenSegmentIntensity(result,'b'),0);
  assert.equal(sevenSegmentIntensity(result,'g'),1);
  assert.equal(sevenSegmentIntensity(result,'dp'),0);
  const part={type:'sevenseg'},pins=componentPins(part);
  assert.match(sevenSegmentPinDescription(part,pins.find(pin=>pin.id==='COM')),/3 脚 · 公共阴极 COM$/);
  assert.match(sevenSegmentPinDescription({...part,common:'anode'},pins.find(pin=>pin.id==='COM2')),/8 脚 · 公共阳极 COM2$/);
});
