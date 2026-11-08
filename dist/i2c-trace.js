const statusLabels=['收到应答','缓冲区已满','地址未应答','数据未应答','总线错误'];
const reasonLabels={
  'address-nack':'核对程序地址和模块的地址配置。',
  'disconnected':'检查 SDA、SCL 是否接到对应引脚。',
  'swapped-lines':'SDA 和 SCL 接反了。',
  'unpowered':'检查模块的 VIN 和 GND。',
  'ground':'模块与开发板需要共地。',
  'controller-off':'开发板需要通电才能通信。',
  'conflict':'检查模块的供电或总线冲突。',
  'bus-short':'SDA 与 SCL 短接。',
  'bus-contention':'检查引脚模式。I²C 使用开漏输出与上拉。',
  'bus-stuck-low':'SDA 或 SCL 被拉低。检查短路与引脚模式。',
  'bus-stuck-high':'SDA 或 SCL 被固定为高电平。检查它是否直接接到了电源。',
  'address-conflict':'同一总线中有两个模块使用这个地址。',
  'unsupported-board':'当前开发板的 I²C 端点尚未接入这个模型。',
  'invalid-control':'检查器件要求的控制字节。',
  'invalid-data':'检查寄存器、命令参数与数据长度。',
  'unsupported-command':'这次写入收到了应答，其中有命令尚未接入仿真。',
  'buffer-overflow':'拆成几次写入。每次最多 32 字节，包含控制字节。',
  'not-initialized':'在 setup() 里先调用 Wire.begin()。',
  'not-transmitting':'在写入前先调用 Wire.beginTransmission() 指定地址。',
  'read-not-supported':'当前器件模型提供写入接口。',
  'unsupported-register':'检查寄存器地址与当前芯片模型支持范围。',
  'read-only-register':'选择可写入的寄存器，温度寄存器供读取。',
  'unsupported-configuration':'芯片已应答，部分配置位的行为尚未接入仿真。',
  'bus-level':'检查上拉和供电，使信号电平符合开发板的输入门限。',
  'short-read':'器件返回的字节不足。检查寄存器宽度和读取长度。',
  'i2c-pin-configuration':'打开 GPIOB 时钟，并把 PB6、PB7 配置为复用开漏输出。',
  'i2c-remap-unsupported':'当前 STM32 I²C1 只接入默认的 PB6/SCL 与 PB7/SDA。',
  'invalid-i2c-clock':'检查 APB1 时钟和 I²C1 的 CCR 分频。',
  'unsupported-i2c-address':'当前 STM32 I²C1 支持 7 位主机地址。',
  'missing-read-byte':'器件未返回有效字节。检查寄存器地址和接线。',
  'target-changed':'传输过程中应答器件变了。接线稳定后重新发起通信。',
  'stale-state':'仿真时间已重置。重新运行后再查看本次通信。'
};

export const i2cHex=(value,digits=2)=>Number.isInteger(value)?`0x${value.toString(16).toUpperCase().padStart(digits,'0')}`:'—';
export const i2cStatus=packet=>packet?`${statusLabels[packet.status]??'通信失败'} · ${packet.status}`:'等待程序通信';
export const i2cReason=packet=>reasonLabels[packet?.reason]??'';

export function recentI2cPackets(events,part,address,includeUnmatched){
  const packets=[];
  if(part)for(let i=(events?.length??0)-1;i>=0&&packets.length<5;i--){
    const event=events[i];
    if(event.type==='i2c'&&(event.deviceId===part.id||!event.deviceId&&(event.address===address||includeUnmatched)))packets.unshift(event);
  }
  return packets;
}

export function mountI2cTrace(panel,{showBytes=false}={}){
  const body=panel.querySelector('tbody'),empty=panel.querySelector('[data-i2c-empty]');
  let previousPackets;
  return packets=>{
    const visible=packets.slice(-5).reverse();
    const key=visible.map(({timeMs,address,status,direction,stop,repeatedStart,bytes})=>[timeMs,address,status,direction,stop,repeatedStart,bytes?.join(',')].join('/')).join(';');
    if(key===previousPackets)return;
    previousPackets=key;
    const rows=visible.map(packet=>{
      const row=document.createElement('tr'),bytes=packet.bytes??[],read=packet.direction==='read';
      const type=read?'读取':showBytes?'写入':bytes[0]===0x00?'命令':bytes[0]===0x40?'像素':'写入';
      const payload=showBytes?bytes.slice(0,4).map(value=>i2cHex(value).slice(2)).join(' ') +(bytes.length>4?' …':''):String(bytes.length);
      row.dataset.status=String(packet.status);
      row.dataset.direction=read?'read':'write';
      row.insertCell().textContent=Number(packet.timeMs).toFixed(2);
      row.insertCell().textContent=i2cHex(packet.address);
      const contents=row.insertCell();
      contents.textContent=payload?`${type} · ${payload}`:type;
      if(showBytes){
        const sequence=document.createElement('small');
        sequence.textContent=[packet.repeatedStart?'重复 START':'START',packet.stop===false?'保持总线':'STOP'].join(' → ');
        contents.append(sequence);
      }
      row.insertCell().textContent=i2cStatus(packet);
      return row;
    });
    body.replaceChildren(...rows);
    empty.hidden=visible.length>0;
  };
}
