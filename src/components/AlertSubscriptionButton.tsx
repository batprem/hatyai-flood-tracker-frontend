/**
 * Web Push opt-in button (HFT-51).
 *
 * Public-safety contract: this control must NEVER nag and must NEVER throw an
 * unhandled error. When push is unsupported or permission was already denied
 * it renders nothing. All failures degrade to a quiet, dismissible inline note
 * — the rest of the dashboard keeps working regardless.
 *
 * State machine:
 *   unsupported -> (render nothing)
 *   denied      -> (render nothing)
 *   idle        -> "Get flood alerts" button
 *   loading     -> disabled spinner button
 *   subscribed  -> "Alerts on" badge + small "Turn off" link
 *   error       -> button + small non-alarming error note (recoverable)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertSubscriptionApiError,
  deleteSubscription,
  fetchVapidPublicKey,
  postSubscription,
  urlBase64ToUint8Array,
} from "@/lib/api/alertSubscriptions";
import {
  ensureServiceWorkerRegistration,
  isPushSupported,
} from "@/lib/push/registerServiceWorker";
import type { ForecastFramesCopy, Language } from "@/lib/i18n/forecastFrames";
import { cn } from "@/lib/utils";

/** localStorage key recording the user's last known subscription intent. */
const SUBSCRIBED_STORAGE_KEY = "hft.alerts.subscribed";

type ButtonState =
  | "unsupported"
  | "denied"
  | "idle"
  | "loading"
  | "subscribed"
  | "error";

function readPersistedSubscribed(): boolean {
  try {
    return localStorage.getItem(SUBSCRIBED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistSubscribed(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(SUBSCRIBED_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(SUBSCRIBED_STORAGE_KEY);
    }
  } catch {
    // Private-mode / disabled storage: button still works for this session.
  }
}

export interface AlertSubscriptionButtonProps {
  language: Language;
  copy: ForecastFramesCopy;
  className?: string;
}

export function AlertSubscriptionButton({
  language,
  copy,
  className,
}: AlertSubscriptionButtonProps) {
  const [state, setState] = useState<ButtonState>("unsupported");
  const mountedRef = useRef(true);

  // Resolve the initial state once on mount. We reconcile the persisted intent
  // with the browser's actual permission + live subscription so a reload or a
  // permission revoked in browser settings shows the correct control.
  useEffect(() => {
    mountedRef.current = true;

    void (async () => {
      if (!isPushSupported()) {
        return; // stays "unsupported" -> renders nothing
      }

      const permission = Notification.permission;
      if (permission === "denied") {
        if (mountedRef.current) setState("denied");
        return;
      }

      const registration = await ensureServiceWorkerRegistration();
      let liveSubscription: PushSubscription | null = null;
      if (registration) {
        try {
          liveSubscription = await registration.pushManager.getSubscription();
        } catch {
          liveSubscription = null;
        }
      }

      if (!mountedRef.current) return;

      if (liveSubscription && permission === "granted") {
        persistSubscribed(true);
        setState("subscribed");
        return;
      }

      // Persisted intent but no live subscription (e.g. browser dropped it):
      // reset to idle so the user can re-subscribe rather than seeing a stale
      // "Alerts on" badge that would over-promise on a safety feature.
      if (readPersistedSubscribed()) {
        persistSubscribed(false);
      }
      setState("idle");
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSubscribe = useCallback(async () => {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (!mountedRef.current) return;
        // Denied -> hide entirely (no nag). Dismissed/default -> back to idle.
        setState(permission === "denied" ? "denied" : "idle");
        return;
      }

      const registration = await ensureServiceWorkerRegistration();
      if (!registration) {
        if (mountedRef.current) setState("error");
        return;
      }

      // Reuse an existing subscription if the browser already has one.
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidKey = await fetchVapidPublicKey();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      await postSubscription(subscription);

      if (!mountedRef.current) return;
      persistSubscribed(true);
      setState("subscribed");
    } catch (error: unknown) {
      // Never rethrow: surface a quiet, recoverable error note.
      if (error instanceof AlertSubscriptionApiError) {
        console.error("Alert subscription failed", error.detail);
      } else {
        console.error("Alert subscription failed", error);
      }
      if (mountedRef.current) setState("error");
    }
  }, []);

  const handleUnsubscribe = useCallback(async () => {
    setState("loading");
    try {
      const registration = await ensureServiceWorkerRegistration();
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

      if (subscription) {
        const { endpoint } = subscription;
        await subscription.unsubscribe();
        // Best-effort backend cleanup; a failure here should not strand the
        // user in a "subscribed" state, so we proceed to idle regardless.
        try {
          await deleteSubscription(endpoint);
        } catch (deleteError: unknown) {
          console.error("Backend unsubscribe failed", deleteError);
        }
      }

      if (!mountedRef.current) return;
      persistSubscribed(false);
      setState("idle");
    } catch (error: unknown) {
      console.error("Unsubscribe failed", error);
      // Leave the user able to retry rather than blocking them.
      if (mountedRef.current) setState("subscribed");
    }
  }, []);

  if (state === "unsupported" || state === "denied") {
    return null;
  }

  if (state === "subscribed") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-100",
          className,
        )}
      >
        <BellRing className="size-4" aria-hidden />
        <span>
          {copy.alertSubscribed} <span aria-hidden>✓</span>
        </span>
        <button
          type="button"
          onClick={() => void handleUnsubscribe()}
          className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium text-emerald-200/80 underline-offset-2 hover:text-white hover:underline"
        >
          {copy.alertUnsubscribe}
        </button>
      </div>
    );
  }

  const isLoading = state === "loading";

  return (
    <div className={cn("flex flex-col items-stretch gap-1", className)}>
      <Button
        type="button"
        variant="secondary"
        aria-label={copy.alertAriaLabel}
        disabled={isLoading}
        onClick={() => void handleSubscribe()}
        className="rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Bell className="size-4" aria-hidden />
        )}
        {isLoading ? copy.alertWorking : copy.alertSubscribe}
      </Button>
      {state === "error" && (
        <span className="px-2 text-xs text-amber-200" role="status">
          {copy.alertError}
        </span>
      )}
    </div>
  );
}

export default AlertSubscriptionButton;
