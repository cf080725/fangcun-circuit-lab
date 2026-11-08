// Intel HEX addresses are bytes, even though the AVR program counter addresses words.
// https://onlinedocs.microchip.com/oxy/GUID-BB433107-FD4E-4D28-BB58-9D4A58955B1A-en-US-9/GUID-DF9E479D-6BA8-49E3-A2A5-997BBA49D34D.html
export const AVR_FLASH_BYTES = 32 * 1024;
export const AVR_MEGA_FLASH_BYTES = 256 * 1024;
// A one-byte data record with CRLF uses 15 characters, plus address records.
const HEX_CHARS_PER_FLASH_BYTE = 16;
export const AVR_HEX_MAX_CHARS = AVR_MEGA_FLASH_BYTES * HEX_CHARS_PER_FLASH_BYTE;

function invalid(message, line) {
  const error = new Error(line ? `第 ${line} 行：${message}` : message);
  if (line) error.line = line;
  throw error;
}

function decodeRecord(record, line) {
  if (!/^:(?:[0-9a-f]{2}){5,260}$/i.test(record)) {
    invalid('记录格式无效。请选择 Intel HEX 文件。', line);
  }
  const count = Number.parseInt(record.slice(1, 3), 16);
  if (record.length !== 1 + (count + 5) * 2) {
    invalid('记录中的数据长度不符。', line);
  }

  const bytes = new Uint8Array(count + 5);
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    const offset = 1 + i * 2;
    bytes[i] = Number.parseInt(record.slice(offset, offset + 2), 16);
    sum += bytes[i];
  }
  if (sum % 256 !== 0) invalid('校验和错误，请重新导出固件。', line);
  return bytes;
}

function readAddress(bytes, offset) {
  return bytes[offset] * 256 + bytes[offset + 1];
}

export function parseAvrHex(text, {flashBytes = AVR_FLASH_BYTES} = {}) {
  if (flashBytes !== AVR_FLASH_BYTES && flashBytes !== AVR_MEGA_FLASH_BYTES) {
    invalid('固件目标的 Flash 容量不受支持。');
  }
  const isMega = flashBytes === AVR_MEGA_FLASH_BYTES;
  const device = isMega ? 'ATmega2560' : 'ATmega328P';
  const capacity = `${device} 的 ${flashBytes / 1024} KiB Flash`;
  if (typeof text !== 'string') invalid('请选择 Intel HEX 文本文件。');
  if (text.length > flashBytes * HEX_CHARS_PER_FLASH_BYTE) {
    invalid(`Intel HEX 文本超过 ${isMega ? '4 MiB' : '512 KiB'}。`);
  }

  const flash = new Uint8Array(flashBytes).fill(0xff);
  const written = new Uint8Array(flashBytes);
  let base = 0;
  let segmented = false;
  let byteCount = 0;
  let highestAddress = -1;
  let entryAddress = null;
  let ended = false;

  const records = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  for (let index = 0; index < records.length; index++) {
    const record = records[index].replace(/^[\t ]+|[\t ]+$/g, '');
    if (!record) continue;
    const line = index + 1;
    if (ended) invalid('结束记录之后还有内容。', line);

    const bytes = decodeRecord(record, line);
    const count = bytes[0];
    const address = readAddress(bytes, 1);
    const type = bytes[3];
    if (type === 0) {
      if (!count) invalid('数据记录没有写入任何字节。', line);
      for (let i = 0; i < count; i++) {
        // Segment offsets wrap at 64 KiB. Linear offsets carry into the next bank.
        const offset = address + i;
        const target = base + (segmented ? offset % 65536 : offset);
        if (target >= flashBytes) invalid(`数据地址超出 ${capacity}。`, line);
        if (written[target]) invalid(`Flash 地址 0x${target.toString(16)} 重复写入。`, line);
        written[target] = 1;
        flash[target] = bytes[4 + i];
        highestAddress = Math.max(highestAddress, target);
      }
      byteCount += count;
      continue;
    }

    if (type > 5) invalid(`不支持的 Intel HEX 记录类型 0x${type.toString(16).padStart(2, '0')}。`, line);
    const expectedCount = type === 1 ? 0 : type === 2 || type === 4 ? 2 : 4;
    if (address !== 0 || count !== expectedCount) invalid('控制记录的地址或长度无效。', line);
    if (type === 1) {
      ended = true;
    } else if (type === 2 || type === 4) {
      segmented = type === 2;
      base = readAddress(bytes, 4) * (segmented ? 16 : 65536);
      if (base >= flashBytes) invalid(`扩展地址超出 ${capacity}。`, line);
    } else {
      if (entryAddress !== null) invalid('执行起始地址重复出现。', line);
      entryAddress = readAddress(bytes, 4) * (type === 3 ? 16 : 65536) + readAddress(bytes, 6);
      if (entryAddress >= flashBytes) invalid(`执行起始地址超出 ${capacity}。`, line);
    }
  }

  if (!ended) invalid('缺少 Intel HEX 结束记录。');
  // The emulated AVR application starts at byte 0. Start-address records are metadata only.
  if (!written[0] || !written[1] || (flash[0] === 0xff && flash[1] === 0xff)) {
    invalid(`缺少 ${device} 的复位指令。请选择从地址 0 开始的完整应用固件。`);
  }
  return {flash, byteCount, highestAddress, entryAddress};
}
