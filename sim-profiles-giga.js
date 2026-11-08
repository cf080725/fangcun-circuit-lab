const boardSource = 'https://docs.arduino.cc/hardware/giga-r1-wifi/';
const pinout = 'https://docs.arduino.cc/resources/pinouts/ABX00063-full-pinout.pdf';
const variant = 'https://github.com/arduino/ArduinoCore-mbed/blob/main/variants/GIGA/variant.cpp';

// ABX00063 top-view pinout, with the USB edge at -z.
const digital = ['PB7','PA9','PA3','PA2','PJ8','PA7','PD13','PB4','PB8','PB9','PK1','PJ10','PJ11','PH6',
  'PG14','PC7','PH13','PI9','PD5','PD6','PB11','PH4','PJ12','PG13','PG12','PJ0','PJ14','PJ1','PJ15','PJ2',
  'PK3','PJ3','PK4','PJ4','PK5','PJ5','PK6','PJ6','PJ7','PI14','PE6','PK7','PI15','PI10','PG10','PI13',
  'PH15','PB2','PK0','PE4','PI11','PE5','PK2','PG7'];
const analog = ['PC4','PC5','PB0','PB1','PC3','PC2','PC0','PA0','PC2_C','PC3_C','PA1_C','PA0_C'];

export function makeGigaProfile({ rows, named }) {
  const width = 5.34, height = 10.16;
  const d = (index, extra) => named(`D${index}`, `D${index}`, digital[index], extra);
  const left = ['NC', named('IOREF','IOREF','3V3'), named('RESET','RESET','NRST'), '3V3','5V',
    named('GND1','GND','GND'), named('GND2','GND','GND'), 'VIN',
    ...analog.map((pin, index) => named(`A${index}`, `A${index}`, pin, {gap:index < 8 ? .254 : .508}))];
  const right = [named('D101','SCL1','PB6'), named('D102','SDA1','PH12'), 'AREF', named('GND3','GND','GND'),
    ...Array.from({length:14}, (_, index) => d(13-index, {gap:index < 6 ? 0 : .127})),
    ...Array.from({length:8}, (_, index) => d(14+index, {gap:.381}))];
  const pins = rows(left, [], width, height, {start:-2.30,x:2.42})
    .concat(rows([], right, width, height, {start:-3.18,x:2.42}));

  for (let column = 0; column < 18; column++) {
    for (let row = 0; row < 2; row++) {
      const pin = column === 0 ? named(`5V_END${row}`,'5V','5V',{kind:'power'})
        : column === 17 ? named(`GND_END${row}`,'GND','GND',{kind:'ground'})
        : d(22+(column-1)*2+row, {kind:'gpio'});
      pins.push({...pin, side:'bottom', x:-1.91+column*.254, z:4.604-row*.254});
    }
  }
  const numberedPins = Object.fromEntries([
    ...digital.map((pin,index) => [index,pin]),
    ...analog.slice(0,8).map((pin,index) => [76+index,pin]),
    [87,'PJ13'], [101,'PB6'], [102,'PH12']
  ]);

  return {
    id:'giga-r1-wifi', name:'Arduino GIGA R1 WiFi', family:'STM32H7', mcu:'STM32H747XIH6',
    style:'giga', width, height, color:'#087e8b', pins,
    logicVoltage:3.3, adcMax:65535, nativeAdcBits:16, adcDefaultBits:10,
    coreClockHz:480000000, flashBytes:2*1024*1024, ramBytes:1024*1024,
    language:'arduino', dialects:['arduino'], numberedPins,
    pinAliases:{SDA:'PB11',SCL:'PH4',LEDG:'PJ13'},
    analogPins:[...analog], analogOnly:analog.slice(8), pwmPins:digital.slice(2,14),
    ledPin:'PJ13', ledActiveLow:true, ledResistance:1000, hasPullDown:true,
    defaultPins:{led:'PH6',button:'PA3',adc:'PC4',pwm:'PK1',tx:'PA9',rx:'PB7'},
    partialPinout:true, sources:[boardSource,pinout,variant],
    notes:[
      '支持主排针 D0–D53、A0–A11、SDA1/SCL1。A8–A11 仅作模拟输入，PWM 教学覆盖 D2–D13。',
      '板载绿色 LED 对应 LED_BUILTIN，低电平点亮。逻辑电压为 3.3 V。',
      '运行 Arduino 风格源码子集。双核、无线、USB、显示屏、相机、音频和 DAC 未仿真。'
    ],
    footprintNote:'按 Arduino ABX00063 主排针针序绘制的三维教学布局，尺寸与元件外观简化。'
  };
}
