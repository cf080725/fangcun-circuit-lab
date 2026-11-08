import assert from 'node:assert/strict';
import test from 'node:test';
import {nativePwmCycle,sampleNativePwmCycle} from '../dist/native-pwm-scope.js';

const samplePhase={pin:'PA0',frequencyHz:1000,periodMs:1,duty:.25,highFirst:true,
  voltage:{low:.013,high:3.21},led:{lowMa:0,highMa:3.86,averageMa:.965}};

test('native PWM cursor aligns independent resets on the same time axis',()=>{
  const before=nativePwmCycle(samplePhase);
  const after=nativePwmCycle({...samplePhase,frequencyHz:2000,periodMs:.5,duty:.75,highFirst:false});
  assert.equal(before.transitionMs,.25);
  assert.equal(after.transitionMs,.125);
  assert.equal(before.averageMa,.965);
  assert.deepEqual(sampleNativePwmCycle(before,0),{level:'high',voltage:3.21,currentMa:3.86});
  assert.deepEqual(sampleNativePwmCycle(after,0),{level:'low',voltage:.013,currentMa:0});
  assert.deepEqual(sampleNativePwmCycle(after,.125),{level:'high',voltage:3.21,currentMa:3.86});
  assert.equal(sampleNativePwmCycle(before,.25).level,'low');
  assert.equal(sampleNativePwmCycle(after,.5).level,'high');
  assert.equal(sampleNativePwmCycle(after,.5001),null);
  assert.deepEqual(sampleNativePwmCycle(before,.75),{level:'low',voltage:.013,currentMa:0});
});

test('constant PWM shows only the actual reachable level and optional load reading',()=>{
  const low=nativePwmCycle({...samplePhase,duty:0,voltage:{low:.013,high:null},led:null});
  assert.equal(low.transitionMs,null);
  assert.equal(low.voltage.high,null);
  assert.deepEqual(sampleNativePwmCycle(low,1),{level:'low',voltage:.013,currentMa:null});
  const high=nativePwmCycle({...samplePhase,duty:1,highFirst:false,
    voltage:{low:null,high:3.21},led:{lowMa:null,highMa:3.86,averageMa:3.86}});
  assert.equal(high.transitionMs,null);
  assert.equal(high.voltage.low,null);
  assert.deepEqual(sampleNativePwmCycle(high,.61),{level:'high',voltage:3.21,currentMa:3.86});
});

test('unavailable electrical readings and malformed timing never create a curve value',()=>{
  const cycle=nativePwmCycle({...samplePhase,voltage:{low:0,high:null},led:{lowMa:0,highMa:NaN,averageMa:0}});
  assert.equal(cycle.voltage,null);
  assert.equal(cycle.led,null);
  assert.equal(cycle.averageMa,null);
  assert.deepEqual(sampleNativePwmCycle(cycle,.45),{level:'low',voltage:null,currentMa:null});
  assert.equal(sampleNativePwmCycle(cycle,NaN),null);
  assert.equal(sampleNativePwmCycle(cycle,-.001),null);
  for(const phase of [null,{...samplePhase,periodMs:0},{...samplePhase,frequencyHz:Infinity},
    {...samplePhase,duty:1.1},{...samplePhase,highFirst:undefined}]){
    assert.equal(nativePwmCycle(phase),null);
  }
});
