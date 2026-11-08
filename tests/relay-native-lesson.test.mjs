import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {mountedConnections,signalStrip} from '../dist/breadboard-mount.js';
import {getBoardProfile} from '../dist/board-profiles.js';
import {compileStm32C} from '../dist/bluepill-c-compiler.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';
import {makeRelayNativeLesson,relayNativePart,relayNativeLamp} from '../dist/relay-native-lesson.js';
import {parseStm32Bin} from '../dist/stm32-firmware-image.js';
import {createStm32FirmwareRuntime} from '../dist/stm32-firmware-runtime.js';

test('relay lesson preserves a seated Blue Pill, Grove controls and an independent lamp supply',()=>{
  const lesson=makeRelayNativeLesson(),circuit=validateCircuit(lesson.circuitData);
  assert.deepEqual(circuit.board.mount,{column:6,rotation:90});
  assert.equal(circuit.wires.length,7);
  const profile=getBoardProfile(lesson.boardId);
  const contacts=new Map(mountedConnections(circuit,profile).map(({a,b})=>[a,b]));
  for(const [pin,hole] of [['PA0','bb:a21'],['5V','bb:j23'],['GND1','bb:j24']]){
    assert.deepEqual(signalStrip(contacts.get(`mcu:${pin}`)),signalStrip(hole));
  }
  assert.equal(circuit.components.find(part=>part.id===relayNativePart).type,'grove-relay');
  assert.equal(circuit.components.find(part=>part.id==='loadpower').voltage,3.3);
  const result=new CircuitSimulator().solve(circuit,{pins:{},timeMs:0});
  assert.equal(result.measureBetween('loadpower:-','mcu:GND').status,'floating');
});

test('compiled TIM2 2 ms pulse leaves the dry contact open and 220 ms drives the isolated lamp',async()=>{
  const {boardId,circuitData:circuit,nativeSourceAssets}=makeRelayNativeLesson();
  const original=structuredClone(circuit),dist=new URL('../dist/',import.meta.url);
  const files=Object.fromEntries(Object.entries(nativeSourceAssets).map(([name,path])=>[
    name,readFileSync(new URL(path,dist),'utf8')
  ]));
  const run=async(width,verify)=>{
    const header=files['relay_policy.h'].replace('#define PULSE_MS 2u',`#define PULSE_MS ${width}u`);
    const {binary}=await compileStm32C({...files,'relay_policy.h':header},{boardId});
    const runtime=await createStm32FirmwareRuntime(parseStm32Bin(binary,boardId),{boardId});
    const solver=new CircuitSimulator();
    try{
      const observe=async timeMs=>{
        let state=runtime.getState();
        while(state.timeMs+.0002<timeMs)state=await runtime.advanceTime(Math.min(20,timeMs-state.timeMs));
        assert.equal(state.error,null);
        const pwm=state.pins.PA0.pwm;
        assert.equal(pwm.frequencyHz,2);
        assert.equal(pwm.duty,width/500);
        const result=solver.solve(circuit,state);
        assert.equal(result.converged,true);
        assert.equal(result.measureBetween('loadpower:-','mcu:GND').status,'floating');
        return {relay:result.parts[relayNativePart],lamp:result.parts[relayNativeLamp]};
      };
      await verify(observe);
    }finally{runtime.dispose();}
  };
  await run(2,async observe=>{
    const pulse=await observe(1);
    assert.ok(pulse.relay.indicator);
    assert.equal(pulse.relay.closed,false);
    assert.equal(pulse.lamp.currentMa,0);
    const late=await observe(50);
    assert.equal(late.relay.closed,false);
    assert.equal(late.lamp.currentMa,0);
  });
  await run(220,async observe=>{
    const before=await observe(5);
    assert.equal(before.relay.closed,false);
    const closed=await observe(25);
    assert.equal(closed.relay.closed,true);
    assert.ok(closed.lamp.currentMa>3.7&&closed.lamp.currentMa<3.9);
    const released=await observe(245);
    assert.equal(released.relay.closed,false);
    assert.equal(released.lamp.currentMa,0);
    const next=await observe(525);
    assert.equal(next.relay.closed,true);
  });
  assert.deepEqual(circuit,original);
});
