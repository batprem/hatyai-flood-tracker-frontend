/**
 * Hat Yai Flood Watch service worker (HFT-50).
 *
 * Handles Web Push `push` events and notification clicks. This file is served
 * verbatim at the root scope (`/sw.js`) so it can control the whole origin —
 * it is intentionally NOT bundled with the app code (Bun content-hashes
 * bundled assets, which would break the fixed URL and root scope a push
 * service worker requires). It runs in the ServiceWorkerGlobalScope, so there
 * is no DOM here; only `self`, `clients`, and the registration API.
 *
 * Public-safety contract: this handler must never throw in a way that drops a
 * flood alert. If the payload is missing or malformed we still surface a
 * generic bilingual notification rather than showing nothing.
 *
 * Payload shape (from backend/docs/service-worker-spec.md):
 *   {
 *     "title_en": string, "title_th": string,
 *     "body_en": string,  "body_th": string,
 *     "url": string,      "risk_level": "green"|"yellow"|"orange"|"red"
 *   }
 */

/* eslint-env serviceworker */

"use strict";

const FALLBACK_URL = "/";
const ICON_URL = "/logo.svg";

/** Generic bilingual fallback used when no usable payload is available. */
const FALLBACK_NOTIFICATION = {
  title: "แจ้งเตือนน้ำท่วม / Flood alert",
  body: "มีการแจ้งเตือนใหม่ เปิดแอปเพื่อดูรายละเอียด / A new alert is available. Open the app for details.",
};

/**
 * Decide whether to render Thai copy.
 *
 * Service workers expose `self.navigator.language`. We treat any locale that
 * starts with "th" as Thai and default everything else to English, mirroring
 * the app's two-language model.
 */
function prefersThai() {
  const language =
    (self.navigator && self.navigator.language) || "";
  return language.toLowerCase().startsWith("th");
}

/**
 * Pick the localized string for a payload field pair, tolerating partial
 * payloads (e.g. only an English title) so a real alert still shows.
 */
function pickLocalized(thValue, enValue, useThai) {
  const preferred = useThai ? thValue : enValue;
  const alternate = useThai ? enValue : thValue;
  if (typeof preferred === "string" && preferred.length > 0) {
    return preferred;
  }
  if (typeof alternate === "string" && alternate.length > 0) {
    return alternate;
  }
  return null;
}

/**
 * Parse the push payload into a notification spec, never throwing.
 *
 * Returns the fallback notification when the payload is absent, not valid
 * JSON, or has no usable title/body. The destination URL is kept relative-safe
 * by falling back to the app root when the payload omits it.
 */
function buildNotification(event) {
  const useThai = prefersThai();

  let payload = null;
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (jsonError) {
      // Some push services deliver plain text; try that before giving up.
      try {
        const text = event.data.text();
        if (text) {
          payload = { body_en: text, body_th: text };
        }
      } catch (textError) {
        payload = null;
      }
    }
  }

  if (!payload || typeof payload !== "object") {
    return {
      title: FALLBACK_NOTIFICATION.title,
      options: {
        body: FALLBACK_NOTIFICATION.body,
        icon: ICON_URL,
        data: { url: FALLBACK_URL },
      },
    };
  }

  const title =
    pickLocalized(payload.title_th, payload.title_en, useThai) ||
    FALLBACK_NOTIFICATION.title;
  const body =
    pickLocalized(payload.body_th, payload.body_en, useThai) ||
    FALLBACK_NOTIFICATION.body;
  const url =
    typeof payload.url === "string" && payload.url.length > 0
      ? payload.url
      : FALLBACK_URL;

  // `tag` collapses repeated alerts for the same risk level so a burst of
  // pushes does not stack many notifications; `renotify` still re-alerts the
  // user when a new one for that level arrives.
  const tag =
    typeof payload.risk_level === "string" && payload.risk_level.length > 0
      ? `hft-flood-${payload.risk_level}`
      : "hft-flood";

  return {
    title,
    options: {
      body,
      icon: ICON_URL,
      tag,
      renotify: true,
      data: {
        url,
        riskLevel:
          typeof payload.risk_level === "string" ? payload.risk_level : null,
      },
    },
  };
}

self.addEventListener("push", (event) => {
  const { title, options } = buildNotification(event);
  // `waitUntil` keeps the worker alive until the notification is shown; if
  // showNotification rejects we still resolve with the fallback so the event
  // never surfaces as an unhandled rejection.
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() =>
      self.registration.showNotification(FALLBACK_NOTIFICATION.title, {
        body: FALLBACK_NOTIFICATION.body,
        icon: ICON_URL,
        data: { url: FALLBACK_URL },
      }),
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl =
    typeof data.url === "string" && data.url.length > 0
      ? data.url
      : FALLBACK_URL;

  // Focus an existing tab on the same origin if one is open; otherwise open a
  // new window. This avoids spawning duplicate tabs when the user already has
  // the dashboard open.
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && "focus" in client) {
            await client.focus();
            if ("navigate" in client && clientUrl.href !== target.href) {
              await client.navigate(target.href);
            }
            return;
          }
        } catch (clientError) {
          // Ignore malformed client URLs and fall through to openWindow.
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

// Activate immediately so a freshly registered worker can handle pushes
// without requiring a second page load.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
