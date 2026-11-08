import assert from 'node:assert/strict';
import test from 'node:test';
import {closestWireSegment,compareWireHits,distinctPickTargets} from '../dist/wire-picking.js';

test('wire hit distance uses projected segments rather than sample points or invisible gaps',()=>{
  const points=[{x:10,y:10},{x:50,y:10},null,{x:70,y:30},{x:90,y:30}];
  assert.deepEqual(closestWireSegment(points,30,16,8),{index:0,t:.5,x:30,y:10,distance2:36});
  assert.equal(closestWireSegment(points,60,20,8),null);
  assert.equal(closestWireSegment(points,30,20,8),null);
});

test('crossing wires are ranked by distance and depth and overlap choices retain distinct targets',()=>{
  const crossing=[{id:'w8',distance2:3,depth:7},{id:'w2',distance2:1,depth:8},{id:'w3',distance2:1,depth:6},{id:'w1',distance2:1,depth:8}];
  assert.deepEqual(crossing.sort(compareWireHits).map(({id})=>id),['w3','w1','w2','w8']);
  const wire={kind:'wire',id:'w1'},part={kind:'component',id:'w1'};
  assert.deepEqual(distinctPickTargets([wire,{...wire},part,{kind:'wire'}]),[wire,part]);
});
