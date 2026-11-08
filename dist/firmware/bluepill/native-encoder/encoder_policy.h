#ifndef ENCODER_POLICY_H
#define ENCODER_POLICY_H

// 1：顺时针增加。改为 -1 后，顺时针减少。
#define CW_SIGN 1
// 计数达到这个值时，PA0 点亮外接 LED。
#define LED_AT 3

#if CW_SIGN != 1 && CW_SIGN != -1
#error "CW_SIGN must be 1 or -1"
#endif

#if LED_AT < -9999 || LED_AT > 9999
#error "LED_AT must be within -9999..9999"
#endif

#endif
