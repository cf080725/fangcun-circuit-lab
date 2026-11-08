import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourcePath,validateSources,decodeSourceBytes,validateCircuit,validateAvrFirmware,encodeProjectUf2,parseProjectUf2,parseLabProject,readImportSelection} from '../dist/project-import.js';
import {stm32BinToHex} from '../dist/stm32-firmware-image.js';
import {createCircuit,makePart} from '../dist/circuit.js';
import {BOARD_PROFILE_LIST,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {mountedConnections} from '../dist/breadboard-mount.js';
import {exportProject} from '../dist/project-export.js';
import {examples} from '../dist/content.js';
import '../dist/vendor/jszip.min.js';
import {validateZipArchive} from '../dist/zip-validation.js';
const JSZip=globalThis.JSZip;
const zipFile=bytes=>({name:'project.zip',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const zipBytes=async(entries,options={})=>{const zip=new JSZip();for(const [name,text] of entries)zip.file(name,text,{createFolders:false});return zip.generateAsync({type:'uint8array',...options});};
const importZip=bytes=>readImportSelection([zipFile(bytes)],{loadZip:data=>JSZip.loadAsync(data)});
const project=()=>({format:'physical-lab',version:2,files:{'main.c':'int main(void) {}'},circuit:createCircuit('blink'),exampleId:'blink',activeFile:'main.c'});
const fakeFile=(name,text)=>({name,size:new TextEncoder().encode(text).length,text:async()=>text,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
test('all existing presets and board starters survive circuit validation without topology changes',()=>{for(const ex of examples){const c=createCircuit(ex.circuitPreset),v=validateCircuit(c);assert.deepEqual(v.wires,c.wires);}for(const p of BOARD_PROFILE_LIST)for(const kind of ['blink','button','adc','pwm']){const c=makeBoardStarter(p.id,kind).circuit;assert.equal(validateCircuit(c).boardId,p.id);}});
test('malformed paths and aliases cannot overwrite one another',()=>{for(const p of ['../a.c','/a.c','C:\\a.c','a//x.c','a/./b.c','x.txt','a\u0000.c'])assert.throws(()=>sourcePath(p));assert.equal(sourcePath('User\\主程序.c'),'User/主程序.c');assert.throws(()=>validateSources([['a.c','one'],['A.c','two']]),/重复/);});
test('source limits apply across all files and BOM/newlines are normalized',()=>{assert.deepEqual(validateSources([['main.c','\uFEFFa\r\nb\r']]),{'main.c':'a\nb\n'});assert.throws(()=>validateSources([]));assert.throws(()=>validateSources([['x.c','x'.repeat(250001)]]));assert.throws(()=>validateSources(Array.from({length:201},(_,i)=>[i+'.c',''])));assert.throws(()=>validateSources([['x.c','a\0b']]));});
test('legacy Keil GBK text decodes with explicit warning instead of replacement characters',()=>{const r=decodeSourceBytes(new Uint8Array([0xD6,0xD0,0xCE,0xC4]),'main.c');assert.equal(r.text,'中文');assert.match(r.warning,/GB18030/);assert.equal(decodeSourceBytes(new TextEncoder().encode('中文')).warning,null);});
test('wire endpoints, ids, duplicates and same-pin loops are rejected',()=>{for(const mutate of [c=>c.wires[0].b='missing:1',c=>c.wires[0].a='mcu:NOT_A_PIN',c=>c.wires[0].b=c.wires[0].a,c=>c.wires[1].id=c.wires[0].id,c=>c.wires.push({...c.wires[0],id:'another'})]){const c=createCircuit();mutate(c);assert.throws(()=>validateCircuit(c));}});
test('deliberate short circuit remains available for fault teaching',()=>{const c=createCircuit();c.wires.push({id:'faultshort',a:'mcu:3V3',b:'mcu:GND1'});assert.equal(validateCircuit(c).wires.length,4);});
test('numeric fields reject NaN, infinity and unsupported positions without mutating source',()=>{for(const change of [c=>c.components[0].x=Infinity,c=>c.components[1].resistance=-1,c=>c.components.push({...makePart('pot','pot2'),position:3}),c=>c.components[0].id='mcu']){const c=createCircuit();change(c);const before=structuredClone(c);assert.throws(()=>validateCircuit(c));assert.deepEqual(c,before);}});
test('JSON validation is transactional, supports v1 and ignores untrusted metadata structure',()=>{const p=project(),before=structuredClone(p);assert.equal(parseLabProject(p).activeFile,'main.c');assert.deepEqual(p,before);p.files={};assert.throws(()=>parseLabProject(p),/源码/);const old=project();old.version=1;delete old.circuit.boardId;assert.equal(parseLabProject(old).circuit.boardId,'bluepill');assert.throws(()=>parseLabProject('{broken'),/JSON/);});

test('explicit STM32 C projects restore C and header drafts, previous firmware and circuit from JSON and ZIP',async()=>{
 for(const boardId of ['bluepill','nucleo-f103rb']){
  const p=project();
  p.circuit=makeBoardStarter(boardId,'blink',{externalLed:true}).circuit;
  p.exampleId='imported:'+boardId+':native';
  p.exampleMeta={title:'我的原生工程',execution:'stm32-c',nativeOnly:true,unknown:'discarded'};
  p.files={'inc/pins.h':'#define PIN 13\n','src/logic.c':'int main(void) { invalid draft }\n'};
  p.activeFile='inc/pins.h';
  p.stm32Firmware={name:'previous.hex',hex:readFileSync(new URL('../dist/firmware/'+boardId+'/blink.hex',import.meta.url),'utf8'),active:true};
  const serialized=JSON.stringify(p);
  const {project:fromJson}=await readImportSelection([fakeFile('native.json',serialized)]);
  const {project:fromZip}=await importZip(await zipBytes([['physical-lab-circuit.json',serialized]]));
  for(const restored of [fromJson,fromZip]){
   assert.equal(restored.exampleMeta.execution,'stm32-c');
   assert.equal(restored.exampleMeta.title,'我的原生工程');
   assert.equal(Object.hasOwn(restored.exampleMeta,'nativeOnly'),false);
   assert.equal(Object.hasOwn(restored.exampleMeta,'unknown'),false);
   assert.deepEqual(restored.files,p.files);
   assert.equal(restored.activeFile,p.activeFile);
   assert.deepEqual(restored.circuit,p.circuit);
   assert.deepEqual(restored.stm32Firmware,p.stm32Firmware);
  }
  delete p.stm32Firmware;
  delete p.activeFile;
  p.files['src/logic.c']='';
  const emptyDraft=parseLabProject(p);
  assert.equal(emptyDraft.exampleMeta.execution,'stm32-c');
  assert.equal(emptyDraft.activeFile,'src/logic.c');
  assert.equal(emptyDraft.files['src/logic.c'],'');
  assert.equal(Object.hasOwn(emptyDraft,'stm32Firmware'),false);
 }
});

test('ordinary or incompatible imports cannot select the STM32 C editor',async()=>{
 const p=project(),marked={...p,exampleMeta:{execution:'stm32-c'}};
 const cases=[p,{...p,execution:'stm32-c'},{...p,exampleMeta:Object.create({execution:'stm32-c'})},
  {...p,exampleMeta:{execution:['stm32-c']}},{...p,exampleMeta:{execution:'STM32-C'}},
  {...marked,circuit:makeBoardStarter('uno-r3','blink').circuit},
  {...marked,circuit:makeBoardStarter('nucleo-f401re','blink').circuit},
  {...marked,files:{'pins.h':'#define LED 13\n'}},
  {...marked,files:{...p.files,'settings.hpp':'// C++ header'}},
  {...marked,files:{...p.files,'sketch.ino':'void setup() {}'}},
 ];
 for(const input of cases)assert.equal(Object.hasOwn(parseLabProject(input).exampleMeta,'execution'),false);
 const loose=await readImportSelection([fakeFile('main.c',p.files['main.c'])]);
 const zipped=await importZip(await zipBytes([['main.c',p.files['main.c']]]));
 for(const sourceOnly of [loose,zipped]){
  assert.deepEqual(sourceOnly.files,p.files);
  assert.equal(Object.hasOwn(sourceOnly,'project'),false);
 }
});

test('nondefault board rows survive project JSON and both IDE circuit backups',async()=>{
 const p=project();
 p.circuit=createCircuit('board-insertion');
 p.circuit.board.rotation=35;
 p.circuit.board.mount={column:6,rotation:90,rows:['d','h']};
 const serialized=JSON.stringify(p);
 const {project:fromZip}=await importZip(await zipBytes([['physical-lab-circuit.json',serialized]]));
 const exported=exportProject({files:p.files,circuit:p.circuit,boardId:p.circuit.boardId});
 const metadata=JSON.parse(exported.files['导出说明.json']);
 const backup=JSON.parse(exported.files[metadata.generatedFiles.circuit]);
 for(const circuit of [parseLabProject(serialized).circuit,fromZip.circuit,validateCircuit(backup.circuit)]){
  assert.deepEqual(circuit,p.circuit);
  const contacts=mountedConnections(circuit,getBoardProfile(circuit.boardId));
  assert.deepEqual(contacts.find(({a})=>a==='mcu:PA0'),{a:'mcu:PA0',b:'bb:d21'});
  assert.deepEqual(contacts.find(({a})=>a==='mcu:GND1'),{a:'mcu:GND1',b:'bb:h24'});
 }
 assert.notEqual(parseLabProject(p).circuit.board.mount.rows,p.circuit.board.mount.rows);
});

test('legacy board mounts keep the exact old hole mapping and omit explicit default rows',()=>{
 const p=project();
 p.circuit.board.mount={column:6,rotation:90};
 for(const version of [1,2]){
  const legacy=structuredClone(p);
  legacy.version=version;
  if(version===1)delete legacy.circuit.boardId;
  const restored=parseLabProject(JSON.stringify(legacy)).circuit;
  assert.deepEqual(restored.board.mount,p.circuit.board.mount);
  const contacts=mountedConnections(restored,getBoardProfile(restored.boardId));
  assert.deepEqual(contacts.find(({a})=>a==='mcu:PA0'),{a:'mcu:PA0',b:'bb:c21'});
  assert.deepEqual(contacts.find(({a})=>a==='mcu:GND1'),{a:'mcu:GND1',b:'bb:g24'});
 }
 p.circuit.board.mount.rows=['c','g'];
 assert.deepEqual(parseLabProject(p).circuit.board.mount,{column:6,rotation:90});
 assert.deepEqual(p.circuit.board.mount.rows,['c','g']);
});

test('import rejects malformed or physically incompatible board row pairs without editing the input',()=>{
 const p=project();
 for(const rows of [null,'d/h',[],['d'],['D','H'],['h','d'],['d','i'],['d','h','i'],['d','h '],['p','n']]){
  p.circuit.board.mount={column:6,rotation:90,rows};
  const before=structuredClone(p);
  assert.throws(()=>parseLabProject(p),/开发板插装位置无效/);
  assert.deepEqual(p,before);
 }
});
const avrFirmware={name:'点灯.ino.HEX',hex:':040000000C94340028\r\n:00000001FF\r\n',active:true};
const megaFirmware={name:'Mega.ino.hex',hex:':040000000C94340028\r\n:020000040001F9\r\n:02123400A55AB9\r\n:00000001FF\r\n',active:true};
test('UNO, classic Nano and Mega firmware survive project JSON and IDE backup roundtrips',async()=>{
 const p=project();
 for(const boardId of ['uno-r3','nano','mega2560']){
  p.circuit=makeBoardStarter(boardId,'blink').circuit;
  for(const active of [true,false]){
   p.avrFirmware={...(boardId==='mega2560'?megaFirmware:avrFirmware),active};
   const serialized=JSON.stringify(p);
   assert.deepEqual(parseLabProject(serialized).avrFirmware,p.avrFirmware);
   const restored=await importZip(await zipBytes([['physical-lab-circuit.json',serialized]]));
   assert.equal(restored.project.circuit.boardId,boardId);
   assert.deepEqual(restored.project.avrFirmware,p.avrFirmware);
   assert.deepEqual(restored.project.files,p.files);
   assert.deepEqual(restored.project.circuit.wires,p.circuit.wires);
  }
 }
 assert.equal(Object.hasOwn(parseLabProject(project()),'avrFirmware'),false);
});
test('project firmware validation requires a supported AVR board, safe names, valid bytes and an explicit mode',()=>{
 const p=project();
 p.avrFirmware=avrFirmware;
 assert.throws(()=>parseLabProject(p),/UNO R3/);
 for(const {id} of BOARD_PROFILE_LIST){
  if(['uno-r3','nano','mega2560'].includes(id))continue;
  assert.throws(()=>validateAvrFirmware(avrFirmware,id),/UNO R3.*经典 Arduino Nano.*Mega 2560/,id);
 }
 for(const id of ['uno-r3','nano'])assert.throws(()=>validateAvrFirmware(megaFirmware,id),/32 KiB Flash/,id);
 p.circuit=makeBoardStarter('uno-r3','blink').circuit;
 for(const name of ['../blink.hex','C:\\blink.hex','x/y.hex','CON.hex','COM².hex','bad\u0000.hex','bad\u202e.hex','blink.elf','.hex',' blink.hex']){
  assert.throws(()=>validateAvrFirmware({...avrFirmware,name},'uno-r3'),/文件名/);
 }
 assert.throws(()=>validateAvrFirmware({...avrFirmware,active:'false'},'uno-r3'),/固件信息/);
 assert.throws(()=>validateAvrFirmware(null,'uno-r3'),/固件信息/);
 p.avrFirmware={...avrFirmware,hex:avrFirmware.hex.replace('0028','0027')};
 const before=structuredClone(p);
 assert.throws(()=>parseLabProject(p),/校验和/);
 assert.deepEqual(p,before);
 assert.deepEqual(validateAvrFirmware({...avrFirmware,extra:'discarded'},'uno-r3'),avrFirmware);
});
test('Blue Pill HEX and BIN firmware persist in project JSON and IDE backup without replacing source or wiring',async()=>{
 const hex=readFileSync(new URL('../dist/firmware/bluepill/blink.hex',import.meta.url),'utf8');
 const binary=readFileSync(new URL('../dist/firmware/bluepill/blink.bin',import.meta.url));
 const p=project();
 for(const descriptor of [{name:'blink.hex',hex,active:true},{name:'blink.bin',hex:stm32BinToHex(binary),active:false}]){
  p.stm32Firmware=descriptor;
  const raw=JSON.stringify(p);
  const fromJson=parseLabProject(raw);
  const {project:fromZip}=await importZip(await zipBytes([['physical-lab-circuit.json',raw]]));
  for(const restored of [fromJson,fromZip]){
   assert.deepEqual(restored.stm32Firmware,descriptor);
   assert.deepEqual(restored.files,p.files);
   assert.deepEqual(restored.circuit.wires,p.circuit.wires);
   assert.equal(Object.hasOwn(restored,'avrFirmware'),false);
  }
 }
 p.circuit=makeBoardStarter('uno-r3','blink').circuit;
 assert.throws(()=>parseLabProject(p),/Blue Pill/);
});
test('NUCLEO-F103RB project restores 128 KiB STM32 firmware and releases the on-board button',async()=>{
 const p=project();
 p.circuit=makeBoardStarter('nucleo-f103rb','blink').circuit;
 p.circuit.board.userButtonPressed=true;
 const sample=readFileSync(new URL('../dist/firmware/nucleo-f103rb/blink.bin',import.meta.url));
 const image=new Uint8Array(128*1024).fill(0xff);
 image.set(sample);
 image[image.length-1]=0;
 p.stm32Firmware={name:'nucleo.bin',hex:stm32BinToHex(image,'nucleo-f103rb'),active:true};
 const raw=JSON.stringify(p);
 const {project:fromZip}=await importZip(await zipBytes([['physical-lab-circuit.json',raw]]));
 for(const restored of [parseLabProject(raw),fromZip]){
  assert.deepEqual(restored.stm32Firmware,p.stm32Firmware);
  assert.equal(restored.circuit.boardId,'nucleo-f103rb');
  assert.ok(!restored.circuit.board.userButtonPressed);
  assert.deepEqual(restored.files,p.files);
 }
 assert.throws(()=>parseLabProject({...p,circuit:project().circuit}),/Flash/);
});
test('Pico UF2 retains exact bytes and execution choice through JSON and IDE backups',async()=>{
 const p=project();
 p.circuit=makeBoardStarter('pico','button').circuit;
 const bytes=new Uint8Array(readFileSync(new URL('../dist/firmware/pico/button.uf2',import.meta.url)));
 for(const active of [true,false]){
  p.rp2040Firmware={name:'按键.uf2',uf2:encodeProjectUf2(bytes),active};
  const text=JSON.stringify(p);
  const {project:fromZip}=await importZip(await zipBytes([['physical-lab-circuit.json',text]]));
  for(const restored of [parseLabProject(text),fromZip]){
   assert.deepEqual(restored.rp2040Firmware,p.rp2040Firmware);
   assert.deepEqual(parseProjectUf2(restored.rp2040Firmware.uf2).bytes,bytes);
   assert.deepEqual(restored.files,p.files);
   assert.deepEqual(restored.circuit.wires,p.circuit.wires);
  }
 }
 assert.throws(()=>parseLabProject({...p,rp2040Firmware:{...p.rp2040Firmware,uf2:'?'}}),/解码/);
 assert.throws(()=>parseLabProject({...p,circuit:makeBoardStarter('pico-w','blink').circuit}),/经典 Raspberry Pi Pico/);
});
test('object visibility, lock and rotation survive JSON and IDE backup roundtrips',async()=>{
 const p=project(),part=p.circuit.components[0];
 Object.assign(part,{hidden:true,locked:false,rotation:270});
 Object.assign(p.circuit.components[1],{locked:true,hidden:false});
 const text=JSON.stringify(p),restore=parseLabProject(text);
 assert.deepEqual(restore.circuit.components,p.circuit.components);
 const {project:fromZip}=await importZip(await zipBytes([['physical-lab-circuit.json',text],['User/main.c','duplicate']]));
 assert.deepEqual(fromZip.circuit.components,p.circuit.components);
 assert.deepEqual(fromZip.circuit.wires,p.circuit.wires);
 assert.deepEqual(fromZip.files,p.files);
 const legacy=parseLabProject(project());
 assert.equal(Object.hasOwn(legacy.circuit.components[0],'hidden'),false);
 assert.equal(Object.hasOwn(legacy.circuit.components[0],'locked'),false);
});
test('untrusted object flags cannot be coerced into a lock or a hidden component',()=>{
 for(const key of ['hidden','locked'])for(const value of ['false',1,null,{}]){
  const p=project();
  p.circuit.components[0][key]=value;
  const before=structuredClone(p);
  assert.throws(()=>parseLabProject(p),new RegExp(key+' .*布尔值'));
  assert.deepEqual(p,before);
 }
});
test('a restored momentary key starts released while latched switches keep their position',()=>{
 const p=project();
 p.circuit.components.push({...makePart('button','held'),pressed:true},{...makePart('switch','latched'),closed:true});
 const restored=parseLabProject(p).circuit.components;
 assert.equal(restored.find(part=>part.id==='held').pressed,false);
 assert.equal(restored.find(part=>part.id==='latched').closed,true);
 assert.equal(p.circuit.components.find(part=>part.id==='held').pressed,true);
});
test('multiple selected sources are validated together and size bypass is rejected',async()=>{await assert.rejects(readImportSelection([fakeFile('a.c','a'),fakeFile('A.c','b')]),/重复/);await assert.rejects(readImportSelection([fakeFile('a.c','x'.repeat(250001))]),/250,000/);await assert.rejects(readImportSelection([fakeFile('x.json','{}'),fakeFile('a.c','a')]),/单独/);});
test('IDE ZIP roundtrip uses project backup rather than compiling duplicate annotated sources',async()=>{const p=project(),data=await zipBytes([['User/main.c','other code'],['白话注释副本/main.c','copy'],['physical-lab-circuit.json',JSON.stringify(p)]]);const r=await importZip(data);assert.deepEqual(r.project.files,p.files);assert.deepEqual(r.project.circuit.wires,p.circuit.wires);assert.match(r.warnings[0],/不会重复/);});

test('ordinary real JSZip STORE, DEFLATE and streamed descriptors keep all UTF-8 source files',async()=>{
 for(const options of [{compression:'STORE'},{compression:'DEFLATE'},{compression:'DEFLATE',streamFiles:true}]){
  const zip=new JSZip();zip.folder('User');zip.file('User/main.c','int main(void){}');zip.file('User/中文.h','// 中文头文件');
  const data=await zip.generateAsync({type:'uint8array',...options}),result=await importZip(data);assert.deepEqual(result.files,{'User/main.c':'int main(void){}','User/中文.h':'// 中文头文件'});
 }
});

test('unsafe path collisions are rejected before real JSZip can collapse either entry order',async()=>{
 for(const entries of [[['main.c','FIRST'],['../main.c','SECOND']],[['../main.c','SECOND'],['main.c','FIRST']]]){
  const bytes=await zipBytes(entries),legacy=await JSZip.loadAsync(bytes);assert.equal(Object.keys(legacy.files).length,1,'prove current vendor folds the raw names');
  let loaded=0;await assert.rejects(readImportSelection([zipFile(bytes)],{loadZip:data=>{loaded++;return JSZip.loadAsync(data);}}),/原始条目路径/);assert.equal(loaded,0);
 }
});

test('exact duplicate central-directory filenames are rejected in either data order',async()=>{
 for(const entries of [[['a.c','FIRST'],['b.c','SECOND']],[['b.c','SECOND'],['a.c','FIRST']]]){
  const bytes=await zipBytes(entries),manifest=validateZipArchive(bytes),secondName=manifest.entries.find(e=>e.name==='b.c');
  bytes[secondName.centralOffset+46]='a'.charCodeAt(0);bytes[secondName.localOffset+30]='a'.charCodeAt(0);
  const legacy=await JSZip.loadAsync(bytes);assert.deepEqual(Object.keys(legacy.files),['a.c']);assert.equal(await legacy.files['a.c'].async('string'),entries.at(-1)[1]);
  let loaded=0;await assert.rejects(readImportSelection([zipFile(bytes)],{loadZip:data=>{loaded++;return JSZip.loadAsync(data);}}),/重复/);assert.equal(loaded,0);
 }
});

test('ZIP filenames are checked for case, NFC, separator and file-directory collisions before loading',async()=>{
 for(const entries of [
  [['main.c','a'],['MAIN.C','b']],
  [['résumé.c','a'],['re\u0301sume\u0301.c','b']],
  [['User/main.c','a'],['User\\main.c','b']],
  [['lib.h','a'],['lib.h/main.c','b']],
  [['lib.h/main.c','b'],['lib.h','a']]
 ])await assert.rejects(importZip(await zipBytes(entries)),/撞名|文件和目录/);
 for(const name of ['/main.c','./main.c','User//main.c','User/../main.c','C:\\main.c','bad\u0000.c'])await assert.rejects(importZip(await zipBytes([[name,'text']])),/路径不安全/);
});

test('central-directory offsets, lengths, name lengths and local name mismatches fail before decompression',async()=>{
 const original=await zipBytes([['main.c','int x;']]),manifest=validateZipArchive(original),entry=manifest.entries[0];
 const changes=[
  (v,b)=>v.setUint32(manifest.endOffset+12,manifest.directorySize+1,true),
  (v,b)=>v.setUint32(manifest.endOffset+16,manifest.directoryOffset+1,true),
  (v,b)=>v.setUint16(entry.centralOffset+28,0xffff,true),
  (v,b)=>v.setUint32(entry.centralOffset+42,manifest.directoryOffset+1,true),
  (v,b)=>{b[entry.localOffset+30]='x'.charCodeAt(0);},
  (v,b)=>v.setUint32(entry.centralOffset+20,0xfffffffe,true)
 ];
 for(const change of changes){const data=original.slice(),view=new DataView(data.buffer);change(view,data);await assert.rejects(importZip(data),/ZIP 检查失败/);}
 await assert.rejects(importZip(original.slice(0,-3)),/目录结尾/);
});

test('ZIP64, split archives, encryption and ambiguous filename encodings are explicitly unsupported',async()=>{
 const original=await zipBytes([['main.c','int x;']]),manifest=validateZipArchive(original),entry=manifest.entries[0];
 const changed=mutate=>{const data=original.slice();mutate(new DataView(data.buffer),data);return data;};
 await assert.rejects(importZip(changed(v=>v.setUint16(manifest.endOffset+10,0xffff,true))),/ZIP64/);
 await assert.rejects(importZip(changed(v=>v.setUint16(manifest.endOffset+4,1,true))),/多盘|分卷/);
 await assert.rejects(importZip(changed(v=>v.setUint16(entry.centralOffset+8,1,true))),/加密/);
 await assert.rejects(importZip(changed((v,b)=>{b[entry.centralOffset+46]=0x81;b[entry.localOffset+30]=0x81;})),/编码.*UTF-8/);
 await assert.rejects(importZip(changed((v,b)=>{v.setUint16(entry.centralOffset+8,0x0800,true);v.setUint16(entry.localOffset+6,0x0800,true);b[entry.centralOffset+46]=0xc0;b[entry.localOffset+30]=0xc0;})),/无效 UTF-8/);
});

test('post-load original-name verification and source CRC prevent loader changes or damaged source',async()=>{
 const data=await zipBytes([['main.c','int x;']]);
 await assert.rejects(readImportSelection([zipFile(data)],{loadZip:async bytes=>{const zip=await JSZip.loadAsync(bytes);zip.files['main.c'].unsafeOriginalName='../main.c';return zip;}}),/改写了原始文件名/);
 await assert.rejects(readImportSelection([zipFile(data)],{loadZip:async bytes=>{const zip=await JSZip.loadAsync(bytes);delete zip.files['main.c'];return zip;}}),/文件数量改变/);
 const corrupted=data.slice(),entry=validateZipArchive(corrupted).entries[0];corrupted[entry.payloadOffset]^=1;await assert.rejects(importZip(corrupted),/CRC校验失败/);
});

test('generated-name project backups restore; multiple backups are rejected without picking one',async()=>{
 const p=project();const bytes=await zipBytes([['physical-lab-circuit.generated-1.json',JSON.stringify(p)],['User/main.c','int different;']]);assert.deepEqual((await importZip(bytes)).project.files,p.files);
 const two=await zipBytes([['physical-lab-circuit.json',JSON.stringify(p)],['physical-lab-circuit.generated-1.json',JSON.stringify(p)]]);await assert.rejects(importZip(two),/多个工程/);
});

test('motor zero-coupling and zero-damping combination is rejected before workspace application',()=>{
 const c=createCircuit('onboard');c.components=[{...makePart('motor','motor1'),backEmf:0,friction:0}];const before=structuredClone(c);assert.throws(()=>validateCircuit(c),/不能同时为 0/);assert.deepEqual(c,before);
 c.components[0].friction=.000002;assert.equal(validateCircuit(c).components[0].backEmf,0);
 c.components[0].friction=0;c.components[0].backEmf=.0016;assert.equal(validateCircuit(c).components[0].friction,0);
});
