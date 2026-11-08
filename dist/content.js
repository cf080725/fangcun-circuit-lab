/**
 * STM32 学习台：原创教学内容与标准外设库示例。
 * 目标：STM32F103C8T6，常见 Blue Pill 布局，C 源码行为仿真。
 * 示例不是完整的 Keil 工程；实板工程仍需启动文件、系统时钟配置、
 * ST 标准外设库及对应 Delay.c。板卡丝印和元件规格以实际产品为准。
 * 故障条目是排查知识库；detectable 默认 false，由真正实现的规则决定检测范围。
 */

export const contentVersion = '2026-11-07';

export const sourceLinks = [
  { id: 'hitec-hs55', title: 'Hitec HS-55 官方规格', url: 'https://www.hiteccs.com/public/uploads/data_sheet/HCS_HS-55_Specsheetv2.2_1026-1729887855.pdf', scope: '舵机尺寸、供电范围、控制脉宽、空载速度' },
  { id: 'st-product', title: 'ST 官方：STM32F103C8 产品与规格', url: 'https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8', scope: '芯片资源、供电与外设概览' },
  { id: 'st-datasheet', title: 'ST 官方：STM32F103x8/xB 数据手册', url: 'https://www.st.com.cn/resource/en/datasheet/stm32f103c8.pdf', scope: 'LQFP48 引脚、允许电压与电气特性；英文原文' },
  { id: 'st-reference', title: 'ST 官方：RM0008 参考手册', url: 'https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf', scope: 'RCC、GPIO、定时器、ADC、USART 的硬件行为；英文原文' },
  { id: 'st-documents', title: 'ST 官方：STM32F103 文档入口', url: 'https://www.st.com/en/microcontrollers-microprocessors/stm32f103/documentation.html', scope: '按型号查阅当前手册版本' },
  { id: 'bluepill-schematic', title: '源地工作室 Blue Pill 原始原理图（2016-01-26）', url: 'https://stm32-base.org/assets/pdf/boards/original-schematic-STM32F103C8T6-Blue_Pill.pdf', scope: '特定常见板型的连接关系；原图由 STM32-base 保存，非 ST 官方开发板' },
  { id: 'bluepill-photo', title: 'Blue Pill 实物顶视照片参考', url: 'https://stm32-base.org/assets/img/boards/STM32F103C8T6_Blue_Pill-2.jpg', scope: '核对本平台常见板型的排针顺序；实板版本仍需看丝印' },
  { id: 'jiangxie-faq', title: '江协科技：STM32 疑难解答目录', url: 'https://jiangxiekeji.com/problem.html', scope: '作者课程的故障排查入口；各页有自身更新时间' },
  { id: 'jiangxie-stlink-usb', title: '江协科技：No ST-LINK detected', url: 'https://jiangxiekeji.com/problem/p1-1.html', scope: '电脑识别下载器、设备管理器与驱动检查；2023-04-03 更新' },
  { id: 'jiangxie-stlink-target', title: '江协科技：No target connected', url: 'https://jiangxiekeji.com/problem/p1-2.html', scope: '下载器至目标板的接线、接触与连接恢复；2023-06-26 更新' },
  { id: 'jiangxie-axf', title: '江协科技：Could not load file … .axf', url: 'https://jiangxiekeji.com/problem/p1-3.html', scope: '编译输出尚未生成与下载阶段的区别；2023-06-26 更新' },
  { id: 'jiangxie-oled', title: '江协科技：OLED 显示屏不显示', url: 'https://jiangxiekeji.com/problem/p1-7.html', scope: '用配套示例交叉检查程序、供电与插接；2023-06-26 更新' },
  { id: 'jiangxie-compiler', title: '江协科技：编译器版本与 __INLINE 等报错', url: 'https://jiangxiekeji.com/problem/p1-14.html', scope: '该旧版课程工程的 Arm Compiler 5.06 配置提示；2023-06-30 更新' },
  { id: 'jiangxie-encoding', title: '江协科技：Keil 中文乱码与文件编码', url: 'https://jiangxiekeji.com/problem/px-1.html', scope: 'UTF-8/GB2312 读取方式与文件实际编码的区别；2024-06-08 更新' },
  { id: 'arm-ac5-ac6', title: 'Arm 官方：从 Arm Compiler 5 迁移到 6', url: 'https://support.arm.com/documentation/dui0742/j/migrating-from-arm-compiler-5-to-arm-compiler-6/migration-overview', scope: 'AC5/AC6 的命令选项、语言和编译器扩展差异；迁移不等于只切换下拉框' },
  { id: 'st-connect-reset', title: 'ST 官方：STM32CubeProgrammer 连接与复位方式', url: 'https://dev.st.com/stm32cube-docs/prog/2.23.0/en/docs/markup/CubeProg_UserManual/Main_window.html', scope: 'SWD、Connect under reset 与 NRST 硬件连接要求' }
];

export const boardReference = {
  name: '常见 STM32F103C8T6 Blue Pill',
  orientation: 'USB 接口朝上，芯片正面朝向你；从上往下读两排引脚。',
  left: ['PB12','PB13','PB14','PB15','PA8','PA9','PA10','PA11','PA12','PA15','PB3','PB4','PB5','PB6','PB7','PB8','PB9','5V','GND','3V3'],
  right: ['GND','GND','3V3','NRST','PB11','PB10','PB1','PB0','PA7','PA6','PA5','PA4','PA3','PA2','PA1','PA0','PC15','PC14','PC13','VBAT'],
  led: { pin: 'PC13', activeLevel: 0, seriesOhms: 510, note: '参考板电流路径：3V3 → 限流电阻 → LED → PC13；输出低电平时灌电流点亮。' },
  warning: 'Blue Pill 是常见板型名称。稳压器、USB 接口和丝印等会因厂家及批次变化；本模型不代表所有板卡。'
};

export const examples = [
  {
    id: 'blink', title: '01 · 让外接 LED 一亮一灭', shortTitle: 'LED 闪烁', difficulty: '入门', circuitPreset: 'blink',
    description: '先只观察 PA0：输出高电平点亮外接红灯，等待半秒，再输出低电平熄灭。',
    setup: ['PA0 → 330Ω 电阻 → LED 的 A（正极）。', 'LED 的 K（负极）→ GND。', '先运行，再把两个 Delay_ms(500) 改成 1000，观察节奏。'],
    learningGoals: ['分清“引脚输出电平”和“灯是否点亮”。', '知道 Delay_ms 的数字控制等待时间。'],
    expected: 'PA0 高 500 ms、低 500 ms；一个完整周期为 1000 ms，即约每秒闪一轮。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    while (1)
    {
        GPIO_SetBits(GPIOA, GPIO_Pin_0);   // PA0 输出高电平
        Delay_ms(500);                    // 保持半秒
        GPIO_ResetBits(GPIOA, GPIO_Pin_0); // PA0 输出低电平
        Delay_ms(500);
    }
}
`}
  },
  {
    id: 'onboard', title: '02 · 为什么板载灯低电平才亮', shortTitle: '板载灯', difficulty: '入门', circuitPreset: 'onboard',
    description: '观察 PC13 板载灯。这里的连接方向决定：清零点亮，置一熄灭。',
    setup: ['无需外接 LED，本平台板载灯连接到 PC13。', '观察 PC13=0 时的灯光，再与 PA0 外接灯比较。', '实体板要先核对自己的板载 LED 是否连接到 PC13。'],
    learningGoals: ['理解低电平有效。', '知道 GPIO_ResetBits 并不是让所有灯都熄灭。'],
    expected: 'PC13 低 500 ms 时板载灯亮，高 500 ms 时板载灯灭。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOC, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_13;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOC, &gpio);

    while (1)
    {
        GPIO_ResetBits(GPIOC, GPIO_Pin_13); // PC13 拉低，板载灯亮
        Delay_ms(500);
        GPIO_SetBits(GPIOC, GPIO_Pin_13);   // PC13 拉高，板载灯灭
        Delay_ms(500);
    }
}
`}
  },
  {
    id: 'traffic', title: '03 · 三盏灯依次接力', shortTitle: '三灯接力', difficulty: '入门', circuitPreset: 'traffic',
    description: '用 PA0、PA1、PA2 分别控制三盏 LED，学会同时配置几个引脚。',
    setup: ['PA0、PA1、PA2 各接一只串联电阻与 LED，再接 GND。', '每个 LED 支路分别使用 330Ω 电阻。', '可以改变三个 Delay_ms 的数值，让每盏灯停留不同时间。'],
    learningGoals: ['用按位或 | 同时选中多个引脚。', '看清程序执行顺序与灯光顺序的对应。'],
    expected: '红、黄、绿三灯每隔 400 ms 依次点亮，一次只亮一盏。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0 | GPIO_Pin_1 | GPIO_Pin_2;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    while (1)
    {
        GPIO_ResetBits(GPIOA, GPIO_Pin_0 | GPIO_Pin_1 | GPIO_Pin_2);
        GPIO_SetBits(GPIOA, GPIO_Pin_0);
        Delay_ms(400);

        GPIO_ResetBits(GPIOA, GPIO_Pin_0);
        GPIO_SetBits(GPIOA, GPIO_Pin_1);
        Delay_ms(400);

        GPIO_ResetBits(GPIOA, GPIO_Pin_1);
        GPIO_SetBits(GPIOA, GPIO_Pin_2);
        Delay_ms(400);
    }
}
`}
  },
  {
    id: 'button', title: '04 · 按住按钮，点亮 LED', shortTitle: '按钮输入', difficulty: '入门+', circuitPreset: 'button',
    description: 'PB1 使用上拉输入。松手读到 1，按钮接地后读到 0。',
    setup: ['PB1 → 按钮的一侧，按钮另一侧 → GND。', 'PA0 → 330Ω 电阻 → LED A，LED K → GND。', '运行后按住画面中的按钮；松手后 LED 熄灭。'],
    learningGoals: ['分清输入模式与输出模式。', '理解上拉输入下按键按下读 0。'],
    expected: '按钮松开时 PB1=1；按下时 PB1=0，PA0 外接灯点亮。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_GPIOB, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    gpio.GPIO_Pin = GPIO_Pin_1;
    gpio.GPIO_Mode = GPIO_Mode_IPU;
    GPIO_Init(GPIOB, &gpio);

    while (1)
    {
        if (GPIO_ReadInputDataBit(GPIOB, GPIO_Pin_1) == 0)
        {
            GPIO_SetBits(GPIOA, GPIO_Pin_0);
        }
        else
        {
            GPIO_ResetBits(GPIOA, GPIO_Pin_0);
        }
        Delay_ms(10); // 每隔 10 ms 再看一次按钮；这不是完整的按键消抖算法
    }
}
`}
  },
  {
    id: 'pwm', title: '05 · 用 PWM 做呼吸灯', shortTitle: 'PWM 呼吸', difficulty: '进阶入门', circuitPreset: 'pwm',
    description: 'TIM2_CH1 从 PA0 输出 PWM。改变一个周期内亮的比例，让 LED 看起来逐渐变亮、变暗。',
    setup: ['PA0 → 330Ω 电阻 → LED A，LED K → GND。', '本例采用 TIM2 时钟为 72 MHz 的教学时钟配置。', 'PSC=71、ARR=999 时频率为 1 kHz；CCR 从 0 变到 1000。'],
    learningGoals: ['区分频率与占空比。', '认识 TIM_SetCompare1 如何改变高电平所占比例。'],
    expected: 'LED 约用 1 秒渐亮、再用 1 秒渐暗；波形窗口可观察占空比变化。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int brightness = 0;

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_AF_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    TIM_InternalClockConfig(TIM2);
    TIM_TimeBaseInitTypeDef timer;
    timer.TIM_Prescaler = 71;
    timer.TIM_Period = 999;
    timer.TIM_CounterMode = TIM_CounterMode_Up;
    timer.TIM_ClockDivision = TIM_CKD_DIV1;
    timer.TIM_RepetitionCounter = 0;
    TIM_TimeBaseInit(TIM2, &timer);

    TIM_OCInitTypeDef output;
    TIM_OCStructInit(&output);
    output.TIM_OCMode = TIM_OCMode_PWM1;
    output.TIM_OutputState = TIM_OutputState_Enable;
    output.TIM_OCPolarity = TIM_OCPolarity_High;
    output.TIM_Pulse = 0;
    TIM_OC1Init(TIM2, &output);
    TIM_OC1PreloadConfig(TIM2, TIM_OCPreload_Enable);
    TIM_ARRPreloadConfig(TIM2, ENABLE);
    TIM_Cmd(TIM2, ENABLE);

    while (1)
    {
        for (brightness = 0; brightness <= 1000; brightness += 20)
        {
            TIM_SetCompare1(TIM2, brightness);
            Delay_ms(20);
        }
        for (brightness = 1000; brightness >= 0; brightness -= 20)
        {
            TIM_SetCompare1(TIM2, brightness);
            Delay_ms(20);
        }
    }
}
`}
  },
  {
    id: 'adc', title: '06 · 旋钮变成一个数字', shortTitle: 'ADC 旋钮', difficulty: '进阶入门', circuitPreset: 'adc',
    description: '电位器中间脚接 PA1，ADC 把电压换成 0～4095 的整数；超过中间值时点亮 LED。',
    setup: ['电位器两端分别接 3V3 和 GND，中间滑动端接 PA1。', 'PA0 → 330Ω 电阻 → LED A，LED K → GND。', '旋转电位器，观察变量 adcValue；本例参考电压按 3.3 V 处理。'],
    learningGoals: ['认识模拟电压与数字量。', '知道阈值判断如何把连续变化转换成开灯动作。'],
    expected: '旋钮越接近 3V3 端，adcValue 越接近 4095；大于 2048 时 PA0 灯亮。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

uint16_t adcValue = 0;

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_ADC1, ENABLE);
    RCC_ADCCLKConfig(RCC_PCLK2_Div6);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_1;
    gpio.GPIO_Mode = GPIO_Mode_AIN;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    GPIO_Init(GPIOA, &gpio);

    ADC_InitTypeDef adc;
    adc.ADC_Mode = ADC_Mode_Independent;
    adc.ADC_ScanConvMode = DISABLE;
    adc.ADC_ContinuousConvMode = DISABLE;
    adc.ADC_ExternalTrigConv = ADC_ExternalTrigConv_None;
    adc.ADC_DataAlign = ADC_DataAlign_Right;
    adc.ADC_NbrOfChannel = 1;
    ADC_Init(ADC1, &adc);
    ADC_RegularChannelConfig(ADC1, ADC_Channel_1, 1, ADC_SampleTime_55Cycles5);
    ADC_Cmd(ADC1, ENABLE);
    Delay_ms(1);
    ADC_ResetCalibration(ADC1);
    while (ADC_GetResetCalibrationStatus(ADC1)) { }
    ADC_StartCalibration(ADC1);
    while (ADC_GetCalibrationStatus(ADC1)) { }

    while (1)
    {
        ADC_SoftwareStartConvCmd(ADC1, ENABLE);
        while (ADC_GetFlagStatus(ADC1, ADC_FLAG_EOC) == RESET) { }
        adcValue = ADC_GetConversionValue(ADC1);

        if (adcValue > 2048)
        {
            GPIO_SetBits(GPIOA, GPIO_Pin_0);
        }
        else
        {
            GPIO_ResetBits(GPIOA, GPIO_Pin_0);
        }
        Delay_ms(50);
    }
}
`}
  },
  {
    id: 'uart', title: '07 · 让 STM32 发消息', shortTitle: '串口收发', difficulty: '进阶入门', circuitPreset: 'uart',
    description: 'USART1 先发送 OK，再把收到的字节原样发回。先看字符流，再逐步学习通信协议。',
    setup: ['本平台串口监视器连接 USART1；实板常用 PA9(TX) 接转换器 RX、PA10(RX) 接转换器 TX，并共地。', '设置 9600 波特率、8 数据位、无校验、1 停止位。', '在串口输入框发一个字符，观察回显。实体设备请使用兼容 3.3 V 逻辑的接口。'],
    learningGoals: ['分清 TX 发、RX 收。', '理解发送一个字符和发送一个整数数值不是同一件事。'],
    expected: '启动后显示 OK；输入的字节在程序读取后被原样发送回来。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

uint16_t receivedByte = 0;

void SendChar(uint16_t value)
{
    while (USART_GetFlagStatus(USART1, USART_FLAG_TXE) == RESET) { }
    USART_SendData(USART1, value);
}

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA | RCC_APB2Periph_USART1, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_9;
    gpio.GPIO_Mode = GPIO_Mode_AF_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);
    gpio.GPIO_Pin = GPIO_Pin_10;
    gpio.GPIO_Mode = GPIO_Mode_IN_FLOATING;
    GPIO_Init(GPIOA, &gpio);

    USART_InitTypeDef serial;
    serial.USART_BaudRate = 9600;
    serial.USART_WordLength = USART_WordLength_8b;
    serial.USART_StopBits = USART_StopBits_1;
    serial.USART_Parity = USART_Parity_No;
    serial.USART_HardwareFlowControl = USART_HardwareFlowControl_None;
    serial.USART_Mode = USART_Mode_Tx | USART_Mode_Rx;
    USART_Init(USART1, &serial);
    USART_Cmd(USART1, ENABLE);

    SendChar('O');
    SendChar('K');
    SendChar(13);
    SendChar(10);

    while (1)
    {
        if (USART_GetFlagStatus(USART1, USART_FLAG_RXNE) == SET)
        {
            receivedByte = USART_ReceiveData(USART1);
            SendChar(receivedByte);
        }
        Delay_ms(5);
    }
}
`}
  },
  {
    id: 'multifile', title: '08 · 把点灯代码整理成自己的库', shortTitle: '多文件工程', difficulty: '入门+', circuitPreset: 'blink',
    description: 'main.c 负责安排动作，LED.c 负责怎么操作引脚，LED.h 告诉其他文件有哪些可用函数。',
    setup: ['接线与 PA0 外接 LED 示例相同。', '分别打开 main.c、LED.c、LED.h，看同一件事情被怎样分工。', '只改 main.c 中的等待时间，观察不用修改驱动也能改变闪烁节奏。'],
    learningGoals: ['分清函数声明与函数实现。', '理解 .h 文件与 .c 文件的协作。'],
    expected: 'LED 亮 200 ms，灭 800 ms；LED_On/Off 最终仍调用 GPIO 库函数。',
    files: {
      'main.c': `#include "stm32f10x.h"
