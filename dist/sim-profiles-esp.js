const guides = {
  s3: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html",
  c6: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html",
  h2: "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html",
  xiaoC3: "https://wiki.seeedstudio.com/XIAO_ESP32C3_Getting_Started/",
  xiaoS3: "https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/",
  node: "https://github.com/nodemcu/nodemcu-devkit-v1.0"
};
const espCore = "https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html";
const esp8266Core = "https://arduino-esp8266.readthedocs.io/en/latest/reference.html";
const espVariant = variant => "https://github.com/espressif/arduino-esp32/blob/master/variants/" + variant + "/pins_arduino.h";
const gpio = number => "GPIO" + number;
const pinNumbers = numbers => Object.fromEntries(numbers.map(n => [n, gpio(n)]));
const gpioDefaults = (led, button, adc, tx, rx) => ({
  led:gpio(led), button:gpio(button), adc:gpio(adc), pwm:gpio(led), tx:gpio(tx), rx:gpio(rx)
});
const common = {language:"arduino", dialects:["arduino"], logicVoltage:3.3, ledPin:null};
const esp32Common = {
  ...common, adcMax:4095, adcDefaultBits:12, hasPullDown:true, serialPorts:["Serial", "Serial1"]
};
const idealAdc = "ADC 使用理想线性量程，实物需核对输入上限、衰减和校准。";
const addressableLed = pin => "板载 RGB 接 GPIO" + pin + "，需要可寻址灯协议；示例使用外接普通 LED。";

