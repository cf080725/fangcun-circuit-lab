const temperatures = {minimum:-40, maximum:125, initial:25};
const resolutions = [.5, .25, .125, .0625];
const conversionTimes = [30, 65, 130, 250];
const limits = ['upper', 'lower', 'critical'];
const shutdownBit = 0x100;
const lockBits = 0xc0;
const temperatureMask = 0x1fff;
const timestampTolerance = 1e-8;

export const mcp9808Pins = ['VIN', 'GND', 'SDA', 'SCL'];
export const mcp9808PullOhms = 10000;
export const mcp9808LoadOhms = 25000;
export const mcp9808Addresses = Array.from({length:8}, (_, index) => 0x18 + index);
export const mcp9808Temperature = {default:temperatures.initial, min:temperatures.minimum, max:temperatures.maximum};
export const mcp9808Address = part => mcp9808Addresses.includes(part.address) ? part.address : 0x18;
export const mcp9808Powered = voltage => Number.isFinite(voltage) && voltage >= 2.7 - 1e-9 && voltage <= 5.5 + 1e-9;

function environment(part) {
  const value = Number.isFinite(part.temperatureC) ? part.temperatureC : temperatures.initial;
  return Math.min(temperatures.maximum, Math.max(temperatures.minimum, value));
}

export function createMcp9808(part, timeMs) {
  return {pointer:0, config:0, resolutionIndex:3, upper:0, lower:0, critical:0,
    units:null, sampleTimeMs:null, nextConversionMs:timeMs+conversionTimes[3], targetTemperatureC:environment(part)};
}

export function rebaseMcp9808(state, timeMs) {
  return {...state,
    sampleTimeMs:state.sampleTimeMs===null?null:Math.max(0,state.sampleTimeMs-timeMs),
    nextConversionMs:state.nextConversionMs===null?null:Math.max(0,state.nextConversionMs-timeMs)};
}

export function advanceMcp9808(state, part, timeMs) {
  const targetTemperatureC = environment(part);
  const {nextConversionMs, resolutionIndex} = state;
  if (nextConversionMs===null || timeMs+timestampTolerance<nextConversionMs) {
    return targetTemperatureC===state.targetTemperatureC?state:{...state,targetTemperatureC};
  }
  const period = conversionTimes[resolutionIndex];
  const latest = nextConversionMs + period*Math.floor((timeMs-nextConversionMs+timestampTolerance)/period);
  // Environmental settings become effective at the supplied virtual boundary.
  // If a conversion completed earlier, it sampled the previous setting.
  const temperature = latest < timeMs - timestampTolerance ? state.targetTemperatureC : targetTemperatureC;
  const step = resolutions[resolutionIndex];
  const units = Math.sign(temperature)*Math.round(Math.abs(temperature)/step)*step*16 || 0;
  return {...state, targetTemperatureC, units, sampleTimeMs:latest, nextConversionMs:latest+period};
}

function signedUnits(word) {
  const raw = word & temperatureMask;
  return raw & 0x1000 ? raw-0x2000 : raw;
}

function ambientWord(state) {
  const {units} = state;
  if (units===null) return 0; // Documented power-on T_A before the first conversion.
  const flags = (units>=signedUnits(state.critical)?0x8000:0) |
    (units>signedUnits(state.upper)?0x4000:0) | (units<signedUnits(state.lower)?0x2000:0);
  return flags | (units & temperatureMask);
}

export function mcp9808Reading(state, part, {voltage, powered, reason}) {
  return {address:mcp9808Address(part), voltage, powered, reason, targetTemperatureC:environment(part),
    temperatureC:powered&&state.units!==null?state.units/16:null,
    rawTemperature:powered?ambientWord(state):null, sampleTimeMs:powered?state.sampleTimeMs:null,
    resolutionIndex:state.resolutionIndex, resolution:resolutions[state.resolutionIndex],
    conversionMs:conversionTimes[state.resolutionIndex], shutdown:Boolean(state.config & shutdownBit)};
}

function wordBytes(word) {
  return [word >> 8, word & 0xff];
}

export function readMcp9808(state, quantity) {
  if (!Number.isInteger(quantity)||quantity<0||quantity>32) return {status:3,reason:'invalid-data',bytes:[]};
  let value;
  switch (state.pointer) {
    case 0x00: value=[0,0x1f]; break;
    case 0x01: value=wordBytes(state.config); break;
    case 0x02: case 0x03: case 0x04: value=wordBytes(state[limits[state.pointer-2]]); break;
    case 0x05: value=wordBytes(ambientWord(state)); break;
    case 0x06: value=[0x00,0x54]; break;
    case 0x07: value=[0x04,0x00]; break;
    case 0x08: value=[state.resolutionIndex]; break;
  }
  // The part does not auto-increment into adjacent registers.
  return {status:0, bytes:value.slice(0,quantity)};
}

export function writeMcp9808(previous, bytes, timeMs) {
  if ((!Array.isArray(bytes)&&!(bytes instanceof Uint8Array))||
    bytes.length>3||!Array.from(bytes).every(byte=>Number.isInteger(byte)&&byte>=0&&byte<=255)) {
    return {status:3,reason:'invalid-data'};
  }
  if (!bytes.length) return {status:0,state:previous};
  const [pointer, first, second] = bytes;
  if (pointer>0x08) return {status:3,reason:'unsupported-register'};
  const state = {...previous,pointer};
  if (bytes.length===1) return {status:0,state};
  if (pointer===0x08) {
    if (bytes.length!==2) return {status:3,reason:'invalid-data'};
    state.resolutionIndex=first & 3;
    if (state.resolutionIndex!==previous.resolutionIndex && !(state.config & shutdownBit)) {
      state.nextConversionMs=timeMs+conversionTimes[state.resolutionIndex];
    }
    return {status:0,state};
  }
  if (pointer===0||pointer>=0x05) return {status:3,reason:'read-only-register'};
  if (bytes.length!==3) return {status:3,reason:'invalid-data'};
  const value = first*256+second;
  if (pointer===0x01) {
    const locked = previous.config & lockBits;
    const wasAsleep = previous.config & shutdownBit;
    const sleep = value & shutdownBit && (!locked||wasAsleep) ? shutdownBit : 0;
    state.config = locked | (value & lockBits) | sleep;
    if (sleep!==wasAsleep) state.nextConversionMs=sleep?null:timeMs+conversionTimes[state.resolutionIndex];
    const unsupported = value & 0x062f; // Alert output modes and hysteresis are outside this model.
    return unsupported?{status:0,state,reason:'unsupported-configuration'}:{status:0,state};
  }
  const lock = pointer===0x04?0x80:0x40;
  if (!(state.config & lock)) state[limits[pointer-2]]=value & 0x1ffc;
  return {status:0,state};
}
