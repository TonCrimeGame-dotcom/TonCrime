(function () {
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, r, fill) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, w, h, r, stroke, lw) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function drawCoverImage(ctx, img, x, y, w, h, alpha) {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) * 0.5;
    const dy = y + (h - dh) * 0.5;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = prev;
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function getImageFromAssets(assets, key) {
    if (!assets) return null;
    if (typeof assets.get === "function") {
      const a = assets.get(key);
      if (a) return a;
    }
    if (assets[key]) return assets[key];
    if (assets.images && assets.images[key]) return assets.images[key];
    return null;
  }

  function getCanvasCssSize(canvas) {
    const rect = canvas?.getBoundingClientRect?.();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    let w = Math.round(rect?.width || 0);
    let h = Math.round(rect?.height || 0);

    if (!w || !h) {
      w = Math.round((canvas?.width || window.innerWidth) / dpr);
      h = Math.round((canvas?.height || window.innerHeight) / dpr);
    }

    return { w, h };
  }

  function getWalletYton(state = null) {
    return Number(state?.wallet?.yton || 0);
  }

  function patchWalletYton(state = null, nextYton = 0) {
    return {
      wallet: {
        ...(state?.wallet || {}),
        yton: Number(nextYton || 0),
      },
      coins: Number(nextYton || 0),
    };
  }

  function loadPvpGameScript(srcList) {
    const list = Array.isArray(srcList) ? srcList : [srcList];

    return new Promise((resolve, reject) => {
      let i = 0;

      const tryNext = () => {
        if (i >= list.length) {
          reject(new Error("PvP oyun dosyası yüklenemedi: " + list.join(" | ")));
          return;
        }

        const src = list[i++];
        const existing = document.querySelector(`script[data-pvp-game="${src}"]`);

        if (existing) {
          if (existing.dataset.loaded === "1") {
            resolve(src);
            return;
          }

          existing.addEventListener("load", () => resolve(src), { once: true });
          existing.addEventListener("error", () => tryNext(), { once: true });
          return;
        }

        const s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.dataset.pvpGame = src;

        s.onload = () => {
          s.dataset.loaded = "1";
          resolve(src);
        };

        s.onerror = () => {
          s.remove();
          tryNext();
        };

        document.body.appendChild(s);
      };

      tryNext();
    });
  }


  const BET_PACKAGES = [
    { stake: 5, payout: 8, commission: 2, label: "5 yTon" },
    { stake: 10, payout: 16, commission: 4, label: "10 yTon" },
    { stake: 15, payout: 24, commission: 6, label: "15 yTon" },
    { stake: 30, payout: 55, commission: 5, label: "30 yTon" },
  ];

  const MODE_ENERGY_COST = {
    grid: 10,
    arena: 5,
    slotarena: 3,
  };

  function getSelectedStakeForMode(modeId, pvpState = null) {
    const selected = Number(pvpState?.selectedStakes?.[modeId] || pvpState?.betStake || 0);
    if (BET_PACKAGES.some((pkg) => Number(pkg.stake) === selected)) return selected;
    return Number(BET_PACKAGES[0]?.stake || 0);
  }

  function getBetPackageForMode(modeId, pvpState = null) {
    const selectedStake = getSelectedStakeForMode(modeId, pvpState);
    return BET_PACKAGES.find((pkg) => Number(pkg.stake) === selectedStake) || BET_PACKAGES[0] || {
      stake: 0,
      payout: 0,
      commission: 0,
      label: "0 yTon",
    };
  }

  function getStakeForMode(modeId, pvpState = null) {
    return Number(getBetPackageForMode(modeId, pvpState).stake || 0);
  }

  function getEnergyCostForMode(modeId) {
    return Number(MODE_ENERGY_COST[modeId] || 0);
  }

  function isRpcMissingFunction(error) {
    const code = String(error?.code || "").trim();
    const msg = String(error?.message || "").toLowerCase();
    return code === "PGRST202" || msg.includes("could not find the function");
  }

  function isRpcAmbiguous(error) {
    const code = String(error?.code || "").trim();
    const msg = String(error?.message || "").toLowerCase();
    return code === "PGRST203" || msg.includes("could not choose the best candidate function");
  }

  async function callRpcWithFallback(supabase, names, params) {
    const rpcNames = Array.isArray(names) ? names : [names];
    let last = null;

    for (const rpcName of rpcNames) {
      if (!rpcName) continue;
      const res = await supabase.rpc(rpcName, params);
      if (!res?.error) return res;
      last = res;
      if (!isRpcMissingFunction(res.error) && !isRpcAmbiguous(res.error)) return res;
    }

    return last || { data: null, error: new Error("rpc_unavailable") };
  }

  async function enqueueBetPvpFallbackTable(supabase, mode, stake) {
    try {
      const authRes = await supabase.auth?.getUser?.();
      const userId = authRes?.data?.user?.id || null;
      if (!userId) {
        return { data: null, error: { message: "auth unavailable" } };
      }

      try {
        await supabase
          .from("pvp_match_queue")
          .delete()
          .eq("user_id", userId)
          .eq("game_mode", String(mode || ""));
      } catch (_) {}

      const payload = {
        user_id: userId,
        game_mode: String(mode || ""),
        stake_yton: Number(stake || 0),
        status: "searching",
      };

      const insertRes = await supabase
        .from("pvp_match_queue")
        .insert(payload)
        .select("status, match_id")
        .limit(1)
        .maybeSingle();

      if (!insertRes?.error) {
        return {
          data: insertRes.data || { status: "searching", match_id: null },
          error: null,
        };
      }

      return insertRes;
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async function enqueueBetPvp(supabase, mode, stake) {
    const params = {
      p_mode: String(mode || ""),
      p_stake_yton: Number(stake || 0),
    };

    const primary = await callRpcWithFallback(
      supabase,
      ["tc_enqueue_ranked_pvp", "enqueue_ranked_pvp"],
      params
    );

    if (!primary?.error) return primary;
    if (!isRpcAmbiguous(primary.error)) return primary;

    return await enqueueBetPvpFallbackTable(supabase, mode, stake);
  }

  async function cancelBetPvp(supabase, mode, stake) {
    const params = {
      p_mode: String(mode || ""),
      p_stake_yton: Number(stake || 0),
    };

    const primary = await callRpcWithFallback(
      supabase,
      ["tc_cancel_ranked_pvp", "cancel_ranked_pvp"],
      params
    );

    if (!primary?.error) return primary;

    try {
      const authRes = await supabase.auth?.getUser?.();
      const userId = authRes?.data?.user?.id || null;
      if (!userId) return primary;
      const delRes = await supabase
        .from("pvp_match_queue")
        .delete()
        .eq("user_id", userId)
        .eq("game_mode", String(mode || ""))
        .eq("stake_yton", Number(stake || 0));
      return delRes?.error ? primary : { data: { status: "cancelled" }, error: null };
    } catch (_) {
      return primary;
    }
  }

  async function tryBetMatch(supabase, userId, mode) {
    return await callRpcWithFallback(supabase, ["tc_try_ranked_pvp_match", "try_ranked_pvp_match"], {
      p_user_id: userId,
      p_mode: String(mode || ""),
    });
  }

  function ensurePvpShellStyle() {
    if (document.getElementById("tc-pvp-shell-style")) return;

    const style = document.createElement("style");
    style.id = "tc-pvp-shell-style";
    style.textContent = `
      #pvpWrap.tc-inline-shell {
        position: fixed !important;
        left: 12px !important;
        right: 12px !important;
        top: 96px !important;
        bottom: 64px !important;
        z-index: 7000 !important;
        display: none;
        flex-direction: column;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(8,10,16,0.88);
        backdrop-filter: blur(12px);
        overflow: hidden;
        pointer-events: auto;
      }

      #pvpWrap.tc-inline-shell.open {
        display: flex !important;
      }

      #pvpHeader {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 10px 8px;
        border-bottom: 1px solid rgba(255,255,255,0.10);
        flex: 0 0 auto;
      }

      #pvpLeftHead {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      #pvpStatus {
        font-weight: 900;
        font-size: 13px;
        color: rgba(255,255,255,0.92);
      }

      #pvpOpponentRow {
        font-size: 12px;
        color: rgba(255,255,255,0.80);
      }

      #pvpOpponentRow b {
        color: rgba(255,255,255,0.95);
      }

      #pvpSpinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.25);
        border-top-color: rgba(255,255,255,0.85);
        vertical-align: -2px;
        margin-right: 8px;
        animation: tcPvpSpin 0.8s linear infinite;
      }

      #pvpSpinner.hidden {
        display: none !important;
      }

      @keyframes tcPvpSpin {
        to { transform: rotate(360deg); }
      }

      .pvpBtns {
        display: flex;
        gap: 8px;
      }

      .pvpBtn {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(0,0,0,0.35);
        color: rgba(255,255,255,0.92);
        border-radius: 10px;
        height: 30px;
        padding: 0 10px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
      }

      #pvpBars {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding: 10px;
        flex: 0 0 auto;
      }

      .pvpBar {
        height: 14px;
        border-radius: 10px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        overflow: hidden;
      }

      .pvpFill {
        height: 100%;
        width: 100%;
        transform-origin: left center;
        transform: scaleX(1);
        background: rgba(255,255,255,0.65);
      }

      .pvpBarLabel {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: rgba(255,255,255,0.95);
        margin-top: 6px;
      }

      #arena {
        position: relative;
        flex: 1 1 auto;
        min-height: 280px;
        width: calc(100% - 20px);
        margin: 0 10px 10px;
        border-radius: 14px;
        background: rgba(0,0,0,0.92);
        overflow: hidden;
        box-sizing: border-box;
      }

      @media (max-width: 640px) {
        #pvpWrap.tc-inline-shell {
          left: 10px !important;
          right: 10px !important;
          top: 84px !important;
          bottom: 58px !important;
        }

        #pvpHeader {
          padding: 8px 8px 6px;
        }

        .pvpBtns {
          gap: 6px;
        }

        .pvpBtn {
          font-size: 11px;
          height: 28px;
          padding: 0 8px;
        }

        #pvpBars {
          gap: 8px;
          padding: 8px;
        }

        #arena {
          width: calc(100% - 16px);
          margin: 0 8px 8px;
          min-height: 240px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePvpDom() {
    ensurePvpShellStyle();

    let wrap = document.getElementById("pvpWrap");
    let layer = document.getElementById("pvpLayer");

    if (!layer) {
      layer = document.createElement("div");
      layer.id = "pvpLayer";
      document.body.appendChild(layer);
    }

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "pvpWrap";
      layer.appendChild(wrap);
    }

    wrap.classList.add("tc-inline-shell", "open");
    wrap.style.display = "flex";
    wrap.style.pointerEvents = "auto";

    wrap.innerHTML = `
      <div id="pvpHeader">
        <div id="pvpLeftHead">
          <div id="pvpStatus">PvP • Hazır</div>
          <div id="pvpOpponentRow">
            <span id="pvpSpinner" class="hidden"></span>
            Rakip: <b id="pvpOpponent">—</b>
          </div>
        </div>

        <div class="pvpBtns">
          <button class="pvpBtn" id="pvpStart" type="button">Başlat</button>
          <button class="pvpBtn" id="pvpStop" type="button">Durdur</button>
          <button class="pvpBtn" id="pvpReset" type="button">Sıfırla</button>
        </div>
      </div>

      <div id="pvpBars">
        <div>
          <div class="pvpBar"><div class="pvpFill" id="enemyFill"></div></div>
          <div class="pvpBarLabel"><span>Düşman</span><span id="enemyHpText">100</span></div>
        </div>
        <div>
          <div class="pvpBar"><div class="pvpFill" id="meFill"></div></div>
          <div class="pvpBarLabel"><span>Sen</span><span id="meHpText">100</span></div>
        </div>
      </div>

      <div id="arena"></div>
    `;

    return {
      wrap,
      arena: document.getElementById("arena"),
      status: document.getElementById("pvpStatus"),
      opponent: document.getElementById("pvpOpponent"),
      spinner: document.getElementById("pvpSpinner"),
      startBtn: document.getElementById("pvpStart"),
      stopBtn: document.getElementById("pvpStop"),
      resetBtn: document.getElementById("pvpReset"),
      enemyFill: document.getElementById("enemyFill"),
      meFill: document.getElementById("meFill"),
      enemyHpText: document.getElementById("enemyHpText"),
      meHpText: document.getElementById("meHpText"),
    };
  }

  class PvpScene {
    constructor({ store, input, scenes, assets }) {
      this.store = store;
      this.input = input;
      this.scenes = scenes;
      this.assets = assets;

      this.scrollY = 0;
      this.maxScroll = 0;
      this.dragging = false;
      this.downY = 0;
      this.startScrollY = 0;
      this.velocityY = 0;
      this.lastPointerY = 0;
      this.moved = 0;
      this.clickCandidate = false;
      this._wasPointerDown = false;
      this._launchingGame = false;

      this.matchState = "menu";
      this.matchModeId = null;
      this.matchOpponent = null;
      this.matchRecord = null;
      this.matchStartedAt = 0;
      this.matchFoundAt = 0;

      this.matchSearchTimer = null;
      this.matchFallbackTimer = null;
      this.matchLaunchTimer = null;

      this.rtChannel = null;
      this.rtFallbackMs = 10000;
      this.rtMatchStarted = false;

      this.panelRect = { x: 0, y: 0, w: 0, h: 0 };
      this.closeRect = null;
      this.cardRects = [];
      this.modePills = [];

      this.source = "general";

      this.cards = [
        {
          id: "grid",
          title: "IQ Arena",
          subtitle: "Zeka Çatışması",
          desc: "Sıra tabanlı grid PvP. Kombolar ile rakibi indir.",
          open: true,
          accent: "#ffb24a",
        },
        {
          id: "arena",
          title: "Kafes Dövüşü",
          subtitle: "1v1 Kafes Dövüşü",
          desc: "Daha hızlı PvP modu. Kritik saldırılar.",
          open: true,
          accent: "#ff9340",
        },
        {
          id: "slotarena",
          title: "Slot Arena",
          subtitle: "Slot Tadında PvP",
          desc: "6x6 tumble slot PvP.",
          open: true,
          accent: "#ff5ea8",
        },
        {
          id: "tournament",
          title: "Kartel Turnuvası",
          subtitle: "Sezonluk PvP",
          desc: "Sezon puanı ve lig mantığı. Şimdilik yakında.",
          open: false,
          accent: "#7f7f86",
        },
      ];

      this.bg = null;
      this.fallbackBg = new Image();
      this.fallbackBg.src = "./src/assets/pvp-bg.png";
      this.fallbackBg.onerror = () => { this.fallbackBg.src = "./src/assets/pvp.jpg"; };
    }

    onEnter() {
      this.bg =
        getImageFromAssets(this.assets, "pvp_bg") ||
        getImageFromAssets(this.assets, "pvp-bg") ||
        getImageFromAssets(this.assets, "pvp") ||
        this.fallbackBg;

      const s = this.store?.get?.() || {};
      this.source = s?.pvp?.source || "general";
      const pvp = { ...(s?.pvp || {}) };
      const selectedStakes = { ...(pvp.selectedStakes || {}) };
      let changed = false;
      for (let i = 0; i < this.cards.length; i++) {
        const card = this.cards[i];
        if (!card?.id || !card.open) continue;
        if (!BET_PACKAGES.some((pkg) => Number(pkg.stake) === Number(selectedStakes[card.id] || 0))) {
          selectedStakes[card.id] = Number(BET_PACKAGES[0]?.stake || 0);
          changed = true;
        }
      }
      if (changed) {
        this.store?.set?.({
          pvp: {
            ...pvp,
            selectedStakes,
          },
        });
      }
      this.scrollY = 0;
      this.velocityY = 0;
      this.dragging = false;
      this.moved = 0;
      this.clickCandidate = false;
      this._wasPointerDown = false;
      this._launchingGame = false;
      this._resetMatchmaking();
    }

    onExit() {
      this._resetMatchmaking();
      this._launchingGame = false;
    }

    _getSupabase() {
      return window.supabase || window.tcSupabase || null;
    }

    async _getAuthUserId() {
      const sb = this._getSupabase();
      if (!sb?.auth?.getUser) return null;

      try {
        let res = await sb.auth.getUser();
        let userId = res?.data?.user?.id || null;
        if (userId) return userId;
        if (typeof window.tcEnsureAuthSession === "function") {
          await window.tcEnsureAuthSession().catch(() => null);
          res = await sb.auth.getUser();
          userId = res?.data?.user?.id || null;
          if (userId) return userId;
        }
        return null;
      } catch (_) {
        return null;
      }
    }

    _getPlayerMeta() {
      const s = this.store?.get?.() || {};
      const tg = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
      return {
        username:
          s?.player?.username ||
          tg?.username ||
          [tg?.first_name, tg?.last_name].filter(Boolean).join(" ") ||
          "Player",
        level: Math.max(1, Number(s?.player?.level || 1)),
        rank: Math.max(100, Number(s?.player?.rank || 1000)),
      };
    }

    _makeOpponent() {
      const level = this._getPlayerMeta().level;
      const names = [
        "ShadowWolf", "NightTiger", "GhostMafia", "RicoVane", "IronFist", "VoltKral", "SlyRaven",
        "BlackMamba", "NightHawk", "CrimsonJack", "DarkVenom", "MafiaKing", "BlueViper",
        "SteelFang", "RedSkull", "SilentWolf", "NeonGhost", "FrostBite", "WildRaven", "TurboKhan"
      ];
      return {
        username: names[Math.floor(Math.random() * names.length)],
        level: Math.max(1, level + Math.floor(Math.random() * 7) - 3),
        rank: this._getPlayerMeta().rank,
        isBot: true,
      };
    }

    _buildOpponentFromMatch(match, userId) {
      const amIPlayer1 = match.player1_id === userId;
      return {
        username: amIPlayer1 ? match.player2_username : match.player1_username,
        level: amIPlayer1 ? match.player2_level : match.player1_level,
        rank: amIPlayer1 ? match.player2_rank : match.player1_rank,
        isBot: !!match.is_bot_match,
      };
    }

    _buildMatchContext(match, userId, modeId) {
      if (!match || !userId) return null;
      const amIPlayer1 = String(match.player1_id || "") === String(userId);
      return {
        matchId: match.id,
        userId,
        modeId: modeId || this.matchModeId || "grid",
        sqlMode: match.game_mode || this._mapModeIdToSqlMode(modeId || this.matchModeId),
        amIPlayer1,
        isBotMatch: !!match.is_bot_match,
        player1Id: match.player1_id || null,
        player2Id: match.player2_id || null,
        player1Username: match.player1_username || "Player 1",
        player2Username: match.player2_username || "Player 2",
        opponentUsername: amIPlayer1 ? (match.player2_username || "Rakip") : (match.player1_username || "Rakip"),
      };
    }

    _normalizeRpcPayload(payload) {
      if (Array.isArray(payload)) return payload[0] || null;
      return payload || null;
    }

    _isMatchOwnedByUser(match, userId) {
      if (!match || !userId) return false;
      return String(match.player1_id || "") === String(userId) || String(match.player2_id || "") === String(userId);
    }

    _isUsableMatch(match, userId, mode, stake) {
      if (!match?.id || !this._isMatchOwnedByUser(match, userId)) return false;
      if (mode && match.game_mode != null && String(match.game_mode) !== String(mode)) return false;
      if (stake != null && match.stake_yton != null && Number(match.stake_yton) !== Number(stake)) return false;
      return true;
    }

    async _fetchMatchById(sb, matchId) {
      if (!sb || !matchId) return null;
      try {
        const { data } = await sb
          .from("pvp_matches")
          .select("*")
          .eq("id", matchId)
          .maybeSingle();
        return data || null;
      } catch (_) {
        return null;
      }
    }

    _buildFallbackOpponentFromRpc(payload, userId) {
      const rpc = this._normalizeRpcPayload(payload);
      if (!rpc) return null;

      const amIPlayer1 = String(rpc.player1_id || rpc.player1Id || "") === String(userId);
      const username =
        rpc.opponent_username ||
        rpc.opponentUsername ||
        (amIPlayer1
          ? (rpc.player2_username || rpc.player2Username)
          : (rpc.player1_username || rpc.player1Username)) ||
        "Rakip";

      const levelRaw =
        rpc.opponent_level ??
        rpc.opponentLevel ??
        (amIPlayer1
          ? (rpc.player2_level ?? rpc.player2Level)
          : (rpc.player1_level ?? rpc.player1Level));

      const rankRaw =
        rpc.opponent_rank ??
        rpc.opponentRank ??
        (amIPlayer1
          ? (rpc.player2_rank ?? rpc.player2Rank)
          : (rpc.player1_rank ?? rpc.player1Rank));

      return {
        username,
        level: Math.max(1, Number(levelRaw || 1)),
        rank: Math.max(100, Number(rankRaw || this._getPlayerMeta().rank || 1000)),
        isBot: !!(rpc.is_bot_match ?? rpc.isBotMatch),
      };
    }

    _buildFallbackMatchContextFromRpc(payload, userId, modeId) {
      const rpc = this._normalizeRpcPayload(payload);
      if (!rpc || !userId) return null;

      const matchId = rpc.match_id || rpc.matchId || rpc.id || null;
      if (!matchId) return null;

      const player1Id = rpc.player1_id || rpc.player1Id || null;
      const player2Id = rpc.player2_id || rpc.player2Id || null;
      const amIPlayer1 = player1Id ? String(player1Id) === String(userId) : false;

      return {
        matchId,
        userId,
        modeId: modeId || this.matchModeId || "grid",
        sqlMode: rpc.game_mode || rpc.gameMode || this._mapModeIdToSqlMode(modeId || this.matchModeId),
        amIPlayer1,
        isBotMatch: !!(rpc.is_bot_match ?? rpc.isBotMatch),
        player1Id,
        player2Id,
        player1Username: rpc.player1_username || rpc.player1Username || "Player 1",
        player2Username: rpc.player2_username || rpc.player2Username || "Player 2",
        opponentUsername:
          rpc.opponent_username ||
          rpc.opponentUsername ||
          (amIPlayer1
            ? (rpc.player2_username || rpc.player2Username || "Rakip")
            : (rpc.player1_username || rpc.player1Username || "Rakip")),
      };
    }

    _handleRealtimeMatchPayload(payload, userId, mode, stake, sceneModeId) {
      const match = payload?.new || payload || null;
      if (this.rtMatchStarted || this.matchState !== "searching") return false;
      if (!this._isUsableMatch(match, userId, mode, stake)) return false;

      this.rtMatchStarted = true;
      this.onMatchFound(
        this._buildOpponentFromMatch(match, userId),
        this._buildMatchContext(match, userId, sceneModeId)
      );
      return true;
    }

    async _resolveRpcMatchResult(sb, payload, userId, mode, stake, sceneModeId) {
      const rpc = this._normalizeRpcPayload(payload);
      if (!rpc || this.rtMatchStarted || this.matchState !== "searching") return false;

      const hasMatchSignal =
        rpc.ok === true ||
        rpc.status === "matched" ||
        !!(rpc.match_id || rpc.matchId || rpc.id || rpc.match || rpc.match_row || rpc.matchRecord);

      if (!hasMatchSignal) return false;

      let match = rpc.match || rpc.match_row || rpc.matchRecord || null;
      if (!this._isUsableMatch(match, userId, mode, stake)) {
        const matchId = rpc.match_id || rpc.matchId || rpc.id || match?.id || null;
        if (matchId) {
          match = await this._fetchMatchById(sb, matchId);
        }
      }

      if (this._isUsableMatch(match, userId, mode, stake)) {
        this.rtMatchStarted = true;
        this.onMatchFound(
          this._buildOpponentFromMatch(match, userId),
          this._buildMatchContext(match, userId, sceneModeId)
        );
        return true;
      }

      const fallbackCtx = this._buildFallbackMatchContextFromRpc(rpc, userId, sceneModeId);
      if (!fallbackCtx?.matchId) return false;

      this.rtMatchStarted = true;
      this.onMatchFound(
        this._buildFallbackOpponentFromRpc(rpc, userId) || this._makeOpponent(),
        fallbackCtx
      );
      return true;
    }

    _clearRealtime() {
      const sb = this._getSupabase();
      if (this.matchSearchTimer) { clearInterval(this.matchSearchTimer); clearTimeout(this.matchSearchTimer); }
      if (this.matchFallbackTimer) clearTimeout(this.matchFallbackTimer);
      if (this.matchLaunchTimer) clearTimeout(this.matchLaunchTimer);

      this.matchSearchTimer = null;
      this.matchFallbackTimer = null;
      this.matchLaunchTimer = null;

      if (this.rtChannel && sb?.removeChannel) {
        try { sb.removeChannel(this.rtChannel); } catch (_) {}
      }
      this.rtChannel = null;
      this.rtMatchStarted = false;
    }

    async _cancelRealtimeQueue() {
      const sb = this._getSupabase();
      const mode = this._mapModeIdToSqlMode(this.matchModeId);
      const stake = getStakeForMode(this.matchModeId, this._getPvpState());

      this._clearRealtime();

      if (!sb || !mode || !stake) return;

      try {
        await cancelBetPvp(sb, mode, stake);
      } catch (_) {}
    }

    _resetMatchmaking() {
      this._clearRealtime();
      this.matchState = "menu";
      this.matchModeId = null;
      this.matchOpponent = null;
      this.matchRecord = null;
      this.matchStartedAt = 0;
      this.matchFoundAt = 0;
    }

    _mapModeIdToSqlMode(id) {
      if (id === "grid") return "pvpcrush";
      if (id === "arena") return "pvpcage";
      if (id === "slotarena") return "pvpslotarena";
      return null;
    }

    _getPvpState() {
      const s = this.store?.get?.() || {};
      return { ...(s.pvp || {}) };
    }

    _selectBetStake(modeId, stake) {
      const selectedStake = Number(stake || 0);
      if (!selectedStake || !modeId) return;
      const latest = this.store?.get?.() || {};
      const pvp = { ...(latest.pvp || {}) };
      const selectedStakes = { ...(pvp.selectedStakes || {}) };
      selectedStakes[modeId] = selectedStake;
      this.store?.set?.({
        pvp: {
          ...pvp,
          selectedStakes,
          betStake: selectedStake,
        },
      });
    }

    async startMatchmaking(id) {
      if (this._launchingGame) return;

      this._resetMatchmaking();
      this.matchState = "searching";
      this.matchModeId = id;
      this.matchStartedAt = Date.now();

      const sb = this._getSupabase();
      const userId = await this._getAuthUserId();
      const mode = this._mapModeIdToSqlMode(id);
      const s = this.store?.get?.() || {};
      const pvpState = { ...(s.pvp || {}) };
      const stakePkg = getBetPackageForMode(id, pvpState);
      const stake = Number(stakePkg.stake || 0);
      const player = this._getPlayerMeta();
      const playerState = { ...(s.player || {}) };
      const currentEnergy = Number(playerState.energy || 0);
      const energyCost = getEnergyCostForMode(id);
      const ytonBalance = getWalletYton(s);

      if (!sb || !userId || !mode || !stake) {
        this.matchState = "menu";
        try {
          window.dispatchEvent(new CustomEvent("tc:toast", {
            detail: { text: "Online eşleşme için giriş hazır değil" },
          }));
        } catch (_) {}
        return;
      }

      if (currentEnergy < energyCost) {
        try {
          window.dispatchEvent(new CustomEvent("tc:toast", {
            detail: { text: `Yetersiz enerji • ${energyCost} gerekli • ${id === "grid" ? "IQ Arena" : id === "arena" ? "Kafes Dövüşü" : "Slot Arena"}` },
          }));
        } catch (_) {}
        this.matchState = "menu";
        return;
      }

      if (ytonBalance < stake) {
        try {
          window.dispatchEvent(new CustomEvent("tc:toast", {
            detail: { text: `Yetersiz YTON • ${stake} giriş gerekli` },
          }));
        } catch (_) {}
        this.matchState = "menu";
        return;
      }

      try {
        const { data: queueData, error: queueError } = await enqueueBetPvp(sb, mode, stake);
        if (queueError) throw queueError;

        const latest = this.store?.get?.() || {};
        this.store?.set?.({
          pvp: {
            ...(latest.pvp || {}),
            betStake: stake,
            betMode: mode,
            betPayout: Number(stakePkg.payout || 0),
            betCommission: Number(stakePkg.commission || 0),
            queueStatus: queueData?.status || "searching",
          },
        });

        if (await this._resolveRpcMatchResult(sb, queueData, userId, mode, stake, id)) {
          return;
        }

        const channelName = `pvp-match-${userId}-${mode}-${Date.now()}`;
        this.rtChannel = sb
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "pvp_matches",
              filter: `player1_id=eq.${userId}`,
            },
            (payload) => {
              this._handleRealtimeMatchPayload(payload, userId, mode, stake, id);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "pvp_matches",
              filter: `player1_id=eq.${userId}`,
            },
            (payload) => {
              this._handleRealtimeMatchPayload(payload, userId, mode, stake, id);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "pvp_matches",
              filter: `player2_id=eq.${userId}`,
            },
            (payload) => {
              this._handleRealtimeMatchPayload(payload, userId, mode, stake, id);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "pvp_matches",
              filter: `player2_id=eq.${userId}`,
            },
            (payload) => {
              this._handleRealtimeMatchPayload(payload, userId, mode, stake, id);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "pvp_match_queue",
              filter: `user_id=eq.${userId}`,
            },
            async () => {
              if (this.rtMatchStarted || this.matchState !== "searching") return;
              try {
                await this._pollMatchedQueueOrMatch(sb, userId, mode, stake, id);
              } catch (_) {}
            }
          )
          .subscribe();

        this.matchSearchTimer = setInterval(async () => {
          if (this.rtMatchStarted || this.matchState !== "searching") return;
          try {
            const { data: tryData, error: tryError } = await tryBetMatch(sb, userId, mode);
            if (tryError) throw tryError;
            const matchedFromRpc = await this._resolveRpcMatchResult(sb, tryData, userId, mode, stake, id);
            if (matchedFromRpc) return;
          } catch (_) {}
          try {
            await this._pollMatchedQueueOrMatch(sb, userId, mode, stake, id);
          } catch (_) {}
        }, 1000);
      } catch (err) {
        console.error("[TonCrime] betting matchmaking error:", err);
        this.matchState = "menu";
        try {
          window.dispatchEvent(new CustomEvent("tc:toast", {
            detail: { text: "Bahisli PvP kuyruğu başlatılamadı" },
          }));
        } catch (_) {}
      }
    }

    onMatchFound(opponent, matchRecord = null) {
      if (this.matchState !== "searching") return;

      if (this.matchSearchTimer) { clearInterval(this.matchSearchTimer); clearTimeout(this.matchSearchTimer); }
      if (this.matchFallbackTimer) clearTimeout(this.matchFallbackTimer);
      this.matchSearchTimer = null;
      this.matchFallbackTimer = null;

      const sb = this._getSupabase();
      if (this.rtChannel && sb?.removeChannel) {
        try { sb.removeChannel(this.rtChannel); } catch (_) {}
      }
      this.rtChannel = null;

      this.matchOpponent = opponent;
      this.matchRecord = matchRecord || null;
      this.matchState = "found";
      this.matchFoundAt = Date.now();

      this.matchLaunchTimer = setTimeout(() => {
        const id = this.matchModeId;
        const opp = this.matchOpponent;
        const matchCtx = this.matchRecord;
        this.matchLaunchTimer = null;
        this.startGame(id, opp, matchCtx);
      }, 3000);
    }

    _headerText() {
      if (this.source === "nightclub") return "Rakip Havuzu: Nightclub içi";
      if (this.source === "coffeeshop") return "Rakip Havuzu: Coffeeshop içi";
      return "Rakip Havuzu: Genel";
    }

    _availableCards() {
      if (this.source === "nightclub") {
        return this.cards.filter(
          (c) => c.id === "grid" || c.id === "arena" || c.id === "slotarena"
        );
      }
      if (this.source === "coffeeshop") {
        return this.cards.filter((c) => c.id === "grid" || c.id === "slotarena");
      }
      return this.cards;
    }

    update() {
      const p = this.input?.pointer || {};
      const px = Number(p.x || 0);
      const py = Number(p.y || 0);

      const isDown = !!(p.down || this.input?.isDown?.());
      const justDown = !!(p.justDown || (isDown && !this._wasPointerDown));
      const justUp = !!(!isDown && this._wasPointerDown);

      if (justDown) {
        this.dragging = true;
        this.downY = py;
        this.lastPointerY = py;
        this.startScrollY = this.scrollY;
        this.velocityY = 0;
        this.moved = 0;
        this.clickCandidate = true;
      }

      if (this.dragging && isDown) {
        const dy = py - this.downY;
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);

        const step = this.lastPointerY - py;
        this.velocityY = step;
        this.lastPointerY = py;

        this.moved = Math.max(this.moved, Math.abs(dy));
        if (this.moved > 10) {
          this.clickCandidate = false;
        }
      }

      if (this.dragging && justUp) {
        this.dragging = false;
        if (this.clickCandidate) {
          this.pointerUp(px, py);
        }
      }

      if (!isDown && !this.dragging && this.clickCandidate && this.moved <= 10 && !justDown && !justUp && !this._launchingGame) {
        this.clickCandidate = false;
        this.pointerUp(px, py);
      }

      const wheel = Number(this.input?.wheelDelta || 0);
      if (wheel) {
        this.scrollY = clamp(this.scrollY + wheel * 0.55, 0, this.maxScroll);
      }

      if (!this.dragging && Math.abs(this.velocityY) > 0.1) {
        this.scrollY = clamp(this.scrollY + this.velocityY, 0, this.maxScroll);
        this.velocityY *= 0.9;
      }

      this._wasPointerDown = isDown;
    }

    pointerUp(x, y) {
      if (this.closeRect && pointInRect(x, y, this.closeRect)) {
        this._cancelRealtimeQueue();
        this._resetMatchmaking();
        this.scenes.go("home");
        return;
      }

      for (let i = 0; i < this.cardRects.length; i++) {
        const r = this.cardRects[i];
        if (Array.isArray(r.betRects)) {
          for (let bi = 0; bi < r.betRects.length; bi++) {
            const betRect = r.betRects[bi];
            if (betRect && pointInRect(x, y, betRect)) {
              this._selectBetStake(r.card.id, betRect.stake);
              return;
            }
          }
        }
        const hitButton = r.btn && pointInRect(x, y, r.btn);
        const hitCard = r.cardRect && pointInRect(x, y, r.cardRect);
        if ((hitButton || hitCard) && r.card.open) {
          this.startMatchmaking(r.card.id);
          return;
        }
      }
    }

    async startGame(id, opponentData = null, matchCtx = null) {
      if (this._launchingGame) return;
      this._launchingGame = true;

      const s = this.store?.get?.() || {};
      const pvp = { ...(s.pvp || {}) };
      const ECONOMY = {
        grid: {
          energy: getEnergyCostForMode("grid"),
          stake: getStakeForMode("grid", pvp),
          payout: Number(getBetPackageForMode("grid", pvp).payout || 0),
          commission: Number(getBetPackageForMode("grid", pvp).commission || 0),
          modeKey: "iq_arena",
        },
        arena: {
          energy: getEnergyCostForMode("arena"),
          stake: getStakeForMode("arena", pvp),
          payout: Number(getBetPackageForMode("arena", pvp).payout || 0),
          commission: Number(getBetPackageForMode("arena", pvp).commission || 0),
          modeKey: "cage_fight",
        },
        slotarena: {
          energy: getEnergyCostForMode("slotarena"),
          stake: getStakeForMode("slotarena", pvp),
          payout: Number(getBetPackageForMode("slotarena", pvp).payout || 0),
          commission: Number(getBetPackageForMode("slotarena", pvp).commission || 0),
          modeKey: "slot_arena",
        },
      };
      const player = { ...(s.player || {}) };
      const economy = ECONOMY[id];

      pvp.selectedMode = id;
      pvp.source = this.source || "general";

      if (!economy) {
        this.store?.set?.({ pvp });
        this._launchingGame = false;
        return;
      }

      const currentEnergy = Number(player.energy || 0);
      const currentYton = getWalletYton(s);

      if (currentEnergy < economy.energy) {
        this.store?.set?.({ pvp: { ...pvp, selectedMode: null } });
        try {
          window.dispatchEvent(new CustomEvent("tc:toast", {
            detail: {
              text: `Yetersiz enerji • ${economy.energy} gerekli`,
            },
          }));
        } catch (_) {}
        this._launchingGame = false;
        return;
      }

      let charged = false;
      const chargeMatch = () => {
        if (charged) return;
        charged = true;
        this.store?.set?.({
          player: {
            ...player,
            energy: Math.max(0, currentEnergy - economy.energy),
          },
          pvp: {
            ...pvp,
            selectedMode: id,
            source: this.source || "general",
            entryPaid: true,
            entryEnergy: economy.energy,
            entryStake: economy.stake,
            expectedPayout: economy.payout,
            rewardYton: Number(economy.payout || 0),
            serverFee: Number(economy.commission || 0),
            payoutDone: false,
            matchStartedAt: Date.now(),
            modeKey: economy.modeKey,
          },
        });
      };

      const refundMatch = () => {
        if (!charged) return;
        charged = false;
        const latest = this.store?.get?.() || {};
        const latestPlayer = { ...(latest.player || player) };
        this.store?.set?.({
          player: {
            ...latestPlayer,
            energy: Number(latestPlayer.energy || 0) + economy.energy,
          },
          pvp: {
            ...(latest.pvp || pvp),
            selectedMode: null,
            entryPaid: false,
            payoutDone: false,
          },
        });
      };

      try {
        chargeMatch();

        const dom = ensurePvpDom();

        if (dom.status) dom.status.textContent = "PvP • Yükleniyor...";
        if (dom.opponent) dom.opponent.textContent = (opponentData?.username || "ShadowWolf");
        if (dom.spinner) dom.spinner.classList.remove("hidden");

        if (id === "grid") {
          await loadPvpGameScript(["./src/pvpcrush.js", "./pvpcrush.js"]);

          if (!window.TonCrimePVP_CRUSH) {
            throw new Error("TonCrimePVP_CRUSH bulunamadı");
          }

          window.TonCrimePVP = window.TonCrimePVP_CRUSH;

          window.TonCrimePVP.init?.({
            arenaId: "arena",
            statusId: "pvpStatus",
            enemyFillId: "enemyFill",
            meFillId: "meFill",
            enemyHpTextId: "enemyHpText",
            meHpTextId: "meHpText",
          });

          window.TonCrimePVP.setMatchContext?.(matchCtx || null);
          window.TonCrimePVP.setOpponent?.({
            username: opponentData?.username || "ShadowWolf",
            isBot: !!(opponentData?.isBot ?? true),
            level: opponentData?.level || 1,
          });
          try {
            window.TonCrimePVP.onMatchFinished = (didWin) => this._finishBetMatchIfNeeded(matchCtx, opponentData, !!didWin);
          } catch (_) {}

          if (dom.startBtn) {
            dom.startBtn.style.display = "";
            dom.startBtn.onclick = async () => {
              try {
                window.TonCrimePVP.setOpponent?.({
                  username: opponentData?.username || "ShadowWolf",
                  isBot: !!(opponentData?.isBot ?? true),
                  level: opponentData?.level || 1,
                });
                window.TonCrimePVP.reset?.();
                await new Promise((r) => setTimeout(r, 120));
                window.TonCrimePVP.start?.();
              } catch (err) {
                console.error("[TonCrime] Start button error:", err);
              }
            };
          }

          if (dom.stopBtn) {
            dom.stopBtn.style.display = "";
            dom.stopBtn.onclick = () => {
              try { window.TonCrimePVP.stop?.(); } catch (err) {}
            };
          }

          if (dom.resetBtn) {
            dom.resetBtn.style.display = "";
            dom.resetBtn.onclick = () => {
              try { window.TonCrimePVP.reset?.(); } catch (err) {}
            };
          }

          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.reset?.();
          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.start?.();

          if (dom.status) dom.status.textContent = "PvP • IQ Arena başladı";
          if (dom.spinner) dom.spinner.classList.add("hidden");
          this._launchingGame = false;
          this._resetMatchmaking();
          return;
        }

        if (id === "slotarena") {
          await loadPvpGameScript(["./src/pvpslotarena.js", "./pvpslotarena.js"]);

          if (!window.TonCrimePVP_SLOT) {
            throw new Error("TonCrimePVP_SLOT bulunamadı");
          }

          window.TonCrimePVP = window.TonCrimePVP_SLOT;

          window.TonCrimePVP.init?.({
            arenaId: "arena",
            statusId: "pvpStatus",
            enemyFillId: "enemyFill",
            meFillId: "meFill",
            enemyHpTextId: "enemyHpText",
            meHpTextId: "meHpText",
          });

          window.TonCrimePVP.setMatchContext?.(matchCtx || null);
          window.TonCrimePVP.setOpponent?.({
            username: opponentData?.username || "ShadowWolf",
            isBot: !!(opponentData?.isBot ?? true),
            level: opponentData?.level || 1,
          });
          try {
            window.TonCrimePVP.onMatchFinished = (didWin) => this._finishBetMatchIfNeeded(matchCtx, opponentData, !!didWin);
          } catch (_) {}

          if (dom.startBtn) {
            dom.startBtn.style.display = "";
            dom.startBtn.onclick = async () => {
              try {
                window.TonCrimePVP.setOpponent?.({
                  username: opponentData?.username || "ShadowWolf",
                  isBot: !!(opponentData?.isBot ?? true),
                  level: opponentData?.level || 1,
                });
                window.TonCrimePVP.reset?.();
                await new Promise((r) => setTimeout(r, 120));
                window.TonCrimePVP.start?.();
              } catch (err) {
                console.error("[TonCrime] Start button error:", err);
              }
            };
          }

          if (dom.stopBtn) {
            dom.stopBtn.style.display = "";
            dom.stopBtn.onclick = () => {
              try { window.TonCrimePVP.stop?.(); } catch (err) {}
            };
          }

          if (dom.resetBtn) {
            dom.resetBtn.style.display = "";
            dom.resetBtn.onclick = () => {
              try { window.TonCrimePVP.reset?.(); } catch (err) {}
            };
          }

          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.reset?.();
          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.start?.();

          if (dom.status) dom.status.textContent = "PvP • Slot Arena başladı";
          if (dom.spinner) dom.spinner.classList.add("hidden");
          this._launchingGame = false;
          this._resetMatchmaking();
          return;
        }

        if (id === "arena") {
          await loadPvpGameScript(["./src/pvpcage.js", "./pvpcage.js"]);

          if (!window.TonCrimePVP_CAGE) {
            throw new Error("TonCrimePVP_CAGE bulunamadı");
          }

          window.TonCrimePVP = window.TonCrimePVP_CAGE;

          window.TonCrimePVP.init?.({
            arenaId: "arena",
            statusId: "pvpStatus",
            enemyFillId: "enemyFill",
            meFillId: "meFill",
            enemyHpTextId: "enemyHpText",
            meHpTextId: "meHpText",
          });

          window.TonCrimePVP.setMatchContext?.(matchCtx || null);
          window.TonCrimePVP.setOpponent?.({
            username: opponentData?.username || "ShadowWolf",
            isBot: !!(opponentData?.isBot ?? true),
            level: opponentData?.level || 1,
          });
          try {
            window.TonCrimePVP.onMatchFinished = (didWin) => this._finishBetMatchIfNeeded(matchCtx, opponentData, !!didWin);
          } catch (_) {}

          if (dom.startBtn) {
            dom.startBtn.style.display = "";
            dom.startBtn.onclick = async () => {
              try {
                window.TonCrimePVP.setOpponent?.({
                  username: opponentData?.username || "ShadowWolf",
                  isBot: !!(opponentData?.isBot ?? true),
                  level: opponentData?.level || 1
                });
                window.TonCrimePVP.reset?.();
                await new Promise((r) => setTimeout(r, 120));
                window.TonCrimePVP.start?.();
              } catch (err) {
                console.error("[TonCrime] Cage start error:", err);
              }
            };
          }

          if (dom.stopBtn) {
            dom.stopBtn.style.display = "";
            dom.stopBtn.onclick = () => { try { window.TonCrimePVP.stop?.(); } catch (_) {} };
          }

          if (dom.resetBtn) {
            dom.resetBtn.style.display = "";
            dom.resetBtn.onclick = () => { try { window.TonCrimePVP.reset?.(); } catch (_) {} };
          }

          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.reset?.();
          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.start?.();

          if (dom.status) dom.status.textContent = "PvP • Kafes Dövüşü başladı";
          if (dom.spinner) dom.spinner.classList.add("hidden");
          this._launchingGame = false;
          this._resetMatchmaking();
          return;
        }

        if (dom.status) dom.status.textContent = "PvP • Mod bulunamadı";
        if (dom.spinner) dom.spinner.classList.add("hidden");
      } catch (err) {
        refundMatch();
        console.error("[TonCrime] startGame fatal:", err);
        const status = document.getElementById("pvpStatus");
        const spinner = document.getElementById("pvpSpinner");
        if (status) status.textContent = "PvP • Oyun yüklenemedi";
        if (spinner) spinner.classList.add("hidden");
      }

      this._launchingGame = false;
    }


    async _finishBetMatchIfNeeded(matchCtx, opponentData, didWin) {
      try {
        if (!matchCtx?.matchId) return;
        const sb = this._getSupabase();
        const userId = await this._getAuthUserId();
        if (!sb || !userId) return;
        const opponentId = String(matchCtx.player1Id || "") === String(userId)
          ? (matchCtx.player2Id || null)
          : (matchCtx.player1Id || null);
        const winnerId = didWin ? userId : (opponentData?.id || opponentId || null);
        if (!winnerId) return;
        const { data, error } = await sb.rpc("finish_pvp_match", {
          p_match_id: matchCtx.matchId,
          p_winner_user_id: winnerId,
          p_reason: didWin ? "win" : "loss",
        });
        if (error) {
          console.error("[TonCrime] finish_pvp_match error:", error);
          return;
        }
        if (didWin && data?.prize_yton != null) {
          const latest = this.store?.get?.() || {};
          const nextYton = getWalletYton(latest) + Number(data.prize_yton || 0);
          this.store?.set?.(patchWalletYton(latest, nextYton));
        }
      } catch (err) {
        console.error("[TonCrime] _finishBetMatchIfNeeded fatal:", err);
      }
    }


    async _pollMatchedQueueOrMatch(sb, userId, mode, stake, sceneModeId) {
      try {
        const { data: queueRow } = await sb
          .from("pvp_match_queue")
          .select("match_id, status")
          .eq("user_id", userId)
          .eq("game_mode", mode)
          .eq("stake_yton", stake)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (queueRow?.match_id) {
          const { data: matchRow } = await sb
            .from("pvp_matches")
            .select("*")
            .eq("id", queueRow.match_id)
            .maybeSingle();

          if (matchRow && !this.rtMatchStarted && this.matchState === "searching") {
            this.rtMatchStarted = true;
            this.onMatchFound(
              this._buildOpponentFromMatch(matchRow, userId),
              this._buildMatchContext(matchRow, userId, sceneModeId)
            );
            return true;
          }
        }

        const { data: directMatch } = await sb
          .from("pvp_matches")
          .select("*")
          .eq("game_mode", mode)
          .eq("stake_yton", stake)
          .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (directMatch && !this.rtMatchStarted && this.matchState === "searching") {
          this.rtMatchStarted = true;
          this.onMatchFound(
            this._buildOpponentFromMatch(directMatch, userId),
            this._buildMatchContext(directMatch, userId, sceneModeId)
          );
          return true;
        }
      } catch (_) {}
      return false;
    }

    renderSearchingOverlay(ctx, panelX, panelY, panelW, panelH) {
      const cx = panelX + panelW * 0.5;
      const cy = panelY + panelH * 0.46;
      const boxW = Math.min(panelW - 28, 410);
      const boxH = Math.min(panelH - 28, 260);
      const boxX = cx - boxW * 0.5;
      const boxY = panelY + Math.max(18, (panelH - boxH) * 0.24);

      fillRoundRect(ctx, boxX, boxY, boxW, boxH, 24, "rgba(7,12,24,0.72)");
      strokeRoundRect(ctx, boxX, boxY, boxW, boxH, 24, "rgba(255,255,255,0.12)", 1.5);

      const t = Date.now() * 0.004;
      for (let i = 0; i < 3; i++) {
        const rr = 34 + i * 22 + Math.sin(t + i * 0.7) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.18 - i * 0.04})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = t * 1.6 + i * (Math.PI / 4);
        const x = cx + Math.cos(a) * 54;
        const y = cy + Math.sin(a) * 54;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.35 + (i % 2) * 0.2})`;
        ctx.fill();
      }

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "900 20px system-ui, Arial";
      ctx.fillText(this.matchState === "found" ? "Rakip bulundu" : "Rakip aranıyor", cx, boxY + 46);

      if (this.matchState === "found" && this.matchOpponent) {
        ctx.font = "900 28px system-ui, Arial";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(this.matchOpponent.username || "Rakip", cx, boxY + 104);
        ctx.font = "700 16px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.fillText(`Level ${this.matchOpponent.level || 1}`, cx, boxY + 132);
        const left = Math.max(0, 3000 - (Date.now() - this.matchFoundAt));
        ctx.font = "500 14px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(`Maç ${Math.max(1, Math.ceil(left / 1000))} sn içinde başlıyor`, cx, boxY + 178);
      } else {
        ctx.font = "500 15px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText("Eşleşme hazırlanıyor", cx, boxY + 104);
        ctx.font = "700 14px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillText("Oyuncular taranıyor...", cx, boxY + 132);
      }
    }

    render(ctx) {
      const canvas = ctx.canvas;
      const size = getCanvasCssSize(canvas);
      const w = size.w;
      const h = size.h;

      const state = this.store?.get?.() || {};
      const safe = state?.ui?.safe || { x: 0, y: 0, w, h };
      const hudReservedTop = Number(state?.ui?.hudReservedTop || 92);
      const chatReservedBottom = Number(state?.ui?.chatReservedBottom || 58);

      ctx.clearRect(0, 0, w, h);

      drawCoverImage(ctx, this.bg || this.fallbackBg, 0, 0, w, h, 1);

      const fade = ctx.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, "rgba(0,0,0,0.28)");
      fade.addColorStop(0.5, "rgba(0,0,0,0.40)");
      fade.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);

      const side = clamp(Math.round(safe.w * 0.035), 12, 18);
      const panelX = safe.x + side;
      const panelY = safe.y + Math.max(6, hudReservedTop - 4);
      const panelW = safe.w - side * 2;
      const panelBottom = safe.y + safe.h - Math.max(10, chatReservedBottom - 6);
      const panelH = Math.max(320, panelBottom - panelY);

      this.panelRect = { x: panelX, y: panelY, w: panelW, h: panelH };

      ctx.save();
      fillRoundRect(ctx, panelX, panelY, panelW, panelH, 22, "rgba(10,14,24,0.20)");
      strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 22, "rgba(255,181,74,0.0)", 0);

      const gloss = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
      gloss.addColorStop(0, "rgba(255,255,255,0.06)");
      gloss.addColorStop(1, "rgba(255,255,255,0.01)");
      fillRoundRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH - 2, 21, gloss);

      const innerPad = Math.max(14, Math.round(panelW * 0.03));
      const titleSize = clamp(Math.round(panelW * 0.045), 22, 34);
      const subtitleSize = clamp(Math.round(panelW * 0.022), 12, 16);
      const cardTitleSize = clamp(Math.round(panelW * 0.042), 19, 28);
      const cardSubSize = clamp(Math.round(panelW * 0.022), 11, 15);
      const cardTextSize = clamp(Math.round(panelW * 0.023), 12, 16);

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = `700 ${titleSize}px system-ui, Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("PvP • Oyun Seç", panelX + innerPad, panelY + 16);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `500 ${subtitleSize}px system-ui, Arial`;
      ctx.fillText(this._headerText(), panelX + innerPad, panelY + 16 + titleSize + 10);

      const closeW = clamp(Math.round(panelW * 0.14), 84, 112);
      const closeH = clamp(Math.round(panelH * 0.065), 34, 42);
      const closeX = panelX + panelW - innerPad - closeW;
      const closeY = panelY + 14;
      this.closeRect = { x: closeX, y: closeY, w: closeW, h: closeH };

      fillRoundRect(ctx, closeX, closeY, closeW, closeH, 12, "rgba(20,20,26,0.72)");
      strokeRoundRect(ctx, closeX, closeY, closeW, closeH, 12, "rgba(255,255,255,0.16)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `700 ${clamp(Math.round(closeH * 0.36), 12, 16)}px system-ui, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Kapat", closeX + closeW / 2, closeY + closeH / 2);

      const chipsY = panelY + 16 + titleSize + 10 + subtitleSize + 14;
      const chipH = clamp(Math.round(panelH * 0.06), 28, 36);

      const chips = [
        { id: "general", label: "PvP merkezi" },
        {
          id: this.source,
          label:
            this.source === "nightclub"
              ? "Nightclub içi havuz"
              : this.source === "coffeeshop"
              ? "Coffeeshop içi havuz"
              : "En temiz komboyu yapan parayı toplar.",
        },
      ];

      this.modePills = [];
      let chipX = panelX + innerPad;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${clamp(Math.round(chipH * 0.34), 11, 14)}px system-ui, Arial`;

      for (let i = 0; i < chips.length; i++) {
        const c = chips[i];
        const textW = Math.ceil(ctx.measureText(c.label).width);
        const chipW = Math.min(panelW - innerPad * 2, textW + 24);
        fillRoundRect(ctx, chipX, chipsY, chipW, chipH, chipH * 0.5, "rgba(18,18,22,0.46)");
        strokeRoundRect(ctx, chipX, chipsY, chipW, chipH, chipH * 0.5, "rgba(255,255,255,0.14)", 1);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(c.label, chipX + 12, chipsY + chipH / 2 + 0.5);
        chipX += chipW + 10;
        if (chipX > panelX + panelW - innerPad - 80) break;
      }

      const cards = this._availableCards();
      const scrollTop = chipsY + chipH + 14;
      const contentBottomPad = 16;
      const viewportTop = scrollTop;
      const viewportBottom = panelY + panelH - contentBottomPad;
      const viewportH = viewportBottom - viewportTop;

      const cardGap = 14;
      const cardH = clamp(Math.round(panelH * 0.24), 164, 198);
      const contentH = cards.length * cardH + Math.max(0, cards.length - 1) * cardGap;
      this.maxScroll = Math.max(0, contentH - viewportH);
      this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

      ctx.beginPath();
      ctx.rect(panelX + 1, viewportTop, panelW - 2, viewportH);
      ctx.clip();

      this.cardRects = [];
      let y = viewportTop - this.scrollY;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const x = panelX + innerPad;
        const cw = panelW - innerPad * 2;

        fillRoundRect(ctx, x, y, cw, cardH, 18, "rgba(6,10,18,0.56)");

        const artKey = card.id === "grid" ? "brain" : card.id === "arena" ? "punch" : card.id === "slotarena" ? "bonus" : null;
        const artImg = artKey ? getImageFromAssets(this.assets, artKey) : null;
        if (artImg && artImg.complete) {
          drawCoverImage(ctx, artImg, x + cw - 132, y + 42, 98, 98, 0.95);
        }
        strokeRoundRect(
          ctx,
          x,
          y,
          cw,
          cardH,
          18,
          card.open ? "rgba(255,170,50,0.72)" : "rgba(255,255,255,0.14)",
          1.4
        );

        const shine = ctx.createLinearGradient(x, y, x + cw, y + cardH);
        shine.addColorStop(0, "rgba(255,160,50,0.05)");
        shine.addColorStop(0.4, "rgba(0,0,0,0)");
        shine.addColorStop(1, "rgba(255,255,255,0.02)");
        fillRoundRect(ctx, x + 1, y + 1, cw - 2, cardH - 2, 17, shine);

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `700 ${cardTitleSize}px system-ui, Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(card.title, x + 18, y + 14);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `500 ${cardSubSize}px system-ui, Arial`;
        ctx.fillText(card.subtitle, x + 18, y + 14 + cardTitleSize + 5);

        const btnW = clamp(Math.round(cw * 0.16), 72, 92);
        const btnH = clamp(Math.round(cardH * 0.22), 32, 38);
        const btnX = x + cw - btnW - 14;
        const btnY = y + 14;

        fillRoundRect(
          ctx,
          btnX,
          btnY,
          btnW,
          btnH,
          12,
          card.open ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.08)"
        );
        strokeRoundRect(
          ctx,
          btnX,
          btnY,
          btnW,
          btnH,
          12,
          card.open ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
          1
        );

        ctx.fillStyle = card.open ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.56)";
        ctx.font = `700 ${clamp(Math.round(btnH * 0.34), 11, 14)}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(card.open ? "Açık" : "Kilitli", btnX + btnW / 2, btnY + btnH / 2);

        const pvpState = { ...((state && state.pvp) || {}) };
        const selectedPkg = getBetPackageForMode(card.id, pvpState);
        const energyCost = getEnergyCostForMode(card.id);
        const descX = x + 18;
        const descY = y + 14 + cardTitleSize + 5 + cardSubSize + 12;
        const descW = cw - 36;
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.font = `500 ${cardTextSize}px system-ui, Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const lines = wrapLines(ctx, card.desc, descW);
        let lineY = descY;
        const lineH = Math.round(cardTextSize * 1.32);
        for (let li = 0; li < Math.min(lines.length, 2); li++) {
          ctx.fillText(lines[li], descX, lineY);
          lineY += lineH;
        }

        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.font = `700 ${Math.max(11, cardTextSize - 1)}px system-ui, Arial`;
        ctx.fillText(`Enerji: ${energyCost} • Giriş: ${selectedPkg.stake} yTon`, descX, lineY + 4);
        ctx.fillStyle = "rgba(255,214,140,0.96)";
        ctx.fillText(`Kazanç: ${selectedPkg.payout} yTon • Komisyon: ${selectedPkg.commission} yTon`, descX, lineY + 4 + Math.round((cardTextSize + 1) * 1.22));

        const betRects = [];
        let tagX = x + 18;
        const tagY = y + cardH - 48;
        const tagH = 30;
        ctx.font = `700 12px system-ui, Arial`;
        for (let t = 0; t < BET_PACKAGES.length; t++) {
          const pkg = BET_PACKAGES[t];
          const label = `${pkg.stake}→${pkg.payout}`;
          const tw = Math.ceil(ctx.measureText(label).width) + 24;
          if (tagX + tw > x + cw - 18) break;
          const active = Number(selectedPkg.stake) === Number(pkg.stake);
          fillRoundRect(ctx, tagX, tagY, tw, tagH, 10, active ? "rgba(255,181,74,0.22)" : "rgba(255,255,255,0.06)");
          strokeRoundRect(ctx, tagX, tagY, tw, tagH, 10, active ? "rgba(255,181,74,0.82)" : "rgba(255,255,255,0.10)", active ? 1.4 : 1);
          ctx.fillStyle = active ? "#ffd79a" : "rgba(255,255,255,0.92)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, tagX + tw / 2, tagY + tagH / 2);
          betRects.push({ x: tagX, y: tagY, w: tw, h: tagH, stake: pkg.stake });
          tagX += tw + 8;
        }

        this.cardRects.push({
          card,
          cardRect: { x, y, w: cw, h: cardH },
          btn: { x: btnX, y: btnY, w: btnW, h: btnH },
          betRects,
        });

        y += cardH + cardGap;
      }

      ctx.restore();

      if (this.matchState !== "menu") {
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.fillRect(panelX, panelY, panelW, panelH);
        this.renderSearchingOverlay(ctx, panelX, panelY, panelW, panelH);
      }

      if (this.maxScroll > 0) {
        const trackW = 4;
        const trackX = panelX + panelW - 8;
        const trackY = viewportTop;
        const trackH = viewportH;
        fillRoundRect(ctx, trackX, trackY, trackW, trackH, 4, "rgba(255,255,255,0.08)");

        const thumbH = Math.max(42, trackH * (viewportH / contentH));
        const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);
        fillRoundRect(ctx, trackX, thumbY, trackW, thumbH, 4, "rgba(255,181,74,0.78)");
      }
    }
  }

  window.PvpScene = PvpScene;

  const TonCrimePVPController = {
    _engine: null,
    _opts: null,
    _opponent: { username: "ShadowWolf", isBot: true },

    boot() {
      console.log("[TonCrime] PvP controller booted");
    },

    init(opts = {}) {
      this._opts = {
        arenaId: opts.arenaId || "arena",
        statusId: opts.statusId || "pvpStatus",
        enemyFillId: opts.enemyFillId || "enemyFill",
        meFillId: opts.meFillId || "meFill",
        enemyHpTextId: opts.enemyHpTextId || "enemyHpText",
        meHpTextId: opts.meHpTextId || "meHpText",
      };
    },

    setOpponent(opp) {
      this._opponent =
        opp && typeof opp.username === "string"
          ? { ...opp }
          : { username: "ShadowWolf", isBot: true };

      try {
        this._engine?.setOpponent?.(this._opponent);
      } catch (err) {
        console.error("[TonCrime] controller setOpponent error:", err);
      }
    },

    reset() {
      try { this._engine?.reset?.(); } catch (err) {}
    },

    start() {
      try { this._engine?.start?.(); } catch (err) {}
    },

    stop() {
      try { this._engine?.stop?.(); } catch (err) {}
    },
  };

  window.TonCrimePVP = TonCrimePVPController;
})();
