(function () {
  const GAME_MS = 45000;
  const ICON_LIFE_MS = 900;
  const REMOTE_MIN_ICON_MS = 260;
  const HOST_STATE_SYNC_MS = 120;
  const NEXT_ICON_DELAY_MIN_MS = 120;
  const NEXT_ICON_DELAY_MAX_MS = 260;
  const RESOLVED_GHOST_MS = 220;
  const START_HP = 1000;
  const FINAL_WARNING_SECONDS = 5;
  const FORFEIT_EXIT_DELAY_MS = 1450;
  const HEAL_SCORE_RATIO = 0.35;

const DAMAGE = {
  punch: 12,
  kick: 14,
  slap: 8,
  brain: 16,
  skull: 15,
  weedHeal: 25,
  drinkHeal: 18,
};

 const ICONS = [
  { id: "punch", emoji: "👊", label: "YUMRUK", color: "#ffb24a", damage: DAMAGE.punch, bad: false, heal: false, flash: "rgba(255,168,74,0.16)" },
  { id: "kick", emoji: "🦵", label: "TEKME", color: "#63e36c", damage: DAMAGE.kick, bad: false, heal: false, flash: "rgba(99,227,108,0.12)" },
  { id: "slap", emoji: "🖐", label: "TOKAT", color: "#7cb6ff", damage: DAMAGE.slap, bad: false, heal: false, flash: "rgba(124,182,255,0.14)" },
  { id: "brain", emoji: "🧠", label: "BEYIN", color: "#ff6464", damage: DAMAGE.brain, bad: false, heal: false, flash: "rgba(255,100,100,0.14)" },
  { id: "weed", emoji: "🌿", label: "OT", color: "#33dd77", damage: DAMAGE.weedHeal, bad: false, heal: true, flash: "rgba(51,221,119,0.18)" },
  { id: "drink", emoji: "🍺", label: "DRINK", color: "#ffd166", damage: DAMAGE.drinkHeal, bad: false, heal: true, flash: "rgba(255,209,102,0.18)" },
  { id: "skull", emoji: "💀", label: "KURU KAFA", color: "#ff4d6d", damage: DAMAGE.skull, bad: true, heal: false, flash: "rgba(255,77,109,0.20)" },
];

  const GOOD_ICONS = ICONS.filter((x) => !x.bad);

  const ICON_PATHS = {
    punch: "./assets/punch.png",
    kick: "./assets/kick.png",
    slap: "./assets/slap.png",
    brain: "./assets/brain.png",
    weed: "./assets/weed.png",
    drink: "./assets/drink.png",
    skull: "./assets/skull.png",
  };

  function loadImage(src) {
    return new Promise((resolve) => {
      const tries = [src];
      if (typeof src === "string" && src.startsWith("./assets/")) {
        tries.push(src.replace("./assets/", "./src/assets/"));
      } else if (typeof src === "string" && src.startsWith("./src/assets/")) {
        tries.push(src.replace("./src/assets/", "./assets/"));
      }
      let i = 0;
      const next = () => {
        if (i >= tries.length) return resolve(null);
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => next();
        img.src = tries[i++];
      };
      next();
    });
  }
  const BOT_NAMES = ["Rakip"];

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }


  function safeVibrate(pattern) {
    try {
      if (navigator && typeof navigator.vibrate === "function") {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  function getPvpRuntimeState() {
    return window.tcStore?.get?.() || {};
  }

  function getEstimatedPrizeYton() {
    const state = getPvpRuntimeState();
    const pvp = state?.pvp || {};
    const explicitPrize = Math.max(0, Number(pvp.prizeYton || pvp.rewardYton || pvp.rewardCoins || 0));
    const stake = Math.max(0, Number(pvp.entryStake || 0));
    const fee = Math.max(0, Number(pvp.serverFee || 0));
    if (explicitPrize > 0) return explicitPrize;
    if (stake > 0) return Math.max(0, stake * 2 - fee);
    return 0;
  }

  function buildResultReason(reason, meta = {}) {
    const base = String(reason || "").trim();
    if (meta?.forfeit && meta?.quitter === "me") return base || "Mactan ciktin - hukmen maglup";
    if (meta?.forfeit && meta?.quitter === "enemy") return base || "Rakip cikti - hukmen galip";
    return base || (meta?.win ? "Kazandin" : "Kaybettin");
  }

  function ensureAudioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      if (!api._soundCtx) api._soundCtx = new Ctx();
      if (api._soundCtx.state === "suspended") {
        api._soundCtx.resume().catch(() => {});
      }
      return api._soundCtx;
    } catch (_) {
      return null;
    }
  }

  function makeNoiseBuffer(ctx, duration = 0.2) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    return buffer;
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

  function pointInRect(px, py, r) {
    return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function ensureStyle() {
    const id = "tc-pvp-cage-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #pvpStart, #pvpStop, #pvpReset { display: none !important; }
      #pvpHeader { display: none !important; }
      #pvpBars { display: none !important; }

      #arena {
        position: relative;
        overflow: hidden;
        touch-action: none;
        background:
          radial-gradient(circle at 50% 20%, rgba(255,100,100,0.12), transparent 34%),
          radial-gradient(circle at 50% 80%, rgba(255,180,70,0.10), transparent 34%),
          linear-gradient(180deg, rgba(16,18,28,0.96), rgba(6,8,14,0.98)) !important;
      }

      #arena .tc-cage-root {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        padding: 10px;
        box-sizing: border-box;
        color: #fff;
        user-select: none;
      }

      #arena .tc-cage-top {
        position: relative;
        flex: 0 0 auto;
        padding-top: 4px;
        margin-bottom: 10px;
      }

      #arena .tc-cage-x {
        position: absolute;
        right: 0;
        top: 0;
        width: 36px;
        height: 36px;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 12px;
        background: rgba(0,0,0,0.34);
        color: rgba(255,255,255,0.92);
        font: 900 16px system-ui, Arial;
        backdrop-filter: blur(8px);
        cursor: pointer;
      }

      #arena .tc-cage-title-wrap {
        text-align: center;
        padding: 2px 42px 0;
      }

      #arena .tc-cage-neon {
        display: inline-block;
        font: 900 22px system-ui, Arial;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: #ff5858;
        text-shadow:
          0 0 4px rgba(255,88,88,0.95),
          0 0 10px rgba(255,88,88,0.95),
          0 0 18px rgba(255,40,40,0.92),
          0 0 34px rgba(255,0,0,0.78);
        animation: tcCageNeon 1.15s ease-in-out infinite alternate;
      }

      @keyframes tcCageNeon {
        0% {
          opacity: .76;
          transform: scale(0.995);
          text-shadow:
            0 0 3px rgba(255,88,88,0.84),
            0 0 8px rgba(255,88,88,0.84),
            0 0 16px rgba(255,20,20,0.74);
        }
        100% {
          opacity: 1;
          transform: scale(1.01);
          text-shadow:
            0 0 5px rgba(255,110,110,1),
            0 0 12px rgba(255,90,90,1),
            0 0 24px rgba(255,40,40,0.98),
            0 0 42px rgba(255,0,0,0.90);
        }
      }

      #arena .tc-cage-sub {
        margin-top: 6px;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.74);
        letter-spacing: .4px;
      }

      #arena .tc-cage-bar-shell {
        margin-top: 10px;
        height: 14px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.11);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      }

      #arena .tc-cage-time-fill {
        width: 100%;
        height: 100%;
        transform-origin: left center;
        background: linear-gradient(90deg, #ff5959, #ffb347);
        box-shadow: 0 0 14px rgba(255,120,70,0.30);
      }

      #arena .tc-cage-row {
        display: grid;
        grid-template-columns: 1fr 76px 1fr;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      #arena .tc-cage-vs {
        text-align: center;
        font: 900 16px system-ui, Arial;
        color: rgba(255,255,255,0.9);
      }

      #arena .tc-cage-card {
        min-height: 72px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(8px);
        padding: 10px 12px;
        box-sizing: border-box;
      }

      #arena .tc-cage-name {
        font: 900 13px system-ui, Arial;
        color: rgba(255,255,255,0.96);
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #arena .tc-cage-hpbar {
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.10);
      }

      #arena .tc-cage-hpfill {
        height: 100%;
        width: 100%;
        transform-origin: left center;
        background: linear-gradient(90deg, #2fe870, #88ffb0);
      }

      #arena .tc-cage-hptext {
        margin-top: 6px;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.76);
        text-align: right;
      }

      #arena .tc-cage-stage {
        position: relative;
        flex: 1 1 auto;
        min-height: 280px;
        border-radius: 20px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 52%, rgba(255,255,255,0.04), transparent 30%),
          linear-gradient(180deg, rgba(18,22,34,0.88), rgba(6,10,18,0.95));
        border: 1px solid rgba(255,255,255,0.08);
      }

      #arena .tc-cage-canvas {
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
      }

      #arena .tc-cage-toast {
        position: absolute;
        left: 50%;
        bottom: 14px;
        transform: translateX(-50%);
        min-width: 170px;
        max-width: calc(100% - 28px);
        padding: 11px 14px;
        border-radius: 14px;
        background: rgba(0,0,0,0.56);
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(8px);
        text-align: center;
        font: 900 12px system-ui, Arial;
        color: #fff;
        opacity: 0;
        transition: opacity .16s ease;
        pointer-events: none;
      }

      #arena .tc-cage-toast.on { opacity: 1; }

      #arena .tc-cage-rule {
        margin-top: 8px;
        text-align: center;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.65);
      }
    `;
    document.head.appendChild(style);
  }

  function makeMarkup() {
    return `
      <div class="tc-cage-root">
        <div class="tc-cage-top">
          <button class="tc-cage-x" id="tcCageClose" type="button" aria-label="Geri">X</button>

          <div class="tc-cage-title-wrap">
            <div class="tc-cage-neon">KAFES DOVUSU</div>
            <div class="tc-cage-sub" id="tcCageSub">45 saniye - hizli PvP</div>
          </div>

          <div class="tc-cage-bar-shell">
            <div class="tc-cage-time-fill" id="tcCageTimeFill"></div>
          </div>
        </div>

        <div class="tc-cage-row">
          <div class="tc-cage-card">
            <div class="tc-cage-name" id="tcCageEnemyName">Rakip</div>
            <div class="tc-cage-hpbar"><div class="tc-cage-hpfill" id="tcCageEnemyFill"></div></div>
            <div class="tc-cage-hptext" id="tcCageEnemyText">100 / 100</div>
          </div>

          <div class="tc-cage-vs" id="tcCageTimerText">45</div>

          <div class="tc-cage-card">
            <div class="tc-cage-name" id="tcCageMeName">Sen</div>
            <div class="tc-cage-hpbar"><div class="tc-cage-hpfill" id="tcCageMeFill"></div></div>
            <div class="tc-cage-hptext" id="tcCageMeText">100 / 100</div>
          </div>
        </div>

        <div class="tc-cage-stage" id="tcCageStage">
          <canvas class="tc-cage-canvas" id="tcCageCanvas"></canvas>
          <div class="tc-cage-toast" id="tcCageToast"></div>
        </div>

        <div class="tc-cage-rule">SKULL kendine vurur - WEED ve DRINK can basar</div>
      </div>
    `;
  }

  const api = {
    _els: null,
    _state: null,
    _running: false,
    _raf: 0,
    _unbind: null,
    _resizeObserver: null,
    _opponent: { username: "Rakip", isBot: false },
    _matchCtx: null,
    _isHost: false,
    _rtChannel: null,
    _rtSubscribed: false,
    _hostSyncTimer: 0,
    _peerSessionId: `cage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,

    init(opts = {}) {
      ensureStyle();

      const arena = document.getElementById(opts.arenaId || "arena");
      const status = document.getElementById(opts.statusId || "pvpStatus");
      const enemyFill = document.getElementById(opts.enemyFillId || "enemyFill");
      const meFill = document.getElementById(opts.meFillId || "meFill");
      const enemyHpText = document.getElementById(opts.enemyHpTextId || "enemyHpText");
      const meHpText = document.getElementById(opts.meHpTextId || "meHpText");

      if (!arena) return;

      this.stop();
      this._destroyEvents();

      arena.innerHTML = makeMarkup();

      const canvas = arena.querySelector("#tcCageCanvas");
      const ctx = canvas.getContext("2d");

      this._els = {
        arena,
        status,
        enemyFill,
        meFill,
        enemyHpText,
        meHpText,
        rootEnemyFill: arena.querySelector("#tcCageEnemyFill"),
        rootMeFill: arena.querySelector("#tcCageMeFill"),
        rootEnemyText: arena.querySelector("#tcCageEnemyText"),
        rootMeText: arena.querySelector("#tcCageMeText"),
        timeFill: arena.querySelector("#tcCageTimeFill"),
        timerText: arena.querySelector("#tcCageTimerText"),
        sub: arena.querySelector("#tcCageSub"),
        toast: arena.querySelector("#tcCageToast"),
        enemyName: arena.querySelector("#tcCageEnemyName"),
        meName: arena.querySelector("#tcCageMeName"),
        close: arena.querySelector("#tcCageClose"),
        stage: arena.querySelector("#tcCageStage"),
        canvas,
        ctx,
      };

      this.reset();
      this._bindEvents();
      this._resizeCanvas();
      this._render();
      this._updateHud();
      this._preloadAssets();
    },

    async _preloadAssets() {
      this._assetsReady = false;
      const out = {};
      await Promise.all(Object.keys(ICON_PATHS).map(async (key) => {
        out[key] = await loadImage(ICON_PATHS[key]);
      }));
      this._iconImages = out;
      this._assetsReady = true;
      this._render();
    },


    setMatchContext(ctx) {
      this._matchCtx = ctx && ctx.matchId ? { ...ctx } : null;
      this._isHost = !!this._matchCtx?.amIPlayer1;
      this._teardownRealtime();
      if (this._matchCtx?.matchId) this._ensureRealtime();
    },

    _getRealtimeClient() {
      return window.tcSupabase || window.supabase || null;
    },

    _getChannelName() {
      return this._matchCtx?.matchId ? `tc-pvpcage-${this._matchCtx.matchId}` : "";
    },

    _isPlayer1Local() {
      return !!this._matchCtx?.amIPlayer1;
    },

    _localActorToCanonical(localActor) {
      if (localActor === "me") return this._isPlayer1Local() ? "player1" : "player2";
      return this._isPlayer1Local() ? "player2" : "player1";
    },

    _canonicalActorToLocal(actor) {
      if (actor === "player1") return this._isPlayer1Local() ? "me" : "enemy";
      return this._isPlayer1Local() ? "enemy" : "me";
    },

    _serializeIcon(cur) {
      if (!cur) return null;
      return {
        id: cur.id,
        label: cur.label,
        color: cur.color,
        damage: cur.damage,
        bad: !!cur.bad,
        heal: !!cur.heal,
        flash: cur.flash,
        x: cur.x,
        y: cur.y,
        w: cur.w,
        h: cur.h,
        seq: cur.seq || 0,
        bornAtEpoch: cur.bornAtEpoch || Date.now(),
        expiresAtEpoch: cur.expiresAtEpoch || (Date.now() + ICON_LIFE_MS),
      };
    },

    _applySerializedIcon(raw) {
      if (!this._state) return;
      if (!raw) {
        this._state.currentIcon = null;
        return;
      }
      const nowEpoch = Date.now();
      const nowPerf = performance.now();
      const bornEpoch = Number(raw.bornAtEpoch || nowEpoch);
      const bornLag = Math.max(0, nowEpoch - bornEpoch);
      const remainingMs = Math.max(REMOTE_MIN_ICON_MS, Number(raw.expiresAtEpoch || (nowEpoch + ICON_LIFE_MS)) - nowEpoch);
      this._state.currentIcon = {
        id: raw.id,
        label: raw.label,
        color: raw.color,
        damage: raw.damage,
        bad: !!raw.bad,
        heal: !!raw.heal,
        flash: raw.flash,
        x: Number(raw.x || 0),
        y: Number(raw.y || 0),
        w: Number(raw.w || 64),
        h: Number(raw.h || 64),
        seq: Number(raw.seq || 0),
        bornAtEpoch: bornEpoch,
        expiresAtEpoch: nowEpoch + remainingMs,
        bornAt: nowPerf - bornLag,
        expiresAt: nowPerf + remainingMs,
        hit: !!raw.hit,
        pending: false,
        resolvedGhost: !!raw.resolvedGhost,
        holdUntil: Number(raw.holdUntil || 0),
      };
    },

    _canonicalStateFromLocal() {
      if (!this._state) return null;
      const p1 = this._isPlayer1Local();
      return {
        player1Hp: Math.round(p1 ? this._state.meHp : this._state.enemyHp),
        player2Hp: Math.round(p1 ? this._state.enemyHp : this._state.meHp),
        player1Damage: Math.round(p1 ? this._state.meDamageDealt : this._state.enemyDamageDealt),
        player2Damage: Math.round(p1 ? this._state.enemyDamageDealt : this._state.meDamageDealt),
        player1Hits: Math.round(p1 ? this._state.meHits : this._state.enemyHits),
        player2Hits: Math.round(p1 ? this._state.enemyHits : this._state.meHits),
        player1Healed: Math.round(p1 ? this._state.meHealed : this._state.enemyHealed),
        player2Healed: Math.round(p1 ? this._state.enemyHealed : this._state.meHealed),
        player1Score: Math.round(p1 ? this._state.meDamageDealt : this._state.enemyDamageDealt),
        player2Score: Math.round(p1 ? this._state.enemyDamageDealt : this._state.meDamageDealt),
        remaining: Math.max(0, Math.round(this._state.remaining || 0)),
        endAtEpoch: Math.round(this._state.endAtEpoch || (Date.now() + this._state.remaining || 0)),
        finished: !!this._state.finished,
        finishReason: this._state.finishReason || "",
        winnerCanonical: this._state.finished ? this._localActorToCanonical(this._state.winner || "enemy") : null,
        prizeYton: Math.round(this._state.resultPrizeYton || 0),
        icon: this._serializeIcon(this._state.currentIcon),
      };
    },

    _applyCanonicalState(snapshot, opts = {}) {
      if (!this._state || !snapshot) return;
      const p1 = this._isPlayer1Local();
      this._state.meHp = Number(p1 ? snapshot.player1Hp : snapshot.player2Hp) || 0;
      this._state.enemyHp = Number(p1 ? snapshot.player2Hp : snapshot.player1Hp) || 0;
      this._state.meDamageDealt = Number(p1 ? snapshot.player1Damage : snapshot.player2Damage) || 0;
      this._state.enemyDamageDealt = Number(p1 ? snapshot.player2Damage : snapshot.player1Damage) || 0;
      this._state.meHits = Number(p1 ? snapshot.player1Hits : snapshot.player2Hits) || 0;
      this._state.enemyHits = Number(p1 ? snapshot.player2Hits : snapshot.player1Hits) || 0;
      this._state.meHealed = Number(p1 ? snapshot.player1Healed : snapshot.player2Healed) || 0;
      this._state.enemyHealed = Number(p1 ? snapshot.player2Healed : snapshot.player1Healed) || 0;
      this._state.meScore = Number(p1 ? snapshot.player1Score : snapshot.player2Score) || this._state.meDamageDealt || 0;
      this._state.enemyScore = Number(p1 ? snapshot.player2Score : snapshot.player1Score) || this._state.enemyDamageDealt || 0;
      this._state.remaining = clamp(Number(snapshot.remaining || 0), 0, GAME_MS);
      this._state.endAtEpoch = Number(snapshot.endAtEpoch || (Date.now() + this._state.remaining));
      if (Object.prototype.hasOwnProperty.call(snapshot, "icon")) {
        if (snapshot.icon) {
          this._applySerializedIcon(snapshot.icon);
        } else {
          const keepGhost =
            !!this._state.currentIcon?.resolvedGhost &&
            Number(this._state.currentIcon?.holdUntil || 0) > performance.now();
          if (!keepGhost) this._applySerializedIcon(null);
        }
      }
      if (!opts.skipFinished && snapshot.finished) {
        this._applyRemoteFinish({
          reason: snapshot.finishReason || "Mac bitti",
          winnerCanonical: snapshot.winnerCanonical || null,
          prizeYton: Number(snapshot.prizeYton || 0),
          state: snapshot,
        });
      }
    },

    _showResolvedGhost(raw) {
      if (!this._state || !raw) return;
      const nowEpoch = Date.now();
      const nowPerf = performance.now();
      const holdMs = Math.max(RESOLVED_GHOST_MS, REMOTE_MIN_ICON_MS);
      this._state.currentIcon = {
        id: raw.id,
        label: raw.label,
        color: raw.color,
        damage: Number(raw.damage || 0),
        bad: !!raw.bad,
        heal: !!raw.heal,
        flash: raw.flash,
        x: Number(raw.x || 0),
        y: Number(raw.y || 0),
        w: Number(raw.w || 64),
        h: Number(raw.h || 64),
        seq: Number(raw.seq || 0),
        bornAtEpoch: nowEpoch - 60,
        expiresAtEpoch: nowEpoch + holdMs,
        bornAt: nowPerf - 60,
        expiresAt: nowPerf + holdMs,
        hit: true,
        pending: false,
        resolvedGhost: true,
        holdUntil: nowPerf + holdMs,
      };
    },

    _playResolvedFx(raw, actorCanonical) {
      if (!this._state || !raw) return;
      const actorLocal = this._canonicalActorToLocal(String(actorCanonical || "player1"));
      let toastText = "";
      let anchor = actorLocal === "me" ? 0.72 : 0.28;
      if (raw.bad) {
        anchor = actorLocal === "me" ? 0.72 : 0.28;
        toastText = actorLocal === "me" ? `SKULL -${raw.damage} HP` : `Rakip SKULL -${raw.damage} HP`;
      } else if (raw.heal) {
        anchor = actorLocal === "me" ? 0.72 : 0.28;
        toastText = actorLocal === "me" ? `${raw.label} +${raw.damage} HP` : `Rakip ${raw.label} +${raw.damage} HP`;
      } else {
        anchor = actorLocal === "me" ? 0.28 : 0.72;
        toastText = actorLocal === "me" ? `${raw.label} -${raw.damage} HP` : `Rakip ${raw.label} -${raw.damage} HP`;
      }
      this._showResolvedGhost(raw);
      this._state.hitFlashUntil = performance.now() + 110;
      this._state.hitFlashColor = raw.flash || "rgba(255,255,255,0.05)";
      this._flashScreen(raw.flash || "rgba(255,255,255,0.08)", 170);
      this._playIconSound(raw.id || "punch");
      this._toast(toastText, 520);
      this._spawnBurst(anchor, raw.color || "#ff965a");
    },

    _ensureRealtime() {
      if (!this._matchCtx?.matchId || this._rtChannel) return;
      const sb = this._getRealtimeClient();
      if (!sb?.channel) return;
      const ch = sb.channel(this._getChannelName(), { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "pvpcage" }, (payload) => {
        this._onRealtimeMessage(payload?.payload || null);
      });
      ch.subscribe((status) => {
        this._rtSubscribed = status === "SUBSCRIBED";
        if (!this._rtSubscribed) return;
        if (this._isHost && this._state?.startedAt > 0 && !this._state?.finished) {
          this._broadcastStartSnapshot();
        }
        if (!this._isHost) {
          this._broadcast("peer_ready", {});
        }
      });
      this._rtChannel = ch;
    },

    _teardownRealtime() {
      clearInterval(this._hostSyncTimer);
      this._hostSyncTimer = 0;
      const sb = this._getRealtimeClient();
      if (this._rtChannel && sb?.removeChannel) {
        try { sb.removeChannel(this._rtChannel); } catch (_) {}
      }
      this._rtChannel = null;
      this._rtSubscribed = false;
    },

    _broadcast(type, data = {}) {
      if (!this._rtChannel?.send || !this._matchCtx?.matchId) return;
      try {
        this._rtChannel.send({
          type: "broadcast",
          event: "pvpcage",
          payload: {
            type,
            at: Date.now(),
            sessionId: this._peerSessionId,
            matchId: this._matchCtx.matchId,
            data,
          },
        });
      } catch (_) {}
    },

    _broadcastStartSnapshot() {
      if (!this._state) return;
      this._broadcast("match_start", {
        endAtEpoch: Number(this._state.endAtEpoch || (Date.now() + GAME_MS)),
        state: this._canonicalStateFromLocal(),
      });
    },

    _startHostSync() {
      clearInterval(this._hostSyncTimer);
      if (!this._matchCtx?.matchId || !this._isHost) return;
      this._hostSyncTimer = setInterval(() => {
        if (!this._state || this._state.finished) return;
        this._broadcast("state_sync", { state: this._canonicalStateFromLocal() });
      }, HOST_STATE_SYNC_MS);
    },

    _onRealtimeMessage(msg) {
      if (!msg || msg.sessionId === this._peerSessionId) return;
      const data = msg.data || {};
      switch (msg.type) {
        case "peer_ready":
          if (this._isHost && this._state?.startedAt > 0 && !this._state?.finished) this._broadcastStartSnapshot();
          break;
        case "match_start":
          if (this._isHost || !this._state) break;
          this._state.endAtEpoch = Number(data.endAtEpoch || (Date.now() + GAME_MS));
          this._state.startedAt = performance.now();
          this._state.lastTs = performance.now();
          this._state.waitingForHost = false;
          this._state.syncMode = true;
          this._applyCanonicalState(data.state || {}, { skipFinished: false });
          this._setStatus("PvP - Kafes dovusu basladi");
          break;
        case "state_sync":
          if (this._isHost || !this._state) break;
          this._state.waitingForHost = false;
          this._applyCanonicalState(data.state || {}, { skipFinished: false });
          break;
        case "icon_spawn":
          if (this._isHost || !this._state) break;
          this._state.waitingForHost = false;
          this._applySerializedIcon(data.icon || null);
          break;
        case "icon_resolved":
          if (this._isHost || !this._state) break;
          this._state.waitingForHost = false;
          if (data.state) this._applyCanonicalState(data.state || {}, { skipFinished: false });
          this._playResolvedFx(data.icon || null, data.actor || "player1");
          break;
        case "action_request":
          if (!this._isHost || !this._state || this._state.finished) break;
          this._resolveNetworkAction(data || {});
          break;
        case "forfeit":
          if (!this._isHost || !this._state || this._state.finished) break;
          this._resolveRemoteForfeit(data || {});
          break;
        case "match_finish":
          if (this._isHost) break;
          this._applyRemoteFinish(data || {});
          break;
      }
    },

    _resolveNetworkAction(data) {
      const cur = this._state?.currentIcon;
      if (!cur || cur.hit) return;
      if (Number(data.seq || -1) !== Number(cur.seq || 0)) return;
      const actorCanonical = String(data.actor || "player2");
      const localActor = this._canonicalActorToLocal(actorCanonical);
      this._resolveIconAction(cur, localActor, true);
    },

    _resolveRemoteForfeit(data) {
      const quitterCanonical = String(data.quitter || "player2");
      const quitterLocal = this._canonicalActorToLocal(quitterCanonical);
      const win = quitterLocal !== "me";
      this._finish(win, win ? "Rakip cikti - hukmen galip" : "Mactan ciktin - hukmen maglup", {
        forfeit: true,
        quitter: quitterLocal === "me" ? "me" : "enemy",
        remoteSync: true,
      });
    },

    _broadcastStateSync(includeFinish = false) {
      if (!this._matchCtx?.matchId || !this._isHost) return;
      const snapshot = this._canonicalStateFromLocal();
      this._broadcast("state_sync", { state: snapshot });
      if (includeFinish && snapshot?.finished) {
        this._broadcast("match_finish", {
          reason: snapshot.finishReason || "Mac bitti",
          winnerCanonical: snapshot.winnerCanonical || null,
          prizeYton: Number(snapshot.prizeYton || 0),
          state: snapshot,
        });
      }
    },

    _applyRemoteFinish(data) {
      if (!this._state || this._state.finished) return;
      if (data.state) this._applyCanonicalState(data.state, { skipFinished: true });
      const winnerCanonical = data.winnerCanonical || null;
      const localWinner = winnerCanonical ? this._canonicalActorToLocal(winnerCanonical) : "enemy";
      const win = localWinner === "me";
      this._state.finished = true;
      this._state.winner = localWinner;
      this._state.finishAt = Date.now();
      this._state.finishReason = String(data.reason || (win ? "Kazandin" : "Kaybettin"));
      this._state.finishMeta = { remoteSync: true, win };
      this._state.resultPrizeYton = win ? Number(data.prizeYton || getEstimatedPrizeYton() || 0) : 0;
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      this._setStatus(win ? "PvP - Kazandin" : "PvP - Kaybettin");
      this._toast(win ? "Kazandin!" : "Kaybettin!", 1200);
      this._recordResult(win, this._state.finishReason, { remoteSync: true });
      this._updateHud();
      this._render();
    },

    _resolveIconAction(cur, actorLocal, fromNetwork = false) {
      if (!this._state || !cur || cur.hit || this._state.finished) return false;
      const resolvedIcon = this._serializeIcon({
        ...cur,
        hit: true,
        resolvedGhost: true,
        holdUntil: performance.now() + RESOLVED_GHOST_MS,
        expiresAtEpoch: Date.now() + RESOLVED_GHOST_MS,
      });
      cur.hit = true;
      this._state.currentIcon = null;

      if (cur.bad) {
        this._applyDamage(actorLocal, cur.damage, actorLocal === "me" ? `SKULL -${cur.damage} HP` : `Rakip SKULL -${cur.damage} HP`, cur, actorLocal);
      } else if (cur.heal) {
        if (actorLocal === "me") this._healMe(cur.damage, `${cur.label} +${cur.damage} HP`, cur);
        else this._healEnemy(cur.damage, `Rakip ${cur.label} +${cur.damage} HP`, cur);
      } else {
        const target = actorLocal === "me" ? "enemy" : "me";
        const toast = actorLocal === "me" ? `${cur.label} -${cur.damage} HP` : `Rakip ${cur.label} -${cur.damage} HP`;
        this._applyDamage(target, cur.damage, toast, cur, actorLocal);
      }

      this._checkFinish();
      if (this._matchCtx?.matchId && this._isHost) {
        this._broadcast("icon_resolved", {
          icon: resolvedIcon,
          actor: this._localActorToCanonical(actorLocal),
          state: this._canonicalStateFromLocal(),
          fromNetwork: !!fromNetwork,
        });
        this._broadcastStateSync(false);
      }
      return true;
    },

    setOpponent(opp) {
      this._opponent =
        opp && typeof opp.username === "string" && opp.username.trim()
          ? { ...opp, isBot: false }
          : { username: "Rakip", isBot: false };

      if (this._els?.enemyName) {
        this._els.enemyName.textContent = this._opponent.username;
      }
    },

    reset() {
      const playerName =
        String(window.tcStore?.get?.()?.player?.username || "Sen").trim() || "Sen";

      clearTimeout(this._toastTimer);
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;
      this._resultRecorded = false;

      this._state = {
        startedAt: 0,
        elapsed: 0,
        remaining: GAME_MS,
        meHp: START_HP,
        enemyHp: START_HP,
        finished: false,
        winner: null,
        finishAt: 0,
        finishReason: "",
        finishMeta: null,
        resultPrizeYton: 0,
        lastTs: 0,
        playerName,
        nextSpawnAt: 0,
        endAtEpoch: 0,
        waitingForHost: false,
        syncMode: !!this._matchCtx?.matchId,
        currentIcon: null,
        iconSeq: 0,
        particles: [],
        hitFlashUntil: 0,
        hitFlashColor: "rgba(255,255,255,0.04)",
        screenFlashUntil: 0,
        screenFlashColor: "rgba(255,255,255,0.08)",
        botNextActionAt: 0,
        lastWarningSecond: null,
        meHits: 0,
        enemyHits: 0,
        meDamageDealt: 0,
        enemyDamageDealt: 0,
        meHealed: 0,
        enemyHealed: 0,
        meScore: 0,
        enemyScore: 0,
      };

      if (this._els?.meName) this._els.meName.textContent = playerName;
      if (this._els?.enemyName) this._els.enemyName.textContent = this._opponent?.username || choice(BOT_NAMES);

      this._toast("Hazir");
      this._setStatus("PvP - Kafes dovusu hazir");
      this._updateHud();
      this._render();
    },

    start() {
      if (!this._els || !this._state) return;
      this.reset();
      this._ensureRealtime();

      const now = performance.now();
      this._running = true;
      this._state.lastTs = now;
      this._state.lastWarningSecond = null;
      this._state.botNextActionAt = Number.POSITIVE_INFINITY;

      if (this._matchCtx?.matchId) {
        this._state.syncMode = true;
        this._state.endAtEpoch = Date.now() + GAME_MS;
        if (this._isHost) {
          this._state.startedAt = now;
          this._state.nextSpawnAt = now + 180;
          this._state.waitingForHost = false;
          this._setStatus("PvP - Kafes dovusu basladi");
          this._toast("Basladi");
          this._broadcastStartSnapshot();
          this._startHostSync();
        } else {
          this._state.startedAt = now;
          this._state.nextSpawnAt = Number.POSITIVE_INFINITY;
          this._state.waitingForHost = true;
          this._setStatus("PvP - Esitleme bekleniyor");
          this._toast("Baglanti kuruluyor", 900);
          this._broadcast("peer_ready", {});
        }
        this._loop();
        return;
      }

      this._state.startedAt = now;
      this._state.endAtEpoch = Date.now() + GAME_MS;
      this._state.nextSpawnAt = now + 180;
      this._setStatus("PvP - Kafes dovusu basladi");
      this._toast("Basladi");
      this._loop();
    },

    stop() {
      clearInterval(this._hostSyncTimer);
      this._hostSyncTimer = 0;
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    },

    forfeit(side = "me", reason = "") {
      if (!this._state || this._state.finished) return false;
      const quitter = side === "enemy" ? "enemy" : "me";
      const win = quitter === "enemy";
      if (this._matchCtx?.matchId && !this._isHost && quitter === "me") {
        this._broadcast("forfeit", { quitter: this._localActorToCanonical("me") });
      }
      return this._finish(win, reason, {
        forfeit: true,
        quitter,
        autoClose: quitter === "me",
      });
    },

    resolveOpponentQuit(reason = "") {
      return this.forfeit("enemy", reason || "Rakip cikti - hukmen galip");
    },

    backToMenu() {
      this.stop();
      this._teardownRealtime();
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;

      const wrap = document.getElementById("pvpWrap");
      const arena = document.getElementById("arena");
      const status = document.getElementById("pvpStatus");
      const opponent = document.getElementById("pvpOpponent");
      const spinner = document.getElementById("pvpSpinner");

      if (arena) arena.innerHTML = "";
      if (wrap) {
        wrap.classList.remove("open");
        wrap.style.display = "none";
      }
      if (status) status.textContent = "PvP - Hazir";
      if (opponent) opponent.textContent = "-";
      if (spinner) spinner.classList.add("hidden");
    },

    _setStatus(text) {
      if (this._els?.status) this._els.status.textContent = text;
    },

    _toast(text, ms = 850) {
      if (!this._els?.toast) return;
      this._els.toast.textContent = String(text || "");
      this._els.toast.classList.add("on");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        if (this._els?.toast) this._els.toast.classList.remove("on");
      }, ms);
    },

    _loop() {
      if (!this._running || !this._state || !this._els?.ctx) return;

      this._raf = requestAnimationFrame(() => this._loop());

      const now = performance.now();
      const dt = clamp((now - this._state.lastTs) / 16.6667, 0.25, 2.2);
      this._state.lastTs = now;

      if (this._state.endAtEpoch) {
        this._state.remaining = clamp(this._state.endAtEpoch - Date.now(), 0, GAME_MS);
        this._state.elapsed = GAME_MS - this._state.remaining;
      } else {
        this._state.elapsed = now - this._state.startedAt;
        this._state.remaining = clamp(GAME_MS - this._state.elapsed, 0, GAME_MS);
      }

      this._warnFinalCountdown();
      this._updateIcon(now);
      this._updateBot(now);
      this._updateParticles(dt);
      this._checkFinish();
      this._updateHud();
      this._render();
    },

    _warnFinalCountdown() {
      const s = this._state;
      if (!s || s.finished || s.remaining <= 0) return;
      const sec = Math.ceil(s.remaining / 1000);
      if (sec > FINAL_WARNING_SECONDS) return;
      if (s.lastWarningSecond === sec) return;
      s.lastWarningSecond = sec;
      this._flashScreen("rgba(255,88,88,0.18)", 180);
      safeVibrate(sec <= 2 ? [110, 45, 110] : 90);
      this._toast(`${sec} saniye kaldi`, 420);
    },

    _updateIcon(now) {
      if (!this._state || this._state.finished) return;
      if (this._state.syncMode && !this._isHost) return;
      if (!this._assetsReady) return;

      const cur = this._state.currentIcon;
      if (cur && now >= cur.expiresAt) {
        this._state.currentIcon = null;
      }

      if (!this._state.currentIcon && now >= this._state.nextSpawnAt) {
        this._spawnIcon(now);
      }
    },

    _spawnIcon(now) {
      const canvas = this._els?.canvas;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const w = Math.max(220, Math.round(rect.width || 0));
      const h = Math.max(180, Math.round(rect.height || 0));

      const icon = Math.random() < 0.22 ? ICONS.find((x) => x.id === "skull") : choice(GOOD_ICONS);
      const size = clamp(Math.round(Math.min(w, h) * rand(0.16, 0.22)), 52, 92);

      const x = rand(12, Math.max(12, w - size - 12));
      const y = rand(12, Math.max(12, h - size - 12));

      const bornAtEpoch = Date.now();
      const expiresAtEpoch = bornAtEpoch + ICON_LIFE_MS;
      this._state.currentIcon = {
        ...icon,
        x,
        y,
        w: size,
        h: size,
        seq: (this._state.iconSeq || 0) + 1,
        bornAtEpoch,
        expiresAtEpoch,
        bornAt: now,
        expiresAt: now + ICON_LIFE_MS,
        hit: false,
      };
      this._state.iconSeq = this._state.currentIcon.seq;

      if (this._matchCtx?.matchId && this._isHost) {
        this._broadcast("icon_spawn", { icon: this._serializeIcon(this._state.currentIcon) });
        this._broadcast("state_sync", { state: this._canonicalStateFromLocal() });
      }

      this._state.nextSpawnAt = now + randInt(NEXT_ICON_DELAY_MIN_MS, NEXT_ICON_DELAY_MAX_MS);
    },

    _updateBot(now) {
      return;
    },

    _applyDamage(target, dmg, toastText, iconMeta = null, source = null) {
      if (!this._state || this._state.finished) return;

      const amount = Math.max(0, Number(dmg || 0));
      if (target === "enemy") {
        this._state.enemyHp = clamp(this._state.enemyHp - amount, 0, START_HP);
      } else {
        this._state.meHp = clamp(this._state.meHp - amount, 0, START_HP);
      }

      const actor = source || (target === "enemy" ? "me" : "enemy");
      if (actor === "me") {
        this._state.meHits += 1;
        if (target === "enemy") {
          this._state.meDamageDealt += amount;
          this._state.meScore += amount;
        }
      } else {
        this._state.enemyHits += 1;
        if (target === "me") {
          this._state.enemyDamageDealt += amount;
          this._state.enemyScore += amount;
        }
      }

      this._state.hitFlashUntil = performance.now() + 110;
      this._state.hitFlashColor = iconMeta?.flash || "rgba(255,255,255,0.05)";
      this._flashScreen(iconMeta?.flash || "rgba(255,255,255,0.08)", 170);
      this._playIconSound(iconMeta?.id || "punch");
      this._toast(toastText, 620);
      this._spawnBurst(target === "enemy" ? 0.28 : 0.72, iconMeta?.color || "#ff965a");
    },

    _healMe(amount, toastText, iconMeta = null) {
      if (!this._state || this._state.finished) return;

      const heal = Math.max(0, Number(amount || 0));
      this._state.meHp = clamp(this._state.meHp + heal, 0, START_HP);
      this._state.meHealed += heal;
      this._state.meScore += Math.round(heal * HEAL_SCORE_RATIO);
      this._state.hitFlashUntil = performance.now() + 110;
      this._state.hitFlashColor = iconMeta?.flash || "rgba(51,221,119,0.16)";
      this._flashScreen(iconMeta?.flash || "rgba(51,221,119,0.18)", 190);
      this._playIconSound(iconMeta?.id || "weed");
      this._toast(toastText, 620);
      this._spawnBurst(0.72, iconMeta?.color || "#33dd77");
    },

    _healEnemy(amount, toastText, iconMeta = null) {
      if (!this._state || this._state.finished) return;

      const heal = Math.max(0, Number(amount || 0));
      this._state.enemyHp = clamp(this._state.enemyHp + heal, 0, START_HP);
      this._state.enemyHealed += heal;
      this._state.enemyScore += Math.round(heal * HEAL_SCORE_RATIO);
      this._state.hitFlashUntil = performance.now() + 110;
      this._state.hitFlashColor = iconMeta?.flash || "rgba(255,209,102,0.16)";
      this._flashScreen(iconMeta?.flash || "rgba(255,209,102,0.18)", 170);
      this._playIconSound(iconMeta?.id || "drink");
      this._toast(toastText, 620);
      this._spawnBurst(0.28, iconMeta?.color || "#ffd166");
    },

    _flashScreen(color, ms = 170) {
      if (!this._state) return;
      this._state.screenFlashColor = color || "rgba(255,255,255,0.08)";
      this._state.screenFlashUntil = performance.now() + ms;
    },

    _playIconSound(iconId) {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.045;
      master.connect(ctx.destination);

      const makeTone = (type, f1, f2, dur, vol, q = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f1, now);
        if (f2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), now + dur);
        gain.gain.setValueAtTime(Math.max(0.0001, vol), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        if (q > 0) {
          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.frequency.value = Math.max(80, f1);
          filter.Q.value = q;
          osc.connect(filter);
          filter.connect(gain);
        } else {
          osc.connect(gain);
        }
        gain.connect(master);
        osc.start(now);
        osc.stop(now + dur + 0.02);
      };

      const makeNoise = (dur, vol, filterType = "highpass", filterFreq = 900, q = 0.7) => {
        const src = ctx.createBufferSource();
        src.buffer = makeNoiseBuffer(ctx, dur);
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;
        filter.Q.value = q;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(Math.max(0.0001, vol), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(now);
        src.stop(now + dur + 0.02);
      };

      switch (iconId) {
        case "skull":
          makeTone("sawtooth", 220, 72, 0.34, 0.06);
          makeTone("triangle", 480, 110, 0.28, 0.03);
          makeNoise(0.22, 0.04, "bandpass", 640, 1.2);
          break;
        case "weed":
          makeNoise(0.09, 0.028, "highpass", 2400, 0.5);
          setTimeout(() => {
            const t = ensureAudioContext();
            if (!t) return;
            const n2 = t.currentTime;
            const o = t.createOscillator();
            const g = t.createGain();
            o.type = "triangle";
            o.frequency.setValueAtTime(320, n2);
            o.frequency.exponentialRampToValueAtTime(120, n2 + 0.18);
            g.gain.setValueAtTime(0.02, n2);
            g.gain.exponentialRampToValueAtTime(0.0001, n2 + 0.18);
            o.connect(g); g.connect(t.destination);
            o.start(n2); o.stop(n2 + 0.2);
          }, 40);
          break;
        case "drink":
          makeTone("triangle", 980, 760, 0.09, 0.03);
          setTimeout(() => {
            const t = ensureAudioContext();
            if (!t) return;
            const n2 = t.currentTime;
            const o1 = t.createOscillator(); const o2 = t.createOscillator();
            const g = t.createGain();
            o1.type = "sine"; o2.type = "sine";
            o1.frequency.value = 1420; o2.frequency.value = 1850;
            g.gain.setValueAtTime(0.02, n2);
            g.gain.exponentialRampToValueAtTime(0.0001, n2 + 0.12);
            o1.connect(g); o2.connect(g); g.connect(t.destination);
            o1.start(n2); o2.start(n2);
            o1.stop(n2 + 0.12); o2.stop(n2 + 0.12);
          }, 20);
          break;
        case "kick":
        case "brain":
          makeTone("sine", 120, 58, 0.16, 0.06);
          makeNoise(0.06, 0.03, "lowpass", 780, 0.8);
          break;
        case "punch":
          makeTone("sine", 155, 70, 0.12, 0.055);
          makeNoise(0.04, 0.02, "bandpass", 980, 0.9);
          break;
        case "slap":
          makeNoise(0.08, 0.05, "bandpass", 1400, 1.3);
          makeTone("triangle", 360, 210, 0.07, 0.014);
          break;
        default:
          makeTone("sine", 180, 90, 0.08, 0.04);
      }
    },
    _spawnBurst(anchorXRatio, color = "#ff965a") {
      const canvas = this._els?.canvas;
      if (!canvas || !this._state) return;

      const rect = canvas.getBoundingClientRect();
      const cx = (rect.width || 300) * anchorXRatio;
      const cy = (rect.height || 300) * 0.24;

      for (let i = 0; i < 12; i++) {
        this._state.particles.push({
          x: cx,
          y: cy,
          vx: rand(-2.8, 2.8),
          vy: rand(-2.8, 1.2),
          life: rand(0.4, 0.95),
          size: rand(2.5, 6),
          alpha: rand(0.25, 0.65),
          color,
        });
      }
    },

    _updateParticles(dt) {
      if (!this._state?.particles?.length) return;

      for (let i = this._state.particles.length - 1; i >= 0; i--) {
        const p = this._state.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.10 * dt;
        p.life -= 0.025 * dt;
        if (p.life <= 0) this._state.particles.splice(i, 1);
      }
    },

    _bindEvents() {
      const canvas = this._els?.canvas;
      const close = this._els?.close;
      if (!canvas) return;

      const getPos = (ev) => {
        const src = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
        const rect = canvas.getBoundingClientRect();
        return {
          x: src.clientX - rect.left,
          y: src.clientY - rect.top,
        };
      };

      const onDown = (ev) => {
        if (!this._running || !this._state || this._state.finished) return;
        const p = getPos(ev);
        this._handleTap(p.x, p.y);
        ev.preventDefault?.();
      };

      const onResize = () => {
        this._resizeCanvas();
        this._render();
      };

      canvas.addEventListener("mousedown", onDown);
      canvas.addEventListener("touchstart", onDown, { passive: false });
      window.addEventListener("resize", onResize);

      if (close) {
        close.onclick = () => {
          if (this._state && !this._state.finished && this._state.startedAt > 0) {
            this.forfeit("me", "Mactan ciktin - hukmen maglup");
            return;
          }
          this.backToMenu();
        };
      }

      if (window.ResizeObserver && this._els?.stage) {
        this._resizeObserver = new ResizeObserver(() => {
          this._resizeCanvas();
          this._render();
        });
        this._resizeObserver.observe(this._els.stage);
      }

      this._unbind = () => {
        canvas.removeEventListener("mousedown", onDown);
        canvas.removeEventListener("touchstart", onDown);
        window.removeEventListener("resize", onResize);
        if (close) close.onclick = null;
      };
    },

    _destroyEvents() {
      if (this._unbind) {
        this._unbind();
        this._unbind = null;
      }
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
    },

    _resizeCanvas() {
      if (!this._els?.canvas || !this._els?.ctx) return false;

      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const width = Math.max(10, Math.floor((rect.width || 300) * dpr));
      const height = Math.max(10, Math.floor((rect.height || 300) * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      this._els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    },

_handleTap(x, y) {
  const cur = this._state?.currentIcon;
  if (!cur || cur.hit || cur.pending) return;
  if (!pointInRect(x, y, cur)) return;

  if (this._matchCtx?.matchId && !this._isHost) {
    cur.pending = true;
    this._broadcast("action_request", {
      actor: this._localActorToCanonical("me"),
      seq: Number(cur.seq || 0),
    });
    return;
  }

  this._resolveIconAction(cur, "me", false);
},

    _checkFinish() {
      if (!this._state || this._state.finished) return;

      if (this._state.syncMode && !this._isHost) return;
      if (this._state.enemyHp <= 0) return this._finish(true, "Rakip dustu");
      if (this._state.meHp <= 0) return this._finish(false, "Sen dustun");

      if (this._state.remaining <= 0) {
        if (this._state.meHp > this._state.enemyHp) return this._finish(true, "Sure bitti - HP ustunlugu");
        if (this._state.meHp < this._state.enemyHp) return this._finish(false, "Sure bitti - Rakip onde");
        if (this._state.meDamageDealt > this._state.enemyDamageDealt) return this._finish(true, "Sure bitti - Hasar ustunlugu");
        if (this._state.meDamageDealt < this._state.enemyDamageDealt) return this._finish(false, "Sure bitti - Rakip hasar ustunlugu");
        return this._finish(false, "Sure bitti - Berabere");
      }
    },

    _finish(win, reason, meta = {}) {
      if (!this._state || this._state.finished) return true;

      const finalReason = buildResultReason(reason, { ...meta, win });
      this._state.finished = true;
      this._state.winner = win ? "me" : "enemy";
      this._state.finishAt = Date.now();
      this._state.finishReason = finalReason;
      this._state.finishMeta = { ...meta, win };
      this._state.resultPrizeYton = win ? getEstimatedPrizeYton() : 0;
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;

      this._setStatus(win ? "PvP - Kazandin" : "PvP - Kaybettin");
      this._toast(win ? "Kazandin!" : "Kaybettin!", 1200);
      this._recordResult(win, finalReason, meta);
      this._updateHud();
      this._render();
      if (this._matchCtx?.matchId && this._isHost) this._broadcastStateSync(true);

      if (meta?.autoClose) {
        clearTimeout(this._autoCloseTimer);
        this._autoCloseTimer = setTimeout(() => this.backToMenu(), FORFEIT_EXIT_DELAY_MS);
      }
      return true;
    },

    _recordResult(win, reason = "", meta = {}) {
      if (this._resultRecorded) return;
      this._resultRecorded = true;

      const store = window.tcStore;
      const now = Date.now();
      const opponent = this._opponent?.username || "Rakip";
      const prizeYton = win ? getEstimatedPrizeYton() : 0;
      const resultItem = {
        id: `pvp_${now}`,
        opponent,
        result: win ? "win" : "loss",
        mode: "cage_fight",
        reason: String(reason || ""),
        forfeit: !!meta?.forfeit,
        quitter: meta?.quitter || null,
        prizeYton,
        meHp: Math.round(this._state?.meHp || 0),
        enemyHp: Math.round(this._state?.enemyHp || 0),
        meDamage: Math.round(this._state?.meDamageDealt || 0),
        enemyDamage: Math.round(this._state?.enemyDamageDealt || 0),
        meScore: Math.round(this._state?.meScore || 0),
        enemyScore: Math.round(this._state?.enemyScore || 0),
        at: now,
      };

      if (store?.get && store?.set) {
        const state = store.get() || {};
        const pvp = { ...(state.pvp || {}) };
        const recentMatches = Array.isArray(pvp.recentMatches) ? pvp.recentMatches.slice(0, 19) : [];
        const leaderboard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.slice() : [];
        const playerName = String(state?.player?.username || "Player");

        pvp.wins = Number(pvp.wins || 0) + (win ? 1 : 0);
        pvp.losses = Number(pvp.losses || 0) + (win ? 0 : 1);
        pvp.rating = clamp(Number(pvp.rating || 1000) + (win ? 16 : -10), 0, 99999);
        pvp.currentOpponent = opponent;
        pvp.lastPrizeYton = prizeYton;
        pvp.lastResultReason = resultItem.reason;
        pvp.recentMatches = [resultItem, ...recentMatches];

        const score = Number(pvp.rating || 1000) + Number(pvp.wins || 0) * 8;
        const nextBoard = leaderboard.filter((x) => x && x.name !== playerName);
        nextBoard.push({
          id: String(state?.player?.id || "player_main"),
          name: playerName,
          wins: Number(pvp.wins || 0),
          losses: Number(pvp.losses || 0),
          rating: Number(pvp.rating || 1000),
          score,
          updatedAt: now,
        });
        nextBoard.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        pvp.leaderboard = nextBoard.slice(0, 50);

        store.set({ pvp });
      }

      const eventName = win ? "tc:pvp:win" : "tc:pvp:lose";
      try {
        window.dispatchEvent(new CustomEvent(eventName, { detail: resultItem }));
      } catch (_) {
        window.dispatchEvent(new Event(eventName));
      }

      try {
        if (typeof this.onMatchFinished === "function") {
          this.onMatchFinished(!!win, resultItem);
        }
      } catch (err) {
        console.error("[TonCrime] pvpcage onMatchFinished error:", err);
      }
    },

    _updateHud() {
      if (!this._els || !this._state) return;

      const mePct = clamp(this._state.meHp / START_HP, 0, 1) * 100;
      const enemyPct = clamp(this._state.enemyHp / START_HP, 0, 1) * 100;
      const timePct = clamp(this._state.remaining / GAME_MS, 0, 1) * 100;
      const sec = Math.ceil(this._state.remaining / 1000);

      if (this._els.meFill) this._els.meFill.style.transform = `scaleX(${mePct / 100})`;
      if (this._els.enemyFill) this._els.enemyFill.style.transform = `scaleX(${enemyPct / 100})`;
      if (this._els.meHpText) this._els.meHpText.textContent = String(Math.round(this._state.meHp));
      if (this._els.enemyHpText) this._els.enemyHpText.textContent = String(Math.round(this._state.enemyHp));

      if (this._els.rootMeFill) this._els.rootMeFill.style.transform = `scaleX(${mePct / 100})`;
      if (this._els.rootEnemyFill) this._els.rootEnemyFill.style.transform = `scaleX(${enemyPct / 100})`;
      if (this._els.rootMeText) this._els.rootMeText.textContent = `${Math.round(this._state.meHp)} / ${START_HP}`;
      if (this._els.rootEnemyText) this._els.rootEnemyText.textContent = `${Math.round(this._state.enemyHp)} / ${START_HP}`;

      if (this._els.timeFill) this._els.timeFill.style.transform = `scaleX(${timePct / 100})`;
      if (this._els.timerText) this._els.timerText.textContent = String(sec);
      if (this._els.sub) {
        if (this._state.finished) {
          this._els.sub.textContent = this._state.finishReason || "Mac bitti";
        } else if (this._state.waitingForHost) {
          this._els.sub.textContent = "Rakip baglantisi bekleniyor";
        } else if (sec <= FINAL_WARNING_SECONDS) {
          this._els.sub.textContent = `${sec} saniye - son uyari`;
        } else {
          this._els.sub.textContent = `${sec} saniye - ikon yakala`;
        }
      }
    },

    _render() {
      if (!this._els?.ctx || !this._els?.canvas || !this._state) return;

      this._resizeCanvas();

      const ctx = this._els.ctx;
      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(10, Math.round(rect.width || 300));
      const h = Math.max(10, Math.round(rect.height || 300));

      ctx.clearRect(0, 0, w, h);

      const cageGrad = ctx.createLinearGradient(0, 0, 0, h);
      cageGrad.addColorStop(0, "rgba(24,28,40,0.98)");
      cageGrad.addColorStop(1, "rgba(7,10,18,0.98)");
      fillRoundRect(ctx, 0, 0, w, h, 18, cageGrad);

      for (let i = 1; i <= 7; i++) {
        const yy = Math.floor((h / 8) * i);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
      }

      this._drawParticles(ctx);
      this._drawCurrentIcon(ctx);

      if (performance.now() < this._state.hitFlashUntil) {
        ctx.fillStyle = this._state.hitFlashColor || "rgba(255,255,255,0.04)";
        ctx.fillRect(0, 0, w, h);
      }

      if (performance.now() < this._state.screenFlashUntil) {
        ctx.fillStyle = this._state.screenFlashColor || "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, w, h);
      }

      if (this._state.finished) {
        const boxW = w * 0.72;
        const boxH = this._state.winner === "me" ? 118 : 102;
        const boxX = (w - boxW) * 0.5;
        const boxY = h * 0.34;
        fillRoundRect(ctx, boxX, boxY, boxW, boxH, 20, "rgba(0,0,0,0.62)");
        strokeRoundRect(ctx, boxX, boxY, boxW, boxH, 20, this._state.winner === "me" ? "rgba(88,255,150,0.32)" : "rgba(255,110,110,0.24)", 1.2);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 22px system-ui, Arial";
        ctx.fillText(this._state.winner === "me" ? "KAZANDIN" : "KAYBETTIN", w * 0.5, boxY + 28);

        ctx.font = "800 12px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText(`${Math.round(this._state.meHp)} HP - ${Math.round(this._state.enemyHp)} HP`, w * 0.5, boxY + 50);
        ctx.fillText(`Hasar ${Math.round(this._state.meDamageDealt)} - ${Math.round(this._state.enemyDamageDealt)}`, w * 0.5, boxY + 68);

        if (this._state.winner === "me" && this._state.resultPrizeYton > 0) {
          ctx.font = "900 16px system-ui, Arial";
          ctx.fillStyle = "rgba(120,255,170,0.96)";
          ctx.fillText(`+${Math.round(this._state.resultPrizeYton)} YTON`, w * 0.5, boxY + 89);
        }

        ctx.font = "700 11px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.fillText(this._state.finishReason || "Mac bitti", w * 0.5, boxY + boxH - 14);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },

    _drawCurrentIcon(ctx) {
      const cur = this._state?.currentIcon;
      if (!cur) return;

      const now = performance.now();
      const lifeT = clamp((now - cur.bornAt) / ICON_LIFE_MS, 0, 1);
      const alpha = lifeT < 0.18 ? lifeT / 0.18 : 1 - Math.max(0, (lifeT - 0.76) / 0.24);
      const scale = lerp(0.84, 1, Math.min(1, lifeT * 2.4));

      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(cur.x + cur.w / 2, cur.y + cur.h / 2);
      ctx.scale(scale, scale);

      const x = -cur.w / 2;
      const y = -cur.h / 2;

      const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, cur.w * 0.66);
      glow.addColorStop(0, cur.color + "88");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, cur.w * 0.58, 0, Math.PI * 2);
      ctx.fill();

      fillRoundRect(ctx, x, y, cur.w, cur.h, 18, "rgba(255,255,255,0.06)");
      strokeRoundRect(ctx, x, y, cur.w, cur.h, 18, "rgba(255,255,255,0.12)", 1.4);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const img = this._iconImages?.[cur.id];
      if (img && img.complete && (img.naturalWidth || img.width)) {
        const iw = img.naturalWidth || img.width || 1;
        const ih = img.naturalHeight || img.height || 1;
        const fit = Math.min((cur.w * 0.72) / iw, (cur.h * 0.72) / ih);
        const dw = Math.max(8, iw * fit);
        const dh = Math.max(8, ih * fit);
        ctx.drawImage(img, -dw / 2, -dh / 2 - 4, dw, dh);
      } else {
        // PNG yok - sadece renkli daire goster, emoji/harf yok
        const rg = ctx.createRadialGradient(0, -3, 4, 0, -3, cur.w * 0.32);
        rg.addColorStop(0, cur.color + "ee");
        rg.addColorStop(1, cur.color + "44");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, -3, cur.w * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = `900 ${Math.max(10, Math.floor(cur.w * 0.12))}px system-ui, Arial`;
      ctx.fillStyle = "rgba(255,255,255,0.84)";
      ctx.fillText(cur.label, 0, cur.h * 0.27);

      ctx.restore();
    },

    _drawParticles(ctx) {
      if (!this._state?.particles?.length) return;
      for (const p of this._state.particles) {
        ctx.globalAlpha = clamp(p.life * p.alpha, 0, 1);
        ctx.fillStyle = p.color || "rgba(255,150,90,1)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };

  window.TonCrimePVP_CAGE = api;
})();
