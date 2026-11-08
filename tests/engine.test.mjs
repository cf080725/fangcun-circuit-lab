import test from "node:test";
import assert from "node:assert/strict";
import { compileForBoard, compileProject, createBoardRuntime, createRuntime, CompileError } from "../dist/engine.js";
import { examples } from "../dist/content.js";

const example = id => examples.find(e => e.id === id);
const runtime = (id, hooks = {}, transform = x => x) => createRuntime(compileProject(transform(example(id).files)), hooks);
const finish = r => {
  let s;
  for (let i = 0; i < 20; i++) { s = r.step(2000); if (s.done) return s; }
  assert.fail("Expected a finite program to finish");
};
const sourceRuntime = (text, hooks = {}) => createRuntime(compileProject({"main.c": text}), hooks);

test("blink is executed from source: GPIO state, line provenance, virtual delay and reset", () => {
  const r = runtime("blink");
  assert.equal(r.getState().pins.PA0.configured, false);
  let s = r.runUntilDelay();
  assert.equal(s.error, null);
  assert.equal(s.timeMs, 500);
  assert.equal(s.pins.PA0.level, 1);
  assert.equal(s.pins.PA0.configured, true);
  assert.equal(s.pins.PA0.mode, "GPIO_Mode_Out_PP");
  assert.equal(s.lastEvent.type, "delay");
  assert.equal(s.lastEvent.file, "main.c");
  s = r.runUntilDelay();
  assert.equal(s.timeMs, 1000);
  assert.equal(s.pins.PA0.level, 0);
  assert.ok(s.events.some(e => e.type === "gpio" && e.pin === "PA0" && e.value === 0));
  assert.equal(r.reset().timeMs, 0);
  assert.equal(r.getState().pins.PA0.configured, false);
});

test("SPL positive delays expose the GPIO transition at the start and still yield at the end", () => {
  const timeline = [];
  const observed = runtime("blink", {
    onBeforeDelay({ fromMs, durationMs }, readState) {
      const before = readState();
      assert.equal(before.timeMs, fromMs);
      timeline.push(["before", fromMs, durationMs, before.pins.PA0.level]);
    },
    onEvent(event) {
      if (event.type === "delay") timeline.push(["event", event.timeMs, event.fromMs, event.toMs]);
    }
  });
  const plain = runtime("blink");
  assert.deepEqual(observed.runUntilDelay(), plain.runUntilDelay());
  assert.deepEqual(observed.runUntilDelay(), plain.runUntilDelay());
  assert.deepEqual(timeline, [["before", 0, 500, 1], ["event", 500, 0, 500],
    ["before", 500, 500, 0], ["event", 1000, 500, 1000]]);
});

test("Arduino stepping observes microsecond waits in milliseconds and still yields zero waits", () => {
  const source = "void setup(){pinMode(13,OUTPUT);} void loop(){digitalWrite(13,HIGH);delayMicroseconds(250);digitalWrite(13,LOW);delay(0);delay(2);}";
  const compiled = compileForBoard({ "sketch.ino": source }, "uno-r3");
  const before = [], yielded = [];
  const observed = createBoardRuntime(compiled, {
    onBeforeDelay({ fromMs, durationMs }, readState) {
      const snapshot = readState();
      before.push([fromMs, durationMs, snapshot.pins.D13.level]);
      snapshot.pins.D13.output = 99;
    }
  });
  const plain = createBoardRuntime(compiled);
  for (let index = 0; index < 80 && yielded.length < 3; index++) {
    const state = observed.step();
    assert.deepEqual(state, plain.step());
    const event = state.lastEvent;
    if (event?.type === "delay") yielded.push([event.fromMs, event.toMs, event.durationMs]);
  }
  assert.deepEqual(before, [[0, .25, 1], [.25, 2, 0]]);
  assert.deepEqual(yielded, [[0, .25, .25], [.25, .25, 0], [.25, 2.25, 2]]);
});

test("invalid and zero delays skip the observer without changing delay validation", () => {
  for (const badDelay of ["Delay_ms(-1)", "delay_us(86400000001)"]) {
    let calls = 0;
    const observed = sourceRuntime(`int main(void){Delay_ms(0);${badDelay};return 0;}`, {
      onBeforeDelay: () => { calls++; }
    });
    assert.equal(observed.runUntilDelay().lastEvent.durationMs, 0);
    const failed = observed.runUntilDelay();
    assert.equal(failed.error?.code, "INVALID_DELAY");
    assert.equal(failed.timeMs, 0);
    assert.equal(calls, 0);
  }
});

