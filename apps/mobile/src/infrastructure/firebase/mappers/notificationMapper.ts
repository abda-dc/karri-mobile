import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type {
  NewNotification,
  Notification,
} from "../../../domain/notification/Notification";
import {
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapNotification(
  snapshot: DocumentSnapshot<DocumentData>,
): Notification {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    recipientId: stringValue(data.userId),
    title: stringValue(data.title),
    body: stringValue(data.body),
    type: stringValue(data.type),
    relatedEntityType:
      typeof data.relatedEntityType === "string" ? data.relatedEntityType : null,
    relatedEntityId: typeof data.relatedId === "string" ? data.relatedId : null,
    status: data.status as Notification["status"],
    readAt: toDomainTimestamp(data.readAt),
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreNotification(
  notification: NewNotification | Notification,
): DocumentData {
  const timestamps = "createdAt" in notification
    ? {
        readAt: toFirestoreTimestamp(notification.readAt),
        createdAt: toFirestoreTimestamp(notification.createdAt),
        updatedAt: toFirestoreTimestamp(notification.updatedAt),
      }
    : {};

  return {
    userId: notification.recipientId,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    relatedEntityType: notification.relatedEntityType,
    relatedId: notification.relatedEntityId,
    status: notification.status,
    ...timestamps,
  };
}
