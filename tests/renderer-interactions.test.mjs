import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionDescriptor, pointerIntent, boardResetTap, isSecondPinTap, wireGestureState, connectionPlan, directionalEndpoint, componentBounds, componentPins, sceneRotationStep, visualBounds } from '../dist/model-renderer.js';
import { getBoardProfile } from '../dist/board-profiles.js';

const nodes=new Set(['mcu:PA0','mcu:PA1','mcu:GND1','led1:A','led1:K','r1:1','r1:2']);
const circuit=()=>({boardId:'bluepill',board:{x:-5,z:0},breadboard:{x:1.8,z:0},components:[{id:'led1',type:'led',x:1,z:0},{id:'r1',type:'resistor',x:2,z:0}],wires:[{id:'w1',a:'mcu:PA0',b:'led1:A'},{id:'w2',a:'mcu:GND1',b:'led1:K'}]});

test('rotation only handles a deliberate R or Shift+R without system modifiers',()=>{
  assert.equal(sceneRotationStep({key:'r'}),90);
  assert.equal(sceneRotationStep({key:'R'}),90);
  assert.equal(sceneRotationStep({key:'R',shiftKey:true}),-90);
  for (const key of ['ctrlKey','metaKey','altKey','repeat','isComposing','defaultPrevented']) {
    assert.equal(sceneRotationStep({key:'r',[key]:true}),0,key);
  }
  assert.equal(sceneRotationStep({key:'r',keyCode:229}),0);
  assert.equal(sceneRotationStep({key:'t',code:'KeyR'}),0);
  assert.equal(sceneRotationStep({key:'r',code:'KeyT'}),90);
});

test('rotation leaves text editing and form controls to their focused element',()=>{
  const nativeInput={closest:selector=>selector.includes('input')?nativeInput:null};
  const customTextbox={closest:selector=>selector.includes('[role~="textbox"]')?customTextbox:null};
  const editable={isContentEditable:true};
  const editableChild={closest:selector=>selector==='[contenteditable]'?editable:null};
  for (const target of [nativeInput,customTextbox,editable,editableChild]) {
    assert.equal(sceneRotationStep({key:'r',target}),0);
    assert.equal(sceneRotationStep({key:'R',shiftKey:true,target}),0);
  }
  const canvas={closest:()=>null};
  assert.equal(sceneRotationStep({key:'r',target:canvas,composedPath:()=>[nativeInput,canvas]}),0);
  assert.equal(sceneRotationStep({key:'r',target:canvas}),90);
});

test('a pin drag during endpoint reconnection preserves the wire id and moved end',()=>{
  const request={id:'w1',end:'a'};
  const gesture=wireGestureState('mcu:PA1','led1:A',request,{pointerId:3,x:20,y:30});
  assert.equal(gesture.start,'led1:A');assert.equal(gesture.clickedEndpoint,'mcu:PA1');
  assert.deepEqual(gesture.reconnect,request);assert.notEqual(gesture.reconnect,request);
  const plan=connectionPlan(circuit(),nodes,gesture.start,'mcu:PA1',gesture.reconnect);
  assert.deepEqual(plan,{ok:true,kind:'reconnect',id:'w1',end:'a',endpoint:'mcu:PA1',a:'led1:A',b:'mcu:PA1'});
});

test('second-click and drag share the pending origin without losing the clicked endpoint',()=>{
  const gesture=wireGestureState('r1:1','mcu:PA1',null,{pointerId:1});
  assert.equal(gesture.start,'mcu:PA1');assert.equal(gesture.clickedEndpoint,'r1:1');
  assert.equal(connectionPlan(circuit(),nodes,gesture.start,gesture.clickedEndpoint).kind,'connect');
  const initial=wireGestureState('r1:1',null,null);assert.equal(initial.start,'r1:1');
});

test('reconnection rejects the unchanged terminal and self-loop without a mutation callback',()=>{
  assert.equal(connectionPlan(circuit(),nodes,'mcu:PA0','led1:A',{id:'w1',end:'b'}).reason,'unchanged');
  assert.equal(connectionPlan(circuit(),nodes,'mcu:PA0','mcu:PA0',{id:'w1',end:'b'}).reason,'same');
  assert.equal(connectionPlan(circuit(),nodes,'r1:1','r1:1').reason,'same');
});

test('duplicate wires are rejected in either orientation, including reconnection',()=>{
  assert.equal(connectionPlan(circuit(),nodes,'led1:A','mcu:PA0').reason,'duplicate');
  const data=circuit();data.wires.push({id:'w3',a:'mcu:PA1',b:'led1:A'});
  assert.equal(connectionPlan(data,nodes,'led1:A','mcu:PA1',{id:'w1',end:'a'}).reason,'duplicate');
});

