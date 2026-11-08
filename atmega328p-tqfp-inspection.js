const chipDatasheet = 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061B.pdf';
export const NANO_PINOUT = 'https://docs.arduino.cc/resources/pinouts/A000005-full-pinout.pdf';
const nanoSchematic = 'https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf';

// Microchip TQFP top view, starting at pin 1 by the corner mark.
const pinRows = [
  ['PD3', 'D3', '数字 D3。可作外部中断 INT1，也可由定时器 2 的 OC2B 输出 PWM。'],
  ['PD4', 'D4', '数字 D4。可用作定时器 0 的外部时钟 T0 或 USART 同步时钟 XCK。'],
  ['GND', null, '数字地，和封装第 5、21 脚接到板上的公共地。'],
  ['VCC', null, '数字供电端，和封装第 6 脚都接到板上的 5 V 电源网络。'],
  ['GND', null, '数字地，和封装第 3、21 脚接到板上的公共地。'],
  ['VCC', null, '数字供电端，和封装第 4 脚都接到板上的 5 V 电源网络。'],
  ['PB6', null, 'XTAL1。与 XTAL2 一起接板上的 16 MHz 谐振器。'],
  ['PB7', null, 'XTAL2。与 XTAL1 一起接板上的 16 MHz 谐振器。'],
  ['PD5', 'D5', '数字 D5。可由定时器 0 的 OC0B 输出 PWM。'],
  ['PD6', 'D6', '数字 D6。可由定时器 0 的 OC0A 输出 PWM，也可用作比较器正输入 AIN0。'],
  ['PD7', 'D7', '数字 D7。也可用作模拟比较器负输入 AIN1。'],
  ['PB0', 'D8', '数字 D8。也可用作定时器 1 的输入捕获 ICP1。'],
  ['PB1', 'D9', '数字 D9。可由定时器 1 的 OC1A 输出 PWM。'],
  ['PB2', 'D10', '数字 D10。可作 SPI 片选 SS，也可由定时器 1 的 OC1B 输出 PWM。'],
  ['PB3', 'D11', '数字 D11，与 ICSP 第 4 脚 MOSI 相连。也可由定时器 2 的 OC2A 输出 PWM。'],
  ['PB4', 'D12', '数字 D12，与 ICSP 第 1 脚 MISO 相连。'],
  ['PB5', 'D13', '数字 D13，与 ICSP 第 3 脚 SCK 相连，也连接板载 L 灯。'],
  ['AVCC', null, '为 ADC 与部分 Port C 电路供电。参考电压由 AREF 节点提供。'],
  ['ADC6', 'A6', '模拟 A6，对应 ADC 通道 6。仅可模拟输入。'],
  ['AREF', 'AREF', 'ADC 的参考电压，与板上的 AREF 排针相连。'],
  ['GND', null, '芯片地端，与封装第 3、5 脚接到板上的公共地。'],
  ['ADC7', 'A7', '模拟 A7，对应 ADC 通道 7。仅可模拟输入。'],
  ['PC0', 'A0', '模拟 A0，对应 ADC 通道 0，也可作数字 D14。'],
  ['PC1', 'A1', '模拟 A1，对应 ADC 通道 1，也可作数字 D15。'],
  ['PC2', 'A2', '模拟 A2，对应 ADC 通道 2，也可作数字 D16。'],
  ['PC3', 'A3', '模拟 A3，对应 ADC 通道 3，也可作数字 D17。'],
  ['PC4', 'A4', '模拟 A4，对应 ADC 通道 4。也可作 I²C 的 SDA 或数字 D18。'],
  ['PC5', 'A5', '模拟 A5，对应 ADC 通道 5。也可作 I²C 的 SCL 或数字 D19。'],
  ['PC6', 'RESET', '低电平触发复位，连接两侧 RESET 排针、板载 RST 按钮和 ICSP 第 5 脚。'],
  ['PD0', 'D0', '数字 D0，也是 USART 接收端 RXD。与板上 FT232RL 的串口信号相连。'],
  ['PD1', 'D1', '数字 D1，也是 USART 发送端 TXD。与板上 FT232RL 的串口信号相连。'],
  ['PD2', 'D2', '数字 D2，也可用作外部中断 INT0。']
];

