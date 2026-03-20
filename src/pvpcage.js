(function () {
  const GAME_MS = 45000;
  const ICON_LIFE_MS = 500;
  const START_HP = 1000;

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
  { id: "slap", emoji: "🖐️", label: "TOKAT", color: "#7cb6ff", damage: DAMAGE.slap, bad: false, heal: false, flash: "rgba(124,182,255,0.14)" },
  { id: "brain", emoji: "🧠", label: "BEYİN", color: "#ff6464", damage: DAMAGE.brain, bad: false, heal: false, flash: "rgba(255,100,100,0.14)" },
  { id: "weed", emoji: "🌿", label: "OT", color: "#33dd77", damage: DAMAGE.weedHeal, bad: false, heal: true, flash: "rgba(51,221,119,0.18)" },
  { id: "drink", emoji: "🍺", label: "İÇKİ", color: "#ffd166", damage: DAMAGE.drinkHeal, bad: false, heal: true, flash: "rgba(255,209,102,0.18)" },
  { id: "skull", emoji: "💀", label: "KURU KAFA", color: "#ff4d6d", damage: DAMAGE.skull, bad: true, heal: false, flash: "rgba(255,77,109,0.20)" },
];

  const GOOD_ICONS = ICONS.filter((x) => !x.bad);
  const ICON_PATHS = {
    punch: "./src/assets/punch.png",
    kick: "./src/assets/kick.png",
    slap: "./src/assets/slap.png",
    brain: "./src/assets/brain.png",
    weed: "./src/assets/weed.png",
    drink: "./src/assets/drink.png",
    skull: "./src/assets/skull.png",
  };
  const BOT_NAMES = [
    "ShadowWolf", "NightTiger", "GhostMafia", "RicoVane", "IronFist", "VoltKral", "SlyRaven",
    "BlackMamba", "NightHawk", "CrimsonJack", "DarkVenom", "MafiaKing", "BlueViper",
    "SteelFang", "RedSkull", "SilentWolf", "NeonGhost", "FrostBite", "WildRaven", "TurboKhan"
  ];

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

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function drawIconArt(ctx, img, icon, x, y, w, h) {
    const pad = Math.max(4, Math.floor(Math.min(w, h) * 0.10));
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = Math.max(6, w - pad * 2);
    const innerH = Math.max(6, h - pad * 2);

    if (img && img.complete && (img.naturalWidth || img.width)) {
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const scale = Math.min(innerW / iw, innerH / ih);
      const dw = Math.max(4, iw * scale);
      const dh = Math.max(4, ih * scale);
      const dx = innerX + (innerW - dw) * 0.5;
      const dy = innerY + (innerH - dh) * 0.5;
      ctx.drawImage(img, dx, dy, dw, dh);
      return true;
    }

    ctx.font = `900 ${Math.floor(w * 0.48)}px system-ui, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(icon.emoji, x + w * 0.5, y + h * 0.44);
    return false;
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
          <button class="tc-cage-x" id="tcCageClose" type="button" aria-label="Geri">✕</button>

          <div class="tc-cage-title-wrap">
            <div class="tc-cage-neon">KAFES DÖVÜŞÜ</div>
            <div class="tc-cage-sub" id="tcCageSub">45 saniye • hızlı PvP</div>
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

        <div class="tc-cage-rule">💀 kuru kafa kendine vurur • 🌿 weed ve 🍺 drink can basar</div>
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
    _iconImages: {},
    _opponent: { username: "ShadowWolf", isBot: true },

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
    },

    setOpponent(opp) {
      this._opponent =
        opp && typeof opp.username === "string" && opp.username.trim()
          ? { ...opp }
          : { username: choice(BOT_NAMES), isBot: true };

      if (this._els?.enemyName) {
        this._els.enemyName.textContent = this._opponent.username;
      }
    },

    reset() {
      const playerName =
        String(window.tcStore?.get?.()?.player?.username || "Sen").trim() || "Sen";

      this._state = {
        startedAt: 0,
        elapsed: 0,
        remaining: GAME_MS,
        meHp: START_HP,
        enemyHp: START_HP,
        finished: false,
        lastTs: 0,
        playerName,
        nextSpawnAt: 0,
        currentIcon: null,
        particles: [],
        hitFlashUntil: 0,
        hitFlashColor: "rgba(255,255,255,0.04)",
        screenFlashUntil: 0,
        screenFlashColor: "rgba(255,255,255,0.08)",
        botNextActionAt: 0,
      };

      if (this._els?.meName) this._els.meName.textContent = playerName;
      if (this._els?.enemyName) this._els.enemyName.textContent = this._opponent?.username || choice(BOT_NAMES);

      this._toast("Hazır");
      this._setStatus("PvP • Kafes dövüşü hazır");
      this._updateHud();
      this._render();
    },

    start() {
      if (!this._els || !this._state) return;
      this.reset();

      const now = performance.now();
      this._running = true;
      this._state.startedAt = now;
      this._state.lastTs = now;
      this._state.nextSpawnAt = now + 180;
      this._state.botNextActionAt = now + randInt(340, 680);

      this._setStatus("PvP • Kafes dövüşü başladı");
      this._toast("Başladı");
      this._loop();
    },

    stop() {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    },

    backToMenu() {
      this.stop();

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
      if (status) status.textContent = "PvP • Hazır";
      if (opponent) opponent.textContent = "—";
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

      this._state.elapsed = now - this._state.startedAt;
      this._state.remaining = clamp(GAME_MS - this._state.elapsed, 0, GAME_MS);

      this._updateIcon(now);
      this._updateBot(now);
      this._updateParticles(dt);
      this._checkFinish();
      this._updateHud();
      this._render();
    },

    _updateIcon(now) {
      if (!this._state || this._state.finished) return;

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

      this._state.currentIcon = {
        ...icon,
        x,
        y,
        w: size,
        h: size,
        bornAt: now,
        expiresAt: now + ICON_LIFE_MS,
        hit: false,
      };

      this._state.nextSpawnAt = now + randInt(70, 180);
    },

    _updateBot(now) {
      if (!this._state || this._state.finished || now < this._state.botNextActionAt) return;

      const missChance = 0.18;
      const skullFailChance = 0.10;

      if (Math.random() < skullFailChance) {
        const skull = ICONS.find((x) => x.id === "skull");
        this._applyDamage("enemy", DAMAGE.skull, "Rakip kuru kafaya bastı", skull);
      } else if (Math.random() > missChance) {
        const attack = choice(GOOD_ICONS);
        if (attack.heal) {
          this._healEnemy(attack.damage, `${this._opponent.username} ${attack.label} kullandı`, attack);
        } else {
          this._applyDamage("me", attack.damage, `${this._opponent.username} ${attack.label} vurdu`, attack);
        }
      }

      this._state.botNextActionAt = now + randInt(320, 760);
    },

    _applyDamage(target, dmg, toastText, iconMeta = null) {
      if (!this._state || this._state.finished) return;

      if (target === "enemy") {
        this._state.enemyHp = clamp(this._state.enemyHp - dmg, 0, START_HP);
      } else {
        this._state.meHp = clamp(this._state.meHp - dmg, 0, START_HP);
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

      this._state.meHp = clamp(this._state.meHp + amount, 0, START_HP);
      this._state.hitFlashUntil = performance.now() + 110;
      this._state.hitFlashColor = iconMeta?.flash || "rgba(51,221,119,0.16)";
      this._flashScreen(iconMeta?.flash || "rgba(51,221,119,0.18)", 190);
      this._playIconSound(iconMeta?.id || "weed");
      this._toast(toastText, 620);
      this._spawnBurst(0.72, iconMeta?.color || "#33dd77");
    },

    _healEnemy(amount, toastText, iconMeta = null) {
      if (!this._state || this._state.finished) return;

      this._state.enemyHp = clamp(this._state.enemyHp + amount, 0, START_HP);
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
        close.onclick = () => this.backToMenu();
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
  if (!cur || cur.hit) return;
  if (!pointInRect(x, y, cur)) return;

  cur.hit = true;
  this._state.currentIcon = null;

  if (cur.bad) {
    this._applyDamage("me", cur.damage, `💀 Hata! -${cur.damage} HP`, cur);
    return;
  }

  if (cur.heal) {
    const healPrefix = cur.id === "drink" ? "🍺 İÇKİ" : "🌿 OT";
    this._healMe(cur.damage, `${healPrefix} • +${cur.damage} HP`, cur);
    return;
  }

  this._applyDamage("enemy", cur.damage, `${cur.label} • -${cur.damage} HP`, cur);
},

    _checkFinish() {
      if (!this._state || this._state.finished) return;

      if (this._state.enemyHp <= 0) return this._finish(true, "Rakip düştü");
      if (this._state.meHp <= 0) return this._finish(false, "Sen düştün");

      if (this._state.remaining <= 0) {
        if (this._state.meHp > this._state.enemyHp) return this._finish(true, "Süre bitti • HP üstünlüğü");
        if (this._state.meHp < this._state.enemyHp) return this._finish(false, "Süre bitti • Rakip önde");
        return this._finish(true, "Süre bitti • Beraberlik");
      }
    },

    _finish(win, reason) {
      if (!this._state || this._state.finished) return;
      this._state.finished = true;
      this._running = false;

      this._setStatus(win ? "PvP • Kazandın" : "PvP • Kaybettin");
      this._toast(win ? "Kazandın!" : "Kaybettin!", 1200);
      this._updateHud();
      this._render();
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
        this._els.sub.textContent = this._state.finished ? "Maç bitti" : `${sec} saniye • ikon yakala`;
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
        fillRoundRect(ctx, w * 0.18, h * 0.36, w * 0.64, 72, 18, "rgba(0,0,0,0.58)");
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 18px system-ui, Arial";
        ctx.fillText(this._state.meHp >= this._state.enemyHp ? "KAZANDIN" : "KAYBETTİN", w * 0.5, h * 0.36 + 28);
        ctx.font = "800 12px system-ui, Arial";
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText(`${Math.round(this._state.meHp)} HP • ${Math.round(this._state.enemyHp)} HP`, w * 0.5, h * 0.36 + 50);
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
      drawIconArt(ctx, this._iconImages?.[cur.id], cur, x, y, cur.w, cur.h);

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
