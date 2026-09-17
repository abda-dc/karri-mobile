import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { NewShipment, Shipment } from "../../../domain/shipment/Shipment";
import type { ShipmentRepository } from "../../../domain/shipment/ShipmentRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import { mapShipment, toFirestoreShipment } from "../mappers/shipmentMapper";
import { DomainValidationError } from "../../../application/services/validation";

export class FirebaseShipmentRepository implements ShipmentRepository {
  async create(shipment: NewShipment, operationId?: string): Promise<Shipment> {
    const { db } = getFirebaseServices();

    if (operationId) {
      const docRef = doc(db, "shipments", `shipment__${shipment.ownerId}__${operationId}`);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        const mapped = mapShipment(existing);
        if (
          mapped.ownerId !== shipment.ownerId ||
          mapped.originCountry !== shipment.originCountry ||
          mapped.originCity !== shipment.originCity ||
          mapped.destinationCountry !== shipment.destinationCountry ||
          mapped.destinationCity !== shipment.destinationCity ||
          mapped.packageCategory !== shipment.packageCategory ||
          mapped.packageDescription !== shipment.packageDescription ||
          mapped.weightKg !== shipment.weightKg ||
          mapped.deliveryWindow !== shipment.deliveryWindow ||
          mapped.rewardAmount !== shipment.rewardAmount ||
          mapped.rewardCurrency !== shipment.rewardCurrency ||
          mapped.containsBattery !== shipment.containsBattery ||
          mapped.batteryType !== shipment.batteryType ||
          mapped.containsLiquid !== shipment.containsLiquid ||
          mapped.containsFoodOrAgri !== shipment.containsFoodOrAgri ||
          mapped.containsMedicine !== shipment.containsMedicine ||
          mapped.customsDeclarationRequired !== shipment.customsDeclarationRequired ||
          mapped.packageContentVersion !== shipment.packageContentVersion
        ) {
          throw new DomainValidationError("Operation ID already exists with a different payload.");
        }
        return mapped;
      }

      await firebaseOfflineStatusGateway.trackWrite(() =>
        setDoc(docRef, {
          ...toFirestoreShipment(shipment),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );

      return mapShipment(await getDoc(docRef));
    }

    const reference = await firebaseOfflineStatusGateway.trackWrite(() =>
      addDoc(collection(db, "shipments"), {
        ...toFirestoreShipment(shipment),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    return mapShipment(await getDoc(reference));
  }

  async findById(shipmentId: string, authoritative = true): Promise<Shipment | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, "shipments", shipmentId);
    if (authoritative) {
      const snapshot = await getDocFromServer(docRef);
      return snapshot.exists() ? mapShipment(snapshot) : null;
    }
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? mapShipment(snapshot) : null;
  }

  async listActive(): Promise<ReadonlyArray<Shipment>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(
        collection(db, "shipments"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
    );
    return snapshot.docs.map(mapShipment);
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
