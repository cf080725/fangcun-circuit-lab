# Raspberry Pi Pico RP2040 原生固件示例

这些示例面向经典 Raspberry Pi Pico。Arm GCC 将 C 源码编译为 Cortex-M0+ Thumb 指令，使用 2 MiB Flash 和 264 KiB SRAM 布局。固件含 Raspberry Pi Pico SDK 的 W25Q080 二级启动代码及其 CRC。应用向量位于 `0x10000100`，初始栈顶为 `0x20042000`。

| 示例 | 接线 | 预期现象 |
| --- | --- | --- |
| `blink.c` / `blink.uf2` | 使用 GP25 板载灯。可在 GP15 与 GND 之间接上串有限流电阻的 LED | 使用 12 MHz 晶体和硬件计时器，每 500 ms 翻转 GP25 和 GP15 |
| `button.c` / `button.uf2` | 按键接 GP14 和 GND。GP15 经限流电阻接 LED 阳极，阴极接 GND | GP14 使用内部上拉。按下时外接灯亮，松开时灯灭 |
| `adc.c` / `adc.uf2` | 电位器两端接 3.3 V 和 GND，滑动端接 GP26。GP15 经限流电阻接 LED | ADC0 每 100 ms 采样一次，UART0 以 9600 baud 输出 0–4095。读数达到 2048 时 LED 点亮 |
| `pwm.c` / `pwm.uf2` | GP15 经限流电阻接 LED 阳极，阴极接 GND | PWM 切片 7 通道 B 以 1 kHz 输出，每 500 ms 在 25% 和 75% 占空比间切换 |

实验台验证 UF2 内的二级启动代码校验值，从应用向量进入单核仿真。计时和电气状态在仿真中近似呈现。硬件定义见 [RP2040 数据手册](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)。

ADC 示例用 USB PLL 提供 48 MHz ADC 时钟，关闭 GP26 的数字输入输出并轮询单次转换。PWM 示例使用硬件比较寄存器，在计数器回绕时更新占空比。

## 重新编译

在装有 `arm-none-eabi-gcc`、GNU Binutils 和 Python 3 的 Linux 环境运行以下命令。本次使用 Ubuntu 24.04 的 `gcc-arm-none-eabi` `15:13.2.rel1-2` 和 `binutils-arm-none-eabi` `2.42-1ubuntu1+23`。

```sh
git clone --depth 1 --branch 1.5.1 https://github.com/raspberrypi/pico-sdk.git
git -C pico-sdk rev-parse HEAD
bash build.sh pico-sdk
```

SDK 提交为 `6a7db34ff63345a7badec79ebea3aaef1712f374`。脚本用原版 `boot2_w25q080.S`、链接脚本及 `pad_checksum` 生成 256 字节的二级启动代码，随后链接本目录的 `startup.S`、`rp2040.ld` 和 C 源码。生成的 UF2 使用 RP2040 家族标识 `0xe48bff56`。二级启动代码的许可随文件提供。 [Pico SDK 1.5.1 的启动代码](https://github.com/raspberrypi/pico-sdk/tree/6a7db34ff63345a7badec79ebea3aaef1712f374/src/rp2_common/boot_stage2)

| 固件 | Flash 实际字节数 | UF2 文件 SHA-256 |
| --- | ---: | --- |
| `blink.uf2` | 740 | `b19a2f630facd09f876a38cb263559baae76c363a3c68345d7d7ace0edd31076` |
| `button.uf2` | 668 | `58d069cc2c75c40f54a8551d6619ac8936de23c67296dc17d4190f9dcb172e01` |
| `adc.uf2` | 1068 | `9db54f011a03db8326f7741db7f74a32d33c27ca5bf01d1d34990d77867a2258` |
| `pwm.uf2` | 792 | `f1b723df75c5d254d591976f9bcc91e6de0cd7329aec0ea9ddacbf4a86a40628` |
