import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';

const pwm=(duty=.25,level=0,extra={})=>({clock:true,mode:'GPIO_Mode_AF_PP',
  pwm:{timer:2,channel:1,frequencyHz:1000,duty,level,...extra}});
const state=(pins,timeMs=10,extra={})=>({dialect:'stm32-firmware',boardId:'bluepill',timeMs,pins,...extra});
const wire=(a,b)=>({a,b});
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

test('one-cycle measurement uses the real loaded GPIO and LED phases and reuses the existing phase cache',t=>{
  const original=CircuitSimulator.prototype.solve;
  const solve=t.mock.method(CircuitSimulator.prototype,'solve',function(...args){return original.apply(this,args);});
  const sim=new CircuitSimulator(),circuit=createCircuit();
  const result=sim.solve(circuit,state({PA0:pwm()}));
  assert.equal(solve.mock.callCount(),3); // Normal LED visual averaging already solves both phases.
  const sample=result.measurePwmCycle('mcu:PA0','led1');
  assert.deepEqual({pin:sample.pin,frequencyHz:sample.frequencyHz,duty:sample.duty,periodMs:sample.periodMs,
    highFirst:sample.highFirst},{pin:'PA0',frequencyHz:1000,duty:.25,periodMs:1,highFirst:true});
  assert.equal(sample.voltage.low,0);
  near(sample.voltage.high,3.3-47*sample.led.highMa/1000);
  assert.equal(sample.led.lowMa,0);
  assert.ok(sample.led.highMa>3);
  near(sample.led.averageMa,result.parts.led1.pwmAverage.currentMa);
  assert.equal(solve.mock.callCount(),3);
  assert.deepEqual(result.measurePwmCycle('PA0','led1'),sample);
  assert.equal(solve.mock.callCount(),3);
});

test('a bare PWM pin does no extra solves until measurement and does not invent an unrelated LED response',t=>{
  const original=CircuitSimulator.prototype.solve;
  const solve=t.mock.method(CircuitSimulator.prototype,'solve',function(...args){return original.apply(this,args);});
  const sim=new CircuitSimulator(),circuit=createCircuit('onboard');
  const result=sim.solve(circuit,state({PA0:pwm(.4,1,{activeLow:true})}),{averagePWM:false});
  assert.equal(solve.mock.callCount(),1);
  const sample=result.measurePwmCycle('PA0','onboard');
  assert.equal(sample.highFirst,false);
  assert.equal(sample.led,null);
  assert.deepEqual(sample.voltage,{low:0,high:result.measureBetween('mcu:PA0','mcu:GND').voltage});
  near(sample.voltage.high,3.3);
  assert.equal(solve.mock.callCount(),2);
  assert.equal(result.measurePwmCycle('PA1','onboard'),null);
  assert.deepEqual(result.measurePwmCycle('PA0','unknown-part'),sample);
  assert.equal(solve.mock.callCount(),2);
});

test('a displayed PWM result survives same-project firmware reads using its own phase state',t=>{
  const sim=new CircuitSimulator(),circuit=createCircuit('onboard');
  const c=makePart('capacitor','cap1'),r=makePart('resistor','r1');
  circuit.components.push(c,r);
  circuit.wires=[wire('mcu:3V3','r1:1'),wire('r1:2','cap1:+'),wire('cap1:-','mcu:GND')];
  const first=sim.solve(circuit,state({PA0:pwm(.25,0)},10));
  const charge=sim.capVoltages.cap1;
  const callback=sim.solve(circuit,state({PA0:pwm(.75,1)},40),{averagePWM:false});
  assert.ok(sim.capVoltages.cap1>charge);
  const previousSolve=CircuitSimulator.prototype.solve;
  const phaseCharges=[];
  t.mock.method(CircuitSimulator.prototype,'solve',function(...args){
    if(this!==sim)phaseCharges.push(this.capVoltages.cap1);
    return previousSolve.apply(this,args);
  });
  const cycle=first.measurePwmCycle('PA0');
  assert.equal(cycle.duty,.25);
  near(cycle.voltage.high,3.3);
  assert.deepEqual(phaseCharges,[charge]);
  assert.equal(sim.lastResult,callback);
  assert.equal(sim.lastTime,40);

  const next=sim.solve(circuit,state({PA0:pwm(.75,1)},50));
  assert.equal(first.measurePwmCycle('PA0'),null);
  assert.equal(next.measurePwmCycle('PA0').duty,.75);
  sim.reset();
  assert.equal(next.measurePwmCycle('PA0'),null);

  const oldProject=sim.solve(circuit,state({PA0:pwm()}));
  sim.solve(structuredClone(circuit),state({PA0:pwm()}),{averagePWM:false});
  assert.equal(oldProject.measurePwmCycle('PA0'),null);
});

test('0% and 100% do not solve their unused phase, including when it would be unsafe',t=>{
  const original=CircuitSimulator.prototype.solve;
  const solve=t.mock.method(CircuitSimulator.prototype,'solve',function(...args){return original.apply(this,args);});
  const sim=new CircuitSimulator(),circuit=createCircuit();
  const base=[...circuit.wires];
  for(const [duty,rail] of [[0,'GND'],[1,'3V3']]){
    circuit.wires=[...base,wire('mcu:PA0','mcu:'+rail)];
    const result=sim.solve(circuit,state({PA0:pwm(duty,duty)},10+duty));
    const initialCalls=solve.mock.callCount();
    const sample=result.measurePwmCycle('PA0','led1');
    assert.deepEqual(sample.voltage,{low:duty===0?0:null,high:duty===1?3.3:null});
    const currentMa=result.parts.led1.currentMa;
    assert.deepEqual(sample.led,{lowMa:duty===0?currentMa:null,highMa:duty===1?currentMa:null,averageMa:currentMa});
    assert.equal(solve.mock.callCount(),initialCalls);
  }
});

