# 命令手册

这份文档记录 `pnpm ds` 各子命令的用法、产物和格式约定。
运行或修改某个命令前，先读它那一节，不用读完全文。
改了命令的行为，同一个提交里改这里。
各模块的细节写在对应源文件的文件头。
需要 Node 22.18 及以上和 pnpm 12（`packageManager` 字段会自动切换版本）。

## 安装

先运行 `pnpm install`。
再运行 `pnpm exec playwright install --with-deps --only-shell chromium`，只需 Chromium headless shell。

## `pnpm ds build`：构建并检查

`pnpm ds build --system <体系目录> --work <作品描述.json> --out <产物目录> [--library <共享资产目录>]`。

### 产物与静态渲染

- 产物目录里有 `index.html`、`fonts/`、渲染出的 PNG、`report.json` 和 `report.md`。
- 网页作品输出两张整页截图：`web-desktop.png`（宽 1440）和 `web-mobile.png`（宽 390）。
- 网页作品输出加载并滚动到底的录屏 `web-scroll.webm`。
- 检查器在两个宽度上各跑一遍，只在手机宽度出现的问题会在说明末尾标注。
- 网页按滚动才显示的内容，要在 `html[data-render="static"]` 下直接显示。
- 截图和检查时页面带静态渲染标记，录屏时没有。

### 网页验收截图

- 网页作品构建和 `regress` 的网页作品产物自动包含分段截图、首屏入场抽帧拼图及 `web-qa.json`。
- 桌面分段命名为 `web-segment-desktop-001.png` 起，宽 1440px，每段高 900px。
- 手机分段命名为 `web-segment-mobile-001.png` 起，宽 390px，每段高 844px。
- 分段沿用静态渲染标记，入场拼图与录屏一样不带该标记。
- 分段从静态整页 PNG 自上而下裁出，末段只保留剩余高度，不补白、不重复固定定位内容。
- 重建时先清除同宽度的旧分段，避免页面变短后残留多余文件。
- `web-entrance.png` 是桌面首屏入场抽帧拼图，每行三格，每帧缩至 480×300px。
- 抽帧在现有真实录屏时同步进行，从导航前的初始画面开始，覆盖首屏入场及其后 800ms 停留。
- 目标帧间隔为 200ms，最后一帧取停留结束后的下一个采样点。
- 每格标出相对抽帧开始的实际毫秒时刻，截图耗时可能使采样延后。
- `web-qa.json` 记录分段尺寸、拼图尺寸、帧数、目标间隔、计划时刻、实际时刻和截图耗时。
- 入场等待仍有 10000ms 上限，超时后的拼图仅覆盖截至上限及停留的画面，不保证无限或暂停动画结束。
- 抽帧只用 Playwright 的 Chromium 截图和 Node，不从录屏解码，不需要 ffmpeg、Python 或新增依赖。

### 共享资产目录

- `--library` 默认是当前目录下的 `library/`。
- 共享资产目录放结构骨架 `skeleton/<载体>.json` 和字体清单 `fonts/manifest.json`。
- 共享资产目录可放共享内容 `content/<载体>.json`，作品描述用 `{"ref": "键名"}` 引用。

### 定制片段文件

- 作品描述的 `custom` 可写内嵌 HTML 字符串或 `{"file": "fragments/hero.html"}`。
- 文件引用指向体系目录下 `works/fragments/*.html`，路径相对体系的 `works/`。
- 文件路径必须以 `fragments/` 开头、以 `.html` 结尾。
- 文件路径不能含 `..`，不能是绝对路径。
- 符号链接解析后必须仍在 `works/fragments/` 内。
- `serves` 照常必填。
- 文件不存在、路径不合规或文件为空，按作品描述错误处理（退出状态 2）。
- 规则见 `src/work.ts` 文件头。

### 作品图像简报

#### 简报声明与查找

- 作品描述可在顶层写 `"images": {"film-poster": {"brief": "电影季海报", "alt": "电影季海报"}}`。
- 作品图像简报的结构和全库 `content/images.json` 一致。
- 图像标识只用小写字母、数字、连字符，并以字母开头。
- `brief`、`alt` 均为非空字符串。
- 图像槽位先查作品简报，再查全库简报。
- 同名时作品简报整体优先，便于作品使用自己的图意和替代文字。
- alt 仍受槽位字数上限约束。

#### 定制片段的图像引用

- 定制片段（内嵌或文件）可用 `<img src="images/film-poster.svg" alt="电影季海报">` 引用当前体系 `images/` 下的文件。
- 构建按精确文件名复制到产物 `images/`。
- 片段引用的图像标识必须有作品或全库简报。
- 片段 alt 保留原文。
- 图像引用支持扩展名 `svg|webp|png|jpg|jpeg|avif|gif`。
- 图像引用不支持子目录、查询参数、锚点。
- 符号链接解析后须留在体系 `images/` 内。
- 注释、脚本和样式文字不作为图像引用。
- 外部或 data URL 沿用现有行为。
- 简报格式错误、缺简报、缺文件或路径不合规均在渲染前报作品描述错误（退出状态 2）。
- 规则见 `src/work.ts`、`src/assets.ts` 文件头。

### 录屏入场等待

