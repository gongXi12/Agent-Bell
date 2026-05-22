import * as vscode from 'vscode';
import { exec } from 'child_process';
import { Session } from './types';
import { getConfig } from '../config';

const outputChannel = vscode.window.createOutputChannel('Agent Bell');

/**
 * 发送操作系统级系统通知
 * Windows: 使用 PowerShell toast notification
 * macOS: 使用 osascript
 * Linux: 使用 notify-send
 */
export function sendSystemNotification(session: Session): void {
  const config = getConfig();
  if (!config.enableSystemNotification) {
    return;
  }

  const icon = session.status === 'failed' ? '❌' : '✅';
  const statusText = session.status === 'failed' ? '失败' : '完成';
  const duration = formatDuration(session.duration ?? 0);
  const title = `Agent Bell — ${session.name}`;
  const body = `${icon} ${statusText} (${duration})${session.command ? '\n' + session.command : ''}`;

  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: PowerShell balloon notification
    const psScript = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

      $template = @"
<toast launch="agent-bell" duration="long">
  <visual>
    <binding template="ToastGeneric">
      <text>${escapeXml(title)}</text>
      <text>${escapeXml(body)}</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Reminder"/>
</toast>
"@

      $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
      $xml.LoadXml($template)
      $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Agent Bell").Show($toast)
    `.trim();

    exec(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, (err) => {
      if (err) {
        outputChannel.appendLine(`[SystemNotifier] Windows toast 失败: ${err.message}`);
        // Fallback: 使用 msg 命令
        exec(`msg %username% /TIME:10 "${title}: ${body}"`, () => {});
      }
    });
  } else if (platform === 'darwin') {
    // macOS: osascript
    const script = `osascript -e 'display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}" sound name "Glass"'`;
    exec(script, (err) => {
      if (err) {
        outputChannel.appendLine(`[SystemNotifier] macOS 通知失败: ${err.message}`);
      }
    });
  } else {
    // Linux: notify-send
    exec(`notify-send "${escapeShell(title)}" "${escapeShell(body)}"`, (err) => {
      if (err) {
        outputChannel.appendLine(`[SystemNotifier] Linux 通知失败: ${err.message}`);
      }
    });
  }

  outputChannel.appendLine(`[SystemNotifier] 系统通知已发送: ${title}`);
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  return `${min}分${sec % 60}秒`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAppleScript(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

function escapeShell(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}
