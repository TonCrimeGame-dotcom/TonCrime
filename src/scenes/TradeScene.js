
// UPDATED TradeScene.js (UUID mapping fix)

import { supabase } from "../supabase.js";

async function resolveBusinessUUID(localBiz, profileId) {
  if (localBiz.dbId) return localBiz.dbId;

  // try find by name + type
  let { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_profile_id", profileId)
    .eq("name", localBiz.name)
    .eq("business_type", localBiz.type)
    .limit(1);

  if (data && data.length) {
    localBiz.dbId = data[0].id;
    return data[0].id;
  }

  // fallback by type
  let res = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_profile_id", profileId)
    .eq("business_type", localBiz.type)
    .limit(1);

  if (res.data && res.data.length) {
    localBiz.dbId = res.data[0].id;
    return res.data[0].id;
  }

  throw new Error("Business UUID not found");
}

export async function createMarketListing({
  profileId,
  localBusiness,
  product_key,
  quantity,
  price
}) {
  const businessUUID = await resolveBusinessUUID(localBusiness, profileId);

  const { data, error } = await supabase.rpc("create_market_listing", {
    p_seller_profile_id: profileId,
    p_business_id: businessUUID,
    p_product_key: product_key,
    p_quantity: quantity,
    p_price_yton: price
  });

  if (error) {
    console.error("create_market_listing error:", error);
    throw error;
  }

  return data;
}
