import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {BOARD_PROFILE_LIST,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {boardMountRows,boardPose,getMountOptions,rotateBoardPoint} from '../dist/breadboard-mount.js';
import {createCircuit,makePart} from '../dist/circuit.js';
import {boardMountFromStartHole,boardMountStartHoles,breadboardMoveObstacle,evaluateMountPlacement,nearestBoardMount,nearestBreadboardMount} from '../dist/mount-placement.js';
import {mountPlacementSuggestion} from '../dist/mount-placement-dialog.js';
import {boardVisual,componentBounds} from '../dist/model-renderer.js';
import {mountedPartBodyBounds,partPose} from '../dist/part-mount.js';

function appPlacementFixture(circuit){
  const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const names=['matchesLessonMount','overlaps','breadboardBounds','boardRestBounds','isBoardTabletopPosition','boardRestIssue','findClearScenePosition','findClearPartPosition','mountCandidates',
    'mountRotation','findBoardDrop','previewBoardDrop','clearBoardDropPreview','moveSceneItem','dropBoard','planBoardMountRelocations','applyBoardMount',
    'requestBoardMount','needsBoardMountReview','stepSeatedBoard','confirmBoardPlacement','reviewObstructedBoardPlacement','openBoardPlacement','scenePartBounds','detachedBoardPosition',
    'flipBoardInPlace','rotateBoard','detachBoard','clearBoardHolePicker','evaluateBoardHole',
    'renderBoardHolePicker','hoverBoardHole','chooseBoardHole','confirmPickedBoardHole'];
  const functions=names.map(name=>{
    const source=app.match(new RegExp(`^function ${name}\\([\\s\\S]*?^}`, 'm'))?.[0];
    assert.ok(source,`missing app function ${name}`);
    return source;
  }).join('\n');
  const dialogs=[],messages=[],undo=[],selections=[],nodes=new Map(),pickers=[];
  const profile=getBoardProfile(circuit.boardId);
  return runInNewContext(`${functions}\n({requestBoardMount,previewBoardDrop,moveSceneItem,dropBoard,rotateBoard,stepSeatedBoard,dialogs,messages,undo,selections,pickers,
    action:id=>$('#'+id).onclick(),
    control:id=>$('#'+id),
    armPicker:()=>{boardHolePicker={holes:boardMountStartHoles(board()),rotation:circuit.board.mount?.rotation??90,endpoint:null,hover:null};renderBoardHolePicker();},
    clearBoardHolePicker,hoverBoardHole,chooseBoardHole,confirmPickedBoardHole});`,{
    circuit,example:{},dialogs,messages,undo,selections,pickers,selectedWire:null,boardHolePicker:null,
    $:selector=>{
      if(!nodes.has(selector))nodes.set(selector,{dataset:{},close(){this.closed=true;}});
      return nodes.get(selector);
    },
    board:()=>profile,
    boardMountRows,boardPose,boardVisual,componentBounds,getMountOptions,evaluateMountPlacement,breadboardMoveObstacle,rotateBoardPoint,
    nearestBoardMount,nearestBreadboardMount,boardMountFromStartHole,boardMountStartHoles,
    mountedPartBodyBounds,partPose,
    sim:{reset(){}},workbench:{home(){},setCircuit(){},setBoardHolePicker(value){pickers.push(value);}},
    renderSceneObjects(){},focusSceneCanvas(){},syncSceneSelection(){},refresh(){},save(){},
    modal:(title,html)=>dialogs.push({title,html}),mountRestIssue:'面包板旁没有空位放下挡件。',
    toast:message=>messages.push(message),
    pushUndo:()=>undo.push(structuredClone(circuit)),
    finishSceneEdit(){},
    selectScenePart:id=>selections.push(id),
    showMountPlacementDialog:configuration=>dialogs.push(configuration),
  });
}

test('a board hole hover only previews, choosing a hole stages it, and confirmation applies once',()=>{
  const circuit=createCircuit('blink');
  circuit.board.mount={column:6,rotation:90};
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  app.armPicker();
  app.hoverBoardHole('bb:c9');
  assert.equal(app.pickers.at(-1).preview.mount.column,9);
  assert.equal(app.control('boardHoleConfirm').disabled,true);
  app.chooseBoardHole('bb:c6');
  assert.equal(app.control('boardHoleConfirm').disabled,true);
  app.chooseBoardHole('bb:p9');
  assert.equal(app.pickers.at(-1).preview.mount.column,6);
  app.chooseBoardHole('bb:g9');
  app.hoverBoardHole('bb:d10');
  assert.equal(app.pickers.at(-1).preview.anchorHole,'bb:g9');
  assert.equal(app.control('boardHoleConfirm').disabled,false);
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,0);
  assert.equal(app.confirmPickedBoardHole(),true);
  assert.equal(circuit.board.mount.column,9);
  assert.deepEqual(circuit.wires,before.wires);
  assert.deepEqual(app.undo,[before]);
  assert.equal(app.pickers.at(-1),null);
});

