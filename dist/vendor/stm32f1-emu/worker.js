// Local driver for stm32f1-emu 3.3.0. Each worker owns one isolated Wasm instance.
import initializeWasm, * as core from './stm32_bluepill_wasm.js';
import {STM32_FLASH_BASE, STM32_SRAM_BASE, getStm32FirmwareTarget} from '../../stm32-firmware-image.js?v=08.9';
import {createStm32Adc} from '../../stm32-adc.js?v=08.9';
import {readStm32Pwm, stm32Apb1TimerClock} from '../../stm32-pwm.js?v=10.33.0';
import {createStm32I2c} from '../../stm32-i2c.js';

const wasmUrl = new URL('./stm32_bluepill_wasm_bg.wasm', import.meta.url);
const node = wasmUrl.protocol === 'file:' && typeof process !== 'undefined' && !!process.versions?.node;
const parent = node ? (await import('node:worker_threads')).parentPort : null;
const listen = parent ? callback => parent.on('message', callback) : callback => addEventListener('message', event => callback(event.data));
const send = parent ? data => parent.postMessage(data) : data => postMessage(data);

const RCC_CFGR = 0x40021004;
const RCC_APB1RSTR = 0x40021010;
const RCC_APB1ENR = 0x4002101c;
const RCC_APB2ENR = 0x40021018;
const AFIO_MAPR = 0x40010004;
const GPIO_A = 0x40010800;
const ADC1 = 0x40012400;
const I2C1 = 0x40005400;
const I2C1_CLOCK = 1 << 21;
const USART = {
  USART1: {base: 0x40013800, clockRegister: RCC_APB2ENR, clockBit: 14, clockIndex: 3},
  USART2: {base: 0x40004400, clockRegister: RCC_APB1ENR, clockBit: 17, clockIndex: 2},
};
// Payload lengths of stm32f1-emu 3.3.0 drain_events(), by discriminant.
// SPI transfers and USB packets include variable-length byte arrays.
const EVENT_WORDS = [0, 0, 2, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 11, 11, 3, 5, 0, 2, 0, 3, 2];
const MAX_CHUNK = 4096;
const I2C_CHUNK = 128;
const WALL_MS = 30;
const MAX_SERIAL = 50_000;
const MAX_RX = 1_024;
const OUT = ['GPIO_Mode_Out_PP', 'GPIO_Mode_Out_OD', 'GPIO_Mode_AF_UNMODELED', 'GPIO_Mode_AF_UNMODELED'];

let flash, initialStack, resetVector, target, gpio = [], analog = [], gpioRegs, externalLevels, applied;
let analogVoltages, adc1, i2c1;
let cycles, timeMs, executedSteps, status, error, serial;
let i2cRequestSequence = 0, awaitingI2c = null;
const read = addr => core.periph_read(addr, 4);
const clock = () => core.rcc_clocks_hz();
const address = () => (core.rustcpu_regs()[15] & ~1) >>> 0;
const gpioBase = port => GPIO_A + 0x400 * port;
const pinConfig = (crl, crh, pin) => ((pin < 8 ? crl : crh) >>> ((pin % 8) * 4)) & 15;

// The pinned core ignores external levels in the F1 pull mode (CNF=10).
// Its bus routes custom MMIO at a whole GPIO block, so model the exposed
// ports here while the CPU executes the firmware's real MMIO instructions.
function readIdr(port) {
  const {crl, crh, odr} = gpioRegs[port];
  let value = 0;
  for (let pin = 0; pin < 16; pin++) {
    const config = pinConfig(crl, crh, pin), type = config >>> 2;
    const high = (odr >>> pin) & 1;
    const external = externalLevels.get(port * 16 + pin);
    const level = (config & 3) !== 0
      ? (type === 0 ? high : type === 1 ? high && external : 0)
      : (type === 1 ? external : type === 2 ? external ?? high : 0);
    if (level) value |= 1 << pin;
  }
  return value;
}

function gpioEnabled(port) {
  return !!(read(RCC_APB2ENR) & (4 << port));
}

