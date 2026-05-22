export type SessionSource = 'terminal' | 'task' | 'debug';
export type SessionStatus = 'running' | 'done' | 'failed';

export interface Session {
  id: string;
  source: SessionSource;
  project: string;
  name: string;
  command?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  exitCode?: number;
  status: SessionStatus;
  /** 关联的 VS Code Terminal 对象 */
  terminal?: unknown;
}

export type SessionEvent =
  | { type: 'started'; session: Session }
  | { type: 'ended'; session: Session };
