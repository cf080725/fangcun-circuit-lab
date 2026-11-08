#ifndef DIP_SWITCH_POLICY_H
#define DIP_SWITCH_POLICY_H

// 将 5 改成 10，让同一组开关位置满足点灯条件。
#define MATCH_MASK 5

#if MATCH_MASK < 0 || MATCH_MASK > 15
#error "MATCH_MASK must be between 0 and 15."
#endif

#endif
