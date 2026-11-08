#include <stdint.h>
#include "light_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define ADC1_SR     REG32(0x40012400u)
#define ADC1_CR1    REG32(0x40012404u)
#define ADC1_CR2    REG32(0x40012408u)
#define ADC1_SMPR2  REG32(0x40012410u)
#define ADC1_SQR1   REG32(0x4001242Cu)
#define ADC1_SQR3   REG32(0x40012434u)
#define ADC1_DR     REG32(0x4001244Cu)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

#define LED_PIN 1u // PA0。
#define CORE_HZ 8000000u // 上电的 HSI 8 MHz。
#define SAMPLE_HZ 50u

static volatile uint32_t sample_due = 1u;

void SysTick_Handler(void)
{
    sample_due = 1u;
}

static void adc_init(void)
{
    ADC1_CR1 = 0;
    ADC1_SMPR2 = 7u << 3; // 通道 1 选 239.5 个周期，给高阻分压充分采样时间。
    ADC1_SQR1 = 0;        // 规则序列只转换一个通道。
    ADC1_SQR3 = 1u;       // ADC1_IN1 对应 PA1。
    ADC1_CR2 = (7u << 17) | (1u << 20) | 1u; // 软件触发，启用 ADC1。
    for (unsigned wait = 0; wait < 32; wait++) __asm__ volatile ("nop");
    ADC1_CR2 |= 1u << 3; // 复位校准寄存器。
    while (ADC1_CR2 & (1u << 3)) {}
    ADC1_CR2 |= 1u << 2; // 启动校准，等待完成。
    while (ADC1_CR2 & (1u << 2)) {}
}

static uint32_t sample_light(void)
{
    ADC1_CR2 |= 1u << 22; // 软件开始一次规则转换。
    while (!(ADC1_SR & (1u << 1))) {} // 等待 EOC。
    return ADC1_DR & 0xFFFu;
}

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 9); // GPIOA 和 ADC1。
    (void)RCC_APB2ENR;
    GPIOA_BSRR = LED_PIN << 16; // 初始熄灯，直到读到第一笔有效数据。
    GPIOA_CRL = (GPIOA_CRL & ~0xFFu) | 0x2u; // PA0 推挽输出，PA1 模拟输入。
    adc_init();

    SYST_RVR = CORE_HZ / SAMPLE_HZ - 1u; // 每 20 ms 采样一次。
    SYST_CVR = 0;
    SYST_CSR = 7u;
    for (;;) {
        if (!sample_due) continue;
        sample_due = 0;
        const uint32_t value = sample_light();
        // 暗处的光敏电阻更大，PA1 电压更低。低于阈值时点亮报警灯。
        GPIOA_BSRR = value < DARK_ADC_THRESHOLD ? LED_PIN : LED_PIN << 16;
    }
}
