import {canonicalPin,getBoardProfile} from './board-profiles.js';
import {mountedConnections,signalStrip} from './breadboard-mount.js';
import {lexicalSource} from './editor-assistant.js';
import {evaluatePartMount,mountedPartContacts} from './part-mount.js';

const touches=(wire,endpoint)=>wire.a===endpoint||wire.b===endpoint;
const pinInUse=(wires,endpoint)=>wires.some(wire=>touches(wire,endpoint));
const setWires=(circuit,wires,message)=>({circuit:{...circuit,wires},message});
const noChange=message=>({message});
const setPart=(circuit,part,replacement,message)=>({
  circuit:{...circuit,components:circuit.components.map(item=>item===part?replacement:item)},message
});

function planMountedLedFault(kind,circuit){
  const profile=getBoardProfile(circuit.boardId);
  for(const led of circuit.components){
    if(led.type!=='led'||!led.mount||led.locked)continue;
    const contacts=mountedPartContacts(led);
    if(!contacts.length)continue;
    const direct=contacts.filter(({a})=>pinInUse(circuit.wires,a));
    if(kind==='open'){
      if(direct.length===2)continue;
      const unplugged={...led};
      delete unplugged.mount;
      return setPart(circuit,led,unplugged,'已拔出 '+led.id+'，跳线保留。');
    }
    if(direct.length)continue;
    const mount={hole:contacts[1].b,rotation:(led.mount.rotation+180)%360};
    if(evaluatePartMount(circuit,profile,led,mount).ok){
      return setPart(circuit,led,{...led,mount},'已将 '+led.id+' 的 A、K 两脚在原孔位对调。');
    }
  }
  return null;
}

function findMountedSeriesResistor(circuit){
  const stripKey=endpoint=>{
    const strip=signalStrip(endpoint);
    return strip ? strip.rows+strip.column : null;
  };
  const wires=new Set(circuit.wires.flatMap(({a,b})=>[a,b]));
  const wiredStrips=new Set([...wires].map(stripKey));
  for(const {b} of mountedConnections(circuit,getBoardProfile(circuit.boardId)))wiredStrips.add(stripKey(b));
  const inserted=circuit.components.flatMap(part=>mountedPartContacts(part).map(({a,b})=>({part,endpoint:a,strip:stripKey(b)})));
  // A direct, unbranched shared strip identifies the series junction without guessing from distance.
  for(const contact of inserted){
    if(contact.part.type!=='resistor'||wiredStrips.has(contact.strip))continue;
    const peers=inserted.filter(other=>other.strip===contact.strip);
    if(peers.length!==2||peers.some(peer=>wires.has(peer.endpoint)))continue;
    const led=peers.find(peer=>peer.part.type==='led');
    if(!led)continue;
    const otherResistorLead=inserted.find(other=>other.part===contact.part&&other!==contact);
    const otherLedLead=inserted.find(other=>other.part===led.part&&other!==led);
    if(otherResistorLead.strip!==otherLedLead.strip)return contact.part;
  }
  return null;
}

