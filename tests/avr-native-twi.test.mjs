import assert from 'node:assert/strict';
import test from 'node:test';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';
import {installAvrTwi} from '../dist/avr-twi.js';
import {CPU} from '../dist/vendor/avr8js/cpu/cpu.js';

const TWBR=0xb8,TWSR=0xb9,TWDR=0xbb,TWCR=0xbc;
const TWINT=0x80,TWSTA=0x20,TWSTO=0x10,TWWC=0x08,TWEN=0x04,TWIE=0x01;
const frequency=16_000_000;
const near=(value,target)=>assert.ok(Math.abs(value-target)<1e-9,`${value} ≈ ${target}`);

function peripheral(hooks={}) {
  const cpu=new CPU(new Uint16Array(256));
  const getState=()=>({timeMs:cpu.cycles/(frequency/1000)});
  const twi=installAvrTwi(cpu,{boardId:'uno-r3',clockHz:frequency,getState,...hooks});
  const tick=cycles=>{cpu.cycles+=cycles;cpu.tick();};
  const control=flags=>cpu.writeData(TWCR,TWINT|TWEN|flags);
  const data=value=>{cpu.writeData(TWDR,value);control(0);};
  return {cpu,twi,tick,control,data};
}

test('native TWI exposes register masks, write collisions and scheduled prescaled TWINT',()=>{
  const {cpu,twi,tick,control,data}=peripheral();
  assert.equal(cpu.readData(TWSR),0xf8);
  assert.equal(cpu.readData(TWCR),0);
  assert.equal(cpu.readData(TWDR),0xff);
  cpu.writeData(TWBR,18);
  cpu.writeData(TWSR,0xfd); // prescaler = 4, the status field is read-only
  assert.equal(cpu.readData(TWSR),0xf9);
  assert.equal(twi.snapshot().sclHz,100_000);
  control(TWSTA);
  tick(159);
  assert.equal(cpu.readData(TWCR)&TWINT,0);
  assert.equal(twi.snapshot().busy,true);
  cpu.writeData(TWDR,0x42);
  assert.equal(cpu.readData(TWDR),0xff);
  assert.equal(cpu.readData(TWCR)&TWWC,TWWC);
  tick(1);
  assert.equal(cpu.readData(TWSR),0x09);
  assert.equal(cpu.readData(TWCR)&TWINT,TWINT);
  data(0x30);
  assert.equal(cpu.readData(TWCR)&(TWINT|TWWC),0);
  tick(1439);
  assert.equal(cpu.readData(TWCR)&TWINT,0);
  tick(1);
  assert.equal(cpu.readData(TWSR),0x21); // SLA+W, no wired slave
  control(TWSTO|TWIE);
  tick(160);
  assert.equal(cpu.readData(TWCR)&(TWINT|TWSTO),0);
  assert.equal(cpu.readData(TWSR),0xf9);
  const [event]=twi.events();
  assert.deepEqual([event.direction,event.address,event.status,event.bytes,event.stop,event.sclHz],
    ['write',0x18,2,[],true,100_000]);
  near(event.toMs,.11);
  assert.deepEqual(event.startEdge,{fromMs:0,toMs:.01,sclHz:100_000});
  assert.deepEqual(event.stopEdge,{fromMs:.1,toMs:.11,sclHz:100_000});
  assert.deepEqual(event.busSegments,[{kind:'address',byte:0x30,ack:false,fromMs:.01,toMs:.1,sclHz:100_000}]);
  assert.equal(event.busSegmentsOmitted,0);
});

test('native TWI NACKs a data byte after the electrical target changes and never commits it',()=>{
  const {cpu,twi,tick,control,data}=peripheral({
    i2cAddress:()=>cpu.cycles<3000?{status:0,deviceId:'temp1'}:{status:2,reason:'disconnected'},
    writeI2c:()=>assert.fail('write to disconnected target'),
  });
  cpu.writeData(TWBR,72);
  control(TWSTA);tick(160);data(0x30);tick(1440);
  assert.equal(twi.snapshot().status,0x18);
  data(0x05);tick(1440);
  assert.equal(twi.snapshot().status,0x30);
  control(TWSTO);tick(160);
  const [event]=twi.events();
  assert.deepEqual([event.bytes,event.status,event.reason,event.deviceId],[[5],3,'disconnected','temp1']);
  assert.deepEqual(event.busSegments.map(segment=>[segment.kind,segment.byte,segment.ack]),
    [['address',0x30,true],['data',0x05,false]]);
});

