import assert from 'node:assert/strict';
import test from 'node:test';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';

const sbi = (register, bit) => 0x9a00 | (register << 3) | bit;
const cbi = (register, bit) => 0x9800 | (register << 3) | bit;
const sbic = (register, bit) => 0x9900 | (register << 3) | bit;
const rjmp = offset => 0xc000 | (offset & 0x0fff);
const store = (address, value) => [0xe000 | ((value & 0xf0) << 4) | (value & 0x0f), 0x9300, address];
const load = address => [0x9100, address];
const out = register => 0xb900 | ((register & 0x30) << 5) | (register & 0x0f);
const skipIfClear = bit => 0xfd00 | bit; // sbrc r16, bit
const pollAdc = [...load(0x7a), skipIfClear(6), rjmp(-4)];

function runtimeFor(words, hooks) {
  return createAvrFirmwareRuntime({flash: Uint8Array.from(words.flatMap(word => [word & 0xff, word >> 8]))}, hooks);
}

function advanceTo(runtime, ms) {
  let state = runtime.getState();
  while (state.timeMs < ms) {
    const next = runtime.advanceTime(ms - state.timeMs + 1 / 16000);
    assert.equal(next.error, null);
    assert(next.cycles > state.cycles);
    state = next;
  }
  return state;
}

// DDRB5 output, PORTD2 input pull-up. Poll PIND2 and drive D13 active-low.
const buttonProgram = [
  sbi(4, 5),
  sbi(11, 2),
  sbic(9, 2), rjmp(2), sbi(5, 5), rjmp(-4), cbi(5, 5), rjmp(-6),
];

test('AVR step and reset preserve instruction, GPIO and flash semantics', () => {
  const runtime = runtimeFor(buttonProgram);
  const output = runtime.step();
  assert.equal(output.steps, 1);
  assert.equal(output.pc.byteAddress, 2);
  assert.equal(output.cycles, 2);
  assert.equal(output.pins.D13.mode, 'GPIO_Mode_Out_PP');
  assert.equal(output.pins.D13.level, 0);

  const pulled = runtime.step();
  assert.equal(pulled.pins.D2.mode, 'GPIO_Mode_IPU');
  assert.equal(pulled.pins.D2.level, 1);

  runtime.setDigitalInputs({D2: 0});
  assert.equal(runtime.step(12).pins.D13.level, 1);
  runtime.setDigitalInputs({});
  assert.equal(runtime.step(12).pins.D13.level, 0);

  const reset = runtime.reset();
  assert.equal(reset.pc.byteAddress, 0);
  assert.equal(reset.cycles, 0);
  assert.equal(reset.pins.D13.mode, 'GPIO_Mode_IN_FLOATING');
  assert.equal(runtime.step().pins.D13.mode, 'GPIO_Mode_Out_PP');
});

test('AVR circuit callback observes a new pull-up before the first polling instruction', () => {
  let reads = 0;
  const runtime = runtimeFor(buttonProgram, {readInputs(state) {
    reads++;
    return {D2: state.pins.D2.mode === 'GPIO_Mode_IPU' ? 1 : 0};
  }});
  assert.equal(runtime.step(150).pins.D13.level, 0);
  assert(reads > 1 && reads <= 4);
  const previous = reads;
  runtime.getState();
  assert.equal(reads, previous);
});

test('AVR CTC compare output is driven by all three hardware timers', () => {
  const timers = [
    {pin: 'D6', ddr: 10, bit: 6, tccra: 0x44, modeA: 0x42, tccrb: 0x45, modeB: 0x03, ocra: 0x47},
    {pin: 'D9', ddr: 4, bit: 1, tccra: 0x80, modeA: 0x40, tccrb: 0x81, modeB: 0x0b, ocra: 0x88},
    {pin: 'D11', ddr: 4, bit: 3, tccra: 0xb0, modeA: 0x42, tccrb: 0xb1, modeB: 0x04, ocra: 0xb3},
  ];
  for (const timer of timers) {
    const runtime = runtimeFor([
      sbi(timer.ddr, timer.bit),
      ...store(timer.ocra, 63),
      ...store(timer.tccra, timer.modeA),
      ...store(timer.tccrb, timer.modeB),
      rjmp(-1),
    ]);
    assert.equal(advanceTo(runtime, 0.20).pins[timer.pin].level, 0, timer.pin);
    assert.equal(advanceTo(runtime, 0.30).pins[timer.pin].level, 1, timer.pin);
    assert.equal(advanceTo(runtime, 0.60).pins[timer.pin].level, 0, timer.pin);
  }
});

