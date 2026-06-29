import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
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
    const reference = await addDoc(collection(db, "notifications"), {
      ...toFirestoreNotification(notification),
      readAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return mapNotification(await getDoc(reference));
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

  async markRead(notificationId: string, _readAt: string): Promise<void> {
    const { db } = getFirebaseServices();
    await updateDoc(doc(db, "notifications", notificationId), {
      status: NotificationStatus.Read,
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
