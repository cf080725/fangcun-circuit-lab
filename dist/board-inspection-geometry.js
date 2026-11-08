// Physical comparison variants. Coordinates in centimetres, top view with the same orientation as each photograph.
import { boardVisual } from './model-renderer.js';

const unoFeatures = [
  { type:'usb', kind:'B', x:1.28, z:-3.36, w:1.29, h:1.72 },
  { type:'barrel', x:-1.91, z:-2.97, w:.96, h:1.60 },
  { type:'button', x:2.2733, z:-2.794, w:.42, h:.42, label:'RESET', color:'#e5cf91', boardReset:true },
  { type:'ic', x:.8001, z:-1.4351, w:.53, h:.53, label:'ATmega16U2' },
  { type:'crystal', x:-.075, z:-1.56, w:.43, h:1.10, label:'16.000' },
  { type:'dip', x:-1.0287, z:1.2065, w:.78, h:3.60, label:'ATmega328P', pinsPerSide:14, rotation:180, inspectionChip:true },
  { type:'regulator', x:-1.02, z:-2.64, w:.57, h:.61, label:'5V' },
  { type:'capacitor', x:-1.79, z:-1.63, w:.67 },
  { type:'capacitor', x:-1.79, z:-.84, w:.67 },
  { type:'led', id:'onboard', x:1.5494, z:-.635, color:'#e4b545', label:'L', surfaceMount:true },
  { type:'led', id:'power-led', x:.9906, z:2.413, color:'#43b26c', label:'ON', surfaceMount:true },
  { type:'label', x:1.02, z:1.06, w:1.18, h:.54, label:'UNO' },
  { type:'label', x:.51, z:3.08, w:.55, h:.16, label:'ICSP' },
  { type:'label', x:1.67, z:-1.57, w:.62, h:.16, label:'ICSP USB' },
  { type:'label', x:-1.65, z:2.62, w:.48, h:.16, label:'ANALOG' },
  { type:'label', x:1.66, z:1.59, w:.60, h:.16, label:'DIGITAL' }
];

const espFeatures = [
  { type:'usb', kind:'micro', x:0, z:2.19, w:.78, h:.70, rotation:180 },
  { type:'button', x:-.80, z:2.02, w:.31, h:.41, label:'EN', boardReset:true, metalFrame:true },
  { type:'button', x:.80, z:2.02, w:.31, h:.41, label:'BOOT', metalFrame:true },
  { type:'ic', x:.01, z:1.18, w:.55, h:.55, label:'CP2102N', pinsPerSide:7 },
  { type:'regulator', x:-.01, z:.48, w:.57, h:.63, label:'3V3', rotation:180 },
  { type:'shield', x:0, z:-1.452, w:1.58, h:1.76, label:'ESP32-WROOM-32E', rotation:180, silkRotation:180, inspectionChip:true },
  { type:'antenna', x:0, z:-2.71, w:1.79, h:.64 },
  { type:'led', id:'power-led', x:-.80, z:1.18, w:.125, h:.20, color:'#e15f57', label:'PWR', surfaceMount:true },
  { type:'header', x:-.875, z:-.16, w:.19, h:.54, rows:4, cols:1, pitch:.137, pads:true, label:'' },
  { type:'header', x:.875, z:-.16, w:.19, h:.54, rows:4, cols:1, pitch:.137, pads:true, label:'' }
];

// Common A000005 Nano drill positions, with top features matched to the Gravitech V3.0 photo.
const nanoFeatures = [
  { type:'usb', kind:'mini', x:0, z:-1.965, w:.77, h:.96 },
  { type:'ic', x:0, z:-.66, w:.70, h:.70, label:'ATmega328P', pinsPerSide:8, bodyHeight:.09, rotation:45, inspectionChip:true },
  { type:'ic', x:.0038, z:-1.1176, w:.529, h:.986, label:'FT232RL', pinsPerSide:14, leadRows:2, bodyHeight:.15, back:true },
  { type:'crystal', x:.40, z:-.25, w:.32, h:.22, rotation:45, label:'16.000' },
  { type:'button', x:-.058, z:.239, w:.43, h:.26, label:'RST', boardReset:true },
  ...[['onboard',-.49,'#e2ad42','L'],['power-led',-.15,'#6ab97d','PWR'],
    ['nano-rx-led',.20,'#cfb776','RX'],['nano-tx-led',.475,'#cfb776','TX']].map(([id,x,color,label])=>
      ({ type:'led', id, x, z:.73, color, label, surfaceMount:true, surfaceMountScale:[.66,.72,.85] })),
  { type:'label', x:0, z:1.23, w:.94, h:.29, label:'ARDUINO\nNANO V3.0' },
  { type:'header', x:0, z:1.89484, w:.75, h:.50, rows:2, cols:3, housingHeight:.245, postHeight:.55, label:'' },
  { type:'label', x:-.48, z:1.91, w:.42, h:.13, label:'ICSP', rotation:-90 },
  { type:'label', x:-.49, z:2.073, w:.13, h:.12, label:'1' }
];

