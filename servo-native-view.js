export const servoTurnWindowMs = 400;

export function createServoTurnTrace(angle) {
  return {samples:[{timeMs:0,angle,targetAngle:null}],peakMa:null,reachedMs:null};
}

export function recordServoTurn(trace,timeMs,reading) {
  const last=trace.samples.at(-1);
  if(!Number.isFinite(timeMs)||timeMs-last.timeMs<2||timeMs>servoTurnWindowMs||
      !Number.isFinite(reading?.angle))return false;
  const {angle,targetAngle,currentMa}=reading;
  trace.samples.push({timeMs,angle,targetAngle});
  if(Number.isFinite(currentMa))trace.peakMa=Math.max(trace.peakMa??0,currentMa);
  if(trace.reachedMs===null&&reading.active&&!reading.moving&&Number.isFinite(targetAngle)&&
      Math.abs(trace.samples[0].angle-targetAngle)>.05&&Math.abs(angle-targetAngle)<.05)trace.reachedMs=timeMs;
  return true;
}

export function servoTurnPath(samples,field) {
  let penDown=false;
  return samples.map(sample=>{
    if(!Number.isFinite(sample[field])){penDown=false;return '';}
    const x=36+314*sample.timeMs/servoTurnWindowMs;
    const angle=Math.max(30,Math.min(150,sample[field]));
    const point=`${penDown?'L':'M'}${x.toFixed(2)},${(7+(150-angle)*.6).toFixed(2)}`;
    penDown=true;
    return point;
  }).join(' ');
}
