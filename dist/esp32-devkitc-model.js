import { Group } from './vendor/three.module.js';
import { embeddedBoardRequest, parseEmbeddedBoard } from './board-glb.js';

export async function parseEsp32DevkitcModel(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const assembly = scene.getObjectByName('ESP32_COMMON');
  const required = ['ESP32_PCB_MASK_AND_LAMINATE', 'ESP32_PCB_PLATED_HEADER_HOLES',
    'ESP32_WROOM_SHIELD', 'ESP32_WROOM_CASTELLATIONS', 'ESP32_WROOM_ANTENNA',
    'ESP32_USB_MICRO_B_OPEN_SHELL', 'ESP32_USB_UART_QFN', 'ESP32_3V3_REGULATOR'];
  if (!assembly || required.some(name => !assembly.getObjectByName(name))) {
    throw new Error('ESP32 DevKitC V4 GLB is missing its named assemblies');
  }
  return function createAppearance(forInspection) {
    const appearance = new Group();
    appearance.rotation.y = forInspection ? 0 : Math.PI;
    appearance.add(assembly.clone(true));
    appearance.traverse(mesh => {
      if (!mesh.isMesh) return;
      const trace = mesh.name.startsWith('ESP32_ILLUSTRATIVE_UNDERSIDE_ROUTING');
      mesh.castShadow = !trace;
      mesh.receiveShadow = true;
      if (trace) mesh.userData.detailOnly = true;
      if (forInspection && mesh.name.startsWith('ESP32_WROOM_')) mesh.userData.inspectionChip = 'ESP32-WROOM-32E';
    });
    return appearance;
  };
}

export const loadEsp32DevkitcModel = embeddedBoardRequest(import.meta.url, './models/esp32-devkitc-v4-detail.glb', parseEsp32DevkitcModel);
