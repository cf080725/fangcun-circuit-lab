import {describeMountChanges} from './mount-placement.js';
import {boardMountRows} from './breadboard-mount.js';

const breadboardColumns = 30;
const columnNumbers = Array.from({ length: breadboardColumns }, (_, index) => index + 1);
const rotationLabels = {
  90: 'USB 朝左（小列号）· 90°',
  270: 'USB 朝右（大列号）· 270°'
};

export function mountPlacementSuggestion(safeSlot, clearanceSlot, previewingClearance) {
  if (safeSlot) return {slot:safeSlot,enableClearance:false};
  return {slot:clearanceSlot,enableClearance:Boolean(clearanceSlot&&!previewingClearance)};
}

function placementDiagram() {
  const rulers = [1, 5, 10, 15, 20, 25, 30]
    .map(column => `<span style="grid-column:${column}">${column}</span>`).join('');
  const dots = columnNumbers.map(column => `<span data-placement-hole="${column}"></span>`).join('');
  return `<div class="mount-placement-diagram" aria-hidden="true">
    <div class="mount-placement-ruler"><span>列</span><div>${rulers}</div></div>
    ${[...'ABCDEFGHIJ'].map(row => `<div class="mount-placement-row" data-placement-row="${row}"><b>${row}</b><div>${dots}</div></div>`).join('')}
  </div>`;
}

