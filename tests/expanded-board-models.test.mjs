import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber, canonicalPin, getBoardProfile, makeBoardStarter} from '../dist/board-profiles.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';
import {boardVisual} from '../dist/model-renderer.js';

test('Espressif reference boards retain the USB-up orientation and exact revision constraints', () => {
  for (const [id, count, led, rx, tx, reserved] of [
    ['esp32-s3-devkitc', 44, 'GPIO38', 'GPIO44', 'GPIO43', [35,36,37]],
    ['esp32-c6-devkitc', 32, 'GPIO8', 'GPIO17', 'GPIO16', []],
    ['esp32-h2-devkitm', 30, 'GPIO8', 'GPIO23', 'GPIO24', [13,14]]
  ]) {
    const profile = getBoardProfile(id);
    assert.equal(profile.pins.length, count);
    assert.equal(profile.rgbLedPin, led);
    assert.equal(profile.ledPin, null);
    assert.equal(canonicalPin('TX', id), tx);
    assert.equal(canonicalPin('RX', id), rx);
    assert.equal(profile.pins.find(p => p.label === 'TX').side, 'left');
    assert.ok(profile.pins.find(p => p.label === 'TX').z > 0);
    assert.ok(profile.pins.find(p => p.label === '5V').z < 0);
    for (const n of reserved) {
      assert.ok(profile.reservedPins.includes('GPIO' + n));
      assert.ok(!profile.pwmPins.includes('GPIO' + n));
      const files = {'sketch.ino':`void setup(){pinMode(${n}, OUTPUT);}void loop(){delay(1);}`};
      const state = createBoardRuntime(compileForBoard(files, id)).runUntilDelay(200);
      assert.equal(state.error?.code, 'BOARD_PIN_RESERVED');
    }
  }
});

test('XIAO and NodeMCU code aliases resolve to GPIO while circuit wires keep silk labels', () => {
  for (const [id, d, gpio, adc, value] of [
    ['xiao-esp32c3', 'D2', 4, 'A1', 4095],
    ['xiao-esp32s3-sense', 'D1', 2, 'A0', 4095],
    ['nodemcu-esp8266', 'D1', 5, 'A0', 1023]
  ]) {
    assert.equal(boardPinNumber(d, id), gpio);
    assert.equal(canonicalPin(d, id), 'GPIO' + gpio);
    assert.equal(canonicalPin(gpio, id), 'GPIO' + gpio);
    assert.ok(makeBoardStarter(id, 'blink').circuit.wires.some(w => w.a === 'mcu:' + d));
    const files = {'sketch.ino':`int sample=0;void setup(){pinMode(${d},OUTPUT);digitalWrite(${d},HIGH);}void loop(){sample=analogRead(${adc});delay(1);}`};
    const state = createBoardRuntime(compileForBoard(files, id), {readADC: () => value}).runUntilDelay(200);
    assert.equal(state.error, null);
    assert.equal(state.pins['GPIO' + gpio].output, 1);
    assert.equal(state.variables.sample, value);
  }
  const node = getBoardProfile('nodemcu-esp8266');
  assert.equal(boardPinNumber('A0', node.id), 17);
  assert.ok(node.analogOnly.includes('A0'));
  assert.ok(node.noInternalPull.includes('GPIO16'));
});

test('new geometry exposes the correct chip/package class and header style', () => {
  const visuals = Object.fromEntries([
    'uno-r4-minima', 'uno-r4-wifi', 'nano-every', 'pico-w', 'pico2', 'pico2-w',
    'nucleo-f411re', 'nucleo-h743zi', 'stm32f746g-disco', 'esp32-s3-devkitc',
    'esp32-c6-devkitc', 'esp32-h2-devkitm', 'nodemcu-esp8266', 'xiao-esp32s3-sense'
  ].map(id => [id, boardVisual(getBoardProfile(id))]));
  assert.ok(visuals['uno-r4-minima'].features.some(f => f.type==='usb' && f.kind==='C'));
  assert.ok(visuals['uno-r4-minima'].features.some(f => f.type==='ic' && f.label==='RA4M1'));
  assert.ok(!visuals['uno-r4-minima'].features.some(f => f.type==='dip' || f.label==='16U2'));
  assert.ok(visuals['uno-r4-wifi'].features.some(f => f.type==='shield' && f.label==='ESP32-S3-MINI-1'));
  assert.ok(visuals['nano-every'].features.some(f => f.type==='ic' && f.label==='ATmega4809'));
  assert.ok(visuals['pico2'].features.some(f => f.type==='ic' && f.label==='RP2350'));
  assert.ok(visuals['pico2-w'].features.some(f => f.type==='antenna'));
  assert.ok(!visuals['pico-w'].features.some(f => f.id==='onboard'));
  assert.ok(visuals['nucleo-f411re'].features.some(f => f.label==='STM32F411RET6'));
  assert.equal(visuals['nucleo-h743zi'].header, 'female');
  assert.equal(visuals['stm32f746g-disco'].header, 'female');
  for (const id of ['esp32-s3-devkitc', 'esp32-c6-devkitc', 'esp32-h2-devkitm']) {
    assert.equal(visuals[id].features.filter(f => f.type==='usb').length, 2);
    assert.ok(visuals[id].features.some(f => f.type==='shield' && f.label===visuals[id].profile.mcu));
  }
  assert.ok(visuals['nodemcu-esp8266'].features.some(f => f.label==='ESP-12E'));
  assert.ok(visuals['xiao-esp32s3-sense'].features.some(f => f.type==='usb' && f.kind==='C'));
});
