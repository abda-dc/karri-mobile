import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: () => globalThis.crypto.randomUUID(),
}));
import { ShipmentService } from "./ShipmentService";
import { ListingStatus, type Shipment } from "../../domain/shipment/Shipment";
import type { ShipmentRepository } from "../../domain/shipment/ShipmentRepository";
import type { EventPublisher } from "../../domain/events/DomainEvent";
import type { CreateShipmentDto } from "../dto/commands";
import { CURRENT_POLICY_VERSION, CURRENT_DECLARATION_VERSION } from "../../domain/configuration/SafetyPolicy";
import { DomainValidationError } from "./validation";
import { PendingOperationStorage } from "../../infrastructure/storage/PendingOperationStorage";

describe("ShipmentService - Operation ID & Creation Idempotency", () => {
  let mockShipmentRepository: ShipmentRepository;
  let mockEvents: EventPublisher;
  const clock = { now: () => "2026-07-11T12:00:00Z" };
  let service: ShipmentService;

  const validSafetyDeclaration = {
    policyVersion: CURRENT_POLICY_VERSION,
    declarationVersion: CURRENT_DECLARATION_VERSION,
    acceptedAt: "2026-07-11T12:00:00Z",
    acceptedByUserId: "user-sender-1",
    packageContentVersion: 1,
    acknowledgements: {
      contentsAccurate: true as const,
      noProhibitedItems: true as const,
      inspectionPermitted: true as const,
      customsResponsibilityAccepted: true as const,
    },
  };

  const baseInput: CreateShipmentDto = {
    ownerId: "user-sender-1",
    originCountry: "US",
    originCity: "New York",
    destinationCountry: "NG",
    destinationCity: "Lagos",
    packageCategory: "Electronics",
    packageDescription: "Laptop and cables",
    weightKg: 2.5,
    deliveryWindow: "2026-07-20",
    rewardAmount: 150,
    rewardCurrency: "USD",
    containsBattery: false,
    batteryType: "none",
    containsLiquid: false,
    containsFoodOrAgri: false,
    containsMedicine: false,
    customsDeclarationRequired: false,
    packageContentVersion: 1,
    safetyDeclaration: validSafetyDeclaration,
  };

  beforeEach(() => {
    mockShipmentRepository = {
      findById: vi.fn(),
      listActive: vi.fn(),
      watchByOwner: vi.fn(),
      watchActive: vi.fn(),
      create: vi.fn(),
    } as unknown as ShipmentRepository;

    mockEvents = {
      publish: vi.fn(),
    };

    service = new ShipmentService(mockShipmentRepository, mockEvents, clock);
  });

  it("creates a new shipment and publishes shipment.created event when no existing record", async () => {
    const createdShipment: Shipment = {
      ...baseInput,
      id: "ship-created-1",
      status: ListingStatus.Active,
      rewardCurrency: "USD",
      createdAt: "2026-07-11T12:00:00Z",
      updatedAt: "2026-07-11T12:00:00Z",
    };

    vi.mocked(mockShipmentRepository.findById).mockResolvedValue(null);
    vi.mocked(mockShipmentRepository.create).mockResolvedValue(createdShipment);

    const result = await service.create({ ...baseInput, operationId: "op-ship-1" });

    expect(mockShipmentRepository.findById).toHaveBeenCalledWith("shipment__user-sender-1__op-ship-1");
    expect(mockShipmentRepository.create).toHaveBeenCalledWith(expect.any(Object), "op-ship-1");
    expect(mockEvents.publish).toHaveBeenCalledTimes(1);
    expect(mockEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "shipment.created",
        aggregateId: "ship-created-1",
      }),
    );
    expect(result).toBe(createdShipment);
  });

  it("returns existing shipment without re-publishing event when operationId matches existing payload", async () => {
    const existingShipment: Shipment = {
      ...baseInput,
      id: "shipment__user-sender-1__op-ship-1",
      status: ListingStatus.Active,
      rewardCurrency: "USD",
      createdAt: "2026-07-11T12:00:00Z",
      updatedAt: "2026-07-11T12:00:00Z",
    };

    vi.mocked(mockShipmentRepository.findById).mockResolvedValue(existingShipment);

    const result = await service.create({ ...baseInput, operationId: "op-ship-1" });

    expect(mockShipmentRepository.findById).toHaveBeenCalledWith("shipment__user-sender-1__op-ship-1");
    expect(mockShipmentRepository.create).not.toHaveBeenCalled();
    expect(mockEvents.publish).not.toHaveBeenCalled();
    expect(result).toBe(existingShipment);
  });

  it("throws DomainValidationError when operationId matches existing record but payload diverges", async () => {
    const existingShipment: Shipment = {
      ...baseInput,
      destinationCity: "Abuja", // Divergent destinationCity
      id: "shipment__user-sender-1__op-ship-1",
      status: ListingStatus.Active,
      rewardCurrency: "USD",
      createdAt: "2026-07-11T12:00:00Z",
      updatedAt: "2026-07-11T12:00:00Z",
    };

    vi.mocked(mockShipmentRepository.findById).mockResolvedValue(existingShipment);

    await expect(
      service.create({ ...baseInput, operationId: "op-ship-1" }),
    ).rejects.toThrow(DomainValidationError);

    expect(mockShipmentRepository.create).not.toHaveBeenCalled();
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
      const repoRecords = new Map<string, Shipment>();

      let recordedOpId: string | null = null;

      const mockRepo: ShipmentRepository = {
        findById: vi.fn(async (id: string) => repoRecords.get(id) ?? null),
        create: vi.fn(async (newShipment, opId) => {
          recordedOpId = opId!;
          const id = `shipment__${newShipment.ownerId}__${opId}`;
          const committed: Shipment = {
            ...newShipment,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          return committed;
        }),
        listActive: vi.fn(async () => Array.from(repoRecords.values())),
        listByOwner: vi.fn(async (ownerId: string) => Array.from(repoRecords.values()).filter((s) => s.ownerId === ownerId)),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new ShipmentService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. Operation ID persisted & 2. Backend commits resource & 3. Response is lost (timeout)
      let committedShipmentId: string | null = null;
      try {
        vi.mocked(mockRepo.create).mockImplementationOnce(async (newShipment, opId) => {
          recordedOpId = opId!;
          const id = `shipment__${newShipment.ownerId}__${opId}`;
          committedShipmentId = id;
          const committed: Shipment = {
            ...newShipment,
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
        expect(reconResult.resource.id).toBe(committedShipmentId);
      }

      // 7. No second operation ID is created & 8. Exactly one resource exists
      expect(repoRecords.size).toBe(1);
      // Pending operation is cleared after authoritative reconciliation
      expect(await pendingStorage.getPendingOperation("shipment", baseInput.ownerId)).toBeNull();
    });

    it("Ambiguous failure + resource absent: request fails ambiguously without commit, reconciliation proves absence, clears pending op, and next action gets fresh ID", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Shipment>();
      const recordedOpIds: string[] = [];

      const mockRepo: ShipmentRepository = {
        findById: vi.fn(async (id: string) => repoRecords.get(id) ?? null),
        create: vi.fn(async (newShipment, opId) => {
          recordedOpIds.push(opId!);
          const id = `shipment__${newShipment.ownerId}__${opId}`;
          const committed: Shipment = {
            ...newShipment,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          return committed;
        }),
        listActive: vi.fn(async () => Array.from(repoRecords.values())),
        listByOwner: vi.fn(async (ownerId: string) => Array.from(repoRecords.values()).filter((s) => s.ownerId === ownerId)),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new ShipmentService(mockRepo, mockEvents, clock, pendingStorage);

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

      const pendingOpId = await pendingStorage.getPendingOperation("shipment", baseInput.ownerId);
      expect(pendingOpId).toBeTruthy();

      // 3. Reconciliation performs an authoritative lookup & 4. Backend confirms exact resource does not exist
      const reconResult = await service.reconcilePendingOperation(baseInput.ownerId);
      expect(reconResult.status).toBe("absent");

      // 5. Pending operation may now be cleared
      expect(await pendingStorage.getPendingOperation("shipment", baseInput.ownerId)).toBeNull();

      // 6. Next logical action gets a different operation ID and succeeds
      const nextShipment = await service.create({ ...baseInput });
      expect(nextShipment).toBeTruthy();
      expect(repoRecords.size).toBe(1);
      const nextOpId = recordedOpIds[recordedOpIds.length - 1];
      expect(nextOpId).not.toBe(pendingOpId);
    });

    it("Reconciliation failure: operation outcome ambiguous, reconciliation fails ambiguously, pending operation remains stored and destructive discard is rejected", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Shipment>();

      const mockRepo: ShipmentRepository = {
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

      const service = new ShipmentService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. Operation outcome ambiguous
      try {
        await service.create({ ...baseInput });
      } catch {
        // Network unavailable
      }

      const originalPendingOpId = await pendingStorage.getPendingOperation("shipment", baseInput.ownerId);
      expect(originalPendingOpId).toBeTruthy();

      // 2. Reconciliation request also fails ambiguously
      const reconResult = await service.abandonPendingOperation(baseInput.ownerId);

      // 3. Destructive discard is rejected & 4. Pending operation remains stored
      expect(reconResult.status).toBe("unconfirmed");
      const storedAfterFailedRecon = await pendingStorage.getPendingOperation("shipment", baseInput.ownerId);
      expect(storedAfterFailedRecon).toBe(originalPendingOpId);
    });

    it("Definitive non-commit: clears pending operation on definitive non-commit, and next action gets different operation ID", async () => {
      const storage = new InMemoryStorage();
      const pendingStorage = new PendingOperationStorage(storage);
      const repoRecords = new Map<string, Shipment>();
      const recordedOpIds: string[] = [];

      const mockRepo: ShipmentRepository = {
        findById: vi.fn(async (id: string) => repoRecords.get(id) ?? null),
        create: vi.fn(async (newShipment, opId) => {
          recordedOpIds.push(opId!);
          const id = `shipment__${newShipment.ownerId}__${opId}`;
          const committed: Shipment = {
            ...newShipment,
            id,
            createdAt: clock.now(),
            updatedAt: clock.now(),
          };
          repoRecords.set(id, committed);
          return committed;
        }),
        listActive: vi.fn(async () => Array.from(repoRecords.values())),
        listByOwner: vi.fn(async (ownerId: string) => Array.from(repoRecords.values()).filter((s) => s.ownerId === ownerId)),
        watchByOwner: vi.fn(),
        watchActive: vi.fn(),
      };

      const service = new ShipmentService(mockRepo, mockEvents, clock, pendingStorage);

      // 1. ID created & 2. Request definitely fails without commit (e.g. permission-denied from Firestore rules)
      vi.mocked(mockRepo.create).mockImplementationOnce(async (_newShipment, opId) => {
        recordedOpIds.push(opId!);
        const permErr = new Error("Permission denied by security rules");
        (permErr as any).code = "permission-denied";
        throw permErr;
      });

      await expect(service.create({ ...baseInput })).rejects.toThrow("Permission denied");
      expect(repoRecords.size).toBe(0);

      // 3. Pending operation is cleared safely (not left to pollute future actions)
      const pendingAfterDefinitiveError = await pendingStorage.getPendingOperation("shipment", baseInput.ownerId);
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
