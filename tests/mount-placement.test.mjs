import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {boardPose, getMountOptions, mountedConnections, signalPitch} from '../dist/breadboard-mount.js';
import {createCircuit, makePart} from '../dist/circuit.js';
import {boardMountFromStartHole, boardMountStartHoles, breadboardMoveObstacle, describeMountChanges, evaluateMountPlacement, nearestBoardMount, nearestBreadboardMount} from '../dist/mount-placement.js';
import {partPose} from '../dist/part-mount.js';

const profile = getBoardProfile('bluepill');
const middle = {column:6,rotation:90};
const fixture = () => ({board:{x:-5,z:0},breadboard:{x:2.4,z:.7},wires:[],components:[]});
const wire = (a,b) => ({a,b});

test('both start holes resolve to the same exact mount, including alternate rows and either orientation', () => {
  for (const id of ['bluepill','pico','nano','esp32-devkitc','xiao-samd21']) {
    const board=getBoardProfile(id),options=getMountOptions(board);
    const holes=boardMountStartHoles(board);
    assert.equal(new Set(holes).size,holes.length,id);
    assert.equal(holes.length,2*options.rowPairs.length*(options.maxColumn-options.minColumn+1),id);
    for (const rows of options.rowPairs) {
      for (const column of [options.minColumn,options.defaultColumn,options.maxColumn]) {
        for (const rotation of options.rotations) {
          const mount=rows===options.rows ? {column,rotation} : {column,rotation,rows};
          for (const row of rows) {
            const hole=`bb:${row}${column}`;
            assert.ok(holes.includes(hole),`${id} ${hole}`);
            assert.deepEqual(boardMountFromStartHole(board,hole,rotation),mount,id);
            const {candidate}=evaluateMountPlacement(fixture(),board,mount);
            assert.ok(candidate.contacts.some(contact=>contact.b===hole),`${id} ${hole}`);
          }
        }
      }
    }
  }
});

test('hole picking excludes unsupported boards, rails, invalid rows, overflow and invalid rotations', () => {
  for (const endpoint of ['bb:c12','bb:g30','bb:a6','bb:j6','bb:p6','bb:n6','bb:c06','bb:C6','mcu:PA0',null,6]) {
    assert.equal(boardMountFromStartHole(profile,endpoint,90),null,String(endpoint));
    assert.ok(!boardMountStartHoles(profile).includes(endpoint),String(endpoint));
  }
  for (const rotation of [0,180,'90',undefined]) {
    assert.equal(boardMountFromStartHole(profile,'bb:c6',rotation),null,String(rotation));
  }
  const uno=getBoardProfile('uno-r3');
  assert.deepEqual(boardMountStartHoles(uno),[]);
  assert.equal(boardMountFromStartHole(uno,'bb:c6',90),null);
});

test('an explicitly picked occupied hole never silently selects a different mount', () => {
  const circuit=fixture();
  circuit.board.mount={...middle};
  circuit.wires.push(wire('bb:d8','mcu:PA1'));
  const original=structuredClone(circuit);
  const mount=boardMountFromStartHole(profile,'bb:h8',90);
  assert.deepEqual(mount,{column:8,rotation:90,rows:['d','h']});
  const result=evaluateMountPlacement(circuit,profile,mount);
  assert.equal(result.candidate,null);
  assert.match(result.reason,/D8 孔.*跳线/);
  assert.deepEqual(circuit,original);
});

test('mount evaluation keeps exact columns and rotations at a translated breadboard origin without editing the circuit', () => {
  const circuit = fixture(), original = structuredClone(circuit);
  for (const mount of [{column:1,rotation:90},{column:11,rotation:270}]) {
    const {candidate} = evaluateMountPlacement(circuit,profile,mount);
    assert.deepEqual(candidate.mount,mount);
    assert.deepEqual(candidate.pose,boardPose({...circuit,board:{...circuit.board,mount}},profile));
    assert.equal(candidate.pose.mounted,true);
    const translated = {...circuit,breadboard:{x:4.4,z:1.7}};
    const moved = evaluateMountPlacement(translated,profile,mount).candidate.pose;
    assert.ok(Math.abs(moved.x-candidate.pose.x-2)<1e-9);
    assert.ok(Math.abs(moved.z-candidate.pose.z-1)<1e-9);
  }
  assert.deepEqual(circuit,original);
  for (const mount of [{column:0,rotation:90},{column:12,rotation:270},{column:6,rotation:180},{column:6.5,rotation:90}]) {
    assert.equal(evaluateMountPlacement(circuit,profile,mount).candidate,null);
  }
  assert.match(evaluateMountPlacement(circuit,getBoardProfile('uno-r3'),middle).reason,/跳线/);
});