#include "Delay.h"
#include "LED.h"

int main(void)
{
    LED_Init();
    while (1)
    {
        LED_On();
        Delay_ms(200);
        LED_Off();
        Delay_ms(800);
    }
}
`,
      'LED.h': `#ifndef LED_H
#define LED_H

void LED_Init(void);
void LED_On(void);
void LED_Off(void);

#endif
`,
      'LED.c': `#include "stm32f10x.h"
#include "LED.h"

void LED_Init(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);
    GPIO_ResetBits(GPIOA, GPIO_Pin_0);
}

void LED_On(void)
{
    GPIO_SetBits(GPIOA, GPIO_Pin_0);
}

void LED_Off(void)
{
    GPIO_ResetBits(GPIOA, GPIO_Pin_0);
}
`
    }
  }
];

examples.push(
  {
    id: 'buzzer', title: '09 · 让有源蜂鸣器间歇提示', shortTitle: '蜂鸣提示', difficulty: '入门+', circuitPreset: 'buzzer',
    description: 'PA0 高 200ms、低 800ms，控制教学蜂鸣器模型的通断。可以先观察状态，再按需打开声音。',
    setup: ['本模型接线：PA0 → 蜂鸣器 +，蜂鸣器 − → GND。', '此处把蜂鸣器等效为 1kΩ 小负载。真实蜂鸣器不能据此默认由 GPIO 直接供电；应按额定电流配置三极管/MOSFET 等驱动。', '有源蜂鸣器的音调由内部振荡器决定，本例 GPIO 控制的是响/停节奏。'],
    learningGoals: ['把已会的 GPIO 闪烁迁移为通断提示。', '区分有源蜂鸣器通断与无源蜂鸣器音调激励。'],
    expected: '模型每秒开启 200ms、关闭 800ms；只有主动开启声音后才播放提示音。',
    modelNote: '1kΩ 等效负载，只模拟通断和提示音；不表示真实蜂鸣器的电流、声压或频谱。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    // 本平台用 1kΩ 等效小负载。真实蜂鸣器需核对电流并配置驱动。
    while (1)
    {
        GPIO_SetBits(GPIOA, GPIO_Pin_0);
        Delay_ms(200);
        GPIO_ResetBits(GPIOA, GPIO_Pin_0);
        Delay_ms(800);
    }
}
`}
  },
  {
    id: 'servo', title: '10 · 用脉冲宽度安排舵机位置', shortTitle: '舵机位置', difficulty: '进阶入门', circuitPreset: 'servo',
    description: 'PA0 输出 50Hz PWM，将有效脉宽依次设为 1ms、1.5ms、2ms。观察本模型的三个目标角度。',
    setup: ['信号 SIG 接 PA0；舵机 VCC 接模型 5V，GND 与开发板共地。', '本平台 5V 是理想电源。实体舵机需要足够供电能力，不能从 GPIO 取动力电源；信号线只负责控制。', '本模型把 1ms/1.5ms/2ms 映射到 0°/90°/180°。真实舵机的脉宽、角度范围和机械限位需按型号校准。'],
    learningGoals: ['区分 20ms 总周期和 1～2ms 有效脉宽。', '理解控制信号与动力供电各自的作用。'],
    expected: 'TIM2_CH1 保持 50Hz；每隔约 1 秒切换到模型的 0°、90°、180°目标位置。',
    modelNote: '不模拟负载力矩、惯性、堵转电流、齿隙及真实机械行程。',
    files: {'main.c': `#include "stm32f10x.h"
#include "Delay.h"

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;
    gpio.GPIO_Mode = GPIO_Mode_AF_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    TIM_InternalClockConfig(TIM2);
    TIM_TimeBaseInitTypeDef timer;
    timer.TIM_Prescaler = 71;          // 72MHz / 72 = 1MHz，即每个计数为 1us
    timer.TIM_Period = 19999;         // 20000 个计数 = 20ms，即 50Hz
    timer.TIM_CounterMode = TIM_CounterMode_Up;
    timer.TIM_ClockDivision = TIM_CKD_DIV1;
    timer.TIM_RepetitionCounter = 0;
    TIM_TimeBaseInit(TIM2, &timer);

    TIM_OCInitTypeDef output;
    TIM_OCStructInit(&output);
    output.TIM_OCMode = TIM_OCMode_PWM1;
    output.TIM_OutputState = TIM_OutputState_Enable;
    output.TIM_OCPolarity = TIM_OCPolarity_High;
    output.TIM_Pulse = 1000;
    TIM_OC1Init(TIM2, &output);
    TIM_Cmd(TIM2, ENABLE);

    while (1)
    {
        TIM_SetCompare1(TIM2, 1000);   // 1ms：本模型目标 0 度
        Delay_ms(1000);
        TIM_SetCompare1(TIM2, 1500);   // 1.5ms：本模型目标 90 度
        Delay_ms(1000);
        TIM_SetCompare1(TIM2, 2000);   // 2ms：本模型目标 180 度
        Delay_ms(1000);
    }
}
`}
  },
  {
    id:'servo-hs55', title:'17 · 改脉宽，让 HS-55 舵臂转到新位置', shortTitle:'HS-55 舵臂跟随', difficulty:'进阶入门', circuitPreset:'servo-hs55',
    description:'把 PA0 的脉宽由 1200 µs 改到 1800 µs，比较控制目标和舵臂实际到达的角度。',
    setup:['信号 SIG 接 PA0。舵机使用实验台的 5 V 电源，与 Blue Pill 共地。','运行到舵臂停稳，记录脉宽和相对中位的角度。','找到 COMMAND_US，把 1200 改成 1800，再应用。观察舵臂从原位置转过去。'],
    learningGoals:['保持 50 Hz 周期不变，用脉宽设定位置。','目标角随脉宽更新，轴臂以有限速度移动。'],
    expected:'1200 µs 和 1800 µs 分别对应相对中位的 −30° 和 +30°。本实验的空载模型逐步到达目标。',
    modelNote:'按 HS-55 标称脉宽、行程和空载速度建模。供电采用理想轨，速度按电压线性插值。',
    files:{'main.c':`#include "stm32f10x.h"
#include "Delay.h"

// 1500 µs 是中位。试着将 1200 改成 1800，再应用代码。
#define COMMAND_US 1200

int main(void)
{
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE);

    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = GPIO_Pin_0;  // PA0 是 TIM2_CH1，接舵机 SIG。
    gpio.GPIO_Mode = GPIO_Mode_AF_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    TIM_InternalClockConfig(TIM2);
    TIM_TimeBaseInitTypeDef timer;
    TIM_TimeBaseStructInit(&timer);
    timer.TIM_Prescaler = 71;    // 72 MHz 分频到 1 MHz，每计数 1 µs。
    timer.TIM_Period = 19999;    // 20000 µs 一周期，频率为 50 Hz。
    TIM_TimeBaseInit(TIM2, &timer);

    TIM_OCInitTypeDef output;
    TIM_OCStructInit(&output);
    output.TIM_OCMode = TIM_OCMode_PWM1;
    output.TIM_OutputState = TIM_OutputState_Enable;
    output.TIM_OCPolarity = TIM_OCPolarity_High;
    output.TIM_Pulse = COMMAND_US;
    TIM_OC1Init(TIM2, &output);
    TIM_Cmd(TIM2, ENABLE);

    while (1) {
        // CPU 等待时，定时器仍持续输出 PWM，舵臂继续转动。
        Delay_ms(1000);
    }
}
`}
  }
);

const fault = (id, title, category, trigger, plain, technical, why, steps, severity = 'warning') => ({
  id, title, category, trigger, plain, technical, why, steps, severity,
  detectable: false,
  coverage: '排查知识；是否能自动检测，以当前仿真引擎已实现的规则为准。'
});

