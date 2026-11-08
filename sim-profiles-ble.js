const pinout = "https://docs.arduino.cc/resources/pinouts/ABX00069-full-pinout.pdf";
const variant = "https://github.com/arduino/ArduinoCore-mbed/blob/main/variants/ARDUINO_NANO33BLE";
const digital = ["P1.03","P1.10","P1.11","P1.12","P1.15","P1.13","P1.14","P0.23","P0.21","P0.27","P1.02","P1.01","P1.08","P0.13"];
const analog = ["P0.04","P0.05","P0.30","P0.29","P0.31","P0.02","P0.28","P0.03"];

export function makeBleProfiles({rows, named}) {
  const d = digital.map((name,i) => named("D"+i, i===0 ? "TX" : i===1 ? "RX" : "D"+i, name));
  const a = analog.map((name,i) => named("A"+i, "A"+i, name));
  const reset = n => named("RST"+n, "RST", "RESET");
  const ground = n => named("GND"+n, "GND", "GND");
  const width = 1.776, height = 4.316;
  return [{
    id:"nano-33-ble-sense-rev2", name:"Arduino Nano 33 BLE Sense Rev2", family:"nRF52840", mcu:"nRF52840",
    style:"nano-33-ble-sense-rev2", width, height, color:"#168990", coreClockHz:64000000,
    flashBytes:1024*1024, ramBytes:256*1024, logicVoltage:3.3, adcMax:4095, adcDefaultBits:10,
    language:"arduino", dialects:["arduino"], hasPullDown:true, gpioWarningMa:15, pwmFrequency:500,
    pins:rows(
      [d[13],"3V3",named("AREF","AREF","AREF",{kind:"control"}),...a,
        named("VUSB","5V","VUSB_DISABLED",{kind:"nc"}),reset(1),ground(1),"VIN"],
      [...d.slice(2,13).reverse(),ground(2),reset(2),d[1],d[0]],
      width,height,{x:.762}
    ),
    pinAliases:{TX:digital[0],RX:digital[1],SS:digital[10],MOSI:digital[11],MISO:digital[12],
      SCK:digital[13],SDA:analog[4],SCL:analog[5]},
    numberedPins:Object.fromEntries([...digital,...analog].map((name,i) => [i,name])),
    analogPins:analog, analogChannelNumbers:true, pwmPins:[...digital,...analog],
    ledPin:digital[13], ledActiveLow:false, ledResistance:1000, serialPorts:["Serial","Serial1"],
    defaultPins:{led:digital[4],button:digital[2],adc:analog[0],pwm:digital[9],tx:digital[0],rx:digital[1]},
    arduinoDefines:{ARDUINO_ARDUINO_NANO33BLE:1,ARDUINO_ARCH_NRF52840:1},
    capabilities:{analogReadResolution:true,analogWriteResolution:true,analogWriteFrequency:false},
    sources:[pinout, variant+"/variant.cpp", variant+"/pins_arduino.h",
      "https://docs.arduino.cc/resources/datasheets/ABX00069-datasheet.pdf",
      "https://store.arduino.cc/products/nano-33-ble-sense-rev2-with-headers",
      "https://docs.arduino.cc/hardware/nano-33-ble-sense-rev2/",
      "https://docs.arduino.cc/tutorials/nano-33-ble-sense-rev2/cheat-sheet"],
    notes:[
      "D13 板载灯接 P0.13。UART 排针的 D0 是 TX，D1 是 RX。数字与模拟排针均为 3.3 V 逻辑。",
      "A0–A7 均支持模拟采样；默认 10 位读数，可改用 12 位。AREF 只保留位置，ADC 参考源切换未建模。",
      "按 ABX00070 已焊公排针版绘制，针脚行距 15.24 mm，出厂 5V/VUSB 焊桥未接通。BLE、板载 RGB、IMU、环境传感器、麦克风与 USB 协议未建模。"
    ]
  }];
}
