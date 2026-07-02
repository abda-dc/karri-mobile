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
