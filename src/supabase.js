import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "BURAYA_PROJECT_URL";
const SUPABASE_KEY = "BURAYA_PUBLISHABLE_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
