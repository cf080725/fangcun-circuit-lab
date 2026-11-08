export const joystickPins = Object.freeze(['VCC','VERT','HORIZ','SEL','GND']);
const neutral = Object.freeze({x:0,y:0,pressed:false});
const states = new WeakMap();

export function joystickState(part) {
  return states.get(part) ?? neutral;
}

// A drag or button hold belongs to the live part, outside the saved project.
export function setJoystickState(part, change) {
  if (part?.type !== 'joystick' || !change) return false;
  const old = joystickState(part);
  let {x=old.x,y=old.y,pressed=old.pressed} = change;
  if (!Number.isFinite(x) || !Number.isFinite(y) || typeof pressed !== 'boolean') return false;
  const scale = Math.max(1,Math.abs(x),Math.abs(y));
  x /= scale;
  y /= scale;
  const radius = Math.max(1,Math.hypot(x,y));
  x /= radius;
  y /= radius;
  if (x === old.x && y === old.y && pressed === old.pressed) return false;
  if (x === 0 && y === 0 && !pressed) return resetJoystickState(part);
  states.set(part,Object.freeze({x,y,pressed}));
  return true;
}

export function resetJoystickState(part) {
  return states.delete(part);
}
