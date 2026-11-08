import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator, createCircuit, makePart} from '../dist/circuit.js';
import {parseStm32Hex} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

const firmware=readFileSync(new URL('../dist/firmware/bluepill/temperature-30.hex',import.meta.url),'utf8');

async function untilSerial(runtime,pattern,timeLimit){
  let state=runtime.getState();
  while(!pattern.test(state.serial)&&state.timeMs<timeLimit){
    const previous=state;
    state=await runtime.advanceTime(20);
    assert.equal(state.error,null,JSON.stringify(state.error));
    assert.ok(state.cycles>previous.cycles,'the run returns after its nested requests are serviced');
  }
  assert.match(state.serial,pattern,JSON.stringify({timeMs:state.timeMs,i2c:state.i2c,events:state.events}));
  return state;
}

test('Nucleo native worker delegates 7-bit I²C1 requests without completing the active run early',async t=>{
  const boardId='nucleo-f103rb',circuit=createCircuit('onboard',boardId);
  circuit.components=[{...makePart('mcp9808','temp'),temperatureC:34.5}];
  circuit.wires=[['CN7_16','VIN'],['CN7_20','GND'],['CN7_21','SDA'],['CN10_17','SCL']].map(([pin,name],index)=>({
    id:'w'+index,a:'mcu:'+pin,b:'temp:'+name
  }));
  const solver=new CircuitSimulator(),io=createAvrCircuitIO(()=>circuit,solver),calls=[];
  let runtime,failOnce=true;
  function record(operation,address,state,meta,extra){
    calls.push({operation,address,state,meta,extra,published:runtime.getState().timeMs});
  }
  runtime=await createStm32FirmwareRuntime(parseStm32Hex(firmware,boardId),{
    boardId,
    i2cAddress(address,direction,state,meta){
      record('address',address,state,meta,direction);
      if(failOnce){failOnce=false;throw Error('one transient controller hook failure');}
      return io.i2cAddress(address,direction,state,meta);
    },
    writeI2c(address,bytes,state,meta){
      record('write',address,state,meta,bytes);
      return io.writeI2c(address,bytes,state,meta);
    },
    readI2c(address,quantity,state,meta){
      record('read',address,state,meta,quantity);
      return io.readI2c(address,quantity,state,meta);
    }
  });
  t.after(()=>runtime.dispose());
  solver.solve(circuit,runtime.getState());

  const fault=await untilSerial(runtime,/I2C=0x01\r?\n/,400);
  assert.equal(fault.dialect,'stm32-firmware');
  assert.equal(fault.capabilities.i2cMaster,true);
  assert.ok(fault.events.some(event=>event.type==='i2c'&&event.status===4&&event.reason==='hook-error'));

  const success=await untilSerial(runtime,/TEMP=34\.5000\r?\n/,720);
  const packets=success.events.filter(event=>event.type==='i2c');
  const read=packets.findLast(event=>event.direction==='read');
  assert.deepEqual([read.address,read.status,read.repeatedStart,read.stop,read.bytes],[0x18,0,true,true,[0xc2,0x28]]);
  const write=packets.at(-2);
  assert.deepEqual([write.direction,write.address,write.status,write.stop,write.bytes],['write',0x18,0,false,[5]]);
  assert.ok(calls.every(call=>call.address===0x18&&call.state.boardId===boardId&&call.state.timeMs>=call.published));
  assert.ok(calls.some(call=>call.state.timeMs>call.published),'getState retains the last completed public snapshot during a bus request');
  assert.ok(calls.every(call=>call.state.pins.PB6&&call.state.pins.PB7));
  assert.deepEqual(calls.filter(call=>call.operation==='read').map(call=>[call.extra,call.meta.offset,call.meta.ack]),[[1,0,true],[1,1,false]]);

  circuit.wires=circuit.wires.filter(wire=>wire.b!=='temp:SDA');
  const disconnected=await untilSerial(runtime,/I2C=0x04\r?\n/,1070);
  const failure=disconnected.events.findLast(event=>event.type==='i2c');
  assert.deepEqual([failure.address,failure.direction,failure.status,failure.reason,failure.bytes],[0x18,'write',2,'disconnected',[]]);
});
