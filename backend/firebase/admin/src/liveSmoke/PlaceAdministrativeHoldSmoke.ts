import { createHash, randomUUID } from "crypto";

export const DEVELOPMENT_PROJECT_ID = "karri-mobile-dev";
const SMOKE_PREFIX = "m32p3-smoke-";

export type SmokeLogger = Pick<Console, "log" | "error">;

export interface SmokeAuthClient {
  createUser(uid: string): Promise<void>;
  getUser(uid: string): Promise<{ uid: string } | null>;
  setCustomClaims(uid: string, claims: Record<string, unknown> | null): Promise<void>;
  revokeRefreshTokens(uid: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
  createCustomToken(uid: string): Promise<string>;
}

export interface SmokeFirestoreClient {
  setShipment(shipmentId: string, data: Record<string, unknown>): Promise<void>;
  getShipment(shipmentId: string): Promise<Record<string, unknown> | null>;
  getAdministrativeHold(holdId: string): Promise<Record<string, unknown> | null>;
  getAuditLog(auditId: string): Promise<Record<string, unknown> | null>;
  countAdministrativeHoldsByShipment(shipmentId: string): Promise<number>;
  countAuditLogsByOperation(action: string, targetType: string, targetId: string, idempotencyKey: string): Promise<number>;
  deleteShipment(shipmentId: string): Promise<void>;
  deleteAdministrativeHold(holdId: string): Promise<void>;
  deleteAuditLog(auditId: string): Promise<void>;
}

export interface IdentityToolkitClient {
  exchangeCustomToken(customToken: string, apiKey: string): Promise<string>;
}

export interface CallableClient {
  callPlaceAdministrativeHold(idToken: string, payload: PlaceHoldPayload): Promise<CallableResponse>;
}

export interface SmokeDependencies {
  auth: SmokeAuthClient;
  firestore: SmokeFirestoreClient;
  identityToolkit: IdentityToolkitClient;
  callable: CallableClient;
  logger?: SmokeLogger;
  idFactory?: () => string;
}

export interface SmokeEnvironment {
  FIREBASE_PROJECT_ID?: string;
  KARRI_ALLOW_LIVE_SMOKE?: string;
  FIREBASE_WEB_API_KEY?: string;
}

export interface PlaceHoldPayload {
  shipmentId: string;
  reasonCode: "suspected_policy_violation";
  note: string;
  idempotencyKey: string;
}

export interface CallableSuccess {
  success: boolean;
  holdId: string;
  alreadyExisted: boolean;
}

export type CallableResponse =
  | { ok: true; result: CallableSuccess }
  | { ok: false; status: string; message?: string };

export interface SmokeRunResult {
  runId: string;
  shipmentId: string;
  holdId: string;
  auditId: string;
  cleanup: CleanupStatus[];
}

export interface CleanupStatus {
  resource: string;
  status: "deleted" | "skipped" | "failed";
  message?: string;
}

interface CreatedResources {
  userUid?: string;
  adminUid?: string;
  shipmentId?: string;
  note?: string;
  idempotencyKey?: string;
  holdId?: string;
  auditId?: string;
}

export class SmokeTestAndCleanupError extends Error {
  constructor(
    public readonly primaryError: unknown,
    public readonly cleanupError: unknown
  ) {
    super(
      `Live smoke failed and cleanup also failed. Primary smoke failure: ${errorMessage(primaryError)} Cleanup failure: ${errorMessage(cleanupError)}`
    );
    this.name = "SmokeTestAndCleanupError";
  }
}

export function assertLiveSmokeEnvironment(env: SmokeEnvironment): string {
  if (env.FIREBASE_PROJECT_ID !== DEVELOPMENT_PROJECT_ID) {
    throw new Error(`Refusing live smoke: FIREBASE_PROJECT_ID must be exactly '${DEVELOPMENT_PROJECT_ID}'.`);
  }
  if (env.KARRI_ALLOW_LIVE_SMOKE !== DEVELOPMENT_PROJECT_ID) {
    throw new Error(`Refusing live smoke: KARRI_ALLOW_LIVE_SMOKE must be exactly '${DEVELOPMENT_PROJECT_ID}'.`);
  }
  if (!env.FIREBASE_WEB_API_KEY || env.FIREBASE_WEB_API_KEY.trim().length === 0) {
    throw new Error("Refusing live smoke: FIREBASE_WEB_API_KEY must be supplied through the local environment.");
  }
  return env.FIREBASE_WEB_API_KEY;
}

export function assertNoSecretLeak(loggedText: string, secrets: ReadonlyArray<string>): void {
  for (const secret of secrets) {
    if (secret && loggedText.includes(secret)) {
      throw new Error("Secret value was written to output.");
    }
  }
}

export function createSmokeId(idFactory: () => string = randomUUID): string {
  return `${SMOKE_PREFIX}${idFactory().replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

export function isCurrentRunSmokeId(value: string | undefined, createdIds: ReadonlySet<string>): value is string {
  return typeof value === "string" && value.startsWith(SMOKE_PREFIX) && createdIds.has(value);
}

export async function runPlaceAdministrativeHoldSmoke(
  env: SmokeEnvironment,
  dependencies: SmokeDependencies
): Promise<SmokeRunResult> {
  const apiKey = assertLiveSmokeEnvironment(env);
  const logger = dependencies.logger || console;
  const runId = createSmokeId(dependencies.idFactory);
  const resources: CreatedResources = {};
  const createdIds = new Set<string>();
  const cleanup: CleanupStatus[] = [];
  const secretsSeen: string[] = [apiKey];

  const userUid = `${runId}-user`;
  const adminUid = `${runId}-operations-admin`;
  const shipmentId = `${runId}-shipment`;
  const note = `${runId} authorized callable smoke`;
  const idempotencyKey = `${runId}-hold`;
  const payload: PlaceHoldPayload = {
    shipmentId,
    reasonCode: "suspected_policy_violation",
    note,
    idempotencyKey,
  };

  [userUid, adminUid, shipmentId].forEach((id) => createdIds.add(id));
  let primaryError: unknown;
  let result: SmokeRunResult | undefined;

  try {
    logger.log(`Starting development callable smoke run ${runId}.`);

    await dependencies.auth.createUser(userUid);
    resources.userUid = userUid;
    const userCustomToken = await dependencies.auth.createCustomToken(userUid);
    secretsSeen.push(userCustomToken);
    const userIdToken = await dependencies.identityToolkit.exchangeCustomToken(userCustomToken, apiKey);
    secretsSeen.push(userIdToken);

    const denied = await dependencies.callable.callPlaceAdministrativeHold(userIdToken, payload);
    if (denied.ok || denied.status !== "PERMISSION_DENIED") {
      throw new Error(`Expected PERMISSION_DENIED for non-admin user, received ${denied.ok ? "success" : denied.status}.`);
    }
    logger.log("Verified non-admin authenticated user is denied.");

    await dependencies.auth.createUser(adminUid);
    resources.adminUid = adminUid;
    await dependencies.auth.setCustomClaims(adminUid, { role: "operations_admin" });
    await dependencies.auth.revokeRefreshTokens(adminUid);
    const adminCustomToken = await dependencies.auth.createCustomToken(adminUid);
    secretsSeen.push(adminCustomToken);
    const adminIdToken = await dependencies.identityToolkit.exchangeCustomToken(adminCustomToken, apiKey);
    secretsSeen.push(adminIdToken);

    await dependencies.firestore.setShipment(shipmentId, createShipmentFixture(adminUid));
    resources.shipmentId = shipmentId;
    resources.note = note;
    resources.idempotencyKey = idempotencyKey;
    logger.log("Seeded one temporary smoke shipment.");

    const first = await dependencies.callable.callPlaceAdministrativeHold(adminIdToken, payload);
    assertCallableSuccess(first, "first administrative hold call");
    if (!first.result.success || first.result.alreadyExisted !== false) {
      throw new Error("Expected first administrative hold call to create a new hold.");
    }
    const holdId = first.result.holdId;
    const auditId = deriveOperationId(adminUid, "hold.place", "shipment", shipmentId, idempotencyKey);
    resources.holdId = holdId;
    resources.auditId = auditId;
    createdIds.add(holdId);
    createdIds.add(auditId);

    await verifyHold(dependencies.firestore, holdId, {
      shipmentId,
      note,
      idempotencyKey,
      adminUid,
    });
    await verifyAudit(dependencies.firestore, auditId, {
      shipmentId,
      idempotencyKey,
      adminUid,
    });
    logger.log("Verified administrative hold and audit log documents.");

    const second = await dependencies.callable.callPlaceAdministrativeHold(adminIdToken, payload);
    assertCallableSuccess(second, "idempotent administrative hold retry");
    if (second.result.holdId !== holdId || second.result.alreadyExisted !== true) {
      throw new Error("Expected idempotent retry to return the same holdId with alreadyExisted true.");
    }

    const holdCount = await dependencies.firestore.countAdministrativeHoldsByShipment(shipmentId);
    const auditCount = await dependencies.firestore.countAuditLogsByOperation(
      "hold.place",
      "shipment",
      shipmentId,
      idempotencyKey
    );
    if (holdCount !== 1 || auditCount !== 1) {
      throw new Error(`Expected exactly one hold and one audit log, found ${holdCount} holds and ${auditCount} audit logs.`);
    }
    logger.log("Verified idempotent retry did not create duplicate documents.");

    result = { runId, shipmentId, holdId, auditId, cleanup };
  } catch (error) {
    primaryError = error;
  }

  const cleanupResults = await cleanupCreatedResources(dependencies, resources, createdIds);
  cleanup.push(...cleanupResults);
  for (const item of cleanupResults) {
    logger.log(`Cleanup ${item.status}: ${item.resource}${item.message ? ` (${item.message})` : ""}`);
  }
  const failed = cleanupResults.filter((item) => item.status === "failed");
  const cleanupError = failed.length > 0
    ? new Error(`Live smoke cleanup failed for ${failed.length} resource(s).`)
    : undefined;
  assertNoSecretLeak("", secretsSeen);

  if (primaryError && cleanupError) {
    throw new SmokeTestAndCleanupError(primaryError, cleanupError);
  }
  if (primaryError) {
    throw primaryError;
  }
  if (cleanupError) {
    throw cleanupError;
  }
  if (!result) {
    throw new Error("Live smoke completed without a result.");
  }
  return result;
}

export function createShipmentFixture(ownerId: string): Record<string, unknown> {
  const now = new Date();
  return {
    ownerId,
    originCountry: "Ethiopia",
    originCity: "Addis Ababa",
    destinationCountry: "United States",
    destinationCity: "Washington",
    packageCategory: "documents",
    packageDescription: "sealed smoke-test documents",
    weightKg: 0.5,
    deliveryWindow: "2026-02-01 to 2026-02-10",
    rewardAmount: 50,
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
      acceptedAt: now,
      acceptedByUserId: ownerId,
      packageContentVersion: 1,
      acknowledgements: {
        contentsAccurate: true,
        noProhibitedItems: true,
        inspectionPermitted: true,
        customsResponsibilityAccepted: true,
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveOperationId(
  actorUid: string,
  action: string,
  targetType: string,
  targetId: string,
  idempotencyKey: string
): string {
  const obj = {
    action,
    actorUid,
    idempotencyKey,
    targetId,
    targetType,
  };
  return createHash("sha256").update(canonicalStringify(obj)).digest("hex");
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalStringify((obj as Record<string, unknown>)[key])}`);
  return "{" + pairs.join(",") + "}";
}

