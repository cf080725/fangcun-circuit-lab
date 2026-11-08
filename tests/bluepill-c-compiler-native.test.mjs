import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {compileBluePillC} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {bluePillI2cTemperatureDisplayLesson} from '../dist/i2c-temperature-display-lesson.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

test('local Clang reports real C errors and boots a subsequent edited Blue Pill program', async t => {
  await assert.rejects(compileBluePillC('int main(void) { return UNDECLARED; }\n'), error => {
    return error.diagnostics?.some(issue => issue.line === 1 && issue.column === 25 &&
      issue.severity === 'error' && /undeclared identifier/.test(issue.message));
  });

  const filename = new URL('../dist/firmware/bluepill/temperature-display.c',import.meta.url);
  const original = readFileSync(filename,'utf8');
  // This deliberately combines a converted value with a custom label so
  // either prebuilt image would fail the expected UART and pixel outputs.
  const edited = original.replace('#define DISPLAY_FAHRENHEIT 0','#define DISPLAY_FAHRENHEIT 1')
    .replace("const char unit = 'F';","const char unit = 'C';");
  const stages = [];
  const {binary,diagnostics} = await compileBluePillC(edited,{onProgress:stage => stages.push(stage)});
  assert.deepEqual(stages,['loading','compiling','linking','packaging']);
  assert.deepEqual(diagnostics,[]);
  const image = parseStm32Bin(binary,'bluepill');
  assert.equal(image.initialStack,0x20005000);

  const {circuitData:circuit} = bluePillI2cTemperatureDisplayLesson();
  const solver = new CircuitSimulator();
  const runtime = await createStm32FirmwareRuntime(image,createAvrCircuitIO(() => circuit,solver));
  t.after(() => runtime.dispose());
  let state = runtime.getState();
  solver.solve(circuit,state);
  for (let attempt = 0; attempt < 75 && !state.serial.includes('DISPLAY='); ++attempt) {
    const previous = state.cycles;
    state = await runtime.advanceTime(20);
    assert.equal(state.error,null);
    assert(state.cycles > previous);
  }

  assert.equal(state.serial,'TEMP=34.5000\r\nDISPLAY=94.1 C\r\n');
  assert.deepEqual(state.events.find(event => event.address === 0x18 && event.direction === 'read')?.bytes,[0xc2,0x28]);
  assert(state.events.some(event => event.address === 0x3d && event.bytes[0] === 0x40));
  const oled = solver.solve(circuit,state).parts.oled1;
  assert.equal(oled.displayOn,true);
  assert.equal(createHash('sha256').update(oled.framebuffer).digest('hex'),
    'fe5d8512c72321602431fdab10ce3fee6822356214527addcd10e5faa8cccd79');
});
