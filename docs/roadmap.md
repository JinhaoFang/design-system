# 路线图

## 目标

1. **建成设计体系库**：按方案第 8 节的四个阶段推进，0 打地基 → 1 用起来（盲选验收）→ 2 提取 → 3 扩充。阶段内容和验收标准见 `docs/面向 AI Agent 的设计体系库_v0.3.md` 第 8 节。
2. **用双角色流程开发**：Claude Code 当设计负责人，Codex 当工程负责人，用 `run-spec` 执行 spec。这是这套做法第一次迁移到别的仓库，迁移和使用中发现的问题回报给 `JinhaoFang/video-studio`，用来写那边路线图上的迁移初始化技能。

## 已定（2026-10-12）

| 事项 | 决定 | 写在哪 |
|---|---|---|
| 分工 | Claude Code 当设计负责人，Codex 当工程负责人；体系本身和词典的确认归设计负责人，工具归工程负责人；用户是需求方和裁判 | `AGENTS.md`「角色」、`docs/roles/` |
| 工单 | 只在 GitHub Issues 存一份，按 issue 号派发；执行角色标签 `role:*` 和分诊标签并存 | `docs/agents/issue-tracker.md` |
| 执行 | 用 `run-spec`，从 video-studio 的 tag `workflow-v1` 安装（2026-10-15 起）；`implement-spec` 已移除 | `docs/workflow/README.md`、`docs/agents/run-spec.md` |
| 分支与合并 | 每个 spec 一个集成分支 `spec/<号>-<短名>`；PR 只能用 merge commit（GitHub 设置已锁定）；`integration/phase-0` 合回 `main` 后不再使用 | `docs/agents/issue-tracker.md` |
| Codex 权限 | 完全权限 | `docs/agents/run-spec.md` |
| 提交格式 | 类型、范围、中文摘要、正文，尾注 `Refs`、`Role` | `AGENTS.md` |
| 技能 | Matt 的技能和 video-studio 保持一致（19 个），不进 git；DispatchDock 和 `run-spec` 只放 `.claude/skills/` | `docs/workflow/README.md`「技能放在哪里」 |
| 命令手册 | 从 `AGENTS.md` 移到单独的文档，`AGENTS.md` 留指针（spec #1 用户故事 63 要求 agent 不必从代码推断用法，靠这个指针做到） | `docs/cli.md` |
| 美学立场、幻灯片格式 | 品质门槛而非风格过滤；第一期交付 HTML 幻灯片 | `docs/adr/` |
| 裁判验收（spec #1） | 用户 2026-10-12 授权：spec #1 余下工单的裁判验收由设计负责人代行，按领域判断给结论和评语，照常写进验收记录 | 本文、各工单的验收评论 |
| 样张与种子体系（PR #55 审查） | 用户 2026-10-13 决定：每套体系的样张用自己的题材和结构，先经用户确认内容；共享的天文台内容只作测试内容；移除精密工业；代码画得假的图改用生图（个人配置在仓库根目录被忽略的 `.env`） | 方案 3.9 节、8.1 节，`docs/workflow/README.md`「图像与评审」 |
| 体系交付范围 | 用户 2026-10-13 决定：纸本编辑之后的体系只做网页（体系正文、数值、网页排法、一件网页样张）；社交配图、幻灯片、PDF 等衍生产物和衍生脚本先不做 | 本文、spec #1 评论 |
| 体系分工（spec #1 复盘） | 2026-10-13：体系的决定和定稿由设计负责人在主会话亲手做，定稿之后同类的批量实现照定稿派给 Codex；只有文字方向不算定稿 | `docs/roles/design.md` |
| 做决定（spec #65 期间复核） | 2026-10-15：范围、费用和难回头的方向先给用户看；其余由设计负责人按推荐定，写进 spec 或工单，回复里单列；工作方式的反馈记进规则文档或本文的待定项 | `docs/roles/design.md`「工作流」 |
| 开发护栏 | `pnpm verify` 按步骤表依次检查和测试；提交信息由 commit-msg 钩子和 CI 分支检查把关；CI 不加自动重试，集成分支推送不跑 CI | `docs/workflow/README.md`「护栏」、`docs/cli.md` |

## 进度

- [x] 方案 v0.3、术语表、两份 ADR
- [x] 第 0 阶段（spec #1）：工具链和库数据（#2～#16、#29）；两套种子体系（纸本编辑三种载体，孔版印刷只做网页），验收记录在各体系的 `acceptance.md`；工具补强 #42～#54。PR #55 审查后返工：标准样张拆成测试内容和体系样张（#56），移除精密工业（#57），纸本编辑换字体（#58、#61），预览导航与体系总览页 v2（#59、#60），孔版印刷体系样张重做为露天电影季（#62、#63），收尾审查返工 #64。汇报见 `docs/reports/spec-1-phase-0.html`
- [x] 迁移到双角色流程：检查点 PR #30 把 `integration/phase-0` 合回 `main`；迁移本身是 PR #31
- [x] 彩排（spec #32 开发护栏）：`run-spec` 完整走了一遍，汇报见 `docs/reports/spec-32-dev-guardrails.html`
- [x] spec #65 工具改进：命令手册按命令分节、一条事实一行，加长行检查（#66、#70）；网页构建顺带产出分段截图和首屏入场抽帧拼图（#67）；CI 恢复通过（#72）。汇报见 `docs/reports/spec-65-tool-polish.html`
- [ ] 第 1～3 阶段

## 下一步

1. **第 1 阶段**：「用起来（盲选验收）」，先按方案第 8 节写 spec。新会话从对齐开始，这也是 video-studio 那边检验这一轮流程改进的真实 spec。

## 待定

- **CI 上的截图报错**：10-13 起 CI 每次都失败，其实是一条回归用例超时，不是偶发，#72 已修。截图报错（spec #32 的 #33）在 #67 的抽帧里又出现过一次，现在网页构建的 `web-qa.json` 会记下失败发生在导航前、导航中还是入场中，再出现时据此定位；"体系总览页有 4 个错误"的根因仍未锁定。
- **产品技能与 worktree**：方案定的是产品技能放 `.agents/skills/` 并进 git；现在整个 `.agents` 不进 git，按目录软链接进 worktree。第 1 阶段开始写产品技能时，要改成第三方技能逐个软链接，或者第三方技能也进 git。
- **第 0 阶段的遗留**：幻灯片 PDF 约 15MB（颗粒层打印时被栅格化）；排法之间不能共享样式；体系总览页长文的孤字警告。详见各体系 `acceptance.md`「留给以后的」。
- **`src/` 的组织**：34 个文件平铺，要不要分组由用户裁决。
- **spec #1 子代理留下的分支**：`.claude/worktrees/proto-paper`，本地分支 `design/ind`、`design/riso`、`prototype/paper-editorial-direction`（远端也有），`cleanup` 不认这些名字。删不删由用户定。