test('AVR Timer0 fast PWM drives its alternate-function pin at the configured duty', () => {
  const runtime = runtimeFor([
    sbi(10, 6),
    ...store(0x47, 63), // OCR0A
    ...store(0x44, 0x83), // Fast PWM, non-inverting OC0A
    ...store(0x45, 0x03), // 64-cycle prescaler
    rjmp(-1),
  ]);
  assert.equal(advanceTo(runtime, 1.10).pins.D6.level, 1);
  assert.equal(advanceTo(runtime, 1.40).pins.D6.level, 0);
  assert.equal(advanceTo(runtime, 2.10).pins.D6.level, 1);
});

test('AVR USART0 receives and transmits firmware bytes through the console', () => {
  const sent = [];
  const runtime = runtimeFor([
    ...store(0xc4, 103), // UBRR0L, 9600 baud
    ...store(0xc1, 0x18), // UCSR0B, RXEN0 and TXEN0
    0x9100, 0xc0, // lds r16, UCSR0A
    0xff07, // sbrs r16, RXC0
    rjmp(-4),
    0x9100, 0xc6, // lds r16, UDR0
    0x9300, 0xc6, // sts UDR0, r16
    rjmp(-9),
  ], {onSerial: (text, port) => sent.push([text, port])});
  runtime.step(6);
  assert.equal(runtime.getState().uarts.Serial.baudRate, 9615);
  runtime.injectSerial('OK');
  assert.equal(advanceTo(runtime, 3).serial, 'OK');
  assert.deepEqual(sent, [['O', 'Serial'], ['K', 'Serial']]);
  assert.equal(runtime.reset().serial, '');
});

test('AVR slices yield, and erased flash and unsupported opcodes give diagnostics', () => {
  const spinning = runtimeFor([rjmp(-1)]);
  const slice = spinning.advanceTime(10_000);
  assert(slice.timeMs > 0 && slice.timeMs <= 20.001);
  assert.equal(slice.budgetReached, true);
  assert.equal(slice.error, null);

  const erased = runtimeFor([0x0000]);
  const error = erased.step(2);
  assert.equal(error.steps, 1);
  assert.equal(error.error.code, 'AVR_EMPTY_FLASH');
  assert.equal(error.pc.byteAddress, 2);
  assert.equal(erased.step().steps, 0);
  assert.equal(runtimeFor([0x9588]).step().error.code, 'AVR_UNSUPPORTED_INSTRUCTION');
});

test('AVR ADC samples AVCC-scaled inputs with first and subsequent conversion timing', () => {
  const samples = [];
  const runtime = runtimeFor([
    ...store(0x7a, 0x87), // ADEN and prescaler, as in Arduino core init()
    ...store(0x7c, 0x40), // ADMUX: AVCC, channel A0
    ...store(0x7a, 0xc7), // ADEN and ADSC
    ...pollAdc,
    ...store(0x7a, 0xc7),
    rjmp(-1),
  ], {readAnalog(pin, state) {
    samples.push([pin, state.cycles]);
    return samples.length === 1 ? 2.5 : 3.75;
  }});
  const setup = runtime.step(2);
  assert.equal(setup.error, null);
  assert.equal(setup.adc.ADC0.enabled, true);
  assert.equal(setup.adc.ADC0.result, null);
  const firstBusy = advanceTo(runtime, 0.19).adc.ADC0;
  assert.equal(firstBusy.busy, true);
  assert.equal(firstBusy.pin, 'A0');
  assert.equal(firstBusy.result, null);
  assert.deepEqual(samples.map(([pin]) => pin), ['A0']);
  assert(samples[0][1] >= 1735 && samples[0][1] <= 1740);

  const secondBusy = advanceTo(runtime, 0.22).adc.ADC0;
  assert.equal(secondBusy.busy, true);
  assert.equal(secondBusy.result, 512);
  assert.equal(secondBusy.resultPin, 'A0');
  assert.equal(advanceTo(runtime, 0.30).adc.ADC0.result, 512);
  const second = advanceTo(runtime, 0.32).adc.ADC0;
  assert.equal(second.busy, false);
  assert.equal(second.result, 768);
  assert.equal(second.referenceVoltage, 5);
  assert.deepEqual(samples.map(([pin]) => pin), ['A0', 'A0']);
  assert.equal(runtime.reset().adc.ADC0.result, null);
});