export function showMountPlacementDialog({ modal, options, boardName, initial, evaluate, recommend, onApply, onPlaced, message: notice, current, practice, chooseColumn=false }) {
  const columns = columnNumbers.filter(column => column >= options.minColumn && column <= options.maxColumn);
  const columnOptions = columns.map(column => `<option value="${column}">第 ${column} 列</option>`).join('');
  const currentRows = current && boardMountRows(current,options);
  const directColumns = columns.map(column => {
    const original = Boolean(currentRows && current.column===column);
    return `<button type="button" class="button" data-placement-column="${column}" aria-label="第 ${column} 列${original?'，原起始列':''}" aria-pressed="false">${column}${original?'<small aria-hidden="true">原</small>':''}</button>`;
  }).join('');
  const rowOptions = options.rowPairs.map((pair,index) => `<option value="${pair.join('')}">${pair.join(' / ').toUpperCase()} 排${index===0?'（默认）':''}</option>`).join('');
  const rotationOptions = options.rotations.map(rotation => `<option value="${rotation}">${rotationLabels[rotation]}</option>`).join('');
  modal(current ? '开发板换孔位' : '开发板与面包板对孔', `<form id="mountPlacementForm" class="mount-placement-form">
    <p><strong id="mountBoardName"></strong> <span id="mountPlacementIntro">选择排孔、起始列和 USB 朝向。确认后才会${current?'换孔':'插入'}。</span></p>
    <div class="mount-placement-fields" data-row-choice="${options.rowPairs.length>1}">
      <label for="mountPlacementRows" ${options.rowPairs.length>1?'':'hidden'}>排孔组合<select id="mountPlacementRows">${rowOptions}</select></label>
      <div class="mount-placement-column">
        <label for="mountPlacementColumn">起始列</label>
        <div>
          <button type="button" class="button" id="mountColumnPrev" aria-label="上一列" title="上一列">−</button>
          <select id="mountPlacementColumn" autofocus>${columnOptions}</select>
          <button type="button" class="button" id="mountColumnNext" aria-label="下一列" title="下一列">+</button>
        </div>
      </div>
      <label for="mountPlacementRotation">USB 朝向（俯视）<select id="mountPlacementRotation">${rotationOptions}</select></label>
    </div>
    <details class="mount-placement-direct" ${chooseColumn?'open':''}>
      <summary>直接选起始列 <span id="mountPlacementDirectValue"></span></summary>
      <div class="mount-placement-column-grid" role="group" aria-label="排针起始列">${directColumns}</div>
    </details>
    <div class="mount-placement-positions">
      <span id="mountPlacementCurrent" ${currentRows?'':'hidden'}></span>
      <strong id="mountPlacementTarget"></strong>
    </div>
    <div id="mountPlacementStatus" class="mount-placement-status" role="status" aria-atomic="true">
      <strong id="mountPlacementRange"></strong>
      <p id="mountPlacementMessage"></p>
      <p id="mountPlacementWarning" hidden></p>
      <p id="mountLessonWarning" hidden></p>
      <ul id="mountPlacementChanges" hidden></ul>
    </div>
    <p class="mount-placement-diagram-hint" id="mountPlacementDiagramHint"></p>
    ${placementDiagram()}
    <div class="mount-placement-recovery">
      <label id="mountClearOption" hidden><input type="checkbox" id="mountClearConflicts">预览如何腾出当前孔位</label>
    </div>
    <div class="project-actions mount-placement-actions">
      <button type="button" class="button" id="mountPlacementCancel">取消</button>
      <button type="button" class="button" id="mountRecommend" hidden>定位可用插位</button>
      <button type="submit" class="button primary" id="mountPlacementApply">插入并接通</button>
    </div>
  </form>`);

  const form = document.getElementById('mountPlacementForm');
  const dialog = form.closest('dialog');
  const column = form.querySelector('#mountPlacementColumn');
  const previousColumn = form.querySelector('#mountColumnPrev');
  const nextColumn = form.querySelector('#mountColumnNext');
  const rowChoice = form.querySelector('#mountPlacementRows');
  const rotation = form.querySelector('#mountPlacementRotation');
  const range = form.querySelector('#mountPlacementRange');
  const message = form.querySelector('#mountPlacementMessage');
  const warning = form.querySelector('#mountPlacementWarning');
  const lessonWarning = form.querySelector('#mountLessonWarning');
  const adjustments = form.querySelector('#mountPlacementChanges');
  const apply = form.querySelector('#mountPlacementApply');
  const clear = form.querySelector('#mountClearConflicts');
  const recommendButton = form.querySelector('#mountRecommend');
  const diagram = form.querySelector('.mount-placement-diagram');
  const diagramHint = form.querySelector('#mountPlacementDiagramHint');
  const currentPosition = form.querySelector('#mountPlacementCurrent');
  const targetPosition = form.querySelector('#mountPlacementTarget');
  const directValue = form.querySelector('#mountPlacementDirectValue');
  const columnButtons = [...form.querySelectorAll('[data-placement-column]')];
  const holes = [...form.querySelectorAll('[data-placement-hole]')].map(hole => ({
    hole,row:hole.closest('[data-placement-row]').dataset.placementRow,number:Number(hole.dataset.placementHole)
  }));
  form.querySelector('#mountBoardName').textContent=boardName+'。';
  if (notice) form.querySelector('#mountPlacementIntro').textContent=notice;
  column.value = columns.includes(initial.column) ? initial.column : options.defaultColumn;
  const rowKey = mount => (boardMountRows(mount,options) ?? options.rows).join('');
  rowChoice.value = rowKey(initial);
  rotation.value = options.rotations.includes(initial.rotation) ? initial.rotation : options.defaultRotation;
  const positionLabel = (rows,column,rotation) => `${rows.join(' / ').toUpperCase()} 排 · 第 ${column} 列起 · USB 朝${rotation===90?'左':'右'}`;
  if (currentRows) currentPosition.textContent = '原插位 · '+positionLabel(currentRows,current.column,current.rotation);
  const diagramNote = currentRows
    ? '实心孔表示目标，空心孔表示原插位。点深色孔可同时换排、换列。'
    : '实心孔表示目标。点深色孔可同时换排、换列。';
  for (const row of diagram.querySelectorAll('[data-placement-row]')) {
    const key = row.dataset.placementRow.toLowerCase();
    row.dataset.canChoose = String(options.rowPairs.some(pair=>pair.includes(key)));
  }
  for (const {hole,row,number} of holes) {
    if (columns.includes(number) && options.rowPairs.some(pair=>pair.includes(row.toLowerCase()))) hole.classList.add('is-selectable-start');
  }
  const safeSlot=recommend(false), clearanceSlot=recommend(true);

  function readSelection() {
    return { rows:[...rowChoice.value],column:Number(column.value),rotation:Number(rotation.value) };
  }
  function render(selection, result) {
    const rows = selection.rows.map(row=>row.toUpperCase());
    const lastColumn = selection.column + options.pinCount - 1;
    previousColumn.disabled = selection.column===options.minColumn;
    nextColumn.disabled = selection.column===options.maxColumn;
    directValue.textContent = `第 ${selection.column} 列`;
    targetPosition.textContent = '目标 · '+positionLabel(selection.rows,selection.column,selection.rotation);
    for (const button of columnButtons) {
      button.setAttribute('aria-pressed',String(Number(button.dataset.placementColumn)===selection.column));
    }
    const canPlace = Boolean(result.candidate);
    const offLessonSlot = practice && (selection.column!==practice.column || selection.rotation!==practice.rotation);
    const blockers = result.blockers ?? [];
    const connectionNote = result.connections > 0 ? `会接入 ${result.connections} 个已有跳线的孔组。` : '';
    const candidate=result.candidate;
    const moved = canPlace ? candidate.blockers.flatMap((part,index)=>candidate.unpluggedParts.includes(part)
      ? [] : [`移到面包板旁：${blockers[index]??part.id}`]) : [];
    const changes = canPlace ? [...moved,...describeMountChanges(candidate)] : [];
    const releases = canPlace && (candidate.unpluggedParts.length || candidate.unpluggedWires.length);
    const state = result.unchanged ? 'current' : !canPlace ? 'blocked' : blockers.length || changes.length || result.warning || connectionNote || offLessonSlot ? 'review' : 'ready';
    const title = { current: '开发板已插在这里', blocked: '此位置无法插装', review: '请核对下方变化', ready: current ? '可以换到这里' : '此位置可以插装' }[state];
    form.dataset.placementState = state;
    range.textContent = `${title} · ${options.pinCount*2} 针 · ${rows.join(' / ')} 排 · 第 ${selection.column}–${lastColumn} 列`;
    const {slot:suggestion,enableClearance}=mountPlacementSuggestion(safeSlot,clearanceSlot,clear.checked);
    message.textContent = result.reason || (canPlace
      ? releases ? '下面列出要拔下或移开的物件。确认前，实验台不会改变。' : moved.length ? '确认后，下面的散件会移到旁边，与它们相连的跳线会保留。' : '排针将插进高亮的两排孔，并接通对应孔组。'
      : '请选择其他排孔、起始列或朝向。');
    const electricalNote = candidate?.changedNets ? `换孔会改变 ${candidate.changedNets} 个已有接线的孔组。` : result.warning || (canPlace ? connectionNote : '');
    warning.textContent = [enableClearance ? '可先查看腾位方案，确认前，实验台不会改变。' : '',
      releases ? '拔下会改变当前电路。操作可撤销。' : '',electricalNote].filter(Boolean).join(' ');
    warning.hidden = !warning.textContent;
    lessonWarning.hidden = !offLessonSlot;
    lessonWarning.textContent = offLessonSlot ? `本实验的预接电路使用第 ${practice.column} 列、USB 朝${practice.rotation===90?'左':'右'}。` : '';
    adjustments.replaceChildren(...changes.map(change=>{
      const item = document.createElement('li');
      item.textContent = change;
      return item;
    }));
    adjustments.hidden = !changes.length;
    apply.disabled = !canPlace;
    apply.hidden = !canPlace && enableClearance;
    if (current) apply.textContent = releases || moved.length ? '确认腾位并换孔' : '确认换孔位';
    else apply.textContent = releases ? '确认拔下并插入' : moved.length ? '移开挡件并插入'
      : canPlace&&changes.length ? '调整跳线并插入' : '插入并接通';
    recommendButton.textContent = enableClearance ? '查看腾位方案' : suggestion && practice && suggestion.column===practice.column && suggestion.rotation===practice.rotation
      ? '改用实验孔位' : '定位可用插位';
    const sameSuggestion = suggestion && suggestion.column===selection.column && suggestion.rotation===selection.rotation && rowKey(suggestion)===rowChoice.value;
    recommendButton.hidden = !suggestion || !enableClearance && (sameSuggestion || canPlace && !offLessonSlot);
    recommendButton.classList.toggle('primary',enableClearance);
    const canClearTarget = !canPlace && !result.unchanged && !clear.checked && Boolean(evaluate(selection,true).candidate);
    form.querySelector('#mountClearOption').hidden = !clear.checked && !canClearTarget;
    for (const {hole,row,number} of holes) {
      hole.classList.toggle('is-occupied', rows.includes(row) && number>=selection.column && number<=lastColumn);
      hole.classList.toggle('is-start', rows.includes(row) && number===selection.column);
      hole.classList.toggle('is-original', Boolean(currentRows?.includes(row.toLowerCase()) && number>=current.column && number<current.column+options.pinCount));
      hole.classList.toggle('is-original-start', number===current?.column && Boolean(currentRows?.includes(row.toLowerCase())));
    }
  }
  function update() {
    diagramHint.textContent = diagramNote;
    const selection = readSelection();
    render(selection, evaluate(selection,clear.checked));
  }
  function selectColumn(target) {
    if (!columns.includes(target)) return false;
    column.value=target;
    update();
    return true;
  }

  function targetHole(event) {
    const track = event.target.closest('.mount-placement-row > div');
    if (!track) return null;
    const row = track.parentElement.dataset.placementRow.toLowerCase();
    const pair = options.rowPairs.find(rows=>rows.includes(row));
    const bounds = track.getBoundingClientRect();
    const start = Math.max(1,Math.min(breadboardColumns,1+Math.floor((event.clientX-bounds.left)*breadboardColumns/bounds.width)));
    return {track,row,pair,start};
  }
  let hoveredHole;
  function highlightHole(next) {
    if (next===hoveredHole) return;
    hoveredHole?.classList.remove('is-hovered');
    next?.classList.add('is-hovered');
    hoveredHole=next;
  }
  diagram.addEventListener('pointermove', event => {
    const target=targetHole(event);
    highlightHole(target?.pair && columns.includes(target.start) ? target.track.children[target.start-1] : undefined);
  });
  diagram.addEventListener('pointerleave',()=>highlightHole(undefined));
  diagram.addEventListener('click', event => {
    const target=targetHole(event);
    if (!target) return;
    const {row,pair,start}=target;
    if (!pair || !columns.includes(start)) {
      diagramHint.textContent = pair ? `从第 ${start} 列起放不下整排针。请选择第 ${options.minColumn}–${options.maxColumn} 列。` : `${row.toUpperCase()} 排无法与另一排同时对孔。请选择其他排。`;
      return;
    }
    rowChoice.value = pair.join('');
    selectColumn(start);
  });
  column.addEventListener('change', update);
  for (const button of columnButtons) button.onclick=()=>selectColumn(Number(button.dataset.placementColumn));
  for (const [button,step] of [[previousColumn,-1],[nextColumn,1]]) {
    button.onclick=()=>{
      if (selectColumn(Number(column.value)+step) && button.disabled) column.focus({preventScroll:true});
    };
  }
  rowChoice.addEventListener('change', update);
  rotation.addEventListener('change', update);
  clear.addEventListener('change', update);
  recommendButton.onclick=()=>{
    const {slot:choice,enableClearance}=mountPlacementSuggestion(safeSlot,clearanceSlot,clear.checked);
    if (!choice) return;
    if (enableClearance) clear.checked=true;
    column.value=choice.column;
    rowChoice.value=rowKey(choice);
    rotation.value=choice.rotation;
    update();
    (enableClearance ? apply : column).focus();
  };
  form.querySelector('#mountPlacementCancel').onclick = () => dialog.close();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const selection = readSelection();
    const result = evaluate(selection,clear.checked);
    if (!result.candidate) {
      render(selection, result);
      column.focus();
      return;
    }
    if (onApply(result.candidate,selection)!==false) {
      dialog.close();
      onPlaced?.();
    }
    else {
      form.dataset.placementState='blocked';
      message.textContent='没能放下挡件。请先移开散件，或选择其他孔位。';
    }
  });
  update();
  if(!safeSlot&&clearanceSlot&&!recommendButton.hidden)recommendButton.focus({preventScroll:true});
}
