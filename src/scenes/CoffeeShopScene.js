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
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hit = [];
    this.backHit = null;
  }

  onExit() {}

  _safeRect() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _getBg() {
    if (typeof this.assets.getImage === "function") {
      return this.assets.getImage("coffeeshop_bg") || this.assets.getImage("coffeeshop");
    }
    if (typeof this.assets.get === "function") {
      return this.assets.get("coffeeshop_bg") || this.assets.get("coffeeshop");
    }
    return this.assets.images?.coffeeshop_bg || this.assets.images?.coffeeshop || null;
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

  _showToast(text, ms = 1200) {
    this.toastText = text;
    this.toastUntil = Date.now() + ms;
  }

  _buy(item) {
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

    const add = Math.min(item.energy, energyMax - energy);

    this.store.set({
      coins: coins - item.price,
      player: {
        ...p,
        energy: energy + add,
      },
    });

    this._showToast(`+${add} enerji  /  -${item.price} yton`);
  }

  update() {
    const px = this.input.pointer?.x || 0;
    const py = this.input.pointer?.y || 0;

    if (this.input.justPressed()) {
      this.dragging = true;
      this.downY = py;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
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

      if (
        this.backHit &&
        px >= this.backHit.x &&
        px <= this.backHit.x + this.backHit.w &&
        py >= this.backHit.y &&
        py <= this.backHit.y + this.backHit.h
      ) {
        this.scenes.go("home");
        return;
      }

      for (const r of this.hit) {
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          this._buy(r.item);
          return;
        }
      }
    }
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);

    const safe = this._safeRect();
    const bg = this._getBg();

    ctx.clearRect(0, 0, W, H);
    this._drawCover(ctx, bg, 0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x + 12;
    const panelY = Math.max(72, safe.y + 74);
    const panelW = safe.w - 24;
    const panelH = safe.h - 150;

    this._rr(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fillStyle = "rgba(7,7,7,0.58)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

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
    const energy = Number(s.player?.energy || 0);
    const energyMax = Number(s.player?.energyMax || 10);

    ctx.fillStyle = "rgba(255,214,120,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`Coin: ${coins}`, panelX + 16, panelY + 70);

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(`Enerji: ${energy}/${energyMax}`, panelX + 104, panelY + 70);

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

    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      const y = listY + i * rowH - this.scrollY;

      if (y > listY + listH + 10 || y + 58 < listY - 10) continue;

      this._rr(ctx, listX, y, listW, 58, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "800 13px system-ui";
      ctx.fillText(item.name, listX + 12, y + 20);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, listX + 12, y + 41);

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
      const tw = Math.min(280, panelW - 36);
      const th = 34;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 46;

      this._rr(ctx, tx, ty, tw, th, 12);
      ctx.fillStyle = "rgba(0,0,0,0.76)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "800 12px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + 21);
    }
  }
}