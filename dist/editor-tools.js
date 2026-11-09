/* Standalone textarea tools. No app globals, storage, uploads or compiler access. */
const escapePattern=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const identifierChar=char=>!!char&&/[\p{L}\p{N}_]/u.test(char);
const beforeChar=(text,index)=>Array.from(text.slice(Math.max(0,index-2),index)).at(-1)||'';
const afterChar=(text,index)=>Array.from(text.slice(index,index+2))[0]||'';

/** Literal, non-overlapping UTF-16 ranges, matching textarea selection offsets. */
export function findTextMatches(text,query,{caseSensitive=false,wholeWord=false}={}){
 text=String(text??'');query=String(query??'');if(!query)return [];
 const expression=new RegExp(escapePattern(query),'gu'+(caseSensitive?'':'i')),matches=[];
 for(const hit of text.matchAll(expression)){
  const start=hit.index,end=start+hit[0].length;
  if(wholeWord&&(identifierChar(beforeChar(text,start))||identifierChar(afterChar(text,end))))continue;
  matches.push({start,end,text:hit[0]});
 }
 return matches;
}
export function replaceTextMatches(text,query,replacement,options={}){
 text=String(text??'');replacement=String(replacement??'');const matches=findTextMatches(text,query,options);
 let result='',cursor=0;for(const m of matches){result+=text.slice(cursor,m.start)+replacement;cursor=m.end;}result+=text.slice(cursor);
 return {text:result,count:matches.length,matches};
}
export function lineRange(text,line){
 text=String(text??'');const lines=text.split('\n'),requested=Number(line);
 if(!Number.isInteger(requested)||requested<1||requested>lines.length)return {valid:false,lineCount:lines.length,message:`请输入 1～${lines.length} 之间的整数行号。`};
 let start=0;for(let i=0;i<requested-1;i++)start+=lines[i].length+1;
 const length=lines[requested-1].replace(/\r$/,'').length;
 return {valid:true,line:requested,lineCount:lines.length,start,end:start+length};
}
let toolCounter=0;
function dispatch(textarea,type){const EventClass=textarea.ownerDocument?.defaultView?.Event||globalThis.Event;textarea.dispatchEvent(new EventClass(type,{bubbles:true}));}

/**
 * mountEditorTools({textarea,host,onNavigate?,onOpen?,lineHeight=22})
 * host is a dedicated empty container above/below the editor. All code changes
 * emit one bubbling input event; selection/scroll events announce navigation.
 */
