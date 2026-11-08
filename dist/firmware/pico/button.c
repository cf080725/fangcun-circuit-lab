#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RESETS_CLEAR   REG32(0x4000F000u)
#define RESETS_DONE    REG32(0x4000C008u)
#define GPIO_CTRL(pin) REG32(0x40014004u + (pin) * 8u)
#define GPIO_PAD(pin)  REG32(0x4001C004u + (pin) * 4u)
#define GPIO_IN        REG32(0xD0000004u)
#define GPIO_OUT_SET   REG32(0xD0000014u)
#define GPIO_OUT_CLR   REG32(0xD0000018u)
#define GPIO_OE_SET    REG32(0xD0000024u)
#define GPIO_OE_CLR    REG32(0xD0000028u)

int main(void)
{
    const uint32_t resets = (1u << 5) | (1u << 8);
    RESETS_CLEAR = resets;                 // 释放 IO_BANK0 和 PADS_BANK0 的复位。
    while ((RESETS_DONE & resets) != resets) {
    }

    const uint32_t button = 1u << 14;
    const uint32_t led = 1u << 15;
    GPIO_OE_CLR = button;
    GPIO_PAD(14) = (GPIO_PAD(14) & ~0x04u) | 0x48u; // GP14 输入使能，关闭下拉，打开上拉。
    GPIO_CTRL(14) = 5u;

    GPIO_OUT_CLR = led;
    GPIO_PAD(15) &= ~0x8Cu;
    GPIO_CTRL(15) = 5u;                   // GP15 使用 SIO 驱动外接 LED。
    GPIO_OE_SET = led;

    for (;;) {
        // 按键把 GP14 接到 GND。按下时 GP14 为低，点亮 GP15 的灯。
        if ((GPIO_IN & button) == 0) {
            GPIO_OUT_SET = led;
        } else {
            GPIO_OUT_CLR = led;
        }
    }
}
