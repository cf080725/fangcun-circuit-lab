/* Shared visual geometry. Coordinates are centimetres, USB faces -z.
 * These are editable teaching models, not manufacturing CAD. Electrical nodes
 * come only from board-profiles.js / circuit.js; a visual port adds no bus model.
 * Outline and connector references:
 * https://docs.arduino.cc/hardware/uno-rev3/
 * https://docs.arduino.cc/hardware/nano/
 * https://docs.arduino.cc/hardware/mega-2560/
 * https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html
 * https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html
 * https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html
 * https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf
 */

import { boardPose, rotateBoardPoint } from './breadboard-mount.js';
import { partMountPins, partPose } from './part-mount.js';
import { nucleoF103rbGeometry } from './nucleo-f103rb-geometry.js';
import { joystickPins } from './analog-joystick.js';

const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const BOARD_RESET_LABELS = { bluepill:'RST', 'uno-r3':'RESET', 'esp32-devkitc':'EN', nano:'RST', 'nucleo-f103rb':'B2 RESET' };
export function hardwareResetLabel(boardId) {
  return Object.hasOwn(BOARD_RESET_LABELS,boardId)?BOARD_RESET_LABELS[boardId]:undefined;
}

const BAND_COLORS = ['#242629','#74422a','#bd3f33','#e68035','#dfc044','#458852','#3779b3','#84509d','#82888d','#f1eee3'];
const BAND_NAMES = ['黑','棕','红','橙','黄','绿','蓝','紫','灰','白'];
const cleanDecimal = value => {
  const rounded=Number(value.toPrecision(14));
  return (Math.abs(rounded-value)<=Math.abs(value)*Number.EPSILON*4?rounded:value).toString();
};

/** No rounding is allowed to change the stated component value. */
export function formatResistance(value) {
  const resistance = Number(value);
  if (!Number.isFinite(resistance) || resistance < 0 || value === '') return '阻值无效';
  const scale = resistance >= 1e9 ? [1e9,'GΩ'] : resistance >= 1e6 ? [1e6,'MΩ'] : resistance >= 1e3 ? [1e3,'kΩ'] : [1,'Ω'];
  return cleanDecimal(resistance / scale[0]) + ' ' + scale[1];
}

export function formatCapacitance(microfarads) {
  const value = Number(microfarads);
  if (!Number.isFinite(value) || value < 0 || microfarads === '') return '容量无效';
  const [scale,unit] = value >= 1e6 ? [1e6,'F'] : value >= 1e3 ? [1e3,'mF'] : value > 0 && value < .001 ? [1e-6,'pF'] : value > 0 && value < 1 ? [.001,'nF'] : [1,'µF'];
  return cleanDecimal(value / scale) + ' ' + unit;
}

/** IEC-style digit/multiplier marks, following Vishay's public colour chart.
 * Four/five bands are used only when they encode the requested value exactly.
 * The tolerance band is a visual teaching example, never a solver tolerance.
 * Arbitrary values outside that notation are printed instead of mis-encoded.
 */
export function resistorVisual(partOrValue) {
  const supplied = typeof partOrValue === 'object' && partOrValue !== null ? partOrValue.resistance : partOrValue;
  const value = Number(supplied ?? 330);
  const label = formatResistance(supplied ?? 330);
  if (!Number.isFinite(value) || value < 0 || supplied === '') return {value:null,label,mode:'invalid',bands:[],note:'阻值参数无效；不绘制可能误导的色环。'};
  if (value === 0) return {value,label,mode:'jumper',bands:[{color:BAND_COLORS[0],name:'黑',kind:'jumper',digit:0}],note:'零欧跳线采用单黑环；实际器件仍有微小电阻，平台按输入参数计算。'};
  for (const count of [2,3]) {
    let exponent = Math.floor(Math.log10(value)) - count + 1;
    let digits = Math.round(value / 10 ** exponent);
    if (digits >= 10 ** count) {digits /= 10;exponent++;}
    if (exponent < -2 || exponent > 9 || !Number.isInteger(digits) || digits < 10 ** (count-1)) continue;
    const encoded = digits * 10 ** exponent;
    if (Math.abs(encoded-value) > Math.max(Number.MIN_VALUE,Math.abs(value)*1e-12)) continue;
    const bands = String(digits).split('').map(digit => ({digit:Number(digit),kind:'digit',color:BAND_COLORS[digit],name:BAND_NAMES[digit]}));
    bands.push({kind:'multiplier',exponent,color:exponent >= 0 ? BAND_COLORS[exponent] : exponent === -1 ? '#b49545' : '#b6bcc0',name:exponent >= 0 ? BAND_NAMES[exponent] : exponent === -1 ? '金' : '银'});
    const tolerance = count === 2 ? 5 : 1;
    bands.push({kind:'tolerance',percent:tolerance,color:count === 2 ? '#ba9c54' : BAND_COLORS[1],name:count === 2 ? '金' : '棕'});
    return {value,label,mode:'bands',bands,encoded,tolerance,note:bands.map(band=>band.name).join('、')+' · '+label+'。末环以 ±'+tolerance+'% 外观示意；电路计算使用输入阻值，不模拟公差。'};
  }
  return {value,label,mode:'printed',bands:[],note:label+' 不能用本模型的四环/五环精确表示，保留印字，不把数值四舍五入成错误色环。'};
}

/** Shared contact centres for both views. Leads and hit targets use these same
 * local centimetre coordinates. y is the 3D height above the component base.
 * The exposed, bent leads are a teaching arrangement, not a package footprint.
 */
export function componentPins(part, definition = {}) {
  if (part.type==='drv8833') return drv8833Visual.pins;
  if (part.type==='hcsr04') return hcsr04Visual.pins;
  if (part.type==='ssd1306') return ssd1306Visual.pins;
  if (part.type==='mcp9808') return mcp9808Visual.pins;
  if (part.type==='encoder') return encoderVisual.pins;
  if (part.type==='joystick') return joystickVisual.pins;
  if (part.type==='rgbled'&&part.rgbModel==='kingbright-wp154a4') return rgbLedVisual.pins;
  if (part.type==='grove-relay') return groveRelayVisual.pins;
  if (part.type==='dipswitch') return partMountPins(part.type);
  if (part.type==='ldr'&&part.ldrModel==='pdv-p8103') return pdvPhotoresistorVisual.pins;
  if (part.type==='motor'&&part.motorModel==='fa130-18100') return fa130Visual.pins;
  if (part.mount || part.type==='sevenseg') {
    const mountedPins = partMountPins(part.type);
    if (mountedPins.length) return mountedPins;
  }
  const rows = {
    led:[['A',-.127,.58,.055,'A +'],['K',.127,.48,.14,'K −']],
    resistor:[['1',-.71,0,.08,'1'],['2',.71,0,.08,'2']],
    button:[['1',-.42,-.19,.065],['2',-.42,.19,.065],['3',.42,-.19,.065],['4',.42,.19,.065]],
    pot:[['VCC',-.30,.65,.14],['OUT',0,.65,.14],['GND',.30,.65,.14]],
    buzzer:[['+',-.24,.64,.06],['-',.24,.64,.06,'−']],
    servo:[['GND',-.26,1.85,.20],['VCC',0,1.85,.20],['SIG',.26,1.85,.20]],
    capacitor:[['+',-.115,.62,.052],['-',.115,.51,.105,'−']],
    diode:[['A',-.70,0,.10],['K',.70,0,.10]],
    switch:[['1',-.56,0,.08],['2',.56,0,.08]],
    ldr:[['1',-.145,.53,.05],['2',.145,.53,.05]],
    thermistor:[['1',-.11,.53,.05],['2',.11,.53,.05]],
    rgbled:['R','G','B','COM'].map((id,i)=>[id,(i-1.5)*.20,id==='COM'?.76:.62,.06]),
    motor:[['+',-.236,.98,.05],['-',.236,.98,.05,'−']],
    power:[['+',-.51,1.08,.37],['-',.51,1.08,.37,'−']]
  }[part.type];
  if (rows) return rows.map(([id,x,z,y,label])=>({id,x,z,y,label:label??id}));
  return genericModuleVisual(part,definition).pins.map(pin=>({...pin,y:.08}));
}

export function componentPin(part, id, definition = {}) {
  return componentPins(part,definition).find(pin=>pin.id===id);
}

// Bourns PEC11R-4220F-S0024. The D-flat faces +Z when at rest.
export const encoderVisual = {
  width:1.25, depth:1.34, caseBottom:.39, shaftBase:1.04, shaftTop:3.04,
  shaftRadius:.30, pressTravel:.05, detentDegrees:15,
  pins:[['A',-.25,.75],['C',0,.75],['B',.25,.75],['SW1',-.25,-.70],['SW2',.25,-.70]]
    .map(([id,x,z])=>({id,x,z,y:.075,label:id})),
};

export function encoderPinDescription(pin) {
  const role={A:'正交输出 A',C:'编码器公共端',B:'正交输出 B',SW1:'按压开关 1',SW2:'按压开关 2'};
  return 'PEC11R · '+pin.id+' · '+role[pin.id];
}

export function encoderAppearance(reading) {
  const detents=Number.isFinite(reading?.detents)?reading.detents:0;
  const degrees=detents*encoderVisual.detentDegrees;
  const angle=Number.isFinite(reading?.angle)?reading.angle:(degrees%360+360)%360;
  return {angle,pressed:reading?.switchClosed===true};
}

