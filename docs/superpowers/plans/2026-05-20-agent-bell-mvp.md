# Agent Bell MVP 实现计划

> **致自动化代理：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 技能逐步执行此计划。步骤使用 `- [ ]` 语法进行跟踪。

**目标：** 构建一个 VS Code 扩展，监控终端命令、Task 和 Debug 会话，当长时间命令完成或失败时通过状态栏和通知提醒用户。

**架构：** Event Bus + Adapter 模式。每个数据源（终端/Task/Debug）是一个独立 Adapter，通过 EventBus 发射统一的 SessionEvent。SessionStore 跟踪状态，Notifier 根据规则决定是否通知。

**技术栈：** TypeScript, VS Code Extension API (Shell Integration), esbuild 打包

**最低 VS Code 版本：** 1.96（Shell Integration API 稳定版）

---

## 文件结构

```
agent-bell/
├── package.json              # 扩展清单 + 配置 + 命令
├── tsconfig.json
├── esbuild.js                # 打包脚本
├── .vscodeignore
├── src/
│   ├── extension.ts          # 入口，组装所有组件
│   ├── core/
│   │   ├── types.ts          # Session, SessionEvent 接口
│   │   ├── event-bus.ts      # EventBus 类
│   │   ├── session-store.ts  # SessionStore 类
│   │   └── notifier.ts       # 通知决策逻辑
│   ├── adapters/
│   │   ├── terminal.ts       # 终端适配器（Shell Integration）
│   │   ├── task.ts           # Task 适配器
│   │   └── debug.ts          # Debug 适配器
│   ├── ui/
│   │   ├── status-bar.ts     # 状态栏
│   │   └── quick-pick.ts     # Quick Pick 仪表盘
│   └── config.ts             # 配置读取
```

---

## Task 1: 项目脚手架

**文件：**
- 创建: `package.json`, `tsconfig.json`, `esbuild.js`, `.vscodeignore`

- [ ] **步骤 1: 创建 package.json**

```json
{
  "name": "agent-bell",
  "displayName": "Agent Bell",
  "description": "Multi-agent 编程场景下的任务完成提醒",
  "version": "0.1.0",
  "publisher": "agent-bell",
  "engines": {
    "vscode": "^1.96.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "configuration": {
      "title": "Agent Bell",
      "properties": {
        "agentBell.notifyThreshold": {
          "type": "number",
          "default": 15,
          "description": "命令运行超过此秒数才通知（失败除外）"
        },
        "agentBell.ignoreCommands": {
          "type": "array",
          "default": ["cd", "ls", "pwd", "clear", "echo", "cat", "grep", "mkdir", "touch", "rm", "cp", "mv", "source", "export", "alias"],
          "items": { "type": "string" },
          "description": "忽略的命令前缀列表（仅在成功时生效）"
        },
        "agentBell.showStatusBar": {
          "type": "boolean",
          "default": true,
          "description": "是否显示状态栏"
        },
        "agentBell.notifyOnFailure": {
          "type": "boolean",
          "default": true,
          "description": "失败时是否总是通知（忽略阈值）"
        }
      }
    },
    "commands": [
      {
        "command": "agentBell.showSessions",
        "title": "Agent Bell: 显示最近会话"
      },
      {
        "command": "agentBell.clearHistory",
        "title": "Agent Bell: 清除历史"
      },
      {
        "command": "agentBell.pauseNotifications",
        "title": "Agent Bell: 暂停通知"
      }
    ]
  },
  "scripts": {
    "build": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/vscode": "^1.96.0",
    "esbuild": "^0.24.0",
    "@vscode/vsce": "^3.0.0"
  }
}
```

- [ ] **步骤 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **步骤 3: 创建 esbuild.js**

```javascript
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  platform: 'node',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  logLevel: 'info',
});

if (watch) {
  ctx.then(ctx => ctx.watch());
} else {
  ctx.then(ctx => ctx.rebuild()).then(() => ctx.dispose());
}
```

- [ ] **步骤 4: 创建 .vscodeignore**

```
.vscode/**
src/**
node_modules/**
.eslintrc.json
tsconfig.json
esbuild.js
.gitignore
```

- [ ] **步骤 5: 创建目录结构并安装依赖**

