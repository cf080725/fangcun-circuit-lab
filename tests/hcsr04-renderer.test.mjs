import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEmbeddedBoard} from '../dist/board-glb.js';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {componentPins,hcsr04Observation,hcsr04PinDescription,hcsr04Visual} from '../dist/model-renderer.js';

const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} ≠ ${expected}`);

test('the Blender HC-SR04 has actual open mesh, drill bores and four matching header contacts',async()=>{
  const bytes=await readFile(new URL('../dist/models/hcsr04.glb',import.meta.url));
  const scene=await parseEmbeddedBoard(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const root=scene.getObjectByName('HCSR04_COMMON'),pcb=root.getObjectByName('HCSR04_PCB');
  scene.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(pcb,true),size=bounds.getSize(new Vector3());
  near(size.x,hcsr04Visual.width,'PCB width');
  near(size.z,hcsr04Visual.depth,'PCB depth');
  near(bounds.min.y,hcsr04Visual.baseY,'board underside');
  near(bounds.max.y,hcsr04Visual.topY,'board face');

  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  const hit=(x,z,object)=>{ray.ray.origin.set(x,3,z);return ray.intersectObject(object,true);};
  for(const [x,z] of hcsr04Visual.holes)assert.equal(hit(x,z,pcb).length,0,'real mounting bore');
  assert.ok(hit(0,0,pcb).length>0,'solid PCB between holes');

  const pins=componentPins({type:'hcsr04'});
  assert.deepEqual(pins.map(pin=>pin.id),['VCC','TRIG','ECHO','GND']);
  for(const [index,{id,x,y,z}] of pins.entries()){
    const node=root.getObjectByName('HCSR04_PIN_'+id);
    const pinBounds=new Box3().setFromObject(node,true),center=pinBounds.getCenter(new Vector3());
    near(x,(index-1.5)*.254,id+' 2.54 mm pitch');
    near(center.x,x,id+' contact X');
    near(center.z,z,id+' contact Z');
    near(pinBounds.max.y,y,id+' upper solder endpoint');
    assert.equal(hit(x,z,pcb).length,0,id+' actual board drill');
    assert.ok(pinBounds.min.y<hcsr04Visual.baseY-.3,id+' extends through underside header');
  }

  for(const [index,{x,z}] of hcsr04Visual.transducers.entries()){
    const name='HCSR04_'+(index===0?'TRANSMITTER':'RECEIVER');
    const can=root.getObjectByName(name+'_OPEN_CAN');
    const guard=root.getObjectByName(name+'_PERFORATED_SCREEN');
    const membrane=root.getObjectByName(name+'_RECESSED_MEMBRANE');
    near(hit(x+.753,z,can)[0]?.point.y,hcsr04Visual.rimY,'aluminium rim height');
    assert.equal(hit(x,z,can).length,0,'open cylinder face');
    assert.ok(hit(x,z,guard).length>0,'woven wires have physical surface');
    assert.equal(hit(x+.0245,z+.0245,guard).length,0,'gap is open between woven wires');
    near(hit(x+.0245,z+.0245,membrane)[0]?.point.y,hcsr04Visual.rimY-.157,'recess below guard');
  }
});

test('sonar cues reflect the live pulse, and show the completed width without keeping the cue active',()=>{
  assert.deepEqual(hcsr04Observation({powered:true,status:'emitting',echoLevel:0}),
    {transmitting:true,receiving:false,text:'T 发射 · 40 kHz 超声'});
  assert.deepEqual(hcsr04Observation({powered:true,status:'echo-high',echoLevel:1}),
    {transmitting:false,receiving:true,text:'R 接收 · ECHO 高电平'});
  assert.equal(hcsr04Observation({powered:true,status:'echo-high',echoLevel:null}).receiving,false);
  assert.deepEqual(hcsr04Observation({powered:true,status:'complete',echoLevel:0,echoWidthUs:4664.7}),
    {transmitting:false,receiving:false,text:'最近回波 4665 µs'});
  assert.equal(hcsr04Observation({powered:true,status:'no-target'}).text,'未收到回波');
  assert.match(hcsr04PinDescription(hcsr04Visual.pins[2]),/ECHO.*5 V.*3.3 V.*分压/);
});
