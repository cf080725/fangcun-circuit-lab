// RM0008: AFIO_MAPR remaps and TIM2–TIM4 up-counting PWM mode.
// https://www.st.com/content/ccc/resource/technical/document/reference_manual/59/b9/ba/7f/11/af/43/d5/CD00171190.pdf/files/CD00171190.pdf/jcr%3Acontent/translations/en.CD00171190.pdf
const TIM2_PINS = [
  ['PA0', 'PA1', 'PA2', 'PA3'],
  ['PA15', 'PB3', 'PA2', 'PA3'],
  ['PA0', 'PA1', 'PB10', 'PB11'],
  ['PA15', 'PB3', 'PB10', 'PB11'],
];
const TIM3_PINS = [
  ['PA6', 'PA7', 'PB0', 'PB1'],
  [], // Reserved remap encoding.
  ['PB4', 'PB5', 'PB0', 'PB1'],
  [], // PC6–PC9 are absent from the STM32F103C8T6 package.
];
const TIM4_PINS = [['PB6', 'PB7', 'PB8', 'PB9'], []]; // PD12–PD15 are absent.

export function stm32Apb1TimerClock(pclk1Hz, rccCfgr) {
  // PPRE1 = 0xx means no divider; every divided APB1 clock is doubled for timers.
  return pclk1Hz * ((rccCfgr & (1 << 10)) ? 2 : 1);
}

function debugOwnsPin(pin, swj) {
  if (swj === 2 || swj === 4) return false;
  return pin === 'PA15' || pin === 'PB3' || (pin === 'PB4' && swj !== 1);
}

export function readStm32Pwm({read, timerClockHz, afioMapr, isClocked}) {
  const outputs = {};
  if (!Number.isFinite(timerClockHz) || timerClockHz <= 0) return outputs;

  const routed = [TIM2_PINS[(afioMapr >>> 8) & 3], TIM3_PINS[(afioMapr >>> 10) & 3], TIM4_PINS[(afioMapr >>> 12) & 1]];
  const swj = (afioMapr >>> 24) & 7;
  for (let timer = 2; timer <= 4; timer++) {
    const pins = routed[timer - 2];
    if (!pins.length || !isClocked(timer)) continue;
    const base = 0x40000000 + (timer - 2) * 0x400;
    const cr1 = read(base);
    const smcr = read(base + 0x08);
    // Only continuous, internally clocked, edge-aligned up-counting PWM.
    if (!(cr1 & 1) || (cr1 & 0x78) || (smcr & 0x4007)) continue;
    const arr = read(base + 0x2c);
    // ARR is a 16-bit register on these timers. An ARR of zero blocks the counter.
    if (arr < 1 || arr > 0xffff) continue;
    const period = arr + 1;
    const psc = read(base + 0x28) & 0xffff;
    const frequencyHz = timerClockHz / ((psc + 1) * period);
    const modes = [read(base + 0x18), read(base + 0x1c)];
    const ccer = read(base + 0x20);
    const count = read(base + 0x24) & 0xffff;

    for (let channel = 0; channel < pins.length; channel++) {
      const pin = pins[channel];
      const flags = ccer >>> (channel * 4);
      if (!(flags & 1) || debugOwnsPin(pin, swj)) continue;
      const control = modes[channel >>> 1] >>> ((channel & 1) * 8);
      const mode = (control >>> 4) & 7;
      if ((control & 3) || (mode !== 6 && mode !== 7)) continue;

      const compare = read(base + 0x34 + channel * 4) & 0xffff;
      const activeLow = Boolean(flags & 2);
      const inverted = (mode === 7) !== activeLow;
      const highRatio = Math.min(1, compare / period);
      // The pinned emulator exposes programmed register values. Its register
      // readback does not distinguish staged ARR/CCR values from active ones.
      outputs[pin] = {
        timer, channel: channel + 1, frequencyHz, activeLow, highFirst: !inverted,
        phaseMs: (count % period) * 1000 / (frequencyHz * period),
        duty: inverted ? 1 - highRatio : highRatio,
        level: Number((count < compare) !== inverted),
      };
    }
  }
  return outputs;
}
