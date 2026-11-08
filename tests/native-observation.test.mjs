import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {setJoystickState} from '../dist/analog-joystick.js';
import {createAvrFirmwareRuntime} from '../dist/avr-firmware-runtime.js';
import {parseAvrHex} from '../dist/avr-firmware-hex.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {setButtonContact} from '../dist/button-contact.js';
import {CircuitSimulator,createCircuit,makePart} from '../dist/circuit.js';
import {nativeObservationContext,nativeObservationSample} from '../dist/native-observation.js';
import {scheduleEncoderDetent,setEncoderSwitch} from '../dist/rotary-encoder.js';
import {parseRp2040Uf2} from '../dist/rp2040-firmware-image.js';
import {createRp2040FirmwareRuntime} from '../dist/rp2040-firmware-runtime.js';

const wire=(a,b)=>({a,b});
const asset=(path,encoding)=>readFileSync(new URL('../dist/firmware/'+path,import.meta.url),encoding);
const stm32State={boardId:'bluepill',dialect:'stm32-firmware',timeMs:10,executedSteps:500,status:'ready',
  pins:{PA0:{clock:true,mode:'GPIO_Mode_AF_PP',level:1,output:1,pwm:{frequencyHz:100,duty:.25,level:1}}}};

function context(circuit,options={}){
  return nativeObservationContext({circuit,profile:getBoardProfile(circuit.boardId),pin:'PA0',ledId:'led1',...options});
}

test('native observation context matches electrical conditions, aliases and ordered measurement endpoints',()=>{
  const circuit=createCircuit();
  const probes={red:'mcu:PA0',black:'mcu:GND'};
  const first=context(circuit,{probes});
  const moved=structuredClone(circuit);
  moved.board={x:99,z:-99,rotation:180};
  moved.breadboard={x:-77,z:77};
  Object.assign(moved.components[0],{x:13,z:12,rotation:270,hidden:true});
  moved.wires=moved.wires.reverse().map(({a,b},i)=>({id:`new-${i}`,a:b,b:a,color:'red'}));
  assert.equal(context(moved,{pin:'mcu:PA0',probes,timeMs:40}),first);
  assert.notEqual(context(moved,{pin:'PA1',probes}),first);
  assert.notEqual(context(moved,{ledId:'onboard',probes}),first);
  assert.notEqual(context(moved,{probes:{red:probes.black,black:probes.red}}),first);
  moved.components.find(part=>part.type==='resistor').resistance=1000;
  assert.notEqual(context(moved,{probes}),first);
  moved.components.find(part=>part.type==='resistor').resistance=330;
  moved.board.mount={column:6,rotation:90};
  const mounted=context(moved,{probes});
  assert.notEqual(mounted,first);
  moved.board.mount.column=7;
  assert.notEqual(context(moved,{probes}),mounted);
  moved.board.mount.column=6;
  moved.powered=false;
  assert.notEqual(context(moved,{probes}),mounted);
});

test('connected mounted button bounce is ineligible until settled, isolated or one-sided bounce is immaterial',()=>{
  const circuit=createCircuit();
  const button={...makePart('button','switch1'),bounce:true,mount:{hole:'bb:f20',rotation:90}};
  circuit.components.push(button);
  const isolated=context(circuit);
  setButtonContact(button,true,10);
  assert.equal(context(circuit,{timeMs:11}),isolated);
  setButtonContact(button,false,20);
  circuit.wires.push(wire('bb:j20','mcu:PB1'));
  const oneSide=context(circuit,{timeMs:21});
  setButtonContact(button,true,25);
  assert.equal(context(circuit,{timeMs:26}),oneSide);
  setButtonContact(button,false,30);
  circuit.board.mount={column:6,rotation:90};
  // The seated board connects the opposite button group via the E20 strip.
  const released=context(circuit,{timeMs:34});
  assert.equal(typeof released,'string');
  setButtonContact(button,true,40);
  assert.equal(context(circuit,{timeMs:41}),null);
  assert.notEqual(context(circuit,{timeMs:44}),released);
  assert.equal(typeof context(circuit,{timeMs:44}),'string');
});

