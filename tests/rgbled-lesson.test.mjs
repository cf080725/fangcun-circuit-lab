import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {boardPose,mountedConnections} from '../dist/breadboard-mount.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';
import {rgbLedLessonChannels,rgbLedLessonPart,makeRgbLedLesson} from '../dist/rgbled-lesson.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

test('RGB lesson retains the physical model and all eight prewired routes in saved projects',()=>{
  const {circuitData}=makeRgbLedLesson();
  const circuit=validateCircuit(structuredClone(circuitData));
  const profile=getBoardProfile(circuit.boardId);
  assert.equal(boardPose(circuit,profile).mounted,true);
  assert.deepEqual(circuit.wires,circuitData.wires);
  assert.equal(circuit.wires.length,8);
  const lamp=circuit.components.find(part=>part.id===rgbLedLessonPart);
  assert.equal(lamp.rgbModel,'kingbright-wp154a4');
  assert.equal(lamp.common,'cathode');
  const mounted=new Map(mountedConnections(circuit,profile).map(({a,b})=>[a,b]));
  for(const {pin,column,resistor,resistance} of rgbLedLessonChannels){
    assert.equal(mounted.get(`mcu:${pin}`),`bb:c${column}`);
    assert.equal(circuit.components.find(part=>part.id===resistor).resistance,resistance);
  }
  assert.equal(mounted.get('mcu:GND1'),'bb:g24');
});

test('compiled RGB C changes only selected duties and drives the currents through the seated Blue Pill',async()=>{
  const lesson=makeRgbLedLesson();
  const files=Object.fromEntries(Object.entries(lesson.nativeSourceAssets).map(([name,path])=>[
    name,readFileSync(new URL('../dist/'+path,import.meta.url),'utf8')
  ]));
  const run=async sources=>{
    const {binary,diagnostics}=await compileStm32C(sources,{boardId:lesson.boardId});
    assert.deepEqual(diagnostics,[]);
    const runtime=await createStm32FirmwareRuntime(parseStm32Bin(binary,lesson.boardId),{boardId:lesson.boardId});
    try{
      const state=await runtime.advanceTime(2);
      assert.equal(state.error,null);
      return state;
    }finally{runtime.dispose();}
  };
  const before=await run(files);
  const rgbLevels=files['rgb_levels.h'].replace(/^#define BLUE_PWM_PERMILLE\s+0u$/m,'#define BLUE_PWM_PERMILLE 850u')
    .replace(/^#define GREEN_PWM_PERMILLE\s+0u$/m,'#define GREEN_PWM_PERMILLE 300u');
  const after=await run({...files,'rgb_levels.h':rgbLevels});
  const boardPwm=state=>rgbLedLessonChannels.map(({pin,timerChannel})=>{
    const pwm=state.pins[pin].pwm;
    assert.equal(pwm.channel,timerChannel);
    assert.equal(pwm.timer,2);
    assert.equal(pwm.frequencyHz,1000);
    return pwm.duty;
  });
  assert.deepEqual(boardPwm(before),[.5,0,0]);
  assert.deepEqual(boardPwm(after),[.5,.3,.85]);

  const solver=new CircuitSimulator(),circuit=lesson.circuitData;
  const readings=(c,s)=>solver.solve(c,s).parts[rgbLedLessonPart].channels;
  const original=readings(circuit,before),changed=readings(circuit,after);
  assert(original.R.averageCurrentMa>1);
  assert.equal(original.G.averageCurrentMa,0);
  assert.equal(original.B.averageCurrentMa,0);
  assert.ok(Math.abs(changed.R.averageCurrentMa-original.R.averageCurrentMa)<1e-6);
  assert(changed.G.averageCurrentMa>.2);
  assert(changed.B.averageCurrentMa>1);
  const open={...circuit,wires:circuit.wires.filter(wire=>wire.b!==`${rgbLedLessonPart}:B`)};
  assert.equal(readings(open,after).B.averageCurrentMa,0);
  for(const {channel} of rgbLedLessonChannels)assert.equal(readings({...circuit,powered:false},after)[channel].averageCurrentMa,0);
});