function assertCallableSuccess(response: CallableResponse, label: string): asserts response is { ok: true; result: CallableSuccess } {
  if (!response.ok) {
    throw new Error(`Expected ${label} to succeed, received ${response.status}.`);
  }
}

async function verifyHold(
  firestore: SmokeFirestoreClient,
  holdId: string,
  expected: { shipmentId: string; note: string; idempotencyKey: string; adminUid: string }
): Promise<void> {
  const hold = await firestore.getAdministrativeHold(holdId);
  if (!hold) {
    throw new Error("Expected administrative hold document to exist.");
  }
  const expectedFields: Record<string, unknown> = {
    shipmentId: expected.shipmentId,
    status: "active",
    reasonCode: "suspected_policy_violation",
    note: expected.note,
    placedByUid: expected.adminUid,
    placedByRole: "operations_admin",
    releasedByUid: null,
    idempotencyKey: expected.idempotencyKey,
  };
  assertObjectContains(hold, expectedFields, "administrative hold");
}

async function verifyAudit(
  firestore: SmokeFirestoreClient,
  auditId: string,
  expected: { shipmentId: string; idempotencyKey: string; adminUid: string }
): Promise<void> {
  const audit = await firestore.getAuditLog(auditId);
  if (!audit) {
    throw new Error("Expected hold.place audit log document to exist.");
  }
  const expectedFields: Record<string, unknown> = {
    action: "hold.place",
    actorUid: expected.adminUid,
    actorRole: "operations_admin",
    targetType: "shipment",
    targetId: expected.shipmentId,
    reasonCode: "suspected_policy_violation",
    idempotencyKey: expected.idempotencyKey,
  };
  assertObjectContains(audit, expectedFields, "audit log");
}

