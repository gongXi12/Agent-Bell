import * as vscode from 'vscode';
import { SessionEvent } from './types';

export class EventBus {
  private readonly _emitter = new vscode.EventEmitter<SessionEvent>();

  readonly on = this._emitter.event;

  fire(event: SessionEvent): void {
    this._emitter.fire(event);
  }

  dispose(): void {
    this._emitter.dispose();
  }
}
