#include <stdint.h>
#include "relay_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
#define TIM2_CR1    REG32(0x40000000u)
#define TIM2_EGR    REG32(0x40000014u)
#define TIM2_CCMR1  REG32(0x40000018u)
#define TIM2_CCER   REG32(0x40000020u)
#define TIM2_PSC    REG32(0x40000028u)
#define TIM2_ARR    REG32(0x4000002Cu)
#define TIM2_CCR1   REG32(0x40000034u)

int main(void)
{
    RCC_APB2ENR |= 1u << 2; // GPIOA 时钟。
    RCC_APB1ENR |= 1u << 0; // TIM2 时钟。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    GPIOA_CRL = (GPIOA_CRL & ~0xFu) | 0xAu; // PA0 复用推挽，仅驱动模块 SIG。

    TIM2_CR1 = 1u << 7; // 启用自动重装载预装载。
    TIM2_PSC = 7999u; // 8 MHz HSI 除以 8000，每一计数为 1 ms。
    TIM2_ARR = PERIOD_MS - 1u;
    TIM2_CCMR1 = (6u << 4) | (1u << 3); // PWM1，CNT < CCR1 时输出高电平。
    TIM2_CCR1 = PULSE_MS;
    TIM2_CCER = 1u; // CH1 高有效。
    TIM2_EGR = 1u; // 把预装载数值写入活动寄存器，重新开始计数。
    TIM2_CR1 |= 1u;

    // 之后由 TIM2 重复输出。CPU 循环不会直接切换继电器触点。
    for (;;) {}
}
