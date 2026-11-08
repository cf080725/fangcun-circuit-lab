import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber,canonicalPin,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {getMountOptions} from '../dist/breadboard-mount.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';

test('the WCH CH32V003 R0-1v1 model uses the actual P1 and P2 contact map', () => {
  const id = 'ch32v003-evt';
  const board = getBoardProfile(id);
  assert.equal(board.boardMarking, 'CH32V003F4P6-R0-1v1');
  assert.equal(board.pins.length, 28);
  const expected = [
    ['P1_3','PD4',-1.4803,.1397],
    ['P2_11','PC4',1.0978,1.1557],
    ['P2_14','PC1',1.3518,1.4097]
  ];
  for (const [endpoint,signal,x,z] of expected) {
    const contact = board.pins.find(pin=>pin.id===endpoint);
    assert.equal(contact.canonical,signal);
    assert.equal(contact.contact,'male');
    assert.ok(Math.abs(contact.x-x)<.0001&&Math.abs(contact.z-z)<.0001);
  }
  assert.equal(boardPinNumber('PD4',id),52);
  assert.equal(boardPinNumber('PC4',id),36);
  assert.equal(canonicalPin('P1_1',id),'VCC');
  assert.equal(canonicalPin('PD7',id),'NRST');
  assert.equal(board.adcMax,1023);
  assert.equal(getMountOptions(board),null);
  for (const pin of [1,2,49]) {
    const runtime = createBoardRuntime(compileForBoard({'sketch.ino':`void setup(){pinMode(${pin}, OUTPUT);} void loop(){}`},id));
    assert.equal(runtime.runUntilDelay(100).error?.code,'BOARD_PIN_RESERVED');
  }
});

test('the WCH CH32V307 R1 model maps its physical female headers and voltage rails', () => {
  const id = 'ch32v307-evt';
  const board = getBoardProfile(id);
  assert.equal(board.boardMarking,'CH32V307V-R1-1v0');
  assert.equal(board.pins.length,32);
  const expected = [
    ['D2','PA8',2.413,1.7226,'J8.6'],
    ['D7','PB9',2.413,.4526,'J8.1'],
    ['A0','PA0',-2.413,.9606,'J6.1']
  ];
  for (const [endpoint,signal,x,z,location] of expected) {
    const contact = board.pins.find(pin=>pin.id===endpoint);
    assert.equal(contact.canonical,signal);
    assert.equal(contact.contact,'female');
    assert.equal(contact.location,location);
    assert.ok(Math.abs(contact.x-x)<.0001&&Math.abs(contact.z-z)<.0001);
  }
  assert.deepEqual(expected.map(([,pin])=>boardPinNumber(pin,id)),[2,7,16]);
  assert.equal(canonicalPin('J5_5',id),'5V');
  assert.equal(canonicalPin('J5_4',id),'VCC');
  assert.equal(board.pins.find(pin=>pin.id==='J5_5').location,'J5.5');
  assert.equal(board.pins.find(pin=>pin.id==='D13').location,'J7.5');
  assert.equal(board.logicVoltage,3.3);
  assert.equal(board.adcMax,4095);
  assert.equal(board.arduinoExport,false);
  assert.equal(getMountOptions(board),null);
  const starter = makeBoardStarter(id,'adc');
  assert.ok(starter.circuit.wires.some(wire=>wire.a==='mcu:J5_2'&&wire.b==='pot1:VCC'));
  assert.ok(starter.circuit.wires.some(wire=>wire.a==='pot1:OUT'&&wire.b==='mcu:A0'));
});
