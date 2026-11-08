import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dip28PinLayout, lqfp64PinLayout, wroom32ePadLayout, rp2040PadLayout, positionChipBlocks } from '../dist/chip-inspection-layout.js';
import { RP2040_CHIP_INSPECTION, RP2040_GROUND_PAD, rp2040PadForSignal } from '../dist/rp2040-chip-inspection.js';
import { NUCLEO_F103RB_INSPECTION } from '../dist/nucleo-f103rb-inspection.js';

test('DIP-28 numbering descends the left side and returns up the right', () => {
  assert.equal(dip28PinLayout(1).labelX, dip28PinLayout(14).labelX);
  assert.equal(dip28PinLayout(1).z, dip28PinLayout(28).z);
  assert.equal(dip28PinLayout(14).z, dip28PinLayout(15).z);
  assert.ok(dip28PinLayout(1).z < dip28PinLayout(14).z);
  assert.equal(dip28PinLayout(29), null);
});

test('NUCLEO inspection links six physical connectors and board controls to the LQFP64 data', () => {
  const { pins, chip, photo } = NUCLEO_F103RB_INSPECTION;
  assert.equal(photo.kind, 'render');
  assert.equal(pins.length, 111);
  assert.equal(new Set(pins.map(pin => pin.id)).size, pins.length);
  assert.equal(chip.pins.length, 64);
  assert.equal(lqfp64PinLayout(65), null);
  for (const [index,side] of ['left','bottom','right','top'].entries()) {
    const first = index * 16 + 1;
    assert.equal(lqfp64PinLayout(first).side, side);
    assert.equal(lqfp64PinLayout(first + 15).side, side);
  }
  assert.ok(Math.abs(lqfp64PinLayout(2).z - lqfp64PinLayout(1).z - .35) < 1e-10);
  for (const [id,number,signal] of [['BOARD_B1',2,'PC13'],['CN7_23',2,'PC13'],['BOARD_B2',7,'NRST'],
    ['D13',21,'PA5'],['CN10_11',21,'PA5'],['BOARD_LD2',21,'PA5']]) {
    const pin = pins.find(pin => pin.id === id);
    assert.equal(pin.chipPin, number, id);
    assert.equal(chip.pins[number - 1].signal, signal, id);
  }
  for (const pin of pins) {
    assert.ok(pin.x > 0 && pin.x < 1 && pin.y > 0 && pin.y < 1, pin.id);
    assert.ok(!pin.label.includes('undefined'), pin.id);
  }
});

test('WROOM-32E edge contacts wrap around the antenna-free sides and keep the exposed pad separate', () => {
  assert.deepEqual(wroom32ePadLayout(1).z, wroom32ePadLayout(38).z);
  assert.deepEqual(wroom32ePadLayout(14).z, wroom32ePadLayout(25).z);
  assert.ok(wroom32ePadLayout(15).x < wroom32ePadLayout(24).x);
  assert.ok(wroom32ePadLayout(15).z > wroom32ePadLayout(14).z);
  assert.equal(wroom32ePadLayout(39).bottom, true);
});

test('RP2040 follows the datasheet top-view numbering and 0.40 mm pitch', () => {
  const {pins, blocks} = RP2040_CHIP_INSPECTION;
  assert.deepEqual(pins.map(pin => pin.number), Array.from({length: 57}, (_, i) => i + 1));
  const pad = number => pins[number - 1].signal;
  assert.deepEqual([1,14,15,28,29,42,43,56,57].map(pad), [
    'IOVDD', 'GPIO11', 'GPIO12', 'GPIO17', 'GPIO18', 'IOVDD', 'ADC_AVDD', 'QSPI_SS_N', 'GND'
  ]);
  assert.equal(rp2040PadLayout(1).x, -3.3);
  assert.equal(rp2040PadLayout(15).z, 3.3);
  assert.equal(rp2040PadLayout(29).x, 3.3);
  assert.equal(rp2040PadLayout(43).z, -3.3);
  assert.ok(rp2040PadLayout(1).z < rp2040PadLayout(14).z);
  assert.ok(rp2040PadLayout(15).x < rp2040PadLayout(28).x);
  assert.ok(rp2040PadLayout(29).z > rp2040PadLayout(42).z);
  assert.ok(rp2040PadLayout(43).x > rp2040PadLayout(56).x);
  assert.ok(Math.abs(rp2040PadLayout(2).z - rp2040PadLayout(1).z - .40) < 1e-10);
  assert.deepEqual(rp2040PadLayout(RP2040_GROUND_PAD), {x: 0, z: 0, angle: 0, labelX: 0, labelZ: 0, bottom: true});
  assert.equal(rp2040PadLayout(58), null);
  assert.match(pins[1].summary, /SPI0 RX.*UART0 TX.*I²C0 SDA.*PWM0 A/);
  assert.match(pins[37].summary, /SPI1 SCK.*UART1 CTS.*I²C1 SDA.*PWM5 A.*ADC 的通道 0/);
  for (const block of blocks) for (const number of block.pins ?? []) assert.ok(pad(number));
});

test('Pico signals follow physical RP2040 pads while board supply networks avoid false one-to-one matches', () => {
  const gpPads = [2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,27,28,29,30,31,32,34,35,36,37,38,39,40,41];
  assert.deepEqual(gpPads.map((_, gpio) => rp2040PadForSignal('GP' + gpio)), gpPads);
  assert.deepEqual(['RUN', 'SWCLK', 'SWDIO', 'D−', 'D+', 'ADC_VREF', 'AGND', 'GND1'].map(rp2040PadForSignal), [26,24,25,46,47,43,57,57]);
  assert.deepEqual(['VBUS', 'VSYS', '3V3_EN', '3V3', 'IOVDD'].map(rp2040PadForSignal), [null,null,null,null,null]);
});

test('teaching blocks fit inside the modeled shell', () => {
  const options = { width: 7, depth: 8, centerZ: .75, columns: 3 };
  const blocks = positionChipBlocks(Array.from({length: 9}, (_,id) => ({id})), options);
  assert.equal(blocks.length,9);
  for (const block of blocks) {
    assert.ok(Math.abs(block.x) + block.w / 2 < options.width / 2);
    assert.ok(Math.abs(block.z - options.centerZ) + block.d / 2 < options.depth / 2);
  }
});
