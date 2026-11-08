// The Arduino-compatible connector subset of ST's board manuals.
const um1724 = "https://www.st.com/resource/en/user_manual/um1724-.pdf";
const um2324 = "https://www.st.com/resource/en/user_manual/um2324-stm32-nucleo64-boards-mb1360-stmicroelectronics.pdf";
const um1974 = "https://www.st.com/resource/en/user_manual/dm00244518-stm32-nucleo144-boardsstmicroelectronics.pdf";
const um2861 = "https://www.st.com/resource/en/user_manual/um2861-stm32u5-nucleo144-board-mb1549-stmicroelectronics.pdf";
const um3115 = "https://www.st.com/resource/en/user_manual/um3115-stm32h5-nucleo144-board-mb1404-stmicroelectronics.pdf";
const um1907 = "https://www.st.com/resource/en/user_manual/um1907-discovery-kit-for-stm32f7-series-with-stm32f746ng-mcu-stmicroelectronics.pdf";
const stBoards = "https://www.st.com/en/evaluation-tools/";

// UM1724 Tables 16, 19 and 23 agree on these Arduino pin assignments.
const digitalMb1136 = ["PA3", "PA2", "PA10", "PB3", "PB5", "PB4", "PB10", "PA8", "PA9", "PC7", "PB6", "PA7", "PA6", "PA5", "PB9", "PB8"];
const analogMb1136 = ["PA0", "PA1", "PA4", "PB0", "PC1", "PC0"];
const arduinoPwm = [3, 5, 6, 9, 10, 11];

