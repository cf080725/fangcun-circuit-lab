#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define XOSC_CTRL        REG32(0x40024000u)
#define XOSC_STATUS      REG32(0x40024004u)
#define XOSC_STARTUP     REG32(0x4002400Cu)
#define CLK_REF_CTRL     REG32(0x40008030u)
#define CLK_REF_SELECTED REG32(0x40008038u)
#define CLK_SYS_CTRL     REG32(0x4000803Cu)
#define WATCHDOG_TICK    REG32(0x4005802Cu)
#define RESETS_CLEAR     REG32(0x4000F000u)
#define RESETS_DONE      REG32(0x4000C008u)
#define GPIO15_CTRL      REG32(0x4001407Cu)
#define GPIO15_PAD       REG32(0x4001C040u)
#define TIMER_US_LOW     REG32(0x40054028u)
#define PWM7_CSR         REG32(0x4005008Cu)
#define PWM7_DIV         REG32(0x40050090u)
#define PWM7_CTR         REG32(0x40050094u)
#define PWM7_CC          REG32(0x40050098u)
#define PWM7_TOP         REG32(0x4005009Cu)

int main(void)
{
    // 使用 12 MHz 系统时钟，硬件计时器每 1 μs 递增一次。
    XOSC_STARTUP = 47u;
    XOSC_CTRL = (0xFABu << 12) | 0xAA0u;
    while ((XOSC_STATUS & (1u << 31)) == 0) {
    }
    CLK_REF_CTRL = 2u;
    while ((CLK_REF_SELECTED & (1u << 2)) == 0) {
    }
    CLK_SYS_CTRL = 0;
    WATCHDOG_TICK = (1u << 9) | 12u;

    const uint32_t resets = (1u << 21) | (1u << 14) | (1u << 8) | (1u << 5);
    RESETS_CLEAR = resets;               // 释放 TIMER、PWM 和 GPIO 的复位。
    while ((RESETS_DONE & resets) != resets) {
    }
    GPIO15_PAD &= ~0x8Cu;
    GPIO15_CTRL = 4u;                   // GP15 的复用功能 4 连接 PWM 切片 7 通道 B。

    PWM7_CSR = 0;                       // 停止计数后配置边沿对齐模式。
    PWM7_CTR = 0;
    PWM7_DIV = 0x10u;                   // 4 位小数格式中的 1.0 分频。
    PWM7_TOP = 11999u;                  // 12 MHz / 12000 = 1 kHz。
    uint32_t compare = 3000u;
    PWM7_CC = compare << 16;            // 通道 B 比较值在高 16 位，初始占空比 25%。
    PWM7_CSR = 1u;                      // 启用 PWM 切片 7。

    for (;;) {
        const uint32_t start = TIMER_US_LOW;
        while ((uint32_t)(TIMER_US_LOW - start) < 500000u) {
        }
        compare = compare == 3000u ? 9000u : 3000u;
        PWM7_CC = compare << 16;        // 新的 25% / 75% 在下一次周期回绕时生效。
    }
}
