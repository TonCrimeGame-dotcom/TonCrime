import { supabase } from "./supabase.js";

let matchmakingInterval = null;

export async function startPvPMatchmaking(mode, stake, onMatch) {
  const user = (await supabase.auth.getUser()).data.user;

  // queue giriş (bahisli)
  const { error } = await supabase.rpc("enqueue_ranked_pvp", {
    p_mode: mode,
    p_stake_yton: stake,
  });

  if (error) {
    console.error("queue error:", error);
    return;
  }

  console.log("matchmaking başladı");

  matchmakingInterval = setInterval(async () => {
    const { data } = await supabase.rpc("try_ranked_pvp_match", {
      p_user_id: user.id,
      p_mode: mode,
    });

    if (data?.ok && data.match_id) {
      clearInterval(matchmakingInterval);
      console.log("MATCH:", data);

      onMatch(data);
    }
  }, 1500);
}

export async function cancelPvPMatchmaking(mode, stake) {
  clearInterval(matchmakingInterval);

  await supabase.rpc("cancel_ranked_pvp", {
    p_mode: mode,
    p_stake_yton: stake,
  });
}
