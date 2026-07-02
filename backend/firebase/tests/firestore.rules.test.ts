import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookingFixture,
  bookingHistoryEntry,
  bookingId,
  bookingRequestFixture,
  bookingRequestId,
  custodyEventFixture,
  fixtureTime,
  identityDocumentFixture,
  identityVerificationFixture,
  notificationFixture,
  notificationPreferencesFixture,
  otherUid,
  reviewFixture,
  senderUid,
  shipmentFixture,
  shipmentId,
  travelerUid,
  tripFixture,
  tripId,
  verificationEvent,
} from "./fixtures";

const projectId = "demo-karri-mobile";
const notificationId = "notification-booking-accepted";
const rulesPath = fileURLToPath(new URL("../firestore.rules", import.meta.url));

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const emulatorAddress = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorAddress) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is missing. Run tests through npm run test:rules.",
    );
  }

  const [host, portText] = emulatorAddress.split(":");
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(portText),
      rules: readFileSync(rulesPath, "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

function userDb(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function seedDoc(path: string, data: DocumentData) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

async function seedListings() {
  await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
  await seedDoc(`trips/${tripId}`, tripFixture());
}

function requestStatusForBooking(status: string) {
  return ["pending", "accepted", "declined", "cancelled"].includes(status)
    ? status
    : "accepted";
}

function historyActorForStatus(status: string) {
  return ["pending", "cancelled", "completed"].includes(status)
    ? senderUid
    : travelerUid;
}

async function seedBookingState(status = "pending") {
  await seedListings();
  await seedDoc(
    `bookingRequests/${bookingRequestId}`,
    bookingRequestFixture({ status: requestStatusForBooking(status) }),
  );
  await seedDoc(
    `bookings/${bookingId}`,
    bookingFixture({
      status,
      statusHistory: [
        bookingHistoryEntry(status, historyActorForStatus(status)),
      ],
    }),
  );
}

async function setBookingStatusAsAdmin(status: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), `bookings/${bookingId}`), {
      status,
      updatedAt: fixtureTime,
    });
  });
}

function clientShipment(overrides: DocumentData = {}) {
  return shipmentFixture({
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  });
}

function clientTrip(overrides: DocumentData = {}) {
  return tripFixture({
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  });
}

