// The SSD1306 RAM uses eight pages of 128 bytes, with the low bit at the top.
// On Adafruit #326, A1 and C8 align RAM addresses with the front-view panel.
const width = 128;
const height = 64;
const pageCount = height / 8;
const blankFrame = new Uint8Array(width * pageCount);
const hostPins = new Map([
  ['uno-r3', ['A4', 'A5']],
  ['nano', ['A4', 'A5']],
  ['mega2560', ['D20', 'D21']]
]);

export const ssd1306Pins = ['VIN', 'GND', 'SDA', 'SCL'];
export const ssd1306PullOhms = 10000;
export const ssd1306LoadOhms = 1000;
export const ssd1306Address = part => part.address === 0x3c ? 0x3c : 0x3d;
export const ssd1306HostPins = boardId => hostPins.get(boardId);
export const ssd1306Powered = voltage => Number.isFinite(voltage) && voltage >= 3 - 1e-9 && voltage <= 5.5 + 1e-9;

export function createSsd1306() {
  return {
    ram:blankFrame, framebuffer:blankFrame, frameRevision:0,
    displayEnabled:false, chargePump:false, inverse:false, entireDisplayOn:false, contrast:0x7f,
    segmentRemap:false, reverseCom:false, startLine:0, displayOffset:0,
    addressing:2, column:0, page:0, firstColumn:0, lastColumn:127, firstPage:0, lastPage:7,
    pending:null
  };
}

export function ssd1306Reading(controller, part, {voltage, powered, reason}) {
  return {
    address:ssd1306Address(part), voltage, powered, reason,
    displayOn:powered && controller.displayEnabled && controller.chargePump,
    displayEnabled:controller.displayEnabled, chargePump:controller.chargePump,
    contrast:controller.contrast, inverse:controller.inverse, entireDisplayOn:controller.entireDisplayOn,
    framebuffer:controller.framebuffer, frameRevision:controller.frameRevision
  };
}

// I²C control bytes use Co in bit 7 and D/C# in bit 6. Co=1 governs
// one payload byte; Co=0 governs all remaining bytes in that transfer.
function payloads(bytes) {
  const groups = [];
  for (let index = 0; index < bytes.length;) {
    const control = bytes[index++];
    if (control & 0x3f) return null;
    const follows = Boolean(control & 0x80);
    if (follows && index === bytes.length) return null;
    const end = follows ? index + 1 : bytes.length;
    groups.push({data:Boolean(control & 0x40), bytes:bytes.slice(index, end)});
    index = end;
  }
  return groups;
}

const argumentCount = new Map([
  [0x20, 1], [0x21, 2], [0x22, 2], [0x26, 6], [0x27, 6], [0x29, 5], [0x2a, 5],
  [0x81, 1], [0x8d, 1], [0xa3, 2], [0xa8, 1], [0xd3, 1], [0xd5, 1], [0xd9, 1],
  [0xda, 1], [0xdb, 1]
]);

function applyCommand(state, code, args) {
  const [first, last] = args;
  switch (code) {
    case 0x20:
      if (first <= 2) state.addressing = first;
      return first <= 2;
    case 0x21:
      if (state.addressing === 2 || first > last || last >= width) return false;
      state.column = state.firstColumn = first;
      state.lastColumn = last;
      return true;
    case 0x22:
      if (state.addressing === 2 || first > last || last >= pageCount) return false;
      state.page = state.firstPage = first;
      state.lastPage = last;
      return true;
    case 0x81: state.contrast = first; return true;
    case 0x8d:
      if (first === 0x10 || first === 0x14) state.chargePump = first === 0x14;
      return first === 0x10 || first === 0x14;
    case 0xa0: case 0xa1: state.segmentRemap = code === 0xa1; return true;
    case 0xa4: case 0xa5: state.entireDisplayOn = code === 0xa5; return true;
    case 0xa6: case 0xa7: state.inverse = code === 0xa7; return true;
    case 0xa8: return first === 0x3f;
    case 0xae: case 0xaf: state.displayEnabled = code === 0xaf; return true;
    case 0xc0: case 0xc8: state.reverseCom = code === 0xc8; return true;
    case 0xd3: state.displayOffset = first & 0x3f; return true;
    // Common initialization controls for fixed panel timing and drive.
    case 0x2e: case 0xd5: case 0xd9: case 0xda: case 0xdb: case 0xe3: return true;
  }
  if (code >= 0x40 && code <= 0x7f) {
    state.startLine = code & 0x3f;
    return true;
  }
  if (state.addressing === 2) {
    if (code <= 0x0f) { state.column = (state.column & 0x70) | code; return true; }
    if (code >= 0x10 && code <= 0x17) { state.column = (state.column & 0x0f) | ((code & 7) << 4); return true; }
    if (code >= 0xb0 && code <= 0xb7) { state.page = code & 7; return true; }
  }
  return false;
}

