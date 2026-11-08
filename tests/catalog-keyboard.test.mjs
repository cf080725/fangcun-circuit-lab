import assert from 'node:assert/strict';
import {createCatalog} from '../dist/catalog-ui.js';
import {BOARD_CATALOG} from '../dist/catalog-data.js';

// Minimal DOM for event/focus regressions only. No layout or browser rendering claims.
let doc;
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
class Element {
 constructor(tag='div',attrs={}){this.tagName=tag.toLowerCase();this.attributes={};this.dataset={};this.children=[];this.parentElement=null;this.scrollTop=0;this._text='';for(const [k,v] of Object.entries(attrs))this.setAttribute(k,v);this.classList={add:c=>this._class(c,true),remove:c=>this._class(c,false),toggle:(c,state)=>this._class(c,state),contains:c=>(this.attributes.class||'').split(/\s+/).includes(c)};}
 _class(c,state){const set=new Set((this.attributes.class||'').split(/\s+/).filter(Boolean));if(state??!set.has(c))set.add(c);else set.delete(c);this.attributes.class=[...set].join(' ');}
 setAttribute(k,v){this.attributes[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 getAttribute(k){return this.attributes[k]??null;}
 get id(){return this.attributes.id||'';}
 get hidden(){return 'hidden' in this.attributes;} set hidden(v){if(v)this.attributes.hidden='';else delete this.attributes.hidden;}
 get inert(){return 'inert' in this.attributes;} set inert(v){if(v)this.attributes.inert='';else delete this.attributes.inert;}
 get disabled(){return 'disabled' in this.attributes;} set disabled(v){if(v)this.attributes.disabled='';else delete this.attributes.disabled;}
 get checked(){return 'checked' in this.attributes;} set checked(v){if(v)this.attributes.checked='';else delete this.attributes.checked;}
 get open(){return 'open' in this.attributes;} set open(v){if(v)this.attributes.open='';else delete this.attributes.open;}
 get value(){if(this._value!==undefined)return this._value;if(this.tagName==='select'){const options=this.querySelectorAll('option');return (options.find(x=>'selected' in x.attributes)||options[0])?.value||'';}return this.attributes.value??this._text;}
 set value(v){this._value=String(v);}
 get textContent(){return this._text;} set textContent(v){this._text=String(v);this.children=[];}
 get isConnected(){let p=this;while(p.parentElement)p=p.parentElement;return p===doc?.body;}
 append(child){child.parentElement=this;this.children.push(child);return child;}
 contains(node){return node===this||this.children.some(x=>x.contains(node));}
 matches(selector){return selector.split(',').some(raw=>{let s=raw.trim();const attr=s.match(/\[([^\]=]+)(?:="([^"]*)")?\]/);if(attr){if(!(attr[1] in this.attributes)||(attr[2]!==undefined&&this.attributes[attr[1]]!==attr[2]))return false;s=s.replace(attr[0],'');}if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return (this.attributes.class||'').split(/\s+/).includes(s.slice(1));return !s||this.tagName===s;});}
 querySelectorAll(s){const out=[];for(const child of this.children){if(child.matches(s))out.push(child);out.push(...child.querySelectorAll(s));}return out;}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 closest(s){let n=this;while(n){if(n.matches(s))return n;n=n.parentElement;}return null;}
 focus(){if(!this.isConnected||this.disabled)return;for(let p=this;p;p=p.parentElement)if(p.hidden||p.inert)return;doc.activeElement=this;}
 scrollIntoView(){this.scrolledIntoView=true;}
 set innerHTML(html){if(this.contains(doc?.activeElement))doc.activeElement=doc.body;for(const child of this.children)child.parentElement=null;this.children=[];this._value=undefined;parseInto(this,String(html));}
 insertAdjacentHTML(position,html){const temp=new Element();parseInto(temp,html);const parent=this.parentElement;let index=parent.children.indexOf(this)+(position==='afterend'?1:0);for(const child of [...temp.children]){child.parentElement=parent;parent.children.splice(index++,0,child);}}
}
function parseInto(root,html){
 const stack=[root];const voidTags=new Set(['input','br','hr','img','meta','link']);
 for(const token of html.matchAll(/<\/?[^>]+>|[^<]+/g)){
  const t=token[0];if(t.startsWith('</')){const tag=t.match(/^<\/([^\s>]+)/)?.[1]?.toLowerCase();while(stack.length>1){if(stack.pop().tagName===tag)break;}continue;}
  if(t.startsWith('<')){const m=t.match(/^<([\w-]+)/);if(!m)continue;const attrs={};for(const a of t.slice(m[0].length,-1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const el=stack.at(-1).append(new Element(m[1],attrs));if(!voidTags.has(m[1])&&!t.endsWith('/>'))stack.push(el);}
  else stack.at(-1)._text+=decode(t);
 }
}
function makeEnvironment({narrow=false,bom=[],alreadyInert=false}={}){
 doc={body:new Element('body'),activeElement:null,listeners:{},querySelector(s){return this.body.querySelector(s);},querySelectorAll(s){return this.body.querySelectorAll(s);},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}};
 globalThis.document=doc;doc.activeElement=doc.body;
 doc.body.innerHTML=`<nav><button id="marketButton">目录</button></nav><aside id="catalogDrawer" hidden><button id="closeCatalog">关闭</button><div class="catalog-tabs"><button data-catalog-tab="boards">开发板</button><button data-catalog-tab="parts">元件</button><button data-catalog-tab="saved">已选清单</button></div><div class="catalog-search-wrap"><input id="catalogSearch"><button id="catalogClear">清除</button></div><div class="catalog-filter-row"><select id="catalogCategory"><option value="all"></option></select><select id="catalogSupport"><option value="all"></option></select></div><div id="catalogQuickFilters" class="catalog-quick"></div><span id="catalogResultCount"></span><button id="catalogGuideButton">选型</button><div id="catalogItems"></div><div class="catalog-footer"><button id="exportBOMButton">导出</button></div></aside><main id="mainContent"><button id="boardSelectButton">选板</button><button id="addHardwareButton">元件</button></main><dialog id="modal"></dialog><span id="boardCount"></span><span id="partCount"></span><span id="bomCount"></span><span id="entryCatalogStats"></span>`;
 const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 const media={matches:narrow,listeners:[],addEventListener(type,fn){this.listeners.push(fn);},setMatches(value){this.matches=value;for(const fn of this.listeners)fn({matches:value});}};globalThis.matchMedia=()=>media;
 const $=s=>doc.querySelector(s);$('#mainContent').inert=alreadyInert;let changes=0;
 const api=createCatalog({onBoard(){},onPart(){},onChange(){changes++;},initialBOM:bom,modal(){},toast(){},getBoardId:()=> 'bluepill'});
 return {$,api,media,changes:()=>changes};
}
let checks=0;
function check(name,run){run();checks++;console.log('PASS',name);}
const savedBoards=BOARD_CATALOG.slice(0,3).map(b=>({id:b.id,kind:'board',quantity:1}));
check('favorite redraw keeps the same board control focused',()=>{
 const {$,api}=makeEnvironment();api.open();const old=$('[data-hardware-favorite]'),id=old.dataset.hardwareFavorite;old.focus();old.onclick();assert.equal(doc.activeElement.dataset.hardwareFavorite,id);assert.notEqual(doc.activeElement,old);assert.equal(doc.activeElement.getAttribute('aria-pressed'),'true');
});
check('unfavorite in a filtered shelf moves to the next item, then its visible empty-state action',()=>{
 const {$,api}=makeEnvironment();api.open();let favorites=doc.querySelectorAll('[data-hardware-favorite]');const ids=favorites.slice(0,2).map(x=>x.dataset.hardwareFavorite);for(const id of ids){const b=$(`[data-hardware-favorite="${id}"]`);b.focus();b.onclick();}$('#catalogFavorites').focus();$('#catalogFavorites').onclick();let b=$(`[data-hardware-favorite="${ids[0]}"]`);b.focus();b.onclick();assert.equal(doc.activeElement.dataset.hardwareFavorite,ids[1]);doc.activeElement.onclick();assert.equal(doc.activeElement.id,'clearHardwareFilters');assert.equal(doc.activeElement.isConnected,true);
});
check('comparison redraw retains the same board and names the checkbox',()=>{
 const {$,api}=makeEnvironment();api.open();const old=$('[data-compare-id]'),id=old.dataset.compareId;old.focus();old.checked=true;old.onchange();assert.equal(doc.activeElement.dataset.compareId,id);assert.equal(doc.activeElement.checked,true);assert.notEqual(doc.activeElement,old);assert.equal(doc.activeElement.getAttribute('aria-label'),'对比开发板：'+BOARD_CATALOG.find(b=>b.id===id).name);
});
check('saved tab focuses the first quantity, and quantity changes retain the actual input node',()=>{
 const {$,api,changes}=makeEnvironment({bom:savedBoards});api.open('saved');const input=$('[data-bom-quantity]');assert.equal(doc.activeElement,input);input.value='150';input.onchange();assert.equal(doc.activeElement,input);assert.equal(input.isConnected,true);assert.equal(input.value,'99');assert.equal(api.getBOM()[0].quantity,99);assert.equal(changes(),1);assert.equal($('.catalog-search-wrap').hidden,true);
});
check('BOM redraw restores the same stable item after reordering',()=>{
 const {$,api}=makeEnvironment({bom:savedBoards});api.open('saved');const input=doc.querySelectorAll('[data-bom-quantity]')[1],key=input.closest('[data-catalog-item-key]').dataset.catalogItemKey;input.focus();api.setBOM([...savedBoards].reverse());assert.equal(doc.activeElement.closest('[data-catalog-item-key]').dataset.catalogItemKey,key);assert.notEqual(doc.activeElement,input);
});
check('BOM removal moves focus to the neighboring remove button and final count',()=>{
 const {$,api}=makeEnvironment({bom:savedBoards.slice(0,2)});api.open('saved');const remove=$('[data-remove-bom]');remove.focus();remove.onclick();assert.equal(doc.activeElement.dataset.removeBom,'0');assert.equal(doc.activeElement.closest('[data-catalog-item-key]').dataset.catalogItemKey,'board:'+savedBoards[1].id);doc.activeElement.onclick();assert.equal(doc.activeElement,$('#catalogResultCount'));assert.equal(api.getBOM().length,0);
});
check('empty saved drawer reopens with a visible focus target',()=>{
 const {$,api}=makeEnvironment();$('#marketButton').focus();api.open('saved');assert.equal(doc.activeElement,$('#catalogResultCount'));api.close();assert.equal(doc.activeElement,$('#marketButton'));api.open();assert.equal(doc.activeElement,$('#catalogResultCount'));assert.equal(doc.activeElement.tabIndex,-1);
});
check('narrow drawer blocks main controls and close restores inert before returning focus',()=>{
 const {$,api}=makeEnvironment({narrow:true});$('#boardSelectButton').focus();api.open();assert.equal($('#mainContent').inert,true);$('#boardSelectButton').focus();assert.equal(doc.activeElement,$('#catalogSearch'));api.close();assert.equal($('#mainContent').inert,false);assert.equal(doc.activeElement,$('#boardSelectButton'));
});
check('crossing the mobile breakpoint blocks/restores main and moves hidden background focus',()=>{
 const {$,api,media}=makeEnvironment();api.open();assert.equal($('#mainContent').inert,false);$('#addHardwareButton').focus();media.setMatches(true);assert.equal($('#mainContent').inert,true);assert.equal(doc.activeElement,$('#catalogSearch'));media.setMatches(false);assert.equal($('#mainContent').inert,false);api.close();media.setMatches(true);assert.equal($('#mainContent').inert,false);
});
check('an existing inert state survives the catalog lifecycle',()=>{
 const {$,api,media}=makeEnvironment({narrow:true,alreadyInert:true});$('#marketButton').focus();api.open();media.setMatches(false);assert.equal($('#mainContent').inert,true);media.setMatches(true);api.close();assert.equal($('#mainContent').inert,true);assert.equal(doc.activeElement,$('#marketButton'));
});
check('classification buttons expose exactly one selected state',()=>{
 const {$,api}=makeEnvironment();api.open('parts');const tabs=doc.querySelectorAll('[data-catalog-tab]');assert.equal(tabs.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);assert.equal(tabs.find(b=>b.getAttribute('aria-pressed')==='true').dataset.catalogTab,'parts');assert.equal($('.catalog-tabs').getAttribute('role'),'group');assert.equal($('#marketButton').getAttribute('aria-controls'),'catalogDrawer');
});
check('board connection filter groups compatible models and keeps board-only state',()=>{
 const {$,api}=makeEnvironment();api.open('boards');
 const filter=$('#catalogMountFilter'),row=$('.catalog-mount-filter-row');
 const cards=()=>$('#catalogItems').querySelectorAll('[data-catalog-item-key]');
 const keys=()=>cards().map(card=>card.dataset.catalogItemKey);
 const choose=value=>{filter.value=value;filter.onchange();};
 filter.focus();choose('direct');
 assert.equal(doc.activeElement,filter);
 for(const id of ['bluepill','esp32-s3-devkitc','esp32-c6-devkitc','esp32-h2-devkitm']){
  assert.ok(keys().includes('board:'+id),id);
 }
 assert.ok(cards().every(card=>card.querySelector('[data-mount-status="direct"]')));
 $('#catalogSearch').value='Blue Pill';$('#catalogSearch').oninput();
 assert.deepEqual(keys(),['board:bluepill']);
 $('#catalogClear').onclick();
 choose('jumper');
 assert.ok(keys().includes('board:uno-r3'));
 assert.ok(cards().every(card=>card.querySelector('[data-mount-status="jumper"]')));
 choose('reference');
 assert.deepEqual(keys().sort(),BOARD_CATALOG.filter(board=>!board.profileId).map(board=>'board:'+board.id).sort());
 assert.ok(cards().every(card=>card.querySelector('.support-label')?.textContent==='仅资料 · 无实验台模型'));
 api.open('parts');assert.equal(row.hidden,true);assert.ok(keys().every(key=>key.startsWith('part:')));
 api.open('saved');assert.equal(row.hidden,true);
 api.open('boards');assert.equal(row.hidden,false);assert.equal(filter.value,'reference');
 $('#catalogReset').onclick();assert.equal(filter.value,'all');assert.equal(cards().length,BOARD_CATALOG.length);
});
check('model tier filters separate detailed, teaching and reference boards without replacing part filters',()=>{
 const {$,api}=makeEnvironment();api.open('boards');
 const support=$('#catalogSupport');
 const cards=()=>$('#catalogItems').querySelectorAll('[data-catalog-item-key]');
 const choose=value=>{support.value=value;support.onchange();};
 assert.match($('#catalogResultCount').textContent,/精细 3D 9 · 教学 3D 43 · 仅资料 4/);
 choose('detailed');
 assert.equal(cards().length,9);
 assert.ok(cards().every(card=>card.querySelector('.support-label').textContent.startsWith('精细 3D')));
 choose('teaching');
 assert.equal(cards().length,43);
 assert.ok(cards().every(card=>card.querySelector('.support-label').textContent.startsWith('教学 3D')));
 choose('reference');
 assert.equal(cards().length,4);
 assert.ok(cards().every(card=>card.querySelector('.support-label').textContent==='仅资料 · 无实验台模型'));
 api.open('parts');
 assert.equal(support.querySelector('option[value="teaching"]'),null);
 choose('simulate');
 assert.ok(cards().length&&cards().every(card=>card.querySelector('.support-label').classList.contains('simulate')));
 api.open('boards');
 assert.equal(support.value,'reference');
 assert.equal(cards().length,4);
});
check('Escape still closes the drawer and returns focus',()=>{
 const {$,api}=makeEnvironment({narrow:true});$('#marketButton').focus();api.open();let prevented=false;for(const fn of doc.listeners.keydown||[])fn({key:'Escape',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal($('#catalogDrawer').hidden,true);assert.equal($('#mainContent').inert,false);assert.equal(doc.activeElement,$('#marketButton'));
});
console.log(`${checks} keyboard/state regression checks passed. Browser layout verification remains with the parent.`);
