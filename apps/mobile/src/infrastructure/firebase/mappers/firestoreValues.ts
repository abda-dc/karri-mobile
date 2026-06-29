import { Timestamp, type DocumentData, type DocumentSnapshot } from "firebase/firestore";

export function snapshotData(snapshot: DocumentSnapshot<DocumentData>): DocumentData {
  const data = snapshot.data();

  if (!data) {
    throw new Error(`Firestore document ${snapshot.id} does not exist.`);
  }

  return data;
}

export function toDomainTimestamp(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

export function toFirestoreTimestamp(value: string | null): Timestamp | null {
  return value ? Timestamp.fromDate(new Date(value)) : null;
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function stringArray(value: unknown): ReadonlyArray<string> {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function recordValue(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
