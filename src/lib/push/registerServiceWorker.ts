/**
 * Service worker registration for Web Push (HFT-50).
 *
 * Kept separate from the React entry so both the boot path (`frontend.tsx`)
 * and the alert opt-in button (HFT-51) can resolve the same registration. All
 * functions degrade gracefully on browsers without service worker / push
 * support; none of them throw to their caller, because a registration failure
 * must never block the public-safety alert UI.
 */

/** Path of the root-scoped push service worker. */
export const SERVICE_WORKER_URL = "/sw.js";

/** True when the runtime supports both service workers and the Push API. */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Register the push service worker.
 *
 * Returns the resulting registration, or `null` when push is unsupported or
 * registration fails. Never rejects.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  } catch (error: unknown) {
    // Log for diagnostics but swallow: the dashboard must still render.
    console.error("Service worker registration failed", error);
    return null;
  }
}

/**
 * Resolve the active service worker registration without forcing a new one.
 *
 * Prefers an already-resolved registration via `getRegistration()`, then falls
 * back to registering. Returns `null` on any failure. Never rejects.
 */
export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    if (existing) {
      return existing;
    }
    return await registerServiceWorker();
  } catch (error: unknown) {
    console.error("Could not resolve service worker registration", error);
    return null;
  }
}
