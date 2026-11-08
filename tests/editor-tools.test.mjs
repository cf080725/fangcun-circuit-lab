import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findTextMatches,replaceTextMatches,lineRange,mountEditorTools} from '../dist/editor-tools.js';

// Small DOM fixture for the module's own elements and standard textarea events.
// It exercises registered handlers; layout and real browser focus are checked by UI QA.
class Element extends EventTarget {
 constructor(tag,doc){super();this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes=new Map();this.value='';this.checked=false;this.hidden=false;this.selectionStart=this.selectionEnd=0;this.scrollTop=0;this.style={};this.textContent='';}
 append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 getAttribute(key){return this.attributes.get(key)??null;}
 removeAttribute(key){this.attributes.delete(key);}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
 setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.setSelectionRange(start+text.length,start+text.length);}
 focus(){this.ownerDocument.activeElement=this;this.dispatchEvent(new Event('focus'));}
 select(){this.setSelectionRange(0,this.value.length);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}
}
function fixture(text=''){
 const doc={defaultView:{Event},createElement(tag){return new Element(tag,this);}},textarea=doc.createElement('textarea'),host=doc.createElement('div');textarea.value=text;
 let navigations=[],opened=0;const api=mountEditorTools({textarea,host,onNavigate:event=>navigations.push(event),onOpen:()=>opened++});
 const key=(value,props={})=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:value,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,keyCode:0,...props});textarea.dispatchEvent(event);return event;};
 const descend=(root=host)=>[root,...root.children.flatMap(c=>descend(c))];
 return {api,textarea,host,doc,key,navigations,elements:()=>descend(),get opened(){return opened;}};
}

test('literal search escapes regular-expression syntax instead of treating it as an executable pattern',()=>{
 const text='a.b [0] (x) + $ ^ \\ aXb';
 for(const query of ['a.b','[0]','(x)','+','$','^','\\']){
  const matches=findTextMatches(text,query);assert.equal(matches.length,1,query);assert.equal(text.slice(matches[0].start,matches[0].end),query);
 }
 assert.deepEqual(findTextMatches(text,''),[]);
});

test('case and whole-identifier options retain correct Unicode and UTF-16 ranges',()=>{
 assert.equal(findTextMatches('LED led LED_PIN led2','led').length,4);
 assert.equal(findTextMatches('LED led LED_PIN led2','led',{caseSensitive:true}).length,2);
 assert.equal(findTextMatches('LED led LED_PIN led2','led',{wholeWord:true}).length,2);
 assert.equal(findTextMatches('标签标签 标签','标签',{wholeWord:true}).length,1);
 const text='😀 LED 😀 led',matches=findTextMatches(text,'😀');assert.deepEqual(matches.map(m=>[m.start,m.end]),[[0,2],[7,9]]);
 for(const hit of findTextMatches('İ i I','i'))assert.ok(['i','I'].includes('İ i I'.slice(hit.start,hit.end)));
});

test('replace-all uses original non-overlapping ranges and treats dollar replacement tokens literally',()=>{
 const result=replaceTextMatches('foo + foo','foo','$&');assert.equal(result.text,'$& + $&');assert.equal(result.count,2);
 assert.equal(replaceTextMatches('aaa','aa','aaaa').text,'aaaaa');
 assert.equal(replaceTextMatches('safe','','erase').text,'safe');
 assert.equal(replaceTextMatches('a a','a','').text,' ');
});

test('line ranges handle CRLF, trailing blank lines and invalid numbers without guessing',()=>{
 assert.deepEqual(lineRange('one\r\ntwo\r\n',2),{valid:true,line:2,lineCount:3,start:5,end:8});
 assert.deepEqual(lineRange('one\n',2),{valid:true,line:2,lineCount:2,start:4,end:4});
 for(const n of [0,-1,1.2,3,'NaN',''])assert.equal(lineRange('one\ntwo',n).valid,false,String(n));
});

test('mounted find supports selection seeding, next/previous and wrapping with exact ranges',()=>{
 const f=fixture('one two one');f.textarea.setSelectionRange(0,3);f.api.open('find');assert.equal(f.api.getState().query,'one');assert.equal(f.opened,1);
 assert.deepEqual(f.api.findNext(),{start:8,end:11,text:'one'});assert.equal(f.textarea.selectionStart,8);
 assert.equal(f.api.findNext().start,0);assert.match(f.api.getState().message,/循环/);
 assert.equal(f.api.findNext(-1).start,8);assert.equal(f.navigations.at(-1).start,8);
});

