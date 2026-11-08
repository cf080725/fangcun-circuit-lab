import test from 'node:test';
import assert from 'node:assert/strict';
import {planFault} from '../dist/fault-exercises.js';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {examples} from '../dist/content.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {validateCircuit} from '../dist/project-import.js';

const high={timeMs:1,pins:{PA0:{clock:true,mode:'GPIO_Mode_Out_PP',output:1}}};
const solve=(circuit,state=high)=>new CircuitSimulator().solve(circuit,state);
const codes=(circuit,state)=>solve(circuit,state).issues.map(issue=>issue.code);
const example=id=>examples.find(item=>item.id===id).files;

test('opening a LED return leaves an earlier ordinary diode and other LED wires alone',()=>{
 const circuit=createCircuit();
 circuit.components.unshift(makePart('diode','diode1'));
 circuit.wires.unshift({id:'diodeGround',a:'diode1:K',b:'mcu:GND1'});
 const before=structuredClone(circuit);
 const next=planFault('open',circuit,{}).circuit;
 assert.deepEqual(circuit,before);
 assert.deepEqual(next.wires.map(wire=>wire.id),['diodeGround','w1','w2']);
 assert.ok(codes(next).includes('OPEN_CIRCUIT'));
 assert.equal(planFault('open',next,{}).circuit,undefined);
 assert.doesNotThrow(()=>validateCircuit(next));
});

test('LED polarity exercise changes the physical ends and results without reassigning wire IDs',()=>{
 const circuit=createCircuit(),next=planFault('reverse',circuit,{}).circuit;
 assert.deepEqual(next.wires.map(wire=>wire.id),circuit.wires.map(wire=>wire.id));
 assert.ok(codes(next).includes('LED_REVERSED'));
 assert.equal(solve(next).parts.led1.displayBrightness,0);
 assert.deepEqual(planFault('reverse',next,{}).circuit,circuit);
 assert.equal(planFault('reverse',createCircuit('onboard'),{}).circuit,undefined);
});

test('a standalone LED exercise does not silently modify a dangling or parallel return',()=>{
 const circuit=createCircuit();
 circuit.wires.push({id:'ground2',a:'led1:K',b:'mcu:GND2'});
 assert.equal(planFault('open',circuit,{}).circuit,undefined);
 circuit.wires=circuit.wires.filter(wire=>wire.b!=='led1:A');
 assert.equal(planFault('reverse',circuit,{}).circuit,undefined);
});

test('the 1 Ω exercise targets a wired resistor and produces a repeatable overcurrent',()=>{
 const circuit=createCircuit();
 circuit.components.unshift(makePart('resistor','unused'));
 const next=planFault('resistor',circuit,{}).circuit;
 assert.equal(next.components.find(part=>part.id==='unused').resistance,330);
 assert.equal(next.components.find(part=>part.id==='r1').resistance,1);
 assert.ok(codes(next).includes('LED_OVERCURRENT'));
 assert.equal(planFault('resistor',next,{}).circuit,undefined);
});

test('the plugged LED lesson can reverse or unplug only the LED while preserving jumpers',()=>{
 const circuit=createCircuit('plugged-led'),before=structuredClone(circuit);
 assert.ok(solve(circuit).parts.led1.currentMa>3);
 assert.ok(!codes(circuit).includes('OPEN_CIRCUIT'));

 const reversed=planFault('reverse',circuit,{}).circuit;
 assert.deepEqual(reversed.components[0].mount,{hole:'bb:a11',rotation:180});
 assert.deepEqual(reversed.wires,circuit.wires);
 assert.deepEqual(reversed.components[1],circuit.components[1]);
 assert.ok(codes(reversed).includes('LED_REVERSED'));
 assert.deepEqual(planFault('reverse',reversed,{}).circuit,circuit);
 assert.doesNotThrow(()=>validateCircuit(reversed));

 const opened=planFault('open',circuit,{}).circuit;
 assert.ok(!Object.hasOwn(opened.components[0],'mount'));
 assert.deepEqual(opened.wires,circuit.wires);
 assert.equal(solve(opened).parts.led1.currentMa,0);
 assert.ok(codes(opened).includes('OPEN_CIRCUIT'));
 assert.deepEqual(circuit,before);
});

