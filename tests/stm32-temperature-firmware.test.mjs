import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAvrCircuitIO} from '../dist/avr-circuit-io.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {makeI2cTemperatureLesson} from '../dist/i2c-temperature-lesson.js';
import {parseStm32Hex} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

async function setup(t, threshold) {
  const {circuitData:circuit} = makeI2cTemperatureLesson('bluepill');
  const sensor = circuit.components.find(part => part.id === 'temp1');
  sensor.temperatureC = 34.5;
  const solver = new CircuitSimulator();
  const io = createAvrCircuitIO(() => circuit, solver);
  const url = new URL(`../dist/firmware/bluepill/temperature-${threshold}.hex`, import.meta.url);
  const firmware = parseStm32Hex(readFileSync(url,'utf8'),'bluepill');
  assert.equal(firmware.initialStack,0x20005000);
  const received = [];
  const runtime = await createStm32FirmwareRuntime(firmware,{
    ...io,
    boardId:'bluepill',
    readI2c(address, quantity, state, options) {
      const response = io.readI2c(address,quantity,state,options);
      received.push({address,quantity,offset:options.offset,ack:options.ack,bytes:response.bytes});
      return response;
    }
  });
  t.after(() => runtime.dispose());
  solver.solve(circuit,runtime.getState());

  async function advanceTo(timeMs) {
    let state = runtime.getState();
    while (state.timeMs < timeMs - 1e-6) {
      const previous = state.cycles;
      state = await runtime.advanceTime(Math.min(20,timeMs-state.timeMs));
      assert.equal(state.error,null);
      assert(state.cycles > previous,'STM32 clock advanced');
    }
    return state;
  }

  return {circuit,sensor,received,advanceTo,currentMa:state => solver.solve(circuit,state).parts.led1.currentMa};
}

test('both compiled Blue Pill samples read the same 34.5 °C while driving opposite PA0 levels', async t => {
  for (const [threshold, level] of [[30,1],[38,0]]) {
    await t.test(`${threshold} °C threshold`,async sample => {
      const {advanceTo,currentMa,received} = await setup(sample,threshold);
      const waiting = await advanceTo(249);
      assert.equal(waiting.pins.PA0.level,0);
      assert.equal(waiting.serial,'');
      assert.deepEqual(waiting.events.filter(event => event.type === 'i2c'),[]);

      const measured = await advanceTo(285);
      const packets = measured.events.filter(event => event.type === 'i2c');
      assert.equal(packets.length,2);
      const [pointer,reading] = packets;
      assert.deepEqual([pointer.direction,pointer.address,pointer.bytes,pointer.status,pointer.stop,pointer.sclHz],
        ['write',0x18,[0x05],0,false,100000]);
      assert(pointer.fromMs >= 250 && pointer.fromMs < 252);
      assert.deepEqual([reading.direction,reading.address,reading.bytes,reading.status,reading.repeatedStart,reading.stop],
        ['read',0x18,[0xc2,0x28],0,true,true]);
      assert.deepEqual(received,[
        {address:0x18,quantity:1,offset:0,ack:true,bytes:[0xc2]},
        {address:0x18,quantity:1,offset:1,ack:false,bytes:[0x28]},
      ]);
      assert.equal(measured.uarts.USART1.baudRate,9604);
      assert.equal(measured.serial,'TEMP=34.5000\r\n');
      assert.equal(measured.pins.PA0.level,level);
      assert(level ? currentMa(measured)>1 : currentMa(measured)===0);
    });
  }
});

test('Blue Pill temperature firmware fails dark on open SDA and recovers a signed sample',async t => {
  const {circuit,sensor,advanceTo,currentMa} = await setup(t,30);
  assert.equal((await advanceTo(285)).pins.PA0.level,1);
  const dataWire = circuit.wires.find(wire => wire.b === 'temp1:SDA');
  circuit.wires = circuit.wires.filter(wire => wire !== dataWire);

  const failure = await advanceTo(600);
  const nack = failure.events.filter(event => event.type === 'i2c').at(-1);
  assert.equal(nack.direction,'write');
  assert.equal(nack.status,2);
  assert.equal(nack.reason,'disconnected');
  assert.equal(nack.stop,true);
  assert(nack.fromMs >= 550 && nack.fromMs < 580);
  assert.equal(failure.serial,'TEMP=34.5000\r\nI2C=0x04\r\n');
  assert.equal(failure.pins.PA0.level,0);
  assert.equal(currentMa(failure),0);

  circuit.wires.push(dataWire);
  sensor.temperatureC = -7.25;
  const recovered = await advanceTo(920);
  assert(recovered.serial.endsWith('TEMP=-7.2500\r\n'));
  assert.equal(recovered.pins.PA0.level,0);
});
