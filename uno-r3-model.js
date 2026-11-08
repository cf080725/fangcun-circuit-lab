import { embeddedBoardRequest, parseEmbeddedBoard } from './board-glb.js';

export async function parseUnoR3Model(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const assembly = scene.getObjectByName('UNO_COMMON');
  const required = ['UNO_PCB_MASK_AND_LAMINATE', 'UNO_FEMALE_SOCKET_HOUSINGS', 'UNO_FEMALE_SOCKET_CONTACTS',
    'UNO_ICSP_POSTS', 'UNO_DIP_BODY', 'UNO_USB_BRIDGE_QFN32_BODY', 'UNO_USB_B_OPEN_SHELL', 'UNO_BARREL_OPEN_JACK'];
  if (!assembly || required
    .some(name => !assembly.getObjectByName(name))) {
    throw new Error('UNO R3 GLB is missing its named assemblies');
  }
  return function createAppearance(forInspection) {
    const appearance = assembly.clone(true);
    appearance.traverse(mesh => {
      if (!mesh.isMesh) return;
      const trace = mesh.name.startsWith('UNO_MASKED_CAD_TRACES');
      mesh.castShadow = !trace;
      mesh.receiveShadow = true;
      // The board surface remains pickable underneath these decorative overlays.
      if (trace || mesh.name.startsWith('UNO_TENTED_VIAS')) mesh.userData.detailOnly = true;
      if (forInspection && mesh.name.startsWith('UNO_DIP_')) mesh.userData.inspectionChip = 'ATmega328P';
    });
    return appearance;
  };
}

export const loadUnoR3Model = embeddedBoardRequest(import.meta.url, './models/uno-r3-detail.glb', parseUnoR3Model);
