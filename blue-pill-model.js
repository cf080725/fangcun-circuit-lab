import { Group } from './vendor/three.module.js';
import { embeddedBoardRequest, parseEmbeddedBoard } from './board-glb.js';

export async function parseBluePillModel(bytes) {
  const scene = await parseEmbeddedBoard(bytes);
  const common = scene.getObjectByName('BP_COMMON');
  const bench = scene.getObjectByName('BP_BENCH_DETAILS');
  const inspection = scene.getObjectByName('BP_INSPECTION_DETAILS');
  if (!common?.children.length || !bench?.getObjectByName('BP_CHIP_BENCH_PACKAGE') ||
      !inspection?.getObjectByName('BP_CHIP_INSPECTION_PACKAGE')) {
    throw new Error('Blue Pill GLB is missing its named assemblies');
  }
  return function createAppearance(forInspection) {
    const appearance = new Group();
    appearance.add(common.clone(true), (forInspection ? inspection : bench).clone(true));
    appearance.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.castShadow = !mesh.name.startsWith('BP_TRACE_AND_PIN_ROW_INK');
      mesh.receiveShadow = true;
      if (forInspection && mesh.name.startsWith('BP_CHIP_')) mesh.userData.inspectionChip = true;
    });
    return appearance;
  };
}

export const loadBluePillModel = embeddedBoardRequest(import.meta.url, './models/blue-pill-detail.glb', parseBluePillModel);
