import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

function bindGlobals() {
  try { window.supabase = supabase; } catch (_) {}
  try { window.tcSupabase = supabase; } catch (_) {}
  try { window.__tcSupabase = supabase; } catch (_) {}
}

function anonAuthEnabled() {
  try {
    if (window.__TONCRIME_ENABLE_ANON_AUTH === true) return true;
  } catch (_) {}
  try {
    return localStorage.getItem("toncrime_enable_anon_auth") === "1";
  } catch (_) {
    return false;
  }
}

bindGlobals();

export async function ensureAuthSession(options = {}) {
  bindGlobals();

  try {
    const { data } = await supabase.auth.getSession();
    const existing = data?.session?.user || null;
    if (existing) return existing;
  } catch (_) {}

  const allowAnonymous = options?.allowAnonymous === true || anonAuthEnabled();
  if (!allowAnonymous) return null;

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    bindGlobals();
    return data?.user || data?.session?.user || null;
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.toLowerCase().includes("anonymous sign-ins are disabled")) {
      try { window.__tcAnonAuthUnavailable = true; } catch (_) {}
      return null;
    }
    console.warn("[AUTH] anonymous sign-in failed:", err);
    return null;
  }
}
