import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { CHIP_PINS, CHIP_FUNCTIONS, CHIP_DATASHEET, CHIP_REFERENCE, chipPinLayout } from './blue-pill-chip-data.js';
import { dip28PinLayout, tqfp32PinLayout, lqfp64PinLayout, wroom32ePadLayout, rp2040PadLayout, RP2040_GROUND_PAD, positionChipBlocks } from './chip-inspection-layout.js';

export { CHIP_PINS, CHIP_FUNCTIONS, chipPinForSignal } from './blue-pill-chip-data.js';

const bluePillChip = { title: 'STM32F103C8T6', packageName: 'LQFP48', bodyLabelSize: '7 × 7 mm', pinPitch: '0.50 mm', style: 'lqfp',
  pins: CHIP_PINS, blocks: CHIP_FUNCTIONS, references: [{ url: CHIP_DATASHEET, label: 'ST DS5319 数据手册' }, { url: CHIP_REFERENCE, label: 'RM0008 参考手册' }], hints: {
  package: '观察 7 × 7 mm 的塑封本体、四边鸥翼脚和 1 脚定位圆点。点击模型上的芯片或金属脚可进入引脚层。',
  pins: '外壳抬起后可查看四边各 12 脚。俯视时从定位点旁的 1 脚开始，逆时针编号。点击引脚或在右侧选择编号。',
  functions: '内部功能方框依据 ST 的器件框图整理。方块位置和比例用于讲解，芯片的物理版图另有设计。'
} };

export function mountBluePillChip(container, { pin, onPin, onBack } = {}) {
  return mountChipInspection(container, { chip: bluePillChip, boardTitle: 'Blue Pill', pin, onPin, onBack });
}

