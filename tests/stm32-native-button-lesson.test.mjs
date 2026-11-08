import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';
import {makeStm32NativeButtonLesson, stm32NativeButtonLessonId} from '../dist/stm32-native-lessons.js';

test('NUCLEO multi-file C lesson changes LD2 policy while the real B1 input stays active-low', async t => {
  const lesson = makeStm32NativeButtonLesson();
  const {boardId,circuitData:circuit} = lesson;
  const dist = new URL('../dist/',import.meta.url);
  const files = Object.fromEntries(Object.entries(lesson.nativeSourceAssets)
    .map(([name,path]) => [name,readFileSync(new URL(path,dist),'utf8')]));
  assert.equal(lesson.id,stm32NativeButtonLessonId);
  assert.equal(lesson.nativeOnly,true);
  assert.equal(boardId,'nucleo-f103rb');
  assert.deepEqual(circuit.components,[]);
  assert.deepEqual(circuit.wires,[]);
  assert.match(files['main.c'],/led_should_light\(pressed\)/);

  const header = 'led_policy.h';
  const choosePolicy = value => ({...files,[header]:files[header].replace('LIGHT_WHEN_PRESSED 1',`LIGHT_WHEN_PRESSED ${value}`)});
  const broken = choosePolicy(2);
  await assert.rejects(compileStm32C(broken,{boardId}), error => error.diagnostics?.some(issue =>
    issue.file === header && issue.line > 0 && issue.severity === 'error' && /LIGHT_WHEN_PRESSED/.test(issue.message)));

  let original;
  for (const policy of [1,0]) {
    await t.test(`LIGHT_WHEN_PRESSED ${policy}`,async sample => {
      const {binary,diagnostics} = await compileStm32C(choosePolicy(policy),{boardId});
      assert.deepEqual(diagnostics,[]);
      if (policy) original = binary;
      else assert.notDeepEqual(binary,original);

      const image = parseStm32Bin(binary,boardId);
      assert.equal(image.initialStack,0x20005000);
      assert.equal(image.flash.length,128*1024);
      const solver = new CircuitSimulator();
      const runtime = await createStm32FirmwareRuntime(image,{...createAvrCircuitIO(() => circuit,solver),boardId});
      sample.after(() => runtime.dispose());

      for (const pressed of [false,true,false]) {
        circuit.board.userButtonPressed = pressed;
        const state = await runtime.advanceTime(1);
        const lit = pressed === Boolean(policy);
        assert.equal(state.error,null);
        assert.equal(state.pins.PC13.mode,'GPIO_Mode_IN_FLOATING');
        assert.equal(state.pins.PC13.level,Number(!pressed));
        assert.equal(state.pins.PA5.level,Number(lit));
        assert.equal(solver.solve(circuit,state).parts.onboard.brightness > 0,lit);
      }
    });
  }
});
