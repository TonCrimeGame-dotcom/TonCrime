import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";
const PROFILE_KEY_STORAGE = "toncrime_profile_key_v1";
const GUEST_IDENTITY_KEY = "toncrime_guest_identity_v4";
const AUTH_COOLDOWN_UNTIL_KEY = "toncrime_auth_cooldown_until_v2";
const AUTH_COOLDOWN_REASON_KEY = "toncrime_auth_cooldown_reason_v2";
const AUTH_LAST_TRY_KEY = "toncrime_auth_last_try_v1";
const AUTH_LAST_IDENTITY_KEY = "toncrime_auth_last_identity_v1";
const AUTH_ANON_DISABLED_KEY = "toncrime_auth_anon_disabled_v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;
window.tcSupabase = supabase;

function safeLocalGet(key) {
  try {
    return String(localStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ""));
  } catch {}
}

function safeLocalRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

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

export function getProfileKey(store = null) {
  const fromStore = String(store?.get?.()?.player?.telegramId || window.tcStore?.get?.()?.player?.telegramId || "").trim();
  if (fromStore) {
    if (!getTelegramUser()?.id) safeLocalSet(PROFILE_KEY_STORAGE, fromStore);
    return fromStore;
  }

  const tgUser = getTelegramUser();
  const tgId = String(tgUser?.id || "").trim();
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

  const authKey = safeLocalGet(GUEST_IDENTITY_KEY).trim();
  const profileKey = getProfileKey();
  const list = [];

  if (authKey) list.push(authKey);
  if (profileKey && profileKey !== authKey) list.push(profileKey);
  if (!list.length) {
    const created = `guest_${makeRandomId()}`;
    safeLocalSet(PROFILE_KEY_STORAGE, created);
    safeLocalSet(GUEST_IDENTITY_KEY, created);
    list.push(created);
  }

  return list;
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
  return Number(safeLocalGet(AUTH_COOLDOWN_UNTIL_KEY) || 0);
}

function setAuthCooldown(ms, reason = "auth temporarily disabled") {
  const until = nowMs() + Math.max(1000, Number(ms || 0));
  safeLocalSet(AUTH_COOLDOWN_UNTIL_KEY, until);
  safeLocalSet(AUTH_COOLDOWN_REASON_KEY, String(reason || ""));
  return until;
}

function clearAuthCooldown() {
  safeLocalRemove(AUTH_COOLDOWN_UNTIL_KEY);
  safeLocalRemove(AUTH_COOLDOWN_REASON_KEY);
}

function isRateLimitError(err) {
  const msg = String(err?.message || err?.error_description || err?.name || "").toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  return status === 429 || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("email rate limit exceeded");
}

function isEmailDisabledError(err) {
  const msg = String(err?.message || err?.error_description || "").toLowerCase();
  return msg.includes("email") && (msg.includes("disabled") || msg.includes("not allowed"));
}

function isInvalidCredentialsError(err) {
  const msg = String(err?.message || err?.error_description || "").toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  return status === 400 || msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("email not confirmed") || msg.includes("user not found");
}

function isAnonymousDisabledError(err) {
  const msg = String(err?.message || err?.error_description || "").toLowerCase();
  return msg.includes("anonymous") && (msg.includes("disabled") || msg.includes("not enabled") || msg.includes("not allowed"));
}

async function tryAnonymousAuth() {
  if (safeLocalGet(AUTH_ANON_DISABLED_KEY) === "1") return null;
  if (typeof supabase?.auth?.signInAnonymously !== "function") {
    safeLocalSet(AUTH_ANON_DISABLED_KEY, "1");
    return null;
  }

  try {
    const res = await supabase.auth.signInAnonymously({
      options: {
        data: {
          identity_key: getIdentityKey(),
          username: getPreferredUsername(),
        },
      },
    });

    if (!res?.error && res?.data?.user) {
      clearAuthCooldown();
      return res.data.user;
    }

    if (isRateLimitError(res?.error)) {
      setAuthCooldown(5 * 60 * 1000, res.error.message || "Anon auth rate limited");
      warnOnce("[AUTH] anonymous sign-in rate limited:", res.error);
      return null;
    }

    if (isAnonymousDisabledError(res?.error)) {
      safeLocalSet(AUTH_ANON_DISABLED_KEY, "1");
      return null;
    }

    if (res?.error) {
      warnOnce("[AUTH] anonymous sign-in failed:", res.error);
    }
  } catch (err) {
    if (isRateLimitError(err)) {
      setAuthCooldown(5 * 60 * 1000, err?.message || "Anon auth rate limited");
      warnOnce("[AUTH] anonymous sign-in rate limited:", err);
      return null;
    }

    if (isAnonymousDisabledError(err)) {
      safeLocalSet(AUTH_ANON_DISABLED_KEY, "1");
      return null;
    }

    warnOnce("[AUTH] anonymous sign-in fatal:", err);
  }

  return null;
}

