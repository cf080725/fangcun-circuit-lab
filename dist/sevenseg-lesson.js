import {createCircuit,makePart} from './circuit.js';

export const segmentNames = ['a','b','c','d','e','f','g','dp'];
const digitMasks = [0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F];
const hex = n => '0x'+n.toString(16).toUpperCase().padStart(2,'0');

const code = `#include "stm32f10x.h"
#include "Delay.h"

// 把 2 改成 7，再应用代码。对照真正点亮的段和电流。
#define DISPLAY_DIGIT 2
// 设为 1 时，PA7 单独点亮小数点。
#define DECIMAL_POINT 0

// 位 0 到 6 依次对应 a、b、c、d、e、f、g。表中依次是数字 0 到 9。
static const uint16_t digit_segments[10] = {
    ${digitMasks.slice(0,5).map(hex).join(', ')},
    ${digitMasks.slice(5).map(hex).join(', ')}
};

int main(void) {
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = 0x00FF;         // PA0–PA7 各接一个 330 Ω 限流电阻。
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    uint16_t lit = 0;               // 上电后所有输出从低电平起步。
    if (DISPLAY_DIGIT >= 0 && DISPLAY_DIGIT <= 9) {
        lit = digit_segments[DISPLAY_DIGIT];
    }
    if (DECIMAL_POINT) lit |= GPIO_Pin_7;
    if (lit) GPIO_SetBits(GPIOA, lit);  // 共阴极接地，高电平让对应段发光。

    while (1) {
        Delay_ms(500);              // 保持输出，继续观察每段的电流。
    }
}
`;

export function makeSevenSegmentLesson() {
  const circuit = createCircuit('onboard');
  const display = {...makePart('sevenseg','display1',3.6,3.4),mount:{hole:'bb:g9',rotation:0}};
  circuit.components = [display];
  circuit.wires = [];
  const addWire = (a,b,color) => circuit.wires.push({id:'w'+(circuit.wires.length+1),a,b,color});
  const sockets = ['a12','a13','j12','j10','j9','a10','a9','j13'];
  const colors = ['#cf612e','#b46d31','#1a8c72','#277cb4','#9056ae','#ad5b78','#638842','#387483'];
  const upper = ['g','f','a','b'], lower = ['e','d','c','dp'];
  segmentNames.forEach((segment,index)=>{
    const onTop = upper.includes(segment);
    const row = onTop ? upper : lower;
    const resistor = makePart('resistor','r_'+segment,.25+row.indexOf(segment)*1.75,onTop?-3.35:3.35);
    circuit.components.push(resistor);
    addWire('mcu:PA'+index,resistor.id+':1',colors[index]);
    addWire(resistor.id+':2','bb:'+sockets[index],colors[index]);
  });
  // Pin 8 is on C11, the same strip as A11. Pin 3 is joined inside the display.
  addWire('mcu:GND1','bb:a11','#24384a');
  return {
    id:'sevenseg-gpio',boardId:'bluepill',title:'19 · 用八根 GPIO 点亮七段数码管',shortTitle:'七段数码管',
    language:'stm32-spl',watchPin:'PA0',files:{'main.c':code},circuitData:circuit,
    description:'一段对应一根 GPIO 和一个限流电阻。改代码后，对照发光段、支路电流与实际字形。',
    setup:['数码管插在 C / G 排。实物 8 脚所在的 C11 通过 A11 接地，3 脚与它在内部相通。',
      'PA0–PA6 分别经过 330 Ω 电阻接 a–g，PA7 接小数点。运行后先观察显示的 2。',
      '把 DISPLAY_DIGIT 改成 7，再应用。再把 DECIMAL_POINT 改为 1，观察小数点。'],
    learningGoals:['对照数字字形、位掩码和引脚电流。','辨认实物脚号，理解共阴极和每段独立限流。'],
    expected:'数字 2 点亮 a、b、d、e、g。数字 7 点亮 a、b、c。小数点独立控制。'
  };
}

export function readSevenSegment(id, data) {
  if (!data?.segments || !segmentNames.every(name=>Number.isFinite(data.segments[name]?.currentMa))) return null;
  const segments = segmentNames.map(name=>({name,currentMa:data.segments[name].currentMa}));
  // Exclude tiny leakage and floating-node solver conductances from the glyph.
  const on = segments.filter(segment=>segment.currentMa >= .02).map(segment=>segment.name);
  const mask = segmentNames.slice(0,7).reduce((value,name,index)=>on.includes(name)?value|(1<<index):value,0);
  const digit = digitMasks.indexOf(mask);
  return {id,segments,on,digit:digit<0?null:digit,decimal:on.includes('dp'),mask};
}

export function sevenSegmentLabel(reading) {
  if (!reading) return '暂无读数';
  const {digit,decimal,mask}=reading;
  if (digit!==null) return '显示 '+digit+(decimal?'＋小数点':'');
  if (mask) return '自定义段形'+(decimal?'＋小数点':'');
  return decimal?'仅小数点':'全灭';
}
