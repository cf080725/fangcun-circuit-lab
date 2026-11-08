# 第 10 轮：布局与键盘操作独立复核

日期：2026-11-06。范围：`dist/index.html`、`dist/studio.css`、`dist/refinement.css`、`dist/resource-library.css`、`dist/catalog-ui.js`。

本轮先进行只读独立审查，随后按主代理明确委派，实施目录键盘操作和资料库样式修复。已修改的生产文件仅为 `dist/catalog-ui.js` 与 `dist/resource-library.css`，现已冻结；未操作浏览器。短屏导航、基础页面 ARIA 与真实浏览器验收由主代理完成。

## 已实施的修复与验证证据

| 已修项目 | 实现位置 | 验证证据 |
| --- | --- | --- |
| 资料库 reset 不再压过组件字号和前景色 | `resource-library.css`：基础 font/color reset 改成 `.rl-library :where(…)`。组件单类规则与 reset 同权重，按后出现的组件声明生效。 | 静态核对选择器权重与顺序；主按钮白字声明保持 `#fffef9`，预期对比度7.03:1。浏览器 computed style 与视觉验收交由主代理。 |
| 收藏、对比及清单重绘后的焦点连续 | `catalog-ui.js`：`captureListFocus()` / `restoreListFocus()` 与 `data-catalog-item-key`。按稳定条目键与控件位置恢复；移除条目后落邻项，空结果落可见动作或结果数量。BOM 数量原地规范化并保存，保留输入节点。 | 事件桩验证：收藏后原板卡控件；收藏筛选下取消后邻项、最后空态；对比 checkbox；BOM 重排后原条目；删除邻项及最后结果数量；数量改150后在原节点规范成99。 |
| saved 页使用可见焦点目标；目录分类与对比控件有明确名称/状态 | `focusCatalogStart()` 在 saved 页聚焦首个数量框或结果数量；`renderTabs()` 更新 `aria-pressed`，目录分类有 group 名称；checkbox 的 `aria-label` 包含板卡名称。 | 事件桩验证：空清单重新打开仍落可见结果数量；非空清单落数量框；三个分类恰有一个 pressed=true；checkbox 名称匹配实际 `BOARD_CATALOG` 板名。 |
| 窄屏抽屉不把焦点送进遮挡区，跨断点恢复背景 | `syncMainInert()` 监听 `(max-width:760px)`。窄屏展开时保存原 inert 值并阻止主区聚焦；关闭或回到宽屏时恢复原值。跨入窄屏时如焦点还在主区，移动到目录；原生详情 modal 打开时不抢焦点。 | 事件桩验证：窄屏展开不能聚焦主区；关闭先解除 inert 再返回主区触发器；宽→窄把背景焦点移回搜索；窄→宽恢复；关闭后 resize 不误锁主区；原本 inert=true 的主区不会被错误解除。 |

运行记录：

- `node --check dist/catalog-ui.js`：通过。
- `node --test tests/catalog-index.test.mjs tests/resource-library.test.mjs`：**25 / 25 通过**。
- `node --test tests/catalog-keyboard.test.mjs`：**1 / 1 文件测试通过，内部12 / 12键盘与状态断言场景通过**。该检查用最小 DOM 桩验证实际 `createCatalog()` 和事件处理器，没有调用浏览器、不测布局；与真实浏览器验收分别计数。
- `createCatalog()` 参数和返回 API 保持不变，既有 Esc 关闭、来源链接、选板/加元件、筛选、收藏、清单导出和比较操作继续保留。

## 原始发现与修复依据（下列行号指审查时的代码）