export function moveEncoderShaft(drag, clientX, onTurn) {
  const target=Math.trunc((clientX-drag.x)/12);
  const delta=Math.max(-12,Math.min(12,target-drag.sent));
  if(!delta)return;
  const accepted=onTurn(drag.id,delta);
  if(accepted===true)drag.sent+=delta;
  else if(Number.isInteger(accepted)&&Math.sign(accepted)===Math.sign(delta)){
    drag.sent+=Math.sign(delta)*Math.min(Math.abs(accepted),Math.abs(delta));
  }
}

// SparkFun BOB-09110, COM-09032, cm. JP1 pads are ordered 5 to 1 along +Z.
export const pdvPhotoresistorVisual = {
  width:.510,depth:.430,height:.20,bodyY:.26,
  pins:[{id:'1',label:'光敏电阻端 1',x:-.17,y:.058,z:.50},{id:'2',label:'光敏电阻端 2',x:.17,y:.058,z:.50}]
};

export const joystickVisual = {
  width:2.54,depth:3.175,boardY:.355,centerZ:-.1905,pivotY:.945,capTop:2.495,
  capRadius:1.321,tiltDegrees:23,pressTravel:.025,
  pins:joystickPins.map((id,index)=>({
    id,x:(index-2)*.254,y:.355,z:1.4605,label:id==='HORIZ'?'HORZ':id,
  })),
};

export function joystickPinDescription(pin) {
  const role={VCC:'电位器供电',VERT:'垂直模拟输出',HORIZ:'水平模拟输出',SEL:'按压后接地',GND:'公共地'};
  return 'SparkFun 摇杆 · '+pin.label+' · '+role[pin.id];
}

export function joystickAppearance(reading) {
  const x=Number.isFinite(reading?.x)?reading.x:0;
  const y=Number.isFinite(reading?.y)?reading.y:0;
  const scale=Math.max(1,Math.hypot(x,y));
  return {x:x/scale,y:y/scale,pressed:reading?.pressed===true};
}

export function startJoystickDrag(id, event, reading, axes) {
  const {x,y}=joystickAppearance(reading);
  let inverse=null;
  if(axes){
    const {xx,xy,yx,yy}=axes;
    const scale=Math.max(Math.hypot(xx,xy),Math.hypot(yx,yy));
    const det=xx*yy-xy*yx;
    if(Number.isFinite(det)&&Math.abs(det)>scale*scale*.20){
      inverse={xx:yy*scale/det,xy:-yx*scale/det,yx:-xy*scale/det,yy:xx*scale/det};
    }
  }
  return {id,clientX:event.clientX,clientY:event.clientY,x,y,lastX:x,lastY:y,active:false,inverse};
}

export function moveJoystickCap(drag, event, onMove) {
  const dx=event.clientX-drag.clientX,dy=drag.clientY-event.clientY;
  if(!drag.active&&Math.hypot(dx,dy)<4)return;
  const axes=drag.inverse;
  const localX=axes?axes.xx*dx+axes.xy*dy:dx;
  const localY=axes?axes.yx*dx+axes.yy*dy:dy;
  const {x,y}=joystickAppearance({x:drag.x+localX/40,y:drag.y+localY/40});
  if(Math.hypot(x-drag.lastX,y-drag.lastY)<.004)return;
  if(onMove(drag.id,{x,y})===false)return;
  drag.lastX=x;
  drag.lastY=y;
  drag.active=true;
}

export function releaseJoystickCap(drag, onMove) {
  if(!drag?.active)return;
  drag.active=false;
  if(drag.lastX||drag.lastY)onMove(drag.id,{x:0,y:0});
}

// Only extend a compact rotor into its own visible housing. The caller
// resolves surface ownership so nearby wires and other parts stay separate.
export function nearCompactAdjuster(dx,dy,radius) {
  const touchRadius=13;
  return radius<touchRadius&&Math.hypot(dx,dy)<=touchRadius;
}

// Kingbright WP154A4SUREQBFZGW package; physical leads are clipped for the bench.
export const rgbLedVisual = {
  baseY:.62,height:.86,radius:.25,flangeRadius:.295,flatX:-.27,
  pins:[['R',-.1905,.33],['COM',-.0635,.08],['B',.0635,.18],['G',.1905,.33]]
    .map(([id,x,y],index)=>({id,x,y,z:0,label:id,number:index+1})),
  // A separated lead diagram keeps all four terminals visible in the top view.
  diagram:[['R',-.405,.44],['COM',-.135,.69],['B',.135,.59],['G',.405,.44]]
    .map(([id,x,z])=>({id,x,z})),
};

export function rgbLedPinDescription(pin) {
  const role={R:'红光阳极',COM:'共阴极 · 最长脚',B:'蓝光阳极',G:'绿光阳极'};
  return 'Kingbright RGB · '+pin.number+' 脚 '+pin.id+' · '+role[pin.id];
}

export function rgbLedLight(reading) {
  const channels=['R','G','B'].map(name=>{
    const channel=reading?.channels?.[name];
    const value=channel?.displayBrightness??channel?.brightness;
    return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  });
  const level=Math.max(...channels);
  const hue=level?channels.map(value=>value/level):channels;
  return {channels,level,hue};
}

// Grove Relay v1.2, Eagle board X/10 and −Y/10 mapped to workbench X/Z.
export const groveRelayVisual = {
  width:4,depth:2,boardY:.35,mounts:[[-1,-1],[-1,1],[2,0]],
  case:{x:.7366,z:-.00635,width:1.93,depth:1.56,height:1.54},
  grove:{x:-1.64846,z:0,width:.55,depth:.98,height:.56},
  screw:{x:-.8255,z:.4445,width:.76,depth:.762,height:.77},
  led:{x:-1.143,y:.415,z:-.6858},
  pins:[
    ['SIG',-1.64846,.86,.30,'grove'],['NC',-1.64846,.86,.10,'grove'],
    ['VCC',-1.64846,.86,-.10,'grove'],['GND',-1.64846,.86,-.30,'grove'],
    ['COM',-1.0033,.68,.8255,'screw'],['NO',-.6477,.68,.8255,'screw'],
  ].map(([id,x,y,z,connector])=>({id,x,y,z,connector,label:id})),
};

export function groveRelayState(reading) {
  return {indicator:reading?.indicator===true,closed:reading?.closed===true};
}

export function groveRelayPinDescription(pin) {
  const role={SIG:'控制信号',NC:'Grove 插座第 2 脚 · 板上未接',VCC:'模块供电',GND:'控制地',
    COM:'负载触点公共端',NO:'负载常开端'};
  return 'Grove Relay v1.2 · '+pin.id+' · '+role[pin.id];
}

// SC56 package geometry in centimetres, with the top of the digit toward −Z.
export const sevenSegmentVisual = {
  width:1.27,height:.80,depth:1.905,leadLength:.40,
  segments:{
    a:[[-.29,-.60],[-.22,-.67],[.23,-.67],[.30,-.60],[.23,-.53],[-.22,-.53]],
    b:[[.34,-.55],[.41,-.48],[.41,-.16],[.34,-.10],[.27,-.16],[.27,-.48]],
    c:[[.34,.055],[.41,.12],[.41,.44],[.34,.51],[.27,.44],[.27,.12]],
    d:[[-.29,.58],[-.22,.51],[.23,.51],[.30,.58],[.23,.65],[-.22,.65]],
    e:[[-.34,.055],[-.27,.12],[-.27,.44],[-.34,.51],[-.41,.44],[-.41,.12]],
    f:[[-.34,-.55],[-.27,-.48],[-.27,-.16],[-.34,-.10],[-.41,-.16],[-.41,-.48]],
    g:[[-.29,-.015],[-.22,-.085],[.23,-.085],[.30,-.015],[.23,.055],[-.22,.055]]
  },
  decimal:{x:.503,z:.625,radius:.075},
  offColor:'#deddd5',onColor:'#ff3025'
};

export function sevenSegmentIntensity(result, name) {
  const segment=result?.segments?.[name];
  const intensity=segment?.displayBrightness ?? segment?.brightness;
  return Number.isFinite(intensity)?Math.max(0,Math.min(1,intensity)):0;
}

export function sevenSegmentPinDescription(part, pin) {
  const common=part.common==='anode'?'公共阳极':'公共阴极';
  const purpose=pin.id==='COM'||pin.id==='COM2' ? common+' '+pin.id : pin.id==='dp'?'小数点 dp':pin.id+' 段';
  return '数码管 · '+pin.number+' 脚 · '+purpose;
}

// Pololu #2130, component-side view with both GND pads at the top.
const drv8833Rows=[
  ['GND2','VMM','BIN1','BIN2','AIN2','AIN1','SLP','FLT'],
  ['GND','VIN','BOUT1','BOUT2','AOUT2','AOUT1','AISEN','BISEN']
];
export const drv8833Visual={
  width:1.27,depth:2.032,baseY:.22,topY:.36,
  chip:{x:.055,z:.085,width:.40,depth:.40,height:.085},
  passives:[
    [.15,-.85,.32,.17,.13,'ceramic'],
    [-.19,-.80,.17,.095,.06,'dark'],
    [.23,-.55,.24,.17,.10,'dark'],
    [-.08,-.60,.19,.16,.09,'dark'],
    [-.21,-.48,.14,.09,.055,'ceramic'],
    [-.29,-.15,.12,.09,.06,'ceramic'],
    [-.30,.24,.15,.095,.06,'ceramic'],
    [-.22,.68,.16,.09,.06,'dark']
  ],
  pins:drv8833Rows.flatMap((row,side)=>row.map((id,index)=>({
    id,label:id==='GND2'?'GND':id,x:side?.508:-.508,y:.66,z:(index-3.5)*.254
  })))
};

