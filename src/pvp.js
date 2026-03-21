(function () {
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, r) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, w, h, r) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.stroke();
  }

  function getImg(assets, key) {
    return (
      (typeof assets?.getImage === "function" && assets.getImage(key)) ||
      (typeof assets?.get === "function" && assets.get(key)) ||
      assets?.images?.[key] ||
      null
    );
  }

  function canvasCssSize(canvas) {
    const rect = canvas?.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    }
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return {
      w: Math.max(1, Math.round((canvas?.width || 1) / dpr)),
      h: Math.max(1, Math.round((canvas?.height || 1) / dpr)),
    };
  }

  function safeNow(store, w, h) {
    const s = store?.get?.() || {};
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    return {
      safe,
      topReserved,
      bottomReserved,
      player: s?.player || {},
    };
  }

  const GAME_MODES = [
    {
      id: "slotarena",
      title: "Slot Arena",
      sub: "Cluster / tumble / bonus",
      color: "#ffb347",
      assetKey: "pvp",
      script: "./src/pvpslotarena.js",
    },
    {
      id: "pvpcrush",
      title: "PvP Crush",
      sub: "Match-3 arena",
      color: "#77c0ff",
      assetKey: "pvp_bg",
      script: "./src/pvpcrush.js",
    },
    {
      id: "pvpcage",
      title: "Kafes Dövüşü",
      sub: "Tap / reflex fight",
      color: "#7ce38b",
      assetKey: "background",
      script: "./src/pvpcage.js",
    },
  ];

  const BOT_NAMES = [
    "ShadowWolf",
    "NightViper",
    "IronClaw",
    "GhostX",
    "RedFang",
    "BlackViper",
    "RazorKid",
    "SilentHeat",
    "StormMask",
    "VenomAce",
  ];

  function randomBotName() {
    return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  }

  function createOpponent(store) {
    const p = store?.get?.()?.player || {};
    const playerLevel = Number(p.level || 1);

    return {
      id: "opp_" + Date.now(),
      name: randomBotName(),
      level: clamp(
        playerLevel + Math.floor(Math.random() * 7) - 3,
        Math.max(1, playerLevel - 5),
        playerLevel + 6
      ),
    };
  }

  class PvpScene {
    constructor({ store, input, assets, scenes, source }) {
      this.store = store;
      this.input = input;
      this.assets = assets;
      this.scenes = scenes;
      this.source = source || "menu";

      this.hit = [];
      this.state = "menu"; // menu | searching | found | loading | error
      this.selectedMode = null;
      this.opponent = null;
      this.searchStartAt = 0;
      this.foundAt = 0;
      this.loadingMsg = "";
      this.errorText = "";
      this.animT = 0;
      this._launchStarted = false;
      this._pendingLoadTimer = null;
      this._fakePlayerTimer = null;
      this._fallbackTimer = null;
      this._scriptTag = null;
      this._scriptsLoaded = {};
    }

    onEnter(payload = {}) {
      this.hit = [];
      this.animT = 0;
      this.errorText = "";
      this.loadingMsg = "";
      this._launchStarted = false;
      this._clearTimers();

      if (payload && payload.autoMode) {
        this.startMatchmaking(payload.autoMode);
        return;
      }

      this.state = "menu";
      this.selectedMode = null;
      this.opponent = null;
    }

    onExit() {
      this._clearTimers();
    }

    _clearTimers() {
      if (this._pendingLoadTimer) clearTimeout(this._pendingLoadTimer);
      if (this._fakePlayerTimer) clearTimeout(this._fakePlayerTimer);
      if (this._fallbackTimer) clearTimeout(this._fallbackTimer);
      this._pendingLoadTimer = null;
      this._fakePlayerTimer = null;
      this._fallbackTimer = null;
    }

    _safeRect(ctx) {
      const size = canvasCssSize(ctx.canvas);
      const { safe, topReserved, bottomReserved } = safeNow(this.store, size.w, size.h);

      const x = safe.x + 10;
      const y = safe.y + topReserved;
      const w = safe.w - 20;
      const h = safe.h - topReserved - bottomReserved - 10;

      return {
        screenW: size.w,
        screenH: size.h,
        mobile: size.w < 760,
        x,
        y,
        w,
        h,
      };
    }

    startMatchmaking(modeId) {
      const mode = GAME_MODES.find((x) => x.id === modeId) || GAME_MODES[0];
      this.selectedMode = mode;
      this.opponent = null;
      this.state = "searching";
      this.searchStartAt = Date.now();
      this.foundAt = 0;
      this.errorText = "";
      this.loadingMsg = "";
      this._launchStarted = false;
      this._clearTimers();

      // önce gerçek oyuncu aranıyormuş gibi kısa gecikme
      this._fakePlayerTimer = setTimeout(() => {
        if (this.state !== "searching") return;
        this.onOpponentFound(createOpponent(this.store));
      }, 3200);

      // 10 sn üst limit
      this._fallbackTimer = setTimeout(() => {
        if (this.state !== "searching") return;
        this.onOpponentFound(createOpponent(this.store));
      }, 10000);
    }

    onOpponentFound(opponent) {
      this._clearTimers();
      this.opponent = opponent;
      this.state = "found";
      this.foundAt = Date.now();

      this._pendingLoadTimer = setTimeout(() => {
        this.launchSelectedGame();
      }, 3000);
    }

    launchSelectedGame() {
      if (this._launchStarted) return;
      this._launchStarted = true;
      this.state = "loading";
      this.loadingMsg = "Maç hazırlanıyor...";

      const mode = this.selectedMode || GAME_MODES[0];
      const detail = {
        mode: mode.id,
        opponent: this.opponent,
      };

      window.tcPvpMatch = detail;

      this.loadGameScript(mode.script)
        .then(() => {
          const layer = document.getElementById("pvpLayer");
          if (layer) layer.innerHTML = "";

          // yaygın hook denemeleri
          if (typeof window.startPvpGame === "function") {
            window.startPvpGame(detail);
            return;
          }
          if (typeof window.mountPvpGame === "function") {
            window.mountPvpGame(detail);
            return;
          }
          if (typeof window.launchPvpGame === "function") {
            window.launchPvpGame(detail);
            return;
          }
          if (typeof window.tcStartPvpGame === "function") {
            window.tcStartPvpGame(detail);
            return;
          }

          // event fallback
          window.dispatchEvent(
            new CustomEvent("tc:pvp:startgame", {
              detail,
            })
          );
        })
        .catch((err) => {
          console.error("[TonCrime] game script load failed:", err);
          this.state = "error";
          this.errorText = "Oyun yüklenemedi";
          this._launchStarted = false;
        });
    }

    loadGameScript(src) {
      if (!src) return Promise.reject(new Error("script yolu yok"));
      if (this._scriptsLoaded[src]) return Promise.resolve();

      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-pvp-script="${src}"]`);
        if (existing) {
          this._scriptsLoaded[src] = true;
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.defer = true;
        script.dataset.pvpScript = src;

        script.onload = () => {
          this._scriptsLoaded[src] = true;
          console.log("[TonCrime] classic script yüklendi:", src);
          resolve();
        };
        script.onerror = () => {
          reject(new Error(`Script yüklenemedi: ${src}`));
        };

        this._scriptTag = script;
        document.body.appendChild(script);
      });
    }

    goHome() {
      try {
        const layer = document.getElementById("pvpLayer");
        if (layer) layer.innerHTML = "";
      } catch (_) {}

      this._clearTimers();
      this.state = "menu";
      this.selectedMode = null;
      this.opponent = null;
      this.errorText = "";
      this.loadingMsg = "";
      this._launchStarted = false;

      this.scenes.go("home");
    }

    update() {
      this.animT += 0.016;

      const px = this.input?.pointer?.x || 0;
      const py = this.input?.pointer?.y || 0;

      if (!this.input?.justReleased?.()) return;

      for (const h of this.hit) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.type === "back") {
          this.goHome();
          return;
        }

        if (h.type === "mode") {
          this.startMatchmaking(h.modeId);
          return;
        }

        if (h.type === "cancel") {
          this.state = "menu";
          this.selectedMode = null;
          this.opponent = null;
          this.errorText = "";
          this.loadingMsg = "";
          this._launchStarted = false;
          this._clearTimers();
          return;
        }

        if (h.type === "retry") {
          if (this.selectedMode?.id) {
            this.startMatchmaking(this.selectedMode.id);
          } else {
            this.state = "menu";
          }
          return;
        }
      }
    }

    render(ctx, w, h) {
      const R = this._safeRect(ctx);
      this.hit = [];

      const bg =
        getImg(this.assets, "pvp_bg") ||
        getImg(this.assets, "pvp") ||
        getImg(this.assets, "background");

      if (bg) {
        const scale = Math.max(w / (bg.width || 1), h / (bg.height || 1));
        const dw = (bg.width || 1) * scale;
        const dh = (bg.height || 1) * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(bg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#08111f";
        ctx.fillRect(0, 0, w, h);
      }

      ctx.fillStyle = "rgba(0,0,0,0.52)";
      ctx.fillRect(0, 0, w, h);

      // header
      const back = {
        x: R.x,
        y: R.y - 48,
        w: 56,
        h: 38,
      };
      this.hit.push({ type: "back", rect: back });

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      fillRoundRect(ctx, back.x, back.y, back.w, back.h, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      strokeRoundRect(ctx, back.x, back.y, back.w, back.h, 12);
      ctx.fillStyle = "#fff";
      ctx.font = "700 20px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("X", back.x + back.w / 2, back.y + back.h / 2);

      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${R.mobile ? 26 : 34}px system-ui`;
      ctx.fillText("PvP", R.x + 68, R.y - 20);

      if (this.state === "menu") {
        this.renderMenu(ctx, R);
      } else if (this.state === "searching") {
        this.renderSearching(ctx, R);
      } else if (this.state === "found") {
        this.renderFound(ctx, R);
      } else if (this.state === "loading") {
        this.renderLoading(ctx, R);
      } else if (this.state === "error") {
        this.renderError(ctx, R);
      }
    }

    renderMenu(ctx, R) {
      const titleY = R.y + 22;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = `700 ${R.mobile ? 18 : 22}px system-ui`;
      ctx.textAlign = "left";
      ctx.fillText("Oyun seç", R.x + 8, titleY);

      const gap = R.mobile ? 12 : 16;
      const cardH = R.mobile ? 132 : 154;
      let y = R.y + 44;

      for (const mode of GAME_MODES) {
        const card = {
          x: R.x,
          y,
          w: R.w,
          h: cardH,
        };
        this.hit.push({ type: "mode", rect: card, modeId: mode.id });

        ctx.fillStyle = "rgba(8,16,30,0.72)";
        fillRoundRect(ctx, card.x, card.y, card.w, card.h, 20);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 20);

        const img = getImg(this.assets, mode.assetKey) || getImg(this.assets, "pvp");
        if (img) {
          ctx.save();
          roundRectPath(ctx, card.x, card.y, card.w, card.h, 20);
          ctx.clip();

          const iw = img.width || 1;
          const ih = img.height || 1;
          const scale = Math.max(card.w / iw, card.h / ih);
          const dw = iw * scale;
          const dh = ih * scale;
          const dx = card.x + (card.w - dw) / 2;
          const dy = card.y + (card.h - dh) / 2;
          ctx.globalAlpha = 0.28;
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        }

        ctx.fillStyle = "rgba(0,0,0,0.34)";
        fillRoundRect(ctx, card.x, card.y, card.w, card.h, 20);

        ctx.fillStyle = mode.color;
        ctx.font = `900 ${R.mobile ? 20 : 26}px system-ui`;
        ctx.fillText(mode.title, card.x + 18, card.y + 36);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = `500 ${R.mobile ? 12 : 14}px system-ui`;
        ctx.fillText(mode.sub, card.x + 18, card.y + 60);

        const pill = {
          x: card.x + 18,
          y: card.y + card.h - 46,
          w: R.mobile ? 128 : 150,
          h: 30,
        };
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        fillRoundRect(ctx, pill.x, pill.y, pill.w, pill.h, 999);
        ctx.fillStyle = "#fff";
        ctx.font = "700 13px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Rakip Ara", pill.x + pill.w / 2, pill.y + pill.h / 2 + 0.5);

        ctx.textAlign = "left";
        y += cardH + gap;
      }
    }

    renderSearching(ctx, R) {
      const panel = {
        x: R.x,
        y: R.y + Math.max(18, Math.floor(R.h * 0.12)),
        w: R.w,
        h: Math.min(320, R.h - 36),
      };

      ctx.fillStyle = "rgba(8,16,30,0.76)";
      fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);

      const cx = panel.x + panel.w / 2;
      const cy = panel.y + 120;

      for (let i = 0; i < 3; i++) {
        const rr = 42 + i * 28 + Math.sin(this.animT * 2.4 + i * 0.6) * 6;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.16 - i * 0.04})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      const angle = this.animT * 2.4;
      const dotR = 58;
      const dx = Math.cos(angle) * dotR;
      const dy = Math.sin(angle) * dotR;

      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 8, 0, Math.PI * 2);
      ctx.fillStyle = this.selectedMode?.color || "#ffd166";
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `900 ${R.mobile ? 24 : 30}px system-ui`;
      ctx.fillText("Rakip aranıyor", cx, panel.y + 46);

      ctx.fillStyle = "rgba(255,255,255,0.76)";
      ctx.font = `500 ${R.mobile ? 13 : 15}px system-ui`;
      ctx.fillText(this.selectedMode?.title || "PvP", cx, panel.y + 74);

      const elapsed = Math.max(0, Date.now() - this.searchStartAt);
      const progress = clamp(elapsed / 10000, 0, 1);

      const bar = {
        x: panel.x + 24,
        y: panel.y + panel.h - 72,
        w: panel.w - 48,
        h: 12,
      };
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      fillRoundRect(ctx, bar.x, bar.y, bar.w, bar.h, 999);
      ctx.fillStyle = this.selectedMode?.color || "#ffd166";
      fillRoundRect(ctx, bar.x, bar.y, Math.max(16, bar.w * progress), bar.h, 999);

      const cancel = {
        x: panel.x + (panel.w - 124) / 2,
        y: panel.y + panel.h - 46,
        w: 124,
        h: 32,
      };
      this.hit.push({ type: "cancel", rect: cancel });

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      fillRoundRect(ctx, cancel.x, cancel.y, cancel.w, cancel.h, 999);
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px system-ui";
      ctx.fillText("İptal", cancel.x + cancel.w / 2, cancel.y + cancel.h / 2 + 0.5);
    }

    renderFound(ctx, R) {
      const panel = {
        x: R.x,
        y: R.y + Math.max(18, Math.floor(R.h * 0.12)),
        w: R.w,
        h: Math.min(320, R.h - 36),
      };

      ctx.fillStyle = "rgba(8,16,30,0.78)";
      fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);

      const cx = panel.x + panel.w / 2;

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `900 ${R.mobile ? 24 : 30}px system-ui`;
      ctx.fillText("Rakip bulundu", cx, panel.y + 50);

      ctx.fillStyle = this.selectedMode?.color || "#ffd166";
      ctx.font = `900 ${R.mobile ? 22 : 28}px system-ui`;
      ctx.fillText(this.opponent?.name || "Opponent", cx, panel.y + 120);

      ctx.fillStyle = "rgba(255,255,255,0.84)";
      ctx.font = `700 ${R.mobile ? 15 : 17}px system-ui`;
      ctx.fillText(`Level ${this.opponent?.level || 1}`, cx, panel.y + 150);

      const remain = Math.max(0, 3000 - (Date.now() - this.foundAt));
      const sec = Math.max(1, Math.ceil(remain / 1000));

      ctx.fillStyle = "rgba(255,255,255,0.66)";
      ctx.font = `500 ${R.mobile ? 13 : 15}px system-ui`;
      ctx.fillText(`Maç ${sec} sn içinde başlıyor`, cx, panel.y + 198);

      const pulse = 1 + Math.sin(this.animT * 8) * 0.06;
      const badgeW = 132 * pulse;
      const badgeH = 38 * pulse;

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      fillRoundRect(
        ctx,
        cx - badgeW / 2,
        panel.y + panel.h - 72,
        badgeW,
        badgeH,
        999
      );
      ctx.fillStyle = "#fff";
      ctx.font = "700 14px system-ui";
      ctx.fillText("Hazırlanıyor...", cx, panel.y + panel.h - 53);
    }

    renderLoading(ctx, R) {
      const panel = {
        x: R.x,
        y: R.y + Math.max(18, Math.floor(R.h * 0.12)),
        w: R.w,
        h: Math.min(240, R.h - 36),
      };

      ctx.fillStyle = "rgba(8,16,30,0.78)";
      fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);

      const cx = panel.x + panel.w / 2;
      const cy = panel.y + 112;

      for (let i = 0; i < 8; i++) {
        const a = this.animT * 4 + i * (Math.PI / 4);
        const x = cx + Math.cos(a) * 34;
        const y = cy + Math.sin(a) * 34;
        const alpha = 0.18 + (i / 8) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `900 ${R.mobile ? 22 : 28}px system-ui`;
      ctx.fillText("Yükleniyor", cx, panel.y + 46);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = `500 ${R.mobile ? 13 : 15}px system-ui`;
      ctx.fillText(this.loadingMsg || "Maç hazırlanıyor...", cx, panel.y + panel.h - 34);
    }

    renderError(ctx, R) {
      const panel = {
        x: R.x,
        y: R.y + Math.max(18, Math.floor(R.h * 0.12)),
        w: R.w,
        h: Math.min(260, R.h - 36),
      };

      ctx.fillStyle = "rgba(28,8,12,0.82)";
      fillRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);

      const cx = panel.x + panel.w / 2;

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `900 ${R.mobile ? 22 : 28}px system-ui`;
      ctx.fillText("Hata", cx, panel.y + 52);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `500 ${R.mobile ? 13 : 15}px system-ui`;
      ctx.fillText(this.errorText || "Oyun yüklenemedi", cx, panel.y + 96);

      const retry = {
        x: cx - 70,
        y: panel.y + panel.h - 58,
        w: 140,
        h: 34,
      };
      this.hit.push({ type: "retry", rect: retry });

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      fillRoundRect(ctx, retry.x, retry.y, retry.w, retry.h, 999);
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px system-ui";
      ctx.fillText("Tekrar Dene", retry.x + retry.w / 2, retry.y + retry.h / 2 + 0.5);
    }
  }

  window.PvpScene = PvpScene;
  console.log("[TonCrime] PvP controller booted");
})();
