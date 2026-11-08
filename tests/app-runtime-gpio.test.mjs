import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {parseAvrHex} from '../dist/avr-firmware-hex.js';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';
import {getBoardProfile, makeBoardStarter} from '../dist/board-profiles.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';
import {examples} from '../dist/content.js';
import {compileForBoard, createBoardRuntime} from '../dist/engine.js';
import {hardwareResetLabel} from '../dist/model-renderer.js';
import {sameSourceFiles, sourceCircuitKey, sourceObservation, sourceSignalActivity} from '../dist/source-hardware.js';
import {createSourceProbeTrace} from '../dist/source-probe-trace.js';
import {createSourceLedTrace} from '../dist/source-led-trace.js';
import {makeBreadboardBlink} from '../dist/breadboard-blink.js';
import {makePassiveBreadboardExercises} from '../dist/passive-breadboard-exercises.js';
import {makeSevenSegmentLesson,readSevenSegment} from '../dist/sevenseg-lesson.js';
import {createMotorStopTrace,makeMotorBridgeLesson,motorBridgeLessonId,readMotorBridgeLesson} from '../dist/motor-bridge-lesson.js';
import {makeUltrasonicLesson,ultrasonicLessonId} from '../dist/ultrasonic-lesson.js';
import {makeI2cOledLesson} from '../dist/i2c-oled-lesson.js';
import {i2cTemperatureLessonId,makeI2cTemperatureLesson} from '../dist/i2c-temperature-lesson.js';
import {oledLitPixels} from '../dist/i2c-oled-view.js';
import {parseLabProject} from '../dist/project-import.js';
import {makeD13PullupExercise} from '../dist/d13-pullup-exercise.js';
import {emptySourceTrace,sampleSourceTrace,sourceTraceMaxSamples,sourceTraceWindowMs} from '../dist/source-trace.js';

function appSourceFixture(files, circuit, sim, {sliceMs,example={}}={}) {
  // Run the actual browser adapter. Engine tests wire the solver directly
  // and would miss a regression in the app's translation of pin names.
  const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const extract = name => {
    const fn = source.match(new RegExp(`^(?:async )?function ${name}\\([\\s\\S]*?^}`, 'm'))?.[0];
    assert.ok(fn, `The app must expose ${name} to this fixture`);
    return fn;
  };
  const nodes = new Map();
  const messages=[];
  const noop = () => {};
  const context = {
    $: selector => {
      if (!nodes.has(selector)) nodes.set(selector, {dataset:{}});
      return nodes.get(selector);
    },
    $$: () => [],
    esc: value => String(value),
    clearTimeout,
    compileForBoard: (...args) => {context.compiles++;return compileForBoard(...args);},
    createBoardRuntime,
    compilerFiles: () => files,
    files,
    circuit,
    example,
    sim,
    liveTimer: undefined,
    appliedSource: null,
    sourcePending: false,
    programmedSource: null,
    cancelNativeDraftCompile: noop,
    nativeServoComparison: null,
    nativeRelayComparison: null,
    nativeRelayScope: null,
    sourceObserved: null,
    sourceComparison: null,
    sourceTrace: null,
    sourceTraceComparison: null,
    sourceDelaySample: null,
    sourceFrameMs: 16,
    buttonReplay: null,
    buttonCapture: null,
    buttonReference: null,
    buttonReplayStatus: '',
    renderButtonBounceTrace: noop,
    settleButtonContact: noop,
    settleEncoderInputs: noop,
    sourceProbeTrace: createSourceProbeTrace(),
    sourceLedTrace: createSourceLedTrace(),
    motorStopTrace: createMotorStopTrace(),
    motorBridgeLessonId,
    ultrasonicLessonId,
    i2cTemperatureLessonId,
    readMotorBridgeLesson,
    trackedLedId: null,
    probeOpen: false,
    probeEndpoints: {red:null,black:null},
    runtime: null,
    compiled: false,
    lastState: null,
    result: null,
    activeFile: 'main.c',
    wavePin: 'PA0',
    selected: null,
    history: [],
    serialText: '',
    nativeSerialText: {},
    errors: [],
    liveDiagnostics: [],
    running: false,
    compiles: 0,
    executionRequest: 0,
    firmwareImage: null,
    nativeMode: () => !!context.firmwareImage,
    nativeCore: () => 'AVR',
    nativeRuntimeCreator: async () => createAvrFirmwareRuntime,
    isStm32Native: profile => profile.id==='bluepill',
    isRp2040Native: profile => profile.id==='pico',
    avrCircuitIO: createAvrCircuitIO(()=>circuit,sim),
    board: () => getBoardProfile(circuit.boardId),
    sameSourceFiles,
    sourceCircuitKey,
    sourceObservation,
    readSevenSegment,
    sourceSignalActivity,
    emptySourceTrace,
    sampleSourceTrace,
    sourceTraceMaxSamples,
    sourceTraceWindowMs,
    hardwareResetLabel,
    pause: () => {context.executionRequest++;context.running=false;},
    startExecution: () => {
      context.running=true;
      const active=context.runtime;
      context.lastState=sliceMs!==undefined?active.runSlice(sliceMs):active.runUntilDelay?active.runUntilDelay():active.step(1);
      context.refresh();
    },
    refresh: () => {context.result=sim.solve(circuit,context.lastState);},
    setRunStatus: noop,
    toast: message => messages.push(message),
    updateEditor: noop,
    cursorChanged: noop,
    renderDiagnostics: noop,
    renderSourceHardware: noop,
    save: noop,
    scheduleCheck: noop,
    normalizeError: error => error,
    showFirmwareError: error => {throw error;}
  };
  const functions = ['build','createSourceRuntime','sourceDraftChanged','showErrors','ensureRuntime','groundedPinMeasurement','sourceLightReading','sourceServoReading','sourceRcReading','sourceSegmentReading','sourceHardwareSnapshot',
    'sourceTraceResultValid','syncSourceProbeTrace','trackedSourceLed','syncSourceLedTrace','sourceLedCurrent','sampleSourceDelay','beginSourceComparison','updateSourceComparison','motorLessonKey','recordMotorStop','sonarProgramReading','temperatureProgramReading',
    'sourceProbeTraceSnapshot','resetRuntime','reportBoardHardwareReset','resetBoardHardware','clearNativeRelayObservation',
    'applySourceDraft','toggleRun','canExecute','stepSource'].map(extract).join('\n');
  return runInNewContext(`${functions}\n({build, sourceDraftChanged, ensureRuntime, resetRuntime, resetBoardHardware, applySourceDraft, toggleRun,
    snapshot:()=>({runtime,compiled,lastState,history,serialText,appliedSource,sourcePending,programmedSource,
      sourceObserved,sourceComparison,sourceTrace,sourceTraceComparison,sourceDelaySample,probeTrace:sourceProbeTraceSnapshot(),
      ledTrace:{current:sourceLedTrace.current,comparison:sourceLedTrace.comparison},errors,running,compiles,result,
      motorTrace:{before:motorStopTrace.before,current:motorStopTrace.current},
      resetStatus:$('#boardHardwareResetStatus').textContent}),
    loadFirmware(image){resetRuntime();firmwareImage=image;},
    stepWait(){lastState=stepSource(runtime);result=sim.solve(circuit,lastState);},
    attachProbes(red,black){probeOpen=true;Object.assign(probeEndpoints,{red,black});syncSourceProbeTrace();},
    trackLed(id){
      trackedLedId=id;syncSourceLedTrace();
      if(appliedSource&&lastState.executedSteps)sourceLedTrace.record(sourceLedTrace.capture(lastState.timeMs,sourceLedCurrent(result)));
    },
    record(state){
      lastState=state;result=sim.solve(circuit,state);history.push(state.timeMs);serialText='preserve me';running=true;
      updateSourceComparison(sourceHardwareSnapshot(),true);
      if(example.id===motorBridgeLessonId)recordMotorStop(lastState,result);
    },
    inspectPin(pin){wavePin=pin;updateSourceComparison(sourceHardwareSnapshot(),false);}
  });`, context);
}

