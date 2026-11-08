/* Lumped educational circuit solver. Not SPICE, MCU silicon, or a safety certification. */
import {getBoardProfile,canonicalPin,makeBoardStarter} from './board-profiles.js';
import {mountedConnections,signalStrip} from './breadboard-mount.js';
import {mountedPartContacts} from './part-mount.js';
import {buttonContact} from './button-contact.js';
import {encoderContact,encoderPins} from './rotary-encoder.js';
import {joystickPins,joystickState} from './analog-joystick.js';
import {kingbrightRgbForward,kingbrightRgbModel,rgbPwmCycle} from './rgb-led.js';
import {advancePdvPhotocell,pdvPhotocellModel} from './pdv-photocell.js';
import {advanceGroveRelay,groveRelayContactOhms,groveRelayHigh,groveRelayIdleOhms,
 groveRelayLoadOhms,groveRelayPins,groveRelayPowered,groveRelayWave} from './grove-relay.js';
import {advancePwmRc,pwmPhaseMs,pwmRcEnvelope} from './pwm-rc.js';
import {advanceFa130,drv8833Channels,drv8833Inputs,drv8833Logic,drv8833Mode,drv8833Pins,drv8833Switches,
 fa130Drive,fa130Model,reversePassOhms} from './motor-bridge.js';
import {advanceUltrasonic,hcsr04EchoOhms,hcsr04Pins,hcsr04Powered,hcsr04TriggerLevel,scheduledEchoPulse} from './ultrasonic.js';
import {applySsd1306Write,createSsd1306,ssd1306Address,ssd1306HostPins as avrI2cHostPins,ssd1306LoadOhms,ssd1306Pins,
 ssd1306Powered,ssd1306PullOhms,ssd1306Reading} from './ssd1306.js';
import {advanceMcp9808,createMcp9808,mcp9808Address,mcp9808Addresses,mcp9808LoadOhms,mcp9808Pins,mcp9808Powered,
 mcp9808PullOhms,mcp9808Reading,mcp9808Temperature,readMcp9808,rebaseMcp9808,writeMcp9808} from './mcp9808.js';
const stm32I2c1Boards=new Set(['bluepill','nucleo-f103rb']);
const stm32I2c1Pins=['PB7','PB6'];
const dipSwitchPins=Object.freeze(['1','2','3','4','5','6','7','8']);
const dipSwitchPairs=[['1','8'],['2','7'],['3','6'],['4','5']];
const dipSwitchContactOhms=.1;
const i2cDevices=new Map([
 ['ssd1306',{address:ssd1306Address,powered:ssd1306Powered,create:createSsd1306,reading:ssd1306Reading,write:applySsd1306Write,
  pullOhms:ssd1306PullOhms,loadOhms:ssd1306LoadOhms}],
 ['mcp9808',{address:mcp9808Address,powered:mcp9808Powered,create:createMcp9808,advance:advanceMcp9808,rebase:rebaseMcp9808,
  reading:mcp9808Reading,write:writeMcp9808,read:readMcp9808,pullOhms:mcp9808PullOhms,loadOhms:mcp9808LoadOhms,
  inputRatios:{lowMax:.3,highMin:.7,highMax:1}}]
]);
export const BOARD_LEFT=['PB12','PB13','PB14','PB15','PA8','PA9','PA10','PA11','PA12','PA15','PB3','PB4','PB5','PB6','PB7','PB8','PB9','5V','GND1','3V3'];
export const BOARD_RIGHT=['GND2','GND3','3V3b','NRST','PB11','PB10','PB1','PB0','PA7','PA6','PA5','PA4','PA3','PA2','PA1','PA0','PC15','PC14','PC13','VBAT'];
export const PARTS={
 mcp9808:{name:'MCP9808 I²C 温度传感器',tag:'TEMP',description:'Adafruit #5027 STEMMA QT。VIN 和 GND 接 2.7–5.5 V，SDA 与 SCL 接开发板的 I²C。',pins:mcp9808Pins,defaults:{address:0x18,temperatureC:mcp9808Temperature.default},parameters:[{key:'temperatureC',label:'环境温度',unit:'°C',min:mcp9808Temperature.min,max:mcp9808Temperature.max,step:.0625},{key:'address',label:'I²C 地址',type:'select',options:mcp9808Addresses,numeric:true}],model:'按实际供电与总线接线读取温度寄存器，包含四档转换周期、符号位、阈值标志与关断。载板每线 10 kΩ 上拉，供电负载近似为 25 kΩ。Alert、热滞后与逐位波形暂未建模。'},
 ssd1306:{name:'SSD1306 128×64 OLED',tag:'OLED',description:'Adafruit #326 STEMMA QT。VIN 与 GND 供电，SDA 与 SCL 接开发板的 I²C。',pins:ssd1306Pins,defaults:{address:0x3d},parameters:[{key:'address',label:'I²C 地址',type:'select',options:[0x3d,0x3c],numeric:true}],model:'按实际接线与电平处理 I²C 写入，模拟 128×64 显存、寻址和常用显示指令。保留模块 10 kΩ 上拉，以 1 kΩ 近似供电负载；省略总线逐位时序、滚动动画及电荷泵模拟波形。'},
 hcsr04:{name:'HC-SR04 超声测距',tag:'US',description:'TRIG 接收触发，ECHO 输出与目标往返时间对应的脉冲，VCC 使用 5 V。',pins:hcsr04Pins,defaults:{distanceCm:100,bearingDeg:0,targetPresent:true},parameters:[{key:'distanceCm',label:'目标距离',unit:'cm',min:0,max:450,step:1},{key:'bearingDeg',label:'目标偏角',unit:'°',min:-30,max:30,step:1},{key:'targetPresent',label:'目标存在',type:'boolean'}],model:'教学模型按约 20°C 声速、单一目标、15° 总角和 2–400 cm 范围计算。供电判定采用 4.75–5.25 V；省略多径、回波强度与不同版本的超时差异。'},
 led:{name:'发光二极管',tag:'LED',description:'有方向的灯。A 是正极，K 是负极；需要串联电阻。',pins:['A','K'],defaults:{color:'red',maxMa:20},model:'分段线性二极管；正向压降按颜色近似。'},
 resistor:{name:'电阻',tag:'R',description:'像限流阀，限制支路电流；两端没有正负之分。',pins:['1','2'],defaults:{resistance:330},model:'理想线性电阻；按 P=I²R 检查额定 0.25 W。'},
 button:{name:'轻触按键',tag:'SW',description:'按下时两组触点接通。同组两脚一直相通。',pins:['1','2','3','4'],defaults:{pressed:false,bounce:false},parameters:[{key:'bounce',label:'机械触点抖动',type:'boolean'}],model:'同组脚始终相通。可开启可重放的 4 ms 触点抖动，时长参考 B3F 数据手册的 5 ms 上限，触点序列为教学示例。'},
 dipswitch:{name:'Omron A6D-4100 四位拨码开关',tag:'DIP',description:'四个独立开关分别连接 1–8、2–7、3–6、4–5。拨到 ON 接通。',pins:dipSwitchPins,defaults:{switchMask:0},model:'闭合触点按数据表初始上限 0.1 Ω 求解；断开时无导电支路。模型采用稳定拨动状态，省略触点抖动、漏电和磨损。'},
 encoder:{name:'Bourns PEC11R 旋转编码器',tag:'ENC',description:'A、B 是两路触点，C 是公共端。SW1、SW2 是独立的轴按压开关。',pins:encoderPins,defaults:{},model:'参考 PEC11R-4220F-S0024 的 24 格和每圈 24 周期。每格四个正交边沿，顺时针 A 领先 B。仿真采用双开路静止相位、每边沿间隔 12 ms 和理想无抖动触点。需要外部电路或 GPIO 上拉。'},
 'grove-relay':{name:'Seeed Grove 继电器 v1.2',tag:'K',description:'SIG 控制线圈，VCC/GND 为模块供电，COM 和 NO 为独立常开触点。Grove 的 NC 是未连接脚。',pins:groveRelayPins,defaults:{},model:'模块按 3.3–5 V、约 100 mA 吸合驱动建模。常开触点与线圈隔离，闭合电阻取 0.05 Ω。吸合 10 ms、释放 5 ms 为依据继电器规格上限选取的固定教学值。适用低压直流，省略触点弹跳、反冲和电弧。'},
 pot:{name:'旋钮电位器',tag:'RV',description:'转动旋钮，让中间脚得到不同电压。',pins:['VCC','OUT','GND'],defaults:{position:0.5,resistance:10000},model:'两段电阻分压，考虑外部负载。'},
 joystick:{name:'SparkFun 双轴模拟摇杆',tag:'JOY',description:'COM-09032 摇杆与 BOB-09110 载板。HORIZ、VERT 为模拟滑臂，按压时 SEL 接通 GND。',pins:joystickPins,defaults:{},model:'两轴各用 10 kΩ 线性分压，输出随实际 VCC、GND 和外部负载变化。板上 V 箭头朝上时，向右 HORIZ 降低，向上 VERT 升高。教学模型采用理想中位、近电源轨的端点和圆形行程。SEL 松开时需要外部或 GPIO 上拉。'},
 buzzer:{name:'有源蜂鸣器',tag:'BZ',description:'正负两脚获得足够电压时发声；默认静音，可打开声音。',pins:['+','-'],defaults:{resistance:1000},model:'等效负载与通断发声；不模拟实际声压/频谱。'},
 servo:{name:'微型舵机',tag:'M',description:'三根线分别负责供电、地和控制。控制脉冲决定角度。',pins:['VCC','GND','SIG'],defaults:{angle:90,servoModel:'generic'},parameters:[{key:'servoModel',label:'舵机型号',type:'select',options:['generic','hs55']}],model:'通用型按常见 50 Hz、1–2 ms 脉冲计算角度。HS-55 按额定脉宽、空载速度和静止/转动耗流求解。4.8–6.0 V 时的标称耗流分别为 5–6 mA 和 150–180 mA。轴负载、启动尖峰和堵转为实物测量范围。'},
 capacitor:{name:'电解电容',tag:'C',description:'暂时储存电荷；长脚为正极，负极条纹侧接低电位。',pins:['+','-'],defaults:{capacitance:100},model:'单路推挽 PWM、串联电阻和对地电容构成的简单低通按相位解析求解，其他电路使用后向欧拉近似。电容省略 ESR、漏电与击穿。'},
 power:{name:'直流电源',tag:'V',description:'提供设定的电压。外部电源需与控制板建立共同参考地。',pins:['+','-'],defaults:{voltage:5},model:'理想直流电压源；不模拟真实限流环路和瞬态。'},
 diode:{name:'通用二极管',tag:'D',description:'主要让电流从A流向K；色环标记K端。',pins:['A','K'],defaults:{forwardVoltage:.7,maxMa:100},parameters:[{key:'forwardVoltage',label:'正向压降',unit:'V',min:.1,max:2,step:.05}],model:'固定压降加10Ω动态电阻的教学模型；不含反向击穿、结电容和开关恢复，不代表某一具体型号。'},
 switch:{name:'两脚开关',tag:'SW',description:'闭合时两脚导通，断开时分离。',pins:['1','2'],defaults:{closed:false},parameters:[{key:'closed',label:'闭合',type:'boolean'}],model:'理想通断开关，不含触点电阻和抖动。'},
 ldr:{name:'光敏电阻',tag:'LDR',description:'越亮时电阻越小；配合固定电阻可把光照变成电压。',pins:['1','2'],defaults:{lux:100},parameters:[{key:'lux',label:'光照',unit:'lx',min:0,max:100000,step:10}],model:'经验教学曲线 R=10kΩ×(100/lux)^0.7，限幅100Ω–10MΩ；不是某个器件的校准数据。'},
 thermistor:{name:'NTC热敏电阻',tag:'NTC',description:'温度升高时阻值降低，常和固定电阻组成分压器。',pins:['1','2'],defaults:{temperature:25,resistance:10000,beta:3950,nominalTemperature:25},parameters:[{key:'temperature',label:'温度',unit:'°C',min:-40,max:125,step:1},{key:'beta',label:'B值',unit:'K',min:1000,max:6000,step:50}],model:'B参数公式的电阻近似；不含热惯性、自热和容差。'},
 rgbled:{name:'四脚RGB灯',tag:'RGB',description:'R/G/B分别是三颗灯，共用COM；每一路都需要自己的限流电阻。',pins:['R','G','B','COM'],defaults:{common:'cathode',maxMa:20,rgbModel:'generic'},parameters:[{key:'common',label:'公共端',type:'select',options:['cathode','anode']}],model:'通用灯可选择共阴或共阳。Kingbright WP154A4SUREQBFZGW 固定共阴，按 25 °C 典型曲线拟合约 1–3 mA 的支路，颜色亮度为归一化显示。'},
 sevenseg:{name:'单个七段数码管',tag:'7SEG',description:'a 到 g 与 dp 分别控制七段和小数点，3 脚 COM 和 8 脚 COM2 在内部相通。',pins:['e','d','COM','c','dp','g','f','COM2','a','b'],defaults:{common:'cathode',maxMa:20},parameters:[{key:'common',label:'公共端',type:'select',options:['cathode','anode']}],model:'脚位参考共阴极 Kingbright SC56-11EWA。每个 LED 段需单独限流，另可选共阳极教学行为。'},
 drv8833:{name:'DRV8833 双路电机驱动',tag:'H',description:'Pololu #2130 双路 H 桥。VIN 接电机电源；两路输入各自控制正转、反转、滑行或制动。',pins:drv8833Pins,defaults:{},model:'按输入采样切换带导通电阻的输出桥。SLP 上拉，原厂短接两个电流检测端。PWM 逐边沿、过流重试和温升保护暂不模拟。'},
 motor:{name:'直流电机',tag:'DCM',description:'正负电压决定旋转方向。需要合适驱动，GPIO不能直接承担启动电流。',pins:['+','-'],defaults:{motorModel:'generic',resistance:20,backEmf:.0016,inertia:.000001,friction:.000002},parameters:[{key:'motorModel',label:'电机型号',type:'select',options:['generic','fa130-18100']},{key:'resistance',label:'绕组电阻',unit:'Ω',min:1,max:1000,step:1},{key:'inertia',label:'转动惯量',unit:'kg·m²',min:.0000001,max:.001,step:.000001}],model:'FA-130RA-18100 以 3 V 空载及堵转数据拟合，惯量为演示估计。通用型保留自定义参数。两者均省略绕组电感、温升和外部机械负载。'}
};
export function isDipSwitchMask(mask){return Number.isInteger(mask)&&mask>=0&&mask<=15;}
export function makePart(type,id,x=2,z=0){return {id,type,x,z,rotation:0,...structuredClone(PARTS[type].defaults)};}
export function createCircuit(preset='blink',boardId='bluepill'){
 if(boardId!=='bluepill')return makeBoardStarter(boardId,['button','adc','pwm'].includes(preset)?preset:'blink').circuit;
 const c={version:2,boardId:'bluepill',powered:true,boot0:false,board:{x:-5,z:0},breadboard:{x:1.8,z:0},components:[],wires:[]};
 const benchZ=4.1;
 let wi=0;const w=(a,b,color='#ea7246')=>c.wires.push({id:'w'+(++wi),a,b,color});
 if(preset==='board-insertion'){
  c.components.push(makePart('led','led1',4.7,benchZ),makePart('resistor','r1',3,benchZ));
  w('bb:a21','r1:1');w('r1:2','led1:A');w('led1:K','bb:j24','#24384a');
  return c;
 }
 if(preset==='plugged-led'||preset==='plugged-button'){
  c.components.push({...makePart('led','led1',2.1,3.8),mount:{hole:'bb:a10',rotation:0}},
   {...makePart('resistor','r1',.8,3.8),mount:{hole:'bb:c11',rotation:0}});
  w('mcu:PA0','bb:e10');w('bb:e16','mcu:GND1','#24384a');
  if(preset==='plugged-button'){
   c.components.push({...makePart('button','button1',4.6,1.1),mount:{hole:'bb:f20',rotation:90}});
   w('mcu:PB1','bb:h20','#48a6c8');w('bb:d20','mcu:GND1','#24384a');
  }
  return c;
 }
 const led=(id,pin,x,z,color='red')=>{const n=id.replace('led','');c.components.push({...makePart('led',id,x,z),color},makePart('resistor','r'+n,x-1.3,z));w('mcu:'+pin,'r'+n+':1');w('r'+n+':2',id+':A');w(id+':K','mcu:GND1','#24384a');};
 if(preset!=='onboard'&&preset!=='uart')led('led1','PA0',2.1,benchZ,'red');
 if(preset==='traffic'){led('led2','PA1',-.9,benchZ,'yellow');led('led3','PA2',5.1,benchZ,'green');}
 if(preset==='button'){c.components.push(makePart('button','button1',4.6,benchZ));w('mcu:PB1','button1:1','#48a6c8');w('button1:3','mcu:GND1','#24384a');}
 if(preset==='adc'){c.components.push(makePart('pot','pot1',4.6,benchZ));w('mcu:3V3','pot1:VCC','#dd5f58');w('pot1:GND','mcu:GND1','#24384a');w('pot1:OUT','mcu:PA1','#8f70d6');}
 if(preset==='buzzer'){c.components=[];c.wires=[];c.components.push(makePart('buzzer','buzzer1',2,benchZ));w('mcu:PA0','buzzer1:+','#ea7246');w('buzzer1:-','mcu:GND1','#24384a');}
 if(preset==='servo'||preset==='servo-hs55'){
  const servo=makePart('servo','servo1',2,4.8);
  if(preset==='servo-hs55')servo.servoModel='hs55';
  c.components=[servo];c.wires=[];
  w('mcu:5V','servo1:VCC','#dd5f58');w('mcu:GND1','servo1:GND','#24384a');w('mcu:PA0','servo1:SIG','#f2b343');
 }
 return c;
}
class UnionFind{constructor(){this.p=new Map();}find(x){if(!this.p.has(x))this.p.set(x,x);let p=this.p.get(x);if(p!==x){p=this.find(p);this.p.set(x,p);}return p;}join(a,b){this.p.set(this.find(a),this.find(b));}}
function linearSolve(A,b){const n=b.length;for(let k=0;k<n;k++){let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(A[i][k])>Math.abs(A[pivot][k]))pivot=i;if(Math.abs(A[pivot][k])<1e-16)throw Error('电路方程无唯一解');[A[k],A[pivot]]=[A[pivot],A[k]];[b[k],b[pivot]]=[b[pivot],b[k]];for(let i=k+1;i<n;i++){const q=A[i][k]/A[k][k];if(q===0)continue;for(let j=k+1;j<n;j++)A[i][j]-=q*A[k][j];b[i]-=q*b[k];}}const x=new Float64Array(n);for(let i=n-1;i>=0;i--){let v=b[i];for(let j=i+1;j<n;j++)v-=A[i][j]*x[j];x[i]=v/A[i][i];}return x;}
const outputMode=m=>/Out_PP|Out_OD|AF_PP|AF_OD|output/i.test(String(m));
const openDrain=m=>/Out_OD|AF_OD/i.test(String(m));
const pullUp=m=>/IPU|pullup/i.test(String(m));
const pullDown=m=>/IPD|pulldown/i.test(String(m));
const kingbrightRgb=part=>part.type==='rgbled'&&part.rgbModel===kingbrightRgbModel;

