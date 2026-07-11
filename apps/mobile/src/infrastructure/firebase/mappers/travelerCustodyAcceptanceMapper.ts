import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { TravelerCustodyAcceptance } from "../../../domain/custody/TravelerCustodyAcceptance";
import {
  numberValue,
  recordValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
} from "./firestoreValues";

export function mapTravelerCustodyAcceptance(
  snapshot: DocumentSnapshot<DocumentData>,
): TravelerCustodyAcceptance {
  const data = snapshotData(snapshot);
  const insp = recordValue(data.inspection);
  const acks = recordValue(data.acknowledgements);

  return {
    acceptedAt: toDomainTimestamp(data.acceptedAt) ?? "",
    acceptedByUserId: stringValue(data.acceptedByUserId),
    shipmentId: stringValue(data.shipmentId),
    bookingId: stringValue(data.bookingId),
    custodyVersion: numberValue(data.custodyVersion),
    custodyPolicyVersion: stringValue(data.custodyPolicyVersion),
    declarationVersion: stringValue(data.declarationVersion),
    packageContentVersion: numberValue(data.packageContentVersion),
    senderDeclarationVersion: stringValue(data.senderDeclarationVersion),
    inspection: {
      packageAvailableForInspection: (insp.packageAvailableForInspection === true) as true,
      packagingSecure: (insp.packagingSecure === true) as true,
      weightAppearsReasonable: (insp.weightAppearsReasonable === true) as true,
      noVisibleLeak: (insp.noVisibleLeak === true) as true,
      noVisibleBatteryDamage: (insp.noVisibleBatteryDamage === true) as true,
      noSuspiciousWiring: (insp.noSuspiciousWiring === true) as true,
      noUnusualOdorOrContamination: (insp.noUnusualOdorOrContamination === true) as true,
      noVisibleConcealment: (insp.noVisibleConcealment === true) as true,
      visibleContentsAppearConsistent: (insp.visibleContentsAppearConsistent === true) as true,
    },
    acknowledgements: {
      personallyInspected: (acks.personallyInspected === true) as true,
      contentsAppearConsistent: (acks.contentsAppearConsistent === true) as true,
      noSuspiciousItemsObserved: (acks.noSuspiciousItemsObserved === true) as true,
      safeTransportationAccepted: (acks.safeTransportationAccepted === true) as true,
      reasonableCustodyResponsibilityAccepted: (acks.reasonableCustodyResponsibilityAccepted === true) as true,
    },
  };
}

export function toFirestoreTravelerCustodyAcceptance(
  acceptance: Omit<TravelerCustodyAcceptance, "acceptedAt">,
): DocumentData {
  return {
    acceptedByUserId: acceptance.acceptedByUserId,
    shipmentId: acceptance.shipmentId,
    bookingId: acceptance.bookingId,
    custodyVersion: acceptance.custodyVersion,
    custodyPolicyVersion: acceptance.custodyPolicyVersion,
    declarationVersion: acceptance.declarationVersion,
    packageContentVersion: acceptance.packageContentVersion,
    senderDeclarationVersion: acceptance.senderDeclarationVersion,
    inspection: {
      packageAvailableForInspection: acceptance.inspection.packageAvailableForInspection,
      packagingSecure: acceptance.inspection.packagingSecure,
      weightAppearsReasonable: acceptance.inspection.weightAppearsReasonable,
      noVisibleLeak: acceptance.inspection.noVisibleLeak,
      noVisibleBatteryDamage: acceptance.inspection.noVisibleBatteryDamage,
      noSuspiciousWiring: acceptance.inspection.noSuspiciousWiring,
      noUnusualOdorOrContamination: acceptance.inspection.noUnusualOdorOrContamination,
      noVisibleConcealment: acceptance.inspection.noVisibleConcealment,
      visibleContentsAppearConsistent: acceptance.inspection.visibleContentsAppearConsistent,
    },
    acknowledgements: {
      personallyInspected: acceptance.acknowledgements.personallyInspected,
      contentsAppearConsistent: acceptance.acknowledgements.contentsAppearConsistent,
      noSuspiciousItemsObserved: acceptance.acknowledgements.noSuspiciousItemsObserved,
      safeTransportationAccepted: acceptance.acknowledgements.safeTransportationAccepted,
      reasonableCustodyResponsibilityAccepted: acceptance.acknowledgements.reasonableCustodyResponsibilityAccepted,
    },
  };
}
