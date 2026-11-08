import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber, canonicalPin, getBoardProfile, makeBoardStarter} from '../dist/board-profiles.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';
import {boardVisual} from '../dist/model-renderer.js';

test('Nano 33 BLE Sense Rev2 uses its own UART aliases and full nRF52840 ADC header', () => {
  const id = 'nano-33-ble-sense-rev2';
  const profile = getBoardProfile(id);
  assert.equal(profile.pins.length, 30);
  assert.equal(canonicalPin('TX', id), 'P1.03');
  assert.equal(canonicalPin('RX', id), 'P1.10');
  assert.equal(boardPinNumber('TX', id), 0);
  assert.equal(boardPinNumber('RX', id), 1);
  assert.equal(canonicalPin('5V', id), 'VUSB_DISABLED');
  assert.equal(canonicalPin('A7', id), 'P0.03');
  assert.equal(profile.analogPins.length, 8);
  assert.ok(makeBoardStarter(id,'adc').circuit.wires.some(wire => wire.a==='pot1:OUT' && wire.b==='mcu:A0'));
  const source = 'int sample=0;void setup(){pinMode(LED_BUILTIN,OUTPUT);digitalWrite(D13,HIGH);analogReadResolution(12);}void loop(){sample=analogRead(A7);delay(1);}';
  const compiled = compileForBoard({'sketch.ino':source}, id);
  const runtime = createBoardRuntime(compiled, {readADC:name => {
    assert.equal(name, 'P0.03');
    return 4095;
  }});
  const state = runtime.runUntilDelay(200);
  assert.equal(state.error,null);
  assert.equal(state.pins['P0.13'].output, 1);
  assert.equal(state.variables.sample, 4095);
  assert.ok(boardVisual(profile).features.some(feature => feature.type==='shield' && feature.label==='NINA-B306'));
});
