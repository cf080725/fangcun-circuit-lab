#ifndef RGB_LEVELS_H
#define RGB_LEVELS_H

// 千分比。500 对应 50.0%，1000 对应一直为高电平。
#define RED_PWM_PERMILLE   500u
#define GREEN_PWM_PERMILLE   0u
#define BLUE_PWM_PERMILLE    0u

#if RED_PWM_PERMILLE < 0 || RED_PWM_PERMILLE > 1000 || \
    GREEN_PWM_PERMILLE < 0 || GREEN_PWM_PERMILLE > 1000 || \
    BLUE_PWM_PERMILLE < 0 || BLUE_PWM_PERMILLE > 1000
#error "Each RGB PWM duty must be between 0 and 1000."
#endif

#endif
