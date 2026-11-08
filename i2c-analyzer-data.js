const bitsPerByte=9;
const sourceClockHz=100000;
const defaultWindow=4;
const maxWindow=8;
const toleranceUs=.00001;
const estimateLimit=64;
const hex=byte=>'0x'+byte.toString(16).toUpperCase().padStart(2,'0');
const validByte=value=>Number.isInteger(value)&&value>=0&&value<=255;
const validFrequency=value=>Number.isFinite(value)&&value>0;
const validTimeRange=segment=>Number.isFinite(segment?.fromMs)&&Number.isFinite(segment?.toMs)&&segment.toMs>segment.fromMs;

function empty(reason,event){
  return {mode:'unavailable',reason,address:event?.address??null,direction:event?.direction??null,status:event?.status??null,
    originMs:null,fromUs:null,toUs:null,groups:[],markers:[],scl:[],sda:[],
    firstByte:0,lastByte:null,retainedBytes:0,totalBytes:0,omittedBytes:0,previousFirstByte:null,nextFirstByte:null};
}

function marker(kind,fromUs,toUs){
  const label=kind==='repeated-start'?'重复 START':kind==='start'?'START':'STOP';
  return {kind,fromUs,toUs,label};
}

function nativeTimings(event){
  const segments=event.busSegments;
  if(!segments.length||segments.some(segment=>!validTimeRange(segment)||!['address','data'].includes(segment.kind)))return null;
  if(segments.some((segment,index)=>index>0&&segment.fromMs<segments[index-1].toMs-toleranceUs/1000))return null;
  const start=validTimeRange(event.startEdge)?event.startEdge:null;
  const stop=validTimeRange(event.stopEdge)?event.stopEdge:null;
  const originMs=Math.min(segments[0].fromMs,start?.fromMs??Infinity,Number.isFinite(event.fromMs)?event.fromMs:Infinity);
  const us=timeMs=>Math.round((timeMs-originMs)*1e9)/1e6;
  return {originMs,
    segments:segments.map(segment=>({
      kind:segment.kind,byte:validByte(segment.byte)?segment.byte:null,ack:typeof segment.ack==='boolean'?segment.ack:null,
      fromUs:us(segment.fromMs),toUs:us(segment.toMs),sclHz:segment.sclHz
    })),
    start:start&&marker(event.repeatedStart?'repeated-start':'start',us(start.fromMs),us(start.toMs)),
    stop:stop&&marker('stop',us(stop.fromMs),us(stop.toMs)),
    omitted:Number.isSafeInteger(event.busSegmentsOmitted)&&event.busSegmentsOmitted>0?event.busSegmentsOmitted:0};
}

function sourceTimings(event){
  const frequency=validFrequency(event.sclHz)?event.sclHz:sourceClockHz;
  const clockUs=1e6/frequency,edgeUs=clockUs/2;
  const addressByte=event.address*2+Number(event.direction==='read');
  if(event.status===0&&!Array.isArray(event.bytes))return null;
  const sourceBytes=event.status===0?event.bytes:[];
  if(sourceBytes.some(byte=>!validByte(byte)))return null;
  const partialRead=event.status===0&&event.direction==='read'&&Number.isInteger(event.requestedBytes)&&
    event.requestedBytes>sourceBytes.length;
  const count=Math.min(sourceBytes.length,estimateLimit-1);
  const bytes=[{kind:'address',byte:addressByte,ack:event.status===0},...sourceBytes.slice(0,count).map((byte,index)=>({
    kind:'data',byte,ack:event.direction==='write'||partialRead||index<sourceBytes.length-1
  }))];
  const byteUs=bitsPerByte*clockUs;
  const endUs=edgeUs+(1+sourceBytes.length)*byteUs;
  return {originMs:Number.isFinite(event.fromMs)?event.fromMs:Number.isFinite(event.timeMs)?event.timeMs:null,
    segments:bytes.map((byte,index)=>({...byte,fromUs:edgeUs+index*byteUs,toUs:edgeUs+(index+1)*byteUs,sclHz:frequency})),
    start:marker(event.repeatedStart?'repeated-start':'start',0,edgeUs),
    stop:event.stop===false||partialRead?null:marker('stop',endUs,endUs+edgeUs),omitted:sourceBytes.length-count};
}

function makeGroup(segment,index,direction){
  const {kind,byte,ack,fromUs,toUs}=segment;
  const known=byte!==null&&ack!==null,ackBy=kind==='data'&&direction==='read'?'host':'device';
  const duration=toUs-fromUs;
  const bits=Array.from({length:bitsPerByte},(_,i)=>{
    const isAck=i===8,bit=7-i;
    return {index:i,role:isAck?'ack':'data',label:isAck?(ack===null?'—':ack?'ACK':'NACK'):'b'+bit,
      level:isAck?(ack===null?null:Number(!ack)):(byte===null?null:(byte>>bit)&1),
      fromUs:fromUs+duration*i/bitsPerByte,toUs:fromUs+duration*(i+1)/bitsPerByte};
  });
  const label=kind==='address'?'地址字节 ':'数据 '+index+' · ';
  return {...segment,index,known,ackBy,bits,sclHz:validFrequency(segment.sclHz)?segment.sclHz:bitsPerByte*1e6/duration,
    label:label+(byte===null?'—':hex(byte))};
}

