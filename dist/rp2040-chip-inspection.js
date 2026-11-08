import { RP2040_GROUND_PAD } from './chip-inspection-layout.js';
export { RP2040_GROUND_PAD };

const datasheet = 'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf';
const picoDatasheet = 'https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf';

// RP2040 datasheet Figure 3, four edges in top-view numbering order.
const padSignals = [
  'IOVDD', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5', 'GPIO6', 'GPIO7', 'IOVDD', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO11',
  'GPIO12', 'GPIO13', 'GPIO14', 'GPIO15', 'TESTEN', 'XIN', 'XOUT', 'IOVDD', 'DVDD', 'SWCLK', 'SWDIO', 'RUN', 'GPIO16', 'GPIO17',
  'GPIO18', 'GPIO19', 'GPIO20', 'GPIO21', 'IOVDD', 'GPIO22', 'GPIO23', 'GPIO24', 'GPIO25', 'GPIO26/ADC0', 'GPIO27/ADC1', 'GPIO28/ADC2', 'GPIO29/ADC3', 'IOVDD',
  'ADC_AVDD', 'VREG_VIN', 'VREG_VOUT', 'USB_DM', 'USB_DP', 'USB_VDD', 'IOVDD', 'DVDD', 'QSPI_SD3', 'QSPI_SCLK', 'QSPI_SD0', 'QSPI_SD2', 'QSPI_SD1', 'QSPI_SS_N'
];

const descriptions = {
  IOVDD: '数字 GPIO 的电源，芯片规定的标称范围为 1.8–3.3 V。Pico 上使用 3.3 V。',
  DVDD: '数字内核的 1.1 V 电源输入。板上可从 VREG_VOUT 为它供电。',
  TESTEN: '芯片工厂测试端，正常使用时接地。',
  XIN: '外部晶体振荡器输入。Pico 使用 12 MHz 晶体。',
  XOUT: '晶体振荡器输出，与 XIN 连接同一颗外部晶体。',
  SWCLK: 'SWD 调试时钟。Pico 底边的 SWCLK 调试焊盘接到这里。',
  SWDIO: 'SWD 双向调试数据。Pico 底边的 SWDIO 调试焊盘接到这里。',
  RUN: '全芯片异步复位输入。拉低时保持复位，拉高后运行。',
  ADC_AVDD: 'ADC 的模拟电源输入，标称 3.3 V。经典 Pico 的 ADC_VREF 引脚接到同一滤波后的参考网络。',
  VREG_VIN: '芯片内置内核稳压器的输入，标称 1.8–3.3 V。',
  VREG_VOUT: '芯片内置内核稳压器的 1.1 V 输出，可供给 DVDD。',
  USB_DM: 'USB 差分负线 D−。经典 Pico 上经 27 Ω 串联电阻接 Micro USB。',
  USB_DP: 'USB 差分正线 D+。经典 Pico 上经 27 Ω 串联电阻接 Micro USB。',
  USB_VDD: '内置 USB 物理层的电源输入，标称 3.3 V。',
  QSPI_SS_N: '外置 QSPI Flash 的低有效片选。经典 Pico 的 BOOTSEL 按钮会在启动时影响这条信号。',
  QSPI_SCLK: '外置 QSPI Flash 的串行时钟。'
};

const picoUses = {
  23: '经典 Pico 用 GP23 控制板上电源的省电模式。',
  24: '经典 Pico 用 GP24 检测 USB VBUS。',
  25: '经典 Pico 的板载 LED 由 GP25 高电平点亮。',
  29: '经典 Pico 将 VSYS 分压送到这个模拟输入。'
};

function describe(signal) {
  if (descriptions[signal]) return descriptions[signal];
  if (signal.startsWith('QSPI_SD')) return '外置 QSPI Flash 的双向数据线，供芯片读取程序和数据。';
  const [, gpioNumber, adc] = /^GPIO(\d+)(?:\/ADC(\d+))?$/.exec(signal);
  const gpio = Number(gpioNumber), position = gpio % 4;
  // The four-pin role pattern repeats across the GPIO bank (datasheet Table 2).
  const spi = `SPI${Math.floor(gpio / 8) % 2} ${['RX','CSn','SCK','TX'][position]}`;
  const uart = `UART${[0,1,1,0,0,1,1,0][Math.floor(gpio / 4)]} ${['TX','RX','CTS','RTS'][position]}`;
  const i2c = `I²C${Math.floor(position / 2)} ${gpio % 2 ? 'SCL' : 'SDA'}`;
  const pwm = `PWM${Math.floor(gpio / 2) % 8} ${gpio % 2 ? 'B' : 'A'}`;
  const analog = adc === undefined ? '' : `也可作为 12 位 ADC 的通道 ${adc}。`;
  return `通用数字输入输出。可复用为 ${spi}、${uart}、${i2c}、${pwm} 或 PIO。${analog}${picoUses[gpio] ?? ''}`;
}

