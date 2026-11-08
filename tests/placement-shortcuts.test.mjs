import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {boardHoleKeyAction,directionalEndpoint,sceneRotationStep} from '../dist/model-renderer.js';

function rendererFunction(file,name){
  const content=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
  const handler=content.match(new RegExp(`^  function ${name}\\([^\\n]*\\n[\\s\\S]*?^  }`,'m'))?.[0];
  assert.ok(handler,`Missing ${name} in ${file}`);
  return handler;
}

const files={'3D':['workbench.js','keyDown'],'2D':['workbench2d.js','onKey']};
function fixture(view,overrides={}){
  const [file,name]=files[view];
  const ownerDocument={};
  const surface={ownerDocument,focus(){ownerDocument.activeElement=this;},toggleAttribute(){}};
  const pin={ownerDocument};
  const board={locked:false};
  surface.focus();
  const rotations=[],hovered=[],chosen=[],holes=['bb:c6','bb:c7','bb:c8'];
  let setPicker;
  const scope={
    svg:surface,renderer:{domElement:surface},boardHoleKeyAction,sceneRotationStep,directionalEndpoint,
    hooks:{
      onRotateBoard:step=>rotations.push(step),
      onBoardHoleHover:(endpoint,{keyboard}={})=>{
        hovered.push([endpoint,keyboard]);
        if(keyboard&&scope.boardHolePicker?.selectedHole!==endpoint){
          setPicker({...scope.boardHolePicker,selectedHole:null});
        }
      },
      onBoardHoleChoose:endpoint=>{
        chosen.push(endpoint);
        setPicker({...scope.boardHolePicker,selectedHole:endpoint});
      },
    },
    circuit:{board,wires:[]},
    selected:'mcu',selectedId:'mcu',movablePart:()=>board,getPart:()=>board,
    getHit:target=>target===pin?{kind:'pin',endpoint:'mcu:PA0'}:null,
    inspection:false,keyboardPin:null,insertedParts:new Set(),
    mode:'orbit',cameraMode:'edit',pendingPin:null,reconnectPending:null,wireGesture:null,
    drag:null,down:null,pan:null,pinch:null,touchCamera:null,activeButton:null,spacePan:false,
    boardHolePicker:null,boardHoleHover:null,boardHoleKeyboard:null,
    endpointMap:new Map(holes.map((id,x)=>[id,{x,y:2}])),
    endpoints:new Map(holes.map((id,x)=>[id,{position:{clone:()=>({project:()=>({x,y:-2})})}}])),
    renderBoardHolePicker(){},refreshConnectionState(){},refreshConnectionStatus(){},
    camera:{},cancelInteraction(){},announce(){},keyboardTarget:null,
    ...overrides
  };
  setPicker=runInNewContext(rendererFunction(file,'setBoardHolePicker')+'\nsetBoardHolePicker',scope);
  scope.hoverBoardHole=runInNewContext(rendererFunction(file,'hoverBoardHole')+'\nhoverBoardHole',scope);
  scope.keyBoardHolePicker=runInNewContext(rendererFunction(file,'keyBoardHolePicker')+'\nkeyBoardHolePicker',scope);
  const handler=runInNewContext(rendererFunction(file,name)+'\n'+name,scope);
  const key=(properties={})=>{
    const event={target:surface,key:'r',code:'KeyR',defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...properties};
    handler(event);
    return event;
  };
  return {ownerDocument,surface,pin,board,key,rotations,hovered,chosen,holes,setPicker,hover:scope.hoverBoardHole};
}

