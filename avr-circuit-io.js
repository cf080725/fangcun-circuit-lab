import {canonicalPin, getBoardProfile} from './board-profiles.js';
import {mountedConnections} from './breadboard-mount.js';

// The AVR models the converter clock. The external teaching circuit is solved
// at most once per 4 ms of virtual time during a continuous series of samples.
const analogIntervalMs = 4;

export function createAvrCircuitIO(getCircuit, solver) {
  let analogSample;
  let nativeRead;

  function readInputs(state) {
    const circuit = getCircuit();
    const board = getBoardProfile(circuit.boardId);
    const connected = new Set(board.userButton ? [board.userButton.pin] : []);
    for (const {a,b} of circuit.wires) {
      for (const endpoint of [a,b]) {
        if (endpoint.startsWith('mcu:')) connected.add(canonicalPin(endpoint.slice(4),board.id));
      }
    }
    // A seated Nano can read an input through the breadboard alone.
    for (const {a} of mountedConnections(circuit,board)) connected.add(canonicalPin(a.slice(4),board.id));
    const inputs = Object.keys(state.pins).filter(name=>connected.has(name)&&state.pins[name].mode!=='GPIO_Mode_Out_PP');
    if (!inputs.length) return {};
    const reading = solver.solve(circuit,state,{averagePWM:false});
    return Object.fromEntries(inputs.map(name=>[name,reading.readPin(name)]));
  }

  function readAnalog(pin,state) {
    const circuit = getCircuit();
    const interval = Math.floor(state.timeMs/analogIntervalMs);
    if (analogSample?.circuit!==circuit || analogSample.interval!==interval) {
      analogSample = {circuit,interval,voltages:solver.solve(circuit,state,{averagePWM:false}).netVoltages};
    }
    return analogSample.voltages['mcu:'+canonicalPin(pin,circuit.boardId)] ?? 0;
  }

  function i2cAddress(address,direction,state) {
    return solver.i2cAddress(getCircuit(),state,address,direction);
  }

  function readI2c(address,quantity,state,{offset,stop=false}={}) {
    const circuit=getCircuit();
    if(offset===undefined)return solver.readI2c(circuit,state,address,quantity);
    if(!Number.isInteger(quantity)||quantity<1||quantity>32||!Number.isInteger(offset)||offset<0||offset>=32) {
      nativeRead=null;
      return {status:3,reason:'invalid-data',bytes:[]};
    }
    if(offset===0) {
      // Latch the selected register for the entire physical read. A
      // conversion between two byte clocks must not produce a mixed word.
      const packet=solver.readI2c(circuit,state,address,32);
      nativeRead=null;
      if(packet.status)return packet;
      nativeRead={circuit,address,packet,nextOffset:0};
    }
    if(nativeRead?.circuit!==circuit||nativeRead.address!==address||nativeRead.nextOffset!==offset) {
      nativeRead=null;
      return {status:4,reason:'disconnected',bytes:[]};
    }
    if(offset>0) {
      const target=solver.i2cAddress(circuit,state,address,'read');
      if(target.status||target.deviceId!==nativeRead.packet.deviceId) {
        nativeRead=null;
        return target.status?{...target,bytes:[]}:{status:2,reason:'disconnected',bytes:[]};
      }
    }
    const {bytes,...response}=nativeRead.packet;
    const requested=bytes.slice(offset,offset+quantity);
    nativeRead.nextOffset+=quantity;
    if(stop)nativeRead=null;
    return {...response,bytes:requested};
  }

  return {
    readInputs,
    readAnalog,
    readReference:state=>readAnalog('AREF',state),
    invalidateAnalog:()=>{analogSample=undefined;},
    i2cAddress,
    writeI2c:(address,bytes,state)=>solver.writeI2c(getCircuit(),state,address,bytes),
    readI2c
  };
}