- 网页在首屏可见入场全部结束后再停留 800ms，才开始滚动。
- 幻灯片每页在翻页及该页入场结束后停留 600ms，再翻下一页。
- 等待覆盖字体就绪、额外等待、错峰和独立透明度计时。
- 录屏保留动画的真实播放，不快进。
- 每屏／页等待上限为 10000ms，包含字体等待。
- 等待上限为现有 3000ms 初始字体窗口和后续错峰入场、翻页预留 7000ms。
- 等待上限避免字体停滞、暂停／无限动画或未完成的入场钩子卡住录屏。
- 超时后照常停留并继续。
- 网页只等首屏可见的动画，屏外动效不阻塞。
- 静态截图、PDF 和检查结果不受影响。
- 实现见 `src/render.ts`、`src/web.ts`、`src/slides.ts` 文件头。

### 入场动效

- 排法和定制片段里给元素写 `data-ds-enter="fade|rise|fall|left|right"`。
- 可选 `data-ds-order` 表示组内顺序。
- 可选 `data-ds-stagger` 写在组容器上。
- 可选属性还包括 `data-ds-step`、`data-ds-ease`、`data-ds-distance`。
- 取值名都来自体系的时长阶梯、缓动集、错峰和间距。
- 用法见 `src/choreography.ts` 文件头。
- 检查器在正常和「减少动态效果」两种条件下记录动画并检查动效规则（`src/checker/rules/motion.ts`）。

### 入场初始状态

- 页面头部脚本在解析正文前启用待入场状态。
- 普通入场元素及其整个子树隐藏但保留布局。
- 后代显式声明 `visibility: visible` 也不会提前显露。
- 动画建立后才解除隐藏。
- 屏外批次等进入视口才入场。
- 翻页目标等翻页停稳才入场。
- 回访时重新准备入场。
- 揭去覆盖层及其子树保持盖住内容。
- 未运行脚本或缺少 Web Animations 支持时，普通内容直接可见、覆盖层隐藏。
- 头部初始化后到 DOMContentLoaded 后 3000ms 仍未登记运行时时，普通内容直接可见、覆盖层隐藏。
- 未激活幻灯片时显示第一页。
- 脚本错误或未处理的 Promise 拒绝也释放隐藏并取消入场动画，避免内容永久隐藏。
- 静态渲染绕过待入场状态。
- 打印不应用屏幕隐藏规则。
- 减少动态效果沿用原有退化和字体等待规则。

### 初始入场等字体

- 网页首屏批次和幻灯片初始页（含 URL hash 指定的页）先触发布局以发现使用的字体。
- 初始入场再等 `document.fonts.ready`，最多等 3000ms。
- 字体等待给大体积中文字体留出浏览器通常的字体阻塞窗口，超时避免网络停滞让内容一直隐藏。
- 等待时普通入场元素及其整个子树隐藏但保留布局。
- 等待时揭去覆盖层保持盖住内容。
- 字体就绪或超时后按原来的顺序、错峰和时长播放。
- 超时后字体到达不会重播。
- 字体等待对正常和减少动态效果均适用。
- `dsSlides.entered()` 包含初始字体等待。
- 滚动后续批次和翻页后的入场不额外等待。
- 静态截图、PDF 和检查器快照绕过等待。

### 透明度独立计时

#### 声明与默认值

- 体系可在数值文件根部的 `$extensions["io.github.jinhaofang.design-system"].entrance.opacity` 声明 `{"step":"quick","ease":"settle"}`。
- 两个名字分别取自 `ratio.duration` 和 `easing`，例子只在体系有这些名字时可用。
- 元素用 `data-ds-opacity-step`、`data-ds-opacity-ease` 单独覆盖。
- 元素未覆盖的字段先取体系默认。
- 没有体系默认则沿用该元素的位移计时。
- 体系和元素都未声明时行为不变。
- fade 与减少动态效果也沿用现有行为。
- 未知名字在构建前校验失败（退出状态 2）。

#### 播放与记录

- rise/fall/left/right、draw-*、stamp、peel-* 的 transform 与 opacity 分为两条动画。
- 两条动画共用「名次 × 错峰 + 额外等待」。
- 两条动画各自按时长和缓动运行。
- draw 同时淡入。
- peel 同时淡出。
- `motion.json` 分别记录两条动画。
- `dsSlides.entered()` 等两条都结束。
- 幻灯片翻页目标的揭去覆盖层（含子树）保持可见、盖住内容。
- 揭去覆盖层回访前恢复盖住状态，停稳后才揭去。
- 截图和 PDF 仍使用已揭去的终态。

### 额外等待

- 元素可写 `data-ds-wait="slow"`，取值为体系 `--ds-duration-*` 的名字，`slow` 仅在体系有此档时可用。
- 不写时额外等待为 0。
- 实际延迟为「组内名次 × 错峰 + 额外等待」。
- 额外等待只影响声明它的元素，同组其他元素照常开始。
- 标题用 `data-ds-step="slow"` 时，下划线可用 `data-ds-enter="draw-x" data-ds-order="1" data-ds-wait="slow"` 等标题完成后再划出。
- 额外等待适用于网页加载和滚动触发、幻灯片首屏及翻页停稳后的入场。
- `dsSlides.entered()` 等待包含额外等待在内的所有入场结束。
- 减少动态效果时去掉额外等待和错峰。
- 未知名字在渲染前校验失败（退出状态 2）。
- 错误列出名字、序列项和对应元素的起始标签。
- `motion.json` 的 `delayMs` 记录合计延迟。

### 另有三种动作

#### 动作与触发

