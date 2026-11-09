import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { PARTS } from './circuit.js';
import { createWorkbench2D } from './workbench2d.js';
import { getBoardProfile } from './board-profiles.js';
import { nucleoF103rbGeometry } from './nucleo-f103rb-geometry.js';
import { BLUE_PILL_SWD } from './blue-pill-pins.js';
import { UNO_R3_INSPECTION } from './uno-r3-inspection.js';
import { esp32BenchVisual, nanoBoardVisual, inspectionBoardVisual, inspectionCameraFrame } from './board-inspection-geometry.js';
import { breadboardDimensions, breadboardSockets, socketTileGeometry, socketSpringGeometry, throughSocketGeometry, ledLensGeometry } from './geometry-3d.js';
import { boardPose, rotateBoardPoint, signalPitch, signalStrip } from './breadboard-mount.js';
import { capacitorCanObscuresHole, mountedPartContacts, partPose, sevenSegmentObscuresHole } from './part-mount.js';
import { encoderVisual, encoderPinDescription, encoderAppearance, moveEncoderShaft } from './model-renderer.js';
import { joystickVisual, joystickPinDescription, joystickAppearance, startJoystickDrag, moveJoystickCap, releaseJoystickCap } from './model-renderer.js';
import { rgbLedVisual, rgbLedPinDescription, rgbLedLight } from './model-renderer.js';
import { nearCompactAdjuster, pointerInsideSurface } from './model-renderer.js';
import { closestWireSegment, compareWireHits, distinctPickTargets } from './wire-picking.js';
import { groveRelayVisual, groveRelayPinDescription, groveRelayState } from './model-renderer.js';
import { pdvPhotoresistorVisual } from './model-renderer.js';
import { boardVisual, genericModuleVisual, visualBounds, resistorVisual, formatResistance, formatCapacitance, componentPin, componentPins, componentLabel, sevenSegmentVisual, sevenSegmentIntensity, sevenSegmentPinDescription, drv8833Visual, drv8833PinDescription, fa130Visual, motorMotion, hcsr04Visual, hcsr04PinDescription, hcsr04Observation, ssd1306Visual, ssd1306PinDescription, createSsd1306Raster, mcp9808Visual, mcp9808PinDescription, mcp9808Observation, selectionDescriptor, pointerIntent, boardResetTap, sceneRotationStep, isSecondPinTap, wireGestureState, connectionPlan, directionalEndpoint, boardHoleKeyAction, snapToBreadboard } from './model-renderer.js';

/* Physical geometry and interactions only. Electrical behavior belongs to circuit.js.
   Dimensions are in centimetres. Breadboard nets are explicit endpoints, never
   inferred from a component merely overlapping a hole on screen. */

const TAU = Math.PI * 2;
const DOCK_PREVIEW_LIFT = .30;
const PICO_FREE_STAND = .10;
const NANO_FREE_STAND = .29;
const BUTTON_TRAVEL = .025;
const DIP_SWITCH_TRAVEL = .14;
const CAPACITOR_RADIUS = .315;
const CAPACITOR_HEIGHT = 1.12;
const POT_ELECTRICAL_SWEEP = 4 * Math.PI / 3;
const POT_DRAG_PIXELS = 140;
// Bourns 3362P shell egress in centimetres. Adapter leads preserve lab endpoints.
const POT_LEAD_ORIGINS = {VCC:[-.254,.02,.031],OUT:[0,.02,-.223],GND:[.254,.02,.031]};
const LED_COLORS = { red: 0xe83932, green: 0x40b65a, yellow: 0xffb51c, blue: 0x258cf4, white: 0xf4f8ff };
const SEGMENT_NAMES = [...Object.keys(sevenSegmentVisual.segments),'dp'];
const SEGMENT_LIGHT = new THREE.Color(sevenSegmentVisual.onColor);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOARD_MODEL_LOADERS = {
  bluepill: () => import('./blue-pill-model.js').then(({ loadBluePillModel }) => loadBluePillModel()),
  'uno-r3': () => import('./uno-r3-model.js').then(({ loadUnoR3Model }) => loadUnoR3Model()),
  nano: () => import('./arduino-nano-model.js').then(({ loadArduinoNanoModel }) => loadArduinoNanoModel()),
  'esp32-devkitc': () => import('./esp32-devkitc-model.js').then(({ loadEsp32DevkitcModel }) => loadEsp32DevkitcModel()),
  'nucleo-f103rb': () => import('./nucleo-f103rb-model.js').then(({ loadNucleoF103rbModel }) => loadNucleoF103rbModel()),
  pico: () => import('./pico-rp2040-model.js').then(({ loadPicoRp2040Model }) => loadPicoRp2040Model()),
  'raspberry-pi-4': () => loadRaspberryPiAppearance('raspberry-pi-4'),
  'raspberry-pi-5': () => loadRaspberryPiAppearance('raspberry-pi-5'),
  'pi-zero-2-w': () => loadRaspberryPiAppearance('pi-zero-2-w')
};

function loadRaspberryPiAppearance(id) {
  return import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,`./models/${id}.glb`,parseEmbeddedBoard)()
  ).then(scene=>{
    const assembly=scene.getObjectByName('PI_SBC_COMMON');
    if(!assembly?.getObjectByName('PI_SBC_PCB')||!assembly.getObjectByName('PI_SBC_GPIO_POSTS')){
      throw new Error('Raspberry Pi GLB is missing the PCB or GPIO header');
    }
    assembly.traverse(object=>{
      if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}
    });
    return ()=>assembly.clone(true);
  });
}

let buttonAppearanceRequest;
function loadButtonAppearance() {
  return buttonAppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/tactile-button.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('BUTTON_COMMON');
    if(!assembly?.getObjectByName('BUTTON_BODY')||!assembly.getObjectByName('BUTTON_CAP')){
      throw new Error('Tactile button GLB is missing its body or cap');
    }
    return ()=>{
      const root=assembly.clone(true),cap=root.getObjectByName('BUTTON_CAP');
      root.getObjectByName('BUTTON_NATIVE_LEADS')?.removeFromParent();
      root.traverse(object=>{
        if(!object.isMesh)return;
        object.castShadow=true;object.receiveShadow=true;
      });
      return {root,cap,travel:BUTTON_TRAVEL};
    };
  });
}

let dipSwitchAppearanceRequest;
function loadDipSwitchAppearance() {
  return dipSwitchAppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/dip-switch-a6d.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('A6D_COMMON');
    if(!assembly?.getObjectByName('A6D_BODY')||![1,2,3,4].every(i=>assembly.getObjectByName('A6D_SLIDER_'+i))){
      throw new Error('A6D-4100 GLB is missing the housing or sliders');
    }
    return ()=>{
      const root=assembly.clone(true);
      root.getObjectByName('A6D_NATIVE_LEADS')?.removeFromParent();
      root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
      return root;
    };
  });
}

let photoresistorAppearanceRequest;
function loadPhotoresistorAppearance(){
  return photoresistorAppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/pdv-p8103.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('PDV_P8103_COMMON');
    if(!assembly?.getObjectByName('PDV_P8103_BODY'))throw new Error('PDV-P8103 GLB is missing its ceramic body');
    return ()=>{
      const root=assembly.clone(true);
      root.getObjectByName('PDV_P8103_NATIVE_LEADS')?.removeFromParent();
      root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
      return root;
    };
  });
}

let hs55AppearanceRequest;
function loadHs55Appearance() {
  return hs55AppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/servo-hs55.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('SERVO_COMMON');
    if(!assembly?.getObjectByName('SERVO_BODY')||!assembly.getObjectByName('SERVO_HORN')){
      throw new Error('HS-55 GLB is missing its body or horn');
    }
    return ()=>{
      const root=assembly.clone(true),horn=root.getObjectByName('SERVO_HORN');
      root.traverse(object=>{
        if(!object.isMesh)return;
        object.castShadow=true;object.receiveShadow=true;
      });
      return {root,horn};
    };
  });
}

let capacitorAppearanceRequest;
function loadCapacitorAppearance() {
  return capacitorAppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/capacitor-fr-63.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('CAP_COMMON');
    if(!assembly?.getObjectByName('CAP_BODY'))throw new Error('Capacitor GLB is missing its can body');
    return ()=>{
      const root=assembly.clone(true);
      root.getObjectByName('CAP_NATIVE_LEADS')?.removeFromParent();
      root.traverse(object=>{
        if(!object.isMesh)return;
        object.castShadow=true;object.receiveShadow=true;
      });
      return root;
    };
  });
}

let sevenSegmentAppearanceRequest;
function loadSevenSegmentAppearance() {
  return sevenSegmentAppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/sevenseg-sc56.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('SC56_COMMON');
    const lenses=assembly?.getObjectByName('SC56_LENSES');
    if(!assembly?.getObjectByName('SC56_BODY')||!assembly.getObjectByName('SC56_LEADS')||
       !SEGMENT_NAMES.every(name=>lenses?.getObjectByName('Segment_'+name)?.material?.emissive)){
      throw new Error('Seven-segment GLB is missing its package, leads or lenses');
    }
    assembly.traverse(object=>{
      if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}
    });
    return ()=>{
      const root=assembly.clone(true),segments={};
      for(const name of SEGMENT_NAMES){
        const lens=root.getObjectByName('Segment_'+name);
        lens.material=lens.material.clone();
        delete lens.material.userData.shared;
        segments[name]=lens;
      }
      return {root,segments};
    };
  });
}

let fa130AppearanceRequest;
function loadFa130Appearance() {
  return fa130AppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/motor-fa130.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('FA130_COMMON');
    if(!assembly?.getObjectByName('FA130_BODY')||!assembly.getObjectByName('FA130_ROTOR')||
       !assembly.getObjectByName('FA130_SHAFT_MOTION_MARK'))throw new Error('FA-130 GLB is missing its housing, shaft or mark');
    assembly.traverse(object=>{
      if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}
    });
    assembly.getObjectByName('FA130_SHAFT_MOTION_MARK').userData.detailOnly=true;
    return ()=>{
      const root=assembly.clone(true);
      return {root,rotor:root.getObjectByName('FA130_ROTOR'),witness:root.getObjectByName('FA130_SHAFT_MOTION_MARK')};
    };
  });
}

let hcsr04AppearanceRequest;
function loadHcsr04Appearance() {
  return hcsr04AppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/hcsr04.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('HCSR04_COMMON');
    if(!assembly?.getObjectByName('HCSR04_TRANSMITTER')||!assembly.getObjectByName('HCSR04_RECEIVER')||
       !hcsr04Visual.pins.every(({id})=>assembly.getObjectByName('HCSR04_PIN_'+id))){
      throw new Error('HC-SR04 GLB is missing its transducers or header');
    }
    assembly.traverse(object=>{
      if(!object.isMesh)return;
      const decoration=object.name.startsWith('HCSR04_SILK_')||object.name==='HCSR04_ILLUSTRATIVE_ROUTING';
      object.castShadow=!decoration;object.receiveShadow=true;
      if(decoration)object.userData.detailOnly=true;
    });
    return ()=>assembly.clone(true);
  });
}

let ssd1306AppearanceRequest;
function loadSsd1306Appearance() {
  return ssd1306AppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/ssd1306-326.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('OLED326_COMMON');
    const required=['OLED326_PCB','OLED326_GLASS_STACK','OLED326_PIXEL_PLANE',
      'OLED326_JST_SH_LEFT_HOUSING','OLED326_JST_SH_RIGHT_HOUSING'];
    if(!required.every(name=>assembly?.getObjectByName(name)))throw new Error('SSD1306 GLB is missing physical board details');
    assembly.traverse(object=>{
      if(!object.isMesh)return;
      const printed=object.name.startsWith('OLED326_SILK_');
      object.castShadow=!printed;object.receiveShadow=true;
      if(printed)object.userData.detailOnly=true;
    });
    return ()=>{
      const root=assembly.clone(true);
      root.getObjectByName('OLED326_PIXEL_PLANE').removeFromParent();
      return root;
    };
  });
}

let mcp9808AppearanceRequest;
function loadMcp9808Appearance() {
  return mcp9808AppearanceRequest??=import('./board-glb.js').then(({embeddedBoardRequest,parseEmbeddedBoard})=>
    embeddedBoardRequest(import.meta.url,'./models/mcp9808-5027.glb',parseEmbeddedBoard)()).then(scene=>{
    const assembly=scene.getObjectByName('MCP9808_5027_COMMON');
    const lensName='MCP9808_POWER_LED_LENS';
    const required=['MCP9808_PCB','MCP9808_MSOP8_BODY','MCP9808_JST_SH_LEFT_HOUSING','MCP9808_JST_SH_RIGHT_HOUSING'];
    if(!required.every(name=>assembly?.getObjectByName(name))||!assembly.getObjectByName(lensName)?.material?.emissive){
      throw new Error('MCP9808 GLB is missing the chip, connections or power indicator');
    }
    assembly.traverse(object=>{
      if(!object.isMesh)return;
      const printed=object.name.startsWith('MCP9808_SILK_')||object.name==='MCP9808_ILLUSTRATIVE_ROUTING';
      object.castShadow=!printed;object.receiveShadow=true;
      if(printed)object.userData.detailOnly=true;
    });
    return ()=>{
      const root=assembly.clone(true),lens=root.getObjectByName(lensName);
      lens.material=lens.material.clone();
      delete lens.material.userData.shared;
      return {root,lens};
    };
  });
}

export function createWorkbench(container, hooks = {}, options = {}) {
  const query = new URLSearchParams(window.location.search);
  const force2d=options.force2d||(query.has('force2d')&&!['0','false'].includes(query.get('force2d')));
  const requested=force2d?'2d':query.get('view')||options.view||'3d';
  let renderer=null,currentCircuit=null,currentResult=null,currentState=null,currentMode='orbit',currentSelection=null,currentParts=[],currentPartPlacement=null,snapEnabled=true,disposed=false;
  let currentProbes={red:null,black:null},currentBoardHolePicker=null;
  const renderHooks={...hooks,
    onSelect(id,modifiers){currentSelection=id;hooks.onSelect?.(id,modifiers);},
    onWireSelect(id){currentSelection=id;currentParts=[];if(hooks.onWireSelect)hooks.onWireSelect(id);else hooks.onWire?.(id);},
    onContextLost(){if(!disposed&&renderer?.view==='3d'){setView('2d','三维画面中断，已切换为二维接线图。');hooks.onViewChange?.('2d',true);}}
  };
  function setView(view,reason){
    if(disposed)return '2d';
    const target=view==='3d'?'3d':'2d';
    if(renderer?.view===target)return target;
    renderer?.dispose();
    renderer=target==='3d'?createThreeWorkbench(container,renderHooks,options):createWorkbench2D(container,renderHooks,{...options,reason});
    if(currentCircuit)renderer.setCircuit(currentCircuit);
    renderer.update(currentResult,currentState);renderer.setMode(currentMode);renderer.setSelected(currentSelection);renderer.setPartSelection?.(currentParts);renderer.setSnapEnabled?.(snapEnabled);
    renderer.setPartPlacementPreview?.(currentPartPlacement);renderer.setProbes?.(currentProbes);
    renderer.setBoardHolePicker?.(currentBoardHolePicker);renderer.resize();
    return renderer.view;
  }
  setView(requested);
  return {
    setCircuit(circuit){currentCircuit=circuit;currentSelection=selectionDescriptor(circuit,currentSelection)?.id??null;renderer.setCircuit(circuit);renderer.setSelected(currentSelection);},
    update(result,state){currentResult=result;currentState=state;renderer.update(result,state);},
    setMode(mode){currentMode=mode;renderer.setMode(mode);},
    setSelected(id){currentSelection=selectionDescriptor(currentCircuit,id)?.id??null;renderer.setSelected(currentSelection);},
    setPartSelection(ids){currentParts=[...ids];renderer.setPartSelection?.(currentParts);},
    setPartPlacementPreview(preview){currentPartPlacement=preview;renderer.setPartPlacementPreview?.(preview);},
    setBoardHolePicker(picker){currentBoardHolePicker=picker;renderer.setBoardHolePicker?.(picker);},
    setProbes(probes){currentProbes={red:probes?.red??null,black:probes?.black??null};renderer.setProbes?.(currentProbes);},
    setSnapEnabled(enabled){snapEnabled=enabled;renderer.setSnapEnabled?.(enabled);},
    home(){renderer.home();},top(){renderer.top();},resize(){renderer.resize();},
    focusSelection(){return renderer?.focusSelection()??false;},
    focusBoard(){return renderer?.focusBoard()??false;},
    setCameraMode(mode){renderer?.setCameraMode(mode);},
    cancelInteraction(){renderer.cancelInteraction?.();},
    locatePin(endpoint){return renderer.locatePin(endpoint);},
    startWireAt(endpoint){return renderer.startWireAt(endpoint);},
    beginReconnect(id,end='b'){return renderer.beginReconnect?.(id,end)??false;},
    setView,getView(){return renderer.view;},
    dispose(){if(disposed)return;disposed=true;renderer?.dispose();renderer=null;}
  };
}

export function createBoardInspection(container, hooks, { boardId, pins, referenceLabel }) {
  const view = createThreeWorkbench(container, hooks, { inspection: { boardId, pins, referenceLabel } });
  view?.setCircuit({ boardId, board: { x: 0, z: 0 }, components: [], wires: [] });
  return view;
}

