const picoFamily = "https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html";
const picoCore = "https://arduino-pico.readthedocs.io/en/latest/analog.html";
const r4Core = "https://github.com/arduino/ArduinoCore-renesas/blob/main/cores/arduino/analog.cpp";

export function makeRpAvrProfiles({pico, uno, nano}) {
  const picoVariants = [
    {
      id: "pico-w", name: "Raspberry Pi Pico W", mcu: "RP2040",
      arduinoBoard: "rpipicow", arduinoMacro: "ARDUINO_RASPBERRY_PI_PICO_W",
      pinout: "https://datasheets.raspberrypi.com/picow/PicoW-A4-Pinout.pdf",
      wireless: true
    },
    {
      id: "pico2", name: "Raspberry Pi Pico 2", mcu: "RP2350",
      arduinoBoard: "rpipico2", arduinoMacro: "ARDUINO_RASPBERRY_PI_PICO_2",
      pinout: "https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf",
      wireless: false
    },
    {
      id: "pico2-w", name: "Raspberry Pi Pico 2 W", mcu: "RP2350",
      arduinoBoard: "rpipico2w", arduinoMacro: "ARDUINO_RASPBERRY_PI_PICO_2W",
      pinout: "https://pip-assets.raspberrypi.com/categories/1088-raspberry-pi-pico-2-w/documents/RP-008305-DS-1-pico-2-w-pinout.pdf",
      wireless: true
    }
  ].map(({id, name, mcu, arduinoBoard, arduinoMacro, pinout, wireless}) => {
    const isRp2350 = mcu === "RP2350";
    return {
      ...pico, id, name, mcu, family: mcu, wireless,
      coreClockHz: isRp2350 ? 150000000 : 133000000,
      flashBytes: isRp2350 ? 4194304 : 2097152,
      ramBytes: isRp2350 ? 532480 : 270336,
      pins: pico.pins.map(pin => pin.id === "ADC_VREF" ? {...pin, canonical: "ADC_VREF"} : {...pin}),
      pinAliases: {...pico.pinAliases, ADC_VREF: "ADC_VREF"},
      numberedPins: Object.fromEntries(Object.entries(pico.numberedPins).filter(([, pin]) => !wireless || pin !== "GP25")),
      pwmPins: pico.pwmPins.filter(pin => !wireless || pin !== "GP25"),
      pwmFrequency: 1000,
      reservedPins: wireless ? ["GP23", "GP24", "GP25", "GP29"] : ["GP23", "GP24", "GP29"],
      ledPin: wireless ? null : "GP25",
      platformio: null,
      arduinoFqbn: "rp2040:rp2040:" + arduinoBoard,
      arduinoDefines: {ARDUINO_ARCH_RP2040: 1, [arduinoMacro]: 1},
      capabilities: {analogReadResolution: true, analogWriteResolution: true, analogWriteFrequency: false},
      sources: [picoFamily, pinout, picoCore],
      notes: [
        wireless ? "板载用户灯连到无线芯片的 WL_GPIO0。浏览器示例使用 GP15 外接 LED，保留无线相关引脚。" : "板载用户灯接 GP25，可直接运行板载 LED 闪烁示例。",
        "GP26–GP28 是排针上的三个 12 位 ADC 输入。示例使用 Arduino-Pico 兼容写法，默认读数为 10 位。",
        "支持 GPIO、ADC、PWM 和虚拟串口。无线、PIO、原生 USB 和芯片固件暂未建模。"
      ]
    };
  });

  const unoR4Variants = [
    {
      id: "uno-r4-minima", name: "Arduino UNO R4 Minima", part: "ABX00080",
      arduinoBoard: "minima", arduinoMacro: "ARDUINO_MINIMA", platformioBoard: "uno_r4_minima",
      featureNote: "BOOT 是启动控制端。CAN、USB 和 A0 的 DAC 输出暂未建模。"
    },
    {
      id: "uno-r4-wifi", name: "Arduino UNO R4 WiFi", part: "ABX00087",
      arduinoBoard: "unor4wifi", arduinoMacro: "ARDUINO_UNOWIFIR4", platformioBoard: "uno_r4_wifi",
      featureNote: "主芯片为 RA4M1。ESP32-S3、LED 矩阵、Qwiic、CAN、USB 和 A0 的 DAC 输出暂未建模。"
    }
  ].map(({id, name, part, arduinoBoard, arduinoMacro, platformioBoard, featureNote}) => ({
    ...uno, id, name, family: "Renesas RA4", mcu: "RA4M1", style: "uno-r4",
    adcMax: 16383, nativeAdcBits: 14, coreClockHz: 48000000, flashBytes: 262144, ramBytes: 32768,
    intBits: 32, gpioWarningMa: 8,
    pins: uno.pins.map(pin => pin.id === "NC" ? {...pin, id: "BOOT", label: "BOOT", canonical: "BOOT", kind: "control"} : {...pin}),
    pinAliases: {IOREF: "5V", SDA: "A4", SCL: "A5"},
    dacPins: ["A0"], pwmFrequency: 490, pwmFrequencies: {}, serialPorts: ["Serial", "Serial1"],
    platformio: {platform: "renesas-ra", board: platformioBoard, framework: "arduino"},
    arduinoFqbn: "arduino:renesas_uno:" + arduinoBoard,
    arduinoDefines: {ARDUINO_ARCH_RENESAS_UNO: 1, [arduinoMacro]: 1, [arduinoBoard === "minima" ? "ARDUINO_UNOR4_MINIMA" : "ARDUINO_UNOR4_WIFI"]: 1},
    capabilities: {analogReadResolution: true, analogWriteResolution: true, analogWriteFrequency: false},
    sources: ["https://docs.arduino.cc/hardware/" + id + "/", "https://docs.arduino.cc/resources/pinouts/" + part + "-full-pinout.pdf", r4Core],
    notes: [
      "主要排针为 5 V 逻辑，单引脚额定电流上限 8 mA。SDA/A4 和 SCL/A5 分别为同一电气节点。",
      "A0–A5 可做 ADC，默认 10 位，可设 14 位。PWM 可用引脚为 D3、D5、D6、D9、D10、D11。",
      featureNote
    ]
  }));

  const nanoEvery = {
    ...nano, id: "nano-every", name: "Arduino Nano Every", mcu: "ATmega4809",
    ledResistance: 1000,
    family: "AVR-megaAVR", style: "nano-every", flashBytes: 49152, ramBytes: 6144,
    pins: nano.pins.map(pin => ({...pin})),
    analogOnly: [], analogChannelNumbers: true, pwmPins: ["D3", "D5", "D6", "D9", "D10"],
    pwmFrequency: 976.5625, pwmFrequencies: {}, serialPorts: ["Serial", "Serial1"],
    platformio: {platform: "atmelmegaavr", board: "nano_every", framework: "arduino"},
    arduinoFqbn: "arduino:megaavr:nona4809",
    arduinoDefines: {ARDUINO_ARCH_MEGAAVR: 1, ARDUINO_AVR_NANO_EVERY: 1},
    capabilities: {analogReadResolution: false, analogWriteResolution: false, analogWriteFrequency: false},
    sources: [
      "https://docs.arduino.cc/hardware/nano-every/",
      "https://docs.arduino.cc/resources/pinouts/ABX00028-full-pinout.pdf",
      "https://github.com/arduino/ArduinoCore-megaavr/blob/master/variants/nona4809/pins_arduino.h"
    ],
    notes: [
      "5 V ATmega4809，Arduino 官方板包默认 16 MHz。A6、A7 同时支持 ADC 与数字 GPIO。",
      "ADC 为 10 位，PWM 为 8 位。可用 PWM 引脚为 D3、D5、D6、D9、D10。",
      "Serial 对应虚拟控制台，Serial1 对应 D0/RX 和 D1/TX 的串口编号。SAMD11 USB 桥暂未建模。"
    ]
  };

  return [...picoVariants, ...unoR4Variants, nanoEvery];
}
