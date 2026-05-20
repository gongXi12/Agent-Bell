import * as vscode from 'vscode';

export interface AgentBellConfig {
  notifyThreshold: number;
  ignoreCommands: string[];
  showStatusBar: boolean;
  notifyOnFailure: boolean;
}

const SECTION = 'agentBell';

export function getConfig(): AgentBellConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    notifyThreshold: cfg.get<number>('notifyThreshold', 15),
    ignoreCommands: cfg.get<string[]>('ignoreCommands', [
      'cd', 'ls', 'pwd', 'clear', 'echo', 'cat', 'grep',
      'mkdir', 'touch', 'rm', 'cp', 'mv', 'source', 'export', 'alias',
    ]),
    showStatusBar: cfg.get<boolean>('showStatusBar', true),
    notifyOnFailure: cfg.get<boolean>('notifyOnFailure', true),
  };
}

/** 检查命令是否在忽略列表中（前缀匹配） */
export function shouldIgnoreCommand(command: string, ignoreList: string[]): boolean {
  const trimmed = command.trim();
  return ignoreList.some(prefix => trimmed === prefix || trimmed.startsWith(prefix + ' '));
}
