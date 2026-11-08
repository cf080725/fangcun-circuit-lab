export function pwmPhaseMs(timeMs, startMs, periodMs) {
  const phase = (timeMs - startMs) % periodMs;
  return phase < 0 ? phase + periodMs : phase;
}

function approach(voltage, target, durationMs, timeConstantMs) {
  return voltage + (target - voltage) * -Math.expm1(-durationMs / timeConstantMs);
}

export function pwmRcEnvelope(command, timeConstantMs) {
  const { periodMs, duty, voltageHigh, voltageLow } = command;
  const span = voltageHigh - voltageLow;
  const voltageMean = voltageLow + span * duty;
  if (duty === 0 || duty === 1) {
    return { voltageMin: voltageMean, voltageMax: voltageMean, voltageMean, ripplePp: 0 };
  }
  const rise = -Math.expm1(-periodMs * duty / timeConstantMs);
  const fall = -Math.expm1(-periodMs * (1 - duty) / timeConstantMs);
  const cycle = -Math.expm1(-periodMs / timeConstantMs);
  const peak = span * (cycle ? rise / cycle : duty);
  const ripplePp = peak * fall;
  const voltageMax = voltageLow + peak;
  return { voltageMin: voltageMax - ripplePp, voltageMax, voltageMean, ripplePp };
}

function partialCycle(voltage, phase, duration, command, timeConstantMs) {
  const high = Math.max(0, Math.min(duration, command.periodMs * command.duty - phase));
  const raised = approach(voltage, command.voltageHigh, high, timeConstantMs);
  return approach(raised, command.voltageLow, duration - high, timeConstantMs);
}

export function advancePwmRc(voltage, fromMs, toMs, command, timeConstantMs) {
  if (toMs <= fromMs) return voltage;
  if (command.periodMs === undefined) return approach(voltage, command.voltage, toMs - fromMs, timeConstantMs);

  const { periodMs, startMs, endMs, duty, voltageHigh, voltageLow } = command;
  const pwmUntil = Math.min(toMs, endMs ?? toMs);
  const activeMs = Math.max(0, pwmUntil - fromMs);
  if (duty === 0 || duty === 1) {
    voltage = approach(voltage, duty === 1 ? voltageHigh : voltageLow, activeMs, timeConstantMs);
  } else if (activeMs > 0) {
    const phase = pwmPhaseMs(fromMs, startMs, periodMs);
    const first = Math.min(activeMs, periodMs - phase);
    voltage = partialCycle(voltage, phase, first, command, timeConstantMs);
    const remaining = activeMs - first;
    const last = remaining % periodMs;
    // Whole periods share a single fixed point at the start of each pulse.
    // Composing them reduces to one exponential even across a long wait.
    const { voltageMin } = pwmRcEnvelope(command, timeConstantMs);
    voltage = approach(voltage, voltageMin, remaining - last, timeConstantMs);
    voltage = partialCycle(voltage, 0, last, command, timeConstantMs);
  }
  // An Arduino timed tone ends by driving the pin low.
  return approach(voltage, voltageLow, toMs - fromMs - activeMs, timeConstantMs);
}
