(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function $(id) {
    return document.getElementById(id);
  }

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function injectBaseStyleOnce(arenaId) {
    const styleId = "tc-pvp-style";
    if (document.getElementById(styleId)) return;

    const css = `
#${arenaId}{
  box-sizing:border-box;
  position:relative !important;
  overflow:hidden !important;
  user-select:none !important;
  -webkit-user-select:none !important;

  width:100% !important;
  flex:1 1 auto !important;
  min-height:280px !important;
  height:100% !important;

  border-radius:14px !important;
  border:1px solid rgba(255,255,255,0.08) !important;

  background:
    radial-gradient(circle at 50% 40%, rgba(255,140,40,0.10) 0%, rgba(255,120,20,0.04) 18%, rgba(0,0,0,0.00) 38%),
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.00) 48%),
    linear-gradient(180deg, rgba(8,10,16,0.94) 0%, rgba(3,4,8,0.98) 100%) !important;

  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.03),
    inset 0 -30px 70px rgba(0,0,0,0.55),
    inset 0 20px 40px rgba(255,255,255,0.02),
    0 10px 30px rgba(0,0,0,0.35) !important;
}

#${arenaId}::before{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  border-radius:inherit;
  z-index:0;
  background:
    radial-gradient(circle at center, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 20%, rgba(255,255,255,0) 55%),
    linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.00) 24%, rgba(0,0,0,0.18) 100%);
}

#${arenaId}::after{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  border-radius:inherit;
  z-index:0;
  background:
    radial-gradient(circle at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.22) 74%, rgba(0,0,0,0.42) 100%);
}

#${arenaId} .tc-pvp-stage{
  position:absolute;
  inset:0;
  pointer-events:none;
  z-index:0;
}

#${arenaId} .tc-pvp-stage .tc-pvp-glow{
  position:absolute;
  left:50%;
  top:50%;
  width:220px;
  height:220px;
  transform:translate(-50%,-50%);
  border-radius:50%;
  background:
    radial-gradient(circle, rgba(255,140,40,0.14) 0%, rgba(255,120,10,0.06) 35%, rgba(255,120,10,0.00) 70%);
  filter: blur(10px);
  opacity:.9;
}

#${arenaId} .tc-pvp-stage .tc-pvp-grid{
  position:absolute;
  inset:0;
  opacity:.10;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 44px 44px, 44px 44px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.05), rgba(0,0,0,.5), rgba(0,0,0,.85));
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,.05), rgba(0,0,0,.5), rgba(0,0,0,.85));
}

#${arenaId} .tc-pvp-hitflash{
  position:absolute;
  inset:0;
  pointer-events:none;
  border-radius:inherit;
  opacity:0;
  transition: opacity 120ms ease;
  z-index:2;
}

#${arenaId} .tc-pvp-hitflash.on{
  opacity:1;
}

#${arenaId} .tc-pvp-hitflash.enemy{
  background: radial-gradient(circle at 50% 45%, rgba(255,70,70,0.16) 0%, rgba(255,70,70,0.06) 25%, rgba(255,70,70,0.00) 58%);
}

#${arenaId} .tc-pvp-hitflash.me{
  background: radial-gradient(circle at 50% 55%, rgba(100,180,255,0.14) 0%, rgba(100,180,255,0.06) 25%, rgba(100,180,255,0.00) 58%);
}

#${arenaId} .action{
  box-sizing:border-box;
  touch-action:manipulation;
  z-index:3;
  box-shadow:
    0 8px 24px rgba(0,0,0,.35),
    inset 0 1px 0 rgba(255,255,255,.12);
}

#${arenaId} .action .emoji{
  filter: drop-shadow(0 3px 10px rgba(0,0,0,.45));
}

#${arenaId} .tc-pvp-fx{
  position:absolute;
  pointer-events:none;
  z-index:4;
  width:22px;
  height:22px;
  left:0;
  top:0;
  border-radius:50%;
  background: radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,170,80,.75) 35%, rgba(255,120,20,0) 70%);
  transform: translate(-50%, -50%) scale(.4);
  opacity:0;
  animation: tcPvpFx .28s ease-out forwards;
}

@keyframes tcPvpFx{
  0%{
    opacity:.95;
    transform: translate(-50%, -50%) scale(.35);
  }
  100%{
    opacity:0;
    transform: translate(-50%, -50%) scale(2.2);
  }
}
`;
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = css;
    document.head.appendChild(st);
  }

  function ensureArenaDecor(arena) {
    if (!arena) return;

    let stage = arena.querySelector(".tc-pvp-stage");
    if (!stage) {
      stage = document.createElement("div");
      stage.className = "tc-pvp-stage";
      stage.innerHTML = `
        <div class="tc-pvp-glow"></div>
        <div class="tc-pvp-grid"></div>
      `;
      arena.appendChild(stage);
    }

    let flashEnemy = arena.querySelector(".tc-pvp-hitflash.enemy");
    if (!flashEnemy) {
      flashEnemy = document.createElement("div");
      flashEnemy.className = "tc-pvp-hitflash enemy";
      arena.appendChild(flashEnemy);
    }

    let flashMe = arena.querySelector(".tc-pvp-hitflash.me");
    if (!flashMe) {
      flashMe = document.createElement("div");
      flashMe.className = "tc-pvp-hitflash me";
      arena.appendChild(flashMe);
    }
  }

  function forceArenaLayout(arena) {
    if (!arena) return;

    const wrap = arena.parentElement;
    if (!wrap) {
      arena.style.minHeight = "280px";
      arena.style.height = "280px";
      ensureArenaDecor(arena);
      return;
    }

    // ÖNEMLİ: pvpWrap'ı bozma, sadece layout ver
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "stretch";

    const totalH = wrap.clientHeight || wrap.getBoundingClientRect().height || 0;

    const siblings = Array.from(wrap.children).filter((el) => el !== arena);
    let usedH = 0;

    for (const el of siblings) {
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      usedH += el.offsetHeight;
      usedH += parseFloat(cs.marginTop || 0);
      usedH += parseFloat(cs.marginBottom || 0);
    }

    const wrapCs = getComputedStyle(wrap);
    const padTop = parseFloat(wrapCs.paddingTop || 0);
    const padBottom = parseFloat(wrapCs.paddingBottom || 0);

    const freeH = Math.max(280, Math.floor(totalH - usedH - padTop - padBottom - 8));

    arena.style.flex = "1 1 auto";
    arena.style.width = "100%";
    arena.style.minHeight = freeH + "px";
    arena.style.height = freeH + "px";

    ensureArenaDecor(arena);
  }

  const PVP = {
    _inited: false,
    _els: null,
    _running: false,
    _tickT: null,
    _flashT: null,
    _opp: { username: "Rakip", isBot: true },
    _meHp: 100,
    _enemyHp: 100,
    _lastZone: -1,

    init(opts = {}) {
      const ids = {
        arenaId: opts.arenaId || "arena",
        statusId: opts.statusId || "pvpStatus",
        enemyFillId: opts.enemyFillId || "enemyFill",
        meFillId: opts.meFillId || "meFill",
        enemyHpTextId: opts.enemyHpTextId || "enemyHpText",
        meHpTextId: opts.meHpTextId || "meHpText",
      };

      const arena = $(ids.arenaId);
      const status = $(ids.statusId);
      const enemyFill = $(ids.enemyFillId);
      const meFill = $(ids.meFillId);
      const enemyHpText = $(ids.enemyHpTextId);
      const meHpText = $(ids.meHpTextId);

      if (!arena || !status || !enemyFill || !meFill || !enemyHpText || !meHpText) {
        console.error("[TonCrimePVP] init: eksik element");
        return;
      }

      injectBaseStyleOnce(ids.arenaId);

      this._els = { arena, status, enemyFill, meFill, enemyHpText, meHpText };
      this._inited = true;

      forceArenaLayout(arena);
      this.reset();

      window.addEventListener("resize", () => {
        if (!this._els?.arena) return;
        forceArenaLayout(this._els.arena);
      });

      console.log("[TonCrimePVP] init OK");
    },

    setOpponent(opp) {
      if (opp && typeof opp.username === "string") {
        this._opp = { ...opp };
      }
    },

    start() {
      if (!this._inited || this._running) return;

      this.reset();
      forceArenaLayout(this._els.arena);

      requestAnimationFrame(() => {
        forceArenaLayout(this._els.arena);
        this._running = true;
        this._setStatus("Savaş • " + this._opp.username);
        this._spawnActions();
        this._enemyLoop();
      });
    },

    _enemyLoop() {
      if (!this._running) return;

      const botDelay = 850 + Math.floor(Math.random() * 350);

      clearTimeout(this._tickT);
      this._tickT = setTimeout(() => {
        if (!this._running) return;

        const dmg = 6 + Math.floor(Math.random() * 7);
        this._meHp = clamp(this._meHp - dmg, 0, 100);
        this._renderBars();
        this._flashDamage("me");

        if (this._meHp <= 0) {
          this._finish("lose");
          return;
        }

        this._enemyLoop();
      }, botDelay);
    },

    stop() {
      this._running = false;
      clearTimeout(this._tickT);
      this._tickT = null;
      this._clearActions();
      this._setStatus("Durduruldu");
      forceArenaLayout(this._els.arena);
    },

    reset() {
      if (!this._inited) return;

      this._running = false;
      clearTimeout(this._tickT);
      this._tickT = null;

      this._meHp = 100;
      this._enemyHp = 100;
      this._lastZone = -1;

      this._clearActions();
      forceArenaLayout(this._els.arena);
      this._renderBars();
      this._setStatus("Hazır");
    },

    _setStatus(txt) {
      if (!this._els) return;
      this._els.status.textContent = "PvP • " + txt;
    },

    _renderBars() {
      const e = this._els;
      const me = clamp(this._meHp, 0, 100);
      const en = clamp(this._enemyHp, 0, 100);

      e.meFill.style.transform = `scaleX(${me / 100})`;
      e.enemyFill.style.transform = `scaleX(${en / 100})`;

      e.meHpText.textContent = me;
      e.enemyHpText.textContent = en;
    },

    _finish(result) {
      this._running = false;
      clearTimeout(this._tickT);
      this._tickT = null;
      this._clearActions();
      forceArenaLayout(this._els.arena);

      if (result === "win") {
        this._setStatus("Kazandın");
        dispatch("tc:pvp:win", { matchId: "m_" + Date.now(), opponent: this._opp });
      } else {
        this._setStatus("Kaybettin");
        dispatch("tc:pvp:lose", { matchId: "m_" + Date.now(), opponent: this._opp });
      }
    },

    _clearActions() {
      if (!this._els) return;

      clearTimeout(this._flashT);
      this._flashT = null;

      const arena = this._els.arena;
      arena.querySelectorAll(".action, .tc-pvp-fx").forEach((el) => el.remove());
      ensureArenaDecor(arena);
      forceArenaLayout(arena);
    },

    _flashDamage(side) {
      const arena = this._els?.arena;
      if (!arena) return;

      const el =
        side === "enemy"
          ? arena.querySelector(".tc-pvp-hitflash.enemy")
          : arena.querySelector(".tc-pvp-hitflash.me");

      if (!el) return;

      el.classList.remove("on");
      void el.offsetWidth;
      el.classList.add("on");

      clearTimeout(el._offT);
      el._offT = setTimeout(() => el.classList.remove("on"), 120);
    },

    _spawnFx(x, y) {
      const arena = this._els?.arena;
      if (!arena) return;

      const fx = document.createElement("div");
      fx.className = "tc-pvp-fx";
      fx.style.left = `${x}px`;
      fx.style.top = `${y}px`;
      arena.appendChild(fx);

      setTimeout(() => fx.remove(), 320);
    },

    _spawnActions() {
      const arena = this._els.arena;

      forceArenaLayout(arena);
      this._clearActions();

      const actions = [
        { key: "punch", emoji: "👊", dmg: [10, 16] },
        { key: "kick", emoji: "🦵", dmg: [8, 18] },
        { key: "head", emoji: "🧠", dmg: [12, 14] },
        { key: "slap", emoji: "🖐️", dmg: [7, 13] },
      ];

      const size = 64;
      const s = window.tcStore?.get?.() ?? {};
      const pct = Number(s.player?.weaponIconBonusPct ?? 0);
      const showMs = Math.round(500 * (1 + Math.max(0, Math.min(200, pct)) / 100));
      const gapMs = 120;
      const pad = 12;

      const zones = [
        { x0: 0.05, x1: 0.33, y0: 0.05, y1: 0.33 },
        { x0: 0.33, x1: 0.66, y0: 0.05, y1: 0.33 },
        { x0: 0.66, x1: 0.95, y0: 0.05, y1: 0.33 },
        { x0: 0.05, x1: 0.33, y0: 0.33, y1: 0.66 },
        { x0: 0.33, x1: 0.66, y0: 0.33, y1: 0.66 },
        { x0: 0.66, x1: 0.95, y0: 0.33, y1: 0.66 },
        { x0: 0.05, x1: 0.33, y0: 0.66, y1: 0.95 },
        { x0: 0.33, x1: 0.66, y0: 0.66, y1: 0.95 },
        { x0: 0.66, x1: 0.95, y0: 0.66, y1: 0.95 },
      ];

      const pickZoneIndex = () => {
        if (zones.length <= 1) return 0;
        let idx = Math.floor(Math.random() * zones.length);
        if (idx === this._lastZone) {
          idx = (idx + 1 + Math.floor(Math.random() * (zones.length - 1))) % zones.length;
        }
        this._lastZone = idx;
        return idx;
      };

      const spawnOnce = () => {
        if (!this._running) return;

        arena.querySelectorAll(".action").forEach((el) => el.remove());
        forceArenaLayout(arena);

        const W = arena.clientWidth || arena.getBoundingClientRect().width;
        const H = arena.clientHeight || arena.getBoundingClientRect().height;

        if (!W || !H) {
          clearTimeout(this._flashT);
          this._flashT = setTimeout(spawnOnce, 60);
          return;
        }

        const a = actions[Math.floor(Math.random() * actions.length)];
        const z = zones[pickZoneIndex()];

        const zx0 = z.x0 * W;
        const zx1 = z.x1 * W;
        const zy0 = z.y0 * H;
        const zy1 = z.y1 * H;

        const minX = clamp(zx0 + pad, pad, Math.max(pad, W - pad - size));
        const maxX = clamp(zx1 - pad - size, minX, Math.max(minX, W - pad - size));
        const minY = clamp(zy0 + pad, pad, Math.max(pad, H - pad - size));
        const maxY = clamp(zy1 - pad - size, minY, Math.max(minY, H - pad - size));

        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);

        const d = document.createElement("div");
        d.className = "action";
        d.dataset.key = a.key;

        d.style.position = "absolute";
        d.style.left = x + "px";
        d.style.top = y + "px";
        d.style.width = size + "px";
        d.style.height = size + "px";
        d.style.display = "flex";
        d.style.alignItems = "center";
        d.style.justifyContent = "center";
        d.style.cursor = "pointer";
        d.style.borderRadius = "16px";
        d.style.background = `
          radial-gradient(circle at 30% 25%, rgba(255,255,255,.14) 0%, rgba(255,255,255,.04) 24%, rgba(255,255,255,0) 54%),
          linear-gradient(180deg, rgba(30,34,44,.82) 0%, rgba(8,10,16,.92) 100%)
        `;
        d.style.backdropFilter = "blur(6px)";
        d.style.webkitBackdropFilter = "blur(6px)";
        d.style.border = "1px solid rgba(255,255,255,.14)";
        d.style.transform = "translateZ(0)";
        d.style.transition = "transform 90ms ease, opacity 90ms ease";
        d.innerHTML = `<div class="emoji" style="font-size:34px; line-height:1;">${a.emoji}</div>`;

        const hit = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!this._running) return;

          const dmg = a.dmg[0] + Math.floor(Math.random() * (a.dmg[1] - a.dmg[0] + 1));
          this._enemyHp = clamp(this._enemyHp - dmg, 0, 100);
          this._renderBars();
          this._flashDamage("enemy");
          this._spawnFx(x + size / 2, y + size / 2);

          d.style.transform = "scale(0.92) translateZ(0)";
          setTimeout(() => {
            d.style.transform = "translateZ(0)";
          }, 90);

          if (this._enemyHp <= 0) {
            this._finish("win");
            return;
          }
        };

        d.addEventListener("click", hit, { passive: false });
        d.addEventListener("pointerdown", hit, { passive: false });

        arena.appendChild(d);

        clearTimeout(this._flashT);
        this._flashT = setTimeout(() => {
          if (!this._running) return;

          d.style.opacity = "0";
          d.style.transform = "scale(0.92) translateZ(0)";

          setTimeout(() => {
            d.remove();
            this._flashT = setTimeout(spawnOnce, gapMs);
          }, 90);
        }, showMs);
      };

      spawnOnce();
    },
  };

  window.TonCrimePVP = PVP;
})();
