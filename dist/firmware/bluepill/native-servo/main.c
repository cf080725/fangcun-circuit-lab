#include <stdint.h>
#include "servo_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
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
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

#define CORE_HZ 8000000u
#define SERVO_HZ 50u
#define SERVO_PERIOD_US (1000000u / SERVO_HZ)

static volatile uint32_t sample_due;

void SysTick_Handler(void)
{
    sample_due = 1u;
}

static void adc_init(void)
{
    ADC1_CR1 = 0;
    ADC1_SMPR2 = 7u << 12; // ADC1 通道 4 长采样，239.5 个 ADC 时钟周期。
    ADC1_SQR1 = 0;         // 规则序列只有一个通道。
    ADC1_SQR3 = 4u;        // PA4 对应 ADC1_IN4。
    ADC1_CR2 = (7u << 17) | (1u << 20) | 1u; // 软件触发，启用 ADC1。
    for (unsigned wait = 0; wait < 32; wait++) __asm__ volatile ("nop");
    ADC1_CR2 |= 1u << 3; // 复位校准寄存器。
    while (ADC1_CR2 & (1u << 3)) {}
    ADC1_CR2 |= 1u << 2; // 启动校准，等待硬件完成。
    while (ADC1_CR2 & (1u << 2)) {}
}

static uint32_t adc_read(void)
{
    ADC1_CR2 |= 1u << 22; // SWSTART。
    while (!(ADC1_SR & (1u << 1))) {} // EOC，转换完成。
    return ADC1_DR & 0xFFFu;
}

static void pwm_init(uint32_t pulse_us)
{
    TIM2_CR1 = 1u << 7; // ARR 预装载。
    TIM2_PSC = CORE_HZ / 1000000u - 1u; // 8 MHz HSI，每个计数 1 µs。
    TIM2_ARR = SERVO_PERIOD_US - 1u;    // 计数 0–19999，一周期 20 ms。
    TIM2_CCMR1 = (6u << 4) | (1u << 3); // 通道 1，PWM 模式 1、预装载。
    TIM2_CCR1 = pulse_us;
    TIM2_CCER = 1u; // 使能 CH1，高有效。
    TIM2_EGR = 1u;  // 装载分频、周期和初始脉宽。
    TIM2_CR1 |= 1u;
}

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 9); // GPIOA、ADC1。
    RCC_APB1ENR |= 1u; // TIM2。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    GPIOA_CRL = (GPIOA_CRL & ~((0xFu << 16) | 0xFu)) | 0xAu;
    // PA4 模拟输入；PA0 是 TIM2_CH1 的复用推挽输出。
    adc_init();
    pwm_init(servo_pulse_us(adc_read()));

    SYST_RVR = CORE_HZ / SERVO_HZ - 1u; // 每 20 ms 读取一次旋钮。
    SYST_CVR = 0;
    SYST_CSR = 7u;
    for (;;) {
        if (!sample_due) continue;
        sample_due = 0;
        TIM2_CCR1 = servo_pulse_us(adc_read());
    }
}
