import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEmbeddedBoard} from '../dist/board-glb.js';
import {Box3,Raycaster,Vector3} from '../dist/vendor/three.module.js';
import {componentPins,createSsd1306Raster,ssd1306PinDescription,ssd1306Visual} from '../dist/model-renderer.js';

const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<.002,`${label}: ${actual} ≠ ${expected}`);

test('Adafruit #326 Blender outline, physical bores, panel and both rear sockets follow the original CAD',async()=>{
  const bytes=await readFile(new URL('../dist/models/ssd1306-326.glb',import.meta.url));
  const scene=await parseEmbeddedBoard(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  scene.updateMatrixWorld(true);
  const root=scene.getObjectByName('OLED326_COMMON'),board=root.getObjectByName('OLED326_PCB');
  const {width,depth,topY,baseY,header,mounts,active,glass}=ssd1306Visual;
  const bounds=new Box3().setFromObject(board,true),size=bounds.getSize(new Vector3());
  near(size.x,width,'PCB width');
  near(size.z,depth,'PCB depth with the lower mounting ears');
  near(bounds.min.y,baseY,'PCB underside');
  near(bounds.max.y,topY,'PCB top');
  const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));
  const hit=(x,z,object)=>{ray.ray.origin.set(x,2,z);return ray.intersectObject(object,true);};
  const plating=root.getObjectByName('OLED326_PLATED_BORES');
  for(const [x,z] of [...mounts,...header.map(pin=>[pin.x,pin.z])]){
    assert.equal(hit(x,z,board).length,0,'physical board bore is open');
    assert.equal(hit(x,z,plating).length,0,'plated bore is open');
  }
  assert.ok(hit(0,0,board).length>0,'solid middle PCB');
  assert.equal(hit(0,1.35,board).length,0,'lower mounting-ear gap');

  const display=root.getObjectByName('OLED326_GLASS_STACK');
  const screen=root.getObjectByName('OLED326_PIXEL_PLANE');
  const glassBox=new Box3().setFromObject(display,true),glassSize=glassBox.getSize(new Vector3());
  near(glassSize.x,glass.width,'glass width');
  near(glassSize.z,glass.depth,'glass depth');
  near(glassBox.max.y,glass.topY,'glass top');
  const screenBox=new Box3().setFromObject(screen,true),screenSize=screenBox.getSize(new Vector3());
  near(screenSize.x,active.width,'active pixel width');
  near(screenSize.z,active.depth,'active pixel depth');
  near(screenBox.getCenter(new Vector3()).z,active.z,'active pixel centre');
  near(hit(0,active.z,screen)[0]?.point.y,active.y,'the panel surface faces upward');

  for(const [side,name] of [[-1,'LEFT'],[1,'RIGHT']]){
    const shell=root.getObjectByName('OLED326_JST_SH_'+name+'_HOUSING');
    const contacts=root.getObjectByName('OLED326_JST_SH_'+name+'_CONTACTS');
    ray.ray.origin.set(side*2,.185,-.0635);
    ray.ray.direction.set(-side,0,0);
    const mouth=ray.intersectObject(shell,true)[0];
    assert.ok(mouth&&Math.abs(mouth.point.x)<1.11,'JST receptacle has an open side and recessed stop');
    for(const offset of [-.15,-.05,.05,.15]){
      ray.ray.origin.set(side*2,.117,-.0635+offset);
      assert.ok(ray.intersectObject(contacts,true).length>0,'each receptacle has four metal contacts');
    }
  }
});

test('only the four original I²C and power holes are wire endpoints',()=>{
  const pins=componentPins({type:'ssd1306'});
  assert.deepEqual(pins.map(({id,label,x})=>[id,label,Math.round(x*1000)/1000]),[
    ['SDA','Data',-.889],['SCL','Clk',-.635],['VIN','VIN',.635],['GND','GND',.889]
  ]);
  assert.match(ssd1306PinDescription(pins[0]),/SDA.*Data.*I²C/);
});

test('one persistent raster honors pixel pages, brightness, inverse, all-on, off and unchanged inputs',()=>{
  let paints=0,image;
  const canvas={getContext:()=>({
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:next=>{paints++;image=next.data;}
  })};
  const raster=createSsd1306Raster(canvas);
  const frame=new Uint8Array(1024);
  frame[0]=1;frame[128*3+78]=1<<5;
  const reading={powered:true,displayOn:true,framebuffer:frame,contrast:255};
  const red=(x,y)=>image[4*(y*128+x)];
  assert.equal(raster.paint(reading),true);
  assert.deepEqual([canvas.width,canvas.height,raster.litCount],[128,64,2]);
  assert.ok(red(0,0)>red(0,63) && red(78,29)>red(78,28));
  assert.equal(raster.paint({...reading}),false);
  assert.equal(paints,1);
  raster.paint({...reading,contrast:0});
  assert.ok(red(0,0)>red(0,63) && red(0,0)<100);
  raster.paint({...reading,inverse:true});
  assert.equal(raster.litCount,8190);
  raster.paint({...reading,entireDisplayOn:true,inverse:true});
  assert.equal(raster.litCount,8192);
  raster.paint({...reading,displayOn:false});
  assert.equal(raster.litCount,0);
  raster.paint(reading);
  assert.equal(raster.litCount,2);
  raster.paint({...reading,powered:false});
  assert.equal(raster.litCount,0);
});
