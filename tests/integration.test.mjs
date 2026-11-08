import test from "node:test";
import assert from "node:assert/strict";
import { compileProject, createRuntime, CompileError } from "../dist/engine.js";
import { CircuitSimulator, createCircuit, makePart } from "../dist/circuit.js";
import { examples } from "../dist/content.js";

function fixture(id, change = f => f) {
  const example = examples.find(e => e.id === id);
  assert.ok(example, "Missing example " + id);
  const circuit = createCircuit(example.circuitPreset);
  const solver = new CircuitSimulator();
  let runtime;
  runtime = createRuntime(compileProject(change(example.files)), {
    readPin: name => solver.solve(circuit, runtime.getState(), {averagePWM: false}).readPin(name),
    readADC: channel => solver.solve(circuit, runtime.getState(), {averagePWM: false}).readADC(channel)
  });
  const tick = () => {
    const state = runtime.runUntilDelay(2000);
    assert.equal(state.error, null, state.error?.plain);
    const result = solver.solve(circuit, state);
    assert.ok(result.converged, result.issues.map(i => i.code).join(", "));
    return { state, result };
  };
  return { circuit, solver, runtime, tick };
}
const light = (r, name = "led1") => r.parts[name].displayBrightness;
const noErrors = r => assert.deepEqual(r.issues.filter(i => i.severity === "error").map(i => i.code), []);
const wire = (a,b,id="w") => ({id,a,b,color:"#ea7246"});

test("real blink circuit has a limited LED current and alternates on/off at 500 ms", () => {
  const f = fixture("blink");
  let {state,result} = f.tick();
  assert.equal(state.timeMs, 500); assert.ok(light(result) > 0.4); noErrors(result);
  // Piecewise-linear LED + 330 ohm resistor + the documented 47 ohm output model.
  assert.ok(Math.abs(result.parts.led1.currentMa - 1.4/(330+47+10)*1000) < 0.01);
  ({state,result} = f.tick());
  assert.equal(state.timeMs, 1000); assert.equal(light(result), 0);
});

test("PC13 onboard LED is active low and does not require external parts", () => {
  const f = fixture("onboard");
  assert.equal(f.circuit.components.length, 0);
  let x = f.tick(); assert.equal(x.state.pins.PC13.output, 0); assert.ok(light(x.result,"onboard") > 0.5);
  x = f.tick(); assert.equal(x.state.pins.PC13.output, 1); assert.equal(light(x.result,"onboard"), 0);
});

test("three independent branches follow the traffic source program in order", () => {
  const f = fixture("traffic");
  for (const active of ["led1","led2","led3","led1"]) {
    const {result}=f.tick(); noErrors(result);
    for(const id of ["led1","led2","led3"]) assert.equal(light(result,id)>0.1,id===active);
  }
});

test("PB1 button circuit changes the C branch using the actual solved node voltage", () => {
  const f = fixture("button"), button=f.circuit.components.find(p=>p.type==="button");
  let x=f.tick(); assert.equal(light(x.result),0); assert.ok(x.result.netVoltages["mcu:PB1"]>3.2);
  button.pressed=true;
  x=f.tick(); assert.ok(light(x.result)>0.4); assert.ok(Math.abs(x.result.netVoltages["mcu:PB1"])<1e-9); noErrors(x.result);
  button.pressed=false;
  x=f.tick(); assert.equal(light(x.result),0);
});

test("PWM visible brightness follows duty instead of aliasing at integer-period sampling", () => {
  const f=fixture("pwm");
  let x=f.tick(); assert.equal(x.state.pins.PA0.pwm.duty,0); assert.equal(light(x.result),0);
  x=f.tick(); assert.equal(x.state.pins.PA0.pwm.duty,0.02);
  const full=x.result.parts.led1.brightness;
  assert.ok(Math.abs(light(x.result)-full*0.02)<1e-8);
  for(let i=0;i<24;i++) x=f.tick();
  assert.equal(x.state.pins.PA0.pwm.duty,0.5);
  assert.ok(Math.abs(light(x.result)-full*0.5)<1e-8);
  // Low instantaneous phase must retain half-brightness visually.
  let state=f.runtime.advanceTime(0.75), result=f.solver.solve(f.circuit,state);
  assert.equal(result.parts.led1.brightness,0);
  assert.ok(Math.abs(light(result)-full*0.5)<1e-8);
  for(let i=0;i<25;i++) x=f.tick();
  assert.equal(x.state.pins.PA0.pwm.duty,1);
  assert.ok(Math.abs(light(x.result)-full)<1e-8);
});

