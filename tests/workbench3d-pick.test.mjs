import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import * as THREE from '../dist/vendor/three.module.js';

const source=readFileSync(new URL('../dist/workbench.js',import.meta.url),'utf8');
function extract(name,scope) {
  const definition=source.match(new RegExp(`^  function ${name}\\([^\\n]*\\n[\\s\\S]*?^  }`,'m'))?.[0];
  assert.ok(definition,`Missing 3D workbench function ${name}`);
  return runInNewContext(definition+'\n'+name,scope);
}

const physical=(userData,distance)=>({object:{userData},distance,point:{x:1,y:.8,z:.3}});
const boardBody=physical({componentId:'mcu'},9);
const proxy=(endpoint,distance)=>physical({endpoint},distance);
const terminal=(componentId,gap,hidden=false)=>({
  componentId,hidden,position:{gap,clone:()=>({project:()=>({x:0,y:0,z:0})}),distanceTo:()=>9}
});
function fixture({objectHits,pinHits,endpoints,mode='orbit',handles=[],pointerType='touch',hooks={},nearPotAdjuster=()=>false,nearbyVisibleWire=()=>null}) {
  const handleTargets=[],pinTargets=[];
  const scope={
    renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})}},
    pointRay(){},raycaster:{
      ray:{distanceToPoint:point=>point.gap},
      intersectObjects:targets=>targets===handleTargets?handles:targets===pinTargets?pinHits:objectHits,
    },
    inspection:false,hooks,nearPotAdjuster,nearbyVisibleWire,pinTargets,handleTargets,objectTargets:[],wireTargets:[],
    endpoints,mode,mountedAssemblyPart:()=>true,allowBoardDrag:()=>true,canMoveAssembly:()=>false,
    pendingPin:null,reconnectPending:null,spacePan:false,insertedParts:new Set(),
    componentGroups:new Map(),circuit:{board:{},breadboard:{}},camera:{position:{}},boardView:null
  };
  return extract('pick',scope)({clientX:50,clientY:50,pointerType});
}

test('seated board housing beats wide or occluded pin proxies and projected centers',()=>{
  const endpoints=new Map([['mcu:PA0',terminal('mcu',.105)],['mcu:PA1',terminal('mcu',.01)]]);
  for(const pinHits of [[proxy('mcu:PA0',8.9)],[proxy('mcu:PA1',9.1)],[]]){
    const hit=fixture({objectHits:[boardBody],pinHits,endpoints});
    assert.equal(hit.kind,'component');
    assert.equal(hit.componentId,'mcu');
    assert.equal(hit.boardDrag?.anchor,undefined);
  }
});

test('seated board keeps exact exposed pin anchor even behind a hidden hole proxy',()=>{
  const endpoints=new Map([['bb:c6',terminal('breadboard',0,true)],['mcu:PA0',terminal('mcu',.025)]]);
  const hit=fixture({objectHits:[boardBody],pinHits:[proxy('bb:c6',8.8),proxy('mcu:PA0',8.9)],endpoints});
  assert.equal(hit.kind,'pin');
  assert.equal(hit.endpoint,'mcu:PA0');
  assert.equal(hit.boardDrag.anchor,'mcu:PA0');
});

test('seated selection preserves nearby deck, exact hole and foreground wire targets',()=>{
  const deck=physical({componentId:'breadboard'},9),wire=physical({wireId:'w1'},8);
  const endpoints=new Map([['mcu:PA0',terminal('mcu',.1)],['bb:a6',terminal('breadboard',0)]]);
  assert.equal(fixture({objectHits:[deck],pinHits:[],endpoints}).componentId,'breadboard');
  assert.equal(fixture({objectHits:[deck],pinHits:[proxy('bb:a6',9)],endpoints}).endpoint,'bb:a6');
  const hit=fixture({objectHits:[wire,boardBody],pinHits:[proxy('mcu:PA0',8.2)],endpoints});
  assert.equal(hit.kind,'wire');
  assert.equal(hit.wireId,'w1');
  assert.equal(hit.boardDrag.componentId,'mcu');
  assert.equal(hit.boardDrag.anchor,undefined);
});

test('explicit Wire mode still uses expanded pin targets beside a seated board',()=>{
  const endpoints=new Map([['mcu:PA0',terminal('mcu',.105)]]);
  const hit=fixture({objectHits:[boardBody],pinHits:[],endpoints,mode:'wire'});
  assert.equal(hit.kind,'pin');
  assert.equal(hit.endpoint,'mcu:PA0');
});

test('a forgiving wire target beats an unrelated pin halo while the exact visible pin stays usable',()=>{
  const led=physical({componentId:'led1'},9);
  const wire=physical({wireId:'w1'},8.5);
  const args={objectHits:[boardBody],pinHits:[proxy('led1:A',8.7)],nearbyVisibleWire:()=>wire};
  const wide=new Map([['led1:A',terminal('led1',.11)]]);
  const exact=new Map([['led1:A',terminal('led1',.02)]]);
  assert.equal(fixture({...args,endpoints:wide}).wireId,'w1');
  assert.equal(fixture({...args,endpoints:exact}).endpoint,'led1:A');
  const solid=fixture({...args,objectHits:[led],pinHits:[proxy('r1:1',8.9)],endpoints:new Map([['r1:1',terminal('r1',.01)]])});
  assert.equal(solid.componentId,'led1');
  assert.equal(solid.kind,'component');
});

