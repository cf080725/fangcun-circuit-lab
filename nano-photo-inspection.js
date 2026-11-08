const width = 397;
const height = 855;

// Pixel centers in Mellis's original photograph, with its Mini-B connector down.
// The photo is turned by 180° in the viewer to match the lab's board model.
function turnedPoint(x, y) {
  return { x: 1 - x / width, y: 1 - y / height };
}

const right = [
  ['VIN',337,105], ['GND1',337,149], ['RESET1',336,194], ['5V',337,238],
  ['A7',336,282], ['A6',335,325], ['A5',335,368], ['A4',335,413],
  ['A3',335,456], ['A2',334,500], ['A1',334,543], ['A0',334,587],
  ['AREF',334,630], ['3V3',333,674], ['D13',333,716]
];
const left = [
  ['D1',73,106], ['D0',73,149], ['RESET2',73,194], ['GND2',73,238],
  ['D2',73,281], ['D3',73,325], ['D4',73,369], ['D5',73,412],
  ['D6',72,456], ['D7',72,499], ['D8',72,542], ['D9',72,586],
  ['D10',72,630], ['D11',73,674], ['D12',73,716]
];

export const NANO_EDGE_POINTS = Object.fromEntries([...right, ...left].map(([id, x, y]) =>
  [id, { ...turnedPoint(x, y), hitWidth: .11, hitHeight: .048 }]));

// Connector numbering begins at the silkscreen "1" next to the upper-right pad.
const icspPixels = [[250,59], [250,107], [207,59], [207,107], [161,59], [161,107]];
export const NANO_ICSP_POINTS = Object.fromEntries(icspPixels.map(([x, y], index) =>
  [`ICSP_${index + 1}`, { ...turnedPoint(x, y), hitWidth: .096, hitHeight: .047 }]));

export const NANO_PHOTO = {
  url: new URL('./assets/arduino-nano-v3-mellis.jpg', import.meta.url),
  width,
  height,
  rotation: 180,
  alt: 'Gravitech Arduino Nano V3.0 正面实拍。USB Mini-B 在上方，两侧各 15 根排针，板尾是 6 针 ICSP。',
  credit: 'David A. Mellis / Wikimedia Commons（2010 年原图）',
  source: 'https://upload.wikimedia.org/wikipedia/commons/archive/8/8d/20180327211826%21Arduino_Nano.jpg',
  licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  licenseLabel: 'CC BY 2.0',
  note: '网页将原图旋转 180°，交互标记为独立叠层。',
  chip: { ...turnedPoint(200, 520), w: 161 / width, h: 160 / height }
};
