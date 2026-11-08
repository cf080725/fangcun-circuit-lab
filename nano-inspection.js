import { BOARD_PROFILES } from './board-profiles.js';
import { NANO_PHOTO, NANO_EDGE_POINTS, NANO_ICSP_POINTS } from './nano-photo-inspection.js';
import { ATMEGA328P_TQFP_INSPECTION, NANO_PINOUT, atmega328pTqfpPinForHeader } from './atmega328p-tqfp-inspection.js';

const railNotes = {
  GND:'独立的物理针位，与另一侧 GND、ICSP 的 GND 和主芯片第 3、5、21 脚共用板上的地。',
  '5V':'板上的 5 V 电源网络，给主芯片第 4、6 脚和板上其他电路供电。',
  '3V3':'板背面 FT232RL 提供的 3.3 V 输出。Nano 主控的数字逻辑电平仍为 5 V。',
  VIN:'板上稳压器的电源输入，用来接外部电源。板上的 5 V 针位属于稳压后的电源网络。'
};

const chip = ATMEGA328P_TQFP_INSPECTION;
function makePin(pin, label, group, point) {
  const chipPin = atmega328pTqfpPinForHeader(pin.canonical);
  const summary = chipPin ? chip.pins[chipPin - 1].summary : railNotes[pin.canonical];
  return { ...pin, label, group, chipPin, summary, ...point };
}

const edgePins = BOARD_PROFILES.nano.pins.map(({ id, label, side, canonical }) =>
  makePin({id, side, canonical}, ['GND','RESET'].includes(canonical) ? `${label} · ${id.slice(-1)}` : label,
    side === 'left' ? 'USB 朝上 · 左排' : 'USB 朝上 · 右排', NANO_EDGE_POINTS[id]));

const icspSignals = [
  ['MISO', 'D12'], ['5V', '5V'], ['SCK', 'D13'],
  ['MOSI', 'D11'], ['RESET', 'RESET'], ['GND', 'GND']
];
const icspPins = icspSignals.map(([signal, canonical], index) => {
  const id = `ICSP_${index + 1}`;
  return makePin({id, canonical, side:'icsp'}, `ICSP ${index + 1} · ${signal}`,
    '板尾 · ICSP 编程', NANO_ICSP_POINTS[id]);
});

export const NANO_INSPECTION = {
  id:'nano',
  title:'Arduino Nano V3.0',
  subtitle:'从原板实拍找到两侧排针和板尾 ICSP，再追到 ATmega328P 的封装引脚。',
  orientation:'Mini-B 接口朝上。左排从 D13 到 VIN，右排从 D12 到 D1/TX。板尾 ICSP 的 1 脚在左下。',
  defaultPin:'D13',
  quickPins:['D13','A6','ICSP_1'],
  photo:NANO_PHOTO,
  source:{ url:NANO_PINOUT, label:'Arduino Nano 官方引脚表' },
  modelCredit:{
    name:'Arduino A000005 Nano V3.3 官方 CAD',
    source:'https://docs.arduino.cc/static/e3c4fe1f9bee7ec63df398422b3257f4/A000005-cad-files.zip',
    note:'CAD 提供共用孔位与背面布局参考。正面依据上方 Gravitech V3.0 实拍。',
    license:'https://creativecommons.org/licenses/by-sa/4.0/',
    file:'./models/arduino-nano-detail.glb'
  },
  pins:[...edgePins,...icspPins],
  chip
};
