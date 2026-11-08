const pinoutSource = 'https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#40-pin-gpio-header';
const gpioHeaderPitch = .254;
const gpioHeaderSignals = [
  '3V3', '5V', 2, '5V', 3, 'GND', 4, 14, 'GND', 15,
  17, 18, 27, 'GND', 22, 23, '3V3', 24, 10, 'GND',
  9, 25, 11, 8, 'GND', 7, 0, 1, 5, 'GND',
  6, 12, 13, 'GND', 19, 16, 26, 20, 'GND', 21
];

function piProfile({
  id, name, mcu, width, height, coreClockHz, drawing, connectorNote
}) {
  const numberedPins = {};
  const pinAliases = {};
  const firstX = 3.25 - width / 2 - 19 * gpioHeaderPitch / 2;
  const headerCenterZ = -height / 2 + .35;
  const pins = gpioHeaderSignals.map((signal, index) => {
    const physical = index + 1;
    const gpio = typeof signal === 'number';
    const canonical = gpio ? `GPIO${signal}` : signal;
    const reserved = gpio && signal < 2;
    const label = reserved ? (signal === 0 ? 'ID_SD' : 'ID_SC') : canonical;
    const kind = reserved ? 'reserved' : gpio ? 'gpio' : signal === 'GND' ? 'ground' : 'power';
    if (gpio) {
      numberedPins[signal] = canonical;
      pinAliases[`BCM${signal}`] = canonical;
    }
    pinAliases[`J8.${physical}`] = canonical;
    return {
      id:`J8_${physical}`, label, canonical, kind,
      side:'top', connector:'J8', connectorPin:physical, contact:'fixed-male', contactY:1.19,
      x:firstX + Math.floor(index / 2) * gpioHeaderPitch,
      z:headerCenterZ + (physical % 2 ? 1 : -1) * gpioHeaderPitch / 2
    };
  });
  return {
    id, name, mcu, width, height, coreClockHz, pins, pinAliases, numberedPins,
    family:'Raspberry Pi SBC', style:'raspberry-pi-sbc', color:'#33884c',
    logicVoltage:3.3, hasPullDown:true, gpioWarningMa:4, starterLedResistance:1000,
    adcMax:0, adcDefaultBits:0, analogPins:[], pwmPins:[], ledPin:null, serialPorts:[],
    reservedPins:['GPIO0','GPIO1'],
    language:'arduino', dialects:['arduino'], arduinoExport:false,
    defaultPins:{led:'GPIO17',button:'GPIO27'},
    capabilities:{
      analogInput:false, pwm:false, serialConsole:false,
      analogReadResolution:false, analogWriteResolution:false, analogWriteFrequency:false,
      note:'运行实验台的 GPIO 教学接口，覆盖数字输入输出和上下拉。实物上的 Linux 程序请使用对应的 GPIO 库。'
    },
    sources:[drawing,pinoutSource],
    footprintNote:'板卡外形和排针位置按原厂机械图绘制，主要接头与器件作外观近似。',
    breadboardNote:connectorNote,
    notes:[
      '按 J8.1–40 找实物针位，源码中的数字按 BCM 编号。例如 17 对应 GPIO17，实际在 J8.11。',
      'GPIO 使用 3.3 V 逻辑。J8.2 和 J8.4 是 5 V 电源端。J8.27 和 J8.28 留给 HAT 识别。',
      '实验台提供外接 LED 与按键示例。Linux、系统启动、板载指示灯及 GPIO 复用功能留在实物中验证。'
    ]
  };
}

const classicHeader = '板顶的 40 针公排针用杜邦线连接面包板。';

export function makeRaspberryPiProfiles() {
  return [
    piProfile({
      id:'raspberry-pi-4', name:'Raspberry Pi 4 Model B', mcu:'BCM2711',
      width:8.5, height:5.6, coreClockHz:1.8e9,
      drawing:'https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf',
      connectorNote:classicHeader
    }),
    piProfile({
      id:'raspberry-pi-5', name:'Raspberry Pi 5', mcu:'BCM2712 / RP1',
      width:8.5, height:5.6, coreClockHz:2.4e9,
      drawing:'https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf',
      connectorNote:classicHeader
    }),
    piProfile({
      id:'pi-zero-2-w', name:'Raspberry Pi Zero 2 W · 已焊排针版', mcu:'RP3A0',
      width:6.5, height:3, coreClockHz:1e9,
      drawing:'https://datasheets.raspberrypi.com/rpizero2/raspberry-pi-zero-2-w-mechanical-drawing.pdf',
      connectorNote:'实验台展示已焊排针版，可从板顶接杜邦线。裸板需先焊好排针。'
    })
  ];
}
