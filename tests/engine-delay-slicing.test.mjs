import assert from 'node:assert/strict';
import test from 'node:test';
import {compileForBoard,compileProject,createBoardRuntime,createRuntime} from '../dist/engine.js';

const spl=(source,hooks)=>createRuntime(compileProject({'main.c':source}),hooks);
const delayEvents=state=>state.events.filter(event=>event.type==='delay').map(({fromMs,toMs,durationMs})=>[fromMs,toMs,durationMs]);

test('SPL slices a blocking function inside an expression and publishes its delay exactly once',()=>{
  const source=`int stored = 1;
int waited(void){
  Delay_ms(40);
  return 7;
}
int main(void){
  stored = waited();
  Delay_ms(10);
  return 0;
}`;
  const hookOrder=[];
  const runtime=spl(source,{
    onBeforeDelay(event,readState){hookOrder.push(['start',event.fromMs,event.durationMs,readState().variables.stored]);},
    onEvent(event){if(event.type==='delay')hookOrder.push(['end',event.timeMs]);}
  });
  const first=runtime.runSlice(13);
  assert.equal(first.timeMs,13);
  assert.equal(first.pc.line,3);
  assert.equal(first.status,'waiting');
  assert.equal(first.variables.stored,1);
  assert.deepEqual(first.pendingDelay,{fromMs:0,durationMs:40,toMs:40,remainingMs:27});
  assert.deepEqual(delayEvents(first),[]);
  assert.equal(first.budgetReached,false);
  assert.deepEqual(hookOrder,[['start',0,40,1]]);

  const second=runtime.runSlice(13,1);
  assert.equal(second.timeMs,26);
  assert.equal(second.executedSteps,first.executedSteps);
  assert.equal(second.pendingDelay.remainingMs,14);
  assert.equal(second.budgetReached,false);
  assert.equal(second.error,null);
  assert.deepEqual(delayEvents(second),[]);

  const third=runtime.runSlice(50);
  assert.equal(third.timeMs,40);
  assert.equal(third.variables.stored,1);
  assert.equal(third.pendingDelay,undefined);
  assert.deepEqual(delayEvents(third),[[0,40,40]]);
  const legacy=spl(source).runUntilDelay();
  assert.equal(third.executedSteps,legacy.executedSteps);
  assert.deepEqual(third.lastEvent,legacy.lastEvent);
  assert.deepEqual(third.variables,legacy.variables);

  const next=runtime.runSlice(50);
  assert.equal(next.variables.stored,7);
  assert.deepEqual(delayEvents(next),[[0,40,40],[40,50,10]]);
  assert.deepEqual(hookOrder,[['start',0,40,1],['end',40],['start',40,10,7],['end',50]]);
});

test('Arduino microsecond waits preserve the GPIO phase and milliseconds in user code',()=>{
  const compiled=compileForBoard({'sketch.ino':`unsigned long seen = 0;
void setup(){pinMode(13, OUTPUT);}
void loop(){
  digitalWrite(13, HIGH);
  delayMicroseconds(250);
  seen = micros();
  digitalWrite(13, LOW);
  delay(2);
}`},'uno-r3');
  const runtime=createBoardRuntime(compiled);
  let state=runtime.runSlice(.125);
  assert.equal(state.timeMs,.125);
  assert.equal(state.pendingDelay.remainingMs,.125);
  assert.equal(state.pins.D13.level,1);
  assert.equal(state.variables.seen,0);
  state=runtime.runSlice(.125);
  assert.equal(state.timeMs,.25);
  assert.equal(state.pins.D13.level,1);
  assert.equal(state.variables.seen,0);
  assert.deepEqual(delayEvents(state),[[0,.25,.25]]);
  state=runtime.runSlice(1);
  assert.equal(state.timeMs,1.25);
  assert.equal(state.pins.D13.level,0);
  assert.equal(state.variables.seen,250);
  assert.equal(state.pendingDelay.remainingMs,1);
});

