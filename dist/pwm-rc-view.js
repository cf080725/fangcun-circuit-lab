const charts = new WeakMap();
const timeLabel = ms => Number(ms.toFixed(4)) + ' ms';
const xStart = 86, xEnd = 540;

function cycleChart(reading) {
  const {frequencyHz,duty,timeConstantMs,voltageLow,voltageHigh,voltageMin,voltageMax} = reading;
  const period = 1000/frequencyHz, highTime = duty*period;
  const x = ms => xStart+(xEnd-xStart)*ms/period;
  const ripple = voltageMax-voltageMin;
  const y = voltage => ripple>1e-9 ? 119-37*Math.max(0,Math.min(1,(voltage-voltageMin)/ripple)) : 101;
  const points = [[0,voltageMin]];
  for (const [start,duration,from,to] of [[0,highTime,voltageMin,voltageHigh],[highTime,period-highTime,voltageMax,voltageLow]]) {
    for (let i=1;i<=20;i++) {
      const t=duration*i/20;
      points.push([start+t,to+(from-to)*Math.exp(-t/timeConstantMs)]);
    }
  }
  const capacitorPath=points.map(([t,v],index)=>`${index?'L':'M'}${x(t).toFixed(2)} ${y(v).toFixed(2)}`).join('');
  const edge=x(highTime).toFixed(2);
  const pulse=duty===0?`M${xStart} 53H${xEnd}`:duty===1?`M${xStart} 25H${xEnd}`:`M${xStart} 25H${edge}V53H${xEnd}`;
  return `<figure class="pwm-rc-cycle"><figcaption>稳态一周期 · 高电平 ${timeLabel(highTime)} / 总周期 ${timeLabel(period)}</figcaption>
    <svg viewBox="0 0 555 147" role="img" aria-label="上方为 PWM 输入，下方为稳态电容电压，电容纵轴放大。">
     <g font-size="13" fill="#3e6155"><text x="5" y="42">PWM 输入</text><text x="5" y="103">电容电压</text>
      <text x="${xStart}" y="143">0</text><text x="${xEnd}" y="143" text-anchor="end">${timeLabel(period)}</text></g>
     <path d="M${xStart} 25H${xEnd}M${xStart} 53H${xEnd}M${xStart} 82H${xEnd}M${xStart} 119H${xEnd}" stroke="#d5e3db" fill="none"/>
     <path d="M${edge} 20V123" stroke="#99ad9f" stroke-dasharray="3 3"/>
     <path d="${pulse}" stroke="#335d94" stroke-width="2.3" fill="none"/>
     <path d="${capacitorPath}" stroke="#1c765c" stroke-width="2.4" fill="none"/>
     <path class="pwm-rc-phase" d="M0 20V123" stroke="#ac622c" stroke-dasharray="2 4" fill="none"/>
    </svg><p>电容端 ${voltageMin.toFixed(4)}–${voltageMax.toFixed(4)} V。纵轴放大显示纹波，橙线标出当前 PWM 相位。</p></figure>`;
}

export function renderPwmRcScope(host,reading) {
  if (!reading) {
    if (charts.delete(host)) host.replaceChildren();
    return;
  }
  const key=[reading.frequencyHz,reading.duty,reading.timeConstantMs,reading.voltageLow,reading.voltageHigh,reading.voltageMin,reading.voltageMax].join('|');
  if (charts.get(host)!==key) {
    host.innerHTML=cycleChart(reading);
    charts.set(host,key);
  }
  const phase=host.querySelector('.pwm-rc-phase');
  const ratio=Math.max(0,Math.min(1,reading.phaseMs*reading.frequencyHz/1000));
  const translate=`translate(${(xStart+(xEnd-xStart)*ratio).toFixed(2)} 0)`;
  if(phase.getAttribute('transform')!==translate)phase.setAttribute('transform',translate);
}