test('the lab reads the solved GPIO level for ESP and STM32 button examples', () => {
  const stm32 = examples.find(example => example.id === 'button');
  const circuits = [
    makeBoardStarter('esp32-devkitc', 'button'),
    makeBoardStarter('esp32-c3-devkitm', 'button'),
    {files: stm32.files, circuit: createCircuit(stm32.circuitPreset)}
  ];

  for (const {files, circuit} of circuits) {
    const sim = new CircuitSimulator();
    const fixture = appSourceFixture(files,circuit,sim);
    assert.equal(fixture.build(),true);
    const {runtime}=fixture.snapshot();
    const button = circuit.components.find(part => part.type === 'button');

    for (const pressed of [false, true, false]) {
      button.pressed = pressed;
      const state = runtime.runUntilDelay(1000);
      assert.equal(state.error, null, circuit.boardId);
      const light = sim.solve(circuit, state).parts.led1.displayBrightness;
      assert.equal(light > 0.3, pressed, `${circuit.boardId} button pressed=${pressed}`);
    }
  }
});

test('tracked external Nano LED compares actual branch current independent of the watched GPIO', async () => {
  const {files,circuit,mount}=makeBreadboardBlink('nano');
  circuit.board.mount=mount;
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  app.inspectPin('D2');
  assert.equal(await app.ensureRuntime(),true);
  const runtime=app.snapshot().runtime;
  while(runtime.getState().timeMs<6500)app.record(runtime.runUntilDelay());
  app.trackLed('led1');
  app.record(runtime.runUntilDelay());
  app.record(runtime.runUntilDelay());
  const previous=app.snapshot().ledTrace.current;
  assert.equal(previous.originMs,6500);
  assert.ok(previous.samples.some(sample=>sample.currentMa>5));
  assert.ok(previous.samples.some(sample=>sample.currentMa===0));
  const original=files['sketch.ino'];
  files['sketch.ino']='void setup( {';
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),false);
  assert.equal(app.snapshot().ledTrace.current,previous);

  files['sketch.ino']=original.replace('digitalWrite(LED_PIN, HIGH)','digitalWrite(LED_PIN, LOW)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  const next=app.snapshot().runtime;
  app.record(next.runUntilDelay());
  const trace=app.snapshot().ledTrace.comparison;
  assert.equal(trace.id,'led1');
  assert.equal(trace.before,previous);
  assert.equal(trace.after.originMs,0);
  assert.ok(trace.after.samples.every(sample=>sample.currentMa===0));
  assert.equal(app.snapshot().sourceComparison,null,'unconnected D2 has no voltage to pair');
  delete circuit.board.mount;
  app.record(next.runUntilDelay());
  assert.equal(app.snapshot().ledTrace.comparison,null,'a different mounted circuit breaks the pair');
});

