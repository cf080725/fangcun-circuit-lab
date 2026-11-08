// UF2 framing: https://github.com/microsoft/uf2
// RP2040 bootrom, UF2 constraints, and boot2 checksum: https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf
export const RP2040_FLASH_BASE = 0x10000000;
export const RP2040_FLASH_BYTES = 2 * 1024 * 1024;
export const RP2040_SRAM_BASE = 0x20000000;
export const RP2040_SRAM_BYTES = 264 * 1024;
export const RP2040_VECTOR_OFFSET = 0x100;

const UF2_BLOCK_BYTES = 512;
const UF2_PAYLOAD_BYTES = 256;
const UF2_HEADER_BYTES = 32;
const UF2_FAMILY_FLAG = 0x2000;
const RP2040_FAMILY = 0xe48bff56;
const FLASH_PAGES = RP2040_FLASH_BYTES / UF2_PAYLOAD_BYTES;
export const RP2040_UF2_MAX_BYTES = FLASH_PAGES * UF2_BLOCK_BYTES;

function invalid(message, block) {
  const error = new Error(block === undefined ? message : `第 ${block + 1} 块：${message}`);
  if (block !== undefined) error.block = block + 1;
  throw error;
}

function boot2Checksum(flash) {
  // The first 252 bytes are covered by the RP2040 bootrom's MSB-first CRC-32.
  let crc = 0xffffffff;
  for (let offset = 0; offset < 252; offset++) {
    crc ^= flash[offset] << 24;
    for (let bit = 0; bit < 8; bit++) {
      const topBit = crc >>> 31;
      crc = (crc << 1) ^ (topBit ? 0x04c11db7 : 0);
    }
  }
  return crc >>> 0;
}

export function parseRp2040Uf2(input) {
  let source;
  if (input instanceof Uint8Array) source = input;
  else if (input instanceof ArrayBuffer) source = new Uint8Array(input);
  else invalid('请选择 Raspberry Pi Pico 的 UF2 二进制文件。');
  if (source.byteLength > RP2040_UF2_MAX_BYTES) invalid('Pico UF2 文件超过 4 MiB。');
  if (!source.byteLength || source.byteLength % UF2_BLOCK_BYTES !== 0) {
    invalid('UF2 文件须由完整的 512 字节块组成。');
  }

  const bytes = new Uint8Array(source);
  const view = new DataView(bytes.buffer);
  const flash = new Uint8Array(RP2040_FLASH_BYTES).fill(0xff);
  const blockCount = bytes.length / UF2_BLOCK_BYTES;
  const blockNumbers = new Uint8Array(blockCount);
  const flashPages = new Uint8Array(FLASH_PAGES);
  let highestAddress = -1;

  for (let block = 0; block < blockCount; block++) {
    const offset = block * UF2_BLOCK_BYTES;
    if (view.getUint32(offset, true) !== 0x0a324655 || view.getUint32(offset + 4, true) !== 0x9e5d5157
        || view.getUint32(offset + 508, true) !== 0x0ab16f30) {
      invalid('UF2 块标识无效。', block);
    }
    if (view.getUint32(offset + 8, true) !== UF2_FAMILY_FLAG) {
      invalid('UF2 标志无效。请选择带 RP2040 系列标识的 Flash 应用。', block);
    }
    if (view.getUint32(offset + 28, true) !== RP2040_FAMILY) {
      invalid('UF2 系列标识不是 RP2040（0xe48bff56）。', block);
    }
    if (view.getUint32(offset + 16, true) !== UF2_PAYLOAD_BYTES) {
      invalid('RP2040 UF2 块的有效数据须为 256 字节。', block);
    }
    const blockNumber = view.getUint32(offset + 20, true);
    if (view.getUint32(offset + 24, true) !== blockCount || blockNumber >= blockCount) {
      invalid('UF2 声明的块总数或编号与实际文件不符。', block);
    }
    if (blockNumbers[blockNumber]) invalid('UF2 块编号重复。', block);
    blockNumbers[blockNumber] = 1;

    const address = view.getUint32(offset + 12, true);
    const target = address - RP2040_FLASH_BASE;
    if (target < 0 || target + UF2_PAYLOAD_BYTES > RP2040_FLASH_BYTES) {
      invalid('目标地址超出 Pico 的 2 MiB XIP Flash（0x10000000–0x101fffff）。', block);
    }
    if (target % UF2_PAYLOAD_BYTES !== 0) invalid('目标地址须按 256 字节 Flash 页对齐。', block);
    const page = target / UF2_PAYLOAD_BYTES;
    if (flashPages[page]) invalid('UF2 数据在同一个 Flash 页重复写入。', block);
    flashPages[page] = 1;
    const payload = offset + UF2_HEADER_BYTES;
    flash.set(bytes.subarray(payload, payload + UF2_PAYLOAD_BYTES), target);
    highestAddress = Math.max(highestAddress, address + UF2_PAYLOAD_BYTES - 1);
  }

  if (!flashPages[0]) invalid('缺少 Pico Flash 开头的 boot2 页。');
  if (!flashPages[1]) invalid('缺少地址 0x10000100 的 Pico 启动向量。');
  const vectors = new DataView(flash.buffer);
  if (vectors.getUint32(252, true) !== boot2Checksum(flash)) invalid('Pico boot2 的 CRC32 校验失败。');

  const initialStack = vectors.getUint32(RP2040_VECTOR_OFFSET, true);
  if (initialStack < RP2040_SRAM_BASE || initialStack > RP2040_SRAM_BASE + RP2040_SRAM_BYTES || initialStack % 4 !== 0) {
    invalid('初始栈指针须在 0x20000000–0x20042000，且按 4 字节对齐。');
  }
  const resetVector = vectors.getUint32(RP2040_VECTOR_OFFSET + 4, true);
  if (!(resetVector & 1)) invalid('Pico 的复位向量未设置 Thumb 位。');
  const resetAddress = resetVector - 1;
  const resetOffset = resetAddress - RP2040_FLASH_BASE;
  if (resetOffset < RP2040_VECTOR_OFFSET + 8 || resetOffset >= RP2040_FLASH_BYTES) {
    invalid('Pico 的复位入口须指向 XIP Flash 中的应用程序。');
  }
  if (!flashPages[Math.floor(resetOffset / UF2_PAYLOAD_BYTES)]) {
    invalid('Pico 的复位入口所在 Flash 页没有写入数据。');
  }
  const instruction = vectors.getUint16(resetOffset, true);
  if (instruction === 0xffff) invalid('Pico 的复位入口指向已擦除的 Flash。');
  if (instruction >= 0xe800 && !flashPages[Math.floor((resetOffset + 3) / UF2_PAYLOAD_BYTES)]) {
    invalid('Pico 复位入口的 32 位 Thumb 指令不完整。');
  }
  return {flash, bytes, initialStack, resetAddress, byteCount: blockCount * UF2_PAYLOAD_BYTES, highestAddress};
}
