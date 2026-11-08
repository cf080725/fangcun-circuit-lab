// AVR master TWI register model. ATmega328P and ATmega2560 use the same
// data-space register addresses, but different interrupt word addresses.
const TWBR = 0xb8;
const TWSR = 0xb9;
const TWAR = 0xba;
const TWDR = 0xbb;
const TWCR = 0xbc;
const TWAMR = 0xbd;
const TWINT = 0x80;
const TWEA = 0x40;
const TWSTA = 0x20;
const TWSTO = 0x10;
const TWWC = 0x08;
const TWEN = 0x04;
const TWIE = 0x01;
const IDLE = 0xf8;
const BUS_ERROR = 0x00;
const START = 0x08;
const REPEATED_START = 0x10;
const WRITE_ADDRESS_ACK = 0x18;
const WRITE_ADDRESS_NACK = 0x20;
const WRITE_DATA_ACK = 0x28;
const WRITE_DATA_NACK = 0x30;
const READ_ADDRESS_ACK = 0x40;
const READ_ADDRESS_NACK = 0x48;
const READ_DATA_ACK = 0x50;
const READ_DATA_NACK = 0x58;
const MAX_PACKET_BYTES = 4096;
const MAX_EVENTS = 64;
const MAX_BUS_SEGMENTS = 64;

