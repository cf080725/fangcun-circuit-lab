import assert from 'node:assert/strict';
import test from 'node:test';
import {getBoardProfile} from '../dist/board-profiles.js';
import {boardPose, mountedPinRoutes} from '../dist/breadboard-mount.js';
import {createBreadboardWiring} from '../dist/breadboard-wiring.js';
import {CircuitSimulator} from '../dist/circuit.js';
import {breadboardDimensions} from '../dist/geometry-3d.js';
import {bluePillI2cTemperatureDisplayLesson, stm32TemperatureDisplayLessonId, temperatureDisplaySdaWires} from '../dist/i2c-temperature-display-lesson.js';
import {componentCollisionBounds} from '../dist/model-renderer.js';
import {evaluateMountPlacement} from '../dist/mount-placement.js';
import {validateCircuit} from '../dist/project-import.js';

test('both modules branch from distinct exposed sockets on the seated Blue Pill',()=>{
  const lesson=bluePillI2cTemperatureDisplayLesson();
  const circuit=lesson.circuitData,profile=getBoardProfile(lesson.boardId);
  assert.equal(lesson.id,stm32TemperatureDisplayLessonId);
  assert.equal(lesson.nativeOnly,true);
  assert.equal(lesson.watchPin,'PB7');
  assert.deepEqual(validateCircuit(JSON.parse(JSON.stringify(circuit))),circuit);
  assert.equal(boardPose(circuit,profile).mounted,true);

  const routes=new Map(mountedPinRoutes(circuit,profile).map(route=>[route.endpoint,route.exposed]));
  const wiring=createBreadboardWiring(circuit,profile),used=new Set();
  const channels={VIN:'3V3',GND:'GND1',SDA:'PB7',SCL:'PB6'};
  assert.equal(circuit.wires.length,8);
  for(const wire of circuit.wires){
    const [,pin]=wire.b.split(':');
    assert.ok(routes.get('mcu:'+channels[pin]).includes(wire.a));
    assert.ok(!used.has(wire.a),'each jumper occupies its own socket');
    assert.equal(wiring.check(wire.a).kind,'wire');
    assert.equal(wiring.check(wire.a,{ignoreWireId:wire.id}).kind,'free');
    used.add(wire.a);
  }
  assert.deepEqual(circuit.wires.filter(wire=>wire.b.endsWith(':SDA')).map(wire=>[wire.id,wire.a,wire.b]),[
    [temperatureDisplaySdaWires.temp1,'bb:i20','temp1:SDA'],
    [temperatureDisplaySdaWires.oled1,'bb:j20','oled1:SDA'],
  ]);

  const [sensor,oled]=circuit.components.map(part=>componentCollisionBounds(part));
  const edge=circuit.breadboard.z+breadboardDimensions.depth/2;
  assert.ok(sensor.top>edge&&oled.top>edge&&sensor.right<oled.left);
  const detached={...circuit,board:{...circuit.board,mount:undefined}};
  const {candidate}=evaluateMountPlacement(detached,profile,circuit.board.mount);
  assert.ok(candidate);
  assert.deepEqual(candidate.blockers,[]);
  assert.deepEqual(candidate.wireMoves,[]);
  assert.equal(candidate.connectedNets,4);
});

test('unplugging either SDA branch leaves the other I²C device connected and powered',()=>{
  const {circuitData:circuit}=bluePillI2cTemperatureDisplayLesson(),wires=circuit.wires;
  const sim=new CircuitSimulator(),state={boardId:circuit.boardId,timeMs:0,pins:{}};
  sim.solve(circuit,state);
  state.timeMs=250;
  const write=(address,bytes)=>sim.writeI2c(circuit,state,address,bytes);
  const readSensor=()=>{
    assert.equal(write(0x18,[5]).status,0);
    assert.deepEqual(sim.readI2c(circuit,state,0x18,2),{status:0,deviceId:'temp1',bytes:[0xc2,0x28]});
  };
  const ack=(address,direction)=>sim.i2cAddress(circuit,state,address,direction);
  readSensor();
  assert.deepEqual(ack(0x3d,'write'),{status:0,deviceId:'oled1'});
  assert.equal(write(0x3d,[0,0x8d,0x14,0xaf]).status,0);
  assert.ok(!sim.solve(circuit,state).parts.oled1.framebuffer.some(Boolean));

  circuit.wires=wires.filter(wire=>wire.id!==temperatureDisplaySdaWires.temp1);
  assert.deepEqual(ack(0x18,'read'),{status:2,reason:'disconnected'});
  assert.equal(write(0x3d,[0x40,0x7f]).status,0);
  const frame=sim.solve(circuit,state).parts.oled1.framebuffer;
  assert.ok(frame.some(Boolean));

  circuit.wires=wires.filter(wire=>wire.id!==temperatureDisplaySdaWires.oled1);
  assert.deepEqual(ack(0x3d,'write'),{status:2,reason:'disconnected'});
  assert.equal(write(0x3d,[0x40,0xff]).status,2);
  readSensor();
  const reading=sim.solve(circuit,state).parts;
  assert.equal(reading.temp1.temperatureC,34.5);
  assert.ok(reading.temp1.powered&&reading.oled1.powered&&reading.oled1.displayOn);
  assert.strictEqual(reading.oled1.framebuffer,frame);

  circuit.wires=wires;
  assert.equal(ack(0x3d,'write').status,0);
  readSensor();
});
