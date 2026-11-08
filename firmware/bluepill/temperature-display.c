#include <stdint.h>

#ifndef DISPLAY_FAHRENHEIT
#define DISPLAY_FAHRENHEIT 0
#endif

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define RCC_APB1ENR REG32(0x4002101Cu)
#define GPIOA_CRH   REG32(0x40010804u)
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
#define SSD1306_ADDRESS     0x3Du
#define OLED_WIDTH          128u
#define OLED_TEXT_COLUMN    22u
#define OLED_TEXT_WIDTH     84u
#define OLED_TEXT_PAGE      3u
#define OLED_TEXT_BYTES     (OLED_TEXT_WIDTH * 2u)
#define OLED_CHUNK_BYTES    31u

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

static uint8_t send_address(uint8_t address, uint32_t read)
{
    I2C1_CR1 |= CR1_START;
    uint8_t error = wait_sr1(SR1_SB);
    if (error) return error;
    I2C1_DR = ((uint32_t)address << 1) | read;
    return wait_sr1(SR1_ADDR);
}

static uint8_t i2c_recover(uint8_t error)
{
    // 保有主机控制权时结束事务。超时后重新初始化外设。
    if (error != TIMEOUT && !(error & (SR1_ARLO >> 8)) && (I2C1_SR2 & SR2_MSL)) {
        I2C1_CR1 |= CR1_STOP;
    }
    I2C1_SR1 = 0;
    if (error == TIMEOUT || wait_clear(&I2C1_CR1, CR1_STOP)) i2c_setup();
    else I2C1_CR1 = (I2C1_CR1 & ~CR1_POS) | CR1_ACK;
    return error;
}

static uint8_t i2c_write(uint8_t address, const uint8_t *bytes, uint32_t count, uint8_t keep_bus)
{
    uint8_t error = wait_clear(&I2C1_SR2, SR2_BUSY);
    if (error) return i2c_recover(error);
    error = send_address(address, 0);
    if (error) return i2c_recover(error);
    clear_addr();
    for (uint32_t i = 0; i < count; ++i) {
        error = wait_sr1(SR1_TXE);
        if (error) return i2c_recover(error);
        I2C1_DR = bytes[i];
    }
    error = wait_sr1(SR1_BTF);
    if (error) return i2c_recover(error);
    if (keep_bus) return 0;
    I2C1_CR1 |= CR1_STOP;
    error = wait_clear(&I2C1_CR1, CR1_STOP);
    if (!error) error = (uint8_t)((I2C1_SR1 & SR1_ERRORS) >> 8);
    return error ? i2c_recover(error) : 0;
}