export function drv8833PinDescription(pin) {
  const descriptions={
    GND:'电机电源地',GND2:'控制侧参考地（与电机电源地相通）',VIN:'电机电源输入',VMM:'反接保护后的电机电源',
    SLP:'低电平使驱动进入休眠',FLT:'低有效开漏故障输出',
    AISEN:'A 路电流检测，原板默认接地',BISEN:'B 路电流检测，原板默认接地'
  };
  const purpose=descriptions[pin.id]??(pin.id.includes('OUT')?'电机桥输出':'逻辑控制输入，可接 PWM');
  return 'DRV8833 · '+pin.label+' · '+purpose;
}

// Mabuchi FA-130RA-18100: front shaft points −Z and the two rear tabs face +Y.
export const fa130Visual={
  width:2.01,height:1.51,caseDepth:2.50,noseZ:-2.1907,rearZ:1.61,axisY:.755,
  pins:[{id:'+',label:'+',x:.565,y:1.555,z:.91},{id:'-',label:'−',x:-.565,y:1.555,z:.91}]
};

export function motorMotion(reading) {
  const angle=Number.isFinite(reading?.angleDeg)?reading.angleDeg:null;
  const rpm=Number.isFinite(reading?.rpm)?Math.round(Math.abs(reading.rpm)):null;
  if(rpm===null)return {angle,blur:false,speed:'— rpm',direction:'暂无读数'};
  if(rpm===0)return {angle,blur:false,speed:'0 rpm',direction:'静止'};
  const reverse=reading.rpm<0;
  return {angle,blur:Math.abs(reading.rpm)>=480,speed:(reverse?'−':'+')+rpm.toLocaleString('en-US')+' rpm',direction:reverse?'反向':'正向'};
}

// ElecFreaks HC-SR04, component side up with its four-pin header toward +Z.
export const hcsr04Visual={
  width:4.50,depth:2.00,baseY:.55,topY:.71,rimY:2.05,canRadius:.817,screenRadius:.684,
  transducers:[{id:'T',x:-1.37,z:-.035},{id:'R',x:1.37,z:-.035}],
  holes:[[-2.075,-.83],[-2.075,.83],[2.075,-.83],[2.075,.83]],
  pins:['VCC','TRIG','ECHO','GND'].map((id,index)=>({id,label:id,x:(index-1.5)*.254,y:.76,z:.81}))
};

export function hcsr04PinDescription(pin) {
  const descriptions={
    VCC:'5 V 电源输入',TRIG:'触发输入，要求至少 10 µs 高电平',
    ECHO:'5 V 回波脉冲输出，接 3.3 V 输入时需分压',GND:'电源地，与开发板共地'
  };
  return 'HC-SR04 · '+pin.id+' · '+descriptions[pin.id];
}

export function hcsr04Observation(reading) {
  const status=reading?.status;
  const transmitting=Boolean(reading?.powered&&status==='emitting');
  const receiving=Boolean(reading?.powered&&status==='echo-high'&&reading.echoLevel===1);
  if(transmitting)return {transmitting,receiving,text:'T 发射 · 40 kHz 超声'};
  if(receiving)return {transmitting,receiving,text:'R 接收 · ECHO 高电平'};
  const states={
    unpowered:'未供电',ground:'需要共地','trigger-high':'TRIG 高电平','trigger-short':'触发脉冲太短',
    cooldown:'等待下一次测距','no-target':'未收到回波',conflict:'接线或供电冲突'
  };
  const text=status==='complete'&&Number.isFinite(reading.echoWidthUs)
    ?'最近回波 '+Math.round(reading.echoWidthUs)+' µs':states[status]??'等待触发';
  return {transmitting,receiving,text};
}

// Adafruit #326 front view. The full EagleCAD outline includes mounting ears.
const oled326Arc=(x,z,start,end,steps)=>Array.from({length:steps+1},(_,index)=>{
  const angle=start+(end-start)*index/steps;
  return [x+.254*Math.cos(angle),z+.254*Math.sin(angle)];
});
const oled326Header=['Data','Clk','A0','Rst','CS','3Vo','VIN','GND'].map((label,index)=>({
  id:({Data:'SDA',Clk:'SCL',VIN:'VIN',GND:'GND'})[label],label,x:(index-3.5)*.254,y:.458,z:-1.3335
}));
export const ssd1306Visual={
  width:2.921,depth:3.175,baseY:.295,topY:.455,
  glass:{width:2.670,depth:1.926,bottomY:.475,topY:.620,z:-.1428},
  active:{width:2.1744,depth:1.0864,y:.621,z:-.3526},
  header:oled326Header,pins:oled326Header.filter(pin=>pin.id),
  mounts:[[-1.2065,-1.3335],[1.2065,-1.3335],[-1.2065,1.3335],[1.2065,1.3335]],
  outline:[...oled326Arc(-1.2065,1.3335,Math.PI,0,16),[-.9525,1.0795],[.9525,1.0795],
    ...oled326Arc(1.2065,1.3335,Math.PI,0,16),
    ...oled326Arc(1.2065,-1.3335,0,-Math.PI/2,8),
    ...oled326Arc(-1.2065,-1.3335,-Math.PI/2,-Math.PI,8)]
};

export function ssd1306PinDescription(pin) {
  const details={VIN:'模块电源输入',GND:'电源地，与开发板共地',SDA:'I²C 双向数据',SCL:'I²C 时钟'};
  const silk=pin.label===pin.id?'':' · 实物丝印 '+pin.label;
  return 'SSD1306 · '+pin.id+silk+' · '+details[pin.id];
}

// One physical raster per display, shared by the 3D texture and 2D image.
// The simulator provides the already-oriented RAM in eight vertical pages.
export function createSsd1306Raster(canvas=document.createElement('canvas')) {
  canvas.width=128;canvas.height=64;
  const context=canvas.getContext('2d'),image=context.createImageData(128,64);
  let lastBuffer,lastMode,lastContrast,litCount=0;
  function paint(reading) {
    const enabled=Boolean(reading?.powered&&reading.displayOn);
    const buffer=enabled&&reading.framebuffer?.length===1024?reading.framebuffer:null;
    const mode=!enabled?0:reading.entireDisplayOn?3:!buffer?0:reading.inverse?2:1;
    const contrast=mode&&Number.isFinite(reading.contrast)?Math.max(0,Math.min(255,reading.contrast)):255;
    if(buffer===lastBuffer&&mode===lastMode&&contrast===lastContrast)return false;
    lastBuffer=buffer;lastMode=mode;lastContrast=contrast;litCount=0;
    const brightness=.32+.68*contrast/255;
    const white=[Math.round(237*brightness),Math.round(247*brightness),Math.round(255*brightness)];
    for(let y=0;y<64;y++)for(let x=0;x<128;x++){
      const address=(y>>3)*128+x,bit=1<<(y&7);
      const ramOn=Boolean(buffer?.[address]&bit);
      const lit=mode===3||mode===2&&!ramOn||mode===1&&ramOn;
      const index=4*(y*128+x);
      if(lit)litCount++;
      image.data[index]=lit?white[0]:9;
      image.data[index+1]=lit?white[1]:13;
      image.data[index+2]=lit?white[2]:18;
      image.data[index+3]=255;
    }
    context.putImageData(image,0,0);
    return true;
  }
  return {canvas,paint,get litCount(){return litCount;}};
}

// Adafruit #5027 STEMMA QT, component side up with header toward +Z.
const mcp9808Header=['VIN','GND','SCL','SDA','ALERT','A0'].map((label,index)=>({
  id:index<4?label:null,label,x:(index-2.5)*.254,y:.163,z:.635
}));
export const mcp9808Visual={
  width:2.540,depth:1.778,pcbTop:.160,cornerRadius:.254,
  header:mcp9808Header,pins:mcp9808Header.filter(pin=>pin.id),
  mounts:[[-1.016,-.635],[1.016,-.635],[-1.016,.635],[1.016,.635]],
  connector:{x:1.0033,width:.425,depth:.610},
  chip:{width:.300,depth:.300,height:.113},
  powerLed:{x:-.8636,z:-.3683}
};

export function mcp9808PinDescription(pin) {
  const details={VIN:'电源输入',GND:'电源地，与开发板共地',SDA:'I²C 双向数据',SCL:'I²C 时钟'};
  return 'MCP9808 · '+pin.id+' · '+details[pin.id];
}

export function mcp9808Observation(reading,part) {
  const format=value=>Number(value.toFixed(4))+' °C';
  const target=reading?.targetTemperatureC??part?.temperatureC;
  const measured=reading?.powered&&Number.isFinite(reading.temperatureC)
    ? '转换值 '+format(reading.temperatureC) : reading?.powered===false?'未供电':'等待转换';
  return measured+(Number.isFinite(target)?' · 环境设定 '+format(target):'');
}

export function componentLabel(part, definition = {}) {
  const value = part.type === 'resistor' || part.type === 'pot' ? formatResistance(part.resistance ?? (part.type === 'pot' ? 10000 : 330))
    : part.type === 'capacitor' ? formatCapacitance(part.capacitance ?? 100)
    : part.type === 'power' ? cleanDecimal(Number(part.voltage) || 0)+' V' : '';
  const model=part.type==='motor'&&part.motorModel==='fa130-18100'?'FA-130RA-18100'
    :part.type==='rgbled'&&part.rgbModel==='kingbright-wp154a4'?'Kingbright WP154A4 RGB'
    :part.type==='grove-relay'?'Grove 继电器 v1.2':'';
  return [part.id, value || part.displayName || model || definition.name || part.type].filter(Boolean).join(' · ');
}

