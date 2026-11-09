import { PARTS } from './circuit.js';
import { getBoardProfile } from './board-profiles.js';
import { esp32BenchVisual } from './board-inspection-geometry.js';
import { encoderVisual, encoderPinDescription, encoderAppearance, moveEncoderShaft } from './model-renderer.js';
import { joystickVisual, joystickPinDescription, joystickAppearance, startJoystickDrag, moveJoystickCap, releaseJoystickCap } from './model-renderer.js';
import { pdvPhotoresistorVisual } from './model-renderer.js';
import { rgbLedVisual, rgbLedPinDescription, rgbLedLight } from './model-renderer.js';
import { nearCompactAdjuster } from './model-renderer.js';
import { groveRelayVisual, groveRelayPinDescription, groveRelayState } from './model-renderer.js';
import { boardVisual, genericModuleVisual, visualBounds, resistorVisual, formatResistance, formatCapacitance, componentPin, componentPins, componentLabel, sevenSegmentVisual, sevenSegmentIntensity, sevenSegmentPinDescription, drv8833Visual, drv8833PinDescription, fa130Visual, motorMotion, hcsr04Visual, hcsr04PinDescription, hcsr04Observation, ssd1306Visual, ssd1306PinDescription, createSsd1306Raster, mcp9808Visual, mcp9808PinDescription, mcp9808Observation, selectionDescriptor, pointerIntent, boardResetTap, sceneRotationStep, isSecondPinTap, wireGestureState, connectionPlan, directionalEndpoint, boardHoleKeyAction, snapToBreadboard } from './model-renderer.js';
import { pointerInsideSurface } from './model-renderer.js';
import { closestWireSegment, compareWireHits, distinctPickTargets } from './wire-picking.js';
import { boardPose, rotateBoardPoint, signalHole, signalPitch, signalStrip } from './breadboard-mount.js';
import { mountedPartBodyBounds, mountedPartContacts, partPose, sevenSegmentObscuresHole } from './part-mount.js';

/* SVG compatibility renderer. Uses the same explicit electrical endpoints and
   hooks as the 3D workbench; positions are centimetres, rendered at 55 px/cm.
   Placing a part over a breadboard hole does not make an electrical connection. */

const SCALE = 55;
const POT_DRAG_PIXELS = 140;
const COLORS = { red:'#df3d34',green:'#44b55c',yellow:'#efbc28',blue:'#3193e2',white:'#eff6ff' };
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const potPosition = part => Number.isFinite(part.position) ? clamp(part.position,0,1) : .5;
const px = value => Math.round(value * SCALE * 100) / 100;
const HS55_SERVO_PIVOT = px(.53);
const MOTOR_NOSE_VIEW = {x:px(.56),y:px(-1.78)};
let rendererSerial = 0;