test('new starter circuits leave their signal deck open for a direct board drop',()=>{
  const bluePillPresets=['blink','traffic','button','adc','pwm','buzzer','servo'];
  const bluePill=getBoardProfile('bluepill');
  const starters=bluePillPresets.map(preset=>[bluePill,createCircuit(preset),preset]);
  for(const profile of BOARD_PROFILE_LIST){
    if(profile===bluePill||!getMountOptions(profile))continue;
    for(const kind of ['blink','button','adc','pwm'])starters.push([profile,makeBoardStarter(profile.id,kind).circuit,kind]);
  }
  for(const [profile,circuit,kind] of starters){
    const hit=nearestBoardMount(circuit,profile,{...circuit.breadboard,pointer:circuit.breadboard},{moveWires:true,nearby:true});
    assert.ok(hit?.candidate,`${profile.id}/${kind}`);
    assert.deepEqual(hit.candidate.blockers,[],`${profile.id}/${kind}`);
    assert.equal(hit.candidate.connectedNets,0,`${profile.id}/${kind}`);
  }
  for(const id of ['bluepill','esp32-devkitc']){
    const profile=getBoardProfile(id);
    for(const method of ['button','drop']){
      const circuit=createCircuit('blink',id),app=appPlacementFixture(circuit),before=structuredClone(circuit);
      if(method==='button')app.requestBoardMount();
      else{
        const {x,z}=circuit.breadboard;
        const hit=nearestBoardMount(circuit,profile,{x,z,pointer:{x,z}},{moveWires:true,nearby:true});
        app.dropBoard(x,z,hit.mount,{x,z},'mcu',hit);
      }
      assert.equal(app.dialogs.length,0,id);
      assert.ok(boardPose(circuit,profile).mounted,id);
      assert.deepEqual(circuit.components,before.components,id);
      assert.deepEqual(circuit.wires,before.wires,id);
      assert.deepEqual(app.undo,[before],id);
    }
  }
});

test('old saved loose parts move only after confirmation and keep their wires',()=>{
  const circuit=createCircuit('blink');
  for(const part of circuit.components)part.z=0;
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  app.requestBoardMount();
  const [dialog]=app.dialogs;
  assert.match(dialog.message,/跳线会保留/);
  assert.deepEqual(circuit,before);
  const {candidate}=dialog.evaluate(dialog.initial,false);
  assert.deepEqual(candidate.blockers.map(part=>part.id),['led1','r1']);
  assert.equal(dialog.onApply(candidate),true);
  assert.ok(circuit.board.mount);
  assert.ok(circuit.components.every(part=>part.z!==0));
  assert.deepEqual(circuit.wires,before.wires);
  assert.deepEqual(app.undo,[before]);
});

