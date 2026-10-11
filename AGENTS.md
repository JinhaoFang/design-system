# design-system

面向 AI Agent 的设计体系库，处于方案讨论阶段。当前方案：`docs/面向 AI Agent 的设计体系库_v0.3.md`。

## 目录约定

- `.agents/skills/` 存放技能本体，`.claude/skills/` 下是指向它们的软链接；新增技能时两处都要建。
- `references/` 是参考项目的本地克隆，只读，不入库。

## 命令

需要 Node 22.18 及以上和 pnpm 12（`packageManager` 字段会自动切换版本）。

- 安装：`pnpm install`，然后 `pnpm exec playwright install --with-deps --only-shell chromium`（只需 Chromium headless shell）。
- 构建并检查：`pnpm ds build --system <体系目录> --work <作品描述.json> --out <产物目录> [--library <共享资产目录>]`。产物目录里有 `index.html`、`fonts/`、渲染出的 PNG、`report.json` 和 `report.md`。网页作品输出 `web-desktop.png`（宽 1440）、`web-mobile.png`（宽 390）两张整页截图和一段加载并滚动到底的录屏 `web-scroll.webm`；检查器在两个宽度上各跑一遍，只在手机宽度出现的问题会在说明末尾标注。网页版式里按滚动才显示的内容，要放在 `html[data-render="static"]` 下直接显示（截图和检查时页面带这个标记，录屏时没有）。`--library` 默认是当前目录下的 `library/`（放结构骨架 `skeleton/<载体>.json`、字体清单 `fonts/manifest.json`，以及可选的共享内容 `content/<载体>.json`，作品描述用 `{"ref": "键名"}` 引用）。
  - 入场动效：排法和定制片段里给元素写 `data-ds-enter="fade|rise|fall|left|right"`，可选 `data-ds-order`（组内顺序）、`data-ds-stagger`（写在组容器上）、`data-ds-step`、`data-ds-ease`、`data-ds-distance`，取值名都来自体系的时长阶梯、缓动集、错峰和间距；用法见 `src/choreography.ts` 文件头。检查器会在正常和「减少动态效果」两种条件下记录动画并检查动效规则（`src/checker/rules/motion.ts`）。
  - 退出状态：0 表示没有错误（只有警告也是 0）；1 表示报告里有错误；2 表示体系或作品描述校验失败、没有报告，原因打印在 stderr。
  - 试跑夹具：`pnpm ds build --system test/fixtures/systems/mini --work test/fixtures/works/clean.json --out out/clean --library test/fixtures/library`。
- 校验体系：`pnpm ds validate-system --system <体系目录> [--library <共享资产目录>]`，只跑体系校验（SYSTEM.md、数值文件、字体引用、体系专属单元），一次列出全部问题；退出状态 0 通过，2 失败。体系格式见 `src/system.ts`、`src/tokens.ts` 文件头；体系专属叙事单元放在体系目录的 `skeleton/<载体>.json`。
- 标准样张内容：`library/content/`（设定见 `SETTING.md`，共享内容 `web.json`、`slides.json`、`social.json`，键名为 `<单元>.<槽位>` 或 `<单元>.<实例>.<槽位>`，图像槽位只写图像标识，图像简报清单在 `images.json`；图片由各体系自己提供，放在体系目录的 `images/<标识>.<svg|webp|png|jpg>`，构建时按作品用到的标识查找并复制进产物的 `images/`，缺了就报错并列出全部缺少的标识）。
- 类型检查：`pnpm typecheck`。
- 范例库：每条范例一个目录 `library/exemplars/<id>/`，里面是 `exemplar.json` 和媒体文件（截图或录屏）。目录名必须等于 `id`。
  - 字段：`id`、`title`、`sourceType`（`external` 外部收集 / `copy` 临摹 / `original` 原创）、`sourceUrl`（外部收集和临摹必填）、`copyright`（版权方）、`carrier`（`web` / `slides` / `social`）、`systems`（支撑哪些种子体系，如 `paper-editorial`、`precision-industrial`、`riso-print`）、`media`（`kind`：`screenshot` / `recording`；`status`：`present` 时 `file` 必须存在，`pending` 表示待补，已批准的范例不能是待补）、`annotation`（`highlights` 出色之处、`reasons` 原因、`scenes` 适合的场景、`materialAnchor` 材质锚点、`tonality` 调性位置）、`approval`（`status`：`candidate` / `approved` / `rejected`；已批准和已拒绝必须带 `date`，格式 `YYYY-MM-DD`，候选不带）。
  - `tonality` 五个键 `静动`、`疏密`、`冷暖`、`轻重`、`庄谐`，值 1–5，1 靠近键名第一个字（静、疏、冷、轻、庄），5 靠近第二个字。
  - 校验：`pnpm ds validate-exemplars [--library <目录>]`。退出状态 0 表示全部完整，1 表示有问题（逐条打印在 stderr，写明范例标识和字段）。
  - 按来源类型列出：`pnpm ds list-exemplars [--source external|copy|original] [--paths] [--library <目录>]`。默认每行一条（标识、来源类型、批准状态、载体、来源链接、媒体文件，制表符分隔）；`--paths` 只打印存在的媒体文件路径。仓库公开之前移除外部截图：`pnpm ds list-exemplars --source external --paths | xargs rm`，再把相应范例的 `media.status` 改成 `pending`。
  - agent 只提交候选（`approval.status` 为 `candidate`），批准和拒绝由裁判决定。
