import {createCircuit,makePart} from './circuit.js';

export const relayNativeLessonId='bluepill:native-relay';
export const relayNativePart='relay1';
export const relayNativeLamp='loadled';
const directory='./firmware/bluepill/native-relay/';

export function makeRelayNativeLesson(){
  const circuit=createCircuit('blink');
  circuit.board.mount={column:6,rotation:90};
  circuit.components=[
    makePart('grove-relay',relayNativePart,-.1,-4.85),
    {...makePart('power','loadpower',5.25,-4.25),voltage:3.3},
    {...makePart('resistor','loadr',3.3,-3.02),resistance:330},
    {...makePart('led',relayNativeLamp,3.25,-4.35),color:'yellow'}
  ];
  circuit.wires=[
    ['bb:a21',`${relayNativePart}:SIG`,'#d69831'],
    ['bb:j23',`${relayNativePart}:VCC`,'#c75b50'],
    ['bb:j24',`${relayNativePart}:GND`,'#43546a'],
    ['loadpower:+',`${relayNativePart}:COM`,'#b45847'],
    [`${relayNativePart}:NO`,'loadr:1','#ab7442'],
    ['loadr:2',`${relayNativeLamp}:A`,'#ab7442'],
    [`${relayNativeLamp}:K`,'loadpower:-','#45374d']
  ].map(([a,b,color],index)=>({id:`w${index+1}`,a,b,color}));
  return {
    id:relayNativeLessonId,boardId:'bluepill',title:'Grove 继电器 · 短脉冲与触点',shortTitle:'继电器与短脉冲',
    language:'c',nativeOnly:true,nativeSourceParameter:'PULSE_MS',watchPin:'PA0',circuitData:circuit,
    nativeSourceAssets:{'main.c':directory+'main.c','relay_policy.h':directory+'relay_policy.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载继电器定时器源码。\n'},
    description:'Blue Pill 输出定时脉冲。继电器模块的常开触点独立开关一条 3.3 V 灯回路。对照输入指示、触点和外接灯。',
    setup:[
      '编译并运行。PA0 每 500 ms 发出一个 2 ms 的高脉冲。看 SIG 读数和独立灯回路。',
      '打开 relay_policy.h，把 PULSE_MS 从 2 改为 220，再编译。',
      '比较 PA0、常开触点和外接灯电流。继电器模块供电与外接灯电源是两条独立回路。'
    ],
    learningGoals:[
      '用定时器的比较寄存器改变脉宽，保持 500 ms 周期不变。',
      '区分控制输入和有机械动作时间的触点。COM 与 NO 在断开时不会给负载送电。',
      '观察同样的接线在两种脉宽下怎样改变外接灯。'
    ],
    expected:'2 ms 高脉冲在教学模型中无法完成吸合。改成 220 ms 后，触点每周期吸合一次，外接灯跟随触点亮灭。'
  };
}
