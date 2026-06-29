import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { NewUser, User } from "../../../domain/user/User";
import {
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapUser(snapshot: DocumentSnapshot<DocumentData>): User {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    email: typeof data.email === "string" ? data.email : null,
    status: data.status as User["status"],
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreUser(user: NewUser | User, userId: string): DocumentData {
  const timestamps = "createdAt" in user
    ? {
        createdAt: toFirestoreTimestamp(user.createdAt),
        updatedAt: toFirestoreTimestamp(user.updatedAt),
      }
    : {};

  return {
    userId,
    email: user.email,
    status: user.status,
    ...timestamps,
  };
}
