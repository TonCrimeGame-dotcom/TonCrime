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
          subtitle: "Sweet Bonanza PvP",
          desc: "4x6 tumble slot PvP. 6+ aynı ikon patlar, combo devam eder, 4 bonus ile 10 free spin açılır.",
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
      this.fallbackBg.src = "./src/assets/pvp-bg.png";
    }

    enter() {
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
        this.scenes.go("home");
        return;
      }

      for (let i = 0; i < this.cardRects.length; i++) {
        const r = this.cardRects[i];
        if (pointInRect(x, y, r.btn) && r.card.open) {
          this.startGame(r.card.id);
          return;
        }
      }
    }

    async startGame(id) {
      if (this._launchingGame) return;
      this._launchingGame = true;

      const s = this.store?.get?.() || {};
      const pvp = { ...(s.pvp || {}) };

      pvp.selectedMode = id;
      pvp.source = this.source || "general";
      this.store?.set?.({ pvp });

      try {
        const dom = ensurePvpDom();

        if (dom.status) dom.status.textContent = "PvP • Yükleniyor...";
        if (dom.opponent) dom.opponent.textContent = "ShadowWolf";
        if (dom.spinner) dom.spinner.classList.remove("hidden");

        if (id === "grid") {
          await loadPvpGameScript([
            "./src/pvpcrush.js",
            "./pvpcrush.js",
          ]);

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

          window.TonCrimePVP.setOpponent?.({
            username: "ShadowWolf",
            isBot: true,
          });

          if (dom.startBtn) {
            dom.startBtn.style.display = "";
            dom.startBtn.onclick = async () => {
              try {
                window.TonCrimePVP.setOpponent?.({
                  username: "ShadowWolf",
                  isBot: true,
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
              try {
                window.TonCrimePVP.stop?.();
              } catch (err) {
                console.error("[TonCrime] Stop button error:", err);
              }
            };
          }

          if (dom.resetBtn) {
            dom.resetBtn.style.display = "";
            dom.resetBtn.onclick = () => {
              try {
                window.TonCrimePVP.reset?.();
              } catch (err) {
                console.error("[TonCrime] Reset button error:", err);
              }
            };
          }

          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.reset?.();
          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.start?.();

          if (dom.status) dom.status.textContent = "PvP • IQ Arena başladı";
          if (dom.spinner) dom.spinner.classList.add("hidden");
          this._launchingGame = false;
          return;
        }

        if (id === "slotarena") {
          await loadPvpGameScript([
            "./src/pvpslotarena.js",
            "./pvpslotarena.js",
          ]);

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

          window.TonCrimePVP.setOpponent?.({
            username: "ShadowWolf",
            isBot: true,
          });

          if (dom.startBtn) {
            dom.startBtn.style.display = "";
            dom.startBtn.onclick = async () => {
              try {
                window.TonCrimePVP.setOpponent?.({
                  username: "ShadowWolf",
                  isBot: true,
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
              try {
                window.TonCrimePVP.stop?.();
              } catch (err) {
                console.error("[TonCrime] Stop button error:", err);
              }
            };
          }

          if (dom.resetBtn) {
            dom.resetBtn.style.display = "";
            dom.resetBtn.onclick = () => {
              try {
                window.TonCrimePVP.reset?.();
              } catch (err) {
                console.error("[TonCrime] Reset button error:", err);
              }
            };
          }

          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.reset?.();
          await new Promise((r) => setTimeout(r, 180));
          window.TonCrimePVP.start?.();

          if (dom.status) dom.status.textContent = "PvP • Slot Arena başladı";
          if (dom.spinner) dom.spinner.classList.add("hidden");
          this._launchingGame = false;
          return;
        }

        if (id === "arena") {
          await loadPvpGameScript([
            "./src/pvpcage.js",
            "./pvpcage.js",
          ]);

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

          window.TonCrimePVP.setOpponent?.({
            username: "ShadowWolf",
            isBot: true,
          });

          if (dom.startBtn) dom.startBtn.style.display = "none";
          if (dom.stopBtn) dom.stopBtn.style.display = "none";
          if (dom.resetBtn) dom.resetBtn.style.display = "none";

          await new Promise((r) => setTimeout(r, 160));
          window.TonCrimePVP.start?.();

          if (dom.status) dom.status.textContent = "PvP • Kafes Dövüşü başladı";
          if (dom.spinner) dom.spinner.classList.add("hidden");
          this._launchingGame = false;
          return;
        }

        if (dom.status) dom.status.textContent = "PvP • Mod bulunamadı";
        if (dom.spinner) dom.spinner.classList.add("hidden");
      } catch (err) {
        console.error("[TonCrime] startGame fatal:", err);
        const status = document.getElementById("pvpStatus");
        const spinner = document.getElementById("pvpSpinner");
        if (status) status.textContent = "PvP • Oyun yüklenemedi";
        if (spinner) spinner.classList.add("hidden");
      }

      this._launchingGame = false;
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
      const cardH = clamp(Math.round(panelH * 0.22), 150, 188);
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

        const descX = x + 18;
        const descY = y + 14 + cardTitleSize + 5 + cardSubSize + 12;
        const descW = cw - 36;
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.font = `500 ${cardTextSize}px system-ui, Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const lines = wrapLines(ctx, card.desc, descW);
        let lineY = descY;
        const lineH = Math.round(cardTextSize * 1.35);
        for (let li = 0; li < Math.min(lines.length, 3); li++) {
          ctx.fillText(lines[li], descX, lineY);
          lineY += lineH;
        }

        let tagX = x + 18;
        const tagY = y + cardH - 48;
        const tagH = 30;
        ctx.font = `600 12px system-ui, Arial`;
        for (let t = 0; t < card.tags.length; t++) {
          const label = card.tags[t];
          const tw = Math.ceil(ctx.measureText(label).width) + 20;
          if (tagX + tw > x + cw - 18) break;
          fillRoundRect(ctx, tagX, tagY, tw, tagH, 10, "rgba(255,255,255,0.06)");
          strokeRoundRect(ctx, tagX, tagY, tw, tagH, 10, "rgba(255,255,255,0.10)", 1);
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, tagX + tw / 2, tagY + tagH / 2);
          tagX += tw + 8;
        }

        this.cardRects.push({
          card,
          btn: { x: btnX, y: btnY, w: btnW, h: btnH },
        });

        y += cardH + cardGap;
      }

      ctx.restore();

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
      try {
        this._engine?.reset?.();
      } catch (err) {
        console.error("[TonCrime] controller reset error:", err);
      }
    },

    start() {
      try {
        this._engine?.start?.();
      } catch (err) {
        console.error("[TonCrime] controller start error:", err);
      }
    },

    stop() {
      try {
        this._engine?.stop?.();
      } catch (err) {
        console.error("[TonCrime] controller stop error:", err);
      }
    },
  };

  window.TonCrimePVP = TonCrimePVPController;
})();
