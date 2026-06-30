import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ConnectionStatus,
  FirestorePersistenceMode,
  SyncPhase,
} from "../../application/services/OfflineService";
import { Banner } from "../../components/Banner";
import { PrimaryButton } from "../../components/PrimaryButton";
import { spacing } from "../../theme/tokens";
import { getFriendlyError } from "../errors/getFriendlyError";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { mobileServices } from "../services/mobileServices";

export function OfflineStatusBanner() {
  const status = useOfflineStatus();
  const [retrying, setRetrying] = useState(false);

  if (status.phase === SyncPhase.Synced) {
    return null;
  }

  const writeLabel = status.pendingWrites === 1 ? "change" : "changes";
  let title = "Syncing changes";
  let message = `${status.pendingWrites} ${writeLabel} waiting for Firestore confirmation.`;
  let variant: "error" | "info" | "warning" = "info";

  if (status.phase === SyncPhase.Offline) {
    title = status.pendingWrites > 0 ? "Offline - changes queued" : "You're offline";
    message =
      status.pendingWrites > 0
        ? status.persistence === FirestorePersistenceMode.Persistent
          ? `${status.pendingWrites} ${writeLabel} saved locally and will sync after reconnecting.`
          : `${status.pendingWrites} ${writeLabel} queued while Karri stays open and will sync after reconnecting.`
        : status.persistence === FirestorePersistenceMode.Persistent
          ? "Karri is showing available locally cached data until the connection returns."
          : "Karri is showing data cached during this app session until the connection returns.";
    variant = "warning";
  } else if (status.phase === SyncPhase.Pending) {
    title = "Still syncing";
    message = `${status.pendingWrites} ${writeLabel} are taking longer than expected. Karri will keep trying safely.`;
    variant = "warning";
  } else if (status.phase === SyncPhase.Error) {
    title = "Sync needs attention";
    message = status.lastError
      ? getFriendlyError(status.lastError)
      : "Karri could not confirm the latest change. Review the action and try again.";
    variant = "error";
  }

  async function retrySync() {
    setRetrying(true);
    try {
      await mobileServices.offline.retryPendingWrites();
    } catch {
      // The shared status will surface the retry failure.
    } finally {
      setRetrying(false);
    }
  }

  const canRetry =
    status.connection === ConnectionStatus.Online &&
    status.pendingWrites > 0 &&
    (status.phase === SyncPhase.Pending || status.phase === SyncPhase.Error);

  return (
    <View style={styles.container}>
      <Banner compact message={message} title={title} variant={variant} />
      {canRetry ? (
        <PrimaryButton loading={retrying} variant="ghost" onPress={retrySync}>
          Retry sync
        </PrimaryButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
});
