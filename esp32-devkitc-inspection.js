const devkitGuide = 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html';
const moduleDatasheet = 'https://documentation.espressif.com/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.html';
const socDatasheet = 'https://documentation.espressif.com/esp32_datasheet_en.html';

// WROOM-32E datasheet, Figure 3 and Table 3. Number 39 is the underside pad.
const modulePads = [
  ['GND', '模块地，和其他接地焊盘相连。'],
  ['3V3', '模块的 3.3 V 电源输入。'],
  ['EN', '模块使能。保持高电平运行，拉低时关断。'],
  ['SENSOR_VP', 'GPIO36，仅输入，可作 ADC1 通道 0。'],
  ['SENSOR_VN', 'GPIO39，仅输入，可作 ADC1 通道 3。'],
  ['IO34', 'GPIO34，仅输入，可作 ADC1 通道 6。'],
  ['IO35', 'GPIO35，仅输入，可作 ADC1 通道 7。'],
  ['IO32', 'GPIO32，可作 ADC1 通道 4 或 TOUCH9。'],
  ['IO33', 'GPIO33，可作 ADC1 通道 5 或 TOUCH8。'],
  ['IO25', 'GPIO25，可作 ADC2 通道 8 或 DAC1。'],
  ['IO26', 'GPIO26，可作 ADC2 通道 9 或 DAC2。'],
  ['IO27', 'GPIO27，可作 ADC2 通道 7 或 TOUCH7。'],
  ['IO14', 'GPIO14，可作 ADC2 通道 6、TOUCH6 或 SPI 时钟。'],
  ['IO12', 'GPIO12，可作 ADC2 通道 5。复位时它参与启动绑带配置。'],
  ['GND', '模块地，和其他接地焊盘相连。'],
  ['IO13', 'GPIO13，可作 ADC2 通道 4 或 TOUCH4。'],
  ...Array.from({ length: 6 }, () => ['NC', 'WROOM-32E 未将 GPIO6–GPIO11 引到这些焊盘。这组信号用于模块内部的 SPI Flash。']),
  ['IO15', 'GPIO15，可作 ADC2 通道 3 或 TOUCH3，也是启动绑带脚。'],
  ['IO2', 'GPIO2，可作 ADC2 通道 2 或 TOUCH2，复位时参与启动配置。'],
  ['IO0', 'GPIO0，可作 ADC2 通道 1。复位时采样，决定是否进入串口下载模式。'],
  ['IO4', 'GPIO4，可作 ADC2 通道 0 或 TOUCH0。'],
  ['IO16', 'GPIO16，可用作 UART2 接收。某些带封装内 PSRAM 的模块版本会占用它。'],
  ['IO17', 'GPIO17，可用作 UART2 发送。'],
  ['IO5', 'GPIO5，可用作 SPI 片选，也是启动绑带脚。'],
  ['IO18', 'GPIO18，可用作 SPI 时钟。'],
  ['IO19', 'GPIO19，可用作 SPI 数据输入。'],
  ['NC', '模块未连接此焊盘。'],
  ['IO21', 'GPIO21，常用作 I²C SDA，实际外设映射可通过 GPIO 矩阵配置。'],
  ['RXD0', 'GPIO3，UART0 接收脚，在板上与 USB 转串口桥相连。'],
  ['TXD0', 'GPIO1，UART0 发送脚，在板上与 USB 转串口桥相连。'],
  ['IO22', 'GPIO22，常用作 I²C SCL，实际外设映射可通过 GPIO 矩阵配置。'],
  ['IO23', 'GPIO23，可用作 SPI 数据输出。'],
  ['GND', '模块地，和其他接地焊盘相连。'],
  ['GND', '模块底面的裸露接地焊盘。在 3D 底视中查看。']
].map(([signal, summary], index) => ({ number: index + 1, signal, summary }));

