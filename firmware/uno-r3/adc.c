#include <avr/io.h>
#include <util/delay.h>

static void serial_write(char value)
{
    // 等待发送缓冲区空闲，再写入下一个字符。
    while (!(UCSR0A & _BV(UDRE0))) {
    }
    UDR0 = value;
}

static void print_sample(uint16_t sample)
{
    // ADC 读数范围是 0 到 1023，最多需要四个十进制字符。
    char digits[4];
    uint8_t count = 0;
    do {
        digits[count++] = (char)('0' + sample % 10);
        sample /= 10;
    } while (sample != 0);

    while (count != 0) {
        serial_write(digits[--count]);
    }
    serial_write('\r');
    serial_write('\n');
}

int main(void)
{
    // UNO R3 和经典 Nano 上的 D13 都接到 PB5 和板载 L 灯。
    DDRB |= _BV(DDB5);

    // A0 对应 ADC0。以 AVcc 为参考电压，16 MHz 分频到 125 kHz。
    ADMUX = _BV(REFS0);
    ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);

    // USART0 正常速率，9600 baud，8 个数据位，无校验，1 个停止位。
    UBRR0 = 103;
    UCSR0B = _BV(TXEN0);
    UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);

    for (;;) {
        ADCSRA |= _BV(ADSC);
        while (ADCSRA & _BV(ADSC)) {
        }
        // 读取低字节再读取高字节，以取得同一次转换的结果。
        uint8_t low = ADCL;
        uint16_t sample = low | ((uint16_t)ADCH << 8);

        if (sample >= 512) {
            PORTB |= _BV(PORTB5);
        } else {
            PORTB &= (uint8_t)~_BV(PORTB5);
        }
        print_sample(sample);
        _delay_ms(100);
    }
}
