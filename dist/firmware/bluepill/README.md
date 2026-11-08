# Blue Pill STM32F103C8 原生固件示例

示例使用 STM32F103C8 的 Cortex-M3 Thumb 指令。链接地址为 `0x08000000`，Flash 为 64 KiB，SRAM 为 20 KiB。处理器复位时从向量表取得初始栈顶 `0x20005000` 和 Thumb 复位入口。启动代码初始化 C 数据后进入 `main`。时钟保持复位后的 8 MHz HSI。

| 示例 | 接线 | 预期现象 |
| --- | --- | --- |
| `blink.c` / `blink.hex` / `blink.bin` | 使用 Blue Pill 的 PC13 板载灯 | PC13 低电平时灯亮，高电平时灯灭。SysTick 每 500 ms 触发一次切换 |
| `button.c` / `button.hex` / `button.bin` | 按键接 PB1 和 GND。PA0 接限流电阻、LED 阳极，LED 阴极接 GND | PB1 使用内部上拉。按下时外接灯亮，松开时灯灭 |
| `adc.c` / `adc.hex` / `adc.bin` | 电位器两端接 3.3 V 和 GND，滑动端接 PA1。PA0 通过限流电阻接 LED | ADC1 采样 0–4095，经 USART1 以 9600 baud 输出。读数达到 2048 时外接灯亮 |
| `pwm.c` / `pwm.hex` / `pwm.bin` | PA0 通过限流电阻接 LED，LED 阴极接 GND | TIM2_CH1 输出 1 kHz PWM，每 500 ms 在 25% 与 75% 占空比之间切换 |
| `temperature.c` / `temperature-30.hex`、`temperature-38.hex` | MCP9808 的 VIN、GND、SCL、SDA 分别接 3.3 V、GND、PB6、PB7。PA0 经 330 Ω 电阻接报警灯正极，负极接 GND | 两份固件读取同一个 34.5 °C 时，30 °C 固件点亮报警灯，38 °C 固件熄灯。断开 SDA 后报警灯关闭，USART1 输出错误码 |
| `temperature-display.c` / `temperature-display-c.hex`、`temperature-display-f.hex` | MCP9808 和 SSD1306 的 VIN、GND、SCL、SDA 分别并联接 3.3 V、GND、PB6、PB7 | 同样读出 34.5 °C，屏幕分别显示 `34.5 C` 和 `94.1 F`。可单独断开任一模块的 SDA 支路观察另一个模块 |
| `native-encoder/main.c` 与 `encoder_policy.h` | PEC11R A、B 分别接 PB0、PB1，C 接地。轴开关接 PB10 和 GND。PA0 经 330 Ω 接 LED | 浏览器编译源码。顺时针转动增加计数，达到 3 后点亮外接 LED。按压开关归零。USART1 报告 `COUNT=` |
| `native-joystick/main.c` 与 `joystick_policy.h` | HORIZ 接 PA4，VERT 接 PA5，SEL 接 PB1，摇杆用 3.3 V 供电。PA0、PA1 分别经 330 Ω 接绿灯、黄灯 | ADC1 逐次读两轴，TIM2 输出两路 1 kHz PWM。改 `DEAD_ZONE` 对比相同偏移下的亮度。USART1 报告 `STICK=` |
| `native-rgbled/main.c` 与 `rgb_levels.h` | PA0、PA1、PA2 分别串 470 Ω、470 Ω、220 Ω 后接共阴 RGB 灯的 R、G、B。COM 接地 | TIM2 的 CH1–CH3 输出 1 kHz PWM。把 `BLUE_PWM_PERMILLE` 从 0 改为 850，比较相同接线上的平均电流和混色 |
| `native-servo/main.c` 与 `servo_policy.h` | 3.3 V 电位器滑臂接 PA4，PA0 接 HS-55 的 SIG。舵机用独立 5 V 电源并与 Blue Pill 共地 | ADC1 每 20 ms 采样一次，TIM2 CH1 输出 50 Hz。旋钮保持 75% 时，改 `SERVO_REVERSED` 可将脉宽由 1800 µs 改为 1200 µs，舵臂由 +30° 逐步转到 −30° |
| `native-relay/main.c` 与 `relay_policy.h` | PA0 接 Grove Relay v1.2 的 SIG。继电器模块由开发板 5 V 供电。COM/NO 串入独立 3.3 V 黄灯回路 | TIM2 CH1 输出 500 ms 周期。把 `PULSE_MS` 从 2 改为 220 后，模型的触点吸合，外接灯出现约 3.82 mA 的电流 |

