import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ubcyamjoektbbxbrjtyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_t--0L9Neb58SKtiED8K7gA_2w1gtC37";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("SUPABASE_URL =", SUPABASE_URL);
console.log("SUPABASE_KEY_START =", SUPABASE_KEY.slice(0, 20));
