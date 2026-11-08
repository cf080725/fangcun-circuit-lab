import {getBoardProfile} from './board-profiles.js';
import {getStm32FirmwareTarget, parseStm32Bin} from './stm32-firmware-image.js';

const WORKER_URL = new URL('./vendor/stm32f1-emu/worker.js?v=10.33.0', import.meta.url);
const INIT_TIMEOUT_MS = 20_000;
const COMMAND_TIMEOUT_MS = 700;
const MAX_RX_BYTES = 1024;
const CAPABILITIES = {
  emulator: 'stm32f1-emu 3.3.0',
  binaryFirmware: true,
  instructionAccurate: true,
  cycleAccurate: false,
  digitalIO: true,
  analogInput: true,
  pwm: true,
  serialConsole: true,
  serialPinWaveforms: false,
  i2cMaster: true,
  sourceDebugging: false,
};

function namedPins(names) {
  return names.map(name => ({name, port: name.charCodeAt(1) - 65, pin: Number(name.slice(2))}));
}

function workerFactory() {
  if (WORKER_URL.protocol === 'file:' && typeof process !== 'undefined' && process.versions?.node) {
    return import('node:worker_threads').then(({Worker}) => () => new Worker(WORKER_URL, {execArgv: []}));
  }
  return Promise.resolve(() => new Worker(WORKER_URL, {type: 'module'}));
}

