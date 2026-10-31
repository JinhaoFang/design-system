# 执行技能的本仓库配置

执行技能 `run-spec` 只写通用步骤，本仓库特有的值放在两处：

- `docs/agents/run-spec.json`：工单脚本要读的值；
- 本文：配置项的含义，以及脚本用不到、但设计负责人执行时要知道的值。

`run-spec` 和 `setup-run-spec` 从 `JinhaoFang/agent-workflow` 的版本 tag 安装，不进 git，当前是 `workflow-v4`，记在 `skills-lock.json`。安装命令、升级步骤和注意事项见那边的 README；每台跑执行会话的机器各自安装。

## 脚本读取的配置

`run-spec.json` 的前六项必填，缺文件或缺项时脚本以 2 退出，并说明缺了什么。`codexConcurrency`、`prCheckCommand`、`staticCheckCommand`、`staticOnlyPaths` 可选，不写就取默认值，格式错误同样以 2 退出；`doctor` 报告它们的实际取值和来源（配置、环境变量或默认）。命令一律写成参数数组。

| 配置项 | 本仓库的值 | 含义 |
|---|---|---|
| `verificationCommand` | `["pnpm", "verify"]` | 完整验证，步骤见 `scripts/verify.ts` 的 `STEPS`。`land` 合并前在 worktree 里运行它（改动全部匹配 `staticOnlyPaths` 时除外），`tickets.ts verify --full` 也用它。 |
| `installCommand` | `["pnpm", "install", "--frozen-lockfile"]` | 安装命令。`dispatch` 新建 worktree 后运行，`land` 在 rebase 之后、验证之前再运行一次；成功只打印一行结果，失败回放完整输出并以 2 退出，重跑时补完安装。 |
| `symlinkDirectories` | `["references", ".agents", ".cache"]` | 不进 git、但 Codex 要读的目录。`dispatch` 把它们从主工作区软链接进 worktree，派发指令要求只读使用。本仓库是参考项目、第三方技能（Matt 的技能）和构建要读的字体缓存（`.cache/fonts`）。 |
| `acceptanceRoot` | `"out/qa"` | 验收产物根目录。每张工单写到下面的 `spec-<S>/<T>/`；`land` 把它复制回主工作区，`cleanup` 整个删掉 `spec-<S>/`。 |
| `codexSandbox` | `"danger-full-access"` | 派发时 Codex 的权限。完全权限让 Codex 能联网、能用 `gh` 读 issue，测试也要起无头浏览器。 |
| `dispatchScript` | `".claude/skills/codex-dispatch/codex-task.mjs"` | DispatchDock 的派发脚本，路径相对主工作区。 |
| `codexConcurrency` | 不写（默认 `2`） | 可选。同时运行的 Codex 派发上限，`dispatch` 到上限时排队。环境变量 `RUN_SPEC_CODEX_CONCURRENCY` 优先于配置。 |
| `staticCheckCommand` | `["pnpm", "verify", "--static"]` | 可选。静态检查：`STEPS` 里除测试以外的全部步骤。配了它，派发指令要求 Codex 开发时只跑相关测试和静态检查，完整验证由 `land` 跑一次。 |
| `staticOnlyPaths` | `["/*.md", "docs/**/*.md", "docs/reports/*.html"]` | 可选，和 `staticCheckCommand` 一起配。gitignore 写法；一张工单的改动全部匹配时，`land` 和设计工单的 `verify` 只跑静态检查。只列根目录和 `docs/` 下的文档与汇报：`library/craft.md`、`systems/*/SYSTEM.md` 和测试夹具里的 Markdown 会被测试或构建读，改了仍要完整验证。 |
| `prCheckCommand` | 不写（默认 `["gh", "pr", "checks", "{pr}", "--watch"]`） | 可选。`pr-check` 运行的 PR 检查命令，`{pr}` 换成 PR 号。CI 启动不了时不改这一项，按 `docs/workflow/README.md`「护栏」改为本机验证。 |

## 执行时要知道的其他值

- **独占资源**：无。
- **汇报目录**：`docs/reports/`，写法按 `run-spec` 的 `report.md`。版式沿用第一份 `spec-32-dev-guardrails.html`。
- **验证用时**：`pnpm verify` 在本机约 2～3.5 分钟（测试会起无头浏览器；10-31 实测 3 分 20 秒），`pnpm verify --static` 约 2 秒。并行验证：两套同时跑经过实测是安全的（spec #32 的 #33）；三张工单并行时各自的验证也都通过了，但没有专门压测三套同时跑。CI 的机器是 2 核，测试约 5 分钟。
- **派发实测用时**（spec #32）：工具类工单 10～18 分钟，输入 100 万～270 万 tokens（九成以上命中缓存）；要在 CI 上反复运行找原因的排查工单约 40 分钟、870 万 tokens；按批审查约 5 分钟。`land` 的验证每次约 2 分钟。
- **常见的共享登记处**：`src/checker/rules/index.ts` 的 `ALL_RULES`、`src/cli-commands.json` 的 `ds` 子命令表、`package.json` 的脚本、`scripts/verify.ts` 的 `STEPS`、CI 工作流、`docs/cli.md`。并行的工单都要往里加一项时，派发的补充说明写"只加自己那一项"。
- **软链接的目录在 `.gitignore` 里不带斜杠**：worktree 里的 `references`、`.agents`、`.cache` 是软链接，写成 `references/` 这类带斜杠的规则匹配不到，worktree 会不干净，`land` 会拒绝合并。