function assertObjectContains(actual: Record<string, unknown>, expected: Record<string, unknown>, label: string): void {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`Unexpected ${label} field '${key}'.`);
    }
  }
}

async function cleanupCreatedResources(
  dependencies: SmokeDependencies,
  resources: CreatedResources,
  createdIds: ReadonlySet<string>
): Promise<CleanupStatus[]> {
  const results: CleanupStatus[] = [];

  await cleanupAuditLog(results, resources, dependencies);
  await cleanupAdministrativeHold(results, resources, dependencies);
  await cleanupDoc(
    results,
    "shipment",
    resources.shipmentId,
    createdIds,
    dependencies.firestore.deleteShipment.bind(dependencies.firestore),
    dependencies.firestore.getShipment.bind(dependencies.firestore)
  );
  await cleanupUser(results, "operations admin user", resources.adminUid, createdIds, dependencies);
  await cleanupUser(results, "non-admin user", resources.userUid, createdIds, dependencies);

  return results;
}

async function cleanupAuditLog(
  results: CleanupStatus[],
  resources: CreatedResources,
  dependencies: SmokeDependencies
): Promise<void> {
  const id = resources.auditId;
  if (!id || !resources.shipmentId || !resources.idempotencyKey) {
    results.push({ resource: "audit log", status: "skipped", message: "not created in current run" });
    return;
  }
  try {
    const audit = await dependencies.firestore.getAuditLog(id);
    if (!audit) {
      results.push({ resource: `audit log ${id}`, status: "skipped", message: "already absent" });
      return;
    }
    if (
      audit.action !== "hold.place" ||
      audit.targetType !== "shipment" ||
      audit.targetId !== resources.shipmentId ||
      audit.idempotencyKey !== resources.idempotencyKey ||
      !resources.shipmentId.startsWith(SMOKE_PREFIX) ||
      !resources.idempotencyKey.startsWith(SMOKE_PREFIX)
    ) {
      results.push({ resource: `audit log ${id}`, status: "failed", message: "document did not match current smoke run" });
      return;
    }
    await dependencies.firestore.deleteAuditLog(id);
    const afterDelete = await dependencies.firestore.getAuditLog(id);
    if (afterDelete) {
      results.push({ resource: `audit log ${id}`, status: "failed", message: "document still exists after delete" });
      return;
    }
    results.push({ resource: `audit log ${id}`, status: "deleted" });
  } catch (error: any) {
    results.push({ resource: `audit log ${id}`, status: "failed", message: sanitizeErrorMessage(error) });
  }
}

