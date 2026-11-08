import * as THREE from './vendor/three.module.js';
import { signalHole, signalPitch } from './breadboard-mount.js';

// Centimetres. These heights are shared by the board surface, socket hit test,
// jumper cable, and components placed on top of the breadboard.
export const breadboardDimensions = {
  width: 8.30, depth: 5.40, pitch: signalPitch,
  coverBottom: .265, coverTop: .400, pinHeight: .415, opening: .086
};

export function breadboardSockets() {
  const { pitch } = breadboardDimensions;
  const sockets = [];
  for (let row = 0; row < 10; row++) {
    const letter = 'abcdefghij'[row];
    for (let col = 1; col <= 30; col++) {
      sockets.push({ ...signalHole(letter, col), rail: false,
        description: `面包板 ${letter.toUpperCase()}${col} · 同列 ${row < 5 ? 'A–E' : 'F–J'} 五孔相通` });
    }
  }
  for (const [offset, positive, negative, side] of [[0,-2.23,-1.97,'上方'],[25,1.97,2.23,'下方']]) {
    for (const [polarity,z,word] of [['p',positive,'正'],['n',negative,'负']]) {
      for (let i = 0; i < 25; i++) {
        sockets.push({ endpoint: `bb:${polarity}${offset + i + 1}`, x: (i + Math.floor(i / 5) - 14) * pitch, z, rail: true,
          description: `${side}${word}电源轨 · 本条25孔相通 · 与另一侧隔离` });
      }
    }
  }
  return sockets;
}

export function socketTileGeometry(depth) {
  const { pitch, opening, coverBottom, coverTop } = breadboardDimensions;
  return throughSocketGeometry(pitch, depth, coverTop - coverBottom, opening);
}

export function throughSocketGeometry(width, depth, height, opening) {
  const rect = new THREE.Shape();
  rect.moveTo(-width / 2, -depth / 2);
  rect.lineTo(width / 2, -depth / 2);
  rect.lineTo(width / 2, depth / 2);
  rect.lineTo(-width / 2, depth / 2);
  rect.closePath();
  const cut = new THREE.Path(), r = opening / 2;
  cut.moveTo(-r, -r); cut.lineTo(-r, r); cut.lineTo(r, r); cut.lineTo(r, -r); cut.closePath();
  rect.holes.push(cut);
  const tile = new THREE.ExtrudeGeometry(rect, { depth: height, bevelEnabled: false });
  tile.rotateX(-Math.PI / 2);
  return tile;
}

export function socketSpringGeometry() {
  const leaf = [[.015,0],[.035,.012],[.035,.051],[.020,.063],[.015,.056],[.026,.042],[.024,.016],[.015,.010]];
  const shapes = [-1,1].map(side => {
    const shape = new THREE.Shape();
    leaf.forEach(([x,y],i) => i ? shape.lineTo(side*x,y) : shape.moveTo(side*x,y));
    shape.closePath();
    return shape;
  });
  const contacts = new THREE.ExtrudeGeometry(shapes, { depth: .058, bevelEnabled: false });
  contacts.translate(0, 0, -.029);
  return contacts;
}

export function ledLensGeometry(flatCathode) {
  const points = [[0,0],[.275,0],[.275,.053],[.240,.057],[.240,.285]];
  for (let i = 1; i <= 12; i++) {
    const angle = i / 12 * Math.PI / 2;
    points.push([.24 * Math.cos(angle), .285 + .24 * Math.sin(angle)]);
  }
  const lens = new THREE.LatheGeometry(points.map(([r,y]) => new THREE.Vector2(r,y)), 36);
  if (flatCathode) {
    const positions = lens.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) <= .054 && positions.getX(i) > .25) positions.setX(i, .25);
    }
    lens.computeVertexNormals();
  }
  return lens;
}