test('non-push-pull, stopped, unsafe and stale samples do not produce cycle traces',()=>{
  const sim=new CircuitSimulator(),circuit=createCircuit('onboard');
  const good=sim.solve(circuit,state({PA0:pwm()}));
  assert.ok(good.measurePwmCycle('PA0'));
  for(const pin of [{...pwm(),mode:'GPIO_Mode_AF_OD'},{...pwm(),clock:false},pwm(.2,0,{frequencyHz:0}),
    pwm(.2,0,{frequencyHz:'1000'}),pwm(1.2),pwm(0,1)]){
    assert.equal(sim.solve(circuit,state({PA0:pin})).measurePwmCycle('PA0'),null);
  }
  assert.equal(good.measurePwmCycle('PA0'),null);
  const latest=sim.solve(circuit,state({PA0:pwm()}));
  sim.removeParts(['led1']);
  assert.equal(latest.measurePwmCycle('PA0'),null);
  assert.equal(sim.solve(circuit,state({PA0:pwm()},10,{error:{code:'FAULT'}})).measurePwmCycle('PA0'),null);
  circuit.wires.push(wire('mcu:PA0','mcu:GND'));
  const conditionalFault=sim.solve(circuit,state({PA0:pwm()}));
  assert.ok(!conditionalFault.issues.some(issue=>issue.severity==='error'));
  assert.equal(conditionalFault.measurePwmCycle('PA0'),null,'unused high in current snapshot would overcurrent');
  circuit.wires=[];
  circuit.powered=false;
  assert.equal(sim.solve(circuit,state({PA0:pwm()})).measurePwmCycle('PA0'),null);
});

test('PWM coupling through passive loads or a floating supply is rejected, but shared fixed rails are fine',()=>{
  const sim=new CircuitSimulator(),circuit=createCircuit();
  const pins={PA0:pwm(),PA1:pwm(.65,1,{channel:2})};
  const r=makePart('resistor','r2');
  circuit.components.push(r);
  const base=[...circuit.wires];
  circuit.wires=[...base,wire('mcu:PA1','r2:1'),wire('r2:2','mcu:GND')];
  assert.ok(sim.solve(circuit,state(pins)).measurePwmCycle('PA0','led1')?.led);
  circuit.wires=[...base,wire('mcu:PA1','r2:1'),wire('r2:2','mcu:PA0')];
  assert.equal(sim.solve(circuit,state(pins)).measurePwmCycle('PA0','led1'),null);
  const supply={...makePart('power','p1'),voltage:1};
  circuit.components.push(supply);
  circuit.wires=[...base,wire('mcu:PA0','p1:+'),wire('p1:-','r2:1'),wire('r2:2','mcu:PA1')];
  assert.equal(sim.solve(circuit,state(pins)).measurePwmCycle('PA0','led1'),null);
});

test('floating LED return is omitted while the measured pin remains available',()=>{
  const sim=new CircuitSimulator(),circuit=createCircuit();
  circuit.wires=circuit.wires.filter(({a})=>a!=='led1:K');
  circuit.wires.push(wire('led1:K','bb:a6'));
  const sample=sim.solve(circuit,state({PA0:pwm()})).measurePwmCycle('PA0','led1');
  assert.equal(sample.led,null);
  near(sample.voltage.high,3.3);
});

test('a coupled dynamic load rejects the reconstruction and isolated devices are never advanced by it',()=>{
  const sim=new CircuitSimulator(),circuit=createCircuit();
  const c=makePart('capacitor','cap1'),m=makePart('motor','motor1'),limit=makePart('resistor','r2');
  const ldr={...makePart('ldr','ldr1'),ldrModel:'pdv-p8103',lux:20};
  circuit.components.push(c,m,ldr,limit);
  const base=[...circuit.wires],pins={PA0:pwm(),PA1:{clock:true,mode:'GPIO_Mode_Out_PP',level:1}};
  circuit.wires=[...base,wire('mcu:PA1','r2:1'),wire('r2:2','cap1:+'),wire('cap1:+','motor1:+'),wire('cap1:-','mcu:GND'),
    wire('motor1:-','mcu:GND'),wire('ldr1:1','mcu:3V3'),wire('ldr1:2','mcu:GND')];
  sim.solve(circuit,state(pins,0));
  ldr.ldrCovered=true;
  sim.solve(circuit,state(pins,0));
  const snapshot=sim.solve(circuit,state(pins,10));
  const retained=()=>({cap:sim.capVoltages,motors:sim.motorStates,light:sim.photocellStates,time:sim.lastTime});
  const before=structuredClone(retained());
  assert.ok(snapshot.measurePwmCycle('PA0','led1')?.led);
  assert.deepEqual(retained(),before);
  assert.equal(sim.lastResult,snapshot);
  circuit.wires=[...base,wire('cap1:+','mcu:PA0'),wire('cap1:-','mcu:GND')];
  assert.equal(sim.solve(circuit,state(pins,11)).measurePwmCycle('PA0','led1'),null);
});
