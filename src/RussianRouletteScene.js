(function () {
  const DEFAULTS = {
    buyInCoin: 50,
    buyInEnergy: 1,
    winCoin: 120,
    winXp: 40,
    finalRefundCoin: 50,
    chamberSize: 6,
    livesPerPlayer: 2,
  };

  const BOT_NAMES = ["ShadowWolf", "NightViper"];

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
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

  function fitCanvasToParent(canvas) {
    const parent = canvas?.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const cssW = Math.max(280, Math.round(rect.width || 320));
    const cssH = Math.max(280, Math.round(rect.height || 420));
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);

    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ensureStyle() {
    if (document.getElementById("tc-roulette-style")) return;

    const style = document.createElement("style");
    style.id = "tc-roulette-style";
    style.textContent = `
      .tc-roulette-root{
        position:absolute;
        inset:0;
        overflow:hidden;
        background:
          radial-gradient(circle at 50% 20%, rgba(255,80,80,0.18), transparent 28%),
          radial-gradient(circle at 50% 120%, rgba(255,170,70,0.10), transparent 34%),
          linear-gradient(180deg, rgba(10,10,14,0.98), rgba(5,5,8,1));
      }

      .tc-roulette-canvas{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        display:block;
      }

      .tc-roulette-ui{
        position:absolute;
        left:0;
        right:0;
        bottom:14px;
        display:flex;
        justify-content:center;
        pointer-events:none;
      }

      .tc-roulette-trigger{
        pointer-events:auto;
        appearance:none;
        border:1px solid rgba(255,255,255,0.18);
        background:linear-gradient(180deg, rgba(255,92,92,0.98), rgba(164,26,26,0.98));
        color:#fff;
        border-radius:18px;
        min-width:190px;
        height:52px;
        padding:0 22px;
        font-size:15px;
        font-weight:900;
        letter-spacing:.08em;
        box-shadow:
          0 12px 34px rgba(0,0,0,0.34),
          0 0 28px rgba(255,70,70,0.18);
        cursor:pointer;
      }

      .tc-roulette-trigger:disabled{
        opacity:.45;
        cursor:default;
        box-shadow:none;
      }

      .tc-roulette-close{
        position:absolute;
        top:10px;
        right:10px;
        z-index:5;
        width:38px;
        height:38px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.16);
        background:rgba(0,0,0,0.42);
        color:rgba(255,255,255,0.96);
        font-size:20px;
        font-weight:900;
        line-height:1;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        box-shadow:0 10px 24px rgba(0,0,0,0.26);
      }
    `;
    document.head.appendChild(style);
  }

  function readWallet(store) {
    const s = store?.get?.() || {};

    const coins =
      Number.isFinite(Number(s.coins)) ? Number(s.coins) :
      Number.isFinite(Number(s.player?.coins)) ? Number(s.player.coins) :
      0;

    const energy =
      Number.isFinite(Number(s.player?.energy)) ? Number(s.player.energy) :
      Number.isFinite(Number(s.energy)) ? Number(s.energy) :
      0;

    const xp =
      Number.isFinite(Number(s.player?.xp)) ? Number(s.player.xp) :
      Number.isFinite(Number(s.xp)) ? Number(s.xp) :
      0;

    return { coins, energy, xp };
  }

  function updateStoreResources(store, delta) {
    if (!store?.get || !store?.set) return;

    const s = store.get() || {};
    const nextCoins = Math.max(0, Number(s.coins || 0) + Number(delta.coins || 0));

    const player = { ...(s.player || {}) };
    player.energy = Math.max(0, Number(player.energy || 0) + Number(delta.energy || 0));
    player.xp = Math.max(0, Number(player.xp || 0) + Number(delta.xp || 0));

    store.set({
      coins: nextCoins,
      player,
    });
  }

  function loadImg(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  class RussianRouletteEngine {
    constructor() {
      this.opts = { ...DEFAULTS };
      this.store = null;

      this.root = null;
      this.canvas = null;
      this.ctx = null;
      this.triggerBtn = null;
      this.closeBtn = null;

      this.statusEl = null;
      this.enemyFillEl = null;
      this.meFillEl = null;
      this.enemyHpTextEl = null;
      this.meHpTextEl = null;
      this.opponentEl = null;

      this.running = false;
      this.awaitingShot = false;
      this.processing = false;
      this.ended = false;
      this.paid = false;
      this.finishPlace = null;
      this.finalAwarded = false;
      this.stage = "idle";
      this.message = "Masaya oturmak için başlat.";
      this.turnIndex = 0;
      this.currentChamber = 0;
      this.bulletIndex = 0;
      this.roundNumber = 1;
      this.pendingTimer = null;
      this.botTimer = null;
      this.lastTime = 0;
      this.flash = 0;
      this.shake = 0;
      this.muzzle = 0;
      this.spin = 0;
      this.pulse = 0;
      this.winnerId = null;
      this._raf = 0;
      this.players = [];

      this._resizeHandler = () => fitCanvasToParent(this.canvas);

      this.assets = {
        bg: loadImg("/src/assets/rr_table_bg.jpg"),
        revolverIdle: loadImg("/src/assets/rr_revolver_idle.png"),
        revolverSpin: loadImg("/src/assets/rr_revolver_spin.png"),
        revolverFire: loadImg("/src/assets/rr_revolver_fire.png"),
        bullet: loadImg("/src/assets/rr_bullet.png"),
        smoke: loadImg("/src/assets/rr_smoke.png"),
      };
    }

    hasLoaded(img) {
      return !!img && img.complete && (img.naturalWidth || img.width);
    }

    init(opts = {}) {
      ensureStyle();

      this.opts = {
        buyInCoin: DEFAULTS.buyInCoin,
        buyInEnergy: DEFAULTS.buyInEnergy,
        winCoin: Number.isFinite(Number(opts.winCoin)) ? Number(opts.winCoin) : DEFAULTS.winCoin,
        winXp: Number.isFinite(Number(opts.winXp)) ? Number(opts.winXp) : DEFAULTS.winXp,
        finalRefundCoin: Number.isFinite(Number(opts.finalRefundCoin)) ? Number(opts.finalRefundCoin) : DEFAULTS.finalRefundCoin,
        chamberSize: Number.isFinite(Number(opts.chamberSize)) ? Number(opts.chamberSize) : DEFAULTS.chamberSize,
        livesPerPlayer: Number.isFinite(Number(opts.livesPerPlayer)) ? Number(opts.livesPerPlayer) : DEFAULTS.livesPerPlayer,
      };

      this.store = opts.store || null;
      this.statusEl = document.getElementById(opts.statusId || "pvpStatus");
      this.enemyFillEl = document.getElementById(opts.enemyFillId || "enemyFill");
      this.meFillEl = document.getElementById(opts.meFillId || "meFill");
      this.enemyHpTextEl = document.getElementById(opts.enemyHpTextId || "enemyHpText");
      this.meHpTextEl = document.getElementById(opts.meHpTextId || "meHpText");
      this.opponentEl = document.getElementById("pvpOpponent");

      const arena = document.getElementById(opts.arenaId || "arena");
      if (!arena) throw new Error("RussianRouletteScene: arena bulunamadı");

      arena.innerHTML = `
        <div class="tc-roulette-root">
          <button class="tc-roulette-close" type="button" aria-label="Geri">✕</button>
          <canvas class="tc-roulette-canvas"></canvas>
          <div class="tc-roulette-ui">
            <button class="tc-roulette-trigger" type="button">TETİĞİ ÇEK</button>
          </div>
        </div>
      `;

      this.root = arena.querySelector(".tc-roulette-root");
      this.canvas = arena.querySelector(".tc-roulette-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.triggerBtn = arena.querySelector(".tc-roulette-trigger");
      this.closeBtn = arena.querySelector(".tc-roulette-close");

      fitCanvasToParent(this.canvas);
      window.removeEventListener("resize", this._resizeHandler);
      window.addEventListener("resize", this._resizeHandler);

      this.triggerBtn.onclick = () => {
        if (!this.running || !this.awaitingShot || this.processing || this.ended) return;
        const actor = this.players[this.turnIndex];
        if (!actor || actor.isBot || !actor.alive) return;
        this.fireCurrent();
      };

      this.closeBtn.onclick = () => {
        this.close();
      };

      this.reset(true);
      this.startLoop();
    }

    close() {
      this.stop();
      const wrap = document.getElementById("pvpWrap");
      if (wrap) {
        wrap.classList.remove("open");
        wrap.style.display = "none";
      }
    }

    setOpponent(opp) {
      const label = opp?.username || "2 Rakip";
      if (this.opponentEl) this.opponentEl.textContent = label;
    }

    buildPlayers() {
      const s = this.store?.get?.() || {};
      const meName =
        s?.player?.name ||
        s?.player?.username ||
        s?.profile?.username ||
        s?.username ||
        "Player";

      this.players = [
        {
          id: "me",
          name: meName,
          isBot: false,
          lives: this.opts.livesPerPlayer,
          alive: true,
        },
        {
          id: "bot1",
          name: BOT_NAMES[0],
          isBot: true,
          lives: this.opts.livesPerPlayer,
          alive: true,
        },
        {
          id: "bot2",
          name: BOT_NAMES[1],
          isBot: true,
          lives: this.opts.livesPerPlayer,
          alive: true,
        },
      ];
    }

    reset(keepLoop = false) {
      this.clearTimers();
      this.running = false;
      this.awaitingShot = false;
      this.processing = false;
      this.ended = false;
      this.paid = false;
      this.finishPlace = null;
      this.finalAwarded = false;
      this.stage = "idle";
      this.message = `Giriş: ${this.opts.buyInCoin} coin / ${this.opts.buyInEnergy} enerji`;
      this.turnIndex = 0;
      this.currentChamber = 0;
      this.bulletIndex = this.randomBulletIndex();
      this.roundNumber = 1;
      this.flash = 0;
      this.shake = 0;
      this.muzzle = 0;
      this.spin = 0;
      this.pulse = 0;
      this.winnerId = null;
      this.buildPlayers();
      this.setStatus("Russian Roulette • Hazır");
      this.updateHudBars();
      this.updateTrigger();

      if (!keepLoop) this.startLoop();
    }

    start() {
      this.clearTimers();

      if (!this.paid) {
        const wallet = readWallet(this.store);
        if (wallet.coins < this.opts.buyInCoin || wallet.energy < this.opts.buyInEnergy) {
          this.running = false;
          this.awaitingShot = false;
          this.processing = false;
          this.ended = true;
          this.message = `Yetersiz bakiye • ${this.opts.buyInCoin} coin / ${this.opts.buyInEnergy} enerji gerekli`;
          this.setStatus(this.message);
          this.updateHudBars();
          this.updateTrigger();
          return;
        }

        updateStoreResources(this.store, {
          coins: -this.opts.buyInCoin,
          energy: -this.opts.buyInEnergy,
          xp: 0,
        });
        this.paid = true;
      }

      if (!this.players.length || this.ended) {
        this.reset(true);
        this.paid = true;
      }

      this.running = true;
      this.processing = false;
      this.ended = false;
      this.awaitingShot = true;
      this.stage = this.aliveCount() === 3 ? "triple" : "final";
      this.message = `${this.players[this.turnIndex].name} sırada`;
      this.setStatus(`Russian Roulette • Raund ${this.roundNumber}`);
      this.updateHudBars();
      this.updateTrigger();

      if (this.players[this.turnIndex]?.isBot) {
        this.scheduleBotShot();
      }
    }

    stop() {
      this.running = false;
      this.awaitingShot = false;
      this.processing = false;
      this.clearTimers();
      this.setStatus("Russian Roulette • Durduruldu");
      this.message = "Oyun durdu.";
      this.updateTrigger();
    }

    clearTimers() {
      if (this.pendingTimer) {
        clearTimeout(this.pendingTimer);
        this.pendingTimer = null;
      }
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
    }

    randomBulletIndex() {
      return Math.floor(Math.random() * this.opts.chamberSize);
    }

    alivePlayers() {
      return this.players.filter((p) => p.alive);
    }

    aliveCount() {
      return this.alivePlayers().length;
    }

    nextAliveIndex(fromIndex) {
      if (!this.players.length) return 0;
      let i = fromIndex;
      for (let step = 0; step < this.players.length; step++) {
        i = (i + 1) % this.players.length;
        if (this.players[i].alive) return i;
      }
      return fromIndex;
    }

    scheduleBotShot() {
      if (this.botTimer) clearTimeout(this.botTimer);
      this.botTimer = setTimeout(() => {
        if (!this.running || !this.awaitingShot || this.processing || this.ended) return;
        const actor = this.players[this.turnIndex];
        if (!actor || !actor.isBot || !actor.alive) return;
        this.fireCurrent();
      }, 900 + Math.random() * 700);
    }

    fireCurrent() {
      if (!this.running || this.processing || this.ended) return;
      const actor = this.players[this.turnIndex];
      if (!actor || !actor.alive) return;

      this.processing = true;
      this.awaitingShot = false;

      const exploded = this.currentChamber === this.bulletIndex;
      this.muzzle = exploded ? 1 : 0.12;
      this.shake = exploded ? 10 : 2;
      this.flash = exploded ? 1 : 0.10;

      if (exploded) {
        actor.lives = Math.max(0, actor.lives - 1);
        this.message = `${actor.name} vuruldu!`;

        if (actor.lives <= 0) {
          actor.alive = false;
          if (actor.id === "me") {
            this.finishPlace = this.aliveCount() === 2 ? 3 : 2;
          }
        }
      } else {
        this.message = `${actor.name} kurtuldu.`;
      }

      this.updateHudBars();
      this.render();

      this.pendingTimer = setTimeout(() => {
        this.resolveAfterShot();
      }, exploded ? 1100 : 650);
    }

    resolveAfterShot() {
      this.pendingTimer = null;

      if (this.aliveCount() <= 1) {
        this.endMatch();
        return;
      }

      const justEnteredFinal = this.aliveCount() === 2 && this.stage !== "final";

      if (this.currentChamber === this.bulletIndex) {
        this.currentChamber = 0;
        this.bulletIndex = this.randomBulletIndex();
        if (justEnteredFinal) this.roundNumber += 1;
      } else {
        this.currentChamber = (this.currentChamber + 1) % this.opts.chamberSize;
      }

      if (justEnteredFinal) {
        this.stage = "final";
        this.message = "Final raund başladı. Silah yeniden dolduruldu.";
      }

      this.turnIndex = this.nextAliveIndex(this.turnIndex);
      this.processing = false;
      this.awaitingShot = true;
      this.setStatus(`Russian Roulette • Raund ${this.roundNumber}`);
      this.updateHudBars();
      this.updateTrigger();

      if (this.players[this.turnIndex]?.isBot) {
        this.scheduleBotShot();
      }
    }

    endMatch() {
      this.running = false;
      this.awaitingShot = false;
      this.processing = false;
      this.ended = true;
      this.clearTimers();

      const winner = this.alivePlayers()[0] || null;
      this.winnerId = winner?.id || null;

      if (winner?.id === "me") {
        this.finishPlace = 1;
      } else if (this.finishPlace == null) {
        this.finishPlace = 2;
      }

      this.applyRewards();
      this.updateHudBars();
      this.updateTrigger();

      if (winner?.id === "me") {
        this.setStatus("Russian Roulette • Kazandın");
        this.message = `Masa senin. +${this.opts.winCoin} coin / +${this.opts.winXp} XP`;
      } else if (this.finishPlace === 2) {
        this.setStatus("Russian Roulette • İkinci oldun");
        this.message = `${winner?.name || "Rakip"} kazandı. ${this.opts.finalRefundCoin} coin iade edildi.`;
      } else {
        this.setStatus("Russian Roulette • Elendin");
        this.message = `${winner?.name || "Rakip"} masayı topladı.`;
      }
    }

    applyRewards() {
      if (this.finalAwarded) return;
      this.finalAwarded = true;

      if (this.finishPlace === 1) {
        updateStoreResources(this.store, {
          coins: this.opts.winCoin,
          energy: 0,
          xp: this.opts.winXp,
        });
      } else if (this.finishPlace === 2) {
        updateStoreResources(this.store, {
          coins: this.opts.finalRefundCoin,
          energy: 0,
          xp: 0,
        });
      }
    }

    setStatus(text) {
      if (this.statusEl) this.statusEl.textContent = text;
    }

    updateTrigger() {
      if (!this.triggerBtn) return;

      if (this.ended) {
        this.triggerBtn.textContent = "TEKRAR OYNA";
        this.triggerBtn.disabled = false;
        this.triggerBtn.onclick = () => {
          this.reset(true);
          this.start();
        };
        return;
      }

      this.triggerBtn.onclick = () => {
        if (!this.running || !this.awaitingShot || this.processing || this.ended) return;
        const actor = this.players[this.turnIndex];
        if (!actor || actor.isBot || !actor.alive) return;
        this.fireCurrent();
      };

      if (!this.running) {
        this.triggerBtn.textContent = "TETİĞİ ÇEK";
        this.triggerBtn.disabled = true;
        return;
      }

      const actor = this.players[this.turnIndex];
      if (!actor) {
        this.triggerBtn.textContent = "TETİĞİ ÇEK";
        this.triggerBtn.disabled = true;
        return;
      }

      if (actor.isBot) {
        this.triggerBtn.textContent = "RAKİP DÜŞÜNÜYOR";
        this.triggerBtn.disabled = true;
      } else {
        this.triggerBtn.textContent = this.processing ? "ATEŞ EDİLİYOR" : "TETİĞİ ÇEK";
        this.triggerBtn.disabled = !this.awaitingShot || this.processing;
      }
    }

    updateHudBars() {
      const me = this.players.find((p) => p.id === "me");
      const enemies = this.players.filter((p) => p.id !== "me");

      const meLives = me ? me.lives : 0;
      const enemyLives = enemies.reduce((sum, p) => sum + p.lives, 0);
      const enemyAlive = enemies.filter((p) => p.alive).length;

      const meRatio = clamp(meLives / this.opts.livesPerPlayer, 0, 1);
      const enemyRatio = clamp(enemyLives / (this.opts.livesPerPlayer * 2), 0, 1);

      if (this.meFillEl) this.meFillEl.style.transform = `scaleX(${meRatio})`;
      if (this.enemyFillEl) this.enemyFillEl.style.transform = `scaleX(${enemyRatio})`;

      if (this.meHpTextEl) this.meHpTextEl.textContent = String(meLives);
      if (this.enemyHpTextEl) this.enemyHpTextEl.textContent = String(enemyAlive);

      if (this.opponentEl) {
        if (enemyAlive <= 0) this.opponentEl.textContent = "Yok";
        else if (enemyAlive === 1) this.opponentEl.textContent = "1 Rakip";
        else this.opponentEl.textContent = "2 Rakip";
      }
    }

    startLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);

      const tick = (ts) => {
        if (!this.canvas || !this.ctx) return;

        fitCanvasToParent(this.canvas);

        const dt = Math.min(0.05, Math.max(0.001, (ts - (this.lastTime || ts)) / 1000));
        this.lastTime = ts;

        this.flash = Math.max(0, this.flash - dt * 2.4);
        this.shake = Math.max(0, this.shake - dt * 24);
        this.muzzle = Math.max(0, this.muzzle - dt * 3.8);
        this.spin += dt * 1.6;
        this.pulse += dt * 3.0;

        this.render();
        this._raf = requestAnimationFrame(tick);
      };

      this._raf = requestAnimationFrame(tick);
    }

    render() {
      if (!this.ctx || !this.canvas) return;

      const ctx = this.ctx;
      const w = this.canvas.clientWidth || 320;
      const h = this.canvas.clientHeight || 420;

      ctx.clearRect(0, 0, w, h);

      const shakeX = (Math.random() - 0.5) * this.shake;
      const shakeY = (Math.random() - 0.5) * this.shake;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      this.drawBackground(ctx, w, h);
      this.drawHeader(ctx, w, h);
      this.drawPlayers(ctx, w, h);
      this.drawGun(ctx, w, h);
      this.drawFooter(ctx, w, h);

      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,248,236,${0.18 * this.flash})`;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
    }

    drawBackground(ctx, w, h) {
      const bg = this.assets.bg;

      if (this.hasLoaded(bg)) {
        const iw = bg.naturalWidth || bg.width;
        const ih = bg.naturalHeight || bg.height;
        const scale = Math.max(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (w - dw) * 0.5;
        const dy = (h - dh) * 0.5;
        ctx.drawImage(bg, dx, dy, dw, dh);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "rgba(10,10,14,1)");
        g.addColorStop(0.55, "rgba(5,5,8,1)");
        g.addColorStop(1, "rgba(3,3,5,1)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      const overlay = ctx.createLinearGradient(0, 0, 0, h);
      overlay.addColorStop(0, "rgba(0,0,0,0.22)");
      overlay.addColorStop(1, "rgba(0,0,0,0.44)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.46, 10, w * 0.5, h * 0.46, w * 0.42);
      glow.addColorStop(0, "rgba(255,85,55,0.16)");
      glow.addColorStop(0.55, "rgba(255,140,60,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    drawHeader(ctx, w, h) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.font = "900 24px system-ui, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.97)";
      ctx.fillText("RUSSIAN ROULETTE", w * 0.5, 22);

      ctx.font = "700 12px system-ui, Arial";
      ctx.fillStyle = "rgba(255,220,180,0.92)";
      ctx.fillText(`6 PATLAR • 1 MERMİ • RAUND ${this.roundNumber}`, w * 0.5, 54);
    }

    drawPlayers(ctx, w, h) {
      const topY = h * 0.18;
      const bottomY = h * 0.58;
      const cardW = Math.min(152, w * 0.34);
      const cardH = 106;

      this.drawPlayerCard(ctx, this.players[1], w * 0.25 - cardW * 0.5, topY, cardW, cardH, this.turnIndex === 1);
      this.drawPlayerCard(ctx, this.players[2], w * 0.75 - cardW * 0.5, topY, cardW, cardH, this.turnIndex === 2);
      this.drawPlayerCard(ctx, this.players[0], w * 0.5 - cardW * 0.5, bottomY, cardW, cardH, this.turnIndex === 0);

      if (this.aliveCount() === 2) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 18px system-ui, Arial";
        ctx.fillStyle = "rgba(255,198,88,0.96)";
        ctx.fillText("FINAL RAUND", w * 0.5, h * 0.51);
      }
    }

    drawPlayerCard(ctx, player, x, y, w, h, active) {
      const alive = !!player?.alive;
      const pulse = active ? 0.5 + 0.5 * Math.sin(this.pulse * 2.2) : 0;

      const border = alive
        ? active
          ? `rgba(255,80,80,${0.56 + 0.24 * pulse})`
          : "rgba(255,255,255,0.14)"
        : "rgba(255,255,255,0.08)";

      const fill = alive
        ? active
          ? "rgba(44,10,10,0.92)"
          : "rgba(16,16,22,0.84)"
        : "rgba(18,18,18,0.56)";

      fillRoundRect(ctx, x, y, w, h, 18, fill);
      strokeRoundRect(ctx, x, y, w, h, 18, border, active ? 2 : 1);

      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      ctx.font = "800 15px system-ui, Arial";
      ctx.fillStyle = alive ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.42)";
      ctx.fillText(player.name, x + w * 0.5, y + 12);

      ctx.font = "700 11px system-ui, Arial";
      ctx.fillStyle = player.isBot ? "rgba(255,188,126,0.88)" : "rgba(255,236,214,0.92)";
      ctx.fillText(player.isBot ? "RAKİP" : "SEN", x + w * 0.5, y + 34);

      ctx.font = "900 24px system-ui, Arial";
      ctx.fillStyle = player.alive ? "rgba(255,248,240,0.98)" : "rgba(255,90,90,0.90)";
      ctx.fillText(String(player.lives), x + w * 0.5, y + 54);

      const barX = x + 14;
      const barY = y + h - 18;
      const barW = w - 28;
      const ratio = clamp(player.lives / this.opts.livesPerPlayer, 0, 1);

      fillRoundRect(ctx, barX, barY, barW, 8, 6, "rgba(255,255,255,0.08)");
      fillRoundRect(
        ctx,
        barX,
        barY,
        Math.max(0, barW * ratio),
        8,
        6,
        player.alive ? "rgba(255,88,88,0.98)" : "rgba(255,255,255,0.15)"
      );
    }

    drawGun(ctx, w, h) {
      const cx = w * 0.5;
      const cy = h * 0.49;
      const drawW = Math.min(w * 0.70, 480);
      const drawH = drawW * 0.56;

      const x = cx - drawW * 0.5;
      const y = cy - drawH * 0.38;

      let sprite = this.assets.revolverIdle;
      if (this.muzzle > 0.2 && this.hasLoaded(this.assets.revolverFire)) {
        sprite = this.assets.revolverFire;
      } else if ((this.running || this.processing) && this.hasLoaded(this.assets.revolverSpin)) {
        sprite = this.assets.revolverSpin;
      }

      if (this.hasLoaded(sprite)) {
        ctx.drawImage(sprite, x, y, drawW, drawH);
      } else {
        this.drawFallbackGun(ctx, w, h);
      }

      if (this.hasLoaded(this.assets.bullet)) {
        const by = h * 0.80;
        const bx1 = w * 0.18;
        const bx2 = w * 0.78;
        const sizeW = Math.min(36, w * 0.06);
        const sizeH = sizeW * 0.40;

        ctx.save();
        ctx.translate(bx1, by);
        ctx.rotate(-0.28);
        ctx.drawImage(this.assets.bullet, -sizeW * 0.5, -sizeH * 0.5, sizeW, sizeH);
        ctx.restore();

        ctx.save();
        ctx.translate(bx2, by + 4);
        ctx.rotate(0.42);
        ctx.drawImage(this.assets.bullet, -sizeW * 0.5, -sizeH * 0.5, sizeW, sizeH);
        ctx.restore();
      }

      if (this.hasLoaded(this.assets.smoke) && this.muzzle > 0.05) {
        const sw = Math.min(110, w * 0.18) * (0.7 + this.muzzle * 0.5);
        const sh = sw;
        ctx.globalAlpha = 0.45 * this.muzzle;
        ctx.drawImage(this.assets.smoke, x + drawW * 0.82, y + drawH * 0.04, sw, sh);
        ctx.globalAlpha = 1;
      }

      if (this.muzzle > 0) {
        const mx = x + drawW * 0.88;
        const my = y + drawH * 0.36;
        const radius = Math.min(68, w * 0.09) * (0.55 + this.muzzle * 0.8);

        const burst = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
        burst.addColorStop(0, `rgba(255,248,228,${0.98 * this.muzzle})`);
        burst.addColorStop(0.35, `rgba(255,180,70,${0.66 * this.muzzle})`);
        burst.addColorStop(1, "rgba(255,120,20,0)");
        ctx.fillStyle = burst;
        ctx.beginPath();
        ctx.arc(mx, my, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const active = this.players[this.turnIndex];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 13px system-ui, Arial";
      ctx.fillStyle = "rgba(255,226,194,0.92)";
      ctx.fillText(active ? `${active.name} sırada` : "", w * 0.5, h * 0.67);
    }

    drawFallbackGun(ctx, w, h) {
      const cx = w * 0.5;
      const cy = h * 0.50;
      const scale = Math.min(w, h) * 0.18;

      ctx.save();
      ctx.translate(cx, cy);

      fillRoundRect(ctx, -scale * 0.05, -scale * 0.16, scale * 1.10, scale * 0.20, scale * 0.06, "#8f93a3");
      fillRoundRect(ctx, scale * 0.12, -scale * 0.01, scale * 0.42, scale * 0.20, scale * 0.06, "#848898");
      fillRoundRect(ctx, scale * 0.88, -scale * 0.11, scale * 0.74, scale * 0.12, scale * 0.04, "#a6a9b8");
      fillRoundRect(ctx, scale * 0.90, 0, scale * 0.56, scale * 0.08, scale * 0.03, "#8c8f9e");
      fillRoundRect(ctx, scale * 1.56, -scale * 0.095, scale * 0.12, scale * 0.09, scale * 0.03, "#c6c8d2");

      ctx.fillStyle = "#44495a";
      ctx.beginPath();
      ctx.arc(scale * 0.30, -scale * 0.02, scale * 0.34, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#262b36";
      ctx.beginPath();
      ctx.arc(scale * 0.30, -scale * 0.02, scale * 0.24, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(scale * 0.08, scale * 0.13);
      ctx.rotate(0.88);
      fillRoundRect(ctx, 0, 0, scale * 0.48, scale * 0.16, scale * 0.05, "#6a4028");
      ctx.restore();

      ctx.strokeStyle = "#727787";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(scale * 0.33, scale * 0.12, scale * 0.12, 0.15, Math.PI + 0.15);
      ctx.stroke();

      ctx.restore();
    }

    drawFooter(ctx, w, h) {
      const boxW = Math.min(w - 28, 420);
      const boxH = 72;
      const boxX = (w - boxW) * 0.5;
      const boxY = h - 98;

      fillRoundRect(ctx, boxX, boxY, boxW, boxH, 18, "rgba(8,8,12,0.72)");
      strokeRoundRect(ctx, boxX, boxY, boxW, boxH, 18, "rgba(255,255,255,0.10)", 1);

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "800 14px system-ui, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText(this.message, w * 0.5, boxY + 14);

      let rewardLine = `Giriş: ${this.opts.buyInCoin} coin / ${this.opts.buyInEnergy} enerji`;
      if (this.ended && this.finishPlace === 1) {
        rewardLine = `Ödül: +${this.opts.winCoin} coin • +${this.opts.winXp} XP`;
      } else if (this.ended && this.finishPlace === 2) {
        rewardLine = `Ödül: ${this.opts.finalRefundCoin} coin iade`;
      } else if (this.ended && this.finishPlace === 3) {
        rewardLine = "Ödül yok";
      }

      ctx.font = "600 12px system-ui, Arial";
      ctx.fillStyle = "rgba(255,210,160,0.88)";
      ctx.fillText(rewardLine, w * 0.5, boxY + 40);
    }

    destroy() {
      this.clearTimers();
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = 0;
      }
      window.removeEventListener("resize", this._resizeHandler);
    }
  }

  const engine = new RussianRouletteEngine();

  window.TonCrimePVP_ROULETTE = {
    _engine: engine,

    init(opts) {
      engine.init(opts);
    },

    setOpponent(opp) {
      engine.setOpponent(opp);
    },

    start() {
      engine.start();
    },

    stop() {
      engine.stop();
    },

    reset() {
      engine.reset(true);
    },

    destroy() {
      engine.destroy();
    },

    close() {
      engine.close();
    },
  };
})();
