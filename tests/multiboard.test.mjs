import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_PROFILE_LIST,boardStarterKinds,getBoardProfile,makeBoardStarter,canonicalPin} from '../dist/board-profiles.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';
import {CircuitSimulator,makePart,PARTS} from '../dist/circuit.js';
import {BOARD_CATALOG} from '../dist/catalog-data.js';

const wire=(a,b,id='w')=>({id,a,b});
function fixture(boardId,kind='blink',files=null){
 const starter=makeBoardStarter(boardId,kind),circuit=starter.circuit,solver=new CircuitSimulator();let runtime;
 runtime=createBoardRuntime(compileForBoard(files||starter.files,boardId),{
  readPin:n=>solver.solve(circuit,runtime.getState(),{averagePWM:false}).readPin(n),
  readADC:n=>solver.solve(circuit,runtime.getState(),{averagePWM:false}).readADC(n)
 },boardId);
 const tick=()=>{const state=runtime.runUntilDelay(1000);assert.equal(state.error,null,state.error?.plain);const result=solver.solve(circuit,state);assert.ok(result.converged);return {state,result};};
 return {starter,circuit,solver,runtime,tick};
}
const brightness=(result,id='led1')=>result.parts[id].displayBrightness;
function minimumOnBrightness(board){
 if(!board.starterLedResistance)return .3;
 const branchResistance=board.starterLedResistance+board.driverOhms+10;
 const expectedCurrentMa=(board.logicVoltage-1.9)*1000/branchResistance;
 return expectedCurrentMa/7*.9;
}
const errors=r=>r.issues.filter(x=>x.severity==='error').map(x=>x.code);

test('registered profiles have unique visible pins and every starter wire lands on a physical endpoint',()=>{
 assert.deepEqual(BOARD_PROFILE_LIST.map(p=>p.id).sort(),BOARD_CATALOG.flatMap(item=>item.profileId?[item.profileId]:[]).sort());
 for(const board of BOARD_PROFILE_LIST){
  const ids=new Set(board.pins.map(p=>p.id));assert.equal(ids.size,board.pins.length,board.id);
  for(const p of board.pins){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.equal(canonicalPin(p.id,board.id),p.canonical);}
  for(const kind of boardStarterKinds(board))for(const w of makeBoardStarter(board.id,kind).circuit.wires)
   for(const endpoint of [w.a,w.b])if(endpoint.startsWith('mcu:'))assert.ok(ids.has(endpoint.slice(4)),board.id+' '+kind+' invisible '+endpoint);
 }
});

test('all registered actual source programs alternate their real onboard or external LED',()=>{
 for(const board of BOARD_PROFILE_LIST){
  const f=fixture(board.id),id=board.ledPin?'onboard':'led1';
  let x=f.tick();assert.equal(x.state.timeMs,500);assert.ok(brightness(x.result,id)>minimumOnBrightness(board),board.id);assert.deepEqual(errors(x.result),[]);
  assert.equal(x.result.logicVoltage,board.logicVoltage);
  if(!board.ledPin)assert.equal(brightness(x.result,'onboard'),0);
  x=f.tick();assert.equal(x.state.timeMs,1000);assert.equal(brightness(x.result,id),0,board.id);
 }
});

test('all registered button circuits feed solved input levels back into the executed branch',()=>{
 for(const board of BOARD_PROFILE_LIST){
  const f=fixture(board.id,'button'),button=f.circuit.components.find(x=>x.type==='button');
  let x=f.tick();assert.equal(brightness(x.result),0,board.id);assert.ok(x.result.netVoltages['mcu:'+board.defaultPins.button]>board.logicVoltage-.1);
  button.pressed=true;x=f.tick();assert.ok(brightness(x.result)>minimumOnBrightness(board),board.id);assert.deepEqual(errors(x.result),[]);
  button.pressed=false;x=f.tick();assert.equal(brightness(x.result),0,board.id);
 }
});

test('all registered ADC circuits honor native raw scale and the selected Arduino default resolution',()=>{
 for(const board of BOARD_PROFILE_LIST.filter(profile=>profile.capabilities.analogInput)){
  const f=fixture(board.id,'adc'),pot=f.circuit.components.find(x=>x.type==='pot');
  pot.position=0;let x=f.tick();assert.equal(x.state.variables.adcValue,0,board.id);assert.equal(brightness(x.result),0);
  pot.position=1;x=f.tick();
  // The teaching potentiometer keeps at least 1 Ω in series at each end.
  assert.ok(board.adcMax-x.result.readADC(board.defaultPins.adc)<=Math.ceil(board.adcMax/pot.resistance),board.id);
  assert.equal(x.state.variables.adcValue,2**board.adcDefaultBits-1,board.id);assert.ok(brightness(x.result)>minimumOnBrightness(board));assert.deepEqual(errors(x.result),[]);
  pot.position=.5;x=f.tick();assert.ok(Math.abs(x.state.variables.adcValue-(2**board.adcDefaultBits-1)/2)<=1,board.id);
 }
});

