import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type {
  AdminAdministrativeHold,
  AdminOperationsOverview,
  AdminOperationsSection,
  AdminRecentBooking,
  AdminShipmentSafetyReview,
} from "../../../domain/admin/AdminOperationsOverview";
import type { AdminOperationsRepository } from "../../../domain/admin/AdminOperationsRepository";
import type { AuthorizationRole } from "../../../domain/authorization/roles";
import type { Permission } from "../../../domain/authorization/permissions";
import { hasPermission } from "../../../domain/authorization/rolePermissions";
import type { BookingStatus } from "../../../domain/booking/Booking";
import { getFirebaseServices } from "../client";

const RECENT_ITEM_LIMIT = 20;
const ACTIVE_HOLD_LIMIT = 50;
const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  "accepted",
  "in_transit",
  "delivered",
];
const BOOKING_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  ...ACTIVE_BOOKING_STATUSES,
  "completed",
  "cancelled",
  "declined",
  "expired",
]);
const SAFETY_REVIEW_DECISIONS: ReadonlySet<string> = new Set([
  "approved",
  "rejected",
  "needs_more_information",
]);
const SAFETY_REVIEW_REASON_CODES: ReadonlySet<string> = new Set([
  "restricted_item",
  "prohibited_item",
  "insufficient_information",
  "hazardous_material",
  "declaration_mismatch",
  "documentation_missing",
  "verified_safe",
]);
const ADMINISTRATIVE_HOLD_REASON_CODES: ReadonlySet<string> = new Set([
  "safety_review_pending",
  "suspected_policy_violation",
  "identity_review_required",
  "prohibited_contents",
  "manual_investigation",
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizedTimestamp(value: unknown): string | null {
  let date: Date;

  try {
    if (typeof value === "string") {
      date = new Date(value);
    } else if (isRecord(value) && typeof value.toDate === "function") {
      date = (value.toDate as () => Date)();
    } else {
      return null;
    }
  } catch {
    return null;
  }

  return date instanceof Date && Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function isPermissionDenied(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.code === "permission-denied" || error.code === "firestore/permission-denied";
}

function unavailableSection<T>(error: unknown): AdminOperationsSection<T> {
  return isPermissionDenied(error)
    ? { status: "unauthorized", reason: "permission-denied" }
    : { status: "unavailable", reason: "query-failed" };
}

async function readSection<T>(
  role: AuthorizationRole,
  permission: Permission,
  read: () => Promise<T>,
): Promise<AdminOperationsSection<T>> {
  if (!hasPermission(role, permission)) {
    return { status: "unauthorized", reason: "insufficient-role" };
  }

  try {
    return { status: "available", value: await read() };
  } catch (error) {
    return unavailableSection(error);
  }
}

function mapSafetyReview(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): AdminShipmentSafetyReview | null {
  const data = snapshot.data();
  const id = requiredString(snapshot.id);
  const shipmentId = requiredString(data.shipmentId);
  const decision = requiredString(data.decision);
  const reasonCode = requiredString(data.reasonCode);
  const createdAt = normalizedTimestamp(data.createdAt);

  if (
    !id ||
    !shipmentId ||
    !decision ||
    !SAFETY_REVIEW_DECISIONS.has(decision) ||
    !reasonCode ||
    !SAFETY_REVIEW_REASON_CODES.has(reasonCode) ||
    !createdAt
  ) {
    return null;
  }

  return {
    id,
    shipmentId,
    decision: decision as AdminShipmentSafetyReview["decision"],
    reasonCode,
    createdAt,
  };
}

function mapAdministrativeHold(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): AdminAdministrativeHold | null {
  const data = snapshot.data();
  const id = requiredString(snapshot.id);
  const shipmentId = requiredString(data.shipmentId);
  const reasonCode = requiredString(data.reasonCode);
  const placedAt = normalizedTimestamp(data.placedAt);

  if (
    data.status !== "active" ||
    !id ||
    !shipmentId ||
    !reasonCode ||
    !ADMINISTRATIVE_HOLD_REASON_CODES.has(reasonCode) ||
    !placedAt
  ) {
    return null;
  }

  return { id, shipmentId, reasonCode, placedAt };
}

function mapRecentBooking(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): AdminRecentBooking | null {
  const data = snapshot.data();
  const id = requiredString(snapshot.id);
  const shipmentId = requiredString(data.shipmentId);
  const tripId = requiredString(data.tripId);
  const status = requiredString(data.status);
  const createdAt = normalizedTimestamp(data.createdAt);

  if (
    !id ||
    !shipmentId ||
    !tripId ||
    !status ||
    !BOOKING_STATUSES.has(status) ||
    !createdAt
  ) {
    return null;
  }

  return { id, shipmentId, tripId, status: status as BookingStatus, createdAt };
}

function safelyMap<T>(
  documents: ReadonlyArray<QueryDocumentSnapshot<DocumentData>>,
  mapper: (document: QueryDocumentSnapshot<DocumentData>) => T | null,
): ReadonlyArray<T> {
  const mapped: T[] = [];
  for (const document of documents) {
    try {
      const value = mapper(document);
      if (value) {
        mapped.push(value);
      }
    } catch {
      // A malformed document must not make the rest of the section unavailable.
    }
  }
  return mapped;
}

function readCount(count: unknown): number {
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("Invalid aggregate count.");
  }
  return count;
}

export class FirebaseAdminOperationsRepository
  implements AdminOperationsRepository
{
  async getOverview(role: AuthorizationRole): Promise<AdminOperationsOverview> {
    const { db } = getFirebaseServices();

    const [
      activeShipments,
      activeTrips,
      pendingBookingRequests,
      activeBookings,
      recentShipmentSafetyReviews,
      activeAdministrativeHolds,
      recentBookings,
    ] = await Promise.all([
      readSection(role, "view_safety_declarations", async () => {
        const snapshot = await getCountFromServer(
          query(collection(db, "shipments"), where("status", "==", "active")),
        );
        return readCount(snapshot.data().count);
      }),
      readSection(role, "view_operations", async () => {
        const snapshot = await getCountFromServer(
          query(collection(db, "trips"), where("status", "==", "active")),
        );
        return readCount(snapshot.data().count);
      }),
      readSection(role, "view_operations", async () => {
        const snapshot = await getCountFromServer(
          query(
            collection(db, "bookingRequests"),
            where("status", "==", "pending"),
          ),
        );
        return readCount(snapshot.data().count);
      }),
      readSection(role, "view_operations", async () => {
        const snapshot = await getCountFromServer(
          query(
            collection(db, "bookings"),
            where("status", "in", [...ACTIVE_BOOKING_STATUSES]),
          ),
        );
        return readCount(snapshot.data().count);
      }),
      readSection(role, "view_safety_declarations", async () => {
        const snapshot = await getDocs(
          query(
            collection(db, "shipmentSafetyReviews"),
            orderBy("createdAt", "desc"),
            limit(RECENT_ITEM_LIMIT),
          ),
        );
        return safelyMap(snapshot.docs, mapSafetyReview);
      }),
      readSection(role, "place_administrative_holds", async () => {
        const snapshot = await getDocs(
          query(
            collection(db, "administrativeHolds"),
            where("status", "==", "active"),
            limit(ACTIVE_HOLD_LIMIT),
          ),
        );
        return safelyMap(snapshot.docs, mapAdministrativeHold);
      }),
      readSection(role, "view_operations", async () => {
        const snapshot = await getDocs(
          query(
            collection(db, "bookings"),
            orderBy("createdAt", "desc"),
            limit(RECENT_ITEM_LIMIT),
          ),
        );
        return safelyMap(snapshot.docs, mapRecentBooking);
      }),
    ]);

    return {
      activeShipments,
      activeTrips,
      pendingBookingRequests,
      activeBookings,
      recentShipmentSafetyReviews,
      activeAdministrativeHolds,
      recentBookings,
    };
  }
}
