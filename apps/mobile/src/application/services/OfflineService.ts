export const ConnectionStatus = {
  Offline: "offline",
  Online: "online",
  Unknown: "unknown",
} as const;

export type ConnectionStatus =
  (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const SyncPhase = {
  Error: "error",
  Offline: "offline",
  Pending: "pending",
  Synced: "synced",
  Syncing: "syncing",
} as const;

export type SyncPhase = (typeof SyncPhase)[keyof typeof SyncPhase];

export const FirestorePersistenceMode = {
  Memory: "memory",
  Persistent: "persistent",
} as const;

export type FirestorePersistenceMode =
  (typeof FirestorePersistenceMode)[keyof typeof FirestorePersistenceMode];

export interface OfflineStatus {
  readonly connection: ConnectionStatus;
  readonly lastError: Error | null;
  readonly lastSyncedAt: string | null;
  readonly pendingWrites: number;
  readonly persistence: FirestorePersistenceMode;
  readonly phase: SyncPhase;
}

export const initialOfflineStatus: OfflineStatus = {
  connection: ConnectionStatus.Unknown,
  lastError: null,
  lastSyncedAt: null,
  pendingWrites: 0,
  persistence: FirestorePersistenceMode.Memory,
  phase: SyncPhase.Synced,
};

export interface OfflineStatusGateway {
  getStatus(): OfflineStatus;
  retryPendingWrites(): Promise<void>;
  trackWrite<T>(operation: () => Promise<T>): Promise<T>;
  watchStatus(onData: (status: OfflineStatus) => void): () => void;
}

export class OfflineService {
  constructor(private readonly gateway: OfflineStatusGateway) {}

  watchStatus(onData: (status: OfflineStatus) => void): () => void {
    return this.gateway.watchStatus(onData);
  }

  getStatus(): OfflineStatus {
    return this.gateway.getStatus();
  }

  retryPendingWrites(): Promise<void> {
    return this.gateway.retryPendingWrites();
  }
}
