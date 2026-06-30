import { ApplicationError, ApplicationErrorCode } from "./ApplicationError";

type ErrorMetadataValue = boolean | number | string | null;

export interface ApplicationErrorContext {
  readonly metadata?: Readonly<Record<string, ErrorMetadataValue>>;
  readonly operation: string;
  readonly surface?: string;
}

export interface ApplicationErrorLogger {
  capture(error: ApplicationError, context: ApplicationErrorContext): void;
}

export interface ApplicationErrorMapper {
  map(error: unknown): ApplicationError | null;
}

function mapDomainError(error: unknown): ApplicationError | null {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.name === "DomainValidationError") {
    return new ApplicationError({
      code: ApplicationErrorCode.Validation,
      originalError: error,
      retryable: false,
      retryGuidance: "Review the information and try again.",
      userMessage: error.message,
    });
  }

  if (error.name === "InvalidBookingTransitionError") {
    return new ApplicationError({
      code: ApplicationErrorCode.DomainRule,
      originalError: error,
      retryable: false,
      retryGuidance: "Refresh the booking and use the next available action.",
      userMessage: error.message,
    });
  }

  return null;
}

export class ApplicationErrorService {
  constructor(
    private readonly mappers: ReadonlyArray<ApplicationErrorMapper>,
    private readonly logger: ApplicationErrorLogger,
  ) {}

  normalize(error: unknown): ApplicationError {
    if (error instanceof ApplicationError) {
      return error;
    }

    const domainError = mapDomainError(error);
    if (domainError) {
      return domainError;
    }

    for (const mapper of this.mappers) {
      const mapped = mapper.map(error);
      if (mapped) {
        return mapped;
      }
    }

    return new ApplicationError({
      code: ApplicationErrorCode.Unknown,
      originalError: error,
      retryable: false,
      retryGuidance: "Check the latest activity and sync status before deciding whether to try again.",
      userMessage: "Karri could not complete that action.",
    });
  }

  report(error: unknown, context: ApplicationErrorContext): ApplicationError {
    const applicationError = this.normalize(error);
    this.logger.capture(applicationError, context);
    return applicationError;
  }
}