test('source comparison leaves a gap when the Uno D13 input loses its reference', async () => {
  const {files,circuit}=makeD13PullupExercise('uno-r3');
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  app.inspectPin('D13');
  assert.equal(await app.ensureRuntime(),true);
  app.record(app.snapshot().runtime.runUntilDelay());
  assert.ok(app.snapshot().sourceObserved.sample.voltage>4.99);

  files['sketch.ino']=files['sketch.ino'].replace('pinMode(TEST_PIN, INPUT_PULLUP)','pinMode(TEST_PIN, INPUT)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  app.record(app.snapshot().runtime.runUntilDelay());
  const floating=app.snapshot();
  assert.equal(floating.sourceComparison.after,null);
  assert.ok(floating.sourceTraceComparison.trace.after.samples.length);
  assert.ok(floating.sourceTraceComparison.trace.after.samples.every(sample=>sample.voltage===null));

  circuit.components.find(part=>part.id==='button1').pressed=true;
  app.record(app.snapshot().runtime.runUntilDelay());
  const grounded=app.snapshot();
  assert.equal(grounded.sourceTraceComparison,null,'moving the switch changes the electrical conditions');
  assert.ok(grounded.sourceObserved.sample.voltage<.01);
});

test('same Nano ADC reading can produce different LED output after a threshold edit', async () => {
  const {files,circuit}=makeBoardStarter('nano','adc');
  circuit.components.find(part=>part.type==='pot').position=.7;
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  app.inspectPin('A0');
  assert.equal(await app.ensureRuntime(),true);
  app.record(app.snapshot().runtime.runUntilDelay());
  const before=app.snapshot().sourceObserved.sample;
  assert.equal(before.adc.raw,716);
  assert.equal(before.adc.max,1023);
  assert.ok(app.snapshot().result.parts.led1.currentMa>5);
  const read=sourceSignalActivity(app.snapshot().lastState,'A0');
  assert.match(files['sketch.ino'].split('\n')[read.adc.line-1],/analogRead/);

  files['sketch.ino']=files['sketch.ino'].replace('adcValue > 512','adcValue > 800');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  app.record(app.snapshot().runtime.runUntilDelay());
  const {sourceComparison,result}=app.snapshot();
  assert.equal(sourceComparison.after.adc.raw,before.adc.raw);
  assert.equal(sourceComparison.after.voltage,before.voltage);
  assert.equal(result.parts.led1.currentMa,0);
});

test('draft edits and rejected application retain the applied circuit, time, and waveform', async () => {
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset),sim=new CircuitSimulator();
  const app=appSourceFixture(files,circuit,sim);
  assert.equal(await app.ensureRuntime(),true);
  const initial=app.snapshot().runtime;
  const first=initial.runUntilDelay(1000);
  assert.equal(first.timeMs,500);
  const measured=sim.solve(circuit,first);
  assert.ok(measured.netVoltages['mcu:PA0']>3);
  assert.ok(measured.parts.led1.displayBrightness>0.3);
  app.record(first);

  files['main.c']=blink.files['main.c'].replace('Delay_ms(500);','Delay_ms(;');
  app.sourceDraftChanged();
  assert.equal(app.snapshot().running,false);
  assert.equal(app.snapshot().sourcePending,true);
  assert.equal(await app.ensureRuntime(),false);
  const rejected=app.snapshot();
  assert.ok(rejected.errors.length);
  assert.equal(rejected.runtime,initial);
  assert.equal(rejected.lastState,first);
  assert.equal(rejected.history.at(-1),500);
  assert.equal(rejected.serialText,'preserve me');
  assert.equal(rejected.appliedSource['main.c'],blink.files['main.c']);
  assert.equal(rejected.sourceObserved.sample.timeMs,500);
  assert.equal(rejected.sourceComparison,null);

  files['main.c']=blink.files['main.c'];
  app.sourceDraftChanged();
  assert.equal(app.snapshot().sourcePending,false);
  assert.equal(await app.ensureRuntime(),true);
  assert.equal(app.snapshot().runtime,initial);
  assert.equal(app.snapshot().sourceObserved,rejected.sourceObserved);

  files['main.c']=blink.files['main.c'].replace('GPIO_SetBits','GPIO_ResetBits').replaceAll('Delay_ms(500)','Delay_ms(200)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  const changed=app.snapshot();
  assert.notEqual(changed.runtime,initial);
  assert.equal(changed.sourcePending,false);
  assert.equal(changed.lastState.timeMs,0);
  assert.equal(changed.history.length,0);
  assert.equal(changed.serialText,'');
  assert.equal(changed.sourceComparison.before.timeMs,500);
  assert.equal(changed.sourceComparison.before.waitMs,500);
  assert.equal(changed.sourceComparison.after,null);
  const after=changed.runtime.runUntilDelay(1000);
  const signal=sourceSignalActivity(after,'PA0');
  const afterMeasurement=sim.solve(circuit,after);
  assert.equal(after.timeMs,200);
  assert.equal(signal.wait.durationMs,200);
  assert.equal(signal.write.value,0);
  assert.equal(signal.write.file,'main.c');
  assert.match(files['main.c'].split('\n')[signal.write.line-1],/GPIO_ResetBits/);
  assert.ok(afterMeasurement.netVoltages['mcu:PA0']<0.01);
  assert.equal(afterMeasurement.parts.led1.displayBrightness,0);
  app.record(after);
  const comparison=app.snapshot().sourceComparison;
  assert.equal(comparison.after.timeMs,200);
  assert.equal(comparison.after.waitMs,200);
  assert.ok(comparison.before.voltage>3);
  assert.ok(comparison.after.voltage<0.01);
  assert.equal(comparison.before.light.id,comparison.after.light.id);
  assert.ok(comparison.before.light.brightness>0.3);
  assert.equal(comparison.after.light.brightness,0);
  app.record(changed.runtime.runUntilDelay());
  assert.equal(app.snapshot().sourceComparison.after.timeMs,200,'paired sample should not oscillate');

  files['main.c']='int main(void) { error';
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),false);
  assert.equal(app.snapshot().sourceComparison,comparison,'invalid subsequent draft leaves the last pair intact');
  app.inspectPin('PA1');
  assert.equal(app.snapshot().sourceComparison,null);
});

test('comparison requires the same electrical circuit and ignores purely visual edits', () => {
  const profile=getBoardProfile('bluepill'),circuit=createCircuit('plugged-button');
  const baseline=sourceCircuitKey(circuit,profile);
  const visual=structuredClone(circuit);
  visual.board.x++;
  visual.breadboard.z++;
  visual.components[0].hidden=true;
  visual.components[0].displayName='换了标签';
  visual.components.reverse();
  visual.wires.reverse();
  for (const wire of visual.wires) {
    [wire.a,wire.b]=[wire.b,wire.a];
    wire.color='black';
  }
  assert.equal(sourceCircuitKey(visual,profile),baseline);

  const parameter=structuredClone(circuit);
  parameter.components.find(part=>part.type==='resistor').resistance=470;
  assert.notEqual(sourceCircuitKey(parameter,profile),baseline);
  const open=structuredClone(circuit);
  open.wires.pop();
  assert.notEqual(sourceCircuitKey(open,profile),baseline);
  const moved=structuredClone(circuit);
  moved.components.find(part=>part.type==='button').mount.hole='bb:f24';
  assert.notEqual(sourceCircuitKey(moved,profile),baseline);
  assert.notEqual(sourceCircuitKey({...circuit,powered:false},profile),baseline);

  const pressed=structuredClone(circuit);
  pressed.components.find(part=>part.type==='button').pressed=true;
  assert.notEqual(sourceCircuitKey(pressed,profile),baseline,'a button wired across the gutter is an input');
  const loose=makePart('button','loose-button');
  circuit.components.push(loose);
  const looseBaseline=sourceCircuitKey(circuit,profile);
  loose.pressed=true;
  assert.equal(sourceCircuitKey(circuit,profile),looseBaseline,'a disconnected button has no electrical effect');
});

test('changing electrical parameters before applying a draft discards the old execution sample', async () => {
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset);
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  assert.equal(await app.ensureRuntime(),true);
  app.record(app.snapshot().runtime.runUntilDelay());
  assert.ok(app.snapshot().sourceObserved);

  files['main.c']=files['main.c'].replaceAll('Delay_ms(500)','Delay_ms(200)');
  app.sourceDraftChanged();
  circuit.components.find(part=>part.type==='resistor').resistance=470;
  assert.equal(await app.ensureRuntime(),true);
  assert.equal(app.snapshot().sourceComparison,null);
  assert.equal(app.snapshot().sourceTraceComparison,null);
});

