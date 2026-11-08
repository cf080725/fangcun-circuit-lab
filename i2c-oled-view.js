import {createSsd1306Raster} from './model-renderer.js';
import {mountI2cTrace} from './i2c-trace.js';

const pixelCount=128*64;
let lastFrame, lastCount=0;
export function oledLitPixels(frame){
  if(lastFrame===frame)return lastCount;
  lastFrame=frame;
  lastCount=0;
  for(const value of frame??[]){
    let byte=value;
    while(byte){byte&=byte-1;lastCount++;}
  }
  return lastCount;
}
export function oledVisiblePixels(screen){
  if(!screen?.powered||!screen.displayOn)return 0;
  if(screen.entireDisplayOn)return pixelCount;
  const lit=oledLitPixels(screen.framebuffer);
  return screen.inverse?pixelCount-lit:lit;
}

export function mountI2cOledMonitor(panel){
  const raster=createSsd1306Raster(panel.querySelector('canvas'));
  const renderTrace=mountI2cTrace(panel);
  return (screen,packets)=>{
    raster.paint(screen);
    renderTrace(packets);
  };
}
