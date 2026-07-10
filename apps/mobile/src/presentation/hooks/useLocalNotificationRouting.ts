import { useRouter } from "expo-router";
import { useEffect } from "react";
import { toNotificationRouteTarget } from "../services/notificationRouteAdapter";
import { mobileServices } from "../services/mobileServices";

export function useLocalNotificationRouting(): void {
  const router = useRouter();

  useEffect(
    () =>
      mobileServices.localNotifications.listen((response) => {
        const route = mobileServices.notificationRouter.resolvePayload(
          response.payload,
        );
        if (!route) {
          return;
        }

        router.push(toNotificationRouteTarget(route).href);
      }),
    [router],
  );
}