export function mountChipInspection(container, { chip, boardTitle, pin, onPin, onBack }) {
  const pins = new Map(chip.pins.map(entry => [entry.number, entry]));
  const qfn = chip.style === 'qfn';
  const hasBottomView = qfn || chip.style === 'module';
  const chipParts = hasBottomView ? '焊盘' : '引脚';
  const contactCount = qfn ? `${pins.size - 1} 个外围焊盘 + ePad` : `${pins.size} 个${chipParts}`;
  const root = document.createElement('section');
  root.className = 'bp-chip';
  root.setAttribute('aria-label', chip.title + ' 拆解');
  root.innerHTML = `
    <header class="bp-chip-heading">
      <div><small>${boardTitle} / 芯片拆解</small><h1 tabindex="-1">${chip.title}</h1></div>
      ${onBack ? '<button type="button" data-chip-back>← 返回开发板</button>' : ''}
    </header>
    <nav class="bp-chip-layer-list" aria-label="芯片拆解层级">
      <button type="button" data-chip-layer="package">01 <strong>封装</strong></button>
      <button type="button" data-chip-layer="pins">02 <strong>${chipParts}</strong></button>
      <button type="button" data-chip-layer="functions">03 <strong>内部功能</strong></button>
    </nav>
    <p class="bp-chip-layer-hint"></p>
    <div class="bp-chip-layout">
      <div class="bp-chip-model">
        <div class="bp-chip-stage" data-chip-stage></div>
        <div class="bp-chip-camera" role="group" aria-label="芯片视角">
          <button type="button" data-chip-camera="closer" aria-label="放大芯片">＋</button>
          <button type="button" data-chip-camera="farther" aria-label="缩小芯片">−</button>
          <button type="button" data-chip-camera="turn">旋转 45°</button>
          <button type="button" data-chip-camera="top">垂直俯视</button>
          ${hasBottomView ? '<button type="button" data-chip-camera="bottom">翻看底面</button>' : ''}
          <button type="button" data-chip-camera="reset">还原视角</button>
        </div>
      </div>
      <div class="bp-chip-notes">
        <div data-chip-panel="package" class="bp-chip-panel">
          <h3>${chip.packageName}</h3>
          <dl class="bp-chip-specs"><div><dt>本体</dt><dd>${chip.bodyLabelSize}</dd></div><div><dt>间距</dt><dd>${chip.pinPitch}</dd></div><div><dt>${chipParts}数</dt><dd>${qfn ? contactCount : pins.size}</dd></div></dl>
          <p>按「垂直俯视」可对照数据手册中的顶视图。</p>
          <button type="button" data-chip-show-pins>查看 ${contactCount} →</button>
        </div>
        <div data-chip-panel="pins" class="bp-chip-panel" hidden>
          <h3>${chip.packageName} · ${chipParts}</h3>
          <label for="bp-chip-pin-select">按编号或信号选择</label>
          <select id="bp-chip-pin-select" data-chip-pin-select>
            <option value="">选择一个${chipParts}</option>
            ${chip.pins.map(({ number, signal, label }) => `<option value="${number}">${label ?? number} · ${signal}</option>`).join('')}
          </select>
          <div class="bp-chip-pin-detail" aria-live="polite" aria-atomic="true"></div>
        </div>
        <div data-chip-panel="functions" class="bp-chip-panel" hidden>
          <h3>内部功能示意</h3>
          <div class="bp-chip-blocks" role="group" aria-label="内部功能模块">
            ${chip.blocks.map(block => `<button type="button" data-chip-block="${block.id}" style="--block-color:${block.color}">${block.title}</button>`).join('')}
          </div>
          <div class="bp-chip-block-detail" aria-live="polite" aria-atomic="true"></div>
        </div>
        <p class="bp-chip-sources">原始资料 ${chip.references.map(({url,label}) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).join(' ')}</p>
      </div>
    </div>`;
  container.append(root);
  const pinSelect = root.querySelector('[data-chip-pin-select]');
  const pinDetail = root.querySelector('.bp-chip-pin-detail');
  const blockDetail = root.querySelector('.bp-chip-block-detail');
  const hint = root.querySelector('.bp-chip-layer-hint');
  const layerButtons = [...root.querySelectorAll('[data-chip-layer]')];
  const blockButtons = [...root.querySelectorAll('[data-chip-block]')];
  const panels = [...root.querySelectorAll('[data-chip-panel]')];
  const cameraButtons = [...root.querySelectorAll('[data-chip-camera]')];
  let selectedPin = pins.get(pin)?.number ?? null;
  let selectedBlock = chip.blocks[0].id;
  let layer = selectedPin ? 'pins' : 'package';
  const stage = root.querySelector('[data-chip-stage]');
  const view = createChipScene(stage, chip, {
    onPin: choosePin, onBlock: selectBlock, onPackage: () => changeLayer('pins'),
    onUnavailable() { cameraButtons.forEach(button => { button.disabled = true; }); }
  });

  function renderPin() {
    const info = pins.get(selectedPin);
    pinSelect.value = selectedPin ?? '';
    pinDetail.innerHTML = info
      ? `<strong>${info.label ?? info.number} · ${info.signal}</strong><p>${info.summary}</p>`
      : `<p>选择一个${chipParts}查看信号用途。编号按器件数据手册排列。</p>`;
    view?.setPin(selectedPin);
  }

  function selectBlock(id) {
    const block = chip.blocks.find(item => item.id === id);
    if (!block) return;
    selectedBlock = id;
    for (const button of blockButtons) button.setAttribute('aria-pressed', String(button.dataset.chipBlock === id));
    blockDetail.innerHTML = `<strong>${block.title}</strong><p>${block.detail}</p>` + (block.pins
      ? `<div class="bp-chip-example-pins" aria-label="查看关联的示例${chipParts}">${block.pins.filter(number => pins.has(number)).map(number => `<button type="button" data-chip-example-pin="${number}">${pins.get(number).signal}</button>`).join('')}</div>`
      : '');
    view?.setBlock(id);
  }

  function changeLayer(next) {
    layer = next;
    root.dataset.chipActiveLayer = layer;
    hint.textContent = chip.hints[layer];
    for (const button of layerButtons) button.setAttribute('aria-pressed', String(button.dataset.chipLayer === layer));
    for (const panel of panels) panel.hidden = panel.dataset.chipPanel !== layer;
    view?.setLayer(layer, selectedPin);
  }

  function choosePin(number) {
    selectedPin = pins.get(number)?.number ?? null;
    changeLayer('pins');
    renderPin();
    onPin?.(selectedPin);
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-chip-back')) onBack?.();
    if (button.dataset.chipLayer) changeLayer(button.dataset.chipLayer);
    if (button.hasAttribute('data-chip-show-pins')) { changeLayer('pins'); pinSelect.focus(); }
    if (button.dataset.chipBlock) selectBlock(button.dataset.chipBlock);
    if (button.dataset.chipExamplePin) { choosePin(Number(button.dataset.chipExamplePin)); pinSelect.focus(); }
    if (button.dataset.chipCamera) view?.cameraAction(button.dataset.chipCamera);
  });
  pinSelect.addEventListener('change', () => choosePin(Number(pinSelect.value)));
  changeLayer(layer);
  renderPin();
  selectBlock(selectedBlock);
  return {
    setPin(number) {
      selectedPin = pins.get(number)?.number ?? null;
      renderPin();
    },
    destroy() { view?.destroy(); root.remove(); }
  };
}

