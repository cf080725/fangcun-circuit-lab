import {boardMountRows, boardPose, getMountOptions, mountedConnections, normalizeBoardMount, rotateBoardPoint, signalHole, signalPitch, signalStrip} from './breadboard-mount.js';
import {PARTS} from './circuit.js';
import {breadboardDimensions, breadboardSockets} from './geometry-3d.js';
import {boardVisual, componentCollisionBounds} from './model-renderer.js';
import {capacitorCanObscuresHole,mountedPartBodyBounds,mountedPartContacts,partPose,sevenSegmentObscuresHole} from './part-mount.js';

const sockets = new Map(breadboardSockets().map(hole => [hole.endpoint, hole]));
const plugClearance = .09;
const dropMargin = .35;
const signalDeckCorner = signalHole('j',30);
const halfPitch = signalPitch / 2;
const seatedCrossMargin = signalPitch * 2.25;
const seatedRowBias = signalPitch * .22;

export function boardMountStartHoles(profile) {
  const options = getMountOptions(profile);
  if (!options) return [];
  const holes = [];
  for (const rows of options.rowPairs) {
    for (const row of rows) {
      for (let column=options.minColumn;column<=options.maxColumn;column++) {
        holes.push(signalHole(row,column).endpoint);
      }
    }
  }
  return holes;
}

export function boardMountFromStartHole(profile, endpoint, rotation) {
  const options = getMountOptions(profile);
  if (!options || typeof endpoint!=='string') return null;
  const strip = signalStrip(endpoint);
  if (!strip) return null;
  const rows = options.rowPairs.find(pair=>pair.includes(endpoint[3]));
  return rows ? normalizeBoardMount({column:strip.column,rotation,rows},options) : null;
}

function stripKey(endpoint) {
  const strip = signalStrip(endpoint);
  return strip ? `${strip.rows}:${strip.column}` : null;
}

