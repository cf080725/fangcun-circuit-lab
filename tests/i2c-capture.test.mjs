import test from 'node:test';
import assert from 'node:assert/strict';
import {createI2cCapture} from '../dist/i2c-capture.js';

const packet=(timeMs,status=0)=>({type:'i2c',timeMs,fromMs:timeMs-.2,address:0x18,direction:'read',status});

test('capture arms for the next error without reacting to old failures or a normal read NACK',()=>{
  const capture=createI2cCapture(),owner={};
  const old=packet(1,2),read={...packet(2),busSegments:[{kind:'data',ack:false}]},error=packet(3,2),next=packet(4);
  capture.arm([old],owner);
  capture.ingest([old,read],owner);
  assert.equal(capture.mode,'armed');
  capture.ingest([old,read,error,next],owner);
  assert.equal(capture.mode,'held');
  assert.deepEqual(capture.records.map(row=>row.event),[old,read,error]);
  capture.ingest([packet(1)],{});
  assert.equal(capture.records.at(-1).event,error);
});

test('clear keeps the cursor and follow starts a fresh history for a new runtime',()=>{
  const capture=createI2cCapture(),owner={};
  capture.ingest([packet(1),packet(2)],owner);
  capture.clear();
  capture.ingest([packet(1),packet(2)],owner);
  assert.equal(capture.records.length,0);
  capture.ingest([packet(1),packet(2),packet(3)],owner);
  assert.deepEqual(capture.records.map(row=>row.event.timeMs),[3]);
  capture.freeze();
  capture.follow();
  capture.ingest([packet(1)],{});
  assert.deepEqual(capture.records.map(row=>row.event.timeMs),[1]);
});

test('an armed capture finds a failure before the last 32 transactions of a single snapshot',()=>{
  const capture=createI2cCapture(),owner={};
  capture.arm([packet(0)],owner);
  const batch=Array.from({length:50},(_,index)=>packet(index,index===3?2:0));
  capture.ingest(batch,owner);
  assert.equal(capture.mode,'held');
  assert.equal(capture.records.at(-1).event.timeMs,3);
});
