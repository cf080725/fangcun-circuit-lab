import {motorModeLabel,motorStopWindowMs} from './motor-bridge-lesson.js';

const previousRender=new WeakMap();
const chartLeft=64,chartRight=412,laneHeight=38;
const signed=(value,unit)=>(Math.round(value)||0).toLocaleString('zh-CN')+' '+unit;
const plotX=ms=>chartLeft+ms/motorStopWindowMs*(chartRight-chartLeft);

function lane(traces,field,unit,top){
  const values=traces.flatMap(({trace})=>trace.samples.map(sample=>sample[field]));
  const low=Math.min(0,...values),high=Math.max(0,...values);
  const scale=Math.max(1,high-low);
  const y=value=>top+laneHeight*(Math.max(high,low+1)-value)/scale;
  const grid=[0,100,200,300].map(ms=>`<path class="trace-grid" d="M ${plotX(ms)} ${top} v ${laneHeight}"/>`).join('');
  const paths=traces.map(({trace,tone})=>{
    const points=trace.samples.map(s=>`${plotX(s.ms).toFixed(2)},${y(s[field]).toFixed(2)}`);
    return `<g class="trace-series ${tone}"><polyline points="${points.join(' ')}" fill="none"/><circle cx="${plotX(trace.samples[0].ms)}" cy="${y(trace.samples[0][field])}" r="2"/></g>`;
  }).join('');
  const zero=low<0&&high>0?`<path class="trace-grid" d="M ${chartLeft} ${y(0)} H ${chartRight}"/>`:'';
  const magnitude=Math.max(Math.abs(low),Math.abs(high));
  const limit=value=>field==='rpm'&&magnitude>=1000&&value!==0?Math.round(value/100)/10+'k '+unit:signed(value,unit);
  return `<rect class="trace-lane" x="${chartLeft}" y="${top}" width="${chartRight-chartLeft}" height="${laneHeight}" rx="2"/>${grid}${zero}${paths}
    <text class="trace-axis" x="${chartLeft-5}" y="${top+8}" text-anchor="end">${limit(high)}</text>
    <text class="trace-axis" x="${chartLeft-5}" y="${top+laneHeight}" text-anchor="end">${limit(low)}</text>`;
}

function rpmAt100(samples){
  const right=samples.findIndex(sample=>sample.ms>=100);
  if(right<1)return null;
  const a=samples[right-1],b=samples[right];
  return a.rpm+(b.rpm-a.rpm)*(100-a.ms)/(b.ms-a.ms);
}

export function renderMotorStopTrace(host,before,current){
  const last=current?.samples.at(-1);
  const prev=previousRender.get(host);
  if(prev&&prev.before===before&&prev.current===current&&prev.last===last)return;
  previousRender.set(host,{before,current,last});
  const traces=[{trace:before,tone:'trace-before',label:'应用前'}, {trace:current,tone:'trace-after',label:'本次'}]
    .filter(({trace})=>trace?.samples.length);
  if(!traces.length){host.innerHTML='<p>先运行，等电机由驱动进入滑行或电刹车。这里会记录停转指令后的转速和电流。</p>';return;}
  const rows=traces.map(({trace,label})=>{
    const {rpm,currentMa}=trace.samples[0],later=rpmAt100(trace.samples);
    const near=later===null?'等待采样':signed(later,'rpm');
    return `<tr><th scope="row">${label} · ${motorModeLabel(trace.mode)}</th><td>${signed(rpm,'rpm')}</td><td>${near}</td><td>${signed(currentMa,'mA')}</td></tr>`;
  }).join('');
  const ticks=[0,100,200,300].map((ms,i)=>`<text class="trace-axis" x="${plotX(ms)}" y="114" text-anchor="${i===0?'start':i===3?'end':'middle'}">${ms} ms</text>`).join('');
  const legend=traces.map(({trace,tone,label})=>`<span class="${tone}">${label} ${motorModeLabel(trace.mode)}</span>`).join('');
  host.innerHTML=`<div class="motor-stop-legend">${legend}</div>
    <svg viewBox="0 0 425 119" role="img" aria-label="停转后的转速和有方向的绕组电流，上图是转速，下图是电流">${lane(traces,'rpm','rpm',5)}${lane(traces,'currentMa','mA',59)}${ticks}</svg>
    <div class="motor-stop-table"><table><thead><tr><th>停转方式</th><th>开始转速</th><th>100 ms 后</th><th>开始电流</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p>0 ms 对应桥臂切换。100 ms 的转速用相邻采样插值。电流负值表示反向流动。模型省略绕组电感，切换时的电流可以跳变。</p>`;
}
