import assert from 'node:assert/strict';
import test from 'node:test';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';

const compileWire = (code, setup = 'Wire.begin();') => compileForBoard({'sketch.ino':`#include <Wire.h>
int status = -1, accepted = -1, extra = -1, nextStatus = -1;
void setup(){${setup}}
void loop(){
  ${code}
  delay(10);
}`},'uno-r3');
const transactions = state => state.events.filter(event => event.type === 'i2c');
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-9,`${actual} ≈ ${expected}`);

test('Wire emits an actual STOP-boundary transaction with its seven-bit address and bytes',()=>{
  const program = compileWire(`const uint8_t bytes[] = {0x81, 0x7f};
  Wire.beginTransmission(0x3C);
  accepted = Wire.write(0x140);
  extra = Wire.write(bytes, sizeof(bytes));
  status = Wire.endTransmission(true);`);
  const called = [];
  const runtime = createBoardRuntime(program,{
    writeI2c(address,bytes,snapshot){
      called.push([address,[...bytes],snapshot.timeMs]);
      assert.equal(snapshot.variables.status,-1);
      bytes[0]=0;
      snapshot.pins.D2.output=1;
      return {status:0,deviceId:'oled1'};
    }
  });
  let state = runtime.runSlice(.10);
  near(state.timeMs,.10);
  near(state.pendingDelay.toMs,.36);
  assert.equal(state.variables.accepted,1);
  assert.equal(state.variables.extra,2);
  assert.equal(state.variables.status,-1);
  assert.deepEqual(called,[]);
  assert.deepEqual(transactions(state),[]);

  state = runtime.step(1,{deferDelay:true});
  assert.equal(state.lastEvent.type,'delay');
  assert.equal(state.variables.status,-1);
  assert.equal(state.pins.D2.output,0);
  assert.equal(called.length,1);
  assert.deepEqual(called[0].slice(0,2),[0x3c,[0x40,0x81,0x7f]]);
  near(called[0][2],.36);
  const [event] = transactions(state);
  assert.equal(event.file,'sketch.ino');
  assert.equal(event.line,9);
  assert.equal(event.address,0x3c);
  assert.equal(event.direction,'write');
  assert.equal(event.stop,true);
  assert.equal(event.repeatedStart,false);
  assert.equal(event.status,0);
  assert.equal(event.deviceId,'oled1');
  assert.deepEqual(event.bytes,[0x40,0x81,0x7f]);
  assert.equal(event.fromMs,0);
  near(event.toMs,.36);
  near(event.timeMs,.36);
  assert.equal(runtime.step(1).variables.status,0);
  assert.equal(called.length,1);
});

test('Wire returns unacknowledged address, data and other bus statuses honestly',()=>{
  const code = compileWire('Wire.beginTransmission(0x3D); status = Wire.endTransmission();');
  const cases = [
    [undefined,2,'address-nack',null],
    [()=>({status:3,reason:'data-nack',deviceId:'oled2'}),3,'data-nack','oled2'],
    [()=>({status:4,reason:'sda-held-low'}),4,'sda-held-low',null],
    [()=>undefined,4,'invalid-bus-result',null],
    [()=>{throw Error('bus failure');},4,'hook-error',null]
  ];
  for(const [writeI2c,status,reason,deviceId] of cases){
    const runtime = createBoardRuntime(code,{writeI2c});
    const sent = runtime.runUntilDelay();
    near(sent.timeMs,.09);
    const [event] = transactions(sent);
    assert.deepEqual([event.address,event.bytes,event.status,event.reason,event.deviceId],
      [0x3d,[],status,reason,deviceId]);
    assert.equal(runtime.step(1).variables.status,status);
  }
});

test('Wire guards the 32-byte buffer and never delivers a truncated command',()=>{
  const code = compileWire(`const uint8_t data[33] = {0x40,0x55};
  Wire.beginTransmission(0x3C);
  accepted = Wire.write(data, sizeof(data));
  extra = Wire.write(99);
  status = Wire.endTransmission();
  Wire.beginTransmission(0x3C);
  Wire.write(data, 32);
  nextStatus = Wire.endTransmission();`);
  const writes = [];
  const runtime = createBoardRuntime(code,{
    writeI2c(address,bytes){writes.push([address,bytes]);return {status:0};}
  });
  const state = runtime.runUntilDelay();
  const [overflow,complete] = transactions(state);
  assert.deepEqual([state.variables.accepted,state.variables.extra,state.variables.status],[32,0,1]);
  assert.deepEqual([overflow.status,overflow.reason,overflow.bytes.length,overflow.fromMs,overflow.toMs],
    [1,'buffer-overflow',32,0,0]);
  assert.equal(complete.status,0);
  assert.deepEqual(writes,[[0x3c,[0x40,0x55,...Array(30).fill(0)]]]);
  near(state.timeMs,2.97);
  assert.equal(runtime.step(1).variables.nextStatus,0);
});

