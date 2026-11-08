import assert from 'node:assert/strict';
import test from 'node:test';
import {emptySourceTrace,nearestSourceSample,sampleSourceTrace,sourceTraceMaxSamples,sourceTraceWindowMs} from '../dist/source-trace.js';

test('source traces retain only actual timestamps and replace same-time readings',()=>{
  const trace=emptySourceTrace();
  sampleSourceTrace(trace,Infinity,3.3);
  sampleSourceTrace(trace,sourceTraceWindowMs+1,3.3);
  assert.deepEqual(trace,{samples:[],sampledThroughMs:null});

  sampleSourceTrace(trace,200,3.23);
  sampleSourceTrace(trace,200,0);
  sampleSourceTrace(trace,199,3.23);
  sampleSourceTrace(trace,560,0.4);
  sampleSourceTrace(trace,sourceTraceWindowMs+1,3.23);
  assert.deepEqual(trace,{samples:[{timeMs:200,voltage:0},{timeMs:560,voltage:.4}],sampledThroughMs:560});
});

test('dense traces preserve the bounded prefix and report only covered time',()=>{
  const trace=emptySourceTrace();
  for(let time=0;time<sourceTraceMaxSamples+5;time++)sampleSourceTrace(trace,time,time%2?3.3:0);
  assert.equal(trace.samples.length,sourceTraceMaxSamples);
  assert.equal(trace.sampledThroughMs,sourceTraceMaxSamples-1);
  sampleSourceTrace(trace,trace.sampledThroughMs,.8);
  assert.deepEqual(trace.samples.at(-1),{timeMs:sourceTraceMaxSamples-1,voltage:.8});
});

test('trace cursor returns real samples and does not extrapolate before or after coverage',()=>{
  const trace=emptySourceTrace();
  assert.equal(nearestSourceSample(trace,200),null);
  sampleSourceTrace(trace,100,3.13);
  sampleSourceTrace(trace,500,0);
  assert.equal(nearestSourceSample(trace,99),null);
  assert.equal(nearestSourceSample(trace,501),null);
  assert.deepEqual(nearestSourceSample(trace,300),{timeMs:100,voltage:3.13});
  assert.deepEqual(nearestSourceSample(trace,301),{timeMs:500,voltage:0});
  assert.deepEqual(nearestSourceSample(trace,500),{timeMs:500,voltage:0});
});