test('a blocked populated breadboard offers clearance preview before any unplugging',()=>{
  const circuit=createCircuit('plugged-led'),app=appPlacementFixture(circuit),before=structuredClone(circuit);
  app.requestBoardMount();
  const [dialog]=app.dialogs;
  const safe=dialog.recommend(false),clearance=dialog.recommend(true);
  assert.equal(safe,undefined);
  assert.ok(clearance);
  assert.equal(dialog.evaluate(dialog.initial,false).candidate,null);
  const suggestion=mountPlacementSuggestion(safe,clearance,false);
  assert.equal(suggestion.enableClearance,true);
  const {candidate}=dialog.evaluate(suggestion.slot,suggestion.enableClearance);
  assert.ok(candidate.unpluggedParts.length);
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,0);
  assert.equal(dialog.onApply(candidate),true);
  for(const part of candidate.unpluggedParts)assert.equal(part.mount,undefined);
  assert.deepEqual(app.undo,[before]);
});

test('a dense bench does not offer an insertion when it cannot park displaced parts',()=>{
  const circuit=createCircuit('blink');
  for(const part of circuit.components)part.z=0;
  for(const dz of [4,-4,7,-7])for(const dx of [0,2.8,-2.8,5.6,-5.6,8.4,-8.4]){
    circuit.components.push(makePart('resistor',`park-${dx}-${dz}`,circuit.breadboard.x+dx,circuit.breadboard.z+dz));
  }
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  app.requestBoardMount();
  const [dialog]=app.dialogs;
  assert.equal(dialog.recommend(false),undefined);
  assert.equal(dialog.recommend(true),undefined);
  const blocked=dialog.evaluate(dialog.initial,true);
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/没有空位/);
  assert.deepEqual(circuit,before);
});

test('an edge-only drop keeps the loose move and gives guidance without opening a dialog',()=>{
  const circuit=createCircuit('blink'),app=appPlacementFixture(circuit);
  app.dropBoard(2,3,null,{x:2,z:3},'mcu',{edgeOnly:true,reason:'拖到信号孔区。'});
  assert.equal(circuit.board.mount,undefined);
  assert.equal(circuit.board.x,2);
  assert.equal(circuit.board.z,3);
  assert.equal(app.dialogs.length,0);
  assert.deepEqual(app.messages,['拖到信号孔区。']);
});

function mountedPoseAt(circuit,mount){
  return boardPose({...circuit,board:{...circuit.board,mount}},getBoardProfile(circuit.boardId));
}

function previewAt(app,pose,rotation){
  return app.previewBoardDrop(pose.x,pose.z,{x:pose.x,z:pose.z},'mcu',rotation);
}

function dropAt(app,pose,preview,rotation){
  return app.dropBoard(pose.x,pose.z,preview?.mount,{x:pose.x,z:pose.z},'mcu',preview,rotation);
}

test('dragging a loose component commits its move and angle in one undo step',()=>{
  const circuit=createCircuit('blink');
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  assert.equal(app.moveSceneItem('led1',6,8,270),true);
  const led=circuit.components.find(part=>part.id==='led1');
  assert.deepEqual({x:led.x,z:led.z,rotation:led.rotation},{x:6,z:8,rotation:270});
  assert.deepEqual(circuit.wires,before.wires);
  assert.deepEqual(app.undo,[before]);
  assert.equal(app.moveSceneItem('led1',6,8,270),undefined);
  assert.equal(app.undo.length,1);
});