describe("shipments", () => {
  it("allows the owner to create, read, and update a shipment", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `shipments/${shipmentId}`);

    await assertSucceeds(setDoc(ref, clientShipment()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      updateDoc(ref, { status: "closed", updatedAt: serverTimestamp() }),
    );
  });

  it("allows signed-in marketplace reads only while a listing is active", async () => {
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    const otherRef = doc(userDb(otherUid), `shipments/${shipmentId}`);

    await assertSucceeds(getDoc(otherRef));
    await seedDoc(
      `shipments/${shipmentId}`,
      shipmentFixture({ status: "draft" }),
    );
    await assertFails(getDoc(otherRef));
  });

  it("denies a non-owner update", async () => {
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    await assertFails(
      updateDoc(doc(userDb(otherUid), `shipments/${shipmentId}`), {
        status: "closed",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies forged ownership on create and update", async () => {
    const senderDb = userDb(senderUid);
    await assertFails(
      setDoc(doc(senderDb, "shipments/forged-create"),
        clientShipment({ ownerId: otherUid })),
    );

    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    await assertFails(
      updateDoc(doc(senderDb, `shipments/${shipmentId}`), {
        ownerId: otherUid,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies deletion", async () => {
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    await assertFails(
      deleteDoc(doc(userDb(senderUid), `shipments/${shipmentId}`)),
    );
  });
});

describe("trips", () => {
  it("allows the owner to create, read, and update a trip", async () => {
    const db = userDb(travelerUid);
    const ref = doc(db, `trips/${tripId}`);

    await assertSucceeds(setDoc(ref, clientTrip()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      updateDoc(ref, { status: "closed", updatedAt: serverTimestamp() }),
    );
  });

  it("allows signed-in marketplace reads only while a trip is active", async () => {
    await seedDoc(`trips/${tripId}`, tripFixture());
    const otherRef = doc(userDb(otherUid), `trips/${tripId}`);

    await assertSucceeds(getDoc(otherRef));
    await seedDoc(`trips/${tripId}`, tripFixture({ status: "draft" }));
    await assertFails(getDoc(otherRef));
  });

  it("denies non-owner updates and forged ownership", async () => {
    await seedDoc(`trips/${tripId}`, tripFixture());
    await assertFails(
      updateDoc(doc(userDb(senderUid), `trips/${tripId}`), {
        status: "closed",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(
        doc(userDb(travelerUid), "trips/forged-create"),
        clientTrip({ ownerId: otherUid }),
      ),
    );
  });

  it("denies deletion", async () => {
    await seedDoc(`trips/${tripId}`, tripFixture());
    await assertFails(deleteDoc(doc(userDb(travelerUid), `trips/${tripId}`)));
  });
});

describe("booking requests and bookings", () => {
  it("allows the sender to atomically create linked records", async () => {
    await seedListings();
    const db = userDb(senderUid);
    const batch = writeBatch(db);
    batch.set(doc(db, `bookingRequests/${bookingRequestId}`),
      bookingRequestFixture({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    batch.set(doc(db, `bookings/${bookingId}`),
      bookingFixture({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));

    await assertSucceeds(batch.commit());
  });

  it("denies forged sender ownership and mismatched linked records", async () => {
    await seedListings();
    const db = userDb(senderUid);
    const batch = writeBatch(db);
    batch.set(doc(db, `bookingRequests/${bookingRequestId}`),
      bookingRequestFixture({
        senderId: otherUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    batch.set(doc(db, `bookings/${bookingId}`),
      bookingFixture({
        senderId: otherUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    await assertFails(batch.commit());

    const mismatchBatch = writeBatch(db);
    mismatchBatch.set(doc(db, `bookingRequests/${bookingRequestId}`),
      bookingRequestFixture({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    mismatchBatch.set(doc(db, `bookings/${bookingId}`),
      bookingFixture({
        travelerId: otherUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    await assertFails(mismatchBatch.commit());
  });

  it("allows sender and traveler reads but denies another user", async () => {
    await seedBookingState();

    for (const uid of [senderUid, travelerUid]) {
      await assertSucceeds(
        getDoc(doc(userDb(uid), `bookingRequests/${bookingRequestId}`)),
      );
      await assertSucceeds(getDoc(doc(userDb(uid), `bookings/${bookingId}`)));
    }

    await assertFails(
      getDoc(doc(userDb(otherUid), `bookingRequests/${bookingRequestId}`)),
    );
    await assertFails(getDoc(doc(userDb(otherUid), `bookings/${bookingId}`)));
  });

  it.each([
    ["pending", "accepted", travelerUid, true],
    ["pending", "declined", travelerUid, true],
    ["pending", "cancelled", senderUid, true],
    ["accepted", "in_transit", travelerUid, false],
    ["in_transit", "delivered", travelerUid, false],
    ["delivered", "completed", senderUid, false],
  ])(
    "allows the %s -> %s transition by its authorized actor",
    async (fromStatus, toStatus, actorUid, updateRequest) => {
      await seedBookingState(fromStatus);
      const db = userDb(actorUid);
      const batch = writeBatch(db);
      if (updateRequest) {
        batch.update(doc(db, `bookingRequests/${bookingRequestId}`), {
          status: toStatus,
          updatedAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, `bookings/${bookingId}`), {
        status: toStatus,
        statusHistory: [
          bookingHistoryEntry(fromStatus, historyActorForStatus(fromStatus)),
          bookingHistoryEntry(toStatus, actorUid),
        ],
        updatedAt: serverTimestamp(),
      });

      await assertSucceeds(batch.commit());
    },
  );

  it("denies unauthorized and invalid transitions", async () => {
    await seedBookingState("pending");
    const otherDb = userDb(otherUid);
    const unauthorizedBatch = writeBatch(otherDb);
    unauthorizedBatch.update(
      doc(otherDb, `bookingRequests/${bookingRequestId}`),
      { status: "accepted", updatedAt: serverTimestamp() },
    );
    unauthorizedBatch.update(doc(otherDb, `bookings/${bookingId}`), {
      status: "accepted",
      statusHistory: [
        bookingHistoryEntry("pending"),
        bookingHistoryEntry("accepted", otherUid),
      ],
      updatedAt: serverTimestamp(),
    });
    await assertFails(unauthorizedBatch.commit());

    const travelerDb = userDb(travelerUid);
    await assertFails(
      updateDoc(doc(travelerDb, `bookings/${bookingId}`), {
        status: "in_transit",
        statusHistory: [
          bookingHistoryEntry("pending"),
          bookingHistoryEntry("in_transit", travelerUid),
        ],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("requires atomic agreement between a pending request and booking", async () => {
    await seedBookingState("pending");
    await assertFails(
      updateDoc(doc(userDb(travelerUid), `bookings/${bookingId}`), {
        status: "accepted",
        statusHistory: [
          bookingHistoryEntry("pending"),
          bookingHistoryEntry("accepted", travelerUid),
        ],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies deletion of either linked record", async () => {
    await seedBookingState();
    const senderDb = userDb(senderUid);
    await assertFails(
      deleteDoc(doc(senderDb, `bookingRequests/${bookingRequestId}`)),
    );
    await assertFails(deleteDoc(doc(senderDb, `bookings/${bookingId}`)));
  });
});

describe("notifications", () => {
  it("allows only the recipient to read a notification", async () => {
    await seedDoc(`notifications/${notificationId}`, notificationFixture());
    await assertSucceeds(
      getDoc(doc(userDb(senderUid), `notifications/${notificationId}`)),
    );
    await assertFails(
      getDoc(doc(userDb(otherUid), `notifications/${notificationId}`)),
    );
  });

  it("allows the recipient to mark an unread notification as read", async () => {
    await seedDoc(`notifications/${notificationId}`, notificationFixture());
    await assertSucceeds(
      updateDoc(doc(userDb(senderUid), `notifications/${notificationId}`), {
        status: "read",
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies cross-user and illegal notification updates", async () => {
    await seedDoc(`notifications/${notificationId}`, notificationFixture());
    await assertFails(
      updateDoc(doc(userDb(otherUid), `notifications/${notificationId}`), {
        status: "read",
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(userDb(senderUid), `notifications/${notificationId}`), {
        body: "Forged notification content",
        status: "read",
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows a valid participant-generated booking notification", async () => {
    await seedBookingState("accepted");
    await assertSucceeds(
      setDoc(
        doc(userDb(travelerUid), `notifications/${notificationId}`),
        notificationFixture({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  it("denies deletion", async () => {
    await seedDoc(`notifications/${notificationId}`, notificationFixture());
    await assertFails(
      deleteDoc(doc(userDb(senderUid), `notifications/${notificationId}`)),
    );
  });
});

describe("notification preferences", () => {
  it("allows self create, read, and update", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `notificationPreferences/${senderUid}`);
    await assertSucceeds(
      setDoc(ref, notificationPreferencesFixture({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })),
    );
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      updateDoc(ref, {
        channels: { push: false, email: false, sms: false },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies cross-user reads and writes", async () => {
    await seedDoc(
      `notificationPreferences/${senderUid}`,
      notificationPreferencesFixture(),
    );
    await assertFails(
      getDoc(doc(userDb(otherUid), `notificationPreferences/${senderUid}`)),
    );
    await assertFails(
      setDoc(
        doc(userDb(otherUid), `notificationPreferences/${otherUid}`),
        notificationPreferencesFixture({
          userId: senderUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  it("denies invalid channels and categories", async () => {
    const db = userDb(senderUid);
    await assertFails(
      setDoc(
        doc(db, `notificationPreferences/${senderUid}`),
        notificationPreferencesFixture({
          channels: { push: true, email: true, sms: false },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, `notificationPreferences/${senderUid}`),
        notificationPreferencesFixture({
          categories: {
            booking_requests: true,
            booking_updates: true,
            custody_updates: true,
            delivery_updates: true,
            general_announcements: false,
            review_reminders: true,
            trust_profile_alerts: true,
            forged_category: true,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  it("denies deletion", async () => {
    await seedDoc(
      `notificationPreferences/${senderUid}`,
      notificationPreferencesFixture(),
    );
    await assertFails(
      deleteDoc(
        doc(userDb(senderUid), `notificationPreferences/${senderUid}`),
      ),
    );
  });
});

describe("identity verification", () => {
  it("allows self create, read, and draft editing", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `identityVerifications/${senderUid}`);
    await assertSucceeds(
      setDoc(ref, identityVerificationFixture({
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })),
    );
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      updateDoc(ref, {
        documents: [identityDocumentFixture()],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows a valid self submission event append", async () => {
    await seedDoc(
      `identityVerifications/${senderUid}`,
      identityVerificationFixture({ documents: [identityDocumentFixture()] }),
    );
    const submittedAt = Timestamp.fromDate(
      new Date("2026-01-16T12:00:00.000Z"),
    );
    await assertSucceeds(
      updateDoc(
        doc(userDb(senderUid), `identityVerifications/${senderUid}`),
        {
          status: "submitted",
          events: [
            verificationEvent(),
            verificationEvent({
              id: "verification-event-submitted",
              fromStatus: "draft",
              toStatus: "submitted",
              status: "submitted",
              createdAt: submittedAt,
            }),
          ],
          submittedAt,
          updatedAt: serverTimestamp(),
        },
      ),
    );
  });

  it("denies cross-user reads and updates", async () => {
    await seedDoc(
      `identityVerifications/${senderUid}`,
      identityVerificationFixture(),
    );
    const otherRef = doc(
      userDb(otherUid),
      `identityVerifications/${senderUid}`,
    );
    await assertFails(getDoc(otherRef));
    await assertFails(
      updateDoc(otherRef, { documents: [], updatedAt: serverTimestamp() }),
    );
  });

  it("denies an invalid or forged submission event append", async () => {
    await seedDoc(
      `identityVerifications/${senderUid}`,
      identityVerificationFixture(),
    );
    const submittedAt = Timestamp.fromDate(
      new Date("2026-01-16T12:00:00.000Z"),
    );
    await assertFails(
      updateDoc(
        doc(userDb(senderUid), `identityVerifications/${senderUid}`),
        {
          status: "submitted",
          events: [
            verificationEvent(),
            verificationEvent({
              id: "verification-event-forged",
              actorId: otherUid,
              fromStatus: "draft",
              toStatus: "submitted",
              status: "submitted",
              createdAt: submittedAt,
            }),
          ],
          submittedAt,
          updatedAt: serverTimestamp(),
        },
      ),
    );
  });

  it("denies deletion", async () => {
    await seedDoc(
      `identityVerifications/${senderUid}`,
      identityVerificationFixture(),
    );
    await assertFails(
      deleteDoc(
        doc(userDb(senderUid), `identityVerifications/${senderUid}`),
      ),
    );
  });
});

describe("users and profiles", () => {
  it("allows self user create, read, and update", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `users/${senderUid}`);
    await assertSucceeds(
      setDoc(ref, { userId: senderUid, displayName: "Selam Sender" }),
    );
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { displayName: "Selam A." }));
  });

  it("denies cross-user user access and user deletion", async () => {
    await seedDoc(`users/${senderUid}`, {
      userId: senderUid,
      displayName: "Selam Sender",
    });
    await assertFails(getDoc(doc(userDb(otherUid), `users/${senderUid}`)));
    await assertFails(
      updateDoc(doc(userDb(otherUid), `users/${senderUid}`), {
        displayName: "Forged",
      }),
    );
    await assertFails(deleteDoc(doc(userDb(senderUid), `users/${senderUid}`)));
  });

  it("allows self profile create, read, and update without trust mutation", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `profiles/${senderUid}`);
    await assertSucceeds(
      setDoc(ref, {
        userId: senderUid,
        displayName: "Selam Sender",
        trustScore: null,
      }),
    );
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      updateDoc(ref, { displayName: "Selam A.", trustScore: null }),
    );
  });

  it("denies cross-user profile access and deletion", async () => {
    await seedDoc(`profiles/${senderUid}`, {
      userId: senderUid,
      displayName: "Selam Sender",
      trustScore: null,
    });
    await assertFails(getDoc(doc(userDb(otherUid), `profiles/${senderUid}`)));
    await assertFails(
      updateDoc(doc(userDb(otherUid), `profiles/${senderUid}`), {
        displayName: "Forged",
      }),
    );
    await assertFails(
      deleteDoc(doc(userDb(senderUid), `profiles/${senderUid}`)),
    );
  });

  it("denies client trustScore creation or modification", async () => {
    const db = userDb(senderUid);
    await assertFails(
      setDoc(doc(db, `profiles/${senderUid}`), {
        userId: senderUid,
        displayName: "Selam Sender",
        trustScore: 80,
      }),
    );

    await seedDoc(`profiles/${senderUid}`, {
      userId: senderUid,
      displayName: "Selam Sender",
      trustScore: 50,
    });
    await assertFails(
      updateDoc(doc(db, `profiles/${senderUid}`), { trustScore: 90 }),
    );
  });
});

describe("reviews and trust", () => {
  it("allows signed-in users to read reviews", async () => {
    const reviewId = `${bookingId}__${senderUid}__${travelerUid}`;
    await seedDoc(`reviews/${reviewId}`, reviewFixture());
    await assertSucceeds(getDoc(doc(userDb(otherUid), `reviews/${reviewId}`)));
  });

  it("allows a completed-booking participant to create a valid review", async () => {
    await seedBookingState("completed");
    const reviewId = `${bookingId}__${senderUid}__${travelerUid}`;
    await assertSucceeds(
      setDoc(doc(userDb(senderUid), `reviews/${reviewId}`),
        reviewFixture({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })),
    );
  });

  it("denies invalid reviewers, subjects, and incomplete bookings", async () => {
    await seedBookingState("completed");
    const validId = `${bookingId}__${senderUid}__${travelerUid}`;
    await assertFails(
      setDoc(doc(userDb(otherUid), `reviews/${validId}`),
        reviewFixture({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })),
    );

    const invalidSubjectId = `${bookingId}__${senderUid}__${otherUid}`;
    await assertFails(
      setDoc(doc(userDb(senderUid), `reviews/${invalidSubjectId}`),
        reviewFixture({
          subjectId: otherUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })),
    );

    await setBookingStatusAsAdmin("delivered");
    await assertFails(
      setDoc(doc(userDb(senderUid), `reviews/${validId}`),
        reviewFixture({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })),
    );
  });

  it("denies trust score reads and writes", async () => {
    await seedDoc(`trustScores/${senderUid}`, {
      userId: senderUid,
      score: 85,
    });
    const ref = doc(userDb(senderUid), `trustScores/${senderUid}`);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { userId: senderUid, score: 100 }));
  });
});

describe("custody events", () => {
  async function createCustodyEvent(
    uid: string,
    eventType: string,
    bookingStatus: string,
  ) {
    const db = userDb(uid);
    return setDoc(
      doc(db, `custodyEvents/${bookingId}__${eventType}`),
      custodyEventFixture(eventType, uid, bookingStatus, {
        timestamp: serverTimestamp(),
      }),
    );
  }

  it("allows the full valid participant/sequence progression", async () => {
    await seedBookingState("pending");
    await assertSucceeds(
      createCustodyEvent(senderUid, "shipment_created", "pending"),
    );

    await setBookingStatusAsAdmin("accepted");
    await assertSucceeds(
      createCustodyEvent(travelerUid, "traveler_accepted", "accepted"),
    );

    await setBookingStatusAsAdmin("in_transit");
    for (const eventType of [
      "pickup_confirmed",
      "airport_departure",
      "airport_arrival",
    ]) {
      await assertSucceeds(
        createCustodyEvent(travelerUid, eventType, "in_transit"),
      );
    }

    await setBookingStatusAsAdmin("delivered");
    await assertSucceeds(
      createCustodyEvent(travelerUid, "delivery_confirmed", "delivered"),
    );

    await setBookingStatusAsAdmin("completed");
    await assertSucceeds(
      createCustodyEvent(senderUid, "completed", "completed"),
    );
  });

  it("allows participants to read and denies non-participants", async () => {
    await seedBookingState("pending");
    await seedDoc(
      `custodyEvents/${bookingId}__shipment_created`,
      custodyEventFixture("shipment_created", senderUid, "pending"),
    );
    const path = `custodyEvents/${bookingId}__shipment_created`;
    await assertSucceeds(getDoc(doc(userDb(senderUid), path)));
    await assertSucceeds(getDoc(doc(userDb(travelerUid), path)));
    await assertFails(getDoc(doc(userDb(otherUid), path)));
  });

  it("denies an invalid sequence", async () => {
    await seedBookingState("in_transit");
    await assertFails(
      createCustodyEvent(travelerUid, "airport_departure", "in_transit"),
    );
  });

  it("denies the wrong performer", async () => {
    await seedBookingState("in_transit");
    await seedDoc(
      `custodyEvents/${bookingId}__traveler_accepted`,
      custodyEventFixture("traveler_accepted", travelerUid, "accepted"),
    );
    await assertFails(
      createCustodyEvent(senderUid, "pickup_confirmed", "in_transit"),
    );
  });

  it("denies event updates and deletes", async () => {
    await seedBookingState("pending");
    const path = `custodyEvents/${bookingId}__shipment_created`;
    await seedDoc(
      path,
      custodyEventFixture("shipment_created", senderUid, "pending"),
    );
    const ref = doc(userDb(senderUid), path);
    await assertFails(updateDoc(ref, { note: "Rewritten audit event" }));
    await assertFails(deleteDoc(ref));
  });
});
