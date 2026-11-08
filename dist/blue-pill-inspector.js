import { BLUE_PILL_HEADERS, BLUE_PILL_HEADER_PINS, chipSignalForHeader, headerLabel } from './blue-pill-links.js';
import { mountBluePillPhoto, mountBoardPhoto } from './blue-pill-photo.js';
import { mountBluePillBoard, mountBoardInspection } from './blue-pill-board.js';
import { mountBluePillChip, mountChipInspection, chipPinForSignal } from './blue-pill-chip.js';
import { UNO_R3_INSPECTION } from './uno-r3-inspection.js';
import { ESP32_DEVKITC_INSPECTION } from './esp32-devkitc-inspection.js';
import { PICO_INSPECTION } from './pico-inspection.js';
import { NANO_INSPECTION } from './nano-inspection.js';
import { NUCLEO_F103RB_INSPECTION } from './nucleo-f103rb-inspection.js';

const datasheet = 'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf';
const bluePill = {
  id: 'blue-pill', title: 'Blue Pill', subtitle: '从照片上的排针，找到三维模型里的同一根针，再追到 STM32 的封装引脚。',
  orientation: 'USB 接口朝上时区分左右排。', defaultPin: 'PA0', quickPins: ['PA0','PC13','SWD_IO'],
  source: { url: datasheet, label: 'ST 芯片数据手册' },
  pins: BLUE_PILL_HEADER_PINS.map(pin => ({ ...pin, label: headerLabel(pin), summary: describeHeader(pin),
    group: BLUE_PILL_HEADERS.find(group => group.pins.includes(pin)).label, chipPin: chipPinForSignal(chipSignalForHeader(pin)) })),
};
const inspectionBoards = [bluePill, UNO_R3_INSPECTION, ESP32_DEVKITC_INSPECTION, PICO_INSPECTION, NANO_INSPECTION, NUCLEO_F103RB_INSPECTION];

function describeHeader(pin) {
  const notes = {
    PA0: '通用输入输出，也可接 ADC 或定时器。实验台的「外接 LED 闪烁」示例用它输出电平。',
    PC13: '常见 Blue Pill 的板载 LED 连接在这里，低电平时点亮。',
    NRST: '低电平复位 MCU。Blue Pill 的 RESET 按钮连接这条信号。',
    VBAT: '为 RTC 和备份域提供备用电源。',
    SWD_IO: 'SWD 双向调试数据线，对应芯片 PA13。',
    SWD_CLK: 'SWD 调试时钟线，对应芯片 PA14。',
    SWD_3V3: 'SWD 插座上的 3.3 V 电源网络。调试器可用它读取目标电平。',
    SWD_GND: 'SWD 插座的地线，与板上其他 GND 共用参考电位。'
  };
  if (notes[pin.id]) return notes[pin.id];
  if (pin.canonical === 'GND') return '这是一个独立的物理插针，和板上的其他 GND 共用电气参考点。';
  if (pin.canonical === '3V3') return '板上的 3.3 V 电源网络，连接到芯片的多处供电端。';
  if (pin.canonical === '5V') return '板级 5 V 电源，经稳压后为芯片供电。';
  return '通用输入输出引脚。能使用的复用功能可在芯片引脚层查看。';
}

