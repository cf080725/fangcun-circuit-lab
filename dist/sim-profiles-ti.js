const shared = {
  style:'ti-launchpad', color:'#aa252b', width:5.842,
  logicVoltage:3.3, adcMax:4095, adcDefaultBits:10,
  language:'arduino', dialects:['arduino'], arduinoExport:false, partialPinout:true,
  hasPullDown:true, gpioWarningMa:5,
  capabilities:{analogReadResolution:true, analogWriteResolution:true, analogWriteFrequency:false},
  breadboardNote:'从板顶的 40 针 BoosterPack 接头引跳线，按 J1–J4 与脚号找位置。实物请接 3.3 V 逻辑。'
};

const pitch=.254;

function launchPadPins(top, reserved, headers) {
  const pins=[];
  const numberedPins={};
  const rows=[
    {header:'J1', first:1, step:1, side:'left', x:-2.286},
    {header:'J3', first:21, step:1, side:'left', x:-2.032},
    {header:'J2', first:20, step:-1, side:'right', x:2.286},
    {header:'J4', first:40, step:-1, side:'right', x:2.032}
  ];
  for(const {header,first,step,side,x} of rows) {
    headers[header].forEach((canonical,index)=>{
      const number=first+index*step;
      const id=`${header}_${number}`;
      const kind=/^[35]V/.test(canonical)?'power':canonical==='GND'?'ground'
        :/^(?:N?RST)$/.test(canonical)?'control':reserved.includes(canonical)?'reserved':'gpio';
      // The receptacles mount underneath the board with their long posts exposed on top.
      pins.push({id,label:canonical,canonical,kind,side,x,z:top+index*pitch,contact:'male'});
      if(kind==='gpio'||kind==='reserved')numberedPins[number]=canonical;
    });
  }
  return {pins,numberedPins,reservedPins:reserved};
}

function mspm0g3507() {
  const reserved=['PB23','PB24','PA26','PA27','PA22','PA18','PA10','PA11'];
  return {
    ...shared,
    id:'lp-mspm0g3507', name:'TI LP-MSPM0G3507', family:'MSPM0', mcu:'MSPM0G3507',
    boardMarking:'LP-MSPM0G3507', height:10.668, coreClockHz:80e6,
    flashBytes:128*1024, ramBytes:32*1024, logicHighThreshold:2.31, gpioWarningMa:4,
    ...launchPadPins(-.127,reserved,{
      J1:['3V3','PA25','PB23','PA8','PA26','PB24','PB9','PA27','PB2','PB3'],
      J3:['5V','GND','PB19','PA22','PB18','PA18','PA24','PA17','PA16','PA15'],
      J2:['GND','PB12','PB17','PB15','NRST','PB8','PB7','PB6','PB0','PB16'],
      J4:['PB4','PB1','PA28','PA31','PB20','PB13','PA10','PA11','PA12','PA13']
    }),
    analogPins:['PA25','PB19','PB18','PA24','PA17','PA16'],
    pwmPins:['PB12','PB4','PB1','PA28','PA31','PB20','PB13'],
    defaultPins:{led:'PB12',button:'PB8',adc:'PA25',pwm:'PB12'},
    sources:[
      'https://www.ti.com/lit/pdf/SLAU873',
      'https://www.ti.com/lit/zip/SLAR172',
      'https://www.ti.com/lit/ds/symlink/mspm0g3507.pdf'
    ],
    footprintNote:'依据 Rev A PCB 设计文件与 TI 用户指南 Figure 2-10 绘制 J1–J4 四排 BoosterPack 接头。母座位于底面，板顶露出长针。',
    notes:[
      '采用 USB 调试器供电的 3.3 V 逻辑。5V 仅为独立电源端，GPIO 不作为 5 V 输入使用。',
      '默认跳帽将 J1.3 接到 PB23、J3.29 接到 PA16。与板载按钮、温度／光传感器和 XDS 调试串口相连的端点只显示位置。',
      '教学编号对应 BoosterPack 脚号。ADC 示例由 J1.2 的 PA25（ADC0.2）采样，PWM 由 J2.19 的 PB12（TIMA0_C2）输出。',
      '额外扩展头、板载外设、MSPM0 SDK、CAN 与 LIN 留在 TI 官方工具中验证。'
    ]
  };
}

function msp430fr2355() {
  const reserved=['P2.2','P3.1','P3.2','P3.3','P3.5'];
  return {
    ...shared,
    id:'msp430fr2355', name:'TI MSP-EXP430FR2355', family:'MSP430FR', mcu:'MSP430FR2355',
    boardMarking:'MSP-EXP430FR2355', height:7.366, coreClockHz:24e6, intBits:16,
    flashBytes:32*1024, ramBytes:4*1024,
    ...launchPadPins(0,reserved,{
      J1:['3V3','P1.5','P1.6','P1.7','P3.6','P5.2','P4.5','P3.4','P1.3','P1.2'],
      J3:['5V','GND','P1.4','P5.3','P5.1','P5.0','P5.4','P1.1','P3.5','P3.1'],
      J2:['GND','P2.0','P2.2','P4.0','RST','P4.6','P4.7','P4.4','P2.5','P3.0'],
      J4:['P2.1','P6.0','P6.1','P6.2','P6.3','P6.4','P3.7','P2.4','P3.3','P3.2']
    }),
    analogPins:['P1.1','P1.2','P1.3','P1.4','P1.5','P1.6','P1.7','P5.0','P5.1','P5.2','P5.3'],
    pwmPins:['P2.0','P2.1','P1.6','P1.7','P5.0','P5.1','P6.0','P6.1','P6.2','P6.3','P6.4'],
    defaultPins:{led:'P2.0',button:'P4.0',adc:'P1.5',pwm:'P2.0'},
    sources:[
      'https://www.ti.com/lit/pdf/SLAU680',
      'https://www.ti.com/lit/zip/SLAR152',
      'https://www.ti.com/lit/ds/symlink/msp430fr2355.pdf'
    ],
    footprintNote:'依据 Rev A PCB 设计文件与 TI 用户指南 Figure 10 和 Figure 18 绘制 J1–J4 四排 BoosterPack 接头。母座位于底面，板顶露出长针。',
    notes:[
      '采用 eZ-FET 的 3.3 V 稳压供电。5V 为独立端，GPIO 使用 3.3 V。板上非易失存储为 32 KB FRAM。',
      '教学编号对应 BoosterPack 脚号。ADC 示例由 J1.2 的 P1.5（A5）采样，PWM 由 J2.19 的 P2.0（TB1.1）输出。',
      '板载按键 S2 与光电传感器共用端点只显示位置。Grove、SAC、板载灯和原生 MSP430 寄存器程序留在 TI 官方工具中验证。'
    ]
  };
}

export function makeTiProfiles() {
  return [mspm0g3507(),msp430fr2355()];
}