function createChipScene(stage, chip, { onPin, onBlock, onPackage, onUnavailable }) {
  const canvas = document.createElement('canvas');
  const fallback = document.createElement('p');
  fallback.className = 'bp-chip-no-webgl';
  fallback.textContent = '三维视图暂不可用。右侧仍可查看封装尺寸、全部引脚和内部功能说明。';
  const showFallback = () => { stage.replaceChildren(fallback); onUnavailable(); };
  let renderer;
  try {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) { showFallback(); return null; }
    renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  } catch {
    showFallback();
    return null;
  }
  stage.append(canvas);
  canvas.setAttribute('aria-label', chip.title + ' 三维模型。拖动旋转，滚轮或双指缩放。');
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9f1ee');
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 8;
  controls.maxDistance = 85;
  const module = chip.style === 'module', dip = chip.style === 'dip', qfn = chip.style === 'qfn';
  const tqfp = chip.style === 'tqfp';
  const lqfp64 = chip.style === 'lqfp' && chip.packageName === 'LQFP64';
  const hasBottomView = module || qfn;
  controls.maxPolarAngle = hasBottomView ? Math.PI - .015 : Math.PI / 2 + .36;
  controls.enablePan = false;
  const key = new THREE.DirectionalLight('#fff4e5', 3.1);
  key.position.set(4, 13, -4);
  const fill = new THREE.DirectionalLight('#d0efff', 1.2);
  fill.position.set(-6, 3, 8);
  scene.add(key, fill, new THREE.HemisphereLight('#f1f8ff', '#657a70', 2.0));
  const grid = new THREE.GridHelper(36, 36, '#c5d6d0', '#d8e4df');
  grid.position.y = dip ? -.66 : -.12;
  scene.add(grid);
  const shellMaterial = module ? standard('#a1abb0', .46, .38) : standard('#26343b', .8);
  const contactMaterial = standard(module ? '#dcb56f' : '#bac6ce', .28, .5);
  const selectedLeadMaterial = standard('#f5b340', .31, .14);
  selectedLeadMaterial.emissive.set('#c07813');
  selectedLeadMaterial.emissiveIntensity = .3;
  const width = module ? 8.7 : dip ? 5.35 : 7;
  const depth = module ? 12.2 : dip ? 15.55 : 7;
  if (!qfn) {
    const rimMaterial = standard(module ? '#205e4c' : '#293c41', .72);
    const seat = new THREE.Mesh(packageShape(width - .08, module ? .16 : .40, depth - .08), rimMaterial);
    seat.position.y = module ? .05 : .08;
    scene.add(seat);
  }
  const cap = new THREE.Group();
  const shellHeight = module ? .59 : qfn ? .66 : tqfp ? .85 : .93;
  const shell = new THREE.Mesh(packageShape(module ? 7.4 : width, shellHeight, module ? 8.48 : depth, dip), shellMaterial);
  cap.add(shell);
  const chipMark = printedLabel(chip.bodyLabel?.split('\n') ?? ['STM32F103', 'C8T6', 'LQFP48'], module ? 6.8 : dip ? 4.65 : 5, module ? 2.6 : 2.45, module ? '#192b30' : '#deecea');
  chipMark.position.set(0, shellHeight + (qfn ? .08 : .096), .05);
  cap.add(chipMark);
  let baseDot;
  if(!module){
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(.165, .165, qfn ? .008 : .039, 18), standard(qfn ? '#919c9c' : '#e1ad4f', .6));
    dot.position.set(-width / 2 + .7, shellHeight + (qfn ? .08 : .101), -depth / 2 + .7);
    cap.add(dot);
    if (!qfn) {
      baseDot = dot.clone();
      baseDot.position.y = .533;
      scene.add(baseDot);
    }
  }
  scene.add(cap);

  const moduleComponents = module ? makeModuleComponents(scene) : null;

  const leads = new Map(), leadLabels = new Map();
  const numbered = new THREE.Group();
  const leadGeometry = module ? new THREE.BoxGeometry(.80, .19, .36) : qfn ? new THREE.BoxGeometry(.40, .05, .18) : dip ? dipLead() : gullWingLead(lqfp64 ? .16 : tqfp ? .32 : .24);
  if (lqfp64) leadGeometry.translate(-3.5, 0, 0).scale(.70, 1, 1).translate(3.5, 0, 0);
  const exposedGeometry = module ? new THREE.BoxGeometry(3.08, .10, 3.02) : qfn ? qfnExposedPad() : null;
  const pinLayout = module ? wroom32ePadLayout : qfn ? rp2040PadLayout : dip ? dip28PinLayout : tqfp ? tqfp32PinLayout : lqfp64 ? lqfp64PinLayout : chipPinLayout;
  for (const { number, label: pinLabel } of chip.pins) {
    const { x, z, angle, labelX, labelZ, bottom } = pinLayout(number);
    const lead = new THREE.Mesh(bottom ? exposedGeometry : leadGeometry, contactMaterial);
    lead.position.set(x, qfn ? .007 : bottom ? -.045 : module ? .115 : 0, z);
    lead.rotation.y = angle;
    lead.userData.pin = number;
    leads.set(number, lead);
    scene.add(lead);
    const labelSize = bottom ? 1 : lqfp64 ? .33 : qfn ? .36 : .49;
    const label = printedLabel([qfn && bottom ? 'ePad' : String(pinLabel ?? number)], labelSize, labelSize, '#23423c');
    label.position.set(labelX, bottom ? -.109 : .022, labelZ);
    if(bottom) label.rotation.x = Math.PI / 2;
    label.userData.pin = number;
    leadLabels.set(number, label);
    numbered.add(label);
  }
  scene.add(numbered);
  const selectedPinColor = new THREE.Color('#a25a07');
  const regularPinColor = new THREE.Color('#ffffff');

  const die = new THREE.Group();
  const substrate = new THREE.Mesh(packageShape(module ? 7.44 : dip ? 4.89 : 6.42, .15, module ? 8.55 : dip ? 14.92 : 6.42), standard('#33544e', .75));
  substrate.position.y = .62;
  if(module) substrate.position.z = .75;
  die.add(substrate);
  const blockMeshes = new Map();
  const blockMaterial = standard('#e8a633', .6);
  const blocks = module || dip || qfn ? positionChipBlocks(chip.blocks, module
    ? { width: 7.02, depth: 8.07, centerZ: .75, columns: 3 }
    : qfn ? { width: 6.12, depth: 6.12, columns: 3 } : { width: 4.56, depth: 14.30, columns: 2 }) : chip.blocks;
  for (const block of blocks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(block.w, .25, block.d), standard(block.color, .66));
    mesh.position.set(block.x, 1.02, block.z);
    mesh.userData.block = block.id;
    mesh.userData.regularMaterial = mesh.material;
    die.add(mesh);
    blockMeshes.set(block.id, mesh);
    const label = printedLabel([block.label], block.w * .93, block.d * .62, '#ffffff');
    label.position.set(block.x, 1.149, block.z);
    die.add(label);
  }
  const traceMaterial = standard('#b7d8ae', .5, .3);
  for (const block of blocks.filter(block => block.id !== 'bus')) {
    const middle = (block.z - .35) / 2;
    const trace = new THREE.Mesh(new THREE.BoxGeometry(.064, .025, Math.abs(block.z + .35)), traceMaterial);
    trace.position.set(block.x, .84, middle);
    die.add(trace);
  }
  scene.add(die);

  let layer = 'package', frame = 0, lastPin = null, lastBlock = null, destroyed = false;
  const raycaster = new THREE.Raycaster(), point = new THREE.Vector2();
  const leadMeshes = [...leads.values()], numberMeshes = [...leadLabels.values()], functionMeshes = [...blockMeshes.values()];
  const pointers = new Set();
  let start = null;
  function pointerDown(event) {
    pointers.add(event.pointerId);
    start = pointers.size === 1 && event.button === 0 ? [event.clientX, event.clientY] : null;
  }
  function pointerMove(event) {
    if (start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) start = null;
  }
  function pointerUp(event) {
    pointers.delete(event.pointerId);
    const click = start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) <= 6;
    start = null;
    if (!click) return;
    const rect = canvas.getBoundingClientRect();
    point.set(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
    raycaster.setFromCamera(point, camera);
    const under = hasBottomView && camera.position.y < 0;
    const hiddenPad = module ? 39 : RP2040_GROUND_PAD;
    const contacts = hasBottomView && !under ? leadMeshes.filter(mesh => mesh.userData.pin !== hiddenPad) : leadMeshes;
    const labels = layer === 'pins' ? numberMeshes.filter(mesh => mesh.visible) : [];
    const pickable = under ? [...contacts,...labels] : layer === 'functions' ? [...functionMeshes, ...contacts] : layer === 'pins' ? [...contacts, ...labels] : [...contacts, shell];
    const hit = raycaster.intersectObjects(pickable, false)[0]?.object;
    if (hit?.userData.pin) onPin(hit.userData.pin);
    else if (hit?.userData.block) onBlock(hit.userData.block);
    else if (hit === shell) onPackage();
  }
  function pointerCancel(event) { pointers.delete(event.pointerId); start = null; }
  function draw() {
    frame = 0;
    if (destroyed) return;
    grid.visible = camera.position.y > -.15;
    if (module) for (const [number, label] of leadLabels) label.visible = number === 39 ? camera.position.y < 0 : camera.position.y >= 0;
    if (qfn) {
      const underside = camera.position.y < 0;
      for (const [number, label] of leadLabels) {
        label.visible = number !== RP2040_GROUND_PAD || underside;
        label.position.y = underside ? -.085 : .045;
        label.rotation.x = underside ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    renderer.render(scene, camera);
  }
  function redraw() { if (!destroyed && !frame) frame = requestAnimationFrame(draw); }
  function cameraAction(action) {
    if (action === 'top' || action === 'bottom' || action === 'reset') {
      const targetY = qfn && action === 'bottom' ? 0 : layer === 'package' ? .5 : 1.0;
      controls.target.set(0, targetY, 0);
      const distance = (module ? 29 : dip ? 31 : 22) * Math.max(1, 1 / camera.aspect);
      if (action === 'top' || action === 'bottom') camera.position.set(0, (action === 'top' ? distance : -distance) + targetY, .001);
      else camera.position.copy(new THREE.Vector3(0.42, .89, 1).normalize().multiplyScalar(distance).add(controls.target));
    } else if (action === 'turn') {
      const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
      camera.position.copy(controls.target).add(offset);
    } else {
      const factor = action === 'closer' ? .8 : 1.25;
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
    }
    controls.update();
    redraw();
  }
  const resize = () => {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    redraw();
  };
  const observer = new ResizeObserver(resize);
  controls.addEventListener('change', redraw);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('lostpointercapture', pointerCancel);
  function contextLost(event) { event.preventDefault(); destroy(); showFallback(); }
  canvas.addEventListener('webglcontextlost', contextLost);
  observer.observe(stage);
  resize();
  cameraAction('reset');

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.removeEventListener('change', redraw);
    controls.dispose();
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointermove', pointerMove);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerCancel);
    canvas.removeEventListener('lostpointercapture', pointerCancel);
    canvas.removeEventListener('webglcontextlost', contextLost);
    const geometry = new Set(), materials = new Set([contactMaterial, selectedLeadMaterial, blockMaterial]);
    scene.traverse(node => {
      if (node.geometry) geometry.add(node.geometry);
      if (node.material) materials.add(node.material);
      if (node.userData.regularMaterial) materials.add(node.userData.regularMaterial);
    });
    for (const item of geometry) item.dispose();
    for (const item of materials) { item.map?.dispose(); item.dispose(); }
    renderer.dispose();
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    canvas.remove();
  }
  return {
    setLayer(next, selectedPin) {
      if (destroyed) return;
      const changed = layer !== next;
      layer = next;
      const exploded = layer !== 'package';
      cap.position.set(dip && exploded ? -4.8 : 0, exploded ? 2.65 : module ? .2 : qfn ? .08 : .07, module ? (exploded ? -4.02 : .75) : exploded && !dip ? -3.58 : 0);
      shellMaterial.transparent = exploded;
      shellMaterial.opacity = exploded ? .37 : 1;
      shellMaterial.depthWrite = !exploded;
      shellMaterial.needsUpdate = true;
      chipMark.material.opacity = exploded ? .44 : 1;
      numbered.visible = layer === 'pins';
      die.visible = layer === 'functions';
      if(baseDot)baseDot.visible = exploded;
      if(moduleComponents) moduleComponents.visible = layer === 'pins';
      if (module && changed) {
        if (layer === 'pins' && selectedPin === 39 && camera.position.y >= 0) cameraAction('bottom');
        else if (layer !== 'pins' && camera.position.y < 0) cameraAction('reset');
      }
      if (qfn && changed && layer === 'functions' && camera.position.y < 0) cameraAction('top');
      redraw();
    },
    setPin(number) {
      if (destroyed || lastPin === number) return;
      if (leads.has(lastPin)) leads.get(lastPin).material = contactMaterial;
      if (leadLabels.has(lastPin)) leadLabels.get(lastPin).material.color.copy(regularPinColor);
      if (leads.has(number)) leads.get(number).material = selectedLeadMaterial;
      if (leadLabels.has(number)) leadLabels.get(number).material.color.copy(selectedPinColor);
      if (module && number === 39 || qfn && number === RP2040_GROUND_PAD) cameraAction('bottom');
      else if (module && number != null && camera.position.y < 0) cameraAction('top');
      lastPin = number;
      canvas.dataset.selectedChipPin = number ?? '';
      redraw();
    },
    setBlock(id) {
      if (destroyed || id === lastBlock) return;
      const last = blockMeshes.get(lastBlock), next = blockMeshes.get(id);
      if (last) last.material = last.userData.regularMaterial;
      if (next) next.material = blockMaterial;
      lastBlock = id;
      redraw();
    },
    cameraAction,
    destroy
  };
}

