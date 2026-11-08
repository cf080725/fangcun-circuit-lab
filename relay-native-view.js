const plotX=fraction=>+(58+292*fraction).toFixed(2);

export function relaySignalPath(duty,highFirst) {
  const high=7,low=23;
  if(duty===0||duty===1)return `M58 ${duty?high:low}H350`;
  const edge=plotX(highFirst?duty:1-duty);
  return highFirst?`M58 ${high}H${edge}V${low}H350`:`M58 ${low}H${edge}V${high}H350`;
}

export function createRelayScope() {
  return {cycle:[],complete:[],lastTime:null};
}

export function recordRelayScope(scope,{phaseMs,periodMs,timeMs,closed,lit}) {
  if(!Number.isFinite(phaseMs)||phaseMs<0||phaseMs>=periodMs||!Number.isFinite(timeMs))return false;
  if(scope.lastTime!==null&&timeMs<=scope.lastTime)return false;
  const last=scope.cycle.at(-1);
  if(last&&phaseMs<last.phaseMs){
    scope.complete=scope.cycle;
    scope.cycle=[];
  }else if(last&&phaseMs-last.phaseMs<Math.max(1,periodMs/128))return false;
  scope.cycle.push({phaseMs,closed,lit});
  scope.lastTime=timeMs;
  return true;
}

export function relaySamplePath(samples,periodMs,field,high,low) {
  let penDown=false;
  return samples.map(sample=>{
    if(typeof sample[field]!=='boolean'){penDown=false;return '';}
    const x=plotX(sample.phaseMs/periodMs),y=sample[field]?high:low;
    const command=penDown?`H${x}V${y}`:`M${x} ${y}`;
    penDown=true;
    return command;
  }).join(' ');
}
