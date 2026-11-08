import {makeBoardStarter} from './board-profiles.js';

const nucleo = 'nucleo-f103rb';
export const stm32NativeButtonLessonId = 'nucleo-f103rb:native-button';
export const stm32NativeButtonSourceAssets = Object.freeze({
  'main.c':'./firmware/nucleo-f103rb/native-button/main.c',
  'led_policy.c':'./firmware/nucleo-f103rb/native-button/led_policy.c',
  'led_policy.h':'./firmware/nucleo-f103rb/native-button/led_policy.h',
});

export function makeStm32NativeButtonLesson() {
  return {
    id:stm32NativeButtonLessonId,
    boardId:nucleo,
    title:'B1 控制 LD2 · 多文件 C',
    shortTitle:'B1 与 LD2',
    language:'c',
    nativeOnly:true,
    nativeSourceAssets:stm32NativeButtonSourceAssets,
    watchPin:'PA5',
    files:{'main.c':'// 打开本地 C 工作区后加载三个实验源码文件。\n'},
    circuitData:makeBoardStarter(nucleo,'blink').circuit,
    description:'编译两个 C 文件和一个头文件，用板载 B1 按键控制 LD2。改动头文件，比较同一个按键电平如何得到不同的灯光结果。',
    setup:[
      '打开本地 C 工作区，编译并运行。点击开发板上的蓝色 B1，或使用工作台的 B1 按钮。',
      '打开 led_policy.h，把 LIGHT_WHEN_PRESSED 的值从 1 改为 0，然后重新编译并运行。',
      '再次按下、松开 B1，观察 LD2 和 PA5 电平，并对照 PC13 的输入。'
    ],
    learningGoals:[
      '通过 led_policy.h 共享声明和常量，分别编译 main.c 与 led_policy.c，再链接为一份固件。',
      '用板载上拉和低电平有效的 B1 读取 PC13，通过 PA5 驱动高电平有效的 LD2。',
      '在接线不变时，用同一个按键输入验证两种灯光规则。'
    ],
    expected:'初始固件在 B1 按下时点亮 LD2。把 LIGHT_WHEN_PRESSED 改为 0 后，LD2 在松开时亮，按下时灭。两次 PC13 都是松开为高、按下为低。',
  };
}
