import test from 'node:test';import assert from 'node:assert/strict';import{CircuitSimulator,createCircuit,makePart}from'../dist/circuit.js';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {makePassiveBreadboardExercises} from '../dist/passive-breadboard-exercises.js';
const out=(level,mode='GPIO_Mode_Out_PP')=>({mode,level,clock:true});
test('PA0电流经过330Ω与LED，高电平点亮、低电平熄灭',()=>{let s=new CircuitSimulator(),c=createCircuit();let a=s.solve(c,{pins:{PA0:out(1)},timeMs:1});assert(a.converged);assert(a.parts.led1.currentMa>3&&a.parts.led1.currentMa<5);let b=s.solve(c,{pins:{PA0:out(0)},timeMs:2});assert(b.parts.led1.brightness===0);});
test('LED反接被诊断且不发光',()=>{let s=new CircuitSimulator(),c=createCircuit();for(let w of c.wires){if(w.a==='led1:K')w.a='led1:A';if(w.b==='led1:A')w.b='led1:K';}let r=s.solve(c,{pins:{PA0:out(1)},timeMs:1});assert(r.issues.some(x=>x.code==='LED_REVERSED'));assert.equal(r.parts.led1.brightness,0);});
test('移除限流电阻导致过流',()=>{let s=new CircuitSimulator(),c=createCircuit();c.components=c.components.filter(p=>p.id!=='r1');c.wires=c.wires.filter(w=>!w.a.startsWith('r1:')&&!w.b.startsWith('r1:'));c.wires.push({id:'shortR',a:'mcu:PA0',b:'led1:A'});let r=s.solve(c,{pins:{PA0:out(1)},timeMs:1});assert(r.issues.some(x=>x.code==='LED_OVERCURRENT'));});
test('输入上拉按钮松开1、按下0',()=>{let s=new CircuitSimulator(),c=createCircuit('button'),state={pins:{PB1:out(0,'GPIO_Mode_IPU')},timeMs:1};assert.equal(s.solve(c,state).readPin('PB1'),1);c.components.find(p=>p.type==='button').pressed=true;assert.equal(s.solve(c,state).readPin('PB1'),0);});
test('电位器分压转换为12位ADC读数',()=>{let s=new CircuitSimulator(),c=createCircuit('adc');c.components.find(p=>p.type==='pot').position=.75;let r=s.solve(c,{pins:{PA1:out(0,'GPIO_Mode_AIN')},timeMs:1});assert(Math.abs(r.readADC(1)-3071)<=2);});
test('面包板五孔相通，沟槽两侧不通',()=>{let s=new CircuitSimulator(),c=createCircuit();c.wires=[{a:'mcu:3V3',b:'bb:a1'},{a:'bb:e1',b:'r1:1'},{a:'r1:2',b:'led1:A'},{a:'led1:K',b:'mcu:GND1'}];assert(s.solve(c,{pins:{},timeMs:1}).parts.led1.brightness>0);c.wires[1].a='bb:f1';assert(s.solve(c,{pins:{},timeMs:2}).parts.led1.brightness<.001);});
test('电源短路触发明确错误',()=>{let s=new CircuitSimulator(),c=createCircuit();c.wires.push({a:'mcu:3V3',b:'mcu:GND1'});assert(s.solve(c,{pins:{},timeMs:1}).issues.some(x=>x.code==='SUPPLY_SHORT'));});
test('推挽高低电平相连触发输出争用',()=>{let s=new CircuitSimulator(),c=createCircuit();c.wires.push({a:'mcu:PA0',b:'mcu:PA1'});assert(s.solve(c,{pins:{PA0:out(1),PA1:out(0)},timeMs:1}).issues.some(x=>x.code==='OUTPUT_CONFLICT'));});
test('PC13板载灯低有效',()=>{let s=new CircuitSimulator(),c=createCircuit('onboard');assert(s.solve(c,{pins:{PC13:out(0)},timeMs:1}).parts.onboard.brightness>.5);assert.equal(s.solve(c,{pins:{PC13:out(1)},timeMs:2}).parts.onboard.brightness,0);});

test('classic Nano L uses the original 330 Ω load and reports solved high and low current', () => {
  const circuit = createCircuit('blink', 'nano');
  const solver = new CircuitSimulator();
  assert.equal(getBoardProfile('nano').ledResistance, 330);
  assert.equal(getBoardProfile('uno-r3').ledResistance, 1000);
  const solve = level => solver.solve(circuit, {pins:{D13:out(level,'OUTPUT')},timeMs:1+level});
  const low = solve(0);
  assert.equal(low.parts.onboard.currentMa, 0);
  assert.equal(low.parts.onboard.brightness, 0);
  const high = solve(1);
  const expectedMa = (5-2)/(47+330+10)*1000;
  assert.ok(high.converged);
  assert.deepEqual(high.issues, []);
  assert.ok(Math.abs(high.parts.onboard.currentMa-expectedMa)<1e-7);
  assert.ok(Math.abs(high.netVoltages['mcu:D13']-(5-47*expectedMa/1000))<1e-7);
  assert.equal(high.parts.onboard.brightness, 1);
});

