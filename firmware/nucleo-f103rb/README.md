# NUCLEO-F103RB 原生固件示例

这些示例面向 NUCLEO-F103RB 上的 STM32F103RBT6，使用 Cortex-M3 Thumb 指令、128 KiB 内部 Flash 和 20 KiB SRAM。向量表位于 `0x08000000`，初始栈顶为 `0x20005000`。示例保留复位后的 8 MHz HSI 时钟。

| 示例 | 接线 | 预期现象 |
| --- | --- | --- |
| `blink.c` / `blink.hex` / `blink.bin` | 使用 PA5 对应的板载 LD2 | LD2 高电平点亮，每 500 ms 在亮、灭间切换 |
| `button.c` / `button.hex` / `button.bin` | 使用板载 B1（PC13）和 LD2（PA5） | 松开时 PC13 由板上电阻上拉，按下时 PC13 接地，LD2 点亮 |
| `adc.c` / `adc.hex` / `adc.bin` | 电位器两端接 3.3 V 和 GND，滑动端接 Arduino A0（PA0） | ADC1 通道 0 每 100 ms 采样。读数达到 2048 时 LD2 点亮，USART2 以 9600 baud 输出 0–4095 |
| `pwm.c` / `pwm.hex` / `pwm.bin` | PB4（Arduino D5）经限流电阻接 LED 阳极，阴极接 GND | 部分重映射后的 TIM3_CH1 输出 1 kHz PWM，每 500 ms 切换 25% / 75% 占空比 |

B1 示例将 PC13 配置为数字输入，由 MB1136 板上的 R30 上拉。ADC 示例经 PA2 的 USART2 TX 输出，标准板的焊桥将其接到 ST-LINK 虚拟串口。PWM 示例释放 PB4 的 JTAG 功能并保留 SWD。 [ST Nucleo-64 用户手册](https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf) · [MB1136 C04 原理图](https://www.st.com/resource/en/schematic_pack/mb1136-default-c04_schematic.pdf) · [ST F103RB Nucleo BSP](https://github.com/STMicroelectronics/stm32f1xx-nucleo-bsp/blob/main/stm32f1xx_nucleo.c)

「B1 控制 LD2 · 多文件 C」实验加载 [main.c](native-button/main.c)、[led_policy.c](native-button/led_policy.c) 和 [led_policy.h](native-button/led_policy.h)。浏览器用下方同一份启动代码和链接脚本链接两个 C 文件。将头文件里的 `LIGHT_WHEN_PRESSED` 从 `1` 改成 `0`，再重新编译，松开 B1 时 LD2 会亮，按下时会灭。可以在固件详情下载编译得到的 HEX。

## 重新编译

本次使用 Ubuntu 24.04 的 `gcc-arm-none-eabi` `15:13.2.rel1-2` 和 `binutils-arm-none-eabi` `2.42-1ubuntu1+23`。下列命令使用相邻 Blue Pill 目录中共用的 F103 启动代码，并为本板选择 128 KiB Flash 的链接脚本。

```sh
for example in blink button adc pwm; do
  arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Os -Wall -Wextra -Werror \
    -ffreestanding -fno-unwind-tables -fno-asynchronous-unwind-tables \
    -ffunction-sections -fdata-sections -nostdlib -Wl,--gc-sections,-z,noexecstack \
    -T stm32f103rb.ld ../bluepill/startup.S "$example.c" -o "$example.elf"
  arm-none-eabi-objcopy -O ihex "$example.elf" "$example.hex"
  arm-none-eabi-objcopy -O binary "$example.elf" "$example.bin"
  arm-none-eabi-objdump -h -d "$example.elf"
done
```

HEX 带有地址。导入 BIN 时，实验台从 `0x08000000` 映射固件。仿真时间按指令数和时钟估算。

| 示例 | Flash 字节数 | BIN SHA-256 |
| --- | ---: | --- |
| `blink` | 400 | `305429eca675b636c6e397e533f71d0bf30ee82e1cf796e6d72161dc9a08f679` |
| `button` | 388 | `cf38ad6110cc3ee2b02f9f11ca0aab52cb2d84cde3f3d1ff7aee214e09c56eb8` |
| `adc` | 644 | `0fcfaa2abf55c3db2c2664887f3b4055b693bac9ab50e34bd4621b75adc14f5f` |
| `pwm` | 480 | `56992c7840f214dafcebeed5f10abd69eb7507723485894e02047ca8844998cb` |
