import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Booking, BookingRequest } from "../../../domain/booking/Booking";
import type { NewCustodyEvent } from "../../../domain/custody/CustodyEvent";
import type { TravelerCustodyAcceptance } from "../../../domain/custody/TravelerCustodyAcceptance";
import type {
  BookingRepository,
  CreatedBookingRecords,
  NewBookingRecords,
} from "../../../domain/booking/BookingRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import {
  mapBooking,
  mapBookingRequest,
  toFirestoreBooking,
  toFirestoreBookingRequest,
} from "../mappers/bookingMapper";
import { toFirestoreCustodyEvent } from "../mappers/custodyMapper";
import { toFirestoreTravelerCustodyAcceptance } from "../mappers/travelerCustodyAcceptanceMapper";

export class FirebaseBookingRepository implements BookingRepository {
  async createRequest(records: NewBookingRecords): Promise<CreatedBookingRecords> {
    const { db } = getFirebaseServices();
    const bookingKey = `${records.booking.shipmentId}__${records.booking.tripId}`;
    const requestReference = doc(db, "bookingRequests", `request__${bookingKey}`);
    const bookingReference = doc(db, "bookings", `booking__${bookingKey}`);
    const custodyReference = doc(
      db,
      "custodyEvents",
      `${bookingReference.id}__${records.initialCustodyEvent.eventType}`,
    );
    const batch = writeBatch(db);

    batch.set(requestReference, {
      ...toFirestoreBookingRequest(records.request),
      bookingId: bookingReference.id,
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
    batch.set(custodyReference, {
      ...toFirestoreCustodyEvent({
        ...records.initialCustodyEvent,
        bookingId: bookingReference.id,
      }),
      timestamp: serverTimestamp(),
    });
    await firebaseOfflineStatusGateway.trackWrite(() => batch.commit());

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

  async listByParticipant(userId: string): Promise<ReadonlyArray<Booking>> {
    const { db } = getFirebaseServices();
    const [senderSnapshot, travelerSnapshot] = await Promise.all([
      getDocs(query(collection(db, "bookings"), where("senderId", "==", userId))),
      getDocs(query(collection(db, "bookings"), where("travelerId", "==", userId))),
    ]);
    return this.mergeBookings(
      senderSnapshot.docs.map(mapBooking),
      travelerSnapshot.docs.map(mapBooking),
    );
  }

  watchByParticipant(
    userId: string,
    onData: (bookings: ReadonlyArray<Booking>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    let senderBookings: ReadonlyArray<Booking> = [];
    let travelerBookings: ReadonlyArray<Booking> = [];
    let senderReady = false;
    let travelerReady = false;
    let active = true;
    const emit = () => {
      if (active && senderReady && travelerReady) {
        onData(this.mergeBookings(senderBookings, travelerBookings));
      }
    };
    const unsubscribeSender = onSnapshot(
      query(collection(db, "bookings"), where("senderId", "==", userId)),
      (snapshot) => {
        senderBookings = snapshot.docs.map(mapBooking);
        senderReady = true;
        emit();
      },
      onError,
    );
    const unsubscribeTraveler = onSnapshot(
      query(collection(db, "bookings"), where("travelerId", "==", userId)),
      (snapshot) => {
        travelerBookings = snapshot.docs.map(mapBooking);
        travelerReady = true;
        emit();
      },
      onError,
    );

    return () => {
      if (!active) {
        return;
      }

      active = false;
      unsubscribeSender();
      unsubscribeTraveler();
    };
  }

  watchRequestsByParticipant(
    userId: string,
    onData: (requests: ReadonlyArray<BookingRequest>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    let senderRequests: ReadonlyArray<BookingRequest> = [];
    let travelerRequests: ReadonlyArray<BookingRequest> = [];
    let senderReady = false;
    let travelerReady = false;
    let active = true;
    const emit = () => {
      if (active && senderReady && travelerReady) {
        onData(this.mergeRequests(senderRequests, travelerRequests));
      }
    };
    const unsubscribeSender = onSnapshot(
      query(collection(db, "bookingRequests"), where("senderId", "==", userId)),
      (snapshot) => {
        senderRequests = snapshot.docs.map(mapBookingRequest);
        senderReady = true;
        emit();
      },
      onError,
    );
    const unsubscribeTraveler = onSnapshot(
      query(collection(db, "bookingRequests"), where("travelerId", "==", userId)),
      (snapshot) => {
        travelerRequests = snapshot.docs.map(mapBookingRequest);
        travelerReady = true;
        emit();
      },
      onError,
    );

    return () => {
      if (!active) {
        return;
      }

      active = false;
      unsubscribeSender();
      unsubscribeTraveler();
    };
  }

  async saveTransition(
    booking: Booking,
    request: BookingRequest | null,
    lifecycleCustodyEvent: NewCustodyEvent | null,
    custodyAcceptance?: TravelerCustodyAcceptance | null,
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
    if (lifecycleCustodyEvent) {
      batch.set(
        doc(
          db,
          "custodyEvents",
          `${booking.id}__${lifecycleCustodyEvent.eventType}`,
        ),
        {
          ...toFirestoreCustodyEvent(lifecycleCustodyEvent),
          timestamp: serverTimestamp(),
        },
      );
    }
    if (custodyAcceptance) {
      batch.set(
        doc(db, "travelerCustodyAcceptances", booking.id),
        {
          ...toFirestoreTravelerCustodyAcceptance(custodyAcceptance),
          acceptedAt: serverTimestamp(),
        },
      );
    }
    await firebaseOfflineStatusGateway.trackWrite(() => batch.commit());

    const [bookingSnapshot, requestSnapshot] = await Promise.all([
      getDoc(bookingReference),
      requestReference ? getDoc(requestReference) : Promise.resolve(null),
    ]);
    return {
      booking: mapBooking(bookingSnapshot),
      request: requestSnapshot ? mapBookingRequest(requestSnapshot) : null,
    };
  }

  private mergeBookings(
    senderBookings: ReadonlyArray<Booking>,
    travelerBookings: ReadonlyArray<Booking>,
  ): ReadonlyArray<Booking> {
    return [...new Map([...senderBookings, ...travelerBookings].map((booking) => [booking.id, booking])).values()]
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
  }

  private mergeRequests(
    senderRequests: ReadonlyArray<BookingRequest>,
    travelerRequests: ReadonlyArray<BookingRequest>,
  ): ReadonlyArray<BookingRequest> {
    return [...new Map([...senderRequests, ...travelerRequests].map((request) => [request.id, request])).values()]
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
  }
}
