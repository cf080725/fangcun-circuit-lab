import {makeBoardStarter} from './board-profiles.js';
import {makePart} from './circuit.js';

export const i2cTemperatureLessonId='uno-r3:i2c-temperature';
export const stm32TemperatureLessonId='bluepill:i2c-temperature';

const code=`// UNO R3 的 A4 接 SDA，A5 接 SCL。温度模块由 5 V 供电并与开发板共地。
// D12 经过 330 Ω 电阻接报警灯。报警阈值由这份程序决定。
#include <Wire.h>

#define SENSOR_ADDR 0x18
#define ALARM_C 30
const int alarmPin = 12;

int wireStatus = -1;
int receivedBytes = 0;
int temperatureValid = 0;
unsigned int temperatureWord = 0;
float measuredC = 0;

void setup() {
    pinMode(alarmPin, OUTPUT);
    digitalWrite(alarmPin, LOW);
    Wire.begin();
    delay(250);  // 给默认分辨率的首次温度转换留出时间。
}

void loop() {
    temperatureValid = readTemperature();
    digitalWrite(alarmPin, temperatureValid && measuredC >= ALARM_C ? HIGH : LOW);
    delay(300);
}

int readTemperature() {
    receivedBytes = 0;
    Wire.beginTransmission(SENSOR_ADDR);
    Wire.write(0x05);  // 选择 MCP9808 的环境温度寄存器。
    wireStatus = Wire.endTransmission(false);  // 保持总线，下一步发重复 START。
    if (wireStatus != 0) return 0;

    receivedBytes = Wire.requestFrom(SENSOR_ADDR, 2);  // 先收高字节，再收低字节。
    if (receivedBytes != 2 || Wire.available() != 2) return 0;
    unsigned int highByte = Wire.read();
    unsigned int lowByte = Wire.read();
    temperatureWord = (highByte << 8) | lowByte;

    // 去掉 3 个温度边界标志位，再把 13 位补码还原为有符号数。
    int sixteenths = temperatureWord & 0x1FFF;
    if (sixteenths & 0x1000) sixteenths -= 0x2000;
    measuredC = sixteenths / 16.0;
    return 1;
}
`;

export function makeI2cTemperatureLesson(boardId='uno-r3'){
  const stm32=boardId==='bluepill';
  const {circuit}=makeBoardStarter(boardId,'blink');
  const {sda,scl,vcc,alarm}=stm32?{sda:'PB7',scl:'PB6',vcc:'3V3',alarm:'PA0'}:{sda:'A4',scl:'A5',vcc:'5V',alarm:'D12'};
  circuit.components=[{...makePart('mcp9808','temp1',2.8,-4.0),temperatureC:25.25},
    makePart('resistor','r1',1.4,4.1),makePart('led','led1',3.4,4.1)];
  circuit.wires=[
    ['mcu:'+vcc,'temp1:VIN','#bc4842'],['mcu:GND1','temp1:GND','#34454b'],
    ['mcu:'+sda,'temp1:SDA','#367fad'],['mcu:'+scl,'temp1:SCL','#9970c1'],
    ['mcu:'+alarm,'r1:1','#dd7147'],['r1:2','led1:A','#dd7147'],['led1:K','mcu:GND3','#34454b']
  ].map(([a,b,color],index)=>({id:'w'+(index+1),a,b,color}));
  if(stm32)return {id:stm32TemperatureLessonId,boardId,title:'I²C 温度报警 · STM32 原生固件',shortTitle:'STM32 温度报警',
    language:'c',nativeOnly:true,watchPin:alarm,files:{'temperature.c':'// 本实验从 Cortex-M3 固件运行。右侧可查看与下载原始 C 源码。\n'},circuitData:circuit,
    description:'用 STM32 的 I²C1 读取 MCP9808。比较同一套接线上两份原生固件的串口、报警灯和逻辑波形。',
    setup:['PB7 接 SDA，PB6 接 SCL。MCP9808 由 3.3 V 供电，与开发板共地。PA0 通过 330 Ω 电阻驱动外接灯。',
      '把环境设为 34.5 °C，运行 30 °C 固件，再换 38 °C 固件。比较串口、总线读数和报警灯。',
      '换回 30 °C 固件，打开逻辑分析并捕获下一次失败，再断开 SDA。'],
    learningGoals:['用 I²C1 读回 0x05 寄存器，再将两个字节还原为温度。','比较程序阈值变化对同一个电路的影响。'],
    expected:'同为 34.5 °C 时，30 °C 固件点亮外接灯，38 °C 固件关灯。断开 SDA 后，读数失效，外接灯熄灭。'};
  return {id:i2cTemperatureLessonId,boardId:'uno-r3',title:'从 I²C 读温度并报警',shortTitle:'I²C 温度报警',
    language:'arduino',watchPin:'D12',files:{'TemperatureAlarm.ino':code},circuitData:circuit,
    description:'从 MCP9808 读取两个字节，解出正负温度。改变环境设定和报警阈值，比较外接灯。',
    setup:['VIN 接 5 V、GND 共地，A4 接 SDA、A5 接 SCL。D12 通过 330 Ω 电阻驱动外接灯。',
      '运行后把环境设为 34.5 °C。打开「温度与 I²C」查看 0x05 寄存器的两个字节和报警灯。',
      '保持 34.5 °C，把 ALARM_C 从 30 改为 38 并应用。试试负温读数，最后拔掉 SDA 看程序如何处理无效测量。'],
    learningGoals:['用重复 START 从指定寄存器读回两个字节，并正确解码负温。','区分环境设定、传感器采样、程序读数和报警阈值。'],
    expected:'34.5 °C 高于初始 30 °C 阈值，外接灯亮。把代码阈值改为 38 °C 并应用，温度保持 34.5 °C，灯熄灭。'};
}
