const shieldPitch = .254;
const shieldHalfWidth = 2.413;
const source = {
  k64Guide:'https://www.mouser.com/datasheet/2/302/NXP_01112019_FRDM_K64F-1891948.pdf',
  k64QuickStart:'https://community.nxp.com/pwmxy87654/attachments/pwmxy87654/kinetis-sdk/6241/1/Quick%20Reference%20Card.pdf',
  k64Device:'https://www.nxp.com/docs/en/data-sheet/K64P144M120SF5.pdf',
  k64Map:'https://github.com/zephyrproject-rtos/zephyr/blob/main/boards/nxp/frdm_k64f/frdm_k64f.dts',
  mcxGuide:'https://community.nxp.com/pwmxy87654/attachments/pwmxy87654/MCX/4254/1/UM12018%20%283%29.pdf',
  mcxPower:'https://docs.nxp.com/bundle/UM12018/page/topics/power_supplies.html',
  mcxDevice:'https://www.nxp.com/docs/en/data-sheet/MCXNP184M150F70.pdf',
  mcxMap:'https://github.com/zephyrproject-rtos/zephyr/blob/main/boards/nxp/frdm_mcxn947/frdm_mcxn947.dtsi'
};

// The board is drawn with the USB and Ethernet end at negative z. The J1/J2
// numbering runs toward that end; the J3/J4 numbering runs away from it.
function headerSocket(header, number, id, label, canonical, kind='gpio') {
  const {side,start,count,name}=header;
  const row=Math.floor((number-1)/2);
  const offset=side==='right'?count-1-row:row;
  const isInner=number%2===1;
  return {
    id,label,canonical,kind,side,contact:'female',
    connector:name,connectorPin:number,
    x:(side==='right'?1:-1)*(shieldHalfWidth-(isInner?shieldPitch:0)),
    z:start+offset*shieldPitch
  };
}

function frdmShieldProfile({height,width,headerStart,digital,analog,extension=[],ioRef=false,...data}) {
  const j1={name:'J1',side:'right',start:headerStart.j1,count:8};
  const j2={name:'J2',side:'right',start:headerStart.j2,count:10};
  const j3={name:'J3',side:'left',start:headerStart.j3,count:8};
  const j4={name:'J4',side:'left',start:headerStart.j4,count:6};
  const j2DigitalPins=[2,4,6,8,10,12,18,20];
  const pins=[
    headerSocket(j3,8,'3V3','3V3','3V3','power'),
    headerSocket(j3,4,'IOREF',ioRef?'IOREF':'3V3','3V3','power'),
    headerSocket(j3,6,'RESET','RESET','RESET','control'),
    headerSocket(j3,10,'5V','5V','5V','power'),
    headerSocket(j3,12,'GND1','GND','GND','ground'),
    headerSocket(j3,14,'GND2','GND','GND','ground'),
    headerSocket(j3,16,'VIN','VIN','VIN','power'),
    headerSocket(j2,14,'GND3','GND','GND','ground'),
    headerSocket(j2,16,'AREF',ioRef?'VDD_ANA':'AREF','AREF','control'),
    ...digital.map((canonical,index)=>{
      const label='D'+index;
      const [header,number]=index<8?[j1,2+index*2]:[j2,j2DigitalPins[index-8]];
      return headerSocket(header,number,label,label,canonical);
    }),
    ...analog.map((canonical,index)=>headerSocket(j4,2+index*2,'A'+index,'A'+index,canonical)),
    ...extension.map(([number,canonical])=>headerSocket(j3,number,`J3_${number}`,canonical,canonical))
  ];
  const numberedPins=Object.fromEntries([...digital,...analog,...extension.map(([,pin])=>pin)].map((pin,index)=>[index,pin]));
  return {
    ...data,height,width,pins,numberedPins,analogPins:analog,analogChannelNumbers:true,
    pinAliases:{SDA:digital[14],SCL:digital[15]},
    style:'nxp-frdm',language:'arduino',dialects:['arduino'],partialPinout:true,arduinoExport:false,
    logicVoltage:3.3,logicHighThreshold:2.31,hasPullDown:true,gpioWarningMa:4,starterLedResistance:1000,
    adcMax:65535,adcDefaultBits:10,
    capabilities:{analogReadResolution:true,analogWriteResolution:true,analogWriteFrequency:false}
  };
}

