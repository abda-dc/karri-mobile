import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
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
    const reference = await addDoc(collection(db, "custodyEvents"), {
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
}
