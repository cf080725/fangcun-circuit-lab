export const hcsr04Pins = Object.freeze(['VCC','TRIG','ECHO','GND']);
export const hcsr04Limits = Object.freeze({minimumDistanceCm:2,maximumDistanceCm:400,halfAngleDeg:7.5,
  speedCmPerSecond:34300,minimumTriggerUs:10,emissionMs:.2,retriggerMs:60,minimumVoltage:4.75,maximumVoltage:5.25});
export const hcsr04EchoOhms = 50;
const timeEpsilon = 1e-8;

export function hcsr04TriggerLevel(voltage) {
  if (voltage >= -.3 && voltage <= .8+1e-6) return 0;
  if (voltage >= 2-1e-6 && voltage <= 5.5) return 1;
  return null;
}

export function hcsr04Powered(voltage) {
  return voltage>=hcsr04Limits.minimumVoltage-1e-6 && voltage<=hcsr04Limits.maximumVoltage+1e-6;
}

function acceptedShot(part, triggerRiseMs, triggerAtMs, triggerWidthUs) {
  const {distanceCm=100,bearingDeg=0,targetPresent=true} = part;
  const targetSnapshot = {distanceCm,bearingDeg,targetPresent};
  const {minimumDistanceCm,maximumDistanceCm,halfAngleDeg,speedCmPerSecond,emissionMs} = hcsr04Limits;
  let missReason = null;
  if (!targetPresent) missReason='removed';
  else if (!Number.isFinite(distanceCm) || distanceCm<minimumDistanceCm || distanceCm>maximumDistanceCm) missReason='outside-range';
  else if (!Number.isFinite(bearingDeg) || Math.abs(bearingDeg)>halfAngleDeg) missReason='outside-beam';
  const emissionEndMs = triggerAtMs+emissionMs;
  const echoWidthUs = missReason ? null : 2*distanceCm/speedCmPerSecond*1e6;
  const echoStartMs = missReason ? null : emissionEndMs;
  const echoEndMs = echoStartMs===null ? null : echoStartMs+echoWidthUs/1000;
  return {triggerRiseMs,triggerAtMs,triggerWidthUs,emissionEndMs,echoStartMs,echoEndMs,echoWidthUs,targetSnapshot,missReason};
}

const noShot = Object.freeze({triggerRiseMs:null,triggerAtMs:null,triggerWidthUs:null,emissionEndMs:null,
  echoStartMs:null,echoEndMs:null,echoWidthUs:null,targetSnapshot:null,missReason:null});

export function advanceUltrasonic(part, previous, timeMs, {voltage, triggerLevel, reason=null}) {
  const powered = hcsr04Powered(voltage);
  if (reason || !powered) {
    return {state:null,data:{...noShot,voltage,powered,triggerLevel:null,echoLevel:powered?0:null,
      lastTriggerWidthUs:null,status:reason??'unpowered'}};
  }
  let {riseMs=null,shot=null,rejection=null,lastTriggerWidthUs=null}=previous??{};
  if (triggerLevel===1 && previous?.triggerLevel!==1) {
    riseMs=timeMs;
    rejection=null;
  } else if (triggerLevel===0 && previous?.triggerLevel===1 && riseMs!==null) {
    lastTriggerWidthUs=(timeMs-riseMs)*1000;
    if (lastTriggerWidthUs < hcsr04Limits.minimumTriggerUs-timeEpsilon) rejection='trigger-short';
    else if (shot && timeMs-shot.triggerAtMs < hcsr04Limits.retriggerMs-timeEpsilon) rejection='cooldown';
    else {
      shot=acceptedShot(part,riseMs,timeMs,lastTriggerWidthUs);
      rejection=null;
    }
    riseMs=null;
  } else if (triggerLevel===null) riseMs=null;

  const echoLevel=Number(shot?.echoStartMs!=null && timeMs>=shot.echoStartMs && timeMs<shot.echoEndMs);
  const emitting=shot && timeMs<shot.emissionEndMs;
  const status=echoLevel ? 'echo-high' : emitting ? 'emitting' : triggerLevel===1 ? 'trigger-high' :
    rejection ?? (shot?.missReason ? 'no-target' : shot ? 'complete' : 'idle');
  return {state:{triggerLevel,riseMs,shot,rejection,lastTriggerWidthUs},
    data:{...(shot??noShot),targetSnapshot:shot?{...shot.targetSnapshot}:null,voltage,powered,triggerLevel,echoLevel,lastTriggerWidthUs,status}};
}

export function scheduledEchoPulse(reading,timeMs,level,timeoutUs) {
  if (level!==1 || !reading?.powered || reading.echoStartMs===null || reading.echoStartMs<=timeMs) return null;
  const elapsedUs=(reading.echoEndMs-timeMs)*1000;
  if (elapsedUs>timeoutUs+timeEpsilon) return null;
  return {widthUs:reading.echoWidthUs,elapsedUs:Math.min(elapsedUs,timeoutUs)};
}
