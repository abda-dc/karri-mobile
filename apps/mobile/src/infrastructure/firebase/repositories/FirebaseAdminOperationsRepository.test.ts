import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ kind: "collection", name }),
  getCountFromServer: firestoreMocks.getCountFromServer,
  getDocs: firestoreMocks.getDocs,
  limit: (value: number) => ({ kind: "limit", value }),
  orderBy: (field: string, direction: string) => ({
    kind: "orderBy",
    field,
    direction,
  }),
  query: (source: unknown, ...constraints: unknown[]) => ({
    kind: "query",
    source,
    constraints,
  }),
  where: (field: string, operator: string, value: unknown) => ({
    kind: "where",
    field,
    operator,
    value,
  }),
  addDoc: firestoreMocks.addDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  setDoc: firestoreMocks.setDoc,
  updateDoc: firestoreMocks.updateDoc,
  writeBatch: firestoreMocks.writeBatch,
}));

vi.mock("../client", () => ({
  getFirebaseServices: () => ({ db: { name: "test-db" } }),
}));

import type { AuthorizationRole } from "../../../domain/authorization/roles";
import { FirebaseAdminOperationsRepository } from "./FirebaseAdminOperationsRepository";

type QueryDescriptor = {
  readonly source: { readonly name: string };
  readonly constraints: ReadonlyArray<{
    readonly kind: string;
    readonly field?: string;
    readonly operator?: string;
    readonly value?: unknown;
  }>;
};

const createdAt = "2026-07-30T12:00:00.000Z";

function collectionName(value: unknown): string {
  return (value as QueryDescriptor).source.name;
}

function document(id: string, data: Readonly<Record<string, unknown>>) {
  return { id, data: () => data };
}

function availableValue<T>(section: unknown): T {
  expect(section).toMatchObject({ status: "available" });
  return (section as { readonly value: T }).value;
}

function configureSuccessfulReads(options?: {
  readonly documents?: Partial<Record<string, ReadonlyArray<ReturnType<typeof document>>>>;
  readonly counts?: Partial<Record<string, number>>;
}) {
  const counts: Record<string, number> = {
    shipments: 4,
    trips: 3,
    bookingRequests: 2,
    bookings: 5,
    ...options?.counts,
  };
  const documents: Record<string, ReadonlyArray<ReturnType<typeof document>>> = {
    shipmentSafetyReviews: [
      document("review-1", {
        shipmentId: "shipment-1",
        actorUid: "private-reviewer-uid",
        decision: "approved",
        reasonCode: "verified_safe",
        note: "private note",
        createdAt,
      }),
    ],
    administrativeHolds: [
      document("hold-1", {
        shipmentId: "shipment-2",
        status: "active",
        reasonCode: "manual_investigation",
        placedByUid: "private-admin-uid",
        placedAt: { toDate: () => new Date(createdAt) },
      }),
    ],
    bookings: [
      document("booking-1", {
        shipmentId: "shipment-3",
        tripId: "trip-1",
        senderId: "private-sender-uid",
        travelerId: "private-traveler-uid",
        status: "in_transit",
        createdAt,
      }),
    ],
    ...options?.documents,
  };

  firestoreMocks.getCountFromServer.mockImplementation(async (queryValue) => ({
    data: () => ({ count: counts[collectionName(queryValue)] ?? 0 }),
  }));
  firestoreMocks.getDocs.mockImplementation(async (queryValue) => ({
    docs: documents[collectionName(queryValue)] ?? [],
  }));
}

async function readAs(role: AuthorizationRole) {
  return new FirebaseAdminOperationsRepository().getOverview(role);
}

