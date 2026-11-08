/* Curated hardware reference catalogue. Hardware presence is not simulator support.
 * Sources checked 2026-11-06; variant-specific limits remain in each record.
 * Runtime capability badges are derived from BOARD_PROFILES and PARTS, never catalogue count.
 */
import { BOARD_PROFILES } from './board-profiles.js';

export const CATALOG_CHECKED_ON = "2026-11-06";
export const BOARD_CATALOG = [
  {
    "id": "bluepill",
    "name": "STM32F103C8T6 · Blue Pill",
    "brand": "通用板型 / ST 芯片",
    "family": "STM32",
    "chip": "STM32F103C8T6",
    "cpu": "Arm Cortex-M3",
    "clock": "最高 72 MHz",
    "flash": "64 KB",
    "ram": "20 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "USART",
      "I²C",
      "SPI",
      "SWD"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "通用板型 / ST 芯片",
      "STM32F103C8T6",
      "GPIO",
      "ADC",
      "PWM",
      "USART",
      "I²C",
      "SPI",
      "SWD",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "入门",
    "description": "你当前使用的小系统板，适合标准外设库和基础外设练习。",
    "bestFor": "点灯、按键、定时器、采样、串口",
    "warning": "Blue Pill 是通用板型，不是 ST 官方开发板；不同厂家丝印、晶振与 USB 电路可能不同。",
    "source": "https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32f103c8.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "bluepill",
    "style": "bluepill",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-f103rb",
    "name": "NUCLEO-F103RB",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32F103RBT6",
    "cpu": "Arm Cortex-M3",
    "clock": "72 MHz",
    "flash": "128 KB",
    "ram": "20 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32F103RBT6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "入门",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "标准外设库迁移、板载调试器入门",
    "warning": "与 C8 的容量和引脚封装不同，勿直接照抄全部接线。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-f103rb.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-f103rb.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32f103rb.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "nucleo-f103rb",
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-f401re",
    "name": "NUCLEO-F401RE",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32F401RET6",
    "cpu": "Arm Cortex-M4F",
    "clock": "84 MHz",
    "flash": "512 KB",
    "ram": "96 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32F401RET6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "入门",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "带 FPU 的 STM32 入门与信号处理",
    "warning": "F4 时钟与 GPIO 配置不能直接套用 F1 标准库。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-f401re.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-f401re.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32f401re.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "nucleo-f401re",
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-f411re",
    "name": "NUCLEO-F411RE",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32F411RET6",
    "cpu": "Arm Cortex-M4F",
    "clock": "100 MHz",
    "flash": "512 KB",
    "ram": "128 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32F411RET6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "DSP、采样与嵌入式软件进阶",
    "warning": "资料型条目；未实现本芯片全部外设。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-f411re.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-f411re.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32f411re.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-f446re",
    "name": "NUCLEO-F446RE",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32F446RET6",
    "cpu": "Arm Cortex-M4F",
    "clock": "180 MHz",
    "flash": "512 KB",
    "ram": "128 KB + 4 KB 备份 SRAM",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32F446RET6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "较高采样需求、控制与音频实验",
    "warning": "芯片外设能力不等于排针全部可用；查复用表。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-f446re.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-f446re.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32f446re.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-l476rg",
    "name": "NUCLEO-L476RG",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32L476RGT6",
    "cpu": "Arm Cortex-M4F",
    "clock": "80 MHz",
    "flash": "1 MB",
    "ram": "128 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32L476RGT6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "电池设备、低功耗与传感器节点",
    "warning": "低功耗数值受电源、调试器和外设配置影响。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-l476rg.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-l476rg.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32l476rg.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-g071rb",
    "name": "NUCLEO-G071RB",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32G071RBT6",
    "cpu": "Arm Cortex-M0+",
    "clock": "64 MHz",
    "flash": "128 KB",
    "ram": "36 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32G071RBT6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "成本敏感控制、ADC 与比较器入门",
    "warning": "USB Type-C PD 控制器不等同于 USB 数据接口。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-g071rb.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-g071rb.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32g071rb.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-h743zi",
    "name": "NUCLEO-H743ZI / ZI2 系列",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32H743ZIT6",
    "cpu": "Arm Cortex-M7",
    "clock": "最高 480 MHz，依芯片修订与配置",
    "flash": "2 MB",
    "ram": "约 1 MB，分区见手册",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32H743ZIT6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "较复杂信号处理、网络与外部存储",
    "warning": "ZI 与 ZI2 的板号/调试器不同；采购和接线先核对 PCB 修订。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-h743zi.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-h743zi.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32h743zi.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-u575zi-q",
    "name": "NUCLEO-U575ZI-Q",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32U575ZIT6Q",
    "cpu": "Arm Cortex-M33",
    "clock": "160 MHz",
    "flash": "2 MB",
    "ram": "786 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32U575ZIT6Q",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "低功耗、TrustZone 与安全功能学习",
    "warning": "安全分区和 SMPS 供电需使用对应官方工程。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-u575zi-q.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-u575zi-q.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32u575zi.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nucleo-h563zi",
    "name": "NUCLEO-H563ZI",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32H563ZIT6",
    "cpu": "Arm Cortex-M33",
    "clock": "250 MHz",
    "flash": "2 MB",
    "ram": "640 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32H563ZIT6",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "SWD",
      "板载调试器",
      "I2C",
      "意法半导体"
    ],
    "difficulty": "进阶",
    "description": "ST Nucleo 开发板，提供扩展排针与官方示例入口。",
    "bestFor": "高性能控制、联网与安全固件",
    "warning": "外设、启动安全与调试认证没有在本实验室仿真。",
    "source": "https://www.st.com/en/evaluation-tools/nucleo-h563zi.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/nucleo-h563zi.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32h563zi.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "stm32f746g-disco",
    "name": "STM32F746G-DISCO",
    "brand": "STMicroelectronics",
    "family": "STM32",
    "chip": "STM32F746NGH6",
    "cpu": "Arm Cortex-M7",
    "clock": "216 MHz",
    "flash": "1 MB 芯片内置；外部存储见板卡手册",
    "ram": "320 KB + 16 KB ITCM + 4 KB 备份 SRAM；外部 SDRAM 另计",
    "logicVoltage": 3.3,
    "interfaces": [
      "LCD",
      "音频",
      "Ethernet",
      "USB",
      "SDMMC",
      "GPIO",
      "SWD"
    ],
    "category": "MCU开发板",
    "tags": [
      "STM32",
      "STMicroelectronics",
      "STM32F746NGH6",
      "LCD",
      "音频",
      "Ethernet",
      "USB",
      "SDMMC",
      "GPIO",
      "SWD",
      "意法半导体"
    ],
    "difficulty": "专业",
    "description": "带显示与多媒体接口的 Discovery 套件。",
    "bestFor": "图形界面、音频、较复杂嵌入式应用",
    "warning": "板载屏幕与音频硬件属于参考资料范围，不能当作已模拟外设。",
    "source": "https://www.st.com/en/evaluation-tools/32f746gdiscovery.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.st.com/en/evaluation-tools/32f746gdiscovery.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.st.com/en/microcontrollers-microprocessors/stm32f746ng.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "discovery",
    "checked_on": "2026-11-06"
  },
  {
    "id": "uno-r3",
    "name": "Arduino UNO R3",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "ATmega328P",
    "cpu": "8-bit AVR",
    "clock": "16 MHz",
    "flash": "32 KB（包含引导程序）",
    "ram": "2 KB",
    "logicVoltage": 5,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "MCU开发板",
    "tags": [
      "Arduino",
      "ATmega328P",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "I2C"
    ],
    "difficulty": "入门",
    "description": "经典大板，接口易辨认，适合学习 setup 与 loop。",
    "bestFor": "数字输入输出、模拟采样和基础原型",
    "warning": "5 V GPIO 连接 3.3 V 器件前必须核对输入容限。",
    "source": "https://docs.arduino.cc/hardware/uno-rev3/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/uno-rev3/",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "uno-r3",
    "style": "uno",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nano",
    "name": "Arduino Nano · Classic",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "ATmega328P",
    "cpu": "8-bit AVR",
    "clock": "16 MHz",
    "flash": "32 KB（包含引导程序）",
    "ram": "2 KB",
    "logicVoltage": 5,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "MCU开发板",
    "tags": [
      "Arduino",
      "ATmega328P",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "I2C"
    ],
    "difficulty": "入门",
    "description": "可跨接面包板的小型经典 Nano。",
    "bestFor": "面包板项目、空间受限的小原型",
    "warning": "Nano Every / ESP32 / BLE 都是不同硬件；先核对完整型号。",
    "source": "https://docs.arduino.cc/hardware/nano/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/nano/",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "nano",
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "mega2560",
    "name": "Arduino Mega 2560 Rev3",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "ATmega2560",
    "cpu": "8-bit AVR",
    "clock": "16 MHz",
    "flash": "256 KB（其中 8 KB 引导程序）",
    "ram": "8 KB",
    "logicVoltage": 5,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "4×UART",
      "I²C",
      "SPI"
    ],
    "category": "MCU开发板",
    "tags": [
      "Arduino",
      "ATmega2560",
      "GPIO",
      "ADC",
      "PWM",
      "4×UART",
      "I²C",
      "SPI",
      "I2C"
    ],
    "difficulty": "入门",
    "description": "54 个数字引脚、16 个模拟输入，适合多输入输出项目。",
    "bestFor": "多串口、较多按钮和显示器",
    "warning": "I/O 数量增多不代表单脚能直接驱动电机或大电流负载。",
    "source": "https://docs.arduino.cc/hardware/mega-2560/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/mega-2560/",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "mega2560",
    "style": "mega",
    "checked_on": "2026-11-06"
  },
  {
    "id": "uno-r4-minima",
    "name": "Arduino UNO R4 Minima",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "Renesas RA4M1",
    "cpu": "Arm Cortex-M4",
    "clock": "48 MHz",
    "flash": "256 KB",
    "ram": "32 KB",
    "logicVoltage": 5,
    "interfaces": [
      "GPIO",
      "ADC",
      "DAC",
      "RTC",
      "CAN",
      "USB"
    ],
    "category": "MCU开发板",
    "tags": [
      "Arduino",
      "Renesas RA4M1",
      "GPIO",
      "ADC",
      "DAC",
      "RTC",
      "CAN",
      "USB",
      "RenesasRA4M1"
    ],
    "difficulty": "入门",
    "description": "UNO 外形的 32 位开发板，提供 DAC 和 RTC 等功能。",
    "bestFor": "从经典 Arduino 过渡到 32 位 MCU",
    "warning": "CAN 需要外接收发器；AVR 寄存器代码不能直接移植。",
    "source": "https://docs.arduino.cc/hardware/uno-r4-minima/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/uno-r4-minima/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "uno",
    "checked_on": "2026-11-06"
  },
  {
    "id": "uno-r4-wifi",
    "name": "Arduino UNO R4 WiFi",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "RA4M1 + ESP32-S3",
    "cpu": "Arm Cortex-M4 + 无线协处理器",
    "clock": "主 MCU 48 MHz",
    "flash": "主 MCU 256 KB",
    "ram": "主 MCU 32 KB",
    "logicVoltage": 5,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "LED矩阵",
      "GPIO",
      "ADC",
      "DAC",
      "USB"
    ],
    "category": "无线开发板",
    "tags": [
      "Arduino",
      "RA4M1 + ESP32-S3",
      "Wi-Fi",
      "BLE",
      "LED矩阵",
      "GPIO",
      "ADC",
      "DAC",
      "USB",
      "RA4M1ESP32S3"
    ],
    "difficulty": "入门",
    "description": "在 R4 主控之外增加无线连接与 12×8 LED 点阵。",
    "bestFor": "联网原型与可视交互",
    "warning": "主控与无线模块不是同一个处理器，电平与可编程入口需分别核对。",
    "source": "https://docs.arduino.cc/hardware/uno-r4-wifi/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/uno-r4-wifi/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "uno",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nano-every",
    "name": "Arduino Nano Every",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "ATmega4809",
    "cpu": "8-bit AVR",
    "clock": "芯片最高 20 MHz；按核心配置核对",
    "flash": "48 KB",
    "ram": "6 KB",
    "logicVoltage": 5,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "MCU开发板",
    "tags": [
      "Arduino",
      "ATmega4809",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "I2C"
    ],
    "difficulty": "入门",
    "description": "经典 Nano 引脚形态的后续型号。",
    "bestFor": "紧凑 Arduino 项目、经典 Nano 比较",
    "warning": "同样的排针布局不意味着定时器和寄存器完全兼容。",
    "source": "https://docs.arduino.cc/hardware/nano-every/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/nano-every/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nano-esp32",
    "name": "Arduino Nano ESP32",
    "brand": "Arduino",
    "family": "ESP32",
    "chip": "ESP32-S3 / u-blox NORA-W106",
    "cpu": "Xtensa LX7 双核",
    "clock": "见官方数据手册",
    "flash": "16 MB",
    "ram": "见 NORA-W106 规格",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "USB-C",
      "ADC",
      "GPIO",
      "MicroPython"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Arduino",
      "ESP32-S3 / u-blox NORA-W106",
      "Wi-Fi",
      "BLE",
      "USB-C",
      "ADC",
      "GPIO",
      "MicroPython",
      "乐鑫",
      "无线",
      "ESP32S3ubloxNORAW106"
    ],
    "difficulty": "入门",
    "description": "Nano 尺寸的 ESP32 系列开发板。",
    "bestFor": "无线传感器与 Arduino / MicroPython 对照",
    "warning": "Arduino 引脚编号与 ESP32 GPIO 编号存在映射；不要混用。",
    "source": "https://docs.arduino.cc/hardware/nano-esp32/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/nano-esp32/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nano-33-ble-sense-rev2",
    "name": "Arduino Nano 33 BLE Sense Rev2",
    "brand": "Arduino",
    "family": "Nordic",
    "chip": "nRF52840",
    "cpu": "Arm Cortex-M4F",
    "clock": "64 MHz",
    "flash": "1 MB",
    "ram": "256 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "BLE",
      "IMU",
      "麦克风",
      "温湿度",
      "GPIO",
      "ADC"
    ],
    "category": "无线开发板",
    "tags": [
      "Nordic",
      "Arduino",
      "nRF52840",
      "BLE",
      "IMU",
      "麦克风",
      "温湿度",
      "GPIO",
      "ADC"
    ],
    "difficulty": "进阶",
    "description": "带多种传感器的 Nano，便于 TinyML 和感知实验。",
    "bestFor": "声音、运动、环境感知与小模型部署",
    "warning": "Rev2 的传感器与初版不同，库和示例需匹配版本。",
    "source": "https://docs.arduino.cc/hardware/nano-33-ble-sense-rev2/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/nano-33-ble-sense-rev2/",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.nordicsemi.com/Products/nRF52840",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "arduino-due",
    "name": "Arduino Due",
    "brand": "Arduino",
    "family": "Arduino",
    "chip": "ATSAM3X8E",
    "cpu": "Arm Cortex-M3",
    "clock": "84 MHz",
    "flash": "见官方数据手册",
    "ram": "96 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "DAC",
      "4×UART",
      "I²C",
      "SPI",
      "USB OTG"
    ],
    "category": "MCU开发板",
    "tags": [
      "Arduino",
      "ATSAM3X8E",
      "GPIO",
      "ADC",
      "DAC",
      "4×UART",
      "I²C",
      "SPI",
      "USB OTG",
      "I2C"
    ],
    "difficulty": "进阶",
    "description": "提供较多引脚和双 DAC 的 32 位 Arduino 板。",
    "bestFor": "多路采集、波形输出、外设练习",
    "warning": "GPIO 为 3.3 V，不可因为外形像 Mega 就按 5 V 引脚使用。",
    "source": "https://docs.arduino.cc/hardware/due/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/due/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "mega",
    "checked_on": "2026-11-06"
  },
  {
    "id": "giga-r1-wifi",
    "name": "Arduino GIGA R1 WiFi",
    "brand": "Arduino",
    "family": "STM32",
    "chip": "STM32H747 系列",
    "cpu": "Arm Cortex-M7 + Cortex-M4",
    "clock": "480 / 240 MHz",
    "flash": "见板卡数据手册",
    "ram": "见板卡数据手册",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "GPIO",
      "USB",
      "音频",
      "摄像头接口"
    ],
    "category": "无线开发板",
    "tags": [
      "STM32",
      "Arduino",
      "STM32H747 系列",
      "Wi-Fi",
      "BLE",
      "GPIO",
      "USB",
      "音频",
      "摄像头接口",
      "意法半导体",
      "STM32H747"
    ],
    "difficulty": "专业",
    "description": "双核大尺寸 Arduino 开发板，提供 76 个 GPIO。",
    "bestFor": "图像、音频与较大原型",
    "warning": "两个内核、外部存储与无线链路不在当前行为仿真范围。",
    "source": "https://docs.arduino.cc/hardware/giga-r1-wifi/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/giga-r1-wifi/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "mega",
    "checked_on": "2026-11-06"
  },
  {
    "id": "uno-q",
    "name": "Arduino UNO Q",
    "brand": "Arduino",
    "family": "Linux / AI",
    "chip": "Qualcomm QRB2210 + STM32U585",
    "cpu": "四核 Cortex-A53 + Cortex-M33",
    "clock": "2.0 GHz / MCU 160 MHz",
    "flash": "MCU 2 MB；MPU 存储按 SKU",
    "ram": "MCU 786 KB；Linux RAM 按 SKU",
    "logicVoltage": null,
    "interfaces": [
      "Linux",
      "Wi-Fi",
      "BLE",
      "USB",
      "GPIO",
      "实时MCU"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "Arduino",
      "Qualcomm QRB2210 + STM32U585",
      "Linux",
      "Wi-Fi",
      "BLE",
      "USB",
      "GPIO",
      "实时MCU",
      "QualcommQRB2210STM32U585"
    ],
    "difficulty": "专业",
    "description": "将 Debian Linux 与实时微控制器组合到 UNO 形态。",
    "bestFor": "Linux 应用与实时控制协作",
    "warning": "与 UNO R3/R4 编程模型不同；接口电平与扩展连接必须查 UNO Q 专用手册。",
    "source": "https://docs.arduino.cc/hardware/uno-q/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/uno-q/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "uno",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nano-rp2040-connect",
    "name": "Arduino Nano RP2040 Connect",
    "brand": "Arduino",
    "family": "RP2040 / RP2350",
    "chip": "RP2040 + NINA-W102",
    "cpu": "双核 Arm Cortex-M0+",
    "clock": "133 MHz",
    "flash": "16 MB",
    "ram": "264 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "IMU",
      "麦克风",
      "ADC",
      "PIO"
    ],
    "category": "无线开发板",
    "tags": [
      "RP2040 / RP2350",
      "Arduino",
      "RP2040 + NINA-W102",
      "Wi-Fi",
      "BLE",
      "IMU",
      "麦克风",
      "ADC",
      "PIO",
      "树莓派",
      "RP2040NINAW102"
    ],
    "difficulty": "进阶",
    "description": "把 RP2040、无线模块和传感器组合进 Nano。",
    "bestFor": "TinyML、运动感知、联网小项目",
    "warning": "无线能力来自 NINA 模块；与普通 Pico 的针脚和板载器件不同。",
    "source": "https://docs.arduino.cc/hardware/nano-rp2040-connect/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.arduino.cc/hardware/nano-rp2040-connect/",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://docs.arduino.cc/learn/hardware/nano-pcb-guide/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "esp32-devkitc",
    "name": "ESP32-DevKitC V4",
    "brand": "Espressif",
    "family": "ESP32",
    "chip": "ESP32-WROOM / WROVER，按模块后缀",
    "cpu": "Xtensa LX6",
    "clock": "见对应模块数据手册",
    "flash": "依模块 SKU",
    "ram": "依模块 SKU",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "GPIO",
      "ADC",
      "PWM",
      "I²C",
      "SPI",
      "UART"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Espressif",
      "ESP32-WROOM / WROVER，按模块后缀",
      "Wi-Fi",
      "BLE",
      "GPIO",
      "ADC",
      "PWM",
      "I²C",
      "SPI",
      "UART",
      "I2C",
      "乐鑫",
      "无线",
      "ESP32WROOMWROVER"
    ],
    "difficulty": "入门",
    "description": "乐鑫官方经典 ESP32 开发板，双排针脚便于原型连接。",
    "bestFor": "无线传感器、联网控制",
    "warning": "Flash/PSRAM 会随模块变化；连接前区分启动脚、仅输入脚和 Flash 占用脚。",
    "source": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "esp32-devkitc",
    "style": "esp32",
    "checked_on": "2026-11-06"
  },
  {
    "id": "esp32-c3-devkitm",
    "name": "ESP32-C3-DevKitM-1",
    "brand": "Espressif",
    "family": "ESP32",
    "chip": "ESP32-C3-MINI-1(U)",
    "cpu": "32-bit RISC-V",
    "clock": "见芯片数据手册",
    "flash": "4 MB",
    "ram": "见芯片数据手册",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Espressif",
      "ESP32-C3-MINI-1(U)",
      "Wi-Fi",
      "BLE",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "I2C",
      "乐鑫",
      "无线",
      "ESP32C3MINI1U"
    ],
    "difficulty": "入门",
    "description": "紧凑的 ESP32-C3 官方入门板。",
    "bestFor": "RISC-V、低功耗联网与 GPIO 练习",
    "warning": "板载 RGB LED 是串行可寻址灯；普通 digitalWrite 不等同于发送颜色。",
    "source": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "esp32-c3-devkitm",
    "style": "esp32",
    "checked_on": "2026-11-06"
  },
  {
    "id": "esp32-s3-devkitc",
    "name": "ESP32-S3-DevKitC-1 v1.1",
    "brand": "Espressif",
    "family": "ESP32",
    "chip": "ESP32-S3-WROOM-1/1U/2",
    "cpu": "Xtensa LX7 双核",
    "clock": "见模块数据手册",
    "flash": "依 N 系列 SKU",
    "ram": "SRAM / PSRAM 依 SKU",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "USB",
      "GPIO",
      "ADC",
      "I²S",
      "I²C",
      "SPI"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Espressif",
      "ESP32-S3-WROOM-1/1U/2",
      "Wi-Fi",
      "BLE",
      "USB",
      "GPIO",
      "ADC",
      "I²S",
      "I²C",
      "SPI",
      "I2C",
      "I2S",
      "乐鑫",
      "无线",
      "ESP32S3WROOM11U2"
    ],
    "difficulty": "进阶",
    "description": "带原生 USB 的 S3 开发板，常用于显示、语音和摄像头项目。",
    "bestFor": "语音与视觉原型",
    "warning": "v1.0 与 v1.1 的 RGB LED 引脚不同；模块 Flash/PSRAM 不能按外观猜。",
    "source": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "esp32",
    "checked_on": "2026-11-06"
  },
  {
    "id": "esp32-c6-devkitc",
    "name": "ESP32-C6-DevKitC-1 v1.2",
    "brand": "Espressif",
    "family": "ESP32",
    "chip": "ESP32-C6-WROOM-1(U)",
    "cpu": "32-bit RISC-V",
    "clock": "见芯片数据手册",
    "flash": "8 MB",
    "ram": "见芯片数据手册",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi 6",
      "BLE",
      "Thread",
      "Zigbee",
      "USB",
      "GPIO"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Espressif",
      "ESP32-C6-WROOM-1(U)",
      "Wi-Fi 6",
      "BLE",
      "Thread",
      "Zigbee",
      "USB",
      "GPIO",
      "乐鑫",
      "无线",
      "ESP32C6WROOM1U"
    ],
    "difficulty": "进阶",
    "description": "官方 C6 开发板，覆盖 Wi-Fi 与 802.15.4 网络。",
    "bestFor": "Matter / Thread 等联网协议学习",
    "warning": "协议栈、射频与无线时序目前只提供资料指导。",
    "source": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "esp32",
    "checked_on": "2026-11-06"
  },
  {
    "id": "esp32-h2-devkitm",
    "name": "ESP32-H2-DevKitM-1",
    "brand": "Espressif",
    "family": "ESP32",
    "chip": "ESP32-H2-MINI-1(U)",
    "cpu": "32-bit RISC-V",
    "clock": "见芯片数据手册",
    "flash": "4 MB（N4S）",
    "ram": "见芯片数据手册",
    "logicVoltage": 3.3,
    "interfaces": [
      "BLE",
      "Thread",
      "Zigbee",
      "USB",
      "GPIO"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Espressif",
      "ESP32-H2-MINI-1(U)",
      "BLE",
      "Thread",
      "Zigbee",
      "USB",
      "GPIO",
      "乐鑫",
      "无线",
      "ESP32H2MINI1U"
    ],
    "difficulty": "进阶",
    "description": "面向低功耗 BLE 与 802.15.4 的官方开发板。",
    "bestFor": "Thread / Zigbee 节点",
    "warning": "ESP32 名称不代表都有 Wi-Fi；H2 的无线能力需按专用规格理解。",
    "source": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "esp32",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nodemcu-esp8266",
    "name": "NodeMCU DEVKIT V1.0",
    "brand": "NodeMCU",
    "family": "ESP8266",
    "chip": "ESP-12E / ESP8266",
    "cpu": "Xtensa L106",
    "clock": "按固件配置",
    "flash": "4 MB",
    "ram": "依固件保留区而变",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "GPIO",
      "ADC",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP8266",
      "NodeMCU",
      "ESP-12E / ESP8266",
      "Wi-Fi",
      "GPIO",
      "ADC",
      "UART",
      "I²C",
      "SPI",
      "I2C",
      "乐鑫",
      "无线",
      "ESP12EESP8266"
    ],
    "difficulty": "进阶",
    "description": "公开设计的 ESP8266 开发板，使用 Micro-USB 接口。",
    "bestFor": "了解经典 Wi-Fi 物联网平台",
    "warning": "D0/D1 等板丝印不等于 GPIO0/GPIO1；克隆板 A0 分压与 USB 芯片可能不同。",
    "source": "https://github.com/nodemcu/nodemcu-devkit-v1.0",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://github.com/nodemcu/nodemcu-devkit-v1.0",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "esp32",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pico",
    "name": "Raspberry Pi Pico",
    "brand": "Raspberry Pi",
    "family": "RP2040 / RP2350",
    "chip": "RP2040",
    "cpu": "双核 Cortex-M0+",
    "clock": "133 MHz",
    "flash": "2 MB",
    "ram": "264 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB"
    ],
    "category": "MCU开发板",
    "tags": [
      "RP2040 / RP2350",
      "Raspberry Pi",
      "RP2040",
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB",
      "I2C",
      "树莓派"
    ],
    "difficulty": "入门",
    "description": "可跨面包板的微控制器开发板。",
    "bestFor": "C/C++、MicroPython、PIO 与外设实验",
    "warning": "这是 MCU 板，不运行桌面 Raspberry Pi OS；PIO 与双核时序没有在当前模型中实现。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-pico/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-pico/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": "pico",
    "style": "pico",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pico-w",
    "name": "Raspberry Pi Pico W",
    "brand": "Raspberry Pi",
    "family": "RP2040 / RP2350",
    "chip": "RP2040",
    "cpu": "双核 Cortex-M0+",
    "clock": "133 MHz",
    "flash": "2 MB",
    "ram": "264 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB",
      "Wi-Fi",
      "BLE"
    ],
    "category": "无线开发板",
    "tags": [
      "RP2040 / RP2350",
      "Raspberry Pi",
      "RP2040",
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB",
      "Wi-Fi",
      "BLE",
      "I2C",
      "树莓派"
    ],
    "difficulty": "入门",
    "description": "可跨面包板的微控制器开发板，增加无线连接。",
    "bestFor": "C/C++、MicroPython、PIO 与外设实验",
    "warning": "这是 MCU 板，不运行桌面 Raspberry Pi OS；PIO 与双核时序没有在当前模型中实现。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-pico/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-pico/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "pico",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pico2",
    "name": "Raspberry Pi Pico 2",
    "brand": "Raspberry Pi",
    "family": "RP2040 / RP2350",
    "chip": "RP2350",
    "cpu": "双核 Cortex-M33 或双核 Hazard3 RISC-V",
    "clock": "150 MHz",
    "flash": "4 MB",
    "ram": "520 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB"
    ],
    "category": "MCU开发板",
    "tags": [
      "RP2040 / RP2350",
      "Raspberry Pi",
      "RP2350",
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB",
      "I2C",
      "树莓派"
    ],
    "difficulty": "入门",
    "description": "可跨面包板的微控制器开发板。",
    "bestFor": "C/C++、MicroPython、PIO 与外设实验",
    "warning": "这是 MCU 板，不运行桌面 Raspberry Pi OS；PIO 与双核时序没有在当前模型中实现。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-pico-2/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-pico-2/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "pico",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pico2-w",
    "name": "Raspberry Pi Pico 2 W",
    "brand": "Raspberry Pi",
    "family": "RP2040 / RP2350",
    "chip": "RP2350",
    "cpu": "双核 Cortex-M33 或双核 Hazard3 RISC-V",
    "clock": "150 MHz",
    "flash": "4 MB",
    "ram": "520 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB",
      "Wi-Fi",
      "BLE"
    ],
    "category": "无线开发板",
    "tags": [
      "RP2040 / RP2350",
      "Raspberry Pi",
      "RP2350",
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "I²C",
      "SPI",
      "USB",
      "Wi-Fi",
      "BLE",
      "I2C",
      "树莓派"
    ],
    "difficulty": "入门",
    "description": "可跨面包板的微控制器开发板，增加无线连接。",
    "bestFor": "C/C++、MicroPython、PIO 与外设实验",
    "warning": "这是 MCU 板，不运行桌面 Raspberry Pi OS；PIO 与双核时序没有在当前模型中实现。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-pico-2/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-pico-2/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "pico",
    "checked_on": "2026-11-06"
  },
  {
    "id": "raspberry-pi-5",
    "name": "Raspberry Pi 5",
    "brand": "Raspberry Pi",
    "family": "Linux / AI",
    "chip": "Broadcom BCM2712",
    "cpu": "四核 Arm Cortex-A76",
    "clock": "2.4 GHz",
    "flash": "microSD / 外接存储",
    "ram": "1 / 2 / 4 / 8 / 16 GB，按型号",
    "logicVoltage": 3.3,
    "interfaces": [
      "Linux",
      "GPIO",
      "USB 3",
      "Ethernet",
      "PCIe",
      "MIPI",
      "Wi-Fi",
      "BLE"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "Raspberry Pi",
      "Broadcom BCM2712",
      "Linux",
      "GPIO",
      "USB 3",
      "Ethernet",
      "PCIe",
      "MIPI",
      "Wi-Fi",
      "BLE",
      "树莓派",
      "BroadcomBCM2712"
    ],
    "difficulty": "专业",
    "description": "可运行 Linux 的单板计算机，适合把控制程序与应用服务连接起来。",
    "bestFor": "OpenCV、设备网关、Linux 与部署学习",
    "warning": "没有直接模拟输入；GPIO 不能接 5 V；当前不模拟操作系统。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-5/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-5/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "sbc",
    "checked_on": "2026-11-06"
  },
  {
    "id": "raspberry-pi-4",
    "name": "Raspberry Pi 4 Model B",
    "brand": "Raspberry Pi",
    "family": "Linux / AI",
    "chip": "Broadcom BCM2711",
    "cpu": "四核 Arm Cortex-A72",
    "clock": "当前产品页标称 1.8 GHz",
    "flash": "microSD / 外接存储",
    "ram": "按内存 SKU",
    "logicVoltage": 3.3,
    "interfaces": [
      "Linux",
      "GPIO",
      "USB 3",
      "Ethernet",
      "MIPI",
      "Wi-Fi",
      "BLE"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "Raspberry Pi",
      "Broadcom BCM2711",
      "Linux",
      "GPIO",
      "USB 3",
      "Ethernet",
      "MIPI",
      "Wi-Fi",
      "BLE",
      "树莓派",
      "BroadcomBCM2711"
    ],
    "difficulty": "专业",
    "description": "成熟的 Linux 单板平台。",
    "bestFor": "视觉、网络服务和硬件接口整合",
    "warning": "不同硬件与固件版本可能有频率差异；GPIO 不是电源驱动输出。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-4-model-b/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-4-model-b/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "sbc",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pi-zero-2-w",
    "name": "Raspberry Pi Zero 2 W",
    "brand": "Raspberry Pi",
    "family": "Linux / AI",
    "chip": "RP3A0 SiP",
    "cpu": "四核 Arm Cortex-A53",
    "clock": "1 GHz",
    "flash": "microSD",
    "ram": "512 MB",
    "logicVoltage": 3.3,
    "interfaces": [
      "Linux",
      "GPIO",
      "USB OTG",
      "CSI",
      "Wi-Fi",
      "BLE"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "Raspberry Pi",
      "RP3A0 SiP",
      "Linux",
      "GPIO",
      "USB OTG",
      "CSI",
      "Wi-Fi",
      "BLE",
      "树莓派",
      "RP3A0SiP"
    ],
    "difficulty": "进阶",
    "description": "小型低资源 Linux 板，适合轻量联网装置。",
    "bestFor": "轻量采集网关、Linux GPIO",
    "warning": "内存与 USB 口资源有限；没有板载通用 ADC。",
    "source": "https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "sbc",
    "checked_on": "2026-11-06"
  },
  {
    "id": "microbit-v2",
    "name": "BBC micro:bit V2.2x",
    "brand": "Micro:bit Educational Foundation",
    "family": "micro:bit",
    "chip": "Nordic nRF52833",
    "cpu": "Arm Cortex-M4F",
    "clock": "64 MHz",
    "flash": "512 KB",
    "ram": "128 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "BLE",
      "GPIO",
      "LED矩阵",
      "按钮",
      "麦克风",
      "扬声器",
      "传感器"
    ],
    "category": "MCU开发板",
    "tags": [
      "micro:bit",
      "Micro:bit Educational Foundation",
      "Nordic nRF52833",
      "BLE",
      "GPIO",
      "LED矩阵",
      "按钮",
      "麦克风",
      "扬声器",
      "传感器",
      "NordicnRF52833"
    ],
    "difficulty": "入门",
    "description": "教育开发板，把输入、声音和 LED 点阵集中到一块板上。",
    "bestFor": "图形化编程、输入输出和快速体验",
    "warning": "边缘接口的编号、共享功能和供电限制应查 V2 硬件页。",
    "source": "https://tech.microbit.org/hardware/2-2-revision/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://tech.microbit.org/hardware/2-2-revision/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "microbit",
    "checked_on": "2026-11-06"
  },
  {
    "id": "teensy40",
    "name": "Teensy 4.0",
    "brand": "PJRC",
    "family": "Teensy",
    "chip": "NXP i.MX RT1062",
    "cpu": "Arm Cortex-M7",
    "clock": "600 MHz",
    "flash": "2 MB",
    "ram": "1 MB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "USB",
      "I²S",
      "I²C",
      "SPI",
      "CAN"
    ],
    "category": "MCU开发板",
    "tags": [
      "Teensy",
      "PJRC",
      "NXP i.MX RT1062",
      "GPIO",
      "ADC",
      "PWM",
      "USB",
      "I²S",
      "I²C",
      "SPI",
      "CAN",
      "I2C",
      "I2S",
      "NXPiMXRT1062"
    ],
    "difficulty": "专业",
    "description": "高性能微控制器板，配套 Teensyduino 与音频生态。",
    "bestFor": "音频、实时处理与复杂控制",
    "warning": "GPIO 不耐 5 V；4.0 与 4.1 的尺寸和扩展接口不同。",
    "source": "https://www.pjrc.com/store/teensy40.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.pjrc.com/store/teensy40.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "teensy41",
    "name": "Teensy 4.1",
    "brand": "PJRC",
    "family": "Teensy",
    "chip": "NXP i.MX RT1062",
    "cpu": "Arm Cortex-M7",
    "clock": "600 MHz",
    "flash": "8 MB",
    "ram": "1 MB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "USB",
      "I²S",
      "I²C",
      "SPI",
      "CAN"
    ],
    "category": "MCU开发板",
    "tags": [
      "Teensy",
      "PJRC",
      "NXP i.MX RT1062",
      "GPIO",
      "ADC",
      "PWM",
      "USB",
      "I²S",
      "I²C",
      "SPI",
      "CAN",
      "I2C",
      "I2S",
      "NXPiMXRT1062"
    ],
    "difficulty": "专业",
    "description": "高性能微控制器板，配套 Teensyduino 与音频生态。",
    "bestFor": "音频、实时处理与复杂控制",
    "warning": "GPIO 不耐 5 V；4.0 与 4.1 的尺寸和扩展接口不同。",
    "source": "https://www.pjrc.com/store/teensy41.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.pjrc.com/store/teensy41.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nano",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nrf52840-dk",
    "name": "nRF52840 DK",
    "brand": "Nordic Semiconductor",
    "family": "Nordic",
    "chip": "nRF52840",
    "cpu": "Arm Cortex-M4F",
    "clock": "64 MHz",
    "flash": "1 MB",
    "ram": "256 KB",
    "logicVoltage": null,
    "interfaces": [
      "BLE",
      "Thread",
      "Zigbee",
      "NFC",
      "USB",
      "GPIO",
      "板载调试器"
    ],
    "category": "无线开发板",
    "tags": [
      "Nordic",
      "Nordic Semiconductor",
      "nRF52840",
      "BLE",
      "Thread",
      "Zigbee",
      "NFC",
      "USB",
      "GPIO",
      "板载调试器"
    ],
    "difficulty": "进阶",
    "description": "带调试器、按钮、LED 和 NFC 天线的无线开发套件。",
    "bestFor": "低功耗 BLE、Thread 与 Zephyr / nRF Connect SDK",
    "warning": "I/O 电压随开发板供电配置变化；不要把 VDD、VBUS 与外部供电混接。",
    "source": "https://www.nordicsemi.com/Products/Development-hardware/nRF52840-DK",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.nordicsemi.com/Products/Development-hardware/nRF52840-DK",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.nordicsemi.com/Products/nRF52840",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nrf5340-dk",
    "name": "nRF5340 DK",
    "brand": "Nordic Semiconductor",
    "family": "Nordic",
    "chip": "nRF5340",
    "cpu": "双 Arm Cortex-M33",
    "clock": "应用核 128/64 MHz；网络核 64 MHz",
    "flash": "应用核 1 MB + 网络核 256 KB",
    "ram": "应用核 512 KB + 网络核 64 KB",
    "logicVoltage": null,
    "interfaces": [
      "BLE",
      "LE Audio",
      "Thread",
      "Zigbee",
      "NFC",
      "USB",
      "板载调试器"
    ],
    "category": "无线开发板",
    "tags": [
      "Nordic",
      "Nordic Semiconductor",
      "nRF5340",
      "BLE",
      "LE Audio",
      "Thread",
      "Zigbee",
      "NFC",
      "USB",
      "板载调试器"
    ],
    "difficulty": "专业",
    "description": "应用核和网络核分工的无线开发板。",
    "bestFor": "LE Audio、多协议与双核系统",
    "warning": "核间通信、无线协议和电源状态都需要真实 SDK / 硬件验证。",
    "source": "https://www.nordicsemi.com/Products/Development-hardware/nRF5340-DK",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.nordicsemi.com/Products/Development-hardware/nRF5340-DK",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.nordicsemi.com/Products/nRF5340",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nrf54l15-dk",
    "name": "nRF54L15 DK",
    "brand": "Nordic Semiconductor",
    "family": "Nordic",
    "chip": "nRF54L15",
    "cpu": "Arm Cortex-M33",
    "clock": "见 SoC 数据手册",
    "flash": "1.5 MB NVM",
    "ram": "256 KB",
    "logicVoltage": null,
    "interfaces": [
      "BLE",
      "Thread",
      "Zigbee",
      "NFC",
      "GPIO",
      "板载调试器"
    ],
    "category": "无线开发板",
    "tags": [
      "Nordic",
      "Nordic Semiconductor",
      "nRF54L15",
      "BLE",
      "Thread",
      "Zigbee",
      "NFC",
      "GPIO",
      "板载调试器"
    ],
    "difficulty": "专业",
    "description": "较新一代低功耗无线 SoC 的官方开发套件。",
    "bestFor": "无线功耗、蓝牙与 nRF Connect SDK",
    "warning": "NVM 与旧型号 Flash 组织方式不同；电压和调试设置按 DK 文档。",
    "source": "https://www.nordicsemi.com/Products/Development-hardware/nRF54L15-DK",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.nordicsemi.com/Products/Development-hardware/nRF54L15-DK",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.nordicsemi.com/Products/nRF54L15",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "xiao-samd21",
    "name": "Seeed Studio XIAO SAMD21",
    "brand": "Seeed Studio",
    "family": "SAMD",
    "chip": "ATSAMD21G18A",
    "cpu": "Arm Cortex-M0+",
    "clock": "48 MHz",
    "flash": "256 KB",
    "ram": "32 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "DAC",
      "UART",
      "I²C",
      "SPI",
      "USB"
    ],
    "category": "MCU开发板",
    "tags": [
      "SAMD",
      "Seeed Studio",
      "ATSAMD21G18A",
      "GPIO",
      "ADC",
      "DAC",
      "UART",
      "I²C",
      "SPI",
      "USB",
      "I2C"
    ],
    "difficulty": "入门",
    "description": "21×17.8 mm 的小型 MCU 板。",
    "bestFor": "可穿戴、小尺寸原型、CircuitPython",
    "warning": "经典版与 Plus 的背面扩展和电池管理不同。",
    "source": "https://wiki.seeedstudio.com/Seeeduino-XIAO/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.seeedstudio.com/Seeeduino-XIAO/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "xiao",
    "checked_on": "2026-11-06"
  },
  {
    "id": "xiao-rp2040",
    "name": "Seeed Studio XIAO RP2040",
    "brand": "Seeed Studio",
    "family": "RP2040 / RP2350",
    "chip": "RP2040",
    "cpu": "双核 Arm Cortex-M0+",
    "clock": "133 MHz",
    "flash": "2 MB",
    "ram": "264 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "UART",
      "I²C",
      "SPI",
      "USB"
    ],
    "category": "MCU开发板",
    "tags": [
      "RP2040 / RP2350",
      "Seeed Studio",
      "RP2040",
      "GPIO",
      "ADC",
      "PWM",
      "PIO",
      "UART",
      "I²C",
      "SPI",
      "USB",
      "I2C",
      "树莓派"
    ],
    "difficulty": "入门",
    "description": "将 RP2040 放入 XIAO 小尺寸布局。",
    "bestFor": "紧凑原型、PIO 与 MicroPython",
    "warning": "XIAO 与 Pico 的板针脚编号不同；Plus 是另一种布局。",
    "source": "https://wiki.seeedstudio.com/XIAO-RP2040/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.seeedstudio.com/XIAO-RP2040/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "xiao",
    "checked_on": "2026-11-06"
  },
  {
    "id": "xiao-esp32c3",
    "name": "Seeed Studio XIAO ESP32C3",
    "brand": "Seeed Studio",
    "family": "ESP32",
    "chip": "ESP32-C3",
    "cpu": "32-bit RISC-V",
    "clock": "160 MHz",
    "flash": "4 MB",
    "ram": "400 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Seeed Studio",
      "ESP32-C3",
      "Wi-Fi",
      "BLE",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "I2C",
      "乐鑫",
      "无线",
      "ESP32C3"
    ],
    "difficulty": "入门",
    "description": "带外置天线接口的紧凑无线开发板。",
    "bestFor": "电池传感器、小型联网设备",
    "warning": "天线、电池接口和 5 V 输入不等同于 GPIO 可接 5 V。",
    "source": "https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "xiao",
    "checked_on": "2026-11-06"
  },
  {
    "id": "xiao-esp32s3-sense",
    "name": "Seeed Studio XIAO ESP32S3 Sense",
    "brand": "Seeed Studio",
    "family": "ESP32",
    "chip": "ESP32-S3R8",
    "cpu": "Xtensa LX7 双核",
    "clock": "240 MHz",
    "flash": "8 MB",
    "ram": "8 MB PSRAM；片内 SRAM 另计",
    "logicVoltage": 3.3,
    "interfaces": [
      "Wi-Fi",
      "BLE",
      "摄像头",
      "麦克风",
      "GPIO",
      "USB"
    ],
    "category": "无线开发板",
    "tags": [
      "ESP32",
      "Seeed Studio",
      "ESP32-S3R8",
      "Wi-Fi",
      "BLE",
      "摄像头",
      "麦克风",
      "GPIO",
      "USB",
      "乐鑫",
      "无线",
      "ESP32S3R8"
    ],
    "difficulty": "进阶",
    "description": "包含摄像头与数字麦克风扩展的小型感知板。",
    "bestFor": "视觉、声音、端侧模型原型",
    "warning": "摄像头传感器存在批次版本；按官方当前文档与实物核对。",
    "source": "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "xiao",
    "checked_on": "2026-11-06"
  },
  {
    "id": "xiao-nrf52840-sense",
    "name": "Seeed Studio XIAO nRF52840 Sense",
    "brand": "Seeed Studio",
    "family": "Nordic",
    "chip": "nRF52840",
    "cpu": "Arm Cortex-M4F",
    "clock": "64 MHz",
    "flash": "1 MB 内置 + 2 MB 板载",
    "ram": "256 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "BLE",
      "IMU",
      "PDM麦克风",
      "GPIO",
      "ADC",
      "USB"
    ],
    "category": "无线开发板",
    "tags": [
      "Nordic",
      "Seeed Studio",
      "nRF52840",
      "BLE",
      "IMU",
      "PDM麦克风",
      "GPIO",
      "ADC",
      "USB"
    ],
    "difficulty": "进阶",
    "description": "在 XIAO 上集成运动传感器和麦克风的 BLE 板。",
    "bestFor": "动作识别、低功耗采样、TinyML",
    "warning": "普通版、Sense 与 Plus 的传感器和引脚数量不同。",
    "source": "https://wiki.seeedstudio.com/XIAO_BLE/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.seeedstudio.com/XIAO_BLE/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "xiao",
    "checked_on": "2026-11-06"
  },
  {
    "id": "lp-mspm0g3507",
    "name": "LP-MSPM0G3507 LaunchPad",
    "brand": "Texas Instruments",
    "family": "TI MSP",
    "chip": "MSPM0G3507",
    "cpu": "Arm Cortex-M0+",
    "clock": "80 MHz",
    "flash": "128 KB",
    "ram": "32 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "DAC",
      "运放",
      "比较器",
      "CAN-FD",
      "UART",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "TI MSP",
      "Texas Instruments",
      "MSPM0G3507",
      "GPIO",
      "ADC",
      "DAC",
      "运放",
      "比较器",
      "CAN-FD",
      "UART",
      "板载调试器"
    ],
    "difficulty": "进阶",
    "description": "带调试器、模拟温度与光传感器的 TI 入门板。",
    "bestFor": "模拟采集、电赛基础、控制系统",
    "warning": "板载传感器和高速 ADC 演示的跳线接法需要按用户指南配置。",
    "source": "https://www.ti.com/tool/LP-MSPM0G3507",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.ti.com/tool/LP-MSPM0G3507",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.ti.com/product/MSPM0G3507",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "msp430fr2355",
    "name": "MSP-EXP430FR2355 LaunchPad",
    "brand": "Texas Instruments",
    "family": "TI MSP",
    "chip": "MSP430FR2355",
    "cpu": "16-bit MSP430",
    "clock": "24 MHz",
    "flash": "32 KB FRAM（非 Flash）",
    "ram": "4 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "DAC",
      "PGA",
      "比较器",
      "UART",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "TI MSP",
      "Texas Instruments",
      "MSP430FR2355",
      "GPIO",
      "ADC",
      "DAC",
      "PGA",
      "比较器",
      "UART",
      "板载调试器"
    ],
    "difficulty": "进阶",
    "description": "使用 FRAM 的低功耗开发板，带模拟信号链功能。",
    "bestFor": "低功耗、数据记录与模拟前端",
    "warning": "程序与数据共享非易失 FRAM 预算；不能套用 STM32 工程。",
    "source": "https://www.ti.com/tool/MSP-EXP430FR2355",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.ti.com/tool/MSP-EXP430FR2355",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "frdm-k64f",
    "name": "FRDM-K64F",
    "brand": "NXP",
    "family": "NXP",
    "chip": "Kinetis K64",
    "cpu": "Arm Cortex-M4",
    "clock": "120 MHz",
    "flash": "1 MB",
    "ram": "256 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "Ethernet",
      "GPIO",
      "ADC",
      "USB",
      "microSD",
      "板载调试器"
    ],
    "category": "MCU开发板",
    "tags": [
      "NXP",
      "Kinetis K64",
      "Ethernet",
      "GPIO",
      "ADC",
      "USB",
      "microSD",
      "板载调试器",
      "恩智浦",
      "KinetisK64"
    ],
    "difficulty": "进阶",
    "description": "带 Ethernet 与 OpenSDA 调试的 Freedom 平台。",
    "bestFor": "网络外设、RTOS 与控制",
    "warning": "官方说明部分新板不再装 FXOS8700CQ；勿假定所有批次都有运动传感器。",
    "source": "https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-K64F",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-K64F",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "frdm-mcxn947",
    "name": "FRDM-MCXN947",
    "brand": "NXP",
    "family": "NXP",
    "chip": "MCXN947VDF",
    "cpu": "双核 Arm Cortex-M33",
    "clock": "150 MHz",
    "flash": "2 MB",
    "ram": "512 KB",
    "logicVoltage": 3.3,
    "interfaces": [
      "GPIO",
      "ADC",
      "USB",
      "I²C",
      "SPI",
      "UART",
      "板载调试器",
      "TinyML"
    ],
    "category": "MCU开发板",
    "tags": [
      "NXP",
      "MCXN947VDF",
      "GPIO",
      "ADC",
      "USB",
      "I²C",
      "SPI",
      "UART",
      "板载调试器",
      "TinyML",
      "I2C",
      "恩智浦"
    ],
    "difficulty": "专业",
    "description": "面向工业与消费 IoT 的 MCX N 官方开发板。",
    "bestFor": "MCUXpresso、TinyML 与安全应用",
    "warning": "芯片加速单元、双核和 SDK 行为目前为参考资料范围。",
    "source": "https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-MCXN947",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://mcuxpresso.nxp.com/mcuxsdk/latest/boards/MCX/frdmmcxn947/index.html",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "nucleo",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ch32v003-evt",
    "name": "CH32V003EVT",
    "brand": "WCH 沁恒",
    "family": "RISC-V",
    "chip": "CH32V003F4P6",
    "cpu": "RISC-V 青稞内核",
    "clock": "48 MHz",
    "flash": "16 KB",
    "ram": "2 KB",
    "logicVoltage": null,
    "interfaces": [
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "单线调试"
    ],
    "category": "MCU开发板",
    "tags": [
      "RISC-V",
      "WCH 沁恒",
      "CH32V003 系列",
      "GPIO",
      "ADC",
      "PWM",
      "UART",
      "I²C",
      "SPI",
      "单线调试",
      "I2C",
      "沁恒",
      "CH32V003"
    ],
    "difficulty": "进阶",
    "description": "沁恒官方 CH32V003 评估与例程平台。",
    "bestFor": "入门 RISC-V、低成本控制",
    "warning": "不同 EVT 芯片封装与供电不同；需用 WCH 工具链和对应例程。",
    "source": "https://www.wch.cn/downloads/CH32V003EVT_ZIP.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.wch.cn/downloads/CH32V003EVT_ZIP.html",
        "language": "中文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.wch.cn/products/CH32V003.html",
        "language": "中文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "module",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ch32v307-evt",
    "name": "CH32V307V-EVT",
    "brand": "WCH 沁恒",
    "family": "RISC-V",
    "chip": "CH32V307VCT6",
    "cpu": "RISC-V V4F",
    "clock": "144 MHz",
    "flash": "256 KB",
    "ram": "64 KB",
    "logicVoltage": null,
    "interfaces": [
      "GPIO",
      "ADC",
      "DAC",
      "USB",
      "Ethernet",
      "CAN",
      "UART",
      "SPI"
    ],
    "category": "MCU开发板",
    "tags": [
      "RISC-V",
      "WCH 沁恒",
      "CH32V307VCT6",
      "GPIO",
      "ADC",
      "DAC",
      "USB",
      "Ethernet",
      "CAN",
      "UART",
      "SPI",
      "沁恒"
    ],
    "difficulty": "进阶",
    "description": "CH32V30x 系列官方评估平台与外设例程。",
    "bestFor": "国产 RISC-V、网络与外设实验",
    "warning": "CH32V307 与 CH32V317 外设不同；手册覆盖系列不表示本板具备所有功能。",
    "source": "https://www.wch.cn/downloads/CH32V307EVT_ZIP.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.wch.cn/downloads/CH32V307EVT_ZIP.html",
        "language": "中文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://www.wch.cn/products/CH32V307.html",
        "language": "中文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "module",
    "checked_on": "2026-11-06"
  },
  {
    "id": "jetson-orin-nano-super",
    "name": "Jetson Orin Nano Super Developer Kit",
    "brand": "NVIDIA",
    "family": "Linux / AI",
    "chip": "Jetson Orin Nano 模组",
    "cpu": "Arm CPU + NVIDIA GPU",
    "clock": "依性能模式",
    "flash": "microSD / NVMe",
    "ram": "按套件规格",
    "logicVoltage": 3.3,
    "interfaces": [
      "Linux",
      "CUDA",
      "GPU",
      "MIPI",
      "USB",
      "Ethernet",
      "GPIO"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "NVIDIA",
      "Jetson Orin Nano 模组",
      "Linux",
      "CUDA",
      "GPU",
      "MIPI",
      "USB",
      "Ethernet",
      "GPIO",
      "JetsonOrinNano"
    ],
    "difficulty": "专业",
    "description": "面向视觉与端侧 AI 的开发套件。",
    "bestFor": "部署视觉模型、摄像头推理与 Linux 系统",
    "warning": "AI 算力取决于精度、模式和算子；不在浏览器中模拟 GPU 与 JetPack。",
    "source": "https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/nano-super-developer-kit/",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/nano-super-developer-kit/",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "sbc",
    "checked_on": "2026-11-06"
  },
  {
    "id": "maixcam",
    "name": "Sipeed MaixCAM",
    "brand": "Sipeed",
    "family": "Linux / AI",
    "chip": "SOPHGO SG2002",
    "cpu": "RISC-V / Arm 异构处理器",
    "clock": "主核 1 GHz，依配置",
    "flash": "TF / SD NAND",
    "ram": "256 MB DDR3",
    "logicVoltage": 3.3,
    "interfaces": [
      "Linux",
      "NPU",
      "摄像头",
      "显示",
      "麦克风",
      "Wi-Fi",
      "GPIO"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "Sipeed",
      "SOPHGO SG2002",
      "Linux",
      "NPU",
      "摄像头",
      "显示",
      "麦克风",
      "Wi-Fi",
      "GPIO",
      "SOPHGOSG2002"
    ],
    "difficulty": "专业",
    "description": "集成视觉、显示和音频生态的 AI 开发设备。",
    "bestFor": "用 MaixPy / MaixCDK 做视觉应用",
    "warning": "MaixCAM 与普通 LicheeRV Nano 的软件授权和兼容范围不同，勿混用镜像。",
    "source": "https://wiki.sipeed.com/hardware/en/maixcam/maixcam.html",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.sipeed.com/hardware/en/maixcam/maixcam.html",
        "language": "英文"
      },
      {
        "label": "芯片规格 / 补充来源",
        "url": "https://wiki.sipeed.com/licheerv-nano",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "sbc",
    "checked_on": "2026-11-06"
  },
  {
    "id": "licheerv-nano",
    "name": "Sipeed LicheeRV Nano",
    "brand": "Sipeed",
    "family": "Linux / AI",
    "chip": "SOPHGO SG2002",
    "cpu": "主核 RISC-V C906 / Cortex-A53 可选；小核 RISC-V",
    "clock": "1 GHz / 700 MHz",
    "flash": "TF / SD NAND",
    "ram": "256 MB DDR3",
    "logicVoltage": 3.3,
    "interfaces": [
      "Linux",
      "NPU",
      "MIPI",
      "USB",
      "GPIO",
      "UART",
      "I²C",
      "SPI"
    ],
    "category": "Linux / AI 开发板",
    "tags": [
      "Linux / AI",
      "Sipeed",
      "SOPHGO SG2002",
      "Linux",
      "NPU",
      "MIPI",
      "USB",
      "GPIO",
      "UART",
      "I²C",
      "SPI",
      "I2C",
      "SOPHGOSG2002"
    ],
    "difficulty": "专业",
    "description": "小尺寸 Linux 核心板，提供摄像头与显示扩展。",
    "bestFor": "嵌入式 Linux、图像数据流和设备集成",
    "warning": "B/E/W 等后缀决定有线或无线连接；普通核心板不能直接套用 MaixCAM 软件。",
    "source": "https://wiki.sipeed.com/licheerv-nano",
    "docs": [
      {
        "label": "官方产品与文档",
        "url": "https://wiki.sipeed.com/licheerv-nano",
        "language": "英文"
      }
    ],
    "support": "reference",
    "profileId": null,
    "style": "sbc",
    "checked_on": "2026-11-06"
  }
].map(item => !item.profileId && Object.hasOwn(BOARD_PROFILES, item.id) ? {...item, profileId:item.id} : item);
export const COMPONENT_CATALOG = [
  {
    "id": "led",
    "name": "LED 发光二极管",
    "category": "基础与连接",
    "tags": [
      "点灯",
      "GPIO",
      "PWM",
      "极性"
    ],
    "description": "把电流变成可见光，最适合第一次观察代码如何控制电路。",
    "pins": [
      "A",
      "K"
    ],
    "voltage": "按颜色和型号核对正向压降；须串联限流电阻",
    "guide": "先从 GPIO→电阻→A、K→GND 的回路开始；A 是正极，K 是负极。",
    "warning": "不能把 LED 当作自带限流的灯泡。默认是教学 LED 等效模型。",
    "source": "https://learn.adafruit.com/adafruit-arduino-lesson-2-leds/overview",
    "modelType": "led",
    "defaults": {
      "color": "red",
      "maxMa": 20
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "rgbled",
    "name": "Kingbright WP154A4SUREQBFZGW · RGB 三色 LED",
    "category": "显示与声音",
    "tags": [
      "RGB",
      "PWM",
      "混色",
      "GPIO",
      "输出"
    ],
    "description": "5 mm 白色磨砂灯罩，内部三颗发光芯片共用阴极。可用三路 PWM 改变混色。",
    "pins": [
      "R",
      "COM",
      "B",
      "G"
    ],
    "voltage": "COM 接地。每个颜色分别串限流电阻。",
    "guide": "从底边平口一侧依次识别 R、COM、B、G。原厂直脚间距 1.27 mm，实验用跳线引出。",
    "warning": "最长的第二脚是公共阴极。低电流正向压降因颜色和个体而异。",
    "source": "https://www.kingbrightusa.com/images/catalog/SPEC/WP154A4SUREQBFZGW.pdf",
    "modelType": "rgbled",
    "defaults": {
      "rgbModel": "kingbright-wp154a4",
      "common": "cathode",
      "maxMa": 20
    },
    "support": "simulate",
    "checked_on": "2026-11-06"
  },
  {
    "id": "resistor",
    "name": "电阻 · 可改阻值",
    "category": "基础与连接",
    "tags": [
      "限流",
      "分压",
      "上拉",
      "欧姆定律"
    ],
    "description": "限制电流，也能和另一只电阻组成分压器。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "无固定供电；检查功率 P=I²R",
    "guide": "点灯先用默认 330Ω；选中后可改阻值，不必为每个阻值找新元件。",
    "warning": "阻值和允许功率是两回事；过热与容差需结合实物数据手册。",
    "source": "https://learn.sparkfun.com/tutorials/resistors/all",
    "modelType": "resistor",
    "defaults": {
      "resistance": 330
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pot",
    "name": "旋钮电位器",
    "category": "基础与连接",
    "tags": [
      "ADC",
      "模拟输入",
      "分压",
      "旋钮",
      "输入"
    ],
    "description": "转动旋钮会改变中间滑动端电压，适合控制亮度或舵机角度。",
    "pins": [
      "VCC",
      "OUT",
      "GND"
    ],
    "voltage": "两端接开发板允许的模拟参考电源与 GND",
    "guide": "OUT 接 ADC 引脚；先观察旋钮位置与 ADC 读数的关系。",
    "warning": "不要把滑动端当作大功率可调电源；ADC 电压不能超过允许范围。",
    "source": "https://learn.adafruit.com/adafruit-arduino-lesson-8-analog-inputs/overview",
    "modelType": "pot",
    "defaults": {
      "position": 0.5,
      "resistance": 10000
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "button",
    "name": "四脚轻触按键",
    "category": "基础与连接",
    "tags": [
      "按键",
      "GPIO输入",
      "消抖",
      "上拉",
      "输入"
    ],
    "description": "按下时接通两组触点，松开时断开。",
    "pins": [
      "1",
      "2",
      "3",
      "4"
    ],
    "voltage": "干接点；用上拉或下拉确定默认电平",
    "guide": "先确认同侧内部已连通的脚，再让按键跨过面包板中间槽。",
    "warning": "四脚不是四个独立开关；未按下时输入悬空会读到不稳定值。",
    "source": "https://learn.sparkfun.com/tutorials/button-and-switch-basics",
    "modelType": "button",
    "defaults": {
      "pressed": false
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "switch",
    "name": "拨动开关 · SPST",
    "category": "基础与连接",
    "tags": [
      "开关",
      "GPIO输入",
      "通断",
      "输入"
    ],
    "description": "两端只有接通和断开两种稳定状态。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "按实物触点电压、电流额定值选用",
    "guide": "适合做电源许可开关或模式选择输入。",
    "warning": "本项是两脚单刀单掷等效模型，不能代替三脚转换开关。",
    "source": "https://learn.sparkfun.com/tutorials/button-and-switch-basics",
    "modelType": "switch",
    "defaults": {
      "closed": false
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "dipswitch-a6d-4100",
    "name": "Omron A6D-4100 四位拨码开关",
    "category": "基础与连接",
    "tags": ["拨码", "GPIO输入", "输入", "跨槽插装"],
    "description": "带四个独立滑块的通孔开关，接通后保持位置。",
    "pins": ["1 ↔ 8", "2 ↔ 7", "3 ↔ 6", "4 ↔ 5"],
    "voltage": "无源触点 · 数据表额定 30 mA / 30 V DC",
    "guide": "两排脚跨过 E / F 沟槽。每位的一端接上拉 GPIO，另一端接地，拨到 ON 后读低电平。",
    "warning": "教学仿真取稳态触点。实物最低负载条件请查数据表。",
    "source": "https://omronfs.omron.com/en_US/ecb/products/pdf/en-a6d_a6dr.pdf",
    "modelType": "dipswitch",
    "defaults": {"switchMask": 0},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "diode",
    "name": "硅二极管 · 教学模型",
    "category": "基础与连接",
    "tags": [
      "单向导通",
      "续流",
      "极性"
    ],
    "description": "主要允许电流沿一个方向流动，可学习整流和反向阻断。",
    "pins": [
      "A",
      "K"
    ],
    "voltage": "默认正向压降约 0.7V，仅为教学近似",
    "guide": "直插封装参考 1N4148 的 DO-35，色环标记 K。成形后两脚隔三个面包板孔距（7.62 mm）。",
    "warning": "不同二极管的额定反压、漏电和动态特性不同；仿真参数不是器件保证值。",
    "source": "https://learn.sparkfun.com/tutorials/diodes/all",
    "docs": [{"label":"Vishay 1N4148 封装尺寸","url":"https://www.vishay.com/docs/81857/1n4148.pdf","language":"EN"}],
    "modelType": "diode",
    "defaults": {
      "forwardVoltage": 0.7,
      "maxMa": 100
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "schottky",
    "name": "肖特基二极管 · 教学模型",
    "category": "基础与连接",
    "tags": [
      "低压降",
      "反接保护",
      "续流"
    ],
    "description": "用于较低压降的单向导通，便于比较二极管种类。",
    "pins": [
      "A",
      "K"
    ],
    "voltage": "本例压降 0.3V 是可修改近似",
    "guide": "先和硅二极管使用同一电源、电阻进行对比。",
    "warning": "实验台共用 DO-35 教学外形。实物的封装、反压和漏电以所选型号资料为准。",
    "source": "https://learn.sparkfun.com/tutorials/diodes/all",
    "modelType": "diode",
    "defaults": {
      "forwardVoltage": 0.3,
      "maxMa": 100
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "capacitor",
    "name": "电解电容 · 可改容量",
    "category": "基础与连接",
    "tags": [
      "RC",
      "充放电",
      "滤波",
      "极性"
    ],
    "description": "暂时储存电荷，让电压变化变得缓慢。",
    "pins": [
      "+",
      "-"
    ],
    "voltage": "额定耐压必须高于实际工作电压",
    "guide": "正极和负极插入相邻两列。示例封装参考直径 6.3 mm 的径向电容，2.50 mm 脚距微调到 2.54 mm 孔距。",
    "warning": "电解电容有正负极；本平台是教学等效模型，未覆盖真实 ESR 与全部失效机理。",
    "source": "https://learn.sparkfun.com/tutorials/capacitors/all",
    "docs": [{"label":"Panasonic 径向电容尺寸","url":"https://industrial.panasonic.com/ww/products/pt/aluminum-cap-lead/models/EEUFC1E101SH","language":"EN"}],
    "modelType": "capacitor",
    "defaults": {
      "capacitance": 100
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ceramic-cap",
    "name": "陶瓷去耦电容",
    "category": "基础与连接",
    "tags": [
      "去耦",
      "电源完整性",
      "滤波"
    ],
    "description": "通常放在芯片电源脚附近，提供短时间电流并减小电源干扰。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "按所选容量、封装、介质与耐压核对",
    "guide": "先理解“每颗芯片附近的一小段供电回路”，再阅读 PCB 布局要求。",
    "warning": "它通常无极性；容量随直流偏压变化等特性不能用理想电容完全代表。",
    "source": "https://learn.sparkfun.com/tutorials/capacitors/all",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "breadboard",
    "name": "无焊面包板",
    "category": "基础与连接",
    "tags": [
      "接线",
      "连通关系",
      "入门"
    ],
    "description": "让器件插入孔位即可连接，适合反复修改实验。",
    "pins": [],
    "voltage": "不用于大电流或高压线路",
    "guide": "中间每组 5 孔相通；中央槽两侧分开；电源长轨是否中断要实测。",
    "warning": "不同尺寸和厂家电源轨可能不连续；画面上靠近不等于已经电气连接。",
    "source": "https://learn.adafruit.com/breadboards-for-beginners/breadboards",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "jumper-wire",
    "name": "杜邦线与跳线",
    "category": "基础与连接",
    "tags": [
      "接线",
      "共地",
      "线色"
    ],
    "description": "把开发板引脚和器件端点连起来。",
    "pins": [],
    "voltage": "按线径、长度与接头接触条件使用",
    "guide": "电源用红色，地用深色，信号分色；在画布中使用接线工具。",
    "warning": "公母头与引脚间距要匹配；线色只是标记，不能决定实际电压。",
    "source": "https://learn.adafruit.com/breadboards-for-beginners/breadboards",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "keypad4x4",
    "name": "4×4 矩阵键盘",
    "category": "输入与控制",
    "tags": [
      "按键",
      "矩阵扫描",
      "GPIO",
      "输入"
    ],
    "description": "用 4 行和 4 列扫描 16 个按键，练习输入扩展。",
    "pins": [
      "R1",
      "R2",
      "R3",
      "R4",
      "C1",
      "C2",
      "C3",
      "C4"
    ],
    "voltage": "无固定供电；按 MCU GPIO 电平扫描",
    "guide": "逐行激活，再读取列输入；先只实现一个按键。",
    "warning": "排线脚序要看该键盘引脚图；多键同时按下可能出现鬼键。",
    "source": "https://learn.adafruit.com/matrix-keypad?view=all",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "qt-encoder",
    "name": "Adafruit I²C 旋转编码器",
    "category": "输入与控制",
    "tags": [
      "旋钮",
      "编码器",
      "I²C",
      "菜单",
      "I2C",
      "输入"
    ],
    "description": "旋转编码器加 seesaw 控制器，通过 I²C 读取转动和按压。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "INT"
    ],
    "voltage": "该转换板支持 3–5V；默认 I²C 地址 0x36",
    "guide": "适合菜单、音量和参数调节；先用厂家库读取增量。",
    "warning": "本项是带控制器的 I²C 板，不是裸 A/B 相编码器；多个模块需处理地址。",
    "source": "https://learn.adafruit.com/adafruit-i2c-qt-rotary-encoder/pinouts",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pec11r-4220f-s0024",
    "name": "Bourns PEC11R-4220F-S0024 旋转编码器",
    "category": "输入与控制",
    "tags": ["旋钮", "机械编码器", "正交", "A/B 相", "24 格", "Bourns"],
    "description": "24 个机械卡位和每转 24 个正交脉冲，带独立的轴按压开关。",
    "pins": ["A", "C", "B", "SW1", "SW2"],
    "voltage": "无源触点。上拉电压按开发板逻辑电平选取。",
    "guide": "把 C 接地，A、B 接带上拉的数字输入。SW1 / SW2 可单独接为低电平有效按键。",
    "warning": "用跳线引出端子。教学模型用理想触点和固定边沿间隔。",
    "source": "https://www.bourns.com/data/global/pdfs/PEC11R.pdf",
    "modelType": "encoder",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "joystick",
    "name": "SparkFun 双轴摇杆 · COM-09032 / BOB-09110",
    "category": "输入与控制",
    "tags": [
      "ADC",
      "二维输入",
      "按键",
      "摇杆",
      "SparkFun",
      "输入"
    ],
    "description": "COM-09032 摇杆焊到 BOB-09110 转接板，两个 10 kΩ 电位器提供模拟输出，并有独立的按压开关。",
    "pins": ["VCC", "VERT", "HORIZ（板上 HORZ）", "SEL", "GND"],
    "voltage": "按 ADC 允许范围供电。Blue Pill 示例使用 3.3 V。",
    "guide": "VERT 和 HORIZ 接两个 ADC 输入，SEL 接上拉数字输入。先测中心值，再设置程序死区。",
    "warning": "可用跳线连接 2.54 mm 排针。实际中心读数和机械行程存在器件差异。",
    "source": "https://www.sparkfun.com/sparkfun-thumb-joystick-breakout.html",
    "modelType": "joystick",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "magnetic-switch",
    "name": "Grove 磁簧开关模块",
    "category": "输入与控制",
    "tags": [
      "磁铁",
      "门磁",
      "GPIO",
      "输入"
    ],
    "description": "磁铁靠近时改变输出，可用作开门检测或转动计数。",
    "pins": [
      "VCC",
      "GND",
      "SIG"
    ],
    "voltage": "该 Grove 板工作电压 3.3–5.25V",
    "guide": "先把 SIG 当普通数字输入，观察磁铁远近造成的变化。",
    "warning": "磁铁方向和距离影响触发；机械触点可能需要消抖。",
    "source": "https://wiki.seeedstudio.com/Grove-Magnetic_Switch/",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "npn",
    "name": "PN2222 NPN 三极管",
    "category": "模拟与逻辑",
    "tags": [
      "开关",
      "放大",
      "驱动"
    ],
    "description": "用较小的基极电流控制较大的集电极电流。",
    "pins": [
      "E",
      "B",
      "C"
    ],
    "voltage": "基极限流，负载电源按器件与负载额定值选择",
    "guide": "先学习基极电阻与共地，再用它驱动低压小负载。",
    "warning": "同名或相近封装不保证脚序一致；感性负载需按设计加入续流保护。",
    "source": "https://www.adafruit.com/product/756",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "nmos",
    "name": "N 沟道功率 MOSFET",
    "category": "模拟与逻辑",
    "tags": [
      "PWM",
      "功率开关",
      "栅极"
    ],
    "description": "适合低侧开关和 PWM 调速，输入主要控制栅极电压。",
    "pins": [
      "G",
      "D",
      "S"
    ],
    "voltage": "核对 VGS、VDS 和在实际 VGS 下的导通电阻",
    "guide": "先区分栅极 G、漏极 D、源极 S；用下拉防止栅极悬空。",
    "warning": "阈值电压不代表完全导通电压；宣传最大电流不能直接作为面包板连续电流。",
    "source": "https://www.adafruit.com/product/355?gQT=1",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "lm358",
    "name": "LM358 双运算放大器",
    "category": "模拟与逻辑",
    "tags": [
      "运放",
      "模拟放大",
      "滤波"
    ],
    "description": "用反馈电阻设置放大倍数，学习模拟信号处理。",
    "pins": [
      "OUT1",
      "IN1-",
      "IN1+",
      "V-",
      "IN2+",
      "IN2-",
      "OUT2",
      "V+"
    ],
    "voltage": "经典 LM358 单电源 3–30V；按具体后缀核对",
    "guide": "从电压跟随器开始，再做非反相放大器。",
    "warning": "输入共模范围和输出摆幅有限，不是全电源轨运放。",
    "source": "https://www.ti.com/product/LM358",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "lm393",
    "name": "LM393 双电压比较器",
    "category": "模拟与逻辑",
    "tags": [
      "阈值",
      "比较器",
      "上拉"
    ],
    "description": "比较两个输入电压，输出高低状态。",
    "pins": [
      "OUT1",
      "IN1-",
      "IN1+",
      "GND",
      "IN2+",
      "IN2-",
      "OUT2",
      "VCC"
    ],
    "voltage": "按具体版本手册；经典器件支持宽供电范围",
    "guide": "输出为开集电极类型，先加上拉，再比较电位器与参考电压。",
    "warning": "上拉到多少伏决定输出高电平；比较器不能当作线性运放使用。",
    "source": "https://www.ti.com/product/LM393",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ne555",
    "name": "NE555 定时器",
    "category": "模拟与逻辑",
    "tags": [
      "振荡器",
      "RC",
      "定时"
    ],
    "description": "用电阻和电容产生延时或方波。",
    "pins": [
      "GND",
      "TRIG",
      "OUT",
      "RESET",
      "CTRL",
      "THRESH",
      "DISCH",
      "VCC"
    ],
    "voltage": "按 NE555 具体手册；不要套用 CMOS 555 的最低供电",
    "guide": "先搭单稳态延时，再搭无稳态振荡。",
    "warning": "NE555、TLC555 等不同工艺版本的电流和电压要求不同。",
    "source": "https://www.ti.com/product/NE555",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "hc595",
    "name": "74HC595 串入并出移位寄存器",
    "category": "模拟与逻辑",
    "tags": [
      "GPIO扩展",
      "串行",
      "LED"
    ],
    "description": "用少量控制线更新 8 路数字输出。",
    "pins": [
      "SER",
      "SRCLK",
      "RCLK",
      "OE",
      "SRCLR",
      "QA…QH",
      "VCC",
      "GND"
    ],
    "voltage": "HC 系列电压范围与输入阈值见手册",
    "guide": "先移入 8 位，再给锁存时钟，使一组 LED 同时更新。",
    "warning": "它不是大电流驱动器；3.3V MCU 驱动 5V HC 输入时要核对 VIH。",
    "source": "https://www.ti.com/product/SN74HC595",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "hc165",
    "name": "74HC165 并入串出移位寄存器",
    "category": "模拟与逻辑",
    "tags": [
      "GPIO扩展",
      "按键",
      "串行"
    ],
    "description": "把多个开关输入收集后，依次读回 MCU。",
    "pins": [
      "SH/LD",
      "CLK",
      "CLK_INH",
      "SER",
      "A…H",
      "QH",
      "VCC",
      "GND"
    ],
    "voltage": "按 HC 系列供电和输入阈值核对",
    "guide": "先锁存并行输入，再逐位读取。",
    "warning": "输入不能悬空；它与 74HC595 的数据方向相反。",
    "source": "https://www.ti.com/product/SN74HC165",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "hc14",
    "name": "74HC14 施密特触发反相器",
    "category": "模拟与逻辑",
    "tags": [
      "整形",
      "消抖",
      "逻辑门"
    ],
    "description": "把变化较慢的输入变成清晰的数字跳变，并反相输出。",
    "pins": [
      "1A…6A",
      "1Y…6Y",
      "VCC",
      "GND"
    ],
    "voltage": "TI SN74HC14 工作电源 2–6V",
    "guide": "可结合 RC 学习按键整形与迟滞。",
    "warning": "未用输入也要固定电平；输出会反相，不能当普通缓冲器。",
    "source": "https://www.ti.com/product/SN74HC14",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "bss138-level",
    "name": "BSS138 四路双向电平转换板",
    "category": "模拟与逻辑",
    "tags": [
      "3.3V",
      "5V",
      "I²C",
      "电平转换",
      "I2C"
    ],
    "description": "在低压和高压逻辑之间转换，常用于开漏 I²C 信号。",
    "pins": [
      "LV",
      "HV",
      "GND",
      "LV1…LV4",
      "HV1…HV4"
    ],
    "voltage": "该 Adafruit 板低侧可至 1.8V，高侧可至 10V",
    "guide": "低压接 LV，高压接 HV，双方共地，信号接对应通道。",
    "warning": "这是逻辑电平转换，不能给负载供电；上拉电阻限制高速信号表现。",
    "source": "https://www.adafruit.com/product/757?gQT=1",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ldr",
    "name": "光敏电阻 LDR",
    "category": "环境传感",
    "tags": [
      "光照",
      "ADC",
      "分压",
      "传感器",
      "输入"
    ],
    "description": "环境变亮时电阻通常下降，用分压把变化变成电压。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "无固定供电；用分压保证 ADC 电压范围",
    "guide": "与固定电阻组成分压器，比较遮挡前后的 ADC 数值。",
    "warning": "默认 lux 与阻值关系是教学近似，不是经过标定的照度计。",
    "source": "https://learn.adafruit.com/photocells/overview",
    "modelType": "ldr",
    "defaults": {
      "lux": 100
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pdv-p8103",
    "name": "Advanced Photonix PDV-P8103 光敏电阻",
    "category": "传感器",
    "tags": ["光照", "ADC", "分压", "输入"],
    "description": "陶瓷封装 CdS 光敏电阻。可改变环境照度，或直接在感光面加遮光片。",
    "pins": ["1", "2"],
    "voltage": "无源 · 分压供电须符合 ADC 输入范围",
    "guide": "与固定电阻串联，将中点接 ADC。光敏电阻在上端时，越暗中点电压越低。",
    "warning": "本模型使用 10 lx 的典型化阻值与一阶响应近似。照度和响应受光谱、个体及温度影响。",
    "source": "https://www.advancedphotonix.com/our-products/light-dependent-resistor-ldr/pdv-p8103",
    "modelType": "ldr",
    "defaults": {"ldrModel": "pdv-p8103", "lux": 20, "ldrCovered": false},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "thermistor",
    "name": "NTC 热敏电阻",
    "category": "环境传感",
    "tags": [
      "温度",
      "ADC",
      "分压",
      "传感器",
      "输入"
    ],
    "description": "温度升高时电阻下降，适合学习温度测量与非线性转换。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "按分压电路与自热功耗设计",
    "guide": "先测电压，再换算阻值，最后用对应曲线换算温度。",
    "warning": "默认 10kΩ/B3950 是教学参数；不同探头的 B 值、容差和封装不能混用。",
    "source": "https://learn.adafruit.com/thermistor/overview",
    "modelType": "thermistor",
    "defaults": {
      "temperature": 25,
      "beta": 3950,
      "resistance": 10000
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "mcp9808-5027",
    "name": "Adafruit 5027 · MCP9808 温度模块",
    "category": "环境传感",
    "tags": ["温度", "I²C", "I2C", "MCP9808", "STEMMA QT"],
    "description": "数字温度传感器。可从 0x05 寄存器读回正负温度，默认分辨率为 0.0625 °C。",
    "pins": ["VIN", "GND", "SDA", "SCL"],
    "voltage": "2.7–5.5 V。模块上的 SDA、SCL 各经 10 kΩ 上拉至 VIN。",
    "guide": "UNO R3 或经典 Nano 的 A4 接 SDA，A5 接 SCL。Mega 2560 使用 D20、D21。共地后从默认地址 0x18 读取两个温度字节。",
    "warning": "仿真支持寄存器读写和温度转换。Alert 与地址排针供观察，地址可在元件属性中设置。",
    "source": "https://www.adafruit.com/product/5027",
    "docs": [{"label":"原厂针脚与接线","url":"https://learn.adafruit.com/adafruit-mcp9808-precision-i2c-temperature-sensor-guide/pinouts","language":"英文"},{"label":"Microchip MCP9808 数据手册","url":"https://ww1.microchip.com/downloads/en/DeviceDoc/MCP9808-0.5C-Maximum-Accuracy-Digital-Temperature-Sensor-Data-Sheet-DS20005095B.pdf","language":"英文"}],
    "modelType": "mcp9808",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "dht22",
    "name": "DHT22 / AM2302 温湿度模块",
    "category": "环境传感",
    "tags": [
      "温湿度",
      "单线时序",
      "数字传感",
      "传感器",
      "输入"
    ],
    "description": "直接输出温度和湿度数字数据，适合环境监测入门。",
    "pins": [
      "VCC",
      "DATA",
      "GND"
    ],
    "voltage": "按所购模块手册；确认 DATA 上拉电源",
    "guide": "先使用厂家库低频读取，检查是否有校验失败。",
    "warning": "它的单数据线协议不是 Dallas 1-Wire；裸件与带板模块脚位不同。",
    "source": "https://learn.adafruit.com/dht/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ds18b20",
    "name": "DS18B20 数字温度传感器",
    "category": "环境传感",
    "tags": [
      "温度",
      "1-Wire",
      "多点测温",
      "传感器",
      "输入"
    ],
    "description": "多个传感器可共享 1-Wire 总线，以唯一地址区分。",
    "pins": [
      "GND",
      "DQ",
      "VDD"
    ],
    "voltage": "按 DS18B20 手册；DQ 需正确上拉",
    "guide": "初学先采用外部供电方式，再学习设备地址与温度转换等待。",
    "warning": "金属探头线色无统一标准；寄生供电方式有额外时序和供电要求。",
    "source": "https://www.analog.com/en/products/ds18b20.html",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "sht31",
    "name": "Adafruit SHT31-D 温湿度板",
    "category": "环境传感",
    "tags": [
      "温湿度",
      "I²C",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "用 I²C 读取温湿度，适合环境记录器。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "ADR",
      "ALR"
    ],
    "voltage": "按该转换板 Pinouts 的 VIN 与逻辑限制",
    "guide": "先扫描地址，再读取温度、湿度和状态。",
    "warning": "带板模块和裸芯片的供电范围不同；湿度传感表面不要接触水滴或污染物。",
    "source": "https://learn.adafruit.com/adafruit-sht31-d-temperature-and-humidity-sensor-breakout/pinouts",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "bme280",
    "name": "Adafruit BME280 三合一环境板",
    "category": "环境传感",
    "tags": [
      "温湿度",
      "气压",
      "I²C",
      "SPI",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "一次读取温度、湿度和气压，可做小气象站。",
    "pins": [
      "VIN",
      "GND",
      "SCK/SCL",
      "SDI/SDA",
      "SDO",
      "CS"
    ],
    "voltage": "该 Adafruit 转换板支持 3V/5V 电源与逻辑",
    "guide": "先选择 I²C 或 SPI 接法，再使用对应驱动。",
    "warning": "BMP280 不测湿度；不要只看外观把两种模块认成同一件。",
    "source": "https://learn.adafruit.com/adafruit-bme280-humidity-barometric-pressure-temperature-sensor-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "bmp280",
    "name": "Adafruit BMP280 温度气压板",
    "category": "环境传感",
    "tags": [
      "气压",
      "高度估算",
      "I²C",
      "SPI",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "测量气压与温度，通过参考气压估算相对高度。",
    "pins": [
      "VIN",
      "GND",
      "SCK/SCL",
      "SDI/SDA",
      "SDO",
      "CS"
    ],
    "voltage": "以该转换板 Pinouts 为准",
    "guide": "先读气压，记录变化后再尝试高度换算。",
    "warning": "它不带湿度测量；天气气压变化会影响绝对高度估算。",
    "source": "https://learn.adafruit.com/adafruit-bmp280-barometric-pressure-plus-temperature-sensor-breakout/pinouts",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "bh1750",
    "name": "Adafruit BH1750 光照板",
    "category": "环境传感",
    "tags": [
      "照度",
      "I²C",
      "环境光",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "以数字读数输出环境光强，比简单 LDR 更适合照度学习。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "ADDR"
    ],
    "voltage": "以该转换板电源和逻辑范围为准",
    "guide": "选择测量模式后等待转换完成，再读取数值。",
    "warning": "模块保护窗、入射角和安装位置都会影响测量。",
    "source": "https://learn.adafruit.com/adafruit-bh1750-ambient-light-sensor/pinouts",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "tsl2591",
    "name": "Adafruit TSL2591 光照板",
    "category": "环境传感",
    "tags": [
      "照度",
      "动态范围",
      "I²C",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "以不同增益和积分时间测量环境光，适合学习传感器量程。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "INT"
    ],
    "voltage": "以该转换板 Pinouts 为准",
    "guide": "先使用自动量程示例，再比较不同积分时间。",
    "warning": "太亮会饱和，太暗需更长积分；不能把一个固定转换系数用于所有设置。",
    "source": "https://learn.adafruit.com/adafruit-tsl2591/pinouts",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "mpu6050",
    "name": "Adafruit MPU6050 六轴运动板",
    "category": "运动与测距",
    "tags": [
      "加速度",
      "陀螺仪",
      "I²C",
      "IMU",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "同时测量三轴加速度和三轴角速度。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "INT",
      "AD0"
    ],
    "voltage": "该 Adafruit 板 VIN 与 I²C 逻辑支持 3–5V",
    "guide": "先保持静止测零偏，再转动观察各轴。",
    "warning": "MPU6050 没有磁力计；积分角速度会漂移，不能直接当绝对航向角。",
    "source": "https://learn.adafruit.com/mpu6050-6-dof-accelerometer-and-gyro?view=all",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "adxl345",
    "name": "Adafruit ADXL345 加速度板",
    "category": "运动与测距",
    "tags": [
      "三轴加速度",
      "I²C",
      "SPI",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "适合倾斜、振动和碰撞阈值实验。",
    "pins": [
      "VIN",
      "GND",
      "SCL/SCLK",
      "SDA/SDI",
      "SDO",
      "CS",
      "INT1",
      "INT2"
    ],
    "voltage": "该 Adafruit 板带稳压和电平转换，支持 3V/5V 系统",
    "guide": "先选量程，再静止检查重力在各轴上的分量。",
    "warning": "加速度同时包含运动加速度和重力；不能直接等同于位移。",
    "source": "https://learn.adafruit.com/adxl345-digital-accelerometer/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "lis3dh",
    "name": "Adafruit LIS3DH 加速度板",
    "category": "运动与测距",
    "tags": [
      "三轴加速度",
      "I²C",
      "SPI",
      "运动检测",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "小型三轴加速度传感器，适合运动唤醒和倾斜测量。",
    "pins": [
      "VIN",
      "GND",
      "SCL/SCK",
      "SDA/SDI",
      "SDO",
      "CS",
      "INT"
    ],
    "voltage": "按该模块电源与逻辑说明接线",
    "guide": "先读设备身份寄存器，再启用采样与中断。",
    "warning": "不同量程和模式的灵敏度不同；换设置后要同步修改换算。",
    "source": "https://learn.adafruit.com/adafruit-lis3dh-triple-axis-accelerometer-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "bno055",
    "name": "Adafruit BNO055 姿态融合板",
    "category": "运动与测距",
    "tags": [
      "姿态",
      "四元数",
      "I²C",
      "校准",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "板上进行多传感器融合，可输出方向和姿态。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "RST",
      "INT"
    ],
    "voltage": "按该 Adafruit 模块 Pinouts 接线",
    "guide": "先读校准状态，再使用四元数或欧拉角。",
    "warning": "磁场、安装方向和校准会影响结果；其 I²C 实现有兼容性注意事项。",
    "source": "https://learn.adafruit.com/adafruit-bno055-absolute-orientation-sensor/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "vl53l0x",
    "name": "Adafruit VL53L0X ToF 测距板",
    "category": "运动与测距",
    "tags": [
      "距离",
      "激光ToF",
      "I²C",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "通过光飞行时间估计距离，适合近距离感知。",
    "pins": [
      "VIN",
      "GND",
      "SCL",
      "SDA",
      "XSHUT",
      "GPIO"
    ],
    "voltage": "按该转换板 Pinouts 接线",
    "guide": "先做单传感器读取；多个同地址器件可借助 XSHUT 分别配置。",
    "warning": "目标反射率、环境光与窗口都会影响结果；不是无条件固定精度。",
    "source": "https://learn.adafruit.com/adafruit-vl53l0x-micro-lidar-distance-sensor-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "hcsr04",
    "name": "HC-SR04 四脚超声波测距模块",
    "category": "运动与测距",
    "tags": ["超声波", "回波", "脉宽", "距离", "传感器"],
    "description": "5 V 四脚测距模块。根据触发脉宽、目标距离和偏角生成回波时序。",
    "pins": ["VCC", "TRIG", "ECHO", "GND"],
    "voltage": "5 V 供电和 ECHO 电平",
    "guide": "先用 UNO R3 的超声波实验，试一试改变距离、偏角和触发时长。",
    "warning": "接到 3.3 V 输入前应按对应板卡规格处理 ECHO 电平。仿真采用单一理想反射目标。",
    "source": "https://www.elecfreaks.com/download/HC-SR04.pdf",
    "modelType": "hcsr04",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "grove-ultrasonic",
    "name": "Grove 超声波测距模块",
    "category": "运动与测距",
    "tags": [
      "超声波",
      "距离",
      "脉宽",
      "传感器",
      "输入"
    ],
    "description": "发送声波后测量回波时间，用于障碍物距离估算。",
    "pins": [
      "VCC",
      "GND",
      "SIG"
    ],
    "voltage": "V2 支持 3.3V 系统；按实物修订版核对",
    "guide": "Grove 的触发与回波共用 SIG；测量往返时间后除以二。",
    "warning": "它不是四脚 HC-SR04；目标材质、角度与温度影响距离，勿热插拔。",
    "source": "https://wiki.seeedstudio.com/Grove-Ultrasonic_Ranger/",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "pir",
    "name": "PIR 人体移动感应模块",
    "category": "运动与测距",
    "tags": [
      "人体移动",
      "红外",
      "数字输入",
      "传感器",
      "输入"
    ],
    "description": "检测红外变化，适合自动灯和移动提醒。",
    "pins": [
      "VCC",
      "OUT",
      "GND"
    ],
    "voltage": "按实际模块电源与 OUT 电平核对",
    "guide": "上电等待稳定后观察 OUT，高低电平对应触发状态。",
    "warning": "通常检测运动，不能可靠判断静止的人是否还在。",
    "source": "https://learn.adafruit.com/pir-passive-infrared-proximity-motion-sensor/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "fsr",
    "name": "FSR 薄膜压力传感器",
    "category": "运动与测距",
    "tags": [
      "压力",
      "ADC",
      "分压",
      "传感器",
      "输入"
    ],
    "description": "受力时电阻改变，适合按钮压力和接触检测。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "用分压读取，不直接施加大电流",
    "guide": "先记录无压力与轻压读数，再决定阈值。",
    "warning": "它更适合趋势和阈值，不能未经校准就当精密电子秤。",
    "source": "https://learn.adafruit.com/force-sensitive-resistor-fsr/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "hx711",
    "name": "HX711 称重放大器板",
    "category": "运动与测距",
    "tags": [
      "称重",
      "桥式传感",
      "24位ADC",
      "传感器",
      "输入"
    ],
    "description": "把称重桥很小的电压差放大并数字化。",
    "pins": [
      "VCC",
      "VDD",
      "GND",
      "DAT",
      "CLK",
      "E+",
      "E-",
      "A+",
      "A-"
    ],
    "voltage": "SparkFun 板的模拟 VCC 与数字 VDD 可分开；其他板需核对",
    "guide": "接好称重桥，先去皮，再使用已知砝码标定比例。",
    "warning": "称重传感器线色不统一；24 位输出不代表 24 位有效精度。",
    "source": "https://learn.sparkfun.com/tutorials/load-cell-amplifier-hx711-breakout-hookup-guide",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ina219",
    "name": "Adafruit INA219 电流电压板",
    "category": "测量与转换",
    "tags": [
      "电流",
      "电压",
      "I²C",
      "功率",
      "I2C",
      "传感器",
      "输入"
    ],
    "description": "通过分流电阻测量负载电流，并读取总线电压。",
    "pins": [
      "VCC",
      "GND",
      "SCL",
      "SDA",
      "VIN+",
      "VIN-"
    ],
    "voltage": "逻辑供电与被测母线范围分别按模块手册核对",
    "guide": "VIN+、VIN- 串在负载供电路径中，先选择合适量程。",
    "warning": "接反会改变电流符号；板载分流电阻功率限制不能忽略。",
    "source": "https://learn.adafruit.com/adafruit-ina219-current-sensor-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "max4466",
    "name": "MAX4466 模拟麦克风放大板",
    "category": "测量与转换",
    "tags": [
      "声音",
      "ADC",
      "模拟音频",
      "传感器",
      "输入"
    ],
    "description": "把麦克风微弱信号放大，输出带直流偏置的音频电压。",
    "pins": [
      "VCC",
      "GND",
      "OUT"
    ],
    "voltage": "按该板供电范围；OUT 不能超过 ADC 范围",
    "guide": "先观察安静与拍手的峰峰值，再学习采样率。",
    "warning": "输出不是声音识别结果；不能把一个瞬时 ADC 数值当作标准分贝。",
    "source": "https://learn.adafruit.com/adafruit-microphone-amplifier-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "soil-cap",
    "name": "DFRobot SEN0193 电容土壤湿度板",
    "category": "环境传感",
    "tags": [
      "土壤",
      "ADC",
      "电容感应",
      "传感器",
      "输入"
    ],
    "description": "以电容变化感知土壤含水状态，适合植物浇灌实验。",
    "pins": [
      "VCC",
      "GND",
      "SIG"
    ],
    "voltage": "供电 3.3–5.5V；模拟输出约 0–3.0V",
    "guide": "在空气和水或目标土壤状态下标定，然后使用相对湿度区间。",
    "warning": "读数不是直接的土壤含水百分比；探头上方电子元件不可浸水。",
    "source": "https://wiki.dfrobot.com/sen0193/",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ssd1306",
    "name": "Adafruit 326 · SSD1306 OLED",
    "category": "显示与声音",
    "tags": [
      "OLED",
      "I²C",
      "128×64",
      "I2C",
      "单色图形"
    ],
    "description": "0.96 英寸单色屏，用 SSD1306 显示内存中的字节更新像素。",
    "pins": [
      "VIN",
      "GND",
      "SDA",
      "SCL"
    ],
    "voltage": "此模块的 VIN 为 3–5 V，信号上拉至 VIN。",
    "guide": "UNO R3 或经典 Nano 的 A4 接 SDA，A5 接 SCL。Mega 2560 使用 D20、D21。VIN 和 GND 负责供电。出厂地址为 0x3D，可在元件属性中模拟闭合地址焊桥切换到 0x3C。",
    "warning": "当前实验支持 Arduino 源码的 I²C 写入和常用 SSD1306 命令。模块上其他排针与侧面的插座供观察。",
    "source": "https://www.adafruit.com/product/326",
    "docs": [{"label":"接线与地址","url":"https://learn.adafruit.com/monochrome-oled-breakouts/wiring-128x64-oleds","language":"英文"},{"label":"SSD1306 控制器数据手册","url":"https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf","language":"英文"}],
    "modelType": "ssd1306",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "lcd1602",
    "name": "LCD1602 字符液晶",
    "category": "显示与声音",
    "tags": [
      "LCD",
      "字符",
      "并行接口",
      "I2C",
      "输出"
    ],
    "description": "两行各 16 个字符，适合显示数字和状态。",
    "pins": [
      "VSS",
      "VDD",
      "VO",
      "RS",
      "RW",
      "E",
      "D0…D7",
      "A",
      "K"
    ],
    "voltage": "按具体显示器与背光规格供电",
    "guide": "先调对比度 VO，再使用 4 位并行模式输出文字。",
    "warning": "裸 LCD 与带 I²C 背包版本不同；背光是否已有电阻要查模块。",
    "source": "https://learn.adafruit.com/adafruit-arduino-lesson-11-lcd-displays-1/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "st7789",
    "name": "Adafruit 1.14寸 TFT 彩屏",
    "category": "显示与声音",
    "tags": [
      "彩色LCD",
      "SPI",
      "ST7789",
      "240×135",
      "输出"
    ],
    "description": "适合绘制仪表、图标和传感曲线。",
    "pins": [
      "VIN",
      "GND",
      "SCK",
      "MOSI",
      "CS",
      "DC",
      "RST",
      "LITE"
    ],
    "voltage": "该 Adafruit 转换板支持 3.3V/5V 电源与逻辑",
    "guide": "先运行指定屏幕分辨率的库示例，再调整旋转方向。",
    "warning": "其他 ST7789 裸屏不一定带电平转换；分辨率和显示偏移要与型号对应。",
    "source": "https://learn.adafruit.com/adafruit-1-14-240x135-color-tft-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "sevenseg",
    "name": "单个七段数码管 · SC56-11EWA 封装",
    "category": "显示与声音",
    "tags": [
      "数码管",
      "GPIO",
      "分段显示",
      "输出"
    ],
    "description": "用 a–g 七段和小数点组合数字。按 Kingbright SC56-11EWA 的十脚封装建模，可跨沟槽插入面包板。",
    "pins": [
      "1 · e",
      "2 · d",
      "3 · COM",
      "4 · c",
      "5 · dp",
      "6 · b",
      "7 · a",
      "8 · COM2",
      "9 · f",
      "10 · g"
    ],
    "voltage": "每段独立串联限流电阻；默认共阴极",
    "guide": "3 脚和 8 脚内部相通。共阴极接地，从 a–g 选段点亮；每段单独串联电阻。",
    "warning": "SC56-11EWA 是共阴极。属性中的共阳极选项用于模拟同脚序的共阳封装。",
    "source": "https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf",
    "modelType": "sevenseg",
    "defaults": {
      "common": "cathode",
      "maxMa": 20
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "tm1637",
    "name": "Grove TM1637 四位数码管",
    "category": "显示与声音",
    "tags": [
      "数字显示",
      "TM1637",
      "两线串行",
      "I2C",
      "输出"
    ],
    "description": "自带扫描驱动，用两根信号线控制四位数字。",
    "pins": [
      "VCC",
      "GND",
      "DIO",
      "CLK"
    ],
    "voltage": "该 Grove 模块支持 3.3V/5V 系统",
    "guide": "先用厂家库设置亮度并显示计数，再尝试小数点。",
    "warning": "DIO/CLK 的两线协议不是 I²C；不要交给通用 I²C 驱动。",
    "source": "https://wiki.seeedstudio.com/Grove-4-Digit_Display/",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "neopixel",
    "name": "WS2812 / NeoPixel 可寻址灯",
    "category": "显示与声音",
    "tags": [
      "RGB",
      "灯带",
      "单线时序",
      "输出"
    ],
    "description": "每颗灯保存自己的颜色值，能串接制作灯带效果。",
    "pins": [
      "VDD",
      "GND",
      "DIN",
      "DOUT"
    ],
    "voltage": "按灯的具体型号与供电电压核对数据高电平阈值",
    "guide": "从一颗低亮度灯开始，再增加数量并计算电源预算。",
    "warning": "灯带不能由 GPIO 供电；WS2812 各修订版时序和阈值可能不同。",
    "source": "https://learn.adafruit.com/adafruit-neopixel-uberguide/the-magic-of-neopixels",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "buzzer",
    "name": "有源蜂鸣器 · 教学模型",
    "category": "显示与声音",
    "tags": [
      "报警",
      "声音",
      "GPIO",
      "输出"
    ],
    "description": "内部带振荡电路，通电即可发出固定音调。",
    "pins": [
      "+",
      "-"
    ],
    "voltage": "参考有源模块支持 3–5V；模型为简化等效负载",
    "guide": "先通过开关控制响与停，再做定时报警。",
    "warning": "不能把有源蜂鸣器当作任意音高扬声器；较大电流型号需要驱动管。",
    "source": "https://learn.adafruit.com/products/1536/guides",
    "modelType": "buzzer",
    "defaults": {
      "resistance": 1000
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "piezo",
    "name": "无源压电蜂鸣片",
    "category": "显示与声音",
    "tags": [
      "音调",
      "PWM",
      "频率",
      "输出"
    ],
    "description": "需要变化的电压才能持续发声，适合旋律与频率实验。",
    "pins": [
      "1",
      "2"
    ],
    "voltage": "按具体压电片的峰峰值要求驱动",
    "guide": "用 tone 或定时器产生方波，再改变频率比较音高。",
    "warning": "持续直流一般不能发出持续音调；与有源蜂鸣器模型不同。",
    "source": "https://learn.adafruit.com/using-piezo-buzzers-with-circuitpython-arduino/hardware",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "servo",
    "name": "位置舵机 · 教学模型",
    "category": "驱动与执行",
    "tags": [
      "舵机",
      "PWM",
      "角度",
      "机器人",
      "输出"
    ],
    "description": "根据控制脉宽移动到目标角度，适合机器人关节练习。",
    "pins": [
      "VCC",
      "GND",
      "SIG"
    ],
    "voltage": "供电按所购舵机规格；信号与电源必须共地",
    "guide": "先用中位脉宽，再在安全行程内改变角度。",
    "warning": "默认角度模型不代表真实 SG90 的扭矩、堵转电流或机械极限；勿由 GPIO 供电。",
    "source": "https://learn.adafruit.com/adafruit-arduino-lesson-14-servo-motors/overview",
    "modelType": "servo",
    "defaults": {
      "angle": 90
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "motor",
    "name": "直流有刷电机 · 教学模型",
    "category": "驱动与执行",
    "tags": [
      "电机",
      "转速",
      "惯性",
      "反电动势",
      "输出"
    ],
    "description": "观察电压、转速和反电动势的关系。",
    "pins": [
      "+",
      "-"
    ],
    "voltage": "按真实电机额定电压和堵转电流选择驱动",
    "guide": "先接独立电源观察，再通过驱动器控制方向与速度。",
    "warning": "默认电阻、惯性和反电动势常数只是教学参数，不对应某款真实电机。",
    "source": "https://learn.adafruit.com/adafruit-arduino-lesson-13-dc-motors/overview",
    "modelType": "motor",
    "defaults": {
      "resistance": 20,
      "backEmf": 0.0016,
      "inertia": 0.000001
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "fa130-18100",
    "name": "Mabuchi FA-130RA-18100 · 3 V 电机",
    "category": "驱动与执行",
    "tags": ["直流电机", "反电动势", "滑行", "刹车", "FA-130"],
    "description": "按原厂尺寸制作金属外壳、焊片和可动转轴。3 V 空载转速标称 12,300 rpm。",
    "pins": ["+", "-"],
    "voltage": "标称 3 V，原厂范围 1.5–3.0 V",
    "guide": "用独立电源和电机驱动器供电。分别观察绕组电流、转速和切换方向的过程。",
    "warning": "原厂 3 V 堵转电流为 2.10 A。仿真采用空载机电近似，实物需按启动电流选型。",
    "source": "https://product.mabuchi-motor.com/detail.html?id=10",
    "modelType": "motor",
    "defaults": {"motorModel":"fa130-18100"},
    "support": "simulate",
    "checked_on": "2026-11-07"
  },
  {
    "id": "stepper",
    "name": "小型减速步进电机",
    "category": "驱动与执行",
    "tags": [
      "步进",
      "相序",
      "定位",
      "输出"
    ],
    "description": "按顺序给线圈通电，转子就以小步移动。",
    "pins": [
      "线圈端子（按型号）"
    ],
    "voltage": "供电与相电流按电机规格；需驱动器",
    "guide": "先确认线圈和相序，再尝试慢速单方向转动。",
    "warning": "单极与双极电机接法不同；标称步距还要考虑减速箱比。",
    "source": "https://learn.adafruit.com/adafruit-arduino-lesson-16-stepper-motors/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "relay",
    "name": "Seeed Grove 继电器 V1.2",
    "category": "驱动与执行",
    "tags": [
      "继电器",
      "电气隔离",
      "开关",
      "输出"
    ],
    "description": "高电平控制 HLS8L 继电器的常开触点。红色指示灯显示驱动状态，螺丝端子可接独立负载回路。",
    "pins": [
      "SIG",
      "NC",
      "VCC",
      "GND",
      "COM",
      "NO"
    ],
    "voltage": "模块 VCC 为 3.3–5 V。实验使用 5 V 控制侧电源和独立 3.3 V 灯回路。",
    "guide": "按 SIG、NC、VCC、GND 接控制侧。负载通过螺丝端子的 COM 和 NO 串联。",
    "warning": "Grove 插座上的 NC 是空脚。两孔负载端子只引出常开触点。",
    "source": "https://wiki.seeedstudio.com/Grove-Relay/",
    "modelType": "grove-relay",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-06"
  },
  {
    "id": "uln2003",
    "name": "ULN2003A 七路达林顿驱动",
    "category": "驱动与执行",
    "tags": [
      "线圈驱动",
      "步进电机",
      "低侧开关",
      "输出"
    ],
    "description": "把逻辑信号变成可驱动较大负载的低侧开关。",
    "pins": [
      "IN1…IN7",
      "OUT1…OUT7",
      "GND",
      "COM"
    ],
    "voltage": "逻辑与负载按 TI 手册；COM 用于续流钳位",
    "guide": "先从一路低压负载开始，理解输出只拉低、不主动供电。",
    "warning": "不能把单路峰值直接乘以七路；总功耗、压降和散热仍有限制。",
    "source": "https://www.ti.com/product/ULN2003A",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "drv8833",
    "name": "Pololu 2130 · DRV8833 双 H 桥",
    "category": "驱动与执行",
    "tags": [
      "直流电机",
      "H桥",
      "正反转",
      "输出"
    ],
    "description": "两路 H 桥分别驱动直流电机，可比较正转、反转、滑行和短刹。",
    "pins": [
      "GND2", "VMM", "BIN1", "BIN2", "AIN2", "AIN1", "SLP", "FLT",
      "GND", "VIN", "BOUT1", "BOUT2", "AOUT2", "AOUT1", "AISEN", "BISEN"
    ],
    "voltage": "芯片工作电源 2.7–10.8V；按模块散热能力确定电流",
    "guide": "VIN 接电机电源。开发板和驱动板共地。00 滑行，10 正转，01 反转，11 电刹车。",
    "warning": "仿真聚焦两路静态输入、导通电阻与电机反电动势。真实选型需核对堵转电流、散热和保护行为。",
    "source": "https://www.pololu.com/product/2130",
    "docs": [{"label":"TI 芯片规格","url":"https://www.ti.com/lit/ds/symlink/drv8833.pdf","language":"EN"}],
    "modelType": "drv8833",
    "defaults": {},
    "support": "simulate",
    "checked_on": "2026-11-06"
  },
  {
    "id": "tb6612",
    "name": "Adafruit TB6612 双 H 桥板",
    "category": "驱动与执行",
    "tags": [
      "直流电机",
      "步进电机",
      "PWM",
      "输出"
    ],
    "description": "逻辑电源和电机电源分开，支持双向电机控制。",
    "pins": [
      "VCC",
      "VM",
      "GND",
      "AIN1",
      "AIN2",
      "PWMA",
      "BIN1",
      "BIN2",
      "PWMB",
      "STBY",
      "AO1",
      "AO2",
      "BO1",
      "BO2"
    ],
    "voltage": "该板逻辑 2.7–5V，电机电源 4.5–13.5V",
    "guide": "先设置 STBY 与方向，再输入 PWM 占空比。",
    "warning": "电机电源不能接 MCU 信号脚；3V 电机不适合直接套用该板建议供电范围。",
    "source": "https://learn.adafruit.com/adafruit-tb6612-h-bridge-dc-stepper-motor-driver-breakout/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "a4988",
    "name": "Pololu A4988 步进驱动板",
    "category": "驱动与执行",
    "tags": [
      "步进电机",
      "细分",
      "限流",
      "STEP/DIR",
      "输出"
    ],
    "description": "通过 STEP/DIR 控制双极步进电机，带可调相电流限制。",
    "pins": [
      "VMOT",
      "GND",
      "VDD",
      "STEP",
      "DIR",
      "ENABLE",
      "MS1",
      "MS2",
      "MS3",
      "RESET",
      "SLEEP",
      "1A",
      "1B",
      "2A",
      "2B"
    ],
    "voltage": "电机电源 8–35V；逻辑 3–5.5V",
    "guide": "先按实际采样电阻设置限流，再接电机测试低速转动。",
    "warning": "切勿带电插拔电机；连续电流取决于散热，不能只看 2A 芯片峰值。",
    "source": "https://www.pololu.com/product/1182/specs?coupon=LD26C120",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "power",
    "name": "直流电源 · 教学模型",
    "category": "电源与接口",
    "tags": [
      "供电",
      "共地",
      "电压"
    ],
    "description": "给电路提供设定电压，是观察电压和电流的起点。",
    "pins": [
      "+",
      "-"
    ],
    "voltage": "默认 5V，可按实验需要调整",
    "guide": "先确认各器件允许电压，再接正负极；多块电路要明确参考地。",
    "warning": "理想电源模型不等于真实限流电源；不要并联不同电压的电源输出。",
    "source": "https://learn.adafruit.com/breadboards-for-beginners/breadboards",
    "modelType": "power",
    "defaults": {
      "voltage": 5
    },
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "lm2596",
    "name": "LM2596 降压转换器参考",
    "category": "电源与接口",
    "tags": [
      "DC-DC",
      "降压",
      "供电"
    ],
    "description": "将较高直流电压转换成较低电压，适合学习电源模块。",
    "pins": [
      "VIN+",
      "VIN-",
      "VOUT+",
      "VOUT-"
    ],
    "voltage": "芯片系列输入 4.5–40V；实际模块额定范围可能更窄",
    "guide": "先空载测量并调好输出，再连接开发板。",
    "warning": "降压板不是升压板；模块电容、二极管、电感和散热限制不能用芯片 3A 标签替代。",
    "source": "https://www.ti.com/product/LM2596",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ads1115",
    "name": "Adafruit ADS1115 16位 ADC 板",
    "category": "测量与转换",
    "tags": [
      "ADC",
      "I²C",
      "差分",
      "PGA",
      "I2C"
    ],
    "description": "给 MCU 增加 4 路单端或 2 路差分模拟测量。",
    "pins": [
      "VDD",
      "GND",
      "SCL",
      "SDA",
      "ADDR",
      "ALERT",
      "A0",
      "A1",
      "A2",
      "A3"
    ],
    "voltage": "器件供电 2.0–5.5V；输入仍必须满足供电边界",
    "guide": "先用电位器测单端输入，再设置增益和采样率。",
    "warning": "可选量程不代表能输入超过电源的电压；16 位不等于 16 位绝对准确度。",
    "source": "https://learn.adafruit.com/adafruit-4-channel-adc-breakouts/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "mcp4725",
    "name": "MCP4725 12位 DAC 板",
    "category": "测量与转换",
    "tags": [
      "DAC",
      "I²C",
      "模拟输出",
      "I2C"
    ],
    "description": "把数字值转换为模拟电压，可学习波形与参考输出。",
    "pins": [
      "VCC",
      "GND",
      "SCL",
      "SDA",
      "OUT",
      "ADDR"
    ],
    "voltage": "参考板支持 3.3V/5V；输出范围由 VDD 决定",
    "guide": "先输出 0、中点、满量程，测量电压与数字值的关系。",
    "warning": "不能直接驱动大负载；频繁写 EEPROM 与普通 DAC 更新是不同操作。",
    "source": "https://learn.adafruit.com/mcp4725-12-bit-dac-tutorial/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "ds3231",
    "name": "DS3231 实时时钟",
    "category": "存储与通信",
    "tags": [
      "RTC",
      "I²C",
      "计时",
      "后备电池",
      "I2C"
    ],
    "description": "主板断电后仍可依靠后备电池保存时间。",
    "pins": [
      "VCC",
      "GND",
      "SDA",
      "SCL",
      "INT/SQW",
      "32K",
      "VBAT"
    ],
    "voltage": "按芯片和具体模块的主电源、后备电池要求核对",
    "guide": "先设置一次时间，再读取日期和时分秒。",
    "warning": "某些模块有充电电路；一次性纽扣电池不能接到会对其充电的电路。",
    "source": "https://www.analog.com/en/products/ds3231.html",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "microsd",
    "name": "Adafruit microSD SPI / SDIO 板",
    "category": "存储与通信",
    "tags": [
      "SD卡",
      "SPI",
      "SDIO",
      "文件系统"
    ],
    "description": "把测量结果存成文件，也能读取图片、配置和音频。",
    "pins": [
      "3V",
      "GND",
      "CLK",
      "CMD/MOSI",
      "D0/MISO",
      "D1",
      "D2",
      "D3/CS"
    ],
    "voltage": "该板只支持 3.3V 电源与逻辑，无 5V 转换",
    "guide": "入门先用 SPI 模式挂载文件系统，写入一行后关闭文件。",
    "warning": "它与带稳压和电平转换的 5V SD 模块不同；拔卡前要结束写入。",
    "source": "https://learn.adafruit.com/adafruit-microsd-spi-sdio/overview",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "sn65hvd230",
    "name": "SN65HVD230 CAN 收发器",
    "category": "存储与通信",
    "tags": [
      "CAN",
      "差分总线",
      "工业通信"
    ],
    "description": "把 MCU 的 CAN 逻辑信号变成 CANH/CANL 差分电平。",
    "pins": [
      "VCC",
      "GND",
      "D/TXD",
      "R/RXD",
      "CANH",
      "CANL",
      "RS"
    ],
    "voltage": "芯片工作电源 3.0–3.6V",
    "guide": "确认 MCU 自带 CAN 控制器，正确连接总线端接电阻。",
    "warning": "它只是收发器，不会给没有 CAN 控制器的 MCU 自动增加 CAN 协议能力。",
    "source": "https://www.ti.com/product/SN65HVD230",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "max485",
    "name": "MAX485 RS-485 收发器",
    "category": "存储与通信",
    "tags": [
      "RS485",
      "UART",
      "半双工",
      "差分总线"
    ],
    "description": "把 UART 数据转换成适合较长线路的差分信号。",
    "pins": [
      "VCC",
      "GND",
      "RO",
      "RE",
      "DE",
      "DI",
      "A",
      "B"
    ],
    "voltage": "MAX485 使用 5V；3.3V MCU 需核对接收输出兼容性",
    "guide": "先两节点短线验证方向控制，再考虑终端和偏置。",
    "warning": "UART、RS-485 电气层、Modbus 协议是不同层；各厂家 A/B 标法需核对。",
    "source": "https://www.analog.com/en/products/max485.html",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "cp2102",
    "name": "CP2102 USB 转 UART 参考",
    "category": "电源与接口",
    "tags": [
      "USB",
      "串口",
      "调试"
    ],
    "description": "让电脑通过 USB 与 MCU 串口交换数据。",
    "pins": [
      "USB",
      "TXD",
      "RXD",
      "GND",
      "电源（依模块）"
    ],
    "voltage": "CP2102 逻辑与模块供电输出分别核对",
    "guide": "TXD 接对方 RX，RXD 接对方 TX，双方共地并设置同样波特率。",
    "warning": "模块标出的 5V 供电脚不代表 TX/RX 为 5V，也不能直接连接 RS-232 电平。",
    "source": "https://www.silabs.com/interface/usb-bridges/classic/device.cp2102",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  },
  {
    "id": "stlink",
    "name": "ST-LINK/V2 调试下载器",
    "category": "电源与接口",
    "tags": [
      "SWD",
      "JTAG",
      "下载",
      "调试"
    ],
    "description": "通过调试接口烧录程序、查看变量和设置断点。",
    "pins": [
      "VTREF",
      "SWDIO",
      "SWCLK",
      "GND",
      "NRST"
    ],
    "voltage": "目标参考电压与接线按官方手册",
    "guide": "先核对目标板供电，再接 SWDIO、SWCLK 和 GND；需要时连接复位。",
    "warning": "官方 ST-LINK/V2 与常见小棒外形克隆的排针定义不一定相同。",
    "source": "https://www.st.com/en/development-tools/st-link-v2.html",
    "modelType": null,
    "defaults": {},
    "support": "reference",
    "checked_on": "2026-11-06"
  }
];
export const EXTRA_RESOURCES = [
  {
    "id": "extra-st-cubemx-zh",
    "title": "STM32CubeMX：中文官方入口",
    "author": "STMicroelectronics",
    "type": "link",
    "category": "ST官方中文",
    "url": "https://www.st.com.cn/zh/development-tools/stm32cubemx.html",
    "source_page": "https://www.st.com.cn/zh/development-tools/stm32cubemx.html",
    "description": "用图形界面配置引脚、时钟和外设，生成初始化代码工程。",
    "learning_stage": "认识开发工具",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先理解“选芯片→配引脚→配时钟→生成工程”。代码生成目标包括 MDK-ARM 和 STM32CubeIDE；具体版本支持以下载说明为准。",
    "family": "STM32",
    "tags": [
      "官方",
      "中文",
      "CubeMX",
      "引脚配置",
      "Keil"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-st-cubeide-zh",
    "title": "STM32CubeIDE：中文官方入口",
    "author": "STMicroelectronics",
    "type": "link",
    "category": "ST官方中文",
    "url": "https://www.st.com.cn/zh/development-tools/stm32cubeide.html",
    "source_page": "https://www.st.com.cn/zh/development-tools/stm32cubeide.html",
    "description": "STM32 代码编辑、构建和调试工具的官方入口。",
    "learning_stage": "建立第一个工程",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先安装对应平台版本，再跟随板级示例完成编译；看懂错误信息后再接真实硬件调试。",
    "family": "STM32",
    "tags": [
      "官方",
      "中文",
      "CubeIDE",
      "编译",
      "调试"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-st-programmer-zh",
    "title": "STM32CubeProgrammer：中文官方入口",
    "author": "STMicroelectronics",
    "type": "link",
    "category": "ST官方中文",
    "url": "https://www.st.com.cn/zh/development-tools/stm32cubeprog.html",
    "source_page": "https://www.st.com.cn/zh/development-tools/stm32cubeprog.html",
    "description": "用于芯片连接、程序烧录和内存操作的工具说明。",
    "learning_stage": "把程序烧录到板上",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "把“编辑代码”“编译固件”“烧录芯片”分成三步理解。先看连接方式，不要随意改保护选项。",
    "family": "STM32",
    "tags": [
      "官方",
      "中文",
      "烧录",
      "ST-LINK"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-st-step-by-step",
    "title": "ST：STM32 分步入门教程",
    "author": "STMicroelectronics",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://wiki.st.com/stm32mcu/wiki/STM32StepByStep%3ASTM32_step_by_step_overview",
    "source_page": "https://wiki.st.com/stm32mcu/wiki/STM32StepByStep%3ASTM32_step_by_step_overview",
    "description": "从安装工具、LED 到传感器和通信的官方实践路线。",
    "learning_stage": "从点灯开始",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "教程使用指定 Nucleo/Discovery 板。先抄学习顺序，换板时重新核对 LED 引脚和外设。",
    "family": "STM32",
    "tags": [
      "官方",
      "HAL",
      "GPIO",
      "学习路线"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-st-nucleo64",
    "title": "UM1724：Nucleo-64 MB1136 用户手册",
    "author": "STMicroelectronics",
    "type": "link",
    "category": "官方英文手册",
    "url": "https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf",
    "source_page": "https://www.st.com/resource/en/user_manual/dm00105823-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf",
    "description": "说明对应 Nucleo-64 板的供电、跳线、连接器与 ST-LINK。",
    "learning_stage": "认识真实板子",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先找到自己的板号与版本，再看电源跳线、Arduino 接口、Morpho 接口；不能套用到全部 Nucleo。",
    "family": "STM32",
    "tags": [
      "官方",
      "PDF原文",
      "Nucleo",
      "接线",
      "供电"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-esp-idf-zh",
    "title": "ESP-IDF 快速入门（中文）",
    "author": "Espressif",
    "type": "link",
    "category": "官方中文教程",
    "url": "https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32/get-started/index.html",
    "source_page": "https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32/get-started/index.html",
    "description": "安装 ESP-IDF，构建、烧录并监视第一个项目。",
    "learning_stage": "第一次使用 ESP32",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先看顶部芯片与版本选择；ESP32、C3、S3 的目标芯片参数不同。完整 ESP-IDF 工程请在本地工具链构建。",
    "family": "ESP32",
    "tags": [
      "官方",
      "中文",
      "ESP-IDF",
      "工具链"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-esp-idf-en",
    "title": "ESP-IDF Get Started（英文对照）",
    "author": "Espressif",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/index.html",
    "source_page": "https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/index.html",
    "description": "与中文指南配合查阅的官方英文入口。",
    "learning_stage": "查阅原文与版本",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "遇到中文术语不理解时，对照 build、flash、monitor 三个动作。",
    "family": "ESP32",
    "tags": [
      "官方",
      "英文",
      "ESP-IDF",
      "对照阅读"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-esp-arduino",
    "title": "Arduino-ESP32 Core 官方文档",
    "author": "Espressif",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://docs.espressif.com/projects/arduino-esp32/en/latest/",
    "source_page": "https://docs.espressif.com/projects/arduino-esp32/en/latest/",
    "description": "在 ESP32 上使用 Arduino API 的安装、外设和迁移说明。",
    "learning_stage": "从 Arduino 转向 ESP32",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "确认已安装的 Core 大版本。示例在版本间可能调整，尤其是 LEDC、I²S 与网络 API。",
    "family": "ESP32",
    "tags": [
      "官方",
      "Arduino",
      "API",
      "迁移"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-esp-devkit",
    "title": "ESP32-DevKitC V4 用户指南",
    "author": "Espressif",
    "type": "link",
    "category": "官方英文手册",
    "url": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
    "source_page": "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html",
    "description": "核对模块类型、供电选择和排针功能。",
    "learning_stage": "接线前查引脚",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先看模组丝印，再查对应引脚表。内部 Flash 占用的引脚不能当普通引脚随意接线。",
    "family": "ESP32",
    "tags": [
      "官方",
      "DevKitC",
      "引脚图",
      "供电"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-arduino-language",
    "title": "Arduino 语言参考",
    "author": "Arduino",
    "type": "link",
    "category": "官方英文手册",
    "url": "https://docs.arduino.cc/language-reference/",
    "source_page": "https://docs.arduino.cc/language-reference/",
    "description": "按数字输入输出、模拟、时间、通信等主题查函数。",
    "learning_stage": "写代码时查 API",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "每次只查当前使用的函数：它需要什么参数，返回什么结果，有什么限制。",
    "family": "Arduino",
    "tags": [
      "官方",
      "函数参考",
      "digitalWrite",
      "analogRead",
      "Serial"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-arduino-ide",
    "title": "Arduino IDE 官方使用指南",
    "author": "Arduino",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://docs.arduino.cc/software/ide/",
    "source_page": "https://docs.arduino.cc/software/ide/",
    "description": "包含安装板卡包、编译上传、自动补全、串口与调试。",
    "learning_stage": "本地 IDE 入门",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先完成选板与选端口，再运行 Blink。平台导出的 sketch 需要本地安装匹配的板卡包和库。",
    "family": "Arduino",
    "tags": [
      "官方",
      "IDE",
      "自动补全",
      "串口",
      "安装"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-pico-sdk",
    "title": "Raspberry Pi Pico C/C++ SDK 官方入口",
    "author": "Raspberry Pi",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://www.raspberrypi.com/documentation/microcontrollers/c_sdk.html",
    "source_page": "https://www.raspberrypi.com/documentation/microcontrollers/c_sdk.html",
    "description": "从 SDK 安装到 Pico 系列 C/C++ 工程构建和 API 文档。",
    "learning_stage": "Pico 的 C/C++ 开发",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "选择正确的 PICO_BOARD；Pico、Pico W、Pico 2 并不是可完全互换的编译目标。",
    "family": "RP2040 / RP2350",
    "tags": [
      "官方",
      "C/C++",
      "SDK",
      "Pico"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-pico-micropython",
    "title": "Pico MicroPython 安装与起步",
    "author": "Raspberry Pi",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://www.raspberrypi.com/documentation/microcontrollers/micropython.html",
    "source_page": "https://www.raspberrypi.com/documentation/microcontrollers/micropython.html",
    "description": "选择对应固件，通过 BOOTSEL 安装并开始运行 MicroPython。",
    "learning_stage": "用 Python 点亮第一盏灯",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先下载与具体板型匹配的 UF2，再认识 REPL。MicroPython 代码不能直接当 C/C++ 工程编译。",
    "family": "RP2040 / RP2350",
    "tags": [
      "官方",
      "Python",
      "UF2",
      "BOOTSEL"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-micropython-rp2",
    "title": "MicroPython RP2 快速参考",
    "author": "MicroPython 项目",
    "type": "link",
    "category": "官方英文手册",
    "url": "https://docs.micropython.org/en/latest/rp2/quickref.html",
    "source_page": "https://docs.micropython.org/en/latest/rp2/quickref.html",
    "description": "集中查阅 RP2 平台的 GPIO、ADC、PWM、总线与网络用法。",
    "learning_stage": "Python 外设编程",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先确认固件版本，再看 Pin、ADC、PWM 示例；latest 文档可能覆盖尚未安装的新功能。",
    "family": "RP2040 / RP2350",
    "tags": [
      "官方",
      "Python",
      "GPIO",
      "PWM",
      "I²C"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-microbit-start",
    "title": "micro:bit 官方入门路线",
    "author": "Micro:bit Educational Foundation",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://microbit.org/get-started/getting-started/introduction/",
    "source_page": "https://microbit.org/get-started/getting-started/introduction/",
    "description": "从通电试玩到编程与课堂项目的分步引导。",
    "learning_stage": "零基础认识开发板",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先体验内置按钮、点阵与传感器，再接外部器件；区分 V1 与 V2 的硬件差异。",
    "family": "micro:bit",
    "tags": [
      "官方",
      "入门",
      "MakeCode",
      "Python"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-teensyduino",
    "title": "Teensyduino 安装与 Arduino 配置",
    "author": "PJRC",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://www.pjrc.com/teensy/td_download.html",
    "source_page": "https://www.pjrc.com/teensy/td_download.html",
    "description": "PJRC 维护的 Teensy 编译环境安装与版本信息。",
    "learning_stage": "开始使用 Teensy",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "按当前 Arduino IDE 版本使用对应安装方式，先运行板载 LED 示例。",
    "family": "Teensy",
    "tags": [
      "官方",
      "Teensyduino",
      "Arduino",
      "安装"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-nordic-sdk",
    "title": "Nordic：nRF Connect SDK Fundamentals",
    "author": "Nordic Semiconductor",
    "type": "link",
    "category": "官方英文课程",
    "url": "https://academy.nordicsemi.com/courses/nrf-connect-sdk-fundamentals/",
    "source_page": "https://academy.nordicsemi.com/courses/nrf-connect-sdk-fundamentals/",
    "description": "官方课程讲解 SDK、工程配置、GPIO、串口与 RTOS 应用基础。",
    "learning_stage": "Nordic 开发入门",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先完成开发环境与 GPIO 练习，再学习设备树与配置文件；课程进度功能可能需要账号。",
    "family": "Nordic nRF",
    "tags": [
      "官方",
      "课程",
      "Zephyr",
      "SDK",
      "GPIO"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-nordic-ble",
    "title": "Nordic：Bluetooth LE Fundamentals",
    "author": "Nordic Semiconductor",
    "type": "link",
    "category": "官方英文课程",
    "url": "https://academy.nordicsemi.com/courses/bluetooth-low-energy-fundamentals/",
    "source_page": "https://academy.nordicsemi.com/courses/bluetooth-low-energy-fundamentals/",
    "description": "按课程学习广播、连接、服务与特征等 BLE 开发概念。",
    "learning_stage": "蓝牙项目进阶",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先理解 Central 与 Peripheral，再学习 Service 与 Characteristic；手机连接成功不等于数据格式正确。",
    "family": "Nordic nRF",
    "tags": [
      "官方",
      "课程",
      "BLE",
      "无线"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-nxp-mcx",
    "title": "NXP FRDM-MCXN947 SDK 板级指南",
    "author": "NXP",
    "type": "link",
    "category": "官方英文手册",
    "url": "https://mcuxpresso.nxp.com/mcuxsdk/latest/boards/MCX/frdmmcxn947/index.html",
    "source_page": "https://mcuxpresso.nxp.com/mcuxsdk/latest/boards/MCX/frdmmcxn947/index.html",
    "description": "按开发板选择 MCUXpresso SDK 示例与板级配置。",
    "learning_stage": "NXP 本地工具链",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先做板载 LED 或串口示例，再切换外设；SDK 版本、芯片和开发板要一起对应。",
    "family": "NXP",
    "tags": [
      "官方",
      "MCUXpresso",
      "SDK",
      "MCX"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-ti-ecosystem",
    "title": "TI CCStudio 开发生态入口",
    "author": "Texas Instruments",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://www.ti.com/design-development/ccstudio-development-ecosystem.html",
    "source_page": "https://www.ti.com/design-development/ccstudio-development-ecosystem.html",
    "description": "从 TI 开发工具、SDK 与示例开始建立本地工程。",
    "learning_stage": "TI LaunchPad 入门",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先选 MCU 产品系列，再选择 SDK 和开发工具；MSP430 与 MSPM0 工程不能互换。",
    "family": "TI MSP",
    "tags": [
      "官方",
      "CCStudio",
      "SDK",
      "LaunchPad"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-wch-v003",
    "title": "WCH：CH32V003 官方 EVT 配套包入口",
    "author": "南京沁恒微电子",
    "type": "link",
    "category": "官方中文配套",
    "url": "https://www.wch.cn/downloads/CH32V003EVT_ZIP.html",
    "source_page": "https://www.wch.cn/downloads/CH32V003EVT_ZIP.html",
    "description": "开发板原理图、示例与配套开发资料的厂商入口。",
    "learning_stage": "CH32V003 起步",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先查下载页版本与适用芯片，再在本地解压查看 README。此条保留原厂入口，未宣称压缩包已下载。",
    "family": "WCH CH32",
    "tags": [
      "官方",
      "中文",
      "RISC-V",
      "EVT",
      "配套包"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-wch-v307",
    "title": "WCH：CH32V307 官方 EVT 配套包入口",
    "author": "南京沁恒微电子",
    "type": "link",
    "category": "官方中文配套",
    "url": "https://www.wch.cn/downloads/CH32V307EVT_ZIP.html",
    "source_page": "https://www.wch.cn/downloads/CH32V307EVT_ZIP.html",
    "description": "CH32V30x 等适用型号的开发板说明与示例入口。",
    "learning_stage": "CH32 系列进阶",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "同一下载包可能覆盖多个芯片；先找与你板上芯片完全一致的示例目录。",
    "family": "WCH CH32",
    "tags": [
      "官方",
      "中文",
      "RISC-V",
      "EVT",
      "示例"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-embedfire-hal",
    "title": "野火：STM32F103 HAL 库开发实战指南",
    "author": "野火 EmbedFire",
    "type": "link",
    "category": "作者官方教程",
    "url": "https://doc.embedfire.com/mcu/stm32/f103/hal_general/zh/latest/index.html",
    "source_page": "https://doc.embedfire.com/mcu/stm32/f103/hal_general/zh/latest/index.html",
    "description": "按基础概念、外设框图和代码实验组织的在线教材。",
    "learning_stage": "从点灯到外设",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "每次只读一个外设章节。先学 GPIO，再做按键；不要把 HAL、标准库与寄存器工程文件混放。",
    "family": "STM32",
    "tags": [
      "作者",
      "中文",
      "野火",
      "HAL",
      "F103"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-embedfire-std",
    "title": "野火：标准库实战指南与配套入口",
    "author": "野火 EmbedFire",
    "type": "link",
    "category": "作者官方配套",
    "url": "https://doc.embedfire.com/products/link/zh/latest/tutorial/ebf_stm32_stdlib_tutorial.html",
    "source_page": "https://doc.embedfire.com/products/link/zh/latest/tutorial/ebf_stm32_stdlib_tutorial.html",
    "description": "《STM32 库开发实战指南》系列在线教材、示例与视频索引。",
    "learning_stage": "跟随标准外设库课程",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "按 MINI、指南者、霸道等板型选择资料；网盘内容仍需从作者页面自行获取，本条未下载课程包。",
    "family": "STM32",
    "tags": [
      "作者",
      "中文",
      "野火",
      "标准库",
      "配套包"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-embedfire-index",
    "title": "野火官方产品资料中心",
    "author": "野火 EmbedFire",
    "type": "link",
    "category": "作者官方配套",
    "url": "https://doc.embedfire.com/products/link/zh/latest/index.html",
    "source_page": "https://doc.embedfire.com/products/link/zh/latest/index.html",
    "description": "按开发板、核心板、专题与工具分类查找配套资料。",
    "learning_stage": "查找自己板子的资料",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先按板名、芯片完整型号和板本选目录，再看原理图、例程、教材的对应关系。",
    "family": "STM32 / 多平台",
    "tags": [
      "作者",
      "中文",
      "野火",
      "资料索引",
      "原理图"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-atomic-index",
    "title": "正点原子官方资料下载中心",
    "author": "正点原子 ALIENTEK",
    "type": "link",
    "category": "作者官方配套",
    "url": "https://www.openedv.com/docs/build/html/index.html",
    "source_page": "https://www.openedv.com/docs/build/html/index.html",
    "description": "按 STM32、ESP32、CH32、Linux 和工具整理的资料目录。",
    "learning_stage": "寻找对应开发板配套",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先确认 V1/V2/V3/V4 等板本；同名新版板可能更换引脚和外围器件。",
    "family": "STM32 / 多平台",
    "tags": [
      "作者",
      "中文",
      "正点原子",
      "资料索引",
      "课程"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-atomic-f103v4",
    "title": "正点原子：F103 战舰 V4 配套入口",
    "author": "正点原子 ALIENTEK",
    "type": "link",
    "category": "作者官方配套",
    "url": "https://www.openedv.com/docs/boards/stm32/zdyz_stm32f103_warshipV4.html",
    "source_page": "https://www.openedv.com/docs/boards/stm32/zdyz_stm32f103_warshipV4.html",
    "description": "该板专属的资料盘、PPT 和 HAL 教学视频入口。",
    "learning_stage": "配合真实实验板",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "只对照战舰 V4 使用；先看入门篇，再按实验编号找例程。网盘文件未在本条下载。",
    "family": "STM32",
    "tags": [
      "作者",
      "中文",
      "正点原子",
      "HAL",
      "F103",
      "板级资料"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-atomic-book",
    "title": "正点原子：《原子教你玩 STM32》系列",
    "author": "正点原子 ALIENTEK",
    "type": "link",
    "category": "作者官方课程",
    "url": "https://www.openedv.com/docs/book-videos/zdyz_stm32_stdlib_book.html",
    "source_page": "https://www.openedv.com/docs/book-videos/zdyz_stm32_stdlib_book.html",
    "description": "作者整理的系列教材、公开视频与课程入口。",
    "learning_stage": "换一种讲法补概念",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "用同一个主题对照阅读，例如 GPIO 输入；不要直接混用不同课程的工程模板和 Delay 文件。",
    "family": "STM32",
    "tags": [
      "作者",
      "中文",
      "正点原子",
      "标准库",
      "课程"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-dfrobot-cn",
    "title": "DFRobot：Arduino 中文入门教程",
    "author": "DFRobot",
    "type": "link",
    "category": "厂商中文教程",
    "url": "https://wiki.dfrobot.com.cn/arduino%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B",
    "source_page": "https://wiki.dfrobot.com.cn/arduino%E5%85%A5%E9%97%A8%E6%95%99%E7%A8%8B",
    "description": "从连接板子、认识 IDE 到上传 Blink 的中文图文教程。",
    "learning_stage": "零基础 Arduino",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "教程部分截图来自早期 IDE，可结合 Arduino 当前官方 IDE 指南定位新菜单。",
    "family": "Arduino",
    "tags": [
      "厂商",
      "中文",
      "DFRobot",
      "Blink",
      "IDE"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-dfrobot-projects",
    "title": "DFRobot Arduino 学习资源中心",
    "author": "DFRobot",
    "type": "link",
    "category": "厂商中文教程",
    "url": "https://mc.dfrobot.com.cn/featured/arduino",
    "source_page": "https://mc.dfrobot.com.cn/featured/arduino",
    "description": "将入门代码、图形化教学和传感项目按学习阶段组织。",
    "learning_stage": "从基础实验到小项目",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "先做 LED、按键、电位器三个实验，再选温度、距离或小车项目。社区项目需单独核对所用模块。",
    "family": "Arduino",
    "tags": [
      "厂商",
      "中文",
      "DFRobot",
      "教程索引",
      "项目"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-jiangxie-home",
    "title": "江协科技：课程与配套总索引",
    "author": "江协科技",
    "type": "link",
    "category": "作者官方课程",
    "url": "https://jiangxiekeji.com/",
    "source_page": "https://jiangxiekeji.com/",
    "description": "作者的 STM32、51、PID 与平衡车课程总入口。",
    "learning_stage": "基础完成后的学习路线",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "中文",
    "status": "link_only",
    "reading_hint": "STM32 起步完成后，可按兴趣转向 PID 或平衡车。先看该课程配套要求，再复用自己的电路。",
    "family": "STM32 / 51 / 控制",
    "tags": [
      "作者",
      "中文",
      "江协",
      "PID",
      "学习路线"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-xiao-c3",
    "title": "Seeed XIAO ESP32C3 入门",
    "author": "Seeed Studio",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/",
    "source_page": "https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/",
    "description": "XIAO ESP32C3 的引脚、供电、Arduino 环境和首个示例。",
    "learning_stage": "小型无线板入门",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先看 D 引脚名与 GPIO 号的对应关系；小板可用引脚更少，不能套 DevKit 排针图。",
    "family": "ESP32 / XIAO",
    "tags": [
      "厂商",
      "XIAO",
      "ESP32C3",
      "Arduino",
      "引脚"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-xiao-s3",
    "title": "Seeed XIAO ESP32S3 / Sense 入门",
    "author": "Seeed Studio",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/",
    "source_page": "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/",
    "description": "含基本板和 Sense 扩展板的开发起点。",
    "learning_stage": "摄像头与声音项目",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "摄像头和扩展板有修订差异，先读版本说明；基础 Blink 成功后再做图像项目。",
    "family": "ESP32 / XIAO",
    "tags": [
      "厂商",
      "ESP32S3",
      "摄像头",
      "端侧AI"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-maixcam",
    "title": "Sipeed MaixCAM 官方硬件文档",
    "author": "Sipeed",
    "type": "link",
    "category": "厂商英文手册",
    "url": "https://wiki.sipeed.com/hardware/en/maixcam/maixcam.html",
    "source_page": "https://wiki.sipeed.com/hardware/en/maixcam/maixcam.html",
    "description": "查询 MaixCAM 硬件、接口和软件开发入口。",
    "learning_stage": "端侧视觉硬件选型",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先确认使用 MaixCAM 专属软件栈；相近芯片不代表系统镜像和摄像头驱动可互换。",
    "family": "Linux / AI",
    "tags": [
      "厂商",
      "摄像头",
      "MaixCAM",
      "端侧AI"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-lichee",
    "title": "Sipeed LicheeRV Nano 官方文档",
    "author": "Sipeed",
    "type": "link",
    "category": "厂商英文手册",
    "url": "https://wiki.sipeed.com/licheerv-nano",
    "source_page": "https://wiki.sipeed.com/licheerv-nano",
    "description": "核对不同板型的处理器、网络接口与烧录方式。",
    "learning_stage": "Linux 与 RISC-V 进阶",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先确认 W/E 等型号后缀，再选镜像和接线；GPIO 控制流程不同于裸机 MCU。",
    "family": "Linux / RISC-V",
    "tags": [
      "厂商",
      "Linux",
      "RISC-V",
      "NPU"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-platformio",
    "title": "PlatformIO 官方概念与入门",
    "author": "PlatformIO",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://docs.platformio.org/en/latest/what-is-platformio.html",
    "source_page": "https://docs.platformio.org/en/latest/what-is-platformio.html",
    "description": "认识多平台工程、板卡配置、库和构建工具。",
    "learning_stage": "把实验转到本地工程",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先读懂 platform、board、framework 三个字段。只有它们与真实板匹配，导出的工程配置才有意义。",
    "family": "多平台",
    "tags": [
      "官方",
      "PlatformIO",
      "VS Code",
      "工具链"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-zephyr",
    "title": "Zephyr 官方 Getting Started",
    "author": "Zephyr Project",
    "type": "link",
    "category": "官方英文教程",
    "url": "https://docs.zephyrproject.org/latest/develop/getting_started/index.html",
    "source_page": "https://docs.zephyrproject.org/latest/develop/getting_started/index.html",
    "description": "准备工具链、获取源码并构建第一个板级示例。",
    "learning_stage": "RTOS 与多板项目进阶",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先完成 blinky，再学习设备树和 Kconfig；不要把 Zephyr 的引脚配置方式与 Arduino 直接混用。",
    "family": "多平台",
    "tags": [
      "官方",
      "RTOS",
      "Zephyr",
      "SDK"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-breadboard",
    "title": "Adafruit：面包板从零开始",
    "author": "Adafruit",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.adafruit.com/breadboards-for-beginners/breadboards",
    "source_page": "https://learn.adafruit.com/breadboards-for-beginners/breadboards",
    "description": "用内部金属连接结构解释面包板为什么能接通电路。",
    "learning_stage": "第一次接线",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先圈出同一组相通孔，再放电阻和 LED。理解电源轨中断比记外观更重要。",
    "family": "通用电路",
    "tags": [
      "厂商",
      "面包板",
      "接线",
      "入门"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-led-guide",
    "title": "Adafruit：Arduino Lesson 2 · LED",
    "author": "Adafruit / Simon Monk",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.adafruit.com/adafruit-arduino-lesson-2-leds/overview",
    "source_page": "https://learn.adafruit.com/adafruit-arduino-lesson-2-leds/overview",
    "description": "用最小 LED 电路学习极性、限流和输出控制。",
    "learning_stage": "第一个可观察现象",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "只完成一个 LED 的亮灭，再解释电流经过哪些元件。确认电路后再换频率和引脚。",
    "family": "通用电路 / Arduino",
    "tags": [
      "厂商",
      "LED",
      "GPIO",
      "基础实验"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-rgb-guide",
    "title": "Adafruit：Arduino Lesson 3 · RGB",
    "author": "Adafruit / Simon Monk",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.adafruit.com/adafruit-arduino-lesson-3-rgb-leds/overview",
    "source_page": "https://learn.adafruit.com/adafruit-arduino-lesson-3-rgb-leds/overview",
    "description": "用三路颜色通道理解 RGB 混色与 PWM。",
    "learning_stage": "从亮灭到调光",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先分别点亮红、绿、蓝，确认共阳/共阴类型后再混色。",
    "family": "通用电路 / Arduino",
    "tags": [
      "厂商",
      "RGB",
      "PWM",
      "基础实验"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-piezo-guide",
    "title": "Adafruit：无源蜂鸣片与音调",
    "author": "Adafruit / Tony DiCola",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.adafruit.com/using-piezo-buzzers-with-circuitpython-arduino/overview",
    "source_page": "https://learn.adafruit.com/using-piezo-buzzers-with-circuitpython-arduino/overview",
    "description": "解释压电蜂鸣片如何通过变化的电压产生声音。",
    "learning_stage": "理解 PWM 与频率",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先区分有源蜂鸣器和无源压电片；改变频率听音高，改变时长听节奏。",
    "family": "通用电路 / Arduino",
    "tags": [
      "厂商",
      "声音",
      "频率",
      "PWM"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-spark-resistors",
    "title": "SparkFun：电阻基础",
    "author": "SparkFun",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.sparkfun.com/tutorials/resistors/all",
    "source_page": "https://learn.sparkfun.com/tutorials/resistors/all",
    "description": "解释阻值、串并联、色环和常见用途。",
    "learning_stage": "理解电流和限流",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "从 LED 限流算一个例子，再学习分压。不要一开始背完整色环表。",
    "family": "通用电路",
    "tags": [
      "厂商",
      "电阻",
      "欧姆定律",
      "分压"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-spark-capacitors",
    "title": "SparkFun：电容基础",
    "author": "SparkFun",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.sparkfun.com/tutorials/capacitors/all",
    "source_page": "https://learn.sparkfun.com/tutorials/capacitors/all",
    "description": "认识容量、充放电、去耦与不同电容种类。",
    "learning_stage": "理解电压随时间变化",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先观察串联电阻后的充电曲线，再区分电解和陶瓷电容。",
    "family": "通用电路",
    "tags": [
      "厂商",
      "电容",
      "RC",
      "去耦"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-spark-diodes",
    "title": "SparkFun：二极管基础",
    "author": "SparkFun",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.sparkfun.com/tutorials/diodes/all",
    "source_page": "https://learn.sparkfun.com/tutorials/diodes/all",
    "description": "从方向性、压降到常见二极管用途的图文说明。",
    "learning_stage": "理解极性与单向导通",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先认清 A/K 与色环，再比较正接和反接；真实压降随电流变化。",
    "family": "通用电路",
    "tags": [
      "厂商",
      "二极管",
      "极性",
      "整流"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  },
  {
    "id": "extra-spark-switch",
    "title": "SparkFun：按钮与开关基础",
    "author": "SparkFun",
    "type": "link",
    "category": "厂商英文教程",
    "url": "https://learn.sparkfun.com/tutorials/button-and-switch-basics",
    "source_page": "https://learn.sparkfun.com/tutorials/button-and-switch-basics",
    "description": "区分按钮、开关、触点类型和常见连接。",
    "learning_stage": "第一次读取输入",
    "verified_date": "2026-11-06",
    "checked_on": "2026-11-06",
    "language": "英文",
    "status": "link_only",
    "reading_hint": "先理解常开、常闭和按下状态；用万用表通断档或画布连通检查确认四脚按键。",
    "family": "通用电路",
    "tags": [
      "厂商",
      "按键",
      "开关",
      "消抖"
    ],
    "license_note": "链接至厂商、项目维护者或课程作者的原始页面；未复制课程包或重发受版权保护的视频。",
    "download_status": "在线原文入口；本条未下载文件"
  }
];
