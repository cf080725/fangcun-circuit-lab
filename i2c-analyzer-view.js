import {i2cHex} from './i2c-trace.js';

const SVG = 'http://www.w3.org/2000/svg';
const height = 156;
const pad = 17;
const lane = {scl:{high:66,low:88},sda:{high:104,low:126}};
const markerNames = {start:'START','repeated-start':'Sr',stop:'STOP'};
const micros = value => `${Number(value.toFixed(2))} µs`;

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgNode(parent, tag, attributes, text) {
  const node = parent.ownerDocument.createElementNS(SVG, tag);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function waveformPath(points, position, levels) {
  let path = '';
  let segmentOpen = false;
  for (const {timeUs,level} of points) {
    if (!Number.isFinite(timeUs) || (level !== 0 && level !== 1)) {
      segmentOpen = false;
      continue;
    }
    const x = position(timeUs).toFixed(2);
    const y = level ? levels.high : levels.low;
    path += segmentOpen ? `H${x}V${y}` : `M${x} ${y}`;
    segmentOpen = true;
  }
  return path;
}

function groupLabel(group) {
  if (group.kind !== 'address') return `数据 ${i2cHex(group.byte)}`;
  if (!Number.isInteger(group.byte)) return '地址 —';
  return `地址 ${i2cHex(group.byte >> 1)} · ${group.byte & 1 ? '读' : '写'}`;
}

function acknowledgement(group) {
  if (group.ack == null) return '应答未知';
  const owner = group.ackBy === 'host' ? '主机' : '从设备';
  if (group.ackBy === 'host' && !group.ack) return '主机 NACK（结束读取）';
  return `${owner} ${group.ack ? 'ACK' : 'NACK'}`;
}

function byteDescription(group) {
  const bits = group.bits.filter(bit => bit.role === 'data').map(({level}) => level ?? '?').join('');
  const addressByte = group.kind === 'address' ? ` · 总线字节 ${i2cHex(group.byte)}` : '';
  return `${groupLabel(group)}${addressByte} · ${bits.slice(0,4)} ${bits.slice(4)} · 第九位 ${acknowledgement(group)} · ${micros(group.fromUs)}–${micros(group.toUs)}`;
}

function drawGroup(svg, group, position, interactive) {
  const left = position(group.fromUs);
  const right = position(group.toUs);
  const width = right - left;
  const description = byteDescription(group);
  const node = svgNode(svg,'g',{'data-i2c-byte':group.index});
  if (interactive) {
    node.setAttribute('role','button');
    node.setAttribute('tabindex','0');
    node.setAttribute('aria-label',description);
    node.setAttribute('aria-pressed','false');
  }
  svgNode(node,'title',{},description);
  svgNode(node,'rect',{class:'i2c-byte-bg',x:left,y:24,width,height:109,rx:4});
  svgNode(node,'path',{class:'i2c-byte-boundary',d:`M${left} 25V132`});
  if (width >= 80) {
    svgNode(node,'text',{class:'i2c-byte-heading',x:(left+right)/2,y:42,'text-anchor':'middle'},groupLabel(group));
  }
  for (const bit of group.bits) {
    const start = position(bit.fromUs);
    const end = position(bit.toUs);
    const center = (start+end)/2;
    if (bit.role === 'ack') {
      svgNode(node,'rect',{class:'i2c-ack-bg',x:start,y:47,width:end-start,height:84,rx:2});
      const label = group.ack == null ? '?' : group.ack ? 'ACK' : 'NACK';
      if (end-start >= 10) svgNode(node,'text',{class:'i2c-ack-label',x:end-2,y:57,'text-anchor':'end'},label);
    }
    if (end-start >= 10) {
      svgNode(node,'text',{class:'i2c-bit-label',x:center,y:100,'text-anchor':'middle'},bit.level ?? '—');
    }
  }
  return {node,left,right};
}

function drawWaveform(svg, frame, interactive) {
  const width = Math.max(310,frame.groups.length * 135 + 2 * pad);
  const span = frame.toUs - frame.fromUs;
  const position = time => pad + (time-frame.fromUs) * (width-2*pad) / span;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('width',width);
  svg.setAttribute('height',height);
  svg.replaceChildren();
  svgNode(svg,'title',{},'I²C SCL 和 SDA 逻辑波形');
  const markers = frame.markers.map(({kind}) => markerNames[kind]).filter(Boolean);
  svgNode(svg,'desc',{},`${markers.join('、') || '帧中的字节片段'}。${frame.groups.map(byteDescription).join('。')}`);

  for (const {high,low} of Object.values(lane)) {
    svgNode(svg,'path',{class:'i2c-lane-guide',d:`M${pad} ${high}H${width-pad}M${pad} ${low}H${width-pad}`});
  }
  const groups = new Map(frame.groups.map(group => [group.index,drawGroup(svg,group,position,interactive)]));

  for (const marker of frame.markers) {
    const label = markerNames[marker.kind];
    if (!label) continue;
    const left = position(marker.fromUs);
    const right = position(marker.toUs);
    const ending = marker.kind === 'stop';
    const group = svgNode(svg,'g',{'data-i2c-marker':marker.kind});
    svgNode(group,'title',{},marker.kind === 'repeated-start' ? '重复 START' : label);
    svgNode(group,'rect',{class:'i2c-marker-range',x:left,y:24,width:right-left,height:109,rx:2});
    svgNode(group,'text',{class:'i2c-marker-label',x:ending?right:left,y:17,'text-anchor':ending?'end':'start'},label);
  }
  for (const key of ['scl','sda']) {
    const path = waveformPath(frame[key],position,lane[key]);
    if (path) svgNode(svg,'path',{class:`i2c-wave i2c-wave-${key}`,'data-i2c-lane':key,d:path});
  }

  svgNode(svg,'path',{class:'i2c-time-axis',d:`M${pad} 135H${width-pad}M${pad} 132V138M${width-pad} 132V138`});
  svgNode(svg,'text',{class:'i2c-time-label',x:pad,y:150},micros(frame.fromUs));
  svgNode(svg,'text',{class:'i2c-time-label',x:width-pad,y:150,'text-anchor':'end'},micros(frame.toUs));
  return groups;
}

/** Render one analyzer page. Byte indices are zero-based across the whole event. */
export function mountI2cAnalyzerView(root,{onSelectByte,onExplore}={}) {
  const document = root.ownerDocument;
  const figure = element(document,'figure','i2c-analyzer-figure');
  const graphic = element(document,'div','i2c-analyzer-graphic');
  const gutter = element(document,'div','i2c-analyzer-gutter');
  gutter.setAttribute('aria-hidden','true');
  gutter.append(element(document,'span','i2c-scl-label','SCL'),element(document,'span','i2c-sda-label','SDA'));
  const viewport = element(document,'div','i2c-analyzer-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label','逻辑波形，可横向滚动');
  const svg = svgNode(viewport,'svg',{class:'i2c-analyzer-svg',role:onSelectByte?'group':'img',
    'aria-label':'I²C SCL 和 SDA 逻辑波形'});
  const caption = element(document,'figcaption','i2c-analyzer-caption');
  const details = element(document,'p','i2c-analyzer-selection');
  const empty = element(document,'p','i2c-analyzer-empty','运行程序后选择一笔 I²C 传输。');
  graphic.append(gutter,viewport);
  figure.append(graphic,caption,details);
  figure.hidden = true;
  root.replaceChildren(figure,empty);

  function selectFromPlot(event) {
    const keyboard = event.type === 'keydown';
    if (keyboard && (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      (event.key !== 'Enter' && event.key !== ' '))) return;
    const group = event.target.closest('[data-i2c-byte]');
    if (group) {
      event.preventDefault();
      if (!keyboard || !event.repeat) onSelectByte(Number(group.dataset.i2cByte));
    }
  }
  if (onSelectByte) {
    svg.classList.add('i2c-analyzer-clickable');
    svg.addEventListener('click',selectFromPlot);
    svg.addEventListener('keydown',selectFromPlot);
  }
  let touchOrigin=null;
  function startExplore(event) {
    const touch=event.touches[0];
    touchOrigin=event.touches.length===1?[touch.clientX,touch.clientY]:null;
  }
  function moveExplore(event) {
    if(!touchOrigin||event.touches.length!==1)return;
    const touch=event.touches[0],dx=Math.abs(touch.clientX-touchOrigin[0]),dy=Math.abs(touch.clientY-touchOrigin[1]);
    if(dx>8&&dx>dy&&viewport.scrollWidth>viewport.clientWidth){touchOrigin=null;onExplore();}
  }
  function wheelExplore(event) {
    if((event.deltaX||event.shiftKey&&event.deltaY)&&viewport.scrollWidth>viewport.clientWidth)onExplore();
  }
  function keyExplore(event) {
    if(event.target===viewport&&['ArrowLeft','ArrowRight'].includes(event.key)&&viewport.scrollWidth>viewport.clientWidth)onExplore();
  }
  if(onExplore){
    viewport.addEventListener('touchstart',startExplore,{passive:true});
    viewport.addEventListener('touchmove',moveExplore,{passive:true});
    viewport.addEventListener('wheel',wheelExplore,{passive:true});
    viewport.addEventListener('keydown',keyExplore);
  }

  let previousFrame,previousByte,positions;
  function render(frame,{selectedByte=null}={}) {
    const valid = frame && frame.mode !== 'unavailable' && frame.toUs > frame.fromUs;
    figure.hidden = !valid;
    empty.hidden = Boolean(valid);
    if (!valid) {
      empty.textContent = frame ? '这笔传输没有可绘制的时序。' : '运行程序后选择一笔 I²C 传输。';
      previousFrame = null;
      return;
    }
    const changed = frame !== previousFrame;
    let focusedByte = null;
    if (changed) {
      const active = document.activeElement;
      if (svg.contains(active) && active.hasAttribute('data-i2c-byte')) focusedByte = Number(active.dataset.i2cByte);
      positions = drawWaveform(svg,frame,Boolean(onSelectByte));
      const timing = frame.controller === 'stm32-i2c1' ? (frame.mode === 'native' ? '按 STM32 I²C1 字节事件重建' : '按 STM32 I²C1 事务估算')
        : frame.mode === 'native' ? '按 TWI 寄存器事件重建' : '按源码传输记录估算';
      const origin = Number.isFinite(frame.originMs) ? ` · 帧起点 ${Number(frame.originMs.toFixed(3))} ms` : '';
      const restart = frame.markers.some(({kind}) => kind === 'repeated-start') ? ' · Sr 为重复 START' : '';
      const gaps = frame.sda.some(({level}) => level === null) ? ' · 线条空缺表示电平未记录' : '';
      caption.textContent = `${timing}${origin} · 着色的第九位表示应答${restart}${gaps}`;
      viewport.scrollLeft = 0;
      if (focusedByte !== null) (positions.get(focusedByte)?.node ?? viewport).focus({preventScroll:true});
    }
    if (changed || selectedByte !== previousByte) {
      const previous = positions.get(previousByte)?.node;
      previous?.classList.remove('i2c-byte-selected');
      if (onSelectByte) previous?.setAttribute('aria-pressed','false');
      const position = positions.get(selectedByte);
      const group = frame.groups.find(group => group.index === selectedByte);
      if (position) {
        position.node.classList.add('i2c-byte-selected');
        if (onSelectByte) position.node.setAttribute('aria-pressed','true');
        details.textContent = byteDescription(group);
        details.dataset.selectedByte = String(selectedByte);
      } else {
        details.textContent = '选择地址或数据字节，查看位值和应答来源。';
        delete details.dataset.selectedByte;
      }
    }
    const position = positions.get(focusedByte ?? selectedByte);
    if (position && (changed || selectedByte !== previousByte) && viewport.clientWidth) {
      const left = viewport.scrollLeft;
      if (position.left < left || position.right > left+viewport.clientWidth) {
        viewport.scrollLeft = (position.left+position.right-viewport.clientWidth)/2;
      }
    }
    previousFrame = frame;
    previousByte = selectedByte;
  }

  return {render,destroy(){
    if (onSelectByte) {
      svg.removeEventListener('click',selectFromPlot);
      svg.removeEventListener('keydown',selectFromPlot);
    }
    if(onExplore){
      viewport.removeEventListener('touchstart',startExplore);
      viewport.removeEventListener('touchmove',moveExplore);
      viewport.removeEventListener('wheel',wheelExplore);
      viewport.removeEventListener('keydown',keyExplore);
    }
    figure.remove();
    empty.remove();
  }};
}