- `data-ds-enter="draw-x"` 从左到右划出（左端起笔，scaleX 从 0 到自然尺寸）。
- `draw-y` 从上到下划出（顶端起笔，scaleY）。
- `stamp` 按下落定（放大后缩回自然尺寸，同时淡入）。
- `peel-left|peel-right|peel-up|peel-down` 揭去覆盖层（沿所写方向移出自身尺寸的 100%，结束后保持离开）。
- 这三种动作同样支持顺序、错峰、时长和缓动属性。
- 网页按滚动触发这三种动作。
- 幻灯片按进页触发这三种动作。
- `stamp` 要求体系数值文件声明 `"motion":{"stampScale":{"$type":"number","$value":<大于1的有限数字>}}`。
- `stampScale` 生成 `--ds-motion-stampScale`，不乘载体基准值。
- `stampScale` 缺少、类型错误或值不合规会在渲染前报错（退出状态 2）。
- 动作元素应支持 transform，文字用块或 inline-block 元素。
- 覆盖层的定位和裁切由排法或定制片段声明。

#### 减少动态效果与静态终态

- 减少动态效果时划出直接呈现完成状态。
- 减少动态效果时按下落定只淡入。
- 减少动态效果时揭去只淡出。
- 减少动态效果时淡入淡出取最短时长并去掉错峰。
- 静态渲染（`data-render="static"`，包括社交配图）同步把覆盖层设成终态。
- 正常播放以 `fill:both` 保留揭去的终态，完成后隐藏覆盖层及子树。
- 检查器不把已隐藏的覆盖层及子树计入对比度或构图。
- 打印样式让所有覆盖层及其子树处于已揭去状态，供 PDF 使用。
- 打印的已揭去状态包括未访问的幻灯片和正在翻页的目标页。
- 打印时普通入场内容照常显示。
- 打印时翻页的位移、投影和暗影照常清除。

#### 动画记录

- 网页和幻灯片的动画记录统一只存入 `motion.json`（`{animations,reduced}`）。
- `report.json` 只存检查结论，不重复记录动画。
- `buildAndCheck()` 返回路径 `artifacts.motionJson`。
- 动画记录包含正常和减少动态效果两种偏好下的动画。
- 记录字段含 `entrance`、`durationMs`、`delayMs`、`easings`、`properties`、`keyframes` 及位置。
- 动画记录可用于核对时长、缓动、属性和缩放倍数。

### 幻灯片翻页

#### 配置

- 体系目录可放 `slides.transition.json`。
- 翻页配置的五个必填字段均引用该体系生成的 CSS 变量。
例如 `{"duration":"--ds-duration-slow","easing":"--ds-easing-settle","shadow":"--ds-shadow-page","shadeColor":"--ds-color-page-shade","retreat":"--ds-space-4"}`。

- `duration` 引用时长阶梯。
- `easing` 引用缓动集。
- `shadow` 引用左缘投影。
- `shadeColor` 引用带透明度的暗影色，alpha 控制深浅。
- `retreat` 引用间距阶梯，表示后退像素距离。
- 不存在或类型不符的引用、缺字段、未知字段按校验失败处理（退出状态 2）。

#### 播放与产物

- 未声明翻页配置时瞬间切换。
- 向前从右侧进入一页宽度，向后镜像。
- 减少动态效果时直接切换。
- 页内 `onEnter` 钩子和 `ds:slide-enter` 在翻页停稳后触发。
- `dsSlides.entered()` 等翻页和页内入场全部完成。
- 连按时取消上一轮过渡与旧页入场、清理位移和暗影，再翻到最新目标，等待会跟随最新一轮。
- 截图、PDF 用终态，录屏保留真实过渡。
- 幻灯片产物新增 `motion.json`，分别保存正常和减少动态效果的动画记录。
- 模块约定见 `src/slides-transition.ts`、`src/slides-runtime.ts` 文件头。

### 退出状态

- 0 表示没有错误，只有警告也是 0。
- 1 表示报告里有错误。
- 2 表示体系或作品描述校验失败、没有报告，原因打印在 stderr。

### 试跑夹具

`pnpm ds build --system test/fixtures/systems/mini --work test/fixtures/works/clean.json --out out/clean --library test/fixtures/library`。

## `pnpm ds validate-system`：校验体系

`pnpm ds validate-system --system <体系目录> [--library <共享资产目录>]`。

- 本命令只跑体系校验：SYSTEM.md、数值文件、字体引用、体系专属单元。
- 本命令一次列出全部问题。
- 退出状态 0 通过，2 失败。
- 体系格式见 `src/system.ts`、`src/tokens.ts` 文件头。
- 体系专属叙事单元放在体系目录的 `skeleton/<载体>.json`。

## 测试内容

- 测试内容放在 `library/content/`，设定见 `SETTING.md`。
- 共享内容文件为 `web.json`、`slides.json`、`social.json`。
- 内容键名为 `<单元>.<槽位>` 或 `<单元>.<实例>.<槽位>`。
- 图像槽位只写图像标识。
- 图像简报清单在 `images.json`。
- 图片由各体系自己提供，放在体系目录的 `images/<标识>.<svg|webp|png|jpg>`。
- 构建时按作品用到的标识查找图片并复制进产物的 `images/`。
- 缺图片就报错并列出全部缺少的标识。

## `pnpm typecheck`：类型检查

`pnpm typecheck`。

## `pnpm verify`：完整验证

