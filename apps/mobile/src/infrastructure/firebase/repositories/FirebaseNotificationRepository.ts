import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  NotificationStatus,
  type NewNotification,
  type Notification,
} from "../../../domain/notification/Notification";
import type { NotificationRepository } from "../../../domain/notification/NotificationRepository";
import { getFirebaseServices } from "../client";
import {
  mapNotification,
  toFirestoreNotification,
} from "../mappers/notificationMapper";

export class FirebaseNotificationRepository implements NotificationRepository {
  async create(notification: NewNotification): Promise<Notification> {
    const { db } = getFirebaseServices();
    const effectId = [
      notification.type.replace(/[^a-z0-9]+/gi, "_"),
      notification.relatedEntityId ?? "none",
      notification.recipientId,
    ].join("__");
    const reference = doc(db, "notifications", effectId);
    await setDoc(reference, {
      ...toFirestoreNotification(notification),
      readAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const occurredAt = new Date().toISOString();
    return {
      ...notification,
      id: reference.id,
      readAt: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
  }

  async listByRecipient(recipientId: string): Promise<ReadonlyArray<Notification>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(
        collection(db, "notifications"),
        where("userId", "==", recipientId),
        orderBy("createdAt", "desc"),
      ),
    );
    return snapshot.docs.map(mapNotification);
  }

  watchByRecipient(
    recipientId: string,
    onData: (notifications: ReadonlyArray<Notification>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(
        collection(db, "notifications"),
        where("userId", "==", recipientId),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => onData(snapshot.docs.map(mapNotification)),
      onError,
    );
  }

  async markRead(notificationId: string, _readAt: string): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, "notifications", notificationId), {
      status: NotificationStatus.Read,
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