```bash
cd "e:/vibe coding/Agent Bell"
mkdir -p src/core src/adapters src/ui
npm install
```

- [ ] **步骤 6: 提交**

```bash
git init && git add -A && git commit -m "feat: 项目脚手架"
```

---

## Task 2: 核心类型 + EventBus

**文件：**
- 创建: `src/core/types.ts`
- 创建: `src/core/event-bus.ts`

- [ ] **步骤 1: 创建 types.ts**

```typescript
export type SessionSource = 'terminal' | 'task' | 'debug' | 'agent';
export type SessionStatus = 'running' | 'waiting' | 'done' | 'failed';

export interface Session {
  id: string;
  source: SessionSource;
  project: string;
  name: string;
  command?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  exitCode?: number;
  status: SessionStatus;
  /** 用于关联 VS Code 对象（Terminal / TaskExecution 等） */
  ref?: unknown;
}

export type SessionEvent =
  | { type: 'started'; session: Session }
  | { type: 'ended'; session: Session }
  | { type: 'waiting'; session: Session };
```

- [ ] **步骤 2: 创建 event-bus.ts**

```typescript
import * as vscode from 'vscode';
import { SessionEvent } from './types';

export class EventBus {
  private readonly _emitter = new vscode.EventEmitter<SessionEvent>();

  readonly on = this._emitter.event;

  fire(event: SessionEvent): void {
    this._emitter.fire(event);
  }

  dispose(): void {
    this._emitter.dispose();
  }
}
```

- [ ] **步骤 3: 验证编译**

```bash
npm run build
```

预期：无错误，`dist/extension.js` 生成（会提示 extension.ts 缺失，忽略）

- [ ] **步骤 4: 提交**

```bash
git add src/core/types.ts src/core/event-bus.ts
git commit -m "feat: 核心类型和 EventBus"
```

---

## Task 3: Config 模块

**文件：**
- 创建: `src/config.ts`

- [ ] **步骤 1: 创建 config.ts**

```typescript
import * as vscode from 'vscode';

export interface AgentBellConfig {
  notifyThreshold: number;
  ignoreCommands: string[];
  showStatusBar: boolean;
  notifyOnFailure: boolean;
}

const SECTION = 'agentBell';

export function getConfig(): AgentBellConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    notifyThreshold: cfg.get<number>('notifyThreshold', 15),
    ignoreCommands: cfg.get<string[]>('ignoreCommands', [
      'cd', 'ls', 'pwd', 'clear', 'echo', 'cat', 'grep',
      'mkdir', 'touch', 'rm', 'cp', 'mv', 'source', 'export', 'alias',
    ]),
    showStatusBar: cfg.get<boolean>('showStatusBar', true),
    notifyOnFailure: cfg.get<boolean>('notifyOnFailure', true),
  };
}

/** 检查命令是否在忽略列表中（前缀匹配） */
export function shouldIgnoreCommand(command: string, ignoreList: string[]): boolean {
  const trimmed = command.trim();
  return ignoreList.some(prefix => trimmed === prefix || trimmed.startsWith(prefix + ' '));
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/config.ts
git commit -m "feat: Config 模块"
```

---

## Task 4: SessionStore

**文件：**
- 创建: `src/core/session-store.ts`

- [ ] **步骤 1: 创建 session-store.ts**

```typescript
import { Session, SessionEvent } from './types';
import { EventBus } from './event-bus';

const MAX_RECENT = 50;

export class SessionStore {
  private readonly _active = new Map<string, Session>();
  private readonly _recent: Session[] = [];

  constructor(private readonly bus: EventBus) {
    this.bus.on(e => this._handleEvent(e));
  }

  private _handleEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'started':
        this._active.set(event.session.id, event.session);
        break;
      case 'ended': {
        const s = event.session;
        this._active.delete(s.id);
        s.endTime = Date.now();
        s.duration = s.endTime - s.startTime;
        s.status = s.exitCode !== undefined && s.exitCode !== 0 ? 'failed' : 'done';
        this._recent.unshift(s);
        if (this._recent.length > MAX_RECENT) {
          this._recent.pop();
        }
        break;
      }
      case 'waiting': {
        const existing = this._active.get(event.session.id);
        if (existing) {
          existing.status = 'waiting';
        }
        break;
      }
    }
  }

  getActive(): Session[] {
    return Array.from(this._active.values());
  }

  getRecent(): Session[] {
    return [...this._recent];
  }

  clear(): void {
    this._recent.length = 0;
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/core/session-store.ts
git commit -m "feat: SessionStore"
```

