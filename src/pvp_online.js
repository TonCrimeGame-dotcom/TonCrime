(function () {
  let matchmakingInterval = null;
  let activeRequestKey = null;
  let activeChannel = null;

  function getSupabase() {
    return window.supabase || window.tcSupabase || null;
  }

  async function ensureUser() {
    try {
      await window.tcEnsureAuthSession?.();
    } catch (_) {}

    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  }

  function normalizeRpcPayload(payload) {
    if (Array.isArray(payload)) return payload[0] || null;
    return payload || null;
  }

  function pickOpponent(match, userId) {
    if (!match) return { username: "Rakip", isBot: false };

    const p1 = String(match.player1_id || "");
    const p2 = String(match.player2_id || "");

    if (p1 && p1 === userId) {
      return {
        username: String(match.player2_username || "Rakip"),
        isBot: !!match.is_bot_match,
      };
    }

    return {
      username: String(match.player1_username || "Rakip"),
      isBot: !!match.is_bot_match,
    };
  }

  async function resolveRpcMatch(userId, mode, stake, payload) {
    const supabase = getSupabase();
    const rpc = normalizeRpcPayload(payload);
    if (!rpc || !supabase) return null;

    const hasMatchSignal =
      rpc.ok === true ||
      rpc.status === "matched" ||
      !!(rpc.match || rpc.match_id || rpc.matchId || rpc.id);

    if (!hasMatchSignal) return null;

    if (rpc.match?.id) {
      return {
        ...rpc.match,
        opponent: pickOpponent(rpc.match, userId),
      };
    }

    const matchId = rpc.match_id || rpc.matchId || rpc.id || null;
    if (!matchId) return null;

    try {
      const { data: matchRow } = await supabase
        .from("pvp_matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();

      if (matchRow?.id) {
        return {
          ...matchRow,
          opponent: pickOpponent(matchRow, userId),
        };
      }
    } catch (_) {}

    const partial = {
      id: matchId,
      game_mode: mode,
      stake_yton: stake,
      player1_id: rpc.player1_id || rpc.player1Id || null,
      player2_id: rpc.player2_id || rpc.player2Id || null,
      player1_username: rpc.player1_username || rpc.player1Username || null,
      player2_username: rpc.player2_username || rpc.player2Username || null,
      is_bot_match: !!(rpc.is_bot_match ?? rpc.isBotMatch),
    };

    return {
      ...partial,
      opponent: pickOpponent(partial, userId),
    };
  }

  function clearActiveListeners() {
    if (matchmakingInterval) {
      clearInterval(matchmakingInterval);
      matchmakingInterval = null;
    }
    try {
      activeChannel?.unsubscribe?.();
    } catch (_) {}
    activeChannel = null;
  }

  async function startPvPMatchmaking(mode, stake, onMatch) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase bulunamadı");

    const user = await ensureUser();
    if (!user?.id) throw new Error("Auth kullanıcı bulunamadı");

    clearActiveListeners();
    activeRequestKey = `${user.id}:${mode}:${stake}`;

    const { data: queueData, error } = await supabase.rpc("enqueue_ranked_pvp", {
      p_mode: mode,
      p_stake_yton: stake,
    });

    if (error) throw error;

    const instantMatch = await resolveRpcMatch(user.id, mode, stake, queueData);
    if (instantMatch) {
      onMatch?.(instantMatch);
      return instantMatch;
    }

    activeChannel = supabase
      .channel(`toncrime-pvp-match-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pvp_matches" },
        (payload) => {
          const row = payload?.new || payload?.old;
          if (!row?.id) return;
          const p1 = String(row.player1_id || "");
          const p2 = String(row.player2_id || "");
          if (p1 !== user.id && p2 !== user.id) return;
          if (activeRequestKey !== `${user.id}:${mode}:${stake}`) return;
          clearActiveListeners();
          onMatch?.({ ...row, opponent: pickOpponent(row, user.id) });
        }
      )
      .subscribe();

    matchmakingInterval = setInterval(async () => {
      try {
        const { data, error: tryError } = await supabase.rpc("try_ranked_pvp_match", {
          p_user_id: user.id,
          p_mode: mode,
        });

        if (tryError) {
          console.error("[PVP_ONLINE] try_ranked_pvp_match error:", tryError);
          return;
        }

        const match = await resolveRpcMatch(user.id, mode, stake, data);
        if (!match) return;
        if (activeRequestKey !== `${user.id}:${mode}:${stake}`) return;

        clearActiveListeners();
        onMatch?.(match);
      } catch (err) {
        console.error("[PVP_ONLINE] matchmaking poll error:", err);
      }
    }, 1000);

    return null;
  }

  async function cancelPvPMatchmaking(mode, stake) {
    const supabase = getSupabase();
    const user = await ensureUser();
    activeRequestKey = null;
    clearActiveListeners();

    if (!supabase || !user?.id) return;

    try {
      await supabase.rpc("cancel_ranked_pvp", {
        p_mode: mode,
        p_stake_yton: stake,
      });
    } catch (err) {
      console.error("[PVP_ONLINE] cancel error:", err);
    }
  }

  window.TonCrimePvPOnline = {
    startMatchmaking: startPvPMatchmaking,
    cancelMatchmaking: cancelPvPMatchmaking,
  };
})();