function mountedStripNets(contacts, profile) {
  return new Map(contacts.map(({a,b}) => {
    const pin = a.slice(4);
    return [stripKey(b), profile.pinAliases[pin] ?? pin];
  }));
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function partName(part) {
  return `${part.displayName || PARTS[part.type]?.name || part.type}（${part.id}）`;
}

function describeChange(hole, previous, next) {
  if (previous===undefined) return `${hole} 接入 ${next}`;
  if (next===undefined) return `${hole} 断开 ${previous}`;
  return `${hole} 从 ${previous} 改接 ${next}`;
}

function overlapsBoardArea(profile, {x,z,rotation}, breadboard, deckX, deckZ) {
  const {width,height} = boardVisual(profile);
  // An edge has to penetrate the target area before it counts as engagement.
  const boardX = width/2 - halfPitch;
  const boardZ = height/2 - halfPitch;
  const direction = rotateBoardPoint(1,0,rotation);
  const cos = Math.abs(direction.x), sin = Math.abs(direction.z);
  const dx = x-breadboard.x, dz = z-breadboard.z;
  const local = rotateBoardPoint(dx,dz,-rotation);
  // Project both rectangles onto the breadboard axes and the PCB axes. Testing
  // the PCB axes too excludes false hits at the corners of an angled board.
  return Math.abs(dx) < deckX + boardX*cos + boardZ*sin &&
    Math.abs(dz) < deckZ + boardX*sin + boardZ*cos &&
    Math.abs(local.x) < boardX + deckX*cos + deckZ*sin &&
    Math.abs(local.z) < boardZ + deckX*sin + deckZ*cos;
}

function seatedPinDrop(circuit, profile, seated, options, breadboard, pointer, anchor) {
  const heldSocket=mountedConnections(circuit,profile).find(({a})=>a===anchor)?.b;
  const heldStrip=signalStrip(heldSocket);
  if (!heldStrip) return {candidate:null,edgeOnly:true,reason:'无法定位这根排针。请重新抓住开发板引脚。'};
  if (!Number.isFinite(pointer?.x) || !Number.isFinite(pointer?.z)) {
    return {candidate:null,edgeOnly:true,reason:'请让抓住的引脚对准 A–J 排信号孔。'};
  }
  const x=pointer.x-breadboard.x,z=pointer.z-breadboard.z;
  const first=signalHole('a',1);
  const column=1+Math.round((x-first.x)/signalPitch);
  const nearest=[...'abcdefghij'].map(row=>signalHole(row,column)).filter(Boolean)
    .reduce((best,hole)=>!best||Math.abs(hole.z-z)<Math.abs(best.z-z)?hole:best,null);
  if (!nearest || Math.abs(nearest.x-x)>halfPitch+1e-8 || Math.abs(nearest.z-z)>halfPitch+1e-8) {
    return {candidate:null,edgeOnly:true,reason:'请让抓住的引脚对准 A–J 排信号孔。'};
  }
  const side=boardMountRows(seated,options).indexOf(heldSocket[3]);
  const rows=options.rowPairs.find(pair=>pair[side]===nearest.endpoint[3]);
  const anchorHole=nearest.endpoint;
  if (!rows) {
    const allowed=options.rowPairs.map(pair=>pair[side].toUpperCase()).sort().join(' / ');
    return {candidate:null,edgeOnly:true,anchorHole,reason:`这根引脚可插入 ${allowed} 排。请对准其中一排的空孔。`};
  }
  const firstColumn=column-(heldStrip.column-seated.column);
  const mount=normalizeBoardMount({column:firstColumn,rotation:seated.rotation,rows},options);
  if (!mount) {
    return {candidate:null,edgeOnly:true,anchorHole,reason:'这组孔会让开发板另一端的排针超出信号孔。请换一列。'};
  }
  return {mount,anchorHole};
}

export function nearestBoardMount(circuit, profile, {x,z,rotation = circuit.board?.mount?.rotation ?? circuit.board?.rotation ?? 0,pointer,anchor=pointer?.anchor}, placementOptions) {
  const breadboard = circuit.breadboard ?? {x:1.8,z:0};
  const options = getMountOptions(profile);
  const seated=normalizeBoardMount(circuit.board?.mount,options);
  const exactRotation=placementOptions?.exactRotation;
  const evaluate = target => {
    const result = evaluateMountPlacement(circuit,profile,target,placementOptions);
    if (!result.candidate || !placementOptions?.checkBreadboardMove) return result;
    const collision = breadboardMoveObstacle(circuit,breadboard,result.candidate.blockers);
    return collision ? {...result,candidate:null,reason:collision.reason} : result;
  };
  if (seated && anchor && !exactRotation) {
    const hit=seatedPinDrop(circuit,profile,seated,options,breadboard,pointer,anchor);
    return hit.mount?{...evaluate(hit.mount),...hit}:hit;
  }
  const {width,depth,opening} = breadboardDimensions;
  const overArea = (point,halfWidth,halfDepth) => point && Math.abs(point.x-breadboard.x)<=halfWidth
    && Math.abs(point.z-breadboard.z)<=halfDepth;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const angle = (rotation%360+360)%360;
  const drop = {x,z,rotation:exactRotation?angle:seated?.rotation??rotation};
  if (!options) {
    const overBreadboard = point => overArea(point,width/2+dropMargin,depth/2+dropMargin);
    return overBreadboard(drop) || overBreadboard(pointer) ? evaluateMountPlacement(circuit,profile) : null;
  }
  if (exactRotation && !options.rotations.includes(angle)) return null;
  const overSignalDeck = point => overArea(point,signalDeckCorner.x+halfPitch,signalDeckCorner.z+halfPitch);
  const reachesSignalDeck = overSignalDeck(drop) || overSignalDeck(pointer) ||
    overlapsBoardArea(profile,drop,breadboard,signalDeckCorner.x+opening/2,signalDeckCorner.z+opening/2);
  if (!reachesSignalDeck) {
    const touchesBreadboard = overArea(pointer,width/2,depth/2) ||
      overlapsBoardArea(profile,drop,breadboard,width/2-halfPitch,depth/2-halfPitch);
    if (!touchesBreadboard) return null;
    return {candidate:null,edgeOnly:true,reason:'这里只碰到面包板边缘或电源轨。请继续拖到 A–J 排信号孔。'};
  }
  const alignedRotation = exactRotation ? angle : seated?.rotation ?? (angle>=180 ? options.rotations[1] : options.defaultRotation);
  const rowStarts = direction => options.rowPairs.map((rows,rowIndex) => {
    const mount=normalizeBoardMount({column:options.minColumn,rotation:direction,rows},options);
    const pose=boardPose({...circuit,board:{...circuit.board,mount}},profile);
    return {mount,pose,rowIndex};
  });
  const slotAt = ({mount,pose,rowIndex},column) => {
    const centerX=pose.x+(column-options.minColumn)*signalPitch;
    const dx=Math.abs(x-centerX),dz=Math.abs(z-pose.z);
    return {mount:{...mount,column},rowIndex,dx,dz,distance:Math.round(Math.hypot(dx,dz)*1e9)};
  };
  const byDistance = (a,b) => a.distance-b.distance || a.rowIndex-b.rowIndex;
  const aligned = rowStarts(alignedRotation);
  const nearestInEachRow = aligned.map(row => {
    const offset=Math.round((x-row.pose.x)/signalPitch);
    return slotAt(row,Math.max(options.minColumn,Math.min(options.maxColumn,options.minColumn+offset)));
  }).sort(byDistance);
  let initial=nearestInEachRow[0];
  if (seated) {
    const origin=boardPose(circuit,profile);
    const along=Math.abs(x-origin.x),across=Math.abs(z-origin.z);
    // Bias the original row slightly on a horizontal drag. Use distances so
    // crossing toward the next row cannot snap back to the original row.
    if (along>=halfPitch && along>=across*1.25) {
      const rowIndex=options.rowPairs.indexOf(boardMountRows(seated,options));
      const original=nearestInEachRow.find(slot=>slot.rowIndex===rowIndex);
      if (original.dz<=initial.dz+seatedRowBias) initial=original;
    }
    // Wider crosswise capture makes the seated board easier to grab at an
    // angle without clamping a distant drop to an end column or outside row.
    if (initial.dx>dropMargin || initial.dz>seatedCrossMargin) {
      return {candidate:null,edgeOnly:true,reason:'板身中心已偏离可插孔位。请拖近面包板中间的信号孔区。'};
    }
  }
  const {mount}=initial;
  const exact = evaluate(mount);
  if (seated || exactRotation || exact.candidate || !placementOptions?.nearby) return {...exact,mount};
  for (const direction of [alignedRotation,...options.rotations.filter(value=>value!==alignedRotation)]) {
    const turned=direction!==alignedRotation;
    const remaining=[];
    for (const row of turned?rowStarts(direction):aligned) {
      for (let column=options.minColumn;column<=options.maxColumn;column++) {
        if (!turned && row.rowIndex===initial.rowIndex && column===mount.column) continue;
        remaining.push(slotAt(row,column));
      }
    }
    for (const slot of remaining.sort(byDistance)) {
      const alternative=evaluate(slot.mount);
      if (!alternative.candidate) continue;
      const adjusted=turned || slot.rowIndex!==initial.rowIndex || Math.abs(slot.mount.column-mount.column)>2;
      if (!adjusted) return {...alternative,mount:alternative.candidate.mount,nearby:true};
      const candidate={...alternative.candidate,adjusted:true};
      return {...alternative,candidate,mount:candidate.mount,nearby:true,adjusted:true};
    }
  }
  return {...exact,mount};
}

export function breadboardMoveObstacle(circuit, breadboard, displaced = []) {
  const parts = (circuit.components ?? []).filter(part=>!displaced.includes(part));
  const loose = parts.filter(part=>!part.mount).map(part=>({part,bounds:componentCollisionBounds(part)}));
  for (const part of parts.filter(part=>part.mount)) {
    const pose = partPose(part,breadboard);
    if (!pose.mounted) continue;
    const body = mountedPartBodyBounds(part,pose);
    const obstacle = loose.find(item=>overlaps(body,item.bounds))?.part;
    if (obstacle) return {part,obstacle,reason:`${partName(part)}会碰到 ${partName(obstacle)}。请先移开散件。`};
  }
  return null;
}

export function nearestBreadboardMount(circuit, profile, {x,z,pointer}, placementOptions) {
  const board = circuit.board;
  if (!board || board.mount || board.locked || circuit.breadboard?.locked) return null;
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x)>30 || Math.abs(z)>20) return null;

  const breadboard = {...circuit.breadboard,x,z};
  const drop = {...board};
  if (pointer) {
    const local = rotateBoardPoint(pointer.x-board.x,pointer.z-board.z,-(board.rotation ?? 0));
    const {width,height} = boardVisual(profile);
    // The cursor normally travels inside the moving breadboard. Treat it as a
    // drop target only when it also crosses the fixed PCB.
    if (Math.abs(local.x)<=width/2 && Math.abs(local.z)<=height/2) drop.pointer = pointer;
  }
  const hit = nearestBoardMount({...circuit,breadboard},profile,drop,{...placementOptions,checkBreadboardMove:true});
  if (!hit) return null;
  if (!hit.candidate) return {...hit,breadboard};
  return {...hit,breadboard,candidate:{...hit.candidate,breadboard}};
}

