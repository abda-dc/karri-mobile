import { createHash, randomUUID } from "crypto";

export const DEVELOPMENT_PROJECT_ID = "karri-mobile-dev";
const SMOKE_PREFIX = "m32p3-smoke-";

export type SmokeLogger = Pick<Console, "log" | "error">;

export interface SmokeAuthClient {
  getUser(uid: string): Promise<{ uid: string } | null>;
  setCustomClaims(uid: string, claims: Record<string, unknown> | null): Promise<void>;
  revokeRefreshTokens(uid: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}

export interface SmokeFirestoreClient {
  setShipment(shipmentId: string, data: Record<string, unknown>): Promise<void>;
  getShipment(shipmentId: string): Promise<Record<string, unknown> | null>;
  getAdministrativeHold(holdId: string): Promise<Record<string, unknown> | null>;
  getShipmentSafetyReview(reviewId: string): Promise<Record<string, unknown> | null>;
  getAuditLog(auditId: string): Promise<Record<string, unknown> | null>;
  countAdministrativeHoldsByShipment(shipmentId: string): Promise<number>;
  countShipmentSafetyReviewsByShipment(shipmentId: string): Promise<number>;
  countAuditLogsByOperation(action: string, targetType: string, targetId: string, idempotencyKey: string): Promise<number>;
  deleteShipment(shipmentId: string): Promise<void>;
  deleteAdministrativeHold(holdId: string): Promise<void>;
  deleteShipmentSafetyReview(reviewId: string): Promise<void>;
  deleteAuditLog(auditId: string): Promise<void>;
}

export interface IdentityToolkitClient {
  signUpAnonymous(apiKey: string): Promise<ClientSession>;
  refreshIdToken(refreshToken: string, apiKey: string): Promise<ClientSession>;
}

export interface CallableClient {
  callPlaceAdministrativeHold(idToken: string, payload: PlaceHoldPayload): Promise<CallableResponse>;
  callReleaseAdministrativeHold(idToken: string, payload: ReleaseHoldPayload): Promise<CallableResponse>;
  callSubmitSafetyReview(idToken: string, payload: SubmitSafetyReviewPayload): Promise<CallableResponse>;
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

export interface ReleaseHoldPayload {
  holdId: string;
  reasonCode: "review_completed";
  note: string;
  idempotencyKey: string;
}

export interface SubmitSafetyReviewPayload {
  shipmentId: string;
  decision: "approved";
  reasonCode: "verified_safe";
  note: string;
  declarationVersionReviewed: "v1";
  packageContentVersionReviewed: 1;
  idempotencyKey: string;
}

export interface CallableSuccess {
  success: boolean;
  holdId?: string;
  reviewId?: string;
  alreadyExisted: boolean;
}

export type CallableResponse =
  | { ok: true; result: CallableSuccess }
  | { ok: false; status: string; message?: string };

export interface SmokeRunResult {
  runId: string;
  releaseShipmentId: string;
  releaseHoldId: string;
  releaseAuditId: string;
  safetyShipmentId: string;
  safetyReviewId: string;
  safetyReviewAuditId: string;
  cleanup: CleanupStatus[];
}

export interface ClientSession {
  uid: string;
  idToken: string;
  refreshToken: string;
}

export interface CleanupStatus {
  resource: string;
  status: "deleted" | "skipped" | "failed";
  message?: string;
}

interface CreatedResources {
  userUid?: string;
  operationsAdminUid?: string;
  safetyAdminUid?: string;
  releaseShipmentId?: string;
  releaseShipmentNote?: string;
  placeIdempotencyKey?: string;
  releaseIdempotencyKey?: string;
  releaseHoldId?: string;
  placeAuditId?: string;
  releaseAuditId?: string;
  safetyShipmentId?: string;
  safetyShipmentNote?: string;
  safetyReviewId?: string;
  safetyReviewAuditId?: string;
  safetyReviewIdempotencyKey?: string;
}

interface PrivilegedSession {
  uid: string;
  idToken: string;
  refreshToken: string;
}

interface AuditCleanupSpec {
  id: string | undefined;
  label: string;
  action: string;
  targetType: string;
  targetId: string | undefined;
  idempotencyKey: string | undefined;
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

export function parseAnonymousSignUpResponse(body: unknown): ClientSession {
  if (!body || typeof body !== "object") {
    throw new Error("Identity Toolkit anonymous sign-up failed: malformed response.");
  }
  const response = body as Record<string, unknown>;
  if (typeof response.localId !== "string" || response.localId.length === 0) {
    throw new Error("Identity Toolkit anonymous sign-up failed: malformed response.");
  }
  if (typeof response.idToken !== "string" || response.idToken.length === 0) {
    throw new Error("Identity Toolkit anonymous sign-up failed: malformed response.");
  }
  if (typeof response.refreshToken !== "string" || response.refreshToken.length === 0) {
    throw new Error("Identity Toolkit anonymous sign-up failed: malformed response.");
  }
  return {
    uid: response.localId,
    idToken: response.idToken,
    refreshToken: response.refreshToken,
  };
}

export function parseRefreshTokenResponse(body: unknown): ClientSession {
  if (!body || typeof body !== "object") {
    throw new Error("Secure Token refresh failed: malformed response.");
  }
  const response = body as Record<string, unknown>;
  if (typeof response.user_id !== "string" || response.user_id.length === 0) {
    throw new Error("Secure Token refresh failed: malformed response.");
  }
  if (typeof response.id_token !== "string" || response.id_token.length === 0) {
    throw new Error("Secure Token refresh failed: malformed response.");
  }
  if (typeof response.refresh_token !== "string" || response.refresh_token.length === 0) {
    throw new Error("Secure Token refresh failed: malformed response.");
  }
  return {
    uid: response.user_id,
    idToken: response.id_token,
    refreshToken: response.refresh_token,
  };
}

export function createSmokeId(idFactory: () => string = randomUUID): string {
  return `${SMOKE_PREFIX}${idFactory().replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

export function isCurrentRunSmokeId(value: string | undefined, createdIds: ReadonlySet<string>): value is string {
  return typeof value === "string" && createdIds.has(value);
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

  const releaseShipmentId = `${runId}-release-shipment`;
  const safetyShipmentId = `${runId}-safety-shipment`;
  const releaseShipmentNote = `${runId} release callable smoke`;
  const safetyShipmentNote = `${runId} safety callable smoke`;
  const placeIdempotencyKey = `${runId}-place-hold`;
  const releaseIdempotencyKey = `${runId}-release-hold`;
  const safetyReviewIdempotencyKey = `${runId}-safety-review`;
  const placePayload: PlaceHoldPayload = {
    shipmentId: releaseShipmentId,
    reasonCode: "suspected_policy_violation",
    note: releaseShipmentNote,
    idempotencyKey: placeIdempotencyKey,
  };
  const safetyPayload: SubmitSafetyReviewPayload = {
    shipmentId: safetyShipmentId,
    decision: "approved",
    reasonCode: "verified_safe",
    note: safetyShipmentNote,
    declarationVersionReviewed: "v1",
    packageContentVersionReviewed: 1,
    idempotencyKey: safetyReviewIdempotencyKey,
  };

  [releaseShipmentId, safetyShipmentId].forEach((id) => createdIds.add(id));
  let primaryError: unknown;
  let result: SmokeRunResult | undefined;

  try {
    logger.log(`Starting development callable operational smoke run ${runId}.`);

    const userSession = await dependencies.identityToolkit.signUpAnonymous(apiKey);
    resources.userUid = userSession.uid;
    secretsSeen.push(userSession.idToken, userSession.refreshToken);

    const operationsSession = await createPrivilegedSession(
      "operations_admin",
      apiKey,
      dependencies,
      secretsSeen,
      (uid) => {
        resources.operationsAdminUid = uid;
      }
    );

    const safetySession = await createPrivilegedSession(
      "safety_admin",
      apiKey,
      dependencies,
      secretsSeen,
      (uid) => {
        resources.safetyAdminUid = uid;
      }
    );

    await dependencies.firestore.setShipment(releaseShipmentId, createShipmentFixture(operationsSession.uid));
    resources.releaseShipmentId = releaseShipmentId;
    resources.releaseShipmentNote = releaseShipmentNote;
    resources.placeIdempotencyKey = placeIdempotencyKey;
    resources.releaseIdempotencyKey = releaseIdempotencyKey;
    logger.log("Seeded release smoke shipment.");

    const placeFirst = await dependencies.callable.callPlaceAdministrativeHold(operationsSession.idToken, placePayload);
    assertCallableSuccess(placeFirst, "release prerequisite administrative hold call");
    if (!placeFirst.result.success || placeFirst.result.alreadyExisted !== false || !placeFirst.result.holdId) {
      throw new Error("Expected release prerequisite hold call to create a new hold.");
    }
    const holdId = placeFirst.result.holdId;
    const placeAuditId = deriveOperationId(operationsSession.uid, "hold.place", "shipment", releaseShipmentId, placeIdempotencyKey);
    resources.releaseHoldId = holdId;
    resources.placeAuditId = placeAuditId;
    createdIds.add(holdId);
    createdIds.add(placeAuditId);

    await verifyPlacedHold(dependencies.firestore, holdId, {
      shipmentId: releaseShipmentId,
      note: releaseShipmentNote,
      idempotencyKey: placeIdempotencyKey,
      adminUid: operationsSession.uid,
    });
    await verifyAudit(dependencies.firestore, placeAuditId, {
      action: "hold.place",
      actorUid: operationsSession.uid,
      actorRole: "operations_admin",
      targetType: "shipment",
      targetId: releaseShipmentId,
      reasonCode: "suspected_policy_violation",
      idempotencyKey: placeIdempotencyKey,
    });

    const releasePayload: ReleaseHoldPayload = {
      holdId,
      reasonCode: "review_completed",
      note: `${runId} release approved`,
      idempotencyKey: releaseIdempotencyKey,
    };

    const deniedRelease = await dependencies.callable.callReleaseAdministrativeHold(userSession.idToken, releasePayload);
    assertPermissionDenied(deniedRelease, "releaseAdministrativeHold non-admin request");
    logger.log("Verified non-admin authenticated user is denied for releaseAdministrativeHold.");

    const releaseFirst = await dependencies.callable.callReleaseAdministrativeHold(operationsSession.idToken, releasePayload);
    assertCallableSuccess(releaseFirst, "first administrative hold release call");
    if (!releaseFirst.result.success || releaseFirst.result.alreadyExisted !== false || releaseFirst.result.holdId !== holdId) {
      throw new Error("Expected first administrative hold release call to release the existing hold.");
    }
    const releaseAuditId = deriveOperationId(operationsSession.uid, "hold.release", "hold", holdId, releaseIdempotencyKey);
    resources.releaseAuditId = releaseAuditId;
    createdIds.add(releaseAuditId);

    await verifyReleasedHold(dependencies.firestore, holdId, {
      shipmentId: releaseShipmentId,
      note: releaseShipmentNote,
      idempotencyKey: placeIdempotencyKey,
      adminUid: operationsSession.uid,
    });
    await verifyAudit(dependencies.firestore, releaseAuditId, {
      action: "hold.release",
      actorUid: operationsSession.uid,
      actorRole: "operations_admin",
      targetType: "hold",
      targetId: holdId,
      reasonCode: "review_completed",
      idempotencyKey: releaseIdempotencyKey,
    });
    logger.log("Verified releaseAdministrativeHold state transition and audit log.");

    const releaseSecond = await dependencies.callable.callReleaseAdministrativeHold(operationsSession.idToken, releasePayload);
    assertCallableSuccess(releaseSecond, "idempotent administrative hold release retry");
    if (releaseSecond.result.holdId !== holdId || releaseSecond.result.alreadyExisted !== true) {
      throw new Error("Expected idempotent release retry to return the same holdId with alreadyExisted true.");
    }
    const releaseAuditCount = await dependencies.firestore.countAuditLogsByOperation(
      "hold.release",
      "hold",
      holdId,
      releaseIdempotencyKey
    );
    if (releaseAuditCount !== 1) {
      throw new Error(`Expected exactly one hold.release audit log, found ${releaseAuditCount}.`);
    }
    logger.log("Verified releaseAdministrativeHold retry did not create duplicate audit logs.");

    await dependencies.firestore.setShipment(safetyShipmentId, createShipmentFixture(safetySession.uid));
    resources.safetyShipmentId = safetyShipmentId;
    resources.safetyShipmentNote = safetyShipmentNote;
    resources.safetyReviewIdempotencyKey = safetyReviewIdempotencyKey;
    logger.log("Seeded safety-review smoke shipment.");

    const deniedSafety = await dependencies.callable.callSubmitSafetyReview(userSession.idToken, safetyPayload);
    assertPermissionDenied(deniedSafety, "submitSafetyReview non-admin request");
    logger.log("Verified non-admin authenticated user is denied for submitSafetyReview.");

    const safetyFirst = await dependencies.callable.callSubmitSafetyReview(safetySession.idToken, safetyPayload);
    assertCallableSuccess(safetyFirst, "first safety review call");
    if (!safetyFirst.result.success || safetyFirst.result.alreadyExisted !== false || !safetyFirst.result.reviewId) {
      throw new Error("Expected first safety review call to create a new review.");
    }
    const reviewId = safetyFirst.result.reviewId;
    const safetyReviewAuditId = deriveOperationId(
      safetySession.uid,
      "safety_review.submit",
      "shipment",
      safetyShipmentId,
      safetyReviewIdempotencyKey
    );
    resources.safetyReviewId = reviewId;
    resources.safetyReviewAuditId = safetyReviewAuditId;
    createdIds.add(reviewId);
    createdIds.add(safetyReviewAuditId);

    await verifySafetyReview(dependencies.firestore, reviewId, {
      shipmentId: safetyShipmentId,
      note: safetyShipmentNote,
      idempotencyKey: safetyReviewIdempotencyKey,
      adminUid: safetySession.uid,
    });
    await verifyAudit(dependencies.firestore, safetyReviewAuditId, {
      action: "safety_review.submit",
      actorUid: safetySession.uid,
      actorRole: "safety_admin",
      targetType: "shipment",
      targetId: safetyShipmentId,
      reasonCode: "verified_safe",
      idempotencyKey: safetyReviewIdempotencyKey,
    });
    await verifyShipmentSafetyDeclarationUnchanged(dependencies.firestore, safetyShipmentId, safetySession.uid);
    logger.log("Verified submitSafetyReview document, audit log, and immutable shipment declaration.");

    const safetySecond = await dependencies.callable.callSubmitSafetyReview(safetySession.idToken, safetyPayload);
    assertCallableSuccess(safetySecond, "idempotent safety review retry");
    if (safetySecond.result.reviewId !== reviewId || safetySecond.result.alreadyExisted !== true) {
      throw new Error("Expected idempotent safety review retry to return the same reviewId with alreadyExisted true.");
    }
    const reviewCount = await dependencies.firestore.countShipmentSafetyReviewsByShipment(safetyShipmentId);
    const safetyAuditCount = await dependencies.firestore.countAuditLogsByOperation(
      "safety_review.submit",
      "shipment",
      safetyShipmentId,
      safetyReviewIdempotencyKey
    );
    if (reviewCount !== 1 || safetyAuditCount !== 1) {
      throw new Error(`Expected exactly one safety review and one audit log, found ${reviewCount} reviews and ${safetyAuditCount} audit logs.`);
    }
    logger.log("Verified submitSafetyReview retry did not create duplicate documents.");

    const holdCount = await dependencies.firestore.countAdministrativeHoldsByShipment(releaseShipmentId);
    const placeAuditCount = await dependencies.firestore.countAuditLogsByOperation(
      "hold.place",
      "shipment",
      releaseShipmentId,
      placeIdempotencyKey
    );
    if (holdCount !== 1 || placeAuditCount !== 1) {
      throw new Error(`Expected exactly one hold and one hold.place audit log, found ${holdCount} holds and ${placeAuditCount} audit logs.`);
    }

    result = {
      runId,
      releaseShipmentId,
      releaseHoldId: holdId,
      releaseAuditId,
      safetyShipmentId,
      safetyReviewId: reviewId,
      safetyReviewAuditId,
      cleanup,
    };
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

async function createPrivilegedSession(
  role: "operations_admin" | "safety_admin",
  apiKey: string,
  dependencies: SmokeDependencies,
  secretsSeen: string[],
  onUserCreated: (uid: string) => void
): Promise<PrivilegedSession> {
  const session = await dependencies.identityToolkit.signUpAnonymous(apiKey);
  onUserCreated(session.uid);
  secretsSeen.push(session.idToken, session.refreshToken);
  await dependencies.auth.setCustomClaims(session.uid, { role });
  const refreshed = await dependencies.identityToolkit.refreshIdToken(session.refreshToken, apiKey);
  if (refreshed.uid !== session.uid) {
    throw new Error("Secure Token refresh returned a different Auth user.");
  }
  secretsSeen.push(refreshed.idToken, refreshed.refreshToken);
  return {
    uid: session.uid,
    idToken: refreshed.idToken,
    refreshToken: refreshed.refreshToken,
  };
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

function assertPermissionDenied(response: CallableResponse, label: string): void {
  if (response.ok || response.status !== "PERMISSION_DENIED") {
    throw new Error(`Expected PERMISSION_DENIED for ${label}, received ${response.ok ? "success" : response.status}.`);
  }
}

async function verifyPlacedHold(
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

async function verifyReleasedHold(
  firestore: SmokeFirestoreClient,
  holdId: string,
  expected: { shipmentId: string; note: string; idempotencyKey: string; adminUid: string }
): Promise<void> {
  const hold = await firestore.getAdministrativeHold(holdId);
  if (!hold) {
    throw new Error("Expected released administrative hold document to exist.");
  }
  const expectedFields: Record<string, unknown> = {
    shipmentId: expected.shipmentId,
    status: "released",
    reasonCode: "suspected_policy_violation",
    note: expected.note,
    placedByUid: expected.adminUid,
    placedByRole: "operations_admin",
    releasedByUid: expected.adminUid,
    releasedByRole: "operations_admin",
    idempotencyKey: expected.idempotencyKey,
  };
  assertObjectContains(hold, expectedFields, "released administrative hold");
}

async function verifySafetyReview(
  firestore: SmokeFirestoreClient,
  reviewId: string,
  expected: { shipmentId: string; note: string; idempotencyKey: string; adminUid: string }
): Promise<void> {
  const review = await firestore.getShipmentSafetyReview(reviewId);
  if (!review) {
    throw new Error("Expected shipment safety review document to exist.");
  }
  const expectedFields: Record<string, unknown> = {
    shipmentId: expected.shipmentId,
    actorUid: expected.adminUid,
    reviewerRole: "safety_admin",
    decision: "approved",
    reasonCode: "verified_safe",
    note: expected.note,
    declarationVersionReviewed: "v1",
    packageContentVersionReviewed: 1,
    idempotencyKey: expected.idempotencyKey,
  };
  assertObjectContains(review, expectedFields, "shipment safety review");
}

async function verifyShipmentSafetyDeclarationUnchanged(
  firestore: SmokeFirestoreClient,
  shipmentId: string,
  ownerId: string
): Promise<void> {
  const shipment = await firestore.getShipment(shipmentId);
  if (!shipment) {
    throw new Error("Expected smoke shipment to exist.");
  }
  const declaration = shipment.safetyDeclaration as Record<string, unknown> | undefined;
  if (!declaration) {
    throw new Error("Expected smoke shipment safety declaration to exist.");
  }
  assertObjectContains(declaration, {
    policyVersion: "2026-07-v1",
    declarationVersion: "v1",
    acceptedByUserId: ownerId,
    packageContentVersion: 1,
  }, "shipment safety declaration");
}

async function verifyAudit(
  firestore: SmokeFirestoreClient,
  auditId: string,
  expected: {
    action: string;
    actorUid: string;
    actorRole: string;
    targetType: string;
    targetId: string;
    reasonCode: string;
    idempotencyKey: string;
  }
): Promise<void> {
  const audit = await firestore.getAuditLog(auditId);
  if (!audit) {
    throw new Error(`Expected ${expected.action} audit log document to exist.`);
  }
  assertObjectContains(audit, expected, `${expected.action} audit log`);
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

  await cleanupAuditLog(results, dependencies, createdIds, {
    id: resources.safetyReviewAuditId,
    label: "safety review audit log",
    action: "safety_review.submit",
    targetType: "shipment",
    targetId: resources.safetyShipmentId,
    idempotencyKey: resources.safetyReviewIdempotencyKey,
  });
  await cleanupShipmentSafetyReview(results, resources, createdIds, dependencies);
  await cleanupAuditLog(results, dependencies, createdIds, {
    id: resources.releaseAuditId,
    label: "release audit log",
    action: "hold.release",
    targetType: "hold",
    targetId: resources.releaseHoldId,
    idempotencyKey: resources.releaseIdempotencyKey,
  });
  await cleanupAuditLog(results, dependencies, createdIds, {
    id: resources.placeAuditId,
    label: "placement audit log",
    action: "hold.place",
    targetType: "shipment",
    targetId: resources.releaseShipmentId,
    idempotencyKey: resources.placeIdempotencyKey,
  });
  await cleanupAdministrativeHold(results, resources, createdIds, dependencies);
  await cleanupDoc(
    results,
    "safety shipment",
    resources.safetyShipmentId,
    createdIds,
    dependencies.firestore.deleteShipment.bind(dependencies.firestore),
    dependencies.firestore.getShipment.bind(dependencies.firestore)
  );
  await cleanupDoc(
    results,
    "release shipment",
    resources.releaseShipmentId,
    createdIds,
    dependencies.firestore.deleteShipment.bind(dependencies.firestore),
    dependencies.firestore.getShipment.bind(dependencies.firestore)
  );
  await cleanupUser(results, "safety admin user", resources.safetyAdminUid, dependencies);
  await cleanupUser(results, "operations admin user", resources.operationsAdminUid, dependencies);
  await cleanupUser(results, "non-admin user", resources.userUid, dependencies);

  return results;
}

async function cleanupAuditLog(
  results: CleanupStatus[],
  dependencies: SmokeDependencies,
  createdIds: ReadonlySet<string>,
  spec: AuditCleanupSpec
): Promise<void> {
  const id = spec.id;
  if (!isCurrentRunSmokeId(id, createdIds) || !spec.targetId || !spec.idempotencyKey) {
    results.push({ resource: spec.label, status: "skipped", message: "not created in current run" });
    return;
  }
  try {
    const audit = await dependencies.firestore.getAuditLog(id);
    if (!audit) {
      results.push({ resource: `${spec.label} ${id}`, status: "skipped", message: "already absent" });
      return;
    }
    if (
      audit.action !== spec.action ||
      audit.targetType !== spec.targetType ||
      audit.targetId !== spec.targetId ||
      audit.idempotencyKey !== spec.idempotencyKey ||
      (!spec.targetId.startsWith(SMOKE_PREFIX) && !createdIds.has(spec.targetId)) ||
      !spec.idempotencyKey.startsWith(SMOKE_PREFIX)
    ) {
      results.push({ resource: `${spec.label} ${id}`, status: "failed", message: "document did not match current smoke run" });
      return;
    }
    await dependencies.firestore.deleteAuditLog(id);
    const afterDelete = await dependencies.firestore.getAuditLog(id);
    if (afterDelete) {
      results.push({ resource: `${spec.label} ${id}`, status: "failed", message: "document still exists after delete" });
      return;
    }
    results.push({ resource: `${spec.label} ${id}`, status: "deleted" });
  } catch (error: any) {
    results.push({ resource: `${spec.label} ${id}`, status: "failed", message: sanitizeErrorMessage(error) });
  }
}

async function cleanupShipmentSafetyReview(
  results: CleanupStatus[],
  resources: CreatedResources,
  createdIds: ReadonlySet<string>,
  dependencies: SmokeDependencies
): Promise<void> {
  const id = resources.safetyReviewId;
  if (!isCurrentRunSmokeId(id, createdIds) || !resources.safetyShipmentId || !resources.safetyReviewIdempotencyKey) {
    results.push({ resource: "shipment safety review", status: "skipped", message: "not created in current run" });
    return;
  }
  try {
    const review = await dependencies.firestore.getShipmentSafetyReview(id);
    if (!review) {
      results.push({ resource: `shipment safety review ${id}`, status: "skipped", message: "already absent" });
      return;
    }
    if (
      review.shipmentId !== resources.safetyShipmentId ||
      review.idempotencyKey !== resources.safetyReviewIdempotencyKey ||
      !resources.safetyShipmentId.startsWith(SMOKE_PREFIX) ||
      !resources.safetyReviewIdempotencyKey.startsWith(SMOKE_PREFIX)
    ) {
      results.push({ resource: `shipment safety review ${id}`, status: "failed", message: "document did not match current smoke run" });
      return;
    }
    await dependencies.firestore.deleteShipmentSafetyReview(id);
    const afterDelete = await dependencies.firestore.getShipmentSafetyReview(id);
    if (afterDelete) {
      results.push({ resource: `shipment safety review ${id}`, status: "failed", message: "document still exists after delete" });
      return;
    }
    results.push({ resource: `shipment safety review ${id}`, status: "deleted" });
  } catch (error: any) {
    results.push({ resource: `shipment safety review ${id}`, status: "failed", message: sanitizeErrorMessage(error) });
  }
}

async function cleanupAdministrativeHold(
  results: CleanupStatus[],
  resources: CreatedResources,
  createdIds: ReadonlySet<string>,
  dependencies: SmokeDependencies
): Promise<void> {
  const id = resources.releaseHoldId;
  if (!isCurrentRunSmokeId(id, createdIds) || !resources.releaseShipmentId || !resources.placeIdempotencyKey || !resources.releaseShipmentNote) {
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
      hold.shipmentId !== resources.releaseShipmentId ||
      hold.idempotencyKey !== resources.placeIdempotencyKey ||
      hold.note !== resources.releaseShipmentNote ||
      !resources.releaseShipmentId.startsWith(SMOKE_PREFIX) ||
      !resources.placeIdempotencyKey.startsWith(SMOKE_PREFIX) ||
      !resources.releaseShipmentNote.startsWith(SMOKE_PREFIX)
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
  dependencies: SmokeDependencies
): Promise<void> {
  if (!uid) {
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
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/key=([A-Za-z0-9._-]+)/g, "key=[REDACTED]")
    .replace(/(idToken|refreshToken|refresh_token|id_token|authorization|apiKey|key)["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+/gi, "$1=[REDACTED]");
}