function standard(color, roughness, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function packageShape(width, height, depth = width, notch = false) {
  const w = width / 2 - .08, d = depth / 2 - .08;
  const shape = new THREE.Shape().moveTo(-w, -d).lineTo(w, -d).lineTo(w, d);
  if (notch) shape.lineTo(.68, d).quadraticCurveTo(.53, d - .65, 0, d - .65).quadraticCurveTo(-.53, d - .65, -.68, d);
  shape.lineTo(-w, d).closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: .075, bevelSize: .08, bevelSegments: 2, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function dipLead() {
  const shape = new THREE.Shape().moveTo(2.56, .65).lineTo(3.28, .65).lineTo(3.51, .45)
    .lineTo(3.51, -.60).lineTo(3.36, -.60).lineTo(3.36, .38).lineTo(3.2, .49).lineTo(2.56, .49).closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .32, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -.16);
  return geometry;
}

function qfnExposedPad() {
  // 3.10 mm nominal exposed pad with the small pin-1-side corner relief.
  const half = 1.55;
  const shape = new THREE.Shape().moveTo(-half, -half).lineTo(half, -half)
    .lineTo(half, half).lineTo(-half, half).lineTo(-half, half - .19)
    .quadraticCurveTo(-half + .21, half - .30, -half, half - .43).closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -.025, 0);
  return geometry;
}