test('Wire initialization and reset abandon queued data and unfinished STOP waits',()=>{
  const code = compileWire(`Wire.beginTransmission(0x3C);
  Wire.write(0x40);
  status = Wire.endTransmission();`);
  let sends = 0;
  const runtime = createBoardRuntime(code,{writeI2c(){sends++;return {status:0};}});
  assert.ok(runtime.runSlice(.05).pendingDelay);
  assert.equal(sends,0);
  const reset = runtime.reset();
  assert.deepEqual(transactions(reset),[]);
  assert.equal(reset.pendingDelay,undefined);
  assert.equal(sends,0);
  assert.equal(transactions(runtime.runUntilDelay()).length,1);
  assert.equal(sends,1);

  const notReady = createBoardRuntime(compileWire('Wire.beginTransmission(0x3C); status=Wire.endTransmission();',''));
  const ready = createBoardRuntime(compileWire('status=Wire.endTransmission();'));
  assert.equal(transactions(notReady.runUntilDelay())[0].reason,'not-initialized');
  assert.equal(transactions(ready.runUntilDelay())[0].reason,'not-transmitting');
});

test('Wire rejects malformed calls and non-seven-bit addresses with source diagnostics',()=>{
  for(const [call,name] of [
    ['Wire.begin(0x3C);','Wire.begin'],
    ['Wire.beginTransmission();','Wire.beginTransmission'],
    ['Wire.write();','Wire.write'],
    ['Wire.endTransmission(1,0);','Wire.endTransmission'],
    ['Wire.requestFrom(0x18);','Wire.requestFrom'],
    ['Wire.available(1);','Wire.available'],
    ['Wire.read(1);','Wire.read'],
    ['Wire.peek(1);','Wire.peek']
  ]){
    assert.throws(()=>compileWire(call),error=>error.diagnostics.some(d=>d.code==='ARGUMENT_COUNT'&&d.plain.includes(name)));
  }
  assert.throws(()=>compileWire('Wire.setClock(400000);'),error=>
    error.diagnostics.some(d=>d.code==='UNSUPPORTED_API'&&d.plain.includes('Wire.setClock')));
  assert.throws(()=>compileForBoard({'main.c':'int main(void){Wire.begin();return 0;}'},'bluepill'),error=>
    error.diagnostics.some(d=>d.code==='BOARD_API'&&d.plain.includes('Wire.begin')));
  for(const [code,error] of [
    ['Wire.beginTransmission(0x80);','I2C_ADDRESS'],
    ['Wire.beginTransmission(0x3C); Wire.endTransmission(4);','I2C_STOP_ARGUMENT'],
    ['Wire.beginTransmission(0x3C); uint8_t bytes[1]; Wire.write(bytes,2);','I2C_WRITE_LENGTH'],
    ['Wire.beginTransmission(0x3C); Wire.write(2.5);','I2C_WRITE_BYTE'],
    ['Wire.requestFrom(0x80,2);','I2C_ADDRESS'],
    ['Wire.requestFrom(0x18,-1);','I2C_REQUEST_COUNT'],
    ['Wire.requestFrom(0x18,1.25);','I2C_REQUEST_COUNT'],
    ['Wire.requestFrom(0x18,2,5);','I2C_STOP_ARGUMENT']
  ]){
    const runtime = createBoardRuntime(compileWire(code),{writeI2c(){assert.fail('sent invalid transaction');}});
    const state = runtime.runUntilDelay();
    assert.equal(state.error?.code,error);
    assert.equal(state.error?.file,'sketch.ino');
    assert.deepEqual(transactions(state),[]);
  }
});

test('Wire reads a selected register using repeated START at staged transaction boundaries',()=>{
  const program = compileWire(`Wire.beginTransmission(0x18);
  Wire.write(0x05);
  status=Wire.endTransmission(false);
  nextStatus=Wire.requestFrom(0x18,2);
  accepted=Wire.available();
  extra=Wire.peek()*256+Wire.read();
  status=Wire.read();
  extra+=Wire.read();`);
  const called = [];
  const runtime = createBoardRuntime(program,{
    writeI2c(address,bytes,state,options){
      called.push(['write',address,bytes,state.timeMs,options]);
      return {status:0,deviceId:'temp1'};
    },
    readI2c(address,quantity,state,options){
      called.push(['read',address,quantity,state.timeMs,options]);
      return {status:0,deviceId:'temp1',bytes:[0x01,0x98]};
    }
  });
  let state = runtime.runSlice(.09);
  near(state.pendingDelay.toMs,.18);
  assert.deepEqual(called,[]);
  state = runtime.runUntilDelay();
  near(state.timeMs,.18);
  assert.equal(state.variables.status,-1);
  assert.deepEqual(called,[['write',0x18,[0x05],.18,{stop:false,repeatedStart:false}]]);
  const [write] = transactions(state);
  assert.deepEqual([write.direction,write.stop,write.repeatedStart,write.status],['write',false,false,0]);

  state = runtime.runSlice(.15);
  near(state.pendingDelay.toMs,.45);
  assert.equal(state.variables.nextStatus,-1);
  assert.equal(called.length,1);
  state = runtime.runUntilDelay();
  near(state.timeMs,.45);
  assert.deepEqual(called[1].slice(0,3),['read',0x18,2]);
  near(called[1][3],.45);
  assert.deepEqual(called[1][4],{stop:true,repeatedStart:true});
  const [,read] = transactions(state);
  assert.deepEqual([read.direction,read.stop,read.repeatedStart,read.status,read.requestedBytes,read.bytes,read.deviceId],
    ['read',true,true,0,2,[0x01,0x98],'temp1']);
  near(read.fromMs,.18);
  near(read.toMs,.45);

  state = runtime.runUntilDelay();
  assert.deepEqual([state.variables.nextStatus,state.variables.accepted,state.variables.extra,state.variables.status],
    [2,2,256,0x98]);
});

