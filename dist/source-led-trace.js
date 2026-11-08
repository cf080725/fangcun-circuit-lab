import {canSampleSourceTrace,emptySourceTrace,sampleSourceTrace,sourceTraceWindowMs} from './source-trace.js';

const emptyLedTrace=()=>({...emptySourceTrace(),originMs:null});

export function createSourceLedTrace() {
  let context=null,current=null,comparison=null;

  function reset() {
    context=null;
    current=null;
    comparison=null;
  }

  function sync({key,id,enabled=true}={}) {
    if (!enabled || ![key,id].every(value=>typeof value==='string' && value.length)) {
      reset();
      return;
    }
    if (context?.key===key && context.id===id) return;
    context=Object.freeze({key,id});
    current=emptyLedTrace();
    comparison=null;
  }

  function canSample(absoluteMs) {
    return current!==null && Number.isFinite(absoluteMs) && absoluteMs>=0 &&
      canSampleSourceTrace(current,absoluteMs-(current.originMs??absoluteMs));
  }

  function capture(absoluteMs,currentMa) {
    if (!canSample(absoluteMs) || (currentMa!==null && !Number.isFinite(currentMa))) return null;
    return {context,absoluteMs,currentMa};
  }

  function record(sample) {
    if (sample?.context!==context || !canSample(sample.absoluteMs)) return;
    // Start at the first committed frame, even if its reading was unavailable.
    current.originMs??=sample.absoluteMs;
    sampleSourceTrace(current,sample.absoluteMs-current.originMs,sample.currentMa,'currentMa');
  }

  function beginComparison() {
    if (!context) return;
    const {id}=context,before=current;
    context=Object.freeze({...context});
    current=emptyLedTrace();
    comparison=before.samples.length ? {id,kind:'led',windowMs:sourceTraceWindowMs,before,after:current} : null;
  }

  return {sync,canSample,capture,record,beginComparison,reset,
    get current(){return current;},
    get comparison(){return comparison;}};
}
