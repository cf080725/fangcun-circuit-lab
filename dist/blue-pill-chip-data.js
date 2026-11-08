export const CHIP_DATASHEET = 'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf';
export const CHIP_REFERENCE = 'https://www.st.com/resource/en/reference_manual/cd00171190-stm32f101-103-105-107-stm32f100-series-armbased-32bit-mcus-stmicroelectronics.pdf';

// DS5319, Figure 8 and Table 5. Each line is one side, in package pin order.
const pinNames = [
  'VBAT PC13 PC14 PC15 PD0 PD1 NRST VSSA VDDA PA0 PA1 PA2',
  'PA3 PA4 PA5 PA6 PA7 PB0 PB1 PB2 PB10 PB11 VSS_1 VDD_1',
  'PB12 PB13 PB14 PB15 PA8 PA9 PA10 PA11 PA12 PA13 VSS_2 VDD_2',
  'PA14 PA15 PB3 PB4 PB5 PB6 PB7 BOOT0 PB8 PB9 VSS_3 VDD_3'
].join(' ').split(' ');

const signals = {
  VBAT: '后备域供电，为 RTC 和备份寄存器在主电源断开时供电。',
  PC13: '普通 I/O，也可作 RTC 防拆输入。在这块 Blue Pill 的参考接法中，它驱动板载 LED，低电平点亮。',
  PC14: '普通 I/O 或 32.768 kHz 低速外部晶振输入 OSC32_IN。',
  PC15: '普通 I/O 或 32.768 kHz 低速外部晶振输出 OSC32_OUT。',
  PD0: '高速外部时钟输入 OSC_IN，可按配置重映射为 PD0。',
  PD1: '高速外部时钟输出 OSC_OUT，可按配置重映射为 PD1。',
  NRST: '复位引脚，拉低时复位 MCU。',
  VSSA: '模拟地，为 ADC 等模拟电路提供参考。',
  VDDA: '模拟供电，为 ADC 等模拟电路提供电源。',
  PA0: '普通 I/O，也可用作唤醒输入、ADC1/2 通道 0 或 TIM2_CH1 等。',
  PA1: '普通 I/O，也可用作 ADC1/2 通道 1、TIM2_CH2 或 USART2_RTS。',
  PA2: '普通 I/O，也可用作 USART2_TX、ADC1/2 通道 2 或 TIM2_CH3。',
  PA3: '普通 I/O，也可用作 USART2_RX、ADC1/2 通道 3 或 TIM2_CH4。',
  PA4: '普通 I/O，也可用作 SPI1_NSS 或 ADC1/2 通道 4。',
  PA5: '普通 I/O，也可用作 SPI1_SCK 或 ADC1/2 通道 5。',
  PA6: '普通 I/O，也可用作 SPI1_MISO、ADC1/2 通道 6 或 TIM3_CH1。',
  PA7: '普通 I/O，也可用作 SPI1_MOSI、ADC1/2 通道 7 或 TIM3_CH2。',
  PB0: '普通 I/O，也可用作 ADC1/2 通道 8 或 TIM3_CH3。',
  PB1: '普通 I/O，也可用作 ADC1/2 通道 9 或 TIM3_CH4。',
  PB2: '普通 I/O，复位期间与 BOOT0 共同决定启动来源（BOOT1）。',
  PB10: '普通 I/O，也可用作 I²C2_SCL 或 USART3_TX。',
  PB11: '普通 I/O，也可用作 I²C2_SDA 或 USART3_RX。',
  PB12: '普通 I/O，也可用作 SPI2_NSS 或 TIM1_BKIN。',
  PB13: '普通 I/O，也可用作 SPI2_SCK 或 TIM1_CH1N。',
  PB14: '普通 I/O，也可用作 SPI2_MISO 或 TIM1_CH2N。',
  PB15: '普通 I/O，也可用作 SPI2_MOSI 或 TIM1_CH3N。',
  PA8: '普通 I/O，也可用作时钟输出 MCO 或 TIM1_CH1。',
  PA9: '普通 I/O，也可用作 USART1_TX 或 TIM1_CH2。',
  PA10: '普通 I/O，也可用作 USART1_RX 或 TIM1_CH3。',
  PA11: '普通 I/O，也可用作 USB D−、CAN_RX 或 TIM1_CH4。',
  PA12: '普通 I/O，也可用作 USB D+、CAN_TX 或 TIM1_ETR。',
  PA13: '复位后默认为 JTMS/SWDIO，可按调试端口配置用作普通 I/O。',
  PA14: '复位后默认为 JTCK/SWCLK，可按调试端口配置用作普通 I/O。',
  PA15: '复位后默认为 JTDI，可按调试端口配置用作普通 I/O。',
  PB3: '复位后默认为 JTDO，可按调试端口配置用作普通 I/O。',
  PB4: '复位后默认为 NJTRST，可按调试端口配置用作普通 I/O。',
  PB5: '普通 I/O，也可作 SPI1 重映射后的 MOSI。',
  PB6: '普通 I/O，也可用作 I²C1_SCL 或 TIM4_CH1。',
  PB7: '普通 I/O，也可用作 I²C1_SDA 或 TIM4_CH2。',
  BOOT0: '复位时采样，用于选择从用户 Flash、系统存储器或 SRAM 启动。',
  PB8: '普通 I/O，也可用作 TIM4_CH3 或 I²C1 重映射后的 SCL。',
  PB9: '普通 I/O，也可用作 TIM4_CH4 或 I²C1 重映射后的 SDA。'
};

