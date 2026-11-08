#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define AFIO_MAPR   REG32(0x40010004u)
#define GPIOB_CRL   REG32(0x40010C00u)
#define TIM3_CR1    REG32(0x40000400u)
#define TIM3_SR     REG32(0x40000410u)
#define TIM3_EGR    REG32(0x40000414u)
#define TIM3_CCMR1  REG32(0x40000418u)
#define TIM3_CCER   REG32(0x40000420u)
#define TIM3_PSC    REG32(0x40000428u)
#define TIM3_ARR    REG32(0x4000042Cu)
#define TIM3_CCR1   REG32(0x40000434u)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

void SysTick_Handler(void)
{
    // 新比较值写入预装载寄存器，在下一个 PWM 周期生效。
    TIM3_CCR1 = TIM3_CCR1 == 250u ? 750u : 250u;
}

int main(void)
{
    RCC_APB2ENR |= (1u << 3) | 1u;        // 开启 GPIOB 和 AFIO 时钟。
    RCC_APB1ENR |= 1u << 1;               // 开启 TIM3 时钟。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    // TIM3 部分重映射使 CH1 接到 PB4。关闭 JTAG 释放 PB4，保留 SWD。
    AFIO_MAPR = (AFIO_MAPR & ~((3u << 10) | (7u << 24))) | (2u << 10) | (2u << 24);
    GPIOB_CRL = (GPIOB_CRL & ~(0xFu << 16)) | (0xAu << 16); // PB4 复用推挽输出。

    TIM3_CR1 = 1u << 7;                   // 启用自动重载预装载，先保持计数器关闭。
    TIM3_PSC = 7u;                        // 8 MHz / 8 = 1 MHz 计数时钟。
    TIM3_ARR = 999u;                      // 每 1000 次计数产生一个 1 kHz 周期。
    TIM3_CCMR1 = (6u << 4) | (1u << 3);   // PWM 模式 1，启用 CCR1 预装载。
    TIM3_CCR1 = 250u;                     // 初始占空比 25%。
    TIM3_CCER = 1u;                       // 通道 1 高有效，启用输出。
    TIM3_EGR = 1u;                        // 产生更新事件，使初始参数生效。
    TIM3_SR = 0;
    TIM3_CR1 |= 1u;

    SYST_RVR = 4000000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;                      // 每 500 ms 切换 25% / 75%。

    for (;;) {
        // TIM3 持续输出 PWM。外接 LED 的亮度随占空比变化。
    }
}
