import {joystickState} from './analog-joystick.js';
import {mountedConnections,signalStrip} from './breadboard-mount.js';
import {BOARD_PROFILES,canonicalPin} from './board-profiles.js';
import {buttonContact} from './button-contact.js';
import {mountedPartContacts} from './part-mount.js';
import {encoderContact} from './rotary-encoder.js';
import {sourceCircuitKey} from './source-hardware.js';

const nativeDialects=new Set(['stm32-firmware','avr-firmware','rp2040-firmware']);
const invalidCircuit=new Set(['SUPPLY_SHORT','ELECTRICAL_CONFLICT','OUTPUT_CONFLICT','BOARD_MISMATCH','POWER_OFF','BOOT_MODE']);

function stripKey(endpoint) {
  const strip=signalStrip(endpoint);
  return strip ? `${strip.rows}:${strip.column}` : null;
}

function connectedTerminals(circuit,profile,probes) {
  const endpoints=new Set(circuit.wires.flatMap(({a,b})=>[a,b]));
  if(probes?.red&&probes?.black){endpoints.add(probes.red);endpoints.add(probes.black);}
  const usedStrips=new Set([...endpoints].map(stripKey));
  const contacts=[...mountedConnections(circuit,profile),...circuit.components.flatMap(mountedPartContacts)];
  const contactsByStrip=new Map();
  for(const {a,b} of contacts){
    const strip=stripKey(b);
    if(!contactsByStrip.has(strip))contactsByStrip.set(strip,[]);
    contactsByStrip.get(strip).push(a);
  }
  for(const [strip,terminals] of contactsByStrip){
    if(terminals.length>1||usedStrips.has(strip))for(const terminal of terminals)endpoints.add(terminal);
  }
  return endpoints;
}

function inputsAt(circuit,profile,probes,timeMs) {
  const controls=circuit.components.filter(({type})=>type==='joystick'||type==='encoder'||type==='button');
  if(!controls.length)return [];
  const terminals=connectedTerminals(circuit,profile,probes);
  const inputs=[];
  for(const part of controls){
    const uses=(...pins)=>pins.some(pin=>terminals.has(`${part.id}:${pin}`));
    if(part.type==='joystick'){
      const {x,y,pressed}=joystickState(part);
      const horizontal=uses('HORIZ'),vertical=uses('VERT'),supply=uses('VCC','GND');
      const xWired=horizontal&&(supply||vertical),yWired=vertical&&(supply||horizontal);
      const switchWired=uses('SEL')&&uses('GND');
      if(xWired||yWired||switchWired)inputs.push([part.id,xWired?x:0,yWired?y:0,switchWired&&pressed]);
    }else if(part.type==='encoder'){
      const quadrature=uses('C')&&uses('A','B');
      const switchWired=uses('SW1')&&uses('SW2');
      if(!quadrature&&!switchWired)continue;
      const {detents,aClosed,bClosed,switchClosed,queued}=encoderContact(part,timeMs);
      if(quadrature&&queued>0)return null;
      inputs.push([part.id,quadrature?detents:0,quadrature&&aClosed,quadrature&&bClosed,switchWired&&switchClosed]);
    }else if(uses('1','2')&&uses('3','4')){
      const {closed,bouncing}=buttonContact(part,timeMs);
      if(bouncing)return null;
      inputs.push([part.id,closed]);
    }
  }
  return inputs.sort();
}

function watchPin(pin,boardId){
  if(typeof pin!=='string'||!pin)return null;
  const canonical=canonicalPin(pin,boardId);
  return typeof canonical==='string'?canonical:null;
}

export function nativeObservationContext({circuit,profile,pin,ledId,probes,timeMs=0}){
  const inputs=inputsAt(circuit,profile,probes,timeMs);
  if(!inputs)return null;
  return JSON.stringify([sourceCircuitKey(circuit,profile),watchPin(pin,profile.id),ledId??null,
    probes?.red??null,probes?.black??null,inputs]);
}

function measuredVoltage(result,red,black){
  const reading=red&&black?result.measureBetween?.(red,black):null;
  if(reading?.status==='measured'&&Number.isFinite(reading.voltage))return {status:'measured',voltage:reading.voltage};
  return {status:reading?.status==='floating'?'floating':'unavailable',voltage:null};
}

function pwmReading(config){
  const pwm=config?.pwm;
  const frequencyHz=pwm?.frequencyHz??pwm?.frequency,duty=pwm?.duty;
  return config?.clock!==false&&Number.isFinite(frequencyHz)&&frequencyHz>0&&Number.isFinite(duty)&&duty>=0&&duty<=1
    ?{frequencyHz,duty}:null;
}

function ledReading(result,id){
  const reading=id?result.parts?.[id]:null;
  const average=reading?.pwmAverage?.currentMa;
  if(Number.isFinite(average))return {currentMa:average,mode:'average'};
  const currentMa=reading?.currentMa;
  return Number.isFinite(currentMa)?{currentMa,mode:'instantaneous'}:null;
}

export function nativeObservationSample({state,result,firmware,pin,ledId,probes,measurePwm=false}){
  if(!nativeDialects.has(state?.dialect)||!Object.hasOwn(BOARD_PROFILES,state.boardId)||!Number.isFinite(state.executedSteps)||state.executedSteps<=0||
      !Number.isFinite(state.timeMs)||state.timeMs<0||state.error||state.status==='error'||
      !result?.converged||(result.boardId&&result.boardId!==state.boardId)||
      result.issues?.some(({code})=>invalidCircuit.has(code)))return null;
  const firmwareName=firmware?.name;
  const firmwarePayload=state.dialect==='rp2040-firmware'?firmware?.uf2:firmware?.hex;
  if(firmware?.active===false||typeof firmwareName!=='string'||!firmwareName||
      typeof firmwarePayload!=='string'||!firmwarePayload)return null;
  pin=watchPin(pin,state.boardId);
  const config=pin?state.pins?.[pin]:null;
  const {red,black}=probes??{};
  const sample={timeMs:state.timeMs,pin,pinMode:typeof config?.mode==='string'?config.mode:null,
    voltage:measuredVoltage(result,pin&&'mcu:'+pin,'mcu:GND'),pwm:pwmReading(config),led:ledReading(result,ledId),
    probes:red&&black?{red,black,...measuredVoltage(result,red,black)}:null,firmwareName};
  if(measurePwm&&sample.pwm){
    const cycle=result.measurePwmCycle?.(pin,ledId);
    if(cycle)sample.pwmCycle=cycle;
  }
  // Keep the original string for equality only. JSON and public snapshots
  // can pass the readings through without copying the firmware image.
  return Object.defineProperty(sample,'firmwarePayload',{value:firmwarePayload});
}
