/* Local editor assistance: deterministic explanations and completions, no remote source upload. */
export const API_HINTS = [
 ['GPIO_Init','GPIO_Init(GPIOA, &gpio);','把引脚配置单交给这组引脚','GPIO_TypeDef *GPIOx, GPIO_InitTypeDef *GPIO_InitStruct','spl'],
 ['GPIO_SetBits','GPIO_SetBits(GPIOA, GPIO_Pin_0);','让所选引脚输出高电平','GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin','spl'],
 ['GPIO_ResetBits','GPIO_ResetBits(GPIOA, GPIO_Pin_0);','让所选引脚输出低电平','GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin','spl'],
 ['GPIO_ReadInputDataBit','GPIO_ReadInputDataBit(GPIOB, GPIO_Pin_1)','读取这个输入脚现在是高还是低','GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin','spl'],
 ['GPIO_WriteBit','GPIO_WriteBit(GPIOA, GPIO_Pin_0, Bit_SET);','按最后一个参数设置高或低','GPIO_TypeDef *GPIOx, uint16_t GPIO_Pin, BitAction value','spl'],
 ['RCC_APB2PeriphClockCmd','RCC_APB2PeriphClockCmd(RCC_APB2Periph_GPIOA, ENABLE);','打开这个外设的工作时钟','uint32_t RCC_APB2Periph, FunctionalState NewState','spl'],
 ['Delay_ms','Delay_ms(500);','保持当前状态，等待若干毫秒','uint32_t milliseconds','spl'],
 ['Delay_us','Delay_us(100);','等待若干微秒','uint32_t microseconds','spl'],
 ['TIM_SetCompare1','TIM_SetCompare1(TIM2, 50);','改变定时器通道1的比较值','TIM_TypeDef *TIMx, uint16_t Compare1','spl'],
 ['TIM_Cmd','TIM_Cmd(TIM2, ENABLE);','启动或停止定时器','TIM_TypeDef *TIMx, FunctionalState NewState','spl'],
 ['ADC_GetConversionValue','ADC_GetConversionValue(ADC1)','取回本次模拟采样的数字结果','ADC_TypeDef *ADCx','spl'],
 ['USART_SendData','USART_SendData(USART1, 65);','通过串口发送一个数据','USART_TypeDef *USARTx, uint16_t Data','spl'],
 ['pinMode','pinMode(LED_BUILTIN, OUTPUT);','告诉这个脚：作为输入还是输出','pin, mode','arduino'],
 ['digitalWrite','digitalWrite(LED_BUILTIN, HIGH);','把输出脚设为高电平或低电平','pin, HIGH / LOW','arduino'],
 ['digitalRead','digitalRead(2)','读取输入脚的电平','pin','arduino'],
 ['pulseIn','pulseIn(2, HIGH, 30000)','等待一个完整脉冲，返回脉宽（微秒）','pin, HIGH / LOW, [timeoutUs]','arduino'],
 ['analogRead','analogRead(A0)','把模拟电压读成一个整数','analogPin','arduino'],
 ['analogWrite','analogWrite(5, 128);','设置 PWM 输出值；有效范围看所选板卡','pin, value','arduino'],
 ['delay','delay(500);','等待若干毫秒后再继续','milliseconds','arduino'],
 ['millis','millis()','读取程序开始后的虚拟毫秒数','void','arduino'],
 ['setup','void setup() {\n    \n}','只执行一次的初始化入口','void','arduino'],
 ['loop','void loop() {\n    \n}','持续重复执行的入口','void','arduino'],
 ['if','if (condition) {\n    \n}','条件成立时才执行里面的动作','condition','all'],
 ['while','while (1) {\n    \n}','反复执行一组动作','condition','all'],
 ['for','for (int i = 0; i < 10; i++) {\n    \n}','按次数或条件重复执行','initialization; condition; update','all'],
];
const WIRE_HINTS = [
 ['begin','begin();','启动 Arduino I²C 接口','void'],
 ['beginTransmission','beginTransmission(0x3C);','选择一个 7 位设备地址并清空发送缓冲区','address'],
 ['write','write(0x40);','把字节放入发送缓冲区','byte 或 array, length'],
 ['endTransmission','endTransmission()','发送已缓冲的字节，返回总线状态','[sendStop = true]'],
 ['requestFrom','requestFrom(0x18, 2)','读取指定数量的字节，返回实际收到的个数','address, quantity, [sendStop = true]'],
 ['available','available()','查看还有多少个未读字节','void'],
 ['read','read()','取出下一个字节，无可读数据时返回 −1','void'],
 ['peek','peek()','查看下一个字节，保留在缓冲区中','void'],
];

