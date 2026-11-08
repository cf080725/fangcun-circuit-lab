import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {examples} from '../dist/content.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {validateCircuit} from '../dist/project-import.js';

const pwm=(timeMs,pulseUs,{pin='PA0',frequencyHz=50,clock=true,mode='GPIO_Mode_AF_PP'}={})=>({
  timeMs,pins:{[pin]:{mode,clock,pwm:{frequencyHz,duty:pulseUs*frequencyHz/1e6,level:1}}}
});
const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-6,`${actual} ≠ ${expected}`);

function withSupply(voltage,{grounded=true}={}) {
  const circuit=createCircuit('servo-hs55');
  circuit.components.push({...makePart('power','supply'),voltage});
  circuit.wires[0].a='supply:+';
  circuit.wires[1].a='supply:-';
  if(grounded)circuit.wires.push({id:'common',a:'supply:-',b:'mcu:GND1'});
  return circuit;
}

test('an older generic servo remains instantaneous while the HS-55 preset uses the same physical wiring',()=>{
  const generic=createCircuit('servo'),model=createCircuit('servo-hs55');
  assert.deepEqual(generic.wires,model.wires);
  assert.equal(model.components[0].servoModel,'hs55');
  assert.equal(validateCircuit(model).components[0].servoModel,'hs55');
  delete generic.components[0].servoModel;
  assert.equal(validateCircuit(generic).components[0].servoModel,'generic');
  const sim=new CircuitSimulator();
  const first=sim.solve(generic,pwm(0,1000)).parts.servo1;
  const second=sim.solve(generic,pwm(0,2000)).parts.servo1;
  assert.ok(first.active&&second.active);
  near(first.angle,0);
  near(second.angle,180);
  assert.equal(second.targetAngle,undefined);
});

test('HS-55 follows bounded targets at rated no-load speed and installs new commands at their own boundary',()=>{
  const circuit=withSupply(4.8),sim=new CircuitSimulator();
  const servo=state=>sim.solve(circuit,state).parts.servo1;
  let reading=servo(pwm(0,900));
  near(reading.angle,90);
  near(reading.targetAngle,30);
  assert.equal(reading.signalPin,'PA0');
  assert.equal(reading.frequencyHz,50);
  near(reading.pulseUs,900);
  assert.ok(reading.active&&reading.moving);

  reading=servo(pwm(90,2100));
  near(reading.angle,60);
  near(reading.targetAngle,150);
  near(servo(pwm(90,2100)).angle,60);
  near(servo(pwm(225,2100)).angle,105);
  reading=servo(pwm(500,2100));
  near(reading.angle,150);
  assert.equal(reading.moving,false);

  const full=withSupply(6),max=new CircuitSimulator();
  max.solve(full,pwm(0,2100));
  near(max.solve(full,pwm(70,2100)).parts.servo1.angle,120);
  near(max.solve(full,pwm(140,2100)).parts.servo1.angle,150);
});

test('HS-55 draws the specified standing and no-load motion currents at both supply limits',()=>{
  for(const [voltage,standing,running] of [[4.8,5,150],[5,31/6,155],[6,6,180]]){
    const circuit=withSupply(voltage),sim=new CircuitSimulator();
    const at=(time,pulse)=>sim.solve(circuit,pwm(time,pulse)).parts.servo1;
    let reading=at(0,1500);
    near(reading.currentMa,standing);
    assert.equal(reading.loadMode,'standing');
    reading=at(0,2100);
    near(reading.currentMa,running);
    assert.equal(reading.loadMode,'running');
    near(reading.angle,90);
    reading=at(240,2100);
    near(reading.currentMa,standing);
    assert.equal(reading.loadMode,'standing');
    near(reading.angle,150);
  }
});

