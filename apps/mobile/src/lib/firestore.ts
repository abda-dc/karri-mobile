import {
  QueryDocumentSnapshot,
  Unsubscribe,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { Shipment, ShipmentInput, Trip, TripInput } from "../types/models";
import { getFirebaseServices } from "./firebase";

const MATCH_INVENTORY_LIMIT = 100;

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function mapShipment(snapshot: QueryDocumentSnapshot): Shipment {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    ownerId: data.ownerId,
    originCountry: data.originCountry,
    originCity: data.originCity,
    destinationCountry: data.destinationCountry,
    destinationCity: data.destinationCity,
    packageCategory: data.packageCategory,
    packageDescription: data.packageDescription,
    weightKg: data.weightKg,
    deliveryWindow: data.deliveryWindow,
    rewardAmount: data.rewardAmount,
    rewardCurrency: data.rewardCurrency,
    status: data.status,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function mapTrip(snapshot: QueryDocumentSnapshot): Trip {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    ownerId: data.ownerId,
    originCountry: data.originCountry,
    originCity: data.originCity,
    destinationCountry: data.destinationCountry,
    destinationCity: data.destinationCity,
    departureDate: data.departureDate,
    arrivalDate: data.arrivalDate,
    availableCapacityKg: data.availableCapacityKg,
    notes: data.notes,
    status: data.status,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function newestFirst<T extends { createdAt: Shipment["createdAt"] }>(records: T[]): T[] {
  return records.sort(
    (left, right) => (right.createdAt?.toMillis() ?? 0) - (left.createdAt?.toMillis() ?? 0),
  );
}

export async function createShipment(ownerId: string, input: ShipmentInput): Promise<string> {
  const { db } = getFirebaseServices();
  const shipment = await addDoc(collection(db, "shipments"), {
    ownerId,
    originCountry: cleanText(input.originCountry),
    originCity: cleanText(input.originCity),
    destinationCountry: cleanText(input.destinationCountry),
    destinationCity: cleanText(input.destinationCity),
    packageCategory: cleanText(input.packageCategory),
    packageDescription: cleanText(input.packageDescription),
    weightKg: input.weightKg,
    deliveryWindow: cleanText(input.deliveryWindow),
    rewardAmount: input.rewardAmount,
    rewardCurrency: "USD",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return shipment.id;
}

export async function createTrip(ownerId: string, input: TripInput): Promise<string> {
  const { db } = getFirebaseServices();
  const trip = await addDoc(collection(db, "trips"), {
    ownerId,
    originCountry: cleanText(input.originCountry),
    originCity: cleanText(input.originCity),
    destinationCountry: cleanText(input.destinationCountry),
    destinationCity: cleanText(input.destinationCity),
    departureDate: input.departureDate,
    arrivalDate: input.arrivalDate,
    availableCapacityKg: input.availableCapacityKg,
    notes: cleanText(input.notes),
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return trip.id;
}

export function subscribeToUserShipments(
  ownerId: string,
  onData: (shipments: Shipment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getFirebaseServices();
  const shipmentsQuery = query(
    collection(db, "shipments"),
    where("ownerId", "==", ownerId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    shipmentsQuery,
    (snapshot) => onData(newestFirst(snapshot.docs.map(mapShipment))),
    onError,
  );
}

export function subscribeToUserTrips(
  ownerId: string,
  onData: (trips: Trip[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getFirebaseServices();
  const tripsQuery = query(
    collection(db, "trips"),
    where("ownerId", "==", ownerId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(tripsQuery, (snapshot) => onData(newestFirst(snapshot.docs.map(mapTrip))), onError);
}

export function subscribeToActiveShipments(
  onData: (shipments: Shipment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getFirebaseServices();
  const shipmentsQuery = query(
    collection(db, "shipments"),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(MATCH_INVENTORY_LIMIT),
  );

  return onSnapshot(
    shipmentsQuery,
    (snapshot) => onData(newestFirst(snapshot.docs.map(mapShipment))),
    onError,
  );
}

export function subscribeToActiveTrips(
  onData: (trips: Trip[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const { db } = getFirebaseServices();
  const tripsQuery = query(
    collection(db, "trips"),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(MATCH_INVENTORY_LIMIT),
  );

  return onSnapshot(tripsQuery, (snapshot) => onData(newestFirst(snapshot.docs.map(mapTrip))), onError);
}

export function getFriendlyFirestoreError(error: unknown): string {
  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);

    if (code === "permission-denied") {
      return "Karri does not have permission to access these records.";
    }

    if (code === "unavailable") {
      return "Karri could not reach Firestore. Check your connection and try again.";
    }
  }

  return "Karri could not load this data. Please try again.";
}
