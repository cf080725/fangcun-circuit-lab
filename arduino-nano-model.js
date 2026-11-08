import { embeddedBoardRequest, parseEmbeddedBoard } from './board-glb.js';

export async function parseArduinoNanoModel(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const assembly = scene.getObjectByName('NANO_COMMON');
  const required = ['NANO_PCB', 'NANO_GPIO_PLATING', 'NANO_ICSP_PLATING', 'NANO_ICSP_BLOCK',
    'NANO_ICSP_POSTS', 'NANO_ATMEGA328P_PACKAGE', 'NANO_FT232RL_PACKAGE', 'NANO_MINI_USB_OPEN_SHELL'];
  if (!assembly || required.some(name => !assembly.getObjectByName(name))) {
    throw new Error('Arduino Nano V3.0 GLB is missing its named assemblies');
  }
  return function createAppearance(forInspection) {
    const appearance = assembly.clone(true);
    appearance.traverse(mesh => {
      if (!mesh.isMesh) return;
      const trace = /^NANO_(TOP|REAR)_ROUTING_ARTWORK/.test(mesh.name);
      mesh.castShadow = !trace;
      mesh.receiveShadow = true;
      if (trace) mesh.userData.detailOnly = true;
      if (forInspection && mesh.name.startsWith('NANO_ATMEGA328P_')) mesh.userData.inspectionChip = 'ATmega328P';
    });
    return appearance;
  };
}

export const loadArduinoNanoModel = embeddedBoardRequest(import.meta.url, './models/arduino-nano-detail.glb', parseArduinoNanoModel);
