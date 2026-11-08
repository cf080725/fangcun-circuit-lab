#include <avr/io.h>
#include <util/delay.h>

static void serial_write(char value)
{
    // 等待 USART0 发送缓冲区空闲，再写入下一个字符。
    while (!(UCSR0A & _BV(UDRE0))) {
    }
    UDR0 = value;
}

static void print_sample(uint16_t sample)
{
    // 0 到 1023 最多占四个十进制字符，先从个位开始拆分。
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
    // Mega 2560 的 D13 对应 PB7 和板载 L 灯。
    DDRB |= _BV(DDB7);

    // A0 对应 PF0 / ADC0。选择 AVcc 参考电压和 125 kHz ADC 时钟。
    ADMUX = _BV(REFS0);
    ADCSRB = 0; // MUX5 清零，选用 ADC0 到 ADC7 通道组。
    ADCSRA = _BV(ADEN) | _BV(ADPS2) | _BV(ADPS1) | _BV(ADPS0);

    // USART0 正常速率，9600 baud，8 个数据位，无校验，1 个停止位。
    UCSR0A = 0;
    UBRR0 = 103;
    UCSR0B = _BV(TXEN0);
    UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);

    for (;;) {
        ADCSRA |= _BV(ADSC);
        while (ADCSRA & _BV(ADSC)) {
        }
        // 先读低字节再读高字节，保证两个字节来自同一次转换。
        uint8_t low = ADCL;
        uint16_t sample = low | ((uint16_t)ADCH << 8);

        if (sample >= 512) {
            PORTB |= _BV(PORTB7);
        } else {
            PORTB &= (uint8_t)~_BV(PORTB7);
        }
        print_sample(sample);
        _delay_ms(100);
    }
}
