// Capacitor push-notification registration helper.
// Lazy-loaded so the web build stays small and tree-shakable.
//
// Usage: call `enablePushIfNative(user.id)` *after* the user has been
// signed in for a moment (NOT on first launch). Permission is requested
// once, the token is stored per-user in `push_subscriptions`.

import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

let attempted = false;

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Request permission and register the device token for the given user.
 * Safe to call multiple times — only runs the full flow once per session.
 */
export async function enablePushIfNative(userId: string | null | undefined) {
  if (!userId) return { ok: false, reason: "no-user" as const };
  if (attempted) return { ok: true, reason: "already" as const };
  attempted = true;

  if (!(await isNativePlatform())) return { ok: false, reason: "web" as const };

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive === "granted";
    if (!granted) {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive === "granted";
    }
    if (!granted) return { ok: false, reason: "denied" as const };

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      const { Capacitor } = await import("@capacitor/core");
      const platform = Capacitor.getPlatform(); // "ios" | "android"
      await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: userId, token: token.value, platform },
          { onConflict: "user_id,token" },
        );
    });

    PushNotifications.addListener("registrationError", (err) => {
      captureError(err, { where: "push.registrationError" });
    });

    return { ok: true, reason: "registered" as const };
  } catch (e) {
    captureError(e, { where: "push.enable" });
    return { ok: false, reason: "error" as const };
  }
}

/** Revoke local registration (e.g. on sign-out). */
export async function disablePush() {
  attempted = false;
  if (!(await isNativePlatform())) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
  } catch {
    /* noop */
  }
}
