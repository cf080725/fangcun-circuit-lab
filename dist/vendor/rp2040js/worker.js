// Local Pico board driver for Wokwi rp2040js 1.4.1.
import {RP2040, SimulationClock, FUNCTION_SIO} from './core.js';
import {installRp2040Adc, rp2040AdcClockHz} from '../../rp2040-adc.js';
import {readRp2040Pwm, RP2040_FUNCTION_PWM} from '../../rp2040-pwm.js';
import {
  RP2040_FLASH_BASE, RP2040_FLASH_BYTES, RP2040_SRAM_BASE, RP2040_SRAM_BYTES, RP2040_VECTOR_OFFSET,
} from '../../rp2040-firmware-image.js';

const node = import.meta.url.startsWith('file:') && typeof process !== 'undefined' && !!process.versions?.node;
const parent = node ? (await import('node:worker_threads')).parentPort : null;
const listen = parent ? handler => parent.on('message', handler) : handler => addEventListener('message', event => handler(event.data));
const send = parent ? data => parent.postMessage(data) : data => postMessage(data);

const NS_PER_MS = 1e6;
const NS_PER_S = 1e9;
const WALL_MS = 24;
const MAX_SIM_MS = 20;
const MAX_SERIAL = 50_000;
const MAX_RX = 1_024;
const UART_RX_FULL = 1 << 6;
const GPIO_OUT = 'GPIO_Mode_Out_PP';
const GPIO_FLOAT = 'GPIO_Mode_IN_FLOATING';
const FUNCTION_NULL = 31;

let flash, initialStack, resetAddress, pins, rp, clock;
let inputLevels, idleCycles, stepsTotal, status, error, serial, tx, rx;
let adcBridge, analogVoltages;

function fail(code, plain, technical, fix) {
  status = 'error';
  error = {severity: 'error', code, plain, technical, fix};
}

function drives(pin) {
  return (pin.functionSelect === FUNCTION_SIO || pin.functionSelect === RP2040_FUNCTION_PWM)
    && pin.outputEnable && !pin.outputDisable;
}

function applyPin(name, pin) {
  const external = inputLevels[name];
  const wired = external === 0 || external === 1 || typeof external === 'boolean';
  const level = drives(pin) ? pin.outputValue
    : wired ? Boolean(external)
      : pin.pullupEnabled ? !pin.pulldownEnabled || pin.rawInputValue : false;
  if (pin.rawInputValue !== level) pin.setInputValue(level);
}

function applyInputs(next = {}) {
  inputLevels = next;
  for (const {name, index} of pins) applyPin(name, rp.gpio[index]);
}

function portState() {
  const uart = rp.uart[0];
  return {
    enabled: uart.enabled,
    rxEnabled: uart.enabled && uart.rxEnabled,
    txEnabled: uart.enabled && uart.txEnabled,
    baudRate: uart.baudDivider ? uart.baudRate : null,
  };
}

function state(steps = 0, budgetReached = false) {
  const adc = adcBridge.getState();
  const diagnostics = [error, adc.error].filter(Boolean);
  return {
    boardId: 'pico', dialect: 'rp2040-firmware', timeMs: clock.nanos / NS_PER_MS,
    cycles: rp.core.cycles + Math.round(idleCycles), executedSteps: stepsTotal,
    coreClockHz: rp.clkSys, logicVoltage: 3.3, adcMax: 4095, steps, budgetReached,
    pc: {byteAddress: rp.core.PC >>> 0}, serial, console: serial, variables: {}, adc: {ADC0: adc},
    pins: Object.fromEntries(pins.map(({name, index}) => {
      const pin = rp.gpio[index];
      const driven = drives(pin);
      const pwmMux = pin.functionSelect === RP2040_FUNCTION_PWM;
      const pwm = pwmMux && driven ? readRp2040Pwm(rp, index) : undefined;
      const output = driven && (!pwmMux || Boolean(pwm));
      const analog = index >= 26 && index <= 28 && pin.functionSelect === FUNCTION_NULL
        && !pin.inputEnable && !pin.pullupEnabled && !pin.pulldownEnabled;
      const up = !driven && pin.pullupEnabled && !pin.pulldownEnabled;
      const down = !driven && pin.pulldownEnabled && !pin.pullupEnabled;
      const mode = output ? (pwmMux ? 'GPIO_Mode_AF_PP' : GPIO_OUT)
        : pwmMux && driven ? 'GPIO_Mode_AF_UNMODELED'
        : analog ? 'GPIO_Mode_AIN' : up ? 'GPIO_Mode_IPU' : down ? 'GPIO_Mode_IPD' : GPIO_FLOAT;
      return [name, {
        mode,
        level: output ? Number(pin.outputValue) : Number(pin.inputValue),
        output: output ? Number(pin.outputValue) : 0,
        pull: up ? 'up' : down ? 'down' : null,
        configured: pin.functionSelect === FUNCTION_SIO || pwmMux || analog,
        clock: true,
        ...(pwm && {pwm}),
      }];
    })),
    uarts: {UART0: portState()}, status, error, diagnostics,
    done: status === 'completed' || status === 'error',
  };
}

