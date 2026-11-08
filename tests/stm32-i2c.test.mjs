import assert from 'node:assert/strict';
import test from 'node:test';
import {createStm32I2c} from '../dist/stm32-i2c.js';

const CR1 = 0, CR2 = 4, DR = 0x10, SR1 = 0x14, SR2 = 0x18, CCR = 0x1c, TRISE = 0x20;
const PE = 1, START = 0x100, STOP = 0x200, ACK = 0x400, POS = 0x800, SWRST = 0x8000;
const SB = 1, ADDR = 2, BTF = 4, RXNE = 0x40, TXE = 0x80, BERR = 0x100, AF = 0x400;

function fixture() {
  const controls = {enabled: true, reset: false, routeError: null, time: 0};
  const bus = createStm32I2c({isClocked: () => controls.enabled, isReset: () => controls.reset,
    routeReason: () => controls.routeError, clockHz: () => 8_000_000, now: () => controls.time});
  const write = (register, value) => bus.write(register, 2, value);
  const read = register => bus.read(register, 2);
  function step(operation, result, elapsed = 0.1) {
    controls.time += elapsed;
    const request = bus.takeRequest();
    assert.equal(request?.operation, operation);
    bus.completeRequest(result);
    return request;
  }
  write(CR2, 8);
  write(CCR, 40);
  write(TRISE, 9);
  write(CR1, PE | ACK);
  return {bus, controls, read, write, step};
}

function address(ctx, direction, result = {status: 0, deviceId: 'temp1'}) {
  const {write, read, step} = ctx;
  assert.ok(read(SR1) & SB);
  write(DR, direction === 'read' ? 0x31 : 0x30);
  const request = step('address', result);
  assert.equal(request.address, 0x18);
  assert.equal(request.direction, direction);
  return request;
}

test('I2C1 only clears ADDR after SR1 then SR2 and waits for all nine address clocks', () => {
  const {bus, controls, read, write} = fixture();
  assert.equal(bus.getState().sclHz, 100_000);
  write(CR1, PE | ACK | START);
  assert.equal(read(SR2), 3);
  write(DR, 0x30);
  assert.equal(bus.takeRequest(), null, 'DR alone cannot clear SB');
  assert.equal(read(SR1), SB);
  write(DR, 0x30);
  controls.time = 0.089;
  assert.equal(bus.takeRequest(), null);
  controls.time = 0.09;
  assert.equal(bus.takeRequest().direction, 'write');
  bus.completeRequest({status: 0});
  assert.equal(read(SR2), 7);
  assert.equal(read(SR1), ADDR | TXE, 'early SR2 read cannot clear ADDR');
  assert.equal(read(SR2), 7);
  assert.equal(read(SR1), TXE);
});

test('held write and AN2824 POS read use repeated START, final NACK and drain after STOP', () => {
  const ctx = fixture();
  const {bus, read, write, step} = ctx;
  write(CR1, PE | ACK | START);
  address(ctx, 'write');
  read(SR1);
  read(SR2);
  write(DR, 5);
  assert.equal(read(SR1), 0);
  step('address', {status: 0});
  assert.equal(read(SR1), TXE | BTF);
  write(CR1, PE | ACK | START);
  const pointer = step('write', {status: 0}, 0);
  assert.deepEqual([pointer.bytes, pointer.meta], [[5], {stop: false, repeatedStart: false}]);
  assert.equal(address(ctx, 'read').meta.repeatedStart, true);
  write(CR1, PE | ACK | POS);
  read(SR1);
  read(SR2);
  const first = step('read', {status: 0, bytes: [0xc2]});
  assert.deepEqual([first.offset, first.meta.ack], [0, true]);
  assert.equal(read(SR1), RXNE);
  assert.equal(bus.takeRequest(), null, 'second byte waits for ACK to be cleared');
  write(CR1, PE | POS);
  const second = step('read', {status: 0, bytes: [0x28]});
  assert.deepEqual([second.offset, second.meta.ack], [1, false]);
  assert.equal(read(SR1), RXNE | BTF);
  write(CR1, PE | POS | STOP);
  assert.equal(read(SR2), 0);
  assert.equal(read(CR1) & STOP, 0);
  assert.equal(read(DR), 0xc2);
  assert.equal(read(SR1), RXNE);
  assert.equal(read(DR), 0x28);
  assert.equal(read(SR1), 0);
  const [request, response] = bus.events();
  assert.deepEqual([request.direction, request.stop, request.bytes], ['write', false, [5]]);
  assert.deepEqual([response.direction, response.stop, response.repeatedStart, response.status, response.bytes],
    ['read', true, true, 0, [0xc2, 0x28]]);
  assert.equal(response.fromMs, request.toMs);
  assert.ok(response.toMs > response.fromMs);
  assert.equal(response.controller, 'stm32-i2c1');
  assert.equal(response.timingMode, 'stm32-mmio-estimated');
  response.bytes[0] = 0;
  assert.equal(bus.events()[1].bytes[0], 0xc2);
});

test('NACK and invalid pin configuration remain distinct, and errors clear on zero writes', () => {
  const ctx = fixture();
  const {bus, controls, read, write} = ctx;
  write(CR1, PE | START);
  address(ctx, 'write', {status: 2, reason: 'disconnected'});
  assert.equal(read(SR1), AF);
  write(SR1, AF);
  assert.equal(read(SR1), AF);
  bus.write(SR1 + 1, 1, 0);
  assert.equal(read(SR1), 0);
  write(CR1, PE | STOP);
  assert.deepEqual([bus.events()[0].status, bus.events()[0].bytes], [2, []]);

  controls.routeError = 'i2c-pin-configuration';
  write(CR1, PE | START);
  read(SR1);
  write(DR, 0x31);
  assert.equal(read(SR1), BERR);
  assert.equal(bus.takeRequest(), null);
  write(CR1, PE | STOP);
  assert.equal(bus.events()[1].reason, 'i2c-pin-configuration');
});

test('PE or APB reset aborts pending transfers and clears FIFO without fake completed transactions', () => {
  const ctx = fixture();
  const {bus, controls, read, write} = ctx;
  write(CR1, PE | START);
  address(ctx, 'read');
  read(SR1);
  read(SR2);
  write(CR1, PE | STOP);
  const first = ctx.step('read', {status: 0, bytes: [0x64]});
  assert.equal(first.meta.ack, false);
  assert.equal(read(DR), 0x64);
  assert.equal(read(SR2), 0);

  write(CR1, PE | START);
  read(SR1);
  write(DR, 0x30);
  write(CR1, 0);
  controls.time++;
  assert.equal(bus.takeRequest(), null);
  assert.equal(read(SR2), 0);
  write(CR1, SWRST);
  assert.equal(read(CCR), 0);
  assert.equal(read(TRISE), 2);
  write(CR1, 0);
  write(CCR, 40);
  controls.reset = true;
  assert.equal(read(CCR), 0);
  controls.reset = false;
  assert.equal(read(CCR), 0);
  controls.enabled = false;
  write(CR1, PE | START);
  assert.equal(bus.getState().enabled, false);
  assert.equal(bus.events().length, 1);
});
