import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";
const STORE_KEY = "toncrime_store_v1";
const PROFILE_KEY_STORAGE = "toncrime_profile_key_v1";
const GUEST_IDENTITY_KEY = "toncrime_guest_identity_v4";
const AUTH_COOLDOWN_UNTIL_KEY = "toncrime_auth_cooldown_until_v2";
const AUTH_COOLDOWN_REASON_KEY = "toncrime_auth_cooldown_reason_v2";
const AUTH_LAST_TRY_KEY = "toncrime_auth_last_try_v1";
const AUTH_LAST_IDENTITY_KEY = "toncrime_auth_last_identity_v1";
const AUTH_PATCH_VERSION_KEY = "toncrime_auth_patch_version_v1";
const AUTH_PATCH_VERSION = "2026-04-01-secure-backend-session-1";
const SINGLE_SESSION_DEVICE_KEY = "toncrime_device_instance_id_v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
window.supabase = supabase;
window.tcSupabase = supabase;

function safeLocalGet(key) {
  try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
}
function safeLocalSet(key, value) {
  try { localStorage.setItem(key, String(value ?? "")); } catch {}
}
function safeLocalRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}
function safeLocalKeys() {
  try { return Object.keys(localStorage || {}); } catch { return []; }
}
function nowMs() { return Date.now(); }

