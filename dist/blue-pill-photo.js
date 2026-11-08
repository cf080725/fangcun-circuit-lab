import { BOARD_PROFILES } from './board-profiles.js';
import { BLUE_PILL_SWD } from './blue-pill-pins.js';

const photo = {
  width: 874,
  height: 362,
  url: new URL('./assets/blue-pill-avandalen.jpg', import.meta.url),
  source: 'https://commons.wikimedia.org/wiki/File:Blue_Pill.jpg',
  license: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

// Centers on the original JPEG (USB on the left). The image and targets are
// both rotated clockwise for a top-down match with the board model.
const leftPadCenters = [
  [60.8,289], [97.3,289], [133.5,289], [170.1,289.1], [206.1,289.2],
  [242.1,289.3], [278.3,289.4], [314.6,289.3], [350.6,289.6], [386.3,289.8],
  [422.4,289.7], [458.2,289.7], [494.1,289.8], [530.1,289.8], [566,290],
  [602.1,290], [637.9,290.1], [674.2,290], [709.8,290.1], [745.4,290.4],
];
const rightPadCenters = [
  [63.1,71.9], [99.3,72.1], [135.4,72.5], [171.7,72.7], [207.7,72.9],
  [243.5,73.2], [279.4,73.2], [315.4,73.2], [351.1,73.2], [386.9,73.7],
  [422.9,73.8], [458.5,73.9], [494.1,74.1], [529.9,74.4], [565.7,74.4],
  [601.2,74.8], [637,74.9], [672.9,74.8], [708.5,75], [744.2,75.1],
];
const swdPadCenters = [[695,232], [694,198], [693,163], [693,128]];
const chipCenter = [410,180];

function rotatePoint([x, y]) {
  return { x: (photo.height - y) / photo.height, y: x / photo.width };
}

function placePins(pins, centers) {
  return pins.map((pin, index) => ({ ...pin, ...rotatePoint(centers[index]), position: index }));
}

const profile = BOARD_PROFILES.bluepill;
const leftPins = placePins(profile.pins.filter(pin => pin.side === 'left'), leftPadCenters);
const rightPins = placePins(profile.pins.filter(pin => pin.side === 'right'), rightPadCenters);
const swdPins = placePins(BLUE_PILL_SWD, swdPadCenters);
export const BLUE_PILL_PHOTO_PINS = [...leftPins, ...rightPins, ...swdPins];

function targetForArrow(pin, key) {
  const i = pin.position;
  if (pin.side === 'swd') {
    if (key === 'ArrowLeft') return swdPins[i - 1];
    if (key === 'ArrowRight') return swdPins[i + 1];
    if (key === 'ArrowUp') return (i < 2 ? leftPins : rightPins).at(-1);
    return undefined;
  }
  const row = pin.side === 'left' ? leftPins : rightPins;
  if (key === 'ArrowUp') return row[i - 1];
  if (key === 'ArrowDown') return row[i + 1] || (pin.side === 'left' ? swdPins[0] : swdPins.at(-1));
  if (key === 'ArrowLeft' && pin.side === 'right') return leftPins[i];
  if (key === 'ArrowRight' && pin.side === 'left') return rightPins[i];
  return undefined;
}

function positionTarget(element, point) {
  element.style.left = `${point.x * 100}%`;
  element.style.top = `${point.y * 100}%`;
}

export function mountBluePillPhoto(container, { onPin, onChip } = {}) {
  return mountBoardPhoto(container, {
    photo: { ...photo, originalRotated: true, credit: 'Avandalen / Wikimedia Commons', licenseUrl: photo.license,
      licenseLabel: 'CC BY-SA 4.0', note: '原图在网页中旋转，交互标记为叠层。',
      alt: 'Blue Pill 开发板实物正面，Micro USB 接口朝上，两侧各有一排引脚', chip: rotatePoint(chipCenter) },
    pins: BLUE_PILL_PHOTO_PINS, chipTitle: 'STM32F103C8T6', onPin, onChip
  });
}

export function mountBoardPhoto(container, { photo, pins, chipTitle, onPin, onChip }) {
  const rendered = photo.kind === 'render';
  const surface = rendered ? '板面俯视图' : '实物照片';
  const figure = document.createElement('figure');
  figure.className = 'pill-photo';
  if(!photo.originalRotated){
    figure.classList.add('pill-photo-custom');
    const aspect = photo.width/photo.height;
    const quarterTurn = Math.abs(photo.rotation)===90;
    figure.style.setProperty('--photo-aspect',String(quarterTurn ? 1/aspect : aspect));
    if (quarterTurn || Math.abs(photo.rotation)===180) {
      figure.classList.add('pill-photo-turned');
      figure.style.setProperty('--photo-unrotated-width',`${quarterTurn ? aspect*100 : 100}%`);
      figure.style.setProperty('--photo-rotation',`${photo.rotation}deg`);
    }
  }
  figure.innerHTML = `
    <div class="pill-photo-field">
      <div class="pill-photo-stage">
        <img class="pill-photo-image">
        <div class="pill-photo-hotspots" role="group" aria-label="${surface}引脚，可用方向键移动焦点，回车选中"></div>
      </div>
      <p class="pill-photo-error" hidden>${surface}加载失败，可打开下方的板卡资料。</p>
    </div>
    <figcaption class="pill-photo-credit">${rendered ? 'Blender 俯视渲染' : '实物摄影'} · <a href="${photo.source}" target="_blank" rel="noopener noreferrer">${photo.credit}</a>${photo.licenseUrl ? ` · <a href="${photo.licenseUrl}" target="_blank" rel="noopener noreferrer">${photo.licenseLabel}</a>` : ''}。${photo.note}</figcaption>`;

  const image = figure.querySelector('img');
  image.width=photo.width;image.height=photo.height;image.alt=photo.alt;
  const stage = figure.querySelector('.pill-photo-stage');
  const hotspots = figure.querySelector('.pill-photo-hotspots');
  image.addEventListener('error', () => {
    stage.hidden = true;
    figure.querySelector('.pill-photo-error').hidden = false;
  });
  image.src = String(photo.url);

  const buttons = new Map();
  let activeId = null;
  let tabbableId = null;

  function setTabStop(id) {
    if (!buttons.has(id)) return;
    if (tabbableId) buttons.get(tabbableId).tabIndex = -1;
    buttons.get(id).tabIndex = 0;
    tabbableId = id;
  }

  function setPin(id) {
    if (activeId) buttons.get(activeId).setAttribute('aria-pressed', 'false');
    activeId = buttons.has(id) ? id : null;
    if (!activeId) return;
    buttons.get(activeId).setAttribute('aria-pressed', 'true');
    setTabStop(activeId);
  }

  for (const pin of pins) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill-photo-pin';
    button.dataset.photoPin = pin.id;
    if(pin.side)button.dataset.side = pin.side;
    button.tabIndex = -1;
    button.setAttribute('aria-pressed', 'false');
    const label = photo.originalRotated ? (pin.side === 'swd' ? `SWD ${pin.label}` : pin.id) : pin.label;
    button.setAttribute('aria-label', `${rendered ? '俯视图' : '照片'}${pin.part ? '部件' : '引脚'} ${label}${pin.canonical === label ? '' : ` · ${pin.canonical}`}`);
    positionTarget(button, pin);
    if(!photo.originalRotated){
      button.style.width=(pin.hitWidth??.075)*100+'%';
      button.style.height=(pin.hitHeight??.04)*100+'%';
      if(!pin.side && pin.x<.5)button.dataset.side='left';
    }
    const badge = document.createElement('span');
    badge.className = 'pill-photo-pin-label';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = label;
    button.append(badge);
    button.addEventListener('click', () => {
      setPin(pin.id);
      onPin?.(pin.id);
    });
    button.addEventListener('keydown', event => {
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();
      const next = photo.originalRotated ? targetForArrow(pin, event.key) : nextPhotoPin(pins,pin,event.key);
      if (!next) return;
      setTabStop(next.id);
      buttons.get(next.id).focus();
    });
    buttons.set(pin.id, button);
    hotspots.append(button);
  }
  setTabStop(pins[0].id);

  const chipButton = document.createElement('button');
  chipButton.type = 'button';
  chipButton.className = 'pill-photo-chip';
  chipButton.dataset.photoChip = '';
  chipButton.setAttribute('aria-label', '拆解'+surface+'中的 '+chipTitle);
  chipButton.innerHTML = '<span aria-hidden="true">拆解芯片</span>';
  positionTarget(chipButton, photo.chip);
  if(photo.chip.w)chipButton.style.width=photo.chip.w*100+'%';
  if(photo.chip.h)chipButton.style.height=photo.chip.h*100+'%';
  chipButton.addEventListener('click', () => onChip?.());
  hotspots.append(chipButton);
  container.append(figure);

  return { setPin, destroy: () => figure.remove() };
}

function nextPhotoPin(pins, active, key){
  const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  if(!directions[key])return null;
  const [dx,dy]=directions[key];
  let best,score=Infinity;
  for(const pin of pins){
    const x=pin.x-active.x,y=pin.y-active.y,forward=x*dx+y*dy;
    if(forward<=.002)continue;
    const next=forward+Math.abs(x*dy-y*dx)*3;
    if(next<score){best=pin;score=next;}
  }
  return best;
}
