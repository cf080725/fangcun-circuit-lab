const numbered = (count, start = 0) => Array.from({length: count}, (_, index) => start + index);
const digital = number => 'D' + number;
const analog = number => 'A' + number;
const arduino12 = {
  logicVoltage: 3.3, adcMax: 4095, nativeAdcBits: 12, adcDefaultBits: 10,
  language: 'arduino', dialects: ['arduino'],
  capabilities: {analogReadResolution: true, analogWriteResolution: true, analogWriteFrequency: false}
};

export function makeDueTeensyProfiles({rows, named}) {
  const d = numbered(54).map(digital), a = numbered(12).map(analog);
  const reserved = name => named(name, name, name, {kind: 'reserved'});
  const ground = name => named(name, 'GND', 'GND');
  const pinBlock = (pins, gap) => pins.map(pin => ({id: pin, label: pin, gap}));
  const dueLeft = ['NC', 'IOREF', 'RESET', '3V3', '5V', ground('GND1'), ground('GND2'), 'VIN',
    ...pinBlock(a, .25), ...['DAC0', 'DAC1', 'CANRX', 'CANTX'].map(pin => ({...reserved(pin), gap: .25}))];
  const dueRight = ['SCL1', 'SDA1', 'AREF', ground('GND3'),
    ...[...d.slice(8, 14)].reverse(), ...pinBlock([...d.slice(0, 8)].reverse(), .25), ...pinBlock(d.slice(14, 22), .5)];
  const duePins = rows(dueLeft, dueRight, 5.34, 10.16, {start: -3.65, x: 2.35});
  // The end connector has 16 even/odd pairs between two 5 V and two ground pins.
  for (let column = 0; column < 18; column++) {
    for (let row = 0; row < 2; row++) {
      const pin = column === 0 ? ground('GND_END' + row) : column === 17 ? named('5V_END' + row, '5V', '5V') :
        named(digital(52 - (column - 1) * 2 + row), digital(52 - (column - 1) * 2 + row));
      const kind = column === 0 ? 'ground' : column === 17 ? 'power' : 'gpio';
      duePins.push({...pin, side: 'bottom', x: -2.159 + column * .254, z: 4.25 + row * .254, kind});
    }
  }
  const due = {
    ...arduino12, id: 'arduino-due', name: 'Arduino Due', family: 'SAM3X', mcu: 'ATSAM3X8E',
    coreClockHz: 84000000, flashBytes: 524288, ramBytes: 98304,
    style: 'due', width: 5.34, height: 10.16, color: '#197a85', pins: duePins,
    pinAliases: {IOREF: '3V3', SDA: 'D20', SCL: 'D21', TX: 'D1', RX: 'D0'},
    numberedPins: Object.fromEntries([...d, ...a, 'DAC0', 'DAC1', 'CANRX', 'CANTX', 'SDA1', 'SCL1'].map((pin, index) => [index, pin])),
    analogPins: a, analogChannelNumbers: true, pwmPins: d.slice(2, 14), pwmFrequency: 1000,
    dacPins: ['DAC0', 'DAC1'], reservedPins: ['DAC0', 'DAC1', 'CANRX', 'CANTX'],
    ledPin: 'D13', ledResistance: 1000, gpioWarningMa: 6,
    serialPorts: ['Serial', 'Serial1', 'Serial2', 'Serial3'],
    defaultPins: {led: 'D9', button: 'D2', adc: 'A0', pwm: 'D9', tx: 'D1', rx: 'D0'},
    platformio: {platform: 'atmelsam', board: 'due', framework: 'arduino'},
    arduinoFqbn: 'arduino:sam:arduino_due_x_dbg',
    arduinoDefines: {ARDUINO_ARCH_SAM: 1, ARDUINO_SAM_DUE: 1, __SAM3X8E__: 1},
    sources: ['https://docs.arduino.cc/hardware/due/', 'https://docs.arduino.cc/resources/pinouts/A000056-full-pinout.pdf',
      'https://github.com/arduino/ArduinoCore-sam/blob/master/variants/arduino_due_x/variant.h'],
    notes: [
      '3.3 V I/O。示例在 D9 接外置 LED；板载 LED 使用 D13。实板各脚限流不同，请查官方表。',
      'A0–A11 支持 ADC，D2–D13 支持 PWM。DAC0、DAC1、CAN、USB 和调试接口暂未建模。',
      'SDA1/SCL1 与 D20/D21 独立。虚拟串口只模拟字节读写。'
    ],
    footprintNote: '按 Arduino Due 侧边和尾部主排针绘制的教学布局，未绘制板内调试排针。'
  };

  const teensy = is41 => {
    const id = is41 ? 'teensy41' : 'teensy40';
    const size = is41 ? 6.096 : 3.556;
    const left = [ground('GND1'), ...d.slice(0, 13)];
    const right = ['VIN', ground('GND2'), '3V3', ...[...d.slice(13, 24)].reverse()];
    if (is41) {
      left.push(named('3V3b', '3V3', '3V3'), ...d.slice(24, 33));
      right.push(ground('GND3'), ...[...d.slice(33, 42)].reverse());
    }
    const analogPins = [...d.slice(14, is41 ? 28 : 24), ...(is41 ? d.slice(38, 42) : [])];
    const pwmPins = [...d.slice(0, 16), 'D18', 'D19', 'D22', 'D23',
      ...(is41 ? ['D24', 'D25', 'D28', 'D29', 'D33', 'D36', 'D37'] : [])];
    return {
      ...arduino12, id, name: is41 ? 'Teensy 4.1' : 'Teensy 4.0', family: 'Teensy 4.x', mcu: 'i.MX RT1062',
      coreClockHz: 600000000, flashBytes: is41 ? 8388608 : 2097152, ramBytes: 1048576,
      style: id, width: 1.778, height: size, color: '#1f282e', pins: rows(left, right, 1.778, size, {x: .762}),
      pinAliases: {SDA: 'D18', SCL: 'D19', RX: 'D0', TX: 'D1', MISO: 'D12', MOSI: 'D11', SCK: 'D13',
        ...Object.fromEntries(analogPins.map((pin, index) => [analog(index), pin]))},
      numberedPins: Object.fromEntries(d.slice(0, is41 ? 42 : 24).map((pin, index) => [index, pin])),
      analogPins, pwmPins, pwmFrequency: 4482,
      pwmFrequencies: Object.fromEntries([10, 11, 12, 13, 14, 15, 18, 19].map(number => [digital(number), 3611])),
      hasPullDown: true, ledPin: 'D13', ledResistance: 1000, gpioWarningMa: 4,
      serialPorts: ['Serial', 'Serial1', 'Serial2', 'Serial3'],
      defaultPins: {led: 'D9', button: 'D2', adc: 'D14', pwm: 'D9', tx: 'D1', rx: 'D0'},
      platformio: {platform: 'teensy', board: id, framework: 'arduino'},
      arduinoFqbn: 'teensy:avr:' + id,
      arduinoDefines: {ARDUINO_ARCH_AVR: 1, [is41 ? 'ARDUINO_TEENSY41' : 'ARDUINO_TEENSY40']: 1, __IMXRT1062__: 1},
      sources: ['https://www.pjrc.com/store/' + id + '.html',
        'https://www.pjrc.com/teensy/' + (is41 ? 'card11a_rev4_web.pdf' : 'card10a_rev2_web.pdf'),
        'https://www.pjrc.com/teensy/td_pulse.html'],
      notes: [
        '3.3 V I/O；厂家建议单脚输出电流不超过 4 mA。板载橙灯接 D13。',
        `当前模型包含侧排针上的 ${is41 ? '42' : '24'} 个 GPIO。ADC 使用 A0 等引脚名或对应数字 GPIO 编号。`,
        '定时器通道共享、PWM 频率重配、背面焊盘、USB 和高速外设暂未建模。'
      ],
      footprintNote: '按 PJRC 侧排针引脚图绘制的教学布局，背面焊盘和独立扩展排针未建模。'
    };
  };
  return [due, teensy(false), teensy(true)];
}
