import {
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { FirestorePersistenceMode } from "../../application/services/OfflineService";

// Expo web can use the Firebase JavaScript SDK's IndexedDB-backed cache.
export const firestoreLocalCache = persistentLocalCache({
  tabManager: persistentMultipleTabManager(),
});
export const firestorePersistenceMode = FirestorePersistenceMode.Persistent;
