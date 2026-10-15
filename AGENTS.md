# design-system

面向 AI Agent 的设计体系库：收录成套、有设计感的设计体系，让 agent 用它们产出网页、幻灯片和社交配图，也能从参考样例中提取体系再复用。方案见 `docs/面向 AI Agent 的设计体系库_v0.3.md`，文档地图见 `docs/README.md`，新会话从 `docs/roadmap.md` 看起。

## 角色

| 角色 | 担任者 | 负责 | 角色文档 |
|---|---|---|---|
| 设计负责人 | 和用户对话的 Claude Code | 方向与取舍、体系的审美定稿、感觉词词典的确认、规则文档、spec 与工单、派发与验收 | `docs/roles/design.md` |
| 工程负责人 | Codex，由设计负责人用 `codex-dispatch` 派发 | 能写清要求、能客观验收的执行：构建并检查流程、检查器、命令与预览、测试与 CI、排查问题 | `docs/roles/engineering.md` |

开工时你会被告知自己的角色，先读对应的角色文档再动手。角色只认这个告知，和你是哪个模型无关；没被告知时先问用户。看得到某个技能，不代表你的角色可以用它，每个角色用哪些技能以角色文档为准。

规则文档里的「用户」指和你对话的项目发起人，他在产品里同时是需求方和裁判（见 `GLOSSARY.md`）。方案第 2.2 节的 agent 指使用本库产出成品的 Claude Code 和 Codex；开发本库时，方案和 spec 交给 agent 的工作按上表分给两个角色：体系本身（正文、数值、排法、图像、作品概念）和词典的确认归设计负责人，工具归工程负责人。

## 共同规则

- 和用户交流用中文；思考、文件名、目录名、代码标识符用英文。
- 提交只 `git add` 具体文件，用 `git commit -m "<标题>" -m "<正文>" -m "<尾注>" -- <路径…>`，每个 `-m` 是一段。提交信息的格式：

  ```
  <类型>(<范围>): <摘要>

  <正文：为什么改、改了什么、怎么验证的，分条写>

  Refs: #<工单号>
  Role: design | engineering
  ```

  - 类型：`feat` 新功能、`fix` 修复、`docs` 文档、`refactor` 重构、`test` 测试、`build` 依赖与构建、`chore` 杂项。
  - 范围：改动所在的模块，用目录名，如 `checker`、`cli`、`library`、`docs`、`workflow`、`roles`、`skills`；体系的改动用体系标识，如 `paper-editorial`；跨多个模块的整仓改动用 `repo`。
  - 摘要用中文，一行说清结果。正文必写，改错字也写一句。
  - 尾注：最后一段只写 `Refs: #<工单号>`（可以多行；工单由验收关闭，不写 `Closes`）和 `Role`，两项在同一段。用 `-m` 时放进同一个 `-m`，中间是真正的换行，bash 里写 `-m $'Refs: #12\nRole: design'`。`spec/*` 和 `ticket/*` 分支上 `Refs` 必写。尾注只有这两项，不加任何署名尾注（包括 AI 署名和 Co-Authored-By）。
  - `pnpm install` 通过 `prepare` 自动启用 `.githooks/commit-msg`；本机一次列出全部中文违规，合并进行中跳过。CI 用 `pnpm check:commits origin/main <来源分支名>` 检查非合并提交，本机复现和退出状态见 `docs/cli.md`。
- 只做工单范围内的事。新增依赖在汇报里写明理由；依赖版本固定，`pnpm-workspace.yaml` 的 `minimumReleaseAge` 不安装 14 天内发布的版本。
- `references/` 是参考项目的本地克隆，只读，不进 git。
- 验证命令：`pnpm verify`，步骤见 `scripts/verify.ts` 的 `STEPS`。CI 什么时候跑见 `docs/workflow/README.md`「护栏」。

## 目录与归属

| 位置 | 放什么 | 归属 |
|---|---|---|
| `docs/`、`GLOSSARY.md`、`docs/adr/` | 方案、规则文档、工作流、术语、决策记录、汇报 | 设计 |
| `systems/<体系>/` | 种子体系：`SYSTEM.md`、数值文件、排法、体系样张的作品描述、图像和它的生成脚本 | 设计 |
| `library/craft.md`、`library/content/`、`library/skeleton/`、`library/fonts/` | 工艺规范、测试内容、结构骨架、字体清单 | 设计 |
| `library/lexicon/` | 感觉词词典 | 设计负责人确认；其他人只提交候选 |
| `library/exemplars/` | 范例库 | 只提交候选，批准和拒绝由裁判决定 |
| `src/`、`test/`、`scripts/`、`package.json`、构建配置、`.github/` | 构建并检查流程、检查器、命令、测试、CI | 工程 |

`pnpm ds` 各命令的用法、产物和格式约定见 `docs/cli.md`，每个命令一节；运行或修改某个命令前，先读它那一节。技能放在哪里、哪些进 git，见 `docs/workflow/README.md`「技能放在哪里」。

## 代码约定

- 代码文件里不写行内注释，只在文件头部集中写说明（这个文件做什么、输入输出、关键约束），方便快速检索。`pnpm check:comments` 在 `pnpm verify` 和 CI 中检查进 git 的 TS/JS 文件，注释段的判定和命令用法见 `docs/cli.md`。
- TypeScript 严格模式，用 Node 原生类型剥离运行（不用 tsx）：相对导入写 `.ts` 扩展名，类型导入用 `import type`，不用 `enum`、命名空间和参数属性。
- 新增检查规则：在 `src/checker/rules/` 新建文件，在 `rules/index.ts` 的 `ALL_RULES` 里加一行；规则只读 `snapshot` 里的数据，需要新的页面信息就扩展 `src/checker/snapshot.ts`。流程本身不用改。规则的阈值一律放在 `src/checker/rule-data.ts`（工艺规范引用同一份），不写进规则逻辑。

## Agent skills

### Issue tracker

Issues live in GitHub Issues (JinhaoFang/design-system), operated via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Run-spec

Executing a spec and its tickets (dispatch, acceptance, review, report) follows the `run-spec` skill; this repo's values are in `docs/agents/run-spec.md`.
