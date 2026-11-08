import {getBoardProfile} from './board-profiles.js';
import {
  RP2040_FLASH_BASE, RP2040_FLASH_BYTES, RP2040_SRAM_BASE, RP2040_SRAM_BYTES, RP2040_VECTOR_OFFSET,
} from './rp2040-firmware-image.js';

const WORKER_URL = new URL('./vendor/rp2040js/worker.js?v=08.7', import.meta.url);
const INIT_TIMEOUT = 15_000;
const COMMAND_TIMEOUT = 700;
const MAX_RX_BYTES = 1024;
const UART = 'UART0';
const CAPABILITIES = Object.freeze({
  execution: 'RP2040 · Cortex-M0+ Thumb',
  emulator: 'Wokwi rp2040js 1.4.1',
  binaryFirmware: true,
  instructionAccurate: true,
  cycleAccurate: false,
  flashBytes: RP2040_FLASH_BYTES,
  sramBytes: RP2040_SRAM_BYTES,
  digitalIO: true,
  analogInput: true,
  adcBits: 12,
  pwm: true,
  serialConsole: true,
  serialPorts: Object.freeze([UART]),
  serialPinWaveforms: false,
  sourceDebugging: false,
  note: '从 Pico 的 XIP 应用向量执行单核 Thumb 固件，接入 GPIO、基础定时、GP26–GP28 的 12 位 ADC、自由运行边沿对齐 PWM 和 UART0 字节终端。ADC 采用标称 3.3 V 参考，电路输入按运行切片采样。',
});

function prepare(flash) {
  const vector = RP2040_VECTOR_OFFSET;
  if (!(flash instanceof Uint8Array) || flash.length < vector + 10 || flash.length > RP2040_FLASH_BYTES) {
    throw new RangeError('Pico 固件必须包含 XIP 应用复位向量，且在 2 MiB Flash 范围内。');
  }
  const image = new Uint8Array(flash);
  const view = new DataView(image.buffer);
  const initialStack = view.getUint32(vector, true);
  const resetVector = view.getUint32(vector + 4, true);
  const resetAddress = (resetVector & ~1) >>> 0;
  const offset = resetAddress - RP2040_FLASH_BASE;
  if (initialStack < RP2040_SRAM_BASE || initialStack > RP2040_SRAM_BASE + RP2040_SRAM_BYTES || (initialStack & 3)
    || !(resetVector & 1) || offset < vector + 8 || offset + 2 > image.length || view.getUint16(offset, true) === 0xffff) {
    throw new RangeError('Pico 应用的初始栈、Thumb 入口或入口指令无效。');
  }
  return {flash: image, initialStack, resetAddress};
}

function workerFactory() {
  if (WORKER_URL.protocol === 'file:' && typeof process !== 'undefined' && process.versions?.node) {
    return import('node:worker_threads').then(({Worker}) => () => new Worker(WORKER_URL, {execArgv: []}));
  }
  return Promise.resolve(() => new Worker(WORKER_URL, {type: 'module'}));
}

/**
 * Each Pico runs in a terminable local worker. Commands are asynchronous,
 * and getState() exposes the most recent completed circuit snapshot.
 */
