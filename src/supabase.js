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

bindGlobals();

export async function ensureAuthSession() {
  bindGlobals();

  try {
    const { data } = await supabase.auth.getSession();
    const existing = data?.session?.user || null;
    if (existing) return existing;
  } catch (_) {}

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    bindGlobals();
    return data?.user || data?.session?.user || null;
  } catch (err) {
    console.warn("[AUTH] anonymous sign-in failed:", err);
    return null;
  }
}
 
