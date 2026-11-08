import assert from 'node:assert/strict';
import test from 'node:test';
import { compileForBoard, createBoardRuntime, SUPPORTED_APIS } from '../dist/engine.js';

const compilePulse = (call, board = 'uno-r3') => compileForBoard({'sketch.ino': `
unsigned long width = 77;
void setup(){pinMode(8, INPUT);pinMode(9, OUTPUT);}
void loop(){
  digitalWrite(9, HIGH);
  delayMicroseconds(10);
  digitalWrite(9, LOW);
  width = ${call};
  delay(10);
}`},board);
const pulses = state => state.events.filter(event => event.type === 'pulse');
const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);

test('pulseIn uses a single electrical snapshot and resumes with the measured width', () => {
  const measurements = [];
  const runtime = createBoardRuntime(compilePulse('pulseIn(8, HIGH, 30000)'), {
    readPulse(pin, level, timeoutUs, state) {
      measurements.push([pin, level, timeoutUs, state.timeMs]);
      assert.equal(state.pins.D8.mode, 'GPIO_Mode_IN_FLOATING');
      assert.equal(state.pins.D9.level, 0);
      state.pins.D9.output = 1;
      return {widthUs: 5830.6, elapsedUs: 6030.6};
    }
  });
  assert.equal(runtime.runUntilDelay().timeMs, .010);

  let state = runtime.runSlice(2);
  assert.deepEqual(measurements, [['D8', 1, 30000, .010]]);
  approximately(state.timeMs, 2.010);
  approximately(state.pendingDelay.toMs, 6.0406);
  assert.equal(state.variables.width, 77);
  assert.equal(state.pins.D9.level, 0);
  assert.equal(state.pc.line, 8);
  assert.deepEqual(pulses(state), []);

  state = runtime.step(1, {deferDelay: true});
  approximately(state.timeMs, 6.0406);
  assert.equal(state.variables.width, 77);
  assert.equal(state.pendingDelay, undefined);
  assert.equal(state.lastEvent.type, 'delay');
  assert.equal(pulses(state).length, 1);
  const [pulse] = pulses(state);
  assert.deepEqual([pulse.pin,pulse.level,pulse.widthUs,pulse.elapsedUs,pulse.timeoutUs,pulse.timedOut],
    ['D8',1,5831,6030.6,30000,false]);
  assert.equal(pulse.file, 'sketch.ino');
  assert.equal(pulse.line, 8);
  approximately(pulse.fromMs, .010);
  approximately(pulse.toMs, 6.0406);
  approximately(pulse.timeMs, 6.0406);
  state = runtime.step(1);
  assert.equal(state.variables.width, 5831);
  assert.equal(measurements.length, 1);
  assert.equal(pulses(state).length, 1);
});

test('pulseIn waits out default or explicit timeout for missing or impossible readings', () => {
  for (const reading of [null, {widthUs:0,elapsedUs:5}, {widthUs:10,elapsedUs:9},
    {widthUs:5830,elapsedUs:1000001}, {widthUs:Infinity,elapsedUs:1000000}]) {
    let observed;
    const runtime = createBoardRuntime(compilePulse('pulseIn(8, LOW)'), {
      readPulse(pin, level, timeoutUs){observed = [pin,level,timeoutUs];return reading;}
    });
    runtime.runUntilDelay();
    const waiting = runtime.runSlice(100);
    assert.deepEqual(observed, ['D8',0,1000000]);
    assert.equal(waiting.pendingDelay.durationMs, 1000);
    assert.deepEqual(pulses(waiting), []);
    const done = runtime.runUntilDelay();
    const [pulse] = pulses(done);
    approximately(done.timeMs, 1000.01);
    assert.equal(pulse.widthUs, 0);
    assert.equal(pulse.elapsedUs, 1000000);
    assert.equal(pulse.timedOut, true);
    assert.equal(runtime.step(1).variables.width, 0);
  }

  const runtime = createBoardRuntime(compilePulse('pulseIn(8, HIGH, 1800)'));
  runtime.runUntilDelay();
  const done = runtime.runUntilDelay();
  approximately(done.timeMs, 1.810);
  assert.equal(pulses(done)[0].elapsedUs, 1800);
  assert.equal(runtime.step(1).variables.width, 0);
});

test('pulseIn accepts zero timeout and abandons pending measurements when reset', () => {
  let calls = 0;
  const hooks = {readPulse(){calls++;return {widthUs:4000,elapsedUs:4300};}};
  const immediate = createBoardRuntime(compilePulse('pulseIn(8, HIGH, 0)'), hooks);
  immediate.runUntilDelay();
  const state = immediate.runUntilDelay();
  approximately(state.timeMs, .010);
  assert.equal(pulses(state)[0].timedOut, true);
  assert.equal(immediate.step(1).variables.width, 0);
  assert.equal(calls, 0);

  const interrupted = createBoardRuntime(compilePulse('pulseIn(8, HIGH, 10000)'), hooks);
  interrupted.runUntilDelay();
  assert.ok(interrupted.runSlice(1).pendingDelay);
  assert.equal(calls, 1);
  const reset = interrupted.reset();
  assert.equal(reset.pendingDelay, undefined);
  assert.equal(reset.timeMs, 0);
  assert.deepEqual(pulses(reset), []);
  interrupted.runUntilDelay();
  const finished = interrupted.runUntilDelay();
  assert.equal(calls, 2);
  assert.equal(pulses(finished).length, 1);
});

test('pulseIn validates arity, digital pins, requested level and timeout units', () => {
  assert.ok(SUPPORTED_APIS.includes('pulseIn'));
  for (const call of ['pulseIn(8)', 'pulseIn(8, HIGH, 30000, 1)']) {
    assert.throws(() => compilePulse(call), error =>
      error.diagnostics.some(item => item.code === 'ARGUMENT_COUNT'));
  }
  for (const [call, code, board] of [
    ['pulseIn(8, 2)', 'PULSE_LEVEL'],
    ['pulseIn(8, HIGH, -1)', 'PULSE_TIMEOUT'],
    ['pulseIn(8, HIGH, 10.5)', 'PULSE_TIMEOUT'],
    ['pulseIn(8, HIGH, 4294967296)', 'PULSE_TIMEOUT'],
    ['pulseIn(99, HIGH)', 'BOARD_PIN_UNKNOWN'],
    ['pulseIn(A6, HIGH)', 'BOARD_ANALOG_ONLY', 'nano']
  ]) {
    const runtime = createBoardRuntime(compilePulse(call, board));
    runtime.runUntilDelay();
    const state = runtime.runUntilDelay();
    assert.equal(state.error?.code, code);
    assert.equal(state.error?.line, 8);
    assert.deepEqual(pulses(state), []);
  }
});
