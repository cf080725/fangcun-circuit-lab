import assert from 'node:assert/strict';
import test from 'node:test';
import {CircuitSimulator, createCircuit, makePart, PARTS} from '../dist/circuit.js';

function fixture(boardId='uno-r3') {
  const circuit=createCircuit('blink',boardId),sensor={...makePart('mcp9808','temp'),temperatureC:25.25};
  circuit.components=[sensor];
  circuit.wires=[];
  const connect=(a,b)=>circuit.wires.push({id:'w'+circuit.wires.length,a,b});
  for(const [a,b] of [['5V','VIN'],['GND','GND'],['SDA','SDA'],['SCL','SCL']])connect('mcu:'+a,'temp:'+b);
  const sim=new CircuitSimulator(),state={boardId,timeMs:0,pins:{}};
  const sample=(time=state.timeMs)=>{state.timeMs=time;return sim.solve(circuit,state).parts.temp;};
  const write=(bytes,address=0x18)=>sim.writeI2c(circuit,state,address,bytes);
  const read=(quantity=2,address=0x18)=>sim.readI2c(circuit,state,address,quantity);
  const register=(pointer,quantity=2)=>{
    assert.deepEqual(write([pointer]),{status:0,deviceId:'temp'});
    const reading=read(quantity);
    assert.equal(reading.status,0);
    return reading.bytes;
  };
  return {circuit,sensor,connect,sim,state,sample,write,read,register};
}

test('T_A has a power-on zero, then carries signed 1/16 °C and boundary flag bits',()=>{
  const {sensor,sample,register,read}=fixture();
  const initial=sample(0);
  assert.equal(initial.voltage,5);
  assert.equal(initial.powered,true);
  assert.equal(initial.conversionMs,250);
  assert.equal(initial.temperatureC,null);
  assert.equal(initial.rawTemperature,0);
  assert.deepEqual(register(0x05),[0,0]);
  assert.equal(sample(249.9).temperatureC,null);
  const room=sample(250);
  assert.equal(room.temperatureC,25.25);
  assert.equal(room.sampleTimeMs,250);
  assert.deepEqual(read().bytes,[0xc1,0x94]);
  sensor.temperatureC=34.5;
  assert.equal(sample(270).temperatureC,25.25);
  assert.equal(sample(499.9).targetTemperatureC,34.5);
  assert.deepEqual(read().bytes,[0xc1,0x94]);
  assert.equal(sample(500).temperatureC,34.5);
  assert.deepEqual(read().bytes,[0xc2,0x28]);
  sensor.temperatureC=-8.5;
  sample(520);
  assert.equal(sample(750).temperatureC,-8.5);
  assert.deepEqual(read().bytes,[0x3f,0x78]);
  assert.deepEqual(read(1).bytes,[0x3f]);
  assert.deepEqual(read(3).bytes,[0x3f,0x78],'read cannot spill into the next register');
});

test('resolution registers control quantization and nominal conversion intervals',()=>{
  for(const [index,step,period,expected] of [[0,.5,30,12.5],[1,.25,65,12.25],[2,.125,130,12.375],[3,.0625,250,12.3125]]){
    const {sensor,sample,write,register}=fixture();
    sensor.temperatureC=12.3125;
    sample(0);
    assert.equal(write([0x08,index]).status,0);
    assert.deepEqual(register(0x08),[index]);
    assert.equal(sample(period-.1).temperatureC,null);
    const converted=sample(period);
    assert.equal(converted.temperatureC,expected);
    assert.equal(converted.resolution,step);
    assert.equal(converted.conversionMs,period);
  }
});

test('device IDs, configured thresholds, locks and shutdown preserve register semantics',()=>{
  const {sensor,sample,write,register}=fixture();
  sample(0);
  assert.deepEqual(register(0x06),[0x00,0x54]);
  assert.deepEqual(register(0x07),[0x04,0x00]);
  assert.equal(write([0x02,0x01,0xe3]).status,0); // 30 °C, unused bits clear on read.
  assert.deepEqual(register(0x02),[0x01,0xe0]);
  assert.equal(write([0x03,0x00,0xa0]).status,0); // 10 °C.
  assert.equal(write([0x04,0x03,0x20]).status,0); // 50 °C.
  sample(250);
  assert.deepEqual(register(0x05),[0x01,0x94]);
  assert.equal(write([0x01,0x01,0x00]).status,0);
  sensor.temperatureC=55;
  const asleep=sample(2000);
  assert.equal(asleep.shutdown,true);
  assert.equal(asleep.temperatureC,25.25);
  assert.equal(write([0x01,0x00,0x40]).status,0);
  assert.equal(write([0x02,0x03,0xc0]).status,0); // Locked; value stays 30 °C.
  assert.equal(write([0x01,0x01,0x00]).status,0); // Lock prevents a new shutdown.
  assert.deepEqual(register(0x01),[0x00,0x40]);
  assert.deepEqual(register(0x02),[0x01,0xe0]);
  assert.equal(sample(2249).temperatureC,25.25);
  assert.equal(sample(2250).temperatureC,55);
  assert.deepEqual(register(0x05),[0xc3,0x70]);
  assert.equal(write([0x05,0,0]).reason,'read-only-register');
  assert.equal(write([0x09]).reason,'unsupported-register');
});

