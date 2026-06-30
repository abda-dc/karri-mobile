import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { NotificationPreferenceRepository } from "../../../domain/notification/NotificationPreferenceRepository";
import type { NotificationPreferences } from "../../../domain/notification/NotificationPreferences";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import {
  mapNotificationPreferences,
  toFirestoreNotificationPreferences,
} from "../mappers/notificationPreferenceMapper";

export class FirebaseNotificationPreferenceRepository
  implements NotificationPreferenceRepository
{
  async findByUserId(userId: string): Promise<NotificationPreferences | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "notificationPreferences", userId));
    return snapshot.exists() ? mapNotificationPreferences(snapshot) : null;
  }

  async save(
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "notificationPreferences", preferences.userId);
    const existing = await getDoc(reference);

    await firebaseOfflineStatusGateway.trackWrite(() =>
      setDoc(
        reference,
        {
          ...toFirestoreNotificationPreferences(preferences),
          ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );

    return mapNotificationPreferences(await getDoc(reference));
  }
}
