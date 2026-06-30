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
import type { NewTrip, Trip } from "../../../domain/trip/Trip";
import type { TripRepository } from "../../../domain/trip/TripRepository";
import { firebaseOfflineStatusGateway } from "../FirebaseOfflineStatusGateway";
import { getFirebaseServices } from "../client";
import { mapTrip, toFirestoreTrip } from "../mappers/tripMapper";

export class FirebaseTripRepository implements TripRepository {
  async create(trip: NewTrip): Promise<Trip> {
    const { db } = getFirebaseServices();
    const reference = await firebaseOfflineStatusGateway.trackWrite(() =>
      addDoc(collection(db, "trips"), {
        ...toFirestoreTrip(trip),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    return mapTrip(await getDoc(reference));
  }

  async findById(tripId: string): Promise<Trip | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "trips", tripId));
    return snapshot.exists() ? mapTrip(snapshot) : null;
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
