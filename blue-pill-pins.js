// Looking at the top of the board with USB at the top, these contacts run left to right.
export const BLUE_PILL_SWD = Object.freeze([
  Object.freeze({ id: 'SWD_3V3', label: '3V3', canonical: '3V3', side: 'swd', kind: 'power' }),
  Object.freeze({ id: 'SWD_IO', label: 'DIO', canonical: 'PA13', side: 'swd', kind: 'gpio' }),
  Object.freeze({ id: 'SWD_CLK', label: 'CLK', canonical: 'PA14', side: 'swd', kind: 'gpio' }),
  Object.freeze({ id: 'SWD_GND', label: 'GND', canonical: 'GND', side: 'swd', kind: 'ground' })
]);
