import { createBoardInspection } from './workbench.js';

export function mountBoardInspection(container, { boardId, pins, onPin, onChip, referenceLabel }) {
  container.classList.add('blue-pill-board-stage');
  let view;
  let notice;
  function showFallback() {
    view?.dispose();
    view = null;
    notice = document.createElement('p');
    notice.className = 'blue-pill-board-unavailable';
    notice.setAttribute('role', 'status');
    notice.textContent = '当前浏览器无法显示三维模型，仍可通过左侧对照图或引脚表查看引脚。';
    container.append(notice);
  }
  view = createBoardInspection(container, { onInspectionPin: onPin, onInspectionChip: onChip, onContextLost: showFallback }, { boardId, pins, referenceLabel });
  if (!view) showFallback();
  return {
    setPin(id) { view?.setInspectionPin(id); },
    destroy() {
      view?.dispose();
      view = null;
      notice?.remove();
      container.classList.remove('blue-pill-board-stage');
    }
  };
}

export function mountBluePillBoard(container, hooks = {}) {
  return mountBoardInspection(container, { ...hooks, boardId:'bluepill' });
}