test('dragging a seated board keeps the intended hole pair, including unchanged and blocked positions', () => {
  const circuit=fixture();
  circuit.board={...circuit.board,rotation:0,mount:{column:1,rotation:270}};
  const initial=boardPose(circuit,profile);
  const aim={x:initial.x+10*signalPitch,z:initial.z};
  const options={moveWires:true,nearby:true};
  assert.equal(nearestBoardMount(circuit,profile,initial,options).unchanged,true);
  assert.deepEqual(nearestBoardMount(circuit,profile,aim,options).candidate.mount,{column:11,rotation:270});
  assert.equal(nearestBoardMount(circuit,profile,{...aim,x:aim.x+.4},options).edgeOnly,true);
  circuit.components.push({...makePart('resistor','r1',aim.x+1.5,aim.z),locked:true});
  const blocked=nearestBoardMount(circuit,profile,aim,options);
  assert.equal(blocked.candidate,null);
  assert.deepEqual(blocked.mount,{column:11,rotation:270});
  assert.match(blocked.reason,/锁定/);
  assert.deepEqual(circuit.board.mount,{column:1,rotation:270});
});

test('a mounted column drag tolerates diagonal drift while deliberately aligned rows still take priority', () => {
  const circuit=createCircuit('board-insertion');
  circuit.board.mount={...middle};
  const origin=boardPose(circuit,profile),original=structuredClone(circuit);
  const options={moveWires:true,nearby:true};
  const target={x:origin.x+4*signalPitch,z:origin.z+.14,rotation:270};
  const along=nearestBoardMount(circuit,profile,target,options);
  assert.deepEqual(along.candidate.mount,{column:10,rotation:90});
  assert.ok(along.candidate.changedNets>0);

  for (const offset of [.18, .23, signalPitch, .28, .30, .36]) {
    const across=nearestBoardMount(circuit,profile,{...target,z:origin.z+offset},options);
    assert.deepEqual(across.candidate.mount,{column:10,rotation:90,rows:['d','h']});
  }

  const blocked=nearestBoardMount(circuit,profile,{...target,z:origin.z+2*signalPitch},options);
  assert.equal(blocked.candidate,null);
  assert.deepEqual(blocked.mount,{column:10,rotation:90,rows:['e','i']});
  assert.match(blocked.reason,/J24.*跳线/);
  assert.deepEqual(circuit,original);
});

test('a seated drag accepts practical axis tolerance while a distant release leaves the board seated', () => {
  const circuit=fixture();
  circuit.board.mount={...middle,rotation:270};
  const proposed={column:11,rotation:270,rows:['e','i']};
  const target=boardPose({...circuit,board:{...circuit.board,mount:proposed}},profile);
  const near={x:target.x+.31,z:target.z+.4,rotation:0};
  assert.deepEqual(nearestBoardMount(circuit,profile,near).candidate.mount,proposed);
  assert.equal(nearestBoardMount(circuit,profile,{...near,x:target.x+.4}).edgeOnly,true);
  assert.equal(nearestBoardMount(circuit,profile,{...near,z:target.z+.8}).edgeOnly,true);
  assert.equal(nearestBoardMount(circuit,profile,{...near,x:target.x+12}),null);
  assert.deepEqual(circuit.board.mount,{column:6,rotation:270});
});

