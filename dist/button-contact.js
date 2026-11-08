// A repeatable teaching pattern within the B3F contact-bounce limit of 5 ms.
// The same sequence runs on the opening edge with the states inverted.
const reversalsMs = [.6, 1.7, 2.6, 4];
const transitions = new WeakMap();
const replays = new WeakMap();

export function setButtonContact(part, pressed, timeMs) {
  if (Boolean(part.pressed) === pressed) return false;
  part.pressed = pressed;
  if (part.bounce && Number.isFinite(timeMs)) transitions.set(part, {pressed,timeMs});
  else transitions.delete(part);
  return true;
}

export function buttonContact(part, timeMs) {
  const replay = replays.get(part);
  const pressed = replay ? timeMs >= replay.startMs && timeMs < replay.releaseMs : Boolean(part.pressed);
  const transition = transitions.get(part);
  const edge = replay ? (pressed ? replay.startMs : replay.releaseMs) :
    transition?.pressed === pressed ? transition.timeMs : Infinity;
  const elapsed = timeMs - edge;
  const bouncing = Boolean(part.bounce && elapsed >= 0 && elapsed < reversalsMs.at(-1));
  let closed = pressed;
  if (bouncing) for (const offset of reversalsMs) {
    if (elapsed < offset) break;
    closed = !closed;
  }
  return {closed,bouncing};
}

export function scheduleButtonPress(part, startMs, releaseMs) {
  replays.set(part, {startMs,releaseMs});
}

export function settleButtonContact(part) {
  transitions.delete(part);
  replays.delete(part);
}