export function makeNxpProfiles() {
  return [
    frdmShieldProfile({
      id:'frdm-k64f',name:'FRDM-K64F · Rev E',family:'Kinetis K64',mcu:'MK64FN1M0VLL12',boardMarking:'FRDM-K64F',
      width:5.3,height:8.1,color:'#263a60',coreClockHz:120e6,flashBytes:1024*1024,ramBytes:256*1024,
      headerStart:{j1:.37,j2:-2.32,j3:-1.37,j4:.94},
      digital:['PTC16','PTC17','PTB9','PTA1','PTB23','PTA2','PTC2','PTC3','PTC12','PTC4','PTD0','PTD2','PTD3','PTD1','PTE25','PTE24'],
      analog:['PTB2','PTB3','PTB10','PTB11','PTC11','PTC10'],
      pwmPins:['PTA1','PTA2','PTC2','PTC4','PTD0','PTD2'],
      defaultPins:{led:'PTD1',button:'PTB9',adc:'PTB2',pwm:'PTA1',tx:'PTC17',rx:'PTC16'},
      logicLowThreshold:1.155,
      footprintNote:'FRDM-K64F Rev E 教学布局。外排 Arduino R3 母座按 2.54 mm 节距排列，板形和接头位置作显示简化。',
      notes:[
        '以 Rev E 接线为准。D8 接 PTC12，早期 Rev D 的 D8 接 PTA0。',
        '示例使用外接灯 D13、按键 D2、ADC A0 及 FTM0 PWM D3。5V 脚与 3.3 V GPIO 电源分开。',
        '实验台提供标注的外排接头、虚拟串口和 Arduino 风格接口。MCUXpresso 原生固件、板载灯和按键、以太网及其他接头功能未建模。'
      ],
      sources:[source.k64Guide,source.k64QuickStart,source.k64Device,source.k64Map]
    }),
    frdmShieldProfile({
      id:'frdm-mcxn947',name:'FRDM-MCXN947 · Rev C',family:'MCX N',mcu:'MCXN947VDF',boardMarking:'FRDM-MCXN947',
      width:5.5,height:11.8,color:'#272a2e',coreClockHz:150e6,flashBytes:2*1024*1024,ramBytes:512*1024,
      headerStart:{j1:-1.63,j2:-4.42,j3:-3.57,j4:-1.14},ioRef:true,
      digital:['P4_3','P4_2','P0_29','P1_23','P0_30','P1_21','P1_2','P0_31','P0_28','P0_10','P0_27','P0_24','P0_26','P0_25','P4_0','P4_1'],
      analog:['ADC0_A0','ADC0_B0','P0_14','P0_22','P0_15','P0_23'],
      analogOnly:['ADC0_A0','ADC0_B0'],
      extension:[[5,'P2_3'],[7,'P2_2'],[9,'P2_5'],[11,'P2_4'],[13,'P2_7'],[15,'P2_6']],
      pwmPins:['P2_2','P2_3','P2_4','P2_5','P2_6','P2_7'],
      defaultPins:{led:'P0_25',button:'P0_29',adc:'ADC0_A0',pwm:'P2_6',tx:'P4_2',rx:'P4_3'},
      footprintNote:'FRDM-MCXN947 Rev C 教学布局。J1–J4 的接点按 UM12018 Rev 2.0 工厂默认配置与 2.54 mm 节距绘制。',
      notes:[
        'J4 的 A0 与 A1 是专用模拟输入。D3 在工厂配置下接 P1_23，PWM 示例用已接通的 J3.15（P2_6 / PWM1_A0）。',
        'J3.5 至 J3.15 的奇数脚是共享的 PWM 扩展触点。示例按未接相机与 microSD 的状态建模。',
        '以 3.3 V GPIO 运行基础源码行为仿真。第二核心、MCUXpresso 原生固件、板载外设及未列出的接点不参与仿真。'
      ],
      sources:[source.mcxGuide,source.mcxPower,source.mcxDevice,source.mcxMap]
    })
  ];
}