test('separate devices share an actual bus and route reads/writes by address',()=>{
  const {circuit,connect,sim,state,sample,write,read,register}=fixture('nano');
  const oled=makePart('ssd1306','display');
  circuit.components.push(oled);
  for(const pin of PARTS.ssd1306.pins)connect('temp:'+pin,'display:'+pin);
  sample(0);sample(250);
  assert.equal(write([0x00,0x8d,0x14,0xaf],0x3d).deviceId,'display');
  assert.deepEqual(register(0x05),[0xc1,0x94]);
  assert.equal(sim.lastResult.parts.display.displayOn,true);
  assert.deepEqual(read(2,0x3d),{status:2,reason:'read-not-supported',bytes:[],deviceId:'display'});
  assert.deepEqual(read(2,0x19),{status:2,reason:'address-nack',bytes:[]});
  circuit.components[0].address=0x19;
  assert.deepEqual(read(),{status:2,reason:'address-nack',bytes:[]});
  assert.deepEqual(read(2,0x19).bytes,[0xc1,0x94]);
  assert.equal(sim.solve(circuit,state).parts.temp.address,0x19);
});

test('signal loss, swapped lines, contention and removed VIN cannot return temperature bytes',()=>{
  const {circuit,connect,state,sample,write,read}=fixture();
  sample(0);sample(250);write([0x05]);
  const sda=circuit.wires[2],scl=circuit.wires[3];
  sda.a='bb:a1';connect('mcu:A4','bb:e1');
  assert.deepEqual(read().bytes,[0xc1,0x94]);
  circuit.wires.at(-1).b='bb:f1';
  assert.deepEqual(read(),{status:2,reason:'disconnected',bytes:[]});
  assert.equal(sample().temperatureC,25.25,'sensor still converts when only the bus is unplugged');
  sda.a='mcu:A5';scl.a='mcu:A4';
  assert.deepEqual(read(),{status:2,reason:'swapped-lines',bytes:[]});
  sda.a='mcu:A4';scl.a='mcu:A5';
  state.pins.A4={mode:'OUTPUT',level:0};
  assert.deepEqual(read(),{status:4,reason:'bus-stuck-low',bytes:[]});
  delete state.pins.A4;
  circuit.components.push(makePart('ssd1306','display'));
  for(const [a,b] of [['5V','VIN'],['GND','GND'],['A4','SDA'],['A5','SCL']])connect('mcu:'+a,'display:'+b);
  circuit.wires.shift();
  const unpowered=sample();
  assert.ok(unpowered.voltage>2.7,'the other module pull-ups would numerically backfeed a floating VIN');
  assert.equal(unpowered.powered,false);
  assert.equal(unpowered.temperatureC,null);
  assert.deepEqual(read(),{status:2,reason:'unpowered',bytes:[]});
});

test('a shared bus with logic outside the MCP9808 supply range is rejected',()=>{
  const {circuit,connect,sample,read}=fixture();
  circuit.wires[0].a='mcu:3V3';
  sample(0);sample(250);
  assert.equal(read().status,0,'UNO can recognize the pulled-up 3.3 V bus');
  circuit.components.push(makePart('ssd1306','display'));
  for(const [a,b] of [['5V','VIN'],['GND','GND'],['A4','SDA'],['A5','SCL']])connect('mcu:'+a,'display:'+b);
  assert.equal(sample().reason,'bus-level');
  assert.deepEqual(read(),{status:4,reason:'bus-level',bytes:[]});
});

test('isolated samples do not commit conversion state, while CPU reset preserves the sensor',()=>{
  const {circuit,sensor,sim,state,sample,write,read}=fixture();
  sample(0);sample(250);write([0x05]);sample(340);
  sensor.temperatureC=12.25;
  sample(340);
  const future=sim.sampleAtCurrentTime(circuit,{...state,timeMs:510}).parts.temp;
  assert.equal(future.temperatureC,12.25);
  assert.deepEqual(read().bytes,[0xc1,0x94]);
  sim.reset({preserveI2cDevices:true,preserveTime:true});
  assert.equal(sim.lastTime,340);
  assert.equal(sample(341).temperatureC,25.25);
  assert.deepEqual(read().bytes,[0xc1,0x94]);
  sim.reset({preserveI2cDevices:true});
  assert.equal(sample(0).temperatureC,25.25);
  assert.deepEqual(read().bytes,[0xc1,0x94]);
  assert.equal(sample(158.9).temperatureC,25.25);
  assert.equal(sample(159).temperatureC,12.25);
  assert.deepEqual(read().bytes,[0xc0,0xc4]);
  circuit.powered=false;sample(180);
  circuit.powered=true;sample(190);
  assert.deepEqual(read().bytes,[0,0x1f],'power cycle clears the register pointer');
  write([0x05]);
  assert.deepEqual(read().bytes,[0,0]);
  assert.equal(sample(439.9).temperatureC,null);
  assert.equal(sample(440).temperatureC,12.25);
});
