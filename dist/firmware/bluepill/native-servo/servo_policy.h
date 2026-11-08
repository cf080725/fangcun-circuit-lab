#ifndef SERVO_POLICY_H
#define SERVO_POLICY_H

#include <stdint.h>

// 0：旋钮越高，脉宽越长。改成 1 可以反转对应关系。
#define SERVO_REVERSED 0

#if SERVO_REVERSED != 0 && SERVO_REVERSED != 1
#error "SERVO_REVERSED must be 0 or 1."
#endif

static inline uint32_t servo_pulse_us(uint32_t adc_sample)
{
    const uint32_t full_scale = 4095u;
    const uint32_t sample = SERVO_REVERSED ? full_scale - adc_sample : adc_sample;
    // HS-55 标称教学行程：900–2100 µs，中位 1500 µs。四舍五入到 1 µs。
    return 900u + (1200u * sample + full_scale / 2u) / full_scale;
}

#endif
