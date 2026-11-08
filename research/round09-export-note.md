# 第9轮导出专项补充：文件保全与独立读码文档

日期：2026-11-06。范围：`dist/project-export.js`、`tests/export.test.mjs`。保留`exportProject({files,boardId,format,projectName,circuit}) → {files,filename,warnings}`接口；未修改导入器、app、HTML、执行内核或电路。

## 查出的实际问题与修复

| 问题与原先可复现输入 | 原先后果 | 当前处理 |
| --- | --- | --- |
| 源码包含用户`README_源码.md`、`导出说明.json`或`接线项目.json` | 生成文件以相同键覆盖用户内容 | 原文件逐字保留。生成文件冲突时使用`*.generated-1.ext`等唯一名字，并在warnings列明实际路径；生成说明JSON记录自身及模块生成接线文件的位置 |
| 同时存在`User\\LED.c`与`User/LED.c`，或`main.c`与`MAIN.C` | 前者归一化后静默覆盖；后者可能在常用大小写不敏感系统上互相覆盖 | 统一分隔符后检查冲突，并按NFC及不区分大小写的比较键发现跨平台歧义；不猜测哪一份才是正确版本，明确报错，输入对象未修改 |
| 同时存在文件`src`与`src/main.c` | 解压时同一路径既要求是文件又要求是目录 | 同时检查父子路径冲突，拒绝生成含这种矛盾的包 |
| `/main.c`等绝对路径被去掉前导斜线，`./main.c`、尾随句点/空格或Windows设备保留名被直接导出 | 可能被悄悄解释成另一个文件，或在目标IDE系统无法落盘 | 拒绝绝对、点目录、空目录、控制字符及不可移植保留名称。合法反斜杠分隔符仍可转换成ZIP路径。项目名恰为CON之类名称时加Project_前缀 |
| Arduino输入有`sketch.ino`和`Blink.ino`，projectName为Blink | 首个文件改为`Blink.ino`后，与另一份源文件发生覆盖 | 在真正写入目标路径前检测碰撞，明确报错并保留输入；不通过覆盖另一份源码来假造成功导出 |
| 文件名为`__proto__`等对象属性名 | 普通对象赋值可能没有创建真正的文件键 | 使用自有数据属性写入，完整保留该文件且不修改对象原型 |
| app逐行在C/C++行尾追加`// 白话` | C++ raw string内的“注释”其实成为字符串内容；程序语义会改变。宏续行及复杂注释也不应依赖单行启发规则处理 | 提供独立`.txt`读码文档生成器。源码区域保留输入原文，解释按原物理行号放在单独区域；不改写任何C/C++行 |

例如，原先将下面第一行尾部追加`// ...`，该内容仍在raw string内，并非C++注释：

```cpp
const char *text = R"tag(first line
second line)tag";
```

目前`createReadingGuide`生成的是阅读文档，不再尝试制作可编译的“内联注释副本”。原始源文件与阅读文档使用不同路径和后缀。

## 新增集成接口

### appendExportFile

```js
const actualPath = appendExportFile(
  built.files,
  'physical-lab-circuit.json',
  JSON.stringify(fullProject, null, 2),
  built.warnings
);
```

函数把附加材料写入传入的文件集合，返回实际路径。已存在的文件不覆盖；如果同名文件占用，按扩展名前加入`.generated-1`、`.generated-2`等寻找空位。例如`physical-lab-circuit.generated-1.json`。

如果父目录本身被文件占用，例如已有文件`阅读说明`，则把生成目录改为`阅读说明.generated-1/`。警告会给出完整实际路径。

调用者应在传给JSZip前统一使用该接口加入备份、文档等生成材料。单独继续调用`zip.file(fixedName, ...)`仍可能在调用者层覆盖同名用户文件，这不属于底层函数能够自动拦截的操作。

### createReadingGuide

```js
const reading = createReadingGuide(source, (line, lineNumber, fullSource) => {
  return explanationForThatOriginalLine;
});
appendExportFile(
  built.files,
  '阅读说明/' + originalPath + '.txt',
  reading,
  built.warnings
);
```

返回纯字符串。完整源代码区保留原始字符串，包括CRLF、反斜杠、raw string和注释；后续说明区列出原始物理行号、该行原文的JSON转义显示、白话及可选专业解释。解释回调抛出异常时，该行显示未生成确定说明，不影响原始代码保全。