function pwmOutputLevel(pwm,timeMs){
 const period=1000/(pwm.frequencyHz||pwm.frequency||1);
 const phase=pwmPhaseMs(timeMs,pwm.startMs??0,period),duty=pwm.duty??0;
 return pwm.level??(pwm.highFirst===false?Number(phase>=period*(1-duty)):Number(phase<period*duty));
}

function knownPwmCommand(pwm,voltageHigh,timeMs){
 const frequencyHz=pwm?.frequencyHz??pwm?.frequency;
 const periodMs=1000/frequencyHz;
 if(!Number.isFinite(periodMs)||periodMs<=0||!Number.isFinite(pwm?.startMs)||pwm.startMs>timeMs||
    !Number.isFinite(pwm.duty)||pwm.duty<0||pwm.duty>1)return null;
 const endMs=pwm.endMs??null;
 if(endMs!==null&&(!Number.isFinite(endMs)||endMs<=timeMs))return null;
 return {frequencyHz,periodMs,duty:pwm.duty,startMs:pwm.startMs,endMs,voltageHigh,voltageLow:0};
}

function simplePwmRcPlans({capacitors,components,branches,diodes,sources,pinSources,state,board,u,ground,previous}){
 const plans=new Map(),timeMs=state.timeMs??0;
 if(!capacitors.length||state.error||(!previous.size&&!Object.values(state.pins??{}).some(pin=>pin.pwm)))return plans;
 const terminalNodes=new Map(components.map(part=>[part,(PARTS[part.type]?.pins??part.pins??[]).map(pin=>u.find(part.id+':'+pin))]));
 const resistors=new Map(components.filter(part=>part.type==='resistor').map(part=>[part.id,part]));
 const outputPins=Object.entries(state.pins??{}).filter(([,pin])=>pin.clock!==false&&outputMode(pin.mode))
  .map(([name])=>({name,node:u.find('mcu:'+canonicalPin(name,board.id))}));
 const touches=(edge,node)=>u.find(edge.a)===node||u.find(edge.b)===node;
 for(const part of capacitors){
  const [output,negative]=terminalNodes.get(part);
  if(negative!==ground||output===ground)continue;
  const outputEdges=branches.filter(edge=>touches(edge,output));
  const resistor=outputEdges.length===1?resistors.get(outputEdges[0].id):null;
  if(!resistor)continue;
  const [first,second]=terminalNodes.get(resistor),input=first===output?second:first;
  if(input===ground||input===output)continue;
  const driveEdges=branches.filter(edge=>touches(edge,input));
  const driver=driveEdges.length===2?driveEdges.find(edge=>edge.kind==='driver'):null;
  if(!driver||!driveEdges.includes(outputEdges[0]))continue;
  if([...sources,...diodes].some(edge=>touches(edge,input)||touches(edge,output)))continue;
  if(components.some(other=>other!==part&&other!==resistor&&terminalNodes.get(other).some(node=>node===input||node===output)))continue;

  const name=driver.id.slice('driver:'.length),signal=pinSources[name];
  if(!signal||openDrain(signal.mode))continue;
  // A released open-drain output has no branch at this instant, but can
  // still pull the node low later in its own PWM cycle.
  if(outputPins.some(pin=>pin.name!==name&&(pin.node===input||pin.node===output)))continue;
  const pwm=state.pins[name]?.pwm;
  let command=knownPwmCommand(pwm,board.logicVoltage,timeMs);
  if(!command){
   // Keep integrating an already tracked filter if its PWM pin becomes a
   // constant output. Ordinary DC RC circuits retain their existing solver.
   if(pwm||previous.get(part.id)?.part!==part)continue;
   command={voltage:signal.level?board.logicVoltage:0};
  }
  const timeConstantMs=(outputEdges[0].r+driver.r)*(part.capacitance||100)/1000;
  if(!Number.isFinite(timeConstantMs)||timeConstantMs<=0)continue;
  plans.set(part.id,{part,pin:canonicalPin(name,board.id),command,timeConstantMs});
 }
 return plans;
}
const hs55MinSupply=4.8,hs55MaxSupply=6;
const hs55MinPulse=900,hs55MaxPulse=2100;
const hs55Epsilon=1e-6;

// Both current lines meet at 4.8 V. Below it a passive continuation limits
// the demand without switching the motor repeatedly on and off at the cutoff.
// Hitec specifies 5/6 mA standing and 150/180 mA running at 4.8/6.0 V.
function hs55LoadLine(running,voltage){
 const scale=running?30:1;
 return voltage>hs55MinSupply+hs55Epsilon ? {r:1200/scale,emf:-1.2} : {r:960/scale,emf:0};
}

function hs55Frame(part,previous,elapsedMs,{voltage,grounded,signalPin,pwm,signalValid,conflict}) {
  let angle=previous?.part===part ? previous.angle : Math.max(30,Math.min(150,Number.isFinite(part.angle)?part.angle:90));
  if(previous?.part===part&&previous.targetAngle!==null){
    // The input observed now applies to the next interval. Finish the elapsed
    // interval under the earlier command before installing the new one.
    const remaining=previous.targetAngle-angle;
    const travel=Math.min(Math.abs(remaining),previous.speed*elapsedMs);
    angle+=Math.sign(remaining)*travel;
  }
  const frequency=pwm?.frequencyHz??pwm?.frequency;
  const frequencyHz=Number.isFinite(frequency)&&frequency>0?frequency:null;
  const duty=pwm?.duty;
  const pulseUs=frequencyHz&&Number.isFinite(duty)&&duty>0&&duty<1?duty/frequencyHz*1e6:null;
  let reason=null;
  if(conflict)reason='conflict';
  else if(voltage<hs55MinSupply-hs55Epsilon||voltage>hs55MaxSupply+hs55Epsilon)reason='supply';
  else if(!grounded)reason='ground';
  else if(!signalValid||!pwm)reason='signal';
  // The 50 Hz nominal teaching input is separate from the vendor's travel and speed specs.
  else if(frequencyHz===null||Math.abs(frequencyHz-50)>5+hs55Epsilon)reason='frequency';
  else if(pulseUs===null||pulseUs<hs55MinPulse-hs55Epsilon||pulseUs>hs55MaxPulse+hs55Epsilon)reason='pulse';
  const targetAngle=reason===null?Math.max(30,Math.min(150,90+(pulseUs-1500)/10)):null;
  const mix=Math.max(0,Math.min(1,(voltage-hs55MinSupply)/(hs55MaxSupply-hs55MinSupply)));
  const speed=targetAngle===null?0:60/180+(60/140-60/180)*mix;
  const moving=targetAngle!==null&&Math.abs(targetAngle-angle)>hs55Epsilon;
  return {
    state:{part,angle,targetAngle,speed},
    data:{voltage:conflict?null:voltage,angle,targetAngle,pulseUs,frequencyHz,signalPin,active:targetAngle!==null,moving,reason}
  };
}
const hs55Issues={
  supply:['SERVO_SUPPLY','供电超出 4.8–6.0 V','舵机的电源端与控制信号端用途不同。','将 VCC 接到合适电源，GND 与开发板共地。'],
  ground:['SERVO_GROUND','舵机和开发板没有共地','PWM 需要使用同一个地作为参考。','将舵机电源负极和开发板 GND 连在一起。'],
  signal:['SERVO_PWM','未收到有效控制信号','舵机 SIG 需要实际连接到唯一一个工作的推挽 PWM 输出。','检查信号线、引脚模式和定时器输出。'],
  frequency:['SERVO_PWM','控制频率偏离 50 Hz','此教学模型接受 45–55 Hz 的定时器 PWM。','把 PWM 周期设为约 20 ms。'],
  pulse:['SERVO_PULSE','控制脉宽超出 900–2100 µs','连续高电平或低电平没有可用脉冲。','用 1500 µs 校验中位，再修改定时器比较值。']
};
function diodeLineFraction(curvature,crossings) {
 // On the feasible Newton segment the linearized energy has slope
 // (fraction - 1) * curvature. Add the diode corrections at crossed knees.
 const correction = fraction => {
  let slope=0;
  for (const {on,initial,change,resistance} of crossings) {
   const excess=initial+fraction*change;
   slope+=change*(Math.max(0,excess)-(on?excess:0))/resistance;
  }
  return slope;
 };
 if (correction(1)<=0) return 1;
 let low=0,high=1;
 for (let step=0;step<40;step++) {
  const mid=(low+high)/2;
  if ((mid-1)*curvature+correction(mid)>0) high=mid;
  else low=mid;
 }
 return (low+high)/2;
}

