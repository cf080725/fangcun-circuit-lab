const espPinout = "https://docs.arduino.cc/resources/pinouts/ABX00083-full-pinout.pdf";
const rpPinout = "https://docs.arduino.cc/resources/pinouts/ABX00053-full-pinout.pdf";
const espVariant = "https://github.com/espressif/arduino-esp32/blob/master/variants/arduino_nano_nora/pins_arduino.h";
const rpVariant = "https://github.com/arduino/ArduinoCore-mbed/blob/main/variants/NANO_RP2040_CONNECT/variant.cpp";
const mb = 1024*1024;
const base = {
  language:"arduino", dialects:["arduino"], logicVoltage:3.3, adcMax:4095,
  hasPullDown:true, width:1.778, height:4.318, flashBytes:16*mb
};

export function makeArduinoNanoProfiles({rows, named}) {
  const ground = number => named("GND" + number, "GND", "GND");
  const reset = named("RST", "RST", "RESET");
  function nano({prefix, digital, analog, analogBase, analogIds=[], upperLeft, lowerLeft, ...profile}) {
    const id = number => prefix + number;
    const pin = (label, number, silk = label) => named(label, silk, id(number));
    const digitalPins = digital.map((number, i) =>
      pin("D" + i, number, i===0 ? "RX" : i===1 ? "TX" : "D" + i));
    const analogPins = analog.map((number, i) => pin(analogIds[i] || "A" + i, number, "A" + i));
    const commonAliases = {
      RX:id(digital[0]), TX:id(digital[1]), SS:id(digital[10]), MOSI:id(digital[11]),
      MISO:id(digital[12]), SCK:id(digital[13]), SDA:id(analog[4]), SCL:id(analog[5])
    };
    return {
      ...base, ...profile,
      pins:rows(
        [digitalPins[13], "3V3", upperLeft, ...analogPins, ...lowerLeft, ground(1), "VIN"],
        [...digitalPins.slice(2, 13).reverse(), ground(2), reset, digitalPins[0], digitalPins[1]],
        base.width, base.height, {x:.762}
      ),
      numberedPins:{
        ...Object.fromEntries(digital.map((number, i) => [i, id(number)])),
        ...Object.fromEntries(analog.map((number, i) => [i + analogBase, id(number)])),
        ...profile.numberedPins
      },
      pinAliases:{...commonAliases, ...profile.pinAliases},
      pwmPins:[...digital, ...analog].map(id),
      ledPin:id(digital[13]), ledActiveLow:false, ledResistance:1000,
      defaultPins:{led:id(digital[4]), button:id(digital[2]), adc:id(analog[0]),
        pwm:id(digital[9]), tx:id(digital[1]), rx:id(digital[0])}
    };
  }

  const espAnalog = [1,2,3,4,11,12,13,14];
  const esp = nano({
    id:"nano-esp32", name:"Arduino Nano ESP32", mcu:"ESP32-S3 · NORA-W106", family:"ESP32-S3",
    style:"nano-esp32", color:"#168b92", coreClockHz:240000000, ramBytes:512*1024, psramBytes:8*mb,
    adcDefaultBits:12, serialPorts:["Serial","Serial0","Serial1","Serial2"],
    prefix:"GPIO", digital:[44,43,5,6,7,8,9,10,17,18,21,38,47,48], analog:espAnalog, analogBase:17,
    upperLeft:named("B0", "B0", "GPIO46", {kind:"reserved"}),
    lowerLeft:[named("VUSB", "VUSB", "5V", {kind:"power"}), named("B1", "B1", "GPIO0", {kind:"reserved"})],
    numberedPins:{14:"GPIO46",15:"GPIO0",16:"GPIO45"},
    pinAliases:{LED_RED:"GPIO46",LED_GREEN:"GPIO0",LED_BLUE:"GPIO45"},
    analogPins:espAnalog.map(n => "GPIO" + n), strappingPins:["GPIO3","GPIO0","GPIO45","GPIO46"],
    reservedPins:["GPIO46","GPIO0","GPIO45"],
    arduinoDefines:{ARDUINO_NANO_ESP32:1,ARDUINO_ARCH_ESP32:1,BOARD_HAS_PIN_REMAP:1},
    sources:[espPinout, espVariant, "https://docs.arduino.cc/resources/datasheets/ABX00083-datasheet.pdf",
      "https://store.arduino.cc/products/nano-esp32-with-headers"],
    notes:[
      "采用 Arduino IDE 默认的 Arduino 引脚编号。D13 对应 GPIO48，A0 的 Arduino 编号为 17；芯片 GPIO 数字编号模式未建模。",
      "D13 是单色板载 LED。RGB、B0/B1 启动脚、Wi‑Fi、BLE、原生 USB 与 PWM 通道争用未建模。",
      "按 ABX00083 已焊公排针版绘制，针脚行距 15.24 mm。",
      "GPIO 为 3.3 V，ADC 使用理想线性量程。VUSB 在模型中代表 USB 供电时的 5 V。"
    ]
  });

  const rpAnalog = [26,27,28,29,12,13];
  const rp = nano({
    id:"nano-rp2040-connect", name:"Arduino Nano RP2040 Connect", mcu:"RP2040", family:"RP2040",
    style:"nano-rp2040-connect", color:"#167983", coreClockHz:133000000, ramBytes:264*1024,
    adcDefaultBits:10, analogChannelNumbers:true, pwmFrequency:500, gpioWarningMa:12,
    serialPorts:["Serial","Serial1"], prefix:"GP", digital:[1,0,25,15,16,17,18,19,20,21,5,7,4,6],
    analog:rpAnalog, analogBase:14, analogIds:[null,null,null,null,"SDA","SCL"],
    upperLeft:named("AREF", "AREF", "AREF", {kind:"control"}),
    lowerLeft:[
      named("A6", "A6", "NINA_A6", {kind:"reserved"}), named("A7", "A7", "NINA_A7", {kind:"reserved"}),
      named("VUSB", "5V", "VUSB_DISABLED", {kind:"nc"}), named("REC", "REC", "REC", {kind:"control"})
    ],
    pinAliases:{A4:"NINA_A4",A5:"NINA_A5"},
    analogPins:rpAnalog.slice(0,4).map(n => "GP" + n), reservedPins:["NINA_A4","NINA_A5","NINA_A6","NINA_A7"],
    arduinoDefines:{ARDUINO_NANO_RP2040_CONNECT:1,ARDUINO_ARCH_RP2040:1},
    capabilities:{analogReadResolution:true,analogWriteResolution:true,analogWriteFrequency:false},
    sources:[rpPinout, rpVariant, "https://github.com/arduino/ArduinoCore-mbed/blob/main/variants/NANO_RP2040_CONNECT/nina_pins.h",
      "https://docs.arduino.cc/resources/datasheets/ABX00053-datasheet.pdf",
      "https://store.arduino.cc/products/arduino-nano-rp2040-connect-with-headers"],
    notes:[
      "D13 的单色板载 LED 接 GP6。A0–A3 由 RP2040 采样，默认 10 位 API 输出，可设 12 位。",
      "A4/A5 所在焊盘可用 Arduino 数字编号 18/19 操作 GP12/13。A4–A7 的源码符号经 NINA 模组，当前未建模；USB、无线、RGB、麦克风与 IMU 也未建模。",
      "按 ABX00053 已焊公排针版出厂配置绘制：针脚行距 15.24 mm，5V/VUSB 跳线未接通，GPIO 为 3.3 V。AREF 和 REC 仅保留位置。"
    ]
  });
  return [esp, rp];
}
