import test from 'node:test';
import assert from 'node:assert/strict';
import {getBoardProfile} from '../dist/board-profiles.js';
import {boardMountRows, boardPose, getMountOptions, isBoardMount, mountedConnections, mountedPinRoutes, normalizeBoardMount, rotateBoardPoint, signalHole, signalPitch} from '../dist/breadboard-mount.js';
import {breadboardSockets} from '../dist/geometry-3d.js';
import {CircuitSimulator, makePart} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';

const mountable = [
  'bluepill', 'nano', 'nano-every', 'nano-esp32', 'nano-rp2040-connect', 'nano-33-ble-sense-rev2',
  'pico', 'pico-w', 'pico2', 'pico2-w',
  'xiao-samd21', 'xiao-rp2040', 'xiao-nrf52840-sense', 'xiao-esp32c3', 'xiao-esp32s3-sense',
  'teensy40', 'teensy41', 'esp32-devkitc', 'esp32-c3-devkitm',
  'esp32-s3-devkitc', 'esp32-c6-devkitc', 'esp32-h2-devkitm', 'nodemcu-esp8266'
];
const circuitAt = (boardId, mount) => ({
  boardId, version: 2, powered: true, boot0: false,
  board: {x: -5, z: -1, rotation: 35, ...(mount && {mount})},
  breadboard: {x: 2.4, z: .7}, components: [], wires: []
});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('every supported row pair aligns to real 2.54 mm sockets at both board rotations and edge columns', () => {
  const sockets = new Map(breadboardSockets().map(hole => [hole.endpoint, hole]));
  close(sockets.get('bb:f1').z - sockets.get('bb:e1').z, .762);
  for (const id of mountable) {
    const profile = getBoardProfile(id), options = getMountOptions(profile);
    assert.ok(options, id);
    assert.deepEqual(options.rowPairs[0],options.rows);
    for (const rows of options.rowPairs) for (const column of [options.minColumn, options.maxColumn]) {
      for (const rotation of options.rotations) {
        const circuit = circuitAt(id, {column, rotation, rows});
        const pose = boardPose(circuit, profile), pairs = mountedConnections(circuit, profile);
        assert.equal(pose.mounted, true);
        assert.equal(pose.rotation, rotation);
        assert.equal(pairs.length, profile.pins.length);
        assert.equal(new Set(pairs.map(pair => pair.b)).size, profile.pins.length);
        assert.deepEqual([...new Set(pairs.map(pair=>pair.b[3]))],rows);
        for (const {a, b} of pairs) {
          const pin = profile.pins.find(pin => 'mcu:' + pin.id === a);
          const xy = rotateBoardPoint(pin.x, pin.z, pose.rotation), hole = sockets.get(b);
          assert.ok(hole, b);
          close(pose.x + xy.x, circuit.breadboard.x + hole.x);
          close(pose.z + xy.z, circuit.breadboard.z + hole.z);
        }
      }
    }
  }
  for (const id of ['uno-r3', 'uno-r4-minima', 'uno-r4-wifi']) assert.equal(getMountOptions(getBoardProfile(id)), null);
  assert.deepEqual(getMountOptions(getBoardProfile('bluepill')).rowPairs,[['c','g'],['d','h'],['b','f'],['e','i']]);
  assert.deepEqual(getMountOptions(getBoardProfile('pico')).rowPairs,[['c','h'],['b','g'],['d','i'],['a','f'],['e','j']]);
  assert.deepEqual(getMountOptions(getBoardProfile('esp32-devkitc')).rowPairs,[['a','i'],['b','j']]);
  assert.deepEqual(getMountOptions(getBoardProfile('esp32-c3-devkitm')).rowPairs,[['b','i'],['a','h'],['c','j']]);
});

