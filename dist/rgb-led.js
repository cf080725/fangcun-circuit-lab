export const kingbrightRgbModel = 'kingbright-wp154a4';

// Low-current tangent fits from the 25°C I–V curves on page 3 of Kingbright
// WP154A4SUREQBFZGW V.12A, near the 3.3 V lesson's three operating points.
export const kingbrightRgbForward = Object.freeze({
  R:Object.freeze({vf:1.715,r:23}),
  G:Object.freeze({vf:2.438,r:115}),
  B:Object.freeze({vf:2.561,r:49})
});

export function rgbPwmCycle(pins) {
  if (pins.some(({p})=>!Number.isFinite(p.pwm.duty)||p.pwm.duty<0||p.pwm.duty>1)) return null;
  const changing = pins.filter(({p})=>p.pwm.duty>0&&p.pwm.duty<1);
  if (changing.length>3) return null;
  const highFirst = pwm => pwm.highFirst ?? (Number.isFinite(pwm.startMs) ? true : undefined);
  if (changing.length>1) {
    const first = changing[0].p.pwm;
    const frequency = first.frequencyHz ?? first.frequency;
    if (first.timer==null || !Number.isFinite(frequency) || frequency<=0 || changing.some(({p:{pwm}})=>
      pwm.timer!==first.timer || (pwm.frequencyHz??pwm.frequency)!==frequency ||
      pwm.startMs!==first.startMs || pwm.endMs!=null || typeof highFirst(pwm)!=='boolean')) return null;
  }
  const edge = pwm => highFirst(pwm)===false ? 1-pwm.duty : pwm.duty;
  const boundaries = [...new Set([0,...changing.map(({p})=>edge(p.pwm)),1])].sort((a,b)=>a-b);
  const phases = boundaries.slice(1).map((end,index)=>{
    const start = boundaries[index];
    const levels = pins.map(pin=>{
      const {pwm}=pin.p;
      const high = highFirst(pwm)===false ? start>=edge(pwm) : start<edge(pwm);
      return [pin,pwm.duty===0||pwm.duty===1 ? pwm.duty : Number(high)];
    });
    return {weight:end-start,levels};
  });
  return {method:changing.length>1?'synchronized-cycle':changing.length?'single-pwm':'dc',phases};
}
