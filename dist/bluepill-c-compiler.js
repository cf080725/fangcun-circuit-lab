import {sourcePath} from './project-import.js';
import {getStm32FirmwareTarget} from './stm32-firmware-image.js';

const workerUrl = new URL('./bluepill-c-compiler-worker.js?v=10.25.0', import.meta.url);
const MAX_FILES = 24;
const MAX_SOURCE_BYTES = 128 * 1024;
const MAX_PROJECT_BYTES = 512 * 1024;
const TIMEOUT_MS = 120_000;

function aborted(signal) {
  return signal.reason ?? new DOMException('已取消编译。', 'AbortError');
}

function validateProject(files) {
  const type = files && Object.getPrototypeOf(files);
  if (!files || (type !== Object.prototype && type !== null)) throw new Error('请选择 C 工程源码。');
  const entries = Object.entries(files);
  if (entries.length > MAX_FILES) throw new Error('本地编译支持最多 24 个 .c/.h 文件。');
  const paths = new Map();
  const utf8 = new TextEncoder();
  let total = 0, hasSource = false;
  for (const [path, source] of entries) {
    if (!/\.(c|h)$/i.test(path) || sourcePath(path) !== path) throw new Error('本地编译需要规范的 .c/.h 相对路径：' + path);
    const segments = path.split('/');
    let prefix = '';
    for (const [index, segment] of segments.entries()) {
      if (Object.hasOwn(Object.prototype, segment)) throw new Error('工程路径使用了保留名称：' + path);
      prefix += (index ? '/' : '') + segment;
      const directory = index < segments.length - 1;
      const key = prefix.toLowerCase();
      const previous = paths.get(key);
      if (previous && (prefix !== previous.prefix || !directory || !previous.directory)) {
        throw new Error('工程文件或目录路径冲突：' + path);
      }
      paths.set(key, {prefix, directory});
    }
    if (typeof source !== 'string' || source.includes('\0')) throw new Error('工程文件须为纯文本：' + path);
    if (source.length > MAX_SOURCE_BYTES) throw new Error('单份 C/H 源码最大 128 KiB：' + path);
    const bytes = utf8.encode(source).length;
    if (bytes > MAX_SOURCE_BYTES) throw new Error('单份 C/H 源码最大 128 KiB：' + path);
    total += bytes;
    if (total > MAX_PROJECT_BYTES) throw new Error('C 工程源码合计最大 512 KiB。');
    hasSource ||= /\.c$/i.test(path) && Boolean(source.trim());
  }
  if (!hasSource) throw new Error('请输入要编译的 C 源码。工程至少需要一个非空的 .c 文件。');
  return entries;
}

/** Compile one freestanding C11 file into a validated STM32F103C8T6 BIN. */
export function compileBluePillC(source, options) {
  return compileStm32C({'main.c': source}, {...options, boardId: 'bluepill'});
}

/** Compile the supplied freestanding C11 project for one of the STM32F103 boards. */
export async function compileStm32C(files, {boardId = 'bluepill', signal, onProgress} = {}) {
  if (signal?.aborted) throw aborted(signal);
  if (!getStm32FirmwareTarget(boardId)) throw new Error('本地 C 编译支持 Blue Pill 和 NUCLEO-F103RB。');
  const entries = validateProject(files);

  const node = workerUrl.protocol === 'file:' && typeof process !== 'undefined' && !!process.versions?.node;
  const WorkerType = node ? (await import('node:worker_threads')).Worker : globalThis.Worker;
  if (signal?.aborted) throw aborted(signal);
  if (!WorkerType || typeof WebAssembly === 'undefined' || typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器缺少本地 C 编译所需的 Worker、WebAssembly 或解压功能。');
  }

  const worker = new WorkerType(workerUrl, node ? {execArgv: []} : {type: 'module'});
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => finish(reject, aborted(signal));
    const timeout = setTimeout(() => finish(reject, new Error('本地 C 编译超时，可重新尝试。')), TIMEOUT_MS);

    function finish(settle, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      settle(value);
    }

    function receive(data) {
      if (settled) return;
      if (data.stage) {
        try { onProgress?.(data.stage); }
        catch (error) { finish(reject, error); }
      } else if (data.error) {
        finish(reject, Object.assign(new Error(data.error), {diagnostics: data.diagnostics}));
      } else if (data.binary instanceof Uint8Array) {
        finish(resolve, {binary: data.binary, diagnostics: data.diagnostics});
      }
    }

    function workerFailure(error) {
      finish(reject, new Error('无法运行本地 C 编译器。' + (error?.message ? ` ${error.message}` : '')));
    }

    if (node) {
      worker.on('message', receive);
      worker.on('error', workerFailure);
      worker.on('messageerror', workerFailure);
      worker.on('exit', code => workerFailure(new Error(`Worker ${code}`)));
    } else {
      worker.onmessage = event => receive(event.data);
      worker.onerror = worker.onmessageerror = workerFailure;
    }
    signal?.addEventListener('abort', abort, {once: true});
    try { worker.postMessage({boardId, entries}); }
    catch (error) { workerFailure(error); }
  });
}
