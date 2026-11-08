import {embeddedBoardRequest, parseEmbeddedBoard} from './board-glb.js';

export async function parseEncoderPec11rModel(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const assembly = scene.getObjectByName('ENCODER_COMMON');
  if (!assembly?.getObjectByName('ENCODER_BODY') || !assembly.getObjectByName('ENCODER_SHAFT')) {
    throw new Error('PEC11R GLB is missing the body or moving shaft');
  }
  return function createAppearance() {
    const root = assembly.clone(true);
    const shaft = root.getObjectByName('ENCODER_SHAFT');
    root.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const terminal = /^ENCODER_CONTACT_(A|C|B|SW1|SW2)$/.exec(object.name);
      if (terminal) object.userData.encoderTerminal = terminal[1];
    });
    return {root, shaft};
  };
}

export const loadEncoderPec11rModel = embeddedBoardRequest(import.meta.url, './models/encoder-pec11r.glb', parseEncoderPec11rModel);
