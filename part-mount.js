import {boardPose, mountedBoardCoversHole, mountedConnections, rotateBoardPoint, signalHole, signalPitch, signalStrip} from './breadboard-mount.js';

const rotations = Object.freeze([0, 90, 180, 270]);
const alongRow = Object.freeze([0,180]);
const footprints = {
  led: {width:.56, depth:.56, rotations:alongRow,
    terminals:[['A','正极 A',-.5,0],['K','负极 K',.5,0]]},
  resistor: {width:.72, depth:.26, rotations,
    terminals:[['1','端子 1',-2.5,0],['2','端子 2',2.5,0]]},
  // DO-35 axial leads are formed to a 7.62 mm span for this breadboard.
  diode: {width:.34, depth:.175, rotations,
    terminals:[['A','阳极 A',-1.5,0],['K','阴极 K · 色环',1.5,0]]},
  // The 2.50 mm native radial leads are formed slightly to the 2.54 mm grid.
  capacitor: {width:.63, depth:.63, rotations:alongRow,
    terminals:[['+','正极 +',-.5,0],['-','负极 − · 条纹',.5,0]]},
  // Kingbright SC56-11EWA, viewed from the display face with DP lower right.
  sevenseg: {width:1.27, depth:1.905, rotations:alongRow,
    terminals:[['e','1 · e 段',-2,3,1],['d','2 · d 段',-1,3,2],['COM','3 · 公共端',0,3,3],
      ['c','4 · c 段',1,3,4],['dp','5 · 小数点',2,3,5],['g','10 · g 段',-2,-3,10],
      ['f','9 · f 段',-1,-3,9],['COM2','8 · 公共端',0,-3,8],['a','7 · a 段',1,-3,7],['b','6 · b 段',2,-3,6]]},
  // Omron A6D-4100, top view with the numbered actuator row nearest the viewer.
  dipswitch: {width:1.22, depth:.66, rotations:alongRow,
    terminals:[['1','端子 1',-1.5,1.5],['2','端子 2',-.5,1.5],['3','端子 3',.5,1.5],['4','端子 4',1.5,1.5],
      ['5','端子 5',1.5,-1.5],['6','端子 6',.5,-1.5],['7','端子 7',-.5,-1.5],['8','端子 8',-1.5,-1.5]]},
  // This teaching package has formed leads, with terminals 1/2 and 3/4 paired.
  button: {width:.62, depth:.62, rotations:Object.freeze([90,270]),
    terminals:[['1','端子 1',-1.5,-1],['2','端子 2',-1.5,1],['3','端子 3',1.5,-1],['4','端子 4',1.5,1]]}
};
const defaultBreadboard = {x:1.8, z:0};
const gridOrigin = {x:0,z:0};
const terminalHalfWidth = .025;
const empty = Object.freeze([]);
const mountPins = Object.fromEntries(Object.entries(footprints).map(([type,{terminals}]) =>
  [type,Object.freeze(terminals.map(([id,label,x,z,number]) =>
    Object.freeze({id,label,x:x*signalPitch,y:.03,z:z*signalPitch,...(number && {number})})))]));

// Row centers use half-pitch coordinates, including the three-pitch center gap.
// Index exact socket centers once so display and simulation share the same grid.
const gridKey = (x,z) => `${Math.round(x*2/signalPitch)},${Math.round(z*2/signalPitch)}`;
const holes = new Map();
const centers = new Map();
for (const row of 'abcdefghij') {
  for (let column=1; column<=30; column++) {
    const hole = signalHole(row,column);
    holes.set(hole.endpoint,hole);
    centers.set(gridKey(hole.x,hole.z),hole);
  }
}

export function canMountPart(type) {
  return Object.hasOwn(footprints,type);
}

export function partMountPins(type) {
  return canMountPart(type) ? mountPins[type] : empty;
}

export function partMountRotations(type) {
  return canMountPart(type) ? footprints[type].rotations : empty;
}

