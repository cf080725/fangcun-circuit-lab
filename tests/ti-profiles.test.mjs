import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTiProfiles} from '../dist/sim-profiles-ti.js';

const [mspm0,msp430]=makeTiProfiles();

test('TI Rev A LaunchPad profiles preserve the four physical BoosterPack rows',()=>{
  for(const [board,height,top] of [[mspm0,10.668,-.127],[msp430,7.366,0]]) {
    assert.equal(board.width,5.842);
    assert.equal(board.height,height);
    assert.equal(board.pins.length,40);
    assert.equal(new Set(board.pins.map(pin=>pin.id)).size,40);
    for(const [header,x,first,step] of [['J1',-2.286,1,1],['J3',-2.032,21,1],['J2',2.286,20,-1],['J4',2.032,40,-1]]) {
      const row=board.pins.filter(pin=>pin.id.startsWith(header+'_'));
      assert.equal(row.length,10);
      row.forEach((pin,index)=>{
        assert.equal(pin.id,header+'_'+(first+step*index));
        assert.equal(pin.x,x);
        assert.ok(Math.abs(pin.z-top-index*.254)<1e-9);
        assert.equal(pin.contact,'male');
      });
    }
  }
});

test('TI example numbers select a real GPIO, ADC or timer contact by header pin number',()=>{
  for(const [board,buttonIndex] of [[mspm0,15],[msp430,17]]) {
    assert.equal(board.numberedPins[19],board.defaultPins.led);
    assert.equal(board.numberedPins[19],board.defaultPins.pwm);
    assert.equal(board.numberedPins[buttonIndex],board.defaultPins.button);
    assert.equal(board.numberedPins[2],board.defaultPins.adc);
    assert.ok(board.analogPins.includes(board.defaultPins.adc));
    assert.ok(board.pwmPins.includes(board.defaultPins.pwm));
    assert.equal(board.pins.find(pin=>pin.id==='J1_1').canonical,'3V3');
    assert.equal(board.pins.find(pin=>pin.id==='J3_21').canonical,'5V');
    assert.equal(board.numberedPins[21],undefined);
    assert.equal(board.arduinoExport,false);
  }
  assert.equal(mspm0.numberedPins[3],'PB23');
  assert.equal(mspm0.numberedPins[29],'PA16');
  assert.ok(mspm0.reservedPins.includes('PB23'));
  assert.ok(mspm0.reservedPins.includes('PA18'));
  assert.ok(!mspm0.analogPins.includes('PB24'));
  assert.equal(msp430.numberedPins[23],'P1.4');
  assert.equal(msp430.numberedPins[27],'P5.4');
  assert.equal(msp430.numberedPins[38],'P6.1');
  assert.ok(msp430.reservedPins.includes('P2.2'));
});
