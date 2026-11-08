const wch003 = 'https://github.com/openwch/ch32v003/tree/main/SCHPCB/CH32V003F4P6-R0-1v1';
const wch307 = 'https://github.com/openwch/ch32v307/tree/main/SCHPCB/CH32V307V-R1-1v0';
const pitch = .254;
const shared = {
  style:'wch-evt', language:'arduino', dialects:['arduino'], arduinoExport:false,
  partialPinout:true, logicVoltage:3.3, logicRail:'VCC', hasPullDown:true,
  adcDefaultBits:10, gpioWarningMa:8,
  capabilities:{analogReadResolution:true, analogWriteResolution:true, analogWriteFrequency:false}
};

function ch32v003Evt() {
  const connector = (header, side, columns, contacts) => contacts.map(([signal, kind='gpio'], index) => ({
    id:`${header}_${index+1}`,
    label:signal==='NRST' ? 'NRST/PD7' : signal,
    canonical:signal, kind, contact:'male', side,
    x:columns[index%2], z:-.1143+Math.floor(index/2)*pitch
  }));
  // Board outline and contact centers in centimetres from the WCH PcbDoc.
  const pins = [
    ...connector('P1','left',[-1.4803,-1.2263],[
      ['VCC','power'],['VCC','power'],['PD4'],['PD5'],['PD6'],['NRST','control'],
      ['PA1','reserved'],['PA2','reserved'],['PD0'],['PC0'],
      ['GND','ground'],['GND','ground'],['GND','ground'],['GND','ground']
    ]),
    ...connector('P2','right',[1.0978,1.3518],[
      ['VCC','power'],['VCC','power'],['GND','ground'],['GND','ground'],
      ['PD3'],['PD1','reserved'],['PD2'],['PC7'],['PC6'],['PC5'],['PC4'],['PC3'],['PC2'],['PC1']
    ])
  ];
  const numberedPins = Object.fromEntries(pins.filter(pin=>/^P[ACD]\d$/.test(pin.canonical)).map(pin=>{
    const [,port,number] = pin.canonical;
    return [(port.charCodeAt(0)-65)*16+Number(number),pin.canonical];
  }));
  return {
    ...shared, id:'ch32v003-evt', name:'CH32V003EVT · R0-1v1', family:'WCH RISC-V',
    mcu:'CH32V003F4P6', boardMarking:'CH32V003F4P6-R0-1v1',
    width:3.9004,height:4.5212,color:'#11794d',coreClockHz:48e6,
    flashBytes:16*1024,ramBytes:2*1024,adcMax:1023,
    pins, numberedPins, pinAliases:{TX:'PD5',RX:'PD6',PD7:'NRST'},
    reservedPins:['PA1','PA2','PD1','NRST'],
    analogPins:['PC4','PD2','PD3','PD5','PD6','PD4'],
    pwmPins:['PC0','PC3','PC4','PD2','PD3','PD4'],
    defaultPins:{led:'PD4',button:'PC1',adc:'PC4',pwm:'PD4',tx:'PD5',rx:'PD6'},
    sources:[wch003,'https://www.wch-ic.com/products/CH32V003',
      'https://github.com/openwch/ch32v003/blob/main/EVT/PUB/CH32V00x%20Evaluation%20Board%20Reference-EN.pdf',
      'https://github.com/openwch/arduino_core_ch32/blob/main/variants/CH32V00x/CH32V003F4/PeripheralPins.c'],
    footprintNote:'按沁恒 R0-1v1 官方 PCB 建模，教学接口覆盖 P1 和 P2。板上 LED 的 P4 和单线调试在几何中保留位置。',
    notes:[
      '采用板载稳压的 3.3 V VCC。USB-C 仅用于该板的供电。P1 和 P2 是双列公排针，面包板接线用跳线。',
      'PD4（P1 第 3 脚）作数字输出和 TIM2_CH1 PWM，PC1（P2 第 14 脚）读外接按键，PC4（P2 第 11 脚）采样 ADC 通道 2。',
      'PA1、PA2 默认用于晶振，通往排针的电阻未装。PD1 保留为 SWIO，PD7 保留为复位。',
      '示例数字编号是端口字母序号乘 16 加脚号。外接 LED、按键和旋钮可以仿真。实物程序应按沁恒工具链及对应引脚定义移植。'
    ]
  };
}