test('drag snapping uses actual placement centers and pin holes on supported boards', () => {
  for (const id of ['bluepill','nano','pico','xiao-samd21','teensy40','esp32-devkitc','esp32-c3-devkitm']) {
    const board = getBoardProfile(id), options = getMountOptions(board);
    const circuit = createCircuit('blink',id);
    circuit.breadboard = {x:6.37,z:-4.23};
    const original = structuredClone(circuit);
    for (const [rotation,alignedRotation] of [[0,90],[45,90],[90,90],[135,90],[180,270],[225,270],[-90,270],[315,270]]) {
      for (const column of [options.minColumn,options.defaultColumn,options.maxColumn]) {
        const mount = {column,rotation:alignedRotation};
        const preview = {...circuit,board:{...circuit.board,mount}};
        const pose = boardPose(preview,board);
        const {candidate} = nearestBoardMount(circuit,board,{x:pose.x+signalPitch/3,z:pose.z+.08,rotation});
        assert.deepEqual(candidate.mount,mount,id);
        assert.deepEqual(candidate.rows,options.rows,id);
        assert.deepEqual(candidate.pose,pose,id);
        assert.deepEqual(candidate.contacts,mountedConnections(preview,board),id);
      }
    }
    assert.deepEqual(circuit,original);
  }
});

test('drag snapping distinguishes a blocked target, unsupported board and a free move', () => {
  const circuit = fixture();
  circuit.board.rotation = 270;
  const point = {x:circuit.breadboard.x,z:circuit.breadboard.z};
  assert.equal(nearestBoardMount(circuit,profile,point).candidate.mount.rotation,270);
  assert.match(nearestBoardMount(circuit,getBoardProfile('uno-r3'),point).reason,/跳线/);
  assert.equal(nearestBoardMount(circuit,profile,{...point,x:point.x-7}),null);
  assert.equal(nearestBoardMount(circuit,profile,{...point,z:point.z+4}),null);

  const mount = {column:2,rotation:270};
  const pose = boardPose({...circuit,board:{...circuit.board,mount}},profile);
  circuit.wires = [wire('bb:c2','mcu:PA1')];
  assert.equal(evaluateMountPlacement(circuit,profile,{column:7,rotation:270}).candidate.mount.column,7);
  const blocked = nearestBoardMount(circuit,profile,pose);
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/C2 孔.*跳线/);
});

test('plugs under the footprint block insertion, while a wire at an exposed hole is counted', () => {
  const circuit = fixture();
  circuit.wires = [wire('bb:c21','mcu:PA1')];
  const blocked = evaluateMountPlacement(circuit,profile,middle);
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/C21.*跳线/);

  circuit.wires = [wire('mcu:PA1','bb:a21')];
  const ready = evaluateMountPlacement(circuit,profile,middle);
  assert.equal(ready.candidate.connectedNets,1);
  assert.equal(ready.candidate.changedNets,0);
  assert.equal(ready.connections,1);
  assert.match(ready.warning,/接通 1 个/);

  circuit.wires = [wire('bb:n10','mcu:GND1')];
  assert.equal(evaluateMountPlacement(circuit,profile,middle).candidate.connectedNets,0);
  const wide = evaluateMountPlacement(circuit,{...profile,width:4},middle);
  assert.equal(wide.candidate,null);
  assert.match(wide.reason,/N10.*跳线/);
});

test('unlocked parts can be relocated, while locked parts block a new world-space footprint', () => {
  const circuit = fixture();
  const resistor = makePart('resistor','r1',2.4,.7);
  circuit.components = [resistor];
  const ready = evaluateMountPlacement(circuit,profile,middle);
  assert.deepEqual(ready.candidate.blockers,[resistor]);
  assert.deepEqual(ready.blockers,['电阻（r1）']);

  circuit.components = [{...resistor,x:12,z:6,locked:true}];
  assert.deepEqual(evaluateMountPlacement(circuit,profile,middle).candidate.blockers,[]);
  const translated = {...circuit,breadboard:{x:12,z:6}};
  const blocked = evaluateMountPlacement(translated,profile,middle);
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/r1.*已锁定/);
});

