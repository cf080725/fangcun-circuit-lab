import assert from 'node:assert/strict';
import test from 'node:test';
import {renderSourceTrace} from '../dist/source-trace-view.js';

const beforeLabel = '.source-trace-before';
const afterLabel = '.source-trace-after';
const beforeReadout = '[data-trace-cursor="before"]';
const afterReadout = '[data-trace-cursor="after"]';
const plot = '.source-trace-plot';
const cursor = '#sourceTraceCursor';

function traceHost() {
  const selectors = ['summary', '#sourceTraceProbePoints', beforeLabel, afterLabel, plot, cursor,
    '#sourceTraceCursorTime', '.trace-cursor-line', beforeReadout, afterReadout];
  const elements = new Map(selectors.map(selector => [selector, {
    hidden:false, value:0, textContent:'', setAttribute(name,value) { this[name] = value; }
  }]));
  return { querySelector:selector => elements.get(selector) };
}

const series = entries => ({
  samples:entries.map(([timeMs,voltage])=>({timeMs,voltage})),
  sampledThroughMs:entries.at(-1)?.[0] ?? null
});

const currentSeries = (originMs, entries) => ({
  originMs,
  samples:entries.map(([timeMs,currentMa])=>({timeMs,currentMa})),
  sampledThroughMs:entries.at(-1)?.[0] ?? null
});

const probes = (before, after) => ({
  kind:'probes', pin:'表笔电压差', probeLabels:{red:'PA0',black:'GND'}, windowMs:1000, before, after
});

function moveCursor(host, time) {
  const input = host.querySelector(cursor);
  input.value = time;
  input.oninput();
}

