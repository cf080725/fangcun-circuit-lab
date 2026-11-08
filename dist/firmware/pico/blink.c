#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define XOSC_CTRL       REG32(0x40024000u)
#define XOSC_STATUS     REG32(0x40024004u)
#define XOSC_STARTUP    REG32(0x4002400Cu)
#define CLK_REF_CTRL    REG32(0x40008030u)
#define CLK_REF_SELECTED REG32(0x40008038u)
#define CLK_SYS_CTRL    REG32(0x4000803Cu)
#define WATCHDOG_TICK   REG32(0x4005802Cu)
#define RESETS_CLEAR    REG32(0x4000F000u)
#define RESETS_DONE     REG32(0x4000C008u)
#define GPIO_CTRL(pin)  REG32(0x40014004u + (pin) * 8u)
#define GPIO_PAD(pin)   REG32(0x4001C004u + (pin) * 4u)
#define GPIO_OUT_SET    REG32(0xD0000014u)
#define GPIO_OUT_XOR    REG32(0xD000001Cu)
#define GPIO_OE_SET     REG32(0xD0000024u)
#define TIMER_US_LOW    REG32(0x40054028u)

int main(void)
{
    // Pico 的 12 MHz 晶体给硬件计时器提供稳定的 1 MHz 时基。
    XOSC_STARTUP = 47u;
    XOSC_CTRL = (0xFABu << 12) | 0xAA0u;
    while ((XOSC_STATUS & (1u << 31)) == 0) {
    }
    CLK_REF_CTRL = 2u;                    // clk_ref 选择 XOSC。
    while ((CLK_REF_SELECTED & (1u << 2)) == 0) {
    }
    CLK_SYS_CTRL = 0;                    // clk_sys 使用 clk_ref。
    WATCHDOG_TICK = (1u << 9) | 12u;     // 12 MHz 每 12 个周期计 1 μs。

    const uint32_t resets = (1u << 5) | (1u << 8) | (1u << 21);
    RESETS_CLEAR = resets;               // 释放 IO_BANK0、PADS_BANK0 和 TIMER 的复位。
    while ((RESETS_DONE & resets) != resets) {
    }

    // GP25 驱动板载灯，GP15 驱动实验电路中的外接灯。
    const uint32_t leds = (1u << 25) | (1u << 15);
    GPIO_OUT_SET = leds;
    GPIO_PAD(25) &= ~0x8Cu;              // 清除输出禁止位和上下拉。
    GPIO_PAD(15) &= ~0x8Cu;
    GPIO_CTRL(25) = 5u;                  // GPIO 功能 5 为 SIO。
    GPIO_CTRL(15) = 5u;
    GPIO_OE_SET = leds;

    for (;;) {
        uint32_t start = TIMER_US_LOW;
        while ((uint32_t)(TIMER_US_LOW - start) < 500000u) {
        }
        GPIO_OUT_XOR = leds;             // 每隔 500 ms 同时翻转两个输出。
    }
}
