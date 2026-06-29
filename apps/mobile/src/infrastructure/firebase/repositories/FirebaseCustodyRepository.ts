import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type {
  CustodyEvent,
  NewCustodyEvent,
} from "../../../domain/custody/CustodyEvent";
import type { CustodyRepository } from "../../../domain/custody/CustodyRepository";
import { getFirebaseServices } from "../client";
import {
  mapCustodyEvent,
  toFirestoreCustodyEvent,
} from "../mappers/custodyMapper";

export class FirebaseCustodyRepository implements CustodyRepository {
  async append(event: NewCustodyEvent): Promise<CustodyEvent> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "custodyEvents", `${event.bookingId}__${event.eventType}`);
    await setDoc(reference, {
      ...toFirestoreCustodyEvent(event),
      timestamp: serverTimestamp(),
    });
    return mapCustodyEvent(await getDoc(reference));
  }

  async listByBooking(bookingId: string): Promise<ReadonlyArray<CustodyEvent>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(collection(db, "custodyEvents"), where("bookingId", "==", bookingId)),
    );
    return snapshot.docs
      .map(mapCustodyEvent)
      .sort((left, right) => (left.timestamp ?? "").localeCompare(right.timestamp ?? ""));
  }

  watchByBooking(
    bookingId: string,
    onData: (events: ReadonlyArray<CustodyEvent>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(collection(db, "custodyEvents"), where("bookingId", "==", bookingId)),
      (snapshot) =>
        onData(
          snapshot.docs
            .map(mapCustodyEvent)
            .sort((left, right) =>
              (left.timestamp ?? "").localeCompare(right.timestamp ?? ""),
            ),
        ),
      onError,
    );
  }
}
