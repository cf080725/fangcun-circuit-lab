#include <stdint.h>
#include "rgb_levels.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
#define TIM2_CR1    REG32(0x40000000u)
#define TIM2_EGR    REG32(0x40000014u)
#define TIM2_CCMR1  REG32(0x40000018u)
#define TIM2_CCMR2  REG32(0x4000001Cu)
#define TIM2_CCER   REG32(0x40000020u)
#define TIM2_PSC    REG32(0x40000028u)
#define TIM2_ARR    REG32(0x4000002Cu)
#define TIM2_CCR1   REG32(0x40000034u)
#define TIM2_CCR2   REG32(0x40000038u)
#define TIM2_CCR3   REG32(0x4000003Cu)

#define PWM1_WITH_PRELOAD ((6u << 4) | (1u << 3))

int main(void)
{
    RCC_APB2ENR |= 1u << 2; // GPIOA 时钟。
    RCC_APB1ENR |= 1u << 0; // TIM2 时钟。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    GPIOA_CRL = (GPIOA_CRL & ~0xFFFu) | 0xAAAu; // PA0–PA2 复用推挽输出。

    TIM2_CR1 = 1u << 7; // ARR 预装载，向上计数。
    TIM2_PSC = 7u; // HSI 8 MHz，除以 8 后每个计数是 1 µs。
    TIM2_ARR = 999u; // 计数 0–999，一周期 1 ms，也就是 1 kHz。
    TIM2_CCMR1 = PWM1_WITH_PRELOAD | (PWM1_WITH_PRELOAD << 8);
    TIM2_CCMR2 = PWM1_WITH_PRELOAD;
    // 共阴极 RGB 灯，输出高电平时对应颜色的支路有电流。
    TIM2_CCR1 = RED_PWM_PERMILLE;   // PA0 → 470 Ω → R。
    TIM2_CCR2 = GREEN_PWM_PERMILLE; // PA1 → 470 Ω → G。
    TIM2_CCR3 = BLUE_PWM_PERMILLE;  // PA2 → 220 Ω → B。
    TIM2_CCER = (1u << 0) | (1u << 4) | (1u << 8); // 使能 CH1–CH3，高有效。
    TIM2_EGR = 1u; // 产生更新事件，将预装载值写入活动寄存器。
    TIM2_CR1 |= 1u; // 启动计数器，之后由硬件产生 PWM。

    for (;;) {}
}
