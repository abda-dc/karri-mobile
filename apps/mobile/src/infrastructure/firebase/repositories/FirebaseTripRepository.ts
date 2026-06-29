import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { NewTrip, Trip } from "../../../domain/trip/Trip";
import type { TripRepository } from "../../../domain/trip/TripRepository";
import { getFirebaseServices } from "../client";
import { mapTrip, toFirestoreTrip } from "../mappers/tripMapper";

export class FirebaseTripRepository implements TripRepository {
  async create(trip: NewTrip): Promise<Trip> {
    const { db } = getFirebaseServices();
    const reference = await addDoc(collection(db, "trips"), {
      ...toFirestoreTrip(trip),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
}
