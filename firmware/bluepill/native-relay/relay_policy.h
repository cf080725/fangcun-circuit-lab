#ifndef RELAY_POLICY_H
#define RELAY_POLICY_H

#define PERIOD_MS 500u
// 先观察 2 ms。改为 220 后重编译，保持周期和实验台接线相同。
#define PULSE_MS 2u

#if PERIOD_MS < 2 || PERIOD_MS > 65535
#error "PERIOD_MS must be between 2 and 65535."
#endif
#if PULSE_MS < 0 || PULSE_MS > PERIOD_MS
#error "PULSE_MS must be between 0 and PERIOD_MS."
#endif

#endif
