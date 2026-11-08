// The PCA10056/PCA10095 Arduino-compatible connector maps are from Nordic's
// Figure 21 and the matching Zephyr board devicetrees. PCA10156 uses its own
// P0/P1/P2 connectors, whose pin positions follow Nordic's connector diagram.
const nordicDocs = 'https://docs.nordicsemi.com/r/bundle/';
const zephyrBoards = 'https://github.com/zephyrproject-rtos/zephyr/blob/main/boards/nordic/';
const nrf52840 = {
  id:'nrf52840-dk', mcu:'nRF52840', boardMarking:'PCA10056',
  coreClockHz:64e6, flashBytes:1024*1024, ramBytes:256*1024,
  analog:['P0.03','P0.04','P0.28','P0.29','P0.30','P0.31'],
  digital:['P1.01','P1.02','P1.03','P1.04','P1.05','P1.06','P1.07','P1.08',
    'P1.10','P1.11','P1.12','P1.13','P1.14','P1.15','P0.26','P0.27'],
  referencePin:'P0.02', referenceLabel:'IOREF',
  sources:[
    nordicDocs+'ug_nrf52840_dk/page/ug/dk/connector_if.html',
    nordicDocs+'ug_nrf52840_dk/page/ug/dk/hw_power_supply.html',
    nordicDocs+'ps_nrf52840/page/gpio.html',
    zephyrBoards+'nrf52840dk/nrf52840dk_nrf52840.dts'
  ]
};
const nrf5340 = {
  id:'nrf5340-dk', mcu:'nRF5340', boardMarking:'PCA10095',
  coreClockHz:128e6, flashBytes:1024*1024, ramBytes:512*1024,
  analog:['P0.04','P0.05','P0.06','P0.07','P0.25','P0.26'],
  digital:['P1.00','P1.01','P1.04','P1.05','P1.06','P1.07','P1.08','P1.09',
    'P1.10','P1.11','P1.12','P1.13','P1.14','P1.15','P1.02','P1.03'],
  referencePin:'P0.27', referenceLabel:'VDD',
  sources:[
    'https://docs-be.nordicsemi.com/bundle/nRF5340_DK/raw/resource/enus/nRF5340_DK_User_Guide_v2.0.0.pdf',
    nordicDocs+'ps_nrf5340/page/gpio.html',
    zephyrBoards+'nrf5340dk/nrf5340dk_common.dtsi',
    zephyrBoards+'nrf5340dk/nrf5340_cpuapp_common.dtsi'
  ]
};

const shared = {
  style:'nordic-dk', color:'#17526f', language:'arduino', dialects:['arduino'],
  partialPinout:true, arduinoExport:false, hasPullDown:true, gpioWarningMa:8,
  capabilities:{analogReadResolution:true, analogWriteResolution:true, analogWriteFrequency:false}
};
const pitch=.254;
const contact=(id,label,canonical,kind='gpio')=>({id,label,canonical,kind});

function shieldDk({id,mcu,boardMarking,coreClockHz,flashBytes,ramBytes,analog,digital,referencePin,referenceLabel,sources}) {
  const analogContacts=analog.map((pin,index)=>contact(`A${index}`,`A${index}`,pin));
  const digitalContacts=digital.map((pin,index)=>contact(`D${index}`,`D${index}`,pin));
  const power=[
    contact('P1_1','VDD','VDD','power'), contact('P1_2',referenceLabel,'VDD','power'),
    contact('RESET','RESET','RESET','control'), contact('VDD','VDD','VDD','power'),
    contact('5V','5V','5V','power'), contact('GND1','GND','GND','ground'),
    contact('GND2','GND','GND','ground'), contact('P1_8','NC','P1_8','nc')
  ];
  function row(entries,side,x,z) {
    return entries.map((pin,index)=>({...pin,side,x,z:z+index*pitch,contact:'female'}));
  }
  const upperDigital=[digitalContacts[15],digitalContacts[14],
    contact('AREF','AREF',referencePin,'control'),contact('GND3','GND','GND','ground'),
    ...digitalContacts.slice(8,14).reverse()];
  const pins=[
    ...row(power,'left',-2.4,-4.02), ...row(analogContacts,'left',-2.4,-1.76),
    ...row(upperDigital,'right',2.4,-4.9), ...row(digitalContacts.slice(0,8).reverse(),'right',2.4,-2.2)
  ];
  const core=id==='nrf5340-dk'?' · 应用核':'', pwm=[3,5,6,9,10,11];
  return {
    ...shared,id,name:`${mcu} DK${core}`,family:mcu,mcu,boardMarking,coreClockHz,flashBytes,ramBytes,
    width:6.35,height:13.6,logicVoltage:3,logicRail:'VDD',logicHighThreshold:2.1,adcMax:4095,adcDefaultBits:10,
    pins, pinAliases:{SDA:digital[14],SCL:digital[15],IOREF:'VDD'},
    numberedPins:Object.fromEntries([...digital,...analog].map((pin,index)=>[index,pin])),
    analogPins:analog, analogChannelNumbers:true, pwmPins:pwm.map(index=>digital[index]),
    defaultPins:{led:digital[13],button:digital[2],adc:analog[0],pwm:digital[3],tx:digital[1],rx:digital[0]},
    sources,
    footprintNote:`${boardMarking} 的 P1/P2/P3/P4 接口子集。触点排列参考 Nordic 图纸，三维尺寸用于教学。`,
    notes:[
      '按板载稳压器模式建模，VDD 为 3.0 V。5 V 是独立电源脚，GPIO 使用 VDD 电平。',
      '接线使用已核对的 Arduino R3 兼容排针子集。AREF 仅显示接点，模拟参考源不可切换。四个入门实验使用外接元件。',
      'Arduino 风格代码仅在实验台执行。Zephyr、无线、板载按键和灯的电气行为及其余接口尚未建模。'
    ]
  };
}