function microbitOutline(width,height,rings) {
  const x=width/2,z=height/2;
  const notch=rings.flatMap(({x})=>[[x+.18,z],[x+.12,z-.07],[x-.12,z-.07],[x-.18,z]]);
  return [[-x+.27,-z],[x-.27,-z],[x-.09,-z+.09],[x,-z+.27],[x,z-.29],
    [x-.075,z-.07],[x-.14,z],...notch,[-x+.14,z],[-x+.075,z-.07],[-x,z-.29],[-x,-z+.27],[-x+.09,-z+.09]];
}

function microbitRingPad(x,z,bottom) {
  const radius=.244;
  const crown=Array.from({length:13},(_,i)=>{
    const angle=Math.PI*i/12;
    return [x+Math.cos(angle)*radius,z-Math.sin(angle)*radius];
  });
  return [...crown,[x-radius,bottom],[x-.18,bottom],[x-.12,bottom-.07],
    [x+.12,bottom-.07],[x+.18,bottom],[x+radius,bottom]];
}

export function boardVisual(profile) {
  const style = profile.style || 'bluepill';
  const width = number(profile.width, 2.28), height = number(profile.height, 5.33);
  const nucleo = style==='nucleo'||style==='nucleo-144';
  const nucleoF103rb = profile.id==='nucleo-f103rb';
  const uno = style==='uno'||style==='uno-r4';
  const due = style==='due';
  const microbit=style==='microbit-v2',nordic=style==='nordic-dk',nordic54=nordic&&profile.boardMarking==='PCA10156';
  const ti=style==='ti-launchpad',frdm=style==='nxp-frdm',wch=style==='wch-evt',wch003=wch&&profile.id==='ch32v003-evt';
  const sbc=style==='raspberry-pi-sbc';
  const shieldHeader = uno||due||['mega','giga','stm32-discovery'].includes(style)||nucleo||ti||frdm;
  const color = ({bluepill:'#1767ae',uno:'#168b92',nano:'#168c9c',mega:'#16878e',esp32:'#273d45','esp32-c3':'#293e48',pico:'#23804d',nucleo:'#eeeee4'})[style] || profile.color || '#286f79';
  const silk = nucleo ? '#485b59' : '#edf5ef';
  const pins = Array.isArray(profile.pins) && profile.pins.length
    ? profile.pins.map(pin => ({...pin, id:String(pin.id), label:String(pin.label ?? pin.id), x:number(pin.x,0), z:number(pin.z,0)}))
    : [profile.pinsLeft || [], profile.pinsRight || []].flatMap((list,side) => list.map((entry,index) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      return {id,label:id,x:(side?1:-1)*(width/2-.127),z:(index-(list.length-1)/2)*.254,side:side?'right':'left',kind:'gpio'};
    }));
  const inset = .31;
  const ringPins=pins.filter(pin=>pin.contact==='ring');
  if(sbc)for(const pin of pins)pin.print=false;
  if(ti||frdm||wch003)for(const pin of pins)pin.printOutside=Math.abs(pin.x)>(wch003?1.30:2.20);
  for(const pin of ringPins) {
    pin.holeRadius=.205;
    pin.padOutline=microbitRingPad(pin.x,pin.z,height/2-.002);
  }
  const holes = nucleoF103rb ? nucleoF103rbGeometry.holes : microbit||wch003 ? [] : sbc
    ? [-width/2+.35,-width/2+6.15].flatMap(x=>[-height/2+.35,height/2-.35].map(z=>[x,z]))
    : ti
    ? [[-width/2+.25,-height/2+.254],[width/2-.25,-height/2+.254],[-width/2+.25,height/2-.254],[width/2-.25,height/2-.254]]
    : wch
    ? [[-.255,-.26],[.255,-.26],[-.415,.445],[.415,.445]].map(([x,z])=>[x*width,z*height])
    : frdm
    ? [[-.43,-.40],[.43,-.40],[-.43,.40],[.43,.40]].map(([x,z])=>[x*width,z*height])
    : nordic54
    ? [[-.39,-.42],[-.12,-.42],[.47,-.42],[-.43,.42],[-.12,.42],[.39,.42]].map(([x,z])=>[x*width,z*height])
    : nordic
    ? [[-.38,-.40],[.38,-.39],[-.30,-.02],[.14,-.02],[-.38,.21],[.38,.18],[.22,.44]].map(([x,z])=>[x*width,z*height])
    : width > 4
    ? [[-width/2+inset,-height/2+inset],[width/2-inset,-height/2+inset],[-width/2+inset,height/2-inset],[width/2-inset,height/2-inset]]
    : style === 'pico' ? [[-.55,-2.35],[.55,-2.35],[-.55,2.35],[.55,2.35]] : [];
  const features = [];
  const add = (type,x,z,w,h,label='',extra={}) => features.push({type,x,z,w,h,label,...extra});
  const usb = (kind,x,z) => add('usb',x,z,kind==='A'?1.40:kind==='B'?1.22:kind==='C'?.88:.78,
    kind==='A'?1.32:kind==='B'?1.52:kind==='mini'?.94:.60,kind,{kind});
  const ic = (x,z,w,h,label,pinsPerSide=8,rotation=0) => add('ic',x,z,w,h,label,{pinsPerSide,rotation});
  const button = (x,z,label,color='#293b42',buttonId) => add('button',x,z,.40,.40,label,{color,buttonId});
  const crystal = (x,z,label='16.000') => add('crystal',x,z,.70,.28,label);
  const led = (id,x,z,color,label='') => add('led',x,z,.14,.08,label,{id,color});
  if (sbc) {
    const zero=profile.id==='pi-zero-2-w',pi5=profile.id==='raspberry-pi-5';
    add('bga',-.56,.11,zero?1.3:1.64,zero?1.3:1.64,profile.mcu.split(' / ')[0]);
    if(zero){
      add('usb',-1.66,1.28,1.13,.65,'mini HDMI',{kind:'mini',rotation:180});
      for(const x of [.66,1.92])add('usb',x,1.28,.76,.58,'Micro USB',{kind:'micro',rotation:180});
      add('antenna',2.68,-.05,.58,.83);
    }else{
      add('usb',-3.12,2.56,.89,.72,'USB-C',{kind:'C',rotation:180});
      for(const x of [-1.75,-.4])add('usb',x,2.56,.74,.56,'micro HDMI',{kind:'micro',rotation:180});
      add('ethernet',3.46,pi5?-1.46:1.48,1.62,1.55,'RJ45',{rotation:90});
      for(const z of (pi5?[.24,1.78]:[-1.76,-.23]))add('usb',3.46,z,1.39,1.48,'USB-A',{kind:'A',rotation:90});
      add('bga',1.05,.28,1.03,.91,pi5?'RP1':'RAM');
    }
  } else if (uno || style === 'mega' || due) {
    const r4 = style==='uno-r4';
    usb(r4?'C':due?'micro':'B',width*.22,-height/2+((r4||due)?.20:.55));
    if(due)usb('micro',0,-height/2+.20);
    add('barrel',-width*.35,-height/2+.50,.90,1.30);
    button(width*.43,-height/2+.54,'RESET');
    if (style === 'uno') add('dip',-width*.20,.95,.72,3.40,'ATMEGA328P',{pinsPerSide:14});
    else if (r4) {
      if(profile.id==='uno-r4-wifi'){
        ic(.94,1.83,.88,.88,profile.mcu,16);
        add('shield',-.55,-2.03,1.54,1.38,'ESP32-S3-MINI-1');
        add('antenna',-.55,-3.02,1.54,.62);
        for(let row=0;row<12;row++)for(let col=0;col<8;col++)
          add('smd',-.77+(col-3.5)*.21,1.18+(row-5.5)*.21,.085,.09,'',{ceramic:true});
      } else ic(-.55,-.24,.72,.72,profile.mcu,16);
    } else {ic(0,.10,1.45,1.45,due?profile.mcu:'ATMEGA2560',due?36:25);crystal(-1.04,-.70,due?'12.000':'16.000');}
    if(!r4){
      ic(width*.15,-height/2+1.98,.55,.55,'16U2',8);
      crystal(-width*.01,-height/2+2.06);
    }
    add('regulator',-width*.18,-height/2+.70,.55,.68,'5V');
    add('capacitor',-width*.34,-height/2+1.80,.48,.48,'47');
    add('capacitor',-width*.34,-height/2+2.45,.48,.48,'47');
    add('header',0,height/2-(style==='uno'?.38:3.5),.76,.50,'ICSP',{rows:2,cols:3});
    led('onboard',width*.15,-height/2+2.82,'#dfb138','L');
    led('power-led',width*.21,style==='uno'?2.18:2.30,'#42b861','ON');
    const title = r4 ? (profile.id==='uno-r4-wifi'?'UNO R4 WiFi':'UNO R4 Minima') : style==='uno'?'UNO':due?'DUE':'MEGA 2560';
    add('label',width*.19,r4?2.85:style==='uno'?.90:1.55,1.45,.50,title,{size:14});
  } else if (style === 'nano' || style === 'nano-every') {
    const every = style==='nano-every';
    usb(every?'micro':'mini',0,-height/2+.31);
    ic(0,-.50,.70,.70,every?profile.mcu:'ATMEGA328',every?12:8,45);
    if(every)ic(0,.14,.38,.38,'SAMD11',4);
    else {
      crystal(0,.15);
      add('header',0,height/2-.45,.50,.76,'ICSP',{rows:3,cols:2});
    }
    button(0,.48,'RST');
    led('onboard',-.41,.97,'#d5ad32','L');led('power-led',.41,.97,'#41b35a','PWR');
    add('label',0,1.38,1.10,.24,every?'NANO EVERY':'NANO',{size:8});
  } else if (style==='teensy40'||style==='teensy41') {
    const long = style==='teensy41';
    usb('micro',0,-height/2+.20);
    ic(0,-height/2+1.32,.98,.98,profile.mcu,6);
    add('button',.44,-height/2+.77,.24,.24,'PROGRAM');
    led('onboard',-.49,-height/2+.70,'#d5ad32','L');
    if(long)add('smd',0,height/2-.76,1.26,1.37,'microSD');
    add('label',0,long?.48:.74,1.22,.27,long?'TEENSY 4.1':'TEENSY 4.0',{size:8});
  } else if (style==='nano-esp32') {
    usb('C',0,-height/2+.19);
    add('button',0,-1.08,.33,.27,'RST');
    ic(.22,-.37,.48,.40,'FLASH',2);
    add('shield',0,1.25,1.04,1.08,'NORA-W106',{brand:'u-blox'});
    add('antenna',0,1.98,1.04,.34);
    led('onboard',-.57,-1.99,'#d5ad32','L');
    led('power-led',.57,-1.99,'#41b35a','PWR');
  } else if (style==='nano-rp2040-connect') {
    usb('micro',0,-height/2+.16);
    ic(.10,.12,.73,.73,profile.mcu,14);
    ic(.14,-.61,.43,.43,'FLASH',2);
    add('shield',0,1.39,1.04,1.04,'NINA-W102',{brand:'u-blox'});
    add('antenna',0,2.01,1.04,.25);
    led('onboard',.57,-1.99,'#d5ad32','L');
    led('power-led',-.57,-1.99,'#41b35a','PWR');
  } else if (style==='nano-33-ble-sense-rev2') {
    usb('micro',0,-height/2+.16);
    add('button',0,-1.06,.33,.27,'RST');
    ic(0,-.31,.28,.33,'IMU',4);
    add('smd',.35,-.31,.18,.14,'',{ceramic:true});
    add('shield',0,1.23,1.04,1.10,'NINA-B306',{brand:'u-blox'});
    add('antenna',0,1.93,1.04,.38);
    led('onboard',-.56,-1.98,'#d5ad32','L');
    led('power-led',.56,-1.91,'#41b35a','PWR');
  } else if (style === 'esp32' || style === 'esp32-c3') {
    usb('micro',0,-height/2+.18);
    button(-width*.30,-height/2+.78,style==='esp32'?'BOOT':'RST');button(width*.30,-height/2+.78,style==='esp32'?'EN':'BOOT');
    ic(0,-height/2+1.10,.43,.43,style==='esp32'?'CP2102':'USB UART',7);
    add('regulator',-width*.24,-height/2+1.32,.38,.44,'3V3');
    const shieldHeight = style==='esp32'?1.82:1.30;
    add('shield',0,height/2-shieldHeight/2-.02,style==='esp32'?1.68:1.32,shieldHeight,style==='esp32'?'ESP32-WROOM-32E':'ESP32-C3-MINI-1');
    add('antenna',0,height/2+.27,style==='esp32'?1.66:1.29,.58);
    led('power-led',width*.25,-height/2+1.48,'#d84a40','PWR');
    if(style==='esp32-c3')led('onboard',.57,-.30,'#cdd4ee','RGB');
    add('label',0,height/2-.02,1.60,.13,style==='esp32'?'DEVKITC V4':'C3 DEVKITM-1',{size:5.5});
  } else if (['esp32-s3','esp32-c6','esp32-h2'].includes(style)) {
    const s3 = style==='esp32-s3', h2 = style==='esp32-h2';
    const antennaWidth = h2?1.32:1.80, antennaDepth = h2?.54:.635;
    const shieldDepth = h2?1.12:s3?1.95:1.83;
    usb(s3?'micro':'C',-.65,-height/2+.20);
    usb(s3?'micro':'C',.65,-height/2+.20);
    button(-.56,-height/2+.92,s3?'RESET':'BOOT');
    button(.56,-height/2+.92,s3?'BOOT':'RESET');
    ic(0,-height/2+1.42,.53,.53,'USB UART',7);
    add('shield',0,height/2-shieldDepth/2,antennaWidth,shieldDepth,profile.mcu);
    add('antenna',0,height/2+antennaDepth/2,antennaWidth,antennaDepth);
    add('regulator',.34,height/2-shieldDepth-.44,.38,.44,'3V3');
    led('rgb-package',-.65,height/2-shieldDepth-.65,'#d1d8e0','RGB');
    if(!s3)add('jumper',-.55,height/2-shieldDepth-.42,.45,.24,'J5');
  } else if (style === 'esp8266') {
    usb('micro',0,-height/2+.24);
    button(-.55,-height/2+.84,'FLASH');
    button(.55,-height/2+.84,'RST');
    ic(0,-height/2+1.26,.50,.50,'USB UART',7);
    add('shield',0,height/2-1.16,1.58,1.53,'ESP-12E',{brand:'NodeMCU'});
    add('antenna',0,height/2-.16,1.52,.49);
  } else if (style === 'xiao') {
    usb('C',0,-height/2+.13);
    if(profile.family==='ESP32-S3')
      add('shield',0,.07,1.14,1.12,profile.mcu,{brand:'Seeed Studio'});
    else ic(0,.12,.43,.43,profile.mcu,8);
    add('button',-.56,-.79,.19,.20,'');
    add('button',.56,-.79,.19,.20,'');
    add('header',-.49,.79,.20,.20,'',{rows:1,cols:1,pads:true});
    add('label',.14,.75,.68,.17,'XIAO');
  } else if (style === 'pico') {
    const wireless = profile.wireless===true;
    usb('micro',0,-height/2+.15);
    button(.20,-1.40,'BOOTSEL','#e0e2d7');
    ic(0,-.02,.70,.70,profile.mcu,14);
    ic(-.22,.79,.38,.30,'FLASH',4);
    crystal(.17,-.80,'12.000');
    add('regulator',-.26,1.35,.34,.43,'3V3');
    add('label',.02,wireless?1.30:1.85,1.20,.32,profile.name.replace('Raspberry Pi ','').toUpperCase(),{size:10});
    led(wireless?'radio-led':'onboard',-.37,-1.48,'#3cc273','LED');
    add('header',0,wireless?.92:height/2-.12,.76,.20,'SWD',{rows:1,cols:3,pads:true});
    if(wireless)add('antenna',0,height/2-.48,1.54,.68);
  } else if (nucleoF103rb) {
    const {b1,b2,ld2,ld3,mcu,stLink,usb:mini}=nucleoF103rbGeometry.features;
    const feature=(type,{x,z,w,h,...geometry},label,extra)=>add(type,x,z,w,h,label,{...geometry,...extra});
    feature('usb',mini,'Mini-B');
    feature('ic',stLink,'ST-LINK');
    feature('ic',mcu,profile.mcu);
    feature('button',b1,'B1',{color:'#136abb',buttonId:profile.userButton.id});
    feature('button',b2,hardwareResetLabel(profile.id),{color:'#16191c'});
    feature('led',ld2,'LD2',{id:'onboard',color:'#3cb958'});
    feature('led',ld3,'LD3',{id:'power-led',color:'#d95d4e'});
    add('divider',0,nucleoF103rbGeometry.seamZ,width-.18,.07,'ST-LINK / TARGET');
    crystal(-.936,-2.58,'8.000');
    add('label',-2.24,-3.73,1.28,.26,'NUCLEO',{size:9});
    add('label',-2.21,-3.43,1.22,.22,'F103RB',{size:8});
  } else if (nucleo) {
    usb('mini',0,-height/2+.24);
    ic(-.38,-height/2+1.46,.70,.70,'ST-LINK',12,45);
    crystal(.54,-height/2+1.42,'8.000');
    add('header',-1.52,-height/2+1.42,.50,1.02,'SWD',{rows:4,cols:2});
    add('jumper',1.45,-height/2+1.28,.30,.70,'CN2');
    add('divider',0,-height/2+2.62,width-.18,.07,'ST-LINK / TARGET');
    const zio = style==='nucleo-144', packageWidth = zio?1.78:.98;
    ic(0,.76,packageWidth,packageWidth,profile.mcu,zio?36:16,45);
    button(-.82,-.55,profile.userButton?.label || 'USER','#2387bb',profile.userButton?.id);
    button(.82,-.55,'RESET','#2d3a40');
    crystal(-.74,1.72,'8.000');
    add('regulator',.55,-1.18,.42,.48,'3V3');
    add('jumper',-.95,-1.33,.30,.50,'JP5');
    if(profile.ledPin)led('onboard',.63,1.72,'#3cb958','LD2');
    led('power-led',.95,-height/2+1.88,'#d95d4e','LD1');
    add('label',0,height/2-.51,2.55,.36,profile.name.replace(/^ST /,''),{size:10});
  } else if (style==='giga') {
    usb('A',-.16,-height/2+.57);
    usb('C',1.23,-height/2+.33);
    button(-2.39,-height/2+.34,'BOOT','#d3d6cf');
    button(2.39,-height/2+.34,'RESET','#d3d6cf');
    add('bga',.06,-.93,1.40,1.40,profile.mcu);
    add('header',.10,-3.16,2.32,.50,'CAMERA',{rows:2,cols:9});
    add('header',.09,3.21,3.06,.50,'DISPLAY',{rows:2,cols:12});
    led('onboard',-2.45,-4.18,'#42bd73','RGB');
    led('power-led',2.46,-4.06,'#3ac875','PWR');
    add('label',.26,2.27,1.88,.37,'GIGA R1 WiFi',{size:11});
  } else if (microbit) {
    add('usb',0,-height/2+.18,.78,.60,'micro',{kind:'micro',back:true});
    add('button',-1.994,.004,.58,.58,'A');add('button',1.994,.004,.58,.58,'B');
    add('touch-logo',0,-1.25,.80,.43);
    add('matrix-led',.86,-1.11,.105,.135,'',{color:'#a16058'});
    for(let row=0;row<5;row++)for(let column=0;column<5;column++)
      add('matrix-led',(column-2)*.40,-.70+row*.40,.095,.17,'',{color:'#c9978e'});
    add('qfn',1.35,-.34,.72,.72,profile.mcu,{back:true,rotation:45});
    add('qfn',-1.40,-.34,.55,.55,'USB MCU',{back:true,rotation:45});
    add('smd',0,.05,.82,.82,'SPEAKER',{back:true,rotation:45});
    add('button',-.89,-1.55,.46,.46,'RESET',{back:true});
    add('battery-socket',-1.78,-1.56,.73,.48,'JST-PH',{back:true});
    add('label',-.58,.84,1.80,.24,'micro:bit',{back:true,size:8});
  } else if (nordic) {
    const old=profile.boardMarking==='PCA10056';
    const set=(type,x,z,w,h,label,extra)=>add(type,x*width,z*height,w,h,label,extra);
    if(nordic54) {
      set('usb',-.482,.12,.88,.60,'C',{kind:'C',rotation:-90});
      set('qfn',-.32,.26,.70,.70,'J-LINK');
      set('qfn',-.32,-.23,.54,.54,'nPM1300');
      set('qfn',.35,-.05,.60,.60,profile.mcu);
      set('qfn',.28,.08,.34,.34,'FLASH');
      set('header',.00,.43,.76,.50,'SWD',{rows:2,cols:3});
      set('header',.23,-.40,.45,.25,'NFC',{rows:1,cols:2});
      for(const [i,rowZ] of [-2.06,-.78,.49].entries()) {
        const x=-.68+4.5*.254,z=rowZ+.127;
        const active=pins.filter(pin=>pin.side===`p${i}-top`||pin.side===`p${i}-bottom`);
        add('unmodeled-header',x,z,2.52,.50,'PORT P'+i,{rows:2,cols:10,active});
      }
    } else {
      usb('micro',0,-height/2+.18);
      set('usb',old?-.482:.482,old?.17:.32,.78,.60,'micro',{kind:'micro',rotation:old?-90:90});
      set('ic',-.05,-.15,1.48,1.48,'J-LINK',{pinsPerSide:24});
      set('qfn',.10,.34,.72,.72,profile.mcu);
      set('qfn',.11,.10,.51,.45,'FLASH');
      set('header',.41,.19,.50,1.90,'GPIO',{rows:8,cols:2});
      set('header',-.11,.20,.50,1.65,'TRACE',{rows:6,cols:2});
      set('jumper',-.31,-.30,.50,.35,'POWER');
    }
    for(let i=0;i<4;i++) {
      const column=i%2,row=Math.floor(i/2),index=i+(nordic54?0:1);
      button((nordic54?.25+column*.10:-.42+column*.16)*width,(nordic54?.29+row*.15:.29+row*.08)*height,'BUTTON '+index);
      led(i===0&&profile.ledPin?'onboard':'dk-led-'+i,(nordic54?.36+column*.052:.34+column*.065)*width,(nordic54?-.41+row*.06:.40+row*.04)*height,'#72a95d','LED '+index);
    }
    button((nordic54?-.44:-.41)*width,(nordic54?.27:.05)*height,'RESET');
    set('label',nordic54?-.37:0,nordic54?-.01:.47,nordic54?2.2:2.65,.25,profile.name.replace(/ · .*/,''),{size:9});
    set('label',nordic54?-.36:0,nordic54?.045:.49,1.85,.15,profile.boardMarking,{size:6});
  } else if (ti) {
    const mspm0=profile.id==='lp-mspm0g3507';
    const upper=-height/2;
    usb('micro',mspm0?-1.778:-1.68,mspm0?-4.955:upper+.23);
    ic(mspm0?-1.275:0,mspm0?-3.119:upper+height*.19,mspm0?1.23:.95,mspm0?1.23:.95,mspm0?'XDS110-ET':'eZ-FET',mspm0?16:12,mspm0?0:45);
    button(mspm0?1.74:1.83,mspm0?-5.077:upper+.40,'RESET');
    add('divider',0,upper+height*.35,width-.2,.06,'DEBUG / TARGET');
    add('header',mspm0?-.749:-.65,mspm0?-1.359:upper+height*.35,mspm0?2.24:1.92,.46,'J101',{cols:mspm0?9:7,rows:2});
    button(mspm0?-2.67:-width*.44,mspm0?-.85:upper+height*.41,'S1');
    button(mspm0?2.67:width*.44,mspm0?-.85:upper+height*.41,'S2');
    ic(mspm0?.216:0,mspm0?1.275:upper+height*.63,mspm0?1.08:.74,mspm0?1.08:.74,profile.mcu,mspm0?16:12);
    led('power-led',width*.43,upper+height*.16,'#d95047','PWR');
    if(mspm0) {
      add('header',.30,upper+height*.96,3.85,.45,'PIN EXT',{cols:15,rows:2});
      add('header',width*.453,upper+height*.88,.22,1.20,'QEI',{cols:1,rows:5});
      add('smd',-1.46,upper+height*.76,.41,.34,'THERMISTOR');
      add('qfn',-1.95,upper+height*.88,.40,.34,'OPA2365');
      led('ti-rgb',-.34,4.262,'#cebdac','RGB');
      led('ti-user',.098,4.384,'#bc574f','LED');
    } else {
      add('battery-socket',.12,upper+height*.95,.85,.53,'GROVE');
      add('smd',-1.34,upper+height*.88,.38,.30,'LIGHT');
      led('ti-led1',1.18,upper+height*.90,'#b95547','LED1');
      led('ti-led2',1.64,upper+height*.90,'#6a9c60','LED2');
    }
    add('label',0,upper+height*.70,3.32,.25,profile.boardMarking||profile.name,{size:8});
  } else if (frdm) {
    const mcx=profile.id==='frdm-mcxn947',upper=-height/2;
    usb(mcx?'C':'micro',width*.29,upper+.20);
    usb(mcx?'C':'micro',-width*.29,upper+.20);
    add('ethernet',0,upper+.56,1.62,2.06,'RJ45');
    for(const [connector,rows] of [['J1',8],['J2',10],['J3',8],['J4',6]]) {
      const active=pins.filter(pin=>pin.connector===connector);
      if(!active.length)continue;
      const sample=active[0],index=Math.floor((sample.connectorPin-1)/2);
      const row=sample.side==='right'?rows-1-index:index;
      const z=sample.z+((rows-1)/2-row)*.254;
      add('unmodeled-header',Math.sign(sample.x)*2.286,z,.49,rows*.254,connector,{rows,cols:2,contact:'female',active});
    }
    if(mcx) {
      add('bga',.04,height*.105,1.02,1.02,'MCXN947');
      add('qfn',width*.17,-height*.26,.69,.69,'LPC55S69');
      add('unmodeled-header',width*.42,height*.24,.49,4.06,'J9 CAMERA',{rows:16,cols:2,contact:'female',active:[]});
      add('unmodeled-header',0,height*.46,3.56,.49,'J8 LCD',{rows:2,cols:14,contact:'female',active:[]});
      for(const [x,name] of [[width*.27,'J5'],[-width*.14,'J6']])
        add('unmodeled-header',x,height*.295,.25,2.03,name,{rows:8,cols:1,contact:'female',active:[]});
      button(width*.43,height*.43,'WAKE');
      button(-width*.43,height*.43,'ISP');
    } else {
      ic(-width*.12,height*.23,1.48,1.48,'MK64FN1M0',25,45);
      ic(width*.20,-height*.29,.70,.70,'OpenSDA',12,45);
      add('sd-slot',-.35,height*.445,1.33,.94,'microSD',{rotation:180});
      add('header',width*.31,height*.36,.49,.95,'J6',{rows:4,cols:2,pads:true});
      button(width*.43,height*.43,'SW2');
      button(-width*.43,height*.43,'SW3');
    }
    add('qfn',-.62,upper+height*.24,.49,.49,'PHY');
    button(width*.43,upper+.33,'RESET');
    led('frdm-rgb',mcx?width*.37:-.85,height*(mcx?.10:.35),'#d6c5af','RGB');
    add('label',0,height*(mcx?.01:.425),2.04,.27,profile.boardMarking||profile.name,{size:8});
  } else if (wch) {
    const upper=-height/2;
    usb('C',0,upper+.23);
    add('slide-switch',(wch003?-.32:.36)*width,upper+height*.083,.80,.36,'POWER');
    if(wch003) {
      button(width*.32,upper+height*.105,'RESET');
      add('ic',0,height*.16,.61,.43,profile.mcu,{pinsPerSide:10,leadRows:2});
      add('header',1.2248,-.508,.50,.24,'P4',{cols:2,rows:1});
      add('regulator',-width*.26,-height*.124,.28,.20,'LDO');
      crystal(-.13,height*.31,'24 MHz');
      led('power-led',-.09,-height*.125,'#cc5040','PWR');
      led('wch-led1',width*.35,-height*.190,'#649365','LED1');
      led('wch-led2',width*.35,-height*.235,'#649365','LED2');
    } else {
      add('divider',0,upper+height*.20,width-.45,.06,'WCH-LINK / TARGET');
      add('ic',-width*.22,upper+height*.105,.54,.96,'WCH-LinkE',{pinsPerSide:10,leadRows:2,rotation:90});
      add('header',-3.0505,-4.1293,.49,1.76,'J2',{cols:2,rows:7});
      add('header',-3.048,.9606,.49,6.84,'J3',{cols:2,rows:27});
      add('header',3.048,.9606,.49,6.84,'J4',{cols:2,rows:27});
      button(-1.155,-2.37,'USER');
      button(.496,-2.37,'RESET');
      ic(.60,-.20,1.40,1.40,profile.mcu,25);
      crystal(.43,-height*.085,'8 MHz');
      add('regulator',-width*.19,height*.29,.60,.47,'3V3');
      add('ethernet',-.4445,height/2-.73,1.83,2.45,'RJ45',{rotation:180});
      add('usb',-1.78,height/2-.26,.88,.60,'C',{kind:'C',rotation:180});
      add('usb',1.78,height/2-.26,.88,.60,'C',{kind:'C',rotation:180});
      led('power-led',width*.16,upper+height*.087,'#d65046','PWR');
    }
    add('label',wch003?width*.19:width*.26,wch003?height*.472:upper+height*.212,wch003?2.25:2.07,.18,profile.boardMarking||profile.name,{size:6});
  } else if (style==='stm32-discovery') {
    usb('micro',-width*.32,-height/2+.26);
    usb('micro',width*.32,-height/2+.26);
    button(-width*.41,0,'USER','#2781a9');
    button(width*.41,0,'RESET');
    add('label',0,height/2-.51,4,.36,'32F746GDISCOVERY');
  }
  // A few ceramic passives make the scale legible without implying a PCB netlist.
  if(!microbit&&!nucleoF103rb)for(let i=0;i<7;i++)add('smd',(i%2?1:-1)*width*.20,(i-3)*Math.min(.35,height*.06),.16,.075,'',{ceramic:i%3!==0});
  let outline = nucleoF103rb ? nucleoF103rbGeometry.outline : null;
  if(uno||style==='mega') {
    const x=width/2,z=height/2;
    outline=[[-x,-z],[x-.12,-z],[x,-z+.18],[x,z-.82],[x-.20,z-.62],[x-.20,z-.16],[x-.40,z],[-x+.18,z],[-x,z-.18]];
  }
  if(microbit)outline=microbitOutline(width,height,[...ringPins].sort((a,b)=>b.x-a.x));
  if(nordic) {
    const x=width/2,z=height/2;
    outline=nordic54?[[-x,-z],[x-.12,-z],[x,-z+.12],[x,z-.90],[x-.15,z-.70],[x-.15,z],[-x+.10,z],[-x,z-.10]]:
      [[-x+.10,-z],[x-.10,-z],[x,-z+.10],[x,z-.25],[x-.10,z-.18],[1.1,z-.18],[.91,z],[-.91,z],[-1.10,z-.18],[-x+.10,z-.18],[-x,z-.27],[-x,-z+.10]];
  }
  const resetLabel = hardwareResetLabel(profile.id);
  if (resetLabel) {
    const reset = features.find(feature => feature.type === 'button' && feature.label === resetLabel);
    if (reset) reset.boardReset = true;
  }
  return {profile,style,width,height,color,silk,pins,holes,features,outline,thickness:(microbit||ti||frdm||wch||sbc) ? .16 : .14,
    ...(nucleoF103rb&&{mountHoleRadius:nucleoF103rbGeometry.mountHoleRadius}),
    usbDirection:nordic54?'←':'↑',header:microbit||style==='pico'?'pad':shieldHeader||nordic&&!nordic54?'female':'male'};
}

