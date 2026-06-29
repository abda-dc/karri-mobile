export type EntityId = string;
export type DomainTimestamp = string | null;

export interface DomainEntity {
  readonly id: EntityId;
  readonly createdAt: DomainTimestamp;
  readonly updatedAt: DomainTimestamp;
}