test('AVR ADC reads Nano analog-only inputs with internal and external references', () => {
  for (const {mux, reference, voltage} of [
    {mux: 0xc6, reference: 1.1, voltage: 0.55},
    {mux: 0x07, reference: 2.5, voltage: 1.25},
  ]) {
    const pin = 'A' + (mux & 7);
    const runtime = runtimeFor([
      ...store(0x7c, mux),
      ...store(0x7a, 0xc7),
      rjmp(-1),
    ], {boardId: 'nano', readAnalog(actualPin) {
      assert.equal(actualPin, pin);
      return voltage;
    }, readReference: () => reference});
    const state = advanceTo(runtime, 0.22);
    assert.equal(state.boardId, 'nano');
    assert.equal(state.adc.ADC0.resultPin, pin);
    assert.equal(state.adc.ADC0.referenceVoltage, reference);
    assert.equal(state.adc.ADC0.result, 512);
    assert.equal(state.pins[pin], undefined);
  }
});

test('AVR ADC presents left-adjusted bytes, locks the pair on ADCL, and honors ADIF write-one-to-clear', () => {
  let reads = 0;
  const runtime = runtimeFor([
    ...store(0x2a, 0xff), // DDRD: show ADCH on D0–D7
    sbi(4, 4), sbi(4, 5),
    ...store(0x7c, 0x60), // AVCC, left-adjust result
    ...store(0x7a, 0xc7),
    ...pollAdc,
    ...load(0x78), // ADCL locks result until ADCH is read
    ...store(0x7a, 0xc7),
    ...pollAdc,
    ...load(0x79), out(11), // ADCH must still expose first sample
    ...load(0x7a), skipIfClear(4), sbi(5, 5), // ADIF set
    ...store(0x7a, 0x97),
    ...load(0x7a), skipIfClear(4), sbi(5, 4), // ADIF cleared
    rjmp(-1),
  ], {readAnalog: () => ++reads === 1 ? 2.5 : 3.75});
  const state = advanceTo(runtime, 0.34);
  assert.equal(reads, 2);
  assert.equal(state.adc.ADC0.result, 512);
  assert.equal(state.pins.D7.level, 1); // ADCH 0x80, second sample would be 0xc0
  assert.equal(state.pins.D6.level, 0);
  assert.equal(state.pins.D13.level, 1);
  assert.equal(state.pins.D12.level, 0);
});

test('AVR ADC conversion interrupt invokes the vector and clears ADIF', () => {
  const program = new Array(0x34).fill(0);
  program[0] = rjmp(0x33);
  program.splice(0x2a, 6, ...load(0x7a), skipIfClear(4), sbi(5, 4), sbi(5, 5), 0x9518);
  program.push(
    sbi(4, 4), sbi(4, 5),
    ...store(0x7c, 0x40), ...store(0x7a, 0xcf),
    0x9478, rjmp(-1), // SEI, idle
  );
  const runtime = runtimeFor(program, {readAnalog: () => 5});
  const state = advanceTo(runtime, 0.22);
  assert.equal(state.adc.ADC0.result, 1023);
  assert.equal(state.pins.D13.level, 1);
  assert.equal(state.pins.D12.level, 0);
});

test('AVR ADC diagnoses missing AREF, unavailable inputs and auto trigger', () => {
  const program = (mux, control) => [...store(0x7c, mux), ...store(0x7a, control), rjmp(-1)];
  const missingReference = runtimeFor(program(0x00, 0xc7));
  let state = missingReference.getState();
  while (!state.error && state.timeMs < 1) {
    const next = missingReference.advanceTime(1);
    assert(next.cycles > state.cycles);
    state = next;
  }
  assert.equal(state.error?.code, 'AVR_ADC_REFERENCE');
  assert.equal(runtimeFor(program(0x46, 0xc7)).step(4).error.code, 'AVR_ADC_SELECTION');
  assert.equal(runtimeFor(program(0x40, 0xe7)).step(4).error.code, 'AVR_ADC_AUTO_TRIGGER');
});

