import {createCircuit,makePart} from './circuit.js';

export const motorBridgeLessonId='drv8833-motor';
export const motorStopWindowMs=300;
const driveModes=new Set(['forward','reverse']);
const stopModes=new Set(['coast','brake']);
const modes={forward:'正转驱动',reverse:'反转驱动',coast:'滑行 · 输出高阻',brake:'电刹车 · 两端接地',
  sleep:'休眠',supply:'电机电源超出范围',ground:'控制端需要共地',input:'输入电平不确定',feedback:'检查输出与输入的连线'};
export const motorModeLabel=mode=>modes[mode]??'等待驱动信号';

const code=`#include "stm32f10x.h"
#include "Delay.h"

// 0：松开电机输出，靠机械摩擦滑行。1：两端接地，电刹车。
#define BRAKE_AT_STOP 0
// 0：正转。1：反转。接线保持原样。
#define TURN_REVERSE 0
#define MOTOR_PINS (GPIO_Pin_0 | GPIO_Pin_1)

int main(void) {
    RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);
    GPIO_InitTypeDef gpio;
    gpio.GPIO_Pin = MOTOR_PINS;   // PA0 → AIN1，PA1 → AIN2。
    gpio.GPIO_Mode = GPIO_Mode_Out_PP;
    gpio.GPIO_Speed = GPIO_Speed_2MHz;
    GPIO_Init(GPIOA, &gpio);

    if (TURN_REVERSE) GPIO_SetBits(GPIOA, GPIO_Pin_1);
    else GPIO_SetBits(GPIOA, GPIO_Pin_0);
    Delay_ms(750);                // 先让空载电机接近稳定转速。

    if (BRAKE_AT_STOP) GPIO_SetBits(GPIOA, MOTOR_PINS); // 11：电刹车。
    else GPIO_ResetBits(GPIOA, MOTOR_PINS);           // 00：滑行。
    while (1) {
        Delay_ms(500);            // 保持停转指令，观察转速怎样下降。
    }
}
`;

export function makeMotorBridgeLesson(){
  const circuit=createCircuit('onboard');
  circuit.components=[
    makePart('drv8833','bridge1',.25,-3.6),
    {...makePart('motor','motor1',4.65,-4.2),motorModel:'fa130-18100'},
    {...makePart('power','motorSupply',.3,3.6),voltage:3}
  ];
  circuit.wires=[
    ['mcu:PA0','bridge1:AIN1','#d47043'],['mcu:PA1','bridge1:AIN2','#8070cb'],
    ['bridge1:AOUT1','motor1:+','#de6a4c'],['bridge1:AOUT2','motor1:-','#317597'],
    ['motorSupply:+','bridge1:VIN','#bf4842'],['motorSupply:-','bridge1:GND','#32464d'],
    ['mcu:GND1','bridge1:GND2','#32464d']
  ].map(([a,b,color],index)=>({id:'w'+(index+1),a,b,color}));
  return {id:motorBridgeLessonId,boardId:'bluepill',title:'20 · 电机滑行与电刹车',shortTitle:'电机驱动与刹车',language:'stm32-spl',watchPin:'PA0',
    files:{'main.c':code},circuitData:circuit,
    description:'用 DRV8833 驱动 3 V 直流电机。改一行代码，比较停转指令后的转速和绕组电流。',
    setup:['3 V 电源给驱动板供电，开发板与驱动板共地。PA0 / PA1 只接 AIN1 / AIN2。',
      '运行后先等电机进入滑行，打开「看停转曲线」，留意停转指令发出后的转速。',
      '把 BRAKE_AT_STOP 从 0 改为 1 并应用。也可将 TURN_REVERSE 改为 1，对照转速方向。'],
    learningGoals:['对照 H 桥输入、电机端电压与转速方向。','理解滑行与电刹车时，电流和机械转速为何不同。'],
    expected:'两种停转方式都撤去驱动。滑行的绕组电流接近零，电刹车有方向相反的短暂绕组电流，转速降得更快。'};
}

export function readMotorBridgeLesson(measurement){
  const {motor1,bridge1}=measurement?.parts??{};
  if(!motor1||!bridge1?.channels?.A)return null;
  const paired=motor1.bridge?.id==='bridge1'&&motor1.bridge.channel==='A'&&!motor1.bridge.reversed;
  const {mode,inputs,reason}=bridge1.channels.A;
  const state=bridge1.sleeping?'sleep':reason??bridge1.reason??mode;
  return {id:'motor1',paired,mode:state,inputs,rpm:motor1.rpm,currentMa:motor1.currentMa,voltage:motor1.voltage};
}

export function createMotorStopTrace(){
  let key=null,before=null,current=null,driven=false,lastTime=-1;
  function sync(next){
    if(key===next)return;
    key=next;before=current=null;driven=false;lastTime=-1;
  }
  function begin(next,compare,keepReference=false){
    sync(next);
    before=compare ? (current?.samples.length>1?current:null) : keepReference?before:null;
    current=null;driven=false;lastTime=-1;
  }
  function record(timeMs,reading){
    if(!key||!reading?.paired||!Number.isFinite(timeMs)||timeMs<lastTime||
      !Number.isFinite(reading.rpm)||!Number.isFinite(reading.currentMa))return;
    lastTime=timeMs;
    if(driveModes.has(reading.mode)){
      driven=true;
      if(current)current.closed=true;
      return;
    }
    if(!driven||current?.closed)return;
    if(!stopModes.has(reading.mode)){if(current)current.closed=true;return;}
    current??={mode:reading.mode,startMs:timeMs,samples:[],closed:false};
    if(reading.mode!==current.mode){current.closed=true;return;}
    const relative=timeMs-current.startMs;
    if(relative>motorStopWindowMs||current.samples.length>=240){current.closed=true;return;}
    const sample={ms:relative,rpm:reading.rpm,currentMa:reading.currentMa};
    if(current.samples.at(-1)?.ms===relative)current.samples[current.samples.length-1]=sample;
    else current.samples.push(sample);
  }
  return {sync,begin,record,get before(){return before;},get current(){return current;}};
}
