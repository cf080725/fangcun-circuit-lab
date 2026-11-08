import { createCircuit, makePart } from './circuit.js';

export const joystickLessonId = 'bluepill:native-joystick';
export const joystickLessonPart = 'joystick1';
const sources = './firmware/bluepill/native-joystick/';

export function makeJoystickLesson() {
  const circuit = createCircuit('blink');
  circuit.board.mount = { column:6, rotation:90 };
  circuit.components = [
    makePart('joystick', joystickLessonPart, -.55, -4.65),
    makePart('resistor', 'rx', 2.1, -3.65),
    makePart('resistor', 'ry', 4.2, -3.65),
    { ...makePart('led', 'ledx', 3, -4.55), color:'green' },
    { ...makePart('led', 'ledy', 5.05, -4.55), color:'yellow' }
  ];
  circuit.wires = [
    ['joystick1:VCC','bb:a8','#cb6849'], ['joystick1:GND','bb:a6','#3f4751'],
    ['joystick1:HORIZ','bb:a17','#4b94bc'], ['joystick1:VERT','bb:a16','#8c68a4'],
    ['joystick1:SEL','bb:a12','#b99a4b'], ['bb:a21','rx:1','#60a388'], ['bb:a20','ry:1','#db9c40'],
    ['rx:2','ledx:A','#60a388'], ['ry:2','ledy:A','#db9c40'],
    ['ledx:K','bb:n19','#3f4751'], ['ledy:K','bb:n23','#3f4751'], ['bb:n2','bb:a7','#3f4751']
  ].map(([a,b,color],index) => ({id:'w'+(index+1),a,b,color}));
  return {
    id:joystickLessonId, boardId:'bluepill', title:'双轴摇杆 · ADC 与 PWM 死区', shortTitle:'摇杆与死区',
    language:'c', nativeOnly:true, nativeSourceParameter:'DEAD_ZONE', watchPin:'PA0', circuitData:circuit,
    nativeSourceAssets:{'main.c':sources+'main.c','joystick_policy.h':sources+'joystick_policy.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载双轴摇杆源码。\n'},
    description:'用 ADC1 分别读取摇杆的两个轴，由 TIM2 两路 PWM 驱动外接灯，比较同一偏移下的两种死区设置。',
    setup:[
      '编译并运行。在 3D 里拖摇杆帽，松手回中。右侧「固定偏移」可保持可复现的位置。',
      '点「右推 60%」，观察水平 ADC、PA0 的 PWM 和绿灯。上推时观察垂直 ADC、PA1 和黄灯。',
      '保持同一偏移，把 DEAD_ZONE 从 250 改为 1400，重新编译。'
    ],
    learningGoals:[
      '通过面包板外露孔接供电、两路模拟输出和独立轴开关。',
      'ADC 读数来自两个实际分压节点，PWM 分别驱动两盏灯。',
      '保持输入不变，测量死区改动对占空比与灯电流的影响。'
    ],
    expected:'右推 60% 时只有水平轴有明显偏移。死区从 250 加到 1400 后，ADC 保持原值，绿灯熄灭。'
  };
}
