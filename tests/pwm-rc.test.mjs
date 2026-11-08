import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {makePassiveBreadboardExercises} from '../dist/passive-breadboard-exercises.js';
import {validateCircuit} from '../dist/project-import.js';

const tau=104.7,rail=3.3;
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);
const charge=(voltage,target,ms)=>target+(voltage-target)*Math.exp(-ms/tau);
const wire=(id,a,b)=>({id,a,b});
const pwm=(timeMs,{frequencyHz=100,duty=.25,startMs=0,endMs,mode='GPIO_Mode_AF_PP',adcMode='GPIO_Mode_AIN'}={})=>({
  timeMs,pins:{PA0:{clock:true,mode,pwm:{frequencyHz,duty,startMs,endMs}},PA1:{clock:true,mode:adcMode}}
});

function circuit(){
  const model=createCircuit('onboard');
  model.components=[{...makePart('resistor','r'),resistance:1000},makePart('capacitor','c')];
  model.wires=[wire('w1','mcu:PA0','r:1'),wire('w2','r:2','c:+'),wire('w3','c:-','mcu:GND1'),wire('w4','mcu:PA1','c:+')];
  return model;
}

test('physical RC voltage follows the shifted PWM phase, is visible at PA1, and loads PA0 through driver resistance',()=>{
  const model=circuit(),sim=new CircuitSimulator(),startMs=7.25;
  sim.solve(model,pwm(startMs,{startMs}));
  const mid=sim.solve(model,pwm(startMs+1,{startMs}));
  const raised=charge(0,rail,1);
  near(mid.parts.c.voltage,raised);
  near(mid.parts.c.pwmRc.phaseMs,1);
  near(mid.netVoltages['mcu:PA0'],rail-(rail-raised)*47/1047);

  const fall=sim.solve(model,pwm(startMs+2.5,{startMs}));
  const peak=charge(0,rail,2.5);
  near(fall.parts.c.voltage,peak);
  near(fall.netVoltages['mcu:PA0'],peak*47/1047);
  near(fall.netVoltages['mcu:PA1'],peak);
  near(fall.measureBetween('mcu:PA1','mcu:GND1').voltage,peak);
  assert.equal(fall.readADC(1),Math.round(peak/rail*4095));
  near(sim.solve(model,pwm(startMs+10,{startMs})).parts.c.voltage,charge(peak,0,7.5));
  assert.equal(fall.parts.c.pwmRc.pin,'PA0');
  assert.equal(fall.parts.c.pwmRc.voltageLow,0);
  assert.equal(fall.parts.c.pwmRc.voltageHigh,rail);
  near(fall.parts.c.pwmRc.timeConstantMs,tau);
  assert.ok(!fall.issues.some(issue=>issue.code==='PWM_RC_TIMESTEP'));
});

test('long jumps, small slices and steady-state ripple agree without iterating every PWM cycle',()=>{
  const model=circuit(),one=new CircuitSimulator(),many=new CircuitSimulator();
  one.solve(model,pwm(0));
  many.solve(model,pwm(0));
  for(let n=1;n<=100;n++)many.solve(model,pwm(n*10.013),{averagePWM:false});
  near(one.solve(model,pwm(1001.3)).parts.c.voltage,many.lastResult.parts.c.voltage);

  const min=one.solve(model,pwm(10000)).parts.c;
  const max=one.solve(model,pwm(10002.5)).parts.c;
  const peak=rail*(1-Math.exp(-2.5/tau))/(1-Math.exp(-10/tau));
  near(min.voltage,peak*Math.exp(-7.5/tau));
  near(max.voltage,peak);
  near(max.pwmRc.voltageMin,min.voltage);
  near(max.pwmRc.voltageMax,max.voltage);
  near(max.pwmRc.ripplePp,max.voltage-min.voltage);
  near(max.pwmRc.voltageMean,.825);

  for(const frequencyHz of [1000,1e6]){
    const fast=new CircuitSimulator();
    fast.solve(model,pwm(0,{frequencyHz}));
    const settled=fast.solve(model,pwm(86400000,{frequencyHz})).parts.c;
    near(settled.voltage,settled.pwmRc.voltageMin);
    near(settled.pwmRc.voltageMean,.825);
    near(settled.pwmRc.ripplePp/max.pwmRc.ripplePp,100/frequencyHz,1e-4);
  }
});

