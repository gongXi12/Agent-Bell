import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';

export class TaskAdapter {
  private readonly _taskToSession = new Map<string, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    disposables.push(
      vscode.tasks.onDidStartTask(e => {
        const task = e.execution.task;
        const session: Session = {
          id: crypto.randomUUID(),
          source: 'task',
          project: vscode.workspace.workspaceFolders?.[0]?.name ?? 'VS Code',
          name: task.name,
          command: this._getCommandString(task),
          startTime: Date.now(),
          status: 'running',
          terminal: e.execution,
        };
        this._taskToSession.set(task.id, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    disposables.push(
      vscode.tasks.onDidEndTaskProcess(e => {
        const session = this._taskToSession.get(e.execution.task.id);
        if (!session) return;
        this._taskToSession.delete(e.execution.task.id);

        session.exitCode = e.exitCode ?? 1;
        session.terminal = e.execution;
        this.bus.fire({ type: 'ended', session });
      })
    );

    return vscode.Disposable.from(...disposables);
  }

  private _getCommandString(task: vscode.Task): string | undefined {
    const exec = task.execution;
    if (!exec) return undefined;
    if ('command' in exec) return String((exec as vscode.ShellExecution).command);
    if ('process' in exec) return (exec as vscode.ProcessExecution).process;
    return undefined;
  }
}
