import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";
const GUEST_IDENTITY_KEY = "toncrime_guest_identity_v4";
const AUTH_COOLDOWN_UNTIL_KEY = "toncrime_auth_cooldown_until_v2";
const AUTH_COOLDOWN_REASON_KEY = "toncrime_auth_cooldown_reason_v2";
const AUTH_LAST_TRY_KEY = "toncrime_auth_last_try_v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;
window.tcSupabase = supabase;

function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}

function makeRandomId() {
  try {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  }
}

export function getIdentityKey() {
  const tgUser = getTelegramUser();
  if (tgUser?.id) return `tg_${String(tgUser.id)}`;

  try {
    let key = localStorage.getItem(GUEST_IDENTITY_KEY);
    if (!key) {
      key = `guest_${makeRandomId()}`;
      localStorage.setItem(GUEST_IDENTITY_KEY, key);
    }
    return key;
  } catch {
    return `guest_${makeRandomId()}`;
  }
}

function sanitizeIdentityKey(identityKey) {
  return String(identityKey || "guest_unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 48);
}

function buildIdentityEmail(identityKey = getIdentityKey()) {
  return `${sanitizeIdentityKey(identityKey)}@toncrime.local`;
}

function buildIdentityPassword(identityKey = getIdentityKey()) {
  const safe = sanitizeIdentityKey(identityKey);
  return `TonCrime_${safe}_Auth!2026`.slice(0, 64);
}

function nowMs() {
  return Date.now();
}

function getAuthCooldownUntil() {
  try {
    return Number(localStorage.getItem(AUTH_COOLDOWN_UNTIL_KEY) || 0);
  } catch {
    return 0;
  }
}

function setAuthCooldown(ms, reason = "auth temporarily disabled") {
  const until = nowMs() + Math.max(1000, Number(ms || 0));
  try {
    localStorage.setItem(AUTH_COOLDOWN_UNTIL_KEY, String(until));
    localStorage.setItem(AUTH_COOLDOWN_REASON_KEY, String(reason || ""));
  } catch {}
  return until;
}

function clearAuthCooldown() {
  try {
    localStorage.removeItem(AUTH_COOLDOWN_UNTIL_KEY);
    localStorage.removeItem(AUTH_COOLDOWN_REASON_KEY);
  } catch {}
}

function isRateLimitError(err) {
  const msg = String(err?.message || err?.error_description || err?.name || "").toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  return status == 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("email rate limit exceeded");
}

function isEmailDisabledError(err) {
  const msg = String(err?.message || err?.error_description || "").toLowerCase();
  return msg.includes("email") && (msg.includes("disabled") || msg.includes("not allowed"));
}

let authPromise = null;
let authWarned = false;

function warnOnce(...args) {
  if (authWarned) return;
  authWarned = true;
  console.warn(...args);
}

function canAttemptNow() {
  const cooldownUntil = getAuthCooldownUntil();
  if (cooldownUntil > nowMs()) return false;
  try {
    const last = Number(localStorage.getItem(AUTH_LAST_TRY_KEY) || 0);
    if (last && nowMs() - last < 15000) return false;
    localStorage.setItem(AUTH_LAST_TRY_KEY, String(nowMs()));
  } catch {}
  return true;
}

export async function ensureAuthSession() {
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        clearAuthCooldown();
        return data.session.user;
      }
    } catch {}

    if (!canAttemptNow()) return null;

    const identityKey = getIdentityKey();
    const email = buildIdentityEmail(identityKey);
    const password = buildIdentityPassword(identityKey);

    try {
      const signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (!signInRes.error && signInRes.data?.user) {
        clearAuthCooldown();
        return signInRes.data.user;
      }
      if (isRateLimitError(signInRes?.error)) {
        setAuthCooldown(30 * 60 * 1000, signInRes.error.message || "Auth rate limited");
        warnOnce("[AUTH] cooldown started after signIn rate limit:", signInRes.error);
        return null;
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        setAuthCooldown(30 * 60 * 1000, err?.message || "Auth rate limited");
        warnOnce("[AUTH] cooldown started after signIn rate limit:", err);
        return null;
      }
    }

    try {
      const signUpRes = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            identity_key: identityKey,
            username: String(getTelegramUser()?.username || "Player"),
          },
        },
      });

      if (!signUpRes.error && signUpRes.data?.user) {
        if (signUpRes.data.session?.user) {
          clearAuthCooldown();
          return signUpRes.data.session.user;
        }
        const signInAgain = await supabase.auth.signInWithPassword({ email, password });
        if (!signInAgain.error && signInAgain.data?.user) {
          clearAuthCooldown();
          return signInAgain.data.user;
        }
      }

      if (isRateLimitError(signUpRes?.error)) {
        setAuthCooldown(30 * 60 * 1000, signUpRes.error.message || "Auth sign-up rate limited");
        warnOnce("[AUTH] signUp rate limited. Auth paused for 30 minutes.");
        return null;
      }
      if (isEmailDisabledError(signUpRes?.error)) {
        setAuthCooldown(12 * 60 * 60 * 1000, signUpRes.error.message || "Email auth disabled");
        warnOnce("[AUTH] email signups disabled. Auth paused.");
        return null;
      }
      if (signUpRes?.error) {
        setAuthCooldown(10 * 60 * 1000, signUpRes.error.message || "Auth sign-up failed");
        warnOnce("[AUTH] signUp failed. Auth paused for 10 minutes:", signUpRes.error);
        return null;
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        setAuthCooldown(30 * 60 * 1000, err?.message || "Auth sign-up rate limited");
        warnOnce("[AUTH] signUp rate limited. Auth paused for 30 minutes.");
        return null;
      }
      setAuthCooldown(10 * 60 * 1000, err?.message || "Auth fatal");
      warnOnce("[AUTH] signUp fatal. Auth paused for 10 minutes:", err);
      return null;
    }

    return null;
  })().finally(() => {
    authPromise = null;
  });

  return authPromise;
}

window.tcEnsureAuthSession = ensureAuthSession;
window.tcGetIdentityKey = getIdentityKey;