export function sevenSegmentAnchorRows(rotation) {
  if (rotation===0) return 'fghi';
  if (rotation===180) return 'bcde';
  return '';
}

export function dipSwitchAnchorRows(rotation) {
  if (rotation===0) return 'f';
  if (rotation===180) return 'e';
  return '';
}

export function partMountRotation(part, requested = part?.mount?.rotation ?? part?.rotation ?? 0) {
  const allowed = partMountRotations(part?.type);
  const angle = ((Math.round(requested/90)*90)%360+360)%360;
  return allowed.includes(angle) ? angle : allowed[0] ?? null;
}

export function nearestPartMount(part, breadboard = defaultBreadboard, {x,z,rotation} = {}, {allowMounted=false} = {}) {
  if (!part || (part.mount && !allowMounted) || part.locked || part.hidden || !canMountPart(part.type)) return null;
  const localX = x-breadboard.x, localZ = z-breadboard.z;
  const corner = holes.get('bb:j30');
  const halfPitch = signalPitch/2;
  if (!Number.isFinite(localX) || !Number.isFinite(localZ) ||
    Math.abs(localX)>corner.x+halfPitch || Math.abs(localZ)>corner.z+halfPitch) return null;

  const aligned = partMountRotation(part,rotation);
  const first = partMountPins(part.type)[0];
  const offset = rotateBoardPoint(first.x,first.z,aligned);
  const leadX = localX+offset.x, leadZ = localZ+offset.z;
  const gutterRow = part.type==='button' ? (aligned===90 ? 'f' : 'e') : null;
  const anchorRows = part.type==='sevenseg' ? sevenSegmentAnchorRows(aligned) :
    part.type==='dipswitch' ? dipSwitchAnchorRows(aligned) : gutterRow;
  // The button body can approach the gutter from either side, but its first
  // formed lead must still land on the inner row for its chosen orientation.
  const zWeight = gutterRow ? .75 : 1;
  let nearest = null, best = (signalPitch*.75)**2;
  for (const hole of holes.values()) {
    if (anchorRows && !anchorRows.includes(hole.endpoint[3])) continue;
    const distance = (leadX-hole.x)**2 + ((leadZ-hole.z)*zWeight)**2;
    if (distance>=best) continue;
    const mount = {hole:hole.endpoint,rotation:aligned};
    if (!mountPlan(part,mount).contacts) continue;
    nearest=mount;
    best=distance;
  }
  return nearest;
}

function mountPlan(part, mount) {
  const pins = partMountPins(part.type);
  if (!pins.length) return {reason:'当前元件使用跳线接入面包板。'};
  const first = holes.get(mount?.hole);
  const rotation = mount?.rotation;
  if (!first || !rotations.includes(rotation)) return {reason:'请选择有效的信号孔和朝向。'};
  const button = part.type==='button';
  if (button && !partMountRotations(part.type).includes(rotation)) {
    return {reason:'按键的两组触点须跨过面包板中央沟槽。请选择跨槽朝向。'};
  }
  if (part.type==='capacitor' && !alongRow.includes(rotation)) {
    return {reason:'电解电容两脚须接入不同孔组。请选择沿一排的朝向。'};
  }
  const sevenseg = part.type==='sevenseg';
  if (sevenseg) {
    const rows = sevenSegmentAnchorRows(rotation);
    if (!rows) return {reason:'数码管的两排脚须跨过中央沟槽。请选择正向或旋转 180°。'};
    if (!rows.includes(first.endpoint[3])) {
      return {reason:`第 1 脚（e 段）请选择 ${[...rows.toUpperCase()].join(' / ')} 排，让两排脚跨过中央沟槽。`};
    }
  }
  const dipswitch = part.type==='dipswitch';
  if (dipswitch) {
    const row = dipSwitchAnchorRows(rotation);
    if (!row) return {reason:'拨码开关的两排脚须跨过中央沟槽。请选择正向或旋转 180°。'};
    if (first.endpoint[3]!==row) return {reason:`第 1 脚请选择 ${row.toUpperCase()} 排，让两排脚跨过中央沟槽。`};
  }

  const anchor = rotateBoardPoint(pins[0].x,pins[0].z,rotation);
  const x = first.x-anchor.x, z = first.z-anchor.z;
  const contacts = [], sockets = new Set();
  for (const pin of pins) {
    const offset = rotateBoardPoint(pin.x,pin.z,rotation);
    const pinX = x+offset.x, pinZ = z+offset.z;
    const socket = centers.get(gridKey(pinX,pinZ));
    if (!socket || Math.abs(socket.x-pinX)>1e-8 || Math.abs(socket.z-pinZ)>1e-8 || sockets.has(socket.endpoint)) {
      const label = button || sevenseg || dipswitch ? `第 ${pin.number ?? pin.id} 脚` : '第二只脚';
      return {reason:`${label}对不上孔位。请选择另一个起始孔或朝向。`};
    }
    sockets.add(socket.endpoint);
    contacts.push({a:`${part.id}:${pin.id}`,b:socket.endpoint});
  }
  const strips = contacts.map(({b}) => signalStrip(b));
  if (button) {
    // Each side of the button stays on its own side of the center gutter.
    if (strips[0].rows===strips[2].rows) {
      return {reason:'按键的两组触点须跨过面包板中央沟槽。请选择 E 排或 F 排的起始孔。'};
    }
  } else if (strips[0].column===strips[1].column && strips[0].rows===strips[1].rows) {
    return {reason:'两只脚落在同一组相通的孔。请选择另一个起始孔或朝向。'};
  }
  return {x,z,rotation,contacts};
}