test('connection planning refuses an occupied source or destination and preserves the reason',()=>{
  const data=circuit(),ports=new Set([...nodes,'bb:a12','bb:b12']);
  const issue=endpoint=>endpoint==='bb:a12'?'A12 已有跳线，可用 B12。':'';
  const blocked={ok:false,reason:'occupied',message:'A12 已有跳线，可用 B12。'};
  assert.deepEqual(connectionPlan(data,ports,'bb:a12','mcu:PA1',null,issue),blocked);
  assert.deepEqual(connectionPlan(data,ports,'mcu:PA1','bb:a12',null,issue),blocked);
  assert.equal(connectionPlan(data,ports,'mcu:PA1','bb:b12',null,issue).ok,true);
});

test('reconnection only checks the moved end and retains the original endpoint when unchanged',()=>{
  const data=circuit(),ports=new Set([...nodes,'bb:a12','bb:b12','bb:c12']);
  data.wires=[{id:'w1',a:'bb:a12',b:'mcu:PA0'},{id:'w2',a:'bb:a12',b:'mcu:PA1'},{id:'w3',a:'bb:b12',b:'led1:A'}];
  const checked=[];
  const issue=(endpoint,ignoredWireId)=>{
    checked.push([endpoint,ignoredWireId]);
    return data.wires.some(wire=>wire.id!==ignoredWireId&&[wire.a,wire.b].includes(endpoint))?'孔位已有跳线。':'';
  };
  const move={id:'w1',end:'b'};
  assert.equal(connectionPlan(data,ports,'bb:a12','mcu:PA0',move,issue).reason,'unchanged');
  assert.deepEqual(checked,[]);
  assert.equal(connectionPlan(data,ports,'bb:a12','bb:b12',move,issue).reason,'occupied');
  assert.equal(connectionPlan(data,ports,'bb:a12','bb:c12',move,issue).ok,true);
  assert.deepEqual(checked,[['bb:b12','w1'],['bb:c12','w1']]);
});

test('stale reconnection intent cannot modify a deleted or changed wire',()=>{
  const changed=circuit();changed.wires[0].b='r1:1';
  assert.equal(connectionPlan(changed,nodes,'led1:A','mcu:PA1',{id:'w1',end:'a'}).reason,'stale');
  assert.equal(connectionPlan(circuit(),nodes,'led1:A','mcu:PA1',{id:'deleted',end:'a'}).reason,'stale');
  assert.equal(connectionPlan(circuit(),nodes,'led1:A','mcu:PA1',{id:'w1',end:'c'}).reason,'stale');
});

test('dropping outside a real endpoint returns a recoverable failure',()=>{
  for(const endpoint of [undefined,'','bb:missing']){
    const plan=connectionPlan(circuit(),nodes,'r1:1',endpoint);assert.equal(plan.ok,false);assert.equal(plan.reason,'missing');
  }
});

test('connection decisions do not mutate the shared circuit or a reconnection request',()=>{
  const data=circuit(),before=JSON.stringify(data),request=Object.freeze({id:'w1',end:'a'});
  data.wires.forEach(Object.freeze);Object.freeze(data.wires);Object.freeze(data);
  const gesture=wireGestureState('mcu:PA1','led1:A',request);
  assert.equal(connectionPlan(data,nodes,gesture.start,'mcu:PA1',gesture.reconnect).ok,true);
  assert.equal(JSON.stringify(data),before);
});

test('selection retains its component/wire meaning after undo and clears removed ids',()=>{
  const before=circuit(),after=structuredClone(before);after.components[0].x=7;
  assert.deepEqual(selectionDescriptor(before,'led1'),selectionDescriptor(after,'led1'));
  assert.deepEqual(selectionDescriptor(after,'w1'),{kind:'wire',id:'w1'});
  after.wires=after.wires.filter(w=>w.id!=='w1');assert.equal(selectionDescriptor(after,'w1'),null);
  assert.deepEqual(selectionDescriptor(after,'mcu'),{kind:'component',id:'mcu'});
  assert.equal(selectionDescriptor(null,'mcu'),null);
});

test('button cap, base dragging and explicit move mode have separate intentions',()=>{
  const cap={kind:'button',id:'button1'},base={kind:'component',id:'button1'};
  assert.equal(pointerIntent(cap),'press');assert.equal(pointerIntent(base),'drag');
  assert.equal(pointerIntent(cap,{mode:'move'}),'drag');assert.equal(pointerIntent(cap,{altKey:true}),'drag');
  assert.equal(pointerIntent(cap,{mode:'wire'}),'select');assert.equal(pointerIntent(cap,{spacePan:true}),'pan');
});

test('board reset requires an intentional stationary press in observe mode',()=>{
  const reset={kind:'board-reset',id:'mcu'};
  assert.equal(pointerIntent(reset),'board-reset');
  for(const options of [{mode:'move'},{mode:'wire'},{mode:'pan'},{altKey:true},{spacePan:true},
    {pendingPin:'mcu:GPIO23'},{reconnecting:true}]) {
    assert.notEqual(pointerIntent(reset,options),'board-reset');
  }
  const press={pointerId:9,x:14,y:26};
  assert.equal(boardResetTap(press,{pointerId:9,clientX:16,clientY:27}),true);
  assert.equal(boardResetTap(press,{pointerId:2,clientX:14,clientY:26}),false);
  assert.equal(boardResetTap(press,{pointerId:9,clientX:17,clientY:30}),false);
  assert.equal(boardResetTap({...press,resetCancelled:true},{pointerId:9,clientX:14,clientY:26}),false);
});

