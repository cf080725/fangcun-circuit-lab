import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {analyzeI2cEvent} from '../dist/i2c-analyzer-data.js';
import {makeI2cTemperatureLesson} from '../dist/i2c-temperature-lesson.js';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {parseAvrHex} from '../dist/avr-firmware-hex.js';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';
import {CircuitSimulator} from '../dist/circuit.js';

const source=(extra={})=>({type:'i2c',direction:'read',address:0x18,status:0,bytes:[0xc2,0x28],
  fromMs:250.18,toMs:250.45,repeatedStart:true,stop:true,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' ≈ '+b);
const levels=group=>group.bits.map(bit=>bit.level);
const signature=frame=>frame.groups.map(group=>[group.kind,group.byte,group.ack,group.ackBy]);

test('source estimate reconstructs address, MSB first, and final host NACK',()=>{
  const frame=analyzeI2cEvent(source());
  assert.equal(frame.mode,'estimated');
  assert.equal(frame.originMs,250.18);
  assert.deepEqual(signature(frame),[['address',0x31,true,'device'],['data',0xc2,true,'host'],['data',0x28,false,'host']]);
  assert.deepEqual(levels(frame.groups[0]),[0,0,1,1,0,0,0,1,0]);
  assert.deepEqual(levels(frame.groups[1]),[1,1,0,0,0,0,1,0,0]);
  assert.deepEqual(levels(frame.groups[2]),[0,0,1,0,1,0,0,0,1]);
  assert.ok(frame.groups.every(group=>group.toUs-group.fromUs===90&&group.sclHz===100000));
  assert.deepEqual(frame.markers.map(marker=>marker.kind),['repeated-start','stop']);
  assert.deepEqual(frame.scl.at(-1),{timeUs:280,level:1});
  assert.deepEqual(frame.sda.at(-1),{timeUs:280,level:1});
  for(const track of [frame.scl,frame.sda]){
    assert.ok(track.every((point,i)=>i===0||point.timeUs>=track[i-1].timeUs));
  }
  const at=(track,timeUs)=>track.findLast(point=>point.timeUs<=timeUs)?.level;
  for(const bit of frame.groups.flatMap(group=>group.bits)){
    const duration=bit.toUs-bit.fromUs;
    assert.equal(at(frame.scl,bit.fromUs+duration*.4),0);
    assert.equal(at(frame.scl,bit.fromUs+duration*.75),1);
    assert.equal(at(frame.sda,bit.fromUs+duration*.75),bit.level);
  }
});

test('source failures cannot generate queued data or fabricated edge boundaries',()=>{
  const address=analyzeI2cEvent(source({direction:'write',status:2,bytes:[5,6,7],repeatedStart:false}));
  assert.equal(address.mode,'estimated');
  assert.deepEqual(signature(address),[['address',0x30,false,'device']]);
  assert.equal(address.groups[0].bits.at(-1).label,'NACK');
  assert.equal(address.groups[0].bits.at(-1).level,1);
  assert.equal(address.groups[0].toUs-address.groups[0].fromUs,90);
  assert.deepEqual(address.markers.map(marker=>marker.kind),['start','stop']);
  for(const [status,reason] of [[1,'preflight'],[3,'data-boundary-unknown'],[4,'bus-error']]){
    const frame=analyzeI2cEvent(source({status}));
    assert.equal(frame.mode,'unavailable');
    assert.equal(frame.reason,reason);
    assert.deepEqual(frame.scl,[]);
    assert.deepEqual(frame.sda,[]);
  }
  const partial=analyzeI2cEvent(source({requestedBytes:2,bytes:[0xc2],reason:'short-read'}));
  assert.deepEqual(signature(partial),[['address',0x31,true,'device'],['data',0xc2,true,'host']]);
  assert.deepEqual(partial.markers.map(marker=>marker.kind),['repeated-start']);
});

test('native timing retains measured gaps and actual controller ACK ownership',()=>{
  const event=source({fromMs:3.2,startEdge:{fromMs:3.19,toMs:3.20},
    stopEdge:{fromMs:3.399,toMs:3.409},
    busSegments:[
      {kind:'address',byte:0x31,ack:true,fromMs:3.205,toMs:3.295,sclHz:100000},
      {kind:'data',byte:0x90,ack:true,fromMs:3.301,toMs:3.391,sclHz:100000}
    ]});
  const frame=analyzeI2cEvent(event);
  assert.equal(frame.mode,'native');
  assert.equal(frame.originMs,3.19);
  assert.deepEqual(signature(frame),[['address',0x31,true,'device'],['data',0x90,true,'host']]);
  assert.deepEqual(frame.groups.map(group=>[group.fromUs,group.toUs]),[[15,105],[111,201]]);
  assert.deepEqual(frame.markers.map(marker=>[marker.kind,marker.fromUs,marker.toUs]),[['repeated-start',0,10],['stop',209,219]]);
  assert.ok(frame.scl.some(({timeUs,level})=>timeUs===111&&level===0));
  assert.ok(frame.sda.some(({timeUs,level})=>timeUs===105&&level===null));
  assert.equal(analyzeI2cEvent({...event,busSegments:[]}).mode,'unavailable');
});

test('native bus errors preserve known prefix and leave the unknown slot blank',()=>{
  const startEdge={fromMs:0,toMs:.01};
  const busSegments=[
    {kind:'address',byte:0x31,ack:true,fromMs:.01,toMs:.1},
    {kind:'data',byte:null,ack:null,fromMs:.101,toMs:.191}
  ];
  const frame=analyzeI2cEvent(source({status:4,fromMs:0,startEdge,busSegments,stopEdge:{fromMs:.192,toMs:.202}}));
  assert.equal(frame.mode,'native');
  assert.equal(frame.groups[1].known,false);
  assert.ok(frame.groups[1].bits.every(bit=>bit.level===null));
  assert.deepEqual(frame.scl.at(-1),{timeUs:101,level:null});
  assert.deepEqual(frame.sda.at(-1),{timeUs:101,level:null});
  assert.equal(frame.markers.some(marker=>marker.kind==='stop'),false);
  assert.equal(analyzeI2cEvent(source({status:4,busSegments:[busSegments[1]]})).mode,'unavailable');
});

test('windowing bounds work, hold state survives, and omitted native tails are identified',()=>{
  const event=source({direction:'write',stop:false,bytes:[0,1,2,3,4,5,6,7,8]});
  const first=analyzeI2cEvent(event);
  const middle=analyzeI2cEvent(event,{firstByte:first.nextFirstByte});
  const end=analyzeI2cEvent(event,{firstByte:middle.nextFirstByte});
  assert.deepEqual([first.firstByte,first.lastByte,first.previousFirstByte,first.nextFirstByte],[0,3,null,4]);
  assert.deepEqual([middle.firstByte,middle.lastByte,middle.previousFirstByte,middle.nextFirstByte],[4,7,0,6]);
  assert.deepEqual([end.firstByte,end.lastByte,end.previousFirstByte,end.nextFirstByte],[6,9,4,null]);
  assert.deepEqual(end.groups.map(group=>group.byte),[5,6,7,8]);
  assert.equal(end.markers.length,0,'held transaction does not imply STOP');
  assert.equal(analyzeI2cEvent({...event,stop:true},{firstByte:20}).markers[0].kind,'stop');
  const native=analyzeI2cEvent(source({busSegmentsOmitted:12,stopEdge:{fromMs:.2,toMs:.21},
    busSegments:[{kind:'address',byte:0x31,ack:true,fromMs:.01,toMs:.1}]}));
  assert.deepEqual([native.retainedBytes,native.totalBytes,native.omittedBytes],[1,13,12]);
  assert.equal(native.markers.some(marker=>marker.kind==='stop'),false);
});

test('UNO firmware trace contains scheduled 0x31, C2/28 and a real 0x30 address NACK after unplug',()=>{
  const circuit=makeI2cTemperatureLesson().circuitData;
  circuit.components[0].temperatureC=34.5;
  const solver=new CircuitSimulator();
  const source=readFileSync(new URL('../dist/firmware/uno-r3/temperature-30.hex',import.meta.url),'utf8');
  const runtime=createAvrFirmwareRuntime(parseAvrHex(source),createAvrCircuitIO(()=>circuit,solver));
  let state=runtime.getState();
  solver.solve(circuit,state);
  function advanceTo(ms){
    while(state.timeMs<ms){
      const before=state.timeMs;
      state=runtime.advanceTime(20);
      assert.equal(state.error,null);
      assert.ok(state.timeMs>before);
      solver.solve(circuit,state);
    }
  }
  advanceTo(290);
  const read=state.events.find(event=>event.direction==='read');
  const frame=analyzeI2cEvent(read);
  assert.equal(frame.mode,'native');
  assert.deepEqual(signature(frame),[['address',0x31,true,'device'],['data',0xc2,true,'host'],['data',0x28,false,'host']]);
  near(frame.groups[0].fromUs,(read.busSegments[0].fromMs-frame.originMs)*1000);
  near(frame.groups.at(-1).toUs,(read.busSegments.at(-1).toMs-frame.originMs)*1000);
  assert.deepEqual(frame.markers.map(marker=>marker.kind),['repeated-start','stop']);
  circuit.wires=circuit.wires.filter(wire=>wire.b!=='temp1:SDA');
  advanceTo(620);
  const failure=state.events.findLast(event=>event.status===2);
  const rejected=analyzeI2cEvent(failure);
  assert.equal(rejected.mode,'native');
  assert.deepEqual(signature(rejected),[['address',0x30,false,'device']]);
});
