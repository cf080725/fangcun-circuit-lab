# 方寸回路 · 3D 电路实验台

在浏览器里摆放三维开发板和元件，接线并运行代码，再观察引脚电压、灯光、波形和元件动作。小白版和专业版共享代码、元件、接线和草稿。三维资源包含 Blender 生成的模型，支持的板卡可以载入原生固件。

当前版本 **10.43.0**。

## 本地启动

解压或克隆仓库，在仓库根目录运行以下命令。需要 Python 3 和现代浏览器。网页资源已放在 `dist/`，可直接用静态服务器启动。

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Windows 如果使用 Python 启动器，把 `python` 换成 `py -3`。在浏览器打开 [实验台](http://127.0.0.1:8000/#lab)。支持 WebGL 2 的浏览器可用 3D 视图，也可以切换到二维接线图。

第一次体验可以选择 Blue Pill，打开「原生固件 → 光敏夜灯」。编译并运行后，点感光面遮挡光线，再改 `light_policy.h` 的阈值。保持同一照度和接线，重新编译即可比较 ADC 读数和 LED 电流。

运行自动化测试需要 Node.js 22 或更新版本。请在仓库根目录运行下列命令。

```sh
npm test
```

浏览器加载 `dist/models/` 中的 GLB。要重新生成模型，请用 Blender 4.5 LTS，命令和所需参考文件列在 [各生成脚本](tools/blender) 的开头。第三方软件、照片与模型的来源和许可见 [第三方声明](THIRD_PARTY_NOTICES.md)。

历史发布验收记录 [v10.38 十轮验收](research/github-release-review.md) · [三维实验台十轮记录](research/ten-round-3d-review.md) · [V3 审查](research/ten-round-review.md)

## 树莓派模型与导线选择

- Raspberry Pi 4 Model B、Pi 5、Zero 2 W（带排针版）有独立的 Blender 模型和 40 针 J8 排针。支持 GPIO 点灯与按键教学实验，使用 BCM 引脚编号。Linux 启动及板载外设需要实物验证。 [引脚说明](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#40-pin-gpio-header) · [建模脚本](tools/blender/raspberry_pi_sbc.py)
- 点击杜邦线附近即可选线。元件与导线重叠时，可以在重叠处右键选择，或从「元件 / 导线」列表按名称和导线端点定位。
- 资料库通过来源链接打开厂商手册和课程。

## 拖动转向与镜头

- 在「选择」或「移动」模式按住开发板或桌面元件，拖动时按 `R` 转 90°，按 `Shift+R` 反向。保持按住鼠标可继续拖动和旋转。松手应用，`Esc` 取消。移动和转向可一次撤销。
- 旋转已插装的开发板会预览抬起后的角度。两排针能对准时可换位，有接线变化会先预览。针脚横过孔排时，可移到空桌面放下，手动跳线继续跟随。松手时未对准且下方有挡件，开发板回到原位。
- 「看开发板」把镜头对准板子。「平移镜头」拖动镜头位置，「环绕视角」在 3D 里改变观察角度。两种镜头模式都可以直接在板子上方拖。按 `Esc` 或再点一次当前镜头模式可回到编辑，「总览」恢复全景。
- 桌面右键拖动可随时平移，滚轮缩放。3D 下也可拖动空白处环绕。触屏用单指在当前镜头模式下拖动，双指缩放或平移。

## 原生 PWM · 对照一个周期

- 运行固件，在「引脚与波形」点「PWM 周期对照」，或在「固件前后对照」展开「对照一个 PWM 周期」。记录基线，重新编译或导入固件，再冻结当前读数。两组曲线各从定时器的周期起点开始，共用同一毫秒刻度。短周期结束后留白，移动游标可以同刻度读取电压和电流。
- Blue Pill 插位与三根线保持一致，导入两份 Cortex-M3 BIN。PA0 从 1 kHz、25% 变为 2 kHz、75%，周期从 1 ms 缩短到 0.5 ms。在游标 0.3 ms 处，基线是 0 V、0 mA，第二版是 3.13 V、约 3.618 mA。Pico 也通过两份 UF2 验证了同为 1 kHz 时 25% 与 75% 的差别。 [Blue Pill 对照](research/qa/v10.38-native-pwm-bluepill.jpg) · [Pico 对照](research/qa/v10.38-native-pwm-pico.jpg)
- 周期来自原生定时器。高、低电压和电流来自按两种输出电平分别求解电路的稳态读数，曲线省略开关瞬态。关联 LED 需要单个支持的推挽 PWM 源。无法可靠求解的接法会提示测量不可用。

## PDV-P8103 光敏夜灯 · 照度、ADC 和阈值

- 在 Blue Pill 选「原生固件 → 光敏夜灯」。PDV-P8103 和 22 kΩ 电阻在 3.3 V 下分压，PA1 接中点，PA0 经 330 Ω 驱动外接灯。点感光面或按「盖上遮光片」降低受光，也可在面板选 2、20、200 lx。暂停时可操作遮光片，阻值从下一次虚拟时间推进开始变化。 [3D 感光面](research/qa/v10.37-photoresistor-face.jpg) · [遮光后](research/qa/v10.37-photoresistor-covered.jpg)
- 默认未遮挡的 20 lx 下，ADC1 读数为 2484。遮光并运行至稳定后降到约 173，灯亮。移开后恢复 2484，灯灭。保持同一照度与十根线，把 `light_policy.h` 的 `DARK_ADC_THRESHOLD` 从 2000 改成 2800 再编译，读数保持 2484，灯的仿真电流从 0 变为 3.618 mA。 [原生 C](dist/firmware/bluepill/native-photoresistor/main.c) · [阈值结果](research/qa/v10.37-photoresistor-threshold.jpg)
- Blender 根据原厂尺寸重建 5.10 × 4.30 × 2.00 mm 陶瓷体和 3.40 mm 脚距。工作台使用折弯引线留出可接线端点。阻值曲线取 10 lx 时 24 kΩ、暗处 0.5 MΩ 和指数 0.75 的教学参数。60/25 ms 用作电导的一阶 10–90% 变化时间近似，光谱和个体差异未纳入。 [原厂数据表](https://www.advancedphotonix.com/media/pages/our-products/light-dependent-resistor-ldr/pdv-p8103/e28dce9e68-1718287431/ds-pdv-p8103.pdf) · [Blender 渲染](research/qa/pdv-p8103-blender.png)

## 四位拨码开关 · 触点、GPIO 和代码

- 在 Blue Pill 选「原生固件 → 四位拨码开关」。A6D-4100 的八脚横跨 E/F 排第 27–30 列。点任一 3D 滑块，或用观察区的四个按钮逐位拨动。1–4 号开关分别接 PA4、PA3、PA2、PA1，闭合时输入接地，代码把低电平记作 1。松手后保持拨位，可撤销。
- 保持 2、4 号在 ON，编译并运行。四路输入为 3.30、0.00、3.30、0.00 V，掩码为 10。把 `dip_switch_policy.h` 的 `MATCH_MASK` 从 5 改成 10，重新编译，PA0 外接灯由 0 变为约 3.618 mA。再关闭 2 号，掩码变成 8，灯熄灭。桌面 3D、二维和触屏通过了这个流程。 [C 源码](dist/firmware/bluepill/native-dip-switch/main.c) · [跨槽拨动](research/qa/v10.36-dip-switch-seated.jpg) · [触屏](research/qa/v10.36-dip-switch-mobile.jpg)
- Blender 依据数据表重建了外壳、四条凹槽、八只冲压脚和可独立运动的拨杆。脚距 2.54 × 7.62 mm，画面中的行程为 1.4 mm 的近似值。仿真使用 0.1 Ω 稳态闭合电阻，省略触点弹跳、漏电和磨损。3.3 V 是本实验的模型供电，实物最低负载条件以数据表为准。 [原厂数据表](https://omronfs.omron.com/en_US/ecb/products/pdf/en-a6d_a6dr.pdf) · [Blender 渲染](research/qa/dip-switch-a6d-blender.png)

## 自己的固件也能对照硬件读数

- 在支持原生固件的板上载入固件并运行，点「固件前后对照」。选一个引脚和可选 LED，记录基线。用原接线重新编译或导入固件，右列显示实时读数，可随时冻结。也可从对照区定位到实验台上的引脚或灯。
- 自建 Blue Pill C 工程保持跨槽插位和三根线，只改 PA0 输出指令。实际运行编译后的 Cortex-M3 固件，测得 PA0 由 0 V 变为约 3.13 V，外接 LED 电流由 0 变为约 3.618 mA。 [Blue Pill 对照](research/qa/v10.35-native-observation-bluepill.jpg)
- Pico 保持相同接线和表笔，依次导入两份编译后的 UF2。GP15 保持 1 kHz，占空比从 25% 变为 75%，LED 周期平均电流从 0.904 mA 变为 2.713 mA。AVR 测试用原生 UNO HEX 核对了板载 LED 的实际支路读数。 [Pico 对照](research/qa/v10.35-native-observation-pico.jpg)
- 快照留在当前工作会话。接线、相关输入或测点改变后需要重新记录基线。固件标记比较已载入的 HEX 或 UF2 文件内容。电压是表中时间点的瞬时值，LED 电流在求解器能计算周期平均时显示周期平均值。

## 在画布上换开发板孔位

- 点「选开发板」和「换孔位 · 点孔」。画布切到俯视并标出蓝色起始孔，连板身遮住的孔也能点。点孔后，两排针的落点会高亮。也可在画布里用方向键和 Enter 选孔，或点「按行列选孔」输入精确位置。Esc 取消。 [桌面](research/qa/v10.34-board-hole-picker.jpg) · [触屏](research/qa/v10.34-board-hole-mobile.jpg)
- 确认前保持原插位的连接。被挡住的孔位会给出原因。如果换位会改变孔组信号，先列出变化再确认。撤销一次即可恢复孔位及相关接线。Blue Pill 浏览器验收将 C/G 排起始列从 6 换到 9，检查了 PA0 改接 PA3 以及接地孔组改接 PB8 的提示。 [接线变化](research/qa/v10.34-board-hole-review.jpg)
- 选中开发板或元件并聚焦画布后，R 旋转 90°，Shift+R 反向。开发板已经插装时，90° 会打开拔板确认。点孔功能只对具有适配排针布局的板型显示。
- 点目标和预览的流程参考了 FreeCAD Draft Move，快捷键布局参考了 KiCad。换位时沿用实验台自己的针脚映射、挡件检查与电气确认。 [FreeCAD Move](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/Draft/draftguitools/gui_move.py#L76-L181) · [KiCad 操作定义](https://github.com/KiCad/kicad-source-mirror/blob/master/pcbnew/tools/pcb_actions.cpp#L1031-L1050)

## Grove 继电器 V1.2 · 脉宽、机械触点与独立负载

- 在 Blue Pill 选「原生固件 → 继电器与短脉冲」。PA0 通过面包板接 SIG，模块控制侧由板上的 5 V 和 GND 供电。黄灯、330 Ω 电阻和一组独立 3.3 V 电源通过 COM/NO 串联。Grove 插头的 NC 是空脚。 [Seeed 原厂接线与板图](https://wiki.seeedstudio.com/Grove-Relay/) · [原生 C 源码](dist/firmware/bluepill/native-relay/main.c)
- 编译运行后，把 `relay_policy.h` 中的 `PULSE_MS` 从 2 改为 220 再编译。真实 Cortex-M3 程序通过 TIM2 输出 500 ms 周期。两种脉宽使用同样的七根线。2 ms 时控制侧有脉冲、触点保持断开，外接灯为 0 mA。220 ms 时触点吸合、外接灯电流约 3.82 mA，之后释放。观察区对照 PA0、触点和黄灯。 [短脉冲](research/qa/v10.33-grove-relay-short.jpg) · [长脉冲](research/qa/v10.33-grove-relay-long.jpg)
- Blender 重建了原厂 40 × 20 mm PCB、安装孔、继电器黑色外壳、Grove 插座、指示灯和双螺丝端子。3D 和俯视图可分别点选六个端子。红灯显示驱动状态，旁边的图标表示机械触点状态。 [原厂 PCB](https://files.seeedstudio.com/wiki/Grove-Relay/res/Grove%20-%20Relay%20PCB.pdf) · [Blender 源码](tools/blender/relay_grove_v12.py) · [模型渲染](research/qa/grove-relay-v12-blender.png)
- 用规格表上限作为固定教学值，吸合 10 ms，释放 5 ms，闭合触点 0.05 Ω。低压直流模型省略触点弹跳、线圈瞬态和电弧。页面使用仿真采样绘制触点和灯，具体实物时序取决于供电、个体和保护电路。 [HLS8-T73 规格书](https://files.seeedstudio.com/wiki/Grove-Relay/res/Relay_Datasheet.pdf)

## HS-55 舵机 · 原生 C、供电电流与舵臂转动

- 在 Blue Pill 选「原生固件 → 旋钮控制 HS-55 舵机」。跨槽插好的 Blue Pill 用 PA4 读取 3362 旋钮，PA0 从 TIM2 CH1 输出 50 Hz PWM。HS-55 用独立 5 V 电源，两边共地。拖动旋钮也能改变 ADC 与舵臂，25%、50%、75% 按钮可固定输入。小屏触点略偏时，旋钮附近的可见外壳也能抓住旋钮。 [原生 C 源码](dist/firmware/bluepill/native-servo/main.c)
- 旋钮保持 75%，把 `servo_policy.h` 的 `SERVO_REVERSED` 从 0 改为 1 再编译。Chrome 实测八根接线和 ADC 3071（约 2.475 V）保持一致，PA0 脉宽由 1800 µs 变为 1200 µs。目标角从 +30° 跳到 −30°，实际舵臂保留起点后逐渐转到 −30°。对照图按新固件启动后的虚拟时间记录 400 ms。 [改动前](research/qa/v10.32-hs55-native-before.jpg) · [改动后及曲线](research/qa/v10.32-hs55-native-after.jpg)
- 理想 5 V 电源下，支路在转动时约 155 mA，停稳后约 5.2 mA。用原厂静止和空载数据拟合供电支路，端电压低于 4.8 V 时轴臂保持，仍可看到供电受限的耗流。模型采用空载速度和帧平均电流，轴负载、启动尖峰和堵转电流需另测。 [Hitec HS-55 规格书](https://www.hiteccs.com/public/uploads/data_sheet/HCS_HS-55_Specsheetv2.2_1026-1729887855.pdf)

## Kingbright 四脚 RGB 灯 · 从 C 到 PWM 与混色

- 在 Blue Pill 选「原生固件 → RGB 三色灯与 PWM」，先编译并运行。Blue Pill 已跨面包板中槽插入。PA0、PA1、PA2 分别经 470 Ω、470 Ω、220 Ω 到 R、G、B，公共阴极经面包板接地。点任意通道可在波形区观察该引脚。 [C 源码](dist/firmware/bluepill/native-rgbled/main.c)
- 在 `rgb_levels.h` 把 `BLUE_PWM_PERMILLE` 从 0 改为 850，再编译。Chrome 实测在同一组 8 根接线上，TIM2 CH3 的占空比从 0% 变为 85%，蓝路平均电流从 0 变为 1.988 mA。红路保持 50% 和 1.468 mA。灯罩由红色混成紫色，关电源后熄灭。触屏也能完成编译和对照。 [初始红光](research/qa/v10.31-rgbled-native-before.jpg) · [改代码后的混色](research/qa/v10.31-rgbled-native-after.jpg)
- Blender 模型使用原厂 5 mm 磨砂灯罩、红脚侧平边和 1.27 mm 针距。引脚按 R、COM、B、G 排列，露出长度按装配演示缩短。3D 可点实际金属脚，俯视时也能用分开的脚位标记。二维接线图将四个接点展开，便于点选。 [Kingbright 数据手册](https://www.kingbrightusa.com/images/catalog/SPEC/WP154A4SUREQBFZGW.pdf) · [Blender 生成脚本](tools/blender/rgbled_kingbright.py) · [模型渲染](research/qa/rgbled-kingbright-blender.png)
- 支路电流取 25 °C 典型低电流曲线附近的近似。三个同步 PWM 用各电平阶段的电路读数计算周期均值。异步定时器、复杂动态负载或冲突可能只有瞬时读数。灯罩颜色用归一化电流显示，实物亮度、色度和不同批次的低电压表现以测量为准。 [STM32 定时器参考手册](https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

## 开发板选中、换孔与旋转

- 点板身或「选开发板」会突出当前板卡，状态栏显示板型及起始孔。拖板身可以换位，3D 斜视时拖排针也会按原针脚位置对孔。触屏和缩小后的二维图按可见孔距调整拖动门槛。拖动时显示目标排和列。 [拖动预览](research/qa/v10.30-board-drop.jpg)
- 「换孔位」直接展开起始列按钮，也可选排孔组合。目标有可腾开的挡件时，换孔对话框保留目标并列出可能受影响的跳线。用户可以预览、确认或取消。撤销恢复原插位及接线。 [腾位预览](research/qa/v10.30-board-clearance.jpg)
- 选板后画布获得焦点，按 `R` 转 90°，按 `Shift+R` 反向。快捷键在实验台画布内生效，浏览器组合键与代码输入由各自区域处理。两排针插入时，转 90° 需要确认拔板，或选择原地翻转 180°。
- 借鉴了连接端点随拖动对齐、松手前预览目标，以及选中后操作的设计，并用本项目的排针和电气模型实现。 [Fritzing](https://github.com/fritzing/fritzing-app/blob/develop/src/sketch/sketchwidget.cpp#L3306-L3385) · [breadboard.ing](https://github.com/tannewt/breadboard.ing/blob/4c05eaacff0f3e05f44c7d5f036f42cd40fa58c4/index.html#L2120-L2254) · [ohmlet](https://github.com/JENW1N/ohmlet/blob/02a5a72183d1630ff3d52a122414f44feb47fcce/src/three/scene.ts#L3028-L3105)

## SparkFun 双轴摇杆 · ADC 与 PWM 死区

- 在 Blue Pill 选「原生固件 → 双轴摇杆与死区」。板卡已经跨面包板中槽插入，摇杆和两盏灯通过外露孔接线。拖摇杆帽可同时推动两轴，松手回中。拖底板可移动元件，五个端子可点选接线。需要保持输入时，用「右推 60%」等按钮固定偏移。 [原厂接线指南](https://learn.sparkfun.com/tutorials/thumb-joystick-hookup-guide/arduino-examples-breakout)
- 摇杆通过两只 10 kΩ 电位器分压。ADC1 每次转换一个通道，分别读 PA4 和 PA5。TIM2 用 PA0、PA1 的 1 kHz PWM 驱动绿灯和黄灯。轴开关接 PB1，按下让两路输出归零。 [实验源码](dist/firmware/bluepill/native-joystick/main.c)
- Chrome 实测右推 60% 时水平电压 0.66 V，ADC 819，绿灯占空比 54.4%，周期平均电流 1.55 mA。保持同一位置，将 `joystick_policy.h` 的 `DEAD_ZONE` 从 250 改为 1400 并重新编译。ADC 仍为 819，PWM 和绿灯电流都降到 0。上推 60% 单独驱动黄灯，平均电流 1.82 mA。 [修改前](research/qa/v10.29-joystick-deadzone-before.jpg) · [修改后](research/qa/v10.29-joystick-deadzone-after.jpg)
- Blender 模型根据 SparkFun BOB-09110 原厂板图和厂商摇杆尺寸图重建。板体为 25.4 × 31.75 mm，摇杆最大倾角 23°。帽形和按下行程近似。电气模型采用理想中心和近电源轨端点。 [原厂板图](https://github.com/sparkfun/Thumb_Joystick_Breakout) · [尺寸图](https://community.sparkfun.com/uploads/short-url/cOGToMVEWek42LIQcFH3zxYFB06.pdf) · [Blender 源码](tools/blender/joystick_sparkfun.py)

## PEC11R 机械编码器 · 旋钮与原生 C

- 在 Blue Pill 点「原生固件 → 旋钮与 A/B 相」，编译并运行。横拖 3D 金属轴，或使用顺时针、逆时针按钮。拖外壳可移动器件。独立的轴开关接 PB10，按下可让 C 程序归零。A、B 分别接 PB0、PB1 的上拉输入，公共端 C 接地。PA0 经 330 Ω 驱动外接 LED。 [实验源码](dist/firmware/bluepill/native-encoder/main.c)
- Chrome 实测顺时针三格时 A/B 顺序为 `11 → 01 → 00 → 10 → 11`，固件经 USART1 报告 `3`，外接 LED 电流为 3.62 mA。把 `encoder_policy.h` 的 `CW_SIGN` 改成 `-1` 并重编译，保持原接线与同样的顺时针动作，固件报告 `-3`，电流降到 0 mA。 [原始方向](research/qa/v10.28-encoder-native-positive.jpg) · [反向规则](research/qa/v10.28-encoder-native-inverted.jpg)
- Bourns PEC11R-4220F-S0024 使用 Blender 建模。D 形金属轴与 M7 螺纹套分开，轴能转动和下沉，五个接线端子固定。24 格对应每格 15°。仿真用理想触点、每个边沿间隔 12 ms，以及两相均开路的静止位置。 [Bourns 数据手册](https://www.bourns.com/data/global/pdfs/PEC11R.pdf) · [Blender 源码](tools/blender/encoder_pec11r.py)

## NUCLEO-F103RB · Blender 板卡与代码实验

- NUCLEO-F103RB 使用单独的 Blender 模型。70 × 82.5 mm 板体有实际厚度、安装孔、ST-LINK 分割槽、Mini-B 接口开口和可按压的 B1 / B2。两组 Morpho 的 76 个公针和 Arduino 母座的 32 个孔位分别按实物类型制作，可点击测量或接线。此板通过跳线连接 400 孔面包板。板体尺寸和针距来自 ST 手册，次要部件位置根据板图和实物照片重建。 [ST MB1136 手册](https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf) · [板卡原理图](https://www.st.com/resource/en/schematic_pack/mb1136-default-c05_schematic.pdf) · [建模源文件](tools/blender/nucleo_f103rb.py)
- 「实物对照」新增 NUCLEO-F103RB。左侧是校准的 Blender 俯视渲染，附 ST 官方实物照片入口。左右同步定位 108 个连接器位置及 B1、B2、LD2。可点击 U5 看 10 × 10 mm 的 LQFP64 封装、64 根引脚和内部功能示意。 [STM32F103RB 数据手册](https://www.st.com/resource/en/datasheet/stm32f103rb.pdf)
- 从对照页点「试做 B1 控制 LD2」可直接打开多文件 C 草稿。在 Chrome 实测，把 `led_policy.h` 中的 `LIGHT_WHEN_PRESSED` 从 `1` 改为 `0` 并重新编译，LD2 从按下亮变为松开亮。B1 松开时 PC13 约 3.30 V，按下为 0 V。LD2 亮时 PA5 约 3.19 V。直接点模型上的 B2 可复位 Cortex-M3 并重启当前固件。 [3D 原生固件实测](research/qa/v10.27-nucleo-native-b1.jpg) · [引脚联动实测](research/qa/v10.27-nucleo-inspection.jpg) · [封装引脚实测](research/qa/v10.27-nucleo-lqfp64.jpg)

## 开发板换孔与快捷键

- 先点「选开发板」，再拖板身。斜视时，沿着孔排拖动会保持原来的两排；横跨两排的拖动仍可选相邻排孔。抓住排针时，斜视下按排针随板移动的距离计算目标，俯视时可直接把排针对准具体孔。
- 「换孔位」同时标出原位和目标。手机上可直接点 44 像素高的起始列按钮。移动前会预览两排针；目标被占用时保留原位，接线改变时先列出变化。确认后可撤销。直插仍取决于板型和排针间距。
- 选中开发板后，画布内按 `R` 转 90°，`Shift+R` 反向。已插入时可确认拔下并旋转，或在孔内翻转 180°。编辑器输入、组合键和长按重复独立处理。
- 浏览器覆盖了 Blue Pill 和 Pico 的斜视换孔、Blue Pill 的俯视与二维对孔、触屏选列、接线确认与撤销。交互参考了公开项目的操作方式，在现有实验台内实现。 [Blue Pill 斜视实测](research/qa/v10.26-blue-pill-reseat.jpg) · [手机换孔实测](research/qa/v10.26-touch-board-slot.png) · [Breadboard 3D](https://github.com/RephilStudios/Breadboard-3D) · [Wokwi 图编辑器](https://docs.wokwi.com/guides/diagram-editor) · [Fritzing 面包板文档](https://github.com/fritzing/fritzing-docs/blob/master/01_quickstart/03_breadboardview.md)

## 独立 STM32 多文件 C 工程

- 在 Blue Pill 或 NUCLEO-F103RB 点「原生固件 → 新建本地 C 工程」。新工程复制当前电路，带一份可编译的 `main.c`。可切换、添加、导入和移除 `.c`、`.h`，再编译当前工程。Clang 分别编译各 C 文件，链接对应板卡的 Flash 配置，生成可保存、下载的 HEX。错误诊断可直接打开相关文件并定位行列。
- 在 NUCLEO-F103RB 选择「B1 控制 LD2 · 多文件 C」。浏览器实测 B1 松开时 PC13 为 3.30 V，按下为 0 V。`led_policy.h` 中 `LIGHT_WHEN_PRESSED` 从 `1` 改为 `0` 后，同一按键操作下 LD2 从按下亮变为松开亮。亮时 PA5 测得 3.19 V。改为 `2` 时，诊断从 `main.c` 直接跳到 `led_policy.h` 第 10 行，已载入的固件继续运行。 [浏览器实测](research/qa/v10.25-nucleo-native-multifile.jpg) · [NUCLEO-64 用户手册](https://www.st.com/resource/en/user_manual/um1724-stm32-nucleo64-boards-mb1136-stmicroelectronics.pdf)
- Blue Pill 独立工程的浏览器验收覆盖添加 `logic.c` 和 `logic.h`、保存与重新导入 JSON、恢复当前头文件和已编译 HEX。重新编译修改后的头文件可熄灭原来的外接灯。原工程与新工程可在实验菜单切换。
- 当前支持裸机 C11、Clang 内建头文件和固定启动文件。每个工程最多 24 个 C/H 文件，单文件上限 128 KiB，合计 512 KiB。Blue Pill 使用 64 KiB Flash，NUCLEO-F103RB 使用 128 KiB Flash。嵌套目录用工程内路径包含头文件，例如 `#include "include/policy.h"`。`../` 的解析受编译器虚拟文件系统限制。 [工具链与授权](dist/vendor/bluepill-clang/README.md) · [STM32F103 数据手册](https://www.st.com/resource/en/datasheet/stm32f103rb.pdf)

## 在浏览器编译 Blue Pill 的 C 草稿

- 在 Blue Pill 的「I²C 温度报警」或「温度显示」点「编辑原生 C」。可定位 `ALARM_C` 或 `DISPLAY_FAHRENHEIT`，再点「编译并运行」，也可在编辑框按 `Ctrl / ⌘ + Enter`。Clang 将完整草稿编译为 Cortex-M3 Thumb 指令，链接实验台的启动文件，并验证 Flash 中的复位向量。实际产出的 HEX 与接线一起保存，原始注释源码仍可展开查看。
- 语法诊断带行号，可点回出错位置。编译、固件校验或启动预检失败时，已装载固件仍可运行。浏览器实测故意加入未声明变量后，错误定位在第 1 行，正在运行的 OLED 保持 `34.5 C`。修正代码并将 `DISPLAY_FAHRENHEIT` 改为 `1` 后，同一套接线读到 `C2 28`，新固件让 3D OLED 显示 `94.1 F`。 [浏览器实测](research/qa/v10.24-bluepill-native-draft.jpg)
- 390 像素宽的触屏布局中，取消编译后仍可继续编辑。将 `ALARM_C` 从 30 改到 35，再按 `Ctrl+Enter` 编译，34.5 °C 的读数保持相同，外接灯电流由 3.62 mA 降到 0 mA。刷新浏览器后恢复了温度显示实验的源码、编译后固件和八根跳线。
- 工具链按需从原站加载约 21 MB，在浏览器后台编译。这两个实验也可以使用上方的多文件编译流程。 [工具链来源与授权](dist/vendor/bluepill-clang/README.md)

## Blue Pill 共享 I²C 温度显示

- 选「温度显示 · STM32 共享 I²C」。Blue Pill 预插在面包板 C/G 排。MCP9808 和 SSD1306 从 I/J 排各自引线，共用第 19 列 PB6/SCL、第 20 列 PB7/SDA、第 24 列地和第 25 列 3.3 V。场景使用按原厂板图制作的 Adafruit #5027 和 #326 Blender 模型。 [MCP9808 原厂板图](https://github.com/adafruit/Adafruit-MCP9808-Breakout-PCB) · [SSD1306 原厂板图](https://github.com/adafruit/Adafruit-128x64-Monochrome-OLED-PCB)
- 两份 HEX 从同一份 C 源码编译，使用不同的 `DISPLAY_FAHRENHEIT` 值。同为 34.5 °C 时都从 `0x18` 读回 `C2 28`，串口均报告 `TEMP=34.5000`。两版分别向 `0x3D` 写入 `34.5 C` 和 `94.1 F` 的像素。右侧可比较切换前后真实写入的屏幕画面，左侧的 3D OLED 同步显示当前显存。 [浏览器对比](research/qa/v10.23-shared-i2c-compare.jpg) · [C 源码](dist/firmware/bluepill/temperature-display.c) · [编译说明](dist/firmware/bluepill/README.md)
- 拔下传感器 SDA 后，`0x18` 地址未应答，OLED 继续收数据并显示 `ERR`。拔下 OLED SDA 后，`0x3D` 地址未应答，屏幕仍通电并保留已有像素；传感器继续读取，浏览器实测改到 25.25 °C 后仍输出 `TEMP=25.2500`。接回支线后恢复读写。逻辑分析的时间轴按 STM32 I²C1 事务估算。 [断线捕获](research/qa/v10.23-shared-i2c-sensor-nack.jpg)

## Blue Pill 原生 I²C 温度报警

- 选 Blue Pill 的「I²C 温度报警 · STM32 原生固件」。MCP9808 用 3.3 V 供电并共地，PB7 接 SDA，PB6 接 SCL。PA0 经 330 Ω 电阻控制外接灯。传感器沿用依据 Adafruit #5027 原厂板图制作的 Blender 模型。 [原厂板图](https://github.com/adafruit/Adafruit-MCP9808-Breakout-PCB) · [Blender 渲染](research/qa/mcp9808-5027-blender.png)
- 把环境设为 34.5 °C，依次运行两份由同一 C 文件编译的 HEX。两版均写入寄存器指针 `05`，发重复 START 读回 `C2 28`，USART1 输出 `TEMP=34.5000`。30 °C 固件让外接灯流过 3.62 mA，38 °C 固件的灯电流为 0.00 mA。页面可展开初始注释代码，也可下载后修改阈值、重新编译，再导入 HEX。 [C 源码](dist/firmware/bluepill/temperature.c) · [编译说明](dist/firmware/bluepill/README.md) · [浏览器对比](research/qa/v10.22-stm32-temperature-compare.jpg)
- 换回 30 °C 固件，在逻辑分析里选「捕获下一次失败」，再拔掉 SDA。浏览器实测地址字节 `0x30` 未获应答，串口输出 `I2C=0x04`，总线读数清空，外接灯关闭。撤销恢复 SDA，设为 −8.5 °C 后复位运行，读取 `3F 78` 和 `TEMP=-8.5000`。 [断线捕获](research/qa/v10.22-stm32-temperature-nack.jpg)
- STM32F103 的 I²C1 模型支持 Blue Pill 和 NUCLEO-F103RB 的默认 PB6/PB7、3.3 V、7 位主机轮询。逻辑图按固件事务和 SCL 配置估算边沿。当前覆盖地址应答、重复起始和主机收发，逐位采样、引脚重映射、从机、中断、DMA 和时钟拉伸在当前范围之外。 [STM32F103 数据手册](https://www.st.com/resource/en/datasheet/stm32f103c8.pdf) · [ST I²C 应用笔记](https://www.st.com/resource/en/application_note/an2824-stm32f10xxx-ic-optimized-examples-stmicroelectronics.pdf)

## 开发板选中、换孔和旋转

- 点板身或「选开发板」，再拖板身看两排孔的预览。斜视时板身后方的排针点击区会让位给可见表面。抓住外露排针拖动时，可以对准具体目标孔。开发板的插位以面包板为基准，靠近工作区边缘也可使用合法的起始列。
- 选中已插入的开发板后，工具栏用 ← 和 → 逐列移动，点「换孔位」可直接选择起始孔、排孔和朝向。触屏上的逐列按钮宽、高均为 44 像素。选到会改变接线的孔位时先预览，确认后才应用。撤销会恢复原插位和接线。
- 在「选择」或「移动」模式下，画布聚焦且已选中开发板时按 `R` 顺时针转 90°，`Shift+R` 反向。输入法、编辑器和带 Ctrl、Alt、系统键的组合保留原有行为。板子已插入时，转 90° 前需确认拔出；也可在插孔内翻转 180°。
- 3D 选择与拖动参考 Three.js 的射线取目标和抓取偏移，换孔保留应用前检查及单次撤销。 [Three.js DragControls](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/DragControls.js) · [Fritzing 命令与撤销](https://github.com/fritzing/fritzing-app/wiki/2.-Developer-Guide) · [breadboard.ing 网格](https://github.com/tannewt/breadboard.ing#usage)
- 浏览器实测 Blue Pill 从第 6 列拖到第 9 列并撤销，也验证了孔位图预览、确认和工具栏逐列移动。390 像素宽的触屏布局下，用右箭头从第 6 列换到第 7 列。 [孔位预览实测](research/qa/v10.21-board-hole-picker.jpg)

## I²C 逻辑分析

- 在温度或 OLED 实验点「看逻辑波形」。分析仪跟随最新完成的事务，标出 START、重复 START、STOP、地址方向、数据位和第九个应答位。点选字节、切换事务或横向浏览波形会冻结当前记录，程序继续运行。长事务可按字节组翻页，保留最近 32 笔捕获记录。 [I²C 总线规范](https://www.nxp.com/docs/en/user-guide/UM10204.pdf)
- UNO R3 原生固件从地址 `0x18` 读 34.5 °C 时，线上地址字节是 `0x31`，数据为 `C2 28`。主机对 `C2` 发 ACK，对最后的 `28` 发 NACK，随后 STOP，事务正常结束。点「捕获下一次失败」再拔掉 SDA，分析仪自动冻结在写地址 `0x30` 未应答的事务，图上没有后续数据字节。 [正常读完](research/qa/v10.20-i2c-analyzer-read.jpg) · [断线捕获](research/qa/v10.20-i2c-analyzer-nack.jpg)
- 原生 AVR 使用每个 TWI 字节的虚拟起止时间重建数字波形，保留字节之间的间隔。源码模式按事务和标称 100 kHz 估算。地址未应答只画地址阶段，无法确认的电平留空。每笔原生事务最多记录 64 个地址或数据时段，超出时注明省略数。波形显示数字电平，省略模拟上升时间和噪声。 [ATmega328P TWI 手册](https://docs.arduino.cc/resources/datasheets/ATmega328P-datasheet.pdf)

## UNO R3 原生固件读温度

- 在「从 I²C 读温度并报警」里设为 34.5 °C，再点「运行 30 °C 固件」。实验台加载为 ATmega328P 编译的 HEX。程序从复位向量执行，经硬件 TWI 寄存器选择 MCP9808 的 `0x05`，用重复 START 读回 `C2 28`，串口输出 `TEMP=34.5000`。 [固件 C 源码](dist/firmware/uno-r3/temperature.c) · [复现编译](dist/firmware/uno-r3/README.md)
- 保持接线和温度，切到「运行 38 °C 固件」。两份 HEX 的串口报告一致，外接灯由 8.01 mA 降到 0 mA，面板保留两次实测结果。拔掉 SDA 后，固件收到地址 NACK，串口报告 `I2C=0x20` 并关灯。撤销接线变更并设为 −8.5 °C，重新运行可读回 `3F 78` 和 `TEMP=-8.5000`。 [浏览器实测](research/qa/v10.19-avr-twi-temperature.jpg)
- AVR 内核支持 ATmega328P、ATmega2560 的 TWI 主机寄存器、轮询、中断与字节级收发。事务经过仿真的供电和 SDA、SCL 接线，时钟按 TWBR 与分频估算。接收同一寄存器的高低字节时保留一次采样值。写入的器件命令在 STOP 或重复 START 时提交。逐位波形、多主仲裁和 AVR 从机模式省略。 [ATmega328P 手册](https://docs.arduino.cc/resources/datasheets/ATmega328P-datasheet.pdf) · [ATmega2560 手册](https://ww1.microchip.com/downloads/en/devicedoc/atmel-2549-8-bit-avr-microcontroller-atmega640-1280-1281-2560-2561_datasheet.pdf)

## 从 I²C 读温度并报警

- 在 Arduino UNO R3 选「从 I²C 读温度并报警」。Adafruit #5027 的 VIN 接 5 V，GND 共地，A4 接 SDA，A5 接 SCL。D12 经 330 Ω 电阻驱动外接报警灯。Blender 模型依据原厂板图，包含实际的孔位、芯片、两侧 JST-SH 插座和供电指示灯。 [Adafruit #5027](https://www.adafruit.com/product/5027) · [原厂板图](https://github.com/adafruit/Adafruit-MCP9808-Breakout-PCB) · [Blender 渲染](research/qa/mcp9808-5027-blender.png) · [生成脚本](tools/blender/mcp9808_5027.py)
- 在实验台改环境设定，等待传感器转换，再看程序读数。设为 34.5 °C 时，程序读到 `C2 28`，初始阈值 30 °C 时报警灯约 8.01 mA。只把 `ALARM_C` 改为 38 并应用，温度与原始字节保持相同，灯降至 0 mA。设为 −8.5 °C 时读到 `3F 78`。拔掉 SDA 后，程序标记读数无效并关闭报警灯。 [3D、源码和读写记录](research/qa/v10.18-i2c-temperature.jpg)
- 「温度与 I²C」显示写入寄存器地址 `0x05`、保持总线、重复 START 和读回字节。MCP9808 按虚拟时间完成转换，四档分辨率对应约 30、65、130、250 ms。UNO R3、经典 Nano、Mega 2560 的 Arduino 源码可用 `Wire.requestFrom()`、`available()`、`read()` 和 `peek()`。源码模式传输按标称 100 kHz 估算，总线输入门限沿用实验台的板卡近似。当前省略逐位波形、封装热滞后和 Alert 引脚。 [Microchip 数据手册](https://ww1.microchip.com/downloads/en/DeviceDoc/MCP9808-0.5C-Maximum-Accuracy-Digital-Temperature-Sensor-Data-Sheet-DS20005095B.pdf) · [Arduino AVR Wire](https://github.com/arduino/ArduinoCore-avr/blob/master/libraries/Wire/src/Wire.cpp)

## 用 I²C 写入 OLED 像素

- 在 Arduino UNO R3 选「用 I²C 写入 OLED 像素」。A4 接 SDA，A5 接 SCL，VIN 接 5 V，GND 共地。Adafruit #326 的 3D 模型按原厂板图绘制，带真实开孔、玻璃层、排针和背面插座。仿真接线使用 VIN、GND、SDA、SCL。地址焊桥开路时为 `0x3D`，闭合时为 `0x3C`。 [Adafruit #326](https://www.adafruit.com/product/326) · [原厂板图](https://github.com/adafruit/Adafruit-128x64-Monochrome-OLED-PCB) · [Blender 渲染](research/qa/ssd1306-326-blender.png) · [生成脚本](tools/blender/ssd1306_326.py)
- 点击「放大屏幕和记录」查看 128×64 像素和最近五次写入。保持接线，把 `BAR_COLUMNS` 从 40 改到 96。草稿保持 748 个亮像素，应用后变为 1,420 个。把程序地址改为 `0x3C` 或断开 SDA 后返回 2，通电时保留上一帧。给模块断电会清空显示内存。 [浏览器中的 3D 屏幕与未应答诊断](research/qa/v10.17-i2c-oled.jpg)
- UNO R3、经典 Nano 和 Mega 2560 的 Arduino 源码模式支持 `Wire.begin()`、`beginTransmission()`、`write()` 和 `endTransmission()`。写入按实际接线、供电、共地、总线状态和地址判断应答，数据按 SSD1306 寻址更新。源码模式时间按标称 100 kHz 和排队字节数估算。OLED 器件模型覆盖写入、寻址和常用显示命令，省略逐位时序和滚动动画。 [Arduino Wire](https://docs.arduino.cc/language-reference/en/functions/communication/wire/endTransmission/) · [SSD1306 数据手册](https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf)

## HC-SR04 超声波测距与报警

- 选择 Arduino UNO R3 的「超声波测距与距离报警」。探头用 5 V 供电，D7 发触发脉冲，D8 读回波，D12 经 330 Ω 电阻控制外接灯。Blender 模型包含两个有开孔网罩的换能器、PCB 和四根可接线针脚。 [ElecFreaks 规格书](https://www.elecfreaks.com/download/HC-SR04.pdf) · [Blender 渲染](research/qa/hcsr04-blender.png) · [生成脚本](tools/blender/hcsr04.py)
- 拖动「超声波反射目标」中的圆点，或使用距离和偏角滑块。目标位置按每次有效触发锁存。80 cm 正前方的目标给出约 4,665 µs 的回波，45 cm 时约为 2,624 µs。把目标移开或移出波束，代码会在设定的时间后超时并关闭报警灯。
- 保持 80 cm 的目标与接线，应用 `ALARM_CM` 从 60 改成 100。读数仍为 80 cm，外接灯从 0 升至约 8.01 mA。把 `TRIGGER_US` 从 10 改为 5，则无法触发有效回波。回波时序图以触发下降沿为时间原点，虚线标出八周期发射结束。 [浏览器代码与时序对照](research/qa/v10.15-ultrasonic-code-echo.jpg)
- Arduino 源码模式的 `pulseIn` 按实际接线和已建模的信号读取完整高脉冲。教学探头采用单个理想目标、2–400 cm 量程、以 343 m/s 计算的声速和 ±7.5° 波束。目标材质、混响、温度变化和读脉冲期间的接线变化省略。 [Arduino 接口参考](https://docs.arduino.cc/language-reference/en/functions/advanced-io/pulseIn/)

## 直流电机的滑行与电刹车

- 在 Blue Pill 选「20 · 电机滑行与电刹车」。独立 3 V 电源接 Pololu 2130 的 VIN，板卡和驱动共地。PA0、PA1 只控制 AIN1、AIN2。输入 `10` 正转、`01` 反转、`00` 滑行、`11` 电刹车。B 通道同样可以按自己的输入接线。驱动板的十六个排针按原厂位置建模，当前通过跳线接入。 [Pololu 驱动板](https://www.pololu.com/product/2130) · [TI 驱动逻辑与规格](https://www.ti.com/lit/ds/symlink/drv8833.pdf)
- 从初始代码运行，再把 `BRAKE_AT_STOP` 从 0 改为 1 并应用。停转曲线按桥臂切换的时刻对齐。两次停转指令发出时约为 12,021 rpm。100 ms 后，滑行约 10,453 rpm，刹车约 2,506 rpm。刹车开始的绕组电流约 −1.50 A，滑行约为 0 A。图表用相邻采样插值显示 100 ms 时的转速。把 `TURN_REVERSE` 改为 1 可观察带符号的转速和电流。应用代码会保留转轴当时的运动状态，「从静止重放」可从零转速复现。 [浏览器联动与曲线](research/qa/v10.14-motor-stop-comparison.jpg)
- Blender 以 Mabuchi FA-130RA 的金属外壳、端盖和焊片建模，轴上标记随角度转动，高速时用运动模糊呈现。电气参数用 FA-130RA-18100 的 3 V 空载与堵转数据拟合，惯量取演示估计。驱动使用常温典型导通电阻，结果适用于空载、静态桥臂控制的教学比较。模型省略绕组电感、PWM 逐边沿、过流重试、温升和外部机械负载。 [Mabuchi 参数](https://product.mabuchi-motor.com/detail.html?id=10) · [尺寸图](https://www.mabuchi-motor.co.jp/motorize/branch/motor/pdf/fa_130ra.pdf) · [Blender 渲染](research/qa/motor-fa130-blender.png) · [生成脚本](tools/blender/motor_fa130.py)

## 七段数码管的实物封装与 GPIO

- 在 Blue Pill 选「19 · 用八根 GPIO 点亮七段数码管」。PA0–PA7 分别经 330 Ω 电阻接到 a–g 和小数点，实物 8 脚经 C11 同组孔 A11 接地。实物 3、8 脚内部相通。可点各段电流定位实物脚号和插孔，也可在实验台放大模型。
- 保持接线，应用 `DISPLAY_DIGIT` 从 2 改为 7，发光段由 a、b、d、e、g 变为 a、b、c。每个点亮的段约 3.62 mA，总电流从 18.09 mA 降到 10.85 mA。再将 `DECIMAL_POINT` 设为 1，小数点加入，总电流升至 14.47 mA。读数来自电路求解。代码未应用时，数码管保持此前程序的输出。 [浏览器实测](research/qa/v10.13-sevenseg-code-current.jpg)
- Blender 模型依据 Kingbright SC56-11EWA，灰色外壳 12.70 × 19.05 × 8.00 mm，10 根实体针脚以 2.54 mm 为节距，两排间距 15.24 mm。发光透镜独立，插装时可跨沟槽正放或倒转 180°。电气使用各段独立的近似二极管支路，共阳极作为同脚位的可选教学行为。此例单个数码管由 GPIO 静态驱动。 [原厂规格书](https://www.kingbrightusa.com/images/catalog/spec/sc56-11ewa.pdf) · [Blender 渲染](research/qa/sevenseg-sc56-blender.png) · [生成脚本](tools/blender/sevenseg_sc56.py)

## 开发板选择、换孔和旋转

- 在「选择」或「移动」模式下，拖板身会保留抓取位置。拖住已插入的开发板排针时，指向的新孔就是这根排针的目标孔。实验台会标出这根针和两排孔的范围。点「选开发板」也可直接选中板卡，再按方向键逐孔调整，或点「换孔位」在孔位图上选择。拖面包板可移动整组已插入的硬件。 [三维拖针到孔](research/qa/v10.16-pin-hole-preview.jpg) · [手机孔位图](research/qa/v10.16-mobile-board-slot.png)
- 预览时原孔组保持接通。有接线变化时可核对明细后确认。放到越界或被挡住的孔位时，开发板留在原位。完成换孔后可以一次撤销孔位和相关接线变化。直插可用范围由板型的实际排针间距与面包板孔决定。
- 选中开发板、焦点在画布上时，`R` 转 90°，`Shift+R` 反向转。已插入的开发板需确认拔出后才能转 90°，也可选在插孔内翻转 180°。编辑区、输入法以及 Ctrl、⌘、Alt 组合键保留各自的处理。
- 参考 breadboard.ing 的 2.54 mm 网格吸附、KiCad Breadboard 的选择与旋转快捷键。站内将这套交互应用到现有的三维排针与电气孔组。 [breadboard.ing](https://github.com/tannewt/breadboard.ing#usage) · [KiCad Breadboard 快捷键](https://github.com/kerstensrobin/kicad-breadboard#reference)

## PWM 给电容充放电

- 在 Blue Pill 选「18 · 用 RC 平滑 PWM」。点「定位占空比」或「定位频率」修改示例代码，再应用运行。电容保留应用前的电压，并从这一电压继续充放电。电路保持原接线。「PWM 与滤波」显示实时端电压，并可查看放大的稳态单周期曲线。
- 浏览器实测把占空比从 25% 调到 75% 后，稳态均值由 0.825 V 升至 2.475 V。同样是 75% 时，频率从 100 Hz 提到 1 kHz，均值保持 2.475 V，峰峰纹波由 59.09 mV 降至 5.91 mV。相位解析适用于相位已知的推挽 PWM 驱动单电阻、单接地电容的低通电路。电容按理想模型计算，其他拓扑使用已有时间步进近似。 [浏览器单周期图](research/qa/v10.12-pwm-rc-cycle.jpg)
- 电容的三维外形以 Panasonic EEUFR1E101 的 Ø6.3 × 11.2 mm 尺寸为参考。Blender 模型包含顶部防爆槽、负极条纹和底部端子，外壳容量随元件属性更新。 [Panasonic 规格](https://industrial.panasonic.com/ww/products/pt/aluminum-cap-lead/models/EEUFR1E101) · [Blender 渲染](research/qa/capacitor-fr-blender.png) · [生成脚本](tools/blender/capacitor_fr_63.py)

## 源码等待期间观察硬件

- STM32 的 `Delay_ms`、`Delay_us`、`Delay_s` 及 Arduino 的 `delay`、`delayMicroseconds` 在网页运行时按帧推进。等待中的源码停在调用位置，PWM、电压、波形和机械模型继续跟随虚拟时间刷新。等待进度显示已走过的比例和剩余时间。
- 暂停会保留当前硬件读数及剩余时间，继续运行从原处接上。单步进入等待时先停在起点，点「完成等待」可直接查看终点，再点「单步」继续代码。完成等待时，电容电荷和电机转动仍分段计算。应用新草稿会从程序入口建立新的等待，程序复位清空等待。很短的等待按浏览器帧节奏呈现。
- Blue Pill 的 HS-55 示例可以直接写 `Delay_ms(1000)`，舵臂仍然逐步移动。电容实验用 `Delay_ms(3000)` 分别保持充电和放电。浏览器实测首次充电约 1 秒时 PA1 为 2.07 V，PA0 仍保持高电平。 [舵臂中途暂停](research/qa/v10.11-wait-servo-paused.jpg) · [电容充电波形](research/qa/v10.11-wait-rc-voltage.jpg)

## HS-55 舵机的脉宽与位置

- 选 Blue Pill 的「17 · 改脉宽，让 HS-55 舵臂转到新位置」。运行到舵臂停稳，在代码旁点「定位脉宽设置」，把 `COMMAND_US` 从 `1200` 改为 `1800` 并应用。PA0 仍输出 50 Hz，舵机信号与接线独立核对。浏览器观察到目标角由 −30° 变为 +30°，当前角保留旧位置并在 176 ms 的采样帧到位。 [应用前后读数与 3D](research/qa/v10.10-hs55-code-motion.jpg)
- 用 Blender 按原厂尺寸绘制外壳、开孔安装耳、偏心 15 齿轴和独立舵臂。二维接线图保持同一转向和同一组端点。导出项目保留所选舵机型号。通用舵机仍可在属性中选择。 [原厂规格书](https://www.hiteccs.com/public/uploads/data_sheet/HCS_HS-55_Specsheetv2.2_1026-1729887855.pdf) · [Blender 渲染](research/qa/servo-hs55-blender.png) · [模型生成脚本](tools/blender/servo_hs55.py)
- HS-55 空载模型用 900–2100 µs 对应 −60° 到 +60°，1500 µs 为中位。供电要求 4.8–6.0 V，按该电压区间的标称空载速度插值，PWM 频率接受 45–55 Hz。失去信号或供电时保持最后轴角。电源支路区分静止与空载转动，负载力矩和堵转电流需用实物测量。

## Blue Pill 按键弹跳与消抖

- 选择「16 · 看按键弹跳，再用代码消抖」。点「复位并重放按压」，程序从入口启动，按键在虚拟时间内按住 25 ms 后松开。「按压波形」使用同一时间轴对照 PB1 电压、代码确认的电平和外接灯电流。可以展开原始采样值。
- 点「定位消抖设置」，把 `DEBOUNCE_MS` 从 `0` 改为 `10`，应用后重放。保持接线和触点序列相同，浏览器实测程序计数和 LED 切换均从 5 次降至 1 次。输入电压仍然抖动，消抖后程序在按下后 14 ms 接受低电平，灯电流约 3.62 mA。 [浏览器波形与代码](research/qa/v10.9-button-bounce-compare.jpg)
- 四脚按键的 6 × 6 mm 外壳、金属盖和独立键帽在 Blender 中绘制。键帽表现 0.25 mm 下压，弯脚接到既有实验台端点。触点抖动可在元件属性启用，使用参考厂商 5 ms 上限的固定 4 ms 教学序列。旧工程按键默认为理想通断。 [Omron B3F 数据手册](https://components.omron.com/sites/default/files/datasheet_pdf/A070-E1.pdf) · [Blender 生成脚本](tools/blender/tactile_button.py) · [模型渲染](research/qa/tactile-button-blender.png)

## NUCLEO-F103RB 原生固件

- 在商城选 ST NUCLEO-F103RB，点「原生固件」。支持从 `0x08000000` 启动的 STM32F103RBT6 HEX/BIN、128 KiB Flash、20 KiB SRAM、运行、单步和复位。自带点灯、板载按键、PA0 电位器与 USART2、PB4 调光四份编译样例，附 C 源码和复编步骤。 [ST 板卡手册](https://www.st.com/resource/en/user_manual/um1724-.pdf) · [芯片规格](https://www.st.com/en/microcontrollers-microprocessors/stm32f103rb.html) · [样例源码和构建](dist/firmware/nucleo-f103rb/README.md)
- 板载 B1 通过 4.7 kΩ 电阻上拉 PC13，按下接地。可在三维或二维实验台按住蓝色按钮，也可用工作台的「B1 按住」和「B1 松开」操作。PA5 驱动绿色 LD2，按下时点亮。开关采用稳态模型。 [MB1136 C05 原理图](https://www.st.com/resource/en/schematic_pack/mb1136-default-c05_schematic.pdf) · [B1 实测画面](research/qa/v8.9-nucleo-native-button.jpg)
- 浏览器实测 LD2 闪烁、B1 两态、PA0 电位器 10% 和 90% 对应串口读数 409 和 3685，以及 PB4 的 1 kHz PWM 在 25% 和 75% 之间切换。另导入独立 HEX，执行位于 `0x08018000` 的函数后返回低地址，并通过 USART2 回显输入。超出 Blue Pill Flash 的同一文件在 Blue Pill 预检中被拦下。
- 联动支持数字输入输出、ADC1 单通道轮询、TIM2–4 基础 PWM、SysTick 和 USART2／USART1 字节终端。串口选择默认 USART2，对应板上的 ST-LINK 虚拟串口接法。ST-LINK USB 和调试协议需用实物工具验证。
- 391 项自动化测试通过，覆盖四份编译样例、两路串口、Flash 容量边界及 128 KiB BIN 工程备份的 JSON 和 ZIP 恢复。浏览器刷新后可恢复选中的板型和固件。

## Blue Pill 原生 STM32 固件

- 在 Blue Pill 实验台点「原生固件」，可导入以 `0x08000000` 为起始地址的 Cortex-M3 应用 HEX/BIN。预检检查 64 KiB Flash、20 KiB SRAM 中的初始栈指针，以及 Thumb 复位入口。用 BOOT0 = 0 启动用户 Flash。 [STM32F103C8 数据手册](https://www.st.com/resource/en/datasheet/stm32f103c8.pdf) · [RM0008 参考手册](https://www.st.com/resource/en/reference_manual/cd00171190-stm32f101-103-105-107-stm32f100-series-armbased-32bit-mcus-stmicroelectronics.pdf)
- 自带 PC13 板载灯和 PB1 控制 PA0 外接 LED 两个实编译样例。运行、暂停、单指令执行、复位和真实 GPIO 电平与实验台联动。样例使用复位默认的 8 MHz HSI。 [样例源文件、链接脚本和编译说明](dist/firmware/bluepill/README.md)
- 08.5 增加两份编译后的样例。在「原生固件」选择 PA1 电位器，面板会显示最近的 12 位结果和采样电压，USART1 会输出同一数值。浏览器验证旋钮从 10% 到 90% 时读数从 409 变到 3685，PA0 外接灯跨过阈值后点亮。 [ADC 实测画面](research/qa/v8.5-bluepill-native-adc.jpg)
- 选择 PA0 调光时，实际运行的指令配置 TIM2_CH1。浏览器测得 1,000 Hz，25% 与 75% 占空比交替，电路模型按高低电平加权显示亮度。PWM 电路联动范围为 TIM2–4 内部时钟、边沿对齐向上计数、APB1 分频 ÷1 或 ÷2。预装载的生效时刻和波形相位按当前内核近似。ADC1 支持 PA0–PA7、PB0–PB1 的单通道轮询软件转换，参考电压采用标称 3.3 V。 [PWM 实测画面](research/qa/v8.5-bluepill-native-pwm.jpg)
- CPU 和外设模型由本地 WebAssembly 运行。固件执行在独立后台线程中，超时会终止该线程，复位可重新加载固件。显示的 STM32 时钟周期和虚拟时间是指令级估算。 [stm32f1-emu 3.3.0 上游](https://github.com/danish9661/STM32F1-emulator/tree/8203ab1e67b898bbee8c94cf16fe6615a844f5cd) · [MIT 许可证](dist/vendor/stm32f1-emu/LICENSE.txt)
- 固件可随草稿、工程 JSON 或 IDE 包内的实验台备份保存。BIN 在备份中编码为 HEX，面板下载时恢复原始字节。切回源码可继续编辑原工程。
- 浏览器实测 PC13 从 0.11 V 切到 3.30 V、PB1 按键驱动 PA0、USART1 发收回显、启动单步与复位。测试文件导出的 BIN 与导入前逐字节一致。普通指令可单步，遇到需进入异常处理的指令时切到运行。 [Blue Pill 原生运行画面](research/qa/v8.3-bluepill-native-blink.png)

## Raspberry Pi Pico 原生 UF2

- 在商城选经典 Raspberry Pi Pico，点「原生固件」。可打开板载灯、按键、模拟输入和调光样例，也可从「导入工程」单独选择为经典 Pico 编译的 Flash UF2。预检核对 RP2040 家族标识、2 MiB Flash 范围、启动向量、boot2 CRC32 和 264 KiB SRAM 的初始栈地址。请使用单板应用文件。 [RP2040 数据手册](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf) · [样例源码与编译说明](dist/firmware/pico/README.md)
- 单核 Cortex-M0+ 从 XIP 应用向量启动。可运行、暂停、单步和复位，支持 GPIO、基础定时、UART0 字节收发、12 位 ADC 和基础 PWM 电路联动。CPU 与外设时序按仿真切片估算。 [Wokwi rp2040js 1.4.1](https://github.com/wokwi/rp2040js/tree/8693315df527adce8bf2bc315aeb4a1ca61c02a3) · [MIT 许可证](dist/vendor/rp2040js/LICENSE.txt)
- GP26–GP28 接入 ADC，参考电压采用标称 3.3 V。浏览器实测旋钮 10% 为 409 / 4095（0.33 V），90% 为 3685 / 4095（2.97 V），与 UART0 输出一致。电路电压按切片更新，引脚刚从复位下拉切到模拟输入时，首个样本可能仍使用上一个电路快照。 [ADC 实测画面](research/qa/v8.7-pico-native-adc.jpg)
- PWM 联动覆盖自由运行、边沿对齐模式。波形面板显示当前生效的计数周期和占空比，分数分频按平均频率估算。浏览器实测 GP15 的 PWM7B 输出 1 kHz，25% 与 75% 交替，LED 亮度随之变化，程序复位后读数清空。 [PWM 实测画面](research/qa/v8.7-pico-native-pwm.jpg)
- 草稿和工程备份保存原始 UF2 及启用状态。大固件如遇浏览器草稿空间不足，可用「保存工程」下载 JSON。浏览器实测 GP25 板载灯闪烁、GP14 按键驱动 GP15、Pico 插装 40 针、UART0 回显、程序复位和工程恢复，下载的 UF2 与原文件逐字节一致。 [Pico 插装后运行按键样例](research/qa/v8.6-pico-native-button.jpg)

## Arduino 原生固件

### Mega 2560 Rev3

- 点「原生固件」可运行面向 ATmega2560 编译的 HEX。加载器按 256 KiB Flash 范围检查地址，并处理扩展地址记录。运行器模拟 8 KiB SRAM 及大地址调用和返回。验收中，从 `0x0102` 调用位于 `0x22000` 的函数后回到 `0x0106`。 [高地址执行画面](research/qa/v8.2-mega-high-flash.png)
- 映射 D0–D53 和 A0–A15，提供单端单次 ADC、Timer0–5 的基础计数和比较、USART0–3 字节控制台。面板可独立切换四路串口。ADC 支持外部 AREF、默认 5 V 以及标称内部 1.1 V 和 2.56 V。 [Mega 官方引脚图](https://docs.arduino.cc/resources/pinouts/A000067-full-pinout.pdf) · [ATmega2560 数据手册](https://ww1.microchip.com/downloads/en/devicedoc/atmega640-1280-1281-2560-2561-datasheet-ds40002211a.pdf)
- 自带点灯、按键和 ADC 固件及带注释 C 源码。浏览器实测 D2 按键、复位、A15 采样、四路串口各自输出和 Serial3 回显。另用 Arduino AVR Core 1.8.6 编译的 Blink 核对启动和 Timer0 延时。全套 324 项自动化测试通过。 [样例编译说明](dist/firmware/mega2560/README.md) · [A15 和 Serial3 实测画面](research/qa/v8.2-mega-a15-serial.png)
- 导入、导出工程可保存完整 Mega 固件。若浏览器草稿提示保存空间不足，请用「保存工程」下载 JSON。

### UNO R3 和经典 Nano

- 在实验台选 UNO R3 或经典 Nano（ATmega328P、16 MHz），点「原生固件」。也可从「导入工程」选一个 HEX，再核对板型。预检覆盖记录格式、校验和、32 KiB Flash 范围及地址 0 的复位指令。HEX 本身不含板型。 [UNO R3 官方资料](https://docs.arduino.cc/hardware/uno-rev3/) · [经典 Nano 官方资料](https://docs.arduino.cc/hardware/nano)
- 固件在浏览器里执行 AVR 指令，可运行、暂停、逐指令单步和复位。GPIO 和 ADC 读取实验台电路，经典 Nano 插入面包板后可通过孔组传入数字信号。三个硬件定时器及 USART0 字节控制台也可用。 [AVR8js 0.21.1](https://github.com/wokwi/avr8js/releases/tag/v0.21.1) · [许可证](dist/vendor/avr8js/LICENSE.txt)
- 10 位单次 ADC 支持默认 5 V、标称内部 1.1 V 和外部 AREF。UNO R3 提供 A0–A5，经典 Nano 提供 A0–A7，其中 A6/A7 只用于模拟输入。模拟电路电压按虚拟时间切片求解，转换寄存器按仿真时钟推进。 [ATmega328P 数据手册](https://ww1.microchip.com/downloads/en/devicedoc/atmel-7810-automotive-microcontrollers-atmega328p_datasheet.pdf)
- 两款板共用点灯、按键和模拟输入三份示例。模拟输入示例读取 A0，D13 随阈值切换，并通过串口输出 0–1023 的读数。样例提供带注释的原始 C 文件。 [样例源码与编译说明](dist/firmware/uno-r3/README.md)
- 「返回源码」可以继续编辑原有文件，固件可重新启用。浏览器草稿、工程 JSON 和 IDE 包内的实验台备份会保存固件及启用状态，恢复时从地址 0 开始。固件面板也可单独下载 HEX。
- 08.1 共 310 项自动化测试通过。浏览器实测经典 Nano 点灯、按键、复位和插装后读电位器。另在 UNO R3 导入了 Arduino AVR Core 1.8.6 编译的 `analogRead` 程序，观察旋钮和串口读数同步变化。 [Nano 实测画面](research/qa/v8.1-nano-native-adc.png) · [08.0 UNO R3 点灯画面](research/qa/v8.0-uno-native-firmware.png)
- 两块板均可选择「D13 输入上拉与板载 L 灯」，在实验台顶部切换到另一块板的同一实验。松开按键时，仿真的 UNO R3 D13 约 5.00 V，L 灯约 2.97 mA。经典 Nano D13 约 2.03 V，L 灯约 0.07 mA。Nano 此时处在 ATmega328P 数字输入的未保证区间，模型串口会显示 0。按下时，1 kΩ 串联电阻的按键支路将两板的 D13 拉到约 0.12 V。 [UNO R3 原理图](https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf) · [Nano V3.0 原理图](https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf) · [Nano 触屏读数](research/qa/v10.6-nano-d13-mobile.png)
- UNO R3 用理想 LMV358 电压跟随器驱动 L，D13 不承担 L 灯的支路电流。模型省略运放的输入偏置、输出余量和瞬态。把 `INPUT_PULLUP` 改为 `INPUT` 并应用，松开按键时两板的 D13 悬空，实时电压和源码前后波形留空。按键接地时仍可测到约 0 V。 [LMV358 数据手册](https://www.ti.com/lit/ds/symlink/lmv358.pdf) · [UNO 应用源码后的悬空波形](research/qa/v10.6-uno-d13-floating.jpg)

## 开发板摆放与示例代码

- 在「选择」或「移动」模式抓住已插装的板身、排针或板身上方的导线，拖到目标孔位。单击排针查看读数，双击排针开始接线，单击导线选中导线。沿列拖动时容许少量横向偏移，看到两排孔亮绿和起始列后再松手。抓住面包板可在「移动」模式移动整组。 [Fritzing 面包板操作](https://github.com/fritzing/fritzing-docs/blob/master/01_quickstart/03_breadboardview.md) · [KiCad 摆放](https://github.com/KiCad/kicad-doc/blob/master/src/pcbnew/pcbnew_footprint_placement.adoc)
- 从「元件列表」选开发板后，列表收起，焦点回到实验台。3D 中可从芯片上表面、PCB 边缘和被导线遮挡的板身拖动。孔位预览的橙色粗圈标出两排的起始孔。 [三维换孔预览](research/qa/v10.8-board-replug.png)
- 选中插好的开发板后，在实验台按左右方向键逐列换孔，上下方向键切换该板排距允许的相邻排孔。也可点「点孔换位」，在示意图上选起始孔，或用 − / + 调一列。有跳线或孔组改接时，确认框会列出变化。按 Esc、放回原处或拖离有效孔位可保留原插位。 [Wokwi 拖动和方向键操作](https://docs.wokwi.com/guides/diagram-editor#moving-a-part)
- 在实验台或元件工具栏中选中开发板后按 R 转 90°，Shift+R 反向。已插装的板可确认拔下并转 90°，或在同一插位翻转 180°。快捷键避开输入框、输入法、接线手势和 Ctrl、Alt、系统键组合。 [KiCad 旋转键位](https://github.com/KiCad/kicad-source-mirror/blob/master/pcbnew/tools/pcb_actions.cpp#L916-L934)
- 浏览器实测 Blue Pill 从 C/G 排第 6 列拖到第 8 列，并单独验证换排。在实际页面点孔换到 D/H 排第 9 列，确认前保持原位，确认后能撤销和重做。另验证了二维触屏拖动、超界取消和代码区输入 R。
- 在实验台顶部点「插入面包板」，会搜索两种 USB 朝向的可用插位。3D 和二维图中也可以把任一块板拖向另一块。在「选择」或「移动」模式下，将板拖到 A–J 信号孔区，看到两排孔亮绿后松手。3D 预览会抬高板身，松手插入后排针进入孔内。只碰到边缘或电源轨时会提示继续拖向信号孔。
- 新建点灯实验把散件放在面包板旁边。若已有元件或跳线挡住孔位，点「查看腾位方案」，确认后才移开或拔下所列挡件。拔下开发板会断开插装接点，保留手动添加的跳线。插装和腾位可一起撤销。
- 商城的「面包板连接方式」筛选区分 23 款可直插、26 款用跳线和 7 款仅供选型的板卡。DevKitC V4 插上后会遮住一侧孔位，可从排针引线。UNO R3 的母座朝上，点「用跳线连接」可进入接线。 [SparkFun 面包板与排针说明](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard)
- ESP32-S3-DevKitC-1 v1.1、ESP32-C6-DevKitC-1 v1.2、ESP32-H2-DevKitM-1 v1.3 和 NodeMCU DevKit V1.0 ESP-12E 增加直插及预接线点灯练习。针脚同排间距 2.54 mm，排距 22.86 mm。排针插入 B / I 排，A / J 排留作引线。空脚保留机械位置，电气上彼此隔离。H2 v1.3 的排针外形沿用厂商发布的 v1.2 尺寸图，电气引脚按 v1.3 文档。NodeMCU 适用原版排针尺寸，其他外形的兼容板以实测为准。 [S3 尺寸图](https://dl.espressif.com/dl/schematics/esp_idf/DXF_ESP32-S3-DevKitC-1_V1.1_20220429.pdf) · [C6 尺寸图](https://dl.espressif.com/dl/schematics/esp32-c6-devkitc-1-dimensions_v1.2.pdf) · [H2 官方手册](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32h2/esp32-h2-devkitm-1/user_guide.html) · [NodeMCU 原版封装文件](https://github.com/nodemcu/nodemcu-devkit-v1.0/blob/master/ESP12E_DEVKIT.lbr)
- 「选孔位和方向」可指定排孔组合、起始列和 USB 朝向，孔位图会标出两排插针。当前支持直插的 23 个板型各有 2 到 5 组符合针距的孔排。拖动会对准最近的排孔和列，若受阻会搜索其他孔排、列和方向。换排、较远或反向的候选需要确认。挡住的跳线若可换到同组外露空孔，会先预览新孔号。
- 没有可用插位时，勾选「预览腾位」查看要拔下的跳线或元件。取消会保留原电路，确认后可以一次撤销全部变更。在「移动」模式中，可拖动已插好的开发板或面包板来移动整组。
- 插装后点「查插装引脚」，可按信号名或孔号搜索。结果列出板下插孔、外露孔及仿真电压。已插元件的孔会标注。点针脚或孔号可定位，点「从排针接线」可直接选定起点。端点测量条也有「从这里接线」。用这两个按钮起线后，点终点确认，按 Esc 取消。选择模式的单击测量、双击起线和拖动摆放仍可用。
- 新增跳线和重接都会检查孔位占用。接错目标孔会保留待接线起点，重接时原导线也保留。点有跳线的孔仍可测电压，测量条会提供同组空孔，同组没有空孔时可改从对应排针引线。电源轨的替代孔限定在同一段。导入旧工程会保留已有接线。 [SparkFun 面包板孔组说明](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/anatomy-of-a-breadboard)
- LED、电阻、四脚按键、DO-35 教学二极管和径向电解电容可直接插入面包板。选中元件后点「把元件插入面包板」。可在 3D 或二维图上拖动元件、点起始孔，或用 P、方向键和 Enter 选孔。绿色标出每只脚的目标孔，孔被占用或无法对齐时会说明原因。「插入并接通」才改变电路。用 R 或 Shift+R 转向，Esc 取消，也可用「按行列选孔」精确输入。普通拖动只改变摆放位置。
- 四脚按键跨中央沟槽，同组脚常通，按下时两组接通。教学模型的成形脚距为 7.62 × 5.08 mm，实物请按具体型号核对。拔下可断开插脚，撤销能恢复，工程文件会保存插装位置。 [SparkFun 四脚按键实验](https://learn.sparkfun.com/tutorials/stk-node/experiment-4-button)
- 二极管的阴极色环随封装旋转，成形脚距 7.62 mm，可沿一排或跨 E/F 槽。电解电容外壳直径 6.3 mm，模型将标称 2.50 mm 的脚距调整为相邻列的 2.54 mm。被外壳挡住的邻孔会提示遮挡。封装尺寸取自示例实物，电气参数继续使用教学近似。 [Vishay 1N4148 封装图](https://www.vishay.com/docs/81857/1n4148.pdf) · [Panasonic 径向电容尺寸](https://industrial.panasonic.com/ww/products/pt/aluminum-cap-lead/models/EEUFC1E101SH)
- 已插装的元件可选中后点「调整插位」，或按 R 预览转向。可拖动、点新孔或按行列输入。预览期间沿用原孔位和原接线，按键帽拖动不会触发按压。确认后才替换整组插脚，取消保留原位，撤销一次可恢复孔位、方向和原电路。
- Blue Pill 的「把 LED 和电阻插进面包板」用两根跳线和四个插脚形成串联回路。试试拔下电阻看电流归零，撤销后恢复。拖动面包板时已插好的元件也跟着移动。
- 「把 Blue Pill 插到面包板上」从未插装的板开始。选择第 6 列、USB 朝左。用默认 C/G 排时，PA0 经 C21 接到 A21，GND1 经 G24 接到 J24。用 D/H 排时，两根排针分别插入 D21 和 H24，也接通相同孔组。切换实验会保留当前草稿。
- ESP32 按键实验按板卡原有 GPIO 编号读取已求解的电平。回归验证覆盖 ESP32-DevKitC V4、ESP32-C3-DevKitM-1 与 Blue Pill 的按下和释放。
- ESP32-DevKitC V4 的「从 ESP32 插装排针引线」会把开发板放在第 6 列、USB 朝左。GPIO32 对应 A18，该孔组被板身遮挡。用引脚表从 GPIO32 拉一根线到按键 1 脚，随后运行并按住按键。LED 通过另一侧的 J23 和 J24 接到 GPIO23 和地。 [Espressif 板卡引脚手册](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
- 编辑器的「初始注释代码」显示每个示例文件的原始文本及逐行说明。「恢复初始代码」只替换代码，可撤销。「程序复位」停止运行并重置虚拟时间和运行状态，保留当前代码与电路。
- 草稿、工程 JSON 和 IDE 导出的接线备份会保存板体方向、插装位置、元件和导线。旧工程中未指定孔排的插位仍使用该板型原来的默认孔排。

09.8 浏览器实测 Blue Pill 在默认点灯实验中拖入 40 针，保持原有三根跳线，翻转后可以撤销。插装点灯练习中 PA0 与 C21 同为 3.13 V，LED 导通电流为 3.62 mA。ESP32-DevKitC V4 在 390 像素宽的触屏视口点按钮插入 38 针，也能在二维图中把面包板拖到开发板下方完成插装。已有电阻插脚挡住孔位的工程可预览腾位、确认插入并撤销。 [Blue Pill 插装与实际读数](research/qa/v9.8-blue-pill-seated.jpg)

09.5 的 421 项自动化测试通过。两套 Blue Pill 练习附原始注释代码。浏览器实测二极管翻转预览仍为 1.76 mA，确认后为 0.00 mA，撤销后恢复。RC 练习在 PA1 显示充放电曲线。暂停在 0.050 s 时拔下电容，电容保留 0.16 V，PA1 立即从 0.16 V 跳到 3.30 V。还验证了反接告警、外壳遮孔提示和 390 像素宽下按行列插回。 [二极管支路](research/qa/v9.5-diode-forward.jpg) · [电容与 PA1 波形](research/qa/v9.5-capacitor-rc.jpg)

09.4 的 411 项自动化测试通过。浏览器实测 Blue Pill 插入 D/H 排时 PA0 对应 D21、GND1 对应 H24，点灯导通电流为 3.62 mA。换排可撤销，刷新后插位保留。默认排被锁定的电阻挡住时，实际拖动后建议改用 E/I 排，确认后电阻仍在原位。390 像素宽下可选排孔并确认。 [Blue Pill 排孔预览](research/qa/v9.4-blue-pill-row-options.jpg) · [绕开锁定电阻后的三维画面](research/qa/v9.4-blue-pill-clears-resistor.jpg)

09.3 的 405 项自动化测试通过。浏览器实测 Blue Pill 在 3D 中拖动开发板、在二维图中反向拖动面包板、翻转、刷新恢复和预览腾位后取消。直插点灯的电流为 3.62 mA，拔下归零，撤销后恢复。经典 Pico 在 390 像素宽下完成 40 针反向插装，ESP32-DevKitC V4 完成 38 针插装，UNO R3 可由板卡入口进入跳线连接。 [Blue Pill 对孔预览](research/qa/v9.3-board-fit-preview.jpg) · [Blue Pill 三维插装](research/qa/v9.3-blue-pill-mated.jpg)

09.2 的 402 项自动化测试通过。浏览器实测 LED 原位翻转、3D 中电阻从 C11/C16 预览换到 H19/H24、二维按键帽拖动、取消后正常按压及 390 像素宽下按行列换位。电阻在预览时仍为 3.62 mA，确认后为 0 mA，撤销后恢复 3.62 mA。接线表验证原有跳线端点未改动。 [电阻换位预览](research/qa/v9.2-mounted-resistor-preview.jpg) · [按键换位预览](research/qa/v9.2-mounted-button-preview.jpg)

09.1 的 399 项自动化测试通过。浏览器实测 3D 拖电阻、二维点孔、占用提示、跨视图保留预览、旋转、Esc 取消、普通拖动不插装，以及 390 像素窄屏确认。电阻预览时支路电流为 0 mA，确认插入 C11/C16 后导通时为 3.62 mA，撤销后归零。四脚按键插入后，按下使 PB1 变低、PA0 变高，松开后恢复。已确认的 LED 插装在刷新后恢复。 [3D 拖动预览](research/qa/v9.1-part-placement-3d.jpg) · [四脚按键插装预览](research/qa/v9.1-part-placement-button.jpg)

08.8 的 381 项自动化测试全部通过。浏览器验证了默认「选择」模式下把面包板拖向 Blue Pill 并插入 40 针、在 3D 和二维图里拖开发板腾位插入、拔下、撤销及刷新后恢复插位。Blue Pill 直插练习中 LED 导通电流为 3.62 mA，拔下归零，撤销并运行后恢复。四款新板分别插入 44、32、30、30 针，点灯实验均在导通时读到 3.62 mA。C6 在 390 像素窄屏通过按钮完成插入，另核对了空脚的引脚表标注。 [Blue Pill 反向拖动插装](research/qa/v8.8-bluepill-reverse-mount.jpg) · [C6 插装点灯](research/qa/v8.8-esp32-c6-breadboard.jpg)

08.4 曾验证 Blue Pill 改用实验孔位、撤销与重做，以及 ESP32-DevKitC V4 插入 38 针后打开引脚表。 [08.4 Blue Pill 插装和点灯](research/qa/v8.4-blue-pill-mated.jpg)

此前的浏览器画面见 [J24 占用与 I24 接线入口](research/qa/v7.7-breadboard-occupied-hole.png)、[ESP32 被遮挡排针的接线入口](research/qa/v7.6-esp32-covered-header.png)、[Blue Pill 直插和 PA0 波形](research/qa/v7.5-blue-pill-breadboard.png)、[LED 与电阻插装实验](research/qa/v7.4-breadboard-led-resistor.png)、[精确插位及改接提示](research/qa/v7.3-exact-board-placement.png) 和 [初始注释代码](research/qa/v7-initial-annotated-code.png)。

## 开发板实物对照

- 经典 Arduino Nano 的实物对照采用 David A. Mellis 拍摄的 2010 年 Gravitech V3.0。Blender 模型包含 30 个镀层排针孔、6 个 ICSP 触点、4 个安装孔、中空 Mini-B、板载灯、复位键和板背 FT232RL。照片与 3D 双向同步，点 ATmega328P 查看 TQFP-32 封装、引脚和功能层。CAD 提供同版型共用的机械孔位及背面参考，细走线、背面贴片和连接器内部做了近似重建。 [原板实拍与许可](https://commons.wikimedia.org/wiki/File:Arduino_Nano.jpg#filehistory) · [V3.0 原理图](https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf) · [官方 CAD 入口](https://docs.arduino.cc/hardware/nano#downloadable-resources) · [Blender 生成脚本](tools/blender/arduino_nano.py) · [实拍与三维对照](research/qa/v10.4-nano-photo-3d.jpg)
- Nano「直插点灯」从 C/G 排第 8 列插入 30 针，D13 经 G8/J8 输出，GND 经 G21/J21 返回。Workspace 10.5 按 V3.0 原理图将板载 L 灯的串联电阻修正为 330 Ω。现版插好并输出高电平时，D13 约 4.42 V，板载灯约 7.11 mA，外接灯约 5.25 mA。拔板后板载 L 继续闪，外接灯熄灭。板载 RST 重启已应用程序，保留编辑草稿和接线。ICSP 可在对照页定位，实验台接线使用 30 个侧排针。 [Nano V3.0 原理图](https://www.arduino.cc/en/uploads/Main/ArduinoNano30Schematic.pdf)

- 经典 Raspberry Pi Pico Rev3 的 Blender 模型包含 40 个排针孔、3 个 SWD 孔、对应的板边镀层半孔、4 个安装孔和中空 Micro‑USB。实物对照显示裸板，实验台显示焊好的排针。点 RP2040 封装可进入拆解，GP25 板载灯随仿真更新。细小封装、走线和 USB 内部结构采用近似。该模型对应经典 Pico Rev3。 [官方设计资料](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#resources-for-non-wireless-raspberry-pi-pico-boards) · [Blender 生成脚本](tools/blender/pico.py) · [独立渲染](research/qa/pico-rp2040-blender.png) · [实拍与三维对照](research/qa/v9.9-pico-photo-3d.jpg)
- 浏览器实测从 Pico 照片上的 GP26 定位 3D 焊孔、从 3D 底面点 SWDIO 反向定位照片、点 RP2040 实体进入拆解。插入 C/H 排的 40 针后，原生 UF2 点灯样例使 GP25 在 0 和 3.24 V 之间切换，板载 LED 同步亮灭。

- ESP32-DevKitC V4 的 Blender 模型以官方尺寸图与 WROOM-32E 数据手册为依据，包含有厚度的板框、38 个通孔与镀层、空心 Micro‑USB、模组屏蔽罩和板背细节。实验台的排针、PWR 灯、EN 和 BOOT 按键是独立部件。钻孔口径、焊锡、板背走线及细小封装采用近似。 [Espressif 开发板尺寸图](https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf) · [WROOM-32E 数据手册](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf) · [Blender 生成脚本](tools/blender/esp32_devkitc_v4.py) · [独立渲染](research/qa/esp32-devkitc-v4-blender.png)
- Blue Pill 的 RESET、UNO R3 的 RESET 与 ESP32-DevKitC V4 的 EN 可在实验台点按。板载复位从头执行上次应用的代码或已载入的原生固件，保留编辑草稿和插装。若要让编辑区的新代码生效，点「应用草稿并重启」。 [ESP32 EN 说明](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)

- UNO R3 DIP 的 Blender 模型按 Arduino A000066 Rev3e CAD 重建板框、固定孔、32 个排插和 12 个 ICSP 触点。USB‑B 与电源插座有实体开口，ATmega328P 保留插座和方向缺口，底面按 CAD 位置补了焊脚。器件高度、接插件内部细节和焊锡形状做了简化。板载灯继续随仿真变化，电路台从板顶排插接跳线。 [Arduino UNO R3 与 CAD](https://docs.arduino.cc/hardware/uno-rev3/) · [改作许可 CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) · [Blender 生成脚本](tools/blender/uno_r3.py) · [独立渲染](research/qa/uno-r3-blender.png)
- 09.7 的「应用前后仿真读数」比较同一接线、同一引脚的两次实际仿真采样，并标出各自的虚拟时间。旧代码使用最近一次有效采样，新代码使用应用后第一次有效采样。电压和 LED 可能处在不同闪烁相位。改线、切换观察引脚或改变电气条件会清除旧对照。浏览器实测 UNO R3 的 D13 由 4.87 V、LED 亮、等待 500 ms 变为 0.00 V、LED 灭、等待 200 ms，接入 D13 至 A1 跳线后旧对照清除。429 项自动化测试通过。 [模型和读数对照](research/qa/v9.7-uno-code-comparison.jpg)
- 09.9 增加「查看波形对照」。先运行原代码，再保持接线和观察引脚，编辑并应用草稿。在「引脚与波形」里可同时看到两版从启动算起前 5 秒内的电路采样，每版最多 1,024 个时刻。波形阶跃位于采样点，未采样区间留白。快速 PWM 边沿可能落在采样间隔内。切换观察引脚、改变电气条件或复位会清除对照。浏览器实测 Blue Pill 的两处延时由 500 ms 改到 200 ms 后，PA0 的采样变化间隔随之缩短，电压范围均为 0–3.13 V。 [应用前后波形](research/qa/v9.9-source-waveform-comparison.jpg)
- 10.1 的源码波形对照在等待开始时也采样。浏览器实测 Blue Pill 的 PA0 启动时为 3.13 V，原程序在 500 ms 降到 0 V，改动后的程序在 200 ms 降到 0 V。读数游标显示两条曲线各自最近采样的实际时间和电压。
- 选中外接 LED，在属性面板点「跟踪此 LED 电流」。源码运行时从开始跟踪的仿真时刻采样至多 5 秒。保持同一灯与电路，修改并应用代码，便可对照两版的支路电流。引脚监视和 LED 电流是独立读数。游标同时显示相对时间、实际采样时刻和 mA。无法求解的读数留白。浏览器实测 Nano 的外接灯从 0–5.25 mA 闪烁变为持续 0 mA。 [桌面电流对照](research/qa/v10.5-nano-led-current.jpg) · [触屏电流对照](research/qa/v10.5-nano-led-current-mobile.png)
- 「选择」模式可在 3D 或二维视图按住电位器顶端左右拖动。转动时电压与执行中的 ADC 实时更新。松手提交一次撤销，Esc 或触控取消恢复旋钮位置。外壳可拖动，属性滑块支持方向键。三维外壳和有凹槽的旋钮按 Bourns 3362P 手拧款的名义尺寸在 Blender 中重建，网页使用教学弯脚接到已有的 VCC、OUT 和 GND 端点。 [官方尺寸与电气行程](https://www.bourns.com/docs/product-datasheets/3362.pdf) · [Blender 生成脚本](tools/blender/potentiometer_3362.py) · [独立渲染](research/qa/potentiometer-3362-blender.png)
- 源码栏可直接看到最近一次 ADC 采样及时间，点「定位 ADC 采样」跳到实际调用。浏览器实测 Nano 的「旋钮变成数字」在 70% 时为 3.50 V、716 / 1023。保持旋钮和接线，把亮灯阈值从 512 改成 800 并应用。ADC 读数仍为 716，外接灯电流从约 5.25 mA 变成 0 mA。 [阈值改动与电流对照](research/qa/v10.7-pot-adc-threshold.jpg)

- Blue Pill 的固定部件由 Blender 4.5.15 制作，实验台和实物对照各有与对应板图对齐的布局。模型包括有厚度的 PCB、40 个实际钻孔及镀层、空心 Micro‑USB 插座、STM32 封装的鸥翼脚和晶振。排针、按键、板载灯和可点击区域随实时电路工作。模型加载失败会显示原有三维几何。铜线走向和背面小元件采用示意布局。 [Blender 生成脚本](tools/blender/blue_pill.py) · [独立渲染](research/qa/blue-pill-blender.png)
- 源码编辑区的「代码与硬件」条显示观察引脚电压、LED 状态、程序等待时间和实际写入行。编辑时暂停，并保留上次应用的输出。按「应用草稿并重启」后通过检查的代码才接管仿真。检查失败时仍显示上次读数。浏览器验收覆盖了板卡 40 针插装后点灯、照片和三维模型的引脚同步、芯片拆解入口、无效草稿保留原结果，以及等待时间从 500 ms 改为 200 ms。 [实验台验收画面](research/qa/v9.6-blender-code-workbench.jpg)

使用「实物对照」上的板卡切换，或直接打开 `#blue-pill`、`#uno-r3`、`#esp32-devkitc`、`#pico`。查看照片和拆解不会切换实验。要切换时可点「用这块板做实验」，原板的草稿会保留。

- UNO R3 同步定位 32 个边缘触点与两组各 6 个 ICSP 触点。拆解包含 PDIP-28 封装、28 个芯片脚及 Microchip 功能示意。主控与 USB 转串口芯片的编程排针分别标注。照片经过裁切、旋转、缩放。 [MakeMagazinDE 实拍与许可](https://commons.wikimedia.org/wiki/File:Arduino_uno_r3.jpg) · [Arduino UNO R3](https://docs.arduino.cc/hardware/uno-rev3/)
- ESP32-DevKitC V4 同步定位左右各 19 针。拆解包含 PCB 天线、屏蔽罩、38 个边缘焊盘、底面 39 号接地焊盘及功能示意。按照片所示 WROOM-32E 标注，旧版 Flash 触点丝印保留供对照。官方实拍经过裁切和旋转，保留原有红色标记。 [Espressif 开发板手册与实拍](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) · [WROOM-32E 模组数据手册](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf)
- 经典 Raspberry Pi Pico 同步定位 40 个边缘焊孔和 3 个 SWD 孔。照片展示未焊排针的原版裸板，页面转到 Micro-USB 朝上。3D 模型采用 Rev3 的 21 × 51 mm 板形与孔位，可翻看板底。 [Phiarc 实拍与许可](https://commons.wikimedia.org/wiki/File:Raspberry_Pi_Pico_top.jpg) · [Raspberry Pi Pico 手册](https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf)
- RP2040 拆解包含 7 × 7 mm 的 QFN-56 封装、56 个外围焊盘与底部接地 ePad（57）。板级 GP26 对应封装第 38 号，SWDIO 对应第 25 号。内部功能以可点选的示意方块呈现双核、SRAM、PIO、PWM、ADC、USB、QSPI/XIP 和总线。 [RP2040 数据手册](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- 09.0 浏览器实测 Pico 的双向点选、转动缩放与翻底面、照片和 3D 芯片入口、焊盘跳转和返回、PIO 功能层，以及 390 像素宽时的纵向联动。也回归了原有三块板的同步点选。395 项自动化测试通过。 [照片与 3D 双高亮](research/qa/v9.0-pico-photo-3d.jpg) · [RP2040 底面接地焊盘](research/qa/v9.0-rp2040-epad.jpg)
- 默认选择或移动时，单击引脚用来选择，拖动用来摆放。双击起点引脚后，再点击终点完成接线，Esc 取消。主动切到「接线」可直接点两端或拖线。选中元件后用工具栏的「旋转 90°」、R 或 Shift+R 改变摆放角度，可撤销。

V6 的 209 项自动化测试通过。浏览器实测两款新板卡的双向点选、旋转和缩放、芯片分层和实体模型点击，核对了 UNO 的 D13 对应第 19 脚、ESP32 的 GPIO23 对应模组第 37 焊盘。在实验台实测旋转电阻、从面包板孔位拖动、双击后新增一根导线及撤销。回归测试包含 Blue Pill 对照与二维、三维接线行为。

V6.0.1 让待接线状态显示「取消接线」，离开实验台或切到窄屏代码区会清除该状态。实物对照切换可用浏览器前进、后退。选中当前视野外的排针时，三维模型会移动视野以露出高亮。ESP32 模组从底面切到封装或内部功能时会回到上方视角。

### Blue Pill

从实验台的「实物对照」或左侧导航进入。左侧照片与右侧 WebGL 模型按 USB 朝上对齐。点击照片、模型或「定位板上引脚」，可同步查看两侧 40 个排针孔和 4 个 SWD 触点。并列的 GND 和 3.3 V 触点各有独立的物理位置。

点击板上 STM32 芯片，或用「拆解 STM32」，可查看封装、48 个编号引脚和内部功能示意。对于能定位到单个封装脚的信号，引脚卡可直接打开对应的芯片引脚。板级电源和地没有唯一的封装脚。芯片内部图按 ST 文档的功能关系绘制，物理位置是教学示意。对照与拆解独立于实验工程。

照片由 Avandalen 拍摄，页面旋转原图以统一观察方向，并叠加独立的交互标记。照片批次可通过原图核对。 [原图与作者](https://commons.wikimedia.org/wiki/File:Blue_Pill.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

芯片资料来自 ST 的 DS5319（功能图、LQFP48 引脚表和封装尺寸）及 RM0008。 [DS5319 数据手册](https://www.st.com/resource/en/datasheet/stm32f103c8.pdf) · [STM32F103 官方文档](https://www.st.com/en/microcontrollers-microprocessors/stm32f103/documentation.html)

V5 的 197 项自动化测试全部通过。浏览器实测双向点选相邻 GND、SWDIO 跳第 34 脚、PC13 跳第 2 脚、点选芯片第 10 脚后返回并定位 PA0，以及芯片三层切换和 ADC 功能卡。拖动和滚轮缩放后，三维标记继续跟随所选引脚。390 像素宽时，照片和模型纵向排列并共享选择。

## 万用表

- 在实验台点「万用表」，选择红表笔或黑表笔，再点可接触的引脚、元件脚或面包板孔。键盘可用 P 浏览端点，方向键移动，Enter 放置，Esc 取消。两种视图使用同一对测点。
- 读数为红表笔电位减黑表笔电位。「交换表笔」可核对正负号。两表笔在同一孔组时读数为 0 V，两点之间缺少共同的电气参考时显示悬空。测量读取当前电路求解结果，表笔在模型里没有负载。 [Fluke 直流电压测量说明](https://www.fluke.com/en-ie/learn/blog/digital-multimeters/how-to-measure-dc-voltage-with-a-digital-multimeter)
- 可保留表笔，运行程序或应用新代码，观察电压怎样变化。当前提供直流瞬时读数，高频边沿请结合波形和模型采样范围查看。
- 放好两支表笔后可点「用表笔看波形」。源码运行时记录从启动算起前 5 秒内的实际压差。保持测点和电气条件，应用修改后的源码即可对照两次波形。改变测点、交换极性或改变电气条件会清除旧的表笔对照。「波形来源」可切回 GPIO 的独立记录。
- 浏览器实测 Blue Pill 的 330 Ω 电阻反向测量，原点灯程序在 −1.194 V 和 0 V 间切换，改成持续低电平后为 0 V。将 LED 驱动端改成浮空输入时，曲线留白，游标显示「暂无有效读数」。390 像素触屏布局也验证了从表笔直接进入当前波形。 [电阻两端的表笔波形](research/qa/v10.2-probe-waveform-comparison.jpg)
- 浏览器实测 Blue Pill 的 LED 两端为 1.94 V，交换表笔后为 −1.94 V。切换到 3D 后仍保留测点。将红表笔移到 GPIO 输出一侧，应用持续低电平的代码后，读数从 3.13 V 降至 0.00 V。390 像素宽的触屏布局也测到了 3.30 V 电源轨。 [三维实验台测量](research/qa/v10.0-led-probe-voltage.jpg)

## 工作区

- 小白版：预接线示例、分步提示、逐行白话、当前语句解释、故障练习。
- 新增按实验变化的预测/观察卡、资料收藏与PDF预览、硬件收藏/三板对比/引脚索引、查找替换与跳行、导入检查与撤回。
- 专业版：紧凑布局、可收起解释、深色代码区、引脚/波形/串口/变量集中查看。
- 桌面端的电路与编辑器并排；可拖动分隔条调整宽度。窄屏用观察/编写标签切换。
- 侧面硬件目录提供搜索、系列/类型/支持范围筛选、原始资料与接线指导；备料清单可导出CSV。
- 代码输入后自动做支持范围内的语法检查；补全支持函数模板、常量和当前文件中的名称。解释基于确定性规则，不调用远程模型，也不上传用户源码。
- 默认进入 Three.js WebGL 三维实验台。拖空白处环绕，滚轮缩放，右拖平移，底面按钮可看 PCB 焊盘。选择元件后用「聚焦」近看。触屏使用单指环绕、双指缩放和平移。二维接线图可手动切换，WebGL 无法启动时自动启用。
- 点击模型选中。使用「元件列表」的复选框或 Shift 点击多选。选中工具栏、右键菜单及 Delete / Backspace 都可以删除。删除已接线元件或批量删除时，确认框列出受影响的导线数量。点击「撤销删除」可一起恢复元件与导线。
- 「更多」提供 90° 旋转、复制、锁定与隐藏。复制保留元件参数，副本从未接线状态开始。锁定保护位置、角度和删除。隐藏后可从元件列表找回，电路继续求解。
- GPIO 接线可点击或拖拽两个端点。键盘可用方括号切换物件，P 浏览引脚，方向键选引脚，Enter 接线。启用孔位吸附后，拖动时第一个引脚会对齐邻近的实际面包板孔，电气连接仍需确认接线。
- 工程 JSON、浏览器草稿及 IDE 包中的电路备份保留位置、旋转、锁定、隐藏和接线，兼容旧版工程。临时按住的瞬时开关在重新载入时松开。

## 板卡与元件能力

目录收录 **56 款开发板、78 项元件或模块、65 条中英资料**。其中 9 款有精细 3D，43 款有教学 3D，另有 4 款提供选型资料。可用实验随板卡变化，覆盖直插、按键、点灯、ADC 和 PWM 等操作。六款支持原生固件，电路求解器包含 23 类元件。

### TI、NXP 与沁恒的六款板

- **TI LP-MSPM0G3507 和 MSP-EXP430FR2355** 使用 Rev A 板型。四排 BoosterPack 共 40 个触点按图纸摆放，可以从三维底面查看母座。点灯与 PWM 接 J2.19，ADC 接 J1.2。与板载设备共用的脚标作预留。 [MSPM0G3507 指南](https://www.ti.com/lit/pdf/SLAU873) · [MSP430FR2355 指南](https://www.ti.com/lit/pdf/SLAU680)
- **NXP FRDM-K64F Rev E 和 FRDM-MCXN947 Rev C** 开放已核对的排针。K64F 用 D3 输出 PWM，MCXN947 用默认已连通的 J3.15。可以在硬件详情按 `J3.15` 搜索 `P2_6`。 [K64F 官方文档](https://www.nxp.com/design/design-center/development-boards-and-designs/FRDM-K64F?tab=Documentation_Tab) · [MCXN947 官方手册](https://docs.nxp.com/bundle/UM12018)
- **沁恒 CH32V003EVT R0-1v1 和 CH32V307V-EVT R1-1v0** 按各自原厂 PCB 定位可接线端点，均使用 3.3 V VCC。003 开放 P1、P2，307 开放内侧 J5–J8。外侧扩展排针和板载通信接口供外观辨认。 [CH32V003 原厂图纸](https://github.com/openwch/ch32v003/tree/main/SCHPCB/CH32V003F4P6-R0-1v1) · [CH32V307 原厂图纸](https://github.com/openwch/ch32v307/tree/main/SCHPCB/CH32V307V-R1-1v0)

每块板有四个预接线教学示例，使用 3.3 V GPIO。初始代码标注示例所用的物理触点或芯片信号，支持通用源码和接线工程导出。原生固件仍需对应厂商的工具链。 [LaunchPad ADC 实测](research/qa/v7.9-mspm0-launchpad-adc.png) · [FRDM-MCXN947 PWM 实测](research/qa/v7.9-frdm-mcxn947-pwm.png)

### micro:bit 与 Nordic DK

- **BBC micro:bit V2.2x** 的三维 PCB 有五个穿孔大环和小金手指。预接线实验用 P0 驱动外接 LED，P1 读按键，P2 读旋钮。点灯示例以 3.3 kΩ 限流，模型电流约 0.42 mA。板载点阵的封装可观察，共用点阵、板载按键及 I²C 的脚标为预留。 [Micro:bit 官方边缘接口](https://tech.microbit.org/hardware/edge-connector/)
- **nRF52840 DK（PCA10056）** 和 **nRF5340 DK（PCA10095 应用核）** 使用各自的 Arduino R3 兼容接头映射。实验台采用板载稳压器的 3.0 V VDD 模式。示例使用外接 LED、按键和旋钮。 [nRF52840 DK 接口](https://docs.nordicsemi.com/r/bundle/ug_nrf52840_dk/page/ug/dk/connector_if.html) · [nRF5340 DK 用户指南](https://docs-be.nordicsemi.com/bundle/nRF5340_DK/raw/resource/enus/nRF5340_DK_User_Guide_v2.0.0.pdf)
- **nRF54L15 DK（PCA10156）** 显示 P0、P1、P2 扩展头及开放的 GPIO 子集。模型使用 3.3 V VDDIO 配置，实板出厂默认 1.8 V。 [Nordic 电源说明](https://docs.nordicsemi.com/r/bundle/ug_nrf54l15_dk/page/ug/nrf54l15_dk/hw_desription/power_supply.html)

四块板使用带引脚注释的 Arduino 风格教学接口，支持通用源码和接线工程导出。MakeCode、MicroPython、Zephyr、原生固件、无线和板载外设协议留在官方工具中验证。

浏览器验收画面见 [micro:bit 点灯和波形](research/qa/v7.8-microbit-gpio.png) 和 [nRF54L15 DK PWM 实验](research/qa/v7.8-nrf54l15-pwm.png)。

`board-profiles.js` 注册实际可运行的板型，`catalog-data.js` 保存完整目录。商城按可运行、部分排针和资料级显示支持状态。详情提供已经核对的引脚与板卡来源。STM32 部分 Nucleo / Discovery 和 Arduino GIGA 优先开放主排针，板载扩展外设的范围见每块板的说明。

- 原F103标准外设库实验继续保留。
- 新板卡主要用Arduino风格 `setup/loop/pinMode/digitalWrite/digitalRead/analogRead/analogWrite/delay/millis` 等接口的子集。
- F401不把F1标准库冒充F4驱动；只有明确声明的源码接口可用。
- 板卡逻辑电压、ADC默认分辨率、针脚别名、板载LED极性和输入限制由profile提供。底层型号与具体开发板版本按官方来源区分。
- 电气模型包括 LED、电阻、按键、光敏和温度传感器、OLED、继电器、舵机及直流电机等，具体接线与适用范围见各实验。
- UNO R3、经典 Nano 和 Mega 2560 Rev3 运行原生 AVR HEX，Blue Pill 和 NUCLEO-F103RB 运行原生 Cortex-M3 HEX/BIN，经典 Raspberry Pi Pico 运行 RP2040 Flash UF2。其余可运行板型采用各自的源码行为模型。目录也包含以选型、资料及接线说明为主的板卡。

## 文件职责

- `app.js`：工程状态、执行调度、两种界面、编辑器联动、引导、导入导出、撤销。
- `avr-firmware-hex.js`、`avr-firmware-runtime.js`、`avr-mega2560.js`、`avr-adc.js`、`avr-circuit-io.js`：Intel HEX 验证、ATmega328P 和 ATmega2560 的 AVR 指令、寄存器仿真以及电路联动。
- `stm32-firmware-image.js`、`stm32-firmware-runtime.js`：Blue Pill 和 NUCLEO-F103RB 固件地址与复位向量检查、后台 Cortex-M3 运行及电路联动。
- `rp2040-firmware-image.js`、`rp2040-firmware-runtime.js`：经典 Pico UF2 检查、后台 RP2040 运行及电路联动。
- `editor-assistant.js`：规则式逐行解释、上下文补全、缩进与括号辅助。
- `catalog-data.js`：官方/作者来源的开发板、元件、额外中英资料目录。
- `catalog-ui.js`：目录侧栏、筛选、详情、备料清单与CSV导出。
- `board-profiles.js` 和 `sim-profiles-*.js` 管理已接入的开发板、引脚映射和预接线 Arduino 示例。
- `breadboard-mount.js` 从板卡排针间距计算插装姿态和电气接点。
- `engine.js`：C子集解析器、F103标准库行为、Arduino风格兼容入口。
- `circuit.js`：简化集总电路与元件行为、有限范围诊断。
- `geometry-3d.js`、`model-renderer.js`、`workbench.js`、`workbench2d.js` 提供三维几何、端点坐标、WebGL 交互与二维接线图。
- `scene-objects.js` 管理元件复制、批量删除及受影响的接线。`fault-exercises.js` 验证故障练习后再提交对电路或源码的修改。
- `project-import.js` / `zip-validation.js`：源码、编码、工程JSON与电路验证，原始ZIP条目预检、CRC与备份识别。
- `resource-library.js`：学习路线、资料检索、收藏和原文入口。
- `learning-guide.js`：按实验和板卡生成的学习卡与代码定位。
- `editor-tools.js`：当前文件查找、替换、跳行。
- `catalog-index.js` / `inspector-tools.js`：目录检索、BOM清洗和参数/诊断规范化。
- `project-export.js`：通用源码、Arduino、PlatformIO、Keil工程接入包生成。
- `content.js`：原有短课、库函数白话、故障知识和标准外设库示例。
- `resources.json`：资料索引。此发布包的厂商文档通过来源链接打开，保留语种、阅读提示和学习路线。
- `research/hardware-catalog-sources.md`：资料来源和核验说明。

## IDE接入

“导出到IDE”会根据当前板型和源码环境提供合适选项。生成工程ZIP、依赖说明及实验电路JSON；可另外附加独立逐行读码TXT，原源码保持原样。生成后可逐文件预览、复制或下载。

Keil选项针对匹配的STM32原生C；Arduino/PlatformIO针对匹配的sketch。所需芯片包、核心、启动文件和库依赖在生成说明中列出。浏览器不直接控制用户本机IDE，也不自动烧录。没有在用户电脑的Keil或实际硬件上编译验证。

## 明确边界

- 源码模式运行受支持的 C 和 Arduino 风格接口。原生模式的固件格式与板型对应，见上方「板卡与元件能力」及各固件示例。
- Blue Pill 和 NUCLEO-F103RB 的原生联动覆盖 GPIO、SysTick 中断、ADC1 软件启动单通道转换和 TIM2–4 基础 PWM。字节终端依板型支持 USART1 或 USART2。Blue Pill 的 I²C1 主机实验覆盖 MCP9808 温度读取和 SSD1306 写屏。系统启动加载器和 SysTick COUNTFLAG 轮询暂缺。
- 经典 Pico 的原生模式模拟单核 Cortex-M0+ 与 GPIO、UART0、ADC 和基础 PWM 的电路联动。PWM 覆盖自由运行、边沿对齐的输出，时序按仿真切片估算。
- AVR 原生 ADC 侧重单次转换。TWI 主机联动按地址和字节处理。Mega 2560 的差分 ADC、定时器输入捕获、异步 Timer2、引脚变化中断、部分高级 PWM 模式及 D13 双定时器输出组合暂缺。
- 实时检查主要验证可解析语法与已识别接口；通过不等于所有运行逻辑正确。
- 外设仿真按板型和实验开放，逐位模拟时序、完整 DMA 和通信协议栈须用相应的实物及工具验证。
- AVR 面板报告已写入 Flash 的字节数和模拟时钟周期。网页推进速度、波形采样和实体时序存在差异。源码行为模型的虚拟时间用于教学观察。
- 元件采用集总简化模型，未完整模拟温升、烧毁、EMC、噪声、焊接和接触不良。
- 外观与针位根据官方资料绘制，但显示尺寸有教学简化，不能拿来制板或加工外壳。
- 自动诊断有条件和范围，其余故障条目提供人工排查知识，不能穷尽所有真实故障。
- 三维观察依赖 WebGL 2。兼容视图以 SVG 提供接线和编辑。元件的旋转操作围绕竖直轴进行，视角可从各方向和底部观察。LED 发光和透光使用材质近似。

## 验证范围

自动化测试覆盖电路求解、固件、三维孔位、元件操作和工程往返。各实验章节附浏览器实测记录。窄屏布局与触屏仿真已做浏览器验证，双指手势和 IDE 烧录仍需用实体设备验证。
