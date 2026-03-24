import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";
const GUEST_IDENTITY_KEY = "toncrime_guest_identity_v3";

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

let authPromise = null;
let authWarned = false;

export async function ensureAuthSession() {
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) return data.session.user;
    } catch {}

    const identityKey = getIdentityKey();
    const email = buildIdentityEmail(identityKey);
    const password = buildIdentityPassword(identityKey);

    let signInRes = null;
    try {
      signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (!signInRes.error && signInRes.data?.user) return signInRes.data.user;
    } catch {}

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
        if (signUpRes.data.session?.user) return signUpRes.data.session.user;
        const signInAgain = await supabase.auth.signInWithPassword({ email, password });
        if (!signInAgain.error && signInAgain.data?.user) return signInAgain.data.user;
      }

      if (signUpRes.error && !authWarned) {
        authWarned = true;
        console.warn("[AUTH] signUp failed:", signUpRes.error);
      }
    } catch (err) {
      if (!authWarned) {
        authWarned = true;
        console.warn("[AUTH] signUp fatal:", err);
      }
    }

    if (signInRes?.error && !authWarned) {
      authWarned = true;
      console.warn("[AUTH] signInWithPassword failed:", signInRes.error);
    }

    return null;
  })().finally(() => {
    authPromise = null;
  });

  return authPromise;
}

window.tcEnsureAuthSession = ensureAuthSession;
window.tcGetIdentityKey = getIdentityKey;