export function installAvrTwi(cpu, {boardId, clockHz, getState, i2cAddress, writeI2c, readI2c}) {
  const interrupt = {address:boardId === 'mega2560' ? 0x4e : 0x30,
    flagRegister:TWCR,flagMask:TWINT,enableRegister:TWCR,enableMask:TWIE,constant:true};
  const events = [];
  let active = null;
  let packet = null;
  let phase = 'idle';
  cpu.data[TWSR] = IDLE;
  cpu.data[TWAR] = 0xfe;
  cpu.data[TWDR] = 0xff;

  const periodCycles = () => 16 + 2 * cpu.data[TWBR] * 4 ** (cpu.data[TWSR] & 3);
  const time = cycles => cycles * 1000 / clockHz;
  const status = () => (cpu.data[TWCR] & TWINT ? cpu.data[TWSR] & 0xf8 : IDLE);

  function signal(code) {
    cpu.data[TWSR] = code | (cpu.data[TWSR] & 3);
    cpu.setInterruptFlag(interrupt);
  }

  function schedule(bits, complete) {
    const started = cpu.cycles;
    const period = periodCycles();
    const duration = bits * period;
    const callback = () => {
      if (active !== callback) return;
      active = null;
      // The edge schedule ends at its due cycle. The next instruction may
      // observe it later, leaving the actual firmware gap before the next byte.
      complete({fromMs:time(started),toMs:time(started + duration),sclHz:clockHz / period});
    };
    active = cpu.addClockEvent(callback, duration);
  }

  function call(hook, ...args) {
    if (!hook) return {status:2,reason:'address-nack'};
    try {
      const result = hook(...args);
      if (Number.isInteger(result?.status) && result.status >= 0 && result.status <= 4) return result;
      return {status:4,reason:'invalid-bus-result'};
    } catch {
      return {status:4,reason:'hook-error'};
    }
  }

  function recordSegment(kind, byte, ack, timing) {
    if (packet.busSegments.length < MAX_BUS_SEGMENTS) {
      packet.busSegments.push({kind,byte,ack,...timing});
    } else {
      packet.busSegmentsOmitted++;
    }
  }

  function finish(stopEdge) {
    if (!packet || packet.address === null) return;
    const stop = Boolean(stopEdge);
    let {status, reason, deviceId} = packet;
    const {direction,address,bytes,repeatedStart,fromMs,sclHz,startEdge,busSegments,busSegmentsOmitted} = packet;
    if (direction === 'write' && !status) {
      const state = getState();
      const target = call(i2cAddress,address,direction,state,{repeatedStart});
      const changed = target.deviceId != null && deviceId != null && target.deviceId !== deviceId;
      const response = target.status ? target : changed ? {status:4,reason:'target-changed'}
        : call(writeI2c,address,[...bytes],state,{stop,repeatedStart});
      status = response.status;
      reason = response.reason;
      deviceId = response.deviceId ?? deviceId;
    }
    const toMs = time(cpu.cycles);
    const labels = [direction === 'read' ? '读取已应答' : '写入已应答',
      '发送缓冲区溢出','地址未应答','数据未应答','总线传输失败'];
    events.push({type:'i2c',direction,address,bytes:[...bytes],status,reason:reason ?? null,
      deviceId:deviceId ?? null,stop,repeatedStart,fromMs,toMs,timeMs:toMs,sclHz,
      startEdge,...(stopEdge && {stopEdge}),busSegments,busSegmentsOmitted,
      plain:'I²C ' + labels[status]});
    if (events.length > MAX_EVENTS) events.shift();
  }

  function start(startEdge) {
    const repeatedStart = Boolean(packet);
    finish();
    const fromMs = repeatedStart ? time(cpu.cycles) : startEdge.fromMs;
    packet = {address:null,direction:null,bytes:[],status:0,repeatedStart,fromMs,sclHz:startEdge.sclHz,
      startEdge,busSegments:[],busSegmentsOmitted:0};
    phase = 'address';
    signal(repeatedStart ? REPEATED_START : START);
  }

  function stop(stopEdge) {
    finish(stopEdge);
    packet = null;
    phase = 'idle';
    cpu.data[TWCR] &= ~TWSTO;
    cpu.data[TWSR] = IDLE | (cpu.data[TWSR] & 3);
  }

  function reject(response, code, status) {
    packet.status = status;
    packet.reason = response.reason;
    phase = 'halted';
    signal(code);
  }

  function connect(value, timing) {
    const direction = value & 1 ? 'read' : 'write';
    const address = value >> 1;
    Object.assign(packet,{address,direction});
    const response = call(i2cAddress,address,direction,getState(),{repeatedStart:packet.repeatedStart});
    recordSegment('address',value,response.status === 4 ? null : !response.status,timing);
    packet.deviceId = response.deviceId;
    if (!response.status) {
      phase = direction;
      signal(direction === 'read' ? READ_ADDRESS_ACK : WRITE_ADDRESS_ACK);
    } else if (response.status === 4) reject(response,BUS_ERROR,4);
    else reject(response,direction === 'read' ? READ_ADDRESS_NACK : WRITE_ADDRESS_NACK,2);
  }

  function send(value, timing) {
    const {address,direction,repeatedStart,bytes} = packet;
    if (bytes.length >= MAX_PACKET_BYTES) {
      recordSegment('data',value,false,timing);
      reject({reason:'buffer-overflow'},WRITE_DATA_NACK,1);
      return;
    }
    bytes.push(value);
    const response = call(i2cAddress,address,direction,getState(),{repeatedStart});
    const changed = response.deviceId != null && packet.deviceId != null && response.deviceId !== packet.deviceId;
    recordSegment('data',value,response.status === 4 ? null : !response.status && !changed,timing);
    if (response.status === 4) reject(response,BUS_ERROR,4);
    else if (response.status || changed)
      reject({reason:response.reason ?? 'target-changed'},WRITE_DATA_NACK,3);
    else signal(WRITE_DATA_ACK);
  }

  function receive(ack, timing) {
    const {address,repeatedStart,bytes} = packet;
    if (bytes.length >= MAX_PACKET_BYTES) {
      recordSegment('data',null,null,timing);
      cpu.data[TWDR] = 0xff;
      reject({reason:'buffer-overflow'},BUS_ERROR,4);
      return;
    }
    const response = call(readI2c,address,1,getState(),{offset:bytes.length,repeatedStart,stop:false,ack});
    const byte = response.bytes?.[0];
    const changed = response.deviceId != null && packet.deviceId != null && response.deviceId !== packet.deviceId;
    if (response.status || changed || !Number.isInteger(byte) || byte < 0 || byte > 255) {
      recordSegment('data',null,null,timing);
      cpu.data[TWDR] = 0xff;
      const reason = response.reason ?? (changed ? 'target-changed' : 'short-read');
      reject({reason},BUS_ERROR,4);
      return;
    }
    cpu.data[TWDR] = byte;
    bytes.push(byte);
    recordSegment('data',byte,ack,timing);
    if (!ack) phase = 'halted';
    signal(ack ? READ_DATA_ACK : READ_DATA_NACK);
  }

  function abort() {
    if (active) cpu.clearClockEvent(active);
    active = packet = null;
    phase = 'idle';
    cpu.clearInterrupt(interrupt);
    cpu.data[TWCR] &= ~(TWSTA | TWSTO | TWWC);
    cpu.data[TWSR] = IDLE | (cpu.data[TWSR] & 3);
  }

  cpu.readHooks[TWSR] = () => status() | (cpu.data[TWSR] & 3);
  cpu.writeHooks[TWSR] = value => {
    cpu.data[TWSR] = (cpu.data[TWSR] & 0xf8) | (value & 3);
    return true;
  };
  cpu.writeHooks[TWAMR] = value => {
    cpu.data[TWAMR] = value & 0xfe;
    return true;
  };
  cpu.writeHooks[TWDR] = value => {
    if ((cpu.data[TWCR] & (TWEN | TWINT)) === TWEN) {
      cpu.data[TWCR] |= TWWC;
      return true;
    }
    cpu.data[TWCR] &= ~TWWC;
    cpu.data[TWDR] = value;
    return true;
  };
  cpu.writeHooks[TWCR] = (value, old) => {
    cpu.data[TWCR] = (value & (TWEA | TWSTA | TWSTO | TWEN | TWIE)) | (old & (TWINT | TWWC));
    if (!(value & TWEN)) {
      abort();
      return true;
    }
    if (value & TWINT) cpu.clearInterrupt(interrupt);
    cpu.updateInterruptEnable(interrupt,cpu.data[TWCR]);
    if (!(value & TWINT) || active) return true;
    const data = cpu.data[TWDR];
    if (value & TWSTO) schedule(1,stop);
    else if (value & TWSTA) schedule(1,start);
    else if (phase === 'address') schedule(9,timing => connect(data,timing));
    else if (phase === 'write') schedule(9,timing => send(data,timing));
    else if (phase === 'read') schedule(9,timing => receive(Boolean(value & TWEA),timing));
    return true;
  };

  return {
    snapshot: () => ({enabled:!!(cpu.data[TWCR] & TWEN),busy:!!active,phase,status:status(),
      sclHz:clockHz / periodCycles(),address:packet?.address ?? null,direction:packet?.direction ?? null,
      TWBR:cpu.data[TWBR],TWSR:cpu.readHooks[TWSR](),TWAR:cpu.data[TWAR],
      TWCR:cpu.data[TWCR],TWDR:cpu.data[TWDR],TWAMR:cpu.data[TWAMR]}),
    events: () => events.map(event => ({...event,bytes:[...event.bytes],startEdge:{...event.startEdge},
      ...(event.stopEdge && {stopEdge:{...event.stopEdge}}),busSegments:event.busSegments.map(segment => ({...segment}))})),
  };
}
