import * as vscode from 'vscode';
import { EventBus } from './core/event-bus';
import { SessionStore } from './core/session-store';
import { Notifier } from './core/notifier';
import { sendSystemNotification } from './core/system-notifier';
import { TerminalAdapter } from './adapters/terminal';
import { TaskAdapter } from './adapters/task';
import { DebugAdapter } from './adapters/debug';
import { StatusBarUI } from './ui/status-bar';
import { QuickPickUI } from './ui/quick-pick';

const outputChannel = vscode.window.createOutputChannel('Agent Bell');

export function activate(context: vscode.ExtensionContext): void {
  outputChannel.appendLine('[Agent Bell] 扩展已激活');

  // 核心
  const bus = new EventBus();
  const store = new SessionStore(bus);
  const notifier = new Notifier(bus);

  // 调试日志
  bus.on(e => {
    outputChannel.appendLine(`[Event] ${e.type} — ${e.session.name} (command: ${e.session.command ?? 'N/A'}, exitCode: ${e.session.exitCode ?? 'N/A'}, duration: ${e.session.duration ?? 'N/A'}ms)`);
  });

  // 适配器
  const terminalAdapter = new TerminalAdapter(bus);
  const taskAdapter = new TaskAdapter(bus);
  const debugAdapter = new DebugAdapter(bus);

  // UI
  const statusBar = new StatusBarUI(store);
  const quickPick = new QuickPickUI(store);

  // 状态栏随事件更新
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
    }),
    vscode.commands.registerCommand('agentBell.testNotification', () => {
      sendSystemNotification({
        id: 'test',
        source: 'terminal',
        project: '测试',
        name: '测试通知',
        command: 'test command',
        startTime: Date.now() - 30000,
        endTime: Date.now(),
        duration: 30000,
        exitCode: 0,
        status: 'done',
      });
      vscode.window.showInformationMessage('Agent Bell: 测试通知已发送');
    })
  );

  // 清理
  context.subscriptions.push(bus, statusBar, outputChannel);
}

export function deactivate(): void {}
