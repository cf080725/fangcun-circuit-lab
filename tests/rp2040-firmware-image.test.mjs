import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  parseRp2040Uf2, RP2040_FLASH_BASE, RP2040_FLASH_BYTES, RP2040_SRAM_BASE, RP2040_SRAM_BYTES,
  RP2040_UF2_MAX_BYTES, RP2040_VECTOR_OFFSET,
} from '../dist/rp2040-firmware-image.js';

const BLOCK = 512;
const PAYLOAD = 256;
const SRAM_TOP = RP2040_SRAM_BASE + RP2040_SRAM_BYTES;
const RESET_OFFSET = 0x180;

function boot2() {
  const bytes = new Uint8Array(PAYLOAD);
  bytes.set([0x00, 0xbf, 0x70, 0x47]);
  // Expected checksum independently computed using the Pico SDK pad_checksum formula.
  new DataView(bytes.buffer).setUint32(252, 0xc5930516, true);
  return bytes;
}

function application({stack = SRAM_TOP, reset = RP2040_FLASH_BASE + RESET_OFFSET + 1, entry = [0x00, 0xbf], entryOffset = RESET_OFFSET} = {}) {
  const bytes = new Uint8Array(PAYLOAD);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, stack, true);
  view.setUint32(4, reset, true);
  bytes.set(entry, entryOffset - RP2040_VECTOR_OFFSET);
  return bytes;
}

function writeBlock(bytes, index, count, target, payload, blockNumber = index) {
  const offset = index * BLOCK;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, BLOCK);
  const fields = [0x0a324655, 0x9e5d5157, 0x2000, target, PAYLOAD, blockNumber, count, 0xe48bff56];
  fields.forEach((value, word) => view.setUint32(word * 4, value, true));
  bytes.set(payload, offset + 32);
  view.setUint32(BLOCK - 4, 0x0ab16f30, true);
}

function uf2(pages = [[0, boot2()], [RP2040_VECTOR_OFFSET, application()]]) {
  const bytes = new Uint8Array(pages.length * BLOCK);
  pages.forEach(([address, payload, blockNumber], index) => writeBlock(bytes, index, pages.length, RP2040_FLASH_BASE + address, payload, blockNumber));
  return bytes;
}

test('reconstructs sparse Flash by address and preserves an exact copy of original reordered UF2 bytes', () => {
  const extra = new Uint8Array(PAYLOAD).fill(0x44);
  const bytes = uf2([[RP2040_VECTOR_OFFSET, application(), 1], [RP2040_FLASH_BYTES - PAYLOAD, extra, 2], [0, boot2(), 0]]);
  const backing = new Uint8Array(bytes.length + 17);
  backing.set(bytes, 9);
  const selected = backing.subarray(9, 9 + bytes.length);
  const image = parseRp2040Uf2(selected);
  assert.equal(image.flash.length, RP2040_FLASH_BYTES);
  assert.equal(image.byteCount, 768);
  assert.equal(image.highestAddress, 0x101fffff);
  assert.equal(image.initialStack, SRAM_TOP);
  assert.equal(image.resetAddress, 0x10000180);
  assert.deepEqual(image.flash.slice(0, PAYLOAD), boot2());
  assert.equal(image.flash[0x200], 0xff);
  assert.equal(image.flash.at(-1), 0x44);
  assert.deepEqual(image.bytes, bytes);
  assert.notEqual(image.bytes.buffer, selected.buffer);
  selected[0] = 0;
  assert.deepEqual(image.bytes, bytes);
  assert.deepEqual(parseRp2040Uf2(bytes.buffer).flash, image.flash);
});

test('only complete Pico family blocks with valid framing and supported flags are accepted', () => {
  const cases = [
    [0, 0, /块标识/], [4, 0, /块标识/], [508, 0, /块标识/],
    [8, 0, /标志/], [8, 0x2001, /标志/], [8, 0x3000, /标志/],
    [8, 0x6000, /标志/], [8, 0xa000, /标志/], [8, 0x10002000, /标志/],
    [28, 0xe48bff59, /系列标识不是 RP2040/], [16, 128, /256 字节/],
    [24, 3, /块总数或编号/], [20, 2, /块总数或编号/], [20, 0, /块编号重复/],
  ];
  for (const [offset, value, diagnostic] of cases) {
    const bytes = uf2();
    new DataView(bytes.buffer).setUint32(BLOCK + offset, value, true);
    assert.throws(() => parseRp2040Uf2(bytes), error => {
      assert.equal(error.block, 2);
      assert.match(error.message, diagnostic);
      return true;
    });
  }
  assert.throws(() => parseRp2040Uf2(uf2().subarray(0, BLOCK)), /块总数或编号/);
  assert.throws(() => parseRp2040Uf2(uf2().subarray(0, BLOCK + 1)), /完整的 512 字节块/);
});