test('a real feeder drop limits HS-55 motion without cycling the load, and removing SIG restores standing draw',()=>{
  const circuit=withSupply(5),sim=new CircuitSimulator();
  const feeder={...makePart('resistor','feeder'),resistance:2};
  circuit.components.push(feeder);
  circuit.wires[0].a='feeder:2';
  circuit.wires.push({id:'feed',a:'supply:+',b:'feeder:1'});
  for(const time of [0,16,32,48,64,80,500]){
    const frame=sim.solve(circuit,pwm(time,2100));
    const reading=frame.parts.servo1;
    near(reading.voltage,5*32/34);
    near(reading.currentMa,5000/34);
    near(reading.currentMa,frame.parts.feeder.currentMa);
    near(reading.angle,90);
    assert.equal(reading.reason,'supply');
    assert.equal(reading.loadMode,'supply-limited');
  }
  const [signal]=circuit.wires.splice(2,1);
  let reading=sim.solve(circuit,pwm(500,2100)).parts.servo1;
  near(reading.currentMa,6200/1202);
  assert.equal(reading.loadMode,'standing');
  assert.equal(reading.reason,'signal');
  circuit.wires.push(signal);
  feeder.resistance=.5;
  reading=sim.solve(circuit,pwm(500,2100)).parts.servo1;
  near(reading.currentMa,6200/40.5);
  near(reading.voltage,5-.5*reading.currentMa/1000);
  assert.equal(reading.loadMode,'running');
  const angle=sim.solve(circuit,pwm(600,2100)).parts.servo1.angle;
  assert(angle>123&&angle<125);
});

test('unplugging or losing power freezes the shaft from that boundary until a new valid command',()=>{
  const circuit=createCircuit('servo-hs55'),sim=new CircuitSimulator();
  const servo=state=>sim.solve(circuit,state).parts.servo1;
  servo(pwm(0,2100));
  const [signal]=circuit.wires.splice(2,1);
  const lost=servo(pwm(60,2100));
  near(lost.angle,110.9523809524);
  assert.equal(lost.reason,'signal');
  assert.equal(lost.targetAngle,null);
  assert.equal(lost.moving,false);
  near(servo(pwm(500,2100)).angle,lost.angle);

  circuit.wires.push(signal);
  const restored=servo(pwm(500,900));
  near(restored.angle,lost.angle);
  assert.ok(restored.active&&restored.moving);
  circuit.powered=false;
  const off=servo(pwm(560,900));
  near(off.angle,90);
  near(off.currentMa,0);
  assert.equal(off.loadMode,'unpowered');
  assert.equal(off.reason,'supply');
  assert.equal(off.active,false);
  near(servo(pwm(1500,900)).angle,90);
});

test('HS-55 requires common ground and a live unambiguous wired PWM source',()=>{
  const ungrounded=withSupply(5,{grounded:false});
  const isolated=new CircuitSimulator().solve(ungrounded,pwm(0,1500));
  near(isolated.parts.servo1.voltage,5);
  near(isolated.parts.servo1.currentMa,31/6);
  assert.equal(isolated.parts.servo1.loadMode,'standing');
  assert.equal(isolated.parts.servo1.reason,'ground');
  assert.ok(isolated.issues.some(issue=>issue.code==='SERVO_GROUND'));
  assert.equal(new CircuitSimulator().solve(withSupply(4.79),pwm(0,1500)).parts.servo1.reason,'supply');
  assert.equal(new CircuitSimulator().solve(withSupply(6.01),pwm(0,1500)).parts.servo1.reason,'supply');

  const circuit=createCircuit('servo-hs55');
  const solve=state=>new CircuitSimulator().solve(circuit,state).parts.servo1;
  assert.equal(solve(pwm(0,1500,{clock:false})).reason,'signal');
  assert.equal(solve(pwm(0,1500,{mode:'GPIO_Mode_IPU'})).reason,'signal');
  assert.equal(solve(pwm(0,1500,{mode:'GPIO_Mode_AF_OD'})).reason,'signal');
  assert.equal(solve(pwm(0,1500,{frequencyHz:100})).reason,'frequency');
  assert.equal(solve(pwm(0,2500)).reason,'pulse');
  assert.equal(solve(pwm(0,0)).pulseUs,null);
  assert.equal(solve(pwm(0,1500,{pin:'PA1'})).signalPin,null);

  circuit.wires[2].a='bb:e8';
  circuit.wires.push({id:'sig',a:'mcu:PA1',b:'bb:a8'});
  const mountedSignal=solve(pwm(0,1500,{pin:'PA1'}));
  assert.equal(mountedSignal.signalPin,'PA1');
  near(mountedSignal.targetAngle,90);
  circuit.wires.push({id:'other',a:'mcu:PA2',b:'bb:a8'});
  const samePhase=pwm(0,1500,{pin:'PA1'});
  samePhase.pins.PA2={mode:'GPIO_Mode_Out_PP',level:1};
  assert.equal(solve(samePhase).signalPin,null);
  assert.equal(solve(samePhase).reason,'signal');
  samePhase.pins.PA2.level=0;
  assert.equal(solve(samePhase).reason,'conflict');
});