芯片引脚和内存规格见 [STM32F103C8 数据手册](https://www.st.com/resource/en/datasheet/stm32f103c8.pdf)。SysTick 的控制位和计数行为见 [ST Cortex-M3 编程手册](https://www.st.com/resource/en/programming_manual/cd00228163-stm32f10xxx20xxx21xxxl1xxxx-cortexm3-programming-manual-stmicroelectronics.pdf)。

点灯示例使用标准的 SysTick 中断。实验台使用的 `stm32f1-emu` 3.3.0 支持该中断，硬件 `COUNTFLAG` 轮询行为尚未实现。仿真时间按指令数和时钟估算。

ADC 示例在 `main` 中完成 ADC1 校准，再以软件触发方式读取通道 1。PWM 示例启用硬件预装载寄存器。实验台按定时器寄存器计算频率和占空比，显示不细分预装载传入的那一个周期。

温度报警固件在 HSI 8 MHz 下配置 PB6、PB7 为复用开漏，使用 APB1 的 I²C1 以 100 kHz 与 `0x18` 通信。写入温度寄存器指针 `0x05` 后发出重复 START，按 POS、ACK、BTF 和 STOP 的顺序接收两个字节。上电先等待 250 ms，每次读取后再等待约 300 ms。USART1 的 PA9 以 9600 baud、8N1 输出 `TEMP=34.5000` 这样的有符号读数。地址未应答输出 `I2C=0x04`（SR1 的 AF 标志），软件超时输出 `I2C=0xFF`。 [ST AN2824 双字节接收](https://www.st.com/resource/en/application_note/an2824-stm32f10xxx-ic-optimized-examples-stmicroelectronics.pdf) · [MCP9808 温度寄存器](https://onlinedocs.microchip.com/oxy/GUID-E22726BA-F321-4F22-9A99-2F3CADEC9AAB-en-US-1/GUID-BFCBB20C-8B69-417F-939F-9F0BAB889663.html)

温度显示固件仍从 `0x18` 读取温度，并向 `0x3D` 的 SSD1306 写命令和像素。启动时清理显示内存，后续每次只更新第 3–4 页中的 84 列（页与列均从 0 起计），每笔传输最多 32 字节，含控制字节。串口始终报告摄氏读数，屏幕单位由编译参数决定。屏幕更新成功时输出 `DISPLAY=34.5 C` 或 `DISPLAY=94.1 F`。若传感器未应答，输出 `SENSOR_I2C=0x04`，仍可向屏幕写入 `ERR`。若仅屏幕未应答，输出 `OLED_I2C=0x04`，温度读取继续，仍通电的屏幕保留断线前的画面。 [Adafruit 128×64 OLED 地址与接线](https://learn.adafruit.com/monochrome-oled-breakouts/circuitpython-usage)

## 重新编译

使用 Ubuntu 24.04 的 `gcc-arm-none-eabi` `15:13.2.rel1-2` 和 `binutils-arm-none-eabi` `2.42-1ubuntu1+23`。工具包按 Ubuntu 软件包索引中的 SHA-256 校验。本目录的 `startup.S` 和 `stm32f103c8.ld` 分别提供启动代码和内存布局。

```sh
for example in blink button adc pwm; do
  arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os -Wall -Wextra -Werror \
    -ffreestanding -fno-unwind-tables -fno-asynchronous-unwind-tables \
    -ffunction-sections -fdata-sections -nostdlib -Wl,--gc-sections,-z,noexecstack \
    -T stm32f103c8.ld startup.S "$example.c" -o "$example.elf"
  arm-none-eabi-objcopy -O ihex "$example.elf" "$example.hex"
  arm-none-eabi-objcopy -O binary "$example.elf" "$example.bin"
  arm-none-eabi-objdump -h -d "$example.elf"
done
```

从同一份温度报警源码分别编译 30 °C 和 38 °C 版本。用同一套工具链和链接脚本。

```sh
for threshold in 30 38; do
  arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os -Wall -Wextra -Werror \
    -ffreestanding -fno-unwind-tables -fno-asynchronous-unwind-tables \
    -ffunction-sections -fdata-sections -nostdlib -Wl,--gc-sections,-z,noexecstack \
    -DALARM_C="$threshold" -T stm32f103c8.ld startup.S temperature.c -o "temperature-$threshold.elf"
  arm-none-eabi-objcopy -O ihex "temperature-$threshold.elf" "temperature-$threshold.hex"
done
```

温度显示使用同一份源码和相同的启动与链接文件，`DISPLAY_FAHRENHEIT=0` 编译摄氏版，`DISPLAY_FAHRENHEIT=1` 编译华氏版。

```sh
for unit in c f; do
  fahrenheit=0
  if [ "$unit" = f ]; then fahrenheit=1; fi
  arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os -Wall -Wextra -Werror \
    -ffreestanding -fno-unwind-tables -fno-asynchronous-unwind-tables \
    -ffunction-sections -fdata-sections -nostdlib -Wl,--gc-sections,-z,noexecstack \
    -DDISPLAY_FAHRENHEIT="$fahrenheit" -T stm32f103c8.ld startup.S temperature-display.c \
    -o "temperature-display-$unit.elf"
  arm-none-eabi-objcopy -O ihex "temperature-display-$unit.elf" "temperature-display-$unit.hex"
done
```

HEX 带有 Flash 地址。导入同一固件的 BIN 时，起始地址为 `0x08000000`。

| 示例 | Flash 字节数 | BIN SHA-256 |
| --- | ---: | --- |
| `blink` | 396 | `d7ac5e38f8d9690d8f281fc8afea2ddaba2f55cfd9161ab1b4bb3b0f597bae15` |
| `button` | 392 | `a19e947e5977d28b2fad2d499330f32217d2d0bbb66679b383a3ca143c20be22` |
| `adc` | 656 | `bfd450b3d21f0ac8cbbd36fa5d38ff0a2db89cf51e55a60490aa6dfc74b54d5a` |
| `pwm` | 436 | `506ffbecfcedbd87fa1f977ba2b78a127dd67b370e7a28c648f1254192e9992e` |

| 温度固件 | Flash 字节数 | HEX 文本 SHA-256（LF） |
| --- | ---: | --- |
| `temperature-30.hex` | 1252 | `03bde2eb260167e91bafd1b91a1f4874e17ec2b2ebfe5206812522001cbf0767` |
| `temperature-38.hex` | 1252 | `f4eff4d8d0127c89fd4d0db669196c97bdb70ce4569ddeca881634e20ed476cf` |
| `temperature-display-c.hex` | 2116 | `39ec4d1c29a9fe613e0ed4e465924f2c7e60a5b5c60c36fa02ee0d8ba9e05b70` |
| `temperature-display-f.hex` | 2120 | `e8ffe29d0f6646fc21b38334f32871a4c51227856fd0164023b97e15da5a05ba` |