test('mount row normalization keeps legacy positions and rejects invalid explicit pairs', () => {
  const profile = getBoardProfile('bluepill'), options = getMountOptions(profile);
  const legacy = {column:6,rotation:90};
  const centered = {...legacy,rows:['c','g']};
  const alternate = {...legacy,rows:['d','h']};
  assert.deepEqual(boardMountRows(legacy,options),['c','g']);
  assert.deepEqual(boardMountRows(alternate,options),['d','h']);
  assert.deepEqual(normalizeBoardMount(legacy,options),legacy);
  assert.deepEqual(normalizeBoardMount(centered,options),legacy);
  const normalized = normalizeBoardMount(alternate,options);
  assert.deepEqual(normalized,alternate);
  assert.notEqual(normalized.rows,alternate.rows);
  assert.notEqual(normalized.rows,options.rowPairs[1]);
  assert.equal(isBoardMount(alternate,options),true);

  const oldCircuit = circuitAt(profile.id,legacy);
  const defaultCircuit = circuitAt(profile.id,centered);
  assert.deepEqual(boardPose(defaultCircuit,profile),boardPose(oldCircuit,profile));
  assert.deepEqual(mountedConnections(defaultCircuit,profile),mountedConnections(oldCircuit,profile));
  for (const rows of [null,'cg',['c'],['c','g','h'],['C','G'],['g','c'],['b','e'],['a','j'],['c','f'],['p','g']]) {
    const invalid = {...legacy,rows};
    assert.equal(boardMountRows(invalid,options),null);
    assert.equal(normalizeBoardMount(invalid,options),null);
    assert.equal(isBoardMount(invalid,options),false);
  }
  const bad = circuitAt(profile.id,{...legacy,rows:['g','c']});
  assert.deepEqual(boardPose(bad,profile),{x:-5,z:-1,rotation:35,mounted:false});
  assert.deepEqual(mountedConnections(bad,profile),[]);
});

test('a staggered header cannot claim sockets at the opposite header’s columns', () => {
  const blue = getBoardProfile('bluepill');
  const profile = {...blue,pins:blue.pins.map(pin => pin.side==='right' ? {...pin,z:pin.z+signalPitch/2} : pin)};
  const circuit = circuitAt(profile.id,{column:6,rotation:90});
  assert.equal(getMountOptions(profile),null);
  assert.equal(boardPose(circuit,profile).mounted,false);
  assert.deepEqual(mountedConnections(circuit,profile),[]);
});

test('the four verified DevKit footprints leave one exposed hole per connected strip', () => {
  const boards = [
    ['esp32-s3-devkitc',22,6.274,.8,'GPIO4','b24','i9'],
    ['esp32-c6-devkitc',16,5.18,1.2125,'GPIO10','b12','i15'],
    ['esp32-h2-devkitm',15,4.826,1.1125,'GPIO10','i17','b9'],
    ['nodemcu-esp8266',15,4.826,.635,'D1','i19','b7']
  ];
  for (const [id,count,height,usbClearance,pin,normal,flipped] of boards) {
    const profile = getBoardProfile(id);
    close(profile.width,2.54);
    close(profile.height,height);
    const {rows,pinCount,maxColumn} = getMountOptions(profile);
    assert.deepEqual(rows,['b','i']);
    assert.equal(pinCount,count);
    assert.equal(maxColumn,31-count);
    for (const [side,x] of [['left',-1.143],['right',1.143]]) {
      const header = profile.pins.filter(p=>p.side===side);
      close(header[0].x,x);
      close(header[0].z,-height/2+usbClearance);
      close(header.at(-1).z,header[0].z+(count-1)*signalPitch);
    }
    for (const [rotation,socket] of [[90,normal],[270,flipped]]) {
      const mounted = circuitAt(id,{column:6,rotation});
      const routes = mountedPinRoutes(mounted,profile);
      assert.equal(routes.length,count*2);
      for (const route of routes) {
        const row = route.socket[3]==='b' ? 'a' : 'j';
        assert.deepEqual(route.exposed,['bb:'+row+route.socket.slice(4)]);
      }
      assert.equal(routes.find(item=>item.pin.id===pin).socket,'bb:'+socket);
      assert.deepEqual(validateCircuit(JSON.parse(JSON.stringify(mounted))),mounted);
    }
  }
});

test('the ESP32-C6 no-connect header contacts keep their breadboard strips electrically isolated', () => {
  const profile = getBoardProfile('esp32-c6-devkitc');
  const circuit = circuitAt(profile.id,{column:6,rotation:90});
  const routes = mountedPinRoutes(circuit,profile);
  const unused = routes.filter(({pin})=>pin.kind==='nc');
  assert.deepEqual(unused.map(({socket})=>socket),['bb:b6','bb:i6']);
  const [upper,lower] = unused.map(({exposed})=>exposed[0]);
  circuit.wires = [{id:'hi',a:'mcu:3V3',b:upper},{id:'lo',a:'mcu:GND',b:lower},
    {id:'legacy',a:'mcu:GND',b:'mcu:NC'}];
  assert.equal(profile.pinAliases.NC,'NC');
  const restored = validateCircuit(JSON.parse(JSON.stringify(circuit)));
  const solved = new CircuitSimulator().solve(restored,{pins:{}});
  assert.ok(solved.converged);
  close(solved.netVoltages[upper],3.3);
  close(solved.netVoltages[lower],0);
});

