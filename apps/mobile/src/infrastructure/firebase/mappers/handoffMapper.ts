import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type {
  BookingHandoffAgreement,
  HandoffAppointment,
  HandoffConfirmation,
  HandoffContactInfo,
  HandoffReceiverInfo,
  HandoffVerificationState,
} from "../../../domain/handoff/HandoffAgreement";
import {
  booleanValue,
  numberValue,
  snapshotData,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapHandoffAgreement(
  snapshot: DocumentSnapshot<DocumentData>,
): BookingHandoffAgreement {
  const data = snapshotData(snapshot);

  const senderContactRaw = (data.senderContact ?? {}) as DocumentData;
  const travelerContactRaw = (data.travelerContact ?? {}) as DocumentData;
  const receiverRaw = (data.receiver ?? {}) as DocumentData;
  const pickupRaw = (data.pickup ?? {}) as DocumentData;
  const dropoffRaw = (data.dropoff ?? {}) as DocumentData;
  const confirmationRaw = (data.confirmation ?? {}) as DocumentData;
  const pickupVerificationRaw = (data.pickupVerification ?? {}) as DocumentData;
  const deliveryVerificationRaw = (data.deliveryVerification ?? {}) as DocumentData;

  const senderContact: HandoffContactInfo = {
    name: stringValue(senderContactRaw.name),
    phone: senderContactRaw.phone ? stringValue(senderContactRaw.phone) : null,
    email: senderContactRaw.email ? stringValue(senderContactRaw.email) : null,
    notes: senderContactRaw.notes ? stringValue(senderContactRaw.notes) : null,
  };

  const travelerContact: HandoffContactInfo = {
    name: stringValue(travelerContactRaw.name),
    phone: travelerContactRaw.phone ? stringValue(travelerContactRaw.phone) : null,
    email: travelerContactRaw.email ? stringValue(travelerContactRaw.email) : null,
    notes: travelerContactRaw.notes ? stringValue(travelerContactRaw.notes) : null,
  };

  const receiver: HandoffReceiverInfo = {
    name: stringValue(receiverRaw.name),
    phone: stringValue(receiverRaw.phone),
    email: receiverRaw.email ? stringValue(receiverRaw.email) : null,
    label: receiverRaw.label ? stringValue(receiverRaw.label) : null,
    isSenderReceiver: booleanValue(receiverRaw.isSenderReceiver),
  };

  const pickup: HandoffAppointment = {
    meetingPoint: stringValue(pickupRaw.meetingPoint),
    scheduledAt: pickupRaw.scheduledAt ? stringValue(pickupRaw.scheduledAt) : null,
    notes: pickupRaw.notes ? stringValue(pickupRaw.notes) : null,
  };

  const dropoff: HandoffAppointment = {
    meetingPoint: stringValue(dropoffRaw.meetingPoint),
    scheduledAt: dropoffRaw.scheduledAt ? stringValue(dropoffRaw.scheduledAt) : null,
    notes: dropoffRaw.notes ? stringValue(dropoffRaw.notes) : null,
  };

  const confirmation: HandoffConfirmation = {
    status: (confirmationRaw.status as HandoffConfirmation["status"]) || "needs_confirmation",
    proposedBy: confirmationRaw.proposedBy ? stringValue(confirmationRaw.proposedBy) : null,
    confirmedBy: confirmationRaw.confirmedBy ? stringValue(confirmationRaw.confirmedBy) : null,
    confirmedAt: toDomainTimestamp(confirmationRaw.confirmedAt),
  };

  const pickupVerification: HandoffVerificationState = {
    verified: booleanValue(pickupVerificationRaw.verified),
    verifiedAt: toDomainTimestamp(pickupVerificationRaw.verifiedAt),
    verifiedBy: pickupVerificationRaw.verifiedBy ? stringValue(pickupVerificationRaw.verifiedBy) : null,
    failedAttempts: numberValue(pickupVerificationRaw.failedAttempts),
  };

  const deliveryVerification: HandoffVerificationState = {
    verified: booleanValue(deliveryVerificationRaw.verified),
    verifiedAt: toDomainTimestamp(deliveryVerificationRaw.verifiedAt),
    verifiedBy: deliveryVerificationRaw.verifiedBy ? stringValue(deliveryVerificationRaw.verifiedBy) : null,
    failedAttempts: numberValue(deliveryVerificationRaw.failedAttempts),
  };

  return {
    id: snapshot.id,
    bookingId: stringValue(data.bookingId) || snapshot.id,
    senderContact,
    travelerContact,
    receiver,
    pickup,
    dropoff,
    confirmation,
    pickupVerification,
    deliveryVerification,
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreHandoffAgreement(
  agreement: BookingHandoffAgreement,
): DocumentData {
  return {
    bookingId: agreement.bookingId,
    senderContact: {
      name: agreement.senderContact.name,
      phone: agreement.senderContact.phone ?? null,
      email: agreement.senderContact.email ?? null,
      notes: agreement.senderContact.notes ?? null,
    },
    travelerContact: {
      name: agreement.travelerContact.name,
      phone: agreement.travelerContact.phone ?? null,
      email: agreement.travelerContact.email ?? null,
      notes: agreement.travelerContact.notes ?? null,
    },
    receiver: {
      name: agreement.receiver.name,
      phone: agreement.receiver.phone,
      email: agreement.receiver.email ?? null,
      label: agreement.receiver.label ?? null,
      isSenderReceiver: agreement.receiver.isSenderReceiver,
    },
    pickup: {
      meetingPoint: agreement.pickup.meetingPoint,
      scheduledAt: agreement.pickup.scheduledAt ?? null,
      notes: agreement.pickup.notes ?? null,
    },
    dropoff: {
      meetingPoint: agreement.dropoff.meetingPoint,
      scheduledAt: agreement.dropoff.scheduledAt ?? null,
      notes: agreement.dropoff.notes ?? null,
    },
    confirmation: {
      status: agreement.confirmation.status,
      proposedBy: agreement.confirmation.proposedBy ?? null,
      confirmedBy: agreement.confirmation.confirmedBy ?? null,
      confirmedAt: agreement.confirmation.confirmedAt
        ? toFirestoreTimestamp(agreement.confirmation.confirmedAt)
        : null,
    },
    pickupVerification: {
      verified: agreement.pickupVerification.verified,
      verifiedAt: agreement.pickupVerification.verifiedAt
        ? toFirestoreTimestamp(agreement.pickupVerification.verifiedAt)
        : null,
      verifiedBy: agreement.pickupVerification.verifiedBy ?? null,
      failedAttempts: agreement.pickupVerification.failedAttempts,
    },
    deliveryVerification: {
      verified: agreement.deliveryVerification.verified,
      verifiedAt: agreement.deliveryVerification.verifiedAt
        ? toFirestoreTimestamp(agreement.deliveryVerification.verifiedAt)
        : null,
      verifiedBy: agreement.deliveryVerification.verifiedBy ?? null,
      failedAttempts: agreement.deliveryVerification.failedAttempts,
    },
    createdAt: agreement.createdAt ? toFirestoreTimestamp(agreement.createdAt) : null,
    updatedAt: agreement.updatedAt ? toFirestoreTimestamp(agreement.updatedAt) : null,
  };
}
