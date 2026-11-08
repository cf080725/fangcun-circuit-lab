import {embeddedBoardRequest,parseEmbeddedBoard} from './board-glb.js';

export async function parseJoystickSparkFunModel(bytes) {
  const scene=await parseEmbeddedBoard(bytes);
  const assembly=scene.getObjectByName('JOYSTICK_COMMON');
  const stick=assembly?.getObjectByName('JOYSTICK_STICK');
  const plunger=stick?.getObjectByName('JOYSTICK_PLUNGER');
  if(!assembly?.getObjectByName('JOYSTICK_BODY')||!plunger?.getObjectByName('JOYSTICK_CAP')){
    throw new Error('Joystick GLB is missing the body, gimbal or cap');
  }
  return function createAppearance(){
    const root=assembly.clone(true);
    const stick=root.getObjectByName('JOYSTICK_STICK');
    const plunger=stick.getObjectByName('JOYSTICK_PLUNGER');
    const cap=plunger.getObjectByName('JOYSTICK_CAP');
    root.traverse(object=>{
      if(!object.isMesh)return;
      object.castShadow=true;
      object.receiveShadow=true;
      const terminal=/^JOYSTICK_CONTACT_(VCC|VERT|HORIZ|SEL|GND)(?:_|$)/.exec(object.name)
        ?? /^JOYSTICK_CONTACT_(VCC|VERT|HORIZ|SEL|GND)$/.exec(object.parent?.name);
      if(terminal)object.userData.joystickTerminal=terminal[1];
    });
    return {root,stick,plunger,cap};
  };
}

export const loadJoystickSparkFunModel=embeddedBoardRequest(import.meta.url,'./models/joystick-sparkfun.glb',parseJoystickSparkFunModel);