static uint8_t read_temperature(int16_t *sixteenths)
{
    const uint8_t pointer = MCP9808_TEMPERATURE;
    uint8_t error = i2c_write(MCP9808_ADDRESS, &pointer, 1, 1);
    if (error) return error;

    // 保持总线并发重复 START。按 AN2824 的两字节接收顺序操作。
    error = send_address(MCP9808_ADDRESS, 1);
    if (error) return i2c_recover(error);
    I2C1_CR1 |= CR1_POS;
    __asm__ volatile("cpsid i" ::: "memory");
    clear_addr();
    I2C1_CR1 &= ~CR1_ACK;
    __asm__ volatile("cpsie i" ::: "memory");

    error = wait_sr1(SR1_BTF);
    if (error) return i2c_recover(error);
    __asm__ volatile("cpsid i" ::: "memory");
    I2C1_CR1 |= CR1_STOP;
    uint32_t high = I2C1_DR;
    __asm__ volatile("cpsie i" ::: "memory");
    uint32_t word = (high << 8) | I2C1_DR;
    error = wait_clear(&I2C1_CR1, CR1_STOP);
    if (error) return i2c_recover(error);
    I2C1_CR1 = (I2C1_CR1 & ~CR1_POS) | CR1_ACK;

    // 忽略边界标志，按 13 位补码还原为有符号的 1/16 °C。
    word &= 0x1FFFu;
    *sixteenths = (int16_t)word;
    if (word & 0x1000u) *sixteenths -= 0x2000;
    return 0;
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

static char *decimal_chars(char *text, uint32_t value)
{
    char digits[5];
    uint32_t count = 0;
    do {
        digits[count++] = (char)('0' + value % 10u);
        value /= 10u;
    } while (value);
    while (count) *text++ = digits[--count];
    return text;
}

static void serial_uint(uint32_t value)
{
    char digits[6];
    *decimal_chars(digits, value) = '\0';
    serial_text(digits);
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

static void serial_error(const char *label, uint8_t error)
{
    static const char hex[] = "0123456789ABCDEF";
    serial_text(label);
    serial_text("=0x");
    serial_byte(hex[error >> 4]);
    serial_byte(hex[error & 0x0Fu]);
    serial_text("\r\n");
}

static void temperature_label(char *text, int16_t sixteenths)
{
    // 精确换算成十分位，再四舍五入。串口仍保留原始摄氏读数。
#if DISPLAY_FAHRENHEIT
    int32_t numerator = (int32_t)sixteenths * 9 + 2560;
    const char unit = 'F';
#else
    int32_t numerator = (int32_t)sixteenths * 5;
    const char unit = 'C';
#endif
    int32_t tenths = (numerator + (numerator < 0 ? -4 : 4)) / 8;
    if (tenths < 0) {
        *text++ = '-';
        tenths = -tenths;
    }
    text = decimal_chars(text, (uint32_t)tenths / 10u);
    *text++ = '.';
    *text++ = (char)('0' + (uint32_t)tenths % 10u);
    *text++ = ' ';
    *text++ = unit;
    *text = '\0';
}

static const uint8_t *glyph(char letter)
{
    static const char symbols[] = "0123456789-.CFER";
    static const uint8_t columns[][5] = {
        {0x3E,0x41,0x41,0x41,0x3E}, {0x00,0x42,0x7F,0x40,0x00},
        {0x62,0x51,0x49,0x49,0x46}, {0x22,0x41,0x49,0x49,0x36},
        {0x18,0x14,0x12,0x7F,0x10}, {0x2F,0x49,0x49,0x49,0x31},
        {0x3E,0x49,0x49,0x49,0x32}, {0x01,0x71,0x09,0x05,0x03},
        {0x36,0x49,0x49,0x49,0x36}, {0x26,0x49,0x49,0x49,0x3E},
        {0x08,0x08,0x08,0x08,0x08}, {0x00,0x60,0x60,0x00,0x00},
        {0x3E,0x41,0x41,0x41,0x22}, {0x7F,0x09,0x09,0x09,0x01},
        {0x7F,0x49,0x49,0x49,0x41}, {0x7F,0x09,0x19,0x29,0x46},
        {0,0,0,0,0},
    };
    uint32_t index = 0;
    while (symbols[index] && symbols[index] != letter) ++index;
    return columns[index];
}

static void draw_text(uint8_t *pixels, const char *text)
{
    for (uint32_t i = 0; i < OLED_TEXT_BYTES; ++i) pixels[i] = 0;
    uint32_t length = 0;
    while (text[length]) ++length;
    uint32_t scale = length > 7u ? 1u : 2u;
    uint32_t left = (OLED_TEXT_WIDTH - (length * 6u - 1u) * scale) / 2u;
    for (uint32_t index = 0; index < length; ++index) {
        const uint8_t *columns = glyph(text[index]);
        for (uint32_t x = 0; x < 5; ++x) {
            for (uint32_t y = 0; y < 7; ++y) {
                if (!(columns[x] & (1u << y))) continue;
                for (uint32_t dy = 0; dy < scale; ++dy) {
                    uint32_t row = y * scale + dy;
                    uint32_t offset = (row / 8u) * OLED_TEXT_WIDTH + left + (index * 6u + x) * scale;
                    for (uint32_t dx = 0; dx < scale; ++dx) pixels[offset + dx] |= (uint8_t)(1u << (row % 8u));
                }
            }
        }
    }
}

static uint8_t oled_pixels(const uint8_t *pixels, uint32_t count)
{
    // 首字节 0x40 表示像素数据，每次传输最多 32 字节。
    uint8_t packet[OLED_CHUNK_BYTES + 1u];
    packet[0] = 0x40u;
    for (uint32_t offset = 0; offset < count; offset += OLED_CHUNK_BYTES) {
        uint32_t size = count - offset;
        if (size > OLED_CHUNK_BYTES) size = OLED_CHUNK_BYTES;
        for (uint32_t i = 0; i < size; ++i) packet[i + 1u] = pixels ? pixels[offset + i] : 0;
        uint8_t error = i2c_write(SSD1306_ADDRESS, packet, size + 1u, 0);
        if (error) return error;
    }
    return 0;
}

static uint8_t oled_prepare(void)
{
    // #326 的 128×64 接法，启动时关闭显示并清理全部显存。
    static const uint8_t setup[] = {0x00,0xAE,0xD5,0x80,0xA8,0x3F,0xD3,0x00,0x40,0x8D,0x14,
        0x20,0x00,0xA1,0xC8,0xDA,0x12,0x81,0xCF,0xD9,0xF1,0xDB,0x40,0xA4,0xA6,0x2E,
        0x21,0,127,0x22,0,7};
    uint8_t error = i2c_write(SSD1306_ADDRESS, setup, sizeof setup, 0);
    return error ? error : oled_pixels(0, OLED_WIDTH * 8u);
}

static uint8_t oled_show(const char *text)
{
    static const uint8_t window[] = {0x00,0x8D,0x14,0xA1,0xC8,0xA4,0xA6,0x20,0x00,
        0x21,OLED_TEXT_COLUMN,OLED_TEXT_COLUMN + OLED_TEXT_WIDTH - 1u,0x22,OLED_TEXT_PAGE,OLED_TEXT_PAGE + 1u};
    static const uint8_t on[] = {0x00,0xAF};
    uint8_t pixels[OLED_TEXT_BYTES];
    draw_text(pixels, text);
    uint8_t error = i2c_write(SSD1306_ADDRESS, window, sizeof window, 0);
    if (!error) error = oled_pixels(pixels, sizeof pixels);
    if (!error) error = i2c_write(SSD1306_ADDRESS, on, sizeof on, 0);
    return error;
}

int main(void)
{
    RCC_APB2ENR |= (1u << 0) | (1u << 2) | (1u << 3) | (1u << 14);
    RCC_APB1ENR |= 1u << 21;                        // I2C1 在 APB1 上。
    (void)RCC_APB2ENR;
    (void)RCC_APB1ENR;
    GPIOA_CRH = (GPIOA_CRH & ~(0xFu << 4)) | (0xAu << 4); // PA9 为 USART1 TX。
    GPIOB_CRL = (GPIOB_CRL & 0x00FFFFFFu) | 0xEE000000u;  // PB6/SCL、PB7/SDA 复用开漏。
    USART1_BRR = 0x0341u;
    USART1_CR1 = (1u << 13) | (1u << 3);            // 9600 baud，8N1。
    i2c_setup();

    SYST_RVR = 8000u - 1u;
    SYST_CVR = 0;
    SYST_CSR = 0x7u;
    uint32_t started = millis;
    uint8_t oled_ready = oled_prepare() == 0;
    while (millis - started < 250u) {} // 初始化 OLED 的同时等待温度转换。
    for (;;) {
        int16_t sixteenths = 0;
        char label[9];
        const char *display = "ERR";
        uint8_t sensor_error = read_temperature(&sixteenths);
        if (sensor_error) {
            serial_error("SENSOR_I2C", sensor_error);
        } else {
            serial_temperature(sixteenths);
            temperature_label(label, sixteenths);
            display = label;
        }

        uint8_t oled_error = oled_ready ? 0 : oled_prepare();
        if (!oled_error) oled_error = oled_show(display);
        oled_ready = oled_error == 0;
        if (oled_error) {
            serial_error("OLED_I2C", oled_error);
        } else {
            serial_text("DISPLAY=");
            serial_text(display);
            serial_text("\r\n");
        }
        delay_ms(300);
    }
}
