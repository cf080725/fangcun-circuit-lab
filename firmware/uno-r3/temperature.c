#ifndef F_CPU
#define F_CPU 16000000UL
#endif

#ifndef ALARM_C
#define ALARM_C 30
#endif

#include <avr/io.h>
#include <stdint.h>
#include <util/delay.h>
#include <util/twi.h>

#define MCP9808_ADDRESS 0x18
#define MCP9808_TEMPERATURE 0x05
#define TWI_OK 0x01 // TWSR 状态码低三位为零，此值仅表示完整读取成功。
#define TWI_TIMEOUT 0xff

static uint8_t twi_transfer(uint8_t flags)
{
    TWCR = _BV(TWINT) | _BV(TWEN) | flags;
    for (uint16_t poll = 0; poll < 5000; ++poll) {
        if (TWCR & _BV(TWINT)) {
            return TW_STATUS;
        }
        _delay_us(1);
    }
    return TWI_TIMEOUT;
}

static uint8_t read_temperature(int16_t *sixteenths)
{
    // START → 地址+写 → 温度寄存器指针。
    uint8_t status = twi_transfer(_BV(TWSTA));
    if (status != TW_START) goto stop;
    TWDR = (MCP9808_ADDRESS << 1) | TW_WRITE;
    status = twi_transfer(0);
    if (status != TW_MT_SLA_ACK) goto stop;
    TWDR = MCP9808_TEMPERATURE;
    status = twi_transfer(0);
    if (status != TW_MT_DATA_ACK) goto stop;

    // 重复 START → 地址+读 → 读高字节并 ACK → 读低字节并 NACK。
    status = twi_transfer(_BV(TWSTA));
    if (status != TW_REP_START) goto stop;
    TWDR = (MCP9808_ADDRESS << 1) | TW_READ;
    status = twi_transfer(0);
    if (status != TW_MR_SLA_ACK) goto stop;
    status = twi_transfer(_BV(TWEA));
    if (status != TW_MR_DATA_ACK) goto stop;
    uint16_t word = (uint16_t)TWDR << 8;
    status = twi_transfer(0);
    if (status != TW_MR_DATA_NACK) goto stop;
    word |= TWDR;

    // 去掉最高三位状态标志，按有符号 13 位温度解析。
    word &= 0x1fff;
    *sixteenths = (int16_t)word;
    if (word & 0x1000) *sixteenths -= 0x2000;
    status = TWI_OK;

stop:
    // 失去仲裁时释放总线，其余情况发 STOP。
    TWCR = _BV(TWINT) | _BV(TWEN) | (status == TW_MT_ARB_LOST ? 0 : _BV(TWSTO));
    return status;
}

static void serial_byte(char value)
{
    while (!(UCSR0A & _BV(UDRE0))) {}
    UDR0 = value;
}

static void serial_text(const char *text)
{
    while (*text) serial_byte(*text++);
}

static void serial_uint(uint16_t value)
{
    char digits[5];
    uint8_t count = 0;
    do {
        digits[count++] = '0' + value % 10;
        value /= 10;
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
    serial_uint((uint16_t)sixteenths / 16);
    serial_byte('.');
    uint16_t fraction = ((uint16_t)sixteenths % 16) * 625;
    if (fraction < 1000) serial_byte('0');
    if (fraction < 100) serial_byte('0');
    if (fraction < 10) serial_byte('0');
    serial_uint(fraction);
    serial_text("\r\n");
}

static void serial_error(uint8_t status)
{
    static const char hex[] = "0123456789ABCDEF";
    serial_text("I2C=0x");
    serial_byte(hex[status >> 4]);
    serial_byte(hex[status & 0x0f]);
    serial_text("\r\n");
}

int main(void)
{
    PORTB &= (uint8_t)~_BV(PORTB4);
    DDRB |= _BV(DDB4); // UNO D12：外接报警灯。

    UBRR0 = F_CPU / (16UL * 9600UL) - 1;
    UCSR0B = _BV(TXEN0);
    UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);

    TWSR = 0; // 分频系数 1，SCL 100 kHz。
    TWBR = (F_CPU / 100000UL - 16UL) / 2UL;
    TWCR = _BV(TWEN);

    _delay_ms(250); // 给传感器留出首次温度转换时间。
    for (;;) {
        int16_t sixteenths = 0;
        uint8_t status = read_temperature(&sixteenths);
        if (status == TWI_OK) {
            if (sixteenths >= ALARM_C * 16) PORTB |= _BV(PORTB4);
            else PORTB &= (uint8_t)~_BV(PORTB4);
            serial_temperature(sixteenths);
        } else {
            PORTB &= (uint8_t)~_BV(PORTB4);
            serial_error(status);
        }
        _delay_ms(300);
    }
}