let authPromise = null;
let authWarned = false;

function warnOnce(...args) {
  if (authWarned) return;
  authWarned = true;
  console.warn(...args);
}

function canAttemptNow(identityKey) {
  const lastIdentity = safeLocalGet(AUTH_LAST_IDENTITY_KEY);
  if (lastIdentity !== identityKey) {
    safeLocalSet(AUTH_LAST_IDENTITY_KEY, identityKey);
  }

  const cooldownUntil = getAuthCooldownUntil();
  if (cooldownUntil > nowMs()) return false;

  const last = Number(safeLocalGet(AUTH_LAST_TRY_KEY) || 0);
  if (last && nowMs() - last < 15000) return false;

  safeLocalSet(AUTH_LAST_TRY_KEY, nowMs());
  return true;
}

function rememberSuccessfulIdentity(identityKey) {
  if (!identityKey || getTelegramUser()?.id) return;
  safeLocalSet(GUEST_IDENTITY_KEY, identityKey);
  if (!safeLocalGet(PROFILE_KEY_STORAGE).trim()) {
    safeLocalSet(PROFILE_KEY_STORAGE, identityKey);
  }
}

function getPreferredUsername() {
  return String(
    getTelegramUser()?.username ||
      window.tcStore?.get?.()?.player?.username ||
      "Player"
  ).trim() || "Player";
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

    const candidates = getIdentityCandidates();
    const primaryIdentity = candidates[0] || getIdentityKey();

    const anonUser = await tryAnonymousAuth();
    if (anonUser?.id) return anonUser;

    if (!canAttemptNow(primaryIdentity)) return null;

    for (const identityKey of candidates) {
      const email = buildIdentityEmail(identityKey);
      const password = buildIdentityPassword(identityKey);

      try {
        const signInRes = await supabase.auth.signInWithPassword({ email, password });
        if (!signInRes.error && signInRes.data?.user) {
          clearAuthCooldown();
          rememberSuccessfulIdentity(identityKey);
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
        if (!isInvalidCredentialsError(err)) {
          warnOnce("[AUTH] signIn error:", err);
        }
      }
    }

    const signupIdentity = getProfileKey() || primaryIdentity;
    if (!signupIdentity) return null;

    if (!getTelegramUser()?.id) {
      safeLocalSet(PROFILE_KEY_STORAGE, signupIdentity);
      safeLocalSet(GUEST_IDENTITY_KEY, signupIdentity);
    }

    const email = buildIdentityEmail(signupIdentity);
    const password = buildIdentityPassword(signupIdentity);

    try {
      const signUpRes = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            identity_key: signupIdentity,
            username: getPreferredUsername(),
          },
        },
      });

      if (!signUpRes.error && signUpRes.data?.user) {
        if (signUpRes.data.session?.user) {
          clearAuthCooldown();
          rememberSuccessfulIdentity(signupIdentity);
          return signUpRes.data.session.user;
        }
        const signInAgain = await supabase.auth.signInWithPassword({ email, password });
        if (!signInAgain.error && signInAgain.data?.user) {
          clearAuthCooldown();
          rememberSuccessfulIdentity(signupIdentity);
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

export async function waitForAuthSession(timeoutMs = 9000) {
  const startedAt = nowMs();

  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) return data.session.user;
  } catch {}

  try {
    const immediate = await ensureAuthSession().catch(() => null);
    if (immediate) return immediate;
  } catch {}

  return await new Promise((resolve) => {
    let done = false;
    let sub = null;

    const finish = async (user = null) => {
      if (done) return;
      done = true;
      try { sub?.data?.subscription?.unsubscribe?.(); } catch {}
      if (user) {
        resolve(user);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        resolve(data?.session?.user || null);
      } catch {
        resolve(null);
      }
    };

    try {
      sub = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user || null;
        if (user) finish(user);
      });
    } catch {}

    const interval = setInterval(async () => {
      if (done) {
        clearInterval(interval);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          clearInterval(interval);
          finish(data.session.user);
          return;
        }
      } catch {}
      if (nowMs() - startedAt > timeoutMs) {
        clearInterval(interval);
        finish(null);
      }
    }, 250);
  });
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
window.tcGetIdentityKey = getIdentityKey;
window.tcGetProfileKey = getProfileKey;
window.tcBindProfileToCurrentAuth = bindProfileToCurrentAuth;
