import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";
const BACKEND_BASE_DEFAULT = "https://toncrime.onrender.com";
const GUEST_IDENTITY_KEY = "toncrime_guest_identity_v2";

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

export function buildIdentityEmail(identityKey = getIdentityKey()) {
  return `${sanitizeIdentityKey(identityKey)}@toncrime.local`;
}

export function buildIdentityPassword(identityKey = getIdentityKey()) {
  const safe = sanitizeIdentityKey(identityKey);
  return `TonCrime_${safe}_Auth!2026`.slice(0, 64);
}

export function getBackendBase() {
  try {
    const injected = window.__TONCRIME_BACKEND__;
    if (typeof injected === "string" && injected.trim()) return injected.trim().replace(/\/$/, "");
    const stored = localStorage.getItem("toncrime_backend_url");
    if (stored && stored.trim()) return stored.trim().replace(/\/$/, "");
  } catch {}
  return BACKEND_BASE_DEFAULT;
}

async function ensureIdentityUserOnBackend(identityKey) {
  const res = await fetch(`${getBackendBase()}/public/ensure-auth-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity_key: identityKey,
      username: String(getTelegramUser()?.username || "Player"),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `ensure-auth-user failed (${res.status})`);
  }

  return await res.json().catch(() => ({ ok: true }));
}

let authPromise = null;
let authLoggedOnce = false;

export async function ensureAuthSession() {
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) return sessionData.session.user;
    } catch {}

    const identityKey = getIdentityKey();
    const email = buildIdentityEmail(identityKey);
    const password = buildIdentityPassword(identityKey);

    let login = await supabase.auth.signInWithPassword({ email, password });
    if (!login.error && login.data?.user) return login.data.user;

    try {
      await ensureIdentityUserOnBackend(identityKey);
    } catch (err) {
      if (!authLoggedOnce) {
        authLoggedOnce = true;
        console.warn("[AUTH] backend identity ensure failed:", err?.message || err);
      }
      return null;
    }

    login = await supabase.auth.signInWithPassword({ email, password });
    if (login.error) {
      if (!authLoggedOnce) {
        authLoggedOnce = true;
        console.warn("[AUTH] signInWithPassword failed:", login.error);
      }
      return null;
    }

    return login.data?.user || null;
  })().finally(() => {
    authPromise = null;
  });

  return authPromise;
}

let backendUnavailable = false;

export async function backendFetchJson(path, options = {}) {
  if (backendUnavailable) {
    throw new Error("Backend unavailable");
  }

  const url = `${getBackendBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if ([401, 403, 404, 405].includes(res.status)) {
      backendUnavailable = true;
    }
    throw new Error(text || `${res.status} ${res.statusText}`);
  }

  return await res.json();
}

export async function syncProfileToBackend(payload) {
  return await backendFetchJson("/public/profile-sync", {
    method: "POST",
    body: {
      identity_key: getIdentityKey(),
      ...payload,
    },
  });
}

window.tcEnsureAuthSession = ensureAuthSession;
window.tcGetIdentityKey = getIdentityKey;
window.tcBackendFetchJson = backendFetchJson;
