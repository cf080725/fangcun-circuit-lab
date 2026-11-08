export function lqfp64PinLayout(number) {
  if (!Number.isInteger(number) || number < 1 || number > 64) return null;
  const side = Math.floor((number - 1) / 16);
  const offset = ((number - 1) % 16 - 7.5) * .35;
  const edge = 4.61;
  return [
    { side: 'left', x: 0, z: offset, angle: Math.PI, labelX: -edge, labelZ: offset },
    { side: 'bottom', x: offset, z: 0, angle: -Math.PI / 2, labelX: offset, labelZ: edge },
    { side: 'right', x: 0, z: -offset, angle: 0, labelX: edge, labelZ: -offset },
    { side: 'top', x: -offset, z: 0, angle: Math.PI / 2, labelX: -offset, labelZ: -edge }
  ][side];
}

export function dip28PinLayout(number) {
  if (!Number.isInteger(number) || number < 1 || number > 28) return null;
  const left = number <= 14;
  const z = ((left ? number - 1 : 28 - number) - 6.5) * 1.03;
  return { x: 0, z, angle: left ? Math.PI : 0, labelX: left ? -4.18 : 4.18, labelZ: z };
}

// ATmega328P 32A top view. Lead meshes start at the package center and face +X.
export function tqfp32PinLayout(number) {
  if (!Number.isInteger(number) || number < 1 || number > 32) return null;
  const side = Math.floor((number - 1) / 8);
  const offset = ((number - 1) % 8 - 3.5) * .80;
  const label = 4.98;
  return [
    { x: 0, z: offset, angle: Math.PI, labelX: -label, labelZ: offset },
    { x: offset, z: 0, angle: -Math.PI / 2, labelX: offset, labelZ: label },
    { x: 0, z: -offset, angle: 0, labelX: label, labelZ: -offset },
    { x: -offset, z: 0, angle: Math.PI / 2, labelX: -offset, labelZ: -label }
  ][side];
}

// WROOM-32E module viewed from the top, with the PCB antenna at the top.
export function wroom32ePadLayout(number) {
  if (!Number.isInteger(number) || number < 1 || number > 39) return null;
  if (number === 39) return { x: 0, z: .9, angle: 0, labelX: 0, labelZ: .9, bottom: true };
  if (number <= 14 || number >= 25) {
    const left = number <= 14;
    const z = -3.85 + (left ? number - 1 : 38 - number) * .635;
    return { x: left ? -4.23 : 4.23, z, angle: 0, labelX: left ? -5 : 5, labelZ: z };
  }
  const x = (number - 19.5) * .635;
  return { x, z: 5.89, angle: Math.PI / 2, labelX: x, labelZ: 6.68 };
}

// RP2040 Fig. 3 top view. Contacts extend 0.40 mm inward from the 7 mm body.
export const RP2040_GROUND_PAD = 57;
export function rp2040PadLayout(number) {
  if (!Number.isInteger(number) || number < 1 || number > RP2040_GROUND_PAD) return null;
  if (number === RP2040_GROUND_PAD) return {x: 0, z: 0, angle: 0, labelX: 0, labelZ: 0, bottom: true};
  const side = Math.floor((number - 1) / 14);
  const offset = ((number - 1) % 14 - 6.5) * .40;
  const contact = 3.30, label = 3.83;
  return [
    {x: -contact, z: offset, angle: 0, labelX: -label, labelZ: offset},
    {x: offset, z: contact, angle: Math.PI / 2, labelX: offset, labelZ: label},
    {x: contact, z: -offset, angle: 0, labelX: label, labelZ: -offset},
    {x: -offset, z: -contact, angle: Math.PI / 2, labelX: -offset, labelZ: -label}
  ][side];
}

export function positionChipBlocks(blocks, { width, depth, centerZ = 0, columns }) {
  const rows = Math.ceil(blocks.length / columns);
  const w = width / columns, d = depth / rows;
  return blocks.map((block, index) => ({ ...block,
    x: (index % columns + .5) * w - width / 2,
    z: (Math.floor(index / columns) + .5) * d - depth / 2 + centerZ,
    w: w - .14, d: d - .14
  }));
}
