import type {
  IdentityDocument,
  IdentityDocumentMetadataInput,
} from "../../domain/identity/IdentityDocument";
import { IdentityDocumentType } from "../../domain/identity/IdentityDocument";
import {
  getVerificationLevel,
  VerificationLevel,
  VerificationStatus,
  type IdentityVerification,
} from "../../domain/identity/IdentityVerification";
import type { VerificationRepository } from "../../domain/identity/VerificationRepository";
import {
  VerificationActorType,
  type VerificationEvent,
} from "../../domain/identity/VerificationEvent";
import {
  assertCanTransitionVerificationStatus,
  getAllowedVerificationTransitions,
} from "../../domain/identity/verificationStateMachine";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

const maximumDocuments = 10;
const maximumEvents = 12;
const isoCountryCodePattern = /^[A-Z]{2}$/;
const documentTypes = Object.values(IdentityDocumentType);

export interface IdentityVerificationStatusSummary {
  readonly status: VerificationStatus;
  readonly level: VerificationLevel;
  readonly documentCount: number;
  readonly allowedTransitions: ReadonlyArray<VerificationStatus>;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly expiresAt: string | null;
  readonly rejectionReason: string | null;
  readonly revokedReason: string | null;
}

export class IdentityVerificationService {
  constructor(
    private readonly verifications: VerificationRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async getCurrentVerification(userId: string): Promise<IdentityVerification | null> {
    const validUserId = this.requireUserId(userId);
    const current = await this.verifications.findByUserId(validUserId);
    if (
      current &&
      (current.id !== validUserId || current.userId !== validUserId)
    ) {
      throw new DomainValidationError(
        "Identity verification does not belong to the requested user.",
      );
    }
    return current;
  }

  async startDraft(userId: string): Promise<IdentityVerification> {
    const validUserId = this.requireUserId(userId);
    const current = await this.getCurrentVerification(validUserId);
    if (current?.status === VerificationStatus.Draft) {
      return current;
    }

    const occurredAt = this.clock.now();
    if (!current) {
      return this.verifications.save({
        id: validUserId,
        userId: validUserId,
        status: VerificationStatus.Draft,
        level: VerificationLevel.Basic,
        documents: [],
        events: [
          this.createEvent(
            validUserId,
            VerificationStatus.Unverified,
            VerificationStatus.Draft,
            VerificationActorType.User,
            validUserId,
            null,
            occurredAt,
          ),
        ],
        submittedAt: null,
        reviewedAt: null,
        expiresAt: null,
        rejectionReason: null,
        revokedReason: null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
    }

    return this.transition(
      current,
      VerificationStatus.Draft,
      VerificationActorType.User,
      validUserId,
      null,
      occurredAt,
      {
        submittedAt: null,
        reviewedAt: null,
        expiresAt: null,
        rejectionReason: null,
        revokedReason: null,
      },
    );
  }

  async updateDocumentMetadata(
    userId: string,
    input: IdentityDocumentMetadataInput,
  ): Promise<IdentityVerification> {
    const current = await this.requireCurrent(userId);
    if (current.status !== VerificationStatus.Draft) {
      throw new DomainValidationError(
        "Identity document metadata can only be changed while verification is a draft.",
      );
    }

    const document = this.validateDocument(input);
    const existingIndex = current.documents.findIndex(({ id }) => id === document.id);
    const documents: ReadonlyArray<IdentityDocument> =
      existingIndex < 0
        ? [...current.documents, document]
        : current.documents.map((entry, index) =>
            index === existingIndex ? document : entry,
          );

    if (documents.length > maximumDocuments) {
      throw new DomainValidationError(
        `Identity verification supports no more than ${maximumDocuments} documents.`,
      );
    }

    return this.verifications.save({
      ...current,
      documents,
      updatedAt: this.clock.now(),
    });
  }

  async submitVerification(userId: string): Promise<IdentityVerification> {
    const current = await this.requireCurrent(userId);
    if (current.documents.length === 0) {
      throw new DomainValidationError(
        "At least one identity document metadata record is required before submission.",
      );
    }

    const occurredAt = this.clock.now();
    return this.transition(
      current,
      VerificationStatus.Submitted,
      VerificationActorType.User,
      current.userId,
      null,
      occurredAt,
      { submittedAt: occurredAt },
    );
  }

  async moveToUnderReview(
    userId: string,
    reviewerId: string,
  ): Promise<IdentityVerification> {
    return this.reviewTransition(
      userId,
      reviewerId,
      VerificationStatus.UnderReview,
      null,
    );
  }

  async verify(
    userId: string,
    reviewerId: string,
    expiresAt: string | null = null,
  ): Promise<IdentityVerification> {
    const normalizedExpiresAt = expiresAt
      ? this.requireIsoTimestamp(expiresAt, "expiresAt")
      : null;
    return this.reviewTransition(
      userId,
      reviewerId,
      VerificationStatus.Verified,
      null,
      { expiresAt: normalizedExpiresAt, rejectionReason: null },
    );
  }

  async reject(
    userId: string,
    reviewerId: string,
    reason: string,
  ): Promise<IdentityVerification> {
    const validReason = requireText(reason, "rejectionReason", 500);
    return this.reviewTransition(
      userId,
      reviewerId,
      VerificationStatus.Rejected,
      validReason,
      { rejectionReason: validReason, expiresAt: null },
    );
  }

  async expire(userId: string, reason: string | null = null): Promise<IdentityVerification> {
    const current = await this.requireCurrent(userId);
    const occurredAt = this.clock.now();
    const validReason = reason ? requireText(reason, "expirationReason", 500) : null;
    return this.transition(
      current,
      VerificationStatus.Expired,
      VerificationActorType.System,
      null,
      validReason,
      occurredAt,
    );
  }

  async revoke(
    userId: string,
    reviewerId: string,
    reason: string,
  ): Promise<IdentityVerification> {
    const validReason = requireText(reason, "revokedReason", 500);
    return this.reviewTransition(
      userId,
      reviewerId,
      VerificationStatus.Revoked,
      validReason,
      { revokedReason: validReason },
    );
  }

  async getStatusSummary(userId: string): Promise<IdentityVerificationStatusSummary> {
    const current = await this.getCurrentVerification(userId);
    if (!current) {
      return {
        status: VerificationStatus.Unverified,
        level: VerificationLevel.None,
        documentCount: 0,
        allowedTransitions: getAllowedVerificationTransitions(
          VerificationStatus.Unverified,
        ),
        submittedAt: null,
        reviewedAt: null,
        expiresAt: null,
        rejectionReason: null,
        revokedReason: null,
      };
    }

    return {
      status: current.status,
      level: current.level,
      documentCount: current.documents.length,
      allowedTransitions: getAllowedVerificationTransitions(current.status),
      submittedAt: current.submittedAt,
      reviewedAt: current.reviewedAt,
      expiresAt: current.expiresAt,
      rejectionReason: current.rejectionReason,
      revokedReason: current.revokedReason,
    };
  }

  private async reviewTransition(
    userId: string,
    reviewerId: string,
    nextStatus: VerificationStatus,
    reason: string | null,
    changes: Partial<IdentityVerification> = {},
  ): Promise<IdentityVerification> {
    const current = await this.requireCurrent(userId);
    const validReviewerId = requireText(reviewerId, "reviewerId", 128);
    const occurredAt = this.clock.now();
    return this.transition(
      current,
      nextStatus,
      VerificationActorType.Reviewer,
      validReviewerId,
      reason,
      occurredAt,
      { ...changes, reviewedAt: occurredAt },
    );
  }

  private transition(
    current: IdentityVerification,
    nextStatus: VerificationStatus,
    actorType: VerificationActorType,
    actorId: string | null,
    reason: string | null,
    occurredAt: string,
    changes: Partial<IdentityVerification> = {},
  ): Promise<IdentityVerification> {
    assertCanTransitionVerificationStatus(current.status, nextStatus);
    if (current.events.length >= maximumEvents) {
      throw new DomainValidationError(
        "Identity verification audit history has reached its current safe limit.",
      );
    }

    return this.verifications.save({
      ...current,
      ...changes,
      status: nextStatus,
      level: getVerificationLevel(nextStatus),
      events: [
        ...current.events,
        this.createEvent(
          current.id,
          current.status,
          nextStatus,
          actorType,
          actorId,
          reason,
          occurredAt,
        ),
      ],
      updatedAt: occurredAt,
    });
  }

  private createEvent(
    verificationId: string,
    fromStatus: VerificationStatus,
    toStatus: VerificationStatus,
    actorType: VerificationActorType,
    actorId: string | null,
    reason: string | null,
    occurredAt: string,
  ): VerificationEvent {
    return {
      id: `${fromStatus}:${toStatus}:${occurredAt}`,
      verificationId,
      actorId,
      actorType,
      fromStatus,
      toStatus,
      status: toStatus,
      reason,
      createdAt: occurredAt,
    };
  }

  private async requireCurrent(userId: string): Promise<IdentityVerification> {
    const validUserId = this.requireUserId(userId);
    const current = await this.getCurrentVerification(validUserId);
    if (!current) {
      throw new DomainValidationError(
        "Start an identity verification draft before performing this action.",
      );
    }
    return current;
  }

  private validateDocument(input: IdentityDocumentMetadataInput): IdentityDocument {
    const id = requireText(input.id, "document.id", 128);
    if (!documentTypes.includes(input.type)) {
      throw new DomainValidationError("document.type is not supported.");
    }
    const issuingCountryCode = input.issuingCountryCode
      ? input.issuingCountryCode.trim().toUpperCase()
      : null;
    if (issuingCountryCode && !isoCountryCodePattern.test(issuingCountryCode)) {
      throw new DomainValidationError(
        "document.issuingCountryCode must be a two-letter country code.",
      );
    }

    return {
      id,
      type: input.type,
      label: requireText(input.label, "document.label", 120),
      issuingCountryCode,
      expiresAt: input.expiresAt
        ? this.requireIsoTimestamp(input.expiresAt, "document.expiresAt")
        : null,
      storagePath: input.storagePath
        ? requireText(input.storagePath, "document.storagePath", 500)
        : null,
      uploadedAt: input.uploadedAt
        ? this.requireIsoTimestamp(input.uploadedAt, "document.uploadedAt")
        : null,
    };
  }

  private requireIsoTimestamp(value: string, field: string): string {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
      throw new DomainValidationError(`${field} must be an ISO-8601 UTC timestamp.`);
    }
    return value;
  }

  private requireUserId(userId: string): string {
    return requireText(userId, "userId", 128);
  }
}
