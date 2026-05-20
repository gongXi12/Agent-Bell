export type SessionSource = 'terminal' | 'task' | 'debug' | 'agent';
export type SessionStatus = 'running' | 'waiting' | 'done' | 'failed';

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
  /** 用于关联 VS Code 对象（Terminal / TaskExecution 等） */
  ref?: unknown;
}

export type SessionEvent =
  | { type: 'started'; session: Session }
  | { type: 'ended'; session: Session }
  | { type: 'waiting'; session: Session };
