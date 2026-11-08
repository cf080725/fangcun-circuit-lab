// ATmega328P sections 23.4, 23.6, 23.9; ATmega2560 tables 26-3 and 26-4.
const ADCL = 0x78;
const ADCH = 0x79;
const ADCSRA = 0x7a;
const ADCSRB = 0x7b;
const ADMUX = 0x7c;
const ADEN = 0x80;
const ADSC = 0x40;
const ADATE = 0x20;
const ADIF = 0x10;
const ADIE = 0x08;
const ADLAR = 0x20;
const PRESCALERS = [2, 2, 4, 8, 16, 32, 64, 128];
const AVCC = 5;
const INTERNAL_REF = 1.1;
const INTERRUPT = {
  address: 0x2a, flagRegister: ADCSRA, flagMask: ADIF,
  enableRegister: ADCSRA, enableMask: ADIE,
};

export function installAvrAdc(cpu, {boardId, readAnalog, readReference, fail}) {
  const mega = boardId === 'mega2560';
  const channelCount = boardId === 'nano' ? 8 : 6;
  const interrupt = mega ? {...INTERRUPT,address:0x3a} : INTERRUPT;
  const references = mega ? [undefined,AVCC,INTERNAL_REF,2.56] : [undefined,AVCC,undefined,INTERNAL_REF];
  let first = true;
  let locked = false;
  let result = null;
  let active = null;
  let last = null;

  function sample() {
    const conversion = active;
    const {source, reference, pin, pc} = conversion;
    const referenceVoltage = reference === 0 ? readReference?.() : references[reference];
    if (!Number.isFinite(referenceVoltage) || referenceVoltage <= 0 || referenceVoltage > AVCC) {
      active = null;
      cpu.data[ADCSRA] &= ~ADSC;
      fail('AVR_ADC_REFERENCE', 'ADC 使用外部 AREF，但没有测到有效的参考电压。', '将稳定的参考电压接到 AREF 并共地，或改用默认 AVCC 参考。', pc);
      return;
    }
    const voltage = pin ? readAnalog?.(pin) : source === 'bandgap' ? INTERNAL_REF : 0;
    const raw = Number.isFinite(voltage) ? Math.floor(voltage * 1024 / referenceVoltage) : 0;
    conversion.value = Math.max(0, Math.min(1023, raw));
    conversion.referenceVoltage = referenceVoltage;
    cpu.addClockEvent(complete, conversion.endCycle - cpu.cycles);
  }

  function complete() {
    if (!locked) {
      result = active.value;
      last = active;
    }
    active = null;
    first = false;
    cpu.data[ADCSRA] &= ~ADSC;
    cpu.setInterruptFlag(interrupt);
  }

  function abort() {
    if (!active) return;
    cpu.clearClockEvent(sample);
    cpu.clearClockEvent(complete);
    cpu.data[ADCSRA] &= ~ADSC;
    active = null;
  }

  function start(value) {
    const mux = cpu.data[ADMUX];
    const muxCode = (mux & (mega ? 0x1f : 0x0f)) | (mega ? (cpu.data[ADCSRB] & 0x08) << 2 : 0);
    let channel;
    if (mega) {
      if (muxCode < 8) channel = muxCode;
      else if (muxCode >= 32 && muxCode < 40) channel = muxCode-24;
    } else if (muxCode < channelCount) {
      channel = muxCode;
    }
    const pin = channel === undefined ? null : 'A'+channel;
    const bandgapCode = mega ? 30 : 14;
    const source = pin ? 'pin' : muxCode === bandgapCode ? 'bandgap' : muxCode === bandgapCode+1 ? 'ground' : null;
    const reference = mux >> 6;
    if (!source || (!mega && reference === 2)) {
      fail('AVR_ADC_SELECTION', 'ADC 选择了当前模型未提供的通道或参考源。', '请选择板上的单端 A 引脚，并检查 ADMUX 和参考电压设置。');
      return;
    }
    const prescaler = PRESCALERS[value & 7];
    active = {
      channel: channel ?? muxCode, reference, pin, source, pc: cpu.pc,
      endCycle: cpu.cycles + (first ? 25 : 13) * prescaler,
    };
    cpu.data[ADCSRA] |= ADSC;
    // Timing is relative to the start write. The sub-prescaler edge phase
    // and analog settling of the reference/sample capacitor are not modeled.
    cpu.addClockEvent(sample, (first ? 13.5 : 1.5) * prescaler);
  }

  cpu.writeHooks[ADCSRA] = (value, old) => {
    cpu.data[ADCSRA] = (value & ~(ADSC | ADIF)) | (old & (ADSC | ADIF));
    cpu.clearInterruptByFlag(interrupt, value);
    cpu.updateInterruptEnable(interrupt, value);
    if (!(value & ADEN)) {
      abort();
      first = true;
    } else if (value & ADATE) {
      abort();
      fail('AVR_ADC_AUTO_TRIGGER', '原生 ADC 目前支持单次转换，固件启用了自动触发。', '关闭 ADATE，每次写入 ADSC 启动转换。');
    } else if ((value & ADSC) && !active) {
      start(value);
    }
    return true;
  };

  cpu.readHooks[ADCL] = () => {
    locked = true;
    return cpu.data[ADMUX] & ADLAR ? (result << 6) & 0xff : result & 0xff;
  };
  cpu.readHooks[ADCH] = () => {
    locked = false;
    return result >> (cpu.data[ADMUX] & ADLAR ? 2 : 8);
  };
  for (const address of [ADCL, ADCH]) cpu.writeHooks[address] = () => true;

  return () => {
    const conversion = active || last;
    return {
      enabled: !!(cpu.data[ADCSRA] & ADEN), busy: !!active, result,
      channel: conversion?.channel, pin: conversion?.pin,
      resultPin: last?.pin, resultChannel: last?.channel, resultSource: last?.source, referenceVoltage: conversion?.referenceVoltage,
    };
  };
}
