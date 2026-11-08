import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit,makePart,PARTS} from '../dist/circuit.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {makeMotorBridgeLesson,readMotorBridgeLesson} from '../dist/motor-bridge-lesson.js';
import {validateCircuit} from '../dist/project-import.js';

const wire=(id,a,b)=>({id,a,b});
const pin=level=>({mode:'GPIO_Mode_Out_PP',clock:true,level});
const state=(a,b,timeMs=0,other={})=>({timeMs,pins:{PA0:pin(a),PA1:pin(b),...other}});
const near=(value,expected,tolerance=1e-7)=>assert.ok(Math.abs(value-expected)<tolerance,`${value} ≠ ${expected}`);

test('Pololu 2130 headers match both schematic connector rows and its unmodified sense pads share ground',()=>{
  assert.deepEqual([...PARTS.drv8833.pins],['GND2','VMM','BIN1','BIN2','AIN2','AIN1','SLP','FLT',
    'GND','VIN','BOUT1','BOUT2','AOUT2','AOUT1','AISEN','BISEN']);
  const circuit=validateCircuit(makeMotorBridgeLesson().circuitData);
  assert.equal(circuit.components[1].motorModel,'fa130-18100');
  const solved=new CircuitSimulator().solve(circuit,state(0,0));
  for(const id of ['GND','GND2','AISEN','BISEN']){
    assert.deepEqual(solved.measureBetween('bridge1:'+id,'mcu:GND'),{status:'measured',voltage:0});
  }
  assert.equal(solved.measureBetween('bridge1:FLT','bridge1:GND').status,'floating');
  assert.deepEqual(solved.parts.bridge1.channels.B.inputs,[0,0]);
  assert.equal(solved.parts.bridge1.channels.B.mode,'coast');
  assert.equal(solved.parts.bridge1.channels.B.voltage,null);
});

test('each bridge channel uses the four TI logic states and actually drives an attached winding',()=>{
  const circuit=makeMotorBridgeLesson().circuitData;
  circuit.components.push({...makePart('motor','motor2'),motorModel:'fa130-18100'});
  circuit.wires.push(wire('bin1','mcu:PA2','bridge1:BIN1'),wire('bin2','mcu:PA3','bridge1:BIN2'),
    wire('bout1','bridge1:BOUT1','motor2:-'),wire('bout2','bridge1:BOUT2','motor2:+'));
  for(const [in1,in2,mode,sign] of [[0,0,'coast',0],[1,0,'forward',1],[0,1,'reverse',-1],[1,1,'brake',0]]){
    const result=new CircuitSimulator().solve(circuit,state(in1,in2,0,{PA2:pin(in1),PA3:pin(in2)}));
    assert.ok(result.converged);
    for(const channel of ['A','B']){
      const output=result.parts.bridge1.channels[channel];
      assert.deepEqual(output.inputs,[in1,in2]);
      assert.equal(output.mode,mode);
      assert.equal(Math.sign(output.currentMa),sign);
    }
    const {motor1,motor2}=result.parts;
    assert.deepEqual(motor1.bridge,{id:'bridge1',channel:'A',mode,reversed:false});
    assert.deepEqual(motor2.bridge,{id:'bridge1',channel:'B',mode,reversed:true});
    near(motor1.currentMa,-motor2.currentMa);
    near(motor1.currentMa,result.parts.bridge1.channels.A.currentMa,1e-5);
    if(sign)assert.ok(Math.abs(motor1.voltage)>2.2&&Math.abs(motor1.voltage)<3);
  }
});

test('carrier checks polarity, supply range, shared control ground and SLP without conflating channels',()=>{
  const fresh=()=>makeMotorBridgeLesson().circuitData;
  const report=circuit=>new CircuitSimulator().solve(circuit,state(1,0)).parts.bridge1;
  const supply=circuit=>circuit.components.find(part=>part.type==='power');

  const viaVmm=fresh();
  viaVmm.wires.find(item=>item.b==='bridge1:VIN').b='bridge1:VMM';
  assert.equal(report(viaVmm).supplyPin,'VMM');
  assert.equal(report(viaVmm).channels.A.mode,'forward');
  near(report(viaVmm).voltage,3);

  const reversed=fresh();
  const positive=reversed.wires.find(item=>item.a==='motorSupply:+'),negative=reversed.wires.find(item=>item.a==='motorSupply:-');
  [positive.b,negative.b]=[negative.b,positive.b];
  assert.equal(report(reversed).reason,'supply');
  assert.equal(report(reversed).channels.A.mode,'coast');
  near(report(reversed).inputVoltage,-3);
  near(report(reversed).voltage,0);

  for(const voltage of [2.69,10.81]){
    const model=fresh();
    supply(model).voltage=voltage;
    assert.equal(report(model).reason,'supply');
  }
  for(const voltage of [2.7,10.8]){
    const model=fresh();
    supply(model).voltage=voltage;
    model.wires=model.wires.filter(item=>!item.b.startsWith('motor1:'));
    assert.equal(report(model).channels.A.mode,'forward');
  }

  const noGround=fresh();
  noGround.wires=noGround.wires.filter(item=>item.b!=='bridge1:GND2');
  assert.equal(report(noGround).reason,'ground');
  assert.equal(report(noGround).channels.A.mode,'coast');
  const sleep=fresh();
  sleep.wires.push(wire('slp','bridge1:SLP','bridge1:GND'));
  assert.equal(report(sleep).sleeping,true);
  assert.equal(report(sleep).channels.A.mode,'coast');

  const invalid=fresh();
  invalid.components.push({...makePart('power','logic'),voltage:1.2});
  invalid.wires=invalid.wires.filter(item=>item.b!=='bridge1:AIN1');
  invalid.wires.push(wire('logic1','logic:+','bridge1:AIN1'),wire('logic2','logic:-','bridge1:GND'),wire('bin1','mcu:PA0','bridge1:BIN1'));
  const mixed=report(invalid);
  assert.deepEqual(mixed.channels.A.inputs,[null,0]);
  assert.equal(mixed.channels.A.reason,'input');
  assert.equal(mixed.channels.B.mode,'forward');
});

