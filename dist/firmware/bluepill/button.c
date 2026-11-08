#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define GPIOB_CRL   REG32(0x40010C00u)
#define GPIOB_IDR   REG32(0x40010C08u)
#define GPIOB_BSRR  REG32(0x40010C10u)

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 3); // 开启 GPIOA、GPIOB 时钟。
    (void)RCC_APB2ENR;

    GPIOA_BSRR = 1u << 16;
    GPIOA_CRL = (GPIOA_CRL & ~0xFu) | 0x2u; // PA0 为 2 MHz 推挽输出。
    GPIOB_BSRR = 1u << 1;                  // 选择 PB1 内部上拉。
    GPIOB_CRL = (GPIOB_CRL & ~(0xFu << 4)) | (0x8u << 4);

    // 按键接在 PB1 和 GND 之间。按下时 PB1 变低，PA0 输出高电平。
    for (;;) {
        if ((GPIOB_IDR & (1u << 1)) == 0) {
            GPIOA_BSRR = 1u;               // 点亮外接 LED。
        } else {
            GPIOA_BSRR = 1u << 16;         // 熄灭外接 LED。
        }
    }
}
