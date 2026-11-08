import {getBoardProfile} from './board-profiles.js';
import {isDipSwitchMask,PARTS} from './circuit.js';
import {getMountOptions,normalizeBoardMount} from './breadboard-mount.js';
import {evaluatePartMount} from './part-mount.js';
import {pdvPhotocellModel} from './pdv-photocell.js';
import {validateZipArchive,verifyLoadedZip,verifyZipEntryData} from './zip-validation.js';
import {AVR_FLASH_BYTES,AVR_MEGA_FLASH_BYTES,parseAvrHex} from './avr-firmware-hex.js';
import {STM32_FLASH_BASE,getStm32FirmwareTarget,parseStm32Hex} from './stm32-firmware-image.js';
import {RP2040_UF2_MAX_BYTES,parseRp2040Uf2} from './rp2040-firmware-image.js';

const LIMITS={count:200,file:250000,total:3000000,components:80,wires:400,projectBackupBytes:12*1024*1024};
const AVR_FLASH_BY_MCU={ATmega328P:AVR_FLASH_BYTES,ATmega2560:AVR_MEGA_FLASH_BYTES};
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw new Error(message);};
export function sourcePath(raw){
 const path=String(raw).normalize('NFC').replace(/\\/g,'/');
 if(!path||path.length>220||path.startsWith('/')||/[\x00-\x1f<>:"|?*]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'||/[ .]$/.test(p))||! /\.(c|h|cpp|hpp|ino)$/i.test(path))fail('源文件名应为工程内的 .c/.h/.cpp/.hpp/.ino 相对路径：'+raw);
 return path;
}
export function validateSources(entries){
 if(!Array.isArray(entries)||!entries.length)fail('没有找到源码。请选择至少一个 .c/.h/.cpp/.hpp/.ino 文件。');
 if(entries.length>LIMITS.count)fail('源码超过 200 个文件。请只导入一个实验所需的用户源文件。');
 const out={},seen=new Set();let total=0;
 for(const [raw,text] of entries){const path=sourcePath(raw),key=path.toLowerCase();if(seen.has(key))fail('文件路径重复或仅大小写不同：'+path+'。请重新命名后导入，避免覆盖。');seen.add(key);
  if(typeof text!=='string')fail(path+' 的内容不是文本。');
  const clean=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(clean.includes('\u0000'))fail(path+' 含二进制空字节，不能按 C 源码导入。');
  if(clean.length>LIMITS.file)fail(path+' 超过 250,000 字符。请精简到本实验的用户源文件。');
  total+=clean.length;if(total>LIMITS.total)fail('全部源码超过 3,000,000 字符。请不要把整套课程或开发库一起导入。');
  Object.defineProperty(out,path,{value:clean,enumerable:true,writable:true,configurable:true});
 }
 return out;
}
export function decodeSourceBytes(bytes,name='源文件'){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(data.byteLength>1000000)fail(name+' 的文本体积过大，请先精简。');
 try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(data),warning:null};}
 catch{try{return {text:new TextDecoder('gb18030',{fatal:true}).decode(data),warning:name+' 按 GB18030/GBK 兼容编码读取，后续导出为 UTF-8。'};}catch{fail(name+' 的文字编码无法识别。请在原编辑器中另存为 UTF-8 后导入。');}}
}
function finite(value,label,min,max,def){if(value===undefined)return def;const n=Number(value);if(value===null||value===''||!Number.isFinite(n)||n<min||n>max)fail(label+' 必须在 '+min+'～'+max+' 之间。');return n;}
function position(raw,defaults,label){if(raw===undefined)return {...defaults};if(!record(raw))fail(label+'位置格式不正确。');return {x:finite(raw.x,label+' X',-30,30,defaults.x),z:finite(raw.z,label+' Z',-20,20,defaults.z)};}
function boardPosition(raw,profile){
 const board=position(raw,{x:-5,z:0},'开发板');
 if(raw?.rotation!==undefined)board.rotation=finite(raw.rotation,'开发板旋转角度',-36000,36000,0);
 if(raw?.mount!==undefined){
  const mount=record(raw.mount)?normalizeBoardMount(raw.mount,getMountOptions(profile)):null;
  if(!mount)fail('开发板插装位置无效，或板型不支持在当前面包板上插装。请检查列号、朝向和排针所在的两排。');
  board.mount=mount;
 }
 return board;
}
export function validateCircuit(input){
 if(!record(input)||!Array.isArray(input.components)||!Array.isArray(input.wires)||input.components.length>LIMITS.components||input.wires.length>LIMITS.wires)fail('电路格式不正确，或超过 80 个元件 / 400 根导线的学习范围。');
 const profile=getBoardProfile(input.boardId||'bluepill'),seen=new Set(['mcu','bb','breadboard']);
 const components=input.components.map(raw=>{if(!record(raw)||!Object.hasOwn(PARTS,raw.type)||typeof raw.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(raw.id)||seen.has(raw.id))fail('元件类型未知、编号重复或编号无效：'+String(raw?.id));seen.add(raw.id);
  const model=PARTS[raw.type],p={...structuredClone(model.defaults),id:raw.id,type:raw.type,...position(raw,{x:2,z:0},raw.id),rotation:finite(raw.rotation,raw.id+'旋转角度',-36000,36000,0)};
  if(p.type==='dipswitch'&&raw.switchMask!==undefined&&!isDipSwitchMask(raw.switchMask))fail(raw.id+' · 拨码状态必须是 0～15 的整数。');
  for(const key of ['hidden','locked']){
   if(raw[key]===undefined)continue;
   if(typeof raw[key]!=='boolean')fail(raw.id+' · '+key+' 必须是布尔值。');
   p[key]=raw[key];
  }
  for(const [key,def] of Object.entries(model.defaults)){if(raw[key]===undefined)continue;if(typeof def==='number')p[key]=finite(raw[key],raw.id+' · '+key,-1e9,1e9,def);else if(typeof def==='boolean'){if(typeof raw[key]!=='boolean')fail(raw.id+' · '+key+' 必须是布尔值。');p[key]=raw[key];}else p[key]=String(raw[key]);}
  for(const spec of model.parameters||[]){if(raw[spec.key]===undefined)continue;if(spec.type==='boolean'){if(typeof raw[spec.key]!=='boolean')fail(raw.id+' · '+spec.key+' 必须是布尔值。');p[spec.key]=raw[spec.key];}else if(spec.type==='select'){if(!spec.options.includes(raw[spec.key]))fail(raw.id+' · '+spec.label+' 选项无效。');p[spec.key]=raw[spec.key];}else p[spec.key]=finite(raw[spec.key],raw.id+' · '+spec.label,spec.min,spec.max,p[spec.key]);}
  for(const key of ['resistance','capacitance','maxMa'])if(key in p&&!(p[key]>0))fail(raw.id+' 的 '+key+' 必须大于 0。');
  if(p.type==='pot')p.position=finite(p.position,raw.id+'旋钮位置',0,1,.5);
  // A momentary key may have been held when the project was captured.
  // Loading cannot restore the pointer or keyboard gesture that releases it.
  if(p.type==='button')p.pressed=false;
  if(p.type==='power')p.voltage=finite(p.voltage,raw.id+'电压',0,24,5);
  if(p.type==='servo')p.angle=finite(p.angle,raw.id+'角度',0,180,90);
  if(p.type==='led'&&!['red','green','blue','yellow','white'].includes(p.color))fail(raw.id+' 的 LED 颜色无效。');
  if(p.type==='ldr'&&raw.ldrModel!==undefined){
   if(raw.ldrModel!==pdvPhotocellModel&&raw.ldrModel!=='generic')fail(raw.id+' 的光敏电阻型号无效。');
   if(raw.ldrModel===pdvPhotocellModel){
    if(raw.ldrCovered!==undefined&&typeof raw.ldrCovered!=='boolean')fail(raw.id+' · 遮光状态必须是布尔值。');
    p.ldrModel=pdvPhotocellModel;
    p.ldrCovered=raw.ldrCovered??false;
   }
  }
  if(p.type==='thermistor')p.nominalTemperature=finite(p.nominalTemperature,raw.id+'标称温度',-100,150,25);if(p.type==='motor'){for(const k of ['backEmf','friction'])p[k]=finite(p[k],raw.id+' · '+k,0,1,p[k]);if(p.backEmf===0&&p.friction===0)fail(raw.id+' 的反电势系数与阻尼不能同时为 0；当前电机模型未实现这个极限组合。');}
  if(raw.mount!==undefined){
   if(!record(raw.mount))fail(raw.id+' 的元件插装格式无效。');
   p.mount={hole:raw.mount.hole,rotation:raw.mount.rotation};
  }
  if(raw.catalogId!==undefined)p.catalogId=String(raw.catalogId).slice(0,100);if(raw.displayName!==undefined)p.displayName=String(raw.displayName).slice(0,120);return p;
 });
 const parts=new Map(components.map(p=>[p.id,p]));
 const endpointOK=value=>{if(typeof value!=='string')return false;const i=value.indexOf(':'),id=value.slice(0,i),pin=value.slice(i+1);if(i<1||!pin||pin.includes(':'))return false;if(id==='mcu')return Object.hasOwn(profile.pinAliases,pin);if(id==='bb')return /^([a-j]([1-9]|[12]\d|30)|[pn]([1-9]|[1-4]\d|50))$/.test(pin);return PARTS[parts.get(id)?.type]?.pins.includes(pin)||false;};
 const pairs=new Set();const wires=input.wires.map((w,i)=>{if(!record(w)||typeof w.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(w.id)||seen.has(w.id))fail('第 '+(i+1)+' 根导线编号无效或重复。');seen.add(w.id);if(!endpointOK(w.a)||!endpointOK(w.b))fail('导线 '+w.id+' 指向不存在的引脚：'+String(w.a)+' → '+String(w.b)+'。请检查板型和元件编号。');if(w.a===w.b)fail('导线 '+w.id+' 的两端是同一个引脚。');const pair=[w.a,w.b].sort().join('|');if(pairs.has(pair))fail('重复连接：'+w.a+' → '+w.b+'。');pairs.add(pair);return {id:w.id,a:w.a,b:w.b,color:/^#[\da-fA-F]{3,8}$/.test(w.color||'')?w.color:'#df7651'};});
 for(const key of ['powered','boot0'])if(input[key]!==undefined&&typeof input[key]!=='boolean')fail(key+' 必须是布尔值。');
 const circuit={version:2,boardId:profile.id,powered:input.powered??true,boot0:input.boot0??false,board:boardPosition(input.board,profile),breadboard:position(input.breadboard,{x:1.8,z:0},'面包板'),components,wires};
 for(const part of components){
  if(!part.mount)continue;
  const placement=evaluatePartMount(circuit,profile,part,part.mount);
  if(!placement.ok)fail(part.id+' 的元件插装无效。'+placement.reason);
 }
 return circuit;
}
function firmwareName(value,extension,label){
 if(!record(value)||typeof value.name!=='string'||typeof value.active!=='boolean')fail(label+'固件信息无效。');
 const name=value.name.normalize('NFC');
 if(name.length<5||name.length>160||name!==name.trim()||/[\/\\<>:"|?*\p{Cc}\p{Cf}]/u.test(name)||name.startsWith('.')||/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])\./i.test(name)||!extension.test(name)){
  fail(label+'固件文件名无效。请使用支持的扩展名并去掉路径。');
 }
 return name;
}
export function validateAvrFirmware(value,boardId){
 if(value===undefined)return undefined;
 const profile=getBoardProfile(boardId);
 const flashBytes=AVR_FLASH_BY_MCU[profile.mcu];
 if(!profile.capabilities?.nativeFirmware||!flashBytes||profile.coreClockHz!==16000000||profile.flashBytes!==flashBytes){
  fail('Arduino AVR 固件支持 Arduino UNO R3、经典 Arduino Nano 和 Arduino Mega 2560 Rev3（16 MHz）。');
 }
 const name=firmwareName(value,/\.hex$/i,'Arduino AVR ');
 parseAvrHex(value.hex,{flashBytes});
 return {name,hex:value.hex,active:value.active};
}
export function validateStm32Firmware(value,boardId){
 if(value===undefined)return undefined;
 if(!getStm32FirmwareTarget(boardId))fail('STM32 原生固件支持 Blue Pill STM32F103C8T6 和 NUCLEO-F103RB。');
 const name=firmwareName(value,/\.(hex|bin)$/i,'STM32 ');
 const image=parseStm32Hex(value.hex,boardId);
 if(/\.bin$/i.test(name)&&image.byteCount!==image.highestAddress-STM32_FLASH_BASE+1){
  fail('BIN 固件备份必须包含从 Flash 起始地址开始的连续字节。');
 }
 return {name,hex:value.hex,active:value.active};
}
export function encodeProjectUf2(bytes){
 const chunks=[];
 for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return btoa(chunks.join(''));
}
export function parseProjectUf2(value){
 if(typeof value!=='string'||!value.length||value.length>4*Math.ceil(RP2040_UF2_MAX_BYTES/3)){
  fail('工程中的 UF2 数据格式无效或超过 4 MiB。');
 }
 let binary;
 try{binary=atob(value);}catch{fail('工程中的 UF2 数据无法解码。');}
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);
 return parseRp2040Uf2(bytes);
}
export function validateRp2040Firmware(value,boardId){
 if(value===undefined)return undefined;
 if(boardId!=='pico')fail('RP2040 原生固件当前支持经典 Raspberry Pi Pico。');
 const name=firmwareName(value,/\.uf2$/i,'RP2040 ');
 parseProjectUf2(value.uf2);
 return {name,uf2:value.uf2,active:value.active};
}
export function parseLabProject(raw){
 let p;try{p=typeof raw==='string'?JSON.parse(raw.replace(/^\uFEFF/,'')):raw;}catch{fail('JSON 结构无法读取。请导入“保存工程”生成的原始文件，不要粘贴聊天文字。');}
 if(!record(p)||![1,2].includes(p.version)||(p.format&&p.format!=='physical-lab')||!record(p.files))fail('这不是本平台支持的实验工程 JSON（版本 1 或 2）。');
 const files=validateSources(Object.entries(p.files)),circuit=validateCircuit(p.circuit),meta=record(p.exampleMeta)?p.exampleMeta:{};
 const paths=Object.keys(files),main=paths.find(path=>/(^|\/)main\.c$/i.test(path));
 const cSource=main??paths.find(path=>/\.c$/i.test(path));
 const nativeC=Object.hasOwn(meta,'execution')&&meta.execution==='stm32-c'&&
  Boolean(getStm32FirmwareTarget(circuit.boardId)&&cSource&&paths.every(path=>/\.[ch]$/i.test(path)));
 const exampleMeta={title:String(meta.title||'导入的工程').slice(0,140),shortTitle:String(meta.shortTitle||'导入工程').slice(0,60),description:String(meta.description||'你的用户源码与接线').slice(0,1000)};
 if(nativeC)exampleMeta.execution='stm32-c';
 const activeFile=Object.hasOwn(files,p.activeFile)?p.activeFile:(nativeC?cSource:main??paths[0]);
 const project={files,circuit,exampleId:typeof p.exampleId==='string'?p.exampleId:'imported',exampleMeta,activeFile,bom:Array.isArray(p.bom)?structuredClone(p.bom):[]};
 const firmware=validateAvrFirmware(p.avrFirmware,circuit.boardId);
 if(firmware)project.avrFirmware=firmware;
 const stm32Firmware=validateStm32Firmware(p.stm32Firmware,circuit.boardId);
 if(stm32Firmware)project.stm32Firmware=stm32Firmware;
 const rp2040Firmware=validateRp2040Firmware(p.rp2040Firmware,circuit.boardId);
 if(rp2040Firmware)project.rp2040Firmware=rp2040Firmware;
 return project;
}
export async function readImportSelection(incoming,{loadZip}={}){
 if(!incoming?.length)fail('请选择要导入的工程。');
 if(incoming.length>LIMITS.count)fail('一次最多选择 200 个文件。');
 if(incoming.some(f=>f.size>35*1024*1024))fail('单个导入文件请小于 35 MB。课程 PDF 请在资料库打开。');
 if(incoming.some(f=>/\.(hex|bin|uf2)$/i.test(f.name)))fail('请单独选择一个固件文件进入预检，支持 HEX、STM32 BIN 或 Pico UF2。也可以导入实验工程或用户源文件。');
 if(incoming.some(f=>/\.elf$/i.test(f.name)))fail('请先把 ELF 导出为对应板型的 HEX、BIN 或 UF2。');
 const jsons=incoming.filter(f=>/\.json$/i.test(f.name));
 if(jsons.length){if(incoming.length!==1)fail('实验工程 JSON 请单独导入；它已包含源码与接线。');return {project:parseLabProject(await jsons[0].text()),warnings:[],origin:jsons[0].name};}
 const entries=[],warnings=[];let totalChars=0;
 const addSource=(name,decoded)=>{if(decoded.text.length>LIMITS.file)fail(name+' 超过 250,000 字符。请精简到本实验的用户源文件。');totalChars+=decoded.text.length;if(totalChars>LIMITS.total)fail('全部源码超过 3,000,000 字符。请只导入当前实验。');entries.push([name,decoded.text]);if(decoded.warning)warnings.push(decoded.warning);};
 for(const file of incoming){
  if(/\.zip$/i.test(file.name)){
   if(!loadZip)fail('ZIP 读取器尚未就绪，请刷新后重试。');
   if(typeof file.arrayBuffer!=='function')fail('无法读取 ZIP 原始字节，请重新选择本地文件。');
   const archiveBytes=new Uint8Array(await file.arrayBuffer()),manifest=validateZipArchive(archiveBytes);
   // Preflight runs before JSZip can sanitize ../ names or merge duplicate keys.
   const zip=await loadZip(archiveBytes),verified=verifyLoadedZip(zip,manifest),items=manifest.entries.filter(e=>!e.dir).map(e=>[e.name,zip.files[e.name]]);
   const backup=items.filter(([n])=>/^physical-lab-circuit(?:\.generated-\d+)?\.json$/i.test(n));
   if(backup.length){if(incoming.length!==1||backup.length!==1)fail('检测到多个工程或工程与源码混选，请一次只导入一个实验。');const [name,entry]=backup[0],header=verified.get(name);if(header.uncompressedSize>LIMITS.projectBackupBytes)fail('ZIP 内实验工程体积过大。');const data=verifyZipEntryData(header,await entry.async('uint8array'));let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{fail('ZIP 内平台工程备份不是有效 UTF-8 文本，请重新导出。');}return {project:parseLabProject(text),warnings:['检测到平台工程备份，已按备份恢复源码、元件和接线；不会重复导入 IDE 内的副本。'],origin:file.name};}
   const source=items.filter(([n])=>/\.(c|h|cpp|hpp|ino)$/i.test(n)&&!/(^|\/)(白话注释副本|__MACOSX)\//.test(n));
   if(entries.length+source.length>LIMITS.count)fail('ZIP 内用户源码超过 200 个文件。请只打包一个实验。');
   let declared=0;for(const [name,entry] of source){const header=verified.get(name),size=header.uncompressedSize;declared+=size;if(size>1000000||declared>12000000)fail('ZIP 展开后的源码体积过大。请只打包一个实验。');const data=verifyZipEntryData(header,await entry.async('uint8array')),decoded=decodeSourceBytes(data,name);addSource(name,decoded);}
  }else if(/\.(c|h|cpp|hpp|ino)$/i.test(file.name)){const decoded=decodeSourceBytes(await file.arrayBuffer(),file.name);addSource(file.name,decoded);}
  else warnings.push('未导入 '+file.name+'：不是受支持的源文件；工程描述本身不包含完整源码。');
 }
 return {files:validateSources(entries),warnings,origin:incoming[0].name};
}
