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
