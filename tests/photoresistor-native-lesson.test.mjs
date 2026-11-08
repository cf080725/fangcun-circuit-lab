import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {mountedConnections,signalStrip} from '../dist/breadboard-mount.js';
import {createBreadboardWiring} from '../dist/breadboard-wiring.js';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';
import {makePhotoresistorLesson,photoresistorLessonId,photoresistorLessonLed,photoresistorLessonPart,photoresistorLessonPin} from '../dist/photoresistor-lesson.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

test('the PDV-P8103 divider and alarm use only physically accessible holes',()=>{
  const lesson=makePhotoresistorLesson(),circuit=validateCircuit(lesson.circuitData);
  assert.equal(lesson.id,photoresistorLessonId);
  assert.equal(lesson.nativeOnly,true);
  assert.equal(lesson.nativeSourceParameter,'DARK_ADC_THRESHOLD');
  assert.equal(lesson.watchPin,photoresistorLessonPin);
  assert.deepEqual(circuit.board.mount,{column:6,rotation:90});
  const profile=getBoardProfile(lesson.boardId);
  const contacts=new Map(mountedConnections(circuit,profile).map(({a,b})=>[a,b]));
  for(const [pin,hole] of [['3V3b','bb:a8'],['GND2','bb:a6'],['PA0','bb:a21'],[photoresistorLessonPin,'bb:a20']]){
    assert.deepEqual(signalStrip(contacts.get(`mcu:${pin}`)),signalStrip(hole));
  }
  const wiring=createBreadboardWiring(circuit,profile);
  for(const {id,a,b} of circuit.wires)for(const endpoint of [a,b]){
    const status=wiring.check(endpoint,{ignoreWireId:id});
    assert.ok(status.ok,`${endpoint}: ${status.message}`);
  }
  const ldr=circuit.components.find(({id})=>id===photoresistorLessonPart);
  assert.equal(ldr.ldrModel,'pdv-p8103');
  assert.equal(ldr.lux,20);
  assert.equal(ldr.ldrCovered,false);
  assert.equal(circuit.components.find(({id})=>id==='rDiv').resistance,22000);
});

test('native PA1 ADC reads the modeled sensor and a real threshold edit reverses the PA0 alarm',async t=>{
  const {boardId,circuitData:circuit,nativeSourceAssets}=makePhotoresistorLesson();
  const dist=new URL('../dist/',import.meta.url);
  const files=Object.fromEntries(Object.entries(nativeSourceAssets)
    .map(([name,asset])=>[name,readFileSync(new URL(asset,dist),'utf8')]));
  const header='light_policy.h';
  const withThreshold=value=>({...files,[header]:files[header].replace('#define DARK_ADC_THRESHOLD 2000',`#define DARK_ADC_THRESHOLD ${value}`)});
  await assert.rejects(compileStm32C(withThreshold(4096),{boardId}),error=>error.diagnostics?.some(issue=>
    issue.file===header&&issue.severity==='error'&&/DARK_ADC_THRESHOLD/.test(issue.message)));

  const initial=structuredClone(circuit);
  const sensor=circuit.components.find(({id})=>id===photoresistorLessonPart);
  const solver=new CircuitSimulator(),io=createAvrCircuitIO(()=>circuit,solver);
  async function boot(source) {
    const {binary,diagnostics}=await compileStm32C(source,{boardId});
    assert.deepEqual(diagnostics,[]);
    const runtime=await createStm32FirmwareRuntime(parseStm32Bin(binary,boardId),{...io,boardId});
    t.after(()=>runtime.dispose());
    return runtime;
  }
  async function read(runtime,samples=1) {
    let state=runtime.getState();
    for(let sample=0;sample<samples;sample++){
      state=await runtime.advanceTime(20);
      assert.equal(state.error,null);
    }
    const {ADC1:adc}=state.adc, result=solver.solve(circuit,state);
    assert.equal(adc.calibrated,true);
    assert.equal(adc.resultPin,photoresistorLessonPin);
    assert.equal(state.pins.PA1.mode,'GPIO_Mode_AIN');
    assert.equal(result.converged,true);
    return {adc,resistance:result.parts[photoresistorLessonPart].resistance,
      ledMa:result.parts[photoresistorLessonLed].currentMa,alarm:state.pins.PA0.level};
  }
  function cover(runtime,covered) {
    sensor.ldrCovered=covered;
    solver.solve(circuit,runtime.getState());
    io.invalidateAnalog();
  }

  const before=await boot(files);
  const ambient=await read(before);
  assert.ok(Math.abs(ambient.adc.result-2484)<=1,JSON.stringify(ambient));
  assert.equal(ambient.alarm,0);
  assert.equal(ambient.ledMa,0);
  cover(before,true);
  const dark=await read(before,10);
  assert.ok(Math.abs(dark.adc.result-173)<=1,JSON.stringify(dark));
  assert.ok(dark.resistance>499000);
  assert.equal(dark.alarm,1);
  assert.ok(dark.ledMa>0);
  cover(before,false);
  const restored=await read(before,15);
  assert.equal(restored.adc.result,ambient.adc.result);
  assert.equal(restored.alarm,0);
  assert.equal(restored.ledMa,0);
  before.dispose();

  solver.reset();
  io.invalidateAnalog();
  const edited=await boot(withThreshold(2800));
  const matched=await read(edited);
  assert.equal(matched.adc.result,ambient.adc.result);
  assert.equal(matched.adc.voltage,ambient.adc.voltage);
  assert.equal(matched.alarm,1);
  assert.ok(matched.ledMa>0);
  assert.deepEqual(circuit,initial);
});