test('encoder quadrature, switch and joystick pose affect only their connected input paths',()=>{
  const circuit=createCircuit();
  const encoder=makePart('encoder','encoder1'),joystick=makePart('joystick','joystick1');
  circuit.components.push(encoder,joystick);
  circuit.wires.push(wire('encoder1:SW1','mcu:PB0'),wire('encoder1:SW2','mcu:GND'),
    wire('joystick1:HORIZ','mcu:PA1'),wire('joystick1:GND','mcu:GND'));
  const resting=context(circuit);
  scheduleEncoderDetent(encoder,1,10,{notBeforeMs:20});
  assert.equal(context(circuit,{timeMs:15}),resting);
  setJoystickState(joystick,{y:.5,pressed:true});
  assert.equal(context(circuit,{timeMs:15}),resting);
  setJoystickState(joystick,{x:.5});
  const tilted=context(circuit,{timeMs:15});
  assert.notEqual(tilted,resting);
  setEncoderSwitch(encoder,true);
  assert.notEqual(context(circuit,{timeMs:15}),tilted);
  circuit.wires.push(wire('encoder1:A','mcu:PB1'),wire('encoder1:C','mcu:GND'));
  assert.equal(context(circuit,{timeMs:15}),null);
  assert.equal(context(circuit,{timeMs:50}),null);
  const settled=context(circuit,{timeMs:68});
  assert.equal(typeof settled,'string');
  assert.equal(context(circuit,{timeMs:120}),settled);
  scheduleEncoderDetent(encoder,-1,120);
  assert.notEqual(context(circuit,{timeMs:168}),settled);
});

test('STM32 sample preserves separate pin voltage and LED cycle-average current, plus exact private payload',()=>{
  const circuit=createCircuit();
  const result=new CircuitSimulator().solve(circuit,stm32State);
  const firmware={name:'application.hex',hex:':compiled-stm32-image',active:true};
  const probes={red:'mcu:GND',black:'mcu:PA0'};
  const sample=nativeObservationSample({state:stm32State,result,firmware,pin:'mcu:PA0',ledId:'led1',probes});
  assert.deepEqual(sample,{
    timeMs:10,pin:'PA0',pinMode:'GPIO_Mode_AF_PP',voltage:result.measureBetween('mcu:PA0','mcu:GND'),
    pwm:{frequencyHz:100,duty:.25},led:{currentMa:result.parts.led1.pwmAverage.currentMa,mode:'average'},
    probes:{...probes,status:'measured',voltage:-sample.voltage.voltage},firmwareName:'application.hex'
  });
  assert.ok(sample.voltage.voltage>3);
  assert.ok(sample.led.currentMa>0 && sample.led.currentMa<result.parts.led1.currentMa);
  assert.deepEqual(Object.getOwnPropertyDescriptor(sample,'firmwarePayload'),{
    value:firmware.hex,enumerable:false,writable:false,configurable:false
  });
  assert.equal(structuredClone(sample).firmwarePayload,undefined);
  assert.ok(!JSON.stringify(sample).includes(firmware.hex));
});

test('invalid native runtime and electrical failures cannot create a baseline',()=>{
  const circuit=createCircuit(),sim=new CircuitSimulator();
  const result=sim.solve(circuit,stm32State);
  const valid={state:stm32State,result,firmware:{name:'test.hex',hex:'contents',active:true},pin:'PA0'};
  for(const state of [null,{...stm32State,dialect:'spl'},{...stm32State,timeMs:NaN},
    {...stm32State,executedSteps:0},{...stm32State,error:{message:'fault'}},
    {...stm32State,status:'error'},{...stm32State,boardId:'unknown'}]){
    assert.equal(nativeObservationSample({...valid,state}),null);
  }
  assert.equal(nativeObservationSample({...valid,firmware:{...valid.firmware,active:false}}),null);
  assert.equal(nativeObservationSample({...valid,firmware:{...valid.firmware,hex:new String('contents')}}),null);
  assert.equal(nativeObservationSample({...valid,result:{...result,boardId:'pico'}}),null);
  for(const code of ['SUPPLY_SHORT','ELECTRICAL_CONFLICT','OUTPUT_CONFLICT','BOARD_MISMATCH','POWER_OFF','BOOT_MODE']){
    assert.equal(nativeObservationSample({...valid,result:{...result,issues:[{code}]}}),null);
  }
  assert.equal(nativeObservationSample({...valid,result:{...result,converged:false}}),null);
  circuit.wires.push(wire('mcu:3V3','mcu:GND'));
  const shorted=sim.solve(circuit,stm32State);
  assert.ok(shorted.issues.some(({code})=>code==='SUPPLY_SHORT'));
  assert.equal(nativeObservationSample({...valid,result:shorted}),null);
});