## 导入配套注意

固定备份名发生碰撞后，导入器可以识别：

```js
/^physical-lab-circuit(?:\.generated-\d+)?\.json$/
```

如果ZIP同时包含多份有效旧工程备份，仅仅取第一个匹配名称会恢复错误版本。应依照实际备份路径的显式元数据，或让用户在有效备份中选择；不要把“名称看起来像备份”当作内容可信、版本最新或已验证的证据。导出模块自身生成的说明JSON带`generatedFiles`字段，记录本模块的说明/接线文件实际路径；app额外加入的完整工程备份需要app自行关联。

## 验证

本次完整保留先前17项多板与导出测试，新增7项导出测试。执行：

```bash
node --test tests/export.test.mjs tests/multiboard.test.mjs
```

结果：24 passed，0 failed。

新增断言覆盖：用户README/JSON不变、冲突文件名与父子路径、NFC/大小写、绝对和Windows保留路径、Arduino改名碰撞、附加备份多次撞名、父目录被文件占用、特殊对象属性文件名、raw string/宏续行/CRLF原文保全、原始行号及仅生成非源码后缀的阅读文档。

本专项没有执行新的全仓回归，按根代理要求留给最终整合。仍没有声称这些IDE工程在真实Keil、Arduino IDE或PlatformIO中构建、烧录、验证成功；本轮解决的是文件保全与可复现导出行为。

## 最终导入复核：ZIP 折叠前校验与电机数值约束

独立复核确认：JSZip 在 `loadAsync` 时已经把 `../main.c` 消除父目录，并用后读入的同名条目替换先前条目。加载完再看 `zip.files`，无法可靠发现已经丢掉的源文件；正反两种条目顺序都需要在加载前拦截。[JSZip 官方 loadAsync 文档](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html) 明确说明了同名替换及 `unsafeOriginalName` 行为。

新增 `dist/zip-validation.js` 按 [PKWARE APPNOTE 6.3.10](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT) 检查原始字节，再允许 `readImportSelection` 调用 JSZip：

- 校验目录结尾、中央目录长度与偏移、条目数量、记录长度、本地头偏移、原始文件名字节和数据范围；不允许文件重叠或未识别的附加区。
- 检查全部原始条目，包括不参与编译的文件：拒绝父目录、绝对路径、不安全路径，以及重复、大小写、NFC、分隔符归一化或文件/目录互斥冲突。
- 本地头与中央目录名称、压缩方式、标志、CRC、大小必须一致；带数据描述符的普通 ZIP 验证描述符后继续读取。
- 只接收 STORE/DEFLATE、UTF-8 或纯 ASCII 文件名。ZIP64、多盘、加密、符号链接、非 UTF-8 的非 ASCII 档名和不支持的附加结构均明确拒绝，不猜测编码。源码内容仍保留原有 GB18030 兼容解码与警告。
- 加载后再次核对文件集合、原始名 `unsafeOriginalName` 及声明大小；实际展开的源码/项目备份逐份复核字节长度与 CRC，避免导入损坏代码。
- `physical-lab-circuit.generated-N.json` 可以恢复完整工程；同包有多份项目备份时明确报错，不暗中选择某一版。

`readImportSelection` 的调用接口不变；给 `loadZip` 回调的数据改为已验证的 `Uint8Array`。当前应用的 `data => JSZip.loadAsync(data)` 兼容该输入。

电机同时设置 `backEmf = 0` 和 `friction = 0` 时，现有模型出现零总阻尼，会产生非有限转速。导入验证现明确拒绝这一未实现的极限组合；其中单独一个系数为零仍可通过。校验不会修改传入对象。

定向验证命令：

```bash
node --test tests/project-import.test.mjs
```

结果为 **19 passed，0 failed**，保留原有 10 项测试并新增 9 项。ZIP 回归实际使用仓库当前 vendored JSZip，覆盖同名条目和 `../` 折叠的正反顺序、在调用解包器前拒绝、正常 STORE/DEFLATE/流式描述符与中文文件名、目录越界和截断、原始名篡改、数据 CRC 损坏、备份识别、电机零阻尼组合。没有运行全仓测试；完成后冻结生产文件。