// DevKitC V4 user guide: antenna above, Micro USB below. One entry per physical
// pin, so the three GND positions retain different selection identities.
const j2 = [
  ['3V3', '3V3', 2], ['EN', 'EN', 3], ['GPIO36', 'VP', 4], ['GPIO39', 'VN', 5],
  ['GPIO34', 'IO34', 6], ['GPIO35', 'IO35', 7], ['GPIO32', 'IO32', 8], ['GPIO33', 'IO33', 9],
  ['GPIO25', 'IO25', 10], ['GPIO26', 'IO26', 11], ['GPIO27', 'IO27', 12], ['GPIO14', 'IO14', 13],
  ['GPIO12', 'IO12', 14], ['GND1', 'GND', null], ['GPIO13', 'IO13', 16], ['GPIO9', 'D2', null],
  ['GPIO10', 'D3', null], ['GPIO11', 'CMD', null], ['5V', '5V', null]
];
const j3 = [
  ['GND2', 'GND', null], ['GPIO23', 'IO23', 37], ['GPIO22', 'IO22', 36], ['GPIO1', 'TX', 35],
  ['GPIO3', 'RX', 34], ['GPIO21', 'IO21', 33], ['GND3', 'GND', null], ['GPIO19', 'IO19', 31],
  ['GPIO18', 'IO18', 30], ['GPIO5', 'IO5', 29], ['GPIO17', 'IO17', 28], ['GPIO16', 'IO16', 27],
  ['GPIO4', 'IO4', 26], ['GPIO0', 'IO0', 25], ['GPIO2', 'IO2', 24], ['GPIO15', 'IO15', 23],
  ['GPIO8', 'D1', null], ['GPIO7', 'D0', null], ['GPIO6', 'CLK', null]
];

// Measured pin centers in the original photo. The asset viewport rotates the
// photo 90° counterclockwise without changing or reconstructing its pixels.
const j2PhotoX = [1114, 1077, 1040, 1002, 965, 928, 891, 854, 816, 780, 742, 704, 669, 631, 594, 556, 518, 481, 444];
const j3PhotoX = [1117, 1079, 1042, 1003, 966, 928, 891, 854, 816, 778, 741, 703, 666, 628, 591, 553, 516, 479, 440];
const photoWidth = 426;
const photoHeight = 841;
const photoPoint = (x, y) => ({ x: (y - 182) / photoWidth, y: (1235 - x) / photoHeight });

function headerPins(row, connector, originalX, originalY, modelX) {
  return row.map(([id, silk, chipPin], index) => {
    const position = `${connector}-${index + 1}`;
    const legacyFlash = !chipPin && id.startsWith('GPIO');
    const canonical = id.startsWith('GND') ? 'GND' : legacyFlash ? 'NC' : id;
    let summary = modulePads[chipPin - 1]?.summary;
    if (canonical === 'GND') summary = '开发板共地，连接到多个模块接地焊盘。';
    else if (id === '5V') summary = '开发板 5 V 电源网络。模块由板上稳压器提供 3.3 V。';
    else if (legacyFlash) summary = '旧版布局保留的 Flash 标记。参照的 WROOM-32E 模块将这些信号用于内部 Flash，对应边缘焊盘为 NC。';
    return {
      id, label: silk === 'GND' ? `GND · ${position}` : silk,
      canonical, group: connector === 'J2' ? 'J2 左排' : 'J3 右排', chipPin,
      summary, ...photoPoint(originalX[index], originalY),
      modelX, modelZ: (index - 9) * .254
    };
  });
}

