const EMPTY='—';
const numeric=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3});
const modeLabels={
  INPUT:'输入',INPUT_PULLUP:'上拉输入',INPUT_PULLDOWN:'下拉输入',
  OUTPUT:'输出',OUTPUT_OD:'开漏输出',ANALOG:'模拟输入',ADC:'模拟输入',PWM:'PWM 输出',
  GPIO_Mode_IN_FLOATING:'浮空输入',GPIO_Mode_IPU:'上拉输入',GPIO_Mode_IPD:'下拉输入',
  GPIO_Mode_AIN:'模拟输入',GPIO_Mode_Out_PP:'推挽输出',GPIO_Mode_Out_OD:'开漏输出',
  GPIO_Mode_AF_PP:'复用推挽输出',GPIO_Mode_AF_OD:'复用开漏输出',GPIO_Mode_AF_UNMODELED:'外设复用（未建模）',
};

function amount(value,unit) {
  return Number.isFinite(value)?numeric.format(value)+' '+unit:EMPTY;
}

function voltageText(reading) {
  if(reading?.status==='measured'&&Number.isFinite(reading.voltage))return amount(reading.voltage,'V');
  if(reading?.status==='floating')return '悬空';
  if(reading?.status==='unavailable'||reading?.status==='invalid')return '暂无有效读数';
  return EMPTY;
}

function sampleRows(sample) {
  if(!sample)return {};
  const {timeMs,pin,pinMode,voltage,pwm,led,probes,firmwareName}=sample;
  return {
    firmware:firmwareName||'已载入固件',
    time:amount(timeMs,'ms'),
    pin:[pin,Object.hasOwn(modeLabels,pinMode)?modeLabels[pinMode]:pinMode].filter(Boolean).join(' · ')||EMPTY,
    voltage:voltageText(voltage),
    pwm:Number.isFinite(pwm?.frequencyHz)&&Number.isFinite(pwm?.duty)
      ? amount(pwm.frequencyHz,'Hz')+' · '+numeric.format(pwm.duty*100)+'%' : EMPTY,
    led:Number.isFinite(led?.currentMa)?amount(led.currentMa,'mA')+' · '+(led.mode==='average'?'周期平均':'瞬时'):EMPTY,
    probes:probes?.red&&probes?.black?voltageText(probes)+'\n红 '+probes.red+' · 黑 '+probes.black:EMPTY,
  };
}

function samePayload(a,b) {
  return typeof a==='string'&&typeof b==='string'?a===b:null;
}

function setText(node,value) {
  if(node.textContent!==value)node.textContent=value;
}

function selectOptions(select,entries,selected,emptyLabel) {
  const items=emptyLabel?[{id:'',label:emptyLabel},...entries]:entries;
  const previous=select.options;
  if(previous.length!==items.length||items.some(({id,label},index)=>previous[index].value!==id||previous[index].textContent!==label)){
    select.replaceChildren(...items.map(({id,label})=>{
      const option=document.createElement('option');
      option.value=id;option.textContent=label;
      return option;
    }));
  }
  const next=selected??'';
  if(select.value!==next)select.value=next;
  select.disabled=entries.length===0;
}

export function createNativeObservationPanel({onCapture,onClear,onPinChange,onLedChange,onLocate,onOpen}={}) {
  const panel=document.getElementById('monitor-native-compare');
  const tab=document.querySelector('[data-monitor="native-compare"]');
  const element=id=>document.getElementById('nativeObservation'+id);
  const open=element('Open'),pin=element('Pin'),led=element('Led');
  const beforeButton=element('Before'),afterButton=element('After'),clear=element('Clear');
  const locatePin=element('LocatePin'),locateLed=element('LocateLed');
  const heading=element('Current'),identity=element('Identity'),status=element('Notice');
  const columns=['before','after'].map(side=>Array.from(panel.querySelectorAll('[data-native-'+side+']'),
    node=>[node.getAttribute('data-native-'+side),node]));
  let comparedBefore,comparedCurrent,comparison;

  open.addEventListener('click',()=>onOpen?.());
  pin.addEventListener('change',()=>{if(pin.value)onPinChange?.(pin.value);});
  led.addEventListener('change',()=>onLedChange?.(led.value||null));
  beforeButton.addEventListener('click',()=>onCapture?.('before'));
  afterButton.addEventListener('click',()=>onCapture?.('after'));
  clear.addEventListener('click',()=>onClear?.());
  locatePin.addEventListener('click',()=>onLocate?.('pin'));
  locateLed.addEventListener('click',()=>onLocate?.('led'));

  function render({visible,active=true,pin:pinId,pins=[],ledId,leds=[],live,before,after,notice}={}) {
    tab.hidden=panel.hidden=open.hidden=!visible;
    if(!visible){
      comparedBefore=comparedCurrent=comparison=undefined;
      return;
    }
    if(!active)return;

    const availablePin=pins.some(({id})=>id===pinId)?pinId:null;
    selectOptions(pin,pins,availablePin,availablePin?'':pins.length?'选择引脚':'暂无可观察引脚');
    selectOptions(led,leds,ledId,'不跟踪 LED');
    locatePin.disabled=!pin.value;
    locateLed.disabled=!led.value;
    beforeButton.disabled=!live;
    afterButton.disabled=!live||!before;
    clear.disabled=!before&&!after;
    setText(beforeButton,before?'重录基线':'记录基线');
    setText(afterButton,after?'重录当前':'冻结当前');
    setText(heading,after?'当前 · 已冻结':live?'当前 · 实时':'当前 · 待采样');

    const current=after??live;
    if(comparedBefore!==before?.firmwarePayload||comparedCurrent!==current?.firmwarePayload){
      comparedBefore=before?.firmwarePayload;
      comparedCurrent=current?.firmwarePayload;
      comparison=samePayload(comparedBefore,comparedCurrent);
    }
    identity.hidden=comparison==null;
    if(!identity.hidden){
      identity.dataset.equal=String(comparison);
      setText(identity,comparison?'固件内容一致':'固件内容不同');
    }
    const fallback=after?'当前读数已冻结。':before?'基线已记录。可在更换或重新编译固件后冻结当前读数。':
      live?'先记录基线，再更换或重新编译固件。':'运行固件后可以记录读数。';
    setText(status,notice||fallback);

    for(const [index,sample] of [before,current].entries()){
      const rows=sampleRows(sample);
      for(const [key,node] of columns[index])setText(node,rows[key]??EMPTY);
    }
  }

  return {render,focus:()=>panel.focus({preventScroll:true})};
}