function reset() {
  clock = new SimulationClock();
  rp = new RP2040(clock);
  analogVoltages = {};
  adcBridge = installRp2040Adc({
    adc: rp.adc, clock,
    readVoltage: pin => analogVoltages[pin],
    readReference: () => 3.3,
    clockHz: () => rp2040AdcClockHz(rp),
  });
  // Direct application startup: the XIP flash image is already accessible.
  rp.flash.set(flash);
  rp.core.VTOR = RP2040_FLASH_BASE + RP2040_VECTOR_OFFSET;
  rp.core.SP = initialStack;
  rp.core.PC = resetAddress;
  rp.logger = {
    debug() {}, info() {},
    warn(_component, message) {
      if (message.startsWith('Warning: Instruction at')) {
        fail('RP2040_CPU_INSTRUCTION', '处理器遇到未实现的 Thumb 指令。', message,
          '检查固件是否为 RP2040 Cortex-M0+ 编译，并检查当前代码路径。');
      }
    },
    error(component, message) { throw new Error(component + ': ' + message); },
  };
  rp.onBreak = code => {
    const opcode = rp.readUint16((rp.core.PC - 2) >>> 0);
    if ((opcode & 0xff00) === 0xbe00) status = 'completed';
    else fail('RP2040_CPU_EXCEPTION', '固件触发了未定义指令或异常。', '异常码 0x' + code.toString(16),
      '检查 RP2040 构建目标、异常处理程序和当前指令。');
  };
  rp.peripherals[0x40058].onWatchdogTrigger = () => {
    fail('RP2040_RESET_REQUESTED', '固件请求了硬件复位，仿真已暂停。', 'WATCHDOG',
      '点击复位重新从应用入口开始。');
  };
  inputLevels = {};
  idleCycles = 0;
  stepsTotal = 0;
  status = 'ready';
  error = null;
  serial = '';
  tx = '';
  rx = [];
  for (const {name, index} of pins) {
    const pin = rp.gpio[index];
    pin.addListener(() => applyPin(name, pin));
  }
  rp.uart[0].onByte = byte => {
    if (rp.uart[0].enabled && rp.uart[0].txEnabled) tx = (tx + String.fromCharCode(byte)).slice(-MAX_SERIAL);
  };
  applyInputs();
  return state();
}

function feedSerial() {
  const uart = rp.uart[0];
  if (!uart.enabled || !uart.rxEnabled) return;
  while (rx.length && !(uart.flags & UART_RX_FULL)) uart.feedByte(rx.shift());
}

function validPc(address) {
  const offset = address - RP2040_FLASH_BASE;
  return (offset >= 0 && offset < 4 * 0x1000000 && (offset & 0xffffff) < RP2040_FLASH_BYTES)
    || (address >= RP2040_SRAM_BASE && address < RP2040_SRAM_BASE + RP2040_SRAM_BYTES);
}

function run({count, ms, inputs, analogInputs}) {
  if (status === 'error' || status === 'completed' || ms === 0) return {state: state()};
  status = 'running';
  tx = '';
  analogVoltages = analogInputs ?? {};
  applyInputs(inputs);
  feedSerial();
  const deadline = performance.now() + WALL_MS;
  const manual = count != null;
  const target = clock.nanos + Math.min(ms ?? 0, MAX_SIM_MS) * NS_PER_MS;
  let steps = 0, iterations = 0, budgetReached = ms > MAX_SIM_MS;
  while (status === 'running' && (manual ? steps < count : clock.nanos < target)) {
    const hz = rp.clkSys;
    if (!Number.isFinite(hz) || hz <= 0) {
      fail('RP2040_CLOCK', 'CPU 时钟无法继续推进。', 'clk_sys ' + hz,
        '检查固件的时钟源和分频设置，或点击复位。');
      break;
    }
    if (rp.core.waiting) {
      if (manual) {
        status = 'waiting';
        break;
      }
      const remaining = target - clock.nanos;
      const delta = clock.nextAlarm ? Math.min(remaining, Math.max(0, clock.nanosToNextAlarm)) : remaining;
      clock.tick(delta);
      idleCycles += delta * hz / NS_PER_S;
    } else {
      const pc = rp.core.PC >>> 0;
      if (!validPc(pc)) {
        fail('RP2040_PC_RANGE', '程序跳到了当前仿真未提供的执行区域。', 'PC 0x' + pc.toString(16),
          '检查 RP2040 链接地址。当前模式从 XIP 应用向量启动，芯片 ROM 函数和自定义引导流程未接入。');
        break;
      }
      const cycles = rp.core.executeInstruction();
      clock.tick(cycles * NS_PER_S / hz);
      steps++;
      stepsTotal++;
    }
    if ((++iterations & 255) === 0) {
      feedSerial();
      if (performance.now() >= deadline) {
        budgetReached ||= manual ? steps < count : clock.nanos < target;
        break;
      }
    }
  }
  if (tx) serial = (serial + tx).slice(-MAX_SERIAL);
  return {state: state(steps, budgetReached), tx};
}

function dispatch(command) {
  if (command.type === 'init') {
    ({flash, initialStack, resetAddress, pins} = command);
    return {state: reset()};
  }
  if (command.type === 'reset') return {state: reset()};
  if (command.type === 'run') return run(command);
  if (command.type === 'serial') {
    if (portState().rxEnabled) {
      for (const byte of command.bytes.subarray(0, MAX_RX - rx.length)) rx.push(byte);
      feedSerial();
    }
    return {state: state()};
  }
  throw new Error('Unknown RP2040 worker command');
}

listen(command => {
  try {
    send({id: command.id, ...dispatch(command)});
  } catch (cause) {
    send({id: command.id, failure: String(cause?.message || cause)});
  }
});
