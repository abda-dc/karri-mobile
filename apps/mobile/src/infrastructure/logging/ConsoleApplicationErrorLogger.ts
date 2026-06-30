import type {
  ApplicationErrorContext,
  ApplicationErrorLogger,
} from "../../application/errors/ApplicationErrorService";
import type { ApplicationError } from "../../application/errors/ApplicationError";

export class ConsoleApplicationErrorLogger implements ApplicationErrorLogger {
  capture(error: ApplicationError, context: ApplicationErrorContext): void {
    console.warn(
      `[Karri] ${context.operation}`,
      {
        applicationCode: error.code,
        metadata: context.metadata,
        providerCode: error.providerCode,
        retryable: error.retryable,
        surface: context.surface,
      },
      error.originalError,
    );
  }
}
