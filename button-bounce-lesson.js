import {createCircuit} from './circuit.js';

const source = `#include "stm32f10x.h"
#include "Delay.h"
#include <stdio.h>

// 0：接受每次电平变化。改成 10：新电平须稳定 10 ms 才接受。
#define DEBOUNCE_MS 0

uint32_t pressCount = 0;
uint8_t sample = 1;
uint8_t stableLevel = 1;

void SendCount(uint32_t count)
{
    char line[16];
    sprintf(line, "%lu\\r\\n", (unsigned long)count);
    for (int i = 0; line[i] != 0; i++)
    {
        while (USART_GetFlagStatus(USART1, USART_FLAG_TXE) == RESET) { }
        USART_SendData(USART1, line[i]);
    }
}

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_GPIOB | RCC_APB2Periph_USART1, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);
    GPIO_ResetBits(GPIOA, GPIO_Pin_0);

    gpio.GPIO_Pin = GPIO_Pin_1;
    gpio.GPIO_Mode = GPIO_Mode_IPU;
    GPIO_Init(GPIOB, &gpio);

    // 默认 USART1 TX 在 PA9。实验台串口监视器接收发送记录。
    gpio.GPIO_Pin = GPIO_Pin_9;
    gpio.GPIO_Mode = GPIO_Mode_AF_PP;
    GPIO_Init(GPIOA, &gpio);
    USART_InitTypeDef serial;
    USART_StructInit(&serial);
    serial.USART_BaudRate = 115200;
    serial.USART_Mode = USART_Mode_Tx;
    USART_Init(USART1, &serial);
    USART_Cmd(USART1, ENABLE);

    uint8_t candidate = 1;
    int stableMs = 0;
    while (1)
    {
        sample = GPIO_ReadInputDataBit(GPIOB, GPIO_Pin_1);
        if (sample != candidate)
        {
            candidate = sample;
            stableMs = 0; // 候选电平改变，从本次读数重新计时。
        }
        else if (stableMs < DEBOUNCE_MS)
        {
            stableMs++;
        }

        if (candidate != stableLevel && stableMs >= DEBOUNCE_MS)
        {
            stableLevel = candidate; // 按下和松开都通过同一稳定判断。
            if (stableLevel == 0)
            {
                pressCount++;
                // 每次确认按下翻转一次外接灯。
                if (pressCount % 2 != 0)
                {
                    GPIO_SetBits(GPIOA, GPIO_Pin_0);
                }
                else
                {
                    GPIO_ResetBits(GPIOA, GPIO_Pin_0);
                }
                SendCount(pressCount);
            }
        }
        Delay_ms(1); // 每轮推进 1 ms 虚拟时间。
    }
}
`;

export function makeButtonBounceLesson() {
  const circuitData = createCircuit('plugged-button');
  circuitData.components.find(part => part.id === 'button1').bounce = true;
  return {
    id:'button-bounce', boardId:'bluepill', language:'stm32-spl', watchPin:'PB1',
    title:'16 · 看按键弹跳，再用代码消抖', shortTitle:'按键弹跳与消抖',
    files:{'main.c':source},
    circuitData,
    description:'在同一按键和接线下，对照原始触点读数、确认按下次数与外接灯。',
    setup:[
      'PB1 用内部上拉，按键闭合时通过面包板接地。PA0 驱动带 330 Ω 限流电阻的外接 LED。',
      '运行原代码，观察 PB1 和串口中的累计次数。每次被程序确认的按下都会翻转一次外接 LED。',
      '将 DEBOUNCE_MS 从 0 改为 10 并应用，再用同一次按压过程比较 PB1 和 pressCount。'
    ],
    learningGoals:[
      '区分机械按压、触点短时间内的反复开合，以及程序确认的按下。',
      '连续稳定 10 ms 后再接受状态，并对按下和松开使用同一规则。'
    ],
    expected:'同一次模拟按压可以在 PB1 产生多次边沿。原程序可能把多个下降沿当成多次按下，消抖后只确认一次。'
  };
}