describe("FirebaseAdminOperationsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureSuccessfulReads();
  });

  it("allows super_admin to read every section with exact aggregate counts and narrow DTOs", async () => {
    const result = await readAs("super_admin");

    expect(availableValue<number>(result.activeShipments)).toBe(4);
    expect(availableValue<number>(result.activeTrips)).toBe(3);
    expect(availableValue<number>(result.pendingBookingRequests)).toBe(2);
    expect(availableValue<number>(result.activeBookings)).toBe(5);
    expect(availableValue(result.recentShipmentSafetyReviews)).toEqual([
      {
        id: "review-1",
        shipmentId: "shipment-1",
        decision: "approved",
        reasonCode: "verified_safe",
        createdAt,
      },
    ]);
    expect(availableValue(result.activeAdministrativeHolds)).toEqual([
      {
        id: "hold-1",
        shipmentId: "shipment-2",
        reasonCode: "manual_investigation",
        placedAt: createdAt,
      },
    ]);
    expect(availableValue(result.recentBookings)).toEqual([
      {
        id: "booking-1",
        shipmentId: "shipment-3",
        tripId: "trip-1",
        status: "in_transit",
        createdAt,
      },
    ]);
    expect(firestoreMocks.getCountFromServer).toHaveBeenCalledTimes(4);
    expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it.each([
    ["operations_admin", 3, 2, ["activeShipments", "recentShipmentSafetyReviews"]],
    [
      "safety_admin",
      1,
      2,
      ["activeTrips", "pendingBookingRequests", "activeBookings", "recentBookings"],
    ],
    [
      "moderator",
      1,
      1,
      [
        "activeTrips",
        "pendingBookingRequests",
        "activeBookings",
        "activeAdministrativeHolds",
        "recentBookings",
      ],
    ],
  ] as const)(
    "suppresses unauthorized queries for %s and returns partial access",
    async (role, expectedCountReads, expectedListReads, unauthorizedSections) => {
      const result = await readAs(role);

      expect(firestoreMocks.getCountFromServer).toHaveBeenCalledTimes(expectedCountReads);
      expect(firestoreMocks.getDocs).toHaveBeenCalledTimes(expectedListReads);
      for (const sectionName of unauthorizedSections) {
        expect(result[sectionName]).toEqual({
          status: "unauthorized",
          reason: "insufficient-role",
        });
      }
    },
  );

  it("returns available zeroes and empty lists for empty results", async () => {
    configureSuccessfulReads({
      counts: { shipments: 0, trips: 0, bookingRequests: 0, bookings: 0 },
      documents: {
        shipmentSafetyReviews: [],
        administrativeHolds: [],
        bookings: [],
      },
    });

    const result = await readAs("super_admin");

    expect(availableValue(result.activeShipments)).toBe(0);
    expect(availableValue(result.activeTrips)).toBe(0);
    expect(availableValue(result.pendingBookingRequests)).toBe(0);
    expect(availableValue(result.activeBookings)).toBe(0);
    expect(availableValue(result.recentShipmentSafetyReviews)).toEqual([]);
    expect(availableValue(result.activeAdministrativeHolds)).toEqual([]);
    expect(availableValue(result.recentBookings)).toEqual([]);
  });

  it("isolates a failed query and does not expose the raw Firebase error", async () => {
    const privateMarker = "raw-firebase-private-marker";
    firestoreMocks.getCountFromServer.mockImplementation(async (queryValue) => {
      if (collectionName(queryValue) === "trips") {
        throw new Error(privateMarker);
      }
      return { data: () => ({ count: 1 }) };
    });

    const result = await readAs("super_admin");

    expect(result.activeTrips).toEqual({
      status: "unavailable",
      reason: "query-failed",
    });
    expect(availableValue(result.activeShipments)).toBe(1);
    expect(availableValue(result.recentBookings)).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(privateMarker);
  });

  it("maps a server permission denial to unauthorized without returning Firebase details", async () => {
    const privateMarker = "permission-private-marker";
    firestoreMocks.getDocs.mockImplementation(async (queryValue) => {
      if (collectionName(queryValue) === "administrativeHolds") {
        throw { code: "firestore/permission-denied", message: privateMarker };
      }
      return { docs: [] };
    });

    const result = await readAs("operations_admin");

    expect(result.activeAdministrativeHolds).toEqual({
      status: "unauthorized",
      reason: "permission-denied",
    });
    expect(JSON.stringify(result)).not.toContain(privateMarker);
  });

  it("safely skips malformed documents while preserving valid documents", async () => {
    configureSuccessfulReads({
      documents: {
        shipmentSafetyReviews: [
          document("malformed-review", {
            shipmentId: "shipment-1",
            decision: "unexpected",
            reasonCode: "verified_safe",
            createdAt,
          }),
          document("valid-review", {
            shipmentId: "shipment-2",
            decision: "rejected",
            reasonCode: "prohibited_item",
            createdAt,
          }),
        ],
        administrativeHolds: [
          document("malformed-hold", {
            shipmentId: "shipment-1",
            status: "active",
            reasonCode: "manual_investigation",
            placedAt: "not-a-date",
          }),
        ],
        bookings: [
          document("malformed-booking", {
            shipmentId: "shipment-1",
            tripId: "trip-1",
            status: "invalid",
            createdAt,
          }),
        ],
      },
    });

    const result = await readAs("super_admin");

    expect(availableValue(result.recentShipmentSafetyReviews)).toEqual([
      {
        id: "valid-review",
        shipmentId: "shipment-2",
        decision: "rejected",
        reasonCode: "prohibited_item",
        createdAt,
      },
    ]);
    expect(availableValue(result.activeAdministrativeHolds)).toEqual([]);
    expect(availableValue(result.recentBookings)).toEqual([]);
  });

  it("never invokes a Firestore write API", async () => {
    await readAs("super_admin");

    for (const writeApi of [
      firestoreMocks.addDoc,
      firestoreMocks.deleteDoc,
      firestoreMocks.setDoc,
      firestoreMocks.updateDoc,
      firestoreMocks.writeBatch,
    ]) {
      expect(writeApi).not.toHaveBeenCalled();
    }
  });
});
