import test from 'node:test';
import assert from 'node:assert/strict';
import { boardPinNumber, canonicalPin, getBoardProfile } from '../dist/board-profiles.js';
import { compileForBoard, createBoardRuntime } from '../dist/engine.js';
import { boardVisual } from '../dist/model-renderer.js';

const id = 'giga-r1-wifi';

test('GIGA main headers match their GPIO names, package and safe teaching limits', () => {
  const profile = getBoardProfile(id);
  assert.equal(profile.logicVoltage, 3.3);
  assert.equal(profile.adcMax, 65535);
  assert.equal(profile.partialPinout, true);
  assert.equal(profile.capabilities.wifi, false);
  assert.equal(profile.capabilities.binaryFirmware, false);
  assert.equal(profile.ledPin, 'PJ13');
  assert.equal(profile.ledActiveLow, true);
  assert.equal(canonicalPin('D53', id), 'PG7');
  assert.equal(canonicalPin('D102', id), 'PH12');
  assert.equal(canonicalPin('A8', id), 'PC2_C');
  assert.equal(boardPinNumber('A7', id), 83);
  assert.deepEqual(profile.analogOnly, ['PC2_C', 'PC3_C', 'PA1_C', 'PA0_C']);
  assert.ok(profile.pwmPins.includes(canonicalPin('D2', id)));
  assert.ok(profile.pwmPins.includes(canonicalPin('D13', id)));
  assert.ok(!profile.pwmPins.includes(canonicalPin('D44', id)));
  const visual = boardVisual(profile);
  assert.equal(visual.header, 'female');
  assert.ok(visual.features.some(feature => feature.type === 'bga' && feature.label === profile.mcu));
});

test('GIGA analog-only pins sample but reject digital output', () => {
  const run = (code, hooks) => createBoardRuntime(compileForBoard({'sketch.ino': code}, id), hooks, id).runUntilDelay(200);
  const analog = run('int value=0; void setup(){analogReadResolution(16);} void loop(){value=analogRead(A8);delay(1);}', {
    readADC(pin){ assert.equal(pin, 'PC2_C'); return 53247; }
  });
  assert.equal(analog.variables.value, 53247);
  const digital = run('void setup(){pinMode(A8,OUTPUT);} void loop(){delay(1);}');
  assert.equal(digital.error?.code, 'BOARD_INPUT_ONLY');
  const read = run('void setup(){digitalRead(A8);} void loop(){delay(1);}');
  assert.equal(read.error?.code, 'BOARD_ANALOG_ONLY');
});