function planWireClearance(wires, coveredByPlacement, partSockets, coveredByPart, moveWires, clearObstructions) {
  const used = new Set([...partSockets,...wires.flatMap(({a,b})=>[a,b])]);
  const wireMoves = [], unpluggedWires = [], blocked = new Set();
  for (const wire of wires) {
    const moves = [];
    for (const end of ['a','b']) {
      const from = wire[end];
      if (!sockets.has(from) || !coveredByPlacement(from)) continue;
      const strip = moveWires && signalStrip(from);
      const to = strip && Array.from(strip.rows,row=>'bb:'+row+strip.column)
        .filter(hole=>!used.has(hole) && !coveredByPlacement(hole) && !coveredByPart(sockets.get(hole)))
        .sort((a,b)=>Math.abs(sockets.get(a).z-sockets.get(from).z)-Math.abs(sockets.get(b).z-sockets.get(from).z))[0];
      if (!to) {
        if (clearObstructions) unpluggedWires.push(wire);
        else blocked.add(from);
        if (clearObstructions) break;
        continue;
      }
      used.add(to);
      moves.push({wire,end,from,to});
    }
    if (unpluggedWires.at(-1)===wire) {
      for (const {to} of moves) used.delete(to);
    } else {
      wireMoves.push(...moves);
    }
  }
  return {wireMoves,unpluggedWires,blocked:[...blocked]};
}

