import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator, createCircuit, makePart, PARTS} from '../dist/circuit.js';

function fixture(boardId = 'uno-r3') {
  const circuit = createCircuit('blink', boardId);
  const display = makePart('ssd1306', 'oled');
  circuit.components = [display];
  const connect = (a, b) => circuit.wires.push({id:'w'+circuit.wires.length, a, b});
  circuit.wires = [];
  for (const [boardPin, oledPin] of [['5V','VIN'], ['GND','GND'], ['SDA','SDA'], ['SCL','SCL']]) {
    connect('mcu:'+boardPin, 'oled:'+oledPin);
  }
  const sim = new CircuitSimulator();
  const state = {boardId, timeMs:0, pins:{}};
  const write = (bytes, address = 0x3d) => sim.writeI2c(circuit, state, address, bytes);
  const read = () => sim.solve(circuit, state).parts.oled;
  return {circuit, display, connect, sim, state, write, read};
}

const initialized = [0, 0xae, 0xd5, 0x80, 0xa8, 0x3f, 0xd3, 0, 0x40, 0x8d, 0x14,
  0x20, 0, 0xa1, 0xc8, 0xda, 0x12, 0x81, 0xcf, 0xd9, 0xf1, 0xdb, 0x40, 0xa4, 0xa6, 0x2e, 0xaf];
const windowAt = (x, page) => [0, 0x21, x, x, 0x22, page, page];
const pixel = (reading, x, y) => Boolean(reading.framebuffer[x + 128 * (y >> 3)] & (1 << (y & 7)));

test('the physically wired #326 initializes at 0x3D and displays actual RAM', () => {
  const {circuit, read, write, sim, state} = fixture();
  assert.deepEqual(PARTS.ssd1306.pins, ['VIN','GND','SDA','SCL']);
  const boot = read();
  assert.equal(boot.powered, true);
  assert.equal(boot.voltage, 5);
  assert.equal(boot.displayOn, false);
  assert.equal(boot.framebuffer.length, 1024);
  assert.equal(sim.lastResult.measureBetween('oled:SDA', 'mcu:GND').status, 'measured');
  assert.ok(sim.lastResult.netVoltages['mcu:A4'] > 4.999);
  assert.deepEqual(write([]), {status:0, deviceId:'oled'});
  assert.deepEqual(write(initialized), {status:0, deviceId:'oled'});
  assert.deepEqual(write(windowAt(13, 2)), {status:0, deviceId:'oled'});
  assert.deepEqual(write(Uint8Array.of(0x40, 0x81)), {status:0, deviceId:'oled'});
  const lit = read();
  assert.ok(lit.displayOn && lit.chargePump);
  assert.equal(lit.contrast, 0xcf);
  assert.equal(lit.frameRevision, 1);
  assert.equal(lit.framebuffer[13+128*2], 0x81);
  assert.ok(pixel(lit, 13, 16) && pixel(lit, 13, 23));
  assert.ok(!pixel(lit, 12, 16) && !pixel(lit, 13, 17));
  assert.strictEqual(read().framebuffer, lit.framebuffer);
  assert.strictEqual(sim.sampleAtCurrentTime(circuit, state).parts.oled.framebuffer, lit.framebuffer);
  write(windowAt(13, 2));write([0x40, 0x81]);
  assert.strictEqual(read().framebuffer, lit.framebuffer);
});

test('accepts split Adafruit commands and I²C continuation control bytes', () => {
  const {write, read} = fixture();
  write([0, 0xa1, 0xc8, 0xaf, 0x8d]);
  assert.equal(read().displayOn, false);
  assert.deepEqual(write([0x80, 0x14, 0x80, 0x81, 0x00, 0x44]), {status:0,deviceId:'oled'});
  assert.equal(read().displayOn, true);
  assert.equal(read().contrast, 0x44);
  write([0, 0x20, 2, 0xb4, 0x02, 0x11]);
  assert.deepEqual(write([0xc0, 0x01, 0x40, 0x80]), {status:0,deviceId:'oled'});
  assert.ok(pixel(read(), 18, 32));
  assert.ok(pixel(read(), 19, 39));
});