export class CircuitSimulator{
 constructor(){this.reset();}
 reset({preserveServoAngles=false,preserveCapacitorVoltages=false,preserveMotorStates=false,preserveDisplayMemory=false,
  preserveI2cDevices=preserveDisplayMemory,preservePhotocellStates=false,preserveTime=false}={}){
  this.servoStates=preserveServoAngles?new Map([...this.servoStates].map(([id,state])=>[id,{...state,targetAngle:null,speed:0}])):new Map();
  if(!preserveCapacitorVoltages)this.capVoltages={};
  this.motorStates=preserveMotorStates?Object.fromEntries(Object.entries(this.motorStates).map(([id,{omega,angle}])=>[id,{omega,angle}])):{};
  const retained=preserveI2cDevices?this.i2cStates??new Map():new Map();
  this.i2cStates=new Map([...retained].map(([id,record])=>{
   const rebase=i2cDevices.get(record.type).rebase;
   return [id,rebase&&!preserveTime?{...record,controller:rebase(record.controller,this.lastTime)}:record];
  }));
  this.photocellStates=preservePhotocellStates?this.photocellStates??new Map():new Map();
  this.renderedPwmResult=null;
  this.i2cTarget=null;
  this.pwmRcStates=new Map();this.ultrasonicStates=new Map();this.relayStates=new Map();this.lastTime=preserveTime?this.lastTime??0:0;this.lastResult=null;this.boardId=null;
 }
 removeParts(ids) {
  this.lastResult=null;
  this.renderedPwmResult=null;
  for (const id of ids) {
   delete this.capVoltages[id];
   this.pwmRcStates.delete(id);
   this.ultrasonicStates.delete(id);
   this.relayStates.delete(id);
   this.i2cStates.delete(id);
   this.photocellStates.delete(id);
   delete this.motorStates[id];
   this.servoStates.delete(id);
  }
 }
 #sampleSolver(circuit,state={}) {
  const timeMs=state.timeMs??this.lastTime;
  if(!Number.isFinite(timeMs)||timeMs<this.lastTime)return null;
  const boardId=getBoardProfile(circuit.boardId||state.boardId||'bluepill').id;
  const previousBoard=this.boardId??this.lastResult?.boardId;
  const sample=new CircuitSimulator();
  // At a program boundary, new output levels take effect before time elapses.
  // Keep the last committed charge and rotation while sampling those levels.
  if(!previousBoard||previousBoard===boardId){
   sample.capVoltages={...this.capVoltages};
   sample.pwmRcStates=new Map(this.pwmRcStates);
   sample.ultrasonicStates=new Map(this.ultrasonicStates);
   sample.relayStates=new Map(this.relayStates);
   sample.i2cStates=new Map(this.i2cStates);
   sample.photocellStates=new Map(this.photocellStates);
   sample.motorStates=structuredClone(this.motorStates);
   sample.servoStates=new Map(this.servoStates);
  }
  sample.lastTime=timeMs;
  sample.solve(circuit,{...state,timeMs},{averagePWM:false});
  return sample;
 }
 sampleAtCurrentTime(circuit,state={}) {
  return this.#sampleSolver(circuit,state)?.lastResult??null;
 }
 i2cAddress(circuit,state,address,direction) {
  if(direction!=='read'&&direction!=='write')return {status:3,reason:'invalid-data'};
  const sample=this.#sampleSolver(circuit,state);
  if(!sample)return {status:4,reason:'stale-state'};
  const target=sample.i2cTarget?.(address)??{status:2,reason:'address-nack'};
  if(target.status||direction==='write')return target;
  const record=sample.i2cStates.get(target.deviceId);
  return i2cDevices.get(record.type).read?target:{status:2,reason:'read-not-supported',deviceId:target.deviceId};
 }
 writeI2c(circuit,state,address,bytes) {
  this.solve(circuit,state,{averagePWM:false});
  const target=this.i2cTarget?.(address)??{status:2,reason:'address-nack'};
  if(target.status)return target;
  const {deviceId}=target;
  const record=this.i2cStates.get(deviceId);
  const transfer=i2cDevices.get(record.type).write(record.controller,bytes,this.lastTime);
  if(transfer.status)return {...transfer,deviceId};
  this.i2cStates.set(deviceId,{...record,controller:transfer.state});
  const {state:_controller,...response}=transfer;
  return {...response,deviceId};
 }
 readI2c(circuit,state,address,quantity) {
  this.solve(circuit,state,{averagePWM:false});
  const target=this.i2cTarget?.(address)??{status:2,reason:'address-nack'};
  if(target.status)return {...target,bytes:[]};
  const {deviceId}=target;
  const record=this.i2cStates.get(deviceId),read=i2cDevices.get(record.type).read;
  const response=read?read(record.controller,quantity):{status:2,reason:'read-not-supported',bytes:[]};
  return {...response,deviceId};
 }
 solve(circuit,state={pins:{},timeMs:0},options={}){
  const board=getBoardProfile(circuit.boardId||state.boardId||'bluepill');
  if(this.boardId&&this.boardId!==board.id)this.reset();
  this.boardId=board.id;
  if((state.timeMs??0)<this.lastTime)this.reset();
  const timeMs=state.timeMs??0;
  const elapsedMs=Math.max(0,timeMs-this.lastTime),elapsed=elapsedMs/1000;
  const photocellStates=new Map();
  const u=new UnionFind(),all=new Set(),issues=[],parts={},branches=[],sources=[],diodes=[],floatingInputs=[],releasedDrains=[];
  const hs55Parts=circuit.components.filter(part=>part.type==='servo'&&part.servoModel==='hs55');
  const relays=circuit.components.filter(part=>part.type==='grove-relay');
  const servoLoads=new Map();
  const capacitors=circuit.components.filter(part=>part.type==='capacitor');
  const bridges=circuit.components.filter(part=>part.type==='drv8833');
  const sensors=circuit.components.filter(part=>part.type==='hcsr04');
  const i2cParts=circuit.components.filter(part=>i2cDevices.has(part.type));
  const fa130Frames=new Map();
  const add=x=>{all.add(x);u.find(x);return x;};
  const issue=(code,severity,title,plain,fix,part=null)=>{if(!issues.some(x=>x.code===code&&x.part===part))issues.push({code,severity,title,plain,fix,part});};
  for(const [alias,name] of Object.entries(board.pinAliases))u.join(add('mcu:'+alias),add('mcu:'+name));
  const logicRail='mcu:'+board.logicRail;
  const mismatched=state.boardId&&state.boardId!==board.id;
  const bootBlocked=Boolean(circuit.boot0)&&board.family.startsWith('STM32');
  if(mismatched)issue('BOARD_MISMATCH','error','代码目标与实验台板型不同','当前代码运行状态属于 '+state.boardId+'，实验台为 '+board.id+'；已停用输出驱动。','选择相同板型并重新编译、复位。','mcu');
  const bbGroup=s=>{const strip=signalStrip(s);if(strip)return 'bbgroup:'+strip.rows+strip.column;const r=/^bb:([pn])([1-9]|[1-4]\d|50)$/.exec(s);if(r)return 'bbrail:'+r[1]+(Number(r[2])<=25?'upper':'lower');return s;};
  const joinTerminals=({a,b})=>{u.join(add(a),add(b));u.join(a,bbGroup(a));u.join(b,bbGroup(b));};
  for(const wire of circuit.wires)joinTerminals(wire);
  const boardContacts=mountedConnections(circuit,board),partContacts=circuit.components.flatMap(mountedPartContacts);
  for(const connection of [...boardContacts,...partContacts]){
   joinTerminals(connection);
   const {column,rows}=signalStrip(connection.b),group=bbGroup(connection.b);
   for(const row of rows)u.join(add('bb:'+row+column),group);
  }
  for(const p of circuit.components){
   for(const pin of PARTS[p.type]?.pins??p.pins??[])add(p.id+':'+pin);
   if(p.type==='button'){
    const contact=buttonContact(p,state.timeMs??0);
    parts[p.id]=contact;
    u.join(p.id+':1',p.id+':2');u.join(p.id+':3',p.id+':4');
    if(contact.closed)u.join(p.id+':1',p.id+':3');
   }
   if(p.type==='encoder'){
    const contact=encoderContact(p,timeMs),endpoint=pin=>p.id+':'+pin;
    parts[p.id]=contact;
    if(contact.aClosed)u.join(endpoint('A'),endpoint('C'));
    if(contact.bClosed)u.join(endpoint('B'),endpoint('C'));
    if(contact.switchClosed)u.join(endpoint('SW1'),endpoint('SW2'));
   }
   if(p.type==='joystick'){
    const pose=joystickState(p);
    parts[p.id]=pose;
    if(pose.pressed)u.join(p.id+':SEL',p.id+':GND');
   }
   if(p.type==='switch'&&p.closed)u.join(p.id+':1',p.id+':2');
   if(p.type==='sevenseg')u.join(p.id+':COM',p.id+':COM2');
   if(p.type==='drv8833')for(const pin of ['GND2','AISEN','BISEN'])u.join(p.id+':GND',p.id+':'+pin);
   if(!PARTS[p.type])issue('UNSUPPORTED_COMPONENT','warning',p.id+' 只有资料和外观','当前求解器没有 '+p.type+' 的电气或协议模型，该元件不会产生伪造的工作结果。','使用已实现元件，或在真实工具链中验证该模块。',p.id);
  }
  const edge=(a,b,r,id,kind='resistor',emf=0)=>{add(a);add(b);branches.push({a,b,r:Math.max(0.001,r),id,kind,emf});};
  const voltage=(a,b,v,id)=>{add(a);add(b);sources.push({a,b,v,id});};
  if(circuit.powered){
   voltage(logicRail,'mcu:GND',board.logicVoltage,board.logicRail);
   const standardRail=board.logicRail==='3V3'||board.logicRail==='5V';
   for (const [rail,level] of [['3V3',3.3],['5V',5]]) {
    if (rail!==board.logicRail && (standardRail || board.pins.some(pin=>pin.kind==='power'&&pin.canonical===rail))) voltage('mcu:'+rail,'mcu:GND',level,rail);
   }
  }
  else issue('POWER_OFF','error','开发板还没有供电','程序可以解释，但未供电的引脚不会驱动元件。','打开实验台的开发板供电开关。','mcu');
  if(board.userButton){
   const {pin,activeLow,pullOhms}=board.userButton,endpoint=add('mcu:'+pin);
   const released=activeLow?logicRail:'mcu:GND',pressed=activeLow?'mcu:GND':logicRail;
   edge(endpoint,released,pullOhms,'internal:user-button-pull','pull');
   if(circuit.board?.userButtonPressed)u.join(endpoint,add(pressed));
  }
  if(bootBlocked)issue('BOOT_MODE','error','BOOT0 处于 1','复位后会进入系统存储器启动路径，通常不会从用户 Flash 开始执行。','把 BOOT0 改回 0，然后复位。','mcu');
  const wiredTerminals=new Set(circuit.wires.flatMap(({a,b})=>[a,b]));
  const wireNodes=new Set([...wiredTerminals].map(endpoint=>u.find(endpoint)));
  const connectedNodes=new Set(wireNodes);
  for(const {a} of partContacts)connectedNodes.add(u.find(a));
  const pinSources={};
  for(const [name,p] of Object.entries(state.pins??{})){
   const endpoint='mcu:'+canonicalPin(name,board.id);add(endpoint);const connected=connectedNodes.has(u.find(endpoint));
   if(!circuit.powered||bootBlocked||mismatched)continue;
   const clock=p.clock!==false;let mode=p.mode??'GPIO_Mode_IN_FLOATING';
   if(!clock){if(connected)issue('GPIO_CLOCK','error',name+' 的 GPIO 时钟未打开','相关外设没有获得工作时钟，写入配置不会按预期生效。','在 GPIO_Init 前启用相应 RCC_APB2Periph_GPIOx。',name);continue;}
   if(outputMode(mode)){
    let level=Number(p.level??p.output??0)?1:0;
    if(p.pwm)level=pwmOutputLevel(p.pwm,timeMs);
    if(!openDrain(mode)||!level){edge(endpoint,level?logicRail:'mcu:GND',board.driverOhms,'driver:'+name,'driver');pinSources[name]={node:endpoint,level,mode};}
    else if(connected)releasedDrains.push(name);
   }else if(pullUp(mode))edge(endpoint,logicRail,40000,'pull:'+name,'pull');
   else if(pullDown(mode))edge(endpoint,'mcu:GND',40000,'pull:'+name,'pull');
   else if(connected&&!/AIN|analog/i.test(mode))floatingInputs.push(name);
  }
  for(const p of circuit.components){
   const e=pin=>p.id+':'+pin;
   if(p.type==='resistor')edge(e('1'),e('2'),Number(p.resistance)||330,p.id);
   if(p.type==='dipswitch'){
    const switchMask=isDipSwitchMask(p.switchMask)?p.switchMask:PARTS.dipswitch.defaults.switchMask;
    const switches=dipSwitchPairs.map(([a,b],index)=>{
     const closed=Boolean(switchMask&(1<<index));
     if(closed)edge(e(a),e(b),dipSwitchContactOhms,e(a),'dip-contact');
     return {closed};
    });
    parts[p.id]={switchMask,switches};
   }
   if(p.type==='ldr'){
    if(p.ldrModel===pdvPhotocellModel){
     const {state,reading}=advancePdvPhotocell(p,this.photocellStates.get(p.id),elapsedMs);
     photocellStates.set(p.id,state);
     parts[p.id]=reading;
     edge(e('1'),e('2'),reading.resistance,p.id,'sensor');
    }else edge(e('1'),e('2'),Math.max(100,Math.min(1e7,10000*Math.pow(100/Math.max(.01,Number(p.lux)||0),.7))),p.id,'sensor');
   }
   if(p.type==='thermistor'){const kelvin=Math.max(1,(Number(p.temperature)||0)+273.15),reference=(p.nominalTemperature??25)+273.15;edge(e('1'),e('2'),Math.max(.1,Math.min(1e9,(p.resistance||10000)*Math.exp((p.beta||3950)*(1/kelvin-1/reference)))),p.id,'sensor');}
   if(p.type==='pot'){const t=Math.max(0,Math.min(1,Number(p.position??PARTS.pot.defaults.position)));edge(e('VCC'),e('OUT'),Math.max(1,(p.resistance||10000)*(1-t)),p.id+':top');edge(e('OUT'),e('GND'),Math.max(1,(p.resistance||10000)*t),p.id+':bottom');}
   if(p.type==='joystick'){
    const {x,y}=parts[p.id];
    const trackResistance=10000;
    for(const [pin,fraction] of [['HORIZ',(1-x)/2],['VERT',(1+y)/2]]){
     const lower=Math.max(1,Math.min(trackResistance-1,trackResistance*fraction));
     edge(e('VCC'),e(pin),trackResistance-lower,e(pin)+':top');
     edge(e(pin),e('GND'),lower,e(pin)+':bottom');
    }
   }
   if(p.type==='buzzer')edge(e('+'),e('-'),p.resistance||1000,p.id);
   if(p.type==='servo'){
    const named=p.servoModel==='hs55';
    edge(e('VCC'),e('GND'),named?hs55LoadLine(false,0).r:2000,p.id+(named?':supply':':idle'));
    if(named)servoLoads.set(p,{branch:branches.at(-1),running:false});
   }
   if(p.type==='grove-relay'){
    // J2 pin 2 is unconnected. The SIG network follows R1, R3 and the
    // S8050 base-emitter junction; the screw terminal remains isolated.
    edge(e('SIG'),e('base'),4700,e('R1'));
    edge(e('base'),e('GND'),47000,e('R3'));
    diodes.push({a:e('base'),b:e('GND'),vf:.72,r:10,id:e('base-junction'),on:false});
    edge(e('VCC'),e('GND'),groveRelayIdleOhms,e('idle'));
   }
   if(p.type==='hcsr04'){
    edge(e('VCC'),e('GND'),5000/15,e('idle'),'ultrasonic-idle');
    edge(e('TRIG'),e('GND'),100000,e('TRIG')+':bias','ultrasonic-pull');
   }
   const i2cDevice=i2cDevices.get(p.type);
   if(i2cDevice){
    edge(e('VIN'),e('GND'),i2cDevice.loadOhms,e('idle'),'i2c-load');
    for(const pin of ['SDA','SCL'])edge(e(pin),e('VIN'),i2cDevice.pullOhms,e(pin)+':pull','i2c-pull');
   }
   if(p.type==='drv8833'){
    for(const pin of drv8833Inputs)edge(e(pin),e('GND'),150000,e(pin)+':pull','bridge-pull');
    edge(e('SLP'),e('VMM'),47000,e('SLP')+':up','bridge-pull');
    edge(e('SLP'),e('GND'),500000,e('SLP')+':down','bridge-pull');
    edge(e('VMM'),e('GND'),3000,e('idle'),'bridge-idle');
    diodes.push({a:e('SLP'),b:e('GND'),vf:6.5,r:10,id:e('SLP')+':clamp',on:false});
   }
   if(p.type==='power')voltage(e('+'),e('-'),Math.max(0,Math.min(24,Number(p.voltage)||0)),p.id);
   if(p.type==='led'){const vf={red:1.9,yellow:2.0,green:2.2,blue:2.9,white:3.0}[p.color]||1.9;diodes.push({a:e('A'),b:e('K'),vf,r:10,id:p.id,on:false});}
   if(p.type==='diode')diodes.push({a:e('A'),b:e('K'),vf:p.forwardVoltage??.7,r:10,id:p.id,on:false});
   if(p.type==='rgbled'||p.type==='sevenseg')for(const channel of (p.type==='rgbled'?['R','G','B']:['a','b','c','d','e','f','g','dp'])){
    const named=kingbrightRgb(p),anode=!named&&p.common==='anode';
    const {vf,r}=named?kingbrightRgbForward[channel]:{vf:p.type==='rgbled'?({R:1.9,G:2.2,B:2.9}[channel]):1.9,r:10};
    diodes.push({a:e(anode?'COM':channel),b:e(anode?channel:'COM'),vf,r,id:p.id+':'+channel,parent:p.id,channel,on:false});
   }
   if(p.type==='motor'){
    const previous=this.motorStates[p.id];
    if(p.motorModel==='fa130-18100'){
     const mechanical=advanceFa130(previous,elapsed);
     fa130Frames.set(p.id,mechanical);
     edge(e('+'),e('-'),fa130Model.resistance,p.id,'motor',fa130Model.backEmfConstant*mechanical.omega);
    }else{
     const ke=(p.backEmf??.0016)*60/(2*Math.PI);
     edge(e('+'),e('-'),p.resistance||20,p.id,'motor',ke*(previous?.omega??0));
    }
   }
  }
  // The UNO R3's LMV358 U5B senses D13 without putting the L load on it.
  const bufferedLedSense=circuit.powered&&board.id==='uno-r3'?add('mcu:'+board.ledPin):null;
  const onboardVf=2,onboardDiodeOhms=10;
  if(circuit.powered&&board.ledPin&&!bufferedLedSense){
   const endpoint='mcu:'+board.ledPin;add(endpoint);add('internal:ledA');
   if(board.ledActiveLow){edge(logicRail,'internal:ledA',board.ledResistance||510,'internal:R');diodes.push({a:'internal:ledA',b:endpoint,vf:onboardVf,r:onboardDiodeOhms,id:'onboard',on:false});}
   else{edge(endpoint,'internal:ledA',board.ledResistance||1000,'internal:R');diodes.push({a:'internal:ledA',b:'mcu:GND',vf:onboardVf,r:onboardDiodeOhms,id:'onboard',on:false});}
  }
  for(const s of sources)if(u.find(s.a)===u.find(s.b)&&s.v>0.1)issue('SUPPLY_SHORT','error','电源正负极直接短接','导线把不同电位的电源端直接连在了一起。理想电压源无法满足这个连接。','先删除短接导线；不要在真实电路上照此上电。',s.id);
  const rootSet=new Set([...all].map(x=>u.find(x)));const ground=u.find('mcu:GND');rootSet.delete(ground);const roots=[...rootSet];const idx=new Map(roots.map((x,i)=>[x,i]));const validSources=sources.filter(s=>u.find(s.a)!==u.find(s.b));
  const rcPlans=simplePwmRcPlans({capacitors,components:circuit.components,branches,diodes,sources,pinSources,state,board,u,ground,previous:this.pwmRcStates});
  const rcCarry=new Map(),matrixSources=rcPlans.size?[...validSources]:validSources;
  for(const part of capacitors){
   const previous=this.pwmRcStates.get(part.id),stored=this.capVoltages[part.id]||0;
   const voltage=previous?.part===part?advancePwmRc(stored,this.lastTime,timeMs,previous.command,previous.timeConstantMs):stored;
   if(rcPlans.has(part.id)){
    // The exact state is imposed only inside the matrix. In the physical
    // circuit graph this branch still belongs to the capacitor.
    matrixSources.push({a:part.id+':+',b:part.id+':-',v:voltage});
   }else if(previous?.part===part)rcCarry.set(part.id,voltage);
  }
  const ni=a=>u.find(a)===ground?-1:idx.get(u.find(a));
  // Advancing a readout must not advance physics. A second solve at the same
  // timestamp holds the previous capacitor voltage; only elapsed simulation
  // time commits a new backward-Euler integration step.
  const dt=elapsed>0?elapsed:1e-12;
  const capacitorStamps=capacitors.filter(part=>!rcPlans.has(part.id)).map(part=>{
   const a=part.id+':+',b=part.id+':-';
   const isolated=!connectedNodes.has(u.find(a))&&!connectedNodes.has(u.find(b));
   // A detached can retains its differential voltage without loading the circuit.
   // A very large same-time conductance would erase its tiny ground reference.
   const boundary=!elapsed||rcCarry.has(part.id);
   const g=boundary&&isolated?1:(part.capacitance||100)*1e-6/(boundary?1e-12:dt);
   return {a,b,g,offset:-g*(rcCarry.get(part.id)??(this.capVoltages[part.id]||0))};
  });
  const diodeExcess=(d,values)=>(values[ni(d.a)]??0)-(values[ni(d.b)]??0)-d.vf;
  // Retain the last region only for round-off at the knee. A wider gap can
  // turn off the first diode in a forward series chain during iteration.
  const diodeRegion=(d,values)=>{
   const excess=diodeExcess(d,values);
   return Math.abs(excess)<=1e-12 ? d.on : excess>0;
  };
  const solveMatrix=(networkBranches=branches,networkDiodes=diodes)=>{
   const triedRegions=new Set();
   let volt=new Float64Array(roots.length+matrixSources.length),converged=false,damped=false;
   try{
   for(let iteration=0;iteration<60;iteration++){
    if(!damped){
     const region=networkDiodes.map(d=>d.on?'1':'0').join('');
     damped=triedRegions.has(region)||iteration===30;
     triedRegions.add(region);
    }
    const n=roots.length+matrixSources.length;const A=Array.from({length:n},()=>new Float64Array(n));const b=new Float64Array(n);
    for(let i=0;i<roots.length;i++)A[i][i]=1e-12;
    const conductances=damped?[]:null;
    const stamp=(a,bp,g,offset=0)=>{
     const i=ni(a),j=ni(bp);
     if(i>=0){A[i][i]+=g;b[i]-=offset;}
     if(j>=0){A[j][j]+=g;b[j]+=offset;}
     if(i>=0&&j>=0){A[i][j]-=g;A[j][i]-=g;}
     if(conductances)conductances.push([i,j,g]);
    };
    for(const e of networkBranches)stamp(e.a,e.b,1/e.r,-(e.emf||0)/e.r);
    for(const d of networkDiodes){
     // The fallback keeps tiny numerical leakage continuous at the knee.
     const leakage=damped||!d.on?1e-10:0;
     stamp(d.a,d.b,leakage+(d.on?1/d.r:0),d.on?-d.vf/d.r:0);
    }
    for(const {a,b,g,offset} of capacitorStamps)stamp(a,b,g,offset);
    matrixSources.forEach((s,k)=>{const i=ni(s.a),j=ni(s.b),q=roots.length+k;if(i>=0){A[i][q]+=1;A[q][i]+=1;}if(j>=0){A[j][q]-=1;A[q][j]-=1;}b[q]=s.v;});
    const next=linearSolve(A,b);
    const switches=networkDiodes.filter(d=>diodeRegion(d,next)!==d.on);
    if(!switches.length){volt=next;converged=true;break;}
    if(damped){
     const delta=next.map((value,index)=>value-volt[index]);
     let curvature=0;
     for(let i=0;i<roots.length;i++)curvature+=1e-12*delta[i]**2;
     for(const [i,j,g] of conductances)curvature+=g*((delta[i]??0)-(delta[j]??0))**2;
     const crossings=switches.map(d=>{
      const initial=diodeExcess(d,volt);
      return {on:d.on,initial,change:diodeExcess(d,next)-initial,resistance:d.r};
     });
     const fraction=diodeLineFraction(curvature,crossings);
     volt=fraction===1?next:volt.map((value,index)=>value+fraction*delta[index]);
    }else volt=next;
    for(const d of networkDiodes)d.on=diodeRegion(d,volt);
   }
   }catch(error){return {volt,converged,error};}
   return {volt,converged};
  };
  const valueAt=(values,endpoint)=>{const i=ni(endpoint);return i>=0&&Number.isFinite(values[i])?values[i]:0;};
  let solved=solveMatrix();
  const bridgePlans=new Map(),bridgeFeeds=new Set();
  if(bridges.length&&solved.converged&&!issues.some(item=>item.code==='SUPPLY_SHORT')){
   // Establish the carrier rail without output drive. VIN passes only with
   // forward polarity; a separately powered VMM works without this link.
   for(const part of bridges){
    const vin=part.id+':VIN',vmm=part.id+':VMM',gnd=part.id+':GND';
    const otherFeed=validSources.some(source=>u.find(source.a)===u.find(vmm)||u.find(source.b)===u.find(vmm));
    if(!otherFeed&&u.find(vin)!==u.find(vmm)&&valueAt(solved.volt,vin)-valueAt(solved.volt,gnd)>.1){
     edge(vin,vmm,reversePassOhms,part.id+':pass','bridge-pass');
     bridgeFeeds.add(part.id);
    }
   }
   if(bridgeFeeds.size)solved=solveMatrix();
   const mcuNodes=new Set(board.gpioPins.map(pin=>u.find('mcu:'+pin)));
   const pwmNodes=new Set(Object.entries(state.pins??{}).filter(([,pin])=>pin.pwm?.duty>0&&pin.pwm.duty<1)
    .map(([pin])=>u.find('mcu:'+canonicalPin(pin,board.id))));
   const outputNodes=new Set(bridges.flatMap(part=>['AOUT1','AOUT2','BOUT1','BOUT2'].map(pin=>u.find(part.id+':'+pin))));
   const inspectBridge=(part,values)=>{
    const endpoint=pin=>part.id+':'+pin;
    const volts=pin=>valueAt(values,endpoint(pin))-valueAt(values,endpoint('GND'));
    const controls=[...drv8833Inputs,'SLP'].map(pin=>u.find(endpoint(pin)));
    const supplyPin=bridgeFeeds.has(part.id)?'VIN':'VMM';
    const inputVoltage=volts(supplyPin),voltage=volts('VMM');
    const sleep=connectedNodes.has(u.find(endpoint('SLP')))?drv8833Logic(volts('SLP'),true):1;
    const reason=inputVoltage<2.7-1e-6||inputVoltage>10.8+1e-6?'supply':
     u.find(endpoint('GND'))!==ground&&controls.some(node=>mcuNodes.has(node))?'ground':
     controls.some(node=>outputNodes.has(node))?'feedback':sleep===null?'input':null;
    const sleeping=reason===null&&sleep===0;
    const channels=Object.fromEntries(drv8833Channels.map(channel=>{
     const inputs=[1,2].map(number=>drv8833Logic(volts(channel+'IN'+number)));
     const channelReason=reason??(inputs.includes(null)?'input':null);
     const mode=channelReason||sleeping?'coast':drv8833Mode(...inputs);
     return [channel,{mode,inputs,reason:channelReason,switches:drv8833Switches(mode,voltage)}];
    }));
    return {voltage,inputVoltage,supplyPin,reason,sleeping,channels,pwm:controls.some(node=>pwmNodes.has(node))};
   };
   const firstSwitch=branches.length;
   if(solved.converged){
    for(const part of bridges){
     const plan=inspectBridge(part,solved.volt);
     bridgePlans.set(part.id,plan);
     for(const [channel,{switches}] of Object.entries(plan.channels))for(const [index,sw] of switches.entries()){
      edge(part.id+':'+channel+'OUT'+(index+1),part.id+':'+sw.rail,sw.resistance,part.id+':'+channel+':'+index,'bridge-switch');
     }
    }
    if(branches.length>firstSwitch){
     solved=solveMatrix();
     if(solved.converged){
      const disabled=new Set();
      for(const part of bridges){
       const old=bridgePlans.get(part.id),loaded=inspectBridge(part,solved.volt);
       if(drv8833Channels.every(channel=>old.channels[channel].mode===loaded.channels[channel].mode))continue;
       const reason=loaded.reason??'feedback';
       for(const channel of Object.values(loaded.channels))Object.assign(channel,{mode:'coast',reason,switches:[]});
       bridgePlans.set(part.id,{...loaded,reason});
       disabled.add(part.id);
      }
      if(disabled.size){
       for(let index=branches.length-1;index>=firstSwitch;index--){
        if(disabled.has(branches[index].id.split(':')[0]))branches.splice(index,1);
       }
       solved=solveMatrix();
      }
     }
    }
   }
  }
  const sensorFrames=new Map();
  if(sensors.length){
   const mcuNodes=new Set(board.gpioPins.map(pin=>u.find('mcu:'+pin)));
   const badSolve=!solved.converged||issues.some(item=>item.code==='SUPPLY_SHORT');
   const firstEcho=branches.length;
   for(const sensor of sensors){
    const id=sensor.id,endpoint=pin=>id+':'+pin;
    const returnNode=u.find(endpoint('GND')),triggerNode=u.find(endpoint('TRIG'));
    const measured=pin=>valueAt(solved.volt,endpoint(pin))-valueAt(solved.volt,endpoint('GND'));
    const voltage=badSolve?null:measured('VCC');
    const groundMissing=hcsr04Powered(voltage)&&returnNode!==ground&&mcuNodes.has(triggerNode);
    const shortedTrigger=triggerNode===u.find(endpoint('ECHO'));
    const reason=badSolve||shortedTrigger?'conflict':groundMissing?'ground':null;
    const frame=advanceUltrasonic(sensor,this.ultrasonicStates.get(id),timeMs,{voltage,
     triggerLevel:hcsr04TriggerLevel(measured('TRIG')),reason});
    sensorFrames.set(id,frame);
    if(frame.data.powered&&!badSolve){
     edge(endpoint('ECHO'),endpoint(frame.data.echoLevel?'VCC':'GND'),hcsr04EchoOhms,id+':echo','ultrasonic-echo');
    }
   }
   if(branches.length>firstEcho){
    solved=solveMatrix();
    if(solved.converged){
     let shed=false;
     for(let index=branches.length-1;index>=firstEcho;index--){
      const id=branches[index].id.slice(0,-5),frame=sensorFrames.get(id);
      const voltage=valueAt(solved.volt,id+':VCC')-valueAt(solved.volt,id+':GND');
      if(hcsr04Powered(voltage))continue;
      sensorFrames.set(id,advanceUltrasonic({},frame.state,timeMs,{voltage,triggerLevel:null}));
      branches.splice(index,1);
      shed=true;
     }
     if(shed)solved=solveMatrix();
    }
   }
  }
  const referenceRoots=new Set([ground]);
  for(const v of validSources)if(u.find(v.b)===ground){referenceRoots.add(u.find(v.a));referenceRoots.add(u.find(v.b));}
  const servoDrivers=hs55Parts.length?Object.entries(pinSources):[];
  const servoFrameAt=(part,values,conflict)=>{
   const signal=part.id+':SIG',groundPin=part.id+':GND',signalRoot=u.find(signal);
   const linked=servoDrivers.filter(([,driver])=>u.find(driver.node)===signalRoot);
   const [name,driver]=linked.length===1?linked[0]:[];
   const measured=pin=>valueAt(values,pin)-valueAt(values,groundPin);
   const signalVoltage=measured(signal);
   const matchesLevel=driver&&(driver.level?signalVoltage>=board.logicHighThreshold:signalVoltage<=board.logicLowThreshold);
   const signalValid=Boolean(matchesLevel&&!openDrain(driver.mode)&&!referenceRoots.has(signalRoot)&&!state.error);
   return hs55Frame(part,this.servoStates.get(part.id),elapsed*1000,{
    voltage:measured(part.id+':VCC'),grounded:u.find(groundPin)===ground,
    signalPin:name?canonicalPin(name,board.id):null,pwm:state.pins?.[name]?.pwm,signalValid,conflict
   });
  };
  if(hs55Parts.length&&solved.converged&&!issues.some(issue=>issue.code==='SUPPLY_SHORT')){
   // Use the standing circuit to decide whether the command requests motion.
   // Then solve the requested load and hold the shaft if that load drops VCC.
   for(const [part,load] of servoLoads){
    load.running=servoFrameAt(part,solved.volt,false).data.moving;
   }
   let loadChanged=false;
   for(let pass=0;pass<4;pass++){
    loadChanged=false;
    for(const {branch,running} of servoLoads.values()){
     const voltage=valueAt(solved.volt,branch.a)-valueAt(solved.volt,branch.b);
     const line=hs55LoadLine(running,voltage);
     if(branch.r===line.r)continue;
     Object.assign(branch,line);
     loadChanged=true;
    }
    if(!loadChanged)break;
    solved=solveMatrix();
    if(!solved.converged)break;
   }
   if(loadChanged&&solved.converged&&[...servoLoads.values()].some(({branch,running})=>
      branch.r!==hs55LoadLine(running,valueAt(solved.volt,branch.a)-valueAt(solved.volt,branch.b)).r)){
    // Keep a bounded passive branch for unusually coupled load networks.
    for(const {branch,running} of servoLoads.values())Object.assign(branch,hs55LoadLine(running,0));
    solved=solveMatrix();
    issue('SERVO_LOAD_LIMIT','info','舵机支路使用低压等效负载','多个耦合支路未在当前求解步内完成耗流区域判定。','为舵机提供稳定电源后复测。');
   }
  }
  const relayFrames=new Map();
  const rootSources={};
  for(const [name,p] of Object.entries(pinSources)){
   const rt=u.find(p.node);
   if(rootSources[rt]&&rootSources[rt].level!==p.level)
    issue('OUTPUT_CONFLICT','error','两个推挽输出互相对抗',rootSources[rt].name+' 与 '+name+' 被导线直接连在一起，一个输出高、一个输出低。','删除直连，或调整为正确的输入/开漏总线结构。',name);
   else rootSources[rt]={...p,name};
  }
  if(relays.length&&solved.converged&&!issues.some(issue=>['SUPPLY_SHORT','OUTPUT_CONFLICT'].includes(issue.code))){
   const drivers=Object.entries(pinSources);
   const initial=solved.volt;
   const differential=(values,a,b)=>valueAt(values,a)-valueAt(values,b);
   for(const part of relays){
    const id=part.id,vcc=id+':VCC',gnd=id+':GND',sig=id+':SIG';
    const supplyAttached=wiredTerminals.has(vcc)&&wiredTerminals.has(gnd);
    const connected=wiredTerminals.has(sig);
    const voltage=differential(initial,vcc,gnd);
    const powerReady=supplyAttached&&groveRelayPowered(voltage);
    const inputHigh=groveRelayHigh(differential(initial,sig,gnd));
    const linked=drivers.filter(([,driver])=>u.find(driver.node)===u.find(sig));
    const [pin,driver]=linked.length===1?linked[0]:[];
    const wave=driver&&!openDrain(driver.mode)&&u.find(gnd)===ground?
      groveRelayWave(state.pins?.[pin]?.pwm,timeMs):null;
    const coil=powerReady&&connected?{a:vcc,b:gnd,r:groveRelayLoadOhms(voltage),id:id+':coil',kind:'relay-coil',emf:0}:null;
    const coilOn=Boolean(coil&&inputHigh);
    if(coilOn)branches.push(coil);
    relayFrames.set(part,{vcc,gnd,sig,connected,supplyAttached,inputHigh,pin,driver,wave,coil,coilOn});
   }
   if([...relayFrames.values()].some(frame=>frame.coilOn))solved=solveMatrix();
   if(solved.converged)for(const [part,frame] of relayFrames){
    const {vcc,gnd,sig,pin,driver,connected,supplyAttached,coil,coilOn,wave}=frame;
    const powered=supplyAttached&&groveRelayPowered(differential(solved.volt,vcc,gnd));
    let phaseReady=powered,signalReady=true;
    if(powered&&coil&&!coilOn&&wave?.phaseMs!=null&&wave.pulseMs>0&&wave.pulseMs<wave.periodMs){
     // While sampled low, check the real circuit under a high PWM level.
     // A shorted signal or sagging feed cannot credit unseen high pulses.
     const driven=branches.map(branch=>branch.kind==='driver'&&branch.id==='driver:'+pin?
       {...branch,b:logicRail}:branch);
     const high=solveMatrix([...driven,coil],diodes.map(diode=>({...diode})));
     phaseReady=high.converged&&groveRelayPowered(differential(high.volt,vcc,gnd));
     signalReady=groveRelayHigh(differential(high.volt,sig,gnd));
    }
    const inputHigh=groveRelayHigh(differential(solved.volt,sig,gnd));
    const controller=advanceGroveRelay(this.relayStates.get(part.id),part,timeMs,{
     powered:powered&&phaseReady,connected:connected&&signalReady,inputHigh,controlKey:[vcc,gnd,sig].map(node=>u.find(node)).join('|'),
     wave:driver&&Boolean(driver.level)===inputHigh?wave:null
    });
    Object.assign(frame,{powered,phaseReady,signalReady,inputHigh,controller});
   }
   let contactsChanged=false;
   for(const [part,frame] of relayFrames)if(frame.controller?.closed){
    edge(part.id+':COM',part.id+':NO',groveRelayContactOhms,part.id+':contact','relay-contact');
    contactsChanged=true;
   }
   if(contactsChanged)solved=solveMatrix();
  }
  const {volt,converged,error}=solved;
  if(error)issue('ELECTRICAL_CONFLICT','error','连接存在电压冲突或悬空理想电源环','理想电源无法同时满足这些连接。','检查两个电源是否直接对接，或者正负端是否短路。');
  if(!converged&&!issues.some(x=>x.severity==='error'))issue('SOLVER_LIMIT','warning','当前电路未收敛','这个简化模型无法可靠求解当前连接；显示的值不作为有效读数。','简化电路，检查电源与二极管方向。');
  const V=endpoint=>valueAt(volt,endpoint);
  const netVoltages={};for(const e of all)netVoltages[e]=V(e);
  // Check electrical bias paths, not merely the GPIO input-mode label.
  const biasGraph=new Map();
  const connectBias=(a,b,r)=>{a=u.find(a);b=u.find(b);if(!biasGraph.has(a))biasGraph.set(a,[]);if(!biasGraph.has(b))biasGraph.set(b,[]);biasGraph.get(a).push([b,r]);biasGraph.get(b).push([a,r]);};
  for(const e of branches)connectBias(e.a,e.b,e.r);
  for(const d of diodes)if(d.on)connectBias(d.a,d.b,d.r);
  const hasBiasPath=endpoint=>{
   const start=u.find(endpoint),queue=[[start,0]],best=new Map([[start,0]]);
   while(queue.length){const [node,r]=queue.shift();if(referenceRoots.has(node))return true;
    for(const [next,resistance] of biasGraph.get(node)||[]){const total=r+resistance;if(total<=200000&&total<(best.get(next)??Infinity)){best.set(next,total);queue.push([next,total]);}}
   }return false;
  };
  for(const name of floatingInputs)if(!hasBiasPath('mcu:'+name))
   issue('INPUT_FLOATING','warning',name+' 缺少明确的电平参考','当前连接没有找到到已知电位的有效驱动或偏置路径；电压求解中的微小数值稳定项不代表真实下拉。','添加适当的上下拉电阻或可靠外部驱动；按钮接地时可用 GPIO_Mode_IPU。',name);
  for(const name of releasedDrains)issue('OPEN_DRAIN','info',name+' 的开漏输出已释放','写1表示不再主动拉低；当前电平由外部电路决定。',hasBiasPath('mcu:'+name)?'已找到外部偏置路径，查看节点电压是否符合预期。':'若需要高电平，请增加适当的上拉电阻到'+board.logicVoltage+'V。',name);
  const adcPin=channel=>typeof channel==='string'?canonicalPin(channel,board.id):board.family.startsWith('STM32')?['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7','PB0','PB1','PC0','PC1','PC2','PC3','PC4','PC5'][channel]:board.analogPins[channel];
  for(const a of Object.values(state.adc??{}))if(a.enabled){
   const name=adcPin(a.pin??a.channel);
   if(name&&!hasBiasPath('mcu:'+name))issue('ADC_INPUT_FLOATING','warning',name+' 的模拟输入缺少电压来源','模型中没有找到有效电压或电阻偏置路径；显示接近0不代表实物悬空时会稳定读0。','连接电位器中间脚、可靠传感器输出或合适偏置，并共地。',name);
  }

  const canCommitCaps=converged&&!issues.some(issue=>issue.code==='SUPPLY_SHORT'||issue.code==='ELECTRICAL_CONFLICT');
  const canCommitRc=canCommitCaps&&!issues.some(issue=>issue.code==='OUTPUT_CONFLICT');
  this.pwmRcStates=canCommitRc?rcPlans:new Map();
  const motorBridgeFor=branch=>{
   const positive=u.find(branch.a),negative=u.find(branch.b);
   if(positive===negative)return null;
   const matches=[];
   for(const [id,plan] of bridgePlans)for(const [channel,data] of Object.entries(plan.channels)){
    const first=u.find(id+':'+channel+'OUT1'),second=u.find(id+':'+channel+'OUT2');
    if((positive===first&&negative===second)||(positive===second&&negative===first)){
     matches.push({id,channel,reversed:positive===second,...data});
    }
   }
   return matches.length===1?matches[0]:null;
  };
  const boardContactNodes=new Set(boardContacts.map(({a})=>u.find(a)));
  const mountedTerminals=new Set(partContacts.map(({a})=>a)),partContactsPerNode=new Map();
  for(const endpoint of mountedTerminals){const node=u.find(endpoint);partContactsPerNode.set(node,(partContactsPerNode.get(node)||0)+1);}
  const attachedTerminal=endpoint=>{
   if(wiredTerminals.has(endpoint))return true;
   if(!mountedTerminals.has(endpoint))return false;
   const node=u.find(endpoint);
   return wireNodes.has(node)||boardContactNodes.has(node)||partContactsPerNode.get(node)>1;
  };
  for(const p of circuit.components){
   const data={type:p.type,...parts[p.id]};parts[p.id]=data;
   if(p.type==='led'){
    const d=diodes.find(d=>d.id===p.id);data.voltage=V(d.a)-V(d.b);data.currentMa=Math.max(0,(data.voltage-d.vf)/d.r*1000);data.brightness=Math.min(1,data.currentMa/7);
    const attached=attachedTerminal(d.a)&&attachedTerminal(d.b);
    if(!attached)issue('OPEN_CIRCUIT','warning',p.id+' 没有完整回路','LED 的一端或两端没有通过跳线或面包板插脚接入电路。','正向连接：输出 → 电阻 → A；K → GND。',p.id);
    if(data.voltage<-.3)issue('LED_REVERSED','error',p.id+' 正负极接反','K 端电压高于 A 端，LED 处于反向偏置。','调换 A/K 接法，保留串联限流电阻。',p.id);
    if(data.currentMa>(p.maxMa||20))issue('LED_OVERCURRENT','error',p.id+' 电流过大，检查限流电阻','模型电流约 '+data.currentMa.toFixed(1)+' mA，超过本模型设定的 LED 连续电流上限。','增加串联电阻；按供电电压、LED压降和目标电流计算。',p.id);
    if(data.currentMa>0.001&&data.currentMa<.2)issue('LED_DIM','info',p.id+' 电流很小','灯可能很暗；串联电阻可能偏大。','查看电阻阻值与支路电流，勿直接去掉电阻。',p.id);
    if(u.find(d.a)===u.find(d.b))issue('COMPONENT_BYPASSED','warning',p.id+' 被同一导通组短接','LED 两脚处在同一节点，灯两端没有电压差。','检查面包板同组孔，或删除跨接 LED 的导线。',p.id);
   }
   if(p.type==='resistor'){data.voltage=V(p.id+':1')-V(p.id+':2');data.currentMa=data.voltage/(p.resistance||330)*1000;data.power=data.voltage*data.voltage/(p.resistance||330);if(data.power>.25)issue('RESISTOR_POWER','error',p.id+' 功率超过 0.25 W','按当前电压计算，电阻可能过热。','增加阻值、降低电压，或选用适当额定功率的电阻。',p.id);}
   if(p.type==='ldr'||p.type==='thermistor'){const branch=branches.find(e=>e.id===p.id);data.resistance=branch.r;data.voltage=V(branch.a)-V(branch.b);data.currentMa=data.voltage/branch.r*1000;}
   if(p.type==='switch')data.closed=Boolean(p.closed);
   if(p.type==='dipswitch'){
    data.switches.forEach((contact,index)=>{
     const [a,b]=dipSwitchPairs[index];
     contact.currentMa=!contact.closed?0:canCommitRc?(V(p.id+':'+a)-V(p.id+':'+b))*1000/dipSwitchContactOhms:null;
    });
   }
   if(p.type==='diode'){
    const d=diodes.find(d=>d.id===p.id);data.voltage=V(d.a)-V(d.b);data.currentMa=Math.max(0,(data.voltage-d.vf)/d.r*1000);data.conducting=data.currentMa>.001;
    if(data.currentMa>(p.maxMa||100))issue('DIODE_OVERCURRENT','error',p.id+' 超过二极管模型电流上限','当前电流约'+data.currentMa.toFixed(1)+'mA，超过元件设置。','增加限流，核对真实型号允许电流与散热。',p.id);
   }
   if(p.type==='rgbled'||p.type==='sevenseg'){
    const group=p.type==='rgbled'?'channels':'segments';data[group]={};data.common=kingbrightRgb(p)?'cathode':p.common||'cathode';
    for(const d of diodes.filter(d=>d.parent===p.id)){
     const voltage=V(d.a)-V(d.b),currentMa=Math.max(0,(voltage-d.vf)/d.r*1000);
     data[group][d.channel]={voltage,currentMa,brightness:Math.min(1,currentMa/7),displayBrightness:Math.min(1,currentMa/7)};
     if(currentMa>(p.maxMa||20))issue('LED_OVERCURRENT','error',p.id+' 的'+d.channel+'支路电流过大','每个发光支路都必须有独立限流，当前约'+currentMa.toFixed(1)+'mA。','为每路增加串联限流电阻，不能只给公共端共用一个电阻。',p.id+':'+d.channel);
     if(voltage<-.3)issue('LED_REVERSED','warning',p.id+' 的'+d.channel+'支路反向偏置','公共端类型或驱动极性可能不符。','确认共阴COM接低电位、共阳COM接高电位。',p.id+':'+d.channel);
    }
   }
   if(p.type==='pot')data.voltage=V(p.id+':OUT');
   if(p.type==='buzzer'){data.voltage=V(p.id+':+')-V(p.id+':-');data.on=data.voltage>=2.5;if(data.voltage<-.3)issue('POLARITY','error',p.id+' 电源极性接反','有源蜂鸣器有正负极。','交换供电接线。',p.id);}
   if(p.type==='capacitor'){
    data.voltage=V(p.id+':+')-V(p.id+':-');
    if(elapsed>0&&(rcPlans.has(p.id)||rcCarry.has(p.id)?canCommitRc:canCommitCaps))this.capVoltages[p.id]=data.voltage;
    const plan=this.pwmRcStates.get(p.id),command=plan?.command;
    if(command?.periodMs!==undefined){
     const {frequencyHz,duty,voltageLow,voltageHigh,startMs,periodMs}=command;
     data.pwmRc={pin:plan.pin,frequencyHz,duty,timeConstantMs:plan.timeConstantMs,voltageLow,voltageHigh,
      phaseMs:pwmPhaseMs(timeMs,startMs,periodMs),...pwmRcEnvelope(command,plan.timeConstantMs)};
    }
    if(data.voltage<-.3)issue('CAP_REVERSED','error',p.id+' 电解电容极性接反','电容负极条纹侧电位更高，超出了模型设定的正确极性。','正极接高电位，条纹负极接低电位。',p.id);
   }
   if(fa130Frames.has(p.id)){
    const branch=branches.find(edge=>edge.id===p.id),match=motorBridgeFor(branch);
    const mechanical=canCommitRc?fa130Frames.get(p.id):this.motorStates[p.id]??{omega:0,angle:0};
    data.voltage=canCommitRc?V(branch.a)-V(branch.b):null;
    const windingCurrent=canCommitRc?(data.voltage-branch.emf)/branch.r:0;
    const current=Math.abs(windingCurrent)>1e-8?windingCurrent:0;
    data.currentMa=canCommitRc?current*1000:null;
    data.rpm=mechanical.omega*60/(2*Math.PI);
    data.angleDeg=((mechanical.angle*180/Math.PI)%360+360)%360;
    data.backEmf=fa130Model.backEmfConstant*mechanical.omega;
    if(match){
     const {id,channel,mode,reversed}=match;
     data.bridge={id,channel,mode,reversed};
    }
    const directlyDriven=matrixSources.some(source=>{
     const a=u.find(source.a),b=u.find(source.b),p=u.find(branch.a),n=u.find(branch.b);
     return a===p&&b===n||a===n&&b===p;
    });
    let conductance=directlyDriven||u.find(branch.a)===u.find(branch.b)||current!==0?1/branch.r:0;
    if(match?.switches.length){
     const path=match.switches.reduce((sum,sw)=>sum+sw.resistance,0);
     const pass=bridgeFeeds.has(match.id)&&match.switches.some(sw=>sw.rail==='VMM')?reversePassOhms:0;
     conductance=1/(branch.r+path+pass);
    }
    const drive=canCommitRc?fa130Drive(current,mechanical.omega,conductance):null;
    this.motorStates[p.id]={omega:mechanical.omega,angle:mechanical.angle,drive};
    if(Math.abs(data.voltage)>3.05&&current!==0)issue('FA130_SUPPLY','warning',p.id+' 绕组电压超出额定范围','此 FA-130RA-18100 的厂家工作范围为 1.5–3.0 V。','选择合适的电机电源，核查驱动和负载电流。',p.id);
    issue('MOTOR_MODEL_LIMIT','info',p.id+' 使用 FA-130RA-18100 空载模型','以厂家额定点拟合绕组和转动参数。惯量为演示估计，省略电感、机械负载和温升。','用实际电源、驱动器和机械负载验证。',p.id);
   }else if(p.type==='motor'){
    const branch=branches.find(e=>e.id===p.id),stored=this.motorStates[p.id];
    const previous={omega:stored?.omega??0,angle:stored?.angle??0};
    if(stored&&Object.hasOwn(stored,'drive'))this.motorStates[p.id]=previous;
    data.voltage=V(branch.a)-V(branch.b);data.currentMa=(data.voltage-branch.emf)/branch.r*1000;
    let mechanical={...previous};
    if(elapsed>0&&converged&&!issues.some(x=>x.code==='SUPPLY_SHORT'||x.code==='ELECTRICAL_CONFLICT')){
     const ke=(p.backEmf??.0016)*60/(2*Math.PI),damping=ke*ke/branch.r+(p.friction??.000002),inertia=Math.max(1e-9,p.inertia??.000001),tau=inertia/damping;
     const steady=ke*data.voltage/branch.r/damping,decay=Math.exp(-elapsed/tau);
     mechanical.omega=steady+(previous.omega-steady)*decay;
     mechanical.angle=previous.angle+steady*elapsed+(previous.omega-steady)*tau*(1-decay);
     this.motorStates[p.id]=mechanical;
    }
    data.rpm=mechanical.omega*60/(2*Math.PI);data.angleDeg=((mechanical.angle*180/Math.PI)%360+360)%360;data.backEmf=branch.emf;
    issue('MOTOR_MODEL_LIMIT','info',p.id+' 使用简化机电模型','模型按外部时间步积分，未模拟PWM逐边沿、电感、换向与温升；转速不代表某个真实电机。','用适当晶体管/H桥与续流保护；真实选型需核对启动电流和机械负载。',p.id);
   }
   if(p.type==='servo'&&p.servoModel!=='hs55'){
    data.voltage=V(p.id+':VCC')-V(p.id+':GND');const root=u.find(p.id+':SIG');const source=Object.entries(state.pins??{}).find(([name])=>u.find('mcu:'+name)===root);const pwm=source?.[1]?.pwm;
    data.angle=p.angle??90;data.active=false;
    if(data.voltage<4.5)issue('SERVO_SUPPLY','warning',p.id+' 供电不足','这个舵机模型使用 5V 供电范围；3.3V 控制信号与供电不是同一件事。','VCC 接 5V，GND 共地，信号脚接 PWM 引脚。',p.id);
    else if(pwm&&(pwm.frequencyHz||pwm.frequency)>40&&(pwm.frequencyHz||pwm.frequency)<60){const width=pwm.duty/(pwm.frequencyHz||pwm.frequency)*1000;data.angle=Math.max(0,Math.min(180,(width-1)*180));data.active=true;}
    else issue('SERVO_PWM','warning',p.id+' 未收到有效舵机脉冲','模型需要约 50Hz、1–2ms 的控制脉冲。','检查定时器启动、复用输出配置及信号接线。',p.id);
   }
   if(p.type==='power'&&u.find(p.id+':-')!==ground)issue('COMMON_GROUND','warning',p.id+' 没有与开发板共地','外部电源负极与开发板 GND 没有用导线直接连接。涉及跨设备信号时缺少共同参考。','将外部电源负极与开发板 GND 相连，再检查是否引入短路。',p.id);
  }
  for(const e of branches.filter(b=>b.kind==='driver')){const current=(V(e.a)-V(e.b))/e.r*1000;if(Math.abs(current)>board.gpioWarningMa)issue('GPIO_OVERCURRENT','error',e.id.replace('driver:','')+' 驱动电流偏大','简化输出模型电流约 '+Math.abs(current).toFixed(1)+' mA；这是教学报警阈值，应核查具体器件的引脚和总电流限制。','使用限流电阻；电机/大负载应使用适当驱动电路。',e.id.replace('driver:',''));}
  for(const [name,pin] of Object.entries(state.pins??{})){
   if(/AIN|analog/i.test(String(pin.mode))&&all.has('mcu:'+name)&&(V('mcu:'+name)>board.logicVoltage+.01||V('mcu:'+name)<-.01))
    issue('ADC_OVERVOLTAGE','error',name+' 超过当前模拟输入范围','当前教学模型的模拟参考范围是0–'+board.logicVoltage+'V；数字输入的容限不能直接当作模拟输入范围。','降低输入电压，核查模拟参考电源与当前引脚的数据手册限制。',name);
  }
  const supplyConflict=issues.some(issue=>issue.code==='SUPPLY_SHORT'||issue.code==='ELECTRICAL_CONFLICT');
  const probeRoot=endpoint=>{
   if(typeof endpoint!=='string')return null;
   if(all.has(endpoint))return u.find(endpoint);
   const group=bbGroup(endpoint);
   if(group===endpoint)return null;
   return u.p.has(group)?u.find(group):group;
  };
  const probeBlocked=!converged||supplyConflict||issues.some(issue=>issue.code==='OUTPUT_CONFLICT');
  if(sensors.length||this.ultrasonicStates.size){
   this.ultrasonicStates=new Map();
   const driveNodes=new Set(Object.values(pinSources).map(driver=>u.find(driver.node)));
   const gpioNodes=new Set(board.gpioPins.map(pin=>u.find('mcu:'+pin)));
   for(const sensor of sensors){
    const frame=sensorFrames.get(sensor.id),data=parts[sensor.id],echo=sensor.id+':ECHO';
    const echoNode=u.find(echo),sensorGround=sensor.id+':GND';
    const reading=probeBlocked?advanceUltrasonic(sensor,null,timeMs,{voltage:null,triggerLevel:null,reason:'conflict'}).data:frame.data;
    const echoVoltage=reading.powered?V(echo)-V(sensorGround):null;
    const echoLevel=echoVoltage===null?null:hcsr04TriggerLevel(echoVoltage);
    Object.assign(data,reading,{echoVoltage,echoDrivenLevel:reading.echoLevel,echoLevel});
    if(!probeBlocked&&frame.state)this.ultrasonicStates.set(sensor.id,frame.state);
    if(reading.status==='unpowered')issue('ULTRASONIC_SUPPLY','warning',sensor.id+' 需要 5 V 供电','模型工作窗口为 4.75–5.25 V。供电不足时 ECHO 不驱动。','检查 VCC、GND 与电源。',sensor.id);
    if(reading.status==='ground'||reading.powered&&gpioNodes.has(echoNode)&&u.find(sensorGround)!==ground)
     issue('ULTRASONIC_GROUND','warning',sensor.id+' 未与开发板共地','TRIG 和 ECHO 需要可靠的电平参考。','连接传感器 GND 与开发板 GND。',sensor.id);
    if(!probeBlocked&&(reading.status==='conflict'||driveNodes.has(echoNode)||reading.powered&&echoLevel!==reading.echoLevel))
     issue('ULTRASONIC_ECHO_CONFLICT','warning',sensor.id+' 的 ECHO 电平受接线或负载影响','ECHO 是输出脚。另一个输出、短接或重负载会改变实际电平。','检查端点，让测量引脚处于输入模式。',sensor.id);
    if(reading.powered&&board.logicVoltage<4.5&&gpioNodes.has(echoNode))
     issue('ULTRASONIC_ECHO_LEVEL','warning',sensor.id+' 的 ECHO 可接近 5 V','此板的逻辑电压低于 5 V。实际是否可直连取决于对应输入脚的容限。','核查引脚规格，必要时加分压或电平转换。',sensor.id);
   }
  }
  if(hs55Parts.length||this.servoStates.size){
   const next=new Map();
   for(const part of hs55Parts){
    const frame=servoFrameAt(part,volt,probeBlocked);
    const {branch,running}=servoLoads.get(part);
    const loadMa=probeBlocked?null:(frame.data.voltage-branch.emf)*1000/branch.r;
    const currentMa=loadMa!==null&&Math.abs(loadMa)<1e-6?0:loadMa;
    const loadMode=probeBlocked?'unavailable':frame.data.voltage<=hs55Epsilon?'unpowered':
     running?(frame.data.moving?'running':'supply-limited'):'standing';
    next.set(part.id,frame.state);
    Object.assign(parts[part.id],frame.data,{currentMa,loadMode});
    const message=hs55Issues[frame.data.reason];
    if(message){const [code,title,plain,fix]=message;issue(code,'warning',part.id+' '+title,plain,fix,part.id);}
   }
   this.servoStates=next;
  }
  let probeIslands;
  function measureBetween(red,black){
   if(probeBlocked)return {status:'unavailable',voltage:null};
   const positive=probeRoot(red),negative=probeRoot(black);
   if(positive===null||negative===null)return {status:'unavailable',voltage:null};
   if(positive===negative)return {status:'measured',voltage:0};
   if(!probeIslands){
    // Only real circuit elements provide a shared reference. The solver's
    // numerical ground leakage does not make two floating islands measurable.
    probeIslands=new UnionFind();
    for(const [node,paths] of biasGraph)for(const [other] of paths)probeIslands.join(node,other);
    for(const source of validSources)probeIslands.join(u.find(source.a),u.find(source.b));
    for(const cap of capacitors)probeIslands.join(u.find(cap.id+':+'),u.find(cap.id+':-'));
   }
   if(probeIslands.find(positive)!==probeIslands.find(negative))return {status:'floating',voltage:null};
   const positiveVoltage=positive===ground?0:volt[idx.get(positive)];
   const negativeVoltage=negative===ground?0:volt[idx.get(negative)];
   const voltage=positiveVoltage-negativeVoltage;
   return Number.isFinite(voltage)?{status:'measured',voltage}:{status:'unavailable',voltage:null};
  }
  for(const part of circuit.components){
   if(part.type!=='joystick')continue;
   const localVoltage=pin=>measureBetween(part.id+':'+pin,part.id+':GND').voltage;
   Object.assign(parts[part.id],{supplyVoltage:localVoltage('VCC'),horizontalVoltage:localVoltage('HORIZ'),
    verticalVoltage:localVoltage('VERT'),selectVoltage:localVoltage('SEL')});
  }
  if(relays.length||this.relayStates.size){
   this.relayStates=new Map();
   for(const part of relays){
    const {id}=part,frame=relayFrames.get(part),endpoint=pin=>id+':'+pin;
    const controller=probeBlocked?null:frame?.controller;
    if(controller)this.relayStates.set(id,controller);
    const voltage=probeBlocked?null:V(endpoint('VCC'))-V(endpoint('GND'));
    const signalVoltage=probeBlocked?null:V(endpoint('SIG'))-V(endpoint('GND'));
    const coilOn=Boolean(controller&&frame.coilOn);
    const closed=Boolean(controller?.closed);
    const contactVoltage=measureBetween(endpoint('COM'),endpoint('NO')).voltage;
    const currentMa=voltage===null?null:voltage*1000*(1/groveRelayIdleOhms+(coilOn?1/frame.coil.r:0));
    const contactCurrentMa=probeBlocked?null:closed&&contactVoltage!==null?contactVoltage/groveRelayContactOhms*1000:0;
    const reason=probeBlocked?'conflict':!frame?.powered||!frame.phaseReady?'supply':!frame.connected||!frame.signalReady?'signal':null;
    Object.assign(parts[id],{voltage,signalVoltage,powered:Boolean(controller&&frame.powered),
     inputHigh:Boolean(controller&&frame.inputHigh),coilOn,indicator:coilOn&&frame.powered,closed,
     currentMa,contactVoltage,contactCurrentMa,signalPin:frame?.pin??null,reason,
     pulseMs:frame?.wave?.pulseMs??null,periodMs:frame?.wave?.periodMs??null,phaseMs:frame?.wave?.phaseMs??null});
    if(reason==='supply')issue('RELAY_SUPPLY','warning',id+' 供电未达到继电器工作条件','模块带载需要 3.3–5 V。','检查 VCC、GND 和电源余量。',id);
    if(Math.abs(contactCurrentMa)>5000)issue('RELAY_CONTACT_CURRENT','error',id+' 触点电流超过 5 A','当前低压回路可能短接。','检查触点负载与限流。',id);
   }
  }
  this.i2cTarget=null;
  if(i2cParts.length||this.i2cStates.size){
   const prior=this.i2cStates;
   this.i2cStates=new Map();
   const stm32Host=stm32I2c1Boards.has(board.id);
   const host=(stm32Host?stm32I2c1Pins:avrI2cHostPins(board.id))?.map(pin=>'mcu:'+pin);
   const hostNodes=host?.map(endpoint=>u.find(endpoint));
   const onBus=endpoint=>hostNodes?.includes(u.find(endpoint));
   const activeDriver=host&&branches.some(branch=>['driver','bridge-switch','ultrasonic-echo'].includes(branch.kind)&&onBus(branch.a));
   const tiedRail=host&&validSources.some(source=>onBus(source.a)||onBus(source.b));
   const idleHigh=host?.every(endpoint=>V(endpoint)>=board.logicHighThreshold-1e-8);
   let busFault=hostNodes&&hostNodes[0]===hostNodes[1]?'bus-short':null;
   if(!busFault&&(activeDriver||tiedRail))busFault=idleHigh?'bus-contention':'bus-stuck-low';
   if(!busFault&&stm32Host&&host.some(endpoint=>V(endpoint)>board.logicVoltage+1e-8))busFault='bus-level';
   const devices=[];
   for(const part of i2cParts){
    const id=part.id,endpoint=pin=>id+':'+pin,device=i2cDevices.get(part.type);
    const voltage=converged&&!supplyConflict?V(endpoint('VIN'))-V(endpoint('GND')):null;
    // Signal pull-ups can backfeed a floating VIN numerically. Require
    // actual VIN and return connections to identify a powered device.
    const powered=device.powered(voltage)&&attachedTerminal(endpoint('VIN'))&&attachedTerminal(endpoint('GND'));
    // A failed solve cannot establish a power loss. Keep the volatile
    // controller state until power can be evaluated again.
    const previous=(powered||voltage===null)&&prior.get(id);
    let controller=(previous?.type===part.type?previous.controller:null)??device.create(part,timeMs);
    if(powered&&device.advance)controller=device.advance(controller,part,timeMs);
    if(powered||voltage===null)this.i2cStates.set(id,{type:part.type,controller});
    const sda=u.find(endpoint('SDA')),scl=u.find(endpoint('SCL'));
    const direct=host&&sda===hostNodes[0]&&scl===hostNodes[1];
    const swapped=host&&sda===hostNodes[1]&&scl===hostNodes[0];
    let reason=null;
    if(probeBlocked)reason='conflict';
    else if(!powered)reason='unpowered';
    else if(!host)reason='unsupported-board';
    else if(!circuit.powered||mismatched||bootBlocked)reason='controller-off';
    else if(u.find(endpoint('GND'))!==ground)reason='ground';
    else if(busFault)reason=busFault;
    else if(swapped)reason='swapped-lines';
    else if(!direct)reason='disconnected';
    else if(!idleHigh)reason='bus-stuck-low';
    else if(device.inputRatios&&host.some(pin=>V(pin)<voltage*device.inputRatios.highMin-1e-8||
      V(pin)>voltage*device.inputRatios.highMax+1e-8))reason='bus-level';
    devices.push({deviceId:id,address:device.address(part),reason,linked:direct||swapped,inputRatios:device.inputRatios,voltage});
    Object.assign(parts[id],device.reading(controller,part,{voltage,powered,reason}));
   }
   this.i2cTarget=address=>{
    if(!host)return {status:2,reason:'unsupported-board'};
    if(probeBlocked)return {status:4,reason:'conflict'};
    if(!circuit.powered||mismatched||bootBlocked)return {status:2,reason:'controller-off'};
    if(busFault)return {status:4,reason:busFault};
    const matched=devices.filter(device=>device.address===address);
    const ready=matched.filter(device=>!device.reason);
    if(ready.length>1)return {status:4,reason:'address-conflict'};
    if(!ready.length){
     const reason=matched[0]?.reason??(devices.some(device=>device.linked)?'address-nack':'disconnected');
     return {status:['bus-stuck-low','bus-level'].includes(reason)?4:2,reason};
    }
    // An I²C bus must both release high and sink low. A very strong
    // external pull-up can pass the first check yet block the second.
    const driven=host.map(a=>({a,b:'mcu:GND',r:board.driverOhms}));
    const low=solveMatrix([...branches,...driven],diodes.map(diode=>({...diode})));
    const {deviceId,inputRatios,voltage}=ready[0];
    const lowLimit=inputRatios?Math.min(board.logicLowThreshold,voltage*inputRatios.lowMax):board.logicLowThreshold;
    if(!low.converged||host.some(endpoint=>valueAt(low.volt,endpoint)>lowLimit+1e-8)){
     return {status:4,reason:'bus-stuck-high'};
    }
    return {status:0,deviceId};
   };
  }
  const pulsePins=new Set(),pulseResistors=new Map(),pulseRailNodes=new Set([ground]);
  if(sensors.length&&!probeBlocked&&circuit.powered&&!mismatched&&!bootBlocked){
   for(const pin of board.gpioPins){
    const config=state.pins?.[pin];
    if(config?.clock!==false&&!outputMode(config?.mode))pulsePins.add(pin);
   }
   const resistorIds=new Set(circuit.components.filter(part=>part.type==='resistor').map(part=>part.id));
   for(const {a,b,id} of branches){
    if(!resistorIds.has(id))continue;
    const first=u.find(a),second=u.find(b);
    if(!pulseResistors.has(first))pulseResistors.set(first,[]);
    if(!pulseResistors.has(second))pulseResistors.set(second,[]);
    pulseResistors.get(first).push(second);
    pulseResistors.get(second).push(first);
   }
   for(const {a,b} of validSources){pulseRailNodes.add(u.find(a));pulseRailNodes.add(u.find(b));}
  }
  const echoes=sensors.length?branches.filter(branch=>branch.kind==='ultrasonic-echo'):[];
  const activePulseDrive=new Set(echoes.length?branches.filter(branch=>branch.kind==='driver'||branch.kind==='bridge-switch').map(branch=>u.find(branch.a)):[]);
  const echoForecast=new Map();
  function echoSignalPath(from,to){
   if(from===to)return true;
   const nodes=[from],seen=new Set(nodes);
   while(nodes.length){
    const node=nodes.pop();
    if(pulseRailNodes.has(node))continue;
    for(const next of pulseResistors.get(node)??[]){
     if(next===to)return true;
     if(!seen.has(next)){seen.add(next);nodes.push(next);}
    }
   }
   return false;
  }
  function measurePulse(pin,level,timeoutUs){
   const timeout={widthUs:0,elapsedUs:Number.isFinite(timeoutUs)?Math.max(0,timeoutUs):0};
   const name=canonicalPin(String(pin).replace(/^mcu:/,''),board.id),endpoint='mcu:'+name;
   if(Number(level)!==1||!pulsePins.has(name)||timeout.elapsedUs===0)return timeout;
   const node=u.find(endpoint);
   const linked=echoes.filter(echo=>echoSignalPath(u.find(echo.a),node));
   if(linked.length!==1)return timeout;
   const echo=linked[0],id=echo.id.slice(0,-5),returnPin=id+':GND';
   if(activePulseDrive.has(node)||activePulseDrive.has(u.find(echo.a)))return timeout;
   const reading=sensorFrames.get(id).data;
   if(u.find(returnPin)!==ground||V(endpoint)-V(returnPin)>board.logicLowThreshold)return timeout;
   const pulse=scheduledEchoPulse(reading,timeMs,1,timeout.elapsedUs);
   if(!pulse)return timeout;
   if(!echoForecast.has(id)){
    // Look ahead using the same physical circuit and a high ECHO driver.
    // Fork the diode regions and keep capacitor/motor state fixed.
    const driven=branches.map(branch=>branch===echo?{...branch,b:id+':VCC'}:branch);
    echoForecast.set(id,solveMatrix(driven,diodes.map(diode=>({...diode}))));
   }
   const predicted=echoForecast.get(id);
   if(!predicted.converged)return timeout;
   const voltage=pin=>valueAt(predicted.volt,pin)-valueAt(predicted.volt,returnPin);
   return hcsr04Powered(voltage(id+':VCC'))&&voltage(endpoint)>=board.logicHighThreshold?pulse:timeout;
  }
  for(const part of bridges){
   const plan=bridgePlans.get(part.id),data=parts[part.id],endpoint=pin=>part.id+':'+pin;
   const readSupply=pin=>measureBetween(endpoint(pin),endpoint('GND')).voltage;
   data.voltage=readSupply('VMM');
   data.inputVoltage=readSupply('VIN');
   data.supplyPin=plan?.supplyPin??null;
   data.sleeping=!probeBlocked&&Boolean(plan?.sleeping);
   data.reason=probeBlocked?'conflict':plan?.reason??null;
   data.channels={};
   for(const channel of drv8833Channels){
    const sample=plan?.channels[channel],mode=probeBlocked?'coast':sample?.mode??'coast';
    const out1=endpoint(channel+'OUT1'),out2=endpoint(channel+'OUT2');
    const current=branches.find(branch=>branch.id===part.id+':'+channel+':0');
    const second=branches.find(branch=>branch.id===part.id+':'+channel+':1');
    const currentMa=probeBlocked?null:current?(V(current.b)-V(current.a))/current.r*1000:0;
    const secondMa=second?(V(second.b)-V(second.a))/second.r*1000:0;
    data.channels[channel]={mode,inputs:sample?.inputs??[null,null],reason:data.reason??sample?.reason??null,
     voltage:measureBetween(out1,out2).voltage,currentMa};
    if(!probeBlocked&&Math.max(Math.abs(currentMa),Math.abs(secondMa))>2000){
     issue('DRV8833_OVERCURRENT','error',part.id+' '+channel+' 路超过 2 A 峰值','当前为瞬时电阻模型。过流关断、重试与温升保护暂未模拟。','检查电机额定电流、制动或反转瞬间以及输出短接。',part.id+':'+channel);
    }
    if(!data.reason&&sample?.reason==='input')issue('DRV8833_INPUT','warning',part.id+' '+channel+' 路输入不确定','控制脚需要落在器件保证的低电平或高电平范围内。','检查输入电压和共地。',part.id+':'+channel);
   }
   if(data.reason==='supply')issue('DRV8833_SUPPLY','warning',part.id+' 电机电源超出 2.7–10.8 V','已关闭桥输出。VIN 是反接保护输入，VMM 是保护后的电机电源轨。','核对电源范围、极性和接线。',part.id);
   if(data.reason==='ground')issue('DRV8833_GROUND','warning',part.id+' 与控制板未共地','驱动器输入与开发板输出需要同一地参考。','连接电源负极、模块 GND 与开发板 GND。',part.id);
   if(data.reason==='input')issue('DRV8833_INPUT','warning',part.id+' 的 SLP 输入不确定','低电平进入休眠，高电平允许桥输出。','检查 SLP 的驱动，也可让载板的上拉使其保持唤醒。',part.id);
   if(data.reason==='feedback')issue('DRV8833_FEEDBACK','warning',part.id+' 控制与输出的耦合超出模型范围','当前模型在同一采样内无法可靠解析驱动输出反过来改变控制的连接。','将控制输入接到独立 GPIO，给输出连接电机。',part.id);
   if(plan?.pwm)issue('DRV8833_PWM_LIMIT','info',part.id+' 按采样读取 PWM 输入','桥只按当前采样电平切换；未逐边沿模拟绕组电感、续流和内部调流。','使用稳定的高低电平比较正转、反转、滑行和制动。',part.id);
  }
  const onboardDiode=diodes.find(d=>d.id==='onboard');
  let onboardCurrentMa=onboardDiode?Math.max(0,(V(onboardDiode.a)-V(onboardDiode.b)-onboardDiode.vf)/onboardDiode.r*1000):null;
  const bufferedInput=bufferedLedSense?measureBetween(bufferedLedSense,'mcu:GND'):null;
  if(bufferedInput?.status==='measured'){
   // The ideal follower supplies the independent RN2A and L branch.
   const outputVoltage=Math.max(0,Math.min(V(logicRail),bufferedInput.voltage));
   onboardCurrentMa=Math.max(0,outputVoltage-onboardVf)/(board.ledResistance+onboardDiodeOhms)*1000;
  }
  parts.onboard={brightness:Math.min(1,(onboardCurrentMa??0)/3)};
  if(!probeBlocked&&Number.isFinite(onboardCurrentMa))parts.onboard.currentMa=onboardCurrentMa;
  if(supplyConflict)for(const p of Object.values(parts))p.brightness=0;
  const result={boardId:board.id,logicVoltage:board.logicVoltage,adcMax:board.adcMax,parts,netVoltages,issues,converged,measureBetween,measurePulse,measurePwmCycle:()=>null,readPin:name=>V('mcu:'+canonicalPin(name,board.id))>=board.logicHighThreshold?1:0,readADC:channel=>Math.round(Math.max(0,Math.min(board.logicVoltage,V('mcu:'+(adcPin(channel)||'ADC_UNCONNECTED'))))/board.logicVoltage*board.adcMax)};
  const namedRgbIds=new Set(circuit.components.filter(kingbrightRgb).map(part=>part.id));
  const measureAverage=options.averagePWM!==false&&!probeBlocked;
  for(const id of namedRgbIds)for(const channel of Object.values(parts[id].channels)){
   channel.averageCurrentMa=measureAverage?channel.currentMa:null;
   channel.averageMethod=measureAverage?'dc':'instantaneous-only';
  }
  // Brightness is instantaneous. displayBrightness is an explicitly averaged
  // visual response, so a 1 kHz PWM sampled every 20 ms does not alias to ON.
  for(const part of Object.values(parts))if(part.brightness!==undefined)part.displayBrightness=part.brightness;
  this.photocellStates=photocellStates;
  const rendered=options.averagePWM!==false;
  let pwmSnapshot=null;
  if(circuit.powered&&converged){
   const pwmPins=Object.entries(state.pins??{}).filter(([,p])=>p.pwm&&p.clock!==false&&outputMode(p.mode));
   if(pwmPins.length){
    const activePartTypes=new Set(['capacitor','motor','drv8833','hcsr04','grove-relay']);
    let pwmNetwork;
    const inspectNetwork=()=>{
     if(pwmNetwork)return pwmNetwork;
     const terminals=new Set([ground,u.find('mcu:3V3'),u.find('mcu:5V')]);
     for(const v of sources){terminals.add(u.find(v.a));terminals.add(u.find(v.b));}
     const passive=new Map();const link=(a,b)=>{a=u.find(a);b=u.find(b);if(!passive.has(a))passive.set(a,new Set());if(!passive.has(b))passive.set(b,new Set());passive.get(a).add(b);passive.get(b).add(a);};
     for(const e of branches)if(e.kind!=='driver'&&e.kind!=='pull')link(e.a,e.b);
     for(const d of diodes)link(d.a,d.b);
     for(const c of capacitors)link(c.id+':+',c.id+':-');
     const pinRoots=new Map();for(const [name,p] of pwmPins){const r=u.find('mcu:'+canonicalPin(name,board.id));if(!pinRoots.has(r))pinRoots.set(r,[]);pinRoots.get(r).push({name,p});}
     const nodesFor=predicate=>new Set(circuit.components.filter(predicate)
       .flatMap(part=>PARTS[part.type].pins.map(pin=>u.find(part.id+':'+pin))));
     const activePart=part=>activePartTypes.has(part.type)||part.type==='servo'&&part.servoModel==='hs55';
     const activeNodes=namedRgbIds.size?nodesFor(activePart):new Set();
     let dynamicNodes,fixedRails;
     const inspectFixedRails=()=>{
      if(fixedRails)return fixedRails;
      // A source only fixes an absolute potential if it connects to ground
      // through ideal sources. A floating supply can couple two GPIOs.
      const sourceLinks=new Map();
      for(const {a,b} of validSources){
       const left=u.find(a),right=u.find(b);
       if(!sourceLinks.has(left))sourceLinks.set(left,[]);
       if(!sourceLinks.has(right))sourceLinks.set(right,[]);
       sourceLinks.get(left).push(right);
       sourceLinks.get(right).push(left);
       link(a,b);
      }
      fixedRails=new Set([ground]);
      const pending=[ground];
      for(const node of pending)for(const next of sourceLinks.get(node)??[]){
       if(!fixedRails.has(next)){fixedRails.add(next);pending.push(next);}
      }
      return fixedRails;
     };
     const reachablePWM=({a,b},{measure=false}={})=>{
      const stopAt=measure?inspectFixedRails():terminals;
      const loadNodes=measure?(dynamicNodes??=nodesFor(part=>activePart(part)||part.type==='servo'||
        part.type==='ldr'&&part.ldrModel===pdvPhotocellModel||i2cDevices.has(part.type))):activeNodes;
      const found=new Map(),seen=new Set(),queue=[u.find(a)];let active=false;
      if(b)queue.push(u.find(b));
      while(queue.length){const r=queue.shift();if(seen.has(r))continue;seen.add(r);const pins=pinRoots.get(r)||[];for(const pin of pins)found.set(pin.name,pin);
       if(stopAt.has(r))continue;if(loadNodes.has(r))active=true;for(const n of passive.get(r)||[])queue.push(n);
      }return {pins:[...found.values()],active};
     };
     return pwmNetwork={reachablePWM};
    };
    const canMeasureCycle=!probeBlocked&&!mismatched&&!bootBlocked&&!state.error&&state.status!=='error'&&
      Number.isFinite(timeMs)&&timeMs>=0;
    // A firmware input callback can solve the same project after the visible
    // frame. Keep its phase inputs independent from those later solves.
    const phaseState=rendered&&canMeasureCycle?{
     capVoltages:{...this.capVoltages},motorStates:structuredClone(this.motorStates),
     servoStates:new Map(this.servoStates),photocellStates:new Map(this.photocellStates),
     pwmRcStates:new Map(this.pwmRcStates),ultrasonicStates:new Map(this.ultrasonicStates),relayStates:new Map(this.relayStates)
    }:this;
    const visualSolutions=new Map();
    const visualAt=(levels,reuseCurrent=false)=>{
     if(reuseCurrent&&levels.every(([{p},level])=>pwmOutputLevel(p.pwm,timeMs)===level))return result;
     const key=JSON.stringify(levels.map(([{name},level])=>[name,level]).sort());
     if(visualSolutions.has(key))return visualSolutions.get(key);
     const visual=new CircuitSimulator();visual.lastTime=timeMs;visual.capVoltages={...phaseState.capVoltages};visual.motorStates=structuredClone(phaseState.motorStates);visual.boardId=board.id;
     visual.servoStates=new Map(phaseState.servoStates);
     visual.photocellStates=new Map(phaseState.photocellStates);
     visual.pwmRcStates=new Map(phaseState.pwmRcStates);
     visual.ultrasonicStates=new Map(phaseState.ultrasonicStates);
     visual.relayStates=new Map(phaseState.relayStates);
     const snapshot={...state,pins:{...state.pins}};
     for(const [{name,p},level] of levels)snapshot.pins[name]={...p,pwm:null,level,output:level};
     const sampled=visual.solve(circuit,snapshot,{averagePWM:false});
     visualSolutions.set(key,sampled);
     return sampled;
    };
    const safeMeasurement=frame=>frame.converged&&!frame.issues.some(({severity})=>severity==='error');
    if(canMeasureCycle){
     if(rendered)pwmSnapshot={circuit,result};
     const {components,wires,powered,boot0,boardId}=circuit;
     const mount=circuit.board?.mount;
     result.measurePwmCycle=(pin,ledId)=>{
      const current=this.lastResult===result||this.renderedPwmResult?.result===result;
      if(!current||circuit.components!==components||circuit.wires!==wires||circuit.board?.mount!==mount||
        circuit.powered!==powered||circuit.boot0!==boot0||circuit.boardId!==boardId||
        typeof pin!=='string'||!safeMeasurement(result))return null;
      pin=canonicalPin(pin,board.id);
      const endpoint='mcu:'+pin,{reachablePWM}=inspectNetwork();
      if(!all.has(endpoint))return null;
      const {pins,active}=reachablePWM({a:endpoint},{measure:true});
      const signal=pins[0];
      if(active||pins.length!==1||canonicalPin(signal.name,board.id)!==pin||openDrain(signal.p.mode))return null;
      const pwm=signal.p.pwm,{duty}=pwm,frequencyHz=pwm.frequencyHz??pwm.frequency;
      const periodMs=1000/frequencyHz;
      if(!Number.isFinite(frequencyHz)||!Number.isFinite(periodMs)||periodMs<=0||!Number.isFinite(duty)||duty<0||duty>1)return null;
      if((duty===0||duty===1)&&pwmOutputLevel(pwm,timeMs)!==duty)return null;
      const low=duty===1?null:duty===0?result:visualAt([[signal,0]],true);
      const high=duty===0?null:duty===1?result:visualAt([[signal,1]],true);
      const frames=[low,high].filter(Boolean);
      if(!frames.every(safeMeasurement))return null;
      const level=frame=>frame?.measureBetween(endpoint,'mcu:GND').voltage??null;
      const lowVoltage=level(low),highVoltage=level(high);
      const voltage=(!low||Number.isFinite(lowVoltage))&&(!high||Number.isFinite(highVoltage))
        ?{low:lowVoltage,high:highVoltage}:null;
      let led=null;
      const branch=ledId==='onboard'&&bufferedLedSense?{a:bufferedLedSense}:
        ledId==='onboard'||parts[ledId]?.type==='led'?diodes.find(d=>d.id===ledId):null;
      if(branch){
       const linked=reachablePWM(branch,{measure:true});
       const grounded=frames.some(frame=>[branch.a,branch.b].filter(Boolean)
         .every(point=>frame.measureBetween(point,'mcu:GND').status==='measured'));
       if(!linked.active&&linked.pins.length===1&&linked.pins[0]===signal&&grounded){
        const lowMa=low?.parts[ledId]?.currentMa??null,highMa=high?.parts[ledId]?.currentMa??null;
        if((!low||Number.isFinite(lowMa))&&(!high||Number.isFinite(highMa))){
         led={lowMa,highMa,averageMa:(lowMa??0)*(1-duty)+(highMa??0)*duty};
        }
       }
      }
      const highFirst=typeof pwm.highFirst==='boolean'?pwm.highFirst:pwm.activeLow!==true;
      return {pin,frequencyHz,duty,periodMs,highFirst,voltage,led};
     };
    }
    if(rendered){
    const {reachablePWM}=inspectNetwork();
    for(const capacitor of capacitors){
     if(!parts[capacitor.id].pwmRc&&reachablePWM({a:capacitor.id+':+',b:capacitor.id+':-'}).pins.length)
      issue('PWM_RC_TIMESTEP','info',capacitor.id+' 的PWM纹波未逐边沿计算','电容按外部给定时间步积分；当时间步大于PWM周期时，不能把数值当成准确的PWM滤波波形。','减小仿真时间步并用实物或SPICE验证；LED视觉平均不改变电容状态。',capacitor.id);
    }
    const lightData=(collection,d)=>d.parent?(collection[d.parent]?.channels||collection[d.parent]?.segments)?.[d.channel]:collection[d.id];
    if(measureAverage&&!mismatched&&!bootBlocked)for(const id of namedRgbIds){
     const channels=diodes.filter(d=>d.parent===id).map(d=>({d,...reachablePWM(d)}));
     const pins=[...new Map(channels.flatMap(channel=>channel.pins.map(pin=>[pin.name,pin]))).values()];
     if(!pins.length)continue;
     const canMeasure=!channels.some(channel=>channel.active)&&pins.every(({p})=>!openDrain(p.mode));
     const cycle=canMeasure&&rgbPwmCycle(pins);
     const frames=cycle&&cycle.phases.map(({weight,levels})=>({weight,result:visualAt(levels,true)}));
     const valid=frames&&frames.every(({result})=>result.converged&&!result.issues.some(
      issue=>['SUPPLY_SHORT','ELECTRICAL_CONFLICT','OUTPUT_CONFLICT'].includes(issue.code)));
     if(!valid)issue('RGB_PWM_AVERAGE_LIMIT','info',id+' 的周期平均电流不可用',
      '保留即时支路读数。当前模型支持同一相位基准下至多三路推挽 PWM，以及固定电平。',
      '用同一个定时器驱动三路，并检查共享回路与输出冲突。',id);
     for(const {d,pins:links} of channels){
      if(!links.length)continue;
      const data=lightData(parts,d);
      data.averageCurrentMa=null;
      data.averageMethod='instantaneous-only';
      if(!valid)continue;
      data.averageMethod=links.some(({p})=>p.pwm.duty>0&&p.pwm.duty<1)?cycle.method:'dc';
      data.averageCurrentMa=frames.reduce((sum,frame)=>sum+frame.weight*lightData(frame.result.parts,d).currentMa,0);
      data.displayBrightness=frames.reduce((sum,frame)=>sum+frame.weight*lightData(frame.result.parts,d).brightness,0);
     }
    }
    const indicators=bufferedLedSense?[...diodes,{id:'onboard',a:bufferedLedSense}]:diodes;
    for(const d of indicators){
     if(namedRgbIds.has(d.parent))continue;
     const associated=reachablePWM(d).pins,part=lightData(parts,d);if(!part||part.brightness===undefined)continue;
     if(associated.length===1){
      const pin=associated[0],duty=Math.max(0,Math.min(1,pin.p.pwm.duty??0));
      part.pwmAverage={pin:pin.name,duty,frequencyHz:pin.p.pwm.frequencyHz||pin.p.pwm.frequency,method:'on-off-weighted-visual'};
      if(duty>0&&duty<1){
       const [low,high]=[0,1].map(level=>lightData(visualAt([[pin,level]]).parts,d));
       part.displayBrightness=(low?.brightness??0)*(1-duty)+(high?.brightness??0)*duty;
       if(Number.isFinite(low?.currentMa)&&Number.isFinite(high?.currentMa)){
        part.pwmAverage.currentMa=low.currentMa*(1-duty)+high.currentMa*duty;
       }
      }else if(Number.isFinite(part.currentMa))part.pwmAverage.currentMa=part.currentMa;
     }else if(associated.length>1)issue('PWM_AVERAGE_LIMIT','info',d.id+' 连接了多个PWM来源','当前视觉平均只覆盖单个PWM源，复杂相位耦合保留瞬时亮度。','查看各路波形；多个源的相位关系需要更完整的瞬态仿真。',d.id);
    }
    }
   }
  }
  if(rendered||this.renderedPwmResult?.circuit!==circuit)this.renderedPwmResult=pwmSnapshot;
  this.lastTime=state.timeMs??0;this.lastResult=result;return result;
 }
}
