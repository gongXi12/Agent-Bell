import { Session, SessionEvent } from './types';
import { EventBus } from './event-bus';

const MAX_RECENT = 100;

export class SessionStore {
  private readonly _active = new Map<string, Session>();
  private readonly _recent: Session[] = [];

  constructor(private readonly bus: EventBus) {
    this.bus.on(e => this._handleEvent(e));
  }

  private _handleEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'started':
        this._active.set(event.session.id, event.session);
        break;
      case 'ended': {
        const s = event.session;
        this._active.delete(s.id);
        s.endTime = Date.now();
        s.duration = s.endTime - s.startTime;
        s.status = s.exitCode !== undefined && s.exitCode !== 0 ? 'failed' : 'done';
        this._recent.unshift(s);
        if (this._recent.length > MAX_RECENT) {
          this._recent.pop();
        }
        break;
      }
    }
  }

  getActive(): Session[] {
    return Array.from(this._active.values());
  }

  getRecent(): Session[] {
    return [...this._recent];
  }

  clear(): void {
    this._recent.length = 0;
  }
}