test('physically reversing a mounted LED validates the destination and respects its lock',()=>{
 const circuit=createCircuit('plugged-led');
 circuit.components[0].locked=true;
 assert.equal(planFault('reverse',circuit,{}).circuit,undefined);
 assert.equal(planFault('open',circuit,{}).circuit,undefined);
 circuit.components[0].locked=false;
 circuit.wires.push({id:'occupiedHole',a:'bb:a11',b:'bb:p2'});
 assert.equal(planFault('reverse',circuit,{}).circuit,undefined);
});

test('the 1 Ω insertion exercise targets a direct series junction and leaves unrelated or branched paths alone',()=>{
 const circuit=createCircuit('plugged-led');
 circuit.components.unshift({...makePart('resistor','unused'),mount:{hole:'bb:j1',rotation:0}});
 const next=planFault('resistor',circuit,{}).circuit;
 assert.equal(next.components.find(part=>part.id==='unused').resistance,330);
 assert.equal(next.components.find(part=>part.id==='r1').resistance,1);
 assert.ok(codes(next).includes('LED_OVERCURRENT'));
 assert.deepEqual(next.wires,circuit.wires);
 circuit.wires.push({id:'branch',a:'bb:d11',b:'bb:p2'});
 assert.equal(planFault('resistor',circuit,{}).circuit,undefined);
});

test('short exercise is powered, unique across physical aliases and JSON importable',()=>{
 for(const boardId of ['bluepill','uno-r3','nucleo-f103rb','pico']){
  const circuit=createCircuit('blink',boardId),next=planFault('short',circuit,{}).circuit;
  assert.equal(next.wires.length,circuit.wires.length+1);
  assert.ok(codes(next).includes('SUPPLY_SHORT'),boardId);
  assert.equal(planFault('short',next,{}).circuit,undefined);
  assert.doesNotThrow(()=>validateCircuit(next));
 }
 const circuit=createCircuit();
 circuit.wires.push({id:'aliasShort',a:'mcu:GND2',b:'mcu:3V3b'});
 assert.equal(planFault('short',circuit,{}).circuit,undefined);
 const poweredOff=planFault('power',circuit,{}).circuit;
 assert.equal(poweredOff.powered,false);
 assert.equal(planFault('power',poweredOff,{}).circuit,undefined);
 assert.equal(planFault('short',poweredOff,{}).circuit,undefined);
});

test('clock exercise keeps ADC clock on and detects a real GPIO fault after rerunning',()=>{
 const circuit=createCircuit('adc'),source=example('adc');
 const next=planFault('clock',circuit,source);
 assert.match(next.files['main.c'],/\| RCC_APB2Periph_ADC1, ENABLE\)/);
 assert.equal(next.files['main.c'].split('\n').length,source['main.c'].split('\n').length);
 const runtime=createBoardRuntime(compileForBoard(next.files,'bluepill'));
 const state=runtime.runUntilDelay(2000);
 assert.equal(state.clocks.ADC1,true);
 assert.ok(!state.clocks.GPIOA);
 assert.ok(state.diagnostics.some(issue=>issue.code==='CLOCK_DISABLED'));
 assert.ok(codes(circuit,state).includes('GPIO_CLOCK'));
 assert.equal(planFault('clock',circuit,next.files).files,undefined);
});

test('clock exercise ignores comments, strings, DISABLE and macro declarations and keeps source locations',()=>{
 const circuit=createCircuit(),commented={ 'first.c':[
  '// RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);',
  '/* RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE); */',
  'const char *s = "RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);";',
  '#define ENABLE_PINS() RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);',
  'RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, DISABLE);'
 ].join('\n')};
 assert.equal(planFault('clock',circuit,commented).files,undefined);
 const source={...commented,...example('blink')};
 const next=planFault('clock',circuit,source);
 assert.equal(next.files['first.c'],commented['first.c']);
 assert.equal(next.activeFile,'main.c');
 assert.match(next.files['main.c'],/RCC_APB2Periph_GPIOA, DISABLE/);
 assert.equal(planFault('clock',createCircuit('blink','uno-r3'),source).files,undefined);
});

test('locked and hidden objects retain electrical behavior and diagnostics',()=>{
 const circuit=createCircuit(),baseline=solve(circuit);
 for(const part of circuit.components)Object.assign(part,{hidden:true,locked:true,rotation:90});
 const edited=solve(validateCircuit(circuit));
 assert.deepEqual(edited.parts,baseline.parts);
 assert.deepEqual(edited.issues,baseline.issues);
 assert.deepEqual(edited.netVoltages,baseline.netVoltages);
});
