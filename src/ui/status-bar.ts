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
