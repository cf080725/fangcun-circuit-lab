import {pwmPhaseMs} from './pwm-rc.js';

export const groveRelayPins = Object.freeze(['SIG','NC','VCC','GND','COM','NO']);
export const groveRelayContactOhms = .05;
export const groveRelayIdleOhms = 5e6;
const operateMs = 10;
const releaseMs = 5;
const epsilon = 1e-7;

export const groveRelayPowered = volts => volts>=3.3-1e-6 && volts<=5+1e-6;
export const groveRelayHigh = volts => volts>=2;
// The v1.2 schematic regulates its 3 V coil. Use the vendor module's
// approximate 100 mA operating draw and a passive continuation under sag.
export const groveRelayLoadOhms = volts => volts/.1;

export function groveRelayWave(pwm,timeMs) {
  const frequency = pwm?.frequencyHz ?? pwm?.frequency;
  const periodMs = 1000/frequency;
  const duty = pwm?.duty;
  if (!Number.isFinite(periodMs) || periodMs<=0 || !Number.isFinite(duty) || duty<0 || duty>1) return null;
  const phase = Number.isFinite(pwm.phaseMs) ? pwm.phaseMs :
    Number.isFinite(pwm.startMs) && pwm.startMs<=timeMs ? pwmPhaseMs(timeMs,pwm.startMs,periodMs) : null;
  const phaseMs = phase!==null&&phase>=0&&phase<periodMs ? phase : null;
  return {periodMs,pulseMs:periodMs*duty,phaseMs,highFirst:pwm.highFirst!==false,
    timer:pwm.timer,channel:pwm.channel,startMs:pwm.startMs};
}

function segment(wave,phase) {
  const {periodMs,pulseMs,highFirst}=wave;
  const edge=highFirst?pulseMs:periodMs-pulseMs;
  const first=phase<edge;
  return {high:first===highFirst,end:first?edge:periodMs,start:first?0:edge};
}

function applyLevel(state,inputHigh,duration,maximum=Infinity) {
  const limit=inputHigh?operateMs:releaseMs;
  const heldMs=Math.min(limit,maximum,(state.inputHigh===inputHigh?state.heldMs:0)+duration);
  return {inputHigh,heldMs,closed:heldMs+epsilon>=limit?inputHigh:state.closed};
}

function measuredElapsed(previous,wave,elapsed) {
  if(previous?.phaseMs==null||!['periodMs','pulseMs','highFirst','timer','channel','startMs']
    .every(key=>previous[key]===wave[key])) return null;
  if(!elapsed) return 0;
  const period=wave.periodMs;
  const remainder=pwmPhaseMs(wave.phaseMs,previous.phaseMs,period);
  const wraps=Math.max(0,Math.round((elapsed-remainder)/period));
  const measured=remainder+wraps*period;
  // Native CNT advances at the worker's executed timer ticks. A submitted
  // virtual-time budget can be a few percent longer across many chunks.
  const tolerance=Math.min(period/4,Math.max(1,elapsed*.1));
  return Math.abs(measured-elapsed)<=tolerance?measured:null;
}

function advanceWave(contact,wave,duration) {
  const {periodMs,phaseMs}=wave;
  let phase=pwmPhaseMs(phaseMs,duration,periodMs);
  if(periodMs-phase<epsilon)phase=0;
  const run=length=>{
    let remaining=length;
    while(remaining>epsilon){
      const current=segment(wave,phase);
      const step=Math.min(remaining,current.end-phase);
      contact=applyLevel(contact,current.high,step);
      remaining-=step;
      phase=phase+step>=periodMs-epsilon?0:phase+step;
    }
  };
  // Once a full cycle has elapsed, repeating it from the same phase cannot
  // change the resulting contact state or the capped time at that level.
  if(duration>2*periodMs){
    run(periodMs);
    duration=periodMs+(duration-periodMs)%periodMs;
  }
  run(duration);
  return contact;
}

export function advanceGroveRelay(previous,part,timeMs,{powered,connected,controlKey,inputHigh,wave}) {
  const prior=previous?.part===part?previous:null;
  const initial={closed:false,inputHigh:false,heldMs:0};
  const record=contact=>({...contact,part,timeMs,powered,connected,controlKey,wave});
  if(!powered||!connected)return record(initial);
  const old=prior?.powered&&prior.connected&&prior.controlKey===controlKey?prior:null;
  const elapsed=old?Math.max(0,timeMs-old.timeMs):0;
  const phased=wave?.phaseMs!=null&&wave.pulseMs>epsilon&&wave.pulseMs<wave.periodMs-epsilon;
  const current=phased?segment(wave,wave.phaseMs):null;
  if(current?.high===inputHigh){
    const priorWave=old?.wave;
    const measured=measuredElapsed(priorWave,wave,elapsed);
    if(measured!==null)return record(applyLevel(advanceWave(old,wave,measured),inputHigh,0));
    // A first known pulse can account for its observed phase since the last
    // powered, connected observation. A changed timer cannot backdate motion.
    const known=!priorWave?Math.min(elapsed,wave.phaseMs-current.start):0;
    return record(applyLevel({...initial,closed:old?.closed??false},inputHigh,known));
  }
  // With ordinary GPIO or incomplete phase data, time only accumulates
  // across observations at the same level. A new edge starts a fresh wait.
  const continuous=old?.inputHigh===inputHigh;
  const pulsing=wave&&wave.pulseMs>0&&wave.pulseMs<wave.periodMs;
  const maximum=pulsing?(inputHigh?wave.pulseMs:wave.periodMs-wave.pulseMs):Infinity;
  return record(applyLevel(continuous?old:{...initial,closed:old?.closed??false},
    inputHigh,continuous?elapsed:0,maximum));
}
