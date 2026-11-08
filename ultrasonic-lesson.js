import {makeBoardStarter} from './board-profiles.js';
import {makePart} from './circuit.js';

export const ultrasonicLessonId='uno-r3:ultrasonic';
export const targetDistanceMax=450;
export const targetBearingMax=30;
export const sonarMissLabels={removed:'目标已移走','outside-range':'目标超出量程','outside-beam':'目标偏离波束'};

const code=`// Arduino UNO R3：D7 触发 HC-SR04，D8 读取 5 V 回波，D12 控制外接灯。
const int trigPin = 7;
const int echoPin = 8;
const int alarmPin = 12;

// 保持目标位置，试把 60 改成 100，再应用代码。
#define ALARM_CM 60
#define TRIGGER_US 10
#define ECHO_TIMEOUT_US 28000

unsigned long measuredEchoUs = 0;
int measuredCm = -1;

void setup() {
    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
    pinMode(alarmPin, OUTPUT);
    Serial.begin(9600);
}

void loop() {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(TRIGGER_US);
    digitalWrite(trigPin, LOW);

    measuredEchoUs = pulseIn(echoPin, HIGH, ECHO_TIMEOUT_US);
    // 声速近似 343 m/s，乘脉宽后除以二得到单程距离。
    measuredCm = measuredEchoUs ? (measuredEchoUs * 343UL + 10000UL) / 20000UL : -1;
    digitalWrite(alarmPin, measuredCm >= 0 && measuredCm <= ALARM_CM ? HIGH : LOW);

    if (measuredCm < 0) Serial.println("No echo");
    else {
        Serial.print(measuredCm);
        Serial.println(" cm");
    }
    delay(65);  // 测距间隔留出至少 60 ms。
}
`;

export function makeUltrasonicLesson(){
  const {circuit}=makeBoardStarter('uno-r3','blink');
  circuit.components=[
    {...makePart('hcsr04','sonar1',2.9,-4.4),distanceCm:80},
    makePart('resistor','r1',1.4,4.0),makePart('led','led1',3.5,4.0)
  ];
  circuit.wires=[
    ['mcu:5V','sonar1:VCC','#bc4842'],['mcu:GND1','sonar1:GND','#34454b'],
    ['mcu:D7','sonar1:TRIG','#9970c1'],['mcu:D8','sonar1:ECHO','#367fad'],
    ['mcu:D12','r1:1','#dd7147'],['r1:2','led1:A','#dd7147'],['led1:K','mcu:GND3','#34454b']
  ].map(([a,b,color],index)=>({id:'w'+(index+1),a,b,color}));
  return {id:ultrasonicLessonId,boardId:'uno-r3',title:'超声波测距与距离报警',shortTitle:'超声波测距',language:'arduino',watchPin:'D12',
    files:{'UltrasonicAlarm.ino':code},circuitData:circuit,
    description:'拖动超声波目标，读出回波时长。保持目标和接线，改距离阈值看报警灯。',
    setup:['VCC 接 5 V，GND 共地，D7 接 TRIG，D8 接 ECHO。D12 通过 330 Ω 电阻驱动外接灯。',
      '运行后拖动目标或调节距离。试把目标移近、移出波束或移走，对照测量结果和回波。',
      '把目标放在 80 cm 正前方，将 ALARM_CM 从 60 改成 100，再应用代码。'],
    learningGoals:['在同一时序上对照触发、发射等待和 ECHO 脉宽。','区分目标距离、程序读数和报警阈值。'],
    expected:'目标在 80 cm 时，初始代码的灯熄灭。把阈值改为 100 cm，目标和接线都保持原样，灯会亮。'};
}
