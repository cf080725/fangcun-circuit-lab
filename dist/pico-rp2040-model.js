import { embeddedBoardRequest, parseEmbeddedBoard } from './board-glb.js';

export async function parsePicoRp2040Model(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const assembly = scene.getObjectByName('PICO_COMMON');
  const required = ['PICO_PCB', 'PICO_GPIO_PLATING', 'PICO_SWD_PLATING', 'PICO_MOUNTING_RINGS',
    'PICO_RP2040_PACKAGE', 'PICO_MICRO_USB_OPEN_SHELL', 'PICO_WINBOND_FLASH', 'PICO_RT6150_AND_POWER_COMPONENTS'];
  if (!assembly || required.some(name => !assembly.getObjectByName(name))) {
    throw new Error('Pico Rev3 GLB is missing its named assemblies');
  }
  return function createAppearance(forInspection) {
    const appearance = assembly.clone(true);
    appearance.traverse(mesh => {
      if (!mesh.isMesh) return;
      const flatDetail = mesh.name.startsWith('PICO_ILLUSTRATIVE_');
      mesh.castShadow = !flatDetail;
      mesh.receiveShadow = true;
      if (flatDetail) mesh.userData.detailOnly = true;
      if (!forInspection) return;
      if (mesh.name.startsWith('PICO_RP2040_')) mesh.userData.inspectionChip = 'RP2040';
      if (/^PICO_(GPIO|SWD)_PLATING/.test(mesh.name)) mesh.userData.inspectionPicoPad = true;
    });
    return appearance;
  };
}

export const loadPicoRp2040Model = embeddedBoardRequest(import.meta.url, './models/pico-rp2040-detail.glb', parsePicoRp2040Model);