export function createWorkbench2D(container, hooks = {}, options = {}) {
  const key = 'stm32flat' + (++rendererSerial) + '-';
  const ref = name => 'url(#' + key + name + ')';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const shell=document.createElement('div');shell.className='workbench-surface';shell.style.cssText='display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:#eef3f3';
  const stage=document.createElement('div');stage.style.cssText='position:relative;flex:1;min-height:0;overflow:hidden';
  const footer=document.createElement('div');footer.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;border-top:1px solid #d2dedb;background:#f7faf8;flex:none';
  const benchHelp='Tab 进入控制栏。[ 和 ] 选择物件。拖住物件时按 R 旋转 90°，Shift+R 反向，松手放置。已插入的开发板可提起转向。F 聚焦所选元件，P 浏览引脚，方向键选引脚，Enter 接线。方向键微移元件，Shift 加速。用中键、右键拖动或打开「平移镜头」来移动视图。Space 按住按钮，A/B 重接导线，Esc 取消。电位器可横拖旋钮或使用属性滑块。';
  const instructions=document.createElement('span');instructions.id=key+'help';instructions.textContent=benchHelp;
  instructions.style.cssText='position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
  const liveRegion=document.createElement('div');liveRegion.style.cssText=instructions.style.cssText;liveRegion.setAttribute('aria-live','polite');liveRegion.setAttribute('aria-atomic','true');
  shell.append(stage,instructions,liveRegion);container.appendChild(shell);
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('role','application');
  svg.setAttribute('aria-keyshortcuts','R Shift+R');
  svg.setAttribute('aria-label','硬件实物俯视实验台。可接线、按按钮、移动元件和缩放。');
  svg.setAttribute('tabindex','0');svg.setAttribute('aria-describedby',instructions.id);
  svg.style.cssText='display:block;width:100%;height:100%;background:#eef3f3;touch-action:none;user-select:none;outline:none';
  const definitions =
    '<defs>' +
    '<linearGradient id="'+key+'pcb" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1c72bb"/><stop offset=".45" stop-color="#07529a"/><stop offset="1" stop-color="#123b77"/></linearGradient>' +
    '<linearGradient id="'+key+'white" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fffef8"/><stop offset=".55" stop-color="#eeeae1"/><stop offset="1" stop-color="#d7d6cd"/></linearGradient>' +
    '<linearGradient id="'+key+'metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5f7f8"/><stop offset=".25" stop-color="#afb6bc"/><stop offset=".52" stop-color="#eef0f1"/><stop offset=".74" stop-color="#8d969d"/><stop offset="1" stop-color="#d1d8dc"/></linearGradient>' +
    '<linearGradient id="'+key+'gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7df8f"/><stop offset=".43" stop-color="#d2a852"/><stop offset=".7" stop-color="#a77c2e"/><stop offset="1" stop-color="#f0ce7c"/></linearGradient>' +
    '<linearGradient id="'+key+'chip" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#313a40"/><stop offset="1" stop-color="#11191e"/></linearGradient>' +
    '<linearGradient id="'+key+'diode-glass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffd4a0"/><stop offset=".40" stop-color="#d77d46"/><stop offset="1" stop-color="#914125"/></linearGradient>' +
    '<linearGradient id="'+key+'resistor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e9dbb9"/><stop offset=".5" stop-color="#c9af7f"/><stop offset="1" stop-color="#e0cfa6"/></linearGradient>' +
    '<linearGradient id="'+key+'servo" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4395d9"/><stop offset=".4" stop-color="#2779bd"/><stop offset="1" stop-color="#14548f"/></linearGradient>' +
    '<radialGradient id="'+key+'led-glass" cx=".32" cy=".25" r=".8"><stop stop-color="#ffffff" stop-opacity=".75"/><stop offset=".23" stop-color="#ffffff" stop-opacity=".12"/><stop offset=".62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".37"/></radialGradient>' +
    '<radialGradient id="'+key+'led-glow"><stop stop-color="#fff8d8" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd976" stop-opacity=".5"/><stop offset="1" stop-color="#ffd976" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="'+key+'black-round" cx=".35" cy=".28" r=".8"><stop stop-color="#4a5358"/><stop offset=".55" stop-color="#252e34"/><stop offset="1" stop-color="#141e24"/></radialGradient>' +
    '<linearGradient id="'+key+'pcb-sheen" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".14"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#001b26" stop-opacity=".23"/></linearGradient>' +
    '<pattern id="'+key+'grid" width="27.5" height="27.5" patternUnits="userSpaceOnUse"><path d="M 27.5 0 L 0 0 0 27.5" fill="none" stroke="#dce5e5" stroke-width=".55"/></pattern>' +
    '<pattern id="'+key+'sensor-screen" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#1d3037"/><path d="M 0 0 H 3 M 0 0 V 3" fill="none" stroke="#778b90" stroke-width=".65"/></pattern>' +
    '<filter id="'+key+'shadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="1" dy="4" stdDeviation="3" flood-color="#183544" flood-opacity=".23"/></filter>' +
    '<filter id="'+key+'tinyshadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx=".5" dy="1.4" stdDeviation=".8" flood-color="#112c39" flood-opacity=".3"/></filter>' +
    '<filter id="'+key+'wire-shadow" x="-30%" y="-50%" width="160%" height="200%"><feDropShadow dx="1" dy="2.5" stdDeviation="1.3" flood-color="#25404a" flood-opacity=".25"/></filter>' +
    '</defs>' +
    '<style>.terminal{cursor:inherit}.terminal .terminal-halo{opacity:0;transition:opacity .12s;pointer-events:none}.terminal .voltage-ring{pointer-events:none}.terminal.is-hovered .terminal-halo,.terminal.is-pending .terminal-halo,.terminal:focus .terminal-halo{opacity:1}.terminal.is-target .voltage-ring{stroke:#0d8f78;stroke-width:2.2;opacity:1}.part-shape:focus .selection-frame{opacity:1}.part-shape:focus,.terminal:focus,.wire-group:focus,.wire-handle:focus{outline:none}.wire-group:focus .wire-visible{stroke-width:4.3}.terminal.is-available .voltage-ring{stroke:#26a58f;stroke-width:1.2;opacity:.7}.terminal.is-pending .voltage-ring{stroke:#da9f20;stroke-width:2;opacity:1}.part-hit{cursor:grab}.part-shape.is-selected .selection-frame{opacity:1}.part-shape .selection-frame{opacity:0;pointer-events:none}.wire-visible{pointer-events:none}.wire-group.is-selected .wire-visible{stroke-width:4.3}.part-shape .fault-mark{opacity:0;pointer-events:none}.part-shape.has-fault .fault-mark{opacity:1}.button-cap{transition:transform .08s;cursor:pointer}.terminal text,.component-label{pointer-events:none}.wire-handle{cursor:crosshair}.scene-zoom-button:hover{background:#e6f2ee!important}.scene-zoom-button:focus-visible{outline:2px solid #289c84;outline-offset:1px}</style>';
  svg.innerHTML=definitions+
    '<rect x="-3000" y="-3000" width="6000" height="6000" fill="#edf2f1"/>'+
    '<rect x="-3000" y="-3000" width="6000" height="6000" fill="'+ref('grid')+'"/>'+
    '<g data-layer="fixed"></g><g data-layer="parts"></g><g data-layer="wires"></g><g data-layer="preview" pointer-events="none"></g><g data-layer="pins"></g><g data-layer="board-hole-picker" pointer-events="none" aria-hidden="true"></g><g data-layer="dock-preview" pointer-events="none"></g><g data-layer="part-placement-preview" pointer-events="none" aria-hidden="true"></g><g data-layer="wire-handles"></g><g data-layer="probes" pointer-events="none" aria-hidden="true"></g>';
  stage.appendChild(svg);
  const fixedLayer=svg.querySelector('[data-layer="fixed"]');
  const partLayer=svg.querySelector('[data-layer="parts"]');
  const wireLayer=svg.querySelector('[data-layer="wires"]');
  const wireSamples=new WeakMap();
  let projectedWireCache=null;
  const pinLayer=svg.querySelector('[data-layer="pins"]');
  const dockPreviewLayer=svg.querySelector('[data-layer="dock-preview"]');
  const boardHolePickerLayer=svg.querySelector('[data-layer="board-hole-picker"]');
  const partPlacementLayer=svg.querySelector('[data-layer="part-placement-preview"]');
  const previewLayer=svg.querySelector('[data-layer="preview"]');
  const handleLayer=svg.querySelector('[data-layer="wire-handles"]');
  const probeLayer=svg.querySelector('[data-layer="probes"]');
  const badge=document.createElement('div');
  badge.textContent=options.reason?'二维接线图 · 3D 当前不可用':'二维接线图';
  badge.title=options.reason||'拖动元件摆放；双击引脚开始接线。接线模式可以点击或拖动两端。选中元件后方向键微移、Shift 加速、R 旋转。';
  badge.style.cssText='color:#4a6861;font:12px/1.4 system-ui,sans-serif;pointer-events:none;flex:1;min-width:145px;position:relative;height:38px;display:flex;align-items:center';
  footer.appendChild(badge);
  const toolbar=document.createElement('div');
  toolbar.style.cssText='display:flex;flex-wrap:wrap;gap:3px;margin-left:auto;align-items:center';toolbar.setAttribute('role','toolbar');
  toolbar.setAttribute('aria-label','实验台缩放和平移');
  const status=document.createElement('div');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.style.cssText='display:block;flex:none;height:48px;box-sizing:border-box;padding:4px 11px;background:#f7faf8;border-top:1px solid #d6e2dc;color:#45685e;font:13px/1.5 system-ui,sans-serif;overflow:hidden';
  const statusLine=document.createElement('div'),statusHint=document.createElement('div');for(const line of [statusLine,statusHint])line.style.cssText='white-space:nowrap;overflow:hidden;text-overflow:ellipsis';statusLine.style.fontWeight='600';status.append(statusLine,statusHint);
  const tooltip=document.createElement('div');
  tooltip.style.cssText='display:none;position:absolute;z-index:25;pointer-events:none;max-width:265px;padding:10px 12px;border-radius:9px;background:#18333bed;color:white;white-space:pre-line;font:13px/1.55 system-ui,sans-serif;box-shadow:0 6px 20px #1d39422b';
  const temperatureReadout=document.createElement('div');
  temperatureReadout.hidden=true;
  temperatureReadout.dataset.mcp9808Readout='';
  temperatureReadout.setAttribute('aria-label','选中温度传感器的仿真读数');
  temperatureReadout.style.cssText='position:absolute;top:10px;left:10px;pointer-events:none;max-width:calc(100% - 20px);padding:5px 8px;background:#f7faf6ee;color:#2c514c;border:1px solid #c7d8ce;border-radius:6px;font:600 12px/1.35 system-ui,sans-serif;font-variant-numeric:tabular-nums';
  stage.appendChild(temperatureReadout);
  const pressControl=document.createElement('button');pressControl.type='button';pressControl.textContent='按住按键';pressControl.hidden=true;pressControl.setAttribute('aria-pressed','false');pressControl.className='scene-zoom-button';pressControl.style.cssText='min-height:38px;padding:0 12px;border:1px solid #8eb6a9;border-radius:6px;color:#275f50;background:#e4f3ec;font:14px system-ui;cursor:pointer;touch-action:none;position:absolute;left:0;top:0;pointer-events:auto';
  badge.appendChild(pressControl);footer.appendChild(toolbar);stage.appendChild(tooltip);shell.append(status,footer);

  const initial={x:px(-6.75),y:px(-3.75),w:px(13.5),h:px(7.5)};
  let view={...initial},circuit=null,result=null,state=null,mode='orbit',selected=null,pendingPin=null,recentPinTap=null,selectedParts=new Set();
  let boardView=null,snapEnabled=true,partPlacementPreview=null,boardHolePicker=null,boardHoleHover=null,boardHoleKeyboard=null;
  let probes={red:null,black:null};
  let connectionPending=false;
  let drag=null,pan=null,down=null,activeButton=null,disposed=false,wireGesture=null,reconnectPending=null,hoverEndpoint=null,spacePan=false,pinch=null,lastPointerPoint=null;
  let connectionError='',keyboardTarget=null,rightPanMoved=false;
  const expectedCaptureRelease=new Set();
  const touches=new Map();
  const endpointMap=new Map();
  const partGroups=new Map();
  const terminalElements=new Map();
  const insertedParts=new Set();
  const occupiedSockets=new Set();
  const mountedSevenSegments=[];
  const oledRasters=new Map();
  const wiredSockets=new Set();

  function applyView(){svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));drawProbes();}
  function home(){
    if(circuit){const bounds=visualBounds(circuit,getBoardProfile(circuit.boardId));view={x:px(bounds.left),y:px(bounds.top),w:px(bounds.width),h:px(bounds.height)};}
    else view={...initial};
    applyView();
  }
  function focusComponent(id){
    const group=partGroups.get(id),rootMatrix=svg.getCTM(),partMatrix=group?.getCTM();
    if(!rootMatrix||!partMatrix)return false;
    const {x,y,width,height}=group.getBBox(),matrix=rootMatrix.inverse().multiply(partMatrix);
    const points=[[x,y],[x+width,y],[x,y+height],[x+width,y+height]]
      .map(([xx,yy])=>new DOMPoint(xx,yy).matrixTransform(matrix));
    const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const ratio=view.h/view.w,w=Math.max(px(3.5),(right-left)*1.35,(bottom-top)*1.35/ratio),h=w*ratio;
    view={x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};
    applyView();
    return true;
  }
  function focusSelection(){return focusComponent(selected);}
  function zoomBy(factor,point=null){
    const center=point||{x:view.x+view.w/2,y:view.y+view.h/2};
    const width=clamp(view.w*factor,px(3.5),px(40)),ratio=width/view.w;
    view={x:center.x-(center.x-view.x)*ratio,y:center.y-(center.y-view.y)*ratio,w:width,h:view.h*ratio};applyView();
  }
  const panBy=(dx,dy)=>{view.x+=view.w*dx;view.y+=view.h*dy;applyView();};
  [['−','缩小',()=>zoomBy(1.25)],['+','放大',()=>zoomBy(.8)],['←','视图向左',()=>panBy(-.12,0)],['↑','视图向上',()=>panBy(0,-.12)],['↓','视图向下',()=>panBy(0,.12)],['→','视图向右',()=>panBy(.12,0)],['适配','适配全部元件',home]].forEach(([name,title,action])=>{
    const button=document.createElement('button');button.textContent=name;button.type='button';button.title=title;button.setAttribute('aria-label',title);
    button.className='scene-zoom-button';button.style.cssText='border:1px solid #cadbd5;background:#fff;min-width:38px;height:38px;padding:0 8px;border-radius:6px;font:'+(name==='适配'?'14':'20')+'px/1 system-ui;color:#294f53;cursor:pointer';
    button.addEventListener('click',event=>{action();renderConnectionPreview();if(event.detail>0)restoreKeyboardFocus();});toolbar.appendChild(button);
  });
  applyView();

  function text(x,y,value,size=7,fill='#eaf4ff',anchor='middle',extra=''){
    return '<text x="'+x+'" y="'+y+'" font-family="Arial,Microsoft YaHei,sans-serif" font-size="'+size+'" fill="'+fill+'" text-anchor="'+anchor+'" dominant-baseline="middle" '+extra+'>'+esc(value)+'</text>';
  }
  function rect(x,y,w,h,fill,r=0,extra=''){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'" '+extra+'/>';}
  function circle(x,y,r,fill,extra=''){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" '+extra+'/>';}
  function line(x1,y1,x2,y2,stroke,width=1,extra=''){return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+stroke+'" stroke-width="'+width+'" '+extra+'/>';}
  function selectionFrame(w,h){return rect(-w/2-6,-h/2-6,w+12,h+12,'none',7,'class="selection-frame" stroke="#19a995" stroke-width="2" stroke-dasharray="5 3"');}
  function faultMark(x,y){return '<g class="fault-mark">'+circle(x,y,6.2,'#df8750','stroke="#fff" stroke-width="1.3"')+text(x,y+.2,'!',8,'#fff','middle','font-weight="700"')+'</g>';}
  function record(endpoint,x,z,componentId,description){
    endpointMap.set(endpoint,{x:x*SCALE,y:z*SCALE,componentId,description});
  }
  function partEndpoint(part,pose,name,x,z,description){
    const rotated=rotateBoardPoint(x,z,pose.rotation);
    record(part.id+':'+name,pose.x+rotated.x,pose.z+rotated.z,part.id,description);
  }

  function boardFeatureMarkup(feature,silk){
    const f=feature,w=px(f.w),h=px(f.h);
    let out='<g transform="translate('+px(f.x)+' '+px(f.z)+') rotate('+(f.rotation||0)+')">';
    if(f.type==='usb'&&f.back){
      out+=rect(-w/2,-h/2,w,4,ref('metal'),1,'stroke="#71838b" stroke-width=".55"');
    }else if(f.type==='usb'){
      out+=rect(-w/2,-h/2,w,h,ref('metal'),f.kind==='B'?4:2.7,'stroke="#71838b" stroke-width=".8" filter="'+ref('tinyshadow')+'"');
      out+=rect(-w/2+3,-h/2-1,w-6,f.kind==='B'?15:9,'#22333d',2,'stroke="#f1f4f3" stroke-width="1"');
      out+=rect(-w*.29,-h/2+2,w*.58,f.kind==='B'?9:3,'#0d202b',1);
      for(let i=0;i<(['A','B'].includes(f.kind)?4:5);i++)out+=rect(-w*.23+i*w*.105,-h/2+4,2.4,f.kind==='B'?4:2.4,ref('gold'),.3);
      out+=rect(-w/2+4,-h/2+12,w-8,h-17,'none',1,'stroke="#6b8088" stroke-width=".6"');
      out+=rect(-w/2+2,h*.10,6,4,'#72838d',1)+rect(w/2-8,h*.10,6,4,'#72838d',1);
      for(const sign of [-1,1])out+=rect(sign<0?-w/2-3:w/2-2,h*.13,5,h*.28,ref('metal'),1,'stroke="#7c9198" stroke-width=".5"')+line(sign*(w/2-1),-h/2+4,sign*(w/2-1),h/2-3,'#f8fbfc',.9);
      out+=line(-w/2+4,h/2-2,w/2-4,h/2-2,'#657b84',.65);
    }else if(f.type==='ethernet'){
      out+=rect(-w/2,-h/2,w,h,ref('metal'),3,'stroke="#859399" stroke-width=".8"');
      out+=rect(-w*.39,-h/2-1,w*.78,px(.22),'#23313a',1);
      for(const sign of [-1,1])out+=line(sign*w*.40,-h*.34,sign*w*.40,h*.39,'#f4f7f6',1.1);
      out+=text(0,3,f.label,6.5,'#62737a');
    }else if(f.type==='sd-slot'){
      out+=rect(-w/2,-h/2,w,h,ref('metal'),2,'stroke="#819199" stroke-width=".7"');
      out+=rect(-w*.43,-h/2-1,w*.86,px(.12),'#233139',1)+text(0,2,f.label,5.7,'#60717a');
    }else if(f.type==='slide-switch'){
      out+=rect(-w/2,-h/2,w,h,ref('metal'),2)+rect(-w*.39,-h*.32,w*.78,h*.64,'#273139',1);
      out+=rect(w*.03,-h*.28,w*.30,h*.56,'#46535a',1)+text(0,h/2+6,f.label,5.3,silk);
    }else if(f.type==='battery-socket'){
      out+=rect(-w/2,-h/2,w,h,'#e3dfca',2)+rect(-w*.40,-h*.27,w*.80,h*.49,'#827a63',1)+text(0,h/2+6,f.label,5.3,silk);
    }else if(f.type==='ic'||f.type==='bga'||f.type==='qfn'){
      const count=f.pinsPerSide||8;
      for(let side=0;f.type==='ic'&&side<4;side++){
        if(f.leadRows===2&&side%2)continue;
        const length=side%2?h:w;
        out+='<g transform="rotate('+(side*90)+')">';
        for(let i=0;i<count;i++)out+=rect((i-(count-1)/2)*(length*.82/count)-.8,-(side%2?w:h)/2-5,1.6,7,ref('metal'),.2);
        out+='</g>';
      }
      out+=rect(-w/2,-h/2,w,h,ref('chip'),1.7,'stroke="#111e24" stroke-width=".7" filter="'+ref('tinyshadow')+'"');
      out+=circle(-w/2+4,-h/2+4,1.6,'#7e898a');
      const label=f.label.length>12?[f.label.slice(0,7),f.label.slice(7)]:[f.label];
      label.forEach((value,i)=>out+=text(0,(i-(label.length-1)/2)*7,value,Math.min(6.4,w/Math.max(5,value.length)*1.3),'#c3ced1'));
    }else if(f.type==='dip'){
      for(let i=0;i<(f.pinsPerSide||14);i++)for(const sign of [-1,1])out+=rect(sign<0?-w/2-5:w/2-1,(i-(f.pinsPerSide-1)/2)*px(.254)-2.0,6,4,ref('metal'),.5);
      out+=rect(-w/2-2,-h/2-2,w+4,h+4,'#1c3038',3,'filter="'+ref('tinyshadow')+'"');
      out+=rect(-w/2,-h/2,w,h,ref('chip'),3,'stroke="#546269" stroke-width=".7"');
      out+='<path d="M -6 '+(-h/2)+' Q 0 '+(-h/2+10)+' 6 '+(-h/2)+'" fill="#101f29"/>';
      out+=text(0,0,f.label,8,'#acb9bd','middle','transform="rotate(-90)"');
    }else if(f.type==='barrel'){
      out+=rect(-w/2,-h/2,w,h,ref('chip'),3,'stroke="#17292f" stroke-width=".8" filter="'+ref('tinyshadow')+'"');
      out+=rect(-w/2+3,-h/2-2,w-6,9,ref('metal'),2)+rect(-w/2+6,-h/2-3,w-12,7,'#0d2029',2);
      out+=line(-w/2+4,-h/2+13,-w/2+4,h/2-3,'#52606a',1);
    }else if(f.type==='button'){
      if(f.boardReset)out+='<g data-board-reset="'+esc(f.label)+'">';
      out+=rect(-w/2-2,-h/2-2,w+4,h+4,'#233a42',2);
      out+=rect(-w/2,-h/2,w,h,ref('metal'),2,'stroke="#73868c" stroke-width=".7"');
      const cap=circle(0,0,w*.30,f.color||ref('black-round'),'stroke="#172a34" stroke-width=".7"');
      if(f.boardReset)out+='<g data-reset-cap="">'+cap+'</g></g>';
      else out+=f.buttonId?'<g class="button-cap" data-button="'+esc(f.buttonId)+'">'+cap+'</g>':cap;
      out+=text(0,h/2+6,f.label,5.5,silk);
    }else if(f.type==='crystal'){
      out+=rect(-w/2-1,-h/2-1,w+2,h+2,ref('metal'),h/2,'stroke="#75878e" stroke-width=".6" filter="'+ref('tinyshadow')+'"');
      out+=rect(-w/2+2,-h/2+1,w-4,h-2,'none',h/2,'stroke="#f5f8f7" stroke-width=".7"');
      out+=text(0,0,f.label,5.8,'#5b6c72');
    }else if(f.type==='shield'){
      out+=rect(-w/2-3,-h/2-2,w+6,h+4,'#203a36',1,'stroke="#a3ae91" stroke-width=".6"');
      for(const sign of [-1,1])for(let i=0;i<10;i++)out+=rect(sign<0?-w/2-5:w/2+1,-h/2+3+i*(h-8)/10,4,3,ref('gold'),.3);
      out+=rect(-w/2,-h/2,w,h,ref('metal'),2,'stroke="#819498" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=rect(-w/2+3,-h/2+3,w-6,h-6,'none',1,'stroke="#f7faf6" stroke-opacity=".5" stroke-width=".8"');
      out+=text(0,-h*.22,'ESPRESSIF',Math.min(8,w*.13),'#596d70','middle','font-weight="600"');
      f.label.split('-').reduce((lines,word,index)=>{if(index===0)lines.push(word);else if(index===1)lines[0]+='-'+word;else lines.push(word);return lines;},[]).forEach((value,i)=>out+=text(0,-1+i*9,value,6,'#69787b'));
      for(let i=0;i<5;i++)for(let j=0;j<5;j++)if((i*3+j*7)%4!==0)out+=rect(-w*.29+i*2,h*.21+j*2,1.5,1.5,'#7d8c86');
    }else if(f.type==='antenna'){
      out+=rect(-w/2,-h/2,w,h,'#203d33',1,'stroke="#64815f" stroke-width=".6"');
      let path='M '+(-w*.36)+' '+(h*.34)+' V '+(-h*.30);
      for(let i=0;i<5;i++)path+=' H '+(-w*.36+(i+1)*w*.14)+' V '+(i%2===0?h*.18:-h*.30);
      out+='<path d="'+path+'" fill="none" stroke="#ad9b59" stroke-width="2.1" stroke-linejoin="miter"/>';
    }else if(f.type==='unmodeled-header'){
      out+=rect(-w/2,-h/2,w,h,'#243139',2);
      for(let row=0;row<f.rows;row++)for(let column=0;column<f.cols;column++){
        const x=(column-(f.cols-1)/2)*.254,z=(row-(f.rows-1)/2)*.254;
        if(f.active.some(pin=>Math.abs(pin.x-f.x-x)<.01&&Math.abs(pin.z-f.z-z)<.01))continue;
        out+=f.contact==='female'
          ? rect(px(x)-2.2,px(z)-2.2,4.4,4.4,'#182a30',.6,'stroke="#7e7965" stroke-width=".55"')
          : rect(px(x)-1.8,px(z)-1.8,3.6,3.6,'#929b98',.35);
      }
      out+=text(w/2+20,0,f.label,5.6,silk);
    }else if(f.type==='header'){
      out+=rect(-w/2-1,-h/2-1,w+2,h+2,f.pads?'none':'#25343a',2);
      for(let row=0;row<(f.rows||1);row++)for(let col=0;col<(f.cols||2);col++){
        const xx=(col-((f.cols||2)-1)/2)*px(.254),yy=(row-((f.rows||1)-1)/2)*px(.254);
        out+=f.pads?circle(xx,yy,3.8,ref('metal'),'stroke="#526c68" stroke-width=".7"'):rect(xx-2.3,yy-2.3,4.6,4.6,ref('gold'),.4);
      }
      out+=text(0,h/2+6,f.label,5.4,silk);
    }else if(f.type==='jumper'){
      out+=rect(-w/2,-h/2,w,h,'#1e3338',2);
      out+=rect(-w/2-1,-h/2+1,w+2,h*.67,'#d7c052',2,'stroke="#8f7e35" stroke-width=".7"');
      out+=text(0,h/2+6,f.label,5.2,silk);
    }else if(f.type==='capacitor'){
      out+=circle(0,0,w/2,ref('black-round'),'filter="'+ref('tinyshadow')+'"')+circle(0,-1,w*.40,ref('metal'));
      out+=line(-w*.23,-w*.23,w*.23,w*.23,'#839395',.6)+line(-w*.23,w*.23,w*.23,-w*.23,'#839395',.6);
    }else if(f.type==='regulator'){
      out+=rect(-w/2,-h/2,w,h,ref('chip'),1.4)+rect(-w*.38,-h/2-4,w*.76,6,ref('metal'),.5);
      [-1,0,1].forEach(i=>out+=rect(i*w*.28-1,h/2-1,2,7,ref('metal'),.3));
      out+=text(0,0,f.label,5.2,'#a9b9bc');
    }else if(f.type==='matrix-led'){
      out+=rect(-w/2,-h/2,w,h,'#b4ada1',.7)+rect(-w*.41,-h*.27,w*.82,h*.54,f.color,.7);
    }else if(f.type==='touch-logo'){
      out+=rect(-w/2,-h/2,w,h,ref('gold'),h/2)+rect(-w*.38,-h*.31,w*.76,h*.62,'#1f2428',h*.31);
      out+=circle(-w*.20,0,px(.044),ref('gold'))+circle(w*.20,0,px(.044),ref('gold'));
    }else if(f.type==='smd'){
      out+=rect(-w/2-2,-h/2,w+4,h,ref('metal'),.4)+rect(-w/2+1,-h/2,w-2,h,f.ceramic?'#c0ae8d':'#2b3a3d',.4);
    }else if(f.type==='led'){
      out+='<g data-led="'+esc(f.id)+'">'+circle(0,0,10,ref('led-glow'),'class="led-glow" opacity="0"');
      out+=rect(-w/2-2,-h/2,w+4,h,ref('metal'),.5)+rect(-w/2,-h/2,w,h,f.color||'#a5c49c',.7,'class="led-core"');
      out+='</g>'+text(0,h/2+6,f.label,5.0,silk);
    }else if(f.type==='divider'){
      out+=line(-w/2,0,w/2,0,'#748b7e',1,'stroke-dasharray="4 3"')+text(0,7,f.label,5.3,silk);
    }else if(f.type==='label'){
      out+=text(0,0,f.label,f.size||8,silk,'middle','font-weight="600" letter-spacing=".4"');
    }
    return out+'</g>';
  }

  function boardTransform(pose){
    return 'translate('+px(pose.x)+' '+px(pose.z)+') rotate('+(-pose.rotation)+')';
  }

  function recordBoardEndpoint(pose,pin,description){
    const {x,z}=rotateBoardPoint(pin.x,pin.z,pose.rotation);
    record('mcu:'+pin.id,pose.x+x,pose.z+z,'mcu',description);
  }

  function profileBoardMarkup(board,profile){
    const model=profile.id==='esp32-devkitc'?esp32BenchVisual(profile):boardVisual(profile),w=px(model.width),h=px(model.height);
    let out='<g class="part-shape part-hit" data-component="mcu" transform="'+boardTransform(board)+'">'+selectionFrame(w,h);
    const microbit=model.style==='microbit-v2';
    const polygon=points=>'M '+points.map(([x,z])=>px(x)+' '+px(z)).join(' L ')+' Z';
    const cutout=pin=>{
      const x=px(pin.x),z=px(pin.z),r=px(pin.holeRadius);
      return ` M ${x+r} ${z} a ${r} ${r} 0 1 0 ${-2*r} 0 a ${r} ${r} 0 1 0 ${2*r} 0 Z`;
    };
    const outline=model.outline?polygon(model.outline)+model.pins.filter(pin=>pin.contact==='ring').map(cutout).join(''):null;
    out+='<g transform="translate(0 4)" aria-hidden="true">'+(outline?'<path d="'+outline+'" fill-rule="evenodd" fill="#656d59" stroke="#3b5650" stroke-width="1"/>':rect(-w/2,-h/2,w,h,'#656d59',4,'stroke="#3b5650" stroke-width="1"'))+'</g>';
    out+=outline?'<path d="'+outline+'" fill-rule="evenodd" fill="'+model.color+'" stroke="#37685d" stroke-width="1" filter="'+ref('shadow')+'"/>':rect(-w/2,-h/2,w,h,model.color,4,'stroke="#315f5c" stroke-width="1" filter="'+ref('shadow')+'"');
    out+=outline?'<path d="'+outline+'" fill-rule="evenodd" fill="'+ref('pcb-sheen')+'" pointer-events="none"/>':rect(-w/2,-h/2,w,h,ref('pcb-sheen'),4,'pointer-events="none"');
    if(!microbit)out+=rect(-w/2+3,-h/2+3,w-6,h-6,'none',3,'stroke="'+model.silk+'" stroke-opacity=".16" stroke-width=".7"');
    for(let i=0;!microbit&&i<14;i++){
      const yy=-h*.39+i*h*.059,xx=(i%2?1:-1)*w*.20;
      out+='<path d="M '+(i%2?w*.42:-w*.42)+' '+yy+' H '+xx+' l '+(i%2?-6:6)+' 6" fill="none" stroke="'+model.silk+'" stroke-opacity=".09" stroke-width=".7"/>';
    }
    model.holes.forEach(([xx,zz])=>{out+=circle(px(xx),px(zz),5.9,ref('metal'),'stroke="#7e9385" stroke-width=".7"')+circle(px(xx),px(zz),3.9,'#e6edeb','stroke="#667f75" stroke-width=".7"');});
    model.features.filter(feature=>!feature.back||feature.type==='usb').forEach(feature=>out+=boardFeatureMarkup(feature,model.silk));
    for(const pin of model.pins){
      const xx=px(pin.x),yy=px(pin.z),contact=pin.contact||model.header;
      const canonical=profile.pinAliases?.[pin.id]||pin.canonical;
      recordBoardEndpoint(board,pin,profile.name+' · '+pin.label+(canonical&&canonical!==pin.id?' · '+canonical:''));
      if(contact==='ring'){
        out+='<path d="'+polygon(pin.padOutline)+cutout(pin)+'" fill-rule="evenodd" fill="'+ref('gold')+'" stroke="#a98641" stroke-width=".5"/>';
        out+=text(xx,yy+px(.41),pin.label,8,'#152026','middle','font-weight="700"');
        continue;
      }
      if(contact==='edge'){
        const length=px(pin.padLength??.50),padWidth=px(.09);
        out+=rect(xx-padWidth/2,yy-length/2,padWidth,length,ref('gold'),.3);
        continue;
      }
      if(contact!=='pad'&&model.style!=='ti-launchpad')out+=rect(xx-6.5,yy-6.6,13,13.2,'#243139',1.3,'stroke="#18282d" stroke-width=".55"');
      out+=circle(xx,yy,contact==='pad'?4.6:3.9,ref('metal'),'stroke="#62766d" stroke-width=".55"');
      out+=contact==='male'?rect(xx-1.8,yy-1.8,3.6,3.6,ref('gold'),.3):rect(xx-2.2,yy-2.2,4.4,4.4,'#182a30',.6,'stroke="#9f9a71" stroke-width=".6"');
      if(pin.print===false)continue;
      let side=pin.side|| (pin.x<0?'left':'right');
      const bottom=/bottom|tail/i.test(side),top=/top/i.test(side),labelSize=model.style==='nucleo'?4.8:5.6;
      if(bottom||top){
        const expansion=profile.boardMarking==='PCA10156'&&/^p\d-/.test(side);
        const labelZ=yy+(expansion?(bottom?15:-15):(bottom?-10:10));
        out+=text(xx,labelZ,pin.silkLabel||pin.label,labelSize,model.silk,'middle','transform="rotate(-90 '+xx+' '+labelZ+')"');
      }
      else {
        const direction=(pin.x<0?1:-1)*(pin.printOutside?-1:1);
        out+=text(xx+direction*9,yy,pin.label,labelSize,model.silk,direction>0?'start':'end');
      }
    }
    out+=text(0,h/2+18,profile.name,10,'#426d68','middle','font-weight="600"');
    out+=text(0,h/2+29,board.mounted?'已插入面包板':`USB ${model.usbDirection} · 几何教学模型`,6.2,'#718d85');
    return out+'</g>';
  }

  function boardMarkup(board){
    const profile=getBoardProfile(circuit?.boardId);
    if(profile.style!=='bluepill')return profileBoardMarkup(board,profile);
    const model=boardVisual(profile),w=px(model.width),h=px(model.height);
    let out='<g class="part-shape part-hit" data-component="mcu" transform="'+boardTransform(board)+'">'+selectionFrame(w,h);
    out+=rect(-w/2,-h/2+4,w,h,'#586e58',5,'stroke="#354e48" stroke-width=".8"');
    out+=rect(-w/2,-h/2,w,h,ref('pcb'),5,'stroke="#0a365e" stroke-width="1" filter="'+ref('shadow')+'"');
    out+=rect(-w/2+3,-h/2+3,w-6,h-6,'none',4,'stroke="#3e85b6" stroke-opacity=".45" stroke-width="1"');
    for(let n=0;n<16;n++){
      const yy=-112+n*14;out+=line(-43,yy,-20+(n%3)*4,yy,'#3281b5',.5);
      out+=line(20,yy+5,44,yy+5,'#2e70a3',.6);
    }
    [-1,1].forEach(sign=>{
      const pins=model.pins.filter(pin=>Math.sign(pin.x)===sign),xx=px(pins[0]?.x||sign*(model.width/2-.127));
      const top=Math.min(...pins.map(pin=>pin.z))-.127,bottom=Math.max(...pins.map(pin=>pin.z))+.127;
      out+=rect(xx-5.9,px(top),11.8,px(bottom-top),'#1c252b',2,'stroke="#0e171f" stroke-width="1"');
      pins.forEach(pin=>{
        const yy=px(pin.z);
        out+=circle(xx,yy,5.0,ref('metal'),'stroke="#203c54" stroke-width=".6"');
        out+=rect(xx-2.05,yy-2.05,4.1,4.1,ref('gold'),.3,'stroke="#8a703e" stroke-width=".3"');
        out+=line(xx-1.7,yy-1.6,xx+1.5,yy-1.6,'#fff1bc',.65);
        out+=text(sign>0?xx-9:xx+9,yy,pin.label,6.4,'#f0f7fc',sign>0?'end':'start','font-weight="500"');
        recordBoardEndpoint(board,pin,profile.name+' · '+pin.label);
      });
    });
    const chipSize=px(.7),chipY=px(.12);
    for(let side=0;side<4;side++){
      out+='<g transform="translate(0 '+chipY+') rotate('+(side*90)+')">';
      for(let i=0;i<12;i++)out+=rect(px((i-5.5)*.05)-.7,-px(.49),1.4,px(.17),ref('metal'),.2);
      out+='</g>';
    }
    out+=rect(-chipSize/2,chipY-chipSize/2,chipSize,chipSize,ref('chip'),1.4,'stroke="#101a22" stroke-width=".7" filter="'+ref('tinyshadow')+'"');
    out+=circle(-chipSize/2+4,chipY-chipSize/2+4,1.4,'#70787c');
    out+=text(0,chipY-8,'STM32',6.4,'#c8d1d6');
    out+=text(0,chipY,'F103C8T6',5.8,'#b9c7ce');
    out+=text(0,chipY+8,'ARM Cortex-M3',4.4,'#8c9da7');
    out+=rect(-24,-51,48,21,ref('metal'),10,'stroke="#7e8f99" stroke-width=".8" filter="'+ref('tinyshadow')+'"');
    out+=rect(-21,-49,42,16,'none',8,'stroke="#f8fbfb" stroke-opacity=".65" stroke-width=".7"');
    out+=text(0,-40,'8.000',7.2,'#56616a','middle','font-family="monospace"');
    out+=rect(-30,-90,6.7,30,ref('metal'),3.1);
    out+=line(-28,-60,-30,-52,'#bec9ce',1);out+=line(-25,-60,-22,-52,'#bec9ce',1);
    out+=rect(4,-95,21,24,ref('chip'),1.3);
    out+=rect(6,-102,17,9,ref('metal'),1);
    [-1,0,1].forEach(i=>out+=rect(13+i*6,-73,2.7,9,ref('metal'),.3));
    out+=text(14,-84,'662K',5.5,'#9cacb6');
    [[-29,-106],[32,-59],[-28,-27],[29,26],[-25,40],[17,47],[-23,76],[27,81]].forEach(([xx,yy],i)=>{
      out+=rect(xx-5,yy-2.8,10,5.6,ref('metal'),.5);
      out+=rect(xx-3.2,yy-2.8,6.4,5.6,i%3?'#c7ad85':'#263137',.3);
    });
    out+=boardFeatureMarkup({type:'usb',x:0,z:-model.height/2+.25,w:.84,h:.58,kind:'micro'},'#edf6fc');
    out+=text(0,-110,'STM32',7.7,'#f0f7fc','middle','font-weight="700"');
    out+=boardFeatureMarkup({type:'button',x:0,z:1.05,w:.38,h:.40,label:'RST',boardReset:true},'#ecf4fa');
    [-16,16].forEach((xx,i)=>{
      out+=rect(xx-6,88,12,43,'#1c272e',2);
      for(let n=0;n<3;n++)out+=rect(xx-2,93+n*14,4,4,ref('gold'),.3);
      out+=rect(xx-7,90+(i===0&&circuit?.boot0?14:0),14,27,'#eac14d',2,'stroke="#997b2d" stroke-width=".7" filter="'+ref('tinyshadow')+'"');
      out+=rect(xx-4,93+(i===0&&circuit?.boot0?14:0),8,20,'#f7dc6f',1);
      out+=text(xx,139,i===0?'B0':'B1',6,'#f0f6f9');
    });
    out+='<g data-led="onboard">'+circle(25,61,9,ref('led-glow'),'class="led-glow" opacity="0"')+rect(21,58,8,6,'#387346',1,'class="led-core"')+rect(23,58.5,2,2,'#d9efd9',.7)+'</g>';
    out+='<g data-led="power-led">'+circle(-24,61,9,ref('led-glow'),'class="led-glow" opacity="0"')+rect(-28,58,8,6,'#ac453e',1,'class="led-core"')+'</g>';
    out+=text(25,72,'PC13',4.7,'#d6e9f1');out+=text(-24,72,'PWR',4.7,'#d6e9f1');
    out+='</g>';
    return out;
  }

  function breadboardMarkup(board){
    const x=board.x||0,z=board.z||0,w=px(8.3),h=px(5.4);
    let out='<g class="part-shape part-hit" data-component="breadboard" transform="translate('+px(x)+' '+px(z)+')">'+selectionFrame(w,h);
    out+=rect(-w/2,-h/2,w,h,ref('white'),8,'stroke="#bbbeb6" stroke-width="1" filter="'+ref('shadow')+'"');
    out+=rect(-w/2+3,-h/2+3,w-6,h-6,'none',6,'stroke="#fff" stroke-opacity=".8" stroke-width="1.2"');
    out+=rect(-px(3.93),-px(.155),px(7.86),px(.31),'#c7ccc4',2);
    out+=rect(-px(3.93),-px(.10),px(7.86),px(.20),'#e0e2d9',1);
    [-1.69,1.69].forEach(y=>out+=line(-px(4),px(y),px(4),px(y),'#c0c5be',.7));
    [[-2.43,'+','#c36960'],[-1.80,'−','#557c93'],[1.80,'+','#c36960'],[2.43,'−','#557c93']].forEach(([yy,symbol,color])=>{
      out+=line(-px(3.76),px(yy),px(3.76),px(yy),color,1.1);
      out+=text(-px(4),px(yy),symbol,9,color);
    });
    out+=text(px(2.8),-px(2.58),'上方电源轨',5.8,'#93998f');
    out+=text(px(2.4),px(2.58),'下方电源轨 · 上下隔离',5.8,'#93998f');
    const hole=(endpoint,localX,localZ,description)=>{
      const xx=px(localX),yy=px(localZ);
      out+=rect(xx-3.4,yy-3.4,6.8,6.8,'#c8ccc2',1.1,'stroke="#fffdf6" stroke-width=".65"');
      out+=rect(xx-2.0,yy-2.0,4.0,4.0,'#4d595a',.65);
      out+=rect(xx-1.45,yy-.7,2.9,1.6,'#283b40',.3);
      record(endpoint,x+localX,z+localZ,'breadboard',description);
    };
    const rows='abcdefghij';
    for(let row=0;row<10;row++){
      const yy=px(signalHole(rows[row],1).z);
      out+=text(-px(3.98),yy,rows[row].toUpperCase(),6.5,'#858d85');
      out+=text(px(3.98),yy,rows[row].toUpperCase(),6.5,'#858d85');
      for(let col=1;col<=30;col++){
        const socket=signalHole(rows[row],col);
        hole(socket.endpoint,socket.x,socket.z,'面包板 '+rows[row].toUpperCase()+col+' · 同列'+(row<5?'A–E':'F–J')+'五孔相通');
      }
    }
    [1,5,10,15,20,25,30].forEach(col=>[-1.58,1.58].forEach(y=>out+=text(px((col-15.5)*.254),px(y),col,5.7,'#8b938a')));
    [{offset:0,p:-2.23,n:-1.97,name:'上方'},{offset:25,p:1.97,n:2.23,name:'下方'}].forEach(rail=>{
      for(const polarity of ['p','n'])for(let i=0;i<25;i++)hole('bb:'+polarity+(rail.offset+i+1),(i+Math.floor(i/5)-14)*.254,rail[polarity],rail.name+(polarity==='p'?'正':'负')+'电源轨 · 本条25孔相通');
    });
    [-2.7,0,2.7].forEach(xx=>out+=rect(px(xx)-7,-h/2-5,14,5,ref('white'),1,'stroke="#c3c8be" stroke-width=".6"'));
    out+='</g>';return out;
  }

  function partMarkup(part){
    const id=esc(part.id);
    const pose=partPose(part,circuit.breadboard),pinPart=part.mount&&!pose.mounted?{...part,mount:undefined}:part;
    let out='<g class="part-shape part-hit" data-component="'+id+'"'+(part.type==='button'?' data-button="'+id+'"':'')+(pose.mounted?' data-part-mounted="true"':'')+' transform="'+boardTransform(pose)+'">';
    const p=(name,x,z,description)=>{const contact=componentPin(pinPart,name,PARTS[part.type]);return partEndpoint(part,pose,name,contact?.x??x,contact?.z??z,description);};
    out+='<title>'+esc(componentLabel(part,PARTS[part.type]))+'</title>';
    if(part.type==='led'){
      out+=selectionFrame(36,pose.mounted?32:64);
      if (!pose.mounted) {
        out+=line(px(-.127),8,px(-.127),px(.58),'#89989c',2.7);
        out+=line(px(-.127)+.6,8,px(-.127)+.6,px(.58),'#eef4f4',.85);
        out+=line(px(.127),8,px(.127),px(.48),'#89989c',2.7);
        out+=line(px(.127)+.6,8,px(.127)+.6,px(.48),'#eef4f4',.85);
      }
      out+='<g data-led="'+id+'">'+circle(0,-3,28,ref('led-glow'),'class="led-glow" opacity="0"');
      out+='<path d="M 15.5 -9.98 A 17 17 0 1 0 15.5 3.98 Z" fill="'+(COLORS[part.color]||COLORS.red)+'" stroke="#5b514b" stroke-width=".65"/>';
      out+=line(15.5,-9.98,15.5,3.98,'#d2b9ac',1.1);
      out+=circle(0,-3,15,COLORS[part.color]||COLORS.red,'class="led-core" stroke="#783c36" stroke-width=".7" filter="'+ref('tinyshadow')+'"');
      out+=circle(0,-5,12.5,ref('led-glass'));
      out+='<ellipse cx="-4" cy="-10" rx="5" ry="2.2" fill="#fff" opacity=".58" transform="rotate(-30 -4 -10)"/>';
      out+=line(-6,1,-6,8,'#efcebc',1.4,'opacity=".55"')+line(6,1,6,8,'#ebcbb7',1.4,'opacity=".45"')+'</g>';
      out+=text(px(-.127)-3,px(pose.mounted ? .37 : .80),'A +',7.3,'#365e58','end','paint-order="stroke" stroke="#f4f7f2" stroke-width="2"')+text(px(.127)+3,px(pose.mounted ? .37 : .65),'K −',7.3,'#365e58','start','paint-order="stroke" stroke="#f4f7f2" stroke-width="2"');
      out+=text(23,-3,'−',8,'#5a6f66');
      p('A',-.127,.58,'LED A · 长脚 · 正极');p('K',.127,.48,'LED K · 短脚 · 负极');
      out+=faultMark(19,-18);
    }else if(part.type==='resistor'){
      const lead=pose.mounted ? componentPin(pinPart,'2').x : .71;
      out+=selectionFrame(90,22);
      out+=line(-px(lead),0,px(lead),0,'#9ba5a6',3.0)+line(-px(lead),-.7,px(lead),-.7,'#f6f9f4',.8);
      out+=rect(-21,-7.5,42,15,ref('resistor'),6,'stroke="#ad956b" stroke-width=".7" filter="'+ref('tinyshadow')+'"');
      const appearance=resistorVisual(part),positions=appearance.bands.length===5?[-15,-9,-3,3,14]:appearance.bands.length===1?[0]:[-14,-7,0,13];
      appearance.bands.forEach((band,i)=>out+=rect(positions[i],-7,band.kind==='tolerance'?2.8:3.3,14,band.color,.4));
      if(appearance.mode==='printed')out+=text(0,0,appearance.label,6.6,'#3f3a2d','middle','font-weight="700"');
      if(appearance.mode==='invalid')out+=text(0,0,'?',10,'#a42f2c','middle','font-weight="700"');
      out+='<title>'+esc(appearance.note)+'</title>'+rect(-16,-5.8,29,1.4,'#fff7da',.7,'opacity=".24"');
      out+=text(0,18,componentLabel(part,PARTS[part.type]),7.8,'#42675d','middle','paint-order="stroke" stroke="#f4f7f2" stroke-width="2"');
      p('1',-.71,0,'电阻端1 · '+appearance.note);p('2',.71,0,'电阻端2 · '+appearance.label+' · 无正负之分');
      out+=faultMark(25,-10);
    }else if(part.type==='button'){
      out+=selectionFrame(50,40);
      componentPins(pinPart).forEach(({id:name,x,z})=>{
        if(pose.mounted){
          const start=px(Math.sign(x)*.27),end=px(x),row=px(z);
          out+=line(start,row,end,row,'#879799',4.1,'stroke-linecap="round"');
          out+=line(start,row-.8,end,row-.8,'#e9eeec',.9);
        }else out+=rect(px(x)-4,px(z)-2,8,4,ref('metal'),1);
        p(name,x,z,'按键脚'+name+' · '+(Number(name)<3?'脚1、2同组':'脚3、4同组'));
      });
      out+=rect(-18,-18,36,36,'#27353a',3,'filter="'+ref('tinyshadow')+'"');
      out+=rect(-16,-16,32,32,ref('metal'),3,'stroke="#6d7a7c" stroke-width=".8"');
      for(const x of [-12,12])for(const y of [-12,12])out+=circle(x,y,1.6,'#707e80')+circle(x-.3,y-.4,.7,'#e3e9e7');
      out+='<g class="button-cap" data-button="'+id+'">'+circle(0,0,9.4,ref('black-round'),'stroke="#101b22" stroke-width=".8"')+circle(-2,-3,5.5,'#536066','opacity=".18"')+'</g>';
      out+=text(0,29,part.id+' · 按黑帽',7.3,'#42675d','middle','class="component-label" paint-order="stroke" stroke="#f4f7f2" stroke-width="2"');
      out+=faultMark(20,-20);
    }else if(part.type==='pot'){
      out+=selectionFrame(57,71);
      out+=rect(-26,-25,52,49,ref('servo'),4,'stroke="#1b5686" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=circle(0,-2,20,ref('metal'),'stroke="#b3b9b8" stroke-width=".6"');
      out+='<g class="pot-knob" data-pot-knob="'+id+'" style="cursor:var(--pot-cursor, inherit)">'+circle(0,-2,16.4,ref('white'),'stroke="#a7aca5" stroke-width=".7"');
      for(let i=0;i<20;i++){const a=i/20*Math.PI*2;out+=line(Math.sin(a)*14,-2+Math.cos(a)*14,Math.sin(a)*16,-2+Math.cos(a)*16,'#b9bcb2',.65);}
      out+=rect(-1.4,-16,2.8,10,'#416a84',1)+'</g>';
      componentPins(part).forEach(pin=>{out+=rect(px(pin.x)-1.5,22,3,px(pin.z)-22,ref('metal'),.4);out+=text(px(pin.x),px(pin.z)+8,pin.label,6,'#3f665d','middle','paint-order="stroke" stroke="#f4f7f2" stroke-width="1.6"');p(pin.id,pin.x,pin.z,'电位器 '+pin.id+' · 总阻值 '+formatResistance(part.resistance??10000));});
      out+=text(0,57,componentLabel(part,PARTS[part.type]),7.6,'#42675d','middle','paint-order="stroke" stroke="#f4f7f2" stroke-width="2"');out+=faultMark(29,-27);
    }else if(part.type==='encoder'){
      const width=px(encoderVisual.width),depth=px(encoderVisual.depth),r=px(encoderVisual.shaftRadius),flat=r/2;
      const flatX=Math.sqrt(r*r-flat*flat);
      out+=selectionFrame(px(1.59),px(1.77));
      for(const contact of componentPins(part)){
        const x=px(contact.x),z=px(contact.z);
        out+=line(x,Math.sign(z)*depth*.42,x,z,'#a4afb0',3.2);
        out+=text(x,z+Math.sign(z)*8,contact.label,6.3,'#42675d','middle','class="component-label" paint-order="stroke" stroke="#f4f7f2" stroke-width="1.6"');
        p(contact.id,contact.x,contact.z,encoderPinDescription(contact));
      }
      for(const sign of [-1,1])out+=rect(sign*px(.66)-4.1,-9,8.2,18,ref('metal'),1.7);
      out+=rect(-width/2,-depth/2,width,depth,ref('metal'),4,'stroke="#465962" stroke-width=".9" filter="'+ref('tinyshadow')+'"');
      out+=circle(0,0,px(.36),'#53626a','stroke="#2f424a" stroke-width="1"');
      out+='<g data-encoder-shaft="'+id+'" style="cursor:var(--encoder-cursor, inherit)"><path d="M '+(-flatX)+' '+flat+' A '+r+' '+r+' 0 1 1 '+flatX+' '+flat+' Z" fill="'+ref('metal')+'" stroke="#263940" stroke-width="1.2"/>';
      out+=line(0,flat-6,0,flat-1,'#53656a',1.5)+'</g>';
      out+=text(0,58,part.id+' · PEC11R',7.2,'#42675d','middle','class="component-label" paint-order="stroke" stroke="#f4f7f2" stroke-width="1.6"');
    }else if(part.type==='dipswitch'){
      const w=px(1.22),d=px(.66);
      out+=selectionFrame(w+9,d+13);
      for(const {id:pinId,x,z,label:name} of componentPins(part)){
        out+=line(px(x),px(Math.sign(z)*.283),px(x),px(z),'#bac4c5',2.0);
        p(pinId,x,z,name);
      }
      out+=rect(-w/2,-d/2,w,d,'#17232c',2.8,'stroke="#354450" stroke-width=".7"');
      out+=text(-w/2+3,0,'ON',4.8,'#f6f3df','start','transform="rotate(-90 '+(-w/2+3)+' 0)" pointer-events="none"');
      for(const [i,x] of [-.381,-.127,.127,.381].entries()){
        const center=px(x),key=' data-dip-slider="'+i+'"';
        out+=rect(center-px(.097),-px(.198),px(.194),px(.390),'#0b1219',1.1);
        out+=rect(center-px(.073),px(.019),px(.146),px(.100),'#e9e5d5',1.1,'data-dip-cap="'+i+'"');
        out+=text(center,px(.267),String(i+1),5.4,'#f3f3dc','middle','pointer-events="none"');
        out+=rect(center-px(.117),-px(.22),px(.234),px(.44),'transparent',0,key);
      }
    }else if(part.type==='joystick'){
      const {width,depth,centerZ,capRadius}=joystickVisual,w=px(width),d=px(depth),r=px(capRadius),cz=px(centerZ);
      out+=selectionFrame(w+13,d+13);
      out+=rect(-w/2,-d/2,w,d,'#a62531',3,'stroke="#651d26" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      for(const x of [-1.016,1.016])for(const z of [-1.3335,1.3335]){
        out+=circle(px(x),px(z),6,'#a4a19d','stroke="#dbcdc2" stroke-width="1"');
        out+=circle(px(x),px(z),3.4,'#42232a');
      }
      out+=rect(-px(.91),cz-px(.88),px(1.82),px(1.76),ref('metal'),5,'stroke="#43565d" stroke-width="1"');
      out+=circle(0,cz,px(.67),'#20252a','stroke="#555c62" stroke-width="2"');
      out+='<g transform="translate(0 '+cz+')"><g data-joystick-cap="'+id+'">';
      out+=circle(0,0,r,ref('black-round'),'stroke="#17282e" stroke-width="1.2"');
      out+=circle(0,0,r*.81,'#34393d','stroke="#555b5e" stroke-width="1.8"');
      for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)if(i*i+j*j<7)out+=circle(i*r*.235,j*r*.235,r*.039,'#666c70');
      out+='</g></g>';
      for(const contact of componentPins(part)){
        const x=px(contact.x),z=px(contact.z);
        out+=circle(x,z,px(.089),'#ceb282','stroke="#f1d599" stroke-width=".85"');
        out+=circle(x,z,px(.052),'#542529');
        out+=text(x,z-8,contact.label,6.0,'#f7e6dd','middle','class="component-label"');
        p(contact.id,contact.x,contact.z,joystickPinDescription(contact));
      }
      out+=text(0,d/2+13,part.id+' · 双轴摇杆',7.2,'#42675d','middle','class="component-label" paint-order="stroke" stroke="#f4f7f2" stroke-width="1.6"');
    }else if(part.type==='buzzer'){
      out+=selectionFrame(59,77);
      componentPins(part).forEach(pin=>out+=line(px(pin.x),20,px(pin.x),px(pin.z),'#a4afb0',2.3)+line(px(pin.x)+.6,20,px(pin.x)+.6,px(pin.z),'#f1f5f2',.7));
      out+=circle(0,0,28,ref('black-round'),'stroke="#17282e" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=circle(0,-1,23,'none','stroke="#435158" stroke-width=".8"')+circle(0,-1,7,'#0d1f27','stroke="#536066" stroke-width="1.2"');
      out+=text(-14,10,'+',10,'#d6e2df')+text(0,-15,'ACTIVE',5.3,'#9bb0b3');
      out+='<g class="buzzer-waves" opacity="0"><path d="M 31 -13 Q 42 0 31 13 M 37 -20 Q 55 0 37 20" fill="none" stroke="#1b9c83" stroke-width="2" stroke-linecap="round"/></g>';
      p('+',-.24,.64,'有源蜂鸣器正极');p('-',.24,.64,'有源蜂鸣器负极');out+=text(-13.2,45,'+',8,'#526f65')+text(13.2,45,'−',8,'#526f65')+text(0,57,part.id+' · 有源蜂鸣器',7.2,'#42675d');out+=faultMark(29,-25);
    }else if(part.type==='servo'){
      const hs55=part.servoModel==='hs55';
      out+=selectionFrame(hs55?136:95,210);
      if(hs55){
        for(const sign of [-1,1]){
          out+=rect(-31.9,px(sign*1.355-.275),63.8,30.25,'#485056',5,'stroke="#222a30" stroke-width="1"');
          out+=circle(0,px(sign*1.43),5.5,'#1a262c','stroke="#73818a" stroke-width="1"');
        }
        out+=rect(-31.9,-62.7,63.8,125.4,'#343c42',5,'stroke="#222a30" stroke-width="1" filter="'+ref('shadow')+'"');
        out+=rect(-27,-57,54,114,'none',3,'stroke="#69757a" stroke-width=".7"');
        out+=rect(-22,-42,44,21,'#262d31',2)+text(0,-31,'HS-55',8,'#edf0eb','middle','font-weight="700"');
        out+=circle(0,HS55_SERVO_PIVOT,15,'#252e34','stroke="#69777c" stroke-width="1"');
        out+='<g class="servo-horn" transform="rotate(0 0 '+HS55_SERVO_PIVOT+')">';
        out+=rect(-7,HS55_SERVO_PIVOT-6.4,69.5,12.8,'#60686b',6.4,'stroke="#161e22" stroke-width=".8"');
        for(const x of [.415,.655,.895])out+=circle(px(x),HS55_SERVO_PIVOT,2.9,'#222b31');
        out+=circle(0,HS55_SERVO_PIVOT,13,'#596165','stroke="#222b31" stroke-width=".8"');
        out+=circle(0,HS55_SERVO_PIVOT,4.5,ref('metal'))+line(-2.4,HS55_SERVO_PIVOT,2.4,HS55_SERVO_PIVOT,'#526571',.9)+'</g>';
      }else{
        out+=rect(-45,-83,90,18,ref('servo'),4,'stroke="#235d8b" stroke-width="1"')+rect(-45,65,90,18,ref('servo'),4,'stroke="#235d8b" stroke-width="1"');
        for(const xx of [-32,32])for(const yy of [-74,74])out+=circle(xx,yy,3.5,'#254451','stroke="#7ab6d7" stroke-width=".8"');
        out+=rect(-34,-63,68,126,ref('servo'),5,'stroke="#1e4e78" stroke-width="1" filter="'+ref('shadow')+'"');
        out+=rect(-29,-57,58,114,'none',3,'stroke="#62a9d9" stroke-width=".7" stroke-opacity=".55"');
        for(const xx of [-25,25])for(const yy of [-52,52])out+=circle(xx,yy,2.3,ref('metal'))+line(xx-1.2,yy,xx+1.2,yy,'#435d6b',.6);
        out+=circle(0,-31,17,ref('white'),'stroke="#c8d3d4" stroke-width=".7"');
        const initial=Number.isFinite(part.angle)?90-part.angle:0;
        out+='<g class="servo-horn" transform="rotate('+initial+' 0 -31)">'+rect(-48,-38,96,14,ref('white'),7,'stroke="#b1c3ca" stroke-width=".7" filter="'+ref('tinyshadow')+'"');
        for(const xx of [-38,-27,27,38])out+=circle(xx,-31,1.8,'#5d7886');
        out+=circle(0,-31,10,ref('white'))+circle(0,-31,4.5,ref('metal'))+line(-2.4,-31,2.4,-31,'#526571',.9)+'</g>';
        out+=rect(-25,7,50,29,'#cfe4ed',2,'opacity=".93"')+text(0,17,'MICRO SERVO',5.7,'#27618b')+text(0,28,'SG90 · 9g',6.7,'#28668e','middle','font-weight="700"');
      }
      [{name:'GND',x:-.26,color:hs55?'#303a40':'#79503c'},{name:'VCC',x:0,color:'#c3493b'},{name:'SIG',x:.26,color:hs55?'#d6aa33':'#dfa045'}].forEach(pn=>{
        out+='<path d="M '+px(pn.x*.25)+' 63 Q '+px(pn.x*.6)+' 82 '+px(pn.x)+' 96" fill="none" stroke="'+pn.color+'" stroke-width="2.4"/>';
        out+=rect(px(pn.x)-5,96,10,12,'#243138',1);
        out+=rect(px(pn.x)-1.7,99,3.4,5,ref('gold'),.4);
        p(pn.name,pn.x,1.85,'舵机 '+pn.name);
      });
      out+=faultMark(44,-68);
    }else if(part.type==='capacitor'){
      const pins=componentPins(pinPart),radius=pose.mounted?px(.315):15.5;
      out+=selectionFrame(pose.mounted?radius*2:36,pose.mounted?radius*2:72);
      if(!pose.mounted)for(const pin of pins){
        out+=line(px(pin.x),10,px(pin.x),px(pin.z),'#93a2a6',2.4)+line(px(pin.x)+.6,10,px(pin.x)+.6,px(pin.z),'#edf4f1',.7);
      }
      out+=circle(0,0,radius,ref('black-round'),'stroke="#1a303b" stroke-width=".8" filter="'+ref('tinyshadow')+'"');
      out+=circle(0,0,radius-3,ref('metal'),'stroke="#a0afb4" stroke-width=".7"');
      out+=line(-7,-7,7,7,'#89979e',.8)+line(-7,7,7,-7,'#89979e',.8);
      if(pose.mounted){
        const rim=radius-1.5,x=rim*.48,y=rim*Math.sqrt(1-.48**2);
        out+='<path d="M '+x+' '+(-y)+' A '+rim+' '+rim+' 0 0 1 '+x+' '+y+'" fill="none" stroke="#d6dfd9" stroke-width="3" data-negative-stripe="true"/>';
        // The vertical feet sit under the can. Show their true centres as a selection guide.
        out+='<g class="selection-frame" aria-hidden="true">'+pins.map(pin=>circle(px(pin.x),px(pin.z),2.4,'#f4faf7','stroke="#3f6c67" stroke-width=".8" data-mounted-tail="'+pin.id+'"')).join('')+'</g>';
        for(const pin of pins)out+=text(px(pin.x),radius*.57,pin.id==='+'?'+':'−',8,'#304b55','middle','class="component-label" font-weight="700"');
      }else{
        out+='<path d="M 7 -13 A 15 15 0 0 1 7 13" fill="none" stroke="#cbd7d3" stroke-width="3"/>';
        out+=text(19,0,'−',8,'#455e68')+text(-13,33,'+',8,'#526f65')+text(13,28,'−',8,'#526f65');
      }
      const labelY=pose.mounted?radius+9:47;
      const labelOrientation=pose.mounted?'class="component-label" transform="rotate('+pose.rotation+' 0 '+labelY+')" ':'';
      out+=text(0,labelY,componentLabel(part,PARTS[part.type]),7.5,'#42675d','middle',labelOrientation+'paint-order="stroke" stroke="#f4f7f2" stroke-width="2"');
      for(const pin of pins)p(pin.id,pin.x,pin.z,pin.id==='+'?'电解电容正极长脚':'电解电容负极条纹侧');
      out+=faultMark(radius+3.5,-radius-2.5);
    }else if(part.type==='diode'){
      const [anode,cathode]=componentPins(pinPart),left=px(anode.x),right=px(cathode.x);
      const width=pose.mounted?px(.34):30,depth=pose.mounted?px(.175):14;
      out+=selectionFrame(pose.mounted?right-left:86,26)+line(left,0,right,0,'#96a8ac',3)+line(left,-.7,right,-.7,'#f1f6f5',.9);
      if(pose.mounted)for(const pin of [anode,cathode])out+=circle(px(pin.x),px(pin.z),2.1,'#cbd7d7','stroke="#587477" stroke-width=".65" data-mounted-tail="'+pin.id+'"');
      out+=rect(-width/2,-depth/2,width,depth,ref(pose.mounted?'diode-glass':'chip'),pose.mounted?1.6:4,'stroke="#17313b" stroke-width=".8" filter="'+ref('tinyshadow')+'"');
      if(pose.mounted){
        out+=rect(width*.23,-depth/2+.35,width*.13,depth-.7,'#293236',.45,'data-cathode-band="true"');
        out+=line(-width*.35,-depth*.25,width*.18,-depth*.25,'#fff2d8',.8,'opacity=".55"');
        for(const pin of [anode,cathode]){
          const x=px(pin.x);
          out+=text(x,13,pin.id,7,'#375951','middle','class="component-label" transform="rotate('+pose.rotation+' '+x+' 13)"');
        }
      }else{
        out+=rect(7,-7,4,14,'#c6d5d4',.4)+line(-10,-4,3,-4,'#78898c',1.2,'opacity=".45"');
        out+=text(-28,13,'A',6,'#627d76')+text(28,13,'K',6,'#627d76');
      }
      p('A',anode.x,anode.z,'二极管 A · 阳极');p('K',cathode.x,cathode.z,'二极管 K · 色环为阴极');out+=faultMark(width/2+4,-depth/2-6);
    }else if(part.type==='switch'){
      out+=selectionFrame(64,51)+line(-px(.56),0,px(.56),0,'#9babad',3);
      out+=rect(-22,-18,44,36,ref('chip'),4,'stroke="#18313a" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=rect(-18,-14,36,28,ref('metal'),3,'stroke="#72888d" stroke-width=".6"');
      for(const xx of [-13,13])out+=circle(xx,0,2.3,'#687e84')+line(xx-1.2,0,xx+1.2,0,'#d8e4e1',.7);
      out+=rect(-7,-11,14,22,'#273d45',4);
      out+='<g class="switch-lever">'+rect(-5,-14,10,21,ref('metal'),4,'stroke="#819596" stroke-width=".8"')+rect(-5,-14,10,8,'#b3473d',3)+'</g>';
      out+=text(0,28,part.closed?'ON · 接通':'OFF · 断开',6.3,'#5b7b72','middle','class="switch-state"');
      p('1',-.56,0,'开关端1');p('2',.56,0,'开关端2 · 接通时与端1相通');out+=faultMark(26,-22);
    }else if(part.type==='ldr'&&part.ldrModel==='pdv-p8103'){
      const w=px(pdvPhotoresistorVisual.width),d=px(pdvPhotoresistorVisual.depth);
      out+=selectionFrame(w+12,px(1.2));
      for(const {id,x,z,label} of componentPins(part)){
        out+=line(px(x),0,px(x),px(z),'#a1aaac',2.5);
        p(id,x,z,label+' · 无正负极');
      }
      out+=`<g data-photocell-face="${id}">`;
      out+=rect(-w/2,-d/2,w,d,'#e3d1a7',5,'stroke="#b1966e" stroke-width="1"');
      out+='<path d="M -6 -7 H 7 Q 10 -5 7 -3 H -7 Q -10 -1 -7 1 H 7 Q 10 3 7 5 H -7" fill="none" stroke="#973f35" stroke-width="1.6" stroke-linecap="round"/>';
      out+=rect(-w/2-1,-d/2-1,w+2,d+2,'#26313b',5,'data-photocell-cover=""'+(part.ldrCovered?'':' style="display:none"'))+'</g>';
      out+=text(0,px(.74),'PDV-P8103',6.6,'#45655a','middle','class="component-label"');
    }else if(part.type==='ldr'){
      out+=selectionFrame(45,65);componentPins(part).forEach(pin=>out+=line(px(pin.x),8,px(pin.x),px(pin.z),'#95a6a8',2.5));
      out+=circle(0,-3,17,'#c7a981','stroke="#977548" stroke-width="1" filter="'+ref('tinyshadow')+'"')+circle(0,-3,14.4,'#e4ccb0','stroke="#e9d9ba" stroke-width=".7"');
      out+='<path d="M -9 -12 H 8 Q 12 -10 8 -7 H -8 Q -12 -5 -8 -2 H 8 Q 12 1 8 3 H -8 Q -12 6 -8 8 H 8" fill="none" stroke="#9d4c40" stroke-width="2.2" stroke-linecap="round"/>';
      out+=text(0,41,(part.lux??100)+' lx',6.4,'#617c75','middle','class="sensor-value"');
      p('1',-.145,.53,'光敏电阻端1');p('2',.145,.53,'光敏电阻端2 · 无正负极');out+=faultMark(21,-20);
    }else if(part.type==='thermistor'){
      out+=selectionFrame(35,61);componentPins(part).forEach(pin=>out+=line(px(pin.x),5,px(pin.x),px(pin.z),'#a0afb0',2.4));
      out+=circle(0,-3,12,'#2f7369','stroke="#1e554d" stroke-width=".8" filter="'+ref('tinyshadow')+'"')+circle(-3,-7,5,'#96c7ae','opacity=".20"');
      out+=text(0,-3,'NTC',6,'#c4ddd0');out+=text(0,40,(part.temperature??25)+' °C',6.5,'#5b7971','middle','class="sensor-value"');
      p('1',-.11,.53,'热敏电阻端1');p('2',.11,.53,'热敏电阻端2 · 温度改变电阻');out+=faultMark(17,-18);
    }else if(part.type==='rgbled'&&part.rgbModel==='kingbright-wp154a4'){
      const radius=px(rgbLedVisual.radius),flange=px(rgbLedVisual.flangeRadius),flat=px(-rgbLedVisual.flatX);
      const cut=Math.sqrt(flange*flange-flat*flat),center=-6;
      out+=selectionFrame(66,96);
      for(const {id,x,z} of rgbLedVisual.diagram){
        const pin=componentPin(part,id),tipX=px(x),tipZ=px(z);
        out+=line(px(pin.x),center+radius*.6,tipX,tipZ,'#8b9a9e',2.5);
        out+=text(tipX,tipZ+8,pin.number+' '+pin.id,5.8,'#395d55','middle','class="component-label"');
        partEndpoint(part,pose,pin.id,x,z,rgbLedPinDescription(pin));
      }
      out+='<g class="rgb-lens" data-rgb-model="kingbright-wp154a4">';
      out+=`<path d="M ${-flat} ${center-cut} A ${flange} ${flange} 0 1 1 ${-flat} ${center+cut} Z" fill="#c2c8c6" stroke="#84948f" stroke-width=".8"/>`;
      out+=circle(0,center,radius,'#e5e5e2','class="rgb-core" stroke="#a6b4ae" stroke-width=".8"');
      out+=circle(0,center,radius*.93,ref('led-glass'));
      out+='<ellipse cx="-4.5" cy="-11" rx="4.2" ry="2.4" fill="#fff" opacity=".54"/></g>';
      out+=text(0,-28,'5 mm RGB · 引脚示意',6.7,'#42675d','middle','class="component-label"');
      out+=faultMark(24,-19);
    }else if(part.type==='rgbled'){
      out+=selectionFrame(55,84);
      ['R','G','B','COM'].forEach((name,i)=>{const xx=(i-1.5)*.20,zz=name==='COM' ? .76 : .62;out+=line(px(xx),3,px(xx),px(zz),'#98aaad',2.4)+text(px(xx),px(zz)+8,name,5.3,'#5f8077');p(name,xx,zz,'RGB LED · '+name);});
      out+='<g class="rgb-lens">'+circle(0,-4,30,ref('led-glow'),'class="rgb-glow" opacity="0"')+circle(0,-4,17,'#c4d2cf','class="rgb-core" stroke="#849d98" stroke-width=".8" filter="'+ref('tinyshadow')+'"')+circle(0,-6,14,ref('led-glass'));
      out+=rect(-8,-5,4,4,'#cf6e63',.8)+rect(-2,-5,4,4,'#70ac74',.8)+rect(4,-5,4,4,'#719fcb',.8)+'<ellipse cx="-5" cy="-12" rx="5" ry="2.3" fill="#fff" opacity=".58"/></g>';out+=faultMark(23,-23);
    }else if(part.type==='sevenseg'){
      const {width,depth,segments,decimal,offColor}=sevenSegmentVisual,w=px(width),h=px(depth);
      out+=selectionFrame(w,h)+rect(-w/2,-h/2,w,h,ref('chip'),3,'stroke="#192a32" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=rect(-w/2+2,-h/2+2,w-4,h-4,'#514d58',2,'stroke="#77727c" stroke-width=".6"');
      for(const [name,points] of Object.entries(segments)){
        out+='<polygon data-segment="'+name+'" points="'+points.map(([x,z])=>px(x)+','+px(z)).join(' ')+'" fill="'+offColor+'" stroke="#413b49" stroke-width=".5"/>';
      }
      out+=circle(px(decimal.x),px(decimal.z),px(decimal.radius),offColor,'data-segment="dp"');
      for(const contact of componentPins(pinPart)){
        const x=px(contact.x),y=Math.sign(contact.z)*(h/2+7);
        out+=text(x,y,contact.id,5.8,'#3c635b','middle','class="component-label" transform="rotate('+pose.rotation+' '+x+' '+y+')"');
        p(contact.id,contact.x,contact.z,sevenSegmentPinDescription(part,contact));
      }
      out+=faultMark(w/2+4,-h/2+4);
    }else if(part.type==='grove-relay'){
      const {width,depth,mounts,case:relay,grove,screw,led}=groveRelayVisual;
      const footprint=(body,fill,stroke)=>rect(px(body.x-body.width/2),px(body.z-body.depth/2),
        px(body.width),px(body.depth),fill,3,'stroke="'+stroke+'" stroke-width=".85"');
      out+=selectionFrame(px(4.42),px(2.60));
      out+=rect(-px(width/2),-px(depth/2),px(width),px(depth),'#265d78',4,'stroke="#183f53" stroke-width="1"');
      for(const [x,z] of mounts){
        out+=circle(px(x),px(z),px(.21),'#285d76','stroke="#1b485e" stroke-width=".8"');
        out+=circle(px(x),px(z),px(.112),'#eef3f3','stroke="#193d4d" stroke-width="1"');
      }
      out+=footprint(relay,'#202830','#131a21');
      out+=text(px(relay.x),px(relay.z)-12,'HLS8L',12,'#dce3df','middle','font-weight="700"');
      out+=text(px(relay.x),px(relay.z)+7,'DC3V-S-C',9,'#dce3df');
      out+=text(px(relay.x),px(relay.z)+26,'Grove Relay v1.2',7.8,'#bdcecc');
      out+=footprint(grove,'#eee9d8','#888975');
      out+=rect(px(grove.x-.175),px(-.376),px(.35),px(.752),'#4c5150',2);
      out+=footprint(screw,'#58916c','#2d5d45');
      out+=circle(px(led.x),px(led.z),px(.057),'#7d3338','data-relay-indicator="" stroke="#b56961" stroke-width=".8"');
      out+=text(px(led.x+.195),px(led.z)+1,'SIG',6.5,'#f0e7e6','start','class="component-label"');
      for(const contact of groveRelayVisual.pins){
        const {id,x,z,connector}=contact,xx=px(x),zz=px(z);
        out+='<g data-relay-terminal="'+id+'">';
        if(connector==='screw'){
          const head=px(screw.z);
          out+=circle(xx,head,px(.119),ref('metal'),'stroke="#3a5549" stroke-width=".8"')+
            line(xx-4,head+2,xx+4,head-2,'#465653',1.7);
          out+=rect(xx-6.8,zz-2.7,13.6,4.2,'#213f35',1);
          out+=text(xx,zz+13,id,7.0,'#2b5044','middle','class="component-label"');
        }else{
          out+=circle(xx,zz,px(.050),ref('gold'),'stroke="#6c593c" stroke-width=".7"');
          out+=text(xx-18,zz,id,6.6,'#425f59','end','class="component-label"');
        }
        out+='</g>';
        p(id,x,z,groveRelayPinDescription(contact));
        if(connector==='screw'){
          const {x:offsetX,z:offsetZ}=rotateBoardPoint(0,screw.z-z,pose.rotation);
          endpointMap.get(part.id+':'+id).screwHead={x:px(offsetX),y:px(offsetZ)};
        }
      }
      out+=rect(-11,62,100,15,'#f8efdc',4,'data-relay-contact-chip="" stroke="#b6a482" stroke-width=".55" pointer-events="none"');
      out+=text(39,69,'COM / NO 断开',7.8,'#754516','middle','data-relay-contact="" pointer-events="none"');
    }else if(part.type==='mcp9808'){
      const {width,depth,cornerRadius,header,mounts,connector,chip,powerLed}=mcp9808Visual,w=px(width),h=px(depth);
      out+=selectionFrame(w,h)+rect(-w/2,-h/2,w,h,'#272d30',px(cornerRadius),'stroke="#515d5b" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      for(const [x,z] of mounts){
        out+=circle(px(x),px(z),px(.171),'#b5c0b6')+circle(px(x),px(z),px(.160),ref('gold'))+circle(px(x),px(z),px(.125),'#637372');
      }
      for(const side of [-1,1]){
        const x=side*connector.x;
        for(const z of [-.15,-.05,.05,.15]){
          out+=rect(px(x-side*.242-.058),px(z-.022),px(.116),px(.044),ref('metal'),.4);
        }
        out+=rect(px(x-connector.width/2),-px(connector.depth/2),px(connector.width),px(connector.depth),'#e3dfcf',1.8,'stroke="#a3a698" stroke-width=".75"');
        out+=line(px(x+side*.178),-px(.220),px(x+side*.178),px(.220),'#9c9d8b',1);
        for(const z of [-.0975,-.0325,.0325,.0975]){
          out+=rect(px(side*.199-.061),px(z-.018),px(.122),px(.036),ref('metal'),.45);
        }
      }
      out+=rect(-px(chip.width/2),-px(chip.depth/2),px(chip.width),px(chip.depth),ref('chip'),1.5,'stroke="#75817b" stroke-width=".6"');
      out+=circle(-px(.105),-px(.106),1.1,'#7f8b84')+text(0,2.2,'9808',4.8,'#bdc7c4');
      for(const x of [-.4826,.4826])out+=rect(px(x-.0735),-px(.1535),px(.147),px(.307),ref('chip'),.7,'stroke="#87948c" stroke-width=".65"');
      out+=rect(px(-.568),px(.232),px(.196),px(.126),'#c0a682',.8,'stroke="#bbc6bc" stroke-width=".65"');
      out+=rect(-px(.0735),px(-.294),px(.147),px(.081),'#c0a682',.8,'stroke="#bbc6bc" stroke-width=".65"');
      out+=rect(px(-.665),px(-.385),px(.19),px(.142),ref('gold'),.8);
      out+=circle(px(powerLed.x),px(powerLed.z),px(.043),'#668d52','data-mcp9808-power="" stroke="#94a58f" stroke-width=".6"');
      out+=text(px(.060),px(-.750),'MCP9808',8.2,'#f1f3e6','middle','font-weight="700"');
      out+=text(px(.125),px(-.572),'Temp Sensor',5.9,'#d5e0d4','middle','font-weight="700"');
      for(const [index,contact] of header.entries()){
        const x=px(contact.x),y=px(contact.z),labelY=y+px(index%2===0?.1651:-.1651);
        out+=circle(x,y,px(.0889),ref('gold'))+circle(x,y,px(.050),'#637372');
        out+=text(x,labelY,contact.label,5.35,contact.id?'#f1f3e6':'#bfc8bd','middle','class="component-label" font-weight="700"');
        if(contact.id)p(contact.id,contact.x,contact.z,mcp9808PinDescription(contact));
      }
      out+=faultMark(w/2+2,-h/2+2);
    }else if(part.type==='ssd1306'){
      const {width,depth,outline,glass,active,header,mounts}=ssd1306Visual,w=px(width),h=px(depth);
      const points=outline.map(([x,z])=>px(x)+','+px(z)).join(' ');
      out+=selectionFrame(w,h)+'<polygon points="'+points+'" fill="#272d31" stroke="#505c5e" stroke-width="1" filter="'+ref('tinyshadow')+'"/>';
      for(const [x,z] of mounts){
        out+=circle(px(x),px(z),px(.160),ref('gold'))+circle(px(x),px(z),px(.125),'#6e7b7b');
      }
      header.forEach((contact,index)=>{
        const x=px(contact.x),y=px(contact.z),labelY=y+px(index%2===0?.156:-.149);
        out+=circle(x,y,px(.0889),ref('gold'))+circle(x,y,px(.050),'#6e7b7b');
        out+=text(x,labelY,contact.label,5.5,contact.id?'#eef1e5':'#b5c1b7','middle','class="component-label" font-weight="700"');
        if(contact.id)p(contact.id,contact.x,contact.z,ssd1306PinDescription(contact));
      });
      out+=rect(-px(glass.width/2),px(glass.z-glass.depth/2),px(glass.width),px(glass.depth),'#10161e',1.6,'stroke="#86979b" stroke-width="1.4"');
      out+=rect(-px(active.width/2),px(active.z-active.depth/2),px(active.width),px(active.depth),'#090d12');
      out+='<image data-ssd1306-screen="" pointer-events="none" style="image-rendering:pixelated" x="'+(-px(active.width/2))+'" y="'+px(active.z-active.depth/2)+'" width="'+px(active.width)+'" height="'+px(active.depth)+'" preserveAspectRatio="none"/>';
      out+=rect(-px(.68),px(.68),px(1.36),px(.40),'#a06b30',2)+rect(-px(.60),px(.68),px(1.20),px(.38),'#1b2428',2);
      out+=faultMark(w/2+2,-h/2+2);
    }else if(part.type==='hcsr04'){
      const {width,depth,canRadius,screenRadius,transducers,holes,pins}=hcsr04Visual,w=px(width),h=px(depth);
      out+=selectionFrame(w,h)+rect(-w/2,-h/2,w,h,ref('pcb'),3,'stroke="#20567a" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      for(const [x,z] of holes){
        out+=circle(px(x),px(z),px(.135),ref('metal'))+circle(px(x),px(z),px(.095),'#486873');
      }
      for(const {id,x,z} of transducers){
        const xx=px(x),yy=px(z);
        out+=circle(xx,yy,px(canRadius+.022),'#7a969e','stroke="#b0c3c7" stroke-width=".8"');
        out+=circle(xx,yy,px(canRadius),ref('metal'),'stroke="#f4f7f5" stroke-width=".8"');
        out+=circle(xx,yy,px(screenRadius),ref('sensor-screen'),'stroke="#50656c" stroke-width="1.1"');
        out+=circle(xx,yy,px(canRadius-.010),'none','data-sensor-cue="'+id+'" visibility="hidden" stroke="'+(id==='T'?'#f4b347':'#42dfcb')+'" stroke-width="3" pointer-events="none"');
        out+=text(px(x*1.31),px(.88),id,8.0,'#e4f0ee','middle','font-weight="700"');
      }
      out+=rect(-px(.47),-px(.566),px(.94),px(.308),ref('metal'),6,'stroke="#d8e6e9" stroke-width=".7"');
      out+=text(0,px(-.155),'Y1',5.8,'#d8e9ed')+text(0,px(.24),'HC-SR04',9,'#e6f2ee','middle','font-weight="700"');
      for(const contact of pins){
        const x=px(contact.x),y=px(contact.z);
        out+=circle(x,y,4.1,ref('metal'),'stroke="#d0e1df" stroke-width=".7"');
        out+=text(x,px(.61),contact.label,4.6,'#e0eee8','middle','class="component-label" font-weight="700"');
        p(contact.id,contact.x,contact.z,hcsr04PinDescription(contact));
      }
      const statusY=px(1.18);
      out+=text(0,statusY,'等待触发',8,'#385e57','middle','class="component-label sensor-reading" font-weight="700" transform="rotate('+pose.rotation+' 0 '+statusY+')"');
      out+=faultMark(w/2+2,-h/2+2);
    }else if(part.type==='drv8833'){
      const {width,depth,chip,passives,pins}=drv8833Visual,w=px(width),h=px(depth);
      out+=selectionFrame(w,h)+rect(-w/2,-h/2,w,h,'#218050',2,'stroke="#285c43" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      for(const [x,z,sw,sd,,kind] of passives){
        out+=rect(px(x-sw/2),px(z-sd/2),px(sw),px(sd),kind==='ceramic'?'#bfa276':'#2e383e',1,'stroke="#bfccbf" stroke-width=".6"');
      }
      for(const x of [.01,.27])for(const z of [.66,.86]){
        out+=rect(px(x-.075),px(z-.065),px(.15),px(.13),ref('metal'),.5);
      }
      const {x,z,width:cw,depth:cd}=chip;
      for(const side of [-1,1])for(const offset of [-.12,-.04,.04,.12]){
        out+=rect(px(x+side*cw/2-.026),px(z+offset-.019),px(.052),px(.038),ref('metal'),.3);
        out+=rect(px(x+offset-.019),px(z+side*cd/2-.026),px(.038),px(.052),ref('metal'),.3);
      }
      out+=rect(px(x-cw/2),px(z-cd/2),px(cw),px(cd),ref('chip'),2,'stroke="#1b262b" stroke-width=".5"');
      out+=circle(px(x-.135),px(z-.130),1,'#87908d')+text(px(x),px(z+.025),'8833',5.9,'#cbd3d0');
      for(const contact of pins){
        const xx=px(contact.x),yy=px(contact.z),side=Math.sign(contact.x),labelX=side*(w/2+4.5);
        out+=circle(xx,yy,4.5,ref('metal'),'stroke="#afc5b4" stroke-width=".65"');
        out+=rect(xx-1.65,yy-1.65,3.3,3.3,'#607772',.5);
        out+=text(labelX,yy,contact.label,6.7,'#315d53',side<0?'end':'start','class="component-label" font-weight="700" transform="rotate('+pose.rotation+' '+labelX+' '+yy+')"');
        p(contact.id,contact.x,contact.z,drv8833PinDescription(contact));
      }
      out+=faultMark(w/2+2,-h/2+2);
    }else if(part.type==='motor'&&part.motorModel==='fa130-18100'){
      const {width,caseDepth,noseZ,rearZ,pins}=fa130Visual,w=px(width),half=px(caseDepth/2);
      out+=rect(-w/2-6,px(noseZ)-5,w+12,px(rearZ-noseZ)+11,'none',7,'class="selection-frame" stroke="#19a995" stroke-width="2" stroke-dasharray="5 3"');
      out+=rect(-px(.10),px(noseZ),px(.20),px(-noseZ)-half+4,ref('metal'),1,'stroke="#85989f" stroke-width=".7"');
      out+=rect(-px(.24),-half-8,px(.48),10,ref('metal'),2,'stroke="#8d9ca0" stroke-width=".7"');
      out+=rect(-w/2,-half,w,2*half,ref('metal'),8,'stroke="#87999f" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=line(-w/2+8,-half+11,w/2-8,-half+11,'#edf2f1',1.2);
      out+=rect(-w/2+2,half-13,w-4,px(rearZ)-half+13,ref('chip'),4,'stroke="#435159" stroke-width=".7"');
      for(const contact of pins){
        const x=px(contact.x),z=px(contact.z);
        out+=rect(x-6,z-5,12,15,ref('gold'),2,'stroke="#967d49" stroke-width=".7"');
        out+=circle(x,z,2.6,'#37464a','stroke="#dbc485" stroke-width=".7"');
        out+=text(x,half+5,contact.label,10,'#dde8df');
        p(contact.id,contact.x,contact.z,'FA-130RA-18100 · '+contact.label+' 焊片');
      }
      out+=text(0,-half+26,'FA-130RA',10,'#394f56','middle','font-weight="700"');
      out+=text(0,-half+39,'18100',8,'#51676e');
      out+=text(0,10,'— rpm',12,'#233f42','middle','class="motor-speed" font-weight="700"');
      out+=text(0,24,'暂无读数',7.7,'#465c62','middle','class="motor-direction"');
      const {x,y}=MOTOR_NOSE_VIEW;
      out+=line(7,y,x-8,y,'#607781',1,'stroke-dasharray="2 2"')+circle(x,y,9.2,'#e8f0ed','stroke="#536f71" stroke-width=".9"');
      out+=text(x,y+15,'轴端',7,'#496568');
      out+='<g class="motor-shaft">'+circle(x-5,y,2.1,'#30484e')+'</g>';
      out+=circle(x,y,5.3,'none','class="motor-motion-blur" visibility="hidden" stroke="#506b73" stroke-width="3" stroke-opacity=".56"');
      out+=faultMark(w/2+3,-half+4);
    }else if(part.type==='motor'){
      out+=selectionFrame(76,150)+rect(-4,-68,8,33,ref('metal'),2,'stroke="#738a91" stroke-width=".7"');
      out+=rect(-25,-38,50,79,ref('metal'),17,'stroke="#83969c" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+='<ellipse cx="0" cy="-28" rx="24" ry="10" fill="'+ref('metal')+'" stroke="#83969c" stroke-width=".7"/>';
      out+=rect(-23,23,46,18,'#b6c6c5',7,'stroke="#788c91" stroke-width=".6"');
      out+=rect(-27,-7,4,20,'#4b626b',2)+rect(23,-7,4,20,'#4b626b',2);
      out+='<g class="motor-shaft" transform="rotate(0 0 -59)">'+rect(-21,-62,42,6,'#e1b157',3,'stroke="#aa7b35" stroke-width=".7"')+circle(0,-59,5.5,ref('metal'))+'</g>';
      out+=text(0,-5,'DC MOTOR',6.6,'#5a7077','middle','font-weight="600"')+text(0,8,'0 rpm',6.4,'#5a7077','middle','class="motor-speed"');
      componentPins(part).forEach(pin=>out+=rect(px(pin.x)-2,38,4,px(pin.z)-38,ref('gold'),.7));
      p('+',-.236,.98,'直流电机正极');p('-',.236,.98,'直流电机负极');out+=faultMark(33,-42);
    }else if(part.type==='power'){
      out+=selectionFrame(118,124);
      out+=rect(-59,-47,118,101,ref('white'),6,'stroke="#afbcb8" stroke-width="1" filter="'+ref('shadow')+'"');
      out+=rect(-53,-42,106,90,ref('servo'),4,'stroke="#4a7d92" stroke-width=".6"');
      out+=text(0,-32,'DC POWER',8,'#e7f1f3','middle','font-weight="600"');
      out+=rect(-41,-23,82,27,'#14333b',3,'stroke="#779eaa" stroke-width="1"');
      out+=text(0,-9,Number(part.voltage||0).toFixed(2)+' V',15,'#74e8d3','middle','class="source-voltage" font-family="monospace"');
      [-32,32].forEach(xx=>out+=circle(xx,18,8,ref('black-round'),'stroke="#18313d" stroke-width=".7"')+line(xx,12,xx,15,'#d2dee0',1.2));
      out+=circle(-28,42,7.4,'#bf4b43','stroke="#e6a39a" stroke-width=".6"')+circle(-28,42,2.5,'#2a3c43');
      out+=circle(28,42,7.4,'#26373e','stroke="#748c93" stroke-width=".6"')+circle(28,42,2.5,'#101e26');
      componentPins(part).forEach(pin=>out+=line(px(pin.x),48,px(pin.x),px(pin.z),pin.id==='+'?'#b74e46':'#293e46',3));
      out+=text(-28,32,'+',8,'#e6f0f2')+text(28,32,'−',8,'#e6f0f2');
      p('+',-.51,1.08,'直流电源正极');p('-',.51,1.08,'直流电源负极');out+=faultMark(61,-45);
    }else{
      const model=genericModuleVisual(part,PARTS[part.type]);
      out+=selectionFrame(px(model.width),px(model.height))+rect(-px(model.width/2),-px(model.height/2),px(model.width),px(model.height),'#267f76',4,'stroke="#1e5b59" stroke-width="1" filter="'+ref('tinyshadow')+'"');
      out+=rect(-18,-18,36,36,ref('chip'),2,'stroke="#142e33" stroke-width=".6"');
      out+=text(0,-5,model.tag,6.7,'#d7e7df')+text(0,7,'接口模块',5.4,'#8eb5a9');
      out+=text(0,px(model.height/2)+12,model.name,7.1,'#5a7f74');
      model.pins.forEach(pin=>{out+=line(px(pin.x),px(pin.z),px(pin.x+(pin.x<0?.16:-.16)),px(pin.z),'#b3c5bf',2.6)+text(px(pin.x+(pin.x<0?.20:-.20)),px(pin.z),pin.label,5.4,'#e2f1e5',pin.x<0?'start':'end');p(pin.id,pin.x,pin.z,model.name+' · '+pin.label);});
      out+=faultMark(px(model.width/2)+3,-px(model.height/2)-3);
    }
    out+='</g>';return out;
  }

  // Pin targets sit above the drawn parts so their own leads stay accessible.
  // Hide only breadboard targets covered by a solid part body: invisible SVG
  // circles otherwise receive pointer events through the part drawn underneath.
  function coveredByMountedBoard(position){
    if(boardView?.pose.mounted){
      const {profile,pose}=boardView;
      const {x,z}=rotateBoardPoint(position.x/SCALE-pose.x,position.y/SCALE-pose.z,-pose.rotation);
      return Math.abs(x)<=profile.width/2&&Math.abs(z)<=profile.height/2;
    }
    return false;
  }
  function breadboardPinCovered(endpoint,position){
    if(occupiedSockets.has(endpoint)||coveredByMountedBoard(position))return true;
    if(mountedSevenSegments.some(center=>sevenSegmentObscuresHole(center,{x:position.x/SCALE,z:position.y/SCALE})))return true;
    const padding=6.4;
    for(const part of circuit?.components||[]){
      if(part.hidden||insertedParts.has(part.id))continue;
      const current=drag?.id===part.id?drag.preview:part;
      const angle=(Number(part.rotation)||0)*Math.PI/180;
      const dx=position.x-px(current.x||0),dy=position.y-px(current.z||0);
      const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
      const inRect=(left,top,width,height)=>x>=left-padding&&x<=left+width+padding&&y>=top-padding&&y<=top+height+padding;
      const inCircle=(cx,cy,radius)=>Math.hypot(x-cx,y-cy)<=radius+padding;
      let covered=false;
      switch(part.type){
        case 'led':covered=inCircle(0,-3,15);break;
        case 'resistor':covered=inRect(-21,-7.5,42,15);break;
        case 'button':covered=inRect(-18,-18,36,36);break;
        case 'pot':covered=inRect(-26,-25,52,49);break;
        case 'buzzer':covered=inCircle(0,0,28);break;
        case 'servo':covered=inRect(-49,-83,98,166);break;
        case 'capacitor':covered=inCircle(0,0,15.5);break;
        case 'power':covered=inRect(-59,-47,118,101);break;
        case 'diode':covered=inRect(-15,-7,30,14);break;
        case 'switch':covered=inRect(-22,-18,44,36);break;
        case 'ldr':covered=inCircle(0,-3,17);break;
        case 'thermistor':covered=inCircle(0,-3,12);break;
        case 'rgbled':covered=inCircle(0,-4,17);break;
        case 'sevenseg':covered=inRect(-px(sevenSegmentVisual.width/2),-px(sevenSegmentVisual.depth/2),px(sevenSegmentVisual.width),px(sevenSegmentVisual.depth));break;
        case 'mcp9808':covered=inRect(-px(mcp9808Visual.width/2),-px(mcp9808Visual.depth/2),px(mcp9808Visual.width),px(mcp9808Visual.depth));break;
        case 'grove-relay':covered=inRect(-px(groveRelayVisual.width/2),-px(groveRelayVisual.depth/2),px(groveRelayVisual.width),px(groveRelayVisual.depth));break;
        case 'ssd1306':covered=inRect(-px(ssd1306Visual.width/2),-px(ssd1306Visual.depth/2),px(ssd1306Visual.width),px(ssd1306Visual.depth));break;
        case 'hcsr04':covered=inRect(-px(hcsr04Visual.width/2),-px(hcsr04Visual.depth/2),px(hcsr04Visual.width),px(hcsr04Visual.depth));break;
        case 'drv8833':covered=inRect(-px(drv8833Visual.width/2),-px(drv8833Visual.depth/2),px(drv8833Visual.width),px(drv8833Visual.depth));break;
        case 'motor':{
          const {width,caseDepth,noseZ,rearZ}=fa130Visual;
          covered=part.motorModel==='fa130-18100'
            ?inRect(-px(width/2),-px(caseDepth/2),px(width),px(rearZ+caseDepth/2))||inRect(-px(.12),px(noseZ),px(.24),px(-noseZ-caseDepth/2))
            :inRect(-25,-68,50,109);
          break;
        }
        default:{const visual=genericModuleVisual(part,PARTS[part.type]);covered=inRect(-px(visual.width/2),-px(visual.height/2),px(visual.width),px(visual.height));}
      }
      if(covered)return true;
    }
    return false;
  }
  function refreshBreadboardPinVisibility(){
    for(const [endpoint,group] of terminalElements){
      if(endpoint.startsWith('bb:'))group.style.display=breadboardPinCovered(endpoint,endpointMap.get(endpoint))?'none':'';
    }
  }

  function pinsMarkup(){
    let out='';
    for(const [endpoint,position] of endpointMap){
      const isBreadboard=endpoint.startsWith('bb:'),radius=isBreadboard?6.2:6.3;
      out+='<g class="terminal" data-endpoint="'+esc(endpoint)+'" data-component="'+esc(position.componentId)+'" transform="translate('+position.x+' '+position.y+')"'+(isBreadboard&&breadboardPinCovered(endpoint,position)?' style="display:none"':'')+'>';
      out+='<title>'+esc(position.description)+' · '+esc(endpoint)+'</title>';
      out+=circle(0,0,radius+3.5,'#ffd36b','class="terminal-halo" fill-opacity=".45" stroke="#d19420" stroke-width="1"');
      out+=circle(0,0,isBreadboard?3.2:3.5,'none','class="voltage-ring" stroke="#76a99b" stroke-width=".8" opacity=".10"');
      if(!isBreadboard&&!endpoint.startsWith('mcu:'))out+=circle(0,0,2.0,ref('metal'),'stroke="#718b8b" stroke-width=".55"');
      out+=circle(0,0,radius,'transparent','pointer-events="all"');
      if(position.screwHead){
        const {x,y}=position.screwHead;
        out+=circle(x,y,px(.119),'transparent','pointer-events="all"');
      }
      out+='</g>';
    }
    return out;
  }
  function wiresMarkup(activeDrag=drag){
    let out='';
    (circuit?.wires||[]).forEach((wire,index)=>{
      const a=endpointMap.get(wire.a),b=endpointMap.get(wire.b);if(!a||!b)return;
      const exit=(endpoint,point)=>{
        if(!/:(?:COM|NO)$/.test(endpoint))return point;
        const part=movablePart(point.componentId);
        if(part?.type!=='grove-relay')return point;
        const rotation=activeDrag?.id===part.id?activeDrag.rotation??part.rotation:part.rotation;
        const {x,z}=rotateBoardPoint(0,.30,rotation);
        return {x:point.x+px(x),y:point.y+px(z)};
      };
      const from=exit(wire.a,a),to=exit(wire.b,b);
      const dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy),arc=Math.min(64,14+distance*.14)*(index%3===2?1:-1);
      const d='M '+a.x+' '+a.y+(from!==a?' L '+from.x+' '+from.y:'')+
        ' C '+(from.x+dx*.30)+' '+(from.y+dy*.30+arc)+' '+(from.x+dx*.70)+' '+(from.y+dy*.70+arc)+' '+to.x+' '+to.y+
        (to!==b?' L '+b.x+' '+b.y:'');
      out+='<g class="wire-group'+(selected===wire.id?' is-selected':'')+'" role="button" tabindex="-1" aria-label="导线 '+esc(wire.id)+'，'+esc(wire.a)+' 到 '+esc(wire.b)+'" data-wire="'+esc(wire.id)+'">';
      out+='<path class="wire-visible wire-body" style="pointer-events:stroke" d="'+d+'" fill="none" stroke="'+esc(wire.color||'#e48b52')+'" stroke-width="2.7" stroke-linecap="round" filter="'+ref('wire-shadow')+'"/>';
      out+='<path class="wire-visible" d="'+d+'" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width=".65" stroke-linecap="round"/>';
      [a,b].forEach(point=>{out+=rect(point.x-2.7,point.y-4.0,5.4,8.0,'#263943',1,'pointer-events="none" stroke="#102530" stroke-width=".4"');out+=line(point.x-1.6,point.y-2.5,point.x+1.6,point.y-2.5,'#687b84',.6,'pointer-events="none"');});
      out+='</g>';
    });
    return out;
  }
  function cacheElements(){
    partGroups.clear();terminalElements.clear();
    svg.querySelectorAll('.part-shape[data-component]').forEach(group=>{const id=group.getAttribute('data-component');partGroups.set(id,group);group.setAttribute('tabindex','-1');group.setAttribute('role','button');const part=circuit?.components?.find(item=>item.id===id);group.setAttribute('aria-label',part?componentLabel(part,PARTS[part.type]):id==='mcu'?getBoardProfile(circuit?.boardId).name:'400 孔面包板');});
    pinLayer.querySelectorAll('[data-endpoint]').forEach(group=>{const endpoint=group.getAttribute('data-endpoint');terminalElements.set(endpoint,group);group.setAttribute('tabindex','-1');group.setAttribute('role','button');group.setAttribute('aria-label',endpointMap.get(endpoint)?.description+' · '+endpoint);});
  }
  function setCircuit(next){
    const oldBoardId=circuit?.boardId,firstLoad=!circuit,hadFocus=svg.contains(document.activeElement);
    const previousPose=boardView?.pose;
    cancelInteraction(false);circuit=next;selected=selectionDescriptor(circuit,selected)?.id??null;endpointMap.clear();partGroups.clear();terminalElements.clear();insertedParts.clear();occupiedSockets.clear();mountedSevenSegments.length=0;wiredSockets.clear();
    oledRasters.clear();
    for(const {a,b} of circuit?.wires||[]) {
      if(a.startsWith('bb:'))wiredSockets.add(a);
      if(b.startsWith('bb:'))wiredSockets.add(b);
    }
    svg.setAttribute('aria-label',getBoardProfile(circuit?.boardId).name+' 实物俯视实验台。可接线、按按钮、拖动元件和缩放。');
    if(!circuit){boardView=null;fixedLayer.innerHTML='';partLayer.innerHTML='';wireLayer.innerHTML='';pinLayer.innerHTML='';handleLayer.innerHTML='';previewLayer.innerHTML='';drawPartPlacementPreview();drawProbes();renderBoardHolePicker(true);setSelected(null);return;}
    const profile=getBoardProfile(circuit.boardId),pose=boardPose(circuit,profile);
    boardView={profile,pose};
    for(const part of circuit.components||[]){
      const contacts=mountedPartContacts(part);
      if(contacts.length)insertedParts.add(part.id);
      if(contacts.length&&part.type==='sevenseg')mountedSevenSegments.push(partPose(part,circuit.breadboard));
      for(const {b} of contacts)occupiedSockets.add(b);
    }
    const board=boardMarkup(pose),breadboard=breadboardMarkup(circuit.breadboard||{x:1.8,z:0});
    // The PCB stays above the breadboard when a loose placement overlaps its edge.
    fixedLayer.innerHTML=breadboard+board;
    partLayer.innerHTML=(circuit.components||[]).filter(part=>!part.hidden).map(partMarkup).join('');
    wireLayer.innerHTML=wiresMarkup();pinLayer.innerHTML=pinsMarkup();cacheElements();
    if(pendingPin&&!endpointMap.has(pendingPin)){pendingPin=null;reconnectPending=null;}
    setSelected(selected);update(result,state);renderConnectionPreview();drawPartPlacementPreview();drawProbes();
    if(boardHolePicker)renderBoardHolePicker(true);
    if(firstLoad||oldBoardId!==circuit.boardId||previousPose?.mounted!==pose.mounted)home();
    if(hadFocus)restoreKeyboardFocus();
  }
  function update(nextResult,nextState){
    result=nextResult;state=nextState;
    svg.querySelectorAll('[data-led]').forEach(group=>{
      const id=group.getAttribute('data-led'),data=result?.parts?.[id];
      const brightness=clamp(id==='power-led'?(circuit?.powered?0.85:0):(data?.displayBrightness??data?.brightness??0),0,1);
      const glow=group.querySelector('.led-glow'),core=group.querySelector('.led-core');
      if(glow)glow.setAttribute('opacity',String(brightness*.9));
      if(core)core.style.filter='brightness('+(0.78+brightness*.95)+')';
    });
    partGroups.get('mcu')?.querySelector('.button-cap')?.setAttribute('transform',circuit?.board.userButtonPressed?'scale(.83)':'');
    for(const part of circuit?.components||[]){
      const group=partGroups.get(part.id);if(!group)continue;
      const value=result?.parts?.[part.id];
      if(part.type==='servo'&&Number.isFinite(value?.angle)){
        const hs55=part.servoModel==='hs55';
        const rotation=hs55?value.angle-90:90-value.angle;
        group.querySelector('.servo-horn')?.setAttribute('transform','rotate('+rotation+' 0 '+(hs55?HS55_SERVO_PIVOT:-31)+')');
      }
      if(part.type==='button')group.querySelector('.button-cap')?.setAttribute('transform',part.pressed?'translate(0 1.8) scale(.96)':'');
      if(part.type==='pot')group.querySelector('.pot-knob')?.setAttribute('transform','rotate('+((potPosition(part)-.5)*240)+' 0 -2)');
      if(part.type==='encoder'){
        const {angle,pressed}=encoderAppearance(value);
        group.querySelector('[data-encoder-shaft]')?.setAttribute('transform','rotate('+angle+')'+(pressed?' scale(.94)':''));
      }
      if(part.type==='joystick'){
        const {x,y,pressed}=joystickAppearance(value);
        group.querySelector('[data-joystick-cap]')?.setAttribute('transform','translate('+px(x*.58)+' '+px(-y*.58)+')'+(pressed?' scale(.95)':''));
      }
      if(part.type==='dipswitch'){
        const mask=part.switchMask??0;
        for(const cap of group.querySelectorAll('[data-dip-cap]')){
          cap.setAttribute('y',px(.019-((mask>>Number(cap.dataset.dipCap))&1)*.14));
        }
      }
      if(part.type==='buzzer')group.querySelector('.buzzer-waves')?.setAttribute('opacity',value?.on?'1':'0');
      if(part.type==='power'){const display=group.querySelector('.source-voltage');if(display)display.textContent=Number(part.voltage||0).toFixed(2)+' V';}
      if(part.type==='switch'){
        group.querySelector('.switch-lever')?.setAttribute('transform','translate(0 '+(part.closed?-4:4)+')');
        const display=group.querySelector('.switch-state');if(display)display.textContent=part.closed?'ON · 接通':'OFF · 断开';
      }
      if(part.type==='ldr'||part.type==='thermistor'){
        const display=group.querySelector('.sensor-value');if(display)display.textContent=part.type==='ldr'?(part.lux??100)+' lx':(part.temperature??25)+' °C';
        const cover=group.querySelector('[data-photocell-cover]');
        if(cover)cover.style.display=part.ldrCovered?'':'none';
      }
      if(part.type==='rgbled'){
        const {channels,level,hue}=rgbLedLight(value);
        const named=part.rgbModel==='kingbright-wp154a4';
        const glow=level?Math.min(1,.12+Math.sqrt(level)*.88):0;
        const values=named?hue.map((v,i)=>Math.round([229,229,226][i]*(1-glow)+255*Math.pow(v,1/2.2)*glow))
          :channels.map(v=>Math.round(72+183*v));
        const color='rgb('+values.join(',')+')';
        group.querySelector('.rgb-core')?.setAttribute('fill',color);group.querySelector('.rgb-glow')?.setAttribute('opacity',String(level*.75));
      }
      if(part.type==='sevenseg'){
        const lit=[];
        group.querySelectorAll('[data-segment]').forEach(segment=>{
          const name=segment.getAttribute('data-segment'),level=sevenSegmentIntensity(value,name);
          segment.style.fill=level>0?'color-mix(in srgb, '+sevenSegmentVisual.onColor+' '+Math.min(100,level*260)+'%, '+sevenSegmentVisual.offColor+')':'';
          segment.style.filter=level>.15?'drop-shadow(0 0 '+(level*3)+'px #ff593f99)':'';
          if(level>0)lit.push(name==='dp'?'小数点':name);
        });
        const summary=componentLabel(part,PARTS[part.type])+' · '+(lit.length?'亮段 '+lit.join('、'):'所有段熄灭');
        if(group.getAttribute('aria-label')!==summary)group.setAttribute('aria-label',summary);
      }
      if(part.type==='mcp9808'){
        const lens=group.querySelector('[data-mcp9808-power]');
        const color=value?.powered?'#87e570':'#668d52';
        if(lens.getAttribute('fill')!==color)lens.setAttribute('fill',color);
        const summary=componentLabel(part,PARTS[part.type])+' · '+mcp9808Observation(value,part);
        if(group.getAttribute('aria-label')!==summary)group.setAttribute('aria-label',summary);
      }
      if(part.type==='grove-relay'){
        const {indicator,closed}=groveRelayState(value);
        group.querySelector('[data-relay-indicator]')?.setAttribute('fill',indicator?'#ff3434':'#7d3338');
        group.querySelector('[data-relay-contact-chip]')?.setAttribute('fill',closed?'#d8f4e6':'#f8efdc');
        const contact=group.querySelector('[data-relay-contact]');
        contact?.setAttribute('fill',closed?'#176746':'#754516');
        if(contact)contact.textContent=closed?'COM — NO 闭合':'COM / NO 断开';
      }
      if(part.type==='ssd1306'){
        let raster=oledRasters.get(part.id);
        if(!raster){raster=createSsd1306Raster();oledRasters.set(part.id,raster);}
        if(raster.paint(value)){
          group.querySelector('[data-ssd1306-screen]').setAttribute('href',raster.canvas.toDataURL());
        }
        const text=value?.powered&&value.displayOn?'点亮 '+raster.litCount+' 个像素':'屏幕无显示';
        const summary=componentLabel(part,PARTS[part.type])+' · 128×64 · '+text;
        if(group.getAttribute('aria-label')!==summary)group.setAttribute('aria-label',summary);
      }
      if(part.type==='hcsr04'){
        const {transmitting,receiving,text}=hcsr04Observation(value);
        group.querySelector('[data-sensor-cue="T"]').setAttribute('visibility',transmitting?'visible':'hidden');
        group.querySelector('[data-sensor-cue="R"]').setAttribute('visibility',receiving?'visible':'hidden');
        const readout=group.querySelector('.sensor-reading');
        if(readout.textContent!==text)readout.textContent=text;
        const summary=componentLabel(part,PARTS[part.type])+' · '+text;
        if(group.getAttribute('aria-label')!==summary)group.setAttribute('aria-label',summary);
      }
      if(part.type==='motor'){
        const reading=motorMotion(value),shaft=group.querySelector('.motor-shaft'),display=group.querySelector('.motor-speed');
        if(display&&display.textContent!==reading.speed)display.textContent=reading.speed;
        if(part.motorModel==='fa130-18100'){
          if(reading.angle!==null)shaft.setAttribute('transform','rotate('+reading.angle+' '+MOTOR_NOSE_VIEW.x+' '+MOTOR_NOSE_VIEW.y+')');
          shaft.setAttribute('visibility',reading.blur?'hidden':'visible');
          group.querySelector('.motor-motion-blur').setAttribute('visibility',reading.blur?'visible':'hidden');
          const direction=reading.direction+(reading.blur?' · 轴端运动模糊':''),indicator=group.querySelector('.motor-direction');
          if(indicator.textContent!==direction)indicator.textContent=direction;
          const summary=componentLabel(part,PARTS[part.type])+' · '+reading.speed+' · '+direction;
          if(group.getAttribute('aria-label')!==summary)group.setAttribute('aria-label',summary);
        }else shaft?.setAttribute('transform','rotate('+(reading.angle??0)+' 0 -59)');
      }
      group.classList.toggle('has-fault',(result?.issues||[]).some(issue=>issue.part===part.id&&['error','warning'].includes(issue.severity)));
    }
    for(const [endpoint,group] of terminalElements){
      const value=result?.netVoltages?.[endpoint],ring=group.querySelector('.voltage-ring');
      ring?.setAttribute('stroke',Number.isFinite(value)?value>1.8?'#d7982a':value<.5?'#3286a4':'#69a485':'#6b9a8b');
      ring?.setAttribute('opacity',Number.isFinite(value)?'.85':'.08');
      const title=group.querySelector('title'),description=(endpointMap.get(endpoint)?.description||endpoint)+' · '+endpoint+(Number.isFinite(value)?' · '+value.toFixed(2)+' V':'');if(title)title.textContent=description;group.setAttribute('aria-label',description);
    }
    refreshMcp9808Readout();
    refreshConnectionState();
  }
  function drawWireHandles(){
    const wire=!hooks.isProbePicking?.()&&!hooks.isPartPlacing?.()&&circuit?.wires?.find(item=>item.id===selected);
    if(!wire){handleLayer.innerHTML='';return;}
    handleLayer.innerHTML=['a','b'].map(end=>{
      const point=endpointMap.get(wire[end]);if(!point)return '';
      return '<g class="wire-handle" role="button" tabindex="-1" aria-label="重接导线 '+esc(wire.id)+' 的 '+end.toUpperCase()+' 端 '+esc(wire[end])+'" data-wire-id="'+esc(wire.id)+'" data-wire-handle="'+end+'" transform="translate('+point.x+' '+point.y+')"><title>拖动此端重接 '+end.toUpperCase()+' · '+esc(wire[end])+'</title>'+circle(0,0,8.5,'#fffdf3','stroke="'+(end==='a'?'#278d96':'#c28e25')+'" stroke-width="2" vector-effect="non-scaling-stroke"')+text(0,0,end.toUpperCase(),8,'#385b56','middle','font-weight="700" pointer-events="none"')+'</g>';
    }).join('');
  }
  function movablePart(id){return id==='mcu'?circuit?.board:id==='breadboard'?circuit?.breadboard:circuit?.components?.find(part=>part.id===id);}
  function mountedAssemblyPart(id){
    return boardView?.pose.mounted&&['mcu','breadboard'].includes(id);
  }
  function canMoveAssembly(){return mode==='move'&&!pendingPin&&!reconnectPending&&!circuit?.board?.locked&&!circuit?.breadboard?.locked;}
  function allowBoardDrag(){return Boolean(hooks.onBoardDrop&&!circuit?.board?.locked);}
  function mountedBoardGrab(hit,point){
    if(!mountedAssemblyPart('mcu')||!allowBoardDrag()||!['orbit','move'].includes(mode)||spacePan||pendingPin||reconnectPending||
      hooks.isPartPlacing?.()||hooks.isProbePicking?.())return hit;
    if(hit?.kind==='pin'&&hit.id==='mcu'&&hit.direct){
      const contact=endpointMap.get(hit.endpoint);
      // Keep the wider tap target for wiring. On a drag, its outer halo grabs
      // the PCB body instead of forcing one exact pin to line up with a hole.
      const exact=contact&&Math.hypot(contact.x-point.x,contact.y-point.y)<=.07*SCALE;
      return {kind:'component',id:'mcu',anchor:exact?hit.endpoint:undefined};
    }
    // An exposed breadboard hole keeps its own tap and drag behavior.
    const exposedDeck=!hit||hit.kind==='component'&&hit.id==='breadboard';
    if((exposedDeck||hit?.kind==='wire')&&coveredByMountedBoard(point))return {kind:'component',id:'mcu'};
    return hit;
  }
  function canvasIntent(hit,event){
    if(hooks.isProbePicking?.()){
      if(event.button===1||spacePan||mode==='pan')return 'pan';
      return hit?.kind==='pin'?'probe-pin':'pan';
    }
    if(hooks.isPartPlacing?.()){
      if(event.button===1||spacePan||mode==='pan')return 'pan';
      if(hit?.id&&hooks.isPartPlacing(hit.id))return 'drag';
      return hit?.kind==='pin'&&signalStrip(hit.endpoint)?'part-placement':'pan';
    }
    if(hit?.kind==='pot-knob'&&event.button!==1&&!spacePan&&mode!=='pan'){
      if(pendingPin||reconnectPending)return 'select';
      if(canAdjustPot(hit.id)&&!event.altKey&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey)return 'pot-adjust';
    }
    if(hit?.kind==='encoder-shaft'&&!hooks.onEncoderTurn)hit={kind:'component',id:hit.id};
    if(hit?.kind==='joystick-cap'&&!hooks.onJoystickMove)hit={kind:'component',id:hit.id};
    if(hit?.kind==='dip-slider'&&!hooks.onDipSwitch)hit={kind:'component',id:hit.id};
    if(hit?.kind==='photocell-face'&&!hooks.onPhotocellCover)hit={kind:'component',id:hit.id};
    const allow=allowBoardDrag();
    const target=hit?.id==='breadboard'&&hit.kind!=='wire'&&hit.kind!=='wire-handle'&&allow&&!mountedAssemblyPart('mcu')&&!circuit?.breadboard?.locked&&mode==='orbit'?{...hit,id:'mcu'}:hit;
    return pointerIntent(target,{mode,altKey:event.altKey,spacePan,button:event.button,pendingPin,reconnecting:Boolean(reconnectPending),allowBoardDrag:allow});
  }
  function canAdjustPot(id){
    const part=movablePart(id);
    return Boolean(hooks.onPotAdjust&&mode==='orbit'&&!pendingPin&&!reconnectPending&&part?.type==='pot'&&!part.hidden);
  }
  function wireElement(id){return [...wireLayer.querySelectorAll('[data-wire]')].find(group=>group.getAttribute('data-wire')===id);}
  function announce(message){if(liveRegion.textContent!==message)liveRegion.textContent=message;}
  function refreshMcp9808Readout(){
    const part=circuit?.components?.find(item=>item.id===selected&&item.type==='mcp9808'&&!item.hidden);
    temperatureReadout.hidden=!part;
    if(!part)return;
    const text='MCP9808 · '+mcp9808Observation(result?.parts?.[part.id],part);
    if(temperatureReadout.textContent!==text)temperatureReadout.textContent=text;
  }
  function setSelected(id){
    selected=selectionDescriptor(circuit,id)?.id??null;
    for(const [componentId,group] of partGroups){const active=componentId===selected||selectedParts.has(componentId);group.classList.toggle('is-selected',active);group.setAttribute('aria-pressed',String(active));}
    wireLayer.querySelectorAll('[data-wire]').forEach(group=>group.classList.toggle('is-selected',group.getAttribute('data-wire')===selected));
    syncPressControl();
    drawWireHandles();
    refreshMcp9808Readout();
    refreshConnectionState();
  }
  function syncPressControl(){
    const button=!hooks.isProbePicking?.()&&!hooks.isPartPlacing?.()&&circuit?.components?.find(part=>part.id===selected&&part.type==='button');
    pressControl.hidden=!button;pressControl.dataset.button=button?.id||'';badge.style.color=button?'transparent':'#4a6861';
    pressControl.setAttribute('aria-label',button?'按住 '+button.id+'；松开后释放':'按住选中按键');
  }
  function setPartSelection(ids){selectedParts=new Set(ids);setSelected(selected);}
  function selectPart(id,event){
    setSelected(id);keyboardTarget={kind:'component',id};
    hooks.onSelect?.(id,{additive:Boolean(event?.shiftKey||event?.ctrlKey||event?.metaKey)});
    if(!id)return;
    const part=movablePart(id);
    const placement=id==='mcu'&&mountedAssemblyPart(id)&&hooks.onBoardStep
      ?'已插入面包板。可拖板身换孔，也可用方向键换列或换排。R 打开旋转选项。'
      :insertedParts.has(id)?'已插入面包板。可调整插位，按 R 预览旋转。':'方向键移动，R 旋转。';
    const press=part?.type==='button'&&mode==='orbit'?'按住空格操作按键。':'';
    announce('已选择 '+id+'。'+placement+press+'P 浏览引脚。');
  }
  function onContextMenu(event){
    event.preventDefault();
    if((event.button===2&&rightPanMoved)||svg.dataset.cameraPan||boardHolePicker||hooks.isProbePicking?.()||hooks.isPartPlacing?.())return;
    const target=event.target===svg?document.elementFromPoint(event.clientX,event.clientY):event.target;
    const asTarget=hit=>({
      kind:['wire','wire-handle'].includes(hit?.kind)?'wire':'component',
      id:hit?.kind==='pin'?endpointMap.get(hit.endpoint)?.componentId:hit?.id,
    });
    const picked=asTarget(getHit(target));
    if(hooks.onPickCandidates&&['orbit','move'].includes(mode)&&!pendingPin&&!reconnectPending){
      const candidates=distinctPickTargets([
        picked,
        ...document.elementsFromPoint(event.clientX,event.clientY).filter(element=>svg.contains(element))
          .map(element=>asTarget(getHit(element))),
        ...screenWireHits(event,11).map(({id})=>({kind:'wire',id})),
      ]);
      if(candidates.length>1){cancelInteraction();hooks.onPickCandidates(candidates);return;}
      if(candidates.length===1&&candidates[0].kind==='wire'){selectWire(candidates[0].id);return;}
    }
    if(picked.kind==='wire'&&picked.id)selectWire(picked.id);
    else if(picked.id)hooks.onPartContext?.(picked.id);
  }
  function selectWire(id){setSelected(id);keyboardTarget={kind:'wire',id};if(hooks.onWireSelect)hooks.onWireSelect(id);else hooks.onWire?.(id);announce('已选择导线 '+id+'。A 或 B 重接对应端，Delete 删除。');}
  function screenPoint(event){
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const matrix=svg.getScreenCTM();return matrix?point.matrixTransform(matrix.inverse()):point;
  }
  function screenWireHits(event,radius){
    if(!wireLayer.firstElementChild||!pointerInsideSurface(svg,event))return [];
    const matrix=wireLayer.getScreenCTM();
    if(!matrix)return [];
    const {a,b,c,d,e,f}=matrix;
    const view=[a,b,c,d,e,f].join(',');
    if(projectedWireCache?.first!==wireLayer.firstElementChild||projectedWireCache.view!==view){
      const paths=[...wireLayer.querySelectorAll('.wire-body')].map(path=>{
        let points=wireSamples.get(path);
        if(!points){
          const length=path.getTotalLength();
          const segments=clamp(Math.ceil(length/8),12,80);
          points=Array.from({length:segments+1},(_,index)=>path.getPointAtLength(length*index/segments));
          wireSamples.set(path,points);
        }
        return {id:path.parentNode.dataset.wire,screen:points.map(({x,y})=>({x:a*x+c*y+e,y:b*x+d*y+f}))};
      });
      projectedWireCache={first:wireLayer.firstElementChild,view,paths};
    }
    const hits=[];
    for(const {id,screen} of projectedWireCache.paths){
      const nearest=closestWireSegment(screen,event.clientX,event.clientY,radius);
      if(nearest)hits.push({...nearest,id});
    }
    return hits.sort(compareWireHits);
  }
  function getHit(target){
    if(!(target instanceof Element))return null;
    const handle=target.closest('[data-wire-handle]');if(handle)return {kind:'wire-handle',id:handle.getAttribute('data-wire-id'),end:handle.getAttribute('data-wire-handle')};
    const pin=target.closest('[data-endpoint]');if(pin)return {kind:'pin',endpoint:pin.getAttribute('data-endpoint'),id:pin.getAttribute('data-component'),direct:true};
    const relayTerminal=target.closest('[data-relay-terminal]');
    if(relayTerminal){
      const id=relayTerminal.closest('[data-component]')?.dataset.component;
      if(id)return {kind:'pin',id,endpoint:id+':'+relayTerminal.dataset.relayTerminal,direct:true};
    }
    const reset=target.closest('[data-board-reset]');
    if(reset)return {kind:'board-reset',id:'mcu',label:reset.dataset.boardReset};
    const cap=target.closest('.button-cap');
    if(cap){
      const buttonId=cap.getAttribute('data-button');
      return {kind:'button',id:cap.closest('[data-component]')?.getAttribute('data-component')||buttonId,buttonId};
    }
    const knob=target.closest('[data-pot-knob]');
    if(knob)return {kind:'pot-knob',id:knob.dataset.potKnob};
    const shaft=target.closest('[data-encoder-shaft]');
    if(shaft)return {kind:'encoder-shaft',id:shaft.dataset.encoderShaft};
    const joystick=target.closest('[data-joystick-cap]');
    if(joystick)return {kind:'joystick-cap',id:joystick.dataset.joystickCap};
    const slider=target.closest('[data-dip-slider]');
    if(slider)return {kind:'dip-slider',id:slider.closest('[data-component]').dataset.component,index:Number(slider.dataset.dipSlider)};
    const photocell=target.closest('[data-photocell-face]');
    if(photocell)return {kind:'photocell-face',id:photocell.dataset.photocellFace};
    const wire=target.closest('[data-wire]');if(wire)return {kind:'wire',id:wire.getAttribute('data-wire')};
    const part=target.closest('[data-component]');if(part)return {kind:'component',id:part.getAttribute('data-component')};
    return null;
  }
  function nearestEndpoint(event,occluder=null,accept=()=>true){
    const matrix=svg.getScreenCTM(),bounds=svg.getBoundingClientRect();if(!matrix||event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return null;
    const threshold=event.pointerType==='touch'?22:14;
    let chosen=null,best=threshold*threshold;
    for(const [endpoint,position] of endpointMap){
      if(!accept(endpoint)||terminalElements.get(endpoint)?.style.display==='none')continue;
      // A generous snap zone may not reach through a solid component body.
      if(occluder&&['component','button','pot-knob','encoder-shaft','joystick-cap','dip-slider','photocell-face'].includes(occluder.kind)&&!['mcu','breadboard'].includes(occluder.id)&&position.componentId!==occluder.id)continue;
      const sx=matrix.a*position.x+matrix.c*position.y+matrix.e,sy=matrix.b*position.x+matrix.d*position.y+matrix.f;
      const distance=(sx-event.clientX)**2+(sy-event.clientY)**2;
      if(distance<best){best=distance;chosen={kind:'pin',endpoint,id:position.componentId};}
    }
    return chosen;
  }
  function interactionHit(event,forcePin=false){
    const raw=getHit(document.elementFromPoint(event.clientX,event.clientY)||event.target);
    if(hooks.isProbePicking?.()){
      if(forcePin||raw?.kind==='joystick-cap')return null;
      if(raw?.kind==='pin'&&probeEndpointVisible(raw.endpoint))return raw;
      return nearestEndpoint(event,raw,probeEndpointVisible);
    }
    if(hooks.isPartPlacing?.()){
      if(forcePin)return null;
      if(raw?.id&&hooks.isPartPlacing(raw.id))return raw;
      if(raw?.kind==='pin')return signalStrip(raw.endpoint)?raw:null;
      return raw?.id==='breadboard'?nearestEndpoint(event,raw,signalStrip):null;
    }
    if(raw?.kind==='wire-handle'&&!forcePin&&!pendingPin)return raw;
    if(raw?.kind==='encoder-shaft'||raw?.kind==='joystick-cap')return forcePin?null:raw;
    if(raw?.kind==='board-reset'&&mode==='orbit'&&!forcePin&&!pendingPin&&!reconnectPending&&!spacePan&&!event.altKey&&hooks.onBoardReset)return raw;
    if(raw?.kind==='button'&&raw.id==='mcu'&&mode==='orbit'&&!forcePin&&!pendingPin&&!reconnectPending)return raw;
    if(raw?.kind==='component'&&event.pointerType==='touch'&&!forcePin&&!spacePan&&!event.altKey&&canAdjustPot(raw.id)){
      const matrix=partGroups.get(raw.id)?.querySelector('[data-pot-knob]')?.getScreenCTM();
      if(matrix){
        const center=new DOMPoint(0,-2).matrixTransform(matrix);
        if(nearCompactAdjuster(event.clientX-center.x,event.clientY-center.y,16.4*Math.hypot(matrix.a,matrix.b))){
          return {kind:'pot-knob',id:raw.id};
        }
      }
    }
    const rawPart=raw?.kind==='board-reset'||raw?.kind==='button'&&raw.id==='mcu'?{kind:'component',id:'mcu'}:raw;
    const wirePicking=!forcePin&&!pendingPin&&!reconnectPending&&!spacePan&&['orbit','move'].includes(mode);
    const fixed=raw?.kind==='component'&&['mcu','breadboard'].includes(raw.id);
    if(wirePicking&&(!raw||raw.kind==='wire'||fixed)){
      const radius=event.pointerType==='touch'?(fixed?10:14):(fixed?6:8);
      const wire=screenWireHits(event,radius)[0];
      if(wire)return {kind:'wire',id:wire.id};
    }
    // When re-seating, trust the visible target. A fuzzy pin across the
    // PCB edge must not turn a breadboard or background drag into a lift.
    if(!forcePin&&mountedAssemblyPart('mcu')&&['orbit','move'].includes(mode)&&!pendingPin&&!reconnectPending)return rawPart;
    if(raw?.kind==='pin')return raw;
    if(forcePin||mode==='wire'||pendingPin||!raw||['mcu','breadboard'].includes(raw?.id)){
      const pin=nearestEndpoint(event,raw);if(pin)return pin;
    }
    if(forcePin||raw?.kind==='wire-handle')return null;
    return rawPart;
  }
  function setHover(endpoint){
    if(hoverEndpoint===endpoint)return;
    terminalElements.get(hoverEndpoint)?.classList.remove('is-hovered');hoverEndpoint=endpoint;
    terminalElements.get(hoverEndpoint)?.classList.add('is-hovered');
  }
  function describeEndpoint(endpoint){
    const reading=result?.measureBetween?.(endpoint,'mcu:GND');
    const voltage=reading?.status==='measured'?reading.voltage.toFixed(2)+' V':reading?.status==='floating'?'悬空':'暂无有效读数';
    return endpoint+' · '+voltage;
  }
  function showTooltip(event,hit,boardGrab=false){
    if(!hit||drag?.started||pan){tooltip.style.display='none';return;}
    let content='';
    const probe=hooks.isProbePicking?.();
    if(probe){
      if(hit.kind==='pin')content=(endpointMap.get(hit.endpoint)?.description||hit.endpoint)+'\n点击或按 Enter 放置'+probeLabel(probe);
    }else if(hooks.isPartPlacing?.()){
      if(hit.kind==='pin'&&signalStrip(hit.endpoint))content=(endpointMap.get(hit.endpoint)?.description||hit.endpoint)+'\n点击或按 Enter 选择起始孔';
      else if(hit.id&&hooks.isPartPlacing(hit.id))content='拖动这个元件对准面包板孔位';
    }else if(hit.kind==='pot-knob'&&canvasIntent(hit,event)==='pot-adjust'){
      const part=movablePart(hit.id);
      content=componentLabel(part,PARTS.pot)+'\n横拖旋钮调值，向右增大 · 拖外壳移动\n也可使用元件属性的滑块';
    }else if(hit.kind==='encoder-shaft'&&canvasIntent(hit,event)==='turn-encoder'){
      content='PEC11R 转轴\n向右拖顺时针，向左拖逆时针 · 拖外壳移动\n按压开关在元件属性中操作';
    }else if(hit.kind==='joystick-cap'&&canvasIntent(hit,event)==='adjust-joystick'){
      content='双轴摇杆\n拖动摇杆帽，松开回中 · 拖底板移动\n按压开关在元件属性中操作';
    }else if(hit.kind==='dip-slider'&&canvasIntent(hit,event)==='toggle-dip'){
      const closed=(movablePart(hit.id)?.switchMask??0)&(1<<hit.index);
      content='拨码 '+(hit.index+1)+' · '+(closed?'ON 闭合':'OFF 断开')+'\n轻点切换 · 移动模式可拖外壳';
    }else if(hit.kind==='photocell-face'&&canvasIntent(hit,event)==='toggle-photocell'){
      const covered=Boolean(movablePart(hit.id)?.ldrCovered);
      content='PDV-P8103 光敏电阻\n'+(covered?'点一下移开遮光片':'点一下盖住感光面')+' · 移动模式可拖动';
    }else if(hit.kind==='pin')content=(endpointMap.get(hit.endpoint)?.description||hit.endpoint)+'\n'+describeEndpoint(hit.endpoint)+'\n'+(hooks.getWireSocketIssue?.(hit.endpoint,reconnectPending?.id)||(mode==='wire'?'点两端或拖到另一引脚接线':pendingPin?'点击终点确认接线':'单击选择 · 双击开始接线'));
    else if(hit.kind==='wire'||hit.kind==='wire-handle'){
      const wire=circuit?.wires?.find(item=>item.id===hit.id);
      content=wire?'杜邦线 '+wire.id+'\n'+wire.a+' → '+wire.b+'\n'+(hit.kind==='wire-handle'?'拖到新引脚重接此端':'选择后 A/B 重接对应端，Delete 删除'):'';
    }else if(hit.kind==='button'&&hit.id==='mcu')content='B1 用户按键 · PC13\n按住拉低，松开回到高电平';
    else if(hit.kind==='board-reset')content=hit.label+' · 开发板复位\n点击后松开，重新启动当前程序';
    else if(hit.id==='mcu'){
      const profile=getBoardProfile(circuit?.boardId),pose=boardPose(circuit,profile);
      const hint=circuit?.board?.locked?'开发板已锁定':pose.mounted?'拖动板身调整插位 · R 打开旋转选项'
        :allowBoardDrag()?'拖动板身可移动或插入 · R 旋转':'移动模式可拖板；观察模式拖背景平移';
      content=profile.name+'\n'+boardVisual(profile).pins.length+' 个端点 · 旋转 '+pose.rotation+'°\n'+hint;
    }else if(hit.id==='breadboard')content='400孔面包板\n同列 A–E、F–J 分别相通，上下电源轨隔离\n'+(mountedAssemblyPart(hit.id)||insertedParts.size?'移动模式可拖动整组':'移动模式可拖面包板');
    else{
      const part=circuit?.components?.find(item=>item.id===hit.id);
      if(part){
        const mounted=insertedParts.has(part.id);
        const placement=mounted?'已插入面包板 · 选中后可调整插位或按 R 预览旋转':'直接拖动；方向键微移，Shift 加速，R 旋转';
        const press=hit.kind==='button'?(mounted?'\n观察模式按住黑帽；选中后也可按空格':'\n按黑帽或底栏“按住按键”；拖底座移动\n移动模式或 Alt 拖帽盖不会按下'):'';
        content=componentLabel(part,PARTS[part.type])+'\n'+placement+press;
      }
    }
    if(!content){tooltip.style.display='none';return;}
    if(boardGrab)content+=hit.kind==='pin'&&hit.id==='mcu'&&hit.direct?'\n按住引脚拖到目标孔':'\n拖动板卡换孔';
    tooltip.textContent=content;tooltip.style.display='block';
    const bounds=stage.getBoundingClientRect();
    tooltip.style.maxWidth=Math.min(265,Math.max(1,bounds.width-16))+'px';tooltip.style.overflowWrap='anywhere';
    tooltip.style.left=clamp(event.clientX-bounds.left+16,8,Math.max(8,bounds.width-tooltip.offsetWidth-8))+'px';
    tooltip.style.top=clamp(event.clientY-bounds.top+16,8,Math.max(8,bounds.height-tooltip.offsetHeight-8))+'px';
  }
  function refreshConnectionState(){
    const start=wireGesture?.dragging?wireGesture.start:pendingPin,target=wireGesture?.target||hoverEndpoint;
    if(Boolean(start)!==connectionPending){connectionPending=Boolean(start);hooks.onConnectionPending?.(connectionPending);}
    const reconnect=wireGesture?.reconnect||reconnectPending,plan=start&&target&&target!==start?connectionPlan(circuit,endpointMap,start,target,reconnect,hooks.getWireSocketIssue):null;
    for(const [endpoint,group] of terminalElements){group.classList.toggle('is-pending',endpoint===start);group.classList.toggle('is-available',Boolean(start)&&endpoint!==start&&endpoint!==target&&!wiredSockets.has(endpoint));group.classList.toggle('is-target',Boolean(plan?.ok)&&endpoint===target);}
    const dense=(svg.getScreenCTM()?.a||1)*SCALE*.254<11;
    const heading=reconnect?'重接 '+reconnect.id+' 的 '+reconnect.end.toUpperCase()+' 端':'接线';
    const message=start?heading+'：'+start+' → '+(target&&target!==start?describeEndpoint(target):'请选择终点')+'\n'+(connectionError|| (plan&&!plan.ok?plan.message:'松开鼠标 / 点击 / Enter 确认；Esc 取消。'))+(dense?' 引脚较密，可先放大。':''):connectionError;
    const dock=drag?.boardHit?.candidate;
    const dockAction=boardView?.pose.mounted?'换位':'插入';
    const dockHint=dock?`已对齐 ${dock.rows.join(' / ').toUpperCase()} 排第 ${dock.mount.column} 列 · ${drag.boardHit.review?'松手后确认':'松手'}${dockAction}`:null;
    const dockLegend=dock&&drag.boardHit.anchorHole?'紫圈标出针脚的目标孔':'[ ] 选择元件 · P 浏览针脚 · Esc 取消';
    const probe=hooks.isProbePicking?.(),placing=hooks.isPartPlacing?.();
    const placementStatus=partPlacementPreview?(partPlacementPreview.ok?'孔位已对齐 · 请在工具栏确认':'此位置无法插装 · 请更换起始孔或朝向'):'点击面包板孔位，或拖动元件对齐';
    const potHint=canAdjustPot(selected)?'横拖旋钮调值 · 拖外壳移动':null;
    const shown=boardHolePicker?'点击蓝色孔位，选择开发板的新起始孔\n方向键浏览 · Enter 选择 · Esc 取消'
      :probe?'选择'+probeLabel(probe)+'的接点\nP 浏览引脚 · 方向键移动 · Enter 放置 · Esc 取消'
      :placing?placementStatus+'\nP 浏览孔位 · 方向键移动 · Enter 选择 · Esc 取消'
      :message||(dockHint||(drag?.snap?'已对齐 '+drag.snap.id+' · 接线需手动确认':mode==='wire'?'接线模式 · 点击两个引脚或从起点拖到终点':potHint??'拖动摆放 · 双击引脚开始接线'))+'\n'+dockLegend;
    if(status.dataset.message!==shown){status.dataset.message=shown;const lines=shown.split('\n');statusLine.textContent=lines[0];statusHint.textContent=lines.slice(1).join(' ');status.title=shown;status.setAttribute('aria-label',shown);}
    const invalid=Boolean(placing?partPlacementPreview&&!partPlacementPreview.ok:plan&&!plan.ok||connectionError);status.dataset.state=invalid?'invalid':'ready';status.style.color=invalid?'#9b492e':start?'#695221':'#45685e';status.style.background=invalid?'#fff2e9':start?'#fffbed':'#f7faf8';
  }
  function renderConnectionPreview(){
    const startEndpoint=wireGesture?.dragging?wireGesture.start:pendingPin,targetEndpoint=wireGesture?.target||hoverEndpoint;
    const start=endpointMap.get(startEndpoint),end=targetEndpoint&&targetEndpoint!==startEndpoint?endpointMap.get(targetEndpoint):(wireGesture?.point||lastPointerPoint);
    if(!start||!end){previewLayer.innerHTML='';refreshConnectionState();return;}
    const plan=targetEndpoint&&targetEndpoint!==startEndpoint?connectionPlan(circuit,endpointMap,startEndpoint,targetEndpoint,wireGesture?.reconnect||reconnectPending,hooks.getWireSocketIssue):null;
    const color=plan&&!plan.ok?'#c45c41':'#168e7a',scale=Math.max(.15,Math.abs(svg.getScreenCTM()?.a||1)),radius=8/scale;
    const dx=end.x-start.x,dy=end.y-start.y,arc=Math.min(54,12+Math.hypot(dx,dy)*.12);
    const d='M '+start.x+' '+start.y+' C '+(start.x+dx*.3)+' '+(start.y+dy*.3-arc)+' '+(start.x+dx*.7)+' '+(start.y+dy*.7-arc)+' '+end.x+' '+end.y;
    previewLayer.innerHTML='<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="3" vector-effect="non-scaling-stroke" stroke-dasharray="6 4" stroke-linecap="round"/>'+circle(start.x,start.y,radius*.8,'#fff4cf','stroke="#c3922d" stroke-width="1.7" vector-effect="non-scaling-stroke"')+circle(end.x,end.y,radius,'#f4fff9','stroke="'+color+'" stroke-width="2.2" vector-effect="non-scaling-stroke"');
    refreshConnectionState();
  }
  function commitConnection(a,b,source,reconnect=null){
    const plan=connectionPlan(circuit,endpointMap,a,b,reconnect,hooks.getWireSocketIssue);
    if(!plan.ok){connectionError=plan.message;announce(plan.message);refreshConnectionState();return false;}
    pendingPin=null;reconnectPending=null;wireGesture=null;connectionError='';previewLayer.innerHTML='';refreshConnectionState();
    if(plan.kind==='reconnect')hooks.onReconnectWire?.(plan.id,plan.end,plan.endpoint);
    else if(hooks.onConnect)hooks.onConnect(plan.a,plan.b,{source});
    else{hooks.onPin?.(plan.a);hooks.onPin?.(plan.b);}
    announce(plan.kind==='reconnect'?'已重接 '+plan.id+' 的 '+plan.end.toUpperCase()+' 端':'已连接 '+plan.a+' 到 '+plan.b);
    return true;
  }
  function rejectWireStart(endpoint){
    const issue=hooks.getWireSocketIssue?.(endpoint);
    if(!issue)return false;
    connectionError=issue;announce(issue);refreshConnectionState();return true;
  }
  function clickPin(endpoint){
    if(hooks.isProbePicking?.()){
      if(probeEndpointVisible(endpoint))hooks.onProbePin?.(endpoint);
      return;
    }
    if(hooks.isPartPlacing?.()){
      if(signalStrip(endpoint))hooks.onPartPlacementPin?.(endpoint);
      return;
    }
    connectionError='';
    if(reconnectPending){commitConnection(pendingPin,endpoint,'click',reconnectPending);return;}
    if(pendingPin===endpoint){pendingPin=null;renderConnectionPreview();announce('已取消起点。');return;}
    if(pendingPin){commitConnection(pendingPin,endpoint,'click');return;}
    if(rejectWireStart(endpoint))return;
    pendingPin=endpoint;lastPointerPoint=endpointMap.get(endpoint);renderConnectionPreview();announce('起点 '+endpoint+'。请选择终点。');
  }
  function tapPin(endpoint,event,selectedOnDown=false){
    if(hooks.isProbePicking?.()||hooks.isPartPlacing?.()){clickPin(endpoint);return;}
    if(event.shiftKey||event.ctrlKey||event.metaKey){recentPinTap=null;if(!selectedOnDown)selectPart(endpointMap.get(endpoint)?.componentId,event);return;}
    if(pendingPin){recentPinTap=null;clickPin(endpoint);return;}
    const tap={endpoint,pointerType:event.pointerType,time:event.timeStamp,x:event.clientX,y:event.clientY};
    if(isSecondPinTap(recentPinTap,tap)){recentPinTap=null;clickPin(endpoint);return;}
    recentPinTap=tap;
    if(!selectedOnDown)selectPart(endpointMap.get(endpoint)?.componentId,event);
    if((mode==='orbit'||mode==='move'&&mountedAssemblyPart('mcu')&&endpointMap.get(endpoint)?.componentId==='mcu')&&!spacePan&&!event.altKey)hooks.onInspectPin?.(endpoint);
  }
  function beginReconnect(wireId,end='b'){
    if(boardHolePicker||hooks.isProbePicking?.()||hooks.isPartPlacing?.())return false;
    const wire=circuit?.wires?.find(item=>item.id===wireId);if(!wire||!['a','b'].includes(end)||!endpointMap.has(wire.a)||!endpointMap.has(wire.b))return false;
    cancelInteraction();setSelected(wireId);pendingPin=wire[end==='a'?'b':'a'];reconnectPending={id:wireId,end};lastPointerPoint=endpointMap.get(wire[end]);renderConnectionPreview();svg.focus({preventScroll:true});return true;
  }
  function dragPosition(event,active){
    const point=screenPoint(event);
    const offset=active.rotation===undefined
      ?{x:active.offsetX,z:active.offsetZ}
      :rotateBoardPoint(active.offsetX,active.offsetZ,active.rotation-active.origin.rotation);
    const x=point.x/SCALE+offset.x,z=point.y/SCALE+offset.z;
    return active.repositionBoard?{x,z}:{x:clamp(x,-30,30),z:clamp(z,-20,20)};
  }
  function boardDragThreshold(){
    const matrix=svg.getScreenCTM();
    const pitch=signalPitch*SCALE*Math.hypot(matrix?.a??1,matrix?.b??0);
    return clamp(pitch/2,2,4);
  }
  function boardDropPointer(event,active){
    const point=screenPoint(event),x=point.x/SCALE,z=point.y/SCALE;
    return active.boardAnchor&&active.rotation===undefined?{x,z,anchor:active.boardAnchor}:{x,z};
  }
  function showDockPreview(hit){
    const candidate=hit?.candidate,anchor=hit?.anchorHole;
    const slot=candidate?`${candidate.rows.join('')}:${candidate.mount.column}:${candidate.mount.rotation}:${candidate.breadboard?.x}:${candidate.breadboard?.z}`:'';
    const key=`${slot}:${anchor??''}:${Boolean(hit?.unchanged)}`;
    if(dockPreviewLayer.dataset.mount===key)return;
    dockPreviewLayer.dataset.mount=key;
    const sockets=(candidate?.contacts??[]).map(({b})=>{
      const point=endpointMap.get(b);
      return point?circle(point.x,point.y,5.5,'#b5f5c9','fill-opacity=".54" stroke="#218557" stroke-width="1.4" vector-effect="non-scaling-stroke"'):'';
    }).join('');
    const anchorPoint=anchor&&endpointMap.get(anchor),color=hit?.unchanged?'#819495':candidate?'#6641c4':'#b24139';
    const marker=anchorPoint?circle(anchorPoint.x,anchorPoint.y,8,'none',
      `stroke="${color}" stroke-width="2.4" vector-effect="non-scaling-stroke" data-board-anchor-hole="${esc(anchor)}"`):'';
    dockPreviewLayer.innerHTML=sockets+marker;
  }
  function renderBoardHolePicker(refresh=false){
    const holes=boardHolePicker?.holes??[],key=holes.join('|');
    if(refresh||boardHolePickerLayer.dataset.key!==key){
      boardHolePickerLayer.dataset.key=key;
      boardHolePickerLayer.innerHTML=holes.map(endpoint=>{
        const point=endpointMap.get(endpoint);
        if(!point)return '';
        return circle(point.x,point.y,6.3,'#d2e6ff','fill-opacity=".76" stroke="#2459ba" stroke-width="1.5" vector-effect="non-scaling-stroke" data-board-start-hole="'+esc(endpoint)+'"');
      }).join('');
      if(refresh)delete dockPreviewLayer.dataset.mount;
    }
    showDockPreview(boardHolePicker?.preview??null);
  }
  function setBoardHolePicker(picker){
    if(Boolean(picker)!==Boolean(boardHolePicker)){
      cancelInteraction();
      boardHoleHover=null;
    }
    if(!picker?.holes.includes(boardHoleKeyboard)||
      (picker.selectedHole&&picker.selectedHole!==boardHolePicker?.selectedHole))boardHoleKeyboard=null;
    boardHolePicker=picker;
    if(!picker?.holes.includes(boardHoleHover))boardHoleHover=null;
    svg.toggleAttribute('data-board-hole-picker',Boolean(picker));
    renderBoardHolePicker();
    refreshConnectionState();
  }
  function boardHoleAt(event){
    const matrix=svg.getScreenCTM(),r=svg.getBoundingClientRect(),radius=event.pointerType==='touch'?16:11;
    if(!matrix||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)return null;
    let nearest=null,best=radius*radius;
    for(const endpoint of boardHolePicker.holes){
      const point=endpointMap.get(endpoint);
      if(!point)continue;
      const dx=matrix.a*point.x+matrix.c*point.y+matrix.e-event.clientX;
      const dy=matrix.b*point.x+matrix.d*point.y+matrix.f-event.clientY;
      const distance=dx*dx+dy*dy;
      if(distance<best){best=distance;nearest=endpoint;}
    }
    return nearest;
  }
  function hoverBoardHole(endpoint,keyboard=false){
    if(keyboard){
      boardHoleKeyboard=endpoint;
      hooks.onBoardHoleHover?.(endpoint,{keyboard:true});
      return;
    }
    if(boardHoleHover===endpoint)return;
    boardHoleHover=endpoint;
    if(boardHolePicker.selectedHole||(!endpoint&&boardHoleKeyboard))return;
    boardHoleKeyboard=null;
    hooks.onBoardHoleHover?.(endpoint);
  }
  function keyBoardHolePicker(event){
    if((event.composedPath?.()[0]??event.target)!==svg||svg.ownerDocument.activeElement!==svg)return;
    const step=sceneRotationStep(event);
    if(step&&!down&&!pan&&!pinch&&!spacePan&&!circuit?.board?.locked&&hooks.onRotateBoard){
      event.preventDefault();event.stopPropagation();hooks.onRotateBoard(step);return;
    }
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(event.key)){
      if(event.shiftKey)return;
      event.preventDefault();
      if(down||pan||pinch||spacePan)return;
      const entries=boardHolePicker.holes.flatMap(id=>{
        const point=endpointMap.get(id);
        return point?[{id,x:point.x,y:point.y}]:[];
      });
      const action=boardHoleKeyAction(boardHolePicker,boardHoleKeyboard,entries,event.key,event.repeat);
      if(action?.preview)hoverBoardHole(action.preview,true);
      else if(action?.choose)hooks.onBoardHoleChoose?.(action.choose);
      return;
    }
    if(event.code==='Space'){spacePan=true;svg.style.cursor='grab';event.preventDefault();}
    else if(event.key==='+'||event.key==='='){zoomBy(.8);event.preventDefault();}
    else if(event.key==='-'){zoomBy(1.25);event.preventDefault();}
    else if(event.key==='Home'||event.key==='0'){home();event.preventDefault();}
    else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();}
  }
  function drawPartPlacementPreview(){
    const preview=partPlacementPreview;
    if(!preview||!partGroups.has(preview.id)){
      partPlacementLayer.replaceChildren();
      delete partPlacementLayer.dataset.placementState;
      return;
    }
    const {ok,contacts}=preview;
    const fill=ok?'#b5f5c9':'#ffc5ad';
    const stroke=ok?'#187a50':'#ae492d';
    const style='fill-opacity=".55" stroke="'+stroke+'" stroke-width="2" vector-effect="non-scaling-stroke"'+(ok?'':' stroke-dasharray="3 2"');
    partPlacementLayer.dataset.placementState=ok?'ready':'blocked';
    partPlacementLayer.innerHTML=(contacts??[]).map(({b})=>{
      const point=endpointMap.get(b);
      return point&&signalStrip(b)?circle(point.x,point.y,5.5,fill,style+' data-placement-socket="'+esc(b)+'"'):'';
    }).join('');
  }
  function setPartPlacementPreview(preview){
    partPlacementPreview=preview;
    if(hooks.isPartPlacing?.()&&(pendingPin||wireGesture||activeButton||down?.pot||down?.encoderDrag||down?.joystickDrag))cancelInteraction();
    drawPartPlacementPreview();
    syncPressControl();
    drawWireHandles();
    refreshConnectionState();
  }
  function probeLabel(side){return side==='red'?'红表笔（+）':side==='black'?'黑表笔（−）':'表笔';}
  function probeEndpointVisible(endpoint,active=drag){
    const point=endpointMap.get(endpoint),terminal=terminalElements.get(endpoint);
    if(!point||!terminal||terminal.style.display==='none')return false;
    if(!endpoint.startsWith('bb:'))return true;
    const x=point.x/SCALE,z=point.y/SCALE;
    const candidate=active?.boardHit?.candidate;
    const pose=candidate?.pose||(active?.id==='mcu'?{...boardView.pose,...active.preview}:boardView?.pose);
    if(pose){
      const local=rotateBoardPoint(x-pose.x,z-pose.z,-pose.rotation);
      if(Math.abs(local.x)<=boardView.profile.width/2&&Math.abs(local.z)<=boardView.profile.height/2)return false;
    }
    const breadboard=candidate?.breadboard||(active?.id==='breadboard'?active.preview:circuit?.breadboard);
    return !(circuit?.components??[]).some(part=>{
      if(part.hidden||!insertedParts.has(part.id))return false;
      const bounds=mountedPartBodyBounds(part,partPose(part,breadboard));
      return bounds&&x>bounds.left&&x<bounds.right&&z>bounds.top&&z<bounds.bottom;
    });
  }
  function drawProbes(active=drag){
    if(!probes.red&&!probes.black){if(probeLayer.firstChild)probeLayer.replaceChildren();return;}
    const unit=1/Math.max(.15,Math.abs(svg.getScreenCTM()?.a||1));
    probeLayer.innerHTML=['red','black'].map(side=>{
      const endpoint=probes[side];
      if(!probeEndpointVisible(endpoint,active))return '';
      const {x,y}=endpointMap.get(endpoint),red=side==='red',color=red?'#b92537':'#212d38';
      const tx=x+(red?-9:9)*unit,ty=y-11*unit;
      return '<g data-probe="'+side+'" data-probe-endpoint="'+esc(endpoint)+'">'+
        line(x,y,tx,ty,color,1.6,'vector-effect="non-scaling-stroke"')+
        circle(x,y,(red?3.2:4.8)*unit,'none','stroke="'+color+'" stroke-width="1.6" vector-effect="non-scaling-stroke"')+
        circle(tx,ty,6*unit,color,'stroke="#fff" stroke-width="1.2" vector-effect="non-scaling-stroke"')+
        text(tx,ty+.3*unit,red?'+':'−',10*unit,'#fff','middle','font-weight="700"')+'</g>';
    }).join('');
  }
  function setProbes(next){
    probes={red:next?.red??null,black:next?.black??null};
    const side=hooks.isProbePicking?.();
    if(side&&(pendingPin||recentPinTap||wireGesture||drag||activeButton||down?.pot||down?.encoderDrag||down?.joystickDrag))cancelInteraction();
    instructions.textContent=side?'选择'+probeLabel(side)+'。P 浏览引脚，方向键移动，Enter 放置，Esc 取消。':benchHelp;
    tooltip.style.display='none';
    drawProbes();syncPressControl();drawWireHandles();refreshConnectionState();
  }
  function refreshDraggedPart(active=drag){
    if(!active||!movablePart(active.id))return;
    const candidate=active.boardHit?.candidate;
    const next=candidate?.breadboard||active.preview;
    const preview={...active.preview,rotation:active.rotation??active.origin.rotation};
    const board=active.dockBoard?candidate?.pose||(active.id==='mcu'?{...active.dockBoard,...preview}:active.dockBoard):null;
    const transform=active.id==='breadboard'?'translate('+px(next.x)+' '+px(next.z)+')'
      :boardTransform(board||preview);
    partGroups.get(active.id)?.setAttribute('transform',transform);
    if(active.repositionBoard)boardView.pose=board;
    if(active.relocatingPart)return;
    if(active.id==='breadboard'&&board)partGroups.get('mcu')?.setAttribute('transform',boardTransform(board));
    const dx=next.x-active.origin.x,dz=next.z-active.origin.z;
    for(const [id,origin] of active.attachments){
      const pose={...origin,x:origin.x+dx,z:origin.z+dz};
      if(id==='mcu')boardView.pose=pose;
      partGroups.get(id)?.setAttribute('transform',boardTransform(pose));
    }
    for(const [endpoint,origin] of active.endpointOrigins){
      const info=endpointMap.get(endpoint);
      if(board&&info.componentId==='mcu'){
        const dock=active.dockBoard;
        const rotated=rotateBoardPoint(origin.x/SCALE-dock.x,origin.y/SCALE-dock.z,board.rotation-dock.rotation);
        info.x=px(board.x+rotated.x);info.y=px(board.z+rotated.z);
      }else if(active.rotation!==undefined&&info.componentId===active.id){
        const rotated=rotateBoardPoint(origin.x/SCALE-active.origin.x,origin.y/SCALE-active.origin.z,active.rotation-active.origin.rotation);
        info.x=px(next.x+rotated.x);info.y=px(next.z+rotated.z);
      }else{
        info.x=origin.x+dx*SCALE;info.y=origin.y+dz*SCALE;
      }
      terminalElements.get(endpoint)?.setAttribute('transform','translate('+info.x+' '+info.y+')');
    }
    wireLayer.innerHTML=wiresMarkup(active);refreshBreadboardPinVisibility();drawWireHandles();renderConnectionPreview();drawProbes(active);
  }
  function capture(event){try{if(svg.hasPointerCapture(event.pointerId))return;expectedCaptureRelease.delete(event.pointerId);svg.setPointerCapture(event.pointerId);}catch(_){} }
  function releaseCapture(pointerId){try{if(pointerId!==undefined&&svg.hasPointerCapture(pointerId)){expectedCaptureRelease.add(pointerId);svg.releasePointerCapture(pointerId);}}catch(_){} }
  function pointerMatches(pointerId){return [drag,wireGesture,pan,down,activeButton].some(item=>item?.pointerId===pointerId);}
  function setBoardResetPressed(pressed){
    const cap=partGroups.get('mcu')?.querySelector('[data-reset-cap]');
    cap?.setAttribute('transform',pressed?'scale(.76)':'');
  }
  function startPan(event){
    pan={x:event.clientX,y:event.clientY,view:{...view},scale:svg.getScreenCTM()?.a||1,pointerId:event.pointerId,button:event.button};
    capture(event);tooltip.style.display='none';
  }
  function releaseButton(preserveCapture=false){
    if(!activeButton)return;const press=activeButton;activeButton=null;
    if(press.control){try{if(press.control.hasPointerCapture(press.pointerId))press.control.releasePointerCapture(press.pointerId);}catch(_){}}
    else if(!preserveCapture)releaseCapture(press.pointerId);
    pressControl.setAttribute('aria-pressed','false');hooks.onButton?.(press.id,false);
  }
  function pressButton(id,{pointerId,control=null,keyboard=false}={}){
    if(hooks.isProbePicking?.()||hooks.isPartPlacing?.()||activeButton?.id===id)return;releaseButton();activeButton={id,pointerId,control,keyboard};
    if(control&&pointerId!==undefined){try{control.setPointerCapture(pointerId);}catch(_){}}
    pressControl.setAttribute('aria-pressed','true');hooks.onButton?.(id,true);
  }
  function movePot(press,clientX){
    const pot=press.pot,dx=clientX-press.x;
    const value=dx===0?pot.initial:Math.round(clamp(pot.initial+dx/POT_DRAG_PIXELS,0,1)*100)/100;
    if(!pot.active){
      if(pot.rejected||Math.abs(dx)<4||value===pot.initial)return;
      pot.active=hooks.onPotAdjust(pot.id,'start',pot.initial)===true;
      if(!pot.active){pot.rejected=true;return;}
    }
    if(value===pot.last)return;
    pot.last=value;
    hooks.onPotAdjust(pot.id,'move',value);
  }
  function onPointerDown(event){
    if(![0,1,2].includes(event.button))return;
    if(activeButton?.keyboard)releaseButton();
    if(event.button===2){
      if(!down&&!drag&&!pan&&!wireGesture){
        rightPanMoved=false;svg.focus({preventScroll:true});startPan(event);event.preventDefault();
      }
      return;
    }
    if(event.pointerType==='touch'){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){const points=[...touches.values()];cancelInteraction(true,true);pinch={distance:Math.max(12,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)),x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};for(const id of touches.keys())capture({pointerId:id});event.preventDefault();return;}
    }
    if(down&&down.pointerId!==event.pointerId||activeButton&&activeButton.pointerId!==event.pointerId)return;
    svg.focus({preventScroll:true});
    if(svg.dataset.cameraPan){startPan(event);event.preventDefault();return;}
    if(boardHolePicker){
      const endpoint=event.button===0&&!spacePan&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey?boardHoleAt(event):null;
      event.preventDefault();
      if(endpoint){
        down={x:event.clientX,y:event.clientY,pointerId:event.pointerId,boardHoleEndpoint:endpoint};
        capture(event);hoverBoardHole(endpoint);
      }else startPan(event);
      return;
    }
    const picked=interactionHit(event),point=screenPoint(event),hit=mountedBoardGrab(picked,point);
    const pressed=picked?.kind==='wire'||picked?.kind==='pin'?picked:hit;
    lastPointerPoint=point;connectionError='';
    down={x:event.clientX,y:event.clientY,hit:pressed,pointerId:event.pointerId,probe:hooks.isProbePicking?.()};
    event.preventDefault();
    if(pressed?.kind!=='pin')recentPinTap=null;
    const intent=canvasIntent(hit,event);
    if(event.shiftKey||event.ctrlKey||event.metaKey){capture(event);return;}
    if(intent==='pan'){startPan(event);return;}
    if(intent==='pot-adjust'){
      const initial=potPosition(movablePart(hit.id));
      down.pot={id:hit.id,initial,last:initial,active:false,rejected:false};
      capture(event);selectPart(hit.id,event);tooltip.style.display='none';svg.style.cursor='ew-resize';return;
    }
    if(intent==='turn-encoder'){
      down.encoderDrag={id:hit.id,x:event.clientX,sent:0};
      capture(event);selectPart(hit.id,event);tooltip.style.display='none';svg.style.setProperty('--encoder-cursor','ew-resize');return;
    }
    if(intent==='adjust-joystick'){
      const matrix=partGroups.get(hit.id)?.getScreenCTM();
      const axes=matrix?{xx:matrix.a,xy:-matrix.b,yx:-matrix.c,yy:matrix.d}:null;
      down.joystickDrag=startJoystickDrag(hit.id,event,result?.parts?.[hit.id],axes);
      capture(event);selectPart(hit.id,event);tooltip.style.display='none';svg.style.cursor='grabbing';return;
    }
    if(intent==='probe-pin'){down.probeEndpoint=hit.endpoint;capture(event);tooltip.style.display='none';return;}
    if(intent==='board-reset'){down.resetPress=true;capture(event);setBoardResetPressed(true);tooltip.style.display='none';return;}
    if(intent==='toggle-dip'||intent==='toggle-photocell'){down.partToggle=true;capture(event);tooltip.style.display='none';return;}
    if(intent==='part-placement'){down.partPlacement=true;capture(event);tooltip.style.display='none';return;}
    if(intent==='connect'){capture(event);tooltip.style.display='none';return;}
    if(intent==='reconnect'){
      const wire=circuit?.wires?.find(item=>item.id===hit.id);if(!wire)return;
      wireGesture=wireGestureState(wire[hit.end],wire[hit.end==='a'?'b':'a'],{id:hit.id,end:hit.end},{point,pointerId:event.pointerId,x:event.clientX,y:event.clientY});capture(event);tooltip.style.display='none';return;
    }
    if(intent==='wire'){
      if(!pendingPin&&rejectWireStart(hit.endpoint)){down=null;return;}
      wireGesture=wireGestureState(hit.endpoint,pendingPin,reconnectPending,{point,pointerId:event.pointerId,x:event.clientX,y:event.clientY});capture(event);tooltip.style.display='none';return;
    }
    if(intent==='press'){capture(event);selectPart(hit.id,event);pressButton(hit.buttonId,{pointerId:event.pointerId});tooltip.style.display='none';return;}
    if(intent==='drag'){
      const inserted=insertedParts.has(hit.id),placement=Boolean(hooks.isPartPlacing?.(hit.id));
      if(inserted&&!placement){capture(event);return;}
      const mounted=mountedAssemblyPart(hit.id),repositionBoard=mounted&&hit.id==='mcu';
      const id=hit.id;
      const part=movablePart(id);if(!part||part.locked||mounted&&(repositionBoard?!allowBoardDrag():!canMoveAssembly())){capture(event);return;}
      pendingPin=null;reconnectPending=null;previewLayer.innerHTML='';refreshConnectionState();
      const lead=!placement&&part.type&&part.type!=='power'?endpointMap.get(part.id+':'+componentPins(part,PARTS[part.type])[0]?.id):null;
      const leadOffset=lead?{x:lead.x/SCALE-(part.x||0),z:lead.y/SCALE-(part.z||0)}:null;
      const holes=lead?[...endpointMap].filter(([id,p])=>id.startsWith('bb:')&&!occupiedSockets.has(id)&&!coveredByMountedBoard(p))
        .map(([id,p])=>({id,x:p.x/SCALE,z:p.y/SCALE})):[];
      const origin=repositionBoard?boardView.pose:inserted?partPose(part,circuit.breadboard):{x:part.x||0,z:part.z||0,rotation:Number(part.rotation)||0};
      const attachments=new Map();
      const boardDrop=!placement&&allowBoardDrag()&&(id==='mcu'||id==='breadboard'&&!mounted);
      const dockBoard=boardDrop?boardView.pose:null;
      if(id==='breadboard'){
        if(mounted)attachments.set('mcu',boardView.pose);
        for(const attached of circuit.components||[]){
          if(insertedParts.has(attached.id)&&!attached.hidden)attachments.set(attached.id,partPose(attached,circuit.breadboard));
        }
      }
      const selectedOnDown=!placement&&pressed===hit;
      const threshold=repositionBoard?boardDragThreshold():4;
      drag={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,pointer:event,started:false,origin,offsetX:origin.x-point.x/SCALE,offsetZ:origin.z-point.y/SCALE,preview:origin,attachments,placement,relocatingPart:inserted,boardDrop,dockBoard,repositionBoard,boardAnchor:repositionBoard?hit.anchor:undefined,leadOffset,holes,selectedOnDown,threshold,endpointOrigins:new Map([...endpointMap].filter(([,p])=>p.componentId===id||attachments.has(p.componentId)||(dockBoard&&p.componentId==='mcu')).map(([endpoint,p])=>[endpoint,{x:p.x,y:p.y}]))};
      capture(event);if(selectedOnDown)selectPart(hit.id,event);tooltip.style.display='none';return;
    }
    capture(event);
  }
  function updateDragPreview(event,force=false){
    const active=drag;
    if(event.pointerId!==active.pointerId)return;
    active.pointer=event;
    if(active.id==='mcu'&&active.boardDrop&&!pointerInsideSurface(svg,event)){
      if(active.boardPointer){
        active.boardPointer=null;
        active.boardHit=null;
        showDockPreview(null);
        hooks.onBoardDragEnd?.();
      }
      return;
    }
    if(!active.started&&!force&&Math.hypot(event.clientX-active.x,event.clientY-active.y)<active.threshold)return;
    if(!active.started&&!active.selectedOnDown&&!active.placement)selectPart(active.id,event);
    active.started=true;recentPinTap=null;
    const position=dragPosition(event,active);
    const lead=active.leadOffset;
    const leadOffset=lead&&active.rotation!==undefined?rotateBoardPoint(lead.x,lead.z,active.rotation-active.origin.rotation):lead;
    active.snap=snapEnabled&&!event.altKey&&leadOffset?snapToBreadboard(position,leadOffset,active.holes):null;
    active.preview=active.snap||position;
    if(active.boardDrop){
      const surfacePoint=boardDropPointer(event,active);
      active.boardPointer={x:event.clientX,y:event.clientY,surfacePoint};
      active.boardHit=hooks.onBoardDrag?hooks.onBoardDrag(position.x,position.z,surfacePoint,active.id,active.rotation)??null:undefined;
    }
    refreshDraggedPart();
    if(active.placement)hooks.onPartPlacementDrag?.(active.id,position.x,position.z);
    else if(active.boardDrop)showDockPreview(active.boardHit);
    svg.style.cursor='grabbing';
  }
  function onPointerMove(event){
    if(event.pointerType==='touch'&&touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&touches.size>=2){
      const points=[...touches.values()],distance=Math.max(12,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)),x=(points[0].x+points[1].x)/2,y=(points[0].y+points[1].y)/2;
      zoomBy(pinch.distance/distance,screenPoint({clientX:x,clientY:y}));const scale=svg.getScreenCTM()?.a||1;view.x-=(x-pinch.x)/scale;view.y-=(y-pinch.y)/scale;applyView();pinch={distance,x,y};return;
    }
    if(boardHolePicker&&!pan&&!svg.dataset.cameraPan){
      if(down?.boardHoleEndpoint&&down.pointerId===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>=5)down.boardHoleMoved=true;
      if(!down&&!event.buttons&&!spacePan&&event.pointerType!=='touch')hoverBoardHole(boardHoleAt(event));
      svg.style.cursor=down||boardHoleHover?'crosshair':'grab';
      return;
    }
    if(down?.pot){
      if(down.pointerId===event.pointerId)movePot(down,event.clientX);
      return;
    }
    if(down?.encoderDrag){
      if(down.pointerId===event.pointerId)moveEncoderShaft(down.encoderDrag,event.clientX,hooks.onEncoderTurn);
      return;
    }
    if(down?.joystickDrag){
      if(down.pointerId===event.pointerId)moveJoystickCap(down.joystickDrag,event,hooks.onJoystickMove);
      return;
    }
    if(down?.probeEndpoint&&down.pointerId===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>=5)down.probeEndpoint=null;
    if(down?.resetPress){
      if(down.pointerId===event.pointerId&&!down.resetCancelled&&!boardResetTap(down,event)){
        down.resetCancelled=true;setBoardResetPressed(false);
      }
      return;
    }
    if(down?.partToggle){
      if(down.pointerId===event.pointerId&&!boardResetTap(down,event))down.resetCancelled=true;
      return;
    }
    if(activeButton){
      if(!activeButton.control&&!activeButton.keyboard&&event.pointerId===activeButton.pointerId){const hit=getHit(document.elementFromPoint(event.clientX,event.clientY));if(hit?.kind!=='button'||hit.buttonId!==activeButton.id){releaseButton();down=null;}}
      return;
    }
    if(drag){updateDragPreview(event);return;}
    if(pan){
      if(event.pointerId!==pan.pointerId)return;
      const dx=event.clientX-pan.x,dy=event.clientY-pan.y;
      if(pan.button===2&&!rightPanMoved){
        if(Math.hypot(dx,dy)<4)return;
        rightPanMoved=true;
      }
      view.x=pan.view.x-dx/pan.scale;view.y=pan.view.y-dy/pan.scale;applyView();svg.style.cursor='grabbing';return;
    }
    if(svg.dataset.cameraPan){svg.style.cursor='grab';return;}
    const point=screenPoint(event);lastPointerPoint=point;
    if(wireGesture){
      if(event.pointerId!==wireGesture.pointerId)return;
      if(Math.hypot(event.clientX-wireGesture.x,event.clientY-wireGesture.y)>=4)wireGesture.dragging=true;
      connectionError='';wireGesture.point=point;const pin=interactionHit(event,true);wireGesture.target=pin?.endpoint!==wireGesture.start?pin?.endpoint:null;setHover(wireGesture.target);renderConnectionPreview();svg.style.cursor='crosshair';return;
    }
    const hit=interactionHit(event),grab=mountedBoardGrab(hit,point);setHover(hit?.kind==='pin'?hit.endpoint:null);showTooltip(event,hit,grab!==hit);
    if(pendingPin){connectionError='';renderConnectionPreview();}
    const intent=canvasIntent(grab,event),owner=grab?.id;
    const canDrag=intent==='drag'&&(!insertedParts.has(owner)||hooks.isPartPlacing?.(owner))&&
      (!mountedAssemblyPart(owner)||owner==='mcu'&&allowBoardDrag()||canMoveAssembly());
    if(intent==='pot-adjust')svg.style.setProperty('--pot-cursor','ew-resize');
    else svg.style.removeProperty('--pot-cursor');
    if(intent==='turn-encoder')svg.style.setProperty('--encoder-cursor','ew-resize');
    else svg.style.removeProperty('--encoder-cursor');
    svg.style.cursor=intent==='probe-pin'||intent==='wire'||intent==='connect'||intent==='reconnect'?'crosshair':intent==='pan'||intent==='adjust-joystick'||canDrag?'grab':hit?'pointer':'default';
  }
  function onPointerUp(event){
    touches.delete(event.pointerId);
    if(pinch){if(touches.size<2)pinch=null;releaseCapture(event.pointerId);down=null;return;}
    if(boardHolePicker&&down?.boardHoleEndpoint){
      if(down.pointerId!==event.pointerId)return;
      const press=down;down=null;releaseCapture(event.pointerId);
      if(event.button===0&&!press.boardHoleMoved&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<5&&
        boardHoleAt(event)===press.boardHoleEndpoint)hooks.onBoardHoleChoose?.(press.boardHoleEndpoint);
      return;
    }
    if(down?.pot){
      const press=down,pot=press.pot;
      if(press.pointerId!==event.pointerId)return;
      if(event.button===0)movePot(press,event.clientX);
      if(down!==press)return;
      down=null;releaseCapture(event.pointerId);svg.style.cursor='default';
      if(pot.active)hooks.onPotAdjust(pot.id,event.button===0?'commit':'cancel',event.button===0?pot.last:pot.initial);
      return;
    }
    if(down?.encoderDrag){
      if(down.pointerId!==event.pointerId)return;
      const press=down;
      if(event.button===0)moveEncoderShaft(press.encoderDrag,event.clientX,hooks.onEncoderTurn);
      if(down!==press)return;
      down=null;releaseCapture(event.pointerId);svg.style.removeProperty('--encoder-cursor');return;
    }
    if(down?.joystickDrag){
      if(down.pointerId!==event.pointerId)return;
      const joystick=down.joystickDrag;
      down=null;releaseCapture(event.pointerId);svg.style.cursor='default';
      releaseJoystickCap(joystick,hooks.onJoystickMove);return;
    }
    if(down?.resetPress){
      if(down.pointerId!==event.pointerId)return;
      const reset=event.button===0&&boardResetTap(down,event)&&interactionHit(event)?.kind==='board-reset';
      down=null;releaseCapture(event.pointerId);setBoardResetPressed(false);
      if(reset)hooks.onBoardReset?.();
      return;
    }
    if(down?.partToggle){
      if(down.pointerId!==event.pointerId)return;
      const press=down,hit=event.button===0&&boardResetTap(press,event)?interactionHit(event):null;
      down=null;releaseCapture(event.pointerId);
      if(hit?.kind===press.hit.kind&&hit.id===press.hit.id&&hit.index===press.hit.index){
        selectPart(hit.id,event);
        if(hit.kind==='dip-slider')hooks.onDipSwitch?.(hit.id,hit.index);
        else hooks.onPhotocellCover?.(hit.id);
      }
      return;
    }
    if(activeButton){if(event.pointerId!==undefined&&activeButton.pointerId!==event.pointerId)return;down=null;releaseButton();return;}
    if(drag){
      if(event.pointerId!==undefined&&drag.pointerId!==event.pointerId)return;
      if(event.button!==0||drag.id==='mcu'&&drag.boardDrop&&!pointerInsideSurface(svg,event)){
        cancelInteraction();return;
      }
      // A quick drag may reach pointerup before the browser sends a move.
      if((!drag.started&&drag.repositionBoard)||(drag.rotation!==undefined&&!drag.boardDrop))updateDragPreview(event);
      if(!drag)return;
      const moved=drag,pressed=down?.hit;drag=null;down=null;releaseCapture(moved.pointerId);
      if(moved.started){
        const boardDrop=moved.boardDrop;
        const last=moved.boardPointer;
        const samePointer=last?.x===event.clientX&&last?.y===event.clientY;
        const position=moved.placement||boardDrop&&!samePointer?dragPosition(event,moved):moved.preview;
        const x=Math.round(position.x*1000)/1000,z=Math.round(position.z*1000)/1000;
        if(moved.placement){
          moved.preview=moved.origin;refreshDraggedPart(moved);
          hooks.onPartPlacementDrop?.(moved.id,x,z);
        }else if(boardDrop){
          const surfacePoint=samePointer?last.surfacePoint:boardDropPointer(event,moved);
          const hit=samePointer?moved.boardHit:hooks.onBoardDrag
            ? hooks.onBoardDrag(position.x,position.z,surfacePoint,moved.id,moved.rotation)??null : undefined;
          const rotation=moved.rotation;
          moved.boardHit=null;moved.preview=moved.origin;moved.rotation=undefined;refreshDraggedPart(moved);
          showDockPreview(null);hooks.onBoardDragEnd?.();hooks.onBoardDrop(x,z,hit?.mount??null,surfacePoint,moved.id,hit,rotation);
        }else if(moved.attachments.size||moved.id==='breadboard'&&insertedParts.size){
          moved.preview=moved.origin;refreshDraggedPart(moved);
          hooks.onMove?.('breadboard',x,z);
        }else{
          const rotation=moved.rotation;
          if(rotation!==undefined){
            moved.preview=moved.origin;moved.rotation=undefined;refreshDraggedPart(moved);
          }
          hooks.onMove?.(moved.id,x,z,rotation);announce('已移动 '+moved.id+'，可用撤销恢复。');
        }
      }
      else if(!moved.placement&&Math.hypot(event.clientX-moved.x,event.clientY-moved.y)<5){
        if(pressed?.kind==='pin')tapPin(pressed.endpoint,event,moved.selectedOnDown);
        else if(pressed?.kind==='wire')selectWire(pressed.id);
      }
      svg.style.cursor='default';return;
    }
    if(wireGesture){
      if(event.pointerId!==undefined&&wireGesture.pointerId!==event.pointerId)return;
      const gesture=wireGesture,target=interactionHit(event,true)?.endpoint;wireGesture=null;down=null;releaseCapture(gesture.pointerId);setHover(target);
      if(gesture.dragging){if(!commitConnection(gesture.start,target,'drag',gesture.reconnect)){pendingPin=gesture.start;reconnectPending=gesture.reconnect;renderConnectionPreview();}}
      else if(gesture.reconnect){
        pendingPin=gesture.start;reconnectPending=gesture.reconnect;
        if(gesture.clickedEndpoint&&gesture.clickedEndpoint!==circuit?.wires?.find(w=>w.id===gesture.reconnect.id)?.[gesture.reconnect.end])clickPin(gesture.clickedEndpoint);else renderConnectionPreview();
      }else clickPin(gesture.clickedEndpoint);
      return;
    }
    if(pan&&event.pointerId!==pan.pointerId)return;
    const press=down;down=null;if(pan){const ended=pan;pan=null;releaseCapture(ended.pointerId);}
    if(press&&event.pointerId===press.pointerId&&event.button===0){
      if(Math.hypot(event.clientX-press.x,event.clientY-press.y)<5){
        const hit=press.hit,probe=hooks.isProbePicking?.();
        if(press.probe||probe){
          if(probe&&press.probe===probe&&press.probeEndpoint&&interactionHit(event)?.endpoint===press.probeEndpoint)clickPin(press.probeEndpoint);
        }else if(hooks.isPartPlacing?.()){if(press.partPlacement)clickPin(hit.endpoint);}
        else if(hit?.kind==='wire')selectWire(hit.id);else if(hit?.kind==='pin')tapPin(hit.endpoint,event);else if(hit?.id)selectPart(hit.id,event);else if(!pendingPin&&mode==='orbit')selectPart(null);
      }
      else recentPinTap=null;
    }
    releaseCapture(press?.pointerId);svg.style.cursor=svg.dataset.cameraPan?'grab':'default';
  }
  function cancelInteraction(restore=true,preserveTouches=false){
    if(down?.resetPress)setBoardResetPressed(false);
    const pot=down?.pot,joystick=down?.joystickDrag,moved=drag,pointerIds=[drag?.pointerId,wireGesture?.pointerId,pan?.pointerId,down?.pointerId,...touches.keys()];
    drag=null;wireGesture=null;pan=null;down=null;pendingPin=null;recentPinTap=null;reconnectPending=null;pinch=null;connectionError='';
    if(!preserveTouches)touches.clear();for(const pointerId of pointerIds)if(!preserveTouches||!touches.has(pointerId))releaseCapture(pointerId);releaseButton(preserveTouches&&touches.has(activeButton?.pointerId));
    if(pot?.active)hooks.onPotAdjust(pot.id,'cancel',pot.initial);
    releaseJoystickCap(joystick,hooks.onJoystickMove);
    setHover(null);previewLayer.innerHTML='';tooltip.style.display='none';svg.style.cursor='default';svg.style.removeProperty('--pot-cursor');svg.style.removeProperty('--encoder-cursor');refreshConnectionState();
    if(moved?.started){
      if(moved.placement){
        if(restore&&circuit){moved.preview=moved.origin;refreshDraggedPart(moved);}
        hooks.onPartPlacementDragCancel?.(moved.id);
      }else if(restore&&circuit)setCircuit(circuit);
      if(moved.boardDrop){showDockPreview(null);hooks.onBoardDragEnd?.();}
    }
  }
  function onPointerCancel(event){if(pointerMatches(event.pointerId)||touches.has(event.pointerId)){touches.delete(event.pointerId);cancelInteraction();}}
  function onLostPointerCapture(event){if(expectedCaptureRelease.delete(event.pointerId))return;if(pointerMatches(event.pointerId)||touches.has(event.pointerId))cancelInteraction();}
  function onPointerLeave(){if(boardHolePicker&&!down&&!pan)hoverBoardHole(null);if(!drag&&!pan&&!wireGesture&&!activeButton&&!down?.pot&&!down?.encoderDrag&&!down?.joystickDrag){tooltip.style.display='none';svg.style.removeProperty('--pot-cursor');svg.style.removeProperty('--encoder-cursor');setHover(null);}}
  function onWheel(event){event.preventDefault();if(down?.pot||down?.encoderDrag||down?.joystickDrag)return;zoomBy(Math.exp(clamp(event.deltaY,-120,120)*.0018),screenPoint(event));tooltip.style.display='none';renderConnectionPreview();}
  function focusEndpoint(endpoint,inspect=false){
    const element=terminalElements.get(endpoint),point=endpointMap.get(endpoint);if(!element||element.style.display==='none'||!point)return false;
    const probe=hooks.isProbePicking?.();
    if(probe&&!probeEndpointVisible(endpoint))return false;
    keyboardTarget={kind:'pin',endpoint};const margin=view.w*.06;
    if(point.x<view.x+margin||point.x>view.x+view.w-margin||point.y<view.y+margin||point.y>view.y+view.h-margin){view.x=point.x-view.w/2;view.y=point.y-view.h/2;applyView();}
    element.focus({preventScroll:true});setHover(endpoint);lastPointerPoint=point;
    const matrix=svg.getScreenCTM();if(matrix)showTooltip({clientX:matrix.a*point.x+matrix.c*point.y+matrix.e,clientY:matrix.b*point.x+matrix.d*point.y+matrix.f},{kind:'pin',endpoint});
    const placing=hooks.isPartPlacing?.();
    if(pendingPin)renderConnectionPreview();announce(probe?point.description+'。按 Enter 放置'+probeLabel(probe)+'。':placing?point.description:describeEndpoint(endpoint));
    if(inspect&&!probe&&!placing&&mode==='orbit'&&!pendingPin&&!reconnectPending)hooks.onInspectPin?.(endpoint);
    return true;
  }
  function locatePin(endpoint){
    recentPinTap=null;
    return focusEndpoint(endpoint);
  }
  function startWireAt(endpoint){
    const terminal=terminalElements.get(endpoint);
    if(boardHolePicker||hooks.isProbePicking?.()||hooks.isPartPlacing?.()||!terminal||terminal.style.display==='none'||!endpointMap.has(endpoint)||rejectWireStart(endpoint))return false;
    cancelInteraction();
    locatePin(endpoint);
    clickPin(endpoint);
    return true;
  }
  function restoreKeyboardFocus(){
    if(keyboardTarget?.kind==='pin'&&focusEndpoint(keyboardTarget.endpoint))return;
    const id=keyboardTarget?.id||selected;
    const element=keyboardTarget?.kind==='wire'?wireElement(id):id==='mcu'?svg:partGroups.get(id);
    (element||svg).focus({preventScroll:true});
  }
  function cycleSelection(direction){
    const ids=[...partGroups.keys(),...(circuit?.wires||[]).map(wire=>wire.id)];if(!ids.length)return;
    const index=ids.indexOf(selected),next=ids[(index+direction+ids.length)%ids.length];
    if(circuit?.wires?.some(wire=>wire.id===next))selectWire(next);else selectPart(next);restoreKeyboardFocus();
  }
  function onKey(event){
    if(event.defaultPrevented||event.ctrlKey||event.metaKey)return;
    if(boardHolePicker&&(event.altKey||event.getModifierState?.('AltGraph')||event.isComposing||
      event.keyCode===229||event.shiftKey&&event.key==='Escape'))return;
    const key=event.key.toLowerCase(),hit=getHit(event.target),focusedPin=hit?.kind==='pin'?hit.endpoint:null;
    const probe=hooks.isProbePicking?.(),placing=hooks.isPartPlacing?.();
    if(svg.dataset?.cameraPan){
      if(event.altKey||event.getModifierState?.('AltGraph')||event.isComposing||event.keyCode===229)return;
      const direction={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]}[event.key];
      if(event.key==='Escape'&&!event.shiftKey){
        cancelInteraction();hooks.onCameraExit?.();event.stopPropagation();
      }else if(direction)panBy(...direction);
      else if(event.key==='+'||event.key==='=')zoomBy(.8);
      else if(event.key==='-')zoomBy(1.25);
      else if(event.key==='0'||event.key==='Home')home();
      else return;
      event.preventDefault();return;
    }
    if(event.key==='Escape'){
      event.preventDefault();cancelInteraction();keyboardTarget=null;svg.focus({preventScroll:true});
      if(boardHolePicker){event.stopPropagation();hooks.onBoardHoleCancel?.();}
      else if(probe){event.stopPropagation();hooks.onCancelProbe?.();announce('已取消选择表笔。');}
      else announce('操作已取消，电路保持原样。');
      return;
    }
    if(boardHolePicker){keyBoardHolePicker(event);return;}
    if(drag){
      const step=sceneRotationStep(event);
      const focused=(event.composedPath?.()[0]??event.target)===svg&&svg.ownerDocument.activeElement===svg;
      if(step&&focused&&drag.pointer&&drag.id!=='breadboard'&&!drag.placement&&!drag.relocatingPart&&
        !probe&&!placing&&!movablePart(drag.id)?.locked){
        drag.rotation=((drag.rotation??drag.origin.rotation)+step+360)%360;
        event.preventDefault();event.stopPropagation();
        updateDragPreview(drag.pointer,true);
        announce('已预览 '+drag.rotation+'°，松手放置，Esc 取消。');
      }
      return;
    }
    if(down?.encoderDrag||down?.joystickDrag){
      if(event.key!=='Tab'){event.preventDefault();event.stopPropagation();}
      return;
    }
    if(!probe&&!placing&&(event.key==='['||event.key===']')){event.preventDefault();cycleSelection(event.key===']'?1:-1);return;}
    const allowedPin=id=>probe?probeEndpointVisible(id):!placing||Boolean(signalStrip(id));
    if(focusedPin&&allowedPin(focusedPin)){
      if(event.key==='Enter'||!probe&&event.code==='Space'){event.preventDefault();if(!event.repeat)clickPin(focusedPin);return;}
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(directions[event.key]){event.preventDefault();const next=directionalEndpoint([...endpointMap].map(([id,point])=>({id,...point,hidden:terminalElements.get(id)?.style.display==='none'||!allowedPin(id)})),focusedPin,directions[event.key]);if(next)focusEndpoint(next,true);return;}
    }
    if((probe||placing)&&(key==='p'||event.key==='Enter')){
      event.preventDefault();
      const visible=[...terminalElements].filter(([endpoint,element])=>element.style.display!=='none'&&allowedPin(endpoint));
      const start=probe&&visible.find(([endpoint])=>endpointMap.get(endpoint)?.componentId===selected)||visible[0];
      if(start)focusEndpoint(start[0]);
      return;
    }
    if(event.key==='+'||event.key==='='){zoomBy(.8);event.preventDefault();return;}
    if(event.key==='-'){zoomBy(1.25);event.preventDefault();return;}
    if(event.key==='0'||event.key==='Home'){home();event.preventDefault();return;}
    if(probe||placing){
      if(event.code==='Space'){spacePan=true;svg.style.cursor='grab';event.preventDefault();}
      if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();}
      return;
    }
    if(key==='f'&&!event.altKey&&!event.isComposing&&event.keyCode!==229&&!event.repeat&&focusSelection()){
      event.preventDefault();return;
    }
    const wire=circuit?.wires?.find(item=>item.id===selected),part=movablePart(selected);
    if(wire){
      if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();if(connectionPending)return;cancelInteraction();if(hooks.onDeleteWire)hooks.onDeleteWire(wire.id);else hooks.onWire?.(wire.id);return;}
      if(key==='a'||key==='b'||key==='p'||event.key==='Enter'){event.preventDefault();const end=key==='a'?'a':'b';beginReconnect(wire.id,end);focusEndpoint(wire[end]);return;}
    }
    if((key==='p'||event.key==='Enter')&&part){event.preventDefault();const first=[...endpointMap].find(([id,point])=>point.componentId===selected&&terminalElements.get(id)?.style.display!=='none');if(first)focusEndpoint(first[0],true);return;}
    if(event.code==='Space'){
      event.preventDefault();if(part?.type==='button'&&mode==='orbit'){if(!event.repeat)pressButton(part.id,{keyboard:true});}else{spacePan=true;svg.style.cursor='grab';}return;
    }
    const placementIdle=(mode==='orbit'||mode==='move')&&!pendingPin&&!reconnectPending&&!wireGesture&&!drag&&!down&&!pan&&!pinch&&!activeButton&&!spacePan;
    const focused=(event.composedPath?.()[0]??event.target)===svg&&svg.ownerDocument.activeElement===svg;
    const rotationStep=placementIdle&&(selected!=='mcu'||focused)?sceneRotationStep(event):0;
    if(rotationStep&&selected==='mcu'&&part&&!part.locked&&hooks.onRotateBoard){
      event.preventDefault();hooks.onRotateBoard(rotationStep);return;
    }
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
    if(direction&&placementIdle&&selected==='mcu'&&part&&!part.locked&&mountedAssemblyPart(selected)&&hooks.onBoardStep&&
      !event.altKey&&!event.isComposing&&event.keyCode!==229&&!event.repeat){
      event.preventDefault();hooks.onBoardStep(...direction);return;
    }
    if(!part||part.locked||part.hidden||(['mcu','breadboard'].includes(selected)&&mode!=='move'))return;
    if(insertedParts.has(selected)){
      if(rotationStep&&hooks.onPartPlacementRotate){
        event.preventDefault();hooks.onPartPlacementRotate(part.id,rotationStep/90);
      }
      return;
    }
    if(rotationStep&&part.id){event.preventDefault();hooks.onRotate?.(part.id,((Number(part.rotation)||0)+rotationStep+360)%360);return;}
    if(direction){
      event.preventDefault();
      const mounted=mountedAssemblyPart(selected);
      if(mounted&&selected==='mcu'){announce('可在“调整插位”选择开发板孔位。');return;}
      if(mounted&&!canMoveAssembly())return;
      const id=selected,position=movablePart(id),step=event.shiftKey?.254:.05;
      if(position)hooks.onMove?.(id,Math.round(((position.x||0)+direction[0]*step)*1000)/1000,Math.round(((position.z||0)+direction[1]*step)*1000)/1000);
    }
  }
  function onKeyUp(event){if(event.code==='Space'){spacePan=false;svg.style.cursor='default';if(activeButton?.keyboard)releaseButton();}}
  function onFocusIn(){svg.style.boxShadow='inset 0 0 0 2px #238f7d';}
  function onFocusOut(event){if(!svg.contains(event.relatedTarget)){svg.style.boxShadow='';spacePan=false;if(activeButton?.keyboard&&!activeButton.control)releaseButton();if(drag?.repositionBoard||drag?.rotation!==undefined||down?.partToggle||down?.pot||down?.encoderDrag||down?.joystickDrag)cancelInteraction();}}
  function onBlur(){spacePan=false;cancelInteraction();}
  pressControl.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();const id=pressControl.dataset.button;if(id)pressButton(id,{pointerId:event.pointerId,control:pressControl});});
  pressControl.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();if(!event.repeat&&pressControl.dataset.button)pressButton(pressControl.dataset.button,{control:pressControl,keyboard:true});}});
  pressControl.addEventListener('keyup',event=>{if(['Enter',' '].includes(event.key)&&activeButton?.control===pressControl)releaseButton();});
  pressControl.addEventListener('blur',()=>{if(activeButton?.control===pressControl)releaseButton();});
  pressControl.addEventListener('lostpointercapture',event=>{if(activeButton?.control===pressControl&&activeButton.pointerId===event.pointerId)releaseButton();});
  svg.addEventListener('pointerdown',onPointerDown);svg.addEventListener('pointermove',onPointerMove);svg.addEventListener('pointerleave',onPointerLeave);svg.addEventListener('lostpointercapture',onLostPointerCapture);
  svg.addEventListener('wheel',onWheel,{passive:false});svg.addEventListener('keydown',onKey);svg.addEventListener('keyup',onKeyUp);svg.addEventListener('focusin',onFocusIn);svg.addEventListener('focusout',onFocusOut);
  svg.addEventListener('contextmenu',onContextMenu);
  window.addEventListener('pointerup',onPointerUp);window.addEventListener('pointercancel',onPointerCancel);window.addEventListener('blur',onBlur);
  return {
    view:'2d',setCircuit,update,setSelected,setPartSelection,setPartPlacementPreview,setBoardHolePicker,setProbes,home,top:home,focusSelection,focusBoard:()=>focusComponent('mcu'),cancelInteraction,locatePin,startWireAt,beginReconnect,
    setSnapEnabled(enabled){snapEnabled=enabled;},
    setMode(next){cancelInteraction();mode=['orbit','wire','move','pan'].includes(next)?next:'orbit';refreshConnectionState();},
    setCameraMode(next){
      const panning=next==='pan';
      if(Boolean(svg.dataset.cameraPan)===panning)return;
      cancelInteraction();
      if(panning)svg.dataset.cameraPan='active';else delete svg.dataset.cameraPan;
      svg.style.cursor=panning?'grab':'default';
    },
    resize(){applyView();},
    dispose(){
      if(disposed)return;disposed=true;cancelInteraction(false);
      svg.removeEventListener('pointerdown',onPointerDown);svg.removeEventListener('pointermove',onPointerMove);svg.removeEventListener('pointerleave',onPointerLeave);svg.removeEventListener('lostpointercapture',onLostPointerCapture);
      svg.removeEventListener('wheel',onWheel);svg.removeEventListener('keydown',onKey);svg.removeEventListener('keyup',onKeyUp);svg.removeEventListener('focusin',onFocusIn);svg.removeEventListener('focusout',onFocusOut);
      svg.removeEventListener('contextmenu',onContextMenu);
      window.removeEventListener('pointerup',onPointerUp);window.removeEventListener('pointercancel',onPointerCancel);window.removeEventListener('blur',onBlur);
      shell.remove();endpointMap.clear();partGroups.clear();terminalElements.clear();oledRasters.clear();expectedCaptureRelease.clear();
    }
  };
}
