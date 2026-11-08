import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPinNumber,canonicalPin,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {compileForBoard,createBoardRuntime} from '../dist/engine.js';

function expectSocket(board,id,signal,connector,connectorPin) {
  const pin=board.pins.find(pin=>pin.id===id);
  assert.equal(pin?.canonical,signal,id);
  assert.equal(pin.connector,connector,id);
  assert.equal(pin.connectorPin,connectorPin,id);
  assert.equal(pin.contact,'female',id);
  assert.equal(pin.side,connector==='J1'||connector==='J2'?'right':'left',id);
}

test('FRDM-K64F Rev E uses the corrected D8 and the verified shield starter contacts',()=>{
  const id='frdm-k64f',board=getBoardProfile(id);
  assert.equal(board.logicVoltage,3.3);
  assert.equal(board.nativeAdcBits,16);
  expectSocket(board,'D8','PTC12','J2',2);
  expectSocket(board,'D13','PTD1','J2',12);
  expectSocket(board,'D2','PTB9','J1',6);
  expectSocket(board,'D3','PTA1','J1',8);
  expectSocket(board,'A0','PTB2','J4',2);
  assert.equal(boardPinNumber('PTA1',id),3);
  assert.equal(canonicalPin(16,id),'PTB2');
});

test('FRDM-MCXN947 defaults keep D3 separate from factory-routed J3 PWM and dedicated ADC inputs',()=>{
  const id='frdm-mcxn947',board=getBoardProfile(id);
  expectSocket(board,'D3','P1_23','J1',8);
  expectSocket(board,'D13','P0_25','J2',12);
  expectSocket(board,'D2','P0_29','J1',6);
  expectSocket(board,'A0','ADC0_A0','J4',2);
  expectSocket(board,'A1','ADC0_B0','J4',4);
  expectSocket(board,'J3_15','P2_6','J3',15);
  assert.equal(board.defaultPins.pwm,'P2_6');
  assert.ok(!board.pwmPins.includes('P1_23'));
  assert.ok(makeBoardStarter(id,'pwm').circuit.wires.some(wire=>wire.a==='mcu:J3_15'));
  const code={'sketch.ino':'void setup(){digitalRead(A0);} void loop(){delay(1);}'};
  assert.equal(createBoardRuntime(compileForBoard(code,id)).runUntilDelay(200).error?.code,'BOARD_ANALOG_ONLY');
});
