import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {parseAvrHex} from '../dist/avr-firmware-hex.js';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {makeI2cTemperatureLesson} from '../dist/i2c-temperature-lesson.js';

function setup(threshold, temperatureC) {
  const {circuitData:circuit} = makeI2cTemperatureLesson();
  circuit.components.find(part => part.id === 'temp1').temperatureC = temperatureC;
  const solver = new CircuitSimulator();
  const url = new URL(`../dist/firmware/uno-r3/temperature-${threshold}.hex`, import.meta.url);
  const firmware = parseAvrHex(readFileSync(url, 'utf8'));
  const runtime = createAvrFirmwareRuntime(firmware, createAvrCircuitIO(() => circuit, solver));
  solver.solve(circuit, runtime.getState());

  function advanceTo(timeMs) {
    let state = runtime.getState();
    while (state.timeMs < timeMs) {
      const previous = state.cycles;
      state = runtime.advanceTime(Math.min(20, timeMs - state.timeMs + 1 / 16000));
      assert.equal(state.error, null);
      assert(state.cycles > previous, 'AVR clock advanced');
    }
    return state;
  }

  return {circuit, advanceTo, currentMa:state => solver.solve(circuit, state).parts.led1.currentMa};
}

test('the compiled thresholds give opposite D12 outputs at the same measured 34.5 °C', () => {
  for (const [threshold, expectedLevel] of [[30,1],[38,0]]) {
    const {advanceTo, currentMa} = setup(threshold, 34.5);
    const waiting = advanceTo(249);
    assert.equal(waiting.pins.D12.level, 0);
    assert.equal(waiting.serial, '');
    assert.deepEqual(waiting.events, []);

    const measured = advanceTo(285);
    const [pointer, reading] = measured.events;
    assert.equal(measured.events.length, 2);
    assert.deepEqual([pointer.direction,pointer.address,pointer.bytes,pointer.status,pointer.stop,pointer.sclHz],
      ['write',0x18,[0x05],0,false,100000]);
    assert(pointer.fromMs >= 250 && pointer.fromMs < 251);
    assert.deepEqual([reading.direction,reading.address,reading.bytes,reading.status,reading.repeatedStart,reading.stop],
      ['read',0x18,[0xc2,0x28],0,true,true]);
    assert.equal(measured.serial, 'TEMP=34.5000\r\n');
    assert(Math.abs(measured.uarts.Serial.baudRate - 9600) < 20);
    assert.equal(measured.pins.D12.level, expectedLevel);
    assert(expectedLevel ? currentMa(measured) > 1 : currentMa(measured) === 0);
  }
});

test('a disconnected SDA clears an active alarm and a valid signed sample recovers', () => {
  const {circuit, advanceTo, currentMa} = setup(30, 34.5);
  assert.equal(advanceTo(285).pins.D12.level, 1);

  const sda = circuit.wires.find(wire => wire.b === 'temp1:SDA');
  circuit.wires = circuit.wires.filter(wire => wire !== sda);
  const disconnected = advanceTo(600);
  const failure = disconnected.events.at(-1);
  assert.equal(failure.status, 2);
  assert.equal(failure.stop, true);
  assert.equal(failure.direction, 'write');
  assert(failure.fromMs > 550 && failure.fromMs < 580);
  assert.equal(disconnected.serial, 'TEMP=34.5000\r\nI2C=0x20\r\n');
  assert.equal(disconnected.pins.D12.level, 0);
  assert.equal(currentMa(disconnected), 0);

  circuit.wires.push(sda);
  circuit.components.find(part => part.id === 'temp1').temperatureC = -7.25;
  advanceTo(601);
  const recovered = advanceTo(920);
  assert.deepEqual(recovered.events.at(-1).bytes.map((byte, index) => index === 0 ? byte & 0x1f : byte), [0x1f,0x8c]);
  assert(recovered.serial.endsWith('TEMP=-7.2500\r\n'));
  assert.equal(recovered.pins.D12.level, 0);
});

test('a physical SDA short reports TWI bus error 0x00 and clears an active alarm', () => {
  const {circuit, advanceTo, currentMa} = setup(30, 34.5);
  assert.equal(advanceTo(285).pins.D12.level, 1);

  circuit.wires.push({id:'sda-short',a:'temp1:SDA',b:'mcu:GND1'});
  const shorted = advanceTo(600);
  assert.equal(shorted.events.at(-1).status, 4);
  assert.equal(shorted.events.at(-1).reason, 'bus-stuck-low');
  assert.equal(shorted.serial, 'TEMP=34.5000\r\nI2C=0x00\r\n');
  assert.equal(shorted.pins.D12.level, 0);
  assert.equal(currentMa(shorted), 0);
});