export function describeMountChanges(candidate) {
  const label = endpoint => endpoint.startsWith('bb:') ? endpoint.slice(3).toUpperCase() : endpoint;
  return [
    ...candidate.netChanges,
    ...candidate.wireMoves.map(({from,to})=>`跳线 ${label(from)} → ${label(to)}（同一孔组）`),
    ...candidate.unpluggedWires.map(({id,a,b})=>`拔掉跳线 ${id}（${label(a)} ↔ ${label(b)}）`),
    ...candidate.unpluggedParts.map(part=>`拔下并移到旁边：${partName(part)}`)
  ];
}

export function evaluateMountPlacement(circuit, profile, mount, {moveWires=false,clearObstructions=false}={}) {
  const options = getMountOptions(profile);
  if (!options) return {candidate:null, reason:'当前板型需要用跳线接入面包板。'};
  const position=normalizeBoardMount(mount,options);
  if (!position) return {candidate:null, reason:`请选择第 ${options.minColumn}–${options.maxColumn} 列、可用排针行和支持的方向。`};

  const current=normalizeBoardMount(circuit.board?.mount,options);
  if (current?.column===position.column && current.rotation===position.rotation &&
      current.rows?.[0]===position.rows?.[0] && current.rows?.[1]===position.rows?.[1]) {
    return {candidate:null, unchanged:true, reason:'两排针已插好。可选择其他排针行、起始列或朝向。'};
  }

  const preview = {...circuit, board:{...circuit.board, mount:position}};
  const pose = boardPose(preview,profile);
  const rows=boardMountRows(position,options);
  const contacts=mountedConnections(preview,profile);
  const contactSockets=new Set(contacts.map(({b})=>b));
  const {width,height} = boardVisual(profile);
  const footprint = {left:pose.x-height/2, right:pose.x+height/2, top:pose.z-width/2, bottom:pose.z+width/2};
  const breadboard = circuit.breadboard ?? {x:1.8,z:0};
  const coveredByPlacement = endpoint => {
    if (contactSockets.has(endpoint)) return true;
    const hole = sockets.get(endpoint);
    const x = breadboard.x+hole.x, z = breadboard.z+hole.z;
    return x>=footprint.left-plugClearance && x<=footprint.right+plugClearance &&
      z>=footprint.top-plugClearance && z<=footprint.bottom+plugClearance;
  };
  const parts=circuit.components ?? [];
  const inserted=parts.filter(part=>part.mount);
  const unpluggedParts = [];
  for (const part of inserted) {
    const pose=partPose(part,breadboard),contacts=mountedPartContacts(part);
    if (!pose.mounted) continue;
    if (overlaps(footprint,mountedPartBodyBounds(part,pose)) || contacts.some(({b})=>coveredByPlacement(b))) {
      if (!clearObstructions || part.locked) return {candidate:null,reason:`${partName(part)}已插入${part.locked?'并锁定':''}，请${part.locked?'先解锁再':''}拔下元件或另选位置。`};
      unpluggedParts.push(part);
    }
  }
  const blockers = [...parts.filter(part => !part.mount && overlaps(footprint,componentCollisionBounds(part))),...unpluggedParts];
  const locked = blockers.filter(part => part.locked);
  if (locked.length) {
    const names = locked.map(partName);
    return {candidate:null, blockers:names, reason:`${names.join('、')}已锁定，请先解锁或另选位置。`};
  }

  const remainingParts = inserted.filter(part=>!unpluggedParts.includes(part));
  const remainingPartSockets = remainingParts.flatMap(mountedPartContacts).map(({b})=>b);
  const capacitorCenters = remainingParts.filter(part=>part.type==='capacitor')
    .map(part=>partPose(part,{x:0,z:0})).filter(part=>part.mounted);
  const displayCenters = remainingParts.filter(part=>part.type==='sevenseg')
    .map(part=>partPose(part,{x:0,z:0})).filter(part=>part.mounted);
  const coveredByPart = hole => capacitorCenters.some(center=>capacitorCanObscuresHole(center,hole)) ||
    displayCenters.some(center=>sevenSegmentObscuresHole(center,hole));
  const {wireMoves,unpluggedWires,blocked} = planWireClearance(circuit.wires ?? [],coveredByPlacement,
    remainingPartSockets,coveredByPart,moveWires,clearObstructions);
  if (blocked.length) {
    const names = blocked.map(endpoint => endpoint.slice(3).toUpperCase());
    const description = names.slice(0,4).join('、') + (names.length>4 ? `等 ${names.length} 个孔` : ' 孔');
    return {candidate:null, reason:`${description}已有跳线，先移开跳线或另选位置。`};
  }
  const usedStrips = new Map();
  const remainingWireEndpoints = (circuit.wires ?? []).filter(wire=>!unpluggedWires.includes(wire)).flatMap(({a,b})=>[a,b]);
  for (const endpoint of [...remainingWireEndpoints,...remainingPartSockets]) {
    const strip = stripKey(endpoint);
    if (strip && !usedStrips.has(strip)) usedStrips.set(strip,endpoint.slice(3).toUpperCase());
  }
  const nextNets = mountedStripNets(contacts,profile);
  const priorNets = mountedStripNets(mountedConnections(circuit,profile),profile);
  let connectedNets = 0;
  const changes = [];
  for (const [strip,hole] of usedStrips) {
    if (nextNets.has(strip)) connectedNets++;
    const previous = priorNets.get(strip), next = nextNets.get(strip);
    if (priorNets.size && previous!==next) changes.push(describeChange(hole,previous,next));
  }
  const changedNets = changes.length;
  const warning = changedNets ? `调整插位会改变 ${changedNets} 个已有连接的孔组。${changes.slice(0,2).join('，')}。`
    : !priorNets.size && connectedNets ? `插入后会接通 ${connectedNets} 个已有连接的孔组。` : undefined;
  return {
    candidate:{mount:position,rows,pose,contacts,blockers,wireMoves,unpluggedWires,unpluggedParts,connectedNets,changedNets,netChanges:changes,warning},
    blockers:blockers.map(partName), warning, connections:connectedNets
  };
}
