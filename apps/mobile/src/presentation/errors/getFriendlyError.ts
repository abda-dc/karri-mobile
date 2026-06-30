export function getFriendlyError(error: unknown): string {
  if (error instanceof Error && error.name === "DomainValidationError") {
    return error.message;
  }

  if (typeof error === "object" && error && "code" in error) {
    const code = String(error.code);

    if (code === "permission-denied") {
      return "Karri does not have permission to perform that action.";
    }

    if (code === "unavailable") {
      return "Karri could not reach Firestore. Check your connection and try again.";
    }

    if (code === "aborted") {
      return "This record changed while Karri was saving. Review the latest state and try again.";
    }

    if (code === "deadline-exceeded") {
      return "Karri could not confirm the change in time. Check sync status before trying again.";
    }

    if (code === "already-exists" || code === "failed-precondition") {
      return "That action was already completed or is no longer available.";
    }
  }

  return "Karri could not complete that action. Please try again.";
}