- `pnpm verify` 由 `scripts/verify.ts` 按 `STEPS` 的顺序逐步运行。
- 每步先打印 `[verify]` 标签。
- 前一步失败就停止，并保留该命令的退出码。
- 全部通过时以 0 退出。
- 新增检查只在 `STEPS` 中加一项，例如 `{ label: '检查名称', command: ['pnpm', '对应脚本名'] }`。
- 新增检查放在类型检查之后、测试之前。
- 新增检查同时在 `package.json` 登记对应的独立脚本。

## `pnpm check:comments`：注释位置检查

`pnpm check:comments [仓库根目录]`，默认当前目录。

- 只扫描进 git 的 `.ts`、`.mts`、`.cts`、`.js`、`.mjs`、`.cjs` 工作区文件。
- 扫描包括体系图像生成脚本和进 git 的执行技能脚本。
- 未跟踪文件、`.liquid`、`.css` 不查。
- 可选 shebang 后只允许第一段块注释或连续行注释。
- 空行隔开的第二段和其他位置的任何注释（包括指令注释）都报出 `文件:行 说明`。
- 字符串、模板文本和正则里的类似文字不算注释。
- 退出状态 0 通过、1 违规、2 用法或运行环境错误。
- `--help` 打印用法。
- 语法树扫描用固定的 `typescript-parser` 别名（TypeScript 6.0.2 compiler API）。
- 类型检查仍用 TypeScript 7。

## `pnpm check:doc-commands`：文档命令检查

`pnpm check:doc-commands [仓库根目录]`，默认当前目录。

- `--help` 查看用法。
- 扫描进 git 的根部规则文档：`AGENTS.md`、`CLAUDE.md`、`README.md`、`GLOSSARY.md`。
- 扫描 `docs/` 下除 `reports/` 和 `adr/` 以外进 git 的 Markdown。
- 扫描 `.agents/skills/`、`.claude/skills/` 下进 git 的 Markdown。
- 扫描只看反引号里的内容，含代码块。
- `pnpm` 命令须是项目脚本或 `scripts/pnpm-builtins.ts` 的内置命令快照。
- 快照版本须与 `packageManager` 一致，升级时按该文件头的方法更新。
- `pnpm ds` 的子命令须在 `src/cli-commands.json` 中，CLI 与检查器共用此表。
- 检查器不检查子命令的参数和选项。
- `node` 后的相对文件路径必须进 git，并且在工作区里实际存在、可读，软链接要能解析到文件。
- 忽略的第三方路径、选项、占位符、动态路径和绝对路径跳过。
- 命令只当文本分析，不执行。
- 输出扫描文件数、命令数（含跳过项）和跳过数。
- 违规逐条指出 `文件:行 命令 原因`。
- 退出状态 0 通过、1 违规、2 用法或运行环境错误。

## `pnpm check:cli-lines`：命令手册长行检查

`pnpm check:cli-lines [文件路径]`，默认只检查当前目录下的 `docs/cli.md`。

- 可选文件路径用于临时文件实测和夹具测试，不扩大默认检查范围。
- `--help` 打印用法。
- 每条正文事实单独一行，物理行上限为 160 个 Unicode 字符（码点）。
- 长度包含 Markdown 标记和空白，不包含行尾换行符。
- 表格行（含省略首尾竖线的表格）、反引号或波浪号围栏代码块、缩进代码块不检查。
- 超长行逐条在 stderr 报出 `文件:行 长度 N 个字符，超过上限 160。`。
- 退出状态 0 通过、1 违规、2 用法或运行环境错误。
- `pnpm verify` 在测试前以 `[verify] 命令手册长行检查` 标签运行本项。
- CI 运行同一个检查命令。
- 入口测试在 `test/check-cli-lines.test.ts`，通过命令驱动临时 Markdown 夹具，只断言退出码和输出。

## 提交信息钩子

- `pnpm install` 的 `prepare` 自动把 Git 的仓库配置 `core.hooksPath` 设为相对路径 `.githooks`。
- 多个 worktree 共享该配置，各自使用自己的钩子文件。
- 可用 `node scripts/install-hooks.ts` 重新启用钩子。
- 提交时 `.githooks/commit-msg` 调用 `node scripts/commit-msg.ts <提交信息文件>`。
- 钩子按 `AGENTS.md` 检查类型、非空范围（内容不限）、中文摘要、正文和最后一段的 `Refs`/`Role`。
- 钩子禁止署名行，一次列出全部违规。
- 合并进行中（存在 `MERGE_HEAD`）跳过检查。
- 钩子忽略编辑器中以 `#` 开头的行及剪刀线以下内容。
- detached HEAD 的分支名视为空。

## `pnpm check:commits`：提交信息检查

### 本机复现 CI

- 本机复现示例为 `pnpm check:commits origin/main ticket/36`。
- 通用形式为 `pnpm check:commits <起点> <来源分支名>`。
- 只检查 `起点..HEAD` 的非合并提交，使用最终信息，保留 `#` 行和剪刀线。
- 按完整提交号报告违规。
- 起点之前的旧提交不检查。
- CI 拉取完整历史，PR 用来源分支名，推送用当前分支名。
- CI 在独立步骤中运行提交信息检查。
- 本项不加入 `pnpm verify`。

### 退出状态与测试

- 退出状态 0 通过、1 提交信息违规、2 用法或运行环境错误。
- 各入口支持 `--help`。
- 入口测试在 `test/commit-checks.test.ts`，用提交信息文件和临时 Git 仓库驱动钩子及分支检查命令。

