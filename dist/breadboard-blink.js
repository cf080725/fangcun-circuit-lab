import {getBoardProfile, makeBoardStarter} from './board-profiles.js';
import {getMountOptions, mountedPinRoutes} from './breadboard-mount.js';

export const breadboardBlinkBoardIds = [
  'esp32-s3-devkitc', 'esp32-c6-devkitc', 'esp32-h2-devkitm', 'nodemcu-esp8266', 'nano',
];

export function makeBreadboardBlink(boardId) {
  const profile = getBoardProfile(boardId);
  const options = getMountOptions(profile);
  const {files, circuit, ledPin} = makeBoardStarter(boardId, 'blink', {externalLed:true});
  if (!options || !circuit.wires.length) return null;

  const mount = {column: options.defaultColumn, rotation: options.defaultRotation};
  const preview = {...circuit, board: {...circuit.board, mount}};
  const routes = new Map(mountedPinRoutes(preview, profile).map(route => [route.endpoint, route]));
  const output = circuit.wires.find(wire => wire.b === 'r1:1');
  const ground = circuit.wires.find(wire => wire.a === 'led1:K');
  const outputRoute = routes.get(output?.a);
  const groundRoute = routes.get(ground?.b);
  // Prefer the outermost exposed row so the jumper remains easy to reach.
  const outerHole = route => route?.exposed.find(endpoint=>/^bb:[aj]/.test(endpoint)) ?? route?.exposed[0];
  const outputHole = outerHole(outputRoute), groundHole = outerHole(groundRoute);
  if (!outputHole || !groundHole) return null;

  output.a = outputHole;
  ground.b = groundHole;
  for (const part of circuit.components) part.z = 4.1;
  return {files, circuit, mount, ledPin, outputRoute, groundRoute, outputHole, groundHole};
}
