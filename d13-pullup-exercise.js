import {makeBoardStarter} from './board-profiles.js';
import {makePart} from './circuit.js';

const sketch = `// Uno R3 与经典 Nano：测量 D13 的内部上拉
#include <Arduino.h>

const int TEST_PIN = 13;

void setup()
{
    Serial.begin(9600);
    // 按键松开时，D13 由内部上拉和板上的电路共同决定。
    pinMode(TEST_PIN, INPUT_PULLUP);
}

void loop()
{
    // 按下时，D13 经 1 kΩ 电阻连到 GND。
    // 打印实际读到的电平：1 为 HIGH，0 为 LOW。
    Serial.println(digitalRead(TEST_PIN));
    delay(250);
}
`;

export function makeD13PullupExercise(boardId) {
  if (boardId !== 'uno-r3' && boardId !== 'nano') return null;
  const {circuit} = makeBoardStarter(boardId, 'blink');
  const ground = boardId === 'uno-r3' ? 'GND3' : 'GND1';
  circuit.components = [
    {...makePart('resistor','r1',.8,4.1),resistance:1000,displayName:'1 kΩ 保护电阻'},
    makePart('button','button1',3.1,4.1)
  ];
  circuit.wires = [
    {id:'w1',a:'mcu:D13',b:'r1:1',color:'#48a6c8'},
    {id:'w2',a:'r1:2',b:'button1:1',color:'#48a6c8'},
    {id:'w3',a:'button1:3',b:'mcu:'+ground,color:'#24384a'}
  ];
  return {files:{'sketch.ino':sketch},circuit};
}