---

## Task 5: Notifier

**文件：**
- 创建: `src/core/notifier.ts`

- [ ] **步骤 1: 创建 notifier.ts**

```typescript
import * as vscode from 'vscode';
import { Session, SessionEvent } from './types';
import { EventBus } from './event-bus';
import { getConfig, shouldIgnoreCommand } from '../config';

export class Notifier {
  private _paused = false;

  constructor(private readonly bus: EventBus) {
    this.bus.on(e => this._handleEvent(e));
  }

  private _handleEvent(event: SessionEvent): void {
    if (event.type !== 'ended' || this._paused) {
      return;
    }
    const session = event.session;
    if (this._shouldNotify(session)) {
      this._notify(session);
    }
  }

  private _shouldNotify(session: Session): boolean {
    const config = getConfig();

    // 失败总是通知
    if (config.notifyOnFailure && session.exitCode !== undefined && session.exitCode !== 0) {
      return true;
    }

    // 未超阈值不通知
    const durationSec = (session.duration ?? 0) / 1000;
    if (durationSec <= config.notifyThreshold) {
      return false;
    }

    // 忽略列表中的命令不通知（仅成功时）
    if (session.command && shouldIgnoreCommand(session.command, config.ignoreCommands)) {
      return false;
    }

    return true;
  }

  private _notify(session: Session): void {
    const icon = session.status === 'failed' ? '$(error)' : '$(check)';
    const duration = this._formatDuration(session.duration ?? 0);
    const message = `${icon} ${session.name} ${session.status === 'failed' ? '失败' : '完成'} (${duration})`;

    const actions = session.source === 'terminal' ? ['跳转到终端'] : ['查看'];
    actions.push('忽略');

    vscode.window.showInformationMessage(message, ...actions).then(choice => {
      if (choice === '跳转到终端' || choice === '查看') {
        this._focusSession(session);
      }
    });
  }

  private _focusSession(session: Session): void {
    const terminal = session.ref as vscode.Terminal | undefined;
    if (terminal && 'show' in terminal) {
      (terminal as vscode.Terminal).show();
    }
  }

  private _formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) {
      return `${sec}秒`;
    }
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    return `${min}分${remainSec}秒`;
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
  }

  get isPaused(): boolean {
    return this._paused;
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/core/notifier.ts
git commit -m "feat: Notifier 通知逻辑"
```

---

## Task 6: Terminal Adapter

**文件：**
- 创建: `src/adapters/terminal.ts`

- [ ] **步骤 1: 创建 terminal.ts**

```typescript
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';
import { getConfig, shouldIgnoreCommand } from '../config';

export class TerminalAdapter {
  /** execution 对象 → session 的映射 */
  private readonly _execToSession = new Map<unknown, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    // Shell Integration: 命令开始
    disposables.push(
      vscode.window.onDidStartTerminalShellExecution(e => {
        const command = e.execution.commandLine.value;
        const config = getConfig();

        // 忽略列表中的命令直接跳过（不创建 session）
        if (shouldIgnoreCommand(command, config.ignoreCommands)) {
          return;
        }

        const session: Session = {
          id: crypto.randomUUID(),
          source: 'terminal',
          project: this._getProjectName(e.terminal),
          name: e.terminal.name,
          command,
          startTime: Date.now(),
          status: 'running',
          ref: e.terminal,
        };

        this._execToSession.set(e.execution, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    // Shell Integration: 命令结束
    disposables.push(
      vscode.window.onDidEndTerminalShellExecution(e => {
        const session = this._execToSession.get(e.execution);
        if (!session) {
          return;
        }
        this._execToSession.delete(e.execution);

        session.exitCode = e.exitCode ?? 1; // undefined 视为失败
        session.ref = e.terminal;
        this.bus.fire({ type: 'ended', session });
      })
    );

    return vscode.Disposable.from(...disposables);
  }

  private _getProjectName(terminal: vscode.Terminal): string {
    const cwd = terminal.creationOptions?.cwd;
    if (cwd) {
      const uri = typeof cwd === 'string' ? vscode.Uri.file(cwd) : cwd;
      const folder = vscode.workspace.getWorkspaceFolder(uri);
      if (folder) {
        return folder.name;
      }
    }
    return vscode.workspace.workspaceFolders?.[0]?.name ?? '未知项目';
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/adapters/terminal.ts
git commit -m "feat: Terminal Adapter (Shell Integration)"
```