export function genericModuleVisual(part,definition={}) {
  const source=Array.isArray(definition.pins)&&definition.pins.length?definition.pins:Array.isArray(part.pins)&&part.pins.length?part.pins:['1','2'];
  const names=source.map(pin=>String(typeof pin==='string'?pin:pin.id??pin.name));
  const width=Math.max(1.32,Math.min(2.50,.80+names.length*.12));
  const height=Math.max(1.30,Math.ceil(names.length/2)*.254+.48);
  const pins=names.map((id,i)=>{
    const left=i<Math.ceil(names.length/2),row=left?i:i-Math.ceil(names.length/2),count=left?Math.ceil(names.length/2):Math.floor(names.length/2);
    return {id,label:id,x:(left?-1:1)*(width/2+.12),z:(row-(count-1)/2)*.254,side:left?'left':'right'};
  });
  return {width,height,pins,name:definition.name||part.type||'通用模块',tag:definition.tag||'MODULE'};
}

export function componentBounds(part,definition={}) {
  // Include exposed leads, polarity marks and captions, rather than applying
  // one fixed box to a short resistor and a tall custom module alike.
  const dimensions={led:[-.64,.64,-.43,1.0],resistor:[-.95,.95,-.32,.57],button:[-.64,.64,-.44,.73],pot:[-.72,.72,-.55,1.22],buzzer:[-.88,1.02,-.58,1.22],servo:[-1.03,1.03,-1.62,2.22],capacitor:[-.76,.76,-.38,1.02],power:[-1.18,1.18,-.94,1.30],diode:[-.85,.85,-.32,.46],switch:[-.74,.74,-.47,.72],ldr:[-.51,.51,-.42,1.00],thermistor:[-.48,.48,-.40,.97],rgbled:[-.68,.68,-.45,1.12],sevenseg:[-.72,.72,-1.15,1.15],motor:[-.74,.74,-1.42,1.20]};
  if(part.type==='motor'&&part.motorModel==='fa130-18100')return projectedPartBounds(part,[-1.12,1.12,fa130Visual.noseZ-.10,fa130Visual.rearZ+.10]);
  if(part.type==='drv8833')return projectedPartBounds(part,[-1.15,1.15,-1.05,1.05]);
  if(part.type==='hcsr04')return projectedPartBounds(part,[-2.32,2.32,-1.06,1.32]);
  if(part.type==='ssd1306')return projectedPartBounds(part,[-1.55,1.55,-1.67,1.67]);
  if(part.type==='mcp9808')return projectedPartBounds(part,[-1.37,1.37,-.99,.99]);
  if(part.type==='encoder')return projectedPartBounds(part,[-.95,.95,-1.04,1.16]);
  if(part.type==='joystick')return projectedPartBounds(part,[-1.91,1.91,-2.06,1.93]);
  if(part.type==='rgbled'&&part.rgbModel==='kingbright-wp154a4')return projectedPartBounds(part,[-.61,.61,-.54,.95]);
  if(part.type==='grove-relay')return projectedPartBounds(part,[-2.57,2.25,-1.28,1.58]);
  if(part.type==='dipswitch')return projectedPartBounds(part,[-.66,.66,-.45,.49]);
  if(part.type==='ldr'&&part.ldrModel==='pdv-p8103')return projectedPartBounds(part,[-.38,.38,-.30,.88]);
  const module=genericModuleVisual(part,definition),local=dimensions[part.type]||[-module.width/2-.42,module.width/2+.42,-module.height/2-.20,module.height/2+.60];
  return projectedPartBounds(part,local);
}