export function makeEspProfiles({rows, named}) {
  const gnd = n => named("GND" + n, "GND", "GND");
  const nc = n => named("NC" + n, "NC", "NC" + n, {kind:"nc"});
  const reset = named("RST", "RST", "EN");
  const pin = (n, label=String(n), kind="gpio") => named(gpio(n), label, gpio(n), {kind});
  // Espressif's header tables number from the antenna end. With USB at
  // the top of the workspace, reverse both row order and row assignment.
  function devkit(left, right, height, usbClearance, data) {
    const width = 2.54;
    const toPins = (row,connector) => row.map((item,index) => {
      const entry = typeof item==="number" ? pin(item) : typeof item==="string" ? {id:item,label:item} : item;
      return {...entry,connector,connectorPin:index+1};
    }).reverse();
    const pins = rows(toPins(right,"J3"), toPins(left,"J1"), width, height, {
      x:1.143, start:-height/2+usbClearance
    });
    const gpios = pins.filter(p => p.kind==="gpio" || p.kind==="reserved");
    const pwmPins = gpios.filter(p => p.kind==="gpio").map(p => p.canonical);
    return {
      ...esp32Common, width, height, pins, pwmPins,
      numberedPins:pinNumbers(gpios.map(p => Number(p.canonical.slice(4)))),
      color:"#293e48", ...data
    };
  }

  const s3 = devkit(
    ["3V3", named("3V3b", "3V3", "3V3"), reset, 4, 5, 6, 7, 15, 16, 17, 18, 8, 3, 46, 9, 10, 11, 12, 13, 14, "5V", gnd(1)],
    [gnd(2), pin(43, "TX"), pin(44, "RX"), 1, 2, 42, 41, 40, 39, 38, pin(37, "37", "reserved"), pin(36, "36", "reserved"), pin(35, "35", "reserved"), 0, 45, 48, 47, 21, 20, 19, gnd(3), gnd(4)],
    6.274, .8, {
      id:"esp32-s3-devkitc", name:"ESP32-S3-DevKitC-1 v1.1 · N16R8", family:"ESP32-S3",
      mcu:"ESP32-S3-WROOM-1", style:"esp32-s3", coreClockHz:240000000, ramBytes:512*1024,
      flashBytes:16*1024*1024, psramBytes:8*1024*1024, rgbLedPin:gpio(38),
      analogPins:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(gpio),
      strappingPins:[0,3,45,46].map(gpio), reservedPins:[35,36,37].map(gpio),
      serialPorts:["Serial", "Serial1", "Serial2"], defaultPins:gpioDefaults(4,5,1,43,44),
      sources:[guides.s3, "https://dl.espressif.com/dl/schematics/esp_idf/DXF_ESP32-S3-DevKitC-1_V1.1_20220429.pdf", espCore],
      notes:["对应 v1.1 N16R8 模组，GPIO35–37 给八线 PSRAM 使用。早期板载 RGB 的引脚编号不同。", addressableLed(38), idealAdc]
    });

  const c6 = devkit(
    ["3V3", reset, 4, 5, 6, 7, 0, 1, 8, 10, 11, 2, 3, "5V", gnd(1), nc(1)],
    [gnd(2), pin(16, "TX"), pin(17, "RX"), 15, 23, 22, 21, 20, 19, 18, 9, gnd(3), 13, 12, gnd(4), nc(2)],
    5.18, 1.2125, {
      id:"esp32-c6-devkitc", name:"ESP32-C6-DevKitC-1 v1.2 · N8", family:"ESP32-C6",
      mcu:"ESP32-C6-WROOM-1", style:"esp32-c6", coreClockHz:160000000, ramBytes:512*1024,
      flashBytes:8*1024*1024, rgbLedPin:gpio(8), analogPins:[0,1,2,3,4,5,6].map(gpio),
      pinAliases:{NC:"NC"},
      strappingPins:[4,5,8,9,15].map(gpio), defaultPins:gpioDefaults(10,11,0,16,17),
      sources:[guides.c6, "https://dl.espressif.com/dl/schematics/esp32-c6-devkitc-1-dimensions_v1.2.pdf", espCore],
      notes:[addressableLed(8), "GPIO12/13 与实物原生 USB 共用。模型只提供普通 GPIO 行为。", idealAdc]
    });

  const h2 = devkit(
    ["3V3", reset, 0, 1, 2, 3, pin(13, "13/N", "reserved"), pin(14, "14/N", "reserved"), 4, 5, nc(1), "VBAT", gnd(1), "5V", gnd(2)],
    [gnd(3), pin(24, "TX"), pin(23, "RX"), 10, 11, 25, 12, 8, 22, gnd(4), 9, gnd(5), 27, 26, gnd(6)],
    4.826, 1.1125, {
      id:"esp32-h2-devkitm", name:"ESP32-H2-DevKitM-1 v1.3 · N4S", family:"ESP32-H2",
      mcu:"ESP32-H2-MINI-1", style:"esp32-h2", coreClockHz:96000000, ramBytes:320*1024,
      flashBytes:4*1024*1024, rgbLedPin:gpio(8), analogPins:[1,2,3,4,5].map(gpio),
      pinAliases:{NC:"NC"},
      strappingPins:[8,9,25].map(gpio), noInternalPull:[gpio(25)], reservedPins:[13,14].map(gpio),
      defaultPins:gpioDefaults(10,11,1,24,23),
      sources:[guides.h2, "https://dl.espressif.com/dl/schematics/esp32-h2-devkitm-1_v1.2_dimension.pdf", espCore],
      notes:["按带 32.768 kHz 晶振的 v1.3/N4S 建模，J1.7 和 J1.8 留给晶振。排针尺寸按现行指南链接的 v1.2 机械图。", addressableLed(8), "USB、VBAT 供电切换、BLE 和 802.15.4 不在当前模型中。", idealAdc]
    });

  function xiao(numbers, analogIndices, data) {
    const digital = numbers.map((n,i) => named("D" + i, "D" + i, gpio(n)));
    const [tx, rx] = numbers.slice(6, 8);
    const aliases = {TX:gpio(tx), RX:gpio(rx), SDA:gpio(numbers[4]), SCL:gpio(numbers[5]),
      SCK:gpio(numbers[8]), MISO:gpio(numbers[9]), MOSI:gpio(numbers[10]), SS:gpio(rx)};
    for (const i of analogIndices) aliases["A" + i] = gpio(numbers[i]);
    return {
      ...esp32Common, width:1.78, height:2.1, style:"xiao", color:"#1c3235",
      pins:rows(digital.slice(0,7), ["5V", gnd(1), "3V3", ...digital.slice(7).reverse()], 1.78, 2.1, {x:.762}),
      numberedPins:pinNumbers(numbers), pinAliases:aliases, pwmPins:numbers.map(gpio),
      analogPins:analogIndices.map(i => gpio(numbers[i])), ...data
    };
  }
  const xiaoC3 = xiao([2,3,4,5,6,7,21,20,8,9,10], [0,1,2], {
    id:"xiao-esp32c3", name:"Seeed Studio XIAO ESP32C3", family:"ESP32-C3", mcu:"ESP32-C3",
    coreClockHz:160000000, ramBytes:400*1024, flashBytes:4*1024*1024,
    strappingPins:[2,8,9].map(gpio), defaultPins:gpioDefaults(4,6,3,21,20),
    sources:[guides.xiaoC3, espVariant("XIAO_ESP32C3"), espCore],
    notes:["D 标识是板上丝印；Arduino 数字参数是芯片 GPIO 编号。比如 D2 对应 GPIO4。", "模拟采样范围限 D0–D2 的 ADC1 通道。D3 是 ADC2 通道，存在芯片勘误，当前作为普通 GPIO。", idealAdc]
  });
  const xiaoS3 = xiao([1,2,3,4,5,6,43,44,7,8,9], [0,1,2,3,4,5,8,9,10], {
    id:"xiao-esp32s3-sense", name:"Seeed Studio XIAO ESP32S3 Sense", family:"ESP32-S3", mcu:"ESP32-S3R8",
    coreClockHz:240000000, ramBytes:512*1024, flashBytes:8*1024*1024, psramBytes:8*1024*1024,
    strappingPins:[3].map(gpio), defaultPins:gpioDefaults(2,4,1,43,44),
    sources:[guides.xiaoS3, espVariant("XIAO_ESP32S3"), espCore],
    notes:["当前模型为 Sense 主板的两排针脚和外接 LED，摄像头、数字麦克风、SD 卡与板载 LED 未建模。", "D 标识是板上丝印；D0 对应 GPIO1。", idealAdc]
  });

  const nodeDigital = [16,5,4,0,2,14,12,13,15,3,1];
  const nodePin = i => named("D" + i, i===9 ? "RX" : i===10 ? "TX" : "D" + i, gpio(nodeDigital[i]));
  const flashPin = (n,label) => named(label, label, gpio(n), {kind:"reserved"});
  const nodeJ1 = ["A0", named("RSV1", "RSV", "RSV1", {kind:"nc"}), named("RSV2", "RSV", "RSV2", {kind:"nc"}),
    flashPin(10,"SD3"), flashPin(9,"SD2"), flashPin(8,"SD1"), flashPin(11,"CMD"), flashPin(7,"SD0"), flashPin(6,"CLK"),
    gnd(1), "3V3", "EN", "RST", gnd(2), "VIN"];
  const nodeJ2 = [0,1,2,3,4].map(nodePin).concat(
    named("3V3b", "3V3", "3V3"), gnd(3), [5,6,7,8,9,10].map(nodePin), gnd(4), named("3V3c", "3V3", "3V3"));
  const node = {
    ...common, id:"nodemcu-esp8266", name:"NodeMCU 1.0 · ESP-12E", family:"ESP8266", mcu:"ESP8266EX · ESP-12E",
    style:"esp8266", width:2.54, height:4.826, color:"#243334", coreClockHz:80000000, flashBytes:4*1024*1024,
    ramBytes:80*1024, adcMax:1023, analogPins:["A0"], analogOnly:["A0"],
    pins:rows(nodeJ2.reverse(), nodeJ1.reverse(), 2.54, 4.826, {x:1.143}),
    pinAliases:{SDA:gpio(4), SCL:gpio(5), SCK:gpio(14), MISO:gpio(12), MOSI:gpio(13), SS:gpio(15)},
    numberedPins:{...pinNumbers([...nodeDigital,6,7,8,9,10,11]),17:"A0"},
    pwmPins:nodeDigital.filter(n => n!==16).map(gpio), noInternalPull:[gpio(16)],
    reservedPins:[6,7,8,9,10,11].map(gpio), strappingPins:[0,2,15].map(gpio),
    serialPorts:["Serial", "Serial1"],
    defaultPins:{...gpioDefaults(5,4,0,1,3), adc:"A0", pwm:gpio(14)},
    capabilities:{analogReadResolution:false, analogWriteResolution:false},
    sources:[guides.node, "https://github.com/nodemcu/nodemcu-devkit-v1.0/blob/master/ESP12E_DEVKIT.lbr", esp8266Core, "https://github.com/esp8266/Arduino/blob/master/variants/nodemcu/pins_arduino.h"],
    notes:["对应原版 NodeMCU DevKit 1.0 ESP-12E 封装。实物兼容板请核对排针间距。GPIO6–11 保留给 Flash。", "A0 为 10 位模拟输入；实板分压约 0–3.2V，教学按 0–3.3V 线性近似。裸 ESP8266 的 ADC 输入上限约 1V。", "原板 GPIO16 在本模型限普通数字读写。ESP8266 core 3.x 默认软件 PWM 数值为 0–255；Wi-Fi 与 USB 不在模型中。"]
  };
  return [s3, c6, h2, node, xiaoC3, xiaoS3];
}
