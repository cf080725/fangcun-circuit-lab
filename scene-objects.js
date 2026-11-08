import {partPose} from './part-mount.js';

export function componentRemoval(circuit, ids) {
  const targets = new Set(ids);
  const parts = circuit.components.filter(part => targets.has(part.id) && !part.locked);
  const removable = new Set(parts.map(part => part.id));
  const wires = circuit.wires.filter(wire =>
    removable.has(wire.a.split(':', 1)[0]) || removable.has(wire.b.split(':', 1)[0]));
  return { parts, wires };
}

export function nextComponentId(type, { components, wires }) {
  const base = { resistor: 'r', led: 'led', capacitor: 'cap' }[type] || type;
  const ids = new Set([...components, ...wires].map(item => item.id));
  let index = 1;
  while (ids.has(base + index)) index += 1;
  return base + index;
}

export function copyComponent(part, circuit) {
  const { components } = circuit;
  const origin=partPose(part,circuit.breadboard);
  const positions=components.map(item=>partPose(item,circuit.breadboard));
  const id = nextComponentId(part.type, circuit);
  const gap = 1.6;
  const nearby = [[gap, gap], [gap, -gap], [-gap, gap], [-gap, -gap]];
  const far = [];
  for (let z = -8; z <= 8; z += 2) {
    for (let x = 6; x <= 22; x += 2) far.push([x, z]);
  }
  const candidates = [...nearby.map(([dx, dz]) => [origin.x + dx, origin.z + dz]), ...far];
  const points = candidates.filter(([x, z]) => x >= -29 && x <= 29 && z >= -19 && z <= 19);
  let best = points[0], clearance = 0;
  for (const point of points) {
    const [x, z] = point;
    const nearest = Math.min(...positions.map(other => Math.hypot(x - other.x, z - other.z)));
    if (nearest >= gap) { best = point; break; }
    if (nearest > clearance) { best = point; clearance = nearest; }
  }
  const [x, z] = best;
  const copy = { ...structuredClone(part), id, x, z, rotation:origin.rotation };
  delete copy.locked;
  delete copy.hidden;
  delete copy.mount;
  if (copy.type === 'button') copy.pressed = false;
  return copy;
}
