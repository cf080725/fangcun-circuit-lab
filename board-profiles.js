/**
 * Board profiles for the teaching source interpreter.
 * Dimensions/pin positions are a reference drawing in centimetres, not a PCB
 * fabrication drawing. Official pin identities and model limits are separate.
 */
import { makeRpAvrProfiles } from './sim-profiles-rp-avr.js';
import { makeEspProfiles } from './sim-profiles-esp.js';
import { makeStProfiles } from './sim-profiles-stm32.js';
import { makeSeeedProfiles } from './sim-profiles-seeed.js';
import { makeArduinoNanoProfiles } from './sim-profiles-arduino-nano.js';
import { makeBleProfiles } from './sim-profiles-ble.js';
import { makeGigaProfile } from './sim-profiles-giga.js';
import { makeDueTeensyProfiles } from './sim-profiles-due-teensy.js';
import { makeMicrobitProfile } from './sim-profile-microbit.js';
import { makeNordicDkProfiles } from './sim-profiles-nordic-dk.js';
import { makeTiProfiles } from './sim-profiles-ti.js';
import { makeNxpProfiles } from './sim-profiles-nxp.js';
import { makeWchProfiles } from './sim-profiles-wch.js';
import { makeRaspberryPiProfiles } from './sim-profiles-raspberry-pi.js';
import { breadboardDimensions } from './geometry-3d.js';
import { nucleoF103rbContact, nucleoF103rbGeometry, nucleoF103rbManual } from './nucleo-f103rb-geometry.js';

const stamp = "2026-11-06";
const commonCapabilities = {
  execution: "源码行为仿真", binaryFirmware: false, instructionAccurate: false,
  digitalIO: true, analogInput: true, pwm: true, serialConsole: true,
  interrupts: false, dma: false, i2c: false, spi: false, wifi: false,
  usbProtocol: false, completeCpp: false,
  note: "可执行所列 API 与基础 C 控制流；不执行 ARM/AVR/Xtensa/RISC-V 指令，也不包含完整芯片或 C++ 标准库。"
};
const sources = {
  stF103: "https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html",
  nucleo: nucleoF103rbManual,
  uno: "https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf",
  nano: "https://docs.arduino.cc/resources/pinouts/A000005-full-pinout.pdf",
  mega: "https://docs.arduino.cc/resources/pinouts/A000067-full-pinout.pdf",
  esp32: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
  c3: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html",
  pico: "https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html"
};
const pinKind = name => /^GND|AGND$/.test(name) ? "ground"
  : /^(NRST|RESET|RST|EN|RUN|BOOT|3V3_EN)/.test(name) ? "control"
  : /^(3V3|5V|VDD|VDDA|AVDD|VREF|AREF|ADC_VREF|IOREF|VIN|VBUS|VSYS|VBAT|E5V|U5V)/.test(name) ? "power"
  : /^(NC|RESERVED)/.test(name) ? "nc" : "gpio";
