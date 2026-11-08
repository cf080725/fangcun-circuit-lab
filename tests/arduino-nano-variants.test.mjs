import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber, canonicalPin, getBoardProfile} from '../dist/board-profiles.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';
import {boardVisual} from '../dist/model-renderer.js';

function execute(id, code, hooks) {
  const compiled = compileForBoard({'sketch.ino':code}, id);
  return createBoardRuntime(compiled, hooks).runUntilDelay(100);
}

test('Nano ESP32 uses Arduino pin numbering and reserves the boot/RGB signals', () => {
  const id = 'nano-esp32';
  const profile = getBoardProfile(id);
  assert.equal(profile.pins.length, 30);
  assert.equal(canonicalPin('13', id), 'GPIO48');
  assert.equal(canonicalPin('A0', id), 'GPIO1');
  assert.equal(boardPinNumber('A0', id), 17);
  assert.equal(canonicalPin('VUSB', id), '5V');
  const state = execute(id,
    'int reading=0;void setup(){pinMode(LED_BUILTIN, OUTPUT);digitalWrite(13,HIGH);}void loop(){reading=analogRead(17);delay(1);}',
    {readADC:()=>4095});
  assert.equal(state.error, null);
  assert.equal(state.pins.GPIO48.output, 1);
  assert.equal(state.variables.reading, 4095);
  assert.equal(execute(id, 'void setup(){pinMode(14,OUTPUT);}void loop(){}').error?.code, 'BOARD_PIN_RESERVED');
  const visual = boardVisual(profile);
  assert.ok(visual.features.some(feature => feature.type==='usb' && feature.kind==='C'));
  assert.ok(visual.features.some(feature => feature.type==='shield' && feature.label==='NORA-W106'));
});

test('Nano RP2040 Connect models four direct ADC inputs and the disconnected VUSB pin', () => {
  const id = 'nano-rp2040-connect';
  const profile = getBoardProfile(id);
  assert.equal(profile.pins.length, 30);
  assert.equal(canonicalPin('D13', id), 'GP6');
  assert.equal(canonicalPin('SDA', id), 'GP12');
  assert.equal(canonicalPin('18', id), 'GP12');
  assert.ok(profile.reservedPins.includes(canonicalPin('A4', id)));
  assert.equal(canonicalPin('VUSB', id), 'VUSB_DISABLED');
  assert.equal(profile.pins.find(pin => pin.id==='VUSB').kind, 'nc');
  const state = execute(id,
    'int reading=0;void setup(){pinMode(LED_BUILTIN, OUTPUT);digitalWrite(D13,HIGH);}void loop(){reading=analogRead(A3);delay(1);}',
    {readADC:()=>4095});
  assert.equal(state.error, null);
  assert.equal(state.pins.GP6.output, 1);
  assert.equal(state.variables.reading, 1023);
  assert.equal(execute(id, 'void setup(){analogRead(18);}void loop(){}').error?.code, 'BOARD_NO_ADC');
  assert.ok(profile.reservedPins.includes(canonicalPin('A6', id)));
  assert.equal(execute(id, 'void setup(){analogRead(A6);}void loop(){}').error?.code, 'UNKNOWN_VARIABLE');
  const visual = boardVisual(profile);
  assert.ok(visual.features.some(feature => feature.type==='usb' && feature.kind==='micro'));
  assert.ok(visual.features.some(feature => feature.type==='ic' && feature.label==='RP2040'));
  assert.ok(visual.features.some(feature => feature.type==='shield' && feature.label==='NINA-W102'));
});
