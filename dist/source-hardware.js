import {mountedConnections,signalStrip} from './breadboard-mount.js';
import {PARTS} from './circuit.js';
import {mountedPartContacts} from './part-mount.js';

export function sameSourceFiles(applied, draft) {
  const names = Object.keys(draft);
  return Object.keys(applied).length === names.length && names.every(name =>
    Object.hasOwn(applied, name) && applied[name] === draft[name]);
}

function stripKey(endpoint) {
  const strip=signalStrip(endpoint);
  return strip ? `${strip.rows}:${strip.column}` : endpoint;
}

function attachedEndpoints(wires, contacts) {
  const wired=new Set(wires.flatMap(({a,b})=>[a,b]));
  const wiredStrips=new Set([...wired].map(stripKey));
  const mountedByStrip=new Map();
  for (const {a,b} of contacts) {
    const strip=stripKey(b);
    if (!mountedByStrip.has(strip)) mountedByStrip.set(strip,new Set());
    mountedByStrip.get(strip).add(a);
  }
  for (const [strip,pins] of mountedByStrip) {
    if (wiredStrips.has(strip) || pins.size>1) for (const pin of pins) wired.add(pin);
  }
  return wired;
}

export function sourceCircuitKey(circuit, profile) {
  const contacts=[...mountedConnections(circuit,profile),...circuit.components.flatMap(mountedPartContacts)];
  const attached=attachedEndpoints(circuit.wires,contacts);
  const parts=circuit.components.map(part=>{
    const model=PARTS[part.type];
    const connectedButton=part.type==='button' && ['1','2'].some(pin=>attached.has(`${part.id}:${pin}`)) &&
      ['3','4'].some(pin=>attached.has(`${part.id}:${pin}`));
    const settings=Object.entries(model?.defaults??{}).filter(([key])=>key!=='pressed'||connectedButton)
      .map(([key,value])=>[key,part[key]??value]);
    if(part.type==='ldr'&&part.ldrModel==='pdv-p8103')settings.push(['ldrModel',part.ldrModel],['ldrCovered',Boolean(part.ldrCovered)]);
    return JSON.stringify([part.id,part.type,model?null:part.pins,settings]);
  }).sort();
  const edges=connections=>connections.map(({a,b})=>JSON.stringify([a,b].sort())).sort();
  return JSON.stringify([profile.id,Boolean(circuit.powered),Boolean(circuit.boot0),
    Boolean(profile.userButton&&circuit.board?.userButtonPressed),parts,edges(circuit.wires),edges(contacts)]);
}

export function sourceObservation(snapshot, state, converged) {
  const {pin,voltage,light,pwm,activity,servo,pwmRc,sevenSegment,sonar,temperature}=snapshot;
  if (!converged || state.error || !state.executedSteps || !Number.isFinite(voltage) || !Number.isFinite(state.timeMs)) return null;
  if (!state.timeMs && !state.done && !activity?.write && !activity?.pwm && !activity?.adc) return null;
  return {pin,timeMs:state.timeMs,voltage,
    light:light?{id:light.id,name:light.name,brightness:light.instantaneousBrightness,currentMa:light.currentMa}:null,
    pwm:pwm?{frequencyHz:pwm.frequencyHz,duty:pwm.duty}:null,
    adc:activity?.adc?{raw:activity.adcReading,max:activity.adcMax}:null,
    ...(servo?{servo:{id:servo.id,pulseUs:servo.pulseUs,angle:servo.angle,targetAngle:servo.targetAngle}}:{}),
    ...(pwmRc?{pwmRc:{id:pwmRc.id,duty:pwmRc.duty,frequencyHz:pwmRc.frequencyHz,voltageMean:pwmRc.voltageMean,ripplePp:pwmRc.ripplePp}}:{}),
    ...(sevenSegment?{sevenSegment:{id:sevenSegment.id,digit:sevenSegment.digit,decimal:sevenSegment.decimal,mask:sevenSegment.mask,on:sevenSegment.on,
      totalMa:sevenSegment.segments.reduce((total,segment)=>total+segment.currentMa,0)}}:{}),
    ...(sonar?{sonar:{widthUs:sonar.widthUs,cm:sonar.cm}}:{}),
    ...(temperature?{temperature:{word:temperature.word,measuredC:temperature.measuredC}}:{}),
    waitMs:activity?.wait?.durationMs,intervalMs:activity?.intervalMs};
}

export function sourceSignalActivity(state, pin) {
  let write, pwm, adc, wait, change;
  let intervalMs;
  const events = state.events ?? [];
  const timer = state.pins?.[pin]?.pwm;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === 'delay' && !wait) wait = event;
    if (event.type === 'adc' && event.pin === pin && !adc) adc = event;
    if (event.type === 'pwm' && !pwm && timer && (event.pin === pin ||
      (event.timer === timer.timer && event.channel != null && event.channel === timer.channel))) pwm = event;
    if (event.type !== 'gpio' || event.pin !== pin) continue;
    write ??= event;
    if (event.value === event.previous) continue;
    if (!change) change = event;
    else if (intervalMs === undefined) intervalMs = change.timeMs - event.timeMs;
  }
  const adcMax=adc?(adc.bits?2**adc.bits-1:state.adcMax):undefined;
  const adcReading=adc?(adc.bits?adc.value:adc.raw):undefined;
  return {write, pwm, adc, adcReading, adcMax, wait, intervalMs};
}