for(const view of ['3D','2D']){
  test(`${view} board rotates once per focused canvas R or Shift+R`,()=>{
    for(const mode of ['orbit','move']){
      const {key,rotations}=fixture(view,{mode});
      assert.equal(key().defaultPrevented,true);
      assert.equal(key({key:'R',shiftKey:true}).defaultPrevented,true);
      assert.deepEqual(rotations,[90,-90]);
    }
  });

  test(`${view} board ignores repeats, system keys, IME, and other focus targets`,()=>{
    const {key,rotations,ownerDocument,surface,pin}=fixture(view);
    const toolbar={ownerDocument},editor={ownerDocument,isContentEditable:true};
    for(const properties of [
      {ctrlKey:true},{metaKey:true,shiftKey:true,key:'R'},{altKey:true},
      {repeat:true},{isComposing:true},{keyCode:229},{key:'t',code:'KeyR'},
      {getModifierState:key=>key==='AltGraph'},
      {target:pin},{target:toolbar},{target:editor},
      {target:surface,composedPath:()=>[pin,surface]}
    ]) assert.equal(key(properties).defaultPrevented,false);
    ownerDocument.activeElement=editor;
    assert.equal(key().defaultPrevented,false);
    assert.deepEqual(rotations,[]);
  });

  test(`${view} idle board rotation is suspended during wiring, placement, probing or a nonrotatable drag`,()=>{
    for(const overrides of [
      {mode:'wire'},{mode:'pan'},{pendingPin:'mcu:PA0'},{wireGesture:{}},{drag:{id:'breadboard'}},
      {hooks:{isPartPlacing:()=>true,onRotateBoard:()=>assert.fail('placement')}},
      {hooks:{isProbePicking:()=>true,onRotateBoard:()=>assert.fail('probe')}}
    ]){
      const {key,rotations}=fixture(view,overrides);
      assert.equal(key().defaultPrevented,false);
      assert.deepEqual(rotations,[]);
    }
    const {key,rotations,board}=fixture(view);
    board.locked=true;
    assert.equal(key().defaultPrevented,false);
    assert.deepEqual(rotations,[]);
  });

  test(`${view} R rotates the board being dragged through the preview path`,()=>{
    const preview=[];
    const pointer={clientX:120,clientY:90};
    const drag={id:'mcu',pointer,origin:{rotation:90}};
    const {key,rotations,board}=fixture(view,{
      drag,
      rotateDrag:step=>preview.push(step),
      updateDragPreview:(event,force)=>{
        assert.equal(event,pointer);
        assert.equal(force,true);
        preview.push(drag.rotation);
      },
    });
    assert.equal(key({repeat:true}).defaultPrevented,false);
    assert.equal(key({ctrlKey:true}).defaultPrevented,false);
    assert.equal(key().defaultPrevented,true);
    assert.equal(key({key:'R',shiftKey:true}).defaultPrevented,true);
    assert.deepEqual(preview,view==='3D'?[90,-90]:[180,90]);
    assert.deepEqual(rotations,[]);
    board.locked=true;
    assert.equal(key().defaultPrevented,false);
  });

  test(`${view} armed hole picker previews with arrows and only stages with Enter`,()=>{
    const {key,rotations,hovered,chosen,pin}=fixture(view,{boardHolePicker:{holes:['bb:c6','bb:c7']}});
    key({key:'ArrowRight'});
    key({key:'ArrowRight'});
    assert.deepEqual(hovered,[['bb:c6',true],['bb:c7',true]]);
    assert.deepEqual(chosen,[]);
    key({key:'Enter'});
    key({key:'Enter',repeat:true});
    assert.deepEqual(chosen,['bb:c7']);
    key({target:pin});key({ctrlKey:true});key({repeat:true});key({isComposing:true});
    assert.deepEqual(rotations,[]);
    key();key({key:'R',shiftKey:true});
    assert.deepEqual(rotations,[90,-90]);
  });

  test(`${view} seated picker starts from its current hole, never a stale pointer hover`,()=>{
    const {key,hovered,chosen,holes,setPicker,hover}=fixture(view);
    setPicker({holes,startHole:'bb:c7'});
    hover('bb:c6');
    key({key:'ArrowRight'});
    hover(null);
    assert.deepEqual(hovered,[['bb:c6',undefined],['bb:c8',true]]);
    assert.deepEqual(chosen,[]);
    key({key:'Enter'});
    assert.deepEqual(chosen,['bb:c8']);
    setPicker(null);
    setPicker({holes,startHole:'bb:c7'});
    hover('bb:c8');
    key({key:'Enter'});
    key({key:'Enter'});
    assert.deepEqual(hovered.at(-1),['bb:c7',true]);
    assert.deepEqual(chosen,['bb:c8']);
  });

  test(`${view} picker arrows follow the chosen hole after a mouse or touch selection`,()=>{
    const {key,hovered,chosen,holes,setPicker,hover}=fixture(view);
    setPicker({holes,startHole:'bb:c6'});
    key({key:'ArrowRight'});
    setPicker({holes,startHole:'bb:c6',selectedHole:'bb:c8'});
    hover('bb:c6');
    key({key:'ArrowLeft'});
    assert.deepEqual(hovered,[['bb:c7',true],['bb:c7',true]]);
    assert.deepEqual(chosen,[]);
    key({key:'Enter'});
    assert.deepEqual(chosen,['bb:c7']);
  });

  test(`${view} picker lets modified and IME keys pass through`,()=>{
    const {key,hovered,chosen,holes,setPicker}=fixture(view);
    setPicker({holes,startHole:'bb:c7'});
    for(const properties of [
      {key:'ArrowLeft',altKey:true},
      {key:'ArrowRight',shiftKey:true},
      {key:'Enter',getModifierState:modifier=>modifier==='AltGraph'},
      {key:'Enter',ctrlKey:true},
      {key:'Enter',metaKey:true},
      {key:'Enter',isComposing:true},
      {key:'Escape',shiftKey:true},
      {key:'Escape',keyCode:229},
    ]) assert.equal(key(properties).defaultPrevented,false);
    assert.deepEqual(hovered,[]);
    assert.deepEqual(chosen,[]);
  });
}

test('3D stays in keyboard pin navigation until the selected board regains context',()=>{
  const {key,rotations}=fixture('3D',{keyboardPin:'mcu:PA0'});
  assert.equal(key().defaultPrevented,false);
  assert.deepEqual(rotations,[]);
});

test('2D keyboard selection restores the canvas for the board and retains specific pin focus',()=>{
  const selected={id:'mcu',kind:'component'};
  const focus=[];
  const restore=runInNewContext(rendererFunction('workbench2d.js','restoreKeyboardFocus')+'\nrestoreKeyboardFocus',{
    keyboardTarget:selected,selected:'mcu',
    svg:{focus:()=>focus.push('canvas')},
    focusEndpoint:id=>focus.push(id),
    partGroups:new Map([['led1',{focus:()=>focus.push('led1')}]]),
  });
  restore();
  selected.id='led1';
  restore();
  selected.kind='pin';
  selected.endpoint='mcu:PA0';
  restore();
  assert.deepEqual(focus,['canvas','led1','mcu:PA0']);
});
