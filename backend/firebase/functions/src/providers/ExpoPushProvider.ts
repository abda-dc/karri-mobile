import type {
  ExpoPushMessage,
  PushDeliveryResult,
  PushProvider,
} from "../notifications/NotificationContracts.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_EXPO_PUSH_BATCH_SIZE = 100;
const SAFE_TICKET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,256}$/;

type FetchLike = typeof fetch;

function result(
  status: PushDeliveryResult["status"],
  outcomeCode: string,
  providerTicketId: string | null = null,
): PushDeliveryResult {
  return { status, outcomeCode, providerTicketId };
}

function repeatedResult(
  count: number,
  status: PushDeliveryResult["status"],
  outcomeCode: string,
): ReadonlyArray<PushDeliveryResult> {
  return Array.from({ length: count }, () => result(status, outcomeCode));
}

function classifyTicket(ticket: unknown): PushDeliveryResult {
  if (!ticket || typeof ticket !== "object" || Array.isArray(ticket)) {
    return result("permanent_failure", "malformed_response");
  }

  const value = ticket as Record<string, unknown>;
  if (value.status === "ok") {
    return typeof value.id === "string" && SAFE_TICKET_ID_PATTERN.test(value.id)
      ? result("accepted", "ticket_accepted", value.id)
      : result("permanent_failure", "malformed_response");
  }

  if (value.status !== "error") {
    return result("permanent_failure", "malformed_response");
  }

  const details = value.details;
  const expoError =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>).error
      : undefined;

  if (expoError === "DeviceNotRegistered") {
    return result("invalid_registration", "device_not_registered");
  }
  if (expoError === "MessageRateExceeded") {
    return result("temporary_failure", "provider_rate_limited");
  }
  if (expoError === "InvalidCredentials") {
    return result("permanent_failure", "credential_error");
  }
  return result("permanent_failure", "provider_rejected");
}

function classifyResponseReadFailure(error: unknown, signal: AbortSignal): PushDeliveryResult {
  const errorName = error && typeof error === "object" && "name" in error
    ? (error as { name?: unknown }).name
    : undefined;
  if (signal.aborted || errorName === "AbortError") {
    return result("temporary_failure", "network_timeout");
  }
  if (error instanceof SyntaxError) {
    return result("permanent_failure", "malformed_response");
  }
  if (error instanceof TypeError) {
    return result("temporary_failure", "network_failure");
  }
  return result("permanent_failure", "malformed_response");
}

export class ExpoPushProvider implements PushProvider {
  constructor(
    private readonly fetchImplementation: FetchLike = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  async send(messages: ReadonlyArray<ExpoPushMessage>): Promise<ReadonlyArray<PushDeliveryResult>> {
    if (messages.length === 0) {
      return [];
    }
    if (messages.length > MAX_EXPO_PUSH_BATCH_SIZE) {
      return repeatedResult(messages.length, "permanent_failure", "batch_limit_exceeded");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchImplementation(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(messages),
          signal: controller.signal,
        });
      } catch (error) {
        const errorName = error && typeof error === "object" && "name" in error
          ? (error as { name?: unknown }).name
          : undefined;
        const outcomeCode = controller.signal.aborted || errorName === "AbortError"
          ? "network_timeout"
          : "network_failure";
        return repeatedResult(messages.length, "temporary_failure", outcomeCode);
      }

      if (response.status === 429) {
        return repeatedResult(messages.length, "temporary_failure", "http_429");
      }
      if (response.status >= 500) {
        return repeatedResult(messages.length, "temporary_failure", "http_5xx");
      }
      if (response.status === 401 || response.status === 403) {
        return repeatedResult(messages.length, "permanent_failure", "credential_error");
      }
      if (response.status === 400) {
        return repeatedResult(messages.length, "permanent_failure", "invalid_payload");
      }
      if (!response.ok) {
        return repeatedResult(messages.length, "permanent_failure", "http_rejected");
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        const failure = classifyResponseReadFailure(error, controller.signal);
        return Array.from({ length: messages.length }, () => failure);
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return repeatedResult(messages.length, "permanent_failure", "malformed_response");
      }
      const tickets = (payload as Record<string, unknown>).data;
      if (!Array.isArray(tickets) || tickets.length !== messages.length) {
        return repeatedResult(messages.length, "permanent_failure", "malformed_response");
      }
      return tickets.map(classifyTicket);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export { EXPO_PUSH_URL, MAX_EXPO_PUSH_BATCH_SIZE };