// Plan-view limits of the loose meshes in workbench.js, including metal leads
// and tabs. Labels and selection markers don't obstruct physical mounting.
const looseHardwareBounds = {
  led:[-.275,.275,-.275,.601],
  resistor:[-.733,.733,-.126,.126],
  button:[-.447,.447,-.305,.305],
  sevenseg:[-sevenSegmentVisual.width/2,sevenSegmentVisual.width/2,-sevenSegmentVisual.depth/2,sevenSegmentVisual.depth/2],
  drv8833:[-drv8833Visual.width/2,drv8833Visual.width/2,-drv8833Visual.depth/2,drv8833Visual.depth/2],
  hcsr04:[-hcsr04Visual.width/2,hcsr04Visual.width/2,-hcsr04Visual.depth/2,hcsr04Visual.depth/2],
  ssd1306:[-ssd1306Visual.width/2,ssd1306Visual.width/2,-ssd1306Visual.depth/2,ssd1306Visual.depth/2],
  mcp9808:[-mcp9808Visual.width/2,mcp9808Visual.width/2,-mcp9808Visual.depth/2,mcp9808Visual.depth/2],
  encoder:[-.74,.74,-.74,.79],
  joystick:[-1.321,1.321,-1.588,1.588],
  'grove-relay':[-2,2.23,-1.22,1.22],
  dipswitch:[-.61,.61,-.396,.396]
};

