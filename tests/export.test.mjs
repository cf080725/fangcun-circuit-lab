import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {exportProject,appendExportFile,createReadingGuide} from '../dist/project-export.js';
import {BOARD_PROFILE_LIST,makeBoardStarter} from '../dist/board-profiles.js';
import {examples} from '../dist/content.js';

test('source export preserves all user files and circuit without claiming an IDE build',()=>{
 const f={'main.c':'int main(void){return 0;}','User/LED.h':'#define VALUE 1'},c={boardId:'bluepill',wires:[]};
 const out=exportProject({files:f,circuit:c,format:'source',projectName:'Test'});
 for(const [path,text] of Object.entries(f))assert.equal(out.files[path],text);
 assert.equal(JSON.parse(out.files['导出说明.json']).ideBuildVerified,false);
 assert.equal(JSON.parse(out.files['接线项目.json']).circuit.boardId,'bluepill');
 assert.throws(()=>exportProject({files:{'../escape.c':'int x;'}}),/相对路径/);
});

test('all enabled Arduino exports contain the matching sketch folder and real source',()=>{
 for(const board of BOARD_PROFILE_LIST.filter(board=>board.arduinoExport!==false)){
  const starter=makeBoardStarter(board.id),result=exportProject({files:starter.files,boardId:board.id,format:'arduino',projectName:'Blink'});
  assert.equal(result.files['Blink/Blink.ino'],starter.files['sketch.ino']);
  assert.ok(result.files['Blink/README_Arduino.md'].includes('本机'));
 }
});

test('all declared PlatformIO exports select the declared board and Arduino framework',()=>{
 for(const board of BOARD_PROFILE_LIST.filter(board=>board.platformio)){
  const starter=makeBoardStarter(board.id),result=exportProject({files:starter.files,boardId:board.id,format:'platformio'});
  assert.equal(result.files['src/sketch.ino'],starter.files['sketch.ino']);
  assert.ok(result.files['platformio.ini'].includes('board = '+board.platformio.board));
  assert.ok(result.files['platformio.ini'].includes('framework = arduino'));
 }
 for(const board of BOARD_PROFILE_LIST.filter(board=>!board.platformio)){
  const starter=makeBoardStarter(board.id);
  assert.throws(()=>exportProject({files:starter.files,boardId:board.id,format:'platformio'}),/暂无已核对/);
 }
});

test('Keil integration XML parses, points only to exported user files, and lists absent real dependencies',()=>{
 const source=examples.find(e=>e.id==='multifile').files;
 for(const boardId of ['bluepill','nucleo-f103rb']){
  const out=exportProject({files:source,boardId,format:'keil',projectName:'Lesson'}),xml=out.files['Lesson.uvprojx'];
  const parsed=JSON.parse(execFileSync('python3',['-c',`import sys,json,xml.etree.ElementTree as E
r=E.fromstring(sys.stdin.read())
print(json.dumps({'root':r.tag,'version':r.findtext('SchemaVersion'),'paths':[e.text for e in r.findall('.//FilePath')],'device':r.findtext('.//Device')}))`],{input:xml,encoding:'utf8'}));
  assert.equal(parsed.root,'Project');assert.equal(parsed.version,'2.1');assert.ok(parsed.device.startsWith('STM32F103'));
  for(const path of parsed.paths){const relative=path.replace(/^\.\\/,'').replace(/\\/g,'/');assert.ok(Object.hasOwn(out.files,relative),relative);}
  const deps=JSON.parse(out.files['Keil依赖清单.json']);assert.ok(deps.requiredStartup.includes('startup_stm32f10x_md.s'));assert.ok(deps.selectedStandardPeripheralDrivers.includes('stm32f10x_gpio.c'));assert.equal(deps.delayImplementationNeeded,true);
  assert.ok(out.warnings.some(w=>w.includes('不是已通过Keil编译')));
 }
});

test('exports refuse to relabel incompatible source as a ready foreign framework',()=>{
 const spl=examples.find(e=>e.id==='blink').files,sketch=makeBoardStarter('bluepill').files;
 assert.throws(()=>exportProject({files:spl,format:'arduino'}),/不能靠改后缀/);
 assert.throws(()=>exportProject({files:spl,format:'platformio'}),/不自动提供/);
 assert.throws(()=>exportProject({files:sketch,format:'keil'}),/不能直接/);
 assert.throws(()=>exportProject({files:spl,boardId:'nucleo-f401re',format:'keil'}),/没有/);
});

test('source README and metadata collisions preserve user content and disclose generated paths',()=>{
 const source={'main.c':'int main(void){return 0;}','README_源码.md':'my original README','导出说明.json':'my original manifest','接线项目.json':'my original circuit'};
 const before=JSON.stringify(source),result=exportProject({files:source,format:'source',circuit:{boardId:'bluepill',wires:[]}});
 for(const [path,value] of Object.entries(source))assert.equal(result.files[path],value);
 assert.equal(JSON.stringify(source),before);
 assert.ok(Object.hasOwn(result.files,'README_源码.generated-1.md'));
 assert.ok(Object.hasOwn(result.files,'导出说明.generated-1.json'));
 assert.ok(Object.hasOwn(result.files,'接线项目.generated-1.json'));
 const metadata=JSON.parse(result.files['导出说明.generated-1.json']);
 assert.equal(metadata.generatedFiles.metadata,'导出说明.generated-1.json');assert.equal(metadata.generatedFiles.circuit,'接线项目.generated-1.json');
 assert.ok(metadata.warning.some(w=>w.includes('README_源码.generated-1.md')));assert.ok(metadata.warning.some(w=>w.includes('导出说明.generated-1.json')));
});