export function makeStProfiles({ rows, named }) {
  const makeProfile = ({ model, mcu, family, megahertz, flashKiB, ramKiB,
    manual, digital, analog, pwm = arduinoPwm, ledPin = null,
    style = "nucleo", width = 7, height = 8.25, color = "#e9e9df",
    adcBits = 12, extraNotes = [], product = model.toLowerCase(),
    id = model.toLowerCase(), analogNumberStart }) => {
    const digitalAliases = digital.map((pin, index) => [`D${index}`, pin]);
    const analogAliases = analog.map((pin, index) => [`A${index}`, pin]);
    const supply = [named("NC", "NC", "NC"), named("IOREF", "IOREF", "3V3"),
      named("RESET", "RESET", "NRST"), "3V3", "5V", named("GND1", "GND", "GND"),
      named("GND2", "GND", "GND"), "VIN"];
    const left = [...supply, ...analogAliases.map(([id, pin]) => named(id, id, pin, { gap: .30 }))];
    const right = digitalAliases.slice().reverse().map(([id, pin], index) =>
      named(id, id, pin, { gap: index >= 8 ? .22 : 0 }));
    right.splice(2, 0, named("AREF", "AREF", "3V3"), named("GND3", "GND", "GND"));
    const numberedPins = Object.fromEntries([
      ...digital.map((pin, index) => [index, pin]),
      ...(analogNumberStart === undefined ? [] : analog.map((pin, index) => [analogNumberStart + index, pin]))
    ]);
    const isZio = style === "nucleo-144";
    return {
      id, name: `ST ${model}`, mcu, family, coreClockHz: megahertz * 1000000,
      flashBytes: flashKiB * 1024, ramBytes: ramKiB * 1024,
      logicVoltage: 3.3, adcMax: 2 ** adcBits - 1, nativeAdcBits: adcBits,
      style, width, height, color, language: "arduino", dialects: ["arduino"],
      pins: rows(left, right, width, height, { start: -.65, x: Math.min(2.15, width / 2 - .14) }),
      pinAliases: { ...Object.fromEntries([...digitalAliases, ...analogAliases]),
        SDA: digital[14], SCL: digital[15], IOREF: "3V3", RESET: "NRST", AREF: "3V3" },
      numberedPins, analogPins: analog, pwmPins: pwm.map(index => digital[index]),
      defaultPins: { led: digital[13], button: digital[2], adc: analog[0],
        pwm: digital[pwm[0]], tx: digital[1], rx: digital[0] },
      hasPullDown: true, ledPin, ledActiveLow: false, ledResistance: 510,
      partialPinout: true,
      footprintNote: "Arduino Uno V3 排针为教学布局。三维外形与排针坐标作了显示简化。",
      sources: [manual, `${stBoards}${product}.html`],
      notes: [
        `仅建模 ${isZio ? "ST Zio 中的 " : ""}Arduino Uno V3 排针和选定 PWM 脚，使用出厂默认接线。${isZio ? "Zio 扩展排针和 " : ""}${style.startsWith("nucleo") ? "ST Morpho 排针" : "显示屏与板载扩展设备"}尚未建模。`,
        "3.3 V GPIO。运行 Arduino 风格基础源码，串口为实验台字节流。",
        ...extraNotes
      ]
    };
  };
  const mb1136 = {
    manual: um1724, digital: digitalMb1136, analog: analogMb1136, ledPin: "PA5",
    extraNotes: ["A4/A5 使用 PC1/PC0 模拟输入，默认与 D14/D15 的 SDA/SCL 引脚分开。"]
  };
  return [
    makeProfile({ ...mb1136, model: "NUCLEO-F411RE", mcu: "STM32F411RET6", family: "STM32F4",
      megahertz: 100, flashKiB: 512, ramKiB: 128, analogNumberStart: 46 }),
    makeProfile({ ...mb1136, model: "NUCLEO-F446RE", mcu: "STM32F446RET6", family: "STM32F4",
      megahertz: 180, flashKiB: 512, ramKiB: 128, analogNumberStart: 46 }),
    makeProfile({ ...mb1136, model: "NUCLEO-L476RG", mcu: "STM32L476RGT6", family: "STM32L4",
      megahertz: 80, flashKiB: 1024, ramKiB: 128, analogNumberStart: 45 }),
    makeProfile({ model: "NUCLEO-G071RB", mcu: "STM32G071RBT6", family: "STM32G0",
      megahertz: 64, flashKiB: 128, ramKiB: 36, manual: um2324, ledPin: "PA5", analogNumberStart: 53,
      digital: ["PC5", "PC4", "PA10", "PB3", "PB5", "PB4", "PB14", "PA8", "PA9", "PC7", "PB0", "PA7", "PA6", "PA5", "PB9", "PB8"],
      analog: ["PA0", "PA1", "PA4", "PB1", "PB11", "PB12"],
      extraNotes: ["D0/D1 接 PC5/PC4，板载 ST-LINK 虚拟串口默认用 PA2/PA3。"] }),
    makeProfile({ model: "NUCLEO-H743ZI", mcu: "STM32H743ZIT6", family: "STM32H7",
      megahertz: 480, flashKiB: 2048, ramKiB: 1024, manual: um1974,
      style: "nucleo-144", height: 13.3, adcBits: 16, pwm: [3, 5, 6, 9, 10], analogNumberStart: 73,
      digital: ["PG9", "PG14", "PF15", "PE13", "PF14", "PE11", "PE9", "PF13", "PF12", "PD15", "PD14", "PA7", "PA6", "PA5", "PB9", "PB8"],
      analog: ["PA3", "PC0", "PC3", "PF3", "PF5", "PF10"],
      extraNotes: ["适用 MB1137 原版 H743ZI，默认点灯实验使用接到 D13 的外置 LED。"] }),
    makeProfile({ model: "NUCLEO-U575ZI-Q", mcu: "STM32U575ZIT6Q", family: "STM32U5",
      megahertz: 160, flashKiB: 2048, ramKiB: 786, manual: um2861,
      style: "nucleo-144", height: 13.3, adcBits: 14, pwm: [3, 5, 6, 9, 10], analogNumberStart: 73,
      digital: ["PG8", "PG7", "PF15", "PE13", "PF14", "PE11", "PE9", "PF13", "PF12", "PD15", "PD14", "PA7", "PA6", "PA5", "PB9", "PB8"],
      analog: ["PA3", "PA2", "PC3", "PB0", "PC1", "PC0"],
      extraNotes: ["D0/D1 默认接 PG8/PG7，板载 ST-LINK 虚拟串口默认接 PA9/PA10。"] }),
    makeProfile({ model: "NUCLEO-H563ZI", mcu: "STM32H563ZIT6", family: "STM32H5",
      megahertz: 250, flashKiB: 2048, ramKiB: 640, manual: um3115,
      style: "nucleo-144", height: 13.3, pwm: [3, 5, 6, 9, 10], analogNumberStart: 73,
      digital: ["PB7", "PB6", "PG14", "PE13", "PE14", "PE11", "PE9", "PG12", "PF3", "PD15", "PD14", "PB5", "PG9", "PA5", "PB9", "PB8"],
      analog: ["PA6", "PC0", "PC3", "PB1", "PC2", "PF11"],
      extraNotes: ["CN7/CN10 上的多个数字引脚与原版 H743ZI 不同。"] }),
    makeProfile({ model: "32F746GDISCOVERY", id: "stm32f746g-disco", product: "32f746gdiscovery",
      mcu: "STM32F746NGH6", family: "STM32F7", megahertz: 216, flashKiB: 1024, ramKiB: 336,
      manual: um1907, style: "stm32-discovery", width: 11, height: 7, color: "#244650", pwm: [3, 5, 6, 9, 10],
      digital: ["PC7", "PC6", "PG6", "PB4", "PG7", "PI0", "PH6", "PI3", "PI2", "PA15", "PA8", "PB15", "PB14", "PI1", "PB9", "PB8"],
      analog: ["PA0", "PF10", "PF9", "PF8", "PF7", "PF6"],
      extraNotes: ["按 UM1907 的 CN4–CN7 接口，点灯实验使用外置 LED。"] })
  ];
}
