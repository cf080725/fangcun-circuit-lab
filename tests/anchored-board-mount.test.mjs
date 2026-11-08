import test from 'node:test';
import assert from 'node:assert/strict';
import {getBoardProfile} from '../dist/board-profiles.js';
import {boardPose,getMountOptions,mountedConnections,rotateBoardPoint,signalHole,signalPitch} from '../dist/breadboard-mount.js';
import {nearestBoardMount} from '../dist/mount-placement.js';

const profile=getBoardProfile('bluepill');
const fixture=(rotation=90)=>({
  board:{x:-6,z:0,mount:{column:6,rotation}},
  breadboard:{x:7.46,z:-3.25},components:[],wires:[]
});
function deckPoint(circuit,endpoint){
  const {x,z}=signalHole(endpoint[3],Number(endpoint.slice(4)));
  return {x:circuit.breadboard.x+x,z:circuit.breadboard.z+z};
}

test('a distant grabbed pin lands on the pointed hole, keeping both rows and direction exact',()=>{
  for(const id of ['bluepill','nano','pico','esp32-devkitc','xiao-samd21']){
    const board=getBoardProfile(id),options=getMountOptions(board);
    for(const rotation of options.rotations){
      const circuit=fixture(rotation);
      circuit.board.mount.column=1;
      const prior=structuredClone(circuit),contacts=mountedConnections(circuit,board);
      const lastPin=contacts[options.pinCount-1].a;
      const rows=options.rowPairs.at(-1),mount={column:2,rotation,rows};
      const destination='bb:'+rows[0]+(mount.column+options.pinCount-1);
      const pointer={...deckPoint(circuit,destination),anchor:lastPin};
      const hit=nearestBoardMount(circuit,board,{x:100,z:100,rotation:0,pointer});
      assert.equal(hit.anchorHole,destination,id);
      assert.equal(hit.candidate.mount.column,mount.column,id);
      assert.equal(hit.candidate.mount.rotation,rotation,id);
      assert.deepEqual(hit.candidate.rows,rows,id);
      assert.equal(hit.candidate.contacts.length,2*options.pinCount,id);
      assert.equal(hit.candidate.contacts.find(({a})=>a===lastPin).b,destination,id);
      for(const {a,b} of hit.candidate.contacts){
        const {x,z}=board.pins.find(pin=>'mcu:'+pin.id===a),pose=hit.candidate.pose;
        const rotated=rotateBoardPoint(x,z,pose.rotation),hole=deckPoint(circuit,b);
        assert.ok(Math.abs(pose.x+rotated.x-hole.x)<.002 && Math.abs(pose.z+rotated.z-hole.z)<.002,a+' fits '+b);
      }
      assert.deepEqual(circuit,prior,id);
    }
  }
});

test('a pin drop on an invalid row, end column, gap or outside restores the seated mount',()=>{
  const circuit=fixture(),original=structuredClone(circuit);
  const contacts=mountedConnections(circuit,profile);
  const anchor=contacts[19].a,from=contacts[19].b,pose=boardPose(circuit,profile);
  const plan=pointer=>nearestBoardMount(circuit,profile,{...pose,pointer,anchor},{nearby:true,moveWires:true});
  const same=plan(deckPoint(circuit,from));
  assert.equal(same.unchanged,true);
  assert.equal(same.anchorHole,from);
  const overhang=plan(deckPoint(circuit,'bb:c1'));
  assert.equal(overhang.edgeOnly,true);
  assert.equal(overhang.anchorHole,'bb:c1');
  assert.match(overhang.reason,/超出/);
  const wrongSide=plan(deckPoint(circuit,'bb:g25'));
  assert.equal(wrongSide.edgeOnly,true);
  assert.equal(wrongSide.anchorHole,'bb:g25');
  assert.match(wrongSide.reason,/引脚可插入/);
  const gap=plan({x:pose.x,z:circuit.breadboard.z});
  assert.equal(gap.edgeOnly,true);
  assert.equal(gap.anchorHole,undefined);
  const outside=deckPoint(circuit,'bb:c30');
  assert.equal(plan({...outside,x:outside.x+signalPitch}).edgeOnly,true);
  assert.deepEqual(circuit,original);
});

test('blocked or electrically changed pin drops keep their exact destination for review',()=>{
  const circuit=fixture(),anchor=mountedConnections(circuit,profile)[0].a,pose=boardPose(circuit,profile);
  const pointer=deckPoint(circuit,'bb:d8');
  const plan=()=>nearestBoardMount(circuit,profile,{...pose,pointer,anchor},{nearby:true});
  circuit.wires=[{id:'occupies-grabbed-hole',a:'bb:d8',b:'mcu:PA0'}];
  const blocked=plan();
  assert.equal(blocked.candidate,null);
  assert.equal(blocked.anchorHole,'bb:d8');
  assert.deepEqual(blocked.mount,{column:8,rotation:90,rows:['d','h']});
  assert.match(blocked.reason,/D8.*跳线/);
  circuit.wires=[{id:'existing-live-strip',a:'bb:a6',b:'mcu:PA0'}];
  const before=structuredClone(circuit),ready=plan();
  assert.equal(ready.candidate.changedNets,1);
  assert.deepEqual(ready.candidate.netChanges,['A6 断开 GND']);
  assert.deepEqual(circuit,before);
});
