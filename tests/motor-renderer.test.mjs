import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEmbeddedBoard} from '../dist/board-glb.js';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {PARTS} from '../dist/circuit.js';
import {componentPins,drv8833PinDescription,drv8833Visual,fa130Visual,motorMotion} from '../dist/model-renderer.js';

const near=(actual,expected,description)=>assert.ok(Math.abs(actual-expected)<.002,`${description}: ${actual} ≠ ${expected}`);

test('the FA-130 Blender shaft and real solder tabs align with the workbench',async()=>{
  const bytes=await readFile(new URL('../dist/models/motor-fa130.glb',import.meta.url));
  const asset=await parseEmbeddedBoard(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const root=asset.getObjectByName('FA130_COMMON');
  const body=root.getObjectByName('FA130_BODY'),rotor=root.getObjectByName('FA130_ROTOR');
  const shaft=rotor.getObjectByName('FA130_2MM_STEEL_SHAFT');
  const mark=rotor.getObjectByName('FA130_SHAFT_MOTION_MARK');
  root.updateMatrixWorld(true);
  assert.equal(mark.parent,rotor);
  assert.equal(body.parent,root);
  near(rotor.position.y,fa130Visual.axisY,'shaft centre height');
  near(new Box3().setFromObject(shaft,true).min.z,fa130Visual.noseZ,'shaft nose');
  near(new Box3().setFromObject(body,true).getSize(new Vector3()).x,fa130Visual.width,'steel housing width');
  const markerPosition=new Box3().setFromObject(mark,true).getCenter(new Vector3());
  const stationary=body.matrixWorld.clone();
  rotor.rotation.z=Math.PI/2;root.updateMatrixWorld(true);
  assert.ok(body.matrixWorld.equals(stationary));
  assert.ok(markerPosition.distanceTo(new Box3().setFromObject(mark,true).getCenter(new Vector3()))>.025);
  const motor={type:'motor',motorModel:'fa130-18100'};
  const contacts=componentPins(motor);
  assert.deepEqual(contacts.map(pin=>pin.id),['+','-']);
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  for(const {id,x,y,z} of contacts){
    const tab=body.getObjectByName(id==='+'?'FA130_POSITIVE_SOLDER_TAB':'FA130_NEGATIVE_SOLDER_TAB');
    ray.ray.origin.set(x,2,z);
    assert.equal(ray.intersectObject(tab).length,0,id+' socket eye is open');
    ray.ray.origin.set(x,2,z+.052);
    const hit=ray.intersectObject(tab)[0];
    assert.ok(hit&&Math.abs(hit.point.y-y)<.025,id+' eye rim is at the endpoint height');
  }
  assert.ok(componentPins({type:'motor'})[0].x<0,'generic saved motor keeps its original endpoints');
});

test('the Pololu carrier has two correctly ordered, spaced rows and sixteen distinct endpoints',()=>{
  const pins=componentPins({type:'drv8833'}),ids=pins.map(pin=>pin.id);
  near(drv8833Visual.width,1.27,'PCB width');
  near(drv8833Visual.depth,2.032,'PCB length');
  assert.deepEqual(ids.slice(0,8),['GND2','VMM','BIN1','BIN2','AIN2','AIN1','SLP','FLT']);
  assert.deepEqual(ids.slice(8),['GND','VIN','BOUT1','BOUT2','AOUT2','AOUT1','AISEN','BISEN']);
  assert.equal(new Set(ids).size,16);
  assert.deepEqual(new Set(ids),new Set(PARTS.drv8833.pins));
  for(let row=0;row<2;row++)for(let index=0;index<8;index++){
    const {x,z}=pins[row*8+index];
    near(x,row?.508:-.508,'header column');
    near(z,(index-3.5)*.254,'header pitch');
  }
  assert.match(drv8833PinDescription(pins[0]),/GND.*参考地/);
  assert.match(drv8833PinDescription(pins[9]),/VIN.*电机电源输入/);
});

test('both views use actual angle and signed speed, with a blur threshold',()=>{
  assert.deepEqual(motorMotion({angleDeg:218,rpm:-12300}),{angle:218,blur:true,speed:'−12,300 rpm',direction:'反向'});
  assert.deepEqual(motorMotion({angleDeg:0,rpm:480}),{angle:0,blur:true,speed:'+480 rpm',direction:'正向'});
  assert.equal(motorMotion({angleDeg:90,rpm:479}).blur,false);
  assert.equal(motorMotion({angleDeg:80,rpm:-.2}).speed,'0 rpm');
  assert.equal(motorMotion({angleDeg:NaN,rpm:NaN}).angle,null);
  assert.equal(motorMotion(null).direction,'暂无读数');
});