test('re-mount warns about changed, gained and lost wired strips and compares physical pins by canonical net', () => {
  const circuit = fixture();
  circuit.board.mount = middle;
  circuit.wires = [
    wire('bb:a6','mcu:PA1'),  // Old GND, now no contact.
    wire('bb:a21','mcu:PA2'), // Old PA0, now PA1.
    wire('bb:a26','mcu:PA3')  // Previously free, now a board contact.
  ];
  const moved = evaluateMountPlacement(circuit,profile,{column:7,rotation:90});
  assert.equal(moved.candidate.connectedNets,2);
  assert.equal(moved.candidate.changedNets,3);
  const details=describeMountChanges(moved.candidate);
  assert.deepEqual(details.slice(0,2),['A6 断开 GND','A21 从 PA0 改接 PA1']);
  assert.match(details[2],/^A26 接入 /);
  assert.match(moved.warning,/改变 3 个.*A6 断开 GND.*A21 从 PA0 改接 PA1/);
  assert.equal(moved.candidate.warning,moved.warning);

  circuit.wires = [wire('bb:a7','mcu:PA1'),wire('bb:i24','mcu:PA2'),wire('bb:j24','mcu:PA3')];
  const rotated = evaluateMountPlacement(circuit,profile,{column:6,rotation:270});
  assert.equal(rotated.candidate.connectedNets,2);
  assert.equal(rotated.candidate.changedNets,0);
  assert.equal(rotated.warning,undefined);
});

test('evaluating the current mount is a no-op even if a legacy saved wire sits underneath it', () => {
  const circuit = fixture();
  circuit.board.mount = middle;
  circuit.wires = [wire('bb:c21','mcu:PA1')];
  const result = evaluateMountPlacement(circuit,profile,{...middle});
  assert.equal(result.candidate,null);
  assert.equal(result.unchanged,true);
  assert.match(result.reason,/两排针已插好/);
  const explicitDefault={...middle,rows:getMountOptions(profile).rows};
  assert.equal(evaluateMountPlacement(circuit,profile,explicitDefault).unchanged,true);
  const alternate={...middle,rows:['e','i']};
  assert.deepEqual(evaluateMountPlacement(circuit,profile,alternate).candidate.mount,alternate);
});

test('a development board cannot displace an inserted part, even if its loose position is far away', () => {
  const circuit=fixture();
  circuit.components=[{...makePart('led','led1',-10,-10),mount:{hole:'bb:a1',rotation:0}}];
  const result=evaluateMountPlacement(circuit,profile,{column:1,rotation:90});
  assert.equal(result.candidate,null);
  assert.match(result.reason,/led1.*已插入/);
  assert.ok(evaluateMountPlacement(circuit,profile,middle).candidate);
});

test('a locked resistor clears a nearby PCB when only its padded visual bounds overlap', () => {
  const circuit = fixture(), {x,z} = circuit.breadboard;
  const resistor = {...makePart('resistor','edge-resistor',x,z+1.28),locked:true};
  circuit.components = [resistor];
  assert.deepEqual(evaluateMountPlacement(circuit,profile,middle).candidate.blockers,[]);

  resistor.rotation=90;
  const turned = evaluateMountPlacement(circuit,profile,middle);
  assert.equal(turned.candidate,null);
  assert.match(turned.reason,/edge-resistor.*已锁定/);

  resistor.rotation=0;
  resistor.z=z+1.13;
  const nearer = evaluateMountPlacement(circuit,profile,middle);
  assert.equal(nearer.candidate,null);
  assert.match(nearer.reason,/edge-resistor.*已锁定/);
});

test('drag detects the breadboard under the grab point and offers a nearby clear column', () => {
  const circuit = fixture();
  const point = {x:circuit.breadboard.x,z:circuit.breadboard.z};
  const grabbed = {x:point.x-5,z:point.z,pointer:{x:point.x-3.8,z:point.z}};
  assert.equal(nearestBoardMount(circuit,profile,grabbed).candidate.mount.column,1);
  const edge = nearestBoardMount(circuit,profile,{...grabbed,pointer:{x:point.x-5,z:point.z}});
  assert.equal(edge.candidate,null);
  assert.equal(edge.edgeOnly,true);

  circuit.wires = [wire('bb:c1','mcu:PA1')];
  const first = boardPose({...circuit,board:{...circuit.board,mount:{column:1,rotation:90}}},profile);
  const result = nearestBoardMount(circuit,profile,first,{nearby:true});
  assert.equal(result.nearby,true);
  assert.equal(result.adjusted,undefined);
  assert.deepEqual(result.mount,{column:3,rotation:90});
  assert.deepEqual(result.candidate.mount,result.mount);
});