export function componentCollisionBounds(part,definition={}) {
  if(part.type==='ldr'&&part.ldrModel==='pdv-p8103')return projectedPartBounds(part,[-.255,.255,-.215,.53]);
  if(part.type==='rgbled'&&part.rgbModel==='kingbright-wp154a4'){
    const radius=rgbLedVisual.flangeRadius;
    return projectedPartBounds(part,[-radius,radius,-radius,radius]);
  }
  return Object.hasOwn(looseHardwareBounds,part.type)
    ? projectedPartBounds(part,looseHardwareBounds[part.type]) : componentBounds(part,definition);
}

function projectedPartBounds(part,local) {
  const angle=-(Number(part.rotation)||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),x=Number(part.x)||0,z=Number(part.z)||0;
  const points=[[local[0],local[2]],[local[0],local[3]],[local[1],local[2]],[local[1],local[3]]].map(([px,pz])=>[x+px*cos-pz*sin,z+px*sin+pz*cos]);
  return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
}

export function visualBounds(circuit,profile) {
  const geometry=boardVisual(profile),board=boardPose(circuit,profile),bb=circuit?.breadboard||{x:1.8,z:0};
  const extents=[-1,1].map(sign=>rotateBoardPoint(geometry.width/2,sign*geometry.height/2,board.rotation));
  const halfWidth=Math.max(...extents.map(point=>Math.abs(point.x)))+.75;
  const halfHeight=Math.max(...extents.map(point=>Math.abs(point.z)))+.75;
  let left=Math.min(board.x-halfWidth,bb.x-4.55),right=Math.max(board.x+halfWidth,bb.x+4.55);
  let top=Math.min(board.z-halfHeight,bb.z-3.05),bottom=Math.max(board.z+halfHeight,bb.z+3.05);
  for(const part of circuit?.components||[]){const bounds=componentBounds({...part,...partPose(part,bb)});left=Math.min(left,bounds.left-.20);right=Math.max(right,bounds.right+.20);top=Math.min(top,bounds.top-.20);bottom=Math.max(bottom,bounds.bottom+.20);}
  return {left,right,top,bottom,width:right-left,height:bottom-top,centerX:(left+right)/2,centerZ:(top+bottom)/2};
}

