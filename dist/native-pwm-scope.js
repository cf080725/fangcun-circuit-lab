const valueFormat=new Intl.NumberFormat('zh-CN',{maximumSignificantDigits:5});
const axisFormat=new Intl.NumberFormat('zh-CN',{maximumSignificantDigits:3});
const format=(value,unit)=>`${valueFormat.format(Object.is(value,-0)?0:value)} ${unit}`;
const scopeStart=62,scopeEnd=412;

function levels(channel,lowKey,highKey,duty){
  const low=duty<1?channel?.[lowKey]:null,high=duty>0?channel?.[highKey]:null;
  if((duty<1&&!Number.isFinite(low))||(duty>0&&!Number.isFinite(high)))return null;
  return {low,high};
}

export function nativePwmCycle(phase){
  if(!phase)return null;
  const {pin,frequencyHz,duty,periodMs,highFirst}=phase;
  if(!Number.isFinite(periodMs)||periodMs<=0||!Number.isFinite(frequencyHz)||frequencyHz<=0||
    !Number.isFinite(duty)||duty<0||duty>1||(duty>0&&duty<1&&typeof highFirst!=='boolean'))return null;
  const first=duty===1||(duty>0&&highFirst)?'high':'low';
  const second=duty===0||duty===1?null:first==='high'?'low':'high';
  const transitionMs=second?(first==='high'?duty:1-duty)*periodMs:null;
  const voltage=levels(phase.voltage,'low','high',duty);
  const led=levels(phase.led,'lowMa','highMa',duty);
  return {pin,frequencyHz,duty,periodMs,first,second,transitionMs,voltage,led,
    averageMa:led&&Number.isFinite(phase.led?.averageMa)?phase.led.averageMa:null};
}

export function sampleNativePwmCycle(cycle,timeMs){
  if(!cycle||!Number.isFinite(timeMs)||timeMs<0||timeMs>cycle.periodMs)return null;
  const level=cycle.second&&timeMs>=cycle.transitionMs?cycle.second:cycle.first;
  return {level,voltage:cycle.voltage?.[level]??null,currentMa:cycle.led?.[level]??null};
}

function svgY(values,top,bottom){
  const min=Math.min(0,...values),max=Math.max(0,...values);
  if(max===min)return {topValue:null,bottomValue:0,coordinate:()=>bottom};
  return {topValue:max,bottomValue:min,coordinate:value=>bottom-(bottom-top)*(value-min)/(max-min)};
}

function pathFor(cycle,channel,x,y){
  const first=y(cycle[channel][cycle.first]).toFixed(2),end=x(cycle.periodMs).toFixed(2);
  if(!cycle.second)return `M${scopeStart} ${first}H${end}`;
  const next=y(cycle[channel][cycle.second]).toFixed(2);
  return `M${scopeStart} ${first}H${x(cycle.transitionMs).toFixed(2)}V${next}H${end}`;
}

