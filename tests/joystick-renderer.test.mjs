import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {joystickPins} from '../dist/analog-joystick.js';
import {parseJoystickSparkFunModel} from '../dist/joystick-sparkfun-model.js';
import {componentPins,joystickVisual,moveJoystickCap,pointerIntent,releaseJoystickCap,startJoystickDrag} from '../dist/model-renderer.js';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';

test('joystick cap drag uses two axes and a radial limit, then springs to center once', () => {
  const drag=startJoystickDrag('joystick1',{clientX:100,clientY:100});
  const sent=[];
  const send=(id,pose)=>{assert.equal(id,'joystick1');sent.push(pose);};
  moveJoystickCap(drag,{clientX:102,clientY:99},send);
  assert.deepEqual(sent,[]);
  moveJoystickCap(drag,{clientX:120,clientY:90},send);
  assert.deepEqual(sent,[{x:.5,y:.25}]);
  moveJoystickCap(drag,{clientX:200,clientY:0},send);
  assert.ok(Math.abs(sent.at(-1).x-Math.SQRT1_2)<1e-12);
  assert.ok(Math.abs(Math.hypot(sent.at(-1).x,sent.at(-1).y)-1)<1e-12);
  releaseJoystickCap(drag,send);
  releaseJoystickCap(drag,send);
  assert.deepEqual(sent.at(-1),{x:0,y:0});
  assert.equal(sent.length,3);
});

test('joystick drag inverts rotated or foreshortened screen axes and leaves the switch independent', () => {
  const start={clientX:100,clientY:100};
  const axes={xx:0,xy:-2,yx:1,yy:0};
  const held=startJoystickDrag('joystick1',start,{x:0,y:0,pressed:true},axes);
  const sent=[];
  const send=(_id,pose)=>sent.push(pose);
  moveJoystickCap(held,{clientX:110,clientY:110},send);
  assert.deepEqual(sent,[{x:.25,y:.5}]);
  releaseJoystickCap(held,send);
  assert.deepEqual(sent.at(-1),{x:0,y:0});
  const unaccepted=startJoystickDrag('joystick1',start,{x:0,y:.35,pressed:true});
  moveJoystickCap(unaccepted,{clientX:130,clientY:100},()=>false);
  releaseJoystickCap(unaccepted,send);
  assert.equal(sent.length,2,'a tap or rejected movement does not clear an independent held preset');
});

test('only the joystick cap in Select moves the axes and its physical pads retain circuit IDs', () => {
  const cap={id:'joystick1',kind:'joystick-cap'};
  const body={id:'joystick1',kind:'component'};
  const pin={id:'joystick1',kind:'pin',endpoint:'joystick1:HORIZ'};
  assert.equal(pointerIntent(cap),'adjust-joystick');
  assert.equal(pointerIntent(cap,{mode:'move'}),'drag');
  assert.equal(pointerIntent(cap,{altKey:true}),'drag');
  assert.equal(pointerIntent(cap,{mode:'wire'}),'select');
  assert.equal(pointerIntent(cap,{pendingPin:'mcu:PA0'}),'select');
  assert.equal(pointerIntent(cap,{reconnecting:true}),'select');
  assert.equal(pointerIntent(cap,{spacePan:true}),'pan');
  assert.equal(pointerIntent(body),'drag');
  assert.equal(pointerIntent(pin,{mode:'wire'}),'wire');
  const pins=componentPins({type:'joystick'});
  assert.deepEqual(pins.map(pin=>pin.id),joystickPins);
  assert.deepEqual(pins.map(pin=>pin.x),[-.508,-.254,0,.254,.508]);
  assert.ok(pins.every(pin=>pin.y===.355&&pin.z===1.4605));
});

test('Blender joystick has five visible registered pads and independent stick and plunger transforms', async () => {
  const bytes=await readFile(new URL('../dist/models/joystick-sparkfun.glb',import.meta.url));
  const create=await parseJoystickSparkFunModel(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const {root,stick,plunger,cap}=create();
  root.updateMatrixWorld(true);
  for(const {id,x,y,z} of componentPins({type:'joystick'})){
    const pad=root.getObjectByName('JOYSTICK_CONTACT_'+id);
    assert.deepEqual(pad.userData.Endpoint,[x,y,z]);
    const hit=new Raycaster(new Vector3(x+.067,3,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];
    assert.equal(hit?.object.userData.joystickTerminal,id);
  }
  const body=root.getObjectByName('JOYSTICK_BODY');
  const initialBody=new Box3().setFromObject(body);
  const initialCap=new Box3().setFromObject(cap);
  const initialTop=initialCap.max.y;
  assert.ok(Math.abs(initialTop-joystickVisual.capTop)<.002);
  plunger.position.y-=joystickVisual.pressTravel;
  root.updateMatrixWorld(true);
  assert.ok(Math.abs(new Box3().setFromObject(cap).max.y-initialTop+joystickVisual.pressTravel)<.002);
  stick.rotation.z=-joystickVisual.tiltDegrees*Math.PI/180;
  root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(cap).max.x-initialCap.max.x>.25);
  assert.ok(initialBody.equals(new Box3().setFromObject(body)));
  assert.ok(Math.abs(create().stick.rotation.z)<1e-9);
});
