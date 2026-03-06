(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function $(id) {
    return document.getElementById(id);
  }

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // ---- Layout helpers (CSS yerine JS ile boyutlandırma) ----
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

  /* arena panel içinde boşluğu doldursun */
  flex:1 1 auto !important;
  min-height:0 !important;
  height:auto !important;

  /* ikinci glass hissini azalt */
  background:transparent !important;
}
#${arenaId} .action{ box-sizing:border-box; touch-action:manipulation; }
`;
    const st = document.createElement("style");
    st.id = styleId;
    st.textContent = css;
    document.head.appendChild(st);
  }

  function isLikelyGlass(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor || "";
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || "";
    const br = cs.borderTopColor || "";
    const hasTransBg =
      bg.includes("rgba") && !bg.includes("rgba(0, 0, 0, 0)") && !bg.includes("rgba(0,0,0,0)");
    const hasBlur = bf && bf !== "none";
    const hasBorder = br && br !== "transparent";
    return hasTransBg || hasBlur || hasBorder;
  }

  function killGlass(el) {
    if (!el) return;
    el.style.background = "transparent";
    el.style.border = "0";
    el.style.boxShadow = "none";
    el.style.backdropFilter = "none";
    el.style.webkitBackdropFilter = "none";
  }

  function enforceFlexColumn(panelEl) {
    if (!panelEl) return;
    const cs = getComputedStyle(panelEl);
    const isFlex = cs.display.includes("flex");
    if (!isFlex) panelEl.style.display = "flex";
    panelEl.style.flexDirection = "column";
    // flex çocuklarında taşma bug fix
    Array.from(panelEl.children).forEach((ch) => {
      if (ch && ch.style) ch.style.minHeight = "0";
    });
  }

  function findAncestor(el, maxHops, predicate) {
    let cur = el;
    for (let i = 0; i < maxHops && cur; i++) {
      if (predicate(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function applyArenaLayout(arena, opts = {}) {
    if (!arena) return;

    // arena kesin
    arena.style.position = "relative";
    arena.style.overflow = "hidden";
    arena.style.flex = "1 1 auto";
    arena.style.minHeight = "0";
    arena.style.height = "auto";
    arena.style.background = "transparent";

    // (A) Arena wrap (arena'nın bir üstü) varsa: ikinci transparanı öldür
    let arenaWrap = null;
    if (opts.arenaWrapId) arenaWrap = $(opts.arenaWrapId);
    if (!arenaWrap) arenaWrap = arena.parentElement;

    // Eğer wrap gerçekten glass ise kapat (çift transparan çözümü)
    if (arenaWrap && isLikelyGlass(arenaWrap)) {
      killGlass(arenaWrap);
    }

    // (B) Panel (wrap'ın üstü) flex-column olmalı ki arena boşluğu doldursun
    let panel = null;
    if (opts.panelId) panel = $(opts.panelId);

    if (!panel) {
      // id/class içinde "pvp" geçen ilk mantıklı container’ı yakala
      panel = findAncestor(arena, 8, (x) => {
        if (!x || !x.id) return false;
        const id = (x.id || "").toLowerCase();
        const cls = (x.className || "").toString().toLowerCase();
        return id.includes("pvp") || cls.includes("pvp");
      });
    }

    // panel bulamazsa, wrap’ın parent’ını panel kabul et
    if (!panel && arenaWrap) panel = arenaWrap.parentElement;

    if (panel) enforceFlexColumn(panel);

    // (C) Eğer hem panel hem wrap glass ise, glass sadece panelde kalsın:
    // wrap’ı zaten öldürdük; paneli elleme (ana glass kalsın).
    // Ama tersiyse: panel değil wrap glass ise, wrap’ı ana panel sayıp paneli öldürme yok.
  }

  // ---- PVP core ----
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
    _layoutOpts: null,

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

      this._layoutOpts = {
        panelId: opts.panelId || null,
        arenaWrapId: opts.arenaWrapId || null,
      };

      injectBaseStyleOnce(ids.arenaId);

      this._els = { arena, status, enemyFill, meFill, enemyHpText, meHpText };
      this._inited = true;

      arena.innerHTML = "";
      arena.style.userSelect = "none";

      // init anında layout zorla (çift transparan + taşma fix)
      applyArenaLayout(arena, this._layoutOpts);

      this.reset();
      console.log("[TonCrimePVP] init OK");
    },

    setOpponent(opp) {
      if (opp && typeof opp.username === "string") {
        this._opp = { ...opp };
      }
    },

    start() {
      if (!this._inited) return;
      if (this._running) return;

      this.reset();

      this._running = true;
      this._setStatus("Savaş • " + this._opp.username);

      this._spawnActions();

      const tick = () => {
        if (!this._running) return;

        const botDelay = 850 + Math.floor(Math.random() * 350);

        clearTimeout(this._tickT);
        this._tickT = setTimeout(() => {
          if (!this._running) return;

          const dmg = 6 + Math.floor(Math.random() * 7);

          this._meHp = clamp(this._meHp - dmg, 0, 100);
          this._renderBars();

          if (this._meHp <= 0) {
            this._finish("lose");
            return;
          }

          tick();
        }, botDelay);
      };

      tick();
    },

    stop() {
      this._running = false;
      clearTimeout(this._tickT);
      this._tickT = null;

      this._clearActions();
      this._setStatus("Durduruldu");
    },

    reset() {
      if (!this._inited) return;

      this._running = false;
      clearTimeout(this._tickT);

      this._meHp = 100;
      this._enemyHp = 100;

      this._lastZone = -1;

      this._clearActions();
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

      this._els.arena.innerHTML = "";
    },

    _spawnActions() {
      const arena = this._els.arena;

      // her start’ta layout tekrar uygula (bazı overlay aç/kapa akışlarında DOM style resetleniyor)
      applyArenaLayout(arena, this._layoutOpts);

      arena.style.position = "relative";
      arena.style.overflow = "hidden";
      arena.innerHTML = "";

      const actions = [
        { key: "punch", emoji: "👊", dmg: [10, 16] },
        { key: "kick",  emoji: "🦵", dmg: [8, 18] },
        { key: "head",  emoji: "🧠", dmg: [12, 14] },
        { key: "slap",  emoji: "🖐️", dmg: [7, 13] },
      ];

const size = 64;

const s = window.tcStore?.get?.() ?? {};
const pct = Number(s.player?.weaponIconBonusPct ?? 0);

// ikon süresi (base 500ms)
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

        arena.innerHTML = "";

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
        d.style.borderRadius = "14px";

        // ikon kutusu mini-glass kalabilir
        d.style.background = "rgba(0,0,0,.22)";
        d.style.backdropFilter = "blur(6px)";
        d.style.webkitBackdropFilter = "blur(6px)";
        d.style.border = "1px solid rgba(255,255,255,.14)";
        d.style.transform = "translateZ(0)";

        d.innerHTML = `<div class="emoji" style="font-size:34px; line-height:1;">${a.emoji}</div>`;

        const hit = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!this._running) return;

          const dmg = a.dmg[0] + Math.floor(Math.random() * (a.dmg[1] - a.dmg[0] + 1));
          this._enemyHp = clamp(this._enemyHp - dmg, 0, 100);
          this._renderBars();

          d.style.transform = "scale(0.96) translateZ(0)";
          setTimeout(() => (d.style.transform = "translateZ(0)"), 90);

          if (this._enemyHp <= 0) this._finish("win");
        };

        d.addEventListener("click", hit, { passive: false });
        d.addEventListener("pointerdown", hit, { passive: false });

        arena.appendChild(d);

        clearTimeout(this._flashT);
        this._flashT = setTimeout(() => {
          if (!this._running) return;
          arena.innerHTML = "";
          this._flashT = setTimeout(spawnOnce, gapMs);
        }, showMs);
      };

      spawnOnce();
    },
  };

  window.TonCrimePVP = PVP;
})();