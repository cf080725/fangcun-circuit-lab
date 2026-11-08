// Guidance follows the active example and board; reference outcomes are never
// presented as measurements of user-edited code.
export function codeLocation(files, pattern){
 for(const [file,text] of Object.entries(files||{})){const lines=String(text).split('\n');const index=lines.findIndex(line=>!line.trim().startsWith('//')&&pattern.test(line));if(index>=0)return {file,line:index+1};}
 return null;
}
export function guidanceFor(example,profile,files={}){
 const imported=example.imported||String(example.id).startsWith('imported');
 const kind=String(example.id).split(':').pop(),spl=(profile.id==='bluepill'||example.language==='stm32-spl')&&!imported;
 const pin=(!spl&&kind==='blink'?profile.ledPin:null)||profile.defaultPins?.led||'PA0',input=profile.defaultPins?.button||'PB1',analog=profile.defaultPins?.adc||'PA1';
 const bits=spl?12:profile.adcDefaultBits,max=2**bits-1;
 const delay=codeLocation(files,/\b(?:Delay_ms|delay)\s*\(\s*\d+/);
 const plans={
  blink:{question:'如果把亮和灭的等待时间都加倍，一轮闪烁会变快还是变慢？',observe:'看 LED 的亮灭，再看 '+pin+' 的电平。一次完整周期包括亮和灭两段时间。',change:'找到等待函数，只修改一个数值，再运行比较节奏。',pattern:/\b(?:Delay_ms|delay)\s*\(/,target:'led'},
  'plugged-led':{question:'A11 和 C11 没有跳线，为什么 LED 和电阻仍然串联？',observe:'打开接线表，对照 LED 的 K 脚在 A11，电阻的 1 脚在同组的 C11。运行后点 LED 查看支路电流。',change:'选中电阻并点「拔下元件」，比较电流，再撤销恢复插装。',pattern:/\bGPIO_SetBits\s*\(/,target:'led'},
  'plugged-button':{question:'按下前，为什么 PB1 是高电平？',observe:'运行后按住按键，观察 PB1 电压变为接近 0 V 和 LED 点亮。松手后比较变化。',change:'拔下按键，确认 PB1 仍被上拉，再撤销恢复插装。',pattern:/\bGPIO_ReadInputDataBit\s*\(/,target:'button'},
  'button-bounce':{question:'同一次按压，程序会数到几次？',observe:'点「复位并重放按压」，同时观察 PB1、程序确认电平和外接灯。',change:'把 DEBOUNCE_MS 从 0 改为 10。应用后重放，比较前后波形与计数。',pattern:/^\s*#\s*define\s+DEBOUNCE_MS\b/,target:'button'},
  'board-button':{question:'为什么按下 B1 会让 PC13 读到 0？',observe:'运行后按住蓝色 B1，观察 LD2 点亮。松开后，切到 PC13 看上拉恢复的电压。',change:'找到读取 PC13 的判断句，试着让 LD2 在 B1 松开时亮。',pattern:/\bGPIO_ReadInputDataBit\s*\(/,target:'mcu'},
  'board-insertion':{question:'没有跳线直接连到开发板，LED 是怎样得到信号的？',observe:'点「插入面包板」，确认第 6 列、USB 朝左，运行看灯闪烁。',change:'运行时拔下开发板，观察灯熄灭。撤销后查看 PA0 和 GND1 的插装孔位。',pattern:/\bGPIO_SetBits\s*\(/,target:'led'},
  'plugged-diode':{question:'如果把色环侧转到另一端，LED 还能亮吗？',observe:'点运行，选中二极管看电流。对照 A10 和 A13 的插脚。',change:'选中二极管调整插位，转到 180° 并确认。比较电流和 LED，然后撤销。',pattern:/\bGPIO_SetBits\s*\(/,target:'diode'},
  'plugged-rc':{question:'PA0 突然变高时，电容两端的电压会立刻跳到 3.3 V 吗？',observe:'运行，查看 PA1 波形和电容两端的电压。',change:'拔下电容，比较 PA1 的边沿，撤销后再运行。',pattern:/\bDelay_ms\s*\(/,target:'capacitor'},
  'pwm-rc':{question:'保持占空比，提高 PWM 频率后，电容端的平均电压和纹波会怎么变？',observe:'先看 PA1 当前电压，再打开「看一周期」对照 PWM 和电容电压。',change:'先只改 DUTY_PERCENT。应用后，再单独改 PWM_HZ，比较平均电压和纹波。',pattern:/^\s*#\s*define\s+DUTY_PERCENT\b/,target:'capacitor'},
  'sevenseg-gpio':{question:'把 2 改为 7，哪些发光段会灭，哪一段会亮？',observe:'运行后对照数码管和各段电流。点任意段的电流可定位它的实物引脚。',change:'先把 DISPLAY_DIGIT 改成 7，再把 DECIMAL_POINT 改成 1。每次应用后，比较哪些段发生变化。',pattern:/^\s*#\s*define\s+DISPLAY_DIGIT\b/,target:'sevenseg'},
  'drv8833-motor':{question:'把驱动输出悬空和把电机两端接地，哪个停得更快？',observe:'运行后看 AIN1 / AIN2、转速和绕组电流。在停转曲线里比较指令发出后约 100 ms 的转速。',change:'把 BRAKE_AT_STOP 改为 1，应用代码后比较滑行和电刹车。也可把 TURN_REVERSE 改为 1，观察转速方向。',pattern:/^\s*#\s*define\s+BRAKE_AT_STOP\b/,target:'motor'},
  ultrasonic:{question:'把目标移到一半距离，ECHO 高电平会怎样变化？',observe:'运行后调整目标。比较程序读数、回波时序和外接灯。把目标移出波束，观察超时。',change:'保持目标在 80 cm 正前方，把 ALARM_CM 从 60 改为 100，再应用。',pattern:/^\s*#\s*define\s+ALARM_CM\b/,target:'hcsr04'},
  'i2c-oled':{question:'程序改成另一个地址后，已经亮起的像素会发生什么？',observe:'运行后打开「OLED 与 I²C」，对照屏幕上的像素与最近写入的返回状态。',change:'把 BAR_COLUMNS 从 40 改为 96 并应用。记录结果，再单独改变 OLED_ADDR 或拔掉 SDA。',pattern:/^\s*#\s*define\s+BAR_COLUMNS\b/,target:'ssd1306'},
  'i2c-temperature':{question:'同样是 34.5 °C，改变程序阈值后灯会怎样？',observe:'设为 34.5 °C，等待传感器转换，比较程序读数、0x05 的两个字节和报警灯。',change:example.nativeOnly?'先运行 30 °C 固件，再编辑原生 C，把 ALARM_C 改为 35 并编译运行。对照同一温度下的报警灯。':'保持温度和接线，把 ALARM_C 从 30 改为 38 并应用。再试 −8.5 °C，观察代码如何解出负数。',pattern:/^\s*#\s*define\s+ALARM_C\b/,target:'mcp9808'},
  'i2c-temperature-display':{question:'摄氏和华氏两版固件读到的原始字节会变吗？',observe:'在 34.5 °C 下运行摄氏固件，记下总线读数和 OLED 像素。',change:'点「编辑原生 C」，把 DISPLAY_FAHRENHEIT 从 0 改为 1，再编译运行。对照两次屏幕画面。',target:'ssd1306'},
  'native-button':{question:'改一行头文件，能让同一个按键产生相反的灯光效果吗？',observe:'编译并运行，按下、松开板载 B1。比较 PC13 的输入电平和 LD2 的状态。',change:'点「定位示例参数」，在 led_policy.h 把 LIGHT_WHEN_PRESSED 从 1 改为 0，重新编译并运行。',target:'mcu'},
  'mounted-header':{question:'GPIO32 的插孔被挡住了，在哪里还能接到同一个信号？',observe:'从 GPIO32 排针引线到按键 1 脚，运行后按住按键，比较松开与按下时的电压和灯光。',change:'撤销 GPIO32 的跳线，再按按键，观察输入是否还能拉到低电平。',pattern:/\bdigitalRead\s*\(/,target:'button'},
  'd13-pullup':{question:'同样启用 D13 的内部上拉，两块板松开按键时都会读到 1 吗？',observe:'按下再松开按钮，看 D13 的电压和 L 灯。用「做同一实验」切换板卡，比较串口读数。',change:'把 INPUT_PULLUP 改成 INPUT 后应用。松开按键，查看引脚悬空和波形留白。',pattern:/\bpinMode\s*\(/,target:'button'},
  onboard:{question:'PC13 是低电平时，板载 LED 会亮还是灭？',observe:'本例板载灯低电平点亮。观察 PC13 的波形与板载灯，而不是外接 LED。',change:'改变一段等待时间，比较亮的时长与灭的时长。',pattern:/\bDelay_ms\s*\(/,target:'mcu'},
  traffic:{question:'三盏灯能否同时亮？程序里的哪几句决定这一点？',observe:'按红、黄、绿顺序观察，并切换 PA0、PA1、PA2 的波形。',change:'只改变一盏灯后面的等待时间，找出它在画面中对应的灯。',pattern:/\bDelay_ms\s*\(/,target:'led'},
  button:{question:'启用上拉后，松开与按下按钮时，输入各是 1 还是 0？',observe:'运行后按住按钮，再松开。观察 '+input+' 的输入与 LED，按键也可用空格操作。',change:'定位读取按钮的判断句，先说出条件成立时会执行哪一段。',pattern:/\b(?:GPIO_ReadInputDataBit|digitalRead)\s*\(/,target:'button'},
  adc:{question:'把旋钮转向高电压端，采样数字会增大还是减小？',observe:'在「选择」模式按住旋钮顶端左右拖动，也可用属性滑块。本示例默认 '+bits+' 位，读数范围为 0～'+max+'。',change:'保持旋钮位置，改变示例中的亮灯阈值再应用。比较 ADC 采样和灯光。',pattern:/\b(?:ADC_GetConversionValue|analogRead)\s*\(/,target:'pot'},
  pwm:{question:'保持频率不变，提高占空比，LED 看起来会更亮还是更暗？',observe:'观察亮度与引脚面板的占空比。频率是切换快慢，占空比是高电平占一周期的比例。',change:'定位 PWM 比较值或 analogWrite，先改一个参数并观察。',pattern:/\b(?:TIM_SetCompare\d|analogWrite)\s*\(/,target:'led'},
  uart:{question:'发送字符 A，接收端看到的是字符还是数字编码？',observe:'切到串口面板，运行后发送一个字符，比较发送内容与回显。',change:'定位发送函数，改动待发送字符，再运行观察。',pattern:/\bUSART_SendData\s*\(/,target:'serial'},
  multifile:{question:'main.c 里的 LED_On，最后在哪个文件中真正设置引脚？',observe:'在 main.c、LED.c 与 LED.h 间切换，找到声明、调用和实现。',change:'只改 main.c 的等待时间，检查 LED.c 是否需要一起改。',pattern:/\bDelay_ms\s*\(/,target:'led'},
  buzzer:{question:'等待时间控制的是蜂鸣器音调，还是响与停的节奏？',observe:'先看蜂鸣器通断；需要听声音时主动打开声音。本例是有源蜂鸣器的通断模型。',change:'改动一段等待时间，比较响和停的时长。',pattern:/\bDelay_ms\s*\(/,target:'buzzer'},
  servo:{question:'50 Hz 频率不变，脉冲从 1 ms 变成 2 ms 时，模型角度如何变化？',observe:'点击舵机，在属性中观察角度。信号线负责控制，VCC 与 GND 负责供电。',change:'定位比较值，结合本例计数单位，判断脉宽后再修改。',pattern:/\bTIM_SetCompare\d\s*\(/,target:'servo'},
  'servo-hs55':{question:'脉宽改了以后，舵臂会立即到达新角度吗？',observe:'运行后看目标角和轴臂的当前角，等轴臂停稳。',change:'把 COMMAND_US 从 1200 改为 1800，应用后观察轴臂从原处转到新位置。',pattern:/^\s*#\s*define\s+COMMAND_US\b/,target:'servo'}
 };
 const generic={question:'你希望哪一个引脚或元件发生什么变化？先写下预期。',observe:'先检查供电、共同的地和接线，再运行；根据引脚、变量与诊断核对自己的预期。',change:'每次只改一处代码或接线，保留前后现象用于比较。',pattern:/\b(?:main|setup|loop)\s*\(/,target:'mcu'};
 const plan=imported?generic:(plans[kind]||generic);
 const location=example.nativeOnly?null:codeLocation(files,plan.pattern)||delay;
 const setup=example.setup?.length?example.setup.slice(0,3):['当前板卡：'+profile.name+'，GPIO 逻辑电压 '+profile.logicVoltage+' V。','观察实际接线表与板上丝印；切换板卡后以当前引脚名称为准。'];
 const expected=imported?'这是你的自有工程，没有内置标准答案。请用代码、引脚与测量结果验证自己的预测。':example.expected||(kind==='adc'?'默认 '+bits+' 位 ADC：输入从 0 V 到参考电压时，理想读数从 0 增至 '+max+'；这是初始示例的参考现象。':kind==='button'?'初始示例使用上拉输入：松开为高，按下接地为低，LED 跟随按键。':kind==='pwm'?'初始示例的占空比逐步改变，LED 随之渐亮或渐暗。':'初始示例让'+(!spl&&profile.ledPin?'板载':'外接')+' LED 周期性亮灭，具体等待时间以当前代码为准。');
 return {kind,imported,question:plan.question,observe:plan.observe,change:plan.change,target:plan.target,location,setup,expected,concepts:(example.learningGoals?.length?example.learningGoals:[plan.question,plan.observe]).slice(0,2),dialect:example.nativeOnly?'STM32F103 · Cortex-M3 原生固件':spl?'STM32F103 · 标准外设库':imported?'自有工程 · 先核对代码环境':'Arduino 风格 · 当前板卡行为模型',steps:[['先认清这次的接线',setup[0]],['带着一个问题观察',plan.observe],['一次只改一个地方',plan.change]]};
}