## 检查命令辅助

- `scripts/cli.ts` 的 `runCheckCommand(usage, check)` 接收用法和参数处理函数，后者返回全部违规消息。
- 入口把返回值赋给 `process.exitCode`。
- `--help` 打印中文用法并以 0 退出。
- 参数错误用 `usageError('中文原因')` 抛出，也可用 Node 的 `parseArgs`，其参数错误会统一转为中文。
- 参数错误打印原因和用法，以 2 退出。
- 违规逐条打印到 stderr，以 1 退出。
- 运行环境错误打印中文原因，以 2 退出。
- 现有 `ds` 命令的约定保持不变。

## 范例库格式

- 每条范例一个目录 `library/exemplars/<id>/`。
- 范例目录里是 `exemplar.json` 和媒体文件（截图或录屏）。
- 目录名必须等于 `id`。

### 字段

- `id` 是范例标识。
- `title` 是范例标题。
- `sourceType` 取 `external`（外部收集）、`copy`（临摹）、`original`（原创）。
- `sourceUrl` 在外部收集和临摹时必填。
- `copyright` 记录版权方。
- `carrier` 取 `web` / `slides` / `social`。
- `systems` 记录支撑哪些种子体系，如 `paper-editorial`、`riso-print`。
- `media.kind` 取 `screenshot` / `recording`。
- `media.status` 为 `present` 时 `file` 必须存在。
- `media.status` 为 `pending` 表示待补，已批准的范例不能是待补。
- `annotation.highlights` 记录出色之处。
- `annotation.reasons` 记录原因。
- `annotation.scenes` 记录适合的场景。
- `annotation.materialAnchor` 记录材质锚点。
- `annotation.tonality` 记录调性位置。
- `approval.status` 取 `candidate` / `approved` / `rejected`。
- 已批准和已拒绝必须带 `approval.date`，格式 `YYYY-MM-DD`。
- 候选不带 `date`。

### 调性与确认权限

- `tonality` 有五个键：`静动`、`疏密`、`冷暖`、`轻重`、`庄谐`。
- `tonality` 值为 1–5。
- 值 1 靠近键名第一个字（静、疏、冷、轻、庄）。
- 值 5 靠近键名第二个字。
- agent 只提交候选（`approval.status` 为 `candidate`），批准和拒绝由裁判决定。

## `pnpm ds validate-exemplars`：校验范例库

`pnpm ds validate-exemplars [--library <目录>]`。

- 退出状态 0 表示全部完整。
- 退出状态 1 表示有问题，逐条打印在 stderr，写明范例标识和字段。

## `pnpm ds list-exemplars`：按来源类型列出范例

`pnpm ds list-exemplars [--source external|copy|original] [--paths] [--library <目录>]`。

- 默认每行一条，字段为标识、来源类型、批准状态、载体、来源链接、媒体文件，制表符分隔。
- `--paths` 只打印存在的媒体文件路径。
- 仓库公开之前运行 `pnpm ds list-exemplars --source external --paths | xargs rm` 移除外部截图。
- 移除外部截图后，把相应范例的 `media.status` 改成 `pending`。

## 感觉词词典格式

### 文件与词条字段

- 每个词一个文件 `library/lexicon/<id>.json`。
- 文件名（拼音）必须等于 `id`。
- 格式见 `src/lexicon.ts` 文件头。
- 词条的 `id` 是词条标识。
- 词条的 `word` 是感觉词本身。
- 词条的 `phrasings` 记录需求方常见说法，至少一条。
- 词条的 `interpretations` 记录解读，至少两种。
- 同一个词内的解读不能重复 `name` 和 `materialAnchor`。

### 解读字段

- 解读的 `name` 是解读名。
- 解读的 `description` 用大白话，落到色彩、字体、版面、动效等具体决定上。
- 解读的 `materialAnchor` 是材质锚点。
- 解读的 `tonality` 五个键同范例，值为 1–5。
- 解读的 `composition` 记录构图比率倾向。
- `composition` 有 `跳跃率`、`版面率`、`图版率` 三个键，值为 `低` / `中` / `高`。
- 解读还包含 `recommendation`、`samples`、`approval`。

### 推荐体系 `recommendation`

- 种子体系推荐写作 `{"system": "paper-editorial" | "riso-print"}`。
- 临时方向写作 `{"system": "临时方向", "borrowLayoutsFrom": <种子体系>, "direction": <一句话方向>}`。
- `borrowLayoutsFrom` 只接受这两套种子体系，指向已移除体系时校验失败。

### 样图 `samples`

- 样图待补写作 `{"status": "pending"}`。
- 样图已提供写作 `{"status": "present", "exemplars": [范例标识...]}`。
- 样图标识必须在 `library/exemplars/` 中存在。
- 样图可以在任何确认状态下待补。

### 确认 `approval`

- 词典按解读逐条确认，格式同范例。
- 候选不带 `date`，已批准和已拒绝必须带 `YYYY-MM-DD`。
- 词典由 agent 负责确认，授权来自需求方 2026-10-11，原因是需求方不是设计领域的。
- 新解读先以候选提交。
- agent 按美学立场和工艺规范审过后改为批准或拒绝。
- 与工艺规范冲突的解读（纯黑纯白、写实贴图、等大卡片、应用界面）改写或拒绝。

