import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit} from '../dist/circuit.js';
import {createSourceProbeTrace} from '../dist/source-probe-trace.js';
import {nearestSourceSample,sourceTraceMaxSamples,sourceTraceWindowMs} from '../dist/source-trace.js';

const context={key:'connected',red:'bb:a10',black:'bb:f10',enabled:true};
const reading=voltage=>({measureBetween:()=>({status:'measured',voltage})});
const write=(controller,timeMs,result)=>controller.record(controller.capture(timeMs,result));

test('probe trace measures the signed solver difference of the ordered pair',()=>{
  const circuit=createCircuit('onboard'),sim=new CircuitSimulator(),controller=createSourceProbeTrace();
  circuit.wires=[{a:'mcu:3V3',b:'bb:e10'},{a:'mcu:GND1',b:'bb:j10'}];
  const result=sim.solve(circuit);
  assert.equal(result.netVoltages['bb:a10'],undefined);
  controller.sync(context);
  write(controller,0,result);
  assert.deepEqual(controller.current.samples,[{timeMs:0,voltage:3.3}]);
  controller.beginComparison();
  assert.equal(controller.comparison.red,context.red);
  assert.equal(controller.comparison.black,context.black);
  controller.sync({...context,red:context.black,black:context.red});
  write(controller,0,result);
  assert.equal(controller.comparison,null);
  assert.deepEqual(controller.current.samples,[{timeMs:0,voltage:-3.3}]);
  assert.equal(sim.lastResult,result);
});

test('a successful new revision preserves the preceding run and rejects delayed old samples',()=>{
  const controller=createSourceProbeTrace();
  controller.sync(context);
  write(controller,0,reading(3.3));
  write(controller,500,reading(0));
  const previous=controller.current,pending=controller.capture(700,reading(5));
  controller.sync({...context});
  assert.equal(controller.current,previous);
  controller.beginComparison();
  assert.equal(controller.comparison.before,previous);
  assert.equal(controller.comparison.after,controller.current);
  controller.record(pending);
  assert.equal(controller.current.samples.length,0);
  write(controller,0,reading(3.3));
  write(controller,200,reading(0));
  assert.deepEqual(controller.comparison.before.samples,[{timeMs:0,voltage:3.3},{timeMs:500,voltage:0}]);
  assert.deepEqual(controller.comparison.after.samples,[{timeMs:0,voltage:3.3},{timeMs:200,voltage:0}]);
  controller.beginComparison();
  assert.deepEqual(controller.comparison.before.samples,[{timeMs:0,voltage:3.3},{timeMs:200,voltage:0}]);
  assert.equal(controller.current.samples.length,0);
});

test('changing electrical state, pair or mode invalidates data even if the selection returns',()=>{
  const controller=createSourceProbeTrace();
  for (const changed of [{key:'new-wire'},{red:context.black,black:context.red},{black:null},{enabled:false}]) {
    controller.sync(context);
    write(controller,0,reading(3.3));
    controller.beginComparison();
    write(controller,0,reading(1));
    const pending=controller.capture(30,reading(2));
    controller.sync({...context,...changed});
    assert.equal(controller.comparison,null);
    if (changed.enabled===false || changed.black===null) {
      assert.equal(controller.current,null);
      assert.equal(controller.capture(0,reading(5)),null);
    }
    controller.sync(context);
    controller.record(pending);
    assert.deepEqual(controller.current.samples,[]);
  }
  controller.reset();
  assert.equal(controller.current,null);
  assert.equal(controller.comparison,null);
});

test('invalid measurements leave gaps that cursor queries cannot bridge',()=>{
  const controller=createSourceProbeTrace();
  controller.sync(context);
  write(controller,0,reading(-1));
  write(controller,100,{measureBetween:()=>({status:'floating',voltage:null})});
  write(controller,300,reading(Infinity));
  write(controller,400,null);
  write(controller,500,reading(0));
  write(controller,600,reading(2));
  const trace=controller.current;
  for (const time of [100,300,400]) assert.deepEqual(nearestSourceSample(trace,time),{timeMs:time,voltage:null});
  assert.deepEqual(nearestSourceSample(trace,1),{timeMs:100,voltage:null});
  assert.deepEqual(nearestSourceSample(trace,499),{timeMs:400,voltage:null});
  assert.deepEqual(nearestSourceSample(trace,500),{timeMs:500,voltage:0});
  assert.deepEqual(nearestSourceSample(trace,590),{timeMs:600,voltage:2});
  assert.equal(nearestSourceSample(trace,601),null);
  write(controller,600,null);
  assert.deepEqual(nearestSourceSample(trace,600),{timeMs:600,voltage:null});
});

test('capture rejects stale or out-of-window requests and does not read the solver after the budget',()=>{
  const controller=createSourceProbeTrace();
  let reads=0;
  const result={measureBetween(){reads++;return {status:'measured',voltage:.2};}};
  controller.sync(context);
  for(let time=0;time<sourceTraceMaxSamples;time++) write(controller,time,result);
  assert.equal(reads,sourceTraceMaxSamples);
  assert.equal(controller.canSample(sourceTraceMaxSamples),false);
  assert.equal(controller.capture(sourceTraceMaxSamples,result),null);
  assert.equal(controller.capture(0,result),null);
  assert.equal(reads,sourceTraceMaxSamples);
  assert.equal(controller.canSample(sourceTraceMaxSamples-1),true);
  write(controller,sourceTraceMaxSamples-1,null);
  assert.deepEqual(controller.current.samples.at(-1),{timeMs:sourceTraceMaxSamples-1,voltage:null});
  controller.beginComparison();
  assert.equal(controller.canSample(sourceTraceWindowMs),true);
  write(controller,sourceTraceWindowMs,result);
  assert.equal(controller.current.sampledThroughMs,sourceTraceWindowMs);
  assert.equal(controller.capture(sourceTraceWindowMs+1,result),null);
  assert.equal(reads,sourceTraceMaxSamples+1);
});
