import {createCircuit,makePart} from './circuit.js';

export const dipSwitchLessonId = 'bluepill:native-dip-switch';
export const dipSwitchLessonPart = 'dip1';
export const dipSwitchLessonLed = 'led1';
export const dipSwitchLessonInputs = Object.freeze(['PA4','PA3','PA2','PA1']);
const directory = './firmware/bluepill/native-dip-switch/';

export function makeDipSwitchLesson() {
  const circuit = createCircuit('blink');
  circuit.board.mount = {column:6,rotation:90};
  circuit.components = [
    {...makePart('dipswitch',dipSwitchLessonPart,5.1,3.8),switchMask:10,mount:{hole:'bb:f27',rotation:0}},
    {...makePart('resistor','r1',1.65,-3.85),resistance:330},
    makePart('led',dipSwitchLessonLed,.03,-3.85)
  ];
  const signals = ['#875db5','#4c8db5','#39866d','#bd7552'];
  const ground = '#3f4751';
  const routes = [
    ...dipSwitchLessonInputs.map((_,index)=>[`bb:a${17+index}`,`bb:d${27+index}`,signals[index]]),
    ...dipSwitchLessonInputs.map((_,index)=>[`bb:h${27+index}`,`bb:n${46+index}`,ground]),
    ['bb:n50','bb:j24',ground],
    ['bb:a21','r1:1','#d69831'],
    ['r1:2',`${dipSwitchLessonLed}:A`,'#d69831'],
    [`${dipSwitchLessonLed}:K`,'bb:a6',ground]
  ];
  circuit.wires = routes.map(([a,b,color],index)=>({id:`w${index+1}`,a,b,color}));
  return {
    id:dipSwitchLessonId,boardId:'bluepill',title:'四位拨码开关 · 读入硬件配置',shortTitle:'四位拨码开关',
    language:'c',nativeOnly:true,nativeSourceParameter:'MATCH_MASK',watchPin:'PA0',circuitData:circuit,
    nativeSourceAssets:{'main.c':directory+'main.c','dip_switch_policy.h':directory+'dip_switch_policy.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载拨码开关源码。\n'},
    description:'读取四个接地触点，将闭合的开关组成四位掩码。PA0 通过限流电阻驱动外接 LED，匹配设置时亮灯。',
    setup:[
      '拨码开关横跨 E/F 排。1–4 号开关分别接 PA4、PA3、PA2、PA1，闭合时把输入接到地。',
      '编译并运行。默认 2、4 号闭合，读数为 0b1010（十进制 10）。目标是 5，灯熄灭。',
      '保持四个开关的位置不变，把 dip_switch_policy.h 里的 MATCH_MASK 从 5 改为 10，重新编译观察灯。'
    ],
    learningGoals:[
      '识别跨槽的四组独立触点 1–8、2–7、3–6、4–5，了解内部上拉为何让闭合读到低电平。',
      '1 号开关是最低位、4 号是最高位。把低电平解释为掩码中的 1。',
      '区分物理拨码、固件比较值和 PA0 外接灯的结果。'
    ],
    expected:'2、4 号开关保持闭合时，掩码始终为 10。MATCH_MASK 从 5 改为 10 后，PA0 外接灯由灭变亮。'
  };
}
