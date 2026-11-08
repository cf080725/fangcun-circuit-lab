#ifndef NUCLEO_LED_POLICY_H
#define NUCLEO_LED_POLICY_H

#include <stdbool.h>

// 1：按下 B1 时亮。改为 0 后，松开 B1 时亮。
#define LIGHT_WHEN_PRESSED 1

#if LIGHT_WHEN_PRESSED != 0 && LIGHT_WHEN_PRESSED != 1
#error "LIGHT_WHEN_PRESSED must be 0 or 1"
#endif

bool led_should_light(bool pressed);

#endif