function plot(channels,cycles,period){
  const x=ms=>scopeStart+(scopeEnd-scopeStart)*ms/period;
  const bottom=channels.length*69+5;
  const rows=channels.map(([channel,caption,unit],index)=>{
    const top=index*69+23,base=top+46;
    const values=cycles.flatMap(cycle=>Object.values(cycle?.[channel]??{})).filter(Number.isFinite);
    const {topValue,bottomValue,coordinate}=svgY(values,top,base);
    const traces=['after','before'].map((side)=>{
      const cycle=cycles[side==='before'?0:1];
      if(!cycle?.[channel])return '';
      return `<path class="native-pwm-trace ${side}" data-pwm-trace="${side}-${channel}" data-period-ms="${cycle.periodMs}" data-duty="${cycle.duty}" data-high-first="${cycle.first==='high'}" d="${pathFor(cycle,channel,x,coordinate)}"/>`;
    }).join('');
    return `<g><text x="1" y="${top-8}" class="native-pwm-axis-title">${caption}</text>
      ${topValue===null?'':`<text x="57" y="${top+4}" text-anchor="end">${axisFormat.format(topValue)} ${unit}</text>`}
      <text x="57" y="${base+4}" text-anchor="end">${axisFormat.format(bottomValue)} ${unit}</text>
      <path class="native-pwm-grid" d="M${scopeStart} ${top}H${scopeEnd}M${scopeStart} ${base}H${scopeEnd}"/>${traces}</g>`;
  }).join('');
  const marks=[0,.25,.5,.75,1].map(ratio=>{
    const at=x(period*ratio);
    const label=ratio===0?'0':ratio===1?format(period,'ms'):ratio===.5?format(period/2,'ms'):'';
    const anchor=ratio===0?'start':ratio===1?'end':'middle';
    return `<path class="native-pwm-grid vertical" d="M${at} 23V${bottom}"/>${label?`<text x="${at}" y="${bottom+17}" text-anchor="${anchor}">${label}</text>`:''}`;
  }).join('');
  return {height:bottom+21,markup:marks+rows+`<path class="native-pwm-cursor" d="M${scopeStart} 19V${bottom}"/>`};
}

function cycleText(cycle){
  if(!cycle)return '暂无可用周期';
  const mode=cycle.second?`${cycle.first==='high'?'高':'低'}电平起始`:`恒${cycle.first==='high'?'高':'低'}`;
  const details=[`${cycle.pin?cycle.pin+' · ':''}${format(cycle.frequencyHz,'Hz')} · ${valueFormat.format(cycle.duty*100)}%`,
    `周期 ${format(cycle.periodMs,'ms')} · ${mode}`];
  if(cycle.averageMa!=null)details.push(`LED 周期平均 ${format(cycle.averageMa,'mA')}`);
  return details.join('\n');
}

function cursorText(cycle,timeMs){
  if(!cycle)return '暂无可用周期';
  const reading=sampleNativePwmCycle(cycle,timeMs);
  if(!reading)return '已超过该周期';
  return [reading.level==='high'?'高电平':'低电平',
    reading.voltage==null?'电压未测得':format(reading.voltage,'V'),
    ...(reading.currentMa==null?[]:[format(reading.currentMa,'mA')])].join(' · ');
}

function setText(node,text){if(node.textContent!==text)node.textContent=text;}