export const faultCatalog = [
  fault('power_off', '开发板没有获得电源', '供电', 'power-off',
    '先别改代码：板子要先通电，芯片才有可能执行。',
    '检查模型的供电开关及 3V3/GND 电源网络。实体板还需测量稳压器输入、输出和 NRST 状态。',
    '编译成功只说明代码可以被处理，不代表芯片已经获得工作电压。',
    ['打开仿真电源。', '查看板上电源灯和 3V3 对 GND 的电压。', '供电正常后重新运行。'], 'error'),
  fault('common_ground', '信号双方缺少共同的地', '供电', 'missing-ground',
    '两个设备说“高”或“低”，要用同一个零点作参照。',
    '非隔离信号连接通常需要共同参考地；缺少 GND 回路会使电平判断和电流回路不成立。',
    '一根信号线并不自动把两套电源的参考点连在一起。',
    ['找到开发板 GND。', '把相关模块的 GND 接到同一地网络。', '再次测量信号相对开发板 GND 的电压。']),
  fault('supply_reverse', '电源正负端接反', '供电', 'reversed-supply',
    '电源的正端和地接到了对方的位置。',
    '反向供电超出芯片和多数模块的正常使用条件；仿真提示不代表已模拟真实损坏过程。',
    '排针方向、面包板颜色或接线习惯都不能代替引脚标识。',
    ['停止供电。', '按 3V3、5V、GND 的文字逐个核对。', '纠正连接后再通电。'], 'error'),
  fault('supply_range', '3V3 网络电压超出范围', '供电', 'supply-out-of-range',
    '标着 3V3 的位置不能直接当成 5V 输入。',
    'STM32F103 芯片 VDD 的正常工作范围为 2.0～3.6 V；开发板 5V 输入与稳压后的 3V3 网络是不同节点。',
    '板上有一个 5V 引脚，不表示所有引脚都可以接 5V。',
    ['确认电源接在 5V 输入还是 3V3 网络。', '用电压表检查 3V3 对 GND。', '将供电调整到所选接口允许的范围。'], 'error'),
  fault('power_short', '电源与地直接短接', '供电', 'power-short',
    '电流绕过用电元件，直接从电源走回地了。',
    '同一导线网络同时连接理想电源正端与 GND，构成供电短路。',
    '导线或面包板内部金属条把两个本应分开的网络接在一起。',
    ['先停电。', '高亮查看电源和 GND 的连通网络。', '删掉误接的导线，或把元件移到正确孔位。'], 'error'),

  fault('led_reverse', 'LED 的方向接反', '接线', 'led-reversed',
    'LED 像有方向的门，正向才容易流过电流并发光。',
    'LED 阳极 A 应比阴极 K 高出足够的正向压降；反向工作不属于正常点亮条件。',
    '只看塑料外壳颜色无法判断方向，长短脚被剪过后也可能不可靠。',
    ['停止运行，找到 A/K 标记。', '高有效示例中让 A 通过电阻接 GPIO，K 接 GND。', '重新运行并检查电流方向。']),
  fault('led_no_resistor', 'LED 支路没有串联限流电阻', '接线', 'led-no-resistor',
    '灯需要一只电阻来限制电流，不能只靠导线直接接。',
    'LED 是非线性器件，不能按固定阻值负载处理。串联电阻帮助限制工作电流。',
    '电阻接在灯旁边并不等于已串联；它必须位于同一电流路径上。',
    ['检查从 GPIO 到 LED 再到 GND 的路径。', '把 330Ω 电阻串入这条路径。', '查看电流估算，再按实际 LED 数据调整。'], 'error'),
  fault('resistor_low', 'LED 支路电流超过模型上限', '接线', 'resistor-too-small',
    '流过灯的电流过大。限流电阻过小是需要检查的一种原因。',
    '可用 I≈(V驱动−VLED)/R 估算工作电流，再与 LED 和 GPIO 的允许条件比较。',
    '“更亮”不能作为无限减小电阻的理由；GPIO 也不是电源模块。',
    ['核对电阻单位，区分 Ω、kΩ。', '按电压和 LED 正向压降估算电流。', '先用示例的 330Ω，再根据器件规格调整。']),
  fault('resistor_high', 'LED 电流很小，可能电阻偏大', '接线', 'resistor-too-large',
    '电流太小，灯可能只有很弱的亮度。',
    '串联电阻增大会减少 LED 电流；可见亮度还受 LED 型号与人眼感知影响。',
    '把 330Ω 看成 330kΩ，会让电流大幅减小。',
    ['查看电阻属性和色环。', '将数值改回示例的 330Ω。', '同时确认引脚确实在输出有效电平。']),
  fault('led_open', 'LED 至少一端没有连接导线', '接线', 'led-open',
    '灯的一只脚还没有接上，电流没有完整的路可以走。',
    '当前自动规则检查 LED 端子是否接入导线；实体器件内部开路、整条支路的全部断点仍需进一步排查。',
    '元件画在附近，并不表示引脚已经电连接。',
    ['高亮 LED 两端各自连接的网络。', '检查每段导线的实际端点。', '实体排查时断电后使用合适的二极管测试档。']),
  fault('led_short', 'LED 被导线绕过或短接', '接线', 'led-shorted',
    '电流走了旁边的近路，没有经过灯。',
    'LED 两端被低阻连接旁路，导致其端电压接近零。',
    '两只脚插在同一条内部连通的面包板金属条上，会形成旁路。',
    ['查看 LED 两端是否属于同一网络。', '移走短接导线，或调整脚位。', '检查电阻也没有被旁路。']),
  fault('wire_open', '导线有一端没有接到引脚', '接线', 'wire-disconnected',
    '线看起来碰到了元件，但端点还没有落在接线点上。',
    '视觉交叉不等于电气连接；仿真以端点绑定的端子为准。',
    '拖动元件、误点端点或只画出半根线，都可能留下悬空连接。',
    ['点击导线查看两端名称。', '把悬空端重新连到正确端子。', '使用网络高亮确认连接。']),
  fault('breadboard_row', '面包板孔位理解错了', '接线', 'breadboard-wrong-row',
    '面包板下面藏着金属条，有些孔相通，有些不通。',
    '本模型中，同排 A～E 为一组，F～J 为另一组；中央沟槽隔开两侧。实际面包板需按结构核对。',
    '把相邻孔都当成相通，或把同排两侧当成相通，会产生断路或短路。',
    ['开启面包板连通高亮。', '查看两只脚所在的网络是否符合预期。', '需要跨越中央沟槽时使用导线。']),
  fault('rail_split', '面包板电源轨中间断开', '接线', 'breadboard-split-rail',
    '有些长电源轨在中间分成两段，颜色线看着连续也不保证导通。',
    '电源轨连通方式取决于面包板型号；不能由红蓝印刷线推断电气连续性。',
    '只给上半段供电，下半段的元件可能仍没有电源。',
    ['查看当前模型的电源轨连通显示。', '实体板断电后测通断。', '确有分段且需要连通时，增加跨接线。']),
  fault('led_same_node', 'LED 两端位于同一个电气节点', '接线', 'same-node',
    '灯的两头电压一样，就没有推动电流通过它的电压差。',
    '两个端子属于同一网络，LED 端电压为零；这与整个板子是否通电是两回事。',
    '常见于 LED 两脚插在同排连通孔中，或误连到同一引脚。',
    ['分别高亮 A 和 K 的网络。', '如果完全相同，移开其中一脚。', '重新建立 GPIO→电阻→LED→GND 路径。']),

  fault('gpio_clock', '没有打开对应 GPIO 的时钟', 'GPIO', 'gpio-clock-disabled',
    '你准备让这个端口工作，却还没有打开它的工作节拍。',
    'STM32F1 的 GPIO 外设寄存器访问需要对应 APB2 外设时钟；GPIOA、GPIOB、GPIOC 的时钟分别使能。',
    '打开 GPIOA 时钟，不会顺便打开 GPIOB。时钟使能也不等同于给芯片供电。',
    ['核对接线用的是 A、B 还是 C 端口。', '在 GPIO_Init 前调用对应 RCC_APB2PeriphClockCmd。', '重新从程序开头运行。']),
  fault('gpio_uninitialized', '引脚还没有完成初始化', 'GPIO', 'gpio-uninitialized',
    '要先告诉引脚“你负责输入还是输出”，再让它工作。',
    '应设置 GPIO_InitTypeDef 各必要字段并调用 GPIO_Init。复位状态不能代替应用所需配置。',
    '写了 gpio.GPIO_Mode 只是修改配置变量，尚未把配置应用到硬件。',
    ['检查是否填写 Pin、Mode 和 Speed。', '确认执行了 GPIO_Init(GPIOx, &gpio)。', '看引脚面板中的实际模式。']),
  fault('gpio_wrong_mode', '把输入模式当成输出来用', 'GPIO', 'gpio-not-output',
    '引脚现在只负责看电平，不能按你的设想主动推高或拉低。',
    '输入模式关闭输出驱动。GPIO_SetBits/ResetBits 修改输出锁存值，并不等价于把输入引脚改成推挽输出。',
    '函数名里有 Set，不表示它能替代模式配置。',
    ['如果任务是点灯，把对应引脚设置为 GPIO_Mode_Out_PP。', '如果任务是按钮，保持输入模式并检查外部接线。', '重新初始化后再观察。']),
  fault('gpio_wrong_pin', '代码控制的引脚与接线不一致', 'GPIO', 'wrong-pin',
    '代码在操作 PA0，灯却接在了别的地方。',
    '端口和引脚号共同确定 GPIO；GPIOA + GPIO_Pin_0 与 GPIOB + GPIO_Pin_0 不是同一个端子。',
    'A0/B0、0/字母O、物理脚号/逻辑引脚名容易混淆。',
    ['点击导线读取板端的完整名称。', '逐项比对 GPIOA/B/C 和 GPIO_Pin_n。', '把接线或代码统一到同一个引脚。']),
  fault('gpio_contention', '两个推挽输出在互相对抗', 'GPIO', 'output-contention',
    '一边用力拉高，另一边用力拉低，却被一根线接在一起。',
    '两个强驱动输出在同一网络输出相反电平，会造成总线争用和过大电流。',
    '输出端不能像两根普通输入线一样随意并联。',
    ['停止运行。', '找出同一网络上的全部输出源。', '重新分配输入/输出方向；需要共享总线时按接口规范设计。'], 'error'),
  fault('gpio_short_ground', '输出高电平的引脚直接接地', 'GPIO', 'output-short-to-ground',
    '引脚想拉高，导线却把它直接按在地上。',
    '推挽高电平输出与 GND 形成低阻冲突，可能超出 GPIO 驱动能力。',
    '按钮若接在推挽输出和 GND 之间，按下时也可能形成这种短路。',
    ['停止运行并查看该网络。', '按钮读取应使用适当输入模式。', '负载按要求加入限流或驱动电路。'], 'error'),
  fault('open_drain_pullup', '开漏输出缺少上拉', 'GPIO', 'open-drain-no-pullup',
    '开漏会主动拉低；放手以后，需要别的电路把线拉高。',
    '开漏输出写 1 表示释放输出，不是主动输出高电平。网络需要适当上拉才能得到稳定高电平。',
    '把开漏当成推挽使用，容易出现“写 1 仍没变高”。',
    ['确认是否确实需要开漏。', '按接口和电压要求添加上拉电阻。', '或在普通 LED 输出任务中改用推挽模式。']),
  fault('input_floating', '输入脚悬空，读数没有稳定依据', 'GPIO', 'floating-input',
    '这根线既没有人拉高，也没有人拉低，读到什么就不可靠。',
    '悬空输入没有确定的外部驱动或上拉/下拉。实体环境下可能受噪声和漏电影响。',
    '模拟器显示某个 0 或 1，不代表真实悬空引脚也会稳定保持它。',
    ['给输入接上明确的信号源。', '按钮接地的场景可选择 GPIO_Mode_IPU。', '确认松手和按下时都有明确电平。']),
  fault('button_active_low', '上拉按键的判断条件反了', 'GPIO', 'button-polarity',
    '这个接法里，按下是 0，松开是 1。',
    '上拉输入通过按钮连接 GND 时，按下状态为低电平有效。',
    '直觉上的“按下=1”不一定与电路连接一致。',
    ['先在引脚面板观察按下/松开读数。', '本例按下判断使用 == 0。', '若改变接法，重新判断有效电平。']),
  fault('button_bounce', '一次按键被识别成多次', 'GPIO', 'button-bounce',
    '真实金属触点合上的瞬间可能抖几下，程序就像看见按了好几次。',
    '机械按键存在接触抖动；边沿计数或状态切换通常需要消抖和状态管理。',
    '每轮 Delay_ms(10) 并不自动构成可靠的完整消抖算法。',
    ['区分“按住点亮”和“按一次切换”的需求。', '加入稳定时间判断或状态机。', '实体测试按下和松开两个边沿。']),
  fault('pc13_current', 'PC13 等引脚的驱动条件超限', 'GPIO', 'pc13-drive-limit',
    'PC13 能控制板载灯，但它不是可以随便带大负载的输出口。',
    'STM32F103 数据手册对 PC13～PC15 的输出电流、速度和负载有额外约束；应按该系列具体电气条件设计。',
    '同属 GPIO，不表示每个引脚的驱动能力都完全相同。',
    ['参考本板的低电平灌电流 LED 接法。', '不要把电机、舵机电源直接挂到 PC13。', '需要更大电流时使用合适的驱动级并核对器件规格。']),
  fault('jtag_pin', '调试功能占用了某些引脚', 'GPIO', 'debug-pin-conflict',
    '这个脚可能正被调试接口使用，还没有交给普通 GPIO。',
    'STM32F1 的部分引脚复位后分配给 JTAG/SWD。使用相关引脚前需了解 AFIO 的调试端口配置。',
    '直接修改这些引脚的用途，可能同时影响下载与调试连接。',
    ['入门优先选本例 PA0 等无此冲突的引脚。', '核对 PA13/PA14/PA15/PB3/PB4 的当前用途。', '实板需要改映射时保留可恢复的调试连接。']),

  fault('syntax_semicolon', '语句末尾缺少分号', '代码', 'syntax-semicolon',
    '编译器还没看到这一句话结束，就遇到了下一句话。',
    'C 语言的声明、赋值和多数表达式语句以分号结束；if/while 后也不能随意加分号。',
    '报错行常在下一行，真正漏分号的位置可能在上一行。',
    ['先看报错行及其上一行。', '检查赋值和函数调用末尾的 ;。', '修复后重新解析，不要盲目给所有行加分号。'], 'error'),
  fault('syntax_brace', '大括号没有正确配对', '代码', 'syntax-brace',
    '程序不知道哪些动作属于同一个房间了。',
    '花括号界定语句块和作用域；缺失或多余的括号会改变结构或导致语法错误。',
    '缩进看起来正确，并不能代替真正的 { 和 }。',
    ['从 main 的左大括号开始逐层核对。', '检查 if、else、while、for 各自的范围。', '用格式缩进辅助查看，再重新解析。'], 'error'),
  fault('undefined_symbol', '变量或常量名称没有定义', '代码', 'undefined-symbol',
    '你叫了一个名字，但程序还不知道它代表谁。',
    '可能是拼写、大小写、变量作用域、头文件或未支持常量的问题。',
    'GPIO_Pin_0 中最后是数字 0；GPIOA 与 gpioa 也不是同一个名字。',
    ['逐字核对报错标识符。', '确认变量在使用前声明。', '检查它是否属于当前仿真支持的接口。'], 'error'),
  fault('missing_source', '只有函数声明，没有函数实现', '代码', 'missing-source',
    '菜单上写了这道菜，但厨房里还没有做它的步骤。',
    '头文件中的函数原型不能代替 .c 文件里的函数定义；完整工程还需链接对应源文件。',
    '导入 LED.h 而漏掉 LED.c，会让 LED_On 等函数找不到实现。',
    ['查看项目文件列表。', '确认对应 .c 文件已经导入且函数名称一致。', '若是库 API，查看平台的支持列表。'], 'error'),
  fault('unsupported_api', '当前仿真尚未实现这个接口', '代码', 'unsupported-api',
    '这句代码可能有实际用途，但本平台还不会模拟它。',
    '源码行为仿真只覆盖明确实现的 C 子集与外设 API；未知调用不能当作成功执行。',
    'HAL、Arduino、复杂寄存器访问、中断和 DMA 等不能自动视为与当前标准库模型等价。',
    ['查看报错中的函数名和文件行号。', '查支持列表，或换用已经实现的等价入门流程。', '完整固件应在匹配工具链和硬件仿真器/实板上验证。'], 'error'),
  fault('busy_loop', '程序一直忙转，没有给观察留下时间', '代码', 'instruction-budget',
    '程序在极短时间内重复太多次，平台先暂停，方便你检查。',
    '解释器采用指令预算防止页面被无限循环占满。此暂停不等于真实 MCU 一定发生硬件故障。',
    'while(1) 本身是常见主循环；问题可能是循环没有可观察的进展或等待条件永远不满足。',
    ['看当前停在哪个循环。', '检查循环条件和更新变量。', '入门灯光例子中加入合适 Delay_ms；不要用它掩盖真正的死循环。']),
  fault('condition_never_changes', '等待条件始终不成立', '代码', 'stuck-wait',
    '程序一直等一件不会发生的事情，所以后面的代码没机会执行。',
    '轮询循环可能等待未使能外设、错误标志、错误引脚或仿真未实现的事件。',
    '看到程序停在 while，不一定是 while 写错；要检查改变条件的来源。',
    ['观察等待条件读取的值。', '检查外设时钟、使能和触发动作。', '确认这个事件在当前仿真中受支持。']),
  fault('delay_units', '把毫秒与微秒混淆', '时序', 'delay-units',
    '同样写 500，ms 是半秒，us 只有半毫秒。',
    '1 ms = 1000 us。闪烁周期要把所有高、低电平保持时间相加。',
    '闪得过快时人眼可能看成常亮；看不到闪烁不等于引脚没变化。',
    ['核对调用的是 Delay_ms 还是 Delay_us。', '先用 500 ms 观察清楚。', '用波形观察较快变化，并区分虚拟时间与播放速度。']),

  fault('pwm_not_started', '定时器配置好了但没有启动', '外设', 'pwm-disabled',
    '你给计时器设好了规则，但还没让它开始数。',
    'PWM 需要时钟、计数器使能、通道输出配置及正确的 GPIO 复用模式。',
    '仅调用 TIM_TimeBaseInit 或 TIM_SetCompare1 不足以形成完整 PWM 输出。',
    ['检查 TIM2 的 APB1 时钟。', '检查 TIM_Cmd(TIM2, ENABLE)。', '检查 OC1 输出使能和 PA0 复用推挽配置。']),
  fault('pwm_wrong_pin', 'PWM 通道与实际引脚不匹配', '外设', 'pwm-pin-mismatch',
    '定时器在一个出口发波形，线却插在另一个出口。',
    '定时器通道通过规定的复用映射连接到 GPIO；映射和重映射取决于具体芯片。',
    'TIM2_CH1 默认可用 PA0，并不表示 TIM2 的所有通道都能从任意 GPIO 输出。',
    ['本例使用 TIM2_CH1 与 PA0。', '核对接线和 GPIO_Mode_AF_PP。', '需要改引脚时查手册及平台是否支持相应重映射。']),
  fault('pwm_frequency', 'PWM 频率不适合当前负载', '时序', 'pwm-frequency',
    '一秒重复多少次，会影响灯光、声音或舵机能否正常响应。',
    '向上计数边沿对齐时，fPWM = fTIM / ((PSC+1)×(ARR+1))；fTIM 需要从实际时钟树确定。',
    'GPIO_Speed 不是 PWM 频率；APB 时钟也不总能直接当作定时器时钟。',
    ['检查实际定时器时钟假设。', '计算 PSC 和 ARR 对应的频率。', '按负载规格选择频率；灯光例子的频率不能直接照搬到所有舵机。']),
  fault('pwm_duty', '占空比落在预期之外', '时序', 'pwm-duty',
    '高电平占得太少会暗，占满整个周期就像一直开着。',
    '在本例向上计数 PWM1、高有效配置中，占空比近似 CCR/(ARR+1)，并受边界值限制。',
    'ARR=999 表示有 1000 个计数位置；CCR=1000 对应本模型的持续高电平。',
    ['查看 ARR 与 CCR 当前值。', '从 25%、50%、75% 三个值观察。', '同时检查 PWM 模式和极性。']),

  fault('adc_overrange', 'ADC 输入超出参考电压范围', '模拟', 'adc-overrange',
    'ADC 只能在它允许的范围内量电压，不能把更高电压直接接进去。',
    'ADC 转换输入范围与 VREF−、VREF+ 相关；本模型参考地为 0 V、正参考按 3.3 V。数字脚的耐压条件不能直接套到模拟输入。',
    '超过量程显示满格，不代表实体引脚可以安全承受这个电压。',
    ['查看 ADC 输入相对 GND 的电压。', '将电位器两端接 3V3 和 GND。', '测更高电压时需要经过设计验证的调理电路。'], 'error'),
  fault('adc_floating', 'ADC 输入悬空', '模拟', 'adc-floating',
    'ADC 在量一根没有接稳的线，数字自然没有可靠意义。',
    '模拟输入需要确定的信号源及合适源阻抗；实体结果还受采样时间、噪声和残余电荷影响。',
    'GPIO_Mode_AIN 只是选择模式，不会自动生成待测电压。',
    ['确认电位器中间端确实连接 PA1。', '确认电位器两端连接到电源与地。', '观察转动旋钮时电压与 adcValue 是否同步变化。']),
  fault('adc_channel', '选择的 ADC 通道与接线不一致', '模拟', 'adc-channel-mismatch',
    '旋钮接在 PA1，程序却在读取另一个输入。',
    'STM32F103 的外部 ADC 通道有固定引脚对应关系；本例 PA1 对应 ADC_Channel_1。',
    'GPIO_Pin_1 与 ADC_Channel_1 是不同接口的常量，不能只因为数字相同就随处替换。',
    ['核对 ADC_RegularChannelConfig 的通道。', '核对电位器连接端。', '把通道、引脚和 GPIO_Mode_AIN 配置统一。']),
  fault('adc_clock', 'ADC 时钟过快或未使能', '模拟', 'adc-clock',
    'ADC 需要合适的工作节奏，还要先启动再等转换完成。',
    '应使能 ADC 外设、选择符合规格的 ADC 时钟，并按配置触发转换。真实器件还需遵守稳定与校准时序。',
    '直接读 ADC_GetConversionValue 不会自动保证已经产生新样本。',
    ['检查 ADC1 时钟和 RCC_ADCCLKConfig。', '检查 ADC_Cmd 和软件触发。', '确认 EOC 后再读取；实板校准流程按手册执行。']),

  fault('uart_disabled', '串口没有使能', '外设', 'uart-disabled',
    '发送函数已经被叫到，但串口设备还没有准备好。',
    'USART 需要外设时钟、参数初始化、发送/接收模式和 USART_Cmd 使能。',
    '只写 USART_SendData 不能替代串口初始化。',
    ['核对 USART1 的 APB2 时钟。', '检查 USART_Init 中的 Tx/Rx 模式。', '确认执行 USART_Cmd(USART1, ENABLE)。']),
  fault('uart_crosswire', '串口 TX/RX 接线或共地有误', '外设', 'uart-wiring',
    '一边的嘴要接到另一边的耳朵：TX 接对方 RX。',
    '普通异步串口连接需交叉 TX/RX，并有合适的电平标准和参考地。TTL 电平串口与 RS-232 不能直接混接。',
    '把 TX 接 TX，两个输出可能争用；把 RX 接 RX，两边都在等数据。',
    ['PA9(TX) 接转换器 RX。', 'PA10(RX) 接转换器 TX，并连接 GND。', '核对接口电压和电平标准。']),
  fault('uart_baud', '串口参数不一致', '外设', 'uart-baud-mismatch',
    '两边说话速度不同，接收方就可能把字符听错。',
    '双方应使用匹配的波特率、数据位、奇偶校验和停止位；真实误差还与各自时钟相关。',
    '乱码不一定是中文编码问题，应先核对最基本的串口格式。',
    ['本例统一为 9600、8N1。', '先测试 ASCII 字符 O 和 K。', '确认基本收发正确后再处理中文编码与协议。']),

  fault('servo_power', '舵机供电低于本模型的要求', '外设', 'servo-power',
    '本模型需要 5V 动力电源；3.3V 控制信号只负责告诉它转到哪里。',
    '自动规则检查该舵机模型两端供电是否低于 4.5V。它不证明真实电源能提供足够启动或堵转电流。',
    '舵机三根线颜色因型号而异，不能只凭颜色猜。',
    ['按具体舵机标识区分电源、地、信号。', '使用满足其规格的电源，并与控制器正确共地。', '本平台只演示控制脉宽到角度的教学映射，不验证真实堵转电流。'], 'error'),
  fault('buzzer_type', '有源与无源蜂鸣器的驱动方式混淆', '外设', 'buzzer-type',
    '有源蜂鸣器内部会振荡；无源蜂鸣器通常需要外部交替变化的信号。',
    '不同蜂鸣器对供电、驱动电流和激励频率的要求不同。本平台有源蜂鸣器采用简化开关模型。',
    '把“写高电平就响”当作所有蜂鸣器的共同规则会导致误判。',
    ['先确认蜂鸣器类型和额定电压。', '核对驱动是否需要三极管等外部电路。', '无源器件应按规格提供交变激励。']),
  fault('capacitor_polarity', '有极性电容方向接反', '模拟', 'capacitor-reversed',
    '有些电容有正负方向，需要按标记连接。',
    '铝电解等有极性电容需满足极性和额定电压；普通陶瓷电容通常无此极性要求。',
    '电容的外形不能代替具体类型和规格判断。',
    ['确认元件是电解电容还是无极性电容。', '按本体极性标记核对连接。', '检查额定电压；平台不模拟真实鼓包、发热与失效。'], 'error'),
  fault('capacitor_transient', '把直流稳态结果当成完整充放电过程', '模拟', 'transient-not-modeled',
    '电容充电需要时间；只看最终状态会漏掉中间的变化。',
    '本平台已有理想电容的后向欧拉 RC 近似；它不含 ESR、漏电、寄生和击穿，也不能替代完整电路瞬态验证。RC 时间常数为 R×C。',
    '画出了电容的外形，不表示平台已经实现其所有动态行为。',
    ['查看当前元件的模型覆盖说明。', '需要充放电曲线时使用支持该瞬态模型的模式或工具。', '将理论计算与实测波形对应验证。'])
];

