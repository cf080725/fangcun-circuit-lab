# 多板实验室：硬件目录与资料来源核验

核验日期：2026-11-06。本目录服务于开发板与器件检索、学习指导和实物选型。收录 56 款开发板、72 项元件及模块，并新增 45 条学习资料入口。新增资料中中文 15 条，英文 30 条；与原 resources.json 的 20 条没有重复 ID 或 URL。

## 核验方法与范围

只使用芯片厂商、板卡设计者、项目维护者与课程作者的一手公开来源。每条硬件保存 source、checked_on；资料保存 source_page、verified_date、language、status 和阅读提示。核验覆盖官方网页、官方 PDF 或官方页面的搜索索引正文；部分 JavaScript 下载站与资料站无法完整展开，保留厂商入口，不声称已经读取压缩包内容。日期表示本次核验时间，不表示网页在该日发布。

这是主流硬件的第一批目录，不是全市场产品清单。板卡型号、修订号、模组 Flash/PSRAM 后缀和软件版本会变化。未知参数用“见手册”“按 SKU”或 null 表示，没有把同一系列的参数推给所有板型。价格、库存和销售链接不纳入目录；“商城”是可搜索的硬件资料与备料界面。

## 能力等级必须与运行内核一致

| 值 | 对用户的含义 | 本目录处理 |
| --- | --- | --- |
| simulate | 内核已有相应行为或电气模型，可添加并运行该受支持范围 | 由 BOARD_PROFILES / PARTS 的真实键计算；不能由目录收录数量推断 |
| wiring | 只提供可操作的布局和接线参考，没有运行模型 | 本批没有把资料条目擅自升级成 wiring |
| reference | 参数、学习提示、原始资料与备料记录 | 数据条目默认值；运行时仅在模型确实存在时升级 |

已对齐的 9 个 board profileId：`bluepill`、`nucleo-f103rb`、`nucleo-f401re`、`uno-r3`、`nano`、`mega2560`、`esp32-devkitc`、`esp32-c3-devkitm`、`pico`。这些绑定说明可使用教学平台的受支持行为，不代表整颗 MCU、二进制固件、无线协议栈或周期精度仿真。

元件目录的 16 条模型候选覆盖 15 种 modelType：`led`、`rgbled`、`resistor`、`pot`、`button`、`switch`、`diode`、`capacitor`、`ldr`、`thermistor`、`sevenseg`、`buzzer`、`servo`、`motor`、`power`。其中硅二极管和肖特基使用同一 diode 类型的不同教学参数。未为 OLED、SPI/I²C 传感器、无线功能、Linux 板等假设运行支持。电机、舵机、LDR 等默认值明确为教学近似，不代表具体商业器件的完整物理模型。

## 给界面与资料库的索引建议

1. 第一层区分开发板、元件、备料清单；开发板按 family，器件按 category 分类。
2. 第二层提供能力筛选“可运行模型 / 资料与选型”；初学模式优先展示有教学示例和模型的项目。
3. 搜索覆盖中文名、芯片完整型号、接口、用途和别名。目录补充 I2C / I²C、I2S / I²S、意法半导体、乐鑫、沁恒、树莓派、传感器、输入、输出等索引词。
4. 选型引导先问“想测什么、控制什么、显示什么”，再提示电源电压、逻辑电平、所需接口、开发框架。选中器件后展示 guide 和 warning，不只展示参数缩写。
5. 资料库按来源分“官方中文 / 官方英文 / 作者课程 / 作者配套 / 厂商教程”，再按 family、阶段和关键词筛选。中文页面并不保证其下全部附件都为中文，应以具体附件标注为准。
6. 保持下载状态独立于来源与语言。本批新增 45 条均为 link_only，只能显示“打开原文 / 配套入口”；即使网址直接指向 PDF，也没有在本批下载。原资源库中已下载文件仍由原 download_url 提供。
7. 备料清单记录来源、数量和支持状态；参考条目可收藏，但不能使用“加入并运行”暗示已完成仿真。

## 需要明确保留的型号边界