function i2cRouteReason() {
  if (read(AFIO_MAPR) & 2) return 'i2c-remap-unsupported';
  if (!gpioEnabled(1)) return 'i2c-pin-configuration';
  const {crl, crh} = gpioRegs[1];
  for (const pin of [6, 7]) {
    if (pinConfig(crl, crh, pin) < 13) return 'i2c-pin-configuration';
  }
  return null;
}

function readGpio(port, address, width) {
  if (!gpioEnabled(port)) return 0;
  const offset = address - gpioBase(port), regs = gpioRegs[port];
  const register = offset & ~3;
  const value = register === 0 ? regs.crl : register === 4 ? regs.crh : register === 8 ? readIdr(port)
    : register === 12 ? regs.odr : register === 24 ? regs.lock : 0;
  const mask = width === 1 ? 0xff : width === 2 ? 0xffff : 0xffffffff;
  return ((value >>> ((offset & 3) * 8)) & mask) >>> 0;
}

function reservedGpio(port) {
  const swj = (read(AFIO_MAPR) >>> 24) & 7;
  if (swj === 4) return 0;
  const jtag = swj !== 2;
  return port === 0 ? (jtag ? 0xe000 : 0x6000)
    : port === 1 && jtag ? (swj === 1 ? 0x08 : 0x18) : 0;
}

function writeGpio(port, address, value, width) {
  if (!gpioEnabled(port)) return;
  const offset = address - gpioBase(port), regs = gpioRegs[port];
  const register = offset & ~3;
  const shift = (offset & 3) * 8;
  const mask = (width === 1 ? 0xff : width === 2 ? 0xffff : 0xffffffff) << shift;
  const data = value << shift;
  if (register === 0 || register === 4) {
    const key = register === 0 ? 'crl' : 'crh';
    const protectedPins = ((regs.lock & 0x10000 ? regs.lock : 0) | reservedGpio(port)) >>> (register === 0 ? 0 : 8);
    let writable = mask;
    for (let i = 0; i < 8; i++) if (protectedPins & (1 << i)) writable &= ~(15 << (4 * i));
    regs[key] = (regs[key] & ~writable) | (data & writable);
  } else if (register === 12) {
    regs.odr = ((regs.odr & ~mask) | (data & mask)) & 0xffff;
  } else if (register === 16) {
    regs.odr = (regs.odr & ~(data >>> 16)) | (data & 0xffff);
  } else if (register === 20) {
    regs.odr &= ~(data & 0xffff);
  } else if (register === 24 && !(regs.lock & 0x10000)) {
    const key = data & 0xffff;
    const high = !!(data & 0x10000);
    if (high && regs.lockPhase === 2 && key === regs.lockKey) regs.lock = data & 0x1ffff;
    else if (!high && regs.lockPhase === 1 && key === regs.lockKey) regs.lockPhase = 2;
    else {
      regs.lockKey = key;
      regs.lockPhase = high ? 1 : 0;
    }
  }
}

function pins(pwmOutputs = {}) {
  const inputLevels = gpioRegs.map((_, port) => readIdr(port));
  const enabled = read(RCC_APB2ENR);
  return Object.fromEntries(gpio.map(({name, port, pin}) => {
    const {crl, crh, odr} = gpioRegs[port];
    const enabledPort = !!(enabled & (4 << port));
    const config = enabledPort ? pinConfig(crl, crh, pin) : 4;
    const type = config >>> 2;
    const driving = (config & 3) !== 0;
    const pwm = driving && type >= 2 ? pwmOutputs[name] : null;
    const output = pwm?.level ?? ((odr >>> pin) & 1);
    const mode = pwm ? (type === 2 ? 'GPIO_Mode_AF_PP' : 'GPIO_Mode_AF_OD')
      : driving ? OUT[type] : type === 0 ? 'GPIO_Mode_AIN'
      : type === 2 ? (output ? 'GPIO_Mode_IPU' : 'GPIO_Mode_IPD') : 'GPIO_Mode_IN_FLOATING';
    return [name, {
      mode, output, level: driving && (type < 2 || pwm) ? output : (inputLevels[port] >>> pin) & 1,
      configured: config !== 4, clock: enabledPort,
      pull: mode === 'GPIO_Mode_IPU' ? 'up' : mode === 'GPIO_Mode_IPD' ? 'down' : null,
      ...(pwm && {pwm}),
    }];
  }));
}

