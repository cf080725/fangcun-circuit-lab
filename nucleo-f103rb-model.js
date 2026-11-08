import {embeddedBoardRequest, parseEmbeddedBoard} from './board-glb.js';

export async function parseNucleoF103rbModel(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const assembly = scene.getObjectByName('NUCLEO_COMMON');
  const required = ['NUCLEO_PCB_WHITE_MASK_AND_LAMINATE', 'NUCLEO_MORPHO_76_POSTS',
    'NUCLEO_ARDUINO_32_OPEN_FEMALE_SOCKETS', 'NUCLEO_CN1_MINI_B_OPEN_SHELL',
    'NUCLEO_B1_CAP', 'NUCLEO_B2_CAP', 'NUCLEO_LD2_LENS', 'NUCLEO_TARGET_MCU'];
  if (!assembly || required.some(name => !assembly.getObjectByName(name))) {
    throw new Error('NUCLEO-F103RB GLB is missing its interactive assemblies');
  }
  const lamps = ['NUCLEO_LD2_LENS', 'NUCLEO_LD3_LENS'];
  for (const name of lamps) {
    const lens = assembly.getObjectByName(name);
    if (lens && (!lens.isMesh || !lens.material?.emissive)) {
      throw new Error('NUCLEO-F103RB GLB has an incompatible LED material');
    }
  }
  return function createAppearance(forInspection = false) {
    const appearance = assembly.clone(true);
    appearance.traverse(object => {
      if (!object.isMesh) return;
      const decoration = /(?:SILK|TRACES|MARKINGS)/.test(object.name);
      object.castShadow = !decoration;
      object.receiveShadow = true;
      if (decoration) object.userData.detailOnly = true;
    });
    for (const [index, name] of lamps.entries()) {
      const lens = appearance.getObjectByName(name);
      if (!lens) continue;
      // The electrical indicators vary per scene. Keep other GLB resources shared.
      lens.material = lens.material.clone();
      lens.material.userData.shared = false;
      lens.material.emissive.setHex(index === 0 ? 0x46bd64 : 0xe65c4f);
      lens.material.emissiveIntensity = 0;
    }
    if (forInspection) appearance.getObjectByName('NUCLEO_TARGET_MCU').traverse(object => {
      if (object.isMesh) object.userData.inspectionChip = 'STM32F103RBT6';
    });
    return appearance;
  };
}

export const loadNucleoF103rbModel = embeddedBoardRequest(import.meta.url, './models/nucleo-f103rb.glb', parseNucleoF103rbModel);
