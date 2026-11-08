import test from 'node:test';
import assert from 'node:assert/strict';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';
import {kingbrightRgbModel, rgbPwmCycle} from '../dist/rgb-led.js';
import {validateCircuit} from '../dist/project-import.js';

const names=['R','G','B'];
const gpio=['PA0','PA1','PA2'];
const dc=level=>({mode:'GPIO_Mode_Out_PP',level});
const pwm=(channel,duty,level,meta={})=>({mode:'GPIO_Mode_AF_PP',
  pwm:{timer:2,channel,frequencyHz:1000,duty,level,highFirst:true,...meta}});
const frame=(pins,timeMs=0)=>({timeMs,pins:Object.fromEntries(gpio.map((pin,index)=>[pin,pins[index]]))});
const near=(actual,expected,tolerance=1e-6)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<tolerance,
  `${actual} ≈ ${expected}`);

function setup({common='mcu:GND1',returnOhms=0}={}) {
  const circuit=createCircuit('onboard');
  circuit.components=[{...makePart('rgbled','lamp'),rgbModel:kingbrightRgbModel}];
  let n=0;
  function wire(a,b){circuit.wires.push({id:'w'+(++n),a,b,color:'#24384a'});}
  for(const [index,color] of names.entries()){
    const resistor={...makePart('resistor','r'+color),resistance:index===2?220:470};
    circuit.components.push(resistor);
    wire('mcu:'+gpio[index],resistor.id+':1');
    wire(resistor.id+':2','lamp:'+color);
  }
  if(returnOhms){
    circuit.components.push({...makePart('resistor','returnR'),resistance:returnOhms});
    wire('lamp:COM','returnR:1');
    wire('returnR:2',common);
  }else wire('lamp:COM',common);
  return circuit;
}

test('Kingbright fixed common cathode uses the low-current 3.3 V load-line fit',()=>{
  const circuit=setup(),solver=new CircuitSimulator();
  circuit.components[0].common='anode';
  const restored=validateCircuit(JSON.parse(JSON.stringify(circuit)));
  assert.equal(restored.components[0].rgbModel,kingbrightRgbModel);
  const lamp=solver.solve(restored,frame([dc(1),dc(1),dc(1)])).parts.lamp;
  assert.equal(lamp.common,'cathode');
  for(const [color,expected] of [['R',2.93519],['G',1.36392],['B',2.33861]]){
    const reading=lamp.channels[color];
    near(reading.currentMa,expected,.0001);
    assert.equal(reading.averageCurrentMa,reading.currentMa);
    assert.equal(reading.averageMethod,'dc');
  }
  const generic=setup();
  delete generic.components[0].rgbModel;
  const genericChannel=solver.solve(generic,frame([dc(1),dc(1),dc(1)])).parts.lamp.channels.R;
  near(genericChannel.currentMa,1.4/527*1000);
  assert.equal(genericChannel.averageCurrentMa,undefined);
});

test('three synchronized PWM sources solve each distinct shared-return phase, while sampling stays instantaneous',()=>{
  const circuit=setup({returnOhms:120}),solver=new CircuitSimulator();
  const phases=[
    {weight:.2,levels:[1,1,1]}, {weight:.3,levels:[1,1,0]}, {weight:.3,levels:[1,0,0]}, {weight:.2,levels:[0,0,0]}
  ];
  const expected=phases.map(({weight,levels})=>({weight,lamp:new CircuitSimulator().solve(circuit,frame(levels.map(dc))).parts.lamp}));
  const state=frame([pwm(1,.8,0),pwm(2,.5,0),pwm(3,.2,0)],.9);
  const result=solver.solve(circuit,state),lamp=result.parts.lamp;
  assert.deepEqual(result.issues.filter(issue=>issue.code.includes('PWM_AVERAGE')),[]);
  assert.equal(solver.lastTime,.9);
  for(const color of names){
    const data=lamp.channels[color];
    assert.equal(data.currentMa,0);
    assert.equal(data.averageMethod,'synchronized-cycle');
    near(data.averageCurrentMa,expected.reduce((sum,{weight,lamp})=>sum+weight*lamp.channels[color].currentMa,0));
    near(data.displayBrightness,expected.reduce((sum,{weight,lamp})=>sum+weight*lamp.channels[color].brightness,0));
  }
  const independentOnly=expected[2].lamp.channels.R.currentMa*.8;
  assert(lamp.channels.R.averageCurrentMa<independentOnly);
  const high=solver.sampleAtCurrentTime(circuit,frame([pwm(1,.8,1),pwm(2,.5,1),pwm(3,.2,1)],1));
  assert(high.parts.lamp.channels.R.currentMa>0);
  assert.equal(high.parts.lamp.channels.R.averageCurrentMa,null);
  assert.equal(solver.lastResult,result);
});