function makeModuleComponents(scene) {
  const gold = standard('#cf9b49', .41, .35);
  const components = new THREE.Group();
  function block(group, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  // Visible PCB antenna on the module; the shield covers the components only.
  for (let i=0;i<6;i++) {
    const x=-2.72+i*1.05;
    block(scene,.13,.025,1.13,x,.231,-4.92,gold);
    if(i<5)block(scene,1.16,.025,.13,x+.53,.231,i%2?-5.45:-4.39,gold);
  }
  const black = standard('#26363c', .72), metal = standard('#bbc6c5', .35, .45);
  block(components,2.35,.37,2.35,-.93,.42,-.10,black);
  block(components,1.24,.30,1.48,1.73,.38,1.66,black);
  block(components,1.22,.27,.67,1.76,.36,-1.88,metal);
  for(const [text,x,z,w] of [['ESP32',-.93,-.1,1.8],['FLASH',1.73,1.66,1.08],['40 MHz',1.76,-1.88,1.06]]) {
    const tag=printedLabel([text],w,.38,'#edf6f0');tag.position.set(x,.625,z);components.add(tag);
  }
  scene.add(components);
  return components;
}

function gullWingLead(width) {
  const shape = new THREE.Shape();
  shape.moveTo(3.37, .69).lineTo(3.61, .69).quadraticCurveTo(3.79, .69, 3.88, .51)
    .lineTo(4.04, .18).quadraticCurveTo(4.07, .12, 4.16, .12).lineTo(4.53, .12).lineTo(4.53, .02)
    .lineTo(4.14, .02).quadraticCurveTo(3.99, .02, 3.93, .14).lineTo(3.77, .47)
    .quadraticCurveTo(3.72, .59, 3.61, .59).lineTo(3.37, .59).closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 5, steps: 1 });
  geometry.translate(0, 0, -width / 2);
  return geometry;
}

function printedLabel(lines, width, height, color) {
  const canvas = document.createElement('canvas');
  canvas.height = lines.length > 1 ? 144 : 64;
  canvas.width = Math.min(512, Math.max(48, Math.round(canvas.height * width / height)));
  const context = canvas.getContext('2d');
  const lineHeight = canvas.height / lines.length;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.font = `700 ${Math.round(lineHeight * (lines.length > 1 ? .68 : .73))}px system-ui, sans-serif`;
  context.fillStyle = color;
  for (const [index, line] of lines.entries()) context.fillText(line, canvas.width / 2, (index + .51) * lineHeight, canvas.width - 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  plane.rotation.x = -Math.PI / 2;
  return plane;
}
