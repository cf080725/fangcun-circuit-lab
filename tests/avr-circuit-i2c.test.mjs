import assert from 'node:assert/strict';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';

function setup() {
  let circuit=createCircuit('blink','uno-r3');
  const sensor={...makePart('mcp9808','sensor'),temperatureC:25.25};
  const oled=makePart('ssd1306','oled');
  circuit.components=[sensor,oled];
  circuit.wires=[];
  const connect=(a,b)=>circuit.wires.push({id:'w'+circuit.wires.length,a,b});
  for(const id of ['sensor','oled']) {
    for(const [mcu,part] of [['5V','VIN'],['GND','GND'],['SDA','SDA'],['SCL','SCL']]) {
      connect('mcu:'+mcu,id+':'+part);
    }
  }
  const state={boardId:'uno-r3',pins:{},timeMs:0};
  const sim=new CircuitSimulator();
  const io=createAvrCircuitIO(()=>circuit,sim);
  const solve=(time=state.timeMs)=>{state.timeMs=time;return sim.solve(circuit,state);};
  const disconnect=endpoint=>{circuit.wires=circuit.wires.filter(({a,b})=>a!==endpoint&&b!==endpoint);};
  return {circuit,sensor,state,sim,io,solve,disconnect,replace:next=>{circuit=next;}};
}

test('AVR probes the direction at each actual address without advancing the solver',()=>{
  const {io,solve,sim,state}=setup();
  const initial=solve();
  const future={...state,timeMs:400};
  assert.deepEqual(io.i2cAddress(0x18,'write',future),{status:0,deviceId:'sensor'});
  assert.deepEqual(io.i2cAddress(0x18,'read',future),{status:0,deviceId:'sensor'});
  assert.deepEqual(io.i2cAddress(0x3d,'write',future),{status:0,deviceId:'oled'});
  assert.deepEqual(io.i2cAddress(0x3d,'read',future),{status:2,reason:'read-not-supported',deviceId:'oled'});
  assert.deepEqual(io.i2cAddress(0x19,'read',future),{status:2,reason:'address-nack'});
  assert.strictEqual(sim.lastResult,initial);
  assert.equal(sim.lastTime,0);
  assert.equal(solve(249).parts.sensor.temperatureC,null);
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:0,deviceId:'sensor'});
  assert.deepEqual(io.i2cAddress(0x18,'read',{...state,timeMs:0}),{status:4,reason:'stale-state'});
});

test('AVR rejects address phases on swapped, unpowered, or contended bus connections',()=>{
  const {circuit,io,state,solve,disconnect}=setup();
  solve();
  const data=circuit.wires.find(w=>w.b==='sensor:SDA');
  const clock=circuit.wires.find(w=>w.b==='sensor:SCL');
  [data.a,clock.a]=[clock.a,data.a];
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:2,reason:'swapped-lines'});
  [data.a,clock.a]=[clock.a,data.a];
  state.pins.A4={mode:'OUTPUT',level:0};
  assert.deepEqual(io.i2cAddress(0x18,'write',state),{status:4,reason:'bus-stuck-low'});
  delete state.pins.A4;
  disconnect('sensor:VIN');
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:2,reason:'unpowered'});
  circuit.powered=false;
  assert.deepEqual(io.i2cAddress(0x3d,'write',state),{status:2,reason:'controller-off'});
});

test('native read bytes latch one register across a conversion boundary and use MSB first',()=>{
  const {sensor,io,sim,state,solve}=setup();
  solve();solve(250);
  assert.equal(io.writeI2c(0x18,[0x05],state,{stop:false}).status,0);
  sensor.temperatureC=34.5;
  solve(300);solve(499.99);
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:0,repeatedStart:true,ack:true}),{status:0,deviceId:'sensor',bytes:[0xc1]});
  state.timeMs=500.05;
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:1,ack:false}),{status:0,deviceId:'sensor',bytes:[0x94]});
  assert.equal(sim.lastTime,499.99,'later byte validation is isolated');
  const next=solve();
  assert.equal(next.parts.sensor.temperatureC,34.5);
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:0}),{status:0,deviceId:'sensor',bytes:[0xc2]});
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:1}),{status:0,deviceId:'sensor',bytes:[0x28]});
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:2}),{status:0,deviceId:'sensor',bytes:[]});
});

test('an in-flight read cannot supply stale latched bytes after unplug or project replacement',()=>{
  const {circuit,io,state,solve,disconnect,replace}=setup();
  solve();solve(250);io.writeI2c(0x18,[0x05],state);
  assert.equal(io.readI2c(0x18,1,state,{offset:0}).bytes[0],0xc1);
  disconnect('sensor:SDA');
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:1}),{status:2,reason:'disconnected',bytes:[]});
  circuit.wires.push({id:'new-sda',a:'mcu:SDA',b:'sensor:SDA'});
  assert.equal(io.readI2c(0x18,1,state,{offset:0}).bytes[0],0xc1);
  replace(structuredClone(circuit));
  assert.deepEqual(io.readI2c(0x18,1,state,{offset:1}),{status:4,reason:'disconnected',bytes:[]});
});

test('the complete write is checked again at commit, including after an earlier address ACK',()=>{
  const {circuit,io,state,solve,disconnect}=setup();
  solve();
  assert.equal(io.i2cAddress(0x3d,'write',state).status,0);
  disconnect('oled:SCL');
  assert.equal(io.writeI2c(0x3d,[0x00,0x8d,0x14,0xaf],state,{stop:true}).status,2);
  assert.equal(solve().parts.oled.displayOn,false);
  circuit.wires.push({id:'new-clock',a:'mcu:SCL',b:'oled:SCL'});
  assert.deepEqual(io.writeI2c(0x3d,[0x00,0x8d,0x14,0xaf],state,{stop:true}),{status:0,deviceId:'oled'});
  assert.equal(solve().parts.oled.displayOn,true);
});
