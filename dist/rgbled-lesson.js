import {createCircuit,makePart} from './circuit.js';
import {kingbrightRgbModel} from './rgb-led.js';

export const rgbLedLessonId = 'bluepill:native-rgbled';
export const rgbLedLessonPart = 'rgb1';
export const rgbLedLessonChannels = Object.freeze([
  {channel:'R', pin:'PA0', timerChannel:1, resistor:'rr', resistance:470, color:'#c45253', column:21},
  {channel:'G', pin:'PA1', timerChannel:2, resistor:'rg', resistance:470, color:'#378665', column:20},
  {channel:'B', pin:'PA2', timerChannel:3, resistor:'rb', resistance:220, color:'#5579ca', column:19}
]);
const directory = './firmware/bluepill/native-rgbled/';

export function makeRgbLedLesson() {
  const circuit = createCircuit('blink');
  circuit.board.mount = {column:6, rotation:90};
  circuit.components = [
    {...makePart('rgbled',rgbLedLessonPart,2.65,-4.65),rgbModel:kingbrightRgbModel},
    ...rgbLedLessonChannels.map(({resistor,resistance},index)=>({
      ...makePart('resistor',resistor,4.85-index*1.65,-3.17),resistance
    }))
  ];
  const routes = rgbLedLessonChannels.flatMap(({channel,resistor,color,column})=>[
    [`bb:a${column}`,`${resistor}:1`,color],
    [`${resistor}:2`,`${rgbLedLessonPart}:${channel}`,color]
  ]);
  routes.push([`${rgbLedLessonPart}:COM`,'bb:n17','#3f4751'],['bb:n23','bb:j24','#3f4751']);
  circuit.wires = routes.map(([a,b,color],index)=>({id:`w${index+1}`,a,b,color}));
  return {
    id:rgbLedLessonId,boardId:'bluepill',title:'RGB 三色灯 · 三路 PWM 混色',shortTitle:'RGB 三色灯',
    language:'c',nativeOnly:true,nativeSourceParameter:'BLUE_PWM_PERMILLE',watchPin:'PA2',circuitData:circuit,
    nativeSourceAssets:{'main.c':directory+'main.c','rgb_levels.h':directory+'rgb_levels.h'},
    files:{'main.c':'// 打开本地 C 工作区后加载 RGB 调光源码。\n'},
    description:'用 TIM2 三路硬件 PWM 驱动共阴极 RGB 灯。修改占空比，在同一电路上对照三路电流和混色。',
    setup:[
      '编译并运行。确认红色通道有电流，蓝色通道为 0。',
      '定位关键参数，把 rgb_levels.h 的 BLUE_PWM_PERMILLE 从 0 改为 850，再编译并运行。',
      '查看 PA2 的占空比、蓝色支路平均电流和 3D 灯罩。点通道名称可切换波形。'
    ],
    learningGoals:[
      '按红色、公共阴极、蓝色、绿色识别 Kingbright 灯的 1–4 号脚。每个颜色串独立限流电阻。',
      'TIM2 的 CCR1、CCR2、CCR3 独立控制 PA0、PA1、PA2，三路共用 1 kHz 周期。',
      '在接线不变时，区分引脚占空比、支路实际平均电流和灯罩的视觉混色。'
    ],
    expected:'蓝色占空比从 0% 变为 85%，蓝色支路开始导通。红色占空比仍为 50%，红光与蓝光叠加。'
  };
}
