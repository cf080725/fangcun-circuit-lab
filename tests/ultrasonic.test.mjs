import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,makePart,PARTS} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {validateCircuit} from '../dist/project-import.js';
import {makeUltrasonicLesson} from '../dist/ultrasonic-lesson.js';

const pinOut=level=>({mode:'GPIO_Mode_Out_PP',clock:true,level});
const pinIn={mode:'GPIO_Mode_IN_FLOATING',clock:true};
const state=(timeMs,level,more={})=>({timeMs,boardId:'uno-r3',pins:{D7:pinOut(level),D8:pinIn,...more}});
const timeout=elapsedUs=>({widthUs:0,elapsedUs});
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);
const widthFor=distance=>distance/34300*2e6;
const wire=(id,a,b)=>({id,a,b});

function model(props={}){
  const circuit=makeUltrasonicLesson().circuitData;
  circuit.components=[Object.assign(circuit.components[0],{distanceCm:100},props)];
  circuit.wires=circuit.wires.filter(({a,b})=>a.startsWith('sonar1:')||b.startsWith('sonar1:'));
  return circuit;
}

function fire(circuit,sim=new CircuitSimulator(),riseMs=.002,widthUs=10){
  sim.solve(circuit,state(riseMs,1));
  return sim.solve(circuit,state(riseMs+widthUs/1000,0));
}

test('a 10 µs trigger creates a physically driven delayed echo and a complete pulse read',()=>{
  const circuit=model(),sim=new CircuitSimulator();
  assert.deepEqual([...PARTS.hcsr04.pins],['VCC','TRIG','ECHO','GND']);
  const fresh=sim.solve(circuit,state(0,0));
  assert.equal(fresh.parts.sonar1.status,'idle');
  assert.deepEqual(fresh.measurePulse('D8',1,28000),timeout(28000));
  const result=fire(circuit,sim),data=result.parts.sonar1;
  assert.equal(data.powered,true);
  assert.equal(data.status,'emitting');
  near(data.triggerRiseMs,.002);
  near(data.triggerAtMs,.012);
  near(data.triggerWidthUs,10);
  near(data.emissionEndMs,.212);
  near(data.echoStartMs,data.emissionEndMs);
  near(data.echoWidthUs,widthFor(100));
  assert.deepEqual(data.targetSnapshot,{distanceCm:100,bearingDeg:0,targetPresent:true});
  assert.equal(data.echoLevel,0);
  const pulse=result.measurePulse('mcu:D8',1,28000);
  near(pulse.widthUs,widthFor(100));
  near(pulse.elapsedUs,200+widthFor(100));
  assert.deepEqual(result.measurePulse('D8',1,5500),timeout(5500));
  assert.deepEqual(result.measurePulse('D8',0,28000),timeout(28000));

  const high=sim.solve(circuit,state(.3,0));
  assert.equal(high.parts.sonar1.status,'echo-high');
  assert.equal(high.parts.sonar1.echoLevel,1);
  assert.equal(high.readPin('D8'),1);
  near(high.measureBetween('mcu:D8','mcu:GND').voltage,5);
  assert.deepEqual(high.measurePulse('D8',1,28000),timeout(28000));
  const done=sim.solve(circuit,state(data.echoEndMs,0));
  assert.equal(done.parts.sonar1.status,'complete');
  assert.equal(done.readPin('D8'),0);
});

test('trigger duration, cooldown, and target snapshot govern scheduling',()=>{
  const circuit=model(),sim=new CircuitSimulator();
  const short=fire(circuit,sim,.002,5).parts.sonar1;
  assert.equal(short.status,'trigger-short');
  near(short.lastTriggerWidthUs,5);
  assert.equal(short.triggerAtMs,null);
  const accepted=fire(circuit,sim,2).parts.sonar1;
  near(accepted.triggerAtMs,2.01);
  const sonar=circuit.components[0];
  sonar.distanceCm=150;
  const early=fire(circuit,sim,20).parts.sonar1;
  assert.equal(early.status,'cooldown');
  near(early.echoWidthUs,widthFor(100));
  assert.equal(early.targetSnapshot.distanceCm,100);
  const next=fire(circuit,sim,62).parts.sonar1;
  near(next.triggerAtMs,62.01);
  near(next.echoWidthUs,widthFor(150));
  assert.equal(next.targetSnapshot.distanceCm,150);
});

test('range and teaching beam limits keep specific no-echo reasons',()=>{
  for(const [props,reason] of [[{targetPresent:false},'removed'],[{distanceCm:1},'outside-range'],
    [{distanceCm:401},'outside-range'],[{bearingDeg:8},'outside-beam']]){
    const circuit=model(props),sim=new CircuitSimulator();
    const sent=fire(circuit,sim);
    assert.equal(sent.parts.sonar1.status,'emitting');
    assert.equal(sent.parts.sonar1.missReason,reason);
    assert.equal(sent.parts.sonar1.echoStartMs,null);
    assert.deepEqual(sent.measurePulse('D8',1,28000),timeout(28000));
    assert.equal(sim.solve(circuit,state(1,0)).parts.sonar1.status,'no-target');
  }
  for(const props of [{distanceCm:2,bearingDeg:-7.5},{distanceCm:400,bearingDeg:7.5}]){
    const sent=fire(model(props));
    near(sent.measurePulse('D8',1,28000).widthUs,widthFor(props.distanceCm));
  }
});

