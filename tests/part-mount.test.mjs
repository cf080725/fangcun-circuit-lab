import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {rotateBoardPoint, signalHole, signalStrip} from '../dist/breadboard-mount.js';
import {canMountPart, evaluatePartMount, mountedPartBodyBounds, mountedPartContacts, nearestPartMount, partMountPins, partMountRotation, partMountRotations, partPose} from '../dist/part-mount.js';

const profile = getBoardProfile('bluepill');
const fixture = () => ({board:{x:-5,z:0},breadboard:{x:2.4,z:.7},wires:[],components:[]});
const partAt = (type,id,hole,rotation = 0) => ({type,id,x:7,z:3,rotation:15,mount:{hole,rotation}});
const getHole = endpoint => signalHole(endpoint[3],Number(endpoint.slice(4)));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);

test('every supported orientation puts all leads exactly on the documented signal grid', () => {
  const {breadboard} = fixture();
  const cases = [['led',580,2],['resistor',680,2],['button',56,4],['diode',600,2],['capacitor',580,2]];
  for (const [type,count,pinCount] of cases) {
    const pins = partMountPins(type);
    assert.equal(pins.length,pinCount);
    let valid = 0;
    for (const row of 'abcdefghij') for (let column=1;column<=30;column++) for (const rotation of [0,90,180,270]) {
      const part = partAt(type,'probe',`bb:${row}${column}`,rotation);
      const contacts = mountedPartContacts(part);
      if (!contacts.length) continue;
      const pose = partPose(part,breadboard);
      assert.equal(pose.mounted,true);
      assert.equal(pose.rotation,rotation);
      assert.equal(contacts[0].b,part.mount.hole);
      assert.deepEqual(nearestPartMount({...part,mount:undefined},breadboard,pose),part.mount);
      assert.deepEqual(nearestPartMount(part,breadboard,pose,{allowMounted:true}),part.mount);
      assert.equal(new Set(contacts.map(({b}) => b)).size,pinCount);
      if (type==='button') {
        const strips = contacts.map(({b}) => signalStrip(b));
        assert.equal(strips[0].rows,strips[1].rows);
        assert.equal(strips[2].rows,strips[3].rows);
        assert.notEqual(strips[0].rows,strips[2].rows);
      } else {
        assert.notDeepEqual(signalStrip(contacts[0].b),signalStrip(contacts[1].b));
      }
      for (const [{a,b},pin] of contacts.map((pair,index) => [pair,pins[index]])) {
        assert.equal(a,`probe:${pin.id}`);
        const offset = rotateBoardPoint(pin.x,pin.z,rotation), hole = getHole(b);
        close(pose.x+offset.x,breadboard.x+hole.x);
        close(pose.z+offset.z,breadboard.z+hole.z);
      }
      valid++;
    }
    assert.equal(valid,count,type);
  }
});

test('fixed lead pitch respects edges, the center gap, and isolated strips', () => {
  const circuit = fixture();
  const led = partAt('led','led1','bb:a30',180);
  assert.deepEqual(mountedPartContacts(led),[{a:'led1:A',b:'bb:a30'},{a:'led1:K',b:'bb:a29'}]);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:a30',rotation:0}).reason,/对不上/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:b3',rotation:90}).reason,/同一组相通/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:e3',rotation:270}).reason,/对不上/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:p1',rotation:0}).reason,/有效/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:a1',rotation:'0'}).reason,/有效/);
  assert.equal(canMountPart('constructor'),false);
  assert.deepEqual(partMountPins('constructor'),[]);
  const resistor = partAt('resistor','r1','bb:e10',270);
  assert.deepEqual(mountedPartContacts(resistor),[{a:'r1:1',b:'bb:e10'},{a:'r1:2',b:'bb:h10'}]);
});

