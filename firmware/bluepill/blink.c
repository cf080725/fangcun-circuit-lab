#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOC_CRH   REG32(0x40011004u)
#define GPIOC_ODR   REG32(0x4001100Cu)
#define GPIOC_BSRR  REG32(0x40011010u)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

void SysTick_Handler(void)
{
    // PC13 低电平点亮。每次中断读取当前电平并翻转。
    if ((GPIOC_ODR & (1u << 13)) != 0) {
        GPIOC_BSRR = 1u << (13 + 16);
    } else {
        GPIOC_BSRR = 1u << 13;
    }
}

int main(void)
{
    RCC_APB2ENR |= 1u << 4;                // 开启 GPIOC 时钟。
    (void)RCC_APB2ENR;
    GPIOC_BSRR = 1u << 13;                 // PC13 高电平时，板载灯熄灭。
    GPIOC_CRH = (GPIOC_CRH & ~(0xFu << 20)) | (0x2u << 20);
    GPIOC_BSRR = 1u << (13 + 16);          // 从点亮状态开始。

    // 使用复位后的 8 MHz HSI。SysTick 每 4,000,000 个时钟周期归零。
    SYST_RVR = 4000000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;                       // 使用核心时钟并开启 SysTick 中断。

    for (;;) {
        // 灯的翻转由 SysTick 中断完成，主循环保持运行。
    }
}
