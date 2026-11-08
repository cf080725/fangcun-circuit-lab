import {createCircuit,makePart} from './circuit.js';
import {pdvPhotocellModel} from './pdv-photocell.js';

export const photoresistorLessonId = 'bluepill:native-photoresistor';
export const photoresistorLessonPart = 'ldr1';
export const photoresistorLessonLed = 'led1';
export const photoresistorLessonPin = 'PA1';
const directory = './firmware/bluepill/native-photoresistor/';

export function makePhotoresistorLesson() {
  const circuit = createCircuit('blink');
  circuit.board.mount = {column:6,rotation:90};
  circuit.components = [
    {...makePart('ldr',photoresistorLessonPart,4.85,-3.65),ldrModel:pdvPhotocellModel,lux:20,ldrCovered:false},
    {...makePart('resistor','rDiv',6.1,-3.65),resistance:22000},
    {...makePart('resistor','r1',1.35,-3.75),resistance:330},
    makePart('led',photoresistorLessonLed,2.75,-3.75)
  ];
  const supply = '#c45b54', signal = '#875db5', ground = '#3f4751', alarm = '#d69831';
  const routes = [
    ['bb:a8','bb:p7',supply],
    ['bb:p20',`${photoresistorLessonPart}:1`,supply],
    [`${photoresistorLessonPart}:2`,'bb:a28',signal],
    ['bb:b28','bb:a20',signal],
    ['bb:c28','rDiv:1',signal],
    ['rDiv:2','bb:n22',ground],
    ['bb:a6','bb:n4',ground],
    ['bb:a21','r1:1',alarm],
    ['r1:2',`${photoresistorLessonLed}:A`,alarm],
    [`${photoresistorLessonLed}:K`,'bb:n18',ground]
  ];
  circuit.wires = routes.map(([a,b,color],index)=>({id:`w${index+1}`,a,b,color}));
  return {
    id:photoresistorLessonId,boardId:'bluepill',title:'光敏电阻与暗光报警 · 原生 C',shortTitle:'光敏电阻与暗光报警',
    language:'c',nativeOnly:true,nativeSourceParameter:'DARK_ADC_THRESHOLD',watchPin:photoresistorLessonPin,circuitData:circuit,
    nativeSourceAssets:{'main.c':directory+'main.c','light_policy.h':directory+'light_policy.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载光敏电阻源码。\n'},
    description:'PDV-P8103 与 22 kΩ 电阻构成分压，PA1 采样，PA0 驱动暗光报警灯。',
    setup:[
      '保持环境 20 lx，编译并运行。PA1 约为 2.00 V，ADC1 读数约 2484，高于初始阈值 2000，灯灭。',
      '遮住光敏面。阻值上升，PA1 电压下降，报警灯亮。解除遮光后灯熄灭。',
      '恢复到未遮挡的 20 lx，将 light_policy.h 的 DARK_ADC_THRESHOLD 从 2000 改成 2800，再编译。'
    ],
    learningGoals:[
      '分压接法为 3.3 V → 光敏电阻 → PA1 → 22 kΩ → GND。光变暗时光敏电阻变大，PA1 电压降低。',
      'ADC1 将实际电压量化为 0–4095。程序用采样值与阈值比较，输出到 PA0。',
      '分别验证改变光照和改变程序阈值的效果。'
    ],
    expected:'在未遮挡的 20 lx 下，ADC1 读数保持约 2484。阈值从 2000 提高到 2800 后，PA0 外接报警灯由灭变亮。'
  };
}
