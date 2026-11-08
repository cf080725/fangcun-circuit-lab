import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {getBoardProfile, makeBoardStarter} from '../dist/board-profiles.js';
import {bluePillI2cTemperatureDisplayLesson} from '../dist/i2c-temperature-display-lesson.js';
import {parseLabProject, validateStm32Firmware} from '../dist/project-import.js';
import {sameSourceFiles} from '../dist/source-hardware.js';
import {getStm32FirmwareTarget, parseStm32Hex, STM32_FLASH_BASE, stm32BinToHex} from '../dist/stm32-firmware-image.js';
import {stm32NativeButtonLessonId} from '../dist/stm32-native-lessons.js';

const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const hex=readFileSync(new URL('../dist/firmware/bluepill/temperature-display-c.hex',import.meta.url),'utf8');
// The compiler tests exercise Clang. The app fixture uses a valid image to
// control the asynchronous compile and emulator-start boundaries precisely.
const image=parseStm32Hex(hex,'bluepill');
const binary=image.flash.slice(0,image.highestAddress-STM32_FLASH_BASE+1);
const built={binary,diagnostics:[]};
const filename='temperature-display.c';
const header='inc/registers.h';
const draft='#include <stdint.h>\nint main(void) { return 0; }\n';

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}

async function waitFor(predicate){
  for(let i=0;i<12;i++){
    if(predicate())return;
    await new Promise(resolve=>setImmediate(resolve));
  }
  assert.ok(predicate(),'the pending task reached the expected boundary');
}

function fixture({standalone=false}={}){
  const files={[filename]:draft,[header]:'#define CLOCK_MASK 2\n'};
  const example=standalone?{
    id:'imported:nucleo-f103rb:native',nativeOnly:true,execution:'stm32-c',boardId:'nucleo-f103rb',
    circuitData:makeBoardStarter('nucleo-f103rb','blink').circuit,
  }:bluePillI2cTemperatureDisplayLesson();
  const activeFile=standalone?header:filename;
  const compiler=deferred(),preparation=deferred();
  const compileCalls=[],prepareCalls=[],installCalls=[],diagnosticCalls=[],nodes=new Map();
  const previous={name:'temperature-display-f.hex',active:true,hex};
  const oldRuntime={dispose(){assert.fail('the retained runtime was disposed');}};
  const context={
    AbortController,files,example,loadedFirmware:previous,runtime:oldRuntime,running:true,
    nativeDraftOriginal:{workspace:files,sources:standalone?{}:{[filename]:'int main(void) { for (;;) {} }\n'}},
    nativeDraftJob:null,appliedNativeDraft:null,circuit:example.circuitData,currentPage:'lab',
    firmwareReviewRequest:0,nativeTemperatureComparison:null,starts:0,saves:0,activeFile,catalog:null,
    board:()=>getBoardProfile(context.circuit.boardId),
    $:selector=>{
      if(!nodes.has(selector))nodes.set(selector,{textContent:'',hidden:false,dataset:{},setAttribute(){},focus(){}});
      return nodes.get(selector);
    },
    canExecute:()=>context.circuit.powered,
    nativeMode:()=>context.loadedFirmware?.active===true,
    isStm32Native:profile=>Boolean(getStm32FirmwareTarget(profile.id)),
    isRp2040Native:()=>false,
    snapshotCircuit:()=>structuredClone(context.circuit),
    temperatureFirmwareFor:id=>!standalone&&id===example.id?{file:'temperature-display',parameter:'DISPLAY_FAHRENHEIT'}:undefined,
    stm32NativeButtonLessonId,
    nativeTemperatureSample:()=>null,
    showNativeDraftDiagnostics:(diagnostics=[])=>diagnosticCalls.push(diagnostics),
    sameSourceFiles,
    compileNativeDraftSource:(sources,options)=>{
      compileCalls.push({sources,options});
      return compiler.promise;
    },
    prepareNativeDraftRuntime:(image,target)=>{
      prepareCalls.push({image,target});
      return preparation.promise;
    },
    validateFirmware:(firmware,profile)=>validateStm32Firmware(firmware,profile.id),
    parseFirmwareImage:(firmware,profile)=>parseStm32Hex(firmware.hex,profile.id),
    stm32BinToHex,
    setNativeFirmware:(firmware,options)=>{
      installCalls.push({firmware,options});
      context.loadedFirmware=firmware;
      context.runtime=options.preparedRuntime;
    },
    startExecution(){context.starts++;},
    save(){context.saves++;},
  };
  context.$('#nativeDraftEditor').value=files[activeFile];
  const names=['activeNativeDraftFile','nativeDraftParameter','renderNativeDraftControls','showNativeDraftIdle',
    'compileNativeDraft','cancelNativeDraftCompile','storeNativeDraftSource','firmwareProjectFields','projectData'];
  const functions=names.map(name=>{
    const pattern=name==='projectData'?`^function ${name}\\(\\).*}$`:`^(?:async )?function ${name}\\([\\s\\S]*?^}`;
    const source=app.match(new RegExp(pattern,'m'))?.[0];
    assert.ok(source,`${name} is the app entry point`);
    return source;
  }).join('\n');
  const actions=runInNewContext(`${functions}\n({compileNativeDraft,cancelNativeDraftCompile,storeNativeDraftSource,projectData})`,context);
  return {context,actions,compiler,preparation,compileCalls,prepareCalls,installCalls,diagnosticCalls,previous,oldRuntime};
}