test('formed diode and electrolytic leads keep polarity and use only distinct strips', () => {
  const circuit = fixture(), diode = partAt('diode','d1','bb:a27'), cap = partAt('capacitor','c1','bb:a30',180);
  assert.deepEqual(partMountRotations('diode'),[0,90,180,270]);
  assert.deepEqual(partMountRotations('capacitor'),[0,180]);
  assert.deepEqual(partMountPins('diode').map(({id,x,z})=>[id,x,z]),[['A',-.381,0],['K',.381,0]]);
  assert.deepEqual(partMountPins('capacitor').map(({id,x,z})=>[id,x,z]),[['+',-.127,0],['-',.127,0]]);
  assert.deepEqual(mountedPartContacts(diode),[{a:'d1:A',b:'bb:a27'},{a:'d1:K',b:'bb:a30'}]);
  assert.deepEqual(mountedPartContacts(cap),[{a:'c1:+',b:'bb:a30'},{a:'c1:-',b:'bb:a29'}]);
  for (const [rotation,row,other] of [[90,'f','e'],[270,'e','f']]) {
    const vertical = evaluatePartMount(circuit,profile,diode,{hole:'bb:'+row+'13',rotation});
    assert.equal(vertical.ok,true);
    assert.deepEqual(vertical.contacts.map(({b})=>b),['bb:'+row+'13','bb:'+other+'13']);
    const body = mountedPartBodyBounds(diode,vertical.pose);
    close(body.right-body.left,.175);
    close(body.bottom-body.top,.34);
  }
  assert.match(evaluatePartMount(circuit,profile,diode,{hole:'bb:d13',rotation:90}).reason,/同一组相通/);
  assert.match(evaluatePartMount(circuit,profile,diode,{hole:'bb:a28',rotation:0}).reason,/第二只脚.*对不上/);
  assert.match(evaluatePartMount(circuit,profile,cap,{hole:'bb:f13',rotation:90}).reason,/沿一排/);
  const capBody = mountedPartBodyBounds(cap,partPose(cap,circuit.breadboard));
  close(capBody.right-capBody.left,.63);
  close(capBody.bottom-capBody.top,.63);
});

test('diode and electrolytic placement respects occupied holes, overlapping bodies and locks', () => {
  const circuit = fixture(), diode = partAt('diode','d1','bb:b9'), cap = partAt('capacitor','c1','bb:a10');
  circuit.components = [diode,cap];
  const snapshot = structuredClone(circuit);
  assert.match(evaluatePartMount(circuit,profile,cap,cap.mount).reason,/本体.*d1.*重叠/);
  assert.deepEqual(circuit,snapshot);

  circuit.components = [cap];
  circuit.wires = [{a:'bb:e13',b:'mcu:PA0'}];
  assert.match(evaluatePartMount(circuit,profile,diode,{hole:'bb:f13',rotation:90}).reason,/E13 孔.*跳线/);
  assert.match(evaluatePartMount(circuit,profile,diode,{hole:'bb:a10',rotation:0}).reason,/A10 孔.*其他元件/);
  for (const part of [diode,cap]) {
    const pose = partPose(part,circuit.breadboard);
    assert.equal(nearestPartMount({...part,locked:true},circuit.breadboard,pose,{allowMounted:true}),null);
  }
});

test('new mounts respect capacitor can clearance while an unchanged legacy placement remains valid', () => {
  const circuit = fixture(), cap = {id:'c1',type:'capacitor'};
  const mount = {hole:'bb:a10',rotation:0};
  circuit.wires = [{a:'bb:b10',b:'mcu:PA0'}];
  assert.match(evaluatePartMount(circuit,profile,cap,mount).reason,/外壳.*B10 孔的跳线/);
  const seated = {...cap,mount};
  assert.equal(evaluatePartMount(circuit,profile,seated,mount).ok,true);

  circuit.wires = [];
  const diode = partAt('diode','d1','bb:b10');
  circuit.components = [diode];
  assert.match(evaluatePartMount(circuit,profile,cap,mount).reason,/外壳.*B10 孔的元件插脚/);
  circuit.components = [seated];
  const looseDiode = {...diode,mount:undefined};
  assert.match(evaluatePartMount(circuit,profile,looseDiode,diode.mount).reason,/B10 孔被电解电容 c1 的外壳遮住/);
  assert.equal(evaluatePartMount(circuit,profile,looseDiode,{hole:'bb:b12',rotation:0}).ok,true);

  circuit.components = [];
  circuit.wires = [{a:'bb:j14',b:'mcu:PA1'},{a:'bb:j15',b:'mcu:GND1'}];
  assert.equal(evaluatePartMount(circuit,profile,cap,{hole:'bb:h14',rotation:0}).ok,true);
});

