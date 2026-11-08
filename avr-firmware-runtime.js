// AVR8js 0.21.1 (Wokwi, MIT), npm release commit bee6f0a94e0e27786f6bc21aee3c775849fb50fd.
// Vendored ESM modules use explicit .js import suffixes. See vendor/avr8js/LICENSE.txt.
import { CPU } from './vendor/avr8js/cpu/cpu.js';
import { avrInstruction } from './vendor/avr8js/cpu/instruction.js';
import { AVRIOPort, PinState, portBConfig, portCConfig, portDConfig } from './vendor/avr8js/peripherals/gpio.js';
import { AVRTimer, timer0Config, timer1Config, timer2Config } from './vendor/avr8js/peripherals/timer.js';
import { AVRUSART, usart0Config } from './vendor/avr8js/peripherals/usart.js';
import { installAvrAdc } from './avr-adc.js';
import { installAvrTwi } from './avr-twi.js';
import { installMegaTimers, megaGpio, megaUsarts } from './avr-mega2560.js';

const CORE_CLOCK_HZ = 16_000_000;
const CYCLES_PER_MS = CORE_CLOCK_HZ / 1000;
const MAX_SLICE_CYCLES = CYCLES_PER_MS * 20;
const MAX_SLICE_WALL_MS = 12;
const MAX_INPUT_READS_PER_SLICE = 4;
const MAX_SERIAL_BYTES = 50_000;
const MAX_RX_BYTES = 1_024;
const MCUCR = 0x55;
const PULLUP_DISABLE = 0x10;

const gpio328p = [
  ...Array.from({length: 8}, (_, bit) => ({name: 'D' + bit, bit, config: portDConfig})),
  ...Array.from({length: 6}, (_, bit) => ({name: 'D' + (bit + 8), bit, config: portBConfig})),
  ...Array.from({length: 6}, (_, bit) => ({name: 'A' + bit, bit, config: portCConfig})),
];

const CAPABILITIES = {
  emulator: 'AVR8js 0.21.1',
  binaryFirmware: true,
  instructionAccurate: true,
  digitalIO: true,
  analogInput: true,
  adcBits: 10,
  pwm: true,
  serialConsole: true,
  serialPinWaveforms: false,
  sourceDebugging: false,
  i2c: true,
  spi: false,
  usbProtocol: false,
};

const MODEL_328P = {
  mcu: 'ATmega328P', flashBytes: 32_768, sramBytes: 2_048, extraIOBytes: 0,
  gpio: gpio328p, timers: [timer0Config, timer1Config, timer2Config], usarts: [usart0Config],
};
const MODEL_2560 = {
  // AVR8js adds 0x100 bytes for I/O itself. The Mega has 0x200 bytes
  // before SRAM, so allocate another 0x100 to place RAMEND at 0x21ff.
  mcu: 'ATmega2560', flashBytes: 262_144, sramBytes: 8_192, extraIOBytes: 0x100,
  gpio: megaGpio, usarts: megaUsarts,
};

const STOPPED_OPCODES = new Map([
  [0x9588, 'SLEEP'],
  [0x95e8, 'SPM'],
  [0x95f8, 'SPM Z+'],
]);

function makeFlash(flash, {mcu, flashBytes}) {
  if (!(flash instanceof Uint8Array) || flash.length < 2 || flash.length > flashBytes) {
    throw new RangeError(mcu + ' 应用固件必须为 2–' + flashBytes + ' 字节的 Flash 数据。');
  }
  const program = new Uint16Array(flashBytes / 2).fill(0xffff);
  for (let i = 0; i < flash.length; i += 2) {
    program[i / 2] = flash[i] | ((flash[i + 1] ?? 0xff) << 8);
  }
  return program;
}

/**
 * readInputs(state) can provide a batch of circuit levels for the board GPIO.
 * Omitted keys follow the AVR pull-up setting. readAnalog(pin, state) and
 * readReference(state) supply voltages at the emulated ADC sample point.
 * i2cAddress, writeI2c and readI2c connect master TWI register operations to
 * a circuit. Their ACK, byte and error results are reflected in the firmware.
 */