/** Small lexical scanner shared by editing and explanations. It preserves offsets. */
export function lexicalSource(source){
 const text=String(source??''),mask=[],code=[],lineStates=['code'],lineStarts=[0];let state='code',escaped=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(state==='code'){
   if(ch==='/'&&(next==='/'||next==='*')){state=next==='/'?'line-comment':'block-comment';mask.push(' ',' ');code.push(' ',' ');i++;continue;}
   if(ch==='"'||ch==="'"){state=ch==='"'?'string':'character';escaped=false;mask.push(' ');code.push(ch);continue;}
   mask.push(ch);code.push(ch);
  }else if(state==='line-comment'){
   mask.push(ch==='\n'?'\n':' ');code.push(ch==='\n'?'\n':' ');if(ch==='\n'&&text[i-1]!=='\\')state='code';
  }else if(state==='block-comment'){
   if(ch==='*'&&next==='/'){mask.push(' ',' ');code.push(' ',' ');i++;state='code';continue;}
   mask.push(ch==='\n'?'\n':' ');code.push(ch==='\n'?'\n':' ');
  }else{
   mask.push(ch==='\n'?'\n':' ');code.push(ch);
   if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===(state==='string'?'"':"'"))state='code';
  }
  if(ch==='\n'){lineStates.push(state);lineStarts.push(i+1);}
 }
 return {mask:mask.join(''),code:code.join(''),state,lineStates,lineStarts};
}
export const editorContextAt=(text,cursor)=>lexicalSource(String(text??'').slice(0,Math.max(0,cursor))).state;
const escapeRE=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const info=(title,plain,technical,short=title)=>({title,plain,technical,short,scope:'静态文字规则：不代替编译、运行时变量或电路测量。'});
function splitArguments(text){
 const args=[];let start=0,depth=0;const mask=lexicalSource(text).mask;
 for(let i=0;i<mask.length;i++){if('([{'.includes(mask[i]))depth++;else if(')]}'.includes(mask[i]))depth--;else if(mask[i]===','&&depth===0){args.push(text.slice(start,i).trim());start=i+1;}}
 args.push(text.slice(start).trim());return args;
}
function callAt(text,pattern){
 const mask=lexicalSource(text).mask,regex=new RegExp('\\b('+pattern+')\\s*\\(','g'),m=regex.exec(mask);if(!m)return null;
 const open=mask.indexOf('(',m.index),start=open+1;let depth=1;
 for(let i=start;i<mask.length;i++){if(mask[i]==='(')depth++;else if(mask[i]===')'&&!--depth)return {name:m[1],args:splitArguments(text.slice(start,i)),index:m.index,end:i+1};}
 return null;
}
function gpioPinNames(port,expression){
 const p=/^GPIO([A-G])$/.exec(String(port).trim()),e=String(expression).trim();
 if(!p)return e+'（端口由 '+port+' 决定）';
 if(e==='GPIO_Pin_All')return 'P'+p[1]+'0～P'+p[1]+'15';
 if(!/^GPIO_Pin_\d+(?:\s*\|\s*GPIO_Pin_\d+)*$/.test(e))return port+' 中由 '+e+' 选中的引脚';
 return [...e.matchAll(/GPIO_Pin_(\d+)/g)].map(m=>'P'+p[1]+m[1]).join('、');
}
function scopeFor(context){
 if(!context?.source)return {text:'',offset:0,local:0};const analysis=context.analysis||lexicalSource(context.source),offset=context.offset??analysis.lineStarts[(context.lineNumber||1)-1]??0;
 let depth=0,start=0;for(let i=0;i<offset;i++){if(analysis.mask[i]==='{'){if(depth===0)start=i+1;depth++;}else if(analysis.mask[i]==='}')depth=Math.max(0,depth-1);}
 if(!depth)return {text:analysis.code,offset,local:offset};
 let end=analysis.code.length,d=depth;for(let i=offset;i<analysis.mask.length;i++){if(analysis.mask[i]==='{')d++;else if(analysis.mask[i]==='}'&&!--d){end=i;break;}}
 return {text:analysis.code.slice(start,end),offset:start,local:offset-start};
}
function previousFields(variable,context){
 const scope=scopeFor(context),before=scope.text.slice(0,scope.local),fields={};
 const regex=new RegExp('\\b'+escapeRE(variable)+'\\.(\\w+)\\s*=\\s*([^;]+);','g');
 for(const m of before.matchAll(regex))fields[m[1]]=m[2].trim();return fields;
}
function nextGPIOPort(variable,context){
 const scope=scopeFor(context),tail=scope.text.slice(scope.local),hit=new RegExp('\\bGPIO_Init\\s*\\(\\s*(GPIO[A-G])\\s*,\\s*&\\s*'+escapeRE(variable)+'\\s*\\)').exec(tail);
 if(!hit)return null;const between=tail.slice(tail.indexOf(';')+1,hit.index);
 // A later reassignment means the current pin selection may no longer reach Init.
 if(new RegExp('\\b'+escapeRE(variable)+'\\.GPIO_Pin\\s*=').test(between))return null;
 return hit[1];
}
const modes={
 GPIO_Mode_Out_PP:['推挽输出','程序可以主动把引脚拉高或拉低，适合经限流电阻控制普通LED。'],
 GPIO_Mode_Out_OD:['开漏输出','写0时拉低；写1时释放，不会主动送出高电平，需要外部上拉或其他驱动。'],
 GPIO_Mode_AF_PP:['复用推挽输出','把引脚的输出控制权交给定时器、串口等外设；还要配置并启动那个外设。'],
 GPIO_Mode_AF_OD:['复用开漏输出','由外设控制拉低或释放，通常需要外部上拉；不会主动把引脚拉高。'],
 GPIO_Mode_IPU:['上拉输入','不按按钮且外部不拉低时倾向读1；按钮接地并按下时读0。'],
 GPIO_Mode_IPD:['下拉输入','外部不驱动时倾向读0；外部可靠拉高时读1。'],
 GPIO_Mode_IN_FLOATING:['浮空输入','只读取外部电平，不开启内部上下拉；没有可靠外部驱动时读值不稳定。'],
 GPIO_Mode_AIN:['模拟输入','让引脚适合接收连续变化的电压，关闭数字输入相关功能；ADC还需要另外配置与启动。']
};
function fieldExplanation(variable,field,value,context){
 const fields=previousFields(variable,context),number=/^\d+$/.test(value)?Number(value):null;
 if(field==='GPIO_Pin'){
  const port=nextGPIOPort(variable,context),pins=port?gpioPinNames(port,value):[...value.matchAll(/GPIO_Pin_(\d+)/g)].map(m=>'第'+m[1]+'号脚').join('、')||value;
  return info('在配置单上选引脚',`给 ${variable} 填入 ${pins}。${port?'本函数后面的 GPIO_Init 把这份配置交给 '+port+'，因此可把端口字母与引脚编号合起来识别。':'这里只写编号；A组还是B组，要看 GPIO_Init 的第一个参数。'}此时还没有改变硬件。`,'GPIO_Pin 是位掩码；| 表示同时选择多个引脚。端口关联仅依据本函数可见的直接赋值与调用，不追踪宏或运行分支。','选择 '+pins);
 }
 if(field==='GPIO_Mode'){
  const m=modes[value];return info('给引脚选择工作方式',`在 ${variable} 配置单上选择${m?m[0]:value}。${m?m[1]:'具体行为需查看这个模式常量的定义。'}等 GPIO_Init 提交后才生效。`,'GPIO_Mode 决定输入偏置、推挽/开漏及普通/复用功能；修改结构体字段本身不写GPIO寄存器。',m?m[0]:'设置 GPIO 模式');
 }
 if(field==='GPIO_Speed'){
  const speed=/GPIO_Speed_(\d+)MHz/.exec(value)?.[1];const input=/AIN|IPU|IPD|IN_FLOATING/.test(fields.GPIO_Mode||'');
  return info('选择输出速度档位',`在配置单里选择${speed?speed+' MHz':value}的输出驱动速度档位。它不是CPU主频，也不会自动让灯按这个频率闪烁。${input?'前面选择的是输入模式，这个输出速度字段不用于设置输入采样速率。':''}`,'F103的GPIO MODE位选择最大输出速度档位（2/10/50 MHz）；不是定时器周期或真实负载下必达的频率。','输出速度档位 '+(speed?speed+' MHz':value));
 }
 if(field==='TIM_Prescaler')return info('先把计数节拍放慢',`把预分频值写成 ${value}；实际除数是 ${value}+1${number!==null?'，也就是 '+(number+1):''}。若输入时钟为72MHz、这里写71，计数节拍就是1MHz，每次计数1微秒。`,'计数频率 f_CNT=f_TIM/(PSC+1)。f_TIM来自定时器时钟树，不应直接假定等于所有板卡的CPU频率。','计数时钟 ÷ '+(number!==null?number+1:'(PSC+1)'));
 if(field==='TIM_Period')return info('决定一轮数多少次',`向上计数时从0数到 ${value}，一轮共 ${number!==null?number+1:value+'+1'} 个计数。${value==='999'?'如果每次1微秒，一轮就是1毫秒，对应1kHz。':value==='19999'?'如果每次1微秒，一轮就是20毫秒，对应50Hz。':''}`,'ARR为自动重装值；边沿对齐向上计数的周期为(PSC+1)×(ARR+1)/f_TIM。中心对齐等模式需另算。','一轮 '+(number!==null?number+1:'ARR+1')+' 个计数');
 if(field==='TIM_CounterMode')return info('决定计数方向',value==='TIM_CounterMode_Up'?'选择从0向上数；数到设定上限后开始下一轮。':'计数方向设为 '+value+'；周期公式需要与该模式一致。','设置定时器向上、向下或中心对齐模式；本教学PWM例子采用向上计数。','计数方式 '+(value==='TIM_CounterMode_Up'?'向上':value));
 if(field==='TIM_ClockDivision')return info('设置滤波采样用的时钟分频',value==='TIM_CKD_DIV1'?'选择不分频。这个字段主要关联数字滤波/死区的采样时钟，不是用来把PWM周期再除一次。':'设置 '+value+'，需要与数字滤波或死区功能一起理解。','CKD定义t_DTS；计数器的PSC预分频与CKD是不同参数。','滤波/死区时钟分频');
 if(field==='TIM_RepetitionCounter')return info('设置重复计数参数',`配置单中填 ${value}。常见TIM2入门例子不使用高级定时器的重复计数功能。`,'重复计数器针对具备该功能的定时器，例如F103的TIM1/TIM8；TIM2不因此多出重复计数器。','重复计数参数');
 if(field==='TIM_OCMode')return info('选择输出比较的规则',value==='TIM_OCMode_PWM1'?'选择PWM1：在向上计数的常见配置下，计数小于比较值时为有效状态，其余时间为无效状态。':'输出比较方式设为 '+value+'。','PWM1的有效电平还由OCPolarity决定；不能只看CCR就忽略计数模式和极性。','PWM1输出比较模式');
 if(field==='TIM_OutputState')return info('允许这个通道输出',value==='TIM_OutputState_Enable'?'在配置单里允许通道把波形送出来；还需要正确GPIO复用和TIM_Cmd启动计数。':'通道输出状态设为 '+value+'。','控制捕获比较通道输出使能；不是整个定时器的运行开关。','通道输出使能');
 if(field==='TIM_OCPolarity')return info('决定哪种电平算有效',value==='TIM_OCPolarity_High'?'把有效状态定义为高电平；结合PWM1、向上计数，比较值越大通常高电平持续越久。':'输出极性设为 '+value+'。','极性可以反转输出；占空比解释必须同时考虑PWM模式与极性。','有效电平 '+(value==='TIM_OCPolarity_High'?'高':value));
 if(field==='TIM_Pulse')return info('设置第一次比较门槛',`把通道的初始比较值写成 ${value}。它表示计数门槛，不是直接写“百分之${value}”。`,'该字段初始化CCR；PWM1/向上计数/高有效时，占空比通常为CCR/(ARR+1)，限于有效数值范围。','初始比较值 '+value);
 const adcFields={
  ADC_Mode:['让ADC独立工作','选择 '+value+'；Independent表示该ADC单独完成转换，不与另一个ADC组合工作。'],
  ADC_ScanConvMode:['是否轮流采多个通道',value==='DISABLE'?'关闭扫描：这个例子只采配置的一个通道。':'扫描开关为 '+value+'，还需完整配置通道顺序。'],
  ADC_ContinuousConvMode:['是否自动连续采样',value==='DISABLE'?'关闭连续采样：完成一次后等待下一次触发，循环里需再次启动。':'连续采样开关为 '+value+'。'],
  ADC_ExternalTrigConv:['选择开始采样的来源',value==='ADC_ExternalTrigConv_None'?'不依赖外部触发事件；这个例子用软件启动一次转换。':'转换触发来源设为 '+value+'。'],
  ADC_DataAlign:['结果放在数值的哪一侧',value==='ADC_DataAlign_Right'?'结果右对齐：12位结果可直接按0～4095的整数读取。':'结果对齐方式设为 '+value+'。'],
  ADC_NbrOfChannel:['这一组要采几个通道',`规则通道序列的长度设为 ${value}；1表示每轮只有一个通道。`]
 };
 if(adcFields[field])return info(...adcFields[field],`设置 ${variable}.${field}；字段只填写配置单，ADC_Init后才应用。`,adcFields[field][0]);
 const serialFields={
  USART_BaudRate:['设置串口通信速度',`设为 ${value} bit/s（每秒比特数），不是每秒${value}个字符。通信双方的波特率应匹配。`],
  USART_WordLength:['设置一帧的数据位数',value==='USART_WordLength_8b'?'使用8位字长；配合无校验时，每帧可传一个8位字节。':'字长设置为 '+value+'。'],
  USART_StopBits:['设置帧结尾的停止位',value==='USART_StopBits_1'?'每帧末尾留1个停止位，帮助接收方分清下一帧。':'停止位设置为 '+value+'。'],
  USART_Parity:['是否添加奇偶校验',value==='USART_Parity_No'?'不添加奇偶校验位；与8位字长、1个停止位一起构成常见8N1。':'校验设置为 '+value+'，通信双方必须一致。'],
  USART_HardwareFlowControl:['是否用额外信号控制收发',value==='USART_HardwareFlowControl_None'?'不使用RTS/CTS硬件流控；这个例子不需要流控信号线。':'硬件流控方式为 '+value+'。'],
  USART_Mode:['允许发送、接收还是两者',/Tx/.test(value)&&/Rx/.test(value)?'同时允许发送和接收；竖线 | 把两个功能选项合在一起。':'串口方向设为 '+value+'。']
 };
 if(serialFields[field])return info(...serialFields[field],`填写 ${variable}.${field}；USART_Init才应用参数，USART_Cmd另行使能串口。`,serialFields[field][0]);
 return null;
}