test('contacts move their owner until wiring is intentionally armed',()=>{
  assert.equal(pointerIntent({kind:'component',id:'mcu'}),'pan');
  assert.equal(pointerIntent({kind:'component',id:'mcu'},{mode:'move'}),'drag');
  assert.equal(pointerIntent({kind:'component',id:'breadboard'},{mode:'move'}),'drag');
  const boardPin={kind:'pin',id:'mcu',endpoint:'mcu:PA0'},loosePin={kind:'pin',id:'led1',endpoint:'led1:A'};
  assert.equal(pointerIntent(boardPin),'pan');
  assert.equal(pointerIntent(boardPin,{mode:'move'}),'drag');
  assert.equal(pointerIntent({kind:'pin',id:'breadboard',endpoint:'bb:A1'},{mode:'move'}),'drag');
  assert.equal(pointerIntent(loosePin),'drag');
  assert.equal(pointerIntent(loosePin,{mode:'wire'}),'wire');
  assert.equal(pointerIntent(loosePin,{pendingPin:'mcu:PA0'}),'connect');
  assert.equal(pointerIntent(loosePin,{pendingPin:'mcu:PA0',reconnecting:true}),'wire');
  assert.equal(pointerIntent({kind:'wire-handle',id:'w1'}),'reconnect');
  assert.equal(pointerIntent(null),'pan');
});

test('double-click or double-tap must target the same pin, location, and pointer type',()=>{
  const first={endpoint:'led1:A',pointerType:'mouse',time:100,x:80,y:120};
  const second={...first,time:300,x:84,y:122};
  assert.equal(isSecondPinTap(first,second),true);
  assert.equal(isSecondPinTap(null,second),false);
  for(const change of [{endpoint:'led1:K'},{time:701},{x:100},{pointerType:'touch'}]){
    assert.equal(isSecondPinTap(first,{...second,...change}),false);
  }
  assert.equal(isSecondPinTap({...first,pointerType:'touch'},{...second,pointerType:'touch'}),true);
});

test('an enabled board drop starts a drag without overriding wiring or camera gestures',()=>{
  const board={kind:'component',id:'mcu'},pin={kind:'pin',id:'mcu',endpoint:'mcu:PA0'};
  const allow={allowBoardDrag:true};
  assert.equal(pointerIntent(board,allow),'drag');
  assert.equal(pointerIntent(pin,allow),'drag');
  assert.equal(pointerIntent(pin,{...allow,mode:'wire'}),'wire');
  assert.equal(pointerIntent(pin,{...allow,pendingPin:'led1:A'}),'connect');
  assert.equal(pointerIntent(board,{...allow,spacePan:true}),'pan');
  assert.equal(pointerIntent(board,{...allow,button:1}),'pan');
  assert.equal(pointerIntent({kind:'component',id:'breadboard'},allow),'pan');
});

test('keyboard pin navigation prefers the neighbouring row and skips hidden contacts',()=>{
  const points=[{id:'a',x:0,y:0},{id:'right',x:14,y:0},{id:'far',x:28,y:0},{id:'up',x:0,y:-14},{id:'diag',x:5,y:14},{id:'hidden',x:4,y:0,hidden:true}];
  assert.equal(directionalEndpoint(points,'a',[1,0]),'right');
  assert.equal(directionalEndpoint(points,'a',[0,-1]),'up');
  assert.equal(directionalEndpoint(points,'a',[-1,0]),null);
  assert.equal(directionalEndpoint(points,'missing',[1,0]),null);
});

test('fit bounds contain a rotated tall custom module and every exposed contact',()=>{
  const part={id:'wide1',type:'custom',x:15,z:7,rotation:90,pins:Array.from({length:40},(_,i)=>'P'+i)};
  const bounds=componentBounds(part),angle=-Math.PI/2;
  assert.ok(bounds.right-bounds.left>5,'the old fixed 2.6 cm box clipped this module');
  for(const pin of componentPins(part)){
    const x=part.x+pin.x*Math.cos(angle)-pin.z*Math.sin(angle),z=part.z+pin.x*Math.sin(angle)+pin.z*Math.cos(angle);
    assert.ok(x>=bounds.left&&x<=bounds.right&&z>=bounds.top&&z<=bounds.bottom,pin.id);
  }
  const data=circuit();data.components.push(part);const fit=visualBounds(data,getBoardProfile('bluepill'));
  assert.ok(fit.left<=bounds.left&&fit.right>=bounds.right&&fit.top<=bounds.top&&fit.bottom>=bounds.bottom);
});
