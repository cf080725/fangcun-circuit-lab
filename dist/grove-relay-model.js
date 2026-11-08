import {embeddedBoardRequest,parseEmbeddedBoard} from './board-glb.js';
import {groveRelayVisual} from './model-renderer.js';

const contactName=id=>id==='NC'?'GROVE_RELAY_NC_UNUSED':'GROVE_RELAY_CONTACT_'+id;

export async function parseGroveRelayModel(bytes){
  const scene=await parseEmbeddedBoard(bytes);
  const assembly=scene.getObjectByName('GROVE_RELAY_COMMON');
  const sourceLens=assembly?.getObjectByName('GROVE_RELAY_RED_LENS');
  if(!assembly?.getObjectByName('GROVE_RELAY_CASE')||!sourceLens?.isMesh||!sourceLens.material?.emissive||
     !groveRelayVisual.pins.every(({id})=>assembly.getObjectByName(contactName(id)))){
    throw new Error('Grove Relay GLB is missing its body, contacts or indicator');
  }
  return function createAppearance(){
    const root=assembly.clone(true);
    const lens=root.getObjectByName('GROVE_RELAY_RED_LENS');
    lens.material=lens.material.clone();
    delete lens.material.userData.shared;
    root.traverse(object=>{
      if(!object.isMesh)return;
      object.castShadow=true;object.receiveShadow=true;
    });
    for(const {id} of groveRelayVisual.pins){
      root.getObjectByName(contactName(id)).traverse(object=>{if(object.isMesh)object.userData.relayTerminal=id;});
    }
    return {root,lens};
  };
}

export const loadGroveRelayModel=embeddedBoardRequest(import.meta.url,'./models/grove-relay-v12.glb',parseGroveRelayModel);
