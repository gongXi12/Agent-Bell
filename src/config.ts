import * as vscode from 'vscode';

export interface AgentBellConfig {
  notifyThreshold: number;
  ignoreCommands: string[];
  enableSystemNotification: boolean;
  enableVSCodeNotification: boolean;
  showStatusBar: boolean;
  notifyOnFailure: boolean;
}

const SECTION = 'agentBell';

export function getConfig(): AgentBellConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    notifyThreshold: cfg.get<number>('notifyThreshold', 10),
    ignoreCommands: cfg.get<string[]>('ignoreCommands', [
      'cd', 'ls', 'pwd', 'clear', 'echo', 'cat', 'grep',
      'mkdir', 'touch', 'rm', 'cp', 'mv', 'source', 'export',
      'alias', 'dir', 'cls', 'type', 'where', 'whoami',
    ]),
    enableSystemNotification: cfg.get<boolean>('enableSystemNotification', true),
    enableVSCodeNotification: cfg.get<boolean>('enableVSCodeNotification', true),
    showStatusBar: cfg.get<boolean>('showStatusBar', true),
    notifyOnFailure: cfg.get<boolean>('notifyOnFailure', true),
  };
}

/** 命令是否在忽略列表中（前缀匹配） */
export function shouldIgnoreCommand(command: string, ignoreList: string[]): boolean {
  const cmd = command.trim();
  return ignoreList.some(prefix => cmd === prefix || cmd.startsWith(prefix + ' '));
}
