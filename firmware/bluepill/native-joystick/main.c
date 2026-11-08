#include <stdint.h>
#include "joystick_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_CRH   REG32(0x40010804u)
#define GPIOB_CRL   REG32(0x40010C00u)
#define GPIOB_IDR   REG32(0x40010C08u)
#define GPIOB_BSRR  REG32(0x40010C10u)
#define ADC1_SR     REG32(0x40012400u)
#define ADC1_CR1    REG32(0x40012404u)
#define ADC1_CR2    REG32(0x40012408u)
#define ADC1_SMPR2  REG32(0x40012410u)
#define ADC1_SQR1   REG32(0x4001242Cu)
#define ADC1_SQR3   REG32(0x40012434u)
#define ADC1_DR     REG32(0x4001244Cu)
#define TIM2_CR1    REG32(0x40000000u)
#define TIM2_EGR    REG32(0x40000014u)
#define TIM2_CCMR1  REG32(0x40000018u)
#define TIM2_CCER   REG32(0x40000020u)
#define TIM2_PSC    REG32(0x40000028u)
#define TIM2_ARR    REG32(0x4000002Cu)
#define TIM2_CCR1   REG32(0x40000034u)
#define TIM2_CCR2   REG32(0x40000038u)
#define USART1_SR   REG32(0x40013800u)
#define USART1_DR   REG32(0x40013804u)
#define USART1_BRR  REG32(0x40013808u)
#define USART1_CR1  REG32(0x4001380Cu)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

#define CENTER 2048u
#define PWM_PERIOD 1000u
#define SELECT_PIN (1u << 1)

static volatile uint32_t sample_due = 1u;

void SysTick_Handler(void)
{
    sample_due = 1u;
}

static void adc_init(void)
{
    ADC1_CR1 = 0;
    ADC1_SMPR2 = (7u << 12) | (7u << 15); // 通道 4、5 使用长采样时间。
    ADC1_SQR1 = 0;
    ADC1_CR2 = (7u << 17) | (1u << 20) | 1u;
    for (unsigned wait = 0; wait < 32; wait++) __asm__ volatile ("nop");
    ADC1_CR2 |= 1u << 3;
    while (ADC1_CR2 & (1u << 3)) {}
    ADC1_CR2 |= 1u << 2;
    while (ADC1_CR2 & (1u << 2)) {}
}

static uint32_t adc_read(unsigned channel)
{
    // 每次只转换一个通道。切换 SQR3 后，再由软件触发下一次读取。
    ADC1_SQR3 = channel;
    ADC1_CR2 |= 1u << 22;
    while (!(ADC1_SR & (1u << 1))) {}
    return ADC1_DR & 0xFFFu;
}

static void pwm_init(void)
{
    TIM2_CR1 = 1u << 7;
    TIM2_PSC = 7u;
    TIM2_ARR = PWM_PERIOD - 1u; // 8 MHz / 8 / 1000 = 1 kHz。
    TIM2_CCMR1 = (6u << 4) | (1u << 3) | (6u << 12) | (1u << 11);
    TIM2_CCR1 = 0;
    TIM2_CCR2 = 0;
    TIM2_CCER = (1u << 0) | (1u << 4);
    TIM2_EGR = 1u;
    TIM2_CR1 |= 1u;
}

static uint32_t duty_from_sample(uint32_t sample)
{
    const uint32_t distance = sample >= CENTER ? sample - CENTER : CENTER - sample;
    if (distance <= DEAD_ZONE) return 0;
    return (distance - DEAD_ZONE) * PWM_PERIOD / (CENTER - DEAD_ZONE);
}

static void send(char value)
{
    while (!(USART1_SR & (1u << 7))) {}
    USART1_DR = (uint8_t)value;
}

static void decimal(uint32_t value)
{
    char digits[4];
    unsigned size = 0;
    do {
        digits[size++] = (char)('0' + value % 10u);
        value /= 10u;
    } while (value);
    while (size) send(digits[--size]);
}

static void report(uint32_t x, uint32_t y, uint32_t duty_x, uint32_t duty_y, uint32_t pressed)
{
    for (const char *prefix = "STICK="; *prefix; prefix++) send(*prefix);
    decimal(x); send(','); decimal(y); send(',');
    decimal(duty_x); send(','); decimal(duty_y); send(','); decimal(pressed); send('\n');
}

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 3) | (1u << 9) | (1u << 14);
    RCC_APB1ENR |= 1u;
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    // PA0/PA1 为 TIM2 两路 PWM，PA4/PA5 为模拟输入，PB1 上拉读取轴开关。
    GPIOA_CRL = (GPIOA_CRL & ~0x00FF00FFu) | 0xAAu;
    GPIOA_CRH = (GPIOA_CRH & ~(0xFu << 4)) | (0xAu << 4);
    GPIOB_BSRR = SELECT_PIN;
    GPIOB_CRL = (GPIOB_CRL & ~(0xFu << 4)) | (0x8u << 4);
    USART1_BRR = 208u; // 8 MHz HSI，约 38400 baud。
    USART1_CR1 = (1u << 13) | (1u << 3);
    adc_init();
    pwm_init();
    SYST_RVR = 400000u - 1u; // 每 50 ms 采样一次。
    SYST_CVR = 0;
    SYST_CSR = 7u;

    uint32_t last_x = 4096u, last_y = 4096u, last_pressed = 2u;
    for (;;) {
        if (!sample_due) continue;
        sample_due = 0;
        const uint32_t x = adc_read(4), y = adc_read(5);
        const uint32_t pressed = (GPIOB_IDR & SELECT_PIN) == 0;
        const uint32_t duty_x = pressed ? 0 : duty_from_sample(x);
        const uint32_t duty_y = pressed ? 0 : duty_from_sample(y);
        TIM2_CCR1 = duty_x;
        TIM2_CCR2 = duty_y;
        if (x != last_x || y != last_y || pressed != last_pressed) {
            report(x, y, duty_x, duty_y, pressed);
            last_x = x;
            last_y = y;
            last_pressed = pressed;
        }
    }
}