## `pnpm ds validate-lexicon`：校验感觉词词典

`pnpm ds validate-lexicon [--library <目录>]`。

- 退出状态 0 表示全部完整。
- 退出状态 1 表示有问题，逐条打印在 stderr，写明词条标识和字段。

## `pnpm ds list-lexicon`：列出感觉词解读

`pnpm ds list-lexicon [--status candidate|approved|rejected] [--system <种子体系>|临时方向] [--library <目录>]`。

- 每种解读一行，字段为词条标识、词、解读名、推荐体系、确认状态、样图标识或「待补」，制表符分隔。
- 状态或体系写错时退出状态 2。

## `pnpm test`：测试

`pnpm test`。

### 并发与 CI

- 测试文件并发数取可用 CPU 核数（含 `taskset` 的限制）和 4 的较小值。
- 普通单测和钩子时限为 60 秒。
- 多载体回归成功用例时限为 120 秒。
- `pnpm test --reporter=verbose` 可查看逐用例耗时。
- CI 工作流可手动触发。
- CI 输出实际资源和逐用例耗时。
- CI 失败时保存检查报告、动效记录为 `test-reports` 产物。
- CI 不自动重试。

### 测试入口与断言

- 构建测试通过 `buildAndCheck()`（`src/build-and-check.ts`）驱动夹具体系和夹具作品，`src/cli.ts` 是它的薄封装。
- 构建测试也可通过 `buildAndCheck()` 之上的 `buildOverview()`（`src/overview.ts`）、`regress()`（`src/regress.ts`）驱动同类夹具。
- 构建测试断言报告和产物规格，不测内部函数，不做像素比对。
- 预览导航通过 `navigationPage()` 驱动产物夹具。
- 体系总览页通过 `buildSystemPage()` 驱动夹具体系。
- 导航与体系总览页测试可断言分组计数、展开按钮与目标、载体页签和静态渲染全部展开。
- 范例库测试在 `test/exemplars.test.ts`，通过 `validateExemplars()`、`listExemplars()` 两个入口及 CLI 命令驱动临时目录里的范例。
- 开发护栏测试通过最小命令驱动夹具，只断言退出码和输出。
- 共享命令行辅助测试在 `test/cli-helper.test.ts`。
- 注释位置检查测试在 `test/check-comments.test.ts`，对临时 git 仓库运行检查命令。

## `pnpm ds overview`：排法总览

`pnpm ds overview --system <体系目录> --out <产物目录> [--library <共享资产目录>] [--carrier <载体>...] [--canvas <画幅>...]`。

- 本命令为任意体系生成网页、幻灯片各一件，按骨架顺序让每个单元的每种排法依次出现一次。
- 本命令为社交配图的每个画幅、每种排法生成一张。
- 内容取共享内容里该单元的第一个实例。
- 内容只用 `{"ref": 键名}` 引用，不依赖具体键名。
- 每件作品走一遍「构建并检查」。
- 产物在 `<载体>/` 和 `social/<画幅>/<单元>-<排法>/` 下。
- `overview.md` 汇总各构建的错误和警告数。
- 体系没有排法或共享内容没覆盖的单元列为「未覆盖」，不算错误。
- 退出状态同 `build`，有构建失败也是 1。

## `pnpm ds system-page`：体系总览页

`pnpm ds system-page --system <体系目录> --out <产物目录> [--library <共享资产目录>] [--overview-dir <排法总览目录>] [--works-dir <体系样张目录>]`。

### 页面内容

- 本命令为任意体系生成一页交互页面，与 `overview` 排法总览用途不同。
- 页面用体系自己的数值、字体和质感排版。
- 页面展示意图与关键规则，关键规则有规则、理由、适用边界三列。
- 页面展示体系样张、排法、材质锚点。
- 色彩按名称前缀归组成色带，SYSTEM.md 的色彩表是图例。
- 字体按字体家族分块，包含样句、已加载字重并排、一行授权、角色对应。
- 字阶一档一行，大字号样本截断。
- 页面展示间距与圆角阶梯、版面、质感与识别符号。
- 动效部分每种入场方式、每档时长、每条缓动、错峰都有重放按钮。
- 时长、缓动格子带 SYSTEM.md 表里的「用在」。
- 页面上有「减少动态效果」开关。
- SYSTEM.md 里的表格渲染成表格。
- 排法表的表头含「排法」「说明」，行如 `` `id` 中文名 ``，给每种排法配中文名和说明。
- 排法的中文名和说明不再在版面里重复。

### 排法缩略图与链接

- `--overview-dir` 是排法总览的产物目录。
- 社交配图的每种排法显示对应构建的缩略图并链到该构建。
- 社交配图缩略图优先小红书画幅，没有则取第一个画幅。
- 社交配图缩略图框按所选画幅比例。
- 网页从排法总览的 1440 宽静态页面按每个单元的完整区域截图。
- 网页排法截图存入 `layout-thumbnails/`，截图宽度等于该单元宽度。
- 网页排法页面缩略图统一放入 4:3 框。
- 网页排法缩略图先按框宽等比缩放，宽 100%、高 auto。
- 网页排法缩略图使用 `object-fit: cover; object-position: top center`，由框裁去底部。
- 网页排法缩略图完整保留左右边缘，较矮图片在框底留空。
- 网页排法链到整体总览。
- 幻灯片使用对应的逐页图片并链到该页，缩略图框为 16:9。
- 链接按相对路径写进页面，未提供对应目录时在页面上写明还没有生成。
- 目录底部的排法总览链接在预览服务中打开列表页，直接从磁盘打开时指向 `overview.md`。