test('an explicit 90 degree turn can leave a seated board only at a clear tabletop position',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={column:6,rotation:90};
  circuit.components.push(makePart('resistor','loose-obstacle',11,6));
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  const original=mountedPoseAt(circuit,circuit.board.mount);
  for(const blocked of [original,{x:11,z:6}]){
    const preview=previewAt(app,blocked,180);
    assert.equal(preview.edgeOnly,true);
    assert.equal(dropAt(app,blocked,preview,180),false);
    assert.deepEqual(circuit,before);
  }
  const tabletop={x:11,z:-6},preview=previewAt(app,tabletop,180);
  assert.equal(preview.rest,true);
  assert.deepEqual(circuit,before);
  assert.equal(dropAt(app,tabletop,preview,180),true);
  assert.deepEqual({x:circuit.board.x,z:circuit.board.z,rotation:circuit.board.rotation,mount:circuit.board.mount},
    {...tabletop,rotation:180,mount:undefined});
  assert.deepEqual(circuit.wires,before.wires);
  assert.deepEqual(app.undo,[before]);
});

test('dragging a seated board directly to the tabletop detaches it at its mounted angle',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.rotation=0;
  circuit.board.mount={column:6,rotation:270};
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  const tabletop={x:11,z:-6};
  const preview=previewAt(app,tabletop);
  assert.equal(preview.rest,true);
  assert.match(app.control('boardDropCue').textContent,/松手拔下开发板/);
  assert.deepEqual(circuit,before);
  assert.deepEqual(app.undo,[]);
  assert.equal(dropAt(app,tabletop,preview),true);
  const {x,z,rotation,mount}=circuit.board;
  assert.deepEqual({x,z,rotation,mount},{...tabletop,rotation:270,mount:undefined});
  assert.deepEqual(circuit.wires,before.wires);
  assert.deepEqual(app.undo,[before]);
  assert.match(app.messages.at(-1),/^开发板已拔下，/);
});

test('dragging a seated board cannot detach through blockers or outside the tabletop',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={column:6,rotation:90};
  const app=appPlacementFixture(circuit);
  const tabletop={x:11,z:-6};
  const clearPreview=previewAt(app,tabletop);
  assert.equal(clearPreview.rest,true);
  circuit.components.push(makePart('resistor','tabletop-obstacle',tabletop.x,tabletop.z));
  const before=structuredClone(circuit);
  const rim={x:circuit.breadboard.x,z:circuit.breadboard.z+2.9};
  for (const blocked of [tabletop,rim,{x:31,z:0},{x:NaN,z:0}]) {
    const preview=previewAt(app,blocked);
    assert.equal(preview.rest,undefined);
    assert.equal(dropAt(app,blocked,preview),false);
    assert.deepEqual(circuit,before);
  }
  assert.equal(dropAt(app,tabletop,clearPreview),false,'recheck clearance when the pointer is released');
  assert.deepEqual(circuit,before);
  assert.deepEqual(app.undo,[]);
});

test('a requested turn never auto-flips a loose board at the breadboard',()=>{
  const circuit=createCircuit('blink');
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  const mount={column:7,rotation:270},target=mountedPoseAt(circuit,mount);
  const blocked=previewAt(app,target,180);
  assert.equal(blocked.edgeOnly,true);
  assert.equal(dropAt(app,target,blocked,180),false);
  assert.deepEqual(circuit,before);
  const aligned=previewAt(app,target,270);
  assert.deepEqual(aligned.candidate.mount,mount);
  dropAt(app,target,aligned,270);
  assert.deepEqual(circuit.board.mount,mount);
  assert.deepEqual(app.undo,[before]);
});

test('a half turn of a seated board reviews the exact new contacts before applying',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={column:6,rotation:90};
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  const mount={column:6,rotation:270},target=mountedPoseAt(circuit,mount);
  const preview=previewAt(app,target,270);
  assert.deepEqual(preview.candidate.mount,mount);
  assert.ok(preview.candidate.changedNets>0);
  dropAt(app,target,preview,270);
  assert.deepEqual(circuit,before);
  assert.deepEqual(app.undo,[]);
  const [dialog]=app.dialogs;
  assert.equal(dialog.onApply(dialog.evaluate(dialog.initial,false).candidate),true);
  assert.deepEqual(circuit.board.mount,mount);
  assert.deepEqual(app.undo,[before]);
});