export function mountBoardInspector(container, { boardId, activeBoardId, onBoard, onUseBoard, onExperiment, onBack }) {
  const config = inspectionBoards.find(board => board.id === boardId) ?? bluePill;
  const benchBoardId = config === bluePill ? 'bluepill' : config.id;
  const headerById = new Map(config.pins.map(pin => [pin.id, pin]));
  const references = config.source ?? config.chip.references.find(reference => /Arduino|DevKitC/.test(reference.label));
  const modelCredit = config.modelCredit;
  const chipTitle = config.chip?.title ?? 'STM32';
  const chipStyle = config.chip?.style;
  const chipParts = chipStyle === 'module' || chipStyle === 'qfn' ? '焊盘' : '脚';
  const renderedReference = config.photo?.kind === 'render';
  container.innerHTML = `
    <header class="blue-pill-heading">
      <div><p class="blue-pill-eyebrow">实物对照 / 开发板</p>
        <h1 id="bluePillTitle" tabindex="-1">${config.title} 实物对照</h1>
        <p>${config.subtitle}</p>
      </div>
      <div class="inspection-heading-actions">
        <button type="button" class="button subtle" id="bluePillBackLab">← 返回实验台</button>
        ${onUseBoard && benchBoardId !== activeBoardId ? '<button type="button" class="button primary-light" id="inspectionUseBoard">用这块板做实验 →</button>' : ''}
        ${onExperiment && config.experiment ? `<button type="button" class="button primary" id="inspectionExperiment">${config.experiment} →</button>` : ''}
      </div>
    </header>
    <nav class="inspection-board-tabs" aria-label="选择对照板卡">${inspectionBoards.map(board =>
      `<a href="#${board.id}" data-inspection-board="${board.id}"${board.id === config.id ? ' aria-current="page"' : ''}>${board.title}</a>`).join('')}</nav>
    <div data-blue-pill-content></div>`;
  const content = container.querySelector('[data-blue-pill-content]');
  const title = container.querySelector('#bluePillTitle');
  const heading = title.closest('header');
  const boardTabs = container.querySelector('.inspection-board-tabs');
  container.querySelector('#bluePillBackLab').addEventListener('click', () => onBack?.());
  container.querySelector('#inspectionUseBoard')?.addEventListener('click', () => onUseBoard(benchBoardId));
  container.querySelector('#inspectionExperiment')?.addEventListener('click', onExperiment);
  for (const tab of boardTabs.querySelectorAll('a')) tab.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (tab.dataset.inspectionBoard !== config.id) onBoard?.(tab.dataset.inspectionBoard);
  });

  let photo, board, chip, selectedId = config.defaultPin;

  function cleanView() {
    photo?.destroy(); board?.destroy(); chip?.destroy();
    photo = board = chip = null;
  }

  function selectPin(id) {
    const pin = headerById.get(id);
    if (!pin) return;
    selectedId = id;
    photo?.setPin(id);
    board?.setPin(id);
    content.querySelector('#bluePillPinIndex').value = id;
    const chipPin = pin.chipPin;
    const jump = content.querySelector('#bluePillChipPinJump');
    jump.hidden = chipPin == null;
    const chipPad = config.chip?.pins.find(pad => pad.number === chipPin);
    jump.textContent = chipPin == null ? '' : chipStyle === 'qfn' && chipPad?.signal === 'GND'
      ? '看芯片底面接地焊盘 ↗'
      : (chipStyle === 'module' ? '看模组第 ' : '看芯片第 ') + chipPin + (chipStyle === 'qfn' ? ' 号' : ' ') + chipParts + ' ↗';
    content.querySelector('#bluePillSelectedPin').textContent = pin.label;
    content.querySelector('#bluePillSelectedDescription').textContent = pin.summary ?? '点选两侧任一模型可查看同一个物理位置。';
    for (const button of content.querySelectorAll('[data-blue-pill-quick]')) {
      button.setAttribute('aria-pressed', String(button.dataset.bluePillQuick === id));
    }
  }

  function openChip(pin = null) {
    cleanView();
    heading.hidden = true;
    boardTabs.hidden = true;
    content.replaceChildren();
    const chipHooks = {
      pin,
      onPin(number) {
        if(number == null || headerById.get(selectedId)?.chipPin === number)return;
        const header = config.pins.find(entry => entry.chipPin === number);
        if (header) selectedId = header.id;
      },
      onBack: () => showComparison(true)
    };
    chip = config.chip ? mountChipInspection(content, { chip: config.chip, boardTitle: config.title, ...chipHooks }) : mountBluePillChip(content, chipHooks);
    content.querySelector('.bp-chip-heading h1')?.focus();
  }

  function showComparison(returning = false) {
    cleanView();
    heading.hidden = false;
    boardTabs.hidden = false;
    content.innerHTML = `
      <div class="blue-pill-control">
        <div class="blue-pill-index"><label for="bluePillPinIndex">定位板上引脚</label><select id="bluePillPinIndex"></select></div>
        <div class="blue-pill-quick" aria-label="快速选择引脚">
          ${config.quickPins.map(id => `<button type="button" data-blue-pill-quick="${id}">${headerById.get(id).label}</button>`).join('')}
        </div>
        <button type="button" class="button primary" id="bluePillChipOpen">拆解 ${chipTitle} ↗</button>
      </div>
      <div class="blue-pill-pair">
        <section class="blue-pill-panel" aria-labelledby="bluePillPhotoTitle">
          <div class="blue-pill-panel-head"><p class="blue-pill-eyebrow">01 / ${renderedReference ? '板面俯视图' : '实物照片'}</p><h2 id="bluePillPhotoTitle">在板上找引脚</h2></div>
          <div id="bluePillPhoto"></div>
        </section>
        <section class="blue-pill-panel blue-pill-model" aria-labelledby="bluePillModelTitle">
          <div class="blue-pill-panel-head"><p class="blue-pill-eyebrow">02 / 交互 3D</p><h2 id="bluePillModelTitle">转动模型看位置</h2></div>
          <div id="bluePillBoard"></div>
        </section>
      </div>
      <div class="blue-pill-pin-detail">
        <div aria-live="polite" aria-atomic="true"><p class="blue-pill-eyebrow">当前引脚</p>
          <strong id="bluePillSelectedPin"></strong><p id="bluePillSelectedDescription"></p>
        </div>
        <button type="button" class="button primary-light" id="bluePillChipPinJump" hidden></button>
      </div>
      <p class="blue-pill-footnote">${config.orientation} 不同版本请核对手上板子的丝印和主芯片型号。 <a href="${references.url}" target="_blank" rel="noopener noreferrer">${references.label} ↗</a></p>
      ${modelCredit ? `<p class="blue-pill-footnote">三维模型依据 <a href="${modelCredit.source}" target="_blank" rel="noopener noreferrer">${modelCredit.name}</a> 重建和简化。${modelCredit.note ?? ''}${modelCredit.license ? `<a href="${modelCredit.license}" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · ` : ''}<a href="${modelCredit.file}" download>下载三维模型</a></p>` : ''}`;
    const select = content.querySelector('#bluePillPinIndex');
    const groups = new Map();
    for (const pin of config.pins) {
      if (!groups.has(pin.group)) {
        const options = document.createElement('optgroup'); options.label = pin.group;
        select.append(options); groups.set(pin.group, options);
      }
      groups.get(pin.group).append(new Option(pin.label, pin.id));
    }
    select.addEventListener('change', () => selectPin(select.value));
    content.querySelector('#bluePillChipOpen').addEventListener('click', () => openChip());
    content.querySelector('#bluePillChipPinJump').addEventListener('click', () => openChip(headerById.get(selectedId)?.chipPin));
    for (const button of content.querySelectorAll('[data-blue-pill-quick]')) {
      button.addEventListener('click', () => selectPin(button.dataset.bluePillQuick));
    }
    const hooks = { onPin: selectPin, onChip: () => openChip() };
    const photoHost = content.querySelector('#bluePillPhoto'), boardHost = content.querySelector('#bluePillBoard');
    photo = config.photo ? mountBoardPhoto(photoHost, { photo: config.photo, pins: config.pins, chipTitle, ...hooks }) : mountBluePillPhoto(photoHost, hooks);
    board = config.photo ? mountBoardInspection(boardHost, { boardId: config.id, pins: config.pins,
      referenceLabel: renderedReference ? '板面俯视图' : undefined, ...hooks }) : mountBluePillBoard(boardHost, hooks);
    selectPin(selectedId);
    if (returning) content.querySelector('#bluePillChipOpen').focus();
  }

  try { showComparison(); } catch (error) { cleanView(); throw error; }
  return { focus: () => title.focus({ preventScroll: true }), destroy() { cleanView(); container.replaceChildren(); } };
}