test('Mega 2560 maps all board pins, including ports above the basic I/O range', () => {
  const runtime = runtimeFor([
    ...store(0x21, 0x01), ...store(0x22, 0x01), // PA0 => D22
    ...store(0x24, 0x80), ...store(0x25, 0x80), // PB7 => D13
    ...store(0x30, 0x80), ...store(0x31, 0x80), // PF7 => A7
    ...store(0x101, 0x40), ...store(0x102, 0x40), // PH6 => D9
    ...store(0x107, 0x80), ...store(0x108, 0x80), // PK7 => A15
    ...store(0x10a, 0x20), // PL5 => D44 output; PL0 => D49 input
    ...load(0x109), skipIfClear(0), sbi(5, 0), // Exercise extended PINL read
    ...store(0x10b, 0x20), // PL5 => D44 high
    rjmp(-1),
  ], {boardId: 'mega2560'});
  runtime.setDigitalInputs({D49: 1});
  const state = advanceTo(runtime, 0.1);
  assert.equal(state.boardId, 'mega2560');
  assert.equal(state.capabilities.flashBytes, 262_144);
  assert.equal(state.capabilities.sramBytes, 8_192);
  assert.equal(Object.keys(state.pins).length, 70);
  for (const pin of ['D22', 'D13', 'A7', 'D9', 'A15', 'D44']) {
    assert.equal(state.pins[pin].mode, 'GPIO_Mode_Out_PP', pin);
    assert.equal(state.pins[pin].level, 1, pin);
  }
  assert.equal(state.pins.D49.level, 1);
  assert.equal(state.pins.D53.mode, 'GPIO_Mode_IPU');
});

test('Mega 2560 CALL and RET round-trip across 128 KiB Flash, with correct top-of-SRAM stack', () => {
  const high = 0x11000;
  const program = new Array(high + 5).fill(0xffff);
  const low = [
    ...store(0x24, 0xff), // DDRB
    0xe800, 0x930f, // ldi r16, 0x80; push r16
    ...load(0x21ff), out(5), 0x910f, // Peek stack top, drive PB7, pop r16
    0x940f, high & 0xffff, // CALL to byte address 0x22000
    sbi(5, 4), rjmp(-1),
  ];
  for (const [index, word] of low.entries()) program[index] = word;
  program[0x40] = sbi(5, 5);
  program[0x41] = 0x9508; // RET back to high Flash
  program.splice(high, 5, sbi(5, 6), 0x940e, 0x40, sbi(5, 3), 0x9508);
  const runtime = runtimeFor(program, {boardId: 'mega2560'});
  const entered = runtime.step(8);
  assert.equal(entered.pc.byteAddress, 0x22000);
  assert.equal(entered.pins.D13.level, 1);
  const returned = advanceTo(runtime, 0.1);
  assert.equal(returned.pins.D12.level, 1);
  assert.equal(returned.pins.D11.level, 1);
  assert.equal(returned.pins.D50.level, 1);
  assert.equal(returned.pins.D10.level, 1);
  assert(returned.pc.byteAddress < 0x80);
});

test('Mega 2560 all six timers drive their Arduino output compare pins', () => {
  const timers = [
    {pin: 'D13', ddr: 0x24, mask: 0x80, base: 0x44, modeA: 0x42, modeB: 0x03, ocra: 0x47},
    {pin: 'D11', ddr: 0x24, mask: 0x20, base: 0x80, modeA: 0x40, modeB: 0x0b, ocra: 0x88},
    {pin: 'D10', ddr: 0x24, mask: 0x10, base: 0xb0, modeA: 0x42, modeB: 0x04, ocra: 0xb3},
    {pin: 'D5', ddr: 0x2d, mask: 0x08, base: 0x90, modeA: 0x40, modeB: 0x0b, ocra: 0x98},
    {pin: 'D6', ddr: 0x101, mask: 0x08, base: 0xa0, modeA: 0x40, modeB: 0x0b, ocra: 0xa8},
    {pin: 'D46', ddr: 0x10a, mask: 0x08, base: 0x120, modeA: 0x40, modeB: 0x0b, ocra: 0x128},
  ];
  for (const timer of timers) {
    const runtime = runtimeFor([
      ...store(timer.ddr, timer.mask),
      ...store(timer.ocra, 63),
      ...store(timer.base, timer.modeA),
      ...store(timer.base + 1, timer.modeB),
      rjmp(-1),
    ], {boardId: 'mega2560'});
    assert.equal(advanceTo(runtime, 0.20).pins[timer.pin].level, 0, timer.pin);
    assert.equal(advanceTo(runtime, 0.30).pins[timer.pin].level, 1, timer.pin);
    assert.equal(advanceTo(runtime, 0.60).pins[timer.pin].level, 0, timer.pin);
  }
});

