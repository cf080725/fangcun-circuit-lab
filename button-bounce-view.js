const channels = [
  {key:'voltage',label:'PB1 输入电压',color:'#17655c',unit:' V',digits:2},
  {key:'stable',label:'程序确认电平',color:'#39599a',unit:'',digits:0},
  {key:'current',label:'外接灯电流',color:'#a35018',unit:' mA',digits:2}
];

function signalPath(points, key, range, baseline) {
  const x = ms => 134 + (ms + 1) * 9;
  const y = value => baseline - 21 * Math.max(0, Math.min(1,value/range));
  let path = '', previous = null;
  for (const point of points) {
    const value = point[key];
    if (!Number.isFinite(value)) { previous=null; continue; }
    const px = x(point.ms).toFixed(1), py = y(value).toFixed(1);
    path += previous===null || point.ms-previous>2 ? `M${px} ${py}` : `H${px}V${py}`;
    previous = point.ms;
  }
  return path;
}

function captureLabel(capture) {
  const count = Number.isFinite(capture.delta) ? `${capture.delta} 次` : '未读到计数';
  const toggles = Number.isFinite(capture.toggles) ? `${capture.toggles} 次` : '未测得';
  return `程序确认 ${count} · 外接灯切换 ${toggles}`;
}

function captureTable(capture, label) {
  const samples = capture.samples;
  const tableRows = samples.filter((sample,i)=>{
    if(i===0||i===samples.length-1||sample.ms===0||sample.ms===25)return true;
    const previous=samples[i-1];
    return channels.some(({key})=>sample[key]!==previous[key])||sample.count!==previous.count;
  }).map(sample=>`<tr><th scope="row">${Number(sample.ms.toFixed(3))} ms</th>${channels.map(({key,unit,digits})=>`<td>${Number.isFinite(sample[key])?sample[key].toFixed(digits)+unit:'—'}</td>`).join('')}<td>${Number.isFinite(sample.count)?sample.count:'—'}</td></tr>`).join('');
  return `<details><summary>${label}</summary><table><thead><tr><th scope="col">时间</th><th scope="col">PB1</th><th scope="col">确认电平</th><th scope="col">灯电流</th><th scope="col">累计次数</th></tr></thead><tbody>${tableRows}</tbody></table></details>`;
}

export function renderButtonBounceTrace(host, capture, reference) {
  if (!capture) { host.replaceChildren(); return; }
  const samples = [...(reference?.samples??[]),...capture.samples];
  const ranges = [3.3,1,Math.max(1,...samples.map(({current})=>current??0))];
  const rows = channels.map(({key,label,color},i)=>{
    const y = 46+i*31;
    const before = reference ? `<path d="${signalPath(reference.samples,key,ranges[i],y)}" stroke-width="2" stroke-dasharray="4 3" opacity=".65"/>` : '';
    return `<text x="7" y="${y-7}" fill="${color}">${label}</text><path d="M134 ${y}H539" stroke="#d4ddd9"/><g fill="none" stroke="${color}" stroke-linejoin="round">${before}<path d="${signalPath(capture.samples,key,ranges[i],y)}" stroke-width="2.25"/></g>`;
  }).join('');
  const before = reference ? `<span><i class="bounce-before" aria-hidden="true"></i><b>改代码前</b> ${captureLabel(reference)}</span>` : '';
  const current = reference ? '改代码后' : '最近一次重放';
  host.innerHTML = `<figure class="bounce-capture"><figcaption>${before}<span><i aria-hidden="true"></i><b>${current}</b> ${captureLabel(capture)}</span></figcaption>
    <svg viewBox="0 0 550 133" role="img" aria-label="PB1 原始电压、程序确认电平和外接灯电流从上到下排列。${reference?'虚线是改代码前，实线是改代码后。':''}">
    <path d="M143 17V115M368 17V115" stroke="#8b9994" stroke-dasharray="3 3"/>
    <g font-size="13" fill="#465f55"><text x="143" y="13">0 ms · 按下</text><text x="368" y="13">25 ms · 松开</text><text x="539" y="130" text-anchor="end">44 ms</text>${rows}</g></svg>
    ${reference?captureTable(reference,'查看改代码前的采样值'):''}${captureTable(capture,reference?'查看改代码后的采样值':'查看采样值')}</figure>`;
}