faultCatalog.push(
  Object.assign(fault('stlink_usb_not_detected', '电脑没认出 ST-LINK 下载器', '外设', 'manual-stlink-usb',
    '先检查电脑有没有认出“下载器”，这一步还没轮到 STM32 上的点灯程序。',
    'No ST-LINK detected 通常属于电脑至调试探针这一段的识别或驱动问题。浏览器仿真不访问本机 USB 驱动，也不能替你测出下载器是否损坏。',
    'USB 接触、数据线、驱动和探针硬件都可能影响识别；ST-LINK 不一定显示为一个串口 COM 设备。',
    ['打开 Windows 设备管理器，插拔下载器，观察是否有对应设备出现或消失。', '如使用 USB 线连接，换一根确认支持数据传输的线；U 盘式下载器可换一个 USB 口交叉检查。', '若对应设备带黄色感叹号，按作者软件安装说明或 ST 官方驱动流程处理，不要把 CH340 串口驱动当成 ST-LINK 驱动。', '电脑能稳定识别探针后，再检查目标板连接；仍不识别时可换电脑或已知正常的探针定位。']),
    { sourceIds: ['jiangxie-stlink-usb'], manualOnly: true }),
  Object.assign(fault('stlink_target_not_connected', '能认出 ST-LINK，但连不上 STM32', '接线', 'manual-stlink-target',
    '电脑找到了下载器，但下载器还没有和目标芯片说上话。',
    'No target connected 需要检查 SWD 信号、参考地、目标供电和连接模式。STM32F103 的 SWDIO 为 PA13，SWCLK 为 PA14；复位下连接还需要相应 NRST 控制。',
    '下载器排针顺序因型号而异；灯亮只能说明某处有电，不能证明 SWDIO/SWCLK 接对或目标电压正常。',
    ['断电后逐字核对：SWDIO/DIO 接目标 SWDIO，SWCLK/CLK 接目标 SWCLK，GND 共地；不要按排针位置想当然地一一平接。', '核对目标板 3V3 供电与下载器的电压参考要求。VTref 是参考电压输入时，不能把它当作通用供电输出。', '检查杜邦线、焊接和接触，下载选项选择匹配的 SWD 接口；必要时降低调试时钟。', '若此前能下载、换程序后失联，可在支持的探针上连接 NRST 并尝试 Connect under reset，按工具说明恢复连接；正常连接并不一律要求第五根 NRST 线。']),
    { sourceIds: ['jiangxie-stlink-target','st-connect-reset','st-datasheet'], manualOnly: true }),
  Object.assign(fault('keil_compiler_mismatch', 'Keil 工程与 AC5 / AC6 编译器不匹配', '代码', 'manual-keil-compiler',
    '工程里的老写法和当前编译器使用的规则没有对上，可能一下冒出很多错误。',
    'Arm Compiler 5 与 Arm Compiler 6 的语言模式、扩展语法和命令参数存在差异。江协该旧版课程工程提示使用 V5.06；AC6 迁移需同时检查源码、CMSIS 和构建配置。',
    'Keil 软件版本、Arm Compiler 版本和器件包版本是不同层次；切换编译器不是保证旧工程立即兼容的魔法。',
    ['先看 Build 输出中的实际编译器版本，再看工程 Options for Target → Target → ARM Compiler。', '复现旧课程时，使用自己合法可用且与工程匹配的 AC5 环境；下拉框没有该版本，说明需要配置或安装相应工具链。', '需要使用 AC6 时，依据 Arm 的迁移说明检查编译参数、CMSIS 头文件和编译器专用写法，不要看到 __INLINE 报错就全局乱删宏。', '先修第一条有因果意义的 Error，再重新编译；本平台使用自己的 C 子集解释器，不负责安装或切换电脑上的 Keil 编译器。']),
    { sourceIds: ['jiangxie-compiler','arm-ac5-ac6'], manualOnly: true }),
  Object.assign(fault('oled_black_screen', '实体 OLED 黑屏，先分清接线与程序', '外设', 'manual-oled-black-screen',
    '黑屏只告诉你“没显示出来”，还不能直接判定是屏坏了。',
    'OLED 模块需要匹配的供电、接口、引脚连接与驱动程序。这里提供实体排查流程；平台没有完整模拟实际 OLED 总线、控制器和焊点。',
    '不同模块的针脚顺序、接口类型和控制器可能不同，不能只照另一块屏的外形插线。',
    ['断电后按屏上丝印核对 GND、VCC 和信号脚，确认所需供电电压；不要只按左右位置猜。', '对照当前 OLED.c 与教程接线，把 SCL/SDA 或相应 SPI 信号接到代码实际使用的引脚，并检查排针是否可靠接触。', '使用与你屏幕型号和接线相匹配的作者原始示例交叉测试：原例正常、自写不正常时再比较初始化与显示调用。', '原例也不显示时，测供电和共地，再逐根检查信号、接触及模块规格；黑屏本身不能证明唯一原因。']),
    { sourceIds: ['jiangxie-oled'], manualOnly: true }),
  Object.assign(fault('keil_axf_missing', '下载时找不到 .axf 输出文件', '代码', 'manual-axf-missing',
    '下载工具想搬运程序文件，但这份文件还没被成功生成，或者找错了位置。',
    'Could not load file … .axf 涉及构建产物与目标输出路径。C 源文件存在，并不代表编译和链接已经成功。',
    '未执行 Build、存在编译/链接错误、选择了错误 Target 或输出路径变化，都可能让下载阶段找不到目标文件。',
    ['先对当前 Target 执行 Build，查看编译输出，优先修第一条 Error。', '确认编译与链接完成，输出目录里有本次生成的 .axf，而不是另一工程的旧文件。', '核对当前 Target 和下载/调试所指向的输出文件路径，再执行下载。', 'Warnings 需理解和处理，但并非每条警告都会阻止文件生成；本平台导出的 .c/.h 是学习源码，不会生成 ARM 的 .axf/HEX 固件。']),
    { sourceIds: ['jiangxie-axf'], manualOnly: true }),
  Object.assign(fault('source_encoding', '英文正常，中文注释或字符串乱码', '代码', 'manual-source-encoding',
    '文件里的文字用了某一种“编码”，软件却按另一套规则读，所以汉字变了样。',
    'UTF-8、GB2312/GBK 等字节编码不同。改变编辑器的读取设置，与真正转换文件字节，是两件事。',
    '混用不同来源工程，或把错误解码后的文字再次保存，可能让乱码进入文件本身。',
    ['先保留原文件副本，不要在乱码状态下反复覆盖保存。', '在支持编码选择的编辑器里，按正确编码重新打开，确认原来的中文能读出来。', '需要统一格式时，再将可正常阅读的副本转换保存为 UTF-8；整个工程尽量保持一致。', '本平台源码导入按 UTF-8 读取。遇到旧 GBK/GB2312 文件，先转换副本再导入；中文字符串还要与实际显示/通信协议的编码一致。']),
    { sourceIds: ['jiangxie-encoding'], manualOnly: true })
);