const chipBlocks = [
  { id: 'cpu', title: '双核处理器', label: 'LX6 × 2', detail: '两颗 32 位 Xtensa LX6 核心执行程序，最高运行频率为 240 MHz。', color: '#377a8a' },
  { id: 'memory', title: '片内存储', label: 'SRAM / ROM', detail: '520 KB SRAM 存放运行时数据和指令，448 KB ROM 含启动和底层功能。', color: '#247459' },
  { id: 'flash', title: '模块 Flash', label: 'QSPI FLASH', detail: '模块内另有 QSPI Flash 存放程序。照片参照的开发板配置为 4 MB，Flash 线路留在模块内部。', color: '#785694' },
  { id: 'radio', title: 'Wi-Fi 与蓝牙', label: '2.4 GHz RF', detail: '支持 2.4 GHz 802.11 b/g/n、经典蓝牙及低功耗蓝牙。射频经匹配网络接到模块顶端的 PCB 天线。', color: '#ab692a' },
  { id: 'adc', title: 'ADC、DAC 与触摸', label: 'ADC / DAC', detail: '两个 12 位 SAR ADC 读取模拟信号，两个 8 位 DAC 可在 GPIO25 和 GPIO26 输出模拟电平。部分引脚还支持电容触摸。', color: '#aa642b', pins: [4, 6, 10, 11] },
  { id: 'io', title: 'GPIO 与外设', label: 'GPIO MATRIX', detail: 'GPIO 矩阵把 UART、I²C、SPI、PWM 等外设信号分配到可用引脚。GPIO34、35、36、39 只能输入。', color: '#2c755b', pins: [6, 33, 34, 35, 36, 37] },
  { id: 'clock', title: '时钟与定时器', label: 'CLOCK / TIMER', detail: '模块上的 40 MHz 晶体提供时钟参考。片内定时器可计时、触发中断或配合 PWM 外设工作。', color: '#3d6e8c' },
  { id: 'rtc', title: 'RTC 与低功耗', label: 'RTC / ULP', detail: 'RTC 域和超低功耗协处理器可在主核休眠时承担定时唤醒与部分传感器监测。', color: '#537b58', pins: [4, 5, 8, 9] },
  { id: 'security', title: '安全硬件', label: 'CRYPTO / eFUSE', detail: '加密硬件可加速 AES、哈希等运算。eFuse 可保存一次性配置，安全启动和 Flash 加密由系统配置启用。', color: '#655682' }
];

export const ESP32_DEVKITC_INSPECTION = {
  id: 'esp32-devkitc',
  title: 'ESP32-DevKitC V4',
  subtitle: 'Espressif 官方开发板 · ESP32-WROOM-32E 模组',
  orientation: 'PCB 天线朝上，Micro USB 朝下。左排为 J2，右排为 J3。',
  modelCredit: {
    name: 'Espressif DevKitC V4 尺寸图和 WROOM-32E 资料',
    source: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html#related-documents',
    file: './models/esp32-devkitc-v4-detail.glb'
  },
  defaultPin: 'GPIO23',
  quickPins: ['GPIO23', 'GPIO34', 'GPIO0'],
  photo: {
    url: new URL('./assets/esp32-devkitc-v4-photo.svg', import.meta.url),
    width: photoWidth, height: photoHeight,
    alt: 'ESP32-DevKitC V4 正面实拍，ESP32-WROOM-32E 的天线朝上，Micro USB 朝下，两侧各有 19 针。',
    credit: 'Espressif Systems',
    source: 'https://github.com/espressif/esp-dev-kits/blob/5c06bf1835329d6525f316475f7218aab6acfe79/docs/_static/esp32-devkitc/esp32-devkitc-v4-functional-overview.png',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', licenseLabel: 'CC BY-SA 4.0',
    note: '原图由 Espressif 标注，网页裁切并旋转，保留原照片像素和红色标记。',
    chip: { ...photoPoint(995, 396), w: .53, h: .29 }
  },
  pins: [
    ...headerPins(j2, 'J2', j2PhotoX, 207, -1.27),
    ...headerPins(j3, 'J3', j3PhotoX, 581, 1.27)
  ],
  chip: {
    title: 'ESP32-WROOM-32E',
    packageName: '18 × 25.5 × 3.1 mm SMD 模组',
    bodyLabel: 'ESP32-WROOM-32E', bodyLabelSize: '18 × 25.5 mm', pinPitch: '1.27 mm',
    style: 'module',
    pins: modulePads,
    blocks: chipBlocks,
    references: [
      { url: devkitGuide, label: 'DevKitC V4 排针说明' },
      { url: moduleDatasheet, label: 'WROOM-32E 模组数据手册' },
      { url: socDatasheet, label: 'ESP32 SoC 数据手册' }
    ],
    hints: {
      package: '上方是 PCB 天线，下方是金属屏蔽罩。模组把 ESP32 芯片、Flash、晶体和射频电路集成在一起。',
      pins: '这里按 WROOM-32E 模组编号显示 38 个边缘焊盘和底面 39 号接地焊盘。开发板的 J2/J3 排针采用不同编号。',
      functions: '抬起屏蔽罩，查看模组与芯片的功能分区。方块用来讲解器件和模块关系，大小及位置为教学示意。'
    }
  }
};
