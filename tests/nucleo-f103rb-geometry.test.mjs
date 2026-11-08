import assert from 'node:assert/strict';
import test from 'node:test';
import {getMountOptions} from '../dist/breadboard-mount.js';
import {getBoardProfile, makeBoardStarter} from '../dist/board-profiles.js';
import {boardVisual, hardwareResetLabel} from '../dist/model-renderer.js';
import {nucleoF103rbContact, nucleoF103rbGeometry} from '../dist/nucleo-f103rb-geometry.js';
import {parseLabProject} from '../dist/project-import.js';

const boardId='nucleo-f103rb';
const profile=getBoardProfile(boardId);
const pins=new Map(profile.pins.map(pin=>[pin.id,pin]));
const point=id=>pins.get(id);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} ≈ ${expected}`);

test('all 108 NUCLEO-F103RB bench terminals align to their physical MB1136 connector and pitch',()=>{
  const model=boardVisual(profile);
  assert.equal(model.pins.length,108);
  assert.equal(pins.size,108);
  assert.equal(model.pins.filter(pin=>pin.contact==='male').length,76);
  assert.equal(model.pins.filter(pin=>pin.contact==='female').length,32);
  assert.equal(new Set(model.pins.map(({x,z})=>`${x},${z}`)).size,108);
  for(const pin of model.pins){
    const {connector,connectorPin,contact,contactY,x,z}=pin;
    assert.deepEqual(nucleoF103rbContact(connector,connectorPin),{connector,connectorPin,contact,contactY,x,z});
    assert.equal(pin.location,`${connector}.${connectorPin}`);
    assert.equal(contactY,contact==='male'?.96:1.20);
  }
  for(const prefix of ['CN7','CN10']){
    for(let n=1;n<=36;n++)near(point(`${prefix}_${n+2}`).z-point(`${prefix}_${n}`).z,.254);
    near(point(`${prefix}_2`).x-point(`${prefix}_1`).x,.254);
  }
  near(point('CN10_2').x-point('CN7_1').x,6.35);
  near(point('D15').x-point('A0').x,4.826);
  near(point('A0').z-point('ARD_left_7').z,.508);
  near(point('D7').z-point('D8').z,.4064);
  assert.equal(nucleoF103rbContact('CN10',39),null);
  assert.equal(nucleoF103rbContact('CN9',0),null);
  assert.equal(nucleoF103rbContact('toString',1),null);
  assert.equal(getMountOptions(profile),null,'use jumper leads with this board and breadboard');
});

test('physical connector numbering leaves the existing circuit IDs and default STM32 wiring intact',()=>{
  const expected={
    CN7_14:['CN7.14','NRST'],CN7_16:['CN7.16','3V3'],CN7_21:['CN7.21','PB7'],CN7_23:['CN7.23','PC13'],
    CN7_28:['CN7.28','PA0'],CN10_11:['CN10.11','PA5'],CN10_17:['CN10.17','PB6'],CN10_27:['CN10.27','PB4'],
    ARD_left_0:['CN6.1','NC'],ARD_left_2:['CN6.3','NRST'],A0:['CN8.1','PA0'],A4:['CN8.5','PC1'],A5:['CN8.6','PC0'],
    D15:['CN5.10','PB8'],D14:['CN5.9','PB9'],D13:['CN5.6','PA5'],D10:['CN5.3','PB6'],D8:['CN5.1','PA9'],
    D7:['CN9.8','PA8'],D5:['CN9.6','PB4'],D1:['CN9.2','PA2'],D0:['CN9.1','PA3'],
  };
  for(const [id,[location,canonical]] of Object.entries(expected)){
    assert.equal(point(id).location,location);
    assert.equal(profile.pinAliases[id],canonical);
  }
  for(const pin of ['CN7_9','CN7_11','CN10_10','CN10_38'])assert.equal(profile.pinAliases[pin],pin);
  assert.equal(profile.userButton.pin,'PC13');
  assert.equal(profile.userButton.activeLow,true);
  assert.equal(profile.ledPin,'PA5');
  const {files,circuit}=makeBoardStarter(boardId,'adc');
  const restored=parseLabProject(JSON.stringify({version:2,files,circuit}));
  assert.deepEqual(restored.circuit,circuit);
});

test('the procedural Nucleo view shares the model outline, chip, switches and LED centres',()=>{
  const model=boardVisual(profile),{features,outline,holes}=nucleoF103rbGeometry;
  assert.deepEqual([model.width,model.height,model.thickness],[7,8.25,.14]);
  assert.deepEqual(model.outline,outline);
  assert.deepEqual(model.holes,holes);
  assert.equal(model.mountHoleRadius,.16);
  const b1=model.features.find(feature=>feature.buttonId===profile.userButton.id);
  const b2=model.features.find(feature=>feature.boardReset);
  const led=model.features.find(feature=>feature.id==='onboard');
  const power=model.features.find(feature=>feature.id==='power-led');
  const chip=model.features.find(feature=>feature.label===profile.mcu);
  const usb=model.features.find(feature=>feature.type==='usb');
  for(const [actual,datum] of [[b1,features.b1],[b2,features.b2],[led,features.ld2],[power,features.ld3],[chip,features.mcu],[usb,features.usb]]){
    for(const [key,value] of Object.entries(datum))assert.equal(actual[key],value,key);
  }
  assert.equal(b2.label,hardwareResetLabel(boardId));
  assert.equal(chip.pinsPerSide*4,64);
  assert.equal(chip.leadPitch,.05);
  assert.ok(usb.mouthZ<-model.height/2);
});
