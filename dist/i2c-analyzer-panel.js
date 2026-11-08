import {analyzeI2cEvent} from './i2c-analyzer-data.js';
import {mountI2cAnalyzerView} from './i2c-analyzer-view.js';
import {createI2cCapture} from './i2c-capture.js';
import {i2cHex,i2cReason,i2cStatus} from './i2c-trace.js';

export function mountI2cAnalyzerPanel(panel,readStream){
  const byId=id=>panel.querySelector('#'+id);
  const select=byId('i2cCapturedPacket'),status=byId('i2cCaptureStatus');
  const freeze=byId('i2cCaptureFreeze'),trigger=byId('i2cCaptureTrigger'),clear=byId('i2cCaptureClear');
  const detail=byId('i2cCapturedDetail'),page=byId('i2cAnalyzerPage'),controls=byId('i2cAnalyzerPageControls');
  const previous=byId('i2cAnalyzerPrevious'),next=byId('i2cAnalyzerNext');
  const capture=createI2cCapture();
  let chosenId=null,firstByte=0,selectedByte=null,optionsKey='',drawnId,drawnPage,frame;
  const view=mountI2cAnalyzerView(byId('i2cAnalyzerWaveform'),{
    onSelectByte:index=>{selectedByte=index;capture.freeze();draw();},
    onExplore:()=>{if(capture.mode==='live'){capture.freeze();draw();}}
  });

  function choose(id){
    if(chosenId===id)return;
    chosenId=id;
    firstByte=0;
    selectedByte=null;
  }

  function update(visible){
    if(!visible&&capture.mode!=='armed')return;
    const prior=capture.mode,{events,owner}=readStream();
    capture.ingest(events,owner);
    if(prior!=='held'||!capture.records.some(record=>record.id===chosenId))choose(capture.records.at(-1)?.id??null);
    if(visible)draw();
  }

  function draw(){
    const records=capture.records,held=capture.mode==='held',armed=capture.mode==='armed';
    const key=records.map(record=>record.id).join(',');
    if(key!==optionsKey){
      optionsKey=key;
      select.replaceChildren(...[...records].reverse().map(({id,event})=>{
        const option=document.createElement('option');
        option.value=id;
        option.textContent=`${event.direction==='read'?'读':'写'} ${i2cHex(event.address)} · ${i2cStatus(event)} · ${Number(event.timeMs).toFixed(2)} ms`;
        return option;
      }));
    }
    select.disabled=!records.length;
    if(chosenId!==null&&select.value!==String(chosenId))select.value=chosenId;
    freeze.textContent=held?'恢复跟随':'冻结记录';
    freeze.disabled=!held&&!records.length;
    freeze.setAttribute('aria-pressed',String(held));
    trigger.textContent=armed?'取消失败触发':'捕获下一次失败';
    trigger.setAttribute('aria-pressed',String(armed));
    clear.disabled=!records.length;
    const stateText=armed?'等待下一次失败，捕获后自动冻结。':held?'记录已冻结，程序可继续运行。':records.length?'跟随最新完成的事务。':'运行 I²C 程序后查看波形。';
    if(status.textContent!==stateText)status.textContent=stateText;
    const packet=records.find(record=>record.id===chosenId)?.event;
    detail.hidden=!packet;
    if(packet){
      const info=[i2cStatus(packet),i2cReason(packet)].filter(Boolean).join('。');
      if(detail.textContent!==info)detail.textContent=info;
    }
    if(drawnId!==chosenId||drawnPage!==firstByte){
      drawnId=chosenId;
      drawnPage=firstByte;
      frame=packet?analyzeI2cEvent(packet,{firstByte}):null;
    }
    controls.hidden=!frame?.groups?.length||(!Number.isInteger(frame.previousFirstByte)&&!Number.isInteger(frame.nextFirstByte));
    previous.disabled=!Number.isInteger(frame?.previousFirstByte);
    next.disabled=!Number.isInteger(frame?.nextFirstByte);
    if(!controls.hidden)page.textContent=`字节组 ${frame.firstByte+1}–${frame.lastByte+1} / ${frame.totalBytes}`+
      (frame.omittedBytes?` · 省略 ${frame.omittedBytes} 组`:'');
    view.render(frame,{selectedByte});
  }

  freeze.onclick=()=>{if(capture.mode==='held')capture.follow();else capture.freeze();update(true);};
  trigger.onclick=()=>{
    if(capture.mode==='armed')capture.follow();
    else{const {events,owner}=readStream();capture.arm(events,owner);}
    update(true);
  };
  clear.onclick=()=>{capture.clear();choose(null);update(true);};
  select.onchange=()=>{capture.freeze();choose(Number(select.value));draw();};
  select.onpointerdown=()=>{if(capture.mode==='live'&&capture.records.length){capture.freeze();draw();}};
  select.onkeydown=event=>{
    if(capture.mode==='live'&&['Enter',' ','ArrowUp','ArrowDown'].includes(event.key)){capture.freeze();draw();}
  };
  for(const [button,key] of [[previous,'previousFirstByte'],[next,'nextFirstByte']])button.onclick=()=>{
    if(!Number.isInteger(frame?.[key]))return;
    capture.freeze();
    firstByte=frame[key];
    selectedByte=null;
    draw();
  };
  return {update,get hasRecords(){return capture.records.length>0;}};
}
