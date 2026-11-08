/* Chinese learning-resource centre. Original documents stay at their recorded URLs.
 * Public entry: mountResourceLibrary(container, resources, {onNavigate, onStartExample}).
 * No remote requests, inferred downloads, invented page references, or reading-progress claims.
 */

const STORAGE_KEY = 'physical-lab-resource-library-v1';
const PAGE_SIZE = 12;
const SOURCE_LABELS = {all:'全部来源',creator:'课程作者',official:'厂商与官方',mirror:'公开镜像译本',other:'其他资料'};
const DEFAULT_FILTERS = Object.freeze({query:'',author:'all',language:'all',family:'all',source:'all',downloaded:false,collection:'all',route:'all'});

export const RESOURCE_ROUTES = Object.freeze([
  {id:'first-light',number:'01',title:'第一次把灯点亮',summary:'默认跟随江协的 STM32F103 标准库课程。',framework:'STM32F103 · 标准外设库（SPL）',steps:['课程与配套用同一套','理解 GPIO 和限流','到实验台点亮 LED'],ids:['jiangxie-video','jiangxie-pack','extra-embedfire-std','st-01','st-06'],exampleId:'blink',exampleLabel:'做点灯实验'},
  {id:'read-input',number:'02',title:'读懂按键和传感器',summary:'沿标准库路线，把电路变化与代码读数对上。',framework:'STM32F103 · 标准外设库（SPL）',steps:['认识输入和上拉','理解 ADC 读数','改变旋钮观察结果'],ids:['extra-embedfire-std','st-01','st-02','extra-spark-switch','jiangxie-faq'],exampleId:'adc',exampleLabel:'做旋钮实验'},
  {id:'solve-problem',number:'03',title:'接线或下载出问题',summary:'带着现象查资料，逐项排除原因。',steps:['描述具体故障','核对引脚和供电','查看对应工具说明'],ids:['jiangxie-faq','st-05','st-06','extra-st-programmer-zh','st-09'],exampleId:null,exampleLabel:'打开故障排查'},
]);

const START_ORDER = ['jiangxie-video','jiangxie-pack','extra-embedfire-std','st-01','st-02','jiangxie-faq','tietou-video','extra-dfrobot-cn','extra-atomic-index'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const searchable = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/i²c/g,'i2c').replace(/i²s/g,'i2s');
const cleanText = value => typeof value === 'string' ? value.trim() : '';

