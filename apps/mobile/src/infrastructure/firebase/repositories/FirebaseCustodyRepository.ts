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
import {
  isShipmentLifecycleEvent,
  type ShipmentLifecycleEvent,
} from "../../../domain/shipment/ShipmentLifecycleEvent";
import type { ShipmentTimelineRepository } from "../../../domain/shipment/ShipmentTimelineRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import {
  mapCustodyEvent,
  toFirestoreCustodyEvent,
} from "../mappers/custodyMapper";

export class FirebaseCustodyRepository
  implements CustodyRepository, ShipmentTimelineRepository
{
  async append(event: NewCustodyEvent): Promise<CustodyEvent> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "custodyEvents", `${event.bookingId}__${event.eventType}`);
    await firebaseOfflineStatusGateway.trackWrite(() =>
      setDoc(reference, {
        ...toFirestoreCustodyEvent(event),
        timestamp: serverTimestamp(),
      }),
    );
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

  async listByShipment(
    shipmentId: string,
  ): Promise<ReadonlyArray<ShipmentLifecycleEvent>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(
        collection(db, "custodyEvents"),
        where("shipmentId", "==", shipmentId),
      ),
    );
    return this.mapShipmentTimeline(snapshot.docs.map(mapCustodyEvent));
  }

  watchByShipment(
    shipmentId: string,
    onData: (events: ReadonlyArray<ShipmentLifecycleEvent>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(
        collection(db, "custodyEvents"),
        where("shipmentId", "==", shipmentId),
      ),
      (snapshot) =>
        onData(this.mapShipmentTimeline(snapshot.docs.map(mapCustodyEvent))),
      onError,
    );
  }

  private mapShipmentTimeline(
    events: ReadonlyArray<CustodyEvent>,
  ): ReadonlyArray<ShipmentLifecycleEvent> {
    return events
      .filter(isShipmentLifecycleEvent)
      .sort((left, right) =>
        (left.timestamp ?? "").localeCompare(right.timestamp ?? ""),
      );
  }
}