### 体系样张与范例

- `--works-dir` 是体系样张产物目录，一件作品一个子目录。
- 样张显示缩略图并链到各自产物。
- 网页样张长截图按 5:4 固定比例从顶部裁切，其他载体保持原图比例。
- 样张说明栏沿用现有卡片的 14rem 最小宽度，以可用宽度为上限，不随缩略图挤窄。
- 样张链接按相对路径写进页面，未提供样张目录时在页面上写明还没有生成。
- 库里该体系已批准的范例会列出并复制媒体文件。
- 网页范例带来源链接，HTTP(S) 网址只显示域名。
- 完整网址保留在链接目标和悬停提示中。
- 其他来源字符串保留原显示文本。
- 来源行在卡片宽度内单行省略，避免长路径或超长域名撑开卡片、断行触发避头尾。
- 中文排版检查不增加任何豁免。

### 页头与响应式排版

- 体系可在 `<体系目录>/system-page/header.html` 提供自己的 Liquid 页头片段。
- 页头片段可用变量 `system.{id,name,category,materialAnchor,scenarios,carriers}`。
- 页头片段可带一段 `<style>`，只作用于页头。
- 未提供页头片段时用默认页头。
- 生成器直接输出两栏目录（≥1180px）、窄屏吸顶条与全屏目录。
- 生成器直接输出始终显示的分节、载体页签和超过 6 行的表格折叠条。
- 页签下不再重复载体小标题，单载体无页签时保留小标题。
- 节与正文无滚动入场。
- 宽度小于 640px 时，节标题、编号和材质锚点陈述各沿字阶向前取一档。
- 手机色块为色块加名称/色值的一行，长色值单行滚动。
- 表格最小宽度沿用现有长文的 46em。
- 表格滚动限制在表格内，避免窄列触发标点断行。

### 交互与状态

- 节标题是指向本节锚点的链接，保留右侧计数。
- 节标题悬停只将编号由次级墨色变为主墨色，标题字不变。
- 节标题悬停用 `turn` 档时长和现有 `ink` 缓动映射，没有背景或下划线。
- 目录底部不提供全部收起或展开。
- 目录滑块和页签指示线用体系中档时长、第一条缓动，以 transform/opacity 呈现反馈。
- 减少动态效果时操作瞬时完成。
- 长表格折叠和页签按体系存入 `localStorage`。
- 页面不读写分节折叠状态。
- 存储失败沿用默认值。
- 静态渲染全部表格和面板展开。

### 产物与检查

- 产物包含 `index.html`、`fonts/`、`web-desktop.png`、`web-mobile.png`、`exemplars/`。
- 提供网页排法总览时产物包含 `layout-thumbnails/`。
- 产物包含导航读取的体系元信息 `preview-meta.json`。
- 产物包含两种动态效果设置下的动画记录 `replays.json`。
- 产物包含检查报告 `report.json` 和 `report.md`。
- 检查跳过构图比率和防同质化，其余规则照常。
- 退出状态同 `build`。
- 入口为 `buildSystemPage()`（`src/system-page.ts`）。

## `pnpm ds preview`：预览

`pnpm ds preview --dir <产物目录> [--port <端口>] [--host <地址>]`。

### 服务与目录入口

- 默认地址为 `http://127.0.0.1:4173/`。
- 本命令在本地起静态服务直到 Ctrl+C。
- 目录可以是单件作品、排法总览、体系总览页或回归产物。
- 根路径 `/` 是导航入口。
- 回归产物（`<体系>/system/`、`works/<名>/`、`overview/`）和单个体系目录（含 `system/` 或 `overview/overview.md`）按体系分组。
- 单个排法总览（根下有 `overview.md`）的首页直接是排法总览列表。
- 其他形态（单件作品、任意文件夹）平铺列出目录下所有产物，含 `index.html` 的子目录。
- 平铺入口列出各产物的错误/警告数、截图、录屏和报告。
- 网页能滚动，幻灯片用方向键翻页。
- 字体照常加载，录屏支持拖动。
- 端口被占用或目录不存在时退出状态 2。
- 入口为 `startPreview()`（`src/preview.ts`），分组页在 `src/preview-nav.ts`。

### 体系分组卡片

- 分组页用中性暖灰的卡片、Inter 与思源黑体呈现。
- 字体从只读本机缓存经 `/_preview-fonts/` 提供。
- 顶栏显示体系跳转和所有构建的错误/警告合计。
- 每张体系卡片以体系总览页作主入口。
- 卡片封面取主网页样张顶部，悬停或焦点下缓慢滚动。
- 色带按色值去重，底色和主墨色宽度为其余的 2.4 倍。
- 调性显示靠近的单字一极，中点沿用第一极，并显示五格刻度。
- 检查结果分组留间距。
- 体系样张用可折叠横向缩略图栏，非网页保留原图比例，网页取顶部。
- 检查报告默认折叠并列出全部构建。

### 排法列表与状态

- 排法总览合成一个条目，点开是生成的 `/_overview/<排法总览目录>/` 列表页。
- 排法列表按载体、画幅分组显示缩略图，各自链到构建，报告在这一页。
- 列表分组可以折叠、筛选只看有警告。
- 非网页缩略图按原图比例完整显示。
- 深浅色跟随系统并可手动切换。
- 折叠状态和深浅色存入 `localStorage`，读写失败使用默认值。
- 减少动态效果取消过渡。

