# Agent Bell — VS Code Extension Design Spec

**Date:** 2026-05-20
**Status:** Draft
**MVP Scope:** Phase 1 — Terminal, Task, and Debug session monitoring

## Problem Statement

In vibe coding and multi-agent workflows, users open multiple VS Code windows and run long-lived commands (Claude Code, Codex CLI, Gemini CLI, builds, tests) across terminals. When a command finishes, fails, or an agent waits for input, there is no cross-window or cross-terminal notification. Users miss important events because they're focused on another window or agent.

## Solution

Agent Bell is a VS Code extension that monitors terminal commands, Tasks, and Debug sessions. It notifies the user via VS Code notifications and a status bar badge when monitored sessions complete, fail, or wait for input. Notifications are clickable and jump directly to the relevant terminal or session.

## Architecture

### Pattern: Event Bus + Adapter

```
Terminal Adapter ──┐
Task Adapter    ───┤──→ Event Bus ──→ Session Store
Debug Adapter   ───┘         │
                             └──→ Notifier ──→ VS Code Notification
                             └──→ Status Bar
```

Each adapter watches one VS Code event source, converts it to a unified `SessionEvent`, and fires it through the Event Bus. The Session Store tracks state. The Notifier applies rules and displays alerts.

### Core Data Model

```typescript
interface Session {
  id: string;                    // unique ID (crypto.randomUUID)
  source: 'terminal' | 'task' | 'debug' | 'agent';
  project: string;               // workspace folder name
  name: string;                  // terminal name / task label / debug config name
  command?: string;              // the command string (terminal only)
  startTime: number;             // Date.now()
  endTime?: number;              // set when finished
  duration?: number;             // computed: endTime - startTime
  exitCode?: number;             // 0 = success, non-zero = failure
  status: 'running' | 'waiting' | 'done' | 'failed';
}

type SessionEvent =
  | { type: 'started'; session: Session }
  | { type: 'ended'; session: Session }
  | { type: 'waiting'; session: Session };
```

**Notification decision rules:**

| Condition | Notify? |
|---|---|
| `exitCode !== 0` (failure) | ALWAYS — regardless of threshold or ignore list |
| `duration > threshold` and not in ignore list | YES |
| `duration > threshold` but in ignore list | NO (ignore list only applies to success) |
| `duration <= threshold` | NO |

### Components

#### EventBus (`src/core/event-bus.ts`)

Simple typed `vscode.EventEmitter<SessionEvent>` wrapper. Single instance, shared across all adapters and the notifier.

#### SessionStore (`src/core/session-store.ts`)

- `active: Map<string, Session>` — currently running sessions
- `recent: Session[]` — last 50 completed sessions (ring buffer)
- Subscribes to Event Bus, updates state on each event
- Exposes `getActive()` and `getRecent()` for the status bar and Quick Pick

#### Notifier (`src/core/notifier.ts`)

Subscribes to the Event Bus. For each `ended` event, applies the decision rules. When notifying:

1. Shows `vscode.InformationMessage` with action buttons: `"Go to Terminal"` / `"Dismiss"`
2. For terminal sessions: clicking `"Go to Terminal"` calls `terminal.show()` to focus the specific terminal
3. For task sessions: clicking focuses the terminal where the task ran (tasks always run in a terminal)
4. For debug sessions: clicking focuses the Debug Console panel via `vscode.debug.activeDebugConsole`

#### Adapters

**Terminal Adapter** (`src/adapters/terminal.ts`):
- Primary: `vscode.window.onDidStartTerminalShellExecution` / completion event (Shell Integration)
- Fallback: `vscode.window.onDidChangeTerminalState` (process detection)
- Extracts: terminal name, command string, workspace folder, exit code
- Applies ignore list (prefix match) before emitting events

**Task Adapter** (`src/adapters/task.ts`):
- `vscode.tasks.onDidStartTask` → emit `started`
- `vscode.tasks.onDidEndTask` → emit `ended` with exit code from `TaskEndEvent`
- Task label + execution command become `session.name` and `session.command`