/** These entries have an implemented matching condition, not universal diagnosis coverage. */
export const automaticFaultCoverage = Object.freeze({
  power_off: { codes: ['POWER_OFF'], scope: '检测本平台开发板供电开关为关闭；不推断实体稳压器或电池故障。' },
  common_ground: { codes: ['COMMON_GROUND'], scope: '检查模型中外部直流电源的负端是否与板 GND 直接导通；不自动判断隔离电路。' },
  power_short: { codes: ['SUPPLY_SHORT'], scope: '检测理想电源正负端落在同一导线网络。' },
  led_reverse: { codes: ['LED_REVERSED'], scope: '检测 LED 两端反向电压大于 0.3V；未模拟反向击穿和永久损坏。' },
  resistor_low: { codes: ['LED_OVERCURRENT'], scope: '按当前模型计算 LED 电流并与该灯设定上限比较；不能唯一断定电阻是原因。' },
  resistor_high: { codes: ['LED_DIM'], scope: '检测正向 LED 电流很小；“电阻偏大”是可能原因，不是自动确认的唯一结论。' },
  led_open: { codes: ['OPEN_CIRCUIT'], scope: '检测 LED A/K 端至少一端未接入导线；不覆盖器件内部失效和支路所有可能断点。' },
  led_same_node: { codes: ['COMPONENT_BYPASSED'], scope: '检测 LED A/K 被导线或面包板同组孔直接并为同一节点。' },
  gpio_clock: { codes: ['CLOCK_DISABLED','GPIO_CLOCK'], scope: '检测对未使能时钟外设的受支持操作，以及已连线 GPIO 的关闭时钟状态。' },
  gpio_wrong_mode: { codes: ['PIN_NOT_OUTPUT'], scope: '检测受支持的 GPIO 写函数写入非普通输出模式；不替你判断整个应用的设计意图。' },
  gpio_contention: { codes: ['OUTPUT_CONFLICT'], scope: '检测同一导线网络中模型输出源的相反强驱动电平。' },
  syntax_semicolon: { codes: ['SYNTAX'], scope: '解析器在需要分号处报告实际记号与位置；也可能是上一句结构导致的后续报错。' },
  syntax_brace: { codes: ['SYNTAX','EXPECTED_EXPRESSION'], scope: '解析支持范围内的语句块配对；不提供任意 C 标准的完整诊断。' },
  undefined_symbol: { codes: ['UNKNOWN_VARIABLE','UNKNOWN_TYPE'], scope: '发现执行中未声明变量或解析中未知类型；附文件与行号。' },
  missing_source: { codes: ['UNSUPPORTED_API'], scope: '发现调用没有用户实现、也不是内置 API；需人工区分漏文件、拼写错误和未实现外设。' },
  unsupported_api: { codes: ['UNSUPPORTED_API','UNSUPPORTED_REGISTER','UNSUPPORTED_SYNTAX'], scope: '明确拒绝未实现函数、寄存器或语法，不把它们当作成功运行。' },
  busy_loop: { codes: ['NO_VIRTUAL_TIME_PROGRESS','EXECUTION_LIMIT'], scope: '检测本次执行达到预算且无等待点，或达到总步数上限；不是证明一般意义上的死循环。' },
  adc_clock: { codes: ['ADC_CLOCK_TOO_FAST','ADC_DISABLED'], scope: '按本模型时钟假设检查 ADC 时钟超过14MHz，或转换时 ADC 时钟/使能未开启。' },
  uart_disabled: { codes: ['UART_DISABLED'], scope: '检测发送动作发生时 USART 未使能或未选 Tx 模式。' },
  servo_power: { codes: ['SERVO_SUPPLY'], scope: '检测此5V舵机模型供电低于4.5V；不模拟电源瞬态、堵转电流和机械负载。' },
  capacitor_polarity: { codes: ['CAP_REVERSED'], scope: '检测有极性电容的反向电压超过0.3V；不模拟真实发热、鼓包或击穿。' }
});
export const automaticFaultIds = Object.freeze(Object.keys(automaticFaultCoverage));
for (const entry of faultCatalog) {
  const supported = automaticFaultCoverage[entry.id];
  entry.detectable = Boolean(supported);
  if (supported) {
    entry.diagnosticCodes = supported.codes;
    entry.detectionScope = supported.scope;
    entry.coverage = supported.scope;
  }
}

const term = (id, name, signature, plain, analogy, technical, example, gotcha, keywords = []) => ({
  id, name, signature, plain, analogy, technical, example, gotcha,
  keywords: [...new Set([id, name, ...keywords])]
});