function isBusByte(value) {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function serviceI2cRequest(request, hooks, boardId, lastTime) {
  const {operation,address,direction,bytes,quantity,offset,state,meta} = request;
  if (!Number.isInteger(address) || address < 0 || address > 127 || state?.boardId !== boardId ||
    !Number.isFinite(state.timeMs) || state.timeMs < 0 || !state.pins || typeof state.pins !== 'object' || Array.isArray(state.pins)) {
    return {status:4,reason:'invalid-bus-request'};
  }
  if (state.timeMs < lastTime) return {status:4,reason:'stale-state'};
  const options = {stop:meta?.stop===true,repeatedStart:meta?.repeatedStart===true};
  let hook, args;
  if (operation === 'address' && (direction === 'read' || direction === 'write')) {
    hook = hooks.i2cAddress;
    args = [address,direction,state,options];
  } else if (operation === 'write' && Array.isArray(bytes) && bytes.length <= 4096 && Array.from(bytes).every(isBusByte)) {
    hook = hooks.writeI2c;
    args = [address,bytes,state,options];
  } else if (operation === 'read' && Number.isInteger(quantity) && quantity >= 1 && quantity <= 32 &&
    Number.isInteger(offset) && offset >= 0 && offset < 32) {
    hook = hooks.readI2c;
    args = [address,quantity,state,{...options,offset,...(typeof meta?.ack==='boolean'&&{ack:meta.ack})}];
  } else return {status:4,reason:'invalid-bus-request'};
  if (!hook) return {status:2,reason:'address-nack'};

  try {
    const response = hook(...args);
    const status = response?.status;
    if (!Number.isInteger(status) || status < 0 || status > 4 ||
      (operation==='read' && !status && (!Array.isArray(response.bytes) ||
        response.bytes.length>quantity || !Array.from(response.bytes).every(isBusByte)))) {
      return {status:4,reason:'invalid-bus-result'};
    }
    return {status,...(typeof response.reason==='string'&&{reason:response.reason}),
      ...(typeof response.deviceId==='string'&&{deviceId:response.deviceId}),
      ...(operation==='read'&&!status&&{bytes:response.bytes})};
  } catch {
    return {status:4,reason:'hook-error'};
  }
}

/**
 * The local worker can be terminated even if an uploaded program stalls a
 * vendor interrupt handler. getState() returns the last completed snapshot.
 */
export async function createStm32FirmwareRuntime({flash}, {
  boardId = 'bluepill', readInputs, readAnalog, onSerial, i2cAddress, writeI2c, readI2c
} = {}) {
  const image = parseStm32Bin(flash, boardId);
  const target = getStm32FirmwareTarget(boardId);
  const {mcu, flashBytes, sramBytes, serialPorts} = target;
  const port = serialPorts[0];
  const capabilities = Object.freeze({
    ...CAPABILITIES, execution: mcu + ' · Cortex-M3 Thumb/Thumb-2', flashBytes, sramBytes, serialPorts,
    note: '支持基础 GPIO、ADC1 软件启动单通道转换、TIM2–4 基础 PWM、SysTick 中断和 ' + serialPorts.join('、') +
      ' 字节终端。I²C1 支持默认 PB6/SCL、PB7/SDA 的 3.3 V 七位主机轮询。PWM 联动要求 APB1 分频为 ÷1 或 ÷2。ADC 扫描、外部触发、I²C 重映射、从机、中断、DMA 和 USB 超出当前联动范围。',
  });
  const profile = getBoardProfile(boardId);
  const gpio = namedPins(profile.gpioPins);
  const analog = namedPins(profile.analogPins);
  const i2cHooks = {i2cAddress,writeI2c,readI2c};
  const createWorker = await workerFactory();
  let worker, active, state, queued = Promise.resolve(), disposed = false, id = 0, manualInputs = {};

  function stopWorker(cause) {
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

  function openWorker() {
    const target = createWorker();
    const receive = data => {
      const command = active;
      if (worker !== target || !command || command.id !== data?.id) return;
      if (Object.hasOwn(data,'i2c')) {
        const request = data.i2c;
        if (command.type !== 'run' || !Number.isSafeInteger(request?.id) || request.id <= command.lastI2cRequest) return;
        command.lastI2cRequest = request.id;
        const response = serviceI2cRequest(request,i2cHooks,boardId,command.i2cTime);
        if (response.reason!=='invalid-bus-request' && Number.isFinite(request.state?.timeMs)) {
          command.i2cTime = Math.max(command.i2cTime,request.state.timeMs);
        }
        // A bus callback may dispose the runtime. An old worker must
        // never receive a reply or complete the queued command afterward.
        if (worker === target && active === command) {
          try { target.postMessage({type:'i2c-response',id:command.id,requestId:request.id,response}); }
          catch (cause) { stopWorker(cause); }
        }
        return;
      }
      const {resolve, reject, timer} = command;
      active = undefined;
      clearTimeout(timer);
      if (data.failure) reject(new Error(data.failure));
      else resolve(data);
    };
    const fail = event => {
      if (worker === target) stopWorker(new Error(event?.message || '无法运行 STM32 固件线程。'));
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

  function exchange(command, timeout) {
    return new Promise((resolve, reject) => {
      const commandId = ++id;
      const timer = setTimeout(() => {
        const error = new Error('原生固件运行超时，已停止仿真线程。');
        error.code = 'STM32_WORKER_TIMEOUT';
        stopWorker(error);
      }, timeout);
      active = {id:commandId,type:command.type,timer,resolve,reject,lastI2cRequest:-1,i2cTime:state?.timeMs??0};
      try {
        worker.postMessage({...command, id: commandId});
      } catch (cause) {
        stopWorker(cause);
      }
    });
  }

  function apply(response) {
    state = {...response.state, capabilities};
    for (const [name, text] of Object.entries(response.tx ?? {})) onSerial?.(text, name);
    return state;
  }

  async function initialize() {
    openWorker();
    return apply(await exchange({
      type: 'init', flash: image.flash, initialStack: image.initialStack,
      resetVector: image.resetAddress | 1, gpio, analog, boardId,
    }, INIT_TIMEOUT_MS));
  }

  function queue(action) {
    const task = queued.then(async () => {
      if (disposed) return state;
      try {
        return await action();
      } catch (cause) {
        if (disposed) return state;
        const error = {
          severity: 'error', code: cause?.code || 'STM32_WORKER_ERROR',
          plain: cause?.code === 'STM32_WORKER_TIMEOUT' ? cause.message : '原生固件线程无法继续运行。',
          technical: String(cause?.message || cause), fix: '点击复位重新运行，或检查固件中的中断与等待循环。',
        };
        stopWorker(cause);
        state = {...state, status: 'error', error, diagnostics: [error], done: true, steps: 0};
        return state;
      }
    });
    queued = task;
    return task;
  }

  function run(command) {
    return queue(async () => {
      if (!worker || state.done) return state;
      const inputs = {...readInputs?.(state), ...manualInputs};
      const analogInputs = readAnalog && Object.fromEntries(analog
        .map(({name}) => [name, readAnalog(name, state)]));
      return apply(await exchange({type: 'run', ...command, inputs, analogInputs}, COMMAND_TIMEOUT_MS));
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
    return queue(async () => {
      manualInputs = {};
      return worker ? apply(await exchange({type: 'reset'}, COMMAND_TIMEOUT_MS)) : initialize();
    });
  }

  function injectSerial(text, name = port) {
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text.slice(0, MAX_RX_BYTES))
      : text instanceof Uint8Array ? text : new Uint8Array();
    return queue(async () => {
      if (!serialPorts.includes(name) || !worker || state.done) return state;
      return apply(await exchange({type: 'serial', port: name, bytes: bytes.slice(0, MAX_RX_BYTES)}, COMMAND_TIMEOUT_MS));
    });
  }

  function dispose() {
    disposed = true;
    stopWorker(new Error('原生固件线程已关闭。'));
    if (state) state = {...state, status: 'disposed', done: true};
  }

  try {
    await initialize();
  } catch (cause) {
    dispose();
    throw cause;
  }
  return {
    step, advanceTime, reset, injectSerial, dispose,
    getState: () => state,
    setDigitalInputs: levels => { manualInputs = {...levels}; },
    capabilities,
  };
}
