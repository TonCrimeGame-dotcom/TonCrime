import { supabase } from "./supabase.js";

let tcPvpRealtimeChannel = null;
let tcPvpFallbackTimer = null;
let tcPvpMatchStarted = false;

export async function startRealtimeMatchmaking({
  user,
  player,
  mode,
  onSearching,
  onMatchFound,
  onError,
  fallbackMs = 10000,
}) {
  try {
    tcPvpMatchStarted = false;
    cleanupRealtimeMatchmaking();

    if (!user?.id) {
      throw new Error("user.id yok");
    }

    const username =
      String(
        player?.username ||
          player?.name ||
          "Player"
      ).trim() || "Player";

    const level = Math.max(1, Number(player?.level || 1));
    const rank = Math.max(100, Number(player?.rank || 1000));

    if (typeof onSearching === "function") {
      onSearching();
    }

    // 1) Kuyruğa gir
    const { error: queueError } = await supabase
      .from("pvp_match_queue")
      .upsert(
        {
          user_id: user.id,
          username,
          level,
          rank,
          game_mode: mode,
          status: "searching",
          is_bot: false,
          matched_with: null,
          match_id: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,game_mode",
        }
      );

    if (queueError) {
      throw queueError;
    }

    // 2) Realtime ile maç tablosunu dinle
    tcPvpRealtimeChannel = supabase
      .channel(`pvp-match-${user.id}-${mode}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pvp_matches",
          filter: `player1_id=eq.${user.id}`,
        },
        (payload) => {
          if (tcPvpMatchStarted) return;
          tcPvpMatchStarted = true;
          cleanupRealtimeMatchmaking();

          const match = payload.new;
          const opponent = buildOpponentFromMatch(match, user.id);

          if (typeof onMatchFound === "function") {
            onMatchFound(match, opponent);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pvp_matches",
          filter: `player2_id=eq.${user.id}`,
        },
        (payload) => {
          if (tcPvpMatchStarted) return;
          tcPvpMatchStarted = true;
          cleanupRealtimeMatchmaking();

          const match = payload.new;
          const opponent = buildOpponentFromMatch(match, user.id);

          if (typeof onMatchFound === "function") {
            onMatchFound(match, opponent);
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          if (typeof onError === "function") {
            onError(new Error("Realtime channel error"));
          } else {
            console.error("[PVP] realtime channel error");
          }
        }
      });

    // 3) Bir kez gerçek ranked eşleşme dene
    const { error: rankedError } = await supabase.rpc("try_ranked_pvp_match", {
      p_user_id: user.id,
      p_mode: mode,
    });

    if (rankedError) {
      console.error("[PVP] try_ranked_pvp_match error:", rankedError);
    }

    // 4) 10 sn sonra bot fallback
    tcPvpFallbackTimer = setTimeout(async () => {
      if (tcPvpMatchStarted) return;

      const { error: botError } = await supabase.rpc("create_bot_pvp_match", {
        p_user_id: user.id,
        p_mode: mode,
      });

      if (botError) {
        console.error("[PVP] create_bot_pvp_match error:", botError);
        if (typeof onError === "function") {
          onError(botError);
        }
      }
    }, fallbackMs);
  } catch (err) {
    cleanupRealtimeMatchmaking();
    if (typeof onError === "function") {
      onError(err);
    } else {
      console.error("[PVP] matchmaking fatal:", err);
    }
  }
}

export async function cancelRealtimeMatchmaking({ user, mode }) {
  cleanupRealtimeMatchmaking();

  if (!user?.id || !mode) return;

  const { error } = await supabase
    .from("pvp_match_queue")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("game_mode", mode)
    .eq("status", "searching");

  if (error) {
    console.error("[PVP] cancelRealtimeMatchmaking error:", error);
  }
}

export function cleanupRealtimeMatchmaking() {
  if (tcPvpFallbackTimer) {
    clearTimeout(tcPvpFallbackTimer);
    tcPvpFallbackTimer = null;
  }

  if (tcPvpRealtimeChannel) {
    supabase.removeChannel(tcPvpRealtimeChannel);
    tcPvpRealtimeChannel = null;
  }
}

export function buildOpponentFromMatch(match, userId) {
  const amIPlayer1 = match.player1_id === userId;

  return {
    id: amIPlayer1 ? match.player2_id : match.player1_id,
    username: amIPlayer1 ? match.player2_username : match.player1_username,
    level: amIPlayer1 ? match.player2_level : match.player1_level,
    rank: amIPlayer1 ? match.player2_rank : match.player1_rank,
    isBot: !!match.is_bot_match,
  };
}