test("ADC potentiometer endpoints become 0/4095 and drive threshold LED from circuit data", () => {
  const f=fixture("adc"), pot=f.circuit.components.find(p=>p.type==="pot");
  pot.position=0; f.tick();
  let x=f.tick(); assert.equal(x.state.variables.adcValue,0); assert.equal(light(x.result),0); noErrors(x.result);
  pot.position=1;
  x=f.tick(); assert.equal(x.state.variables.adcValue,4095); assert.ok(light(x.result)>0.4);
  pot.position=0.5;
  x=f.tick(); assert.ok([2047,2048].includes(x.state.variables.adcValue)); assert.equal(light(x.result),0);
});

test("USART source sends and echoes while circuit models retain valid TX/RX configuration", () => {
  const f=fixture("uart");
  let x=f.tick(); assert.equal(x.state.serial,"OK\r\n"); assert.equal(x.state.uarts.USART1.clock,true); noErrors(x.result);
  assert.equal(x.state.pins.PA9.mode,"GPIO_Mode_AF_PP");
  f.runtime.injectSerial("A"); x=f.tick(); assert.equal(x.state.serial,"OK\r\nA");
});

test("multi-file LED program has its own 200/800 ms duty", () => {
  const f=fixture("multifile");
  let x=f.tick(); assert.equal(x.state.timeMs,200); assert.ok(light(x.result)>0.4);
  x=f.tick(); assert.equal(x.state.timeMs,1000); assert.equal(light(x.result),0);
});

test("buzzer and 50 Hz servo examples run their electrical component models", () => {
  const b=fixture("buzzer");
  let x=b.tick(); assert.equal(x.state.timeMs,200); assert.equal(x.result.parts.buzzer1.on,true); noErrors(x.result);
  x=b.tick(); assert.equal(x.state.timeMs,1000); assert.equal(x.result.parts.buzzer1.on,false);
  const s=fixture("servo");
  for(const expected of [0,90,180]){
    const x=s.tick(); assert.equal(x.state.pins.PA0.pwm.frequencyHz,50);
    assert.ok(Math.abs(x.result.parts.servo1.angle-expected)<1e-8);
    assert.equal(x.result.parts.servo1.active,true); noErrors(x.result);
  }
});

test("clock omission prevents current; analog mode is not a digital floating-input fault", () => {
  const f=fixture("blink", files=>({"main.c":files["main.c"].replace("RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);","")}));
  const x=f.tick(); assert.equal(light(x.result),0);
  assert.ok(x.state.diagnostics.some(d=>d.code==="CLOCK_DISABLED"));
  assert.ok(x.result.issues.some(d=>d.code==="GPIO_CLOCK"));
  const a=fixture("adc"); a.tick(); const healthy=a.tick();
  assert.equal(healthy.result.issues.some(d=>d.code==="INPUT_FLOATING"&&d.part==="PA1"),false);
});

test("breadboard rows 10–29 connect a–e, keep f–j separate, and rails break at their midpoint", () => {
  const c=createCircuit("onboard"); c.components=[makePart("resistor","r",0,0),makePart("led","led",1,0)];
  c.wires=[wire("mcu:3V3","bb:a12","1"),wire("bb:e12","r:1","2"),wire("r:2","led:A","3"),wire("led:K","mcu:GND1","4")];
  let r=new CircuitSimulator().solve(c); assert.ok(light(r,"led")>0.4);
  c.wires[1].a="bb:f12";
  r=new CircuitSimulator().solve(c); assert.equal(light(r,"led"),0);
  c.wires[0].b="bb:p10"; c.wires[1].a="bb:p25";
  r=new CircuitSimulator().solve(c); assert.ok(light(r,"led")>0.4);
  c.wires[1].a="bb:p26";
  r=new CircuitSimulator().solve(c); assert.equal(light(r,"led"),0);
});