test('UNO R3 L follows solved D13 voltage without loading the GPIO', () => {
  const circuit = createCircuit('blink','uno-r3');
  const solver = new CircuitSimulator();
  const solve = (level,timeMs) => solver.solve(circuit,{timeMs,pins:{D13:out(level)}});
  const closeTo = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-7,`${actual} ≈ ${expected}`);

  const high = solve(1,1);
  closeTo(high.netVoltages['mcu:D13'],5);
  closeTo(high.parts.onboard.currentMa,3/1010*1000);
  assert.equal(solve(0,2).parts.onboard.currentMa,0);

  circuit.components = [makePart('resistor','load')];
  circuit.wires = [{a:'mcu:D13',b:'load:1'},{a:'load:2',b:'mcu:GND1'}];
  const loaded = solve(1,3);
  const voltage = 5*330/(330+47);
  closeTo(loaded.netVoltages['mcu:D13'],voltage);
  closeTo(loaded.parts.load.currentMa,voltage/330*1000);
  closeTo(loaded.parts.onboard.currentMa,(voltage-2)/1010*1000);
  assert.ok(!loaded.issues.some(issue=>issue.code==='GPIO_OVERCURRENT'));
});

test('UNO R3 L can follow a biased input but does not invent a floating or unpowered reading', () => {
  const circuit = createCircuit('blink','uno-r3');
  circuit.wires = [{a:'mcu:D13',b:'bb:a1'}];
  const solver = new CircuitSimulator();
  const pins = {D13:out(0,'INPUT')};
  const floating = solver.solve(circuit,{timeMs:1,pins});
  assert.deepEqual(floating.measureBetween('mcu:D13','mcu:GND'),{status:'floating',voltage:null});
  assert.ok(floating.issues.some(issue=>issue.code==='INPUT_FLOATING'&&issue.part==='D13'));
  assert.equal(floating.parts.onboard.currentMa,undefined);

  const pulledUp = solver.solve(circuit,{timeMs:2,pins:{D13:out(0,'INPUT_PULLUP')}});
  assert.ok(pulledUp.parts.onboard.currentMa>2.9);
  assert.equal(pulledUp.readPin('D13'),1);

  circuit.wires.push({a:'bb:e1',b:'mcu:3V3'});
  const driven = solver.solve(circuit,{timeMs:3,pins});
  assert.ok(Math.abs(driven.parts.onboard.currentMa-1.3/1010*1000)<1e-7);
  circuit.powered = false;
  assert.equal(solver.solve(circuit,{timeMs:4,pins}).parts.onboard.currentMa,undefined);
});

test('UNO R3 L exposes cycle-average current alongside the instantaneous PWM reading', () => {
  const circuit = createCircuit('blink','uno-r3');
  circuit.wires = [{a:'mcu:D9',b:'mcu:D13'}];
  const solver = new CircuitSimulator();
  const state = level => ({timeMs:1,pins:{D13:out(0,'INPUT'),D9:{...out(level),pwm:{level,duty:.25,frequencyHz:490}}}});
  const low = solver.solve(circuit,state(0)).parts.onboard;
  const high = solver.solve(circuit,state(1)).parts.onboard;
  assert.equal(low.currentMa,0);
  assert.ok(high.currentMa>2.9);
  assert.equal(low.pwmAverage.pin,'D9');
  assert.equal(low.pwmAverage.currentMa,high.pwmAverage.currentMa);
  assert.ok(Math.abs(low.pwmAverage.currentMa-.25*high.currentMa)<1e-8);
  assert.equal(low.displayBrightness,high.displayBrightness);
  assert.ok(Math.abs(high.displayBrightness-.25*high.brightness)<1e-8);
  const sampled = solver.sampleAtCurrentTime(circuit,state(1)).parts.onboard;
  assert.equal(sampled.currentMa,high.currentMa);
  assert.equal(sampled.displayBrightness,sampled.brightness);
  assert.equal(sampled.pwmAverage,undefined);
});

