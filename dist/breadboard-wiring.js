import {getBoardProfile} from './board-profiles.js';
import {boardPose,mountedBoardCoversHole,mountedConnections,signalStrip} from './breadboard-mount.js';
import {breadboardSockets} from './geometry-3d.js';
import {capacitorCanObscuresHole,mountedPartContacts,partPose,sevenSegmentObscuresHole} from './part-mount.js';

function stripKey(endpoint) {
  const strip=signalStrip(endpoint);
  if (strip) return `${strip.rows}:${strip.column}`;
  const rail=/^bb:([pn])(\d+)$/.exec(endpoint);
  return rail ? `${rail[1]}:${Number(rail[2])<=25?'upper':'lower'}` : null;
}

const sockets = new Map();
const strips = new Map();
for (const hole of breadboardSockets()) {
  const key=stripKey(hole.endpoint);
  sockets.set(hole.endpoint,{...hole,key});
  if (!strips.has(key)) strips.set(key,[]);
  strips.get(key).push(hole);
}

const blockedBy = {
  board:'被开发板占用或盖住',
  part:'已插入元件',
  obscured:'被电解电容外壳遮住',
  display:'被数码管外壳遮住',
  wire:'已有跳线'
};
const label = endpoint => endpoint.slice(3).toUpperCase();
const clear = kind => ({ok:true,kind,message:'',alternatives:[],headerEndpoint:null});

// Read the current circuit again after a wiring or placement change.
export function createBreadboardWiring(circuit, profile=getBoardProfile(circuit?.boardId)) {
  const pose=boardPose(circuit,profile);
  const headers=mountedConnections(circuit,profile);
  const boardSockets=new Set(headers.map(({b})=>b));
  const headerByStrip=new Map(headers.map(({a,b})=>[sockets.get(b).key,a]));
  const components=circuit?.components ?? [];
  const partSockets=new Set(components.flatMap(mountedPartContacts).map(({b})=>b));
  const capacitorCenters=components.filter(part=>part.type==='capacitor'&&part.mount)
    .map(part=>partPose(part,{x:0,z:0})).filter(part=>part.mounted);
  const displayCenters=components.filter(part=>part.type==='sevenseg'&&part.mount)
    .map(part=>partPose(part,{x:0,z:0})).filter(part=>part.mounted);
  const wiredSockets=new Map();
  for (const wire of circuit?.wires ?? []) {
    for (const endpoint of [wire.a,wire.b]) {
      if (!sockets.has(endpoint)) continue;
      if (!wiredSockets.has(endpoint)) wiredSockets.set(endpoint,[]);
      wiredSockets.get(endpoint).push(wire.id);
    }
  }

  function obstacle(hole, ignoreWireId) {
    if (boardSockets.has(hole.endpoint) || mountedBoardCoversHole(circuit,profile,hole,pose)) return 'board';
    if (partSockets.has(hole.endpoint)) return 'part';
    if (capacitorCenters.some(center=>capacitorCanObscuresHole(center,hole))) return 'obscured';
    if (displayCenters.some(center=>sevenSegmentObscuresHole(center,hole))) return 'display';
    const wireIds=wiredSockets.get(hole.endpoint);
    if (wireIds && (ignoreWireId===undefined || wireIds.some(id=>id!==ignoreWireId))) return 'wire';
    return 'free';
  }

  function check(endpoint, {ignoreWireId}={}) {
    if (typeof endpoint==='string' && endpoint && !endpoint.startsWith('bb:')) return clear('non-socket');
    const hole=sockets.get(endpoint);
    if (!hole) return {ok:false,kind:'invalid',message:'请选择有效的面包板孔。',alternatives:[],headerEndpoint:null};
    const kind=obstacle(hole,ignoreWireId);
    if (kind==='free') return clear(kind);
    const distance=other=>Math.abs(other.x-hole.x)+Math.abs(other.z-hole.z);
    const alternatives=strips.get(hole.key).filter(other=>obstacle(other)==='free')
      .sort((a,b)=>distance(a)-distance(b)).map(other=>other.endpoint);
    const header=headerByStrip.get(hole.key);
    const reconnecting=ignoreWireId && circuit?.wires?.find(wire=>wire.id===ignoreWireId);
    const headerEndpoint=header && header!==reconnecting?.a && header!==reconnecting?.b ? header : null;
    const next=alternatives.length ? `可改用同组空孔 ${alternatives.slice(0,3).map(label).join('、')}。`
      : headerEndpoint ? `同组没有空孔，可从开发板 ${headerEndpoint.slice(4)} 排针引线。`
      : '同组没有空孔。请先移开已有接线或元件。';
    return {ok:false,kind,message:`${label(endpoint)} 孔${blockedBy[kind]}。${next}`,alternatives,headerEndpoint};
  }

  return {check};
}
