import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STM32_FLASH_BASE, STM32_FLASH_BYTES, STM32_HEX_MAX_CHARS, STM32_SRAM_BASE, STM32_SRAM_BYTES,
  getStm32FirmwareTarget, parseStm32Bin, parseStm32Hex, stm32BinToHex
} from '../dist/stm32-firmware-image.js';

const RESET_OFFSET = 0x100;
const SRAM_TOP = STM32_SRAM_BASE + STM32_SRAM_BYTES;
const flashBase = ':020000040800F2';
const eof = ':00000001FF';

function record(type, offset, data = []) {
  const bytes = [data.length, offset >> 8, offset & 0xff, type, ...data];
  const checksum = -bytes.reduce((sum, byte) => sum + byte, 0) & 0xff;
  return ':' + [...bytes, checksum].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function vectorBytes(stack = SRAM_TOP, reset = STM32_FLASH_BASE + RESET_OFFSET + 1) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, stack, true);
  view.setUint32(4, reset, true);
  return bytes;
}

function hexImage({vectors = vectorBytes(), entry = [0x00, 0xbf], extra = []} = {}) {
  return [flashBase, record(0, 0, vectors), record(0, RESET_OFFSET, entry), ...extra, eof].join('\r\n');
}

test('sparse Flash is erased between HEX records and reset comes from the complete vector prefix', () => {
  const image = parseStm32Hex('\uFEFF ' + hexImage({extra: [
    record(0, 0xffff, [0xab]),
    record(5, 0, [8, 0, 2, 1])
  ]}));
  assert.equal(image.flash.length, 65536);
  assert.equal(image.initialStack, SRAM_TOP);
  assert.equal(image.resetAddress, STM32_FLASH_BASE + RESET_OFFSET);
  assert.equal(image.highestAddress, 0x0800ffff);
  assert.equal(image.byteCount, 11);
  assert.equal(new DataView(image.flash.buffer).getUint32(4, true), STM32_FLASH_BASE + RESET_OFFSET + 1);
  assert.deepEqual([...image.flash.slice(8, 12)], [0xff, 0xff, 0xff, 0xff]);
  assert.equal(image.flash[0xffff], 0xab);
});

test('BIN is mapped at the fixed Flash address and canonical Intel HEX roundtrips without byte loss', () => {
  const source = new Uint8Array(RESET_OFFSET + 2).fill(0x42);
  source.set(vectorBytes());
  source.set([0x00, 0xbf], RESET_OFFSET);
  const image = parseStm32Bin(source);
  assert.equal(image.highestAddress, STM32_FLASH_BASE + source.length - 1);
  assert.equal(image.flash[source.length], 0xff);
  assert.equal(image.byteCount, source.length);
  assert.notEqual(image.flash.buffer, source.buffer);
  const hex = stm32BinToHex(source);
  assert.ok(hex.startsWith(flashBase + '\n'));
  assert.ok(hex.endsWith(eof + '\n'));
  assert.deepEqual(parseStm32Hex(hex), image);
});

test('initial stack must be aligned and within the STM32F103C8 SRAM bounds', () => {
  for (const stack of [STM32_SRAM_BASE - 4, SRAM_TOP + 4, SRAM_TOP - 2]) {
    assert.throws(() => parseStm32Hex(hexImage({vectors: vectorBytes(stack)})), /初始栈指针/);
  }
  for (const stack of [STM32_SRAM_BASE, SRAM_TOP - 4, SRAM_TOP]) {
    assert.equal(parseStm32Hex(hexImage({vectors: vectorBytes(stack)})).initialStack, stack);
  }
});

test('a partial vector prefix and reset handlers without a Thumb bit or mapped code are rejected', () => {
  assert.throws(() => parseStm32Hex(hexImage({vectors: vectorBytes().subarray(0, 7)})), /完整复位向量/);
  assert.throws(() => parseStm32Hex(hexImage({vectors: vectorBytes(SRAM_TOP, STM32_FLASH_BASE + RESET_OFFSET)})), /Thumb 位/);
  for (const reset of [1, STM32_SRAM_BASE + 1, STM32_FLASH_BASE + STM32_FLASH_BYTES + 1, STM32_FLASH_BASE + 5]) {
    assert.throws(() => parseStm32Hex(hexImage({vectors: vectorBytes(SRAM_TOP, reset)})), /复位入口须位于/);
  }
  assert.throws(() => parseStm32Hex(hexImage({vectors: vectorBytes(SRAM_TOP, STM32_FLASH_BASE + 0x201)})), /没有写入完整/);
  assert.throws(() => parseStm32Hex(hexImage({entry: [0]})), /没有写入完整/);
  assert.throws(() => parseStm32Hex(hexImage({entry: [0xff, 0xff]})), /已擦除/);
  assert.throws(() => parseStm32Hex(hexImage({entry: [0x00, 0xf0]})), /32 位 Thumb 指令不完整/);
  assert.equal(parseStm32Hex(hexImage({entry: [0x00, 0xf0, 0x00, 0xf8]})).byteCount, 12);
});