test('all registered PWM starters expose board frequency and visually averaged current response',()=>{
 for(const board of BOARD_PROFILE_LIST.filter(profile=>profile.capabilities.pwm)){
  const f=fixture(board.id,'pwm');let x=f.tick();assert.equal(brightness(x.result),0,board.id);
  x=f.tick();const pwm=x.state.pins[board.defaultPins.pwm].pwm;assert.equal(pwm.duty,5/255,board.id);
  assert.equal(pwm.frequencyHz,board.pwmFrequencies?.[board.defaultPins.pwm]||board.pwmFrequency);
  assert.ok(brightness(x.result)>0&&brightness(x.result)<.04,board.id);assert.deepEqual(errors(x.result),[]);
 }
});

test('GPIO aliases share actual nodes; 5V outputs and wrong board selection are explicit',()=>{
 const f=fixture('nucleo-f401re','button');let x=f.tick();
 const alias=getBoardProfile('nucleo-f401re').pins.find(p=>p.canonical==='PB1').id;
 assert.equal(x.result.readPin(alias),x.result.readPin('PB1'));
 assert.equal(x.result.netVoltages['mcu:'+alias],x.result.netVoltages['mcu:PB1']);
 const uno=fixture('uno-r3');x=uno.tick();assert.ok(x.result.netVoltages['mcu:D13']>4.7);
 const wrong=uno.solver.solve({...uno.circuit,boardId:'pico'},x.state);
 assert.ok(errors(wrong).includes('BOARD_MISMATCH'));
});

test('input-only, reserved Flash and analog-only pins reject incompatible output use',()=>{
 for(const [board,pin,code] of [['esp32-devkitc','34','BOARD_INPUT_ONLY'],['esp32-devkitc','6','BOARD_PIN_RESERVED'],['nano','A6','BOARD_INPUT_ONLY']]){
  const runtime=createBoardRuntime(compileForBoard({'sketch.ino':`void setup(){pinMode(${pin}, OUTPUT);} void loop(){delay(1);}`},board));
  const s=runtime.runUntilDelay(200);assert.ok(s.error,board+' '+pin);assert.equal(s.error.code,code);assert.ok(s.diagnostics.some(d=>d.code===code&&d.severity==='error'));
 }
 const analogOnly=createBoardRuntime(compileForBoard({'sketch.ino':'void setup(){digitalRead(A6);}void loop(){delay(1);}'},'nano')).runUntilDelay(200);
 assert.equal(analogOnly.error?.code,'BOARD_ANALOG_ONLY');
 assert.throws(()=>compileForBoard({'main.c':'int main(void){return 0;}'},'nucleo-f401re'),e=>e.diagnostics?.[0]?.code==='BOARD_DIALECT');
 assert.throws(()=>compileForBoard({'sketch.ino':'void setup(){analogReadResolution(12);}void loop(){}'},'uno-r3'),e=>e.diagnostics?.some(d=>d.code==='BOARD_API'));
 assert.throws(()=>compileForBoard({'sketch.ino':'void setup(){MissingDriver();}void loop(){}'},'pico'),e=>e.diagnostics?.some(d=>d.code==='UNSUPPORTED_API'));
});

test('Arduino serial executes print, character, float, receive queue and virtual millis',()=>{
 const code=`unsigned long elapsed=0; void setup(){Serial.begin(9600);Serial.print('A');Serial.print(255,HEX);Serial.println(1.25,2);} void loop(){if(Serial.available()){Serial.write(Serial.read());}elapsed=millis();delay(25);}`;
 const f=fixture('uno-r3','blink',{'sketch.ino':code});let x=f.tick();assert.equal(x.state.serial,'AFF1.25\r\n');assert.equal(x.state.variables.elapsed,0);
 f.runtime.injectSerial('Z');x=f.tick();assert.equal(x.state.serial,'AFF1.25\r\nZ');assert.equal(x.state.variables.elapsed,25);
 const pico=fixture('pico','adc',{'sketch.ino':'int value=0;void setup(){analogReadResolution(12);}void loop(){value=analogRead(A0);delay(1);}'});
 pico.circuit.components.find(p=>p.type==='pot').position=1;assert.equal(pico.tick().state.variables.value,4095);
 const avr=fixture('uno-r3','adc',{'sketch.ino':'int value=0;void setup(){}void loop(){value=analogRead(0);delay(1);}'});
 avr.circuit.components.find(p=>p.type==='pot').position=1;assert.equal(avr.tick().state.variables.value,1023);
});

