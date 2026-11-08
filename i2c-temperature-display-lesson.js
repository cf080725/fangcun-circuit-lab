import {createCircuit, makePart} from './circuit.js';

export const stm32TemperatureDisplayLessonId='bluepill:i2c-temperature-display';
export const temperatureDisplaySdaWires=Object.freeze({temp1:'display-sensor-sda',oled1:'display-oled-sda'});

export function bluePillI2cTemperatureDisplayLesson(){
  const circuit=createCircuit('onboard','bluepill');
  circuit.board.mount={column:6,rotation:90};
  circuit.components=[
    {...makePart('mcp9808','temp1',1.13,3.8),rotation:180,temperatureC:34.5},
    makePart('ssd1306','oled1',4.36,4.49),
  ];
  // With the Blue Pill seated across C/G, each exposed I/J pair reaches the
  // same five-hole strip. Keep separate jumpers for the two devices.
  circuit.wires=[
    ['display-sensor-vin','bb:i25','temp1:VIN','#bc4842'],
    ['display-sensor-gnd','bb:i24','temp1:GND','#34454b'],
    [temperatureDisplaySdaWires.temp1,'bb:i20','temp1:SDA','#367fad'],
    ['display-sensor-scl','bb:i19','temp1:SCL','#9970c1'],
    ['display-oled-vin','bb:j25','oled1:VIN','#bc4842'],
    ['display-oled-gnd','bb:j24','oled1:GND','#34454b'],
    [temperatureDisplaySdaWires.oled1,'bb:j20','oled1:SDA','#367fad'],
    ['display-oled-scl','bb:j19','oled1:SCL','#9970c1'],
  ].map(([id,a,b,color])=>({id,a,b,color}));

  return {
    id:stm32TemperatureDisplayLessonId,boardId:'bluepill',title:'温度显示 · STM32 共享 I²C',shortTitle:'STM32 温度显示',
    language:'c',nativeOnly:true,watchPin:'PB7',circuitData:circuit,
    files:{'temperature-display.c':'// 本实验运行预编译的 Cortex-M3 固件。可在「温度与 I²C」查看并下载原始 C 源码。\n'},
    description:'Blue Pill 通过同一条 I²C 总线读取 MCP9808，再把读数写到 SSD1306 屏幕。换一份固件，用摄氏或华氏显示同一次温度测量。',
    setup:[
      'Blue Pill 已插在 C/G 排。从 I/J 排引出两组跳线。19 列接 PB6/SCL，20 列接 PB7/SDA，24 列是 GND，25 列是 3.3 V。',
      '环境设为 34.5 °C。先运行摄氏固件，再运行华氏固件，比较 OLED、串口和逻辑分析中的温度读取。',
      '一次拔掉一个模块的 SDA，查看地址应答和显示结果，再插回原孔恢复。',
    ],
    learningGoals:[
      '用不同的七位地址区分总线上的 MCP9808（0x18）和 SSD1306（0x3D）。',
      '在总线上找到温度读取和屏幕写入两类事务，观察一条支线断开对另一台设备的影响。',
    ],
    expected:'34.5 °C 时，摄氏固件显示 34.5 C，华氏固件显示 94.1 F。传感器 SDA 断开时 OLED 显示 ERR。OLED 的 SDA 断开时传感器仍能读取，屏幕停止更新。',
  };
}
