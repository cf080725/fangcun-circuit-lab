const originalWidth = 7872;
const originalHeight = 3720;

// Positions were measured on the full-resolution JPEG. USB is on the right in
// that file. The displayed photo turns counterclockwise to put USB at the top.
const photoPoint = (x, y) => ({ x: y / originalHeight, y: 1 - x / originalWidth });

// Physical numbering goes down the left side from 1 to 20, then up the right
// side from 21 to 40. Each point is the center of its own through-hole.
const edgePadCenters = [
  [7269,617], [6917,614], [6567,619], [6214,622], [5867,622],
  [5516,616], [5165,618], [4814,616], [4465,622], [4118,619],
  [3765,614], [3415,614], [3063,617], [2715,617], [2362,619],
  [2012,617], [1659,616], [1309,616], [955,618], [604,615],
  [605,3080], [959,3074], [1309,3086], [1661,3074], [2015,3075],
  [2366,3077], [2718,3072], [3067,3072], [3419,3076], [3767,3077],
  [4119,3074], [4467,3075], [4819,3076], [5171,3077], [5519,3075],
  [5870,3074], [6219,3071], [6573,3073], [6920,3077], [7272,3077]
];

export const PICO_EDGE_POINTS = edgePadCenters.map(([x,y]) => ({
  ...photoPoint(x,y), hitWidth: .27, hitHeight: .043
}));

const debugPad = (x, y) => ({ ...photoPoint(x,y), hitWidth: .09, hitHeight: .043 });
export const PICO_SWD_POINTS = {
  SWD_CLK: debugPad(636,1496),
  SWD_GND: debugPad(634,1849),
  SWD_IO: debugPad(638,2203)
};

export const PICO_PHOTO = {
  width: 1280,
  height: 605,
  rotation: -90,
  url: new URL('./assets/raspberry-pi-pico-phiarc.jpg', import.meta.url),
  source: 'https://commons.wikimedia.org/wiki/File:Raspberry_Pi_Pico_top.jpg',
  credit: 'Phiarc / Wikimedia Commons',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  licenseLabel: 'CC BY-SA 4.0',
  note: '等比缩略图。网页旋转显示，标记为叠层。',
  alt: '原版 Raspberry Pi Pico 实物正面，Micro USB 朝上，左右各 20 个焊孔，下沿为三个调试焊孔',
  chip: { ...photoPoint(3875,1848), w: 970 / originalHeight, h: 964 / originalWidth }
};