function planClockFault(files){
  const changed=[];
  const gpio=/^RCC_APB2Periph_GPIO[A-G]$/;
  const call=/\bRCC_APB2PeriphClockCmd\s*\(\s*(\(?\s*RCC_APB2Periph_\w+(?:\s*\|\s*RCC_APB2Periph_\w+)*\s*\)?)\s*,\s*(ENABLE)\s*\)\s*;/gd;
  for(const [file,source] of Object.entries(files)){
    // Keep offsets for surgical edits. Ignore comments, strings and preprocessor directives.
    const mask=lexicalSource(source).mask.replace(/^[\t ]*#(?:[^\n]*\\\r?\n)*[^\n]*/gm,line=>line.replace(/[^\r\n]/g,' '));
    const edits=[];
    for(const match of mask.matchAll(call)){
      const args=match[1].trim();
      if(args.startsWith('(')!==args.endsWith(')'))continue;
      const terms=[...match[1].matchAll(/RCC_APB2Periph_\w+/g)];
      const ports=terms.filter(term=>gpio.test(term[0]));
      if(!ports.length)continue;
      if(ports.length===terms.length){
        const [start,end]=match.indices[2];
        edits.push({start,end,text:'DISABLE /* 故障练习：关闭 GPIO 时钟 */'});
      }else{
        const [offset]=match.indices[1];
        for(const port of ports){
          const start=offset+port.index;
          edits.push({start,end:start+port[0].length,text:'0 /* 故障练习：跳过 '+port[0].replace('RCC_APB2Periph_','')+' */'});
        }
      }
    }
    if(!edits.length)continue;
    let text=source;
    for(const {start,end,text:replacement} of edits.reverse()){
      text=text.slice(0,start)+replacement+text.slice(end);
    }
    changed.push([file,text]);
  }
  if(!changed.length)return noChange('没有找到可修改的 SPL GPIO 时钟开启语句。');
  return {files:{...files,...Object.fromEntries(changed)},activeFile:changed[0][0],message:'已关闭代码中的 GPIO 时钟。重新运行可查看诊断。'};
}

/** Produce a complete mutation before the workspace records undo or pauses. */
export function planFault(kind,circuit,files){
  if(kind==='clock'){
    if(getBoardProfile(circuit.boardId).family!=='STM32F1')return noChange('此练习需要支持 F1 标准外设库的板型。');
    return planClockFault(files);
  }
  if(kind==='reverse'||kind==='open'){
    const leds=circuit.components.filter(part=>part.type==='led'&&!part.mount&&pinInUse(circuit.wires,part.id+':A'));
    for(const led of leds){
      const anode=led.id+':A',cathode=led.id+':K';
      const returns=circuit.wires.filter(wire=>touches(wire,cathode));
      if(!returns.length||returns.some(wire=>touches(wire,anode)))continue;
      if(kind==='open'){
        if(returns.length!==1)continue;
        return setWires(circuit,circuit.wires.filter(wire=>wire!==returns[0]),'已拔掉 '+led.id+' 的 K 端回路线。');
      }
      const swap=endpoint=>endpoint===anode?cathode:endpoint===cathode?anode:endpoint;
      return setWires(circuit,circuit.wires.map(wire=>{
        const a=swap(wire.a),b=swap(wire.b);
        return a===wire.a&&b===wire.b?wire:{...wire,a,b};
      }),'已交换 '+led.id+' 的 A / K 接线。');
    }
    return planMountedLedFault(kind,circuit) || noChange(kind==='open'?'没有找到可断开单条回路的 LED。':'请先接好一只 LED 的 A、K 两端，或选择一只未锁定且没有直接跳线的插装 LED。');
  }
  if(kind==='resistor'){
    const resistor=circuit.components.find(part=>part.type==='resistor'&&!part.mount
      &&pinInUse(circuit.wires,part.id+':1')&&pinInUse(circuit.wires,part.id+':2')) || findMountedSeriesResistor(circuit);
    if(!resistor)return noChange('请先接好一只两端都有导线的电阻，或将电阻与 LED 串接在面包板上。');
    if(resistor.resistance===1)return noChange(resistor.id+' 已经设为 1 Ω。');
    return setPart(circuit,resistor,{...resistor,resistance:1},'已将 '+resistor.id+' 改为 1 Ω。观察支路电流和诊断。');
  }
  if(kind==='power'){
    if(!circuit.powered)return noChange('开发板已经断电。');
    return {circuit:{...circuit,powered:false},message:'已切断开发板供电。'};
  }
  if(kind==='short'){
    if(!circuit.powered)return noChange('先打开开发板供电，再练习诊断电源短路。');
    const board=getBoardProfile(circuit.boardId),rail=board.logicRail;
    const power=board.pins.find(pin=>pin.canonical===rail),ground=board.pins.find(pin=>pin.canonical==='GND');
    if(!power||!ground)return noChange('当前板型没有可用于此练习的电源与地端点。');
    const isPair=(a,b)=>a.startsWith('mcu:')&&b.startsWith('mcu:')
      &&canonicalPin(a,board.id)===rail&&canonicalPin(b,board.id)==='GND';
    if(circuit.wires.some(({a,b})=>isPair(a,b)||isPair(b,a)))return noChange('电源与地已经由导线直接短接。');
    if(circuit.wires.length>=400)return noChange('导线已满，请先移除一根导线。');
    const usedIds=new Set([...circuit.components,...circuit.wires].map(item=>item.id));
    let i=1;
    while(usedIds.has('faultshort'+i))i++;
    const wire={id:'faultshort'+i,a:'mcu:'+power.id,b:'mcu:'+ground.id,color:'#c44c47'};
    return setWires(circuit,[...circuit.wires,wire],'已在虚拟电路中短接 '+rail+' 与 GND。');
  }
  return noChange('当前故障练习不可用。');
}
