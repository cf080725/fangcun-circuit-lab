#include <stdint.h>
#include "led_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define GPIOC_CRH   REG32(0x40011004u)
#define GPIOC_IDR   REG32(0x40011008u)
#define LD2_PIN     (1u << 5)
#define B1_PIN      (1u << 13)

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 4); // 开启 GPIOA 和 GPIOC 时钟。
    (void)RCC_APB2ENR;

    GPIOA_BSRR = LD2_PIN << 16;
    GPIOA_CRL = (GPIOA_CRL & ~(0xFu << 20)) | (0x2u << 20); // PA5 推挽输出。
    GPIOC_CRH = (GPIOC_CRH & ~(0xFu << 20)) | (0x4u << 20); // PC13 数字输入。

    for (;;) {
        // B1 松开时由板载电阻上拉，按下时 PC13 接地。
        bool pressed = (GPIOC_IDR & B1_PIN) == 0;
        GPIOA_BSRR = led_should_light(pressed) ? LD2_PIN : LD2_PIN << 16;
    }
}
