import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEmbeddedBoard} from '../dist/board-glb.js';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {componentPins,mcp9808Observation,mcp9808PinDescription,mcp9808Visual} from '../dist/model-renderer.js';

const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} ≠ ${expected}`);

test('the #5027 Blender board has real bores, package contacts and both open STEMMA QT sockets',async()=>{
  const bytes=await readFile(new URL('../dist/models/mcp9808-5027.glb',import.meta.url));
  const scene=await parseEmbeddedBoard(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  scene.updateMatrixWorld(true);
  const root=scene.getObjectByName('MCP9808_5027_COMMON'),board=root.getObjectByName('MCP9808_PCB');
  const {width,depth,pcbTop,header,mounts,chip,powerLed}=mcp9808Visual;
  const size=new Box3().setFromObject(board,true).getSize(new Vector3());
  near(size.x,width,'PCB width');
  near(size.z,depth,'PCB depth');
  near(size.y,pcbTop,'PCB thickness');
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  const hit=(x,z,object)=>{ray.ray.origin.set(x,1,z);return ray.intersectObject(object,true);};
  const plating=root.getObjectByName('MCP9808_PLATED_BORES');
  for(const [x,z] of [...mounts,...header.map(pin=>[pin.x,pin.z])]){
    assert.equal(hit(x,z,board).length,0,'actual drilled PCB opening');
    assert.equal(hit(x,z,plating).length,0,'plating leaves the bore open');
  }
  assert.ok(hit(0,0,board).length>0,'solid PCB beneath chip');
  const packageBody=root.getObjectByName('MCP9808_MSOP8_BODY');
  const packageSize=new Box3().setFromObject(packageBody,true).getSize(new Vector3());
  near(packageSize.x,chip.width,'MSOP width');
  near(packageSize.z,chip.depth,'MSOP depth');
  const leads=root.getObjectByName('MCP9808_MSOP8_GULLWING_LEADS');
  for(const x of [-.22,.22])for(const z of [-.0975,-.0325,.0325,.0975]){
    assert.ok(hit(x,z,leads).length>0,'gullwing contact physically present');
  }
  const lens=root.getObjectByName('MCP9808_POWER_LED_LENS');
  const position=new Box3().setFromObject(lens,true).getCenter(new Vector3());
  near(position.x,powerLed.x,'actual power LED X');
  near(position.z,powerLed.z,'actual power LED Z');
  for(const [side,name] of [[-1,'LEFT'],[1,'RIGHT']]){
    const shell=root.getObjectByName('MCP9808_JST_SH_'+name+'_HOUSING');
    const contacts=root.getObjectByName('MCP9808_JST_SH_'+name+'_CONTACTS');
    ray.ray.origin.set(side*2,pcbTop+.187,0);
    ray.ray.direction.set(-side,0,0);
    const mouth=ray.intersectObject(shell,true)[0];
    assert.ok(mouth&&Math.abs(mouth.point.x)<.91,'connector mouth is open through the molded side');
    for(const z of [-.15,-.05,.05,.15]){
      ray.ray.origin.set(side*2,pcbTop+.102,z);
      assert.ok(ray.intersectObject(contacts,true).length>0,'connector contains a real metal contact');
    }
  }
});

test('the four wire endpoints and converted vs environmental readout remain distinct',()=>{
  const pins=componentPins({type:'mcp9808'});
  assert.deepEqual(pins.map(({id})=>id),['VIN','GND','SCL','SDA']);
  for(const [i,{x,y,z}] of pins.entries()){
    near(x,(i-2.5)*.254,'header X');
    near(z,.635,'header Z');
    near(y,.163,'upper solder pad');
  }
  assert.match(mcp9808PinDescription(pins[3]),/SDA.*I²C 双向数据/);
  assert.equal(mcp9808Observation({powered:true,temperatureC:24.0625,targetTemperatureC:24.09}),
    '转换值 24.0625 °C · 环境设定 24.09 °C');
  assert.equal(mcp9808Observation({powered:true,temperatureC:-5.1875,targetTemperatureC:-5.19}),
    '转换值 -5.1875 °C · 环境设定 -5.19 °C');
  assert.equal(mcp9808Observation({powered:false,temperatureC:24},{temperatureC:20}),
    '未供电 · 环境设定 20 °C');
  assert.equal(mcp9808Observation({powered:true,temperatureC:null,targetTemperatureC:20}),
    '等待转换 · 环境设定 20 °C');
});
