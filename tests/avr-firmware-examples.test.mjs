import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseAvrHex} from '../dist/avr-firmware-hex.js';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';
import {CircuitSimulator, createCircuit} from '../dist/circuit.js';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {mountedPinRoutes} from '../dist/breadboard-mount.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {installAvrAdc} from '../dist/avr-adc.js';
import {CPU} from '../dist/vendor/avr8js/cpu/cpu.js';

function loadExample(name, options) {
  const board = getBoardProfile(options?.boardId ?? 'uno-r3');
  const directory = board.id === 'mega2560' ? board.id : 'uno-r3';
  const file = new URL(`../dist/firmware/${directory}/${name}.hex`, import.meta.url);
  return createAvrFirmwareRuntime(parseAvrHex(readFileSync(file, 'utf8'),{flashBytes:board.flashBytes}), options);
}

function advanceTo(runtime, target) {
  let state = runtime.getState();
  while (state.timeMs < target) {
    const previousCycles = state.cycles;
    state = runtime.advanceTime(Math.min(20, target - state.timeMs + 1 / 16000));
    assert.equal(state.error, null);
    assert(state.cycles > previousCycles, 'firmware clock must advance');
  }
  return state;
}

test('compiled UNO blink firmware drives D13 at 500 ms intervals and resets to the reset vector', () => {
  const runtime = loadExample('blink');
  const circuit = createCircuit('blink', 'uno-r3');
  const solver = new CircuitSimulator();
  const brightness = state => solver.solve(circuit, state).parts.onboard.brightness;

  const firstOn = advanceTo(runtime, 5);
  assert.equal(firstOn.pins.D13.level, 1);
  assert(brightness(firstOn) > 0.5);
  assert.equal(advanceTo(runtime, 490).pins.D13.level, 1);
  const firstOff = advanceTo(runtime, 510);
  assert.equal(firstOff.pins.D13.level, 0);
  assert.equal(brightness(firstOff), 0);
  assert.equal(advanceTo(runtime, 990).pins.D13.level, 0);
  assert.equal(advanceTo(runtime, 1010).pins.D13.level, 1);

  const reset = runtime.reset();
  assert.equal(reset.pc.byteAddress, 0);
  assert.equal(reset.cycles, 0);
  assert.equal(reset.pins.D13.mode, 'GPIO_Mode_IN_FLOATING');
  assert.equal(advanceTo(runtime, 5).pins.D13.level, 1);
});

test('compiled UNO button firmware reads the wired D2 input and drives D13', () => {
  const circuit = createCircuit('button', 'uno-r3');
  const button = circuit.components.find(part => part.type === 'button');
  const solver = new CircuitSimulator();
  const runtime = loadExample('button', {
    readInputs: state => ({D2: solver.solve(circuit, state).readPin('D2')}),
  });

  const released = runtime.step(200);
  assert.equal(released.error, null);
  assert.equal(released.pins.D2.mode, 'GPIO_Mode_IPU');
  assert.equal(released.pins.D2.level, 1);
  assert.equal(released.pins.D13.level, 0);

  button.pressed = true;
  const pressed = runtime.step(200);
  assert.equal(pressed.error, null);
  assert.equal(pressed.pins.D2.level, 0);
  assert.equal(pressed.pins.D13.level, 1);
  assert(solver.solve(circuit, pressed).parts.onboard.brightness > 0.5);

  circuit.wires = circuit.wires.filter(wire => wire.a !== `${button.id}:3`);
  const disconnected = runtime.step(200);
  assert.equal(disconnected.error, null);
  assert.equal(disconnected.pins.D2.level, 1);
  assert.equal(disconnected.pins.D13.level, 0);
});