function uartState(name, clocks) {
  const {base, clockRegister, clockBit, clockIndex} = USART[name];
  const cr1 = read(base + 0x0c);
  const enabled = !!(read(clockRegister) & (1 << clockBit)) && !!(cr1 & (1 << 13));
  const divisor = read(base + 8) & 0xffff;
  return {
    enabled, rxEnabled: enabled && !!(cr1 & 4), txEnabled: enabled && !!(cr1 & 8),
    baudRate: divisor ? Math.round(clocks[clockIndex] / divisor) : null,
  };
}

function drainSerial(tx) {
  core.get_uart_output(); // Discard the core's duplicate aggregate stream.
  const events = core.drain_events();
  let output = '';
  for (let i = 0; i < events.length;) {
    const type = events[i++];
    const words = type === 1 ? 3 + events[i + 1] + events[i + 2]
      : type === 18 ? 2 + events[i + 1]
        : type === 20 ? 4 + events[i + 3] : EVENT_WORDS[type];
    if (!(words > 0) || i + words > events.length) break;
    if (type === 6) {
      const port = 'USART' + events[i];
      if (target.serialPorts.includes(port)) {
        const byte = String.fromCharCode(events[i + 1] & 0xff);
        tx[port] = ((tx[port] ?? '') + byte).slice(-MAX_SERIAL);
        output += byte;
      }
    }
    i += words;
  }
  if (output) serial = (serial + output).slice(-MAX_SERIAL);
}

function snapshot(steps = 0, budgetReached = false) {
  const peripheralClock = clock();
  const [,hclk,pclk1] = peripheralClock;
  const apb1 = read(RCC_APB1ENR);
  const timerClockHz = stm32Apb1TimerClock(pclk1, read(RCC_CFGR));
  const pwm = readStm32Pwm({
    read, timerClockHz, afioMapr: read(AFIO_MAPR),
    // The pinned core advances TIMx at HCLK. APB1 /1 and /2 have that timer clock.
    isClocked: timer => timerClockHz === hclk && Boolean(apb1 & (1 << (timer - 2))),
  });
  return {
    boardId: target.boardId, dialect: 'stm32-firmware', timeMs, cycles, executedSteps, steps, budgetReached,
    coreClockHz: peripheralClock[1], logicVoltage: 3.3, adcMax: 4095,
    pc: {byteAddress: address()}, pins: pins(pwm),
    adc: {ADC1: adc1.getState()},
    i2c: {I2C1: i2c1.getState()}, events: i2c1.events(),
    uarts: Object.fromEntries(target.serialPorts.map(name => [name, uartState(name, peripheralClock)])),
    serial, console: serial, variables: {},
    status, error, diagnostics: error ? [error] : [], done: status === 'error' || status === 'completed',
  };
}

function reset() {
  core.init();
  applied = new Map();
  externalLevels = new Map();
  analogVoltages = {};
  adc1 = createStm32Adc({
    isClocked: () => Boolean(read(RCC_APB2ENR) & (1 << 9)),
    readVoltage: pin => analogVoltages[pin],
    inputPins: analog.map(({name}) => name),
    clockHz: () => {
      const [,coreHz,,pclk2] = clock();
      const prescaler = 2 + 2 * ((read(RCC_CFGR) >>> 14) & 3);
      return {coreHz, adcHz: pclk2 / prescaler};
    },
  });
  if (!core.register_js_peripheral(ADC1, 0x50,
    (address, width) => adc1.read(address - ADC1, width),
    (address, value, width) => adc1.write(address - ADC1, width, value))) {
    throw new Error('无法连接 ADC1 寄存器。');
  }
  gpioRegs = Array.from({length: Math.max(...gpio.map(({port}) => port)) + 1},
    () => ({crl: 0x44444444, crh: 0x44444444, odr: 0, lock: 0, lockPhase: 0}));
  for (let port = 0; port < gpioRegs.length; port++) {
    if (!core.register_js_peripheral(gpioBase(port), 0x400,
      (address, width) => readGpio(port, address, width),
      (address, value, width) => writeGpio(port, address, value, width))) {
      throw new Error('无法连接 GPIO' + String.fromCharCode(65 + port) + ' 寄存器。');
    }
  }
  i2c1 = createStm32I2c({
    isClocked: () => Boolean(read(RCC_APB1ENR) & I2C1_CLOCK),
    isReset: () => Boolean(read(RCC_APB1RSTR) & I2C1_CLOCK),
    routeReason: i2cRouteReason,
    clockHz: () => clock()[2],
    now: () => timeMs,
  });
  if (!core.register_js_peripheral(I2C1, 0x24,
    (address, width) => i2c1.read(address - I2C1, width),
    (address, value, width) => i2c1.write(address - I2C1, width, value))) {
    throw new Error('无法连接 I2C1 寄存器。');
  }
  core.rustcpu_init(initialStack, resetVector, target.flashBytes, target.sramBytes);
  core.rustcpu_load(flash, STM32_FLASH_BASE);
  core.get_uart_output();
  cycles = 0;
  timeMs = 0;
  executedSteps = 0;
  status = 'ready';
  error = null;
  serial = '';
  return snapshot();
}

