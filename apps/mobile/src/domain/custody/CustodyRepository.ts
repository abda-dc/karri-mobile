import type { CustodyEvent, NewCustodyEvent } from "./CustodyEvent";

export interface CustodyRepository {
  append(event: NewCustodyEvent): Promise<CustodyEvent>;
  listByBooking(bookingId: string): Promise<ReadonlyArray<CustodyEvent>>;
}