test('compiler and staging failures retain the previous firmware, running CPU and draft',async t=>{
  for(const phase of ['compiler','validation','staging'])await t.test(phase,async()=>{
    const {context,actions,compiler,preparation,compileCalls,prepareCalls,installCalls,diagnosticCalls,previous,oldRuntime}=fixture();
    const pending=actions.compileNativeDraft();
    await waitFor(()=>compileCalls.length===1);
    if(phase==='staging'){
      compiler.resolve(built);
      await waitFor(()=>prepareCalls.length===1);
      preparation.reject(Error('candidate emulator unavailable'));
    }else if(phase==='validation')compiler.resolve({binary:new Uint8Array(8),diagnostics:[]});
    else compiler.reject(Object.assign(Error('invalid C source'),{diagnostics:[{line:2,column:3,severity:'error',message:'expected expression'}]}));
    assert.equal(await pending,false);
    assert.equal(context.loadedFirmware,previous);
    assert.equal(context.runtime,oldRuntime);
    assert.equal(context.running,true);
    assert.equal(context.files[filename],draft);
    assert.equal(installCalls.length,0);
    assert.equal(prepareCalls.length,phase==='staging'?1:0);
    assert.match(context.$('#nativeDraftStatus').textContent,/仍可运行已载入的固件/);
    if(phase==='compiler')assert.deepEqual(diagnosticCalls.at(-1),[{line:2,column:3,severity:'error',message:'expected expression'}]);
  });
});

test('a candidate only replaces the previous firmware after successful compilation and staging',async()=>{
  const {context,actions,compiler,preparation,compileCalls,prepareCalls,installCalls,previous,oldRuntime}=fixture();
  const pending=actions.compileNativeDraft();
  await waitFor(()=>compileCalls.length===1);
  assert.equal(compileCalls[0].options.boardId,'bluepill');
  assert.notEqual(compileCalls[0].sources,context.files);
  assert.ok(sameSourceFiles(compileCalls[0].sources,context.files));
  compiler.resolve(built);
  await waitFor(()=>prepareCalls.length===1);
  assert.equal(context.loadedFirmware,previous);
  assert.equal(context.runtime,oldRuntime);
  const nextRuntime={};
  preparation.resolve(nextRuntime);
  assert.equal(await pending,true);
  assert.equal(installCalls.length,1);
  assert.equal(installCalls[0].options.preparedRuntime,nextRuntime);
  assert.equal(context.runtime,nextRuntime);
  assert.equal(context.loadedFirmware.hex,stm32BinToHex(binary,'bluepill'));
  assert.ok(sameSourceFiles(context.appliedNativeDraft.sources,context.files));
  assert.equal(context.appliedNativeDraft.firmware,context.loadedFirmware);
  assert.equal(context.starts,1);
});