function rows(left, right, width, height, options = {}) {
  const pitch = options.pitch || 0.254, start = options.start ?? -(Math.max(left.length, right.length) - 1) * pitch / 2;
  const result = [];
  for (const [side, list, x] of [["left", left, -(options.x ?? (width / 2 - .14))], ["right", right, options.x ?? (width / 2 - .14)]]) {
    list.forEach((entry, i) => {
      const p = typeof entry === "string" ? {id:entry,label:entry} : {...entry};
      result.push({...p, side, x, z:start+i*pitch+(p.gap||0), kind:p.kind||pinKind(p.label||p.id)});
    });
  }
  return result;
}
const named = (id,label,canonical,extra={}) => ({id,label,canonical,...extra});
function finish(profile) {
  const aliases = {...profile.pinAliases};
  const logicRail = profile.logicRail ?? (profile.logicVoltage===5 ? "5V" : "3V3");
  for(const p of profile.pins) {
    aliases[p.id] = p.canonical || aliases[p.id] || p.id;
    if (!Object.hasOwn(aliases,p.label)) aliases[p.label]=aliases[p.id];
    p.canonical=aliases[p.id]; p.kind ||= pinKind(p.label);
    if(p.connector&&Number.isInteger(p.connectorPin))p.location=`${p.connector}.${p.connectorPin}`;
    else if(/^[JP]\d+_\d+$/.test(p.id))p.location=p.id.replace('_','.');
  }
  for(const name of ["GND","GND1","GND2","GND3","AGND"]) aliases[name]="GND";
  for(const name of ["3V3","3V3b","+3V3","3.3V"]) aliases[name]="3V3";
  for(const name of ["5V","+5V","U5V","E5V","VBUS"]) if(!Object.hasOwn(aliases,name))aliases[name]="5V";
  aliases.VLOGIC = logicRail;
  const numbered = {...profile.numberedPins};
  for(const [n,p] of Object.entries(numbered)) if(!Object.hasOwn(aliases,n))aliases[n]=p;
  for(const [alias,canonical] of Object.entries(aliases)) if(!Object.hasOwn(aliases,canonical))aliases[canonical]=canonical;
  const gpioPins = [...new Set(profile.pins.filter(p=>p.kind==="gpio").map(p=>p.canonical))];
  if(profile.ledPin&&!gpioPins.includes(profile.ledPin))gpioPins.push(profile.ledPin);
  return Object.freeze({
    adcDefaultBits:10, nativeAdcBits:Math.round(Math.log2(profile.adcMax+1)),
    pwmBits:8, pwmFrequency:1000, inputOnly:[], noInternalPull:[], analogOnly:[],
    reservedPins:[], strappingPins:[], serialPorts:["Serial"], hasPullDown:false,
    logicLowThreshold:profile.logicVoltage*.3, logicHighThreshold:profile.logicVoltage*.6,
    driverOhms:47, gpioWarningMa:20, intBits:32,
    ...profile, logicRail, pinAliases:aliases, numberedPins:numbered, gpioPins,
    pinsLeft:profile.pins.filter(p=>p.side==="left").map(p=>p.id),
    pinsRight:profile.pins.filter(p=>p.side==="right").map(p=>p.id),
    capabilities:{...commonCapabilities,...profile.capabilities},
    verifiedDate:stamp,
    footprintNote:profile.footprintNote||"按官方外形/针脚资料绘制的教学布局；坐标做了显示简化，不用于制板或外壳加工。"
  });
}
const digitalNumbers = (n) => Object.fromEntries(Array.from({length:n},(_,i)=>[i,"D"+i]));
const analogAliases = (n,offset=14) => Object.fromEntries(Array.from({length:n},(_,i)=>["A"+i,"A"+i]));
const bpLeft=["PB12","PB13","PB14","PB15","PA8","PA9","PA10","PA11","PA12","PA15","PB3","PB4","PB5","PB6","PB7","PB8","PB9","5V","GND1","3V3"];
const bpRight=["GND2","GND3","3V3b","NRST","PB11","PB10","PB1","PB0","PA7","PA6","PA5","PA4","PA3","PA2","PA1","PA0","PC15","PC14","PC13","VBAT"];
const bluepill = finish({
  id:"bluepill", name:"STM32F103C8T6 · Blue Pill", family:"STM32F1", mcu:"STM32F103C8T6",
  logicVoltage:3.3, adcMax:4095, nativeAdcBits:12, coreClockHz:72000000, flashBytes:65536, ramBytes:20480,
  style:"bluepill", width:2.3, height:5.3, color:"#1767b1", language:"stm32-spl", dialects:["stm32-spl","arduino"],
  pins:rows(bpLeft,bpRight,2.3,5.3,{x:.762}), pinAliases:{"3V3b":"3V3",GND1:"GND",GND2:"GND",GND3:"GND"},
  numberedPins:{}, analogPins:["PA0","PA1","PA2","PA3","PA4","PA5","PA6","PA7","PB0","PB1"],
  pwmPins:["PA0","PA1","PA2","PA3","PA6","PA7","PA8","PA9","PA10","PA11","PB0","PB1","PB6","PB7","PB8","PB9"],
  ledPin:"PC13", ledActiveLow:true, ledResistance:510, hasPullDown:true,
  defaultPins:{led:"PA0",button:"PB1",adc:"PA1",pwm:"PA0",tx:"PA9",rx:"PA10"},
  capabilities:{nativeFirmware:"STM32F103C8T6 HEX/BIN"},
  platformio:{platform:"ststm32",board:"bluepill_f103c8",framework:"arduino"},
  keil:{device:"STM32F103C8",pack:"Keil.STM32F1xx_DFP",flashStart:"0x08000000",flashSize:"0x10000",ramStart:"0x20000000",ramSize:"0x5000",define:"STM32F10X_MD,USE_STDPERIPH_DRIVER"},
  sources:[sources.stF103], notes:["Blue Pill 不是 ST 官方开发板；本平台保持原项目的常见板型接线。","板载PC13灯低电平有效。SPL与Arduino示例不可混淆其真实工具链。"]
});
const unoLeft=[named("NC","NC","NC"),"IOREF",named("RESET","RESET","RESET"),"3V3","5V",named("GND1","GND","GND"),named("GND2","GND","GND"),"VIN",...Array.from({length:6},(_,i)=>({id:"A"+i,label:"A"+i,gap:.25}))];
const unoRight=[named("SCL","SCL","A5"),named("SDA","SDA","A4"),"AREF",named("GND3","GND","GND"),...Array.from({length:14},(_,i)=>({id:"D"+(13-i),label:"D"+(13-i),gap:i>=6?.25:0}))];
const uno = finish({
  id:"uno-r3", name:"Arduino UNO R3", family:"AVR", mcu:"ATmega328P", logicVoltage:5, adcMax:1023,
  nativeAdcBits:10, coreClockHz:16000000, flashBytes:32768, ramBytes:2048, intBits:16,
  style:"uno", width:5.34, height:6.86, color:"#168b92", language:"arduino", dialects:["arduino"],
  pins:rows(unoLeft,unoRight,5.34,6.86,{start:-2.1,x:2.35}), pinAliases:{IOREF:"5V",SDA:"A4",SCL:"A5"},
  numberedPins:{...digitalNumbers(14),...Object.fromEntries(Array.from({length:6},(_,i)=>[14+i,"A"+i]))},
  analogPins:Array.from({length:6},(_,i)=>"A"+i),pwmPins:[3,5,6,9,10,11].map(i=>"D"+i),
  pwmFrequency:490.196, pwmFrequencies:{D5:976.5625,D6:976.5625}, ledPin:"D13",ledActiveLow:false,ledResistance:1000,
  defaultPins:{led:"D13",button:"D2",adc:"A0",pwm:"D9",tx:"D1",rx:"D0"},
  platformio:{platform:"atmelavr",board:"uno",framework:"arduino"}, arduinoFqbn:"arduino:avr:uno",
  capabilities:{analogReadResolution:false,nativeFirmware:"ATmega328P HEX"},sources:[sources.uno,"https://docs.arduino.cc/hardware/uno-rev3","https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf"],
  notes:["5V逻辑；PWM仅D3/5/6/9/10/11。","板载 L 由 LMV358 缓冲 D13/SCK 信号后经 1 kΩ 电阻驱动。仿真采用理想电压跟随器，D13 悬空时没有有效电流读数。","SDA/A4、SCL/A5是同一组电气引脚，不能当成额外独立GPIO。"]
});
const nanoLeft=["D13","3V3","AREF","A0","A1","A2","A3","A4","A5","A6","A7","5V",named("RESET1","RST","RESET"),named("GND1","GND","GND"),"VIN"];
const nanoRight=["D12","D11","D10","D9","D8","D7","D6","D5","D4","D3","D2",named("GND2","GND","GND"),named("RESET2","RST","RESET"),"D0","D1"];
const nano = finish({
  ...uno,id:"nano",name:"Arduino Nano · classic",style:"nano",width:1.8,height:4.5,
  ledResistance:330,
  pins:rows(nanoLeft,nanoRight,1.8,4.5,{start:-1.778,x:.762}),
  pinAliases:{RESET1:"RESET",RESET2:"RESET",SDA:"A4",SCL:"A5"},
  numberedPins:{...digitalNumbers(14),...Object.fromEntries(Array.from({length:8},(_,i)=>[14+i,"A"+i]))},
  analogPins:Array.from({length:8},(_,i)=>"A"+i),analogOnly:["A6","A7"],
  platformio:{platform:"atmelavr",board:"nanoatmega328",framework:"arduino"},arduinoFqbn:"arduino:avr:nano",
  sources:[sources.nano,"https://docs.arduino.cc/hardware/nano","https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf"],
  notes:["此板对应经典 Arduino Nano，实物对照采用 Gravitech V3.0 与 ATmega328P TQFP-32。","V3.0 板载 L 灯经 330 Ω 电阻接 D13，高电平点亮。","A6/A7 仅支持模拟输入。","精细模型的 PCB 约 17.78 × 43.18 mm，含 Mini-B 接口的整板包络约 18 × 45 mm。"]
});
const megaPins=rows(
  [...unoLeft.slice(0,8),...Array.from({length:16},(_,i)=>({id:"A"+i,label:"A"+i,gap:.25+(i>=8?.25:0)}))],
  [named("SCL","SCL","D21"),named("SDA","SDA","D20"),"AREF",named("GND3","GND","GND"),...Array.from({length:14},(_,i)=>({id:"D"+(13-i),label:"D"+(13-i),gap:i>=6?.25:0})),...Array.from({length:8},(_,i)=>({id:"D"+(14+i),label:"D"+(14+i),gap:.5}))],
  5.34,10.16,{start:-3.65,x:2.35}
);
// The 2x18 end header: a 5V pair, 16 digital pairs, and a ground pair.
for(let col=0;col<18;col++)for(let row=0;row<2;row++){
  const value=col===0?named("GND_END"+row,"GND","GND"):col===17?named("5V_END"+row,"5V","5V"):named("D"+(52-(col-1)*2+row),"D"+(52-(col-1)*2+row),"D"+(52-(col-1)*2+row));
  megaPins.push({...value,x:-2.159+col*.254,z:4.25+row*.254,side:"bottom",kind:pinKind(value.label)});
}
const mega=finish({
  ...uno,id:"mega2560",name:"Arduino Mega 2560 Rev3",mcu:"ATmega2560",style:"mega",
  capabilities:{analogReadResolution:false,nativeFirmware:"ATmega2560 HEX"},
  width:5.34,height:10.16,flashBytes:262144,ramBytes:8192,pins:megaPins,
  pinAliases:{IOREF:"5V",SDA:"D20",SCL:"D21"},
  numberedPins:{...digitalNumbers(54),...Object.fromEntries(Array.from({length:16},(_,i)=>[54+i,"A"+i]))},
  analogPins:Array.from({length:16},(_,i)=>"A"+i),pwmPins:[...Array.from({length:12},(_,i)=>"D"+(i+2)),"D44","D45","D46"],
  pwmFrequencies:{D4:976.5625,D13:976.5625},serialPorts:["Serial","Serial1","Serial2","Serial3"],
  defaultPins:{led:"D13",button:"D2",adc:"A0",pwm:"D9",tx:"D1",rx:"D0"},
  platformio:{platform:"atmelavr",board:"megaatmega2560",framework:"arduino"},arduinoFqbn:"arduino:avr:mega:cpu=atmega2560",
  sources:[sources.mega,"https://docs.arduino.cc/hardware/mega-2560"],
  notes:["模型包含54个数字编号和16个模拟输入。","多串口为字节队列模型，不计算每一位的线路时序。"]
});
const espLeft=["3V3",named("EN","EN","EN"),named("GPIO36","VP","GPIO36"),named("GPIO39","VN","GPIO39"),"GPIO34","GPIO35","GPIO32","GPIO33","GPIO25","GPIO26","GPIO27","GPIO14","GPIO12",named("GND1","GND","GND"),"GPIO13",named("GPIO9","D2","GPIO9",{kind:"reserved"}),named("GPIO10","D3","GPIO10",{kind:"reserved"}),named("GPIO11","CMD","GPIO11",{kind:"reserved"}),"5V"];
const espRight=[named("GND2","GND","GND"),"GPIO23","GPIO22",named("GPIO1","TX","GPIO1"),named("GPIO3","RX","GPIO3"),"GPIO21",named("GND3","GND","GND"),"GPIO19","GPIO18","GPIO5","GPIO17","GPIO16","GPIO4","GPIO0","GPIO2","GPIO15",named("GPIO8","D1","GPIO8",{kind:"reserved"}),named("GPIO7","D0","GPIO7",{kind:"reserved"}),named("GPIO6","CLK","GPIO6",{kind:"reserved"})];
// Official guide shows the module at top and USB below. Rotate that view 180°
// here so USB is at -z: sides and order both reverse.
const esp32=finish({
  id:"esp32-devkitc",name:"ESP32-DevKitC V4 · WROOM-32E",family:"ESP32",mcu:"ESP32-WROOM-32E",
  logicVoltage:3.3,adcMax:4095,nativeAdcBits:12,adcDefaultBits:12,coreClockHz:240000000,
  flashBytes:4194304,ramBytes:532480,style:"esp32",width:2.794,height:4.826,color:"#223b46",
  language:"arduino",dialects:["arduino"],pins:rows([...espRight].reverse(),[...espLeft].reverse(),2.794,4.826,{pitch:.254,x:1.27}),
  pinAliases:{VP:"GPIO36",VN:"GPIO39",TX:"GPIO1",RX:"GPIO3",D0:"GPIO7",D1:"GPIO8",D2:"GPIO9",D3:"GPIO10",CMD:"GPIO11",CLK:"GPIO6"},
  numberedPins:Object.fromEntries([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39].map(n=>[n,"GPIO"+n])),
  analogPins:[36,39,34,35,32,33,25,26,27,14,12,13,4,0,2,15].map(n=>"GPIO"+n),
  pwmPins:[0,1,2,3,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33].map(n=>"GPIO"+n),
  inputOnly:[34,35,36,39].map(n=>"GPIO"+n),noInternalPull:[34,35,36,39].map(n=>"GPIO"+n),
  reservedPins:[6,7,8,9,10,11].map(n=>"GPIO"+n),strappingPins:[0,2,5,12,15].map(n=>"GPIO"+n),hasPullDown:true,
  ledPin:null,ledActiveLow:false,serialPorts:["Serial","Serial1","Serial2"],
  defaultPins:{led:"GPIO23",button:"GPIO18",adc:"GPIO34",pwm:"GPIO23",tx:"GPIO1",rx:"GPIO3"},
  platformio:{platform:"espressif32",board:"esp32dev",framework:"arduino"},arduinoFqbn:"esp32:esp32:esp32",
  sources:[sources.esp32,"https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf","https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html"],
  notes:["官方DevKitC只有电源指示灯；默认示例使用外接LED，不能把GPIO2当成所有板子的内建灯。","GPIO6–11用于模块Flash，禁止作为教学普通GPIO。GPIO34/35/36/39仅输入且没有内部上下拉。","ADC按理想0–3.3V线性教学模型；实际ESP32量程、衰减、非线性及Wi-Fi资源竞争未建模。"]
});
const c3J1=[named("GND1","GND","GND"),"3V3",named("3V3b","3V3","3V3"),"GPIO2","GPIO3",named("GND2","GND","GND"),named("RST","RST","EN"),named("GND3","GND","GND"),"GPIO0","GPIO1","GPIO10",named("GND4","GND","GND"),"5V",named("5Vb","5V","5V"),named("GND5","GND","GND")];
const c3J3=[named("GND6","GND","GND"),named("GPIO21","TX","GPIO21"),named("GPIO20","RX","GPIO20"),named("GND7","GND","GND"),"GPIO9","GPIO8",named("GND8","GND","GND"),"GPIO7","GPIO6","GPIO5","GPIO4",named("GND9","GND","GND"),"GPIO18","GPIO19",named("GND10","GND","GND")];
const c3=finish({
  ...esp32,id:"esp32-c3-devkitm",name:"ESP32-C3-DevKitM-1",family:"ESP32-C3",mcu:"ESP32-C3-MINI-1",
  style:"esp32-c3",width:2.54,height:3.891,coreClockHz:160000000,ramBytes:409600,
  pins:rows([...c3J3].reverse(),[...c3J1].reverse(),2.54,3.891,{pitch:.254,x:1.143,start:-1.778}),
  pinAliases:{TX:"GPIO21",RX:"GPIO20",RST:"EN"},
  numberedPins:Object.fromEntries([...Array.from({length:11},(_,i)=>i),18,19,20,21].map(n=>[n,"GPIO"+n])),
  analogPins:[0,1,2,3,4,5].map(n=>"GPIO"+n),pwmPins:[...Array.from({length:11},(_,i)=>i),18,19,20,21].map(n=>"GPIO"+n),
  inputOnly:[],noInternalPull:[],reservedPins:[],strappingPins:[2,8,9].map(n=>"GPIO"+n),
  serialPorts:["Serial","Serial1"],ledPin:null,rgbLedPin:"GPIO8",
  defaultPins:{led:"GPIO4",button:"GPIO7",adc:"GPIO0",pwm:"GPIO4",tx:"GPIO21",rx:"GPIO20"},
  platformio:{platform:"espressif32",board:"esp32-c3-devkitm-1",framework:"arduino"},arduinoFqbn:"esp32:esp32:esp32c3",
  sources:[sources.c3,"https://dl.espressif.com/dl/schematics/DIMENSION_ESP32-C3-DEVKITM-1_V1_20200915AA.pdf"],
  notes:["板上GPIO8驱动的是可寻址RGB LED，本平台不把普通digitalWrite冒充WS2812协议。","默认示例用GPIO4外接LED。GPIO2/8/9是启动配置脚，实际接板需看官方启动约束。","无线、USB协议、启动采样与真实ADC误差未模拟。"]
});
const picoLeft=["GP0","GP1",named("GND1","GND","GND"),"GP2","GP3","GP4","GP5",named("GND2","GND","GND"),"GP6","GP7","GP8","GP9",named("GND3","GND","GND"),"GP10","GP11","GP12","GP13",named("GND4","GND","GND"),"GP14","GP15"];
const picoRight=["VBUS","VSYS",named("GND5","GND","GND"),"3V3_EN",named("3V3","3V3(OUT)","3V3"),named("ADC_VREF","ADC_VREF","3V3"),"GP28",named("AGND","AGND","GND"),"GP27","GP26","RUN","GP22",named("GND6","GND","GND"),"GP21","GP20","GP19","GP18",named("GND7","GND","GND"),"GP17","GP16"];
const pico=finish({
  id:"pico",name:"Raspberry Pi Pico · RP2040",family:"RP2040",mcu:"RP2040",logicVoltage:3.3,adcMax:4095,
  nativeAdcBits:12,adcDefaultBits:10,coreClockHz:133000000,flashBytes:2097152,ramBytes:270336,
  style:"pico",width:2.1,height:5.1,color:"#198968",language:"arduino",dialects:["arduino"],
  pins:rows(picoLeft,picoRight,2.1,5.1,{pitch:.254,x:.889}),
  pinAliases:{A0:"GP26",A1:"GP27",A2:"GP28",VBUS:"5V",VSYS:"VSYS",ADC_VREF:"3V3",AGND:"GND"},
  numberedPins:Object.fromEntries([...Array.from({length:23},(_,i)=>i),25,26,27,28].map(n=>[n,"GP"+n])),
  analogPins:["GP26","GP27","GP28"],pwmPins:[...Array.from({length:23},(_,i)=>"GP"+i),"GP25","GP26","GP27","GP28"],
  ledPin:"GP25",ledActiveLow:false,ledResistance:1000,hasPullDown:true,pwmFrequency:500,
  serialPorts:["Serial","Serial1","Serial2"],
  defaultPins:{led:"GP15",button:"GP14",adc:"GP26",pwm:"GP15",tx:"GP0",rx:"GP1"},
  capabilities:{nativeFirmware:"RP2040 应用 UF2"},
  platformio:{platform:"raspberrypi",board:"pico",framework:"arduino"},arduinoFqbn:"arduino:mbed_rp2040:pico",
  sources:[sources.pico,"https://github.com/arduino/ArduinoCore-mbed/blob/main/cores/arduino/wiring_analog.cpp"],
  notes:["经典 Pico 使用 RP2040，板载 LED 接 GP25。","硬件 ADC 为 12 位。Arduino 源码示例默认返回 10 位，可用 analogReadResolution(12) 切换。","原生固件入口支持经典 Pico 的 Flash 应用 UF2。当前电路联动覆盖 GPIO、GP26–GP28 模拟输入、边沿对齐 PWM 和 UART0 字节终端。"]
});
function nucleoProfile(f401=false){
  const id=f401?"nucleo-f401re":"nucleo-f103rb",device=f401?"STM32F401RE":"STM32F103RB";
  const arduino={D0:"PA3",D1:"PA2",D2:"PA10",D3:"PB3",D4:"PB5",D5:"PB4",D6:"PB10",D7:"PA8",D8:"PA9",D9:"PC7",D10:"PB6",D11:"PA7",D12:"PA6",D13:"PA5",D14:"PB9",D15:"PB8",A0:"PA0",A1:"PA1",A2:"PA4",A3:"PB0",A4:"PC1",A5:"PC0"};
  const cn7odd=["PC10","PC12","VDD","BOOT0","NC","NC","PA13","PA14","PA15","GND","PB7","PC13","PC14","PC15",f401?"PH0":"PD0",f401?"PH1":"PD1","VBAT","PC2","PC3"];
  const cn7even=["PC11","PD2","E5V","GND","NC","IOREF","NRST","3V3","5V","GND","GND","VIN","NC","PA0","PA1","PA4","PB0","PC1","PC0"];
  const cn10odd=["PC9","PB8","PB9","AVDD","GND","PA5","PA6","PA7","PB6","PC7","PA9","PA8","PB10","PB4","PB5","PB3","PA10","PA2","PA3"];
  const cn10even=["PC8","PC6","PC5","U5V","NC","PA12","PA11","PB12",f401?"NC":"PB11","GND","PB2","PB1","PB15","PB14","PB13","AGND","PC4","NC","NC"];
  const pins=[];
  const canonical=label=>["GND","AGND"].includes(label)?"GND":["VDD","AVDD","IOREF"].includes(label)?"3V3":["U5V","E5V"].includes(label)?"5V":label;
  for(const [name,odd,even,side,x0] of [["CN7",cn7odd,cn7even,"left",-3.05],["CN10",cn10odd,cn10even,"right",2.796]]){
    for(let i=0;i<19;i++)for(let col=0;col<2;col++){
      const label=(col?even:odd)[i],connectorPin=i*2+col+1,id=name+"_"+connectorPin;
      const geometry=f401?{x:x0+col*.254,z:-.9+i*.254}:{...nucleoF103rbContact(name,connectorPin),print:false};
      pins.push({id,label,canonical:label==="NC"?id:canonical(label),...geometry,side,kind:pinKind(label)});
    }
  }
  const al=["NC","IOREF","RESET","3V3","5V","GND","GND","VIN","A0","A1","A2","A3","A4","A5"];
  const ar=["D15","D14","AREF","GND","D13","D12","D11","D10","D9","D8","D7","D6","D5","D4","D3","D2","D1","D0"];
  for(const [side,list,x] of [["left",al,-2.15],["right",ar,2.15]])list.forEach((label,i)=>{
    const id=/^(GND|NC|3V3|5V|IOREF|RESET|VIN|AREF)$/.test(label)?"ARD_"+side+"_"+i:label;
    const geometry=f401?{x,z:-.65+i*.254+(side==="left"&&i>=8?.3:0)}:side==="left"
      ? (i<8?nucleoF103rbContact("CN6",i+1):nucleoF103rbContact("CN8",i-7))
      : (i<10?nucleoF103rbContact("CN5",10-i):nucleoF103rbContact("CN9",18-i));
    pins.push({id,label,canonical:arduino[label]||canonical(label==="RESET"?"NRST":label),...geometry,side,kind:pinKind(label)});
  });
  const aliases={...arduino,RESET:"NRST",AREF:"3V3",VDD:"3V3",AVDD:"3V3",IOREF:"3V3",SDA:"PB9",SCL:"PB8"};
  return finish({
    id,name:f401?"ST NUCLEO-F401RE":"ST NUCLEO-F103RB",family:f401?"STM32F4":"STM32F1",mcu:device+"T6",
    logicVoltage:3.3,adcMax:4095,nativeAdcBits:12,adcDefaultBits:10,coreClockHz:f401?84000000:72000000,
    flashBytes:f401?524288:131072,ramBytes:f401?98304:20480,style:"nucleo",width:nucleoF103rbGeometry.width,height:nucleoF103rbGeometry.height,color:"#e9e9df",
    language:f401?"arduino":"stm32-spl",dialects:f401?["arduino"]:["stm32-spl","arduino"],
    pins,pinAliases:aliases,numberedPins:{...Object.fromEntries(Array.from({length:16},(_,i)=>[i,arduino["D"+i]])),...Object.fromEntries(Array.from({length:6},(_,i)=>[16+i,arduino["A"+i]]))},
    analogPins:["PA0","PA1","PA2","PA3","PA4","PA5","PA6","PA7","PB0","PB1","PC0","PC1","PC2","PC3","PC4","PC5"],pwmPins:["PA0","PA1","PA2","PA3",...(f401?["PA5"]:[]),"PA6","PA7","PA8","PA9","PA10","PA11","PB0","PB1","PB3","PB4","PB5","PB6","PB7","PB8","PB9","PB10","PC6","PC7","PC8","PC9"],
    hasPullDown:true,ledPin:"PA5",ledActiveLow:false,ledResistance:510,
    ...(!f401&&{
      capabilities:{nativeFirmware:"STM32F103RBT6 HEX/BIN"},
      userButton:{id:"@board-user-button",label:"B1",pin:"PC13",activeLow:true,pullOhms:4700},
      footprintNote:"按 ST UM1724 的 70 × 82.5 mm 外形、2.54 mm 针距和连接器编号重建。部件中心与 3D 模型共用近似坐标，适合教学对照。",
      breadboardNote:"ST Morpho 公针和 Arduino 母座可通过合适的跳线接到面包板；本板不能直接插入当前 400 孔面包板。"
    }),
    defaultPins:{led:"PA5",button:"PB1",adc:"PA0",pwm:"PB4",tx:"PA2",rx:"PA3"},
    platformio:{platform:"ststm32",board:f401?"nucleo_f401re":"nucleo_f103rb",framework:"arduino"},
    keil:{device,pack:f401?"Keil.STM32F4xx_DFP":"Keil.STM32F1xx_DFP",flashStart:"0x08000000",flashSize:f401?"0x80000":"0x20000",ramStart:"0x20000000",ramSize:f401?"0x18000":"0x5000",define:f401?"STM32F401xE":"STM32F10X_MD,USE_STDPERIPH_DRIVER"},
    sources:[sources.nucleo,f401?"https://www.st.com/en/evaluation-tools/nucleo-f401re.html":"https://www.st.com/en/evaluation-tools/nucleo-f103rb.html",...(!f401?["https://www.st.com/resource/en/schematic_pack/mb1136-default-c05_schematic.pdf"]:[])],
    notes:[f401?"F401使用Arduino风格接口模型；不把STM32F1标准库冒充F4 HAL/SPL。":"F103可使用原标准外设库子集或Arduino风格子集。板载 LD2 由 PA5 高电平点亮；蓝色 B1 松开时 PC13 为高，按下为低。","Arduino排针与Morpho排针上的同名MCU信号是同一电气节点。ST-LINK、跳线供电和调试协议未模拟。"]
  });
}
const additionalProfiles = [
  ...makeRpAvrProfiles({pico,uno,nano}),
  ...makeEspProfiles({rows,named}),
  ...makeStProfiles({rows,named}),
  ...makeSeeedProfiles({rows}),
  ...makeArduinoNanoProfiles({rows,named}),
  ...makeBleProfiles({rows,named}),
  makeGigaProfile({rows,named}),
  ...makeDueTeensyProfiles({rows,named}),
  makeMicrobitProfile(),
  ...makeNordicDkProfiles(),
  ...makeTiProfiles(),
  ...makeNxpProfiles(),
  ...makeWchProfiles(),
  ...makeRaspberryPiProfiles()
].map(finish);
export const BOARD_PROFILES=Object.freeze(Object.fromEntries([bluepill,uno,nano,mega,esp32,c3,pico,nucleoProfile(false),nucleoProfile(true),...additionalProfiles].map(p=>[p.id,p])));
export const BOARD_PROFILE_LIST=Object.freeze(Object.values(BOARD_PROFILES));
const ID_ALIASES={uno:"uno-r3","nano-classic":"nano",mega:"mega2560","mega-2560":"mega2560",esp32:"esp32-devkitc",esp32c3:"esp32-c3-devkitm","rp2040-pico":"pico",f103rb:"nucleo-f103rb",f401re:"nucleo-f401re"};
export function getBoardProfile(id="bluepill"){
  id=ID_ALIASES[id]||id||"bluepill";
  if(!BOARD_PROFILES[id])throw new Error("尚未实现这块板的仿真模型："+id);
  return BOARD_PROFILES[id];
}
export function canonicalPin(pin,boardId="bluepill"){
  const profile=getBoardProfile(boardId),text=String(pin).replace(/^mcu:/,"");
  return profile.pinAliases[text]||profile.pinAliases[text.toUpperCase()]||text;
}
export function boardPinNumber(pin,boardId="bluepill"){
  const profile=getBoardProfile(boardId),name=canonicalPin(pin,boardId);
  const found=Object.entries(profile.numberedPins).find(([,v])=>v===name);
  if(found)return Number(found[0]);
  if(/^GP(?:IO)?\d+$/.test(name))return Number(name.replace(/\D/g,""));
  return name;
}
export function boardStarterKinds(profile) {
  const kinds = ['blink','button'];
  if (profile.capabilities.analogInput) kinds.push('adc');
  if (profile.capabilities.pwm) kinds.push('pwm');
  return kinds;
}

