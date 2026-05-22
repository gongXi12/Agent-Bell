import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';
import { getConfig, shouldIgnoreCommand } from '../config';

const outputChannel = vscode.window.createOutputChannel('Agent Bell');

export class TerminalAdapter {
  /** execution 对象 → session 的映射 */
  private readonly _execToSession = new Map<unknown, Session>();
  /** terminal.name → 最近的 session（用于 fallback） */
  private readonly _terminalToSession = new Map<string, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    // 检查已有终端的 Shell Integration 状态
    for (const terminal of vscode.window.terminals) {
      this._logShellIntegrationStatus(terminal);
    }

    // 监听新终端创建
    disposables.push(
      vscode.window.onDidOpenTerminal(terminal => {
        outputChannel.appendLine(`[Terminal] 新终端创建: ${terminal.name}`);
        this._logShellIntegrationStatus(terminal);
      })
    );

    // 主方案: Shell Integration 事件
    disposables.push(
      vscode.window.onDidStartTerminalShellExecution(e => {
        const command = e.execution.commandLine.value;
        outputChannel.appendLine(`[Terminal] Shell Integration 命令开始: "${command}" (terminal: ${e.terminal.name})`);

        const config = getConfig();
        if (shouldIgnoreCommand(command, config.ignoreCommands)) {
          outputChannel.appendLine(`[Terminal] 忽略命令: "${command}"`);
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
        this._terminalToSession.set(e.terminal.name, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    disposables.push(
      vscode.window.onDidEndTerminalShellExecution(e => {
        outputChannel.appendLine(`[Terminal] Shell Integration 命令结束: "${e.execution.commandLine.value}" (exitCode: ${e.exitCode})`);
        const session = this._execToSession.get(e.execution);
        if (!session) {
          outputChannel.appendLine(`[Terminal] 未找到匹配的 session，跳过`);
          return;
        }
        this._execToSession.delete(e.execution);

        session.exitCode = e.exitCode ?? 1;
        session.ref = e.terminal;
        this.bus.fire({ type: 'ended', session });
      })
    );

    // Fallback: 终端状态变化检测
    // 当终端从 busy 变为 idle 时，检查是否有未结束的 session
    disposables.push(
      vscode.window.onDidChangeTerminalState(terminal => {
        const state = terminal.state;
        outputChannel.appendLine(`[Terminal Fallback] 终端状态变化: ${terminal.name} (isInteractedWith: ${state.isInteractedWith})`);

        // 如果终端不再有进程运行，检查是否有活跃的 session
        const session = this._terminalToSession.get(terminal.name);
        if (session && session.status === 'running') {
          // 给 Shell Integration 事件一点时间先触发
          setTimeout(() => {
            if (session.status === 'running') {
              outputChannel.appendLine(`[Terminal Fallback] Shell Integration 未触发，使用 fallback 结束 session: ${session.command}`);
              session.exitCode = 0;
              session.ref = terminal;
              this.bus.fire({ type: 'ended', session });
              this._terminalToSession.delete(terminal.name);
            }
          }, 2000);
        }
      })
    );

    return vscode.Disposable.from(...disposables);
  }

  private _logShellIntegrationStatus(terminal: vscode.Terminal): void {
    const si = (terminal as any).shellIntegration;
    if (si) {
      outputChannel.appendLine(`[Terminal] Shell Integration 可用: ${terminal.name} (has executeCommand: ${!!si.executeCommand})`);
    } else {
      outputChannel.appendLine(`[Terminal] Shell Integration 不可用: ${terminal.name}`);
    }
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
