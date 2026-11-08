import {sonarMissLabels,targetBearingMax,targetDistanceMax} from './ultrasonic-lesson.js';
import {hcsr04Limits} from './ultrasonic.js';

const origin={x:30,y:139}, scale=.60;
const {minimumDistanceCm,maximumDistanceCm,halfAngleDeg}=hcsr04Limits;
const rad=degrees=>degrees*Math.PI/180;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function project(distance,bearing){
  return {x:origin.x+distance*scale*Math.cos(rad(bearing)),y:origin.y-distance*scale*Math.sin(rad(bearing))};
}
function fan(distance){
  const left=project(distance,halfAngleDeg),right=project(distance,-halfAngleDeg);
  return `M${origin.x} ${origin.y} L${left.x} ${left.y} A${distance*scale} ${distance*scale} 0 0 1 ${right.x} ${right.y}Z`;
}

export function mountUltrasonicTarget(host,{onChange,onFinish}){
  host.innerHTML=`<svg viewBox="0 -18 326 314" aria-hidden="true">
    <path class="sonar-fan" d="${fan(maximumDistanceCm)}"/>
    <path class="sonar-near" d="${fan(minimumDistanceCm)}"/>
    <path class="sonar-axis" d="M30 139 H304"/>
    <g class="sonar-marks">${[100,200,300,400].map(n=>{
      const {x}=project(n,0);return `<path d="M${x} 135v8"/><text x="${x}" y="167" text-anchor="middle">${n}</text>`;
    }).join('')}<text x="315" y="167" text-anchor="end">cm</text></g>
    <rect class="sonar-origin" x="20" y="123" width="10" height="32" rx="2"/>
    <text class="sonar-origin-label" x="20" y="112">探头</text>
    <text class="sonar-angle-label" x="292" y="115" text-anchor="end">±${halfAngleDeg}°</text>
    <path class="sonar-distance-line" d="M30 139L30 139"/>
    <g class="sonar-target" data-target><circle r="21" fill="transparent"/><circle class="sonar-target-dot" r="10"/><circle class="sonar-target-center" r="2.7"/></g>
  </svg>`;
  const svg=host.firstElementChild,target=svg.querySelector('[data-target]'),line=svg.querySelector('.sonar-distance-line');
  let drag=null,prior=null;
  const svgPoint=event=>{
    const screen=svg.getScreenCTM();
    return screen&&new DOMPoint(event.clientX,event.clientY).matrixTransform(screen.inverse());
  };
  function move(event){
    if(event.pointerId!==drag?.pointer)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.clientX,event.clientY-drag.clientY)<4)return;
    const p=svgPoint(event);
    if(!p)return;
    drag.moved=true;
    const x=Math.max(0,p.x+drag.offsetX-origin.x), y=origin.y-p.y-drag.offsetY;
    onChange({distanceCm:Math.round(clamp(Math.hypot(x,y)/scale,0,targetDistanceMax)),
      bearingDeg:Math.round(clamp(Math.atan2(y,x)*180/Math.PI,-targetBearingMax,targetBearingMax))});
  }
  function finish(event){
    if(drag?.pointer!==event.pointerId)return;
    drag=null;
    host.classList.remove('is-dragging');
    onFinish();
  }
  target.addEventListener('pointerdown',event=>{
    if(drag||event.button!==0||!prior?.targetPresent||prior.locked)return;
    const point=svgPoint(event);
    if(!point)return;
    const center=project(prior.distanceCm,prior.bearingDeg);
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    drag={pointer:event.pointerId,clientX:event.clientX,clientY:event.clientY,offsetX:center.x-point.x,offsetY:center.y-point.y};
    host.classList.add('is-dragging');
  });
  target.addEventListener('pointermove',move);
  target.addEventListener('pointerup',event=>{move(event);finish(event);});
  target.addEventListener('pointercancel',finish);
  target.addEventListener('lostpointercapture',finish);
  return state=>{
    if(!state)return;
    const {distanceCm,bearingDeg,targetPresent,locked}=state;
    if(prior?.distanceCm===distanceCm&&prior.bearingDeg===bearingDeg&&prior.targetPresent===targetPresent&&prior.locked===locked)return;
    prior={distanceCm,bearingDeg,targetPresent,locked};
    const {x,y}=project(distanceCm,bearingDeg);
    target.setAttribute('transform',`translate(${x} ${y})`);
    target.style.display=targetPresent?'':'none';
    line.style.display=targetPresent?'':'none';
    line.setAttribute('d',`M${origin.x} ${origin.y}L${x} ${y}`);
    host.dataset.inBeam=String(distanceCm>=minimumDistanceCm&&distanceCm<=maximumDistanceCm&&Math.abs(bearingDeg)<=halfAngleDeg);
    host.dataset.locked=String(Boolean(locked));
  };
}