test('PWM cycle measurement is opt-in and its result is retained with a snapshot',()=>{
  const circuit=createCircuit(),result=new CircuitSimulator().solve(circuit,stm32State);
  const cycle={pin:'PA0',frequencyHz:100,duty:.25,periodMs:10,highFirst:true,voltage:{low:0,high:3.13},led:null};
  const calls=[];
  const fixture={state:stm32State,result:{...result,measurePwmCycle:(...args)=>{calls.push(args);return cycle;}},
    firmware:{name:'test.hex',hex:'payload',active:true},pin:'PA0',ledId:'led1'};
  assert.equal(nativeObservationSample(fixture).pwmCycle,undefined);
  assert.deepEqual(calls,[]);
  assert.deepEqual(nativeObservationSample({...fixture,measurePwm:true}).pwmCycle,cycle);
  assert.deepEqual(calls,[['PA0','led1']]);
});

test('actual AVR HEX sample reports solved onboard LED current and identifies floating or missing probes',()=>{
  const circuit=createCircuit('blink','uno-r3'),solver=new CircuitSimulator();
  const firmware={name:'blink.hex',hex:asset('uno-r3/blink.hex','utf8'),active:true};
  const runtime=createAvrFirmwareRuntime(parseAvrHex(firmware.hex),{boardId:'uno-r3'});
  const args={firmware,pin:'13',ledId:'onboard'};
  const initial=runtime.getState();
  assert.equal(nativeObservationSample({...args,state:initial,result:solver.solve(circuit,initial)}),null);
  const state=runtime.advanceTime(5),result=solver.solve(circuit,state);
  const sample=nativeObservationSample({...args,state,result,probes:{red:'mcu:A0',black:'mcu:GND'}});
  assert.equal(sample.pin,'D13');
  assert.equal(sample.pinMode,'GPIO_Mode_Out_PP');
  assert.equal(sample.pwm,null);
  assert.ok(sample.voltage.voltage>4.9);
  assert.deepEqual(sample.led,{currentMa:result.parts.onboard.currentMa,mode:'instantaneous'});
  assert.ok(sample.led.currentMa>0);
  assert.deepEqual(sample.probes,{red:'mcu:A0',black:'mcu:GND',status:'floating',voltage:null});
  assert.deepEqual(nativeObservationSample({...args,state,result,probes:{red:'removed:1',black:'mcu:GND'}}).probes,
    {red:'removed:1',black:'mcu:GND',status:'unavailable',voltage:null});
});

test('actual Pico UF2 sample reports PWM and mean branch current from the wired LED',async t=>{
  const bytes=asset('pico/pwm.uf2'),firmware={name:'pwm.uf2',uf2:bytes.toString('base64'),active:true};
  const circuit=createCircuit('pwm','pico'),solver=new CircuitSimulator();
  const runtime=await createRp2040FirmwareRuntime(parseRp2040Uf2(bytes));
  t.after(()=>runtime.dispose());
  const args={firmware,pin:'GP15',ledId:'led1'};
  let state=runtime.getState();
  assert.equal(nativeObservationSample({...args,state,result:solver.solve(circuit,state)}),null);
  state=await runtime.advanceTime(5);
  const result=solver.solve(circuit,state);
  const sample=nativeObservationSample({...args,state,result});
  assert.equal(sample.firmwarePayload,firmware.uf2);
  assert.deepEqual(sample.pwm,{frequencyHz:1000,duty:.25});
  assert.deepEqual(sample.led,{currentMa:result.parts.led1.pwmAverage.currentMa,mode:'average'});
  assert.ok(sample.led.currentMa>0);
});
