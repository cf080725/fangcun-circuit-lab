/**
 * Structural preflight for ordinary single-volume ZIPs, before JSZip folds names.
 * PKWARE APPNOTE 6.3.10: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
 * Supports STORE/DEFLATE, UTF-8/ASCII names, optional 32-bit data descriptors.
 * ZIP64, encryption, split archives and unknown filename encodings are rejected.
 */
const stop=message=>{throw new Error('ZIP 检查失败：'+message);};
const keyOf=name=>name.replace(/\\/g,'/').normalize('NFC').toLowerCase();
const decoder=new TextDecoder('utf-8',{fatal:true});
const CRC_TABLE=Uint32Array.from({length:256},(_,value)=>{let crc=value;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
export function zipCRC32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=CRC_TABLE[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const sameBytes=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function decodeName(bytes,flags){
 if(!(flags&0x0800)&&bytes.some(byte=>byte>0x7f))stop('文件名编码未明确为 UTF-8；不猜测 GBK/CP437 档名。请重新打包为 UTF-8 ZIP。');
 try{return decoder.decode(bytes);}catch{stop('文件名包含无效 UTF-8 字节。请重新打包。');}
}
function checkPath(raw,dir){
 const path=raw.replace(/\\/g,'/'),trimmed=dir&&path.endsWith('/')?path.slice(0,-1):path;
 if(!trimmed||path.length>512||path.startsWith('/')||/[\x00-\x1f\x7f<>:"|?*]/.test(path)||trimmed.split('/').some(part=>!part||part==='.'||part==='..'||/[ .]$/.test(part)))
  stop('原始条目路径不安全或会被改写：'+JSON.stringify(raw)+'。请只保留工程内相对路径。');
 return trimmed;
}
function checkExtra(bytes,nameBytes,name){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let position=0;
 while(position<bytes.length){
  if(position+4>bytes.length)stop('扩展字段长度不完整：'+name);
  const id=view.getUint16(position,true),length=view.getUint16(position+2,true);position+=4;
  if(position+length>bytes.length)stop('扩展字段越过条目边界：'+name);
  if(id===0x0001)stop('尚未支持 ZIP64，请使用普通 ZIP 打包当前实验。');
  if(id===0x9901||id===0x0017)stop('尚未支持加密 ZIP，请导出不加密的工程包。');
  if(id===0x7075){
   if(length<5||bytes[position]!==1)stop('Unicode 路径扩展格式不受支持：'+name);
   if(view.getUint32(position+1,true)!==zipCRC32(nameBytes))stop('Unicode 路径扩展与原始文件名校验不符：'+name);
   let unicode;try{unicode=decoder.decode(bytes.subarray(position+5,position+length));}catch{stop('Unicode 路径扩展包含无效 UTF-8。');}
   if(unicode!==name)stop('Unicode 路径扩展会把原始条目改成另一个名字：'+name+'。请重新打包为统一 UTF-8 文件名。');
  }
  position+=length;
 }
}

export function validateZipArchive(input,{maxBytes=35*1024*1024,maxEntries=10000}={}){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length>maxBytes)stop('压缩包超过 35 MB 的导入范围。');
 if(bytes.length<22)stop('文件过短，缺少完整的 ZIP 目录结尾。');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=offset=>view.getUint16(offset,true),u32=offset=>view.getUint32(offset,true);
 let end=-1;
 for(let pos=bytes.length-22,min=Math.max(0,bytes.length-22-65535);pos>=min;pos--){
  if(u32(pos)===0x06054b50&&pos+22+u16(pos+20)===bytes.length){end=pos;break;}
 }
 if(end<0)stop('找不到完整的目录结尾；文件可能被截断，或不是普通 ZIP。');
 if(end>=20&&u32(end-20)===0x07064b50)stop('尚未支持 ZIP64，请重新生成普通 ZIP。');
 const count=u16(end+10),diskCount=u16(end+8),directorySize=u32(end+12),directoryOffset=u32(end+16);
 if(count===0xffff||diskCount===0xffff||directorySize===0xffffffff||directoryOffset===0xffffffff)stop('尚未支持 ZIP64，请重新生成普通 ZIP。');
 if(u16(end+4)!==0||u16(end+6)!==0||diskCount!==count)stop('尚未支持多盘/分卷 ZIP，请合并为一个普通 ZIP。');
 if(count>maxEntries)stop('目录条目超过 '+maxEntries+' 个，请只打包当前实验。');
 if(directoryOffset+directorySize!==end||directoryOffset>end||directorySize<count*46)stop('中央目录长度或偏移与文件边界不一致；不支持自解压/附加记录包。');
 const directoryEnd=directoryOffset+directorySize,entries=[],seen=new Map();let position=directoryOffset;
 for(let n=0;n<count;n++){
  if(position+46>directoryEnd||u32(position)!==0x02014b50)stop('中央目录第 '+(n+1)+' 项的头部或长度无效。');
  const flags=u16(position+8),method=u16(position+10),crc32=u32(position+16),compressedSize=u32(position+20),uncompressedSize=u32(position+24),nameLength=u16(position+28),extraLength=u16(position+30),commentLength=u16(position+32),disk=u16(position+34),attributes=u32(position+38),localOffset=u32(position+42),recordEnd=position+46+nameLength+extraLength+commentLength;
  if(compressedSize===0xffffffff||uncompressedSize===0xffffffff||localOffset===0xffffffff||disk===0xffff)stop('条目使用 ZIP64，当前不支持。');
  if(disk!==0)stop('条目位于其他分卷，当前不支持多盘 ZIP。');
  if(flags&0x2041)stop('工程 ZIP 含加密条目，当前不支持。');
  if(flags&~0x080e)stop('工程 ZIP 使用尚未支持的标志或补丁格式。');
  if(![0,8].includes(method))stop('仅支持 STORE/DEFLATE 普通 ZIP，当前压缩方法为 '+method+'。');
  if(!nameLength||recordEnd>directoryEnd)stop('中央目录中文件名、扩展或注释长度越界。');
  const nameBytes=bytes.subarray(position+46,position+46+nameLength),name=decodeName(nameBytes,flags);
  const unix=(u16(position+4)>>>8)===3,unixType=(attributes>>>16)&0xf000;
  if(unix&&unixType===0xa000)stop('不导入符号链接条目：'+name+'。请打包实际源码文件。');
  if(unix&&unixType&&![0x4000,0x8000].includes(unixType))stop('条目不是普通文件或目录：'+name);
  const dir=name.endsWith('/')||!!(attributes&0x10)||unix&&unixType===0x4000,path=checkPath(name,dir),key=keyOf(path);
  if(seen.has(key))stop('存在重复、大小写或 Unicode 归一化撞名：'+seen.get(key).name+' 与 '+name+'；未选择其中任何一份。');
  for(const [otherKey,other] of seen)if(!other.dir&&key.startsWith(otherKey+'/')||!dir&&otherKey.startsWith(key+'/'))stop('条目同时要求同一路径是文件和目录：'+other.name+' 与 '+name);
  checkExtra(bytes.subarray(position+46+nameLength,position+46+nameLength+extraLength),nameBytes,name);
  const entry={name,path,dir,flags,method,crc32,compressedSize,uncompressedSize,localOffset,centralOffset:position};seen.set(key,entry);
  if(localOffset+30>directoryOffset||u32(localOffset)!==0x04034b50)stop('本地文件头偏移无效：'+name);
  const localFlags=u16(localOffset+6),localMethod=u16(localOffset+8),localNameLength=u16(localOffset+26),localExtraLength=u16(localOffset+28),payloadOffset=localOffset+30+localNameLength+localExtraLength,payloadEnd=payloadOffset+compressedSize;
  if(localFlags!==flags||localMethod!==method)stop('本地文件头与中央目录的标志/压缩方法不一致：'+name);
  if(payloadOffset>directoryOffset||payloadEnd>directoryOffset)stop('文件内容长度越过数据区边界：'+name);
  const localName=bytes.subarray(localOffset+30,localOffset+30+localNameLength);
  if(!sameBytes(localName,nameBytes))stop('本地文件名与中央目录原始文件名不同：'+name+'。请重新打包。');
  checkExtra(bytes.subarray(localOffset+30+localNameLength,payloadOffset),localName,name);
  const localCRC=u32(localOffset+14),localCompressed=u32(localOffset+18),localUncompressed=u32(localOffset+22);
  if(localCompressed===0xffffffff||localUncompressed===0xffffffff)stop('本地条目使用 ZIP64，当前不支持。');
  let localEnd=payloadEnd;
  if(flags&8){
   const descriptorMatches=(at)=>at+12<=directoryOffset&&u32(at)===crc32&&u32(at+4)===compressedSize&&u32(at+8)===uncompressedSize;
   if(payloadEnd+16<=directoryOffset&&u32(payloadEnd)===0x08074b50&&descriptorMatches(payloadEnd+4))localEnd+=16;
   else if(descriptorMatches(payloadEnd))localEnd+=12;
   else stop('数据描述符长度、CRC或大小与中央目录不符：'+name);
   if(localCRC!==0&&localCRC!==crc32||localCompressed!==0&&localCompressed!==compressedSize||localUncompressed!==0&&localUncompressed!==uncompressedSize)stop('本地头声明与数据描述符冲突：'+name);
  }else if(localCRC!==crc32||localCompressed!==compressedSize||localUncompressed!==uncompressedSize)stop('本地文件头的CRC或大小与中央目录不一致：'+name);
  if(method===0&&compressedSize!==uncompressedSize)stop('STORE条目的压缩前后长度不一致：'+name);
  if(dir&&(uncompressedSize!==0||crc32!==0))stop('目录条目携带了文件数据：'+name);
  entries.push({...entry,payloadOffset,localEnd});position=recordEnd;
 }
 if(position!==directoryEnd)stop('中央目录声明的条目数量与字节长度不一致。');
 let localEnd=0;for(const entry of [...entries].sort((a,b)=>a.localOffset-b.localOffset)){
  if(entry.localOffset!==localEnd)stop('数据条目重叠、存在未识别间隔或自解压前缀；请重新生成普通 ZIP。');localEnd=entry.localEnd;
 }
 if(localEnd!==directoryOffset)stop('本地数据区长度与中央目录起点不一致。');
 return {entries,directoryOffset,directorySize,endOffset:end,byteLength:bytes.length};
}

/** Verify that the loader did not rename, merge, lose or add any regular file. */
export function verifyLoadedZip(zip,manifest){
 if(!zip?.files||typeof zip.files!=='object')stop('ZIP读取器未返回文件集合。');
 const expected=new Map(manifest.entries.filter(e=>!e.dir).map(e=>[e.name,e])),observed=Object.entries(zip.files).filter(([,e])=>!e.dir);
 if(observed.length!==expected.size)stop('解包后文件数量改变，可能发生名称折叠或条目丢失。');
 for(const [name,entry] of observed){
  const original=expected.get(name);if(!original)stop('解包器产生了中央目录以外的文件名：'+name);
  if(entry.name!==undefined&&entry.name!==name||entry.unsafeOriginalName!==undefined&&entry.unsafeOriginalName!==original.name)stop('解包器改写了原始文件名：'+String(entry.unsafeOriginalName)+' → '+name);
  if(entry._data?.uncompressedSize!==undefined&&entry._data.uncompressedSize!==original.uncompressedSize)stop('解包后声明的大小发生变化：'+name);
 }
 return expected;
}
export function verifyZipEntryData(entry,input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length!==entry.uncompressedSize)stop('实际展开大小与目录不一致：'+entry.name);
 if(zipCRC32(bytes)!==entry.crc32)stop('源码或工程备份的CRC校验失败：'+entry.name+'；请重新下载或打包，避免导入损坏代码。');
 return bytes;
}