const chartCache=new WeakMap();
const rounded=value=>Number.isFinite(value)?Number(value.toFixed(6)):null;
const us=value=>Number.isFinite(value)?`${Number(value.toFixed(1))} µs`:'—';

export function renderUltrasonicTiming(host,reading){
  const start=reading?.triggerAtMs;
  if(!Number.isFinite(start)){
    if(chartCache.get(host)==='waiting')return;
    chartCache.set(host,'waiting');
    host.innerHTML='<p>运行并发送一次有效的 TRIG 脉冲，这里会显示发射等待和回波时长。</p>';
    return;
  }
  const {triggerWidthUs,emissionEndMs,echoStartMs,echoEndMs,echoWidthUs,missReason,targetSnapshot}=reading;
  const key=JSON.stringify([rounded(triggerWidthUs),rounded(emissionEndMs-start),echoStartMs===null?null:rounded(echoStartMs-start),rounded(echoWidthUs),missReason,targetSnapshot]);
  if(chartCache.get(host)===key)return;
  chartCache.set(host,key);
  const hasEcho=Number.isFinite(echoStartMs)&&Number.isFinite(echoEndMs)&&echoEndMs>echoStartMs;
  const end=hasEcho?Math.max(2,Math.ceil((echoEndMs-start)*1.1)):28;
  const x0=76,x1=414,x=ms=>x0+(x1-x0)*clamp(ms/end,0,1);
  const echo=hasEcho?`H${x(echoStartMs-start)} V76 H${x(echoEndMs-start)} V107 H${x1}`:`H${x1}`;
  const target=targetSnapshot?.targetPresent?`触发时 ${targetSnapshot.distanceCm} cm · ${targetSnapshot.bearingDeg}°`:'触发时无目标';
  const label=hasEcho?`ECHO 高电平 ${us(echoWidthUs)}`:sonarMissLabels[missReason]??'本次无回波';
  host.innerHTML=`<figure class="ultrasonic-timing">
    <figcaption>${target} · ${label}</figcaption>
    <svg viewBox="0 0 425 145" role="img" aria-label="触发脉冲局部放大。下方为从触发下降沿开始的回波时序。">
      <g class="trace-axis"><text x="4" y="27">TRIG</text><text x="4" y="92">ECHO</text><text x="208" y="27">高电平 ${us(triggerWidthUs)} · 局部放大</text>
      <text x="76" y="130">0</text><text x="414" y="130" text-anchor="end">${end} ms</text></g>
      <path class="trace-grid" d="M76 76H414M76 107H414"/>
      <path class="sonar-emission-edge" d="M${x(emissionEndMs-start)} 67V113"/>
      <path class="sonar-trig-wave" d="M76 38H103V14H166V38H194"/>
      <path class="sonar-echo-wave" d="M76 107 ${echo}"/>
    </svg>
    <p>下图以 TRIG 下降沿为 0 ms。虚线标出八周期超声发射结束。ECHO 宽度按目标往返时间求解。</p>
  </figure>`;
}
