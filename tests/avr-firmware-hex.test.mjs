import test from 'node:test';
import assert from 'node:assert/strict';
import {AVR_FLASH_BYTES, AVR_MEGA_FLASH_BYTES, AVR_HEX_MAX_CHARS, parseAvrHex} from '../dist/avr-firmware-hex.js';

const eof = ':00000001FF';
const resetJump = ':040000000C94340028';

function record(type, offset, data = []) {
  const bytes = [data.length, offset >> 8, offset & 0xff, type, ...data];
  const checksum = -bytes.reduce((sum, byte) => sum + byte, 0) & 0xff;
  return ':' + [...bytes, checksum].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

test('preserves little-endian AVR instruction bytes and fills sparse Flash with erased bytes', () => {
  const lastByte = record(0, 0x7fff, [0xab]);
  const source = '\uFEFF \t' + lastByte + '\r\n\r\n' + resetJump + '\r\n' + eof + '\r\n';
  const result = parseAvrHex(source);
  const words = new DataView(result.flash.buffer);
  assert.equal(result.flash.length, AVR_FLASH_BYTES);
  assert.equal(words.getUint16(0, true), 0x940c);
  assert.equal(words.getUint16(2, true), 0x0034);
  assert.equal(result.flash[4], 0xff);
  assert.equal(result.flash[0x7fff], 0xab);
  assert.equal(result.byteCount, 5);
  assert.equal(result.highestAddress, 0x7fff);
  assert.equal(result.entryAddress, null);
});

test('handles Intel HEX segment and linear records without using entry metadata as the reset vector', () => {
  const segment = parseAvrHex([
    record(3, 0, [0, 1, 0, 2]),
    resetJump,
    record(2, 0, [0, 1]),
    record(0, 2, [0xa5, 0x5a]),
    eof
  ].join('\n'));
  assert.equal(segment.entryAddress, 18);
  assert.deepEqual([...segment.flash.slice(18, 20)], [0xa5, 0x5a]);
  assert.equal(segment.flash[0], 0x0c);

  const linear = parseAvrHex([
    record(4, 0, [0, 0]),
    resetJump,
    record(5, 0, [0, 0, 0, 2]),
    eof
  ].join('\n'));
  assert.equal(linear.entryAddress, 2);
  assert.equal(linear.byteCount, 4);
});

test('Mega HEX preserves extended bytes and linear carry without altering the reset vector', () => {
  const source = [
    resetJump,
    record(0, 0xffff, [0x12, 0x34]),
    record(4, 0, [0, 1]),
    record(0, 0x8000, [0x56]),
    record(4, 0, [0, 3]),
    record(0, 0xfffe, [0x78, 0x9a]),
    record(5, 0, [0, 1, 0x80, 0]),
    eof
  ].join('\n');
  const result = parseAvrHex(source, {flashBytes: AVR_MEGA_FLASH_BYTES});
  assert.equal(result.flash.length, 262144);
  assert.equal(result.flash[0], 0x0c);
  assert.equal(result.flash[0x10001], 0xff);
  assert.deepEqual([...result.flash.slice(0xffff, 0x10001)], [0x12, 0x34]);
  assert.equal(result.flash[0x18000], 0x56);
  assert.deepEqual([...result.flash.slice(-2)], [0x78, 0x9a]);
  assert.equal(result.highestAddress, 0x3ffff);
  assert.equal(result.entryAddress, 0x18000);
  assert.equal(result.byteCount, 9);
  assert.throws(() => parseAvrHex(source), /ATmega328P 的 32 KiB Flash/);
});

test('Mega segment offsets wrap inside their 64 KiB range and use actual byte addresses for overlap checks', () => {
  const segmentBase = record(2, 0, [0x10, 0]);
  const data = record(0, 0xffff, [0x12, 0x34]);
  const result = parseAvrHex([resetJump, segmentBase, data, eof].join('\n'), {flashBytes: AVR_MEGA_FLASH_BYTES});
  assert.equal(result.flash[0x1ffff], 0x12);
  assert.equal(result.flash[0x10000], 0x34);
  assert.equal(result.flash[0x20000], 0xff);
  const duplicate = [resetJump, segmentBase, data, record(4, 0, [0, 1]), record(0, 0, [0x34]), eof];
  assert.throws(() => parseAvrHex(duplicate.join('\n'), {flashBytes: AVR_MEGA_FLASH_BYTES}), /0x10000 重复/);
});

test('Mega range checks apply to bank bases, writes, and execution entry metadata', () => {
  const cases = [
    [record(4, 0, [0, 4]), /扩展地址超出/],
    [record(2, 0, [0x40, 0]), /扩展地址超出/],
    [[record(4, 0, [0, 3]), record(0, 0xffff, [0, 1])].join('\n'), /数据地址超出/],
    [record(5, 0, [0, 4, 0, 0]), /执行起始地址超出/]
  ];
  for (const [invalid, diagnostic] of cases) {
    assert.throws(() => parseAvrHex([resetJump, invalid, eof].join('\n'), {flashBytes: AVR_MEGA_FLASH_BYTES}), diagnostic);
  }
  assert.throws(() => parseAvrHex([record(4, 0, [0, 1]), resetJump, eof].join('\n'), {flashBytes: AVR_MEGA_FLASH_BYTES}), /缺少 ATmega2560 的复位指令/);
});

test('Mega input cap accommodates a full image using one-byte records and CRLF', () => {
  const records = [];
  for (let address = 0; address < AVR_MEGA_FLASH_BYTES; address++) {
    if (address % 65536 === 0) records.push(record(4, 0, [0, address / 65536]));
    records.push(record(0, address % 65536, [address % 256]));
  }
  const source = [...records, eof, ''].join('\r\n');
  assert.ok(source.length < AVR_HEX_MAX_CHARS);
  const result = parseAvrHex(source, {flashBytes: AVR_MEGA_FLASH_BYTES});
  assert.equal(result.byteCount, AVR_MEGA_FLASH_BYTES);
  assert.equal(result.highestAddress, AVR_MEGA_FLASH_BYTES - 1);
});

test('rejects corrupted records and reports the input line', () => {
  const cases = [
    [':040000000C94340029', /校验和/],
    [':030000000C94340028', /数据长度/],
    [':040000000C9x340028', /记录格式/],
    [record(0, 0), /没有写入/],
    [record(0x10, 0, [0, 0]), /记录类型 0x10/],
    [record(2, 1, [0, 0]), /控制记录/],
    [record(4, 0, [0]), /控制记录/],
    [record(5, 0, [0, 0]), /控制记录/],
    [record(1, 0, [0]), /控制记录/]
  ];
  for (const [invalid, diagnostic] of cases) {
    assert.throws(() => parseAvrHex('\n' + invalid + '\n' + eof), error => {
      assert.equal(error.line, 2);
      assert.match(error.message, diagnostic);
      return true;
    });
  }
});

test('rejects overlapping, out-of-range and ambiguous address records', () => {
  const cases = [
    [record(0, 3, [0]), /重复写入/],
    [record(0, 3, [1]), /重复写入/],
    [record(0, 0x7fff, [0, 1]), /数据地址超出/],
    [record(4, 0, [0, 1]), /扩展地址超出/],
    [record(2, 0, [8, 0]), /扩展地址超出/],
    [record(5, 0, [0, 0, 128, 0]), /执行起始地址超出/],
    [[record(3, 0, [0, 0, 0, 0]), record(5, 0, [0, 0, 0, 0])].join('\n'), /执行起始地址重复/]
  ];
  for (const [invalid, diagnostic] of cases) {
    assert.throws(() => parseAvrHex([resetJump, invalid, eof].join('\n')), diagnostic);
  }
});

test('requires exactly one final record and a non-erased reset word', () => {
  assert.throws(() => parseAvrHex(resetJump), /缺少 Intel HEX 结束/);
  assert.throws(() => parseAvrHex([resetJump, eof, eof].join('\n')), /结束记录之后/);
  assert.throws(() => parseAvrHex([eof, resetJump].join('\n')), /结束记录之后/);
  assert.throws(() => parseAvrHex(eof), /缺少 ATmega328P 的复位指令/);
  assert.throws(() => parseAvrHex([record(0, 0, [0]), eof].join('\n')), /缺少 ATmega328P 的复位指令/);
  assert.throws(() => parseAvrHex([record(0, 0, [255, 255]), eof].join('\n')), /缺少 ATmega328P 的复位指令/);
});

test('rejects non-text data, unrelated file formats, and excessive input', () => {
  assert.throws(() => parseAvrHex(new Uint8Array([0x7f, 0x45, 0x4c, 0x46])), /文本文件/);
  assert.throws(() => parseAvrHex('S10500000C945A\nS9030000FC'), /记录格式/);
  assert.throws(() => parseAvrHex(' '.repeat(512 * 1024 + 1)), /超过 512 KiB/);
  assert.throws(() => parseAvrHex(' '.repeat(AVR_HEX_MAX_CHARS + 1), {flashBytes: AVR_MEGA_FLASH_BYTES}), /超过 4 MiB/);
  assert.throws(() => parseAvrHex(resetJump, {flashBytes: 1 << 30}), /Flash 容量不受支持/);
});