export function nanoBoardVisual(profile, photoPins) {
  const model = boardVisual(profile);
  const photos = new Map((photoPins ?? []).map(pin=>[pin.id,pin]));
  const edgePins = model.pins.map(pin=>({...pin,...photos.get(pin.id),x:pin.x,z:pin.z,
    contact:'soldered',silkLabel:pin.label}));
  const icspPins = Array.from({length:6},(_,index)=>{
    const pin=photos.get(`ICSP_${index+1}`);
    return pin&&{...pin,x:(Math.floor(index/2)-1)*.254,z:index%2?1.76784:2.02184,
      contact:'fixed-male',contactY:1.16,print:false};
  }).filter(Boolean);
  return {...model,width:1.778,height:4.318,color:'#11728b',mountHoleRadius:.08255,mountRingRadius:.095,
    holes:[[-.762,-2.032],[.762,-2.032],[-.762,2.032],[.762,2.032]],
    pins:[...edgePins,...icspPins],features:nanoFeatures};
}

// Raspberry Pi Pico Rev3 datasheet, figures 1, 3 and 4.
// https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf
const picoFeatures = [
  { type:'usb', kind:'micro', x:0, z:-2.37, w:.80, h:.62 },
  { type:'button', x:-.35, z:-1.35, w:.32, h:.425, label:'', color:'#e6e7de', squareCap:true },
  { type:'label', x:-.60, z:-1.38, w:.65, h:.12, label:'BOOTSEL', rotation:-90 },
  { type:'led', id:'onboard', x:-.57, z:-2.07, color:'#a8d56a', surfaceMount:true, surfaceMountScale:[.64,.65,.80], rotation:90 },
  { type:'label', x:-.56, z:-1.94, w:.24, h:.10, label:'LED', rotation:-90 },
  { type:'qfn', x:0, z:.05, w:.70, h:.70, label:'RP2040', contactPitch:.04, pinsPerSide:14, bodyHeight:.09, inspectionChip:true },
  { type:'qfn', x:-.38, z:-.64, w:.30, h:.20, label:'W25Q16', contactPitch:.05, pinsPerSide:4, leadRows:2, bodyHeight:.055, rotation:-90 },
  { type:'qfn', x:.29, z:-1.46, w:.25, h:.25, label:'RT6150', contactPitch:.04, pinsPerSide:4, bodyHeight:.06 },
  { type:'inductor', x:.60, z:-1.46, w:.23, h:.28 },
  { type:'smd', x:.60, z:-1.91, w:.32, h:.20, rotation:90 },
  { type:'smd', x:.29, z:-1.72, w:.20, h:.13, ceramic:true },
  { type:'smd', x:.29, z:-1.21, w:.20, h:.13, ceramic:true },
  { type:'ic', x:.64, z:-.70, w:.17, h:.105, pinsPerSide:2, leadRows:2, label:'Q1' },
  { type:'crystal', x:-.23, z:.91, w:.32, h:.25, label:'12.000' },
  ...[[.44,-.95],[.60,-.98],[.69,-1.02],[-.27,-1.90],[-.27,-1.79],[.35,-1.85],
    [-.45,-.54],[-.45,-.75],[-.46,-.31],[.43,.00],[.60,.04],[.60,-.06],
    [-.18,.62],[-.12,.70],[.00,.55],[.07,.55],[.43,.19]].map(([x,z])=>({type:'smd',x,z,w:.055,h:.046,ceramic:true})),
  ...Array.from({length:9},(_,index)=>({type:'smd',x:-.07+index*.09,z:-.46,w:.044,h:.068,ceramic:index%3!==0})),
  { type:'label', x:-.62, z:.94, w:2.08, h:.14, label:'Raspberry Pi Pico © 2020', rotation:-90 },
  { type:'label', x:0, z:2.17, w:.56, h:.13, label:'DEBUG' }
];

const picoWidth=2.1,picoHeight=5.1,picoDrill=.05,picoEdgeSegments=8;
const picoDebugPins=[
  {id:'SWD_CLK',label:'SWCLK',x:-.254},
  {id:'SWD_GND',label:'GND',x:0},
  {id:'SWD_IO',label:'SWDIO',x:.254}
].map(pin=>({...pin,z:2.39,side:'bottom',group:'SWD'}));

function picoContact(pin) {
  const end=pin.side==='bottom',edgeX=end?pin.x:Math.sign(pin.x)*picoWidth/2,edgeZ=end?picoHeight/2:pin.z;
  const distance=Math.hypot(pin.x-edgeX,pin.z-edgeZ);
  const ux=(pin.x-edgeX)/distance,uz=(pin.z-edgeZ)/distance;
  const point=(inward,along)=>[edgeX+ux*inward+uz*along,edgeZ+uz*inward-ux*along];
  const edgeArc=Array.from({length:picoEdgeSegments+1},(_,index)=>{
    const angle=Math.PI*(index/picoEdgeSegments-.5);
    return point(picoDrill*Math.cos(angle),picoDrill*Math.sin(angle));
  });
  const padRadius=.083;
  const squared=pin.canonical==='GND'||pin.label==='GND'||pin.id==='GP0';
  const inner=squared?[point(distance+padRadius,padRadius),point(distance+padRadius,-padRadius)]
    :Array.from({length:picoEdgeSegments+1},(_,index)=>{
      const angle=Math.PI*(.5-index/picoEdgeSegments);
      return point(distance+padRadius*Math.cos(angle),padRadius*Math.sin(angle));
    });
  return {...pin,contact:'castellated',holeRadius:picoDrill,
    edge:{x:edgeX,z:edgeZ,angle:Math.atan2(ux,uz)-Math.PI/2,segments:picoEdgeSegments,arc:edgeArc},
    padOutline:[point(0,-padRadius),...edgeArc,point(0,padRadius),...inner]};
}