test('a cancelled or outdated compile disposes late staged runtimes without installing',async t=>{
  for(const change of ['cancel','edit','edit-header','switch-board','replace-files','leave-lab','close-mode','power-off','select-firmware'])await t.test(change,async()=>{
    const {context,actions,compiler,preparation,compileCalls,prepareCalls,installCalls,previous}=fixture();
    const pending=actions.compileNativeDraft();
    await waitFor(()=>compileCalls.length===1);
    compiler.resolve(built);
    await waitFor(()=>prepareCalls.length===1);
    if(change==='cancel')actions.cancelNativeDraftCompile();
    if(change==='edit')context.$('#nativeDraftEditor').value=context.files[filename]=draft+'\n// later edit';
    if(change==='edit-header'){
      context.files[header]='#define CLOCK_MASK 16\n';
      assert.equal(compileCalls[0].sources[header],'#define CLOCK_MASK 2\n');
    }
    if(change==='switch-board')context.circuit={...context.circuit,boardId:'uno-r3'};
    if(change==='replace-files')context.files={...context.files};
    if(change==='leave-lab')context.currentPage='library';
    if(change==='close-mode')context.$('#appFrame').hidden=true;
    if(change==='power-off')context.circuit.powered=false;
    if(change==='select-firmware')context.firmwareReviewRequest++;
    let disposed=0;
    preparation.resolve({dispose(){disposed++;}});
    await pending;
    if(change==='cancel')assert.equal(compileCalls[0].options.signal.aborted,true);
    assert.equal(disposed,1);
    assert.equal(installCalls.length,0);
    assert.equal(context.loadedFirmware,previous);
  });
});

test('typing while the compiler is pending saves the edit and ignores a stale successful result',async()=>{
  const {context,actions,compiler,compileCalls,prepareCalls,installCalls}=fixture();
  const pending=actions.compileNativeDraft();
  await waitFor(()=>compileCalls.length===1);
  const edited=draft+'\n// saved but not applied';
  context.$('#nativeDraftEditor').value=edited;
  actions.storeNativeDraftSource();
  compiler.resolve(built);
  await pending;
  assert.equal(compileCalls[0].options.signal.aborted,true);
  assert.equal(prepareCalls.length,0);
  assert.equal(installCalls.length,0);
  assert.equal(context.files[filename],edited);
  assert.equal(context.saves,1);
});

test('project JSON preserves edited native C and separately keeps the most recently installed firmware',async()=>{
  const {context,actions,compiler,preparation,compileCalls,prepareCalls}=fixture();
  const pending=actions.compileNativeDraft();
  await waitFor(()=>compileCalls.length===1);
  compiler.resolve(built);
  await waitFor(()=>prepareCalls.length===1);
  preparation.resolve({});
  assert.equal(await pending,true);

  const edited=draft+'\n// uncompiled edit';
  context.$('#nativeDraftEditor').value=edited;
  actions.storeNativeDraftSource();
  const restored=parseLabProject(JSON.stringify(actions.projectData()));
  assert.deepEqual(restored.files,{...context.files,[filename]:edited});
  assert.equal(restored.activeFile,filename);
  assert.deepEqual(restored.circuit,context.circuit);
  assert.deepEqual(restored.stm32Firmware,context.loadedFirmware);
});

test('a standalone Nucleo project compiles its .c files even when the active draft tab is a header',async()=>{
  const {context,actions,compiler,preparation,compileCalls,prepareCalls}=fixture({standalone:true});
  const pending=actions.compileNativeDraft();
  await waitFor(()=>compileCalls.length===1);
  assert.equal(compileCalls[0].options.boardId,'nucleo-f103rb');
  assert.ok(sameSourceFiles(compileCalls[0].sources,context.files));
  compiler.resolve(built);
  await waitFor(()=>prepareCalls.length===1);
  assert.equal(prepareCalls[0].target.id,'nucleo-f103rb');
  preparation.resolve({});
  assert.equal(await pending,true);

  const restored=parseLabProject(JSON.stringify(actions.projectData()));
  assert.equal(restored.exampleMeta.execution,'stm32-c');
  assert.equal(restored.activeFile,header);
  assert.equal(restored.stm32Firmware.name,'nucleo-f103rb-draft.hex');
  assert.equal(context.starts,1);
});
