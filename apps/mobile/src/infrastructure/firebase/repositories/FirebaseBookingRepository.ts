import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import type { Booking, BookingRequest } from "../../../domain/booking/Booking";
import type {
  BookingRepository,
  CreatedBookingRecords,
  NewBookingRecords,
} from "../../../domain/booking/BookingRepository";
import { getFirebaseServices } from "../client";
import {
  mapBooking,
  mapBookingRequest,
  toFirestoreBooking,
  toFirestoreBookingRequest,
} from "../mappers/bookingMapper";

export class FirebaseBookingRepository implements BookingRepository {
  async createRequest(records: NewBookingRecords): Promise<CreatedBookingRecords> {
    const { db } = getFirebaseServices();
    const requestReference = doc(collection(db, "bookingRequests"));
    const bookingReference = doc(collection(db, "bookings"));
    const batch = writeBatch(db);

    batch.set(requestReference, {
      ...toFirestoreBookingRequest(records.request),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(bookingReference, {
      ...toFirestoreBooking({
        ...records.booking,
        bookingRequestId: requestReference.id,
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const [requestSnapshot, bookingSnapshot] = await Promise.all([
      getDoc(requestReference),
      getDoc(bookingReference),
    ]);
    return {
      request: mapBookingRequest(requestSnapshot),
      booking: mapBooking(bookingSnapshot),
    };
  }

  async findById(bookingId: string): Promise<Booking | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "bookings", bookingId));
    return snapshot.exists() ? mapBooking(snapshot) : null;
  }

  async findRequestById(requestId: string): Promise<BookingRequest | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "bookingRequests", requestId));
    return snapshot.exists() ? mapBookingRequest(snapshot) : null;
  }

  async saveTransition(
    booking: Booking,
    request: BookingRequest | null,
  ): Promise<{ readonly booking: Booking; readonly request: BookingRequest | null }> {
    const { db } = getFirebaseServices();
    const bookingReference = doc(db, "bookings", booking.id);
    const requestReference = request
      ? doc(db, "bookingRequests", request.id)
      : null;
    const batch = writeBatch(db);

    batch.set(bookingReference, {
      ...toFirestoreBooking(booking),
      updatedAt: serverTimestamp(),
    });
    if (request && requestReference) {
      batch.set(requestReference, {
        ...toFirestoreBookingRequest(request),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    const [bookingSnapshot, requestSnapshot] = await Promise.all([
      getDoc(bookingReference),
      requestReference ? getDoc(requestReference) : Promise.resolve(null),
    ]);
    return {
      booking: mapBooking(bookingSnapshot),
      request: requestSnapshot ? mapBookingRequest(requestSnapshot) : null,
    };
  }
}