function empty(boardId='uno-r3'){return {version:2,boardId,powered:true,components:[],wires:[],board:{x:0,z:0}};}
test('LDR and NTC models change solved voltage in the expected physical direction',()=>{
 const c=empty(),s=new CircuitSimulator();c.components=[makePart('ldr','sensor'),makePart('resistor','r')];c.components[1].resistance=10000;
 c.wires=[wire('mcu:5V','sensor:1'),wire('sensor:2','r:1'),wire('r:2','mcu:GND1'),wire('r:1','mcu:A0')];
 let r=s.solve(c);assert.ok(Math.abs(r.readADC('A0')-512)<=1);assert.equal(r.parts.sensor.resistance,10000);
 c.components[0].lux=1000;r=s.solve(c);assert.ok(r.readADC('A0')>800);
 c.components[0]=makePart('thermistor','sensor');r=s.solve(c);assert.ok(Math.abs(r.parts.sensor.resistance-10000)<1e-8);
 c.components[0].temperature=75;r=s.solve(c);assert.ok(r.parts.sensor.resistance<2000);assert.ok(r.readADC('A0')>800);
});

test('switch and diode genuinely change conduction rather than only their drawing',()=>{
 const c=empty();c.components=[makePart('switch','sw'),makePart('diode','d'),makePart('resistor','r')];c.components[2].resistance=1000;
 c.wires=[wire('mcu:5V','sw:1'),wire('sw:2','d:A'),wire('d:K','r:1'),wire('r:2','mcu:GND1')];
 let r=new CircuitSimulator().solve(c);assert.ok(r.parts.d.currentMa<.001);
 c.components[0].closed=true;r=new CircuitSimulator().solve(c);assert.ok(Math.abs(r.parts.d.currentMa-4.3/1010*1000)<.01);
 [c.wires[1].b,c.wires[2].a]=['d:K','d:A'];r=new CircuitSimulator().solve(c);assert.ok(r.parts.d.currentMa<.001);
});

test('RGB and seven-segment branches independently solve current, including PWM average',()=>{
 for(const [type,active,group] of [['rgbled','R','channels'],['sevenseg','a','segments']]){
  const c=empty();c.components=[makePart(type,'lamp'),makePart('resistor','r')];c.components[1].resistance=470;
  c.wires=[wire('mcu:D9','r:1'),wire('r:2','lamp:'+active),wire('lamp:COM','mcu:GND1')];
  const state={boardId:'uno-r3',timeMs:1,pins:{D9:{mode:'GPIO_Mode_AF_PP',clock:true,level:1,pwm:{frequencyHz:1000,duty:.5}}}};
  const result=new CircuitSimulator().solve(c,state),data=result.parts.lamp[group];
  assert.ok(data[active].currentMa>5);assert.ok(Math.abs(data[active].displayBrightness-data[active].brightness*.5)<1e-8);
  for(const [name,channel] of Object.entries(data))if(name!==active)assert.ok(channel.currentMa<.001);
 }
 assert.equal(Object.keys(PARTS).length,23);
});

test('motor has solved load, inertial speed and angle; same-time solves preserve mechanical state',()=>{
 const c=empty();c.components=[makePart('motor','motor')];c.wires=[wire('mcu:5V','motor:+'),wire('motor:-','mcu:GND1')];
 const solver=new CircuitSimulator();let r=solver.solve(c,{pins:{},timeMs:0});assert.equal(r.parts.motor.rpm,0);assert.ok(Math.abs(r.parts.motor.currentMa-250)<1e-8);
 r=solver.solve(c,{pins:{},timeMs:100});assert.ok(r.parts.motor.rpm>1000);assert.ok(r.parts.motor.angleDeg>0);
 const mechanical=structuredClone(solver.motorStates);for(let i=0;i<5;i++)solver.solve(c,{pins:{},timeMs:100});assert.deepEqual(solver.motorStates,mechanical);
 const previous=r.parts.motor.rpm;r=solver.solve(c,{pins:{},timeMs:200});assert.ok(r.parts.motor.rpm>previous);assert.ok(r.parts.motor.currentMa<250);
});