export function mountEditorTools({textarea,host,onNavigate,onOpen,lineHeight=22}={}){
 if(!textarea)throw new Error('查找工具需要 textarea。');
 const doc=textarea.ownerDocument||globalThis.document;
 if(!doc?.createElement)throw new Error('查找工具需要 DOM 文档。');
 const parent=host||textarea.parentElement;if(!parent)throw new Error('查找工具需要挂载位置。');
 const uid='editor-tools-'+(++toolCounter),listeners=[];let mode=null,composing=false,lastText=textarea.value,lastQuery='',lastOptions='',lastMatch=null;
 const create=(tag,className,text)=>{const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
 const attr=(el,name,value)=>el.setAttribute(name,String(value));
 const listen=(el,event,handler,options)=>{const config=typeof options==='boolean'?{capture:options}:options;el.addEventListener(event,handler,config);listeners.push(()=>el.removeEventListener(event,handler,config));};
 const root=create('section','editor-tools');attr(root,'aria-label','代码查找与定位');
 const bar=create('div','editor-tools-bar'),panel=create('div','editor-tools-panel');panel.id=uid+'-panel';panel.hidden=true;
 const button=(text,action)=>{const b=create('button','editor-tool-button',text);b.type='button';listen(b,'click',action);return b;};
 const triggers={};for(const [key,label,shortcut] of [['find','查找','Ctrl / ⌘ F'],['replace','替换','Ctrl H / ⌘ ⌥ F'],['goto','跳行','Ctrl / ⌘ G']]){
  const b=button(label,()=>open(key));b.title=label+' · '+shortcut;attr(b,'aria-controls',panel.id);attr(b,'aria-expanded','false');bar.append(b);triggers[key]=b;
 }
 const keyboardHelp=create('span','editor-tools-shortcuts','Tab 缩进 · Shift+Tab 退缩进 · Esc 后 Tab 离开代码');bar.append(keyboardHelp);
 const searchRow=create('div','editor-tools-row'),replaceRow=create('div','editor-tools-row'),gotoRow=create('div','editor-tools-row'),optionsRow=create('div','editor-tools-options');
 function inputField(label,type='text'){
  const wrapper=create('label','editor-tools-field'),caption=create('span','',label),input=create('input');input.type=type;input.autocomplete='off';input.spellcheck=false;input.id=uid+'-'+(label==='查找内容'?'query':label==='替换成'?'replacement':'line');caption.textContent=label;wrapper.append(caption,input);return {wrapper,input};
 }
 const q=inputField('查找内容'),replacement=inputField('替换成'),line=inputField('行号','number');q.input.placeholder='按字面匹配当前文件';replacement.input.placeholder='留空表示删除';line.input.min='1';line.input.step='1';
 const previous=button('上一处',()=>findNext(-1)),next=button('下一处',()=>findNext(1)),replace=button('替换此处',()=>replaceCurrent()),all=button('全部替换',()=>replaceAll()),jump=button('前往',()=>goToLine(line.input.value));
 previous.title='上一处 · Shift+Enter / Shift+F3';next.title='下一处 · Enter / F3';
 searchRow.append(q.wrapper,previous,next);replaceRow.append(replacement.wrapper,replace,all);gotoRow.append(line.wrapper,jump);
 function checkbox(label){const wrapper=create('label','editor-tools-check'),input=create('input');input.type='checkbox';wrapper.append(input,create('span','',label));return {wrapper,input};}
 const caseBox=checkbox('区分大小写'),wordBox=checkbox('完整标识符');optionsRow.append(caseBox.wrapper,wordBox.wrapper);
 const status=create('output','editor-tools-status');status.id=uid+'-status';attr(status,'role','status');attr(status,'aria-live','polite');attr(status,'aria-atomic','true');attr(q.input,'aria-describedby',status.id);attr(line.input,'aria-describedby',status.id);
 const closeButton=button('关闭',()=>close());closeButton.className+=' editor-tools-close';closeButton.title='关闭工具 · Esc';
 panel.append(searchRow,replaceRow,gotoRow,optionsRow,status,closeButton);root.append(bar,panel);parent.append(root);
 const options=()=>({caseSensitive:caseBox.input.checked,wholeWord:wordBox.input.checked});
 const announce=text=>{status.textContent=text;};
 function matches(){return findTextMatches(textarea.value,q.input.value,options());}
 function invalidate(){const config=JSON.stringify(options());if(lastText!==textarea.value||lastQuery!==q.input.value||lastOptions!==config){lastMatch=null;lastText=textarea.value;lastQuery=q.input.value;lastOptions=config;}}
 function refresh(){
  invalidate();line.input.max=String(textarea.value.split('\n').length);
  if(mode==='goto'){announce(`当前文件共 ${line.input.max} 行。`);return;}
  const found=matches();previous.disabled=next.disabled=all.disabled=replace.disabled=!found.length;
  if(!q.input.value)announce('输入查找内容；空内容不会替换。');
  else if(!found.length)announce('没有找到匹配项。');
  else {const current=found.findIndex(m=>m.start===textarea.selectionStart&&m.end===textarea.selectionEnd);announce(current>=0?`第 ${current+1} / ${found.length} 处。`:`找到 ${found.length} 处。替换仅作用于当前文件。`);}
 }
 function navigate(match,{focusEditor=false}={}){
  textarea.setSelectionRange(match.start,match.end);
  const before=textarea.value.slice(0,match.start),lines=before.split('\n'),row=lines.length;
  if(focusEditor)textarea.focus({preventScroll:true});
  textarea.scrollTop=Math.max(0,(row-4)*lineHeight);
  const style=doc.defaultView?.getComputedStyle?.(textarea);
  const measure=style&&doc.createElement('canvas').getContext?.('2d');
  if(measure&&textarea.clientWidth){
   measure.font=`${style.fontSize} ${style.fontFamily}`;
   const tabSize=Number.parseInt(style.tabSize,10)||4;
   const tabWidth=measure.measureText(' '.repeat(tabSize)).width;
   let left=0;
   for(const [index,segment] of lines.at(-1).split('\t').entries()){
    if(index&&tabWidth)left=(Math.floor(left/tabWidth)+1)*tabWidth;
    left+=measure.measureText(segment).width;
   }
   const selected=textarea.value.slice(match.start,match.end).split(/[\n\t]/,1)[0];
   const right=left+measure.measureText(selected).width;
   const padding=(Number.parseFloat(style.paddingLeft)||0)+(Number.parseFloat(style.paddingRight)||0);
   const available=Math.max(1,textarea.clientWidth-padding);
   if(left<textarea.scrollLeft)textarea.scrollLeft=Math.max(0,left-12);
   else if(right>textarea.scrollLeft+available)textarea.scrollLeft=Math.min(left,Math.max(0,right-available+12));
  }
  dispatch(textarea,'select');dispatch(textarea,'scroll');onNavigate?.({line:row,start:match.start,end:match.end});
 }
 function open(nextMode='find'){
  if(!Object.hasOwn(triggers,nextMode))nextMode='find';const selected=textarea.value.slice(textarea.selectionStart,textarea.selectionEnd);
  onOpen?.();mode=nextMode;panel.hidden=false;
  searchRow.hidden=optionsRow.hidden=nextMode==='goto';replaceRow.hidden=nextMode!=='replace';gotoRow.hidden=nextMode!=='goto';
  for(const [key,b] of Object.entries(triggers))attr(b,'aria-expanded',key===nextMode);
  if(nextMode==='goto')line.input.value=String(textarea.value.slice(0,textarea.selectionStart).split('\n').length);
  else if(selected&&!/[\r\n]/.test(selected)){q.input.value=selected;lastMatch=null;}
  refresh();const field=nextMode==='goto'?line.input:q.input;field.focus();field.select?.();return api;
 }
 function close(){mode=null;panel.hidden=true;for(const b of Object.values(triggers))attr(b,'aria-expanded','false');textarea.focus();return api;}
 function findNext(direction=1){
  invalidate();const found=matches();if(!found.length){refresh();return null;}
  const start=textarea.selectionStart,end=textarea.selectionEnd,current=found.findIndex(m=>m.start===start&&m.end===end);
  let index;if(direction<0){index=current>=0?current-1:found.findLastIndex(m=>m.end<=start);if(index<0)index=found.length-1;}
  else{index=current>=0?current+1:found.findIndex(m=>m.start>=end);if(index<0||index>=found.length)index=0;}
  const match=found[index];navigate(match);lastMatch=match;announce(`第 ${index+1} / ${found.length} 处${direction<0&&index===found.length-1||direction>0&&index===0&&current===found.length-1?'，已循环到另一端':''}。`);return match;
 }
 function change(text,start,end,selectionStart,selectionEnd){
  textarea.setRangeText(text,start,end,'end');textarea.setSelectionRange(selectionStart,selectionEnd);dispatch(textarea,'input');lastText=textarea.value;lastMatch=null;
 }
 function replaceCurrent(){
  invalidate();const found=matches(),match=found.find(m=>m.start===textarea.selectionStart&&m.end===textarea.selectionEnd);
  if(!match){findNext(1);if(found.length)announce('已选中匹配项；再次按“替换此处”才会修改。');return {count:0};}
  const text=replacement.input.value;change(text,match.start,match.end,match.start+text.length,match.start+text.length);findNext(1);announce(`已替换 1 处；剩余 ${matches().length} 处匹配。`);return {count:1};
 }
 function replaceAll(){
  const result=replaceTextMatches(textarea.value,q.input.value,replacement.input.value,options());
  if(!result.count){refresh();return {count:0};}
  const start=result.matches[0].start,end=start+replacement.input.value.length;change(result.text,0,textarea.value.length,start,end);navigate({start,end});announce(`已替换 ${result.count} 处；仅修改当前文件。`);return {count:result.count};
 }
 function goToLine(value){
  const target=lineRange(textarea.value,value);if(!target.valid){announce(target.message);attr(line.input,'aria-invalid','true');line.input.focus();return target;}
  line.input.removeAttribute('aria-invalid');navigate(target,{focusEditor:true});announce(`已定位到第 ${target.line} 行，共 ${target.lineCount} 行。`);return target;
 }
 listen(q.input,'input',refresh);listen(caseBox.input,'change',refresh);listen(wordBox.input,'change',refresh);listen(textarea,'input',()=>{if(mode)refresh();});
 listen(root,'compositionstart',()=>{composing=true;});listen(root,'compositionend',()=>{composing=false;});
 listen(textarea,'compositionstart',()=>{composing=true;});listen(textarea,'compositionend',()=>{composing=false;});
 listen(root,'keydown',event=>{
  if(composing||event.isComposing||event.keyCode===229)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
  else if(event.key==='F3'&&q.input.value){event.preventDefault();event.stopPropagation();findNext(event.shiftKey?-1:1);}
  else if(event.key==='Enter'&&event.target?.tagName==='INPUT'){
   event.preventDefault();event.stopPropagation();if(mode==='goto')goToLine(line.input.value);else if(event.target===replacement.input)replaceCurrent();else findNext(event.shiftKey?-1:1);
  }
 });
 listen(textarea,'keydown',event=>{
  if(composing||event.isComposing||event.keyCode===229)return;const key=event.key.toLowerCase(),command=event.ctrlKey||event.metaKey;
  if(command&&((key==='f'&&!event.shiftKey)||(key==='h'&&event.ctrlKey)||(key==='g'&&!event.altKey))){
   event.preventDefault();event.stopImmediatePropagation();open(key==='g'?'goto':key==='h'||event.altKey?'replace':'find');
  }else if(event.key==='F3'){event.preventDefault();event.stopImmediatePropagation();if(!q.input.value)open('find');else findNext(event.shiftKey?-1:1);}
  else if(event.key==='Escape'&&mode){event.preventDefault();event.stopImmediatePropagation();close();}
 },true);
 const api={element:root,open,close,refresh,findNext,replaceCurrent,replaceAll,goToLine,
  setQuery(value,config={}){q.input.value=String(value??'');if('caseSensitive' in config)caseBox.input.checked=!!config.caseSensitive;if('wholeWord' in config)wordBox.input.checked=!!config.wholeWord;refresh();return api;},
  setReplacement(value){replacement.input.value=String(value??'');return api;},
  destroy(){for(const remove of listeners)remove();root.remove();},
  getState(){return {mode,query:q.input.value,replacement:replacement.input.value,matches:matches(),message:status.textContent};}
 };
 refresh();return api;
}
