import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelayScope,recordRelayScope,relaySamplePath,relaySignalPath} from '../dist/relay-native-view.js';

test('relay chart draws exact short and long PA0 commands with unchanged period',()=>{
  assert.equal(relaySignalPath(2/500,true),'M58 7H59.17V23H350');
  assert.equal(relaySignalPath(220/500,true),'M58 7H186.48V23H350');
  assert.equal(relaySignalPath(220/500,false),'M58 23H221.52V7H350');
  assert.equal(relaySignalPath(0,true),'M58 23H350');
});

test('relay chart keeps the last actual sampled cycle and gaps in load readings',()=>{
  const trace=createRelayScope();
  const record=(timeMs,phaseMs,closed,lit)=>recordRelayScope(trace,{timeMs,phaseMs,closed,lit,periodMs:500});
  assert.equal(record(20,19,true,true),true);
  assert.equal(record(20,19,true,true),false);
  assert.equal(record(240,239,false,null),true);
  assert.equal(record(480,479,false,false),true);
  assert.equal(record(520,19,true,true),true);
  assert.equal(trace.complete.length,3);
  assert.equal(trace.cycle.length,1);
  assert.match(relaySamplePath(trace.complete,500,'closed',34,51),/^M69\.1 34 H197\.58V51/);
  assert.equal(relaySamplePath(trace.complete,500,'lit',63,80).match(/M/g).length,2);
});
