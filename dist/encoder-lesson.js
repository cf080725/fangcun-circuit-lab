import { createCircuit, makePart } from './circuit.js';

export const encoderLessonId = 'bluepill:native-encoder';
export const encoderLessonPart = 'encoder1';
const sourceFolder = './firmware/bluepill/native-encoder/';

export function makeEncoderLesson() {
  const circuit = createCircuit('blink');
  circuit.breadboard = { x: 3.55, z: -2.75 };
  circuit.components = [
    makePart('encoder', encoderLessonPart, -.9, 1.2),
    makePart('resistor', 'r1', 1.4, .6),
    makePart('led', 'led1', 3.65, 1.5)
  ];
  circuit.components[1].resistance = 330;
  circuit.wires = [
    ['encoder1:A','mcu:PB0','#e09759'], ['encoder1:B','mcu:PB1','#4b94bc'],
    ['encoder1:C','mcu:GND1','#3f4751'], ['encoder1:SW1','mcu:PB10','#8c68a4'],
    ['encoder1:SW2','mcu:GND2','#3f4751'], ['mcu:PA0','r1:1','#cb8042'],
    ['r1:2','led1:A','#db9c40'], ['led1:K','mcu:GND3','#3f4751']
  ].map(([a,b,color],index) => ({id:'w'+(index+1),a,b,color}));
  return {
    id:encoderLessonId, boardId:'bluepill', title:'旋转编码器 · 原生 C 解码', shortTitle:'旋钮与 A/B 相',
    language:'c', nativeOnly:true, nativeSourceParameter:'CW_SIGN', watchPin:'PB0', circuitData:circuit,
    nativeSourceAssets:{'main.c':sourceFolder+'main.c','encoder_policy.h':sourceFolder+'encoder_policy.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载编码器源码。\n'},
    description:'转动 Bourns PEC11R 旋钮，观察两相触点顺序如何被 C 固件解码，并通过 PA0 驱动外接 LED。',
    setup:[
      '编译并运行。横拖金属轴，或点顺时针、逆时针按钮。每个卡位会走过四次 A/B 相变化。',
      '顺时针转三格，观察固件计数与 PA0 外接灯。按住轴开关可以归零。',
      '把 encoder_policy.h 中的 CW_SIGN 从 1 改成 -1，编译后按同一方向转三格。'
    ],
    learningGoals:[
      '区分无源触点、GPIO 内部上拉和虚拟旋钮的位置。',
      '按 A/B 两相边沿顺序判断方向，让一格等于一个完整的四边沿周期。',
      '在接线和机械转向相同的情况下验证修改 C 代码后固件计数及外接灯的变化。'
    ],
    expected:'默认顺时针三格得到 +3 并点亮外接 LED。反转 CW_SIGN 后，同样三格得到 −3，灯熄灭。'
  };
}