function createThreeWorkbench(container, hooks = {}, options = {}) {
  const inspection = Boolean(options.inspection);
  const referenceLabel = options.inspection?.referenceLabel ?? '实物照片';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    if (inspection) return null;
    return createWorkbench2D(container, hooks, { reason: '当前设备的 WebGL 不可用。可用二维接线图继续编辑。' });
  }

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const shell=document.createElement('div');shell.className='workbench-surface';shell.style.cssText='display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden';
  const stage=document.createElement('div');stage.style.cssText='position:relative;flex:1;min-height:0;overflow:hidden';
  const footer=document.createElement('div');footer.style.cssText='display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;background:#f7faf8;border-top:1px solid #d2dedb;flex:none';shell.appendChild(stage);container.appendChild(shell);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role','application');
  if(!inspection)renderer.domElement.setAttribute('aria-keyshortcuts','R Shift+R');
  const helpId = inspection ? 'bluePillBoardKeyboardHelp' : 'threeKeyboardHelp';
  renderer.domElement.setAttribute('aria-describedby',helpId);
  renderer.domElement.setAttribute('aria-label', '硬件三维电路实验台，可旋转、缩放、选择引脚和元件');
  const keyboardHelp=document.createElement('span');
  keyboardHelp.id=helpId;keyboardHelp.className='scene-screen-reader';
  const nanoInspection=options.inspection?.boardId==='nano';
  const inspectionUndersideAvailable=nanoInspection||options.inspection?.boardId==='pico';
  keyboardHelp.textContent=inspection
    ? '左右方向键旋转，加减键缩放，Home 复位。'+(inspectionUndersideAvailable?'向下键翻看底面。':'')+'用引脚表选择排针。'
    : '方括号键切换物件。P 浏览引脚，方向键选择，回车接线。万用表选点时，回车放置表笔，Esc 取消。选择或移动模式下，选中开发板后按 R 旋转 90°，Shift+R 反向旋转。已插入的板会先显示旋转选项。方向键移动所选物件。加减键缩放，Home 恢复总览。';
  shell.appendChild(keyboardHelp);
  stage.appendChild(renderer.domElement);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xedf2f4);
  scene.fog = new THREE.Fog(0xedf2f4, 30, 65);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.04, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = inspection ? 1.5 : 3;
  controls.maxDistance = inspection ? 26 : 40;
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  controls.screenSpacePanning = true;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  controls.target.set(-0.25, 0.25, 0);

  const hemi = new THREE.HemisphereLight(0xf8fbff, 0x899aa4, 1.65);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff5e8, 2.6);
  key.position.set(-5, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 35;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.00015;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd7edff, .78);
  fill.position.set(8, 7, -6);
  scene.add(fill);

  let environmentTarget = null;
  try {
    const faces = Array.from({ length: 6 }, (_, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, index === 3 ? '#9baab6' : '#ffffff');
      gradient.addColorStop(0.6, index === 2 ? '#ffffff' : '#cdd6db');
      gradient.addColorStop(1, '#7b8a94');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(18, 12, 30, 72);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(80, 18, 14, 55);
      return canvas;
    });
    const cube = new THREE.CubeTexture(faces);
    cube.colorSpace = THREE.SRGBColorSpace;
    cube.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromCubemap(cube);
    scene.environment = environmentTarget.texture;
    cube.dispose(); pmrem.dispose();
  } catch (_) { /* Direct and hemispheric lights remain a usable fallback. */ }

  const sharedMaterials = [];
  const shared = (options) => {
    const material = new THREE.MeshStandardMaterial(options);
    material.userData.shared = true;
    sharedMaterials.push(material);
    return material;
  };
  const mat = {
    pcb: shared({ color: 0x195cba, roughness: 0.38, metalness: 0.04 }),
    laminate: shared({ color: 0x9d8958, roughness: 0.74 }),
    plastic: shared({ color: 0x25282a, roughness: 0.6 }),
    black: shared({ color: 0x14181d, roughness: 0.67 }),
    silver: shared({ color: 0xc5cbd0, metalness: 0.88, roughness: 0.22 }),
    tin: shared({ color: 0xc2c9c9, metalness: 0.7, roughness: 0.38 }),
    gold: shared({ color: 0xd8ab48, metalness: 0.78, roughness: 0.25 }),
    ceramic: shared({ color: 0xc8ab82, roughness: 0.8 }),
    boardWhite: shared({ color: 0xf0eee7, roughness: 0.7, metalness: 0 }),
    holeRim: shared({ color: 0xd5d5cd, roughness: 0.8 }),
    hole: shared({ color: 0x242b30, roughness: 1 }),
    socketWall: shared({ color: 0x545c5e, roughness: .93 }),
    white: shared({ color: 0xecece6, roughness: 0.55 }),
    red: shared({ color: 0xc8433c, roughness: 0.45 }),
    blue: shared({ color: 0x2c6e9a, roughness: 0.48 }),
    yellow: shared({ color: 0xf1c444, roughness: 0.4 })
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), shared({ color: 0xe9eef0, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.025;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(50, 100, 0xd7e1e6, 0xe0e7eb);
  grid.position.y = -0.018;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  scene.add(grid);

  let assembly = new THREE.Group();
  let cableGroup = new THREE.Group();
  const previewGroup=new THREE.Group(),handleGroup=new THREE.Group(),dockPreviewGroup=new THREE.Group(),partPlacementGroup=new THREE.Group();
  const boardHolePickerGroup=new THREE.Group();
  let partPlacementPreview=null,boardHolePicker=null,boardHoleHover=null,boardHoleKeyboard=null;
  scene.add(assembly, cableGroup, previewGroup, boardHolePickerGroup, dockPreviewGroup, partPlacementGroup, handleGroup);
  const probeGroup=new THREE.Group(),probeModels=new Map();
  const probeAxis=new THREE.Vector3(0,1,0),probeTilt=new THREE.Vector3(),probeSpread=new THREE.Vector3();
  const probePositions={red:new THREE.Vector3(),black:new THREE.Vector3()};
  let probes={red:null,black:null},probePicking=null;
  if(!inspection)scene.add(probeGroup);
  let circuit = null, result = null, state = null;
  let mode = 'orbit', cameraMode = 'edit', selectedId = null, pendingPin = null,hoverEndpoint=null,recentPinTap=null;
  let connectionPending=false;
  let disposed = false, frameId = 0, lastWirePreview = 0, firstVisibleFit = false;
  const componentGroups = new Map();
  const endpoints = new Map();
  const insertedParts = new Set();
  const occupiedSockets = new Set();
  const pinTargets = [];
  const objectTargets = [];
  const wireTargets = [];
  const wirePickPaths = [];
  const wireVisibilityRay = new THREE.Raycaster();
  let projectedWireCache = null;
  const handleTargets = [];
  const ledModels = new Map();
  const servoModels = new Map();
  let hs55Asset = null;
  const capacitorModels = new Map();
  let capacitorAsset = null;
  const buttonModels = new Map();
  let buttonAsset = null;
  let boardResetCap = null;
  const potModels = new Map();
  let potAsset = null;
  const encoderModels = new Map();
  let encoderAsset = null;
  const joystickModels = new Map();
  const dipSwitchModels = new Map();
  let dipSwitchAsset = null;
  const photoresistorModels = new Map();
  let photoresistorAsset = null;
  const joystickAxis = new THREE.Vector3();
  let joystickAsset = null;
  const sourceDisplays = new Map();
  const rgbModels = new Map();
  const kingbrightRgbModels = new Map();
  let kingbrightRgbAsset = null;
  const segmentModels = new Map();
  let sevenSegmentAsset = null;
  const motorModels = new Map();
  let fa130Asset = null;
  const sensorModels = new Map();
  let hcsr04Asset = null;
  const oledModels = new Map();
  let ssd1306Asset = null;
  const mcp9808Models = new Map();
  let mcp9808Asset = null;
  const groveRelayModels = new Map();
  let groveRelayAsset = null;
  const switchModels = new Map();
  let breadboardHalos = null;
  let breadboardEndpointOrder = [];
  let boardView = null;
  const boardModels = new Map();
  const selectionBoxes=new Map();
  let selectedParts=new Set(),keyboardPin=null,snapEnabled=true,snappedPin=null,rightDown=null;
  const touches=new Map();
  let touchCamera=null;
  let drag = null, down = null, activeButton = null,wireGesture=null,reconnectPending=null,lastGroundPoint=null,spacePan=false,connectionError='';
  const expectedCaptureRelease=new Set();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragPlane = groundPlane.clone();
  const matrix = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  let selectedInspectionPin = null;
  const inspectionPinMarker = inspection ? createInspectionPinMarker() : null;

  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:absolute;display:none;pointer-events:none;z-index:20;max-width:240px;padding:10px 12px;border-radius:10px;background:rgba(24,45,55,.95);color:#fff;box-shadow:0 6px 22px #172f3824;font:13px/1.55 system-ui,sans-serif;white-space:pre-line;backdrop-filter:blur(8px)';
  stage.appendChild(tooltip);
  const motorReadout=document.createElement('div');
  motorReadout.hidden=true;
  motorReadout.dataset.motorReadout='';
  motorReadout.setAttribute('aria-label','选中电机的模拟转速与方向');
  motorReadout.style.cssText='position:absolute;top:10px;left:10px;pointer-events:none;max-width:calc(100% - 20px);padding:5px 8px;background:#f7faf6ee;color:#2c514c;border:1px solid #c7d8ce;border-radius:6px;font:600 12px/1.35 system-ui,sans-serif;font-variant-numeric:tabular-nums';
  if(!inspection)stage.appendChild(motorReadout);
  const sensorReadout=document.createElement('div');
  sensorReadout.hidden=true;
  sensorReadout.dataset.hcsr04Readout='';
  sensorReadout.setAttribute('aria-label','选中超声测距模块的仿真状态');
  sensorReadout.style.cssText=motorReadout.style.cssText;
  if(!inspection)stage.appendChild(sensorReadout);
  const temperatureReadout=document.createElement('div');
  temperatureReadout.hidden=true;
  temperatureReadout.dataset.mcp9808Readout='';
  temperatureReadout.setAttribute('aria-label','选中温度传感器的仿真读数');
  temperatureReadout.style.cssText=motorReadout.style.cssText;
  if(!inspection)stage.appendChild(temperatureReadout);

  function createInspectionPinMarker() {
    const source = document.createElement('canvas');
    source.width = source.height = 96;
    const ctx = source.getContext('2d');
    for (const [color,width] of [['#594017',20],['#ffd866',13]]) {
      ctx.beginPath();ctx.arc(48,48,33,0,TAU);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
    }
    const map = new THREE.CanvasTexture(source);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map, sizeAttenuation:false, depthTest:false, depthWrite:false, toneMapped:false });
    const marker = new THREE.Sprite(material);
    marker.scale.set(.042,.042,1);
    marker.visible=false;marker.renderOrder=30;
    scene.add(marker);
    return marker;
  }

  function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true; object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function box(group, w, h, d, material, x = 0, y = 0, z = 0) {
    return mesh(group, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  }
  function cylinder(group, radius, height, material, x = 0, y = 0, z = 0, segments = 24) {
    return mesh(group, new THREE.CylinderGeometry(radius, radius, height, segments), material, x, y, z);
  }
  function roundedShape(w, d, radius) {
    const r = Math.min(radius, w / 2, d / 2), x = -w / 2, y = -d / 2;
    const s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundedBox(group, w, h, d, radius, material, x = 0, y = 0, z = 0) {
    const geometry = new THREE.ExtrudeGeometry(roundedShape(w, d, radius), {
      depth: h, bevelEnabled: false, curveSegments: 6, steps: 1
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -h / 2, 0);
    return mesh(group, geometry, material, x, y, z);
  }
  function rod(group, start, end, radius, material, segments = 8) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const object = mesh(group, new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material);
    object.position.copy(a).add(b).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return object;
  }
  function textTexture(text, options = {}, maxWidth = 512) {
    const canvas = document.createElement('canvas');
    const width = options.width || 1024, height = options.height || 256;
    const scale = Math.min(1, maxWidth / width, 256 / height);
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, width, height); }
    const lines = String(text).split('\n');
    const size = options.size || Math.min(100, height / (lines.length + 0.5));
    ctx.font = (options.weight || '500') + ' ' + size + 'px ' + (options.font || '"Arial","Microsoft YaHei",sans-serif');
    ctx.fillStyle = options.color || '#f1f6f9';
    ctx.textAlign = options.align || 'center'; ctx.textBaseline = 'middle';
    const lineHeight = size * 1.25;
    lines.forEach((line, index) => ctx.fillText(line, options.align === 'left' ? 18 : width / 2,
      height / 2 + (index - (lines.length - 1) / 2) * lineHeight, width - 24));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }
  function label(group, text, w, d, x, y, z, options = {}) {
    const texture = textTexture(text, options, w < 0.5 ? 192 : 512);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const object = mesh(group, new THREE.PlaneGeometry(w, d), material, x, y, z);
    object.rotation.x = -Math.PI / 2;
    object.castShadow = false; object.receiveShadow = false;
    object.renderOrder = 2;
    return object;
  }
  function uprightLabel(group, text, w, h, x, y, z, options = {}) {
    const object = label(group, text, w, h, x, y, z, options);
    object.rotation.x = 0;
    return object;
  }
  function addObjectTargets(group, id) {
    group.traverse(object => {
      if (object.isMesh && !object.userData.pinTarget && !object.userData.halo && !object.userData.detailOnly) {
        object.userData.componentId = id;
        objectTargets.push(object);
      }
    });
  }
  function markBoardReset(cap, label, surfaces, travel = .033) {
    if (inspection) return;
    for (const object of [cap,...surfaces]) object.userData.boardReset = label;
    boardResetCap = { cap, restY:cap.position.y, travel };
  }
  function setBoardResetPressed(pressed) {
    if (!boardResetCap) return;
    const {cap,restY,travel} = boardResetCap;
    cap.position.y = restY - (pressed ? travel : 0);
    cap.updateMatrixWorld();
    requestFrame(true);
  }
  function markSelectable(group, id) {
    group.userData.componentId = id;
    addObjectTargets(group, id);
    componentGroups.set(id, group);
  }
  function addPin(group, endpoint, x, y, z, componentId, description, size = 0.12) {
    size=Math.max(size,.115);
    const target = mesh(group, new THREE.SphereGeometry(size, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), x, y, z);
    target.castShadow = false; target.receiveShadow = false;
    target.userData = { pinTarget: true, endpoint, componentId };
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x8eaaaa, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const halo = mesh(group, new THREE.RingGeometry(size * 0.64, size * 0.95, 20), haloMaterial, x, y + 0.004, z);
    halo.rotation.x = -Math.PI / 2;
    halo.castShadow = false; halo.receiveShadow = false;
    halo.userData.halo = true;
    pinTargets.push(target);
    endpoints.set(endpoint, { object: target, position: new THREE.Vector3(), halo, componentId, description });
  }
  function addSmd(group, x, z, orientation = 0, kind = 'resistor') {
    const small = new THREE.Group(); small.position.set(x, 0.39, z); small.rotation.y = orientation;
    box(small, 0.15, 0.05, 0.075, kind === 'capacitor' ? mat.ceramic : mat.black);
    [-0.075, 0.075].forEach(px => box(small, 0.035, 0.057, 0.081, mat.tin, px));
    group.add(small);
  }
  function diodeLamp(group, id, color, x, y, z, scale = 1, physical = true, cathodeFlat = false, surfaceMount = false) {
    const lamp = new THREE.Group(); lamp.position.set(x, y, z); lamp.scale.setScalar(scale); group.add(lamp);
    const lens = new THREE.MeshPhysicalMaterial({ color, roughness: .16,
      transparent: physical, opacity: physical ? .46 : 1, depthWrite: !physical,
      clearcoat: 1, clearcoatRoughness: .10, emissive: color, emissiveIntensity: 0 });
    const cover = surfaceMount ? roundedBox(lamp, .125, .066, .202, .008, lens, 0, .04, 0)
      : mesh(lamp, ledLensGeometry(cathodeFlat), lens);
    cover.castShadow = !physical;
    if (surfaceMount) for (const z of [-.105, .105]) box(lamp, .12, .012, .12, mat.tin, 0, .007, z);
    if (physical) {
      // Cathode supports a reflector cup and die; the anode reaches the die via a bonded wire.
      box(lamp, .056, .165, .052, mat.tin, -.126, .083, 0);
      box(lamp, .092, .149, .063, mat.tin, .126, .074, 0);
      rod(lamp, [.126,.12,0], [.060,.181,0], .033, mat.silver, 12);
      const cupProfile = [[0,.176],[.046,.176],[.079,.221],[.074,.224],[.043,.196],[0,.196]];
      const cupGeometry = new THREE.LatheGeometry(cupProfile.map(([r,h]) => new THREE.Vector2(r,h)), 24);
      mesh(lamp, cupGeometry, mat.silver, .060, 0, 0);
      box(lamp, .039, .015, .040, mat.gold, .060, .201, 0);
      const bond = new THREE.CubicBezierCurve3(new THREE.Vector3(-.126,.168,0), new THREE.Vector3(-.113,.297,0),
        new THREE.Vector3(.047,.307,0), new THREE.Vector3(.060,.209,0));
      mesh(lamp, new THREE.TubeGeometry(bond, 14, .007, 6, false), mat.gold);
    }
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
    const ctx = glowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,.95)'); gradient.addColorStop(0.22, 'rgba(255,255,255,.4)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.y = surfaceMount ? .06 : .25;
    glow.scale.setScalar(surfaceMount ? .35 : 1.1);
    lamp.add(glow);
    ledModels.set(id, { lens, glow });
    return lamp;
  }

  function buildBoardFeature(parent,feature,silk,top=.35,bottom=.21) {
    const f=feature,group=new THREE.Group();group.position.set(f.x,f.back?bottom:top,f.z);group.rotation.y=-(f.rotation||0)*Math.PI/180;parent.add(group);
    if(f.back)group.rotation.z=Math.PI;
    if(f.type==='usb'){
      const height=f.kind==='A'?.72:f.kind==='B'?1.05:f.kind==='mini'? .43:.29;
      box(group,f.w,.035,f.h,mat.silver,0,height,0);box(group,f.w,.035,f.h,mat.silver,0,.025,0);
      [-1,1].forEach(sign=>box(group,.035,height,f.h,mat.silver,sign*(f.w/2-.018),height/2,0));
      box(group,f.w-.035,height,.025,mat.silver,0,height/2,f.h/2-.012);
      box(group,f.w*.66,height*.23,f.h*.70,mat.black,0,height*.29,-f.h*.04);
      for(let i=0;i<(['A','B'].includes(f.kind)?4:5);i++)box(group,.035,.012,f.h*.40,mat.gold,(i-2)*.09,height*.42,-f.h*.20);
      [-1,1].forEach(sign=>box(group,.12,.012,.11,mat.tin,sign*f.w*.33,height+.023,f.h*.12));
    }else if(f.type==='ethernet'){
      const wall=.075, height=1.12, opening=f.w-.36;
      box(group,f.w,wall,f.h,mat.silver,0,height,0);
      box(group,f.w,wall,f.h,mat.silver,0,.06,0);
      for(const sign of [-1,1])box(group,wall,height,f.h,mat.silver,sign*(f.w-wall)/2,height/2,0);
      box(group,f.w-.09,height,.09,mat.black,0,height/2,f.h/2-.04);
      box(group,f.w-.12,.23,.12,mat.black,0,.17,-f.h/2+.10);
      box(group,f.w-.12,.16,.12,mat.black,0,height-.14,-f.h/2+.10);
      for(let index=0;index<8;index++)box(group,.045,.025,.21,mat.gold,(index-3.5)*opening/9,height-.21,-f.h/2+.17);
      for(const sign of [-1,1])box(group,.15,.16,.08,mat.ceramic,sign*(f.w/2-.18),.19,-f.h/2+.023);
    }else if(f.type==='sd-slot'){
      roundedBox(group,f.w,.15,f.h,.025,mat.silver,0,.085,0);
      box(group,f.w*.86,.070,.026,mat.black,0,.105,-f.h/2-.002);
      label(group,f.label,f.w*.76,f.h*.32,0,.162,0,{color:'#63737c',size:85});
    }else if(f.type==='slide-switch'){
      roundedBox(group,f.w,.18,f.h,.035,mat.silver,0,.10,0);
      box(group,f.w*.75,.013,f.h*.67,mat.black,0,.196,0);
      box(group,f.w*.30,.08,f.h*.56,mat.plastic,f.w*.18,.231,0);
      label(group,f.label,.61,.13,0,.008,f.h/2+.11,{size:87,color:silk});
    }else if(f.type==='ic'||f.type==='bga'||f.type==='qfn'){
      const count=f.pinsPerSide||8;
      for(let side=0;f.type==='ic'&&side<4;side++){
        if(f.leadRows===2&&side%2)continue;
        const leads=new THREE.Group();leads.rotation.y=side*Math.PI/2;group.add(leads);const length=side%2?f.h:f.w,depth=side%2?f.w:f.h;
        for(let i=0;i<count;i++)box(leads,Math.min(.027,length*.65/count),.028,.13,mat.tin,(i-(count-1)/2)*length*.82/count,.025,-depth/2-.045);
      }
      if(f.type==='qfn'&&f.contactPitch){
        for(let side=0;side<4;side++){
          if(f.leadRows===2&&side%2)continue;
          const contacts=new THREE.Group();contacts.rotation.y=side*Math.PI/2;group.add(contacts);
          const depth=side%2?f.w:f.h;
          for(let i=0;i<count;i++)box(contacts,f.contactPitch*.52,.018,.036,mat.tin,(i-(count-1)/2)*f.contactPitch,.012,-depth/2+.006);
        }
      }
      const height=f.bodyHeight??.10,surface=.03+height,mark=f.bodyHeight?Math.min(.075,f.w*.16,f.h*.16):.075;
      roundedBox(group,f.w,height,f.h,.025,mat.black,0,.03+height/2,0);
      cylinder(group,Math.min(.026,mark*.6),.004,mat.holeRim,-f.w/2+mark,surface+.004,-f.h/2+mark,12);
      label(group,f.label.length>13?f.label.slice(0,7)+'\n'+f.label.slice(7):f.label,f.w*.88,f.h*.47,0,surface+.005,0,{color:'#c6d2d4',width:512,height:256,size:75});
    }else if(f.type==='dip'){
      roundedBox(group,f.w+.10,.14,f.h+.10,.06,mat.plastic,0,.08,0);roundedBox(group,f.w,.25,f.h,.05,mat.black,0,.28,0);
      for(let i=0;i<(f.pinsPerSide||14);i++)for(const sign of [-1,1]){
        const z=(i-((f.pinsPerSide||14)-1)/2)*.254;box(group,.16,.035,.055,mat.tin,sign*(f.w/2+.035),.20,z);box(group,.032,.18,.055,mat.tin,sign*(f.w/2+.10),.11,z);
      }
      const title=label(group,f.label,f.h*.75,f.w*.65,0,.412,0,{color:'#b6c4c8',size:105});title.rotation.z=Math.PI/2;
      cylinder(group,.07,.006,mat.plastic,0,.412,-f.h/2+.08,18);
    }else if(f.type==='barrel'){
      roundedBox(group,f.w,.65,f.h,.08,mat.black,0,.34,0);
      const lip=cylinder(group,f.w*.38,.12,mat.plastic,0,.40,-f.h/2+.02);lip.rotation.x=Math.PI/2;
      const hole=cylinder(group,f.w*.28,.014,mat.hole,0,.40,-f.h/2-.05);hole.rotation.x=Math.PI/2;
      const contact=cylinder(group,.045,.12,mat.gold,0,.40,-f.h/2-.07,12);contact.rotation.x=Math.PI/2;
    }else if(f.type==='button'){
      const surfaces=[roundedBox(group,f.w,.08,f.h,.03,mat.tin,0,.06,0)];
      if(f.metalFrame){
        surfaces.push(roundedBox(group,f.w*.77,.025,f.h*.69,.022,mat.black,0,.112,0));
        for(const z of [-f.h*.48,f.h*.48])box(group,f.w*.50,.021,.075,mat.silver,0,.022,z);
      }
      const color=new THREE.MeshStandardMaterial({color:f.color||'#2b3b42',roughness:.46});
      const cap=f.squareCap?roundedBox(group,f.w*.76,.16,f.h*.72,.028,color,0,.17,0)
        :cylinder(group,f.w*.29,.10,color,0,.15,0,20);
      if(f.boardReset)markBoardReset(cap,f.label,surfaces,f.travel);
      if(f.buttonId&&!inspection){
        cap.userData.buttonId=f.buttonId;
        buttonModels.set(f.buttonId,{cap,restY:cap.position.y,travel:f.travel});
      }
      if(f.label)label(group,f.label,.57,.13,0,.008,f.h/2+.13,{size:95,color:silk});
    }else if(f.type==='crystal'){
      roundedBox(group,f.w+.05,.025,f.h+.05,f.h/2,mat.tin,0,.018,0);roundedBox(group,f.w,.15,f.h,f.h/2,mat.silver,0,.10,0);
      label(group,f.label,f.w*.80,f.h*.70,0,.177,0,{size:100,color:'#51656c'});
    }else if(f.type==='shield'){
      roundedBox(group,f.w+.08,.04,f.h+.06,.025,mat.pcb,0,.028,0);roundedBox(group,f.w,.18,f.h,.025,mat.silver,0,.14,0);
      for(const sign of [-1,1])for(let i=0;i<10;i++)box(group,.06,.025,.05,mat.gold,sign*(f.w/2+.04),.035,(i-4.5)*(f.h-.12)/10);
      const shieldSilk=label(group,(f.brand||'ESPRESSIF')+'\n'+f.label,f.w*.91,f.h*.54,0,.235,-f.h*.05,{size:100,color:'#66776e',height:512});
      if(f.silkRotation)shieldSilk.rotation.z=f.silkRotation*Math.PI/180;
      for(let i=0;i<5;i++)for(let j=0;j<5;j++)if((i*3+j*7)%4!==0)box(group,.027,.002,.027,mat.holeRim,-f.w*.29+i*.037,.234,f.h*.25+j*.037);
    }else if(f.type==='antenna'){
      const antennaMaterial=new THREE.MeshStandardMaterial({color:'#213e33',roughness:.66});roundedBox(group,f.w,.05,f.h,.015,antennaMaterial,0,.04,0);
      for(let i=0;i<6;i++){const x=-f.w*.36+i*f.w*.14;box(group,.035,.003,f.h*.55,mat.gold,x,.067,0);if(i<5)box(group,f.w*.14,.003,.035,mat.gold,x+f.w*.07,.067,i%2?f.h*.27:-f.h*.27);}
    }else if(f.type==='unmodeled-header'){
      const unused=[];
      if(f.contact!=='female')box(group,f.w,.16,f.h,mat.black,0,.09,0);
      for(let row=0;row<f.rows;row++)for(let column=0;column<f.cols;column++){
        const x=(column-(f.cols-1)/2)*.254,z=(row-(f.rows-1)/2)*.254;
        if(f.active.some(pin=>Math.abs(pin.x-f.x-x)<.01&&Math.abs(pin.z-f.z-z)<.01))continue;
        if(f.contact==='female')unused.push([x,z]);
        else box(group,.052,.36,.052,mat.tin,x,.25,z);
      }
      if(unused.length){
        const sockets=new THREE.InstancedMesh(throughSocketGeometry(.24,.254,.50,.112),mat.black,unused.length);
        unused.forEach(([x,z],index)=>sockets.setMatrixAt(index,matrix.makeTranslation(x,.006,z)));
        sockets.castShadow=true;sockets.receiveShadow=true;sockets.instanceMatrix.needsUpdate=true;group.add(sockets);
      }
      label(group,f.label,.78,.15,f.w/2+.45,.012,0,{size:88,color:silk});
    }else if(f.type==='header'){
      const housing=f.housingHeight??.15;
      if(!f.pads)box(group,f.w+.04,housing,f.h+.04,mat.black,0,.015+housing/2,0);
      for(let row=0;row<(f.rows||1);row++)for(let col=0;col<(f.cols||2);col++){
        const pitch=f.pitch||.254,x=(col-((f.cols||2)-1)/2)*pitch,z=(row-((f.rows||1)-1)/2)*pitch;
        if(f.pads)cylinder(group,.065,.01,mat.tin,x,.012,z,16);
        else box(group,.055,f.postHeight??.29,.055,mat.gold,x,f.postHeight ? .015+housing+f.postHeight/2 : .22,z);
      }
      if(f.label)label(group,f.label,.65,.13,0,.01,f.h/2+.12,{size:100,color:silk});
    }else if(f.type==='jumper'){
      box(group,f.w,.14,f.h,mat.black,0,.09,0);roundedBox(group,f.w+.03,.20,f.h*.70,.025,mat.yellow,0,.28,-f.h*.10);
      label(group,f.label,.60,.12,0,.01,f.h/2+.12,{size:90,color:silk});
    }else if(f.type==='capacitor'){
      cylinder(group,f.w/2,.42,mat.black,0,.24,0,24);cylinder(group,f.w*.41,.012,mat.silver,0,.456,0,24);
      box(group,f.w*.58,.002,.012,mat.holeRim,0,.464,0);box(group,.012,.002,f.w*.58,mat.holeRim,0,.464,0);
    }else if(f.type==='regulator'){
      roundedBox(group,f.w,.10,f.h,.02,mat.black,0,.08,0);box(group,f.w*.75,.02,.16,mat.tin,0,.018,-f.h/2-.05);
      [-1,0,1].forEach(i=>box(group,.04,.025,.15,mat.tin,i*f.w*.28,.018,f.h/2+.04));label(group,f.label,f.w*.8,f.h*.55,0,.135,0,{size:85,color:'#b5c6c6'});
    }else if(f.type==='inductor'){
      for(const sign of [-1,1])box(group,f.w,.045,.06,mat.tin,0,.026,sign*f.h*.4);
      roundedBox(group,f.w,.14,f.h,.025,mat.plastic,0,.104,0);
      roundedBox(group,f.w*.83,.015,f.h*.86,.017,mat.holeRim,0,.18,0);
    }else if(f.type==='matrix-led'){
      box(group,f.w,.038,f.h,mat.ceramic,0,.023,0);
      box(group,f.w*.79,.019,f.h*.58,mat.tin,0,.050,0);
      const lensMaterial=new THREE.MeshStandardMaterial({color:f.color,roughness:.30});
      roundedBox(group,f.w*.82,.029,f.h*.54,.020,lensMaterial,0,.066,0);
    }else if(f.type==='touch-logo'){
      roundedBox(group,f.w,.012,f.h,.215,mat.gold,0,.009,0);
      roundedBox(group,f.w-.18,.008,f.h-.17,.130,mat.black,0,.018,0);
      [-1,1].forEach(sign=>cylinder(group,.044,.008,mat.gold,sign*.16,.025,0,14));
    }else if(f.type==='battery-socket'){
      roundedBox(group,f.w,.10,f.h,.025,mat.ceramic,0,.059,0);
      for(const sign of [-1,1])box(group,.10,.19,f.h,mat.ceramic,sign*(f.w/2-.05),.16,0);
      box(group,f.w,.19,.085,mat.ceramic,0,.16,f.h/2-.044);
      for(const sign of [-1,1])box(group,.045,.105,.23,mat.tin,sign*.11,.14,-.03);
    }else if(f.type==='smd'){
      box(group,f.w+.06,.04,f.h,mat.tin,0,.025,0);box(group,f.w-.02,.045,f.h,f.ceramic?mat.ceramic:mat.black,0,.028,0);
    }else if(f.type==='led'){
      const lamp=diodeLamp(group,f.id,new THREE.Color(f.color).getHex(),0,.012,0,f.surfaceMount?1:.24,false,false,f.surfaceMount);
      if(f.surfaceMountScale)lamp.scale.set(...f.surfaceMountScale);
      if(f.label)label(group,f.label,.35,.12,0,.008,f.surfaceMount?.22:.18,{size:100,color:silk});
    }else if(f.type==='divider'){
      for(let x=-f.w/2;x<f.w/2;x+=.18)box(group,.09,.002,.012,mat.holeRim,x,.006,0);label(group,f.label,1.6,.11,0,.009,.12,{size:95,color:silk});
    }else if(f.type==='label')label(group,f.label,f.w,f.h,0,.008,0,{size:125,color:silk,weight:'600'});
    if(f.inspectionChip)group.traverse(object=>{if(object.isMesh)object.userData.inspectionChip=f.label;});
  }

  function freeBoardHeight(position, rotation, breadboard=circuit?.breadboard) {
    if(inspection)return 0;
    const pinStand=boardView.profile.id==='pico'?PICO_FREE_STAND:boardView.profile.id==='nano'?NANO_FREE_STAND:0;
    if(!breadboard)return pinStand;
    const {width,height}=boardView.profile;
    const cos=Math.abs(Math.cos(rotation)),sin=Math.abs(Math.sin(rotation));
    const overBreadboard=Math.abs(position.x-breadboard.x)<(breadboardDimensions.width+width*cos+height*sin)/2
      &&Math.abs(position.z-breadboard.z)<(breadboardDimensions.depth+width*sin+height*cos)/2;
    return (overBreadboard?breadboardDimensions.coverTop+.05:0)+pinStand;
  }
  function makeBoardGroup(data) {
    const group = new THREE.Group();
    group.rotation.y = data.rotation * Math.PI / 180;
    group.position.set(data.x, data.mounted ? breadboardDimensions.coverTop : freeBoardHeight(data,group.rotation.y), data.z);
    assembly.add(group);
    return group;
  }

  function boardHeaderTail(group, x, z, pcbBase=.206, tip=breadboardDimensions.coverBottom+.018-breadboardDimensions.coverTop) {
    const spacer=pcbBase-.006;
    box(group, .19, spacer, .19, mat.black, x, spacer/2, z);
    const top=pcbBase+.009;
    box(group, .055, top-tip, .055, mat.gold, x, (top+tip)/2, z);
  }

  function coveredByMountedBoard(x,z){
    if(!boardView?.pose.mounted)return false;
    const {profile,pose}=boardView;
    const local=rotateBoardPoint(x-pose.x,z-pose.z,-pose.rotation);
    return Math.abs(local.x)<=profile.width/2&&Math.abs(local.z)<=profile.height/2;
  }

  function flatShape(points) {
    const shape=new THREE.Shape();
    points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
    shape.closePath();return shape;
  }

  function drill(shape,x,z,radius) {
    const cut=new THREE.Path();cut.absarc(x,-z,radius,0,TAU,true);shape.holes.push(cut);
  }

  function buildProfileBoardPcb(group,model,top,bottom,plated) {
    const microbit=model.style==='microbit-v2',castellated=model.header==='castellated';
    const shape=model.outline?flatShape(model.outline):roundedShape(model.width,model.height,.08);
    const mountRadius=model.mountHoleRadius??.15,mountRingRadius=model.mountRingRadius??.21;
    for(const [x,z] of model.holes)drill(shape,x,z,mountRadius);
    for(const {x,z,holeRadius} of model.pins)if(holeRadius)drill(shape,x,z,holeRadius);
    const pcbGeometry=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,curveSegments:18});pcbGeometry.rotateX(-Math.PI/2);pcbGeometry.translate(0,bottom,0);
    const pcbMaterial=new THREE.MeshStandardMaterial({color:model.color,roughness:.42,metalness:.06});mesh(group,pcbGeometry,[pcbMaterial,mat.laminate]);
    for(const [x,z] of model.holes)for(const side of [-1,1]) {
      const ring=mesh(group,new THREE.RingGeometry(mountRadius,mountRingRadius,24),castellated?plated:mat.tin,x,side<0?bottom-.003:top+.003,z);
      ring.rotation.x=-side*Math.PI/2;
    }
    if(!microbit&&!castellated){
      const traceMaterial=new THREE.MeshStandardMaterial({color:model.style==='nucleo'?'#b5c6b0':'#4d9181',roughness:.6,transparent:true,opacity:.22});
      for(let i=0;i<14;i++)box(group,model.width*.19,.002,.012,traceMaterial,(i%2?1:-1)*model.width*.28,.353,(i-6.5)*model.height*.058);
    }
  }

  function buildProfileBoard(data,profile) {
    const pico=profile.id==='pico',esp=profile.id==='esp32-devkitc',nano=profile.id==='nano';
    const sbc=profile.style==='raspberry-pi-sbc',detailed=pico||esp||nano||sbc;
    const model=inspection||pico?inspectionBoardVisual(profile,options.inspection?.pins)
      :esp?esp32BenchVisual(profile):nano?nanoBoardVisual(profile):boardVisual(profile);
    const group=makeBoardGroup(data);
    const fallback=detailed?addBoardAppearance(group,profile.id):group;
    const microbit=model.style==='microbit-v2',stacked=model.style==='ti-launchpad';
    const castellated=model.header==='castellated';
    const top=microbit?.53:sbc?.34:.35,depth=model.thickness??.14,bottom=top-depth;
    if(stacked)group.position.y=.39;
    const plated=microbit||castellated&&fallback?new THREE.MeshStandardMaterial({color:castellated?'#d4ad64':'#d9aa45',roughness:.28,metalness:.68,side:THREE.DoubleSide}):null;
    if(fallback)buildProfileBoardPcb(fallback,model,top,bottom,plated);
    for(const feature of model.features){
      const parent=['button','led','label'].includes(feature.type)?group:fallback;
      if(parent)buildBoardFeature(parent,feature,model.silk,top,bottom);
    }
    const femaleCount=model.pins.filter(pin=>(pin.contact||model.header)==='female').length;
    const headers=femaleCount ? new THREE.InstancedMesh(throughSocketGeometry(.24,.254,.50,.112),mat.black,femaleCount) : null;
    if(headers){headers.castShadow=true;headers.receiveShadow=true;group.add(headers);}
    const bottomCount=stacked ? model.pins.filter(pin=>(pin.contact||model.header)==='male').length : 0;
    const bottomSockets=bottomCount ? new THREE.InstancedMesh(throughSocketGeometry(.24,.254,.55,.112),mat.black,bottomCount) : null;
    if(bottomSockets){bottomSockets.castShadow=true;bottomSockets.receiveShadow=true;group.add(bottomSockets);}
    let femaleIndex=0,bottomIndex=0;
    for(const pin of model.pins){
      const {x,z}=pin,contact=pin.contact||model.header,endpoint='mcu:'+pin.id;
      const canonical=pin.canonical||profile.pinAliases?.[pin.id];
      const description=profile.name+' · '+(sbc?pin.location+' · ':'')+pin.label+
        (canonical&&canonical!==pin.id&&canonical!==pin.label?' · '+canonical:'');
      if(contact==='castellated'){
        if(fallback)buildPicoCastellation(fallback,pin,plated,top,bottom,endpoint);
        const tail=pin.side==='bottom';
        if(inspection){
          const rear=label(group,pin.silkLabel,.32,.092,tail?x:x-Math.sign(x)*.28,bottom-.008,tail?z-.24:z,
            {width:384,height:128,size:82,color:model.silk});
          rear.rotation.x=Math.PI/2;
          if(tail)rear.rotation.z=Math.PI/2;
          addPin(group,endpoint,x,top+.012,z,'mcu',description,.086);
        }else if(!tail){
          boardHeaderTail(group,x,z,bottom,data.mounted?undefined:.018-PICO_FREE_STAND);
          box(group,.055,top-bottom+.05,.055,mat.gold,x,(top+bottom+.035)/2,z);
          cylinder(group,.057,.022,mat.tin,x,top+.006,z,12);
          label(group,pin.silkLabel,x<0?.24:.28,.103,x-Math.sign(x)*.17,top+.008,z,
            {width:384,height:128,size:85,color:model.silk});
          addPin(group,endpoint,x,top+.039,z,'mcu',description,.086);
        }
        continue;
      }
      if(contact==='edge'||contact==='ring'){
        if(contact==='edge'){
          box(group,.09,.012,pin.padLength??.50,plated,x,top+.004,z);
        }else{
          const padShape=flatShape(pin.padOutline);
          drill(padShape,x,z,pin.holeRadius);
          const face=new THREE.ShapeGeometry(padShape,18);face.rotateX(-Math.PI/2);
          mesh(group,face,plated,0,top+.008,0);
          mesh(group,face.clone(),plated,0,bottom-.008,0);
          mesh(group,new THREE.CylinderGeometry(pin.holeRadius-.002,pin.holeRadius-.002,depth+.012,24,1,true),plated,x,(top+bottom)/2,z);
          label(group,pin.label,.39,.16,x,top+.017,z+.41,{width:256,height:128,size:86,color:'#151921',weight:'700'});
          const rearRing=label(group,pin.label,.39,.16,x,bottom-.017,z+.41,{width:256,height:128,size:86,color:'#151921',weight:'700'});
          rearRing.rotation.x=Math.PI/2;
        }
        addPin(group,endpoint,x,top+.026,z,'mcu',description,contact==='ring'?.18:.115);
        continue;
      }
      let y=.365;
      if(contact==='fixed-male'){
        if(sbc&&fallback){
          const baseHeight=.24;
          box(fallback,.243,baseHeight,.243,mat.black,x,top+baseHeight/2,z);
          const postBase=top+baseHeight;
          box(fallback,.064,pin.contactY-postBase,.064,mat.gold,x,(postBase+pin.contactY)/2,z);
        }
        addPin(group,endpoint,x,pin.contactY,z,'mcu',description,.115);
        continue;
      }
      if(fallback){
        cylinder(fallback,.095,.008,mat.tin,x,.354,z,16);
        cylinder(fallback,.086,.012,mat.tin,x,.205,z,12);
      }
      if(contact==='male'){
        if(bottomSockets){
          matrix.makeRotationX(Math.PI).setPosition(x,bottom,z);bottomSockets.setMatrixAt(bottomIndex++,matrix);
        }else box(group,.205,.16,.25,mat.black,x,.44,z);
        const post=box(group,.055,stacked?.50:.36,.055,mat.gold,x,.60,z);
        if(!data.mounted&&!bottomSockets)box(group,.055,.22,.055,mat.gold,x,.13,z);
        y=stacked?.855:.79;
        if(inspection)post.userData.inspectionEndpoint=endpoint;
      }else if(contact==='female'){
        matrix.makeTranslation(x,.356,z);headers.setMatrixAt(femaleIndex++,matrix);
        box(group,.092,.024,.092,mat.gold,x,.462,z);y=.875;
      }else if(contact==='soldered'){
        const solder=mesh(group,new THREE.SphereGeometry(.07,12,8),mat.tin,x,.357,z);
        solder.scale.y=.62;solder.userData.inspectionEndpoint=endpoint;
        if(nano)boardHeaderTail(group,x,z,bottom,data.mounted?undefined:.018-NANO_FREE_STAND);
        else{box(group,.205,.13,.25,mat.black,x,.145,z);box(group,.055,.18,.055,mat.tin,x,.09,z);}
        y=.41;
      }else cylinder(group,.045,.010,mat.hole,x,.36,z,14);
      if(data.mounted&&!nano)boardHeaderTail(group,x,z);
      addPin(group,endpoint,x,y,z,'mcu',description,.12);
      if(pin.print===false)continue;
      const tail=/bottom|tail/.test(pin.side||'');
      const expansion=profile.boardMarking==='PCA10156' && /^p\d-/.test(pin.side||'');
      const axial=tail||expansion;
      const direction=(x<0?1:-1)*(pin.printOutside?-1:1);
      const printed=label(group,pin.silkLabel||pin.label,nano?.24:axial?.35:.40,.13,axial?x:x+direction*(nano?.19:.29),.358,expansion?z+(tail?.33:-.33):tail?z-.20:z,{width:384,height:128,size:92,color:model.silk});
      if(axial)printed.rotation.z=-Math.PI/2;
    }
    if(headers)headers.instanceMatrix.needsUpdate=true;
    if(bottomSockets)bottomSockets.instanceMatrix.needsUpdate=true;
    if(!microbit){
      const rear=label(group,profile.name,Math.min(3,model.width*.8),.24,0,bottom-.007,0,{size:115,color:model.silk,weight:'600'});
      rear.rotation.x=Math.PI/2;
    }
    if(!inspection)label(group,profile.name,Math.max(2.8,model.width),.29,0,.013,model.height/2+.48,{size:100,color:'#4b756c',weight:'600'});
    markSelectable(group,'mcu');
  }

  function buildPicoCastellation(group,pin,plated,top,bottom,endpoint) {
    const {x,z,holeRadius,edge}=pin;
    const pad=flatShape(pin.padOutline);drill(pad,x,z,holeRadius);
    const face=new THREE.ShapeGeometry(pad,18);face.rotateX(-Math.PI/2);
    const thickness=top-bottom+.005;
    const barrel=new THREE.CylinderGeometry(holeRadius-.001,holeRadius-.001,thickness,24,1,true);
    const castellation=new THREE.CylinderGeometry(holeRadius-.001,holeRadius-.001,thickness,edge.segments,1,true,edge.angle,Math.PI);
    const walls=(top+bottom)/2;
    const surfaces=[mesh(group,face,plated,0,top+.003,0),mesh(group,face,plated,0,bottom-.003,0),
      mesh(group,barrel,plated,x,walls,z),mesh(group,castellation,plated,edge.x,walls,edge.z)];
    if(inspection)for(const surface of surfaces)surface.userData.inspectionEndpoint=endpoint;
  }

  function buildUnoR3Board(data, profile) {
    const group = makeBoardGroup(data);
    const fallback = addBoardAppearance(group, profile.id);
    const model = inspectionBoardVisual(profile, UNO_R3_INSPECTION.pins);
    const top = .35, bottom = .21;
    if (fallback) buildProfileBoardPcb(fallback, model, top, bottom);
    for (const feature of model.features) {
      const liveOrPrinted = ['button', 'led', 'label'].includes(feature.type);
      const parent = liveOrPrinted ? group : fallback;
      if (parent) buildBoardFeature(parent, feature, model.silk, top, bottom);
    }
    const femalePins = model.pins.filter(pin => pin.contact === 'female');
    if (fallback) {
      const geometry = throughSocketGeometry(.235, .254, femalePins[0].contactY - top, .112);
      const sockets = new THREE.InstancedMesh(geometry, mat.black, femalePins.length);
      sockets.castShadow = true;
      sockets.receiveShadow = true;
      femalePins.forEach(({x,z}, i) => {
        sockets.setMatrixAt(i, matrix.makeTranslation(x, top, z));
        box(fallback, .092, .024, .092, mat.gold, x, top + .18, z);
      });
      sockets.instanceMatrix.needsUpdate = true;
      fallback.add(sockets);
    }
    for (const pin of model.pins) {
      const { x, z, contactY } = pin;
      const endpoint = 'mcu:' + pin.id;
      const description = profile.name + ' · ' + pin.label;
      if (pin.contact === 'male') {
        if (fallback) {
          box(fallback, .24, .25, .25, mat.black, x, top + .125, z);
          const post = box(fallback, .055, contactY - top, .055, mat.gold, x, (contactY + top) / 2, z);
          if (inspection) post.userData.inspectionEndpoint = endpoint;
        }
        // The comparison includes ICSP, while the circuit exposes the 32 side sockets.
        if (inspection) addPin(group, endpoint, x, contactY, z, 'mcu', description, .10);
        continue;
      }
      addPin(group, endpoint, x, contactY, z, 'mcu', description, .12);
      label(group, pin.silkLabel, .33, .13, x - Math.sign(x) * .32, top + .008, z,
        { width:384, height:128, size:92, color:model.silk });
    }
    const rear = label(group, 'ARDUINO UNO R3', 2.22, .30, 0, bottom - .007, 0,
      { size:115, color:model.silk, weight:'600' });
    rear.rotation.x = Math.PI / 2;
    if (!inspection) label(group, profile.name, model.width, .29, 0, .013, model.height / 2 + .48,
      { size:100, color:'#4b756c', weight:'600' });
    markSelectable(group, 'mcu');
  }

  function buildNucleoF103rbBoard(data, profile) {
    const group = makeBoardGroup(data);
    const fallback = addBoardAppearance(group, profile.id);
    const model = boardVisual(profile);
    const {boardTop:top,boardBottom:bottom} = nucleoF103rbGeometry;
    if (fallback) {
      buildProfileBoardPcb(fallback, model, top, bottom);
      for (const feature of model.features) buildBoardFeature(fallback, feature, model.silk, top, bottom);
    }
    for (const pin of model.pins) {
      const {x,z,contact,contactY:y} = pin;
      if (fallback) {
        if (contact === 'male') {
          box(fallback, .22, .17, .25, mat.black, x, top + .085, z);
          box(fallback, .055, y - top, .055, mat.gold, x, (top + y) / 2, z);
          box(fallback, .055, .16, .055, mat.tin, x, bottom - .08, z);
        } else {
          mesh(fallback, throughSocketGeometry(.235, .254, y - top, .112), mat.black, x, top, z);
          box(fallback, .090, .024, .090, mat.gold, x, y - .20, z);
        }
      }
      const canonical = pin.canonical && pin.canonical !== pin.label ? ' · ' + pin.canonical : '';
      addPin(group, 'mcu:' + pin.id, x, y, z, 'mcu', profile.name + ' · ' + pin.label + canonical, .115);
    }
    if (inspection) for (const pin of options.inspection.pins ?? []) {
      if (!/^BOARD_(B1|B2|LD2)$/.test(pin.id) || ![pin.modelX,pin.modelY,pin.modelZ].every(Number.isFinite)) continue;
      addPin(group, 'mcu:' + pin.id, pin.modelX, pin.modelY, pin.modelZ, 'mcu', profile.name + ' · ' + pin.label);
    }
    if (!inspection) label(group, profile.name, model.width, .29, 0, .013, model.height / 2 + .48,
      {size:100, color:'#4b756c', weight:'600'});
    markSelectable(group, 'mcu');
  }

  function buildBoard(data) {
    const profile=getBoardProfile(circuit?.boardId);
    if (profile.id === 'uno-r3') return buildUnoR3Board(data, profile);
    if (profile.id === 'nucleo-f103rb') return buildNucleoF103rbBoard(data, profile);
    if (profile.id === 'esp32-devkitc' || profile.id === 'pico' || profile.id === 'nano' || profile.style==='raspberry-pi-sbc') {
      return buildProfileBoard(data, profile);
    }
    if(profile.style!=='bluepill'){
      renderer.domElement.dataset.boardModel='procedural';
      delete renderer.domElement.dataset.boardModelStatus;
      return buildProfileBoard(data,profile);
    }
    const group = makeBoardGroup(data);
    const fallback = addBoardAppearance(group, profile.id);
    const model=boardVisual(profile);
    const pins=inspection?model.pins.map(pin=>({...pin,x:Math.sign(pin.x)*.762})):model.pins;
    if (fallback && inspection) {
      // The photographed board has unsoldered, 600-mil-spaced plated-through pads.
      const shape=roundedShape(model.width,model.height,.035);
      for(const pin of pins){
        const hole=new THREE.Path();hole.absarc(pin.x,-pin.z,.055,0,TAU,true);shape.holes.push(hole);
      }
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:.146,bevelEnabled:false,curveSegments:6});
      geometry.rotateX(-Math.PI/2);
      const mask=new THREE.MeshStandardMaterial({color:0x0c698e,roughness:.44,metalness:.05});
      mesh(fallback,geometry,[mask,mat.laminate],0,.206,0);
    }else if(fallback){
      roundedBox(fallback, model.width, .14, model.height, .09, [mat.pcb,mat.laminate], 0, .28, 0);
      for(const y of [.218,.342])roundedBox(fallback,model.width+.003,.014,model.height+.003,.09,mat.pcb,0,y,0);
    }
    if(fallback){
      const traceMaterial = new THREE.MeshStandardMaterial({ color: 0x256bc4, roughness: 0.45, metalness: 0.15 });
      for (let i = 0; i < 12; i++) {
        const z = -1.65 + i * 0.27;
        box(fallback, 0.48, 0.002, 0.012, traceMaterial, -0.49, 0.352, z);
        box(fallback, 0.42, 0.002, 0.010, traceMaterial, 0.48, 0.352, z + 0.06);
        box(fallback, .52, .004, .016, traceMaterial, -.57, .207, z);
        box(fallback, .49, .004, .015, traceMaterial, .58, .207, z+.08);
      }
    }
    const posts = inspection ? null : new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.32,.055),mat.gold,40);
    if(posts){posts.castShadow=true;posts.receiveShadow=true;group.add(posts);}
    const padGeometry=fallback?(inspection?new THREE.RingGeometry(.055,.097,24):new THREE.CylinderGeometry(.105,.105,.006,16)):null;
    if(inspection)padGeometry?.rotateX(-Math.PI/2);
    const pads = padGeometry?new THREE.InstancedMesh(padGeometry, mat.tin, 80):null;
    if(pads)fallback.add(pads);
    const platedWalls=fallback&&inspection?new THREE.InstancedMesh(new THREE.CylinderGeometry(.054,.054,.146,24,1,true),
      new THREE.MeshStandardMaterial({color:0xc2c9c9,metalness:.7,roughness:.38,side:THREE.BackSide}),40):null;
    if(platedWalls)fallback.add(platedWalls);
    const comparisonSilk={GND:'G','3V3':'3.3',NRST:'R',VBAT:'VB'};
    let index = 0;
    [-1,1].forEach(sign => {
      const row=pins.filter(pin=>Math.sign(pin.x)===sign),x=row[0]?.x||sign*(model.width/2-.127);
      if(!inspection){
        const top=Math.min(...row.map(pin=>pin.z))-.127,bottom=Math.max(...row.map(pin=>pin.z))+.127;
        box(group,.205,.16,bottom-top,mat.plastic,x,.398,(top+bottom)/2);
      }
      row.forEach(pin => {
        const z=pin.z;
        if(posts){matrix.makeTranslation(x,.49,z);posts.setMatrixAt(index,matrix);}
        if(pads){
          matrix.makeTranslation(x, 0.354, z); pads.setMatrixAt(index, matrix);
          if(inspection)matrix.makeRotationX(Math.PI);else matrix.identity();
          matrix.setPosition(x,.205,z);pads.setMatrixAt(index+40,matrix);
        }
        if(platedWalls){matrix.makeTranslation(x,.279,z);platedWalls.setMatrixAt(index,matrix);}
        if(data.mounted)boardHeaderTail(group,x,z);
        else if(!inspection)box(group,.055,.22,.055,mat.gold,x,.12,z);
        addPin(group,'mcu:'+pin.id,pin.x,inspection ? .356 : .665,z,'mcu',profile.name+' · '+pin.label,.088);
        const pinSilk=inspection ? comparisonSilk[pin.canonical]||pin.label.replace(/^P(?=[ABC]\d)/,'') : pin.label;
        label(group,pinSilk,inspection ? .31 : .38,.18,sign*(inspection ? .964 : .685),.358,z,
          { width: 384, height: 160, size: 100, weight: '600', color: '#f1f8ff' });
        index++;
      });
    });
    if(posts)posts.instanceMatrix.needsUpdate=true;
    if(platedWalls)platedWalls.instanceMatrix.needsUpdate=true;
    if(pads)pads.instanceMatrix.needsUpdate=true;
    const chipSilkRoot=new THREE.Group();chipSilkRoot.position.z=inspection?.056:.12;chipSilkRoot.rotation.y=inspection?Math.PI/4:0;group.add(chipSilkRoot);
    const crystalZ=inspection?.951:-.80;
    if(fallback)buildBluePillFallbackDetails(fallback,chipSilkRoot,crystalZ);
    const chipSilk = label(chipSilkRoot, 'STM32\nF103C8T6\nARM Cortex-M3', 0.61, 0.48, 0, 0.485, 0.01,
      { width: 640, height: 480, color: '#cbd0d2', size: 102, weight: '500' });
    if(inspection)chipSilk.userData.inspectionChip=true;
    label(group, '8.000', 0.55, 0.19, 0.02, 0.591, crystalZ, { color: '#4b5157', size: 120 });
    if(inspection)label(group,'32.768',.60,.17,0,.501,1.48,{size:110,color:'#d1dad7'});
    // Reset switch, two yellow BOOT selectors, power and PC13 LEDs.
    const resetX=inspection?-.31:0,resetZ=inspection?-1.126:1.05;
    const resetBase=roundedBox(group,.38,.08,.40,.03,mat.tin,resetX,.39,resetZ);
    markBoardReset(cylinder(group,.115,.10,inspection?mat.gold:mat.black,resetX,.47,resetZ,20),'RST',[resetBase]);
    label(group,inspection?'RESET':'RST',.32,.14,resetX,.355,resetZ+.31,{size:100});
    const bootStart=inspection?-1.39:1.66;
    (inspection?[.127,.381]:[-.28,.28]).forEach((x,i)=>{
      box(group,.20,.15,.76,mat.black,x,.43,bootStart+.25);
      for(let p=0;p<3;p++)box(group,.045,.29,.045,mat.gold,x,.53,bootStart+p*.254);
      roundedBox(group,.23,.20,.49,.025,mat.yellow,x,.65,bootStart+.12+(i===0&&circuit?.boot0 ? .254 : 0));
      label(group,i===0?'B0':'B1',.23,.15,x,.354,bootStart+.71,{size:100});
    });
    if (inspection) {
      box(group, 1.02, .15, .21, mat.plastic, 0, .44, 2.47);
      BLUE_PILL_SWD.forEach((pin,i) => {
        const x = (i-1.5)*.254;
        const endpoint='mcu:'+pin.id;
        const pad=cylinder(group,.077,.016,mat.tin,x,.361,2.06,18);
        const base=box(group,.052,.145,.052,mat.tin,x,.423,2.06);
        const leg=box(group,.052,.052,.95,mat.tin,x,.495,2.51);
        for(const object of [pad,base,leg])object.userData.inspectionEndpoint=endpoint;
        label(group,pin.label,.25,.105,x,.354,2.27,{size:98,weight:'600'});
        addPin(group,endpoint,x,.494,2.06,'mcu',pin.label+' · SWD 调试口',.095);
      });
      diodeLamp(group,'onboard',0x31b44b,-.40,.375,1.85,.26,false);
      diodeLamp(group,'power-led',0xe34b3d,.36,.375,1.85,.25,false);
    }else{
      diodeLamp(group,'onboard',0x31b44b,.37,.375,.98,.26,false);
      diodeLamp(group,'power-led',0xe34b3d,-.35,.375,.98,.25,false);
      label(group,'STM32',.68,.21,0,.357,-2.00,{size:110,weight:'700'});
    }
    const rear=label(group,'STM32F103C8T6',1.30,.24,0,.203,0,{size:100,color:'#d0e5f9',weight:'600'});
    rear.rotation.x=Math.PI/2;
    markSelectable(group, 'mcu');
  }

  function buildBluePillFallbackDetails(group,chipSilkRoot,crystalZ) {
    // LQFP48: twelve leads on each side, 0.5 mm pitch, 7 mm body.
    const chip=chipSilkRoot.clone(false);group.add(chip);
    const chipPackage = roundedBox(chip, 0.70, 0.11, 0.70, 0.018, mat.black, 0, 0.425, 0);
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 12; i++) {
        const lead = new THREE.Group(); lead.rotation.y = side * Math.PI / 2;
        const x = (i - 5.5) * 0.05;
        box(lead, 0.025, 0.025, 0.16, mat.tin, x, 0.385, -0.415);
        box(lead, 0.025, 0.045, 0.045, mat.tin, x, 0.41, -0.36);
        chip.add(lead);
      }
    }
    const chipMark = cylinder(chip, 0.027, 0.006, new THREE.MeshStandardMaterial({ color: 0x5a6265, roughness: 1 }), -0.27, 0.485, -0.26, 14);
    if (inspection) for (const mesh of [chipPackage,chipMark]) mesh.userData.inspectionChip=true;
    // Crystals, regulator and surface-mounted parts.
    roundedBox(group, 0.82, 0.21, 0.32, 0.15, mat.silver, 0.02, 0.48, crystalZ);
    roundedBox(group, 0.88, 0.035, 0.38, 0.14, mat.tin, 0.02, 0.365, crystalZ);
    if(inspection){
      roundedBox(group,.77,.14,.34,.024,mat.black,0,.428,1.48);
      for(const x of [-.4,.4])for(const z of [1.35,1.61])box(group,.09,.035,.075,mat.tin,x,.375,z);
    }else{
      const watch = cylinder(group, 0.065, 0.53, mat.silver, -0.44, 0.44, -1.29, 16); watch.rotation.x = Math.PI / 2;
      rod(group, [-0.41, 0.43, -1.04], [-0.40, 0.365, -0.92], 0.013, mat.tin);
      rod(group, [-0.47, 0.43, -1.04], [-0.49, 0.365, -0.92], 0.013, mat.tin);
      box(group, 0.38, 0.10, 0.45, mat.black, 0.25, 0.42, -1.53);
      box(group, 0.30, 0.018, 0.15, mat.tin, 0.25, 0.365, -1.79);
      [-0.11, 0, 0.11].forEach(x => box(group, 0.045, 0.025, 0.16, mat.tin, x + 0.25, 0.365, -1.25));
      label(group, '662K', 0.30, 0.22, 0.25, 0.476, -1.55, { color: '#bec6c9', size: 95 });
      [[-.48,-1.82,0,'capacitor'],[.50,-.81,1.57,'capacitor'],[-.50,-.57,1.57,'capacitor'],
      [.49,.34,1.57,'capacitor'],[-.47,.58,0,'resistor'],[.26,.76,0,'resistor'],
      [-.24,1.05,1.57,'resistor'],[.46,1.44,1.57,'capacitor'],[-.47,1.48,0,'resistor']].forEach(a => addSmd(group, ...a));
    }
    // Metal micro-USB receptacle with visible hollow mouth and five contacts.
    const usb = new THREE.Group(); usb.position.set(0, 0.36, -2.36); group.add(usb);
    box(usb, 0.79, 0.035, 0.60, mat.silver, 0, 0.27, 0);
    box(usb, 0.79, 0.035, 0.60, mat.silver, 0, 0.015, 0);
    [-0.38, 0.38].forEach(x => box(usb, 0.035, 0.26, 0.60, mat.silver, x, 0.14, 0));
    box(usb, 0.72, 0.23, 0.035, mat.silver, 0, 0.14, 0.28);
    box(usb, 0.61, 0.06, 0.43, mat.black, 0, 0.08, -0.025);
    for (let i = 0; i < 5; i++) box(usb, 0.035, 0.012, 0.25, mat.gold, (i - 2) * 0.085, 0.118, -0.06);
    [-0.27, 0.27].forEach(x => box(usb, 0.12, 0.012, 0.10, mat.tin, x, 0.292, 0.05));
  }

  function addBoardAppearance(group, boardId) {
    const model = boardModels.get(boardId);
    const appearance = model?.createAppearance?.(inspection);
    const fallback = appearance ? null : new THREE.Group();
    if (fallback) {
      fallback.name = 'board-procedural-appearance';
      group.add(fallback);
    } else {
      attachBoardAppearance(group, appearance, boardId);
    }
    renderer.domElement.dataset.boardModel = appearance ? 'blender' : 'procedural';
    renderer.domElement.dataset.boardModelStatus = model?.status ?? 'loading';
    if (!model) requestBoardAppearance(boardId);
    return fallback;
  }

  function attachBoardAppearance(group, appearance, boardId) {
    if (boardId === 'uno-r3') {
      const mainChip = label(appearance, 'ATmega328P', 2.35, .36, -1.0287, 1.132, 1.2065,
        { color:'#c6d2d4', size:105 });
      mainChip.rotation.z = Math.PI / 2;
      if (inspection) mainChip.userData.inspectionChip = 'ATmega328P';
      label(appearance, '16U2', .40, .18, .8001, .456, -1.4351, { color:'#c6d2d4', size:105 });
    } else if (boardId === 'esp32-devkitc') {
      const shield = label(appearance, 'ESPRESSIF\nESP32-WROOM-32E', 1.45, .75, 0, .677, -1.452,
        { color:'#3d5050', size:118, height:512, weight:'600' });
      if (inspection) shield.userData.inspectionChip = 'ESP32-WROOM-32E';
    } else if (boardId === 'pico') {
      const chip = label(appearance, 'RP2040', .54, .27, 0, .446, .05,
        { color:'#bfcac3', size:95, weight:'600' });
      if (inspection) chip.userData.inspectionChip = 'RP2040';
    } else if (boardId === 'nano') {
      const chip = label(appearance, 'ATMEGA\n328P', .49, .31, 0, .476, -.66,
        { color:'#bfcac3', height:256, size:78 });
      chip.rotation.z = -Math.PI / 4;
      if (inspection) chip.userData.inspectionChip = 'ATmega328P';
      const bridge = label(appearance, 'FT232RL', .38, .14, .0038, .021, -1.1176,
        { color:'#bfcac3', size:100 });
      bridge.rotation.x = Math.PI / 2;
    } else if (boardId === 'nucleo-f103rb' && !inspection) {
      const userButton = boardView.profile.userButton.id;
      const userCap = appearance.getObjectByName('NUCLEO_B1_CAP');
      userCap.traverse(object => { if (object.isMesh) object.userData.buttonId = userButton; });
      const userModel = {cap:userCap, restY:userCap.position.y, travel:userCap.userData.travel_cm ?? .025};
      buttonModels.set(userButton, userModel);
      userCap.position.y = buttonCapY(userModel, activeButton?.id === userButton || buttonPressed(userButton));

      const resetCap = appearance.getObjectByName('NUCLEO_B2_CAP');
      const resetSurfaces = [];
      resetCap.traverse(object => { if (object.isMesh) resetSurfaces.push(object); });
      markBoardReset(resetCap, 'B2 RESET', resetSurfaces, resetCap.userData.travel_cm ?? .025);
      if (down?.resetPress && !down.resetCancelled) setBoardResetPressed(true);

      const onboard = result?.parts?.onboard;
      for (const [id,name,brightness] of [
        ['onboard','NUCLEO_LD2_LENS',onboard?.displayBrightness ?? onboard?.brightness],
        ['power-led','NUCLEO_LD3_LENS',circuit?.powered ? .7 : 0],
      ]) {
        const led = appearance.getObjectByName(name);
        if (led) {
          const model = {lens:led.material};
          ledModels.set(id, model);
          setLamp(model, brightness);
        } else ledModels.delete(id);
      }
    }
    group.add(appearance);
  }

  function requestBoardAppearance(boardId) {
    const model = { status: 'loading', createAppearance: null };
    boardModels.set(boardId, model);
    BOARD_MODEL_LOADERS[boardId]().then(createAppearance => {
      if (disposed) return;
      const group = boardView?.profile.id === boardId ? componentGroups.get('mcu') : null;
      const fallback = group?.getObjectByName('board-procedural-appearance');
      if (fallback) {
        const appearance = createAppearance(inspection);
        const previousTargets = new Set();
        fallback.traverse(object => previousTargets.add(object));
        for (let index = objectTargets.length - 1; index >= 0; index--) {
          if (previousTargets.has(objectTargets[index])) objectTargets.splice(index, 1);
        }
        attachBoardAppearance(group, appearance, boardId);
        group.remove(fallback);
        disposeTree(fallback);
        addObjectTargets(appearance, 'mcu');
        group.updateWorldMatrix(true, true);
        selectionBoxes.get('mcu')?.update();
        renderer.domElement.dataset.boardModel = 'blender';
        renderer.domElement.dataset.boardModelStatus = 'ready';
        requestFrame(true);
      }
      model.createAppearance = createAppearance;
      model.status = 'ready';
      if (boardView?.profile.id === boardId) refreshConnectionStatus();
    }).catch(() => {
      if (disposed) return;
      model.status = 'fallback';
      if (boardView?.profile.id === boardId) {
        renderer.domElement.dataset.boardModelStatus = 'fallback';
        refreshConnectionStatus();
      }
    });
  }

  function buildBreadboard(data) {
    const group = new THREE.Group(); group.position.set(data.x, 0, data.z); assembly.add(group);
    const { width, depth, pitch, coverBottom, coverTop, pinHeight } = breadboardDimensions;
    const coverHeight = coverTop - coverBottom, coverMid = (coverTop + coverBottom) / 2;
    const tileLimit = 30 * pitch / 2, railLimit = 14.5 * pitch;
    roundedBox(group, width, .24, depth, .10, mat.boardWhite, 0, .145, 0);
    roundedBox(group, width-.16, .032, depth-.16, .075, mat.holeRim, 0, .038, 0);
    const cover = (left, right, front, back) => box(group, right-left, coverHeight, back-front, mat.white,
      (left+right)/2, coverMid, (front+back)/2);
    // Signal blocks surround an actual DIP trench. Side dividers and rail markings sit on the moulded housing.
    for (const sign of [-1,1]) {
      const side = (a,b,z0,z1) => cover(Math.min(sign*a,sign*b), Math.max(sign*a,sign*b), z0, z1);
      side(tileLimit,4.15,-1.507,1.507);
      side(railLimit,4.15,-2.36,-1.84);
      side(railLimit,4.15,1.84,2.36);
    }
    for (const [front,back] of [[-2.70,-2.36],[-1.84,-1.507],[1.507,1.84],[2.36,2.70]]) cover(-4.15,4.15,front,back);
    for (const z of [-2.10,2.10]) for (const x of [-9,-3,3,9]) {
      cover((x-.5)*pitch,(x+.5)*pitch,z-.26,z+.26);
    }
    box(group, 2*tileLimit, .012, .474, mat.holeRim, 0, coverBottom+.006, 0);
    [-1.69, 1.69].forEach(z => box(group, 8.0, .002, .025, mat.holeRim, 0, coverTop+.002, z));
    const railColors = { p: new THREE.MeshStandardMaterial({ color: 0xc75b53, roughness: 0.9 }), n: new THREE.MeshStandardMaterial({ color: 0x447998, roughness: 0.9 }) };
    [[-2.43,'p'],[-1.80,'n'],[1.80,'p'],[2.43,'n']].forEach(([z, rail]) => {
      box(group, 7.54, .003, .026, railColors[rail], 0, coverTop+.002, z);
      label(group, rail === 'p' ? '+' : '−', .20, .20, -3.98, coverTop+.003, z, { color: rail === 'p' ? '#b45049' : '#3c7093', size: 130 });
    });
    label(group, '上方电源轨', 1.05, .13, 2.93, coverTop+.003, -2.59, { color: '#8b8d86', size: 100 });
    label(group, '下方电源轨 · 与上方隔离', 1.80, .13, 2.50, coverTop+.003, 2.59, { color: '#8b8d86', size: 100 });
    const sockets = breadboardSockets(), order = sockets.map(socket => socket.endpoint);
    const capacitorCenters=(circuit?.components??[]).filter(part=>part.type==='capacitor'&&part.mount)
      .map(part=>partPose(part,{x:0,z:0})).filter(pose=>pose.mounted);
    const sevenSegmentCenters=(circuit?.components??[]).filter(part=>part.type==='sevenseg'&&part.mount)
      .map(part=>partPose(part,{x:0,z:0})).filter(pose=>pose.mounted);
    const socketMaterial = [mat.white,mat.socketWall];
    const signalCells = new THREE.InstancedMesh(socketTileGeometry(pitch), socketMaterial, 300);
    const railCells = new THREE.InstancedMesh(socketTileGeometry(.26), socketMaterial, 100);
    const clips = new THREE.InstancedMesh(socketSpringGeometry(), mat.tin, sockets.length);
    const wells = new THREE.InstancedMesh(new THREE.BoxGeometry(.086, .014, .086), mat.hole, sockets.length);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hits = new THREE.InstancedMesh(new THREE.BoxGeometry(.122, .028, .122), hitMaterial, sockets.length);
    const haloGeometry = new THREE.RingGeometry(.058, .077, 16); haloGeometry.rotateX(-Math.PI / 2);
    const haloMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide });
    const halos = new THREE.InstancedMesh(haloGeometry, haloMaterial, sockets.length);
    signalCells.receiveShadow = true; railCells.receiveShadow = true;
    hits.userData = { breadboardPins: true, pinTarget: true, endpointOrder: order, componentId: 'breadboard' };
    halos.userData.halo = true;
    sockets.forEach(({endpoint,x,z,rail,description},index) => {
      matrix.makeTranslation(x,coverBottom,z);
      if(rail)railCells.setMatrixAt(index-300,matrix);else signalCells.setMatrixAt(index,matrix);
      matrix.makeTranslation(x,coverBottom+.018,z); clips.setMatrixAt(index,matrix);
      matrix.makeTranslation(x,coverBottom+.007,z); wells.setMatrixAt(index,matrix);
      matrix.makeTranslation(x,pinHeight-.009,z); hits.setMatrixAt(index,matrix);
      matrix.makeTranslation(x,coverTop+.003,z); halos.setMatrixAt(index,matrix);
      halos.setColorAt(index, new THREE.Color(0xffffff));
      endpoints.set(endpoint, { local: new THREE.Vector3(x,pinHeight,z), group, position: new THREE.Vector3(), instanceIndex:index,
        componentId:'breadboard', description, hidden:occupiedSockets.has(endpoint)||coveredByMountedBoard(data.x+x,data.z+z)||
          capacitorCenters.some(center=>capacitorCanObscuresHole(center,{x,z}))||
          sevenSegmentCenters.some(center=>sevenSegmentObscuresHole(center,{x,z})) });
    });
    group.add(signalCells,railCells,clips,wells,hits,halos);
    for (const batch of [signalCells,railCells,clips,wells,hits,halos]) batch.instanceMatrix.needsUpdate = true;
    for (const batch of [signalCells,railCells,clips,wells]) batch.userData.detailOnly = true;
    halos.instanceColor.needsUpdate = true;
    pinTargets.push(hits);
    breadboardHalos = halos; breadboardEndpointOrder = order;
    const rows = 'abcdefghij';
    for (let row = 0; row < 10; row++) {
      const z = sockets[row*30].z;
      for (const x of [-3.98,3.98]) label(group,rows[row].toUpperCase(),.16,.17,x,coverTop+.004,z,{ color:'#778187',size:110 });
    }
    [1,5,10,15,20,25,30].forEach(col => {
      [-1.58,1.58].forEach(z => label(group, String(col), .22, .13, (col - 15.5) * pitch, coverTop+.004, z, { color: '#8b9091', size: 92 }));
    });
    // Small locking tabs and moulded grooves on the perimeter.
    [-2.70,0,2.70].forEach(x => { box(group, 0.25, 0.13, 0.11, mat.boardWhite, x, 0.19, -2.75); });
    markSelectable(group, 'breadboard');
  }

  function baseHeight(x, z) {
    const bb = circuit?.breadboard;
    const { width, depth, pinHeight } = breadboardDimensions;
    if (bb && Math.abs(x - bb.x) < width/2 && Math.abs(z - bb.z) < depth/2) return pinHeight + .005;
    return 0.025;
  }
  function buildMountedDiode(group, contacts, tip) {
    // DO-35 glass envelope, dimensions in centimetres. The K band follows the positive X side.
    const height=.158;
    const outline=[[.028,-.170],[.056,-.165],[.079,-.150],[.0875,-.128],
      [.0875,.128],[.079,.150],[.056,.165],[.028,.170]];
    const glass=new THREE.MeshPhysicalMaterial({color:0xba5427,roughness:.22,clearcoat:.8,
      transparent:true,opacity:.68,depthWrite:false});
    const envelope=new THREE.LatheGeometry(outline.map(([r,x])=>new THREE.Vector2(r,x)),32).rotateZ(-Math.PI/2);
    mesh(group,envelope,glass,0,height,0);
    rod(group,[-.153,height,0],[-.009,height,0],.036,mat.tin);
    rod(group,[.010,height,0],[.153,height,0],.036,mat.tin);
    box(group,.032,.055,.056,mat.black,0,height,0);
    cylinder(group,.0885,.044,mat.black,.108,height,0,32).rotation.z=Math.PI/2;
    for(const {id,x,z} of contacts){
      const sign=Math.sign(x),bend=.054;
      const start=new THREE.Vector3(sign*.166,height,z);
      const elbow=new THREE.Vector3(x-sign*bend,height,z);
      const down=new THREE.Vector3(x,height-bend,z);
      const path=new THREE.CurvePath();
      path.add(new THREE.LineCurve3(start,elbow));
      path.add(new THREE.QuadraticBezierCurve3(elbow,new THREE.Vector3(x,height,z),down));
      path.add(new THREE.LineCurve3(down,new THREE.Vector3(x,tip,z)));
      mesh(group,new THREE.TubeGeometry(path,18,.0275,10,false),mat.tin);
      label(group,id,.15,.10,x,.008,z+.145,{color:'#345e55',size:95,weight:'700'});
    }
  }
  function proceduralCapacitorAppearance() {
    const root=new THREE.Group(),radius=CAPACITOR_RADIUS,top=CAPACITOR_HEIGHT;
    const jacket=[[0,0],[.255,0],[.294,.011],[radius,.034],
      [radius,top-.032],[.303,top-.014],[.283,top],[.252,top]];
    const sleeve=new THREE.MeshStandardMaterial({color:0x26373c,roughness:.43,metalness:.08});
    mesh(root,new THREE.LatheGeometry(jacket.map(([r,y])=>new THREE.Vector2(r,y)),48),sleeve);
    cylinder(root,.294,.026,mat.black,0,.017,0,40);
    cylinder(root,.266,.016,mat.silver,0,top-.010,0,40);
    for(const rotation of [-Math.PI/4,Math.PI/4]){
      box(root,.35,.003,.010,mat.holeRim,0,top-.001,0).rotation.y=rotation;
    }
    const angle=Math.PI/2,span=Math.PI*.32,markedRadius=radius+.002;
    const stripe=new THREE.CylinderGeometry(markedRadius,markedRadius,top-.128,24,1,true,angle-span/2,span);
    mesh(root,stripe,mat.holeRim,0,top/2,0);
    const negative=uprightLabel(root,'−\n−\n−',.125,.63,radius+.006,top/2,0,
      {width:128,height:512,size:106,weight:'700',color:'#182b31'});
    negative.rotation.y=angle;
    negative.userData.detailOnly=true;
    return root;
  }

  function attachCapacitorAppearance(model,root) {
    model.root=root;
    root.position.y=model.bottom;
    model.parent.add(root);
  }

  function capacitorMarking(group,bottom) {
    const radius=CAPACITOR_RADIUS+.003;
    const surface=new THREE.CylinderGeometry(radius,radius,.33,32,1,true,-.85,1.12);
    const ink=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false});
    const printed=mesh(group,surface,ink,0,bottom+CAPACITOR_HEIGHT/2,0);
    printed.castShadow=false;printed.receiveShadow=false;printed.renderOrder=2;printed.userData.detailOnly=true;
    return printed;
  }

  function updateCapacitorMarking(model,part) {
    const value=formatCapacitance(part.capacitance??100);
    if(value===model.value)return false;
    model.value=value;
    const {material}=model.printed;
    material.map?.dispose();
    material.map=textTexture(value,{width:384,height:256,size:110,color:'#e4e9e8'},384);
    material.needsUpdate=true;
    if(model.floorLabel){
      const floorInk=model.floorLabel.material;
      floorInk.map.dispose();
      floorInk.map=textTexture(componentLabel(part,PARTS[part.type]),{color:'#42675d',size:110});
    }
    return true;
  }

  function showCapacitorAssetStatus() {
    renderer.domElement.dataset.capacitorModel=capacitorAsset.create?'blender':'procedural';
    renderer.domElement.dataset.capacitorModelStatus=capacitorAsset.status;
  }

  function requestCapacitorAppearance() {
    capacitorAsset={status:'loading',create:null};
    loadCapacitorAppearance().then(create=>{
      if(disposed)return;
      capacitorAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of capacitorModels){
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachCapacitorAppearance(model,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(retired.size){showCapacitorAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      capacitorAsset={status:'fallback',create:null};
      if(capacitorModels.size)showCapacitorAssetStatus();
    });
  }
  function buttonPressed(id) {
    if(id===boardView?.profile.userButton?.id)return Boolean(circuit?.board.userButtonPressed);
    return Boolean(getPart(id)?.pressed);
  }

  function buttonCapY(model,pressed) {
    return model.restY-(pressed?(model.travel??.05):0);
  }

  function showButtonPressed(id,pressed) {
    const model=buttonModels.get(id);
    if(!model)return;
    model.cap.position.y=buttonCapY(model,pressed);
    requestFrame(true);
  }

  function proceduralButtonAppearance() {
    const root=new THREE.Group();
    roundedBox(root,.61,.22,.61,.035,mat.black,0,.14,0);
    roundedBox(root,.61,.035,.61,.03,mat.tin,0,.267,0);
    for(const x of [-.24,.24])for(const z of [-.24,.24])cylinder(root,.028,.018,mat.silver,x,.293,z,12);
    return {root,cap:cylinder(root,.155,.12,mat.plastic,0,.34,0,24),travel:.05};
  }

  function attachButtonAppearance(model,id,{root,cap,travel}) {
    Object.assign(model,{root,cap,travel,restY:cap.position.y});
    cap.position.y=buttonCapY(model,buttonPressed(id));
    cap.traverse(object=>{if(object.isMesh)object.userData.buttonId=id;});
    model.parent.add(root);
  }

  function buttonLeadTab(group,fromX,fromZ,toX,toZ) {
    const dx=toX-fromX,dz=toZ-fromZ;
    const tab=box(group,Math.hypot(dx,dz)+.038,.025,.050,mat.tin,(fromX+toX)/2,.084,(fromZ+toZ)/2);
    tab.rotation.y=-Math.atan2(dz,dx);
  }

  function showButtonAssetStatus() {
    renderer.domElement.dataset.buttonModel=buttonAsset.create?'blender':'procedural';
    renderer.domElement.dataset.buttonModelStatus=buttonAsset.status;
  }

  function requestButtonAppearance() {
    buttonAsset={status:'loading',create:null};
    loadButtonAppearance().then(create=>{
      if(disposed)return;
      buttonAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of buttonModels){
        if(!model.parent)continue;
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachButtonAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(retired.size){showButtonAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      buttonAsset={status:'fallback',create:null};
      if([...buttonModels.values()].some(model=>model.parent))showButtonAssetStatus();
    });
  }

  function potPosition(id) {
    return clamp(Number(getPart(id)?.position)||0,0,1);
  }

  function potAngle(value) {
    return (.5-value)*POT_ELECTRICAL_SWEEP;
  }

  function proceduralPotAppearance() {
    const root=new THREE.Group(),knob=new THREE.Group();
    roundedBox(root,.86,.25,.84,.06,mat.blue,0,.16,0);
    cylinder(root,.335,.06,mat.tin,0,.305,0,28);
    knob.position.y=.34;root.add(knob);
    cylinder(knob,.29,.25,mat.white,0,.12,0,28);
    for(let i=0;i<24;i++){
      const angle=i/24*TAU;
      box(knob,.018,.20,.032,mat.holeRim,Math.sin(angle)*.282,.12,Math.cos(angle)*.282).rotation.y=angle;
    }
    box(knob,.045,.005,.20,mat.blue,0,.249,.10);
    return {root,knob};
  }

  function attachPotAppearance(model,id,{root,knob}) {
    model.root=root;
    model.knob=knob;
    const bounds=new THREE.Box3().setFromObject(knob);
    model.knobTop=bounds.max.y-knob.position.y;
    model.knobRadius=(bounds.max.x-bounds.min.x)/2;
    knob.rotation.y=potAngle(potPosition(id));
    root.traverse(object=>{if(object.isMesh)object.userData.potHousing=true;});
    knob.traverse(object=>{if(object.isMesh)object.userData.potKnob=true;});
    model.parent.add(root);
  }

  function nearPotAdjuster(id,event,bounds) {
    const {knob,knobTop,knobRadius}=potModels.get(id);
    const center=knob.localToWorld(new THREE.Vector3(0,knobTop,0));
    const edge=new THREE.Vector3(knobRadius,0,0).applyQuaternion(camera.quaternion).add(center).project(camera);
    center.project(camera);
    return center.z>=-1&&center.z<=1&&nearCompactAdjuster(
      event.clientX-bounds.left-(center.x+1)*bounds.width/2,
      event.clientY-bounds.top-(1-center.y)*bounds.height/2,
      Math.abs(edge.x-center.x)*bounds.width/2
    );
  }

  function showPotAssetStatus() {
    renderer.domElement.dataset.potModel=potAsset.create?'blender':'procedural';
    renderer.domElement.dataset.potModelStatus=potAsset.status;
  }

  function requestPotAppearance() {
    potAsset={status:'loading',create:null};
    import('./potentiometer-model.js').then(({loadPotentiometerModel})=>loadPotentiometerModel()).then(create=>{
      if(disposed)return;
      potAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of potModels){
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachPotAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(potModels.size){showPotAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      potAsset={status:'fallback',create:null};
      if(potModels.size)showPotAssetStatus();
    });
  }

  function proceduralEncoderAppearance() {
    const root=new THREE.Group(),shaft=new THREE.Group();
    const {width,depth,caseBottom,shaftBase,shaftTop,shaftRadius}=encoderVisual;
    roundedBox(root,width,shaftBase-caseBottom,depth,.045,mat.tin,0,(shaftBase+caseBottom)/2,0);
    roundedBox(root,width-.075,.14,depth-.075,.04,mat.black,0,caseBottom+.04,0);
    cylinder(root,.35,.70,mat.silver,0,shaftBase+.35,0,32);
    for(const x of [-.66,.66])box(root,.15,.11,.38,mat.tin,x,caseBottom+.06,0);
    for(const {id,x,y,z} of encoderVisual.pins){
      const bend=[x,.10,z*.90];
      rod(root,[x,caseBottom,z*.82],bend,.026,mat.tin).userData.encoderTerminal=id;
      rod(root,bend,[x,y,z],.026,mat.tin).userData.encoderTerminal=id;
    }
    root.add(shaft);shaft.position.y=shaftBase;
    cylinder(shaft,shaftRadius,1,mat.silver,0,.50,0,32);
    const flat=Math.asin(.15/shaftRadius);
    const outline=Array.from({length:33},(_,i)=>{
      const a=Math.PI-flat+(Math.PI+2*flat)*i/32;
      return [Math.cos(a)*shaftRadius,Math.sin(a)*shaftRadius];
    });
    const geometry=new THREE.ExtrudeGeometry(flatShape(outline),{depth:shaftTop-shaftBase-1,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    mesh(shaft,geometry,mat.silver,0,1,0);
    return {root,shaft};
  }

  function attachEncoderAppearance(model,id,{root,shaft}) {
    Object.assign(model,{root,shaft,restY:shaft.position.y});
    const {angle,pressed}=encoderAppearance(result?.parts?.[id]);
    shaft.rotation.y=-angle*Math.PI/180;
    shaft.position.y=model.restY-(pressed?encoderVisual.pressTravel:0);
    shaft.traverse(object=>{if(object.isMesh)object.userData.encoderShaft=true;});
    model.parent.add(root);
  }

  function showEncoderAssetStatus() {
    renderer.domElement.dataset.encoderModel=encoderAsset.create?'blender':'procedural';
    renderer.domElement.dataset.encoderModelStatus=encoderAsset.status;
  }

  function requestEncoderAppearance() {
    encoderAsset={status:'loading',create:null};
    import('./encoder-pec11r-model.js').then(({loadEncoderPec11rModel})=>loadEncoderPec11rModel()).then(create=>{
      if(disposed)return;
      encoderAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of encoderModels){
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachEncoderAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(encoderModels.size){showEncoderAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      encoderAsset={status:'fallback',create:null};
      if(encoderModels.size)showEncoderAssetStatus();
    });
  }

  function proceduralJoystickAppearance() {
    const root=new THREE.Group(),stick=new THREE.Group(),plunger=new THREE.Group(),cap=new THREE.Group();
    const {width,depth,boardY,centerZ,pivotY,capTop,capRadius}=joystickVisual;
    const housingZ=centerZ;
    roundedBox(root,width,.14,depth,.06,mat.red,0,boardY-.07,0);
    roundedBox(root,1.84,.65,1.79,.08,mat.tin,0,.68,housingZ);
    roundedBox(root,.40,.51,1.16,.045,mat.blue,1.02,.63,housingZ);
    roundedBox(root,1.15,.51,.40,.045,mat.blue,0,.63,housingZ-.96);
    cylinder(root,.55,.12,mat.black,0,.99,housingZ,36);
    for(const {id,x,y,z} of joystickVisual.pins){
      cylinder(root,.085,.019,mat.gold,x,y,z,24).userData.joystickTerminal=id;
      cylinder(root,.048,.020,mat.hole,x,y+.001,z,20).userData.joystickTerminal=id;
    }
    root.add(stick);stick.position.set(0,pivotY,centerZ);stick.add(plunger);plunger.add(cap);
    cylinder(plunger,.15,1.10,mat.black,0,.55,0,24);
    const capHeight=.32, capY=capTop-pivotY;
    mesh(cap,new THREE.CylinderGeometry(capRadius,capRadius*.74,capHeight,48),mat.black,0,capY-capHeight/2,0);
    cylinder(cap,capRadius*.81,.028,mat.plastic,0,capY+.004,0,48);
    for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){
      if(x*x+z*z<7)cylinder(cap,.038,.018,mat.plastic,x*.29,capY+.020,z*.29,10);
    }
    return {root,stick,plunger,cap};
  }

  function poseJoystick(model,reading) {
    const {x,y,pressed}=joystickAppearance(reading);
    if(model.x===x&&model.y===y&&model.pressed===pressed)return false;
    Object.assign(model,{x,y,pressed});
    const radius=Math.hypot(x,y);
    if(radius)model.stick.quaternion.setFromAxisAngle(joystickAxis.set(-y,0,-x).normalize(),radius*joystickVisual.tiltDegrees*Math.PI/180);
    else model.stick.quaternion.identity();
    model.plunger.position.y=model.restY-(pressed?joystickVisual.pressTravel:0);
    return true;
  }

  function attachJoystickAppearance(model,id,{root,stick,plunger,cap}) {
    Object.assign(model,{root,stick,plunger,restY:plunger.position.y,x:null,y:null,pressed:null});
    poseJoystick(model,result?.parts?.[id]);
    cap.traverse(object=>{if(object.isMesh)object.userData.joystickCap=true;});
    model.parent.add(root);
  }

  function showJoystickAssetStatus() {
    renderer.domElement.dataset.joystickModel=joystickAsset.create?'blender':'procedural';
    renderer.domElement.dataset.joystickModelStatus=joystickAsset.status;
  }

  function requestJoystickAppearance() {
    joystickAsset={status:'loading',create:null};
    import('./joystick-sparkfun-model.js').then(({loadJoystickSparkFunModel})=>loadJoystickSparkFunModel()).then(create=>{
      if(disposed)return;
      joystickAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of joystickModels){
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachJoystickAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let i=objectTargets.length-1;i>=0;i--){
        if(retired.has(objectTargets[i]))objectTargets.splice(i,1);
      }
      if(joystickModels.size){showJoystickAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      joystickAsset={status:'fallback',create:null};
      if(joystickModels.size)showJoystickAssetStatus();
    });
  }

  function joystickScreenAxes(id) {
    const parent=joystickModels.get(id)?.parent;
    if(!parent)return null;
    const {width,height}=renderer.domElement.getBoundingClientRect();
    const {capTop,centerZ}=joystickVisual;
    const project=(x,z)=>parent.localToWorld(new THREE.Vector3(x,capTop,z)).project(camera);
    const center=project(0,centerZ),right=project(.1,centerZ),forward=project(0,centerZ-.1);
    return {xx:(right.x-center.x)*width,xy:(right.y-center.y)*height,
      yx:(forward.x-center.x)*width,yy:(forward.y-center.y)*height};
  }

  function proceduralKingbrightRgbAppearance(){
    const root=new THREE.Group();
    const {baseY,height,radius,flangeRadius,flatX,pins}=rgbLedVisual;
    const profile=[[0,0],[flangeRadius,0],[flangeRadius,.075],[radius,.075],[radius,height-radius]];
    for(let i=1;i<=12;i++){
      const angle=i*Math.PI/24;
      profile.push([radius*Math.cos(angle),height-radius+radius*Math.sin(angle)]);
    }
    const geometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),36);
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++)if(positions.getY(i)<=.075&&positions.getX(i)<flatX)positions.setX(i,flatX);
    geometry.computeVertexNormals();
    const lens=mesh(root,geometry,new THREE.MeshStandardMaterial({color:0xe7e6dd,roughness:.46,emissiveIntensity:0}),0,baseY,0);
    lens.castShadow=false;
    for(const {id,x,y,z} of pins){
      const bottom=y-.02;
      box(root,.050,baseY-bottom,.050,mat.tin,x,(baseY+bottom)/2,z).userData.rgbLedTerminal=id;
    }
    return {root,lens};
  }

  function setKingbrightRgbLight(model,reading){
    const {channels,level,hue}=rgbLedLight(reading);
    if(model.channels&&channels.every((value,index)=>value===model.channels[index]))return false;
    model.channels=channels;
    model.material.emissive.setRGB(...hue);
    model.material.emissiveIntensity=level*2.1;
    model.material.color.copy(model.restColor).lerp(model.material.emissive,Math.min(.72,level*1.5));
    return true;
  }

  function attachKingbrightRgbAppearance(model,id,{root,lens}){
    lens.userData.rgbLedLens=true;
    Object.assign(model,{root,material:lens.material,restColor:lens.material.color.clone(),channels:null});
    setKingbrightRgbLight(model,result?.parts?.[id]);
    model.parent.add(root);
  }

  function showKingbrightRgbAssetStatus(){
    renderer.domElement.dataset.rgbLedModel=kingbrightRgbAsset.create?'blender':'procedural';
    renderer.domElement.dataset.rgbLedModelStatus=kingbrightRgbAsset.status;
  }

  function requestKingbrightRgbAppearance(){
    kingbrightRgbAsset={status:'loading',create:null};
    import('./rgbled-kingbright-model.js').then(({loadKingbrightRgbLedModel})=>loadKingbrightRgbLedModel()).then(create=>{
      if(disposed)return;
      kingbrightRgbAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of kingbrightRgbModels){
        model.root.traverse(object=>retired.add(object));
        model.parent.remove(model.root);disposeTree(model.root);
        attachKingbrightRgbAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(kingbrightRgbModels.size){showKingbrightRgbAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      kingbrightRgbAsset={status:'fallback',create:null};
      if(kingbrightRgbModels.size)showKingbrightRgbAssetStatus();
    });
  }

  function servoPhysicalAngle(id) {
    const angle=result?.parts?.[id]?.angle;
    return Number.isFinite(angle)?angle:null;
  }

  function servoHornRotation(angle) {
    return (90-angle)*Math.PI/180;
  }

  function proceduralServoAppearance(hs55) {
    const root=new THREE.Group(),horn=new THREE.Group();
    const housing=new THREE.MeshPhysicalMaterial({color:hs55?0x292e35:0x2374bc,roughness:.25,metalness:.06,clearcoat:.9,clearcoatRoughness:.18});
    roundedBox(root,1.23,2.05,2.26,.10,housing,0,1.18,0);
    roundedBox(root,1.24,.24,2.27,.08,hs55?mat.plastic:mat.blue,0,.15,0);
    roundedBox(root,1.24,.28,2.28,.08,housing,0,2.22,0);
    for(const z of [-1.27,1.27]){
      roundedBox(root,1.62,.14,.40,.07,housing,0,1.99,z);
      for(const x of [-.56,.56])cylinder(root,.065,.018,mat.hole,x,2.07,z,16);
    }
    for(const x of [-.45,.45])for(const z of [-.91,.91]){
      cylinder(root,.045,.04,mat.silver,x,2.375,z,14);
      box(root,.060,.003,.012,mat.black,x,2.397,z);
    }
    const shaftZ=hs55?.53:-.56;
    cylinder(root,.31,.25,mat.white,0,2.49,shaftZ,28);
    horn.position.set(0,2.66,shaftZ);root.add(horn);
    roundedBox(horn,1.78,.09,.25,.12,mat.white,0,0,0);
    cylinder(horn,.22,.10,mat.white,0,.01,0,28);
    for(const x of [-.70,-.50,.50,.70])cylinder(horn,.031,.005,mat.hole,x,.052,0,12);
    cylinder(horn,.08,.035,mat.silver,0,.078,0,20);
    box(horn,.09,.004,.015,mat.black,0,.098,0);
    if(hs55)roundedBox(root,.30,.14,.12,.035,mat.plastic,0,.35,1.13);
    uprightLabel(root,hs55?'HS-55\n备用外形':'MICRO SERVO\nSG90 · 9g',1.02,.55,0,1.24,1.137,
      {width:640,height:320,color:'#e9f3ff',size:90,background:hs55?'#394149':'#2e6cac'});
    return {root,horn};
  }

  function attachServoAppearance(model,id,{root,horn}) {
    Object.assign(model,{root,horn});
    horn.rotation.y=servoHornRotation(servoPhysicalAngle(id)??90);
    model.parent.add(root);
  }

  function showHs55AssetStatus() {
    renderer.domElement.dataset.servoModel=hs55Asset.create?'blender':'procedural';
    renderer.domElement.dataset.servoModelStatus=hs55Asset.status;
  }

  function requestHs55Appearance() {
    hs55Asset={status:'loading',create:null};
    loadHs55Appearance().then(create=>{
      if(disposed)return;
      hs55Asset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of servoModels){
        if(!model.hs55)continue;
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachServoAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(retired.size){showHs55AssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      hs55Asset={status:'fallback',create:null};
      if([...servoModels.values()].some(model=>model.hs55))showHs55AssetStatus();
    });
  }

  function proceduralSevenSegmentAppearance(contacts) {
    const root=new THREE.Group(),segments={};
    const {width,height,depth,leadLength,decimal,offColor}=sevenSegmentVisual;
    roundedBox(root,width,height,depth,.045,mat.black,0,height/2,0);
    roundedBox(root,width-.06,.012,depth-.06,.023,
      new THREE.MeshStandardMaterial({color:'#514d58',roughness:.56}),0,height-.004,0);
    const lensMaterial=()=>new THREE.MeshStandardMaterial({color:offColor,roughness:.49});
    for(const [name,points] of Object.entries(sevenSegmentVisual.segments)){
      const shape=new THREE.Shape();
      points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
      shape.closePath();
      const geometry=new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI/2);
      segments[name]=mesh(root,geometry,lensMaterial(),0,height+.004,0);
    }
    segments.dp=cylinder(root,decimal.radius,.006,lensMaterial(),decimal.x,height+.003,decimal.z,20);
    for(const {x,z} of contacts)cylinder(root,.025,leadLength+.018,mat.tin,x,(.018-leadLength)/2,z,10);
    return {root,segments};
  }

  function setSevenSegmentLenses(id, model) {
    let changed=false;
    const reading=result?.parts?.[id];
    for(const name of SEGMENT_NAMES){
      const {material,rest}=model.lenses[name],level=sevenSegmentIntensity(reading,name);
      if(material.emissiveIntensity===level*1.5)continue;
      material.color.copy(rest).lerp(SEGMENT_LIGHT,Math.min(1,level*2.6));
      material.emissiveIntensity=level*1.5;
      changed=true;
    }
    return changed;
  }

  function attachSevenSegmentAppearance(model,id,{root,segments}) {
    model.root=root;
    model.lenses=Object.fromEntries(Object.entries(segments).map(([name,lens])=>{
      const material=lens.material;
      material.emissive.copy(SEGMENT_LIGHT);
      material.emissiveIntensity=0;
      return [name,{material,rest:material.color.clone()}];
    }));
    root.position.y=model.bodyBase;
    model.parent.add(root);
    setSevenSegmentLenses(id,model);
  }

  function showSevenSegmentAssetStatus() {
    renderer.domElement.dataset.sevenSegmentModel=sevenSegmentAsset.create?'blender':'procedural';
    renderer.domElement.dataset.sevenSegmentModelStatus=sevenSegmentAsset.status;
  }

  function requestSevenSegmentAppearance() {
    sevenSegmentAsset={status:'loading',create:null};
    loadSevenSegmentAppearance().then(create=>{
      if(disposed)return;
      sevenSegmentAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of segmentModels){
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachSevenSegmentAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(segmentModels.size){showSevenSegmentAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      sevenSegmentAsset={status:'fallback',create:null};
      if(segmentModels.size)showSevenSegmentAssetStatus();
    });
  }

  function proceduralFa130Appearance() {
    const {width,height,caseDepth,noseZ,rearZ,axisY,pins}=fa130Visual;
    const root=new THREE.Group(),rotor=new THREE.Group();
    roundedBox(root,width,height,caseDepth,.22,mat.silver,0,height/2,0);
    roundedBox(root,width-.08,height-.08,rearZ-caseDepth/2,.15,mat.plastic,0,height/2,(rearZ+caseDepth/2)/2);
    rod(root,[0,axisY,-1.25],[0,axisY,-1.40],.24,mat.tin,32);
    rotor.position.y=axisY;root.add(rotor);
    rod(rotor,[0,0,-1.36],[0,0,noseZ],.10,mat.silver,24);
    const witness=mesh(rotor,new THREE.CircleGeometry(.024,12),mat.black,.035,0,noseZ-.003);
    witness.rotation.y=Math.PI;witness.userData.detailOnly=true;
    for(const {x,y,z} of pins){
      const ring=mesh(root,new THREE.RingGeometry(.045,.10,20),mat.tin,x,y,z);
      ring.rotation.x=-Math.PI/2;
      box(root,.076,.085,.13,mat.tin,x,y-.04,z+.075);
    }
    return {root,rotor,witness};
  }

  function makeMotorBlur(group) {
    const material=new THREE.MeshBasicMaterial({
      color:0x4c5757,transparent:true,opacity:.49,depthWrite:false,side:THREE.DoubleSide
    });
    const mark=mesh(group,new THREE.RingGeometry(.025,.102,32),material,0,fa130Visual.axisY,fa130Visual.noseZ-.005);
    mark.visible=false;mark.castShadow=false;mark.receiveShadow=false;mark.userData.detailOnly=true;
    return mark;
  }

  function updateMotorAppearance(id,model) {
    const reading=motorMotion(result?.parts?.[id]);
    const angle=reading.angle===null?(model.fa130?model.rotor.rotation.z:0):THREE.MathUtils.degToRad(reading.angle);
    const fast=Boolean(model.blur&&reading.blur);
    const changed=model.rotor.rotation.z!==angle&&!fast || Boolean(model.blur&&model.blur.visible!==fast);
    model.rotor.rotation.z=angle;
    if(model.blur){model.blur.visible=fast;model.witness.visible=!fast;}
    return changed;
  }

  function attachFa130Appearance(model,id,appearance) {
    const previousAngle=model.rotor?.rotation.z;
    Object.assign(model,appearance);
    if(Number.isFinite(previousAngle))model.rotor.rotation.z=previousAngle;
    model.parent.add(model.root);
    updateMotorAppearance(id,model);
  }

  function showFa130AssetStatus() {
    renderer.domElement.dataset.motorModel=fa130Asset.create?'blender':'procedural';
    renderer.domElement.dataset.motorModelStatus=fa130Asset.status;
  }

  function requestFa130Appearance() {
    fa130Asset={status:'loading',create:null};
    loadFa130Appearance().then(create=>{
      if(disposed)return;
      fa130Asset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of motorModels){
        if(!model.fa130)continue;
        const previous=model.root;
        previous.traverse(object=>retired.add(object));
        model.parent.remove(previous);
        disposeTree(previous);
        attachFa130Appearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(retired.size){showFa130AssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      fa130Asset={status:'fallback',create:null};
      if([...motorModels.values()].some(model=>model.fa130))showFa130AssetStatus();
    });
  }

  function refreshMotorReadout() {
    const model=motorModels.get(selectedId);
    motorReadout.hidden=!model;
    if(!model)return;
    const {speed,direction,blur}=motorMotion(result?.parts?.[selectedId]);
    const message=speed+' · '+direction+(model.fa130&&blur?' · 轴端运动模糊':'');
    if(motorReadout.textContent!==message)motorReadout.textContent=message;
  }

  function buildDrv8833(group,pin) {
    const {width,depth,baseY,topY,chip,passives,pins}=drv8833Visual;
    const shape=roundedShape(width,depth,.025);
    for(const {x,z} of pins)drill(shape,x,z,.046);
    const board=new THREE.ExtrudeGeometry(shape,{depth:topY-baseY,bevelEnabled:false,curveSegments:12});
    board.rotateX(-Math.PI/2);
    const mask=new THREE.MeshStandardMaterial({color:0x1f8151,roughness:.48});
    mesh(group,board,[mask,mat.laminate],0,baseY,0);
    for(const contact of pins){
      const {id,x,y,z}=contact;
      const pad=mesh(group,new THREE.RingGeometry(.046,.091,20),mat.tin,x,topY+.003,z);
      pad.rotation.x=-Math.PI/2;
      box(group,.195,baseY-.018,.195,mat.plastic,x,(baseY-.018)/2+.009,z);
      box(group,.062,y-.008,.062,mat.tin,x,(y+.008)/2,z);
      pin(id,x,y,z,drv8833PinDescription(contact),.096);
    }
    for(const [x,z,w,d,h,kind] of passives){
      box(group,w,h,d,kind==='ceramic'?mat.ceramic:mat.black,x,topY+h/2,z);
      for(const side of [-1,1])box(group,.034,h*.82,d+.01,mat.tin,x+side*w/2,topY+h*.43,z);
    }
    const {x,z,width:w,depth:d,height:h}=chip;
    roundedBox(group,w,h,d,.025,mat.black,x,topY+h/2,z);
    for(const side of [-1,1])for(const offset of [-.12,-.04,.04,.12]){
      box(group,.052,.025,.038,mat.tin,x+side*w/2,topY+.014,z+offset);
      box(group,.038,.025,.052,mat.tin,x+offset,topY+.014,z+side*d/2);
    }
    cylinder(group,.020,.003,mat.hole,x-.135,topY+h+.002,z-.130,14);
    label(group,'DRV8833',.33,.10,x,topY+h+.003,z,{color:'#b7c3bf',size:125}).userData.detailOnly=true;
    for(const padX of [.01,.27])for(const padZ of [.66,.86]){
      box(group,.15,.012,.13,mat.tin,padX,topY+.007,padZ);
    }
    for(const side of [-1,1]){
      const names=pins.filter(contact=>Math.sign(contact.x)===side).map(contact=>contact.label).join('\n');
      label(group,names,.44,depth,side*.89,topY+.010,0,{width:338,height:896,size:89.6,weight:'700',color:'#315d53'}).userData.detailOnly=true;
    }
  }

  function proceduralHcsr04Appearance() {
    const root=new THREE.Group();
    const {width,depth,baseY,topY,rimY,canRadius,screenRadius,transducers,holes,pins}=hcsr04Visual;
    const shape=roundedShape(width,depth,.04);
    for(const [x,z] of holes)drill(shape,x,z,.095);
    for(const {x,z} of pins)drill(shape,x,z,.047);
    const board=new THREE.ExtrudeGeometry(shape,{depth:topY-baseY,bevelEnabled:false,curveSegments:14});
    board.rotateX(-Math.PI/2);
    const mask=new THREE.MeshStandardMaterial({color:0x125790,roughness:.48});
    mesh(root,board,[mask,mat.laminate],0,baseY,0);
    for(const {x,z} of transducers){
      const profile=[[canRadius,topY+.03],[canRadius,rimY-.04],[canRadius-.025,rimY],
        [screenRadius+.013,rimY],[screenRadius,rimY-.025],[screenRadius,rimY-.18],
        [screenRadius+.03,rimY-.18],[canRadius-.018,topY+.03],[canRadius,topY+.03]];
      mesh(root,new THREE.LatheGeometry(profile.map(point=>new THREE.Vector2(...point)),44),mat.silver,x,0,z);
      cylinder(root,screenRadius,.025,mat.black,x,rimY-.152,z,40);
      for(let i=-9;i<=9;i++){
        const offset=i*.071,span=2*Math.sqrt(screenRadius**2-offset**2);
        box(root,span,.015,.017,mat.holeRim,x,rimY-.083,z+offset);
        box(root,.017,.015,span,mat.holeRim,x+offset,rimY-.069,z);
      }
    }
    roundedBox(root,.94,.27,.31,.08,mat.silver,0,topY+.16,-.42);
    for(const {x,y,z,id} of pins){
      box(root,.246,.21,.247,mat.plastic,x,baseY-.107,z);
      box(root,.061,y-.016,.061,mat.tin,x,(y+.016)/2,z);
      cylinder(root,.081,.024,mat.tin,x,topY+.013,z,16);
      label(root,id,.218,.083,x,topY+.006,.62,{color:'#e3eee9',size:118}).userData.detailOnly=true;
    }
    label(root,'HC-SR04',.97,.20,0,topY+.006,.25,{color:'#e3eee9',size:114}).userData.detailOnly=true;
    for(const {id,x} of transducers)label(root,id,.14,.11,x*1.31,topY+.006,.875,{color:'#e3eee9',size:109}).userData.detailOnly=true;
    return root;
  }

  function buildSensorCue(group,transducer,color) {
    const {rimY,canRadius}=hcsr04Visual;
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.80,depthWrite:false,
      side:THREE.DoubleSide,toneMapped:false});
    const ring=mesh(group,new THREE.RingGeometry(canRadius-.041,canRadius+.031,48),material,transducer.x,rimY+.024,transducer.z);
    ring.rotation.x=-Math.PI/2;ring.visible=false;
    ring.castShadow=false;ring.receiveShadow=false;ring.userData.detailOnly=true;
    return ring;
  }

  function updateSensorAppearance(id,model) {
    const {transmitting,receiving}=hcsr04Observation(result?.parts?.[id]);
    const changed=model.tx.visible!==transmitting||model.rx.visible!==receiving;
    model.tx.visible=transmitting;model.rx.visible=receiving;
    return changed;
  }

  function refreshSensorReadout() {
    sensorReadout.hidden=!sensorModels.has(selectedId);
    if(sensorReadout.hidden)return;
    const {text}=hcsr04Observation(result?.parts?.[selectedId]);
    const message='HC-SR04 · '+text;
    if(sensorReadout.textContent!==message)sensorReadout.textContent=message;
  }

  function showHcsr04AssetStatus() {
    renderer.domElement.dataset.hcsr04Model=hcsr04Asset.create?'blender':'procedural';
    renderer.domElement.dataset.hcsr04ModelStatus=hcsr04Asset.status;
  }

  function requestHcsr04Appearance() {
    hcsr04Asset={status:'loading',create:null};
    loadHcsr04Appearance().then(create=>{
      if(disposed)return;
      hcsr04Asset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of sensorModels){
        model.root.traverse(object=>retired.add(object));
        model.parent.remove(model.root);
        disposeTree(model.root);
        model.root=create();
        model.parent.add(model.root);
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(sensorModels.size){showHcsr04AssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      hcsr04Asset={status:'fallback',create:null};
      if(sensorModels.size)showHcsr04AssetStatus();
    });
  }

  function proceduralSsd1306Appearance() {
    const root=new THREE.Group();
    const {outline,baseY,topY,glass,header,mounts}=ssd1306Visual;
    const shape=flatShape(outline);
    for(const [x,z] of mounts)drill(shape,x,z,.125);
    for(const {x,z} of header)drill(shape,x,z,.050);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:topY-baseY,bevelEnabled:false,curveSegments:14});
    geometry.rotateX(-Math.PI/2);
    mesh(root,geometry,[mat.plastic,mat.laminate],0,baseY,0);
    const pad=(x,z,inner,outer)=>{
      const ring=mesh(root,new THREE.RingGeometry(inner,outer,24),mat.gold,x,topY+.003,z);
      ring.rotation.x=-Math.PI/2;
    };
    for(const [x,z] of mounts)pad(x,z,.125,.160);
    header.forEach(({label:legend,x,z},index)=>{
      pad(x,z,.050,.0889);
      label(root,legend,.21,.09,x,topY+.006,z+(index%2===0?.156:-.149),{color:'#e3e5dc',size:110}).userData.detailOnly=true;
    });
    const edge=new THREE.MeshStandardMaterial({color:0x626f77,roughness:.27,metalness:.24});
    roundedBox(root,glass.width,.084,glass.depth,.016,edge,0,glass.bottomY+.042,glass.z);
    roundedBox(root,glass.width-.011,.061,glass.depth-.014,.013,mat.black,0,glass.topY-.0305,glass.z);
    roundedBox(root,1.30,.025,.33,.025,mat.black,0,.612,.77);
    const connector=new THREE.MeshStandardMaterial({color:0xe6e0ce,roughness:.5});
    for(const side of [-1,1]){
      for(const y of [.023,.270])box(root,.425,.046,.61,connector,side*1.2065,y,-.0635);
      for(const z of [-.3375,.2105])box(root,.425,.256,.061,connector,side*1.2065,.147,z);
      box(root,.075,.251,.51,connector,side*1.0315,.149,-.0635);
    }
    return root;
  }

  function buildSsd1306Screen(group) {
    const raster=createSsd1306Raster();
    raster.paint(null);
    const texture=new THREE.CanvasTexture(raster.canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.minFilter=texture.magFilter=THREE.NearestFilter;
    texture.generateMipmaps=false;
    const {width,depth,y,z}=ssd1306Visual.active;
    const screen=mesh(group,new THREE.PlaneGeometry(width,depth),
      new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),0,y,z);
    screen.rotation.x=-Math.PI/2;screen.castShadow=false;screen.receiveShadow=false;
    return {raster,texture};
  }

  function showSsd1306AssetStatus() {
    renderer.domElement.dataset.ssd1306Model=ssd1306Asset.create?'blender':'procedural';
    renderer.domElement.dataset.ssd1306ModelStatus=ssd1306Asset.status;
  }

  function requestSsd1306Appearance() {
    ssd1306Asset={status:'loading',create:null};
    loadSsd1306Appearance().then(create=>{
      if(disposed)return;
      ssd1306Asset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of oledModels){
        model.root.traverse(object=>retired.add(object));
        model.parent.remove(model.root);
        disposeTree(model.root);
        model.root=create();
        model.parent.add(model.root);
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(oledModels.size){showSsd1306AssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      ssd1306Asset={status:'fallback',create:null};
      if(oledModels.size)showSsd1306AssetStatus();
    });
  }

  function proceduralMcp9808Appearance() {
    const root=new THREE.Group();
    const {width,depth,pcbTop,cornerRadius,header,mounts,connector,chip,powerLed}=mcp9808Visual;
    const shape=roundedShape(width,depth,cornerRadius);
    for(const [x,z] of mounts)drill(shape,x,z,.125);
    for(const {x,z} of header)drill(shape,x,z,.05);
    const board=new THREE.ExtrudeGeometry(shape,{depth:pcbTop,bevelEnabled:false,curveSegments:14});
    board.rotateX(-Math.PI/2);mesh(root,board,[mat.plastic,mat.laminate]);
    for(const [x,z,inner,outer] of [...mounts.map(([x,z])=>[x,z,.125,.160]),
      ...header.map(({x,z})=>[x,z,.05,.0889])]){
      const ring=mesh(root,new THREE.RingGeometry(inner,outer,24),mat.gold,x,pcbTop+.003,z);
      ring.rotation.x=-Math.PI/2;
    }
    roundedBox(root,chip.width,chip.height-.022,chip.depth,.016,mat.black,0,pcbTop+.069,0);
    for(const side of [-1,1]){
      for(const z of [-.0975,-.0325,.0325,.0975]){
        box(root,.119,.021,.035,mat.tin,side*.199,pcbTop+.016,z);
      }
    }
    const cream=new THREE.MeshStandardMaterial({color:0xe3dfcf,roughness:.52});
    for(const side of [-1,1]){
      for(const y of [.024,.275])box(root,connector.width,.048,connector.depth,cream,side*connector.x,pcbTop+y,0);
      for(const z of [-.274,.274])box(root,connector.width,.254,.061,cream,side*connector.x,pcbTop+.147,z);
      box(root,.075,.253,.509,cream,side*(connector.x-.175),pcbTop+.147,0);
      for(const z of [-.15,-.05,.05,.15])box(root,.31,.024,.027,mat.gold,side*connector.x,pcbTop+.102,z);
    }
    for(const x of [-.4826,.4826])box(root,.147,.070,.307,mat.black,x,pcbTop+.036,0);
    box(root,.196,.079,.126,mat.ceramic,-.4699,pcbTop+.0395,.2921);
    box(root,.147,.057,.081,mat.ceramic,0,pcbTop+.0285,-.254);
    const lens=roundedBox(root,.084,.040,.070,.012,new THREE.MeshStandardMaterial({color:0x668d52,roughness:.36}),
      powerLed.x,pcbTop+.052,powerLed.z);
    label(root,'MCP9808',1.12,.18,.055,pcbTop+.006,-.75,{color:'#e3e5dc',size:110}).userData.detailOnly=true;
    for(const [index,{label:legend,x,z}] of header.entries()){
      label(root,legend,.23,.086,x,pcbTop+.006,z+(index%2===0?.1651:-.1651),{color:'#e3e5dc',size:105}).userData.detailOnly=true;
    }
    return {root,lens};
  }

  function applyMcp9808Power(id,model) {
    const brightness=result?.parts?.[id]?.powered?1.20:0;
    if(model.lens.material.emissiveIntensity===brightness)return false;
    model.lens.material.emissiveIntensity=brightness;
    return true;
  }

  function attachMcp9808Appearance(id,model,appearance) {
    Object.assign(model,appearance);
    model.lens.material.emissive.setHex(0x62da6b);
    applyMcp9808Power(id,model);
    model.parent.add(model.root);
  }

  function refreshMcp9808Readout() {
    temperatureReadout.hidden=!mcp9808Models.has(selectedId);
    if(temperatureReadout.hidden)return;
    const text='MCP9808 · '+mcp9808Observation(result?.parts?.[selectedId],getPart(selectedId));
    if(temperatureReadout.textContent!==text)temperatureReadout.textContent=text;
  }

  function showMcp9808AssetStatus() {
    renderer.domElement.dataset.mcp9808Model=mcp9808Asset.create?'blender':'procedural';
    renderer.domElement.dataset.mcp9808ModelStatus=mcp9808Asset.status;
  }

  function requestMcp9808Appearance() {
    mcp9808Asset={status:'loading',create:null};
    loadMcp9808Appearance().then(create=>{
      if(disposed)return;
      mcp9808Asset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of mcp9808Models){
        model.root.traverse(object=>retired.add(object));
        model.parent.remove(model.root);
        disposeTree(model.root);
        attachMcp9808Appearance(id,model,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(mcp9808Models.size){showMcp9808AssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      mcp9808Asset={status:'fallback',create:null};
      if(mcp9808Models.size)showMcp9808AssetStatus();
    });
  }

  function proceduralGroveRelayAppearance(){
    const root=new THREE.Group();
    const {width,depth,boardY,mounts,case:relay,grove,screw,led,pins}=groveRelayVisual;
    roundedBox(root,width,.16,depth,.08,mat.blue,0,boardY-.08,0);
    for(const [x,z] of mounts){
      cylinder(root,.19,.15,mat.blue,x,boardY-.075,z);
      cylinder(root,.106,.005,mat.hole,x,boardY+.004,z);
    }
    roundedBox(root,relay.width,relay.height,relay.depth,.065,mat.black,relay.x,boardY+relay.height/2,relay.z);
    label(root,'HLS8L-DC3V-S-C',1.54,.22,relay.x,boardY+relay.height+.005,relay.z,{color:'#d9dcda',size:105}).userData.detailOnly=true;
    roundedBox(root,screw.width,screw.height,screw.depth,.05,new THREE.MeshStandardMaterial({color:0x559264,roughness:.53}),
      screw.x,boardY+screw.height/2,screw.z);
    for(const x of [grove.x-grove.width/2,grove.x+grove.width/2]){
      box(root,.070,grove.height,grove.depth,mat.boardWhite,x,boardY+grove.height/2,grove.z);
    }
    for(const z of [grove.z-grove.depth/2,grove.z+grove.depth/2]){
      box(root,grove.width,grove.height,.065,mat.boardWhite,grove.x,boardY+grove.height/2,z);
    }
    box(root,grove.width,.07,grove.depth,mat.boardWhite,grove.x,boardY+.035,grove.z);
    for(const {id,x,y,z,connector} of pins){
      if(connector==='screw'){
        cylinder(root,.096,.026,mat.tin,x,boardY+screw.height,z-.381,20).userData.relayTerminal=id;
        box(root,.11,.10,.018,mat.gold,x,y,z+.005).userData.relayTerminal=id;
      }else box(root,.040,y-boardY,.039,mat.gold,x,(boardY+y)/2,z).userData.relayTerminal=id;
    }
    const lens=roundedBox(root,.11,.044,.082,.012,new THREE.MeshStandardMaterial({color:0x8b2629,roughness:.48}),
      led.x,led.y-.022,led.z);
    return {root,lens};
  }

  function setGroveRelayVisual(model,reading){
    const {indicator,closed}=groveRelayState(reading);
    if(model.indicator===indicator&&model.closed===closed)return false;
    Object.assign(model,{indicator,closed});
    model.lens.material.emissiveIntensity=indicator?2:0;
    model.openTag.visible=!closed;model.closedTag.visible=closed;
    return true;
  }

  function attachGroveRelayAppearance(model,id,{root,lens}){
    Object.assign(model,{root,lens,indicator:null,closed:null});
    lens.material.emissive.setHex(0xe72828);
    setGroveRelayVisual(model,result?.parts?.[id]);
    model.parent.add(root);
  }

  function showGroveRelayAssetStatus(){
    renderer.domElement.dataset.relayModel=groveRelayAsset.create?'blender':'procedural';
    renderer.domElement.dataset.relayModelStatus=groveRelayAsset.status;
  }

  function requestGroveRelayAppearance(){
    groveRelayAsset={status:'loading',create:null};
    import('./grove-relay-model.js').then(({loadGroveRelayModel})=>loadGroveRelayModel()).then(create=>{
      if(disposed)return;
      groveRelayAsset={status:'ready',create};
      const retired=new Set();
      for(const [id,model] of groveRelayModels){
        model.root.traverse(object=>retired.add(object));
        model.parent.remove(model.root);disposeTree(model.root);
        attachGroveRelayAppearance(model,id,create());
        addObjectTargets(model.root,id);
        model.root.updateWorldMatrix(true,true);
        selectionBoxes.get(id)?.update();
      }
      for(let index=objectTargets.length-1;index>=0;index--){
        if(retired.has(objectTargets[index]))objectTargets.splice(index,1);
      }
      if(groveRelayModels.size){showGroveRelayAssetStatus();requestFrame(true);}
    }).catch(()=>{
      if(disposed)return;
      groveRelayAsset={status:'fallback',create:null};
      if(groveRelayModels.size)showGroveRelayAssetStatus();
    });
  }

  function proceduralDipSwitch() {
    const root=new THREE.Group();
    roundedBox(root,1.22,.38,.66,.025,mat.black,0,.20,0);
    for(const [index,x] of [-.381,-.127,.127,.381].entries()){
      box(root,.207,.035,.365,mat.hole,x,.392,0);
      const slider=new THREE.Group();slider.name='A6D_SLIDER_'+(index+1);
      slider.position.set(x,.42,.07);root.add(slider);
      roundedBox(slider,.143,.040,.102,.012,mat.plastic,0,0,0);
      label(root,String(index+1),.16,.09,x,.397,.257,{color:'#f3efe5',size:100});
    }
    label(root,'ON',.16,.11,-.48,.397,-.263,{color:'#f3efe5',size:95});
    return root;
  }
  function attachDipSwitch(model,root){
    model.root=root;
    model.sliders=[1,2,3,4].map(i=>root.getObjectByName('A6D_SLIDER_'+i))
      .map(object=>({object,rest:object.position.z}));
    model.parent.add(root);
  }
  function requestDipSwitchAppearance(){
    dipSwitchAsset={create:null};
    loadDipSwitchAppearance().then(create=>{
      if(disposed)return;
      dipSwitchAsset={create};
      const retired=new Set();
      for(const [id,model] of dipSwitchModels){
        model.root.traverse(object=>retired.add(object));
        model.root.removeFromParent();disposeTree(model.root);
        attachDipSwitch(model,create());
        addObjectTargets(model.root,id);
        selectionBoxes.get(id)?.update();
      }
      for(let i=objectTargets.length-1;i>=0;i--)if(retired.has(objectTargets[i]))objectTargets.splice(i,1);
      if(dipSwitchModels.size){
        renderer.domElement.dataset.dipSwitchModel='blender';
        update(result,state);requestFrame(true);
      }
    }).catch(()=>{});
  }
  function proceduralPhotoresistor(){
    const root=new THREE.Group(),{width,depth,height}=pdvPhotoresistorVisual;
    roundedBox(root,width,height,depth,.065,mat.ceramic,0,height/2,0);
    const trace=new THREE.MeshStandardMaterial({color:'#944537',roughness:.60});
    for(let i=0;i<5;i++){
      const z=-.12+i*.060,x=i%2?.145:-.145;
      rod(root,[-.145,height+.005,z],[.145,height+.005,z],.008,trace);
      if(i<4)rod(root,[x,height+.005,z],[x,height+.005,z+.060],.008,trace);
    }
    return root;
  }
  function requestPhotoresistorAppearance(){
    photoresistorAsset={create:null};
    loadPhotoresistorAppearance().then(create=>{
      if(disposed)return;
      photoresistorAsset={create};
      const retired=new Set();
      for(const [id,model] of photoresistorModels){
        model.root.traverse(object=>retired.add(object));
        model.root.removeFromParent();disposeTree(model.root);
        model.root=create();model.holder.add(model.root);
        addObjectTargets(model.root,id);
        selectionBoxes.get(id)?.update();
      }
      for(let i=objectTargets.length-1;i>=0;i--)if(retired.has(objectTargets[i]))objectTargets.splice(i,1);
      if(photoresistorModels.size){renderer.domElement.dataset.photoresistorModel='blender';requestFrame(true);}
    }).catch(()=>{});
  }
  function buildPart(part) {
    const pose = partPose(part,circuit.breadboard);
    const group = new THREE.Group();
    group.position.set(pose.x, pose.mounted ? breadboardDimensions.coverTop : baseHeight(pose.x,pose.z), pose.z);
    group.rotation.y = pose.rotation * Math.PI / 180;
    assembly.add(group);
    const pinPart = part.mount&&!pose.mounted ? {...part,mount:undefined} : part;
    const pin = (name,x,y,z,description,size) => {const contact=componentPin(pinPart,name,PARTS[part.type]);return addPin(group,part.id+':'+name,contact?.x??x,contact?.y??y,contact?.z??z,part.id,description,size);};
    if (part.type === 'led') {
      if (pose.mounted) {
        for (const {x,z} of componentPins(pinPart)) rod(group,[x,-.075,z],[x,.63,z],.021,mat.tin);
      } else {
        rod(group, [-0.127,0.055,.58], [-0.127,0.63,0], 0.021, mat.tin);
        rod(group, [0.127,0.14,.48], [0.127,0.63,0], 0.021, mat.tin);
      }
      diodeLamp(group, part.id, LED_COLORS[part.color] || LED_COLORS.red, 0, 0.54, 0,1,true,true);
      const labelHeight = pose.mounted ? .005 : .016;
      label(group,'A +',.30,.18,-.23,labelHeight,pose.mounted ? .31 : .83,{color:'#365e58',size:110});label(group,'K −',.30,.18,.23,labelHeight,pose.mounted ? .31 : .68,{color:'#365e58',size:110});
      pin('A',-.127,.055,.58,'LED A · 长脚 · 正极',.12);
      pin('K',.127,.14,.48,'LED K · 短脚 · 负极',.12);
    } else if (part.type === 'resistor') {
      const resistorMaterial = new THREE.MeshStandardMaterial({ color: 0xd4be95, roughness: 0.7 });
      const profile = [[0,-.355],[.078,-.355],[.108,-.330],[.123,-.301],[.125,-.272],
        [.125,.272],[.123,.301],[.108,.330],[.078,.355],[0,.355]];
      const ceramic = new THREE.LatheGeometry(profile.map(([r,h]) => new THREE.Vector2(r,h)), 32);
      mesh(group,ceramic,resistorMaterial,0,.19,0).rotation.z=Math.PI/2;
      for (const {x} of componentPins(pinPart)) {
        const sign = Math.sign(x);
        const points = pose.mounted
          ? [[sign*.27,.19,0],[sign*.54,.19,0],[x,.14,0],[x,-.075,0]]
          : [[sign*.27,.19,0],[sign*.59,.19,0],[sign*.695,.16,0],[sign*.71,.08,0]];
        const path = new THREE.CatmullRomCurve3(points.map(([x,y,z]) => new THREE.Vector3(x,y,z)));
        mesh(group,new THREE.TubeGeometry(path,16,.023,8,false),mat.tin);
      }
      const appearance=resistorVisual(part),positions=appearance.bands.length===5?[-.25,-.15,-.05,.05,.25]:appearance.bands.length===1?[0]:[-.23,-.10,.035,.23];
      appearance.bands.forEach((data,i)=>{
        const tolerance=data.kind==='tolerance';
        const paint = new THREE.CylinderGeometry(.126,.126,tolerance?.038:.042,32,1,true);
        mesh(group,paint,new THREE.MeshStandardMaterial({color:data.color,roughness:tolerance?.38:.7,metalness:tolerance?.45:0}),positions[i],.19,0).rotation.z=Math.PI/2;
      });
      if(appearance.mode==='printed'||appearance.mode==='invalid')label(group,appearance.mode==='printed'?appearance.label:'?',.52,.13,0,.318,0,{color:'#3f3a2d',size:110});
      label(group,componentLabel(part,PARTS[part.type]),1.45,.23,0,.016,.42,{color:'#42675d',size:110});
      pin('1',-.71,.08,0,'电阻端1 · '+appearance.note);
      pin('2',.71,.08,0,'电阻端2 · '+appearance.label+' · 无正负之分');
    } else if (part.type === 'button') {
      if(!buttonAsset)requestButtonAppearance();
      const model={parent:group};
      buttonModels.set(part.id,model);
      attachButtonAppearance(model,part.id,buttonAsset.create?.()??proceduralButtonAppearance());
      showButtonAssetStatus();
      const springY=breadboardDimensions.coverBottom+.018-breadboardDimensions.coverTop;
      componentPins(pinPart).forEach(({id,x,y,z})=>{
        // Formed tabs leave the package shoulders and end at the existing lab contacts.
        const side=Math.sign(x),end=Math.sign(z);
        buttonLeadTab(group,side*.225,end*.302,side*.315,end*.310);
        buttonLeadTab(group,side*.315,end*.310,x,z);
        if(pose.mounted){
          box(group,.044,.084-springY,.050,mat.tin,x,(.084+springY)/2,z);
        }else{
          rod(group,[x,.084,z],[x,.025,z],.023,mat.tin);
        }
        pin(id,x,y,z,'按键脚'+id+' · '+(Number(id)<3?'与脚1、2同组':'与脚3、4同组'),.083);
      });
    } else if (part.type === 'pot') {
      if(!potAsset)requestPotAppearance();
      const model={parent:group};
      potModels.set(part.id,model);
      attachPotAppearance(model,part.id,potAsset.create?.()??proceduralPotAppearance());
      showPotAssetStatus();
      for(const contact of componentPins(part)){
        const bend=[contact.x,.044,.43];
        rod(group,POT_LEAD_ORIGINS[contact.id],bend,.020,mat.tin);
        rod(group,bend,[contact.x,contact.y,contact.z],.020,mat.tin);
        pin(contact.id,contact.x,contact.y,contact.z,'电位器 '+contact.id+' · 总阻值 '+formatResistance(part.resistance??10000),.087);
        label(group,contact.label,.28,.12,contact.x,.016,.84,{color:'#42675d',size:95});
      }
      label(group,componentLabel(part,PARTS[part.type]),1.35,.21,0,.016,1.04,{color:'#42675d',size:105});
    } else if (part.type === 'encoder') {
      if(!encoderAsset)requestEncoderAppearance();
      const model={parent:group};encoderModels.set(part.id,model);
      attachEncoderAppearance(model,part.id,encoderAsset.create?.()??proceduralEncoderAppearance());
      showEncoderAssetStatus();
      for(const contact of componentPins(part)){
        const {id,x,y,z}=contact;
        pin(id,x,y,z,encoderPinDescription(contact),.087);
        label(group,contact.label,.21,.10,x,.017,z+Math.sign(z)*.19,{color:'#42675d',size:94});
      }
      label(group,part.id+' · PEC11R',1.35,.21,0,.016,1.13,{color:'#42675d',size:105});
    } else if (part.type === 'joystick') {
      if(!joystickAsset)requestJoystickAppearance();
      const model={parent:group};joystickModels.set(part.id,model);
      attachJoystickAppearance(model,part.id,joystickAsset.create?.()??proceduralJoystickAppearance());
      showJoystickAssetStatus();
      for(const contact of componentPins(part)){
        const {id,x,y,z}=contact;
        pin(id,x,y,z,joystickPinDescription(contact),.087);
      }
      label(group,part.id+' · 双轴摇杆',1.76,.21,0,.016,1.78,{color:'#42675d',size:105});
    } else if (part.type === 'buzzer') {
      cylinder(group,.47,.49,mat.black,0,.36,0,36);
      cylinder(group,.49,.04,mat.plastic,0,.11,0,36);
      cylinder(group,.405,.016,mat.plastic,0,.613,0,32);
      cylinder(group,.115,.008,mat.hole,0,.625,0,24);
      label(group,'+',.17,.17,-.23,.628,.11,{size:120,color:'#e8e8e1'});
      label(group,'ACTIVE',.43,.12,0,.628,-.24,{size:100,color:'#a1a7aa'});
      componentPins(part).forEach(contact=>{rod(group,[contact.x,.15,.22],[contact.x,contact.y,contact.z],.025,mat.tin);pin(contact.id,contact.x,contact.y,contact.z,contact.id==='+'?'有源蜂鸣器 · 正极':'有源蜂鸣器 · 负极');label(group,contact.label,.20,.17,contact.x,.016,contact.z+.17,{color:'#42675d',size:115});});
      label(group,part.id+' · 有源蜂鸣器',1.5,.22,0,.016,1.04,{color:'#42675d',size:110});
    } else if (part.type === 'servo') {
      const hs55=part.servoModel==='hs55',model={parent:group,hs55};
      if(hs55&&!hs55Asset)requestHs55Appearance();
      servoModels.set(part.id,model);
      attachServoAppearance(model,part.id,(hs55?hs55Asset.create?.():null)??proceduralServoAppearance(hs55));
      if(hs55)showHs55AssetStatus();
      const colors={GND:hs55?0x252c30:0x694431,VCC:0xc14736,SIG:hs55?0xe9bd44:0xe9983b};
      for(const {id,x,y,z} of componentPins(pinPart)){
        const egress=hs55?new THREE.Vector3(x*.075/.26,.35,1.145):new THREE.Vector3(x*.25,.39,1.08);
        const path=new THREE.CatmullRomCurve3([egress,new THREE.Vector3(x*.6,.22,1.40),new THREE.Vector3(x,.12,z-.20)]);
        mesh(group,new THREE.TubeGeometry(path,16,.026,7,false),new THREE.MeshStandardMaterial({color:colors[id],roughness:.5}));
        box(group,.21,.13,.32,mat.black,x,.105,z-.07);
        box(group,.07,.02,.10,mat.gold,x,y-.023,z-.03);
        pin(id,x,y,z,'舵机 '+id,.095);
      }
    } else if (part.type === 'diode' && pose.mounted) {
      const contacts=componentPins(pinPart),tip=breadboardDimensions.coverBottom+.018-breadboardDimensions.coverTop;
      buildMountedDiode(group,contacts,tip);
      const text={A:'二极管 A · 阳极',K:'二极管 K · 色环为阴极'};
      for(const contact of contacts){
        pin(contact.id,contact.x,contact.y,contact.z,text[contact.id],.087);
      }
    } else if (part.type === 'capacitor') {
      const bottom=pose.mounted ? .04 : .16,model={parent:group,bottom};
      if(!capacitorAsset)requestCapacitorAppearance();
      capacitorModels.set(part.id,model);
      attachCapacitorAppearance(model,capacitorAsset.create?.()??proceduralCapacitorAppearance());
      model.printed=capacitorMarking(group,bottom);
      updateCapacitorMarking(model,part);
      showCapacitorAssetStatus();
      const tip=breadboardDimensions.coverBottom+.018-breadboardDimensions.coverTop;
      for(const {id,x,y,z} of componentPins(pinPart)){
        const side=Math.sign(x),lead=[side*.125,bottom,0];
        if(pose.mounted){
          rod(group,lead,[x,.006,z],.025,mat.tin);
          rod(group,[x,.007,z],[x,tip,z],.025,mat.tin);
          label(group,id==='+'?'+':'−',.16,.10,side*.405,.008,z,{color:'#345e55',size:108,weight:'700'});
        }else rod(group,lead,[x,y,z],.025,mat.tin);
        pin(id,x,y,z,id==='+'?'电解电容 · 正极长脚':'电解电容 · 负极条纹侧',.087);
      }
      if(!pose.mounted)model.floorLabel=label(group,componentLabel(part,PARTS[part.type]),1.35,.22,0,.016,.87,{color:'#42675d',size:110});
    } else if (part.type === 'diode') {
      rod(group,[-.70,.10,0],[.70,.10,0],.022,mat.tin);
      const body=cylinder(group,.115,.56,mat.black,0,.14,0,24);body.rotation.z=Math.PI/2;
      const band=cylinder(group,.116,.065,mat.silver,.16,.14,0,24);band.rotation.z=Math.PI/2;
      pin('A',-.70,.10,0,'二极管 A · 阳极',.12);pin('K',.70,.10,0,'二极管 K · 色环为阴极',.12);
    } else if (part.type === 'switch') {
      roundedBox(group,.80,.30,.66,.055,mat.black,0,.19,0);roundedBox(group,.72,.04,.57,.045,mat.silver,0,.37,0);
      [-.24,.24].forEach(x=>cylinder(group,.04,.008,mat.holeRim,x,.397,0,16));
      roundedBox(group,.25,.07,.44,.05,mat.hole,0,.42,0);
      const lever=new THREE.Group();lever.position.z=part.closed?-.08:.08;group.add(lever);switchModels.set(part.id,lever);roundedBox(lever,.18,.20,.32,.06,mat.silver,0,.53,0);
      const red=new THREE.MeshStandardMaterial({color:'#af4e41',roughness:.42});roundedBox(lever,.18,.04,.11,.02,red,0,.65,-.08);
      rod(group,[-.56,.08,0],[.56,.08,0],.026,mat.tin);pin('1',-.56,.08,0,'开关端1',.12);pin('2',.56,.08,0,'开关端2',.12);
      label(group,'OFF    ON',.70,.15,0,.015,.49,{color:'#536f69',size:105});
    } else if (part.type === 'ldr'&&part.ldrModel==='pdv-p8103') {
      if(!photoresistorAsset)requestPhotoresistorAppearance();
      const {width,depth,height,bodyY,pins}=pdvPhotoresistorVisual;
      const holder=new THREE.Group();holder.position.y=bodyY;group.add(holder);
      const root=photoresistorAsset.create?.()??proceduralPhotoresistor();
      holder.add(root);
      const cover=roundedBox(holder,width+.038,.042,depth+.036,.027,mat.black,0,height+.030,0);
      cover.userData.photocellFace=true;cover.visible=Boolean(part.ldrCovered);
      const target=box(holder,width+.070,.007,depth+.065,new THREE.MeshBasicMaterial({visible:false}),0,height+.056,0);
      target.castShadow=false;target.userData.photocellFace=true;
      photoresistorModels.set(part.id,{holder,root,cover});
      renderer.domElement.dataset.photoresistorModel=photoresistorAsset.create?'blender':'procedural';
      for(const {id,x,y,z,label:name} of pins){
        rod(group,[x,bodyY,0],[x,bodyY-.06,.22],.025,mat.tin);
        rod(group,[x,bodyY-.06,.22],[x,y,z],.025,mat.tin);
        pin(id,x,y,z,name+' · 无正负极',.085);
      }
      label(group,'PDV-P8103',.78,.16,0,.015,.75,{color:'#46655c',size:92});
    } else if (part.type === 'ldr') {
      const substrate=new THREE.MeshStandardMaterial({color:'#c9ae87',roughness:.54});const trace=new THREE.MeshStandardMaterial({color:'#985348',roughness:.66});
      cylinder(group,.31,.085,substrate,0,.30,-.055,32);cylinder(group,.265,.009,mat.ceramic,0,.348,-.055,32);
      for(let i=0;i<5;i++){const z=-.24+i*.09;rod(group,[-.18,.357,z],[.18,.357,z],.013,trace);if(i<4){const x=i%2? .18:-.18;rod(group,[x,.357,z],[x,.357,z+.09],.013,trace);}}
      for(const sign of [-1,1])rod(group,[sign*.145,.05,.53],[sign*.145,.29,.09],.022,mat.tin);
      pin('1',-.145,.05,.53,'光敏电阻端1',.12);pin('2',.145,.05,.53,'光敏电阻端2',.12);
      label(group,(part.lux??100)+' lx',.75,.20,0,.015,.82,{color:'#52756a',size:100});
    } else if (part.type === 'thermistor') {
      const resin=new THREE.MeshStandardMaterial({color:'#337c6a',roughness:.37});const disc=mesh(group,new THREE.SphereGeometry(.22,24,16),resin,0,.29,-.055);disc.scale.y=.32;
      for(const sign of [-1,1])rod(group,[sign*.11,.05,.53],[sign*.11,.29,.04],.022,mat.tin);
      label(group,'NTC',.29,.13,0,.366,-.05,{color:'#d1e7da',size:105});label(group,(part.temperature??25)+' °C',.75,.20,0,.015,.80,{color:'#52756a',size:100});
      pin('1',-.11,.05,.53,'热敏电阻端1',.12);pin('2',.11,.05,.53,'热敏电阻端2',.12);
    } else if (part.type === 'rgbled'&&part.rgbModel==='kingbright-wp154a4') {
      if(!kingbrightRgbAsset)requestKingbrightRgbAppearance();
      const model={parent:group};kingbrightRgbModels.set(part.id,model);
      attachKingbrightRgbAppearance(model,part.id,kingbrightRgbAsset.create?.()??proceduralKingbrightRgbAppearance());
      showKingbrightRgbAssetStatus();
      for(const contact of componentPins(part)){
        const {id,x,y,z,number}=contact;
        pin(id,x,y,z,rgbLedPinDescription(contact),.08);
        const diagram=rgbLedVisual.diagram[number-1];
        // Clearly separated lead labels are also pickable when the lens covers the leads in a vertical view.
        label(group,id+' '+number,.23,.14,diagram.x,.017,.46,{color:'#42675d',size:95}).userData.rgbLedTerminal=id;
      }
    } else if (part.type === 'rgbled') {
      ['R','G','B','COM'].forEach((name,i)=>{const x=(i-1.5)*.20,z=name==='COM'? .76:.62;rod(group,[x,.06,z],[x*.7,.63,0],.02,mat.tin);pin(name,x,.06,z,'RGB LED · '+name,.11);label(group,name,.20,.12,x,.015,z+.17,{color:'#59796f',size:95});});
      diodeLamp(group,part.id,0xd8e6dd,0,.54,0,1.08,true);rgbModels.set(part.id,ledModels.get(part.id));
    } else if (part.type === 'sevenseg') {
      const contacts=componentPins(pinPart);
      const model={parent:group,bodyBase:pose.mounted?.04:sevenSegmentVisual.leadLength};
      if(!sevenSegmentAsset)requestSevenSegmentAppearance();
      segmentModels.set(part.id,model);
      attachSevenSegmentAppearance(model,part.id,sevenSegmentAsset.create?.()??proceduralSevenSegmentAppearance(contacts));
      for(const contact of contacts){
        pin(contact.id,contact.x,contact.y,contact.z,sevenSegmentPinDescription(part,contact),.092);
      }
      showSevenSegmentAssetStatus();
    } else if (part.type === 'grove-relay') {
      if(!groveRelayAsset)requestGroveRelayAppearance();
      const contactTag=(text,color,background)=>{
        const tag=label(group,text,2.00,.30,.71,.019,1.31,{color,background,size:80,weight:'700'});
        tag.userData.detailOnly=true;
        return tag;
      };
      const model={parent:group,openTag:contactTag('触点示意 · COM / NO 断开','#754516','#fff4d6'),
        closedTag:contactTag('触点示意 · COM — NO 闭合','#176746','#d8f4e6')};
      groveRelayModels.set(part.id,model);
      attachGroveRelayAppearance(model,part.id,groveRelayAsset.create?.()??proceduralGroveRelayAppearance());
      showGroveRelayAssetStatus();
      for(const contact of groveRelayVisual.pins){
        const {id,x,y,z,connector}=contact;
        pin(id,x,y,z,groveRelayPinDescription(contact),.085);
        const input=connector==='grove';
        label(group,id,input ? .32 : .30,.13,input ? -2.22 : x,.018,input ? z : 1.09,
          {color:id==='NC'?'#65736d':'#42675d',size:90}).userData.relayTerminal=id;
      }
    } else if (part.type === 'dipswitch') {
      if(!dipSwitchAsset)requestDipSwitchAppearance();
      const model={parent:group};
      dipSwitchModels.set(part.id,model);
      attachDipSwitch(model,dipSwitchAsset.create?.()??proceduralDipSwitch());
      renderer.domElement.dataset.dipSwitchModel=dipSwitchAsset.create?'blender':'procedural';
      for(const {id,x,y,z,label:name} of componentPins(pinPart)){
        const low=pose.mounted?breadboardDimensions.coverBottom+.018-breadboardDimensions.coverTop:.015;
        box(group,.050,.125-low,.025,mat.tin,x,(.125+low)/2,z);
        box(group,.050,.023,.085,mat.tin,x,.117,z-Math.sign(z)*.034);
        pin(id,x,y,z,name,.069);
      }
      for(const [index,x] of [-.381,-.127,.127,.381].entries()){
        const target=box(group,.230,.009,.385,new THREE.MeshBasicMaterial({visible:false}),x,.451,0);
        target.castShadow=false;
        target.userData.dipSwitchIndex=index;
      }
    } else if (part.type === 'mcp9808') {
      if(!mcp9808Asset)requestMcp9808Appearance();
      const model={parent:group};
      mcp9808Models.set(part.id,model);
      attachMcp9808Appearance(part.id,model,mcp9808Asset.create?.()??proceduralMcp9808Appearance());
      for(const contact of mcp9808Visual.pins){
        pin(contact.id,contact.x,contact.y,contact.z,mcp9808PinDescription(contact),.092);
      }
      showMcp9808AssetStatus();
    } else if (part.type === 'ssd1306') {
      if(!ssd1306Asset)requestSsd1306Appearance();
      const root=ssd1306Asset.create?.()??proceduralSsd1306Appearance();
      group.add(root);
      oledModels.set(part.id,{parent:group,root,...buildSsd1306Screen(group)});
      for(const contact of ssd1306Visual.pins){
        pin(contact.id,contact.x,contact.y,contact.z,ssd1306PinDescription(contact),.092);
      }
      showSsd1306AssetStatus();
    } else if (part.type === 'hcsr04') {
      if(!hcsr04Asset)requestHcsr04Appearance();
      const root=hcsr04Asset.create?.()??proceduralHcsr04Appearance();
      group.add(root);
      const [transmitter,receiver]=hcsr04Visual.transducers;
      sensorModels.set(part.id,{parent:group,root,
        tx:buildSensorCue(group,transmitter,0xf2af3b),rx:buildSensorCue(group,receiver,0x19bdb0)});
      for(const contact of hcsr04Visual.pins){
        pin(contact.id,contact.x,contact.y,contact.z,hcsr04PinDescription(contact),.093);
      }
      showHcsr04AssetStatus();
    } else if (part.type === 'drv8833') {
      buildDrv8833(group,pin);
    } else if (part.type === 'motor'&&part.motorModel==='fa130-18100') {
      if(!fa130Asset)requestFa130Appearance();
      const model={parent:group,fa130:true,blur:makeMotorBlur(group)};
      motorModels.set(part.id,model);
      attachFa130Appearance(model,part.id,fa130Asset.create?.()??proceduralFa130Appearance());
      for(const {id,x,y,z,label:polarity} of fa130Visual.pins){
        pin(id,x,y,z,'FA-130RA-18100 · '+polarity+' 焊片',.12);
      }
      showFa130AssetStatus();
    } else if (part.type === 'motor') {
      const body=cylinder(group,.46,1.35,mat.silver,0,.51,0,32);body.rotation.x=Math.PI/2;
      const cap=cylinder(group,.44,.14,mat.holeRim,0,.51,.69,32);cap.rotation.x=Math.PI/2;
      const front=cylinder(group,.30,.12,mat.silver,0,.51,-.71,28);front.rotation.x=Math.PI/2;
      const shaft=cylinder(group,.055,.55,mat.gold,0,.51,-.98,16);shaft.rotation.x=Math.PI/2;
      const rotor=new THREE.Group();rotor.position.set(0,.51,-1.18);group.add(rotor);box(rotor,.75,.07,.035,mat.yellow);const screw=cylinder(rotor,.07,.05,mat.tin,0,0,0,16);screw.rotation.x=Math.PI/2;motorModels.set(part.id,{rotor});
      for(const sign of [-1,1]){rod(group,[sign*.236,.05,.98],[sign*.236,.36,.75],.027,mat.gold);pin(sign<0?'+':'-',sign*.236,.05,.98,sign<0?'直流电机正极':'直流电机负极',.12);}
      label(group,'DC MOTOR',.65,.24,0,.975,0,{color:'#50656c',size:95});
    } else if (part.type === 'power') {
      roundedBox(group,2.10,1.44,1.65,.13,new THREE.MeshStandardMaterial({color:0xe1e4df,roughness:.48}),0,.84,0);
      roundedBox(group,1.94,1.26,.07,.06,mat.blue,0,.84,.842);
      for(const x of [-.80,.80])for(const z of [-.57,.57])cylinder(group,.11,.12,mat.black,x,.09,z,16);
      box(group,1.46,.50,.032,mat.black,0,1.17,.895);
      const display=uprightLabel(group,Number(part.voltage||0).toFixed(2)+' V',1.37,.39,0,1.17,.915,{width:640,height:200,size:137,color:'#67f3d6',font:'monospace'});
      sourceDisplays.set(part.id,display);
      uprightLabel(group,'DC  POWER',1.00,.17,0,1.48,.91,{size:100,color:'#d5e6eb'});
      for(const x of [-.59,.59]){const knob=cylinder(group,.14,.12,mat.plastic,x,.77,.94,24);knob.rotation.x=Math.PI/2;}
      [-1,1].forEach(sign=>{
        const x=sign*.51, color=sign<0?mat.red:mat.black;
        const binding=cylinder(group,.125,.13,color,x,.37,.96,24);binding.rotation.x=Math.PI/2;
        const center=cylinder(group,.042,.008,mat.hole,x,.37,1.032,16);center.rotation.x=Math.PI/2;
        pin(sign<0?'+':'-',x,.37,1.08,sign<0?'直流电源正极':'直流电源负极',.12);
      });
      uprightLabel(group,'+             −',1.3,.17,0,.57,.905,{size:110,color:'#e4edf0'});
    } else {
      const model=genericModuleVisual(part,PARTS[part.type]);
      const pcb=new THREE.MeshStandardMaterial({color:'#267f76',roughness:.45});roundedBox(group,model.width,.09,model.height,.06,pcb,0,.10,0);
      roundedBox(group,.56,.10,.56,.03,mat.black,0,.20,0);label(group,model.tag+'\n接口模块',.51,.37,0,.256,0,{color:'#c7e0d5',size:85,height:256});
      for(const endpoint of model.pins){rod(group,[endpoint.x,.08,endpoint.z],[endpoint.x+(endpoint.x<0? .19:-.19),.12,endpoint.z],.023,mat.tin);pin(endpoint.id,endpoint.x,.08,endpoint.z,model.name+' · '+endpoint.label,.12);label(group,endpoint.label,.28,.12,endpoint.x+(endpoint.x<0? .28:-.28),.15,endpoint.z,{color:'#dbece0',size:85});}
      label(group,model.name,model.width,.20,0,.014,model.height/2+.28,{color:'#4d756c',size:100});
    }
    markSelectable(group,part.id);
  }

  function updateEndpointPositions() {
    assembly.updateMatrixWorld(true);
    for(const record of endpoints.values()) {
      if(record.object) record.object.getWorldPosition(record.position);
      else record.position.copy(record.local).applyMatrix4(record.group.matrixWorld);
    }
    syncProbeMarkers();
  }
  function buildProbe(side) {
    const model=new THREE.Group(),red=side==='red';
    const color=red?'#b82032':'#202630';
    const grip=new THREE.MeshStandardMaterial({color,roughness:.47,metalness:.03});
    mesh(model,new THREE.CylinderGeometry(.034,.005,.17,12),mat.tin,0,.085,0);
    cylinder(model,.035,.10,mat.tin,0,.22,0,12);
    cylinder(model,.073,.12,grip,0,.31,0,12);
    cylinder(model,.093,.25,grip,0,.47,0,16);
    cylinder(model,.103,.024,mat.tin,0,.39,0,16);
    const badge=new THREE.Sprite(new THREE.SpriteMaterial({
      map:textTexture(red?'+':'−',{width:192,height:192,size:158,color:'#fff',background:color,weight:'700'},192),
      depthWrite:false,toneMapped:false
    }));
    badge.position.y=.64;badge.scale.set(.22,.22,1);model.add(badge);
    model.traverse(object=>{object.castShadow=false;});
    probeModels.set(side,model);probeGroup.add(model);
    return model;
  }
  function probeEndpointVisible(record) {
    if(!record||record.hidden)return false;
    if(record.componentId!=='breadboard')return true;
    const board=componentGroups.get('mcu');
    if(!board||!boardView)return true;
    const local=rotateBoardPoint(record.position.x-board.position.x,record.position.z-board.position.z,-board.rotation.y*180/Math.PI);
    return Math.abs(local.x)>boardView.profile.width/2||Math.abs(local.z)>boardView.profile.height/2;
  }
  function probePosition(side) {
    const record=endpoints.get(probes[side]);
    if(!probeEndpointVisible(record))return null;
    if(drag?.relocatingPart&&record.componentId===drag.id&&record.object)return record.object.getWorldPosition(probePositions[side]);
    return record.position;
  }
  function syncProbeMarkers() {
    if(inspection||!probes.red&&!probes.black&&!probeModels.size)return;
    const red=probePosition('red'),black=probePosition('black');
    probeSpread.set(1,0,0);
    if(red&&black){
      probeSpread.subVectors(red,black).setY(0);
      if(probeSpread.lengthSq()<1e-6)probeSpread.set(1,0,0);
      else probeSpread.normalize();
    }
    let changed=false;
    for(const [side,position] of [['red',red],['black',black]]){
      const marker=probeModels.get(side)||(position?buildProbe(side):null);
      if(!marker)continue;
      if(marker.visible!==Boolean(position)){marker.visible=Boolean(position);changed=true;}
      if(!position)continue;
      marker.position.copy(position);
      probeTilt.copy(probeSpread).multiplyScalar(side==='red'?.36:-.36).setY(1).normalize();
      marker.quaternion.setFromUnitVectors(probeAxis,probeTilt);
      changed=true;
    }
    if(changed)requestFrame();
  }
  function setProbes(next) {
    if(inspection)return;
    const picking=hooks.isProbePicking?.()||null;
    const changed=probes.red!==next.red||probes.black!==next.black;
    const armed=picking&&!probePicking;
    probePicking=picking;
    probes=next;
    if(armed||down?.probePicking&&down.probePicking!==picking)cancelInteraction();
    if(changed)syncProbeMarkers();
    refreshConnectionStatus();
  }
  function probeLabel(side){return side==='red'?'红表笔（+）':side==='black'?'黑表笔（−）':'表笔';}
  function disposeTree(group) {
    const geometries=new Set(), materials=new Set(), textures=new Set();
    group.traverse(object=>{
      if(object.geometry&&!object.geometry.userData.shared)geometries.add(object.geometry);
      if(object.isInstancedMesh)object.dispose();
      for(const material of (Array.isArray(object.material)?object.material:[object.material])) {
        if(!material||material.userData.shared)continue;
        materials.add(material);
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      }
    });
    geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
    group.clear();
  }
  function rebuildWires() {
    disposeTree(cableGroup);wireTargets.length=0;
    wirePickPaths.length=0;projectedWireCache=null;
    requestFrame(true);
    if(!circuit)return;
    circuit.wires.forEach((wire,index)=>{
      const a=endpoints.get(wire.a)?.position,b=endpoints.get(wire.b)?.position;
      if(!a||!b)return;
      const start=a.clone(),end=b.clone(),distance=start.distanceTo(end);
      const lift=Math.min(2.25,.42+distance*.14);
      const midpoint=start.clone().add(end).multiplyScalar(.5);
      midpoint.y=Math.max(start.y,end.y)+lift;
      midpoint.z+=((index%3)-1)*.12;
      function cableExit(endpoint,point,opposite){
        const record=endpoints.get(endpoint),relay=groveRelayModels.get(record.componentId);
        const lead=endpoint.slice(record.componentId.length+1);
        const relayConnector=relay&&groveRelayVisual.pins.find(pin=>pin.id===lead)?.connector;
        if(relayConnector==='grove'){
          return {grove:true,points:[point.clone().add(new THREE.Vector3(0,.30,0))]};
        }
        if(relayConnector==='screw'){
          const direction=new THREE.Vector3(0,0,1).applyQuaternion(relay.parent.quaternion);
          const points=[.16,.37].map(offset=>point.clone().addScaledVector(direction,offset));
          const toward=opposite.clone().sub(point).setY(0);
          if(direction.dot(toward)<0){
            const tangent=new THREE.Vector3(direction.z,0,-direction.x);
            if(tangent.dot(toward)<0)tangent.negate();
            points.push(points[1].clone().addScaledVector(tangent,.52));
          }
          return {direction,relayScrew:true,points};
        }
        const model=kingbrightRgbModels.get(record.componentId);
        if(!model)return {points:[point.clone().add(new THREE.Vector3(0,.30,0))]};
        // The 1.27 mm leads enter the bottom of the resin dome. Take each
        // small contact sideways before the cable rises clear of the body.
        const [x,z]={R:[-1,0],COM:[0,1],B:[0,-1],G:[1,0]}[lead];
        const direction=new THREE.Vector3(x,0,z).applyQuaternion(model.parent.quaternion);
        const points=[.17,.42].map(offset=>point.clone().addScaledVector(direction,offset));
        const toward=opposite.clone().sub(point).setY(0);
        if(direction.dot(toward)<0){
          const tangent=new THREE.Vector3(-direction.z,0,direction.x);
          if(tangent.dot(toward)<0)tangent.negate();
          // A wire returning toward the lamp passes around its lower flange.
          points.push(points[1].clone().addScaledVector(tangent,.48));
        }
        return {direction,points};
      }
      const from=cableExit(wire.a,start,end),to=cableExit(wire.b,end,start);
      const curve=new THREE.CatmullRomCurve3([start,...from.points,midpoint,...to.points.reverse(),end]);
      const material=new THREE.MeshStandardMaterial({color:wire.color||'#e17e4c',roughness:.36,metalness:.03});
      const segments=Math.max(24,Math.min(72,Math.ceil(distance*8)));
      const cable=mesh(cableGroup,new THREE.TubeGeometry(curve,segments,.038,8,false),material);
      cable.userData={wireId:wire.id};wireTargets.push(cable);
      wirePickPaths.push({id:wire.id,points:curve.getSpacedPoints(segments)});
      for(const [point,{direction,relayScrew,grove}] of [[start,from],[end,to]]){
        if(direction){
          const tip=point.clone().addScaledVector(direction,.027),grip=point.clone().addScaledVector(direction,.103);
          const yaw=Math.atan2(direction.x,direction.z);
          const ferrule=box(cableGroup,.049,.053,.065,relayScrew?mat.gold:mat.tin,tip.x,tip.y,tip.z);
          const clip=roundedBox(cableGroup,.087,.075,.113,.012,relayScrew?material:mat.black,grip.x,grip.y,grip.z);
          for(const object of [ferrule,clip]){
            object.rotation.y=yaw;
            object.userData={wireId:wire.id};
            wireTargets.push(object);
          }
          continue;
        }
        const connector=roundedBox(cableGroup,.139,.19,.139,.022,grove?mat.boardWhite:mat.black,point.x,point.y+.12,point.z);
        const ferrule=box(cableGroup,.068,.057,.068,mat.tin,point.x,point.y+.029,point.z);
        const boot=cylinder(cableGroup,.056,.045,material,point.x,point.y+.222,point.z,12);
        for(const object of [connector,ferrule,boot]){object.userData={wireId:wire.id};wireTargets.push(object);}
      }
    });
  }
  function clearSelectionBoxes(){
    for(const box of selectionBoxes.values()){scene.remove(box);box.geometry.dispose();box.material.dispose();}
    selectionBoxes.clear();
  }
  function sevenSegmentSelectionOutline(model,color){
    const {width,height,depth}=sevenSegmentVisual;
    const y=model.bodyBase+height+.025,x=width/2+.025,z=depth/2+.025;
    const vertices=[[-x,-z],[x,-z],[x,z],[-x,z]].map(([xx,zz])=>new THREE.Vector3(xx,y,zz));
    const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color}));
    outline.matrixAutoUpdate=false;
    outline.update=()=>{
      model.parent.updateWorldMatrix(true,false);
      outline.matrix.copy(model.parent.matrixWorld);
      outline.matrixWorldNeedsUpdate=true;
    };
    outline.update();
    return outline;
  }
  function refreshSelection() {
    clearSelectionBoxes();
    for(const object of wireTargets) {
      if(object.material?.emissive && !object.material.userData.shared) {
        object.material.emissive.setHex(object.userData.wireId===selectedId ? 0xb5781b : 0x000000);
        object.material.emissiveIntensity=object.userData.wireId===selectedId ? 0.38 : 0;
      }
    }
    rebuildWireHandles();
    const ids=new Set(selectedParts);
    if(selectedId)ids.add(selectedId);
    focusButton.disabled=!componentGroups.has(selectedId);
    for(const id of ids){
      const group=componentGroups.get(id);
      if(!group)continue;
      const color=id===selectedId?0x007d70:0x3a86c5;
      const display=segmentModels.get(id),box=display?sevenSegmentSelectionOutline(display,color):new THREE.BoxHelper(group,color);
      box.material.depthTest=false;
      box.renderOrder=10;scene.add(box);selectionBoxes.set(id,box);
    }
    requestFrame();
  }
  function setCircuit(next) {
    const previousBoardId=circuit?.boardId,firstLoad=!circuit;
    const previousPose=boardView?.pose;
    cancelInteraction(false);circuit=next;selectedId=selectionDescriptor(circuit,selectedId)?.id??null;
    renderer.domElement.setAttribute('aria-label',getBoardProfile(circuit?.boardId).name+(inspection?' 三维对照模型，可旋转、缩放、选择引脚或打开芯片':' 三维电路实验台，可旋转、缩放、选择引脚和元件'));
    disposeTree(assembly);disposeTree(cableGroup);
    componentGroups.clear();endpoints.clear();insertedParts.clear();occupiedSockets.clear();ledModels.clear();servoModels.clear();buttonModels.clear();potModels.clear();sourceDisplays.clear();rgbModels.clear();segmentModels.clear();motorModels.clear();switchModels.clear();
    capacitorModels.clear();
    encoderModels.clear();
    joystickModels.clear();
    dipSwitchModels.clear();
    delete renderer.domElement.dataset.dipSwitchModel;
    photoresistorModels.clear();
    delete renderer.domElement.dataset.photoresistorModel;
    kingbrightRgbModels.clear();
    sensorModels.clear();
    oledModels.clear();
    mcp9808Models.clear();
    groveRelayModels.clear();
    delete renderer.domElement.dataset.buttonModel;
    delete renderer.domElement.dataset.buttonModelStatus;
    delete renderer.domElement.dataset.servoModel;
    delete renderer.domElement.dataset.servoModelStatus;
    delete renderer.domElement.dataset.capacitorModel;
    delete renderer.domElement.dataset.capacitorModelStatus;
    delete renderer.domElement.dataset.sevenSegmentModel;
    delete renderer.domElement.dataset.sevenSegmentModelStatus;
    delete renderer.domElement.dataset.motorModel;
    delete renderer.domElement.dataset.motorModelStatus;
    delete renderer.domElement.dataset.hcsr04Model;
    delete renderer.domElement.dataset.hcsr04ModelStatus;
    delete renderer.domElement.dataset.ssd1306Model;
    delete renderer.domElement.dataset.ssd1306ModelStatus;
    delete renderer.domElement.dataset.mcp9808Model;
    delete renderer.domElement.dataset.mcp9808ModelStatus;
    delete renderer.domElement.dataset.relayModel;
    delete renderer.domElement.dataset.relayModelStatus;
    delete renderer.domElement.dataset.potModel;
    delete renderer.domElement.dataset.potModelStatus;
    delete renderer.domElement.dataset.encoderModel;
    delete renderer.domElement.dataset.encoderModelStatus;
    delete renderer.domElement.dataset.joystickModel;
    delete renderer.domElement.dataset.joystickModelStatus;
    delete renderer.domElement.dataset.rgbLedModel;
    delete renderer.domElement.dataset.rgbLedModelStatus;
    pinTargets.length=0;objectTargets.length=0;wireTargets.length=0;
    breadboardHalos=null;breadboardEndpointOrder=[];
    boardResetCap=null;
    if(!circuit){boardView=null;refreshMotorReadout();refreshSensorReadout();refreshMcp9808Readout();renderPartPlacementPreview();syncProbeMarkers();return;}
    const profile=getBoardProfile(circuit.boardId);
    const pose=inspection?{x:-5,z:0,...circuit.board,rotation:0,mounted:false}:boardPose(circuit,profile);
    boardView={profile,pose};
    buildBoard(pose);
    if(!inspection){
      for(const part of circuit.components||[]){
        const contacts=mountedPartContacts(part);
        if(contacts.length)insertedParts.add(part.id);
        for(const {b} of contacts)occupiedSockets.add(b);
      }
      buildBreadboard(circuit.breadboard||{x:1.8,z:0});
      (circuit.components||[]).filter(part=>!part.hidden).forEach(buildPart);
    }
    updateEndpointPositions();
    if(boardHolePicker){
      delete boardHolePickerGroup.userData.key;
      delete dockPreviewGroup.userData.mountKey;
      renderBoardHolePicker();
    }
    if(!inspection){rebuildWires();refreshSelection();}
    renderPartPlacementPreview();
    refreshConnectionStatus();
    update(result,state);
    if(firstLoad||previousBoardId!==circuit.boardId||(!inspection&&previousPose?.mounted!==pose.mounted))fitSceneOnReady();
  }
  function setLamp(model,brightness) {
    if(!model)return false;
    const v=clamp(Number(brightness)||0,0,1);
    if(model.brightness===v)return false;
    model.brightness=v;
    model.lens.emissiveIntensity=v*2.1;
    if(model.glow){
      model.glow.material.opacity=v*.47;
      model.glow.visible=v>0;
    }
    return true;
  }
  function update(nextResult,nextState) {
    result=nextResult;state=nextState;
    let changed=false, moved=false, haloChanged=false;
    function setPose(object,key,value){
      if(object[key]===value)return;
      object[key]=value;moved=true;
    }
    for(const [id,model] of ledModels) {
      if(rgbModels.has(id))continue;
      const measured=result?.parts?.[id];
      if(setLamp(model,id==='power-led' ? (circuit?.powered ? 0.7 : 0) : (measured?.displayBrightness ?? measured?.brightness ?? 0)))changed=true;
    }
    for(const [id,{horn}] of servoModels){
      const angle=servoPhysicalAngle(id);
      if(angle===null)continue;
      const rotation=servoHornRotation(angle);
      if(horn.rotation.y===rotation)continue;
      setPose(horn.rotation,'y',rotation);
      selectionBoxes.get(id)?.update();
    }
    for(const [id,model] of buttonModels)setPose(model.cap.position,'y',buttonCapY(model,buttonPressed(id)));
    for(const [id,{knob}] of potModels)setPose(knob.rotation,'y',potAngle(potPosition(id)));
    for(const [id,{shaft,restY}] of encoderModels){
      const {angle,pressed}=encoderAppearance(result?.parts?.[id]);
      setPose(shaft.rotation,'y',-angle*Math.PI/180);
      setPose(shaft.position,'y',restY-(pressed?encoderVisual.pressTravel:0));
    }
    for(const [id,model] of joystickModels)if(poseJoystick(model,result?.parts?.[id]))moved=true;
    for(const [id,{sliders}] of dipSwitchModels){
      const mask=getPart(id)?.switchMask??0;
      sliders.forEach(({object,rest},index)=>setPose(object.position,'z',rest-((mask>>index)&1)*DIP_SWITCH_TRAVEL));
    }
    for(const [id,{cover}] of photoresistorModels){
      const covered=Boolean(getPart(id)?.ldrCovered);
      if(cover.visible!==covered){cover.visible=covered;changed=true;}
    }
    for(const [id,model] of capacitorModels){
      const part=getPart(id);
      if(part&&updateCapacitorMarking(model,part))changed=true;
    }
    for(const [id,model] of rgbModels){
      const {channels,level:brightness}=rgbLedLight(result?.parts?.[id]);
      if(channels.some((v,i)=>v!==model.channels?.[i])){model.channels=channels;changed=true;}
      model.lens.color.setRGB(.22+.78*channels[0],.22+.78*channels[1],.22+.78*channels[2]);model.lens.emissive.setRGB(...channels);model.glow.material.color.setRGB(.2+.8*channels[0],.2+.8*channels[1],.2+.8*channels[2]);setLamp(model,brightness);
    }
    for(const [id,model] of kingbrightRgbModels)if(setKingbrightRgbLight(model,result?.parts?.[id]))changed=true;
    for(const [id,model] of segmentModels)if(setSevenSegmentLenses(id,model))changed=true;
    for(const [id,model] of motorModels)if(updateMotorAppearance(id,model))changed=true;
    refreshMotorReadout();
    for(const [id,model] of sensorModels)if(updateSensorAppearance(id,model))changed=true;
    refreshSensorReadout();
    for(const [id,{raster,texture}] of oledModels)if(raster.paint(result?.parts?.[id])){
      texture.needsUpdate=true;changed=true;
    }
    for(const [id,model] of mcp9808Models)if(applyMcp9808Power(id,model))changed=true;
    for(const [id,model] of groveRelayModels)if(setGroveRelayVisual(model,result?.parts?.[id]))changed=true;
    refreshMcp9808Readout();
    for(const [id,lever] of switchModels){const part=circuit?.components.find(p=>p.id===id);setPose(lever.position,'z',part?.closed?-.08:.08);}
    const voltages=result?.netVoltages||{};
    for(const [endpoint,record] of endpoints) {
      const value=voltages[endpoint];
      const active=endpoint===(wireGesture?.dragging?wireGesture.start:pendingPin),hovered=endpoint===hoverEndpoint||endpoint===keyboardPin||endpoint===snappedPin;
      const color=active||hovered?0xffbb26:pendingPin||wireGesture?.dragging?0x43b9a1:Number.isFinite(value)?(value>1.8?0xe8a042:value<.5?0x338a9e:0x75aa8f):0xffffff;
      const opacity=active||hovered ? .95 : Number.isFinite(value) ? .75 : .16;
      if(record.color===color&&record.opacity===opacity)continue;
      record.color=color;record.opacity=opacity;
      if(record.halo){record.halo.material.color.setHex(color);record.halo.material.opacity=opacity;changed=true;}
      if(record.instanceIndex!==undefined&&breadboardHalos){breadboardHalos.setColorAt(record.instanceIndex,new THREE.Color(color));haloChanged=true;}
    }
    if(haloChanged)breadboardHalos.instanceColor.needsUpdate=true;
    if(changed||moved||haloChanged)requestFrame(moved);
  }

  function cameraHome(isTop=false) {
    floor.visible=true;grid.visible=true;controls.maxPolarAngle=Math.PI/2-.025;
    const aspect=camera.aspect||1;
    if (inspection) {
      if(nanoInspection)inspectionPinMarker.visible=Boolean(selectedInspectionPin);
      const {width,depth,centerZ}=inspectionCameraFrame(options.inspection.boardId);
      const distance = Math.max(width/aspect,depth)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.08;
      controls.target.set(0,.36,centerZ);
      camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(0,1,.0001).normalize(),distance);
      controls.update();
      return;
    }
    const bounds=circuit?visualBounds(circuit,getBoardProfile(circuit.boardId)):{width:14,height:7.5,centerX:-.25,centerZ:0};
    const distance=Math.max(9.5,Math.max(bounds.width/aspect,bounds.height)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))))*1.18;
    controls.target.set(bounds.centerX,.3,bounds.centerZ);
    if(isTop)camera.position.set(bounds.centerX,Math.max(distance,9.5),bounds.centerZ+.001);
    else camera.position.copy(controls.target).add(new THREE.Vector3(.20,.76,.68).normalize().multiplyScalar(distance));
    controls.update();
  }
  function inspectUnderside(){
    if(!floor.visible){cameraHome(false);return;}
    cameraHome(false);controls.maxPolarAngle=Math.PI-.08;
    camera.position.y=2*controls.target.y-camera.position.y;
    if(nanoInspection)inspectionPinMarker.visible=false;
    floor.visible=false;grid.visible=false;controls.update();requestFrame();
  }
  function inspectionAngle(){
    cameraHome();
    const distance=controls.getDistance();
    camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.36,.78,.52).normalize(),distance);
    controls.update();
  }
  function focusComponent(id){
    const group=componentGroups.get(id);
    if(!group)return false;
    const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
    const direction=camera.position.clone().sub(controls.target).normalize();
    const dimension=Math.max(size.x/Math.min(1,camera.aspect),size.y,size.z/Math.min(1,camera.aspect));
    const distance=Math.max(controls.minDistance,dimension/(2*Math.tan(camera.fov*Math.PI/360))*1.3);
    bounds.getCenter(controls.target);camera.position.copy(controls.target).addScaledVector(direction,distance);controls.update();
    return true;
  }
  const focusSelection=()=>focusComponent(selectedId);
  function isCameraPanning(){
    return cameraMode==='pan'||mode==='pan'||spacePan;
  }
  function syncCameraMouse(){
    controls.mouseButtons.LEFT=isCameraPanning()?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
  }
  function setCameraMode(next){
    if(inspection||cameraMode===next)return;
    cancelInteraction();
    spacePan=false;
    cameraMode=next==='pan'||next==='orbit'?next:'edit';
    syncCameraMouse();
    renderer.domElement.style.cursor=cameraMode==='edit'?'default':'grab';
    refreshConnectionStatus();
  }
  function fitSceneOnReady() {
    firstVisibleFit=stage.clientWidth<2||stage.clientHeight<2;
    if(!firstVisibleFit)cameraHome(false);
  }
  function resize() {
    const {width,height}=stage.getBoundingClientRect();
    if(width<2||height<2)return;
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    if(firstVisibleFit){firstVisibleFit=false;cameraHome(false);}
    requestFrame();
  }
  const toolbar=document.createElement('div');
  toolbar.style.cssText='display:flex;flex-wrap:wrap;gap:3px;margin-left:auto';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','三维视角缩放和平移');
  const status=document.createElement('div');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.style.cssText='display:block;flex:none;height:48px;box-sizing:border-box;padding:4px 11px;background:#f7faf8;border-top:1px solid #d6e2dc;color:#45685e;font:13px/1.5 system-ui;overflow:hidden';
  const statusLine=document.createElement('div'),statusHint=document.createElement('div');for(const line of [statusLine,statusHint])line.style.cssText='white-space:nowrap;overflow:hidden;text-overflow:ellipsis';statusLine.style.fontWeight='600';status.append(statusLine,statusHint);
  status.className=inspection?'blue-pill-inspection-status':'scene-3d-status';footer.className='scene-camera-controls';
  if (inspection) status.removeAttribute('style');
  footer.append(toolbar);shell.append(status,footer);
  const zoomBy=factor=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();};
  const orbitBy=angle=>{
    const offset=camera.position.clone().sub(controls.target).applyAxisAngle(groundPlane.normal,angle);
    camera.position.copy(controls.target).add(offset);controls.update();
  };
  const focusButton=document.createElement('button');focusButton.type='button';focusButton.textContent='聚焦';focusButton.title='聚焦所选元件 (F)';focusButton.setAttribute('aria-label','聚焦所选元件');focusButton.className='scene-camera-button';focusButton.disabled=true;focusButton.addEventListener('click',focusSelection);
  const cameraButtons = [['−','缩小',()=>zoomBy(1.2)],['+','放大',()=>zoomBy(.84)],['↶','视角左转',()=>orbitBy(.35)],['↷','视角右转',()=>orbitBy(-.35)]];
  if (inspection) {
    cameraButtons.push(['斜视','斜视模型',inspectionAngle]);
    if(inspectionUndersideAvailable)cameraButtons.push(['底面','翻看底面',inspectUnderside]);
    cameraButtons.push(['复位','复位模型',()=>cameraHome()]);
  }
  else cameraButtons.push(['俯视','垂直俯视',()=>cameraHome(true)],['底面','翻看底面',inspectUnderside]);
  cameraButtons.forEach(([name,title,action])=>{
    const button=document.createElement('button');button.type='button';button.textContent=name;button.title=title;button.setAttribute('aria-label',title);button.className='scene-camera-button';button.addEventListener('click',action);toolbar.appendChild(button);
  });
  if(!inspection)toolbar.appendChild(focusButton);
  function rebuildWireHandles(){
    disposeTree(handleGroup);handleTargets.length=0;
    const wire=circuit?.wires?.find(item=>item.id===selectedId);if(!wire)return;
    for(const end of ['a','b']){
      const point=endpoints.get(wire[end])?.position;if(!point)continue;
      const material=new THREE.MeshBasicMaterial({color:0xffd66d,depthTest:false,transparent:true,opacity:.94});
      const handle=mesh(handleGroup,new THREE.SphereGeometry(.14,16,12),material,point.x,point.y+.04,point.z);handle.renderOrder=20;handle.castShadow=false;handle.userData={wireId:wire.id,wireEnd:end};handleTargets.push(handle);
    }
  }
  function refreshConnectionStatus(){
    if(inspection){
      const message=selectedInspectionPin?'模型已选 '+selectedInspectionPin+' · 与'+referenceLabel+'同步':'拖动旋转 · 滚轮缩放 · 点击排针或芯片';
      if(statusLine.textContent!==message)statusLine.textContent=message;
      return;
    }
    const start=wireGesture?.dragging?wireGesture.start:pendingPin,target=wireGesture?.target||hoverEndpoint,reconnect=wireGesture?.reconnect||reconnectPending;
    if(Boolean(start)!==connectionPending){connectionPending=Boolean(start);hooks.onConnectionPending?.(connectionPending);}
    const plan=start&&target&&target!==start?connectionPlan(circuit,endpoints,start,target,reconnect,hooks.getWireSocketIssue):null;
    const voltage=start&&target?result?.measureBetween?.(target,'mcu:GND').voltage:null;
    const heading=reconnect?'重接 '+reconnect.id+' 的 '+reconnect.end.toUpperCase()+' 端':'接线';
    const probing=hooks.isProbePicking?.();
    const ready=cameraMode==='pan'?'平移镜头 · 拖动任意位置':cameraMode==='orbit'?'环绕视角 · 拖动任意位置'
      :boardHolePicker?'点击蓝色孔位，选择开发板的新起始孔':probing?'选择'+probeLabel(probing)+'接点 · 点击引脚或外露孔位':hooks.isPartPlacing?.()?'插装模式 · 点击面包板孔位或拖动当前元件'
      :mode==='wire'?'接线模式 · 点击两个引脚或从起点拖到终点':boardView?.pose.mounted
        ?selectedId==='mcu'&&hooks.onBoardStep?'已选开发板 · 拖动板身换孔，或用方向键逐孔调整':'拖动开发板调整插位 · 移动模式下拖面包板移动整组'
        :'拖动摆放 · 双击引脚开始接线';
    const hint=cameraMode!=='edit'?'方向键调整镜头 · 滚轮缩放 · Esc 返回编辑'
      :boardHolePicker?'方向键浏览 · Enter 选择 · Esc 取消':probing?'P 浏览引脚 · 方向键选择 · Enter 放置 · Esc 取消'
      :drag?.started&&drag.id!=='breadboard'&&!drag.partPlacement?'拖动中按 R 转向 · Shift+R 反向 · Esc 取消':'拖动背景旋转 · 右键平移 · 滚轮缩放';
    const modelStatus=boardModels.get(boardView?.profile.id)?.status;
    const modelLabel={ready:'精细 3D',loading:'正在加载精细外观',fallback:'精细外观加载失败，显示教学 3D'}[modelStatus]??'教学 3D';
    const modelHint=cameraMode==='edit'&&!boardHolePicker&&!probing&&!drag&&mode!=='wire'?`${modelLabel} · ${hint}`:hint;
    const message=start?heading+'：'+start+' → '+(target&&target!==start?target+(Number.isFinite(voltage)?' · '+voltage.toFixed(2)+' V':''):'请选择终点')+'\n'+(connectionError||(plan&&!plan.ok?plan.message:'点击终点确认；Esc 取消。')):connectionError||ready+'\n'+modelHint;
    const dock=drag?.boardHit?.candidate;
    const dockAction=boardView?.pose.mounted?'换位':'插入';
    const dockLegend=drag?.boardHit?.anchorHole?'紫圈标出针脚的目标孔 · 橙圈标出两排起始孔':'橙色粗圈标出两排的起始孔';
    const dockHint=dock?`已对齐 ${dock.rows.join(' / ').toUpperCase()} 排第 ${dock.mount.column} 列 · ${drag.boardHit.review?'松手后确认':'松手'}${dockAction}\n${dockLegend}`:null;
    const visibleMessage=dockHint||(snappedPin?'已对齐 '+snappedPin+' · 接线需手动确认':keyboardPin&&!start&&!connectionError?describePin(keyboardPin).split('\n').slice(0,2).join(' · '):message);
    if(status.dataset.message!==visibleMessage){status.dataset.message=visibleMessage;const lines=visibleMessage.split('\n');statusLine.textContent=lines[0];statusHint.textContent=lines.slice(1).join(' ');status.title=visibleMessage;}
    status.style.color=plan&&!plan.ok||connectionError?'#9b492e':start?'#695221':'#45685e';
  }
  function renderConnectionPreview(){
    disposeTree(previewGroup);
    const endpoint=wireGesture?.dragging?wireGesture.start:pendingPin,start=endpoints.get(endpoint)?.position;
    const target=wireGesture?.target||hoverEndpoint,end=target&&target!==endpoint?endpoints.get(target)?.position:wireGesture?.point||lastGroundPoint;
    if(start&&end){
      const plan=target&&target!==endpoint?connectionPlan(circuit,endpoints,endpoint,target,wireGesture?.reconnect||reconnectPending,hooks.getWireSocketIssue):null;
      const middle=start.clone().add(end).multiplyScalar(.5);middle.y=Math.max(start.y,end.y)+Math.min(2,.35+start.distanceTo(end)*.12);
      const curve=new THREE.CatmullRomCurve3([start,start.clone().add(new THREE.Vector3(0,.18,0)),middle,end]);
      const invalid=plan&&!plan.ok;
      const material=new THREE.MeshBasicMaterial({color:invalid?0xc45c41:0x29ab92,transparent:true,opacity:.8});mesh(previewGroup,new THREE.TubeGeometry(curve,32,.029,6,false),material);
      const marker=mesh(previewGroup,new THREE.SphereGeometry(.12,14,10),new THREE.MeshBasicMaterial({color:invalid?0xd97457:0x63dbc0,transparent:true,opacity:.85}),end.x,end.y,end.z);marker.castShadow=false;
    }
    refreshConnectionStatus();update(result,state);requestFrame();
  }
  function pointRay(event,bounds=renderer.domElement.getBoundingClientRect()) {
    pointer.set(((event.clientX-bounds.left)/bounds.width)*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);raycaster.setFromCamera(pointer,camera);
  }
  function screenWireHits(event,bounds,radius){
    if(!wirePickPaths.length||!pointerInsideSurface(renderer.domElement,event))return [];
    const {left,top,width,height}=bounds;
    const view=[left,top,width,height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
    if(projectedWireCache?.view!==view){
      const screen=new THREE.Vector3();
      const paths=wirePickPaths.map(({id,points})=>({id,points,screen:points.map(point=>{
        screen.copy(point).project(camera);
        return screen.z>=-1&&screen.z<=1?{x:left+(screen.x+1)*width/2,y:top+(1-screen.y)*height/2}:null;
      })}));
      projectedWireCache={view,paths};
    }
    const hits=[];
    for(const {id,points,screen} of projectedWireCache.paths){
      const nearest=closestWireSegment(screen,event.clientX,event.clientY,radius);
      if(!nearest)continue;
      const point=points[nearest.index].clone().lerp(points[nearest.index+1],nearest.t);
      hits.push({...nearest,id,point,depth:point.distanceTo(camera.position)});
    }
    return hits.sort(compareWireHits);
  }
  function nearbyVisibleWire(event,bounds,physical){
    const fixed=Boolean(physical?.object.userData.componentId);
    const radius=event.pointerType==='touch'?(fixed?9:13):(fixed?5:8);
    for(const hit of screenWireHits(event,bounds,radius)){
      if(physical&&hit.depth>physical.distance+.075)continue;
      const projected=new THREE.Vector2((hit.x-bounds.left)/bounds.width*2-1,1-(hit.y-bounds.top)/bounds.height*2);
      wireVisibilityRay.setFromCamera(projected,camera);
      const occluder=wireVisibilityRay.intersectObjects(objectTargets,false)[0];
      if(!occluder||hit.depth<=occluder.distance+.075){
        return {object:{userData:{wireId:hit.id}},point:hit.point,distance:hit.depth};
      }
    }
    return null;
  }
  function picoPadAt(point) {
    let endpoint=null,distance=.24;
    for(const [id,{position}] of endpoints){
      const offset=Math.hypot(point.x-position.x,point.z-position.z);
      if(offset<distance){endpoint=id;distance=offset;}
    }
    return endpoint;
  }
  function pick(event,pinOnly=false,probing=false) {
    const bounds=renderer.domElement.getBoundingClientRect();
    if(probing&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))return null;
    pointRay(event,bounds);
    const placing=!probing&&hooks.isPartPlacing?.();
    const handle=!pinOnly&&!pendingPin&&!placing&&raycaster.intersectObjects(handleTargets,false)[0];
    const objectHits=raycaster.intersectObjects(objectTargets.concat(wireTargets),false),physical=objectHits[0];
    const physicalData=physical?.object.userData;
    const wirePicking=!inspection&&!placing&&!pinOnly&&!probing&&!pendingPin&&!reconnectPending&&!spacePan&&
      (mode==='orbit'||mode==='move');
    const fixedSurface=['mcu','breadboard'].includes(physicalData?.componentId)&&!physicalData?.buttonId&&!physicalData?.boardReset;
    const wireAssist=wirePicking&&(!physical||fixedSurface)?nearbyVisibleWire(event,bounds,physical):null;
    const firstObject=wireAssist??physical;
    const movingThroughHandle=handle&&mode==='move'&&allowBoardDrag()&&mountedAssemblyPart('mcu')&&
      objectHits.find(({object})=>!object.userData.wireId)?.object.userData.componentId==='mcu';
    if(handle&&!movingThroughHandle)return {kind:'wire-handle',wireId:handle.object.userData.wireId,end:handle.object.userData.wireEnd,point:handle.point};
    if(inspection&&firstObject?.object.userData.inspectionChip)return {kind:'inspection-chip',label:firstObject.object.userData.inspectionChip};
    const inspectionEndpoint=inspection&&firstObject?.object.userData.inspectionEndpoint;
    if(inspectionEndpoint)return {kind:'pin',endpoint:inspectionEndpoint};
    if(inspection&&firstObject?.object.userData.inspectionPicoPad){
      const endpoint=picoPadAt(firstObject.point);
      if(endpoint)return {kind:'pin',endpoint};
    }
    const placementBody=placing&&!pinOnly?objectHits.find(hit=>!hit.object.userData.wireId):null;
    const bodyId=placementBody?.object.userData.componentId;
    if(bodyId&&hooks.isPartPlacing?.(bodyId)){
      return {kind:'component',componentId:bodyId,point:placementBody.point};
    }
    const capId=firstObject?.object.userData.buttonId;
    const resetLabel=firstObject?.object.userData.boardReset;
    if(resetLabel&&!placing&&!pinOnly&&mode==='orbit'&&!pendingPin&&!reconnectPending&&!spacePan&&!event.altKey&&hooks.onBoardReset){
      return {kind:'board-reset',componentId:'mcu',label:resetLabel,point:firstObject.point};
    }
    const boardButton=capId&&capId===boardView?.profile.userButton?.id;
    if(capId&&(boardButton||insertedParts.has(capId))&&!placing&&!pinOnly&&mode==='orbit'&&!pendingPin&&!reconnectPending){
      return {kind:'button',componentId:boardButton?'mcu':capId,buttonId:capId,point:firstObject.point};
    }
    const front=firstObject?.object.userData;
    if(Number.isInteger(front?.dipSwitchIndex)&&!inspection&&!placing&&!pinOnly&&!probing&&hooks.onDipSwitch){
      return {kind:'dip-slider',componentId:front.componentId,index:front.dipSwitchIndex,point:firstObject.point};
    }
    if(front?.photocellFace&&!inspection&&!placing&&!pinOnly&&!probing&&hooks.onPhotocellCover){
      return {kind:'photocell-face',componentId:front.componentId,point:firstObject.point};
    }
    const terminal=front?.encoderTerminal||front?.joystickTerminal||front?.rgbLedTerminal||front?.relayTerminal;
    if(terminal&&!placing){
      const endpoint=front.componentId+':'+terminal,record=endpoints.get(endpoint);
      if(record&&!record.hidden&&(!probing||probeEndpointVisible(record))){
        return {kind:'pin',endpoint,componentId:front.componentId,point:record.position};
      }
    }
    if(front?.encoderShaft&&!inspection&&!pinOnly&&!placing){
      return {kind:hooks.onEncoderTurn?'encoder-shaft':'component',componentId:front.componentId,point:firstObject.point};
    }
    if(front?.joystickCap&&!inspection&&!placing){
      if(pinOnly||probing)return null;
      return {kind:hooks.onJoystickMove?'joystick-cap':'component',componentId:front.componentId,point:firstObject.point};
    }
    if(front?.rgbLedLens&&!inspection&&!placing){
      return pinOnly||probing?null:{kind:'component',componentId:front.componentId,point:firstObject.point};
    }
    if(hooks.onPotAdjust&&!inspection&&!placing&&!pinOnly&&!probing&&mode==='orbit'&&
      !pendingPin&&!reconnectPending&&!spacePan&&!event.altKey&&
      (front?.potKnob||front?.potHousing&&event.pointerType==='touch'&&nearPotAdjuster(front.componentId,event,bounds))){
      return {kind:'pot-knob',componentId:front.componentId,point:firstObject.point};
    }
    const pinHits=raycaster.intersectObjects(pinTargets,false);
    const seatedGrab=!inspection&&!placing&&!pinOnly&&!pendingPin&&!reconnectPending&&!spacePan&&
      (mode==='orbit'||mode==='move')&&mountedAssemblyPart('mcu');
    if(seatedGrab)for(const contact of pinHits){
      const pinData=contact.object.userData;
      const endpoint=pinData.endpoint??pinData.endpointOrder?.[contact.instanceId];
      const record=endpoints.get(endpoint);
      if(!record||record.hidden)continue;
      const componentId=record.componentId;
      // The invisible wiring spheres extend beyond the metal. On a seated PCB,
      // only a close, unobscured contact may turn a grab into an exact-pin drop.
      const gap=raycaster.ray.distanceToPoint(record.position);
      const boardPin=componentId==='mcu'&&gap<=.07&&(!physical||contact.distance<=physical.distance+.015);
      const breadboardPin=componentId==='breadboard'&&(!physical||physicalData?.componentId==='breadboard')&&(!wireAssist||gap<=.07);
      if(boardPin||breadboardPin){
        const boardDrag=boardPin&&allowBoardDrag()?{componentId,point:contact.point,anchor:endpoint}:undefined;
        return {kind:'pin',endpoint,componentId,point:record.position,boardDrag};
      }
    }
    const bodyIsLoose=front?.componentId&&!['mcu','breadboard'].includes(front.componentId);
    const exactOnly=wirePicking&&(front?.wireId||bodyIsLoose);
    if(exactOnly){
      for(const contact of pinHits){
        const pinData=contact.object.userData;
        const endpoint=pinData.endpoint??pinData.endpointOrder?.[contact.instanceId];
        const record=endpoints.get(endpoint);
        if(!record||record.hidden||raycaster.ray.distanceToPoint(record.position)>.07)continue;
        if(bodyIsLoose&&record.componentId!==front.componentId)continue;
        if(physical&&contact.distance>physical.distance+.015)continue;
        return {kind:'pin',endpoint,componentId:record.componentId,point:record.position};
      }
    }
    let fixedBody=null,fixedPoint=null,boardDrag=null,deckSurface=false;
    if(!inspection&&!placing&&!pinOnly&&!pendingPin&&!reconnectPending&&!spacePan&&['orbit','move'].includes(mode)&&
      (allowBoardDrag()||mountedAssemblyPart('mcu'))){
      const under=front?.wireId?objectHits.find(({object})=>!object.userData.wireId):firstObject;
      const id=under?.object.userData.componentId;
      deckSurface=id==='breadboard';
      const draggableBoard=id=>id==='mcu'||id==='breadboard'&&(!mountedAssemblyPart(id)||canMoveAssembly())&&!circuit?.breadboard?.locked;
      if(draggableBoard(id)){
        // Keep the tap target when a lead covers the board.
        if(!front?.wireId)fixedBody=id;
        else if(allowBoardDrag())boardDrag={componentId:id,point:under.point};
      }
      if(!under||id==='breadboard'&&mountedAssemblyPart('mcu')){
        // Rays through a seated PCB cutout can hit the deck beneath it.
        const boardGroup=componentGroups.get('mcu'),profile=boardView?.profile;
        if(boardGroup&&profile){
          const point=positionOnGround(event,boardGroup.position.y+.35);
          const {x,z}=boardGroup.position;
          const local=point&&rotateBoardPoint(point.x-x,point.z-z,-boardGroup.rotation.y*180/Math.PI);
          if(local&&Math.abs(local.x)<=profile.width/2&&Math.abs(local.z)<=profile.height/2&&
            (!under||camera.position.distanceTo(point)<=under.distance+.01)){
            if(!front?.wireId){fixedBody='mcu';fixedPoint=point;}
            else if(allowBoardDrag())boardDrag={componentId:'mcu',point};
          }
        }
      }
      if(!firstObject&&!fixedPoint&&allowBoardDrag()&&circuit?.breadboard&&draggableBoard('breadboard')){
        const point=positionOnGround(event,breadboardDimensions.coverTop),bb=circuit.breadboard;
        if(point&&Math.abs(point.x-bb.x)<=breadboardDimensions.width/2&&Math.abs(point.z-bb.z)<=breadboardDimensions.depth/2){
          fixedBody='breadboard';fixedPoint=point;
        }
      }
    }
    const threshold=event.pointerType==='touch'?(probing?14:22):(probing?8:13);
    const exactMountedSurface=seatedGrab&&(fixedBody==='mcu'||boardDrag?.componentId==='mcu'||deckSurface);
    let nearest=null,distance=threshold*threshold;
    for(const [endpoint,record] of exactMountedSurface||exactOnly?[]:endpoints){
      if(record.hidden||placing&&!isPlacementSocket(endpoint)||fixedBody&&record.componentId!==fixedBody)continue;
      const projected=record.position.clone().project(camera);if(projected.z< -1||projected.z>1)continue;
      const sx=bounds.left+(projected.x+1)*bounds.width/2,sy=bounds.top+(1-projected.y)*bounds.height/2,d=(sx-event.clientX)**2+(sy-event.clientY)**2;
      if(d>=distance)continue;
      if(probing&&!probeEndpointVisible(record))continue;
      const objectData=firstObject?.object.userData;
      if(objectData?.componentId&&(inspection||probing||objectData.componentId!==record.componentId)&&record.position.distanceTo(camera.position)>firstObject.distance+.24)continue;
      nearest={kind:'pin',endpoint,componentId:record.componentId,point:record.position};distance=d;
    }
    if(nearest)return nearest;
    if(pinOnly)return null;
    if(fixedPoint)return {kind:'component',componentId:fixedBody,point:fixedPoint};
    if(firstObject){const data=firstObject.object.userData;return {kind:data.wireId?'wire':data.buttonId&&!boardButton?'button':'component',wireId:data.wireId,componentId:data.componentId,buttonId:data.buttonId,point:firstObject.point,boardDrag,potKnob:data.potKnob};}
    return nearest;
  }
  function positionOnGround(event, height=0) {
    pointRay(event);dragPlane.constant=-height;
    return raycaster.ray.intersectPlane(dragPlane,v3)?v3.clone():null;
  }
  function pointerPreviewPoint(event){const point=positionOnGround(event);if(point)point.y=baseHeight(point.x,point.z)+.30;return point;}
  function boardDropPointer(event,active,position){
    if(active.rotationDegrees!==undefined)return position;
    // At an angle, the pin head and its socket are separated on screen.
    // Keep the grabbed pin's offset from the PCB while moving the whole board.
    if(active.boardAnchorOffset&&position&&!active.boardScreen?.topDown){
      const {x,z}=active.boardAnchorOffset;
      return {x:position.x+x,z:position.z+z,anchor:active.boardAnchor};
    }
    const point=positionOnGround(event,breadboardDimensions.coverTop);
    if(!active.boardAnchor)return point;
    return point?{x:point.x,z:point.z,anchor:active.boardAnchor}:{anchor:active.boardAnchor};
  }
  function describePin(endpoint) {
    const record=endpoints.get(endpoint);
    if(inspection)return (record?.description||endpoint)+'\n点击与'+referenceLabel+'同步';
    const probing=hooks.isProbePicking?.();
    if(probing)return (record?.description||endpoint)+'\n点击或按 Enter 放置'+probeLabel(probing);
    if(hooks.isPartPlacing?.()&&isPlacementSocket(endpoint))return (record?.description||endpoint)+'\n点击预览插位';
    const hint=hooks.getWireSocketIssue?.(endpoint,reconnectPending?.id)||(mode==='wire'?'点两端或拖到另一引脚接线':pendingPin?'点击终点确认接线':'单击选择 · 双击开始接线');
    const reading=result?.measureBetween?.(endpoint,'mcu:GND');
    const voltage=reading?.status==='measured'?reading.voltage.toFixed(2)+' V':reading?.status==='floating'?'悬空':'暂无有效读数';
    return (record?.description||endpoint)+'\n'+endpoint+' · '+voltage+'\n'+hint;
  }
  function showTip(event,hit) {
    if(!hit){tooltip.style.display='none';return;}
    let text='';
    if(hit.kind==='pin')text=describePin(hit.endpoint)+(hit.boardDrag?.componentId==='mcu'?' · 拖动板卡换孔':'');
    else if(hit.kind==='inspection-chip')text=(typeof hit.label==='string'?hit.label:getBoardProfile(circuit?.boardId).mcu)+'\n点击查看封装、引脚和内部功能';
    else if(inspection){tooltip.style.display='none';return;}
    else if(hit.kind==='wire'||hit.kind==='wire-handle'){const wire=circuit?.wires.find(item=>item.id===hit.wireId);text=wire?'杜邦线 '+wire.id+'\n'+wire.a+' → '+wire.b+'\n'+(hit.kind==='wire-handle'?'拖到新引脚重接此端':'点击选择；端点可重接；Delete删除')+(hit.boardDrag?.componentId==='mcu'?'\n拖动板卡换孔':''):'';}
    else if(hit.kind==='button'&&hit.componentId==='mcu')text='B1 用户按键 · PC13\n按住拉低，松开回到高电平';
    else if(hit.kind==='board-reset')text=hit.label+' · 开发板复位\n点击后松开，重新启动当前程序';
    else if(hit.kind==='pot-knob')text='旋钮位置 · '+Math.round(potPosition(hit.componentId)*100)+'%\n按住向左调低，向右调高 · Esc 取消';
    else if(hit.kind==='encoder-shaft'&&canvasIntent(hit,event)==='turn-encoder')text='PEC11R 转轴\n向右拖顺时针，向左拖逆时针 · 拖外壳移动\n按压开关在元件属性中操作';
    else if(hit.kind==='joystick-cap'&&canvasIntent(hit,event)==='adjust-joystick')text='双轴摇杆\n拖动摇杆帽，松开回中 · 拖底板移动\n按压开关在元件属性中操作';
    else if(hit.kind==='dip-slider'&&canvasIntent(hit,event)==='toggle-dip'){
      const closed=(getPart(hit.componentId)?.switchMask??0)&(1<<hit.index);
      text='拨码 '+(hit.index+1)+' · '+(closed?'ON 闭合':'OFF 断开')+'\n轻点切换 · 移动模式可拖外壳';
    }
    else if(hit.kind==='photocell-face'&&canvasIntent(hit,event)==='toggle-photocell'){
      const covered=Boolean(getPart(hit.componentId)?.ldrCovered);
      text='PDV-P8103 光敏电阻\n'+(covered?'点一下移开遮光片':'点一下盖住感光面')+' · 移动模式可拖动';
    }
    else if(hit.componentId==='mcu'){const profile=getBoardProfile(circuit?.boardId),pose=boardPose(circuit,profile);text=profile.name+'\n'+profile.pins.length+' 个已定义端点 · 旋转 '+pose.rotation+'°'+(pose.mounted?'\n拖动板身调整插位 · R / Shift+R 旋转':'');}
    else if(hit.componentId==='breadboard')text='400孔面包板\n每列A–E、F–J各自相通\n上下电源轨相互隔离'+(mountedAssemblyPart(hit.componentId)||insertedParts.size?'\n移动模式可拖动整组':'');
    else {
      const part=circuit?.components.find(item=>item.id===hit.componentId);
      if(part){
        const mounted=insertedParts.has(part.id);
        const placement=hooks.isPartPlacing?.(part.id)?'拖动预览插位 · 确认后生效'
          :mounted?'已插入面包板 · 选中后可调整插位':'直接拖动；方向键微移，Shift加速，R旋转';
        const press=hit.kind==='button'?(mounted?'\n观察模式按住帽盖；选中后也可按空格':'\n按住帽盖操作；拖动底座移动\n移动模式拖帽盖不会按下'):'';
        const hs55=part.type==='servo'&&part.servoModel==='hs55';
        const angle=hs55?servoPhysicalAngle(part.id):null;
        const measure=angle===null?'':' · 实际 '+Math.round(angle)+'°';
        const name=hs55?'HS-55':kingbrightRgbModels.has(part.id)?'Kingbright WP154A4 RGB':PARTS[part.type]?.name||part.type;
        text=name+' · '+part.id+measure+'\n'+placement+press;
        if(part.type==='grove-relay'){
          const {indicator,closed}=groveRelayState(result?.parts?.[part.id]);
          text+='\n输入灯 '+(indicator?'亮':'灭')+' · COM / NO '+(closed?'闭合':'断开');
        }
      }
    }
    if(!text){tooltip.style.display='none';return;}
    tooltip.textContent=text;tooltip.style.display='block';const bounds=stage.getBoundingClientRect();
    tooltip.style.maxWidth=Math.min(240,Math.max(1,bounds.width-16))+'px';tooltip.style.overflowWrap='anywhere';
    tooltip.style.left=clamp(event.clientX-bounds.left+15,8,Math.max(8,bounds.width-tooltip.offsetWidth-8))+'px';
    tooltip.style.top=clamp(event.clientY-bounds.top+15,8,Math.max(8,bounds.height-tooltip.offsetHeight-8))+'px';
  }
  function setSelected(id){
    const next=selectionDescriptor(circuit,id)?.id??null;
    if(next===selectedId)return;
    selectedId=next;keyboardPin=null;refreshSelection();refreshConnectionStatus();refreshMotorReadout();refreshSensorReadout();refreshMcp9808Readout();
  }
  function setInspectionPin(id){
    if(!inspection)return;
    const endpoint=endpoints.get('mcu:'+id);
    const next=endpoint?id:null;
    if(endpoint){
      if(nanoInspection&&!floor.visible)cameraHome();
      revealPin(endpoint.position);
    }
    if(selectedInspectionPin===next)return;
    selectedInspectionPin=next;
    inspectionPinMarker.visible=Boolean(endpoint);
    if(endpoint)inspectionPinMarker.position.copy(endpoint.position);
    renderer.domElement.dataset.selectedPin=next||'';
    refreshConnectionStatus();requestFrame();
  }
  function revealPin(position){
    camera.updateMatrixWorld();
    const screen=position.clone().project(camera);
    if(!Number.isFinite(screen.z)||screen.z<=-1||screen.z>=1){
      cameraHome();requestFrame();return;
    }
    if(Math.abs(screen.x)<=.94&&Math.abs(screen.y)<=.94)return;
    // Shift the camera and orbit target together at the pin's depth to keep the zoom and angle.
    const center=screen.set(0,0,screen.z).unproject(camera);
    const offset=position.clone().sub(center);
    camera.position.add(offset);controls.target.add(offset);controls.update();requestFrame();
  }
  function setPartSelection(ids){selectedParts=new Set(ids);refreshSelection();}
  function selectPart(id,event){
    const additive=Boolean(event?.shiftKey||event?.ctrlKey||event?.metaKey);
    setSelected(id);hooks.onSelect?.(id,{additive});
  }
  function selectWire(id){setSelected(id);if(hooks.onWireSelect)hooks.onWireSelect(id);else hooks.onWire?.(id);}
  function getPart(id){return id==='mcu'?circuit?.board:id==='breadboard'?circuit?.breadboard:circuit?.components.find(part=>part.id===id);}
  function mountedAssemblyPart(id){
    return boardView?.pose.mounted&&['mcu','breadboard'].includes(id);
  }
  function canMoveAssembly(){return mode==='move'&&!pendingPin&&!reconnectPending&&!circuit?.board?.locked&&!circuit?.breadboard?.locked;}
  function allowBoardDrag(){return Boolean(hooks.onBoardDrop&&!circuit?.board?.locked);}
  function isPlacementSocket(endpoint){return Boolean(signalStrip(endpoint));}
  function canvasIntent(hit,event){
    if(cameraMode!=='edit')return 'pan';
    if(hooks.isPartPlacing?.()){
      if(mode==='pan'||spacePan||event.button===1)return 'pan';
      if(hit?.componentId&&hooks.isPartPlacing?.(hit.componentId))return 'drag';
      return hit?.kind==='pin'&&isPlacementSocket(hit.endpoint)?'place-pin':'pan';
    }
    if(hit?.kind==='pot-knob')return 'adjust-pot';
    if(hit?.potKnob&&(pendingPin||reconnectPending)&&mode!=='pan'&&!spacePan)return 'select';
    const dragHit=hit?.boardDrag??hit;
    const id=dragHit?.componentId||dragHit?.wireId;
    const allow=allowBoardDrag();
    // The fixed objects share the same default drag gesture while both are detached.
    const dragId=dragHit?.componentId==='breadboard'&&allow&&!mountedAssemblyPart('breadboard')&&!circuit?.breadboard?.locked&&mode==='orbit'?'mcu':id;
    return pointerIntent(dragHit?{kind:hit.boardDrag?'component':hit.kind,id:dragId}:null,{mode,altKey:event.altKey,spacePan,button:event.button,pendingPin,reconnecting:Boolean(reconnectPending),allowBoardDrag:allow});
  }
  function moveAttachments(active,x,z){
    for(const {group,origin} of active.attachments)group.position.set(origin.x+x-active.origin.x,origin.y,origin.z+z-active.origin.z);
  }
  function restoreDragPose(active){
    active.group.position.copy(active.origin);
    active.group.rotation.y=active.rotation;
    moveAttachments(active,active.origin.x,active.origin.z);
    if(active.dockBoard){
      const {group,origin,rotation}=active.dockBoard;
      group.position.copy(origin);
      group.rotation.y=rotation;
    }
  }
  function dragPosition(event,active){
    const lowAngle=active.boardScreen?.preferScreen;
    const point=active.offset&&(active.relocatingBoard||!lowAngle)&&positionOnGround(event,active.planeY);
    let x,z;
    if(point){
      x=point.x+active.offset.x;
      z=point.z+active.offset.z;
    }else if(active.boardScreen){
      const {right,depth,scale,depthScale}=active.boardScreen;
      const dx=(event.clientX-active.x)*scale,dz=(event.clientY-active.y)*depthScale;
      x=active.origin.x+right.x*dx+depth.x*dz+(active.grabShift?.x??0);
      z=active.origin.z+right.z*dx+depth.z*dz+(active.grabShift?.z??0);
    }else return null;
    if(active.relocatingBoard){
      // The actual grab plane resolves shallow cross-row movement. Far from
      // the original board the low-angle ray can jump beyond the workbench.
      if(lowAngle&&point&&Math.hypot(x-active.origin.x,z-active.origin.z)>18)return null;
      const columns=!lowAngle&&active.boardScreen?.columns;
      if(columns&&active.rotationDegrees===undefined){
        const dx=event.clientX-active.x,dy=event.clientY-active.y;
        const along=dx*columns.x+dy*columns.y,across=dy*columns.x-dx*columns.y;
        // A drag along the hole row keeps that row even in an oblique view.
        if(Math.abs(along)>=2&&Math.abs(across)<=Math.max(2,Math.abs(along)*.28))z=active.origin.z;
      }
      return {x,z};
    }
    return {x:clamp(x,-30,30),z:clamp(z,-20,20)};
  }
  function boardScreenProjection(anchor){
    const cameraSlope=camera.getWorldDirection(v3).y,slope=Math.abs(cameraSlope);
    // Near the horizon, ground-plane intersections can disappear or jump far away.
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
    const depth=new THREE.Vector3(-right.z,0,right.x);
    if(cameraSlope>0)depth.negate();
    const scale=2*camera.position.distanceTo(anchor)*Math.tan(camera.fov*Math.PI/360)/Math.max(1,stage.clientHeight);
    const bounds=renderer.domElement.getBoundingClientRect();
    const base=anchor.clone().project(camera);
    const step=anchor.clone().add(new THREE.Vector3(signalPitch,0,0)).project(camera);
    const dx=(step.x-base.x)*bounds.width/2,dy=(base.y-step.y)*bounds.height/2;
    const pitch=Math.hypot(dx,dy);
    const columns=pitch>=1?{x:dx/pitch,y:dy/pitch}:null;
    // Only the explicit vertical view can treat the pointer as a deck cursor.
    // Near-overhead orbit views still separate the raised pin from its hole.
    return {right,depth,scale,depthScale:scale/Math.max(slope,.32),preferScreen:slope<.25,topDown:slope>.9999,columns,pitch};
  }
  function socketRings(sockets,color,outer=.108){
    const geometry=new THREE.RingGeometry(.062,outer,16).rotateX(-Math.PI/2);
    const material=new THREE.MeshBasicMaterial({color,opacity:.88,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const rings=new THREE.InstancedMesh(geometry,material,sockets.length);
    rings.renderOrder=18;
    sockets.forEach(({x,z},index)=>rings.setMatrixAt(index,matrix.makeTranslation(x,breadboardDimensions.coverTop+.006,z)));
    return rings;
  }
  function renderPartPlacementPreview(){
    const sockets=(partPlacementPreview?.contacts??[]).map(({b})=>endpoints.get(b)?.position).filter(Boolean);
    const key=sockets.length?JSON.stringify([partPlacementPreview.id,partPlacementPreview.ok,sockets.map(({x,z})=>[x,z])]):'';
    if(partPlacementGroup.userData.key===key)return;
    partPlacementGroup.userData.key=key;
    disposeTree(partPlacementGroup);
    if(sockets.length)partPlacementGroup.add(socketRings(sockets,partPlacementPreview.ok?0x147e56:0xb54129));
    requestFrame();
  }
  function setPartPlacementPreview(preview){
    partPlacementPreview=preview;
    renderPartPlacementPreview();
    refreshConnectionStatus();
  }
  function showDockPreview(hit,showTips=true){
    const candidate=hit?.candidate,anchor=hit?.anchorHole;
    const key=candidate?`${candidate.rows.join('')}:${candidate.mount.column}:${candidate.mount.rotation}:${candidate.breadboard?.x}:${candidate.breadboard?.z}:${anchor}:${showTips}`
      :anchor?`${hit.unchanged?'same':'blocked'}:${anchor}`:'';
    if(dockPreviewGroup.userData.mountKey===key)return;
    dockPreviewGroup.userData.mountKey=key;
    disposeTree(dockPreviewGroup);
    const anchorPoint=endpoints.get(anchor)?.position;
    if(anchorPoint)dockPreviewGroup.add(socketRings([anchorPoint],candidate?0x8167f4:hit.unchanged?0x6b928c:0xcc6344,.145));
    if(!candidate)return;
    const sockets=[],startingSockets=[],remainingSockets=[];
    for(const {b} of candidate.contacts){
      const position=endpoints.get(b)?.position;
      if(!position)continue;
      sockets.push(position);
      if(signalStrip(b)?.column===candidate.mount.column)startingSockets.push(position);
      else remainingSockets.push(position);
    }
    if(!sockets.length)return;
    if(showTips){
      const {coverBottom,coverTop}=breadboardDimensions;
      const barePico=boardView?.profile.style==='pico'&&boardView.profile.id!=='pico';
      const tip=coverBottom+.018, overlap=coverTop+DOCK_PREVIEW_LIFT+(barePico ? .215 : .06);
      const tipGeometry=new THREE.BoxGeometry(.055,overlap-tip,.055);
      const tips=new THREE.InstancedMesh(tipGeometry,mat.gold,sockets.length);
      sockets.forEach(({x,z},index)=>tips.setMatrixAt(index,matrix.makeTranslation(x,(tip+overlap)/2,z)));
      dockPreviewGroup.add(tips);
    }
    if(remainingSockets.length)dockPreviewGroup.add(socketRings(remainingSockets,0x44d59a));
    if(startingSockets.length)dockPreviewGroup.add(socketRings(startingSockets,0xe68a16,.122));
  }
  function renderBoardHolePicker(){
    const holes=boardHolePicker?.holes??[];
    const key=holes.join('|');
    if(boardHolePickerGroup.userData.key!==key){
      boardHolePickerGroup.userData.key=key;
      disposeTree(boardHolePickerGroup);
      const positions=holes.map(endpoint=>endpoints.get(endpoint)?.position).filter(Boolean);
      if(positions.length){
        const rings=socketRings(positions,0x246cc9,.123);
        rings.renderOrder=17;
        boardHolePickerGroup.add(rings);
      }
    }
    showDockPreview(boardHolePicker?.preview??null,false);
    requestFrame();
  }
  function setBoardHolePicker(picker){
    if(inspection)return;
    if(Boolean(picker)!==Boolean(boardHolePicker)){
      cancelInteraction();
      boardHoleHover=null;
    }
    if(!picker?.holes.includes(boardHoleKeyboard)||
      (picker.selectedHole&&picker.selectedHole!==boardHolePicker?.selectedHole))boardHoleKeyboard=null;
    boardHolePicker=picker;
    if(!picker?.holes.includes(boardHoleHover))boardHoleHover=null;
    renderer.domElement.toggleAttribute('data-board-hole-picker',Boolean(picker));
    renderBoardHolePicker();
    refreshConnectionStatus();
  }
  function boardHoleAt(event){
    const r=renderer.domElement.getBoundingClientRect(),radius=event.pointerType==='touch'?16:11;
    if(!r.width||!r.height||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)return null;
    let nearest=null,best=radius*radius;
    for(const endpoint of boardHolePicker.holes){
      const point=endpoints.get(endpoint)?.position.clone().project(camera);
      if(!point||point.z < -1||point.z>1)continue;
      const dx=r.left+(point.x+1)*r.width/2-event.clientX,dy=r.top+(1-point.y)*r.height/2-event.clientY;
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
    const surface=renderer.domElement;
    if((event.composedPath?.()[0]??event.target)!==surface||surface.ownerDocument.activeElement!==surface)return;
    const step=sceneRotationStep(event);
    if(step&&!down&&!touchCamera&&!spacePan&&!circuit?.board?.locked&&hooks.onRotateBoard){
      event.preventDefault();event.stopPropagation();hooks.onRotateBoard(step);return;
    }
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(event.key)){
      if(event.shiftKey)return;
      event.preventDefault();
      if(down||touchCamera||spacePan)return;
      const entries=boardHolePicker.holes.flatMap(id=>{
        const point=endpoints.get(id)?.position.clone().project(camera);
        return point?[{id,x:point.x,y:-point.y}]:[];
      });
      const action=boardHoleKeyAction(boardHolePicker,boardHoleKeyboard,entries,event.key,event.repeat);
      if(action?.preview)hoverBoardHole(action.preview,true);
      else if(action?.choose)hooks.onBoardHoleChoose?.(action.choose);
      return;
    }
    if(event.code==='Space'){spacePan=true;controls.mouseButtons.LEFT=THREE.MOUSE.PAN;event.preventDefault();}
    else if(event.key==='+'||event.key==='='){zoomBy(.84);event.preventDefault();}
    else if(event.key==='-'){zoomBy(1.2);event.preventDefault();}
    else if(event.key==='Home'||event.key==='0'){cameraHome(true);event.preventDefault();}
    else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();}
  }
  function showPartContext(event){
    event.preventDefault();
    if(inspection||cameraMode!=='edit'||boardHolePicker||hooks.isPartPlacing?.()||hooks.isProbePicking?.())return;
    if(rightDown&&Math.hypot(event.clientX-rightDown.x,event.clientY-rightDown.y)>5)return;
    const hit=pick(event);
    if(hooks.onPickCandidates&&['orbit','move'].includes(mode)&&!pendingPin&&!reconnectPending){
      const bounds=renderer.domElement.getBoundingClientRect();
      pointRay(event,bounds);
      const targets=[
        {kind:hit?.wireId?'wire':'component',id:hit?.wireId??hit?.componentId},
        ...raycaster.intersectObjects(objectTargets.concat(wireTargets),false).map(({object})=>({
          kind:object.userData.wireId?'wire':'component',id:object.userData.wireId??object.userData.componentId,
        })),
        ...screenWireHits(event,bounds,11).map(({id})=>({kind:'wire',id})),
      ];
      const candidates=distinctPickTargets(targets);
      if(candidates.length>1){cancelInteraction();hooks.onPickCandidates(candidates);return;}
    }
    if(hit?.componentId){cancelInteraction();hooks.onPartContext?.(hit.componentId);}
    else if(hit?.wireId)selectWire(hit.wireId);
  }
  function commitConnection(a,b,source,reconnect=null){
    const plan=connectionPlan(circuit,endpoints,a,b,reconnect,hooks.getWireSocketIssue);
    if(!plan.ok){connectionError=plan.message;refreshConnectionStatus();return false;}
    pendingPin=null;wireGesture=null;reconnectPending=null;connectionError='';renderConnectionPreview();
    if(plan.kind==='reconnect')hooks.onReconnectWire?.(plan.id,plan.end,plan.endpoint);
    else if(hooks.onConnect)hooks.onConnect(plan.a,plan.b,{source});else{hooks.onPin?.(plan.a);hooks.onPin?.(plan.b);}return true;
  }
  function rejectWireStart(endpoint){
    const issue=hooks.getWireSocketIssue?.(endpoint);
    if(!issue)return false;
    connectionError=issue;refreshConnectionStatus();return true;
  }
  function clickPin(endpoint){
    if(hooks.isPartPlacing?.()||hooks.isProbePicking?.())return;
    connectionError='';
    if(reconnectPending){commitConnection(pendingPin,endpoint,'click',reconnectPending);return;}
    if(pendingPin===endpoint){pendingPin=null;renderConnectionPreview();return;}
    if(pendingPin){commitConnection(pendingPin,endpoint,'click');return;}
    if(rejectWireStart(endpoint))return;
    pendingPin=endpoint;lastGroundPoint=endpoints.get(endpoint)?.position.clone();renderConnectionPreview();
  }
  function tapPin(endpoint,event,selectedOnDown=false){
    if(event.shiftKey||event.ctrlKey||event.metaKey){recentPinTap=null;if(!selectedOnDown)selectPart(endpoints.get(endpoint)?.componentId,event);return;}
    if(pendingPin){recentPinTap=null;clickPin(endpoint);return;}
    const tap={endpoint,pointerType:event.pointerType,time:event.timeStamp,x:event.clientX,y:event.clientY};
    if(isSecondPinTap(recentPinTap,tap)){recentPinTap=null;clickPin(endpoint);return;}
    recentPinTap=tap;
    if(!selectedOnDown)selectPart(endpoints.get(endpoint)?.componentId,event);
    if((mode==='orbit'||mode==='move'&&mountedAssemblyPart('mcu')&&endpoints.get(endpoint)?.componentId==='mcu')&&!spacePan&&!event.altKey)hooks.onInspectPin?.(endpoint);
  }
  function beginReconnect(wireId,end='b'){
    if(boardHolePicker||hooks.isPartPlacing?.()||hooks.isProbePicking?.())return false;
    const wire=circuit?.wires?.find(item=>item.id===wireId);if(!wire||!['a','b'].includes(end)||!endpoints.has(wire.a)||!endpoints.has(wire.b))return false;
    cancelInteraction();setSelected(wireId);pendingPin=wire[end==='a'?'b':'a'];reconnectPending={id:wireId,end};lastGroundPoint=endpoints.get(wire[end])?.position.clone();renderConnectionPreview();renderer.domElement.focus({preventScroll:true});return true;
  }
  function stopEvent(event){event.preventDefault();event.stopImmediatePropagation();}
  function capture(event){expectedCaptureRelease.delete(event.pointerId);try{renderer.domElement.setPointerCapture(event.pointerId);}catch(_){} }
  function releaseCapture(pointerId){try{if(pointerId!==undefined&&renderer.domElement.hasPointerCapture(pointerId)){expectedCaptureRelease.add(pointerId);renderer.domElement.releasePointerCapture(pointerId);}}catch(_){} }
  function lostCapture(event){if(expectedCaptureRelease.delete(event.pointerId))return;if(touches.has(event.pointerId)||[drag,wireGesture,down,activeButton].some(item=>item?.pointerId===event.pointerId))cancelInteraction();}
  function turnPot(event,press) {
    const adjustment=press.potAdjustment;
    if(adjustment.rejected)return;
    const dx=event.clientX-press.x;
    const value=dx===0?adjustment.origin:Math.round(clamp(adjustment.origin+dx/POT_DRAG_PIXELS,0,1)*100)/100;
    if(!adjustment.started){
      if(Math.abs(dx)<4||value===adjustment.origin)return;
      if(hooks.onPotAdjust(adjustment.id,'start',adjustment.origin)!==true){adjustment.rejected=true;return;}
      adjustment.started=true;
    }
    if(value===adjustment.value)return;
    adjustment.value=value;
    hooks.onPotAdjust(adjustment.id,'move',value);
  }

  function pointerDown(event) {
    if(event.button===2){rightDown={x:event.clientX,y:event.clientY};recentPinTap=null;return;}
    if(event.button!==0)return;
    if(event.pointerType==='touch'){
      stopEvent(event);
      if(touches.size>=2)return;
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){cancelInteraction(true,true);for(const pointerId of touches.keys())capture({pointerId});startTouchCamera();return;}
      capture(event);
    }
    if((drag||wireGesture||activeButton||down?.resetPress||down?.partToggle||down?.probePicking||down?.potAdjustment||down?.encoderDrag||down?.joystickDrag)&&down&&down.pointerId!==event.pointerId){cancelInteraction();return;}
    renderer.domElement.focus({preventScroll:true});keyboardPin=null;
    if(cameraMode!=='edit'||spacePan||mode==='pan'){
      if(event.pointerType==='touch')startTouchCamera();
      renderer.domElement.style.cursor='grabbing';
      return;
    }
    if(boardHolePicker){
      const endpoint=!spacePan&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey?boardHoleAt(event):null;
      if(endpoint){
        down={x:event.clientX,y:event.clientY,pointerId:event.pointerId,boardHoleEndpoint:endpoint};
        stopEvent(event);controls.enabled=false;capture(event);
        hoverBoardHole(endpoint);
      }else if(event.pointerType==='touch')startTouchCamera();
      return;
    }
    const probing=!inspection&&hooks.isProbePicking?.();
    const probeTap=probing&&!spacePan&&!event.shiftKey&&!event.ctrlKey&&!event.metaKey;
    const hit=probing?(probeTap?pick(event,true,true):null):pick(event);
    down={x:event.clientX,y:event.clientY,hit,pointerId:event.pointerId,placing:Boolean(hooks.isPartPlacing?.())};
    if(inspection){if(event.pointerType==='touch')startTouchCamera();return;}
    if(probing){
      down.probePicking=probing;
      if(hit?.kind==='pin'){
        stopEvent(event);controls.enabled=false;capture(event);
      }else if(event.pointerType==='touch')startTouchCamera();
      return;
    }
    if(hit?.kind!=='pin')recentPinTap=null;
    connectionError='';const intent=canvasIntent(hit,event);
    if(event.shiftKey||event.ctrlKey||event.metaKey){stopEvent(event);return;}
    if(mode==='pan'||spacePan){if(event.pointerType==='touch')startTouchCamera();return;}
    if(intent==='board-reset'){
      down.resetPress=true;
      stopEvent(event);controls.enabled=false;capture(event);setBoardResetPressed(true);tooltip.style.display='none';return;
    }
    if(intent==='toggle-dip'||intent==='toggle-photocell'){
      down.partToggle=true;
      stopEvent(event);controls.enabled=false;capture(event);tooltip.style.display='none';return;
    }
    if(intent==='adjust-pot'){
      const id=hit.componentId,origin=potPosition(id);
      down.potAdjustment={id,origin,value:origin,started:false};
      stopEvent(event);controls.enabled=false;capture(event);selectPart(id,event);showTip(event,hit);
      renderer.domElement.style.cursor='ew-resize';return;
    }
    if(intent==='turn-encoder'){
      down.encoderDrag={id:hit.componentId,x:event.clientX,sent:0};
      stopEvent(event);controls.enabled=false;capture(event);selectPart(hit.componentId,event);showTip(event,hit);
      renderer.domElement.style.cursor='ew-resize';return;
    }
    if(intent==='adjust-joystick'){
      const id=hit.componentId;
      down.joystickDrag=startJoystickDrag(id,event,result?.parts?.[id],joystickScreenAxes(id));
      stopEvent(event);controls.enabled=false;capture(event);selectPart(id,event);tooltip.style.display='none';
      renderer.domElement.style.cursor='grabbing';return;
    }
    if(intent==='place-pin'){
      down.placementEndpoint=hit.endpoint;
      stopEvent(event);controls.enabled=false;capture(event);tooltip.style.display='none';return;
    }
    if(intent==='reconnect'){
      const wire=circuit?.wires.find(item=>item.id===hit.wireId);if(!wire)return;stopEvent(event);controls.enabled=false;capture(event);
      wireGesture=wireGestureState(wire[hit.end],wire[hit.end==='a'?'b':'a'],{id:wire.id,end:hit.end},{point:pointerPreviewPoint(event),pointerId:event.pointerId,x:event.clientX,y:event.clientY});tooltip.style.display='none';return;
    }
    if(intent==='connect'){stopEvent(event);capture(event);tooltip.style.display='none';return;}
    if(intent==='wire'){
      if(!pendingPin&&rejectWireStart(hit.endpoint)){stopEvent(event);down=null;return;}
      stopEvent(event);controls.enabled=false;capture(event);wireGesture=wireGestureState(hit.endpoint,pendingPin,reconnectPending,{point:pointerPreviewPoint(event),pointerId:event.pointerId,x:event.clientX,y:event.clientY});tooltip.style.display='none';return;
    }
    if(intent==='press'){
      stopEvent(event);controls.enabled=false;capture(event);activeButton={id:hit.buttonId,pointerId:event.pointerId};showButtonPressed(hit.buttonId,true);selectPart(hit.componentId,event);hooks.onButton?.(hit.buttonId,true);return;
    }
    const movingHit=hit?.boardDrag??hit;
    if(intent==='drag'&&movingHit?.componentId){
      const componentId=movingHit.componentId;
      const partPlacement=down.placing&&Boolean(hooks.isPartPlacing?.(componentId));
      const relocatingPart=insertedParts.has(componentId);
      if(relocatingPart&&!partPlacement){stopEvent(event);capture(event);return;}
      const mounted=mountedAssemblyPart(componentId);
      const relocatingBoard=mounted&&componentId==='mcu'&&allowBoardDrag()&&!pendingPin&&!reconnectPending;
      if(mounted&&!relocatingBoard&&!canMoveAssembly()){stopEvent(event);capture(event);selectPart(componentId,event);return;}
      const id=mounted&&!relocatingBoard?'breadboard':componentId;
      const boardDrop=!partPlacement&&allowBoardDrag()&&(id==='mcu'||id==='breadboard'&&!mounted);
      const planeY=partPlacement?breadboardDimensions.coverTop:boardDrop||id==='mcu'?movingHit.point?.y??0:0;
      const part=getPart(id),group=componentGroups.get(id),point=positionOnGround(event,planeY);
      if(!group||part?.locked)return;
      const boardScreen=boardDrop?boardScreenProjection(movingHit.point||group.position):null;
      if(!point&&!boardScreen)return;
      const attachmentIds=id==='breadboard'?[...(mounted?['mcu']:[]),...insertedParts]:[];
      const attachments=attachmentIds.flatMap(id=>{
        const attached=componentGroups.get(id);
        return attached?[{id,group:attached,origin:attached.position.clone()}]:[];
      });
      const boardGroup=boardDrop&&id==='breadboard'?componentGroups.get('mcu'):null;
      const dockBoard=boardGroup?{group:boardGroup,origin:boardGroup.position.clone(),rotation:boardGroup.rotation.y}:null;
      const lead=!partPlacement&&part?.type&&part.type!=='power'?endpoints.get(part.id+':'+componentPins(part,PARTS[part.type])[0]?.id):null;
      const holes=lead?[...endpoints].filter(([id,record])=>id.startsWith('bb:')&&!record.hidden).map(([id,record])=>({id,x:record.position.x,z:record.position.z})):[];
      const leadOffset=lead?.position.clone().sub(group.position);
      stopEvent(event);controls.enabled=false;capture(event);pendingPin=null;reconnectPending=null;renderConnectionPreview();
      const selectedOnDown=!partPlacement&&!hit.boardDrag;
      const boardAnchor=relocatingBoard?movingHit.anchor:undefined;
      const boardAnchorOffset=boardAnchor?endpoints.get(boardAnchor)?.position.clone().sub(group.position):null;
      const threshold=relocatingBoard?clamp(boardScreen.pitch/2,2,4):4;
      const offset=point?group.position.clone().sub(point):null;
      const grabOffset=group.position.clone().sub(movingHit.point??group.position);
      drag={id,group,origin:group.position.clone(),rotation:group.rotation.y,offset,grabOffset,planeY,attachments,dockBoard,boardDrop,boardScreen,boardAnchor,boardAnchorOffset,threshold,partPlacement,relocatingPart,relocatingBoard,leadOffset,holes,selectedOnDown,started:false,x:event.clientX,y:event.clientY,pointerId:event.pointerId,lastPointer:event};
      if(selectedOnDown)selectPart(componentId,event);
      tooltip.style.display='none';return;
    }
    if(event.pointerType==='touch')startTouchCamera();
  }
  const touchSpherical=new THREE.Spherical(),touchOffset=new THREE.Vector3(),panOffset=new THREE.Vector3();
  function startTouchCamera(){
    const [a,b]=touches.values();
    touchCamera=a?{x:b?(a.x+b.x)/2:a.x,y:b?(a.y+b.y)/2:a.y,distance:b?Math.max(12,Math.hypot(a.x-b.x,a.y-b.y)):null}:null;
  }
  function moveTouchCamera(){
    const previous=touchCamera;startTouchCamera();
    const {x,y,distance}=touchCamera,dx=x-previous.x,dy=y-previous.y,height=Math.max(1,stage.clientHeight);
    touchOffset.copy(camera.position).sub(controls.target);
    if(distance!==null&&previous.distance!==null){
      zoomBy(previous.distance/distance);
    }else if(!isCameraPanning()){
      touchSpherical.setFromVector3(touchOffset);
      touchSpherical.theta-=dx*TAU/height;
      touchSpherical.phi=clamp(touchSpherical.phi-dy*TAU/height,.01,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(touchOffset.setFromSpherical(touchSpherical));
      controls.update();return;
    }
    panViewPixels(dx,dy);
  }
  function panViewPixels(dx,dy){
    const scale=2*controls.getDistance()*Math.tan(camera.fov*Math.PI/360)/Math.max(1,stage.clientHeight);
    panOffset.setFromMatrixColumn(camera.matrix,0).multiplyScalar(-dx*scale);
    panOffset.addScaledVector(touchOffset.setFromMatrixColumn(camera.matrix,1),dy*scale);
    camera.position.add(panOffset);controls.target.add(panOffset);controls.update();
  }
  function rotateDrag(step){
    const delta=step*Math.PI/180;
    const angle=drag.rotationDegrees??Math.round(THREE.MathUtils.radToDeg(drag.rotation));
    drag.rotationDegrees=(angle+step+360)%360;
    const rotatedGrab=drag.grabOffset.clone().applyAxisAngle(groundPlane.normal,THREE.MathUtils.degToRad(drag.rotationDegrees)-drag.rotation);
    drag.grabShift=rotatedGrab.sub(drag.grabOffset);
    drag.offset?.applyAxisAngle(groundPlane.normal,delta);
    drag.leadOffset?.applyAxisAngle(groundPlane.normal,delta);
    pointerMove(drag.lastPointer);
  }
  function pointerMove(event) {
    if(event.pointerType==='touch'&&touches.has(event.pointerId)){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touchCamera){moveTouchCamera();return;}
    }
    if(inspection){
      const hit=down?null:pick(event);
      const hover=hit?.kind==='pin'?hit.endpoint:null;
      if(hover!==hoverEndpoint){hoverEndpoint=hover;update(result,state);}
      showTip(event,hit);
      renderer.domElement.style.cursor=down?'grabbing':hit?.kind==='pin'||hit?.kind==='inspection-chip'?'pointer':'grab';
      return;
    }
    if(cameraMode!=='edit'){
      renderer.domElement.style.cursor=event.buttons?'grabbing':'grab';
      return;
    }
    if(boardHolePicker){
      if(down?.boardHoleEndpoint&&down.pointerId===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>=5)down.boardHoleMoved=true;
      if(!down&&!event.buttons&&!spacePan&&event.pointerType!=='touch')hoverBoardHole(boardHoleAt(event));
      renderer.domElement.style.cursor=down||boardHoleHover?'crosshair':'grab';
      return;
    }
    if(down?.probePicking||hooks.isProbePicking?.()){
      if(down?.probePicking&&down.pointerId===event.pointerId&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>=5)down.probeMoved=true;
      const hit=down||spacePan?null:pick(event,true,true),hover=hit?.endpoint??null;
      if(hover!==hoverEndpoint){hoverEndpoint=hover;update(result,state);}
      showTip(event,hit);
      renderer.domElement.style.cursor=hit?'crosshair':down?'grabbing':'grab';
      return;
    }
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
    if(down?.potAdjustment){
      if(event.pointerId===down.pointerId){
        const press=down;
        turnPot(event,press);
        if(down===press)showTip(event,press.hit);
      }
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
    if(activeButton){if(!activeButton.keyboard&&event.pointerId===activeButton.pointerId){const hit=pick(event);if(hit?.kind!=='button'||hit.buttonId!==activeButton.id){releaseButton();down=null;}}return;}
    if(drag){
      if(event.pointerId!==drag.pointerId)return;
      drag.lastPointer=event;
      if(drag.id==='mcu'&&drag.boardDrop&&!pointerInsideSurface(renderer.domElement,event)){
        if(drag.boardPointer){
          drag.boardPointer=null;
          drag.boardHit=null;
          showDockPreview(null);
          hooks.onBoardDragEnd?.();
          refreshConnectionStatus();
        }
        return;
      }
      if(!drag.started&&drag.rotationDegrees===undefined&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<drag.threshold)return;
      const position=dragPosition(event,drag);if(!position)return;
      if(!drag.started&&down?.hit?.boardDrag)selectPart(drag.id,event);
      drag.started=true;recentPinTap=null;
      const snap=snapEnabled&&!event.altKey&&drag.leadOffset?snapToBreadboard(position,drag.leadOffset,drag.holes):null;
      drag.position=position;
      if(drag.boardDrop){
        const surfacePoint=boardDropPointer(event,drag,position);
        drag.boardPointer={x:event.clientX,y:event.clientY,surfacePoint};
        drag.boardHit=hooks.onBoardDrag?hooks.onBoardDrag(position.x,position.z,surfacePoint,drag.id,drag.rotationDegrees)??null:undefined;
      }
      const candidate=drag.boardHit?.candidate;
      const target=candidate?.pose;
      const boardTarget=drag.id==='mcu'?target:null;
      const next=boardTarget||candidate?.breadboard||snap||position;snappedPin=snap?.id||null;
      const angle=drag.rotationDegrees===undefined?drag.rotation:THREE.MathUtils.degToRad(drag.rotationDegrees);
      drag.group.rotation.y=boardTarget?THREE.MathUtils.degToRad(boardTarget.rotation):angle;
      const height=drag.relocatingPart?drag.origin.y+breadboardDimensions.coverTop-breadboardDimensions.coverBottom
        :boardTarget||drag.relocatingBoard&&!drag.boardHit?.rest?breadboardDimensions.coverTop+DOCK_PREVIEW_LIFT:drag.id==='mcu'?freeBoardHeight(next,angle):drag.id==='breadboard'?drag.origin.y:baseHeight(next.x,next.z);
      drag.group.position.set(next.x,height,next.z);
      moveAttachments(drag,next.x,next.z);
      if(drag.dockBoard){
        const {group,origin,rotation}=drag.dockBoard;
        const boardPosition=target||origin;
        group.rotation.y=target?target.rotation*Math.PI/180:rotation;
        group.position.set(boardPosition.x,target?breadboardDimensions.coverTop+DOCK_PREVIEW_LIFT:freeBoardHeight(boardPosition,rotation,next),boardPosition.z);
      }
      if(drag.relocatingPart){
        // Keep the seated jumper endpoints visible until the move is confirmed.
        drag.group.updateMatrixWorld(true);
        syncProbeMarkers();
      }else{
        updateEndpointPositions();
        if(drag.boardDrop)showDockPreview(drag.boardHit);
        drag.wirePreviewDirty=true;
      }
      selectionBoxes.get(drag.id)?.update();for(const {id} of drag.attachments)selectionBoxes.get(id)?.update();refreshConnectionStatus();update(result,state);requestFrame(true);renderer.domElement.style.cursor='grabbing';
      if(drag.partPlacement){
        drag.placementPointer={x:event.clientX,y:event.clientY};
        hooks.onPartPlacementDrag?.(drag.id,position.x,position.z);
      }
      return;
    }
    lastGroundPoint=pointerPreviewPoint(event);
    if(wireGesture){
      if(event.pointerId!==wireGesture.pointerId)return;connectionError='';
      if(Math.hypot(event.clientX-wireGesture.x,event.clientY-wireGesture.y)>=4)wireGesture.dragging=true;
      wireGesture.point=lastGroundPoint;const target=pick(event,true)?.endpoint;wireGesture.target=target!==wireGesture.start?target:null;hoverEndpoint=wireGesture.target;renderConnectionPreview();renderer.domElement.style.cursor='crosshair';return;
    }
    const hit=pick(event),hover=hit?.kind==='pin'?hit.endpoint:null;if(hover!==hoverEndpoint){hoverEndpoint=hover;update(result,state);}showTip(event,hit);
    if(pendingPin){connectionError='';renderConnectionPreview();}
    const intent=canvasIntent(hit,event);
    const owner=hit?.boardDrag?.componentId??hit?.componentId;
    const draggable=intent==='drag'&&(!insertedParts.has(owner)||hooks.isPartPlacing?.(owner))
      &&(!mountedAssemblyPart(owner)||owner==='mcu'&&allowBoardDrag()||canMoveAssembly());
    renderer.domElement.style.cursor=intent==='adjust-pot'||intent==='turn-encoder'?'ew-resize':intent==='place-pin'||intent==='wire'||intent==='connect'||intent==='reconnect'?'crosshair':intent==='pan'||intent==='adjust-joystick'||draggable?'grab':hit?'pointer':'default';
  }
  function pointerUp(event) {
    if(event.pointerType==='touch'&&touches.delete(event.pointerId)){
      const wasCamera=touchCamera;
      releaseCapture(event.pointerId);
      if(wasCamera){startTouchCamera();if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>=5){down=null;return;}}
    }
    if(cameraMode!=='edit'){
      renderer.domElement.style.cursor='grab';
      return;
    }
    if(inspection){
      if(down?.pointerId!==event.pointerId||event.button!==0)return;
      const {hit,x,y}=down;down=null;
      if(Math.hypot(event.clientX-x,event.clientY-y)>=5)return;
      if(hit?.kind==='pin'){
        const id=hit.endpoint.slice(4);
        setInspectionPin(id);hooks.onInspectionPin?.(id);
      }
      if(hit?.kind==='inspection-chip')hooks.onInspectionChip?.();
      return;
    }
    if(boardHolePicker){
      if(down?.pointerId!==event.pointerId)return;
      const press=down;down=null;controls.enabled=true;releaseCapture(event.pointerId);
      if(event.button===0&&!press.boardHoleMoved&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<5&&
        boardHoleAt(event)===press.boardHoleEndpoint)hooks.onBoardHoleChoose?.(press.boardHoleEndpoint);
      return;
    }
    if(down?.probePicking){
      if(down.pointerId!==event.pointerId)return;
      const pressed=down;down=null;controls.enabled=true;releaseCapture(event.pointerId);
      const endpoint=pressed.hit?.endpoint;
      if(event.button===0&&endpoint&&!pressed.probeMoved&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<5&&
        hooks.isProbePicking?.()===pressed.probePicking&&pick(event,true,true)?.endpoint===endpoint)hooks.onProbePin?.(endpoint);
      return;
    }
    if(down?.resetPress){
      if(down.pointerId!==event.pointerId)return;
      const reset=event.button===0&&boardResetTap(down,event)&&pick(event)?.kind==='board-reset';
      down=null;controls.enabled=true;releaseCapture(event.pointerId);setBoardResetPressed(false);
      if(reset)hooks.onBoardReset?.();
      return;
    }
    if(down?.partToggle){
      if(down.pointerId!==event.pointerId)return;
      const press=down,hit=event.button===0&&boardResetTap(press,event)?pick(event):null;
      down=null;controls.enabled=true;releaseCapture(event.pointerId);
      if(hit?.kind===press.hit.kind&&hit.componentId===press.hit.componentId&&hit.index===press.hit.index){
        selectPart(hit.componentId,event);
        if(hit.kind==='dip-slider')hooks.onDipSwitch?.(hit.componentId,hit.index);
        else hooks.onPhotocellCover?.(hit.componentId);
      }
      return;
    }
    if(down?.potAdjustment){
      if(down.pointerId!==event.pointerId)return;
      const press=down,adjustment=press.potAdjustment;
      if(event.button===0)turnPot(event,press);
      if(down!==press)return;
      down=null;controls.enabled=true;releaseCapture(event.pointerId);
      tooltip.style.display='none';renderer.domElement.style.cursor='default';
      if(adjustment.started)hooks.onPotAdjust(adjustment.id,event.button===0?'commit':'cancel',event.button===0?adjustment.value:adjustment.origin);
      return;
    }
    if(down?.encoderDrag){
      if(down.pointerId!==event.pointerId)return;
      const press=down;
      if(event.button===0)moveEncoderShaft(press.encoderDrag,event.clientX,hooks.onEncoderTurn);
      if(down!==press)return;
      down=null;controls.enabled=true;releaseCapture(event.pointerId);
      tooltip.style.display='none';renderer.domElement.style.cursor='default';return;
    }
    if(down?.joystickDrag){
      if(down.pointerId!==event.pointerId)return;
      const joystick=down.joystickDrag;
      down=null;controls.enabled=true;releaseCapture(event.pointerId);
      tooltip.style.display='none';renderer.domElement.style.cursor='default';
      releaseJoystickCap(joystick,hooks.onJoystickMove);return;
    }
    if(activeButton){
      if(event.pointerId!==undefined&&activeButton.pointerId!==event.pointerId)return;
      down=null;releaseButton();return;
    }
    if(drag){
      if(event.pointerId!==undefined&&drag.pointerId!==event.pointerId)return;
      if(event.button!==0||drag.id==='mcu'&&drag.boardDrop&&!pointerInsideSurface(renderer.domElement,event)){
        cancelInteraction();return;
      }
      // A quick drag may reach pointerup before the browser sends a move.
      if(!drag.started&&drag.relocatingBoard)pointerMove(event);
      if(!drag)return;
      const moved=drag,pressed=down?.hit;drag=null;down=null;snappedPin=null;controls.enabled=true;releaseCapture(moved.pointerId);
      if(moved.started){
        const boardDrop=moved.boardDrop;
        const last=moved.boardPointer??moved.placementPointer;
        const samePointer=last?.x===event.clientX&&last?.y===event.clientY;
        const position=boardDrop||moved.partPlacement
          ? samePointer?moved.position:dragPosition(event,moved)
          : moved.group.position;
        const surfacePoint=boardDrop?(samePointer?last.surfacePoint:boardDropPointer(event,moved,position)):null;
        const hit=boardDrop?(samePointer?moved.boardHit:position&&hooks.onBoardDrag
          ? hooks.onBoardDrag(position.x,position.z,surfacePoint,moved.id,moved.rotationDegrees)??null : undefined):undefined;
        const x=position&&Math.round(position.x*1000)/1000,z=position&&Math.round(position.z*1000)/1000;
        if(boardDrop||moved.partPlacement||moved.rotationDegrees!==undefined||moved.attachments.length||moved.id==='breadboard'&&insertedParts.size)restoreDragPose(moved);
        else moved.group.position.set(x,['mcu','breadboard'].includes(moved.id)?moved.origin.y:baseHeight(x,z),z);
        updateEndpointPositions();rebuildWires();refreshSelection();
        if(boardDrop){showDockPreview(null);hooks.onBoardDragEnd?.();}
        if(position){
          if(boardDrop)hooks.onBoardDrop(x,z,hit?.mount??null,surfacePoint,moved.id,hit,moved.rotationDegrees);
          else if(moved.partPlacement)hooks.onPartPlacementDrop?.(moved.id,position.x,position.z);
          else hooks.onMove?.(moved.id,x,z,moved.rotationDegrees);
        }else if(moved.partPlacement)hooks.onPartPlacementDragCancel?.(moved.id);
      }
      else if(!moved.partPlacement&&Math.hypot(event.clientX-moved.x,event.clientY-moved.y)<5){
        if(pressed?.kind==='wire')selectWire(pressed.wireId);
        else if(pressed?.kind==='pin')tapPin(pressed.endpoint,event,moved.selectedOnDown);
      }
      refreshConnectionStatus();update(result,state);renderer.domElement.style.cursor='default';return;
    }
    if(down?.placing&&down.pointerId===event.pointerId){
      const pressed=down;down=null;controls.enabled=true;releaseCapture(pressed.pointerId);
      if(pressed.placementEndpoint&&Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)<5&&hooks.isPartPlacing?.()){
        hooks.onPartPlacementPin?.(pressed.placementEndpoint);
      }
      return;
    }
    if(wireGesture){
      if(event.pointerId!==undefined&&wireGesture.pointerId!==event.pointerId)return;
      const gesture=wireGesture,target=pick(event,true)?.endpoint;wireGesture=null;down=null;controls.enabled=true;releaseCapture(gesture.pointerId);hoverEndpoint=target;
      if(gesture.dragging){if(!commitConnection(gesture.start,target,'drag',gesture.reconnect)){pendingPin=gesture.start;reconnectPending=gesture.reconnect;renderConnectionPreview();}}
      else if(gesture.reconnect){pendingPin=gesture.start;reconnectPending=gesture.reconnect;if(gesture.clickedEndpoint!==circuit?.wires?.find(w=>w.id===gesture.reconnect.id)?.[gesture.reconnect.end])clickPin(gesture.clickedEndpoint);else renderConnectionPreview();}
      else clickPin(gesture.clickedEndpoint);
      down=null;return;
    }
    if(event.button!==0)return;
    if(down?.pointerId===event.pointerId){
      if(Math.hypot(event.clientX-down.x,event.clientY-down.y)<5){const hit=down.hit;if(hit?.kind==='pin')tapPin(hit.endpoint,event);else if(hit?.kind==='wire')selectWire(hit.wireId);else if(hit?.componentId)selectPart(hit.componentId,event);else if(!pendingPin&&mode==='orbit')selectPart(null);}
      else recentPinTap=null;
    }
    releaseCapture(down?.pointerId);down=null;
  }
  function cancelInteraction(restore=true,keepTouches=false){
    if(down?.resetPress)setBoardResetPressed(false);
    const adjustment=down?.potAdjustment,joystick=down?.joystickDrag;
    const moved=drag,pointerIds=[drag?.pointerId,wireGesture?.pointerId,down?.pointerId,...touches.keys()];drag=null;wireGesture=null;down=null;pendingPin=null;recentPinTap=null;reconnectPending=null;hoverEndpoint=null;keyboardPin=null;snappedPin=null;connectionError='';touchCamera=null;controls.enabled=true;pointerIds.forEach(releaseCapture);
    if(!keepTouches)touches.clear();
    if(adjustment?.started)hooks.onPotAdjust(adjustment.id,'cancel',adjustment.origin);
    releaseJoystickCap(joystick,hooks.onJoystickMove);
    if(moved?.started){
      if(restore||moved.relocatingPart){restoreDragPose(moved);updateEndpointPositions();}
      if(restore){rebuildWires();refreshSelection();}
      if(moved.boardDrop){showDockPreview(null);hooks.onBoardDragEnd?.();}
      if(moved.partPlacement)hooks.onPartPlacementDragCancel?.(moved.id);
    }
    releaseButton();
    tooltip.style.display='none';disposeTree(previewGroup);refreshConnectionStatus();update(result,state);requestFrame();renderer.domElement.style.cursor='default';
  }
  function releaseButton(){if(!activeButton)return;const press=activeButton;activeButton=null;releaseCapture(press.pointerId);controls.enabled=true;showButtonPressed(press.id,false);hooks.onButton?.(press.id,false);}
  function pointerLeave(){if(boardHolePicker&&!down)hoverBoardHole(null);if(!drag&&!wireGesture){tooltip.style.display='none';hoverEndpoint=null;update(result,state);}}
  function cancelPointer(){spacePan=false;syncCameraMouse();cancelInteraction();}
  function focusPin(endpoint,inspect=false){
    const pin=endpoints.get(endpoint);
    if(!pin||pin.hidden||hooks.isProbePicking?.()&&!probeEndpointVisible(pin))return false;
    keyboardPin=endpoint;hoverEndpoint=endpoint;lastGroundPoint=endpoints.get(endpoint).position.clone();
    renderConnectionPreview();
    if(inspect&&mode==='orbit'&&!pendingPin&&!reconnectPending&&!hooks.isPartPlacing?.()&&!hooks.isProbePicking?.())hooks.onInspectPin?.(endpoint);
    return true;
  }
  function locatePin(endpoint){
    const pin=endpoints.get(endpoint);
    if(!pin||pin.hidden)return false;
    recentPinTap=null;
    if(!floor.visible)cameraHome(true);
    revealPin(pin.position);
    renderer.domElement.focus({preventScroll:true});
    return focusPin(endpoint);
  }
  function startWireAt(endpoint){
    const pin=endpoints.get(endpoint);
    if(inspection||boardHolePicker||hooks.isPartPlacing?.()||hooks.isProbePicking?.()||!pin||pin.hidden||rejectWireStart(endpoint))return false;
    cancelInteraction();
    locatePin(endpoint);
    clickPin(endpoint);
    return true;
  }
  function cycleSelection(direction){
    const ids=[...componentGroups.keys(),...new Set(wireTargets.map(target=>target.userData.wireId))];
    if(!ids.length)return;
    const index=ids.indexOf(selectedId);
    const next=ids[index<0?(direction>0?0:ids.length-1):(index+direction+ids.length)%ids.length];
    if(componentGroups.has(next))selectPart(next);else selectWire(next);
  }
  function keyDown(event){
    if(event.defaultPrevented||event.ctrlKey||event.metaKey)return;
    if(boardHolePicker&&(event.altKey||event.getModifierState?.('AltGraph')||event.isComposing||
      event.keyCode===229||event.shiftKey&&event.key==='Escape'))return;
    if(inspection){
      const action={ArrowLeft:()=>orbitBy(.35),ArrowRight:()=>orbitBy(-.35),ArrowUp:inspectionAngle,ArrowDown:inspectionUndersideAvailable?inspectUnderside:null,Home:()=>cameraHome(),'+':()=>zoomBy(.84),'=':()=>zoomBy(.84),'-':()=>zoomBy(1.2)}[event.key];
      if(action){event.preventDefault();action();}
      return;
    }
    const surface=renderer.domElement;
    const focused=(event.composedPath?.()[0]??event.target)===surface&&surface.ownerDocument.activeElement===surface;
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
    if(cameraMode!=='edit'){
      if(!focused||event.altKey||event.isComposing||event.keyCode===229||event.getModifierState?.('AltGraph'))return;
      if(event.key==='Escape'){
        if(hooks.onCameraExit)hooks.onCameraExit();
        else setCameraMode('edit');
        event.preventDefault();event.stopPropagation();
      }else if(direction){
        if(cameraMode==='pan')panViewPixels(-direction[0]*32,-direction[1]*32);
        else if(direction[0])orbitBy(-direction[0]*.23);
        else{
          touchOffset.copy(camera.position).sub(controls.target);
          touchSpherical.setFromVector3(touchOffset);
          touchSpherical.phi=clamp(touchSpherical.phi+direction[1]*.18,.025,controls.maxPolarAngle);
          camera.position.copy(controls.target).add(touchOffset.setFromSpherical(touchSpherical));
          controls.update();
        }
        event.preventDefault();
      }else if(event.key==='+'||event.key==='='){zoomBy(.84);event.preventDefault();}
      else if(event.key==='-'){zoomBy(1.2);event.preventDefault();}
      else if(event.key==='0'||event.key==='Home'){cameraHome(false);event.preventDefault();}
      return;
    }
    const probing=hooks.isProbePicking?.(),placing=!probing&&hooks.isPartPlacing?.(),key=event.key.toLowerCase();
    if(event.key==='Escape'){
      cancelInteraction();event.preventDefault();
      if(boardHolePicker){event.stopPropagation();hooks.onBoardHoleCancel?.();}
      else if(probing){event.stopPropagation();hooks.onCancelProbe?.();}
      return;
    }
    if(boardHolePicker){keyBoardHolePicker(event);return;}
    if(drag){
      const step=focused?sceneRotationStep(event):0;
      if(step&&!drag.partPlacement&&drag.id!=='breadboard'&&!getPart(drag.id)?.locked){
        rotateDrag(step);
        event.preventDefault();event.stopPropagation();
      }
      return;
    }
    if(down?.potAdjustment||down?.encoderDrag||down?.joystickDrag){
      if(event.key!=='Tab'){event.preventDefault();event.stopPropagation();}
      return;
    }
    if(!placing&&!probing&&(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')&&componentGroups.has(selectedId)){event.preventDefault();hooks.onPartContext?.(selectedId);return;}
    if(key==='f'){focusSelection();event.preventDefault();return;}
    if(!placing&&(event.key==='['||event.key===']')){cycleSelection(event.key===']'?1:-1);event.preventDefault();return;}
    if(probing&&(key==='p'||event.key==='Enter')){
      if(event.key==='Enter'&&keyboardPin&&probeEndpointVisible(endpoints.get(keyboardPin))){
        if(!event.repeat)hooks.onProbePin?.(keyboardPin);
      }else{
        const available=[...endpoints].filter(([,pin])=>probeEndpointVisible(pin));
        const first=available.find(([,pin])=>pin.componentId===selectedId)??available[0];
        if(first)locatePin(first[0]);
      }
      event.preventDefault();return;
    }
    if(placing&&(key==='p'||event.key==='Enter')){
      if(event.key==='Enter'&&keyboardPin&&isPlacementSocket(keyboardPin)){
        if(!event.repeat)hooks.onPartPlacementPin?.(keyboardPin);
      }else{
        const socket=[...endpoints].find(([endpoint,record])=>isPlacementSocket(endpoint)&&!record.hidden);
        if(socket)locatePin(socket[0]);
      }
      event.preventDefault();return;
    }
    if(keyboardPin&&event.key==='Enter'){if(!event.repeat)clickPin(keyboardPin);event.preventDefault();return;}
    if(keyboardPin&&direction){
      const entries=[...endpoints].map(([id,pin])=>{const p=pin.position.clone().project(camera);return {id,x:p.x,y:-p.y,hidden:pin.hidden||placing&&!isPlacementSocket(id)||probing&&!probeEndpointVisible(pin)};});
      const next=directionalEndpoint(entries,keyboardPin,direction);if(next)focusPin(next,true);
      event.preventDefault();return;
    }
    if(event.code==='Space'){event.preventDefault();const button=circuit?.components?.find(part=>part.id===selectedId&&part.type==='button');if(button&&!placing&&!probing&&mode==='orbit'){if(!event.repeat&&!activeButton){activeButton={id:button.id,keyboard:true};hooks.onButton?.(button.id,true);}}else{spacePan=true;syncCameraMouse();}return;}
    if(event.key==='+'||event.key==='='){zoomBy(.84);event.preventDefault();return;}
    if(event.key==='-'){zoomBy(1.2);event.preventDefault();return;}
    if(event.key==='0'||event.key==='Home'){cameraHome(false);event.preventDefault();return;}
    if(placing||probing){
      if(key==='delete'||key==='backspace'){event.preventDefault();event.stopPropagation();}
      return;
    }
    const boardControlsReady=(mode==='orbit'||mode==='move')&&!pendingPin&&!reconnectPending&&!wireGesture&&!drag&&!down&&!activeButton&&!spacePan;
    const rotationStep=boardControlsReady&&(selectedId!=='mcu'||focused&&!keyboardPin)?sceneRotationStep(event):0;
    if(rotationStep&&selectedId==='mcu'&&hooks.onRotateBoard&&!circuit?.board?.locked){
      event.preventDefault();hooks.onRotateBoard(rotationStep);return;
    }
    if(direction&&boardControlsReady&&selectedId==='mcu'&&mountedAssemblyPart('mcu')&&hooks.onBoardStep&&!circuit?.board?.locked&&
      !event.altKey&&!event.isComposing&&event.keyCode!==229&&!event.repeat){
      event.preventDefault();hooks.onBoardStep(...direction);return;
    }
    const wire=circuit?.wires.find(item=>item.id===selectedId);
    if(wire&&(event.key==='Delete'||event.key==='Backspace')){event.preventDefault();event.stopPropagation();if(connectionPending)return;cancelInteraction();if(hooks.onDeleteWire)hooks.onDeleteWire(wire.id);else hooks.onWire?.(wire.id);return;}
    if(wire&&(key==='a'||key==='b')){if(beginReconnect(wire.id,key))focusPin(wire[key]);event.preventDefault();return;}
    if(key==='p'||event.key==='Enter'){
      const first=[...endpoints].find(([,record])=>record.componentId===selectedId&&!record.hidden);if(first)focusPin(first[0],true);
      event.preventDefault();return;
    }
    const part=getPart(selectedId);if(!part||part.locked||part.hidden||(['mcu','breadboard'].includes(selectedId)&&mode!=='move'))return;
    if(insertedParts.has(selectedId)){
      if(rotationStep&&hooks.onPartPlacementRotate){
        event.preventDefault();
        hooks.onPartPlacementRotate(part.id,rotationStep/90);
      }
      return;
    }
    if(rotationStep&&part.id){event.preventDefault();hooks.onRotate?.(part.id,((Number(part.rotation)||0)+rotationStep+360)%360);return;}
    if(direction){
      if(selectedId==='mcu'&&mountedAssemblyPart(selectedId))return;
      event.preventDefault();
      const mounted=mountedAssemblyPart(selectedId);
      if(mounted&&!canMoveAssembly())return;
      const id=mounted?'breadboard':selectedId,position=getPart(id),step=event.shiftKey?.254:.05;
      if(position)hooks.onMove?.(id,Math.round(((position.x||0)+direction[0]*step)*1000)/1000,Math.round(((position.z||0)+direction[1]*step)*1000)/1000);
    }
  }
  function keyUp(event){if(event.code==='Space'){spacePan=false;syncCameraMouse();if(activeButton?.keyboard)releaseButton();}}
  function focusCanvas(){renderer.domElement.style.boxShadow='inset 0 0 0 2px #238f7d';}
  function blurCanvas(){renderer.domElement.style.boxShadow='';spacePan=false;syncCameraMouse();if(activeButton?.keyboard)releaseButton();if(down?.resetPress||down?.partToggle||down?.probePicking||down?.potAdjustment||down?.encoderDrag||down?.joystickDrag||drag)cancelInteraction();}
  function contextLost(event){event.preventDefault();queueMicrotask(()=>{if(!disposed)hooks.onContextLost?.();});}
  renderer.domElement.addEventListener('lostpointercapture',lostCapture);renderer.domElement.addEventListener('pointerdown',pointerDown,true);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerleave',pointerLeave);
  renderer.domElement.addEventListener('focus',focusCanvas);renderer.domElement.addEventListener('blur',blurCanvas);renderer.domElement.addEventListener('keydown',keyDown);renderer.domElement.addEventListener('keyup',keyUp);
  renderer.domElement.addEventListener('contextmenu',showPartContext);renderer.domElement.addEventListener('webglcontextlost',contextLost);
  window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',cancelPointer);window.addEventListener('blur',cancelPointer);
  function requestFrame(shadowChanged=false){
    if(disposed)return;
    if(shadowChanged===true)renderer.shadowMap.needsUpdate=true;
    if(!frameId)frameId=requestAnimationFrame(frame);
  }
  function frame(){
    frameId=0;
    if(disposed||document.hidden||stage.clientWidth<2||stage.clientHeight<2)return;
    if(drag?.wirePreviewDirty){
      const now=performance.now();
      if(now-lastWirePreview>=30){
        drag.wirePreviewDirty=false;
        lastWirePreview=now;
        rebuildWires();
        rebuildWireHandles();
      }else requestFrame();
    }
    controls.update();
    renderer.render(scene,camera);
  }
  controls.addEventListener('change',requestFrame);
  document.addEventListener('visibilitychange',requestFrame);
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();cameraHome(false);refreshConnectionStatus();
  requestFrame(true);
  return {
    view:'3d',setCircuit,update,setSelected,setPartSelection,setPartPlacementPreview,setBoardHolePicker,setProbes,cancelInteraction,locatePin,startWireAt,beginReconnect,setInspectionPin,
    setSnapEnabled(enabled){snapEnabled=enabled;},
    setMode(next){cancelInteraction();mode=['orbit','wire','move','pan'].includes(next)?next:'orbit';syncCameraMouse();refreshConnectionStatus();},
    setCameraMode,home:fitSceneOnReady,top(){cameraHome(true);},focusSelection,focusBoard:()=>focusComponent('mcu'),resize,
    dispose(){
      if(disposed)return;disposed=true;cancelInteraction(false);cancelAnimationFrame(frameId);observer.disconnect();controls.removeEventListener('change',requestFrame);controls.dispose();
      document.removeEventListener('visibilitychange',requestFrame);
      renderer.domElement.removeEventListener('lostpointercapture',lostCapture);renderer.domElement.removeEventListener('pointerdown',pointerDown,true);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerleave',pointerLeave);renderer.domElement.removeEventListener('focus',focusCanvas);renderer.domElement.removeEventListener('blur',blurCanvas);renderer.domElement.removeEventListener('keydown',keyDown);renderer.domElement.removeEventListener('keyup',keyUp);
      renderer.domElement.removeEventListener('contextmenu',showPartContext);renderer.domElement.removeEventListener('webglcontextlost',contextLost);
      window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',cancelPointer);window.removeEventListener('blur',cancelPointer);
      disposeTree(assembly);disposeTree(cableGroup);disposeTree(previewGroup);disposeTree(boardHolePickerGroup);disposeTree(dockPreviewGroup);disposeTree(partPlacementGroup);disposeTree(handleGroup);disposeTree(probeGroup);
      clearSelectionBoxes();
      floor.geometry.dispose();grid.geometry.dispose();grid.material.dispose();sharedMaterials.forEach(material=>material.dispose());environmentTarget?.dispose();
      if(inspectionPinMarker){inspectionPinMarker.material.map.dispose();inspectionPinMarker.material.dispose();}
      renderer.dispose();
      if(inspection)renderer.forceContextLoss();
      shell.remove();expectedCaptureRelease.clear();
    }
  };
}
