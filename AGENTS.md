# design-system

面向 AI Agent 的设计体系库，处于方案讨论阶段。当前方案：`docs/面向 AI Agent 的设计体系库_v0.3.md`。

## 目录约定

- `.agents/skills/` 存放技能本体，`.claude/skills/` 下是指向它们的软链接；新增技能时两处都要建。
- `references/` 是参考项目的本地克隆，只读，不入库。

## 命令

需要 Node 22.18 及以上和 pnpm 12（`packageManager` 字段会自动切换版本）。

- 安装：`pnpm install`，然后 `pnpm exec playwright install --with-deps --only-shell chromium`（只需 Chromium headless shell）。
- 构建并检查：`pnpm ds build --system <体系目录> --work <作品描述.json> --out <产物目录> [--library <共享资产目录>]`。产物目录里有 `index.html`、`fonts/`、渲染出的 PNG、`report.json` 和 `report.md`。网页作品输出 `web-desktop.png`（宽 1440）、`web-mobile.png`（宽 390）两张整页截图和一段加载并滚动到底的录屏 `web-scroll.webm`；检查器在两个宽度上各跑一遍，只在手机宽度出现的问题会在说明末尾标注。网页版式里按滚动才显示的内容，要放在 `html[data-render="static"]` 下直接显示（截图和检查时页面带这个标记，录屏时没有）。`--library` 默认是当前目录下的 `library/`（放结构骨架 `skeleton/<载体>.json`、字体清单 `fonts/manifest.json`，以及可选的共享内容 `content/<载体>.json`，作品描述用 `{"ref": "键名"}` 引用）。
  - 退出状态：0 表示没有错误（只有警告也是 0）；1 表示报告里有错误；2 表示体系或作品描述校验失败、没有报告，原因打印在 stderr。
  - 试跑夹具：`pnpm ds build --system test/fixtures/systems/mini --work test/fixtures/works/clean.json --out out/clean --library test/fixtures/library`。
- 校验体系：`pnpm ds validate-system --system <体系目录> [--library <共享资产目录>]`，只跑体系校验（SYSTEM.md、数值文件、字体引用、体系专属单元），一次列出全部问题；退出状态 0 通过，2 失败。体系格式见 `src/system.ts`、`src/tokens.ts` 文件头；体系专属叙事单元放在体系目录的 `skeleton/<载体>.json`。
- 标准样张内容：`library/content/`（设定见 `SETTING.md`，共享内容 `web.json`、`slides.json`、`social.json`，键名为 `<单元>.<槽位>` 或 `<单元>.<实例>.<槽位>`，图像槽位只写图像标识，图像简报清单在 `images.json`；图片由各体系自己提供，放在体系目录的 `images/<标识>.<svg|webp|png|jpg>`，构建时按作品用到的标识查找并复制进产物的 `images/`，缺了就报错并列出全部缺少的标识）。
- 类型检查：`pnpm typecheck`。
- 测试：`pnpm test`。测试只通过 `buildAndCheck()`（`src/build-and-check.ts`，命令行入口 `src/cli.ts` 是它的薄封装）以及它之上的 `buildOverview()`（`src/overview.ts`）、`regress()`（`src/regress.ts`）驱动夹具体系和夹具作品，断言报告和产物规格，不测内部函数，不做像素比对。
- 排法总览：`pnpm ds overview --system <体系目录> --out <产物目录> [--library <共享资产目录>] [--carrier <载体>...] [--canvas <画幅>...]`。为任意体系生成作品：网页、幻灯片各一件（按骨架顺序，每个单元的每种排法依次出现一次），社交配图每个画幅、每种排法一张；内容取共享内容里该单元的第一个实例，只用 `{"ref": 键名}` 引用，不依赖具体键名。每件作品走一遍「构建并检查」，产物在 `<载体>/` 和 `social/<画幅>/<单元>-<排法>/` 下，`overview.md` 汇总各构建的错误和警告数；体系没有排法或共享内容没覆盖的单元列为「未覆盖」，不算错误。退出状态同 `build`（有构建失败也是 1）。
- 回归：`pnpm ds regress [--systems <目录>] [--out <目录>] [--library <目录>]`（默认 `systems`、`out/regress`）。种子体系放在顶层 `systems/<体系标识>/`（`SYSTEM.md`、`system.tokens.json`、`layouts/` 等，格式同体系目录），该体系的标准样张作品描述放在 `systems/<体系标识>/works/*.json`（一份文件一件作品，社交配图每个画幅一份）。对每套体系先跑全部标准样张，再跑它的排法总览，产物在 `<out>/<体系标识>/works/<文件名>/` 和 `<out>/<体系标识>/overview/`；任何错误、构建失败、缺少标准样张都以退出状态 1 结束，体系目录不存在为 2。CI 里有手动触发的 `regress` 工作流（`.github/workflows/regress.yml`），缓存 `.cache/fonts`。
- 抓取字体：`pnpm ds fetch-fonts [--library <目录>] [--font-cache <目录>]`，按字体清单把字体下载到 git 忽略的 `.cache/fonts`并核对 sha256，走环境变量 HTTPS_PROXY；构建只读这个缓存。检查器用字体文件内部的 PostScript 名匹配清单，并用 cmap 检查缺字。
- 重新生成夹具字体：`pnpm fixture-font`（输出到 `test/fixtures/font-cache/`；缺字夹具用的 `龘` 和 U+E000 被故意排除在子集之外）。夹具文字里新增汉字后要重跑并提交结果。

## 代码约定

- 代码文件里不写行内注释，只在文件头部集中写说明（这个文件做什么、输入输出、关键约束），方便快速检索。
- TypeScript 严格模式，用 Node 原生类型剥离运行（不用 tsx）：相对导入写 `.ts` 扩展名，类型导入用 `import type`，不用 `enum`、命名空间和参数属性。
- 新增检查规则：在 `src/checker/rules/` 新建文件，在 `rules/index.ts` 的 `ALL_RULES` 里加一行；规则只读 `snapshot` 里的数据，需要新的页面信息就扩展 `src/checker/snapshot.ts`。流程本身不用改。规则的阈值一律放在 `src/checker/rule-data.ts`（工艺规范引用同一份），不写进规则逻辑。
- 依赖版本固定，`pnpm-workspace.yaml` 里 `minimumReleaseAge: 20160`（14 天内发布的新版本不安装）。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (JinhaoFang/design-system), operated via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
