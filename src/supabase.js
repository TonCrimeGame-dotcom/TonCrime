import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://SENIN-PROJE-REF.supabase.co";
const SUPABASE_KEY = "SENIN_PUBLISHABLE_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("SUPABASE_URL =", SUPABASE_URL);
console.log("SUPABASE_KEY_START =", SUPABASE_KEY.slice(0, 20));
