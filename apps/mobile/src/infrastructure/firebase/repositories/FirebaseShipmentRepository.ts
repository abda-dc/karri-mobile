import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { NewShipment, Shipment } from "../../../domain/shipment/Shipment";
import type { ShipmentRepository } from "../../../domain/shipment/ShipmentRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import { mapShipment, toFirestoreShipment } from "../mappers/shipmentMapper";

export class FirebaseShipmentRepository implements ShipmentRepository {
  async create(shipment: NewShipment): Promise<Shipment> {
    const { db } = getFirebaseServices();
    const reference = await firebaseOfflineStatusGateway.trackWrite(() =>
      addDoc(collection(db, "shipments"), {
        ...toFirestoreShipment(shipment),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    return mapShipment(await getDoc(reference));
  }

  async findById(shipmentId: string): Promise<Shipment | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "shipments", shipmentId));
    return snapshot.exists() ? mapShipment(snapshot) : null;
  }

  async listByOwner(ownerId: string): Promise<ReadonlyArray<Shipment>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(
        collection(db, "shipments"),
        where("ownerId", "==", ownerId),
        orderBy("createdAt", "desc"),
      ),
    );
    return snapshot.docs.map(mapShipment);
  }

  watchByOwner(
    ownerId: string,
    onData: (shipments: ReadonlyArray<Shipment>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(
        collection(db, "shipments"),
        where("ownerId", "==", ownerId),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => onData(snapshot.docs.map(mapShipment)),
      onError,
    );
  }

  watchActive(
    onData: (shipments: ReadonlyArray<Shipment>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(
        collection(db, "shipments"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
      (snapshot) => onData(snapshot.docs.map(mapShipment)),
      onError,
    );
  }
}
