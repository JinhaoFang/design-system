# 执行技能的本仓库配置

执行技能 `run-spec` 只写通用步骤，本仓库特有的值放在两处：

- `docs/agents/run-spec.json`：工单脚本要读的值；
- 本文：配置项的含义，以及脚本用不到、但设计负责人执行时要知道的值。

`run-spec` 和 `setup-run-spec` 从 `JinhaoFang/video-studio` 的版本 tag 安装，不进 git，当前固定在 `workflow-v3`。升级时把命令里 `#` 后面的版本换成新 tag 再运行：

```bash
npx skills add JinhaoFang/video-studio#workflow-v3 --skill run-spec --skill setup-run-spec -a claude-code -y
```

不要用 `npx skills update` 或按锁文件恢复：它们会把这两个技能装进 `.agents/skills/`，Codex 就能看到了。更新完运行自检：`node .claude/skills/run-spec/scripts/tickets.ts doctor`。

## 脚本读取的配置

`run-spec.json` 的前六项必填，缺文件或缺项时脚本以 2 退出，并说明缺了什么。`codexConcurrency` 和 `prCheckCommand` 可选，不写就取默认值，格式错误同样以 2 退出；`doctor` 报告它们的实际取值和来源（配置、环境变量或默认）。命令一律写成参数数组。

| 配置项 | 本仓库的值 | 含义 |
|---|---|---|
| `verificationCommand` | `["pnpm", "verify"]` | 验证命令。`land` 在 worktree 里合并前运行它；派发指令也让 Codex 用它验证。 |
| `installCommand` | `["pnpm", "install", "--frozen-lockfile"]` | 安装命令。`dispatch` 新建 worktree 后运行，`land` 在 rebase 之后、验证之前再运行一次；成功只打印一行结果，失败回放完整输出并以 2 退出，重跑时补完安装。 |
| `symlinkDirectories` | `["references", ".agents", ".cache"]` | 不进 git、但 Codex 要读的目录。`dispatch` 把它们从主工作区软链接进 worktree，派发指令要求只读使用。本仓库是参考项目、第三方技能（Matt 的技能）和构建要读的字体缓存（`.cache/fonts`）。 |
| `acceptanceRoot` | `"out/qa"` | 验收产物根目录。每张工单写到下面的 `spec-<S>/<T>/`；`land` 把它复制回主工作区，`cleanup` 整个删掉 `spec-<S>/`。 |
| `codexSandbox` | `"danger-full-access"` | 派发时 Codex 的权限。完全权限让 Codex 能联网、能用 `gh` 读 issue，测试也要起无头浏览器。 |
| `dispatchScript` | `".claude/skills/codex-dispatch/codex-task.mjs"` | DispatchDock 的派发脚本，路径相对主工作区。 |
| `codexConcurrency` | 不写（默认 `2`） | 可选。同时运行的 Codex 派发上限，`dispatch` 到上限时排队。环境变量 `RUN_SPEC_CODEX_CONCURRENCY` 优先于配置。 |
| `prCheckCommand` | 不写（默认 `["gh", "pr", "checks", "{pr}", "--watch"]`） | 可选。`pr-check` 运行的 PR 检查命令，`{pr}` 换成 PR 号。仓库的 CI 不能用时改成本机的检查命令。 |

## 执行时要知道的其他值

- **按批审查**：审查不走 `dispatch`，用 `dispatchScript` 指向的派发脚本直接派发，`--sandbox` 填 `codexSandbox`。
- **独占资源**：无。
- **汇报目录**：`docs/reports/`，写法按 `run-spec` 的 `report.md`。版式沿用第一份 `spec-32-dev-guardrails.html`。
- **验证用时**：`pnpm verify` 在本机约 2 分钟（测试会起无头浏览器）。并行验证：两套同时跑经过实测是安全的（spec #32 的 #33）；三张工单并行时各自的验证也都通过了，但没有专门压测三套同时跑。CI 的机器是 2 核，测试约 5 分钟。
- **派发实测用时**（spec #32）：工具类工单 10～18 分钟，输入 100 万～270 万 tokens（九成以上命中缓存）；要在 CI 上反复运行找原因的排查工单约 40 分钟、870 万 tokens；按批审查约 5 分钟。`land` 的验证每次约 2 分钟。
- **常见的共享登记处**：`src/checker/rules/index.ts` 的 `ALL_RULES`、`src/cli-commands.json` 的 `ds` 子命令表、`package.json` 的脚本、`scripts/verify.ts` 的 `STEPS`、CI 工作流、`docs/cli.md`。并行的工单都要往里加一项时，派发的补充说明写"只加自己那一项"。
- **软链接的目录在 `.gitignore` 里不带斜杠**：worktree 里的 `references`、`.agents`、`.cache` 是软链接，写成 `references/` 这类带斜杠的规则匹配不到，worktree 会不干净，`land` 会拒绝合并。
