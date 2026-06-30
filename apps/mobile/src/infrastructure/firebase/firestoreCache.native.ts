import { memoryLocalCache } from "firebase/firestore";
import { FirestorePersistenceMode } from "../../application/services/OfflineService";

// The Firebase JavaScript SDK does not provide a durable React Native cache.
// Writes still queue and retry while this app process remains alive.
export const firestoreLocalCache = memoryLocalCache();
export const firestorePersistenceMode = FirestorePersistenceMode.Memory;
