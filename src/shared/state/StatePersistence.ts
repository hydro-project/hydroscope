/**
 * StatePersistence - State snapshot and restoration
 */

export class StatePersistence {
  private _stateVersion = 1;
  private _lastStateSnapshot: string | null = null;

  getStateVersion(): number {
    return this._stateVersion;
  }

  incrementStateVersion(): void {
    this._stateVersion++;
  }

  getLastStateSnapshot(): string | null {
    return this._lastStateSnapshot;
  }

  setLastStateSnapshot(snapshot: string): void {
    this._lastStateSnapshot = snapshot;
  }

  clear(): void {
    this._stateVersion = 1;
    this._lastStateSnapshot = null;
  }
}