---

## Task 7: Task Adapter

**文件：**
- 创建: `src/adapters/task.ts`

- [ ] **步骤 1: 创建 task.ts**

```typescript
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';

export class TaskAdapter {
  /** task.id → session */
  private readonly _taskToSession = new Map<string, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    // Task 开始
    disposables.push(
      vscode.tasks.onDidStartTask(e => {
        const task = e.execution.task;
        const session: Session = {
          id: crypto.randomUUID(),
          source: 'task',
          project: vscode.workspace.workspaceFolders?.[0]?.name ?? '未知项目',
          name: task.name,
          command: this._getCommandString(task),
          startTime: Date.now(),
          status: 'running',
          ref: e.execution,
        };

        this._taskToSession.set(task.id, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    // Task 进程结束（获取 exit code）
    disposables.push(
      vscode.tasks.onDidEndTaskProcess(e => {
        const session = this._taskToSession.get(e.execution.task.id);
        if (!session) {
          return;
        }
        this._taskToSession.delete(e.execution.task.id);

        session.exitCode = e.exitCode ?? 1;
        session.ref = e.execution;
        this.bus.fire({ type: 'ended', session });
      })
    );

    return vscode.Disposable.from(...disposables);
  }

  private _getCommandString(task: vscode.Task): string | undefined {
    const exec = task.execution;
    if (!exec) {
      return undefined;
    }
    if ('command' in exec) {
      return (exec as vscode.ShellExecution).command;
    }
    if ('process' in exec) {
      return (exec as vscode.ProcessExecution).process;
    }
    return undefined;
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/adapters/task.ts
git commit -m "feat: Task Adapter"
```

---

## Task 8: Debug Adapter

**文件：**
- 创建: `src/adapters/debug.ts`

- [ ] **步骤 1: 创建 debug.ts**

```typescript
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';

export class DebugAdapter {
  /** DebugSession.id → session */
  private readonly _debugToSession = new Map<string, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    // Debug 会话开始
    disposables.push(
      vscode.debug.onDidStartDebugSession(debugSession => {
        const session: Session = {
          id: crypto.randomUUID(),
          source: 'debug',
          project: vscode.workspace.workspaceFolders?.[0]?.name ?? '未知项目',
          name: debugSession.name,
          startTime: Date.now(),
          status: 'running',
          ref: debugSession,
        };

        this._debugToSession.set(debugSession.id, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    // Debug 会话结束
    disposables.push(
      vscode.debug.onDidTerminateDebugSession(debugSession => {
        const session = this._debugToSession.get(debugSession.id);
        if (!session) {
          return;
        }
        this._debugToSession.delete(debugSession.id);

        session.ref = debugSession;
        this.bus.fire({ type: 'ended', session });
      })
    );

    return vscode.Disposable.from(...disposables);
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/adapters/debug.ts
git commit -m "feat: Debug Adapter"
```

---

## Task 9: 状态栏

**文件：**
- 创建: `src/ui/status-bar.ts`

- [ ] **步骤 1: 创建 status-bar.ts**

