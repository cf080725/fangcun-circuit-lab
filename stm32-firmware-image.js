// STM32F103x8/xB internal Flash and SRAM are described in ST DS5319.
// https://www.st.com/resource/en/datasheet/stm32f103rb.pdf
export const STM32_FLASH_BASE = 0x08000000;
export const STM32_FLASH_BYTES = 64 * 1024;
export const STM32_SRAM_BASE = 0x20000000;
export const STM32_SRAM_BYTES = 20 * 1024;
export const STM32_HEX_MAX_CHARS = 1024 * 1024;

const VECTOR_PREFIX_BYTES = 8;
const TARGETS = Object.freeze({
  bluepill: target('bluepill', 'STM32F103C8T6', STM32_FLASH_BYTES, ['USART1']),
  'nucleo-f103rb': target('nucleo-f103rb', 'STM32F103RBT6', 128 * 1024, ['USART2', 'USART1']),
});

function target(boardId, mcu, flashBytes, serialPorts) {
  return Object.freeze({boardId, mcu, flashBytes, sramBytes: STM32_SRAM_BYTES, serialPorts: Object.freeze(serialPorts)});
}

export function getStm32FirmwareTarget(boardId = 'bluepill') {
  return Object.hasOwn(TARGETS, boardId) ? TARGETS[boardId] : null;
}

function requireTarget(boardId) {
  const model = getStm32FirmwareTarget(boardId);
  if (!model) invalid('当前 STM32 原生固件支持 Blue Pill 和 NUCLEO-F103RB。');
  return model;
}

function invalid(message, line) {
  const error = new Error(line ? `第 ${line} 行：${message}` : message);
  if (line) error.line = line;
  throw error;
}

function validateImage(flash, byteCount, highestAddress, hasByte, model) {
  for (let index = 0; index < VECTOR_PREFIX_BYTES; index++) {
    if (!hasByte(index)) invalid('缺少 Flash 开头的完整复位向量（初始栈指针和复位入口）。');
  }
  const vectors = new DataView(flash.buffer);
  const initialStack = vectors.getUint32(0, true);
  if (initialStack < STM32_SRAM_BASE || initialStack > STM32_SRAM_BASE + model.sramBytes || initialStack % 4 !== 0) {
    invalid('初始栈指针须按 4 字节对齐，地址范围为 0x20000000–0x20005000。');
  }
  const resetVector = vectors.getUint32(4, true);
  if (!(resetVector & 1)) invalid(`复位向量未设置 Thumb 位。请重新导出 ${model.mcu} 应用固件。`);
  const resetAddress = resetVector - 1;
  if (resetAddress < STM32_FLASH_BASE + VECTOR_PREFIX_BYTES || resetAddress >= STM32_FLASH_BASE + model.flashBytes) {
    invalid(`复位入口须位于 ${model.mcu} 内部 Flash 的应用程序区域。`);
  }
  const resetOffset = resetAddress - STM32_FLASH_BASE;
  if (!hasByte(resetOffset) || !hasByte(resetOffset + 1)) invalid('复位入口没有写入完整的 Thumb 指令。');
  const instruction = vectors.getUint16(resetOffset, true);
  if (instruction === 0xffff) invalid('复位入口指向已擦除的 Flash。');
  if (instruction >= 0xe800 && (!hasByte(resetOffset + 2) || !hasByte(resetOffset + 3))) {
    invalid('复位入口的 32 位 Thumb 指令不完整。');
  }
  return {flash, byteCount, highestAddress, resetAddress, initialStack};
}

function readHexRecord(record, line) {
  if (!/^:(?:[0-9a-f]{2}){5,260}$/i.test(record)) invalid('记录格式无效。请选择 Intel HEX 文件。', line);
  const count = Number.parseInt(record.slice(1, 3), 16);
  if (record.length !== 1 + (count + 5) * 2) invalid('记录中的数据长度不符。', line);
  const bytes = new Uint8Array(count + 5);
  let sum = 0;
  for (let index = 0; index < bytes.length; index++) {
    const offset = 1 + index * 2;
    bytes[index] = Number.parseInt(record.slice(offset, offset + 2), 16);
    sum += bytes[index];
  }
  if (sum % 256 !== 0) invalid('校验和错误，请重新导出固件。', line);
  return bytes;
}