async function cleanupAdministrativeHold(
  results: CleanupStatus[],
  resources: CreatedResources,
  dependencies: SmokeDependencies
): Promise<void> {
  const id = resources.holdId;
  if (!id || !resources.shipmentId || !resources.idempotencyKey || !resources.note) {
    results.push({ resource: "administrative hold", status: "skipped", message: "not created in current run" });
    return;
  }
  try {
    const hold = await dependencies.firestore.getAdministrativeHold(id);
    if (!hold) {
      results.push({ resource: `administrative hold ${id}`, status: "skipped", message: "already absent" });
      return;
    }
    if (
      hold.shipmentId !== resources.shipmentId ||
      hold.idempotencyKey !== resources.idempotencyKey ||
      hold.note !== resources.note ||
      !resources.shipmentId.startsWith(SMOKE_PREFIX) ||
      !resources.idempotencyKey.startsWith(SMOKE_PREFIX) ||
      !resources.note.startsWith(SMOKE_PREFIX)
    ) {
      results.push({ resource: `administrative hold ${id}`, status: "failed", message: "document did not match current smoke run" });
      return;
    }
    await dependencies.firestore.deleteAdministrativeHold(id);
    const afterDelete = await dependencies.firestore.getAdministrativeHold(id);
    if (afterDelete) {
      results.push({ resource: `administrative hold ${id}`, status: "failed", message: "document still exists after delete" });
      return;
    }
    results.push({ resource: `administrative hold ${id}`, status: "deleted" });
  } catch (error: any) {
    results.push({ resource: `administrative hold ${id}`, status: "failed", message: sanitizeErrorMessage(error) });
  }
}