test('seated board drop keeps orientation and only moves to the exact targeted holes',()=>{
  const circuit=createCircuit('blink');
  circuit.board.rotation=0;
  circuit.board.mount={column:6,rotation:270};
  const app=appPlacementFixture(circuit),before=structuredClone(circuit);
  const original=mountedPoseAt(circuit,circuit.board.mount);
  const same=previewAt(app,original);
  assert.equal(same.unchanged,true);
  assert.equal(dropAt(app,original,same),false);
  const outside={x:31,z:original.z};
  assert.equal(dropAt(app,outside,previewAt(app,outside)),false);
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,0);
  assert.equal(app.dialogs.length,0);
  assert.match(app.messages.at(-1),/原插位/);

  const mount={column:8,rotation:270,rows:['d','h']};
  const target=mountedPoseAt(circuit,mount),hit=previewAt(app,target);
  assert.deepEqual(hit.candidate.mount,mount);
  assert.equal(dropAt(app,target,hit),true);
  assert.deepEqual(circuit.board.mount,mount);
  assert.deepEqual(circuit.breadboard,before.breadboard);
  assert.deepEqual(app.undo,[before]);
  assert.deepEqual(app.selections,['mcu']);
});

test('a seated PCB remains at the original holes when the exact drop is obstructed',()=>{
  const circuit=createCircuit('blink');
  circuit.board.mount={column:1,rotation:90};
  circuit.components.push({...makePart('led','blocked-socket'),locked:true,mount:{hole:'bb:e29',rotation:0}});
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  const mount={column:11,rotation:90},target=mountedPoseAt(circuit,mount);
  const preview=previewAt(app,target);
  assert.equal(preview.candidate,null);
  assert.match(preview.reason,/锁定/);
  assert.equal(dropAt(app,target,preview),false);
  assert.deepEqual(circuit,before);
  assert.deepEqual(app.undo,[]);
  assert.deepEqual(app.dialogs,[]);
  assert.match(app.messages.at(-1),/锁定.*原插位.*换孔位/);
});

test('moving a seated board to different live nets waits for confirmation',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={column:6,rotation:90};
  const before=structuredClone(circuit),app=appPlacementFixture(circuit);
  const mount={column:7,rotation:90},target=mountedPoseAt(circuit,mount);
  const preview=previewAt(app,target);
  assert.ok(preview.candidate.changedNets>0);
  assert.equal(preview.review,true);
  dropAt(app,target,preview);
  const [dialog]=app.dialogs;
  assert.deepEqual(circuit,before);
  assert.deepEqual(app.undo,[]);
  const result=dialog.evaluate(dialog.initial,false);
  assert.equal(dialog.onApply(result.candidate),true);
  assert.deepEqual(circuit.board.mount,mount);
  assert.deepEqual(app.undo,[before]);
});

test('a recoverable blocked drag or arrow keeps its exact target for clearance review',()=>{
  for(const method of ['drag','arrow']){
    const circuit=createCircuit('board-insertion');
    circuit.board.mount={column:6,rotation:90};
    const before=structuredClone(circuit),app=appPlacementFixture(circuit);
    const mount={column:6,rotation:90,rows:['b','f']};
    if(method==='drag'){
      const target=mountedPoseAt(circuit,mount),preview=previewAt(app,target);
      assert.equal(preview.candidate,null);
      dropAt(app,target,preview);
    }else app.stepSeatedBoard(0,-1);
    const [dialog]=app.dialogs;
    assert.deepEqual(structuredClone(dialog.initial),mount);
    assert.match(dialog.message,/挡件.*腾位/);
    assert.deepEqual(circuit,before);
    assert.deepEqual(app.undo,[]);
    const blocked=dialog.evaluate(dialog.initial,false);
    assert.equal(blocked.candidate,null);
    assert.match(blocked.reason,/A21/);
    const {candidate}=dialog.evaluate(dialog.initial,true);
    assert.ok(candidate);
    assert.equal(dialog.onApply(candidate),true);
    assert.deepEqual(circuit.board.mount,mount);
    assert.deepEqual(app.undo,[before]);
  }
});

