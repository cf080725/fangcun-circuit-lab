import test from 'node:test';
import assert from 'node:assert/strict';
import {createBreadboardWiring} from '../dist/breadboard-wiring.js';
import {createCircuit,makePart} from '../dist/circuit.js';
import {validateCircuit} from '../dist/project-import.js';

function wire(id, a, b) {
  return {id,a,b,color:'#df7651'};
}

test('a wired socket reports only spare holes from the same five-hole strip', () => {
  const circuit=createCircuit('onboard');
  circuit.wires=[wire('w1','mcu:PA0','bb:b21'),wire('w2','bb:c21','mcu:PA1')];
  const {check}=createBreadboardWiring(circuit);
  const result=check('bb:b21');
  assert.equal(result.ok,false);
  assert.equal(result.kind,'wire');
  assert.deepEqual(result.alternatives,['bb:a21','bb:d21','bb:e21']);
  assert.match(result.message,/B21 孔已有跳线.*A21、D21、E21/);
  assert.equal(check('bb:a21').kind,'free');
  assert.equal(check('bb:f21').kind,'free');
  assert.equal(check('mcu:PA0').kind,'non-socket');
  assert.equal(check('led1:A').ok,true);
});

test('power rail alternatives follow polarity and the upper/lower groups', () => {
  const circuit=createCircuit('onboard');
  circuit.wires=[wire('w1','mcu:3V3','bb:p5'),wire('w2','bb:p4','mcu:PA1'),wire('w3','bb:n26','mcu:GND1')];
  const {check}=createBreadboardWiring(circuit);
  const upper=check('bb:p5').alternatives;
  assert.equal(upper.length,23);
  assert.deepEqual(upper.slice(0,2),['bb:p3','bb:p6']);
  assert.ok(upper.includes('bb:p25'));
  assert.ok(!upper.includes('bb:p26'));
  assert.ok(!upper.some(endpoint=>endpoint.startsWith('bb:n')));
  const lower=check('bb:n26').alternatives;
  assert.equal(lower[0],'bb:n27');
  assert.equal(lower.at(-1),'bb:n50');
  assert.ok(!lower.includes('bb:n25'));
  assert.equal(check('bb:p51').kind,'invalid');
  assert.equal(check('bb:a01').ok,false);
});

test('occupied part contacts are excluded from alternatives', () => {
  const circuit=createCircuit('onboard');
  circuit.components=[{...makePart('led','led1'),mount:{hole:'bb:a10',rotation:0}}];
  circuit.wires=[wire('w1','mcu:PA0','bb:b10')];
  const {check}=createBreadboardWiring(circuit);
  const part=check('bb:a10');
  assert.equal(part.kind,'part');
  assert.deepEqual(part.alternatives,['bb:c10','bb:d10','bb:e10']);
  assert.ok(!check('bb:b10').alternatives.includes('bb:a10'));
  assert.match(part.message,/A10 孔已插入元件/);
});

test('a mounted capacitor distinguishes occupied leads, obscured sockets, and clear diagonal sockets', () => {
  const circuit=createCircuit('onboard');
  circuit.components=[{...makePart('capacitor','c1'),mount:{hole:'bb:a10',rotation:0}}];
  circuit.wires=[wire('legacy','mcu:PA0','bb:b10')];
  const restored=validateCircuit(JSON.parse(JSON.stringify(circuit)));
  assert.deepEqual(restored,circuit);
  const {check}=createBreadboardWiring(restored);
  assert.equal(check('bb:a10').kind,'part');
  assert.equal(check('bb:a11').kind,'part');
  for (const endpoint of ['bb:b10','bb:b11']) {
    const obscured=check(endpoint);
    assert.equal(obscured.kind,'obscured');
    assert.match(obscured.message,/电解电容外壳遮住/);
    assert.deepEqual(obscured.alternatives,['c','d','e'].map(row=>'bb:'+row+endpoint.slice(4)));
  }
  assert.equal(check('bb:a9').kind,'obscured');
  assert.equal(check('bb:b9').kind,'free');
  assert.equal(check('bb:c10').kind,'free');
  assert.deepEqual(restored,circuit);

  const lower=createBreadboardWiring({...restored,wires:[],components:[{...restored.components[0],mount:{hole:'bb:h14',rotation:0}}]});
  assert.equal(lower.check('bb:i14').kind,'obscured');
  assert.equal(lower.check('bb:j14').kind,'free');
  assert.equal(lower.check('bb:j15').kind,'free');
});

test('DevKitC covered rows offer an exposed socket or the corresponding header', () => {
  const circuit=createCircuit('onboard');
  circuit.boardId='esp32-devkitc';
  circuit.board.mount={column:6,rotation:90};
  const {check}=createBreadboardWiring(circuit);
  const covered=check('bb:e18');
  assert.equal(covered.kind,'board');
  assert.deepEqual(covered.alternatives,[]);
  assert.equal(covered.headerEndpoint,'mcu:GPIO32');
  assert.match(covered.message,/E18 孔被开发板占用或盖住.*GPIO32 排针/);
  const mountedHeader=check('bb:i23');
  assert.equal(mountedHeader.kind,'board');
  assert.deepEqual(mountedHeader.alternatives,['bb:j23']);
  assert.equal(mountedHeader.headerEndpoint,'mcu:GPIO23');
  assert.equal(check('bb:j23').ok,true);
  assert.equal(check('mcu:GPIO32').ok,true);
});

test('SC56 package clearance offers only exposed holes on the same strip',()=>{
  const circuit=createCircuit('onboard');
  circuit.components=[{...makePart('sevenseg','display1'),mount:{hole:'bb:g9',rotation:0}}];
  const {check}=createBreadboardWiring(circuit);
  assert.equal(check('bb:c11').kind,'part');
  assert.equal(check('bb:g11').kind,'part');
  const under=check('bb:d11');
  assert.equal(under.kind,'display');
  assert.match(under.message,/数码管外壳遮住/);
  assert.deepEqual(under.alternatives,['bb:b11','bb:a11']);
  assert.equal(check('bb:j11').kind,'free');
});

test('reconnect exempts its own wire only and preserves imported legacy overlaps', () => {
  const draft=createCircuit('onboard');
  draft.wires=[wire('w1','bb:a1','bb:b1'),wire('w2','mcu:PA1','bb:a1')];
  const circuit=validateCircuit(draft);
  assert.equal(circuit.wires.length,2);
  const {check}=createBreadboardWiring(circuit);
  assert.equal(check('bb:a1',{ignoreWireId:'w1'}).kind,'wire');
  assert.equal(check('bb:b1',{ignoreWireId:'w1'}).kind,'free');
  assert.equal(check('bb:b1',{ignoreWireId:'w2'}).kind,'wire');
  assert.deepEqual(check('bb:a1',{ignoreWireId:'w1'}).alternatives,['bb:c1','bb:d1','bb:e1']);
});

test('a filled strip without a development board pin says there are no spare holes', () => {
  const circuit=createCircuit('onboard');
  circuit.wires=Array.from('abcde', (row,index)=>wire(`w${index}`,'mcu:PA0',`bb:${row}1`));
  const occupied=createBreadboardWiring(circuit).check('bb:a1');
  assert.deepEqual(occupied.alternatives,[]);
  assert.equal(occupied.headerEndpoint,null);
  assert.match(occupied.message,/同组没有空孔/);
});