test('applied source revisions compare actual first-window voltage samples after a long run', async () => {
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset);
  const sim=new CircuitSimulator(),sampled=[];
  const sampleAtCurrentTime=sim.sampleAtCurrentTime.bind(sim);
  sim.sampleAtCurrentTime=(setup,state)=>{sampled.push(state.timeMs);return sampleAtCurrentTime(setup,state);};
  const app=appSourceFixture(files,circuit,sim);
  assert.equal(await app.ensureRuntime(),true);
  const oldProgram=app.snapshot().runtime;
  for(let frame=0;frame<13;frame++)app.record(oldProgram.runUntilDelay());
  const oldTrace=app.snapshot().sourceTrace.trace;
  assert.equal(app.snapshot().lastState.timeMs,6500);
  assert.equal(oldTrace.samples[0].timeMs,0);
  assert.equal(oldTrace.sampledThroughMs,5000);
  assert.equal(oldTrace.samples.length,11);
  assert.deepEqual(sampled,[0,500,1000,1500,2000,2500,3000,3500,4000,4500,5000]);
  assert.ok(oldTrace.samples[0].voltage>3);
  assert.ok(oldTrace.samples[1].voltage<0.01);

  files['main.c']=blink.files['main.c'].replace('Delay_ms(500);','Delay_ms(;');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),false);
  assert.equal(app.snapshot().sourceTrace.trace,oldTrace);
  assert.equal(app.snapshot().sourceTraceComparison,null);

  files['main.c']=blink.files['main.c'].replaceAll('Delay_ms(500)','Delay_ms(200)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  const comparison=app.snapshot().sourceTraceComparison.trace;
  assert.equal(comparison.pin,'PA0');
  assert.equal(comparison.windowMs,5000);
  assert.equal(comparison.before,oldTrace);
  assert.deepEqual(comparison.after,{samples:[],sampledThroughMs:null});
  const newProgram=app.snapshot().runtime;
  for(let frame=0;frame<3;frame++)app.record(newProgram.runUntilDelay());
  assert.deepEqual(comparison.after.samples.map(sample=>sample.timeMs),[0,200,400,600]);
  assert.equal(comparison.after.sampledThroughMs,600);
  assert.ok(comparison.after.samples[0].voltage>3);
  assert.ok(comparison.after.samples[1].voltage<0.01);
  assert.equal(comparison.before.sampledThroughMs,5000);

  app.inspectPin('PA1');
  assert.equal(app.snapshot().sourceTraceComparison,null);
  assert.equal(app.snapshot().sourceTrace,null);

  app.inspectPin('PA0');
  app.record(newProgram.runUntilDelay());
  files['main.c']=files['main.c'].replaceAll('Delay_ms(200)','Delay_ms(400)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  assert.ok(app.snapshot().sourceTraceComparison);
  assert.equal(await app.resetBoardHardware(),true);
  assert.equal(app.snapshot().sourceTraceComparison,null);
});

test('a staged delay sample is discarded on failure and stale or capped runtimes do not probe',async()=>{
  const blink=examples.find(example=>example.id==='blink');
  const files={'main.c':blink.files['main.c'].replaceAll('Delay_ms(500)','Delay_ms(1)')};
  const circuit=createCircuit(blink.circuitPreset),sim=new CircuitSimulator(),attempts=[];
  const sampleAtCurrentTime=sim.sampleAtCurrentTime.bind(sim);
  sim.sampleAtCurrentTime=(setup,state)=>{attempts.push(state.timeMs);return sampleAtCurrentTime(setup,state);};
  const app=appSourceFixture(files,circuit,sim);
  assert.equal(await app.ensureRuntime(),true);
  const firstProgram=app.snapshot().runtime,frame=firstProgram.runUntilDelay();
  assert.equal(app.snapshot().sourceDelaySample.timeMs,0);
  assert.equal(sim.lastResult,null,'an observer solve must not replace the authoritative circuit result');
  app.record({...frame,error:{code:'FAILED'}});
  assert.equal(app.snapshot().sourceTrace,null);
  assert.equal(app.snapshot().sourceDelaySample,null);
  app.record(frame);
  const trace=app.snapshot().sourceTrace.trace;
  assert.deepEqual(trace.samples.map(point=>point.timeMs),[1]);

  trace.samples=Array.from({length:sourceTraceMaxSamples},(_,index)=>({timeMs:index/(sourceTraceMaxSamples-1),voltage:3.3}));
  app.record(firstProgram.runUntilDelay());
  assert.deepEqual(attempts,[0],'the next boundary requires no solver work at the point cap');
  files['main.c']=files['main.c'].replaceAll('Delay_ms(1)','Delay_ms(2)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  firstProgram.runUntilDelay();
  assert.deepEqual(attempts,[0],'a replaced interpreter cannot add samples');
});

test('red minus black waveforms preserve the exact pair through a validated code revision',async()=>{
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset),sim=new CircuitSimulator();
  const isolated=[],sampleAtCurrentTime=sim.sampleAtCurrentTime.bind(sim);
  sim.sampleAtCurrentTime=(setup,state)=>{isolated.push(state.timeMs);return sampleAtCurrentTime(setup,state);};
  const app=appSourceFixture(files,circuit,sim);
  app.attachProbes('led1:A','led1:K');
  assert.equal(await app.ensureRuntime(),true);
  const oldProgram=app.snapshot().runtime;
  app.record(oldProgram.runUntilDelay());
  app.record(oldProgram.runUntilDelay());
  const previous=app.snapshot();
  const prior=previous.probeTrace.current;
  assert.deepEqual(prior.samples.map(point=>point.timeMs),[0,500,1000]);
  assert.ok(prior.samples[0].voltage>1.9&&prior.samples[0].voltage<2.1,'actual LED terminal difference');
  assert.ok(prior.samples[1].voltage<.01);
  assert.ok(previous.sourceTrace.trace.samples[0].voltage>3,'GPIO trace still measures its own observation pin');
  assert.deepEqual(isolated,[0,500],'GPIO and the differential use one isolated solve per wait boundary');

  files['main.c']=blink.files['main.c'].replace('Delay_ms(500);','Delay_ms(;');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),false);
  assert.equal(app.snapshot().probeTrace.current,prior);
  files['main.c']=blink.files['main.c'].replaceAll('Delay_ms(500)','Delay_ms(200)');
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),true);
  const program=app.snapshot().runtime,comparison=app.snapshot().probeTrace.comparison;
  assert.equal(comparison.before,prior);
  assert.equal(comparison.red,'led1:A');
  assert.equal(comparison.black,'led1:K');
  for(let frame=0;frame<3;frame++)app.record(program.runUntilDelay());
  assert.deepEqual(comparison.after.samples.map(point=>point.timeMs),[0,200,400,600]);
  assert.ok(comparison.after.samples[1].voltage<.01);
  assert.ok(comparison.after.samples[2].voltage>1.9);
  assert.deepEqual(isolated,[0,500,0,200,400]);

  app.attachProbes('led1:K','led1:A');
  assert.equal(app.snapshot().probeTrace.comparison,null);
  assert.equal(app.snapshot().probeTrace.current.samples.length,0);
  app.record(program.runUntilDelay());
  app.record(program.runUntilDelay());
  assert.ok(app.snapshot().probeTrace.current.samples.some(point=>point.voltage< -1.9));
  circuit.components.find(part=>part.type==='resistor').resistance=680;
  app.inspectPin('PA0');
  assert.equal(app.snapshot().probeTrace.current.samples.length,0);
});