test('zero waits remain completion points and a 24-hour wait yields to short slices',()=>{
  let starts=0;
  const runtime=spl('int main(void){delay_us(0);Delay_s(86400);return 0;}',{onBeforeDelay(){starts++;}});
  const zero=runtime.runSlice(0);
  assert.equal(zero.timeMs,0);
  assert.equal(zero.pendingDelay,undefined);
  assert.deepEqual(delayEvents(zero),[[0,0,0]]);
  assert.equal(starts,0);

  const initial=runtime.runSlice(0);
  assert.equal(initial.timeMs,0);
  assert.equal(initial.pendingDelay.toMs,86400000);
  const partial=runtime.runSlice(16);
  assert.equal(partial.timeMs,16);
  assert.equal(partial.pendingDelay.remainingMs,86399984);
  assert.equal(starts,1);
  assert.throws(()=>runtime.runSlice(-1),RangeError);
  assert.throws(()=>runtime.runSlice(Infinity),RangeError);
  assert.equal(runtime.getState().timeMs,16);

  const reset=runtime.reset();
  assert.equal(reset.timeMs,0);
  assert.equal(reset.pendingDelay,undefined);
  assert.deepEqual(delayEvents(reset),[]);
  assert.deepEqual(delayEvents(runtime.runSlice(16)),[[0,0,0]]);
  assert.equal(runtime.runSlice(16).pendingDelay.remainingMs,86399984);
  assert.equal(starts,2);
});

test('mixed callers finish a pending wait before resuming source or moving farther in time',()=>{
  const runtime=spl('int n=0;int main(void){Delay_ms(10);n=1;Delay_ms(10);n=2;Delay_ms(10);n=3;return 0;}');
  assert.equal(runtime.runSlice(2).pendingDelay.remainingMs,8);
  assert.equal(runtime.step(1).timeMs,10);
  assert.equal(runtime.getState().variables.n,0);
  assert.equal(runtime.runSlice(2).pendingDelay.remainingMs,8);
  const afterIdle=runtime.advanceTime(10);
  assert.equal(afterIdle.timeMs,22);
  assert.equal(afterIdle.lastEvent.timeMs,20);
  assert.equal(afterIdle.variables.n,1);
  assert.equal(afterIdle.pendingDelay,undefined);

  assert.equal(runtime.runSlice(2).pendingDelay.remainingMs,8);
  const flushed=runtime.runUntilDelay();
  assert.equal(flushed.timeMs,32);
  assert.equal(flushed.variables.n,2);
  assert.deepEqual(delayEvents(flushed),[[0,10,10],[10,20,10],[22,32,10]]);
  assert.equal(runtime.step(1).variables.n,2);
  assert.equal(runtime.step(1).variables.n,3);
});

test('opt-in debugger steps stop at the start and end of a wait without budget diagnostics',()=>{
  const source='int n=0;int main(void){n=1;Delay_ms(10);n=2;return 0;}';
  const runtime=spl(source);
  let state=runtime.step(1,{deferDelay:true});
  assert.equal(state.variables.n,1);
  assert.equal(state.timeMs,0);
  assert.deepEqual(state.diagnostics,[]);
  assert.equal(state.pendingDelay,undefined);

  state=runtime.step(1,{deferDelay:true});
  assert.equal(state.timeMs,0);
  assert.equal(state.pendingDelay.remainingMs,10);
  assert.deepEqual(delayEvents(state),[]);
  assert.deepEqual(state.diagnostics,[]);
  assert.equal(spl(source).step(2).timeMs,10);

  assert.equal(runtime.advanceTime(2).pendingDelay.remainingMs,8);
  state=runtime.step(10,{deferDelay:true});
  assert.equal(state.timeMs,10);
  assert.equal(state.variables.n,1);
  assert.deepEqual(delayEvents(state),[[0,10,10]]);
  assert.deepEqual(state.diagnostics,[]);
  assert.equal(runtime.step(2).variables.n,2);
});

test('a sliced wait reports observer failures only where the corresponding hook runs',()=>{
  const source='int main(void){Delay_ms(10);return 0;}';
  const start=spl(source,{onBeforeDelay(){throw new Error('start');}}).runSlice(2);
  assert.equal(start.error?.code,'HOOK_ERROR');
  assert.equal(start.timeMs,0);
  assert.equal(start.pendingDelay,undefined);

  let endings=0;
  const runtime=spl(source,{onEvent(event){if(event.type==='delay'){endings++;throw new Error('end');}}});
  const partial=runtime.runSlice(2);
  assert.equal(partial.error,null);
  assert.equal(endings,0);
  const failure=runtime.advanceTime(20);
  assert.equal(failure.error?.code,'HOOK_ERROR');
  assert.equal(failure.timeMs,10);
  assert.equal(failure.pendingDelay,undefined);
  assert.equal(endings,1);
  assert.deepEqual(delayEvents(failure),[[0,10,10]]);
  assert.equal(runtime.runSlice(2).error?.code,'HOOK_ERROR');
  assert.equal(endings,1);
});
