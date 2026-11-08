import test from 'node:test';
import assert from 'node:assert/strict';
import {createServoTurnTrace,recordServoTurn,servoTurnPath} from '../dist/servo-native-view.js';

test('servo graph begins at the retained physical angle and records measured motion and arrival',()=>{
  const trace=createServoTurnTrace(120);
  assert.equal(recordServoTurn(trace,0,{angle:90}),false);
  assert.equal(recordServoTurn(trace,20,{angle:120,targetAngle:60,currentMa:155,active:true,moving:true}),true);
  assert.equal(recordServoTurn(trace,100,{angle:91,targetAngle:60,currentMa:155,active:true,moving:true}),true);
  assert.equal(recordServoTurn(trace,180,{angle:60,targetAngle:60,currentMa:5.2,active:true,moving:false}),true);
  assert.equal(recordServoTurn(trace,420,{angle:60,targetAngle:60,currentMa:5.2,active:true,moving:false}),false);
  assert.equal(trace.reachedMs,180);
  assert.equal(trace.peakMa,155);
  assert.match(servoTurnPath(trace.samples,'angle'),/^M36\.00,25\.00 .*L177\.30,61\.00$/);
  assert.match(servoTurnPath(trace.samples,'targetAngle').trimStart(),/^M51\.70,61\.00 /);
});

test('an unchanged or interrupted command never reports a turn arrival',()=>{
  const trace=createServoTurnTrace(120);
  recordServoTurn(trace,20,{angle:120,targetAngle:120,active:true,moving:false});
  recordServoTurn(trace,40,{angle:120,targetAngle:null,active:false,moving:false});
  assert.equal(trace.reachedMs,null);
  assert.equal(trace.peakMa,null);
  recordServoTurn(trace,60,{angle:120,targetAngle:60,active:true,moving:true});
  assert.equal(servoTurnPath(trace.samples,'targetAngle').match(/M/g).length,2);
});