- Blue Pill 是通用板型，ST 只提供其中芯片的一手资料；不能称为 ST 官方开发板。不同兼容板的晶振、USB 电路与丝印需独立核对。
- Nucleo H743 的 ZI 与 ZI2、芯片修订及主频支持应结合板号与手册。Nucleo-64 的 UM1724 只覆盖其列出的 MB1136 板卡，不能推广至所有 Nucleo。
- ESP32-DevKitC 的 WROOM/WROVER 与 Flash、PSRAM 后缀改变可用引脚和存储；S3 DevKitC 的修订会改变板载 RGB 引脚。ESP32-H2 支持 BLE / IEEE 802.15.4，没有 Wi-Fi。
- Arduino UNO R3 与 R4 分属 AVR 和 Renesas；R4 WiFi 的无线协处理器并不把主 MCU 变成 ESP32。UNO Q 包含 Linux MPU 与 STM32 MCU，两端电气与软件流程不能简化成一张通用 UNO 接线图。
- Pico 2 的 Arm 与 RISC-V 是可选执行架构，不能把它当成四个任意并用的通用核心。Pico、Pico W、Pico 2、Pico 2 W 需要相应固件和板卡定义。
- Teensy 4.0 的 2MB Flash 顶部 64KB、Teensy 4.1 的 8MB Flash 顶部 256KB 留给 EEPROM 仿真和恢复程序；物理容量不等于全部可用程序空间。来源：[4.0](https://www.pjrc.com/store/teensy40.html)、[4.1](https://www.pjrc.com/store/teensy41.html)。
- Seeed XIAO ESP32S3 Sense 的摄像头修订需按其当前文档核对；不要固定承诺所有历史板都使用同一摄像头。FRDM-K64F 新版的传感器装配也有停产变更。
- Grove 超声波模块使用共用 SIG，不能套用四脚 HC-SR04 的接法。TM1637 的 CLK/DIO 两线协议不是 I²C。
- Adafruit 的许多传感器转换板带稳压和电平转换；这些 5V 兼容结论不适用于同芯片裸件或其他厂家的 GY 模块。Adafruit microSD SPI/SDIO 板明确仅供 3.3V 电源和逻辑。
- 驱动器最大峰值、模块可持续电流、线路承载能力是不同指标。电源板 LM2596 的芯片电流标称不代表所有廉价模块都可连续输出同样电流。
- WCH 下载页为动态站点，核对到厂商 EVT 入口与适用系列信息；未取得压缩包本体，未给 CH32 系列虚填通用 Flash/RAM 参数。
- 野火、正点原子和江协资料按作者原站链接；原资源库继续保留铁头山羊已核验课程与旧版配套状态。没有下载版权不明的镜像课件或声称取得作者未公开的新配套包。

## 开发板覆盖

| 系列 | 数量 |
| --- | ---: |
| STM32 | 12 |
| Arduino | 7 |
| ESP32 | 8 |
| Nordic | 5 |
| Linux / AI | 7 |
| RP2040 / RP2350 | 6 |
| ESP8266 | 1 |
| micro:bit | 1 |
| Teensy | 2 |
| SAMD | 1 |
| TI MSP | 2 |
| NXP | 2 |
| RISC-V | 2 |

| ID / 板卡 | 芯片与频率 | Flash / RAM | 逻辑电平 | profileId | 原始来源 |
| --- | --- | --- | --- | --- | --- |
| bluepill · STM32F103C8T6 · Blue Pill | STM32F103C8T6 / 最高 72 MHz | 64 KB / 20 KB | 3.3 V | bluepill | [厂商/设计者](https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html) |
| nucleo-f103rb · NUCLEO-F103RB | STM32F103RBT6 / 72 MHz | 128 KB / 20 KB | 3.3 V | nucleo-f103rb | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-f103rb.html) |
| nucleo-f401re · NUCLEO-F401RE | STM32F401RET6 / 84 MHz | 512 KB / 96 KB | 3.3 V | nucleo-f401re | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-f401re.html) |
| nucleo-f411re · NUCLEO-F411RE | STM32F411RET6 / 100 MHz | 512 KB / 128 KB | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-f411re.html) |
| nucleo-f446re · NUCLEO-F446RE | STM32F446RET6 / 180 MHz | 512 KB / 128 KB + 4 KB 备份 SRAM | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-f446re.html) |
| nucleo-l476rg · NUCLEO-L476RG | STM32L476RGT6 / 80 MHz | 1 MB / 128 KB | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-l476rg.html) |
| nucleo-g071rb · NUCLEO-G071RB | STM32G071RBT6 / 64 MHz | 128 KB / 36 KB | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-g071rb.html) |
| nucleo-h743zi · NUCLEO-H743ZI / ZI2 系列 | STM32H743ZIT6 / 最高 480 MHz，依芯片修订与配置 | 2 MB / 约 1 MB，分区见手册 | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-h743zi.html) |
| nucleo-u575zi-q · NUCLEO-U575ZI-Q | STM32U575ZIT6Q / 160 MHz | 2 MB / 786 KB | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-u575zi-q.html) |
| nucleo-h563zi · NUCLEO-H563ZI | STM32H563ZIT6 / 250 MHz | 2 MB / 640 KB | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/nucleo-h563zi.html) |
| stm32f746g-disco · STM32F746G-DISCO | STM32F746NGH6 / 216 MHz | 1 MB 芯片内置；外部存储见板卡手册 / 320 KB + 16 KB ITCM + 4 KB 备份 SRAM；外部 SDRAM 另计 | 3.3 V | reference | [厂商/设计者](https://www.st.com/en/evaluation-tools/32f746gdiscovery.html) |
| uno-r3 · Arduino UNO R3 | ATmega328P / 16 MHz | 32 KB（包含引导程序） / 2 KB | 5 V | uno-r3 | [厂商/设计者](https://docs.arduino.cc/hardware/uno-rev3/) |
| nano · Arduino Nano · Classic | ATmega328P / 16 MHz | 32 KB（包含引导程序） / 2 KB | 5 V | nano | [厂商/设计者](https://docs.arduino.cc/hardware/nano/) |
| mega2560 · Arduino Mega 2560 Rev3 | ATmega2560 / 16 MHz | 256 KB（其中 8 KB 引导程序） / 8 KB | 5 V | mega2560 | [厂商/设计者](https://docs.arduino.cc/hardware/mega-2560/) |
| uno-r4-minima · Arduino UNO R4 Minima | Renesas RA4M1 / 48 MHz | 256 KB / 32 KB | 5 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/uno-r4-minima/) |
| uno-r4-wifi · Arduino UNO R4 WiFi | RA4M1 + ESP32-S3 / 主 MCU 48 MHz | 主 MCU 256 KB / 主 MCU 32 KB | 5 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/uno-r4-wifi/) |
| nano-every · Arduino Nano Every | ATmega4809 / 芯片最高 20 MHz；按核心配置核对 | 48 KB / 6 KB | 5 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/nano-every/) |
| nano-esp32 · Arduino Nano ESP32 | ESP32-S3 / u-blox NORA-W106 / 见官方数据手册 | 16 MB / 见 NORA-W106 规格 | 3.3 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/nano-esp32/) |
| nano-33-ble-sense-rev2 · Arduino Nano 33 BLE Sense Rev2 | nRF52840 / 64 MHz | 1 MB / 256 KB | 3.3 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/nano-33-ble-sense-rev2/) |
| arduino-due · Arduino Due | ATSAM3X8E / 84 MHz | 见官方数据手册 / 96 KB | 3.3 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/due/) |
| giga-r1-wifi · Arduino GIGA R1 WiFi | STM32H747 系列 / 480 / 240 MHz | 见板卡数据手册 / 见板卡数据手册 | 3.3 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/giga-r1-wifi/) |
| uno-q · Arduino UNO Q | Qualcomm QRB2210 + STM32U585 / 2.0 GHz / MCU 160 MHz | MCU 2 MB；MPU 存储按 SKU / MCU 786 KB；Linux RAM 按 SKU | 按板级手册核对 | reference | [厂商/设计者](https://docs.arduino.cc/hardware/uno-q/) |
| nano-rp2040-connect · Arduino Nano RP2040 Connect | RP2040 + NINA-W102 / 133 MHz | 16 MB / 264 KB | 3.3 V | reference | [厂商/设计者](https://docs.arduino.cc/hardware/nano-rp2040-connect/) |
| esp32-devkitc · ESP32-DevKitC V4 | ESP32-WROOM / WROVER，按模块后缀 / 见对应模块数据手册 | 依模块 SKU / 依模块 SKU | 3.3 V | esp32-devkitc | [厂商/设计者](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) |
| esp32-c3-devkitm · ESP32-C3-DevKitM-1 | ESP32-C3-MINI-1(U) / 见芯片数据手册 | 4 MB / 见芯片数据手册 | 3.3 V | esp32-c3-devkitm | [厂商/设计者](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html) |
| esp32-s3-devkitc · ESP32-S3-DevKitC-1 v1.1 | ESP32-S3-WROOM-1/1U/2 / 见模块数据手册 | 依 N 系列 SKU / SRAM / PSRAM 依 SKU | 3.3 V | reference | [厂商/设计者](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html) |
| esp32-c6-devkitc · ESP32-C6-DevKitC-1 v1.2 | ESP32-C6-WROOM-1(U) / 见芯片数据手册 | 8 MB / 见芯片数据手册 | 3.3 V | reference | [厂商/设计者](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html) |
| esp32-h2-devkitm · ESP32-H2-DevKitM-1 | ESP32-H2-MINI-1(U) / 见芯片数据手册 | 4 MB（N4S） / 见芯片数据手册 | 3.3 V | reference | [厂商/设计者](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html) |
| nodemcu-esp8266 · NodeMCU DEVKIT V1.0 | ESP-12E / ESP8266 / 按固件配置 | 4 MB / 依固件保留区而变 | 3.3 V | reference | [厂商/设计者](https://github.com/nodemcu/nodemcu-devkit-v1.0) |
| pico · Raspberry Pi Pico | RP2040 / 133 MHz | 2 MB / 264 KB | 3.3 V | pico | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-pico/) |
| pico-w · Raspberry Pi Pico W | RP2040 / 133 MHz | 2 MB / 264 KB | 3.3 V | reference | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-pico/) |
| pico2 · Raspberry Pi Pico 2 | RP2350 / 150 MHz | 4 MB / 520 KB | 3.3 V | reference | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-pico-2/) |
| pico2-w · Raspberry Pi Pico 2 W | RP2350 / 150 MHz | 4 MB / 520 KB | 3.3 V | reference | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-pico-2/) |
| raspberry-pi-5 · Raspberry Pi 5 | Broadcom BCM2712 / 2.4 GHz | microSD / 外接存储 / 1 / 2 / 4 / 8 / 16 GB，按型号 | 3.3 V | reference | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-5/) |
| raspberry-pi-4 · Raspberry Pi 4 Model B | Broadcom BCM2711 / 当前产品页标称 1.8 GHz | microSD / 外接存储 / 按内存 SKU | 3.3 V | reference | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-4-model-b/) |
| pi-zero-2-w · Raspberry Pi Zero 2 W | RP3A0 SiP / 1 GHz | microSD / 512 MB | 3.3 V | reference | [厂商/设计者](https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/) |
| microbit-v2 · BBC micro:bit V2.2x | Nordic nRF52833 / 64 MHz | 512 KB / 128 KB | 3.3 V | reference | [厂商/设计者](https://tech.microbit.org/hardware/2-2-revision/) |
| teensy40 · Teensy 4.0 | NXP i.MX RT1062 / 600 MHz | 2 MB / 1 MB | 3.3 V | reference | [厂商/设计者](https://www.pjrc.com/store/teensy40.html) |
| teensy41 · Teensy 4.1 | NXP i.MX RT1062 / 600 MHz | 8 MB / 1 MB | 3.3 V | reference | [厂商/设计者](https://www.pjrc.com/store/teensy41.html) |
| nrf52840-dk · nRF52840 DK | nRF52840 / 64 MHz | 1 MB / 256 KB | 按板级手册核对 | reference | [厂商/设计者](https://www.nordicsemi.com/Products/Development-hardware/nRF52840-DK) |
| nrf5340-dk · nRF5340 DK | nRF5340 / 应用核 128/64 MHz；网络核 64 MHz | 应用核 1 MB + 网络核 256 KB / 应用核 512 KB + 网络核 64 KB | 按板级手册核对 | reference | [厂商/设计者](https://www.nordicsemi.com/Products/Development-hardware/nRF5340-DK) |
| nrf54l15-dk · nRF54L15 DK | nRF54L15 / 见 SoC 数据手册 | 1.5 MB NVM / 256 KB | 按板级手册核对 | reference | [厂商/设计者](https://www.nordicsemi.com/Products/Development-hardware/nRF54L15-DK) |
| xiao-samd21 · Seeed Studio XIAO SAMD21 | ATSAMD21G18A / 48 MHz | 256 KB / 32 KB | 3.3 V | reference | [厂商/设计者](https://wiki.seeedstudio.com/Seeeduino-XIAO/) |
| xiao-rp2040 · Seeed Studio XIAO RP2040 | RP2040 / 133 MHz | 2 MB / 264 KB | 3.3 V | reference | [厂商/设计者](https://wiki.seeedstudio.com/XIAO-RP2040/) |
| xiao-esp32c3 · Seeed Studio XIAO ESP32C3 | ESP32-C3 / 160 MHz | 4 MB / 400 KB | 3.3 V | reference | [厂商/设计者](https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/) |
| xiao-esp32s3-sense · Seeed Studio XIAO ESP32S3 Sense | ESP32-S3R8 / 240 MHz | 8 MB / 8 MB PSRAM；片内 SRAM 另计 | 3.3 V | reference | [厂商/设计者](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| xiao-nrf52840-sense · Seeed Studio XIAO nRF52840 Sense | nRF52840 / 64 MHz | 1 MB 内置 + 2 MB 板载 / 256 KB | 3.3 V | reference | [厂商/设计者](https://wiki.seeedstudio.com/XIAO_BLE/) |
| lp-mspm0g3507 · LP-MSPM0G3507 LaunchPad | MSPM0G3507 / 80 MHz | 128 KB / 32 KB | 3.3 V | reference | [厂商/设计者](https://www.ti.com/tool/LP-MSPM0G3507) |
| msp430fr2355 · MSP-EXP430FR2355 LaunchPad | MSP430FR2355 / 24 MHz | 32 KB FRAM（非 Flash） / 4 KB | 3.3 V | reference | [厂商/设计者](https://www.ti.com/tool/MSP-EXP430FR2355) |
| frdm-k64f · FRDM-K64F | Kinetis K64 / 按器件用户手册 | 1 MB / 见芯片数据手册 | 3.3 V | reference | [厂商/设计者](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-K64F) |
| frdm-mcxn947 · FRDM-MCXN947 | MCXN947VDF / 150 MHz | 2 MB / 1 MB | 3.3 V | reference | [厂商/设计者](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947) |
| ch32v003-evt · CH32V003EVT | CH32V003 系列 / 见 CH32V003 数据手册 | 见具体芯片型号 / 见具体芯片型号 | 按板级手册核对 | reference | [厂商/设计者](https://www.wch.cn/downloads/CH32V003EVT_ZIP.html) |
| ch32v307-evt · CH32V307V-EVT | CH32V307VCT6 / 见 CH32V30x 数据手册 | 见具体芯片型号 / 见具体芯片型号 | 按板级手册核对 | reference | [厂商/设计者](https://www.wch.cn/downloads/CH32V307EVT_ZIP.html) |
| jetson-orin-nano-super · Jetson Orin Nano Super Developer Kit | Jetson Orin Nano 模组 / 依性能模式 | microSD / NVMe / 按套件规格 | 3.3 V | reference | [厂商/设计者](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/nano-super-developer-kit/) |
| maixcam · Sipeed MaixCAM | SOPHGO SG2002 / 主核 1 GHz，依配置 | TF / SD NAND / 256 MB DDR3 | 3.3 V | reference | [厂商/设计者](https://wiki.sipeed.com/hardware/en/maixcam/maixcam.html) |
| licheerv-nano · Sipeed LicheeRV Nano | SOPHGO SG2002 / 1 GHz / 700 MHz | TF / SD NAND / 256 MB DDR3 | 3.3 V | reference | [厂商/设计者](https://wiki.sipeed.com/licheerv-nano) |

## 元件和模块覆盖

| 分类 | 数量 |
| --- | ---: |
| 基础与连接 | 11 |
| 显示与声音 | 9 |
| 输入与控制 | 4 |
| 模拟与逻辑 | 9 |
| 环境传感 | 10 |
| 运动与测距 | 9 |
| 测量与转换 | 4 |
| 驱动与执行 | 8 |
| 电源与接口 | 4 |
| 存储与通信 | 4 |

| ID / 器件 | 分类 | 供电与电平提示 | modelType | 原始来源 |
| --- | --- | --- | --- | --- |
| led · LED 发光二极管 | 基础与连接 | 按颜色和型号核对正向压降；须串联限流电阻 | led | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-2-leds/overview) |
| rgbled · RGB 三色 LED · 共阴极 | 显示与声音 | 每个颜色分别限流，COM 接 GND | rgbled | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-3-rgb-leds/overview) |
| resistor · 电阻 · 可改阻值 | 基础与连接 | 无固定供电；检查功率 P=I²R | resistor | [一手资料](https://learn.sparkfun.com/tutorials/resistors/all) |
| pot · 旋钮电位器 | 基础与连接 | 两端接开发板允许的模拟参考电源与 GND | pot | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-8-analog-inputs/overview) |
| button · 四脚轻触按键 | 基础与连接 | 干接点；用上拉或下拉确定默认电平 | button | [一手资料](https://learn.sparkfun.com/tutorials/button-and-switch-basics) |
| switch · 拨动开关 · SPST | 基础与连接 | 按实物触点电压、电流额定值选用 | switch | [一手资料](https://learn.sparkfun.com/tutorials/button-and-switch-basics) |
| diode · 硅二极管 · 教学模型 | 基础与连接 | 默认正向压降约 0.7V，仅为教学近似 | diode | [一手资料](https://learn.sparkfun.com/tutorials/diodes/all) |
| schottky · 肖特基二极管 · 教学模型 | 基础与连接 | 本例压降 0.3V 是可修改近似 | diode | [一手资料](https://learn.sparkfun.com/tutorials/diodes/all) |
| capacitor · 电解电容 · 可改容量 | 基础与连接 | 额定耐压必须高于实际工作电压 | capacitor | [一手资料](https://learn.sparkfun.com/tutorials/capacitors/all) |
| ceramic-cap · 陶瓷去耦电容 | 基础与连接 | 按所选容量、封装、介质与耐压核对 | reference | [一手资料](https://learn.sparkfun.com/tutorials/capacitors/all) |
| breadboard · 无焊面包板 | 基础与连接 | 不用于大电流或高压线路 | reference | [一手资料](https://learn.adafruit.com/breadboards-for-beginners/breadboards) |
| jumper-wire · 杜邦线与跳线 | 基础与连接 | 按线径、长度与接头接触条件使用 | reference | [一手资料](https://learn.adafruit.com/breadboards-for-beginners/breadboards) |
| keypad4x4 · 4×4 矩阵键盘 | 输入与控制 | 无固定供电；按 MCU GPIO 电平扫描 | reference | [一手资料](https://learn.adafruit.com/matrix-keypad?view=all) |
| qt-encoder · Adafruit I²C 旋转编码器 | 输入与控制 | 该转换板支持 3–5V；默认 I²C 地址 0x36 | reference | [一手资料](https://learn.adafruit.com/adafruit-i2c-qt-rotary-encoder/pinouts) |
| joystick · 双轴模拟摇杆 | 输入与控制 | 用不超过 ADC 允许范围的电源供电 | reference | [一手资料](https://www.adafruit.com/product/512) |
| magnetic-switch · Grove 磁簧开关模块 | 输入与控制 | 该 Grove 板工作电压 3.3–5.25V | reference | [一手资料](https://wiki.seeedstudio.com/Grove-Magnetic_Switch/) |
| npn · PN2222 NPN 三极管 | 模拟与逻辑 | 基极限流，负载电源按器件与负载额定值选择 | reference | [一手资料](https://www.adafruit.com/product/756) |
| nmos · N 沟道功率 MOSFET | 模拟与逻辑 | 核对 VGS、VDS 和在实际 VGS 下的导通电阻 | reference | [一手资料](https://www.adafruit.com/product/355?gQT=1) |
| lm358 · LM358 双运算放大器 | 模拟与逻辑 | 经典 LM358 单电源 3–30V；按具体后缀核对 | reference | [一手资料](https://www.ti.com/product/LM358) |
| lm393 · LM393 双电压比较器 | 模拟与逻辑 | 按具体版本手册；经典器件支持宽供电范围 | reference | [一手资料](https://www.ti.com/product/LM393) |
| ne555 · NE555 定时器 | 模拟与逻辑 | 按 NE555 具体手册；不要套用 CMOS 555 的最低供电 | reference | [一手资料](https://www.ti.com/product/NE555) |
| hc595 · 74HC595 串入并出移位寄存器 | 模拟与逻辑 | HC 系列电压范围与输入阈值见手册 | reference | [一手资料](https://www.ti.com/product/SN74HC595) |
| hc165 · 74HC165 并入串出移位寄存器 | 模拟与逻辑 | 按 HC 系列供电和输入阈值核对 | reference | [一手资料](https://www.ti.com/product/SN74HC165) |
| hc14 · 74HC14 施密特触发反相器 | 模拟与逻辑 | TI SN74HC14 工作电源 2–6V | reference | [一手资料](https://www.ti.com/product/SN74HC14) |
| bss138-level · BSS138 四路双向电平转换板 | 模拟与逻辑 | 该 Adafruit 板低侧可至 1.8V，高侧可至 10V | reference | [一手资料](https://www.adafruit.com/product/757?gQT=1) |
| ldr · 光敏电阻 LDR | 环境传感 | 无固定供电；用分压保证 ADC 电压范围 | ldr | [一手资料](https://learn.adafruit.com/photocells/overview) |
| thermistor · NTC 热敏电阻 | 环境传感 | 按分压电路与自热功耗设计 | thermistor | [一手资料](https://learn.adafruit.com/thermistor/overview) |
| dht22 · DHT22 / AM2302 温湿度模块 | 环境传感 | 按所购模块手册；确认 DATA 上拉电源 | reference | [一手资料](https://learn.adafruit.com/dht/overview) |
| ds18b20 · DS18B20 数字温度传感器 | 环境传感 | 按 DS18B20 手册；DQ 需正确上拉 | reference | [一手资料](https://www.analog.com/en/products/ds18b20.html) |
| sht31 · Adafruit SHT31-D 温湿度板 | 环境传感 | 按该转换板 Pinouts 的 VIN 与逻辑限制 | reference | [一手资料](https://learn.adafruit.com/adafruit-sht31-d-temperature-and-humidity-sensor-breakout/pinouts) |
| bme280 · Adafruit BME280 三合一环境板 | 环境传感 | 该 Adafruit 转换板支持 3V/5V 电源与逻辑 | reference | [一手资料](https://learn.adafruit.com/adafruit-bme280-humidity-barometric-pressure-temperature-sensor-breakout/overview) |
| bmp280 · Adafruit BMP280 温度气压板 | 环境传感 | 以该转换板 Pinouts 为准 | reference | [一手资料](https://learn.adafruit.com/adafruit-bmp280-barometric-pressure-plus-temperature-sensor-breakout/pinouts) |
| bh1750 · Adafruit BH1750 光照板 | 环境传感 | 以该转换板电源和逻辑范围为准 | reference | [一手资料](https://learn.adafruit.com/adafruit-bh1750-ambient-light-sensor/pinouts) |
| tsl2591 · Adafruit TSL2591 光照板 | 环境传感 | 以该转换板 Pinouts 为准 | reference | [一手资料](https://learn.adafruit.com/adafruit-tsl2591/pinouts) |
| mpu6050 · Adafruit MPU6050 六轴运动板 | 运动与测距 | 该 Adafruit 板 VIN 与 I²C 逻辑支持 3–5V | reference | [一手资料](https://learn.adafruit.com/mpu6050-6-dof-accelerometer-and-gyro?view=all) |
| adxl345 · Adafruit ADXL345 加速度板 | 运动与测距 | 该 Adafruit 板带稳压和电平转换，支持 3V/5V 系统 | reference | [一手资料](https://learn.adafruit.com/adxl345-digital-accelerometer/overview) |
| lis3dh · Adafruit LIS3DH 加速度板 | 运动与测距 | 按该模块电源与逻辑说明接线 | reference | [一手资料](https://learn.adafruit.com/adafruit-lis3dh-triple-axis-accelerometer-breakout/overview) |
| bno055 · Adafruit BNO055 姿态融合板 | 运动与测距 | 按该 Adafruit 模块 Pinouts 接线 | reference | [一手资料](https://learn.adafruit.com/adafruit-bno055-absolute-orientation-sensor/overview) |
| vl53l0x · Adafruit VL53L0X ToF 测距板 | 运动与测距 | 按该转换板 Pinouts 接线 | reference | [一手资料](https://learn.adafruit.com/adafruit-vl53l0x-micro-lidar-distance-sensor-breakout/overview) |
| grove-ultrasonic · Grove 超声波测距模块 | 运动与测距 | V2 支持 3.3V 系统；按实物修订版核对 | reference | [一手资料](https://wiki.seeedstudio.com/Grove-Ultrasonic_Ranger/) |
| pir · PIR 人体移动感应模块 | 运动与测距 | 按实际模块电源与 OUT 电平核对 | reference | [一手资料](https://learn.adafruit.com/pir-passive-infrared-proximity-motion-sensor/overview) |
| fsr · FSR 薄膜压力传感器 | 运动与测距 | 用分压读取，不直接施加大电流 | reference | [一手资料](https://learn.adafruit.com/force-sensitive-resistor-fsr/overview) |
| hx711 · HX711 称重放大器板 | 运动与测距 | SparkFun 板的模拟 VCC 与数字 VDD 可分开；其他板需核对 | reference | [一手资料](https://learn.sparkfun.com/tutorials/load-cell-amplifier-hx711-breakout-hookup-guide) |
| ina219 · Adafruit INA219 电流电压板 | 测量与转换 | 逻辑供电与被测母线范围分别按模块手册核对 | reference | [一手资料](https://learn.adafruit.com/adafruit-ina219-current-sensor-breakout/overview) |
| max4466 · MAX4466 模拟麦克风放大板 | 测量与转换 | 按该板供电范围；OUT 不能超过 ADC 范围 | reference | [一手资料](https://learn.adafruit.com/adafruit-microphone-amplifier-breakout/overview) |
| soil-cap · DFRobot SEN0193 电容土壤湿度板 | 环境传感 | 供电 3.3–5.5V；模拟输出约 0–3.0V | reference | [一手资料](https://wiki.dfrobot.com/sen0193/) |
| ssd1306 · SSD1306 单色 OLED 模块 | 显示与声音 | 电源和引脚取决于具体模块，不按尺寸猜电压 | reference | [一手资料](https://learn.adafruit.com/monochrome-oled-breakouts/overview) |
| lcd1602 · LCD1602 字符液晶 | 显示与声音 | 按具体显示器与背光规格供电 | reference | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-11-lcd-displays-1/overview) |
| st7789 · Adafruit 1.14寸 TFT 彩屏 | 显示与声音 | 该 Adafruit 转换板支持 3.3V/5V 电源与逻辑 | reference | [一手资料](https://learn.adafruit.com/adafruit-1-14-240x135-color-tft-breakout/overview) |
| sevenseg · 单个七段数码管 · 共阴极 | 显示与声音 | 每段独立串联限流电阻；默认共阴极 | sevenseg | [一手资料](https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf) |
| tm1637 · Grove TM1637 四位数码管 | 显示与声音 | 该 Grove 模块支持 3.3V/5V 系统 | reference | [一手资料](https://wiki.seeedstudio.com/Grove-4-Digit_Display/) |
| neopixel · WS2812 / NeoPixel 可寻址灯 | 显示与声音 | 按灯的具体型号与供电电压核对数据高电平阈值 | reference | [一手资料](https://learn.adafruit.com/adafruit-neopixel-uberguide/the-magic-of-neopixels) |
| buzzer · 有源蜂鸣器 · 教学模型 | 显示与声音 | 参考有源模块支持 3–5V；模型为简化等效负载 | buzzer | [一手资料](https://learn.adafruit.com/products/1536/guides) |
| piezo · 无源压电蜂鸣片 | 显示与声音 | 按具体压电片的峰峰值要求驱动 | reference | [一手资料](https://learn.adafruit.com/using-piezo-buzzers-with-circuitpython-arduino/hardware) |
| servo · 位置舵机 · 教学模型 | 驱动与执行 | 供电按所购舵机规格；信号与电源必须共地 | servo | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-14-servo-motors/overview) |
| motor · 直流有刷电机 · 教学模型 | 驱动与执行 | 按真实电机额定电压和堵转电流选择驱动 | motor | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-13-dc-motors/overview) |
| stepper · 小型减速步进电机 | 驱动与执行 | 供电与相电流按电机规格；需驱动器 | reference | [一手资料](https://learn.adafruit.com/adafruit-arduino-lesson-16-stepper-motors/overview) |
| relay · Grove 继电器模块 | 驱动与执行 | 按所购 Grove 版本和触点标识核对 | reference | [一手资料](https://wiki.seeedstudio.com/Grove-Relay/) |
| uln2003 · ULN2003A 七路达林顿驱动 | 驱动与执行 | 逻辑与负载按 TI 手册；COM 用于续流钳位 | reference | [一手资料](https://www.ti.com/product/ULN2003A) |
| drv8833 · DRV8833 双 H 桥驱动 | 驱动与执行 | 芯片工作电源 2.7–10.8V；按模块散热能力确定电流 | reference | [一手资料](https://www.ti.com/product/DRV8833) |
| tb6612 · Adafruit TB6612 双 H 桥板 | 驱动与执行 | 该板逻辑 2.7–5V，电机电源 4.5–13.5V | reference | [一手资料](https://learn.adafruit.com/adafruit-tb6612-h-bridge-dc-stepper-motor-driver-breakout/overview) |
| a4988 · Pololu A4988 步进驱动板 | 驱动与执行 | 电机电源 8–35V；逻辑 3–5.5V | reference | [一手资料](https://www.pololu.com/product/1182/specs?coupon=LD26C120) |
| power · 直流电源 · 教学模型 | 电源与接口 | 默认 5V，可按实验需要调整 | power | [一手资料](https://learn.adafruit.com/breadboards-for-beginners/breadboards) |
| lm2596 · LM2596 降压转换器参考 | 电源与接口 | 芯片系列输入 4.5–40V；实际模块额定范围可能更窄 | reference | [一手资料](https://www.ti.com/product/LM2596) |
| ads1115 · Adafruit ADS1115 16位 ADC 板 | 测量与转换 | 器件供电 2.0–5.5V；输入仍必须满足供电边界 | reference | [一手资料](https://learn.adafruit.com/adafruit-4-channel-adc-breakouts/overview) |
| mcp4725 · MCP4725 12位 DAC 板 | 测量与转换 | 参考板支持 3.3V/5V；输出范围由 VDD 决定 | reference | [一手资料](https://learn.adafruit.com/mcp4725-12-bit-dac-tutorial/overview) |
| ds3231 · DS3231 实时时钟 | 存储与通信 | 按芯片和具体模块的主电源、后备电池要求核对 | reference | [一手资料](https://www.analog.com/en/products/ds3231.html) |
| microsd · Adafruit microSD SPI / SDIO 板 | 存储与通信 | 该板只支持 3.3V 电源与逻辑，无 5V 转换 | reference | [一手资料](https://learn.adafruit.com/adafruit-microsd-spi-sdio/overview) |
| sn65hvd230 · SN65HVD230 CAN 收发器 | 存储与通信 | 芯片工作电源 3.0–3.6V | reference | [一手资料](https://www.ti.com/product/SN65HVD230) |
| max485 · MAX485 RS-485 收发器 | 存储与通信 | MAX485 使用 5V；3.3V MCU 需核对接收输出兼容性 | reference | [一手资料](https://www.analog.com/en/products/max485.html) |
| cp2102 · CP2102 USB 转 UART 参考 | 电源与接口 | CP2102 逻辑与模块供电输出分别核对 | reference | [一手资料](https://www.silabs.com/interface/usb-bridges/classic/device.cp2102) |
| stlink · ST-LINK/V2 调试下载器 | 电源与接口 | 目标参考电压与接线按官方手册 | reference | [一手资料](https://www.st.com/en/development-tools/st-link-v2.html) |

## 新增学习资料索引

所有以下条目状态均为 link_only，保留在线原文或作者配套入口。阅读提示与学习阶段在 catalog-data.js 的 EXTRA_RESOURCES 中保存。

| 资料 | 来源类别 | 语言 | 学习阶段 | 入口 |
| --- | --- | --- | --- | --- |
| STM32CubeMX：中文官方入口 | ST官方中文 | 中文 | 认识开发工具 | [原文](https://www.st.com.cn/zh/development-tools/stm32cubemx.html) |
| STM32CubeIDE：中文官方入口 | ST官方中文 | 中文 | 建立第一个工程 | [原文](https://www.st.com.cn/zh/development-tools/stm32cubeide.html) |
| STM32CubeProgrammer：中文官方入口 | ST官方中文 | 中文 | 把程序烧录到板上 | [原文](https://www.st.com.cn/zh/development-tools/stm32cubeprog.html) |
| ST：STM32 分步入门教程 | 官方英文教程 | 英文 | 从点灯开始 | [原文](https://wiki.st.com/stm32mcu/wiki/STM32StepByStep%3ASTM32_step_by_step_overview) |
| UM1724：Nucleo-64 MB1136 用户手册 | 官方英文手册 | 英文 | 认识真实板子 | [原文](https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf) |
| ESP-IDF 快速入门（中文） | 官方中文教程 | 中文 | 第一次使用 ESP32 | [原文](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32/get-started/index.html) |
| ESP-IDF Get Started（英文对照） | 官方英文教程 | 英文 | 查阅原文与版本 | [原文](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/index.html) |
| Arduino-ESP32 Core 官方文档 | 官方英文教程 | 英文 | 从 Arduino 转向 ESP32 | [原文](https://docs.espressif.com/projects/arduino-esp32/en/latest/) |
| ESP32-DevKitC V4 用户指南 | 官方英文手册 | 英文 | 接线前查引脚 | [原文](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) |
| Arduino 语言参考 | 官方英文手册 | 英文 | 写代码时查 API | [原文](https://docs.arduino.cc/language-reference/) |
| Arduino IDE 官方使用指南 | 官方英文教程 | 英文 | 本地 IDE 入门 | [原文](https://docs.arduino.cc/software/ide/) |
| Raspberry Pi Pico C/C++ SDK 官方入口 | 官方英文教程 | 英文 | Pico 的 C/C++ 开发 | [原文](https://www.raspberrypi.com/documentation/microcontrollers/c_sdk.html) |
| Pico MicroPython 安装与起步 | 官方英文教程 | 英文 | 用 Python 点亮第一盏灯 | [原文](https://www.raspberrypi.com/documentation/microcontrollers/micropython.html) |
| MicroPython RP2 快速参考 | 官方英文手册 | 英文 | Python 外设编程 | [原文](https://docs.micropython.org/en/latest/rp2/quickref.html) |
| micro:bit 官方入门路线 | 官方英文教程 | 英文 | 零基础认识开发板 | [原文](https://microbit.org/get-started/getting-started/introduction/) |
| Teensyduino 安装与 Arduino 配置 | 官方英文教程 | 英文 | 开始使用 Teensy | [原文](https://www.pjrc.com/teensy/td_download.html) |
| Nordic：nRF Connect SDK Fundamentals | 官方英文课程 | 英文 | Nordic 开发入门 | [原文](https://academy.nordicsemi.com/courses/nrf-connect-sdk-fundamentals/) |
| Nordic：Bluetooth LE Fundamentals | 官方英文课程 | 英文 | 蓝牙项目进阶 | [原文](https://academy.nordicsemi.com/courses/bluetooth-low-energy-fundamentals/) |
| NXP FRDM-MCXN947 SDK 板级指南 | 官方英文手册 | 英文 | NXP 本地工具链 | [原文](https://mcuxpresso.nxp.com/mcuxsdk/latest/boards/MCX/frdmmcxn947/index.html) |
| TI CCStudio 开发生态入口 | 官方英文教程 | 英文 | TI LaunchPad 入门 | [原文](https://www.ti.com/design-development/ccstudio-development-ecosystem.html) |
| WCH：CH32V003 官方 EVT 配套包入口 | 官方中文配套 | 中文 | CH32V003 起步 | [原文](https://www.wch.cn/downloads/CH32V003EVT_ZIP.html) |
| WCH：CH32V307 官方 EVT 配套包入口 | 官方中文配套 | 中文 | CH32 系列进阶 | [原文](https://www.wch.cn/downloads/CH32V307EVT_ZIP.html) |
| 野火：STM32F103 HAL 库开发实战指南 | 作者官方教程 | 中文 | 从点灯到外设 | [原文](https://doc.embedfire.com/mcu/stm32/f103/hal_general/zh/latest/index.html) |
| 野火：标准库实战指南与配套入口 | 作者官方配套 | 中文 | 跟随标准外设库课程 | [原文](https://doc.embedfire.com/products/link/zh/latest/tutorial/ebf_stm32_stdlib_tutorial.html) |
| 野火官方产品资料中心 | 作者官方配套 | 中文 | 查找自己板子的资料 | [原文](https://doc.embedfire.com/products/link/zh/latest/index.html) |
| 正点原子官方资料下载中心 | 作者官方配套 | 中文 | 寻找对应开发板配套 | [原文](https://www.openedv.com/docs/build/html/index.html) |
| 正点原子：F103 战舰 V4 配套入口 | 作者官方配套 | 中文 | 配合真实实验板 | [原文](https://www.openedv.com/docs/boards/stm32/zdyz_stm32f103_warshipV4.html) |
| 正点原子：《原子教你玩 STM32》系列 | 作者官方课程 | 中文 | 换一种讲法补概念 | [原文](https://www.openedv.com/docs/book-videos/zdyz_stm32_stdlib_book.html) |
| DFRobot：Arduino 中文入门教程 | 厂商中文教程 | 中文 | 零基础 Arduino | [原文](https://wiki.dfrobot.com.cn/arduino%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B) |
| DFRobot Arduino 学习资源中心 | 厂商中文教程 | 中文 | 从基础实验到小项目 | [原文](https://mc.dfrobot.com.cn/featured/arduino) |
| 江协科技：课程与配套总索引 | 作者官方课程 | 中文 | 基础完成后的学习路线 | [原文](https://jiangxiekeji.com/) |
| Seeed XIAO ESP32C3 入门 | 厂商英文教程 | 英文 | 小型无线板入门 | [原文](https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/) |
| Seeed XIAO ESP32S3 / Sense 入门 | 厂商英文教程 | 英文 | 摄像头与声音项目 | [原文](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/) |
| Sipeed MaixCAM 官方硬件文档 | 厂商英文手册 | 英文 | 端侧视觉硬件选型 | [原文](https://wiki.sipeed.com/hardware/en/maixcam/maixcam.html) |
| Sipeed LicheeRV Nano 官方文档 | 厂商英文手册 | 英文 | Linux 与 RISC-V 进阶 | [原文](https://wiki.sipeed.com/licheerv-nano) |
| PlatformIO 官方概念与入门 | 官方英文教程 | 英文 | 把实验转到本地工程 | [原文](https://docs.platformio.org/en/latest/what-is-platformio.html) |
| Zephyr 官方 Getting Started | 官方英文教程 | 英文 | RTOS 与多板项目进阶 | [原文](https://docs.zephyrproject.org/latest/develop/getting_started/index.html) |
| Adafruit：面包板从零开始 | 厂商英文教程 | 英文 | 第一次接线 | [原文](https://learn.adafruit.com/breadboards-for-beginners/breadboards) |
| Adafruit：Arduino Lesson 2 · LED | 厂商英文教程 | 英文 | 第一个可观察现象 | [原文](https://learn.adafruit.com/adafruit-arduino-lesson-2-leds/overview) |
| Adafruit：Arduino Lesson 3 · RGB | 厂商英文教程 | 英文 | 从亮灭到调光 | [原文](https://learn.adafruit.com/adafruit-arduino-lesson-3-rgb-leds/overview) |
| Adafruit：无源蜂鸣片与音调 | 厂商英文教程 | 英文 | 理解 PWM 与频率 | [原文](https://learn.adafruit.com/using-piezo-buzzers-with-circuitpython-arduino/overview) |
| SparkFun：电阻基础 | 厂商英文教程 | 英文 | 理解电流和限流 | [原文](https://learn.sparkfun.com/tutorials/resistors/all) |
| SparkFun：电容基础 | 厂商英文教程 | 英文 | 理解电压随时间变化 | [原文](https://learn.sparkfun.com/tutorials/capacitors/all) |
| SparkFun：二极管基础 | 厂商英文教程 | 英文 | 理解极性与单向导通 | [原文](https://learn.sparkfun.com/tutorials/diodes/all) |
| SparkFun：按钮与开关基础 | 厂商英文教程 | 英文 | 第一次读取输入 | [原文](https://learn.sparkfun.com/tutorials/button-and-switch-basics) |

## 数据检查

已执行 ES module 导入与结构检查：3 个数组均可解析；各数组 ID 唯一；每条均有原始来源和核验日期；9 个 board profileId 与约定一致；新增资料与原 20 条无重复 ID、无重复 URL。资源链接是否能在用户网络打开、厂家账号登录与附件许可，仍由目标站点决定；本次没有把网页可检索误记成附件已下载。