export function createAvrFirmwareRuntime({flash}, {boardId = 'uno-r3', readInputs, readPin, readAnalog, readReference,
  i2cAddress, writeI2c, readI2c, onSerial} = {}) {
  const mega = boardId === 'mega2560';
  if (!mega && boardId !== 'uno-r3' && boardId !== 'nano') {
    throw new RangeError('当前原生 AVR 仿真支持 UNO R3、经典 Nano 和 Mega 2560。');
  }
  const model = mega ? MODEL_2560 : MODEL_328P;
  const {gpio} = model;
  const program = makeFlash(flash, model);
  const pinGroups = new Map();
  for (const pin of gpio) {
    if (!pinGroups.has(pin.config)) pinGroups.set(pin.config, []);
    pinGroups.get(pin.config).push(pin);
  }
  const serialNames = model.usarts.map((_, index) => index ? 'Serial' + index : 'Serial');
  const capabilities = Object.freeze({
    ...CAPABILITIES, execution: model.mcu + ' 原生 AVR 指令',
    flashBytes: model.flashBytes, sramBytes: model.sramBytes,
    hardwareTimers: Object.freeze(mega ? [0, 1, 2, 3, 4, 5] : [0, 1, 2]),
    serialPorts: Object.freeze(serialNames),
    note: (mega
      ? 'Mega 2560 支持 GPIO、10 位单次 ADC、定时器 0–5 和 USART0–3 字节控制台。未实现定时器输入捕获、异步 Timer2、部分高级 PWM 模式或引脚变化中断。'
      : 'UNO R3 与经典 Nano 支持 GPIO、10 位单次 ADC、定时器 0–2 和 USART0 字节控制台。')
      + ' TWI 支持主机寄存器、应答及字节收发；不逐位求解 SDA/SCL 波形。ADC 自动触发与连续转换、EEPROM、看门狗、休眠、自编程和启动加载器不在此范围内。',
  });
  let cpu, ports, usarts, adcState, twi, levels, dirtyInputs, inputReads, executedSteps, status, error, serial;

  function pinMode(pin) {
    const mode = ports.get(pin.config).pinState(pin.bit);
    return mode === PinState.InputPullUp && (cpu.data[MCUCR] & PULLUP_DISABLE) ? PinState.Input : mode;
  }

  function applyInputs(pins = gpio) {
    for (const pin of pins) {
      const value = levels[pin.name] ?? (pinMode(pin) === PinState.InputPullUp);
      ports.get(pin.config).setPin(pin.bit, value);
    }
  }

  function setDigitalInputs(next = {}) {
    levels = {};
    for (const {name} of gpio) {
      const value = next?.[name];
      if (value === 0 || value === 1 || typeof value === 'boolean') levels[name] = Boolean(value);
    }
    applyInputs();
  }

  function refreshInputs() {
    if (!dirtyInputs || inputReads >= MAX_INPUT_READS_PER_SLICE) return;
    dirtyInputs = false;
    if (!readInputs && !readPin) return;
    inputReads++;
    const state = getState();
    const next = readInputs
      ? readInputs(state)
      : Object.fromEntries(gpio.map(({name}) => [name, readPin(name, state)]));
    setDigitalInputs(next);
  }

  function configureGpio(config) {
    const port = new AVRIOPort(cpu, config);
    port.addListener(() => { dirtyInputs = true; });
    cpu.readHooks[config.PIN] = address => {
      refreshInputs();
      return cpu.data[address];
    };
    return port;
  }

  function feedSerialInput({device, receiveQueue}) {
    if (receiveQueue.length && device.writeByte(receiveQueue[0])) receiveQueue.shift();
  }

  function reset() {
    cpu = new CPU(program, model.sramBytes + model.extraIOBytes);
    ports = new Map(Array.from(pinGroups.keys(), config => [config, configureGpio(config)]));
    levels = {};
    dirtyInputs = true;
    inputReads = 0;
    executedSteps = 0;
    status = 'ready';
    error = null;
    serial = '';
    // AVR8js exposes the PIN value and GPIO mode separately. Supply the
    // default high for input pull-ups before firmware reads or tests interrupts.
    for (const [config, pins] of pinGroups) {
      for (const address of [config.DDR, config.PORT, config.PIN]) {
        const write = cpu.writeHooks[address];
        const modifiedAddress = address === config.PIN ? config.PORT : address;
        cpu.writeHooks[address] = (value, old, target, mask) => {
          const previous = cpu.data[modifiedAddress];
          const result = write(value, old, target, mask);
          if (cpu.data[modifiedAddress] !== previous) applyInputs(pins);
          return result;
        };
      }
    }
    cpu.writeHooks[MCUCR] = value => {
      const changed = (cpu.data[MCUCR] ^ value) & PULLUP_DISABLE;
      cpu.data[MCUCR] = value;
      if (changed) {
        dirtyInputs = true;
        applyInputs();
      }
      return true;
    };
    if (mega) installMegaTimers(cpu);
    else for (const config of model.timers) new AVRTimer(cpu, config);
    usarts = new Map(model.usarts.map((config, index) => {
      const name = serialNames[index];
      const device = new AVRUSART(cpu, config, CORE_CLOCK_HZ);
      const port = {device, receiveQueue: []};
      device.onByteTransmit = byte => {
        if (!device.txEnable) return;
        const text = String.fromCharCode(byte);
        serial = (serial + text).slice(-MAX_SERIAL_BYTES);
        onSerial?.(text, name);
      };
      device.onRxComplete = () => feedSerialInput(port);
      return [name, port];
    }));
    adcState = installAvrAdc(cpu, {
      boardId, fail,
      readAnalog: readAnalog && (pin => readAnalog(pin, getState())),
      readReference: readReference && (() => readReference(getState())),
    });
    twi = installAvrTwi(cpu, {boardId,clockHz:CORE_CLOCK_HZ,getState:() => getState(false),i2cAddress,writeI2c,readI2c});
    return getState();
  }

  function getState(includeEvents = true) {
    const pins = Object.fromEntries(gpio.map(pin => {
      const mode = pinMode(pin);
      const output = mode === PinState.Low || mode === PinState.High;
      const pullUp = mode === PinState.InputPullUp;
      const level = (cpu.data[pin.config.PIN] >> pin.bit) & 1;
      return [pin.name, {
        mode: output ? 'GPIO_Mode_Out_PP' : pullUp ? 'GPIO_Mode_IPU' : 'GPIO_Mode_IN_FLOATING',
        output: output ? level : 0, level, pull: pullUp ? 'up' : null, clock: true,
        configured: output || pullUp,
      }];
    }));
    return {
      boardId, dialect: 'avr-firmware', coreClockHz: CORE_CLOCK_HZ, logicVoltage: 5, adcMax: 1023,
      timeMs: cpu.cycles / CYCLES_PER_MS, cycles: cpu.cycles, executedSteps,
      pc: {wordAddress: cpu.pc, byteAddress: cpu.pc * 2}, pins,
      uarts: Object.fromEntries(Array.from(usarts, ([name, {device}]) => [name, {
        enabled: device.rxEnable || device.txEnable,
        rxEnabled: device.rxEnable, txEnabled: device.txEnable, baudRate: device.baudRate,
      }])),
      adc: {ADC0: adcState()},
      twi: twi.snapshot(), events: includeEvents ? twi.events() : [],
      serial, console: serial, variables: {},
      done: status === 'error' || status === 'completed', status, error, diagnostics: error ? [error] : [],
      capabilities,
    };
  }

  function fail(code, plain, fix, pc = cpu.pc) {
    status = 'error';
    error = {severity: 'error', code, plain, technical: 'Flash 0x' + (pc * 2).toString(16), fix};
  }

  function execute() {
    const opcode = program[cpu.pc];
    if (opcode === undefined || opcode === 0xffff) {
      fail('AVR_EMPTY_FLASH', '程序跳到了没有指令的 Flash 地址。', '导入为所选 Arduino 板编译的完整应用 HEX。');
      return false;
    }
    if (STOPPED_OPCODES.has(opcode)) {
      fail('AVR_UNSUPPORTED_INSTRUCTION', '当前 AVR 仿真不执行 ' + STOPPED_OPCODES.get(opcode) + '。', '使用不依赖休眠或自编程的应用固件。');
      return false;
    }
    if (opcode === 0x9598) {
      status = 'completed'; // BREAK is the AVR debug trap.
      return false;
    }
    avrInstruction(cpu);
    if (status === 'running') cpu.tick();
    executedSteps++;
    return true;
  }

  function runSlice(instructionLimit, cycleTarget) {
    let steps = 0;
    let yielded = false;
    if (status !== 'error' && status !== 'completed' && cpu.cycles < cycleTarget) {
      const deadline = performance.now() + MAX_SLICE_WALL_MS;
      status = 'running';
      inputReads = 0;
      dirtyInputs = true;
      try {
        refreshInputs();
        for (const port of usarts.values()) feedSerialInput(port);
        while (status === 'running' && steps < instructionLimit && cpu.cycles < cycleTarget && execute()) {
          steps++;
          if (!(steps & 255) && performance.now() >= deadline) {
            yielded = true;
            break;
          }
        }
      } catch (cause) {
        fail('AVR_RUNTIME_ERROR', '固件仿真遇到无法处理的情况。', String(cause?.message || cause));
      }
    }
    return {...getState(), steps, budgetReached: yielded};
  }

  function step(count = 1) {
    const limit = Math.max(1, Math.min(20_000, Math.floor(Number(count) || 1)));
    return runSlice(limit, Infinity);
  }

  function advanceTime(ms) {
    const amount = Number(ms);
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('运行时间必须是有限的非负毫秒数。');
    const requested = Math.floor(amount * CYCLES_PER_MS);
    const result = runSlice(Infinity, cpu.cycles + Math.min(MAX_SLICE_CYCLES, requested));
    return {...result, budgetReached: result.budgetReached || (requested > MAX_SLICE_CYCLES && !result.done)};
  }

  function injectSerial(text, port = 'Serial') {
    const uart = usarts.get(port ?? 'Serial');
    if (!uart) return getState();
    const {receiveQueue} = uart;
    const input = typeof text === 'string' ? text : (text instanceof Uint8Array ? text : []);
    const length = Math.min(input.length, MAX_RX_BYTES - receiveQueue.length);
    for (let i = 0; i < length; i++) {
      receiveQueue.push(typeof input === 'string' ? input.charCodeAt(i) & 0xff : input[i]);
    }
    feedSerialInput(uart);
    return getState();
  }

  reset();
  return {step, advanceTime, getState, reset, setDigitalInputs, injectSerial, capabilities};
}