## `pnpm ds regress`：回归

`pnpm ds regress [--systems <目录>] [--out <目录>] [--library <目录>]`，默认 `systems`、`out/regress`。

- 种子体系放在顶层 `systems/<体系标识>/`，含 `SYSTEM.md`、`system.tokens.json`、`layouts/` 等，格式同体系目录。
- 体系样张作品描述放在 `systems/<体系标识>/works/*.json`，一份文件一件作品，社交配图每个画幅一份。
- 对每套体系先跑全部体系样张，再跑它的排法总览，最后生成体系总览页，链到前两者。
- 产物在 `<out>/<体系标识>/works/<文件名>/`、`<out>/<体系标识>/overview/` 和 `<out>/<体系标识>/system/`。
- 任何错误、构建失败、缺少体系样张都以退出状态 1 结束。
- 体系目录不存在时退出状态为 2。
- CI 有手动触发的 `regress` 工作流（`.github/workflows/regress.yml`），缓存 `.cache/fonts`。

## `pnpm ds fetch-fonts`：抓取字体

`pnpm ds fetch-fonts [--library <目录>] [--font-cache <目录>] [--font <id>...]`。

### 下载与检查

- 本命令按字体清单把字体下载到 git 忽略的 `.cache/fonts` 并核对 sha256。
- 下载走环境变量 HTTPS_PROXY。
- `--font` 可重复，用于只抓取指定条目。
- 构建只读这个缓存。
- 检查器用字体文件内部的 PostScript 名匹配清单，并用 cmap 检查缺字。
- 成功退出状态 0，清单、下载、压缩包读取或校验失败为 2。

### 压缩包来源

- 可选 `source.archive`，格式为 `{"type":"zip","file":"目录/字体.ttf","sha256":"<压缩包的 64 位小写十六进制 SHA-256>"}`。
- 配置压缩包来源时，`source.url` 指向压缩包。
- `source.sha256` 仍是最终字体文件的 SHA-256。
- 条目的 `file` 仍是缓存文件名。
- 压缩包来源只支持 ZIP。
- `archive.file` 按包内相对路径精确匹配，用 `/` 分隔。
- `archive.file` 不能含空段、`.`、`..`、反斜杠、冒号或空字符。
- 字段类型、路径和两份校验和由字体清单校验检查。
- 抓取先核对包的 SHA-256，再只读取指定文件、核对字体的 SHA-256，最后写入缓存。
- 包和其他成员不落盘。
- 缓存字体已通过校验时不重新下载。
- 损坏缓存先移除，失败时不留下坏字体或临时文件。
- 不写 `source.archive` 的条目照常直接下载字体，`file:` URL 同样支持。
- 入口测试通过 `fetchFonts()` 用 `file:` 夹具覆盖这些行为。

### 构建字体子集

#### 用字收集

- 网页、幻灯片、社交配图、排法总览和体系总览页在渲染前按最终页面用字生成中文字体子集。
- 用字取解码后的 DOM，含定制片段和未显示的内容。
- 用字也取 Chromium 的实际排版文字，含 CSS 计数器、伪元素和大小写转换。
- 网页用字收集覆盖 1440/390 两种宽度。
- 幻灯片用字逐页收集。
- 用字收集覆盖屏幕和打印媒体、两种动态效果偏好。
- 打印样式才出现的文字也进入 PDF 使用的同一份子集。

#### 许可与产物

- 子集化只处理清单标为 `cjk`、采用 OFL-1.1 且核对过完整许可、没有实际保留字体名称声明的字体。
- 已核对的固定官方 URL 与原文在 `src/font-subset-licenses.json`。
- 清单的本地 `license.file` 也可提供完整 OFL，版权头声明保留名称时不处理。
- 未知许可、没有可核对原文、有保留名称的字体及纯西文字体保持原样，不自动改名。
- 子集保留原文件名、格式、字体名称、字形风格、版权和授权元数据及排版特性。
- 完整许可随子集放在 `fonts/<字体标识>.OFL.txt`。
- 产物仍可直接从磁盘打开。
- 字体缓存只读。
- 检查器读产物字体的 cmap。
- PostScript 名匹配和斜体判定照常。
- 子集化失败按构建失败处理（退出状态 2），不静默交付完整字体。

### 斜体

- 清单条目可选 `style`，取 `normal` 或 `italic`，不写按 `normal`。
- 斜体字面单独建一条，有自己的文件和 PostScript 名，按 PostScript 名匹配。
- 构建生成的 `@font-face` 带 `font-style`。
- 体系要用斜体，就在数值文件里再加一个 `font.<角色>`（如 `font.body-italic`）并用 `fontId` 引用斜体条目。
- 引用斜体条目后，它的 `@font-face` 才会进产物。
- `fonts/style-mismatch` 将斜体文字用到的字体里没有斜体字面判为错误，此时浏览器会硬倾斜正体。
- `fonts/style-mismatch` 将正体文字用上斜体字面判为错误。

## `pnpm fixture-font`：重新生成夹具字体

`pnpm fixture-font`。

- 夹具字体输出到 `test/fixtures/font-cache/`。
- 缺字夹具用的 `龘` 和 U+E000 被故意排除在子集之外。
- 夹具文字里新增汉字后要重跑并提交结果。
