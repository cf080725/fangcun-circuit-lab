import assert from 'node:assert/strict';
import test from 'node:test';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {parseStm32Bin, STM32_FLASH_BYTES} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

const main = 'int main(void) { return 0; }';

test('project validation rejects unsupported inputs before starting the compiler worker', async () => {
  const paths = ['../entry.c', '/entry.c', 'lib\\entry.c', '__proto__/entry.c', 'toString/entry.c', 'app.cpp'];
  for (const path of paths) await assert.rejects(compileStm32C({[path]: main}), /路径|保留名称/);
  await assert.rejects(compileStm32C({'src/entry.c': main, 'Src/toggle.h': ''}), /路径冲突/);
  await assert.rejects(compileStm32C({'main.c': main, 'main.c/header.h': ''}), /路径冲突/);
  await assert.rejects(compileStm32C({'only.h': ''}), /非空的 .c/);
  await assert.rejects(compileStm32C({'main.c': main + '\0'}), /纯文本/);
  await assert.rejects(compileStm32C({'main.c': main}, {boardId: 'nucleo-f401re'}), /NUCLEO-F103RB/);
  const header = '测'.repeat(44_000);
  await assert.rejects(compileStm32C({'main.c': main, 'header.h': header}), /128 KiB/);
  await assert.rejects(compileStm32C({'main.c': main, ...Object.fromEntries(
    Array.from({length: 24}, (_, index) => [`header${index}.h`, '']))}), /最多 24/);
  const bigHeader = ' '.repeat(128 * 1024);
  await assert.rejects(compileStm32C({'main.c': main, 'a.h': bigHeader, 'b.h': bigHeader, 'c.h': bigHeader, 'd.h': bigHeader}), /512 KiB/);
});

test('header compiler diagnostics use the canonical project filename and source position', async () => {
  await assert.rejects(compileStm32C({
    'src/-entry.C': '#include "../包含文件/./my value.h"\nint main(void) { return value(); }',
    '包含文件/my value.h': 'static int value(void) { return UNDECLARED; }',
  }), error => error.diagnostics?.some(issue =>
    issue.file === '包含文件/my value.h' && issue.line === 1 && issue.column === 33 &&
    issue.severity === 'error' && /undeclared identifier/.test(issue.message)));
});

test('fresh workers are cancellable during startup and leave a later project build independent', async () => {
  const controller = new AbortController();
  const stages = [];
  await assert.rejects(compileStm32C({'main.c': main}, {
    signal: controller.signal,
    onProgress(stage) { stages.push(stage); controller.abort(); },
  }), {name: 'AbortError'});
  assert.deepEqual(stages, ['loading']);
  const {binary} = await compileStm32C({'main.c': main});
  assert.equal(parseStm32Bin(binary, 'bluepill').initialStack, 0x20005000);
});

test('linked nested C units with equal basenames boot above Blue Pill capacity on NUCLEO-F103RB', async t => {
  const files = {
    'app/main.c': `#include "values.h"
#define REG(addr) (*(volatile uint32_t *)(addr))
int main(void) {
  REG(0x40021018) |= 4u;
  REG(0x40010800) = (REG(0x40010800) & ~(15u << 20)) | (2u << 20);
  REG(0x40010810) = last_value() == expected_value() ? (1u << 5) : (1u << 21);
  for (;;) {}
}`,
    'common/helper.c': `#include "values.h"
const uint8_t values[70u * 1024u] = {[70u * 1024u - 1u] = 0xa5};
uint8_t last_value(void) {
  return *(volatile const uint8_t *)(values + sizeof(values) - 1u);
}`,
    'nucleo/helper.c': '#include "values.h"\nuint8_t expected_value(void) { return 0xa5; }',
    'include/values.h': '#include <stdint.h>\nuint8_t last_value(void);\nuint8_t expected_value(void);',
  };
  const boardId = 'nucleo-f103rb';
  const stages = [];
  const {binary, diagnostics} = await compileStm32C(files, {boardId, onProgress: stage => stages.push(stage)});
  assert.deepEqual(stages, ['loading', 'compiling', 'linking', 'packaging']);
  assert.deepEqual(diagnostics, []);
  assert.ok(binary.byteLength > STM32_FLASH_BYTES);
  const image = parseStm32Bin(binary, boardId);
  assert.equal(image.initialStack, 0x20005000);
  const runtime = await createStm32FirmwareRuntime(image, {boardId});
  t.after(() => runtime.dispose());
  const state = await runtime.advanceTime(1);
  assert.equal(state.error, null);
  assert.equal(state.pins.PA5.level, 1);
  await assert.rejects(compileStm32C(files, {boardId: 'bluepill'}), error => error.diagnostics?.some(issue =>
    issue.file === null && issue.severity === 'error' && /FLASH.*overflow/i.test(issue.message)));
});
