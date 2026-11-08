export const sourceTraceWindowMs=5000;
export const sourceTraceMaxSamples=1024;

export function emptySourceTrace() {
  return {samples:[],sampledThroughMs:null};
}

export function canSampleSourceTrace(trace,timeMs) {
  if (!Number.isFinite(timeMs) || timeMs<0 || timeMs>sourceTraceWindowMs) return false;
  const previous=trace.samples.at(-1);
  return previous?.timeMs===timeMs ||
    ((!previous || timeMs>previous.timeMs) && trace.samples.length<sourceTraceMaxSamples);
}

export function sampleSourceTrace(trace,timeMs,reading,field='voltage') {
  if ((reading!==null && !Number.isFinite(reading)) || !canSampleSourceTrace(trace,timeMs)) return;
  const previous=trace.samples.at(-1);
  // Step and run can solve repeatedly without advancing virtual time. The
  // latest measured state wins without adding another point at that instant.
  if (previous?.timeMs===timeMs) {
    previous[field]=reading;
    return;
  }
  trace.samples.push({timeMs,[field]:reading});
  trace.sampledThroughMs=timeMs;
}

export function nearestSourceSample(trace,timeMs,field='voltage') {
  const {samples}=trace;
  if (!samples.length || !Number.isFinite(timeMs) ||
      timeMs<samples[0].timeMs || timeMs>samples.at(-1).timeMs) return null;
  const next=samples.findIndex(sample=>sample.timeMs>=timeMs);
  if (next===0 || samples[next].timeMs===timeMs) return samples[next];
  const left=samples[next-1],right=samples[next];
  // A missing reading breaks coverage on both sides. Keep its real timestamp
  // instead of borrowing a reading from the other side of the gap.
  if (left[field]===null && right[field]!==null) return left;
  if (right[field]===null && left[field]!==null) return right;
  return timeMs-left.timeMs<=right.timeMs-timeMs ? left : right;
}
