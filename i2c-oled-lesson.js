import {makeBoardStarter} from './board-profiles.js';
import {makePart} from './circuit.js';

export const i2cOledLessonId='uno-r3:i2c-oled';

const code=`// UNO R3 的 A4 接 SDA，A5 接 SCL。OLED 由 5 V 供电并与开发板共地。
#include <Wire.h>

#define OLED_ADDR 0x3D  // 模块的七位地址。改成 0x3C 后，观察地址应答。
#define BAR_COLUMNS 40  // 试改成 96，重新应用，再比较屏幕上填充的长度。

int wireStatus = -1;
unsigned long framesWritten = 0;

void setup() {
    Wire.begin();  // UNO 使用硬件 I²C 引脚 A4、A5。
}

void loop() {
    drawBar();
    delay(350);  // 留出时间观察这一帧和传输结果。
}

void drawBar() {
    Wire.beginTransmission(OLED_ADDR);
    Wire.write(0x00);               // 后面是 SSD1306 命令。
    Wire.write(0x8D); Wire.write(0x14);  // 开启模块内的电荷泵。
    Wire.write(0xA1); Wire.write(0xC8);  // 设置屏幕行列的扫描方向。
    Wire.write(0xA4); Wire.write(0xA6); Wire.write(0xAF);  // 正常显示并点亮面板。
    Wire.write(0x20); Wire.write(0x00);  // 按水平方向写入显示内存。
    Wire.write(0x21); Wire.write(0); Wire.write(127);  // 列 0 到 127。
    Wire.write(0x22); Wire.write(3); Wire.write(4);     // 第 3、4 页，每页 8 行。
    wireStatus = Wire.endTransmission();
    if (wireStatus != 0) return;  // 没收到应答就先跳过这一帧。

    for (int offset = 0; offset < 256; offset += 31) {
        Wire.beginTransmission(OLED_ADDR);
        Wire.write(0x40);  // 后面是像素数据，控制字节也占一个缓冲位置。
        for (int i = offset; i < 256 && i < offset + 31; i++) {
            Wire.write(barByte(i % 128, i / 128));
        }
        wireStatus = Wire.endTransmission();
        if (wireStatus != 0) return;
    }
    framesWritten++;
}

byte barByte(int column, int page) {
    if (column < 4 || column > 123) return 0;
    if (column == 4 || column == 123) return 0xFF;
    if (column < 5 + BAR_COLUMNS) return page == 0 ? 0xFD : 0xBF;
    return page == 0 ? 0x01 : 0x80;
}
`;

export function makeI2cOledLesson(){
  const {circuit}=makeBoardStarter('uno-r3','blink');
  circuit.components=[makePart('ssd1306','oled1',2.8,-4.1)];
  circuit.wires=[
    ['mcu:5V','oled1:VIN','#bc4842'],['mcu:GND1','oled1:GND','#34454b'],
    ['mcu:A4','oled1:SDA','#367fad'],['mcu:A5','oled1:SCL','#9970c1']
  ].map(([a,b,color],index)=>({id:'w'+(index+1),a,b,color}));
  return {id:i2cOledLessonId,boardId:'uno-r3',title:'用 I²C 写入 OLED 像素',shortTitle:'I²C OLED 像素',
    language:'arduino',watchPin:'A4',files:{'OledPixels.ino':code},circuitData:circuit,
    description:'按地址给 OLED 写像素。改填充宽度看图案变化，再试错地址或断开 SDA。',
    setup:['VIN 接 5 V、GND 共地，A4 接 SDA、A5 接 SCL。模块设为 0x3D。',
      '运行并查看「OLED 与 I²C」。把 BAR_COLUMNS 从 40 改成 96，再应用。',
      '保持屏幕通电，把 OLED_ADDR 改成 0x3C，或拔掉 SDA 跳线。对照旧图像与应答状态。'],
    learningGoals:['理解地址、命令字节和像素字节各自的作用。','用应答结果区分已接收的更新和一次失败的写入。'],
    expected:'宽度由 40 增至 96 列时，填充明显变长。写到错误地址后返回未应答，屏幕通电时保留上一帧。'};
}
