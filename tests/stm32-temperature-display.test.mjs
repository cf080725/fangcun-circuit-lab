import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {analyzeI2cEvent} from '../dist/i2c-analyzer-data.js';
import {bluePillI2cTemperatureDisplayLesson, temperatureDisplaySdaWires} from '../dist/i2c-temperature-display-lesson.js';
import {parseStm32Hex} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

const sensorAddress = 0x18;
const displayAddress = 0x3d;
const i2c = (state, since = 0) => state.events.filter(event => event.type === 'i2c' && event.fromMs >= since);
const glyphs = {
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '3': [0x22, 0x41, 0x49, 0x49, 0x36],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x2f, 0x49, 0x49, 0x49, 0x31],
  '9': [0x26, 0x49, 0x49, 0x49, 0x3e],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  ' ': [0, 0, 0, 0, 0],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
};

async function setup(t, unit) {
  const {circuitData:circuit} = bluePillI2cTemperatureDisplayLesson();
  const sensor = circuit.components.find(part => part.id === 'temp1');
  assert.equal(sensor.temperatureC, 34.5);
  const solver = new CircuitSimulator();
  const url = new URL(`../dist/firmware/bluepill/temperature-display-${unit}.hex`, import.meta.url);
  const firmware = parseStm32Hex(readFileSync(url, 'utf8'), 'bluepill');
  const runtime = await createStm32FirmwareRuntime(firmware, {
    ...createAvrCircuitIO(() => circuit, solver), boardId: 'bluepill',
  });
  t.after(() => runtime.dispose());
  solver.solve(circuit, runtime.getState());

  async function until(predicate, limitMs = 800) {
    let state = runtime.getState();
    const deadline = state.timeMs + limitMs;
    while (!predicate(state) && state.timeMs < deadline) {
      const previous = state;
      state = await runtime.advanceTime(20);
      assert.equal(state.error, null, JSON.stringify(state.error));
      assert.ok(state.cycles > previous.cycles, 'the native worker must make progress');
    }
    assert.ok(predicate(state), JSON.stringify({timeMs:state.timeMs, serial:state.serial, events:i2c(state).slice(-7)}));
    return state;
  }

  function unplugSda(part) {
    const index = circuit.wires.findIndex(wire => wire.id === temperatureDisplaySdaWires[part]);
    assert.notEqual(index, -1);
    const [wire] = circuit.wires.splice(index, 1);
    return () => circuit.wires.splice(index, 0, wire);
  }

  return {until, unplugSda, sensor, parts: state => solver.solve(circuit, state).parts};
}

function assertSensorRead(event, bytes) {
  assert.ok(event, 'expected a completed MCP9808 read');
  assert.equal(event.deviceId, 'temp1');
  assert.deepEqual([event.address, event.direction, event.status, event.stop, event.repeatedStart, event.bytes],
    [sensorAddress, 'read', 0, true, true, bytes]);
  const decoded = analyzeI2cEvent(event);
  assert.equal(decoded.mode, 'estimated');
  assert.equal(decoded.controller, 'stm32-i2c1');
  assert.deepEqual(decoded.groups.map(group => [group.byte, group.ack]), [[0x31, true], [bytes[0], true], [bytes[1], false]]);
  assert.deepEqual(decoded.markers.map(marker => marker.kind), ['repeated-start', 'stop']);
}

function assertDisplayWrite(event) {
  assert.equal(event.deviceId, 'oled1');
  assert.deepEqual([event.address, event.direction, event.status, event.stop, event.bytes[0]],
    [displayAddress, 'write', 0, true, 0x40]);
  const decoded = analyzeI2cEvent(event);
  assert.equal(decoded.mode, 'estimated');
  assert.equal(decoded.controller, 'stm32-i2c1');
  assert.deepEqual(decoded.groups.slice(0, 2).map(group => [group.byte, group.ack]), [[0x7a, true], [0x40, true]]);
}

function assertAddressNack(event, address) {
  assert.ok(event, 'expected the disconnected address to appear in the capture');
  assert.deepEqual([event.address, event.direction, event.status, event.reason, event.bytes],
    [address, 'write', 2, 'disconnected', []]);
  const decoded = analyzeI2cEvent(event);
  assert.equal(decoded.mode, 'estimated');
  assert.deepEqual(decoded.groups.map(group => [group.byte, group.ack]), [[address << 1, false]]);
}

function assertOledFrame(reading, writes, text) {
  assert.equal(reading.powered, true);
  assert.equal(reading.displayOn, true);
  assert.equal(reading.reason, null);
  assert.ok(reading.frameRevision > 0);
  const pixels = [3, 4].flatMap(page => Array.from(reading.framebuffer.slice(page * 128 + 22, page * 128 + 106)));
  assert.ok(pixels.some(Boolean));
  // The full display is written as two horizontal-addressed pages of this row.
  assert.deepEqual(writes.flatMap(event => event.bytes.slice(1)).slice(-168), pixels);

  // Decode the displayed 2× glyphs from visible pixels, including inter-letter
  // spaces. All pixels outside the expected text remain off.
  const width = 12 * text.length - 2;
  const left = (128 - width) / 2;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      let lit = false;
      if (y >= 24 && y < 38 && x >= left && x < left + width) {
        const column = Math.floor((x - left) / 2);
        const letter = text[Math.floor(column / 6)];
        const pixelsInColumn = glyphs[letter][column % 6] ?? 0;
        lit = Boolean(pixelsInColumn & (1 << Math.floor((y - 24) / 2)));
      }
      const actual = Boolean(reading.framebuffer[(y >> 3) * 128 + x] & (1 << (y & 7)));
      if (actual !== lit) assert.fail(`OLED text ${text} differs at pixel (${x}, ${y})`);
    }
  }
}

