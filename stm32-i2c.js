// STM32F103 I2C1 polling master subset. RM0008 and AN2824 describe the
// SR1/SR2 handshake and the two-byte POS/ACK sequence used by the firmware.
const CR1 = 0x00, CR2 = 0x04, OAR1 = 0x08, OAR2 = 0x0c, DR = 0x10;
const SR1 = 0x14, SR2 = 0x18, CCR = 0x1c, TRISE = 0x20;
const PE = 1, START = 0x100, STOP = 0x200, ACK = 0x400, POS = 0x800, SWRST = 0x8000;
const SB = 1, ADDR = 2, BTF = 4, RXNE = 0x40, TXE = 0x80, BERR = 0x100, AF = 0x400;
const MSL = 1, BUSY = 2, TRA = 4;
const MAX_READ = 32, MAX_WRITE = 4096, MAX_EVENTS = 64;
const CONFIG_MASKS = new Map([[CR2, 0x3f], [OAR1, 0xc3ff], [OAR2, 0xff], [CCR, 0xcfff], [TRISE, 0x3f]]);

export function createStm32I2c({isClocked, isReset = () => false, routeReason, clockHz, now}) {
  const registers = new Uint16Array(TRISE / 4 + 1);
  const history = [];
  const get = register => registers[register / 4];
  const set = (register, value) => { registers[register / 4] = value; };
  let packet = null, pending = null, active = null, boundary = null, statusRead = 0;
  let rx = [], posTwo = false, rxFinished = false;

  function clearTransfer() {
    packet = pending = active = boundary = null;
    statusRead = 0;
    rx = [];
    posTwo = rxFinished = false;
    set(DR, 0);
    set(SR1, 0);
    set(SR2, 0);
  }

  function resetRegisters() {
    clearTransfer();
    registers.fill(0);
    set(TRISE, 2);
  }

  function clocked() {
    if (isReset()) {
      resetRegisters();
      return false;
    }
    return isClocked();
  }

  function sclHz() {
    const ccr = get(CCR);
    const divider = ccr & 0xfff;
    const factor = !(ccr & 0x8000) ? 2 : ccr & 0x4000 ? 25 : 3;
    return divider ? Math.round(clockHz() / (factor * divider)) : 0;
  }

  function queue(operation, fields, apply, wireByte = false) {
    const {address, repeatedStart} = packet;
    const {stop = false, ack, ...parameters} = fields;
    pending = {
      request: {operation, address, ...parameters, meta: {stop, repeatedStart, ...(ack !== undefined && {ack})}},
      dueMs: now() + (wireByte ? 9000 / packet.sclHz : 0),
      apply,
    };
  }

  function updateRxStatus() {
    set(SR1, (get(SR1) & ~(RXNE | BTF)) | (rx.length > 0 ? RXNE : 0) | (rx.length > 1 ? BTF : 0));
  }

  function flagError(status, reason) {
    packet.status = status;
    packet.reason = reason;
    set(SR1, (get(SR1) & ~(SB | ADDR | TXE | BTF)) | (status === 2 || status === 3 ? AF : BERR));
  }

  function start(repeatedStart) {
    rx = [];
    posTwo = rxFinished = false;
    statusRead = 0;
    packet = {address: null, direction: null, bytes: [], status: 0, fromMs: now(), sclHz: sclHz(), repeatedStart};
    set(SR1, (get(SR1) & (BERR | AF)) | SB);
    set(SR2, MSL | BUSY);
    set(CR1, get(CR1) & ~START);
  }

  function finish(stop) {
    if (packet?.direction) {
      const toMs = now();
      history.push({type: 'i2c', controller: 'stm32-i2c1', timingMode: 'stm32-mmio-estimated',
        ...packet, timeMs: toMs, toMs, stop, plain: packet.status ? 'I²C1 事务失败' : 'I²C1 事务完成'});
      if (history.length > MAX_EVENTS) history.shift();
    }
    packet = null;
    statusRead = 0;
    set(SR1, get(SR1) & (BERR | AF));
    updateRxStatus();
    set(SR2, stop ? 0 : MSL | BUSY);
    if (stop) set(CR1, get(CR1) & ~(START | STOP));
  }

  function resolveBoundary() {
    if (!boundary || pending || active) return;
    const stop = boundary === 'stop';
    boundary = null;
    if (packet?.direction === 'write' && !packet.status && packet.bytes.length) {
      const reason = routeReason();
      if (reason) flagError(4, reason);
      else {
        queue('write', {bytes: [...packet.bytes], stop}, response => {
          if (response.status) {
            flagError(response.status, response.reason);
            set(CR1, get(CR1) & ~START);
            if (stop) finish(true);
          } else {
            finish(stop);
            if (!stop) start(true);
          }
        });
        return;
      }
    }
    const failed = packet?.status;
    finish(stop);
    if (!stop && !failed) start(true);
    else set(CR1, get(CR1) & ~START);
  }

  function fillRx() {
    if (packet?.direction !== 'read' || packet.status || rxFinished || (get(SR1) & ADDR) || pending || active || rx.length >= 2) return;
    const offset = packet.bytes.length;
    if (posTwo && offset === 1 && (get(CR1) & ACK)) return;
    const reason = routeReason();
    if (reason) {
      flagError(4, reason);
      return;
    }
    const ack = posTwo ? offset === 0 : offset < MAX_READ - 1 && !!(get(CR1) & ACK);
    queue('read', {quantity: 1, offset, ack}, response => {
      const byte = response.bytes?.[0];
      if (response.status || !Number.isInteger(byte) || byte < 0 || byte > 255) {
        flagError(4, response.reason || 'missing-read-byte');
        return;
      }
      packet.bytes.push(byte);
      rx.push(byte);
      rxFinished = !ack;
      updateRxStatus();
    }, true);
  }

  function writeData(byte) {
    if (!packet || packet.status || pending || active) return;
    if ((statusRead & SB) && (get(SR1) & SB)) {
      set(SR1, get(SR1) & ~SB);
      statusRead &= ~SB;
      packet.address = byte >>> 1;
      packet.direction = byte & 1 ? 'read' : 'write';
      const reason = routeReason() || (!packet.sclHz ? 'invalid-i2c-clock' : null)
        || ((byte & 0xf8) === 0xf0 ? 'unsupported-i2c-address' : null);
      if (reason) {
        flagError(4, reason);
        return;
      }
      queue('address', {direction: packet.direction}, response => {
        if (response.deviceId) packet.deviceId = response.deviceId;
        if (response.status) flagError(response.status, response.reason);
        else {
          const transmitting = packet.direction === 'write';
          set(SR1, get(SR1) | ADDR | (transmitting ? TXE : 0));
          if (transmitting) set(SR2, get(SR2) | TRA);
        }
      }, true);
    } else if (packet.direction === 'write' && !(get(SR1) & ADDR) && (get(SR1) & TXE)) {
      if (packet.bytes.length >= MAX_WRITE) {
        flagError(1, 'write-buffer-limit');
        return;
      }
      packet.bytes.push(byte);
      set(SR1, get(SR1) & ~(TXE | BTF));
      const reason = routeReason();
      if (reason) {
        flagError(4, reason);
        return;
      }
      queue('address', {direction: 'write'}, response => {
        if (response.status) flagError(response.status === 2 ? 3 : response.status, response.reason);
        else set(SR1, get(SR1) | TXE | BTF);
      }, true);
    }
  }

  function read(offset, width) {
    if (!clocked()) return 0;
    const register = offset & ~3;
    let value = get(register) ?? 0;
    if (!(offset & 3)) {
      if (register === SR1) statusRead = value;
      if (register === SR2 && (statusRead & ADDR) && (get(SR1) & ADDR)) {
        set(SR1, get(SR1) & ~ADDR);
        statusRead &= ~ADDR;
        posTwo = !!(get(CR1) & POS);
        fillRx();
      }
      if (register === DR && rx.length) {
        value = rx.shift();
        set(DR, value);
        updateRxStatus();
        fillRx();
      }
    }
    return (value >>> ((offset & 3) * 8)) & (width === 1 ? 0xff : 0xffff);
  }

  function write(offset, width, value) {
    if (!clocked()) return;
    const register = offset & ~3, shift = (offset & 3) * 8;
    const mask = ((width === 1 ? 0xff : 0xffff) << shift) & 0xffff;
    const data = (value << shift) & mask;
    const previous = get(register) ?? 0;
    const next = (previous & ~mask) | data;
    if (register === CR1) {
      if (next & SWRST) {
        resetRegisters();
        set(CR1, SWRST);
        return;
      }
      set(CR1, next & (PE | START | STOP | ACK | POS));
      if (!(next & PE)) {
        clearTransfer();
        set(CR1, 0);
        return;
      }
      if ((next & STOP) && !(previous & STOP)) {
        boundary = 'stop';
        resolveBoundary();
      } else if ((next & START) && !(previous & START)) {
        if (packet) {
          boundary = 'restart';
          resolveBoundary();
        } else start(!!(get(SR2) & BUSY));
      } else if ((next ^ previous) & ACK) fillRx();
    } else if (register === DR && (mask & 0xff) && (get(CR1) & PE)) {
      writeData(data & 0xff);
    } else if (register === SR1) {
      set(SR1, previous & ~((BERR | AF) & mask & ~data));
    } else if (CONFIG_MASKS.has(register)) {
      set(register, next & CONFIG_MASKS.get(register));
    }
  }

  function takeRequest() {
    if (!clocked() || !pending || now() < pending.dueMs) return null;
    active = pending;
    pending = null;
    return active.request;
  }

  function completeRequest(response) {
    if (!clocked() || !active) return;
    const {apply} = active;
    active = null;
    apply(response);
    resolveBoundary();
    fillRx();
  }

  function getState() {
    const clockEnabled = clocked();
    return {clockEnabled, enabled: clockEnabled && !!(get(CR1) & PE), busy: clockEnabled && !!(get(SR2) & BUSY),
      sclHz: clockEnabled ? sclHz() : 0, sr1: clockEnabled ? get(SR1) : 0, sr2: clockEnabled ? get(SR2) : 0};
  }

  resetRegisters();
  return {read, write, takeRequest, completeRequest, getState,
    events: () => history.map(event => ({...event, bytes: [...event.bytes]}))};
}
