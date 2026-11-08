import {embeddedBoardRequest,parseEmbeddedBoard} from './board-glb.js';
import {rgbLedVisual} from './model-renderer.js';

export async function parseKingbrightRgbLedModel(bytes) {
  const scene=await parseEmbeddedBoard(bytes);
  const assembly=scene.getObjectByName('RGBLED_COMMON');
  const sourceLens=assembly?.getObjectByName('RGBLED_DIFFUSED_LENS');
  if(!sourceLens?.isMesh||!sourceLens.material?.emissive||
     !rgbLedVisual.pins.every(({id})=>assembly.getObjectByName('RGBLED_LEAD_'+id)?.isMesh)){
    throw new Error('Kingbright RGB GLB is missing its lens or physical leads');
  }
  return function createAppearance(){
    const root=assembly.clone(true);
    const lens=root.getObjectByName('RGBLED_DIFFUSED_LENS');
    lens.material=lens.material.clone();
    lens.material.userData={...lens.material.userData,shared:false};
    lens.castShadow=false;
    lens.receiveShadow=true;
    for(const {id} of rgbLedVisual.pins){
      const lead=root.getObjectByName('RGBLED_LEAD_'+id);
      lead.castShadow=true;
      lead.receiveShadow=true;
      lead.userData.rgbLedTerminal=id;
    }
    return {root,lens};
  };
}

export const loadKingbrightRgbLedModel=embeddedBoardRequest(import.meta.url,'./models/rgbled-kingbright.glb',parseKingbrightRgbLedModel);
