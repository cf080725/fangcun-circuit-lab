import test from 'node:test';import assert from 'node:assert/strict';
import {matchHardware,normalizeBOM} from '../dist/catalog-index.js';
test('model-specific search prioritizes actual model identity over another board comparison text',()=>{const a={id:'uno-r3',name:'Arduino UNO R3',chip:'ATmega328P'},b={id:'uno-q',name:'Arduino UNO Q',description:'Compare with UNO R3'};assert.deepEqual(matchHardware([a,b],'UNO R3'),[a]);});
test('source URLs do not create search matches; unicode interface aliases work',()=>{const a={id:'sensor',name:'传感器',tags:['I²C'],source:'https://example.com/UNO-R3'};assert.equal(matchHardware([a],'UNO').length,0);assert.equal(matchHardware([a],'i2c').length,1);});
test('imported BOM uses trusted catalog names and sources, merges entries and clamps quantities',()=>{const boards=[{id:'uno',name:'UNO',source:'https://arduino.cc'}];assert.deepEqual(normalizeBOM([{id:'uno',kind:'board',name:'fake',quantity:2},{id:'uno',kind:'board',quantity:999},{id:'missing',kind:'board'},{id:'uno',kind:'bad'}],boards,[]),[{id:'uno',name:'UNO',kind:'board',quantity:99,source:'https://arduino.cc'}]);assert.deepEqual(normalizeBOM({},boards,[]),[]);});

test('BOM rejects inherited object keys and nonprimitive quantities without throwing',()=>{
 const boards=[{id:'b',name:'Board',source:'https://example.test/board'}];
 const rows=[{kind:'toString',id:'x'},{kind:'__proto__',id:'x'},{kind:{toString:2},id:'x'},{kind:'board',id:'b',quantity:{toString:2}}];
 const clean=normalizeBOM(rows,boards,[]);assert.equal(clean.length,1);assert.equal(clean[0].quantity,1);
});
