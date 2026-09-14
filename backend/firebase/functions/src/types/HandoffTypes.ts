import type { Timestamp } from "firebase-admin/firestore";

export type HandoffConfirmationStatus = "needs_confirmation" | "proposed" | "confirmed";

export interface HandoffContactInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface HandoffReceiverInfo {
  name: string;
  phone: string;
  email?: string | null;
  label?: string | null;
  isSenderReceiver: boolean;
}

export interface HandoffAppointment {
  meetingPoint: string;
  scheduledAt: string | null;
  notes?: string | null;
}

export interface HandoffConfirmation {
  status: HandoffConfirmationStatus;
  proposedBy: string | null;
  confirmedBy: string | null;
  confirmedAt: Timestamp | null;
}

export interface HandoffVerificationState {
  verified: boolean;
  verifiedAt: Timestamp | null;
  verifiedBy: string | null;
  failedAttempts: number;
}

export interface BookingHandoffAgreement {
  bookingId: string;
  senderContact: HandoffContactInfo;
  travelerContact: HandoffContactInfo;
  receiver: HandoffReceiverInfo;
  pickup: HandoffAppointment;
  dropoff: HandoffAppointment;
  confirmation: HandoffConfirmation;
  pickupVerification: HandoffVerificationState;
  deliveryVerification: HandoffVerificationState;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BookingHandoffSecrets {
  bookingId: string;
  senderId: string;
  travelerId: string;
  pickupCodeHash: string | null;
  pickupSalt: string | null;
  pickupIssued: boolean;
  pickupAttempts: number;
  pickupMaxAttempts: number;
  pickupVerified: boolean;
  pickupGeneratedAt: Timestamp | null;
  deliveryCodeHash: string | null;
  deliverySalt: string | null;
  deliveryIssued: boolean;
  deliveryAttempts: number;
  deliveryMaxAttempts: number;
  deliveryVerified: boolean;
  deliveryGeneratedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
