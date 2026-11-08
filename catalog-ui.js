import {BOARD_CATALOG,COMPONENT_CATALOG,EXTRA_RESOURCES} from './catalog-data.js';
import {BOARD_PROFILES,getBoardProfile} from './board-profiles.js';
import {getMountOptions} from './breadboard-mount.js';
import {PARTS} from './circuit.js';
import {ssd1306HostPins} from './ssd1306.js';
import {matchHardware,normalizeBOM} from './catalog-index.js';
import * as ModelVisuals from './model-renderer.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=u=>/^https?:\/\//.test(u||'')?u:'#';
const detailedBoards=new Set(['bluepill','uno-r3','esp32-devkitc','pico','nano','nucleo-f103rb','raspberry-pi-4','raspberry-pi-5','pi-zero-2-w']);
export {EXTRA_RESOURCES};
export const catalogCounts=()=>({boards:BOARD_CATALOG.length,parts:COMPONENT_CATALOG.length});
export function boardSupport(b){return b.profileId&&Object.hasOwn(BOARD_PROFILES,b.profileId)?'simulate':'reference';}
export function partSupport(p){return p.modelType&&PARTS[p.modelType]?'simulate':'reference';}
export function boardModelTier(item){
 if(boardSupport(item)==='reference')return 'reference';
 return detailedBoards.has(item.profileId)?'detailed':'teaching';
}
const boardModelLabels={detailed:'精细 3D',teaching:'教学 3D',reference:'仅资料 · 无实验台模型'};
const boardModelDetails={
 detailed:'实验台提供此板的精细 Blender 外观模型。可在 3D 实验台旋转、缩放并使用已建模的引脚。',
 teaching:'实验台按板型尺寸与排针绘制教学 3D。芯片和接插件的外观是示意，电气范围见下方引脚索引。',
 reference:'该板目前只收录选型和厂商资料，尚无实验台 3D 模型或可操作的引脚。'
};
const boardModelCounts=Object.fromEntries(Object.keys(boardModelLabels).map(tier=>[
 tier,BOARD_CATALOG.filter(item=>boardModelTier(item)===tier).length
]));
const boardMountLabels={direct:'可直插面包板',jumper:'用跳线接面包板',reference:'仅资料与选型'};
const boardMountDetails={
 direct:'在实验台使用「自动对孔插入」对齐两排针脚。插好后，针脚通过对应孔位接入电路。',
 jumper:'把开发板放在面包板旁，用跳线连接板上已建模的引脚和面包板孔位。',
 reference:'通过板卡资料入口查阅实物引脚和接线。'
};
function boardMountStatus(item){
 if(boardSupport(item)==='reference')return 'reference';
 return getMountOptions(getBoardProfile(item.profileId))?'direct':'jumper';
}
function mountBadge(item){
 const status=boardMountStatus(item);
 return status==='reference'?'':'<span class="hardware-mount-label" data-mount-status="'+status+'">'+boardMountLabels[status]+'</span>';
}
export function hardwareGeometryLabel(item,kind){
 if(kind==='board'){
  const tier=boardModelTier(item);
  if(tier==='reference')return boardModelLabels.reference;
  return boardModelLabels[tier]+(BOARD_PROFILES[item.profileId].partialPinout?' · 部分接口可运行':' · 可运行');
 }
 if(partSupport(item)!=='simulate')return '仅资料与选型';
 if(item.modelType==='sevenseg')return '实物封装 3D · 可插装';
 if(item.modelType==='encoder')return '实物封装 3D · 可转动';
 if(item.modelType==='joystick')return '实物封装 3D · 可推摇杆';
 if(item.defaults?.rgbModel==='kingbright-wp154a4')return '实物封装 3D · PWM 混色';
 if(item.modelType==='grove-relay')return '实物模块 3D · 常开触点';
 if(item.modelType==='dipswitch')return '实物封装 3D · 四位可拨';
 if(item.defaults?.ldrModel==='pdv-p8103')return '实物封装 3D · 可遮光';
 if(item.id==='fa130-18100'||['drv8833','hcsr04','ssd1306','mcp9808'].includes(item.modelType))return '实物尺寸 3D · 可运行';
 return '封装示意 3D · 可运行';
}
export function hardwareThumb(item,kind='board'){
 const id='thumb-'+String(item.id).replace(/[^a-z0-9_-]/gi,''),defs='<defs><linearGradient id="'+id+'-metal" x2=".7" y2="1"><stop stop-color="#eef0e9"/><stop offset=".4" stop-color="#aab5b2"/><stop offset=".6" stop-color="#e1e7df"/><stop offset="1" stop-color="#83958f"/></linearGradient><radialGradient id="'+id+'-dome" cx=".3" cy=".25"><stop stop-color="#fff9cf" stop-opacity=".9"/><stop offset=".38" stop-color="'+({red:'#e85646',green:'#48a65e',blue:'#3d8ed2',yellow:'#ddba24',white:'#dce4e7'}[item.defaults?.color]||'#d54a3c')+'"/><stop offset="1" stop-color="#6d2621"/></radialGradient></defs>',metal='url(#'+id+'-metal)';
 let art='';
 if(kind==='board'){
  const p=BOARD_PROFILES[item.profileId],family=String(item.family||''),narrow=/nano|pico|bluepill|teensy|xiao/i.test(item.id),isEsp=/esp/i.test(family),isArduino=/arduino/i.test(family),w=p?.width||(narrow?2.4:5.3),h=p?.height||(narrow?5.2:6.8),scale=Math.min(59/w,79/h),color=p?.color||(isEsp?'#354743':isArduino?'#267d86':'#3f7855');
  const pins=p?.pins||Array.from({length:24},(_,i)=>({x:(i<12?-1:1)*(w/2-.18),z:-h/2+.5+(i%12)*(h-1)/11,kind:'gpio'}));
  art='<g transform="translate(40 49) scale('+scale+')"><rect x="'+(-w/2+.06)+'" y="'+(-h/2+.1)+'" width="'+w+'" height="'+h+'" rx=".14" fill="#19362e25"/><rect x="'+(-w/2)+'" y="'+(-h/2)+'" width="'+w+'" height="'+h+'" rx=".14" fill="'+color+'" stroke="#b7d6be" stroke-width=".035"/>';
  art+=pins.map(pin=>'<rect x="'+(pin.x-.1)+'" y="'+(pin.z-.1)+'" width=".2" height=".2" rx=".015" fill="#cbb777"/><circle cx="'+pin.x+'" cy="'+pin.z+'" r=".045" fill="#172d24"/>').join('');
  const chipW=w*(isArduino?.22:.38),chipH=h*(isArduino?.40:.26);art+='<rect x="'+(-chipW/2)+'" y="'+(-chipH/2+.3)+'" width="'+chipW+'" height="'+chipH+'" rx=".04" fill="#1c2a28" stroke="#8caaa0" stroke-width=".025"/>';
  for(let i=0;i<10;i++){const y=-chipH/2+.36+i*(chipH-.12)/9;art+='<path d="M'+(-chipW/2-.15)+' '+y+'h.15m'+chipW+' 0h.15" stroke="#aebdb4" stroke-width=".045"/>';}
  art+='<rect x="'+(-w*.19)+'" y="'+(-h/2-.08)+'" width="'+w*.38+'" height="'+Math.min(.65,h*.14)+'" rx=".05" fill="'+metal+'" stroke="#6a7d72" stroke-width=".035"/><rect x="'+(-w*.14)+'" y="'+(-h/2+.04)+'" width="'+w*.28+'" height=".14" rx=".035" fill="#243731"/>';
  art+='<rect x="'+(w*.20)+'" y="'+(h*.25)+'" width=".27" height=".16" rx=".02" fill="#ded8a0"/><rect x="'+(-w*.26)+'" y="'+(-h*.25)+'" width=".28" height=".5" rx=".12" fill="'+metal+'"/><circle cx="'+(w*.25)+'" cy="'+(-h*.24)+'" r=".12" fill="#353d38" stroke="#d2d7cc" stroke-width=".08"/>';
  if(isEsp)art+='<rect x="'+(-w*.29)+'" y="'+(-h*.27)+'" width="'+w*.58+'" height="'+h*.25+'" fill="'+metal+'" stroke="#789389" stroke-width=".03"/><path d="M'+(-w*.27)+' '+(-h*.35)+'h'+w*.54+'m0-.12h-'+w*.54+'m0-.12h'+w*.54+'" stroke="#ccb879" stroke-width=".055" fill="none"/>';
  art+='</g><text x="40" y="95" text-anchor="middle" fill="#52745c" font-size="5" font-family="sans-serif">外观示意</text>';
 }else{
  const type=item.modelType||'',legs='<path d="M25 62v24M47 62v19" stroke="'+metal+'" stroke-width="2.3"/>',wire='<path d="M4 50h72" stroke="'+metal+'" stroke-width="2.3"/>';
  if(type==='resistor'){const visual=ModelVisuals.resistorVisual?.(item.defaults?.resistance??330),bands=visual?.bands||[{color:'#df873c'},{color:'#df873c'},{color:'#8c643c'},{color:'#c9a843'}];art=wire+'<rect x="17" y="39" width="46" height="22" rx="7" fill="#d7c394" stroke="#ac996d"/><path d="M21 43h38" stroke="#fff6d9" stroke-opacity=".65"/>'+bands.map((b,i)=>'<rect x="'+(24+i*30/Math.max(1,bands.length-1))+'" y="40" width="3.4" height="20" rx=".5" fill="'+b.color+'"/>').join('');}
  else if(type==='diode')art=wire+'<rect x="20" y="39" width="40" height="22" rx="7" fill="#343f3d" stroke="#1b2b27"/><rect x="49" y="40" width="5" height="20" fill="#d9dbcf"/><path d="M25 43h20" stroke="#71847b"/>';
  else if(type==='ldr')art=legs+'<circle cx="36" cy="45" r="21" fill="#cc9258" stroke="#916137" stroke-width="1.5"/><circle cx="36" cy="45" r="17" fill="#e9c992"/><path d="M24 34h23v5H24v5h23v5H24v5h23v4" stroke="#705b45" stroke-width="2.5" fill="none"/>';
  else if(type==='thermistor')art='<path d="M29 55v29m13-29v29" stroke="'+metal+'" stroke-width="2"/><ellipse cx="35" cy="44" rx="18" ry="21" fill="#e07f3b" stroke="#ab5327"/><path d="M24 36q4-11 12-10" stroke="#f8bd7f" stroke-width="2" fill="none"/><text x="35" y="48" text-anchor="middle" font-size="8" fill="#734121">NTC</text>';
  else if(type==='led')art=legs+'<path d="M22 60V40a14 14 0 0 1 28 0v20z" fill="url(#'+id+'-dome)" stroke="#752f2c"/><ellipse cx="36" cy="61" rx="17" ry="4" fill="#b65243"/><path d="M26 39q0-8 8-9" fill="none" stroke="#fff5df" stroke-width="2"/><text x="23" y="92" font-size="7" fill="#6c7c65">A</text><text x="45" y="88" font-size="7" fill="#6c7c65">K</text>';
  else if(type==='rgbled')art='<path d="M24 61v23m8-23v29m8-29v23m8-23v23" stroke="'+metal+'" stroke-width="2"/><path d="M20 61V39a16 16 0 0 1 32 0v22z" fill="#d3e3d8" stroke="#839c8d"/><ellipse cx="36" cy="62" rx="19" ry="4" fill="#adcbc0"/><rect x="25" y="43" width="7" height="8" rx="2" fill="#db6652"/><rect x="34" y="42" width="7" height="9" rx="2" fill="#52a477"/><rect x="42" y="44" width="6" height="7" rx="2" fill="#559cce"/>';
  else if(type==='button')art='<path d="M14 45h52v29H14z" fill="#657b70"/><rect x="17" y="33" width="46" height="33" rx="4" fill="'+metal+'" stroke="#768a7b"/><circle cx="40" cy="48" r="13" fill="#1e3029"/><circle cx="38" cy="45" r="9" fill="#354a3e"/><path d="M14 43h-5v9m57-9h5v9M14 66h-5v9m57-9h5v9" stroke="#a7b6a6" stroke-width="3"/>';
  else if(type==='switch')art='<path d="M25 64v19m27-19v19" stroke="'+metal+'" stroke-width="2"/><rect x="15" y="35" width="50" height="33" rx="4" fill="#31473b"/><rect x="20" y="40" width="40" height="20" rx="3" fill="#102c21"/><rect x="38" y="37" width="19" height="27" rx="2" fill="#788f7c"/><path d="M43 40v20m5-20v20m5-20v20" stroke="#bac8b5" stroke-width="1"/>';
  else if(type==='motor')art='<path d="M40 16v14" stroke="'+metal+'" stroke-width="5"/><path d="M20 36h40v37c-12 9-28 9-40 0z" fill="'+metal+'" stroke="#72877b"/><ellipse cx="40" cy="36" rx="20" ry="10" fill="#c3cec2"/><circle cx="40" cy="36" r="7" fill="#748c7c"/><path d="M25 75v11m30-11v11" stroke="#b29c64" stroke-width="2"/><path d="M23 48v18m34-18v18" stroke="#798c80" stroke-width="2"/>';
  else if(type==='buzzer')art=legs+'<path d="M16 40h45v28c-12 9-33 9-45 0z" fill="#263e30"/><ellipse cx="38" cy="40" rx="22" ry="11" fill="#49634f"/><circle cx="38" cy="40" r="6" fill="#14291d"/><text x="21" y="38" font-size="12" fill="#d1dfc6">+</text>';
  else if(type==='capacitor')art=legs+'<path d="M19 29h38v39c-10 9-28 9-38 0z" fill="#285b53"/><path d="M22 34v31" stroke="#c4d1ba" stroke-width="7"/><ellipse cx="38" cy="29" rx="19" ry="8" fill="'+metal+'"/><path d="m29 25 18 8m0-8-18 8" stroke="#839b88"/><path d="M20 43h5m-5 9h5m-5 9h5" stroke="#3d6450"/>';
  else if(type==='pot')art='<rect x="17" y="44" width="44" height="26" rx="4" fill="#3c7fa5"/><path d="M23 70v14m16-14v14m16-14v14" stroke="'+metal+'" stroke-width="2"/><circle cx="39" cy="42" r="21" fill="'+metal+'" stroke="#7a9484"/><circle cx="39" cy="42" r="14" fill="#c4d4be"/><path d="M39 31v22" stroke="#66836c" stroke-width="3"/>';
  else if(type==='sevenseg')art='<rect x="19" y="20" width="42" height="61" rx="4" fill="#263d30" stroke="#94a58e"/><path d="M29 29h20m-23 5v15m26-15v15m-23 4h20m-23 5v15m26-15v15m-23 4h20" stroke="#b54f46" stroke-width="4"/><circle cx="55" cy="74" r="2" fill="#b54f46"/>';
  else if(type==='ssd1306')art='<rect x="9" y="17" width="62" height="66" rx="4" fill="#222b31" stroke="#687579"/><rect x="13" y="31" width="54" height="40" rx="2" fill="#1c2b3c" stroke="#526b7f"/><rect x="18" y="38" width="44" height="22" fill="#101d29"/><path d="M23 46h34v7H23z" fill="none" stroke="#c9eeee"/><path d="M25 49h19" stroke="#c9eeee" stroke-width="2"/><path d="M25 24h30" stroke="#a99157" stroke-width="3" stroke-dasharray="2 2"/><circle cx="15" cy="23" r="3" fill="#d6dcca"/><circle cx="65" cy="23" r="3" fill="#d6dcca"/><circle cx="15" cy="77" r="3" fill="#d6dcca"/><circle cx="65" cy="77" r="3" fill="#d6dcca"/>';
  else if(type==='mcp9808')art='<rect x="9" y="28" width="62" height="44" rx="4" fill="#26343a" stroke="#708086"/><path d="M15 44h14v12H15zM51 44h14v12H51z" fill="#e4e0ce"/><rect x="34" y="44" width="12" height="12" rx="1" fill="#253039"/><path d="M25 64h31" stroke="#c3ab64" stroke-width="3" stroke-dasharray="2 3"/><path d="M15 34h1m48 0h1m-50 32h1m48 0h1" stroke="#e4e0ce" stroke-width="4" stroke-linecap="round"/>';
  else if(type==='servo')art='<rect x="16" y="35" width="47" height="39" rx="4" fill="#257ab5" stroke="#1d5c8d"/><rect x="10" y="48" width="58" height="7" fill="#78afd2"/><path d="M23 28h31" stroke="#e4e9dc" stroke-width="9"/><circle cx="38" cy="28" r="8" fill="#f3f5e8"/><circle cx="38" cy="28" r="3" fill="#b9c6ad"/>';
  else if(type==='dipswitch')art='<rect x="7" y="30" width="66" height="40" rx="5" fill="#202b33" stroke="#4c6067"/>'+
    [19,33,47,61].map((x,i)=>'<path d="M'+x+' 24v8m0 36v8" stroke="#8f9b9a" stroke-width="3"/><rect x="'+(x-5)+'" y="39" width="10" height="20" rx="2" fill="#11181c"/><rect x="'+(x-4)+'" y="'+(i%2?41:49)+'" width="8" height="8" rx="1.5" fill="#eee8d3"/><text x="'+x+'" y="66" text-anchor="middle" fill="#f3f0e0" font-size="6">'+(i+1)+'</text>').join('');
  else if(type==='grove-relay')art='<rect x="8" y="27" width="64" height="44" rx="4" fill="#245d76" stroke="#184659"/><circle cx="28" cy="32" r="3" fill="#e4e4d4"/><circle cx="68" cy="52" r="3" fill="#e4e4d4"/><circle cx="28" cy="66" r="3" fill="#e4e4d4"/><rect x="12" y="37" width="12" height="24" rx="2" fill="#e4e1d0"/><path d="M15 42h6m-6 4h6m-6 4h6m-6 4h6" stroke="#b7aa77"/><rect x="41" y="33" width="25" height="32" rx="2" fill="#292d30" stroke="#4c5050"/><path d="M45 40h16m-16 4h10" stroke="#cccfc6"/><rect x="26" y="48" width="13" height="14" rx="1" fill="#439064"/><path d="M28 54h4m2 0h4" stroke="#dedace" stroke-width="3"/><circle cx="29" cy="40" r="2.5" fill="#be423a"/>';
  else if(type==='power')art='<rect x="10" y="28" width="60" height="46" rx="5" fill="#d5e0d1" stroke="#97ae98"/><rect x="17" y="35" width="32" height="19" rx="2" fill="#274b32"/><text x="22" y="49" fill="#bcdf9b" font-family="monospace" font-size="11">5.0</text><circle cx="58" cy="45" r="7" fill="#6c8870"/><circle cx="25" cy="64" r="4" fill="#c65445"/><circle cx="44" cy="64" r="4" fill="#3b4f3a"/>';
  else art='<rect x="13" y="24" width="53" height="49" rx="4" fill="#4d8466" stroke="#aec8a6"/><rect x="27" y="37" width="25" height="23" rx="2" fill="#294235"/><path d="M20 73v10m9-10v10m9-10v10m9-10v10m9-10v10" stroke="#c6b073" stroke-width="3"/><circle cx="20" cy="31" r="3" fill="#cbdbb8"/><circle cx="59" cy="66" r="3" fill="#c6b073"/>';
 }
 return '<svg viewBox="0 0 80 100" aria-hidden="true">'+defs+art+'</svg>';
}
export function createCatalog({onBoard,onPart,onChange,initialBOM=[],modal,toast,getBoardId}){
 const $=s=>document.querySelector(s);let tab='boards',bom=normalizeBOM(initialBOM,BOARD_CATALOG,COMPONENT_CATALOG),filterTag='',favoriteOnly=false,compare=[];let favorites=new Set();try{const saved=JSON.parse(localStorage.getItem('physical-lab-hardware-favorites')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(x=>typeof x==='string'));}catch{}const filterStates={boards:{q:'',category:'all',support:'all'},parts:{q:'',category:'all',support:'all'}};let returnFocus=null;
 const boardMap=new Map(BOARD_CATALOG.map(b=>[b.id,b])),partMap=new Map(COMPONENT_CATALOG.map(p=>[p.id,p]));
 $('#catalogSupport').closest('.catalog-filter-row').insertAdjacentHTML('afterend','<div class="catalog-filter-row catalog-mount-filter-row"><select id="catalogMountFilter" aria-label="按面包板接法筛选开发板"><option value="all">全部面包板接法</option>'+Object.entries(boardMountLabels).map(([status,label])=>'<option value="'+status+'">'+label+'</option>').join('')+'</select></div>');
 const mountFilter=$('#catalogMountFilter'),mountFilterRow=mountFilter.closest('.catalog-mount-filter-row');
 $('#catalogQuickFilters').insertAdjacentHTML('afterend','<div class="catalog-tools"><button id="catalogFavorites" class="text-button" aria-pressed="false">☆ 只看收藏</button><select id="catalogSort" aria-label="硬件排序"><option value="supported">可运行模型优先</option><option value="name">名称排序</option></select><button id="catalogReset" class="text-button">清除筛选</button></div>');
 $('.catalog-footer').insertAdjacentHTML('beforebegin','<div id="catalogCompareBar" class="catalog-compare-bar" hidden><span id="catalogCompareCount"></span><button class="button primary-light" id="catalogCompareButton">对比开发板</button><button class="text-button" id="catalogCompareClear">清空</button></div>');
 const narrowViewport=globalThis.matchMedia?.('(max-width: 760px)'),mainContent=$('#mainContent');let previousMainInert=null;
 $('#catalogResultCount').tabIndex=-1;
 $('#marketButton').setAttribute('aria-controls','catalogDrawer');
 $('.catalog-tabs').setAttribute('role','group');$('.catalog-tabs').setAttribute('aria-label','硬件目录分类');
 function focusCatalogStart(){
  if($('#catalogDrawer').hidden||$('#modal').open)return;
  const target=tab==='saved'?$('#catalogItems').querySelector('[data-bom-quantity]')||$('#catalogResultCount'):$('#catalogSearch');
  target.focus();
 }
 function syncMainInert(){
  if(!mainContent)return;
  if(narrowViewport?.matches&&!$('#catalogDrawer').hidden){
   if(previousMainInert===null)previousMainInert=Boolean(mainContent.inert);
   const moveFocus=mainContent.contains(document.activeElement);mainContent.inert=true;
   if(moveFocus)focusCatalogStart();
  }else if(previousMainInert!==null){mainContent.inert=previousMainInert;previousMainInert=null;}
 }
 if(narrowViewport?.addEventListener)narrowViewport.addEventListener('change',syncMainInert);
 else narrowViewport?.addListener?.(syncMainInert);
 const listControls=root=>[...root.querySelectorAll('button,input,select,a[href]')].filter(el=>!el.disabled&&!el.hidden);
 function captureListFocus(){
  const list=$('#catalogItems'),active=document.activeElement;if(!list.contains(active))return null;
  const rows=[...list.querySelectorAll('[data-catalog-item-key]')],row=active.closest('[data-catalog-item-key]');
  return {key:row?.dataset.catalogItemKey,rowIndex:Math.max(0,rows.indexOf(row)),controlIndex:Math.max(0,listControls(row||list).indexOf(active)),scrollTop:list.scrollTop};
 }
 function restoreListFocus(snapshot){
  if(!snapshot||$('#catalogDrawer').hidden||$('#modal').open)return;
  const list=$('#catalogItems'),rows=[...list.querySelectorAll('[data-catalog-item-key]')];
  const row=rows.find(el=>el.dataset.catalogItemKey===snapshot.key)||rows[Math.min(snapshot.rowIndex,rows.length-1)];
  const controls=listControls(row||list),target=controls[Math.min(snapshot.controlIndex,controls.length-1)]||$('#catalogResultCount');
  list.scrollTop=snapshot.scrollTop;target.focus({preventScroll:true});if(row)target.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 function favoriteKey(x,kind){return kind+':'+x.id;}
 function syncFavorite(){try{localStorage.setItem('physical-lab-hardware-favorites',JSON.stringify([...favorites]));}catch{toast('收藏暂时无法保存；当前会话仍可使用。');}}
 function resetFilters(){favoriteOnly=false;$('#catalogSearch').value='';$('#catalogCategory').value='all';$('#catalogSupport').value='all';if(tab==='boards')mountFilter.value='all';$('#catalogFavorites').setAttribute('aria-pressed','false');render();}
 function rememberFilters(){if(filterStates[tab])filterStates[tab]={q:$('#catalogSearch').value,category:$('#catalogCategory').value,support:$('#catalogSupport').value};}
 function restoreFilters(){const state=filterStates[tab]||{q:'',category:'all',support:'all'};$('#catalogSearch').value=state.q;$('#catalogCategory').value=state.category;$('#catalogSupport').value=state.support;}
 function renderSupportOptions(){
  const options=tab==='boards'
   ? [['all','全部模型与资料'],['simulate','全部可运行 3D'],...Object.entries(boardModelLabels).map(([tier,label])=>[tier,label+' ('+boardModelCounts[tier]+')'])]
   : [['all','全部支持状态'],['simulate','可运行模型'],['reference','仅资料与选型']];
  $('#catalogSupport').innerHTML=options.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');
 }

 function changed(){onChange?.();$('#bomCount').textContent=bom.reduce((n,x)=>n+x.quantity,0);}
 function open(next=tab){rememberFilters();if($('#catalogDrawer').hidden)returnFocus=document.activeElement;tab=next;$('#catalogDrawer').hidden=false;$('#marketButton').classList.add('active');$('#marketButton').setAttribute('aria-expanded','true');renderTabs();renderCategories();renderSupportOptions();restoreFilters();render();focusCatalogStart();syncMainInert();}
 function close(){rememberFilters();$('#catalogDrawer').hidden=true;$('#marketButton').classList.remove('active');$('#marketButton').setAttribute('aria-expanded','false');syncMainInert();if(returnFocus?.isConnected)returnFocus.focus();}
 function renderTabs(){document.querySelectorAll('[data-catalog-tab]').forEach(b=>{const active=b.dataset.catalogTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
 function renderCategories(){const categories=tab==='boards'?[...new Set(BOARD_CATALOG.map(x=>x.family))]:[...new Set(COMPONENT_CATALOG.map(x=>x.category))];$('#catalogCategory').innerHTML='<option value="all">'+(tab==='boards'?'全部系列':'全部类别')+'</option>'+categories.filter(Boolean).sort((a,b)=>a.localeCompare(b,'zh')).map(x=>'<option>'+esc(x)+'</option>').join('');const tags=tab==='boards'?['STM32','Arduino','ESP32','Pico','Linux']:['输入','显示','传感器','电源','驱动'];$('#catalogQuickFilters').innerHTML=tags.map(x=>`<button data-tag="${x}">${x}</button>`).join('');$('#catalogQuickFilters').querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{$('#catalogSearch').value=b.dataset.tag;$('#catalogCategory').value='all';filterTag=b.dataset.tag;render();});}
 function render(){
  const focused=captureListFocus();
  const savedView=tab==='saved';for(const el of document.querySelectorAll('.catalog-search-wrap,.catalog-filter-row,.catalog-tools,.catalog-quick'))el.hidden=savedView||(el===mountFilterRow&&tab!=='boards');$('#catalogCompareBar').hidden=!compare.length;$('#catalogCompareCount').textContent='已选 '+compare.length+' / 3 款';$('#catalogCompareButton').disabled=compare.length<2;$('#catalogFavorites').classList.toggle('active',favoriteOnly);
  $('#bomCount').textContent=bom.reduce((n,x)=>n+x.quantity,0);
  if(tab==='saved'){$('#catalogItems').innerHTML=bom.length?bom.map((b,i)=>`<div class="bom-row" data-catalog-item-key="${esc(b.kind+':'+b.id)}"><div><strong>${esc(b.name)}</strong><small>${b.kind==='board'?'开发板':'元件'} · ${(b.kind==='board'?boardSupport(boardMap.get(b.id)||{}):partSupport(partMap.get(b.id)||{}))==='simulate'?'可运行模型':'资料 / 选型记录'}</small></div><input type="number" min="1" max="99" value="${b.quantity}" aria-label="${esc(b.name)}数量" data-bom-quantity="${i}"><button class="text-button" data-remove-bom="${i}" aria-label="移除${esc(b.name)}">×</button></div>`).join(''):'<div class="empty-state">把想用的板卡和元件加入清单。<br>资料型条目也能保存，方便准备实物。</div>';$('#catalogResultCount').textContent=bom.length+' 种硬件';$('#catalogItems').querySelectorAll('[data-remove-bom]').forEach(b=>b.onclick=()=>{bom.splice(Number(b.dataset.removeBom),1);changed();render();});$('#catalogItems').querySelectorAll('[data-bom-quantity]').forEach(el=>el.onchange=()=>{const quantity=Math.max(1,Math.min(99,Math.trunc(Number(el.value))||1));bom[Number(el.dataset.bomQuantity)].quantity=quantity;el.value=String(quantity);changed();});restoreListFocus(focused);return;}
  const q=$('#catalogSearch').value.trim().toLowerCase(),category=$('#catalogCategory').value,support=$('#catalogSupport').value,items=tab==='boards'?BOARD_CATALOG:COMPONENT_CATALOG;
  const mount=tab==='boards'?mountFilter.value:'all';
  const filtered=matchHardware(items,q).filter(x=>{
   const state=tab==='boards'?boardSupport(x):partSupport(x);
   return (category==='all'||(tab==='boards'?x.family:x.category)===category)
    &&(support==='all'||state===support||tab==='boards'&&boardModelTier(x)===support)
    &&(mount==='all'||boardMountStatus(x)===mount)
    &&(!favoriteOnly||favorites.has(favoriteKey(x,tab==='boards'?'board':'part')));
  });
  if($('#catalogSort').value==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'zh'));else if(!q)filtered.sort((a,b)=>Number((tab==='boards'?boardSupport(b):partSupport(b))==='simulate')-Number((tab==='boards'?boardSupport(a):partSupport(a))==='simulate'));
  const boardSummary=' 款开发板 · 精细 3D '+boardModelCounts.detailed+' · 教学 3D '+boardModelCounts.teaching+' · 仅资料 '+boardModelCounts.reference;
  $('#catalogResultCount').textContent=filtered.length+' / '+items.length+(tab==='boards'?boardSummary:' 种元件');
  $('#catalogItems').innerHTML=filtered.length?filtered.map(x=>{const kind=tab==='boards'?'board':'part',state=kind==='board'?boardSupport(x):partSupport(x);return `<article class="hardware-card ${kind==='board'&&getBoardId()===x.profileId?'current-hardware':''}" data-catalog-item-key="${kind}:${esc(x.id)}"><div class="hardware-card-main"><button class="hardware-thumb hardware-preview-button" data-hardware-detail="${esc(x.id)}" data-kind="${kind}" aria-label="查看${esc(x.name)}详情">${hardwareThumb(x,kind)}</button><div><h3>${esc(x.name)}</h3><p class="hardware-sub">${esc(kind==='board'?[x.chip,x.logicVoltage?x.logicVoltage+' V':''].filter(Boolean).join(' · '):x.description)}</p><span class="support-label ${state}">${hardwareGeometryLabel(x,kind)}</span>${kind==='board'?mountBadge(x):''}<div class="hardware-tags">${(x.tags||x.interfaces||[]).slice(0,3).map(t=>'<span>'+esc(t)+'</span>').join('')}</div></div></div><div class="hardware-meta-row"><span>${esc(kind==='board'?x.family:x.category)}</span><button class="hardware-favorite ${favorites.has(favoriteKey(x,kind))?'active':''}" data-hardware-favorite="${esc(x.id)}" data-kind="${kind}" aria-label="${favorites.has(favoriteKey(x,kind))?'取消收藏':'收藏'}${esc(x.name)}" aria-pressed="${favorites.has(favoriteKey(x,kind))}">${favorites.has(favoriteKey(x,kind))?'★':'☆'}</button>${kind==='board'?`<label class="compare-label"><input type="checkbox" data-compare-id="${esc(x.id)}" aria-label="对比开发板：${esc(x.name)}" ${compare.includes(x.id)?'checked':''}>对比</label>`:''}</div><div class="hardware-card-actions"><button class="button ${state==='simulate'?'primary-light':''}" data-hardware-action="${esc(x.id)}" data-kind="${kind}">${state==='simulate'?(kind==='board'?(getBoardId()===x.profileId?'当前开发板':'使用这块板'):'＋ 加入实验台'):'查看资料与接线'}</button><button class="text-button" data-hardware-detail="${esc(x.id)}" data-kind="${kind}">详情</button><button class="text-button save-hardware" data-hardware-save="${esc(x.id)}" data-kind="${kind}" title="加入备料清单" aria-label="将${esc(x.name)}加入清单">＋</button></div></article>`;}).join(''):'<div class="empty-state">没有找到符合条件的硬件。<br>试试芯片名、接口名，或清除筛选。<br><button class="button" id="clearHardwareFilters">显示全部硬件</button></div>';
  $('#catalogItems').querySelectorAll('[data-hardware-action]').forEach(b=>b.onclick=()=>{const item=(b.dataset.kind==='board'?boardMap:partMap).get(b.dataset.hardwareAction),state=b.dataset.kind==='board'?boardSupport(item):partSupport(item);if(state!=='simulate'){detail(item,b.dataset.kind);return;}if(b.dataset.kind==='board'){onBoard(item.profileId,item);close();}else onPart(item.modelType,item.defaults||{},item);});
  $('#catalogItems').querySelectorAll('[data-hardware-detail]').forEach(b=>b.onclick=()=>detail((b.dataset.kind==='board'?boardMap:partMap).get(b.dataset.hardwareDetail),b.dataset.kind));
  $('#catalogItems').querySelectorAll('[data-hardware-save]').forEach(b=>b.onclick=()=>saveItem((b.dataset.kind==='board'?boardMap:partMap).get(b.dataset.hardwareSave),b.dataset.kind));
  $('#catalogItems').querySelectorAll('[data-hardware-favorite]').forEach(b=>b.onclick=()=>{const key=b.dataset.kind+':'+b.dataset.hardwareFavorite;favorites.has(key)?favorites.delete(key):favorites.add(key);syncFavorite();render();});
  $('#catalogItems').querySelectorAll('[data-compare-id]').forEach(el=>el.onchange=()=>{const id=el.dataset.compareId;if(el.checked){if(compare.length===3){el.checked=false;toast('一次最多比较3款板卡，先取消一项再添加。');return;}compare.push(id);}else compare=compare.filter(x=>x!==id);render();});
  if($('#clearHardwareFilters'))$('#clearHardwareFilters').onclick=resetFilters;
  restoreListFocus(focused);
 }
 function saveItem(item,kind){const found=bom.find(x=>x.id===item.id&&x.kind===kind);if(found)found.quantity=Math.min(99,found.quantity+1);else bom.push({id:item.id,name:item.name,kind,quantity:1,support:kind==='board'?boardSupport(item):partSupport(item),source:item.source});changed();toast('已加入备料清单：'+item.name+'。在“已选清单”中修改数量。');}
 function detail(item,kind){const state=kind==='board'?boardSupport(item):partSupport(item),profile=kind==='board'&&state==='simulate'?getBoardProfile(item.profileId):null;const mount=kind==='board'?boardMountStatus(item):null;const seating=mount==='direct'?getMountOptions(profile):null;const specs=kind==='board'?[['芯片',item.chip],['CPU',item.cpu],['频率',item.clock],['Flash',item.flash],['RAM',item.ram],['逻辑电平',item.logicVoltage?item.logicVoltage+' V':profile?profile.logicVoltage+' V（实验台设置，实物按官方资料）':'请按板卡版本、电压域与供电配置核对官方资料'],['接口',(item.interfaces||[]).join(' · ')],['适合阶段',item.difficulty]]:[['类别',item.category],['供电 / 电平',item.voltage],['引脚',(item.pins||[]).join(' · ')],['模型',item.modelType&&PARTS[item.modelType]?.model]];
  modal(item.name,`<div class="hardware-detail-header"><div class="hardware-thumb">${hardwareThumb(item,kind)}</div><div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><span class="support-label ${state}">${hardwareGeometryLabel(item,kind)}</span></div></div>${kind==='board'?'<h3>三维模型</h3><p>'+boardModelDetails[boardModelTier(item)]+'</p>':''}<dl class="hardware-specs">${specs.filter(x=>x[1]).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><h3>${kind==='board'?'适合拿来做什么':'怎么接、怎么用'}</h3><p>${esc(item.bestFor||item.guide||item.description)}</p>${mount?'<h3>面包板接法 · '+boardMountLabels[mount]+'</h3><p>'+boardMountDetails[mount]+(seating?' 当前 400 孔面包板的排孔组合：'+seating.rowPairs.map(pair=>pair.join(' / ').toUpperCase()).join('、')+'。每组 '+seating.pinCount*2+' 个排针位置。实物需装有向下的公排针。':'')+'</p>':''}${profile?'<h3>本平台支持范围</h3><p>'+esc(Object.entries({digitalIO:'数字输入输出',analogInput:'ADC模拟输入',pwm:'PWM',serialConsole:'串口',interrupts:'中断',i2c:'I²C',spi:'SPI',wifi:'Wi-Fi'}).filter(([key])=>profile.capabilities?.[key]).map(([,label])=>label).join(' · '))+'</p><p>按所选板卡的引脚与逻辑电压求解。基础实验使用源码行为模型。</p>'+(ssd1306HostPins(profile.id)?'<p>Arduino 源码与原生 AVR 固件可用 '+esc(ssd1306HostPins(profile.id).join(' / '))+' 连接 SSD1306 或 MCP9808，支持这两种器件的 I²C 事务。</p>':'')+''+(profile.capabilities.nativeFirmware?'<p>也可在实验台选择「原生固件」，加载为本板编译的 '+esc(profile.capabilities.nativeFirmware)+' 应用固件。</p>':'')+((profile.notes||[]).length?'<ul>'+profile.notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul>':'')+'':''}${item.warning?'<div class="hardware-warning">'+esc(item.warning)+'</div>':''}${profile?'<h3>引脚索引</h3><input class="pin-lookup" id="catalogPinLookup" placeholder="输入PA0、GND或排针名称…" aria-label="筛选开发板引脚"><div class="pin-index-table"><table><thead><tr><th>板上标识</th><th>电气信号</th><th>实验台端点</th></tr></thead><tbody>'+profile.pins.map(pin=>'<tr data-pin-index="'+esc([pin.id,pin.label,pin.canonical,pin.location].join(' ').toLowerCase())+'"><td>'+esc(pin.label||pin.id)+(pin.location?' <small>· '+esc(pin.location)+'</small>':'')+'</td><td>'+esc(pin.canonical)+'</td><td><code>mcu:'+esc(pin.id)+'</code></td></tr>').join('')+'</tbody></table></div>':kind==='board'?'<h3>引脚与仿真状态</h3><p>当前可查选型和官方资料。排针尚未接入实验台，请用下面的资料核对引脚。</p>':''}${kind==='part'&&state==='simulate'?'<p>同类元件共用教学封装，实物尺寸请对照产品资料。</p>':''}<h3>官方 / 作者资料</h3><div class="hardware-detail-links"><a class="button" href="${esc(safe(item.source))}" target="_blank" rel="noopener">原始产品 / 文档 ↗</a>${[...(item.docs||[]),...(profile?.sources||[]).filter(url=>url!==item.source&&!(item.docs||[]).some(doc=>doc.url===url)).map((url,index)=>({url,label:"模型参考 "+(index+1)}))].map(d=>`<a class="button" href="${esc(safe(d.url))}" target="_blank" rel="noopener">${esc(d.label)} · ${esc(d.language||'')}</a>`).join('')}</div><p class="resource-version">资料核验：${esc(item.checked_on||'2026-11-06')}。不同批次、第三方兼容板需核对实物丝印；未核实参数不补写。</p><div class="project-actions">${state==='simulate'?'<button class="button primary" id="detailAddHardware">'+(kind==='board'?'使用这块开发板':'添加到实验台')+'</button>':''}<button class="button" id="detailSaveHardware">加入备料清单</button></div>`);
  if($('#catalogPinLookup'))$('#catalogPinLookup').oninput=e=>document.querySelectorAll('[data-pin-index]').forEach(row=>row.hidden=!row.dataset.pinIndex.includes(e.target.value.toLowerCase().trim()));
  $('#detailSaveHardware').onclick=()=>saveItem(item,kind);if($('#detailAddHardware'))$('#detailAddHardware').onclick=()=>{$('#modal').close();if(kind==='board'){onBoard(item.profileId,item);close();}else onPart(item.modelType,item.defaults||{},item);};
 }
 function guide(){modal('按你想做的事情，选择硬件','<p>先确定要观察什么，再选输入、处理和输出。每张卡片都区分“可运行模型”和“资料 / 选型”。找可插在面包板上的板卡时，选择「可直插面包板」。</p><div class="ide-options">'+[['STM32','先学单片机','从 Blue Pill 的点灯、按钮、ADC 开始；配合标准外设库。'],['Arduino','快速验证控制逻辑','UNO / Nano 使用 setup、loop 和数字引脚。'],['ESP32','准备无线项目','当前模型支持基础输入输出；Wi-Fi / 蓝牙仍查官方资料并上实物验证。'],['Pico','了解 RP2040','查看 3.3V 引脚与 GPIO；当前使用 Arduino 风格教学示例。'],['传感器','采集外部信息','先辨认数字、模拟还是总线接口，再看供电和逻辑电平。'],['显示','把结果显示出来','LED / RGB / 数码管已有模型；总线屏幕按条目能力说明选用。']].map(([q,t,d])=>'<button class="ide-option" data-guide-search="'+q+'"><strong>'+t+'</strong><small>'+d+'</small></button>').join('')+'</div><h3>三步核对</h3><ol><li>接口：引脚数量和通信方式是否匹配？</li><li>电气：供电电压、逻辑电平、驱动电流是否合适？</li><li>软件：使用哪套库？当前实验台是否已经支持它？</li></ol><p>商城是可搜索的学习与选型目录，不是购买页面。可把未仿真的条目加入清单，保留官方资料入口。</p>');document.querySelectorAll('[data-guide-search]').forEach(b=>b.onclick=()=>{$('#modal').close();open(['传感器','显示'].includes(b.dataset.guideSearch)?'parts':'boards');$('#catalogSearch').value=b.dataset.guideSearch;render();});}
 $('#marketButton').onclick=()=>$('#catalogDrawer').hidden?open():close();$('#closeCatalog').onclick=close;$('#boardSelectButton').onclick=()=>open('boards');$('#addHardwareButton').onclick=()=>open('parts');document.querySelectorAll('[data-catalog-tab]').forEach(b=>b.onclick=()=>open(b.dataset.catalogTab));$('#catalogSearch').oninput=render;$('#catalogClear').onclick=()=>{$('#catalogSearch').value='';render();};$('#catalogCategory').onchange=render;$('#catalogSupport').onchange=render;$('#catalogGuideButton').onclick=guide;
 $('#catalogFavorites').onclick=()=>{favoriteOnly=!favoriteOnly;$('#catalogFavorites').setAttribute('aria-pressed',String(favoriteOnly));render();};$('#catalogReset').onclick=resetFilters;$('#catalogSort').onchange=render;$('#catalogCompareClear').onclick=()=>{compare=[];render();};
 mountFilter.onchange=render;
 $('#catalogCompareButton').onclick=()=>{const selected=compare.map(id=>boardMap.get(id));const rows=[['芯片',b=>b.chip],['CPU',b=>b.cpu],['最高频率',b=>b.clock],['Flash',b=>b.flash],['RAM',b=>b.ram],['逻辑电平',b=>b.logicVoltage?b.logicVoltage+' V':'按官方板型核对'],['适合用途',b=>b.bestFor],['硬件接口',b=>(b.interfaces||[]).join(' · ')],['本平台能力',b=>boardSupport(b)==='simulate'?'可运行已实现的源码行为模型':'资料与选型，尚未实现运行'],['三维模型',b=>boardModelLabels[boardModelTier(b)]],['面包板接法',b=>boardMountLabels[boardMountStatus(b)]],['选型注意',b=>b.warning]];modal('开发板对比 · '+selected.length+' 款','<p>接口与容量来自板卡资料；“本平台能力”单独列出，避免把芯片功能当成已经实现的仿真。</p><div class="hardware-compare-table"><table><thead><tr><th>比较项目</th>'+selected.map(b=>'<th>'+esc(b.name)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(([label,read])=>'<tr><th>'+label+'</th>'+selected.map(b=>'<td>'+esc(read(b)||'未核实')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#catalogDrawer').hidden&&!$('#modal').open){e.preventDefault();close();}});

 $('#boardCount').textContent=BOARD_CATALOG.length;$('#partCount').textContent=COMPONENT_CATALOG.length;$('#entryCatalogStats').textContent=BOARD_CATALOG.length+' 款开发板 · '+BOARD_CATALOG.filter(item=>boardSupport(item)==='simulate').length+' 款可运行 · '+COMPONENT_CATALOG.length+' 种元件';
 $('#exportBOMButton').onclick=()=>{const csv='\ufeff名称,种类,数量,支持状态,来源\r\n'+bom.map(x=>[x.name,x.kind==='board'?'开发板':'元件',x.quantity,(x.kind==='board'?boardSupport(boardMap.get(x.id)||{}):partSupport(partMap.get(x.id)||{}))==='simulate'?'可运行模型':'资料 / 选型',x.source].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='硬件备料清单.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 renderTabs();renderCategories();renderSupportOptions();render();
 return {open,close,render,guide,getBOM:()=>structuredClone(bom),setBOM:next=>{bom=normalizeBOM(next,BOARD_CATALOG,COMPONENT_CATALOG);changed();render();},findBoard:id=>BOARD_CATALOG.find(x=>x.profileId===id),counts:catalogCounts()};
}