function wavePoints(groups,markers){
  const scl=[],sda=[];
  let cursor=null,level=null;
  function point(track,timeUs,next){
    const last=track.at(-1);
    if(last?.timeUs!==timeUs||last.level!==next)track.push({timeUs,level:next});
  }
  const clock=(time,value)=>point(scl,time,value);
  const data=(time,value)=>{point(sda,time,value);level=value;};
  function transition(fn,time,before,after){
    fn(time,before);fn(time,after);
  }
  function bridgeGap(toUs){
    if(cursor===null||toUs<=cursor+toleranceUs)return;
    // The AVR holds SCL low between scheduled byte windows. The bus
    // event does not report which side is driving SDA during that gap.
    clock(toUs,0);
    data(cursor,null);
  }
  const start=markers.find(edge=>edge.kind!=='stop');
  if(start){
    const {fromUs,toUs,kind}=start,duration=toUs-fromUs;
    const repeated=kind==='repeated-start';
    clock(fromUs,repeated?0:1);data(fromUs,1);
    if(repeated)transition(clock,fromUs+duration*.3,0,1);
    transition(data,fromUs+duration*.65,1,0);
    transition(clock,toUs,1,0);data(toUs,0);
    cursor=toUs;
  }
  for(const group of groups){
    if(!group.known){
      clock(group.fromUs,null);data(group.fromUs,null);
      cursor=null;
      continue;
    }
    bridgeGap(group.fromUs);
    for(const bit of group.bits){
      const {fromUs,toUs,level:value}=bit,duration=toUs-fromUs;
      clock(fromUs,0);
      if(level===null)data(fromUs,value);
      else transition(data,fromUs+duration*.2,level,value);
      transition(clock,fromUs+duration/2,0,1);
      transition(clock,toUs,1,0);data(toUs,value);
    }
    cursor=group.toUs;
  }
  const stop=markers.find(edge=>edge.kind==='stop');
  if(stop){
    const {fromUs,toUs}=stop,duration=toUs-fromUs;
    bridgeGap(fromUs);
    clock(fromUs,0);
    if(level===null)data(fromUs+duration*.2,0);
    else transition(data,fromUs+duration*.2,level,0);
    transition(clock,fromUs+duration*.45,0,1);
    transition(data,fromUs+duration*.75,0,1);
    clock(toUs,1);data(toUs,1);
  }
  return {scl,sda};
}

export function analyzeI2cEvent(event,{firstByte=0,maxBytes=defaultWindow}={}){
  if(event?.type!=='i2c')return empty('no-event',event);
  if(!Number.isInteger(event.address)||event.address<0||event.address>127||
    !['read','write'].includes(event.direction)||![0,1,2,3,4].includes(event.status))return empty('invalid-event',event);
  const native=Array.isArray(event.busSegments);
  if(!native&&![0,2].includes(event.status)){
    return empty(['','preflight','','data-boundary-unknown','bus-error'][event.status],event);
  }
  const timing=native?nativeTimings(event):sourceTimings(event);
  if(!timing||!timing.segments.some(segment=>segment.byte!==null&&segment.ack!==null))return empty('timing-unavailable',event);
  const {segments,omitted:omittedBytes,originMs}=timing;
  const retainedBytes=segments.length;
  const limit=Number.isFinite(maxBytes)?Math.max(1,Math.min(maxWindow,Math.trunc(maxBytes))):defaultWindow;
  const lastWindow=Math.max(0,retainedBytes-limit);
  const first=Number.isFinite(firstByte)?Math.max(0,Math.min(lastWindow,Math.trunc(firstByte))):0;
  const groups=segments.slice(first,first+limit).map((segment,index)=>makeGroup(segment,first+index,event.direction));
  const lastByte=first+groups.length-1;
  const markers=[];
  if(first===0&&groups[0].known&&timing.start&&timing.start.toUs<=groups[0].fromUs+toleranceUs)markers.push(timing.start);
  if(lastByte===retainedBytes-1&&!omittedBytes&&groups.at(-1).known&&timing.stop&&
    timing.stop.fromUs>=groups.at(-1).toUs-toleranceUs)markers.push(timing.stop);
  const firstMarker=markers[0];
  const fromUs=firstMarker&&firstMarker.kind!=='stop'?firstMarker.fromUs:groups[0].fromUs;
  const toUs=markers.at(-1)?.kind==='stop'?markers.at(-1).toUs:groups.at(-1).toUs;
  const previous=first===lastWindow&&first%limit?first-first%limit:Math.max(0,first-limit);
  return {mode:native?'native':'estimated',controller:event.controller,reason:null,address:event.address,direction:event.direction,status:event.status,
    originMs,fromUs,toUs,groups,markers,...wavePoints(groups,markers),
    firstByte:first,lastByte,retainedBytes,totalBytes:retainedBytes+omittedBytes,omittedBytes,
    previousFirstByte:first?previous:null,nextFirstByte:first<lastWindow?Math.min(lastWindow,first+limit):null};
}
