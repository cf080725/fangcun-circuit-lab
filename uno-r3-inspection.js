import { BOARD_PROFILES } from './board-profiles.js';

const photoWidth = 840;
const photoHeight = 1194;
const boardPinout = 'https://content.arduino.cc/assets/A000066-full-pinout.pdf';
const boardSchematic = 'https://content.arduino.cc/assets/UNO-TH_Rev3e_sch.pdf';
const chipDatasheet = 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061B.pdf';

// DIP pin numbers in order around the package, seen from the top.
const chipPinRows = [
  ['PC6', '低电平触发复位。UNO R3 板上的 RESET 按钮、POWER 排针和主 ICSP 都接到这里。'],
  ['PD0', 'USART 接收 RXD，也是 Arduino 数字引脚 D0。'],
  ['PD1', 'USART 发送 TXD，也是 Arduino 数字引脚 D1。'],
  ['PD2', '数字引脚 D2，可用作外部中断 INT0。'],
  ['PD3', '数字引脚 D3，可用作外部中断 INT1，或由定时器 2 的 OC2B 输出 PWM。'],
  ['PD4', '数字引脚 D4，可用作 USART 同步时钟 XCK 或定时器 0 的外部时钟 T0。'],
  ['VCC', '芯片数字供电。UNO R3 主芯片接板上的 5 V 电源网络。'],
  ['GND', '芯片接地端之一，与第 22 脚共用板上的地。'],
  ['PB6', '晶体振荡器输入 XTAL1。UNO R3 在此接入主芯片的 16 MHz 谐振器。'],
  ['PB7', '晶体振荡器输出 XTAL2，与 XTAL1 一起接 16 MHz 谐振器。'],
  ['PD5', '数字引脚 D5，可由定时器 0 的 OC0B 输出 PWM。'],
  ['PD6', '数字引脚 D6，可由定时器 0 的 OC0A 输出 PWM，也可用作比较器正输入 AIN0。'],
  ['PD7', '数字引脚 D7，也可用作模拟比较器负输入 AIN1。'],
  ['PB0', '数字引脚 D8，也可用作定时器 1 输入捕获 ICP1。'],
  ['PB1', '数字引脚 D9，可由定时器 1 的 OC1A 输出 PWM。'],
  ['PB2', '数字引脚 D10，可用作 SPI 片选 SS，也可由定时器 1 的 OC1B 输出 PWM。'],
  ['PB3', '数字引脚 D11，亦为主 ICSP 的 MOSI / COPI，可由定时器 2 的 OC2A 输出 PWM。'],
  ['PB4', '数字引脚 D12，同时接到主 ICSP 的 MISO / CIPO。'],
  ['PB5', '数字引脚 D13，同时接到主 ICSP 的 SPI 时钟 SCK。板载 L 灯也由此信号驱动。'],
  ['AVCC', '为 ADC 与部分 Port C 电路供电。它与 AREF 的用途不同。'],
  ['AREF', 'ADC 参考电压引脚，与板上 AREF 触点相连。'],
  ['GND', '芯片接地端之一，与第 8 脚共用板上的地。'],
  ['PC0', 'Arduino 模拟引脚 A0，对应 ADC 通道 0，也可作数字引脚 D14。'],
  ['PC1', 'Arduino 模拟引脚 A1，对应 ADC 通道 1，也可作数字引脚 D15。'],
  ['PC2', 'Arduino 模拟引脚 A2，对应 ADC 通道 2，也可作数字引脚 D16。'],
  ['PC3', 'Arduino 模拟引脚 A3，对应 ADC 通道 3，也可作数字引脚 D17。'],
  ['PC4', 'Arduino 模拟引脚 A4，对应 ADC 通道 4，也和专用 SDA 触点相连。'],
  ['PC5', 'Arduino 模拟引脚 A5，对应 ADC 通道 5，也和专用 SCL 触点相连。']
];
const chipPins = chipPinRows.map(([signal, summary], index) => ({ number: index + 1, signal, summary }));

const headerChipPin = {
  RESET: 1, D0: 2, D1: 3, D2: 4, D3: 5, D4: 6, D5: 11, D6: 12, D7: 13,
  D8: 14, D9: 15, D10: 16, D11: 17, D12: 18, D13: 19, AREF: 21,
  A0: 23, A1: 24, A2: 25, A3: 26, A4: 27, A5: 28, SDA: 27, SCL: 28
};
const railSummary = {
  NC: 'R3 电源排针预留位置。不要把它当作电源或输入输出使用。',
  IOREF: '告诉扩展板主板的逻辑电平。UNO R3 上与 5 V 网络相连。',
  '3V3': '板上的 3.3 V 电源输出。主芯片仍使用 5 V 数字供电。',
  '5V': '板上的 5 V 电源网络，为主芯片和 USB 接口芯片等电路供电。',
  VIN: '经过板上稳压电路的电源输入，与 5 V 输出触点的用途不同。',
  GND: '这个插孔有独立的物理位置，与板上其他 GND 共用电气参考点。'
};

