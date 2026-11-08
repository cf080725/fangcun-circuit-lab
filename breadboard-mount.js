export const signalPitch = .254;
const signalColumns = 30;
const rowNames = 'abcdefghij';
const rowSteps = [-5.5, -4.5, -3.5, -2.5, -1.5, 1.5, 2.5, 3.5, 4.5, 5.5];
const mountableIds = new Set([
  'bluepill', 'nano', 'nano-every', 'nano-esp32', 'nano-rp2040-connect', 'nano-33-ble-sense-rev2',
  'pico', 'pico-w', 'pico2', 'pico2-w',
  'xiao-samd21', 'xiao-rp2040', 'xiao-nrf52840-sense', 'xiao-esp32c3', 'xiao-esp32s3-sense',
  'teensy40', 'teensy41', 'esp32-devkitc', 'esp32-c3-devkitm',
  'esp32-s3-devkitc', 'esp32-c6-devkitc', 'esp32-h2-devkitm', 'nodemcu-esp8266'
]);
const mountRotations = [90, 270];

export function signalHole(row, column) {
  const index = typeof row === 'string' && row.length === 1 ? rowNames.indexOf(row.toLowerCase()) : -1;
  if (index < 0 || !Number.isInteger(column) || column < 1 || column > signalColumns) return null;
  return {endpoint: `bb:${rowNames[index]}${column}`, x: (column - 15.5) * signalPitch, z: rowSteps[index] * signalPitch};
}

export function signalStrip(endpoint) {
  const match = /^bb:([a-j])([1-9]|[12]\d|30)$/.exec(endpoint);
  if (!match) return null;
  const [,row,column] = match;
  return {column:Number(column), rows:row<'f' ? 'abcde' : 'fghij'};
}

export function rotateBoardPoint(x, z, degrees = 0) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return {x: x * cos + z * sin, z: -x * sin + z * cos};
}

function mountFootprint(profile) {
  if (!mountableIds.has(profile?.id)) return null;
  const left = profile.pins.filter(pin => pin.side === 'left').sort((a, b) => a.z - b.z);
  const right = profile.pins.filter(pin => pin.side === 'right').sort((a, b) => a.z - b.z);
  const pinCount = left.length;
  if (!pinCount || right.length !== pinCount || pinCount > signalColumns || profile.pins.length !== pinCount * 2) return null;
  const pitchTolerance = .002;
  if (Math.abs(left[0].z-right[0].z)>pitchTolerance) return null;
  const isOnGrid = (pin, index, x) => Math.abs(pin.z - (left[0].z + index * signalPitch)) <= pitchTolerance && Math.abs(pin.x - x) <= pitchTolerance;
  if (!left.every((pin, index) => isOnGrid(pin, index, left[0].x)) || !right.every((pin, index) => isOnGrid(pin, index, right[0].x))) return null;

  const span = right[0].x - left[0].x;
  const matches = [];
  // Place one header on each side of the breadboard's electrically isolated gap.
  for (let upper = 0; upper < 5; upper++) {
    for (let lower = 5; lower < 10; lower++) {
      const gap = (rowSteps[lower] - rowSteps[upper]) * signalPitch;
      if (Math.abs(gap - span) > pitchTolerance) continue;
      matches.push({rows:[rowNames[upper],rowNames[lower]],distance:Math.abs(rowSteps[lower]+rowSteps[upper])});
    }
  }
  if (!matches.length) return null;
  // Keep the most centered pair and the prior tie order as the saved default.
  const rowPairs = matches.sort((a,b)=>a.distance-b.distance).map(match=>match.rows);
  const maxColumn = signalColumns - pinCount + 1;
  return {left, right, options: {minColumn: 1, maxColumn, defaultColumn: Math.floor((1 + maxColumn) / 2),
    defaultRotation: 90, rotations: [...mountRotations], rows:rowPairs[0], rowPairs, pinCount}};
}

export function getMountOptions(profile) {
  return mountFootprint(profile)?.options ?? null;
}

const sameRows = (a,b) => a[0]===b[0] && a[1]===b[1];

export function boardMountRows(mount, options) {
  if (!options) return null;
  const rows = mount?.rows;
  if (rows===undefined) return options.rows;
  if (!Array.isArray(rows) || rows.length!==2) return null;
  return options.rowPairs.find(pair=>sameRows(pair,rows)) ?? null;
}

export function normalizeBoardMount(mount, options) {
  if (!options || !Number.isInteger(mount?.column) || mount.column<options.minColumn ||
    mount.column>options.maxColumn || !mountRotations.includes(mount.rotation)) return null;
  const rows = boardMountRows(mount,options);
  if (!rows) return null;
  const {column,rotation} = mount;
  return sameRows(rows,options.rows) ? {column,rotation} : {column,rotation,rows:[...rows]};
}

export function isBoardMount(mount, options) {
  return normalizeBoardMount(mount,options)!==null;
}

function mountPlan(circuit, profile) {
  if (!circuit?.board?.mount) return null;
  const footprint = mountFootprint(profile);
  const mount = normalizeBoardMount(circuit.board.mount,footprint?.options);
  if (!mount) return null;
  const reverse = mount.rotation === 270;
  const upper = reverse ? [...footprint.left].reverse() : footprint.right;
  const lower = reverse ? [...footprint.right].reverse() : footprint.left;
  return {mount, rows: mount.rows ?? footprint.options.rows, upper, lower};
}

export function boardPose(circuit, profile) {
  const board = circuit?.board ?? {x: -5, z: 0};
  const plan = mountPlan(circuit, profile);
  if (!plan) return {x: board.x, z: board.z, rotation: board.rotation ?? 0, mounted: false};
  const {mount, rows, upper} = plan;
  const breadboard = circuit.breadboard ?? {x: 1.8, z: 0};
  const anchor = signalHole(rows[0], mount.column);
  const pin = rotateBoardPoint(upper[0].x, upper[0].z, mount.rotation);
  return {x: breadboard.x + anchor.x - pin.x, z: breadboard.z + anchor.z - pin.z, rotation: mount.rotation, mounted: true};
}

export function mountedConnections(circuit, profile) {
  const plan = mountPlan(circuit, profile);
  if (!plan) return [];
  const {mount, rows, upper, lower} = plan;
  const pairs = [];
  for (const [index, pins] of [upper, lower].entries()) {
    pins.forEach((pin, offset) => {
      pairs.push({a: 'mcu:' + pin.id, b: signalHole(rows[index], mount.column + offset).endpoint});
    });
  }
  return pairs;
}

export function mountedBoardCoversHole(circuit, profile, hole, pose = boardPose(circuit,profile)) {
  if (!pose.mounted) return false;
  const breadboard = circuit.breadboard ?? {x:1.8,z:0};
  const local = rotateBoardPoint(breadboard.x+hole.x-pose.x,breadboard.z+hole.z-pose.z,-pose.rotation);
  return Math.abs(local.x)<=profile.width/2 && Math.abs(local.z)<=profile.height/2;
}

export function mountedPinRoutes(circuit, profile) {
  const pose = boardPose(circuit,profile);
  if (!pose.mounted) return [];
  const pins = new Map(profile.pins.map(pin => ['mcu:'+pin.id,pin]));
  return mountedConnections(circuit,profile).map(({a,b}) => {
    const {column,rows} = signalStrip(b);
    const exposed = Array.from(rows,row => signalHole(row,column))
      .filter(hole => !mountedBoardCoversHole(circuit,profile,hole,pose)).map(hole => hole.endpoint);
    return {endpoint:a, pin:pins.get(a), socket:b, exposed};
  });
}