test('Wire clamps reads to the 32-byte receive buffer and supports explicitly held reads',()=>{
  const runtime = createBoardRuntime(compileWire(`status=Wire.requestFrom(0x18,40,false);
    accepted=Wire.available(); extra=Wire.read();
    nextStatus=Wire.requestFrom(0x18,4,true);`),{
    readI2c(_address,quantity,_state,options){
      if (options.stop) return {status:0,bytes:[0x42]};
      assert.equal(quantity,32);
      return {status:0,bytes:Array.from({length:32},(_,index)=>index)};
    }
  });
  const first = runtime.runUntilDelay();
  near(first.timeMs,2.97);
  assert.deepEqual(transactions(first).map(event=>[event.requestedBytes,event.bytes.length,event.stop]),[[32,32,false]]);
  const second = runtime.runUntilDelay();
  assert.deepEqual([second.variables.status,second.variables.accepted,second.variables.extra],[32,32,0]);
  const [,read] = transactions(second);
  assert.deepEqual([read.requestedBytes,read.bytes,read.stop,read.repeatedStart,read.reason],[4,[0x42],true,true,'short-read']);
  assert.equal(runtime.step(1).variables.nextStatus,1);
});

test('Wire failed or zero-length requests clear earlier RX data and failed transactions release the bus',()=>{
  for(const failure of [{status:2,bytes:[1]},{status:0,bytes:[256]},{status:0,bytes:[1,2,3]},{status:0,bytes:Array(1)}]){
    let calls=0;
    const runtime = createBoardRuntime(compileWire(`status=Wire.requestFrom(0x18,2,false);
      accepted=Wire.requestFrom(0x18,2,false); extra=Wire.available();
      nextStatus=Wire.read()+Wire.peek();
      Wire.requestFrom(0x18,0);
      Wire.requestFrom(0x18,2);`),{
      readI2c(){calls++;return calls===2?failure:{status:0,bytes:[0,99]};}
    });
    runtime.runUntilDelay();
    const [,failed] = transactions(runtime.runUntilDelay());
    assert.deepEqual([failed.status,failed.bytes,failed.stop,failed.repeatedStart],
      [failure.status||4,[],true,true]);
    const state = runtime.runUntilDelay();
    assert.deepEqual([state.variables.status,state.variables.accepted,state.variables.extra,state.variables.nextStatus],[2,0,0,-2]);
    assert.equal(transactions(state).at(-1).repeatedStart,false);
    assert.equal(calls,3);
  }
  const code = compileWire(`status=Wire.requestFrom(0x18,2);
    accepted=Wire.available();
    extra=Wire.requestFrom(0x18,0);
    nextStatus=Wire.available();`);
  const available = createBoardRuntime(code,{readI2c:()=>({status:0,bytes:[0,99]})});
  available.runUntilDelay();
  const cleared = available.runUntilDelay();
  assert.deepEqual([cleared.variables.status,cleared.variables.accepted,cleared.variables.extra,cleared.variables.nextStatus],[2,2,0,0]);
  assert.equal(transactions(cleared).length,1);
  const noReader = createBoardRuntime(code);
  const [unacknowledged] = transactions(noReader.runUntilDelay());
  assert.deepEqual([unacknowledged.status,unacknowledged.bytes],[2,[]]);
});

test('Wire reset clears held state and pre-completion reads cannot deliver stale data',()=>{
  let writes=0,reads=0;
  const runtime = createBoardRuntime(compileWire(`Wire.beginTransmission(0x18);
    Wire.write(5); Wire.endTransmission(false); status=Wire.requestFrom(0x18,2);`),{
    writeI2c(_address,_bytes,_state,options){
      writes++;
      assert.equal(options.repeatedStart,false);
      return {status:0};
    },
    readI2c(){reads++;return {status:0,bytes:[0x01,0x90]};}
  });
  runtime.runUntilDelay();
  const partial = runtime.runSlice(.1);
  assert.ok(partial.pendingDelay);
  assert.equal(reads,0);
  runtime.reset();
  assert.deepEqual(transactions(runtime.getState()),[]);
  assert.equal(transactions(runtime.runUntilDelay())[0].repeatedStart,false);
  assert.equal(transactions(runtime.runUntilDelay()).at(-1).repeatedStart,true);
  assert.deepEqual([writes,reads],[2,1]);
});