export const glossary = [
  term('power_names', 'VCC / VDD / VSS / GND', '3V3、5V、VDD、VSS、GND',
    '先找清“从哪里供电”和“以哪里当零点”。字母是电路中的名字，电压还要看具体标注。',
    '可以把 GND 想成量高度时共同约定的地面；这只解释参考点，不表示它永远与大地相连。',
    'VDD 常用于芯片正电源，VSS 常用于芯片地，VCC 常作正供电网络名，GND 是参考地名称。命名习惯不构成电压保证。',
    '电位器一端接 3V3，另一端接 GND，中间端接 PA1。',
    '不能仅凭 VCC 三个字就断定是 5V；开发板 5V 与 3V3 也不是同一电源节点。', ['VCC','VDD','VSS','GND','3V3','5V']),
  term('GPIO', 'GPIO：可以安排工作的引脚', 'General-Purpose Input/Output',
    '同一个脚可以被安排为“看外面”的输入，也可以被安排为“控制外面”的输出。',
    '像可分配岗位的窗口；输入和输出是在说它的职责，不是说金属脚移动了。',
    'GPIO 是通用输入/输出外设。模式、输出锁存、输入采样和实际引脚电压是不同层面的状态。',
    'PA0 用作 LED 输出，PB1 用作按钮输入。',
    '读到 1、写入 1、引脚电压高、LED 点亮，这四件事不能无条件画等号。'),
  term('GPIOA', 'GPIOA / GPIOB / GPIOC：选择端口', 'GPIO_Init(GPIOA, &gpio);',
    '先选哪一组引脚，再选这一组里的第几个。GPIOA 代表 A 组。',
    '像先选 A 栋楼，再选 0 号房间。只是编号类比，不代表芯片内部真的有楼。',
    'GPIOA 等符号表示对应 GPIO 外设的寄存器接口地址；标准库通过它选择端口。',
    'GPIOA + GPIO_Pin_0 → PA0；GPIOB + GPIO_Pin_0 → PB0。',
    '板上的 A0 是 PA0 的简写，不能与 PB0 混用。', ['GPIOB','GPIOC','PA0','PB0']),
  term('GPIO_Pin_0', 'GPIO_Pin_n：选中引脚', 'GPIO_Pin_0 | GPIO_Pin_1',
    '这是“勾选哪几个引脚”的标记。',
    '像一排复选框；每一个位对应一个引脚，不是普通的顺序编号数值。',
    'GPIO_Pin_n 是位掩码。例如 GPIO_Pin_0 为 0x0001，GPIO_Pin_1 为 0x0002，可用按位或组合。',
    'gpio.GPIO_Pin = GPIO_Pin_0 | GPIO_Pin_1;',
    'GPIO_Pin_0 不是数字 0。不要把它与 ADC 通道号混为一谈。', ['GPIO_Pin_1','GPIO_Pin_2','GPIO_Pin_13']),
  term('RCC_APB2PeriphClockCmd', '给 APB2 外设打开时钟', 'RCC_APB2PeriphClockCmd(外设标记, ENABLE);',
    '在配置 GPIO 之前，先让这个端口获得工作的节拍。',
    '像给一个工作小组打开节拍器；这不等同于接通整块板的电源。',
    '该标准库函数修改 APB2 外设时钟使能状态。F1 的 GPIO、AFIO、USART1、ADC1 等有各自的使能位。',
    'RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);',
    'GPIOA 的时钟不会顺便开启 GPIOB。', ['RCC_APB2Periph_GPIOA','RCC_APB2Periph_GPIOB','RCC_APB2Periph_GPIOC']),
  term('ENABLE', 'ENABLE / DISABLE：启用或关闭', 'ENABLE / DISABLE',
    '这两个名字通常表示“打开”和“关闭”某项功能。',
    '像开关的两个位置；到底开关什么，要看前面的函数。',
    '它们是标准库 FunctionalState 类型的枚举值，用于各类外设使能接口。',
    'TIM_Cmd(TIM2, ENABLE);',
    'ENABLE 不直接表示引脚输出高电平；Bit_SET 才是 GPIO_WriteBit 中的位动作之一。', ['DISABLE']),
  term('GPIO_InitTypeDef', '创建一张 GPIO 配置表', 'GPIO_InitTypeDef gpio;',
    '先准备一张表，里面填“选哪几个脚、用什么模式、输出速度档位”。',
    '像给引脚填写工作安排单；填表本身还没有把任务下发。',
    'GPIO_InitTypeDef 是标准库定义的结构体类型，gpio 是此类型的变量，保存初始化参数。',
    'GPIO_InitTypeDef gpio;',
    '变量名 gpio 可以改，类型名不能随意改；要填写必要字段并调用 GPIO_Init 才应用。'),
  term('struct_member', '点号 .：填写配置表的一格', 'gpio.GPIO_Mode = GPIO_Mode_Out_PP;',
    'gpio 是整张表，点号后面的名字是表里的某一格。',
    '像“表格.工作模式”；它说明访问哪一项，不是小数点运算。',
    'C 的成员访问运算符 . 用于访问结构体对象的成员；指针访问成员一般使用 ->。',
    'gpio.GPIO_Pin = GPIO_Pin_0;',
    '填写成员只是修改内存中的配置变量，不会自动重新配置 GPIO。', ['GPIO_Pin','GPIO_Mode','GPIO_Speed']),
  term('address_of', '&gpio：把配置表的位置交出去', 'GPIO_Init(GPIOA, &gpio);',
    '函数需要找到你刚填的配置表，&gpio 就是在告诉它表放在哪里。',
    '像给出文件柜地址，而不是再抄一份整张表；这里只解释地址传递。',
    '一元运算符 & 取得对象地址，结果是指针。GPIO_Init 通过指针读取 GPIO_InitTypeDef 的成员。',
    'GPIO_Init(GPIOA, &gpio);',
    '这里的 & 不是按位与，也不是“所有函数参数都要加 &”。', ['&gpio','&timer','&adc','&serial']),
  term('GPIO_Init', '让刚才的配置真正生效', 'GPIO_Init(GPIOx, &配置变量);',
    '把填写好的配置交给指定端口，让选中的脚按这个方式工作。',
    '像按下“应用设置”。前面填表，到了这里才应用。',
    'GPIO_Init 根据结构体中的 Pin、Mode、Speed 修改 GPIO 配置寄存器；上拉/下拉模式还涉及输出锁存位设置。',
    'GPIO_Init(GPIOA, &gpio);',
    '要先使能正确端口的时钟；此函数不会检查你的 LED 是否接对。'),
  term('GPIO_Mode_Out_PP', '推挽输出：能主动拉高，也能拉低', 'gpio.GPIO_Mode = GPIO_Mode_Out_PP;',
    '程序让它高，它就尝试把引脚拉高；程序让它低，它就尝试把引脚拉低。',
    '像有人可以主动把门往两边推拉；这里只说明主动驱动两种状态，不表示能提供无限电流。',
    '推挽输出通过上、下驱动器产生高、低电平，输出电压和电流受电气规格约束。',
    'GPIO_SetBits(GPIOA, GPIO_Pin_0);',
    '不能把两个输出相反电平的推挽引脚直接连在一起。'),
  term('GPIO_Mode_Out_OD', '开漏输出：能拉低，写高时放手', 'gpio.GPIO_Mode = GPIO_Mode_Out_OD;',
    '它会主动拉低，但“写 1”是放开这根线，通常需要上拉才能变高。',
    '像只能把绳子往下拉的人；放手后是否回到高处，取决于其他装置。',
    '开漏输出的低状态导通下拉器件，高状态进入高阻。稳定高电平由上拉或其他合法驱动提供。',
    'GPIO_SetBits(GPIOB, GPIO_Pin_6); // 释放开漏输出',
    '写 1 不保证测得高电平；上拉电阻、电源和线路负载都会影响结果。'),
  term('GPIO_Mode_IPU', '上拉输入：松手时默认偏向高', 'gpio.GPIO_Mode = GPIO_Mode_IPU;',
    '没人拉低这根线时，内部一只较弱的电阻会让它倾向于高电平。',
    '像一根轻弹簧维持默认位置；只是帮助理解弱上拉，不能当作强电源。',
    '内部弱上拉用于给输入提供默认状态。外部开关闭合到 GND 时，可以把它拉为低电平。',
    '按钮一侧接 PB1，另一侧接 GND，PB1 设为 IPU。',
    '此接法按下读 0，松开读 1；不要把 IPU 配成输出去按键接地。'),
  term('GPIO_Mode_IPD', '下拉输入：松手时默认偏向低', 'gpio.GPIO_Mode = GPIO_Mode_IPD;',
    '没人拉高时，内部较弱的下拉让输入倾向于低电平。',
    '像一个轻轻向下拉的默认动作；不表示任何外部电压都能安全接入。',
    '下拉输入将弱电阻连接到参考地，外部合法高电平信号可使输入读为高。',
    '按钮按下接 3V3、松开需要默认低时，可考虑 IPD。',
    '上拉和下拉应与实际接法配套，不是随便选一种都相同。'),
  term('GPIO_Mode_IN_FLOATING', '浮空输入：不加内部上拉或下拉', 'gpio.GPIO_Mode = GPIO_Mode_IN_FLOATING;',
    '引脚负责读取外面，但内部不替它安排默认高低。',
    '像等待别人明确发信号；没人发时，不能凭空知道答案。',
    '浮空输入保持数字输入路径，没有内部偏置电阻。需要外部电路提供确定电平。',
    '串口 RX 连接到对方明确驱动的 TX。',
    '“浮空输入”是一种模式名，不意味着应该把导线真的悬空。'),
  term('GPIO_Mode_AIN', '模拟输入：准备测连续变化的电压', 'gpio.GPIO_Mode = GPIO_Mode_AIN;',
    '让这个脚用于测电压，而不是只判断高或低。',
    '像从“开/关指示灯”换成“刻度表”的输入入口；仍需后面的 ADC 才能得到数字。',
    '模拟输入模式关闭相应数字输入路径，供 ADC 等模拟功能使用；通道选择和转换配置仍是单独步骤。',
    'PA1 配置为 AIN，ADC1 选择 ADC_Channel_1。',
    'GPIO 配成 AIN 后，不代表 ADC 已启动，也不代表允许超量程电压。'),
  term('GPIO_Mode_AF_PP', '复用推挽：让外设接管输出', 'gpio.GPIO_Mode = GPIO_Mode_AF_PP;',
    '这次由定时器或串口来安排高低变化，普通 GPIO 不再独自负责。',
    '像把同一个窗口交给专门的工作人员；窗口位置不变，操作者换了。',
    '复用推挽把外设输出接到引脚，仍需正确的外设通道、映射和使能配置。',
    'PA0 作为 TIM2_CH1，或 PA9 作为 USART1_TX。',
    '只设置 AF_PP，不会自动生成 PWM 或串口数据。'),
  term('GPIO_Speed_2MHz', 'GPIO_Speed：输出速度档位', 'gpio.GPIO_Speed = GPIO_Speed_2MHz;',
    '这是输出驱动的速度档位，不是让 LED 每秒闪 200 万次。',
    '像规定动作能有多快，而不是规定每隔多久做一次；只是功能区分类比。',
    'STM32F1 输出模式包含最大输出速度设置，影响驱动/边沿特性。信号的实际周期由程序或外设决定。',
    '点灯入门示例使用 GPIO_Speed_2MHz。',
    '改成 50MHz 不会自动让 Delay_ms 变短，也不会修改 CPU 主频。', ['GPIO_Speed_10MHz','GPIO_Speed_50MHz']),
  term('GPIO_SetBits', 'SetBits：把选中的输出位设为 1', 'GPIO_SetBits(GPIOx, GPIO_Pin_n);',
    '告诉选中的引脚“输出值设成高”。配置和接线正确时，可以看到对应高电平。',
    '像把选中的开关标记拨到 1；外面设备是否启动还取决于它的接法。',
    '标准库通过置位寄存器设置输出锁存位，保留未选中的位。实际端电压还受模式与外部负载影响。',
    'GPIO_SetBits(GPIOA, GPIO_Pin_0);',
    '板载 PC13 灯是低有效，SetBits 通常会让它熄灭。'),
  term('GPIO_ResetBits', 'ResetBits：把选中的输出位清成 0', 'GPIO_ResetBits(GPIOx, GPIO_Pin_n);',
    '把选中的输出值设成低。它不是让整个 STM32 重新启动。',
    '像把选中的开关标记拨到 0；与整机“复位键”不是一件事。',
    '此函数清除指定输出锁存位，其他位保持；实体输出效果取决于 GPIO 模式。',
    'GPIO_ResetBits(GPIOC, GPIO_Pin_13);',
    '低电平可能点亮低有效灯，因此“Reset=关灯”并不普遍成立。'),
  term('GPIO_WriteBit', 'WriteBit：用一个参数选择高或低', 'GPIO_WriteBit(GPIOx, GPIO_Pin_n, Bit_SET);',
    '用第三个参数告诉函数，这次要写 1 还是写 0。',
    '像一张指令里同时写“操作谁”和“设成什么”。',
    'Bit_SET 与 Bit_RESET 选择置位或清位；该接口适合由条件结果决定单个引脚输出。',
    'GPIO_WriteBit(GPIOA, GPIO_Pin_0, Bit_RESET);',
    '别把 Bit_SET 与 GPIO_Mode_Out_PP 混用：前者是输出值，后者是工作模式。', ['Bit_SET','Bit_RESET']),
  term('GPIO_ReadInputDataBit', '读取一个引脚的输入高低', 'GPIO_ReadInputDataBit(GPIOx, GPIO_Pin_n)',
    '去看这根引脚现在被读成 0 还是 1。',
    '像查看门口传来的状态，不是往门口发命令。',
    '该函数读取输入数据寄存器中选定的一位，返回数字输入状态。',
    'if (GPIO_ReadInputDataBit(GPIOB, GPIO_Pin_1) == 0) { ... }',
    '读数是数字判断，不是精确电压；要测电压需要 ADC 或测量工具。'),
  term('GPIO_ReadOutputDataBit', '读取“程序写下的输出值”', 'GPIO_ReadOutputDataBit(GPIOx, GPIO_Pin_n)',
    '查看你给引脚写下的是 0 还是 1。',
    '像看控制单上写了什么；控制单不一定等于外面的实际现象。',
    '它读取输出锁存 ODR 的指定位，不等于直接测量引脚端电压。',
    'GPIO_ReadOutputDataBit(GPIOA, GPIO_Pin_0);',
    '短路、错误模式或外部驱动会造成锁存值与实际电压不同。'),
  term('Delay_ms', '等待若干毫秒', 'Delay_ms(500);',
    '让程序在这里等一会儿，500 毫秒就是半秒。',
    '像演出中的停顿；仿真使用虚拟时间，播放加速不改变代码里的时间数值。',
    'Delay_ms 是教程常用的用户延时接口，并非 ST 标准外设库统一提供的函数。实板行为取决于 Delay.c 实现和系统时钟。',
    'GPIO_SetBits(GPIOA, GPIO_Pin_0); Delay_ms(500);',
    '本平台对该接口进行虚拟时间建模，不能由此证明真实工程的延时精度。'),
  term('Delay_us', '等待若干微秒', 'Delay_us(500);',
    '微秒比毫秒短得多：1000 微秒才是 1 毫秒。',
    '像把秒表换到更细的刻度；不表示显示画面能逐个刻度刷新。',
    'Delay_us 常为用户实现的微秒级延时函数。实际最小步长与精度受实现和时钟影响。',
    'Delay_us(1000); // 目标时间为 1 ms',
    'Delay_us(500) 不是半秒，人眼通常看不清这么快的闪烁。'),
  term('uint16_t', 'uint16_t：放整数的小盒子', 'uint16_t adcValue = 0;',
    '创建一个只放非负整数的变量，常用来保存 ADC 读数。',
    '像容量有限的数字盒子；超过容量并不会自动变成更大的盒子。',
    'uint16_t 是恰好 16 位的无符号整数类型，取值范围为 0～65535。它来自标准整数类型定义。',
    'uint16_t adcValue = ADC_GetConversionValue(ADC1);',
    '无符号变量减到 0 以下不会变成普通的负数；循环向下计数需注意边界。', ['uint8_t','uint32_t']),
  term('include', '#include：引入头文件声明', '#include "stm32f10x.h"',
    '告诉编译流程：这一段程序需要哪些已经定义好的名称和接口。',
    '像先拿到工具目录，知道工具的名字和使用方式；目录不代替工具本身的实现。',
    'C 预处理器在包含处展开头文件内容。编译和链接仍需相应实现；本平台提供明确范围的内置接口模型。',
    '#include "LED.h"',
    'include LED.h 不等于自动找到并编译任意磁盘位置的 LED.c。', ['#include']),
  term('main', 'main：应用程序开始做事的地方', 'int main(void)',
    '完成启动准备后，程序来到 main，开始执行你安排的主要动作。',
    '像演出的正式开场；真实 MCU 在开场前还有启动与系统初始化步骤。',
    '在常见 STM32 C 工程中，启动代码和运行时准备后进入 main。仿真直接以 main 作为应用入口。',
    'int main(void) { /* 初始化 */ while (1) { /* 重复任务 */ } }',
    'main 不是硬件上电后的第一条机器指令；源码仿真不覆盖全部启动过程。'),
  term('while', 'while：条件成立就继续重复', 'while (1) { ... }',
    '只要括号里的条件仍然成立，就再做一遍里面的动作。',
    '像“只要还需要工作，就继续这一轮”；必须留意如何变化条件。',
    'while 每轮先判断条件，非零为真。while(1) 在嵌入式主循环中很常见，不天然等于程序错误。',
    'while (1) { LED_On(); Delay_ms(500); LED_Off(); Delay_ms(500); }',
    '如果一直等待不可能发生的事件，后续语句就不会执行。'),
  term('if', 'if / else：根据情况选择动作', 'if (条件) { ... } else { ... }',
    '条件成立做这一边，不成立做另一边。',
    '像看按钮是否按下，再决定开灯还是关灯。',
    'C 将零视为假，非零视为真；大括号决定属于哪个分支的语句范围。',
    'if (adcValue > 2048) { LED_On(); } else { LED_Off(); }',
    'if 后误加分号会改变控制结构；缩进不会替代大括号。', ['else']),
  term('comparison', '= 与 ==：赋值和比较', 'value = 1; / value == 1',
    '一个等号是“把它改成这个值”；两个等号是“问它是不是这个值”。',
    '像“把温度设成 20”和“温度是 20 吗”两句话。',
    '赋值表达式修改对象并产生结果值；相等运算符比较两侧值并产生逻辑结果。',
    'adcValue = 100; if (adcValue == 100) { ... }',
    'if (value = 1) 会赋值，通常不是你想要的比较。', ['==','赋值','比较']),
  term('bitwise_or', '|：把多个选项合在一起', 'GPIO_Pin_0 | GPIO_Pin_1',
    '用于位掩码时，一个竖线能把多个勾选项一起选上。',
    '像把两张“选中引脚清单”合并；不是把普通编号拼成字符串。',
    '按位或对二进制每一位执行 OR。逻辑或 || 则按真假判断，语义不同。',
    'RCC_APB2Periph_GPIOA | RCC_APB2Periph_GPIOB',
    '初始化多个引脚用 |，不要换成 ||。', ['|','||']),
  term('function', '函数：给一组动作起名字', 'void LED_On(void)',
    '把经常一起做的步骤装起来，起一个好记的名字，以后直接叫它。',
    '像“开灯”这条指令背后藏着具体操作步骤；名字不会自动赋予硬件能力。',
    '函数有声明、参数、返回类型与函数体。void 表示相应位置无返回值或无参数。',
    'void LED_On(void) { GPIO_SetBits(GPIOA, GPIO_Pin_0); }',
    '函数名可以自己设计，但调用名、声明名和定义名需要一致。', ['void','return','LED_On','LED_Off','LED_Init']),
  term('header_source', '.h 与 .c：接口目录和具体步骤', 'LED.h / LED.c / main.c',
    'LED.h 写“可以调用哪些动作”，LED.c 写“这些动作怎么完成”，main.c 安排什么时候调用。',
    '像菜单、做菜步骤和点餐安排；这只是职责类比，不涵盖全部 C 预处理规则。',
    '头文件通常放声明、类型和必要宏；源文件放实现。编译单元经链接共同组成程序。',
    'LED.h 声明 void LED_On(void);，LED.c 提供函数体。',
    '头文件并不天然只能写声明，但入门应避免把普通函数实现随意重复放入多个文件。', ['.h','.c']),
  term('RCC_APB1PeriphClockCmd', '给 APB1 外设打开时钟', 'RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE);',
    '准备使用 TIM2 前，打开它所属的外设时钟开关。',
    '像打开另一组设备的工作节拍；APB1/APB2 是芯片的总线分组。',
    'STM32F1 的 TIM2 等外设位于 APB1，需使用匹配的时钟使能接口和标记。',
    'RCC_APB1PeriphClockCmd(RCC_APB1Periph_TIM2, ENABLE);',
    '不要因为 GPIO 用 APB2 就把 TIM2 也写成同一组。'),
  term('TIM_TimeBaseInit', '配置计数器的节奏和终点', 'TIM_TimeBaseInit(TIM2, &timer);',
    '告诉定时器多久数一次、数到哪里重新开始。',
    '像一个反复绕圈的计数器；还没有决定在哪个出口输出波形。',
    '时间基准参数包括预分频 PSC、自动重装值 ARR、计数方向等。常见向上计数周期含 ARR+1 个计数位置。',
    'timer.TIM_Prescaler = 71; timer.TIM_Period = 999;',
    'fTIM 必须来自实际时钟配置；TIM_ClockDivision 不是直接替代 PSC 的普通计数分频器。', ['TIM_Prescaler','TIM_Period','TIM_CounterMode_Up']),
  term('TIM_OC1Init', '设置定时器通道 1 如何输出', 'TIM_OC1Init(TIM2, &output);',
    '给定时器的第 1 个输出通道安排规则，例如输出 PWM。',
    '像计数到某个位置时改变灯的状态；本质是硬件比较规则。',
    '输出比较初始化设置 OC 模式、极性、通道使能及比较值等。PWM1 是其中一种模式。',
    'output.TIM_OCMode = TIM_OCMode_PWM1; TIM_OC1Init(TIM2, &output);',
    '通道初始化、计数器启动、引脚复用配置是三个相关但独立的步骤。', ['TIM_OCMode_PWM1','TIM_OutputState_Enable']),
  term('TIM_SetCompare1', '改变 PWM 的高电平比例', 'TIM_SetCompare1(TIM2, brightness);',
    '改变一圈中有多少时间处于有效状态，灯就会表现出不同亮度。',
    '像在固定长度的时间条里调整“亮着”的部分；人眼亮度并不严格等于这个比例。',
    '该函数写通道 1 比较值 CCR1。向上计数、PWM1、高有效时，占空比与 CCR1/(ARR+1) 对应。',
    'ARR=999 时，TIM_SetCompare1(TIM2, 500) 对应约 50%。',
    '改变 CCR 通常改变占空比；频率主要由 fTIM、PSC、ARR 决定。'),
  term('TIM_Cmd', '启动或停止定时器计数', 'TIM_Cmd(TIM2, ENABLE);',
    '设置都填好以后，让计数器真正开始数。',
    '像按下秒表的开始键；通道和引脚仍要先接对。',
    'TIM_Cmd 修改计数器使能状态。部分高级定时器还有主输出等额外控制要求。',
    'TIM_Cmd(TIM2, ENABLE);',
    '本例是 TIM2，不要把其他定时器的全部使能条件简单照搬。'),
  term('ADC_Init', '配置电压转换的工作方式', 'ADC_Init(ADC1, &adc);',
    '安排 ADC 一次测几个通道、是否连续测、怎样启动，以及结果怎样放。',
    '像给测量员安排工作流程；还要告诉他测哪根线，并让他开始测。',
    'ADC 初始化参数涉及独立/双模式、扫描、连续转换、触发源、数据对齐和通道数量等。',
    'adc.ADC_NbrOfChannel = 1; ADC_Init(ADC1, &adc);',
    '只初始化并不会自动获得新的有效样本。'),
  term('ADC_RegularChannelConfig', '选择 ADC 要测的输入', 'ADC_RegularChannelConfig(ADC1, ADC_Channel_1, 1, 采样时间);',
    '告诉 ADC：“这次测 PA1 对应的通道，把它排在第一个。”',
    '像给测量清单安排顺序；通道号和清单位置是两个参数。',
    '此接口配置规则通道序列中的通道、序号 Rank 和采样周期数。PA1 对应外部 ADC 通道 1。',
    'ADC_RegularChannelConfig(ADC1, ADC_Channel_1, 1, ADC_SampleTime_55Cycles5);',
    '采样时间应结合信号源阻抗与采样需求；本行为模型没有完整模拟采样电容动态。'),
  term('ADC_GetConversionValue', '取出最近的 ADC 转换结果', 'adcValue = ADC_GetConversionValue(ADC1);',
    '把 ADC 已经测出的数字拿出来，放进 adcValue。',
    '像从结果窗口取读数；取结果这件事不等于启动新测量。',
    'STM32F103 的 12 位 ADC 在常见右对齐配置下输出 0～4095。结果受输入、参考电压和转换配置影响。',
    'if (adcValue > 2048) { GPIO_SetBits(GPIOA, GPIO_Pin_0); }',
    '读数不是直接以伏特为单位，也不能保证真实测量没有误差。'),
  term('ADC_Cmd', '使能 ADC 设备', 'ADC_Cmd(ADC1, ENABLE);',
    '让 ADC 进入可工作的状态。随后还要按所选方式触发转换。',
    '像先把仪表打开，再按测量键。',
    '使能、稳定时间、校准与触发转换是相关步骤；具体时序需符合器件手册。',
    'ADC_Cmd(ADC1, ENABLE); Delay_ms(1);',
    '平台的校准完成标志采用简化行为，不代表实体器件总能立即完成。'),
  term('USART_Init', '安排串口双方都要遵守的格式', 'USART_Init(USART1, &serial);',
    '设置发送速度和每个字符的格式，让两边按同一种规则收发。',
    '像约定说话节奏和每句的格式；并不负责翻译文字含义。',
    '常用参数包括波特率、字长、停止位、奇偶校验、收发模式和硬件流控。',
    'serial.USART_BaudRate = 9600; USART_Init(USART1, &serial);',
    '实体双方参数应匹配；初始化后还需使能外设并正确连接引脚。'),
  term('USART_SendData', '通过串口发送一个数据单元', 'USART_SendData(USART1, value);',
    '把一个字符对应的数字交给串口发出去。',
    '像把一张小纸条交给传送带；不是一次就能把任意长句子全部送走。',
    '发送数据寄存器接受待发数据；8 位数据模式使用一个字节。发送前通常检查 TXE。',
    "USART_SendData(USART1, 'A');",
    "发送数字 65 与发送字符 '6'、'5' 的结果不同；一整个字符串要逐字节处理。"),
  term('USART_GetFlagStatus', '查看串口是否准备好', 'USART_GetFlagStatus(USART1, USART_FLAG_TXE)',
    '先问一句：现在能接着发吗？或者有没有新数据收到？',
    '像看传送带入口的指示灯；不同灯告诉你不同阶段的状态。',
    'TXE 表示发送数据寄存器空，TC 表示发送完成，RXNE 表示接收数据寄存器非空；三者不能互换。',
    'while (USART_GetFlagStatus(USART1, USART_FLAG_TXE) == RESET) { }',
    'TXE 为真不一定意味着线路最后一位已经发完；精确时序需要区分 TC。', ['USART_FLAG_TXE','USART_FLAG_TC','USART_FLAG_RXNE']),
  term('USART_ReceiveData', '取走串口收到的数据', 'value = USART_ReceiveData(USART1);',
    '从接收位置拿走刚收到的一个数据。',
    '像取一张到达的纸条；应该先确认纸条确实到了。',
    '读接收数据前通常检查 RXNE。具体标志清除和错误处理需按器件规定执行。',
    'if (USART_GetFlagStatus(USART1, USART_FLAG_RXNE)) { receivedByte = USART_ReceiveData(USART1); }',
    '一次读取不等于已经收到一整条消息；消息边界需要通信协议约定。')
];