test('the previous command owns elapsed time, with continuous charge across code, loss of PWM and unplugging',()=>{
  const model=circuit(),sim=new CircuitSimulator(),control=new CircuitSimulator();
  sim.solve(model,pwm(0));
  control.solve(model,pwm(0));
  const first=sim.solve(model,pwm(120)).parts.c;
  const preview=sim.sampleAtCurrentTime(model,pwm(150,{duty:.75})).parts.c;
  near(preview.voltage,first.voltage);
  near(preview.pwmRc.voltageMean,2.475);
  assert.equal(sim.lastTime,120);
  near(sim.capVoltages.c,first.voltage);

  const next=sim.solve(model,pwm(200,{duty:.75})).parts.c;
  near(next.voltage,control.solve(model,pwm(200)).parts.c.voltage);
  near(next.pwmRc.voltageMean,2.475);
  near(sim.solve(model,pwm(204,{duty:.75})).parts.c.voltage,charge(next.voltage,rail,4));

  const at204=sim.lastResult.parts.c.voltage;
  const low=timeMs=>({timeMs,pins:{PA0:{clock:true,mode:'GPIO_Mode_Out_PP',level:0}}});
  near(sim.solve(model,low(204)).parts.c.voltage,at204);
  near(sim.solve(model,low(214)).parts.c.voltage,charge(at204,0,10));
  assert.equal(sim.lastResult.parts.c.pwmRc,undefined);
  const beforeUnplug=sim.lastResult.parts.c.voltage;
  model.wires=model.wires.filter(({id})=>id==='w1');
  const unplugged=sim.solve(model,low(224));
  near(unplugged.parts.c.voltage,charge(beforeUnplug,0,10));
  assert.equal(unplugged.parts.c.pwmRc,undefined);
  near(sim.solve(model,low(1000)).parts.c.voltage,unplugged.parts.c.voltage);

  const original=circuit(),held=sim.lastResult.parts.c.voltage;
  // A code restart keeps the same physical capacitor and resets the clock.
  model.wires=original.wires;
  sim.reset({preserveCapacitorVoltages:true});
  near(sim.solve(model,pwm(0,{duty:.75})).parts.c.voltage,held);
  near(sim.solve(model,pwm(4,{duty:.75})).parts.c.voltage,charge(held,rail,4));
  sim.reset();
  near(sim.solve(model,pwm(0)).parts.c.voltage,0);
});

test('0% and 100% PWM reach DC endpoints and timed PWM falls low at its end',()=>{
  const model=circuit();
  for(const duty of [0,1]){
    const sim=new CircuitSimulator();
    sim.solve(model,pwm(0,{duty}));
    const value=sim.solve(model,pwm(1000,{duty})).parts.c;
    near(value.voltage,charge(0,rail*duty,1000));
    near(value.pwmRc.voltageMin,rail*duty);
    near(value.pwmRc.voltageMax,rail*duty);
    assert.equal(value.pwmRc.ripplePp,0);
  }
  const sim=new CircuitSimulator();
  sim.solve(model,pwm(0,{duty:.5,endMs:7}));
  const ended=sim.solve(model,{timeMs:10,pins:{PA0:{clock:true,mode:'GPIO_Mode_Out_PP',level:0}}});
  near(ended.parts.c.voltage,charge(charge(0,rail,5),0,5));
  assert.equal(ended.parts.c.pwmRc,undefined);
});

