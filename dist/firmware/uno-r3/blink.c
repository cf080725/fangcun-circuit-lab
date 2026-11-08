#include <avr/io.h>
#include <util/delay.h>

int main(void)
{
    // UNO R3 的 D13 对应 PB5。把 DDRB 的第 5 位设为输出。
    DDRB |= _BV(DDB5);

    for (;;) {
        PORTB |= _BV(PORTB5);           // D13 输出高电平，点亮板载灯。
        _delay_ms(500);
        PORTB &= (uint8_t)~_BV(PORTB5); // D13 输出低电平，熄灭板载灯。
        _delay_ms(500);
    }
}