test('horizontal and vertical modes wrap through programmed column/page windows', () => {
  for (const mode of [0, 1]) {
    const {write, read} = fixture();
    write(initialized);
    write([0, 0x20, mode, 0x21, 2, 3, 0x22, 1, 2]);
    write([0x40, 1, 2, 4, 8, 16]);
    const data = read().framebuffer;
    assert.equal(data[2+128], 16);
    assert.equal(data[3+128], mode === 0 ? 2 : 4);
    assert.equal(data[2+2*128], mode === 0 ? 4 : 2);
    assert.equal(data[3+2*128], 8);
    assert.equal(data[1+128], 0);
  }
});

test('panel flags and scan instructions preserve RAM and update the visible frame', () => {
  const {read, write} = fixture();
  write(initialized);write(windowAt(0, 0));write([0x40, 1]);
  const initial = read();
  assert.ok(pixel(initial, 0, 0));
  write([0, 0xa7, 0xa5, 0xae]);
  const sleeping = read();
  assert.equal(sleeping.displayOn, false);
  assert.equal(sleeping.inverse, true);
  assert.equal(sleeping.entireDisplayOn, true);
  assert.strictEqual(sleeping.framebuffer, initial.framebuffer);
  write([0, 0xa4, 0xa6, 0xaf, 0xc0, 0xa0]);
  const flipped = read();
  assert.ok(flipped.displayOn && !flipped.inverse && !flipped.entireDisplayOn);
  assert.ok(pixel(flipped, 0, 63));
  assert.ok(!pixel(flipped, 127, 63), 'segment remap does not change data already stored');
  assert.equal(flipped.frameRevision, initial.frameRevision + 1);
  write(windowAt(1, 0));write([0x40, 1]);
  assert.ok(pixel(read(), 126, 63), 'A0 maps subsequent data to the opposite segment order');
  write([0, 0xc8, 0x41, 0xd3, 0]);
  assert.ok(pixel(read(), 0, 63));
  write([0, 0xd3, 1]);
  assert.ok(pixel(read(), 0, 0));
  write([0, 0x8d, 0x10]);
  assert.equal(read().displayEnabled, true);
  assert.equal(read().displayOn, false);
});

test('address mismatch and malformed transactions leave existing pixels untouched', () => {
  const {display, read, write} = fixture();
  write(initialized);write(windowAt(3, 0));write([0x40, 1]);
  const frame = read().framebuffer;
  assert.deepEqual(write([0, 0xae], 0x3c), {status:2,reason:'address-nack'});
  assert.equal(write([0xc0, 0xff, 1]).reason, 'invalid-control');
  assert.equal(write([0x40, 256]).reason, 'invalid-data');
  assert.strictEqual(read().framebuffer, frame);
  assert.equal(read().displayOn, true);
  display.address = 0x3c;
  assert.equal(read().address, 0x3c);
  assert.deepEqual(write([], 0x3d), {status:2,reason:'address-nack'});
  assert.deepEqual(write([0, 0xae], 0x3c), {status:0,deviceId:'oled'});
  assert.equal(read().displayOn, false);
  assert.deepEqual(write([0, 0x2f], 0x3c), {status:0,deviceId:'oled',reason:'unsupported-command',command:0x2f});
});

test('actual bus topology distinguishes missing, crossed and shorted connections', () => {
  const {circuit, read, write, connect} = fixture();
  circuit.wires[2].a = 'mcu:A5';
  circuit.wires[3].a = 'mcu:A4';
  assert.equal(read().reason, 'swapped-lines');
  assert.deepEqual(write(initialized), {status:2,reason:'swapped-lines'});
  circuit.wires[2].a = 'mcu:A4';
  circuit.wires[3].a = 'mcu:A5';
  const sda = circuit.wires[2];
  sda.a = 'bb:a1';connect('mcu:A4', 'bb:e1');
  assert.equal(write(initialized).status, 0, 'both breadboard contacts are on the same strip');
  circuit.wires.at(-1).b = 'bb:f1';
  assert.equal(read().reason, 'disconnected');
  assert.deepEqual(write([0, 0xae]), {status:2,reason:'disconnected'});
  assert.equal(read().displayOn, true, 'disconnecting only SDA does not erase a powered display');
  circuit.wires.at(-1).b = 'bb:e1';
  connect('mcu:A4', 'mcu:A5');
  assert.deepEqual(write([0, 0xae]), {status:4,reason:'bus-short'});
  assert.equal(read().displayOn, true);
});