const dataWrites = events => events.filter(event => event.address === displayAddress && event.status === 0 && event.bytes[0] === 0x40);

test('compiled native C/F firmware reads the same sensor bytes and sends distinct OLED pixels on a shared bus', async t => {
  const frames = [];
  for (const [unit, text] of [['c', '34.5 C'], ['f', '94.1 F']]) {
    await t.test(text, async sample => {
      const {until, parts} = await setup(sample, unit);
      const serial = `TEMP=34.5000\r\nDISPLAY=${text}\r\n`;
      const state = await until(candidate => candidate.serial.includes(serial));
      assert.equal(state.serial, serial);
      const events = i2c(state);
      const pointer = events.find(event => event.address === sensorAddress && event.direction === 'write');
      assert.ok(pointer, 'expected a register-select write before the sensor read');
      assert.deepEqual([pointer.bytes, pointer.status, pointer.stop, pointer.sclHz], [[0x05], 0, false, 100_000]);
      const reading = events.find(event => event.address === sensorAddress && event.direction === 'read');
      assertSensorRead(reading, [0xc2, 0x28]);
      const writes = dataWrites(i2c(state, reading.toMs));
      assert.ok(writes.length > 0);
      writes.forEach(assertDisplayWrite);
      const result = parts(state);
      assert.equal(result.temp1.temperatureC, 34.5);
      assert.equal(result.temp1.rawTemperature, 0xc228);
      assertOledFrame(result.oled1, writes, text);
      frames.push(result.oled1.framebuffer);
    });
  }
  assert.notDeepEqual(frames[0], frames[1]);
});

test('individual SDA unplug preserves the other module, and both branches recover after reconnect', async t => {
  const {until, unplugSda, sensor, parts} = await setup(t, 'c');
  const starting = await until(state => state.serial.includes('DISPLAY=34.5 C\r\n'));
  const initialFrame = parts(starting).oled1.framebuffer;

  const reconnectSensor = unplugSda('temp1');
  const sensorOff = await until(state => state.serial.slice(starting.serial.length).includes('SENSOR_I2C=0x04\r\nDISPLAY=ERR\r\n'));
  const sensorOffEvents = i2c(sensorOff, starting.timeMs);
  assertAddressNack(sensorOffEvents.find(event => event.address === sensorAddress), sensorAddress);
  const errorWrites = dataWrites(sensorOffEvents);
  assert.ok(errorWrites.length > 0);
  const sensorOffParts = parts(sensorOff);
  assert.equal(sensorOffParts.temp1.reason, 'disconnected');
  assertOledFrame(sensorOffParts.oled1, errorWrites, 'ERR');
  assert.notDeepEqual(sensorOffParts.oled1.framebuffer, initialFrame);

  reconnectSensor();
  const sensorBack = await until(state => state.serial.slice(sensorOff.serial.length).includes('TEMP=34.5000\r\nDISPLAY=34.5 C\r\n'));
  assertSensorRead(i2c(sensorBack, sensorOff.timeMs).find(event => event.direction === 'read'), [0xc2, 0x28]);
  const returnedFrame = parts(sensorBack).oled1.framebuffer;
  assert.deepEqual(returnedFrame, initialFrame);

  const reconnectOled = unplugSda('oled1');
  sensor.temperatureC = 31.5;
  const oledOff = await until(state => state.serial.slice(sensorBack.serial.length).includes('TEMP=31.5000\r\nOLED_I2C=0x04\r\n'));
  const oledOffEvents = i2c(oledOff, sensorBack.timeMs);
  assertSensorRead(oledOffEvents.findLast(event => event.direction === 'read'), [0xc1, 0xf8]);
  assertAddressNack(oledOffEvents.findLast(event => event.address === displayAddress), displayAddress);
  const oledOffParts = parts(oledOff);
  assert.equal(oledOffParts.temp1.reason, null);
  assert.equal(oledOffParts.oled1.reason, 'disconnected');
  assert.equal(oledOffParts.oled1.displayOn, true);
  assert.deepEqual(oledOffParts.oled1.framebuffer, returnedFrame, 'an unacknowledged write cannot replace powered display RAM');

  reconnectOled();
  const oledBack = await until(state => state.serial.slice(oledOff.serial.length).includes('TEMP=31.5000\r\nDISPLAY=31.5 C\r\n'));
  const oledBackParts = parts(oledBack);
  const restoredWrites = dataWrites(i2c(oledBack, oledOff.timeMs));
  assertOledFrame(oledBackParts.oled1, restoredWrites, '31.5 C');
  assert.notDeepEqual(oledBackParts.oled1.framebuffer, returnedFrame);
});
