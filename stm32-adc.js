// STM32F103 ADC1 regular single-conversion subset, ST RM0008 chapter 11.
const SR = 0x00;
const CR1 = 0x04;
const CR2 = 0x08;
const SMPR1 = 0x0c;
const SMPR2 = 0x10;
const SQR1 = 0x2c;
const SQR3 = 0x34;
const DR = 0x4c;
const ADON = 1;
const CAL = 1 << 2;
const RSTCAL = 1 << 3;
const ALIGN = 1 << 11;
const EXTSEL = 7 << 17;
const EXTTRIG = 1 << 20;
const JSWSTART = 1 << 21;
const SWSTART = 1 << 22;
const EOC = 1 << 1;
const STRT = 1 << 4;
const MAX_CODE = 4095;
const VREF = 3.3;
const SAMPLE_TICKS = [1.5, 7.5, 13.5, 28.5, 41.5, 55.5, 71.5, 239.5];
const ADC_PINS = ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1',
  'PC0', 'PC1', 'PC2', 'PC3', 'PC4', 'PC5'];
const BLUE_PILL_PINS = ADC_PINS.slice(0, 10);
const CR1_UNSUPPORTED = (1 << 5) | (1 << 6) | (1 << 7) | (1 << 10) | (1 << 11) | (1 << 12)
  | (15 << 16) | (1 << 22) | (1 << 23);
const CR2_UNSUPPORTED = (1 << 1) | (1 << 8);
const REGISTER_MASKS = new Map([
  [CR1, 0x00cfffff], [CR2, 0x00fef90f], [SMPR1, 0x00ffffff], [SMPR2, 0x3fffffff],
  [0x14, 0xfff], [0x18, 0xfff], [0x1c, 0xfff], [0x20, 0xfff],
  [0x24, 0xfff], [0x28, 0xfff], [SQR1, 0x00ffffff], [0x30, 0x3fffffff],
  [SQR3, 0x3fffffff], [0x38, 0x003fffff],
]);

function widthMask(size) {
  return size === 1 ? 0xff : size === 2 ? 0xffff : 0xffffffff;
}

