// RP2040 datasheet §4.5: PWM slices, buffering, GPIO mapping and polarity.
// https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf
export const RP2040_FUNCTION_PWM = 4;

const RESETS_RESET = 0x4000c000;
const RESET_PWM = 1 << 14;
const CSR_ENABLE = 1;
const CSR_UNMODELED_MODES = (1 << 1) | (3 << 4); // Phase-correct and B-triggered counting.

export function readRp2040Pwm(rp, index) {
  const pin = rp.gpio[index];
  if (pin?.functionSelect !== RP2040_FUNCTION_PWM || !pin.outputEnable || pin.outputDisable || pin.outputOverride > 1) return;
  if (rp.readUint32(RESETS_RESET) & RESET_PWM) return;

  const slice = (index >>> 1) & 7;
  const pwm = rp.pwm.channels[slice];
  if (!(pwm.csr & CSR_ENABLE) || (pwm.csr & CSR_UNMODELED_MODES) || !pwm.timer.enable) return;

  const isB = Boolean(index & 1);
  // In pinned rp2040js the register values `pwm.top` and `pwm.cc` can
  // be pending. The timer and compare alarms hold the active values.
  const top = pwm.timer.top;
  const compare = (isB ? pwm.alarmB : pwm.alarmA).target;
  const divider = pwm.timer.prescaler;
  if (top < 0 || top > 0xffff || divider < 1 || divider > 256) return;
  const period = top + 1;
  const frequencyHz = rp.clkSys / (divider * period);
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return;

  const inverted = Boolean(pwm.csr & (isB ? 1 << 3 : 1 << 2));
  const activeLow = inverted !== (pin.outputOverride === 1);
  const ratio = Math.min(1, compare / period);
  return {slice, channel: isB ? 'B' : 'A', frequencyHz, duty: activeLow ? 1 - ratio : ratio, activeLow, level: Number(pin.outputValue)};
}
