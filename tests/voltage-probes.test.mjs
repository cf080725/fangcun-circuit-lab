import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {getBoardProfile} from '../dist/board-profiles.js';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {probeMeterReading,voltageProbeLookup} from '../dist/voltage-probes.js';

const board=getBoardProfile('bluepill');
const wire=(a,b)=>({a,b});
const closeTo=(value,expected)=>assert.ok(Math.abs(value-expected)<1e-5,`${value} V, expected ${expected} V`);

test('measureBetween reads actual rails, polarity and unused holes on wired breadboard strips',()=>{
  const circuit=createCircuit('onboard');
  circuit.wires=[wire('mcu:3V3','bb:e10'),wire('mcu:GND1','bb:n1')];
  const before=structuredClone(circuit);
  const sim=new CircuitSimulator(),result=sim.solve(circuit);
  assert.equal(result.netVoltages['bb:a10'],undefined,'unwired hole aliases are resolved by the meter');
  closeTo(result.measureBetween('bb:a10','bb:n25').voltage,3.3);
  closeTo(result.measureBetween('bb:n25','bb:a10').voltage,-3.3);
  assert.deepEqual(result.measureBetween('mcu:GND1','mcu:GND2'),{status:'measured',voltage:0});
  assert.deepEqual(result.measureBetween('bb:a10','bb:e10'),{status:'measured',voltage:0});
  assert.deepEqual(result.measureBetween('bb:a9','bb:e9'),{status:'measured',voltage:0});
  assert.deepEqual(result.measureBetween('bb:a9','bb:f9'),{status:'floating',voltage:null});
  assert.deepEqual(result.measureBetween('bb:a10','bb:n26'),{status:'floating',voltage:null});
  assert.deepEqual(result.measureBetween('bb:a31','bb:n25'),{status:'unavailable',voltage:null});
  assert.deepEqual(circuit,before);
  assert.equal(sim.lastResult,result,'taking a meter reading does not re-solve the circuit');
  assert.equal(sim.lastTime,0);
});

test('meter reads a floating supply across its own terminals and rejects unrelated references',()=>{
  const circuit=createCircuit('onboard');
  circuit.powered=false;
  circuit.components=[{...makePart('power','battery'),voltage:6}];
  const sim=new CircuitSimulator();
  const floating=sim.solve(circuit);
  closeTo(floating.measureBetween('battery:+','battery:-').voltage,6);
  assert.deepEqual(floating.measureBetween('battery:+','mcu:GND1'),{status:'floating',voltage:null});
  assert.deepEqual(floating.measureBetween('mcu:3V3','mcu:GND1'),{status:'floating',voltage:null});
  circuit.wires=[wire('battery:+','mcu:GND1')];
  const commonGround=sim.solve(circuit);
  closeTo(commonGround.measureBetween('battery:-','mcu:GND2').voltage,-6);
  assert.deepEqual(floating.measureBetween('battery:+','mcu:GND1'),{status:'floating',voltage:null},'old result remains a measurement of its own topology');
});

test('solver conflicts produce unavailable readings even on otherwise known rails',()=>{
  const circuit=createCircuit('onboard'),sim=new CircuitSimulator();
  circuit.wires=[wire('mcu:3V3','mcu:GND1')];
  const shorted=sim.solve(circuit);
  assert.ok(shorted.issues.some(issue=>issue.code==='SUPPLY_SHORT'));
  assert.deepEqual(shorted.measureBetween('mcu:3V3','mcu:GND1'),{status:'unavailable',voltage:null});

  circuit.wires=[wire('mcu:PA0','mcu:PA1')];
  const pushPull=(output)=>({clock:true,mode:'GPIO_Mode_Out_PP',output,level:output});
  const opposed=sim.solve(circuit,{pins:{PA0:pushPull(1),PA1:pushPull(0)}});
  assert.ok(opposed.issues.some(issue=>issue.code==='OUTPUT_CONFLICT'));
  assert.deepEqual(opposed.measureBetween('mcu:3V3','mcu:GND1'),{status:'unavailable',voltage:null});
});

test('probe geometry accepts live contacts but filters covered and removed terminals',()=>{
  const circuit=createCircuit('plugged-led');
  const lookup=voltageProbeLookup(circuit,board);
  assert.equal(lookup('bb:a10'),null,'an inserted component covers its exact socket');
  assert.equal(lookup('bb:e10'),'面包板 E10','an occupied jump lead remains a measurable contact');
  assert.match(lookup('mcu:PA0'),/PA0/);
  assert.match(lookup('led1:A'),/led1/);
  assert.equal(lookup('led1:Z'),null);
  assert.equal(lookup('bb:p51'),null);
  circuit.components=circuit.components.filter(part=>part.id!=='led1');
  assert.equal(voltageProbeLookup(circuit,board)('led1:A'),null);
});

