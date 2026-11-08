// PEC11R-4220F-S0024 has one full quadrature cycle per 15° detent.
// Bourns shows A leading B for clockwise rotation. The open detent phase,
// 12 ms edge spacing, and ideal contacts are teaching-model choices.
const edgeIntervalMs = 12;
const detentDurationMs = 4 * edgeIntervalMs;
const queueLimit = 32;
const anglePerDetent = 360 / 24;
const clockwise = [0, 2, 3, 1];
const counterclockwise = [0, 1, 3, 2];
const controls = new WeakMap();

export const encoderPins = Object.freeze(['A','C','B','SW1','SW2']);

function controlFor(part) {
  let control = controls.get(part);
  if (!control) {
    control = {detents:0, pressed:false, turns:[]};
    controls.set(part,control);
  }
  return control;
}

function validTurn(part, direction, timeMs) {
  return part?.type === 'encoder' && (direction === 1 || direction === -1) && Number.isFinite(timeMs) && timeMs >= 0;
}

function completeTurns(control, timeMs) {
  while (control.turns[0]?.endMs <= timeMs) {
    control.detents += control.turns.shift().direction;
  }
}

export function scheduleEncoderDetent(part, direction, timeMs, {notBeforeMs=timeMs}={}) {
  if (!validTurn(part,direction,timeMs) || !Number.isFinite(notBeforeMs)) return false;
  const control = controlFor(part);
  completeTurns(control,timeMs);
  if (control.turns.length >= queueLimit) return false;
  const startMs = Math.max(timeMs,notBeforeMs,control.turns.at(-1)?.endMs ?? 0);
  if (startMs+edgeIntervalMs <= startMs) return false;
  control.turns.push({direction,startMs,endMs:startMs+detentDurationMs});
  return true;
}

export function turnEncoderAtRest(part, direction, timeMs) {
  if (!validTurn(part,direction,timeMs)) return false;
  const control = controlFor(part);
  completeTurns(control,timeMs);
  control.turns.length = 0;
  control.detents += direction;
  return true;
}

export function setEncoderSwitch(part, pressed) {
  if (part?.type !== 'encoder' || typeof pressed !== 'boolean') return false;
  const control = controlFor(part);
  if (control.pressed === pressed) return false;
  control.pressed = pressed;
  return true;
}

export function settleEncoderContact(part, timeMs) {
  const control = controls.get(part);
  if (!control) return;
  completeTurns(control,timeMs);
  control.turns.length = 0;
  control.pressed = false;
}

export function encoderContact(part, timeMs=0) {
  const control = controls.get(part);
  let detents = control?.detents ?? 0;
  let angleInDetents = detents;
  let contacts = 0;
  let moving = false;
  let queued = 0;
  let nextEdgeMs = null;
  for (const [index,turn] of (control?.turns ?? []).entries()) {
    if (timeMs >= turn.endMs) {
      detents += turn.direction;
      angleInDetents = detents;
      continue;
    }
    queued = control.turns.length - index;
    moving = timeMs >= turn.startMs;
    let phase = 0;
    while (phase < 3 && timeMs >= turn.startMs + (phase+1)*edgeIntervalMs) phase++;
    nextEdgeMs = turn.startMs + (phase+1)*edgeIntervalMs;
    contacts = (turn.direction === 1 ? clockwise : counterclockwise)[phase];
    if (moving) angleInDetents += turn.direction * (timeMs-turn.startMs)/detentDurationMs;
    break;
  }
  const angle = ((angleInDetents * anglePerDetent % 360) + 360) % 360;
  return {aClosed:Boolean(contacts&2),bClosed:Boolean(contacts&1),switchClosed:control?.pressed ?? false,
    angle,detents,moving,queued,nextEdgeMs};
}