test("reading the pre-delay snapshot does not invoke external input hooks or emit diagnostics", () => {
  const code = "int main(void){int local;int *p=&local;uint32_t *reg=&GPIOA->IDR;Delay_ms(1);return 0;}";
  let observedReads = 0, plainReads = 0, snapshot;
  const observed = sourceRuntime(code, {
    readPin: () => { observedReads++; return 0; },
    onBeforeDelay(event, readState) {
      const previousReads = observedReads;
      snapshot = readState();
      assert.equal(observedReads, previousReads);
      assert.equal(snapshot.diagnostics.length, 0);
    }
  });
  const plain = sourceRuntime(code, { readPin: () => { plainReads++; return 0; } });
  assert.deepEqual(observed.runUntilDelay(), plain.runUntilDelay());
  assert.equal(observedReads, plainReads);
  assert.equal(snapshot.variables.p.value, 0);
  assert.deepEqual(snapshot.variables.reg, { pointerTo:"GPIOA->IDR", value:undefined });
});

test("separate C files, guarded headers, macros and user function calls change real pin state", () => {
  const files = {
    "main.c": '#include "stm32f10x.h"\n#include "LED.h"\n#include "LED.h"\nint main(void){LED_Init(); LED_On(); Delay_ms(25); LED_Off(); return 0;}',
    "LED.h": "#ifndef LED_H\n#define LED_H\nvoid LED_Init(void);\nvoid LED_On(void);\nvoid LED_Off(void);\n#endif",
    "LED.c": '#include "stm32f10x.h"\n#define PIN GPIO_Pin_2\n#define WRITE(v) GPIO_WriteBit(GPIOA, PIN, (v))\nvoid LED_Init(void){RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);GPIO_InitTypeDef g={PIN,GPIO_Speed_2MHz,GPIO_Mode_Out_PP};GPIO_Init(GPIOA,&g);}\nvoid LED_On(void){WRITE(1);}\nvoid LED_Off(void){WRITE(0);}'
  };
  const r = createRuntime(compileProject(files));
  assert.equal(r.runUntilDelay().pins.PA2.level, 1);
  const s = finish(r);
  assert.equal(s.error, null);
  assert.equal(s.pins.PA2.level, 0);
  assert.ok(s.events.some(e => e.type === "gpio" && e.file === "LED.c"));
});

test("external input hook changes branching without recompiling; floating input is disclosed", () => {
  let pressed = false;
  const r = runtime("button", { readPin: pin => pin === "PB1" ? +!pressed : undefined });
  assert.equal(r.runUntilDelay().pins.PA0.level, 0);
  pressed = true;
  assert.equal(r.runUntilDelay().pins.PA0.level, 1);
  pressed = false;
  assert.equal(r.runUntilDelay().pins.PA0.level, 0);
  const floating = sourceRuntime('#include "stm32f10x.h"\nint main(void){RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA,ENABLE);return GPIO_ReadInputDataBit(GPIOA,GPIO_Pin_1);}');
  const s = finish(floating);
  assert.equal(s.returnValue, 0);
  assert.ok(s.diagnostics.some(d => d.code === "FLOATING_INPUT"));
});

test("TIM2 PWM exposes 1 kHz and 50% duty; advancing time updates waveform without Delay", () => {
  const r = runtime("pwm", {}, files => ({"main.c": files["main.c"].replace("for (brightness = 0;", "for (brightness = 500;")}));
  const s = r.runUntilDelay();
  assert.equal(s.error, null);
  assert.equal(s.pins.PA0.pwm.frequencyHz, 1000);
  assert.equal(s.pins.PA0.pwm.duty, 0.5);
  assert.equal(s.pins.PA0.level, 1);
  assert.equal(r.advanceTime(0.75).pins.PA0.level, 0);
  assert.equal(r.advanceTime(0.5).pins.PA0.level, 1);
  assert.ok(s.diagnostics.some(d => d.code === "TIMER_PRELOAD_APPROXIMATION"));
});

test("ADC captures hook input on conversion, exposes variable and drives the threshold decision", () => {
  let sample = 1024;
  const r = runtime("adc", { readADC: channel => { assert.equal(channel, 1); return sample; } });
  r.runUntilDelay();
  let s = r.runUntilDelay();
  assert.equal(s.variables.adcValue, 1024);
  assert.equal(s.pins.PA0.level, 0);
  sample = 3072;
  s = r.runUntilDelay();
  assert.equal(s.variables.adcValue, 3072);
  assert.equal(s.pins.PA0.level, 1);
  assert.ok(s.diagnostics.some(d => d.code === "ADC_IDEAL_CALIBRATION"));
});