test('mounted GPIO drives the other sockets in its five-hole strip and unplugging opens that circuit', () => {
  const profile = getBoardProfile('bluepill'), {defaultColumn, defaultRotation} = getMountOptions(profile);
  const circuit = circuitAt(profile.id, {column: defaultColumn, rotation: defaultRotation});
  const mount = mountedConnections(circuit, profile);
  const signalHoleId = mount.find(pair => pair.a === 'mcu:PA0').b;
  const signalColumn = Number(signalHoleId.slice(4));
  const gndHoleId = mount.find(pair => pair.a === 'mcu:GND1').b;
  const gndColumn = Number(gndHoleId.slice(4));
  const freeSignal = signalHole('a', signalColumn).endpoint;
  const freeGround = signalHole('j', gndColumn).endpoint;
  circuit.components = [makePart('led', 'led'), makePart('resistor', 'r')];
  circuit.wires = [
    {id: 'w1', a: freeSignal, b: 'r:1'},
    {id: 'w2', a: 'r:2', b: 'led:A'},
    {id: 'w3', a: 'led:K', b: freeGround}
  ];
  const solver = new CircuitSimulator();
  const state = {timeMs: 0, pins: {PA0: {mode: 'GPIO_Mode_Out_PP', level: 1}}};
  const plugged = solver.solve(circuit, state);
  assert.ok(plugged.converged);
  assert.ok(plugged.parts.led.currentMa > 2);
  close(plugged.netVoltages[signalHole('e', signalColumn).endpoint], plugged.netVoltages[freeSignal]);
  assert.ok(plugged.netVoltages[signalHole('j', signalColumn).endpoint] < .1);
  circuit.board.mount = {...circuit.board.mount,rows:['d','h']};
  assert.equal(mountedConnections(circuit,profile).find(pair=>pair.a==='mcu:PA0').b,'bb:d'+signalColumn);
  close(solver.solve(circuit,state).parts.led.currentMa,plugged.parts.led.currentMa);
  delete circuit.board.mount;
  const unplugged = solver.solve(circuit, state);
  assert.ok(unplugged.parts.led.currentMa < .001);
  assert.deepEqual(boardPose(circuit, profile), {x: -5, z: -1, rotation: 35, mounted: false});
});

test('project loading preserves free pose and validated mount metadata independently', () => {
  const input = circuitAt('nano-every', {column: 16, rotation: 270});
  assert.deepEqual(validateCircuit(JSON.parse(JSON.stringify(input))), input);
  const legacy = circuitAt('bluepill');
  delete legacy.board.rotation;
  assert.deepEqual(validateCircuit(legacy), legacy);
  for (const mount of [null, {column: 17, rotation: 270}, {column: 1.5, rotation: 90}, {column: 3, rotation: 180}]) {
    const invalid = circuitAt('nano-every');
    invalid.board.mount = mount;
    assert.throws(() => validateCircuit(invalid), /插装位置无效/);
  }
  assert.throws(() => validateCircuit(circuitAt('uno-r3', {column: 4, rotation: 90})), /板型不支持/);
});

test('mounted pin lookup shows the accessible sockets on the same strip at each orientation', () => {
  const route = (id,rotation,pin) => mountedPinRoutes(circuitAt(id,{column:6,rotation}),getBoardProfile(id))
    .find(item => item.pin.id===pin);
  const blue = route('bluepill',90,'PA0');
  assert.equal(blue.socket,'bb:c21');
  assert.deepEqual(blue.exposed,['bb:a21']);
  const alternate = mountedPinRoutes(circuitAt('bluepill',{column:6,rotation:90,rows:['d','h']}),getBoardProfile('bluepill'))
    .find(item=>item.pin.id==='PA0');
  assert.equal(alternate.socket,'bb:d21');
  assert.deepEqual(alternate.exposed,['bb:a21','bb:b21']);
  const flipped = route('bluepill',270,'PA0');
  assert.equal(flipped.socket,'bb:g10');
  assert.deepEqual(flipped.exposed,['bb:i10','bb:j10']);
  assert.deepEqual(route('esp32-devkitc',90,'GPIO23').exposed,['bb:j23']);
  assert.deepEqual(route('esp32-devkitc',270,'GPIO23').exposed,[]);
  assert.deepEqual(mountedPinRoutes(circuitAt('bluepill'),getBoardProfile('bluepill')),[]);
});