test('an obstructed drag finds a farther slot for review while leaving the blocking component seated', () => {
  const circuit = fixture();
  circuit.components = [{...makePart('led','first-led'),mount:{hole:'bb:e1',rotation:0}}];
  const original = structuredClone(circuit);
  const pose = boardPose({...circuit,board:{...circuit.board,mount:{column:1,rotation:90}}},profile);
  const exact = nearestBoardMount(circuit,profile,pose,{moveWires:true});
  assert.equal(exact.candidate,null);
  assert.match(exact.reason,/first-led.*已插入/);
  const hit = nearestBoardMount(circuit,profile,pose,{moveWires:true,nearby:true});
  assert.deepEqual(hit.mount,{column:4,rotation:90});
  assert.deepEqual(hit.candidate.mount,hit.mount);
  assert.equal(hit.adjusted,true);
  assert.equal(hit.nearby,true);
  assert.equal(hit.candidate.adjusted,true);
  assert.deepEqual(hit.candidate.unpluggedParts,[]);
  assert.deepEqual(circuit,original);
});

test('an asymmetric PCB can recover in the opposite direction and an all-blocked board keeps the exact reason', () => {
  const s3 = getBoardProfile('esp32-s3-devkitc');
  const circuit = fixture();
  circuit.components = [{...makePart('led','blocking-led'),mount:{hole:'bb:b6',rotation:0}}];
  const pose = boardPose({...circuit,board:{...circuit.board,mount:{column:1,rotation:90}}},s3);
  const hit = nearestBoardMount(circuit,s3,pose,{moveWires:true,nearby:true});
  assert.deepEqual(hit.mount,{column:9,rotation:270});
  assert.equal(hit.candidate.adjusted,true);
  assert.deepEqual(hit.candidate.unpluggedParts,[]);

  const plugged = createCircuit('plugged-led');
  const blocked = nearestBoardMount(plugged,profile,plugged.breadboard,{moveWires:true,nearby:true});
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/led1.*已插入/);
  assert.equal(blocked.adjusted,undefined);
  assert.ok(plugged.components.every(part=>part.mount));
});

test('a PCB dragged from its far end can catch the signal deck even with the cursor and center outside', () => {
  const circuit = fixture(), {x,z} = circuit.breadboard;
  const fromLeft = {x:x-5.2,z,rotation:90,pointer:{x:x-7,z}};
  const fromRight = {x:x+5.2,z,rotation:270,pointer:{x:x+7,z}};
  assert.deepEqual(nearestBoardMount(circuit,profile,fromLeft).mount,{column:1,rotation:90});
  assert.deepEqual(nearestBoardMount(circuit,profile,fromRight).mount,{column:11,rotation:270});
  assert.equal(nearestBoardMount(circuit,profile,{...fromLeft,rotation:0}),null);
  assert.deepEqual(nearestBoardMount(circuit,profile,{...fromLeft,x:x-6.15}).mount,{column:1,rotation:90});
  assert.equal(nearestBoardMount(circuit,profile,{...fromLeft,x:x-6.72}),null);
  assert.equal(nearestBoardMount(circuit,getBoardProfile('uno-r3'),fromLeft),null);
});

test('actual hole overlap snaps while rail-only overlap guides both drag directions', () => {
  const circuit = fixture(), {x,z} = circuit.breadboard;
  const atOuterHoles = {x,z:z+3.7,rotation:0};
  const alongRails = {x,z:z+4,rotation:0};
  const nearest = {column:6,rotation:90,rows:['e','i']};
  for (const getHit of [
    board => nearestBoardMount(circuit,profile,board,{moveWires:true,nearby:true}),
    board => nearestBreadboardMount({...circuit,board},profile,circuit.breadboard,{moveWires:true,nearby:true})
  ]) {
    assert.deepEqual(getHit(atOuterHoles).mount,nearest);
    const edge = getHit(alongRails);
    assert.equal(edge.edgeOnly,true);
    assert.equal(edge.candidate,null);
    assert.match(edge.reason,/电源轨.*信号孔/);
    assert.equal(getHit({...alongRails,z:z+5.15}),null);
  }
});

test('angled boards catch by their true footprint instead of their bounding box', () => {
  const circuit = fixture(), {x,z} = circuit.breadboard;
  assert.deepEqual(nearestBoardMount(circuit,profile,{x:x-5,z:z-2.5,rotation:45}).mount,{column:1,rotation:90,rows:['b','f']});
  assert.equal(nearestBoardMount(circuit,profile,{x:x-5.4,z:z+3.5,rotation:45}),null);
});

