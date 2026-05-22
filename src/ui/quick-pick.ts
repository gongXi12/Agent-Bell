import * as vscode from 'vscode';
import { SessionStore } from '../core/session-store';
import { Session } from '../core/types';

const SOURCE_ICONS: Record<string, string> = {
  terminal: '$(terminal)',
  task: '$(tools)',
  debug: '$(debug-alt)',
};

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
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

    const items: (vscode.QuickPickItem & { session?: Session })[] = all.map(s => ({
      label: `${SOURCE_ICONS[s.source] ?? '$(question)'} ${s.name}`,
      description: s.command ?? '',
      detail: this._formatDetail(s),
      session: s,
    }));

    items.push({
      label: '$(trash) 清除历史',
      description: '',
      session: undefined,
    });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: '选择会话跳转，或清除历史',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (picked) {
      if (picked.session) {
        this._focusSession(picked.session);
      } else {
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
      const terminal = session.terminal as vscode.Terminal;
      if (terminal && 'show' in terminal) terminal.show();
    } else if (session.source === 'debug') {
      vscode.commands.executeCommand('workbench.debug.action.focusRepl');
    }
  }

  private _formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    return `${min}分${sec % 60}秒`;
  }
}
