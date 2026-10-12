# 路线图

## 目标

1. **建成设计体系库**：按方案第 8 节的四个阶段推进，0 打地基 → 1 用起来（盲选验收）→ 2 提取 → 3 扩充。阶段内容和验收标准见 `docs/plan.md` 第 8 节。
2. **用双角色流程开发**：Claude Code 当设计负责人，Codex 当工程负责人，用 `run-spec` 执行 spec。这是这套做法第一次迁移到别的仓库，迁移和使用中发现的问题回报给 `JinhaoFang/video-studio`，用来写那边路线图上的迁移初始化技能。

## 已定（2026-10-12）

| 事项 | 决定 | 写在哪 |
|---|---|---|
| 分工 | Claude Code 当设计负责人，Codex 当工程负责人；方案里由 agent 负责的审美工作归设计负责人，用户是需求方和裁判 | `AGENTS.md`「角色」、`docs/roles/` |
| 工单 | 只在 GitHub Issues 存一份，按 issue 号派发；执行角色标签 `role:*` 和分诊标签并存 | `docs/agents/issue-tracker.md` |
| 执行 | 用 `run-spec`；`implement-spec` 已移除 | `docs/workflow/README.md` |
| 分支与合并 | 每个 spec 一个集成分支 `spec/<号>-<短名>`；PR 只能用 merge commit（GitHub 设置已锁定）；`integration/phase-0` 合回 `main` 后不再使用 | `docs/agents/issue-tracker.md` |
| Codex 权限 | 完全权限 | `docs/agents/run-spec.md` |
| 提交格式 | 类型、范围、中文摘要、正文，尾注 `Refs`、`Role` | `AGENTS.md` |
| 技能 | 第三方技能不进 git；DispatchDock 和 `run-spec` 只放 `.claude/skills/` | `docs/workflow/README.md`「技能放在哪里」 |
| 命令手册 | 从 `AGENTS.md` 移到单独的文档 | `docs/cli.md` |
| 美学立场、幻灯片格式 | 品质门槛而非风格过滤；第一期交付 HTML 幻灯片 | `docs/adr/` |

## 进度

- [x] 方案 v0.3、术语表、两份 ADR
- [ ] 第 0 阶段（spec #1）：工具链和库数据已完成（#2～#16、#29）；纸本编辑①（#17）等裁判验收；#18～#28 未开始
- [x] 迁移到双角色流程：检查点 PR #30 把 `integration/phase-0` 合回 `main`；迁移本身的 PR 见 `chore/dev-workflow` 分支
- [ ] 彩排：在新会话里用第一个 spec 把 `run-spec` 完整走一遍
- [ ] 第 1～3 阶段

## 下一步

1. **用户**：审核合并 PR #30，再审核合并迁移的 PR。
2. **用户（裁判）**：验收 #17，预览命令 `pnpm ds regress && pnpm ds preview --dir out/regress`。
3. **彩排 spec**：在新会话里先说"你的角色是设计负责人。先读 docs/roadmap.md，我们要做彩排，先不要动手。"，再跑 `/grill-with-docs`，主题"开发护栏"。候选内容：
   - CI 上的间歇性失败：回归测试偶发"体系总览页有 4 个错误"，字体测试失败过一次；本机连跑两遍都通过，只在 CI 上出现。合并前的验证会因此随机失败，要先修。
   - 提交信息格式的检查：commit-msg 钩子，加上 CI 对分支上每个提交的检查。
   - "注释只写在文件头"的检查：代码约定里有这条规则，还没有检查。
   - 规则文档里写的命令必须存在的检查：video-studio 有现成的实现，但它内置的是 pnpm 10 的命令表，这里用 pnpm 12。

   然后 `/to-spec`、`/to-tickets`，再开新会话说"执行 spec #<号>"。
4. **继续第 0 阶段**：彩排合并后，新会话说"执行 spec #1"。`run-spec` 会从 `main` 新开 `spec/1-<短名>`，并按角色文档给 #18～#28 补上执行角色标签。

## 待定

- **产品技能与 worktree**：方案定的是产品技能放 `.agents/skills/` 并进 git；现在整个 `.agents` 不进 git，按目录软链接进 worktree。第 1 阶段开始写产品技能时，要改成第三方技能逐个软链接，或者第三方技能也进 git。
- **`src/` 的组织**：34 个文件平铺，要不要分组由用户裁决。