test('probe comparison preserves endpoint order, signed levels, and gaps in each lane',()=>{
  const host = traceHost();
  const trace = probes(series([[0,-2.5],[100,-2.5],[200,null],[400,1.25]]), series([[0,0],[200,0]]));
  renderSourceTrace(host,trace,3.3);
  assert.equal(host.hidden,false);
  assert.equal(host.querySelector('#sourceTraceProbePoints').textContent,'红表笔（+）PA0 − 黑表笔（−）GND');
  const drawing = host.querySelector(plot).innerHTML;
  assert.match(drawing,/>-2.5 V</);
  assert.match(drawing,/>\+1.25 V</);
  const beforePath = drawing.match(/trace-series trace-before"><title>应用前<\/title><path d="([^"]+)"/)[1];
  assert.equal([...beforePath.matchAll(/\bM /g)].length,2);
  assert.equal([...beforePath.matchAll(/\bH /g)].length,1); // Only the two consecutive valid samples are connected.

  moveCursor(host,200);
  assert.equal(host.querySelector(beforeReadout).textContent,'应用前 · 200 ms · 暂无有效读数');
  assert.equal(host.querySelector(afterReadout).textContent,'应用后 · 200 ms · 0 V');
  moveCursor(host,400);
  assert.equal(host.querySelector(beforeReadout).textContent,'应用前 · 400 ms · +1.25 V');
  assert.equal(host.querySelector(afterReadout).textContent,'应用后 · 此时段未采样');
});

test('a live probe trace renders one lane and switches back to unchanged GPIO layout',()=>{
  const host = traceHost();
  const live = probes(null,series([[125.25,null],[250,null]]));
  renderSourceTrace(host,live,3.3);
  assert.equal(host.querySelector('summary').textContent,'表笔电压差 · 当前波形');
  assert.equal(host.querySelector(beforeLabel).hidden,true);
  assert.equal(host.querySelector(beforeReadout).hidden,true);
  assert.match(host.querySelector(afterLabel).textContent,/^当前采样 · .*暂无有效读数$/);
  assert.equal([...host.querySelector(plot).innerHTML.matchAll(/class="trace-lane"/g)].length,1);
  assert.doesNotMatch(host.querySelector(plot).innerHTML,/class="trace-series/);
  moveCursor(host,125.25);
  assert.equal(host.querySelector(afterReadout).textContent,'当前 · 125.25 ms · 暂无有效读数');

  renderSourceTrace(host,{pin:'PA0',windowMs:1000,before:series([[0,3.3]]),after:series([[0,0]])},3.3);
  assert.equal(host.querySelector('summary').textContent,'PA0 · 应用前后波形');
  assert.equal(host.querySelector('#sourceTraceProbePoints').hidden,true);
  assert.equal(host.querySelector(beforeLabel).hidden,false);
  assert.equal(host.querySelector(beforeReadout).hidden,false);
  assert.equal(host.querySelector(beforeReadout).textContent,'应用前 · 0 ms · 3.3 V');
  assert.equal([...host.querySelector(plot).innerHTML.matchAll(/class="trace-lane"/g)].length,2);
});

test('updating the latest differential sample in place redraws the lane and keeps the cursor',()=>{
  const host = traceHost();
  const current = series([[100,-.0005],[200,null]]);
  const trace = probes(current,null);
  renderSourceTrace(host,trace,3.3);
  moveCursor(host,200);
  current.samples.at(-1).voltage = 0;
  renderSourceTrace(host,trace,3.3);
  assert.equal(host.querySelector(cursor).value,200);
  assert.equal(host.querySelector(afterReadout).textContent,'当前 · 200 ms · 0 V');
});

test('LED current comparison aligns two trigger times and keeps zero distinct from gaps',()=>{
  const host = traceHost();
  const before = currentSeries(500,[[0,4],[100,0],[200,null],[300,4.5]]);
  const after = currentSeries(200,[[0,1.25],[100,1.25]]);
  renderSourceTrace(host,{kind:'led',id:'led1',label:'外接 LED 1',windowMs:1000,before,after},3.3);

  assert.equal(host.querySelector('summary').textContent,'外接 LED 1 · 应用前后波形');
  assert.equal(host.querySelector('#sourceTraceProbePoints').hidden,true);
  assert.match(host.querySelector(beforeLabel).textContent,/仿真 500 ms 触发.*0 mA 至 4\.5 mA/);
  assert.match(host.querySelector(afterLabel).textContent,/仿真 200 ms 触发.*1\.25 mA/);
  const drawing = host.querySelector(plot).innerHTML;
  assert.equal([...drawing.matchAll(/class="trace-lane"/g)].length,2);
  assert.match(drawing,/>0 mA</);
  assert.match(drawing,/>4\.5 mA</);
  const beforePath = drawing.match(/trace-series trace-before"><title>应用前<\/title><path d="([^"]+)"/)[1];
  assert.equal([...beforePath.matchAll(/\bM /g)].length,2);
  assert.equal([...beforePath.matchAll(/\bH /g)].length,1);

  moveCursor(host,100);
  assert.equal(host.querySelector(cursor)['aria-valuetext'],'触发后 100 ms');
  assert.equal(host.querySelector(beforeReadout).textContent,'应用前 · 触发后 100 ms · 仿真 600 ms · 0 mA');
  assert.equal(host.querySelector(afterReadout).textContent,'应用后 · 触发后 100 ms · 仿真 300 ms · 1.25 mA');
  for (const time of [200,250]) {
    moveCursor(host,time);
    assert.equal(host.querySelector(beforeReadout).textContent,'应用前 · 触发后 200 ms · 仿真 700 ms · 暂无有效读数');
    assert.equal(host.querySelector(afterReadout).textContent,'应用后 · 此时段未采样');
  }
});

test('live LED current redraws at the same simulation time and resets the cursor for a different LED',()=>{
  const host = traceHost();
  const after = currentSeries(25.5,[[0,null],[150,0]]);
  const trace = {kind:'led',id:'led1',pin:'外接 LED 1',windowMs:1000,before:null,after};
  renderSourceTrace(host,trace,3.3);

  assert.equal(host.querySelector('summary').textContent,'外接 LED 1 · 当前波形');
  assert.equal(host.querySelector(beforeLabel).hidden,true);
  assert.equal(host.querySelector(beforeReadout).hidden,true);
  const drawing = host.querySelector(plot).innerHTML;
  assert.equal([...drawing.matchAll(/class="trace-lane"/g)].length,1);
  assert.match(drawing,/>1 mA</);
  assert.equal(host.querySelector(afterReadout).textContent,'当前 · 触发后 0 ms · 仿真 25.5 ms · 暂无有效读数');

  moveCursor(host,150);
  assert.equal(host.querySelector(afterReadout).textContent,'当前 · 触发后 150 ms · 仿真 175.5 ms · 0 mA');
  after.samples.at(-1).currentMa = 2.15;
  renderSourceTrace(host,trace,3.3);
  assert.equal(host.querySelector(cursor).value,150);
  assert.equal(host.querySelector(afterReadout).textContent,'当前 · 触发后 150 ms · 仿真 175.5 ms · 2.15 mA');

  renderSourceTrace(host,{...trace,id:'led2',pin:'外接 LED 2'},3.3);
  assert.equal(host.querySelector(cursor).value,0);
  assert.equal(host.querySelector('summary').textContent,'外接 LED 2 · 当前波形');
});