// Shared interaction decisions. They are independent of DOM, WebGL and app
// history, so cancellation, reconnection and keyboard navigation can be tested.
export function selectionDescriptor(circuit,id) {
  if(!id||!circuit)return null;
  if(circuit.wires?.some(wire=>wire.id===id))return {kind:'wire',id};
  if(id==='mcu'||id==='breadboard'||circuit.components?.some(part=>part.id===id))return {kind:'component',id};
  return null;
}

// Align one lead with a real hole. The user still makes the electrical connection.
export function snapToBreadboard(position, leadOffset, holes, radius = .16) {
  let nearest = null, best = radius * radius;
  const leadX = position.x + leadOffset.x, leadZ = position.z + leadOffset.z;
  for (const { id, x, z } of holes) {
    const distance = (leadX - x) ** 2 + (leadZ - z) ** 2;
    if (distance >= best || x - leadOffset.x < -30 || x - leadOffset.x > 30 || z - leadOffset.z < -20 || z - leadOffset.z > 20) continue;
    best = distance;
    nearest = { id, x: x - leadOffset.x, z: z - leadOffset.z };
  }
  return nearest;
}

export function sceneRotationStep(event) {
  if ((event.key!=='r' && event.key!=='R') || event.defaultPrevented || event.ctrlKey ||
      event.altKey || event.metaKey || event.getModifierState?.('AltGraph') ||
      event.isComposing || event.keyCode===229 || event.repeat) return 0;
  const target=event.composedPath?.()[0] ?? event.target;
  if (target?.isContentEditable || target?.closest?.('[contenteditable]')?.isContentEditable ||
      target?.closest?.('input, textarea, select, [role~="textbox"], [role~="searchbox"], [role~="combobox"], [role~="spinbutton"]')) return 0;
  return event.shiftKey ? -90 : 90;
}

export function pointerIntent(hit,{mode='orbit',altKey=false,spacePan=false,button=0,pendingPin=null,reconnecting=false,allowBoardDrag=false}={}) {
  if(button===1||spacePan||mode==='pan')return 'pan';
  if(hit?.kind==='wire-handle')return 'reconnect';
  if(hit?.kind==='pin'){
    if(mode==='wire'||reconnecting)return 'wire';
    if(pendingPin)return 'connect';
  }
  if(hit?.kind==='board-reset'&&mode==='orbit'&&!altKey&&!pendingPin&&!reconnecting)return 'board-reset';
  if(hit?.kind==='encoder-shaft'&&mode==='orbit'&&!altKey)return pendingPin||reconnecting?'select':'turn-encoder';
  if(hit?.kind==='joystick-cap'&&mode==='orbit'&&!altKey)return pendingPin||reconnecting?'select':'adjust-joystick';
  if(hit?.kind==='dip-slider'&&mode==='orbit'&&!altKey)return pendingPin||reconnecting?'select':'toggle-dip';
  if(hit?.kind==='photocell-face'&&mode==='orbit'&&!altKey)return pendingPin||reconnecting?'select':'toggle-photocell';
  if(hit?.kind==='button'&&mode!=='move'&&mode!=='wire'&&!altKey)return 'press';
  if(mode==='orbit'&&hit?.id==='mcu'&&allowBoardDrag&&!pendingPin&&!reconnecting)return 'drag';
  if(hit?.id&&hit.kind!=='wire'&&mode!=='wire'&&(!['mcu','breadboard'].includes(hit.id)||mode==='move'))return 'drag';
  if(!hit||['mcu','breadboard'].includes(hit?.id))return 'pan';
  return 'select';
}

export function boardResetTap(press,event) {
  return press.pointerId===event.pointerId&&!press.resetCancelled&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<5;
}

export function isSecondPinTap(previous,current) {
  if(!previous||previous.endpoint!==current.endpoint||previous.pointerType!==current.pointerType)return false;
  const elapsed=current.time-previous.time;
  return elapsed>=0&&elapsed<=500&&Math.hypot(current.x-previous.x,current.y-previous.y)<14;
}

export function wireGestureState(endpoint,pendingPin,reconnect,details={}) {
  return {...details,start:pendingPin||endpoint,clickedEndpoint:endpoint,reconnect:reconnect?{...reconnect}:null,target:null,dragging:false};
}

export function connectionPlan(circuit,available,a,b,reconnect=null,getWireSocketIssue) {
  const has=endpoint=>typeof available?.has==='function'?available.has(endpoint):Array.isArray(available)&&available.includes(endpoint);
  if(!a||!b||!has(a)||!has(b))return {ok:false,reason:'missing',message:'请落在可见引脚上；原连接保持不变。'};
  let wire=null;
  if(reconnect){
    wire=circuit?.wires?.find(item=>item.id===reconnect.id);
    if(!wire||!['a','b'].includes(reconnect.end)||wire[reconnect.end==='a'?'b':'a']!==a)return {ok:false,reason:'stale',message:'这根导线已经改变，请重新选择需要重接的一端。'};
    if(wire[reconnect.end]===b)return {ok:false,reason:'unchanged',message:'仍是原来的端点，连接没有改变。'};
  }
  if(a===b)return {ok:false,reason:'same',message:'两端不能是同一个引脚，请选择另一个端点。'};
  if(circuit?.wires?.some(item=>item.id!==wire?.id&&((item.a===a&&item.b===b)||(item.a===b&&item.b===a))))return {ok:false,reason:'duplicate',message:'这两个端点已经有导线连接，请选择其他端点。'};
  const socketIssue=(!reconnect&&getWireSocketIssue?.(a))||getWireSocketIssue?.(b,wire?.id);
  if(socketIssue)return {ok:false,reason:'occupied',message:socketIssue};
  return reconnect?{ok:true,kind:'reconnect',id:wire.id,end:reconnect.end,endpoint:b,a,b}:{ok:true,kind:'connect',a,b};
}

export function directionalEndpoint(entries,currentId,direction) {
  const points=Array.from(entries,entry=>Array.isArray(entry)?{id:entry[0],...entry[1]}:entry),current=points.find(point=>point.id===currentId);
  if(!current)return null;
  const dx=direction[0],dy=direction[1];let best=null,score=Infinity;
  for(const point of points){
    if(point.id===currentId||point.hidden)continue;
    const x=point.x-current.x,y=(point.y??point.z)-(current.y??current.z),forward=x*dx+y*dy,across=Math.abs(x*dy-y*dx);
    if(forward<=.001)continue;
    const weight=forward+across*4+across*across/Math.max(forward,.001);
    if(weight<score){score=weight;best=point.id;}
  }
  return best;
}

export function boardHoleKeyAction({startHole, selectedHole}, keyboardHole, entries, key, repeat) {
  const available = endpoint => entries.some(point => point.id === endpoint);
  const selected = available(selectedHole) ? selectedHole : null;
  const cursor = available(keyboardHole) ? keyboardHole : null;
  const start = available(startHole) ? startHole : null;
  const current = selected ?? cursor ?? start;
  const direction = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[key];
  if (direction) {
    const endpoint = current ? directionalEndpoint(entries,current,direction) : entries[0]?.id;
    if (endpoint) return {preview:endpoint};
  } else if (key === 'Enter' && !repeat && !selected) {
    if (cursor && cursor !== start) return {choose:cursor};
    const endpoint = start ?? entries[0]?.id;
    if (!cursor && endpoint) return {preview:endpoint};
  }
  return null;
}

export function pointerInsideSurface(surface,{clientX,clientY}) {
  const bounds=surface.getBoundingClientRect();
  return clientX>=bounds.left&&clientX<bounds.right&&clientY>=bounds.top&&clientY<bounds.bottom;
}