export const lessons = [
  {
    id: 'orientation', title: '先认识实物：引脚名字与共同的地', exampleId: 'blink',
    intro: '这一课只做两件事：找到正确引脚，理解电压需要参考点。先不背总线和寄存器。',
    concepts: [
      { title: 'PA0 是引脚名字', plain: 'P 表示端口引脚，A 是一组，0 是这一组里的编号。板上可能简写成 A0。', technical: 'PA0 是 GPIOA 的第 0 位。芯片封装的物理脚号、开发板排针位置与 PA0 这个信号名是不同的编号系统。', example: '代码中的 GPIOA 和 GPIO_Pin_0 一起选中 PA0。' },
      { title: 'GND 是共同的零点', plain: '说一根线有 3.3V，是在说它相对选定的地高出 3.3V。', technical: '电压是两点电势差。常见非隔离电路使用共同参考地；完整电流路径仍由实际接线决定。', example: '万用表黑表笔接 GND，红表笔接 3V3，读取两者之间的电压。' }
    ],
    termMap: [['A 组的 0 号脚', 'PA0'], ['电压的共同零点', '参考地 GND']],
    commonMisunderstanding: '“引脚编号 0”不是“接地”；PA0 与 GND 是不同端子。',
    checks: [
      { question: 'GPIOB 与 GPIO_Pin_0 组合起来选中哪个引脚？', answer: 'PB0，不是 PA0。' },
      { question: '测 PA0 电压时，为什么还要确定黑表笔接哪里？', answer: '电压是两点之间的电势差，必须知道参考点。通常接开发板 GND。' },
      { question: 'USB 朝上与 USB 朝下时，同一个引脚在画面中的位置是否相同？', answer: '位置会随板子旋转改变，但引脚名称不变；接线应核对丝印和当前朝向。' }
    ]
  },
  {
    id: 'output', title: '点灯的两个动作：配置输出，再改变电平', exampleId: 'blink',
    intro: '先让引脚具备输出职责，再让它输出高或低。',
    concepts: [
      { title: '初始化是在安排职责', plain: '先打开端口时钟，再填好配置表，最后按“应用”。', technical: '对应 RCC 时钟使能、GPIO_InitTypeDef 成员设置与 GPIO_Init 调用。输入/输出模式决定实际驱动路径。', example: 'gpio.GPIO_Mode = GPIO_Mode_Out_PP; GPIO_Init(GPIOA, &gpio);' },
      { title: '高低电平与亮灭要结合接线', plain: '本例外接灯高电平亮；板载 PC13 灯的接法不同，低电平才亮。', technical: 'LED 的正向电流由两端电压与串联电阻共同决定。高有效和低有效是电路/信号语义，不是函数名固定指定。', example: 'PA0 示例使用 SetBits 点亮；PC13 示例使用 ResetBits 点亮。' }
    ],
    termMap: [['安排引脚职责', 'GPIO 初始化'], ['写高/写低', '置位/清除输出锁存位']],
    commonMisunderstanding: 'GPIO_SetBits 的意思是设输出位为 1，不能直接背成“开灯函数”。',
    checks: [
      { question: '只写 gpio.GPIO_Mode，没调用 GPIO_Init，配置已经应用了吗？', answer: '没有。你只修改了配置变量，还没有把设置应用到端口。' },
      { question: '为什么 PC13 上 SetBits 可能让灯灭？', answer: '这块参考板的 LED 接在 3V3 与 PC13 之间，PC13 拉低时才形成点亮方向的电流。' },
      { question: '同一根引脚输出高，另一根输出低，能直接用导线连接吗？', answer: '不能作为普通接线随意连接。两个推挽输出会争用，可能导致过流。' }
    ]
  },
  {
    id: 'timing', title: '看懂闪烁：等待时间与完整周期', exampleId: 'blink',
    intro: '只区分“每次保持多久”和“一整轮多久”。',
    concepts: [
      { title: 'Delay_ms 让当前状态保持一段时间', plain: '灯亮后等半秒，这半秒里它仍保持刚才的输出状态。', technical: '本平台把延时建模为虚拟时间推进。实体 Delay 实现可能使用忙等待、SysTick 或其他计时方式。', example: 'GPIO_SetBits(...); Delay_ms(500);' },
      { title: '一个周期要把亮和灭都算上', plain: '亮半秒，再灭半秒，合起来一整轮是一秒。', technical: '周期 T 为重复波形的一整段时间；频率 f=1/T。单位应统一，例如 1000ms=1s。', example: '高 200ms、低 800ms：周期 1s，频率 1Hz，占高电平时间的比例为 20%。' }
    ],
    termMap: [['等多久', '延时'], ['重复一轮多久', '周期 T'], ['一秒重复几轮', '频率 f']],
    commonMisunderstanding: '把亮 500ms、灭 500ms 误认为周期只有 500ms。',
    checks: [
      { question: '亮 100ms、灭 900ms，一轮多久？', answer: '1000ms，也就是 1s。' },
      { question: '两个 Delay_ms(500) 都改成 1000，频率变成多少？', answer: '一轮 2s，频率 0.5Hz。' },
      { question: '把平台播放速度改快，会修改源码里的 500ms 吗？', answer: '不会。它改变演示推进速度，不改变代码表达的虚拟时间。' }
    ]
  },
  {
    id: 'input', title: '读取按钮：输入模式与低电平有效', exampleId: 'button',
    intro: '先观察电平，再写判断，不凭直觉把按下当成 1。',
    concepts: [
      { title: '上拉给松手状态一个默认值', plain: '没有按下时，内部弱上拉让 PB1 保持偏高。按下后，按钮把它接向 GND。', technical: 'GPIO_Mode_IPU 选择输入上拉，外部闭合到地的按键形成低有效信号。', example: '按钮松开读 1，按住读 0。' },
      { title: 'if 把读数变成动作', plain: '先问“是不是 0”，是就亮灯，不是就熄灯。', technical: 'GPIO_ReadInputDataBit 返回数字状态；== 比较是否相等，if/else 选择执行分支。', example: 'if (GPIO_ReadInputDataBit(GPIOB, GPIO_Pin_1) == 0) { ... }' }
    ],
    termMap: [['默认偏高', '内部弱上拉'], ['按下读 0', '低电平有效']],
    commonMisunderstanding: '一个周期性延时不自动等于可靠的按键消抖；本例先学习按住控制。',
    checks: [
      { question: '上拉输入、按钮接地，松开通常读几？', answer: '读 1。' },
      { question: '把判断 == 0 改成 == 1，会看到什么？', answer: '按本例其他代码不变，松开时灯亮、按下时灯灭。' },
      { question: '按钮一端接输入脚，另一端什么也没接，能保证按下读 0 吗？', answer: '不能。必须有确定的接地路径与正确接线。' }
    ]
  },
  {
    id: 'struct', title: '读懂三行配置：结构体与取地址', exampleId: 'blink',
    intro: '现在只理解“配置表”和“表在哪里”，不要求一次学完指针。',
    concepts: [
      { title: '结构体把相关设置装在一起', plain: 'gpio 这张表里有选脚、模式、速度等格子。点号后面是格子的名字。', technical: 'GPIO_InitTypeDef 是结构体类型；gpio 是结构体对象；. 访问对象成员。', example: 'gpio.GPIO_Pin = GPIO_Pin_0;' },
      { title: '&gpio 是这张表的地址', plain: '把表的位置告诉函数，函数才能读到你填的内容。', technical: '取地址运算符 & 产生指向对象的指针。GPIO_Init 的参数要求一个 GPIO_InitTypeDef 指针。', example: 'GPIO_Init(GPIOA, &gpio);' }
    ],
    termMap: [['一张配置表', '结构体对象'], ['表中的一格', '成员'], ['表放在哪里', '对象地址/指针值']],
    commonMisunderstanding: '不是所有函数都要给参数加 &；要看函数声明要求值还是地址。',
    checks: [
      { question: 'GPIO_InitTypeDef gpio 中，哪个是类型名，哪个是自己取的变量名？', answer: 'GPIO_InitTypeDef 是类型名，gpio 是变量名。' },
      { question: '把 gpio 改名为 config，可以吗？', answer: '可以，但相关使用处要统一改名，结构体类型和成员名不随意更改。' },
      { question: 'GPIO_Init(GPIOA, &gpio) 中的 & 与两数字做按位与相同吗？', answer: '不是。这里是一元取地址运算符；两者使用同一符号但语法位置和含义不同。' }
    ]
  },
  {
    id: 'files', title: '组织自己的代码：函数与文件分工', exampleId: 'multifile',
    intro: '把“什么时候做”和“具体怎么做”分开，主程序会更容易读。',
    concepts: [
      { title: '函数给一组动作起名字', plain: '以后读到 LED_On，就知道是在安排开灯动作，再进入函数看它怎么控制引脚。', technical: '函数定义封装语句序列，通过调用执行。名字的含义由实现决定。', example: 'void LED_On(void) { GPIO_SetBits(GPIOA, GPIO_Pin_0); }' },
      { title: '头文件声明接口，源文件提供实现', plain: 'LED.h 列出有哪些动作，LED.c 写动作步骤，main.c 负责安排。', technical: '头文件通常向编译单元提供声明；源文件中的定义需要参与编译与链接。本平台按支持范围解析导入项目。', example: 'LED.h: void LED_On(void);  LED.c: void LED_On(void) { ... }' }
    ],
    termMap: [['动作的名字和入口', '函数接口'], ['动作的具体步骤', '函数体'], ['接口目录', '头文件']],
    commonMisunderstanding: '只有 LED.h 不代表已经拥有 LED_On 的函数实现。',
    checks: [
      { question: '只想改变闪烁快慢，优先改哪个文件？', answer: '本示例优先改 main.c 中的 Delay_ms 参数。' },
      { question: '想把 LED 从 PA0 换到别处，需要检查什么？', answer: '检查接线、LED.c 中端口时钟、初始化和开关函数的引脚，保持一致。' },
      { question: '为什么调用了 LED_On，却报找不到函数实现？', answer: '可能漏导入 LED.c、名字不一致，或只提供了声明没有定义。' }
    ]
  },
  {
    id: 'pwm', title: 'PWM 的两个数字：频率与占空比', exampleId: 'pwm',
    intro: '先看“重复多快”，再看“每轮亮多久”。',
    concepts: [
      { title: '频率决定每秒重复多少轮', plain: '保持节奏足够快，灯光会表现出稳定的平均亮度。', technical: '本例向上计数、边沿对齐，fPWM=fTIM/((PSC+1)(ARR+1))。这里的教学时钟假设 fTIM=72MHz。', example: 'PSC=71、ARR=999，得到 1000Hz。' },
      { title: '占空比决定每轮有效时间比例', plain: '每轮有一半时间亮着，就是约 50% 占空比。', technical: '本例 PWM1、高有效时，占空比由 CCR/(ARR+1) 确定，超过边界时需按输出规则处理。', example: 'ARR=999，CCR=500 → 约 50%。' }
    ],
    termMap: [['一秒几轮', '频率'], ['一轮中有效时间占多少', '占空比']],
    commonMisunderstanding: 'GPIO_Speed_2MHz 不是 PWM 输出频率；人眼感知亮度也不严格与占空比成正比。',
    checks: [
      { question: 'ARR=999 时，CCR=250 大约是多少占空比？', answer: '25%，因为周期包含 1000 个计数位置。' },
      { question: '只改 CCR，一般会改变本例的 PWM 周期吗？', answer: '不会，周期由定时器时钟、PSC、ARR 决定；CCR 改变比较位置和占空比。' },
      { question: '把这个 1kHz 波形原样接给任意舵机，一定能用吗？', answer: '不能。舵机有自己的周期、有效脉宽与电气要求，需按具体型号配置。' }
    ]
  },
  {
    id: 'adc', title: '读取旋钮：电压与 ADC 数字', exampleId: 'adc',
    intro: '把看得见的旋钮位置、可测量的电压、程序中的数字对应起来。',
    concepts: [
      { title: '电位器滑动端提供中间电压', plain: '两端接 3V3 和 GND，中间端的位置改变时，输出电压也跟着变化。', technical: '电位器作为分压器使用，负载效应和接触特性会影响实际输出。本模型提供理想比例输入。', example: '滑动端接 PA1；旋钮从低端转向高端，电压上升。' },
      { title: 'ADC 把电压映射成整数码', plain: 'STM32F103 的 12 位 ADC 能把范围分成 4096 个编号，编号是 0～4095。', technical: 'ADC 码值取决于输入和参考电压；量化、偏置、增益和噪声使真实结果偏离理想映射。', example: '本例大于 2048 就开灯，在中间位置附近发生状态切换。' }
    ],
    termMap: [['旋钮中间端', '滑动端/分压输出'], ['量电压得到的整数', 'ADC 转换码']],
    commonMisunderstanding: '显示 4095 是到达码值上限，不表示再加更高电压也安全。',
    checks: [
      { question: '12 位 ADC 一共有多少个数字编码？', answer: '4096 个，编号从 0 到 4095。' },
      { question: 'PA1 应选本例的哪个 ADC 通道？', answer: 'ADC_Channel_1。' },
      { question: '只调用 ADC_GetConversionValue 就一定启动了新测量吗？', answer: '没有。它读取结果，转换还需按配置触发，并确认完成。' }
    ]
  },
  {
    id: 'uart', title: '串口通信：发送方向与字符编码', exampleId: 'uart',
    intro: '先能发一个字母、收到一个字母，再去学复杂协议。',
    concepts: [
      { title: 'TX 对接 RX，双方参数一致', plain: '发送端接到对方接收端，再约定相同速度和字符格式。', technical: '普通异步串口需要匹配波特率与帧格式，采用兼容电平并建立正确参考地。', example: '本例 USART1 使用 9600、8N1。' },
      { title: '发送的是数字，字符是约定的解释', plain: '字符 A 对应一个编码；发数字 65，接收端按 ASCII 显示时会看到 A。', technical: '字符编码、字节序列和显示格式分属不同层面。USART 传输数据位，本身不理解文本含义。', example: "发送 '6' 再发送 '5'，文本窗口才会看到两位字符 65。" }
    ],
    termMap: [['发出数据的端', 'TX'], ['接收数据的端', 'RX'], ['双方约定的速度', '波特率']],
    commonMisunderstanding: '发送整数 65，与发送文本“65”，不是同一串字节。',
    checks: [
      { question: 'PA9 是本例的 TX，应该接转换器的 TX 还是 RX？', answer: '接转换器 RX，并正确连接 GND。' },
      { question: 'USART_SendData(USART1, 65) 按 ASCII 显示是什么？', answer: 'A。' },
      { question: 'TXE 与 TC 能不加区分地互换吗？', answer: '不能。TXE 是发送数据寄存器空，TC 才表示整个发送过程完成。' }
    ]
  }
];