test('probe waveform records missing samples on fault or floating conditions without filling the GPIO trace',async()=>{
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset),app=appSourceFixture(files,circuit,new CircuitSimulator());
  app.attachProbes('mcu:PA0','mcu:GND1');
  assert.equal(await app.ensureRuntime(),true);
  const program=app.snapshot().runtime;
  app.record({...program.runUntilDelay(),error:{code:'TEST_FAULT'}});
  assert.deepEqual(app.snapshot().probeTrace.current.samples,[{timeMs:500,voltage:null}]);
  assert.equal(app.snapshot().sourceTrace,null,'the failed frame does not insert a GPIO reading');

  app.attachProbes('mcu:PB0','mcu:GND1');
  app.record(program.runUntilDelay());
  assert.deepEqual(app.snapshot().probeTrace.current.samples,[{timeMs:500,voltage:null},{timeMs:1000,voltage:null}]);
  assert.ok(app.snapshot().sourceTrace.trace.samples.every(point=>Number.isFinite(point.voltage)));
});

test('probe boundary budget remains independent when GPIO capture is full',async()=>{
  const blink=examples.find(example=>example.id==='blink');
  const circuit=createCircuit(blink.circuitPreset),sim=new CircuitSimulator();
  const calls=[],sampleAtCurrentTime=sim.sampleAtCurrentTime.bind(sim);
  sim.sampleAtCurrentTime=(setup,state)=>{calls.push(state.timeMs);return sampleAtCurrentTime(setup,state);};
  const app=appSourceFixture({...blink.files},circuit,sim);
  app.attachProbes('mcu:PA0','mcu:GND1');
  assert.equal(await app.ensureRuntime(),true);
  const program=app.snapshot().runtime;
  app.record(program.runUntilDelay());
  const pinTrace=app.snapshot().sourceTrace.trace;
  pinTrace.samples=Array.from({length:sourceTraceMaxSamples},(_,index)=>({timeMs:index*500/(sourceTraceMaxSamples-1),voltage:3.3}));
  app.record(program.runUntilDelay());
  assert.deepEqual(calls,[0,500]);
  assert.equal(pinTrace.samples.at(-1).voltage,3.3,'probe-only sampling does not replace the last GPIO reading');
  const probes=app.snapshot().probeTrace.current;
  assert.deepEqual(probes.samples.map(point=>point.timeMs),[0,500,1000]);
  assert.ok(probes.samples[1].voltage<.01);
});

test('board RESET boots only the applied source and the dedicated action still applies a valid running draft', async () => {
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset),savedCircuit=structuredClone(circuit);
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  assert.equal(await app.resetBoardHardware(),false);
  assert.match(app.snapshot().resetStatus,/尚无已应用的程序/);
  assert.equal(app.snapshot().compiles,0);
  assert.equal(await app.ensureRuntime(),true);
  const original=app.snapshot().runtime;
  original.runUntilDelay();
  app.record(original.runUntilDelay());
  assert.equal(app.snapshot().lastState.timeMs,1000);

  const invalid=files['main.c'].replace('Delay_ms(500);','Delay_ms(;');
  files['main.c']=invalid;
  app.sourceDraftChanged();
  assert.equal(await app.ensureRuntime(),false);
  const rejected=app.snapshot();
  assert.equal(await app.resetBoardHardware(),true);
  const restarted=app.snapshot();
  assert.notEqual(restarted.runtime,original);
  assert.equal(restarted.lastState.timeMs,500);
  assert.ok(restarted.result.parts.led1.brightness>0.3);
  assert.equal(restarted.compiles,rejected.compiles);
  assert.equal(restarted.errors,rejected.errors);
  assert.equal(files['main.c'],invalid);
  assert.equal(restarted.running,true);
  assert.equal(restarted.sourcePending,true);
  assert.deepEqual(circuit,savedCircuit);

  assert.equal(await app.applySourceDraft(),false);
  assert.equal(app.snapshot().runtime,restarted.runtime);
  assert.equal(app.snapshot().running,true);
  await app.toggleRun();
  assert.equal(app.snapshot().running,false,'top Run keeps its Pause action');

  const valid=blink.files['main.c'].replace('GPIO_SetBits','GPIO_ResetBits').replaceAll('Delay_ms(500)','Delay_ms(200)');
  files['main.c']=valid;
  app.sourceDraftChanged();
  assert.equal(await app.resetBoardHardware(),true);
  assert.equal(app.snapshot().running,true);
  assert.equal(await app.applySourceDraft(),true);
  assert.equal(app.snapshot().sourcePending,false);
  assert.equal(app.snapshot().lastState.timeMs,200);
  assert.equal(app.snapshot().result.parts.led1.brightness,0);
  assert.equal(app.snapshot().programmedSource.files['main.c'],valid);
});

test('toolbar reset preserves the programmed image while a physical reset respects power and BOOT0', async () => {
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files},circuit=createCircuit(blink.circuitPreset);
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  assert.equal(await app.ensureRuntime(),true);
  files['main.c']=files['main.c'].replaceAll('Delay_ms(500)','Delay_ms(200)');
  app.sourceDraftChanged();
  app.resetRuntime({preserveProgrammed:true});
  assert.equal(app.snapshot().runtime,null);
  assert.equal(app.snapshot().appliedSource,null);

  circuit.powered=false;
  assert.equal(await app.resetBoardHardware(),false);
  assert.match(app.snapshot().resetStatus,/未供电/);
  circuit.powered=true;circuit.boot0=true;
  assert.equal(await app.resetBoardHardware(),false);
  assert.match(app.snapshot().resetStatus,/BOOT0=1/);
  circuit.boot0=false;
  assert.equal(await app.resetBoardHardware(),true);
  assert.equal(app.snapshot().lastState.timeMs,500);
  assert.equal(app.snapshot().sourcePending,true);

  app.resetRuntime();
  assert.equal(await app.resetBoardHardware(),false,'workspace reset clears the previous workspace image');
  assert.equal(await app.toggleRun(),true);
  assert.equal(app.snapshot().lastState.timeMs,200,'normal Run still uses the draft');
});

