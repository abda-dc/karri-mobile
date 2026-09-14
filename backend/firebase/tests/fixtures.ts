import { Timestamp } from "firebase/firestore";

export const senderUid = "senderUid";
export const travelerUid = "travelerUid";
export const otherUid = "otherUid";

export const shipmentId = "shipment-ethiopia-to-usa";
export const tripId = "trip-ethiopia-to-usa";
export const bookingRequestId = "request-ethiopia-to-usa";
export const bookingId = "booking-ethiopia-to-usa";

export const fixtureTime = Timestamp.fromDate(
  new Date("2026-01-15T12:00:00.000Z"),
);

type Overrides = Record<string, unknown>;

export function shipmentFixture(overrides: Overrides = {}) {
  return {
    ownerId: senderUid,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "documents",
    packageDescription: "University records in a sealed envelope",
    weightKg: 0.5,
    deliveryWindow: "2026-02-01 to 2026-02-10",
    rewardAmount: 75,
    rewardCurrency: "USD",
    status: "active",
    containsBattery: false,
    batteryType: "none",
    containsLiquid: false,
    containsFoodOrAgri: false,
    containsMedicine: false,
    customsDeclarationRequired: false,
    packageContentVersion: 1,
    safetyDeclaration: {
      policyVersion: "2026-07-v1",
      declarationVersion: "v1",
      acceptedAt: fixtureTime,
      acceptedByUserId: senderUid,
      packageContentVersion: 1,
      acknowledgements: {
        contentsAccurate: true,
        noProhibitedItems: true,
        inspectionPermitted: true,
        customsResponsibilityAccepted: true,
      }
    },
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function tripFixture(overrides: Overrides = {}) {
  return {
    ownerId: travelerUid,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    departureDate: "2026-02-03",
    arrivalDate: "2026-02-04",
    availableCapacityKg: 8,
    notes: "Direct flight with carry-on capacity",
    status: "active",
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function bookingRequestFixture(overrides: Overrides = {}) {
  return {
    bookingId,
    shipmentId,
    tripId,
    senderId: senderUid,
    travelerId: travelerUid,
    message: "Can you carry these documents?",
    status: "pending",
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function bookingHistoryEntry(
  status = "pending",
  changedBy = senderUid,
) {
  return {
    status,
    changedBy,
    changedAt: fixtureTime,
  };
}

export function bookingFixture(overrides: Overrides = {}) {
  return {
    bookingRequestId,
    shipmentId,
    tripId,
    senderId: senderUid,
    travelerId: travelerUid,
    status: "pending",
    statusHistory: [bookingHistoryEntry()],
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function notificationFixture(overrides: Overrides = {}) {
  return {
    userId: senderUid,
    title: "Booking accepted",
    body: "Your traveler accepted the booking.",
    type: "booking.accepted",
    relatedEntityType: "booking",
    relatedId: bookingId,
    status: "unread",
    readAt: null,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function notificationPreferencesFixture(overrides: Overrides = {}) {
  return {
    userId: senderUid,
    channels: {
      push: true,
      email: false,
      sms: false,
    },
    categories: {
      booking_requests: true,
      booking_updates: true,
      custody_updates: true,
      delivery_updates: true,
      general_announcements: false,
      review_reminders: true,
      trust_profile_alerts: true,
    },
    quietHours: {
      startLocalTime: "22:00",
      endLocalTime: "07:00",
      timeZone: "America/New_York",
    },
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function verificationEvent(
  overrides: Overrides = {},
) {
  return {
    id: "verification-event-draft",
    verificationId: senderUid,
    actorId: senderUid,
    actorType: "user",
    fromStatus: "unverified",
    toStatus: "draft",
    status: "draft",
    reason: null,
    createdAt: fixtureTime,
    ...overrides,
  };
}

export function identityDocumentFixture(overrides: Overrides = {}) {
  return {
    id: "passport-metadata-1",
    type: "passport",
    label: "Passport",
    issuingCountryCode: "ET",
    expiresAt: null,
    storagePath: null,
    uploadedAt: null,
    ...overrides,
  };
}

export function identityVerificationFixture(overrides: Overrides = {}) {
  return {
    userId: senderUid,
    status: "draft",
    level: "basic",
    documents: [],
    events: [verificationEvent()],
    submittedAt: null,
    reviewedAt: null,
    expiresAt: null,
    rejectionReason: null,
    revokedReason: null,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function reviewFixture(overrides: Overrides = {}) {
  return {
    bookingId,
    reviewerId: senderUid,
    subjectId: travelerUid,
    direction: "sender_reviews_traveler",
    rating: 5,
    comment: "Clear communication and careful handling.",
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function custodyEventFixture(
  eventType: string,
  performedBy: string,
  bookingStatus: string,
  overrides: Overrides = {},
) {
  return {
    bookingId,
    shipmentId,
    eventType,
    performedBy,
    location: "Addis Ababa",
    note: null,
    metadata: { bookingStatus },
    timestamp: fixtureTime,
    ...overrides,
  };
}

export function handoffAgreementFixture(overrides: Overrides = {}) {
  return {
    bookingId,
    senderContact: {
      name: "Sender User",
      phone: "+251911223344",
      email: "sender@example.com",
      notes: "Call me when approaching the meeting point.",
    },
    travelerContact: {
      name: "Traveler User",
      phone: "+251922334455",
      email: "traveler@example.com",
      notes: "I will be wearing a blue jacket.",
    },
    receiver: {
      name: "Destination Recipient",
      phone: "+12025550199",
      email: "receiver@example.com",
      label: "Cousin",
      isSenderReceiver: false,
    },
    pickup: {
      meetingPoint: "Bole Airport Terminal 2 Departures Area B",
      scheduledAt: "2026-02-01T14:00:00Z",
      notes: "Meet near the information desk.",
    },
    dropoff: {
      meetingPoint: "Dulles Airport Arrivals Level 1",
      scheduledAt: "2026-02-02T10:00:00Z",
      notes: "Meet outside baggage claim 4.",
    },
    confirmation: {
      status: "confirmed",
      proposedBy: senderUid,
      confirmedBy: travelerUid,
      confirmedAt: fixtureTime,
    },
    pickupVerification: {
      verified: false,
      verifiedAt: null,
      verifiedBy: null,
      failedAttempts: 0,
    },
    deliveryVerification: {
      verified: false,
      verifiedAt: null,
      verifiedBy: null,
      failedAttempts: 0,
    },
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}

export function handoffSecretsFixture(overrides: Overrides = {}) {
  return {
    bookingId,
    senderId: senderUid,
    travelerId: travelerUid,
    pickupCodeHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    pickupSalt: "fedcba9876543210fedcba9876543210",
    pickupIssued: true,
    pickupAttempts: 0,
    pickupMaxAttempts: 5,
    pickupVerified: false,
    pickupGeneratedAt: fixtureTime,
    deliveryCodeHash: "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
    deliverySalt: "0123456789abcdef0123456789abcdef",
    deliveryIssued: true,
    deliveryAttempts: 0,
    deliveryMaxAttempts: 5,
    deliveryVerified: false,
    deliveryGeneratedAt: fixtureTime,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
    ...overrides,
  };
}