function applyInputs(inputs, analogInputs) {
  const state = pins();
  analogVoltages = analogInputs ?? {};
  externalLevels.clear();
  for (const {name, port, pin} of gpio) {
    const {mode, clock: enabled} = state[name];
    const external = inputs?.[name];
    const driven = typeof external === 'boolean' || external === 0 || external === 1;
    if (driven) externalLevels.set(port * 16 + pin, Boolean(external));
    if (!enabled || mode === 'GPIO_Mode_AIN' || mode === 'GPIO_Mode_Out_PP' || mode.includes('AF_')) continue;
    if (!driven && !applied.has(name) && mode === 'GPIO_Mode_IN_FLOATING') continue;
    const level = driven ? Boolean(external) : mode === 'GPIO_Mode_IPU';
    if (applied.get(name) !== level) {
      core.gpio_set_input(port, pin, level);
      applied.set(name, level);
    }
  }
  if (analogInputs) {
    for (const {name, port, pin} of analog) {
      const voltage = analogInputs[name];
      const value = Number.isFinite(voltage) ? Math.round(Math.min(3.3, Math.max(0, voltage)) * 4095 / 3.3) : 0xffff;
      core.gpio_set_analog(port, pin, value);
    }
  }
}

function fail(code, plain, technical, fix) {
  status = 'error';
  error = {severity: 'error', code, plain, technical, fix};
}

function executablePc(pc) {
  return pc < target.flashBytes
    || (pc >= STM32_FLASH_BASE && pc < STM32_FLASH_BASE + target.flashBytes)
    || (pc >= STM32_SRAM_BASE && pc < STM32_SRAM_BASE + target.sramBytes);
}

async function serviceI2c(commandId, request) {
  do {
    const requestId = ++i2cRequestSequence;
    const state = {boardId: target.boardId, timeMs, pins: pins()};
    const response = await new Promise(resolve => {
      awaitingI2c = {commandId, requestId, resolve};
      send({id: commandId, i2c: {id: requestId, ...request, state}});
    });
    i2c1.completeRequest(response);
    request = i2c1.takeRequest();
  } while (request);
}

