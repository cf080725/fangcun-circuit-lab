# Arduino Mega 2560 原生固件示例

三个示例均以 16 MHz 的 ATmega2560 为编译目标。实验台加载 `.hex` 后从 Flash 的复位向量开始执行。修改有注释的 `.c` 文件后需要重新编译。

| 示例 | 接线 | 预期现象 |
| --- | --- | --- |
| `blink.c` / `blink.hex` | 使用 D13（PB7）对应的板载 L 灯 | 每 500 ms 在亮、灭之间切换 |
| `button.c` / `button.hex` | 按键一端接 D2（PE4），另一端接 GND。程序开启 D2 的内部上拉 | 按下时板载灯亮，松开时灯灭 |
| `adc.c` / `adc.hex` | 电位器两端接 5 V 和 GND，滑动端接 A0（PF0 / ADC0） | 通过 USART0 以 9600 baud 发送 0–1023。读数达到 512 时 D13 点亮 |

引脚映射见 [Arduino Mega 2560 Rev3 官方引脚图](https://docs.arduino.cc/resources/pinouts/A000067-full-pinout.pdf)。

## 重新编译

使用 Ubuntu 24.04 的 AVR 工具链，包版本为 `gcc-avr` `1:7.3.0+Atmel3.7.0-1`、`avr-libc` `1:2.0.0+Atmel3.7.0-1` 和 `binutils-avr` `2.26.20160125+Atmel3.7.0-2`。

在本目录运行以下命令，生成可导入实验台的 HEX 文件。

```sh
for example in blink button adc; do
  avr-gcc -mmcu=atmega2560 -DF_CPU=16000000UL -std=c11 \
    -Os -Wall -Wextra -Werror "$example.c" -o "$example.elf"
  avr-objcopy -O ihex -j .text -j .data "$example.elf" "$example.hex"
  avr-size "$example.elf"
  avr-objdump -d "$example.elf"
done
```

## 校验

反汇编确认点灯与按键固件使用 `sbi` 和 `cbi` 操作 PB7，按键固件用 `sbis` 读取 PE4。ADC 固件轮询 `ADSC`，按低字节、高字节的顺序读取结果。

| 固件 | Flash 字节数 | HEX 文本 SHA-256（换行统一为 LF） |
| --- | ---: | --- |
| `blink.hex` | 304 | `4dc4efa912ad57cc5e69d345aa2ac478825b7e840add27249e7b00fcae742af5` |
| `button.hex` | 278 | `5bfe3e5989b6427e63612ee3322e1f11bf6f6744d3018aeabe7f6f5ad8ad8a00` |
| `adc.hex` | 520 | `d2afac691fb29b422e9c48b974406f9fdea20cec336545c53cc078ed28a4344b` |