test('replace-current first finds a real match instead of replacing an arbitrary selection',()=>{
 const f=fixture('keep word keep');f.textarea.setSelectionRange(5,9);f.api.setQuery('keep').setReplacement('safe');let changes=0;f.textarea.addEventListener('input',()=>changes++);
 assert.equal(f.api.replaceCurrent().count,0);assert.equal(f.textarea.value,'keep word keep');assert.equal(changes,0);assert.equal(f.textarea.selectionStart,10);
 assert.equal(f.api.replaceCurrent().count,1);assert.equal(f.textarea.value,'keep word safe');assert.equal(changes,1);
});

test('replace-all changes only the supplied textarea and emits exactly one input event',()=>{
 const f=fixture('LED + LED'),other=fixture('LED');f.api.setQuery('LED').setReplacement('$1');let count=0;f.textarea.addEventListener('input',()=>count++);
 assert.equal(f.api.replaceAll().count,2);assert.equal(f.textarea.value,'$1 + $1');assert.equal(other.textarea.value,'LED');assert.equal(count,1);
 f.api.setQuery('');assert.equal(f.api.replaceAll().count,0);assert.equal(count,1);
});

test('navigation scrolls by the 22px row contract and reports the selected line',()=>{
 const f=fixture(Array.from({length:20},(_,i)=>'line '+(i+1)).join('\n'));let selects=0,scrolls=0;
 f.textarea.addEventListener('select',()=>selects++);f.textarea.addEventListener('scroll',()=>scrolls++);
 const target=f.api.goToLine(10);assert.equal(target.valid,true);assert.equal(f.textarea.value.slice(f.textarea.selectionStart,f.textarea.selectionEnd),'line 10');assert.equal(f.textarea.scrollTop,132);assert.equal(f.navigations.at(-1).line,10);assert.equal(selects,1);assert.equal(scrolls,1);
 assert.equal(f.api.goToLine(21).valid,false);assert.equal(f.textarea.value.slice(f.textarea.selectionStart,f.textarea.selectionEnd),'line 10');assert.match(f.api.getState().message,/1～20/);
});

test('keyboard shortcuts are editor-local and composition does not open panels',()=>{
 const f=fixture('text');assert.equal(f.key('f',{ctrlKey:true}).defaultPrevented,true);assert.equal(f.api.getState().mode,'find');
 f.key('f',{metaKey:true,altKey:true});assert.equal(f.api.getState().mode,'replace');
 f.key('g',{ctrlKey:true});assert.equal(f.api.getState().mode,'goto');f.key('Escape');assert.equal(f.api.getState().mode,null);
 f.textarea.dispatchEvent(new Event('compositionstart'));assert.equal(f.key('f',{ctrlKey:true}).defaultPrevented,false);assert.equal(f.api.getState().mode,null);f.textarea.dispatchEvent(new Event('compositionend'));
 assert.equal(f.key('f',{ctrlKey:true,isComposing:true}).defaultPrevented,false);
 f.key('h',{ctrlKey:true});assert.equal(f.api.getState().mode,'replace');
});

test('search refreshes after source edits and never acts on stale match offsets',()=>{
 const f=fixture('aaa target');f.api.open('find');f.api.setQuery('target').setReplacement('changed');f.api.findNext();
 f.textarea.value='prefix aaa target';f.textarea.setSelectionRange(4,10);f.textarea.dispatchEvent(new Event('input'));
 assert.equal(f.api.replaceCurrent().count,0);assert.equal(f.textarea.value,'prefix aaa target');assert.equal(f.textarea.selectionStart,11);
 f.api.replaceCurrent();assert.equal(f.textarea.value,'prefix aaa changed');
});

test('controls have labels, live status and visible panel state; destroy detaches shortcuts',()=>{
 const f=fixture('a');const status=f.elements().find(e=>e.getAttribute('role')==='status');assert.ok(status);assert.equal(status.getAttribute('aria-live'),'polite');
 const triggers=f.elements().filter(e=>e.tagName==='BUTTON'&&e.getAttribute('aria-controls'));assert.equal(triggers.length,3);
 f.api.open('replace');assert.equal(triggers.filter(e=>e.getAttribute('aria-expanded')==='true').length,1);assert.equal(triggers[1].getAttribute('aria-expanded'),'true');
 for(const input of f.elements().filter(e=>e.tagName==='INPUT'))assert.equal(input.parentElement.tagName,'LABEL');
 f.api.destroy();assert.equal(f.host.children.length,0);assert.equal(f.key('f',{ctrlKey:true}).defaultPrevented,false);
});

test('editor font changes keep overlay, source and gutter rows at 22px',()=>{
 const css=readFileSync(new URL('../dist/editor-tools.css',import.meta.url),'utf8');
 assert.match(css,/#codeEditor,#codeHighlight\{[^}]*font-size:14px!important;line-height:22px!important/);
 assert.match(css,/\.line-numbers>div,\.line-annotations>div\{height:22px;line-height:22px/);
 assert.match(css,/:focus-visible/);
});
