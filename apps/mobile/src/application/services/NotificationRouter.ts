import {
  NotificationActionType,
  type NotificationAction,
} from "../notifications/NotificationAction";

export const NotificationDestination = {
  Home: "home",
  Profile: "profile",
  Tracking: "tracking",
} as const;

export type NotificationRoute =
  | {
      readonly bookingId: string;
      readonly destination: typeof NotificationDestination.Tracking;
    }
  | {
      readonly destination:
        | typeof NotificationDestination.Home
        | typeof NotificationDestination.Profile;
    };

export interface NotificationRoutingSource {
  parseAction(payload: unknown): NotificationAction | null;
}

export class NotificationRouter {
  constructor(private readonly source: NotificationRoutingSource) {}

  resolve(action: NotificationAction): NotificationRoute {
    switch (action.type) {
      case NotificationActionType.OpenBooking:
        return {
          bookingId: action.bookingId,
          destination: NotificationDestination.Tracking,
        };
      case NotificationActionType.OpenNotifications:
        return { destination: NotificationDestination.Profile };
      case NotificationActionType.OpenHome:
        return { destination: NotificationDestination.Home };
    }
  }

  resolvePayload(payload: unknown): NotificationRoute | null {
    const action = this.source.parseAction(payload);
    return action ? this.resolve(action) : null;
  }
}