function nextAddress(state) {
  if (state.addressing === 2) {
    state.column = (state.column + 1) % width;
  } else if (state.addressing === 0) {
    if (state.column < state.lastColumn) state.column++;
    else {
      state.column = state.firstColumn;
      state.page = state.page < state.lastPage ? state.page + 1 : state.firstPage;
    }
  } else if (state.page < state.lastPage) {
    state.page++;
  } else {
    state.page = state.firstPage;
    state.column = state.column < state.lastColumn ? state.column + 1 : state.firstColumn;
  }
}

function orientedFrame(state) {
  const result = new Uint8Array(width * pageCount);
  const offset = state.startLine - state.displayOffset;
  for (let y = 0; y < height; y++) {
    const ramY = ((state.reverseCom ? y : height - 1 - y) + offset) & 0x3f;
    const from = (ramY >> 3) * width, sourceBit = 1 << (ramY & 7);
    const to = (y >> 3) * width, targetBit = 1 << (y & 7);
    for (let x = 0; x < width; x++) {
      if (state.ram[from + width - 1 - x] & sourceBit) result[to + x] |= targetBit;
    }
  }
  return result;
}

export function applySsd1306Write(previous, bytes) {
  if ((!Array.isArray(bytes) && !(bytes instanceof Uint8Array)) ||
    bytes.length > 4096 || !Array.from(bytes).every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return {status:3, reason:'invalid-data'};
  }
  const groups = payloads(bytes);
  if (!groups) return {status:3, reason:'invalid-control'};
  const state = {...previous, pending:previous.pending && {code:previous.pending.code, args:[...previous.pending.args]}};
  let unsupportedCommand = null;
  const command = (code, args) => {
    if (!applyCommand(state, code, args) && unsupportedCommand === null) unsupportedCommand = code;
  };
  for (const group of groups) {
    for (const byte of group.bytes) {
      if (group.data) {
        const segment = state.segmentRemap ? width - 1 - state.column : state.column;
        const index = state.page * width + segment;
        if (state.ram[index] !== byte) {
          if (state.ram === previous.ram) state.ram = previous.ram.slice();
          state.ram[index] = byte;
        }
        nextAddress(state);
      } else if (state.pending) {
        const {code, args} = state.pending;
        args.push(byte);
        if (args.length === argumentCount.get(code)) {
          command(code, args);
          state.pending = null;
        }
      } else if (argumentCount.has(byte)) {
        state.pending = {code:byte, args:[]};
      } else command(byte, []);
    }
  }
  if (state.ram !== previous.ram || state.reverseCom !== previous.reverseCom ||
    state.startLine !== previous.startLine || state.displayOffset !== previous.displayOffset) {
    const frame = orientedFrame(state);
    if (frame.some((byte, index) => byte !== previous.framebuffer[index])) {
      state.framebuffer = frame;
      state.frameRevision++;
    }
  }
  return unsupportedCommand === null ? {status:0, state}
    : {status:0, state, reason:'unsupported-command', command:unsupportedCommand};
}
