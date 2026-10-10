# design-system

面向 AI Agent 的设计体系库，处于方案讨论阶段。当前方案：`docs/面向 AI Agent 的设计体系库_v0.3.md`。

## 目录约定

- `.agents/skills/` 存放技能本体，`.claude/skills/` 下是指向它们的软链接；新增技能时两处都要建。
- `references/` 是参考项目的本地克隆，只读，不入库。

## 命令

需要 Node 22.18 及以上和 pnpm 12（`packageManager` 字段会自动切换版本）。

- 安装：`pnpm install`，然后 `pnpm exec playwright install --with-deps --only-shell chromium`（只需 Chromium headless shell）。
- 构建并检查：`pnpm ds build --system <体系目录> --work <作品描述.json> --out <产物目录> [--library <共享资产目录>]`。产物目录里有 `index.html`、`fonts/`、渲染出的 PNG、`report.json` 和 `report.md`。`--library` 默认是当前目录下的 `library/`（放结构骨架 `skeleton/<载体>.json` 和字体清单 `fonts/manifest.json`）。
  - 退出状态：0 表示没有错误（只有警告也是 0）；1 表示报告里有错误；2 表示体系或作品描述校验失败、没有报告，原因打印在 stderr。
  - 试跑夹具：`pnpm ds build --system test/fixtures/systems/mini --work test/fixtures/works/clean.json --out out/clean --library test/fixtures/library`。
- 范例库：每条范例一个目录 `library/exemplars/<id>/`，里面是 `exemplar.json` 和媒体文件（截图或录屏）。目录名必须等于 `id`。
  - 字段：`id`、`title`、`sourceType`（`external` 外部收集 / `copy` 临摹 / `original` 原创）、`sourceUrl`（外部收集和临摹必填）、`copyright`（版权方）、`carrier`（`web` / `slides` / `social`）、`systems`（支撑哪些种子体系，如 `paper-editorial`、`precision-industrial`、`riso-print`）、`media`（`kind`：`screenshot` / `recording`；`status`：`present` 时 `file` 必须存在，`pending` 表示待补，已批准的范例不能是待补）、`annotation`（`highlights` 出色之处、`reasons` 原因、`scenes` 适合的场景、`materialAnchor` 材质锚点、`tonality` 调性位置）、`approval`（`status`：`candidate` / `approved` / `rejected`；已批准和已拒绝必须带 `date`，格式 `YYYY-MM-DD`，候选不带）。
  - `tonality` 五个键 `静动`、`疏密`、`冷暖`、`轻重`、`庄谐`，值 1–5，1 靠近键名第一个字（静、疏、冷、轻、庄），5 靠近第二个字。
  - 校验：`pnpm ds validate-exemplars [--library <目录>]`。退出状态 0 表示全部完整，1 表示有问题（逐条打印在 stderr，写明范例标识和字段）。
  - 按来源类型列出：`pnpm ds list-exemplars [--source external|copy|original] [--paths] [--library <目录>]`。默认每行一条（标识、来源类型、批准状态、载体、来源链接、媒体文件，制表符分隔）；`--paths` 只打印存在的媒体文件路径。仓库公开之前移除外部截图：`pnpm ds list-exemplars --source external --paths | xargs rm`，再把相应范例的 `media.status` 改成 `pending`。
  - agent 只提交候选（`approval.status` 为 `candidate`），批准和拒绝由裁判决定。
- 类型检查：`pnpm typecheck`。
- 测试：`pnpm test`。测试只通过 `buildAndCheck()`（`src/build-and-check.ts`，命令行入口 `src/cli.ts` 是它的薄封装）驱动夹具体系和夹具作品，断言报告和产物规格，不测内部函数，不做像素比对。
- 重新生成夹具字体：`pnpm fixture-font`。夹具文字里新增汉字后要重跑并提交结果。

## 代码约定

- 代码文件里不写行内注释，只在文件头部集中写说明（这个文件做什么、输入输出、关键约束），方便快速检索。
- TypeScript 严格模式，用 Node 原生类型剥离运行（不用 tsx）：相对导入写 `.ts` 扩展名，类型导入用 `import type`，不用 `enum`、命名空间和参数属性。
- 新增检查规则：在 `src/checker/rules/` 新建文件，在 `rules/index.ts` 的 `ALL_RULES` 里加一行；规则只读 `snapshot` 里的数据，需要新的页面信息就扩展 `src/checker/snapshot.ts`。流程本身不用改。
- 依赖版本固定，`pnpm-workspace.yaml` 里 `minimumReleaseAge: 20160`（14 天内发布的新版本不安装）。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (JinhaoFang/design-system), operated via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