test('Mega 2560 Timer5 phase-correct PWM channel C drives Arduino D44', () => {
  const runtime = runtimeFor([
    ...store(0x10a, 0x20),
    ...store(0x120, 0x09), // TCCR5A: WGM50 and COM5C1
    ...store(0x12c, 64), // OCR5C
    ...store(0x121, 0x03), // 64-cycle prescaler
    rjmp(-1),
  ], {boardId: 'mega2560'});
  assert.equal(advanceTo(runtime, 1.80).pins.D44.level, 1);
  assert.equal(advanceTo(runtime, 2.40).pins.D44.level, 0);
  assert.equal(advanceTo(runtime, 3.90).pins.D44.level, 1);
});

test('Mega 2560 Timer0 overflow and D2 external input use the Mega interrupt vectors', () => {
  const program = new Array(0x80).fill(0);
  program[0] = rjmp(0x7f);
  program[0x0a] = sbi(5, 6); // INT4 (D2/PE4)
  program[0x0b] = 0x9518;
  program[0x2e] = sbi(5, 7); // TIMER0_OVF
  program[0x2f] = 0x9518;
  program.push(
    ...store(0x24, 0xc0),
    ...store(0x6a, 3), // EICRB, INT4 rising
    ...store(0x3d, 0x10), // EIMSK, INT4 enabled
    ...store(0x44, 3), ...store(0x45, 3), // Fast PWM, prescaler 64
    ...store(0x6e, 1), 0x9478, rjmp(-1), // Overflow interrupt, SEI
  );
  const runtime = runtimeFor(program, {boardId: 'mega2560'});
  assert.equal(advanceTo(runtime, 0.5).pins.D13.level, 0);
  assert.equal(advanceTo(runtime, 1.2).pins.D13.level, 1);
  assert.equal(runtime.getState().pins.D12.level, 0);
  runtime.setDigitalInputs({D2: 1});
  assert.equal(advanceTo(runtime, 1.3).pins.D12.level, 1);
});

test('Mega 2560 native serial echo uses all four separately addressed USARTs', () => {
  const bases = [0xc0, 0xc8, 0xd0, 0x130];
  for (const [index, base] of bases.entries()) {
    const expectedPort = index ? 'Serial' + index : 'Serial';
    const sent = [];
    const runtime = runtimeFor([
      ...store(base + 4, 103),
      ...store(base + 1, 0x18),
      ...load(base), 0xff07, rjmp(-4),
      ...load(base + 6), 0x9300, base + 6, rjmp(-9),
    ], {boardId: 'mega2560', onSerial: (text, port) => sent.push([text, port])});
    const configured = runtime.step(6);
    assert.equal(Object.values(configured.uarts).filter(uart => uart.enabled).length, 1);
    assert.equal(configured.uarts[expectedPort].baudRate, 9615);
    runtime.injectSerial('M', expectedPort);
    assert.equal(advanceTo(runtime, 2).serial, 'M');
    assert.deepEqual(sent, [['M', expectedPort]]);
  }
});

test('Mega 2560 Timer5 compare C and USART3 data-empty invoke their interrupt vectors', () => {
  const program = new Array(0x80).fill(0);
  program[0] = rjmp(0x7f);
  program[0x62] = sbi(5, 7); // TIMER5_COMPC
  program[0x63] = 0x9518;
  program.splice(0x6e, 7,
    ...store(0x131, 0x08), // USART3_UDRE: disable data-empty interrupt, keep TX
    ...store(0x136, 0x58), // UDR3 sends X
    0x9518,
  );
  program.push(
    sbi(4, 7),
    ...store(0x12c, 63), ...store(0x121, 3), // OCR5C and prescaler
    ...store(0x73, 8), // TIMSK5 compare C
    ...store(0x131, 0x28), // USART3 TX + data-empty interrupt
    0x9478, rjmp(-1),
  );
  const serial = [];
  const runtime = runtimeFor(program, {boardId: 'mega2560', onSerial: (text, port) => serial.push([text, port])});
  assert.equal(advanceTo(runtime, 0.20).pins.D13.level, 0);
  assert.deepEqual(serial, [['X', 'Serial3']]);
  assert.equal(advanceTo(runtime, 0.30).pins.D13.level, 1);
});
