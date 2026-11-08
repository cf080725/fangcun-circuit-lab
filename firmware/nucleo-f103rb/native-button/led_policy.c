#include "led_policy.h"

bool led_should_light(bool pressed)
{
    return pressed == (LIGHT_WHEN_PRESSED != 0);
}
