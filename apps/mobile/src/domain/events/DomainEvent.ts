export interface DomainEvent<
  TType extends string = string,
  TPayload extends object = Record<string, unknown>,
> {
  readonly id: string;
  readonly type: TType;
  readonly aggregateId: string;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly schemaVersion: 1;
  readonly payload: TPayload;
}

export interface EventPublisher {
  publish(event: DomainEvent<string, object>): void;
}
