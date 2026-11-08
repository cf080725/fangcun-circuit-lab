import test from 'node:test';
import assert from 'node:assert/strict';
import {getBoardProfile} from '../dist/board-profiles.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';
import {examples} from '../dist/content.js';
import {compileProject, createRuntime} from '../dist/engine.js';
import {evaluateMountPlacement} from '../dist/mount-placement.js';
import {evaluatePartMount, mountedPartContacts, nearestPartMount, partPose} from '../dist/part-mount.js';
import {exportProject} from '../dist/project-export.js';
import {parseLabProject, validateCircuit} from '../dist/project-import.js';

const pinState = {timeMs:0,pins:{PA0:{mode:'GPIO_Mode_Out_PP',level:1}}};
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} ≠ ${b}`);

test('the Blue Pill board-insertion lesson powers its external LED only through the mounted header', () => {
  const circuit = createCircuit('board-insertion');
  const wires = structuredClone(circuit.wires);
  const {files} = examples.find(example=>example.id==='blink');
  const simulator = new CircuitSimulator();
  const runtime = createRuntime(compileProject(files));
  const state = runtime.runUntilDelay(2000);
  assert.equal(state.error,null);
  assert.equal(state.pins.PA0.output,1);
  assert.equal(circuit.board.mount,undefined);
  assert.equal(simulator.solve(circuit,state).parts.led1.currentMa,0);

  const {candidate} = evaluateMountPlacement(circuit,getBoardProfile('bluepill'),{column:6,rotation:90});
  assert.ok(candidate);
  assert.deepEqual(candidate.blockers,[]);
  assert.equal(candidate.connectedNets,2);
  circuit.board.mount = candidate.mount;
  assert.deepEqual(validateCircuit(circuit),circuit);
  const plugged = simulator.solve(circuit,state);
  assert.ok(plugged.converged);
  assert.ok(plugged.parts.led1.currentMa>3);
  near(plugged.netVoltages['mcu:PA0'],plugged.netVoltages['bb:a21']);
  near(plugged.netVoltages['mcu:GND1'],plugged.netVoltages['bb:j24']);
  const lowState = runtime.runUntilDelay(2000);
  assert.equal(lowState.pins.PA0.output,0);
  assert.equal(simulator.solve(circuit,lowState).parts.led1.currentMa,0);

  delete circuit.board.mount;
  assert.equal(simulator.solve(circuit,state).parts.led1.currentMa,0);
  assert.equal(wires.length,3);
  assert.deepEqual(circuit.wires,wires);
});

test('the Blue Pill insertion example lights its LED through the breadboard strips with only two jumpers', () => {
  const circuit = validateCircuit(createCircuit('plugged-led'));
  const wires = structuredClone(circuit.wires);
  const simulator = new CircuitSimulator();
  const plugged = simulator.solve(circuit,pinState);
  assert.ok(plugged.converged);
  assert.ok(plugged.parts.led1.currentMa>3);
  near(plugged.parts.led1.currentMa,plugged.parts.r1.currentMa);
  near(plugged.netVoltages['led1:A'],plugged.netVoltages['bb:b10']);
  near(plugged.netVoltages['led1:K'],plugged.netVoltages['bb:a11']);
  near(plugged.netVoltages['r1:1'],plugged.netVoltages['bb:d11']);
  near(plugged.netVoltages['led1:K'],plugged.netVoltages['r1:1']);
  assert.equal(wires.length,2);
  assert.deepEqual(circuit.wires,wires);

  delete circuit.components.find(part=>part.id==='r1').mount;
  const unplugged = simulator.solve(circuit,pinState);
  assert.ok(unplugged.converged);
  assert.ok(unplugged.parts.led1.currentMa<.001);
  assert.deepEqual(circuit.wires,wires);
});

test('previewing a seated LED move keeps the live net until commit, and restoring its old mount restores current', () => {
  const circuit = validateCircuit(createCircuit('plugged-led'));
  const snapshot = structuredClone(circuit);
  const led = circuit.components.find(part=>part.id==='led1');
  const expected = {hole:'bb:a11',rotation:0};
  const target = partPose({...led,mount:expected},circuit.breadboard);
  const candidate = nearestPartMount(led,circuit.breadboard,target,{allowMounted:true});
  assert.deepEqual(candidate,expected);
  const result = evaluatePartMount(circuit,getBoardProfile('bluepill'),led,candidate);
  assert.equal(result.ok,true);
  assert.deepEqual(result.contacts.map(({b})=>b),['bb:a11','bb:a12']);
  assert.deepEqual(circuit,snapshot);

  const solver = new CircuitSimulator();
  const initial = solver.solve(circuit,pinState).parts.led1.currentMa;
  assert.ok(initial>3);
  const previous = led.mount;
  led.mount = candidate;
  assert.deepEqual(validateCircuit(circuit),circuit);
  assert.equal(solver.solve(circuit,pinState).parts.led1.currentMa,0);
  assert.deepEqual(circuit.wires,snapshot.wires);

  led.mount = previous;
  assert.deepEqual(circuit,snapshot);
  near(solver.solve(circuit,pinState).parts.led1.currentMa,initial);
});

test('mounted resistor contacts pass the solved high level to a GPIO input until unplugged', () => {
  const circuit = createCircuit('onboard');
  circuit.components = [{...makePart('resistor','r1'),mount:{hole:'bb:a10',rotation:0}}];
  circuit.wires = [
    {id:'w1',a:'mcu:PA0',b:'bb:e10'},
    {id:'w2',a:'bb:d15',b:'mcu:PB1'}
  ];
  const simulator = new CircuitSimulator();
  const state = {...pinState,pins:{...pinState.pins,PB1:{mode:'GPIO_Mode_IPD'}}};
  const plugged = simulator.solve(circuit,state);
  assert.equal(plugged.readPin('PB1'),1);
  near(plugged.netVoltages['bb:b15'],plugged.netVoltages['mcu:PB1']);
  delete circuit.components[0].mount;
  assert.equal(simulator.solve(circuit,state).readPin('PB1'),0);
});

test('a mounted diode conducts across the gutter in one direction and blocks after a flip', () => {
  const circuit = createCircuit('onboard');
  const diode = {...makePart('diode','d1'),mount:{hole:'bb:f12',rotation:90}};
  circuit.components = [diode,makePart('resistor','r1')];
  circuit.wires = [{id:'w1',a:'mcu:3V3',b:'bb:j12'},
    {id:'w2',a:'bb:a12',b:'r1:1'},{id:'w3',a:'r1:2',b:'mcu:GND1'}];
  assert.deepEqual(validateCircuit(circuit).components,circuit.components);
  const solver = new CircuitSimulator(), forward = solver.solve(circuit).parts.d1;
  assert.equal(forward.conducting,true);
  near(forward.currentMa,(3.3-.7)/(330+10)*1000);
  diode.mount = {hole:'bb:e12',rotation:270};
  const reverse = solver.solve(circuit).parts.d1;
  assert.equal(reverse.conducting,false);
  assert.equal(reverse.currentMa,0);
  assert.ok(reverse.voltage < -3);
});

test('a mounted electrolytic charges through the neighboring strips and detects reversed polarity', () => {
  const circuit = createCircuit('onboard');
  const cap = {...makePart('capacitor','c1'),mount:{hole:'bb:a10',rotation:0}};
  circuit.components = [cap,{...makePart('resistor','r1'),resistance:1000}];
  circuit.wires = [{id:'w1',a:'mcu:3V3',b:'r1:1'},
    {id:'w2',a:'r1:2',b:'bb:d10'},{id:'w3',a:'bb:d11',b:'mcu:GND1'}];
  const restored = validateCircuit(JSON.parse(JSON.stringify(circuit)));
  assert.deepEqual(restored.components,circuit.components);
  const solver = new CircuitSimulator();
  near(solver.solve(restored,{timeMs:100}).parts.c1.voltage,1.65);
  near(solver.solve(restored,{timeMs:200}).parts.c1.voltage,2.475);
  cap.mount = {hole:'bb:a11',rotation:180};
  const reversed = new CircuitSimulator().solve(circuit,{timeMs:100});
  near(reversed.parts.c1.voltage,-1.65);
  assert.ok(reversed.issues.some(issue=>issue.code==='CAP_REVERSED'&&issue.part==='c1'));
});

test('the inserted momentary button pulls PB1 low only while seated and held', () => {
  const circuit = validateCircuit(createCircuit('plugged-button'));
  const wires = structuredClone(circuit.wires);
  const button = circuit.components.find(part=>part.id==='button1');
  assert.deepEqual(mountedPartContacts(button), [
    {a:'button1:1',b:'bb:f20'}, {a:'button1:2',b:'bb:f22'},
    {a:'button1:3',b:'bb:e20'}, {a:'button1:4',b:'bb:e22'}
  ]);
  const {files} = examples.find(example=>example.id==='button');
  const simulator = new CircuitSimulator();
  const runtime = createRuntime(compileProject(files), {
    readPin: name => simulator.solve(circuit,runtime.getState(),{averagePWM:false}).readPin(name)
  });
  const check = pressed => {
    const state = runtime.runUntilDelay(2000);
    assert.equal(state.error,null,state.error?.plain);
    const result = simulator.solve(circuit,state);
    assert.ok(result.converged);
    assert.deepEqual(result.issues.filter(issue=>issue.severity==='error'),[]);
    const pb1 = result.netVoltages['mcu:PB1'];
    assert.equal(result.readPin('PB1'),pressed ? 0 : 1);
    assert.ok(Math.abs(pb1-(pressed ? 0 : 3.3))<.001,`PB1 measured ${pb1} V`);
    if(pressed) assert.ok(result.parts.led1.currentMa>3);
    else assert.equal(result.parts.led1.currentMa,0);
  };
  check(false);
  button.pressed = true;
  check(true);
  button.pressed = false;
  check(false);
  button.pressed = true;
  check(true);
  delete button.mount;
  check(false);
  assert.equal(wires.length,4);
  assert.deepEqual(circuit.wires,wires);
});

test('a held inserted button keeps its footprint across project backups and restores released', () => {
  const circuit = createCircuit('plugged-button');
  const {files} = examples.find(example=>example.id==='button');
  const project = {format:'physical-lab',version:2,exampleId:'plugged-button',files,circuit};
  const released = structuredClone(circuit);
  const button = circuit.components.find(part=>part.id==='button1');
  button.pressed = true;

  assert.deepEqual(parseLabProject(JSON.stringify(project)).circuit,released);
  const exported = exportProject({files,circuit});
  const metadata = JSON.parse(exported.files['导出说明.json']);
  const backup = JSON.parse(exported.files[metadata.generatedFiles.circuit]);
  assert.deepEqual(validateCircuit(backup.circuit),released);
  assert.equal(button.pressed,true);
});

test('project JSON and IDE circuit backup retain exact mounting data independently of the loose pose', () => {
  const circuit = createCircuit('plugged-led');
  const files = {'main.c':'int main(void) { return 0; }'};
  const project = {format:'physical-lab',version:2,exampleId:'plugged-led',files,circuit};
  assert.deepEqual(parseLabProject(JSON.stringify(project)).circuit,circuit);

  const exported = exportProject({files,circuit});
  const metadata = JSON.parse(exported.files['导出说明.json']);
  const backup = JSON.parse(exported.files[metadata.generatedFiles.circuit]);
  assert.deepEqual(validateCircuit(backup.circuit),circuit);
  assert.deepEqual(validateCircuit(createCircuit('blink')),createCircuit('blink'));
});

test('import rejects unsupported mounts, invalid geometry and physically occupied holes', () => {
  const mount = {hole:'bb:a10',rotation:0};
  for (const value of [null,{...mount,rotation:'0'},{...mount,rotation:90},{...mount,hole:'bb:a30'},{...mount,hole:'bb:p1'}]) {
    const circuit = createCircuit('plugged-led');
    circuit.components[0].mount = value;
    assert.throws(()=>validateCircuit(circuit),/led1 的元件插装/);
  }

  const unsupported = createCircuit('onboard');
  unsupported.components = [{...makePart('switch','sw1'),mount}];
  assert.throws(()=>validateCircuit(unsupported),/sw1 的元件插装/);

  const duplicate = createCircuit('plugged-led');
  duplicate.components.push({...makePart('led','led2'),mount});
  assert.throws(()=>validateCircuit(duplicate),/元件插装无效/);

  const wire = createCircuit('plugged-led');
  wire.wires[0].b = 'bb:a10';
  assert.throws(()=>validateCircuit(wire),/led1 的元件插装无效/);

  const board = createCircuit('plugged-led');
  board.board.mount = {column:6,rotation:90};
  assert.throws(()=>validateCircuit(board),/元件插装无效/);
});
