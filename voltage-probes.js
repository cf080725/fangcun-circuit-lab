import {createBreadboardWiring} from './breadboard-wiring.js';
import {PARTS} from './circuit.js';
import {componentPin} from './model-renderer.js';

export function voltageProbeLookup(circuit,profile) {
  let wiring;
  return endpoint=>{
    if (typeof endpoint!=='string') return null;
    const separator=endpoint.indexOf(':');
    if (separator<1) return null;
    const owner=endpoint.slice(0,separator),terminal=endpoint.slice(separator+1);
    if (owner==='mcu') {
      const pin=profile.pins.find(item=>item.id===terminal);
      if (!pin) return null;
      const physical=pin.location??(pin.id!==pin.label?pin.id:'');
      return `开发板 ${pin.label}${physical?`（${physical}）`:''}`;
    }
    if (owner==='bb') {
      wiring??=createBreadboardWiring(circuit,profile);
      const socket=wiring.check(endpoint);
      return socket.ok||socket.kind==='wire'?`面包板 ${terminal.toUpperCase()}`:null;
    }
    const part=circuit.components.find(item=>item.id===owner&&!item.hidden);
    const pin=part&&componentPin(part,terminal,PARTS[part.type]);
    return pin?`${part.displayName||PARTS[part.type]?.name||part.id} ${pin.label}（${part.id}）`:null;
  };
}

export function probeMeterReading(open,red,black,result) {
  if (!open) return {status:'closed',voltage:null};
  if (!red||!black) return {status:'incomplete',voltage:null};
  return result?.measureBetween?.(red,black)??{status:'unavailable',voltage:null};
}