function ch32v307Evt() {
  const digital = ['PA10','PA9','PA8','PA7','PA6','PB5','PB8','PB9',
    'PB1','PB0','PB12','PB15','PB14','PB13','PB11','PB10'];
  const analog = ['PA0','PA1','PA2','PA3','PA4','PA5'];
  const digitalContact = index => [`D${index}`,digital[index]];
  const row = (connector,side,x,z,entries) => entries.map(([id,canonical,kind='gpio',label=canonical],index)=>({
    id,canonical,kind,label,side,x,z:z+index*pitch,contact:'female',connector,connectorPin:index+1
  }));
  // On WCH's R1, pin 1 of each inner header is the contact closest to the USB debugger.
  const pins = [
    ...row('J5','left',-2.413,-1.3254,[
      ['J5_1','J5_1','nc','NC'],['J5_2','VCC','power'],['NRST','NRST','control'],
      ['J5_4','VCC','power'],['J5_5','5V','power','+5V'],['GND1','GND','ground'],
      ['GND2','GND','ground'],['J5_8','5V','power','+5V']
    ]),
    ...row('J6','left',-2.413,.9606,analog.map((pin,index)=>[`A${index}`,pin])),
    ...row('J7','right',2.413,-2.2398,[
      digitalContact(15),digitalContact(14),['AREF','VDDA','control'],['GND3','GND','ground'],
      ...[13,12,11,10,9,8].map(digitalContact)
    ]),
    ...row('J8','right',2.413,.4526,[7,6,5,4,3,2,1,0].map(digitalContact))
  ];
  return {
    ...shared, id:'ch32v307-evt', name:'CH32V307V-EVT · R1-1v0', family:'WCH RISC-V',
    mcu:'CH32V307VCT6', boardMarking:'CH32V307V-R1-1v0',
    width:7.4,height:10.3429,color:'#25292a',coreClockHz:144e6,
    flashBytes:256*1024,ramBytes:64*1024,adcMax:4095,
    pins, pinAliases:{TX:'PA9',RX:'PA10',SDA:'PB11',SCL:'PB10'},
    numberedPins:Object.fromEntries([...digital,...analog].map((pin,index)=>[index,pin])),
    analogPins:analog,
    pwmPins:['PA0','PA1','PA2','PA3','PA6','PA7','PA8','PA9','PA10','PB0','PB1','PB8','PB9'],
    defaultPins:{led:'PA8',button:'PB9',adc:'PA0',pwm:'PA8',tx:'PA9',rx:'PA10'},
    sources:[wch307,'https://www.wch-ic.com/products/CH32V307.html',
      'https://github.com/openwch/ch32v307/blob/main/EVT/PUB/CH32V30x%20Evaluation%20Board%20Reference-EN.pdf',
      'https://github.com/openwch/arduino_core_ch32/blob/main/variants/CH32V30x/CH32V307VCT6/PeripheralPins.c',
      'https://github.com/openwch/ch32v307/blob/main/EVT/EXAM/TIM/TIM_DMA/User/main.c'],
    footprintNote:'按沁恒 CH32V307V-R1-1v0 官方 PCB 建模，开放内侧 J5、J6、J7、J8 母排针。',
    notes:[
      '采用板载稳压的 3.3 V VCC。J5 的 +5V 是供电脚。VDDA 保留为参考触点，教学模型使用固定 ADC 参考。',
      '外接点灯、按键和 ADC 分别使用 D2（PA8）、D7（PB9）、A0（PA0）。PWM 用 PA8 的 TIM1_CH1。数字编号按官方原理图 J6、J7、J8 的 Arduino 兼容位号。',
      '内侧母排针可用跳线接线。外侧 J3、J4 仅显示外观，板载 LED、WCH-LinkE、以太网和 USB 数据接口仅供识别。',
      '示例使用实验台的 Arduino 风格教学接口。实物应按沁恒 SDK 及 R1-1v0 的官方资料移植。'
    ]
  };
}

export function makeWchProfiles() {
  return [ch32v003Evt(),ch32v307Evt()];
}
