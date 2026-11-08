import {embeddedBoardRequest,parseEmbeddedBoard} from './board-glb.js';

export async function parsePotentiometerModel(bytes) {
  const scene=await parseEmbeddedBoard(bytes);
  const assembly=scene.getObjectByName('POT_COMMON');
  if(!assembly?.getObjectByName('POT_BODY') || !assembly.getObjectByName('POT_ROTOR')) {
    throw new Error('Potentiometer GLB is missing its body or rotor');
  }
  return function createAppearance() {
    const root=assembly.clone(true);
    const knob=root.getObjectByName('POT_ROTOR');
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.castShadow=true;
      mesh.receiveShadow=true;
    });
    return {root,knob};
  };
}

export const loadPotentiometerModel=embeddedBoardRequest(import.meta.url,'./models/potentiometer-3362.glb',parsePotentiometerModel);