test('arrow placement walks by one physical column or row pair and stops at an edge',()=>{
  const circuit=createCircuit('blink');
  circuit.board.mount={column:1,rotation:90};
  const app=appPlacementFixture(circuit),before=structuredClone(circuit);
  assert.equal(app.stepSeatedBoard(-1,0),false);
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,0);
  assert.equal(app.stepSeatedBoard(1,0),true);
  assert.deepEqual(circuit.board.mount,{column:2,rotation:90});
  assert.equal(app.stepSeatedBoard(0,-1),true);
  assert.deepEqual(circuit.board.mount,{column:2,rotation:90,rows:['b','f']});
  assert.equal(app.stepSeatedBoard(0,-1),false);
  assert.equal(app.undo.length,2);
  assert.deepEqual(circuit.wires,before.wires);
  assert.deepEqual(circuit.breadboard,before.breadboard);
});

test('keyboard replugging uses the same electrical review as dragging',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={column:6,rotation:90};
  const app=appPlacementFixture(circuit),before=structuredClone(circuit);
  app.stepSeatedBoard(1,0);
  const [dialog]=app.dialogs;
  assert.equal(dialog.initial.column,7);
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,0);
  assert.ok(dialog.evaluate(dialog.initial,false).candidate.changedNets>0);
});

test('signed board rotation works detached and seated 90 degrees requires explicit detach',()=>{
  const circuit=createCircuit('blink'),app=appPlacementFixture(circuit);
  assert.equal(app.rotateBoard(-90),true);
  assert.equal(circuit.board.rotation,270);
  assert.equal(app.rotateBoard(90),true);
  assert.equal(circuit.board.rotation,0);
  circuit.board.mount={column:6,rotation:90};
  const before=structuredClone(circuit),undoCount=app.undo.length;
  assert.equal(app.rotateBoard(-90),false);
  assert.match(app.dialogs.at(-1).html,/拔下并旋转 90°/);
  assert.match(app.dialogs.at(-1).html,/在插孔内翻转 180°/);
  app.action('cancelBoardRotation');
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,undoCount);
  assert.equal(app.rotateBoard(90),false);
  assert.deepEqual(circuit,before);
  app.action('detachAndRotateBoard');
  assert.equal(circuit.board.mount,undefined);
  assert.equal(circuit.board.rotation,180);
  assert.deepEqual(circuit.wires,before.wires);
  assert.equal(app.undo.length,undoCount+1);
  assert.deepEqual(app.undo.at(-1),before);
});

test('seated rotation keeps its 180 degree review and refuses a locked or crowded detach',()=>{
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={column:6,rotation:90};
  const app=appPlacementFixture(circuit);
  circuit.board.locked=true;
  assert.equal(app.rotateBoard(90),false);
  assert.match(app.messages.at(-1),/锁定/);
  assert.equal(app.dialogs.length,0);
  delete circuit.board.locked;
  circuit.board.x=circuit.breadboard.x;
  for(const dz of [4,-4,7,-7])for(const dx of [0,2.8,-2.8,5.6,-5.6,8.4,-8.4]){
    circuit.components.push(makePart('resistor',`park-${dx}-${dz}`,circuit.breadboard.x+dx,circuit.breadboard.z+dz));
  }
  app.rotateBoard(90);
  assert.match(app.dialogs.at(-1).html,/id="detachAndRotateBoard" disabled/);
  const before=structuredClone(circuit);
  app.action('detachAndRotateBoard');
  assert.deepEqual(circuit,before);
  assert.equal(app.undo.length,0);
  app.action('flipSeatedBoard');
  assert.equal(app.dialogs.at(-1).initial.rotation,270);
  assert.deepEqual(circuit,before);
});
