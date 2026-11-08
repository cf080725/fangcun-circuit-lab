import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {mountedConnections,signalStrip} from '../dist/breadboard-mount.js';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';
import {makeServoNativeLesson,servoNativeLessonId,servoNativePotPart,servoNativeServoPart,servoNativeSupplyPart} from '../dist/servo-native-lesson.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

function near(actual,expected,tolerance=1e-5) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);
}

test('native servo bench seats the board and routes PA4 and PA0 through exposed holes',()=>{
  const lesson=makeServoNativeLesson();
  assert.equal(lesson.id,servoNativeLessonId);
  assert.equal(lesson.nativeOnly,true);
  assert.equal(lesson.nativeSourceParameter,'SERVO_REVERSED');
  const circuit=validateCircuit(lesson.circuitData);
  assert.deepEqual(circuit.board.mount,{column:6,rotation:90});
  const connections=mountedConnections(circuit,getBoardProfile(lesson.boardId));
  const strip=pin=>signalStrip(connections.find(({a})=>a===`mcu:${pin}`)?.b);
  assert.deepEqual(strip('PA4'),signalStrip('bb:a17'));
  assert.deepEqual(strip('PA0'),signalStrip('bb:a21'));
  assert.deepEqual(strip('3V3b'),signalStrip('bb:a8'));
  assert.deepEqual(strip('GND1'),signalStrip('bb:j24'));
  assert.ok(circuit.wires.some(({a,b})=>a==='bb:n25'&&b==='bb:j24'));
  assert.ok(circuit.wires.some(({a,b})=>a===`${servoNativeSupplyPart}:+`&&b===`${servoNativeServoPart}:VCC`));
  const parts=Object.fromEntries(circuit.components.map(part=>[part.id,part]));
  assert.equal(parts[servoNativePotPart].position,.75);
  assert.equal(parts[servoNativeServoPart].servoModel,'hs55');
  assert.equal(parts[servoNativeSupplyPart].voltage,5);
});

test('local STM32 C build reads the same knob position and reverses measured hardware PWM', async t=>{
  const {boardId,circuitData:circuit,nativeSourceAssets}=makeServoNativeLesson();
  const dist=new URL('../dist/',import.meta.url);
  const files=Object.fromEntries(Object.entries(nativeSourceAssets)
    .map(([name,asset])=>[name,readFileSync(new URL(asset,dist),'utf8')]));
  const header='servo_policy.h';
  const policy=value=>({...files,[header]:files[header].replace('#define SERVO_REVERSED 0',`#define SERVO_REVERSED ${value}`)});
  await assert.rejects(compileStm32C(policy(2),{boardId}),error=>error.diagnostics?.some(issue=>
    issue.file===header && issue.severity==='error' && /SERVO_REVERSED/.test(issue.message)));

  const original=structuredClone(circuit);
  const solver=new CircuitSimulator();
  const io=createAvrCircuitIO(()=>circuit,solver);
  const pot=circuit.components.find(part=>part.id===servoNativePotPart);
  async function boot(source) {
    const {binary,diagnostics}=await compileStm32C(source,{boardId});
    assert.deepEqual(diagnostics,[]);
    const runtime=await createStm32FirmwareRuntime(parseStm32Bin(binary,boardId),{...io,boardId});
    t.after(()=>runtime.dispose());
    return runtime;
  }
  async function sample(runtime,ms=20) {
    const state=await runtime.advanceTime(ms);
    assert.equal(state.error,null);
    const solved=solver.solve(circuit,state);
    assert.equal(solved.converged,true);
    return {state,servo:solved.parts[servoNativeServoPart]};
  }
  function command({state,servo},{adc,pulse,target}) {
    const observed=state.adc.ADC1;
    assert.equal(observed.calibrated,true);
    assert.equal(observed.resultPin,'PA4');
    assert.equal(observed.result,adc);
    assert.equal(state.pins.PA4.mode,'GPIO_Mode_AIN');
    assert.equal(state.pins.PA0.mode,'GPIO_Mode_AF_PP');
    near(state.pins.PA0.pwm.frequencyHz,50);
    near(state.pins.PA0.pwm.duty,pulse/20000);
    assert.equal(servo.signalPin,'PA0');
    assert.equal(servo.active,true);
    near(servo.voltage,5);
    near(servo.pulseUs,pulse);
    near(servo.targetAngle,target);
  }

  const forward=await boot(files);
  let measured=await sample(forward,5);
  command(measured,{adc:3071,pulse:1800,target:120});
  near(measured.state.adc.ADC1.voltage,2.475,.002);
  for(let tick=0;tick<10;tick++) measured=await sample(forward);
  near(measured.servo.angle,120);

  pot.position=.25;
  io.invalidateAnalog();
  measured=await sample(forward,40);
  command(measured,{adc:1024,pulse:1200,target:60});
  pot.position=.75;
  io.invalidateAnalog();
  for(let tick=0;tick<10;tick++) measured=await sample(forward);
  near(measured.servo.angle,120);
  forward.dispose();

  solver.reset({preserveServoAngles:true});
  io.invalidateAnalog();
  const reversed=await boot(policy(1));
  near(solver.solve(circuit,reversed.getState()).parts[servoNativeServoPart].angle,120);
  measured=await sample(reversed,5);
  command(measured,{adc:3071,pulse:1200,target:60});
  assert.ok(measured.servo.angle>60);
  for(let tick=0;tick<12;tick++) measured=await sample(reversed);
  near(measured.servo.angle,60);
  assert.deepEqual(circuit,original);
});
