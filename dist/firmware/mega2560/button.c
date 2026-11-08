#include <avr/io.h>

int main(void)
{
    // D13 对应 PB7。D2 对应 PE4，写入 PORTE 启用内部上拉。
    DDRB |= _BV(DDB7);
    DDRE &= (uint8_t)~_BV(DDE4);
    PORTE |= _BV(PORTE4);

    // 按键一端接 D2，另一端接 GND。按下时 D2 变低，板载灯亮起。
    for (;;) {
        if (PINE & _BV(PINE4)) {
            PORTB &= (uint8_t)~_BV(PORTB7);
        } else {
            PORTB |= _BV(PORTB7);
        }
    }
}