test('only the recognized linear circuit gets an analytic waveform',()=>{
  const add=(type,id,root,pin)=>model=>{
    const part=makePart(type,id);
    model.components.push(part);
    model.wires.push(wire('add1',`${id}:${pin[0]}`,root),wire('add2',`${id}:${pin[1]}`,'mcu:GND1'));
  };
  const rejected=[
    ['bypassed resistor',model=>model.wires.push(wire('bypass','r:1','r:2')),pwm(0)],
    ['shorted capacitor',model=>model.wires.push(wire('short','c:+','c:-')),pwm(0)],
    ['floating return',model=>model.wires.splice(2,1),pwm(0)],
    ['parallel resistor',add('resistor','load','c:+',['1','2']),pwm(0)],
    ['second capacitor',add('capacitor','second','r:1',['+','-']),pwm(0)],
    ['diode load',add('led','indicator','c:+',['A','K']),pwm(0)],
    ['ideal supply',add('power','supply','c:+',['+','-']),pwm(0)],
    ['open drain',()=>{},pwm(0,{mode:'GPIO_Mode_AF_OD'})],
    ['internal pull-up',()=>{},pwm(0,{adcMode:'GPIO_Mode_IPU'})],
    ['unknown PWM phase',()=>{},{timeMs:0,pins:{PA0:{clock:true,mode:'GPIO_Mode_AF_PP',pwm:{frequencyHz:100,duty:.25}}}}],
    ['second driver',model=>model.wires.push(wire('second','mcu:PA2','r:1')),
      {timeMs:0,pins:{...pwm(0).pins,PA2:{clock:true,mode:'GPIO_Mode_Out_PP',level:1}}}],
    ['released open-drain driver',model=>model.wires.push(wire('second','mcu:PA2','c:+')),
      {timeMs:0,pins:{...pwm(0).pins,PA2:{clock:true,mode:'GPIO_Mode_AF_OD',pwm:{frequencyHz:500,duty:.5,startMs:0}}}}]
  ];
  for(const [name,mutate,state] of rejected){
    const model=circuit();
    mutate(model);
    const solved=new CircuitSimulator().solve(model,state);
    assert.equal(solved.parts.c.pwmRc,undefined,name);
    if(name==='parallel resistor'||name==='unknown PWM phase')assert.ok(solved.issues.some(issue=>issue.code==='PWM_RC_TIMESTEP'),name);
  }
  const model=circuit();
  assert.ok(new CircuitSimulator().solve(model,pwm(0,{adcMode:'GPIO_Mode_IN_FLOATING'})).parts.c.pwmRc);
  model.powered=false;
  assert.equal(new CircuitSimulator().solve(model,pwm(0)).parts.c.pwmRc,undefined);
});

test('the actual Blue Pill lesson detects the two mounted parts and applies source edits with the same charge',()=>{
  const lesson=makePassiveBreadboardExercises().find(item=>item.id==='pwm-rc');
  const model=validateCircuit(lesson.circuitData),sim=new CircuitSimulator();
  const run=files=>createBoardRuntime(compileForBoard(files,'bluepill'),{
    onBeforeDelay:(_,readState)=>sim.solve(model,readState(),{averagePWM:false})
  });
  let runtime=run(lesson.files);
  const solve=()=>sim.solve(model,runtime.runSlice(50));
  let result;
  for(let n=0;n<20;n++)result=solve();
  const old=result.parts.c1;
  near(old.pwmRc.voltageMean,.825);
  near(old.voltage,result.netVoltages['mcu:PA1']);
  assert.ok(old.voltage>.79&&old.voltage<.82);

  const edited=lesson.files['main.c'].replace('#define DUTY_PERCENT 25','#define DUTY_PERCENT 75');
  sim.reset({preserveCapacitorVoltages:true});
  runtime=run({'main.c':edited});
  result=solve();
  const first=result.parts.c1;
  near(first.pwmRc.voltageMean,2.475);
  assert.ok(first.voltage>old.voltage&&first.voltage<first.pwmRc.voltageMin);
  for(let n=1;n<20;n++)result=solve();
  assert.ok(result.parts.c1.voltage>2.44&&result.parts.c1.voltage<2.46);
  delete model.components.find(part=>part.id==='c1').mount;
  result=sim.solve(model,runtime.getState());
  assert.equal(result.parts.c1.pwmRc,undefined);
  assert.ok(result.netVoltages['mcu:PA1']>3.29);
});
