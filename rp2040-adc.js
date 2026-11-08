// RP2040 datasheet sections 2.15 and 4.9. The lab adds board voltages to
// rp2040js's native MMIO converter and preserves its FIFO data path.
const CS = 0x00;
const FCS = 0x08;
const FIFO = 0x0c;
const EN = 1;
const START_ONCE = 1 << 2;
const START_MANY = 1 << 3;
const READY = 1 << 8;
const ERR_STICKY = 1 << 10;
const AINSEL = 7 << 12;
const RROBIN = 31 << 16;
const FIFO_W1C = (1 << 10) | (1 << 11);
const FIFO_DREQ = 1 << 3;
const ADC_CLOCK = 48_000_000;
const CONVERSION_CYCLES = 96;
const INPUTS = ['GP26', 'GP27', 'GP28'];

export function rp2040AdcClockHz(rp) {
  // ADC_DIV readback is incomplete in rp2040js 1.4.1. The peripheral does
  // preserve raw writes in adcDiv, so decode that register value directly.
  const {adcCtrl, adcDiv} = rp.clocks;
  if (!(adcCtrl & (1 << 11)) || (adcCtrl & (1 << 10))) return 0;
  const source = (adcCtrl >>> 5) & 7;
  const frequencies = [rp.pllUsb.frequency, rp.pllSys.frequency, rp.roscFreq, rp.xoscFreq];
  const divisor = ((adcDiv >>> 8) & 3) || 65536;
  return (frequencies[source] || 0) / divisor;
}

function warning(code, plain, technical, fix) {
  return {severity: 'warning', code, plain, technical, fix};
}

export function installRp2040Adc({adc, clock, readVoltage, readReference = () => 3.3, clockHz = () => ADC_CLOCK}) {
  // Current RP2040 datasheet section 4.9.2.4 corrects the FIFO depth to eight.
  adc.fifo = new adc.fifo.constructor(8);
  const read = adc.readUint32.bind(adc);
  const write = adc.writeUint32.bind(adc);
  const writeAtomic = adc.writeUint32Atomic.bind(adc);
  const complete = adc.completeADCRead.bind(adc);
  let active = null;
  let last = null;
  let command = null;
  const sampleAlarm = clock.createAlarm(finish);
  const paceAlarm = clock.createAlarm(() => {
    paceAlarm.cancel();
    if (adc.enabled && (adc.cs & START_MANY) && !adc.busy) adc.startADCRead();
  });

  function takeSample(channel) {
    const pin = INPUTS[channel];
    const hz = clockHz();
    const validClock = Number.isFinite(hz) && hz > 0;
    const referenceVoltage = readReference();
    const voltage = pin ? readVoltage(pin) : undefined;
    let error = null;
    if (!pin) {
      error = warning('RP2040_ADC_CHANNEL', '所选 ADC 通道未接入 Pico 实验电路。',
        'AINSEL=' + channel, '使用 GP26、GP27 或 GP28。GP29 的板内 VSYS 分压和芯片温度未建模。');
    } else if (!validClock) {
      error = warning('RP2040_ADC_CLOCK', 'ADC 目前没有可用的转换时钟。',
        'clk_adc=' + hz, '在启用 ADC 前配置 48 MHz clk_adc，通常取自 USB PLL。');
    } else if (!Number.isFinite(referenceVoltage) || referenceVoltage <= 0) {
      error = warning('RP2040_ADC_REFERENCE', 'ADC 参考电压无效。',
        'ADC_VREF=' + referenceVoltage, '检查电路的参考电压。');
    } else if (!Number.isFinite(voltage)) {
      error = warning('RP2040_ADC_VOLTAGE', '该 ADC 通道没有可用的电路电压。',
        pin, '将模拟信号接到该引脚，并与 Pico 共地。');
    }
    const result = error ? null : Math.round(Math.max(0, Math.min(1, voltage / referenceVoltage)) * 4095);
    active = {channel, pin, voltage: Number.isFinite(voltage) ? voltage : null,
      referenceVoltage: Number.isFinite(referenceVoltage) && referenceVoltage > 0 ? referenceVoltage : null,
      result, error, hz: validClock ? hz : ADC_CLOCK};
    adc.currentChannel = channel;
    sampleAlarm.schedule(CONVERSION_CYCLES * 1e9 / active.hz);
  }

  function finish() {
    sampleAlarm.cancel();
    const sample = active;
    if (!sample) return;
    active = null;
    last = sample;
    const sequence = adc.cs & RROBIN;
    const continuous = adc.cs & START_MANY;
    // Upstream sequences with an incorrect AINSEL mask and assumes 48 MHz
    // when pacing continuous conversions. Delegate RESULT/FIFO/IRQ/DREQ,
    // then update the mux and pacing against the selected ADC clock.
    adc.cs &= ~(RROBIN | START_MANY);
    complete(sample.result ?? 0, !!sample.error);
    adc.cs |= sequence | continuous;
    if (sequence) {
      const channels = sequence >>> 16;
      let next = sample.channel % 5;
      do { next = (next + 1) % 5; } while (!(channels & (1 << next)));
      adc.cs = (adc.cs & ~AINSEL) | (next << 12);
    }
    if (continuous && adc.enabled && !sample.error) {
      const delay = Math.max(0, adc.divider - CONVERSION_CYCLES) * 1e9 / sample.hz;
      if (delay) paceAlarm.schedule(delay);
      else adc.startADCRead();
    }
  }

  adc.onADCRead = takeSample;
  adc.readUint32 = offset => {
    const value = read(offset);
    if (offset === CS && !adc.enabled) return value & ~READY;
    if (offset === FIFO) adc.checkInterrupts();
    return value;
  };
  adc.writeUint32Atomic = (offset, value, type) => {
    command = {value, type};
    try {
      writeAtomic(offset, value, type);
    } finally {
      command = null;
    }
  };
  adc.writeUint32 = (offset, value) => {
    const writtenOnes = command?.type === 3 ? 0 : command?.value ?? value;
    if (offset === CS) {
      if (writtenOnes & ERR_STICKY) adc.cs &= ~ERR_STICKY;
      const pacing = paceAlarm.scheduled && (value & START_MANY);
      const startMask = pacing ? START_MANY | START_ONCE : 0;
      write(offset, value & ~(ERR_STICKY | startMask));
      if (pacing) adc.cs |= START_MANY;
      adc.cs &= ~START_ONCE;
      if (!(value & START_MANY) || !(value & EN)) paceAlarm.cancel();
      if (!(value & EN) && active) {
        sampleAlarm.cancel();
        active = null;
        adc.busy = false;
      }
    } else if (offset === FCS) {
      write(offset, (value & ~FIFO_W1C) | (writtenOnes & FIFO_W1C));
      if (value & FIFO_DREQ) adc.updateDMA();
      else adc.rp2040.dma.clearDREQ(adc.dreq);
    } else {
      write(offset, value);
    }
  };

  return {
    getState() {
      const selected = active || last;
      return {
        enabled: !!adc.enabled, busy: !!adc.busy, channel: selected?.channel, pin: selected?.pin,
        result: last?.result ?? null, resultPin: last?.pin, voltage: last?.voltage ?? null,
        referenceVoltage: last?.referenceVoltage ?? null, fifoLevel: adc.fifo.itemCount,
        error: last?.error ?? null,
      };
    },
  };
}
