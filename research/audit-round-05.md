# 第5轮审查：编辑器与初学者代码理解

日期：2026-11-06。状态：本轮代码与自动化验证完成；真实浏览器的布局、输入法和读屏交互由整体验收继续核对。

## 结果

本轮修改 `dist/editor-assistant.js`，新增 `dist/editor-tools.js`、`dist/editor-tools.css`，扩充 `tests/editor-assistant.test.mjs` 并新增 `tests/editor-tools.test.mjs`。没有修改 app、HTML、其他样式文件、解释执行器、电路求解器或板卡 profile。根代理负责接入新模块。

保留原有8项编辑器测试，新增26项，编辑器相关共34项全部通过。完成时独立执行的全仓回归为123项全部通过；这是当时工作树的结果，后续整合仍由根代理最终复核。没有以DOM夹具测试代替实际浏览器或输入法验收。

## 实际问题、修复与复现

| 原有问题 | 本轮修复 | 可复现检查 |
| --- | --- | --- |
| Tab直接用4个空格替换整个选区，多行代码会丢失；Shift+Tab也只插入空格 | 按行缩进/退缩进，保留选区内容；以行首为末端的选区不误改下一行；首行空行也正确处理 | 选中两行代码并按Tab，两行各缩进4格、内容保留；Shift+Tab恢复。测试 `Tab indents selected lines...` |
| 补全只判断当前行是否有`//`，无法区分字符串、字符常量和跨行块注释；括号自动插入也不辨语境 | 新增保留字符偏移的词法扫描；注释、字符串、字符常量中不补全/配对；字符串中的`https://`不会让后面的有效代码被误判为注释 | 在`/*`后换行输入`GPIO_Se`不弹建议；在未闭合字符串中输入`(`只插入一个字符；结束URL字符串后输入`GPIO_Se`可以补全 |
| 仅检查单次keydown的`isComposing`，组合输入期间的input仍会触发建议 | 跟踪compositionstart/end，同时兼容isComposing与keyCode229；组合期间不接管Enter/括号/快捷键 | 组合开始后发送不带isComposing标记的中间input/keydown，仍不自动改写；原2项IME Enter测试保留 |
| 在已有标识符中间补全会保留尾部，可能得到重复标识符；移动光标后旧替换范围仍有效 | 替换完整标识符范围，保留已有实参与分号；方向键/选择事件使过期建议失效；只在原锚点接受补全 | 在`GPIO_SetBits(...)`名称中间重新补全，内容不变；弹窗出现后移到别处，不再使用旧位置替换 |
| 结构体字段仍混在通用API建议中，注释中的声明也可能成为变量候选 | 根据可见结构体声明补全字段；候选扫描忽略注释/字符串；用户函数不会误标为普通变量 | `GPIO_InitTypeDef gpio;`之后输入`gpio.GPIO_M`只提供`GPIO_Mode`；注释里的`int ghost;`不产生ghost候选 |
| 补全缺少活动选项关联，代码区持续接管Tab造成键盘离开困难 | 补全列表关联aria-controls/aria-activedescendant；↑↓选择、Enter/Tab接受；Esc后Tab放行焦点；提供可见键盘说明 | 用键盘打开补全、上下选择、接受；按Esc后Tab能离开代码区；测试检查活动选项ID与状态 |
| 缺少当前文件查找、替换和跳行 | 新独立工具条支持字面匹配、大小写、完整标识符、上一/下一处、单次/全部替换、行号定位；替换前确认选区确为当前匹配；只通过textarea事件通知修改 | 搜索`[0]`只匹配字面文本；替换为`$&`保留这两个字符；全部替换仅发一个input；非法行号不跳到猜测位置 |
| F103解释常重复术语，无法连接配置单、端口和引脚；容易混淆GPIO_Speed、PSC、ARR、CCR和波特率 | 在同函数可见直接赋值范围内关联GPIO_Init配置单；明确GPIOA+GPIO_Pin_0→PA0，复用配置单后GPIOB+GPIO_Pin_1→PB1；解释字段赋值不等于写硬件；补充具体GPIO/定时器/ADC/USART说明 | 查看按钮示例两次GPIO_Init，分别说明PA0输出与PB1上拉输入；50MHz明确不是CPU主频；PSC71说明除72，ARR999说明1000次，CCR50不冒称50% |
| 多行注释中的API文本、字符串中的配置文本、轮询条件方向可能被误解 | 逐行解释共享词法结果；注释只解释为注释；==SET与==RESET不使用相同的“等完成”结论；保留专业说明及静态范围提示 | 注释中的GPIO_SetBits不解释为实际输出；ADC EOC比较SET不解释成“未完成就等” |
| 原编辑字号偏小，缩进、补全与工具焦点不够明显 | 源码/高亮统一14px，仍严格保持22px行高；行号和白话列同步；补全活动项、表单聚焦与状态提示提高辨识度 | CSS测试锁定源码/高亮/行号/白话行高22px；浏览器继续核对长行横向滚动与执行高亮对齐 |

