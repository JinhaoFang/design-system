# 开发工作流

一项工作从想法到合并，谁在什么时候用什么。具体步骤写在各技能和角色文档里，这里是总图。产品本身的产出流程（需求翻译、一次产出、提取）见 `docs/面向 AI Agent 的设计体系库_v0.3.md` 第 4～6 节。

## 一项工作的生命周期

| 阶段 | 谁触发 | 用什么 | 产物在哪 |
|---|---|---|---|
| 想清楚 | 用户 | `/grill-with-docs` | 术语进 `GLOSSARY.md`，难回头的决定进 `docs/adr/` |
| 写 spec | 用户 | `/to-spec` | GitHub issue |
| 拆工单 | 用户 | `/to-tickets` | spec 的 sub-issue，带阻塞关系；格式见 `docs/agents/issue-tracker.md` |
| 执行与验收 | 用户在新会话里说"执行 spec #号"，设计负责人照做 | `run-spec`（内部用 `codex-dispatch`） | 集成分支上的提交、工单下的验收评论、`docs/reports/` 的汇报 |
| 合并 | 用户 | PR（正文用 `/pr` 的格式），只能用 merge commit | `main` |
| 复盘 | 用户 | `/retro` | 规则文档、检查脚本、文档指针 |

执行阶段的回路：

```
GitHub                        设计负责人（Claude Code）                      工程负责人（Codex）
spec #S
 └ 工单 #T  ─ 选出前置都已关闭的工单
   role:design      → 自己做、验收、提交
   role:engineering → 按 issue 号派发 ───────────────────────────→ 读 #T 和 #S，做完、提交（Refs: #T）、写汇报
                     ← 看汇报（TODO(design)、推断清单）、实测验收产物 ←──────────┘
   ready-for-human  → 告诉用户要做什么
 └ 合并、评论验收结论、关闭 #T；每批合并后派 Codex 审查；全部关闭后再审一次、开 PR "Closes #S"、写汇报、清理
```

## 什么放在哪里

- **GitHub**：spec、工单、验收评论、PR。它们是过程记录，只存这一份。
- **仓库**：长期有效的东西，包括方案、规则、术语与 ADR、种子体系、库数据、代码和测试。工单要用仓库里的文件时写路径，不复制内容。
- **只在本机**：`.codex-runs/`（派发记录）、`out/`（构建、回归和验收产物）、`.cache/fonts`（抓取的字体）、`references/`（参考项目）、第三方技能。

## 技能放在哪里

| 技能 | 位置 | 进 git | 谁看得到 |
|---|---|---|---|
| 第三方开发技能（Matt 的技能） | `.agents/skills/`，`.claude/skills/` 下放指向它的软链接 | 不进。`skills-lock.json` 记录装了哪些（和 video-studio 相同的 19 个），重装时只装其中列出的技能 | Claude Code 和 Codex |
| DispatchDock 的 `codex-dispatch`、`dual-role-workflow` | 只在 `.claude/skills/` | 不进。用 `references/DispatchDock` 的安装器重装，命令见下 | 只有 Claude Code |
| 执行技能 `run-spec` | 只在 `.claude/skills/` | 进 | 只有 Claude Code |
| 本库的产品技能（方案 7.2 节，第 1 阶段开始写） | 方案定为 `.agents/skills/`，统一加前缀 | 进 | Claude Code 和 Codex |

Codex 能看到 `.agents/skills/` 下的全部技能，所以设计负责人专用的技能只放 `.claude/skills/`。DispatchDock 的安装命令（固定 v0.1.3，先在 `references/DispatchDock` 里 `git checkout v0.1.3`）：

```bash
node references/DispatchDock/installer/install.mjs --host claude-code --claude-dir "$PWD/.claude/skills" --no-config --yes
```

第三方技能在 #31 退出 git 跟踪。在主工作区切到还跟踪着它们的提交（`main` 上 #31 合并之前的提交，或者迁移前拉出的分支，例如 `prototype/paper-editorial-direction`），再切回来，本机的第三方技能和 `.claude/skills/` 下的软链接会全部消失：切过去时，git 用旧提交里的版本覆盖了这些被忽略的文件；切回来时，它们在新提交里不再跟踪，git 就把它们删了。DispatchDock 的技能和 `run-spec` 不受影响。查看迁移前的历史，用 `git show`，或者另开一个 worktree 切过去，不在主工作区切换。已经被删的，从刚才切过去的那个旧提交里恢复 `skills-lock.json` 列出的技能：

```bash
git restore --source=<旧提交> --worktree -- $(node -e 'for (const s of Object.keys(require("./skills-lock.json").skills)) console.log(`.agents/skills/${s} .claude/skills/${s}`)')
```

不要直接恢复整个 `.agents/skills` 和 `.claude/skills`：旧提交里没有 `run-spec`，会把它从工作区删掉，还会带回已经移除的旧技能（如 `implement-spec`）。

## 护栏

- `pnpm verify`：按步骤依次运行类型检查和全部测试，每步先打印标签，前一步失败就停止并保留退出码，完成标准以它通过为准。步骤表在 `scripts/verify.ts`；扩展方式见 `docs/cli.md`。测试会用无头浏览器真实渲染，全量约 2 分钟。
- CI：推送和开 PR 时跑类型检查和测试；回归（`regress` 工作流）手动触发。

## 图像与评审

- 体系的图像（标准样张的图像简报、排法和定制片段里的图）默认用代码渲染（HTML、CSS、SVG），生成脚本放在体系目录的 `images/src/`，构建只读 `images/` 里的成品。
- 判断代码画出来会僵硬、假（例如人物、真实场景的光影）时，改用生图模型。成品直接使用，还是作为底图再叠加代码（标注、朱笔、动效等），由设计负责人按需要决定；要加动效的，必须叠加代码。生图的提示词配方放在 `images/src/`，不放接口地址和密钥（方案第 5.4 节）。
- 插图、海报这类以图像本身为交付物的媒介，可以直接使用生图方式。
- 不另外制作视频。录屏只来自构建产物（如 `web-scroll.webm`）和范例库，用于评审和对照。
- 交给裁判评审的网页、幻灯片和范例，要让裁判能亲自操作：给出可运行的预览（一条命令起服务）或可访问的链接，截图和录屏只作补充。插图、海报这类静态媒介可以直接看图。

## 路线图

`docs/roadmap.md` 是每个新会话的入口。它不会被自动加载，靠用户在开场白里点名，例如"你的角色是设计负责人。先读 docs/roadmap.md"。

- 内容只放四部分：**目标**（每条一句）、**已定**（事项、一句话结论、写在哪，全文留在出处）、**进度**（勾选清单，做完的附上记录的位置）、**下一步**（新会话的第一件事和还没定的事）。
- 设计负责人在每个阶段收尾时更新进度和下一步，和收尾的提交一起提交；出处改了，路线图只改指针。
- 全部完成时：已定的行在出处写全后删除；已完成的进度删除，记录在汇报和 git 历史里；仓库还要继续，就写上下一阶段的目标和下一步。

## 注意

- Codex 运行期间不要关掉 Claude Code 会话。只用技能时没有托管模式，关掉会话可能连带中断 Codex。
- 派发、合并、验收、审查、收尾的具体步骤只写在执行技能 `run-spec` 里，本仓库的值见 `docs/agents/run-spec.md`。
