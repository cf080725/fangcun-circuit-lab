import {getBoardProfile} from "./board-profiles.js";

/** Pure export generators. Files are strings; the caller may package them with JSZip.
 * Exporting is not a local IDE build, firmware validation, or a hardware test.
 */
const xml = text => String(text).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const reservedDevice = part => /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part);
const safeName = name => {const result=String(name||"LearningLab").replace(/[^\w-]/g,"_").replace(/^_+|_+$/g,"").slice(0,60)||"LearningLab";return reservedDevice(result)?"Project_"+result:result;};
function exportPath(path){
  const name=String(path).replace(/\\/g,"/");
  if(!name||name.startsWith("/")||/^[A-Za-z]:/.test(name)||/[\x00-\x1f\x7f<>:"|?*]/.test(name))
    throw new Error("导出文件名必须是安全的项目内相对路径："+path);
  const parts=name.split("/");
  if(parts.some(part=>!part||part==="."||part===".."||/[. ]$/.test(part)||reservedDevice(part)))
    throw new Error("导出相对路径包含空目录、点目录、Windows保留名称或末尾空格/句点："+path);
  return name;
}
const pathKey=path=>path.normalize("NFC").toLowerCase();
function conflictingPath(files,path){
  const key=pathKey(path);
  return Object.keys(files).find(existing=>{const k=pathKey(existing.replace(/\\/g,"/"));return k===key||k.startsWith(key+"/")||key.startsWith(k+"/");});
}
function putSourceFile(files,path,text){
  const name=exportPath(path),conflict=conflictingPath(files,name);
  if(conflict)throw new Error("导出路径冲突："+path+" 与 "+conflict+" 在常见文件系统中可能指向同一文件或形成文件/目录冲突。请先改名；原文件未被覆盖。");
  // defineProperty also preserves an own filename such as __proto__.
  Object.defineProperty(files,name,{value:text,enumerable:true,configurable:true,writable:true});return name;
}
/** Add generated material without replacing any user file; returns actual path. */
export function appendExportFile(files,desiredPath,text,warnings=[]){
  if(!files||typeof files!=="object"||Array.isArray(files))throw new Error("导出文件集合必须是路径到内容的对象。");
  const desired=exportPath(desiredPath),segments=desired.split("/"),existing=Object.keys(files),ancestor=segments.findIndex((_,i)=>i<segments.length-1&&existing.some(p=>pathKey(p.replace(/\\/g,"/"))===pathKey(segments.slice(0,i+1).join("/"))));
  const changeIndex=ancestor>=0?ancestor:segments.length-1;let name=desired,counter=0;
  while(conflictingPath(files,name)){
    counter++;const candidate=[...segments],part=candidate[changeIndex];
    if(changeIndex===segments.length-1){const dot=part.lastIndexOf("."),stem=dot>0?part.slice(0,dot):part,ext=dot>0?part.slice(dot):"";candidate[changeIndex]=stem+".generated-"+counter+ext;}
    else candidate[changeIndex]=part+".generated-"+counter;
    name=candidate.join("/");
  }
  Object.defineProperty(files,name,{value:typeof text==="string"?text:String(text??""),enumerable:true,configurable:true,writable:true});
  if(name!==desired)warnings.push("保留了已有文件；生成的 "+desired+" 改存为 "+name+"，避免覆盖。");
  return name;
}
/** Reading-only sidecar: original source is unchanged, including raw strings/macros. */
export function createReadingGuide(source,explainFn){
  const text=String(source??""),lines=text.split(/\r\n|\n|\r/),notes=[];
  for(let i=0;i<lines.length;i++){
    let explanation;
    try{explanation=typeof explainFn==="function"?explainFn(lines[i],i+1,text):null;}catch{explanation={plain:"这一行的静态说明未能生成，请结合上下文阅读。"};}
    const plain=typeof explanation==="string"?explanation:explanation?.plain||"请结合上下文查看这一行；没有为它生成确定的作用判断。";
    notes.push("第 "+(i+1)+" 行", "原文（JSON转义显示）："+JSON.stringify(lines[i]), "白话："+plain,
      ...(explanation?.technical?["专业说明："+explanation.technical]:[]),
      ...(explanation?.scope?["范围："+explanation.scope]:[]),"");
  }
  return ["逐行读码文档（.txt，仅供阅读，不加入编译）","",
    "源码区保留输入原文，不向代码行追加注释；多行字符串、宏续行和原有注释不被改写。",
    "后面的说明使用原始物理行号，是静态阅读辅助，不等同于运行结果。","",
    "===== 原始源码开始 =====",text,"===== 原始源码结束 =====","",
    "===== 逐行阅读说明 =====",...notes].join("\n");
}
function sourceFiles(input){
  const out=Object.create(null);
  for(const [path,content] of Object.entries(input||{})){
    const name=exportPath(path);
    if(name==="__lab_arduino_entry.c")continue;
    putSourceFile(out,name,typeof content==="string"?content:String(content?.content??content?.code??""));
  }
  if(!Object.keys(out).length)throw new Error("没有可以导出的源码。");
  return out;
}
const isSketch = files => Object.keys(files).some(n=>/\.ino$/i.test(n))||Object.values(files).some(s=>/\bvoid\s+(setup|loop)\s*\(/.test(s));
const baseReadme = (board,format,warnings) => [
  "# "+board.name+" · "+format+" 导出",
  "",
  "这是实际保存的源码和工具配置。浏览器执行的是公开标注的行为模型，本导出没有在本机IDE编译、烧录或实板测试。",
  "",
  "## 已选择的硬件",
  "",
  "- 板型："+board.name,
  "- 芯片："+board.mcu,
  "- GPIO逻辑电压："+board.logicVoltage+" V",
  "- 原理图/针脚来源："+board.sources.join("\n- "),
  "",
  "## 需要留意",
  "",
  ...warnings.map(w=>"- "+w),
  "",
  "请先备份实板已有固件，并按真实电路连接与芯片手册核对供电、限流和电平；模拟器画面不代替实板测量。",
  ""
].join("\n");
function arduinoBundle(files,board,name){
  if(board.arduinoExport===false)throw new Error("这个板型的示例使用实验台教学接口。请导出通用源码包，并按官方引脚资料移植到实物 SDK。");
  if(!isSketch(files))throw new Error("当前是main/STM32标准库程序，不能靠改后缀变成Arduino。请导出Keil接入包或源码，或先选择Arduino起始示例。");
  const entry=Object.keys(files).find(n=>/\.ino$/i.test(n))||Object.keys(files).find(n=>/\bvoid\s+setup\s*\(/.test(files[n]));
  const out={},warnings=[
    "Arduino IDE中打开与文件夹同名的.ino文件，安装所需板卡core，然后重新选择实际板卡和端口。",
    "使用第三方库时需要在本机安装；导出不附带Arduino core、编译器或第三方库。"
  ];
  for(const [path,text] of Object.entries(files)){
    const target=path===entry?name+".ino":path;
    putSourceFile(out,name+"/"+target,text);
  }
  if(board.arduinoFqbn)warnings.push("参考FQBN："+board.arduinoFqbn+"；本机core版本及具体选项仍需确认。");
  if(board.family==="STM32F1"&&Object.values(files).some(s=>/\b(GPIO_|RCC_|TIM_|ADC_)/.test(s)))
    warnings.push("源码同时用了STM32F1标准库；STM32 Arduino core不会自动提供旧SPL，需自行接入兼容的依赖，或改用对应Arduino接口。");
  appendExportFile(out,name+"/README_Arduino.md",baseReadme(board,"Arduino sketch",warnings),warnings);
  return {files:out,filename:name+"_"+board.id+"_Arduino.zip",warnings};
}
function platformioBundle(files,board,name){
  if(!isSketch(files))throw new Error("这份SPL程序不属于本导出的Arduino框架。PlatformIO的CMSIS/STM32Cube也不自动提供F1旧SPL；请选择Keil接入包或源码导出。");
  const pio=board.platformio;
  if(!pio)throw new Error("该板暂无已核对的PlatformIO板型配置。");
  const out={},warnings=[
    "需要本机安装PlatformIO以及所选平台和Arduino框架；首次构建会下载工具链。",
    "保留.ino源文件由Arduino构建流程处理；自定义C/C++头文件和库仍需满足正常的声明与依赖要求。",
    "平台版本未强制锁定。构建成功后可按本机验证结果在platformio.ini锁定版本，避免把未经测试的版本写成已兼容。"
  ];
  for(const [path,text] of Object.entries(files))putSourceFile(out,"src/"+path,text);
  appendExportFile(out,"platformio.ini",[
    "; Generated configuration; not built or flashed by the browser",
    "[env:"+name+"]","platform = "+pio.platform,"board = "+pio.board,"framework = "+pio.framework,
    "monitor_speed = 9600",
    ...(board.family.startsWith("STM32")?["upload_protocol = stlink"]:[]),
    ""
  ].join("\n"),warnings);
  appendExportFile(out,"README_PlatformIO.md",baseReadme(board,"PlatformIO",warnings)+"\n## 使用\n\n在PlatformIO中打开此文件夹，先运行Build；只有本机构建通过并核对实板后再Upload。\n\n官方说明：https://docs.platformio.org/en/latest/faq/ino-to-cpp.html\n",warnings);
  return {files:out,filename:name+"_"+board.id+"_PlatformIO.zip",warnings};
}
function keilBundle(files,board,name){
  if(!board.keil)throw new Error("这块板不是本导出支持的Arm µVision目标；请使用Arduino/PlatformIO或源码导出。");
  if(isSketch(files))throw new Error("Arduino setup/loop依赖Arduino core，不能直接当作裸机Keil工程。请使用Arduino/PlatformIO导出；Keil接入包用于STM32裸机main程序。");
  if(!board.dialects.includes("stm32-spl"))throw new Error("当前没有为该板生成HAL/CMSIS固件依赖；请使用该板Arduino导出或保留源码自行接入官方工程。");
  const out={},warnings=[
    "这是µVision工程结构与源码接入包，不是已通过Keil编译的完整固件。",
    "本机需要安装Keil MDK与 "+board.keil.pack+" Device Family Pack；在Options for Target重新确认芯片、编译器、Flash布局和调试器。",
    "包内不会用空函数冒充ST驱动。缺少的CMSIS、启动文件、system文件、STM32F1 SPL及Delay实现需要从已获授权的官方包或课程工程加入。",
    "老版STM32F1 SPL/CMSIS与Arm Compiler 5/6的兼容性不同，必须选用匹配的头文件、启动代码和编译器。",
    "晶振、HSE旁路、PLL和SystemCoreClock需按实板配置。Nucleo板的ST-LINK MCO路径与Blue Pill晶振并不等同。"
  ];
  for(const [path,text] of Object.entries(files))putSourceFile(out,"User/"+path,text);
  const combined=Object.values(files).join("\n"),drivers=[];
  for(const [prefix,file] of [["GPIO_","stm32f10x_gpio.c"],["RCC_","stm32f10x_rcc.c"],["TIM_","stm32f10x_tim.c"],["ADC_","stm32f10x_adc.c"],["USART_","stm32f10x_usart.c"],["EXTI_","stm32f10x_exti.c"],["NVIC_","misc.c"]])if(combined.includes(prefix))drivers.push(file);
  const dependencies={
    device:board.keil.device,deviceFamilyPack:board.keil.pack,
    definitions:board.keil.define.split(","),
    requiredStartup:["startup_stm32f10x_md.s","system_stm32f10x.c"],
    requiredHeaders:["stm32f10x.h","stm32f10x_conf.h","core_cm3.h","system_stm32f10x.h"],
    selectedStandardPeripheralDrivers:drivers,
    delayImplementationNeeded:/\bDelay_(ms|us|s)\s*\(/.test(combined)&&!Object.keys(files).some(p=>/(^|\/)Delay\.c$/i.test(p)),
    source:"https://www.st.com/en/embedded-software/stsw-stm32054.html",
    note:"按实际库版本确认文件名/目录；不得重复加入来自不同版本的CMSIS和启动文件。"
  };
  appendExportFile(out,"Keil依赖清单.json",JSON.stringify(dependencies,null,2),warnings);
  const includePaths=[...new Set([".\\User",...Object.keys(out).filter(n=>/\.(h|hpp)$/i.test(n)).map(n=>".\\"+n.split("/").slice(0,-1).join("\\"))])];
  const entries=Object.keys(out).filter(n=>/\.(c|cpp|s|asm|h|hpp)$/i.test(n)).map(path=>{
    const type=/\.c$/i.test(path)?1:/\.cpp$/i.test(path)?8:/\.(s|asm)$/i.test(path)?2:5;
    return "          <File><FileName>"+xml(path.split("/").pop())+"</FileName><FileType>"+type+"</FileType><FilePath>"+xml(".\\"+path.replace(/\//g,"\\"))+"</FilePath></File>";
  }).join("\n");
  // µVision project XML, intentionally no invented Pack version or startup file.
  out[name+".uvprojx"]=[
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<Project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="project_projx.xsd">',
    '  <SchemaVersion>2.1</SchemaVersion>',
    '  <Header>### uVision Project, (C) Keil Software</Header>',
    '  <Targets><Target><TargetName>'+xml(name)+'</TargetName><ToolsetNumber>0x4</ToolsetNumber><ToolsetName>ARM-ADS</ToolsetName>',
    '    <TargetOption><TargetCommonOption>',
    '      <Device>'+xml(board.keil.device)+'</Device><Vendor>STMicroelectronics</Vendor>',
    '      <Cpu>'+xml('IRAM('+board.keil.ramStart+','+board.keil.ramSize+') IROM('+board.keil.flashStart+','+board.keil.flashSize+') CLOCK('+board.coreClockHz+') CPUTYPE("Cortex-M3") ELITTLE')+'</Cpu>',
    '      <OutputDirectory>.\\Objects\\</OutputDirectory><OutputName>'+xml(name)+'</OutputName><CreateExecutable>1</CreateExecutable><CreateHexFile>1</CreateHexFile><DebugInformation>1</DebugInformation><ListingPath>.\\Listings\\</ListingPath>',
    '    </TargetCommonOption><TargetArmAds><Cads><VariousControls><Define>'+xml(board.keil.define)+'</Define><IncludePath>'+xml(includePaths.join(";"))+'</IncludePath></VariousControls></Cads></TargetArmAds></TargetOption>',
    '    <Groups><Group><GroupName>User</GroupName><Files>',entries,
    '    </Files></Group></Groups>',
    '  </Target></Targets>',
    '</Project>',''
  ].join("\n");
  out["README_Keil接入.md"]=baseReadme(board,"Keil µVision接入包",warnings)+[
    "## 接入步骤","",
    "1. 安装MDK与所需Device Family Pack，打开本包的.uvprojx。该文件已列入实际导出的User源码。",
    "2. 在Options for Target重新选择 "+board.keil.device+" 与本机已安装的兼容编译器。若IDE版本要求重建工程，请用Project → New µVision Project创建同目标，再添加User目录。",
    "3. 依据Keil依赖清单加入同一版本的CMSIS/设备头文件、匹配启动文件、system_stm32f10x.c，以及实际调用的SPL驱动.c。",
    "4. 在C/C++设置中保留 "+board.keil.define+"，补齐CMSIS、SPL inc、User等实际Include Paths。",
    "5. 若使用Delay函数，加入课程配套的真实Delay.c/Delay.h；不要添加只有声明或空函数的替代品。",
    "6. 按实板检查时钟来源与SystemCoreClock，先Build并处理全部错误，再配置ST-LINK等真实下载器。",
    "",
    "## 格式与官方依据","",
    "- µVision工程格式及XSD位置：https://www.keil.com/support/man/docs/uv4/uv4_b_filetypes.asp",
    "- 新工程与启动代码：https://www.keil.com/support/man/docs/uv4cl/uv4cl_ca_createprjfile.htm",
    "- XML已按µVision的Targets/Target/Groups/Files结构生成；未在安装有MDK的环境运行Schema验证或构建。",
    ""
  ].join("\n");
  return {files:out,filename:name+"_"+board.id+"_Keil接入包.zip",warnings};
}
export function exportProject({files,boardId="bluepill",format="source",projectName="LearningLab",circuit=null}={}){
  const board=getBoardProfile(boardId),source=sourceFiles(files),name=safeName(projectName);
  let result;
  if(format==="arduino")result=arduinoBundle(source,board,name);
  else if(format==="platformio")result=platformioBundle(source,board,name);
  else if(format==="keil")result=keilBundle(source,board,name);
  else if(format==="source"){
    const warnings=["仅导出源文件；具体编译器、芯片库和启动代码需在真实工具链提供。"];
    if(board.arduinoExport===false)warnings.push("示例中的函数和引脚编号用于本实验台。移植到实物时，请核对官方引脚资料并使用对应 SDK 或开发板核心的接口。");
    const output={...source};appendExportFile(output,"README_源码.md",baseReadme(board,"源码",warnings),warnings);
    result={files:output,filename:name+"_"+board.id+"_源码.zip",warnings};
  }else throw new Error("未知导出格式："+format);
  const generatedFiles={};
  if(circuit)generatedFiles.circuit=appendExportFile(result.files,"接线项目.json",JSON.stringify({boardId:board.id,circuit},null,2),result.warnings);
  const metadataPath=appendExportFile(result.files,"导出说明.json","",result.warnings);
  generatedFiles.metadata=metadataPath;
  result.files[metadataPath]=JSON.stringify({boardId:board.id,format,hardwareVerified:false,ideBuildVerified:false,generatedFiles,warning:result.warnings},null,2);
  return result;
}
