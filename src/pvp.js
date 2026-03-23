
import { supabase } from "./supabase.js";

export async function enterMatchmaking(mode, stake) {
  const { data, error } = await supabase.rpc("enqueue_ranked_pvp", {
    p_mode: mode,
    p_stake_yton: stake,
  });

  if (error) {
    console.error("queue error:", error);
    return null;
  }

  console.log("queue ok:", data);
  return data;
}

export async function cancelMatchmaking(mode, stake) {
  const { error } = await supabase.rpc("cancel_ranked_pvp", {
    p_mode: mode,
    p_stake_yton: stake,
  });

  if (error) console.error("cancel error:", error);
}

export async function tryMatch(mode, onMatch) {
  const userRes = await supabase.auth.getUser();
  const user = userRes.data.user;

  const { data, error } = await supabase.rpc("try_ranked_pvp_match", {
    p_user_id: user.id,
    p_mode: mode,
  });

  if (error) {
    console.error("match error:", error);
    return;
  }

  if (data?.ok && data.match_id) {
    console.log("MATCH FOUND:", data);
    onMatch?.(data);
  }
}

export async function finishMatch(matchId, winnerId) {
  const { data, error } = await supabase.rpc("finish_pvp_match", {
    p_match_id: matchId,
    p_winner_user_id: winnerId,
  });

  if (error) {
    console.error("finish error:", error);
    return;
  }

  console.log("match finished:", data);
}