test('isolated samples preserve authoritative position and command, and code restart rebases only the clock',()=>{
  const circuit=createCircuit('servo-hs55'),sim=new CircuitSimulator();
  sim.solve(circuit,pwm(0,2100));
  const moved=sim.solve(circuit,pwm(100,2100)).parts.servo1.angle;
  near(moved,124.9206349206);
  const isolated=sim.sampleAtCurrentTime(circuit,pwm(150,900)).parts.servo1;
  near(isolated.angle,moved);
  near(isolated.targetAngle,30);
  assert.equal(sim.lastTime,100);
  near(sim.solve(circuit,pwm(120,2100)).parts.servo1.angle,131.9047619048);

  const held=sim.lastResult.parts.servo1.angle;
  sim.reset({preserveServoAngles:true});
  near(sim.solve(circuit,{timeMs:0,pins:{}}).parts.servo1.angle,held);
  near(sim.solve(circuit,pwm(100,900)).parts.servo1.angle,held);
  assert.ok(sim.solve(circuit,pwm(140,900)).parts.servo1.angle<held);
  sim.reset();
  near(sim.solve(circuit,pwm(0,900)).parts.servo1.angle,90);
  sim.solve(circuit,pwm(90,900));
  sim.removeParts(['servo1']);
  near(sim.solve(circuit,pwm(90,900)).parts.servo1.angle,90);
});

test('the Blue Pill source lesson moves the same shaft from 1200 to 1800 µs when code is applied',()=>{
  const example=examples.find(example=>example.id==='servo-hs55');
  const circuit=createCircuit(example.circuitPreset),sim=new CircuitSimulator();
  const runtime=files=>{
    const built=compileForBoard(files,'bluepill');
    assert.deepEqual(built.diagnostics.filter(item=>item.severity==='error'),[]);
    return createBoardRuntime(built,{onBeforeDelay:(_,readState)=>sim.solve(circuit,readState(),{averagePWM:false})},'bluepill');
  };
  const tick=instance=>{
    const state=instance.runSlice(16,2000);
    assert.equal(state.error,null);
    const solved=sim.solve(circuit,state);
    assert.ok(solved.converged);
    return solved.parts.servo1;
  };

  const first=runtime(example.files);
  let observed=tick(first);
  near(observed.pulseUs,1200);
  near(observed.targetAngle,60);
  assert.ok(observed.angle>60&&observed.angle<90);
  for(let n=0;n<12;n++)observed=tick(first);
  near(observed.angle,60);

  sim.reset({preserveServoAngles:true});
  const second=runtime({'main.c':example.files['main.c'].replace('#define COMMAND_US 1200','#define COMMAND_US 1800')});
  near(sim.solve(circuit,second.getState()).parts.servo1.angle,60);
  observed=tick(second);
  near(observed.pulseUs,1800);
  near(observed.targetAngle,120);
  assert.ok(observed.angle>60&&observed.angle<90);
  for(let n=0;n<12;n++)observed=tick(second);
  near(observed.angle,120);
});