export function createStm32Adc({isClocked, readVoltage, clockHz, inputPins = BLUE_PILL_PINS}) {
  const registers = new Uint32Array(DR / 4 + 1);
  const exposed = new Set(inputPins);
  let conversion, calibration, calibrated, last, error;
  const get = offset => registers[offset / 4];
  const set = (offset, value) => { registers[offset / 4] = value; };

  function reset() {
    registers.fill(0);
    set(0x24, MAX_CODE); // ADC_HTR
    conversion = null;
    calibration = null;
    calibrated = false;
    last = null;
    error = null;
  }

  function fail(code, plain, technical, fix) {
    error = {severity: 'error', code, plain, technical, fix};
  }

  function clockRatio() {
    const {coreHz, adcHz} = clockHz();
    if (!(coreHz > 0) || !(adcHz >= 600_000 && adcHz <= 14_000_000)) {
      fail('STM32_ADC_CLOCK', 'ADC1 时钟超出当前可转换范围。',
        'ADC 时钟 ' + adcHz + ' Hz', '用 RCC 的 ADC 分频将 ADC 时钟设置在 0.6–14 MHz。');
      return 0;
    }
    return adcHz / coreHz;
  }

  function startConversion(control) {
    if (conversion || calibration) return;
    const cr1 = get(CR1), length = ((get(SQR1) >>> 20) & 15) + 1;
    if (length !== 1 || (cr1 & CR1_UNSUPPORTED) || (control & CR2_UNSUPPORTED)) {
      fail('STM32_ADC_MODE', '当前 ADC1 原生仿真支持轮询的单通道单次规则转换。',
        'CR1 0x' + cr1.toString(16) + ' · CR2 0x' + control.toString(16) + ' · 序列长度 ' + length,
        '选择独立单通道，关闭连续转换、DMA、ADC 中断和注入组。');
      return;
    }
    const channel = get(SQR3) & 31;
    const pin = ADC_PINS[channel];
    if (!pin || !exposed.has(pin)) {
      fail('STM32_ADC_CHANNEL', '所选 ADC1 通道未接入当前板型的模拟电路。',
        'ADC1 通道 ' + channel, '选择当前可用的模拟引脚（' + inputPins.join('、') + '）。');
      return;
    }
    if (!clockRatio()) return;
    const sampleCode = channel < 10 ? get(SMPR2) >>> (channel * 3) : get(SMPR1) >>> ((channel - 10) * 3);
    const sampleTicks = SAMPLE_TICKS[sampleCode & 7];
    conversion = {pin, channel, sampleTicks, remaining: sampleTicks + 12.5, voltage: null, result: null};
    set(SR, get(SR) | STRT);
  }

  function writeControl(value, mask) {
    const previous = get(CR2);
    const requested = ((previous & ~mask) | (value & mask)) & REGISTER_MASKS.get(CR2);
    const control = requested & ~(SWSTART | JSWSTART | CAL | RSTCAL);
    set(CR2, control | (calibration?.flag ?? 0));
    if (!(control & ADON)) {
      conversion = null;
      calibration = null;
      set(CR2, control);
      return;
    }
    if (calibration) return;
    if (requested & (CAL | RSTCAL)) {
      if (!clockRatio()) return;
      const flag = requested & RSTCAL ? RSTCAL : CAL;
      conversion = null;
      calibration = {flag, remaining: flag === RSTCAL ? 2 : 83};
      set(CR2, control | flag);
      return;
    }
    if (requested & JSWSTART) {
      fail('STM32_ADC_INJECTED', '原生 ADC1 尚未实现注入组转换。', 'ADC_CR2.JSWSTART',
        '使用规则通道寄存器 SQR3 和 SWSTART 启动采样。');
      return;
    }
    if (requested & SWSTART) {
      if ((control & (EXTSEL | EXTTRIG)) !== (EXTSEL | EXTTRIG)) {
        fail('STM32_ADC_TRIGGER', 'SWSTART 需要选择规则软件触发。', 'ADC_CR2.EXTSEL / EXTTRIG',
          '将 EXTSEL 设为 111，置位 EXTTRIG，然后写 SWSTART。');
      } else {
        startConversion(control);
      }
    } else if ((previous & ADON) && (mask & value & ADON) && previous === control) {
      // A second write of ADON=1 with the other CR2 bits unchanged also starts ADC1.
      startConversion(control);
    }
  }

  function read(offset, size = 4) {
    const address = offset & ~3;
    if (offset < 0 || address > DR || !isClocked()) return 0;
    const value = get(address);
    if (address === DR) set(SR, get(SR) & ~EOC);
    return ((value >>> ((offset & 3) * 8)) & widthMask(size)) >>> 0;
  }

  function write(offset, size, value) {
    if (!isClocked() || error || offset < 0) return;
    const address = offset & ~3;
    const shift = (offset & 3) * 8;
    const mask = widthMask(size) << shift;
    const shifted = value << shift;
    if (address === SR) {
      set(SR, get(SR) & (shifted | ~mask));
    } else if (address === CR2) {
      writeControl(shifted, mask);
    } else if (REGISTER_MASKS.has(address)) {
      set(address, ((get(address) & ~mask) | (shifted & mask)) & REGISTER_MASKS.get(address));
    }
  }

  function advance(coreCycles) {
    if (!(coreCycles > 0) || error || !isClocked() || !(get(CR2) & ADON)) return;
    if (calibration || conversion) {
      const ticks = coreCycles * clockRatio();
      if (!ticks) return;
      if (calibration) {
        calibration.remaining -= ticks;
        if (calibration.remaining <= 0) {
          calibrated = calibration.flag === CAL;
          set(CR2, get(CR2) & ~calibration.flag);
          if (calibrated) set(DR, 0); // ideal offset correction after calibration
          calibration = null;
        }
      } else {
        conversion.remaining -= ticks;
        conversion.sampleTicks -= ticks;
        if (conversion.sampleTicks <= 0 && conversion.result === null) {
          const voltage = readVoltage(conversion.pin);
          conversion.voltage = Number.isFinite(voltage) ? voltage : null;
          conversion.result = Math.round(Math.max(0, Math.min(VREF, conversion.voltage ?? 0)) * MAX_CODE / VREF);
        }
        if (conversion.remaining <= 0) {
          set(DR, get(CR2) & ALIGN ? conversion.result << 4 : conversion.result);
          set(SR, get(SR) | EOC);
          last = conversion;
          conversion = null;
        }
      }
      return;
    }
    const control = get(CR2);
    if ((control & EXTTRIG) && (control & EXTSEL) !== EXTSEL) {
      fail('STM32_ADC_TRIGGER', '当前原生 ADC1 尚未连接定时器或 EXTI 触发源。',
        'ADC_CR2.EXTSEL=' + ((control & EXTSEL) >>> 17),
        '选择规则软件触发，并写入 SWSTART 启动每次转换。');
    }
  }

  function getState() {
    const current = conversion || last;
    return {
      enabled: isClocked() && !!(get(CR2) & ADON), busy: !!conversion,
      calibrating: !!calibration, calibrated, eoc: !!(get(SR) & EOC),
      pin: current?.pin, channel: current?.channel, result: last?.result ?? null,
      resultPin: last?.pin, voltage: last?.voltage ?? null, referenceVoltage: VREF, error,
    };
  }

  reset();
  return {read, write, advance, getState, reset};
}
