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
  const base = shipmentFixture();
  return {
    ...base,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    safetyDeclaration: {
      ...base.safetyDeclaration,
      acceptedAt: serverTimestamp(),
    },
    ...overrides,
  };
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

  it("denies creation with missing safety declaration", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `shipments/${shipmentId}-missing-decl`);

    const shipment = clientShipment();
    delete (shipment as any).safetyDeclaration;

    await assertFails(setDoc(ref, shipment));
  });

  it("denies creation with any unchecked safety acknowledgement", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `shipments/${shipmentId}-unchecked`);

    const shipment = clientShipment();
    shipment.safetyDeclaration.acknowledgements.contentsAccurate = false;

    await assertFails(setDoc(ref, shipment));
  });

  it("denies creation with mismatched acceptedByUserId", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `shipments/${shipmentId}-wrong-user`);

    const shipment = clientShipment();
    shipment.safetyDeclaration.acceptedByUserId = otherUid;

    await assertFails(setDoc(ref, shipment));
  });

  it("denies creation with mismatched packageContentVersion", async () => {
    const db = userDb(senderUid);
    const ref = doc(db, `shipments/${shipmentId}-wrong-ver`);

    const shipment = clientShipment();
    shipment.packageContentVersion = 2;

    await assertFails(setDoc(ref, shipment));
  });

  it("denies safety content change update without version increment or new declaration", async () => {
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    const ref = doc(userDb(senderUid), `shipments/${shipmentId}`);

    await assertFails(
      updateDoc(ref, {
        packageDescription: "A brand new safety-relevant description",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("allows safety content change update with incremented version and fresh declaration", async () => {
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    const ref = doc(userDb(senderUid), `shipments/${shipmentId}`);

    const base = shipmentFixture();
    await assertSucceeds(
      updateDoc(ref, {
        packageDescription: "A brand new safety-relevant description",
        packageContentVersion: 2,
        safetyDeclaration: {
          ...base.safetyDeclaration,
          packageContentVersion: 2,
          acceptedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies version increment if safety content did not change", async () => {
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture());
    const ref = doc(userDb(senderUid), `shipments/${shipmentId}`);

    const base = shipmentFixture();
    await assertFails(
      updateDoc(ref, {
        packageContentVersion: 2,
        safetyDeclaration: {
          ...base.safetyDeclaration,
          packageContentVersion: 2,
          acceptedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

function clientTravelerCustodyAcceptance(overrides: DocumentData = {}) {
  return {
    bookingId,
    shipmentId,
    acceptedByUserId: travelerUid,
    custodyVersion: 1,
    custodyPolicyVersion: "2026-07-v1",
    declarationVersion: "v1",
    packageContentVersion: 1,
    senderDeclarationVersion: "v1",
    inspection: {
      packageAvailableForInspection: true,
      packagingSecure: true,
      weightAppearsReasonable: true,
      noVisibleLeak: true,
      noVisibleBatteryDamage: true,
      noSuspiciousWiring: true,
      noUnusualOdorOrContamination: true,
      noVisibleConcealment: true,
      visibleContentsAppearConsistent: true,
    },
    acknowledgements: {
      personallyInspected: true,
      contentsAppearConsistent: true,
      noSuspiciousItemsObserved: true,
      safeTransportationAccepted: true,
      reasonableCustodyResponsibilityAccepted: true,
    },
    acceptedAt: serverTimestamp(),
    ...overrides,
  };
}

describe("traveler custody acceptances", () => {
  beforeEach(async () => {
    // Seed prerequisite docs
    await seedDoc(`shipments/${shipmentId}`, shipmentFixture({ packageContentVersion: 1 }));
    await seedDoc(`trips/${tripId}`, tripFixture());
    await seedDoc(
      `bookingRequests/${bookingRequestId}`,
      bookingRequestFixture({ status: "accepted" }),
    );
    await seedDoc(
      `bookings/${bookingId}`,
      bookingFixture({
        status: "accepted",
        statusHistory: [
          bookingHistoryEntry("pending", senderUid),
          bookingHistoryEntry("accepted", travelerUid),
        ],
      }),
    );
    await seedDoc(
      `custodyEvents/${bookingId}__traveler_accepted`,
      custodyEventFixture("traveler_accepted", travelerUid, "accepted"),
    );
  });

  it("allows traveler to atomically confirm pickup and submit custody acceptance", async () => {
    const db = userDb(travelerUid);
    const batch = writeBatch(db);

    const bookingRef = doc(db, `bookings/${bookingId}`);
    const acceptanceRef = doc(db, `travelerCustodyAcceptances/${bookingId}`);
    const eventRef = doc(db, `custodyEvents/${bookingId}__pickup_confirmed`);

    batch.update(bookingRef, {
      status: "in_transit",
      statusHistory: [
        bookingHistoryEntry("pending", senderUid),
        bookingHistoryEntry("accepted", travelerUid),
        bookingHistoryEntry("in_transit", travelerUid),
      ],
      updatedAt: serverTimestamp(),
    });

    batch.set(acceptanceRef, clientTravelerCustodyAcceptance());

    batch.set(eventRef, {
      bookingId,
      shipmentId,
      eventType: "pickup_confirmed",
      performedBy: travelerUid,
      location: "Addis Ababa",
      note: null,
      metadata: { bookingStatus: "in_transit" },
      timestamp: serverTimestamp(),
    });

    await assertSucceeds(batch.commit());
  });

  it("denies independent custody acceptance creation without booking transition", async () => {
    const db = userDb(travelerUid);
    const acceptanceRef = doc(db, `travelerCustodyAcceptances/${bookingId}`);

    await assertFails(setDoc(acceptanceRef, clientTravelerCustodyAcceptance()));
  });

  it("denies custody acceptance if any visual inspection check is false", async () => {
    const db = userDb(travelerUid);
    const batch = writeBatch(db);

    const bookingRef = doc(db, `bookings/${bookingId}`);
    const acceptanceRef = doc(db, `travelerCustodyAcceptances/${bookingId}`);
    const eventRef = doc(db, `custodyEvents/${bookingId}__pickup_confirmed`);

    batch.update(bookingRef, {
      status: "in_transit",
      statusHistory: [
        bookingHistoryEntry("pending", senderUid),
        bookingHistoryEntry("accepted", travelerUid),
        bookingHistoryEntry("in_transit", travelerUid),
      ],
      updatedAt: serverTimestamp(),
    });

    batch.set(
      acceptanceRef,
      clientTravelerCustodyAcceptance({
        inspection: {
          packageAvailableForInspection: true,
          packagingSecure: false, // failed inspection
          weightAppearsReasonable: true,
          noVisibleLeak: true,
          noVisibleBatteryDamage: true,
          noSuspiciousWiring: true,
          noUnusualOdorOrContamination: true,
          noVisibleConcealment: true,
          visibleContentsAppearConsistent: true,
        },
      }),
    );

    batch.set(eventRef, {
      bookingId,
      shipmentId,
      eventType: "pickup_confirmed",
      performedBy: travelerUid,
      location: "Addis Ababa",
      note: null,
      metadata: { bookingStatus: "in_transit" },
      timestamp: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  it("denies access if performed by a forged traveler identity", async () => {
    const db = userDb(otherUid); // wrong user
    const batch = writeBatch(db);

    const bookingRef = doc(db, `bookings/${bookingId}`);
    const acceptanceRef = doc(db, `travelerCustodyAcceptances/${bookingId}`);

    batch.update(bookingRef, {
      status: "in_transit",
      statusHistory: [
        bookingHistoryEntry("pending", senderUid),
        bookingHistoryEntry("accepted", travelerUid),
        bookingHistoryEntry("in_transit", travelerUid),
      ],
      updatedAt: serverTimestamp(),
    });

    batch.set(acceptanceRef, clientTravelerCustodyAcceptance());

    await assertFails(batch.commit());
  });

  it("permits reads only to booking participants and denies update/delete", async () => {
    // Seed acceptance as admin
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      const acceptanceRef = doc(adminDb, `travelerCustodyAcceptances/${bookingId}`);
      const baseAcceptance = clientTravelerCustodyAcceptance();
      baseAcceptance.acceptedAt = fixtureTime as any;
      await setDoc(acceptanceRef, baseAcceptance);
    });

    const senderRef = doc(userDb(senderUid), `travelerCustodyAcceptances/${bookingId}`);
    const travelerRef = doc(userDb(travelerUid), `travelerCustodyAcceptances/${bookingId}`);
    const otherRef = doc(userDb(otherUid), `travelerCustodyAcceptances/${bookingId}`);

    // Read checks
    await assertSucceeds(getDoc(senderRef));
    await assertSucceeds(getDoc(travelerRef));
    await assertFails(getDoc(otherRef));

    // Update and delete checks
    await assertFails(updateDoc(travelerRef, { custodyVersion: 2 }));
    await assertFails(deleteDoc(travelerRef));
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

      if (toStatus === "in_transit") {
        await seedDoc(`shipments/${shipmentId}`, shipmentFixture({ packageContentVersion: 1 }));
        const acceptanceRef = doc(db, `travelerCustodyAcceptances/${bookingId}`);
        batch.set(acceptanceRef, clientTravelerCustodyAcceptance());
      }

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

  it("denies traveler creation of a booking.accepted notification", async () => {
    await seedBookingState("accepted");
    await assertFails(
      setDoc(
        doc(userDb(travelerUid), `notifications/${notificationId}`),
        notificationFixture({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  it("denies sender creation of a booking.accepted notification for themselves", async () => {
    await seedBookingState("accepted");
    await assertFails(
      setDoc(
        doc(userDb(senderUid), `notifications/${notificationId}`),
        notificationFixture({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  it("keeps valid client creation for a non-migrated notification type", async () => {
    await seedBookingState("declined");
    await assertSucceeds(
      setDoc(
        doc(userDb(travelerUid), `notifications/${notificationId}`),
        notificationFixture({
          type: "booking.declined",
          title: "Booking declined",
          body: "The booking request was declined.",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  it("allows trusted Admin SDK writes outside client rule enforcement", async () => {
    await seedDoc(`notifications/${notificationId}`, notificationFixture());
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await assertSucceeds(
        getDoc(doc(context.firestore(), `notifications/${notificationId}`)),
      );
    });
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

describe("notification deliveries", () => {
  it("keeps delivery effects server-only", async () => {
    const deliveryId = "delivery-n3a-test";
    await seedDoc(`notificationDeliveries/${deliveryId}`, {
      notificationId,
      bookingId,
      recipientId: senderUid,
      registrationId: "karri-aaaaaaaaaaaaaaaa",
      registrationVersion: 1,
      provider: "expo",
      platform: "android",
      status: "claimed",
      outcomeCode: null,
      providerTicketId: null,
      createdAt: fixtureTime,
      updatedAt: fixtureTime,
    });

    await assertFails(
      getDoc(doc(userDb(senderUid), `notificationDeliveries/${deliveryId}`)),
    );
    await assertFails(
      setDoc(doc(userDb(senderUid), "notificationDeliveries/forged"), {
        status: "accepted",
      }),
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

describe("Milestone 31 - Coarse Admin Roles and Multi-Role Access Control Boundary", () => {
  const adminUid = "admin-user-123";

  function roleDb(uid: string, claim: any) {
    const authOpts = typeof claim === "string" ? { role: claim } : claim;
    return testEnv.authenticatedContext(uid, authOpts).firestore();
  }

  it("proves moderator, safety_admin, and super_admin can read non-active shipments, while others are denied", async () => {
    const path = `shipments/${shipmentId}`;
    await seedDoc(path, shipmentFixture({ status: "draft" }));

    // Allowed roles
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "moderator"), path)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

    // Denied roles & ordinary user
    await assertFails(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "user"), path)));
    await assertFails(getDoc(doc(userDb(otherUid), path))); // Ordinary unprivileged user
  });

  it("proves operations_admin and super_admin can read non-active trips, while others are denied", async () => {
    const path = `trips/${tripId}`;
    await seedDoc(path, tripFixture({ status: "draft" }));

    // Allowed roles
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

    // Denied roles & ordinary user
    await assertFails(getDoc(doc(roleDb(adminUid, "moderator"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
    await assertFails(getDoc(doc(userDb(otherUid), path)));
  });

  it("proves operations_admin and super_admin can read bookings and bookingRequests, while others are denied", async () => {
    await seedBookingState("pending");
    const bookingPath = `bookings/${bookingId}`;
    const requestPath = `bookingRequests/${bookingRequestId}`;

    // Allowed roles
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "operations_admin"), bookingPath)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), bookingPath)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "operations_admin"), requestPath)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), requestPath)));

    // Denied roles & ordinary non-participant user
    await assertFails(getDoc(doc(roleDb(adminUid, "moderator"), bookingPath)));
    await assertFails(getDoc(doc(roleDb(adminUid, "safety_admin"), bookingPath)));
    await assertFails(getDoc(doc(roleDb(adminUid, "support"), bookingPath)));
    await assertFails(getDoc(doc(userDb(otherUid), bookingPath)));
  });

  it("proves moderator, safety_admin, and super_admin can read traveler custody acceptances, while others are denied", async () => {
    await seedBookingState("accepted");
    const path = `travelerCustodyAcceptances/${bookingId}`;
    const testAcceptance = {
      acceptedByUserId: travelerUid,
      shipmentId,
      bookingId,
      custodyVersion: 1,
      custodyPolicyVersion: "2026-07-v1",
      declarationVersion: "v1",
      packageContentVersion: 1,
      senderDeclarationVersion: "v1",
      acceptedAt: new Date(),
      inspection: {
        packageAvailableForInspection: true,
        packagingSecure: true,
        weightAppearsReasonable: true,
        noVisibleLeak: true,
        noVisibleBatteryDamage: true,
        noSuspiciousWiring: true,
        noUnusualOdorOrContamination: true,
        noVisibleConcealment: true,
        visibleContentsAppearConsistent: true,
      },
      acknowledgements: {
        personallyInspected: true,
        contentsAppearConsistent: true,
        noSuspiciousItemsObserved: true,
        safeTransportationAccepted: true,
        reasonableCustodyResponsibilityAccepted: true,
      },
    };
    await seedDoc(path, testAcceptance);

    // Allowed roles
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "moderator"), path)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

    // Denied roles & ordinary non-participant user
    await assertFails(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
    await assertFails(getDoc(doc(userDb(otherUid), path)));
  });

  it("proves safety_admin and super_admin can read identityVerifications, while others are denied", async () => {
    const path = `identityVerifications/${otherUid}`;
    await seedDoc(path, identityVerificationFixture(otherUid));

    // Allowed roles
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
    await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

    // Denied roles & ordinary user (other than owner)
    await assertFails(getDoc(doc(roleDb(adminUid, "moderator"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
    await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
    await assertFails(getDoc(doc(userDb(senderUid), path)));
  });

  it("proves invalid or absent claims receive no administrative access", async () => {
    const path = `bookings/${bookingId}`;
    await seedBookingState("pending");

    // Absent claim
    await assertFails(getDoc(doc(roleDb(adminUid, {}), path)));

    // Unsupported string claim
    await assertFails(getDoc(doc(roleDb(adminUid, "unsupported_admin_role"), path)));

    // Non-string claim type
    await assertFails(getDoc(doc(roleDb(adminUid, { role: 123 }), path)));
  });

  it("proves administrative write operations are denied for all clients", async () => {
    // Attempting direct custody acceptance deletion
    const acceptancePath = `travelerCustodyAcceptances/${bookingId}`;
    const ref = doc(roleDb(adminUid, "super_admin"), acceptancePath);
    await assertFails(deleteDoc(ref));

    // Attempting direct shipment deletion
    const shipmentRef = doc(roleDb(adminUid, "super_admin"), `shipments/${shipmentId}`);
    await assertFails(deleteDoc(shipmentRef));
  });

  it("proves profile escalation attempt does not grant administrative access and only token claims control authorization", async () => {
    const maliciousUid = "malicious-user-999";
    const profilePath = `profiles/${maliciousUid}`;
    const maliciousProfile = {
      userId: maliciousUid,
      trustScore: null,
      authorizationRole: "super_admin",
      adminRole: "super_admin",
      permissions: ["assign_roles", "view_operations"],
      role: "super_admin",
    };

    // Client writes their own profile (rules allow profile creation by owner)
    const unprivilegedDb = testEnv.authenticatedContext(maliciousUid).firestore();
    await assertSucceeds(setDoc(doc(unprivilegedDb, profilePath), maliciousProfile));

    // Seed a newly protected administrative read resource: a draft shipment owned by senderUid
    const shipmentPath = `shipments/${shipmentId}`;
    await seedDoc(shipmentPath, shipmentFixture({ status: "draft" }));

    // 1. Verify read fails when query is run as the malicious user WITHOUT the token claim
    await assertFails(getDoc(doc(unprivilegedDb, shipmentPath)));

    // 2. Verify read succeeds when query is run as the same user WITH the trusted token claim (role: moderator)
    const privilegedDb = testEnv.authenticatedContext(maliciousUid, { role: "moderator" }).firestore();
    await assertSucceeds(getDoc(doc(privilegedDb, shipmentPath)));
  });

  describe("Milestone 31 Patch 5 - Server-Authoritative Administrative Actions Collections Rules", () => {
    const adminUid = "adminUid";

    it("proves client writes to auditLogs, shipmentSafetyReviews, and administrativeHolds are denied for all roles", async () => {
      const superAdminDb = roleDb(adminUid, "super_admin");

      // Deny create
      await assertFails(setDoc(doc(superAdminDb, "auditLogs/log-1"), { action: "hold.place" }));
      await assertFails(setDoc(doc(superAdminDb, "shipmentSafetyReviews/rev-1"), { decision: "approved" }));
      await assertFails(setDoc(doc(superAdminDb, "administrativeHolds/hold-1"), { status: "active" }));

      // Deny update
      await seedDoc("auditLogs/log-1", { action: "hold.place" });
      await seedDoc("shipmentSafetyReviews/rev-1", { decision: "approved" });
      await seedDoc("administrativeHolds/hold-1", { status: "active" });

      await assertFails(updateDoc(doc(superAdminDb, "auditLogs/log-1"), { action: "hold.release" }));
      await assertFails(updateDoc(doc(superAdminDb, "shipmentSafetyReviews/rev-1"), { decision: "rejected" }));
      await assertFails(updateDoc(doc(superAdminDb, "administrativeHolds/hold-1"), { status: "released" }));

      // Deny delete
      await assertFails(deleteDoc(doc(superAdminDb, "auditLogs/log-1")));
      await assertFails(deleteDoc(doc(superAdminDb, "shipmentSafetyReviews/rev-1")));
      await assertFails(deleteDoc(doc(superAdminDb, "administrativeHolds/hold-1")));
    });

    it("proves only super_admin can read auditLogs", async () => {
      const path = "auditLogs/log-1";
      await seedDoc(path, { action: "hold.place" });

      // Allowed
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

      // Denied
      await assertFails(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
      await assertFails(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
      await assertFails(getDoc(doc(roleDb(adminUid, "moderator"), path)));
      await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
      await assertFails(getDoc(doc(userDb(otherUid), path)));
    });

    it("proves moderator, safety_admin, and super_admin can read shipmentSafetyReviews", async () => {
      const path = "shipmentSafetyReviews/rev-1";
      await seedDoc(path, { decision: "approved" });

      // Allowed
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "moderator"), path)));
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

      // Denied
      await assertFails(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
      await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
      await assertFails(getDoc(doc(userDb(otherUid), path)));
    });

    it("proves only operations_admin, safety_admin, and super_admin can read administrativeHolds", async () => {
      const path = "administrativeHolds/hold-1";
      await seedDoc(path, { status: "active" });

      // Allowed
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "operations_admin"), path)));
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "safety_admin"), path)));
      await assertSucceeds(getDoc(doc(roleDb(adminUid, "super_admin"), path)));

      // Denied (participants or normal users are also blocked)
      await assertFails(getDoc(doc(roleDb(adminUid, "moderator"), path)));
      await assertFails(getDoc(doc(roleDb(adminUid, "support"), path)));
      await assertFails(getDoc(doc(userDb(otherUid), path)));
      await assertFails(getDoc(doc(userDb(senderUid), path)));
      await assertFails(getDoc(doc(userDb(travelerUid), path)));
    });
  });

  describe("Push Token Registrations Client Isolation", () => {
    it("proves clients cannot read or write to pushTokenRegistrations collection and subcollections for any roles", async () => {
      // Test with super admin, regular user, and unauthenticated client
      const superAdminDb = roleDb("admin-1", "super_admin");
      const userDbInstance = userDb("user-1");
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      const path = "pushTokenRegistrations/user-1/devices/karri-device-1";

      // Deny reads
      await assertFails(getDoc(doc(superAdminDb, path)));
      await assertFails(getDoc(doc(userDbInstance, path)));
      await assertFails(getDoc(doc(unauthDb, path)));

      // Deny creates/writes
      const testDoc = {
        userId: "user-1",
        deviceId: "karri-device-1",
        platform: "ios",
        provider: "expo",
        token: "ExponentPushToken[12345]",
        active: true,
      };
      await assertFails(setDoc(doc(superAdminDb, path), testDoc));
      await assertFails(setDoc(doc(userDbInstance, path), testDoc));
      await assertFails(setDoc(doc(unauthDb, path), testDoc));

      // Deny deletes
      await assertFails(deleteDoc(doc(superAdminDb, path)));
      await assertFails(deleteDoc(doc(userDbInstance, path)));
      await assertFails(deleteDoc(doc(unauthDb, path)));
    });
  });
});