// Photo centers in pixels and first socket centers in cm, USB up in both views.
// CAD centers use Arduino A000066 UNO-TH Rev3e: x=(Y-26.67)/10, z=(X-34.29)/10.
const headerPhotos = [
  ['左侧 · POWER 电源', ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND1', 'GND2', 'VIN'],
    [[34,569],[34,610],[34,651],[33,692],[32,733],[32,773],[32,814],[32,854]], [-2.413,-.635]],
  ['左侧 · ANALOG IN 模拟', ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    [[35,938],[35,975],[35,1016],[35,1057],[35,1098],[35,1140]], [-2.413,1.651]],
  ['右侧 · DIGITAL 数字（上）', ['SCL', 'SDA', 'AREF', 'GND3', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'],
    [[807,422],[807,464],[807,504],[807,544],[807,585],[807,625],[806,666],[807,706],[807,747],[807,788]], [2.413,-1.5494]],
  ['右侧 · DIGITAL 数字（下）', ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'],
    [[810,853],[809,894],[808,934],[807,974],[806,1015],[805,1055],[805,1096],[804,1136]], [2.413,1.143]]
];

const boardProfile = BOARD_PROFILES['uno-r3'];
const profilePinById = new Map(boardProfile.pins.map(pin => [pin.id, pin]));

function makePin(id, label, canonical, group, [px, py], chipPin, summary, [modelX, modelZ]) {
  return {
    id, label, canonical, group, chipPin,
    summary: summary ?? chipPins[chipPin - 1]?.summary,
    x: px / photoWidth, y: py / photoHeight,
    modelX, modelZ
  };
}

const outerPins = headerPhotos.flatMap(([group, ids, centers, [x,z]]) => ids.map((id, index) => {
  const { canonical } = profilePinById.get(id);
  const chipPin = headerChipPin[id] ?? null;
  const label = /^GND[123]$/.test(id) ? `GND · ${id.slice(-1)}` : id;
  return makePin(id, label, canonical, group, centers[index], chipPin, railSummary[canonical], [x,z+index*.254]);
}));

// Page 4 of Arduino's full pinout gives the connector numbering in this orientation.
// Signals on ICSP1 program the ATmega16U2 USB bridge, not the main controller.
const icspSignals = ['MISO', '5V', 'SCK', 'MOSI', 'RESET', 'GND'];
const icspMainCanonical = ['D12', '5V', 'D13', 'D11', 'RESET', 'GND'];
const icspMainCenters = [[483,1142],[483,1185],[442,1142],[442,1185],[403,1142],[403,1185]];
const icspUsbCenters = [[755,453],[717,453],[755,413],[717,413],[755,372],[717,372]];
const icspMainCad = [[.381,2.9337],[.381,3.1877],[.127,2.9337],[.127,3.1877],[-.127,2.9337],[-.127,3.1877]];
const icspUsbCad = [[2.0828,-1.3462],[1.8288,-1.3462],[2.0828,-1.6002],[1.8288,-1.6002],[2.0828,-1.8542],[1.8288,-1.8542]];

const programmingPins = icspSignals.flatMap((signal, index) => {
  const canonical = icspMainCanonical[index];
  const number = index + 1;
  const bridgeCanonical = signal === '5V' || signal === 'GND' ? signal : 'USB_' + signal;
  return [
    makePin(`ICSP_${number}`, `ICSP ${number} · ${signal}`, canonical, '板尾 · ATmega328P 主 ICSP',
      icspMainCenters[index], headerChipPin[canonical] ?? null, railSummary[canonical], icspMainCad[index]),
    makePin(`ICSP_USB_${number}`, `USB ICSP ${number} · ${signal}`, bridgeCanonical, 'USB 旁 · ATmega16U2 ICSP',
      icspUsbCenters[index], null, signal === '5V' || signal === 'GND'
        ? 'USB 接口芯片 ICSP 接口的电源或地触点，与板上同名电源网络相连。'
        : `ATmega16U2 USB 转串口芯片的 ${signal} 编程信号。该触点属于 USB 接口芯片。`, icspUsbCad[index])
  ];
});

const blocks = [
  { id: 'avr', title: 'AVR 8 位内核', label: 'AVR CPU', color: '#4a8297',
    detail: '内核执行程序、处理运算与中断。UNO R3 的主芯片在板上以 16 MHz 运行。' },
  { id: 'flash', title: 'Flash 程序存储器', label: 'FLASH', color: '#397f70',
    detail: '32 KB Flash 保存程序，掉电后仍保留。Arduino 引导程序也存储在这里。' },
  { id: 'sram', title: 'SRAM 工作内存', label: 'SRAM', color: '#427866',
    detail: '2 KB SRAM 用于运行时变量、堆栈和缓冲区，掉电后内容丢失。' },
  { id: 'eeprom', title: 'EEPROM 非易失存储', label: 'EEPROM', color: '#67568c',
    detail: '1 KB EEPROM 可保存校准值或少量设置，关机后仍能读回。' },
  { id: 'clock', title: '时钟、复位与看门狗', label: 'CLK / RESET', color: '#5e756b',
    detail: '时钟给内核和外设提供节拍。复位脚可重新启动芯片，看门狗超时也可触发复位。', pins: [1,9,10] },
  { id: 'gpio', title: 'GPIO 与中断', label: 'GPIO / INT', color: '#3a7c5d',
    detail: 'Port B、C、D 可读写数字电平。支持中断的输入可在信号变化时通知内核。', pins: [4,5,19] },
  { id: 'adc', title: '10 位 ADC 与比较器', label: 'ADC', color: '#9a683c',
    detail: '该 DIP 封装提供 6 路外部 ADC 输入。ADC 可把参考范围内的电压量化为 0 到 1023。', pins: [21,23,24,27] },
  { id: 'timer', title: '定时器与 PWM', label: 'TIMER / PWM', color: '#487b97',
    detail: '两个 8 位和一个 16 位定时器负责计时和比较。UNO R3 有 6 个支持 PWM 的数字引脚。', pins: [5,11,15,17] },
  { id: 'serial', title: 'USART、SPI 与 TWI', label: 'USART / SPI / TWI', color: '#7d5481',
    detail: 'USART 用于串口，SPI 用于同步串行通信，TWI 与 I²C 兼容。不同接口共用部分普通引脚。', pins: [2,3,17,18,19,27,28] }
];

export const UNO_R3_INSPECTION = {
  id: 'uno-r3',
  title: 'Arduino UNO R3',
  subtitle: '从 UNO R3 的板上插孔，找到 ATmega328P 封装上对应的引脚。',
  orientation: 'USB-B 接口朝上。左侧是电源和模拟插孔，右侧是数字插孔。',
  modelCredit: {
    name: 'Arduino A000066 Rev3e CAD',
    source: 'https://docs.arduino.cc/hardware/uno-rev3/#downloadable-resources',
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    file: './models/uno-r3-detail.glb'
  },
  defaultPin: 'D13',
  quickPins: ['D13', 'A0', 'SDA'],
  photo: {
    url: new URL('./assets/uno-r3-makemagazinde.jpg', import.meta.url),
    width: photoWidth,
    height: photoHeight,
    alt: 'Arduino UNO R3 实物正面，USB-B 接口朝上，主控为可插拔的双列直插 ATmega328P 芯片。',
    credit: 'MakeMagazinDE / Wikimedia Commons',
    source: 'https://commons.wikimedia.org/wiki/File:Arduino_uno_r3.jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    licenseLabel: 'CC BY-SA 4.0',
    note: '在原实拍照片基础上裁切、缩放并顺时针旋转 90°，标记为独立叠层。',
    chip: { x: 259 / photoWidth, y: 858 / photoHeight, w: 151 / photoWidth, h: 545 / photoHeight }
  },
  pins: [...outerPins, ...programmingPins],
  chip: {
    title: 'ATmega328P',
    packageName: 'PDIP-28',
    bodyLabel: 'ATMEGA328P',
    pinPitch: '2.54 mm',
    bodyLabelSize: '约 35 × 7 mm',
    style: 'dip',
    pins: chipPins,
    blocks,
    references: [
      { url: chipDatasheet, label: 'Microchip ATmega328P 数据手册' },
      { url: boardPinout, label: 'Arduino UNO R3 官方引脚表' },
      { url: boardSchematic, label: 'Arduino UNO R3 官方原理图' }
    ],
    hints: {
      package: 'UNO R3 的主控是可插拔的 ATmega328P。封装缺口用来判断方向，USB 旁较小的 ATmega16U2 负责 USB 转串口。',
      pins: '将封装缺口朝上，从左上角的第 1 脚沿左侧向下数到 14，再沿右侧向上数到 28。',
      functions: '功能方块依据 Microchip 的器件框图整理，位置和比例为教学示意。'
    }
  }
};
