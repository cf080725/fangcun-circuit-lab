import { CHIP_PINS, CHIP_FUNCTIONS, CHIP_REFERENCE } from './blue-pill-chip-data.js';

// ST DS5319 Rev 20, Figure 6. Each line is a side in counterclockwise order.
const names = [
  'VBAT PC13 PC14 PC15 PD0 PD1 NRST PC0 PC1 PC2 PC3 VSSA VDDA PA0 PA1 PA2',
  'PA3 VSS_4 VDD_4 PA4 PA5 PA6 PA7 PC4 PC5 PB0 PB1 PB2 PB10 PB11 VSS_1 VDD_1',
  'PB12 PB13 PB14 PB15 PC6 PC7 PC8 PC9 PA8 PA9 PA10 PA11 PA12 PA13 VSS_2 VDD_2',
  'PA14 PA15 PC10 PC11 PC12 PD2 PB3 PB4 PB5 PB6 PB7 BOOT0 PB8 PB9 VSS_3 VDD_3'
].join(' ').split(' ');

const shared = new Map(CHIP_PINS.map(pin => [pin.signal, pin.summary]));
const extra = {
  PC13: '也可作 RTC 防拆输入。NUCLEO-F103RB 的蓝色 B1 松开为高电平，按下拉低这个引脚。',
  PA5: '普通 I/O，也可作 SPI1_SCK 或 ADC1/2 通道 5。在这块板上连接 D13 和绿色 LD2，高电平点亮。',
  NRST: '拉低时复位目标 MCU。板上黑色 B2 和排针上的 RESET 都连接到这里。',
  PD2: '普通 I/O，也可作 TIM3 的外部触发输入 TIM3_ETR。',
  PC10: '普通 I/O，也可重映射为 USART3_TX。',
  PC11: '普通 I/O，也可重映射为 USART3_RX。',
  PC12: '普通 I/O，也可重映射为 USART3_CK。'
};
for (let index = 0; index <= 5; index++) {
  extra[`PC${index}`] = `普通 I/O，也可接 ADC1/2 的通道 ${10 + index}。`;
}
for (let index = 6; index <= 9; index++) {
  extra[`PC${index}`] = `普通 I/O，也可重映射为 TIM3_CH${index - 5}。`;
}

export const NUCLEO_CHIP_PINS = names.map((signal, index) => ({
  number: index + 1,
  signal,
  summary: extra[signal] ?? shared.get(signal) ?? (signal.startsWith('VDD') ? '数字电源引脚，连接 VDD 电源网。'
    : signal.startsWith('VSS') ? '数字地引脚，连接 VSS 地网。' : '普通 I/O，复用功能见 ST 数据手册的引脚定义表。')
}));
const bySignal = new Map(NUCLEO_CHIP_PINS.map(({ number, signal }) => [signal, number]));
export const nucleoChipPin = signal => bySignal.get(signal) ?? null;

const blockPins = {
  clock: ['PD0','PD1','NRST'], gpio: ['PC13','PA5','PC7'], adc: ['PA0','PA5','PC0'],
  timer: ['PA0','PA8','PB4'], comm: ['PA2','PA3','PB8','PB9']
};

export const NUCLEO_CHIP_INSPECTION = {
  title: 'STM32F103RBT6', packageName: 'LQFP64', bodyLabelSize: '10 × 10 mm', pinPitch: '0.50 mm',
  bodyLabel: 'STM32F103\nRBT6\nLQFP64', style: 'lqfp', pins: NUCLEO_CHIP_PINS,
  blocks: CHIP_FUNCTIONS.map(block => ({
    ...block,
    detail: block.id === 'flash' ? 'STM32F103RB 提供 128 KB Flash，断电后仍保存程序和常量。' : block.detail,
    pins: blockPins[block.id]?.map(nucleoChipPin)
  })),
  references: [
    { url:'https://www.st.com/resource/en/datasheet/stm32f103rb.pdf#page=24', label:'DS5319 · LQFP64 引脚图' },
    { url:CHIP_REFERENCE, label:'RM0008 参考手册' }
  ],
  hints: {
    package: '塑封本体四周各有 16 根鸥翼脚。左上方圆点标记 1 脚。点击封装或金属脚进入引脚层。',
    pins: '从定位点旁的第 1 脚开始逆时针数。点击引脚或选择编号，可查信号和板上用途。',
    functions: '依据 ST 器件框图整理。点击功能块查看用途及关联引脚。方块位置和比例仅用于讲解。'
  }
};