test('Flash targets must be aligned, distinct, and inside the physical Pico range', () => {
  const cases = [
    [RP2040_SRAM_BASE, /超出 Pico 的 2 MiB/], [0x11000000, /超出 Pico 的 2 MiB/],
    [RP2040_FLASH_BASE - PAYLOAD, /超出 Pico 的 2 MiB/], [0xffffffff, /超出 Pico 的 2 MiB/],
    [RP2040_FLASH_BASE + RP2040_FLASH_BYTES, /超出 Pico 的 2 MiB/],
    [RP2040_FLASH_BASE + 0x104, /对齐/], [RP2040_FLASH_BASE, /Flash 页重复/],
  ];
  for (const [address, diagnostic] of cases) {
    const bytes = uf2();
    new DataView(bytes.buffer).setUint32(BLOCK + 12, address, true);
    assert.throws(() => parseRp2040Uf2(bytes), diagnostic);
  }
});

test('requires a complete checksummed boot2 page and vector page in their standard positions', () => {
  assert.throws(() => parseRp2040Uf2(uf2([[RP2040_VECTOR_OFFSET, application()]])), /缺少.*boot2 页/);
  assert.throws(() => parseRp2040Uf2(uf2([[0, boot2()]])), /缺少.*Pico 启动向量/);
  const corrupted = boot2();
  corrupted[100] = 1;
  assert.throws(() => parseRp2040Uf2(uf2([[0, corrupted], [RP2040_VECTOR_OFFSET, application()]])), /CRC32 校验失败/);
});

test('checks initial MSP and the Thumb reset entry against the loaded Flash pages', () => {
  const parse = options => parseRp2040Uf2(uf2([[0, boot2()], [RP2040_VECTOR_OFFSET, application(options)]]));
  for (const stack of [RP2040_SRAM_BASE - 4, SRAM_TOP - 2, SRAM_TOP + 4, 0x21000000]) {
    assert.throws(() => parse({stack}), /初始栈指针/);
  }
  assert.equal(parse({stack: SRAM_TOP - 4}).initialStack, SRAM_TOP - 4);
  assert.throws(() => parse({reset: RP2040_FLASH_BASE + RESET_OFFSET}), /未设置 Thumb 位/);
  assert.throws(() => parse({reset: RP2040_FLASH_BASE + 1}), /须指向 XIP Flash/);
  assert.throws(() => parse({reset: RP2040_SRAM_BASE + 1}), /须指向 XIP Flash/);
  assert.throws(() => parse({reset: RP2040_FLASH_BASE + 0x401}), /Flash 页没有写入/);
  assert.throws(() => parse({entry: [0xff, 0xff]}), /已擦除的 Flash/);
  const acrossPage = application({reset: RP2040_FLASH_BASE + 0x1ff, entryOffset: 0x1fe, entry: [0x00, 0xf0]});
  assert.throws(() => parseRp2040Uf2(uf2([[0, boot2()], [0x100, acrossPage]])), /32 位 Thumb 指令不完整/);
  const suffix = new Uint8Array(PAYLOAD);
  suffix.set([0x00, 0xf8]);
  assert.equal(parseRp2040Uf2(uf2([[0, boot2()], [0x100, acrossPage], [0x200, suffix]])).resetAddress, 0x100001fe);
});

test('bounded parser accepts a full 2 MiB Flash image but rejects oversize or nonbinary input', () => {
  assert.throws(() => parseRp2040Uf2('UF2\n'), /二进制文件/);
  assert.throws(() => parseRp2040Uf2(new Uint8Array()), /完整的 512 字节块/);
  assert.throws(() => parseRp2040Uf2(new Uint8Array(RP2040_UF2_MAX_BYTES + BLOCK)), /超过 4 MiB/);
  const bytes = new Uint8Array(RP2040_UF2_MAX_BYTES);
  const blockCount = bytes.length / BLOCK;
  const filler = new Uint8Array(PAYLOAD).fill(0xaa);
  writeBlock(bytes, 0, blockCount, RP2040_FLASH_BASE, boot2());
  writeBlock(bytes, 1, blockCount, RP2040_FLASH_BASE + RP2040_VECTOR_OFFSET, application());
  for (let block = 2; block < blockCount; block++) {
    writeBlock(bytes, block, blockCount, RP2040_FLASH_BASE + block * PAYLOAD, filler);
  }
  const image = parseRp2040Uf2(bytes);
  assert.equal(image.byteCount, RP2040_FLASH_BYTES);
  assert.equal(image.highestAddress, RP2040_FLASH_BASE + RP2040_FLASH_BYTES - 1);
  assert.equal(image.flash.at(-1), 0xaa);
});

test('ships compatible Pico binaries with checksummed SDK boot2 pages and real reset vectors', async () => {
  for (const name of ['blink', 'button']) {
    const bytes = await readFile(new URL(`../dist/firmware/pico/${name}.uf2`, import.meta.url));
    const image = parseRp2040Uf2(bytes);
    assert.deepEqual(image.bytes, new Uint8Array(bytes));
    assert.equal(image.initialStack, SRAM_TOP);
    assert.ok(image.resetAddress >= RP2040_FLASH_BASE + 0x140);
    assert.ok(image.resetAddress <= image.highestAddress);
  }
});