test('native TWI does not deliver a completed write to a replacement target at the same address',()=>{
  let writes=0;
  const {cpu,twi,tick,control,data}=peripheral({
    i2cAddress:()=>({status:0,deviceId:cpu.cycles<3100?'oled1':'replacement'}),
    writeI2c:()=>{writes++;return {status:0};},
  });
  cpu.writeData(TWBR,72);
  control(TWSTA);tick(160);data(0x78);tick(1440);
  data(0x00);tick(1440);
  assert.equal(twi.snapshot().status,0x28);
  control(TWSTO);tick(160);
  const [event]=twi.events();
  assert.deepEqual([writes,event.status,event.reason,event.deviceId],[0,4,'target-changed','oled1']);
  assert.deepEqual(event.busSegments.map(segment=>segment.ack),[true,true]);
});

test('native TWI disable cancels scheduled address and write actions without touching the bus',()=>{
  let probes=0,commits=0;
  const {cpu,twi,tick,control,data}=peripheral({
    i2cAddress:()=>{probes++;return {status:0};},
    writeI2c:()=>{commits++;return {status:0};},
  });
  cpu.writeData(TWBR,72);
  control(TWSTA);tick(160);data(0x30);tick(10);
  cpu.writeData(TWCR,0);
  tick(2000);
  assert.deepEqual([probes,commits,twi.snapshot().busy,twi.snapshot().status],[0,0,false,0xf8]);
  control(TWSTA);tick(160);data(0x30);tick(1440);
  data(0x05);tick(1440);control(TWSTO);
  cpu.writeData(TWCR,0);
  tick(1000);
  assert.deepEqual([probes,commits,twi.events()],[2,0,[]]);
});

test('native TWI bus errors retain an attempted address but do not invent a reply or ACK',()=>{
  const addressError=peripheral({i2cAddress:()=>({status:4,reason:'sda-held-low'})});
  addressError.cpu.writeData(TWBR,72);
  addressError.control(TWSTA);addressError.tick(160);addressError.data(0x78);addressError.tick(1440);
  addressError.control(TWSTO);addressError.tick(160);
  const [failedAddress]=addressError.twi.events();
  assert.equal(failedAddress.status,4);
  assert.deepEqual(failedAddress.busSegments.map(segment=>[segment.kind,segment.byte,segment.ack]),
    [['address',0x78,null]]);

  const readError=peripheral({
    i2cAddress:()=>({status:0,deviceId:'temp1'}),
    readI2c:()=>({status:4,reason:'scl-held-low',bytes:[0xff],deviceId:'temp1'}),
  });
  readError.cpu.writeData(TWBR,72);
  readError.control(TWSTA);readError.tick(160);readError.data(0x31);readError.tick(1440);
  readError.control(0);readError.tick(1440);readError.control(TWSTO);readError.tick(160);
  const [failedRead]=readError.twi.events();
  assert.equal(failedRead.status,4);
  assert.deepEqual(failedRead.bytes,[]);
  assert.deepEqual(failedRead.busSegments.map(segment=>[segment.kind,segment.byte,segment.ack]),
    [['address',0x31,true],['data',null,null]]);
});

test('native TWI capture retains firmware gaps and per-operation clock rates without truncating bus delivery',()=>{
  const sent=[];
  const {cpu,twi,tick,control,data}=peripheral({
    i2cAddress:()=>({status:0,deviceId:'oled1'}),
    writeI2c:(_address,bytes)=>{sent.push(bytes);return {status:0};},
  });
  cpu.writeData(TWBR,72);
  control(TWSTA);tick(160);
  tick(80);
  data(0x78);tick(1440);
  tick(800);
  cpu.writeData(TWBR,12);
  for(let i=0;i<66;i++){data(i);tick(360);}
  control(TWSTO);tick(40);
  const [capture]=twi.events();
  assert.deepEqual(sent,[Array.from({length:66},(_,i)=>i)]);
  assert.equal(capture.busSegments.length,64);
  assert.equal(capture.busSegmentsOmitted,3);
  assert.equal(capture.busSegments.at(-1).byte,62);
  const [address,first]=capture.busSegments;
  near(address.fromMs-capture.startEdge.toMs,.005);
  near(address.toMs-address.fromMs,.09);
  near(first.fromMs-address.toMs,.05);
  near(first.toMs-first.fromMs,.0225);
  assert.deepEqual([capture.startEdge.sclHz,address.sclHz,first.sclHz,capture.stopEdge.sclHz],
    [100_000,100_000,400_000,400_000]);
  capture.startEdge.toMs=0;
  capture.stopEdge.fromMs=0;
  capture.busSegments[0].ack=false;
  capture.busSegments.pop();
  capture.bytes[0]=255;
  const [original]=twi.events();
  assert.equal(original.startEdge.toMs,.01);
  assert(original.stopEdge.fromMs>0);
  assert.equal(original.busSegments[0].ack,true);
  assert.equal(original.busSegments.length,64);
  assert.equal(original.bytes[0],0);
});

