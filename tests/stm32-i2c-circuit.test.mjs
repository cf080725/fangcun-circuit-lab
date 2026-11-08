import assert from 'node:assert/strict';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';

function fixture(boardId, sda='PB7', scl='PB6'){
  const circuit=createCircuit('onboard',boardId),sensor={...makePart('mcp9808','temp'),temperatureC:34.5};
  circuit.components=[sensor];
  circuit.wires=[['3V3','VIN'],['GND','GND'],[sda,'SDA'],[scl,'SCL']].map(([pin,name],index)=>({
    id:'w'+index,a:'mcu:'+pin,b:'temp:'+name
  }));
  const solver=new CircuitSimulator();
  const io=createAvrCircuitIO(()=>circuit,solver);
  const state={boardId,timeMs:0,pins:{
    PB6:{mode:'GPIO_Mode_AF_UNMODELED',clock:true},
    PB7:{mode:'GPIO_Mode_AF_UNMODELED',clock:true}
  }};
  solver.solve(circuit,state);
  state.timeMs=250;
  return {circuit,solver,io,state};
}

for(const [boardId,sda,scl] of [['bluepill','PB7','PB6'],['nucleo-f103rb','CN7_21','CN10_17']]){
  test(boardId+' I²C1 uses the actual PB7/PB6 nets with 3.3 V module pull-ups',()=>{
    const {solver,io,state}=fixture(boardId,sda,scl);
    assert.deepEqual(io.i2cAddress(0x18,'write',state),{status:0,deviceId:'temp'});
    assert.equal(solver.lastTime,0);
    assert.deepEqual(io.writeI2c(0x18,[5],state,{stop:false}),{status:0,deviceId:'temp'});
    assert.deepEqual(io.readI2c(0x18,1,state,{offset:0,repeatedStart:true,ack:true}),{status:0,deviceId:'temp',bytes:[0xc2]});
    assert.deepEqual(io.readI2c(0x18,1,state,{offset:1,ack:false}),{status:0,deviceId:'temp',bytes:[0x28]});
    assert.ok(solver.lastResult.measureBetween('mcu:PB6','mcu:GND').voltage>3.29);
    assert.ok(solver.lastResult.measureBetween('mcu:PB7','mcu:GND').voltage>3.29);
  });
}

test('NUCLEO Arduino SDA/SCL remap pins do not stand in for default I²C1',()=>{
  const {circuit,io,state}=fixture('nucleo-f103rb','D14','D15');
  assert.deepEqual(io.i2cAddress(0x18,'write',state),{status:2,reason:'disconnected'});
  circuit.wires[2].a='mcu:CN7_21';
  circuit.wires[3].a='mcu:D10';
  assert.deepEqual(io.i2cAddress(0x18,'write',state),{status:0,deviceId:'temp'});
});

test('STM32 I²C1 rejects swapped, open, over-voltage and conflicting bus lines',()=>{
  const {circuit,io,state}=fixture('bluepill');
  const [vin,,data,clock]=circuit.wires;
  [data.a,clock.a]=[clock.a,data.a];
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:2,reason:'swapped-lines'});
  [data.a,clock.a]=[clock.a,data.a];
  clock.a='bb:c3';
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:2,reason:'disconnected'});
  clock.a='mcu:PB6';
  vin.a='mcu:5V';
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:4,reason:'bus-level'});
  vin.a='mcu:3V3';
  state.pins.PB6={mode:'GPIO_Mode_Out_PP',clock:true,level:0};
  assert.deepEqual(io.i2cAddress(0x18,'read',state),{status:4,reason:'bus-stuck-low'});
  circuit.powered=false;
  assert.deepEqual(io.i2cAddress(0x18,'write',state),{status:2,reason:'controller-off'});
});

test('STM32 I²C1 still routes a write-only SSD1306 and leaves unsupported boards inactive',()=>{
  const {circuit,solver,io,state}=fixture('bluepill');
  circuit.components=[makePart('ssd1306','oled')];
  circuit.wires.forEach(wire=>{wire.b=wire.b.replace(/^temp:/,'oled:');});
  assert.deepEqual(io.i2cAddress(0x3d,'read',state),{status:2,reason:'read-not-supported',deviceId:'oled'});
  assert.deepEqual(io.writeI2c(0x3d,[0,0x8d,0x14,0xaf],state),{status:0,deviceId:'oled'});
  assert.equal(solver.solve(circuit,state).parts.oled.displayOn,true);
  circuit.boardId=state.boardId='nucleo-f401re';
  assert.deepEqual(io.i2cAddress(0x3d,'write',state),{status:2,reason:'unsupported-board'});
});
