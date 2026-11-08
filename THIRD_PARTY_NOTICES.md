# 第三方素材与软件声明

下列许可适用于相应的第三方软件、照片和指定模型改作。项目自有代码的仓库级许可证尚待权利人选定。

## 板卡照片

| 文件 | 署名及改动 | 原始来源和许可 |
| --- | --- | --- |
| [Blue Pill](dist/assets/blue-pill-avandalen.jpg) | Avandalen。网页旋转显示，引脚标记使用独立叠层。 | [Blue Pill.jpg](https://commons.wikimedia.org/wiki/File:Blue_Pill.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [Arduino UNO R3](dist/assets/uno-r3-makemagazinde.jpg) | MakeMagazinDE。裁切、缩放并顺时针旋转 90°，引脚标记使用独立叠层。 | [Arduino uno r3.jpg](https://commons.wikimedia.org/wiki/File:Arduino_uno_r3.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [Arduino Nano V3.0](dist/assets/arduino-nano-v3-mellis.jpg) | David A. Mellis，2010 年的 Gravitech V3.0 照片。网页旋转 180°，引脚标记使用独立叠层。 | [原始文件及版本记录](https://commons.wikimedia.org/wiki/File:Arduino_Nano.jpg#filehistory) · [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| [Raspberry Pi Pico](dist/assets/raspberry-pi-pico-phiarc.jpg) | Phiarc。使用等比缩略图，网页旋转显示，引脚标记使用独立叠层。 | [Raspberry Pi Pico top.jpg](https://commons.wikimedia.org/wiki/File:Raspberry_Pi_Pico_top.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [ESP32-DevKitC V4](dist/assets/esp32-devkitc-v4-photo.svg) | Espressif Systems。裁切和旋转官方功能图，保留原有红色标记。 | [原图](https://github.com/espressif/esp-dev-kits/blob/5c06bf1835329d6525f316475f7218aab6acfe79/docs/_static/esp32-devkitc/esp32-devkitc-v4-functional-overview.png) · [Espressif 文档许可](https://github.com/espressif/esp-dev-kits/blob/5c06bf1835329d6525f316475f7218aab6acfe79/README.md#open-source-licensing) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

照片及其改作沿用上表的署名和许可，验收画面中展示的照片也按上表署名。NUCLEO-F103RB 对照页的左图为本项目的 Blender 俯视渲染，附 ST 官方实物照片入口。

## CAD 与板图来源

| 模型 | 改作范围 | 原始来源和许可 |
| --- | --- | --- |
| [Arduino UNO R3 DIP](dist/models/uno-r3-detail.glb) | Arduino SA 的 A000066 UNO-TH Rev3e 板框、孔、布局和铜层改为 Blender 网格。CAD 衍生部分沿用 CC BY-SA 4.0。 | [Arduino CAD](https://docs.arduino.cc/hardware/uno-rev3/#downloadable-resources) · [生成脚本](tools/blender/uno_r3.py) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [经典 Arduino Nano](dist/models/arduino-nano-detail.glb) | Arduino A000005 NanoV3.3 CAD 提供共用板框、排针孔和背面布局。正面参考 Mellis 的 V3.0 照片。CAD 衍生部分沿用 CC BY-SA 4.0。 | [Arduino CAD](https://docs.arduino.cc/hardware/nano/#downloadable-resources) · [生成脚本](tools/blender/arduino_nano.py) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [经典 Raspberry Pi Pico Rev3](dist/models/pico-rp2040-detail.glb) | 参考 Raspberry Pi 的尺寸图和 STEP 重建板形、孔和主要器件位置。 | [官方设计资料及许可](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#resources-for-non-wireless-raspberry-pi-pico-boards) · [生成脚本](tools/blender/pico.py) |
| [SparkFun BOB-09110 摇杆转接板](dist/models/joystick-sparkfun.glb) | SparkFun Electronics 的 PCB 设计改为教学模型，转接板改作沿用 CC BY-SA 4.0。 | [SparkFun 硬件设计与许可](https://github.com/sparkfun/Thumb_Joystick_Breakout#license-information) · [生成脚本](tools/blender/joystick_sparkfun.py) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [Adafruit #5027 MCP9808](dist/models/mcp9808-5027.glb) | 参考 Adafruit 的 Eagle 文件重建板形、孔位和器件布置。板形及布局改作沿用 CC BY-SA 3.0。 | [Adafruit PCB](https://github.com/adafruit/Adafruit-MCP9808-Breakout-PCB#license) · [生成脚本](tools/blender/mcp9808_5027.py) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [Adafruit #326 SSD1306](dist/models/ssd1306-326.glb) | 参考 Adafruit 的 Eagle 文件重建板形、开孔、插座位置和屏幕开口。板形及布局改作沿用 CC BY-SA 3.0。 | [Adafruit PCB](https://github.com/adafruit/Adafruit-128x64-Monochrome-OLED-PCB#license) · [生成脚本](tools/blender/ssd1306_326.py) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

上述两块 Adafruit 板的原始 PCB 设计署名为 Limor Fried / Ladyada，Adafruit Industries。Adafruit invests time and resources providing this open source design, please support Adafruit and open-source hardware by purchasing products from [Adafruit](https://www.adafruit.com/)!

其他板和元件的尺寸、封装及位置参考见 [Blender 生成脚本](tools/blender) 和 [各实验说明](README.md)。厂商文档及课程通过资料库的来源入口阅读。

## 随包软件与固件

| 组件 | 来源与随包许可 |
| --- | --- |
| Three.js r170 与 OrbitControls、GLTFLoader、BufferGeometryUtils | [Three.js 上游](https://github.com/mrdoob/three.js/tree/r170) · [MIT](dist/vendor/THREE-LICENSE.txt) |
| JSZip 3.10.1，含其附带的 pako | [JSZip 上游](https://github.com/Stuk/jszip) · [MIT 或 GPLv3](dist/vendor/JSZIP-LICENSE.txt) · [pako 的 MIT 声明](https://github.com/nodeca/pako/blob/main/LICENSE) |
| AVR8js 0.21.1 | [Wokwi 上游](https://github.com/wokwi/avr8js/releases/tag/v0.21.1) · [MIT](dist/vendor/avr8js/LICENSE.txt) |
| stm32f1-emu 3.3.0 | [版本与打包说明](dist/vendor/stm32f1-emu/SOURCE.txt) · [MIT](dist/vendor/stm32f1-emu/LICENSE.txt) |
| rp2040js 1.4.1 | [版本与打包说明](dist/vendor/rp2040js/SOURCE.txt) · [MIT](dist/vendor/rp2040js/LICENSE.txt) |
| 浏览器 C 工具链 | [打包来源及许可清单](dist/vendor/bluepill-clang/README.md) · [随包声明](dist/vendor/bluepill-clang/LICENSES)，LLVM、Clang、LLD 与资源头文件采用 Apache 2.0 + LLVM 例外，YoWASP 保留 ISC 声明 |
| Pico 样例的 boot2 | Raspberry Pi (Trading) Ltd. · [BSD 3-Clause](dist/firmware/pico/boot2-LICENSE.txt) |
