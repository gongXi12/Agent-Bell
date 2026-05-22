import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';
import { getConfig, shouldIgnoreCommand } from '../config';

const outputChannel = vscode.window.createOutputChannel('Agent Bell');

export class TerminalAdapter {
  private readonly _execToSession = new Map<unknown, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    // Shell Integration: 命令开始
    disposables.push(
      vscode.window.onDidStartTerminalShellExecution(e => {
        const command = e.execution.commandLine.value;
        outputChannel.appendLine(`[Terminal] 命令开始: "${command}"`);

        const config = getConfig();
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
          terminal: e.terminal,
        };

        this._execToSession.set(e.execution, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    // Shell Integration: 命令结束
    disposables.push(
      vscode.window.onDidEndTerminalShellExecution(e => {
        outputChannel.appendLine(`[Terminal] 命令结束: "${e.execution.commandLine.value}" (exitCode: ${e.exitCode})`);
        const session = this._execToSession.get(e.execution);
        if (!session) {
          return;
        }
        this._execToSession.delete(e.execution);

        session.exitCode = e.exitCode ?? 1;
        session.terminal = e.terminal;
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
      if (folder) return folder.name;
    }
    return vscode.workspace.workspaceFolders?.[0]?.name ?? 'VS Code';
  }
}
