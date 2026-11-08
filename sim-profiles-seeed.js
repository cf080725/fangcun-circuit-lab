const seeedIndex = 'https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json';
const rp2040Core = 'https://github.com/earlephilhower/arduino-pico/blob/master/variants/seeed_xiao_rp2040/pins_arduino.h';

export function makeSeeedProfiles({rows}) {
  const digital = Array.from({length: 11}, (_, index) => `D${index}`);
  const [d0, d1, d2, d3, d4, d5, d6, d7, d8, d9, d10] = digital;
  const left = [d0, d1, d2, d3, d4, d5, d6];
  const right = ['5V', 'GND', '3V3', d10, d9, d8, d7];
  const models = [
    {
      id: 'xiao-samd21', name: 'Seeed Studio XIAO SAMD21', family: 'SAMD21', mcu: 'ATSAMD21G18A',
      coreClockHz: 48000000, flashBytes: 262144, ramBytes: 32768, color: '#234e6b',
      coreNumbers: digital.map((_, index) => index),
      chipPins: ['PA02', 'PA04', 'PA10', 'PA11', 'PA08', 'PA09', 'PB08', 'PB09', 'PA07', 'PA05', 'PA06'],
      analogCount: 11, pwmPins: digital.slice(1), dacPins: [d0],
      arduinoFqbn: 'Seeeduino:samd:seeed_XIAO_m0',
      arduinoDefines: {ARDUINO_ARCH_SAMD: 1, ARDUINO_SEEED_XIAO_M0: 1, SEEED_XIAO_M0: 1, __SAMD21G18A__: 1},
      platformio: {platform: 'atmelsam', board: 'seeed_xiao', framework: 'arduino'},
      sources: ['https://wiki.seeedstudio.com/Seeeduino-XIAO/', seeedIndex],
      notes: [
        'D0–D10 均支持 ADC，D1–D10 支持 PWM。D0 的 DAC 输出暂未建模。',
        '内置用户灯、QTouch、USB 和调试接口暂未建模。'
      ]
    },
    {
      id: 'xiao-rp2040', name: 'Seeed Studio XIAO RP2040', family: 'RP2040', mcu: 'RP2040',
      coreClockHz: 133000000, flashBytes: 2097152, ramBytes: 270336, color: '#37264b',
      coreNumbers: [26, 27, 28, 29, 6, 7, 0, 1, 2, 4, 3],
      chipPins: ['GP26', 'GP27', 'GP28', 'GP29', 'GP6', 'GP7', 'GP0', 'GP1', 'GP2', 'GP4', 'GP3'],
      analogCount: 4, pwmPins: [...digital], hasPullDown: true, pwmFrequency: 1000,
      arduinoFqbn: 'rp2040:rp2040:seeed_xiao_rp2040',
      arduinoDefines: {ARDUINO_ARCH_RP2040: 1, ARDUINO_SEEED_XIAO_RP2040: 1},
      sources: ['https://wiki.seeedstudio.com/XIAO-RP2040/', rp2040Core],
      notes: [
        'Arduino-Pico 的数字编号对应芯片 GPIO，例如板上的 D0 是 GPIO26，D6 是 GPIO0。',
        'D0–D3 支持 ADC，D0–D10 支持 PWM。板载灯、PIO 和 USB 暂未建模。'
      ]
    },
    {
      id: 'xiao-nrf52840-sense', name: 'Seeed Studio XIAO nRF52840 Sense', family: 'nRF52', mcu: 'nRF52840',
      coreClockHz: 64000000, flashBytes: 1048576, ramBytes: 262144, color: '#303e4b',
      coreNumbers: digital.map((_, index) => index),
      chipPins: ['P0_02', 'P0_03', 'P0_28', 'P0_29', 'P0_04', 'P0_05', 'P1_11', 'P1_12', 'P1_13', 'P1_14', 'P1_15'],
      analogCount: 6, pwmPins: [...digital], hasPullDown: true,
      arduinoFqbn: 'Seeeduino:nrf52:xiaonRF52840Sense',
      arduinoDefines: {ARDUINO_ARCH_NRF52: 1, ARDUINO_Seeed_XIAO_nRF52840_Sense: 1, NRF52840_XXAA: 1},
      sources: ['https://wiki.seeedstudio.com/XIAO_BLE/', seeedIndex],
      notes: [
        '使用 Seeed nRF52 Boards 的 D0–D10 编号，Mbed 板包的部分数字编号不同。D0–D5 支持 ADC。',
        '板载 RGB、BLE、PDM 麦克风、六轴传感器、电池和外部 Flash 暂未建模。'
      ]
    }
  ];

  return models.map(({coreNumbers, chipPins, analogCount, notes, ...model}) => {
    const analogPins = digital.slice(0, analogCount);
    const pinAliases = {SDA: d4, SCL: d5, TX: d6, RX: d7, SCK: d8, MISO: d9, MOSI: d10};
    analogPins.forEach((pin, index) => { pinAliases[`A${index}`] = pin; });
    chipPins.forEach((chipPin, index) => { pinAliases[chipPin] = digital[index]; });
    if (model.family === 'RP2040') coreNumbers.forEach((number, index) => { pinAliases[`GPIO${number}`] = digital[index]; });
    return {
      logicVoltage: 3.3, adcMax: 4095, nativeAdcBits: 12, adcDefaultBits: 10,
      style: 'xiao', width: 1.78, height: 2.1, language: 'arduino', dialects: ['arduino'],
      pins: rows(left, right, 1.78, 2.1, {x: .762}), pinAliases,
      numberedPins: Object.fromEntries(coreNumbers.map((number, index) => [number, digital[index]])),
      analogPins, ledPin: null, serialPorts: ['Serial'],
      defaultPins: {led: d1, button: d2, adc: d0, pwm: d1, tx: d6, rx: d7},
      capabilities: {analogReadResolution: true, analogWriteResolution: true, analogWriteFrequency: false},
      ...model,
      notes: ['3.3 V 逻辑。示例在 D1 接外置 LED，串口输出使用虚拟控制台。', ...notes]
    };
  });
}