export function parseStm32Hex(text, boardId = 'bluepill') {
  const model = requireTarget(boardId);
  if (typeof text !== 'string') invalid('请选择 Intel HEX 文本文件。');
  if (text.length > STM32_HEX_MAX_CHARS) invalid('Intel HEX 文本超过 1 MiB。');
  const flashEnd = STM32_FLASH_BASE + model.flashBytes;
  const flash = new Uint8Array(model.flashBytes).fill(0xff);
  const written = new Uint8Array(model.flashBytes);
  let upperAddress = 0;
  let byteCount = 0;
  let highestAddress = -1;
  let hasStartRecord = false;
  let ended = false;
  const records = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);

  for (let index = 0; index < records.length; index++) {
    const record = records[index].replace(/^[\t ]+|[\t ]+$/g, '');
    if (!record) continue;
    const line = index + 1;
    if (ended) invalid('结束记录之后还有内容。', line);
    const bytes = readHexRecord(record, line);
    const count = bytes[0];
    const offset = bytes[1] * 256 + bytes[2];
    const type = bytes[3];
    if (type === 0) {
      if (!count) invalid('数据记录没有写入任何字节。', line);
      const address = upperAddress + offset;
      if (address < STM32_FLASH_BASE || address + count > flashEnd) {
        const end = (flashEnd - 1).toString(16).padStart(8, '0').toUpperCase();
        invalid(`数据地址超出 ${model.mcu} 的内部 Flash（0x08000000–0x${end}）。`, line);
      }
      for (let i = 0; i < count; i++) {
        const target = address - STM32_FLASH_BASE + i;
        if (written[target]) invalid(`Flash 地址 0x${(address + i).toString(16)} 重复写入。`, line);
        written[target] = 1;
        flash[target] = bytes[4 + i];
      }
      byteCount += count;
      highestAddress = Math.max(highestAddress, address + count - 1);
      continue;
    }

    const expectedCount = {1: 0, 4: 2, 5: 4}[type];
    if (expectedCount === undefined) invalid(`不支持的 Intel HEX 记录类型 0x${type.toString(16).padStart(2, '0')}。`, line);
    if (offset !== 0 || count !== expectedCount) invalid('控制记录的地址或长度无效。', line);
    if (type === 1) {
      ended = true;
    } else if (type === 4) {
      upperAddress = (bytes[4] * 256 + bytes[5]) * 65536;
      if (upperAddress < STM32_FLASH_BASE || upperAddress >= flashEnd) {
        invalid('扩展地址须指向当前板型从 0x08000000 开始的内部 Flash。', line);
      }
    } else {
      // ELF entry metadata may retain its Thumb bit. Boot still uses the vector table.
      const entry = new DataView(bytes.buffer).getUint32(4);
      if (hasStartRecord) invalid('执行起始地址重复出现。', line);
      if (entry < STM32_FLASH_BASE || entry >= flashEnd) invalid('执行起始地址超出内部 Flash。', line);
      hasStartRecord = true;
    }
  }
  if (!ended) invalid('缺少 Intel HEX 结束记录。');
  return validateImage(flash, byteCount, highestAddress, offset => written[offset] === 1, model);
}

export function parseStm32Bin(bytes, boardId = 'bluepill') {
  const model = requireTarget(boardId);
  if (!(bytes instanceof Uint8Array)) invalid(`请选择按 0x08000000 链接的 ${model.mcu} BIN 文件。`);
  if (bytes.length > model.flashBytes) invalid(`BIN 文件超过 ${model.mcu} 的 ${model.flashBytes / 1024} KiB Flash。`);
  const flash = new Uint8Array(model.flashBytes).fill(0xff);
  flash.set(bytes);
  return validateImage(flash, bytes.length, STM32_FLASH_BASE + bytes.length - 1, offset => offset < bytes.length, model);
}

function encodeHexRecord(type, offset, data) {
  const bytes = [data.length, offset >> 8, offset & 0xff, type, ...data];
  const checksum = -bytes.reduce((sum, byte) => sum + byte, 0) & 0xff;
  return ':' + [...bytes, checksum].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export function stm32BinToHex(bytes, boardId = 'bluepill') {
  const {flash, byteCount} = parseStm32Bin(bytes, boardId);
  const records = [];
  for (let offset = 0; offset < byteCount; offset += 16) {
    if ((offset & 0xffff) === 0) {
      const address = STM32_FLASH_BASE + offset;
      records.push(encodeHexRecord(4, 0, [address >>> 24, (address >>> 16) & 0xff]));
    }
    records.push(encodeHexRecord(0, offset & 0xffff, flash.subarray(offset, Math.min(offset + 16, byteCount))));
  }
  records.push(encodeHexRecord(1, 0, []));
  return records.join('\n') + '\n';
}
