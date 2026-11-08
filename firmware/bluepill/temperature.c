#include <stdint.h>

#ifndef ALARM_C
#define ALARM_C 30
#endif

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_CRH   REG32(0x40010804u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define GPIOB_CRL   REG32(0x40010C00u)
#define USART1_SR   REG32(0x40013800u)
#define USART1_DR   REG32(0x40013804u)
#define USART1_BRR  REG32(0x40013808u)
#define USART1_CR1  REG32(0x4001380Cu)
#define I2C1_CR1    REG32(0x40005400u)
#define I2C1_CR2    REG32(0x40005404u)
#define I2C1_OAR1   REG32(0x40005408u)
#define I2C1_DR     REG32(0x40005410u)
#define I2C1_SR1    REG32(0x40005414u)
#define I2C1_SR2    REG32(0x40005418u)
#define I2C1_CCR    REG32(0x4000541Cu)
#define I2C1_TRISE  REG32(0x40005420u)
#define SYST_CSR    REG32(0xE000E010u)
#define SYST_RVR    REG32(0xE000E014u)
#define SYST_CVR    REG32(0xE000E018u)

#define CR1_PE      (1u << 0)
#define CR1_START   (1u << 8)
#define CR1_STOP    (1u << 9)
#define CR1_ACK     (1u << 10)
#define CR1_POS     (1u << 11)
#define SR1_SB      (1u << 0)
#define SR1_ADDR    (1u << 1)
#define SR1_BTF     (1u << 2)
#define SR1_TXE     (1u << 7)
#define SR1_ARLO    (1u << 9)
#define SR1_ERRORS  0xDF00u
#define SR2_MSL     (1u << 0)
#define SR2_BUSY    (1u << 1)
#define TIMEOUT     0xFFu
#define WAIT_MS     10u

#define MCP9808_ADDRESS     0x18u
#define MCP9808_TEMPERATURE 0x05u

static volatile uint32_t millis;

void SysTick_Handler(void)
{
    ++millis;
}

static void delay_ms(uint32_t duration)
{
    uint32_t started = millis;
    while (millis - started < duration) {}
}

static uint8_t wait_sr1(uint32_t flag)
{
    uint32_t started = millis;
    do {
        uint32_t status = I2C1_SR1;
        if (status & SR1_ERRORS) return (uint8_t)((status & SR1_ERRORS) >> 8);
        if (status & flag) return 0;
    } while (millis - started < WAIT_MS);
    return TIMEOUT;
}

static uint8_t wait_clear(volatile uint32_t *reg, uint32_t mask)
{
    uint32_t started = millis;
    while (*reg & mask) {
        if (millis - started >= WAIT_MS) return TIMEOUT;
    }
    return 0;
}

static void clear_addr(void)
{
    (void)I2C1_SR1;
    (void)I2C1_SR2;
}

static void i2c_setup(void)
{
    I2C1_CR1 = 0;
    I2C1_CR2 = 8u;            // APB1 = 8 MHz。
    I2C1_OAR1 = 1u << 14;    // 硬件要求保持为 1。
    I2C1_CCR = 40u;          // 标准模式，8 MHz / (2 × 40) = 100 kHz。
    I2C1_TRISE = 9u;         // 标准模式的最大上升时间为 1 µs。
    I2C1_CR1 = CR1_PE | CR1_ACK;
}

static uint8_t send_address(uint32_t read)
{
    I2C1_CR1 |= CR1_START;
    uint8_t error = wait_sr1(SR1_SB);
    if (error) return error;
    I2C1_DR = (MCP9808_ADDRESS << 1) | read;
    return wait_sr1(SR1_ADDR);
}

static uint8_t read_temperature(int16_t *sixteenths)
{
    uint8_t error = wait_clear(&I2C1_SR2, SR2_BUSY);
    if (error) goto failed;
    error = send_address(0);
    if (error) goto failed;
    clear_addr();
    error = wait_sr1(SR1_TXE);
    if (error) goto failed;
    I2C1_DR = MCP9808_TEMPERATURE;
    error = wait_sr1(SR1_BTF);
    if (error) goto failed;

    // 保持总线并发重复 START。按 AN2824 的两字节接收顺序操作。
    error = send_address(1);
    if (error) goto failed;
    I2C1_CR1 |= CR1_POS;
    __asm__ volatile("cpsid i" ::: "memory");
    clear_addr();
    I2C1_CR1 &= ~CR1_ACK;
    __asm__ volatile("cpsie i" ::: "memory");

    error = wait_sr1(SR1_BTF);
    if (error) goto failed;
    __asm__ volatile("cpsid i" ::: "memory");
    I2C1_CR1 |= CR1_STOP;
    uint32_t high = I2C1_DR;
    __asm__ volatile("cpsie i" ::: "memory");
    uint32_t word = (high << 8) | I2C1_DR;
    error = wait_clear(&I2C1_CR1, CR1_STOP);
    if (error) goto failed;
    I2C1_CR1 = (I2C1_CR1 & ~CR1_POS) | CR1_ACK;

    // 忽略边界标志，按 13 位补码还原为有符号的 1/16 °C。
    word &= 0x1FFFu;
    *sixteenths = (int16_t)word;
    if (word & 0x1000u) *sixteenths -= 0x2000;
    return 0;

failed:
    GPIOA_BSRR = 1u << 16;
    // 保有主机控制权时结束事务。超时后重新初始化外设。
    if (error != TIMEOUT && !(error & (SR1_ARLO >> 8)) && (I2C1_SR2 & SR2_MSL)) {
        I2C1_CR1 |= CR1_STOP;
    }
    I2C1_SR1 = 0;
    if (error == TIMEOUT || wait_clear(&I2C1_CR1, CR1_STOP)) i2c_setup();
    else I2C1_CR1 = (I2C1_CR1 & ~CR1_POS) | CR1_ACK;
    return error;
}

static void serial_byte(char value)
{
    while (!(USART1_SR & (1u << 7))) {}
    USART1_DR = (uint8_t)value;
}

static void serial_text(const char *text)
{
    while (*text) serial_byte(*text++);
}

static void serial_uint(uint32_t value)
{
    char digits[5];
    uint32_t count = 0;
    do {
        digits[count++] = (char)('0' + value % 10u);
        value /= 10u;
    } while (value);
    while (count) serial_byte(digits[--count]);
}

static void serial_temperature(int16_t sixteenths)
{
    serial_text("TEMP=");
    if (sixteenths < 0) {
        serial_byte('-');
        sixteenths = -sixteenths;
    }
    serial_uint((uint32_t)sixteenths / 16u);
    serial_byte('.');
    uint32_t fraction = ((uint32_t)sixteenths % 16u) * 625u;
    if (fraction < 1000u) serial_byte('0');
    if (fraction < 100u) serial_byte('0');
    if (fraction < 10u) serial_byte('0');
    serial_uint(fraction);
    serial_text("\r\n");
}

static void serial_error(uint8_t error)
{
    static const char hex[] = "0123456789ABCDEF";
    serial_text("I2C=0x");
    serial_byte(hex[error >> 4]);
    serial_byte(hex[error & 0x0Fu]);
    serial_text("\r\n");
}

int main(void)
{
    RCC_APB2ENR |= (1u << 0) | (1u << 2) | (1u << 3) | (1u << 14);
    RCC_APB1ENR |= 1u << 21;                        // I2C1 在 APB1 上。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    GPIOA_BSRR = 1u << 16;
    GPIOA_CRL = (GPIOA_CRL & ~0xFu) | 0x2u;         // PA0 推挽驱动外接报警灯。
    GPIOA_CRH = (GPIOA_CRH & ~(0xFu << 4)) | (0xAu << 4); // PA9 为 USART1 TX。
    GPIOB_CRL = (GPIOB_CRL & 0x00FFFFFFu) | 0xEE000000u;  // PB6/SCL、PB7/SDA 复用开漏。
    USART1_BRR = 0x0341u;
    USART1_CR1 = (1u << 13) | (1u << 3);            // 9600 baud，8N1。
    i2c_setup();

    SYST_RVR = 8000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;
    delay_ms(250);
    for (;;) {
        int16_t sixteenths = 0;
        uint8_t error = read_temperature(&sixteenths);
        if (error) {
            serial_error(error);
        } else {
            GPIOA_BSRR = sixteenths >= ALARM_C * 16 ? 1u : (1u << 16);
            serial_temperature(sixteenths);
        }
        delay_ms(300);
    }
}
