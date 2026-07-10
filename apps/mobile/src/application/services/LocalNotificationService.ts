export interface LocalNotificationResponse {
  readonly payload: unknown;
}

export interface LocalNotificationResponseGateway {
  listen(
    onResponse: (response: LocalNotificationResponse) => void,
  ): () => void;
}

export class LocalNotificationService {
  constructor(private readonly gateway: LocalNotificationResponseGateway) {}

  listen(
    onResponse: (response: LocalNotificationResponse) => void,
  ): () => void {
    return this.gateway.listen(onResponse);
  }
}
