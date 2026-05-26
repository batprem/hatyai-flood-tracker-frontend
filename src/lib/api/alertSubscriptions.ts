/**
 * Typed client for the Web Push alert subscription endpoints (HFT-50 / HFT-51).
 *
 * Mirrors the backend contract:
 *   - `GET    /api/alerts/vapid-public-key` -> { vapid_public_key: string }
 *   - `POST   /api/alerts/subscriptions`    -> 201, body is the PushSubscription
 *   - `DELETE /api/alerts/subscriptions`    -> 204, body is { endpoint }
 *
 * Base-URL resolution and the discriminated error shape follow the existing
 * `forecastFrames.ts` client so the alert UI fails the same way the rest of the
 * app does (network / http / parse), and so a missing `VITE_API_URL` cannot
 * crash boot.
 */

import { z } from "zod";

/** Discriminated error shapes the opt-in UI distinguishes. */
export type AlertSubscriptionError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "http"; status: number; message: string; body?: string }
  | { kind: "parse"; message: string; issues: ReadonlyArray<string> };

export class AlertSubscriptionApiError extends Error {
  readonly detail: AlertSubscriptionError;

  constructor(detail: AlertSubscriptionError) {
    super(detail.message);
    this.name = "AlertSubscriptionApiError";
    this.detail = detail;
  }
}

const vapidPublicKeySchema = z.object({
  vapid_public_key: z.string().min(1),
});

/**
 * Resolve the backend base URL from build-time `VITE_API_URL`.
 *
 * Mirrors `forecastFrames.resolveBaseUrl`: reads the literal env reference Bun
 * inlines at build/dev time, guards against `process` being undefined in the
 * browser, and falls back to same-origin relative paths.
 */
function resolveBaseUrl(): string {
  let fromEnv: string | undefined;
  try {
    fromEnv = process.env.VITE_API_URL;
  } catch {
    fromEnv = undefined;
  }
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return "";
}

function buildUrl(path: string): string {
  const base = resolveBaseUrl();
  return `${base}${path}`;
}

function toNetworkError(error: unknown, action: string): AlertSubscriptionApiError {
  return new AlertSubscriptionApiError({
    kind: "network",
    message:
      error instanceof Error
        ? `Network error ${action}: ${error.message}`
        : `Network error ${action}.`,
    cause: error,
  });
}

/**
 * Fetch the server's VAPID public key used to create a push subscription.
 *
 * Throws `AlertSubscriptionApiError` on every non-success path so the caller
 * can branch on `error.detail.kind`.
 */
export async function fetchVapidPublicKey(signal?: AbortSignal): Promise<string> {
  let response: Response;
  try {
    response = await fetch(buildUrl("/api/alerts/vapid-public-key"), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error: unknown) {
    throw toNetworkError(error, "fetching the alert key");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AlertSubscriptionApiError({
      kind: "http",
      status: response.status,
      message: `Alert key endpoint returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    throw new AlertSubscriptionApiError({
      kind: "parse",
      message:
        error instanceof Error
          ? `Alert key endpoint returned invalid JSON: ${error.message}`
          : "Alert key endpoint returned invalid JSON.",
      issues: [],
    });
  }

  const parsed = vapidPublicKeySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AlertSubscriptionApiError({
      kind: "parse",
      message: "Alert key response did not match the expected contract.",
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      ),
    });
  }

  return parsed.data.vapid_public_key;
}

/**
 * Register a push subscription with the backend.
 *
 * The backend stores the endpoint plus encryption keys; the serialized
 * `PushSubscription` (via `subscription.toJSON()`) already matches the
 * `{ endpoint, keys: { p256dh, auth } }` contract. Throws
 * `AlertSubscriptionApiError` on any non-2xx response.
 */
export async function postSubscription(
  subscription: PushSubscription,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildUrl("/api/alerts/subscriptions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
      signal,
    });
  } catch (error: unknown) {
    throw toNetworkError(error, "registering for alerts");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AlertSubscriptionApiError({
      kind: "http",
      status: response.status,
      message: `Subscription endpoint returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }
}

/**
 * Remove a push subscription from the backend by its endpoint.
 *
 * Throws `AlertSubscriptionApiError` on any non-2xx response.
 */
export async function deleteSubscription(
  endpoint: string,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(buildUrl("/api/alerts/subscriptions"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
      signal,
    });
  } catch (error: unknown) {
    throw toNetworkError(error, "turning off alerts");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AlertSubscriptionApiError({
      kind: "http",
      status: response.status,
      message: `Unsubscribe endpoint returned ${response.status} ${response.statusText}`,
      body: body.slice(0, 500),
    });
  }
}

/**
 * Convert a base64url VAPID public key into the `Uint8Array` the Push API
 * requires for `applicationServerKey`.
 *
 * Browsers will not accept the raw base64url string; it must be decoded to
 * bytes. Standard base64url -> base64 + padding before `atob`.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(normalized);
  const output = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