test('explicit drag uses the formed first lead and keeps the existing mounting rotation rules', () => {
  const circuit = fixture(), {breadboard} = circuit;
  for (const [type,hole,rotation] of [['led','bb:a15',180],['resistor','bb:e10',270],['resistor','bb:d20',0]]) {
    const seated = partAt(type,'dragged',hole,rotation);
    const pose = partPose(seated,breadboard);
    const {mount,...part} = seated;
    const point = {x:pose.x+.105,z:pose.z+.092,rotation};
    const original = structuredClone(part);
    const nearest = nearestPartMount(part,breadboard,point);
    assert.deepEqual(nearest,mount);
    assert.deepEqual(evaluatePartMount(circuit,profile,part,nearest).pose,pose);
    assert.deepEqual(part,original);
  }
  assert.equal(partMountRotation({type:'led',rotation:90}),0);
  assert.equal(partMountRotation({type:'led'},179),180);
  assert.equal(partMountRotation({type:'resistor'},-93),270);
  assert.equal(partMountRotation({type:'button',rotation:0}),90);
  assert.equal(partMountRotation({type:'button',rotation:270}),270);
  assert.equal(partMountRotation({type:'ldr',rotation:90}),null);
});

test('explicit drag leaves far drops, power rails and out-of-range second leads unmounted', () => {
  const {breadboard} = fixture();
  const part = {id:'probe',type:'led',rotation:0};
  const edge = partPose(partAt('led','probe','bb:a29'),breadboard);
  assert.deepEqual(nearestPartMount(part,breadboard,edge),{hole:'bb:a29',rotation:0});
  assert.equal(nearestPartMount(part,breadboard,{...edge,x:edge.x+.254}),null);
  assert.equal(nearestPartMount(part,breadboard,{x:breadboard.x,z:breadboard.z-1.97}),null);
  assert.equal(nearestPartMount(part,breadboard,{x:breadboard.x,z:breadboard.z}),null);
  assert.equal(nearestPartMount(part,breadboard,{x:edge.x+3,z:edge.z}),null);
  assert.equal(nearestPartMount({...part,locked:true},breadboard,edge),null);
  assert.equal(nearestPartMount({...part,hidden:true},breadboard,edge),null);
  assert.equal(nearestPartMount({...part,type:'ldr'},breadboard,edge),null);
});

test('button drag selects the correct inner row and only catches close to the gutter', () => {
  const circuit = fixture(), {breadboard} = circuit;
  const button = {id:'btn',type:'button',rotation:0};
  const body = partPose(partAt('button','btn','bb:f20',90),breadboard);
  assert.deepEqual(nearestPartMount(button,breadboard,{x:body.x+.08,z:body.z+.2}),{hole:'bb:f20',rotation:90});
  assert.deepEqual(nearestPartMount(button,breadboard,{x:body.x-.08,z:body.z-.2,rotation:270}),{hole:'bb:e22',rotation:270});
  assert.equal(nearestPartMount(button,breadboard,{x:body.x,z:body.z+.31}),null);
  assert.equal(nearestPartMount(button,breadboard,{x:body.x,z:body.z-.31,rotation:270}),null);
  assert.equal(nearestPartMount(button,breadboard,{x:breadboard.x+getHole('bb:f30').x,z:body.z}),null);
});

test('drag keeps the closest physical slot for the existing socket checks to reject when occupied', () => {
  const circuit = fixture(), part = {id:'led',type:'led',rotation:0};
  const pose = partPose(partAt('led',part.id,'bb:a10'),circuit.breadboard);
  circuit.wires = [{a:'mcu:PA0',b:'bb:a11'}];
  const original = structuredClone(circuit);
  const mount = nearestPartMount(part,circuit.breadboard,pose);
  assert.deepEqual(mount,{hole:'bb:a10',rotation:0});
  assert.match(evaluatePartMount(circuit,profile,part,mount).reason,/A11 孔.*跳线/);
  assert.deepEqual(circuit,original);
});