额外加入Ctrl/⌘+/逐行注释切换和括号中间Backspace删除成对括号。Enter在成对花括号中创建内层缩进，同时保持右花括号对齐；注释中的孤立花括号不会产生额外缩进。

## 集成接口

```js
import {mountEditorTools} from './editor-tools.js';

const tools = mountEditorTools({
  textarea: document.querySelector('#codeEditor'),
  host: document.querySelector('#editorUtilityBar'),
  lineHeight: 22,
  onOpen: () => editorAssistant.close(),
  onNavigate: () => {
    cursorChanged();
    editorAssistant.updateHint();
  }
});
```

`host`是专用空容器，建议放在编辑区域上方。工具自行创建带标签的表单、按钮和状态提示，不读取应用内部全局。CSS应在原编辑器样式之后加载。

返回接口：`open('find'|'replace'|'goto')`、`close()`、`refresh()`、`destroy()`、`findNext(direction)`、`replaceCurrent()`、`replaceAll()`、`goToLine(number)`。另提供`setQuery`、`setReplacement`、`getState`便于调用与测试。

快捷键仅在编辑器内接管：Ctrl/⌘F查找，CtrlH或⌘⌥F替换，Ctrl/⌘G跳行，F3/Shift+F3下一处/上一处。查找框Enter/Shift+Enter前后定位，替换框Enter替换当前项，Esc关闭。程序直接设置textarea.value切换文件后，应调用`refresh()`更新尚打开的工具状态。

实际文本改动发出一个冒泡`input`事件；定位发出`select`和`scroll`事件，并调用`onNavigate`。查找和跳行本身不发input，不触发项目内容保存。工具不上传源码，不访问存储。

解释接口保留`explainSourceLine(line, fallback, board)`，新增`explainSource(fullText, fallback, board)`以便获得同文件上下文；逐行批量接口保留每一物理行的位置，包括注释和空行。

## 验证

```bash
node --test tests/editor-assistant.test.mjs tests/editor-tools.test.mjs
```

结果：34 passed，0 failed。其中原8项保留，新26项覆盖选区、空行、输入法生命周期、词法语境、字段补全、过期光标范围、键盘退出、注释切换、GPIO配置关联、数值含义、全部现有示例的逐行输出、字面搜索、Unicode偏移、替换边界、单次input、跳行、状态提示与销毁监听器。

本轮完成时另外执行了一次`node --test tests/*.test.mjs`，结果123 passed，0 failed。收到根代理“全套回归留到最终整合”指示后，不再追加全套运行。

## 事实核对与解释边界

GPIO模式与最大输出速度档位、定时器PSC/ARR含义按ST官方RM0008核对；Arduino在INPUT状态下digitalWrite影响内部上拉的行为按Arduino官方参考核对：

- [ST RM0008 官方参考手册](https://www.st.com/resource/en/reference_manual/cd00171190-stm32f101-103-105-107-stm32f100-series-armbased-32bit-mcus-stmicroelectronics.pdf)
- [ST RM0008 官方参考手册备用入口](https://www.st.com/resource/en/reference_manual/rm0008-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)
- [Arduino digitalWrite 官方说明](https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalwrite/)

说明引擎是确定性的静态规则，不是完整C/C++语义分析或大模型代码证明。GPIO配置关联只读本函数可见的直接赋值，不证明条件分支、宏展开或函数间状态。PWM计算示例明确给定计数模式、极性和时钟条件；不会从一个数值擅自保证真实频率。ADC返回范围仍可能被运行时分辨率设置改变。真实输入法、辅助技术和浏览器原生撤销栈的跨平台行为需在目标浏览器进一步验证。