test('UNO R3 buffer and classic Nano resistance do not leak into derivative profiles', () => {
  for (const boardId of ['mega2560','uno-r4-minima','uno-r4-wifi','nano-every']) {
    const circuit = {...createCircuit('blink',boardId),wires:[],components:[]};
    const {parts,netVoltages} = new CircuitSimulator().solve(circuit,{timeMs:1,pins:{D13:out(1)}});
    assert.equal(getBoardProfile(boardId).ledResistance,1000);
    const current = 3/(47+1000+10)*1000;
    assert.ok(Math.abs(parts.onboard.currentMa-current)<1e-7,boardId);
    assert.ok(Math.abs(netVoltages['mcu:D13']-(5-.047*current))<1e-7,boardId);
  }
});

test('onboard LED current is absent when the branch or a valid solve is unavailable', () => {
  const circuit = createCircuit('blink', 'nano');
  const state = {pins:{D13:out(1,'OUTPUT')},timeMs:1};
  const solver = new CircuitSimulator();
  const unpowered = solver.solve({...circuit,powered:false},state);
  assert.equal(unpowered.parts.onboard.currentMa, undefined);
  const noLed = solver.solve(createCircuit('blink','esp32-devkitc'));
  assert.equal(noLed.parts.onboard.currentMa, undefined);
  const shorted = solver.solve({...circuit,wires:[{a:'mcu:5V',b:'mcu:GND1'}]},state);
  assert.ok(shorted.issues.some(issue=>issue.code==='SUPPLY_SHORT'));
  assert.equal(shorted.parts.onboard.currentMa, undefined);
});

test('the seated diode and LED share the same series current, including under PWM', () => {
  const {circuitData:circuit} = makePassiveBreadboardExercises().find(example=>example.id==='plugged-diode');
  const solver = new CircuitSimulator();
  const solve = (level,pwm) => solver.solve(circuit,{timeMs:1,pins:{PA0:{...out(level),pwm}}});
  const high = solve(1);
  const currentMa = (3.3-.7-1.9)/(47+330+10+10)*1000;
  assert.ok(high.converged);
  assert.deepEqual(high.issues,[]);
  assert.ok(Math.abs(high.parts.d1.currentMa-currentMa)<1e-7);
  assert.ok(Math.abs(high.parts.led1.currentMa-currentMa)<1e-7);
  assert.equal(solve(0).parts.led1.currentMa,0);

  const pwm = solve(1,{level:1,duty:.25,frequencyHz:1000});
  assert.ok(pwm.converged);
  assert.ok(Math.abs(pwm.parts.led1.displayBrightness-high.parts.led1.brightness*.25)<1e-8);
  circuit.components.find(part=>part.id==='d1').mount={hole:'bb:a13',rotation:180};
  const reversed = solve(1);
  assert.ok(reversed.converged);
  assert.equal(reversed.parts.d1.currentMa,0);
  assert.equal(reversed.parts.led1.currentMa,0);
});

test('cross-coupled diode regions converge instead of cycling and overstating branch current', () => {
  const circuit = createCircuit('onboard');
  circuit.components = [{...makePart('power','aux'),voltage:4.7},{...makePart('resistor','r1'),resistance:4700}];
  const [input,coupled,reference] = ['bb:a1','bb:a2','bb:a3'];
  circuit.wires = [{a:'aux:-',b:'mcu:GND'},{a:'r1:1',b:'mcu:3V3'},{a:'r1:2',b:input}];
  const paths = [
    ['aux:+',reference,.6],[coupled,reference,.7],[coupled,'mcu:GND',.6],
    [input,'mcu:GND',.6],[input,coupled,.6],[coupled,input,.3]
  ];
  paths.forEach(([a,b,forwardVoltage],index)=>{
    const id='d'+index;
    circuit.components.push({...makePart('diode',id),forwardVoltage});
    circuit.wires.push({a:id+':A',b:a},{a:id+':K',b:b});
  });
  const result = new CircuitSimulator().solve(circuit);
  assert.ok(result.converged);
  assert.deepEqual(result.issues,[]);
  assert.ok(Math.abs(result.parts.d3.currentMa-(3.3-.6)/(4700+10)*1000)<1e-5);
  assert.ok(Math.abs(result.netVoltages[coupled]-.6)<1e-6);
  assert.ok(Math.abs(result.netVoltages[reference]-4.1)<1e-6);
  assert.equal(result.parts.d4.currentMa,0);
  assert.equal(result.parts.d5.currentMa,0);
});

