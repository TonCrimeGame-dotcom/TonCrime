import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://BURAYA-PROJE-REF.supabase.co";
const SUPABASE_KEY = "BURAYA_PUBLISHABLE_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
