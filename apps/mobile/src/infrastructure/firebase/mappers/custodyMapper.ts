import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type {
  CustodyEvent,
  NewCustodyEvent,
} from "../../../domain/custody/CustodyEvent";
import {
  recordValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
} from "./firestoreValues";

export function mapCustodyEvent(
  snapshot: DocumentSnapshot<DocumentData>,
): CustodyEvent {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    bookingId: stringValue(data.bookingId),
    eventType: data.eventType as CustodyEvent["eventType"],
    timestamp: toDomainTimestamp(data.timestamp),
    performedBy: stringValue(data.performedBy),
    location: typeof data.location === "string" ? data.location : null,
    metadata: recordValue(data.metadata),
  };
}

export function toFirestoreCustodyEvent(event: NewCustodyEvent): DocumentData {
  return {
    bookingId: event.bookingId,
    eventType: event.eventType,
    performedBy: event.performedBy,
    location: event.location,
    metadata: event.metadata,
  };
}
