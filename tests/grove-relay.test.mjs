import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {advanceGroveRelay,groveRelayWave} from '../dist/grove-relay.js';

function setup() {
  const circuit=createCircuit('onboard');
  circuit.components=[
    makePart('grove-relay','relay'),
    {...makePart('power','battery'),voltage:3.3},
    makePart('resistor','r'),
    {...makePart('led','lamp'),color:'yellow'}
  ];
  circuit.wires=[
    ['mcu:5V','relay:VCC'],['mcu:GND1','relay:GND'],['mcu:PA0','relay:SIG'],
    ['battery:+','relay:COM'],['relay:NO','r:1'],['r:2','lamp:A'],['lamp:K','battery:-']
  ].map(([a,b],index)=>({a,b,id:'w'+(index+1),color:'#24384a'}));
  return circuit;
}

const dc=(timeMs,level)=>({timeMs,pins:{PA0:{mode:'GPIO_Mode_Out_PP',level}}});
const native=(timeMs,phaseMs,level)=>({timeMs,pins:{PA0:{mode:'GPIO_Mode_AF_PP',
  pwm:{timer:2,channel:1,frequencyHz:2,duty:.44,highFirst:true,phaseMs,level}}}});
const near=(actual,expected,tolerance=1e-5)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<tolerance,
  `${actual} ≈ ${expected}`);

test('DC input times the powered coil and mechanically delayed isolated COM/NO contact',()=>{
  const circuit=setup(),solver=new CircuitSimulator();
  for(const time of [0,9.99]){
    const {parts}=solver.solve(circuit,dc(time,1));
    assert.equal(parts.relay.indicator,true);
    assert.equal(parts.relay.closed,false);
    near(parts.relay.currentMa,100.001);
    assert.equal(parts.lamp.currentMa,0);
  }
  const on=solver.solve(circuit,dc(10,1));
  assert.equal(on.parts.relay.closed,true);
  near(on.parts.relay.contactCurrentMa,1.3/340.05*1000);
  near(on.parts.relay.contactCurrentMa,on.parts.lamp.currentMa);
  assert.equal(on.measureBetween('battery:-','mcu:GND').status,'floating');
  assert.equal(on.measureBetween('battery:+','relay:VCC').status,'floating');
  for(const time of [10,14.99]){
    const {parts}=solver.solve(circuit,dc(time,0));
    assert.equal(parts.relay.closed,true);
    assert.equal(parts.relay.indicator,false);
    near(parts.relay.currentMa,.001);
  }
  const {parts}=solver.solve(circuit,dc(15,0));
  assert.equal(parts.relay.closed,false);
  assert.equal(parts.lamp.currentMa,0);
});

test('a missing power or control wire opens the relay, and Grove pin 2 stays unconnected',()=>{
  const circuit=setup(),solver=new CircuitSimulator();
  solver.solve(circuit,dc(0,1));
  assert.equal(solver.solve(circuit,dc(10,1)).parts.relay.closed,true);
  const control=circuit.wires[2];
  control.b='relay:NC';
  let reading=solver.solve(circuit,dc(10,1)).parts.relay;
  assert.equal(reading.closed,false);
  assert.equal(reading.reason,'signal');
  assert.equal(reading.indicator,false);
  control.b='relay:SIG';
  circuit.wires=circuit.wires.filter(wire=>wire.id!=='w2');
  reading=solver.solve(circuit,dc(100,1)).parts.relay;
  assert.equal(reading.closed,false);
  assert.equal(reading.powered,false);
  assert.equal(reading.reason,'supply');
});

test('an electrically clamped SIG or sagging VCC cannot count hypothetical high PWM',()=>{
  const circuit=setup(),solver=new CircuitSimulator();
  const short={id:'short',a:'relay:SIG',b:'mcu:GND1'};
  circuit.wires.push(short);
  let reading=solver.solve(circuit,native(245,245,0)).parts.relay;
  assert.equal(reading.powered,true);
  assert.equal(reading.reason,'signal');
  assert.equal(reading.closed,false);
  circuit.wires.pop();
  circuit.components.push({...makePart('resistor','feed'),resistance:30});
  circuit.wires[0].a='feed:2';
  circuit.wires.push({id:'feedwire',a:'mcu:5V',b:'feed:1'});
  reading=solver.solve(circuit,native(525,25,1)).parts.relay;
  assert.equal(reading.closed,false);
  assert.equal(reading.powered,false);
  assert.equal(reading.reason,'supply');
  assert(reading.voltage<3.3);
  reading=solver.solve(circuit,native(745,245,0)).parts.relay;
  assert.equal(reading.closed,false);
  assert.equal(reading.powered,true);
  assert.equal(reading.reason,'supply');
});

test('timer phase reconstructs sparse press and release; short pulses cannot alias to continuous DC',()=>{
  const part=makePart('grove-relay','relay');
  let record;
  const sample=(timeMs,phaseMs,duty,inputHigh,extra={})=>{
    const wave=groveRelayWave({timer:2,channel:1,frequencyHz:2,phaseMs,duty,...extra},timeMs);
    record=advanceGroveRelay(record,part,timeMs,{powered:true,connected:true,controlKey:'same',inputHigh,wave});
    return record.closed;
  };
  assert.equal(sample(5,4,.44,true),false);
  assert.equal(sample(25,24,.44,true),true);
  assert.equal(sample(245,238,.44,false),false);
  assert.equal(sample(525,11,.44,true),true);
  assert.equal(sample(20_000,480,.44,false),false);
  record=undefined;
  assert.equal(sample(1,1,.004,true),false);
  assert.equal(sample(501,1,.004,true),false);
  assert.equal(sample(1001,null,.004,true),false);
  assert.equal(sample(1501,null,.004,true),false);
});

test('known 0% and 100% are fixed levels and inverted phase follows measured late high',()=>{
  const part=makePart('grove-relay','relay');
  let record;
  const sample=(timeMs,phaseMs,duty,inputHigh,highFirst=true)=>{
    const wave=groveRelayWave({timer:2,channel:1,frequencyHz:2,phaseMs,duty,highFirst},timeMs);
    record=advanceGroveRelay(record,part,timeMs,{powered:true,connected:true,controlKey:'same',inputHigh,wave});
    return record.closed;
  };
  assert.equal(sample(0,0,1,true),false);
  assert.equal(sample(10,10,1,true),true);
  assert.equal(sample(10,10,0,false),true);
  assert.equal(sample(15,15,0,false),false);
  record=undefined;
  assert.equal(sample(250,250,.44,false,false),false);
  assert.equal(sample(289,289,.44,true,false),false);
  assert.equal(sample(290,290,.44,true,false),true);
  assert.equal(sample(505,5,.44,false,false),false);
});
