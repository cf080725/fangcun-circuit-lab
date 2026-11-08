import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {nearCompactAdjuster,pointerIntent} from '../dist/model-renderer.js';

const source=readFileSync(new URL('../dist/workbench2d.js',import.meta.url),'utf8');
function rendererFunction(name){
  const code=source.match(new RegExp('^  function '+name+'\\([^\\n]*\\n[\\s\\S]*?^  }','m'))?.[0];
  assert.ok(code,'Missing renderer function '+name);
  return code;
}

const mcu={kind:'component',id:'mcu'};
const pcbPin={kind:'pin',id:'mcu',endpoint:'mcu:PA0',direct:true};
const socket={kind:'pin',id:'breadboard',endpoint:'bb:a24',direct:true};
const breadboard={kind:'component',id:'breadboard'};
const wire={kind:'wire',id:'w1'};
const handle={kind:'wire-handle',id:'w1',end:'a'};

function fixture(overrides={}){
  let raw,fuzzyCalls=0;
  const scope={
    hooks:{},mode:'orbit',pendingPin:null,reconnectPending:null,spacePan:false,
    allowBoardDrag:()=>true,mountedAssemblyPart:id=>id==='mcu',
    endpointMap:new Map([[pcbPin.endpoint,{x:20,y:20}]]),SCALE:55,
    coveredByMountedBoard:point=>point.covered,
    getHit:element=>element??null,
    document:{elementFromPoint:()=>raw},
    nearestEndpoint:()=>{fuzzyCalls++;return {kind:'pin',id:'mcu',endpoint:'mcu:PA1'};},
    screenWireHits:()=>[],
    ...overrides
  };
  const interaction=runInNewContext(rendererFunction('interactionHit')+'\ninteractionHit',scope);
  const grab=runInNewContext(rendererFunction('mountedBoardGrab')+'\nmountedBoardGrab',scope);
  return {
    at(element,{forcePin=false,covered=false,x=20,y=20}={}){
      raw=element;
      const event={button:0,clientX:20,clientY:20};
      const direct=interaction(event,forcePin),hit=grab(direct,{covered,x,y});
      const intent=pointerIntent(hit,{mode:scope.mode,pendingPin:scope.pendingPin,reconnecting:Boolean(scope.reconnectPending),allowBoardDrag:scope.allowBoardDrag()});
      return {direct,hit,intent};
    },
    get fuzzyCalls(){return fuzzyCalls;}
  };
}

test('mounted select mode does not turn nearby deck or background into a fuzzy board lift',()=>{
  const view=fixture();
  assert.deepEqual(view.at(breadboard),{direct:breadboard,hit:breadboard,intent:'pan'});
  assert.deepEqual(view.at(null),{direct:null,hit:null,intent:'pan'});
  assert.deepEqual(view.at(socket),{direct:socket,hit:socket,intent:'pan'});
  assert.equal(view.fuzzyCalls,0);
});

test('mounted move mode keeps the breadboard draggable and only an exact MCU pin anchors a re-seat',()=>{
  const view=fixture({mode:'move'});
  assert.deepEqual(view.at(breadboard),{direct:breadboard,hit:breadboard,intent:'drag'});
  assert.deepEqual(view.at(socket),{direct:socket,hit:socket,intent:'drag'});
  const pickup=view.at(pcbPin);
  assert.strictEqual(pickup.direct,pcbPin);
  assert.equal(pickup.hit.id,'mcu');
  assert.equal(pickup.hit.anchor,'mcu:PA0');
  assert.equal(pickup.intent,'drag');
});

test('overlaid wires preserve a tap and yield a board drag only above the seated PCB',()=>{
  const view=fixture();
  assert.deepEqual(view.at(wire),{direct:wire,hit:wire,intent:'select'});
  const overlay=view.at(wire,{covered:true});
  assert.strictEqual(overlay.direct,wire);
  assert.equal(overlay.hit.id,'mcu');
  assert.equal(overlay.hit.anchor,undefined);
  assert.equal(overlay.intent,'drag');
  assert.deepEqual(view.at(handle,{covered:true}),{direct:handle,hit:handle,intent:'reconnect'});
  assert.deepEqual(view.at(mcu),{direct:mcu,hit:mcu,intent:'drag'});
});

test('nearest wire selection keeps exact part bodies and pins available',()=>{
  const view=fixture({screenWireHits:()=>[{id:'w-near'}]});
  const resistor={kind:'component',id:'r1'};
  assert.equal(view.at(null).direct?.id,'w-near');
  assert.equal(view.at(wire).direct?.id,'w-near');
  assert.strictEqual(view.at(resistor).direct,resistor);
  assert.strictEqual(view.at(socket).direct,socket);
});

test('an expanded pin tap zone overlaps the PCB without forcing an exact-pin drag',()=>{
  const view=fixture();
  const center=view.at(pcbPin);
  const edge=view.at(pcbPin,{x:25});
  assert.equal(center.hit.anchor,pcbPin.endpoint);
  assert.strictEqual(edge.direct,pcbPin);
  assert.equal(edge.hit.id,'mcu');
  assert.equal(edge.hit.anchor,undefined);
  assert.equal(edge.intent,'drag');
});

test('the seated 2D drag threshold falls below one visible hole pitch when zoomed out',()=>{
  let zoom=.22;
  const threshold=runInNewContext(rendererFunction('boardDragThreshold')+'\nboardDragThreshold',{
    SCALE:55,signalPitch:.254,svg:{getScreenCTM:()=>({a:zoom,b:0})},
    clamp:(value,min,max)=>Math.min(max,Math.max(min,value))
  });
  assert.equal(threshold(),2);
  assert.ok(threshold()<.254*55*zoom);
  zoom=1;
  assert.equal(threshold(),4);
});

test('explicit wiring uses the visible endpoint first and still allows proximity targeting',()=>{
  const view=fixture({mode:'wire'});
  assert.deepEqual(view.at(socket,{forcePin:true,covered:true}),{direct:socket,hit:socket,intent:'wire'});
  assert.deepEqual(view.at(pcbPin,{covered:true}),{direct:pcbPin,hit:pcbPin,intent:'wire'});
  const miss=view.at(breadboard,{forcePin:true});
  assert.equal(miss.hit.endpoint,'mcu:PA1');
  assert.equal(miss.intent,'wire');
  assert.equal(view.fuzzyCalls,1);
});

test('a seated board may follow the hole grid beyond the loose-part placement bounds',()=>{
  const position=runInNewContext(rendererFunction('dragPosition')+'\ndragPosition',{
    SCALE:55,screenPoint:event=>event,
    clamp:(value,min,max)=>Math.min(max,Math.max(min,value))
  });
  const point={x:30.508*55,y:20.254*55},offset={offsetX:0,offsetZ:0};
  const seated=position(point,{...offset,repositionBoard:true});
  const loose=position(point,offset);
  assert.ok(Math.abs(seated.x-30.508)<1e-9);
  assert.ok(Math.abs(seated.z-20.254)<1e-9);
  assert.equal(loose.x,30);
  assert.equal(loose.z,20);
});

test('a compact adjuster touch allowance is bounded and ends once the rotor is large enough',()=>{
  assert.equal(nearCompactAdjuster(5,8,4),true);
  assert.equal(nearCompactAdjuster(13,1,4),false);
  assert.equal(nearCompactAdjuster(5,8,13),false);
});
