export enum ApplicationErrorCode {
  Authentication = "authentication",
  Cancelled = "cancelled",
  Configuration = "configuration",
  Conflict = "conflict",
  DomainRule = "domain-rule",
  Network = "network",
  NotFound = "not-found",
  Permission = "permission",
  RateLimited = "rate-limited",
  Temporary = "temporary",
  Timeout = "timeout",
  Unknown = "unknown",
  Validation = "validation",
}

export interface ApplicationErrorOptions {
  readonly code: ApplicationErrorCode;
  readonly originalError: unknown;
  readonly providerCode?: string;
  readonly retryable: boolean;
  readonly retryGuidance?: string;
  readonly userMessage: string;
}

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly originalError: unknown;
  readonly providerCode: string | null;
  readonly retryable: boolean;
  readonly retryGuidance: string | null;

  constructor(options: ApplicationErrorOptions) {
    super(options.userMessage);
    this.name = "ApplicationError";
    this.code = options.code;
    this.originalError = options.originalError;
    this.providerCode = options.providerCode ?? null;
    this.retryable = options.retryable;
    this.retryGuidance = options.retryGuidance ?? null;
  }
}
