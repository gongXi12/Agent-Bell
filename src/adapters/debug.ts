import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Session } from '../core/types';
import { EventBus } from '../core/event-bus';

export class DebugAdapter {
  private readonly _debugToSession = new Map<string, Session>();

  constructor(private readonly bus: EventBus) {}

  activate(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];

    disposables.push(
      vscode.debug.onDidStartDebugSession(debugSession => {
        const session: Session = {
          id: crypto.randomUUID(),
          source: 'debug',
          project: vscode.workspace.workspaceFolders?.[0]?.name ?? 'VS Code',
          name: debugSession.name,
          startTime: Date.now(),
          status: 'running',
          terminal: debugSession,
        };
        this._debugToSession.set(debugSession.id, session);
        this.bus.fire({ type: 'started', session });
      })
    );

    disposables.push(
      vscode.debug.onDidTerminateDebugSession(debugSession => {
        const session = this._debugToSession.get(debugSession.id);
        if (!session) return;
        this._debugToSession.delete(debugSession.id);

        session.terminal = debugSession;
        this.bus.fire({ type: 'ended', session });
      })
    );

    return vscode.Disposable.from(...disposables);
  }
}