test('a drag snaps to the selected row centers in either direction and covers the new socket rows', () => {
  const circuit=fixture();
  const mount={column:6,rotation:270,rows:['e','i']};
  const pose=boardPose({...circuit,board:{...circuit.board,mount}},profile);
  const forward=nearestBoardMount(circuit,profile,{...pose,z:pose.z-.06});
  assert.deepEqual(forward.mount,mount);
  assert.deepEqual(forward.candidate.rows,mount.rows);
  assert.deepEqual(new Set(forward.candidate.contacts.map(({b})=>b[3])),new Set(mount.rows));
  assert.equal(forward.adjusted,undefined);
  const reverse=nearestBreadboardMount({...circuit,board:{x:pose.x,z:pose.z,rotation:pose.rotation}},profile,circuit.breadboard);
  assert.deepEqual(reverse.mount,mount);
  assert.deepEqual(reverse.candidate,{...forward.candidate,breadboard:circuit.breadboard});

  circuit.wires=[wire('bb:i21','mcu:PA1')];
  assert.ok(evaluateMountPlacement(circuit,profile,middle).candidate);
  const blocked=evaluateMountPlacement(circuit,profile,mount);
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/I21.*跳线/);
});

test('an obstructed row falls back to the closer neighboring pair for review', () => {
  const circuit=fixture(),first={column:1,rotation:90};
  circuit.components=[{...makePart('led','upper-led'),locked:true,mount:{hole:'bb:a1',rotation:0}}];
  const original=structuredClone(circuit);
  const pose=boardPose({...circuit,board:{...circuit.board,mount:first}},profile);
  const exact=nearestBoardMount(circuit,profile,pose,{moveWires:true});
  assert.deepEqual(exact.mount,first);
  assert.match(exact.reason,/upper-led.*锁定/);
  const fallback=nearestBoardMount(circuit,profile,pose,{moveWires:true,nearby:true});
  assert.deepEqual(fallback.mount,{...first,rows:['d','h']});
  assert.deepEqual(fallback.candidate.rows,['d','h']);
  assert.equal(fallback.adjusted,true);
  assert.equal(fallback.candidate.adjusted,true);
  assert.deepEqual(fallback.candidate.unpluggedParts,[]);
  assert.deepEqual(circuit,original);
});

test('dragging the breadboard to a detached PCB plans the same contacts at the proposed position', () => {
  const circuit = fixture();
  circuit.board.rotation = 270;
  const original = structuredClone(circuit);
  const breadboard = {...circuit.board};
  const reverse = nearestBreadboardMount(circuit,profile,{...breadboard,pointer:breadboard});
  const proposed = {...circuit,breadboard:reverse.breadboard};
  const forward = nearestBoardMount(proposed,profile,circuit.board);
  assert.deepEqual(reverse.breadboard,{x:breadboard.x,z:breadboard.z});
  assert.deepEqual(reverse.candidate,{...forward.candidate,breadboard:reverse.breadboard});
  assert.deepEqual(reverse.mount,{column:6,rotation:270});
  assert.deepEqual(circuit,original);
});

test('reverse drag checks the fixed PCB before using the cursor and respects orientation, locks and compatibility', () => {
  const circuit = fixture();
  const {x,z} = circuit.board;
  assert.equal(nearestBreadboardMount(circuit,profile,{x:x+12,z,pointer:{x:x+12,z}}),null);
  assert.equal(nearestBreadboardMount(circuit,profile,{x:31,z}),null);
  assert.equal(nearestBreadboardMount(circuit,profile,{x:x+5.2,z}),null);
  assert.equal(nearestBreadboardMount(circuit,profile,{x:x+5.2,z,pointer:{x:x+1.1,z}}).edgeOnly,true);
  assert.equal(nearestBreadboardMount(circuit,profile,{x:x+4.9,z,pointer:{x:x+1.1,z}}).mount.column,1);
  circuit.board.rotation = 90;
  const fromRight = nearestBreadboardMount(circuit,profile,{x:x+5.2,z,pointer:{x:x+7,z}});
  assert.deepEqual(fromRight.mount,{column:1,rotation:90});
  const unsupported = nearestBreadboardMount(circuit,getBoardProfile('uno-r3'),{x,z});
  assert.equal(unsupported.candidate,null);
  assert.match(unsupported.reason,/跳线/);
  for (const lock of [{board:{...circuit.board,locked:true}},{breadboard:{...circuit.breadboard,locked:true}},
    {board:{...circuit.board,mount:{column:6,rotation:90}}}]) {
    assert.equal(nearestBreadboardMount({...circuit,...lock},profile,{x,z}),null);
  }
});

