export class NightclubScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.justDragged = false;

    this.hitBuy = [];
    this.toast = "";
    this.toastUntil = 0;

    this.items = [
      { id: 1, name: "Bira Shot", energy: 1, price: 1 },
      { id: 2, name: "Küçük Bira", energy: 2, price: 3 },
      { id: 3, name: "Efes Malt", energy: 3, price: 5 },
      { id: 4, name: "Tuborg Gold", energy: 4, price: 7 },
      { id: 5, name: "Tekila Shot", energy: 5, price: 9 },
      { id: 6, name: "Vodka Shot", energy: 6, price: 11 },
      { id: 7, name: "Cin Tonik", energy: 7, price: 13 },
      { id: 8, name: "Mojito", energy: 8, price: 15 },
      { id: 9, name: "Margarita", energy: 9, price: 17 },
      { id: 10, name: "Şarap Kadeh", energy: 10, price: 19 },
      { id: 11, name: "Kırmızı Şarap", energy: 11, price: 21 },
      { id: 12, name: "Beyaz Şarap", energy: 12, price: 23 },
      { id: 13, name: "Rakı Tek", energy: 13, price: 25 },
      { id: 14, name: "Rakı Duble", energy: 14, price: 27 },
      { id: 15, name: "Yeni Rakı 20cl", energy: 15, price: 29 },
      { id: 16, name: "Yeni Rakı 35cl", energy: 16, price: 32 },
      { id: 17, name: "Tekirdağ Rakısı 20cl", energy: 17, price: 35 },
      { id: 18, name: "Tekirdağ Rakısı 35cl", energy: 18, price: 38 },
      { id: 19, name: "Altınbaş Rakı 20cl", energy: 19, price: 41 },
      { id: 20, name: "Altınbaş Rakı 35cl", energy: 20, price: 44 },
      { id: 21, name: "Vodka 35cl", energy: 21, price: 47 },
      { id: 22, name: "Cin 35cl", energy: 22, price: 50 },
      { id: 23, name: "Rom 35cl", energy: 23, price: 53 },
      { id: 24, name: "Viski 20cl", energy: 24, price: 56 },
      { id: 25, name: "Viski 35cl", energy: 25, price: 59 },
      { id: 26, name: "Yeni Rakı 50cl", energy: 26, price: 62 },
      { id: 27, name: "Tekirdağ Rakısı 50cl", energy: 27, price: 66 },
      { id: 28, name: "Altınbaş Rakı 50cl", energy: 28, price: 70 },
      { id: 29, name: "Premium Rakı 70cl", energy: 29, price: 73 },
      { id: 30, name: "Ultra Premium Rakı 70cl", energy: 30, price: 75 },
    ];
  }

  onEnter() {
    this.scrollY = 0;
    this.dragging = false;
    this.justDragged = false;
    this.hitBuy = [];
  }

  onExit() {
    this.dragging = false;
  }

  _safe() {
    const s = this.store.get();
    return s?.ui?.safe || { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _showToast(text, ms = 1200) {
    this.toast = text;
    this.toastUntil = Date.now() + ms;
  }

  _getBg() {
    if (typeof this.assets.getImage === "function") return this.assets.getImage("nightclub");
    if (typeof this.assets.get === "function") return this.assets.get("nightclub");
    if (this.assets.images instanceof Map) {
      const entry = this.assets.images.get("nightclub");
      return entry?.img || null;
    }
    return null;
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#120b08";
      ctx.fillRect(x, y, w, h);
      return;
    }

    const iw = img.width || img.naturalWidth || 1;
    const ih = img.height || img.naturalHeight || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _clampScroll(viewH, contentH) {
    const maxScroll = Math.max(0, contentH - viewH);
    if (this.scrollY < 0) this.scrollY = 0;
    if (this.scrollY > maxScroll) this.scrollY = maxScroll;
  }

  _buy(item) {
    const s = this.store.get();
    const p = s.player || {};

    const coins = Number(s.coins || 0);
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 10));

    if (coins < item.price) {
      this._showToast("Yetersiz coin");
      return;
    }

    if (energy >= energyMax) {
      this._showToast("Enerji zaten dolu");
      return;
    }

    const gain = Math.min(item.energy, energyMax - energy);
    const nextEnergy = energy + gain;

    this.store.set({
      coins: coins - item.price,
      player: {
        ...p,
        energy: nextEnergy,
      },
    });

    this._showToast(`+${gain} enerji / -${item.price} yton`);
  }

  update() {
    const safe = this._safe();
    const px = this.input.pointer?.x || 0;
    const py = this.input.pointer?.y || 0;

    const panelX = safe.x + 14;
    const panelY = safe.y + 88;
    const panelW = safe.w - 28;
    const panelH = safe.h - 160;

    const listX = panelX + 10;
    const listY = panelY + 74;
    const listW = panelW - 20;
    const listH = panelH - 84;

    const rowH = 62;
    const contentH = this.items.length * rowH + 8;

    this._clampScroll(listH, contentH);

    if (this.input.justPressed()) {
      this.dragging = true;
      this.justDragged = false;
      this.downY = py;
      this.startScrollY = this.scrollY;
    }

    if (this.dragging && this.input.isDown()) {
      const dy = py - this.downY;
      if (Math.abs(dy) > 6) this.justDragged = true;
      this.scrollY = this.startScrollY - dy;
      this._clampScroll(listH, contentH);
    }

    if (this.dragging && this.input.justReleased()) {
      if (!this.justDragged) {
        for (const hit of this.hitBuy) {
          if (
            px >= hit.x &&
            px <= hit.x + hit.w &&
            py >= hit.y &&
            py <= hit.y + hit.h
          ) {
            this._buy(hit.item);
            break;
          }
        }
      }

      this.dragging = false;
      this.justDragged = false;
    }
  }

  render(ctx, w, h) {
    const safe = this._safe();
    const bg = this._getBg();

    this._drawCover(ctx, bg, 0, 0, w, h);

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 14;
    const panelY = safe.y + 88;
    const panelW = safe.w - 28;
    const panelH = safe.h - 160;

    this._roundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fillStyle = "rgba(10,10,10,0.58)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 20px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Gece Kulübü", panelX + 16, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("İçki satın al, enerjini doldur.", panelX + 16, panelY + 48);

    const s = this.store.get();
    const coins = Number(s?.coins || 0);
    const energy = Number(s?.player?.energy || 0);
    const energyMax = Number(s?.player?.energyMax || 10);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,220,120,0.96)";
    ctx.font = "700 12px system-ui";
    ctx.fillText(`Coin: ${coins}`, panelX + panelW - 16, panelY + 26);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`Enerji: ${energy}/${energyMax}`, panelX + panelW - 16, panelY + 46);

    const listX = panelX + 10;
    const listY = panelY + 74;
    const listW = panelW - 20;
    const listH = panelH - 84;
    const rowH = 62;
    const contentH = this.items.length * rowH + 8;

    this._clampScroll(listH, contentH);
    this.hitBuy = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const y = listY + i * rowH - this.scrollY;

      if (y + rowH < listY - 8 || y > listY + listH + 8) continue;

      this._roundRect(ctx, listX, y, listW, 54, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 13px system-ui";
      ctx.fillText(item.name, listX + 12, y + 19);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, listX + 12, y + 38);

      ctx.fillStyle = "rgba(255,215,120,0.92)";
      ctx.fillText(`${item.price} yton`, listX + 110, y + 38);

      const bw = 92;
      const bh = 32;
      const bx = listX + listW - bw - 10;
      const by = y + 11;

      this._roundRect(ctx, bx, by, bw, bh, 12);
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 12px system-ui";
      ctx.fillText("Satın Al", bx + bw / 2, by + 20);

      this.hitBuy.push({ x: bx, y: by, w: bw, h: bh, item });
    }

    ctx.restore();

    if (contentH > listH) {
      const trackX = panelX + panelW - 6;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(36, (listH / contentH) * trackH);
      const maxScroll = Math.max(1, contentH - listH);
      const thumbY = trackY + ((trackH - thumbH) * (this.scrollY / maxScroll));

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(trackX, trackY, 3, trackH);

      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(trackX, thumbY, 3, thumbH);
    }

    if (this.toast && Date.now() < this.toastUntil) {
      const tw = Math.min(250, panelW - 40);
      const th = 34;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 46;

      this._roundRect(ctx, tx, ty, tw, th, 12);
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 12px system-ui";
      ctx.fillText(this.toast, tx + tw / 2, ty + 21);
    }
  }
}