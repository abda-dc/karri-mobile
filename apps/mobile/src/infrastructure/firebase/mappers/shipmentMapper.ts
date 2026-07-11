import { serverTimestamp, type DocumentData, type DocumentSnapshot } from "firebase/firestore";
import type { NewShipment, Shipment, SafetyDeclarationSnapshot } from "../../../domain/shipment/Shipment";
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

    containsBattery: data.containsBattery === true,
    batteryType: (data.batteryType as Shipment["batteryType"]) ?? "none",
    containsLiquid: data.containsLiquid === true,
    containsFoodOrAgri: data.containsFoodOrAgri === true,
    containsMedicine: data.containsMedicine === true,
    customsDeclarationRequired: data.customsDeclarationRequired === true,
    packageContentVersion: numberValue(data.packageContentVersion, 1),
    safetyDeclaration: mapSafetyDeclaration(data.safetyDeclaration),
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

    containsBattery: shipment.containsBattery,
    batteryType: shipment.batteryType,
    containsLiquid: shipment.containsLiquid,
    containsFoodOrAgri: shipment.containsFoodOrAgri,
    containsMedicine: shipment.containsMedicine,
    customsDeclarationRequired: shipment.customsDeclarationRequired,
    packageContentVersion: shipment.packageContentVersion,
    safetyDeclaration: toFirestoreSafetyDeclaration(shipment.safetyDeclaration),
    ...timestamps,
  };
}

function mapSafetyDeclaration(value: unknown): SafetyDeclarationSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const data = value as Record<string, unknown>;
  const acks = (data.acknowledgements ?? {}) as Record<string, unknown>;

  return {
    policyVersion: stringValue(data.policyVersion),
    declarationVersion: stringValue(data.declarationVersion),
    acceptedAt: toDomainTimestamp(data.acceptedAt) ?? "",
    acceptedByUserId: stringValue(data.acceptedByUserId),
    packageContentVersion: numberValue(data.packageContentVersion),
    acknowledgements: {
      contentsAccurate: (acks.contentsAccurate === true) as true,
      noProhibitedItems: (acks.noProhibitedItems === true) as true,
      inspectionPermitted: (acks.inspectionPermitted === true) as true,
      customsResponsibilityAccepted: (acks.customsResponsibilityAccepted === true) as true,
    },
  };
}

function toFirestoreSafetyDeclaration(decl: SafetyDeclarationSnapshot | null): DocumentData | null {
  if (!decl) return null;
  return {
    policyVersion: decl.policyVersion,
    declarationVersion: decl.declarationVersion,
    acceptedAt: serverTimestamp(),
    acceptedByUserId: decl.acceptedByUserId,
    packageContentVersion: decl.packageContentVersion,
    acknowledgements: {
      contentsAccurate: decl.acknowledgements.contentsAccurate,
      noProhibitedItems: decl.acknowledgements.noProhibitedItems,
      inspectionPermitted: decl.acknowledgements.inspectionPermitted,
      customsResponsibilityAccepted: decl.acknowledgements.customsResponsibilityAccepted,
    },
  };
}