export function makeBoardStarter(boardId="bluepill",kind="blink",{externalLed=false}={}){
  const p=getBoardProfile(boardId),pins=p.defaultPins;
  if (!boardStarterKinds(p).includes(kind)) kind = 'blink';
  const led=kind==="pwm"?pins.pwm:kind==="blink"?(p.ledPin||pins.led):pins.led,button=pins.button,analog=pins.adc;
  const useOnboard=!externalLed&&kind==="blink"&&led===p.ledPin&&!!p.ledPin;
  const codePin=name=>{const number=boardPinNumber(name,p.id);return typeof number==="number"?String(number):name;};
  const extPin=canonical=>{
    const physical=p.pins.find(pin=>pin.canonical===canonical&&pin.kind==="gpio");
    return physical?.id||canonical;
  };
  const pinDeclaration=(variable,canonical)=>{
    const declaration=`const int ${variable} = ${codePin(canonical)};`;
    if(p.arduinoExport!==false)return declaration;
    const pin=p.pins.find(item=>item.id===extPin(canonical));
    const labels=[...new Set([pin?.location,pin?.label,canonical].filter(Boolean))];
    return `${declaration} // ${labels.join(' · ')}`;
  };
  const physicalPower=canonical=>p.pins.find(pin=>pin.canonical===canonical&&pin.contact==='ring')?.id
    ||p.pins.find(pin=>pin.canonical===canonical)?.id||canonical;
  const gnd=physicalPower("GND"),logic=physicalPower(p.logicRail);
  const breadboard={x:1.8,z:0};
  const benchZ=4.1;
  const boardX=Math.min(-5,breadboard.x-breadboardDimensions.width/2-p.width/2-.35);
  const c={version:2,boardId:p.id,powered:true,boot0:false,board:{x:boardX,z:0},breadboard,components:[],wires:[]};
  let n=0;const wire=(a,b,color="#ea7246")=>c.wires.push({id:"w"+(++n),a,b,color});
  if(!useOnboard){
    const resistance=p.starterLedResistance ?? (p.logicVoltage===5?(p.gpioWarningMa<=8?1000:470):330);
    c.components.push({id:"led1",type:"led",x:2.1,z:benchZ,rotation:0,color:"red",maxMa:20},{id:"r1",type:"resistor",x:.8,z:benchZ,rotation:0,resistance});
    wire("mcu:"+extPin(led),"r1:1");wire("r1:2","led1:A");wire("led1:K","mcu:"+gnd,"#24384a");
  }
  if(kind==="button"){
    c.components.push({id:"button1",type:"button",x:4.6,z:benchZ,rotation:0,pressed:false});
    wire("mcu:"+extPin(button),"button1:1","#48a6c8");wire("button1:3","mcu:"+gnd,"#24384a");
  }
  if(kind==="adc"){
    c.components.push({id:"pot1",type:"pot",x:4.6,z:benchZ,rotation:0,position:.5,resistance:10000});
    wire("mcu:"+logic,"pot1:VCC","#dd5f58");wire("pot1:GND","mcu:"+gnd,"#24384a");wire("pot1:OUT","mcu:"+extPin(analog),"#8f70d6");
  }
  const lines=["// "+p.name+" · "+({blink:"闪烁",button:"按键输入",adc:"模拟采样",pwm:"PWM呼吸"}[kind]||"闪烁"),
    p.arduinoExport===false ? "// 引脚编号和函数用于本实验台。移植实物时请使用对应 SDK 和官方引脚资料。" : "// 本代码使用Arduino风格接口；浏览器运行的是公开标注的API行为子集。",
    "#include <Arduino.h>","",pinDeclaration("LED_PIN",led)];
  if(kind==="button")lines.push(pinDeclaration("BUTTON_PIN",button));
  if(kind==="adc")lines.push(pinDeclaration("ANALOG_PIN",analog),"int adcValue = 0;");
  if(kind==="pwm")lines.push("int brightness = 0;");
  lines.push("","void setup()","{","    pinMode(LED_PIN, OUTPUT);");
  if(kind==="button")lines.push("    pinMode(BUTTON_PIN, INPUT_PULLUP);");
  if(kind==="adc")lines.push("    Serial.begin(9600);");
  lines.push("}","","void loop()","{");
  if(kind==="button")lines.push("    digitalWrite(LED_PIN, digitalRead(BUTTON_PIN) == LOW ? HIGH : LOW);","    delay(10);");
  else if(kind==="adc")lines.push("    adcValue = analogRead(ANALOG_PIN);","    digitalWrite(LED_PIN, adcValue > "+(2**p.adcDefaultBits/2)+" ? HIGH : LOW);","    Serial.println(adcValue);","    delay(100);");
  else if(kind==="pwm")lines.push("    for (brightness = 0; brightness <= 255; brightness += 5)","    {","        analogWrite(LED_PIN, brightness);","        delay(20);","    }","    for (brightness = 255; brightness >= 0; brightness -= 5)","    {","        analogWrite(LED_PIN, brightness);","        delay(20);","    }");
  else lines.push("    digitalWrite(LED_PIN, "+(p.ledActiveLow&&useOnboard?"LOW":"HIGH")+");","    delay(500);","    digitalWrite(LED_PIN, "+(p.ledActiveLow&&useOnboard?"HIGH":"LOW")+");","    delay(500);");
  lines.push("}","");
  return {files:{"sketch.ino":lines.join("\n")},entry:"sketch.ino",circuit:c,boardId:p.id,ledPin:led,description:p.name+" · "+kind+"；使用该板实际引脚映射与逻辑电压。",language:"arduino"};
}