test("floating input detection respects strong drive and open-drain pull-up", () => {
  const c=createCircuit("onboard");
  const state={timeMs:0,pins:{PB1:{clock:true,mode:"GPIO_Mode_IN_FLOATING",level:null,output:0}}};
  c.wires=[wire("mcu:PB1","mcu:3V3")];
  let r=new CircuitSimulator().solve(c,state);
  assert.equal(r.issues.some(i=>i.code==="INPUT_FLOATING"),false);
  assert.equal(r.readPin("PB1"),1);
  c.wires=[wire("mcu:PB1","bb:a1")];
  r=new CircuitSimulator().solve(c,state);
  assert.ok(r.issues.some(i=>i.code==="INPUT_FLOATING"));
  state.pins.PB1={clock:true,mode:"GPIO_Mode_Out_OD",level:null,output:1};
  c.components=[{...makePart("resistor","pull"),resistance:10000}];
  c.wires=[wire("mcu:3V3","pull:1","a"),wire("pull:2","mcu:PB1","b")];
  r=new CircuitSimulator().solve(c,state);
  assert.ok(r.netVoltages["mcu:PB1"]>3.2);
  assert.equal(r.issues.some(i=>i.code==="OPEN_DRAIN"&&i.severity!=="info"),false);
  assert.equal(r.issues.some(i=>i.code==="INPUT_FLOATING"),false);
});

test("ADC range checking is mode-specific and catches a 3.5 V analog input", () => {
  const c=createCircuit("onboard");
  c.components=[{...makePart("power","supply"),voltage:3.5}];
  c.wires=[wire("supply:-","mcu:GND1","a"),wire("supply:+","mcu:PA1","b")];
  const state={timeMs:0,pins:{PA1:{clock:true,mode:"GPIO_Mode_AIN",level:null,output:0}}};
  let r=new CircuitSimulator().solve(c,state);
  assert.ok(r.issues.some(i=>i.code==="ADC_OVERVOLTAGE"&&i.part==="PA1"));
  state.pins.PA1.mode="GPIO_Mode_IN_FLOATING";
  r=new CircuitSimulator().solve(c,state);
  assert.equal(r.issues.some(i=>i.code==="ADC_OVERVOLTAGE"),false);
});

test("repeated solves at the same timestamp do not invent capacitor charging time", () => {
  const c=createCircuit("onboard");
  c.components=[{...makePart("resistor","r"),resistance:1000},{...makePart("capacitor","cap"),capacitance:100}];
  c.wires=[wire("mcu:3V3","r:1","a"),wire("r:2","cap:+","b"),wire("cap:-","mcu:GND1","c")];
  const solver=new CircuitSimulator();
  assert.ok(Math.abs(solver.solve(c,{pins:{},timeMs:0}).parts.cap.voltage)<1e-7);
  let r=solver.solve(c,{pins:{},timeMs:100});
  assert.ok(Math.abs(r.parts.cap.voltage-1.65)<1e-6);
  const committed=solver.capVoltages.cap;
  for(let i=0;i<25;i++) r=solver.solve(c,{pins:{},timeMs:100});
  assert.equal(solver.capVoltages.cap,committed);
  assert.ok(Math.abs(r.parts.cap.voltage-committed)<1e-7);
  r=solver.solve(c,{pins:{},timeMs:200});
  assert.ok(Math.abs(r.parts.cap.voltage-2.475)<1e-6);
});

test("visual PWM ON/OFF solves do not mutate capacitor state and disclose RC timestep limits", () => {
  const f=fixture("pwm");
  f.circuit.components.push({...makePart("capacitor","cap"),capacitance:10});
  f.circuit.wires.push(wire("cap:+","led1:A","c1"),wire("cap:-","mcu:GND1","c2"));
  f.tick(); const x=f.tick(), before={...f.solver.capVoltages};
  const r=f.solver.solve(f.circuit,x.state,{averagePWM:true});
  assert.deepEqual(f.solver.capVoltages,before);
  assert.ok(r.issues.some(i=>i.code==="PWM_RC_TIMESTEP"));
});

test("runtime errors and compile errors expose consistent located beginner diagnostics", () => {
  const r=createRuntime(compileProject({"main.c":"int main(void){int zero=0; return 1/zero;}"}));
  const s=r.step(100);
  assert.equal(s.done,true); assert.equal(s.status,"error");
  assert.equal(s.error.code,"DIVIDE_BY_ZERO");
  assert.ok(s.diagnostics.some(d=>d.code===s.error.code&&d.severity==="error"));
  for(const key of ["plain","message","technical","fix","file"]) assert.equal(typeof s.error[key],"string");
  assert.equal(typeof s.error.line,"number"); assert.equal(typeof s.error.column,"number");
  assert.throws(()=>compileProject({"main.c":"int main(void){UnimplementedPeripheral();}"}),e=>e instanceof CompileError&&Array.isArray(e.diagnostics)&&e.diagnostics[0].code==="UNSUPPORTED_API");
});