test("USART sends source characters and processes subsequently injected receive bytes", () => {
  let emitted = "";
  const r = runtime("uart", { onSerial: (text, port) => { assert.equal(port, "USART1"); emitted += text; } });
  let s = r.runUntilDelay();
  assert.equal(s.serial, "OK\r\n");
  assert.equal(emitted, "OK\r\n");
  r.injectSerial("Z");
  s = r.runUntilDelay();
  assert.equal(s.variables.receivedByte, "Z".charCodeAt(0));
  assert.equal(s.serial, "OK\r\nZ");
  assert.equal(s.uarts.USART1.rx.length, 0);
});

test("missing RCC clock prevents GPIO initialization and writes, with a beginner repair message", () => {
  const r = runtime("blink", {}, files => ({"main.c": files["main.c"].replace("RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);", "")}));
  const s = r.runUntilDelay();
  assert.equal(s.pins.PA0.clock, false);
  assert.equal(s.pins.PA0.configured, false);
  assert.equal(s.pins.PA0.level, null);
  const d = s.diagnostics.find(d => d.code === "CLOCK_DISABLED");
  assert.ok(d?.plain && d?.technical && d?.fix.includes("RCC_APB2PeriphClockCmd"));
});

test("syntax errors and unsupported APIs stop compilation with file/line and an actionable reason", () => {
  assert.throws(() => compileProject({"main.c": "int main(void){\nint x = 3\nreturn x;\n}"}), e => e instanceof CompileError && e.diagnostics[0].code === "SYNTAX" && e.diagnostics[0].line === 3);
  assert.throws(() => compileProject({"main.c": "int main(void){\nSPI_Transmit(1);\n}"}), e => e instanceof CompileError && e.diagnostics[0].code === "UNSUPPORTED_API" && e.diagnostics[0].line === 2);
  assert.throws(() => compileProject({"main.c": '#include "Missing.h"\nint main(void){}'}), e => e.diagnostics[0].code === "MISSING_HEADER");
  assert.throws(() => compileProject({"main.c": "int main(void){GPIO_WriteBit(GPIOA,GPIO_Pin_0);}"}), e => e.diagnostics[0].code === "ARGUMENT_COUNT");
  assert.throws(() => compileProject({"main.c": "int main(void){Delay_ms();}"}), e => e.diagnostics[0].code === "ARGUMENT_COUNT");
});

test("C evaluation supports counted loops, arrays, integer division, casts, pointer references and static locals", () => {
  const source = [
    "#define TWICE(x) ((x)*2)",
    "int result=0;",
    "int counter(void){static int n=0; return ++n;}",
    "int main(void){",
    " uint8_t a[3]={1,2,3};",
    " a[2]=258;",
    " for(int i=0;i<3;i++){if(i==1)continue; result+=a[i];}",
    " int *p=&result;",
    " *p += TWICE(3);",
    " int n=0;",
    " do {n++;} while(n<2);",
    " switch(n){case 2: result+=5; break; default: result=0;}",
    " result += counter()+counter();",
    " result += (5/2==2);",
    " result += ((double)5/2>2);",
    " result += (5.0/2>2);",
    " return result;",
    "}"
  ].join("\n");
  const s = finish(sourceRuntime(source));
  assert.equal(s.error, null);
  assert.equal(s.returnValue, 20);
  assert.equal(s.variables.result, 20);
});

test("unsafe accesses fail clearly; tight loops yield to the host instead of freezing it", () => {
  const badArray = finish(sourceRuntime("int main(void){int a[2]={1,2};return a[2];}"));
  assert.equal(badArray.error.code, "ARRAY_BOUNDS");
  const zero = finish(sourceRuntime("int main(void){int zero=0;return 1/zero;}"));
  assert.equal(zero.error.code, "DIVIDE_BY_ZERO");
  const register = finish(sourceRuntime('#include "stm32f10x.h"\nint main(void){return GPIOA->UNKNOWN;}'));
  assert.equal(register.error.code, "UNSUPPORTED_REGISTER");
  const loop = sourceRuntime("int main(void){while(1){}}");
  const s = loop.runUntilDelay(100);
  assert.equal(s.steps, 100);
  assert.equal(s.done, false);
  assert.equal(s.budgetReached, true);
  assert.equal(loop.advanceTime(16).timeMs, 16);
  assert.ok(s.diagnostics.some(d => d.code === "NO_VIRTUAL_TIME_PROGRESS"));
});
