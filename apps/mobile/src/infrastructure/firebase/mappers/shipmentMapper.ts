import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { NewShipment, Shipment } from "../../../domain/shipment/Shipment";
import {
  numberValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapShipment(snapshot: DocumentSnapshot<DocumentData>): Shipment {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    ownerId: stringValue(data.ownerId),
    originCountry: stringValue(data.originCountry),
    originCity: stringValue(data.originCity),
    destinationCountry: stringValue(data.destinationCountry),
    destinationCity: stringValue(data.destinationCity),
    packageCategory: stringValue(data.packageCategory),
    packageDescription: stringValue(data.packageDescription),
    weightKg: numberValue(data.weightKg),
    deliveryWindow: stringValue(data.deliveryWindow),
    rewardAmount: numberValue(data.rewardAmount),
    rewardCurrency: stringValue(data.rewardCurrency),
    status: data.status as Shipment["status"],
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreShipment(shipment: NewShipment | Shipment): DocumentData {
  const timestamps = "createdAt" in shipment
    ? {
        createdAt: toFirestoreTimestamp(shipment.createdAt),
        updatedAt: toFirestoreTimestamp(shipment.updatedAt),
      }
    : {};

  return {
    ownerId: shipment.ownerId,
    originCountry: shipment.originCountry,
    originCity: shipment.originCity,
    destinationCountry: shipment.destinationCountry,
    destinationCity: shipment.destinationCity,
    packageCategory: shipment.packageCategory,
    packageDescription: shipment.packageDescription,
    weightKg: shipment.weightKg,
    deliveryWindow: shipment.deliveryWindow,
    rewardAmount: shipment.rewardAmount,
    rewardCurrency: shipment.rewardCurrency,
    status: shipment.status,
    ...timestamps,
  };
}