test('explicit reposition can reuse its own socket but cannot move or displace a locked part', () => {
  const circuit = fixture(), {breadboard} = circuit;
  const led = partAt('led','moving','bb:a10');
  const fixed = {...partAt('led','fixed','bb:a13'),locked:true};
  circuit.components = [led,fixed];
  const before = structuredClone(circuit);
  const next = {hole:'bb:a11',rotation:0};
  const target = partPose({...led,mount:next},breadboard);
  const options = {allowMounted:true};
  assert.equal(nearestPartMount(led,breadboard,target),null);
  assert.equal(nearestPartMount({...led,locked:true},breadboard,target,options),null);
  assert.equal(nearestPartMount({...led,hidden:true},breadboard,target,options),null);
  assert.deepEqual(nearestPartMount(led,breadboard,target,options),next);
  const bodyConflict = evaluatePartMount(circuit,profile,led,next);
  assert.match(bodyConflict.reason,/本体.*fixed.*重叠/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:a12',rotation:0}).reason,/A13 孔.*其他元件/);
  assert.deepEqual(circuit,before);

  circuit.components.pop();
  const preview = evaluatePartMount(circuit,profile,led,next);
  assert.equal(preview.ok,true);
  assert.deepEqual(preview.contacts,[{a:'moving:A',b:'bb:a11'},{a:'moving:K',b:'bb:a12'}]);
  assert.deepEqual(mountedPartContacts(led),[{a:'moving:A',b:'bb:a10'},{a:'moving:K',b:'bb:a11'}]);
});

test('flipping seated LED and button swaps the correct contacts around the actual body center', () => {
  const cases = [
    [partAt('led','led','bb:a10',180),0,['bb:a9','bb:a10']],
    [partAt('button','btn','bb:f20',90),270,['bb:e22','bb:e20','bb:f22','bb:f20']]
  ];
  const circuit = fixture(), {breadboard} = circuit;
  for (const [part,rotation,sockets] of cases) {
    circuit.components = [part];
    const before = partPose(part,breadboard);
    assert.equal(partMountRotation(part),before.rotation);
    assert.deepEqual(nearestPartMount(part,breadboard,{x:before.x,z:before.z},{allowMounted:true}),part.mount);
    const mount = nearestPartMount(part,breadboard,{...before,rotation},{allowMounted:true});
    assert.deepEqual(mount,{hole:sockets[0],rotation});
    const preview = evaluatePartMount(circuit,profile,part,mount);
    assert.equal(preview.ok,true);
    assert.deepEqual(preview.contacts.map(({b})=>b),sockets);
    close(preview.pose.x,before.x);
    close(preview.pose.z,before.z);
    assert.deepEqual(partPose(part,breadboard),before);
  }
  const resistor = partAt('resistor','r','bb:a10');
  const awayFromGutter = partPose(resistor,breadboard);
  assert.equal(nearestPartMount(resistor,breadboard,{...awayFromGutter,rotation:90},{allowMounted:true}),null);
});

test('the tactile button straddles the gap in either direction and retains pin identities', () => {
  const circuit = fixture(), button = partAt('button','sw1','bb:f20',90);
  const mount = (hole,rotation) => evaluatePartMount(circuit,profile,button,{hole,rotation});
  assert.deepEqual(partMountRotations('button'),[90,270]);
  assert.deepEqual(partMountRotations('led'),[0,180]);
  assert.deepEqual(partMountRotations('resistor'),[0,90,180,270]);
  assert.deepEqual(partMountRotations('constructor'),[]);
  assert.deepEqual(partMountPins('button').map(({id,x,z}) => [id,x,z]),[
    ['1',-.381,-.254],['2',-.381,.254],['3',.381,-.254],['4',.381,.254]
  ]);
  assert.equal(mount('bb:f20',90).ok,true);
  assert.deepEqual(mountedPartContacts(button),[
    {a:'sw1:1',b:'bb:f20'},{a:'sw1:2',b:'bb:f22'},
    {a:'sw1:3',b:'bb:e20'},{a:'sw1:4',b:'bb:e22'}
  ]);
  const turned = mount('bb:e22',270);
  assert.equal(turned.ok,true);
  assert.deepEqual(turned.contacts,[
    {a:'sw1:1',b:'bb:e22'},{a:'sw1:2',b:'bb:e20'},
    {a:'sw1:3',b:'bb:f22'},{a:'sw1:4',b:'bb:f20'}
  ]);
  assert.match(mount('bb:d20',90).reason,/中央沟槽/);
  assert.match(mount('bb:f20',0).reason,/跨槽朝向/);
  assert.match(mount('bb:e22',180).reason,/跨槽朝向/);
  assert.match(mount('bb:f29',90).reason,/第 2 脚对不上/);
  assert.match(mount('bb:e2',270).reason,/第 2 脚对不上/);
});

test('the tactile button rejects an occupied fourth socket and colliding bodies', () => {
  const circuit = fixture(), button = partAt('button','sw1','bb:f20',90);
  circuit.wires = [{a:'mcu:PB1',b:'bb:e22'}];
  assert.match(evaluatePartMount(circuit,profile,button,button.mount).reason,/E22 孔.*跳线/);
  circuit.wires = [];
  circuit.components = [partAt('led','led1','bb:e22')];
  assert.match(evaluatePartMount(circuit,profile,button,button.mount).reason,/E22 孔.*其他元件/);
  circuit.components = [partAt('button','sw2','bb:f21',90)];
  assert.match(evaluatePartMount(circuit,profile,button,button.mount).reason,/本体.*sw2.*重叠/);
});

test('translation keeps mounted leads on the same sockets and free geometry stays intact', () => {
  const circuit = fixture(), part = partAt('resistor','r1','bb:e10',270);
  const before = partPose(part,circuit.breadboard), contacts = mountedPartContacts(part);
  const after = partPose(part,{x:circuit.breadboard.x+4,z:circuit.breadboard.z-2});
  close(after.x-before.x,4);
  close(after.z-before.z,-2);
  assert.deepEqual(mountedPartContacts(part),contacts);
  const bounds = mountedPartBodyBounds(part,before);
  close(bounds.right-bounds.left,.26);
  close(bounds.bottom-bounds.top,.72);
  delete part.mount;
  assert.deepEqual(partPose(part,circuit.breadboard),{x:7,z:3,rotation:15,mounted:false});
  assert.deepEqual(mountedPartContacts(part),[]);
});

test('a mounted part shares a strip via separate sockets but cannot share a physical socket', () => {
  const circuit = fixture(), led = partAt('led','led1','bb:a10'), resistor = partAt('resistor','r1','bb:c11');
  circuit.components = [led,resistor];
  circuit.wires = [{a:'mcu:PA0',b:'bb:b10'},{a:'led1:K',b:'mcu:PA1'}];
  const original = structuredClone(circuit);
  assert.equal(evaluatePartMount(circuit,profile,led,led.mount).ok,true);
  assert.equal(evaluatePartMount(circuit,profile,resistor,resistor.mount).ok,true);
  assert.deepEqual(circuit,original);
  assert.match(evaluatePartMount(circuit,profile,resistor,{hole:'bb:a11',rotation:0}).reason,/A11 孔.*其他元件/);
  assert.match(evaluatePartMount(circuit,profile,resistor,{hole:'bb:b10',rotation:0}).reason,/B10 孔.*跳线/);
  assert.match(evaluatePartMount(circuit,profile,partAt('led','led2','bb:b11'),{hole:'bb:b11',rotation:0}).reason,/本体.*led1.*重叠/);
});

test('board header sockets and PCB outline physically block component mounting', () => {
  const circuit = fixture(), led = partAt('led','led1','bb:a1');
  circuit.board.mount = {column:6,rotation:90};
  assert.equal(evaluatePartMount(circuit,profile,led,led.mount).ok,true);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:c6',rotation:0}).reason,/C6 孔.*开发板/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:d7',rotation:0}).reason,/D7 孔.*开发板/);
  assert.match(evaluatePartMount(circuit,profile,led,{hole:'bb:a21',rotation:0}).reason,/本体.*开发板重叠/);
});