export const CHIP_PINS = pinNames.map((signal, index) => ({
  number: index + 1,
  signal,
  summary: signals[signal] ?? (signal.startsWith('VDD') ? '数字电源引脚，连接芯片的 VDD 电源网。' : '数字地引脚，连接芯片的 VSS 地网。')
}));

const pinBySignal = new Map(CHIP_PINS.map(pin => [pin.signal, pin.number]));
const aliases = new Map([['SWDIO', 34], ['SWCLK', 37], ['OSC_IN', 5], ['OSC_OUT', 6]]);

// A board power rail can feed several package leads, so it has no unique match.
export function chipPinForSignal(signal) {
  const key = String(signal ?? '').trim().toUpperCase().replace(/^MCU:/, '');
  return pinBySignal.get(key) ?? aliases.get(key) ?? null;
}

export function chipPinLayout(number) {
  if (!Number.isInteger(number) || number < 1 || number > 48) return null;
  const side = Math.floor((number - 1) / 12);
  const offset = ((number - 1) % 12 - 5.5) * .5;
  return [
    { side: 'left', x: 0, z: offset, angle: Math.PI, labelX: -4.98, labelZ: offset },
    { side: 'bottom', x: offset, z: 0, angle: -Math.PI / 2, labelX: offset, labelZ: 4.98 },
    { side: 'right', x: 0, z: -offset, angle: 0, labelX: 4.98, labelZ: -offset },
    { side: 'top', x: -offset, z: 0, angle: Math.PI / 2, labelX: -offset, labelZ: -4.98 }
  ][side];
}

export const CHIP_FUNCTIONS = [
  { id: 'core', title: 'Cortex-M3 内核', label: 'CORTEX-M3', color: '#4a8297', x: -1.66, z: -1.80, w: 2.58, d: 1.66,
    detail: '以最高 72 MHz 执行指令，响应中断，并通过总线访问程序、变量和外设寄存器。' },
  { id: 'flash', title: 'Flash 程序存储器', label: 'FLASH', color: '#397f70', x: .57, z: -1.80, w: 1.62, d: 1.66,
    detail: 'STM32F103C8 的 Flash 容量为 64 KB。断电后仍保存程序和常量。' },
  { id: 'sram', title: 'SRAM 工作内存', label: 'SRAM', color: '#427866', x: 2.25, z: -1.80, w: 1.47, d: 1.66,
    detail: '20 KB SRAM 用于运行时变量、栈和缓冲区，掉电后内容丢失。' },
  { id: 'bus', title: '总线与 DMA', label: 'AHB / APB', color: '#67568c', x: 0, z: -.35, w: 5.92, d: .87,
    detail: 'AHB 将内核、存储器与 DMA 等单元连接起来。两条 APB 总线服务外设。DMA 可搬运数据，减少内核逐字节处理的负担。' },
  { id: 'clock', title: '时钟与复位', label: 'RCC', color: '#5e756b', x: -1.98, z: .74, w: 1.88, d: .93,
    detail: 'RCC 选择和分配时钟源，为各外设打开时钟。NRST 引脚可触发复位。', pins: [5, 6, 7] },
  { id: 'gpio', title: 'GPIO 与外部中断', label: 'GPIO / EXTI', color: '#3a7c5d', x: 0, z: .74, w: 1.86, d: .93,
    detail: 'GPIO 能读取或输出数字电平，也可切换到外设复用功能。EXTI 可根据所选引脚的边沿触发事件或中断。', pins: [10, 30, 31] },
  { id: 'adc', title: 'ADC 模数转换', label: 'ADC 1 / 2', color: '#9a683c', x: 1.99, z: .74, w: 1.89, d: .93,
    detail: '两个 12 位 ADC 把模拟输入转换为数字读数。例如可从 PA0 读取 ADC1 或 ADC2 的通道 0。', pins: [10, 11, 12] },
  { id: 'timer', title: '定时器与 PWM', label: 'TIM / PWM', color: '#487b97', x: -1.76, z: 2.02, w: 2.34, d: 1.25,
    detail: '定时器可按节拍计数、测量外部信号，或在支持复用的引脚输出 PWM。例如 TIM2_CH1 可输出到 PA0。', pins: [10, 29, 42] },
  { id: 'comm', title: '通信外设', label: 'USART / SPI / I²C', color: '#7d5481', x: 1.23, z: 2.02, w: 3.40, d: 1.25,
    detail: 'USART、SPI 和 I²C 用于不同的通信场景。芯片还提供 USB 全速设备和 CAN，PA11/PA12 可承担相应复用功能。', pins: [30, 31, 32, 33] }
];