/** Pure, local explanation helper. It explains known statements, not arbitrary C semantics. */
export function explainLine(sourceLine) {
  const raw = String(sourceLine ?? '');
  const line = raw.replace(/\/\/.*$/, '').trim();
  const make = (title, plain, technical, gotcha, ids = []) => ({
    title, plain, technical, gotcha,
    related: ids.map(id => glossary.find(entry => entry.id === id)).filter(Boolean)
  });
  if (!line) return make('这一行是注释或空行', '注释是给人看的说明，空行帮助排版。', 'C 的注释和空白不会直接执行为一项硬件动作。', '注释写“灯亮”不能替代真正的接线和代码。');
  const port = line.match(/GPIO([ABC])\b/)?.[1];
  const pinNumbers = [...line.matchAll(/GPIO_Pin_(\d+)\b/g)].map(match => Number(match[1]));
  const pins = pinNumbers.length ? pinNumbers.map(n => port ? `P${port}${n}` : `第 ${n} 号引脚`).join('、') : '选中的引脚';
  if (/\bRCC_APB[12]PeriphClockCmd\s*\(/.test(line)) {
    const clockPorts = [...line.matchAll(/RCC_APB2Periph_GPIO([ABC])\b/g)].map(m => `GPIO${m[1]}`);
    const enabled = /\bDISABLE\b/.test(line) ? '关闭' : '打开';
    return make('先安排外设时钟', `${enabled}${clockPorts.length ? clockPorts.join('、') : '指定外设'}的工作时钟。`, 'RCC 的外设时钟使能与芯片供电是不同条件；应使用外设所属的 APB 分组。', '开 GPIOA 时钟不会顺便开 GPIOB。', ['RCC_APB2PeriphClockCmd','RCC_APB1PeriphClockCmd']);
  }
  if (/\bGPIO_SetBits\s*\(/.test(line)) return make('把输出位设为 1', `将 ${pins} 的输出锁存值设为 1。若配置为推挽输出且接线正常，它会尝试输出高电平。`, 'SetBits 设置指定输出位，不改其他位；开漏模式下写 1 是释放。', '灯是否亮取决于接法，PC13 板载灯通常在低电平时亮。', ['GPIO_SetBits','GPIO_Mode_Out_PP','GPIO_Mode_Out_OD']);
  if (/\bGPIO_ResetBits\s*\(/.test(line)) return make('把输出位清成 0', `将 ${pins} 的输出锁存值清成 0。若输出配置有效，它会尝试把线拉低。`, 'ResetBits 清除选定位，不是复位整颗芯片。', '本平台 PC13 板载灯会在输出低电平时点亮。', ['GPIO_ResetBits']);
  if (/\bGPIO_ReadInputDataBit\s*\(/.test(line)) return make('先读引脚，再决定动作', `读取 ${pins} 的数字输入状态：0 或 1。${/==\s*0/.test(line) ? '这一行在判断它是否为 0。' : ''}`, '读取的是输入数据位，不是测量精确电压。比较表达式决定分支条件。', '上拉且按键接地的例子中，按下读 0，松开读 1。', ['GPIO_ReadInputDataBit','GPIO_Mode_IPU','if']);
  if (/\bGPIO_Init\s*\(/.test(line)) return make('把配置表应用到引脚', `把配置变量里的设置应用到 ${port ? `GPIO${port}` : '指定端口'}。`, 'GPIO_Init 通过传入的结构体地址读取 Pin、Mode、Speed，配置相应引脚。', '前面的字段赋值只是填表；这里才应用，且需要对应时钟已打开。', ['GPIO_Init','GPIO_InitTypeDef','address_of']);
  const delay = line.match(/\bDelay_(ms|us|s)\s*\(\s*([^)]*)\)/);
  if (delay) {
    const unit = {ms:'毫秒',us:'微秒',s:'秒'}[delay[1]];
    return make('保持当前状态，等待一段时间', `等待 ${delay[2]} ${unit}，再执行后面的语句。`, '本平台推进虚拟时间；真实工程的延时精度取决于对应实现和系统时钟。', '亮和灭的保持时间要相加，才是一轮闪烁周期。', [delay[1] === 'us' ? 'Delay_us' : 'Delay_ms']);
  }
  if (/^\s*#include/.test(line)) {
    const name = line.match(/["<]([^">]+)[">]/)?.[1] ?? '相应头文件';
    return make('让程序认识接口名字', `引入 ${name} 中的类型、常量和函数声明。`, '真实 C 预处理会展开头文件；本平台对内置头文件使用支持范围内的接口模型。', '导入一个 .h 不能代替提供自定义函数的 .c 实现。', ['include','header_source']);
  }
  if (/\bGPIO_InitTypeDef\s+/.test(line)) {
    const variable = line.match(/GPIO_InitTypeDef\s+(\w+)/)?.[1] ?? '这个变量';
    return make('准备一张 GPIO 配置表', `创建名叫 ${variable} 的配置变量，接下来逐项填写引脚、模式和速度。`, 'GPIO_InitTypeDef 是结构体类型；变量是该类型的一个对象。', '创建配置变量还没有改变真实引脚模式。', ['GPIO_InitTypeDef','struct_member']);
  }
  if (/\.GPIO_Pin\s*=/.test(line)) return make('选择要配置的引脚', `在配置表中勾选${pins}。`, 'GPIO_Pin_n 是位掩码，按位或 | 可组合多个引脚。', '这里还没有应用配置，接下来需调用 GPIO_Init。', ['GPIO_Pin_0','bitwise_or','GPIO_Init']);
  if (/\bwhile\s*\(\s*1\s*\)/.test(line)) return make('不断重复主循环', '重复执行大括号里的动作，适合持续看按钮、控制灯等任务。', '常量 1 为真，所以循环不会因为条件变假而自然结束；平台可用暂停键中止。', '主循环本身是常见写法；要区分正常持续工作和卡在错误等待条件。', ['while']);
  if (/\bfor\s*\(/.test(line)) return make('按计数规则重复', '括号里依次安排“从哪里开始、什么时候继续、每轮怎样改变”。', 'for 的初始化执行一次；每轮检查条件，执行循环体后再执行更新表达式。', '向下计数时要考虑变量是否无符号，避免越过零后回绕。', ['uint16_t','while']);
  if (/\bTIM_SetCompare[1-4]\s*\(/.test(line)) return make('调整 PWM 的比较值', '改变计数到哪里切换有效状态；在呼吸灯例子里，会改变灯的占空比。', '本例向上计数、PWM1、高有效，CCR/(ARR+1) 对应占空比。', '频率没有因此自动改变；频率还由时钟、PSC 和 ARR 决定。', ['TIM_SetCompare1','TIM_TimeBaseInit']);
  const found = glossary.find(entry => entry.keywords.some(keyword => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyword)) return false;
    return new RegExp(`\\b${keyword}\\b`).test(line);
  }));
  if (found) return make(found.name, found.plain, found.technical, found.gotcha, [found.id]);
  if (line === '{' || line === '}' || line === '};') return make('语句块的边界', line.startsWith('{') ? '从这里开始一组语句。' : '到这里结束这一组语句。', '花括号决定函数或控制结构的范围，并可能建立局部作用域。', '缩进帮助阅读，但不能替代花括号。');
  return make('把这行放回上下文理解', '先看它属于哪一个函数，以及操作的是哪个变量。可以在术语库搜索这一行的名字。', '逐行讲解覆盖已知语句模式，并不是通用 C 程序语义证明；执行结果以解析器和运行状态为准。', '看不懂时先定位“读取了什么、修改了什么、下一步去哪”，不必一次背下所有术语。');
}

export function findTerm(query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return glossary;
  return glossary.filter(entry => [entry.name, entry.signature, entry.plain, entry.technical, ...entry.keywords].some(value => value.toLowerCase().includes(needle)));
}