```typescript
import * as vscode from 'vscode';
import { SessionStore } from '../core/session-store';
import { getConfig } from '../config';

export class StatusBarUI {
  private readonly _item: vscode.StatusBarItem;

  constructor(private readonly store: SessionStore) {
    this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this._item.command = 'agentBell.showSessions';
    this._item.tooltip = 'Agent Bell — 点击查看会话';
  }

  activate(): vscode.Disposable {
    this._update();
    return this._item;
  }

  update(): void {
    this._update();
  }

  private _update(): void {
    const config = getConfig();
    if (!config.showStatusBar) {
      this._item.hide();
      return;
    }

    const active = this.store.getActive().length;
    const recent = this.store.getRecent();
    const failed = recent.filter(s => s.status === 'failed').length;
    const done = recent.filter(s => s.status === 'done').length;

    let text = '$(bell)';
    const parts: string[] = [];
    if (done > 0) {
      parts.push(`${done} 完成`);
    }
    if (failed > 0) {
      parts.push(`${failed} 失败`);
    }
    if (active > 0) {
      parts.push(`${active} 运行中`);
    }

    if (parts.length > 0) {
      text += ' ' + parts.join(' | ');
    } else {
      text += ' 就绪';
    }

    this._item.text = text;
    this._item.color = failed > 0
      ? new vscode.ThemeColor('statusBarItem.warningForeground')
      : undefined;
    this._item.backgroundColor = failed > 0
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;
    this._item.show();
  }

  dispose(): void {
    this._item.dispose();
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/ui/status-bar.ts
git commit -m "feat: 状态栏 UI"
```

---

## Task 10: Quick Pick 仪表盘

**文件：**
- 创建: `src/ui/quick-pick.ts`

- [ ] **步骤 1: 创建 quick-pick.ts**

```typescript
import * as vscode from 'vscode';
import { SessionStore } from '../core/session-store';
import { Session } from '../core/types';

const SOURCE_ICONS: Record<string, string> = {
  terminal: '$(terminal)',
  task: '$(tools)',
  debug: '$(debug-alt)',
  agent: '$(hubot)',
};

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  waiting: '等待输入',
  done: '完成',
  failed: '失败',
};

export class QuickPickUI {
  constructor(private readonly store: SessionStore) {}

  async show(): Promise<void> {
    const active = this.store.getActive();
    const recent = this.store.getRecent();
    const all = [...active, ...recent];

    if (all.length === 0) {
      vscode.window.showInformationMessage('暂无会话记录');
      return;
    }

    const items: (vscode.QuickPickItem & { session: Session })[] = all.map(s => ({
      label: `${SOURCE_ICONS[s.source] ?? '$(question)'} ${s.name}`,
      description: s.command ?? '',
      detail: this._formatDetail(s),
      session: s,
    }));

    // 底部操作
    const clearItem: vscode.QuickPickItem & { session?: Session } = {
      label: '$(trash) 清除历史',
      description: '',
      session: undefined,
    };
    items.push(clearItem as any);

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: '选择会话跳转，或清除历史',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (picked) {
      if ('session' in picked && picked.session) {
        this._focusSession(picked.session);
      } else {
        // 清除历史
        this.store.clear();
        vscode.window.showInformationMessage('历史已清除');
      }
    }
  }

  private _formatDetail(s: Session): string {
    const duration = s.duration ? this._formatDuration(s.duration) : '运行中';
    return `${STATUS_LABELS[s.status]} · ${duration}${s.exitCode !== undefined ? ` · 退出码 ${s.exitCode}` : ''}`;
  }

  private _focusSession(session: Session): void {
    if (session.source === 'terminal') {
      const terminal = session.ref as vscode.Terminal;
      if (terminal && 'show' in terminal) {
        terminal.show();
      }
    } else if (session.source === 'debug') {
      vscode.commands.executeCommand('workbench.debug.action.focusRepl');
    }
    // task 暂时聚焦到终端面板
  }

  private _formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) {
      return `${sec}秒`;
    }
    const min = Math.floor(sec / 60);
    return `${min}分${sec % 60}秒`;
  }
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

- [ ] **步骤 3: 提交**

```bash
git add src/ui/quick-pick.ts
git commit -m "feat: Quick Pick 仪表盘"
```

---

## Task 11: Extension 入口

**文件：**
- 创建: `src/extension.ts`

- [ ] **步骤 1: 创建 extension.ts**

```typescript
import * as vscode from 'vscode';
import { EventBus } from './core/event-bus';
import { SessionStore } from './core/session-store';
import { Notifier } from './core/notifier';
import { TerminalAdapter } from './adapters/terminal';
import { TaskAdapter } from './adapters/task';
import { DebugAdapter } from './adapters/debug';
import { StatusBarUI } from './ui/status-bar';
import { QuickPickUI } from './ui/quick-pick';

