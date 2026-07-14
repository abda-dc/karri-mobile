export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {}
export class PermissionDeniedError extends DomainError {}
export class ConflictError extends DomainError {}
export class FailedPreconditionError extends DomainError {}
export class NotFoundError extends DomainError {}
