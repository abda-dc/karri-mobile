import type {
  LocalNotificationResponse,
  LocalNotificationResponseGateway,
} from "../../../application/services/LocalNotificationService";

export class ExpoLocalNotificationResponseGateway
  implements LocalNotificationResponseGateway
{
  listen(
    _onResponse: (response: LocalNotificationResponse) => void,
  ): () => void {
    return () => undefined;
  }
}