test('a compact 3D touch adjuster extends into its own housing, preserving other modes and an overlaid wire',()=>{
  const housing=physical({componentId:'pot1',potHousing:true},9);
  const args={objectHits:[housing],pinHits:[],endpoints:new Map(),hooks:{onPotAdjust(){}},nearPotAdjuster:()=>true};
  assert.equal(fixture(args).kind,'pot-knob');
  assert.equal(fixture({...args,pointerType:'mouse'}).kind,'component');
  assert.equal(fixture({...args,mode:'move'}).kind,'component');
  assert.equal(fixture({...args,mode:'wire'}).kind,'component');
  assert.equal(fixture({...args,objectHits:[physical({wireId:'w1'},8),housing]}).kind,'wire');
});

test('move mode can grab a seated board through a selected wire handle',()=>{
  const args={objectHits:[boardBody],pinHits:[],endpoints:new Map(),handles:[physical({wireId:'w1',wireEnd:'b'},8)]};
  assert.equal(fixture(args).kind,'wire-handle');
  assert.equal(fixture({...args,mode:'move'}).componentId,'mcu');
  assert.equal(fixture({...args,objectHits:[],mode:'move'}).kind,'wire-handle');
});

test('seated drag can reach outer socket positions and keeps exact anchor on projection miss',()=>{
  const position={x:32.4,z:-21.9};
  const drag=extract('dragPosition',{positionOnGround:()=>position,clamp:(x,a,b)=>Math.min(b,Math.max(a,x))});
  const active={offset:{x:0,z:0},planeY:.4};
  const seated=drag({}, {...active,relocatingBoard:true});
  assert.deepEqual([seated.x,seated.z],[32.4,-21.9]);
  const detached=drag({},active);
  assert.deepEqual([detached.x,detached.z],[30,-20]);
  const point=extract('boardDropPointer',{positionOnGround:()=>null,breadboardDimensions:{coverTop:.4}});
  const invalid=point({}, {boardAnchor:'mcu:PA0'});
  assert.equal(invalid.anchor,'mcu:PA0');
  assert.equal(invalid.x,undefined);
  assert.equal(point({},{}),null);
});

test('a rowwise drag keeps its row in an angled view and crossing remains possible',()=>{
  const drag=extract('dragPosition',{positionOnGround:()=>({x:2.5,z:.77})});
  const active={relocatingBoard:true,x:100,y:100,origin:{x:2,z:1},offset:{x:0,z:0},
    boardScreen:{columns:{x:.98,y:.2}}};
  const along=drag({clientX:126,clientY:100},active);
  assert.deepEqual([along.x,along.z],[2.5,1]);
  const across=drag({clientX:112,clientY:126},active);
  assert.deepEqual([across.x,across.z],[2.5,.77]);
});

test('a shallow oblique drag preserves actual grab-plane movement across rows',()=>{
  let position={x:2,z:1.254};
  const drag=extract('dragPosition',{positionOnGround:()=>position});
  const active={relocatingBoard:true,x:100,y:100,origin:{x:2,z:1},offset:{x:0,z:0},
    boardScreen:{columns:{x:1,y:0},preferScreen:true}};
  const moved=drag({clientX:89.90,clientY:102.19},active);
  assert.deepEqual([moved.x,moved.z],[2,1.254]);
  position={x:40,z:-25};
  assert.equal(drag({clientX:100,clientY:100},active),null);
});

test('an oblique pin drag uses the translated pin offset while top view uses the pointed socket',()=>{
  const point=extract('boardDropPointer',{positionOnGround:()=>({x:2,z:4}),breadboardDimensions:{coverTop:.4}});
  const grip={boardAnchor:'mcu:PA0',boardAnchorOffset:{x:1,z:-1}};
  for(const [topDown,expected] of [[false,[7,5]],[true,[2,4]]]){
    const next=point({}, {...grip,boardScreen:{topDown}}, {x:6,z:6});
    assert.deepEqual([next.x,next.z],expected);
    assert.equal(next.anchor,'mcu:PA0');
  }
});

test('a near-overhead orbit uses the raised pin plane until vertical view',()=>{
  const camera=new THREE.PerspectiveCamera(36,600/420,.04,100);
  const anchor=new THREE.Vector3(1,.8,1);
  const projection=extract('boardScreenProjection',{
    camera,v3:new THREE.Vector3(),THREE,stage:{clientHeight:420},signalPitch:.254,
    renderer:{domElement:{getBoundingClientRect:()=>({width:600,height:420})}},
  });
  const angle=Math.PI/12;
  camera.position.set(0,12*Math.cos(angle),12*Math.sin(angle));
  camera.lookAt(0,0,0);camera.updateMatrixWorld();
  assert.equal(projection(anchor).topDown,false);
  camera.position.set(0,12,.001);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  assert.equal(projection(anchor).topDown,true);
});
