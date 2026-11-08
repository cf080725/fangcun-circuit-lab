import {makePart} from './circuit.js';

const sketch = `// ESP32-DevKitC V4 · 从开发板排针接出按键输入
#include <Arduino.h>

// GPIO23 通过 I23 排针和同组的 J23 孔驱动外接 LED。
const int LED_PIN = 23;
// GPIO32 插在 A18，下方的孔都被板遮住，从板上的排针接按键。
const int BUTTON_PIN = 32;

void setup()
{
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP); // 松开时，内部上拉把输入保持在高电平。
}

void loop()
{
    // 按下时，按键把 GPIO32 经 J18 接地，输入变成低电平。
    digitalWrite(LED_PIN, digitalRead(BUTTON_PIN) == LOW ? HIGH : LOW);
    delay(10);
}
`;

export function makeDevkitcHeaderExercise() {
  return {
    files: {'sketch.ino':sketch},
    circuit: {
      version:2,
      boardId:'esp32-devkitc',
      powered:true,
      boot0:false,
      board:{x:-5,z:0,mount:{column:6,rotation:90}},
      breadboard:{x:1.8,z:0},
      components:[
        makePart('resistor','r1',.8,3.8),
        makePart('led','led1',2.1,3.8),
        makePart('button','button1',4.6,3.8)
      ],
      wires:[
        {id:'w1',a:'bb:j23',b:'r1:1',color:'#ea7246'},
        {id:'w2',a:'r1:2',b:'led1:A',color:'#ea7246'},
        {id:'w3',a:'led1:K',b:'bb:j24',color:'#24384a'},
        {id:'w4',a:'button1:3',b:'bb:j18',color:'#24384a'}
      ]
    }
  };
}