export function safeResourceURL(value) {
  try {
    const url = new URL(cleanText(value));
    return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function localPDFPath(resource) {
  if (resource?.status !== 'downloaded' || typeof resource.download_url !== 'string') return '';
  const path = resource.download_url.trim();
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.includes('..') || decoded.includes('\\') || /[\u0000-\u001f]/.test(decoded)) return '';
  } catch { return ''; }
  return /^(?:\.\/)?docs\/[^?#]+\.pdf(?:[?#][^\s]*)?$/i.test(path) ? path : '';
}

export function resourceSourceKind(resource) {
  const category = cleanText(resource?.category);
  if (/镜像/.test(category)) return 'mirror';
  if (/^作者/.test(category)) return 'creator';
  if (/官方|厂商/.test(category)) return 'official';
  return 'other';
}

function resourceFamilies(resource) {
  if (cleanText(resource.family)) return [...new Set(resource.family.split(/\s*\/\s*/).map(value => value.trim()).filter(Boolean))];
  // These legacy entries predate the family field; their recorded IDs identify
  // the STM32 collection. Unknown future entries are not silently called STM32.
  return /^(st-|jiangxie-|tietou-)/.test(resource.id) ? ['STM32'] : ['未标注'];
}

function documentKind(resource) {
  if (resource.localPdf) return 'PDF 手册';
  if (/配套/.test(resource.category)) return '配套入口';
  if (/课程|视频/.test(resource.category) || /bilibili\.com/.test(resource.originalUrl)) return '视频课程';
  if (/工具|软件|IDE|SDK|CubeMX|Programmer|PlatformIO/i.test(resource.title)) return '工具文档';
  if (/手册|参考|datasheet/i.test(resource.title)) return '参考资料';
  return '在线教程';
}

export function learningTrack(resource) {
  if (['extra-embedfire-hal','extra-atomic-f103v4','extra-st-step-by-step'].includes(resource.id)) {
    return {key:'hal',label:'HAL 库 · 独立工程',note:'这份资料使用 HAL。实验台默认 STM32 示例使用标准外设库（SPL），两者的初始化方式和函数不同，不能直接混用。跟随这份教材时，请使用作者配套的 HAL 工程，并在对应的本地工具链验证。'};
  }
  if (['jiangxie-video','jiangxie-pack','extra-embedfire-std','extra-atomic-book','st-spl'].includes(resource.id)) {
    return {key:'spl',label:'标准外设库 · SPL',note:'与默认 STM32F103 标准外设库学习方向一致。不同作者的板卡、引脚和工程辅助文件仍需逐项核对，不能整套交叉混用。'};
  }
  if (['extra-arduino-language','extra-arduino-ide','extra-dfrobot-cn','extra-esp-arduino','extra-led-guide','extra-rgb-guide'].includes(resource.id)) {
    return {key:'arduino',label:'Arduino 编程路线',note:'使用 Arduino 框架与对应开发板核心。setup / loop 示例和 STM32 标准外设库工程采用不同入口与接口，请先选好板卡和框架。'};
  }
  return null;
}

export function prepareResources(resources) {
  const seen = new Set();
  return (Array.isArray(resources) ? resources : []).flatMap((resource, index) => {
    if (!resource || typeof resource !== 'object' || !cleanText(resource.id) || !cleanText(resource.title) || seen.has(cleanText(resource.id))) return [];
    seen.add(cleanText(resource.id));
    const record = {
      ...resource,
      id:cleanText(resource.id),title:cleanText(resource.title),author:cleanText(resource.author) || '来源未标注',
      language:cleanText(resource.language) || '未标注',category:cleanText(resource.category),
      sourceKind:resourceSourceKind(resource),families:resourceFamilies(resource),
      originalUrl:safeResourceURL(resource.url),sourceUrl:safeResourceURL(resource.source_page || resource.url),
      localPdf:localPDFPath(resource),order:index,
    };
    record.kind = documentKind(record);
    record.searchText = searchable([record.title,record.author,record.category,record.language,...record.families,record.description,record.reading_hint,record.learning_stage,...(Array.isArray(record.tags) ? record.tags : [])].join(' '));
    return [record];
  });
}

function routeById(id) { return RESOURCE_ROUTES.find(route => route.id === id); }

/** Pure state layer, also used by focused regression tests. */
export function createResourceLibraryModel(resources, {storage = null, now = Date.now} = {}) {
  let records = prepareResources(resources);
  let filters = {...DEFAULT_FILTERS};
  let favorites = new Set();
  let recent = new Map();
  let persistenceAvailable = Boolean(storage);
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (stored?.version === 1) {
      favorites = new Set((Array.isArray(stored.favorites) ? stored.favorites : []).filter(id => typeof id === 'string'));
      recent = new Map((Array.isArray(stored.recent) ? stored.recent : []).filter(item => typeof item?.id === 'string' && Number.isFinite(item.openedAt) && item.openedAt > 0).map(item => [item.id,item.openedAt]));
    }
  } catch { persistenceAvailable = false; }

  function persist() {
    if (!storage) { persistenceAvailable = false; return false; }
    try {
      storage.setItem(STORAGE_KEY,JSON.stringify({version:1,favorites:[...favorites],recent:[...recent].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([id,openedAt])=>({id,openedAt}))}));
      persistenceAvailable = true;
      return true;
    } catch { persistenceAvailable = false; return false; }
  }
  function find(id) { return records.find(record => record.id === id); }
  function counts() {
    return {
      total:records.length,downloaded:records.filter(record=>record.localPdf).length,
      chinese:records.filter(record=>/中文|中英/.test(record.language)).length,
      favorites:records.filter(record=>favorites.has(record.id)).length,recent:records.filter(record=>recent.has(record.id)).length,
      creator:records.filter(record=>record.sourceKind==='creator').length,official:records.filter(record=>record.sourceKind==='official').length,
      mirror:records.filter(record=>record.sourceKind==='mirror').length,
    };
  }
  function results() {
    const terms = searchable(filters.query).split(/\s+/).filter(Boolean);
    const route = routeById(filters.route);
    const selected = records.filter(record =>
      (filters.author==='all' || record.author===filters.author) &&
      (filters.language==='all' || record.language.includes(filters.language) || /中英/.test(record.language)) &&
      (filters.family==='all' || record.families.includes(filters.family)) &&
      (filters.source==='all' || record.sourceKind===filters.source) &&
      (!filters.downloaded || Boolean(record.localPdf)) &&
      (filters.collection!=='favorites' || favorites.has(record.id)) &&
      (filters.collection!=='recent' || recent.has(record.id)) &&
      (!route || route.ids.includes(record.id)) &&
      terms.every(term=>record.searchText.includes(term)));
    return selected.sort((a,b)=> {
      if (filters.collection==='recent') return (recent.get(b.id)||0)-(recent.get(a.id)||0);
      if (route) return route.ids.indexOf(a.id)-route.ids.indexOf(b.id);
      const ar=START_ORDER.indexOf(a.id),br=START_ORDER.indexOf(b.id);
      if (ar>=0 || br>=0) return (ar>=0?ar:999)-(br>=0?br:999);
      const languagePriority=Number(/中文|中英/.test(b.language))-Number(/中文|中英/.test(a.language));
      return languagePriority || a.order-b.order;
    });
  }
  return {
    find,counts,results,
    records:()=>records.slice(),
    filters:()=>({...filters}),
    isFavorite:id=>favorites.has(id),
    openedAt:id=>recent.get(id)||0,
    setFilters(partial={}) {
      for (const key of Object.keys(DEFAULT_FILTERS)) if (key in partial) filters[key]=key==='downloaded'?Boolean(partial[key]):String(partial[key]??DEFAULT_FILTERS[key]);
      if (!['all','favorites','recent'].includes(filters.collection)) filters.collection='all';
      if (!Object.hasOwn(SOURCE_LABELS,filters.source)) filters.source='all';
      if (filters.route!=='all'&&!routeById(filters.route)) filters.route='all';
      return results();
    },
    resetFilters() { filters={...DEFAULT_FILTERS}; return results(); },
    toggleFavorite(id) {
      if (!find(id)) return {favorite:false,persisted:persistenceAvailable};
      favorites.has(id)?favorites.delete(id):favorites.add(id);
      return {favorite:favorites.has(id),persisted:persist()};
    },
    markRead(id) {
      if (!find(id)) return false;
      recent.set(id,now());
      recent=new Map([...recent].sort((a,b)=>b[1]-a[1]).slice(0,30));
      persist();
      return true;
    },
    refresh(nextResources) { records=prepareResources(nextResources); return results(); },
    getState:()=>({filters:{...filters},favorites:records.filter(record=>favorites.has(record.id)).map(record=>record.id),recent:[...recent].filter(([id])=>find(id)).sort((a,b)=>b[1]-a[1]).map(([id,openedAt])=>({id,openedAt})),counts:counts(),persistenceAvailable}),
  };
}

