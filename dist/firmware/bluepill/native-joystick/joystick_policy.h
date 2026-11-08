#ifndef JOYSTICK_POLICY_H
#define JOYSTICK_POLICY_H

// 中心约为 2048。偏离中心不超过这个读数时，对应灯保持熄灭。
#define DEAD_ZONE 250

#if DEAD_ZONE < 0 || DEAD_ZONE >= 2048
#error "DEAD_ZONE must be within 0..2047"
#endif

#endif
