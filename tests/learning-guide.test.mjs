import test from 'node:test';
import assert from 'node:assert/strict';
import {guidanceFor,codeLocation} from '../dist/learning-guide.js';
import {BOARD_PROFILE_LIST,getBoardProfile,makeBoardStarter} from '../dist/board-profiles.js';
import {examples} from '../dist/content.js';
test('every STM32 lesson has contextual guidance and preserved reference outcomes',()=>{for(const ex of examples){const g=guidanceFor(ex,getBoardProfile('bluepill'),ex.files);assert.equal(g.expected,ex.expected);assert.ok(g.location,ex.id);assert.ok(g.concepts.length<=2);assert.equal(g.setup[0],ex.setup[0]);}assert.match(guidanceFor(examples.find(e=>e.id==='button'),getBoardProfile('bluepill')).observe,/PB1/);});
test('ADC guide follows each board default resolution and never assumes 4095 for Uno',()=>{for(const p of BOARD_PROFILE_LIST.filter(p=>p.id!=='bluepill'&&p.capabilities.analogInput)){const starter=makeBoardStarter(p.id,'adc'),g=guidanceFor({id:p.id+':adc'},p,starter.files);assert.ok(g.observe.includes(String(2**p.adcDefaultBits-1)));assert.ok(g.location);}assert.match(guidanceFor({id:'uno-r3:adc'},getBoardProfile('uno-r3')).observe,/1023/);});
test('imported code receives no fabricated built-in result or fixed delay task',()=>{const g=guidanceFor({id:'imported:bluepill:x'},getBoardProfile('bluepill'),{'main.c':'int main(void) {}'});assert.ok(g.imported);assert.match(g.expected,/没有内置标准答案/);assert.doesNotMatch(g.change,/500|1000/);assert.equal(g.location.line,1);});
test('code locator skips commented-out instruction and retains actual filename and line',()=>{assert.deepEqual(codeLocation({'LED.c':'// Delay_ms(500);\nint x=0;\nDelay_ms(200);'},/\bDelay_ms\s*\(/),{file:'LED.c',line:3});assert.equal(codeLocation({'x.h':'#pragma once'},/Delay_ms/),null);});
