import {createCircuit,makePart} from './circuit.js';

const gpioSetup = `#include "stm32f10x.h"
#include "Delay.h"

int main(void) {
    // 让 PA0 成为可主动拉高、拉低的输出。
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);
`;

const diodeCode = `${gpioSetup}
    // PA0 通过面包板给二极管、限流电阻和 LED 供电。
    GPIO_SetBits(GPIOA, GPIO_Pin_0);
    while (1) {
        // 保持高电平，方便比较二极管正接与反接。
        Delay_ms(100);
    }
}
`;

const capacitorCode = `${gpioSetup}
    // PA1 接在电容正极同组，只观察电压。
    gpio.GPIO_Pin = GPIO_Pin_1;
    gpio.GPIO_Mode = GPIO_Mode_AIN;
    GPIO_Init(GPIOA, &gpio);

    while (1) {
        GPIO_SetBits(GPIOA, GPIO_Pin_0);   // 通过 10 kΩ 电阻充电。
        Delay_ms(3000);                  // 等待期间继续观察电容充电。
        GPIO_ResetBits(GPIOA, GPIO_Pin_0); // 经同一个电阻放电。
        Delay_ms(3000);                  // 输出保持低电平，电容放电。
    }
}
`;

const pwmFilterCode = `#include "stm32f10x.h"
#include "Delay.h"

// 保持 100 Hz，把占空比从 25 改为 75，观察电容电压。
#define DUTY_PERCENT 25
// 再试 1000 Hz，比较电容端的纹波大小。
#define PWM_HZ 100
#define PERIOD_TICKS (1000000 / PWM_HZ)

int main(void) {
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;      // TIM2_CH1 → 1 kΩ → 电容正极。
    gpio.GPIO_Mode = GPIO_Mode_AF_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);
    gpio.GPIO_Pin = GPIO_Pin_1;      // PA1 只观察电容电压。
    gpio.GPIO_Mode = GPIO_Mode_AIN;
    GPIO_Init(GPIOA, &gpio);

    TIM_InternalClockConfig(TIM2);
    TIM_TimeBaseInitTypeDef timer;
    TIM_TimeBaseStructInit(&timer);
    timer.TIM_Prescaler = 71;        // 计数时钟 1 MHz，一个计数为 1 µs。
    timer.TIM_Period = PERIOD_TICKS - 1;
    TIM_TimeBaseInit(TIM2, &timer);

    TIM_OCInitTypeDef output;
    TIM_OCStructInit(&output);
    output.TIM_OCMode = TIM_OCMode_PWM1;
    output.TIM_OutputState = TIM_OutputState_Enable;
    output.TIM_OCPolarity = TIM_OCPolarity_High;
    output.TIM_Pulse = PERIOD_TICKS * DUTY_PERCENT / 100;
    TIM_OC1Init(TIM2, &output);
    TIM_Cmd(TIM2, ENABLE);

    while (1) {
        Delay_ms(1000);              // PWM 持续输出，电容不断充放电。
    }
}
`;

function jumper(id,a,b,color='#ea7246') {
  return {id,a,b,color};
}

export function makePassiveBreadboardExercises() {
  const diode = createCircuit('onboard');
  diode.components = [
    {...makePart('diode','d1',1.8,3.8),mount:{hole:'bb:a10',rotation:0}},
    {...makePart('resistor','r1',3.1,3.8),mount:{hole:'bb:c13',rotation:0}},
    {...makePart('led','led1',4.4,3.8),mount:{hole:'bb:a18',rotation:0}}
  ];
  diode.wires = [jumper('w1','mcu:PA0','bb:e10'),jumper('w2','bb:e19','mcu:GND1','#24384a')];

  const capacitor = createCircuit('onboard');
  capacitor.components = [
    {...makePart('resistor','r1',.8,3.8),resistance:10000,mount:{hole:'bb:f9',rotation:0}},
    {...makePart('capacitor','c1',3,3.8),mount:{hole:'bb:h14',rotation:0}}
  ];
  capacitor.wires = [jumper('w1','mcu:PA0','bb:j9'),jumper('w2','mcu:PA1','bb:j14','#8f70d6'),
    jumper('w3','bb:j15','mcu:GND1','#24384a')];
  const pwmFilter = structuredClone(capacitor);
  pwmFilter.components.find(part=>part.type==='resistor').resistance=1000;

  return [{
    id:'plugged-diode',boardId:'bluepill',title:'14 · 翻转二极管，比较导通与截止',shortTitle:'二极管方向',language:'stm32-spl',watchPin:'PA0',
    files:{'main.c':diodeCode},circuitData:diode,
    description:'二极管、限流电阻和 LED 插在同一条支路上。翻转二极管，比较支路电流。',
    setup:['PA0 接 E10。二极管 A 在 A10，色环 K 在 A13。',
      'C13 / C18 的 330 Ω 电阻接到 A18 / A19 的 LED，E19 接 GND。',
      '点「运行」，选中二极管看电流。用「转向」两次预览 180°，确认后看 LED 熄灭。'],
    learningGoals:['辨认玻璃二极管的阴极色环。','用正反两个方向的电流判断导通与截止。'],
    expected:'初始方向 LED 亮。二极管翻转后支路电流接近 0 mA，撤销可恢复。'
  },{
    id:'plugged-rc',boardId:'bluepill',title:'15 · 看电解电容充放电',shortTitle:'电容充放电',language:'stm32-spl',watchPin:'PA1',
    files:{'main.c':capacitorCode},circuitData:capacitor,
    description:'让 PA0 轮流输出高低电平，通过 10 kΩ 电阻给插装电容充放电。在 PA1 看电容电压。',
    setup:['PA0 接 J9，经 F9 / F14 的 10 kΩ 电阻到电容正极 H14。',
      'PA1 接同组 J14。负极条纹对应 H15，J15 接 GND。',
      '点「运行」，观察 PA1 的电压缓慢升降。拔下电容，对比波形边沿。'],
    learningGoals:['用负极条纹确认电容方向。','对照有无电容时的波形，理解电阻与电容共同决定变化速度。'],
    expected:'接有 100 µF 电容时，PA1 电压在每个半周期内逐渐变化。拔下后，PA1 接近 PA0 的方波。'
  },{
    id:'pwm-rc',boardId:'bluepill',title:'18 · 用 RC 平滑 PWM',shortTitle:'PWM 低通滤波',language:'stm32-spl',watchPin:'PA1',
    files:{'main.c':pwmFilterCode},circuitData:pwmFilter,
    description:'对照 PA0 的 PWM、PA1 的当前电压，以及电容端稳态的一周期纹波。',
    setup:['PA0 经 1 kΩ 电阻到电容正极和 PA1。电容负极接地。','运行后把 DUTY_PERCENT 从 25 改成 75，再应用。观察 PA1 从旧电压逐渐升高。','保持占空比，把 PWM_HZ 从 100 改成 1000，再看稳态纹波。'],
    learningGoals:['占空比改变电容端的平均电压。','提高频率会让充放电时间变短，纹波减小。'],
    expected:'理想 3.3 V 输出下，25% 和 75% 占空比分别对应约 0.825 V 和 2.475 V 的稳态均值。'
  }];
}
