#include <avr/io.h>

int main(void)
{
    // D13 对应 PB5。D2 对应 PD2，写入 PORTD 启用内部上拉。
    DDRB |= _BV(DDB5);
    DDRD &= (uint8_t)~_BV(DDD2);
    PORTD |= _BV(PORTD2);

    // 按下时开关把 D2 接到地，D13 的板载灯亮起。
    for (;;) {
        if (PIND & _BV(PIND2)) {
            PORTB &= (uint8_t)~_BV(PORTB5);
        } else {
            PORTB |= _BV(PORTB5);
        }
    }
}