export async function createRp2040FirmwareRuntime({flash}, {readInputs, readAnalog, onSerial} = {}) {
  const image = prepare(flash);
  const profile = getBoardProfile('pico');
  const pins = profile.gpioPins.map(name => ({name, index: Number(name.slice(2))}));
  const createWorker = await workerFactory();
  let worker, active, state, queue = Promise.resolve(), disposed = false, id = 0, inputs = {};

  function stop(cause) {
    if (worker) {
      worker.terminate();
      worker = undefined;
    }
    if (active) {
      const {reject, timer} = active;
      active = undefined;
      clearTimeout(timer);
      reject(cause);
    }
  }

  function open() {
    const target = createWorker();
    const receive = message => {
      if (worker !== target || active?.id !== message.id) return;
      const {resolve, reject, timer} = active;
      active = undefined;
      clearTimeout(timer);
      if (message.failure) reject(new Error(message.failure));
      else resolve(message);
    };
    const fail = event => {
      if (worker === target) stop(new Error(event?.message || '无法运行 RP2040 固件线程。'));
    };
    if (typeof target.on === 'function') {
      target.on('message', receive);
      target.on('error', fail);
      target.on('exit', fail);
    } else {
      target.addEventListener('message', event => receive(event.data));
      target.addEventListener('error', fail);
      target.addEventListener('messageerror', fail);
    }
    worker = target;
  }

  function exchange(command, timeout = COMMAND_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const commandId = ++id;
      const timer = setTimeout(() => {
        const error = new Error('原生固件运行超时，已停止 RP2040 仿真线程。');
        error.code = 'RP2040_WORKER_TIMEOUT';
        stop(error);
      }, timeout);
      active = {id: commandId, timer, resolve, reject};
      try {
        worker.postMessage({...command, id: commandId});
      } catch (cause) {
        stop(cause);
      }
    });
  }

  function apply(message) {
    state = {...message.state, capabilities: CAPABILITIES};
    if (message.tx) onSerial?.(message.tx, UART);
    return state;
  }

  async function initialize() {
    open();
    return apply(await exchange({type: 'init', ...image, pins}, INIT_TIMEOUT));
  }

  function enqueue(action) {
    queue = queue.then(async () => {
      if (disposed) return state;
      try {
        return await action();
      } catch (cause) {
        if (disposed) return state;
        const error = {
          severity: 'error', code: cause?.code || 'RP2040_WORKER_ERROR',
          plain: cause?.code === 'RP2040_WORKER_TIMEOUT' ? cause.message : '原生固件线程无法继续运行。',
          technical: String(cause?.message || cause), fix: '点击复位后重试，或检查固件是否依赖当前未接入的硬件功能。',
        };
        stop(cause);
        state = {...state, status: 'error', error, diagnostics: [error], done: true, steps: 0};
        return state;
      }
    });
    return queue;
  }

  function run(command) {
    return enqueue(async () => {
      if (!worker || state.done) return {...state, steps: 0};
      const levels = {...readInputs?.(state), ...inputs};
      const analogInputs = readAnalog && Object.fromEntries(profile.analogPins.map(pin => [pin, readAnalog(pin, state)]));
      return apply(await exchange({type: 'run', ...command, inputs: levels, analogInputs}));
    });
  }

  function step(count = 1) {
    return run({count: Math.max(1, Math.min(20_000, Math.floor(Number(count) || 1)))});
  }

  function advanceTime(ms) {
    const amount = Number(ms);
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('运行时间必须是有限的非负毫秒数。');
    return run({ms: amount});
  }

  function reset() {
    return enqueue(async () => {
      inputs = {};
      return worker ? apply(await exchange({type: 'reset'})) : initialize();
    });
  }

  function injectSerial(text, port = UART) {
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text.slice(0, MAX_RX_BYTES))
      : text instanceof Uint8Array ? text.slice(0, MAX_RX_BYTES) : new Uint8Array();
    return enqueue(async () => {
      if (port !== UART || !worker || state.done) return state;
      return apply(await exchange({type: 'serial', bytes: bytes.subarray(0, MAX_RX_BYTES)}));
    });
  }

  function dispose() {
    disposed = true;
    stop(new Error('原生固件线程已关闭。'));
    if (state) state = {...state, status: 'disposed', done: true};
  }

  try {
    await initialize();
  } catch (cause) {
    dispose();
    throw cause;
  }
  return {
    step, advanceTime, reset, injectSerial, dispose, getState: () => state,
    setDigitalInputs: levels => { inputs = {...levels}; },
    capabilities: CAPABILITIES,
  };
}