async function run({id, count, ms, inputs, analogInputs}) {
  if (status === 'error' || status === 'completed' || ms === 0) return {state: snapshot()};
  status = 'running';
  applyInputs(inputs, analogInputs);
  const stepMode = count != null;
  const singleStep = count === 1;
  const targetTime = timeMs + Math.min(ms ?? 0, 20);
  const deadline = performance.now() + WALL_MS;
  const tx = {};
  let steps = 0, budgetReached = ms > 20;
  while (stepMode ? steps < count : timeMs < targetTime) {
    const pc = address();
    if (!executablePc(pc)) {
      fail('STM32_PC_RANGE', '程序跳到了当前板型仿真范围外的地址。', 'PC 0x' + pc.toString(16),
        '检查链接地址、启动向量或中断返回地址。');
      break;
    }
    const hz = clock()[1] || 8_000_000;
    const chunk = i2c1.getState().busy ? I2C_CHUNK : MAX_CHUNK;
    const budget = stepMode ? Math.min(chunk, count - steps)
      : Math.min(chunk, Math.max(1, Math.ceil((targetTime - timeMs) * hz / 1000)));
    core.rustcpu_dma_pump();
    // The ordinary run API may finish a complete SVC handler even for a
    // budget of one. The core's debug primitive has a hard one-step limit.
    const retired = singleStep ? core.swd_step() : core.rustcpu_run(budget);
    steps += retired;
    executedSteps += retired;
    const elapsed = retired || (stepMode ? 0 : budget);
    cycles += elapsed;
    timeMs += elapsed * 1000 / hz;
    const flags = core.process_batch(elapsed);
    adc1.advance(elapsed);
    core.rustcpu_dma_pump();
    let fault = core.rustcpu_fault();
    if (!singleStep && !fault.length && (flags & 0x40000000)) {
      core.rustcpu_dispatch();
      fault = core.rustcpu_fault();
    }
    drainSerial(tx);
    // Drain other events and pin transitions so tight GPIO loops stay bounded.
    core.gpio_take_pin_events();
    const adcError = adc1.getState().error;
    if (adcError) {
      status = 'error';
      error = adcError;
      break;
    }
    if (fault.length) {
      if ((fault[1] & 0xff00) === 0xbe00) status = 'completed';
      else if (singleStep && (fault[1] & 0xff00) === 0xdf00) {
        core.rustcpu_fault_clear();
        status = 'waiting';
      }
      else fail('STM32_CPU_FAULT', '处理器遇到无法执行的指令或访问，固件已暂停。',
        'PC 0x' + fault[0].toString(16) + ' · Thumb 0x' + fault[1].toString(16),
        '检查固件是否为 Cortex-M3 和 ' + target.mcu + ' 编译，并检查启动入口与指令。');
      break;
    }
    if ((flags & 0x80000000) || core.is_watchdog_reset_requested()) {
      fail('STM32_RESET_REQUESTED', '固件请求了硬件复位，运行已暂停。', 'PC 0x' + address().toString(16), '点击复位重新从应用入口运行。');
      break;
    }
    if (core.swd_halted()) {
      status = 'completed';
      break;
    }
    const request = i2c1.takeRequest();
    if (request) await serviceI2c(id, request);
    if (stepMode && !retired) break;
    if (performance.now() >= deadline) {
      budgetReached ||= stepMode ? steps < count : timeMs < targetTime;
      break;
    }
  }
  return {state: snapshot(steps, budgetReached), tx};
}

async function dispatch(command) {
  if (command.type === 'init') {
    const bytes = node ? await (await import('node:fs/promises')).readFile(wasmUrl)
      : await fetch(wasmUrl, {credentials: 'same-origin', redirect: 'error'}).then(response => {
        if (!response.ok) throw new Error('WASM HTTP ' + response.status);
        return response.arrayBuffer();
      });
    await initializeWasm({module_or_path: bytes});
    ({flash, initialStack, resetVector, gpio, analog} = command);
    target = getStm32FirmwareTarget(command.boardId);
    if (!target) throw new Error('当前 STM32 板型没有原生固件支持。');
    return {state: reset()};
  }
  if (command.type === 'reset') return {state: reset()};
  if (command.type === 'run') return run(command);
  if (command.type === 'serial') {
    const port = command.port;
    if (!target.serialPorts.includes(port)) return {state: snapshot()};
    const {base} = USART[port];
    const uart = uartState(port, clock());
    const room = MAX_RX - core.uart_rx_pending(base);
    if (uart.rxEnabled) for (const byte of command.bytes.subarray(0, Math.max(0, room))) core.uart_rx_byte(base, byte);
    return {state: snapshot()};
  }
  throw new Error('Unknown STM32 worker command');
}

let commandActive = false;
listen(async command => {
  if (command.type === 'i2c-response') {
    const pending = awaitingI2c;
    if (pending?.commandId === command.id && pending.requestId === command.requestId) {
      awaitingI2c = null;
      pending.resolve(command.response);
    }
    return;
  }
  if (commandActive) {
    send({id: command.id, failure: 'STM32 worker is busy'});
    return;
  }
  commandActive = true;
  try {
    send({id: command.id, ...await dispatch(command)});
  } catch (cause) {
    send({id: command.id, failure: String(cause?.message || cause)});
  } finally {
    commandActive = false;
  }
});
