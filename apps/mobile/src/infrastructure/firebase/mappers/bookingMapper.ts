import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type {
  Booking,
  BookingRequest,
  NewBooking,
  NewBookingRequest,
} from "../../../domain/booking/Booking";
import {
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapBookingRequest(
  snapshot: DocumentSnapshot<DocumentData>,
): BookingRequest {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    bookingId: stringValue(data.bookingId),
    shipmentId: stringValue(data.shipmentId),
    tripId: stringValue(data.tripId),
    senderId: stringValue(data.senderId),
    travelerId: stringValue(data.travelerId),
    message: stringValue(data.message),
    status: data.status as BookingRequest["status"],
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function mapBooking(snapshot: DocumentSnapshot<DocumentData>): Booking {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    bookingRequestId: stringValue(data.bookingRequestId),
    shipmentId: stringValue(data.shipmentId),
    tripId: stringValue(data.tripId),
    senderId: stringValue(data.senderId),
    travelerId: stringValue(data.travelerId),
    status: data.status as Booking["status"],
    statusHistory: Array.isArray(data.statusHistory)
      ? data.statusHistory.map((entry: DocumentData) => ({
          status: entry.status as Booking["status"],
          changedAt: toDomainTimestamp(entry.changedAt) ?? "",
          changedBy: stringValue(entry.changedBy),
        }))
      : [],
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreBookingRequest(
  request: NewBookingRequest | BookingRequest,
): DocumentData {
  const timestamps = "createdAt" in request
    ? {
        createdAt: toFirestoreTimestamp(request.createdAt),
        updatedAt: toFirestoreTimestamp(request.updatedAt),
      }
    : {};

  return {
    bookingId: "bookingId" in request ? request.bookingId : null,
    shipmentId: request.shipmentId,
    tripId: request.tripId,
    senderId: request.senderId,
    travelerId: request.travelerId,
    message: request.message,
    status: request.status,
    ...timestamps,
  };
}

export function toFirestoreBooking(booking: NewBooking | Booking): DocumentData {
  const timestamps = "createdAt" in booking
    ? {
        createdAt: toFirestoreTimestamp(booking.createdAt),
        updatedAt: toFirestoreTimestamp(booking.updatedAt),
      }
    : {};

  return {
    bookingRequestId: booking.bookingRequestId,
    shipmentId: booking.shipmentId,
    tripId: booking.tripId,
    senderId: booking.senderId,
    travelerId: booking.travelerId,
    status: booking.status,
    statusHistory: booking.statusHistory.map((entry) => ({
      status: entry.status,
      changedAt: toFirestoreTimestamp(entry.changedAt),
      changedBy: entry.changedBy,
    })),
    ...timestamps,
  };
}
