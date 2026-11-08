const maxRecords=32;

// Each runtime emits completed events in order. This key survives fresh state
// snapshots and ring-buffer trimming even when each event is copied.
function packetKey(event){
  return [event.timeMs,event.fromMs,event.address,event.direction,event.status,event.reason,event.file,event.line].join('/');
}

export function createI2cCapture(){
  let mode='live',owner,records=[],cursor=null,sequence=0;

  function ingest(events,nextOwner){
    if(mode==='held')return;
    if(owner!==nextOwner){
      owner=nextOwner;
      records=[];
      cursor=null;
    }
    const pending=[];
    for(let i=(events?.length??0)-1;i>=0&&(mode==='armed'||pending.length<maxRecords);i--){
      const event=events[i];
      if(event.type!=='i2c')continue;
      const key=packetKey(event);
      if(key===cursor)break;
      pending.push({event,key});
    }
    for(const {event,key} of pending.reverse()){
      cursor=key;
      records.push({id:++sequence,event});
      if(records.length>maxRecords)records.shift();
      if(mode==='armed'&&event.status!==0){mode='held';break;}
    }
  }

  return {
    ingest,
    freeze:()=>{mode='held';},
    follow:()=>{mode='live';},
    arm(events,owner){mode='live';ingest(events,owner);mode='armed';},
    clear(){records=[];},
    get mode(){return mode;},
    get records(){return records;}
  };
}
