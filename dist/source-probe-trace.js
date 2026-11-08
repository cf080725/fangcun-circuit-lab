import {canSampleSourceTrace,emptySourceTrace,sampleSourceTrace,sourceTraceWindowMs} from './source-trace.js';

export function createSourceProbeTrace() {
  let context=null,current=null,comparison=null;

  function reset() {
    context=null;
    current=null;
    comparison=null;
  }

  function sync({key,red,black,enabled=true}={}) {
    if (!enabled || ![key,red,black].every(value=>typeof value==='string' && value.length)) {
      reset();
      return;
    }
    if (context?.key===key && context.red===red && context.black===black) return;
    context=Object.freeze({key,red,black});
    current=emptySourceTrace();
    comparison=null;
  }

  function canSample(timeMs) {
    return current!==null && canSampleSourceTrace(current,timeMs);
  }

  function capture(timeMs,result) {
    if (!canSample(timeMs)) return null;
    const reading=result?.measureBetween?.(context.red,context.black);
    const voltage=reading?.status==='measured' && Number.isFinite(reading.voltage) ? reading.voltage : null;
    return {context,timeMs,voltage};
  }

  function record(sample) {
    if (current && sample?.context===context) sampleSourceTrace(current,sample.timeMs,sample.voltage);
  }

  function beginComparison() {
    if (!context) return;
    const {red,black}=context,before=current;
    // A delayed boundary captured by the old run must never enter the new one.
    context=Object.freeze({...context});
    current=emptySourceTrace();
    comparison=before.samples.length ? {red,black,windowMs:sourceTraceWindowMs,before,after:current} : null;
  }

  return {sync,canSample,capture,record,beginComparison,reset,
    get current(){return current;},
    get comparison(){return comparison;}};
}
