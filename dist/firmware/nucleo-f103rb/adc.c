#include <stdint.h>

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define ADC1_SR     REG32(0x40012400u)
#define ADC1_CR1    REG32(0x40012404u)
#define ADC1_CR2    REG32(0x40012408u)
#define ADC1_SMPR2  REG32(0x40012410u)
#define ADC1_SQR1   REG32(0x4001242Cu)
#define ADC1_SQR3   REG32(0x40012434u)
#define ADC1_DR     REG32(0x4001244Cu)
#define USART2_SR   REG32(0x40004400u)
#define USART2_DR   REG32(0x40004404u)
#define USART2_BRR  REG32(0x40004408u)
#define USART2_CR1  REG32(0x4000440Cu)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)
#define LD2_PIN     (1u << 5)

static volatile uint32_t sample_due;

void SysTick_Handler(void)
{
    sample_due = 1u;
}

static void serial_write(char value)
{
    while ((USART2_SR & (1u << 7)) == 0) { // 等待发送寄存器空闲。
    }
    USART2_DR = (uint8_t)value;
}

static void print_sample(uint32_t sample)
{
    // 12 位 ADC 最大为 4095，用四个十进制字符即可表示。
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
    ADC1_SMPR2 = 7u;                      // ADC0 使用 239.5 个 ADC 时钟周期采样。
    ADC1_SQR1 = 0;                        // 规则序列只转换一个通道。
    ADC1_SQR3 = 0;                        // 通道 0 对应 Arduino A0 / PA0。
    ADC1_CR2 = (7u << 17) | (1u << 20) | 1u; // 开启 ADC1，选择软件触发。

    for (uint32_t i = 0; i < 32; ++i) {
        __asm__ volatile ("nop");        // 等待 ADC 上电稳定。
    }
    ADC1_CR2 |= 1u << 3;                  // 复位校准寄存器。
    while ((ADC1_CR2 & (1u << 3)) != 0) {
    }
    ADC1_CR2 |= 1u << 2;                  // 启动校准。
    while ((ADC1_CR2 & (1u << 2)) != 0) {
    }
}

int main(void)
{
    RCC_APB2ENR |= (1u << 2) | (1u << 9); // GPIOA 与 ADC1 时钟。
    RCC_APB1ENR |= 1u << 17;              // USART2 时钟。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;

    // PA0 模拟输入，PA2 USART2 TX，PA5 推挽输出驱动 LD2。
    GPIOA_CRL = (GPIOA_CRL & ~(0xFu | (0xFu << 8) | (0xFu << 20)))
              | (0xAu << 8) | (0x2u << 20);
    USART2_BRR = 0x0341u;                 // 8 MHz 时的 9600 baud。
    USART2_CR1 = (1u << 13) | (1u << 3);
    adc_init();

    sample_due = 1u;                      // 先采样一次，再按 100 ms 周期采样。
    SYST_RVR = 800000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;

    for (;;) {
        if (sample_due != 0) {
            sample_due = 0;
            ADC1_CR2 |= 1u << 22;
            while ((ADC1_SR & (1u << 1)) == 0) {
            }
            uint32_t sample = ADC1_DR & 0xFFFu;
            GPIOA_BSRR = sample >= 2048u ? LD2_PIN : LD2_PIN << 16;
            print_sample(sample);
        }
    }
}