export function readingGuide(resource) {
  const text = searchable([resource.title,resource.learning_stage,...(resource.tags||[])].join(' '));
  let questions = ['资料里的板卡型号、修订号，与你的板子一致吗？','例程采用的标准库、HAL、Arduino 或其他框架，与你的工程一致吗？','先完成一个最小例子，再修改一个参数，能否看出变化？'];
  let practice = null;
  if (/adc|模拟|电位器/.test(text)) {
    questions=['传感器输出连接的是可用的模拟输入脚吗？','传感器与开发板是否共地，输入电压是否在该板允许范围内？','代码里的采样范围和换算方式，是否对应当前板卡与配置？'];
    if (resource.id==='st-02') practice={id:'adc',label:'用旋钮实验对照 ADC',reason:'改变电位器位置，对照输入电压和数字读数。'};
  } else if (/按键|switch|button|输入/.test(text)) {
    questions=['按键未按下时，输入有没有明确的上拉或下拉？','四脚按键中哪些脚原本已经相通？','按下后的高低电平，和代码中的条件判断一致吗？'];
    if (resource.id==='extra-spark-switch') practice={id:'button',label:'用按键实验验证',reason:'对照按下、松开和输入电平。'};
  } else if (/供电|复位|boot|swd|下载|programmer|硬件|引脚/.test(text)) {
    questions=['供电端、地线和逻辑电平有没有混淆？','接线依据的是这块板的引脚图，还是同系列另一块板？','下载接口、目标芯片和启动配置是否与当前工具一致？'];
  } else if (/gpio|led|点灯|电阻|面包板/.test(text)) {
    questions=['代码中的端口和引脚号，与导线端点是否一致？','LED 的正负极、限流电阻和回路有没有接对？','输出模式与供电电压是否适合当前器件？'];
    if (['st-01','extra-led-guide'].includes(resource.id)) practice={id:resource.id==='extra-led-guide'?'uno-r3:blink':'blink',label:'用点灯实验对照',reason:'用受支持的 GPIO 示例观察电平和 LED 的关系。'};
  }
  if (['jiangxie-video','tietou-video'].includes(resource.id)) practice={id:'blink',label:'回实验台做第一盏灯',reason:'用预接线的 STM32 点灯实验验证刚学到的概念。'};
  return {
    goal:cleanText(resource.description)||'明确这份资料适用的对象，并找到当前问题的说明。',
    start:cleanText(resource.reading_hint)||'先看适用型号与目录，围绕当前实验查一个问题；不必从头通读。',
    questions,practice,
  };
}

function icon(name) {
  const paths={
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    star:'<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/>',
    book:'<path d="M3 4.5c3-1 6-.7 9 1.5 3-2.2 6-2.5 9-1.5v15c-3-1-6-.7-9 1.5-3-2.2-6-2.5-9-1.5Z"/><path d="M12 6v15M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
    arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external:'<path d="M14 4h6v6m0-6L10 14M10 5H5v14h14v-5"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    file:'<path d="M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6m-6 4h6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.file}</svg>`;
}

function cover(resource) {
  const isCourse=/课程/.test(resource.kind),tone=resource.sourceKind==='creator'?'ochre':resource.sourceKind==='mirror'?'stone':'green';
  return `<div class="rl-cover rl-cover-${tone}" aria-hidden="true"><svg viewBox="0 0 94 120" fill="none"><path d="M19 10h43l15 15v84H19Z" fill="currentColor" fill-opacity=".09"/><path d="M19 10h43l15 15v84H19Z" stroke="currentColor" stroke-width="1.5"/><path d="M62 10v16h15" stroke="currentColor" stroke-width="1.5"/><path d="M29 89h37M29 97h24" stroke="currentColor" stroke-opacity=".45" stroke-width="2"/>${isCourse?'<circle cx="47" cy="57" r="17" stroke="currentColor" stroke-width="1.5"/><path d="m43 48 12 9-12 9Z" fill="currentColor"/>':'<path d="M29 43h27M29 51h36M29 59h30" stroke="currentColor" stroke-width="2"/><rect x="29" y="69" width="10" height="10" rx="1" stroke="currentColor"/><path d="M44 72h22m-22 6h16" stroke="currentColor" stroke-width="1.5"/>'}</svg><span>${esc(resource.localPdf?'PDF':isCourse?'课程':'资料')}</span></div>`;
}

function providerEntries(records, kind) {
  const preferred=kind==='creator'?['江协科技','铁头山羊','野火 EmbedFire','正点原子 ALIENTEK']:['STMicroelectronics','Espressif','Arduino','Raspberry Pi'];
  return preferred.flatMap(author=>{
    const matches=records.filter(record=>record.sourceKind===kind&&record.author===author);
    return matches.length?[{author,count:matches.length,label:author.replace('STMicroelectronics','ST 意法半导体').replace('Espressif','乐鑫 Espressif').replace('Raspberry Pi','树莓派 Raspberry Pi')}]:[];
  });
}

function dateLabel(time) {
  if (!Number.isFinite(time)||time<=0) return '';
  return new Date(time).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});
}

