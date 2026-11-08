import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber, boardStarterKinds, canonicalPin, getBoardProfile, makeBoardStarter} from '../dist/board-profiles.js';
import {getMountOptions} from '../dist/breadboard-mount.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';

const models = [
  ['raspberry-pi-4', 8.5, 5.6, -3.413, -2.323, -2.577],
  ['raspberry-pi-5', 8.5, 5.6, -3.413, -2.323, -2.577],
  ['pi-zero-2-w', 6.5, 3, -2.413, -1.023, -1.277]
];
const pinout = '3V3 5V GPIO2 5V GPIO3 GND GPIO4 GPIO14 GND GPIO15 GPIO17 GPIO18 GPIO27 GND GPIO22 GPIO23 3V3 GPIO24 GPIO10 GND GPIO9 GPIO25 GPIO11 GPIO8 GND GPIO7 GPIO0 GPIO1 GPIO5 GND GPIO6 GPIO12 GPIO13 GND GPIO19 GPIO16 GPIO26 GPIO20 GND GPIO21'.split(' ');

test('Raspberry Pi physical header positions, aliases, power and reserved pins agree', () => {
  for (const [id, width, height, firstX, innerZ, outerZ] of models) {
    const profile = getBoardProfile(id);
    assert.deepEqual([profile.width,profile.height], [width,height]);
    assert.equal(getMountOptions(profile), null);
    assert.equal(profile.pins.length, 40);
    assert.equal(profile.gpioPins.length, 26);
    assert.deepEqual(profile.pins.map(pin => pin.canonical), pinout);
    profile.pins.forEach((pin, index) => {
      assert.equal(pin.id, `J8_${index + 1}`);
      assert.equal(pin.location, `J8.${index + 1}`);
      assert.equal(pin.contact, 'fixed-male');
      assert.equal(pin.contactY, 1.19);
      assert.ok(Math.abs(pin.x - (firstX + Math.floor(index / 2) * .254)) < 1e-8);
      assert.ok(Math.abs(pin.z - (index % 2 ? outerZ : innerZ)) < 1e-8);
    });
    assert.deepEqual(profile.pins.filter(pin => pin.kind === 'power').map(pin => pin.connectorPin), [1,2,4,17]);
    assert.deepEqual(profile.pins.filter(pin => pin.kind === 'ground').map(pin => pin.connectorPin), [6,9,14,20,25,30,34,39]);
    assert.deepEqual(profile.pins.filter(pin => pin.kind === 'reserved').map(pin => pin.connectorPin), [27,28]);
    for (const alias of ['J8_11','J8.11','BCM17','GPIO17',17]) assert.equal(canonicalPin(alias,id), 'GPIO17');
    assert.equal(boardPinNumber('J8_13',id), 27);
  }
});

test('Raspberry Pi starters only offer GPIO and connect to the physical header', () => {
  for (const [id] of models) {
    const profile = getBoardProfile(id);
    assert.deepEqual(boardStarterKinds(profile), ['blink','button']);
    assert.equal(profile.ledPin, null);
    assert.equal(profile.capabilities.analogInput, false);
    assert.equal(profile.capabilities.pwm, false);
    assert.equal(profile.capabilities.binaryFirmware, false);
    assert.equal(profile.arduinoExport, false);
    assert.deepEqual(makeBoardStarter(id,'adc'), makeBoardStarter(id,'blink'));
    assert.deepEqual(makeBoardStarter(id,'pwm'), makeBoardStarter(id,'blink'));
    const {files,circuit} = makeBoardStarter(id,'button');
    assert.ok(circuit.wires.some(wire => wire.a === 'mcu:J8_11' && wire.b === 'r1:1'));
    assert.ok(circuit.wires.some(wire => wire.a === 'mcu:J8_13' && wire.b === 'button1:1'));
    assert.match(files['sketch.ino'], /LED_PIN = 17; \/\/ J8\.11 · GPIO17/);
    const reservedSource = {'sketch.ino':'void setup(){pinMode(0, OUTPUT);} void loop(){delay(1);}'};
    const runtime = createBoardRuntime(compileForBoard(reservedSource,id));
    assert.equal(runtime.runUntilDelay(200).error?.code, 'BOARD_PIN_RESERVED');
    const result = new CircuitSimulator().solve(circuit);
    assert.equal(result.netVoltages['mcu:J8_1'], 3.3);
    assert.equal(result.netVoltages['mcu:J8_2'], 5);
    assert.equal(result.netVoltages['mcu:J8_4'], 5);
  }
});

test('Raspberry Pi output and button feedback run against the wiring solver', () => {
  for (const [id] of models) {
    for (const kind of ['blink','button']) {
      const {files,circuit} = makeBoardStarter(id,kind);
      const simulator = new CircuitSimulator();
      const runtime = createBoardRuntime(compileForBoard(files,id),{
        readPin:pin => simulator.solve(circuit,runtime.getState(),{averagePWM:false}).readPin(pin)
      });
      function advance() {
        const state = runtime.runUntilDelay(200);
        assert.equal(state.error, null);
        return simulator.solve(circuit,state);
      }
      if (kind === 'blink') {
        assert.ok(advance().parts.led1.currentMa > 1);
        assert.equal(advance().parts.led1.currentMa, 0);
      } else {
        assert.equal(advance().parts.led1.currentMa, 0);
        const button = circuit.components.find(part => part.id === 'button1');
        button.pressed = true;
        assert.ok(advance().parts.led1.currentMa > 1);
        button.pressed = false;
        assert.equal(advance().parts.led1.currentMa, 0);
      }
    }
  }
});

test('Raspberry Pi teaching projects reject analog, PWM and tone calls', () => {
  for (const [id] of models) {
    for (const call of ['analogRead(17)','analogReadResolution(10)','analogWrite(17, 100)','analogWriteFrequency(1000)','tone(17, 300)','noTone(17)']) {
      const files = {'sketch.ino':`void setup(){${call};} void loop(){delay(1);}`};
      assert.throws(() => compileForBoard(files,id), error => error.diagnostics?.some(diagnostic => diagnostic.code === 'BOARD_API'));
    }
  }
});