export function mountedPartContacts(part) {
  return part.mount ? mountPlan(part,part.mount).contacts ?? [] : [];
}

function mountedPose(plan, breadboard) {
  return {x:breadboard.x+plan.x,z:breadboard.z+plan.z,rotation:plan.rotation,mounted:true};
}

export function partPose(part, breadboard = defaultBreadboard) {
  const plan = part.mount && mountPlan(part,part.mount);
  if (plan?.contacts) return mountedPose(plan,breadboard);
  return {x:part.x ?? 0,z:part.z ?? 0,rotation:part.rotation ?? 0,mounted:false};
}

export function mountedPartBodyBounds(part, pose) {
  if (!canMountPart(part.type)) return null;
  const {width,depth} = footprints[part.type];
  const vertical = pose.rotation===90 || pose.rotation===270;
  const halfWidth = (vertical ? depth : width)/2;
  const halfDepth = (vertical ? width : depth)/2;
  return {left:pose.x-halfWidth,right:pose.x+halfWidth,top:pose.z-halfDepth,bottom:pose.z+halfDepth};
}

// The can overhangs the breadboard. Test its circle against the footprint of
// a square jumper housing (.139 cm across) or a thinner component lead.
export function capacitorCanObscuresHole(center,hole,connectorHalfWidth=.07) {
  if (!hole) return false;
  const dx = Math.max(0,Math.abs(center.x-hole.x)-connectorHalfWidth);
  const dz = Math.max(0,Math.abs(center.z-hole.z)-connectorHalfWidth);
  return dx*dx+dz*dz < (footprints.capacitor.width/2)**2;
}

export function sevenSegmentObscuresHole(center,hole,connectorHalfWidth=0) {
  if (!hole) return false;
  const {width,depth} = footprints.sevenseg;
  return Math.abs(center.x-hole.x)<width/2+connectorHalfWidth &&
    Math.abs(center.z-hole.z)<depth/2+connectorHalfWidth;
}

function overlaps(a,b) {
  return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
}

function holeLabel(endpoint) {
  return endpoint.slice(3).toUpperCase();
}

