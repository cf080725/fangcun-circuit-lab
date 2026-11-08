import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {makeBoardStarter} from '../dist/board-profiles.js';
import {CircuitSimulator} from '../dist/circuit.js';

test('knob previews update the circuit live and commit or restore exactly once', () => {
  const {circuit}=makeBoardStarter('nano','adc');
  const part=circuit.components.find(item=>item.type==='pot');
  part.locked=true; // A placement lock does not prevent electrical adjustment.
  const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
  const functions=['snapshotCircuit','adjustPotentiometer'].map(name=>{
    const expression=new RegExp(`^function ${name}\\([\\s\\S]*?^}`,'m');
    return source.match(expression)[0];
  });
  const sim=new CircuitSimulator(),measurements=[],undos=[];
  let saves=0;
  const app=runInNewContext(`${functions.join('\n')}
    function pushUndo(){undos.push(snapshotCircuit());}
    ({snapshotCircuit,adjustPotentiometer});`,{
    circuit,potAdjustment:null,selected:null,clone:structuredClone,undos,
    avrCircuitIO:{invalidateAnalog(){}},save:()=>saves++,
    refresh:()=>measurements.push(sim.solve(circuit).netVoltages[part.id+':OUT'])
  });
  const adjust=(phase,value)=>app.adjustPotentiometer(part.id,phase,value);
  assert.equal(adjust('start'),true);
  adjust('move',.8);
  assert.ok(measurements.at(-1)>3.99);
  assert.equal(app.snapshotCircuit().components.find(item=>item.id===part.id).position,.5);
  adjust('cancel');
  assert.equal(part.position,.5);
  assert.ok(Math.abs(measurements.at(-1)-2.5)<.01);
  assert.equal(undos.length,0);
  assert.equal(saves,0);

  adjust('start');
  adjust('move',.6);
  adjust('move',.7);
  adjust('commit');
  assert.equal(part.position,.7);
  assert.equal(undos[0].components.find(item=>item.id===part.id).position,.5);
  assert.equal(adjust('commit'),false);
  assert.equal(undos.length,1);
  assert.equal(saves,1);
  assert.equal(app.snapshotCircuit().components.find(item=>item.id===part.id).position,.7);
});
