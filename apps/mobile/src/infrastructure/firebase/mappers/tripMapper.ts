import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { NewTrip, Trip } from "../../../domain/trip/Trip";
import {
  numberValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapTrip(snapshot: DocumentSnapshot<DocumentData>): Trip {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    ownerId: stringValue(data.ownerId),
    originCountry: stringValue(data.originCountry),
    originCity: stringValue(data.originCity),
    destinationCountry: stringValue(data.destinationCountry),
    destinationCity: stringValue(data.destinationCity),
    departureDate: stringValue(data.departureDate),
    arrivalDate: stringValue(data.arrivalDate),
    availableCapacityKg: numberValue(data.availableCapacityKg),
    notes: stringValue(data.notes),
    status: data.status as Trip["status"],
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreTrip(trip: NewTrip | Trip): DocumentData {
  const timestamps = "createdAt" in trip
    ? {
        createdAt: toFirestoreTimestamp(trip.createdAt),
        updatedAt: toFirestoreTimestamp(trip.updatedAt),
      }
    : {};

  return {
    ownerId: trip.ownerId,
    originCountry: trip.originCountry,
    originCity: trip.originCity,
    destinationCountry: trip.destinationCountry,
    destinationCity: trip.destinationCity,
    departureDate: trip.departureDate,
    arrivalDate: trip.arrivalDate,
    availableCapacityKg: trip.availableCapacityKg,
    notes: trip.notes,
    status: trip.status,
    ...timestamps,
  };
}