test('a seated classic Nano reads D2 through its breadboard strip and resets at the AVR reset vector', () => {
  const circuit = createCircuit('button','nano');
  circuit.board.mount = {column:8,rotation:90};
  const d2 = mountedPinRoutes(circuit,getBoardProfile('nano')).find(route=>route.endpoint==='mcu:D2');
  assert(d2.exposed.length>0,'Nano D2 needs an exposed breadboard socket');
  const signal = circuit.wires.find(wire=>wire.a==='mcu:D2');
  signal.a = d2.exposed[0];
  const button = circuit.components.find(part=>part.type==='button');
  const solver = new CircuitSimulator();
  const runtime = loadExample('button',{...createAvrCircuitIO(()=>circuit,solver),boardId:'nano'});
  const released = runtime.step(200);
  assert.equal(released.boardId,'nano');
  assert.equal(released.pins.D2.level,1);
  assert.equal(released.pins.D13.level,0);
  assert(!Object.hasOwn(released.pins,'A6'));
  assert(!Object.hasOwn(released.pins,'A7'));

  button.pressed = true;
  const pressed = runtime.step(200);
  assert.equal(pressed.pins.D2.level,0);
  assert.equal(pressed.pins.D13.level,1);
  assert(solver.solve(circuit,pressed).parts.onboard.brightness>0.5);
  assert.equal(runtime.reset().pc.byteAddress,0);
});

for (const boardId of ['uno-r3','nano','mega2560']) {
  test(`compiled ADC sample reads a virtual potentiometer, controls D13 and sends the result on ${boardId}`, () => {
    const circuit = createCircuit('adc',boardId);
    const pot = circuit.components.find(part=>part.type==='pot');
    const io = createAvrCircuitIO(()=>circuit,new CircuitSimulator());
    const runtime = loadExample('adc',{...io,boardId});
    assert.equal(runtime.getState().adc.ADC0.result,null);

    pot.position = .1;
    const low = advanceTo(runtime,30);
    assert.equal(low.adc.ADC0.result,102);
    assert.equal(low.adc.ADC0.resultPin,'A0');
    assert.equal(low.pins.D13.level,0);
    assert.match(low.serial,/(^|\n)102\r?\n/);

    pot.position = .9;
    io.invalidateAnalog();
    const high = advanceTo(runtime,150);
    assert.equal(high.adc.ADC0.result,921);
    assert.equal(high.pins.D13.level,1);
    assert.match(high.serial,/(^|\n)921\r?\n/);
    assert.equal(runtime.reset().adc.ADC0.result,null);
  });
}

test('compiled Mega button sample maps D2 to PE4 and D13 to PB7', () => {
  const circuit = createCircuit('button','mega2560');
  const button = circuit.components.find(part=>part.type==='button');
  const io = createAvrCircuitIO(()=>circuit,new CircuitSimulator());
  const runtime = loadExample('button',{...io,boardId:'mega2560'});
  assert.equal(advanceTo(runtime,2).pins.D13.level,0);
  button.pressed=true;
  const pressed=advanceTo(runtime,4);
  assert.equal(pressed.pins.D2.level,0);
  assert.equal(pressed.pins.D13.level,1);
  assert.equal(runtime.reset().pc.byteAddress,0);
});

test('Mega ADC MUX5 selects A15 and converts it with the internal 2.56 V reference', () => {
  const cpu=new CPU(new Uint16Array(32),0x2200);
  const observed=[];
  const adc=installAvrAdc(cpu,{
    boardId:'mega2560',
    readAnalog:pin=>{observed.push(pin);return 1.28;},
    fail:(code)=>assert.fail(code)
  });
  cpu.writeData(0x7b,0x08); // MUX5 selects the upper analog bank.
  cpu.writeData(0x7c,0xc7); // Internal 2.56 V, ADC15.
  cpu.writeData(0x7a,0xcf); // ADEN + ADSC + ADIE, prescale by 128.
  cpu.cycles=1728;
  cpu.tick();
  cpu.cycles=3200;
  cpu.tick();
  assert.deepEqual(observed,['A15']);
  assert.equal(adc().resultPin,'A15');
  assert.equal(adc().result,512);
  assert.equal(adc().referenceVoltage,2.56);
  assert.equal(cpu.nextInterrupt,0x3a);
});
