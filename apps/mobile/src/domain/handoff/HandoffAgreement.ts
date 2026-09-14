import type { DomainEntity } from "../shared/Entity";

export type HandoffConfirmationStatus = "needs_confirmation" | "proposed" | "confirmed";

export interface HandoffContactInfo {
  readonly name: string;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly notes?: string | null;
}

export interface HandoffReceiverInfo {
  readonly name: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly label?: string | null;
  readonly isSenderReceiver: boolean;
}

export interface HandoffAppointment {
  readonly meetingPoint: string;
  readonly scheduledAt: string | null;
  readonly notes?: string | null;
}

export interface HandoffConfirmation {
  readonly status: HandoffConfirmationStatus;
  readonly proposedBy: string | null;
  readonly confirmedBy: string | null;
  readonly confirmedAt: string | null;
}

export interface HandoffVerificationState {
  readonly verified: boolean;
  readonly verifiedAt: string | null;
  readonly verifiedBy: string | null;
  readonly failedAttempts: number;
}

export interface BookingHandoffAgreement extends DomainEntity {
  readonly bookingId: string;
  readonly senderContact: HandoffContactInfo;
  readonly travelerContact: HandoffContactInfo;
  readonly receiver: HandoffReceiverInfo;
  readonly pickup: HandoffAppointment;
  readonly dropoff: HandoffAppointment;
  readonly confirmation: HandoffConfirmation;
  readonly pickupVerification: HandoffVerificationState;
  readonly deliveryVerification: HandoffVerificationState;
}

export interface HandoffIssuedCode {
  readonly bookingId: string;
  readonly codeType: "pickup" | "delivery";
  readonly code: string;
}