function picoBoardVisual(model, photoPins) {
  const originals=[
    ...model.pins,
    ...picoDebugPins
  ];
  const photoById=new Map((photoPins||[]).map(pin=>[pin.id,pin]));
  const pins=originals.map(pin=>{
    const photo=photoById.get(pin.id);
    return picoContact({...pin,...photo,x:pin.x,z:pin.z,side:pin.side,silkLabel:photo?.silk||pin.label});
  });
  const w=picoWidth/2,h=picoHeight/2,c=.045;
  const edge=(side,compare)=>pins.filter(pin=>pin.side===side).sort(compare).flatMap(pin=>pin.edge.arc);
  const outline=[[-w+c,-h],[w-c,-h],[w,-h+c],
    ...edge('right',(a,b)=>a.z-b.z),[w,h-c],[w-c,h],
    ...edge('bottom',(a,b)=>b.x-a.x),[-w+c,h],[-w,h-c],
    ...edge('left',(a,b)=>b.z-a.z),[-w,-h+c]];
  return {...model,width:picoWidth,height:picoHeight,thickness:.10,color:'#0f7950',header:'castellated',
    outline,pins,features:picoFeatures,mountHoleRadius:.105,mountRingRadius:.185,
    holes:[[-.57,-2.35],[.57,-2.35],[-.57,2.35],[.57,2.35]]};
}

const variants = {
  'uno-r3': {
    features:unoFeatures, color:'#0d6c76', contact:'female',
    holes:[[2.413,-1.905],[-2.413,-2.032],[.889,3.175],[-1.905,3.175]], mountHoleRadius:.16,
    outline:[[2.53,-3.43],[2.67,-3.29],[2.67,3.11],[1.49,3.15],[1.31,3.43],[-2.22,3.43],[-2.46,3.22],[-2.67,3.22],[-2.67,-3.29],[-2.53,-3.43]],
    frame:{ width:5.85, depth:8.14, centerZ:-.39 }
  },
  'esp32-devkitc': {
    features:espFeatures, color:'#202831', contact:'soldered',
    frame:{ width:3.20, depth:5.80, centerZ:-.23 }
  }
};

export function inspectionBoardVisual(profile, photoPins) {
  if(profile.id==='pico')return picoBoardVisual(boardVisual(profile),photoPins);
  if(profile.id==='nano')return nanoBoardVisual(profile,photoPins);
  const variant=variants[profile.id];
  if(!variant)return boardVisual(profile);
  const model=boardVisual(profile);
  const pins=(photoPins?.length ? photoPins : model.pins).map(pin=>{
    const original=model.pins.find(candidate=>candidate.id===pin.id);
    const icsp=profile.id==='uno-r3' && /^ICSP_(?:USB_)?[1-6]$/.test(pin.id);
    const x=pin.modelX ?? (variant.contact==='soldered' ? -original?.x : original?.x);
    const z=pin.modelZ ?? (variant.contact==='soldered' ? -original?.z : original?.z);
    const contactY=profile.id==='uno-r3'?(icsp?1.025:1.20):undefined;
    return { ...original,...pin,x,z,contactY,contact:icsp?'male':variant.contact,print:!icsp,
      silkLabel:pin.silk||pin.label?.replace(/^GPIO(?=\d)|^D(?=\d+$)/g,'')||pin.id };
  }).filter(pin=>Number.isFinite(pin.x)&&Number.isFinite(pin.z));
  const details=model.features.filter(feature=>feature.type==='smd');
  return { ...model,...variant,pins,features:[...variant.features,...details] };
}

export function esp32BenchVisual(profile) {
  // The workbench keeps its USB-up coordinates so old wiring and insertion positions stay exact.
  const model = boardVisual(profile);
  const features = espFeatures.map(feature => ({...feature, x:-feature.x, z:-feature.z,
    rotation:['button','led'].includes(feature.type)?0:((feature.rotation||0)+180)%360}));
  return {...model, features};
}

export function inspectionCameraFrame(boardId) {
  if(boardId==='pico')return {width:2.64,depth:5.60,centerZ:-.055};
  if(boardId==='nano')return {width:2.12,depth:4.99,centerZ:-.105};
  if(boardId==='nucleo-f103rb')return {width:7.6,depth:8.9,centerZ:-.05};
  return variants[boardId]?.frame ?? {width:3.1,depth:6.04,centerZ:.12};
}
