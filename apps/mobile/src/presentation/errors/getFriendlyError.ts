import type { ApplicationError } from "../../application/errors/ApplicationError";
import { applicationErrorService } from "./applicationErrorService";

function formatFriendlyError(error: ApplicationError): string {
  return error.retryGuidance
    ? `${error.message} ${error.retryGuidance}`
    : error.message;
}

export function getFriendlyError(error: unknown): string {
  return formatFriendlyError(applicationErrorService.normalize(error));
}

export function reportApplicationError(error: unknown, operation: string): ApplicationError {
  return applicationErrorService.report(error, { operation });
}

export function reportFriendlyError(error: unknown, operation: string): string {
  return formatFriendlyError(reportApplicationError(error, operation));
}
