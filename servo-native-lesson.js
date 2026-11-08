import {createCircuit,makePart} from './circuit.js';

export const servoNativeLessonId = 'bluepill:native-servo';
export const servoNativePotPart = 'pot1';
export const servoNativeServoPart = 'servo1';
export const servoNativeSupplyPart = 'supply1';
const directory = './firmware/bluepill/native-servo/';

export function makeServoNativeLesson() {
  const circuit = createCircuit('blink');
  circuit.board.mount = {column:6, rotation:90};
  circuit.components = [
    {...makePart('pot',servoNativePotPart,-.50,-4.1),position:.75},
    {...makePart('servo',servoNativeServoPart,2.75,-5.05),servoModel:'hs55'},
    {...makePart('power',servoNativeSupplyPart,5.35,-4.1),voltage:5}
  ];
  const ground = '#3f4751';
  const routes = [
    ['bb:a8',`${servoNativePotPart}:VCC`,'#c45b54'],
    [`${servoNativePotPart}:OUT`,'bb:a17','#8f70d6'],
    ['bb:a21',`${servoNativeServoPart}:SIG`,'#d69831'],
    [`${servoNativeSupplyPart}:+`,`${servoNativeServoPart}:VCC`,'#c45b54'],
    [`${servoNativePotPart}:GND`,'bb:n10',ground],
    [`${servoNativeServoPart}:GND`,'bb:n18',ground],
    [`${servoNativeSupplyPart}:-`,'bb:n22',ground],
    ['bb:n25','bb:j24',ground]
  ];
  circuit.wires = routes.map(([a,b,color],index)=>({id:`w${index+1}`,a,b,color}));
  return {
    id:servoNativeLessonId,boardId:'bluepill',title:'旋钮控制 HS-55 舵机 · ADC 与 PWM',shortTitle:'旋钮控制舵机',
    language:'c',nativeOnly:true,nativeSourceParameter:'SERVO_REVERSED',watchPin:'PA0',circuitData:circuit,
    nativeSourceAssets:{'main.c':directory+'main.c','servo_policy.h':directory+'servo_policy.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载电位器和舵机源码。\n'},
    description:'ADC1 从 PA4 读取旋钮电压，TIM2 从 PA0 输出 50 Hz 控制脉冲。用独立 5 V 电源给 HS-55 供电，开发板和舵机共地。',
    setup:[
      '编译并运行。旋钮预设在 75%，舵机从中位逐步转向约 +30°。',
      '拖动电位器旋钮，观察 ADC1 读数、PA0 脉宽和舵机实际轴角。',
      '将旋钮放回 75%。定位 servo_policy.h，把 SERVO_REVERSED 从 0 改成 1，重新编译。'
    ],
    learningGoals:[
      '电位器由板上 3.3 V 供电，滑臂接 PA4。独立 5 V 电源给舵机供电，两套电源共用参考地。',
      'ADC1 将电压量化为 0–4095，程序把它映射为 900–2100 µs。TIM2 的周期始终是 20 ms。',
      '反转的是旋钮与目标角度的对应关系。舵机实际轴角需要时间追上目标。'
    ],
    expected:'在旋钮保持 75% 时，ADC1 约读到 3071，脉宽由约 1800 µs 变为约 1200 µs，舵机目标由 +30° 变为 −30°。'
  };
}