const pins = pinRows.map(([signal, , summary], index) => ({ number: index + 1, signal, summary }));
const headerPinNumbers = new Map(pinRows.flatMap(([, header], index) => header ? [[header, index + 1]] : []));

export function atmega328pTqfpPinForHeader(header) {
  return headerPinNumbers.get(header) ?? null;
}

const blocks = [
  { id:'avr', title:'AVR 8 位内核', label:'AVR CPU', color:'#4a8297',
    detail:'取指、运算、执行中断。Nano 的主控在板上以 16 MHz 运行。' },
  { id:'flash', title:'Flash 程序存储器', label:'FLASH', color:'#397f70',
    detail:'32 KB Flash 保存程序与引导程序，断电后内容保留。' },
  { id:'sram', title:'SRAM 工作内存', label:'SRAM', color:'#427866',
    detail:'2 KB SRAM 存放运行中的变量、堆栈和缓冲区。' },
  { id:'eeprom', title:'EEPROM 非易失存储', label:'EEPROM', color:'#67568c',
    detail:'1 KB EEPROM 可保存设置或校准值，断电后仍可读回。' },
  { id:'clock', title:'时钟、复位与看门狗', label:'CLK / RESET', color:'#5e756b',
    detail:'外部谐振器提供节拍。复位脚拉低或看门狗超时都能重新启动芯片。', pins:[7,8,29] },
  { id:'gpio', title:'GPIO 与中断', label:'GPIO / INT', color:'#3a7c5d',
    detail:'Port B、C、D 可读写数字电平。D2、D3 还可以触发专用外部中断。', pins:[1,17,23,32] },
  { id:'adc', title:'10 位 ADC 与比较器', label:'ADC', color:'#9a683c',
    detail:'封装提供 8 路 ADC，读数范围 0 到 1023。A6、A7 只接模拟输入。', pins:[18,19,20,22,23,28] },
  { id:'timer', title:'定时器与 PWM', label:'TIMER / PWM', color:'#487b97',
    detail:'两个 8 位定时器和一个 16 位定时器负责计数和比较。D3、D5、D6、D9、D10、D11 可输出 PWM。', pins:[1,9,10,13,14,15] },
  { id:'serial', title:'USART、SPI 与 TWI', label:'USART / SPI / TWI', color:'#7d5481',
    detail:'USART 收发串口数据，SPI 提供同步串行通信，TWI 兼容 I²C。ICSP 使用 SPI 信号编程。', pins:[15,16,17,27,28,30,31] }
];

export const ATMEGA328P_TQFP_INSPECTION = {
  title:'ATmega328P', packageName:'TQFP-32', bodyLabel:'ATMEGA328P\nTQFP-32',
  style:'tqfp', bodyLabelSize:'7 × 7 × 1.0 mm', pinPitch:'0.80 mm',
  pins, blocks,
  references:[
    { url:chipDatasheet, label:'Microchip ATmega328P 数据手册' },
    { url:NANO_PINOUT, label:'Arduino Nano 官方引脚表' },
    { url:nanoSchematic, label:'Arduino Nano V3.0 官方原理图' }
  ],
  hints:{
    package:'照片中央是焊在板上的 ATmega328P。四边各有 8 根鸥翼脚，角上的圆点标出第 1 脚。板背面的 FT232RL 负责 USB 转串口。',
    pins:'俯视时从定位圆点旁的第 1 脚起，依次沿左、下、右、上四边逆时针编号。A6 和 A7 是独立的模拟输入。',
    functions:'功能方块按 Microchip 器件框图整理，方块的位置和尺寸用于讲解。'
  }
};
