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