- 感觉词词典：每个词一个文件 `library/lexicon/<id>.json`，文件名（拼音）必须等于 `id`。格式见 `src/lexicon.ts` 文件头。
  - 字段：`id`、`word`（感觉词本身）、`phrasings`（需求方常见说法，至少一条）、`interpretations`（解读，至少两种；同一个词内 `name` 和 `materialAnchor` 不能重复）。
  - 每种解读：`name`、`description`（大白话，要落到色彩、字体、版面、动效等具体决定上）、`materialAnchor`、`tonality`（五个键同范例，值 1–5）、`composition`（构图比率倾向，`跳跃率`、`版面率`、`图版率` 三个键，值 `低` / `中` / `高`）、`recommendation`、`samples`、`approval`。
  - `recommendation`：`{"system": "paper-editorial" | "precision-industrial" | "riso-print"}`，或临时方向 `{"system": "临时方向", "borrowLayoutsFrom": <种子体系>, "direction": <一句话方向>}`。
  - `samples`：`{"status": "pending"}`（待补）或 `{"status": "present", "exemplars": [范例标识...]}`，标识必须在 `library/exemplars/` 中存在。样图可以在任何确认状态下待补。
  - `approval`：按解读逐条确认，规则同范例（候选不带 `date`，已批准和已拒绝必须带 `YYYY-MM-DD`）。agent 只提交候选。
  - 校验：`pnpm ds validate-lexicon [--library <目录>]`，退出状态 0 表示全部完整，1 表示有问题（逐条打印在 stderr，写明词条标识和字段）。
  - 列出：`pnpm ds list-lexicon [--status candidate|approved|rejected] [--system <种子体系>|临时方向] [--library <目录>]`，每种解读一行（词条标识、词、解读名、推荐体系、确认状态、样图标识或「待补」，制表符分隔）；状态或体系写错时退出状态 2。
- 测试：`pnpm test`。测试只通过 `buildAndCheck()`（`src/build-and-check.ts`，命令行入口 `src/cli.ts` 是它的薄封装）以及它之上的 `buildOverview()`（`src/overview.ts`）、`regress()`（`src/regress.ts`）驱动夹具体系和夹具作品，断言报告和产物规格，不测内部函数，不做像素比对。范例库的测试在 `test/exemplars.test.ts`，通过 `validateExemplars()` 和 `listExemplars()` 两个入口及 CLI 命令驱动临时目录里的范例。
- 排法总览：`pnpm ds overview --system <体系目录> --out <产物目录> [--library <共享资产目录>] [--carrier <载体>...] [--canvas <画幅>...]`。为任意体系生成作品：网页、幻灯片各一件（按骨架顺序，每个单元的每种排法依次出现一次），社交配图每个画幅、每种排法一张；内容取共享内容里该单元的第一个实例，只用 `{"ref": 键名}` 引用，不依赖具体键名。每件作品走一遍「构建并检查」，产物在 `<载体>/` 和 `social/<画幅>/<单元>-<排法>/` 下，`overview.md` 汇总各构建的错误和警告数；体系没有排法或共享内容没覆盖的单元列为「未覆盖」，不算错误。退出状态同 `build`（有构建失败也是 1）。
- 回归：`pnpm ds regress [--systems <目录>] [--out <目录>] [--library <目录>]`（默认 `systems`、`out/regress`）。种子体系放在顶层 `systems/<体系标识>/`（`SYSTEM.md`、`system.tokens.json`、`layouts/` 等，格式同体系目录），该体系的标准样张作品描述放在 `systems/<体系标识>/works/*.json`（一份文件一件作品，社交配图每个画幅一份）。对每套体系先跑全部标准样张，再跑它的排法总览，产物在 `<out>/<体系标识>/works/<文件名>/` 和 `<out>/<体系标识>/overview/`；任何错误、构建失败、缺少标准样张都以退出状态 1 结束，体系目录不存在为 2。CI 里有手动触发的 `regress` 工作流（`.github/workflows/regress.yml`），缓存 `.cache/fonts`。
- 抓取字体：`pnpm ds fetch-fonts [--library <目录>] [--font-cache <目录>]`，按字体清单把字体下载到 git 忽略的 `.cache/fonts`并核对 sha256，走环境变量 HTTPS_PROXY；构建只读这个缓存。检查器用字体文件内部的 PostScript 名匹配清单，并用 cmap 检查缺字。
- 重新生成夹具字体：`pnpm fixture-font`（输出到 `test/fixtures/font-cache/`；缺字夹具用的 `龘` 和 U+E000 被故意排除在子集之外）。夹具文字里新增汉字后要重跑并提交结果。

## 代码约定

- 代码文件里不写行内注释，只在文件头部集中写说明（这个文件做什么、输入输出、关键约束），方便快速检索。
- TypeScript 严格模式，用 Node 原生类型剥离运行（不用 tsx）：相对导入写 `.ts` 扩展名，类型导入用 `import type`，不用 `enum`、命名空间和参数属性。
- 新增检查规则：在 `src/checker/rules/` 新建文件，在 `rules/index.ts` 的 `ALL_RULES` 里加一行；规则只读 `snapshot` 里的数据，需要新的页面信息就扩展 `src/checker/snapshot.ts`。流程本身不用改。规则的阈值一律放在 `src/checker/rule-data.ts`（工艺规范引用同一份），不写进规则逻辑。
- 依赖版本固定，`pnpm-workspace.yaml` 里 `minimumReleaseAge: 20160`（14 天内发布的新版本不安装）。

## 评审

- 交给裁判评审的网页、幻灯片和范例，要让裁判能亲自操作：给出可运行的预览（一条命令起服务）或可访问的链接，截图和录屏只作补充。插图、海报这类静态媒介可以直接看图。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (JinhaoFang/design-system), operated via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
