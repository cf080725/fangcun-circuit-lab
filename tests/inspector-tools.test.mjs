import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterSpecs,parseParameter,partConnections,collectDiagnostics} from '../dist/inspector-tools.js';
test('zero volts and darkness remain zero; invalid and empty edits are rejected',()=>{
 for(const part of [{type:'power'},{type:'ldr'}]){const s=parameterSpecs(part)[0];assert.deepEqual(parseParameter(s,'0'),{ok:true,value:0});assert.equal(parseParameter(s,'').ok,false);assert.equal(parseParameter(s,'-1').ok,false);assert.equal(parseParameter(s,'Infinity').ok,false);}
 assert.equal(parseParameter(parameterSpecs({type:'resistor'})[0],'-330').ok,false);
});
test('pot percent maps to fractional circuit value and advanced component parameters survive',()=>{
 assert.deepEqual(parseParameter(parameterSpecs({type:'pot'})[0],'75'),{ok:true,value:.75});
 const s=parameterSpecs({type:'thermistor'},{parameters:[{key:'temperature',min:-40,max:125},{key:'beta',min:1000,max:6000}]});assert.ok(s.some(x=>x.key==='beta'));assert.equal(parseParameter(s.find(x=>x.key==='temperature'),'-20').value,-20);
});
test('connection list handles either wire direction without inventing missing connections',()=>{
 assert.deepEqual(partConnections({wires:[{a:'mcu:PA0',b:'r1:1'},{a:'r1:2',b:'led1:A'}]},'r1',['1','2','3']),[{pin:'1',endpoint:'r1:1',links:['mcu:PA0']},{pin:'2',endpoint:'r1:2',links:['led1:A']},{pin:'3',endpoint:'r1:3',links:[]}]);
});
test('the component inspector lists real inserted contacts without duplicating the jumper list',()=>{
 const circuit={components:[{type:'led',id:'led1',mount:{hole:'bb:a10',rotation:0}}],wires:[{a:'led1:A',b:'mcu:PA0'}]};
 assert.deepEqual(partConnections(circuit,'led1',['A','K']).map(item=>item.links),[['mcu:PA0','bb:a10'],['bb:a11']]);
 assert.equal(circuit.wires.length,1);
});
test('live warnings are visible and repeated runtime/code faults are consolidated',()=>{
 const d={code:'X',severity:'error',file:'main.c',line:8,plain:'bad call'};const result=collectDiagnostics({runtime:[d],errors:[d],live:[{severity:'warning',code:'W',plain:'check pin'},{severity:'info',plain:'scope'}],circuit:[{code:'OPEN',severity:'info',plain:'open'}]});assert.equal(result.length,3);assert.equal(result[0].code,'X');assert.equal(result[1].origin,'代码');assert.equal(result[2].code,'OPEN');
});
