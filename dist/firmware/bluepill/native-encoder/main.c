#include <stdbool.h>
#include <stdint.h>
#include "encoder_policy.h"

#define REG32(address) (*(volatile uint32_t *)(address))
#define RCC_APB2ENR REG32(0x40021018u)
#define GPIOA_CRL   REG32(0x40010800u)
#define GPIOA_CRH   REG32(0x40010804u)
#define GPIOA_BSRR  REG32(0x40010810u)
#define GPIOB_CRL   REG32(0x40010C00u)
#define GPIOB_CRH   REG32(0x40010C04u)
#define GPIOB_IDR   REG32(0x40010C08u)
#define GPIOB_BSRR  REG32(0x40010C10u)
#define USART1_SR   REG32(0x40013800u)
#define USART1_DR   REG32(0x40013804u)
#define USART1_BRR  REG32(0x40013808u)
#define USART1_CR1  REG32(0x4001380Cu)

#define LED (1u << 0)
#define PUSH_SWITCH (1u << 10)

// PB0=A，PB1=B。索引由旧 AB 和新 AB 组成。两位同时变动无法判断方向。
static const int8_t transition[16] = {
     0,  1, -1,  0,
    -1,  0,  0,  1,
     1,  0,  0, -1,
     0, -1,  1,  0
};

static void send(char character)
{
    while (!(USART1_SR & (1u << 7))) {} // 等待发送寄存器空闲。
    USART1_DR = (uint32_t)character;
}

static void publish(int count)
{
    GPIOA_BSRR = count >= LED_AT ? LED : LED << 16;
    for (const char *prefix = "COUNT="; *prefix; prefix++) send(*prefix);
    if (count < 0) {
        send('-');
        count = -count;
    }
    char digits[4];
    unsigned size = 0;
    do {
        digits[size++] = (char)('0' + count % 10);
        count /= 10;
    } while (count);
    while (size) send(digits[--size]);
    send('\n');
}

int main(void)
{
    // 复位后的 HSI 为 8 MHz。开启 GPIOA、GPIOB 和 USART1 时钟。
    RCC_APB2ENR |= (1u << 2) | (1u << 3) | (1u << 14);
    (void)RCC_APB2ENR;
    GPIOA_BSRR = LED << 16;
    GPIOA_CRL = (GPIOA_CRL & ~0xFu) | 0x2u;
    GPIOA_CRH = (GPIOA_CRH & ~(0xFu << 4)) | (0xBu << 4);
    GPIOB_BSRR = PUSH_SWITCH | 3u;
    GPIOB_CRL = (GPIOB_CRL & ~0xFFu) | 0x88u;
    GPIOB_CRH = (GPIOB_CRH & ~(0xFu << 8)) | (0x8u << 8);
    USART1_BRR = 833u;
    USART1_CR1 = (1u << 13) | (1u << 3);

    unsigned previous = GPIOB_IDR & 3u;
    int edges = 0;
    int count = 0;
    bool was_pressed = false;
    publish(count);

    for (;;) {
        const uint32_t inputs = GPIOB_IDR;
        const unsigned next = inputs & 3u;
        const bool pressed = (inputs & PUSH_SWITCH) == 0;
        if (pressed) {
            // 按住轴开关归零。按住期间丢弃旋转边沿。
            count = edges = 0;
            if (!was_pressed) publish(count);
        } else if (next != previous) {
            const int direction = transition[(previous << 2) | next];
            edges = direction ? edges + direction : 0;
            if (next == 3u) {
                // 回到两相高电平时才确认一个完整的卡位。
                if (edges == 4 || edges == -4) {
                    const int next_count = count + (edges > 0 ? CW_SIGN : -CW_SIGN);
                    if (next_count >= -9999 && next_count <= 9999) count = next_count;
                    publish(count);
                }
                edges = 0;
            }
        }
        previous = next;
        was_pressed = pressed;
    }
}