function probeApp(circuit){
  const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const code=app.slice(app.indexOf('function probeMeterSnapshot()'),app.indexOf('function renderPinMeasurement()'));
  assert.ok(code.includes("$('#probeClear').onclick"));
  const nodes=new Map(),markers=[];
  const sim=new CircuitSimulator();
  const context={
    $:selector=>{
      if(!nodes.has(selector))nodes.set(selector,{hidden:selector==='#probePanel',dataset:{},attributes:{},
        setAttribute(key,value){this.attributes[key]=value;},getAttribute(key){return this.attributes[key];},
        focus(){this.focused=true;}});
      return nodes.get(selector);
    },
    circuit,board:()=>board,probeOpen:false,probePick:null,probeNotice:'',probeEndpoints:{red:null,black:null},
    result:sim.solve(circuit),mode:'wire',cameraMode:'pan',wavePin:'PA0',markers,
    workbench:{setProbes:pair=>markers.push({...pair})},voltageProbeLookup,probeMeterReading,
    nativeMode:()=>false,syncSourceProbeTrace(){},renderSourceScope(){},renderNativeObservation(){},openSourceScope(){},
    setMode:mode=>{context.mode=mode;},setSceneCameraMode:mode=>{context.cameraMode=mode;},
    clearBoardHolePicker(){},clearPartPlacement(){},cancelPendingConnection(){},fmt:value=>value.toFixed(2),
    solve:()=>sim.solve(circuit),
  };
  return runInNewContext(`${code}\n({probeMeterSnapshot,assignProbeEndpoint,cancelProbePicking,
    click:id=>$('#'+id).onclick(),element:selector=>$(selector),markers,
    remeasure(){result=solve();renderProbeMeter();},view:()=>({mode,cameraMode,wavePin})});`,context);
}

test('app arms both probes, preserves the observation pin and updates without changing wiring',()=>{
  const circuit=createCircuit('onboard'),saved=structuredClone(circuit),app=probeApp(circuit);
  app.click('probeToggle');
  assert.equal(app.probeMeterSnapshot().status,'incomplete');
  app.click('probeRed');
  assert.equal(app.view().mode,'orbit');
  assert.equal(app.view().cameraMode,'edit');
  assert.equal(app.element('#scene [role="application"]').focused,true);
  assert.match(app.element('#probeHint').textContent,/按 P/);
  assert.equal(app.assignProbeEndpoint('bb:a99'),false);
  assert.equal(app.probeMeterSnapshot().picking,'red');
  assert.equal(app.assignProbeEndpoint('mcu:3V3'),true);
  assert.equal(app.probeMeterSnapshot().picking,'black');
  assert.equal(app.assignProbeEndpoint('mcu:GND1'),true);
  assert.equal(app.probeMeterSnapshot().picking,null);
  assert.equal(app.view().wavePin,'PA0');
  assert.equal(app.element('#probeValue').textContent,'3.30 V');
  app.click('probeSwap');
  assert.equal(app.element('#probeValue').textContent,'-3.30 V');
  assert.equal(app.markers.at(-1).red,'mcu:GND1');
  assert.deepEqual(circuit,saved);

  circuit.powered=false;
  app.remeasure();
  assert.equal(app.probeMeterSnapshot().status,'floating');
  assert.equal(app.probeMeterSnapshot().red,'mcu:GND1');
  app.click('probeBlack');
  app.cancelProbePicking();
  assert.equal(app.probeMeterSnapshot().black,'mcu:3V3');
  app.click('probeToggle');
  const meter=app.probeMeterSnapshot();
  assert.equal(meter.status,'closed');
  assert.equal(meter.red,null);
  assert.equal(meter.black,null);
  assert.equal(app.element('#probePanel').hidden,true);
});

test('app drops an invalidated endpoint while keeping the other probe on the current circuit',()=>{
  const circuit=createCircuit('blink'),app=probeApp(circuit);
  app.click('probeToggle');
  app.click('probeRed');
  assert.equal(app.assignProbeEndpoint('led1:A'),true);
  assert.equal(app.assignProbeEndpoint('mcu:GND1'),true);
  circuit.components=circuit.components.filter(part=>part.id!=='led1');
  circuit.wires=circuit.wires.filter(({a,b})=>![a,b].some(endpoint=>endpoint.startsWith('led1:')));
  app.remeasure();
  const meter=app.probeMeterSnapshot();
  assert.equal(meter.red,null);
  assert.equal(meter.black,'mcu:GND1');
  assert.equal(meter.status,'incomplete');
  assert.match(app.element('#probeHint').textContent,/遮住或移除/);
  assert.equal(app.markers.at(-1).red,null);
});
