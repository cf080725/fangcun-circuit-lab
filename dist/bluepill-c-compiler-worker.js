import {createSession, setAssetLoader} from './vendor/bluepill-clang/bundle.js';
import {getStm32FirmwareTarget, parseStm32Bin} from './stm32-firmware-image.js';

const node = import.meta.url.startsWith('file:') && typeof process !== 'undefined' && !!process.versions?.node;
const parent = node ? (await import('node:worker_threads')).parentPort : null;
const vendor = new URL('./vendor/bluepill-clang/', import.meta.url);
const firmware = new URL('./firmware/', import.meta.url);
const linkerScripts = {
  bluepill: 'bluepill/stm32f103c8.ld',
  'nucleo-f103rb': 'nucleo-f103rb/stm32f103rb.ld',
};
const compressedAssets = {
  'llvm.core.wasm': 'llvm.core.gzip.bin',
  'llvm-resources.tar': 'llvm-freestanding-headers.gzip.bin',
};
const adapters = new Set(['llvm.core2.wasm', 'llvm.core3.wasm', 'llvm.core4.wasm']);
const target = ['--target=arm-none-eabi', '-mcpu=cortex-m3', '-mthumb', '--sysroot=/usr'];
const flags = ['-std=c11', '-Os', '-Wall', '-Wextra', '-ffreestanding', '-fno-unwind-tables',
  '-fno-asynchronous-unwind-tables', '-ffunction-sections', '-fdata-sections', '-fno-color-diagnostics', '-ferror-limit=24'];
const send = (message, transfer = []) => parent ? parent.postMessage(message, transfer) : postMessage(message, transfer);

async function localResponse(url) {
  if (node) {
    const {readFile} = await import('node:fs/promises');
    return new Response(await readFile(url));
  }
  const response = await fetch(url, {credentials: 'same-origin', redirect: 'error'});
  if (!response.ok) throw new Error(`${url.pathname.split('/').pop()} · HTTP ${response.status}`);
  return response;
}

setAssetLoader(async name => {
  if (!Object.hasOwn(compressedAssets, name) && !adapters.has(name)) throw new Error('Unknown compiler asset');
  const packed = compressedAssets[name];
  const response = await localResponse(new URL(packed ?? name, vendor));
  const body = packed ? response.body.pipeThrough(new DecompressionStream('gzip')) : response.body;
  return new Response(body, {headers: {'Content-Type': name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'}});
});

function diagnosticSourcePath(file, sourcePaths) {
  const path = file.replace(/^(?:\.\/|\/)?project\//, '');
  if (path.startsWith('/')) return null;
  // The packaged WASI filesystem ignores dot segments during traversal.
  const normalized = path.split('/').filter(segment => segment && segment !== '.' && segment !== '..').join('/');
  return sourcePaths.has(normalized) ? normalized : null;
}

function parseDiagnostics(text, sourcePaths) {
  const issues = [];
  for (const row of text.split(/\r?\n/)) {
    const location = /^(.*?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/.exec(row);
    if (location) {
      const [, file, line, column, severity, message] = location;
      const source = diagnosticSourcePath(file, sourcePaths);
      issues.push({file: source, line: source ? Number(line) : null, column: source ? Number(column) : null,
        severity: severity === 'fatal error' ? 'error' : severity, message});
    } else {
      const diagnostic = /^(?:[^:\n]+:\s+)?(fatal error|error|warning|note):\s+(.*)$/.exec(row);
      if (diagnostic) issues.push({file: null, line: null, column: null,
        severity: diagnostic[1] === 'fatal error' ? 'error' : diagnostic[1], message: diagnostic[2]});
    }
  }
  return issues;
}

async function compile({boardId, entries}) {
  const model = getStm32FirmwareTarget(boardId);
  if (!model || !Object.hasOwn(linkerScripts, boardId)) throw new Error('不支持该 STM32 编译目标。');
  const sourcePaths = new Set(entries.map(([path]) => path));
  const diagnostics = [];
  const session = createSession();
  async function tool(args, failure, binaryChunks) {
    let log = '';
    const decoder = new TextDecoder();
    const append = bytes => {
      if (bytes && log.length < 16_384) log += decoder.decode(bytes, {stream: true}).slice(0, 16_384 - log.length);
    };
    const code = await session.run(args, {
      stdout: binaryChunks ? bytes => { if (bytes) binaryChunks.push(bytes.slice()); } : append,
      stderr: append,
    });
    log += decoder.decode();
    const issues = parseDiagnostics(log, sourcePaths);
    diagnostics.push(...issues);
    if (code !== 0) {
      if (!issues.some(issue => issue.severity === 'error')) diagnostics.push({file: null, line: null, column: null,
        severity: 'error', message: log.trim() || failure});
      throw Object.assign(new Error(failure), {diagnostics});
    }
  }

  send({stage: 'loading'});
  const inputs = ['bluepill/startup.S', linkerScripts[boardId]];
  const [startup, linker] = await Promise.all(inputs.map(async name => (await localResponse(new URL(name, firmware))).text()));
  const project = Object.create(null);
  const includeDirs = new Set(['/project']);
  const sources = [];
  for (const [path, source] of entries) {
    const segments = path.split('/');
    const name = segments.pop();
    let directory = project;
    for (const segment of segments) directory = directory[segment] ??= Object.create(null);
    directory[name] = source;
    if (/\.c$/i.test(path)) sources.push('/project/' + path);
    else if (segments.length) includeDirs.add('/project/' + segments.join('/'));
  }
  await session.writeTree({project, build: {'startup.S': startup, 'target.ld': linker}});
  send({stage: 'compiling'});
  const include = [...includeDirs].sort().flatMap(path => ['-I', path]);
  const objects = [];
  for (const source of sources) {
    const object = '/build/unit-' + objects.length + '.o';
    await tool(['clang', ...target, ...flags, ...include, '-x', 'c', '-c', source, '-o', object], 'C 编译失败。');
    objects.push(object);
  }
  await tool(['clang', ...target, '-c', '/build/startup.S', '-o', '/build/startup.o'], 'STM32 启动文件编译失败。');

  send({stage: 'linking'});
  await tool(['ld.lld', '--gc-sections', '-z', 'noexecstack', '-T', '/build/target.ld', '/build/startup.o',
    ...objects, '-o', '/build/firmware.elf'], '固件链接失败。');

  send({stage: 'packaging'});
  const chunks = [];
  // The WASI build cannot rename objcopy's temporary file. Writing to stdout
  // directly retains the linked Flash load addresses, including .data's LMA.
  await tool(['llvm-objcopy', '-O', 'binary', '/build/firmware.elf', '-'], '无法导出固件 BIN。', chunks);
  const byteCount = chunks.reduce((count, chunk) => count + chunk.length, 0);
  if (byteCount > model.flashBytes) throw new Error(`编译后的固件超出 ${model.mcu} 的 ${model.flashBytes / 1024} KiB Flash。`);
  const binary = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    binary.set(chunk, offset);
    offset += chunk.length;
  }
  parseStm32Bin(binary, boardId);
  send({binary, diagnostics}, [binary.buffer]);
}

async function run(project) {
  try {
    await compile(project);
  } catch (error) {
    send({error: String(error?.message || error), diagnostics: error?.diagnostics ?? []});
  }
}

if (parent) parent.once('message', run);
else addEventListener('message', event => run(event.data), {once: true});