const pins = padSignals.map((signal, index) => ({ number: index + 1, signal, summary: describe(signal) }));
// Figure 3 calls the center GND. Table 621 assigns it number 57.
pins.push({ number: RP2040_GROUND_PAD, label: 'ePad（57）', signal: 'GND', summary: '底面中央裸露的接地焊盘，标称 3.1 × 3.1 mm。这是芯片的外部接地连接。数据手册表 621 将它列为 57。' });

const pinBySignal = new Map();
for (const {number, signal} of pins) {
  const name = signal.split('/')[0];
  pinBySignal.set(name, pinBySignal.has(name) ? null : number);
}
const aliases = {
  SWD_CLK: 'SWCLK', SWD_IO: 'SWDIO', 'D+': 'USB_DP', 'D-': 'USB_DM', 'D−': 'USB_DM',
  A0: 'GPIO26', A1: 'GPIO27', A2: 'GPIO28', ADC_VREF: 'ADC_AVDD'
};

export function rp2040PadForSignal(signal) {
  const name = String(signal ?? '').trim().toUpperCase().replace(/^MCU:/, '');
  if (/^(?:AGND|GND\d*|SWD_GND)$/.test(name)) return RP2040_GROUND_PAD;
  return pinBySignal.get(aliases[name] ?? name.split('/')[0].replace(/^GP(\d+)$/, 'GPIO$1')) ?? null;
}

const blocks = [
  { id: 'core0', label: 'Core 0', title: 'Cortex-M0+ 核心 0', color: '#366881', detail: '两个 Cortex-M0+ 处理器通过总线访问同一地址空间。上电后，核心 0 从片内 ROM 启动，再把控制权交给应用。', pins: [24,25,26] },
  { id: 'core1', label: 'Core 1', title: 'Cortex-M0+ 核心 1', color: '#366881', detail: '核心 1 可以并行执行任务，和核心 0 共享 SRAM 与外设。两个核心可用片内 FIFO 和自旋锁协调。', pins: [24,25] },
  { id: 'sram', label: 'SRAM', title: '264 KiB 片内 SRAM', color: '#546887', detail: '四个 64 KiB 和两个 4 KiB 存储体可以保存代码或数据。不同总线主设备可以并行访问不同存储体。' },
  { id: 'xip', label: 'QSPI / XIP', title: '外置 Flash 与 XIP', color: '#6b567b', detail: '启动 ROM 可从外置 Flash 启动。XIP 接口把 Flash 映射到内存地址，处理器可从中读取数据并执行代码。经典 Pico 的 2 MiB Flash 位于板上另一颗芯片。', pins: [56,52,53,55,54,51] },
  { id: 'pio', label: 'PIO', title: '可编程输入输出 PIO', color: '#296d5d', detail: 'PIO0 与 PIO1 各有 4 个状态机，可以自行生成可预测的 GPIO 时序，适用于自定义串行接口。', pins: [2,3,17,18] },
  { id: 'pwm', label: 'PWM', title: 'PWM 与定时', color: '#406e65', detail: '8 个 PWM 单元各有 A/B 两路输出。占空比决定一个周期内输出为高的比例，可用于调光。GPIO25 可接 PWM4 B。', pins: [2,3,37] },
  { id: 'adc', label: 'ADC', title: '12 位模数转换器', color: '#86622f', detail: 'ADC 最高 500 kS/s，可从 GPIO26–29 的四个外部通道或片内温度传感器选一路转换。经典 Pico 两侧排针引出 GPIO26–28。', pins: [38,39,40,41,43] },
  { id: 'usb', label: 'USB', title: 'USB 1.1 控制器与物理层', color: '#306b7b', detail: '同一组 D−、D+ 可用于全速设备，或全速及低速主机。片内启动 ROM 也能通过 USB 接收 UF2。', pins: [46,47,48] },
  { id: 'bus', label: 'AHB / DMA', title: '总线、DMA 与串行外设', color: '#58685c', detail: 'AHB-Lite 交叉开关连接双核心、DMA、存储和外设。DMA 可代替处理器搬运数据。芯片还提供两组 UART、SPI 和 I²C。', pins: [2,3,4,5] }
];

export const RP2040_CHIP_INSPECTION = {
  title: 'RP2040', packageName: 'QFN-56', bodyLabel: 'RP2040', bodyLabelSize: '7 × 7 mm', pinPitch: '0.40 mm', style: 'qfn',
  pins, blocks,
  references: [{url: datasheet, label: 'RP2040 数据手册 §1.4 / §5.1'}, {url: picoDatasheet, label: '经典 Pico 原理图与板级资料'}],
  hints: {
    package: '观察 7 × 7 mm 塑封本体和 1 号定位标记。QFN 焊盘位于底面边缘，点「翻看底面」可直接看到焊盘。',
    pins: '顶视图从定位点旁的 1 号开始，沿左、下、右、上四边编号。底视图镜像排列。中央 ePad（57）单独接地。',
    functions: '方块展示双核心、存储、总线和外设的关系。位置与比例是教学示意。'
  }
};
