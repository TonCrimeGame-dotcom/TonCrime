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
          tags: ["Tekme", "Tokat", "Şifalı Bitki", "Beyin", "Yumruk", "KuruKafa"],
          open: true,
          accent: "#ffb24a",
        },
        {
          id: "arena",
          title: "Kafes Dövüşü",
          subtitle: "1v1 Kafes Dövüşü",
          desc: "Daha hızlı PvP modu. Kritik saldırılar, kısa maçlar ve direkt ödül.",
          tags: ["Hızlı", "yTon", "Düello", "XP"],
          open: true,
          accent: "#ff9340",
        },
        {
          id: "slotarena",
          title: "Slot Arena",
          subtitle: "Slot Tadında PvP",
          desc: "6x6 tumble slot PvP.",
          tags: ["Slot", "Tumble", "Bonus", "Çarpan", "PvP"],
          open: true,
          accent: "#ff5ea8",
        },
        {
          id: "tournament",
          title: "Kartel Turnuvası",
          subtitle: "Sezonluk PvP",
          desc: "Sezon puanı ve lig mantığı. Şimdilik yakında.",
          tags: ["Sezon", "Lig", "Ödül"],
          open: false,
          accent: "#7f7f86",
        },
      ];

      this.bg = null;
      this.fallbackBg = new Image();
      this.fallbackBg.src = "./assets/pvp-bg.png";
    }

    onEnter() {
      this.bg =
        getImageFromAssets(this.assets, "pvp_bg") ||
        getImageFromAssets(this.assets, "pvp-bg") ||
        getImageFromAssets(this.assets, "pvp") ||
        this.fallbackBg;

      const s = this.store?.get?.() || {};
      this.source = s?.pvp?.source || "general";
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
        const res = await sb.auth.getUser();
        return res?.data?.user?.id || null;
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
      const amIPlayer1 = match.player1_id === userId;
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

    _clearRealtime() {
      const sb = this._getSupabase();

      if (this.matchSearchTimer) {
        clearInterval(this.matchSearchTimer);
        clearTimeout(this.matchSearchTimer);
      }
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
      const userId = await this._getAuthUserId();
      const mode = this._mapModeIdToSqlMode(this.matchModeId);

      this._clearRealtime();

      if (!sb || !userId || !mode) return;

      try {
        await sb
          .from("pvp_match_queue")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("game_mode", mode)
          .eq("status", "searching");
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

    async startMatchmaking(id) {
      if (this._launchingGame) return;

      this._resetMatchmaking();
      this.matchState = "searching";
      this.matchModeId = id;
      this.matchStartedAt = Date.now();

      const sb = this._getSupabase();
      const userId = await this._getAuthUserId();
      const mode = this._mapModeIdToSqlMode(id);
      const player = this._getPlayerMeta();

      if (!sb || !userId || !mode) {
        this.matchSearchTimer = setTimeout(() => {
          if (this.matchState !== "searching") return;
          this.onMatchFound(this._makeOpponent());
        }, 1400);

        this.matchFallbackTimer = setTimeout(() => {
          if (this.matchState !== "searching") return;
          this.onMatchFound(this._makeOpponent());
        }, this.rtFallbackMs);
        return;
      }

      try {
        await sb
          .from("pvp_match_queue")
          .upsert(
            {
              user_id: userId,
              username: player.username,
              level: player.level,
              rank: player.rank,
              game_mode: mode,
              status: "searching",
              is_bot: false,
              matched_with: null,
              match_id: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,game_mode" }
          );

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
              if (this.rtMatchStarted || this.matchState !== "searching") return;
              this.rtMatchStarted = true;
              this.onMatchFound(
                this._buildOpponentFromMatch(payload.new, userId),
                this._buildMatchContext(payload.new, userId, id)
              );
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
              if (this.rtMatchStarted || this.matchState !== "searching") return;
              this.rtMatchStarted = true;
              this.onMatchFound(
                this._buildOpponentFromMatch(payload.new, userId),
                this._buildMatchContext(payload.new, userId, id)
              );
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              // İlk anda da bir kez dene
              sb.rpc("try_ranked_pvp_match", {
                p_user_id: userId,
                p_mode: mode,
              }).catch(() => {});
            }
          });

        // ✅ Her 1 saniyede bir tekrar eşleşme dene
        this.matchSearchTimer = setInterval(async () => {
          if (this.rtMatchStarted || this.matchState !== "searching") return;

          try {
            await sb.rpc("try_ranked_pvp_match", {
              p_user_id: userId,
              p_mode: mode,
            });
          } catch (_) {}
        }, 1000);

        // ✅ Sadece süre dolunca bot fallback
        this.matchFallbackTimer = setTimeout(async () => {
          if (this.rtMatchStarted || this.matchState !== "searching") return;

          try {
            await sb.rpc("create_bot_pvp_match", {
              p_user_id: userId,
              p_mode: mode,
            });
          } catch (_) {
            if (this.matchState === "searching") {
              this.onMatchFound(this._makeOpponent());
            }
          }
        }, this.rtFallbackMs);
      } catch (_) {
        this.matchSearchTimer = setTimeout(() => {
          if (this.matchState !== "searching") return;
          this.onMatchFound(this._makeOpponent());
        }, 1400);

        this.matchFallbackTimer = setTimeout(() => {
          if (this.matchState !== "searching") return;
          this.onMatchFound(this._makeOpponent());
        }, this.rtFallbackMs);
      }
    }

    onMatchFound(opponent, matchRecord = null) {
      if (this.matchState !== "searching") return;

      if (this.matchSearchTimer) {
        clearInterval(this.matchSearchTimer);
        clearTimeout(this.matchSearchTimer);
      }
      if (this.matchFallbackTimer) clearTimeout(this.matchFallbackTimer);
      this.matchSearchTimer = null;
      this.matchFallbackTimer = null;

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

      const ECONOMY = {
        grid: { energy: 10, coins: 20, reward: 36, fee: 4, modeKey: "iq_arena" },
        arena: { energy: 5, coins: 10, reward: 16, fee: 4, modeKey: "cage_fight" },
        slotarena: { energy: 15, coins: 30, reward: 56, fee: 4, modeKey: "slot_arena" },
      };

      const s = this.store?.get?.() || {};
      const pvp = { ...(s.pvp || {}) };
      const player = { ...(s.player || {}) };
      const economy = ECONOMY[id];

      pvp.selectedMode = id;
      pvp.source = this.source || "general";

      if (!economy) {
        this.store?.set?.({ pvp });
        this