test('UNO hardware RESET boots active native firmware and an interrupted reload cannot restart it', async () => {
  const {files,circuit}=makeBoardStarter('uno-r3','blink');
  const app=appSourceFixture(files,circuit,new CircuitSimulator());
  const hex=readFileSync(new URL('../dist/firmware/uno-r3/blink.hex',import.meta.url),'utf8');
  app.loadFirmware(parseAvrHex(hex));
  const interrupted=app.resetBoardHardware();
  app.resetRuntime();
  assert.equal(await interrupted,false);
  assert.equal(app.snapshot().runtime,null);

  assert.equal(await app.resetBoardHardware(),true);
  const first=app.snapshot();
  assert.equal(first.running,true);
  assert.ok(first.lastState.cycles>0);
  assert.match(first.resetStatus,/复位入口重新启动固件/);
  first.runtime.advanceTime(25);
  assert.equal(await app.resetBoardHardware(),true);
  assert.notEqual(app.snapshot().runtime,first.runtime);
  assert.equal(app.snapshot().lastState.cycles,first.lastState.cycles);
  assert.equal(app.snapshot().compiles,0);
});

test('source signal activity distinguishes actual writes and timing on the observed pin', () => {
  const blink=examples.find(example=>example.id==='blink');
  const files={...blink.files,'notes.h':'// a header'};
  assert.equal(sameSourceFiles(files,{'notes.h':files['notes.h'],'main.c':files['main.c']}),true);
  assert.equal(sameSourceFiles(files,blink.files),false);
  const runtime=createBoardRuntime(compileForBoard(blink.files,'bluepill'));
  runtime.runUntilDelay();
  const after=runtime.runUntilDelay(),signal=sourceSignalActivity(after,'PA0');
  assert.equal(signal.intervalMs,500);
  assert.equal(signal.write.value,0);
  assert.equal(signal.wait.durationMs,500);
  assert.notEqual(signal.write.line,signal.wait.line);
  assert.equal(sourceSignalActivity(after,'PA1').write,undefined);

  const pwmStarter=makeBoardStarter('uno-r3','pwm');
  const pwmRuntime=createBoardRuntime(compileForBoard(pwmStarter.files,'uno-r3'));
  const pwmState=pwmRuntime.runUntilDelay(),pwmSignal=sourceSignalActivity(pwmState,pwmStarter.ledPin);
  assert.ok(pwmState.pins[pwmStarter.ledPin].pwm);
  assert.equal(pwmSignal.pwm.pin,pwmStarter.ledPin);
  assert.match(pwmStarter.files['sketch.ino'].split('\n')[pwmSignal.pwm.line-1],/analogWrite/);
});

test('applying a different HS-55 pulse keeps the actual shaft position and then moves toward the new target', async () => {
  const {files,circuitPreset}=examples.find(example=>example.id==='servo-hs55');
  const draft={...files},circuit=createCircuit(circuitPreset),sim=new CircuitSimulator();
  const app=appSourceFixture(draft,circuit,sim,{sliceMs:16});
  assert.equal(await app.toggleRun(),true);
  let snapshot=app.snapshot();
  assert.equal(snapshot.lastState.timeMs,16);
  assert.equal(snapshot.result.parts.servo1.targetAngle,60);
  assert.ok(snapshot.result.parts.servo1.angle<90&&snapshot.result.parts.servo1.angle>60,'starts moving in the first wait');
  for(let i=0;i<16;i++)app.record(snapshot.runtime.runSlice(16));
  snapshot=app.snapshot();
  assert.equal(snapshot.result.parts.servo1.angle,60);
  const wiring=structuredClone(circuit.wires);

  draft['main.c']=draft['main.c'].replace('#define COMMAND_US 1200','#define COMMAND_US 1800');
  app.sourceDraftChanged();
  assert.equal(app.snapshot().result.parts.servo1.angle,60,'editing alone keeps the applied mechanical output');
  assert.equal(await app.applySourceDraft(),true);
  snapshot=app.snapshot();
  assert.equal(snapshot.result.parts.servo1.targetAngle,120);
  assert.ok(snapshot.result.parts.servo1.angle>60&&snapshot.result.parts.servo1.angle<70,'new code moves from the old angle');
  for(let i=0;i<16;i++)app.record(snapshot.runtime.runSlice(16));
  snapshot=app.snapshot();
  assert.equal(snapshot.result.parts.servo1.angle,120);
  assert.deepEqual(circuit.wires,wiring);
  assert.equal(snapshot.sourceComparison.before.servo.pulseUs,1200);
  assert.equal(snapshot.sourceComparison.after.servo.targetAngle,120);
});

test('completing a long wait still integrates capacitor charge before the next source instruction',async()=>{
  const lesson=makePassiveBreadboardExercises().find(example=>example.id==='plugged-rc');
  const open=async()=>{
    const app=appSourceFixture(lesson.files,structuredClone(lesson.circuitData),new CircuitSimulator(),{sliceMs:0});
    assert.equal(await app.toggleRun(),true);
    return app;
  };
  const skipped=await open(),normal=await open();
  const steps=skipped.snapshot().lastState.executedSteps;
  const runtime=normal.snapshot().runtime;
  assert.equal(skipped.snapshot().lastState.pendingDelay.remainingMs,3000);
  skipped.stepWait();
  while(normal.snapshot().lastState.pendingDelay)normal.record(runtime.runSlice(16));
  const end=skipped.snapshot();
  assert.equal(end.lastState.timeMs,3000);
  assert.equal(end.lastState.executedSteps,steps);
  assert.equal(end.lastState.pendingDelay,undefined);
  assert.ok(end.result.parts.c1.voltage>3.11);
  assert.ok(Math.abs(end.result.parts.c1.voltage-normal.snapshot().result.parts.c1.voltage)<.025);
});