test('calibrated FA-130 directly at 3 V matches the published current and speed, and default motor stays generic',()=>{
  const circuit=createCircuit('onboard');
  circuit.components=[{...makePart('power','supply'),voltage:3},{...makePart('motor','motor'),motorModel:'fa130-18100'}];
  circuit.wires=[wire('w1','supply:+','motor:+'),wire('w2','supply:-','motor:-'),wire('w3','supply:-','mcu:GND')];
  const solver=new CircuitSimulator();
  const initial=solver.solve(circuit,{timeMs:0}).parts.motor;
  near(initial.currentMa,2100);
  near(initial.rpm,0);
  const settled=solver.solve(circuit,{timeMs:2500}).parts.motor;
  near(settled.rpm,12300,.001);
  near(settled.currentMa,150,.001);
  const legacy=structuredClone(circuit);
  delete legacy.components[1].motorModel;
  near(new CircuitSimulator().solve(legacy,{timeMs:0}).parts.motor.currentMa,150);
});

test('elapsed time belongs to the old command; coast and brake begin with the same speed and very different winding current',()=>{
  const circuit=makeMotorBridgeLesson().circuitData;
  const coast=new CircuitSimulator(),brake=new CircuitSimulator(),forward=new CircuitSimulator();
  for(const sim of [coast,brake,forward]){
    const start=sim.solve(circuit,state(1,0)).parts.motor1;
    near(start.rpm,0);
    assert.ok(start.currentMa>1500&&start.currentMa<1700);
  }
  const c0=coast.solve(circuit,state(0,0,750)).parts.motor1;
  const b0=brake.solve(circuit,state(1,1,750)).parts.motor1;
  const driven=forward.solve(circuit,state(1,0,750)).parts.motor1;
  near(c0.rpm,driven.rpm);
  near(b0.rpm,driven.rpm);
  near(c0.angleDeg,b0.angleDeg);
  near(c0.currentMa,0,1e-5);
  assert.ok(b0.currentMa < -1400);
  assert.ok(b0.voltage>0&&b0.voltage<1);
  near(c0.voltage,c0.backEmf,1e-7);

  const c1=coast.solve(circuit,state(0,0,1050)).parts.motor1;
  const b1=brake.solve(circuit,state(1,1,1050)).parts.motor1;
  assert.ok(c1.rpm>7500&&c1.rpm<8100);
  assert.ok(b1.rpm>90&&b1.rpm<150);
  assert.ok(b1.currentMa<0&&b1.currentMa>b0.currentMa);
  assert.notEqual(c1.angleDeg,b1.angleDeg);
});

test('non-invasive snapshots and code restarts preserve the calibrated shaft without keeping the old drive command',()=>{
  const model=makeMotorBridgeLesson().circuitData,sim=new CircuitSimulator();
  sim.solve(model,state(1,0));
  const moving=sim.solve(model,state(1,0,200)).parts.motor1;
  const preview=sim.sampleAtCurrentTime(model,state(0,1,250)).parts.motor1;
  near(preview.rpm,moving.rpm);
  near(preview.angleDeg,moving.angleDeg);
  assert.ok(preview.currentMa<0);
  assert.equal(sim.lastTime,200);
  assert.equal(sim.lastResult.parts.motor1.bridge.mode,'forward');
  sim.reset({preserveMotorStates:true});
  const afterRestart=sim.solve(model,state(0,1)).parts.motor1;
  near(afterRestart.rpm,moving.rpm);
  near(afterRestart.angleDeg,moving.angleDeg);
  const reversed=sim.solve(model,state(0,1,250)).parts.motor1;
  assert.ok(reversed.rpm<0);
  sim.removeParts(['motor1']);
  near(sim.solve(model,state(0,1,250)).parts.motor1.rpm,0);
});

test('the actual SPL lesson changes stop behavior, with limits explicit for sampled PWM and overload',()=>{
  const lesson=makeMotorBridgeLesson(),circuit=validateCircuit(lesson.circuitData);
  for(const stop of ['coast','brake']){
    const files={'main.c':lesson.files['main.c'].replace('BRAKE_AT_STOP 0','BRAKE_AT_STOP '+Number(stop==='brake'))};
    const solver=new CircuitSimulator();
    const runtime=createBoardRuntime(compileForBoard(files,'bluepill'),{
      onBeforeDelay:(_,read)=>solver.solve(circuit,read(),{averagePWM:false})
    });
    let timeMs=0,reading;
    while(timeMs<1050){
      const next=runtime.runSlice(25);
      assert.equal(next.error,null);
      timeMs=next.timeMs;
      reading=readMotorBridgeLesson(solver.solve(circuit,next));
    }
    assert.equal(reading.mode,stop);
    assert.equal(reading.paired,true);
    assert.ok(stop==='coast'?reading.rpm>7500:reading.rpm<150);
  }
  const source=state(1,0);
  source.pins.PA0.pwm={frequencyHz:1000,duty:.5,startMs:0};
  assert.ok(new CircuitSimulator().solve(circuit,source).issues.some(issue=>issue.code==='DRV8833_PWM_LIMIT'));
  circuit.wires.push(wire('short','bridge1:AOUT1','bridge1:AOUT2'));
  assert.ok(new CircuitSimulator().solve(circuit,state(1,0)).issues.some(issue=>issue.code==='DRV8833_OVERCURRENT'));
});
