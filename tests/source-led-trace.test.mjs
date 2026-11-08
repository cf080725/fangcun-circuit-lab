import assert from 'node:assert/strict';
import test from 'node:test';
import {createSourceLedTrace} from '../dist/source-led-trace.js';
import {nearestSourceSample,sourceTraceMaxSamples,sourceTraceWindowMs} from '../dist/source-trace.js';

const target={key:'nano-led-branch',id:'led1'};

test('LED samples use the first committed reading as time zero and distinguish zero current from a gap',()=>{
  const trace=createSourceLedTrace();
  trace.sync(target);
  assert.equal(trace.current.originMs,null);
  assert.equal(trace.capture(-1,0),null);
  assert.equal(trace.capture(7000,NaN),null);
  const uncommitted=trace.capture(6000,8.25);
  assert.equal(trace.current.originMs,null);
  trace.record(trace.capture(7100,8.25));
  trace.record(uncommitted);
  trace.record(trace.capture(7200,null));
  trace.record(trace.capture(7300,0));
  assert.deepEqual(trace.current,{
    originMs:7100,sampledThroughMs:200,
    samples:[{timeMs:0,currentMa:8.25},{timeMs:100,currentMa:null},{timeMs:200,currentMa:0}]
  });
  assert.deepEqual(nearestSourceSample(trace.current,25,'currentMa'),{timeMs:100,currentMa:null});
  assert.deepEqual(nearestSourceSample(trace.current,200,'currentMa'),{timeMs:200,currentMa:0});
});

test('applying a revision retains only the same circuit and component, with a fresh origin and capture token',()=>{
  const trace=createSourceLedTrace();
  trace.sync(target);
  trace.record(trace.capture(2000,5));
  const oldFrame=trace.capture(2010,7);
  const before=trace.current;
  trace.sync({...target});
  assert.equal(trace.current,before);
  trace.beginComparison();
  assert.deepEqual(trace.comparison,{id:'led1',kind:'led',windowMs:sourceTraceWindowMs,before,after:trace.current});
  trace.record(oldFrame);
  assert.equal(trace.current.originMs,null);
  trace.record(trace.capture(10,null));
  trace.record(trace.capture(20,0));
  assert.deepEqual(trace.comparison.after.samples,[{timeMs:0,currentMa:null},{timeMs:10,currentMa:0}]);
  assert.equal(trace.comparison.after.originMs,10);
  assert.deepEqual(trace.comparison.before.samples,[{timeMs:0,currentMa:5}]);

  const wrongLed=trace.capture(30,7);
  trace.sync({...target,id:'led2'});
  trace.record(wrongLed);
  assert.equal(trace.comparison,null);
  assert.deepEqual(trace.current.samples,[]);
  trace.record(trace.capture(30,2));
  const wrongCircuit=trace.capture(40,7);
  trace.sync({key:'different-wiring',id:'led2'});
  trace.record(wrongCircuit);
  assert.equal(trace.current.originMs,null);
  trace.sync({enabled:false});
  assert.equal(trace.current,null);
  assert.equal(trace.canSample(40),false);
});

test('LED traces retain the bounded prefix and can update the last timestamp at the sample limit',()=>{
  const trace=createSourceLedTrace();
  trace.sync(target);
  const start=20000;
  trace.record(trace.capture(start,1));
  assert.equal(trace.canSample(start+sourceTraceWindowMs),true);
  assert.equal(trace.canSample(start+sourceTraceWindowMs+1),false);
  for(let index=1;index<sourceTraceMaxSamples+1;index++)trace.record(trace.capture(start+index,1));
  assert.equal(trace.current.samples.length,sourceTraceMaxSamples);
  assert.equal(trace.current.sampledThroughMs,sourceTraceMaxSamples-1);
  const last=start+sourceTraceMaxSamples-1;
  trace.record(trace.capture(last,0));
  assert.deepEqual(trace.current.samples.at(-1),{timeMs:sourceTraceMaxSamples-1,currentMa:0});
  assert.equal(trace.canSample(last+1),false);
});
