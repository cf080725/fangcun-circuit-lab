import {mountedPartContacts} from './part-mount.js';

// Parameter constraints are explicit; invalid edits never silently change the circuit.
const BASIC={
 resistor:[{key:'resistance',label:'阻值',unit:'Ω',min:1,max:1e7,step:1}],
 led:[{key:'color',label:'发光颜色',type:'select',options:[['red','红色'],['green','绿色'],['blue','蓝色'],['yellow','黄色'],['white','白色']]}],
 button:[{key:'pressed',label:'保持按下',type:'boolean'}],
 pot:[{key:'position',label:'旋钮位置',unit:'%',type:'range',min:0,max:100,step:1,scale:100},{key:'resistance',label:'总阻值',unit:'Ω',min:10,max:1e6,step:10}],
 capacitor:[{key:'capacitance',label:'电容量',unit:'µF',min:.1,max:1e4,step:.1}],
 power:[{key:'voltage',label:'输出电压',unit:'V',min:0,max:24,step:.1}],
 buzzer:[{key:'resistance',label:'模型等效电阻',unit:'Ω',min:1,max:1e6,step:10}],
 ldr:[{key:'lux',label:'光照',unit:'lx',type:'range',min:0,max:1000,step:1}]
};
export function parameterSpecs(part,model={}){
 const specs=[...(BASIC[part.type]||[])];for(const s of model.parameters||[]){
  if(part.type==='motor'&&part.motorModel==='fa130-18100'&&['resistance','inertia'].includes(s.key))continue;
  if(!specs.some(x=>x.key===s.key))specs.push({...s});
 }
 for(const s of specs)if(s.key==='common')s.options=[['cathode','共阴极：COM 接低电位'],['anode','共阳极：COM 接高电位']];
 for(const s of specs)if(s.key==='servoModel')s.options=[['generic','通用 180° 教学模型'],['hs55','Hitec HS-55（空载）']];
 for(const s of specs)if(s.key==='motorModel')s.options=[['generic','通用有刷电机'],['fa130-18100','Mabuchi FA-130RA-18100（空载）']];
 for(const s of specs)if(part.type==='ssd1306'&&s.key==='address')s.options=[[61,'0x3D（地址焊桥开路）'],[60,'0x3C（地址焊桥闭合）']];
 for(const s of specs)if(part.type==='mcp9808'&&s.key==='address')s.options=s.options.map(value=>[value,'0x'+value.toString(16).toUpperCase()]);
 return [...specs,{key:'rotation',label:'摆放角度',type:'select',options:[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']],numeric:true}];
}
export function parseParameter(spec,raw){
 if(spec.type==='boolean')return {ok:true,value:!!raw};
 if(spec.type==='select'){const allowed=(spec.options||[]).map(x=>String(Array.isArray(x)?x[0]:x));if(!allowed.includes(String(raw)))return {ok:false,error:'请选择列表中提供的选项。'};return {ok:true,value:spec.numeric?Number(raw):String(raw)};}
 if(String(raw).trim()==='')return {ok:false,error:'请填写'+spec.label+'，单位为 '+(spec.unit||'对应数值')+'。'};
 const value=Number(raw);if(!Number.isFinite(value))return {ok:false,error:'请输入有限的数值。'};
 if(value<spec.min||value>spec.max)return {ok:false,error:`${spec.label}支持 ${spec.min}～${spec.max}${spec.unit||''}；本次输入尚未应用。`};
 return {ok:true,value:value/(spec.scale||1)};
}
export function partConnections(circuit,partId,pins){
 const part=circuit.components?.find(item=>item.id===partId),contacts=part?mountedPartContacts(part):[];
 return pins.map(pin=>{const endpoint=partId+':'+pin;const links=circuit.wires.filter(w=>w.a===endpoint||w.b===endpoint).map(w=>w.a===endpoint?w.b:w.a);for(const {a,b} of contacts)if(a===endpoint)links.push(b);return {pin,endpoint,links};});
}
export function collectDiagnostics({circuit=[],runtime=[],live=[],errors=[]}={}){
 const normalized=[...circuit.map(d=>({...d,origin:'电路'})),...runtime.map(d=>({...d,origin:'运行'})),...live.filter(d=>d.severity!=='info').map(d=>({...d,origin:'代码'})),...errors.map(d=>({...d,severity:'error',origin:'代码'}))].map(d=>({...d,severity:d.code==='ADC_IDEAL_CALIBRATION'?'info':d.severity||'warning',title:d.title||d.code||'需要检查',plain:d.plain||d.message||'',fix:d.fix||d.suggestion||'对照相关引脚、参数和代码，逐项核对。'}));
 const seen=new Set();return normalized.filter(d=>{const key=[d.code,d.plain,d.severity==='info'?'':d.file,d.severity==='info'?'':d.line,d.part].join('|');if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>({error:0,warning:1,info:2}[a.severity]??1)-({error:0,warning:1,info:2}[b.severity]??1));
}
