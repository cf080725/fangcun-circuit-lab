import {compileForBoard,createBoardRuntime} from './engine.js';
import {BOARD_PROFILES,BOARD_PROFILE_LIST,getBoardProfile,makeBoardStarter,boardStarterKinds,canonicalPin} from './board-profiles.js';
import {nativeObservationContext,nativeObservationSample} from './native-observation.js';
import {createNativeObservationPanel} from './native-observation-panel.js';
import {createNativePwmScope} from './native-pwm-scope.js';
import {createEditorAssistant,explainSourceLine,explainSource} from './editor-assistant.js?v=10.43.1';
import {mountResourceLibrary} from './resource-library.js?v=10.43.1';
import {mountEditorTools} from './editor-tools.js?v=10.43.1';
import {codeLocation,guidanceFor} from './learning-guide.js';
import {planFault} from './fault-exercises.js';
import {readImportSelection,parseLabProject,sourcePath,validateAvrFirmware,validateStm32Firmware,validateRp2040Firmware,encodeProjectUf2,parseProjectUf2} from './project-import.js';
import {AVR_HEX_MAX_CHARS,parseAvrHex} from './avr-firmware-hex.js';
import {STM32_FLASH_BASE,getStm32FirmwareTarget,parseStm32Hex,stm32BinToHex} from './stm32-firmware-image.js';
import {RP2040_UF2_MAX_BYTES} from './rp2040-firmware-image.js';
import {createAvrCircuitIO} from './avr-circuit-io.js';
import {parameterSpecs,parseParameter,partConnections,collectDiagnostics} from './inspector-tools.js';
import {createCatalog,boardModelTier,EXTRA_RESOURCES} from './catalog-ui.js?v=10.43.1';
import {normalizeBOM} from './catalog-index.js';
import {BOARD_CATALOG,COMPONENT_CATALOG} from './catalog-data.js';
import * as Content from './content.js';
import {CircuitSimulator,createCircuit,makePart,PARTS,BOARD_LEFT,BOARD_RIGHT} from './circuit.js';
import {createWorkbench} from './workbench.js';
import {componentRemoval,nextComponentId,copyComponent} from './scene-objects.js';
import {boardMountRows,boardPose,getMountOptions,mountedConnections,mountedPinRoutes,rotateBoardPoint,signalHole,signalStrip} from './breadboard-mount.js';
import {createBreadboardWiring} from './breadboard-wiring.js';
import {boardMountFromStartHole,boardMountStartHoles,breadboardMoveObstacle,evaluateMountPlacement,nearestBoardMount,nearestBreadboardMount} from './mount-placement.js';
import {showMountPlacementDialog} from './mount-placement-dialog.js';
import {canMountPart,dipSwitchAnchorRows,evaluatePartMount,mountedPartBodyBounds,mountedPartContacts,nearestPartMount,partMountPins,partMountRotation,partMountRotations,partPose,sevenSegmentAnchorRows} from './part-mount.js';
import {boardVisual,componentBounds,createSsd1306Raster,hardwareResetLabel,rgbLedVisual,sceneRotationStep} from './model-renderer.js';
import {makeDevkitcHeaderExercise} from './devkitc-header-exercise.js';
import {breadboardBlinkBoardIds,makeBreadboardBlink} from './breadboard-blink.js';
import {makeD13PullupExercise} from './d13-pullup-exercise.js';
import {makePassiveBreadboardExercises} from './passive-breadboard-exercises.js';
import {makeSevenSegmentLesson,readSevenSegment,segmentNames,sevenSegmentLabel} from './sevenseg-lesson.js';
import {createMotorStopTrace,makeMotorBridgeLesson,motorBridgeLessonId,motorModeLabel,readMotorBridgeLesson} from './motor-bridge-lesson.js';
import {renderMotorStopTrace} from './motor-stop-view.js';
import {makeUltrasonicLesson,sonarMissLabels,ultrasonicLessonId} from './ultrasonic-lesson.js';
import {mountUltrasonicTarget,renderUltrasonicTiming} from './ultrasonic-view.js';
import {i2cOledLessonId,makeI2cOledLesson} from './i2c-oled-lesson.js';
import {mountI2cOledMonitor,oledVisiblePixels} from './i2c-oled-view.js';
import {i2cTemperatureLessonId,stm32TemperatureLessonId,makeI2cTemperatureLesson} from './i2c-temperature-lesson.js';
import {stm32TemperatureDisplayLessonId,bluePillI2cTemperatureDisplayLesson,temperatureDisplaySdaWires} from './i2c-temperature-display-lesson.js';
import {stm32NativeButtonLessonId,makeStm32NativeButtonLesson} from './stm32-native-lessons.js';
import {encoderLessonId,encoderLessonPart,makeEncoderLesson} from './encoder-lesson.js';
import {encoderContact,scheduleEncoderDetent,turnEncoderAtRest,setEncoderSwitch,settleEncoderContact} from './rotary-encoder.js';
import {joystickLessonId,joystickLessonPart,makeJoystickLesson} from './joystick-lesson.js';
import {joystickState,setJoystickState} from './analog-joystick.js';
import {rgbLedLessonChannels,rgbLedLessonId,rgbLedLessonPart,makeRgbLedLesson} from './rgbled-lesson.js';
import {kingbrightRgbModel} from './rgb-led.js';
import {makeServoNativeLesson,servoNativeLessonId,servoNativePotPart,servoNativeServoPart} from './servo-native-lesson.js';
import {createServoTurnTrace,recordServoTurn,servoTurnPath} from './servo-native-view.js';
import {makeRelayNativeLesson,relayNativeLamp,relayNativeLessonId,relayNativePart} from './relay-native-lesson.js';
import {dipSwitchLessonId,dipSwitchLessonInputs,dipSwitchLessonLed,dipSwitchLessonPart,makeDipSwitchLesson} from './dip-switch-lesson.js';
import {makePhotoresistorLesson,photoresistorLessonId,photoresistorLessonLed,photoresistorLessonPart,photoresistorLessonPin} from './photoresistor-lesson.js';
import {createRelayScope,recordRelayScope,relaySamplePath,relaySignalPath} from './relay-native-view.js';
import {i2cHex,i2cReason,i2cStatus,mountI2cTrace,recentI2cPackets} from './i2c-trace.js';
import {mountI2cAnalyzerPanel} from './i2c-analyzer-panel.js';
import {makeButtonBounceLesson} from './button-bounce-lesson.js';
import {scheduleButtonPress,setButtonContact,settleButtonContact} from './button-contact.js';
import {renderButtonBounceTrace} from './button-bounce-view.js';
import {renderPwmRcScope} from './pwm-rc-view.js';
import {sameSourceFiles,sourceCircuitKey,sourceObservation,sourceSignalActivity} from './source-hardware.js';
import {emptySourceTrace,sampleSourceTrace,sourceTraceMaxSamples,sourceTraceWindowMs} from './source-trace.js';
import {renderSourceTrace} from './source-trace-view.js';
import {createSourceProbeTrace} from './source-probe-trace.js';
import {createSourceLedTrace} from './source-led-trace.js';
import {probeMeterReading,voltageProbeLookup} from './voltage-probes.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>structuredClone(v),STORAGE='stm32-physical-lab-v1';
const bluePillWatchPins={onboard:'PC13',adc:'PA1',uart:'PA9'};
const examples=Content.examples.map(ex=>({...ex,boardId:'bluepill',watchPin:bluePillWatchPins[ex.id]??'PA0'}));
examples.push({
  ...examples.find(ex=>ex.id==='blink'),id:'plugged-led',title:'11 · 把 LED 和电阻插进面包板',shortTitle:'面包板插装',circuitPreset:'plugged-led',
  description:'用两根跳线接开发板，LED 和限流电阻通过同组孔位串联。',
  setup:['PA0 接 E10，LED 正极 A 在 A10，负极 K 在 A11。','A11 和 C11 相通。330 Ω 电阻插在 C11 / C16，E16 接 GND。','运行观察 LED，拔下电阻看电流归零，再用撤销恢复插装。'],
  learningGoals:['同一列的 A–E 孔组能传递信号。','拔下电阻会断开回路，LED 随即熄灭。']
});
examples.push({
  ...examples.find(ex=>ex.id==='button'),id:'plugged-button',title:'12 · 用面包板按键控制 LED',shortTitle:'面包板按键',circuitPreset:'plugged-button',
  description:'四脚按键跨过面包板沟槽，按下才把 PB1 的输入接到地。',
  setup:['按键 1、2 脚插在 F20、F22，3、4 脚插在 E20、E22。','PB1 接 H20，GND 接 D20。PA0 通过 E10 和原有插装回路驱动 LED。','运行后按住按键，再松开。切换观察 PB1，比较输入电压和 LED 的变化。'],
  learningGoals:['认清同组的两脚始终相通，按下才连接两组。','上拉输入松开时为高电平，按下接地后为低电平。']
});
examples.push({
  ...examples.find(ex=>ex.id==='blink'),id:'board-insertion',title:'13 · 把 Blue Pill 插到面包板上',shortTitle:'开发板直插',circuitPreset:'board-insertion',mountPractice:{column:6,rotation:90},
  description:'通过 Blue Pill 的排针给面包板上的 LED 回路供电。',
  setup:['点「插入面包板」，或把开发板拖到面包板孔区。','对准第 6 列起、USB 朝左，确认接通预接的两个孔组。','运行看 LED 闪烁，再拔下开发板看它熄灭。'],
  learningGoals:['观察 PA0 和 GND1 如何通过排针接到 A21 和 J24。','对比开发板插入和拔出时的 LED 电流。']
});
examples.push(...makePassiveBreadboardExercises());
examples.push(makeSevenSegmentLesson());
examples.push(makeMotorBridgeLesson());
examples.push(makeButtonBounceLesson());
for(const profile of BOARD_PROFILE_LIST.filter(p=>p.id!=='bluepill'))for(const kind of boardStarterKinds(profile)){const starter=makeBoardStarter(profile.id,kind);const title={blink:'让 LED 闪烁',button:'按钮控制 LED',adc:'旋钮变成数字',pwm:'PWM 呼吸灯'}[kind];examples.push({id:profile.id+':'+kind,boardId:profile.id,title,shortTitle:title,files:starter.files,circuitData:starter.circuit,description:starter.description,language:'arduino',watchPin:kind==='adc'?profile.defaultPins.adc:starter.ledPin,learningGoals:[title+' · '+profile.name]});}
examples.push(makeUltrasonicLesson());
examples.push(makeI2cOledLesson());
examples.push(makeI2cTemperatureLesson(),makeI2cTemperatureLesson('bluepill'));
examples.push(bluePillI2cTemperatureDisplayLesson());
examples.push(makeStm32NativeButtonLesson(),makeEncoderLesson(),makeJoystickLesson(),makeRgbLedLesson(),makeServoNativeLesson(),makeRelayNativeLesson(),makeDipSwitchLesson(),makePhotoresistorLesson());
for(const boardId of ['uno-r3','nano']){
 const {files,circuit}=makeD13PullupExercise(boardId),uno=boardId==='uno-r3';
 const other=uno?'nano':'uno-r3';
 examples.push({
  id:boardId+':d13-pullup',boardId,title:'D13 输入上拉与板载 L 灯',shortTitle:'D13 输入上拉',files,circuitData:circuit,
  language:'arduino',watchPin:'D13',compareExample:other+':d13-pullup',compareLabel:uno?'在 Nano 做同一实验':'在 UNO R3 做同一实验',
  description:'同一份程序，同一条按键支路。比较两块板上 D13 的电压和板载 L 灯。',
  setup:['D13 经 1 kΩ 和按键接到 GND。松开时，只有代码启用的内部上拉和板载电路作用在 D13 上。',
   '运行后观察 D13 和板载 L。按住按键，再松开。可在串口看 digitalRead 的读数。',
   '把 INPUT_PULLUP 改成 INPUT 并应用。松开按键时查看电压、波形和诊断。'],
  learningGoals:[uno?'UNO R3 的 L 灯由 LMV358 跟随器驱动，灯电流由缓冲器提供。':'经典 Nano 的 L 灯经 330 Ω 直接连 D13，弱上拉会被这条支路加载。',
   '区分内部上拉产生的高电平、按下时的低电平，以及没有确定参考的悬空输入。'],
  expected:uno?'原代码松开时 D13 接近 5 V，读 1，L 灯亮。按下后接近 0 V，读 0，L 灯灭。'
   :'原代码松开时，板载 L 灯支路会把弱上拉拉到约 2 V。本模型读为 0，实物在这个电压下的数字读数没有保证。按下后电压更低。'
 });
}
const nucleoButtonExample='nucleo-f103rb:board-button';
examples.push({
 id:nucleoButtonExample,boardId:'nucleo-f103rb',title:'用板载 B1 控制 LD2',shortTitle:'板载按键与灯',watchPin:'PA5',
 circuitData:makeBoardStarter('nucleo-f103rb','blink').circuit,language:'stm32-spl',
 description:'按下板载 B1，把 PC13 拉到地，程序通过 PA5 点亮绿色的 LD2。',
 setup:['板上的 B1 和 LD2 已接好，可直接运行。','按住蓝色 B1，或用实验台的「B1 按住」按钮。','松开 B1，对照 PC13 和 PA5 的电压。'],
 learningGoals:['观察板载上拉如何让松开的 PC13 保持高电平。','区分 PC13 的低有效输入与 PA5 的高有效输出。'],
 expected:'按下时 PC13 接近 0 V，LD2 亮。松开后 PC13 回到约 3.3 V，LD2 灭。',
 files:{'main.c':`#include "stm32f10x.h"
#include "Delay.h"

int main(void) {
  // 给 LD2 所在的 GPIOA 和 B1 所在的 GPIOC 开时钟。
  RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_GPIOC, ENABLE);
  GPIO_InitTypeDef gpio;
  gpio.GPIO_Pin = GPIO_Pin_5;
  gpio.GPIO_Speed = GPIO_Speed_2MHz;
  gpio.GPIO_Mode = GPIO_Mode_Out_PP;
  GPIO_Init(GPIOA, &gpio);

  // B1 已有板载上拉，PC13 使用浮空输入。
  gpio.GPIO_Pin = GPIO_Pin_13;
  gpio.GPIO_Mode = GPIO_Mode_IN_FLOATING;
  GPIO_Init(GPIOC, &gpio);
  while (1) {
    if (GPIO_ReadInputDataBit(GPIOC, GPIO_Pin_13) == 0) {
      GPIO_SetBits(GPIOA, GPIO_Pin_5);
    } else {
      GPIO_ResetBits(GPIOA, GPIO_Pin_5);
    }
    Delay_ms(10);
  }
}
`}
});
for(const boardId of breadboardBlinkBoardIds){
 const lesson=makeBreadboardBlink(boardId);
 if(!lesson)continue;
 const {files,circuit,mount,ledPin,outputRoute,groundRoute,outputHole,groundHole}=lesson;
 const hole=endpoint=>endpoint.slice(3).toUpperCase();
 const signal=outputRoute.pin.label===ledPin?ledPin:`${ledPin}（${outputRoute.pin.label}）`;
 examples.push({id:boardId+':mounted-blink',boardId,title:'插到面包板再点灯',shortTitle:'直插点灯',files,circuitData:circuit,language:'arduino',mountPractice:mount,watchPin:ledPin,
  description:'跳线已经接到面包板。将开发板插到指定孔位后，外接 LED 才能从排针获得信号。',
  setup:[`点「插入面包板」，对准${lessonMountLabel(mount)}，确认接入预接的两组孔。`,
    `${signal} 经 ${hole(outputRoute.socket)} 接通 ${hole(outputHole)}，GND 经 ${hole(groundRoute.socket)} 接通 ${hole(groundHole)}。`,
    boardId==='nano' ? '点「运行」观察板载 L 和外接灯同时闪烁。拔下后，只有外接灯失去信号。撤销拔板可恢复连接。'
      : '点「运行」观察外接 LED 闪烁。拔下开发板后外接灯熄灭，撤销拔板可恢复连接。',
    '板子插好后，把第一处 digitalWrite 中的 HIGH 改成 LOW，点「应用代码并运行」，观察外接灯是否还会闪。'],
  learningGoals:['通过排针和同组面包板孔把信号送到 LED。','区分插装接触与 GPIO 程序对电流的影响。'],
  expected:'初始程序插板后让外接 LED 闪烁。拔下开发板，或把两次 GPIO 输出都设为 LOW，外接灯会熄灭。'});
}
{
  const {files,circuit}=makeDevkitcHeaderExercise();
 examples.push({id:'esp32-devkitc:mounted-header',boardId:'esp32-devkitc',title:'从 ESP32 插装排针引线',shortTitle:'ESP32 插装排针',files,circuitData:circuit,language:'arduino',watchPin:'GPIO23',
    description:'GPIO32 的同组面包板孔都在板身下。直接从排针引一根跳线，用按键控制外接 LED。',
    setup:['点击「查插装引脚」，搜索 GPIO32，再点击「从排针接线」。','在实验台点击轻触按键的 1 脚。LED 已通过 J23 接 GPIO23，按键的 3 脚已接地。','运行程序，比较按下与松开时 GPIO32 电压及外接 LED 的变化。'],
    learningGoals:['找出哪些信号还能从同组外露孔引线，哪些要从板上排针引线。','观察上拉输入从高电平降到低电平时，外接灯如何响应。'],
    expected:'补好跳线后，松开时 GPIO32 约 3.3 V，LED 熄灭。按下时 GPIO32 接近 0 V，LED 点亮。'});
}
const glossary=Content.glossary??[],faultCatalog=Content.faultCatalog??[],lessons=Content.lessons??[];
let example=examples[0],files=clone(example.files),activeFile='main.c',circuit=createCircuit(example.circuitPreset),runtime=null,compiled=false,running=false,loopTimer=null,speed=1,selected=null,selectedPin=null,mode='orbit',serialText='',resources=[],resourceFilter='all',workbench=null,lastState={pins:{},timeMs:0,variables:{}},result=null,editorLine=1,errors=[],history=[],wavePin='PA0',soundEnabled=false,audioCtx=null,osc=null,audioGain=null,saveTimer=null,switching=false;
const sim=new CircuitSimulator();
let appliedSource=null,sourcePending=false,programmedSource=null;
let sourceObserved=null,sourceComparison=null;
let sourceTrace=null,sourceTraceComparison=null,sourceDelaySample=null;
const sourceFrameMs=16;
let sourceFrameAt=null;
const sourceProbeTrace=createSourceProbeTrace();
const sourceLedTrace=createSourceLedTrace();
const motorStopTrace=createMotorStopTrace();
let sourceTraceSignal='pin';
let trackedLedId=null;
let editorAssistant=null,editorTools=null,catalog=null,liveTimer=null,liveDiagnostics=[],undoStack=[],redoStack=[],selectedWire=null,audience='beginner',currentPage='lab';
let boardLastExamples={},guideStep=0,learningNotes={},lastImportBackup=null;
let loadedFirmware, firmwareImage, firmwareReviewRequest=0, executionRequest=0, nativeSerialPort='Serial', nativeSerialTarget, nativeSerialText={};
let nativeObservationPanel=null,nativeObservationWorkspace,nativeObservationPin,nativeObservationLed;
let nativeObservationBefore=null,nativeObservationAfter=null,nativeObservationKey=null,nativeObservationNotice='';
const selectedParts=new Set();
let lastPartRemoval=null,sceneObjectRowsKey='';
let sceneCameraMode='edit';
let inspectedPin=null,partPlacement=null,boardHolePicker=null;
let probeOpen=false,probePick=null,probeNotice='';
const probeEndpoints={red:null,black:null};
let sonarGesture=null;
const updateSonarDiagram=mountUltrasonicTarget($('#sonarTargetDiagram'),{
 onChange:next=>setSonarTarget(next,true),onFinish:()=>{sonarGesture=null;}
});
try{learningNotes=JSON.parse(localStorage.getItem('physical-lab-learning-notes')||'{}')||{};}catch{}
const board=()=>getBoardProfile(circuit.boardId||'bluepill');
const nativeMode=()=>Boolean(board().capabilities.nativeFirmware && loadedFirmware?.active);
const avrNativeI2c=()=>nativeMode()&&['uno-r3','nano','mega2560'].includes(board().id);
const stm32NativeI2c=()=>nativeMode()&&['bluepill','nucleo-f103rb'].includes(board().id);
const temperatureLessonFor=id=>id==='bluepill'?stm32TemperatureLessonId:id==='uno-r3'?i2cTemperatureLessonId:null;
const temperatureAlarmFirmware={file:'temperature',parameter:'ALARM_C',variants:[['temperature-30','30 °C'],['temperature-38','38 °C']]};
const temperatureDisplayFirmware={file:'temperature-display',parameter:'DISPLAY_FAHRENHEIT',variants:[['temperature-display-c','摄氏'],['temperature-display-f','华氏']]};
const temperatureFirmwareFor=id=>id===stm32TemperatureDisplayLessonId?temperatureDisplayFirmware
 :id===stm32TemperatureLessonId||id===i2cTemperatureLessonId?temperatureAlarmFirmware:null;
const nativeSourceRequests=new Map();
let nativeDraftOriginal=null,nativeDraftJob=null,appliedNativeDraft=null;
const isStm32Native=profile=>Boolean(getStm32FirmwareTarget(profile.id));
const isRp2040Native=profile=>profile.id==='pico';
const nativeCore=profile=>isStm32Native(profile)?'Cortex-M3':isRp2040Native(profile)?'Cortex-M0+':'AVR';
const firmwareTargetName=profile=>profile.name.includes(profile.mcu)?profile.name:profile.name+' · '+profile.mcu;
const firmwareFromProject=project=>project?.rp2040Firmware??project?.stm32Firmware??project?.avrFirmware;
function firmwareProjectFields(){
 if(!loadedFirmware)return {};
 const profile=board();
 const key=isRp2040Native(profile)?'rp2040Firmware':isStm32Native(profile)?'stm32Firmware':'avrFirmware';
 return {[key]:loadedFirmware};
}
function parseFirmwareImage(firmware,profile){
 if(isRp2040Native(profile))return parseProjectUf2(firmware.uf2);
 return isStm32Native(profile)?parseStm32Hex(firmware.hex,profile.id):parseAvrHex(firmware.hex,{flashBytes:profile.flashBytes});
}
function formatFirmwareAddress(address){
 return '0x'+address.toString(16).toUpperCase().padStart(address>=STM32_FLASH_BASE?8:4,'0');
}
function validateFirmware(file,profile){
 if(isRp2040Native(profile))return validateRp2040Firmware(file,profile.id);
 return (isStm32Native(profile)?validateStm32Firmware:validateAvrFirmware)(file,profile.id);
}
const firmwareExtension=name=>name.slice(name.lastIndexOf('.')+1).toLowerCase();
async function readFirmwarePayload(file,ext,boardId){
 if(ext==='uf2')return {uf2:encodeProjectUf2(new Uint8Array(await file.arrayBuffer()))};
 return {hex:ext==='bin'?stm32BinToHex(new Uint8Array(await file.arrayBuffer()),boardId):await file.text()};
}
const avrCircuitIO=createAvrCircuitIO(()=>circuit,sim);
const isArduino=()=>/\.(ino|cpp)$/i.test(activeFile)||Object.values(files).some(t=>/\bvoid\s+(setup|loop)\s*\(/.test(t));
let inspectorKey=null,explanationCache=null;
let potAdjustment=null;
let buttonReplay=null,buttonCapture=null,buttonReference=null,buttonReplayStatus='';
const buttonReplayHoldMs=25,buttonReplayEndMs=44;
let drafts={};
const isImportedExample=id=>id==='imported'||String(id).startsWith('imported:');
const importedNativeOptions=meta=>meta?.execution==='stm32-c'?{nativeOnly:true,language:'c',execution:'stm32-c'}:{};
function findExample(id){const standard=examples.find(x=>x.id===id);if(standard)return standard;const d=drafts[id];if(d&&isImportedExample(id))return {...(d.meta||{title:'导入的工程',shortTitle:'导入工程',description:'你导入的代码与接线'}),...importedNativeOptions(d.meta),id,boardId:d.circuit.boardId||'bluepill',files:d.files,circuitData:d.circuit,imported:true};return example?.id===id?example:null;}
function examplesForBoard(id){return [...examples.filter(ex=>ex.boardId===id),...Object.keys(drafts).filter(isImportedExample).map(findExample).filter(ex=>ex&&ex.boardId===id)];}
function snapshotCircuit() {
 const copy = clone(circuit);
 const index=potAdjustment?circuit.components.indexOf(potAdjustment.part):-1;
 if(index>=0){
  if(potAdjustment.initial===undefined)delete copy.components[index].position;
  else copy.components[index].position=potAdjustment.initial;
 }
 delete copy.board.userButtonPressed;
 for (const part of copy.components) if (part.type === 'button') part.pressed = false;
 return copy;
}
function importedWorkspaceMeta(){return {id:example.id,title:example.title,shortTitle:example.shortTitle,description:example.description,learningGoals:example.learningGoals,boardId:circuit.boardId||'bluepill',imported:true,execution:example.execution};}
function snapshotDraft(){drafts[example.id]={files:clone(files),circuit:snapshotCircuit(),activeFile,...firmwareProjectFields(),...(isImportedExample(example.id)?{meta:importedWorkspaceMeta()}:{})};boardLastExamples[circuit.boardId||'bluepill']=example.id;}
function savedWorkspace(){return {version:2,exampleId:example.id,exampleMeta:isImportedExample(example.id)?importedWorkspaceMeta():undefined,files,circuit:snapshotCircuit(),activeFile,...firmwareProjectFields(),drafts,boardLastExamples,bom:catalog?.getBOM()||persisted?.bom||[],audience};}
const safeURL=u=>/^https?:\/\//.test(u??'')?u:'#';
const fmt=(n,d=2)=>n!=null&&Number.isFinite(Number(n))?Number(n).toFixed(d):'—';
let persisted=null;try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');if(raw){const restored=parseLabProject(raw);persisted=raw;files=restored.files;circuit=restored.circuit;loadedFirmware=firmwareFromProject(restored);drafts={};for(const [id,d] of Object.entries(raw.drafts||{})){try{const checked=parseLabProject({version:2,files:d.files,circuit:d.circuit,activeFile:d.activeFile,exampleMeta:d.meta,avrFirmware:d.avrFirmware,stm32Firmware:d.stm32Firmware,rp2040Firmware:d.rp2040Firmware});drafts[id]={...d,...checked,meta:checked.exampleMeta};}catch{}}boardLastExamples=raw.boardLastExamples&&typeof raw.boardLastExamples==='object'?raw.boardLastExamples:{};example=isImportedExample(raw.exampleId)?{...restored.exampleMeta,...importedNativeOptions(restored.exampleMeta),id:raw.exampleId,boardId:circuit.boardId,imported:true}:examples.find(ex=>ex.id===raw.exampleId&&ex.boardId===circuit.boardId)||examples.find(ex=>ex.boardId===circuit.boardId)||examples[0];activeFile=restored.activeFile;if(isImportedExample(example.id))snapshotDraft();}}catch{persisted=null;}

function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function save(){clearTimeout(saveTimer);$('#saveState').textContent='正在保存…';saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(savedWorkspace()));$('#saveState').textContent='已在此浏览器保存';}catch{$('#saveState').textContent='保存空间不足，请导出工程';}},350);}
function modal(title,html){clearBoardHolePicker();firmwareReviewRequest++;$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modal').showModal();}
$('#modalClose').onclick=()=>$('#modal').close();$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').close();});
const inspectionRoutes=new Set(['blue-pill','uno-r3','esp32-devkitc','pico','nano','nucleo-f103rb']);
const pageNames={lab:'实验台','blue-pill':'实物对照','uno-r3':'实物对照','esp32-devkitc':'实物对照',pico:'实物对照',nano:'实物对照','nucleo-f103rb':'实物对照',learn:'跟着学',library:'资料库',glossary:'库函数',faults:'查故障'};
let bluePillInspector=null,bluePillLoading=false;
async function showBluePillInspector(){
 if(bluePillInspector||bluePillLoading||$('#appFrame').hidden)return;
 const host=$('#bluePillInspector');
 bluePillLoading=true;
 host.textContent='正在准备板卡对照和三维模型…';
 try{
  const {mountBoardInspector}=await import('./blue-pill-inspector.js');
  if(!inspectionRoutes.has(currentPage)||$('#appFrame').hidden)return;
  bluePillInspector=mountBoardInspector(host,{
   boardId:currentPage,activeBoardId:board().id,onBoard:go,
   onUseBoard:id=>{selectBoard(id);$('#boardSelectButton').focus();},
   onExperiment:()=>{
    if(example.id!==stm32NativeButtonLessonId)loadExample(stm32NativeButtonLessonId);
    go('lab');$('#openNativeDraft').click();
   },
   onBack:()=>{go('lab');$('#labCompareButton').focus();}
  });
  bluePillInspector.focus();
 }catch(error){
  if(inspectionRoutes.has(currentPage)){
   console.error('Board comparison',error);
   const retry=document.createElement('button');retry.className='button primary-light';retry.type='button';retry.textContent='重试加载实物对照';retry.onclick=showBluePillInspector;
   host.replaceChildren(document.createTextNode('实物对照暂时未能载入。 '),retry);
  }
 }finally{bluePillLoading=false;}
}

function cancelPendingConnection(){
 selectedPin=null;
 workbench?.cancelInteraction();
 $('#cancelWireButton').hidden=true;
}

function leaveWorkbench(){
 cancelProbePicking();
 clearBoardHolePicker();
 clearPartPlacement();
 if(mode==='wire')setMode('orbit');else cancelPendingConnection();
 if(circuit.board.userButtonPressed)setBoardUserButton(false);
 for(const part of circuit.components)if(part.type==='encoder')setEncoderSwitch(part,false);
}

function go(page, updateAddress=true){
 if(currentPage==='lab'&&page!=='lab'){cancelNativeDraftCompile();leaveWorkbench();}
 if(page!==currentPage&&bluePillInspector){bluePillInspector.destroy();bluePillInspector=null;}
 currentPage=page;
 const comparison=inspectionRoutes.has(page);
 $('#mainContent').scrollTop=0;
 $('.workspace-breadcrumb b').textContent=pageNames[page]||pageNames.lab;
 catalog?.close();
 for(const panel of $$('.page'))panel.classList.toggle('active',panel.id==='page-'+(comparison?'blue-pill':page));
 for(const nav of $$('.nav-item')){
  const active=nav.dataset.page===(comparison?'blue-pill':page);
  nav.classList.toggle('active',active);
  if(active)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');
 }
 if(updateAddress&&location.hash!=='#'+page)window.history.pushState({},'','#'+page);
 if(page==='lab')setTimeout(()=>workbench?.resize(),40);
 else{setObjectPopover(null);pause();window.scrollTo({top:0,behavior:'smooth'});}
 if(comparison)showBluePillInspector();
}
function syncHashPage(){const page=location.hash.slice(1)||'lab';if(page!==currentPage&&Object.hasOwn(pageNames,page))go(page,false);}
window.addEventListener('hashchange',syncHashPage);
function compareCurrentBoard(){
 const profile=board(),route=profile.id==='bluepill'?'blue-pill':profile.id;
 if(inspectionRoutes.has(route)){go(route);return;}
 const geometry=boardModelTier({profileId:profile.id})==='detailed'?'精细 3D':'教学 3D';
 modal('查看 '+profile.name,`<p>这块板可以在实验台查看 ${geometry}。实物照片对照和芯片拆解还在待建模清单中。</p>
 <div class="project-actions"><button class="button primary" id="showCurrentBoardGeometry">在实验台看这块板</button>
 <button class="button" id="browseBoardInspections">浏览已完成的实物对照</button></div>`);
 $('#showCurrentBoardGeometry').onclick=()=>{
  $('#modal').close();
  go('lab');
  workbench?.resize();
  workbench?.focusBoard();
 };
 $('#browseBoardInspections').onclick=()=>{$('#modal').close();go('blue-pill');};
}
$$('[data-page]').forEach(b=>b.onclick=b.dataset.page==='blue-pill'?compareCurrentBoard:()=>go(b.dataset.page));$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));$('.brand').onclick=e=>{e.preventDefault();go('lab');};
$('#labCompareButton').onclick=compareCurrentBoard;
function syncBoardUserButton(){
 const button=$('#boardUserButton'),key=board().userButton;
 button.hidden=!key;
 if(!key)return;
 const pressed=Boolean(circuit.board.userButtonPressed);
 button.setAttribute('aria-pressed',String(pressed));
 button.textContent=key.label+(pressed?' 松开':' 按住');
}
function setBoardUserButton(pressed){
 if(!board().userButton)return;
 circuit.board.userButtonPressed=pressed;
 syncBoardUserButton();
 refresh(false);
}
$('#boardUserButton').onclick=()=>setBoardUserButton(!circuit.board.userButtonPressed);
function syncBoardUI(){
 const p=board();$('#currentBoardName').textContent=p.name;$('#boardLogicVoltage').textContent=p.logicVoltage+' V';$('#boardSceneLabel').textContent=p.family+' / 方寸回路';$('#bootLabel').hidden=!p.family.startsWith('STM32');$('#editorDialect').textContent=isArduino()?(p.style==='raspberry-pi-sbc'?'GPIO 教学接口 · BCM 编号':p.arduinoExport===false?'Arduino 风格 · 教学接口':'Arduino · C 子集'):'C · 标准外设库';
 syncBoardUserButton();
 syncBoardHardwareReset();
 syncFirmwareView();
 const compare=$('#compareD13Board');
 compare.hidden=!example.compareExample;
 compare.textContent=example.compareLabel??'';
 const list=examplesForBoard(p.id);$('#exampleSelect').innerHTML=list.map(ex=>'<option value="'+esc(ex.id)+'">'+esc(ex.title)+'</option>').join('');$('#exampleSelect').value=example.id;renderBeginnerGuide();
 const pins=[...new Set(p.gpioPins||p.pins.filter(x=>x.kind==='gpio').map(x=>x.canonical))];
 if(pins.includes(example.watchPin))wavePin=example.watchPin;
 else if(!pins.includes(wavePin))wavePin=(p.id==='pico'&&example.id==='pico:blink'?p.ledPin:p.defaultPins?.led)||pins[0];
 $('#wavePinSelect').innerHTML=pins.map(n=>'<option>'+esc(n)+'</option>').join('');$('#wavePinSelect').value=wavePin;
}
$('#exampleSelect').onchange=e=>loadExample(e.target.value);
$('#compareD13Board').onclick=()=>{if(example.compareExample)loadExample(example.compareExample);};
function loadExample(id,reset=false){
 const ex=findExample(id);if(!ex)return;if(reset&&isImportedExample(id))return toast('自有工程没有内置默认版本。请撤销电路操作，或重新导入保存的工程。');
 sourceTraceSignal='pin';trackedLedId=null;
 clearBoardHolePicker();
 clearVoltageProbes({close:true});clearPartPlacement();pause();if(!reset)snapshotDraft();else delete drafts[id];example=ex;const cached=drafts[id],draft=!reset&&cached?.circuit.boardId===(ex.boardId||'bluepill')?cached:null;files=draft?clone(draft.files):clone(ex.files);if(!reset)loadedFirmware=firmwareFromProject(draft);activeFile=draft&&draft.activeFile in files?draft.activeFile:Object.keys(files).find(x=>x==='main.c')||Object.keys(files)[0];circuit=draft?clone(draft.circuit):ex.circuitData?clone(ex.circuitData):createCircuit(ex.circuitPreset||id);circuit.boardId=ex.boardId||'bluepill';selected=null;selectedPin=null;selectedWire=null;selectedParts.clear();lastPartRemoval=null;setObjectPopover(null);undoStack=[];redoStack=[];updateUndoButtons();$('#powerSwitch').checked=!!circuit.powered;$('#bootSwitch').checked=!!circuit.boot0;syncBoardUI();resetRuntime();renderFiles();loadEditor();workbench?.setCircuit(circuit);workbench?.home();refresh();save();scheduleCheck();toast(draft?'已恢复这个实验的草稿，包含代码与接线。':'已载入 '+ex.shortTitle+'，电路已预接线。');
}
function selectBoard(id){if(id===(circuit.boardId||'bluepill')){toast('当前正在使用这块开发板。');return;}const wanted=findExample(boardLastExamples[id]),ex=wanted?.boardId===id?wanted:examplesForBoard(id)[0];if(!ex)return toast('这块板目前只有资料目录，尚未实现运行模型。');loadExample(ex.id);go('lab');}
function circuitSnapshot(includeCode=false){return {circuit:snapshotCircuit(),selected,selectedWire,selectedParts:[...selectedParts],...(includeCode?{files:clone(files),activeFile}:{})};}
function pushUndo({includeCode=false}={}){undoStack.push(circuitSnapshot(includeCode));if(undoStack.length>60)undoStack.shift();redoStack=[];updateUndoButtons();}
function updateUndoButtons(){$('#undoCircuitButton').disabled=!undoStack.length;$('#redoCircuitButton').disabled=!redoStack.length;$('#deleteWireButton').hidden=!selectedWire;renderSceneObjects();syncBoardPlacement();syncBoardUserButton();}
function undoCircuit(redo=false){const from=redo?redoStack:undoStack,to=redo?undoStack:redoStack;if(!from.length)return;clearBoardHolePicker();clearPartPlacement();pause();const restored=from.pop();to.push(circuitSnapshot(!!restored.files));const powerChanged=circuit.powered!==restored.circuit.powered||circuit.boot0!==restored.circuit.boot0;circuit=clone(restored.circuit);if(powerChanged&&nativeMode())resetRuntime();if(restored.files){files=clone(restored.files);activeFile=restored.activeFile in files?restored.activeFile:Object.keys(files)[0];resetRuntime({preserveProgrammed:true});renderFiles();loadEditor();scheduleCheck();}selected=restored.selected&&(['mcu','breadboard'].includes(restored.selected)||circuit.components.some(p=>p.id===restored.selected))?restored.selected:null;selectedWire=circuit.wires.some(w=>w.id===restored.selectedWire)?restored.selectedWire:null;selectedParts.clear();for(const id of restored.selectedParts||[])if(circuit.components.some(part=>part.id===id))selectedParts.add(id);selectedPin=null;$('#powerSwitch').checked=!!circuit.powered;$('#bootSwitch').checked=!!circuit.boot0;workbench?.cancelInteraction();workbench?.setCircuit(circuit);syncSceneSelection();sim.reset({preserveI2cDevices:true,preservePhotocellStates:true,preserveTime:true});inspectorKey=null;refresh();renderInspector();save();updateUndoButtons();toast(redo?'已重做；代码类故障与电路修改一并恢复。':'已撤销最近一步修改。');}
$('#undoCircuitButton').onclick=()=>undoCircuit();$('#redoCircuitButton').onclick=()=>undoCircuit(true);
function deleteWire(id=selectedWire){if(!circuit.wires.some(wire=>wire.id===id))return;pushUndo();circuit.wires=circuit.wires.filter(w=>w.id!==id);if(selectedWire===id)selectedWire=null;finishSceneEdit();}
$('#deleteWireButton').onclick=()=>deleteWire();$('#cancelWireButton').onclick=()=>{cancelPendingConnection();$('#scene [role="application"]')?.focus({preventScroll:true});};
function scenePartName(part) {
  if(part.type==='servo'&&part.servoModel==='hs55')return 'Hitec HS-55';
  if(part.type==='motor'&&part.motorModel==='fa130-18100')return 'Mabuchi FA-130RA-18100';
  if(part.type==='rgbled'&&part.rgbModel===kingbrightRgbModel)return 'Kingbright WP154A4 RGB 灯';
  return part.displayName || PARTS[part.type].name;
}
function syncSceneSelection() {
  workbench?.setSelected(selected || selectedWire);
  workbench?.setPartSelection?.([...selectedParts]);
}
function focusSceneCanvas() {
  $('#scene [role="application"]')?.focus({preventScroll:true});
}
function selectScenePart(id, { additive = false } = {}) {
  if (id!=='mcu') clearBoardHolePicker();
  if (partPlacement && (additive || id!==partPlacement.id)) clearPartPlacement();
  selectedWire = null;
  if (!additive || !circuit.components.some(part => part.id === id)) selectedParts.clear();
  if (circuit.components.some(part => part.id === id)) {
    if (additive && selectedParts.has(id)) selectedParts.delete(id);
    else selectedParts.add(id);
    selected = [...selectedParts].at(-1) || null;
  } else {
    selected = id;
  }
  syncSceneSelection();
  if (selected) $('#inspectorPanel').classList.remove('collapsed');
  updateUndoButtons();
  renderInspector();
  if(!nativeMode()){
   renderServoFeedback(sourceServoReading());
   renderPwmRcFeedback(sourceRcReading());
  }
  renderSevenSegmentFeedback(sourceSegmentReading());
  renderUltrasonicPanels();
  renderI2cOledPanels();
  renderI2cTemperaturePanels();
}
function selectSceneWire(id) {
  clearBoardHolePicker();
  clearPartPlacement();
  selectedWire = id;
  selected = null;
  selectedParts.clear();
  syncSceneSelection();
  $('#inspectorPanel').classList.remove('collapsed');
  updateUndoButtons();
  renderInspector();
}
function setObjectPopover(open) {
  for (const id of ['sceneObjects', 'sceneActions']) {
    const expanded = open === id;
    $('#' + id + 'Toggle').setAttribute('aria-expanded', String(expanded));
    $('#' + id + 'Popover').hidden = !expanded;
  }
}
function openPartContext(id) {
  if (!circuit.components.some(part => part.id === id)) return;
  if (!selectedParts.has(id)) selectScenePart(id);
  setObjectPopover('sceneActions');
  const remove = $('#sceneMenuDelete');
  (remove.disabled ? $('#sceneLockPart') : remove).focus({ preventScroll: true });
}
function wireSceneLabel(wire) {
  const label=endpoint=>{
    if(endpoint.startsWith('bb:'))return '面包板 '+endpoint.slice(3).toUpperCase();
    if(endpoint.startsWith('mcu:')){
      const pin=board().pins.find(pin=>pin.id===endpoint.slice(4));
      return pin?.location?`${pin.location} ${pin.label}`:pin?.label??endpoint.slice(4);
    }
    return endpoint;
  };
  return label(wire.a)+' → '+label(wire.b);
}
function chooseSceneTarget(kind,id) {
  setSceneCameraMode('edit');
  setObjectPopover(null);
  if(kind==='wire')selectSceneWire(id);else selectScenePart(id);
  focusSceneCanvas();
}
function showPickCandidates(candidates) {
  const targets=candidates.flatMap(({kind,id})=>{
    if(kind==='wire'){
      const wire=circuit.wires.find(item=>item.id===id);
      return wire?[{kind,id,name:'导线 '+id,detail:wireSceneLabel(wire)}]:[];
    }
    const part=circuit.components.find(item=>item.id===id);
    const name=id==='mcu'?board().name:id==='breadboard'?'面包板':part&&scenePartName(part);
    return name?[{kind,id,name,detail:part?id:''}]:[];
  });
  if(targets.length<2)return;
  modal('选择重叠的物件',`<p>同一位置有多个物件。选中其中一个后，实验台会标出它。</p>
    <div class="scene-pick-choices">${targets.map(({name,detail},index)=>
    `<button type="button" class="button" data-pick-choice="${index}"><strong>${esc(name)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</button>`).join('')}</div>`);
  for(const button of $$('[data-pick-choice]'))button.onclick=()=>{
    const {kind,id}=targets[Number(button.dataset.pickChoice)];
    $('#modal').close();
    chooseSceneTarget(kind,id);
  };
  $('[data-pick-choice]')?.focus({preventScroll:true});
}
function renderSceneObjects() {
  const parts = circuit.components.filter(part => selectedParts.has(part.id));
  const mutable = parts.filter(part => !part.locked);
  const rotatable = mutable.filter(part => !part.mount);
  const active = circuit.components.find(part => part.id === selected);
  const rowsKey = JSON.stringify([board().name, circuit.components.map(p => [p.id, scenePartName(p), p.locked, p.hidden, p.mount]),
    circuit.wires.map(wire=>[wire.id,wire.a,wire.b,wire.color])]);
  if (sceneObjectRowsKey !== rowsKey) {
    const focused = document.activeElement;
    const focusedId = focused?.dataset.objectSelect || focused?.dataset.objectCheck;
    const focusedWire = focused?.dataset.objectWire;
    const focusOnCheck = focused?.hasAttribute('data-object-check');
    const row = (id, name, part) => '<li data-object-row="' + esc(id) + '">' +
      (part ? '<label class="scene-object-check"><input type="checkbox" aria-label="多选 ' + esc(name + ' ' + id) + '" data-object-check="' + esc(id) + '"></label>' : '') +
      '<button type="button" data-object-select="' + esc(id) + '"><span>' + esc(name) + '</span>' +
      (part ? '<code>' + esc(id) + '</code>' : '') + '</button>' +
      '<span class="scene-object-flags">' + (part ? [part.locked && '已锁定', part.hidden && '已隐藏',part.mount && '已插装'].filter(Boolean).join(' · ') : '底座') + '</span></li>';
    $('#sceneBaseObjects').innerHTML = row('mcu', board().name) + row('breadboard', '面包板');
    $('#sceneComponents').innerHTML = circuit.components.map(part => row(part.id, scenePartName(part), part)).join('') ||
      '<li class="scene-object-flags">暂无元件，可用「添加硬件」。</li>';
    $('#sceneWires').innerHTML = circuit.wires.map(wire=>{
      const name=wireSceneLabel(wire);
      const color=/^#[0-9a-f]{6}$/i.test(wire.color)?wire.color:'#df7651';
      return `<li data-wire-row="${esc(wire.id)}"><button type="button" data-object-wire="${esc(wire.id)}" title="${esc(name)}">
        <i class="scene-wire-swatch" style="background:${color}" aria-hidden="true"></i><span>${esc(name)}</span><code>${esc(wire.id)}</code>
      </button></li>`;
    }).join('')||'<li class="scene-object-flags">暂无导线。</li>';
    sceneObjectRowsKey = rowsKey;
    if(focusedWire){
      ($$('[data-object-wire]').find(control=>control.dataset.objectWire===focusedWire)||
        $('#sceneObjectsToggle')).focus({preventScroll:true});
    }else if (focusedId) {
      const controls = $$(focusOnCheck ? '[data-object-check]' : '[data-object-select]');
      (controls.find(control => (focusOnCheck ? control.dataset.objectCheck : control.dataset.objectSelect) === focusedId) ||
        $('#sceneObjectsToggle')).focus({ preventScroll: true });
    }
  }
  for (const row of $$('[data-object-row]')) {
    const id = row.dataset.objectRow;
    const checked = selected === id || selectedParts.has(id);
    row.classList.toggle('is-selected', checked);
    row.querySelector('button').setAttribute('aria-pressed', String(checked));
    const checkbox = row.querySelector('input');
    if (checkbox) checkbox.checked = checked;
  }
  for(const row of $$('[data-wire-row]')){
    const checked=row.dataset.wireRow===selectedWire;
    row.classList.toggle('is-selected',checked);
    row.querySelector('button').setAttribute('aria-pressed',String(checked));
  }
  $('#sceneObjectsCount').textContent = String(circuit.components.length+circuit.wires.length);
  const summary = $('#sceneObjectSelection');
  const boardSelected = selected==='mcu';
  const seated = boardSelected && Boolean(circuit.board.mount);
  const mountOptions = boardSelected ? getMountOptions(board()) : null;
  const seatedRows = seated && boardMountRows(circuit.board.mount,mountOptions);
  const shortcutsAvailable = sceneCameraMode==='edit' && (mode==='orbit' || mode==='move');
  const locked = Boolean(circuit.board.locked);
  const boardHint = seatedRows ? `${seatedRows.join('/').toUpperCase()} ${circuit.board.mount.column} 列 · ` : '';
  const label = parts.length > 1 ? '已选 ' + parts.length + ' 个元件' + (parts.length > mutable.length ? ' · ' + (parts.length - mutable.length) + ' 个锁定' : '') :
    active ? scenePartName(active) + ' · ' + active.id + (active.mount ? ' · 已插装' : '') + (active.locked ? ' · 已锁定' : '') + (active.hidden ? ' · 已隐藏' : '') :
    selectedWire ? '已选导线 · ' + selectedWire : boardSelected ? `已选 ${boardHint}${board().name}${locked?' · 已锁定':''}` : selected === 'breadboard' ? '已选面包板' : '点击模型或打开元件列表';
  if (summary.textContent !== label) summary.textContent = label;
  summary.title = label;
  summary.dataset.selected = String(!!(selected || selectedWire));
  const removeText = parts.length > 1 ? '删除 ' + mutable.length + ' 个元件' : '删除元件';
  for (const button of [$('#sceneDeletePart'), $('#sceneMenuDelete')]) {
    button.textContent = removeText;
    button.disabled = !mutable.length;
  }
  $('#sceneMenuDelete').hidden = !parts.length;
  const placing = Boolean(active && isPartPlacing(active.id));
  const adjustable = parts.length===1 && canAdjustMountedPart(active);
  const moveBoard = $('#sceneMoveBoard');
  $('#sceneFocusBoard').setAttribute('aria-pressed',String(boardSelected));
  $('#sceneBoardSlots').hidden = !mountOptions;
  moveBoard.disabled = locked;
  moveBoard.textContent = boardHolePicker ? '结束点孔' : seated ? '换孔位 · 点孔' : '点孔插板';
  moveBoard.title = seated ? '在画布上直接点新起始孔，确认后换孔' : '在画布上点两排针的起始孔';
  moveBoard.setAttribute('aria-expanded',String(Boolean(boardHolePicker)));
  for (const [id, edge] of [['#sceneBoardLeft',mountOptions?.minColumn],['#sceneBoardRight',mountOptions?.maxColumn]]) {
    const button = $(id);
    button.hidden = !seated || Boolean(boardHolePicker);
    button.setAttribute('aria-disabled', String(locked || circuit.board.mount?.column===edge));
  }
  for (const button of [$('#sceneRotateQuick'), $('#sceneRotatePart')]) {
    button.disabled = boardSelected ? Boolean(circuit.board.locked) : placing || (!rotatable.length && !adjustable);
    button.textContent = adjustable ? '↻ 调整插位' : '↻ 旋转 90°' + (shortcutsAvailable && !button.disabled ? ' · R' : '');
    button.setAttribute('aria-label',boardSelected?'旋转所选开发板 90°':adjustable?'调整已插装元件的位置和朝向':'旋转所选元件 90°');
    if (shortcutsAvailable && !button.disabled && !adjustable) button.setAttribute('aria-keyshortcuts','R Shift+R');
    else button.removeAttribute('aria-keyshortcuts');
    button.title = boardSelected ? (seated?'聚焦画布后按 R 或 Shift+R 打开旋转选项。转 90° 需要拔下开发板。':'聚焦画布后按 R 转 90°，Shift+R 反向')
      : placing ? '可在选孔工具条中转向' : adjustable ? '点此调整插位。R 转向，Shift + R 反向转。'
      : rotatable.length ? 'R 旋转 90°，Shift + R 反向旋转'
      : parts.some(part=>part.mount) ? '选中一个已插装且可编辑的元件来调整' : parts.length ? '解锁元件后可旋转' : '先选中一个元件';
  }
  const plugButton = $('#partMountButton');
  plugButton.hidden = parts.length!==1 || !canMountPart(active?.type);
  plugButton.disabled = !active || !!active.locked || !!(active.hidden && !active.mount);
  plugButton.setAttribute('aria-expanded',String(placing));
  plugButton.textContent = placing ? (active.mount?'取消换位':'取消插装') : active?.mount ? '拔下元件' : '把元件插入面包板';
  $('#sceneCopyPart').disabled = !parts.length || circuit.components.length + parts.length > 80;
  $('#sceneLockPart').disabled = !parts.length;
  $('#sceneHidePart').disabled = !parts.length;
  $('#sceneLockPart').textContent = parts.length && parts.every(part => part.locked) ? '解锁' : '锁定';
  $('#sceneHidePart').textContent = parts.length && parts.every(part => part.hidden) ? '显示' : '隐藏';
  const canUndoDelete = !!lastPartRemoval && undoStack.at(-1) === lastPartRemoval;
  if (!canUndoDelete && document.activeElement === $('#sceneDeleteUndo')) $('#sceneObjectsToggle').focus({ preventScroll: true });
  $('#sceneDeleteUndo').hidden = !canUndoDelete;
}
function finishSceneEdit() {
  clearBoardHolePicker();
  clearPartPlacement();
  workbench?.cancelInteraction?.();
  selectedPin = null;
  inspectedPin = null;
  $('#cancelWireButton').hidden = true;
  workbench?.setCircuit(circuit);
  syncSceneSelection();
  inspectorKey = null;
  refresh();
  renderInspector();
  save();
  updateUndoButtons();
}
function matchesLessonMount(a,b) {
  // Moving across rows on the same two halves keeps each pin on the same strip.
  return Boolean(a&&b&&a.column===b.column&&a.rotation===b.rotation);
}
function lessonMountLabel(mount) {
  return `第 ${mount.column} 列、USB 朝${mount.rotation===90?'左':'右'}`;
}
function syncBoardPlacement() {
  const profile = board(), options = getMountOptions(profile);
  const pose = boardPose(circuit, profile);
  const mountButton = $('#mountBoardButton');
  const rotateButton = $('#rotateBoardButton');
  const slotButton = $('#mountSlotButton');
  const practiceButton = $('#mountPracticeButton');
  const practice=example.mountPractice;
  const atPracticeSlot=matchesLessonMount(circuit.board.mount,practice);
  const practiceId=profile.id==='bluepill'?'board-insertion':profile.id+':mounted-blink';
  const locked=Boolean(circuit.board.locked);
  const rows=boardMountRows(circuit.board.mount,options)?.join(' / ').toUpperCase();
  const insertHint=mode==='wire' ? '点「插入面包板」。想拖动，请先切到「移动」。' : '拖开发板到信号孔区，两排孔亮绿后松手。';
  const seatedHint=mode==='wire' ? '切到「选择」后可拖板身拔下，也可以直接点「拔下开发板」。'
    : '拖板身换孔，拖到台面空位松手拔下。拖动时按 R 转向。';
  mountButton.textContent = pose.mounted ? '拔下开发板' : options ? '插入面包板' : '用跳线连接';
  mountButton.classList.toggle('primary',Boolean(options && !pose.mounted && !circuit.board.locked));
  rotateButton.textContent = '开发板转 90° · R';
  rotateButton.title = pose.mounted ? '先拔下才能旋转 90°。也可以在插孔内翻转 180°。' : '选中后在实验台按 R 旋转 90°，Shift+R 反向。';
  rotateButton.disabled = !!circuit.board.locked;
  mountButton.disabled = !!circuit.board.locked;
  slotButton.hidden = !options;
  slotButton.disabled = !!circuit.board.locked;
  slotButton.textContent = '按行列选孔';
  $('#unlockBoardButton').hidden=!locked;
  const pinMap=$('#mountPinMapButton');
  pinMap.hidden=!pose.mounted;
  pinMap.title='查看插入后的排针孔位和同组外露孔';
  practiceButton.hidden = pose.mounted || Boolean(practice) || !findExample(practiceId);
  practiceButton.dataset.example = practiceId;
  $('#boardMountStatus').textContent = pose.mounted
    ? `已插入 · ${rows} 排 · 第 ${circuit.board.mount.column} 列起 · ${options.pinCount*2} 针就位，孔组已接通${locked ? ' · 开发板已锁定' : '。'+seatedHint}${!locked&&practice&&!atPracticeSlot ? ' 本实验的灯需要'+lessonMountLabel(practice)+'。' : !locked&&profile.id==='esp32-devkitc' ? ' 一侧孔被板遮住，可从排针引线。' : ''}`
    : locked ? '开发板已锁定。解锁后可移动或插入。'
    : options ? `可直插 · ${options.pinCount*2} 针 · ${options.rowPairs.length} 组排孔可选。` + (practice ? '本实验用'+lessonMountLabel(practice)+'。' : '') + insertHint
    : '此板的排针布局需要用跳线接入当前面包板。';
}
function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function breadboardBounds({x,z}) {
  return {left:x-4.25,right:x+4.25,top:z-2.8,bottom:z+2.8};
}
function findClearScenePosition(breadboard, stationary, boundsAt) {
  for (const dz of [4,-4,7,-7]) {
    const z = breadboard.z+dz;
    if (Math.abs(z)>20) continue;
    for (const dx of [0,2.8,-2.8,5.6,-5.6,8.4,-8.4]) {
      const x = breadboard.x+dx;
      if (Math.abs(x)>30) continue;
      const bounds = boundsAt(x,z);
      if (!stationary.some(item => overlaps(item,bounds))) return {x,z};
    }
  }
  return null;
}
function findClearPartPosition(part, breadboard, stationary) {
  return findClearScenePosition(breadboard,stationary,(x,z)=>componentBounds({...part,x,z}));
}
function boardRestBounds(rotation) {
  const {width,height}=boardVisual(board());
  const direction=rotateBoardPoint(1,0,rotation);
  const halfX=(width*Math.abs(direction.x)+height*Math.abs(direction.z))/2+.08;
  const halfZ=(width*Math.abs(direction.z)+height*Math.abs(direction.x))/2+.08;
  return (x,z)=>({left:x-halfX,right:x+halfX,top:z-halfZ,bottom:z+halfZ});
}
function isBoardTabletopPosition(x,z) {
  return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<=30&&Math.abs(z)<=20;
}
function boardRestIssue(x,z,rotation) {
  if (!isBoardTabletopPosition(x,z)) return '请将开发板拖回台面范围内。';
  const footprint=boardRestBounds(rotation)(x,z);
  if (overlaps(footprint,breadboardBounds(circuit.breadboard))) {
    const mountOptions=getMountOptions(board());
    return mountOptions&&!mountOptions.rotations.includes(rotation)
      ? '板身仍盖住面包板。按 R 对齐排针，或拖到台面空位放下。'
      : '板身仍盖住面包板。请拖到旁边的台面空位。';
  }
  if (circuit.components.some(part=>overlaps(footprint,scenePartBounds(part)))) return '板身会碰到旁边的元件。请换到台面空位。';
  return null;
}
function detachedBoardPosition(rotation=circuit.board.rotation??0) {
  const {x,z}=circuit.board;
  const boundsAt=boardRestBounds(rotation);
  const obstacles=[breadboardBounds(circuit.breadboard),...circuit.components.map(scenePartBounds)];
  if (!obstacles.some(item=>overlaps(item,boundsAt(x,z)))) return {x,z};
  return findClearScenePosition(circuit.breadboard,obstacles,boundsAt);
}
function scenePartBounds(part) {
  const pose = partPose(part,circuit.breadboard);
  return pose.mounted ? mountedPartBodyBounds(part,pose) : componentBounds(part);
}
function partMountChoice(part,mount) {
  const result = evaluatePartMount(circuit,board(),part,mount);
  if (!result.ok) return result;
  const body = mountedPartBodyBounds(part,result.pose);
  const obstacle = circuit.components.find(other => other!==part && !other.mount && overlaps(body,scenePartBounds(other)));
  if (obstacle) return {...result,ok:false,reason:`元件外壳会与 ${scenePartName(obstacle)}（${obstacle.id}）重叠。请换个位置。`};
  return result;
}
function placementPart() {
  return circuit.components.find(part=>part.id===partPlacement?.id);
}
function canAdjustMountedPart(part) {
  return Boolean(part?.mount && canMountPart(part.type) && !part.locked && !part.hidden);
}
function samePartMount(a,b) {
  return Boolean(a && b && a.hole===b.hole && a.rotation===b.rotation);
}
function isPartPlacing(id) {
  return Boolean(partPlacement && (id==null || partPlacement.id===id));
}
function clearPartPlacement(focus=false) {
  if (!partPlacement) return;
  const adjusting=Boolean(placementPart()?.mount);
  partPlacement=null;
  workbench?.setPartPlacementPreview(null);
  $('#partPlacementBar').hidden=true;
  $('#partPlacementConfirm').disabled=true;
  renderSceneObjects();
  if (focus) $(adjusting?'#sceneRotateQuick':'#partMountButton').focus({preventScroll:true});
}
function cancelPartPlacement() {
  clearPartPlacement(true);
  workbench?.cancelInteraction();
}
function partContactLabels(contacts) {
  return contacts.map(({a,b})=>`${a.split(':')[1]} 脚 → ${holeLabel(b)}`).join(' · ');
}
function showPartPlacement(mount=partPlacement?.mount, {dragging=false,reason=partPlacement?.reason}={}) {
  const part=placementPart();
  if (!part) return;
  const adjusting=Boolean(part.mount), unchanged=samePartMount(part.mount,mount);
  const result=mount && !unchanged && partMountChoice(part,mount);
  const preview=result && {id:part.id,ok:result.ok,contacts:result.contacts.length?result.contacts:[{b:mount.hole}]};
  workbench?.setPartPlacementPreview(preview || null);
  const confirm=$('#partPlacementConfirm');
  if (dragging) {
    // Keep the canvas in place while the pointer is aligned to its holes.
    confirm.disabled=true;
    return;
  }
  const bar=$('#partPlacementBar'), rotate=$('#partPlacementRotate'), status=$('#partPlacementStatus');
  bar.hidden=false;
  bar.dataset.placementState=result?.ok?'ready':result||reason?'blocked':'waiting';
  const degrees=partPlacement.rotation+'°';
  if (rotate.textContent!=='↻ '+degrees) rotate.textContent='↻ '+degrees;
  rotate.setAttribute('aria-label','旋转插脚，当前 '+degrees);
  confirm.disabled=!result?.ok;
  let message;
  if (unchanged) message='当前 '+partContactLabels(mountedPartContacts(part))+'。拖动、转向或点新孔来换位。';
  else if (result) message=result.ok ? partContactLabels(result.contacts)+'。确认后才接通。' : result.reason;
  else message=reason || (part.type==='button'?'拖到中央沟槽，或点 E / F 排中第 1 脚所在的孔。'
    :part.type==='dipswitch'?'让两排脚跨过 E / F 沟槽，点第 1 脚所在的孔。'
    :part.type==='sevenseg'?'跨过中央沟槽摆放，或点实物 1 脚（e）的起始孔。':`拖动元件到孔区，或点 ${PARTS[part.type].pins[0]} 脚所在的孔。`);
  if (adjusting) message+=' 原插孔保持接通。';
  if (status.textContent!==message) status.textContent=message;
}
function beginPartPlacement(part) {
  setMode('orbit');
  inspectedPin=null;
  renderPinMeasurement();
  const adjusting=Boolean(part.mount);
  partPlacement={id:part.id,rotation:partMountRotation(part),mount:part.mount?{...part.mount}:null};
  $('#partPlacementTitle').textContent=(adjusting?'调整插位':'选插孔')+' · '+scenePartName(part);
  $('#partPlacementConfirm').textContent=adjusting?'确认换位':'插入并接通';
  showPartPlacement();
  renderSceneObjects();
  $('#partPlacementManual').focus({preventScroll:true});
}
function choosePartPlacementPin(endpoint) {
  const part=placementPart();
  if (!part || !signalStrip(endpoint)) return;
  if (part.type==='button' && /^[ef]$/.test(endpoint[3])) partPlacement.rotation=endpoint[3]==='f'?90:270;
  if (part.type==='dipswitch' && /^[ef]$/.test(endpoint[3])) partPlacement.rotation=endpoint[3]==='f'?0:180;
  partPlacement.mount={hole:endpoint,rotation:partPlacement.rotation};
  partPlacement.reason='';
  showPartPlacement();
}
function dragPartPlacement(id,x,z,finished=false) {
  if (!isPartPlacing(id)) return;
  const part=placementPart();
  if (!part) return;
  const mount=nearestPartMount(part,circuit.breadboard,{x,z,rotation:partPlacement.rotation},{allowMounted:true});
  const reason=mount?'':part.type==='button'?'把按键移到中央沟槽，再对准 E / F 排。'
    :part.type==='dipswitch'?'拨码的两排脚需跨过 E / F 沟槽。'
    :part.type==='sevenseg'?'让数码管两排脚跨过沟槽。靠近信号孔，或按行列选孔。':'请把元件拖到信号孔区，或直接点起始孔。';
  if (finished) Object.assign(partPlacement,{mount,reason});
  showPartPlacement(mount,{dragging:!finished,reason});
}
function turnPartPlacement(step) {
  const part=placementPart();
  if (!part) return;
  const turns=partMountRotations(part.type);
  const index=turns.indexOf(partPlacement.rotation);
  const rotation=turns[(index+step+turns.length)%turns.length];
  const previous=partPlacement.mount ?? part.mount;
  partPlacement.rotation=rotation;
  partPlacement.reason='';
  if (previous) {
    const {pose,contacts}=partMountChoice(part,previous);
    partPlacement.mount=contacts.length
      ? nearestPartMount(part,circuit.breadboard,{...pose,rotation},{allowMounted:true})
      : {...previous,rotation};
    if (!partPlacement.mount) partPlacement.reason='这附近的孔距放不下这个朝向。可拖到别处，或点一个新的起始孔。';
  }
  showPartPlacement();
}
function rotateMountedPart(id,step) {
  const part=circuit.components.find(item=>item.id===id);
  if (selected!==id || selectedParts.size!==1 || !canAdjustMountedPart(part)) return false;
  beginPartPlacement(part);
  turnPartPlacement(step);
  return true;
}
function commitPartPlacement(part,mount) {
  if (!part || !mount || samePartMount(part.mount,mount) || part.locked || part.hidden || !circuit.components.includes(part)) return;
  const result=partMountChoice(part,mount);
  if (!result.ok) return false;
  const adjusting=Boolean(part.mount);
  pushUndo();
  part.mount=mount;
  if ($('#modal').open) $('#modal').close();
  finishSceneEdit();
  $(adjusting?'#sceneRotateQuick':'#partMountButton').focus({preventScroll:true});
  toast(adjusting?'元件已换到新孔位，可撤销恢复。':'元件已插入，对应孔组已接通。可撤销。');
  return true;
}
$('#partPlacementRotate').onclick=()=>turnPartPlacement(1);
$('#partPlacementCancel').onclick=cancelPartPlacement;
$('#partPlacementManual').onclick=()=>{const part=placementPart();if(part)showPartMount(part);};
$('#partPlacementConfirm').onclick=()=>{
  if (commitPartPlacement(placementPart(),partPlacement?.mount)===false) showPartPlacement();
};
document.addEventListener('keydown', event=>{
  if (!partPlacement || $('#modal').open) return;
  if (event.key==='Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancelPartPlacement();
    return;
  }
  if (event.target.closest?.('input,textarea,select,[contenteditable]')) return;
  if (['Backspace','Delete'].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
  } else if (event.target === $('#scene [role="application"]') && document.activeElement===event.target) {
    const rotation=sceneRotationStep(event);
    if(!rotation)return;
    event.preventDefault();
    event.stopPropagation();
    turnPartPlacement(rotation/90);
  }
},true);
function showPartMount(part) {
  const button=part.type==='button';
  const display=part.type==='sevenseg';
  const dip=part.type==='dipswitch';
  const rotations=partMountRotations(part.type);
  const rowForRotation=rotation=>rotation===90?'f':'e';
  const allowedRows=rotation=>button?rowForRotation(rotation):display?sevenSegmentAnchorRows(rotation):dip?dipSwitchAnchorRows(rotation):'abcdefghij';
  const columns=Array.from({length:30},(_,i)=>i+1);
  const base=circuit.breadboard;
  const rotation=partPlacement?.rotation ?? partMountRotation(part);
  const rowNames=allowedRows(rotation);
  const nearby=Array.from(rowNames,row=>columns.map(column=>signalHole(row,column))).flat()
    .map(hole=>({hole:hole.endpoint,distance:Math.hypot(base.x+hole.x-part.x,base.z+hole.z-part.z)}))
    .sort((a,b)=>a.distance-b.distance);
  const initial=partPlacement?.mount?.hole ?? nearby.find(({hole})=>partMountChoice(part,{hole,rotation}).ok)?.hole ?? nearby[0].hole;
  const pins=PARTS[part.type].pins;
  const rowOptions=Array.from(button||dip?'ef':display?'bcdefghi':rowNames,row=>`<option value="${row}">${row.toUpperCase()} 排</option>`).join('');
  const columnOptions=columns.map(n=>`<option value="${n}">第 ${n} 列</option>`).join('');
  const directions=button?{90:'1 / 2 脚在 F 排',270:'1 / 2 脚在 E 排'}
    :display?{0:'正向 · 小数点在右下',180:'倒转 · 小数点在左上'}
    :dip?{0:'1 脚在 F 排 · 编号向右',180:'1 脚在 E 排 · 编号向左'}
    :{0:'向大列号',180:'向小列号',90:'朝 A 排（跨沟槽）',270:'朝 J 排（跨沟槽）'};
  const rotationOptions=rotations.map(value=>`<option value="${value}">${directions[value]}</option>`).join('');
  const guidance=button?'让 1 / 2 脚和 3 / 4 脚分居沟槽两侧。按住时两组才接通。'
    :display?'选实物 1 脚（e）所在的孔。两排共 10 脚需跨过中央沟槽。'
    :dip?'选实物 1 脚所在的孔。八脚横跨 E / F 沟槽，四路互相独立。'
    :part.type==='diode'?'先选 A 脚的孔。色环侧是 K，隔三列，也可跨 E / F 排的沟槽。'
    :part.type==='capacitor'?'先选正极 + 的孔。负极条纹侧插入相邻列。'
    :`先选 ${esc(pins[0])} 脚的孔，方向决定另一脚 ${esc(pins[1])} 的位置。`;
  const adjusting=Boolean(part.mount);
  modal(adjusting?'调整元件插位':'把元件插入面包板',`<form id="partMountForm" class="mount-placement-form">
    <p>${esc(scenePartName(part))} <code>${esc(part.id)}</code>。${guidance}</p>
    <div class="part-mount-fields"><label for="partMountRow">${button||display||dip?'1 脚所在排':'起始排'}<select id="partMountRow" ${button||dip?'disabled':'autofocus'}>${rowOptions}</select></label><label for="partMountColumn">起始列<select id="partMountColumn" ${button||dip?'autofocus':''}>${columnOptions}</select></label><label for="partMountRotation">${button?'按键朝向':display?'显示朝向':dip?'拨码朝向':'第二脚朝向'}<select id="partMountRotation">${rotationOptions}</select></label></div>
    <p class="mount-placement-status" id="partMountStatus" role="status" aria-atomic="true"></p>
    <div class="project-actions mount-placement-actions"><button class="button" type="button" id="partMountCancel">取消</button><button class="button primary" type="submit" id="partMountApply">${adjusting?'确认换位':'插入并接通'}</button></div></form>`);
  const row=$('#partMountRow'),column=$('#partMountColumn'),direction=$('#partMountRotation');
  row.value=initial[3];column.value=initial.slice(4);direction.value=String(rotation);
  const selection=()=>({hole:'bb:'+row.value+column.value,rotation:Number(direction.value)});
  const update=()=>{
    if (button) row.value=rowForRotation(Number(direction.value));
    if (dip) row.value=dipSwitchAnchorRows(Number(direction.value));
    if (display) {
      const rows=allowedRows(Number(direction.value));
      for(const option of row.options)option.disabled=!rows.includes(option.value);
      if(!row.value||!rows.includes(row.value))row.value=rows[1];
    }
    const mount=selection();
    const unchanged=samePartMount(part.mount,mount);
    const result=unchanged?{ok:false,reason:'这是当前插孔。选择新孔或朝向后可确认换位。'}:partMountChoice(part,mount);
    $('#partMountApply').disabled=!result.ok;
    $('#partMountForm').dataset.placementState=result.ok?'ready':unchanged?'waiting':'blocked';
    $('#partMountStatus').textContent=(result.ok ? partContactLabels(result.contacts)+(button?'。松开时沟槽两侧分离。':'。确认后接入对应的五孔组。') : result.reason)+(adjusting?' 原插孔保持接通。':'');
    return result;
  };
  for (const field of [row,column,direction]) field.onchange=update;
  $('#partMountCancel').onclick=()=>$('#modal').close();
  $('#partMountForm').onsubmit=event=>{
    event.preventDefault();
    if (update().ok) commitPartPlacement(part,selection());
  };
  update();
}
$('#partMountButton').onclick=()=>{
  const part=circuit.components.find(item=>item.id===selected);
  if (!part || part.locked || !canMountPart(part.type)) return;
  setObjectPopover(null);
  if (isPartPlacing(part.id)) return cancelPartPlacement();
  if (!part.mount && !part.hidden) return beginPartPlacement(part);
  if (!part.mount) return;
  const stationary=[breadboardBounds(circuit.breadboard),...circuit.components.filter(item=>item!==part).map(scenePartBounds)];
  const resting=componentBounds(part);
  const position=stationary.some(item=>overlaps(item,resting)) ? findClearPartPosition(part,circuit.breadboard,stationary) : {x:part.x,z:part.z};
  if (!position) return toast('面包板旁没有空位，请先移开其他元件。');
  pushUndo();
  delete part.mount;
  Object.assign(part,position);
  finishSceneEdit();
  toast('元件已拔下，插脚与面包板断开。可撤销。');
};
function mountCandidates(options, profile, clearObstructions = false, project = circuit) {
  const rotation = mountRotation(options);
  const candidates = [];
  for (const rows of options.rowPairs) {
    for (const direction of options.rotations) {
      for (let column = options.minColumn; column <= options.maxColumn; column++) {
        const result = evaluateMountPlacement(project,profile,{rows,column,rotation:direction},{moveWires:true,clearObstructions});
        if (!result.candidate) continue;
        const candidate=project===circuit ? result.candidate : {...result.candidate,breadboard:project.breadboard};
        if (project!==circuit && breadboardMoveObstacle(project,project.breadboard,candidate.blockers)) continue;
        if (planBoardMountRelocations(candidate)) candidates.push(candidate);
      }
    }
  }
  const practice = clearObstructions ? null : example.mountPractice;
  const awayFromPractice = item => Number(Boolean(practice && !matchesLessonMount(item.mount,practice)));
  const impact = item => item.unpluggedWires.length + item.unpluggedParts.length;
  const turned = item => Number(item.mount.rotation!==rotation);
  return candidates.sort((a,b) => awayFromPractice(a)-awayFromPractice(b) || impact(a)-impact(b) || a.wireMoves.length-b.wireMoves.length
    || a.blockers.length-b.blockers.length || a.connectedNets-b.connectedNets || turned(a)-turned(b)
    || Math.abs(a.mount.column-options.defaultColumn)-Math.abs(b.mount.column-options.defaultColumn));
}
function mountRotation(options) {
  const freeRotation = ((circuit.board.rotation || 0)%360+360)%360;
  return circuit.board.mount?.rotation ?? (freeRotation>=180 ? 270 : options.defaultRotation);
}
function findBoardDrop(x,z,pointer,id,rotation) {
  if (id==='breadboard') {
    x = Math.max(-30,Math.min(30,x));
    z = Math.max(-20,Math.min(20,z));
    return nearestBreadboardMount(circuit,board(),{x,z,pointer},{moveWires:true,nearby:true});
  }
  const mount=circuit.board.mount;
  const explicitRotation=rotation!==undefined;
  const angle=rotation??mount?.rotation??circuit.board.rotation??0;
  if (!mount&&!explicitRotation) return nearestBoardMount(circuit,board(),{x,z,rotation:angle,pointer},{moveWires:true,nearby:true});
  const issue=boardRestIssue(x,z,angle);
  if (!issue) return {rest:true,reason:mount?'已到台面空位。松手拔下开发板。':'已到台面空位。松手放下开发板。'};
  if (isBoardTabletopPosition(x,z)&&(!explicitRotation||getMountOptions(board())?.rotations.includes(angle))) {
    const hit=nearestBoardMount(circuit,board(),{x,z,rotation:angle,pointer},{moveWires:true,exactRotation:explicitRotation});
    if (hit) return hit;
  }
  return {candidate:null,edgeOnly:true,reason:issue};
}
function previewBoardDrop(x,z,pointer,id='mcu',rotation) {
  const relocating=id==='mcu'&&Boolean(circuit.board.mount);
  let hit=findBoardDrop(x,z,pointer,id,rotation);
  if (!hit) {clearBoardDropPreview();return null;}
  if (hit.candidate && !planBoardMountRelocations(hit.candidate)) hit={...hit,candidate:null,reason:mountRestIssue};
  const {candidate,reason,nearby,adjusted}=hit;
  const review=Boolean(candidate && needsBoardMountReview(candidate));
  const cue=$('#boardDropCue');
  $('#scene').dataset.boardDrop=candidate || hit.rest ? 'ready' : hit.unchanged ? 'same' : 'blocked';
  const operation=relocating?'换孔':'插入';
  const target=hit.anchorHole && pointer?.anchor ? `${pointer.anchor.slice(4)} → ${holeLabel(hit.anchorHole)} · ` : '';
  const message=candidate
    ? `${target}${adjusted?'已找到可用插位 · ':nearby?'已找到附近插位 · ':''}${candidate.rows.join(' / ').toUpperCase()} 排 · 第 ${candidate.mount.column}–${candidate.mount.column+candidate.contacts.length/2-1} 列 · 松手${review?'查看接线变化':'即'+operation}`
    : hit.rest ? reason
    : hit.unchanged ? '仍在原插位，松手保持。'
    : relocating ? `${target}${reason} 松手仍保留原插位。`
    : !hit.edgeOnly&&getMountOptions(board()) ? `${reason} 松手可选插位。` : reason;
  if (cue.textContent!==message) cue.textContent=message;
  cue.hidden=false;
  return {...hit,review};
}
function clearBoardDropPreview() {
  delete $('#scene').dataset.boardDrop;
  $('#boardDropCue').hidden=true;
}
function moveSceneItem(id,x,z,rotation) {
  const profile = board(), mounted = boardPose(circuit,profile).mounted;
  if (mounted&&(id==='mcu'||id==='breadboard'&&circuit.board.locked)) return;
  const part = id==='mcu' ? circuit.board : id==='breadboard' ? circuit.breadboard : circuit.components.find(item => item.id===id);
  x = Math.max(-30,Math.min(30,x));
  z = Math.max(-20,Math.min(20,z));
  if (!part || part.locked || (id!=='breadboard' && part.mount)) return;
  const rotated=id!=='breadboard' && rotation!==undefined && rotation!==(part.rotation??0);
  if (!rotated && part.x===x && part.z===z) return;
  if (id==='breadboard') {
    const collision=breadboardMoveObstacle(circuit,{x,z});
    if (collision) return toast(`${scenePartName(collision.part)}会碰到 ${scenePartName(collision.obstacle)}。请先移开散件。`);
  }
  if (id==='breadboard' && mounted) {
    const preview = {...circuit,breadboard:{...part,x,z},board:{...circuit.board,mount:undefined}};
    const {candidate,reason} = evaluateMountPlacement(preview,profile,circuit.board.mount);
    if (!candidate || candidate.blockers.length) {
      return toast(candidate ? '新位置会压住 '+candidate.blockers.map(scenePartName).join('、')+'。请先移开元件。' : reason);
    }
  }
  pushUndo();
  if (id==='breadboard' && mounted) {
    circuit.board.x = Math.max(-30,Math.min(30,circuit.board.x+x-part.x));
    circuit.board.z = Math.max(-20,Math.min(20,circuit.board.z+z-part.z));
  }
  Object.assign(part,{x,z});
  if (rotated) part.rotation=rotation;
  workbench?.setCircuit(circuit);
  syncSceneSelection();
  refresh(false);
  save();
  return true;
}
function dropBoard(x,z,_mount,pointer,id='mcu',preview,rotation) {
  if (circuit.board.locked || id==='breadboard'&&circuit.board.mount) {
    if (id==='breadboard') moveSceneItem(id,x,z);
    return;
  }
  const rotated=id==='mcu' && rotation!==undefined;
  const hit=preview===undefined || rotated&&!preview ? findBoardDrop(x,z,pointer,id,rotation) : preview;
  if (id==='mcu' && hit?.rest) {
    const restRotation=rotation??circuit.board.mount?.rotation??circuit.board.rotation??0;
    const issue=boardRestIssue(x,z,restRotation);
    if (issue) {toast(issue);return false;}
    if (circuit.board.mount) return detachBoard(restRotation,{x,z});
    return moveSceneItem(id,x,z,restRotation);
  }
  if (circuit.board.mount) {
    if (hit?.unchanged) return false;
    if (!hit||hit.edgeOnly) {
      toast((hit?.reason||'未对准新的信号孔。')+' 开发板留在原插位。');
      return false;
    }
    // Keep the previewed destination while checking the current connections.
    const exact=hit.candidate?evaluateMountPlacement(circuit,board(),hit.candidate.mount,{moveWires:true}):hit;
    if (exact.unchanged) return false;
    if (!exact.candidate) {
      const mount=hit.mount ?? hit.candidate?.mount;
      if (reviewObstructedBoardPlacement(mount)) return;
      toast(exact.reason+' 开发板留在原插位。可点「换孔位」另选。');
      return false;
    }
    return confirmBoardPlacement(exact.candidate);
  }
  if (!hit) return moveSceneItem(id,x,z);
  if (hit.edgeOnly) {
    if (!rotated) moveSceneItem(id,x,z);
    toast(hit.reason);
    return false;
  }
  const options=getMountOptions(board());
  if (!options) return requestBoardMount();
  if (!hit.candidate) return openBoardPlacement(hit.mount,{message:hit.reason,breadboard:hit.breadboard});
  confirmBoardPlacement(hit.candidate,hit.adjusted ? '拖到的位置有挡件。已找到可用插位，请确认孔位和朝向。' : undefined);
}
const mountRestIssue='面包板旁没有空位放下挡件。请先挪开散件，或改选其他孔位。';
function planBoardMountRelocations(candidate) {
  const {blockers,breadboard=circuit.breadboard}=candidate;
  if (!blockers.length) return [];
  const planned = [];
  const stationary = circuit.components.filter(part => !blockers.includes(part)).map(part => {
    const pose=partPose(part,breadboard);
    return pose.mounted ? mountedPartBodyBounds(part,pose) : componentBounds(part);
  });
  const rest = circuit.board;
  const visual = boardVisual(board());
  stationary.push(breadboardBounds(breadboard));
  const oldRadius = Math.max(visual.width,visual.height)/2+.35;
  stationary.push({left:rest.x-oldRadius,right:rest.x+oldRadius,top:rest.z-oldRadius,bottom:rest.z+oldRadius});
  for (const part of blockers) {
    const position = findClearPartPosition(part,breadboard,stationary);
    if (!position) return null;
    stationary.push(componentBounds({...part,...position}));
    planned.push({part,...position});
  }
  return planned;
}
function applyBoardMount(candidate) {
  if(circuit.board.locked)return false;
  const planned=planBoardMountRelocations(candidate);
  if (!planned) {toast(mountRestIssue);return false;}
  const {mount,wireMoves,unpluggedWires,unpluggedParts,breadboard=circuit.breadboard}=candidate;
  const oldBoard = boardPose(circuit,board());
  pushUndo();
  Object.assign(circuit.breadboard,{x:breadboard.x,z:breadboard.z});
  for (const {wire,end,to} of wireMoves) wire[end]=to;
  if (unpluggedWires.length) {
    circuit.wires=circuit.wires.filter(wire=>!unpluggedWires.includes(wire));
    if (unpluggedWires.some(wire=>wire.id===selectedWire)) selectedWire=null;
  }
  for (const part of unpluggedParts) delete part.mount;
  for (const {part,x,z} of planned) Object.assign(part,{x,z});
  circuit.board.mount = mount;
  sim.reset({preserveServoAngles:true,preservePhotocellStates:true});
  finishSceneEdit();
  selectScenePart('mcu');
  if (!oldBoard.mounted) workbench?.home();
  toast(oldBoard.mounted ? '插位已更新，排针按新位置接通。可撤销。' : '开发板已插入，排针与对应孔位电气连通。可撤销。');
  return true;
}
function flipBoardInPlace(){
  const mount = circuit.board.mount;
  if(!mount||circuit.board.locked)return false;
  const flipped={...mount,rotation:mount.rotation===90?270:90};
  const result=evaluateMountPlacement(circuit,board(),flipped,{moveWires:true});
  if(!result.candidate)return openBoardPlacement(flipped,{message:result.reason});
  return confirmBoardPlacement(result.candidate);
}
function rotateBoard(delta){
  if(circuit.board.locked){toast('开发板已锁定。解锁后可旋转。');return false;}
  if(delta!==90&&delta!==-90)return false;
  const mount=circuit.board.mount;
  const rotation=(((mount?.rotation??circuit.board.rotation??0)+delta)%360+360)%360;
  if(mount){
    const canDetach=Boolean(detachedBoardPosition(rotation));
    const direction=delta===90?'逆时针':'顺时针';
    const rest=canDetach?`旋转后 USB 朝${rotation===0?'上':'下'}。手动跳线会保留。`:'面包板旁没有空位放下旋转后的开发板。可先移开散件，或在插孔内翻转。';
    modal('旋转已插入的开发板',`<p>${direction}转 90° 需要先把两排针拔出。${rest}</p><p>翻转 180° 会让排针接到不同孔位。有接线变化时会请你确认。</p><div class="project-actions"><button type="button" class="button primary" id="detachAndRotateBoard" ${canDetach?'':'disabled'}>拔下并旋转 90°</button><button type="button" class="button" id="flipSeatedBoard">在插孔内翻转 180°</button><button type="button" class="button" id="cancelBoardRotation" autofocus>取消</button></div>`);
    $('#detachAndRotateBoard').onclick=()=>{if(detachBoard(rotation))$('#modal').close();};
    $('#flipSeatedBoard').onclick=()=>{$('#modal').close();flipBoardInPlace();};
    $('#cancelBoardRotation').onclick=()=>$('#modal').close();
    return false;
  }
  pushUndo();
  circuit.board.rotation=rotation;
  finishSceneEdit();
  selectScenePart('mcu');
  toast(`开发板已转至 ${rotation}°，导线跟随排针。`);
  return true;
}
$('#rotateBoardButton').onclick=()=>{selectBoardForEditing();rotateBoard(90);};
function requestBoardMount() {
  const profile = board(), options = getMountOptions(profile);
  if (!options) {
    const note=profile.id==='uno-r3' ? 'UNO R3 的排针母座朝上，跳线从板顶插入。' : profile.breadboardNote || '这块板使用板上端点引出信号。';
    modal('用跳线连接面包板', `<p>${esc(profile.name)} · ${esc(note)}</p><p>把两块板分开放。点「进入接线」后，依次点开发板引脚和面包板空孔。</p><div class="project-actions"><button class="button primary" id="startBoardJumper">进入接线</button></div>`);
    $('#startBoardJumper').onclick=()=>{$('#modal').close();setMode('wire');$('[data-mode="wire"]').focus();};
    return;
  }
  const candidate=mountCandidates(options,profile)[0];
  if (candidate) return confirmBoardPlacement(candidate);
  openBoardPlacement(mountCandidates(options,profile,true)[0]?.mount,{message:'已有元件或跳线挡住插位。可查看腾位方案，确认后才会移动或拔下挡件。'});
}
function needsBoardMountReview(candidate) {
  const practice=example.mountPractice;
  return candidate.adjusted || candidate.blockers.length || candidate.wireMoves.length ||
    (circuit.board.mount ? candidate.changedNets : candidate.connectedNets) ||
    practice && !matchesLessonMount(candidate.mount,practice);
}
function stepSeatedBoard(dx,dz) {
  const mount=circuit.board.mount, profile=board(), options=getMountOptions(profile);
  if (!mount || !options || circuit.board.locked) return false;
  const rows=boardMountRows(mount,options);
  if (!rows) return false;
  // The default centered row pair is listed first. Arrow keys follow physical order.
  const pairs=[...options.rowPairs].sort((a,b)=>a[0].localeCompare(b[0]));
  const targetRows=pairs[pairs.indexOf(rows)+dz];
  const column=mount.column+dx;
  if (column<options.minColumn || column>options.maxColumn || !targetRows) {
    toast(dz && pairs.length===1 ? '这块板的排针只适合 '+rows.join(' / ').toUpperCase()+' 排。可用左右键换列。' : '已经到达这个方向的最后一个插位。');
    return false;
  }
  const target={...mount,column,rows:targetRows};
  const {candidate,reason}=evaluateMountPlacement(circuit,profile,target,{moveWires:true});
  if (!candidate) {
    if (reviewObstructedBoardPlacement(target)) return false;
    toast(reason+' 开发板留在原插位。');
    return false;
  }
  return confirmBoardPlacement(candidate);
}
function confirmBoardPlacement(candidate,message) {
  if (!message && !needsBoardMountReview(candidate)) return applyBoardMount(candidate);
  const notice=message||(candidate.blockers.length?'这组孔位可以插入。请确认下方列出的散件会移到面包板旁，连接它们的跳线会保留。':undefined);
  openBoardPlacement(candidate.mount,{message:notice,breadboard:candidate.breadboard});
}
function reviewObstructedBoardPlacement(mount) {
  if (!mount) return false;
  const {candidate}=evaluateMountPlacement(circuit,board(),mount,{moveWires:true,clearObstructions:true});
  if (!candidate || !planBoardMountRelocations(candidate)) return false;
  openBoardPlacement(mount,{message:'目标孔位有挡件。先看下方原因，再决定是否腾位。'});
  return true;
}
function openBoardPlacement(initial, {message,breadboard,chooseColumn=false}={}) {
  const profile=board(), options=getMountOptions(profile);
  if (!options || circuit.board.locked) return false;
  const project=breadboard ? {...circuit,breadboard} : circuit;
  showMountPlacementDialog({
    modal, options, boardName:profile.name, message, current:circuit.board.mount, chooseColumn,
    practice:example.mountPractice,
    initial:initial ?? circuit.board.mount ?? example.mountPractice ?? {column:options.defaultColumn,rotation:mountRotation(options)},
    recommend:clearObstructions=>mountCandidates(options,profile,clearObstructions,project)[0]?.mount,
    evaluate:(selection,clearObstructions)=>{
      const result=evaluateMountPlacement(project,profile,selection,{moveWires:true,clearObstructions});
      if (!result.candidate) return result;
      const candidate=breadboard ? {...result.candidate,breadboard} : result.candidate;
      const collision=breadboard&&breadboardMoveObstacle(project,breadboard,candidate.blockers);
      if (collision) return {...result,candidate:null,reason:collision.reason};
      if (!planBoardMountRelocations(candidate)) return {...result,candidate:null,reason:mountRestIssue};
      return {...result,candidate};
    },
    onApply:applyBoardMount,
    onPlaced:()=>focusSceneCanvas()
  });
}
function selectBoardForEditing() {
  setSceneCameraMode('edit');
  clearBoardHolePicker();
  setObjectPopover(null);
  if (mode==='wire' || mode==='pan') setMode('orbit');
  else {
    cancelProbePicking();
    selectedPin=null;
    workbench?.cancelInteraction?.();
    $('#cancelWireButton').hidden=true;
  }
  inspectedPin=null;
  renderPinMeasurement();
  selectScenePart('mcu');
  focusSceneCanvas();
}
function chooseBoardPlacement() {
  selectBoardForEditing();
  openBoardPlacement(undefined,{chooseColumn:true});
}
function clearBoardHolePicker(focus=false) {
  if (!boardHolePicker) return;
  boardHolePicker=null;
  workbench?.setBoardHolePicker(null);
  $('#boardHolePicker').hidden=true;
  $('#boardHoleConfirm').disabled=true;
  renderSceneObjects();
  if (focus) focusSceneCanvas();
}
function beginBoardHolePicker() {
  if (boardHolePicker) return clearBoardHolePicker(true);
  const profile=board(), options=getMountOptions(profile);
  if (!options || circuit.board.locked) return;
  if (!workbench) return chooseBoardPlacement();
  selectBoardForEditing();
  const mounted=circuit.board.mount;
  const rows=mounted&&boardMountRows(mounted,options);
  const startHole=rows?signalHole(rows[0],mounted.column)?.endpoint:undefined;
  boardHolePicker={holes:boardMountStartHoles(profile),rotation:mountRotation(options),startHole,endpoint:null,hover:null};
  $('#boardHolePickerTitle').textContent=mounted?'换到新孔位':'在面包板上插板';
  renderBoardHolePicker();
  renderSceneObjects();
  workbench.top();
}
function evaluateBoardHole(endpoint) {
  const profile=board();
  const mount=boardMountFromStartHole(profile,endpoint,boardHolePicker.rotation);
  if (!mount) return null;
  const result=evaluateMountPlacement(circuit,profile,mount,{moveWires:true});
  if (result.candidate && !planBoardMountRelocations(result.candidate)) {
    return {...result,candidate:null,reason:mountRestIssue,mount,anchorHole:endpoint};
  }
  return {...result,mount,anchorHole:endpoint};
}
function renderBoardHolePicker() {
  const picker=boardHolePicker;
  const endpoint=picker.endpoint??picker.hover;
  const preview=endpoint?evaluateBoardHole(endpoint):null;
  const bar=$('#boardHolePicker'), status=$('#boardHolePickerStatus'), confirm=$('#boardHoleConfirm');
  const current=circuit.board.mount;
  const action=current?'换孔位':'插入';
  const target=preview?.candidate;
  const currentRows=current&&boardMountRows(current,getMountOptions(board()));
  let message=currentRows
    ? `当前在 ${currentRows.join(' / ').toUpperCase()} 排第 ${current.column} 列。点蓝色孔或按方向键预览。`
    : '点蓝色起始孔，或用方向键预览两排针的位置。';
  if (preview?.unchanged) message='这里是当前插位。点另一个起始孔，或按方向键选孔。';
  else if (preview) {
    const options=getMountOptions(board());
    const rows=boardMountRows(preview.mount,options).join(' / ').toUpperCase();
    const lastColumn=preview.mount.column+options.pinCount-1;
    const position=`${rows} 排 · 第 ${preview.mount.column}–${lastColumn} 列`;
    const hint=picker.keyboardPreview?'按 Enter 选定目标。':'点此孔选定目标。';
    message=target
      ? `${position}。${picker.endpoint?'已选目标，确认后才改变电路。':hint}`
      : `${position}。${preview.reason}`;
  }
  const clearance=picker.endpoint && preview && !preview.unchanged && !target
    ? evaluateMountPlacement(circuit,board(),preview.mount,{moveWires:true,clearObstructions:true}).candidate : null;
  const canReview=clearance && Boolean(planBoardMountRelocations(clearance));
  bar.hidden=false;
  bar.dataset.placementState=target?'ready':preview&&!preview.unchanged?'blocked':'waiting';
  if (status.textContent!==message) status.textContent=message;
  confirm.disabled=!picker.endpoint||(!target&&!canReview);
  confirm.textContent=canReview?'查看腾位':target&&needsBoardMountReview(target)?'查看接线变化':`确认${action}`;
  workbench.setBoardHolePicker({holes:picker.holes,preview,startHole:picker.startHole,selectedHole:picker.endpoint});
}
function hoverBoardHole(endpoint, {keyboard=false}={}) {
  if (!boardHolePicker || boardHolePicker.endpoint && (!keyboard || boardHolePicker.endpoint===endpoint)) return;
  if (!boardHolePicker.endpoint && boardHolePicker.hover===endpoint &&
      Boolean(boardHolePicker.keyboardPreview)===keyboard) return;
  if (keyboard) boardHolePicker.endpoint=null;
  boardHolePicker.hover=endpoint;
  boardHolePicker.keyboardPreview=keyboard;
  renderBoardHolePicker();
}
function chooseBoardHole(endpoint) {
  if (!boardHolePicker?.holes.includes(endpoint)) return;
  boardHolePicker.endpoint=endpoint;
  renderBoardHolePicker();
}
function confirmPickedBoardHole() {
  if (!boardHolePicker?.endpoint) return;
  const preview=evaluateBoardHole(boardHolePicker.endpoint);
  if (!preview || preview.unchanged) return;
  clearBoardHolePicker(true);
  if (preview.candidate) return confirmBoardPlacement(preview.candidate);
  if (!reviewObstructedBoardPlacement(preview.mount)) {
    toast(preview.reason+' 开发板保持原位。');
  }
}
$('#sceneFocusBoard').onclick = selectBoardForEditing;
$('#mountSlotButton').onclick = chooseBoardPlacement;
$('#sceneMoveBoard').onclick = beginBoardHolePicker;
$('#boardHoleCancel').onclick = () => clearBoardHolePicker(true);
$('#boardHoleManual').onclick = () => {
  const target=boardHolePicker?.endpoint??boardHolePicker?.hover;
  const mount=target?evaluateBoardHole(target)?.mount:undefined;
  selectBoardForEditing();
  openBoardPlacement(mount,{chooseColumn:true});
};
$('#boardHoleConfirm').onclick = confirmPickedBoardHole;
for (const [id, step] of [['#sceneBoardLeft',-1],['#sceneBoardRight',1]]) {
  $(id).onclick = event => {
    if (event.currentTarget.getAttribute('aria-disabled')!=='true' && stepSeatedBoard(step,0)) focusSceneCanvas();
  };
}
$('#mountPracticeButton').onclick = event => loadExample(event.currentTarget.dataset.example);
$('#unlockBoardButton').onclick = () => {
  if (!circuit.board.locked) return;
  pushUndo();
  delete circuit.board.locked;
  finishSceneEdit();
  $('#mountBoardButton').focus({preventScroll:true});
  toast('开发板已解锁，可以移动或插入。可撤销。');
};
function detachBoard(rotation,restPosition){
  if(circuit.board.locked||!circuit.board.mount)return false;
  const position=restPosition??detachedBoardPosition(rotation);
  if(!position){toast('面包板旁没有空位。移开旁边的元件后可以拔下开发板。');return false;}
  const turned=rotation!==undefined&&rotation!==circuit.board.mount.rotation;
  pushUndo();
  delete circuit.board.mount;
  Object.assign(circuit.board,position);
  if(rotation!==undefined)circuit.board.rotation=rotation;
  sim.reset({preserveServoAngles:true,preservePhotocellStates:true});
  finishSceneEdit();
  selectScenePart('mcu');
  if (!restPosition) workbench?.home();
  toast(turned?`开发板已拔下并转至 ${rotation}°。手动跳线保留，可撤销。`:'开发板已拔下，手动跳线保留，可撤销。');
  return true;
}
$('#mountBoardButton').onclick = () => {
  clearBoardHolePicker();
  if (circuit.board.locked) return;
  if (!boardPose(circuit,board()).mounted) return requestBoardMount();
  return detachBoard();
};
function removeSceneParts(ids) {
  if ($('#modal').open) return;
  const { parts, wires } = componentRemoval(circuit, ids);
  if (!parts.length) return;
  const from = document.activeElement;
  function remove() {
    const plan = componentRemoval(circuit, parts.map(part => part.id));
    if (!plan.parts.length) return;
    const removeIds = new Set(plan.parts.map(part => part.id));
    const wireIds = new Set(plan.wires.map(wire => wire.id));
    setObjectPopover(null);
    pushUndo();
    lastPartRemoval = undoStack.at(-1);
    circuit.components = circuit.components.filter(part => !removeIds.has(part.id));
    circuit.wires = circuit.wires.filter(wire => !wireIds.has(wire.id));
    for (const id of removeIds) selectedParts.delete(id);
    if (removeIds.has(selected)) selected = [...selectedParts].at(-1) || null;
    if (wireIds.has(selectedWire)) selectedWire = null;
    sim.removeParts(removeIds);
    finishSceneEdit();
    $('#sceneDeleteUndo').focus({ preventScroll: true });
    toast('已删除 ' + removeIds.size + ' 个元件与 ' + wireIds.size + ' 根导线。点击「撤销删除」可恢复。');
  }
  const inserted = parts.filter(part=>part.mount).length;
  if (parts.length === 1 && !wires.length && !inserted) { remove(); return; }
  const names = parts.map(part => esc(scenePartName(part)) + ' <code>' + esc(part.id) + '</code>');
  const wireCount = wires.length ? '会同时断开并移除 <strong>' + wires.length + '</strong> 根相连导线。' : '这些元件没有相连导线。';
  const lockedCount = [...new Set(ids)].length - parts.length;
  $('#modal').setAttribute('aria-describedby', 'sceneDeleteImpact');
  modal('删除 ' + parts.length + ' 个元件？',
    '<p class="scene-delete-summary" id="sceneDeleteImpact">' + wireCount + (inserted ? ` 另有 ${inserted} 个元件会从面包板拔下。` : '') + '</p><p>' + names.slice(0, 5).join('、') +
    (names.length > 5 ? ' 等 ' + names.length + ' 个' : '') + '。</p>' +
    (lockedCount > 0 ? '<p>' + lockedCount + ' 个锁定元件会保留。</p>' : '') +
    '<p>一次撤销即可恢复元件及其导线。</p><div class="scene-delete-actions"><button type="button" class="button" id="sceneKeepParts" autofocus>取消</button>' +
    '<button type="button" class="button confirm-remove" id="sceneConfirmRemove">确认删除</button></div>');
  let confirmed = false;
  $('#modal').addEventListener('close', () => {
    $('#modal').removeAttribute('aria-describedby');
    if (!confirmed) (from?.isConnected && !from.disabled ? from : $('#sceneObjectsToggle')).focus({ preventScroll: true });
  }, { once: true });
  $('#sceneKeepParts').onclick = () => $('#modal').close();
  $('#sceneConfirmRemove').onclick = () => { confirmed = true; $('#modal').close(); remove(); };
  $('#sceneKeepParts').focus();
}
function editSceneParts(action, rotationStep = 90) {
  if (action==='rotate' && partPlacement) return turnPartPlacement(Math.sign(rotationStep));
  if (action==='rotate' && selected==='mcu') return rotateBoard(rotationStep);
  const parts = circuit.components.filter(part => selectedParts.has(part.id));
  if (action==='rotate' && parts.length===1 && canAdjustMountedPart(parts[0])) return beginPartPlacement(parts[0]);
  const targets = action === 'rotate' ? parts.filter(part => !part.locked && !part.mount) : parts;
  if (!targets.length || (action === 'copy' && circuit.components.length + targets.length > 80)) return;
  pushUndo();
  if (action === 'copy') {
    selectedParts.clear();
    for (const part of targets) {
      const copy = copyComponent(part, circuit);
      circuit.components.push(copy);
      selectedParts.add(copy.id);
    }
    selected = [...selectedParts].at(-1);
    toast('已复制 ' + targets.length + ' 个元件，原有导线保留在原元件上。');
  } else if (action === 'rotate') {
    for (const part of targets) part.rotation = (((part.rotation || 0) + rotationStep) % 360 + 360) % 360;
    toast(targets.length === 1 ? '元件角度已调整为 ' + targets[0].rotation + '°，可用撤销恢复。' : '已旋转 ' + targets.length + ' 个元件，可用撤销恢复。');
  } else {
    const flag = action === 'lock' ? 'locked' : 'hidden';
    const enable = !targets.every(part => part[flag]);
    for (const part of targets) part[flag] = enable;
  }
  finishSceneEdit();
}
$('#sceneObjectToolbar').addEventListener('click', event => {
  const wire=event.target.closest('[data-object-wire]');
  if(wire){chooseSceneTarget('wire',wire.dataset.objectWire);return;}
  const part = event.target.closest('[data-object-select]');
  if (!part) return;
  const id=part.dataset.objectSelect;
  if (id==='mcu') return selectBoardForEditing();
  setSceneCameraMode('edit');
  selectScenePart(id, { additive: event.shiftKey || event.ctrlKey || event.metaKey });
  if (id==='breadboard') {
    setObjectPopover(null);
    focusSceneCanvas();
  }
});
$('#sceneObjectToolbar').addEventListener('change', event => {
  const id = event.target.dataset.objectCheck;
  if (id) {
    setSceneCameraMode('edit');
    selectScenePart(id, { additive: true });
  }
});
for (const id of ['sceneObjects', 'sceneActions']) {
  $('#' + id + 'Toggle').onclick = event => {
    const opening = $('#' + id + 'Popover').hidden;
    setObjectPopover(opening ? id : null);
    if (opening && event.detail === 0) {
      const first = id === 'sceneObjects' ?
        $('#sceneObjectsPopover .is-selected button') || $('#sceneComponents button') || $('#sceneBaseObjects button') :
        $('#sceneActionsPopover button:not(:disabled):not([hidden])');
      first?.focus({ preventScroll: true });
    }
  };
}
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('#sceneObjectToolbar, #modal')) setObjectPopover(null);
}, { capture: true });
for (const [id, action] of [['sceneCopyPart', 'copy'], ['sceneLockPart', 'lock'], ['sceneHidePart', 'hide']]) {
  $('#' + id).onclick = () => editSceneParts(action);
}
function rotateSelectedScenePart() {
  if (selected==='mcu') selectBoardForEditing();
  else setObjectPopover(null);
  editSceneParts('rotate');
}
$('#sceneRotateQuick').onclick = rotateSelectedScenePart;
$('#sceneRotatePart').onclick = rotateSelectedScenePart;
for (const id of ['sceneDeletePart', 'sceneMenuDelete']) $('#' + id).onclick = () => removeSceneParts([...selectedParts]);
$('#sceneDeleteUndo').onclick = () => {
  if (lastPartRemoval && lastPartRemoval === undoStack.at(-1)) undoCircuit();
};
function syntax(s){const re=/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|^[ \t]*#[^\n]*|\b(?:int|void|if|else|while|for|return|const|static|volatile|unsigned|signed|char|short|long|float|double|struct|typedef|uint8_t|uint16_t|uint32_t|break|continue|switch|case|default)\b|\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|\b[A-Za-z_]\w*(?=\s*\())/gm;let pos=0,out='',m;while((m=re.exec(s))){out+=esc(s.slice(pos,m.index));let cls=m[0].startsWith('//')||m[0].startsWith('/*')?'comment':m[0].trim().startsWith('#')?'pre':/^['"]/.test(m[0])?'str':/^\d/.test(m[0])?'num':/^(int|void|if|else|while|for|return|const|static|volatile|unsigned|signed|char|short|long|float|double|struct|typedef|uint\d+_t|break|continue|switch|case|default)$/.test(m[0])?'kw':'fn';out+='<span class="'+cls+'">'+esc(m[0])+'</span>';pos=re.lastIndex;}return out+esc(s.slice(pos))+'\n';}
function removeSourceFile(name){
 if(Object.keys(files).length===1)return toast('至少保留一个源文件。');
 if(!confirm('移除 '+name+'？'))return;
 delete files[name];
 if(activeFile===name)activeFile=Object.keys(files)[0];
 renderFiles();loadEditor();sourceDraftChanged();
 $('#fileTabs .file-tab.active')?.focus({preventScroll:true});
}
function renderFiles(){
 $('#fileTabs').innerHTML=Object.keys(files).map(f=>'<button type="button" class="file-tab '+(f===activeFile?'active':'')+'" data-file="'+esc(f)+'" aria-pressed="'+String(f===activeFile)+'" aria-keyshortcuts="Delete">'+esc(f)+'<span class="file-close" data-remove-file="'+esc(f)+'" aria-hidden="true" title="移除文件">×</span></button>').join('');
 $$('#fileTabs [data-file]').forEach(button=>{
  button.onclick=event=>{
   if(event.target.dataset.removeFile)return removeSourceFile(button.dataset.file);
   activeFile=button.dataset.file;renderFiles();loadEditor();save();
   $('#fileTabs .file-tab.active')?.focus({preventScroll:true});
  };
  button.onkeydown=event=>{
   if(event.key!=='Delete'||event.isComposing||event.repeat)return;
   event.preventDefault();event.stopPropagation();removeSourceFile(button.dataset.file);
  };
 });
}
function loadEditor(){editorAssistant?.close();switching=true;const editor=$('#codeEditor');editor.value=files[activeFile]||'';editor.setSelectionRange(0,0);editor.scrollTop=0;editor.scrollLeft=0;editorLine=1;updateEditor();editorAssistant?.refresh();editorTools?.refresh();switching=false;}
function updateEditor(){const e=$('#codeEditor');$('#codeHighlight').innerHTML=syntax(e.value);const count=e.value.split('\n').length;const pc=sourcePending?null:lastState.pc;$('#lineNumbers').innerHTML=Array.from({length:count},(_,i)=>'<div class="'+((pc?.file===activeFile&&pc.line===i+1)?'current':errors.some(x=>x.line===i+1&&(!x.file||x.file===activeFile))?'error':'')+'">'+(i+1)+'</div>').join('');syncEditor();$('#cursorStatus').textContent=activeFile+' · 行 '+editorLine;}
function syncEditor(){const e=$('#codeEditor');$('#codeHighlight').scrollTop=e.scrollTop;$('#codeHighlight').scrollLeft=e.scrollLeft;$('#lineNumbers').scrollTop=e.scrollTop;}
function sourceDraftChanged(){
 sourcePending=appliedSource!==null&&!sameSourceFiles(appliedSource,files);
 errors=[];liveDiagnostics=[];$('#compileErrors').hidden=true;
 pause();updateEditor();cursorChanged();renderDiagnostics();renderSourceHardware();save();scheduleCheck();
}
$('#codeEditor').addEventListener('input',()=>{
 const source=$('#codeEditor').value;
 if(files[activeFile]===source)return;
 files[activeFile]=source;
 sourceDraftChanged();
});
$('#codeEditor').addEventListener('scroll',syncEditor);$('#codeEditor').addEventListener('click',cursorChanged);$('#codeEditor').addEventListener('keyup',cursorChanged);
function cursorChanged(){editorLine=$('#codeEditor').value.slice(0,$('#codeEditor').selectionStart).split('\n').length;$('#cursorStatus').textContent=activeFile+' · 行 '+editorLine;if(!selected)renderInspector();}
$('#addFileButton').onclick=()=>{const raw=prompt('新文件名（例如 LED.c、LED.h 或 sketch.ino）','LED.c');if(!raw)return;let name;try{name=sourcePath(raw);}catch(e){return toast(e.message);}if(Object.keys(files).some(f=>f.toLowerCase()===name.toLowerCase()))return toast('这个文件已存在，或只有大小写不同。');files[name]='';activeFile=name;renderFiles();loadEditor();sourceDraftChanged();};
$('#formatButton').onclick=()=>{let level=0;const formatted=$('#codeEditor').value.split('\n').map(l=>{const t=l.trim();if(t.startsWith('}'))level=Math.max(0,level-1);const r=(t?'    '.repeat(Math.min(20,level)):'')+t;if(t.endsWith('{'))level++;return r;}).join('\n');$('#codeEditor').value=formatted;$('#codeEditor').dispatchEvent(new Event('input'));toast('已整理缩进；代码内容未自动改写。');};
const replacedFile=/^(?:stm32f10x_(?:gpio|rcc|tim|adc|usart|spi|i2c|dma|exti|bkp|pwr|wwdg|iwdg|rtc|flash|crc|dac|can|fsmc|sdio|dbgmcu)|system_stm32f10x|core_cm3|misc)\.c$/i;
function compilerFiles(){return Object.fromEntries(Object.entries(files).filter(([f])=>!replacedFile.test(f.split('/').pop())));}
function checkCode(manual=false){
 if(example.nativeOnly)return false;
 clearTimeout(liveTimer);try{const built=compileForBoard(compilerFiles(),circuit.boardId||'bluepill');const items=(built.diagnostics||[]).filter(d=>d.severity==='error');if(items.length){showErrors(items,{draft:true});if(manual)toast('发现 '+items.length+' 项需要检查，点击行号定位。');return false;}errors=[];liveDiagnostics=built.diagnostics||[];$('#compileErrors').hidden=true;$('#codeStatus').textContent='✓ 语法检查通过 · 行为仍需运行验证';$('#codeStatus').dataset.state='ok';updateEditor();renderDiagnostics();renderSourceHardware();if(manual)toast('支持范围内的语法检查通过。请运行，继续检查引脚和电路行为。');return true;}catch(e){showErrors(e.diagnostics?.length?e.diagnostics:[normalizeError(e)],{draft:true});return false;}
}
function scheduleCheck(){clearTimeout(liveTimer);if(nativeMode()||example.nativeOnly)return;$('#codeStatus').textContent='编辑中 · 稍后自动检查';delete $('#codeStatus').dataset.state;liveTimer=setTimeout(()=>checkCode(false),650);}
$('#checkCodeButton').onclick=()=>checkCode(true);
function createSourceRuntime(built,boardId){
 let instance;
 instance=createBoardRuntime(built,{
  readPin:(name,st)=>sim.solve(circuit,st||lastState,{averagePWM:false}).readPin(name),
  readADC:(channel,st)=>sim.solve(circuit,st||lastState,{averagePWM:false}).readADC(channel),
  readPulse:(name,level,timeoutUs,st)=>sim.solve(circuit,st,{averagePWM:false}).measurePulse?.(name,level,timeoutUs),
  writeI2c:(address,bytes,st,transaction)=>sim.writeI2c(circuit,st,address,bytes,transaction),
  readI2c:(address,length,st,transaction)=>sim.readI2c(circuit,st,address,length,transaction),
  onBeforeDelay:(delay,readState)=>{
   let snapshot;
   const boundary=()=>snapshot??=readState();
   if(circuit.components.some(part=>part.type==='capacitor'||part.type==='motor'||part.type==='hcsr04'||part.type==='servo'&&part.servoModel==='hs55')){
    const reading=sim.solve(circuit,boundary(),{averagePWM:false});
    if(runtime===instance&&example.id===motorBridgeLessonId)recordMotorStop(boundary(),reading);
   }
   sampleSourceDelay(instance,delay,boundary);
   if(buttonReplay)sampleButtonReplay(instance,delay.fromMs,boundary);
  },
  onSerial:text=>{serialText=(serialText+String(text)).slice(-50000);}
 },boardId);
 return instance;
}
function build({motorAtRest=false}={}){
 clearTimeout(liveTimer);
 try{
  const boardId=board().id;
  const built=compileForBoard(compilerFiles(),boardId);
  const invalid=(built.diagnostics||[]).filter(d=>d.severity==='error');
  if(invalid.length){showErrors(invalid,{draft:true});return false;}
  const next=createSourceRuntime(built,boardId);
  const initialState=next.getState();
  beginSourceComparison();
  motorStopTrace.begin(motorLessonKey(),sourcePending,motorAtRest);
  sim.reset({preserveServoAngles:true,preserveCapacitorVoltages:sourcePending,preserveMotorStates:sourcePending&&!motorAtRest,preserveI2cDevices:true,preservePhotocellStates:true});history=[];serialText='';
  runtime=next;lastState=initialState;compiled=true;
  appliedSource={...files};sourcePending=false;
  programmedSource={boardId,built,files:appliedSource};
  errors=[];liveDiagnostics=built.diagnostics||[];$('#compileErrors').hidden=true;
  $('#codeStatus').textContent='解析通过 · 按当前板卡的已实现行为执行';$('#codeStatus').dataset.state='ok';
  return true;
 }catch(e){showErrors(e.diagnostics?.length?e.diagnostics:[normalizeError(e)],{draft:true});return false;}
}
function normalizeError(e){return {severity:'error',file:e.file||e.location?.file||e.loc?.file||activeFile,line:e.line||e.location?.line||e.loc?.line,plain:e.plain||e.message||String(e),technical:e.technical||'',fix:e.fix||e.suggestion||'检查提示行及前一行；本平台不支持的语法会明确拒绝执行。'};}
function showErrors(items,{draft=false}={}){
 errors=items;
 const oldProgramRunning=draft&&sourcePending&&running;
 if(!oldProgramRunning){pause();$('#statusDot').className='status-dot error';}
 setRunStatus(oldProgramRunning?'草稿有错误 · 上次应用的程序仍在运行':draft&&sourcePending?'草稿有错误 · 保留上次输出':'需要修正代码');
 if(draft){$('#codeStatus').textContent='发现代码问题 · 点击提示行号';$('#codeStatus').dataset.state='error';}
 const panel=$('#compileErrors');
 panel.hidden=false;
 panel.innerHTML=items.map(e=>'<div><button data-error-file="'+esc(e.file||activeFile)+'" data-error-line="'+esc(e.line||1)+'">'+esc(e.file||activeFile)+(e.line?' : '+e.line:'')+'</button>　'+esc(e.plain||e.message)+'<br><small>'+esc(e.fix||e.suggestion||'')+'</small></div>').join('');
 $$('[data-error-file]').forEach(b=>b.onclick=()=>jumpLine(b.dataset.errorFile,Number(b.dataset.errorLine)));
 updateEditor();renderDiagnostics();renderSourceHardware();
}
function showSourceRuntimeErrors(items){
 if(!sourcePending)return showErrors(items);
 pause();setRunStatus('上次应用的程序执行已停止');$('#statusDot').className='status-dot error';
 renderDiagnostics();renderSourceHardware();
 if(!lastState.error&&items.length)toast(items[0].plain||items[0].message);
}
function jumpLine(file,line){if(file in files){activeFile=file;renderFiles();loadEditor();}const text=$('#codeEditor').value,lines=text.split('\n');const start=lines.slice(0,Math.max(0,line-1)).join('\n').length+(line>1?1:0);$('#codeEditor').focus();$('#codeEditor').setSelectionRange(start,start+(lines[line-1]?.length||0));$('#codeEditor').scrollTop=Math.max(0,(line-5)*22);editorLine=line;syncEditor();editorAssistant?.updateHint();renderInspector();}
function setRunStatus(text){$('#runStatus').textContent=text;if(nativeMode())$('#firmwareState').textContent=text;}
function pause(){
 executionRequest++;running=false;clearTimeout(loopTimer);
 if(stopButtonReplay('重放已停止，按键已松开。'))refresh(false);
 renderSourceRunControls();
 if(!errors.length||sourcePending)$('#statusDot').className='status-dot';
 if(sourcePending)setRunStatus(errors.length?'草稿有错误 · 上次应用的程序已暂停':'草稿未应用 · 保留上次输出');
 else if(!errors.length)setRunStatus(runtime?'已暂停':'准备就绪');
 stopSound();if(sourcePending)renderSourceHardware();
}
function replayButtonPart(){
 return !nativeMode()&&example.id==='button-bounce' ? circuit.components.find(p=>p.id==='button1'&&p.type==='button') : null;
}
function renderButtonReplayControls(){
 const panel=$('#buttonBouncePanel'),visible=!nativeMode()&&example.id==='button-bounce';
 panel.hidden=!visible;
 const tab=$('[data-monitor="button-bounce"]');
 tab.hidden=!visible||!buttonCapture;
 if(tab.hidden&&tab.classList.contains('active'))$('[data-monitor="pins"]').click();
 if(!visible)return;
 const part=replayButtonPart();
 const control=$('#replayButtonPress');
 control.disabled=!part||sourcePending;
 control.setAttribute('aria-busy',String(Boolean(buttonReplay)));
 const status=!part?'示例中的按键已移除。可从初始实验恢复接线。':sourcePending?'先应用代码草稿，再重放同一段按压。':buttonReplayStatus;
 const output=$('#buttonReplayStatus');
 if(output.textContent!==status)output.textContent=status;
}
function stopButtonReplay(status){
 if(!buttonReplay)return false;
 const {part}=buttonReplay;
 buttonReplay=null;
 part.pressed=false;
 settleButtonContact(part);
 buttonReplayStatus=status;
 avrCircuitIO.invalidateAnalog();
 return true;
}
function startButtonReplay(){
 const part=replayButtonPart();
 if(!part||buttonReplay||sourcePending||!canExecute())return;
 if(circuit.components.some(item=>item.type==='button'&&item.pressed))return toast('先松开按键，再重放同一段按压。');
 pause();
 if(!build())return;
 const startMs=lastState.timeMs+1;
 buttonReplay={part,startMs,runtime,project:circuit,key:sourceCircuitKey(circuit,board()),source:appliedSource,samples:[]};
 scheduleButtonPress(part,startMs,startMs+buttonReplayHoldMs);
 buttonReplayStatus='正在按虚拟时间重放。按住 25 ms 后松开。';
 renderButtonReplayControls();
 startExecution();
}
function sampleButtonReplay(instance,timeMs,readState){
 const replay=buttonReplay;
 if(!replay||replay.runtime!==instance||replay.project!==circuit)return;
 const ms=timeMs-replay.startMs;
 if(!Number.isFinite(ms)||ms< -1||ms>buttonReplayEndMs||replay.samples.length>=256)return;
 if(replay.samples.at(-1)?.ms>=ms)return;
 const state=readState();
 if(state.error||state.timeMs!==timeMs)return;
 const reading=sim.sampleAtCurrentTime(circuit,state);
 const voltage=groundedPinMeasurement('mcu:PB1',reading).voltage;
 const current=sourceTraceResultValid(reading)?reading.parts.led1?.currentMa:null;
 const stable=state.variables?.stableLevel,count=state.variables?.pressCount;
 replay.samples.push({ms,voltage,current:current??null,stable:Number.isFinite(stable)?stable:null,count:Number.isFinite(count)?count:null});
}
function updateButtonReplay(){
 const replay=buttonReplay;
 if(!replay)return;
 if(replay.project!==circuit||!circuit.components.includes(replay.part)||lastState.error||lastState.done){
  stopButtonReplay('重放已停止。请检查程序是否持续运行以及按键是否仍在接线中。');
  return;
 }
 const elapsed=lastState.timeMs-replay.startMs;
 if(elapsed<=buttonReplayEndMs){
  replay.part.pressed=elapsed>=0&&elapsed<buttonReplayHoldMs;
  return;
 }
 stopButtonReplay('已记录按下和松开。');
 if(sourceCircuitKey(circuit,board())!==replay.key){buttonReplayStatus='重放期间电路有改动，请重放后再对照。';return;}
 const {samples,key,source}=replay;
 if(!samples.some(({ms})=>ms>=0&&ms<buttonReplayHoldMs)||!samples.some(({ms})=>ms>=buttonReplayHoldMs)){
  buttonReplayStatus='采样太稀，未记录完整过程。可将循环采样间隔改回 1 ms。';
  return;
 }
 const first=samples[0],last=samples.at(-1);
 const delta=Number.isFinite(first.count)&&Number.isFinite(last.count)?last.count-first.count:null;
 let toggles=null,previous=null;
 for(const {current} of samples){
  if(!Number.isFinite(current)){previous=null;continue;}
  const on=current>.02;
  toggles??=0;
  if(previous!==null&&previous!==on)toggles++;
  previous=on;
 }
 if(buttonCapture?.key!==key)buttonReference=null;
 else if(!sameSourceFiles(buttonCapture.source,source))buttonReference=buttonCapture;
 buttonCapture={key,source,samples,delta,toggles};
 renderButtonBounceTrace($('#buttonBounceTrace'),buttonCapture,buttonReference);
 const current=Number.isFinite(delta)?delta+' 次':'未读到计数';
 const prior=buttonReference?.delta;
 buttonReplayStatus=Number.isFinite(prior) ? `程序确认次数从 ${prior} 次变为 ${current}。查看「按压波形」对照。`
   : `这次程序确认 ${current}。查看「按压波形」。`;
 $('.monitor-panel').classList.remove('collapsed');
 $('[data-monitor="button-bounce"]').click();
}
function actuateButton(part,pressed){
 const cancelled=buttonReplay?.part===part&&stopButtonReplay('已切回手动按键。');
 if(setButtonContact(part,pressed,lastState.timeMs??0)||cancelled){
  avrCircuitIO.invalidateAnalog();
  refresh(false);
 }
}
function encoderPart(id){
 return circuit.components.find(part=>part.type==='encoder'&&part.id===id);
}
function encoderTime(){return runtime?.getState()?.timeMs??lastState.timeMs??0;}
function turnEncoder(id,steps){
 const part=encoderPart(id),time=encoderTime();
 if(!part||!Number.isInteger(steps)||!steps||Math.abs(steps)>24)return 0;
 const direction=Math.sign(steps);
 let accepted=0;
 for(;accepted<Math.abs(steps);accepted++){
  // A native worker can have up to 20 ms of previously sampled inputs in flight.
  const applied=running?scheduleEncoderDetent(part,direction,time,{notBeforeMs:time+(nativeMode()?20:0)}):turnEncoderAtRest(part,direction,time);
  if(!applied)break;
 }
 if(accepted){avrCircuitIO.invalidateAnalog();refresh(false);}
 return accepted*direction;
}
function settleEncoderInputs(){
 const time=encoderTime();
 for(const part of circuit.components)if(part.type==='encoder')settleEncoderContact(part,time);
}
function joystickPart(id){
 return circuit.components.find(part=>part.type==='joystick'&&part.id===id);
}
function moveJoystick(id,pose){
 const part=joystickPart(id);
 if(!part||!setJoystickState(part,pose))return false;
 avrCircuitIO.invalidateAnalog();
 refresh(false);
 return true;
}
function toggleDipSwitch(id,index){
 const part=circuit.components.find(item=>item.id===id&&item.type==='dipswitch'&&!item.hidden);
 if(!part||!Number.isInteger(index)||index<0||index>3)return false;
 pushUndo();
 part.switchMask=(part.switchMask??0)^(1<<index);
 avrCircuitIO.invalidateAnalog();
 refresh(false);
 save();
 return true;
}
function photoresistorPart(id){
 return circuit.components.find(item=>item.id===id&&item.type==='ldr'&&item.ldrModel==='pdv-p8103');
}
function adjustPhotoresistor(id,next){
 const part=photoresistorPart(id);
 if(!part||part.hidden||Object.entries(next).every(([key,value])=>part[key]===value))return false;
 pushUndo();
 Object.assign(part,next);
 avrCircuitIO.invalidateAnalog();
 refresh(false);
 save();
 return true;
}
function togglePhotoresistorCover(id){
 const part=photoresistorPart(id);
 if(part)return adjustPhotoresistor(id,{ldrCovered:!part.ldrCovered});
}
function nativeSliceForInputs(time){
 let slice=20*Math.min(1,speed);
 for(const part of circuit.components){
  if(part.type!=='encoder')continue;
  const edge=encoderContact(part,time).nextEdgeMs;
  if(edge!==null)slice=Math.min(slice,Math.max(.05,edge-time));
 }
 return slice;
}
$('#replayButtonPress').onclick=startButtonReplay;
$('#locateDebounce').onclick=()=>{
 const lines=files['main.c']?.split('\n')??[];
 const index=lines.findIndex(line=>/^\s*#\s*define\s+DEBOUNCE_MS\b/.test(line));
 if(index<0)return toast('当前 main.c 中找不到 DEBOUNCE_MS 定义。');
 jumpLine('main.c',index+1);
};
function resetRuntime({preserveProgrammed=false,preserveI2cDevices=preserveProgrammed,preservePhotocellStates=preserveProgrammed}={}){
 settleEncoderInputs();
 avrCircuitIO.invalidateAnalog();
 cancelNativeDraftCompile();
 clearTimeout(liveTimer);errors=[];runtime?.dispose?.();runtime=null;
 if(!preserveProgrammed)programmedSource=null;
 appliedSource=null;sourcePending=false;sourceObserved=null;sourceComparison=null;sourceTrace=null;sourceTraceComparison=null;sourceDelaySample=null;pause();compiled=false;liveDiagnostics=[];
 sourceProbeTrace.reset();
 sourceLedTrace.reset();
 motorStopTrace.sync(null);
 buttonCapture=buttonReference=null;buttonReplayStatus='';
 renderButtonBounceTrace($('#buttonBounceTrace'),null,null);
 for(const part of circuit.components)if(part.type==='button')settleButtonContact(part);
 sim.reset({preserveServoAngles:true,preserveI2cDevices,preservePhotocellStates});lastState={pins:{},timeMs:0,variables:{}};serialText='';nativeSerialText={};history=[];
 $('#boardHardwareResetStatus').textContent='';
 $('#compileErrors').hidden=true;$('#firmwareError').hidden=true;
 $('#codeStatus').textContent='可编辑 · Ctrl / ⌘ + Enter 运行';delete $('#codeStatus').dataset.state;refresh();updateEditor();
}
function showNativeFirmwareDetails(expanded){
 const button=$('#temperatureFirmwareDetails');
 $('#firmwarePanel').dataset.compact=String(!expanded);
 button.setAttribute('aria-expanded',String(expanded));
 button.textContent=expanded?'收起固件详情':'展开固件详情';
}
$('#temperatureFirmwareDetails').onclick=event=>showNativeFirmwareDetails(event.currentTarget.getAttribute('aria-expanded')!=='true');
function syncFirmwareView(){
 const active=nativeMode(),button=$('#firmwareModeButton'),profile=board();
 const stm32=isStm32Native(profile),pico=isRp2040Native(profile);
 const shared=example.id===stm32TemperatureDisplayLessonId;
 const localDraft=Boolean(example.nativeOnly&&stm32);
 const draftPanel=$('#nativeDraftPanel');
 draftPanel.hidden=!localDraft;
 const firmwarePanel=$('#firmwarePanel'),choices=$('#temperatureFirmwareActions');
 if(firmwarePanel.dataset.localDraft!==String(localDraft)){
  firmwarePanel.dataset.localDraft=String(localDraft);
  showNativeFirmwareDetails(!localDraft);
 }
 $('#temperatureFirmwareDetails').hidden=!localDraft;
 const anchor=shared?$('#ambientControls'):$('#temperatureDisplayWires');
 if(choices.nextElementSibling!==anchor)anchor.before(choices);
 if(localDraft){
  if(firmwarePanel.previousElementSibling!==draftPanel)draftPanel.after(firmwarePanel);
 }else if(firmwarePanel.nextElementSibling!==$('.editor-heading'))$('.editor-heading').before(firmwarePanel);
 $('#i2cTemperatureTitle').textContent=shared?'共享 I²C · 温度显示':'MCP9808 · I²C 温度';
 choices.setAttribute('aria-label',shared?'摄氏和华氏原生固件':'两种报警阈值的原生固件');
 button.hidden=!profile.capabilities.nativeFirmware;
 button.dataset.active=String(active);
 button.textContent=active?'固件已启用':'原生固件';
 $('.editor-panel').dataset.execution=active?'native':example.nativeOnly?'firmware-required':'source';
 $('button[data-mobile-pane="editor"]').textContent=active||example.nativeOnly?'固件与波形':'编写代码';
 firmwarePanel.hidden=!active;
 $('#firmwareExit').textContent=example.nativeOnly?'停止使用固件':'返回源码';
 $('#beginnerGuide').dataset.execution=active&&!example.nativeOnly?'native':'source';
 $('#faultInjectButton').hidden=active||Boolean(example.nativeOnly);
 $('#deselectButton').textContent=active?'关闭所选属性':'回到代码讲解';
 const stm32Ports=getStm32FirmwareTarget(profile.id)?.serialPorts;
 const serialPorts=active?(stm32?stm32Ports:pico?['UART0']:profile.serialPorts):['Serial'];
 if(nativeSerialTarget!==profile.id||!serialPorts.includes(nativeSerialPort))nativeSerialPort=serialPorts[0];
 nativeSerialTarget=profile.id;
 $('#serialPortField').hidden=serialPorts.length<2;
 $('#serialPortSelect').innerHTML=serialPorts.map(name=>'<option>'+esc(name)+'</option>').join('');
 $('#serialPortSelect').value=nativeSerialPort;
 firmwareImage=active?parseFirmwareImage(loadedFirmware,profile):null;
 if(localDraft)loadNativeDraftFiles();
 if(active){
  const mega=profile.id==='mega2560';
  $('#firmwareTarget').textContent=firmwareTargetName(profile);
  $('#firmwareCore').textContent=stm32||pico?nativeCore(profile):'AVR · 16 MHz';
  $('#firmwareCyclesLabel').textContent=stm32||pico?'估算时钟周期':'已执行时钟周期';
  $('#firmwareName').textContent=loadedFirmware.name;
  $('#firmwareSize').textContent=firmwareImage.byteCount.toLocaleString('zh-CN')+' 字节写入 Flash · 容量 '+profile.flashBytes/1024+' KiB';
  $('#firmwareDownload').textContent='下载 '+firmwareExtension(loadedFirmware.name).toUpperCase();
  $('#firmwareState').textContent=$('#runStatus').textContent;
  $('#firmwareSupport').textContent=stm32
   ? '从用户 Flash 的复位向量启动。支持 Cortex-M3 单步、GPIO、ADC1 单通道软件采样、TIM2–4 边沿对齐 PWM、SysTick 中断和 '+stm32Ports.join('／')+' 字节控制台。I²C1 默认走 PB6/SCL、PB7/SDA，支持 7 位主机轮询。PWM 要求 APB1 分频 ÷1 或 ÷2。电压按仿真切片采样。'
   : pico ? '按经典 Pico 的 Flash 启动向量执行 Cortex-M0+ 单核程序。支持 GPIO、GP26–GP28 的 12 位 ADC、自由运行边沿对齐 PWM 和 UART0 字节终端。ADC 参考电压采用标称 3.3 V，电路输入按仿真切片采样。'
   : '支持 GPIO、单端单次 ADC、'+(mega?'Timer0–5 基础计数与比较、四路 USART 字节控制台。':'Timer0–2、USART0 字节控制台。')+'TWI 主机可通过接线读 MCP9808 或写 SSD1306，支持重复 START。按寄存器配置估算字节时间。ADC 自动触发、SPI、逐位波形、EEPROM、看门狗、休眠和启动加载器尚未模拟。';
 }
}
function showFirmwareError(error){
 pause();
 const message=error.plain||error.message||String(error);
 const details=[message,error.technical,error.fix].filter(Boolean);
 const box=$('#firmwareError');
 box.textContent=details.join(' ');
 box.hidden=false;
 setRunStatus('固件执行已停止');
 $('#statusDot').className='status-dot error';
}
async function nativeRuntimeCreator(profile){
 if(isStm32Native(profile))return (await import('./stm32-firmware-runtime.js')).createStm32FirmwareRuntime;
 if(isRp2040Native(profile))return (await import('./rp2040-firmware-runtime.js')).createRp2040FirmwareRuntime;
 return (await import('./avr-firmware-runtime.js')).createAvrFirmwareRuntime;
}
async function ensureRuntime(request,{onFailure}={}){
 if(!nativeMode())return compiled&&!sourcePending||build();
 if(compiled)return true;
 const profile=board(),image=firmwareImage;
 setRunStatus('正在加载 '+nativeCore(profile)+' 仿真…');
 try{
  const create=await nativeRuntimeCreator(profile);
  if(request!==executionRequest)return false;
  sim.reset({preserveServoAngles:true,preserveI2cDevices:true,preservePhotocellStates:true});history=[];
  let next;
  next=await create(image,{...avrCircuitIO,boardId:profile.id,onSerial:(text,port)=>{
   if(request!==executionRequest && (!next||runtime!==next))return;
   nativeSerialText[port]=((nativeSerialText[port]||'')+text).slice(-50000);
  }});
  if(request!==executionRequest){next.dispose?.();return false;}
  runtime=next;
  compiled=true;
  $('#firmwareError').hidden=true;
  return true;
 }catch(error){if(request===executionRequest){showFirmwareError(error);onFailure?.();}return false;}
}
function canExecute(){
 if(!circuit.powered){toast('请先打开开发板供电。');return false;}
 if(circuit.boot0&&(!nativeMode()||isStm32Native(board()))){toast('当前 BOOT0=1，请改回 0 并复位后运行用户程序。');return false;}
 return true;
}
async function toggleRun(){
 if(running)return pause();
 if(!canExecute())return;
 if(example.nativeOnly&&!nativeMode()){
  const initial=temperatureFirmwareFor(example.id)?.variants[0][0];
  return initial?runTemperatureFirmware(initial):compileNativeDraft();
 }
 const request=++executionRequest;
 if(!await ensureRuntime(request)||request!==executionRequest)return;
 startExecution();
 return true;
}
function startExecution(){
 running=true;
 sourceFrameAt=null;
 renderSourceRunControls();
 setRunStatus(sourcePending?'上次应用的程序正在运行 · 草稿未应用':'正在运行');
 $('#statusDot').className='status-dot running';
 if(soundEnabled)initSound();
 runLoop();
}
function runSourceFrame(instance,before,now){
 // Cap delayed frames so backgrounding or a slow draw cannot skip a long
 // stretch of visible motion. Starting or resuming always starts at zero.
 const elapsed=sourceFrameAt===null?0:Math.max(0,Math.min(now-sourceFrameAt,sourceFrameMs*2));
 sourceFrameAt=now;
 const budget=elapsed*speed;
 const snapshot=instance.runSlice(budget,1000);
 return budget>0&&!snapshot.done&&!snapshot.pendingDelay&&snapshot.timeMs===before
  ? instance.advanceTime(budget) : snapshot;
}
async function runLoop(){
 if(!running)return;
 const native=nativeMode(),previous=lastState,before=previous.timeMs||0,instance=runtime,request=executionRequest;
 try{
  if(native){
   avrCircuitIO.invalidateAnalog();
   await instance.advanceTime(nativeSliceForInputs(before));
   if(request!==executionRequest||runtime!==instance)return;
   lastState=instance.getState();
  }
  else{
   sourceDelaySample=null;
   lastState=runSourceFrame(instance,before,performance.now());
  }
  updateButtonReplay();
  if(native&&lastState.error)showFirmwareError(lastState.error);
  else if(lastState.done){pause();setRunStatus('程序已结束');}
  const sourceMoved=lastState.executedSteps!==previous.executedSteps||lastState.error;
  refresh(native||Boolean(sourceMoved),{sourceAdvanced:!native,state:lastState});
  if(!native){
   if(sourceMoved)updateEditor();
   const failed=(lastState.diagnostics||[]).filter(d=>d.severity==='error');
    if(failed.length){showSourceRuntimeErrors(failed);return;}
  }
  if(running){
   const nextFrame=native?Math.max(5,Math.min(2000,Math.max(5,lastState.timeMs-before)/speed)):
    Math.max(8,Math.min(sourceFrameMs,(lastState.pendingDelay?.remainingMs??0)/speed));
   loopTimer=setTimeout(runLoop,nextFrame);
  }
 }catch(error){if(request!==executionRequest||runtime!==instance)return;if(native)showFirmwareError(error);else{sourceDelaySample=null;recordSourceMeasurementGap();showSourceRuntimeErrors(error.diagnostics?.length?error.diagnostics:[normalizeError(error)]);}refresh();}
}
function stepSource(instance){
 const wait=lastState.pendingDelay;
 if(wait&&circuit.components.some(part=>part.type==='capacitor'||part.type==='motor')){
  // Skip drawing the waiting frames, but keep integrating charge and rotor
  // motion. Bound the work even if the program requests a very long wait.
  const segments=Math.min(96,Math.ceil(wait.remainingMs/sourceFrameMs));
  const slice=wait.remainingMs/segments;
  for(let index=1;index<segments;index++){
   const intermediate=instance.advanceTime(slice);
   if(intermediate.error)return intermediate;
   sim.solve(circuit,intermediate,{averagePWM:false});
  }
 }
 return instance.step(1,{deferDelay:true});
}
async function stepProgram(){
 if(example.nativeOnly&&!nativeMode())return;
 pause();
 if(!canExecute())return;
 const request=++executionRequest;
 if(!await ensureRuntime(request)||request!==executionRequest)return;
 const native=nativeMode();
 const instance=runtime;
 try{
  if(native){
   avrCircuitIO.invalidateAnalog();
   await instance.step(1);
   if(request!==executionRequest||runtime!==instance)return;
   lastState=instance.getState();
  }else{
   sourceDelaySample=null;
   lastState=stepSource(instance);
  }
  if(lastState.error){
   if(native)showFirmwareError(lastState.error);
   else{sourceDelaySample=null;showErrors((lastState.diagnostics||[]).filter(d=>d.severity==='error'));}
   refresh(true,{sourceAdvanced:!native,state:lastState});
   return;
  }
  if(lastState.pc?.file&&files[lastState.pc.file]!==undefined&&activeFile!==lastState.pc.file){activeFile=lastState.pc.file;renderFiles();loadEditor();}
  if(lastState.pc?.line){editorLine=lastState.pc.line;$('#codeEditor').scrollTop=Math.max(0,(editorLine-6)*22);}
  refresh(true,{sourceAdvanced:!native,state:lastState});
  if(!native)updateEditor();
  setRunStatus(lastState.done?'程序已结束':lastState.pendingDelay?'停在等待处 · 可运行或完成等待':
   lastState.status==='waiting'?(native?'此处需在运行模式处理等待或异常':'等待已结束 · 点击单步继续'):'单步 · 已暂停');
 }catch(error){if(request!==executionRequest||runtime!==instance)return;if(native)showFirmwareError(error);else{sourceDelaySample=null;recordSourceMeasurementGap();showErrors(error.diagnostics?.length?error.diagnostics:[normalizeError(error)]);}}
}
$('#runButton').onclick=toggleRun;$('#stepButton').onclick=stepProgram;
async function applySourceDraft(){
 if(nativeMode()||example.nativeOnly||(appliedSource&&!sourcePending))return false;
 if(!running)return toggleRun();
 if(!canExecute()||!build())return false;
 pause();
 startExecution();
 return true;
}
$('#applySourceButton').onclick=async event=>{
 const trigger=event.currentTarget;
 const focused=document.activeElement===trigger;
 await applySourceDraft();
 if(focused&&trigger.hidden&&(document.activeElement===trigger||document.activeElement===document.body))$('#runButton').focus({preventScroll:true});
};
$('#sourceHardwareLocate').onclick=event=>{setMobilePane('scene');locateScenePin(event.currentTarget.dataset.endpoint);};
function openSourceScope(signal){
 if(nativeMode())return;
 sourceTraceSignal=signal;
 if(signal==='pin')$('#sourceHardwareCompare').open=false;
 if(signal!=='pin'&&compactWorkspace.matches)setMobilePane('editor');
 $('.monitor-panel').classList.remove('collapsed');
 $('[data-monitor="pins"]').click();
 const trace=$('#sourceHardwareTrace');
 if(!trace.hidden){
  trace.open=true;
  trace.scrollIntoView({block:'nearest'});
  trace.querySelector('summary').focus({preventScroll:true});
 }else{
  $('#sourceTraceMonitor').scrollIntoView({block:'nearest'});
  $('#sourceTraceSignal').focus({preventScroll:true});
 }
}
$('#openSourceTrace').onclick=()=>{if(sourceTraceComparison)openSourceScope('pin');};
$('#openSourceLedTrace').onclick=()=>{if(trackedSourceLed())openSourceScope('led');};
$('#stopSourceLedTrace').onclick=()=>{
 trackedLedId=null;sourceLedTrace.reset();renderSourceScope();
 $('#wavePinSelect').focus({preventScroll:true});
};
$('#sourceTraceSignal').onchange=event=>{
 sourceTraceSignal=event.currentTarget.value;
 renderSourceScope();
 const trace=$('#sourceHardwareTrace');
 if(!trace.hidden)trace.open=true;
};
$('#sourceHardwareLine').onclick=()=>{
 const {activity}=sourceHardwareSnapshot();
 const event=activity?.pwm??activity?.write??activity?.adc;
 if(event?.file&&event.line&&!sourcePending)jumpLine(event.file,event.line);
};
function syncBoardHardwareReset(){
 const label=hardwareResetLabel(board().id),button=$('#boardHardwareResetButton');
 const control=$('#boardHardwareResetControl');
 if(control)control.hidden=!label;
 button.hidden=!label;
 if(label){button.textContent=label+' 复位';button.setAttribute('aria-label','按下板载 '+label+' 复位');}
}
function reportBoardHardwareReset(message){
 $('#boardHardwareResetStatus').textContent=message;
 toast(message);
}
async function resetBoardHardware(){
 const profile=board(),label=hardwareResetLabel(profile.id),native=nativeMode();
 if(!label)return false;
 if(!circuit.powered){reportBoardHardwareReset(label+' · 开发板未供电，程序未启动。');return false;}
 if(isStm32Native(profile)&&circuit.boot0){reportBoardHardwareReset(label+' · BOOT0=1。改回 0 再按复位，才能启动用户程序。');return false;}
 if(!native&&programmedSource?.boardId!==profile.id){reportBoardHardwareReset(label+' · 尚无已应用的程序。先应用代码，板载复位才能重新启动。');return false;}
 if(native&&!firmwareImage){reportBoardHardwareReset(label+' · 尚无可启动的固件。');return false;}
 cancelNativeDraftCompile();
 nativeServoComparison=null;
 clearNativeRelayObservation();

 let next,initial;
 if(!native){
  try{next=createSourceRuntime(programmedSource.built,profile.id);initial=next.getState();}
  catch(error){reportBoardHardwareReset(label+' · 无法启动已应用的程序。'+(error?.message||''));return false;}
 }
 pause();
 const request=executionRequest;
 settleEncoderInputs();
 runtime?.dispose?.();runtime=null;compiled=false;
 sim.reset({preserveServoAngles:true,preserveMotorStates:true,preserveI2cDevices:true,preservePhotocellStates:true});avrCircuitIO.invalidateAnalog();history=[];serialText='';nativeSerialText={};
 motorStopTrace.begin(motorLessonKey(),false);
 sourceObserved=null;sourceTrace=null;sourceTraceComparison=null;sourceDelaySample=null;sourceProbeTrace.reset();sourceLedTrace.reset();
 if(native){
  lastState={pins:{},timeMs:0,variables:{}};
  refresh();
  if(!await ensureRuntime(request,{onFailure:()=>reportBoardHardwareReset(label+' · 固件复位失败，请查看运行提示。')})||request!==executionRequest)return false;
  lastState=runtime.getState();
 }else{
  runtime=next;compiled=true;lastState=initial;
  appliedSource=programmedSource.files;sourcePending=!sameSourceFiles(appliedSource,files);
  if(!sourcePending){errors=[];$('#compileErrors').hidden=true;}
 }
 refresh();updateEditor();startExecution();
 reportBoardHardwareReset(label+(native?' · 已从复位入口重新启动固件。':sourcePending?' · 已重新启动上次应用的程序。编辑区草稿保留。':' · 已从入口重新启动当前程序。'));
 return true;
}
$('#boardHardwareResetButton').onclick=resetBoardHardware;
$('#resetButton').onclick=()=>{nativeServoComparison=null;clearNativeRelayObservation();resetRuntime({preserveProgrammed:true});toast(nativeMode()?'固件已复位，下次从复位向量启动。':'程序与虚拟时间已复位，代码和接线保留。');};
$('#speedSelect').onchange=e=>speed=Number(e.target.value);
$('#powerSwitch').checked=circuit.powered;$('#bootSwitch').checked=circuit.boot0;$('#powerSwitch').onchange=e=>{pushUndo();circuit.powered=e.target.checked;if(nativeMode())resetRuntime({preservePhotocellStates:true});else{pause();refresh();}save();};$('#bootSwitch').onchange=e=>{pushUndo();circuit.boot0=e.target.checked;resetRuntime({preserveProgrammed:!!hardwareResetLabel(board().id)});refresh();save();};
function explanationsFor(file){const source=files[file]||'',context=editorBoardContext(),key=context.id+':'+context.adcMax;if(explanationCache?.source===source&&explanationCache.key===key)return explanationCache.items;const items=explainSource(source,explain,context);explanationCache={source,key,items};return items;}
function explain(line){if(Content.explainLine){const d=Content.explainLine(line);if(d?.plain)return d;}const t=String(line||'').trim();if(!t)return {title:'留白，让代码更好读',plain:'空行不会让芯片做动作，它只是把不同步骤分开。',technical:'空白字符分隔记号，不产生独立执行语句。'};if(t.startsWith('//'))return {title:'这是一句给人看的注释',plain:t.slice(2).trim()||'注释帮助你记住代码的目的。',technical:'C 编译或解释时忽略注释内容。'};if(t.startsWith('#include'))return {title:'先拿到函数的“使用说明”',plain:'告诉程序：接下来要用这个头文件里声明的名称。它本身不会点亮灯。',technical:'头文件提供声明、类型与宏；实现由工程源文件或库提供。本平台的外设由仿真兼容层实现。'};const g=glossary.find(g=>t.includes(g.name||g.signature?.split('(')[0]||'__never__'));if(g)return {title:g.name||g.title,plain:g.plain,technical:g.technical,gotcha:g.gotcha};if(/RCC_.*ClockCmd/.test(t))return {title:'给这一组引脚打开工作时钟',plain:'先允许这个外设工作。少了这一步，后面的配置可能无法生效。',technical:'RCC 的外设时钟门控。时钟是数字逻辑节拍，不等于给整个板子接电源。'};if(/GPIO_SetBits/.test(t))return {title:'把选中的输出脚设为高电平',plain:'在正确配置为输出后，这个脚会尝试输出接近 3.3V。灯亮不亮还取决于接线。',technical:'置位输出数据位；推挽输出驱动高电平，开漏输出释放引脚。'};if(/GPIO_ResetBits/.test(t))return {title:'把选中的输出脚拉到低电平',plain:'这个脚靠近 GND 的电位。外接灯可能熄灭，而 PC13 板载灯会点亮。',technical:'清零输出数据位；LED 状态由电流路径决定。'};if(/Delay_ms/.test(t)){const v=/Delay_ms\(([^)]+)\)/.exec(t)?.[1];return {title:'保持当前状态，等一会儿',plain:'等待 '+v+' 毫秒后再执行下一步。1000 毫秒就是 1 秒。',technical:'这里推进虚拟时间，并非等待真实 CPU 指令周期。'};}if(/GPIO_InitTypeDef/.test(t))return {title:'准备一张引脚配置单',plain:'这张单子里要填写：哪个脚、输入还是输出、输出速度。现在只是创建单子，还没交给硬件。',technical:'声明结构体变量，字段用于传递 GPIO 初始化参数。'};if(/GPIO_Pin\s*=/.test(t))return {title:'选中要设置的引脚',plain:'给配置单填“我要操作哪个脚”。GPIO_Pin_0 是第 0 号脚；具体属于 A 组还是 B 组由 GPIO_Init 决定。',technical:'GPIO_Pin 字段是位掩码，按位或 | 可以选中多个引脚。'};if(/GPIO_Mode\s*=/.test(t))return {title:'选择这个脚的工作方式',plain:'设置成输出，才能主动控制电平；设置成输入，则是读取外面的状态。',technical:'模式决定推挽/开漏、输入上下拉、模拟或复用功能。'};if(/GPIO_Init\(/.test(t))return {title:'把填好的配置单交给这组引脚',plain:'这一句才让刚才填写的引脚模式生效。& 的意思是把配置单所在的位置交过去。',technical:'函数接收 GPIO 寄存器组与 GPIO_InitTypeDef 指针。'};if(/^while\s*\(\s*1\s*\)/.test(t))return {title:'让里面的动作一直重复',plain:'条件 1 总为真，所以做完花括号里的动作后会从头再做。',technical:'无限循环；本平台按执行预算分段运行，避免阻塞页面。'};if(/^if\b/.test(t))return {title:'先判断，再决定走哪条路',plain:'括号里的条件成立，才执行后面的代码块。',technical:'条件表达式非零为真，零为假。'};if(/^else\b/.test(t))return {title:'条件不成立时，走这里',plain:'前面的 if 没满足，就执行这一段。',technical:'else 与最近尚未匹配的 if 对应。'};if(/^[{}];?$/.test(t))return {title:t.includes('{')?'这一组动作从这里开始':'这一组动作到这里结束',plain:'花括号把多句代码放在同一个代码块里。',technical:'代码块界定作用域与控制结构的范围。'};if(/^int main/.test(t))return {title:'程序的主要入口',plain:'完成系统启动后，用户程序从 main 开始做事。',technical:'本平台从 main 进入解释执行；真实启动代码和时钟初始化不在这一行里。'};if(/return/.test(t))return {title:'把结果交回调用它的地方',plain:'当前函数完成工作，把 return 后面的值交回去。',technical:'return 结束当前函数；返回类型应与声明一致。'};if(/=/.test(t))return {title:'把计算结果记到变量里',plain:'先计算等号右边，再把结果放进左边的变量或结构体字段。',technical:'赋值运算；= 是赋值，== 才是比较是否相等。'};return {title:'读懂这一步的目的',plain:'先看这个名称在哪里定义，以及它接收什么参数。用户自己写的函数可以切换文件查看。',technical:'本平台会按支持范围内的 C 语法执行，遇到未实现语法或外设会给出位置提示。'};}
function renderInspector(){inspectorKey=selected;$('#inspectorTitle').textContent=selectedWire?'选中的导线':selected?'元件与接线属性':'这一刻，在发生什么';const box=$('#inspectorBody');if(selected&&selected!=='mcu'&&selected!=='breadboard'&&circuit.components.some(p=>p.id===selected)){renderPartInspector();return;}if(selectedWire){const w=circuit.wires.find(x=>x.id===selectedWire);if(w){box.innerHTML='<h3 class="moment-title">'+esc(w.a)+' → '+esc(w.b)+'</h3><p class="moment-copy">点击端点可查看引脚。选择一端重新连接；删除和重接均可撤销。</p><div class="project-actions"><button class="button" id="reconnectA">重接起点</button><button class="button" id="reconnectB">重接终点</button><button class="text-button" id="removeWire">删除导线</button></div>';$('#removeWire').onclick=()=>deleteWire(w.id);$('#reconnectA').onclick=()=>workbench?.beginReconnect?.(w.id,'a');$('#reconnectB').onclick=()=>workbench?.beginReconnect?.(w.id,'b');return;}}if(selected==='mcu'){const p=board();box.innerHTML='<span class="moment-tag">'+esc(p.family)+'</span><h3 class="moment-title">'+esc(p.name)+'</h3><p class="moment-copy">'+esc(p.logicVoltage)+' V 逻辑 · '+esc(p.mcu)+'。点击引脚查看名称与电压；接线模式支持点击两端或拖拽连接。</p><details class="details"><summary>本板模型与实物边界</summary><p>'+esc((p.notes||[]).join(' '))+'</p><p>'+esc(p.footprintNote)+'</p></details>';return;}if(selected==='breadboard'){box.innerHTML='<span class="moment-tag">面包板 / 400 孔</span><h3 class="moment-title">孔里面，已经连好了一部分。</h3><p class="moment-copy">同一列 a–e 五孔相通，f–j 五孔相通；中间沟槽两侧不通。上、下两组电源轨互不相通。</p><div class="code-quote">a1 = b1 = c1 = d1 = e1<br>f1 = g1 = h1 = i1 = j1<br>e1 ≠ f1<br>p1–p25 上正轨；p26–p50 下正轨</div>';return;}
 if(nativeMode()){box.innerHTML='<span class="moment-tag">'+esc(board().mcu+' · '+nativeCore(board()))+'</span><h3 class="moment-title">正在使用原生固件</h3><p class="moment-copy">点击引脚观察电压。右侧可查看下一条指令的地址和已经执行的时钟周期。</p>';return;}
 const pc=running&&!sourcePending?lastState.pc:null;const file=pc?.file&&files[pc.file]!==undefined?pc.file:activeFile;const line=pc?.line||editorLine;const source=(files[file]||'').split('\n')[line-1]||'';const d=(explanationsFor(file)[line-1]||explainSourceLine(source,explain,editorBoardContext()));box.innerHTML='<span class="moment-tag">'+esc(file)+' · 第 '+line+' 行</span><h3 class="moment-title">'+esc(d.title)+'</h3><p class="moment-copy">'+esc(d.plain)+'</p><div class="code-quote">'+esc(source.trim()||'// 空行')+'</div><details class="details"><summary>再看专业说法</summary><p>'+esc(d.technical)+'</p>'+(d.gotcha?'<p>容易误解：'+esc(d.gotcha)+'</p>':'')+'</details><div class="detail-label">这次实验的目标</div><div class="detail-value">'+esc(example.learningGoals?.[0]||example.description)+'</div>';}
$('#deselectButton').onclick=()=>selectScenePart(null);
$('#explainButton').onclick=()=>{modal(activeFile+' · 逐句白话', '<p>先读每句的目的，再对照左侧代码。空行和注释默认略过。</p>'+($('#codeEditor').value.split('\n').map((l,i)=>l.trim()&&!l.trim().startsWith('//')?'<div class="explain-line"><span>'+(i+1)+'</span><code>'+esc(l.trim())+'</code><span>'+esc((explanationsFor(activeFile)[i]||{}).plain)+'</span></div>':'').join('')));};
$('#initialCodeButton').onclick = () => {
  const original = examples.find(item => item.id === example.id)?.files;
  if (!original) return modal('初始注释代码', '<p>这是你导入的工程。可点「解释全文」阅读当前文件的注释，也可重新导入原文件恢复。</p>');
  const names = Object.keys(original);
  const changed = names.length !== Object.keys(files).length || names.some(name => files[name] !== original[name]);
  modal('初始注释代码', `<p>查看本实验自带的源码和逐行说明。恢复初始代码会替换编辑区的文件，保留开发板、元件和接线。恢复后可撤销。</p><div class="original-code-controls"><label for="initialCodeFile">源文件</label><select id="initialCodeFile">${names.map(name => `<option>${esc(name)}</option>`).join('')}</select><button class="button" id="restoreInitialCode" ${changed ? '' : 'disabled'}>恢复初始代码</button></div><div id="initialCodePreview" aria-label="初始源文件与逐行说明"></div>`);
  const selector = $('#initialCodeFile');
  selector.value = names.includes(activeFile) ? activeFile : names[0];
  const preview = () => {
    const source = original[selector.value];
    const annotations = explainSource(source, explain, board());
    $('#initialCodePreview').innerHTML = source.split('\n').map((line,i) =>
      `<div class="explain-line"><span>${i+1}</span><code>${esc(line)}</code><span>${esc(line.trim() ? annotations[i]?.plain : '')}</span></div>`).join('');
  };
  selector.onchange = preview;
  preview();
  $('#restoreInitialCode').onclick = () => {
    pushUndo({includeCode:true});
    files = clone(original);
    activeFile = selector.value;
    $('#modal').close();
    renderFiles();
    loadEditor();
    sourceDraftChanged();
    toast('初始代码已恢复，电路保持原样。可撤销。');
  };
};
function partGlyph(type){const content={led:'<path d="M18 20v10m8-10v7" stroke="#9ba6a7" stroke-width="2"/><path d="M14 20V12a8 8 0 0 1 16 0v8z" fill="#e96f66" stroke="#bc564d"/><path d="M17 12a5 5 0 0 1 6-5" fill="none" stroke="#ffc9bd" stroke-width="2"/>',resistor:'<path d="M2 15h40" stroke="#b6b9ad" stroke-width="2"/><rect x="10" y="9" width="24" height="12" rx="4" fill="#dfce9e"/><path d="M15 9v12m5-12v12" stroke="#e39a4f" stroke-width="3"/><path d="M25 9v12" stroke="#94644b" stroke-width="3"/><path d="M30 10v10" stroke="#c6ac5b" stroke-width="2"/>',button:'<path d="M8 9h30v16H8z" fill="#8c9696"/><path d="M12 5h22v16H12z" fill="#bcc5c2"/><circle cx="23" cy="12" r="6" fill="#353e3e"/><path d="M10 25v5m26-5v5" stroke="#8c9696" stroke-width="2"/>',pot:'<rect x="10" y="11" width="26" height="14" rx="3" fill="#3b7cab"/><circle cx="23" cy="12" r="10" fill="#7e8f8d"/><circle cx="23" cy="12" r="6" fill="#ced7d0"/><path d="M23 7v9" stroke="#7f8c83" stroke-width="2"/><path d="M14 25v5m9-5v5m9-5v5" stroke="#a1afa3" stroke-width="2"/>',buzzer:'<ellipse cx="23" cy="19" rx="14" ry="8" fill="#293c38"/><path d="M9 10v9m28-9v9" stroke="#293c38"/><ellipse cx="23" cy="10" rx="14" ry="8" fill="#4b5d55"/><circle cx="23" cy="10" r="3" fill="#192d23"/>',servo:'<rect x="9" y="8" width="27" height="22" rx="3" fill="#318cbe"/><rect x="7" y="17" width="31" height="4" fill="#58a9cf"/><path d="M12 5h21" stroke="#d9e1db" stroke-width="5"/><circle cx="23" cy="5" r="4" fill="#eef1e7"/>',capacitor:'<path d="M18 24v7m10-7v5" stroke="#aaa" stroke-width="2"/><path d="M12 7h23v17c-7 5-16 5-23 0z" fill="#385b57"/><ellipse cx="23.5" cy="7" rx="11.5" ry="5" fill="#9fae9e"/><path d="M15 13v10" stroke="#9aafa2" stroke-width="4"/><path d="M19 4l9 5m0-5l-9 5" stroke="#748a79"/>',power:'<rect x="6" y="5" width="34" height="23" rx="4" fill="#d2ddd2"/><rect x="11" y="9" width="17" height="10" rx="2" fill="#344d3b"/><text x="13" y="16" fill="#a4d59b" font-size="7">5.0</text><circle cx="33" cy="14" r="3" fill="#899e87"/><circle cx="16" cy="23" r="2" fill="#ce6259"/><circle cx="26" cy="23" r="2" fill="#5c6e5b"/>'};return '<svg viewBox="0 0 46 34" aria-hidden="true">'+(content[type]||'<rect x="9" y="4" width="28" height="24" rx="3" fill="#679278"/><rect x="18" y="10" width="10" height="10" fill="#344b3c"/>')+'</svg>';}
$('#partsList').innerHTML=Object.entries(PARTS).map(([k,p])=>'<button class="part-card" data-add-part="'+k+'" title="'+esc(p.description)+'">'+partGlyph(k)+'<span>'+esc(p.name)+'</span></button>').join('');$$('[data-add-part]').forEach(b=>b.onclick=()=>addPart(b.dataset.addPart));
function addPart(type,defaults={},catalogItem=null){
  if(!PARTS[type])return toast('这个器件暂时只有资料与接线指导。');
  const count=circuit.components.length;
  if(count>=80)return toast('当前实验最多放置80个元件，请先删除不需要的元件。');
  const p={...makePart(type,nextComponentId(type,circuit),1+(count%4)*1.3,((Math.floor(count/4)%3)-1)*1.3),...defaults};
  if(boardPose(circuit,board()).mounted || circuit.components.some(part=>part.mount)){
    const stationary=[breadboardBounds(circuit.breadboard),...circuit.components.map(scenePartBounds)];
    const position=findClearPartPosition(p,circuit.breadboard,stationary);
    if(!position)return toast('面包板旁的空位已用完。请先移动一些元件。');
    Object.assign(p,position);
  }
  pushUndo();
  if(catalogItem){p.catalogId=catalogItem.id;p.displayName=catalogItem.name;}
  circuit.components.push(p);workbench?.setCircuit(circuit);selectScenePart(p.id);refresh();save();
  toast('已添加 '+(catalogItem?.name||PARTS[type].name)+'。拖动摆放，双击起点引脚开始接线。');
}
function renderPartInspector(){
 const p=circuit.components.find(p=>p.id===selected);if(!p)return;const model=PARTS[p.type],data=result?.parts[p.id]||{};
 const kingbrightRgb=p.type==='rgbled'&&p.rgbModel===kingbrightRgbModel;
 const specs=parameterSpecs(p,model).filter(spec=>!kingbrightRgb||spec.key!=='common');
 const fields=specs.map(spec=>{const value=p[spec.key]??model.defaults?.[spec.key]??(spec.numeric?0:''),shown=typeof value==='number'?value*(spec.scale||1):value;let control='';if(spec.type==='boolean')control='<input type="checkbox" data-prop="'+spec.key+'" '+(value?'checked':'')+'>';else if(spec.type==='select')control='<select data-prop="'+spec.key+'">'+spec.options.map(o=>{const [v,label]=Array.isArray(o)?o:[o,o];return '<option value="'+esc(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+esc(label)+'</option>';}).join('')+'</select>';else control='<input type="'+(spec.type==='range'?'range':'number')+'" min="'+spec.min+'" max="'+spec.max+'" step="'+(spec.step||'any')+'" value="'+esc(shown)+'" data-prop="'+spec.key+'">';return '<label class="parameter-field"><span>'+esc(spec.label)+(spec.unit?' <small>'+esc(spec.unit)+'</small>':'')+(spec.type==='range'?'<output data-output="'+spec.key+'">'+esc(shown)+'</output>':'')+'</span>'+control+'</label>';}).join('');
 const potMeter=p.type==='pot'?'<div class="measure"><small>滑动端 OUT 对板上 GND</small><strong data-net-voltage="'+esc(p.id+':OUT')+'">'+pinVoltage(p.id+':OUT')+'</strong></div>':'';
 const hs55=p.type==='servo'&&p.servoModel==='hs55';
 const fieldsToShow=[['voltage',hs55?'VCC 对 GND':'两端电压','V',2],['currentMa','支路电流','mA',2],['resistance','等效阻值','Ω',0],['rpm','转速','rpm',0],
  ['angle',hs55?'轴臂当前角度（相对中位）':p.type==='encoder'?'旋钮角度':'舵机角度','°',1],['targetAngle','目标角度（相对中位）','°',1],['pulseUs','SIG 脉宽','µs',0],['frequencyHz','SIG 频率','Hz',1]];
 const metrics=potMeter+fieldsToShow.filter(([key])=>data[key]!==undefined&&(!potMeter||key!=='voltage')).map(([key,label,unit,digits])=>{
  const relative=hs55&&(key==='angle'||key==='targetAngle');
  return '<div class="measure"><small>'+label+'</small><strong data-metric="'+key+'" data-unit="'+unit+'" data-digits="'+digits+'"'+(relative?' data-servo-relative=""':'')+'>'+partMetricText(data[key],digits,unit,relative)+'</strong></div>';
 }).join('');
 const kingbrightPins=rgbLedVisual.pins.map(({id})=>id);
 const pinLabels=p.type==='sevenseg'?new Map(partMountPins(p.type).map(({id,number})=>[id,`${number} · ${id}`]))
  :kingbrightRgb?new Map(kingbrightPins.map((id,index)=>[id,`${index+1} · ${id}`])):null;
 const connections=partConnections(circuit,p.id,kingbrightRgb?kingbrightPins:model.pins||[]).map(connection=>({...connection,label:pinLabels?.get(connection.pin)??connection.pin}));
 $('#inspectorBody').innerHTML='<div class="part-inspector-heading"><span class="moment-tag">'+esc(p.id)+' / '+esc(model.tag)+'</span><h3 class="moment-title">'+esc(scenePartName(p))+'</h3><p class="moment-copy">'+esc(model.description)+'</p></div>'+(metrics?'<div class="part-readouts" aria-label="仿真测量值">'+metrics+'</div>':'')+'<div class="part-fields">'+fields+'</div><p id="partValidationMessage" class="parameter-error" role="alert" hidden></p>'+(p.type==='button'?'<div class="button-contact-control"><button class="button primary" id="holdButton">按住测试按钮</button><output id="buttonContactState" aria-live="polite">'+buttonContactText(p)+'</output></div>':'')+'<details class="details pin-connections"><summary>引脚与接线 · '+connections.filter(x=>x.links.length).length+' / '+connections.length+' 已连接</summary><table><thead><tr><th>引脚</th><th>连接到</th><th>电压</th></tr></thead><tbody>'+connections.map(c=>'<tr><td><code>'+esc(c.label)+'</code></td><td>'+(c.links.length?c.links.map(x=>'<button class="text-button" data-inspect-endpoint="'+esc(x)+'">'+esc(x)+'</button>').join(' '):'<span class="unconnected">未接线</span>')+'</td><td><span data-net-voltage="'+esc(c.endpoint)+'">'+pinVoltage(c.endpoint)+'</span></td></tr>').join('')+'</tbody></table></details><details class="details"><summary>模型原理与适用范围</summary><p>'+esc(model.model)+'</p></details><button class="text-button remove-part" id="removePartButton" '+(p.locked?'disabled':'')+'>'+(p.locked?'已锁定，先解锁':'删除此元件')+'</button>';
 if(p.type==='encoder'){
  $('#partValidationMessage').insertAdjacentHTML('afterend',encoderControlsMarkup(p.id));
  renderEncoderControls($('#inspectorBody [data-encoder-controls]'));
 }
 if(p.type==='joystick'){
  $('#partValidationMessage').insertAdjacentHTML('afterend',joystickControlsMarkup(p.id));
  renderJoystickControls($('#inspectorBody [data-joystick-controls]'));
 }
 if(p.type==='dipswitch'){
  $('#partValidationMessage').insertAdjacentHTML('afterend',dipSwitchControlsMarkup(p.id));
  renderDipSwitchControls($('#inspectorBody [data-dip-controls]'));
 }
 if(p.type==='ldr'&&p.ldrModel==='pdv-p8103'){
  $('#partValidationMessage').insertAdjacentHTML('afterend',photoresistorControlsMarkup(p.id));
  renderPhotoresistorControls($('#inspectorBody [data-photoresistor-controls]'));
 }
 if(kingbrightRgb){
  const note=document.createElement('p');note.className='moment-copy';
  note.textContent='从底边平口一侧开始，依次是红、公共阴极、蓝、绿。COM 是最长脚，每种颜色各串一只限流电阻。';
  $('#inspectorBody .part-inspector-heading').append(note);
 }
 $$('[data-prop]').forEach(input=>{const spec=specs.find(x=>x.key===input.dataset.prop);let rangeHistory=false;input.addEventListener(input.type==='range'?'input':'change',()=>{const parsed=parseParameter(spec,input.type==='checkbox'?input.checked:input.value),message=$('#partValidationMessage');if(!parsed.ok){message.hidden=false;message.textContent=parsed.error;input.setAttribute('aria-invalid','true');return;}message.hidden=true;input.removeAttribute('aria-invalid');if(p[spec.key]===parsed.value)return;if(spec.key==='lux'&&p.ldrModel==='pdv-p8103'){adjustPhotoresistor(p.id,{lux:parsed.value});return;}if(p.type==='button'&&spec.key==='pressed'){actuateButton(p,parsed.value);return;}if(input.type!=='range'||!rangeHistory){pushUndo();rangeHistory=true;}p[spec.key]=parsed.value;if(p.type==='button'&&spec.key==='bounce'){settleButtonContact(p);avrCircuitIO.invalidateAnalog();}const output=$('#inspectorBody [data-output="'+spec.key+'"]');if(output)output.textContent=String(input.value);if(input.type!=='range')workbench?.setCircuit(circuit);refresh(false);save();});if(input.type==='range'){input.addEventListener('change',()=>{rangeHistory=false;workbench?.setCircuit(circuit);});input.addEventListener('blur',()=>rangeHistory=false);}});
 $('#inspectorBody [data-prop="motorModel"]')?.addEventListener('change',event=>{
  if(event.currentTarget.hasAttribute('aria-invalid'))return;
  renderPartInspector();
  $('#inspectorBody [data-prop="motorModel"]')?.focus({preventScroll:true});
 });
 $$('[data-inspect-endpoint]').forEach(b=>b.onclick=()=>{const endpoint=b.dataset.inspectEndpoint;const contact=mountedPartContacts(p).find(({b})=>b===endpoint);if(contact)return locateScenePin(contact.a);selectScenePart(endpoint.startsWith('bb:')?'breadboard':endpoint.split(':')[0]);locateScenePin(endpoint);});
 $('#removePartButton').onclick=()=>removeSceneParts([p.id]);
 if(p.type==='pot'){
  const hint=document.createElement('p');hint.className='moment-copy';
  hint.textContent='在「选择」模式按住旋钮顶端左右拖动。也可用下方滑块微调，选中滑块后按方向键。';
  $('#inspectorBody .part-inspector-heading').append(hint);
 }
 if(p.type==='drv8833'){
  const readouts=document.createElement('div');
  readouts.className='part-readouts';readouts.id='bridgeChannelReadings';
  readouts.innerHTML=['A','B'].map(channel=>`<div class="measure"><small>${channel} 通道</small><strong data-bridge-channel="${channel}">—</strong></div>`).join('');
  $('#inspectorBody .part-inspector-heading').after(readouts);
  renderBridgeChannels(data);
 }
 if(p.type==='led'&&!nativeMode()){
  const observe=document.createElement('button');
  observe.type='button';observe.className='button primary-light part-observe-led';
  observe.setAttribute('aria-controls','sourceHardwareTrace');
  observe.textContent='跟踪此 LED 电流';
  observe.addEventListener('click',()=>observeSourceLed(p.id));
  $('#inspectorBody .part-inspector-heading').after(observe);
 }
 if($('#holdButton')){const hold=$('#holdButton');hold.onpointerdown=e=>{e.preventDefault();actuateButton(p,true);e.target.setPointerCapture(e.pointerId);};const release=()=>actuateButton(p,false);hold.onpointerup=release;hold.onpointercancel=release;hold.onlostpointercapture=release;hold.onblur=release;hold.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)actuateButton(p,true);}};hold.onkeyup=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();release();}};}
}
function renderBridgeChannels(data){
 for(const node of $$('#bridgeChannelReadings [data-bridge-channel]')){
  const channel=data?.channels?.[node.dataset.bridgeChannel];
  const input=channel?.inputs?.map(value=>value??'—').join(' / ');
  const mode=data?.sleeping?'sleep':channel?.reason??data?.reason??channel?.mode;
  const label=channel?`${input} · ${motorModeLabel(mode)} · ${fmt(channel.voltage)} V`:'—';
  if(node.textContent!==label)node.textContent=label;
 }
}
function adjustPotentiometer(id,phase,value){
 if(phase==='start'){
  const part=circuit.components.find(item=>item.id===id&&item.type==='pot'&&!item.hidden);
  if(!part||potAdjustment)return false;
  potAdjustment={part,initial:part.position};
  return true;
 }
 const gesture=potAdjustment;
 if(!gesture||gesture.part.id!==id)return false;
 const {part,initial}=gesture;
 if(!circuit.components.includes(part)){
  potAdjustment=null;
  return false;
 }
 if(phase==='commit'){
  if((part.position??.5)!==(initial??.5)){
   pushUndo();potAdjustment=null;save();
  }else{
   if(initial===undefined)delete part.position;
   potAdjustment=null;
  }
  return true;
 }
 if(phase==='cancel'){
  if(initial===undefined)delete part.position;
  else part.position=initial;
  potAdjustment=null;
 }else if(phase==='move'&&Number.isFinite(value)&&value>=0&&value<=1){
  if((part.position??.5)===value)return true;
  part.position=value;
 }else return false;
 const percent=Math.round((part.position??.5)*100);
 if(selected===id){
  const slider=$('#inspectorBody [data-prop="position"]'),output=$('#inspectorBody [data-output="position"]');
  if(slider)slider.value=String(percent);
  if(output)output.textContent=String(percent);
 }
 avrCircuitIO.invalidateAnalog();
 refresh(false);
 return true;
}
function setMode(m){
 setSceneCameraMode('edit');
 cancelProbePicking();clearBoardHolePicker();clearPartPlacement();mode=m;selectedPin=null;
 workbench?.setMode(m);$('#cancelWireButton').hidden=true;
 $$('[data-mode]').forEach(b=>{const active=b.dataset.mode===m;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 syncBoardPlacement();renderSceneObjects();
 $('#connectionHint').textContent=m==='wire'?'点击两端或拖拽接线 · Esc 取消':m==='move'?'拖动元件 · 方向键微移 · R 旋转':'拖动元件摆放 · 双击起点引脚后点击终点 · 滚轮缩放';
}
$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('#topViewButton').onclick=()=>workbench?.top();$('#homeViewButton').onclick=()=>workbench?.home();document.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelProbePicking();selectedPin=null;if(mode==='wire')$('#connectionHint').textContent='依次点击两个金属引脚 · Esc 取消';}});
function wireSocketIssue(endpoint, ignoreWireId) {
  return endpoint?.startsWith('bb:') ? createBreadboardWiring(circuit,board()).check(endpoint,{ignoreWireId}).message : '';
}
function connect(a,b,color='#df7651'){
  const issue=a===b ? '请选择两个不同端点。' : wireSocketIssue(a)||wireSocketIssue(b);
  if (issue) return toast(issue);
  if (circuit.wires.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a))) return toast('这两个端点已经有导线连接。');
  if (circuit.wires.length>=400) return toast('当前工程最多连接 400 根导线。');
  pushUndo();
  circuit.wires.push({id:'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),a,b,color});
  finishSceneEdit();
  toast(a+' → '+b);
  return true;
}
const holeLabel = endpoint => endpoint.slice(3).toUpperCase();
function groundedPinMeasurement(endpoint, measurement=result) {
  return measurement?.measureBetween?.(endpoint,'mcu:GND') ?? {status:'unavailable',voltage:null};
}
function pinVoltage(endpoint) {
  const {status,voltage}=groundedPinMeasurement(endpoint);
  if(status==='measured')return fmt(voltage)+' V';
  return status==='floating'?'悬空 · 无有效读数':'暂无有效读数';
}
function uncertainD13Level(pin,voltage){
 const profile=board();
 return pin==='D13'&&profile.mcu==='ATmega328P'&&voltage>profile.logicVoltage*.3&&voltage<profile.logicHighThreshold;
}
function probeMeterSnapshot(){
 const {red,black}=probeEndpoints;
 return {open:probeOpen,picking:probePick,red,black,...probeMeterReading(probeOpen,red,black,result)};
}
function renderProbeMeter(syncScene=false){
 const panel=$('#probePanel'),toggle=$('#probeToggle');
 if(panel.hidden===probeOpen)panel.hidden=!probeOpen;
 const expanded=String(probeOpen);
 if(toggle.getAttribute('aria-expanded')!==expanded)toggle.setAttribute('aria-expanded',expanded);
 if(!probeOpen){
  if(syncScene){workbench?.setProbes?.({...probeEndpoints});syncSourceProbeTrace();renderSourceScope();renderNativeObservation();}
  return;
 }

 const lookup=voltageProbeLookup(circuit,board());
 const labels={red:lookup(probeEndpoints.red),black:lookup(probeEndpoints.black)};
 let lost=false;
 for(const side of ['red','black']){
  if(probeEndpoints[side]&&!labels[side]){probeEndpoints[side]=null;lost=true;}
 }
 if(lost)probeNotice='有一个测点已被遮住或移除，请重新选点。';
 if(syncScene||lost){workbench?.setProbes?.({...probeEndpoints});syncSourceProbeTrace();renderSourceScope();renderNativeObservation();}
 const meter=probeMeterSnapshot();
 if(panel.dataset.status!==meter.status)panel.dataset.status=meter.status;
 if(panel.dataset.picking!==(probePick||''))panel.dataset.picking=probePick||'';
 for(const [id,side] of [['probeRed','red'],['probeBlack','black']]){
  const button=$('#'+id),pressed=String(probePick===side);
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
 }
 $('#probeSwap').disabled=!meter.red||!meter.black;
 $('#probeClear').disabled=!meter.red&&!meter.black&&!probePick;
 const scope=$('#probeScopeButton');
 scope.hidden=nativeMode();scope.disabled=scope.hidden||!meter.red||!meter.black;
 const reading=meter.status==='measured'?fmt(Math.abs(meter.voltage)<.005?0:meter.voltage)+' V':'— V';
 const hints={incomplete:'请选择红、黑两支表笔的测点。',unavailable:'当前电路无法可靠求解或测点无读数，请检查诊断。',
  floating:'两个测点没有共同参考，无法确定电压差。请在同一电路或共地节点测量。',measured:'读数为红表笔减黑表笔，取当前仿真采样。'};
 const hint=probeNotice||(probePick?`${probePick==='red'?'红':'黑'}表笔已就绪。点击端点，或按 P、方向键选点，再按 Enter。`:hints[meter.status]);
 for(const [id,value] of [['probeRedPoint','红表笔 · '+(labels.red||'选点')],['probeBlackPoint','黑表笔 · '+(labels.black||'选点')],['probeValue',reading],['probeHint',hint]]){
  const element=$('#'+id);
  if(element.textContent!==value)element.textContent=value;
 }
}
function cancelProbePicking(){
 if(!probePick)return;
 probePick=null;probeNotice='';renderProbeMeter(true);
}
function clearVoltageProbes({close=false}={}){
 if(close&&!probeOpen)return;
 if(close)probeOpen=false;
 probePick=null;probeNotice='';probeEndpoints.red=null;probeEndpoints.black=null;
 renderProbeMeter(true);
}
function armProbe(side){
 if(!probeOpen)return;
 if(!workbench){probeNotice='实验台暂时无法选点。';renderProbeMeter();return;}
 setSceneCameraMode('edit');
 clearBoardHolePicker();
 clearPartPlacement();
 if(mode==='wire')setMode('orbit');else cancelPendingConnection();
 probePick=side;probeNotice='';renderProbeMeter(true);
 $('#scene [role="application"]')?.focus({preventScroll:true});
}
function assignProbeEndpoint(endpoint){
 if(!probeOpen||!probePick)return false;
 if(!voltageProbeLookup(circuit,board())(endpoint)){
  probeNotice='这个测点不可用，请选择可见的排针、元件引脚或面包板孔。';renderProbeMeter();return false;
 }
 const side=probePick;
 probeEndpoints[side]=endpoint;
 probePick=side==='red'&&!probeEndpoints.black?'black':null;
 probeNotice='';renderProbeMeter(true);
 return true;
}
$('#probeToggle').onclick=()=>{
 if(probeOpen)return clearVoltageProbes({close:true});
 probeOpen=true;renderProbeMeter(true);
};
$('#probeRed').onclick=()=>armProbe('red');
$('#probeBlack').onclick=()=>armProbe('black');
$('#probeSwap').onclick=()=>{
 if(!probeEndpoints.red||!probeEndpoints.black)return;
 [probeEndpoints.red,probeEndpoints.black]=[probeEndpoints.black,probeEndpoints.red];
 probePick=null;probeNotice='';renderProbeMeter(true);
};
$('#probeClear').onclick=()=>{clearVoltageProbes();$('#probeRed').focus({preventScroll:true});};
$('#probeScopeButton').onclick=()=>{if(probeOpen&&probeEndpoints.red&&probeEndpoints.black)openSourceScope('probes');};
function renderPinMeasurement() {
  const active = inspectedPin?.circuit===circuit ? inspectedPin : null;
  const readout = $('#pinReadout');
  if (readout.hidden===Boolean(active)) readout.hidden = !active;
  if (active) {
    const socket=active.socket;
    for (const [id,value] of [['pinReadoutName',active.name],['pinReadoutVoltage',pinVoltage(active.endpoint)],['pinReadoutRoute',active.detail],['pinSocketStatus',socket?.message||'']]) {
      const element = $('#'+id);
      if (element.textContent!==value) element.textContent=value;
    }
    const wireButton=$('#startPinWire');
    const substitute=socket&&!socket.ok ? socket.alternatives[0]||socket.headerEndpoint : null;
    const wireEndpoint=socket&&!socket.ok ? substitute : active.endpoint;
    wireButton.hidden=!$('#cancelWireButton').hidden || !wireEndpoint;
    wireButton.dataset.wireEndpoint=wireEndpoint||'';
    const label=!substitute ? '从这里接线' : substitute.startsWith('bb:') ? `从 ${holeLabel(substitute)} 接线` : `从 ${substitute.slice(4)} 排针接线`;
    if (wireButton.textContent!==label) wireButton.textContent=label;
  }
  if ($('#modal').open) for (const element of $$('[data-mounted-voltage]')) {
    const value=pinVoltage(element.dataset.mountedVoltage);
    if (element.textContent!==value) element.textContent=value;
  }
}
function inspectScenePin(endpoint) {
  const profile = board();
  const route = mountedPinRoutes(circuit,profile).find(item => item.endpoint===endpoint || item.socket===endpoint || item.exposed.includes(endpoint));
  const mcuEndpoint = route?.endpoint || (endpoint.startsWith('mcu:') ? endpoint : null);
  const mcuPin = mcuEndpoint && profile.pins.find(pin => pin.id===mcuEndpoint.slice(4));
  const pin = mcuEndpoint && canonicalPin(mcuEndpoint,profile.id);
  const [partId,terminal]=endpoint.split(':');
  const display=circuit.components.find(part=>part.id===partId&&part.type==='sevenseg');
  const displayPin=display && partMountPins('sevenseg').find(pin=>pin.id===terminal);
  const name = endpoint.startsWith('bb:') ? `面包板 ${holeLabel(endpoint)}` : mcuPin?.label ||
    (displayPin?`${partId} · ${displayPin.number} 脚 ${terminal}`:endpoint);
  const strip=signalStrip(endpoint);
  const componentContacts=circuit.components.flatMap(mountedPartContacts).filter(({a,b})=>{
    if(a===endpoint)return true;
    const target=strip && signalStrip(b);
    return target && target.rows===strip.rows && target.column===strip.column;
  });
  const boardDetail = route ? `对应 ${route.pin.label} · 插孔 ${holeLabel(route.socket)}${route.exposed.length ? ' · 同组外露 '+route.exposed.map(holeLabel).join('、') : ' · 同组孔被遮挡，可从排针引线'}` : '';
  const connectorDetail=mcuPin?.location ? `${mcuPin.location} · ${mcuPin.canonical}` : '';
  const detail=[boardDetail,connectorDetail,...componentContacts.map(({a,b})=>`${a} 插在 ${holeLabel(b)}`)].filter(Boolean).join(' · ');
  const socket=endpoint.startsWith('bb:') ? createBreadboardWiring(circuit,profile).check(endpoint) : null;
  inspectedPin = {endpoint,name,detail,socket,circuit};
  if (profile.gpioPins.includes(pin)) {
    wavePin = pin;
    $('#wavePinSelect').value = pin;
    renderMonitor();
  }
  renderPinMeasurement();
}
function locateScenePin(endpoint) {
  if (!workbench?.locatePin(endpoint)) {
    toast('当前视图无法定位这个端点。请检查孔位是否被遮挡。');
    return;
  }
  inspectScenePin(endpoint);
}
$('#clearPinReadout').onclick = () => {inspectedPin=null;renderPinMeasurement();$('#scene [role="application"]')?.focus({preventScroll:true});};
function startWireFrom(endpoint) {
  const issue=wireSocketIssue(endpoint);
  if (issue) return toast(issue);
  setSceneCameraMode('edit');
  cancelProbePicking();
  setObjectPopover(null);
  if (!workbench?.startWireAt(endpoint)) return toast('无法从这个端点接线。请确认它在当前实验台可见。');
  inspectScenePin(endpoint);
}
$('#startPinWire').onclick = ({currentTarget}) => {
  const endpoint=currentTarget.dataset.wireEndpoint;
  if (endpoint && inspectedPin?.circuit===circuit) startWireFrom(endpoint);
};
function showMountedPinMap() {
  const routes = mountedPinRoutes(circuit,board());
  if (!routes.length) return;
  const wiring=createBreadboardWiring(circuit,board());
  const rows = routes.map(route => {
    const {endpoint,pin,socket,exposed}=route;
    const role = pin.kind==='nc'?'空脚 · 板内未连接':pin.kind==='reserved'?'板载保留':'';
    const tokens = [endpoint,pin.label,pin.canonical,pin.location,role,socket,holeLabel(socket),...exposed,...exposed.map(holeLabel)];
    const holeButtons = exposed.map(hole => {
      const state=wiring.check(hole),name=holeLabel(hole);
      if (!state.ok && state.kind!=='wire') return `<span class="mount-hole-occupied" title="${esc(state.message)}">${name} ${state.kind==='obscured'?'被电容遮住':state.kind==='part'?'已插元件':'已占用'}</span>`;
      const suffix=state.kind==='wire' ? ' · 有跳线' : '';
      return `<button type="button" class="button${suffix?' mount-hole-occupied':''}" data-locate-mounted-pin="${esc(hole)}" aria-label="定位 ${name}${suffix}">${name}${suffix}</button>`;
    }).join('');
    const pinName = pin.id!==pin.label ? pin.id : pin.canonical!==pin.label ? pin.canonical : '';
    const secondary = [pinName,pin.location].filter(Boolean).join(' · ');
    const action = role ? `<span class="mount-hole-occupied">${role}</span>`
      : `<button type="button" class="button mount-route-wire" data-wire-from-header="${esc(endpoint)}" aria-label="从排针接线 ${esc(pin.id)}">从排针接线</button>`;
    return `<li data-mounted-route="${esc(tokens.join(' ').toLowerCase())}"><div class="mount-pin-identity"><button type="button" class="text-button" data-locate-mounted-pin="${esc(endpoint)}" aria-label="定位开发板 ${esc(pin.id)}">${esc(pin.label)}</button>${secondary ? `<small>${esc(secondary)}</small>` : ''}</div><span>插孔 <code>${holeLabel(socket)}</code></span><output aria-live="off" data-mounted-voltage="${esc(endpoint)}">${pinVoltage(endpoint)}</output><div class="mount-pin-holes">${holeButtons || '<span>同组孔被板身遮挡</span>'}${action}</div></li>`;
  }).join('');
  modal('插装引脚',`<p>点针脚名或外露孔可定位。点「从排针接线」选好起点，再点实验台上的终点。</p><label class="mount-map-search">搜索针脚或孔号<input type="search" id="mountPinSearch" placeholder="例如 PA0、GPIO32、A21" autocomplete="off" autofocus></label><p id="mountMapCount" role="status"></p><ul class="mount-pin-map" aria-label="排针、插孔、测量值和同组外露孔">${rows}</ul>`);
  const input = $('#mountPinSearch');
  const filter = () => {
    const terms = input.value.trim().toLowerCase().split(/\s+/);
    let visible = 0;
    for (const row of $$('[data-mounted-route]')) {
      row.hidden = !terms.every(term => row.dataset.mountedRoute.includes(term));
      if (!row.hidden) visible++;
    }
    $('#mountMapCount').textContent=visible ? `${visible} 个排针` : '没有匹配的排针或孔位。';
  };
  input.oninput=filter;
  filter();
  for (const button of $$('[data-locate-mounted-pin]')) button.onclick=()=>{
    $('#modal').close();
    locateScenePin(button.dataset.locateMountedPin);
  };
  for (const button of $$('[data-wire-from-header]')) button.onclick=()=>{
    $('#modal').close();
    startWireFrom(button.dataset.wireFromHeader);
  };
}
$('#mountPinMapButton').onclick=showMountedPinMap;
function allEndpoints() {
  const profile=board(),wiring=createBreadboardWiring(circuit,profile);
  const pins=profile.pins.map(pin=>'mcu:'+pin.id);
  for(const part of circuit.components) for(const pin of PARTS[part.type].pins) pins.push(part.id+':'+pin);
  for(const row of 'abcdefghij') for(let col=1;col<=30;col++) {
    const hole=signalHole(row,col);
    if(wiring.check(hole.endpoint).ok) pins.push(hole.endpoint);
  }
  for(const row of 'pn') for(let col=1;col<=50;col++) {
    const endpoint='bb:'+row+col;
    if(wiring.check(endpoint).ok) pins.push(endpoint);
  }
  return pins;
}
function showConnections() {
  const options=allEndpoints().map(endpoint=>`<option>${esc(endpoint)}</option>`).join('');
  const contacts=mountedConnections(circuit,board());
  const direct=contacts.length ? `<button type="button" class="button" id="wireOpenPinMap">查看 ${contacts.length} 个插装排针与外露孔</button>` : '';
  const inserted=circuit.components.filter(part=>part.mount);
  const partLinks=inserted.length ? `<details class="details" open><summary>元件插装 · ${inserted.length} 个</summary><ul>${inserted.map(part=>`<li>${esc(scenePartName(part))} <code>${esc(part.id)}</code> · ${mountedPartContacts(part).map(({a,b})=>`<button class="text-button" data-locate-part-contact="${esc(a)}">${esc(a.split(':')[1])} → ${holeLabel(b)}</button>`).join(' ')}</li>`).join('')}</ul></details>` : '';
  const wires=circuit.wires.map(w=>`<div class="wire-row"><i class="wire-color" style="background:${esc(w.color||'#df7651')}"></i><span>${esc(w.a)} → ${esc(w.b)}</span><button class="text-button" data-delete-wire="${esc(w.id)}">删除</button></div>`).join('');
  modal('接线表',`<p>面包板同列 A–E、F–J 各自相通。每条电源轨分两段。下拉菜单列出可接线的孔位。</p>${direct}${partLinks}<h3>跳线</h3><div class="wire-form"><select id="wireA" aria-label="导线起点">${options}</select><span>→</span><select id="wireB" aria-label="导线终点">${options}</select><input type="color" id="wireColor" value="#df7651" aria-label="导线颜色"><button class="button primary" id="addWireButton">连接</button></div><div id="wireList">${wires}</div><h3>添加元件</h3><div class="project-actions">${Object.keys(PARTS).map(type=>`<button class="button" data-modal-add="${type}">${esc(PARTS[type].name)}</button>`).join('')}</div>`);
  $('#addWireButton').onclick=()=>{if(connect($('#wireA').value,$('#wireB').value,$('#wireColor').value))showConnections();};
  if ($('#wireOpenPinMap')) $('#wireOpenPinMap').onclick=showMountedPinMap;
  for(const button of $$('[data-locate-part-contact]'))button.onclick=()=>{$('#modal').close();locateScenePin(button.dataset.locatePartContact);};
  $$('[data-delete-wire]').forEach(button=>button.onclick=()=>{deleteWire(button.dataset.deleteWire);showConnections();});
  $$('[data-modal-add]').forEach(button=>button.onclick=()=>{addPart(button.dataset.modalAdd);showConnections();});
}
$('#netButton').onclick=showConnections;$('#clearWiresButton').onclick=()=>{if(circuit.wires.length){pushUndo();circuit.wires=[];selectedWire=null;finishSceneEdit();toast('手动跳线已清空，可撤销。');}};
function injectFault(kind){
 const next=planFault(kind,circuit,compilerFiles());
 $('#modal').close();
 if(!next.circuit&&!next.files)return toast(next.message);
 pause();pushUndo({includeCode:!!next.files});
 if(next.circuit){
  circuit=next.circuit;
  if(!circuit.wires.some(wire=>wire.id===selectedWire))selectedWire=null;
  selectedPin=null;
  $('#powerSwitch').checked=circuit.powered;
  $('#cancelWireButton').hidden=true;
  workbench?.cancelInteraction();
  workbench?.setCircuit(circuit);
  sim.reset();
 }
 if(next.files){
  files={...files,...next.files};activeFile=next.activeFile;
  renderFiles();loadEditor();sourceDraftChanged();
 }
 refresh();renderInspector();save();updateUndoButtons();
 toast(next.message+' 可用撤销恢复。');
}
$('#faultInjectButton').onclick=()=>{modal('故障练习 · 先预测现象，再查看诊断','<p>这是对当前工程的实际修改。你可以亲手修复，也可以点击下方“恢复当前实验的默认设置”。</p><div class="fault-injections">'+[['reverse','交换 LED 极性','交换 A 与 K 的导线，再次操作可恢复'],['open','拔掉一根回路线','让 LED 支路断开'],['resistor','把电阻改为 1Ω','观察限流不足与电流'],['clock','漏开 GPIO 时钟','关闭 SPL GPIO 时钟，保留同一调用里的其他外设时钟'],['power','开发板断电','检查供电开关'],['short','电源正负直接相连','观察短路诊断，仅限虚拟练习']].map(([id,title,sub])=>'<button data-inject="'+id+'"><strong>'+title+'</strong><small>'+sub+'</small></button>').join('')+'</div><button class="button" id="restoreExample" style="margin-top:18px">恢复当前实验的默认设置</button>');$$('[data-inject]').forEach(b=>b.onclick=()=>injectFault(b.dataset.inject));$('#restoreExample').onclick=()=>{$('#modal').close();if(isImportedExample(example.id)){undoCircuit();return;}const before=circuitSnapshot(true);loadExample(example.id,true);undoStack=[before];updateUndoButtons();toast('已恢复实验初始代码与接线；可用撤销找回刚才的修改。');};if(isImportedExample(example.id))$('#restoreExample').textContent='撤销最近一步修改';};
syncBoardUI();$('#wavePinSelect').onchange=e=>{wavePin=e.target.value;renderMonitor();};
$$('[data-monitor]').forEach(button=>{
 button.onclick=()=>{
  $$('[data-monitor]').forEach(tab=>tab.classList.toggle('active',tab===button));
  $$('.monitor-content').forEach(panel=>panel.classList.toggle('active',panel.id==='monitor-'+button.dataset.monitor));
  renderMonitor();
  const tabs=button.parentElement,strip=tabs.getBoundingClientRect(),bounds=button.getBoundingClientRect();
  if(bounds.left<strip.left)tabs.scrollLeft+=bounds.left-strip.left;
  else if(bounds.right>strip.right)tabs.scrollLeft+=bounds.right-strip.right;
 };
});
function getIssues(){
 const issues=[...(lastState.diagnostics||[])];
 const packet=lastState.events?.findLast(event=>event.type==='i2c');
 if(packet?.status||['unsupported-command','unsupported-configuration'].includes(packet?.reason))issues.push({code:'I2C_TRANSFER',
  severity:packet.status?'warning':'info',title:packet.status?`最近一次 I²C ${packet.direction==='read'?'读取':'写入'}失败`:'I²C 命令支持范围',
  plain:`${i2cHex(packet.address)} · ${i2cStatus(packet)}`,fix:i2cReason(packet)||'核对器件地址、返回状态和实际接线。',
  file:packet.file,line:packet.line,part:packet.deviceId??circuit.components.find(item=>isI2cPart(item)&&item.address===packet.address)?.id});
 const runtimeIssues=issues.map(issue=>sourcePending&&issue.file&&appliedSource?.[issue.file]!==files[issue.file]
  ? {...issue,file:undefined,line:undefined} : issue);
 return collectDiagnostics({circuit:result?.issues||[],runtime:runtimeIssues,live:liveDiagnostics,errors});
}
let diagnosticsRenderKey='';
function focusDiagnosticPart(id){if(!id)return;setMobilePane('scene');selectScenePart(id);}
function renderDiagnostics(){
 const issues=getIssues(),severe=issues.filter(d=>d.severity!=='info'),key=JSON.stringify([compiled,issues]);$('#diagnosticCount').textContent=severe.length;
 if(key!==diagnosticsRenderKey||!$('#diagnosticsList').children.length){diagnosticsRenderKey=key;$('#diagnosticsList').innerHTML=issues.length?issues.map((d,i)=>'<article class="issue '+esc(d.severity)+'"><div class="issue-heading"><span class="issue-severity">'+({error:'需要修正',warning:'需要留意',info:'模型说明'}[d.severity]||'提示')+'</span><span>'+esc(d.origin)+(d.part?' · '+esc(d.part):'')+'</span></div><strong>'+esc(d.title)+'</strong><p>'+esc(d.plain)+'</p><div class="issue-fix"><b>下一步</b><p>'+esc(d.fix)+'</p></div><div class="issue-actions">'+(d.file&&files[d.file]!==undefined?'<button class="text-button" data-diagnostic-code="'+i+'">定位 '+esc(d.file)+(d.line?' : '+d.line:'')+' →</button>':'')+(d.part&&(['mcu','breadboard'].includes(d.part)||circuit.components.some(p=>p.id===d.part))?'<button class="text-button" data-diagnostic-part="'+esc(d.part)+'">查看元件 →</button>':'')+'<button class="text-button" data-diagnostic-guide>排查手册</button></div></article>').join(''):'<div class="diagnostic-empty"><span aria-hidden="true">✓</span><strong>当前已检查项未发现异常</strong><p>'+(!compiled?'点击运行，让代码和电路一起参与检查。':'可以继续单步运行，核对电平、波形与预期现象。')+'</p><small>检查覆盖当前模型支持的故障；实物仍需测量验证。</small></div>';$$('[data-diagnostic-code]').forEach(b=>b.onclick=()=>{const d=issues[Number(b.dataset.diagnosticCode)];setMobilePane('editor');jumpLine(d.file,d.line||1);});$$('[data-diagnostic-part]').forEach(b=>b.onclick=()=>focusDiagnosticPart(b.dataset.diagnosticPart));$$('[data-diagnostic-guide]').forEach(b=>b.onclick=()=>go('faults'));}
 $('#diagnosticsPreview').className='diagnostics-preview '+(severe.length?'bad':'good');$('#diagnosticsPreview').innerHTML=(severe.length?'△ '+severe.length+' 项需要检查':compiled?'✓ 当前已检查项无异常':'○ 运行后检查代码与电路')+'<button class="text-button" id="showDiagnostics" style="margin-left:auto">查看诊断 →</button>';$('#showDiagnostics').onclick=()=>{$('.monitor-panel').classList.remove('collapsed');$('[data-monitor="diagnostics"]').click();setMobilePane('editor');};
}
function drawWave(){
 const canvas=$('#waveCanvas'),{width:w,height:h}=canvas.getBoundingClientRect();
 if(w<10||h<10)return;
 const dpr=Math.min(2,devicePixelRatio||1),rail=board().logicVoltage;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext('2d');
 ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);ctx.strokeStyle='#e7eee3';ctx.lineWidth=1;
 for(let i=0;i<6;i++){
  const y=18+i*(h-36)/5;
  ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(w-12,y);ctx.stroke();
 }
 for(let i=0;i<9;i++){
  const x=30+i*(w-42)/8;
  ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,h-18);ctx.stroke();
 }
 ctx.fillStyle='#627d53';ctx.font='10px ui-monospace, monospace';
 ctx.fillText(String(rail),3,22);ctx.fillText('0',11,h-19);
 const pwm=lastState.pins?.[wavePin]?.pwm;
 ctx.strokeStyle='#438f62';ctx.lineWidth=1.7;ctx.beginPath();
 if(pwm){
  const duty=Math.max(0,Math.min(1,pwm.duty||0)),period=(w-45)/5;
  if(duty===0||duty===1){
   const y=duty===1?22:h-20;
   ctx.moveTo(32,y);ctx.lineTo(32+period*5,y);
  }else{
   const highFirst=pwm.highFirst??!pwm.activeLow;
   const firstY=highFirst?22:h-20,secondY=highFirst?h-20:22;
   const edge=period*(highFirst?duty:1-duty);
   ctx.moveTo(32,firstY);
   for(let i=0;i<5;i++){
    const x=32+i*period;
    ctx.lineTo(x,firstY);ctx.lineTo(x+edge,firstY);ctx.lineTo(x+edge,secondY);ctx.lineTo(x+period,secondY);
   }
  }
  ctx.stroke();ctx.fillStyle='#638a5e';
  ctx.fillText('理论 PWM · '+fmt(pwm.frequencyHz||pwm.frequency,0)+' Hz · '+fmt(duty*100,1)+'%',36,12);
  return;
 }
 const tMax=Math.max(1,lastState.timeMs||0),tMin=Math.max(0,tMax-5000),endpoint='mcu:'+wavePin;
 const duration=Math.max(1000,tMax-tMin);
 let lastY=null;
 ctx.fillStyle=ctx.strokeStyle;
 for(const sample of history.slice(-160)){
  if(sample.time<tMin)continue;
  const voltage=sample.voltages[endpoint];
  if(!Number.isFinite(voltage)){lastY=null;continue;}
  const x=32+(sample.time-tMin)/duration*(w-45);
  const y=h-20-Math.max(0,Math.min(rail,voltage))/rail*(h-42);
  if(lastY===null){ctx.moveTo(x,y);ctx.fillRect(x-1,y-1,2,2);}
  else{ctx.lineTo(x,lastY);ctx.lineTo(x,y);}
  lastY=y;
 }
 ctx.stroke();ctx.fillStyle='#627d53';
 ctx.fillText(fmt(tMin/1000,1)+'s',32,h-5);ctx.fillText(fmt(tMax/1000,1)+'s',w-45,h-5);
}
function renderPinChips(){
 const container=$('#pinChips');
 const boardInput=board().userButton?.pin;
 const names=Object.entries(lastState.pins||{}).filter(([name,pin])=>name===boardInput||pin.configured||circuit.wires.some(wire=>wire.a==='mcu:'+name||wire.b==='mcu:'+name)).slice(0,14).map(([name])=>name);
 const key=names.join(' ');
 if(container.dataset.pinNames!==key){
  container.dataset.pinNames=key;
  container.innerHTML=names.length?names.map(name=>'<button class="pin-chip" data-watch="'+esc(name)+'"></button>').join(''):'<span class="monitor-footnote">运行后显示已配置的引脚。</span>';
  container.querySelectorAll('[data-watch]').forEach(button=>button.onclick=()=>{
   wavePin=button.dataset.watch;
   $('#wavePinSelect').value=wavePin;
   renderMonitor();
  });
 }
 for(const button of container.querySelectorAll('[data-watch]')){
  const name=button.dataset.watch,{status,voltage}=groundedPinMeasurement('mcu:'+name);
  const analog=/AIN|analog/i.test(lastState.pins?.[name]?.mode??'');
  const high=!analog&&status==='measured'&&voltage>=board().logicHighThreshold;
  const reading=status==='measured'?(analog?fmt(voltage)+' V':uncertainD13Level(name,voltage)?'电平不确定':high?'HIGH':'LOW'):status==='floating'?'悬空':'无有效读数';
  const label=name+' · '+reading;
  if(button.textContent!==label)button.textContent=label;
  button.classList.toggle('high',high);
 }
}
function sourceLightReading(id,name){
 const metrics=result?.parts[id];
 if(id==='onboard'&&!Number.isFinite(metrics?.currentMa))return null;
 return metrics?{id,name,brightness:metrics.displayBrightness,instantaneousBrightness:metrics.brightness,currentMa:metrics.currentMa}:null;
}
function sourceLightLabel(brightness){
 return brightness>.08?'亮':brightness>.001?'微亮':'灭';
}
function sourceServoReading(){
 const servos=circuit.components.filter(part=>part.type==='servo'&&part.servoModel==='hs55'&&!part.hidden);
 const part=servos.find(item=>item.id===selected)??(servos.length===1?servos[0]:null);
 const reading=part&&result?.parts[part.id];
 return reading?{...reading,id:part.id}:null;
}
function sourceRcReading(){
 const capacitors=circuit.components.filter(part=>part.type==='capacitor'&&!part.hidden&&result?.parts[part.id]?.pwmRc);
 const part=capacitors.find(item=>item.id===selected)??(capacitors.length===1?capacitors[0]:null);
 if(!part)return null;
 const measured=result.parts[part.id];
 return {id:part.id,voltage:measured.voltage,...measured.pwmRc};
}
function renderPwmRcFeedback(reading){
 const lesson=!nativeMode()&&example.id==='pwm-rc';
 const panel=$('#pwmRcPanel'),tab=$('[data-monitor="pwm-rc"]');
 panel.hidden=!lesson&&!reading;
 tab.hidden=!reading;
 if(tab.hidden&&tab.classList.contains('active'))$('[data-monitor="pins"]').click();
 renderPwmRcScope($('#pwmRcScope'),reading);
 if(panel.hidden)return;
 const voltage=reading?.voltage??(lesson?result?.parts.c1?.voltage:null);
 const signal=reading?`${reading.pin} · ${fmt(reading.frequencyHz,0)} Hz · ${fmt(reading.duty*100,1)}%`:
  appliedSource?'等待有效 PWM · 检查接线':'运行后观察 PWM 和电容电压';
 for(const [id,text] of [['pwmRcInput',signal],['pwmRcVoltage',Number.isFinite(voltage)?fmt(voltage,3)+' V':'—'],
   ['pwmRcMean',reading?fmt(reading.voltageMean,3)+' V':'—'],['pwmRcRipple',reading?fmt(reading.ripplePp*1000,2)+' mV':'—']]){
  const node=$('#'+id);
  if(node.textContent!==text)node.textContent=text;
 }
 $('#locateRcDuty').hidden=$('#locateRcFrequency').hidden=!lesson;
 $('#openPwmRcScope').hidden=!reading;
}
for(const [id,definition] of [['locateRcDuty','DUTY_PERCENT'],['locateRcFrequency','PWM_HZ']]){
 $('#'+id).onclick=()=>{
  const pattern=new RegExp('^\\s*#\\s*define\\s+'+definition+'\\b');
  const index=(files['main.c']?.split('\n')??[]).findIndex(line=>pattern.test(line));
  if(index<0)return toast('当前 main.c 找不到 '+definition+' 定义。');
  jumpLine('main.c',index+1);
 };
}
$('#openPwmRcScope').onclick=()=>{
 const tab=$('[data-monitor="pwm-rc"]');
 $('.monitor-panel').classList.remove('collapsed');
 tab.click();tab.focus({preventScroll:true});
 $('#monitor-pwm-rc').scrollIntoView({block:'nearest'});
};
function servoDegrees(angle,unit='°'){
 if(!Number.isFinite(angle))return '—';
 const offset=Math.round((angle-90)*10)/10;
 const sign=offset>0?'+':offset<0?'−':'';
 return sign+Math.abs(offset)+unit;
}
function partMetricText(value,digits,unit,relative){
 const number=relative?servoDegrees(value,''):fmt(value,digits);
 return number+(number==='—'?'':'<em>'+esc(unit)+'</em>');
}
const servoSignalStatus={supply:'供电需要 4.8–6.0 V',ground:'请将舵机和控制板共地',signal:'等待有效 PWM 信号',frequency:'此模型接收 45–55 Hz',pulse:'脉宽需在 900–2100 µs',conflict:'请检查信号与供电冲突'};
function renderServoFeedback(servo){
 const panel=$('#servoFeedback');
 panel.hidden=!servo;
 if(!servo)return;
 const {id,angle,targetAngle,pulseUs,frequencyHz,signalPin,reason,moving,active}=servo;
 const signal=[signalPin?.replace(/^mcu:/,''),Number.isFinite(pulseUs)?fmt(pulseUs,0)+' µs':null,
  Number.isFinite(frequencyHz)?fmt(frequencyHz,1)+' Hz':null].filter(Boolean).join(' · ')||'—';
 const status=active?(moving?'轴臂正在转动':'已到目标角度'):servoSignalStatus[reason]??'当前没有控制信号';
 for(const [output,value] of [['servoSignal',signal],['servoTarget',servoDegrees(targetAngle)],['servoAngle',servoDegrees(angle)],['servoFeedbackStatus',status]]){
  const node=$('#'+output);
  if(node.textContent!==value)node.textContent=value;
 }
 const position=value=>Math.max(0,Math.min(100,(value-30)/1.2))+'%';
 const current=$('#servoAngleCurrent'),target=$('#servoAngleTarget');
 current.style.left=position(angle);
 target.hidden=!Number.isFinite(targetAngle);
 if(!target.hidden)target.style.left=position(targetAngle);
 $('#locateServoPart').dataset.part=id;
 $('#locateServoCommand').hidden=example.id!=='servo-hs55';
}
$('#locateServoPart').onclick=event=>{
 const id=event.currentTarget.dataset.part;
 focusDiagnosticPart(id);
 locateScenePin(id+':SIG');
};
$('#locateServoCommand').onclick=()=>locateSourceDefinition('COMMAND_US');
function locateSourceDefinition(name){
 const location=codeLocation(files,new RegExp('^\\s*#\\s*define\\s+'+name+'\\b'));
 if(!location)return toast('当前源码找不到 '+name+' 定义。');
 jumpLine(location.file,location.line);
}
function sourceSegmentReading(){
 const part=circuit.components.find(part=>part.id===selected&&part.type==='sevenseg'&&!part.hidden)
  ??(example.id==='sevenseg-gpio'&&circuit.components.find(part=>part.id==='display1'&&part.type==='sevenseg'&&!part.hidden));
 return part&&sourceTraceResultValid(result)?readSevenSegment(part.id,result.parts[part.id]):null;
}
function renderSevenSegmentFeedback(reading){
 const lesson=example.id==='sevenseg-gpio'&&!nativeMode();
 const panel=$('#sevenSegmentFeedback');
 panel.hidden=!reading&&!lesson;
 if(panel.hidden)return;
 const summary=$('#sevenSegmentState');
 const label=sevenSegmentLabel(reading);
 if(summary.textContent!==label)summary.textContent=label;
 for(const button of $$('#sevenSegmentCurrents button')){
  const name=button.dataset.segment;
  const segment=reading?.segments.find(segment=>segment.name===name);
  const text=segment?fmt(segment.currentMa,2)+' mA':'—';
  const output=button.lastElementChild;
  if(output.textContent!==text)output.textContent=text;
  const unavailable=!segment;
  if(button.disabled!==unavailable)button.disabled=unavailable;
  const lit=String(Boolean(reading?.on.includes(name)));
  if(button.dataset.lit!==lit)button.dataset.lit=lit;
 }
 const part=reading?.id??'';
 if(panel.dataset.part!==part)panel.dataset.part=part;
 $('#focusSevenSegment').disabled=!reading;
 $('#sevenSegmentCode').hidden=!lesson;
}
for(const segment of segmentNames){
 const button=document.createElement('button');
 button.type='button';button.dataset.segment=segment;
 const name=document.createElement('b'), current=document.createElement('span');
 name.textContent=segment==='dp'?'DP':segment;
 current.textContent='—';button.append(name,current);
 button.title=segment==='dp'?'在实验台定位小数点引脚':'在实验台定位 '+segment+' 段引脚';
 button.onclick=()=>{
  const id=$('#sevenSegmentFeedback').dataset.part;
  if(!id)return;
  focusDiagnosticPart(id);
  locateScenePin(id+':'+segment);
 };
 $('#sevenSegmentCurrents').append(button);
}
$('#locateDisplayDigit').onclick=()=>locateSourceDefinition('DISPLAY_DIGIT');
$('#locateDisplayDecimal').onclick=()=>locateSourceDefinition('DECIMAL_POINT');
$('#focusSevenSegment').onclick=()=>{
 const id=$('#sevenSegmentFeedback').dataset.part;
 if(!id)return;
 focusDiagnosticPart(id);
 requestAnimationFrame(()=>workbench?.focusSelection?.());
};
function motorLessonKey(){
 return example.id===motorBridgeLessonId&&!nativeMode()?sourceCircuitKey(circuit,board()):null;
}
function recordMotorStop(state,measurement){
 motorStopTrace.sync(motorLessonKey());
 if(state.executedSteps&&!state.error&&sourceTraceResultValid(measurement))
  motorStopTrace.record(state.timeMs,readMotorBridgeLesson(measurement));
}
function renderMotorLesson(sourceAdvanced){
 const lesson=example.id===motorBridgeLessonId&&!nativeMode();
 const panel=$('#motorBridgePanel'),tab=$('[data-monitor="motor-stop"]');
 panel.hidden=tab.hidden=!lesson;
 if(!lesson){
  if(tab.classList.contains('active'))$('[data-monitor="pins"]').click();
  return;
 }
 if(sourceAdvanced)recordMotorStop(lastState,result);
 else motorStopTrace.sync(motorLessonKey());
 const data=sourceTraceResultValid(result)?readMotorBridgeLesson(result):null;
 const rpm=Number.isFinite(data?.rpm)?Math.round(data.rpm).toLocaleString('zh-CN')+' rpm':'—';
 const input=data?.inputs?.map(level=>level??'—').join(' / ')??'—';
 const fmtReading=(value,unit)=>Number.isFinite(value)?fmt(Math.abs(value)<.005?0:value,2)+' '+unit:'—';
 for(const [id,text] of [['motorBridgeMode',data?motorModeLabel(data.mode):'等待有效读数'],['motorBridgeInputs',input],
   ['motorBridgeRpm',rpm],['motorBridgeCurrent',fmtReading(data?.currentMa,'mA')],['motorBridgeVoltage',fmtReading(data?.voltage,'V')]]){
  const output=$('#'+id);
  if(output.textContent!==text)output.textContent=text;
 }
 $('#focusLessonMotor').disabled=!data;
 const hint=$('#motorBridgeHint');
 const message=data&&!data.paired?'当前电机接法已改动。曲线对照需要按原极性接回 A 通道。':'正转为正值。绕组电流按 + → − 记正。';
 if(hint.textContent!==message)hint.textContent=message;
 if(tab.classList.contains('active'))renderMotorStopTrace($('#motorStopScope'),motorStopTrace.before,motorStopTrace.current);
}
$('#locateMotorBrake').onclick=()=>locateSourceDefinition('BRAKE_AT_STOP');
$('#locateMotorDirection').onclick=()=>locateSourceDefinition('TURN_REVERSE');
$('#replayMotorStop').onclick=()=>{
 if(!canExecute())return;
 pause();
 if(build({motorAtRest:true}))startExecution();
};
$('#focusLessonMotor').onclick=()=>{
 focusDiagnosticPart('motor1');
 requestAnimationFrame(()=>workbench?.focusSelection?.());
};
$('#openMotorStopScope').onclick=()=>{
 const tab=$('[data-monitor="motor-stop"]');
 $('.monitor-panel').classList.remove('collapsed');tab.click();tab.focus({preventScroll:true});
 $('#motorStopScope').scrollIntoView({block:'nearest'});
};
const sonarStatusLabels={unpowered:'需要 5 V 供电',ground:'请接通共同地线',idle:'等待触发','trigger-high':'TRIG 为高电平',
 'trigger-short':'触发脉冲不足 10 µs',cooldown:'触发间隔过短','no-target':'本次未收到回波',emitting:'正在发射',
 'echo-high':'ECHO 为高电平',complete:'最近一次回波已完成',conflict:'请检查回波引脚的接线'};
function ultrasonicPart(){
 const parts=circuit.components.filter(part=>part.type==='hcsr04'&&!part.hidden);
 return parts.find(part=>part.id===selected)??(example.id===ultrasonicLessonId?parts.find(part=>part.id==='sonar1'):null);
}
function setSonarTarget(next,grouped=false){
 const part=ultrasonicPart();
 if(!part||part.locked||Object.entries(next).every(([key,value])=>part[key]===value))return;
 if(!grouped||sonarGesture!==part)pushUndo();
 sonarGesture=grouped?part:null;
 Object.assign(part,next);
 refresh(false);
 save();
}
for(const [id,prop] of [['sonarDistance','distanceCm'],['sonarBearing','bearingDeg']]){
 const input=$('#'+id);
 input.oninput=()=>setSonarTarget({[prop]:Number(input.value)},true);
 input.onchange=input.onpointercancel=input.onblur=()=>{sonarGesture=null;};
}
$('#sonarTargetPresent').onchange=event=>setSonarTarget({targetPresent:event.target.checked});
$('#locateSonarLimit').onclick=()=>locateSourceDefinition('ALARM_CM');
$('#locateSonarTrigger').onclick=()=>locateSourceDefinition('TRIGGER_US');
$('#openSonarTarget').onclick=()=>{
 setMobilePane('scene');
 const panel=$('#ultrasonicTargetPanel');
 panel.open=true;
 requestAnimationFrame(()=>{
  panel.scrollIntoView({block:'nearest'});
  ($('#sonarDistance').disabled?panel.querySelector('summary'):$('#sonarDistance')).focus({preventScroll:true});
 });
};
$('#openSonarTiming').onclick=()=>{
 const tab=$('[data-monitor="ultrasonic"]');
 $('.monitor-panel').classList.remove('collapsed');tab.click();tab.focus({preventScroll:true});
 $('#ultrasonicTimingScope').scrollIntoView({block:'nearest'});
};
function sonarProgramReading(state){
 const events=state.events??[];
 const pulse=events.findLast(event=>event.type==='pulse');
 const {measuredCm,measuredEchoUs}=state.variables??{};
 if(!pulse||!Number.isFinite(measuredCm)||measuredEchoUs!==pulse.widthUs)return null;
 const alarmWrite=events.findLast(event=>event.type==='gpio'&&event.pin==='D12');
 return {widthUs:pulse.widthUs,cm:measuredCm,alarmObserved:Boolean(alarmWrite&&alarmWrite.timeMs>=pulse.toMs)};
}
function renderUltrasonicPanels(){
 const part=ultrasonicPart(),lesson=example.id===ultrasonicLessonId&&!nativeMode();
 const targetPanel=$('#ultrasonicTargetPanel'),panel=$('#ultrasonicSourcePanel'),tab=$('[data-monitor="ultrasonic"]');
 targetPanel.hidden=tab.hidden=!part;
 panel.hidden=!part&&!lesson;
 if(tab.hidden&&tab.classList.contains('active'))$('[data-monitor="pins"]').click();
 if(panel.hidden)return;
 const measurement=part&&result?.parts[part.id];
 if(part){
  updateSonarDiagram(part);
  const distance=$('#sonarDistance'),bearing=$('#sonarBearing'),present=$('#sonarTargetPresent');
  if(distance.value!==String(part.distanceCm))distance.value=part.distanceCm;
  if(bearing.value!==String(part.bearingDeg))bearing.value=part.bearingDeg;
  present.checked=part.targetPresent;
  distance.disabled=bearing.disabled=!!part.locked||!part.targetPresent;
  present.disabled=!!part.locked;
 }
 const measured=lesson?sonarProgramReading(lastState):null;
 const current=result?.parts.led1?.currentMa;
 const targetLabel=part?.targetPresent?`${part.distanceCm} cm · ${part.bearingDeg}°`:'已移开';
 const status=part?(measurement?.status==='no-target'?sonarMissLabels[measurement.missReason]:null)??sonarStatusLabels[measurement?.status]??'等待测量':'传感器已移除';
 const width=lesson?(measured?(measured.widthUs?`${measured.widthUs.toLocaleString('zh-CN')} µs`:'超时 · 0 µs'):'—'):
  Number.isFinite(measurement?.echoWidthUs)?`${Math.round(measurement.echoWidthUs)} µs`:'—';
 const output=[['sonarTargetSummary',part?targetLabel:'—'],['sonarDistanceValue',part?part.distanceCm+' cm':'—'],['sonarBearingValue',part?part.bearingDeg+'°':'—'],
  ['sonarStatus',status],['sonarPulseLabel',lesson?'代码读到的脉宽':'最近回波脉宽'],['sonarPulseWidth',width],
  ['sonarMeasuredDistance',measured?(measured.cm>=0?measured.cm+' cm':'无回波'):'—'],
  ['sonarAlarmState',Number.isFinite(current)?(current>.05?'亮 · '+fmt(current,2)+' mA':'灭'):'—']];
 for(const [id,text] of output){const node=$('#'+id);if(node.textContent!==text)node.textContent=text;}
 for(const id of ['locateSonarLimit','locateSonarTrigger','sonarProgramDistance','sonarProgramAlarm'])$('#'+id).hidden=!lesson;
 $('#openSonarTarget').hidden=$('#openSonarTiming').hidden=!part;
 if(tab.classList.contains('active'))renderUltrasonicTiming($('#ultrasonicTimingScope'),measurement);
}
const renderOledMonitor=mountI2cOledMonitor($('#monitor-oled-i2c'));
const temperatureDisplayRaster=createSsd1306Raster($('#temperatureDisplayCanvas'));
const temperatureComparisonRasters=['#temperatureDisplayBefore','#temperatureDisplayAfter'].map(selector=>createSsd1306Raster($(selector)));
function isI2cPart(part){return part.type==='ssd1306'||part.type==='mcp9808';}
function activeI2cPart(type,lessonId,defaultId){
 const parts=circuit.components.filter(part=>part.type===type&&!part.hidden);
 return parts.find(part=>part.id===selected)??(example.id===lessonId?parts.find(part=>part.id===defaultId):null)??(parts.length===1?parts[0]:null);
}
function oledPart(){return activeI2cPart('ssd1306',example.id===stm32TemperatureDisplayLessonId?stm32TemperatureDisplayLessonId:i2cOledLessonId,'oled1');}
function temperaturePart(){return activeI2cPart('mcp9808',temperatureFirmwareFor(example.id)?example.id:null,'temp1');}
function devicePackets(part,address){
 return recentI2cPackets(lastState?.events,part,address,circuit.components.filter(isI2cPart).length===1);
}
function i2cTimingLabel(packet){
 if(stm32NativeI2c())return Number.isFinite(packet?.sclHz)
  ? `STM32 I²C1 · SCL ${fmt(packet.sclHz/1000,1)} kHz · 按寄存器配置估算时间。`
  : '运行固件后可查看 I²C1 读写与应答。';
 if(example.nativeOnly)return '运行 STM32 原生固件后查看传输。';
 if(!nativeMode())return 'Arduino 源码模式按标称 100 kHz 估算传输时间。';
 if(Number.isFinite(packet?.sclHz))return `AVR TWI · SCL ${fmt(packet.sclHz/1000,1)} kHz · 按字节估算时间。`;
 return avrNativeI2c()?'运行固件后可查看 TWI 字节与应答。':'当前固件内核尚未接入 I²C。';
}
function renderI2cOledPanels(){
 const part=oledPart(),lesson=example.id===i2cOledLessonId&&!nativeMode(),shared=example.id===stm32TemperatureDisplayLessonId;
 const panel=$('#i2cOledPanel'),tab=$('[data-monitor="oled-i2c"]');
 tab.hidden=!part;
 panel.hidden=shared||!part&&!lesson;
 if(tab.hidden&&tab.classList.contains('active')){$('[data-monitor="pins"]').click();return;}
 if(panel.hidden&&!shared)return;
 const address=part?.address??(part?PARTS.ssd1306.defaults.address:null);
 const packets=devicePackets(part,address);
 const packet=packets.at(-1),screen=part&&result?.parts[part.id];
 const count=oledVisiblePixels(screen);
 const status=!part?'屏幕已移除':packet?i2cStatus(packet):'等待程序写入';
 const detail=!part?'从元件商城添加 SSD1306，接好电源与信号线后再运行。':!screen?.powered?'模块未供电。检查 VIN 与 GND。':
  i2cReason(packet)?i2cReason(packet)+(packet.status===2&&count?' 屏幕保留上一帧。':''):
  lesson?'A4 接 SDA，A5 接 SCL。先改变填充宽度，再试错地址或拔掉 SDA。':'';
 if(shared){
  temperatureDisplayRaster.paint(screen);
  const addressOutput=$('#temperatureDisplayOledAddress'),addressText=i2cHex(address);
  if(addressOutput.textContent!==addressText)addressOutput.textContent=addressText;
  const output=$('#temperatureDisplayOledStatus');
  const text=detail?`${status}。${detail}`:`${status} · ${count.toLocaleString('zh-CN')} 个亮像素`;
  if(output.textContent!==text)output.textContent=text;
 }
 for(const [id,value] of [['oledWriteStatus',status],['oledDeviceAddress',i2cHex(address)],['oledPacketAddress',i2cHex(packet?.address)],
  ['oledPixelCount',screen?count.toLocaleString('zh-CN'):'—'],['oledWriteHint',detail],['oledTraceTiming',i2cTimingLabel(packet)],
  ['oledPixelCaption',`128 × 64 · ${screen?.powered?`${count.toLocaleString('zh-CN')} 个像素亮起`:'模块未供电'}`]]){
  const element=$('#'+id);
  if(element.textContent!==value)element.textContent=value;
 }
 panel.dataset.packetStatus=packet?String(packet.status):'';
 for(const id of ['locateOledWidth','locateOledAddress'])$('#'+id).hidden=!lesson;
 $('#openOledMonitor').hidden=$('#openOledAnalyzer').hidden=$('#focusOledPart').hidden=!part;
 if(tab.classList.contains('active'))renderOledMonitor(screen,packets);
}
$('#locateOledWidth').onclick=()=>locateSourceDefinition('BAR_COLUMNS');
$('#locateOledAddress').onclick=()=>locateSourceDefinition('OLED_ADDR');
$('#openOledMonitor').onclick=()=>{
 const tab=$('[data-monitor="oled-i2c"]');
 $('.monitor-panel').classList.remove('collapsed');tab.click();tab.focus({preventScroll:true});
 $('#monitor-oled-i2c').scrollIntoView({block:'nearest'});
};
$('#focusOledPart').onclick=()=>{
 const part=oledPart();
 if(!part)return;
 focusDiagnosticPart(part.id);
 requestAnimationFrame(()=>workbench?.focusSelection?.());
};
const renderTemperatureTrace=mountI2cTrace($('#monitor-temperature-i2c'),{showBytes:true});
const temperatureText=value=>Number.isFinite(value)?`${value.toLocaleString('zh-CN',{maximumFractionDigits:4})} °C`:'—';
let temperatureGesture=null;
function changeAmbientTemperature(value,grouped=false){
 const part=temperaturePart();
 if(!part||part.locked||!Number.isFinite(value)||value< -40||value>125||part.temperatureC===value)return;
 if(!grouped||temperatureGesture!==part)pushUndo();
 temperatureGesture=grouped?part:null;
 part.temperatureC=value;
 const input=$('#inspectorBody [data-prop="temperatureC"]');
 if(selected===part.id&&input&&document.activeElement!==input)input.value=value;
 refresh(false);
 save();
}
const ambientSlider=$('#ambientTemperature');
ambientSlider.oninput=()=>changeAmbientTemperature(Number(ambientSlider.value),true);
ambientSlider.onchange=ambientSlider.onpointercancel=ambientSlider.onblur=()=>{temperatureGesture=null;};
for(const preset of $$('[data-ambient]'))preset.onclick=()=>changeAmbientTemperature(Number(preset.dataset.ambient));
function temperatureProgramReading(state){
 const events=state.events??[],vars=state.variables??{};
 const packet=events.findLast(event=>event.type==='i2c'&&(event.direction==='read'||event.status!==0));
 if(!packet||packet.status||packet.bytes?.length!==2||!vars.temperatureValid||!Number.isFinite(vars.measuredC))return null;
 const word=(packet.bytes[0]<<8)|packet.bytes[1];
 if(vars.temperatureWord!==word)return null;
 const alarm=events.findLast(event=>event.type==='gpio'&&event.pin==='D12');
 return {word,measuredC:vars.measuredC,alarmObserved:Boolean(alarm&&alarm.timeMs>=packet.toMs)};
}
function temperatureBusReading(packets){
 const index=packets.findLastIndex(packet=>packet.direction==='read'||packet.status!==0);
 if(index<1)return null;
 const packet=packets[index],write=packets[index-1];
 if(packet?.direction!=='read'||packet.status||packet.bytes?.length!==2||
    write?.direction!=='write'||write.status||write.address!==packet.address||write.bytes?.length!==1||write.bytes[0]!==5)return null;
 const word=(packet.bytes[0]<<8)|packet.bytes[1],units=word&0x1fff;
 return (units&0x1000?units-0x2000:units)/16;
}
let nativeTemperatureComparison=null;
function temperatureDisplayReports(){
 const lines=(lastState.serial??'').slice(-280).split('\n').slice(0,-1).map(line=>line.trim());
 return {
  sensor:lines.findLast(line=>/^(?:TEMP=-?\d+\.\d{4}|SENSOR_I2C=0x[0-9A-F]{2})$/.test(line)),
  oled:lines.findLast(line=>/^(?:DISPLAY=(?:-?\d+\.\d [CF]|ERR)|OLED_I2C=0x[0-9A-F]{2})$/.test(line))
 };
}
function nativeTemperatureSample(){
 const part=temperaturePart(),kind=loadedFirmware?.name?.replace(/\.hex$/i,'');
 const sample=temperatureFirmwareFor(example.id);
 const variant=sample?.variants.find(([name])=>name===kind);
 if(!nativeMode()||!part||!sample||(!variant&&appliedNativeDraft?.firmware!==loadedFirmware))return null;
 const label=variant?variant[1]+' 固件':'浏览器编译的固件';
 const reading=result?.parts[part.id],temperature=temperatureBusReading(devicePackets(part,reading?.address??part.address));
 if(!Number.isFinite(temperature))return null;
 if(sample===temperatureDisplayFirmware){
  const {sensor,oled}=temperatureDisplayReports(),display=oledPart(),screen=display&&result?.parts[display.id];
  const packet=devicePackets(display,display?.address).at(-1);
  if(!sensor?.startsWith('TEMP=')||Number(sensor.slice(5))!==temperature||!oled?.startsWith('DISPLAY=')||oled==='DISPLAY=ERR'||
     !packet||packet.status||!oledVisiblePixels(screen))return null;
  return {kind,label,temperature,screen,displayText:oled.slice(8)};
 }
 const current=result?.parts.led1?.currentMa;
 const line=(lastState.serial??'').slice(-120).split('\n').at(-2)?.trim();
 if(!Number.isFinite(current)||!line?.startsWith('TEMP=')||Number(line.slice(5))!==temperature)return null;
 return {kind,label,temperature,current};
}
function renderNativeTemperatureComparison(visible){
 const panel=$('#temperatureNativeComparison');
 if(nativeTemperatureComparison&&(!visible||nativeTemperatureComparison.key!==sourceCircuitKey(circuit,board()))){
  nativeTemperatureComparison=null;
 }
 const comparison=nativeTemperatureComparison;
 const displayComparison=Boolean(comparison?.before.screen);
 $('#temperatureDisplayComparison').hidden=!displayComparison;
 panel.hidden=!comparison;
 if(!comparison)return;
 const after=comparison.firmware===loadedFirmware?nativeTemperatureSample():null;
 if(displayComparison){
  const samples=[comparison.before,after];
  const labels=samples.map((sample,index)=>{
   temperatureComparisonRasters[index].paint(sample?.screen);
   return sample?.displayText??'等待 OLED 更新';
  });
  for(const [index,id] of ['temperatureDisplayBeforeLabel','temperatureDisplayAfterLabel'].entries()){
   const label=$('#'+id),text=`${index?'切换后':'切换前'} · ${labels[index]}`;
   if(label.textContent!==text)label.textContent=text;
  }
  const beforeReading=temperatureText(comparison.before.temperature);
  const reading=after&&after.temperature!==comparison.before.temperature?`${beforeReading} → ${temperatureText(after.temperature)}`:beforeReading;
  const text=`总线读数 ${reading} · OLED ${labels.join(' → ')}`;
  if(panel.textContent!==text)panel.textContent=text;
  return;
 }
 const format=({label,temperature,current})=>`${label} · ${temperatureText(temperature)} · ${fmt(current)} mA`;
 const label=`${format(comparison.before)} → ${after?format(after):'等待新固件采样'}`;
 if(panel.textContent!==label)panel.textContent=label;
}
function renderI2cTemperaturePanels(){
 const part=temperaturePart(),firmware=temperatureFirmwareFor(example.id),native=nativeMode(),firmwareLesson=Boolean(example.nativeOnly);
 const lesson=Boolean(firmware),displayLesson=firmware===temperatureDisplayFirmware;
 const panel=$('#i2cTemperaturePanel'),tab=$('[data-monitor="temperature-i2c"]');
 tab.hidden=!part;
 panel.hidden=!part&&!lesson;
 renderNativeTemperatureComparison(Boolean(part&&lesson&&native));
 if(tab.hidden&&tab.classList.contains('active')){$('[data-monitor="pins"]').click();return;}
 if(panel.hidden)return;
 const reading=part&&result?.parts[part.id];
 const packets=devicePackets(part,reading?.address??part?.address);
 const packet=packets.at(-1),temperature=native?temperatureBusReading(packets):lesson?temperatureProgramReading(lastState)?.measuredC:null;
 const current=lesson&&!displayLesson?result?.parts.led1?.currentMa:null;
 const target=part?.temperatureC??25;
 const status=!part?'传感器已移除':packet?i2cStatus(packet):'等待程序读取';
 const hint=!part?'添加 MCP9808 并核对四根接线。':!reading?.powered?'模块未供电。检查 VIN 和 GND。':
  i2cReason(packet)||`模块地址 ${i2cHex(reading.address)}。${Number.isFinite(reading.conversionMs)?`每次转换约 ${reading.conversionMs} ms。`:''}`;
 for(const [id,value] of [['temperatureBusStatus',status],['ambientTemperatureValue',temperatureText(target)],
  ['temperatureSample',temperatureText(reading?.temperatureC)],['temperatureReadbackLabel',native?'总线读回温度':'程序读数'],['temperatureReadback',temperatureText(temperature)],
  ['temperatureAlarm',Number.isFinite(current)?current>.05?`亮 · ${fmt(current)} mA`:'灭':'—'],['temperatureBusHint',hint],
  ['temperatureRegisterWord',i2cHex(reading?.rawTemperature,4)],['temperatureTraceTiming',i2cTimingLabel(packet)],
  ['temperatureRegisterNote',!reading?.powered?'模块未供电。':Number.isFinite(reading.temperatureC)?'高字节在前。解码温度时去掉最高三位状态标志。':'等待首次温度转换。']]){
  const node=$('#'+id);if(node.textContent!==value)node.textContent=value;
 }
 panel.dataset.packetStatus=packet?String(packet.status):'';
 $('#ambientControls').hidden=!part;
 if(ambientSlider.value!==String(target))ambientSlider.value=String(target);
 ambientSlider.disabled=Boolean(part?.locked)||!part;
 for(const preset of $$('[data-ambient]')){
  preset.disabled=ambientSlider.disabled;
  preset.setAttribute('aria-pressed',String(Number(preset.dataset.ambient)===target));
 }
 $('#temperatureProgramReading').hidden=!lesson&&!native;
 $('#temperatureAlarmReading').hidden=!lesson||displayLesson;
 for(const id of ['locateTemperatureThreshold','locateTemperatureAddress'])$('#'+id).hidden=!lesson||native||firmwareLesson;
 $('#temperatureFirmwareActions').hidden=!lesson;
 $('#openNativeDraft').hidden=!firmwareLesson;
 $('#temperatureDisplayScreen').hidden=$('#temperatureDisplayWires').hidden=!displayLesson;
 $('#temperatureDisplayMonitor').disabled=!oledPart();
 if(lesson){
  const source=$('#temperatureFirmwareSource'),path='./firmware/'+board().id+'/'+firmware.file+'.c';
  if(source.getAttribute('href')!==path)source.href=path;
  const parameter=$('#temperatureSourceParameter');
  if(parameter.textContent!==firmware.parameter)parameter.textContent=firmware.parameter;
  const details=$('#temperatureFirmwareExplanation');
  const summary=displayLesson?'两份 HEX 只改变屏幕上的温标。也可编辑 C 并在当前浏览器重新编译。':firmwareLesson?'两份 HEX 只改变报警阈值。也可编辑 C 并在当前浏览器重新编译。':'两份 HEX 只改变报警阈值。修改 C 源码并在本机重新编译后，可载入自己的固件。';
  if(details.textContent!==summary)details.textContent=summary;
  $$('[data-temperature-firmware]').forEach((button,index)=>{
   const [kind,label]=firmware.variants[index];
   if(button.dataset.temperatureFirmware!==kind){button.dataset.temperatureFirmware=kind;button.textContent=`运行${displayLesson?'':' '}${label}固件`;}
   button.setAttribute('aria-pressed',String(native&&loadedFirmware?.name===kind+'.hex'));
  });
 }
 const lines=native&&lesson?(lastState.serial??'').slice(-120).split('\n').slice(0,-1):[];
 const lastLine=lines.at(-1)?.trim()??'';
 const reports=displayLesson&&native?temperatureDisplayReports():null;
 const report=reports?[reports.sensor,reports.oled].filter(Boolean).join(' · '):/^(?:TEMP=-?\d+\.\d{4}|I2C=0x[0-9A-F]{2})$/.test(lastLine)?lastLine:'';
 $('#temperatureFirmwareReport').hidden=!report;
 if($('#temperatureFirmwareLine').textContent!==report)$('#temperatureFirmwareLine').textContent=report;
 if(displayLesson)for(const button of $$('[data-temperature-sda]')){
  const id=button.dataset.temperatureSda,label=id==='temp1'?'传感器':'OLED';
  const text=`${temperatureDisplayDataWire(id)?'拔下':'接回'}${label} SDA`;
  if(button.textContent!==text)button.textContent=text;
  button.disabled=!circuit.components.some(part=>part.id===id);
 }
 $('#openTemperatureTrace').hidden=$('#openTemperatureAnalyzer').hidden=$('#focusTemperaturePart').hidden=!part;
 if(tab.classList.contains('active'))renderTemperatureTrace(packets);
}
function temperatureDisplayDataWire(id){
 const endpoint=id+':SDA';
 return circuit.wires.find(({a,b})=>a===endpoint||b===endpoint);
}
for(const button of $$('[data-temperature-sda]'))button.onclick=()=>{
 if(example.id!==stm32TemperatureDisplayLessonId)return;
 const id=button.dataset.temperatureSda,wire=temperatureDisplayDataWire(id);
 if(wire)deleteWire(wire.id);
 else{
  const original=example.circuitData.wires.find(({id:wireId})=>wireId===temperatureDisplaySdaWires[id]);
  if(original)connect(original.a,original.b,original.color);
 }
};
$('#temperatureDisplayMonitor').onclick=()=>$('#openOledMonitor').click();
$('#locateTemperatureThreshold').onclick=()=>locateSourceDefinition('ALARM_C');
$('#locateTemperatureAddress').onclick=()=>locateSourceDefinition('SENSOR_ADDR');
$('#openTemperatureTrace').onclick=()=>{
 const tab=$('[data-monitor="temperature-i2c"]');
 $('.monitor-panel').classList.remove('collapsed');tab.click();tab.focus({preventScroll:true});
 $('#monitor-temperature-i2c').scrollIntoView({block:'nearest'});
};
$('#focusTemperaturePart').onclick=()=>{
 const part=temperaturePart();
 if(!part)return;
 focusDiagnosticPart(part.id);
 requestAnimationFrame(()=>workbench?.focusSelection?.());
};
const i2cAnalyzer=mountI2cAnalyzerPanel($('#monitor-i2c-analyzer'),()=>({events:lastState?.events,owner:runtime}));
function renderI2cAnalyzer(){
 const tab=$('[data-monitor="i2c-analyzer"]'),active=tab.classList.contains('active');
 i2cAnalyzer.update(active);
 tab.hidden=!i2cAnalyzer.hasRecords&&!circuit.components.some(isI2cPart)&&!lastState?.events?.some(event=>event.type==='i2c');
 if(tab.hidden&&active)$('[data-monitor="pins"]').click();
}
function openI2cAnalyzer(){
 const tab=$('[data-monitor="i2c-analyzer"]');
 setMobilePane('editor');
 $('.monitor-panel').classList.remove('collapsed');
 tab.click();tab.focus({preventScroll:true});
 $('#monitor-i2c-analyzer').scrollIntoView({block:'nearest'});
}
$('#openOledAnalyzer').onclick=$('#openTemperatureAnalyzer').onclick=openI2cAnalyzer;
function sourceHardwareSnapshot(){
 const state=appliedSource===null?'unapplied':sourcePending?'draft':'applied';
 const pin=wavePin,{voltage,status:voltageStatus}=groundedPinMeasurement('mcu:'+pin);
 const servo=sourceServoReading(),pwmRc=sourceRcReading(),sevenSegment=sourceSegmentReading();
 if(!appliedSource)return {state,pin,servo,pwmRc,sevenSegment};
 const external=circuit.components.filter(part=>part.type==='led'&&!part.hidden);
 const selectedLed=external.find(part=>part.id===selected);
 const led=selectedLed??(pin!==board().ledPin&&external.length===1?external[0]:null);
 const light=led?sourceLightReading(led.id,led.displayName||'外接 LED · '+led.id)
  :pin===board().ledPin?sourceLightReading('onboard','板载 LED'):null;
 const sonar=example.id===ultrasonicLessonId?sonarProgramReading(lastState):null;
 const temperature=example.id===i2cTemperatureLessonId?temperatureProgramReading(lastState):null;
 return {state,pin,voltage,voltageStatus,light,servo,pwmRc,sevenSegment,sonar,temperature,pwm:lastState.pins?.[pin]?.pwm,activity:sourceSignalActivity(lastState,pin)};
}
function sourceTraceResultValid(measurement){
 return measurement?.converged&&!measurement.issues.some(({code})=>code==='SUPPLY_SHORT'||code==='ELECTRICAL_CONFLICT'||code==='OUTPUT_CONFLICT');
}
function syncSourceProbeTrace(key){
 const {red,black}=probeEndpoints;
 const enabled=Boolean(probeOpen&&red&&black&&!nativeMode());
 sourceProbeTrace.sync({key:enabled?(key??sourceCircuitKey(circuit,board())):null,red,black,enabled});
 return enabled;
}
function trackedSourceLed(){
 return trackedLedId===null?null:circuit.components.find(part=>part.id===trackedLedId&&part.type==='led')??null;
}
function syncSourceLedTrace(key){
 const part=trackedSourceLed();
 const enabled=Boolean(part&&!nativeMode());
 sourceLedTrace.sync({key:enabled?(key??sourceCircuitKey(circuit,board())):null,id:part?.id,enabled});
 if(!part)trackedLedId=null;
 return enabled;
}
function sourceLedCurrent(measurement){
 const current=measurement?.parts?.[trackedLedId]?.currentMa;
 return sourceTraceResultValid(measurement)&&Number.isFinite(current)?current:null;
}
function observeSourceLed(id){
 trackedLedId=id;
 if(!syncSourceLedTrace())return;
 setObjectPopover(null);
 if(appliedSource&&lastState.executedSteps){
  const current=lastState.error?null:sourceLedCurrent(result);
  sourceLedTrace.record(sourceLedTrace.capture(lastState.timeMs,current));
 }
 openSourceScope('led');
}
function recordSourceMeasurementGap(){
 if(appliedSource&&syncSourceProbeTrace())sourceProbeTrace.record(sourceProbeTrace.capture(lastState.timeMs,null));
 if(appliedSource&&syncSourceLedTrace())sourceLedTrace.record(sourceLedTrace.capture(lastState.timeMs,null));
}
function sampleSourceDelay(instance,{fromMs},readState){
 if(!instance||runtime!==instance||!appliedSource||nativeMode()||!Number.isFinite(fromMs)||fromMs<0)return;
 const pin=wavePin;
 const trace=sourceTrace?.pin===pin?sourceTrace.trace:null;
 const pinWanted=fromMs<=sourceTraceWindowMs&&(!trace||trace.samples.length<sourceTraceMaxSamples&&!(trace.sampledThroughMs>fromMs));
 const probeWanted=sourceProbeTrace.canSample(fromMs);
 const ledWanted=sourceLedTrace.canSample(fromMs);
 if(!pinWanted&&!probeWanted&&!ledWanted)return;
 try{
  const state=readState();
  if(state.error||state.timeMs!==fromMs)return;
  const key=sourceCircuitKey(circuit,board());
  const captureProbes=probeWanted&&syncSourceProbeTrace(key)&&sourceProbeTrace.canSample(fromMs);
  const captureLed=ledWanted&&syncSourceLedTrace(key)&&sourceLedTrace.canSample(fromMs);
  let measurement=null;
  try{measurement=sim.sampleAtCurrentTime(circuit,state);}catch{/* A failed solve is a missing differential sample. */}
  const voltage=pinWanted?groundedPinMeasurement('mcu:'+pin,measurement).voltage:null;
  const probes=captureProbes?sourceProbeTrace.capture(fromMs,measurement):null;
  const led=captureLed?sourceLedTrace.capture(fromMs,sourceLedCurrent(measurement)):null;
  // Commit this boundary only with a successful execution frame for this revision.
  sourceDelaySample={instance,key,pin,timeMs:fromMs,voltage,pinWanted,probes,led};
 }catch{
  // An optional waveform observation must not interrupt program execution.
 }
}
function beginSourceComparison(){
 const key=sourcePending?sourceCircuitKey(circuit,board()):null;
 if(!sourcePending)sourceProbeTrace.reset();
 if(syncSourceProbeTrace(key)&&sourcePending)sourceProbeTrace.beginComparison();
 if(!sourcePending)sourceLedTrace.reset();
 if(syncSourceLedTrace(key)&&sourcePending)sourceLedTrace.beginComparison();
 const compatible=sourceObserved&&sourceObserved.sample.pin===wavePin&&sourceObserved.key===key;
 sourceComparison=compatible?{key:sourceObserved.key,before:sourceObserved.sample,after:null}:null;
 const previous=sourceTrace?.key===key&&sourceTrace.pin===wavePin?sourceTrace.trace:null;
 sourceTraceComparison=previous?.samples.length?{key,trace:{pin:wavePin,windowMs:sourceTraceWindowMs,before:previous,after:emptySourceTrace()}}:null;
 sourceObserved=null;sourceTrace=null;sourceDelaySample=null;
}
function updateSourceComparison(snapshot,sourceAdvanced){
 const delaySample=sourceAdvanced?sourceDelaySample:null;
 if(sourceAdvanced)sourceDelaySample=null;
 const hasProbes=probeOpen&&probeEndpoints.red&&probeEndpoints.black;
 if(!sourceObserved&&!sourceComparison&&!sourceTrace&&!sourceTraceComparison&&!sourceAdvanced&&!hasProbes&&!trackedLedId)return;
 const key=sourceCircuitKey(circuit,board());
 const probeEnabled=syncSourceProbeTrace(key);
 const ledEnabled=syncSourceLedTrace(key);
 if(sourceObserved&&(sourceObserved.key!==key||sourceObserved.sample.pin!==snapshot.pin))sourceObserved=null;
 if(sourceComparison&&(sourceComparison.key!==key||sourceComparison.before.pin!==snapshot.pin))sourceComparison=null;
 if(sourceTrace&&(sourceTrace.key!==key||sourceTrace.pin!==snapshot.pin))sourceTrace=null;
 if(sourceTraceComparison&&(sourceTraceComparison.key!==key||sourceTraceComparison.trace.pin!==snapshot.pin))sourceTraceComparison=null;
 if(!sourceAdvanced||!appliedSource)return;
 const matchingDelay=delaySample&&delaySample.instance===runtime&&delaySample.key===key&&delaySample.timeMs<=lastState.timeMs;
 if(probeEnabled&&(lastState.executedSteps||lastState.error)){
  if(matchingDelay&&!lastState.error)sourceProbeTrace.record(delaySample.probes);
  sourceProbeTrace.record(sourceProbeTrace.capture(lastState.timeMs,lastState.error?null:result));
 }
 if(ledEnabled&&(lastState.executedSteps||lastState.error)){
  if(matchingDelay&&!lastState.error)sourceLedTrace.record(delaySample.led);
  sourceLedTrace.record(sourceLedTrace.capture(lastState.timeMs,lastState.error?null:sourceLedCurrent(result)));
 }
 if(!lastState.error&&lastState.executedSteps){
  sourceTrace??={key,pin:snapshot.pin,trace:sourceTraceComparison?.trace.after??emptySourceTrace()};
  if(matchingDelay&&delaySample.pin===snapshot.pin&&delaySample.pinWanted){
   sampleSourceTrace(sourceTrace.trace,delaySample.timeMs,delaySample.voltage);
  }
  sampleSourceTrace(sourceTrace.trace,lastState.timeMs,snapshot.voltage);
 }
 const reliable=sourceTraceResultValid(result);
 if(example.id===ultrasonicLessonId&&!snapshot.sonar?.alarmObserved)return;
 if(example.id===i2cTemperatureLessonId&&!snapshot.temperature?.alarmObserved)return;
 const sample=sourceObservation(snapshot,lastState,reliable);
 if(!sample)return;
 sourceObserved={key,sample};
 if(sourceComparison&&!sourceComparison.after){
  const beforeLight=sourceComparison.before.light;
  const light=beforeLight?sourceLightReading(beforeLight.id,beforeLight.name):null;
  const beforeServo=sourceComparison.before.servo;
  const servo=beforeServo&&snapshot.servo?.id===beforeServo.id?snapshot.servo:null;
  const beforeRc=sourceComparison.before.pwmRc;
  const pwmRc=beforeRc&&snapshot.pwmRc?.id===beforeRc.id?snapshot.pwmRc:null;
  const beforeDisplay=sourceComparison.before.sevenSegment;
  const sevenSegment=beforeDisplay&&snapshot.sevenSegment?.id===beforeDisplay.id?snapshot.sevenSegment:null;
  sourceComparison.after=sourceObservation({...snapshot,light,servo,pwmRc,sevenSegment},lastState,reliable);
 }
}
function formatSourceObservation(label,sample){
 const fields=[label,`${Number(sample.timeMs.toFixed(3))} ms`,sample.pin,`${fmt(sample.voltage)} V`];
 if(sample.light&&(sample.light.id==='onboard'||sample.sonar||sample.temperature)){
  const current=Number.isFinite(sample.light.currentMa)?' '+fmt(sample.light.currentMa)+' mA':'';
  fields.push(sample.light.name+' '+sourceLightLabel(sample.light.brightness)+current);
 }
 if(sample.pwm)fields.push(`PWM ${fmt(sample.pwm.frequencyHz,1)} Hz · ${fmt(sample.pwm.duty*100,1)}%`);
 if(sample.adc)fields.push('ADC '+sample.adc.raw+(Number.isFinite(sample.adc.max)?' / '+sample.adc.max:''));
 if(sample.sonar)fields.push(sample.sonar.cm>=0?`${sample.sonar.cm} cm · ECHO ${sample.sonar.widthUs.toLocaleString('zh-CN')} µs`:'ECHO 超时 · 无回波');
 if(sample.temperature)fields.push(`${temperatureText(sample.temperature.measuredC)} · ${i2cHex(sample.temperature.word,4)}`);
 if(sample.servo){
  const {pulseUs,targetAngle,angle}=sample.servo;
  if(Number.isFinite(pulseUs))fields.push(fmt(pulseUs,0)+' µs');
  fields.push(`舵臂 ${servoDegrees(angle)} · 目标 ${servoDegrees(targetAngle)}`);
 }
 if(sample.pwmRc){
  const {duty,frequencyHz,voltageMean,ripplePp}=sample.pwmRc;
  fields.push(`${fmt(frequencyHz,0)} Hz / ${fmt(duty*100,1)}% · 稳态均值 ${fmt(voltageMean,3)} V · 纹波 ${fmt(ripplePp*1000,2)} mV`);
 }
 if(sample.sevenSegment){
  const {on,totalMa}=sample.sevenSegment;
  fields.push('数码管 '+sevenSegmentLabel(sample.sevenSegment),on.length?on.join('、')+' 导通 · '+fmt(totalMa,2)+' mA':'总电流 '+fmt(totalMa,2)+' mA');
 }
 if(sample.waitMs!==undefined)fields.push(`最近等待 ${Number(sample.waitMs.toFixed(3))} ms`);
 else if(sample.intervalMs!==undefined)fields.push(`写入变化间隔 ${Number(sample.intervalMs.toFixed(3))} ms`);
 return fields.join(' · ');
}
function renderSourceComparison(snapshot){
 const panel=$('#sourceHardwareCompare');
 panel.hidden=!sourceComparison||example.id===motorBridgeLessonId;
 if(panel.hidden)return;
 const {before,after}=sourceComparison;
 const beforeText=formatSourceObservation('应用前',before);
 const afterText=after?formatSourceObservation('应用后',after):snapshot.voltageStatus==='floating'
  ?'应用后 · '+snapshot.pin+' 悬空，暂无有效电压'
  :lastState.done?'应用后 · 程序已停止，尚无可对照的读数':'应用后 · 等待新程序产生读数';
 const note=(sourcePending?'这是上次应用的对照。':'')+(before.sonar?'同一目标位置和接线。程序读完回波并写入报警灯后记录。':before.sevenSegment?'同一接线下的读数。数码管总电流为各段电流相加。':before.pwmRc?'同一接线下的读数。前后均值与纹波对应各自的稳态，当前电容电压仍会继续变化。':
  before.servo?'同一接线下的采样。角度相对中位。舵臂到达目标前，当前角度会继续变化。':'同一接线下的仿真采样。电压和 LED 取瞬时值，闪烁或 PWM 相位可能不同。');
 for(const [id,text] of [['sourceHardwareBefore',beforeText],['sourceHardwareAfter',afterText],['sourceHardwareCompareNote',note]]){
  const output=$('#'+id);
  if(output.textContent!==text)output.textContent=text;
 }
}
function sourceProbeTraceSnapshot(){
 const {red,black}=probeEndpoints;
 if(!probeOpen||!red||!black||nativeMode())return null;
 return {red,black,windowMs:sourceTraceWindowMs,current:sourceProbeTrace.current,comparison:sourceProbeTrace.comparison};
}
function sourceLedTraceSnapshot(){
 const part=trackedSourceLed();
 if(!part||nativeMode())return null;
 const label=(part.displayName||'外接 LED')+' · '+part.id;
 return {id:part.id,label,windowMs:sourceTraceWindowMs,current:sourceLedTrace.current,comparison:sourceLedTrace.comparison};
}
function sourceProbeScopeStatus(trace){
 if(!trace)return '打开万用表，放好红、黑两支表笔，再运行源码。';
 if(!appliedSource)return '表笔已就位。运行源码即可记录这两个测点的电压差。';
 const samples=trace.current?.samples??[];
 if(!samples.length){
  if(trace.comparison)return '已保留应用前波形，等待新程序的采样。';
  if(lastState.timeMs>=trace.windowMs)return '已超过本次运行的前 5 秒。保留表笔位置，复位后重新采样。';
  return '等待程序运行或单步产生采样。';
 }
 if(!samples.some(sample=>Number.isFinite(sample.voltage)))return '采样时两点没有共同参考，或电路无法可靠求解。图中保留缺测。';
 if(trace.comparison)return trace.comparison.before.samples.some(sample=>Number.isFinite(sample.voltage))
  ? '应用前后使用相同的测点和电路条件。' : '应用前没有有效读数，图中保留缺测。';
 return '正在显示当前采样。保持两支表笔和接线不动，修改源码后应用草稿，即可对照。';
}
function renderSourceScope(){
 const native=nativeMode(),led=sourceLedTraceSnapshot();
 if(sourceTraceSignal==='led'&&!led)sourceTraceSignal='pin';
 const signal=native?'pin':sourceTraceSignal;
 const controls=$('#sourceTraceMonitor'),pins=$('#monitor-pins'),status=$('#sourceProbeTraceStatus');
 const ledStatus=$('#sourceLedTraceStatus'),stopLed=$('#stopSourceLedTrace');
 controls.hidden=native||!probeOpen&&!led&&signal==='pin';
 if(pins.dataset.traceSignal!==signal)pins.dataset.traceSignal=signal;
 const selector=$('#sourceTraceSignal');
 selector.querySelector('[value="led"]').hidden=!led;
 if(selector.value!==signal)selector.value=signal;
 status.hidden=native||signal!=='probes';
 ledStatus.hidden=stopLed.hidden=signal!=='led';
 let plot=native?null:sourceTraceComparison?.trace??null;
 if(!status.hidden){
  const data=sourceProbeTraceSnapshot();
  const text=sourceProbeScopeStatus(data);
  if(status.textContent!==text)status.textContent=text;
  plot=null;
  if(data?.comparison||data?.current?.samples.length){
   const lookup=voltageProbeLookup(circuit,board());
   plot={...(data.comparison??{windowMs:data.windowMs,before:null,after:data.current}),kind:'probes',pin:'表笔差分',
    probeLabels:{red:lookup(data.red)??data.red,black:lookup(data.black)??data.black}};
  }
 }
 if(!ledStatus.hidden){
  const current=appliedSource&&!lastState.error?sourceLedCurrent(result):null;
  const label=led.label+(Number.isFinite(current)?' · 当前 '+fmt(current)+' mA':'');
  const guidance=led.comparison ? '同一元件、同一电路，分别从两次采样起点计时。'
    : led.current?.samples.length ? '保持接线，应用修改后的源码即可比较两次采样。' : '运行或单步开始采样。';
  const text=label+'。'+guidance;
  if(ledStatus.textContent!==text)ledStatus.textContent=text;
  plot=led.comparison||led.current?.samples.length
    ? {...(led.comparison??{windowMs:led.windowMs,before:null,after:led.current}),kind:'led',id:led.id,label:led.label} : null;
 }
 const host=$('#sourceHardwareTrace'),wasHidden=host.hidden;
 renderSourceTrace(host,plot,board().logicVoltage);
 if(signal!=='pin'&&wasHidden&&!host.hidden)host.open=true;
 const note=$('#sourceTraceNote'),explanation=signal==='led'
  ? '各曲线从自己的采样起点计时。游标显示仿真采样的时间和电流。0 mA 是有效读数，无法求解时留白。快速 PWM 边沿可能省略。'
  : '从每版启动计时。游标旁标出实际采样的时间和电压。测点悬空或求解冲突时留白。快速 PWM 边沿和采样间的瞬态可能省略。';
 if(note.textContent!==explanation)note.textContent=explanation;
 $('#openSourceTrace').hidden=native||!sourceTraceComparison;
 $('#openSourceLedTrace').hidden=!led;
}
function renderSourceRunControls(){
 const pending=!nativeMode()&&sourcePending;
 const run=$('#runButton'),runLabel=running?'Ⅱ 暂停':pending?'▶ 应用并运行':'▶ 运行';
 const step=$('#stepButton'),stepLabel=pending?'应用并单步':!nativeMode()&&lastState.pendingDelay&&!running?'完成等待':'单步';
 if(run.textContent!==runLabel)run.textContent=runLabel;
 if(step.textContent!==stepLabel)step.textContent=stepLabel;
 step.disabled=Boolean(example.nativeOnly&&!nativeMode());
 renderButtonReplayControls();
 renderSourceWait();
}
function waitTimeLabel(ms){
 if(ms>=1000)return fmt(ms/1000,1)+' s';
 if(ms>=1||ms===0)return Math.ceil(ms)+' ms';
 return Math.ceil(ms*1000)+' µs';
}
function renderSourceWait(){
 const panel=$('#sourceWaitPanel');
 const waiting=!nativeMode()&&lastState.pendingDelay;
 const completed=!nativeMode()&&lastState.lastEvent?.type==='delay'?lastState.lastEvent:null;
 const delay=waiting||completed;
 panel.hidden=!delay||delay.durationMs<=0;
 if(panel.hidden)return;
 const remaining=waiting?.remainingMs??0;
 const label=waiting?(running?'程序等待':'暂停在等待'):'等待已完成';
 const progress=$('#sourceWaitProgress');
 if(progress.max!==delay.durationMs)progress.max=delay.durationMs;
 const elapsed=Math.min(delay.durationMs,Math.max(0,delay.durationMs-remaining));
 if(progress.value!==elapsed)progress.value=elapsed;
 const title=$('#sourceWaitLabel'),readout=$('#sourceWaitRemaining');
 const value=waiting?`剩 ${waitTimeLabel(remaining)} / ${waitTimeLabel(delay.durationMs)}`:waitTimeLabel(delay.durationMs);
 if(title.textContent!==label)title.textContent=label;
 if(readout.textContent!==value)readout.textContent=value;
}
function renderSourceHardware(sourceAdvanced=false){
 const bar=$('#sourceHardwareBar');
 bar.hidden=nativeMode();
 if(bar.hidden){
  renderServoFeedback(null);
  renderPwmRcFeedback(null);
  renderSevenSegmentFeedback(sourceSegmentReading());
  renderSourceScope();
  return;
 }
 const snapshot=sourceHardwareSnapshot();
 renderServoFeedback(snapshot.servo);
 renderPwmRcFeedback(snapshot.pwmRc);
 renderSevenSegmentFeedback(snapshot.sevenSegment);
 const {state,pin,voltage,voltageStatus,light,pwm,activity}=snapshot;
 updateSourceComparison(snapshot,sourceAdvanced);
 renderSourceComparison(snapshot);
 renderSourceScope();
 bar.dataset.state=state;
 renderSourceRunControls();
 const text=$('#sourceHardwareState');
 const previous=running?'上次应用的程序正在运行':'实验台仍显示上次应用的程序';
 const message=state==='draft'?(errors.length?'草稿有错误 · ':'草稿未应用 · ')+previous
  :state==='unapplied'?(errors.length?'代码有错误 · 修正后才能应用':'代码尚未应用 · 应用后可看到实验台变化')
  :lastState.error?'当前代码已应用 · 运行遇到问题':'当前代码已应用 · 观察实验台与运行读数';
 if(text.textContent!==message)text.textContent=message;
 const apply=$('#applySourceButton');
 apply.hidden=state==='applied';
 apply.textContent=state==='draft'?'应用草稿并重启':'应用代码并运行';
 const line=$('#sourceHardwareLine'),event=activity?.pwm??activity?.write??activity?.adc;
 line.hidden=state!=='applied'||!event?.file||!event.line||!Object.hasOwn(files,event.file);
 if(!line.hidden)line.textContent=(event.type==='pwm'?'定位 PWM 设置':event.type==='adc'?'定位 ADC 采样':'定位引脚写入')+' · '+event.file+':'+event.line;
 const locate=$('#sourceHardwareLocate');
 const physical=board().pins.find(item=>item.canonical===pin&&item.kind==='gpio');
 locate.hidden=!physical;
 locate.dataset.endpoint=physical?'mcu:'+physical.id:'';
 locate.textContent='在实验台定位 '+pin;
 const reading=$('#sourceHardwareReading'),details=['观察 '+pin];
 if(state!=='unapplied'){
  if(Number.isFinite(voltage))details.push(fmt(voltage)+' V');
  else if(voltageStatus==='floating')details.push('悬空 · 无可靠电平');
  if(uncertainD13Level(pin,voltage))details.push('实物逻辑读数未定义');
  if(pwm)details.push('PWM '+fmt(pwm.frequencyHz,1)+' Hz / '+fmt(pwm.duty*100,1)+'%');
  else if(activity.write)details.push('最近写入 '+(activity.write.value?'HIGH':'LOW'));
  if(activity.adc)details.push('最近 ADC '+activity.adcReading+(Number.isFinite(activity.adcMax)?' / '+activity.adcMax:'')+'（'+activity.adc.timeMs+' ms）');
  if(activity.wait)details.push('最近程序等待 '+activity.wait.durationMs+' ms');
  if(!pwm&&activity.intervalMs!==undefined)details.push('最近两次电平写入变化间隔 '+activity.intervalMs+' ms');
 }
 const measurement=details.join(' · ');
 if(reading.textContent!==measurement)reading.textContent=measurement;
 const lightReading=$('#sourceHardwareLight');
 lightReading.hidden=!light;
 if(light){
  const detail='元件读数 · '+light.name+' · '+sourceLightLabel(light.brightness)+
    (Number.isFinite(light.currentMa)?' · '+fmt(light.currentMa)+' mA':'');
  if(lightReading.textContent!==detail)lightReading.textContent=detail;
 }
}
function renderMonitor(sourceAdvanced=false){
 renderButtonReplayControls();
 renderMotorLesson(sourceAdvanced);
 renderUltrasonicPanels();
 renderI2cOledPanels();
 renderI2cTemperaturePanels();
 renderI2cAnalyzer();
 renderNativeB1Observation();
 renderEncoderObservation();
 renderJoystickObservation();
 renderRgbLedObservation();
 renderNativeServoObservation();
 renderNativeRelayObservation();
 renderDipSwitchObservation();
 renderPhotoresistorObservation();
 renderNativeObservation();
 const pwmShortcut=$('#openNativePwmScope');
 pwmShortcut.hidden=!(nativeMode()&&lastState.pins?.[wavePin]?.pwm);
 pwmShortcut.title=nativeObservationBefore&&nativeObservationPin!==wavePin?'继续对照 '+nativeObservationPin:'查看 '+wavePin+' 的周期电压和负载电流';
 $('#pinVoltage').textContent=pinVoltage('mcu:'+wavePin);
 renderSourceHardware(sourceAdvanced);
 renderPinChips();
 drawWave();
 const serial=$('#serialOutput'),output=(nativeMode()?nativeSerialText[nativeSerialPort]:serialText)||'串口输出会出现在这里。';
 if(serial.textContent!==output){serial.textContent=output;serial.scrollTop=serial.scrollHeight;}
 const vars=lastState.variables||{};
 $('#variablesList').innerHTML=Object.keys(vars).length?'<table class="var-table">'+Object.entries(vars).map(([key,value])=>'<tr><td>'+esc(key)+'</td><td>'+esc(typeof value==='object'?JSON.stringify(value):value)+'</td></tr>').join('')+'</table>':'<div class="empty-state">'+(nativeMode()?'使用原生固件面板查看指令地址和时钟周期。':'单步运行后，在这里观察变量值。')+'</div>';
}
function nativeObservationInputs() {
 const profile=board(), pins=profile.gpioPins.map(id=>({id,label:id}));
 const pin=pins.some(item=>item.id===nativeObservationPin)?nativeObservationPin:
  pins.some(item=>item.id===wavePin)?wavePin:pins[0]?.id;
 const external=circuit.components.filter(part=>part.type==='led'&&!part.hidden);
 const leds=external.map(part=>({id:part.id,label:scenePartName(part)+' · '+part.id}));
 if(profile.ledPin)leds.unshift({id:'onboard',label:'板载 LED · '+profile.ledPin});
 const ledId=nativeObservationLed===undefined
  ? (pin===profile.ledPin?'onboard':external.length===1?external[0].id:null)
  : leds.some(item=>item.id===nativeObservationLed)?nativeObservationLed:null;
 const probes=probeOpen&&probeEndpoints.red&&probeEndpoints.black?probeEndpoints:null;
 return {circuit,profile,pin,pins,ledId,leds,probes,timeMs:lastState.timeMs??0};
}
function resetNativeObservation(notice='') {
 nativeObservationBefore=nativeObservationAfter=nativeObservationKey=null;
 nativeObservationNotice=notice;
}
function photoresistorSettling(){
 return circuit.components.some(part=>part.type==='ldr'&&part.ldrModel==='pdv-p8103'&&result?.parts?.[part.id]?.settling);
}
function renderNativeObservation() {
 if(!nativeObservationPanel)return;
 if(nativeObservationWorkspace!==example.id){
  nativeObservationWorkspace=example.id;
  nativeObservationPin=nativeObservationLed=undefined;
  resetNativeObservation();
 }
 const visible=nativeMode(),tab=$('[data-monitor="native-compare"]');
 const active=visible&&tab.classList.contains('active');
 const inputs=active||nativeObservationBefore?nativeObservationInputs():null;
 const key=inputs&&nativeObservationContext(inputs);
 if(nativeObservationBefore&&key!==nativeObservationKey){
  resetNativeObservation('接线、输入或测点已改变，请重新记录基线。');
 }
 if(!visible&&tab.classList.contains('active')){
  $('[data-monitor="pins"]').click();
  return;
 }
 const settling=active&&photoresistorSettling();
 const measurePwm=active&&nativePwmScope.isOpen()&&!nativeObservationAfter;
 const live=active&&key&&!settling?nativeObservationSample({...inputs,state:lastState,result,firmware:loadedFirmware,measurePwm}):null;
 const waiting=active&&!key?'输入接点正在变化，等它稳定后再记录。':'';
 const invalid=active&&key&&!live&&lastState.executedSteps?'当前没有有效的硬件读数，请查看诊断。':'';
 // Keep the displayed measurement selection fixed across firmware reloads and scene inspection.
 if(active)nativeObservationPin=inputs.pin;
 nativeObservationPanel.render({visible,active,...inputs,live,before:nativeObservationBefore,
  after:nativeObservationAfter,notice:settling?'光敏电阻正在响应照度变化，稳定后可采样。':waiting||nativeObservationNotice||invalid});
 if(active){
  const current=nativeObservationAfter??live;
  const unavailable=Boolean(nativeObservationBefore?.pwm&&!nativeObservationBefore.pwmCycle||
    (measurePwm||nativeObservationAfter)&&current?.pwm&&!current.pwmCycle);
  nativePwmScope.render({before:nativeObservationBefore?.pwmCycle??null,
   after:current?.pwmCycle??null,afterFrozen:Boolean(nativeObservationAfter),unavailable});
 }
}
function captureNativeObservation(side) {
 if(!nativeMode())return;
 if(photoresistorSettling())return renderNativeObservation();
 const inputs=nativeObservationInputs(),key=nativeObservationContext(inputs);
 const sample=key&&nativeObservationSample({...inputs,state:lastState,result,firmware:loadedFirmware,measurePwm:true});
 if(!sample)return renderNativeObservation();
 if(side==='before'){
  nativeObservationBefore=sample;
  nativeObservationAfter=null;
  nativeObservationKey=key;
 }else if(nativeObservationBefore&&key===nativeObservationKey)nativeObservationAfter=sample;
 nativeObservationNotice='';
 renderNativeObservation();
}
function openNativeObservation() {
 if(!nativeMode())return;
 setMobilePane('editor');
 $('.monitor-panel').classList.remove('collapsed');
 $('[data-monitor="native-compare"]').click();
 nativeObservationPanel.focus();
 $('#monitor-native-compare').scrollIntoView({block:'nearest'});
}
function locateNativeObservation(target) {
 const {pin,ledId,profile}=nativeObservationInputs();
 const endpoint=target==='pin'?pin:ledId==='onboard'?profile.ledPin:null;
 if(endpoint){
  setMobilePane('scene');
  locateScenePin('mcu:'+endpoint);
 }else if(target==='led'&&ledId)focusDiagnosticPart(ledId);
 requestAnimationFrame(()=>{
  $('#scene').scrollIntoView({block:'nearest'});
  focusSceneCanvas();
 });
}
const nativePwmScope=createNativePwmScope($('#nativePwmScope'),{onOpenChange:renderNativeObservation});
$('#openNativePwmScope').onclick=()=>{
 if(!nativeMode())return;
 if(!nativeObservationBefore)nativeObservationPin=wavePin;
 nativePwmScope.open();
 openNativeObservation();
 requestAnimationFrame(()=>{
  const summary=$('#nativePwmScopeDetails summary');
  summary?.focus({preventScroll:true});
  summary?.scrollIntoView({block:'nearest'});
 });
};
nativeObservationPanel=createNativeObservationPanel({
 onCapture:captureNativeObservation,
 onClear:()=>{resetNativeObservation();renderNativeObservation();},
 onPinChange:pin=>{nativeObservationPin=pin;renderNativeObservation();},
 onLedChange:id=>{nativeObservationLed=id;renderNativeObservation();},
 onLocate:locateNativeObservation,
 onOpen:openNativeObservation
});
function renderNativeB1Observation(){
 const panel=$('#nativeB1Observation');
 panel.hidden=example.id!==stm32NativeButtonLessonId;
 if(panel.hidden)return;
 const input=$('#nativeB1Input'),output=$('#nativeLD2Output');
 const pressed=circuit.board.userButtonPressed?'按下':'松开';
 const level=groundedPinMeasurement('mcu:PA5').voltage;
 const values=[`${pressed} · ${pinVoltage('mcu:PC13')}`,nativeMode()&&Number.isFinite(level)?`${level>=board().logicHighThreshold?'亮':'灭'} · ${fmt(level)} V`:'等待固件运行'];
 if(input.textContent!==values[0])input.textContent=values[0];
 if(output.textContent!==values[1])output.textContent=values[1];
}
function dipSwitchControlsMarkup(id,withPins=false){
 return `<div class="dip-switch-controls" data-dip-controls="${esc(id)}" role="group" aria-label="四位拨码开关">
  ${[0,1,2,3].map(index=>`<div><button type="button" class="button" data-dip-toggle="${index}" aria-label="拨码 ${index+1}" aria-pressed="false"><b>${index+1}</b> <span>OFF</span></button>${withPins?`<small data-dip-voltage="${index}">${dipSwitchLessonInputs[index]} · —</small>`:''}</div>`).join('')}
 </div>`;
}
function renderDipSwitchControls(group){
 if(!group)return;
 const part=circuit.components.find(item=>item.id===group.dataset.dipControls&&item.type==='dipswitch');
 for(const button of group.querySelectorAll('[data-dip-toggle]')){
  const index=Number(button.dataset.dipToggle),closed=Boolean((part?.switchMask??0)&(1<<index));
  const pressed=String(closed);
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
  button.disabled=!part||Boolean(part.hidden);
  const state=button.querySelector('span'),label=closed?'ON':'OFF';
  if(state.textContent!==label)state.textContent=label;
 }
}
function renderDipSwitchObservation(){
 renderDipSwitchControls($('#inspectorBody [data-dip-controls]'));
 const panel=$('#nativeDipSwitchObservation');
 panel.hidden=example.id!==dipSwitchLessonId;
 if(panel.hidden)return;
 const part=circuit.components.find(item=>item.id===dipSwitchLessonPart&&item.type==='dipswitch');
 const mask=part?.switchMask??0,loaded=nativeMode()&&lastState.executedSteps>0;
 const lamp=result?.parts?.[dipSwitchLessonLed]?.currentMa;
 const readouts=[
  ['#nativeDipSwitchMask',part?`0b${mask.toString(2).padStart(4,'0')} · ${mask}`:'—'],
  ['#nativeDipSwitchLamp',loaded&&Number.isFinite(lamp)?`${lamp>.05?'亮':'灭'} · ${fmt(lamp,3)} mA`:'等待固件运行']
 ];
 for(const [id,value] of readouts)if($(id).textContent!==value)$(id).textContent=value;
 for(const node of panel.querySelectorAll('[data-dip-voltage]')){
  const pin=dipSwitchLessonInputs[Number(node.dataset.dipVoltage)],value=`${pin} · ${loaded?pinVoltage('mcu:'+pin):'—'}`;
  if(node.textContent!==value)node.textContent=value;
 }
 $('#nativeDipSwitchLocate').disabled=!part||Boolean(part.hidden);
 renderDipSwitchControls($('#nativeDipSwitchControls [data-dip-controls]'));
}
$('#nativeDipSwitchControls').innerHTML=dipSwitchControlsMarkup(dipSwitchLessonPart,true);
for(const id of ['#nativeDipSwitchControls','#inspectorBody'])$(id).addEventListener('click',event=>{
 const button=event.target.closest('[data-dip-toggle]');
 if(button)toggleDipSwitch(button.closest('[data-dip-controls]').dataset.dipControls,Number(button.dataset.dipToggle));
});
$('#nativeDipSwitchLocate').onclick=()=>{
 focusDiagnosticPart(dipSwitchLessonPart);
 requestAnimationFrame(()=>{
  workbench?.focusSelection();
  $('#scene').scrollIntoView({block:'center'});
  focusSceneCanvas();
 });
};
function photoresistorControlsMarkup(id){
 return `<div class="photoresistor-controls" data-photoresistor-controls="${esc(id)}" role="group" aria-label="控制光照">
  <button type="button" class="button primary-light" data-photoresistor-cover aria-pressed="false">盖上遮光片</button>
  ${[2,20,200].map(lux=>`<button type="button" class="button" data-photoresistor-lux="${lux}" aria-pressed="false">${lux} lx</button>`).join('')}
 </div>`;
}
function renderPhotoresistorControls(group){
 if(!group)return;
 const part=photoresistorPart(group.dataset.photoresistorControls);
 const cover=group.querySelector('[data-photoresistor-cover]');
 const covered=Boolean(part?.ldrCovered);
 cover.disabled=!part||Boolean(part.hidden);
 if(cover.getAttribute('aria-pressed')!==String(covered))cover.setAttribute('aria-pressed',String(covered));
 const label=covered?'移开遮光片':'盖上遮光片';
 if(cover.textContent!==label)cover.textContent=label;
 for(const button of group.querySelectorAll('[data-photoresistor-lux]')){
  button.disabled=cover.disabled;
  const pressed=String(part?.lux===Number(button.dataset.photoresistorLux));
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
 }
}
function renderPhotoresistorObservation(){
 renderPhotoresistorControls($('#inspectorBody [data-photoresistor-controls]'));
 const panel=$('#nativePhotoresistorObservation');
 panel.hidden=example.id!==photoresistorLessonId;
 if(panel.hidden)return;
 const part=photoresistorPart(photoresistorLessonPart),reading=result?.parts?.[photoresistorLessonPart];
 const adc=nativeMode()?lastState.adc?.ADC1:null;
 const raw=adc?.resultPin===photoresistorLessonPin?adc.result:null;
 const current=result?.parts?.[photoresistorLessonLed]?.currentMa;
 const values=[
  ['#nativePhotoresistorLight',reading?fmt(reading.ambientLux)+' lx · 感光面目标 '+fmt(reading.targetLux)+' lx':'—'],
  ['#nativePhotoresistorResistance',reading&&Number.isFinite(reading.resistance)?fmt(reading.resistance/1000,2)+' kΩ':'—'],
  ['#nativePhotoresistorVoltage',reading?pinVoltage('mcu:'+photoresistorLessonPin):'—'],
  ['#nativePhotoresistorAdc',Number.isInteger(raw)?raw+' / 4095':'等待 ADC 采样'],
  ['#nativePhotoresistorLamp',nativeMode()&&lastState.executedSteps>0&&Number.isFinite(current)?`${current>.05?'亮':'灭'} · ${fmt(current,3)} mA`:'等待固件运行'],
  ['#nativePhotoresistorResponse',!reading?'—':reading.settling?(running?'阻值变化中':'虚拟时间暂停 · 运行后继续变化'):'阻值已稳定']
 ];
 for(const [id,value] of values)if($(id).textContent!==value)$(id).textContent=value;
 $('#nativePhotoresistorLocate').disabled=!part||Boolean(part.hidden);
 renderPhotoresistorControls($('#nativePhotoresistorControls [data-photoresistor-controls]'));
}
$('#nativePhotoresistorControls').innerHTML=photoresistorControlsMarkup(photoresistorLessonPart);
for(const id of ['#nativePhotoresistorControls','#inspectorBody'])$(id).addEventListener('click',event=>{
 const button=event.target.closest('[data-photoresistor-cover],[data-photoresistor-lux]');
 if(!button)return;
 const id=button.closest('[data-photoresistor-controls]').dataset.photoresistorControls;
 if(button.hasAttribute('data-photoresistor-cover'))togglePhotoresistorCover(id);
 else if(adjustPhotoresistor(id,{lux:Number(button.dataset.photoresistorLux)})&&selected===id){
  const input=$('#inspectorBody [data-prop="lux"]');
  if(input)input.value=button.dataset.photoresistorLux;
 }
});
$('#nativePhotoresistorLocate').onclick=()=>{
 focusDiagnosticPart(photoresistorLessonPart);
 requestAnimationFrame(()=>{
  workbench?.focusSelection();
  $('#scene').scrollIntoView({block:'center'});
  focusSceneCanvas();
 });
};
function encoderControlsMarkup(id){
 return `<div class="encoder-controls" data-encoder-controls="${esc(id)}">
  <div class="pwm-rc-actions" role="group" aria-label="旋转编码器控制">
   <button class="button" type="button" data-encoder-turn="-1">↶ 逆时针一格</button>
   <button class="button" type="button" data-encoder-turn="1">↷ 顺时针一格</button>
   <button class="button" type="button" data-encoder-press aria-pressed="false">按下轴开关</button>
  </div><output data-encoder-shaft aria-live="off"></output>
 </div>`;
}
function renderEncoderControls(group){
 if(!group)return;
 const part=encoderPart(group.dataset.encoderControls);
 const shaft=group.querySelector('[data-encoder-shaft]');
 const pressed=group.querySelector('[data-encoder-press]');
 for(const button of group.querySelectorAll('button'))button.disabled=!part;
 const reading=part&&encoderContact(part,encoderTime());
 const text=reading ? '旋钮 '+fmt(reading.angle,0)+'° · 累计 '+reading.detents+' 格'+(reading.queued?' · 待完成 '+reading.queued+' 格':'')
  : '编码器已移除。可重新载入初始实验。';
 if(shaft.textContent!==text)shaft.textContent=text;
 pressed.setAttribute('aria-pressed',String(Boolean(reading?.switchClosed)));
 const label=reading?.switchClosed?'松开轴开关':'按下轴开关';
 if(pressed.textContent!==label)pressed.textContent=label;
}
function encoderControlClick(event){
 const button=event.target.closest('button[data-encoder-turn],button[data-encoder-press]');
 if(!button)return;
 const id=button.closest('[data-encoder-controls]').dataset.encoderControls;
 if(button.hasAttribute('data-encoder-turn')){
  if(!turnEncoder(id,Number(button.dataset.encoderTurn)))toast('旋钮动作仍在进行，请稍等。');
  return;
 }
 const part=encoderPart(id);
 if(part&&setEncoderSwitch(part,!encoderContact(part,encoderTime()).switchClosed)){
  avrCircuitIO.invalidateAnalog();refresh(false);
 }
}
$('#encoderLessonControls').innerHTML=encoderControlsMarkup(encoderLessonPart);
for(const id of ['#encoderLessonControls','#inspectorBody'])$(id).addEventListener('click',encoderControlClick);

function renderEncoderObservation(){
 renderEncoderControls($('#inspectorBody [data-encoder-controls]'));
 const panel=$('#nativeEncoderObservation');
 panel.hidden=example.id!==encoderLessonId;
 if(panel.hidden)return;
 renderEncoderControls($('#encoderLessonControls [data-encoder-controls]'));
 const setText=(id,value)=>{const node=$(id);if(node.textContent!==value)node.textContent=value;};
 setText('#encoderLevelA',pinVoltage('mcu:PB0'));
 setText('#encoderLevelB',pinVoltage('mcu:PB1'));
 const serial=(nativeSerialText.USART1??'').slice(-300);
 const count=Array.from(serial.matchAll(/^COUNT=(-?\d+)\r?\n/gm)).at(-1)?.[1];
 setText('#encoderFirmwareCount',nativeMode()&&count!=null?count:'—');
 const light=result?.parts?.led1;
 setText('#encoderLedState',light&&Number.isFinite(light.currentMa)?(light.currentMa>.05?'亮':'灭')+' · '+fmt(light.currentMa)+' mA':'—');
 const levels=[];
 const high=board().logicHighThreshold;
 if(nativeMode())for(let index=history.length-1;index>=0&&levels.length<5;index--){
  const {voltages}=history[index],a=voltages['mcu:PB0'],b=voltages['mcu:PB1'];
  if(!Number.isFinite(a)||!Number.isFinite(b))break;
  const phase=(a>=high?'1':'0')+(b>=high?'1':'0');
  if(levels.at(-1)!==phase)levels.push(phase);
 }
 setText('#encoderPhaseTrail',levels.length?levels.reverse().join(' → '):'—');
}
function joystickControlsMarkup(id){
 return `<div class="joystick-controls" data-joystick-controls="${esc(id)}">
  <div class="pwm-rc-actions" role="group" aria-label="固定摇杆位置">
   <button class="button" type="button" data-stick-pose="-.6,0" aria-pressed="false">← 左推</button>
   <button class="button" type="button" data-stick-pose=".6,0" aria-pressed="false">右推 60% →</button>
   <button class="button" type="button" data-stick-pose="0,.6" aria-pressed="false">↑ 上推</button>
   <button class="button" type="button" data-stick-pose="0,-.6" aria-pressed="false">↓ 下推</button>
   <button class="button" type="button" data-stick-pose="0,0" aria-pressed="false">回中</button>
   <button class="button" type="button" data-stick-press aria-pressed="false">按下轴开关</button>
  </div><output data-stick-position aria-live="off"></output>
 </div>`;
}
function renderJoystickControls(group){
 if(!group)return;
 const part=joystickPart(group.dataset.joystickControls);
 const {x,y,pressed}=part?joystickState(part):{x:0,y:0,pressed:false};
 for(const button of group.querySelectorAll('button')){
  button.disabled=!part;
  const pose=button.dataset.stickPose?.split(',').map(Number);
  const selected=Boolean(part&&(pose?pose[0]===x&&pose[1]===y:pressed));
  if(button.getAttribute('aria-pressed')!==String(selected))button.setAttribute('aria-pressed',String(selected));
  if(!pose){const label=pressed?'松开轴开关':'按下轴开关';if(button.textContent!==label)button.textContent=label;}
 }
 const output=group.querySelector('[data-stick-position]');
 const percent=number=>`${Math.round(number*100)}%`;
 const text=part?`摇杆位置 · 水平 ${percent(x)} · 垂直 ${percent(y)}`:'摇杆已移除。可重新载入初始实验。';
 if(output.textContent!==text)output.textContent=text;
}
function joystickControlClick(event){
 const button=event.target.closest('button[data-stick-pose],button[data-stick-press]');
 if(!button)return;
 const id=button.closest('[data-joystick-controls]').dataset.joystickControls;
 if(button.hasAttribute('data-stick-pose')){
  const [x,y]=button.dataset.stickPose.split(',').map(Number);
  moveJoystick(id,{x,y});
 }else{
  const part=joystickPart(id);
  if(part)moveJoystick(id,{pressed:!joystickState(part).pressed});
 }
}
$('#joystickLessonControls').innerHTML=joystickControlsMarkup(joystickLessonPart);
for(const id of ['#joystickLessonControls','#inspectorBody'])$(id).addEventListener('click',joystickControlClick);

function renderJoystickObservation(){
 renderJoystickControls($('#inspectorBody [data-joystick-controls]'));
 const panel=$('#nativeJoystickObservation');
 panel.hidden=example.id!==joystickLessonId;
 if(panel.hidden)return;
 renderJoystickControls($('#joystickLessonControls [data-joystick-controls]'));
 const serial=(nativeSerialText.USART1??'').slice(-300);
 const sample=nativeMode()?Array.from(serial.matchAll(/^STICK=(\d+),(\d+),(\d+),(\d+),[01]\r?\n/gm)).at(-1):null;
 for(const [axis,pin,led,index] of [['X','PA4','ledx',1],['Y','PA5','ledy',2]]){
  const light=result?.parts[led],average=light?.pwmAverage?.currentMa,current=average??light?.currentMa;
  const hardware=pinVoltage('mcu:'+pin)+(Number.isFinite(current)?' · '+(average==null?'':'均值 ')+fmt(current)+' mA':'');
  const text=sample?`ADC ${sample[index]} · PWM ${fmt(Number(sample[index+2])/10,1)}% · ${hardware}`:hardware;
  const node=$('#joystick'+axis+'Reading');
  if(node.textContent!==text)node.textContent=text;
 }
}
let nativeRgbComparison=null;
function nativeRgbSample(){
 if(example.id!==rgbLedLessonId||!nativeMode()||!circuit.powered||!lastState.cycles||!result?.converged)return null;
 const channels=result.parts[rgbLedLessonPart]?.channels;
 if(!channels)return null;
 return rgbLedLessonChannels.map(({channel,pin})=>{
  const pwm=lastState.pins?.[pin]?.pwm,reading=channels[channel];
  return {duty:pwm?.duty,frequencyHz:pwm?.frequencyHz,currentMa:reading?.averageCurrentMa,
   intensity:reading?.displayBrightness??0};
 });
}
const rgbRows=$('#nativeRgbRows');
rgbRows.innerHTML=rgbLedLessonChannels.map(({channel,pin,timerChannel,color},index)=>`
 <tr><th scope="row"><button type="button" class="text-button rgb-channel" data-watch="${pin}" title="查看 ${pin} 波形">
 <span style="--channel-color:${color}" aria-hidden="true"></span>${['红','绿','蓝'][index]} · ${pin}</button>
 <small>TIM2 CH${timerChannel}</small></th><td data-duty="${channel}">—</td><td data-current="${channel}">—</td></tr>`).join('');
rgbRows.onclick=event=>{
 const button=event.target.closest('button[data-watch]');
 if(!button)return;
 wavePin=button.dataset.watch;
 $('#wavePinSelect').value=wavePin;
 renderMonitor();
};
$('#nativeRgbLocate').onclick=()=>{
 const lamp=circuit.components.find(part=>part.id===rgbLedLessonPart);
 if(!lamp||lamp.hidden)return;
 setMobilePane('scene');
 selectScenePart(lamp.id);
 requestAnimationFrame(()=>{
  $('#scene').scrollIntoView({block:'center',behavior:'instant'});
  focusSceneCanvas();
 });
};
function renderRgbLedObservation(){
 const panel=$('#nativeRgbObservation');
 panel.hidden=example.id!==rgbLedLessonId;
 if(nativeRgbComparison&&(panel.hidden||nativeRgbComparison.firmware!==loadedFirmware||
    nativeRgbComparison.key!==sourceCircuitKey(circuit,board())))nativeRgbComparison=null;
 if(panel.hidden)return;
 const current=nativeRgbSample(),before=nativeRgbComparison?.before;
 const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
 const duty=value=>Number.isFinite(value)?fmt(value*100,1)+'%':'—';
 const milliamps=value=>Number.isFinite(value)?fmt(value,3)+' mA':'—';
 for(const [index,{channel}] of rgbLedLessonChannels.entries()){
  const reading=current?.[index],previous=before?.[index];
  const withPrevious=(format,key)=>{
   const after=format(reading?.[key]),prior=format(previous?.[key]);
   return previous&&reading&&prior!==after?`${prior} → ${after}`:after;
  };
  setText(rgbRows.querySelector(`[data-duty="${channel}"]`),withPrevious(duty,'duty'));
  setText(rgbRows.querySelector(`[data-current="${channel}"]`),withPrevious(milliamps,'currentMa'));
 }
 const hz=current?.find(channel=>channel.frequencyHz)?.frequencyHz;
 const lamp=circuit.components.find(part=>part.id===rgbLedLessonPart);
 $('#nativeRgbLocate').disabled=!lamp||Boolean(lamp.hidden);
 const message=!lamp?'实验里的 RGB 灯已移出。':!circuit.powered?'电源已关闭。':!current?'编译并运行后读取实际引脚与支路。':
  [hz?`${fmt(hz,0)} Hz`:'',before?'同一接线 · 上一版 → 当前版':'当前固件',
   current.some(channel=>channel.currentMa==null)?'部分支路暂无周期均值':''].filter(Boolean).join(' · ');
 setText($('#nativeRgbStatus'),message);
 for(const [id,sample] of [['nativeRgbBefore',before],['nativeRgbNow',current]]){
  const swatch=$('#'+id);
  swatch.hidden=!sample;
  if(sample)swatch.style.setProperty('--rgb-sample',`rgb(${sample.map(item=>Math.round(255*Math.sqrt(Math.min(1,Math.max(0,item.intensity))))).join(' ')})`);
 }
}
let nativeServoComparison=null;
const nativeServoPresets=$$('#nativeServoPresets [data-position]');
for(const button of nativeServoPresets)button.onclick=()=>{
 const position=Number(button.dataset.position);
 if(!adjustPotentiometer(servoNativePotPart,'start'))return;
 adjustPotentiometer(servoNativePotPart,'move',position);
 adjustPotentiometer(servoNativePotPart,'commit');
};
$('#nativeServoLocate').onclick=()=>{
 const servo=circuit.components.find(part=>part.id===servoNativeServoPart);
 if(!servo||servo.hidden)return;
 focusDiagnosticPart(servo.id);
 requestAnimationFrame(()=>{
  $('#scene').scrollIntoView({block:'center',behavior:'instant'});
  focusSceneCanvas();
 });
};
function nativeServoAdc(){
 const adc=lastState.adc?.ADC1;
 return nativeMode()&&adc?.resultPin==='PA4'&&Number.isInteger(adc.result)?adc:null;
}
function nativeServoSample(){
 if(example.id!==servoNativeLessonId||!circuit.powered||!result?.converged)return null;
 const adc=nativeServoAdc(),servo=result.parts[servoNativeServoPart];
 if(!adc||!servo?.active)return null;
 const input=groundedPinMeasurement('mcu:PA4');
 if(input.status!=='measured'||!Number.isFinite(adc.voltage)||Math.abs(input.voltage-adc.voltage)>.003)return null;
 return {adc:adc.result,pulseUs:servo.pulseUs,angle:servo.angle};
}
const servoLoadNames={standing:'待机',running:'空载转动','supply-limited':'供电受限',unpowered:'未供电'};
function renderNativeServoObservation(){
 const panel=$('#nativeServoObservation');
 panel.hidden=example.id!==servoNativeLessonId;
 if(nativeServoComparison&&(panel.hidden||!nativeMode()||nativeServoComparison.firmware!==loadedFirmware||
    nativeServoComparison.key!==sourceCircuitKey(circuit,board())))nativeServoComparison=null;
 if(panel.hidden)return;
 const pot=circuit.components.find(part=>part.id===servoNativePotPart&&part.type==='pot');
 const part=circuit.components.find(part=>part.id===servoNativeServoPart&&part.type==='servo');
 $('#nativeServoLocate').disabled=!part||Boolean(part.hidden);
 for(const button of nativeServoPresets){
  button.disabled=!pot||Boolean(pot.hidden);
  const pressed=String(Boolean(pot&&Math.abs((pot.position??.5)-Number(button.dataset.position))<.001));
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
 }
 const adc=nativeServoAdc(),servo=part&&result?.parts[part.id];
 const pwm=nativeMode()?lastState.pins?.PA0?.pwm:null;
 const boardPulse=pwm?.frequencyHz>0?pwm.duty/pwm.frequencyHz*1e6:null;
 const voltage=(v,digits)=>Number.isFinite(v)?fmt(v,digits)+' V':'—';
 const amps=v=>Number.isFinite(v)?fmt(v,1)+' mA':'—';
 const setText=(id,text)=>{const node=$('#'+id);if(node.textContent!==text)node.textContent=text;};
 const angle=servoDegrees(servo?.angle),target=servoDegrees(servo?.targetAngle);
 setText('nativeServoAdc',adc?`${adc.result} / ${lastState.adcMax??4095} · ${voltage(adc.voltage,3)}`:pinVoltage('mcu:PA4'));
 setText('nativeServoPwm',Number.isFinite(boardPulse)?`${fmt(boardPulse,0)} µs · ${fmt(pwm.frequencyHz,1)} Hz`:'—');
 setText('nativeServoAngle',`${angle} · 目标 ${target}`);
 setText('nativeServoSupply',`${voltage(servo?.voltage,2)} · ${amps(servo?.currentMa)}`);
 const signalStatus=servo?.active?(servo.moving?'舵臂正在转动':'已到目标角度'):
  servoSignalStatus[servo?.reason]??'等待控制信号';
 const status=!part?'实验里的舵机已移出。':!circuit.powered?'开发板未供电。舵臂保持最后位置。':
  [signalStatus,servoLoadNames[servo?.loadMode]].filter(Boolean).join(' · ');
 setText('nativeServoStatus',status);
 const comparison=nativeServoComparison,traceSection=$('#nativeServoTrace');
 traceSection.hidden=!comparison;
 if(!comparison)return;
 const {before,trace}=comparison,after=nativeServoSample();
 setText('nativeServoCompareText',after?`同一旋钮位置与接线 · ADC ${before.adc} → ${after.adc} · ${fmt(before.pulseUs,0)} → ${fmt(after.pulseUs,0)} µs`:
  `上一版 ADC ${before.adc} · ${fmt(before.pulseUs,0)} µs · 等待新固件输出`);
 if(recordServoTurn(trace,lastState.timeMs,servo)||trace.samples.length===1){
  $('#nativeServoTraceActual').setAttribute('d',servoTurnPath(trace.samples,'angle'));
  $('#nativeServoTraceTarget').setAttribute('d',servoTurnPath(trace.samples,'targetAngle'));
 }
 const motion=[`起点 ${servoDegrees(before.angle)}`,`当前 ${angle}`];
 if(trace.reachedMs!==null)motion.push(`新固件启动后约 ${fmt(trace.reachedMs,0)} ms 到位`);
 if(trace.peakMa!==null)motion.push(`记录电流峰值 ${amps(trace.peakMa)}`);
 setText('nativeServoTraceSummary',motion.join(' · '));
}
let nativeRelayComparison=null,nativeRelayScope=null;
function clearNativeRelayObservation(){
 nativeRelayComparison=null;
 nativeRelayScope=null;
}
$('#nativeRelayLocate').onclick=()=>{
 const part=circuit.components.find(item=>item.id===relayNativePart&&!item.hidden);
 if(!part)return;
 focusDiagnosticPart(part.id);
 requestAnimationFrame(()=>{
  $('#scene').scrollIntoView({block:'center',behavior:'instant'});
  focusSceneCanvas();
 });
};
function nativeRelayPwm(){
 if(example.id!==relayNativeLessonId||!nativeMode()||!circuit.powered)return null;
 const pwm=lastState.pins?.PA0?.pwm;
 if(!(pwm?.frequencyHz>0)||!Number.isFinite(pwm.duty))return null;
 const periodMs=1000/pwm.frequencyHz;
 return {...pwm,periodMs,pulseMs:periodMs*pwm.duty};
}
function renderNativeRelayObservation(){
 const panel=$('#nativeRelayObservation');
 panel.hidden=example.id!==relayNativeLessonId;
 if(panel.hidden){clearNativeRelayObservation();return;}
 const pwm=nativeRelayPwm(),module=circuit.components.find(part=>part.id===relayNativePart),relay=result?.parts[relayNativePart];
 const lamp=result?.parts[relayNativeLamp],current=lamp?.currentMa;
 $('#nativeRelayLocate').disabled=!module||Boolean(module.hidden);
 const fmtMs=value=>fmt(value,2)+' ms';
 const setText=(id,text)=>{const node=$('#'+id);if(node.textContent!==text)node.textContent=text;};
 setText('nativeRelayPulse',pwm?`${fmtMs(pwm.pulseMs)} 高 · ${fmtMs(pwm.periodMs)} 周期`:'—');
 setText('nativeRelaySupply',Number.isFinite(relay?.voltage)?`${fmt(relay.voltage,2)} V · ${Number.isFinite(relay.currentMa)?fmt(relay.currentMa,1)+' mA':'—'}`:'—');
 setText('nativeRelayContact',relay?`${relay.closed?'闭合':'断开'} · ${relay.indicator?'指示灯亮':'指示灯灭'}`:'—');
 setText('nativeRelayLamp',Number.isFinite(current)?`${current>.05?'亮':'灭'} · ${fmt(current,2)} mA`:'—');
 const key=pwm?sourceCircuitKey(circuit,board()):null;
 if(nativeRelayComparison&&(!nativeMode()||nativeRelayComparison.firmware!==loadedFirmware||
    key&&key!==nativeRelayComparison.key||!circuit.powered))nativeRelayComparison=null;
 const previous=nativeRelayComparison?.before;
 const comparison=Boolean(pwm&&previous&&Math.abs(previous.pulseMs-pwm.pulseMs)>.005);
 const notice=$('#nativeRelayCompare');
 notice.hidden=!comparison;
 if(comparison)setText('nativeRelayCompare',`同一接线 · 上一版 ${fmtMs(previous.pulseMs)} → 当前 ${fmtMs(pwm.pulseMs)}`);
 const chart=$('#nativeRelayScope');
 chart.hidden=!pwm;
 if(!pwm){nativeRelayScope=null;return;}
 const signature=JSON.stringify([key,pwm.frequencyHz,pwm.duty,pwm.highFirst]);
 if(!nativeRelayScope||nativeRelayScope.firmware!==loadedFirmware||nativeRelayScope.signature!==signature){
  nativeRelayScope={firmware:loadedFirmware,signature,trace:createRelayScope()};
  $('#nativeRelayTraceSig').setAttribute('d',relaySignalPath(pwm.duty,pwm.highFirst!==false));
  $('#nativeRelayTraceContact').setAttribute('d','');
  $('#nativeRelayTraceLoad').setAttribute('d','');
  setText('nativeRelayScopeEnd',fmtMs(pwm.periodMs));
 }
 const {trace}=nativeRelayScope;
 if(recordRelayScope(trace,{timeMs:lastState.timeMs,phaseMs:pwm.phaseMs,periodMs:pwm.periodMs,
    closed:relay?.closed,lit:Number.isFinite(current)?current>.05:null})){
  const samples=trace.complete.length?trace.complete:trace.cycle;
  $('#nativeRelayTraceContact').setAttribute('d',relaySamplePath(samples,pwm.periodMs,'closed',34,51));
  $('#nativeRelayTraceLoad').setAttribute('d',relaySamplePath(samples,pwm.periodMs,'lit',63,80));
 }
 setText('nativeRelayScopeStatus',!relay?'实验里的继电器已移出。':!relay.powered?'控制侧供电不足。':
  !relay.signalPin?'检查 PA0 与 SIG 的连接。':trace.complete.length?'上一个周期的触点和外接灯采样。':'正在采集触点和外接灯的读数。');
}
function buttonContactText(part){
 const contact=result?.parts[part?.id];
 const mechanical=part?.pressed?'按下':'松开';
 const electric=(contact?.closed??part?.pressed)?'两组接通':'两组分离';
 return mechanical+' · '+(contact?.bouncing?'触点抖动 · ':'')+electric;
}
function updateButtonContactState(){
 const output=$('#buttonContactState');
 if (!output) return;
 const message=buttonContactText(circuit.components.find(part=>part.id===selected));
 if (output.textContent!==message) output.textContent=message;
 const toggle=$('#inspectorBody [data-prop="pressed"]');
 if(toggle)toggle.checked=Boolean(circuit.components.find(part=>part.id===selected)?.pressed);
}
function renderFirmwareProgress(){
 const adc=lastState.adc?.ADC1??lastState.adc?.ADC0;
 const meter=$('#firmwareAdcMeter');
 meter.hidden=adc?.result==null;
 if(!meter.hidden){
  const channel=adc.resultPin||(adc.resultSource==='bandgap'?'内部带隙参考':'GND');
  $('#firmwareAdcLabel').textContent='最近一次 ADC 读数 · '+channel;
  const voltage=Number.isFinite(adc.voltage)?' · '+fmt(adc.voltage,2)+' V':'';
  $('#firmwareAdcValue').textContent=adc.result+' / '+(lastState.adcMax??1023)+voltage;
 }
 const pwmPins=Object.entries(lastState.pins??{}).filter(([,pin])=>pin.pwm?.timer||Number.isInteger(pin.pwm?.slice));
 const [pwmPin,pwmState]=pwmPins.find(([name])=>name===wavePin)??pwmPins[0]??[];
 $('#firmwarePwmMeter').hidden=!pwmState;
 if(pwmState){
  const {timer,slice,channel,frequencyHz,duty}=pwmState.pwm;
  const hardware=Number.isInteger(slice)?`PWM${slice}${channel}`:`TIM${timer}_CH${channel}`;
  $('#firmwarePwmLabel').textContent=`PWM 输出 · ${pwmPin} · ${hardware}`;
  $('#firmwarePwmValue').textContent=fmt(frequencyHz,frequencyHz<1?3:frequencyHz<100?1:0)+' Hz · '+fmt(duty*100,1)+'%';
 }
 $('#firmwarePC').textContent=formatFirmwareAddress(lastState.pc?.byteAddress??firmwareImage?.resetAddress??0);
 $('#firmwareCycles').textContent=(lastState.cycles??0).toLocaleString('zh-CN');
}
function refresh(inspect=true,{sourceAdvanced=false,state}={}){
 lastState=state??runtime?.getState()??lastState;result=sim.solve(circuit,lastState);
 const record={time:lastState.timeMs||0,voltages:{}};
 for(const name of board().gpioPins){
  const endpoint='mcu:'+name,{status,voltage}=groundedPinMeasurement(endpoint);
  if(status==='measured')record.voltages[endpoint]=voltage;
 }
 if(history.at(-1)?.time===record.time)history[history.length-1]=record;else history.push(record);
 if(history.length>600)history.splice(0,history.length-600);
 renderBridgeChannels(result.parts[selected]);
 workbench?.update(result,lastState);renderPinMeasurement();renderProbeMeter();$('#virtualTime').textContent=fmt((lastState.timeMs||0)/1000,3)+' s';$('#experimentGoal').textContent=nativeMode()?'观察固件输出的引脚电平和电路反应。':example.learningGoals?.[0]||example.description;if(inspect&&(!selected||inspectorKey!==selected)&&!$('#inspectorBody').contains(document.activeElement))renderInspector();if(selected&&result.parts[selected]){for(const el of $$('#inspectorBody [data-metric]')){const k=el.dataset.metric;const value=partMetricText(result.parts[selected][k],Number(el.dataset.digits??2),el.dataset.unit||'',el.hasAttribute('data-servo-relative'));if(el.innerHTML!==value)el.innerHTML=value;}for(const el of $$('#inspectorBody [data-net-voltage]'))el.textContent=pinVoltage(el.dataset.netVoltage);}if(nativeMode())renderFirmwareProgress();updateButtonContactState();renderDiagnostics();renderMonitor(sourceAdvanced);updateSound();
}
$('#serialPortSelect').onchange=event=>{nativeSerialPort=event.target.value;renderMonitor();};
$('#serialClearButton').onclick=()=>{if(nativeMode())nativeSerialText[nativeSerialPort]='';else serialText='';renderMonitor();};
$('#serialSendButton').onclick=async()=>{
 const input=$('#serialInput'),native=nativeMode(),port=native?nativeSerialPort:'USART1';
 if(!runtime)return toast('先运行初始化串口的程序。');
 if(native&&!lastState.uarts?.[port]?.rxEnabled)return toast('请先让固件启用 '+port+' 接收。');
 const instance=runtime;
 try{
  if(instance.injectSerial)await instance.injectSerial(native?new TextEncoder().encode(input.value):input.value,port);
  else if(instance.enqueueSerial)instance.enqueueSerial(port,input.value);
  else return toast('当前内核未开放串口接收注入；发送输出仍可观察。');
 }catch(error){if(runtime===instance)toast(error.message||String(error));return;}
 if(runtime!==instance)return;
 input.value='';
 toast('已送到 '+port+' 接收队列。');
};
$('#serialInput').onkeydown=event=>{if(event.key==='Enter')$('#serialSendButton').click();};
function initSound(){try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();if(!osc){osc=audioCtx.createOscillator();audioGain=audioCtx.createGain();osc.type='square';osc.frequency.value=1800;audioGain.gain.value=0;osc.connect(audioGain);audioGain.connect(audioCtx.destination);osc.start();}}catch{toast('当前浏览器未开放音频输出。');}}
function updateSound(){if(!soundEnabled||!running){stopSound();return;}if(Object.values(result?.parts||{}).some(p=>p.type==='buzzer'&&p.on)){initSound();audioGain?.gain.setTargetAtTime(.025,audioCtx.currentTime,.02);}else stopSound();}
function stopSound(){if(audioGain&&audioCtx)audioGain.gain.setTargetAtTime(0,audioCtx.currentTime,.015);}
$('#soundButton').onclick=()=>{soundEnabled=!soundEnabled;$('#soundButton').textContent='声音：'+(soundEnabled?'开':'关');if(soundEnabled)initSound();updateSound();};
let retainedExportURL=null;
function download(name,blob,keepURL=false){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;($('#modal').open?$('#modalBody'):document.body).append(a);a.click();a.remove();if(keepURL){if(retainedExportURL)URL.revokeObjectURL(retainedExportURL);retainedExportURL=url;}else setTimeout(()=>URL.revokeObjectURL(url),60000);return {url,name};}
function projectData(){return {format:'physical-lab',version:2,exampleId:example.id,exampleMeta:example,files,circuit:snapshotCircuit(),activeFile,...firmwareProjectFields(),bom:catalog?.getBOM()||[]};}
$('#exportButton').onclick=()=>{download('PhysicalLab_'+example.id.replace(/:/g,'_')+'_实验工程.json',new Blob([JSON.stringify(projectData(),null,2)],{type:'application/json'}));toast(loadedFirmware?'代码、固件与接线已一起导出。':'代码、元件参数与接线已一起导出。');};
function setNativeFirmware(next,{preparedRuntime}={}){
 loadedFirmware=next;
 editorAssistant?.close();
 syncFirmwareView();
 resetRuntime({preserveI2cDevices:true,preservePhotocellStates:true});
 if(preparedRuntime){
  runtime=preparedRuntime;compiled=true;lastState=runtime.getState();
  refresh();
 }
 renderBeginnerGuide();
 save();
 if(nativeMode()){
  setMobilePane('editor');
  $(preparedRuntime?'#nativeDraftEditor':example.id===stm32TemperatureDisplayLessonId?'#i2cTemperatureTitle':'#firmwareTitle').focus({preventScroll:true});
 }else{
  scheduleCheck();
  $(example.nativeOnly?'#temperatureSourcePreview summary':'#codeEditor').focus({preventScroll:true});
 }
}
async function readBuiltInFirmware(root,kind,ext,target){
 const name=kind+'.'+ext;
 const response=await fetch(root+'/'+name);
 if(!response.ok)throw Error('样例文件暂时不可用。');
 return validateFirmware({name,...await readFirmwarePayload(response,ext),active:true},target);
}
function activeNativeDraftFile(){
 if(!example.nativeOnly||!isStm32Native(board()))return null;
 return Object.hasOwn(files,activeFile)?activeFile:Object.keys(files).find(name=>/\.c$/i.test(name))??null;
}
function nativeDraftParameter(){
 return example.nativeSourceParameter??(example.id===stm32NativeButtonLessonId?'LIGHT_WHEN_PRESSED':temperatureFirmwareFor(example.id)?.parameter);
}
function syncNativeDraftFile(){
 const name=activeNativeDraftFile();
 if(!name)return;
 activeFile=name;
 const picker=$('#nativeDraftFiles'),names=Object.keys(files);
 if(picker.options.length!==names.length||names.some((path,index)=>picker.options[index].value!==path)){
  picker.replaceChildren(...names.map(path=>new Option(path,path)));
 }
 picker.value=name;
 const editor=$('#nativeDraftEditor');
 if(editor.value!==files[name])editor.value=files[name];
 $('#nativeDraftFile').textContent=name;
 $('#temperatureSourceText').textContent=nativeDraftOriginal?.sources[name]??'当前文件由你创建或导入。';
}
function renderNativeDraftControls(){
 const name=activeNativeDraftFile(),ready=Boolean(name&&nativeDraftOriginal?.workspace===files);
 for(const id of ['nativeDraftEditor','nativeDraftFiles'])$('#'+id).disabled=!ready;
 $('#nativeDraftLocate').disabled=!ready||!nativeDraftParameter();
 $('#nativeDraftRemove').disabled=!ready||(/\.c$/i.test(name)&&Object.keys(files).filter(path=>/\.c$/i.test(path)).length<=1);
 for(const id of ['nativeDraftAdd','nativeDraftImport'])$('#'+id).disabled=!ready||Object.keys(files).length>=24;
 $('#nativeDraftCompile').disabled=!ready||Boolean(nativeDraftJob);
 $('#nativeDraftCancel').hidden=!nativeDraftJob;
 const original=ready?nativeDraftOriginal.sources[name]:undefined;
 $('#nativeDraftRestore').disabled=original===undefined||files[name]===original;
 return ready;
}
function showNativeDraftIdle(){
 const status=$('#nativeDraftStatus');
 if(!renderNativeDraftControls())status.textContent='正在读取源码…';
 else if(appliedNativeDraft&&appliedNativeDraft.firmware===loadedFirmware&&sameSourceFiles(files,appliedNativeDraft.sources)){
  status.textContent='当前草稿已编译并载入。';
 }else if(nativeMode())status.textContent='工具栏使用已载入的固件。点「编译并运行」应用当前草稿。';
 else status.textContent='源码已就绪。点「编译并运行」查看电路反应。';
}
function cancelNativeDraftCompile(){
 if(!nativeDraftJob)return false;
 const job=nativeDraftJob;
 nativeDraftJob=null;
 job.abort.abort();
 renderNativeDraftControls();
 $('#nativeDraftStatus').textContent='编译已取消。';
 return true;
}
function focusNativeDraftLine(line,column=1,file){
 if(file&&file!==activeFile&&Object.hasOwn(files,file)){
  activeFile=file;syncNativeDraftFile();renderNativeDraftControls();save();
 }
 const editor=$('#nativeDraftEditor'),lines=editor.value.split('\n');
 if(!Number.isInteger(line)||line<1||line>lines.length)return;
 const start=lines.slice(0,line-1).reduce((offset,text)=>offset+text.length+1,0);
 const from=start+Math.max(0,Math.min(lines[line-1].length,Number(column)-1||0));
 editor.focus({preventScroll:true});
 editor.setSelectionRange(from,start+lines[line-1].length);
 editor.scrollTop=Math.max(0,(line-4)*20);
}
function showNativeDraftDiagnostics(diagnostics=[]){
 const list=$('#nativeDraftDiagnostics');
 list.replaceChildren(...(Array.isArray(diagnostics)?diagnostics:[]).slice(0,24).map(({file,line,column,severity,message})=>{
  const item=document.createElement('li');
  if(Number.isInteger(line)&&line>0){
   const button=document.createElement('button');
   button.type='button';button.className='text-button';button.textContent=`${file?file+' · ':''}第 ${line} 行`;
   button.onclick=()=>focusNativeDraftLine(line,column,file);
   item.append(button);
  }
  item.append(document.createTextNode((severity==='warning'?'警告 · ':severity==='note'?'提示 · ':'')+String(message??'')));
  return item;
 }));
 list.hidden=!list.childElementCount;
}
function storeNativeDraftSource(){
 const name=activeNativeDraftFile();
 if(!name||nativeDraftOriginal?.workspace!==files)return;
 cancelNativeDraftCompile();
 files[name]=$('#nativeDraftEditor').value;
 showNativeDraftDiagnostics();
 showNativeDraftIdle();
 save();
}
async function compileNativeDraftSource(sources,options){
 const {compileStm32C}=await import('./bluepill-c-compiler.js');
 return compileStm32C(sources,options);
}
async function prepareNativeDraftRuntime(image,target){
 const create=await nativeRuntimeCreator(target);
 let candidate;
 candidate=await create(image,{...avrCircuitIO,boardId:target.id,onSerial:(text,port)=>{
  if(runtime!==candidate)return;
  nativeSerialText[port]=((nativeSerialText[port]||'')+text).slice(-50000);
 }});
 return candidate;
}
async function compileNativeDraft(){
 const name=activeNativeDraftFile();
 if(!name||nativeDraftJob||nativeDraftOriginal?.workspace!==files||!canExecute())return false;
 const sources={...files},target=board(),origin=example,workspace=files,review=firmwareReviewRequest;
 const status=$('#nativeDraftStatus');
 if(!Object.entries(sources).some(([path,source])=>/\.c$/i.test(path)&&source.trim())){
  status.textContent='请先写入 C 源码。';
  return false;
 }
 const job={abort:new AbortController()};
 const sameLab=()=>nativeDraftJob===job&&workspace===files&&origin===example&&sameSourceFiles(sources,files)&&
  board().id===target.id&&currentPage==='lab'&&!$('#appFrame').hidden&&firmwareReviewRequest===review;
 nativeDraftJob=job;
 showNativeDraftDiagnostics();
 renderNativeDraftControls();
 status.textContent='正在加载浏览器编译器…';
 const progress={loading:'正在读取本地 Clang 工具链…',compiling:'正在编译 Cortex-M3 指令…',linking:'正在链接当前板卡的启动程序…',packaging:'正在生成并校验固件…'};
 let preparedRuntime;
 try{
  const {binary,diagnostics}=await compileNativeDraftSource(sources,{boardId:target.id,signal:job.abort.signal,onProgress:stage=>{
   if(sameLab()&&progress[stage])status.textContent=progress[stage];
  }});
  if(!sameLab())return false;
  const projectName=temperatureFirmwareFor(origin.id)?.file??target.id;
  const next=validateFirmware({name:projectName+'-draft.hex',hex:stm32BinToHex(binary,target.id),active:true},target);
  status.textContent='正在验证固件能否启动…';
  preparedRuntime=await prepareNativeDraftRuntime(parseFirmwareImage(next,target),target);
  if(!sameLab()||!canExecute())return false;
  const before=nativeTemperatureSample();
  nativeTemperatureComparison=before?{before,firmware:next,key:sourceCircuitKey(circuit,target)}:null;
  const previousRgb=appliedNativeDraft&&appliedNativeDraft.firmware===loadedFirmware&&!sameSourceFiles(appliedNativeDraft.sources,sources)?nativeRgbSample():null;
  nativeRgbComparison=previousRgb?{before:previousRgb,firmware:next,key:sourceCircuitKey(circuit,target)}:null;
  const previousServo=appliedNativeDraft&&appliedNativeDraft.firmware===loadedFirmware&&!sameSourceFiles(appliedNativeDraft.sources,sources)?nativeServoSample():null;
  nativeServoComparison=previousServo?{before:previousServo,firmware:next,key:sourceCircuitKey(circuit,target),trace:createServoTurnTrace(previousServo.angle)}:null;
  const previousRelay=appliedNativeDraft&&appliedNativeDraft.firmware===loadedFirmware&&!sameSourceFiles(appliedNativeDraft.sources,sources)?nativeRelayPwm():null;
  nativeRelayComparison=previousRelay?{before:previousRelay,firmware:next,key:sourceCircuitKey(circuit,target)}:null;
  nativeRelayScope=null;
  nativeDraftJob=null;
  appliedNativeDraft={firmware:next,sources};
  setNativeFirmware(next,{preparedRuntime});
  preparedRuntime=null;
  showNativeDraftDiagnostics(diagnostics);
  showNativeDraftIdle();
  startExecution();
  return true;
 }catch(error){
  if(sameLab()){
   showNativeDraftDiagnostics(error.diagnostics);
   status.textContent=(error.message||'编译或启动失败。')+(nativeMode()?' 仍可运行已载入的固件。':' 修正代码后可重试。');
  }
  return false;
 }finally{
  preparedRuntime?.dispose?.();
  if(nativeDraftJob===job){
   const current=sameLab();
   nativeDraftJob=null;
   renderNativeDraftControls();
   if(!current)showNativeDraftIdle();
  }
 }
}
$('#nativeDraftEditor').oninput=storeNativeDraftSource;
$('#nativeDraftEditor').onkeydown=event=>{
 if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.altKey&&!event.isComposing&&!event.repeat){
  event.preventDefault();compileNativeDraft();
 }
};
$('#nativeDraftCompile').onclick=compileNativeDraft;
$('#nativeDraftCancel').onclick=()=>{if(cancelNativeDraftCompile())$('#nativeDraftCompile').focus({preventScroll:true});};
$('#nativeDraftLocate').onclick=()=>{
 const parameter=nativeDraftParameter();
 const pattern=new RegExp(`^\\s*#\\s*define\\s+${parameter}\\b`);
 for(const [name,source] of Object.entries(files)){
  const index=source.split('\n').findIndex(line=>pattern.test(line));
  if(index>=0){focusNativeDraftLine(index+1,1,name);return;}
 }
 $('#nativeDraftStatus').textContent='当前工程中找不到 '+parameter+' 定义。';
};
$('#nativeDraftRestore').onclick=()=>{
 if(nativeDraftOriginal?.workspace!==files)return;
 const editor=$('#nativeDraftEditor');
 const source=nativeDraftOriginal.sources[activeNativeDraftFile()];
 if(source===undefined)return;
 editor.setRangeText(source,0,editor.value.length,'start');
 storeNativeDraftSource();
 editor.focus({preventScroll:true});
};
async function loadNativeDraftFiles(){
 const origin=example,target=board(),firmware=temperatureFirmwareFor(origin.id),destination=files;
 if(!origin.nativeOnly||!isStm32Native(target))return;
 if(nativeDraftOriginal?.workspace===destination){syncNativeDraftFile();return;}
 const details=$('#temperatureSourcePreview');
 if(!firmware)details.open=true;
 const parameter=nativeDraftParameter();
 $('#nativeDraftParameterHint').hidden=!parameter;
 if(parameter)$('#temperatureSourceParameter').textContent=parameter;
 $('#nativeDraftBuildGuide').href='./firmware/'+target.id+'/README.md';
 $('#nativeDraftLinker').href='./firmware/'+target.id+'/'+(target.id==='bluepill'?'stm32f103c8.ld':'stm32f103rb.ld');
 $('#nativeDraftEditor').value='';
 $('#nativeDraftFiles').replaceChildren();
 showNativeDraftDiagnostics();showNativeDraftIdle();
 const name=firmware?firmware.file+'.c':null;
 const assets=origin.nativeSourceAssets??(name?{[name]:'./firmware/'+target.id+'/'+name}:{});
 try{
  const originals=Object.fromEntries(await Promise.all(Object.entries(assets).map(async ([file,url])=>[file,await readNativeSourceAsset(url)])));
  if(example!==origin||files!==destination||nativeDraftOriginal?.workspace===destination)return;
  nativeDraftOriginal={workspace:destination,sources:originals};
  if(origin.files&&sameSourceFiles(files,origin.files)&&Object.keys(originals).length){
   Object.assign(files,originals);save();
  }
  syncNativeDraftFile();showNativeDraftIdle();
 }catch(error){
  if(example===origin&&files===destination)$('#nativeDraftStatus').textContent=error.message;
 }
}
function readNativeSourceAsset(url){
 let request=nativeSourceRequests.get(url);
 if(!request){
  request=fetch(url).then(response=>{
   if(!response.ok)throw Error('无法读取初始源码。可重新打开编辑器重试。');
   return response.text();
  }).then(text=>text.replace(/\r\n?/g,'\n')).catch(error=>{
   nativeSourceRequests.delete(url);throw error;
  });
  nativeSourceRequests.set(url,request);
 }
 return request;
}
function finishNativeFileEdit(name){
 cancelNativeDraftCompile();
 activeFile=name;
 syncNativeDraftFile();showNativeDraftDiagnostics();showNativeDraftIdle();save();
}
$('#nativeDraftFiles').onchange=event=>{
 if(!Object.hasOwn(files,event.target.value))return;
 activeFile=event.target.value;syncNativeDraftFile();renderNativeDraftControls();save();
};
$('#nativeDraftAdd').onclick=()=>{
 const proposed=prompt('新文件名（例如 logic.c 或 include/logic.h）');
 if(!proposed)return;
 try{
  const name=sourcePath(proposed.trim());
  if(!/\.(c|h)$/i.test(name))throw Error('本地 C 工程使用 .c 或 .h 文件。');
  if(Object.keys(files).length>=24)throw Error('本地 C 工程最多 24 个文件。');
  if(Object.keys(files).some(path=>path.toLowerCase()===name.toLowerCase()))throw Error('工程中已有同名文件。');
  files[name]='';finishNativeFileEdit(name);$('#nativeDraftEditor').focus({preventScroll:true});
 }catch(error){$('#nativeDraftStatus').textContent=error.message;}
};
$('#nativeDraftRemove').onclick=()=>{
 const name=activeNativeDraftFile();
 if(!name||$('#nativeDraftRemove').disabled)return;
 if(!confirm('从草稿移除 '+name+'？'))return;
 delete files[name];finishNativeFileEdit(Object.keys(files)[0]);
};
$('#nativeDraftImport').onclick=()=>$('#nativeDraftImportInput').click();
$('#nativeDraftImportInput').onchange=async event=>{
 const incoming=[...event.target.files],destination=files;event.target.value='';
 if(!incoming.length)return;
 try{
  if(incoming.some(file=>!/\.(c|h)$/i.test(file.name)||file.size>128*1024))throw Error('请选择不超过 128 KiB 的 C/H 文件。');
  if(Object.keys(files).length+incoming.length>24)throw Error('本地 C 工程最多 24 个文件。');
  const loaded=await readImportSelection(incoming),names=Object.keys(loaded.files);
  if(destination!==files||nativeDraftOriginal?.workspace!==destination)return;
  if(Object.keys(files).length+names.length>24)throw Error('本地 C 工程最多 24 个文件。');
  const known=new Set(Object.keys(files).map(name=>name.toLowerCase()));
  const duplicate=names.find(name=>known.has(name.toLowerCase()));
  if(duplicate)throw Error('工程中已有 '+duplicate+'。请修改文件名后再添加。');
  Object.assign(files,loaded.files);finishNativeFileEdit(names[0]);
 }catch(error){if(destination===files)$('#nativeDraftStatus').textContent=error.message;}
};
$('#temperatureSourcePreview').ontoggle=event=>{if(event.currentTarget.open)loadNativeDraftFiles();};
$('#openNativeDraft').onclick=async()=>{
 const origin=files,details=$('#temperatureSourcePreview');
 setMobilePane('editor');
 details.open=true;
 await loadNativeDraftFiles();
 if(files!==origin||details.hidden||!details.open)return;
 const editor=$('#nativeDraftEditor');
 (editor.disabled?details.querySelector('summary'):editor).focus({preventScroll:true});
 details.scrollIntoView({block:'nearest'});
};
async function runTemperatureFirmware(kind){
 const target=board(),lesson=example.id,firmware=temperatureFirmwareFor(lesson),status=$('#temperatureFirmwareLoadStatus');
 if(!firmware?.variants.some(([variant])=>variant===kind)||!canExecute())return;
 cancelNativeDraftCompile();
 const controls=$$('[data-temperature-firmware]');
 if(controls.some(control=>control.disabled))return;
 const request=++firmwareReviewRequest;
 const sameLab=()=>request===firmwareReviewRequest&&example.id===lesson&&board().id===target.id&&currentPage==='lab';
 controls.forEach(control=>control.disabled=true);
 status.hidden=false;status.textContent='正在加载并校验 HEX 文件…';
 try{
  const next=await readBuiltInFirmware('./firmware/'+target.id,kind,'hex',target);
  if(!sameLab())return;
  const before=nativeTemperatureSample();
  nativeTemperatureComparison=before&&before.kind!==kind?{before,firmware:next,key:sourceCircuitKey(circuit,target)}:null;
  setNativeFirmware(next);
  const started=await toggleRun();
  if(!sameLab())return;
  status.hidden=true;
  if(started&&firmware!==temperatureDisplayFirmware)$('#openTemperatureTrace').click();
  return started;
 }catch(error){if(sameLab())status.textContent=error.message||String(error);}
 finally{if(!sameLab())status.hidden=true;controls.forEach(control=>control.disabled=false);}
}
for(const button of $$('[data-temperature-firmware]'))button.onclick=()=>runTemperatureFirmware(button.dataset.temperatureFirmware);
async function createNativeCProject(target,trigger){
 const origin=example;
 trigger.disabled=true;
 const status=$('#firmwareMenuStatus');
 status.textContent='正在准备原生 C 工程…';
 try{
  const starter=await readNativeSourceAsset('./firmware/'+target.id+'/blink.c');
  if(!trigger.isConnected||!$('#modal').open||example!==origin||board().id!==target.id)return;
  const id='imported:'+target.id+':'+Date.now().toString(36);
  const count=examplesForBoard(target.id).filter(item=>item.execution==='stm32-c').length+1;
  const title='原生 C 工程 '+count;
  const workspace={id,boardId:target.id,title,shortTitle:title,description:'在当前接线上编译并运行你自己的 STM32 C 工程。',imported:true,nativeOnly:true,language:'c',execution:'stm32-c'};
  snapshotDraft();
  applyImportedWorkspace({example:workspace,files:{'main.c':starter},activeFile:'main.c',circuit:snapshotCircuit(),bom:catalog.getBOM()});
  $('#modal').close();go('lab');$('#openNativeDraft').click();
 }catch(error){if(status.isConnected)status.textContent=error.message;}
 finally{trigger.disabled=false;}
}
function showFirmwareMenu(){
 const target=board(),stm32=isStm32Native(target),pico=isRp2040Native(target);
 const nucleo=target.id==='nucleo-f103rb';
 const ext=pico?'uf2':'hex';
 const formats=stm32?'HEX / BIN':ext.toUpperCase();
 const examplesRoot='./firmware/'+(stm32||pico||target.id==='mega2560'?target.id:'uno-r3');
 const samples=pico?[
  {kind:'blink',example:'pico:blink',label:'点灯样例 · GP25 板载灯闪烁',source:'点灯 C 源码',pin:'GP25'},
  {kind:'button',example:'pico:button',label:'按键样例 · GP14 控制 GP15 外接灯',source:'按键 C 源码',pin:'GP15'},
  {kind:'adc',example:'pico:adc',label:'模拟输入样例 · GP26 电位器与串口',source:'ADC C 源码',pin:'GP26'},
  {kind:'pwm',example:'pico:pwm',label:'PWM 调光样例 · GP15 外接灯',source:'PWM C 源码',pin:'GP15'},
 ]:nucleo?[
  {kind:'blink',example:'nucleo-f103rb:blink',label:'点灯样例 · PA5 板载 LD2 闪烁',source:'点灯 C 源码',pin:'PA5'},
  {kind:'button',example:nucleoButtonExample,label:'按键样例 · 板载 B1 控制 LD2',source:'按键 C 源码',pin:'PC13'},
  {kind:'adc',example:'nucleo-f103rb:adc',label:'模拟输入样例 · PA0 电位器和 USART2',source:'ADC C 源码',pin:'PA0'},
  {kind:'pwm',example:'nucleo-f103rb:pwm',label:'PWM 调光样例 · PB4 外接灯',source:'PWM C 源码',pin:'PB4'}
 ]:stm32?[
  {kind:'blink',example:'onboard',label:'点灯样例 · PC13 板载灯闪烁',source:'点灯 C 源码'},
  {kind:'button',example:'button',label:'按键样例 · PB1 控制 PA0 外接灯',source:'按键 C 源码'},
  {kind:'adc',example:'adc',label:'模拟输入样例 · PA1 电位器与串口',source:'ADC C 源码'},
  {kind:'pwm',example:'pwm',label:'PWM 调光样例 · PA0 外接灯',source:'PWM C 源码'}
 ]:[
  {kind:'blink',example:target.id+':blink',label:'点灯样例 · D13 每半秒切换',source:'点灯 C 源码'},
  {kind:'button',example:target.id+':button',label:'按键样例 · D2 控制 D13',source:'按键 C 源码'},
  {kind:'adc',example:target.id+':adc',label:'模拟输入样例 · 旋钮 A0、D13 和串口',source:'ADC C 源码'}
 ];
 const temperatureLesson=temperatureLessonFor(target.id);
 if(temperatureLesson)samples.push(...temperatureAlarmFirmware.variants.map(([kind,label])=>({kind,example:temperatureLesson,
  label:`I²C 温度报警 · ${label} 阈值`,source:'温度报警 C 源码',sourceFile:temperatureAlarmFirmware.file,pin:stm32?'PA0':'D12'})));
 if(target.id==='bluepill')samples.push(...temperatureDisplayFirmware.variants.map(([kind,label])=>({kind,example:stm32TemperatureDisplayLessonId,
  label:`I²C 温度显示 · ${label}`,source:'温度显示 C 源码',sourceFile:temperatureDisplayFirmware.file,pin:'PB7'})));
 const sampleSources=new Map(samples.map(sample=>[sample.sourceFile??sample.kind,sample.source]));
 modal(target.name+' 原生固件', `<p>导入为 <strong>${esc(firmwareTargetName(target))}</strong> 编译的 ${formats} 应用固件，或打开下面的样例。${stm32?'BIN 从 0x08000000 写入，启动前请将 BOOT0 设为 0。':pico?'请选择单独为经典 Pico 编译的 Flash UF2。':'HEX 文件本身没有芯片型号，请核对编译目标。'}</p>
 <div class="firmware-choices">
 <button type="button" class="button primary" id="pickFirmware" autofocus>选择 ${formats} 文件</button>
 ${stm32?'<button type="button" class="button" id="createNativeCProject">新建本地 C 工程</button>':''}
 ${nucleo?'<button type="button" class="button" id="openNativeButtonLesson">B1 与 LD2 · 多文件 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativeEncoderLesson">旋钮与 A/B 相 · 原生 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativeJoystickLesson">双轴摇杆与死区 · 原生 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativeRgbLedLesson">RGB 三色灯与 PWM · 原生 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativeServoLesson">旋钮控制 HS-55 舵机 · 原生 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativeRelayLesson">继电器与短脉冲 · 原生 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativeDipSwitchLesson">四位拨码开关 · 原生 C</button>':''}
 ${target.id==='bluepill'?'<button type="button" class="button" id="openNativePhotoresistorLesson">光敏夜灯 · ADC 原生 C</button>':''}
 ${loadedFirmware&&!nativeMode()?'<button type="button" class="button" id="resumeFirmware">启用已保存的固件</button>':''}
 ${samples.map(sample=>`<button type="button" class="button" data-firmware-sample="${sample.kind}">${sample.label}</button>`).join('')}
 </div>
 <p>样例会打开这块板的对应实验，已有草稿会继续使用草稿接线。${nucleo?'运行按键样例后，按住板上蓝色 B1，观察绿色 LD2。模拟输入用 PA0 读电位器，调光用 PB4 驱动外接灯。':stm32?'模拟输入用 PA1 读取电位器，PWM 样例用 PA0 切换灯的亮度。':pico?'模拟输入用 GP26 读取电位器，PWM 样例用 GP15 切换灯的亮度。':'模拟输入样例把电位器接到 5 V、A0 和 GND，读数过半时 D13 点亮。'}</p>
 <p>样例源码可下载查看。 ${[...sampleSources].map(([file,label])=>`<a href="${examplesRoot}/${file}.c" download>${label}</a>`).join(' · ')}</p>
 <p id="firmwareMenuStatus" role="status"></p>`);
 $('#pickFirmware').onclick=()=>{const picker=$('#firmwareInput');picker.accept=stm32?'.hex,.bin':'.'+ext;picker.click();};
 if($('#createNativeCProject'))$('#createNativeCProject').onclick=event=>createNativeCProject(target,event.currentTarget);
 if($('#openNativeButtonLesson'))$('#openNativeButtonLesson').onclick=()=>{$('#modal').close();loadExample(stm32NativeButtonLessonId);$('#openNativeDraft').click();};
 if($('#openNativeEncoderLesson'))$('#openNativeEncoderLesson').onclick=()=>{
  $('#modal').close();if(example.id!==encoderLessonId)loadExample(encoderLessonId);$('#openNativeDraft').click();
 };
 if($('#openNativeJoystickLesson'))$('#openNativeJoystickLesson').onclick=()=>{
  $('#modal').close();if(example.id!==joystickLessonId)loadExample(joystickLessonId);$('#openNativeDraft').click();
 };
 if($('#openNativeRgbLedLesson'))$('#openNativeRgbLedLesson').onclick=()=>{
  $('#modal').close();if(example.id!==rgbLedLessonId)loadExample(rgbLedLessonId);$('#openNativeDraft').click();
 };
 if($('#openNativeServoLesson'))$('#openNativeServoLesson').onclick=()=>{
  $('#modal').close();if(example.id!==servoNativeLessonId)loadExample(servoNativeLessonId);$('#openNativeDraft').click();
 };
 if($('#openNativeRelayLesson'))$('#openNativeRelayLesson').onclick=()=>{
  $('#modal').close();if(example.id!==relayNativeLessonId)loadExample(relayNativeLessonId);$('#openNativeDraft').click();
 };
 if($('#openNativeDipSwitchLesson'))$('#openNativeDipSwitchLesson').onclick=()=>{
  $('#modal').close();if(example.id!==dipSwitchLessonId)loadExample(dipSwitchLessonId);$('#openNativeDraft').click();
 };
 if($('#openNativePhotoresistorLesson'))$('#openNativePhotoresistorLesson').onclick=()=>{
  $('#modal').close();if(example.id!==photoresistorLessonId)loadExample(photoresistorLessonId);$('#openNativeDraft').click();
 };
 if($('#resumeFirmware'))$('#resumeFirmware').onclick=()=>{$('#modal').close();setNativeFirmware({...loadedFirmware,active:true});};
 $$('[data-firmware-sample]').forEach(button=>button.onclick=async()=>{
  const kind=button.dataset.firmwareSample,status=$('#firmwareMenuStatus');
  const sample=samples.find(item=>item.kind===kind);
  const choices=$$('.firmware-choices button');
  choices.forEach(choice=>choice.disabled=true);
  status.textContent='正在读取样例固件…';
  try{
   const next=await readBuiltInFirmware(examplesRoot,kind,ext,target);
   if(!status.isConnected||!$('#modal').open)return;
   $('#modal').close();
   if(example.id!==sample.example)loadExample(sample.example);
   setNativeFirmware(next);
   if(sample.pin){wavePin=sample.pin;$('#wavePinSelect').value=wavePin;renderMonitor();}
   toast(nucleo&&kind==='button'?'点击运行，再按住板上的 B1，观察 LD2。':kind==='adc'?'已载入样例。运行后转动电位器，查看 ADC 读数。'
    :kind==='pwm'?'已载入样例。运行后观察 LED 亮度和 PWM 占空比。':temperatureFirmwareFor(sample.example)?'已载入温度固件。运行后可调温并查看 I²C 读写记录。':'已载入样例。点击运行，观察灯和引脚电压。');
  }catch(error){if(status.isConnected)status.textContent=error.message||String(error);}
  finally{choices.forEach(choice=>choice.disabled=false);}
 });
}
async function reviewNativeFile(file){
 const request=++firmwareReviewRequest,originExample=example.id,wasOpen=$('#modal').open;
 const isCurrent=()=>request===firmwareReviewRequest&&example.id===originExample&&(!wasOpen||$('#modal').open);
 const ext=firmwareExtension(file.name),binary=ext==='bin',pico=ext==='uf2';
 try{
  const supported=BOARD_PROFILE_LIST.filter(profile=>profile.capabilities.nativeFirmware
   && (pico?isRp2040Native(profile):binary?isStm32Native(profile):!isRp2040Native(profile)));
  const largest=binary?supported.reduce((max,profile)=>!max||profile.flashBytes>max.flashBytes?profile:max,null):null;
  const limit=pico?RP2040_UF2_MAX_BYTES:binary?largest.flashBytes:AVR_HEX_MAX_CHARS;
  if(file.size>limit)throw Error('固件文件超过 '+(binary?limit/1024+' KiB':'4 MiB')+'，无法载入。');
  const original=board(),defaultTarget=supported.find(profile=>profile.id===original.id)||supported[0];
  const payload=await readFirmwarePayload(file,ext,largest?.id);
  if(!isCurrent())return;
  const raw={name:file.name,...payload,active:true};
  const checked=new Map();
  function inspect(profile){
   if(!checked.has(profile.mcu)){
    try{
     const firmware=validateFirmware(raw,profile);
     checked.set(profile.mcu,{firmware,image:parseFirmwareImage(firmware,profile)});
    }catch(error){checked.set(profile.mcu,{issue:error.message||String(error)});}
   }
   return checked.get(profile.mcu);
  }
  const compatible=supported.map(inspect).find(item=>item.image);
  if(!compatible)throw Error(inspect(defaultTarget).issue);
  const {firmware,image}=compatible;
  const size=image.byteCount.toLocaleString('zh-CN');
  const top=formatFirmwareAddress(image.highestAddress);
  if($('#modal').open)$('#modal').close();
  modal('核对要运行的固件', `<p><strong>${esc(firmware.name)}</strong> · ${size} 字节写入 Flash · 最高地址 ${top}</p>
  <label class="firmware-target-field" for="firmwareBoardSelect">目标开发板<select id="firmwareBoardSelect">${supported.map(profile=>`<option value="${esc(profile.id)}">${esc(firmwareTargetName(profile))}</option>`).join('')}</select></label>
  <p id="firmwareTargetNote" role="status"></p><p>文件结构已检查。请选择编译时使用的板型。</p>
  <div class="project-actions"><button type="button" class="button" id="cancelFirmwareReview" autofocus>取消</button><button type="button" class="button primary" id="applyFirmwareReview">加载固件</button></div>`);
  const select=$('#firmwareBoardSelect'),apply=$('#applyFirmwareReview');
  select.value=defaultTarget.id;
  const target=()=>supported.find(profile=>profile.id===select.value);
  const updateTarget=()=>{
   const profile=target(),{issue}=inspect(profile);
   const same=profile.id===original.id;
   $('#firmwareTargetNote').textContent=issue||(same?'当前源码和接线会保留。':'应用后会保留当前草稿，并打开所选板型的实验。');
   apply.disabled=Boolean(issue);
   apply.textContent=same?'加载固件':'切换开发板并加载';
  };
  select.onchange=updateTarget;updateTarget();
  $('#cancelFirmwareReview').onclick=()=>$('#modal').close();
  apply.onclick=()=>{
   if(apply.disabled)return;
   const profile=target(),selected=inspect(profile);
   $('#modal').close();
   if(profile.id!==board().id)selectBoard(profile.id);
   setNativeFirmware(selected.firmware);
   toast('已加载固件，点击运行或单步。');
  };
 }catch(error){
  if(!isCurrent())return;
  if($('#modal').open)$('#modal').close();
  modal('这份固件无法载入',`<p>${esc(error.message||error)}</p><p>当前工程和已载入的固件已保留。</p><button type="button" class="button" id="retryFirmware" autofocus>重新选择固件</button>`);
  $('#retryFirmware').onclick=()=>{const picker=$('#firmwareInput');picker.accept='.hex,.bin,.uf2';picker.click();};
 }
}
$('#firmwareModeButton').onclick=showFirmwareMenu;
$('#firmwareChange').onclick=showFirmwareMenu;
$('#firmwareInput').onchange=event=>{const [file]=event.target.files;event.target.value='';if(file)reviewNativeFile(file);};
$('#firmwareExit').onclick=()=>{setNativeFirmware({...loadedFirmware,active:false});toast(example.nativeOnly?'已停止固件。可再次运行样例，或从原生固件菜单重新启用。':'已返回源码。固件仍可从原生固件菜单启用。');};
$('#firmwareDownload').onclick=()=>{
 const ext=firmwareExtension(loadedFirmware.name);
 const data=ext==='uf2'?firmwareImage.bytes:ext==='bin'
  ?firmwareImage.flash.subarray(0,firmwareImage.highestAddress-STM32_FLASH_BASE+1):loadedFirmware.hex;
 download(loadedFirmware.name,new Blob([data],{type:ext==='hex'?'text/plain':'application/octet-stream'}));
};
$('#exportCodeButton').onclick=async()=>{const zip=new JSZip();Object.entries(files).forEach(([name,text])=>zip.file(name,text));zip.file('README_运行说明.txt','STM32 实物实验室导出的 C 源码\n\n这是仿真学习源码，采用标准外设库风格。\n在本平台导入 .c/.h 或整个 ZIP 可运行支持范围内的示例。\n烧录到实体开发板还需要匹配的启动文件、系统时钟设置、ST标准外设库、真实Delay实现、链接配置及正确接线。\n可返回源码模式继续使用标准库教学示例。Blue Pill 和 NUCLEO-F103RB 原生固件入口支持按 0x08000000 链接的 HEX 或 BIN。\n');download('STM32_'+example.id+'_源码.zip',await zip.generateAsync({type:'blob'}));};
$('#importButton').onclick=()=>{cancelNativeDraftCompile();pause();$('#fileInput').click();};
function refreshWorkspaceView(){sourceTraceSignal='pin';trackedLedId=null;clearVoltageProbes({close:true});clearBoardHolePicker();clearPartPlacement();selected=null;selectedWire=null;selectedPin=null;selectedParts.clear();lastPartRemoval=null;setObjectPopover(null);undoStack=[];redoStack=[];updateUndoButtons();syncBoardUI();$('#powerSwitch').checked=!!circuit.powered;$('#bootSwitch').checked=!!circuit.boot0;resetRuntime();renderFiles();loadEditor();workbench?.setCircuit(circuit);workbench?.home();refresh();save();scheduleCheck();}
function applyImportedWorkspace(next){
 const prepared={example:clone(next.example),files:clone(next.files),circuit:clone(next.circuit),activeFile:next.activeFile,loadedFirmware:next.loadedFirmware,bom:normalizeBOM(next.bom||[],BOARD_CATALOG,COMPONENT_CATALOG)};
 const before={example,files,circuit,activeFile,loadedFirmware,bom:catalog.getBOM(),drafts:clone(drafts),boardLastExamples:clone(boardLastExamples)};pause();
 try{example=prepared.example;files=prepared.files;circuit=prepared.circuit;activeFile=prepared.activeFile;loadedFirmware=prepared.loadedFirmware;catalog.setBOM(prepared.bom);if(isImportedExample(example.id))snapshotDraft();refreshWorkspaceView();}
 catch(err){example=before.example;files=before.files;circuit=before.circuit;activeFile=before.activeFile;loadedFirmware=before.loadedFirmware;drafts=before.drafts;boardLastExamples=before.boardLastExamples;try{catalog.setBOM(before.bom);refreshWorkspaceView();}catch{}throw err;}
}
$('#undoImportButton').onclick=()=>{if(!lastImportBackup)return;snapshotDraft();const previous=lastImportBackup;lastImportBackup=null;applyImportedWorkspace(previous);$('#undoImportButton').hidden=true;toast('已回到导入前的工程；刚才导入的草稿也已保留。');};
$('#fileInput').onchange=async e=>{
 const incoming=[...e.target.files];e.target.value='';if(!incoming.length)return;
 if(incoming.length===1&&/\.(hex|bin|uf2)$/i.test(incoming[0].name))return reviewNativeFile(incoming[0]);
 try{
  const prepared=await readImportSelection(incoming,{loadZip:f=>JSZip.loadAsync(f)}),p=prepared.project;
  const nextCircuit=p?p.circuit:clone(circuit),nextFiles=p?p.files:prepared.files,known=p&&p.exampleMeta.execution!=='stm32-c'&&examples.find(x=>x.id===p.exampleId&&x.boardId===nextCircuit.boardId);
  const meta=p?.exampleMeta||{title:'自有工程 · '+prepared.origin,shortTitle:'导入工程',description:'你的用户源码，请按当前板型核对接线。'};
  const next={files:nextFiles,circuit:nextCircuit,loadedFirmware:firmwareFromProject(p),activeFile:p?.activeFile||Object.keys(nextFiles).find(f=>/(^|\/)main\.c$/i.test(f))||Object.keys(nextFiles)[0],example:known||{...meta,...importedNativeOptions(meta),id:'imported:'+nextCircuit.boardId+':'+Date.now().toString(36),boardId:nextCircuit.boardId,imported:true},bom:normalizeBOM(p?p.bom:catalog.getBOM(),BOARD_CATALOG,COMPONENT_CATALOG)};
  const profile=getBoardProfile(nextCircuit.boardId),names=Object.keys(nextFiles),managed=names.filter(f=>replacedFile.test(f.split('/').pop()));
  modal('工程已检查，可以导入','<div class="import-review"><div class="import-summary"><span><small>目标开发板</small><strong>'+esc(profile.name)+'</strong></span><span><small>源文件</small><strong>'+names.length+' 个</strong></span><span><small>接线</small><strong>'+nextCircuit.wires.length+' 根</strong></span></div><p>'+(p?'本次将恢复工程中的板型、代码、元件参数与接线。'+(next.loadedFirmware?' 同时恢复已保存的原生固件。':''):'本次仅导入源码，保留当前 '+esc(profile.name)+' 的元件与接线；请核对程序所用引脚。')+'</p><details open><summary>查看文件清单</summary><ul class="import-file-list">'+names.map(n=>'<li><code>'+esc(n)+'</code><span>'+nextFiles[n].split('\n').length+' 行</span></li>').join('')+'</ul></details>'+(prepared.warnings.length?'<div class="import-notes"><h3>读取说明</h3><ul>'+prepared.warnings.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>':'')+(managed.length?'<details><summary>'+managed.length+' 个标准库实现由行为兼容层代管</summary><p>'+esc(managed.join('、'))+'</p><p>文件保留供阅读与导出，未实现的 API 仍会明确提示。</p></details>':'')+'<p class="import-footnote">结构检查已通过，语法与行为需要进入实验台后运行验证。应用后可用“撤回导入”回到当前工程。</p><div class="project-actions"><button class="button" id="cancelImportReview">取消</button><button class="button primary" id="applyImportReview">应用到实验台 →</button></div></div>');
  $('#cancelImportReview').onclick=()=>$('#modal').close();
  $('#applyImportReview').onclick=()=>{lastImportBackup={example:clone(example),files:clone(files),circuit:snapshotCircuit(),activeFile,loadedFirmware,bom:catalog.getBOM()};snapshotDraft();try{applyImportedWorkspace(next);$('#undoImportButton').hidden=false;$('#modal').close();go('lab');toast('已导入 '+names.length+' 个文件。先核对接线，再点击运行。');}catch(err){lastImportBackup=null;modal('导入未完成，已恢复原工程','<p>'+esc(err.message||String(err))+'</p><p>原代码与接线已恢复。请修正文件后重试。</p>');}};
 }catch(err){modal('这份工程还不能直接导入','<div class="import-error"><h3>当前工程已保留</h3><p>'+esc(err.message||String(err))+'</p><p>修正这一项后重试。你也可以只选择当前实验的用户源文件。</p><button class="button" id="retryImport">重新选择文件</button></div>');$('#retryImport').onclick=()=>{$('#modal').close();$('#fileInput').click();};}
};

function showScope(){modal('这座实验台的能力范围','<div class="scope-list"><div><h3>可以直接操作</h3><ul><li>'+BOARD_PROFILE_LIST.length+' 款板卡的引脚、电平与基础外设行为模型。</li><li>'+Object.keys(PARTS).length+' 类电气元件模型；商城会区分可仿真与资料型。</li><li>F103标准外设库子集，以及Arduino风格 setup / loop / GPIO / ADC / PWM / 串口。</li><li>UNO R3、经典 Nano 和 Mega 2560 的 Arduino 源码可用 Wire 写入 SSD1306，并读取 MCP9808。模型按接线与地址处理应答。</li><li>多文件编辑、逐行白话、语法检查、补全、运行和单步。</li><li>Blue Pill 与 NUCLEO-F103RB 原生固件支持 GPIO、单通道 ADC1、基础 PWM、SysTick 中断、字节控制台和 I²C1 7 位主机轮询。I²C1 使用 PB6、PB7 的默认引脚。NUCLEO-F103RB 支持板载 B1 与 LD2，并可查看 USART2。UNO R3、经典 Nano 和 Mega 2560 原生固件支持 GPIO、单次 ADC 转换、定时器、串口控制台与主机 TWI，可通过仿真接线读 MCP9808 或写 SSD1306。</li><li>代码与接线一起保存；电路操作支持撤销、重做。</li></ul></div><div><h3>需要回到实际工具验证</h3><ul><li>Blue Pill 和 NUCLEO-F103RB 可运行各自的 Cortex-M3 应用 HEX/BIN。UNO R3、经典 Nano 和 Mega 2560 可运行 AVR 应用 HEX。经典 Raspberry Pi Pico 可运行 RP2040 应用 UF2，覆盖单核 GPIO、模拟输入、边沿对齐 PWM 和 UART0 字节终端。ELF 请先转换为对应固件。</li><li>真实中断、DMA、I²C/SPI、Wi-Fi、USB等按每张卡片的支持范围判断；目录收录不代表已实现仿真。</li><li>虚拟时间、简化模拟元件和外观模型不等同于真机时序、热损坏、EMC或制板尺寸。</li><li>实时检查不等于逻辑一定正确；仍需运行、测量并与实物对照。</li><li>IDE导出会附依赖、工具链与接入步骤；未在你的电脑或Keil中编译烧录。</li></ul></div></div><h3>编辑与接线</h3><p>Ctrl / ⌘ + Enter 运行；Ctrl + Space 补全；Tab 接受建议。输入后自动显示白话与检查结果。默认双击起点引脚、再单击终点。主动切到「接线」可直接点两端或拖拽。元件可直接拖动，选中后用方向键微移、R 旋转。点「取消接线」或按 Esc 可清除待接线状态。</p><h3>保存</h3><p>项目留在当前浏览器。换设备前请用“保存工程”导出JSON，代码、板型、元件、接线和备料清单都会包含在内。源码不会发送到外部编译服务。</p>');}
for(const id of ['helpButton','scopeButton','faultScopeButton','footerScope'])$('#'+id).onclick=showScope;
function renderGlossary(){const q=$('#glossarySearch').value.trim().toLowerCase();const matched=glossary.filter(g=>JSON.stringify(g).toLowerCase().includes(q));$('#glossaryResults').textContent='找到 '+matched.length+' 条术语';$('#glossaryClear').hidden=!$('#glossarySearch').value;$('#glossaryList').innerHTML=matched.length?matched.map(g=>'<article class="glossary-card"><h3>'+esc(g.name)+'</h3><div class="plain">'+esc(g.plain)+'</div><pre>'+esc(g.signature||g.example)+'</pre><details class="details"><summary>专业说法与类比边界</summary><p>'+esc(g.technical)+'</p><p>'+esc(g.analogy||'')+'</p></details><p class="gotcha">最容易误解：'+esc(g.gotcha||'')+'</p><p>例子</p><pre>'+esc(g.example||'')+'</pre></article>').join(''):'<div class="empty-state">暂未收录这个名称。导入代码运行时，未知函数会明确报错。</div>';}
$('#glossarySearch').oninput=renderGlossary;
$('#glossaryClear').onclick=()=>{
 const search=$('#glossarySearch');search.value='';renderGlossary();search.focus();
};
function renderFaults(){const q=$('#faultSearch').value.trim().toLowerCase(),cat=$('#faultCategory').value;const filtered=faultCatalog.filter(f=>(cat==='all'||f.category===cat)&&JSON.stringify(f).toLowerCase().includes(q));$('#faultResults').textContent='找到 '+filtered.length+' 条排查资料';$('#faultClear').hidden=!$('#faultSearch').value&&cat==='all';$('#faultList').innerHTML=filtered.length?filtered.map(f=>'<article class="fault-card"><span class="category-tag">'+esc(f.category)+'</span><span class="detect-tag">'+(f.detectable?'当前可自动检测':'人工排查知识')+'</span><h3>'+esc(f.title)+'</h3><p>'+esc(f.plain)+'</p>'+(f.detectable&&f.detectionScope?'<p class="detection-scope">当前检测条件：'+esc(f.detectionScope)+'</p>':'')+'<details class="details"><summary>为什么会这样</summary><p>'+esc(f.why)+'</p><p>'+esc(f.technical)+'</p></details><ol>'+f.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></article>').join(''):'<div class="empty-state">暂未找到这类问题。可以换一个现象关键词搜索。</div>';}
$('#faultCategory').innerHTML='<option value="all">全部类别</option>'+[...new Set(faultCatalog.map(f=>f.category))].map(c=>'<option>'+esc(c)+'</option>').join('');$('#faultSearch').oninput=renderFaults;$('#faultCategory').onchange=renderFaults;
$('#faultClear').onclick=()=>{
 const search=$('#faultSearch');search.value='';$('#faultCategory').value='all';renderFaults();search.focus();
};
function showLesson(id){
 const lesson=document.getElementById('lesson-'+id);
 if(!lesson)return;
 const heading=lesson.querySelector('h2');
 heading.tabIndex=-1;heading.focus({preventScroll:true});lesson.scrollIntoView({block:'start'});
}
function renderLessons(){$('#lessonQuickNav').innerHTML=lessons.map((l,i)=>'<button data-lesson-jump="'+esc(l.id)+'"><b>'+String(i+1).padStart(2,'0')+'</b>'+esc(l.title)+'</button>').join('');$$('[data-lesson-jump]').forEach(b=>b.onclick=()=>showLesson(b.dataset.lessonJump));$('#lessonsList').innerHTML=lessons.map((l,i)=>'<article class="lesson-card" id="lesson-'+esc(l.id)+'"><span class="lesson-number">LESSON '+String(i+1).padStart(2,'0')+' / 两个知识点</span><h2>'+esc(l.title)+'</h2><p>'+esc(l.intro)+'</p><div class="lesson-columns">'+(l.concepts||[]).map(c=>'<div><h3>'+esc(c.title)+'</h3><p>'+esc(c.plain)+'</p><div class="code-quote">'+esc(c.example||'')+'</div><details class="details"><summary>专业版</summary><p>'+esc(c.technical)+'</p></details></div>').join('')+'</div><h3>把白话和术语对上</h3><p>'+(l.termMap||[]).map(([a,b])=>esc(a)+' → <strong>'+esc(b)+'</strong>').join('　/　')+'</p><p class="gotcha">容易误解：'+esc(l.commonMisunderstanding)+'</p><div class="quiz-card"><strong style="font-size:12px">先自己说一遍，再看解释</strong>'+(l.checks||[]).map((c,j)=>'<p>'+(j+1)+'. '+esc(c.question)+'</p><details><summary>看解释</summary><p class="quiz-answer">'+esc(c.answer)+'</p></details>').join('')+'</div><button class="button primary" data-lesson-example="'+esc(l.exampleId||'blink')+'">到实验台验证 →</button></article>').join('');$$('[data-lesson-example]').forEach(b=>b.onclick=()=>openVerificationExample(b.dataset.lessonExample));}
$('#lessonButton').onclick=()=>nativeMode()&&!example.nativeOnly?showFirmwareMenu():showExperimentCard();
function editorBoardContext(){const p=board();const resolution=/analogReadResolution\s*\(\s*(\d+)/.exec(Object.values(files).join('\n'));return {...p,adcMax:isArduino()?2**(resolution?Number(resolution[1]):p.adcDefaultBits)-1:p.adcMax};}
editorAssistant=createEditorAssistant({textarea:$('#codeEditor'),annotations:$('#lineAnnotations'),popup:$('#completionPopup'),hint:$('#lineHint'),getContext:()=>({language:isArduino()?'arduino':'spl',pins:board().gpioPins||[],board:editorBoardContext()}),explain,onRun:()=>sourcePending?applySourceDraft():toggleRun()});
editorTools=mountEditorTools({textarea:$('#codeEditor'),host:$('#editorUtilityBar'),lineHeight:22,onOpen:()=>editorAssistant?.close(),onNavigate:()=>{cursorChanged();editorAssistant?.updateHint();}});
$('#completeButton').onclick=()=>{ $('#codeEditor').focus();editorAssistant.showCompletions();};
$('#annotationsButton').onclick=()=>{const hide=$('.editor-panel').classList.toggle('no-annotations');$('#annotationsButton').classList.toggle('active',!hide);$('#annotationsButton').setAttribute('aria-pressed',String(!hide));};
$('#inspectorToggle').onclick=()=>{$('#inspectorPanel').classList.toggle('collapsed');setTimeout(()=>workbench?.resize(),20);};$('#monitorToggle').onclick=()=>{$('.monitor-panel').classList.toggle('collapsed');drawWave();};
catalog=createCatalog({onBoard:selectBoard,onPart:addPart,onChange:save,initialBOM:persisted?.bom||[],modal,toast,getBoardId:()=>circuit.boardId||'bluepill'});
renderFiles();loadEditor();renderGlossary();renderFaults();renderLessons();
function setSceneCameraMode(next,focus=false){
 const is3d=workbench?.getView()==='3d';
 const previous=sceneCameraMode;
 sceneCameraMode=next==='orbit'&&!is3d?'edit':next;
 workbench?.setCameraMode?.(sceneCameraMode);
 for(const [id,action] of [['#scenePanView','pan'],['#sceneOrbitView','orbit']]){
  const button=$(id);
  if(!button)continue;
  button.hidden=action==='orbit'&&!is3d;
  const active=action===sceneCameraMode;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 }
 $('#scene').dataset.cameraMode=sceneCameraMode;
 if(previous!==sceneCameraMode)renderSceneObjects();
 if(focus)focusSceneCanvas();
}
function showSceneView(actual,fallback=false){
 const scene=$('#scene');scene.dataset.activeView=actual;
 for(const button of $$('[data-scene-view]')){const active=button.dataset.sceneView===actual;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 setSceneCameraMode(sceneCameraMode);
 const notice=$('#sceneRenderNotice');notice.hidden=!fallback;
 notice.textContent=fallback?'三维画面当前不可用。你可以在二维接线图继续编辑，或点击 3D 实验台重试。':'';
}
try{workbench=createWorkbench($('#scene'),{
 onViewChange:showSceneView,
 onCameraExit:()=>setSceneCameraMode('edit'),
 onConnectionPending:active=>{$('#cancelWireButton').hidden=!active;renderPinMeasurement();},
 onInspectPin:inspectScenePin,onSelect:selectScenePart,onPartContext:openPartContext,onPickCandidates:showPickCandidates,
 isProbePicking:()=>probePick,onProbePin:assignProbeEndpoint,onCancelProbe:cancelProbePicking,
 onBoardReset:resetBoardHardware,
 onPotAdjust:adjustPotentiometer,
 onEncoderTurn:turnEncoder,
 onJoystickMove:moveJoystick,
 onDipSwitch:toggleDipSwitch,
 onPhotocellCover:togglePhotoresistorCover,
 onButton:(id,pressed)=>{
  if(id===board().userButton?.id)return setBoardUserButton(pressed);
  const p=circuit.components.find(p=>p.id===id);
  if(p?.type==='button')actuateButton(p,pressed);
 },
 onMove:moveSceneItem,onBoardDrag:previewBoardDrop,onBoardDragEnd:clearBoardDropPreview,onBoardDrop:dropBoard,
 onRotateBoard:step=>{clearBoardHolePicker();return rotateBoard(step);},onBoardStep:stepSeatedBoard,
 onBoardHoleHover:hoverBoardHole,onBoardHoleChoose:chooseBoardHole,onBoardHoleCancel:()=>clearBoardHolePicker(true),
 isPartPlacing,onPartPlacementPin:choosePartPlacementPin,
 onPartPlacementDrag:dragPartPlacement,
 onPartPlacementDrop:(id,x,z)=>dragPartPlacement(id,x,z,true),
 onPartPlacementDragCancel:id=>{if(isPartPlacing(id))showPartPlacement();},
 onPartPlacementRotate:rotateMountedPart,
 getWireSocketIssue:wireSocketIssue,
 onRotate:(id,degrees)=>{const p=circuit.components.find(p=>p.id===id);if(p&&!p.locked&&!p.mount&&p.rotation!==degrees){if(selectedParts.has(id))editSceneParts('rotate',degrees-(p.rotation||0));else{pushUndo();p.rotation=degrees;finishSceneEdit();}}},
 onConnect:(a,b)=>{connect(a,b);selectedPin=null;$('#cancelWireButton').hidden=true;},
 onWireSelect:selectSceneWire,onDeleteWire:deleteWire,
 onReconnectWire:(id,end,endpoint)=>{
   const wire=circuit.wires.find(w=>w.id===id);
   if (!wire || !['a','b'].includes(end) || wire[end]===endpoint) return;
   const issue=wireSocketIssue(endpoint,id);
   if (issue) return toast(issue);
   pushUndo();wire[end]=endpoint;finishSceneEdit();toast('已重新连接导线。');
 },
 onWire:selectSceneWire
 });workbench.setCircuit(circuit);$('#sceneLoading')?.remove();const query=new URLSearchParams(location.search);showSceneView(workbench.getView(),workbench.getView()!=='3d'&&query.get('view')!=='2d'&&!query.has('force2d'));}catch(e){$('#scene').innerHTML='<div class="model-error"><strong>实验台暂时未能启动</strong>请刷新页面；你仍可使用接线表和代码编辑器。<br><small>'+esc(e.message)+'</small></div>';}
$$('[data-scene-view]').forEach(b=>b.onclick=()=>{const actual=workbench?.setView?.(b.dataset.sceneView);if(actual)showSceneView(actual,actual!==b.dataset.sceneView);});
$('#sceneViewBoard')?.addEventListener('click',()=>workbench?.focusBoard?.());
for(const [id,action] of [['#scenePanView','pan'],['#sceneOrbitView','orbit']]){
 $(id)?.addEventListener('click',()=>{
  const next=sceneCameraMode===action?'edit':action;
  setSceneCameraMode(next,next!=='edit');
 });
}
$('#snapPartButton').onclick=event=>{const button=event.currentTarget,enabled=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(enabled));workbench?.setSnapEnabled(enabled);toast(enabled?'孔位吸附已开启。拖到孔位附近会对齐，接线需手动确认。':'孔位吸附已关闭，可以自由摆放元件。');};
let resourceLibrary=null;
async function loadResourceLibrary(){try{const response=await fetch('./resources.json');if(!response.ok)throw Error('HTTP '+response.status);const base=await response.json();resources=[...base,...EXTRA_RESOURCES];resourceLibrary?.destroy();resourceLibrary=mountResourceLibrary($('#page-library'),resources,{onNavigate:go,onStartExample:openVerificationExample});syncMobileLibrary();}catch(err){$('#page-library').innerHTML='<div class="resource-load-error"><h1>资料库暂时没有载入</h1><p>实验台和代码仍可使用。请点击重试重新读取资料索引。</p><button class="button primary" id="retryResources">重新载入</button></div>';$('#retryResources').onclick=loadResourceLibrary;}}
loadResourceLibrary();
updateUndoButtons();refresh();syncHashPage();window.addEventListener('resize',()=>{workbench?.resize();drawWave();});window.addEventListener('beforeunload',()=>{try{localStorage.setItem(STORAGE,JSON.stringify(savedWorkspace()));}catch{}});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();cancelProbePicking();clearBoardHolePicker();clearPartPlacement();cancelPendingConnection();}});
// Read-only inspection surface for automated development checks. No code execution or credentials.
window.STM32Lab={getState:()=>({running,example:example.id,boardId:circuit.boardId||'bluepill',audience,execution:nativeMode()?(isStm32Native(board())?'stm32-firmware':isRp2040Native(board())?'rp2040-firmware':'avr-firmware'):'source',sourceHardware:nativeMode()?null:clone({...sourceHardwareSnapshot(),comparison:sourceComparison?{before:sourceComparison.before,after:sourceComparison.after}:null,traceComparison:sourceTraceComparison?.trace??null}),ledCurrentTrace:clone(sourceLedTraceSnapshot()),probeMeter:{...probeMeterSnapshot(),trace:clone(sourceProbeTraceSnapshot())},firmwareName:loadedFirmware?.name,files:clone(files),circuit:clone(circuit),runtime:runtime?.getState()||null,result:result?{parts:clone(result.parts),issues:clone(result.issues),netVoltages:clone(result.netVoltages)}:null}),getCapabilities:()=>({engine:'C source behavioral interpreter',nativeFirmwareBoards:BOARD_PROFILE_LIST.filter(profile=>profile.capabilities.nativeFirmware).map(profile=>profile.id),examples:examples.length,boards:BOARD_PROFILE_LIST.length,parts:Object.keys(PARTS),catalog:catalog?.counts,faultKnowledge:faultCatalog.length,automaticFaults:faultCatalog.filter(x=>x.detectable).length,lessons:lessons.length,terms:glossary.length})};

// Audience selection keeps the same engineering state; only guidance and density change.
function enterWorkspace(next){
 audience=next;document.body.dataset.audience=next;$('#entryScreen').hidden=true;$('#appFrame').hidden=false;$('#modeSwitchButton').innerHTML=next==='beginner'?'✦ 小白版 <span>切换</span>':'⌘ 专业版 <span>切换</span>';
 $('.editor-panel').classList.toggle('no-annotations',next==='pro');$('#annotationsButton').classList.toggle('active',next==='beginner');$('#annotationsButton').setAttribute('aria-pressed',String(next==='beginner'));$('#inspectorPanel').classList.toggle('collapsed',next==='pro'&&!selected);$('#beginnerGuide').hidden=false;
 go(currentPage);save();requestAnimationFrame(()=>{workbench?.resize();drawWave();editorAssistant?.refresh();});
}
$('#enterBeginner').onclick=()=>enterWorkspace('beginner');$('#enterPro').onclick=()=>enterWorkspace('pro');$('#modeSwitchButton').onclick=()=>{cancelNativeDraftCompile();pause();leaveWorkbench();catalog?.close();$('#entryScreen').hidden=false;$('#appFrame').hidden=true;endTour();};
$('#hideGuideButton').onclick=()=>$('#beginnerGuide').hidden=true;
function renderBeginnerGuide(){if(nativeMode()&&!example.nativeOnly){$('#guideTitle').textContent='运行 '+board().mcu+' 固件';$('#guideText').textContent='点击运行，再观察开发板和引脚电压。点单步可执行一条指令。';$('#lessonButton').textContent='原生固件 ↗';return;}const g=guidanceFor(example,board(),files),step=g.steps[guideStep];$('#guideTitle').textContent=step[0]+' · '+example.shortTitle;$('#guideText').textContent=step[1];$$('[data-guide-step]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.guideStep)===guideStep);b.setAttribute('aria-pressed',String(Number(b.dataset.guideStep)===guideStep));});$('#lessonButton').textContent='本次实验卡 ↗';}
$$('[data-guide-step]').forEach(b=>b.onclick=()=>{guideStep=Number(b.dataset.guideStep);renderBeginnerGuide();if(guideStep!==2)return;if(example.nativeOnly){$('#openNativeDraft').click();return;}if(!nativeMode()){const where=guidanceFor(example,board(),files).location;setMobilePane('editor');if(where)jumpLine(where.file,where.line);else $('#codeEditor').focus();}});
$('#reopenGuideButton').onclick=()=>{$('#beginnerGuide').hidden=false;guideStep=0;renderBeginnerGuide();};
function showExperimentCard(){
 const g=guidanceFor(example,board(),files),note=learningNotes[example.id]||{};
 modal(example.shortTitle+' · 本次实验卡','<div class="experiment-card"><div class="experiment-context"><span>'+esc(board().name)+'</span><span>'+esc(g.dialect)+'</span></div><h3>这次只抓住两点</h3><ol>'+g.concepts.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol><h3>把画面和接线对上</h3><ol>'+g.setup.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol><label class="prediction-label" for="experimentPrediction">先预测：'+esc(g.question)+'</label><textarea id="experimentPrediction" rows="3" placeholder="用你自己的话写一句；想错也没关系。">'+esc(note.prediction||'')+'</textarea><details class="reference-outcome"><summary>展开初始示例的参考现象</summary><p>'+esc(g.expected)+'</p><small>你修改代码或接线后，实际结果可能变化。这里是参考说明，不是当前程序的运行结论。</small></details><h3>现在动手验证</h3><p>'+esc(g.observe)+'</p><div class="experiment-actions"><button class="button primary" id="experimentObserve">去观察变化 →</button><button class="button" id="experimentLocate" '+(g.location?'':'disabled')+'>定位相关代码</button></div><label class="experiment-observed"><input type="checkbox" id="experimentObserved" '+(note.observed?'checked':'')+'>我已动手观察，并比较了预测与结果</label><p class="experiment-note">预测与勾选记录保存在当前浏览器；这是你的学习记录，不计作自动验证通过。</p><button class="text-button" id="experimentCourse">查看 STM32 标准库关联课程 →</button></div>');
 const keep=()=>{learningNotes[example.id]={prediction:$('#experimentPrediction').value.slice(0,2000),observed:$('#experimentObserved').checked};try{localStorage.setItem('physical-lab-learning-notes',JSON.stringify(learningNotes));}catch{}};$('#experimentPrediction').oninput=keep;$('#experimentObserved').onchange=keep;
 $('#experimentLocate').onclick=()=>{$('#modal').close();go('lab');setMobilePane('editor');jumpLine(g.location.file,g.location.line);};
 $('#experimentObserve').onclick=()=>{$('#modal').close();go('lab');const part=circuit.components.find(p=>p.type===g.target);if(part){focusDiagnosticPart(part.id);setMobilePane('scene');}else if(g.target==='serial'){setMobilePane('editor');$('.monitor-panel').classList.remove('collapsed');$('[data-monitor="serial"]').click();}else{setMobilePane('scene');selectScenePart('mcu');}toast('观察点已就位。点击运行，再比较你的预测。');};
 $('#experimentCourse').onclick=()=>{$('#modal').close();go('learn');const l=lessons.find(l=>l.exampleId===example.id)||lessons[0];showLesson(l.id);};
}
const compactWorkspace = matchMedia('(max-width: 760px), (max-width: 950px) and (max-height: 500px)');
const portraitTablet = matchMedia('(min-width: 761px) and (max-width: 900px) and (min-height: 501px)');
const mobileTabBar = $('.mobile-workspace-tabs');
const workspaceActions = $('.workspace-topbar .project-actions');
const projectMenu = document.createElement('details');
projectMenu.id = 'mobileProjectMenu';
projectMenu.hidden = true;
const projectMenuTitle = document.createElement('summary');
projectMenuTitle.textContent = '工程操作';
projectMenu.append(projectMenuTitle);
workspaceActions.before(projectMenu);

function syncMobileLibrary() {
 const library = $('#page-library .rl-shell');
 const browser = library?.querySelector('.rl-browser');
 if(!browser)return;
 if(compactWorkspace.matches&&library.firstElementChild!==browser)library.prepend(browser);
 else if(!compactWorkspace.matches&&browser.previousElementSibling!==library.querySelector('.rl-source-grid'))library.querySelector('.rl-source-grid').after(browser);
}
function updateMobileWorkspace() {
 const compact = compactWorkspace.matches;
 const active = document.activeElement;
 const run = $('#runButton');
 const scene = $('#scene');
 const readout = $('#pinReadout');
 const feedback = $('#sourceHardwareBar');
 const focused = compact && document.body.dataset.mobileFocus === 'true';
 if(compact) {
  if(run.parentElement!==mobileTabBar)$('#mobileFocusButton').before(run);
  if(workspaceActions.parentElement!==projectMenu)projectMenu.append(workspaceActions);
 } else {
  if(run.parentElement===mobileTabBar)$('.run-actions').prepend(run);
  if(workspaceActions.parentElement===projectMenu)projectMenu.after(workspaceActions);
 }
 if(compact||portraitTablet.matches){
  if(scene.previousElementSibling)scene.parentElement.prepend(scene,readout);
 } else if(scene.previousElementSibling!==$('#probePanel'))$('#probePanel').after(scene,readout);
 projectMenu.hidden=!compact;
 if(focused && feedback.previousElementSibling?.classList.contains('editor-panel')!==true)$('#editorStack > .editor-panel').after(feedback);
 if(!focused && feedback.previousElementSibling!==$('#firmwarePanel'))$('#firmwarePanel').after(feedback);
 syncMobileLibrary();
 if(active!==document.body && document.activeElement!==active && active?.getClientRects().length)active.focus({preventScroll:true});
 requestAnimationFrame(()=>{workbench?.resize();drawWave();});
}
function setMobilePane(pane){
 if(pane==='editor')leaveWorkbench();
 document.body.dataset.mobilePane=pane;
 $$('[data-mobile-pane]').forEach(button=>{
  const active=button.dataset.mobilePane===pane;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 requestAnimationFrame(()=>{workbench?.resize();drawWave();});
}
function revealMobileWorkspace(){
 const main=$('#mainContent');
 main.scrollTop=0;
 if(mobileTabBar.getBoundingClientRect().bottom>main.getBoundingClientRect().bottom)mobileTabBar.scrollIntoView({block:'start'});
}
function openVerificationExample(id){
 loadExample(id);go('lab');setMobilePane('scene');
 if(compactWorkspace.matches){
  revealMobileWorkspace();
  $('[data-mobile-pane="scene"]').focus({preventScroll:true});
 }
}
$$('[data-mobile-pane]').forEach(button=>button.onclick=()=>{
 setMobilePane(button.dataset.mobilePane);
 revealMobileWorkspace();
});
$('#mobileFocusButton').onclick=event=>{
 const focused=document.body.dataset.mobileFocus!=='true';
 document.body.dataset.mobileFocus=String(focused);
 event.currentTarget.setAttribute('aria-pressed',String(focused));
 event.currentTarget.textContent=focused?'退出专注':'专注';
 updateMobileWorkspace();
 revealMobileWorkspace();
};
compactWorkspace.addEventListener('change',updateMobileWorkspace);
portraitTablet.addEventListener('change',updateMobileWorkspace);
updateMobileWorkspace();
const divider=$('#workspaceDivider');let dividerStart=null;
function setSplit(value){const v=Math.max(35,Math.min(65,value));document.documentElement.style.setProperty('--scene-share',v+'%');divider.setAttribute('aria-valuenow',String(Math.round(v)));workbench?.resize();drawWave();}
divider.onpointerdown=e=>{dividerStart=$('#studioGrid').getBoundingClientRect();divider.setPointerCapture(e.pointerId);e.preventDefault();};divider.onpointermove=e=>{if(dividerStart)setSplit((e.clientX-dividerStart.left)/dividerStart.width*100);};divider.onpointerup=()=>dividerStart=null;divider.onpointercancel=()=>dividerStart=null;divider.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setSplit(Number(divider.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?2:-2));}};
const tourSteps=[
 {target:'#boardSelectButton',title:'从开发板与实验开始',text:'这里告诉你正在使用哪块板。点开发板打开目录；右侧实验菜单会跟着板卡切换，并提供已经接好的电路。'},
 {target:'#marketButton',title:'元件商城在侧面',text:'开发板、元件、备料清单分开排列。可以按型号、接口、用途搜索，再按支持范围筛选。详情里有引脚、使用指导和原始资料。'},
 {target:'#sceneStack',title:'像摆实物一样操作',text:'拖动元件摆放，选中后可用工具栏旋转。默认双击起点引脚，再单击终点。切到「接线」可直接点两端或拖线。未完成时点「取消接线」或按 Esc。'},
 {target:'#editorStack',title:'代码就在实验台旁边',text:'写完一行，白话说明会自动更新；停止输入后会检查语法。Ctrl + Space 查看补全，Tab填入。Ctrl / ⌘ + Enter运行，单步观察每一步。'},
 {target:'#ideExportButton',title:'把作品带到实际工具里',text:'保存工程保留代码与接线；导出到IDE会按板卡生成可接入的文件和依赖说明。真实编译、烧录由本机Keil、Arduino IDE或PlatformIO完成。'}
];let tourIndex=0;
function endTour(){$('#tourCard').hidden=true;$$('.tour-highlight').forEach(x=>x.classList.remove('tour-highlight'));}
function renderTour(){go('lab');$$('.tour-highlight').forEach(x=>x.classList.remove('tour-highlight'));const step=tourSteps[tourIndex];if(step.target==='#editorStack')setMobilePane('editor');else if(step.target==='#sceneStack')setMobilePane('scene');$(step.target)?.classList.add('tour-highlight');$('#tourProgress').textContent=String(tourIndex+1).padStart(2,'0')+' / '+tourSteps.length;$('#tourTitle').textContent=step.title;$('#tourText').textContent=step.text;$('#tourPrev').disabled=tourIndex===0;$('#tourNext').textContent=tourIndex===tourSteps.length-1?'开始动手 ✓':'下一步 →';$('#tourCard').hidden=false;}
function startTour(){tourIndex=0;renderTour();}$('#tourButton').onclick=startTour;$('#openGuideButton').onclick=startTour;$('#tourClose').onclick=endTour;$('#tourPrev').onclick=()=>{if(tourIndex>0){tourIndex--;renderTour();}};$('#tourNext').onclick=()=>{if(tourIndex===tourSteps.length-1)endTour();else{tourIndex++;renderTour();}};
function showIDEExport(){
 const p=board(),arduino=isArduino();const opts=[
 {format:'keil',title:'Keil µVision / MDK',detail:'STM32原生C工程接入包。包含工程描述与所需工具链 / 库文件说明。',enabled:!!p.keil&&!arduino},
 {format:'arduino',title:'Arduino IDE',detail:p.arduinoExport===false?'此板的示例使用教学接口。请选择通用源码包。':'导出 sketch 工程。按所选开发板安装相应核心，再编译与上传。',enabled:arduino&&p.arduinoExport!==false},
 {format:'platformio',title:'VS Code + PlatformIO',detail:'导出 platformio.ini、src 与依赖说明，使用实际板卡配置。',enabled:arduino&&!!p.platformio},
 {format:'source',title:'通用源码包',detail:'保留当前文件结构，供其他编辑器或已有工程引用。',enabled:true}
 ];
 modal('把代码交给实际 IDE','<p>当前开发板：<strong>'+esc(p.name)+'</strong> · '+(arduino?'Arduino风格源码':'原生C / 标准外设库源码')+'</p>'+(nativeMode()?'<p>此操作打包编辑器里的源码。当前运行的固件会随实验台工程备份保存，也可在固件面板单独下载。</p>':'')+'<div class="ide-options">'+opts.map(o=>'<button class="ide-option" data-ide-format="'+o.format+'" '+(o.enabled?'':'disabled')+'><strong>'+o.title+'</strong><small>'+o.detail+(o.enabled?'':' 当前代码或板型不匹配。')+'</small></button>').join('')+'</div><label class="export-options"><input id="exportAnnotated" type="checkbox">附加独立逐行读码说明（保留原代码）</label><h3>接入时会发生什么</h3><p>浏览器会生成工程ZIP。解压后，在目标IDE中打开对应工程文件或目录。项目附有具体依赖和接线信息。</p><p>本页不能直接控制你电脑里已安装的Keil，也不会自动烧录硬件。生成的工程还要经过本机工具链编译；库、启动文件、芯片包或开发板核心的要求会写进接入说明。</p><div id="ideExportResult"></div>');
 $$('[data-ide-format]').forEach(b=>b.onclick=async()=>{
  const target=$('#ideExportResult');b.disabled=true;target.innerHTML='<p role="status">正在整理工程与依赖说明…</p>';
  try{
   const {exportProject,appendExportFile,createReadingGuide}=await import('./project-export.js');
   const built=await exportProject({files:clone(files),boardId:p.id,format:b.dataset.ideFormat,projectName:'PhysicalLab_'+example.id.replace(/[^A-Za-z0-9_]/g,'_')});
   const bundle={...built.files},warnings=[...(built.warnings||[])];
   appendExportFile(bundle,'physical-lab-circuit.json',JSON.stringify(projectData(),null,2),warnings);
   if($('#exportAnnotated')?.checked)for(const [name,text] of Object.entries(files))if(/\.(c|cpp|ino|h|hpp)$/i.test(name)){const descriptions=explainSource(text,explain,editorBoardContext());appendExportFile(bundle,'阅读说明/'+name+'.txt',createReadingGuide(text,(line,lineNumber)=>descriptions[lineNumber-1]),warnings);}
   const zip=new JSZip();for(const [name,text] of Object.entries(bundle))zip.file(name,text);
   const artifact=download(built.filename||('PhysicalLab_'+b.dataset.ideFormat+'.zip'),await zip.generateAsync({type:'blob'}),true);
   if(!target.isConnected)return;
   target.innerHTML='<h3>工程包已生成 · '+Object.keys(bundle).length+' 个文件</h3><p>源码、电路备份和接入说明均已包含。可下载完整包，也可先检查具体文件。</p><a class="button primary" id="ideDownloadLink" href="'+esc(artifact.url)+'" download="'+esc(artifact.name)+'">下载完整工程包 ↓</a>'+ (warnings.length?'<details class="export-warnings" open><summary>本机接入前需要完成的事项</summary><ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></details>':'')+'<div class="export-file-viewer"><label for="exportFileSelect">检查包内文件</label><select id="exportFileSelect">'+Object.keys(bundle).map(name=>'<option>'+esc(name)+'</option>').join('')+'</select><textarea id="exportFilePreview" readonly spellcheck="false" aria-label="所选导出文件内容"></textarea><div class="project-actions"><button class="button" id="copyExportFile">复制这份文件</button><button class="button" id="downloadExportFile">下载这份文件 ↓</button></div><output id="exportCopyStatus" role="status"></output></div>';
   const show=()=>{$('#exportFilePreview').value=bundle[$('#exportFileSelect').value];};$('#exportFileSelect').onchange=show;show();
   $('#copyExportFile').onclick=async()=>{try{await navigator.clipboard.writeText($('#exportFilePreview').value);$('#exportCopyStatus').textContent='已复制所选文件。';}catch{$('#exportFilePreview').focus();$('#exportFilePreview').select();$('#exportCopyStatus').textContent='已选中文件内容，请按 Ctrl / ⌘ + C 复制。';}};
   $('#downloadExportFile').onclick=()=>{const name=$('#exportFileSelect').value;download(name.split('/').pop(),new Blob([bundle[name]],{type:'text/plain;charset=utf-8'}));};
   toast('工程包已生成；可先检查文件与本机依赖。');
  }catch(err){if(target.isConnected)target.innerHTML='<div class="issue error"><strong>当前工程还不能这样导出</strong><p>'+esc(err.message||String(err))+'</p><p>请改用匹配的板型 / 源码环境，或下载通用源码。</p></div>';}finally{b.disabled=false;}
 });
}
$('#ideExportButton').onclick=showIDEExport;
document.addEventListener('keydown', event => {
 const target = event.target;
 if (!(target instanceof Element) || event.isComposing || $('#modal').open || $('#appFrame').hidden) return;
 if (boardHolePicker && event.key==='Escape' && target.closest('#scene, #sceneObjectToolbar, #boardHolePicker')) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      event.shiftKey || event.keyCode===229 || event.getModifierState?.('AltGraph')) return;
  event.preventDefault();
  clearBoardHolePicker(true);
  return;
 }
 if (event.key === 'Escape') {
  const expanded = $('#sceneObjectsToggle[aria-expanded="true"], #sceneActionsToggle[aria-expanded="true"]');
  if (expanded) {
   setObjectPopover(null);
   expanded.focus({preventScroll:true});
   event.preventDefault();
  }
  endTour();selectedPin=null;workbench?.cancelInteraction?.();$('#cancelWireButton').hidden=true;
 }
 if (event.defaultPrevented || currentPage !== 'lab' || target.isContentEditable ||
     target.matches('textarea, select, input:not([type=checkbox])') ||
     target.closest('#editorStack, #catalogDrawer') || !$('#catalogDrawer').hidden) return;
 const key = event.key.toLowerCase();
 if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
  event.preventDefault();
  undoCircuit(key === 'y' || event.shiftKey);
  return;
 }
 if (!target.closest('#scene, #sceneObjectToolbar, #inspectorPanel, .wire-actions') || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
 if (key === 'delete' || key === 'backspace') {
  if (selectedPin || !$('#cancelWireButton').hidden) return;
  if (selectedWire) { event.preventDefault(); deleteWire(); }
  else if (selectedParts.size) { event.preventDefault(); removeSceneParts([...selectedParts]); }
 }
});
$('#mainContent').addEventListener('scroll',()=>editorAssistant?.close());