export function createNativePwmScope(host,{onOpenChange}={}){
  host.innerHTML=`<details id="nativePwmScopeDetails" class="native-pwm-scope">
    <summary><strong>对照一个 PWM 周期</strong><span data-pwm-status></span></summary>
    <p data-pwm-empty>所选引脚暂无可用的 PWM 周期。请选择支持 PWM 的输出引脚并运行固件。</p>
    <p data-pwm-unavailable hidden>有 PWM 周期暂时无法按当前接法重算电平。可继续查看表中的瞬时读数。</p>
    <div data-pwm-content hidden>
      <p class="native-pwm-intro">每条曲线从各自的周期起点开始，共用毫秒刻度。周期结束后的区域留空。</p>
      <dl class="native-pwm-lanes">
        <div data-pwm-lane="before"><dt><span aria-hidden="true" class="native-pwm-key before"></span>基线快照</dt><dd></dd></div>
        <div data-pwm-lane="after"><dt><span aria-hidden="true" class="native-pwm-key after"></span><span data-pwm-current>当前 · 实时</span></dt><dd></dd></div>
      </dl>
      <svg id="nativePwmScopeChart" class="native-pwm-chart" role="img" aria-label="基线和当前的 PWM 周期曲线，共用时间刻度" preserveAspectRatio="xMidYMid meet"></svg>
      <p data-pwm-no-readings hidden>当前没有可绘制的引脚电压或关联 LED 电流。</p>
      <div class="native-pwm-cursor-controls">
        <label for="nativePwmScopeTime">时间游标</label><output id="nativePwmScopeCursorTime" for="nativePwmScopeTime" aria-live="off"></output>
        <input id="nativePwmScopeTime" type="range" min="0" max="1000" step="1" value="0" aria-describedby="nativePwmScopeReadout">
      </div>
      <dl id="nativePwmScopeReadout" class="native-pwm-lanes native-pwm-readout">
        <div><dt>基线读数</dt><dd data-pwm-cursor="before"></dd></div>
        <div><dt>当前读数</dt><dd data-pwm-cursor="after"></dd></div>
      </dl>
    </div>
  </details>`;
  const query=selector=>host.querySelector(selector);
  const details=query('details'),status=query('[data-pwm-status]');
  const empty=query('[data-pwm-empty]'),unavailableNote=query('[data-pwm-unavailable]');
  const content=query('[data-pwm-content]'),current=query('[data-pwm-current]');
  const chart=query('#nativePwmScopeChart'),missing=query('[data-pwm-no-readings]');
  const time=query('#nativePwmScopeTime'),cursorTime=query('#nativePwmScopeCursorTime');
  const sides=['before','after'];
  const summaries=sides.map(side=>query(`[data-pwm-lane="${side}"] dd`));
  const readouts=sides.map(side=>query(`[data-pwm-cursor="${side}"]`));
  let cycleKey,chartKey,cycles=[null,null],period=0,cursorMs=0,cursor,unavailable=false;

  function updateCursor(){
    if(!period)return;
    const shown=format(cursorMs,'ms');
    setText(cursorTime,shown);
    time.setAttribute('aria-valuetext',shown);
    cursor?.setAttribute('transform',`translate(${(scopeEnd-scopeStart)*cursorMs/period} 0)`);
    readouts.forEach((node,index)=>setText(node,cursorText(cycles[index],cursorMs)));
  }

  function renderOpen(){
    const count=cycles.filter(Boolean).length;
    setText(status,count?`${count} 组周期`:!details.open?'展开查看':unavailable?'暂无法测量':'暂无周期');
    if(!details.open)return;
    empty.hidden=period>0||unavailable;
    unavailableNote.hidden=!unavailable;
    content.hidden=!(period>0);
    if(!period)return;
    if(chartKey!==cycleKey){
      chartKey=cycleKey;
      summaries.forEach((node,index)=>setText(node,cycleText(cycles[index])));
      const channels=[['voltage','引脚电压','V'],['led','关联 LED 电流','mA']]
        .filter(([channel])=>cycles.some(cycle=>cycle?.[channel]));
      chart.toggleAttribute('hidden',!channels.length);
      missing.hidden=!!channels.length;
      if(channels.length){
        const {height,markup}=plot(channels,cycles,period);
        chart.setAttribute('viewBox',`0 0 419 ${height}`);
        chart.innerHTML=markup;
        cursor=chart.querySelector('.native-pwm-cursor');
      }else{
        chart.replaceChildren();
        cursor=null;
      }
      cursorMs=Math.min(cursorMs,period);
      time.value=String(Math.round(cursorMs/period*1000));
      cursorMs=Number(time.value)/1000*period;
      updateCursor();
    }
  }

  function render({before,after,afterFrozen=false,unavailable:cannotMeasure=false}={}){
    unavailable=cannotMeasure;
    cycles=[nativePwmCycle(before),nativePwmCycle(after)];
    cycleKey=JSON.stringify(cycles);
    period=Math.max(...cycles.map(cycle=>cycle?.periodMs??0));
    setText(current,afterFrozen?'当前 · 已冻结':'当前 · 实时');
    renderOpen();
  }

  details.addEventListener('toggle',()=>{
    onOpenChange?.(details.open);
    renderOpen();
  });
  time.addEventListener('input',()=>{
    cursorMs=Number(time.value)/1000*period;
    updateCursor();
  });
  return {render,isOpen:()=>details.open,open:()=>{details.open=true;}};
}
