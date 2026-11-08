#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_ODR   REG32(0x4001080Cu)
#define GPIOA_BSRR  REG32(0x40010810u)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)
#define LD2_PIN     (1u << 5)

void SysTick_Handler(void)
{
    // LD2 接在 PA5，高电平点亮。每次中断翻转输出。
    GPIOA_BSRR = (GPIOA_ODR & LD2_PIN) != 0 ? LD2_PIN << 16 : LD2_PIN;
}

int main(void)
{
    RCC_APB2ENR |= 1u << 2;                 // 开启 GPIOA 时钟。
    (void)RCC_APB2ENR;
    GPIOA_CRL = (GPIOA_CRL & ~(0xFu << 20)) | (0x2u << 20); // PA5 推挽输出。
    GPIOA_BSRR = LD2_PIN;

    // 使用复位后的 8 MHz HSI。4,000,000 个时钟周期对应 500 ms。
    SYST_RVR = 4000000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;                        // 核心时钟、计数与中断。

    for (;;) {
        // 主循环保持运行，由 SysTick 中断切换 LD2。
    }
}
