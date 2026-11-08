#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
#define TIM2_CR1    REG32(0x40000000u)
#define TIM2_SR     REG32(0x40000010u)
#define TIM2_EGR    REG32(0x40000014u)
#define TIM2_CCMR1  REG32(0x40000018u)
#define TIM2_CCER   REG32(0x40000020u)
#define TIM2_PSC    REG32(0x40000028u)
#define TIM2_ARR    REG32(0x4000002Cu)
#define TIM2_CCR1   REG32(0x40000034u)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

void SysTick_Handler(void)
{
    // CCR1 已开启预装载。新占空比在下一个 PWM 周期开始时生效。
    TIM2_CCR1 = TIM2_CCR1 == 250u ? 750u : 250u;
}

int main(void)
{
    RCC_APB2ENR |= 1u << 2;                // 打开 GPIOA 时钟。
    RCC_APB1ENR |= 1u;                     // 打开 TIM2 时钟。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    GPIOA_CRL = (GPIOA_CRL & ~0xFu) | 0xAu; // PA0 为 TIM2_CH1 复用推挽输出。

    TIM2_CR1 = 1u << 7;                    // 先打开自动重载预装载，保持计数器关闭。
    TIM2_PSC = 7u;                         // 8 MHz / 8 = 1 MHz 计数时钟。
    TIM2_ARR = 999u;                       // 计数 1000 次组成一个 1 kHz 周期。
    TIM2_CCMR1 = (6u << 4) | (1u << 3);    // PWM 模式 1，开启 CCR1 预装载。
    TIM2_CCR1 = 250u;                      // 高电平 250 次计数，初始占空比 25%。
    TIM2_CCER = 1u;                        // 通道 1 高有效，启用输出。
    TIM2_EGR = 1u;                         // 产生一次更新事件，使初始参数生效。
    TIM2_SR = 0;
    TIM2_CR1 |= 1u;                        // 启动 TIM2。

    SYST_RVR = 4000000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;                       // 每 500 ms 切换 25% / 75%。

    for (;;) {
        // TIM2 持续输出 PWM，主循环无需手动改变 PA0。
    }
}