**Debug Adapter** (`src/adapters/debug.ts`):
- `vscode.debug.onDidStartDebugSession` → emit `started`
- `vscode.debug.onDidTerminateDebugSession` → emit `ended`
- No exit code — status is `'done'` on normal termination, `'failed'` if unexpected

#### UI

**Status Bar** (`src/ui/status-bar.ts`):
- Persistent `StatusBarItem` aligned right
- Shows: `$(bell) 2 done | 1 running`
- Clicking opens Quick Pick dashboard
- Turns yellow when there are unread notifications

**Quick Pick** (`src/ui/quick-pick.ts`):
- Lists recent sessions with source icon, name/command, duration, status
- Selecting a terminal session item calls `terminal.show()` to focus that terminal
- Selecting a task session item focuses the terminal where the task ran (via `TaskExecution.task.presentationOptions.reveal`)
- Selecting a debug session item focuses the Debug Console panel
- Has a `"Clear History"` button at the bottom that triggers the `agentBell.clearHistory` command

#### Config (`src/config.ts`)

Reads VS Code settings and provides typed access:

| Setting | Type | Default | Description |
|---|---|---|---|
| `agentBell.notifyThreshold` | number | 15 | Only notify if command ran longer than N seconds |
| `agentBell.ignoreCommands` | string[] | `["cd","ls","pwd","clear","echo","cat","grep","mkdir","touch","rm","cp","mv","source","export","alias"]` | Command prefixes to ignore (unless they fail) |
| `agentBell.showStatusBar` | boolean | true | Show status bar item |
| `agentBell.notifyOnFailure` | boolean | true | Always notify on non-zero exit code |

#### Commands

| Command | Description |
|---|---|
| `agentBell.showSessions` | Open Quick Pick dashboard |
| `agentBell.clearHistory` | Clear session store |
| `agentBell.pauseNotifications` | Temporarily disable notifications (session-only, resets on VS Code restart) |

### File Structure

```
agent-bell/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts          # activate/deactivate, wire components
│   ├── core/
│   │   ├── types.ts          # Session, SessionEvent interfaces
│   │   ├── event-bus.ts      # EventBus class
│   │   ├── session-store.ts  # SessionStore class
│   │   └── notifier.ts       # notification decision logic
│   ├── adapters/
│   │   ├── terminal.ts       # Terminal Adapter (Shell Integration)
│   │   ├── task.ts           # Task Adapter
│   │   └── debug.ts          # Debug Adapter
│   ├── ui/
│   │   ├── status-bar.ts     # Status bar item
│   │   └── quick-pick.ts     # Quick Pick dashboard
│   └── config.ts             # VS Code settings accessor
├── .vscodeignore
└── README.md
```

### Dependency Graph

```
extension.ts
  ├── config.ts
  ├── core/event-bus.ts
  ├── core/session-store.ts  ← event-bus, types
  ├── core/notifier.ts       ← event-bus, types, config
  ├── adapters/terminal.ts   ← event-bus, types, config
  ├── adapters/task.ts       ← event-bus, types
  ├── adapters/debug.ts      ← event-bus, types
  ├── ui/status-bar.ts       ← core/session-store, types
  └── ui/quick-pick.ts       ← core/session-store, types
```

`core/` has zero VS Code UI dependencies. `adapters/` depends on VS Code API events. `ui/` depends on VS Code UI API.

## Future Expansion (Not in MVP)

- `src/adapters/agent-cli.ts` — CLI Helper adapter for Claude Code hooks, Codex, Gemini CLI
- `src/ui/dashboard.ts` — Webview-based multi-window dashboard
- `src/core/sound.ts` — Sound notifications
- `src/core/webhook.ts` — Webhook notifications (Slack, Discord)
- `src/core/mobile.ts` — Mobile push notifications

## Success Criteria

1. Terminal commands that run >15s trigger a VS Code notification when they end
2. Failed commands (non-zero exit) always trigger a notification regardless of duration
3. Ignored commands (`cd`, `ls`, etc.) with exit code 0 never trigger notifications
4. Status bar shows current task count and is clickable
5. Clicking a notification focuses the correct terminal
6. VS Code Tasks and Debug sessions are monitored with same rules
7. All settings are configurable via VS Code settings UI