test('physically stuck low, push-pull contention and excessive pull-up prevent writes', () => {
  const {circuit, state, write, connect, read} = fixture();
  connect('mcu:A4','mcu:GND');
  assert.deepEqual(write(initialized), {status:4,reason:'bus-stuck-low'});
  circuit.wires.pop();
  state.pins.A4 = {mode:'OUTPUT',level:1};
  assert.deepEqual(write(initialized), {status:4,reason:'bus-contention'});
  state.pins.A4 = {mode:'GPIO_Mode_Out_OD',level:1};
  assert.equal(write(initialized).status, 0, 'released open-drain output leaves the external bus high');
  delete state.pins.A4;
  circuit.components.push({...makePart('resistor','r'),resistance:5});
  connect('mcu:A5','r:1');connect('mcu:5V','r:2');
  assert.deepEqual(write([0, 0xae]), {status:4,reason:'bus-stuck-high'});
  assert.equal(read().displayOn, true);
});

test('an isolated external supply requires common ground, and powering off erases memory', () => {
  const {circuit, state, sim, read, write, connect} = fixture();
  const vin = circuit.wires[0], gnd = circuit.wires[1];
  circuit.components.push(makePart('power','supply'));
  vin.a = 'supply:+';gnd.a = 'supply:-';
  assert.ok(read().powered);
  assert.deepEqual(write(initialized), {status:2,reason:'ground'});
  connect('supply:-','mcu:GND');
  assert.equal(write(initialized).status, 0);
  write(windowAt(4, 0));write([0x40, 1]);
  const frame = read().framebuffer;
  sim.reset({preserveDisplayMemory:true});
  assert.strictEqual(read().framebuffer, frame);
  circuit.powered = false;
  assert.equal(read().displayOn, true);
  assert.deepEqual(write([0, 0xae]), {status:2,reason:'controller-off'});
  circuit.powered = true;
  vin.a = 'bb:a7';
  const isolatedSample = sim.sampleAtCurrentTime(circuit, state);
  assert.equal(isolatedSample.parts.oled.powered, false);
  vin.a = 'supply:+';
  assert.strictEqual(read().framebuffer, frame, 'an isolated sample cannot erase authoritative RAM');
  vin.a = 'bb:a7';
  assert.deepEqual(write(initialized), {status:2,reason:'unpowered'});
  vin.a = 'supply:+';
  assert.equal(read().displayOn, false);
  assert.equal(read().framebuffer.some(Boolean), false);
  write(initialized);write(windowAt(4, 0));write([0x40, 1]);
  sim.removeParts(['oled']);
  assert.equal(read().framebuffer.some(Boolean), false);
});

test('board-specific aliases and distinct addresses select only the addressed device', () => {
  for (const boardId of ['nano','mega2560']) {
    const {write, read} = fixture(boardId);
    assert.equal(write(initialized).status, 0);
    assert.equal(read().displayOn, true);
  }
  const {write, read, connect, circuit, sim, state} = fixture();
  const second = {...makePart('ssd1306','oled2'),address:0x3c};
  circuit.components.push(second);
  for (const pin of PARTS.ssd1306.pins) connect('oled:'+pin,'oled2:'+pin);
  assert.equal(write(initialized, 0x3c).deviceId, 'oled2');
  assert.equal(read().displayOn, false);
  assert.equal(sim.lastResult.parts.oled2.displayOn, true);
  second.address = 0x3d;
  assert.deepEqual(write(initialized), {status:4,reason:'address-conflict'});
  assert.equal(read().displayOn, false);
  assert.equal(sim.solve(circuit,state).parts.oled2.displayOn, true);
});