test('normalized, case-insensitive and file-directory input collisions fail without selecting a winner',()=>{
 for(const files of [
  {'User\\LED.c':'first','User/LED.c':'second'},
  {'main.c':'first','MAIN.C':'second'},
  {'src':'file','src/main.c':'nested'},
  {'src/main.c':'nested','src':'file'},
  {'résumé.c':'first','re\u0301sume\u0301.c':'second'}
 ]){const before=JSON.stringify(files);assert.throws(()=>exportProject({files}),/路径冲突/);assert.equal(JSON.stringify(files),before);}
 const normalized=exportProject({files:{'User\\LED.c':'int x;'}});assert.equal(normalized.files['User/LED.c'],'int x;');
});

test('ambiguous or nonportable paths are not silently rewritten into a different file',()=>{
 for(const path of ['/main.c','C:\\main.c','\\\\server\\share\\main.c','./main.c','folder//main.c','folder/../main.c','main.c.','main.c ','CON.c','folder/NUL.h','bad\u0000.c'])
  assert.throws(()=>exportProject({files:{[path]:'int x;'}}),/相对路径/,JSON.stringify(path));
 const named=exportProject({files:{'main.c':'int main(void){return 0;}'},format:'keil',projectName:'CON'});assert.ok(Object.hasOwn(named.files,'Project_CON.uvprojx'));
});

test('Arduino main-file renaming cannot overwrite another sketch file',()=>{
 const files={'sketch.ino':'void setup(){} void loop(){}','Blink.ino':'void helper(){}'},before=JSON.stringify(files);
 assert.throws(()=>exportProject({files,boardId:'uno-r3',format:'arduino',projectName:'Blink'}),/路径冲突.*Blink\/Blink\.ino/);
 assert.equal(JSON.stringify(files),before);
 const withReadme=exportProject({files:{'sketch.ino':'void setup(){} void loop(){}','README_Arduino.md':'my notes'},boardId:'uno-r3',format:'arduino',projectName:'Blink'});
 assert.equal(withReadme.files['Blink/README_Arduino.md'],'my notes');assert.ok(Object.hasOwn(withReadme.files,'Blink/README_Arduino.generated-1.md'));
});

test('generated additions find a unique file or directory path and retain every previous entry',()=>{
 const files={'physical-lab-circuit.json':'original','physical-lab-circuit.generated-1.json':'older','阅读说明':'a file'},warnings=[];
 assert.equal(appendExportFile(files,'physical-lab-circuit.json','new',warnings),'physical-lab-circuit.generated-2.json');
 assert.equal(files['physical-lab-circuit.json'],'original');assert.equal(files['physical-lab-circuit.generated-1.json'],'older');
 const reading=appendExportFile(files,'阅读说明/main.c.txt','guide',warnings);assert.equal(reading,'阅读说明.generated-1/main.c.txt');assert.equal(files['阅读说明'],'a file');assert.equal(files[reading],'guide');
 assert.equal(warnings.length,2);
 const folder={'README.txt/notes.c':'contents'};assert.equal(appendExportFile(folder,'README.txt','generated'),'README.generated-1.txt');
});

test('special object-property filenames remain own files without changing prototypes',()=>{
 const files=JSON.parse('{"__proto__":"original source text","constructor":"another file","main.c":"int main(void){return 0;}"}');
 const result=exportProject({files,format:'source'});assert.equal(Object.getPrototypeOf(result.files),Object.prototype);assert.equal(Object.hasOwn(result.files,'__proto__'),true);assert.equal(result.files['__proto__'],'original source text');assert.equal(result.files.constructor,'another file');
});

test('reading guide keeps raw strings, macro continuations and original line numbers outside compiled source',()=>{
 const source=String.raw`#define MESSAGE "first" \
    "second"
const char *text = R"note(first line
second line)note";
/* note
   GPIO_SetBits(GPIOA, GPIO_Pin_0);
*/
`;
 const seen=[];const guide=createReadingGuide(source,(line,lineNumber,full)=>{seen.push({line,lineNumber,full});return {plain:'独立说明 '+lineNumber,technical:'静态规则'};});
 const start='===== 原始源码开始 =====\n',end='\n===== 原始源码结束 =====';
 assert.equal(guide.slice(guide.indexOf(start)+start.length,guide.indexOf(end)),source);
 assert.equal(seen.length,source.split('\n').length);assert.deepEqual(seen.map(x=>x.lineNumber),Array.from({length:seen.length},(_,i)=>i+1));assert.ok(seen.every(x=>x.full===source));
 assert.match(guide,/仅供阅读，不加入编译/);assert.match(guide,/第 4 行/);assert.match(guide,/白话：独立说明 4/);
 const files={'main.cpp':source},path=appendExportFile(files,'阅读说明/main.cpp.txt',guide);assert.equal(path,'阅读说明/main.cpp.txt');assert.equal(files['main.cpp'],source);
 const crlf='first\r\nsecond\r\n';assert.ok(createReadingGuide(crlf).includes(start+crlf+end));
});
