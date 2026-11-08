import { BOARD_PROFILES } from './board-profiles.js';
import { BLUE_PILL_SWD } from './blue-pill-pins.js';

const board = BOARD_PROFILES.bluepill;
export const BLUE_PILL_HEADERS = [
  { label: 'USB 朝上 · 左排', pins: board.pins.filter(pin => pin.side === 'left') },
  { label: 'USB 朝上 · 右排', pins: board.pins.filter(pin => pin.side === 'right') },
  { label: '板底 · SWD 调试排针', pins: BLUE_PILL_SWD }
];
export const BLUE_PILL_HEADER_PINS = BLUE_PILL_HEADERS.flatMap(group => group.pins);

// A board rail can power several package leads, or reach the chip via a regulator.
// Only offer a package-pin jump for signals with a direct, identifiable lead.
export function chipSignalForHeader(pin) {
  const signal = pin?.canonical;
  return /^(?:P[ABC]\d{1,2}|NRST|VBAT)$/.test(signal ?? '') ? signal : null;
}

export function headerForChipSignal(signal) {
  return BLUE_PILL_HEADER_PINS.find(pin => chipSignalForHeader(pin) === signal) ?? null;
}

export function headerLabel(pin) {
  if (pin.side === 'swd') return ({ SWD_3V3: '3V3 · SWD', SWD_IO: 'SWDIO', SWD_CLK: 'SWCLK', SWD_GND: 'GND · SWD' })[pin.id];
  if (/^GND[123]$/.test(pin.id)) return 'GND · ' + (pin.side === 'left' ? '左排' : pin.id === 'GND2' ? '右排第 1 位' : '右排第 2 位');
  if (pin.id === '3V3' || pin.id === '3V3b') return '3V3 · ' + (pin.side === 'left' ? '左排' : '右排');
  return pin.label;
}