test('wiring and voltage determine the trigger and pulse, with no invented read on a disconnected or driven input',()=>{
  const looseTrig=model();
  looseTrig.wires=looseTrig.wires.filter(({b})=>b!=='sonar1:TRIG');
  assert.equal(fire(looseTrig).parts.sonar1.status,'idle');
  const looseEcho=model();
  looseEcho.wires=looseEcho.wires.filter(({b})=>b!=='sonar1:ECHO');
  const echo=fire(looseEcho);
  assert.equal(echo.parts.sonar1.status,'emitting');
  assert.deepEqual(echo.measurePulse('D8',1,28000),timeout(28000));

  const missingGround=model();
  missingGround.components.push(makePart('power','supply'));
  missingGround.wires=missingGround.wires.filter(({b})=>!['sonar1:VCC','sonar1:GND'].includes(b));
  missingGround.wires.push(wire('w5','supply:+','sonar1:VCC'),wire('w6','supply:-','sonar1:GND'));
  const noGround=fire(missingGround);
  assert.equal(noGround.parts.sonar1.status,'ground');
  near(noGround.parts.sonar1.voltage,5);
  assert.deepEqual(noGround.measurePulse('D8',1,28000),timeout(28000));
  const weak=model();
  weak.wires.find(({b})=>b==='sonar1:VCC').a='mcu:3V3';
  const undervoltage=fire(weak);
  assert.equal(undervoltage.parts.sonar1.status,'unpowered');
  assert.equal(undervoltage.parts.sonar1.echoLevel,null);
  assert.deepEqual(undervoltage.measurePulse('D8',1,28000),timeout(28000));

  const driven=model(),sim=new CircuitSimulator();
  fire(driven,sim);
  const conflicting=sim.solve(driven,state(.014,0,{D8:pinOut(0)}));
  assert.deepEqual(conflicting.measurePulse('D8',1,28000),timeout(28000));
  assert.ok(conflicting.issues.some(issue=>issue.code==='ULTRASONIC_ECHO_CONFLICT'));
});

test('breadboard and a real loaded divider pass a pulse, while a clamped input does not',()=>{
  const circuit=model();
  circuit.wires=circuit.wires.filter(({b})=>b!=='sonar1:ECHO');
  circuit.components.push({...makePart('resistor','upper'),resistance:10000},
    {...makePart('resistor','lower'),resistance:20000});
  circuit.wires.push(wire('s1','sonar1:ECHO','upper:1'),wire('s2','upper:2','bb:a10'),
    wire('s3','lower:1','bb:c10'),wire('s4','lower:2','mcu:GND'),wire('s5','mcu:D8','bb:e10'));
  const sim=new CircuitSimulator(),queued=fire(circuit,sim);
  near(queued.measurePulse('D8',1,28000).widthUs,widthFor(100));
  const loaded=sim.solve(circuit,state(.3,0));
  near(loaded.measureBetween('mcu:D8','mcu:GND').voltage,5*20000/30050,1e-6);
  assert.equal(loaded.readPin('D8'),1);
  circuit.components.find(({id})=>id==='lower').resistance=500;
  const clamped=fire(circuit);
  assert.ok(clamped.parts.sonar1.echoWidthUs>0);
  assert.deepEqual(clamped.measurePulse('D8',1,28000),timeout(28000));
});

test('isolated samples cannot consume a trigger, change its target, or preserve it across a full reset',()=>{
  const circuit=model(),sim=new CircuitSimulator();
  sim.solve(circuit,state(.002,1));
  const preview=sim.sampleAtCurrentTime(circuit,state(.012,0));
  assert.equal(preview.parts.sonar1.status,'emitting');
  preview.parts.sonar1.targetSnapshot.distanceCm=4;
  assert.equal(sim.lastTime,.002);
  assert.equal(sim.lastResult.parts.sonar1.status,'trigger-high');
  const committed=sim.solve(circuit,state(.012,0));
  assert.equal(committed.parts.sonar1.targetSnapshot.distanceCm,100);
  assert.equal(committed.measurePulse('D8',1,28000).widthUs,widthFor(100));
  sim.reset();
  const reset=sim.solve(circuit,state(.013,0));
  assert.equal(reset.parts.sonar1.status,'idle');
  assert.deepEqual(reset.measurePulse('D8',1,28000),timeout(28000));
});

test('the actual UNO source reads 80 cm and changes the external alarm current after a threshold edit',()=>{
  const lesson=makeUltrasonicLesson(),circuit=validateCircuit(lesson.circuitData);
  const read=(threshold,trigger=10)=>{
    const sim=new CircuitSimulator();
    const files=Object.fromEntries(Object.entries(lesson.files).map(([name,source])=>[name,
      source.replace('#define ALARM_CM 60','#define ALARM_CM '+threshold).replace('#define TRIGGER_US 10','#define TRIGGER_US '+trigger)]));
    const runtime=createBoardRuntime(compileForBoard(files,'uno-r3'),{
      onBeforeDelay:(_,snapshot)=>sim.solve(circuit,snapshot(),{averagePWM:false}),
      readPulse:(pin,level,limit,st)=>sim.solve(circuit,st,{averagePWM:false}).measurePulse(pin,level,limit)
    });
    let st,solved;
    for(let n=0;n<30;n++){
      st=runtime.runSlice(10);
      assert.equal(st.error,null);
      solved=sim.solve(circuit,st);
      if(st.serial.includes(' cm')||st.serial.includes('No echo'))break;
    }
    return {st,solved};
  };
  const before=read(60),after=read(100),short=read(100,5);
  for(const {st} of [before,after]){
    assert.equal(st.variables.measuredCm,80);
    assert.equal(st.variables.measuredEchoUs,Math.round(widthFor(80)));
  }
  near(before.solved.parts.led1.currentMa,0);
  assert.ok(after.solved.parts.led1.currentMa>7);
  assert.equal(short.st.variables.measuredCm,-1);
  assert.equal(short.st.variables.measuredEchoUs,0);
  assert.ok(short.st.events.some(event=>event.type==='pulse'&&event.timedOut));
});