test('PWM filter code revisions preserve charge and separate duty changes from frequency changes',async()=>{
  const lesson=makePassiveBreadboardExercises().find(example=>example.id==='pwm-rc');
  const files={...lesson.files},circuit=structuredClone(lesson.circuitData);
  const app=appSourceFixture(files,circuit,new CircuitSimulator(),{sliceMs:0});
  app.inspectPin('PA1');
  assert.equal(await app.toggleRun(),true);
  function sample(frames){
    const {runtime}=app.snapshot();
    for(let i=0;i<frames;i++)app.record(runtime.runSlice(16));
    return app.snapshot().result.parts.c1;
  }
  const old=sample(45),beforeWiring=structuredClone(circuit.wires);
  assert.ok(old.voltage>.78&&old.voltage<.87);
  assert.ok(Math.abs(old.pwmRc.voltageMean-.825)<1e-8);
  files['main.c']=files['main.c'].replace('#define DUTY_PERCENT 25','#define DUTY_PERCENT 75');
  app.sourceDraftChanged();
  assert.equal(app.snapshot().result.parts.c1.voltage,old.voltage);
  assert.equal(await app.applySourceDraft(),true);
  const first=app.snapshot().result.parts.c1;
  assert.ok(Math.abs(first.voltage-old.voltage)<1e-6);
  assert.ok(Math.abs(first.pwmRc.voltageMean-2.475)<1e-8);
  const transition=sample(4);
  assert.ok(transition.voltage>old.voltage&&transition.voltage<2.4);
  const highDuty=sample(45);
  assert.ok(highDuty.voltage>2.43&&highDuty.voltage<2.52);
  assert.equal(app.snapshot().sourceComparison.before.pwmRc.duty,.25);
  assert.equal(app.snapshot().sourceComparison.after.pwmRc.duty,.75);

  files['main.c']=files['main.c'].replace('#define PWM_HZ 100','#define PWM_HZ 1000');
  app.sourceDraftChanged();
  assert.equal(await app.applySourceDraft(),true);
  const faster=sample(8).pwmRc;
  assert.equal(faster.frequencyHz,1000);
  assert.equal(faster.voltageMean,highDuty.pwmRc.voltageMean);
  assert.ok(faster.ripplePp<highDuty.pwmRc.ripplePp*.11);
  assert.deepEqual(circuit.wires,beforeWiring);
});

test('the mounted seven-segment lesson follows edited GPIO code with the same physical circuit',async()=>{
  const lesson=makeSevenSegmentLesson(), files={...lesson.files};
  const {circuit}=parseLabProject({version:2,files,circuit:lesson.circuitData,activeFile:'main.c'});
  const initial=structuredClone(circuit);
  const app=appSourceFixture(files,circuit,new CircuitSimulator(),{sliceMs:0,example:lesson});
  const sample=()=>{
    app.record(app.snapshot().runtime.runSlice(16));
    return readSevenSegment('display1',app.snapshot().result.parts.display1);
  };
  assert.equal(await app.toggleRun(),true);
  const two=sample();
  assert.equal(two.digit,2);
  assert.deepEqual(two.on,['a','b','d','e','g']);
  assert.ok(Math.abs(two.segments[0].currentMa-(3.3-1.9)/387*1000)<.001);
  files['main.c']=files['main.c'].replace('#define DISPLAY_DIGIT 2','#define DISPLAY_DIGIT 7');
  app.sourceDraftChanged();
  assert.equal(readSevenSegment('display1',app.snapshot().result.parts.display1).digit,2);
  assert.equal(await app.applySourceDraft(),true);
  assert.deepEqual(sample().on,['a','b','c']);
  assert.equal(app.snapshot().sourceComparison.before.sevenSegment.digit,2);
  assert.equal(app.snapshot().sourceComparison.after.sevenSegment.digit,7);
  files['main.c']=files['main.c'].replace('#define DECIMAL_POINT 0','#define DECIMAL_POINT 1');
  app.sourceDraftChanged();
  assert.equal(await app.applySourceDraft(),true);
  assert.deepEqual(sample().on,['a','b','c','dp']);
  assert.equal(app.snapshot().sourceComparison.before.sevenSegment.decimal,false);
  assert.equal(app.snapshot().sourceComparison.after.sevenSegment.decimal,true);
  assert.deepEqual(circuit,initial);
});

test('motor stop curves align at the same GPIO instruction and braking draws reverse winding current',async()=>{
  const lesson=makeMotorBridgeLesson(),files={...lesson.files};
  const {circuit}=parseLabProject({version:2,files,circuit:lesson.circuitData,activeFile:'main.c'});
  const beforeWiring=structuredClone(circuit);
  const app=appSourceFixture(files,circuit,new CircuitSimulator(),{sliceMs:0,example:lesson});
  const advance=frames=>{
    const {runtime}=app.snapshot();
    for(let i=0;i<frames;i++)app.record(runtime.runSlice(16));
    return app.snapshot();
  };
  assert.equal(await app.toggleRun(),true);
  const coastRun=advance(59);
  const coast=coastRun.motorTrace.current;
  assert.equal(coast.mode,'coast');
  assert.equal(coast.startMs,750);
  assert.equal(coast.samples[0].ms,0);
  assert.ok(coast.samples[0].rpm>10000);
  assert.ok(Math.abs(coast.samples[0].currentMa)<.001);

  const savedRpm=coastRun.result.parts.motor1.rpm;
  files['main.c']=files['main.c'].replace('#define BRAKE_AT_STOP 0','#define BRAKE_AT_STOP 1');
  app.sourceDraftChanged();
  assert.equal(await app.applySourceDraft(),true);
  assert.ok(Math.abs(app.snapshot().result.parts.motor1.rpm-savedRpm)<.001);
  const brakeRun=advance(59),brake=brakeRun.motorTrace.current;
  assert.equal(brakeRun.motorTrace.before,coast);
  assert.equal(brake.mode,'brake');
  assert.equal(brake.startMs,750);
  assert.ok(brake.samples[0].currentMa< -200);
  const at100=trace=>trace.samples.find(sample=>sample.ms>=100).rpm;
  assert.ok(at100(brake)<at100(coast)*.5);

  files['main.c']=files['main.c'].replace('#define TURN_REVERSE 0','#define TURN_REVERSE 1');
  app.sourceDraftChanged();
  assert.equal(await app.applySourceDraft(),true);
  assert.ok(advance(20).result.parts.motor1.rpm< -9000);
  assert.deepEqual(circuit,beforeWiring);
});

