# Agent Bell — AI Agent 完成提醒

当 Claude Code、Codex CLI、Gemini CLI 等 AI Agent 完成任务时，发送**系统通知**提醒你回来查看。

## 功能

- **终端命令监控** — 使用 VS Code Shell Integration 检测命令开始和结束
- **Task 监控** — 监听 VS Code 构建任务的完成
- **Debug 监控** — 监听调试会话的结束
- **系统通知** — 命令完成时发送操作系统级通知（Windows Toast / macOS / Linux）
- **VS Code 通知** — 同时在 VS Code 内弹出通知，点击可跳回终端
- **状态栏** — 实�示当前任务计数，点击查看历史
- **智能过滤** — 忽略短命令（cd, ls, pwd 等），只对长时间运行的命令通知

## 使用场景

- 在 VS Code 中运行 Claude Code，切到浏览器看文档，Claude 完成时收到通知
- 运行长时间构建命令，切到其他窗口工作，构建完成时收到提醒
- 多个终端同时运行不同任务，任何一个失败都会立即通知

## 配置

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `agentBell.notifyThreshold` | 10 | 命令运行超过此秒数后完成时通知 |
| `agentBell.ignoreCommands` | cd, ls, pwd... | 忽略的命令前缀列表 |
| `agentBell.enableSystemNotification` | true | 发送操作系统级通知 |
| `agentBell.enableVSCodeNotification` | true | 发送 VS Code 弹窗通知 |
| `agentBell.showStatusBar` | true | 显示状态栏 |
| `agentBell.notifyOnFailure` | true | 命令失败时总是通知 |

## 命令

- `Agent Bell: 显示最近会话` — 查看所有监控到的会话
- `Agent Bell: 清除历史` — 清除会话记录
- `Agent Bell: 暂停通知` — 临时停止通知
- `Agent Bell: 测试通知` — 发送一条测试通知

## 工作原理

Agent Bell 使用 VS Code 的 Shell Integration API 监听终端命令的执行。当命令开始时记录会话，命令结束时检查：

1. 命令是否失败（非零退出码）→ 总是通知
2. 命令是否运行超过阈值 → 通知
3. 命令是否在忽略列表中 → 不通知

## License

MIT
