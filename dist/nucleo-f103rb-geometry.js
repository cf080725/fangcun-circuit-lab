// MB1136 C-series bench model, in centimetres. Origin is the centre of the
// PCB outline, +Y is up, and the ST-LINK Mini-B opening faces −Z.
// Envelope, pitch and connector numbering follow ST UM1724 Fig. 5 and
// Tables 12/27. Other dimensions are calibrated to the reconstructed mesh.
export const nucleoF103rbManual = 'https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf';

const pitch = .254;
const connectors = {
  CN7:{x:-3.175,z:-.955,rows:19,columns:2,contact:'male',contactY:.960},
  CN10:{x:2.921,z:-.955,rows:19,columns:2,contact:'male',contactY:.960},
  CN5:{x:2.413,z:-.8534,rows:10,columns:1,reverse:true,contact:'female',contactY:1.20},
  CN9:{x:2.413,z:1.839,rows:8,columns:1,reverse:true,contact:'female',contactY:1.20},
  CN6:{x:-2.413,z:.061,rows:8,columns:1,contact:'female',contactY:1.20},
  CN8:{x:-2.413,z:2.347,rows:6,columns:1,contact:'female',contactY:1.20}
};

export function nucleoF103rbContact(connector, connectorPin) {
  if (!Object.hasOwn(connectors,connector)) return null;
  const {x,z,rows,columns,reverse,contact,contactY}=connectors[connector];
  if (!Number.isInteger(connectorPin) || connectorPin<1 || connectorPin>rows*columns) return null;
  const index=reverse?rows-connectorPin:connectorPin-1;
  return {connector,connectorPin,contact,contactY,x:x+(index%columns)*pitch,z:z+Math.floor(index/columns)*pitch};
}

const button=(x,z)=>Object.freeze({x,z,w:.610,h:.610,capDiameter:.420,topY:.739,travel:.025});
const led=(x,z)=>Object.freeze({x,z,w:.175,h:.113,topY:.448});
export const nucleoF103rbGeometry = Object.freeze({
  width:7,height:8.25,pitch,boardBottom:.21,boardTop:.35,mountHoleRadius:.16,seamZ:-1.69,
  holes:[[-2.413,-1.321],[2.413,-1.219],[.887,3.861]],
  outline:[
    [-3.50,-4.00],[-3.38,-4.125],[3.38,-4.125],[3.50,-4.00],
    [3.50,-1.80],[3.37,-1.69],[3.50,-1.58],[3.50,3.86],
    [3.39,3.97],[1.45,3.97],[1.24,4.125],[-2.31,4.125],
    [-2.52,3.97],[-3.38,3.97],[-3.50,3.86],[-3.50,-1.58],[-3.37,-1.69],[-3.50,-1.80]
  ],
  features:Object.freeze({
    b1:button(-.84,-1.26),b2:button(.84,-1.26),ld2:led(.96,.13),ld3:led(-1.36,.12),
    mcu:Object.freeze({x:-.28,z:1.65,w:1,h:1,topY:.509,leadPitch:.05,leadSpan:1.21,pinsPerSide:16,rotation:0}),
    stLink:Object.freeze({x:.04,z:-2.65,w:.70,h:.70,topY:.509,pinsPerSide:12,rotation:0}),
    usb:Object.freeze({x:1.19,z:(-4.252-3.363)/2,w:.772,h:.889,topY:.745,kind:'mini',mouthZ:-4.252})
  })
});
