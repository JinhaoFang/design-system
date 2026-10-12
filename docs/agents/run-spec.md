# 执行技能的本仓库配置

执行技能（`.claude/skills/run-spec/`）只写通用步骤，本仓库特有的值放在两处：

- `docs/agents/run-spec.json`：工单脚本要读的值；
- 本文：配置项的含义，以及脚本用不到、但设计负责人执行时要知道的值。

## 脚本读取的配置

`run-spec.json` 的每一项都必填。缺文件或缺项时，脚本以 2 退出，并说明缺了什么。命令一律写成参数数组。

| 配置项 | 本仓库的值 | 含义 |
|---|---|---|
| `verificationCommand` | `["pnpm", "verify"]` | 验证命令。`land` 在 worktree 里合并前运行它；派发指令也让 Codex 用它验证。 |
| `installCommand` | `["pnpm", "install", "--frozen-lockfile"]` | 安装命令。`dispatch` 新建 worktree 后运行；成功只打印一行结果，失败回放完整输出并以 2 退出，重跑时补完安装。 |
| `symlinkDirectories` | `["references", ".agents", ".cache"]` | 不进 git、但 Codex 要读的目录。`dispatch` 把它们从主工作区软链接进 worktree，派发指令要求只读使用。本仓库是参考项目、第三方技能（Matt 的技能）和构建要读的字体缓存（`.cache/fonts`）。 |
| `acceptanceRoot` | `"out/qa"` | 验收产物根目录。每张工单写到下面的 `spec-<S>/<T>/`；`land` 把它复制回主工作区，`cleanup` 整个删掉 `spec-<S>/`。 |
| `codexSandbox` | `"danger-full-access"` | 派发时 Codex 的权限。完全权限让 Codex 能联网、能用 `gh` 读 issue，测试也要起无头浏览器。 |
| `dispatchScript` | `".claude/skills/codex-dispatch/codex-task.mjs"` | DispatchDock 的派发脚本，路径相对主工作区。 |

## 执行时要知道的其他值

- **按批审查**：审查不走 `dispatch`，用 `dispatchScript` 指向的派发脚本直接派发，`--sandbox` 填 `codexSandbox`。
- **汇报目录**：`docs/reports/`，写法按 `run-spec` 的 `report.md`。这个仓库还没有汇报，第一份写好后它就是后面各期沿用的版式。
- **验证用时**：`pnpm verify` 在本机约 2 分钟（测试会起无头浏览器）。并行验证：两套同时跑经过实测是安全的（spec #32 的 #33）；三张工单并行时各自的验证也都通过了，但没有专门压测三套同时跑。CI 的机器是 2 核，测试约 5 分钟。
- **派发实测用时**（spec #32）：工具类工单 10～18 分钟，输入 100 万～270 万 tokens（九成以上命中缓存）；要在 CI 上反复运行找原因的排查工单约 40 分钟、870 万 tokens；按批审查约 5 分钟。`land` 的验证每次约 2 分钟。
- **rebase 带进新依赖时先重装**：`land` 在 rebase 之后直接跑验证，不重新安装依赖。先合并的工单改了 `pnpm-lock.yaml` 时，后合并的工单 worktree 里缺新依赖，验证会失败；在 worktree 里运行 `pnpm install --frozen-lockfile` 后重跑 `land`。
- **常见的共享登记处**：`src/checker/rules/index.ts` 的 `ALL_RULES`、`src/cli-commands.json` 的 `ds` 子命令表、`package.json` 的脚本、`scripts/verify.ts` 的 `STEPS`、CI 工作流、`docs/cli.md`。并行的工单都要往里加一项时，派发的补充说明写"只加自己那一项"。
- **软链接的目录在 `.gitignore` 里不带斜杠**：worktree 里的 `references`、`.agents`、`.cache` 是软链接，写成 `references/` 这类带斜杠的规则匹配不到，worktree 会不干净，`land` 会拒绝合并。

`run-spec` 来自 `JinhaoFang/video-studio`，迁移方法见那边的 `docs/agents/run-spec.md`。