export function activate(context: vscode.ExtensionContext): void {
  // 核心
  const bus = new EventBus();
  const store = new SessionStore(bus);
  const notifier = new Notifier(bus);

  // 适配器
  const terminalAdapter = new TerminalAdapter(bus);
  const taskAdapter = new TaskAdapter(bus);
  const debugAdapter = new DebugAdapter(bus);

  // UI
  const statusBar = new StatusBarUI(store);
  const quickPick = new QuickPickUI(store);

  // 订阅 EventBus 更新状态栏
  bus.on(() => statusBar.update());

  // 激活适配器
  context.subscriptions.push(terminalAdapter.activate());
  context.subscriptions.push(taskAdapter.activate());
  context.subscriptions.push(debugAdapter.activate());

  // 激活状态栏
  context.subscriptions.push(statusBar.activate());

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('agentBell.showSessions', () => quickPick.show()),
    vscode.commands.registerCommand('agentBell.clearHistory', () => {
      store.clear();
      statusBar.update();
      vscode.window.showInformationMessage('Agent Bell: 历史已清除');
    }),
    vscode.commands.registerCommand('agentBell.pauseNotifications', () => {
      if (notifier.isPaused) {
        notifier.resume();
        vscode.window.showInformationMessage('Agent Bell: 通知已恢复');
      } else {
        notifier.pause();
        vscode.window.showInformationMessage('Agent Bell: 通知已暂停');
      }
    })
  );

  // 清理
  context.subscriptions.push(bus, statusBar);
}

export function deactivate(): void {
  // 清理逻辑已在 subscriptions 中处理
}
```

- [ ] **步骤 2: 验证编译**

```bash
npm run build
```

预期：无错误，`dist/extension.js` 生成

- [ ] **步骤 3: 提交**

```bash
git add src/extension.ts
git commit -m "feat: Extension 入口，组装所有组件"
```

---

## Task 12: 构建验证与手动测试

- [ ] **步骤 1: 完整构建**

```bash
npm run build
```

预期：无错误，`dist/extension.js` 生成

- [ ] **步骤 2: 在 VS Code 中启动扩展开发宿主**

按 `F5` 启动 Extension Development Host，或：

```bash
code --extensionDevelopmentPath="e:/vibe coding/Agent Bell"
```

- [ ] **步骤 3: 测试终端监控**

在 Extension Development Host 中：
1. 打开终端
2. 运行 `ping localhost -n 20`（Windows）或 `sleep 20`（Linux/Mac）
3. 等待命令结束
4. 预期：状态栏更新，弹出通知 "完成 (20秒)"

- [ ] **步骤 4: 测试失败通知**

1. 运行一个会失败的命令：`ls /nonexistent_path_12345`
2. 预期：立即弹出失败通知（忽略阈值）

- [ ] **步骤 5: 测试忽略列表**

1. 运行 `cd /tmp`（在忽略列表中）
2. 预期：无通知

- [ ] **步骤 6: 测试 Quick Pick**

1. 点击状态栏的 Agent Bell 项目
2. 预期：弹出 Quick Pick 列表，显示最近会话
3. 选择一个会话，预期：跳转到对应终端

- [ ] **步骤 7: 测试命令面板**

1. `Ctrl+Shift+P` → "Agent Bell: 显示最近会话"
2. `Ctrl+Shift+P` → "Agent Bell: 暂停通知"
3. `Ctrl+Shift+P` → "Agent Bell: 清除历史"

- [ ] **步骤 8: 最终提交**

```bash
git add -A
git commit -m "feat: Agent Bell MVP 完成"
```

---

## 实现顺序总结

| # | 任务 | 依赖 |
|---|------|------|
| 1 | 项目脚手架 | 无 |
| 2 | 核心类型 + EventBus | 1 |
| 3 | Config 模块 | 1 |
| 4 | SessionStore | 2 |
| 5 | Notifier | 2, 3 |
| 6 | Terminal Adapter | 2, 3 |
| 7 | Task Adapter | 2 |
| 8 | Debug Adapter | 2 |
| 9 | 状态栏 | 3, 4 |
| 10 | Quick Pick | 4 |
| 11 | Extension 入口 | 全部 |
| 12 | 构建验证 | 全部 |

Task 2-3 可并行，Task 4-8 可并行（无互相依赖），Task 9-10 可并行。