async function cleanupDoc(
  results: CleanupStatus[],
  label: string,
  id: string | undefined,
  createdIds: ReadonlySet<string>,
  deleteFn: (id: string) => Promise<void>,
  getFn: (id: string) => Promise<Record<string, unknown> | null>
): Promise<void> {
  if (!isCurrentRunSmokeId(id, createdIds)) {
    results.push({ resource: label, status: "skipped", message: "not created in current run" });
    return;
  }
  try {
    await deleteFn(id);
    const afterDelete = await getFn(id);
    if (afterDelete) {
      results.push({ resource: `${label} ${id}`, status: "failed", message: "document still exists after delete" });
      return;
    }
    results.push({ resource: `${label} ${id}`, status: "deleted" });
  } catch (error: any) {
    results.push({ resource: `${label} ${id}`, status: "failed", message: sanitizeErrorMessage(error) });
  }
}

async function cleanupUser(
  results: CleanupStatus[],
  label: string,
  uid: string | undefined,
  createdIds: ReadonlySet<string>,
  dependencies: SmokeDependencies
): Promise<void> {
  if (!isCurrentRunSmokeId(uid, createdIds)) {
    results.push({ resource: label, status: "skipped", message: "not created in current run" });
    return;
  }
  try {
    await dependencies.auth.setCustomClaims(uid, null);
    await dependencies.auth.revokeRefreshTokens(uid);
    await dependencies.auth.deleteUser(uid);
    const afterDelete = await dependencies.auth.getUser(uid);
    if (afterDelete) {
      results.push({ resource: `${label} ${uid}`, status: "failed", message: "user still exists after delete" });
      return;
    }
    results.push({ resource: `${label} ${uid}`, status: "deleted" });
  } catch (error: any) {
    results.push({ resource: `${label} ${uid}`, status: "failed", message: sanitizeErrorMessage(error) });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeErrorMessage(error: any): string {
  const message = typeof error?.message === "string" ? error.message : String(error);
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
}
