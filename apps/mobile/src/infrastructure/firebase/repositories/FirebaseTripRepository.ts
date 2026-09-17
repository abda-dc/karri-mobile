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
import type { NewTrip, Trip } from "../../../domain/trip/Trip";
import type { TripRepository } from "../../../domain/trip/TripRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import { mapTrip, toFirestoreTrip } from "../mappers/tripMapper";
import { DomainValidationError } from "../../../application/services/validation";

export class FirebaseTripRepository implements TripRepository {
  async create(trip: NewTrip, operationId?: string): Promise<Trip> {
    const { db } = getFirebaseServices();

    if (operationId) {
      const docRef = doc(db, "trips", `trip__${trip.ownerId}__${operationId}`);
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        const mapped = mapTrip(existing);
        if (
          mapped.ownerId !== trip.ownerId ||
          mapped.originCountry !== trip.originCountry ||
          mapped.originCity !== trip.originCity ||
          mapped.destinationCountry !== trip.destinationCountry ||
          mapped.destinationCity !== trip.destinationCity ||
          mapped.departureDate !== trip.departureDate ||
          mapped.arrivalDate !== trip.arrivalDate ||
          mapped.availableCapacityKg !== trip.availableCapacityKg ||
          (mapped.notes ?? "") !== (trip.notes ?? "")
        ) {
          throw new DomainValidationError("Operation ID already exists with a different payload.");
        }
        return mapped;
      }

      await firebaseOfflineStatusGateway.trackWrite(() =>
        setDoc(docRef, {
          ...toFirestoreTrip(trip),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );

      return mapTrip(await getDoc(docRef));
    }

    const reference = await firebaseOfflineStatusGateway.trackWrite(() =>
      addDoc(collection(db, "trips"), {
        ...toFirestoreTrip(trip),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    return mapTrip(await getDoc(reference));
  }

  async findById(tripId: string, authoritative = true): Promise<Trip | null> {
    const { db } = getFirebaseServices();
    const docRef = doc(db, "trips", tripId);
    if (authoritative) {
      const snapshot = await getDocFromServer(docRef);
      return snapshot.exists() ? mapTrip(snapshot) : null;
    }
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? mapTrip(snapshot) : null;
  }

  async listActive(): Promise<ReadonlyArray<Trip>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(
        collection(db, "trips"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
    );
    return snapshot.docs.map(mapTrip);
  }

  async listByOwner(ownerId: string): Promise<ReadonlyArray<Trip>> {
    const { db } = getFirebaseServices();
    const snapshot = await getDocs(
      query(
        collection(db, "trips"),
        where("ownerId", "==", ownerId),
        orderBy("createdAt", "desc"),
      ),
    );
    return snapshot.docs.map(mapTrip);
  }

  watchByOwner(
    ownerId: string,
    onData: (trips: ReadonlyArray<Trip>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(
        collection(db, "trips"),
        where("ownerId", "==", ownerId),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => onData(snapshot.docs.map(mapTrip)),
      onError,
    );
  }

  watchActive(
    onData: (trips: ReadonlyArray<Trip>) => void,
    onError: (error: Error) => void,
  ): () => void {
    const { db } = getFirebaseServices();
    return onSnapshot(
      query(
        collection(db, "trips"),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(100),
      ),
      (snapshot) => onData(snapshot.docs.map(mapTrip)),
      onError,
    );
  }
}