/**
 * @param {Element|string} container Existing library page or an empty element.
 * @param {Array} resources Existing resource records; never mutated.
 * @param {Object} callbacks onNavigate(page), onStartExample(exampleId, context).
 * @returns {{destroy:Function,refresh:Function,setFilters:Function,resetFilters:Function,openResource:Function,getState:Function}}
 */
export function mountResourceLibrary(container, resources, {onNavigate, onStartExample} = {}) {
  const root=typeof container==='string'?document.querySelector(container):container;
  if (!root || typeof root.querySelector!=='function') throw new TypeError('mountResourceLibrary 需要一个存在的容器元素。');
  let storage=null;
  try { storage=globalThis.localStorage || null; } catch {}
  const model=createResourceLibraryModel(resources,{storage});
  let page=1,detailId=null,previewing=false,returnFocus=null,searchTimer=null,noticeTimer=null,destroyed=false;
  root.classList.add('rl-library');
  const $=selector=>root.querySelector(selector);

  function notice(message) {
    clearTimeout(noticeTimer);
    const element=$('[data-rl-dialog]')?.open?$('[data-rl-detail-notice]'):$('[data-rl-notice]');
    if (!element) return;
    element.textContent=message;element.hidden=false;
    noticeTimer=setTimeout(()=>{element.hidden=true;},4000);
  }

  function buildShell() {
    const counts=model.counts(),records=model.records();
    const authors=[...new Set(records.map(record=>record.author))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
    const families=[...new Set(records.flatMap(record=>record.families))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
    const sourcePanel=(kind,title,description)=>`<section class="rl-source-panel"><div class="rl-section-line"><div><h3>${title}</h3><p>${description}</p></div><button type="button" class="rl-link-button" data-rl-action="source" data-source="${kind}">查看全部 ${model.counts()[kind]} 份 ${icon('arrow')}</button></div><div class="rl-provider-list">${providerEntries(records,kind).map(entry=>`<button type="button" data-rl-action="provider" data-author="${esc(entry.author)}" data-source="${kind}"><span>${esc(entry.label)}</span><span>${entry.count} 份 ${icon('arrow')}</span></button>`).join('')}</div></section>`;
    root.innerHTML=`<div class="rl-shell">
      <header class="rl-hero"><div class="rl-hero-copy"><span class="rl-kicker">${icon('book')} 学习资料中心</span><h1>找到你现在用得上的一份。</h1><p>先看懂一个概念，再回实验台验证。中文教程、原厂手册和作者配套，都有明确的阅读入口。</p></div><div class="rl-stats" aria-label="资料库统计"><button type="button" data-rl-action="reset"><strong data-rl-count="total">${counts.total}</strong><span>份资料</span></button>${counts.downloaded?`<button type="button" data-rl-action="downloaded-shortcut"><strong data-rl-count="downloaded">${counts.downloaded}</strong><span>份本地 PDF</span></button>`:`<button type="button" data-rl-action="source" data-source="official"><strong>${counts.official}</strong><span>份官方资料</span></button>`}<button type="button" data-rl-action="collection" data-collection="favorites"><strong data-rl-count="favorites">${counts.favorites}</strong><span>份我的收藏</span></button></div></header>
      <section class="rl-start-section" aria-labelledby="rl-routes-heading"><div class="rl-section-line"><div><h2 id="rl-routes-heading">不知道从哪开始？选你现在的问题。</h2><p>每条路线只挑几份资料，读完就能去验证。</p></div>${typeof onNavigate==='function'?`<button type="button" class="rl-link-button" data-rl-action="navigate" data-page="glossary">先看白话术语 ${icon('arrow')}</button>`:''}</div><div class="rl-route-grid">${RESOURCE_ROUTES.map(route=>{const count=route.ids.filter(id=>model.find(id)).length;return `<article class="rl-route-card"><span class="rl-route-number">${route.number}</span><h3>${esc(route.title)}</h3><p>${esc(route.summary)}</p><ol>${route.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><button type="button" class="rl-button rl-button-soft" data-rl-action="route" data-route="${route.id}" ${!count?'disabled':''}>看这 ${count} 份资料 ${icon('arrow')}</button></article>`;}).join('')}</div></section>
      <div class="rl-source-grid">${sourcePanel('creator','跟着课程作者学','先选一套课程，例程与接线保持配套。')}${sourcePanel('official','到厂商与官方查原文','查引脚、电气限制、外设行为和开发工具。')}</div>
      <section class="rl-browser" aria-labelledby="rl-browser-heading"><div class="rl-browser-heading"><h2 id="rl-browser-heading">我的资料架</h2><div class="rl-collection-tabs" aria-label="资料集合"><button type="button" data-rl-action="collection" data-collection="all">全部资料 <span data-rl-count="total">${counts.total}</span></button><button type="button" data-rl-action="collection" data-collection="favorites">${icon('star')} 已收藏 <span data-rl-count="favorites">${counts.favorites}</span></button><button type="button" data-rl-action="collection" data-collection="recent">${icon('clock')} 最近阅读 <span data-rl-count="recent">${counts.recent}</span></button></div></div>
        <div class="rl-filter-panel"><div class="rl-search-row"><label class="rl-search">${icon('search')}<span class="rl-sr-only">搜索资料名称、问题或关键词</span><input type="search" data-rl-filter="query" placeholder="试试“GPIO 中文”、“江协”、“下载失败”…" autocomplete="off"><button type="button" class="rl-search-clear" data-rl-action="clear" data-filter="query" aria-label="清空搜索" hidden>${icon('close')}</button></label>${counts.downloaded?`<label class="rl-check"><input type="checkbox" data-rl-filter="downloaded"><span>只看本地 PDF</span></label>`:''}</div>
          <div class="rl-filter-row"><label><span>来源类型</span><select data-rl-filter="source">${Object.entries(SOURCE_LABELS).filter(([key])=>key!=='other'||records.some(record=>record.sourceKind==='other')).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label><span>作者 / 厂商</span><select data-rl-filter="author"><option value="all">全部作者与厂商</option>${authors.map(author=>`<option value="${esc(author)}">${esc(author)}</option>`).join('')}</select></label><label><span>语言</span><select data-rl-filter="language"><option value="all">全部语言</option><option value="中文">中文</option><option value="英文">英文</option></select></label><label><span>开发板 / 方向</span><select data-rl-filter="family"><option value="all">全部系列与方向</option>${families.map(family=>`<option value="${esc(family)}">${esc(family)}</option>`).join('')}</select></label></div>
        </div><div class="rl-active-filters" data-rl-active-filters></div><div class="rl-results-heading"><p data-rl-result-count role="status" aria-live="polite" tabindex="-1"></p><p data-rl-result-note></p></div><div class="rl-route-context" data-rl-route-context hidden></div><div class="rl-resource-grid" data-rl-grid></div><nav class="rl-pagination" data-rl-pagination aria-label="资料分页"></nav>
        <footer class="rl-library-note">${icon('file')}<p>${counts.downloaded?'本地 PDF 可以直接预览。在线资料保留原始入口。':'手册、课程和配套资料都从各自的来源入口打开。'}${counts.mirror?`<button type="button" class="rl-inline-button" data-rl-action="source" data-source="mirror">另有 ${counts.mirror} 份公开镜像译本，查看来源说明。</button>`:''}</p></footer>
      </section><div class="rl-notice" data-rl-notice role="status" aria-live="polite" hidden></div>
      <dialog class="rl-dialog" data-rl-dialog aria-labelledby="rl-detail-title"><div data-rl-detail></div></dialog>
    </div>`;
    const dialog=$('[data-rl-dialog]');
    dialog.addEventListener('close',()=>{
      const closedId=detailId;detailId=null;previewing=false;
      const fallback=[...root.querySelectorAll('[data-rl-action="detail"]')].find(element=>element.dataset.id===closedId)||$('[data-rl-result-count]');
      (returnFocus?.isConnected?returnFocus:fallback)?.focus?.();
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
  }

  function updateCounts() {
    const counts=model.counts();
    root.querySelectorAll('[data-rl-count]').forEach(element=>element.textContent=String(counts[element.dataset.rlCount]??0));
  }

  function activeFilters() {
    const filters=model.filters();
    const selected=[];
    if(filters.query)selected.push(['query',`搜索：${filters.query}`]);
    for(const [key,label] of [['source','来源'],['author','作者'],['language','语言'],['family','系列']])if(filters[key]!=='all')selected.push([key,`${label}：${key==='source'?SOURCE_LABELS[filters[key]]:filters[key]}`]);
    if(filters.downloaded)selected.push(['downloaded','本地 PDF']);
    if(filters.collection!=='all')selected.push(['collection',filters.collection==='favorites'?'我的收藏':'最近阅读']);
    if(filters.route!=='all')selected.push(['route',`路线：${routeById(filters.route)?.title}`]);
    return selected;
  }

  function card(resource) {
    const favorite=model.isFavorite(resource.id),date=model.openedAt(resource.id),track=learningTrack(resource);
    return `<article class="rl-resource-card"><div class="rl-resource-body">${cover(resource)}<div class="rl-resource-copy"><div class="rl-resource-meta"><span class="rl-source-tag rl-source-${resource.sourceKind}">${esc(SOURCE_LABELS[resource.sourceKind])}</span><span>${esc(resource.language)}</span></div><h3><button type="button" data-rl-action="detail" data-id="${esc(resource.id)}">${esc(resource.title)}</button></h3>${track?`<span class="rl-track-badge rl-track-${track.key}">${esc(track.label)}</span>`:''}<p>${esc(resource.description||resource.learning_stage||'查看原始资料与阅读提示。')}</p><div class="rl-resource-byline">${esc(resource.author)}</div></div></div><div class="rl-resource-foot"><div class="rl-resource-status">${resource.localPdf?`${icon('file')}<span>本地 PDF${Number.isFinite(resource.pages)&&resource.pages>0?` · ${resource.pages} 页`:''}</span>`:`${icon('external')}<span>${esc(resource.kind)} · 在线入口</span>`}${model.filters().collection==='recent'&&date?`<span class="rl-opened-date">${esc(dateLabel(date))} 打开</span>`:''}</div><div class="rl-card-actions"><button type="button" class="rl-button rl-button-primary" data-rl-action="${resource.localPdf?'preview':'detail'}" data-id="${esc(resource.id)}">${resource.localPdf?'预览与阅读指南':'查看阅读指南'} ${icon('arrow')}</button><button type="button" class="rl-favorite ${favorite?'is-saved':''}" data-rl-action="favorite" data-id="${esc(resource.id)}" aria-pressed="${favorite}" aria-label="${favorite?'取消收藏':'收藏'}：${esc(resource.title)}">${icon('star')}<span>${favorite?'已收藏':'收藏'}</span></button></div></div></article>`;
  }

  function render() {
    if(destroyed)return;
    const filters=model.filters(),items=model.results(),total=model.counts().total,maxPage=Math.max(1,Math.ceil(items.length/PAGE_SIZE));
    page=Math.max(1,Math.min(page,maxPage));updateCounts();
    root.querySelectorAll('[data-rl-filter]').forEach(element=>{const key=element.dataset.rlFilter;if(element.type==='checkbox')element.checked=Boolean(filters[key]);else if(element.value!==filters[key])element.value=filters[key];});
    $('[data-rl-action="clear"][data-filter="query"]').hidden=!filters.query;
    root.querySelectorAll('.rl-collection-tabs [data-collection]').forEach(button=>{const selected=button.dataset.collection===filters.collection;button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected));});
    const active=activeFilters();
    $('[data-rl-active-filters]').innerHTML=active.length?`<span class="rl-filter-caption">已选条件</span>${active.map(([key,label])=>`<button type="button" data-rl-action="clear" data-filter="${key}" aria-label="清除${esc(label)}">${esc(label)} ${icon('close')}</button>`).join('')}<button type="button" class="rl-reset-all" data-rl-action="reset">清除全部</button>`:'<span class="rl-filter-hint">按中文入门内容优先排列，也可以带着具体问题搜索。</span>';
    const first=items.length?(page-1)*PAGE_SIZE+1:0,last=Math.min(page*PAGE_SIZE,items.length);
    $('[data-rl-result-count]').innerHTML=`找到 <strong>${items.length}</strong> 份资料 <span>／ 全库 ${total} 份${items.length>PAGE_SIZE?` · 当前 ${first}–${last}`:''}</span>`;
    $('[data-rl-result-note]').textContent=filters.collection==='recent'?'按最近打开资料入口或 PDF 的时间排列，不表示已经读完。':filters.collection==='favorites'?'收藏保存在当前浏览器，方便下次接着查。':'每份资料都有来源、适用方向和阅读提示。';
    const route=routeById(filters.route),context=$('[data-rl-route-context]');
    context.hidden=!route;
    if(route)context.innerHTML=`<div><strong>${esc(route.title)}</strong>${route.framework?`<span class="rl-route-framework">${esc(route.framework)}</span>`:''}<p>按顺序选一份阅读，再回实验台验证。HAL 教材在资料架中另有明确标记，请勿与默认标准库工程混用。</p></div>${route.exampleId&&typeof onStartExample==='function'?`<button type="button" class="rl-button rl-button-primary" data-rl-action="route-example" data-route="${route.id}">${esc(route.exampleLabel)} ${icon('arrow')}</button>`:!route.exampleId&&typeof onNavigate==='function'?`<button type="button" class="rl-button rl-button-primary" data-rl-action="navigate" data-page="faults">打开故障排查 ${icon('arrow')}</button>`:''}`;
    if(items.length)$('[data-rl-grid]').innerHTML=items.slice(first-1,last).map(card).join('');
    else {
      const onlyCollection=active.every(([key])=>key==='collection');
      const title=filters.collection==='favorites'&&onlyCollection?'还没有收藏，先留下一份想读的资料。':filters.collection==='recent'&&onlyCollection?'打开一份原文或 PDF，这里就会留下入口。':'这些条件暂时没有匹配的资料。';
      $('[data-rl-grid]').innerHTML=`<div class="rl-empty">${icon(filters.collection==='favorites'?'star':'book')}<h3>${title}</h3><p>${onlyCollection?'在资料卡上点“收藏”，或打开资料开始阅读。':'逐个移除上面的条件，或清除筛选后重新找。'}</p><button type="button" class="rl-button rl-button-primary" data-rl-action="reset">${onlyCollection?'浏览全部资料':'清除全部条件'}</button></div>`;
    }
    $('[data-rl-pagination]').innerHTML=maxPage>1?`<button type="button" data-rl-action="page" data-page="${page-1}" ${page===1?'disabled':''}>上一页</button>${Array.from({length:maxPage},(_,index)=>`<button type="button" data-rl-action="page" data-page="${index+1}" ${page===index+1?'aria-current="page"':''} aria-label="第 ${index+1} 页">${index+1}</button>`).join('')}<button type="button" data-rl-action="page" data-page="${page+1}" ${page===maxPage?'disabled':''}>下一页</button>`:'';
  }

  function sourceHost(url) { try{return new URL(url).hostname;}catch{return '来源链接未提供';} }

  function renderDetail() {
    const resource=model.find(detailId);if(!resource)return;
    const guide=readingGuide(resource),favorite=model.isFavorite(resource.id),date=resource.verified_date||resource.checked_on,track=learningTrack(resource);
    const external=resource.originalUrl||resource.sourceUrl;
    const facts=[['来源',resource.author],['语言',resource.language],['适用方向',resource.families.join(' / ')],['核验日期',date],['版本',resource.version]].filter(([,value])=>value);
    if(resource.localPdf&&Number.isFinite(resource.pages)&&resource.pages>0)facts.push(['文件页数',`${resource.pages} 页`]);
    $('[data-rl-detail]').innerHTML=`<div class="rl-drawer-header"><span>${icon('book')} 阅读指南</span><button type="button" class="rl-icon-button" data-rl-action="close-detail" aria-label="关闭资料详情">${icon('close')}</button></div><div class="rl-drawer-body"><p class="rl-detail-notice" data-rl-detail-notice role="status" aria-live="polite" hidden></p><div class="rl-detail-heading">${cover(resource)}<div><span class="rl-source-tag rl-source-${resource.sourceKind}">${esc(SOURCE_LABELS[resource.sourceKind])}</span><h2 id="rl-detail-title">${esc(resource.title)}</h2><p>${esc(resource.localPdf?'已有本地 PDF，可在这里预览。':'保留原始在线入口；未在本站下载文件。')}</p></div></div><div class="rl-detail-actions">${resource.localPdf?`<button type="button" class="rl-button rl-button-primary" data-rl-action="preview" data-id="${esc(resource.id)}">${icon('file')} ${previewing?'重新定位到 PDF':'在这里预览 PDF'}</button><a class="rl-button" href="${esc(resource.localPdf)}" target="_blank" rel="noopener" data-rl-action="open-original" data-id="${esc(resource.id)}">新标签打开 PDF ${icon('external')}</a>`:external?`<a class="rl-button rl-button-primary" href="${esc(external)}" target="_blank" rel="noopener" data-rl-action="open-original" data-id="${esc(resource.id)}">${/配套/.test(resource.category)?'打开作者 / 厂商配套入口':'打开原始资料'} ${icon('external')}</a>`:'<span class="rl-link-unavailable">当前记录没有可打开的原始链接。</span>'}<button type="button" class="rl-favorite ${favorite?'is-saved':''}" data-rl-action="favorite" data-id="${esc(resource.id)}" aria-pressed="${favorite}">${icon('star')} ${favorite?'已收藏':'收藏'}</button></div>
      ${resource.extraction_code?`<div class="rl-access-note"><strong>配套文件入口信息</strong><span>网盘提取码：<b>${esc(resource.extraction_code)}</b>${resource.archive_password?`　解压密码：<b>${esc(resource.archive_password)}</b>`:''}</span><p>这里只保存作者发布的入口和已核验信息，文件内容仍需在原站获取。</p></div>`:''}
      ${track?`<section class="rl-track-note rl-track-${track.key}"><strong>${esc(track.label)}</strong><p>${esc(track.note)}</p></section>`:''}
      <section class="rl-detail-section"><h3>这份资料帮你解决什么</h3><p>${esc(guide.goal)}</p>${resource.learning_stage?`<span class="rl-stage-label">适合：${esc(resource.learning_stage)}</span>`:''}</section><section class="rl-detail-section rl-reading-start"><h3>从这里读，先别整本硬啃</h3><p>${esc(guide.start)}</p></section><section class="rl-detail-section"><h3>回到你的接线，核对这三件事</h3><ol class="rl-question-list">${guide.questions.map(question=>`<li>${esc(question)}</li>`).join('')}</ol><p class="rl-guidance-note">这是实验台整理的对照问题；具体参数与连接方式请以原文和你的板卡版本为准。</p>${guide.practice&&typeof onStartExample==='function'?`<button type="button" class="rl-button rl-button-soft" data-rl-action="resource-example" data-id="${esc(resource.id)}">${esc(guide.practice.label)} ${icon('arrow')}</button>`:typeof onNavigate==='function'?`<button type="button" class="rl-link-button" data-rl-action="navigate" data-page="lab">带着问题回实验台 ${icon('arrow')}</button>`:''}</section>
      ${previewing&&resource.localPdf?`<section class="rl-pdf-section" data-rl-pdf><div class="rl-section-line"><h3>PDF 原文预览</h3><a class="rl-link-button" href="${esc(resource.localPdf)}" target="_blank" rel="noopener" data-rl-action="open-original" data-id="${esc(resource.id)}">新标签打开 ${icon('external')}</a></div><iframe src="${esc(resource.localPdf.split('#')[0]+'#toolbar=1&navpanes=0&view=FitH')}" title="${esc(resource.title)} PDF 原文预览" loading="lazy"></iframe><p>若设备未显示预览，请使用“新标签打开”。这里没有替换或改写 PDF 内容。</p></section>`:''}
      <section class="rl-detail-section rl-provenance"><h3>原始来源与适用边界</h3>${resource.sourceKind==='mirror'?'<p class="rl-mirror-note">这份文件来自公开教学镜像，是旧译本。它没有被标记为本次从厂商官网下载；关键细节请与官方英文原文和勘误对照。</p>':''}<dl>${facts.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${resource.sourceUrl?`<a class="rl-source-link" href="${esc(resource.sourceUrl)}" target="_blank" rel="noopener" data-rl-action="open-original" data-id="${esc(resource.id)}">查看原始发布来源 <span>${esc(sourceHost(resource.sourceUrl))}</span>${icon('external')}</a>`:''}${resource.license_note?`<details><summary>版权与资料说明</summary><p>${esc(resource.license_note)}</p></details>`:''}</section></div>`;
  }

  function openResource(id, {preview=false}={}) {
    if(destroyed)return false;
    const resource=model.find(id);if(!resource)return false;
    const dialog=$('[data-rl-dialog]');
    if(!dialog.open)returnFocus=root.ownerDocument?.activeElement;
    detailId=id;previewing=Boolean(preview&&resource.localPdf);
    if(previewing)model.markRead(id);
    renderDetail();render();
    if(!dialog.open) {
      if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    }
    if(previewing)$('[data-rl-pdf]')?.scrollIntoView?.({block:'start'});
    return true;
  }

  function closeDetail() {
    const dialog=$('[data-rl-dialog]');
    if(dialog?.open&&typeof dialog.close==='function')dialog.close();
    else {dialog?.removeAttribute('open');detailId=null;previewing=false;}
  }

  function applyFilters(partial, {reset=false,scroll=false}={}) {
    clearTimeout(searchTimer);if(reset)model.resetFilters();model.setFilters(partial);page=1;render();
    if(scroll)$('[data-rl-result-count]')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  }

  function onClick(event) {
    const button=event.target.closest?.('[data-rl-action]');
    if(!button||!root.contains(button)||button.disabled)return;
    const action=button.dataset.rlAction,id=button.dataset.id;
    if(action==='open-original') {model.markRead(id);updateCounts();if(model.filters().collection==='recent')render();return;}
    event.preventDefault();
    if(action==='detail')openResource(id);
    else if(action==='preview')openResource(id,{preview:true});
    else if(action==='close-detail')closeDetail();
    else if(action==='favorite') {const result=model.toggleFavorite(id);render();if(detailId)renderDetail();const scope=detailId?$('[data-rl-dialog]'):root;const replacement=[...scope.querySelectorAll('[data-rl-action="favorite"]')].find(element=>element.dataset.id===id);(replacement||$('[data-rl-result-count]'))?.focus?.();notice(result.favorite?result.persisted?'已收藏，下次可以从“已收藏”找到。':'已在当前页收藏；浏览器存储不可用，刷新后可能丢失。':'已取消收藏。');}
    else if(action==='clear')applyFilters({[button.dataset.filter]:DEFAULT_FILTERS[button.dataset.filter]});
    else if(action==='reset')applyFilters({}, {reset:true});
    else if(action==='collection')applyFilters({collection:button.dataset.collection},{reset:true,scroll:true});
    else if(action==='downloaded-shortcut')applyFilters({downloaded:true},{reset:true,scroll:true});
    else if(action==='source')applyFilters({source:button.dataset.source},{reset:true,scroll:true});
    else if(action==='provider')applyFilters({source:button.dataset.source,author:button.dataset.author},{reset:true,scroll:true});
    else if(action==='route')applyFilters({route:button.dataset.route},{reset:true,scroll:true});
    else if(action==='page') {page=Number(button.dataset.page)||1;render();$('[data-rl-result-count]')?.scrollIntoView?.({block:'start'});}
    else if(action==='navigate') {closeDetail();onNavigate?.(button.dataset.page);}
    else if(action==='route-example') {const route=routeById(button.dataset.route);if(route?.exampleId){closeDetail();onStartExample?.(route.exampleId,{resourceId:null,reason:route.title});}}
    else if(action==='resource-example') {const resource=model.find(id),practice=resource&&readingGuide(resource).practice;if(practice){closeDetail();onStartExample?.(practice.id,{resourceId:id,reason:practice.reason});}}
  }
  function onInput(event) {
    if(event.target.dataset.rlFilter!=='query')return;
    clearTimeout(searchTimer);model.setFilters({query:event.target.value});
    searchTimer=setTimeout(()=>{page=1;render();},120);
  }
  function onChange(event) {
    const key=event.target.dataset.rlFilter;
    if(!key||key==='query')return;
    applyFilters({[key]:key==='downloaded'?event.target.checked:event.target.value});
  }

  buildShell();render();
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);root.addEventListener('change',onChange);
  return {
    destroy() {if(destroyed)return;closeDetail();destroyed=true;clearTimeout(searchTimer);clearTimeout(noticeTimer);root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.innerHTML='';root.classList.remove('rl-library');},
    refresh(nextResources) {if(destroyed)return;closeDetail();if(nextResources!==undefined)model.refresh(nextResources);page=1;buildShell();render();},
    setFilters(partial) {if(!destroyed)applyFilters(partial);},
    resetFilters() {if(!destroyed)applyFilters({}, {reset:true});},
    openResource,
    getState:()=>({...model.getState(),page,detailId,previewing}),
  };
}