function nrf54l15Dk() {
  const pins=[];
  const headers=[{name:'P0',z:-2.06},{name:'P1',z:-.78},{name:'P2',z:.49}];
  const put=(pin,header,index,lower)=>{
    const z=headers.find(row=>row.name===header).z+(lower?pitch:0);
    pins.push({...pin,side:`${header.toLowerCase()}-${lower?'bottom':'top'}`,x:-.68+index*pitch,z,contact:'male'});
  };
  for(const {name} of headers) {
    put(contact(`${name}_GND_L`,'GND','GND','ground'),name,0,false);
    put(contact(`${name}_VDDIO_R`,'VDDIO','VDDIO','power'),name,9,false);
    put(contact(`${name}_VDDIO_L`,'VDDIO','VDDIO','power'),name,0,true);
    put(contact(`${name}_GND_R`,'GND','GND','ground'),name,9,true);
  }
  put(contact('P1.11','P1.11','P1.11'),'P1',6,false);
  put(contact('P1.12','P1.12','P1.12'),'P1',7,true);
  for(const [gpio,index] of [['P2.06',4],['P2.08',5],['P2.10',6]]) put(contact(gpio,gpio,gpio),'P2',index,true);
  const digital=['P1.11','P1.12','P2.06','P2.08','P2.10'];
  const numberedPins=Object.fromEntries(digital.map(pin=>{
    const [port,index]=pin.slice(1).split('.').map(Number);
    return [port*32+index,pin];
  }));
  return {
    ...shared,id:'nrf54l15-dk',name:'nRF54L15 DK · 3.3 V 配置',family:'nRF54L15',mcu:'nRF54L15',boardMarking:'PCA10156',
    width:11.6,height:6.25,logicVoltage:3.3,logicRail:'VDDIO',logicHighThreshold:2.31,adcMax:16383,adcDefaultBits:10,
    coreClockHz:128e6,flashBytes:1524*1024,ramBytes:256*1024,
    pins,numberedPins,analogPins:['P1.11','P1.12'],pwmPins:['P1.11','P1.12'],
    defaultPins:{led:'P1.11',button:'P2.08',adc:'P1.12',pwm:'P1.11'},
    sources:[
      nordicDocs+'ug_nrf54l15_dk/page/ug/nrf54l15_dk/hw_desription/connector_if.html',
      'https://nrfconnectdocs.nordicsemi.com/addons/door_lock_and_access_control/latest/hardware_requirements.html#configuring-vddio-voltage-for-nrf54l-series-devices',
      nordicDocs+'ps_nrf54l15/page/saadc.html', nordicDocs+'ps_nrf54l15/page/pwm.html-topic',
      nordicDocs+'ps_nrf54l15/page/_tmp/nrf54l15/autodita/gpio/parameters.elec_spec.html',
      'https://docs.zephyrproject.org/latest/boards/nordic/nrf54l15dk/doc/index.html'
    ],
    footprintNote:'PCA10156 的 P0/P1/P2 教学布局。GPIO 只启用所列五个端点，实际接线按板上端口与脚号定位。',
    notes:[
      '此模型的 VDDIO 为 3.3 V。实板出厂默认为 1.8 V，需用 nRF Connect for Desktop 的 Board Configurator 将 VDD 配置到 3.3 V。',
      'P1.11、P1.12 分别是 AIN4、AIN5。P2.06、P2.08、P2.10 在关闭 Trace 时用作数字 GPIO。',
      '实验台数字编号按端口 × 32 加脚号计算。P0/P1/P2 使用杜邦线接入。',
      '板载灯、按键、无线、外置 Flash 及原生 Zephyr / nRF Connect SDK 固件未实现。'
    ]
  };
}

export function makeNordicDkProfiles() {
  return [shieldDk(nrf52840),shieldDk(nrf5340),nrf54l15Dk()];
}