export function explainSourceLine(source,fallback,board={},context={}){
 const raw=String(source??''),local=lexicalSource(raw),t=(context.codeLine??local.code).trim(),mask=lexicalSource(t).mask;
 if(!raw.trim())return info('空行','留一点空白，分开不同步骤。','空白字符不产生独立操作。','留白，不执行动作');
 if(!t||context.lineState==='block-comment'&&!context.codeLine?.trim())return info('写给人看的注释',raw.trim().replace(/^\/\/?\*?|\*\/$/g,'').trim()||'这段说明不会执行。','单行或块注释不参与程序执行；注释中出现函数名也不会调用它。','注释，不执行');
 if(/^#include\b/.test(t))return info('引入声明与类型',`让程序认识 ${t.replace(/^#include\s*/,'')} 中声明的名称。头文件通常是“怎么调用”的说明，函数实现还要由源文件或库提供。`,'预处理include；引入声明不等于链接完成或外设已经工作。本平台对受支持外设使用行为兼容层。','引入头文件声明');
 const macro=/^#define\s+(\w+)(\([^)]*\))?\s*(.*)/.exec(t);
 if(macro)return info(macro[2]?'定义带参数的宏':'给常量取名字',`后面写 ${macro[1]}${macro[2]||''} 时，预处理器按 ${macro[3]||'空内容'} 替换。这里没有执行一次函数调用。`,'宏是预处理文本替换；函数式宏的参数、括号及副作用需要谨慎处理。','宏 '+macro[1]);
 if(/^void\s+setup\s*\(/.test(mask))return info('先做一次准备','Arduino风格程序启动后执行一次这里的设置，例如把引脚设为输出。','setup由Arduino运行框架调用；真实启动代码先完成运行时初始化。','一次性的初始化入口');
 if(/^void\s+loop\s*\(/.test(mask))return info('重复做这些事','里面的动作做完后，会再从开头做一遍。','loop由运行框架反复调用。','不断重复的主循环');
 if(/^int\s+main\s*\(/.test(mask))return info('用户程序的入口','启动准备完成后，从main开始执行你写的动作。里面一般先初始化，再进入持续循环。','真实芯片先执行启动代码；本平台从main进入源码行为解释。','从 main 开始');
 if(/^else\b/.test(mask))return info('前面不满足时走这里','只有前面的if条件不满足，才考虑这一分支；如果后面还有if，就继续检查新条件。','else与最近尚未匹配的if配对；同一行的动作也受分支条件控制。','否则，检查另一分支');
 if(/^if\s*\(/.test(mask)){
  const read=callAt(t,'GPIO_ReadInputDataBit'),pin=read?gpioPinNames(read.args[0],read.args[1]):null;
  return info('先判断再行动',pin?`先读取 ${pin} 的电平，再检查括号中的条件；只有条件成立才执行后面的动作。`:'先检查括号里的条件；只有判断成立才执行后面的动作，写在同一行的动作也一样。','条件表达式非零为真，零为假；本说明不预判当前电压或运行结果。',pin?'检查 '+pin+' 后决定':'条件成立才执行');
 }
 if(/^while\s*\(/.test(mask)){
  const flag=callAt(t,'ADC_GetFlagStatus|USART_GetFlagStatus');
  if(flag){const target=flag.args[0],name=flag.args[1],waitsForSet=/^\s*==\s*(?:RESET|0)\b/.test(t.slice(flag.end));return info(waitsForSet?'等外设准备好再继续':'按条件轮询外设状态',waitsForSet&&name==='ADC_FLAG_EOC'?`循环检查 ${target} 是否完成转换；未完成就继续等，完成才往下走。`:waitsForSet&&name==='USART_FLAG_TXE'?`循环检查 ${target} 的发送数据寄存器是否空闲；能放入下一个字节才继续。`:`反复检查 ${target} 的 ${name} 标志，只有while里的实际条件变为假才离开；比较SET与比较RESET的等待方向不同。`,'这是轮询，不是固定时长延时。没有正确启动外设可能一直等待。TXE表示数据寄存器可写，TC才表示发送完成。','轮询 '+target+' 状态');}
  if(/ADC_Get(?:Reset)?CalibrationStatus/.test(mask))return info('等待校准步骤结束','只要校准状态仍为忙，就留在这里；完成后再继续。','ADC校准状态轮询；教学模型与真实校准耗时不同。','等待 ADC 校准');
  return info('条件成立就重复',/^while\s*\(\s*1\s*\)/.test(mask)?'条件1始终为真，因此做完这一轮又从循环开头做；通常用来持续控制硬件。':'每一轮开始前检查条件；只要条件仍成立，就继续执行循环体。','while是前测试循环。仿真器按执行预算让出页面，不表示真实程序自动跳出死循环。','条件成立，继续循环');
 }
 if(/^for\s*\(/.test(mask))return info('按规则重复','先做第一个分号前的准备；每轮检查中间的条件；完成循环体后执行最后的计数更新。','for三个区域分别为初始化、条件和迭代；循环次数取决于实际取值。','准备 → 判断 → 执行 → 更新');
 const struct=/\b(GPIO_InitTypeDef|TIM_TimeBaseInitTypeDef|TIM_OCInitTypeDef|ADC_InitTypeDef|USART_InitTypeDef|NVIC_InitTypeDef)\s+(\w+)\s*(?:;|=)/.exec(mask);
 if(struct){const what={GPIO_InitTypeDef:'引脚',TIM_TimeBaseInitTypeDef:'定时器计数',TIM_OCInitTypeDef:'定时器输出',ADC_InitTypeDef:'ADC采样',USART_InitTypeDef:'串口',NVIC_InitTypeDef:'中断'}[struct[1]];return info('准备一张'+what+'配置单',`创建名为 ${struct[2]} 的配置单，稍后给各个字段填值，再交给对应Init函数。此时还没有设置硬件。`,'结构体把多个参数组合在一个变量中；局部未初始化字段不能假定为0，应完整赋值或使用匹配的StructInit。','创建 '+struct[2]+' 配置单');}
 const field=/\b(\w+)\.(GPIO_\w+|TIM_\w+|ADC_\w+|USART_\w+)\s*=\s*([^;]+);?/.exec(mask);
 if(field){const explained=fieldExplanation(field[1],field[2],field[3].trim(),context);if(explained)return explained;}
 const clock=callAt(t,'RCC_APB[12]PeriphClockCmd');
 if(clock){const names=[...clock.args[0].matchAll(/RCC_APB[12]Periph_(\w+)/g)].map(m=>/^GPIO([A-G])$/.test(m[1])?m[1]+'（'+m[1].slice(-1)+'组引脚）':m[1]),enabled=clock.args[1]==='ENABLE';return info(enabled?'给外设打开工作时钟':'设置外设时钟开关',`${clock.args[1]==='DISABLE'?'关闭':enabled?'打开':'按 '+clock.args[1]+' 设置'} ${names.join('、')||clock.args[0]} 的时钟。数字逻辑需要这个工作节拍；给板子接上电源并不等于已打开每个外设时钟。`,'RCC控制外设时钟门控；不配置GPIO电平，也不等于修改CPU主频。GPIO_Init等配置前需开启对应时钟。',(enabled?'启用 ':'时钟开关 ')+(names.join('、')||clock.args[0]));}
 const init=callAt(t,'GPIO_Init');
 if(init){const variable=init.args[1]?.replace(/^&\s*/,''),fields=previousFields(variable,context),target=fields.GPIO_Pin?gpioPinNames(init.args[0],fields.GPIO_Pin):init.args[0]+' 中配置单选中的引脚',mode=modes[fields.GPIO_Mode]?.[0];return info('把配置单应用到引脚',`把 ${variable} 配置单交给 ${init.args[0]}，让 ${target}${mode?'采用'+mode:'采用其中填写的模式'}。& 表示交出配置单所在的位置；这一句才应用那些字段。`,'GPIO_Init根据结构体写端口配置；引脚推断只读取本函数前面可见的直接字段赋值，无法证明所有条件分支的最终配置。','应用配置 → '+target);}
 const gpio=callAt(t,'GPIO_SetBits|GPIO_ResetBits|GPIO_WriteBit|GPIO_ReadInputDataBit|GPIO_ReadOutputDataBit');
 if(gpio){const pins=gpioPinNames(gpio.args[0],gpio.args[1]),read=gpio.name.includes('Read');
  if(read)return info('读取 '+pins,gpio.name==='GPIO_ReadInputDataBit'?`读取 ${pins} 输入端实际捕获的电平，结果是0或1；常用于判断按钮。`:`读取 ${pins} 输出寄存器里保存的位值；这与被外部电路拉动后的真实引脚电压不是同一测量。`,'IDR读取输入状态，ODR读取输出数据锁存；输入悬空或输出争用仍需结合电路检查。',(gpio.name==='GPIO_ReadInputDataBit'?'读输入 ':'读输出锁存 ')+pins);
  const high=gpio.name==='GPIO_SetBits'||gpio.name==='GPIO_WriteBit'&&gpio.args[2]==='Bit_SET',low=gpio.name==='GPIO_ResetBits'||gpio.name==='GPIO_WriteBit'&&gpio.args[2]==='Bit_RESET',level=high?'高':low?'低':'由 '+gpio.args[2]+' 决定的';
  return info('改变 '+pins+' 的输出位',`把 ${pins} 的输出位写为${high?'1':low?'0':gpio.args[2]}。已配置为普通推挽输出时，对应${level}电平；灯亮不亮还要看接线${pins==='PC13'&&board.id==='bluepill'?'，本板PC13灯低电平点亮':''}。`,'置位/清零输出数据位；开漏写1会释放引脚，不会主动驱动高电平。操作不会替代时钟启用与GPIO_Init。',pins+' → '+(high?'高':low?'低':gpio.args[2]));
 }
 const adcck=callAt(t,'RCC_ADCCLKConfig');if(adcck){const div=/Div(\d+)/.exec(adcck.args[0])?.[1];return info('放慢ADC工作时钟',`把PCLK2${div?'除以'+div:'按 '+adcck.args[0]+' 分频'}后交给ADC。${div==='6'?'若PCLK2为72MHz，ADC就得到12MHz。':''}`,'ADC时钟与CPU时钟不是一个概念，必须满足具体芯片允许的ADC时钟范围。','设置 ADC 时钟分频');}
 const ch=callAt(t,'ADC_RegularChannelConfig');if(ch){const n=/ADC_Channel_(\d+)/.exec(ch.args[1])?.[1],pin=['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7','PB0','PB1','PC0','PC1','PC2','PC3','PC4','PC5'][Number(n)],cycles=/ADC_SampleTime_(\d+)Cycles(\d+)/.exec(ch.args[3]||'');return info('选择要测哪一路电压',`让 ${ch.args[0]} 在序列第 ${ch.args[2]} 位采通道 ${n??ch.args[1]}${pin&&/^ADC[12]$/.test(ch.args[0])?'（F103默认对应 '+pin+'）':''}。${cycles?'采样窗口是 '+cycles[1]+'.'+cycles[2]+' 个ADC时钟周期。':''}`,'规则通道配置包含通道、序列位置和采样时间；GPIO还要设为模拟输入，完整转换时间不只包含采样窗口。','采样 '+(pin||ch.args[1]));}
 const conversion=callAt(t,'ADC_GetConversionValue|ADC_SoftwareStartConvCmd|ADC_StartCalibration|ADC_ResetCalibration');
 if(conversion){if(conversion.name==='ADC_GetConversionValue')return info('取回最近一次ADC结果',`从 ${conversion.args[0]} 读取转换结果。F103在12位右对齐时为0～4095；这里读取结果本身不会启动下一次采样。`,'应在完成标志EOC就绪后读数据寄存器；左对齐、参考电压及误差会影响数值的解释。','取回 12 位采样结果');if(conversion.name==='ADC_SoftwareStartConvCmd')return info('用软件触发一次采样',`向 ${conversion.args[0]} 发出${conversion.args[1]==='ENABLE'?'启动转换':'由 '+conversion.args[1]+' 控制的转换'}命令；随后要等待完成，再读数。`,'触发与结果读取是不同步骤；本模型的完成时机不用于证明真实ADC转换耗时。','启动 ADC 转换');return info('准备ADC内部校准',conversion.name==='ADC_ResetCalibration'?'先复位校准寄存器；完成后再启动校准。':'启动ADC校准步骤，接着轮询忙状态直到结束。','校准针对ADC内部误差；不代替传感器校准或输入电压范围检查。','ADC 校准步骤');}
 const timer=callAt(t,'TIM_SetCompare[1-4]|TIM_Cmd|TIM_InternalClockConfig|TIM_TimeBaseInit|TIM_OC[1-4]Init|TIM_OCStructInit|TIM_ARRPreloadConfig|TIM_OC[1-4]PreloadConfig');
 if(timer){
  if(timer.name.startsWith('TIM_SetCompare'))return info('调整PWM比较门槛',`把 ${timer.args[0]} 通道${timer.name.at(-1)}的比较值改为 ${timer.args[1]}。它是计数门槛，不是直接的百分数；例如周期1000个计数时，500才对应50%。`,'在PWM1、向上计数、高有效配置下，CCR/(ARR+1)决定占空比；极性、模式、预装载和边界值还会影响输出。','比较值 ← '+timer.args[1]);
  if(timer.name==='TIM_Cmd')return info(timer.args[1]==='ENABLE'?'让定时器开始计数':'设置定时器启停',`${timer.args[1]==='ENABLE'?'启动':timer.args[1]==='DISABLE'?'停止':'按 '+timer.args[1]+' 控制'} ${timer.args[0]}。GPIO、周期和通道配置要配套，计数运行才可能形成预期PWM。`,'控制CEN运行位；时钟门控、通道使能与引脚复用仍是独立步骤。','定时器 '+timer.args[1]);
  if(timer.name==='TIM_InternalClockConfig')return info('选择定时器内部时钟',`让 ${timer.args[0]} 使用内部时钟路径，后面再由预分频器降低计数速度。`,'内部时钟来自芯片时钟树；不是新建一个任意频率的时钟。','选择内部计数时钟');
  if(timer.name==='TIM_OCStructInit')return info('先给输出配置单填默认值',`给 ${timer.args[0].replace(/^&\s*/,'')} 的各个字段填入库默认值，再修改需要的项目。这里还没有写定时器硬件。`,'StructInit初始化内存中的结构体；OCxInit才应用通道配置。','填写输出配置默认值');
  if(timer.name.includes('Preload'))return info('让新参数在更新边界生效',`为 ${timer.args[0]} 设置预装载。启用后，新周期或比较值先保存，等合适的更新事件再使用。`,'预装载用于减少在一个PWM周期中途修改参数造成的不连续；本平台不模拟全部寄存器级事件时序。','设置预装载');
  return info('把定时器配置单交给硬件',`把 ${timer.args[1]?.replace(/^&\s*/,'')} 中的${timer.name==='TIM_TimeBaseInit'?'分频、计数上限等':'通道模式、比较值等'}参数应用到 ${timer.args[0]}。`,'Init应用配置，TIM_Cmd控制计数启停，通道与GPIO仍需正确连接。','应用 '+timer.args[0]+' 配置');
 }
 const uart=callAt(t,'USART_SendData|USART_ReceiveData|USART_GetFlagStatus');if(uart){
  if(uart.name==='USART_SendData')return info('送出一个串口数据',`把 ${uart.args[1]} 交给 ${uart.args[0]} 的发送数据寄存器，通常先等TXE空闲。字符要先有相应编码；这个调用不会自动添加换行。`,'发送数据寄存器写入；当前平台是字节队列模型，不逐位模拟实际线路波形。','串口发送 '+uart.args[1]);
  if(uart.name==='USART_ReceiveData')return info('取出收到的数据',`从 ${uart.args[0]} 取出接收数据，通常先检查RXNE，确认确实收到数据。`,'真实器件的读取会影响接收状态；字长/校验配置决定有效数据位。','读取收到的字节');
  return info('检查串口是否就绪',`读取 ${uart.args[0]} 的 ${uart.args[1]} 标志；TXE表示发送寄存器可写，RXNE表示收到数据可读，TC表示发送完成。`,'状态读取本身不会发送或接收一个新字节。','读取串口状态');
 }
 const peripheralInit=callAt(t,'ADC_Init|USART_Init|ADC_Cmd|USART_Cmd');if(peripheralInit)return info(peripheralInit.name.endsWith('_Init')?'应用外设配置单':'设置外设工作开关',peripheralInit.name.endsWith('_Init')?`把 ${peripheralInit.args[1]?.replace(/^&\s*/,'')} 配置单交给 ${peripheralInit.args[0]}；这里只应用参数，是否启动还看使能步骤。`:`按 ${peripheralInit.args[1]} 启用或关闭 ${peripheralInit.args[0]}；时钟与参数必须已正确准备。`,'外设时钟门控、Init参数配置与Cmd使能是不同步骤。','设置 '+peripheralInit.args[0]);
 const pm=callAt(t,'pinMode');if(pm){const descriptions={OUTPUT:'主动控制高低电平',INPUT:'读取外部电平，不自动提供上下拉',INPUT_PULLUP:'读取输入，并用内部上拉提供默认高电平',INPUT_PULLDOWN:'读取输入，并用内部下拉提供默认低电平'};return info('设置引脚的任务',`把 ${pm.args[0]} 设为 ${pm.args[1]}：${descriptions[pm.args[1]]||'具体能力取决于板型'}。`,'引脚方向和偏置受所选板型约束；仅输入脚不能作为输出，部分芯片不支持内部下拉。',pm.args[0]+' → '+pm.args[1]);}
 const dw=callAt(t,'digitalWrite');if(dw)return info('写入引脚的高低状态',`给 ${dw.args[0]} 写入 ${dw.args[1]}。若已设为OUTPUT，HIGH对应约 ${board.logicVoltage||3.3}V、LOW接近0V；若仍为INPUT，通常是在开关内部上拉。`,'digitalWrite不自动把INPUT改成OUTPUT；HIGH也不保证灯亮，电流、模式与接线仍决定动作。',dw.args[0]+' 写 '+dw.args[1]);
 if(callAt(t,'digitalRead'))return info('看看输入脚的状态','读出外部电路送到引脚的高低电平，通常得到1或0；把输入悬空时不能期待稳定结果。','输入必须有明确的电位参考；仿真显示的数值不代表真实悬空脚可靠。','读取输入电平 0 / 1');
 if(callAt(t,'pulseIn'))return info('等到完整脉冲，再读脉宽','等待指定高电平或低电平从开始到结束，返回脉宽，单位为微秒。到时仍未读到完整脉冲就返回 0。','第三个参数是超时微秒数，默认 1000000。实验台从已建模的电路信号测量。','读取脉宽（µs）');
 const wire=callAt(t,'Wire\\s*\\.\\s*(?:begin|beginTransmission|write|endTransmission|requestFrom|available|read|peek)');
 if(wire){
  const method=wire.name.split('.').at(-1).trim(),hint=WIRE_HINTS.find(([name])=>name===method);
  const detail={begin:'在 setup 中调用一次。',beginTransmission:'参数是设备地址，例如 OLED 常用的 0x3C。',
   write:'连续调用可以加入多个字节。UNO 风格发送缓冲区最多 32 字节。',
   endTransmission:'返回 0 表示应答，1 表示缓冲区满，2 或 3 表示地址或数据未应答，4 表示其他错误。传入 false 可保留总线，供下一次传输重复起始。',
   requestFrom:'向 7 位设备地址请求字节，接收缓冲区最多 32 字节。返回值是实际收到的个数。默认在读取后发送 STOP。',
   available:'返回当前接收缓冲区还没被取出的字节数。',read:'取出接收缓冲区的第一个字节，剩余数量减一。',
   peek:'返回下一个字节，不减少未读数量。缓冲区为空时返回 −1。'};
  return info(hint[2],detail[method],'虚拟 I²C 传输以 100 kHz 估算耗时。','Wire.'+method);
 }
 if(callAt(t,'analogRead')){const max=board.adcReadMax??board.adcMax??(2**(board.adcDefaultBits??12)-1);return info('把电压变成数字',`读取模拟输入电压；按当前编辑器显示的读数范围得到0～${max}。如果程序在运行中改分辨率，返回范围还会改变。`,'静态范围是板型/已识别设置的提示；硬件ADC位数、Arduino返回位宽及实际有效精度不是同一个量。','模拟电压 → 0…'+max);}
 if(callAt(t,'analogWrite'))return info('调整输出的平均效果','对支持PWM的引脚，用高低交替的占空比调节平均效果；具体取值范围、频率和非PWM引脚行为取决于板型。','通常不是恒定模拟电压；部分真实芯片支持DAC，不能把所有analogWrite统一等同于同一硬件。','设置 PWM 输出值');
 const wait=callAt(t,'delay|Delay_ms|Delay_us|Delay_s|delayMicroseconds');if(wait){const unit=/us|Microseconds/.test(wait.name)?'微秒':wait.name==='Delay_s'?'秒':'毫秒';return info('保持状态，等一会儿',`等待 ${wait.args[0]} ${unit}后再执行后面的动作。1000微秒=1毫秒，1000毫秒=1秒。`,'当前实验台推进虚拟时间，不用于测量实际MCU指令周期或阻塞延时精度。','等待 '+wait.args[0]+' '+unit);}
 if(callAt(t,'millis|micros'))return info('读取已经过去多久','取得从程序启动后经过的虚拟时间；millis以毫秒计，micros以微秒计。','计数用于时间差判断；有限位宽计数会回绕，不是系统日历时间。','读取经过的时间');
 if(/^[{}];?$/.test(mask.trim()))return info(t[0]==='{'?'一组动作开始':'一组动作结束','花括号把这些语句放进同一个代码块；局部变量的作用范围也与代码块有关。','复合语句与作用域边界。',t[0]==='{'?'代码块开始':'代码块结束');
 if(/^return\b/.test(mask))return info('结束当前函数','把return后的结果交回调用者，然后立即离开这个函数；没有值时只结束调用。','返回值必须与函数声明相容。','返回结果，结束函数');
 const functionName=/^(?:static\s+)?(?:void|int|float|double|char|uint\d+_t|unsigned(?:\s+int)?)\s+(\w+)\s*\(/.exec(mask);
 if(functionName)return info('定义一个可调用的步骤',`给这组动作取名 ${functionName[1]}，以后调用这个名字时才执行函数体。函数定义出现在文件里，不代表现在就运行它。`,'函数声明/定义描述参数和返回类型；实际执行由调用关系决定。','函数 '+functionName[1]);
 const declaration=/^(?:(?:static|const|volatile)\s+)*(?:(?:unsigned|signed)\s+)?(?:int|float|double|char|bool|boolean|byte|word|uint\d+_t|int\d+_t|long|short)\s+\*?\s*(\w+)(?:\s*\[[^\]]*\])?\s*(?:=\s*([^;]+))?/.exec(t);
 if(declaration)return info('准备一个有名字的存储位置',`创建 ${declaration[1]}${declaration[2]?'，开始时存入 '+declaration[2].trim():'，这一行没有写出初始值；局部变量使用前需要可靠赋值'}。后面可用这个名字取出或更新数据。`,'声明决定类型与存储；静态/全局零初始化与未初始化局部变量规则不同，不能混为一谈。','变量 '+declaration[1]+(declaration[2]?' ← '+declaration[2].trim():''));
 if(/^[\w.\[\]]+\s*=(?!=)/.test(mask.trim()))return info('把结果保存起来','先算等号右边，再把结果保存到左边的变量或字段。','=是赋值，==才是判断是否相等。','计算右边 → 保存到左边');
 const d=typeof fallback==='function'?fallback(t):null;if(d?.plain)return {...d,short:d.short||d.title||d.plain,scope:'静态规则说明；自定义函数请查看实际定义。'};
 return info('结合定义查看这一步','先看这个名称在哪里定义、接收什么参数；静态规则不能可靠解释时，应打开对应函数实现。','说明工具不执行程序、不展开所有宏或跟踪运行分支；编译与运行诊断仍是独立检查。','查看语句或函数定义');
}
export function explainSource(source,fallback,board={}){
 const text=String(source??''),analysis=lexicalSource(text),codeLines=analysis.code.split('\n');
 return text.split('\n').map((line,i)=>explainSourceLine(line,fallback,board,{source:text,analysis,lineNumber:i+1,offset:analysis.lineStarts[i],lineState:analysis.lineStates[i],codeLine:codeLines[i]}));
}

const STRUCT_FIELDS={GPIO_InitTypeDef:['GPIO_Pin','GPIO_Mode','GPIO_Speed'],TIM_TimeBaseInitTypeDef:['TIM_Prescaler','TIM_Period','TIM_CounterMode','TIM_ClockDivision','TIM_RepetitionCounter'],TIM_OCInitTypeDef:['TIM_OCMode','TIM_OutputState','TIM_OCPolarity','TIM_Pulse'],ADC_InitTypeDef:['ADC_Mode','ADC_ScanConvMode','ADC_ContinuousConvMode','ADC_ExternalTrigConv','ADC_DataAlign','ADC_NbrOfChannel'],USART_InitTypeDef:['USART_BaudRate','USART_WordLength','USART_StopBits','USART_Parity','USART_HardwareFlowControl','USART_Mode']};
function defaultPinLiteral(board){
 if(!board||!Object.hasOwn(board,'ledPin')||board.ledPin)return 'LED_BUILTIN';
 const pin=board.defaultPins?.led;if(!pin)return '0';const number=Object.entries(board.numberedPins||{}).find(([,name])=>name===pin)?.[0];return number??pin;
}
export function completionCandidates(text,cursor,{language='spl',pins=[],board={}}={}){
 text=String(text??'');cursor=Math.max(0,Math.min(text.length,cursor));const context=editorContextAt(text,cursor),before=text.slice(0,cursor),match=/([A-Za-z_]\w*)$/.exec(before),prefix=match?.[1]||'',suffix=/^\w*/.exec(text.slice(cursor))[0],start=cursor-prefix.length,end=cursor+suffix.length;
 if(context!=='code')return {prefix,start,end,context,items:[]};
 const dialect=/arduino/i.test(language)?'arduino':'spl',masked=lexicalSource(text).mask,names=[],member=/\b(\w+)\s*\.\s*[A-Za-z_]*\w*$/.exec(before);
 if(member){
  if(dialect==='arduino'&&member[1]==='Wire')names.push(...WIRE_HINTS.map(([label,insert,detail,signature])=>({label,insert,detail,signature,kind:'I²C'})));
  const declaration=new RegExp('\\b('+Object.keys(STRUCT_FIELDS).join('|')+')\\s+'+escapeRE(member[1])+'\\b').exec(masked);
  if(declaration)names.push(...STRUCT_FIELDS[declaration[1]].map(label=>({label,insert:label,detail:'配置单 '+member[1]+' 的字段；赋值后由Init应用',kind:'结构体字段'})));
 }
 else{
  names.push(...API_HINTS.filter(x=>x[4]==='all'||x[4]===dialect).map(([label,insert,detail,signature])=>({label,insert:dialect==='arduino'?insert.replaceAll('LED_BUILTIN',defaultPinLiteral(board)):insert,detail,signature,kind:'函数 / 模板'})));
  const constants=dialect==='spl'?['GPIOA','GPIOB','GPIOC','GPIO_InitTypeDef','GPIO_Mode_Out_PP','GPIO_Mode_Out_OD','GPIO_Mode_AF_PP','GPIO_Mode_IPU','GPIO_Mode_IPD','GPIO_Mode_IN_FLOATING','GPIO_Mode_AIN','GPIO_Speed_2MHz','GPIO_Speed_50MHz','RCC_APB2Periph_GPIOA','RCC_APB2Periph_GPIOB','ENABLE','DISABLE','Bit_SET','Bit_RESET',...Array.from({length:16},(_,i)=>'GPIO_Pin_'+i)]:['HIGH','LOW','OUTPUT','INPUT','INPUT_PULLUP',...(!Object.hasOwn(board,'ledPin')||board.ledPin?['LED_BUILTIN']:[]),'A0','A1','A2','A3'];
  constants.push(...pins);names.push(...[...new Set(constants)].map(label=>({label,insert:label,detail:'常量或引脚名称；仍需符合当前板型',kind:'常量'})));
  for(const m of masked.matchAll(/\b(?:void|int|float|char|double|long|bool|uint\d+_t)\s+([A-Za-z_]\w*)\s*\(/g))names.unshift({label:m[1],insert:m[1]+'()',detail:'当前文件定义/声明的函数',kind:'用户函数'});
  for(const m of masked.matchAll(/\b(?:int|float|char|double|long|bool|uint\d+_t|GPIO_InitTypeDef)\s+([A-Za-z_]\w*)\b(?!\s*\()/g))names.push({label:m[1],insert:m[1],detail:'当前文件中声明的名称；作用域仍需编译检查',kind:'变量'});
 }
 const seen=new Set();return {prefix,start,end,context,items:names.filter(x=>{if(seen.has(x.label)||prefix&&!x.label.toLowerCase().startsWith(prefix.toLowerCase()))return false;seen.add(x.label);return true;}).slice(0,12)};
}

/** A single replacement plus final selection, shared by Tab and comment toggles. */
export function indentSelection(text,start,end,{outdent=false,unit='    '}={}){
 text=String(text??'');if(start===end&&!outdent)return {start,end,text:unit,selectionStart:start+unit.length,selectionEnd:start+unit.length};
 const first=start===0?0:text.lastIndexOf('\n',start-1)+1,lastIndex=end>start&&text[end-1]==='\n'?end-1:end,next=text.indexOf('\n',lastIndex),last=next<0?text.length:next;
 const block=text.slice(first,last),lines=block.split('\n');let delta=0,firstDelta=0;
 const changed=lines.map((line,i)=>{let d=unit.length,result=unit+line;if(outdent){const remove=line.startsWith('\t')?1:Math.min(unit.length,/^ */.exec(line)[0].length);d=-remove;result=line.slice(remove);}delta+=d;if(!i)firstDelta=d;return result;}).join('\n');
 const adjustStart=Math.max(first,start+firstDelta),adjustEnd=Math.max(adjustStart,end+delta);
 return {start:first,end:last,text:changed,selectionStart:adjustStart,selectionEnd:start===end?adjustStart:adjustEnd};
}
export function toggleLineComment(text,start,end){
 text=String(text??'');const first=start===0?0:text.lastIndexOf('\n',start-1)+1,lastIndex=end>start&&text[end-1]==='\n'?end-1:end,next=text.indexOf('\n',lastIndex),last=next<0?text.length:next;
 const lines=text.slice(first,last).split('\n'),nonEmpty=lines.filter(l=>l.trim()),remove=nonEmpty.length>0&&nonEmpty.every(l=>/^\s*\/\//.test(l));let firstDelta=0,delta=0;
 const replacement=lines.map((line,i)=>{let result=line;if(line.trim()||lines.length===1){if(remove)result=line.replace(/^(\s*)\/\/ ?/,'$1');else result=line.replace(/^(\s*)/,'$1// ');}const diff=result.length-line.length;delta+=diff;if(!i)firstDelta=diff;return result;}).join('\n');
 return {start:first,end:last,text:replacement,selectionStart:Math.max(first,start+firstDelta),selectionEnd:Math.max(first,start===end?start+firstDelta:end+delta)};
}
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let assistantCounter=0;
export function createEditorAssistant({textarea,annotations,popup,hint,getContext=()=>({}),explain,onInput,onRun}={}){
 let suggestions=[],active=0,replacementStart=0,replacementEnd=0,completionCursor=0,visible=false,composing=false,blurTimer=null,tabEscape=false,cachedText=null,explanations=[];const listeners=[],uid='completion-'+(++assistantCounter);
 popup.id ||= uid;popup.setAttribute?.('role','listbox');popup.setAttribute?.('aria-label','代码补全建议');
 textarea.setAttribute?.('aria-autocomplete','list');textarea.setAttribute?.('aria-controls',popup.id);textarea.setAttribute?.('aria-haspopup','listbox');textarea.setAttribute?.('aria-description','Ctrl或Command加空格打开补全。Tab缩进，Shift加Tab退缩进。按Esc后再按Tab可离开代码编辑器。');
 const listen=(el,type,handler)=>{el.addEventListener(type,handler);listeners.push(()=>el.removeEventListener(type,handler));};
 const dispatch=type=>{const EventClass=textarea.ownerDocument?.defaultView?.Event||globalThis.Event;textarea.dispatchEvent(new EventClass(type,{bubbles:true}));};
 const close=()=>{visible=false;popup.hidden=true;textarea.setAttribute?.('aria-expanded','false');textarea.removeAttribute?.('aria-activedescendant');};
 function show(force=false){
  if(composing||textarea.selectionStart!==textarea.selectionEnd){close();return;}
  const d=completionCandidates(textarea.value,textarea.selectionStart,getContext()||{});
  if(d.context!=='code'||(!force&&d.prefix.length<2)||!d.items.length){close();return;}
  suggestions=d.items;replacementStart=d.start;replacementEnd=d.end;completionCursor=textarea.selectionStart;active=0;visible=true;popup.hidden=false;textarea.setAttribute?.('aria-expanded','true');positionPopup();render();
 }
 function positionPopup(){const before=textarea.value.slice(0,textarea.selectionStart),row=before.split('\n').length-1,col=(before.split('\n').at(-1)||'').replace(/\t/g,'    ').length;popup.style.top=Math.max(8,Math.min(Math.max(8,textarea.clientHeight-210),12+row*22-textarea.scrollTop+22))+'px';popup.style.left=Math.max(8,Math.min(Math.max(8,textarea.clientWidth-320),9+col*8.4-textarea.scrollLeft))+'px';}
 function render(){
  popup.innerHTML=suggestions.map((s,i)=>`<button type="button" tabindex="-1" id="${uid}-option-${i}" role="option" aria-selected="${i===active}" class="${i===active?'active':''}" data-completion="${i}"><span><b>${html(s.label)}</b><small>${html(s.kind)}</small></span><em>${html(s.detail)}</em></button>`).join('')+'<div class="completion-footer" role="presentation">↑ ↓ 选择 · Enter / Tab 填入 · Esc 关闭</div>';
  textarea.setAttribute?.('aria-activedescendant',uid+'-option-'+active);
  popup.querySelectorAll('[data-completion]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=e=>{e.preventDefault();accept(Number(b.dataset.completion));};});
  const selected=popup.querySelector?.('#'+uid+'-option-'+active);
  if(selected&&popup.getBoundingClientRect&&selected.getBoundingClientRect){
   const bounds=popup.getBoundingClientRect(),option=selected.getBoundingClientRect();
   if(option.top<bounds.top)popup.scrollTop+=option.top-bounds.top;
   else if(option.bottom>bounds.bottom)popup.scrollTop+=option.bottom-bounds.bottom;
  }
 }
 function edit(change,{suggest=false}={}){
  textarea.setRangeText(change.text,change.start,change.end,'end');textarea.setSelectionRange(change.selectionStart,change.selectionEnd);close();dispatch('input');if(!suggest)close();dispatch('select');
 }
 function accept(i=active){
  if(composing||textarea.selectionStart!==textarea.selectionEnd||textarea.selectionStart!==completionCursor){close();return;}const s=suggestions[i];if(!s)return;
  const before=textarea.value.slice(0,replacementStart),after=textarea.value.slice(replacementEnd);let insert=s.insert;
  if(['setup','loop'].includes(s.label)&&/\bvoid\s+$/.test(before))insert=insert.replace(/^void\s+/,'');
  if(/^\s*\(/.test(after)&&s.kind.includes('函数'))insert=s.label;
  else if(/^\s*;/.test(after))insert=insert.replace(/;\s*$/,'');
  const indent=/^[\t ]*/.exec(before.split('\n').at(-1)||'')[0];if(insert.includes('\n'))insert=insert.replace(/\n/g,'\n'+indent);
  const pos=replacementStart+insert.length;edit({start:replacementStart,end:replacementEnd,text:insert,selectionStart:pos,selectionEnd:pos});textarea.focus();
 }
 function ensureExplanations(){const ctx=getContext()||{};if(cachedText!==textarea.value){cachedText=textarea.value;explanations=explainSource(textarea.value,explain,ctx.board);}return explanations;}
 function renderAnnotations(){cachedText=null;const all=ensureExplanations();annotations.innerHTML=all.map((d,i)=>`<div data-annotation-line="${i+1}" title="${html(d.plain+'\n专业说明：'+d.technical+'\n'+(d.scope||''))}"><span>${html(d.short||d.title)}</span></div>`).join('');annotations.scrollTop=textarea.scrollTop;updateHint();}
 function updateHint(){const lineNo=textarea.value.slice(0,textarea.selectionStart).split('\n').length,d=ensureExplanations()[lineNo-1]||explainSourceLine('');hint.innerHTML=`<span class="line-hint-number">L${lineNo}</span><span><strong>${html(d.title)}</strong> ${html(d.plain)}<small class="editor-explanation-scope">静态规则说明；实际状态以运行与电路为准。</small></span>`;hint.title=d.technical;annotations.querySelectorAll('[data-annotation-line]').forEach(el=>el.classList.toggle('active',Number(el.dataset.annotationLine)===lineNo));}
 listen(textarea,'compositionstart',()=>{composing=true;close();});
 listen(textarea,'compositionend',()=>{composing=false;renderAnnotations();close();});
 listen(textarea,'input',event=>{if(composing||event.isComposing){close();return;}renderAnnotations();show(false);onInput?.(event);});
 listen(textarea,'scroll',()=>{annotations.scrollTop=textarea.scrollTop;if(visible)positionPopup();});
 listen(textarea,'click',()=>{close();updateHint();});
 listen(textarea,'select',()=>{if(textarea.selectionStart!==textarea.selectionEnd||visible&&textarea.selectionStart!==completionCursor)close();updateHint();});
 listen(textarea,'keyup',updateHint);
 listen(textarea,'blur',()=>{blurTimer=setTimeout(close,160);});listen(textarea,'focus',()=>clearTimeout(blurTimer));
 listen(textarea,'keydown',e=>{
  if(composing||e.isComposing||e.keyCode===229)return;
  if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))close();
  if(tabEscape&&e.key==='Tab'){tabEscape=false;close();return;}if(e.key!=='Escape')tabEscape=false;
  if((e.ctrlKey||e.metaKey)&&e.key===' '){e.preventDefault();e.stopImmediatePropagation();show(true);return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();close();onRun?.();return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='/'&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();edit(toggleLineComment(textarea.value,textarea.selectionStart,textarea.selectionEnd));return;}
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();tabEscape=true;return;}
  if(visible&&['ArrowDown','ArrowUp','Enter','Tab'].includes(e.key)&&!(e.shiftKey&&e.key==='Tab')){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Tab'||e.key==='Enter')accept();else{active=(active+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;render();}return;}
  if(e.key==='Tab'){e.preventDefault();close();edit(indentSelection(textarea.value,textarea.selectionStart,textarea.selectionEnd,{outdent:e.shiftKey}));return;}
  const a=textarea.selectionStart,b=textarea.selectionEnd,context=editorContextAt(textarea.value,a);
  if(e.key==='Enter'){
   e.preventDefault();close();const before=textarea.value.slice(0,a),current=before.split('\n').at(-1)||'',base=/^[\t ]*/.exec(current)[0],code=lexicalSource(before).mask.split('\n').at(-1)||'',block=['code','line-comment'].includes(context)&&/\{\s*$/.test(code),indent=base+(block?'    ':''),rest=textarea.value.slice(b),closing=block&&/^[\t ]*}/.test(rest),closingSpace=closing?/^[\t ]*/.exec(rest)[0].length:0,insert='\n'+indent+(closing?'\n'+base:'');
   edit({start:a,end:b+closingSpace,text:insert,selectionStart:a+1+indent.length,selectionEnd:a+1+indent.length});return;
  }
  if(context!=='code'||e.ctrlKey||e.metaKey||e.altKey)return;
  const pairs={'(':')','[':']','{':'}'};
  if(e.key==='Backspace'&&a===b&&a>0&&pairs[textarea.value[a-1]]===textarea.value[a]){e.preventDefault();edit({start:a-1,end:a+1,text:'',selectionStart:a-1,selectionEnd:a-1});return;}
  if([')',']','}'].includes(e.key)&&a===b&&textarea.value[a]===e.key){e.preventDefault();close();textarea.setSelectionRange(a+1,a+1);dispatch('select');return;}
  if(pairs[e.key]){e.preventDefault();const selected=textarea.value.slice(a,b);edit({start:a,end:b,text:e.key+selected+pairs[e.key],selectionStart:a+1,selectionEnd:a+1+selected.length});}
 });
 close();return {refresh:renderAnnotations,showCompletions:()=>show(true),close,updateHint,destroy(){clearTimeout(blurTimer);for(const remove of listeners)remove();close();textarea.removeAttribute?.('aria-controls');textarea.removeAttribute?.('aria-autocomplete');textarea.removeAttribute?.('aria-haspopup');textarea.removeAttribute?.('aria-description');}};
}
