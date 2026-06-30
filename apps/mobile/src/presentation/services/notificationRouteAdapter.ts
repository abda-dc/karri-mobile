import type { Href } from "expo-router";
import {
  NotificationDestination,
  type NotificationRoute,
} from "../../application/services/NotificationRouter";

export type NotificationRouteTarget = {
  readonly bookingId?: string;
  readonly href: Href;
};

export function toNotificationRouteTarget(
  route: NotificationRoute,
): NotificationRouteTarget {
  switch (route.destination) {
    case NotificationDestination.Home:
      return { href: "/(tabs)/home" };
    case NotificationDestination.Profile:
      return { href: "/(tabs)/profile" };
    case NotificationDestination.Tracking:
      return {
        bookingId: route.bookingId,
        href: "/(tabs)/tracking",
      };
  }
}
