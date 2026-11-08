// Pololu #2130 unmodified carrier, in schematic connector order.
export const drv8833Pins = Object.freeze([
  'GND2','VMM','BIN1','BIN2','AIN2','AIN1','SLP','FLT',
  'GND','VIN','BOUT1','BOUT2','AOUT2','AOUT1','AISEN','BISEN'
]);
export const drv8833Inputs = Object.freeze(['AIN1','AIN2','BIN1','BIN2']);
export const drv8833Channels = Object.freeze(['A','B']);
export const reversePassOhms = .025;

export function drv8833Logic(voltage, sleep = false) {
  const low = sleep ? .5 : .7;
  const high = sleep ? 2.5 : 2;
  if (voltage >= -.3 && voltage <= low + 1e-6) return 0;
  if (voltage >= high - 1e-6 && voltage <= (sleep ? 6.51 : 5.75)) return 1;
  return null;
}

export function drv8833Mode(in1, in2) {
  if (in1 === null || in2 === null || (!in1 && !in2)) return 'coast';
  if (in1 && in2) return 'brake';
  return in1 ? 'forward' : 'reverse';
}

export function drv8833Switches(mode, voltage) {
  // Interpolate the 25°C typical values at 2.7 V and 5 V from TI.
  const mix = Math.max(0, Math.min(1, (voltage - 2.7) / (5 - 2.7)));
  const high = {rail:'VMM', resistance:.25 - .05*mix};
  const low = {rail:'GND', resistance:.2 - .04*mix};
  if (mode === 'forward') return [high,low];
  if (mode === 'reverse') return [low,high];
  if (mode === 'brake') return [low,low];
  return [];
}

const ratedOmega = 12300*2*Math.PI/60;
const resistance = 3/2.1;
const torqueConstant = .00353/2.1;
export const fa130Model = Object.freeze({
  resistance,
  backEmfConstant:(3-.15*resistance)/ratedOmega,
  torqueConstant,
  friction:torqueConstant*.15/ratedOmega,
  inertia:1.4e-7
});

export function fa130Drive(current, omega, conductance) {
  const {torqueConstant,backEmfConstant,friction,inertia} = fa130Model;
  const damping = friction + torqueConstant*backEmfConstant*conductance;
  const zeroSpeedCurrent = current + conductance*backEmfConstant*omega;
  return {steady:torqueConstant*zeroSpeedCurrent/damping, tau:inertia/damping};
}

export function advanceFa130(previous, elapsed) {
  const {omega = 0,angle = 0,drive} = previous ?? {};
  if (!drive || elapsed <= 0) return {omega,angle};
  const {steady,tau} = drive;
  const change = -Math.expm1(-elapsed/tau);
  const nextAngle = angle + steady*elapsed + (omega-steady)*tau*change;
  return {omega:omega + (steady-omega)*change,angle:nextAngle % (2*Math.PI)};
}
