#ifndef LIGHT_POLICY_H
#define LIGHT_POLICY_H

// 同样的环境光和接线下，将 2000 改为 2800，再比较报警灯。
#define DARK_ADC_THRESHOLD 2000

#if DARK_ADC_THRESHOLD < 0 || DARK_ADC_THRESHOLD > 4095
#error "DARK_ADC_THRESHOLD must be between 0 and 4095."
#endif

#endif
