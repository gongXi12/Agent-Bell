import * as vscode from 'vscode';
import { Session, SessionEvent } from './types';
import { EventBus } from './event-bus';
import { getConfig, shouldIgnoreCommand } from '../config';
import { sendSystemNotification } from './system-notifier';

const outputChannel = vscode.window.createOutputChannel('Agent Bell');

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
      outputChannel.appendLine(`[Notifier] 触发通知: ${session.name} (command: ${session.command}, exitCode: ${session.exitCode}, duration: ${session.duration}ms)`);
      this._notify(session);
    } else {
      outputChannel.appendLine(`[Notifier] 跳过通知: ${session.name} (command: ${session.command}, exitCode: ${session.exitCode}, duration: ${session.duration}ms)`);
    }
  }

  private _shouldNotify(session: Session): boolean {
    const config = getConfig();

    // 失败总是通知
    if (config.notifyOnFailure && session.exitCode !== undefined && session.exitCode !== 0) {
      return true;
    }

    // 成功时：检查阈值
    const durationSec = (session.duration ?? 0) / 1000;
    if (durationSec < config.notifyThreshold) {
      return false;
    }

    // 忽略列表中的命令不通知（仅成功时）
    if (session.command && shouldIgnoreCommand(session.command, config.ignoreCommands)) {
      return false;
    }

    return true;
  }

  private _notify(session: Session): void {
    const config = getConfig();

    // 系统通知
    sendSystemNotification(session);

    // VS Code 通知
    if (config.enableVSCodeNotification) {
      const icon = session.status === 'failed' ? '$(error)' : '$(check)';
      const duration = this._formatDuration(session.duration ?? 0);
      const cmd = session.command ? ` — ${session.command}` : '';
      const message = `${icon} ${session.name}${cmd} ${session.status === 'failed' ? '失败' : '完成'} (${duration})`;

      const actions = ['跳转到终端', '忽略'];
      vscode.window.showInformationMessage(message, ...actions).then(choice => {
        if (choice === '跳转到终端') {
          this._focusSession(session);
        }
      });
    }
  }

  private _focusSession(session: Session): void {
    const terminal = session.terminal as vscode.Terminal | undefined;
    if (terminal && 'show' in terminal) {
      (terminal as vscode.Terminal).show();
    }
  }

  private _formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}秒`;
    const min = Math.floor(sec / 60);
    return `${min}分${sec % 60}秒`;
  }

  pause(): void { this._paused = true; }
  resume(): void { this._paused = false; }
  get isPaused(): boolean { return this._paused; }
}
