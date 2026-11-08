#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define XOSC_CTRL        REG32(0x40024000u)
#define XOSC_STATUS      REG32(0x40024004u)
#define XOSC_STARTUP     REG32(0x4002400Cu)
#define CLK_REF_CTRL     REG32(0x40008030u)
#define CLK_REF_SELECTED REG32(0x40008038u)
#define CLK_SYS_CTRL     REG32(0x4000803Cu)
#define CLK_PERI_CTRL    REG32(0x40008048u)
#define CLK_ADC_CTRL     REG32(0x40008060u)
#define WATCHDOG_TICK    REG32(0x4005802Cu)
#define RESETS_CLEAR     REG32(0x4000F000u)
#define RESETS_DONE      REG32(0x4000C008u)
#define PLL_USB_CS       REG32(0x4002C000u)
#define PLL_USB_PWR      REG32(0x4002C004u)
#define PLL_USB_FBDIV    REG32(0x4002C008u)
#define PLL_USB_PRIM     REG32(0x4002C00Cu)
#define GPIO_CTRL(pin)   REG32(0x40014004u + (pin) * 8u)
#define GPIO_PAD(pin)    REG32(0x4001C004u + (pin) * 4u)
#define GPIO_OUT_SET     REG32(0xD0000014u)
#define GPIO_OUT_CLR     REG32(0xD0000018u)
#define GPIO_OE_SET      REG32(0xD0000024u)
#define TIMER_US_LOW     REG32(0x40054028u)
#define ADC_CS           REG32(0x4004C000u)
#define ADC_RESULT       REG32(0x4004C004u)
#define UART0_DR         REG32(0x40034000u)
#define UART0_FR         REG32(0x40034018u)
#define UART0_IBRD       REG32(0x40034024u)
#define UART0_FBRD       REG32(0x40034028u)
#define UART0_LCR_H      REG32(0x4003402Cu)
#define UART0_CR         REG32(0x40034030u)

static void start_clocks(void)
{
    // 核心和 UART 使用 12 MHz 晶体。ADC 由 USB PLL 单独提供 48 MHz。
    XOSC_STARTUP = 47u;
    XOSC_CTRL = (0xFABu << 12) | 0xAA0u;
    while ((XOSC_STATUS & (1u << 31)) == 0) {
    }
    CLK_REF_CTRL = 2u;
    while ((CLK_REF_SELECTED & (1u << 2)) == 0) {
    }
    CLK_SYS_CTRL = 0;
    CLK_PERI_CTRL = 1u << 11;
    WATCHDOG_TICK = (1u << 9) | 12u;

    const uint32_t pll_usb_reset = 1u << 13;
    RESETS_CLEAR = pll_usb_reset;
    while ((RESETS_DONE & pll_usb_reset) == 0) {
    }
    PLL_USB_CS = 1u;
    PLL_USB_FBDIV = 40u;                  // 12 MHz × 40 = 480 MHz。
    PLL_USB_PWR &= ~((1u << 5) | 1u);     // 打开 VCO 和 PLL 电源。
    while ((PLL_USB_CS & (1u << 31)) == 0) {
    }
    PLL_USB_PRIM = (5u << 16) | (2u << 12); // 480 MHz / 5 / 2 = 48 MHz。
    PLL_USB_PWR &= ~(1u << 3);
    CLK_ADC_CTRL = 1u << 11;             // 选择 PLL_USB 并开启 clk_adc。
}

static void uart_write(char byte)
{
    while ((UART0_FR & (1u << 5)) != 0) { // 等待发送 FIFO 有空位。
    }
    UART0_DR = (uint8_t)byte;
}

static void print_sample(uint32_t sample)
{
    static const uint32_t places[] = {1000u, 100u, 10u, 1u};
    uint32_t printed = 0;
    for (uint32_t i = 0; i < 4u; ++i) {
        uint32_t digit = 0;
        while (sample >= places[i]) {
            sample -= places[i];
            ++digit;
        }
        if (digit != 0 || printed != 0 || i == 3u) {
            uart_write((char)('0' + digit));
            printed = 1u;
        }
    }
    uart_write('\r');
    uart_write('\n');
}

int main(void)
{
    start_clocks();
    const uint32_t resets = (1u << 22) | (1u << 21) | (1u << 8) | (1u << 5) | 1u;
    RESETS_CLEAR = resets;               // 释放 UART0、TIMER、GPIO 和 ADC 的复位。
    while ((RESETS_DONE & resets) != resets) {
    }

    GPIO_CTRL(26) = 31u;                 // GP26 取消数字功能，留给 ADC0。
    GPIO_PAD(26) = (GPIO_PAD(26) & ~0x4Cu) | 0x80u; // 禁用数字输入输出和上下拉。
    const uint32_t led = 1u << 15;
    GPIO_OUT_CLR = led;
    GPIO_PAD(15) &= ~0x8Cu;
    GPIO_CTRL(15) = 5u;
    GPIO_OE_SET = led;

    GPIO_CTRL(0) = 2u;                   // GP0 为 UART0 TX，9600 baud。
    UART0_CR = 0;
    UART0_IBRD = 78u;
    UART0_FBRD = 8u;
    UART0_LCR_H = 3u << 5;
    UART0_CR = (1u << 8) | 1u;

    ADC_CS = 1u;                         // 开启 ADC，AINSEL=0 选择 GP26。
    while ((ADC_CS & (1u << 8)) == 0) {
    }
    for (;;) {
        const uint32_t start = TIMER_US_LOW;
        ADC_CS = 1u | (1u << 2);         // START_ONCE，启动单次转换。
        while ((ADC_CS & (1u << 8)) == 0) {
        }
        const uint32_t sample = ADC_RESULT & 0xFFFu;
        if (sample >= 2048u) {
            GPIO_OUT_SET = led;
        } else {
            GPIO_OUT_CLR = led;
        }
        print_sample(sample);
        while ((uint32_t)(TIMER_US_LOW - start) < 100000u) {
        }
    }
}