function getTelegramUser() {
  try { return window.Telegram?.WebApp?.initDataUnsafe?.user || null; } catch { return null; }
}
export function getTelegramInitData() {
  try { return String(window.Telegram?.WebApp?.initData || "").trim(); } catch { return ""; }
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

export function getProfileKey(store = null) {
  const fromStore = String(store?.get?.()?.player?.telegramId || window.tcStore?.get?.()?.player?.telegramId || "").trim();
  if (fromStore) {
    if (!getTelegramUser()?.id) safeLocalSet(PROFILE_KEY_STORAGE, fromStore);
    return fromStore;
  }

  const tgId = String(getTelegramUser()?.id || "").trim();
  if (tgId) return tgId;

  let profileKey = safeLocalGet(PROFILE_KEY_STORAGE).trim();
  if (!profileKey) {
    const authKey = safeLocalGet(GUEST_IDENTITY_KEY).trim();
    profileKey = authKey || `guest_${makeRandomId()}`;
    safeLocalSet(PROFILE_KEY_STORAGE, profileKey);
  }
  return profileKey;
}

export function ensureGuestIdentitySync(store = null) {
  const tgUser = getTelegramUser();
  if (tgUser?.id) return `tg_${String(tgUser.id)}`;

  const profileKey = getProfileKey(store);
  const authKey = safeLocalGet(GUEST_IDENTITY_KEY).trim();
  if (!authKey) safeLocalSet(GUEST_IDENTITY_KEY, profileKey);
  if (!safeLocalGet(PROFILE_KEY_STORAGE).trim()) safeLocalSet(PROFILE_KEY_STORAGE, profileKey);
  return authKey || profileKey;
}

export function getIdentityKey() {
  const tgUser = getTelegramUser();
  if (tgUser?.id) return `tg_${String(tgUser.id)}`;

  const authKey = safeLocalGet(GUEST_IDENTITY_KEY).trim();
  if (authKey) return authKey;

  const profileKey = getProfileKey();
  safeLocalSet(GUEST_IDENTITY_KEY, profileKey);
  return profileKey;
}

function getIdentityCandidates() {
  const tgUser = getTelegramUser();
  if (tgUser?.id) return [`tg_${String(tgUser.id)}`];

  const out = [];
  const authKey = safeLocalGet(GUEST_IDENTITY_KEY).trim();
  const profileKey = safeLocalGet(PROFILE_KEY_STORAGE).trim();
  const current = getProfileKey();
  for (const item of [authKey, profileKey, current]) {
    const val = String(item || "").trim();
    if (val && !out.includes(val)) out.push(val);
  }
  if (!out.length) out.push(`guest_${makeRandomId()}`);
  return out;
}

export function getBackendCandidates() {
  const raw = [
    window.TONCRIME_BACKEND_URL,
    window.__TONCRIME_BACKEND_URL__,
    safeLocalGet("toncrime_backend_url"),
    safeLocalGet("backendUrl"),
    "https://toncrime.onrender.com",
  ];

  const out = [];
  for (const item of raw) {
    const value = String(item || "").trim().replace(/\/$/, "");
    if (!value || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

export function withTelegramInitDataHeaders(headers = {}) {
  const initData = getTelegramInitData();
  return initData
    ? { ...headers, "X-Telegram-Init-Data": initData }
    : { ...headers };
}

export async function fetchBackendJson(path, options = {}) {
  let lastErr = null;

  for (const base of getBackendCandidates()) {
    const url = `${base}${path}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers: withTelegramInitDataHeaders({
          "Content-Type": "application/json",
          ...(options.headers || {}),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        lastErr = new Error(json?.error || `HTTP ${res.status}`);
        continue;
      }

      return json;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("backend unavailable");
}

function getAuthCooldownUntil() {
  return Number(safeLocalGet(AUTH_COOLDOWN_UNTIL_KEY) || 0);
}
function setAuthCooldown(ms, reason = "auth temporarily disabled") {
  const until = nowMs() + Math.max(1000, Number(ms || 0));
  safeLocalSet(AUTH_COOLDOWN_UNTIL_KEY, until);
  safeLocalSet(AUTH_COOLDOWN_REASON_KEY, String(reason || ""));
  return until;
}
function clearAuthCooldown(reason = "") {
  safeLocalRemove(AUTH_COOLDOWN_UNTIL_KEY);
  safeLocalRemove(AUTH_COOLDOWN_REASON_KEY);
  safeLocalRemove(AUTH_LAST_TRY_KEY);
  if (reason) safeLocalSet("toncrime_auth_cooldown_cleared_reason_v1", reason);
}
export function tcClearAuthCooldown(reason = "manual") {
  clearAuthCooldown(reason);
  return true;
}

function clearPersistedSupabaseAuthKeys() {
  for (const key of safeLocalKeys()) {
    const text = String(key || "").trim();
    if (!text) continue;
    if (
      text.startsWith("sb-") ||
      text.includes("-auth-token") ||
      text.startsWith("supabase.auth.")
    ) {
      safeLocalRemove(text);
    }
  }
}

export function clearLocalProfileMemory({ keepBackendUrl = true } = {}) {
  const keys = [
    STORE_KEY,
    PROFILE_KEY_STORAGE,
    GUEST_IDENTITY_KEY,
    AUTH_COOLDOWN_UNTIL_KEY,
    AUTH_COOLDOWN_REASON_KEY,
    AUTH_LAST_TRY_KEY,
    AUTH_LAST_IDENTITY_KEY,
    AUTH_PATCH_VERSION_KEY,
    SINGLE_SESSION_DEVICE_KEY,
  ];
  for (const key of keys) safeLocalRemove(key);
  if (!keepBackendUrl) {
    safeLocalRemove("toncrime_backend_url");
    safeLocalRemove("backendUrl");
  }
  clearPersistedSupabaseAuthKeys();
  return true;
}

export async function forgetCurrentProfile({ reload = false, keepBackendUrl = true } = {}) {
  const profileKey = String(getProfileKey(window.tcStore) || "").trim();
  const identityKey = String(getIdentityKey() || profileKey).trim();
  const username = String(
    getTelegramUser()?.username ||
    window.tcStore?.get?.()?.player?.username ||
    "Player"
  ).trim() || "Player";

  const result = await fetchBackendJson("/public/profile-reset", {
    method: "POST",
    body: JSON.stringify({
      identity_key: identityKey,
      profile_key: profileKey,
      telegram_id: String(getTelegramUser()?.id || profileKey).trim(),
      username,
    }),
  });

  try {
    await supabase.auth.signOut();
  } catch {}

  clearLocalProfileMemory({ keepBackendUrl });
  if (reload) {
    window.location.reload();
  }
  return result;
}

function isRateLimitError(err) {
  const msg = String(err?.message || err?.error_description || err?.name || "").toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  return status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("email rate limit exceeded");
}
function isAnonymousDisabledError(err) {
  const msg = String(err?.message || err?.error_description || "").toLowerCase();
  return msg.includes("anonymous") && (msg.includes("disabled") || msg.includes("not enabled") || msg.includes("not allowed"));
}

let authPromise = null;
let authWarned = false;
function warnOnce(...args) {
  if (authWarned) return;
  authWarned = true;
  console.warn(...args);
}

function applyPatchReset() {
  const current = safeLocalGet(AUTH_PATCH_VERSION_KEY);
  if (current === AUTH_PATCH_VERSION) return;
  safeLocalSet(AUTH_PATCH_VERSION_KEY, AUTH_PATCH_VERSION);
  clearAuthCooldown("patch_reset");
}
applyPatchReset();

function canAttemptNow(identityKey) {
  const lastIdentity = safeLocalGet(AUTH_LAST_IDENTITY_KEY);
  if (lastIdentity !== identityKey) {
    safeLocalSet(AUTH_LAST_IDENTITY_KEY, identityKey);
    clearAuthCooldown("identity_changed");
  }

  const cooldownUntil = getAuthCooldownUntil();
  if (cooldownUntil > nowMs()) return false;

  const last = Number(safeLocalGet(AUTH_LAST_TRY_KEY) || 0);
  if (last && nowMs() - last < 5000) return false;

  safeLocalSet(AUTH_LAST_TRY_KEY, nowMs());
  return true;
}

function rememberSuccessfulIdentity(identityKey) {
  if (!identityKey || getTelegramUser()?.id) return;
  safeLocalSet(GUEST_IDENTITY_KEY, identityKey);
  if (!safeLocalGet(PROFILE_KEY_STORAGE).trim()) safeLocalSet(PROFILE_KEY_STORAGE, identityKey);
}

async function tryAnonymousAuth(identityKey) {
  if (typeof supabase?.auth?.signInAnonymously !== "function") return null;
  try {
    const res = await supabase.auth.signInAnonymously({
      options: {
        data: {
          identity_key: identityKey,
          username: String(getTelegramUser()?.username || window.tcStore?.get?.()?.player?.username || "Player").trim() || "Player",
        },
      },
    });

    if (!res?.error && res?.data?.user) {
      clearAuthCooldown("anon_success");
      rememberSuccessfulIdentity(identityKey);
      return res.data.user;
    }
    if (isRateLimitError(res?.error)) {
      setAuthCooldown(10 * 60 * 1000, res?.error?.message || "Anonymous auth rate limited");
      warnOnce("[AUTH] anonymous sign-in rate limited:", res.error);
      return null;
    }
    if (isAnonymousDisabledError(res?.error)) {
      setAuthCooldown(10 * 60 * 1000, res?.error?.message || "Anonymous auth disabled");
      warnOnce("[AUTH] anonymous auth disabled in Supabase. Enable Anonymous provider.");
      return null;
    }
    if (res?.error) {
      setAuthCooldown(2 * 60 * 1000, res?.error?.message || "Anonymous auth failed");
      warnOnce("[AUTH] anonymous sign-in failed:", res.error);
      return null;
    }
  } catch (err) {
    if (isRateLimitError(err)) {
      setAuthCooldown(10 * 60 * 1000, err?.message || "Anonymous auth rate limited");
      warnOnce("[AUTH] anonymous sign-in rate limited:", err);
      return null;
    }
    if (isAnonymousDisabledError(err)) {
      setAuthCooldown(10 * 60 * 1000, err?.message || "Anonymous auth disabled");
      warnOnce("[AUTH] anonymous auth disabled in Supabase. Enable Anonymous provider.");
      return null;
    }
    setAuthCooldown(2 * 60 * 1000, err?.message || "Anonymous auth fatal");
    warnOnce("[AUTH] anonymous sign-in fatal:", err);
  }
  return null;
}

async function tryBackendSessionAuth(identityKey) {
  if (!identityKey) return null;

  try {
    const username =
      String(
        getTelegramUser()?.username ||
        window.tcStore?.get?.()?.player?.username ||
        "Player"
      ).trim() || "Player";

    const ensured = await fetchBackendJson("/public/auth/session", {
      method: "POST",
      body: JSON.stringify({
        identity_key: identityKey,
        profile_key: getProfileKey(),
        username,
      }),
    });

    const accessToken = String(ensured?.session?.access_token || "").trim();
    const refreshToken = String(ensured?.session?.refresh_token || "").trim();
    if (!accessToken || !refreshToken) return null;

    const res = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (res?.error) {
      warnOnce("[AUTH] backend session set failed:", res.error);
      return null;
    }

    const sessionUser = res?.data?.user || res?.data?.session?.user || null;
    if (sessionUser?.id) {
      clearAuthCooldown("backend_auth_success");
      rememberSuccessfulIdentity(identityKey);
      return sessionUser;
    }
  } catch (err) {
    warnOnce("[AUTH] backend session auth unavailable:", err);
  }

  return null;
}

export async function ensureAuthSession() {
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const sessionRes = await supabase.auth.getSession().catch(() => null);
      const sessionUser = sessionRes?.data?.session?.user || null;
      if (sessionUser) {
        clearAuthCooldown("session_exists");
        return sessionUser;
      }

      const userRes = await supabase.auth.getUser().catch(() => null);
      const authUser = userRes?.data?.user || null;
      if (authUser) {
        clearAuthCooldown("user_exists");
        return authUser;
      }
    } catch {}

    const candidates = getIdentityCandidates();
    const primaryIdentity = candidates[0] || getIdentityKey();
    if (!canAttemptNow(primaryIdentity)) return null;

    for (const identityKey of candidates) {
      const anonUser = await tryAnonymousAuth(identityKey);
      if (anonUser?.id) return anonUser;
    }

    for (const identityKey of candidates) {
      const backendUser = await tryBackendSessionAuth(identityKey);
      if (backendUser?.id) return backendUser;
    }

    return null;
  })().finally(() => {
    authPromise = null;
  });

  return authPromise;
}

export async function waitForAuthSession(timeoutMs = 8000) {
  const started = nowMs();
  while (nowMs() - started < Math.max(1000, Number(timeoutMs || 0))) {
    const sessionRes = await supabase.auth.getSession().catch(() => null);
    const sessionUser = sessionRes?.data?.session?.user || null;
    if (sessionUser?.id) return sessionUser;

    const userRes = await supabase.auth.getUser().catch(() => null);
    const authUser = userRes?.data?.user || null;
    if (authUser?.id) return authUser;

    const ensured = await ensureAuthSession().catch(() => null);
    if (ensured?.id) return ensured;

    await new Promise((r) => setTimeout(r, 350));
  }
  return null;
}

export async function bindProfileToCurrentAuth(profileKey = "") {
  const key = String(profileKey || getProfileKey()).trim();
  if (!key) return { ok: false, reason: "missing_profile_key" };

  const user = await ensureAuthSession().catch(() => null);
  if (!user) return { ok: false, reason: "missing_auth" };

  const res = await supabase.rpc("bind_profile_to_current_auth", {
    p_profile_key: key,
  });

  if (res?.error) {
    console.warn("[PROFILE_BIND] failed:", res.error);
    return { ok: false, error: res.error };
  }
  return { ok: true, data: res?.data || null };
}

window.tcEnsureAuthSession = ensureAuthSession;
window.tcWaitForAuthSession = waitForAuthSession;
window.tcGetIdentityKey = getIdentityKey;
window.tcGetProfileKey = getProfileKey;
window.tcBindProfileToCurrentAuth = bindProfileToCurrentAuth;
window.tcClearAuthCooldown = tcClearAuthCooldown;
window.tcGetTelegramInitData = getTelegramInitData;
window.tcGetBackendCandidates = getBackendCandidates;
window.tcFetchBackendJson = fetchBackendJson;
window.tcClearLocalProfileMemory = clearLocalProfileMemory;
window.tcForgetCurrentProfile = forgetCurrentProfile;

try {
  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id || "";
    if (userId) {
      clearAuthCooldown(`auth_event_${event || 'unknown'}`);
      try { window.dispatchEvent(new CustomEvent("tc:profile-sync-now")); } catch {}
    }
  });
} catch {}

try {
  if (document.visibilityState === "visible") ensureAuthSession().catch(() => null);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ensureAuthSession().catch(() => null);
  });
  window.addEventListener("focus", () => ensureAuthSession().catch(() => null));
  setTimeout(() => ensureAuthSession().catch(() => null), 600);
} catch {}