test('HEX data cannot overlap or escape into other banks or alternate boot mappings', () => {
  const cases = [
    [record(4, 0, [0, 0]), /扩展地址/],
    [record(4, 0, [8, 1]), /扩展地址/],
    [record(4, 0, [0x20, 0]), /扩展地址/],
    [record(0, 0xffff, [0, 1]), /数据地址超出/],
    [record(0, 0x101, [0xbf]), /重复写入/],
    [record(5, 0, [0x20, 0, 0, 0]), /执行起始地址超出/],
    [[record(5, 0, [8, 0, 1, 1]), record(5, 0, [8, 0, 1, 1])].join('\n'), /执行起始地址重复/],
    [record(2, 0, [0, 0]), /不支持.*记录类型 0x02/]
  ];
  for (const [extra, diagnostic] of cases) {
    assert.throws(() => parseStm32Hex(hexImage({extra: [extra]})), diagnostic);
  }
  assert.throws(() => parseStm32Hex(hexImage().slice(flashBase.length + 2)), /数据地址超出/);
});

test('bad checksums, control records, and missing or repeated EOF are rejected', () => {
  assert.throws(() => parseStm32Hex(hexImage().replace(flashBase, ':020000040800F3')), error => {
    assert.equal(error.line, 1);
    assert.match(error.message, /校验和/);
    return true;
  });
  const cases = [
    [':0400000012345678', /数据长度/],
    ['S10500000C945A', /记录格式/],
    [record(4, 1, [8, 0]), /控制记录/],
    [record(1, 0, [0]), /控制记录/],
    [record(0, 0), /没有写入/]
  ];
  for (const [extra, diagnostic] of cases) assert.throws(() => parseStm32Hex(hexImage({extra: [extra]})), diagnostic);
  assert.throws(() => parseStm32Hex(hexImage().replace(eof, '')), /缺少 Intel HEX 结束/);
  assert.throws(() => parseStm32Hex(hexImage({extra: [eof]})), /结束记录之后/);
});

test('BIN and HEX type and size checks apply before allocating an image', () => {
  assert.throws(() => parseStm32Hex(new Uint8Array()), /文本文件/);
  assert.throws(() => parseStm32Hex(' '.repeat(STM32_HEX_MAX_CHARS + 1)), /超过 1 MiB/);
  assert.throws(() => parseStm32Bin(new ArrayBuffer(16)), /BIN 文件/);
  assert.throws(() => parseStm32Bin(new Uint8Array(STM32_FLASH_BYTES + 1)), /超过.*64 KiB/);
  assert.throws(() => parseStm32Bin(new Uint8Array()), /完整复位向量/);
  assert.throws(() => stm32BinToHex(new Uint8Array(8)), /初始栈指针/);
});

test('NUCLEO-F103RB has its own second Flash bank in HEX, without widening Blue Pill', () => {
  const board = 'nucleo-f103rb';
  const high = 0x0801fffc;
  const imageText = [
    flashBase, record(0, 0, vectorBytes(SRAM_TOP, high + 1)),
    record(4, 0, [8, 1]), record(0, 0xfffc, [0x00, 0xbf, 0xfe, 0xe7]), eof,
  ].join('\n');
  const image = parseStm32Hex(imageText, board);
  assert.equal(getStm32FirmwareTarget(board).mcu, 'STM32F103RBT6');
  assert.equal(getStm32FirmwareTarget(board).sramBytes, 20 * 1024);
  assert.equal(getStm32FirmwareTarget('nucleo-f401re'), null);
  assert.equal(image.resetAddress, high);
  assert.equal(image.highestAddress, 0x0801ffff);
  assert.equal(image.flash.length, 128 * 1024);
  assert.equal(image.flash[0x1fffc], 0);
  assert.equal(image.flash[0x10000], 0xff);
  assert.throws(() => parseStm32Hex(imageText), /扩展地址/);
  assert.throws(() => parseStm32Hex(imageText, 'nucleo-f401re'), /原生固件支持/);
});

test('NUCLEO-F103RB BIN to HEX writes a new extended address at 64 KiB', () => {
  const board = 'nucleo-f103rb';
  const bytes = new Uint8Array(128 * 1024).fill(0xff);
  bytes.set(vectorBytes(SRAM_TOP, 0x08010001));
  bytes.set([0x00, 0xbf], 0x10000);
  bytes[0xffff] = 0xa5;
  bytes[0x1ffff] = 0x5a;
  const hex = stm32BinToHex(bytes, board);
  assert.match(hex, /\n:020000040801F1\n:10000000/);
  assert.deepEqual(parseStm32Hex(hex, board), parseStm32Bin(bytes, board));
  assert.throws(() => stm32BinToHex(bytes), /64 KiB/);
  assert.throws(() => parseStm32Bin(new Uint8Array(bytes.length + 1), board), /128 KiB/);
});
