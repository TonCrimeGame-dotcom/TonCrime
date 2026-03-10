// src/scenes/CoffeeShopScene.js

const ITEMS = [
  { id: "amnesia_haze", name: "Amnesia Haze", price: 10, energy: 3 },
  { id: "white_widow", name: "White Widow", price: 12, energy: 4 },
  { id: "northern_lights", name: "Northern Lights", price: 14, energy: 5 },
  { id: "super_skunk", name: "Super Skunk", price: 16, energy: 6 },
  { id: "purple_haze", name: "Purple Haze", price: 18, energy: 7 },
  { id: "orange_bud", name: "Orange Bud", price: 20, energy: 8 },
  { id: "blue_dream", name: "Blue Dream", price: 22, energy: 9 },
  { id: "gelato", name: "Gelato", price: 24, energy: 10 },
  { id: "gorilla_glue", name: "Gorilla Glue", price: 26, energy: 11 },
  { id: "green_crack", name: "Green Crack", price: 28, energy: 12 },

  { id: "ak47", name: "AK-47", price: 30, energy: 13 },
  { id: "super_silver", name: "Super Silver Haze", price: 32, energy: 14 },
  { id: "jack_herer", name: "Jack Herer", price: 34, energy: 15 },
  { id: "og_kush", name: "OG Kush", price: 36, energy: 16 },
  { id: "girl_scout", name: "Girl Scout Cookies", price: 38, energy: 17 },
  { id: "sour_diesel", name: "Sour Diesel", price: 40, energy: 18 },
  { id: "zkittlez", name: "Zkittlez", price: 42, energy: 19 },
  { id: "wedding_cake", name: "Wedding Cake", price: 44, energy: 20 },
  { id: "banana_kush", name: "Banana Kush", price: 46, energy: 21 },
  { id: "mimosa", name: "Mimosa", price: 48, energy: 22 },

  { id: "choco_haze", name: "Choco Haze", price: 50, energy: 23 },
  { id: "rainbow_belts", name: "Rainbow Belts", price: 53, energy: 24 },
  { id: "moon_rocks", name: "Moon Rocks", price: 56, energy: 25 },
  { id: "ice_hash", name: "Ice Hash", price: 59, energy: 26 },
  { id: "amsterdam_gold", name: "Amsterdam Gold", price: 62, energy: 27 },
  { id: "black_tuna", name: "Black Tuna", price: 65, energy: 28 },
  { id: "platinum_kush", name: "Platinum Kush", price: 68, energy: 29 },
  { id: "ghost_train", name: "Ghost Train Haze", price: 71, energy: 30 },
  { id: "diamond_resin", name: "Diamond Resin", price: 75, energy: 32 },
  { id: "dam_crown", name: "Dam Crown", price: 80, energy: 35 },
];

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export class CoffeeShopScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.downY = 0;
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = [];
    this.backHit = null;

    this.toastText = "";
    this.toastUntil = 0;

    this.music = null;
    this.musicStarted = false;

    this.smoke = [];
    this.jointFx = [];

    this.blurUntil = 0;
    this.slowUntil = 0;
    this.jackpotUntil = 0;
    this.lastFrameAt = 0;
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hit = [];
    this.backHit = null;
    this.toastText = "";
    this.toastUntil = 0;
    this.blurUntil = 0;
    this.slowUntil = 0;
    this.jackpotUntil = 0;
    this.lastFrameAt = performance.now();

    const s = this.store.get();
    const p = s.player || {};

    const patch = {};
    if (!Number.isFinite(Number(p.coffeeshopUses))) patch.coffeeshopUses = 0;
    if (!Number.isFinite(Number(p.coffeeshopTolerance))) patch.coffeeshopTolerance = 0;
    if (Object.keys(patch).length) {
      this.store.set({
        player: {
          ...p,
          ...patch,
        },
      });
    }

    this._seedSmoke(18);
    this._ensureMusic();
  }

  onExit() {
    this.dragging = false;
    if (this.music) {
      try {
        this.music.pause();
      } catch (_) {}
    }
  }

  _ensureMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;

    try {
      this.music = new Audio("./src/assets/reggae.mp3");
      this.music.loop = true;
      this.music.volume = 0.32;

      const play = () => {
        if (!this.music) return;
        this.music.play().catch(() => {});
        window.removeEventListener("pointerdown", play);
        window.removeEventListener("touchstart", play);
        window.removeEventListener("click", play);
      };

      window.addEventListener("pointerdown", play, { passive: true, once: true });
      window.addEventListener("touchstart", play, { passive: true, once: true });
      window.addEventListener("click", play, { passive: true, once: true });
    } catch (_) {}
  }

  _safeRect() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _getBg() {
    if (typeof this.assets?.getImage === "function") {
      return this.assets.getImage("coffeeshop_bg") || this.assets.getImage("coffeeshop");
    }
    if (typeof this.assets?.get === "function") {
      return this.assets.get("coffeeshop_bg") || this.assets.get("coffeeshop");
    }
    return this.assets?.images?.coffeeshop_bg || this.assets?.images?.coffeeshop || null;
  }

  _rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(x, y, w, h);
      return;
    }

    const iw = img.width || 1;
    const ih = img.height || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  _showToast(text, ms = 1600) {
    this.toastText = text;
    this.toastUntil = Date.now() + ms;
  }

  _seedSmoke(count) {
    this.smoke = [];
    const safe = this._safeRect();
    for (let i = 0; i < count; i++) {
      this.smoke.push({
        x: safe.x + Math.random() * safe.w,
        y: safe.y + Math.random() * safe.h,
        r: 18 + Math.random() * 42,
        alpha: 0.05 + Math.random() * 0.08,
        vx: -0.12 + Math.random() * 0.24,
        vy: -0.15 - Math.random() * 0.3,
        life: 0.4 + Math.random() * 1.1,
      });
    }
  }

  _spawnSmokeBurst(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      this.smoke.push({
        x,
        y,
        r: 12 + Math.random() * 20,
        alpha: 0.12 + Math.random() * 0.10,
        vx: -0.4 + Math.random() * 0.8,
        vy: -0.7 - Math.random() * 0.7,
        life: 0.8 + Math.random() * 1.2,
      });
    }
  }

  _spawnJointFx(x, y) {
    this.jointFx.push({
      x,
      y,
      vy: -0.9,
      life: 1,
      rot: -0.2 + Math.random() * 0.4,
      scale: 0.95 + Math.random() * 0.2,
    });
  }

  _updateFx() {
    const now = performance.now();
    let dt = this.lastFrameAt ? (now - this.lastFrameAt) / 16.6667 : 1;
    this.lastFrameAt = now;

    dt = clamp(dt, 0.4, 2.2);

    if (Date.now() < this.slowUntil) {
      dt *= 0.45;
    }

    const safe = this._safeRect();

    for (const s of this.smoke) {
      s.x += s.vx * dt * 2.2;
      s.y += s.vy * dt * 2.2;
      s.r += 0.04 * dt * 10;
      s.life -= 0.0038 * dt * 10;

      if (s.life <= 0 || s.y + s.r < safe.y - 30) {
        s.x = safe.x + Math.random() * safe.w;
        s.y = safe.y + safe.h + Math.random() * 24;
        s.r = 18 + Math.random() * 42;
        s.alpha = 0.05 + Math.random() * 0.08;
        s.vx = -0.12 + Math.random() * 0.24;
        s.vy = -0.15 - Math.random() * 0.3;
        s.life = 0.6 + Math.random() * 1.1;
      }
    }

    for (let i = this.jointFx.length - 1; i >= 0; i--) {
      const fx = this.jointFx[i];
      fx.y += fx.vy * dt * 3.5;
      fx.life -= 0.025 * dt;
      if (fx.life <= 0) this.jointFx.splice(i, 1);
    }
  }

  _applyToleranceEnergy(itemEnergy, uses) {
    if (uses < 10) return itemEnergy;
    return Math.max(1, Math.floor(itemEnergy * 0.7));
  }

  _buy(item, hitRect = null) {
    const s = this.store.get();
    const coins = Number(s.coins || 0);
    const p = s.player || {};
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 10));

    if (coins < item.price) {
      this._showToast("Yetersiz coin");
      return;
    }

    if (energy >= energyMax) {
      this._showToast("Enerji full");
      return;
    }

    let uses = Number(p.coffeeshopUses || 0) + 1;
    const tolerant = uses >= 10;
    const adjustedEnergy = this._applyToleranceEnergy(item.energy, uses);
    const add = Math.min(adjustedEnergy, energyMax - energy);

    let nextCoins = coins - item.price;
    let nextEnergy = energy + add;

    let toast = `+${add} enerji / -${item.price} yton`;

    if (tolerant) {
      toast = `Bağışıklık aktif: +${add} enerji`;
    }

    if (Math.random() < 0.30) {
      const stolenCoins = Math.min(nextCoins, Math.max(1, Math.floor(nextCoins * 0.2)));
      const stolenEnergy = Math.min(nextEnergy, Math.max(1, Math.floor(nextEnergy * 0.2)));
      nextCoins = Math.max(0, nextCoins - stolenCoins);
      nextEnergy = Math.max(0, nextEnergy - stolenEnergy);
      toast = "Sokakta dayak yedin! Enerji ve yton çalındı.";
      this.blurUntil = Date.now() + 900;
      this.slowUntil = Date.now() + 1000;
    }

    let jackpotHit = false;
    if (Math.random() < 0.05) {
      jackpotHit = true;
      nextCoins += 25;
      nextEnergy = Math.min(energyMax, nextEnergy + 15);
      this.jackpotUntil = Date.now() + 2600;
      toast = "🎰 Rare Weed Jackpot! +25 yton ve +15 enerji";
    }

    this.store.set({
      coins: nextCoins,
      player: {
        ...p,
        energy: nextEnergy,
        coffeeshopUses: uses,
        coffeeshopTolerance: tolerant ? 1 : 0,
      },
    });

    if (hitRect) {
      this._spawnJointFx(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.4);
      this._spawnSmokeBurst(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.5, jackpotHit ? 10 : 6);
    }

    this._showToast(toast, jackpotHit ? 2200 : 1600);
  }

  update() {
    this._updateFx();

    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input.justPressed()) {
      this.dragging = true;
      this.downY = py;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
      this._ensureMusic();
    }

    if (this.dragging && this.input.isDown()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input.justReleased()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      if (this.backHit && pointInRect(px, py, this.backHit)) {
        this.scenes.go("home");
        return;
      }

      for (const r of this.hit) {
        if (pointInRect(px, py, r)) {
          this._buy(r.item, r);
          return;
        }
      }
    }
  }

  _drawSmoke(ctx) {
    for (const s of this.smoke) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(210,255,210,${s.alpha * s.life})`);
      g.addColorStop(0.45, `rgba(180,220,180,${s.alpha * 0.55 * s.life})`);
      g.addColorStop(1, `rgba(120,160,120,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawJointFx(ctx) {
    for (const fx of this.jointFx) {
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.rot);
      ctx.scale(fx.scale, fx.scale);
      ctx.globalAlpha = fx.life;

      ctx.fillStyle = "rgba(246,228,190,0.98)";
      this._rr(ctx, -18, -4, 28, 8, 4);
      ctx.fill();

      ctx.fillStyle = "rgba(255,120,20,0.95)";
      ctx.beginPath();
      ctx.arc(12, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(120,255,120,0.95)";
      ctx.font = "900 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🌿", -22, -2);

      ctx.restore();
    }
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);

    const safe = this._safeRect();
    const bg = this._getBg();

    ctx.clearRect(0, 0, W, H);

    if (Date.now() < this.blurUntil) {
      ctx.save();
      ctx.filter = "blur(3px)";
      this._drawCover(ctx, bg, -6, -6, W + 12, H + 12);
      ctx.restore();
    } else {
      this._drawCover(ctx, bg, 0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, W, H);

    this._drawSmoke(ctx);

    const panelX = safe.x + 12;
    const panelY = Math.max(72, safe.y + 74);
    const panelW = Math.max(220, safe.w - 24);
    const panelH = Math.max(260, safe.h - 150);

    this._rr(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fillStyle = "rgba(7,7,7,0.58)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (Date.now() < this.jackpotUntil) {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,215,90,0.95)";
      this._rr(ctx, panelX + 2, panelY + 2, panelW - 4, panelH - 4, 18);
      ctx.stroke();
      ctx.restore();
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Amsterdam Coffeeshop", panelX + 16, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "12px system-ui";
    ctx.fillText("Ot al, enerjini doldur.", panelX + 16, panelY + 48);

    const s = this.store.get();
    const coins = Number(s.coins || 0);
    const player = s.player || {};
    const energy = Number(player.energy || 0);
    const energyMax = Number(player.energyMax || 10);
    const uses = Number(player.coffeeshopUses || 0);
    const tolerant = uses >= 10;

    ctx.fillStyle = "rgba(255,214,120,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`Coin: ${coins}`, panelX + 16, panelY + 70);

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(`Enerji: ${energy}/${energyMax}`, panelX + 104, panelY + 70);

    ctx.fillStyle = tolerant ? "rgba(140,255,160,0.96)" : "rgba(255,255,255,0.70)";
    ctx.fillText(`Bağışıklık: ${tolerant ? "AKTİF" : `${uses}/10`}`, panelX + 220, panelY + 70);

    const backW = 78;
    const backH = 30;
    const backX = panelX + panelW - backW - 14;
    const backY = panelY + 12;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };

    this._rr(ctx, backX, backY, backW, backH, 10);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText("Geri", backX + backW / 2, backY + 19);

    const listX = panelX + 10;
    const listY = panelY + 88;
    const listW = panelW - 20;
    const listH = panelH - 100;

    const rowH = 68;
    const contentH = ITEMS.length * rowH + 8;

    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    this.hit = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    if (Date.now() < this.slowUntil) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(listX, listY, listW, listH);
      ctx.restore();
    }

    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      const y = listY + i * rowH - this.scrollY;

      if (y > listY + listH + 10 || y + 58 < listY - 10) continue;

      this._rr(ctx, listX, y, listW, 58, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();

      if (Date.now() < this.jackpotUntil && i % 3 === 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,215,90,0.35)";
        ctx.lineWidth = 1.5;
        this._rr(ctx, listX + 1, y + 1, listW - 2, 56, 14);
        ctx.stroke();
        ctx.restore();
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "800 13px system-ui";
      ctx.fillText(item.name, listX + 12, y + 20);

      const previewEnergy = this._applyToleranceEnergy(item.energy, uses + 1);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${previewEnergy} enerji`, listX + 12, y + 41);

      ctx.fillStyle = "rgba(255,214,120,0.96)";
      ctx.fillText(`${item.price} yton`, listX + 104, y + 41);

      const btnW = 98;
      const btnH = 34;
      const btnX = listX + listW - btnW - 10;
      const btnY = y + 12;

      this._rr(ctx, btnX, btnY, btnW, btnH, 12);
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "900 12px system-ui";
      ctx.fillText("Satın Al", btnX + btnW / 2, btnY + 21);

      this.hit.push({ x: btnX, y: btnY, w: btnW, h: btnH, item });
    }

    ctx.restore();

    this._drawJointFx(ctx);

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 6;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(36, (listH / contentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(trackX, trackY, 3, trackH);

      ctx.fillStyle = "rgba(255,255,255,0.34)";
      ctx.fillRect(trackX, thumbY, 3, thumbH);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(320, panelW - 36);
      const th = 36;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 48;

      this._rr(ctx, tx, ty, tw, th, 12);
      ctx.fillStyle =
        Date.now() < this.jackpotUntil
          ? "rgba(70,50,0,0.88)"
          : "rgba(0,0,0,0.76)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "800 12px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + 22);
    }

    if (Date.now() < this.slowUntil) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
