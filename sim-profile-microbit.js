const revision = 'https://tech.microbit.org/hardware/2-2-revision/';
const edgeConnector = 'https://tech.microbit.org/hardware/edge-connector/';
const assembly = 'https://tech.microbit.org/docs/hardware/assets/Microbit_V2_Assembly.pdf';

// Front face, with the USB connector at the top. Positions are in centimetres.
// Rings and narrow strips are different contacts, even when tied to the same rail.
const frontContacts = [
  ['P3', 'P0.31', -2.477, 'reserved'],
  ['P0', 'P0.02', -2.159, 'gpio', 'ring'],
  ['P4', 'P0.28', -1.842, 'reserved'],
  ['P5', 'P0.14', -1.715, 'reserved'],
  ['P6', 'P1.05', -1.588, 'reserved'],
  ['P7', 'P0.11', -1.461, 'reserved'],
  ['P1', 'P0.03', -1.143, 'gpio', 'ring'],
  ['P8', 'P0.10', -.826, 'gpio'],
  ['P9', 'P0.09', -.699, 'gpio'],
  ['P10', 'P0.30', -.572, 'reserved'],
  ['P11', 'P0.23', -.445, 'reserved'],
  ['P12', 'P0.12', -.318, 'reserved'],
  ['P2', 'P0.04', 0, 'gpio', 'ring'],
  ['P13', 'P0.17', .318, 'gpio'],
  ['P14', 'P0.01', .445, 'gpio'],
  ['P15', 'P0.13', .572, 'gpio'],
  ['P16', 'P1.02', .699, 'gpio'],
  ['3V3b', '3V3', .826, 'power'],
  ['3V3', '3V3', 1.143, 'power', 'ring'],
  ['3V3c', '3V3', 1.461, 'power'],
  ['P19', 'P0.26', 1.588, 'reserved'],
  ['P20', 'P1.00', 1.715, 'reserved'],
  ['GND2', 'GND', 1.842, 'ground'],
  ['GND', 'GND', 2.159, 'ground', 'ring'],
  ['GND3', 'GND', 2.477, 'ground']
];

export function makeMicrobitProfile() {
  const pins = frontContacts.map(([id,canonical,x,kind,contact='edge']) => {
    const ring = contact==='ring';
    const outer = Math.abs(x)>2.4;
    const label = kind==='power' ? '3V' : kind==='ground' ? 'GND' : ring ? id.slice(1) : id;
    return {id,label,canonical,kind,contact,side:'bottom',x,z:ring ? 1.414 : outer ? 1.76 : 1.818,
      ...(ring ? {} : {print:false,padLength:outer ? .30 : .504})};
  });
  const pinGroup = kind => pins.filter(pin=>pin.kind===kind).map(pin=>pin.canonical);

  return {
    id:'microbit-v2', name:'BBC micro:bit V2.2x', family:'nRF52833', mcu:'nRF52833',
    style:'microbit-v2', width:5.16, height:4.20, color:'#202325',
    logicVoltage:3.3, logicHighThreshold:2.31, coreClockHz:64000000,
    flashBytes:512*1024, ramBytes:128*1024, adcMax:4095, adcDefaultBits:10,
    hasPullDown:true, gpioWarningMa:5, starterLedResistance:3300,
    pwmFrequency:500, language:'arduino', dialects:['arduino'], arduinoExport:false, partialPinout:true,
    pins,
    numberedPins:Object.fromEntries(pins.filter(pin=>/^P\d+$/.test(pin.id)).map(pin=>[pin.id.slice(1),pin.canonical])),
    analogPins:['P0.02','P0.03','P0.04'], pwmPins:pinGroup('gpio'), reservedPins:pinGroup('reserved'),
    defaultPins:{led:'P0.02',button:'P0.03',adc:'P0.04',pwm:'P0.02'},
    capabilities:{analogReadResolution:true,analogWriteResolution:true,analogWriteFrequency:false},
    breadboardNote:'实物的 0、1、2、3V 和 GND 大环可用鳄鱼夹引线。小触点需要边缘连接器转接板。',
    sources:[revision,edgeConnector,assembly,'https://tech.microbit.org/hardware/schematic/','https://www.nordicsemi.com/Products/nRF52833'],
    notes:[
      '正面五个大环是 P0、P1、P2、3V、GND，可用鳄鱼夹或转接板引线。小金手指需用边缘连接器转接，板身不能直插面包板。',
      '开放 P0、P1、P2、P8、P9、P13–P16 的教学级 GPIO 与 PWM。前三个大环还支持模拟输入。P8/P9 按出厂关闭 NFC 的状态建模。',
      '保留点阵共用脚 P3/P4/P6/P7/P10、板载按键 P5/P11、辅助功能 P12 和外部 I²C P19/P20 的位置，当前教学接口不驱动这些脚。',
      '示例编号沿用边缘连接器丝印，模拟读数默认 10 位，可设为 12 位。外接 LED 串联 3.3 kΩ，使模型电流低于规格表中标准驱动的 0.5 mA 测试负载。',
      '通过实验台 C 风格接口运行外接电路与虚拟串口。MakeCode、MicroPython、板载点阵、音频、无线和真实 USB 协议未仿真。'
    ],
    footprintNote:'按 micro:bit V2 正面装配图标注五个大环和小金手指的相对位置，细节为教学绘制。'
  };
}