| 优先级 | 可追溯证据 | 问题与可触发场景 | 精确修法 |
| --- | --- | --- | --- |
| 高 | `resource-library.css:16,20,69–72`：`.rl-library button` 的 `font:inherit`、`color:inherit` 与 `.rl-button`、`.rl-button-primary` | 基础 reset 的选择器权重 `0,1,1` 高于组件单类 `0,1,0`。原生绿色主按钮常态继承深色文字，白字规则失效；单类组件的字号、字重也会被 `font:inherit` 压过。依据声明色值计算，深色 `#19372e` 在 `#256348` 上只有 **1.82:1**，预期暖白 `#fffef9` 为 **7.03:1**。hover 选择器权重更高，会造成悬停前后突变。 | 将基础规则改为 `.rl-library :where(button,input,select,a){font:inherit}` 与 `.rl-library :where(button,input,select){color:inherit}`，使后续组件声明正常覆盖；确认路线和详情原生主按钮常态白字。 |
| 高 | `catalog-ui.js:70,74–75`：`#catalogItems.innerHTML=…`；收藏与对比处理器都调用 `render()`。清单数量/删除同样在 `:66` 重绘。 | 键盘按空格收藏或勾选对比后，聚焦元素被整块替换。下一次 Tab 无法继续原来卡片操作顺序。清单数量改变后，正在输入的节点也被销毁。 | 重绘前记录控件类型、`kind` 与稳定条目 `id`，重绘后恢复相同控件；在“只看收藏”中取消收藏导致卡片消失时，落到相邻卡片或可聚焦结果标题。数量更新可原地修改，避免替换整个清单。 |
| 高 | `studio.css:6` `.catalog-drawer{position:absolute;…;z-index:35}`；`refinement.css:83,89` 窄屏 `left:62px;width:calc(100vw - 62px)`；`catalog-ui.js:59–60,89` 只有显示、关闭、Esc 和返回焦点逻辑。`index.html` 抽屉后紧接 `<main id="mainContent">`。 | ≤760px 时抽屉覆盖整个主工作区。目录底部“导出清单”之后继续 Tab 会进入被覆盖的主工作区控件，视觉焦点消失。当前 Esc 和关闭后的返回焦点已经实现，问题是展开期间的边界。 | 窄屏展开时令 `mainContent.inert=true`，关闭或跨断点恢复，并保留可见导航的操作；或采用带焦点循环的 modal drawer。已有 `#modal` 打开时不要再抢夺其焦点。 |
| 中 | `studio.css:4` `.side-rail{height:100%;display:flex;…}`；`refinement.css:15,20–22,83` 决定高度、按钮最小高与间隔；导航自身没有 `overflow-y:auto`。 | 桌面 7 个按钮最少 `7×64 + 7×7 + 2×14 = 525px`，再加页头64px，视口高低于589px时尾部“操作指南”越界。移动布局也至少需要468px导航内容，横屏更易触发。桌面 body 为 `overflow:hidden`，主内容滚动不会滚动导航。 | `.side-rail{min-height:0;overflow-y:auto;overscroll-behavior:contain}`；短屏检查最后一项可滚动到、可键盘聚焦，不能只降低文字字号。 |

## 可一并修正的焦点与标注

| 证据 | 问题 | 修法 |
| --- | --- | --- |
| `catalog-ui.js:59,64,66` | `open()` 总会 focus `#catalogSearch`，但 saved 页把搜索区 hidden。重开“已选清单”时无法把焦点送进抽屉，焦点仍在触发器。 | 只有 boards/parts 聚焦搜索；saved 聚焦当前分类按钮、首个数量框，空清单聚焦结果标题。 |
| `catalog-ui.js:61`；`index.html:16` `.catalog-tabs` | 当前分页仅通过 `.active` 体现。辅助技术无法得知当前选中“开发板/元件/已选清单”。 | 保持原生按钮，将 `aria-pressed` 随 active 同步，并用有名称的 group 包裹；若改 tab 语义，则同时实现 tablist、aria-selected、aria-controls 和方向键行为，不只添加 role。 |
| `catalog-ui.js:70` `.compare-label input` | 每张板卡的 checkbox 都仅被命名为“对比”，在控件列表里不能分辨板卡。 | 加上动态 `aria-label="将 ${name} 加入对比"`；保留 visible label。 |
| `index.html:39,56,33` | 基础 DOM 中 `#workspaceDivider` 缺少垂直方向，`#modal` 缺少关联标题，`#redoCircuitButton` 只有箭头正文（title 不会优先替换其可访问名称）。 | 分别补 `aria-orientation="vertical" aria-controls="sceneStack editorStack"`、`aria-labelledby="modalTitle"`、`aria-label="重做上一步操作"`。若应用初始化已有同等动态设置则不重复。 |

## 已检查且无需重复修复的部分

- 元件抽屉已有 Escape 关闭、关闭后返回原触发控件、`marketButton` 展开状态更新。
- `.rl-dialog` 已有 `width:min(690px,100vw)`、`max-width:100vw`、`height/max-height:100dvh`、纵向滚动与 sticky 关闭栏；没有从这些声明中发现固定宽度撑出视口的问题。
- 资料库资源网格使用 `minmax(0,1fr)`，文本列有 `min-width:0`；来源 URL 与参数值已有换行规则。不要为凑轮次增加无证据的横向溢出修复。
- 全局和资料库均有明确的 `:focus-visible` 样式；主要缺陷是节点被重绘销毁或焦点进入被遮挡区域，而非完全没有焦点环。

## 主代理验收建议

只需针对剩余风险验证：手机宽度打开商城后用 Tab 走到末尾；键盘收藏、对比及清单改数量后继续操作；低于589px高的桌面导航；资料库绿色主按钮在未 hover 时的前景色。完成这些即可，不需要扩展成新功能。

主代理真实页面验收与整合修复已经完成，结果见 `audit-round-10.md`；上文原始审查行号仅用于记录发现时状态。
