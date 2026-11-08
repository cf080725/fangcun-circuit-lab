import { LoadingManager } from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

export async function parseEmbeddedBoard(bytes) {
  const manager = new LoadingManager();
  manager.setURLModifier(url => {
    if (/^(?:blob|data):/i.test(url)) return url;
    throw new Error('Board GLB resources must be embedded');
  });
  const { scene } = await new GLTFLoader(manager).parseAsync(bytes, '');
  // All renderers clone the assembly transforms and reuse its render resources.
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => { material.userData.shared = true; });
  });
  return scene;
}

export function embeddedBoardRequest(moduleUrl, relativePath, parse) {
  const url = new URL(relativePath, moduleUrl);
  url.search = new URL(moduleUrl).search;
  let request;
  return () => request ??= fetch(url).then(response => {
    if (!response.ok) throw new Error(`${relativePath} response ${response.status}`);
    return response.arrayBuffer();
  }).then(parse);
}
