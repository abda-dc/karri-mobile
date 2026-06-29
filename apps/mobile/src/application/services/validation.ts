export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export function requireText(value: string, field: string, maximumLength = 500): string {
  const cleaned = value.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    throw new DomainValidationError(`${field} is required.`);
  }

  if (cleaned.length > maximumLength) {
    throw new DomainValidationError(`${field} must be ${maximumLength} characters or fewer.`);
  }

  return cleaned;
}

export function requirePositiveNumber(
  value: number,
  field: string,
  maximum: number,
): number {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new DomainValidationError(`${field} must be greater than 0 and no more than ${maximum}.`);
  }

  return value;
}

export function requireIsoDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainValidationError(`${field} must use YYYY-MM-DD format.`);
  }

  return value;
}

export function optionalText(value: string, field: string, maximumLength: number): string {
  const cleaned = value.trim().replace(/\s+/g, " ");

  if (cleaned.length > maximumLength) {
    throw new DomainValidationError(`${field} must be ${maximumLength} characters or fewer.`);
  }

  return cleaned;
}
