import {nearestSourceSample} from './source-trace.js';

const rendered = new WeakMap();
const emptySeries = { samples: [], sampledThroughMs: null };
const volts = value => Number(value.toFixed(2)) + ' V';
const probeVolts = value => {
  const magnitude = Math.abs(value);
  const display = magnitude && magnitude < .01 ? Number(magnitude.toPrecision(2)).toExponential() : Number(magnitude.toFixed(3));
  return (value > 0 ? '+' : value < 0 ? '-' : '') + display + ' V';
};
const milliamps = value => {
  const display = value > 0 && value < .001 ? Number(value.toPrecision(2)).toExponential() : Number(value.toFixed(3));
  return display + ' mA';
};
const seconds = value => Number((value / 1000).toFixed(3)) + ' s';
const milliseconds = value => Number(value.toFixed(3)) + ' ms';
const plotRight = 401;
const timeX = (time, windowMs, left) => left + time * (plotRight - left) / windowMs;

function validReading(value, field) {
  return Number.isFinite(value) && (field !== 'currentMa' || value >= 0);
}

function readingRange(samples, low, high, field) {
  for (const sample of samples) {
    const value = sample[field];
    if (!validReading(value, field)) continue;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return [low, high];
}

const laneHeight = 43;

const valueY = (value, top, scale) => top + laneHeight * (scale[1] - value) / (scale[1] - scale[0]);

function laneGrid(top, scale, formatReading, probes, left) {
  const zero = probes && scale[0] < 0 && scale[1] > 0 ? valueY(0, top, scale) : null;
  return `<rect class="trace-lane" x="${left}" y="${top}" width="${plotRight - left}" height="${laneHeight}" rx="2"/>
    ${zero === null ? '' : `<path class="trace-grid" d="M ${left} ${zero} H ${plotRight}"/>`}
    <text class="trace-axis" x="${left - 6}" y="${top + 9}" text-anchor="end">${formatReading(scale[1])}</text>
    <text class="trace-axis" x="${left - 6}" y="${top + laneHeight}" text-anchor="end">${formatReading(scale[0])}</text>`;
}

function laneSeries(samples, top, scale, timeX, label, tone, field) {
  const dot = sample => `<circle cx="${timeX(sample.timeMs)}" cy="${valueY(sample[field], top, scale)}" r="2.3"/>`;
  let wave = '', points = '', first = null, previous = null;
  for (const sample of samples) {
    if (!validReading(sample[field], field)) {
      if (previous && previous !== first) points += dot(previous);
      previous = null;
      continue;
    }
    const x = timeX(sample.timeMs), y = valueY(sample[field], top, scale);
    if (previous) wave += ` H ${x} V ${y}`;
    else {
      wave += ` M ${x} ${y}`;
      first = sample;
      points += dot(sample);
    }
    previous = sample;
  }
  if (previous && previous !== first) points += dot(previous);
  return wave ? `<g class="trace-series ${tone}"><title>${label}</title><path d="${wave.trimStart()}"/>${points}</g>` : '';
}

function describe(series, formatReading, field) {
  const { samples, sampledThroughMs, originMs } = series;
  if (!samples.length) return '等待可用采样';
  const [low, high] = readingRange(samples, Infinity, -Infinity, field);
  const first = samples[0].timeMs;
  const span = first === sampledThroughMs ? seconds(first) : seconds(first) + '–' + seconds(sampledThroughMs);
  const range = !Number.isFinite(low) ? '暂无有效读数' : low === high ? formatReading(low) : formatReading(low) + ' 至 ' + formatReading(high);
  const origin = field === 'currentMa' && Number.isFinite(originMs) ? `仿真 ${milliseconds(originMs)} 触发 · ` : '';
  return origin + span + ' · ' + range;
}

function renderCursor(host, view) {
  const cursor = host.querySelector('#sourceTraceCursor');
  const time = Number(cursor.value);
  const displayTime = milliseconds(time);
  cursor.setAttribute('aria-valuetext', view.led ? '触发后 ' + displayTime : displayTime);
  host.querySelector('#sourceTraceCursorTime').textContent = view.led ? '+' + displayTime : displayTime;
  const line = host.querySelector('.trace-cursor-line');
  const x = timeX(time, view.windowMs, view.left);
  line.setAttribute('x1', x);
  line.setAttribute('x2', x);
  for (const side of ['before', 'after']) {
    const readout = host.querySelector(`[data-trace-cursor="${side}"]`);
    readout.hidden = view.live && side === 'before';
    if (readout.hidden) continue;
    const label = view.live ? '当前' : side === 'before' ? '应用前' : '应用后';
    const series = view[side];
    const sample = nearestSourceSample(series, time, view.field);
    if (!sample) { readout.textContent = label + ' · 此时段未采样'; continue; }
    const relative = milliseconds(sample.timeMs);
    const timestamp = view.led ? '触发后 ' + relative + (Number.isFinite(series.originMs) ? ' · 仿真 ' + milliseconds(series.originMs + sample.timeMs) : '') : relative;
    const value = sample[view.field];
    readout.textContent = label + ' · ' + timestamp + ' · ' + (validReading(value, view.field) ? view.formatReading(value) : '暂无有效读数');
  }
}

export function renderSourceTrace(host, trace, logicVoltage) {
  if (!host) return;
  const probes = trace?.kind === 'probes';
  const led = trace?.kind === 'led';
  host.hidden = probes || led ? !trace.before && !trace.after : !trace?.before?.samples.length;
  if (host.hidden) {
    host.open = false;
    rendered.delete(host);
    return;
  }
  const { windowMs, id, kind } = trace;
  const pin = trace.label ?? trace.pin;
  const live = (probes || led) && (!trace.before || !trace.after);
  const before = live ? emptySeries : trace.before;
  const after = live ? trace.after ?? trace.before : trace.after ?? emptySeries;
  const red = probes ? trace.probeLabels?.red ?? trace.red ?? '未指定' : null;
  const black = probes ? trace.probeLabels?.black ?? trace.black ?? '未指定' : null;
  const field = led ? 'currentMa' : 'voltage';
  const past = rendered.get(host);
  const last = after.samples.at(-1);
  if (past?.before === before.samples && past.after === after.samples && past.pin === pin && past.kind === kind && past.id === id &&
      past.windowMs === windowMs && past.logicVoltage === logicVoltage && past.live === live &&
      past.red === red && past.black === black &&
      past.beforeOrigin === before.originMs && past.afterOrigin === after.originMs &&
      past.through === after.sampledThroughMs && past.length === after.samples.length &&
      past.value === last?.[field]) return;
  const formatReading = led ? milliamps : probes ? probeVolts : volts;
  const left = probes || led ? 72 : 41;
  const view = { before, after, live, led, windowMs, field, formatReading, left };
  rendered.set(host, { view, before: before.samples, after: after.samples, pin, kind, id, windowMs, logicVoltage, live, red, black,
    beforeOrigin: before.originMs, afterOrigin: after.originMs,
    through: after.sampledThroughMs, length: after.samples.length, value: last?.[field] });

  const [low,high] = readingRange(before.samples, 0, probes || led ? 0 : logicVoltage || 3.3, field);
  let scale = readingRange(after.samples, low, high, field);
  if (scale[0] === scale[1]) scale = led ? [0, 1] : [-1, 1];
  const plotX = time => timeX(time, windowMs, left);
  const lanes = live ? [{ samples:after.samples, top:10, label:'当前采样', tone:'trace-after' }]
    : [{ samples:before.samples, top:10, label:'应用前', tone:'trace-before' }, { samples:after.samples, top:65, label:'应用后', tone:'trace-after' }];
  const bottom = lanes.at(-1).top + laneHeight;
  const ticks = Array.from({ length: 6 }, (_, index) => {
    const time = index * windowMs / 5, x = plotX(time);
    const anchor = index === 0 ? 'start' : index === 5 ? 'end' : 'middle';
    const lines = lanes.map(({ top }) => `M ${x} ${top} V ${top + laneHeight}`).join(' ');
    return `<path class="trace-grid" d="${lines}"/>
      <text class="trace-axis" x="${x}" y="${bottom + 16}" text-anchor="${anchor}">${seconds(time)}</text>`;
  }).join('');
  // Separate lanes keep matching waveforms visible.
  host.querySelector('.source-trace-plot').innerHTML = `<svg viewBox="0 0 412 ${bottom + 22}" aria-hidden="true">
    ${lanes.map(({ top }) => laneGrid(top, scale, formatReading, probes, left)).join('')}
    ${ticks}
    ${lanes.map(({ samples, top, label, tone }) => laneSeries(samples, top, scale, plotX, label, tone, field)).join('')}
    <line class="trace-cursor-line" y1="7" y2="${bottom + 3}"/>
  </svg>`;
  const cursor = host.querySelector('#sourceTraceCursor');
  cursor.max = windowMs;
  if (!past || past.kind !== kind || past.id !== id || past.before !== before.samples || past.live !== live ||
      live && past.after !== after.samples || past.red !== red || past.black !== black) cursor.value = 0;
  cursor.oninput ??= () => {
    const current = rendered.get(host);
    if (current) renderCursor(host, current.view);
  };
  renderCursor(host, view);
  host.querySelector('summary').textContent = (pin || (led ? 'LED 电流' : '表笔电压差')) + (live ? ' · 当前波形' : ' · 应用前后波形');
  const probePoints = host.querySelector('#sourceTraceProbePoints');
  if (probePoints) {
    probePoints.hidden = !probes;
    if (probes) probePoints.textContent = `红表笔（+）${red} − 黑表笔（−）${black}`;
  }
  const beforeLabel = host.querySelector('.source-trace-before');
  beforeLabel.hidden = live;
  beforeLabel.textContent = live ? '' : '应用前（上） · ' + describe(before, formatReading, field);
  host.querySelector('.source-trace-after').textContent = (live ? '当前采样' : '应用后（下）') + ' · ' + describe(after, formatReading, field);
}