test('NUCLEO-F103RB reads B1 through the onboard pull-up and drives LD2 high', () => {
  const circuit = createCircuit('blink', 'nucleo-f103rb');
  assert.deepEqual(circuit.wires, []);
  const solver = new CircuitSimulator();
  const io = createAvrCircuitIO(() => circuit, solver);
  const state = { boardId: circuit.boardId, timeMs: 1, pins: { PC13: out(0, 'GPIO_Mode_IN_FLOATING'), PA5: out(0) } };
  assert.deepEqual(io.readInputs(state), { PC13: 1 });
  assert.equal(solver.solve(circuit, state).parts.onboard.brightness, 0);

  circuit.board.userButtonPressed = true;
  state.pins.PA5.level = 1;
  assert.deepEqual(io.readInputs(state), { PC13: 0 });
  const pressed = solver.solve(circuit, state);
  assert.equal(pressed.readPin('CN7_23'), 0);
  assert.ok(pressed.parts.onboard.brightness > 0.5);

  circuit.board.userButtonPressed = false;
  assert.deepEqual(io.readInputs(state), { PC13: 1 });
  assert.ok(solver.solve(circuit, state).netVoltages['mcu:CN7_23'] > 3.29);
});

test('initial sampling uses the instantaneous PWM level without running visual averages', () => {
  const circuit=createCircuit('blink'),solver=new CircuitSimulator();
  const high={timeMs:0,pins:{PA0:{...out(1),pwm:{level:1,duty:.25,frequencyHz:1000}}}};
  const low={...high,pins:{PA0:{...high.pins.PA0,pwm:{...high.pins.PA0.pwm,level:0}}}};
  const lit=solver.sampleAtCurrentTime(circuit,high),dark=solver.sampleAtCurrentTime(circuit,low);
  assert.ok(lit.converged&&dark.converged);
  assert.ok(lit.netVoltages['mcu:PA0']>3);
  assert.ok(dark.netVoltages['mcu:PA0']<.01);
  assert.deepEqual(lit.measureBetween('mcu:PA0','mcu:GND1'),{status:'measured',voltage:lit.netVoltages['mcu:PA0']});
  assert.ok(lit.parts.led1.brightness>0);
  assert.equal(lit.parts.led1.displayBrightness,lit.parts.led1.brightness);
  assert.equal(lit.parts.led1.pwmAverage,undefined);
  assert.equal(dark.parts.led1.brightness,0);
  assert.equal(solver.lastResult,null);
  assert.equal(solver.boardId,null);
  assert.equal(solver.lastTime,0);
});

test('samples at and after the committed time hold capacitor and motor state and refuse historical time', () => {
  const circuit=createCircuit('onboard'),solver=new CircuitSimulator(),reference=new CircuitSimulator();
  circuit.components=[{...makePart('resistor','r'),resistance:1000},makePart('capacitor','cap'),makePart('motor','motor')];
  circuit.wires=[['mcu:3V3','r:1'],['r:2','cap:+'],['cap:-','mcu:GND1'],['mcu:PA1','motor:+'],['motor:-','mcu:GND1']]
    .map(([a,b])=>({a,b}));
  const high={timeMs:100,pins:{PA1:out(1)}};
  const committed=solver.solve(circuit,high);
  reference.solve(circuit,high);
  const charges=structuredClone(solver.capVoltages),motors=structuredClone(solver.motorStates);
  const diagnostics=structuredClone(committed.issues),project=structuredClone(circuit);
  assert.ok(committed.parts.motor.rpm>0&&charges.cap>0);

  for(const timeMs of [100,200]){
    const sample=solver.sampleAtCurrentTime(circuit,{timeMs,pins:{PA1:out(0)}});
    assert.ok(sample.converged);
    assert.ok(Math.abs(sample.netVoltages['cap:+']-charges.cap)<1e-7);
    assert.equal(sample.parts.motor.rpm,committed.parts.motor.rpm);
    assert.equal(sample.parts.motor.angleDeg,committed.parts.motor.angleDeg);
    assert.ok(sample.netVoltages['mcu:PA1']<committed.netVoltages['mcu:PA1']);
  }
  assert.equal(solver.sampleAtCurrentTime(circuit,{...high,timeMs:99}),null);
  assert.equal(solver.sampleAtCurrentTime(circuit,{...high,timeMs:NaN}),null);
  assert.equal(solver.lastResult,committed);
  assert.equal(solver.lastTime,100);
  assert.equal(solver.boardId,'bluepill');
  assert.deepEqual(solver.capVoltages,charges);
  assert.deepEqual(solver.motorStates,motors);
  assert.deepEqual(solver.lastResult.issues,diagnostics);
  assert.deepEqual(circuit,project);

  const later={timeMs:200,pins:{PA1:out(1)}};
  assert.deepEqual(solver.solve(circuit,later).netVoltages,reference.solve(circuit,later).netVoltages);
  assert.deepEqual(solver.capVoltages,reference.capVoltages);
  assert.deepEqual(solver.motorStates,reference.motorStates);
});
