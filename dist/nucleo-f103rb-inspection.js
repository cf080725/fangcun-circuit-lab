import { BOARD_PROFILES } from './board-profiles.js';
import { nucleoF103rbGeometry } from './nucleo-f103rb-geometry.js';
import { NUCLEO_CHIP_INSPECTION, nucleoChipPin } from './nucleo-f103rb-chip.js';

const product = 'https://www.st.com/en/evaluation-tools/nucleo-f103rb.html';
const manual = 'https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf';
const width = 7.6, depth = 9.12;
const topPoint = (x,z) => ({ x: .5 + x / width, y: .5 + z / depth });
const { b1, b2, ld2, mcu } = nucleoF103rbGeometry.features;
const headerNotes = {
  NC:'这个物理位置未连接。',
  GND:'板上地线，连接外部电路时可用作电位参考。',
  AGND:'模拟地参考端。',
  AREF:'Arduino 接口上的模拟参考节点。',
  VDD:'板上目标 MCU 的数字供电节点。',
  AVDD:'板上的模拟供电节点。',
  IOREF:'Arduino 扩展板用它读取目标板的逻辑电压。',
  U5V:'来自板载 ST-LINK USB 的 5 V 电源节点。',
  E5V:'外部 5 V 电源输入端。',
  VIN:'外部电源输入端。允许的电压和跳线设置见 UM1724。',
  '3V3':'板上的 3.3 V 电源。',
  '5V':'板上的 5 V 电源。'
};
const highlightedSignals = {
  PA5:'连接绿色 LD2，也引到 Arduino D13 和 Morpho CN10.11。输出高电平会点亮板载灯。',
  PC13:'连接蓝色 B1，也引到 Morpho CN7.23。松开为高电平，按住拉低。',
  NRST:'连接黑色 B2 复位键和外部 RESET 端点。拉低时复位目标 MCU。'
};
const chipBySignal = new Map(NUCLEO_CHIP_INSPECTION.pins.map(pin => [pin.signal,pin]));

const headers = BOARD_PROFILES['nucleo-f103rb'].pins.map(pin => {
  const chip = chipBySignal.get(pin.canonical);
  const label = pin.label === pin.canonical || !chip ? pin.label : `${pin.label} · ${pin.canonical}`;
  return {
    id:pin.id, label:`${label} · ${pin.location}`, canonical:pin.canonical, side:pin.side,
    group:pin.connector, chipPin:chip?.number ?? null,
    summary:highlightedSignals[pin.canonical] ?? headerNotes[pin.label] ?? chip?.summary ?? '板上独立排针位置，连接与跳线设置见 UM1724。',
    ...topPoint(pin.x,pin.z), hitWidth:.029, hitHeight:.024
  };
});
const boardParts = [
  ['BOARD_B1','B1 用户按键','PC13',b1],
  ['BOARD_B2','B2 复位键','NRST',b2],
  ['BOARD_LD2','LD2 绿色指示灯','PA5',ld2]
].map(([id,label,canonical,feature]) => ({
  id,label,canonical,part:true,group:'板载按键和灯',chipPin:nucleoChipPin(canonical),
  summary:highlightedSignals[canonical],modelX:feature.x,modelY:feature.topY,modelZ:feature.z,
  ...topPoint(feature.x,feature.z),hitWidth:Math.max(feature.w/width,.04),hitHeight:Math.max(feature.h/depth,.035)
}));

export const NUCLEO_F103RB_INSPECTION = {
  id:'nucleo-f103rb', title:'NUCLEO-F103RB',
  subtitle:'找出两侧的 Morpho 排针、Arduino 插座和板载按键，再追到 STM32 的封装引脚。',
  orientation:'Mini-B USB 在上。外侧 CN7 / CN10 为公排针，内侧 CN5 / CN6 / CN8 / CN9 为 Arduino 母座。',
  defaultPin:'D13', quickPins:['BOARD_B1','BOARD_LD2','BOARD_B2'],
  experiment:'试做 B1 控制 LD2',
  source:{url:manual+'#page=31',label:'ST UM1724 引脚表'},
  modelCredit:{source:manual,name:'ST MB1136 板卡手册',file:'./models/nucleo-f103rb.glb',
    note:'板体尺寸和针距来自手册，局部位置根据板图与照片重建。'},
  photo:{kind:'render',width:800,height:960,url:new URL('./assets/nucleo-f103rb-top.webp',import.meta.url),
    source:product,credit:'查看 ST 官方实物照片',
    note:'俯视图可点击。按键和灯可在实验台中操作。',
    alt:'NUCLEO-F103RB 板面渲染，Mini-B USB 在上，外侧为两组 Morpho 排针，内侧为 Arduino 母座',
    chip:{...topPoint(mcu.x,mcu.z),w:mcu.w/width,h:mcu.h/depth}
  },
  pins:[...headers,...boardParts], chip:NUCLEO_CHIP_INSPECTION
};