test('the phase plan handles inverted output, fixed duty, plain GPIO and missing synchronization',()=>{
  const tagged=[pwm(1,.75,1),pwm(2,.75,0,{highFirst:false}),pwm(3,1,1),pwm(4,0,0)]
    .map((p,index)=>({name:'PA'+index,p}));
  const cycle=rgbPwmCycle(tagged);
  assert.equal(cycle.method,'synchronized-cycle');
  assert.deepEqual(cycle.phases.map(({weight,levels})=>[weight,levels.map(([,level])=>level)]),[
    [.25,[1,0,1,0]],[.5,[1,1,1,0]],[.25,[0,1,1,0]]
  ]);
  const circuit=setup(),solver=new CircuitSimulator();
  let result=solver.solve(circuit,frame([pwm(1,0,0),pwm(2,1,1),dc(1)]));
  assert.deepEqual(names.map(name=>result.parts.lamp.channels[name].averageMethod),['dc','dc','dc']);
  assert.equal(result.parts.lamp.channels.R.averageCurrentMa,0);
  assert(result.parts.lamp.channels.G.averageCurrentMa>1);
  assert(result.parts.lamp.channels.B.averageCurrentMa>2);
  result=solver.solve(circuit,frame([pwm(1,.5,0),dc(1),pwm(3,0,0)]));
  assert.equal(result.parts.lamp.channels.R.averageMethod,'single-pwm');
  near(result.parts.lamp.channels.R.averageCurrentMa,2.93519/2,.0001);
  result=solver.solve(circuit,frame([pwm(1,.5,0),dc(1),pwm(3,.5,1,{timer:3})]));
  assert.equal(result.parts.lamp.channels.R.averageMethod,'instantaneous-only');
  assert.equal(result.parts.lamp.channels.B.averageCurrentMa,null);
  assert(result.parts.lamp.channels.B.currentMa>2);
  assert(result.parts.lamp.channels.G.averageCurrentMa>1);
  assert(result.issues.some(issue=>issue.code==='RGB_PWM_AVERAGE_LIMIT'));
});

test('unplugged or reversed branches stay dark, and a conflict in an alternate phase invalidates the average',()=>{
  const state=frame([pwm(1,.8,1),pwm(2,.5,1),pwm(3,.2,1)]),solver=new CircuitSimulator();
  const circuit=setup();
  circuit.wires=circuit.wires.filter(wire=>wire.b!=='lamp:G');
  let result=solver.solve(circuit,state);
  assert.equal(result.parts.lamp.channels.G.averageCurrentMa,0);
  assert.equal(result.parts.lamp.channels.G.displayBrightness,0);
  assert(result.parts.lamp.channels.R.averageCurrentMa>1);
  result=solver.solve(setup({common:'mcu:3V3'}),state);
  assert.deepEqual(names.map(name=>result.parts.lamp.channels[name].averageCurrentMa),[0,0,0]);
  const conflict=setup();
  conflict.wires.push({id:'short',a:'mcu:PA0',b:'mcu:PA1',color:'#24384a'});
  result=solver.solve(conflict,state);
  assert.equal(result.issues.some(issue=>issue.code==='OUTPUT_CONFLICT'),false);
  assert.equal(result.parts.lamp.channels.R.averageCurrentMa,null);
  assert(result.parts.lamp.channels.R.currentMa>1);
  assert(result.issues.some(issue=>issue.code==='RGB_PWM_AVERAGE_LIMIT'));
});