test('UNO sonar thresholds compare only after the GPIO alarm write, on the same target and wires',async()=>{
  const lesson=makeUltrasonicLesson(),files={...lesson.files},file=Object.keys(files)[0];
  const {circuit}=parseLabProject({version:2,files,circuit:lesson.circuitData,activeFile:file});
  const initial=structuredClone(circuit);
  const app=appSourceFixture(files,circuit,new CircuitSimulator(),{sliceMs:0,example:lesson});
  app.inspectPin('D12');
  const advance=()=>{
    const {runtime}=app.snapshot();
    for(let i=0;i<38;i++)app.record(runtime.runSlice(12));
    return app.snapshot();
  };
  assert.equal(await app.toggleRun(),true);
  const old=advance();
  assert.equal(old.lastState.variables.measuredEchoUs,4665);
  assert.equal(old.lastState.variables.measuredCm,80);
  assert.equal(old.result.parts.led1.currentMa,0);
  files[file]=files[file].replace('#define ALARM_CM 60','#define ALARM_CM 100');
  app.sourceDraftChanged();
  assert.equal(await app.applySourceDraft(),true);
  assert.equal(app.snapshot().sourceComparison.after,null);
  const next=advance(),{before,after}=next.sourceComparison;
  assert.equal(before.sonar.cm,80);
  assert.equal(after.sonar.widthUs,4665);
  assert.equal(before.light.currentMa,0);
  assert.ok(after.light.currentMa>7);
  assert.deepEqual(circuit,initial);

  files[file]=files[file].replace('#define TRIGGER_US 10','#define TRIGGER_US 5');
  app.sourceDraftChanged();
  assert.equal(await app.applySourceDraft(),true);
  const timeout=advance();
  assert.equal(timeout.lastState.variables.measuredEchoUs,0);
  assert.equal(timeout.lastState.variables.measuredCm,-1);
  assert.equal(timeout.result.parts.led1.currentMa,0);
});

test('UNO Wire edits change the powered OLED only when the address and both signal wires reach it',async()=>{
  const lesson=makeI2cOledLesson(),files={...lesson.files},file=Object.keys(files)[0];
  const {circuit}=parseLabProject({version:2,files,circuit:lesson.circuitData,activeFile:file});
  const initial=structuredClone(circuit);
  const app=appSourceFixture(files,circuit,new CircuitSimulator(),{sliceMs:0,example:lesson});
  const advance=()=>{
    const {runtime}=app.snapshot();
    for(let i=0;i<45;i++)app.record(runtime.runSlice(12));
    const {lastState,result}=app.snapshot();
    return {variables:lastState.variables,packet:lastState.events.findLast(event=>event.type==='i2c'),screen:result.parts.oled1};
  };
  const apply=async(from,to)=>{
    files[file]=files[file].replace(from,to);
    app.sourceDraftChanged();
    assert.equal(await app.applySourceDraft(),true);
  };
  assert.equal(await app.toggleRun(),true);
  const first=advance();
  assert.equal(first.variables.wireStatus,0);
  assert.equal(first.packet.deviceId,'oled1');
  assert.equal(oledLitPixels(first.screen.framebuffer),748);

  await apply('#define BAR_COLUMNS 40','#define BAR_COLUMNS 96');
  const wider=advance();
  assert.equal(oledLitPixels(wider.screen.framebuffer),1420);
  assert.deepEqual(circuit,initial);

  await apply('#define OLED_ADDR 0x3D','#define OLED_ADDR 0x3C');
  const wrong=advance();
  assert.equal(wrong.variables.wireStatus,2);
  assert.equal(wrong.variables.framesWritten,0);
  assert.equal(wrong.packet.address,0x3C);
  assert.deepEqual(wrong.screen.framebuffer,wider.screen.framebuffer);

  circuit.wires=circuit.wires.filter(wire=>wire.b!=='oled1:SDA');
  await apply('#define OLED_ADDR 0x3C','#define OLED_ADDR 0x3D');
  const unplugged=advance();
  assert.equal(unplugged.variables.wireStatus,2);
  assert.equal(unplugged.packet.reason,'disconnected');
  assert.deepEqual(unplugged.screen.framebuffer,wider.screen.framebuffer);

  circuit.powered=false;
  assert.equal(advance().screen.powered,false);
  circuit.powered=true;
  assert.equal(oledLitPixels(advance().screen.framebuffer),0);
});

test('the UNO temperature lesson compares program thresholds on unchanged I²C data and fails safe on a broken bus',async()=>{
  const lesson=makeI2cTemperatureLesson(),files={...lesson.files},file=Object.keys(files)[0];
  const {circuit}=parseLabProject({version:2,files,circuit:lesson.circuitData,activeFile:file});
  const sensor=circuit.components[0],sim=new CircuitSimulator();
  sim.solve(circuit,{pins:{},timeMs:0});
  const app=appSourceFixture(files,circuit,sim,{sliceMs:0,example:lesson});
  app.inspectPin('D12');
  const advance=()=>{
    const {runtime}=app.snapshot();
    for(let i=0;i<60;i++)app.record(runtime.runSlice(16));
    return app.snapshot();
  };
  const apply=async(from,to)=>{
    files[file]=files[file].replace(from,to);
    app.sourceDraftChanged();
    assert.equal(await app.applySourceDraft(),true);
  };
  assert.equal(await app.toggleRun(),true);
  const room=advance();
  assert.equal(room.lastState.variables.measuredC,25.25);
  assert.equal(room.result.parts.led1.currentMa,0);

  sensor.temperatureC=34.5;
  const hot=advance(),beforeCircuit=structuredClone(circuit);
  const [write,read]=hot.lastState.events.filter(event=>event.type==='i2c').slice(-2);
  assert.deepEqual([write.direction,write.stop,...write.bytes],['write',false,0x05]);
  assert.deepEqual([read.direction,read.repeatedStart,read.stop,...read.bytes],['read',true,true,0xC2,0x28]);
  assert.equal(hot.lastState.variables.measuredC,34.5);
  assert.ok(hot.result.parts.led1.currentMa>7);

  await apply('#define ALARM_C 30','#define ALARM_C 38');
  const raised=advance();
  assert.deepEqual(circuit,beforeCircuit);
  assert.equal(raised.sourceComparison.before.temperature.measuredC,34.5);
  assert.equal(raised.sourceComparison.after.temperature.word,0xC228);
  assert.equal(raised.result.parts.led1.currentMa,0);

  sensor.temperatureC=-8.5;
  const cold=advance();
  assert.equal(cold.lastState.variables.measuredC,-8.5);
  assert.equal(cold.lastState.variables.temperatureWord,0x3F78);

  sensor.temperatureC=45;
  assert.ok(advance().result.parts.led1.currentMa>7);
  circuit.wires=circuit.wires.filter(wire=>wire.b!=='temp1:SDA');
  const broken=advance();
  assert.equal(broken.lastState.variables.temperatureValid,0);
  assert.equal(broken.lastState.variables.receivedBytes,0);
  assert.equal(broken.lastState.events.findLast(event=>event.type==='i2c').reason,'disconnected');
  assert.equal(broken.result.parts.led1.currentMa,0);
});
