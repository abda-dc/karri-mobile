import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPO_VISIBLE_NOTIFICATION, type ExpoPushMessage } from "../src/notifications/NotificationContracts.js";
import {
  EXPO_PUSH_URL,
  MAX_EXPO_PUSH_BATCH_SIZE,
  ExpoPushProvider,
} from "../src/providers/ExpoPushProvider.js";

const fakeTokenOne = "ExpoPushToken[FAKE_TEST_TOKEN_ONE]";
const fakeTokenTwo = "ExponentPushToken[FAKE_TEST_TOKEN_TWO]";

function message(token = fakeTokenOne, notificationId = "notification_test"): ExpoPushMessage {
  return {
    to: token,
    title: EXPO_VISIBLE_NOTIFICATION.title,
    body: EXPO_VISIBLE_NOTIFICATION.body,
    data: { schemaVersion: 1, notificationId, action: "open_notifications" },
    channelId: EXPO_VISIBLE_NOTIFICATION.channelId,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExpoPushProvider", () => {
  it("sends exactly the approved minimal payload", async () => {
    let capturedUrl: RequestInfo | URL | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse({ data: [{ status: "ok", id: "ticket-1" }] });
    });
    const provider = new ExpoPushProvider(fetchMock as unknown as typeof fetch);

    await provider.send([message()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(capturedUrl).toBe(EXPO_PUSH_URL);
    expect(JSON.parse(String(capturedInit?.body))).toEqual([{
      to: fakeTokenOne,
      title: "Karri update",
      body: "Open Karri to view your latest activity.",
      data: {
        schemaVersion: 1,
        notificationId: "notification_test",
        action: "open_notifications",
      },
      channelId: "karri_activity_v1",
    }]);
    expect(Object.keys(JSON.parse(String(capturedInit?.body))[0]).sort()).toEqual(
      ["body", "channelId", "data", "title", "to"],
    );
  });

  it("classifies a successful ticket as accepted", async () => {
    const provider = new ExpoPushProvider(vi.fn(async () =>
      jsonResponse({ data: [{ status: "ok", id: "ticket-accepted" }] })) as unknown as typeof fetch);
    await expect(provider.send([message()])).resolves.toEqual([{
      status: "accepted",
      outcomeCode: "ticket_accepted",
      providerTicketId: "ticket-accepted",
    }]);
  });

  it("classifies DeviceNotRegistered as invalid_registration", async () => {
    const provider = new ExpoPushProvider(vi.fn(async () => jsonResponse({ data: [{
      status: "error",
      details: { error: "DeviceNotRegistered" },
    }] })) as unknown as typeof fetch);
    expect((await provider.send([message()]))[0].status).toBe("invalid_registration");
  });

  it.each([
    [429, "temporary_failure", "http_429"],
    [500, "temporary_failure", "http_5xx"],
    [503, "temporary_failure", "http_5xx"],
    [400, "permanent_failure", "invalid_payload"],
    [401, "permanent_failure", "credential_error"],
    [403, "permanent_failure", "credential_error"],
  ])("classifies HTTP %i", async (status, expectedStatus, outcomeCode) => {
    const provider = new ExpoPushProvider(vi.fn(async () => new Response("", { status })) as unknown as typeof fetch);
    await expect(provider.send([message()])).resolves.toEqual([{
      status: expectedStatus,
      outcomeCode,
      providerTicketId: null,
    }]);
  });

  it("classifies network failure as temporary without exposing the cause", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const provider = new ExpoPushProvider(vi.fn(async () => {
      throw new Error(`network failed for ${fakeTokenOne}`);
    }) as unknown as typeof fetch);

    const results = await provider.send([message()]);

    expect(results).toEqual([{
      status: "temporary_failure",
      outcomeCode: "network_failure",
      providerTicketId: null,
    }]);
    expect(String(results)).not.toContain(fakeTokenOne);
    expect(JSON.stringify(results)).not.toContain(fakeTokenOne);
    expect([errorSpy, warnSpy, logSpy].flatMap((spy) => spy.mock.calls.flat()).join(" ")).not.toContain(fakeTokenOne);
  });

  it("classifies malformed and unknown responses as permanent", async () => {
    const malformed = new ExpoPushProvider(vi.fn(async () => new Response("not-json")) as unknown as typeof fetch);
    const unknown = new ExpoPushProvider(vi.fn(async () => jsonResponse({ data: [{ status: "mystery" }] })) as unknown as typeof fetch);
    const unsafeTicket = new ExpoPushProvider(vi.fn(async () => jsonResponse({ data: [{
      status: "ok",
      id: fakeTokenOne,
    }] })) as unknown as typeof fetch);
    expect(await malformed.send([message()])).toEqual([{
      status: "permanent_failure",
      outcomeCode: "malformed_response",
      providerTicketId: null,
    }]);
    expect((await unknown.send([message()]))[0].status).toBe("permanent_failure");
    const unsafeResult = await unsafeTicket.send([message()]);
    expect(unsafeResult[0].status).toBe("permanent_failure");
    expect(JSON.stringify(unsafeResult)).not.toContain(fakeTokenOne);
  });

  it("classifies a response-body TypeError as a temporary network failure without disclosure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = jsonResponse({ data: [] });
    vi.spyOn(response, "json").mockRejectedValue(new TypeError(`stream failed for ${fakeTokenOne}`));
    const fetchMock = vi.fn(async () => response);
    const provider = new ExpoPushProvider(fetchMock as unknown as typeof fetch);

    const results = await provider.send([message()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toEqual([{
      status: "temporary_failure",
      outcomeCode: "network_failure",
      providerTicketId: null,
    }]);
    expect(String(results)).not.toContain(fakeTokenOne);
    expect(JSON.stringify(results)).not.toContain(fakeTokenOne);
    expect([errorSpy, warnSpy, logSpy].flatMap((spy) => spy.mock.calls.flat()).join(" "))
      .not.toContain(fakeTokenOne);
  });

  it("times out an aborted response-body read as a temporary network timeout without disclosure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let observedAbort = false;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return {
        status: 200,
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          const rejectForAbort = () => {
            observedAbort = true;
            const error = new Error(`aborted body for ${fakeTokenOne}`);
            error.name = "AbortError";
            reject(error);
          };
          if (signal?.aborted) {
            rejectForAbort();
          } else {
            signal?.addEventListener("abort", rejectForAbort, { once: true });
          }
        }),
      } as unknown as Response;
    });
    const provider = new ExpoPushProvider(fetchMock as unknown as typeof fetch, 5);

    const results = await provider.send([message()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(observedAbort).toBe(true);
    expect(results).toEqual([{
      status: "temporary_failure",
      outcomeCode: "network_timeout",
      providerTicketId: null,
    }]);
    expect(String(results)).not.toContain(fakeTokenOne);
    expect(JSON.stringify(results)).not.toContain(fakeTokenOne);
    expect([errorSpy, warnSpy, logSpy].flatMap((spy) => spy.mock.calls.flat()).join(" "))
      .not.toContain(fakeTokenOne);
  });

  it("preserves independent partial batch outcomes", async () => {
    const provider = new ExpoPushProvider(vi.fn(async () => jsonResponse({ data: [
      { status: "ok", id: "ticket-1" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ] })) as unknown as typeof fetch);

    const results = await provider.send([message(), message(fakeTokenTwo, "notification_test_2")]);
    expect(results.map((entry) => entry.status)).toEqual(["accepted", "invalid_registration"]);
  });

  it("refuses 101 messages without fetching or disclosing fake tokens", async () => {
    const fetchMock = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const tokens = Array.from(
      { length: MAX_EXPO_PUSH_BATCH_SIZE + 1 },
      (_, index) => `ExpoPushToken[FAKE_N3A_BATCH_${String(index).padStart(3, "0")}]`,
    );
    const provider = new ExpoPushProvider(fetchMock as unknown as typeof fetch);

    const results = await provider.send(tokens.map((token, index) => message(token, `notification_${index}`)));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results).toHaveLength(MAX_EXPO_PUSH_BATCH_SIZE + 1);
    expect(results).toEqual(Array.from({ length: MAX_EXPO_PUSH_BATCH_SIZE + 1 }, () => ({
      status: "permanent_failure",
      outcomeCode: "batch_limit_exceeded",
      providerTicketId: null,
    })));
    const serializedResults = JSON.stringify(results);
    const capturedConsole = [errorSpy, warnSpy, logSpy]
      .flatMap((spy) => spy.mock.calls.flat())
      .join(" ");
    for (const token of tokens) {
      expect(serializedResults).not.toContain(token);
      expect(capturedConsole).not.toContain(token);
    }
  });
});