export function evaluatePartMount(circuit, profile, part, mount) {
  const plan = mountPlan(part,mount);
  if (!plan.contacts) return {ok:false,reason:plan.reason,contacts:[],pose:partPose(part,circuit.breadboard)};

  const breadboard = circuit.breadboard ?? defaultBreadboard;
  const pose = mountedPose(plan,breadboard);
  const {contacts} = plan;
  const blocked = reason => ({ok:false,reason,contacts,pose});
  const cables = new Set((circuit.wires ?? []).flatMap(({a,b}) => [a,b]));
  const others = (circuit.components ?? []).filter(item => item.id!==part.id && item.mount);
  const partSockets = new Set(others.flatMap(mountedPartContacts).map(({b}) => b));
  const board = profile?.id && circuit.board?.mount ? boardPose(circuit,profile) : null;
  const boardSockets = new Set(board?.mounted ? mountedConnections(circuit,profile).map(({b}) => b) : []);
  for (const {b} of contacts) {
    const label = holeLabel(b);
    if (cables.has(b)) return blocked(`${label} 孔已有跳线。请移开跳线或改用其他孔。`);
    if (partSockets.has(b)) return blocked(`${label} 孔已被其他元件占用。请改用其他孔。`);
    if (boardSockets.has(b) || board?.mounted && mountedBoardCoversHole(circuit,profile,holes.get(b),board)) {
      return blocked(`${label} 孔被开发板占用或遮住。请改用其他孔。`);
    }
  }
  // Keep saved placements loadable. The additional clearance applies when
  // inserting a part or changing the sockets of an existing placement.
  if (part.mount?.hole!==mount.hole || part.mount?.rotation!==mount.rotation) {
    for (const other of others) {
      const capacitor = other.type==='capacitor';
      if (!capacitor && other.type!=='sevenseg') continue;
      const otherPose = partPose(other,gridOrigin);
      if (!otherPose.mounted) continue;
      const obscures = capacitor ? capacitorCanObscuresHole : sevenSegmentObscuresHole;
      const covered = contacts.find(({b})=>obscures(otherPose,holes.get(b),terminalHalfWidth));
      if (covered) return blocked(`${holeLabel(covered.b)} 孔被${capacitor?'电解电容':'数码管'} ${other.id} 的外壳遮住。请改用其他孔。`);
    }
    if (part.type==='capacitor') {
      const wireHole = [...cables].find(endpoint=>capacitorCanObscuresHole(plan,holes.get(endpoint)));
      if (wireHole) return blocked(`电解电容外壳会遮住 ${holeLabel(wireHole)} 孔的跳线。请先移开跳线或改用其他孔。`);
      const partHole = [...partSockets].find(endpoint=>capacitorCanObscuresHole(plan,holes.get(endpoint),terminalHalfWidth));
      if (partHole) return blocked(`电解电容外壳会遮住 ${holeLabel(partHole)} 孔的元件插脚。请改用其他孔。`);
    }
    if (part.type==='sevenseg') {
      const wireHole = [...cables].find(endpoint=>sevenSegmentObscuresHole(plan,holes.get(endpoint)));
      if (wireHole) return blocked(`数码管外壳会遮住 ${holeLabel(wireHole)} 孔的跳线。请先移开跳线或改用其他孔。`);
      const partHole = [...partSockets].find(endpoint=>sevenSegmentObscuresHole(plan,holes.get(endpoint),terminalHalfWidth));
      if (partHole) return blocked(`数码管外壳会遮住 ${holeLabel(partHole)} 孔的元件插脚。请先移开元件或改用其他孔。`);
    }
  }
  const body = mountedPartBodyBounds(part,pose);
  if (board?.mounted) {
    const boardBody = {left:board.x-profile.height/2,right:board.x+profile.height/2,
      top:board.z-profile.width/2,bottom:board.z+profile.width/2};
    if (overlaps(body,boardBody)) return blocked('元件本体会与开发板重叠。请改用其他孔。');
  }
  for (const other of others) {
    const otherPose = partPose(other,breadboard);
    if (otherPose.mounted && overlaps(body,mountedPartBodyBounds(other,otherPose))) {
      return blocked(`元件本体会与 ${other.id} 重叠。请改用其他孔。`);
    }
  }
  return {ok:true,reason:'',contacts,pose};
}
