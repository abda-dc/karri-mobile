export interface TravelerCustodyAcceptance {
  readonly acceptedAt: string;
  readonly acceptedByUserId: string;
  readonly shipmentId: string;
  readonly bookingId: string;

  readonly custodyVersion: number;
  readonly custodyPolicyVersion: string;
  readonly declarationVersion: string;

  readonly packageContentVersion: number;
  readonly senderDeclarationVersion: string;

  readonly inspection: {
    readonly packageAvailableForInspection: true;
    readonly packagingSecure: true;
    readonly weightAppearsReasonable: true;
    readonly noVisibleLeak: true;
    readonly noVisibleBatteryDamage: true;
    readonly noSuspiciousWiring: true;
    readonly noUnusualOdorOrContamination: true;
    readonly noVisibleConcealment: true;
    readonly visibleContentsAppearConsistent: true;
  };

  readonly acknowledgements: {
    readonly personallyInspected: true;
    readonly contentsAppearConsistent: true;
    readonly noSuspiciousItemsObserved: true;
    readonly safeTransportationAccepted: true;
    readonly reasonableCustodyResponsibilityAccepted: true;
  };
}
