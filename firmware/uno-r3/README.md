# UNO R3 和经典 Nano 原生固件示例

以下固件均为 16 MHz 的 ATmega328P 编译。点灯、按键、ADC 示例可在 UNO R3 和经典 Nano 的实验台运行，温度报警预接线实验使用 UNO R3。加载 `.hex` 后从 Flash 的复位向量开始执行。修改 `.c` 源文件后需要重新编译。

| 示例 | 接线 | 预期现象 |
| --- | --- | --- |
| `blink.c` / `blink.hex` | 使用 D13（PB5）对应的板载 L 灯，无需外接元件 | 亮 500 ms，灭 500 ms，循环往复 |
| `button.c` / `button.hex` | 按键一端接 D2（PD2），另一端接 GND。程序开启 D2 内部上拉 | 按下时板载 L 灯亮起，松开时熄灭 |
| `adc.c` / `adc.hex` | 电位器两端接 5 V 和 GND，滑动端接 A0（ADC0） | 通过 9600 波特率串口发送 0–1023。达到 512 时 D13 点亮 |
| `temperature.c` / `temperature-30.hex`、`temperature-38.hex` | MCP9808 模块的 VIN、GND、SDA、SCL 分别接 5 V、GND、A4、A5。D12 经 330 Ω 电阻接报警灯正极，负极接 GND | 首次读数等待至少 250 ms，每次读取后等待 300 ms。环境读数同为 34.5 °C 时，30 °C 固件点亮报警灯，38 °C 固件熄灭报警灯 |

引脚映射见 [Arduino UNO R3 官方引脚图](https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf)。

## 重新编译

点灯、按键和 ADC 固件使用 Ubuntu 24.04 的 AVR 工具链，包版本为 `gcc-avr` `1:7.3.0+Atmel3.7.0-1`、`avr-libc` `1:2.0.0+Atmel3.7.0-1` 和 `binutils-avr` `2.26.20160125+Atmel3.7.0-2`。

在本目录运行以下命令。`.elf` 是中间文件，实验台使用生成的 `.hex`。

```sh
for example in blink button adc; do
  avr-gcc -mmcu=atmega328p -DF_CPU=16000000UL -std=c11 \
    -Os -Wall -Wextra -Werror "$example.c" -o "$example.elf"
  avr-objcopy -O ihex -j .text -j .data "$example.elf" "$example.hex"
  avr-objdump -d "$example.elf"
done
```

两份温度报警固件使用 Arduino 分发的 AVR GCC `7.3.0-atmel3.6.1-arduino7` Windows 版。下载归档的 SHA-256 为 `a54f64755fff4cb792a1495e5defdd789902a2a3503982e81b898299cf39800e`，与 Arduino 工具包索引中的校验值一致。 [Arduino 工具包索引](https://downloads.arduino.cc/packages/package_index.json) · [AVR GCC 归档](https://downloads.arduino.cc/tools/avr-gcc-7.3.0-atmel3.6.1-arduino7-i686-w64-mingw32.zip)

```sh
for threshold in 30 38; do
  avr-gcc -mmcu=atmega328p -DF_CPU=16000000UL -DALARM_C="$threshold" \
    -std=c11 -Os -Wall -Wextra -Werror temperature.c -o "temperature-$threshold.elf"
  avr-objcopy -O ihex -j .text -j .data "temperature-$threshold.elf" "temperature-$threshold.hex"
done
```

程序用 ATmega328P 的 TWI 寄存器在 100 kHz 下向地址 `0x18` 写入温度寄存器指针 `0x05`，随后发重复 START，读取高字节（ACK）与低字节（NACK），最后发 STOP。USART0 使用 9600 baud、8N1，正常时输出如 `TEMP=34.5000` 的读数。地址未应答时输出 `I2C=0x20` 并把 D12 拉低，其他传输错误同样关闭报警灯。 [Microchip MCP9808 数据手册](https://www.microchip.com/content/dam/mchp/documents/OTH/ProductDocuments/DataSheets/MCP9808-0.5C-Maximum-Accuracy-Digital-Temperature-Sensor-Data-Sheet-DS20005095B.pdf)

## 校验

用 `avr-size` 读取 Flash 占用，再用 `avr-objdump` 核对指令。点灯示例使用 `sbi` 和 `cbi` 写入 PB5，按键示例使用 `sbis` 读取 PD2，ADC 示例等待 `ADSC` 清零后读取转换结果。重复编译生成的文件与现有文件逐字节一致。

| 固件 | Flash 字节数 | HEX 文本 SHA-256（换行统一为 LF） |
| --- | ---: | --- |
| `blink.hex` | 176 | `709da91dfc961b5287a6e9e77eee33fb1b1dd50012c845823b87a872696683c8` |
| `button.hex` | 150 | `1330b79115beceaa308c43b94d029bcdb86e1eb77fef099579661b9c658e616b` |
| `adc.hex` | 384 | `13efcd8b7966b0789c4d618f0518139fc48576714efdc05298219f62609cad2f` |
| `temperature-30.hex` | 834 | `6569f6a4f176c9417445482ace3315516f6037a5976d8b16b57b916d92b602f2` |
| `temperature-38.hex` | 834 | `daf142312b25962f566c3a7744506f358b4e6771101b9840fabaf8f4237320d2` |
