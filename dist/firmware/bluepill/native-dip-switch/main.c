#include <stdint.h>
#include "dip_switch_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_IDR   REG32(0x40010808u)
#define GPIOA_BSRR  REG32(0x40010810u)

#define LED_PIN (1u << 0)  // PA0 通过 330 Ω 电阻驱动外接 LED。
#define SW1_PIN (1u << 4)  // PA4 → 1 号开关。
#define SW2_PIN (1u << 3)  // PA3 → 2 号开关。
#define SW3_PIN (1u << 2)  // PA2 → 3 号开关。
#define SW4_PIN (1u << 1)  // PA1 → 4 号开关。

static uint32_t read_switch_mask(void)
{
    // 一次读取全部输入。闭合后引脚接地，所以先反转电平。
    const uint32_t closed = ~GPIOA_IDR;
    return ((closed & SW1_PIN) ? 1u : 0u)
         | ((closed & SW2_PIN) ? 2u : 0u)
         | ((closed & SW3_PIN) ? 4u : 0u)
         | ((closed & SW4_PIN) ? 8u : 0u);
}

int main(void)
{
    RCC_APB2ENR |= 1u << 2; // 使能 GPIOA 的 APB2 时钟。
    (void)RCC_APB2ENR;
    // 先把 PA0 输出锁存置低、PA1–PA4 的输出锁存置高，再配置引脚模式。
    // STM32F103 在上拉/下拉输入模式下，用输出锁存位选择上拉或下拉。
    GPIOA_BSRR = SW1_PIN | SW2_PIN | SW3_PIN | SW4_PIN | (LED_PIN << 16);
    GPIOA_CRL = (GPIOA_CRL & ~0xFFFFFu) | 0x88882u; // PA0 推挽 2 MHz，PA1–PA4 上拉输入。

    for (;;) {
        const uint32_t actual = read_switch_mask();
        GPIOA_BSRR = actual == MATCH_MASK ? LED_PIN : LED_PIN << 16;
    }
}
