import { BOARD_PROFILES } from './board-profiles.js';
import { PICO_PHOTO, PICO_EDGE_POINTS, PICO_SWD_POINTS } from './pico-photo-inspection.js';
import { RP2040_CHIP_INSPECTION, rp2040PadForSignal } from './rp2040-chip-inspection.js';

const boardPinout = 'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#non-wireless-board-layout';
const pico = BOARD_PROFILES.pico;
const notes = {
  GP0: '通用输入输出，也可配置为 UART0 的发送端。在实验台的 Pico 原生固件中可观察 UART0。',
  GP1: '通用输入输出，也可配置为 UART0 的接收端。',
  GP14: '通用输入输出。Pico 的原生按键样例从这根脚读入外接按键。',
  GP15: '通用输入输出，可用 PWM 控制外接灯的亮度。Pico 的调光样例使用这根脚。',
  GP26: '通用输入输出，也可接 ADC0。Pico 原生电位器样例从这里采样。',
  GP27: '通用输入输出，也可接 ADC1。',
  GP28: '通用输入输出，也可接 ADC2。',
  VBUS: 'USB 接口的 5 V 电源线，经板上的二极管接到 VSYS。',
  VSYS: '开发板系统电源输入，向板上稳压器供电。',
  '3V3_EN': '板上 3.3 V 稳压器的使能脚，拉低可关闭该稳压器。',
  '3V3': '板上稳压器的 3.3 V 输出，为芯片的多个供电端提供电源。',
  ADC_VREF: '板上 ADC 的参考电压节点。经典 Pico 从 3.3 V 电源经滤波给参考网络供电。',
  AGND: '模拟地。接电位器等模拟信号时，可用它作为参考地。',
  RUN: '芯片运行控制端。拉低会让 RP2040 保持在复位状态。'
};
const groundNote = '这是一个独立的物理焊孔，与板上其余 GND 共用参考电位。';
const gpioNote = '可作数字输入或输出。打开芯片焊盘层查看其复用功能。';
const debug = [
  { id:'SWD_CLK', label:'SWCLK', canonical:'SWCLK', summary:'板尾调试时钟线，由外部 SWD 调试器提供时钟。' },
  { id:'SWD_GND', label:'SWD GND', canonical:'GND', summary:'板尾调试接口的地，给外部调试器提供电平参考。' },
  { id:'SWD_IO', label:'SWDIO', canonical:'SWDIO', summary:'板尾双向调试数据线，连接 RP2040 的专用调试焊盘。' }
];
const pins = [
  ...pico.pins.filter(pin => pin.side === 'left'),
  ...pico.pins.filter(pin => pin.side === 'right').reverse()
].map((pin, index) => {
  const number = index + 1;
  return {
    id:pin.id, label:`${pin.label} · ${number} 脚`, silk:pin.label, side:pin.side,
    canonical:pin.canonical, number, group:number<=20?'左排 · 第 1–20 脚':'右排 · 第 21–40 脚',
    chipPin:rp2040PadForSignal(pin.id==='ADC_VREF'?pin.id:pin.canonical),
    summary:notes[pin.id] ?? (pin.canonical==='GND'?groundNote:gpioNote),
    ...PICO_EDGE_POINTS[index]
  };
});

export const PICO_INSPECTION = {
  id:'pico',
  title:'Raspberry Pi Pico',
  subtitle:'在实拍照片和 3D 模型上找同一个焊孔，再追到 RP2040 的封装焊盘。',
  orientation:'Micro‑USB 朝上，左排从上往下数 1–20，右排从下往上数 21–40。板尾三孔为 SWD。',
  defaultPin:'GP0',
  quickPins:['GP0','GP26','SWD_IO'],
  photo:PICO_PHOTO,
  source:{url:boardPinout,label:'Raspberry Pi 官方板卡引脚表'},
  modelCredit:{
    source:'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#resources-for-non-wireless-raspberry-pi-pico-boards',
    name:'Raspberry Pi Pico 官方设计资料',
    file:'./models/pico-rp2040-detail.glb'
  },
  pins:[...pins,...debug.map(pin => ({
    ...pin, side:'swd', group:'板尾 · SWD 调试', chipPin:rp2040PadForSignal(pin.canonical), ...PICO_SWD_POINTS[pin.id]
  }))],
  chip:RP2040_CHIP_INSPECTION
};
