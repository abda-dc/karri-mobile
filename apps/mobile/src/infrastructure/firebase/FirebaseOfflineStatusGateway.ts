import * as Network from "expo-network";
import { enableNetwork, waitForPendingWrites } from "firebase/firestore";
import {
  ConnectionStatus,
  SyncPhase,
  initialOfflineStatus,
  type OfflineStatus,
  type OfflineStatusGateway,
} from "../../application/services/OfflineService";
import { getFirebaseServices, isFirebaseConfigured } from "./client";
import { firestorePersistenceMode } from "./firestoreCache";

const slowWriteThresholdMs = 1_500;
type BackgroundErrorReporter = (error: unknown, operation: string) => void;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("An unknown synchronization error occurred.");
}

export class FirebaseOfflineStatusGateway implements OfflineStatusGateway {
  private readonly observers = new Set<(status: OfflineStatus) => void>();
  private status: OfflineStatus = {
    ...initialOfflineStatus,
    persistence: firestorePersistenceMode,
  };
  private networkSubscription: ReturnType<typeof Network.addNetworkStateListener> | null = null;
  private slowPending = false;
  private syncPromise: Promise<void> | null = null;
  private backgroundErrorReporter: BackgroundErrorReporter | null = null;

  setBackgroundErrorReporter(reporter: BackgroundErrorReporter): void {
    this.backgroundErrorReporter = reporter;
  }

  getStatus(): OfflineStatus {
    this.start();
    return this.status;
  }

  watchStatus(onData: (status: OfflineStatus) => void): () => void {
    this.start();
    this.observers.add(onData);
    onData(this.status);

    let active = true;
    return () => {
      if (!active) {
        return;
      }

      active = false;
      this.observers.delete(onData);
    };
  }

  async trackWrite<T>(operation: () => Promise<T>): Promise<T> {
    this.start();
    const wasIdle = this.status.pendingWrites === 0;
    this.status = {
      ...this.status,
      lastError: null,
      pendingWrites: this.status.pendingWrites + 1,
    };
    if (wasIdle) {
      this.slowPending = false;
    }
    this.refreshPhase();

    const slowTimer = setTimeout(() => {
      if (this.status.pendingWrites > 0) {
        this.slowPending = true;
        this.refreshPhase();
      }
    }, slowWriteThresholdMs);

    try {
      const result = await operation();
      clearTimeout(slowTimer);
      this.status = {
        ...this.status,
        lastSyncedAt: new Date().toISOString(),
        pendingWrites: Math.max(0, this.status.pendingWrites - 1),
      };
      if (this.status.pendingWrites === 0) {
        this.slowPending = false;
      }
      this.refreshPhase();
      return result;
    } catch (error) {
      clearTimeout(slowTimer);
      this.status = {
        ...this.status,
        lastError: toError(error),
        pendingWrites: Math.max(0, this.status.pendingWrites - 1),
      };
      if (this.status.pendingWrites === 0) {
        this.slowPending = false;
      }
      this.refreshPhase();
      throw error;
    }
  }

  retryPendingWrites(): Promise<void> {
    this.start();

    if (!isFirebaseConfigured) {
      return Promise.resolve();
    }

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.status = { ...this.status, lastError: null, phase: SyncPhase.Syncing };
    this.emit();
    this.syncPromise = (async () => {
      const { db } = getFirebaseServices();
      await enableNetwork(db);
      await waitForPendingWrites(db);
      this.status = {
        ...this.status,
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
      };
      this.refreshPhase();
    })()
      .catch((error) => {
        this.status = { ...this.status, lastError: toError(error), phase: SyncPhase.Error };
        this.emit();
        throw error;
      })
      .finally(() => {
        this.syncPromise = null;
      });

    return this.syncPromise;
  }

  private start(): void {
    if (this.networkSubscription) {
      return;
    }

    this.networkSubscription = Network.addNetworkStateListener((networkState) => {
      this.updateConnection(networkState);
    });
    void Network.getNetworkStateAsync()
      .then((networkState) => this.updateConnection(networkState))
      .catch((error) => {
        this.backgroundErrorReporter?.(error, "offline.read-network-state");
      });
  }

  private updateConnection(networkState: Network.NetworkState): void {
    const previousConnection = this.status.connection;
    let connection: ConnectionStatus = ConnectionStatus.Unknown;

    if (networkState.isInternetReachable === false || networkState.isConnected === false) {
      connection = ConnectionStatus.Offline;
    } else if (
      networkState.isInternetReachable === true ||
      networkState.isConnected === true
    ) {
      connection = ConnectionStatus.Online;
    }

    this.status = { ...this.status, connection };
    this.refreshPhase();

    if (
      previousConnection === ConnectionStatus.Offline &&
      connection === ConnectionStatus.Online &&
      this.status.pendingWrites > 0
    ) {
      void this.retryPendingWrites().catch((error) => {
        this.backgroundErrorReporter?.(error, "offline.reconnect-sync");
      });
    }
  }

  private refreshPhase(): void {
    let phase: SyncPhase = SyncPhase.Synced;

    if (this.status.lastError) {
      phase = SyncPhase.Error;
    } else if (this.status.connection === ConnectionStatus.Offline) {
      phase = SyncPhase.Offline;
    } else if (this.status.pendingWrites > 0) {
      phase = this.slowPending ? SyncPhase.Pending : SyncPhase.Syncing;
    }

    this.status = { ...this.status, phase };
    this.emit();
  }

  private emit(): void {
    for (const observer of [...this.observers]) {
      observer(this.status);
    }
  }
}

export const firebaseOfflineStatusGateway = new FirebaseOfflineStatusGateway();