const ldi=value=>0xe000|((value&0xf0)<<4)|(value&0x0f); // r16
const store=(address,value)=>[ldi(value),0x9300,address];
const load=address=>[0x9100,address];
const skipClear=bit=>0xfd00|bit;
const skipSet=bit=>0xff00|bit;
const jump=offset=>0xc000|(offset&0x0fff);
const pollInterrupt=[...load(TWCR),skipSet(7),jump(-4)];
const pollStop=[...load(TWCR),skipClear(4),jump(-4)];
const send=value=>[...store(TWDR,value),...store(TWCR,TWINT|TWEN),...pollInterrupt];
const command=flags=>[...store(TWCR,TWINT|TWEN|flags),...pollInterrupt];
const sbi=(io,bit)=>0x9a00|(io<<3)|bit;
const flash=words=>Uint8Array.from(words.flatMap(word=>[word&0xff,word>>8]));

function finishFirmware(runtime) {
  for(let attempt=0;attempt<35;attempt++) {
    const state=runtime.advanceTime(2);
    assert.equal(state.error,null);
    if(state.done)return state;
  }
  assert.fail('firmware did not complete');
}

test('native polling firmware writes a register, repeats START and reads exactly two bytes',()=>{
  const words=[
    ...store(TWBR,72),...command(TWSTA),...send(0x30),...send(0x05),
    ...command(TWSTA),...send(0x31),...command(0x40),...command(0),
    ...store(TWCR,TWINT|TWSTO|TWEN),...pollStop,0x9598,
  ];
  const wire=[],staged=[];
  const runtime=createAvrFirmwareRuntime({flash:flash(words)},{
    i2cAddress(address,direction,state,meta){
      assert.equal(address,0x18);
      staged.push([direction,state.twi.status,meta.repeatedStart]);
      return {status:0,deviceId:'temp1'};
    },
    writeI2c(address,bytes,state,meta){
      wire.push(['write',address,bytes,meta]);
      assert.equal(state.timeMs,state.cycles/16000);
      return {status:0,deviceId:'temp1'};
    },
    readI2c(address,quantity,_state,meta){
      wire.push(['read',address,quantity,meta]);
      return {status:0,deviceId:'temp1',bytes:[[0x01,0x98][meta.offset]]};
    },
  });
  const result=finishFirmware(runtime);
  assert.deepEqual(staged,[['write',0xf8,false],['write',0xf8,false],['write',0xf8,false],['read',0xf8,true]]);
  assert.deepEqual(wire,[
    ['write',0x18,[0x05],{stop:false,repeatedStart:false}],
    ['read',0x18,1,{offset:0,repeatedStart:true,stop:false,ack:true}],
    ['read',0x18,1,{offset:1,repeatedStart:true,stop:false,ack:false}],
  ]);
  assert.deepEqual(result.events.map(event=>[event.direction,event.address,event.bytes,event.stop,event.repeatedStart,event.status,event.deviceId]),
    [['write',0x18,[0x05],false,false,0,'temp1'],['read',0x18,[0x01,0x98],true,true,0,'temp1']]);
  near(result.events[0].toMs,result.events[1].fromMs);
  const [writeEvent,readEvent]=result.events;
  assert.equal(writeEvent.stopEdge,undefined);
  assert(writeEvent.busSegments.at(-1).toMs<readEvent.startEdge.fromMs);
  assert(readEvent.startEdge.toMs<=readEvent.fromMs);
  assert(readEvent.stopEdge.toMs<=readEvent.toMs);
  assert.deepEqual(readEvent.busSegments.map(segment=>[segment.kind,segment.byte,segment.ack]),
    [['address',0x31,true],['data',0x01,true],['data',0x98,false]]);
  for(const segment of readEvent.busSegments)near(segment.toMs-segment.fromMs,.09);
  assert.equal(result.twi.TWDR,0x98);
  assert.equal(result.twi.status,0xf8);
  assert.equal(runtime.reset().events.length,0);
});

test('native AVR TWI IRQ vectors are level-sensitive and preserve TWINT on ISR entry',()=>{
  for(const [boardId,vector,bit] of [['uno-r3',0x30,5],['nano',0x30,5],['mega2560',0x4e,7]]){
    const main=0x90,words=Array(0xb0).fill(0xffff);
    words[0]=jump(main-1);
    words.splice(main,8,...store(TWBR,72),0x9478,...store(TWCR,TWINT|TWSTA|TWEN|TWIE),jump(-1));
    const interrupt=[...load(TWCR),skipSet(7),jump(2),sbi(4,bit),sbi(5,bit),...store(TWCR,TWEN),0x9518];
    words.splice(vector,interrupt.length,...interrupt);
    const runtime=createAvrFirmwareRuntime({flash:flash(words)},{boardId});
    const state=runtime.advanceTime(.4);
    assert.equal(state.error,null,boardId);
    assert.equal(state.pins.D13.level,1,boardId);
    assert.equal(state.twi.TWCR,TWINT|TWEN,boardId);
    assert.equal(state.twi.status,0x08,boardId);
  }
});