test('reverse drag translates inserted parts and refuses a new collision with a stationary loose part', () => {
  const circuit = fixture();
  const breadboard = {x:circuit.board.x,z:circuit.board.z};
  const inserted = {...makePart('led','inserted'),mount:{hole:'bb:a1',rotation:0}};
  const pose = partPose(inserted,breadboard);
  const loose = makePart('resistor','loose',pose.x-.2,pose.z);
  circuit.components = [inserted,loose];
  const original = structuredClone(circuit);
  assert.deepEqual(breadboardMoveObstacle(circuit,breadboard)?.obstacle,loose);
  assert.equal(breadboardMoveObstacle(circuit,breadboard,[loose]),null);
  const result = nearestBreadboardMount(circuit,profile,breadboard);
  assert.equal(result.candidate,null);
  assert.match(result.reason,/inserted.*loose/);
  assert.deepEqual(result.breadboard,breadboard);
  assert.deepEqual(circuit,original);

  const nearby = nearestBreadboardMount(circuit,profile,breadboard,{nearby:true});
  assert.deepEqual(nearby.mount,{column:4,rotation:90});
  assert.deepEqual(nearby.candidate.blockers,[loose]);
  assert.deepEqual(nearby.candidate.breadboard,breadboard);
  assert.deepEqual(circuit,original);

  loose.x = pose.x-.65;
  const blocked = nearestBreadboardMount(circuit,profile,breadboard,{nearby:true});
  assert.equal(blocked.candidate,null);
  assert.match(blocked.reason,/inserted.*loose/);
});

test('covered plugs can move to free holes on their own strips without changing the draft', () => {
  const circuit = fixture();
  circuit.wires = [wire('bb:c21','mcu:PA1'),wire('bb:g24','mcu:PA2')];
  const original = structuredClone(circuit);
  const {candidate} = evaluateMountPlacement(circuit,profile,middle,{moveWires:true});
  assert.deepEqual(candidate.wireMoves.map(({from,to})=>[from,to]),[['bb:c21','bb:a21'],['bb:g24','bb:i24']]);
  assert.equal(candidate.connectedNets,2);
  assert.deepEqual(candidate.unpluggedWires,[]);
  assert.deepEqual(circuit,original);
  circuit.wires.push(wire('bb:a21','mcu:PA3'));
  assert.match(evaluateMountPlacement(circuit,profile,middle,{moveWires:true}).reason,/C21/);
});

test('opt-in recovery detaches only obstructions, keeps unrelated connections and respects locked parts', () => {
  const circuit = fixture();
  const esp = getBoardProfile('esp32-devkitc');
  circuit.wires = [{id:'w1',...wire('bb:a14','mcu:GND1')},{id:'w2',...wire('bb:j14','mcu:GPIO23')}];
  circuit.components = [{...makePart('led','led1',-10,-10),mount:{hole:'bb:d16',rotation:0}}];
  const original = structuredClone(circuit);
  assert.equal(evaluateMountPlacement(circuit,esp,middle,{moveWires:true}).candidate,null);
  const {candidate} = evaluateMountPlacement(circuit,esp,middle,{moveWires:true,clearObstructions:true});
  assert.deepEqual(candidate.unpluggedWires.map(w=>w.id),['w1']);
  assert.deepEqual(candidate.unpluggedParts.map(p=>p.id),['led1']);
  assert.equal(candidate.connectedNets,1);
  assert.deepEqual(circuit,original);
  circuit.components[0].locked=true;
  assert.match(evaluateMountPlacement(circuit,esp,middle,{moveWires:true,clearObstructions:true}).reason,/锁定/);
});
