import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: () => globalThis.crypto.randomUUID(),
}));
import { TripService } from "./TripService";
import { ListingStatus } from "../../domain/shipment/Shipment";
import type { Trip } from "../../domain/trip/Trip";
import type { TripRepository } from "../../domain/trip/TripRepository";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import type { CreateTripDto } from "../dto/commands";
import { DomainValidationError } from "./validation";
import { PendingOperationStorage } from "../../infrastructure/storage/PendingOperationStorage";

describe("TripService - Operation ID & Creation Idempotency", () => {
  let mockTripRepository: TripRepository;
  let mockEvents: EventPublisher;
  const clock = { now: () => "2026-07-11T12:00:00Z" };
  let service: TripService;

  const baseInput: CreateTripDto = {
    ownerId: "user-traveler-1",
    originCountry: "US",
    originCity: "New York",
    destinationCountry: "NG",
    destinationCity: "Lagos",
    departureDate: "2026-08-01",
    arrivalDate: "2026-08-02",
    availableCapacityKg: 10,
    notes: "Carry-on space available",
  };

  beforeEach(() => {
    mockTripRepository = {
      findById: vi.fn(),
      listActive: vi.fn(),
      watchByOwner: vi.fn(),
      watchActive: vi.fn(),
      create: vi.fn(),
    } as unknown as TripRepository;

    mockEvents = {
      publish: vi.fn(),
    };

    service = new TripService(mockTripRepository, mockEvents, clock);
  });

  it("creates a new trip and publishes trip.created event when no existing record", async () => {
    const createdTrip: Trip = {
      ...baseInput,
      notes: baseInput.notes ?? "",
      id: "trip-created-1",
      status: ListingStatus.Active,
      createdAt: "2026-07-11T12:00:00Z",
      updatedAt: "2026-07-11T12:00:00Z",
    };

    vi.mocked(mockTripRepository.findById).mockResolvedValue(null);
    vi.mocked(mockTripRepository.create).mockResolvedValue(createdTrip);

    const result = await service.create({ ...baseInput, operationId: "op-trip-1" });

    expect(mockTripRepository.findById).toHaveBeenCalledWith("trip__user-traveler-1__op-trip-1");
    expect(mockTripRepository.create).toHaveBeenCalledWith(expect.any(Object), "op-trip-1");
    expect(mockEvents.publish).toHaveBeenCalledTimes(1);
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "trip.created",
        aggregateId: "trip-created-1",
      }),
    );
    expect(result).toBe(createdTrip);
  });

  it("returns existing trip without re-publishing event when operationId matches existing payload", async () => {
    const existingTrip: Trip = {
      ...baseInput,
      notes: baseInput.notes ?? "",
      id: "trip__user-traveler-1__op-trip-1",
      status: ListingStatus.Active,
      createdAt: "2026-07-11T12:00:00Z",
      updatedAt: "2026-07-11T12:00:00Z",
    };

    vi.mocked(mockTripRepository.findById).mockResolvedValue(existingTrip);

    const result = await service.create({ ...baseInput, operationId: "op-trip-1" });

    expect(mockTripRepository.findById).toHaveBeenCalledWith("trip__user-traveler-1__op-trip-1");
    expect(mockTripRepository.create).not.toHaveBeenCalled();
    expect(mockEvents.publish).not.toHaveBeenCalled();
    expect(result).toBe(existingTrip);
  });

  it("throws DomainValidationError when operationId matches existing record but payload diverges", async () => {
    const existingTrip: Trip = {
      ...baseInput,
      notes: baseInput.notes ?? "",
      availableCapacityKg: 15, // Divergent capacity
      id: "trip__user-traveler-1__op-trip-1",
      status: ListingStatus.Active,
      createdAt: "2026-07-11T12:00:00Z",
      updatedAt: "2026-07-11T12:00:00Z",
    };

    vi.mocked(mockTripRepository.findById).mockResolvedValue(existingTrip);

    await expect(
      service.create({ ...baseInput, operationId: "op-trip-1" }),
    ).rejects.toThrow(DomainValidationError);

    expect(mockTripRepository.create).not.toHaveBeenCalled();
    expect(mockEvents.publish).not.toHaveBeenCalled();
  });

  describe("Process Death & App Restart Recovery (R09)", () => {
    class InMemoryStorage {
      readonly store = new Map<string, string>();
      async getItem(key: string) { return this.store.get(key) ?? null; }
      async setItem(key: string, value: string) { this.store.set(key, value); }
      async removeItem(key: string) { this.store.delete(key); }
    }

    it("Ambiguous commit + resource exists: persists ID, commits, response lost, abandonment reconciles resource and prevents duplicate creation", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Trip>();

      let recordedOpId: string | null = null;

      const mockRepo: TripRepository = {
        findById: vi.fn(async (id: string) => repoRecords.get(id) ?? null),
        create: vi.fn(async (newTrip, opId) => {
          recordedOpId = opId!;
          const id = `trip__${newTrip.ownerId}__${opId}`;
          const committed: Trip = {
            ...newTrip,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          return committed;
        }),
        listActive: vi.fn(async () => Array.from(repoRecords.values())),
        listByOwner: vi.fn(async (ownerId: string) => Array.from(repoRecords.values()).filter((t) => t.ownerId === ownerId)),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new TripService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. Operation ID persisted & 2. Backend commits resource & 3. Response is lost (timeout)
      let committedTripId: string | null = null;
      try {
        vi.mocked(mockRepo.create).mockImplementationOnce(async (newTrip, opId) => {
          recordedOpId = opId!;
          const id = `trip__${newTrip.ownerId}__${opId}`;
          committedTripId = id;
          const committed: Trip = {
            ...newTrip,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          const timeoutErr = new Error("Network timeout: deadline exceeded");
          (timeoutErr as any).code = "deadline-exceeded";
          throw timeoutErr;
        });
        await service.create({ ...baseInput });
      } catch {
        // Response lost
      }

      // 4. User attempts abandonment
      const reconResult = await service.abandonPendingOperation(baseInput.ownerId);

      // 5. Authoritative reconciliation finds resource & 6. Resource is returned/reconciled
      expect(reconResult.status).toBe("found");
      if (reconResult.status === "found") {
        expect(reconResult.resource.id).toBe(committedTripId);
      }

      // 7. No second operation ID is created & 8. Exactly one resource exists
      expect(repoRecords.size).toBe(1);
      // Pending operation is cleared after authoritative reconciliation
      expect(await pendingStorage.getPendingOperation("trip", baseInput.ownerId)).toBeNull();
    });

    it("Ambiguous failure + resource absent: request fails ambiguously without commit, reconciliation proves absence, clears pending op, and next action gets fresh ID", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Trip>();
      const recordedOpIds: string[] = [];

      const mockRepo: TripRepository = {
        findById: vi.fn(async (id: string) => repoRecords.get(id) ?? null),
        create: vi.fn(async (newTrip, opId) => {
          recordedOpIds.push(opId!);
          const id = `trip__${newTrip.ownerId}__${opId}`;
          const committed: Trip = {
            ...newTrip,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          return committed;
        }),
        listActive: vi.fn(async () => Array.from(repoRecords.values())),
        listByOwner: vi.fn(async (ownerId: string) => Array.from(repoRecords.values()).filter((t) => t.ownerId === ownerId)),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new TripService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. Operation ID persisted & 2. Request fails ambiguously without committing (timeout before commit)
      vi.mocked(mockRepo.create).mockImplementationOnce(async () => {
        const timeoutErr = new Error("Network timeout before commit");
        (timeoutErr as any).code = "deadline-exceeded";
        throw timeoutErr;
      });

      try {
        await service.create({ ...baseInput });
      } catch {
        // Ambiguous failure
      }

      const pendingOpId = await pendingStorage.getPendingOperation("trip", baseInput.ownerId);
      expect(pendingOpId).toBeTruthy();

      // 3. Reconciliation performs an authoritative lookup & 4. Backend confirms exact resource does not exist
      const reconResult = await service.reconcilePendingOperation(baseInput.ownerId);
      expect(reconResult.status).toBe("absent");

      // 5. Pending operation may now be cleared
      expect(await pendingStorage.getPendingOperation("trip", baseInput.ownerId)).toBeNull();

      // 6. Next logical action gets a different operation ID and succeeds
      const nextTrip = await service.create({ ...baseInput });
      expect(nextTrip).toBeTruthy();
      expect(repoRecords.size).toBe(1);
      const nextOpId = recordedOpIds[recordedOpIds.length - 1];
      expect(nextOpId).not.toBe(pendingOpId);
    });

    it("Reconciliation failure: operation outcome ambiguous, reconciliation fails ambiguously, pending operation remains stored and destructive discard is rejected", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Trip>();

      const mockRepo: TripRepository = {
        findById: vi.fn(async () => {
          const timeoutErr = new Error("Reconciliation network timeout");
          (timeoutErr as any).code = "unavailable";
          throw timeoutErr;
        }),
        create: vi.fn(async () => {
          const timeoutErr = new Error("Network unavailable");
          (timeoutErr as any).code = "unavailable";
          throw timeoutErr;
        }),
        listActive: vi.fn(async () => []),
        listByOwner: vi.fn(async () => []),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new TripService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. Operation outcome ambiguous
      try {
        await service.create({ ...baseInput });
      } catch {
        // Network unavailable
      }

      const originalPendingOpId = await pendingStorage.getPendingOperation("trip", baseInput.ownerId);
      expect(originalPendingOpId).toBeTruthy();

      // 2. Reconciliation request also fails ambiguously
      const reconResult = await service.abandonPendingOperation(baseInput.ownerId);

      // 3. Destructive discard is rejected & 4. Pending operation remains stored
      expect(reconResult.status).toBe("unconfirmed");
      const storedAfterFailedRecon = await pendingStorage.getPendingOperation("trip", baseInput.ownerId);
      expect(storedAfterFailedRecon).toBe(originalPendingOpId);
    });

    it("Definitive non-commit: clears pending operation on definitive non-commit, and next action gets different operation ID", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Trip>();
      const recordedOpIds: string[] = [];

      const mockRepo: TripRepository = {
        findById: vi.fn(async (id: string) => repoRecords.get(id) ?? null),
        create: vi.fn(async (newTrip, opId) => {
          recordedOpIds.push(opId!);
          const id = `trip__${newTrip.ownerId}__${opId}`;
          const committed: Trip = {
            ...newTrip,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          return committed;
        }),
        listActive: vi.fn(async () => Array.from(repoRecords.values())),
        listByOwner: vi.fn(async (ownerId: string) => Array.from(repoRecords.values()).filter((t) => t.ownerId === ownerId)),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new TripService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. ID created & 2. Request definitely fails without commit (e.g. permission-denied from Firestore rules)
      vi.mocked(mockRepo.create).mockImplementationOnce(async (_newTrip, opId) => {
        recordedOpIds.push(opId!);
        const permErr = new Error("Permission denied by security rules");
        (permErr as any).code = "permission-denied";
        throw permErr;
      });

      await expect(service.create({ ...baseInput })).rejects.toThrow("Permission denied");
      expect(repoRecords.size).toBe(0);

      // 3. Pending operation is cleared safely (not left to pollute future actions)
      const pendingAfterDefinitiveError = await pendingStorage.getPendingOperation("trip", baseInput.ownerId);
      expect(pendingAfterDefinitiveError).toBeNull();

      // 4. Corrected/new action gets a different operation ID & 5. Creation succeeds
      const created = await service.create({ ...baseInput });
      expect(created).toBeTruthy();
      expect(repoRecords.size).toBe(1);
      expect(recordedOpIds.length).toBe(2);
      expect(recordedOpIds[0]).not.toBe(recordedOpIds[1]);
    });
  });
});
