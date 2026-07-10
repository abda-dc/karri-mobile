import * as Notifications from "expo-notifications";
import type {
  LocalNotificationResponse,
  LocalNotificationResponseGateway,
} from "../../../application/services/LocalNotificationService";

function toLocalResponse(
  response: Notifications.NotificationResponse,
): LocalNotificationResponse {
  return {
    payload: response.notification.request.content.data,
  };
}

export class ExpoLocalNotificationResponseGateway
  implements LocalNotificationResponseGateway
{
  listen(
    onResponse: (response: LocalNotificationResponse) => void,
  ): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => onResponse(toLocalResponse(response)),
    );

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          onResponse(toLocalResponse(response));
          Notifications.clearLastNotificationResponse();
        }
      })
      .catch(() => undefined);

    return () => subscription.remove();
  }
}
