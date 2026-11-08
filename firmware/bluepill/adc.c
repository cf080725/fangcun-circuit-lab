#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_CRH   REG32(0x40010804u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define ADC1_SR     REG32(0x40012400u)
#define ADC1_CR1    REG32(0x40012404u)
#define ADC1_CR2    REG32(0x40012408u)
#define ADC1_SMPR2  REG32(0x40012410u)
#define ADC1_SQR1   REG32(0x4001242Cu)
#define ADC1_SQR3   REG32(0x40012434u)
#define ADC1_DR     REG32(0x4001244Cu)
#define USART1_SR   REG32(0x40013800u)
#define USART1_DR   REG32(0x40013804u)
#define USART1_BRR  REG32(0x40013808u)
#define USART1_CR1  REG32(0x4001380Cu)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

static volatile uint32_t sample_due;

void SysTick_Handler(void)
{
    sample_due = 1u;
}

static void serial_write(char value)
{
    while ((USART1_SR & (1u << 7)) == 0) { // 等待发送寄存器空闲。
    }
    USART1_DR = (uint8_t)value;
}

static void print_sample(uint32_t sample)
{
    // 12 位 ADC 的最大值是 4095，最多需要四个十进制字符。
    char digits[4];
    uint32_t count = 0;
    do {
        digits[count++] = (char)('0' + sample % 10u);
        sample /= 10u;
    } while (sample != 0);

    while (count != 0) {
        serial_write(digits[--count]);
    }
    serial_write('\r');
    serial_write('\n');
}

static void adc_init(void)
{
    ADC1_CR1 = 0;
    ADC1_SMPR2 = 7u << 3;                   // 通道 1 使用 239.5 个 ADC 周期采样。
    ADC1_SQR1 = 0;                         // 规则转换序列长度为 1。
    ADC1_SQR3 = 1u;                        // 序列的第一项是 PA1 对应的通道 1。
    ADC1_CR2 = (7u << 17) | (1u << 20) | 1u; // 选择软件触发，启用 ADC1。

    for (uint32_t i = 0; i < 32; ++i) {
        __asm__ volatile ("nop");         // 等待 ADC 上电稳定后开始校准。
    }
    ADC1_CR2 |= 1u << 3;                   // 复位校准寄存器。
    while ((ADC1_CR2 & (1u << 3)) != 0) {
    }
    ADC1_CR2 |= 1u << 2;                   // 启动校准并等待硬件清除该位。
    while ((ADC1_CR2 & (1u << 2)) != 0) {
    }
}

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 9) | (1u << 14); // GPIOA、ADC1、USART1。
    (void)RCC_APB2ENR;
    GPIOA_CRL = (GPIOA_CRL & ~0xFFu) | 0x2u; // PA0 推挽输出，PA1 模拟输入。
    GPIOA_CRH = (GPIOA_CRH & ~(0xFu << 4)) | (0xAu << 4); // PA9 为 USART1 TX。
    USART1_BRR = 0x0341u;                  // 8 MHz HSI 下的 9600 baud。
    USART1_CR1 = (1u << 13) | (1u << 3);   // 启用 USART1 和发送器。
    adc_init();

    // 先采样一次，再由 SysTick 每 100 ms 请求一次采样。
    sample_due = 1u;
    SYST_RVR = 800000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;

    for (;;) {
        if (sample_due != 0) {
            sample_due = 0;
            ADC1_CR2 |= 1u << 22;          // 触发一次规则通道转换。
            while ((ADC1_SR & (1u << 1)) == 0) {
            }
            uint32_t sample = ADC1_DR & 0xFFFu;
            GPIOA_BSRR = sample >= 2048u ? 1u : (1u << 16);
            print_sample(sample);
        }
    }
}
