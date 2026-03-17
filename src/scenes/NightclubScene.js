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
    this.hitPvp = null;
    this.hitBack = null;

    this.toast = "";
    this.toastUntil = 0;

    this.items = [
      { id: "nc_01", name: "Luna", energy: 4, price: 12, rarity: "Sokak", marketValue: 18 },
      { id: "nc_02", name: "Ruby", energy: 5, price: 15, rarity: "Sokak", marketValue: 22 },
      { id: "nc_03", name: "Mia", energy: 6, price: 18, rarity: "Sokak", marketValue: 26 },
      { id: "nc_04", name: "Nora", energy: 7, price: 21, rarity: "Sokak", marketValue: 31 },
      { id: "nc_05", name: "Vera", energy: 8, price: 24, rarity: "Kulüp", marketValue: 36 },
      { id: "nc_06", name: "Sasha", energy: 9, price: 27, rarity: "Kulüp", marketValue: 40 },
      { id: "nc_07", name: "Alina", energy: 10, price: 30, rarity: "Kulüp", marketValue: 45 },
      { id: "nc_08", name: "Diana", energy: 11, price: 33, rarity: "Kulüp", marketValue: 49 },
      { id: "nc_09", name: "Elena", energy: 12, price: 37, rarity: "Kulüp", marketValue: 55 },
      { id: "nc_10", name: "Bianca", energy: 13, price: 41, rarity: "VIP", marketValue: 61 },
      { id: "nc_11", name: "Naomi", energy: 14, price: 45, rarity: "VIP", marketValue: 67 },
      { id: "nc_12", name: "Valeria", energy: 15, price: 49, rarity: "VIP", marketValue: 73 },
      { id: "nc_13", name: "Carmen", energy: 16, price: 53, rarity: "VIP", marketValue: 79 },
      { id: "nc_14", name: "Selena", energy: 17, price: 58, rarity: "VIP", marketValue: 86 },
      { id: "nc_15", name: "Monica", energy: 18, price: 63, rarity: "Elite", marketValue: 93 },
      { id: "nc_16", name: "Angel", energy: 19, price: 68, rarity: "Elite", marketValue: 100 },
      { id: "nc_17", name: "Scarlet", energy: 20, price: 73, rarity: "Elite", marketValue: 108 },
      { id: "nc_18", name: "Bella", energy: 21, price: 78, rarity: "Elite", marketValue: 116 },
      { id: "nc_19", name: "Aurora", energy: 22, price: 84, rarity: "Elite", marketValue: 125 },
      { id: "nc_20", name: "Ivana", energy: 24, price: 90, rarity: "Legend", marketValue: 138 },
    ];
  }

  onEnter() {
    this.scrollY = 0;
    this.dragging = false;
    this.justDragged = false;
    this.hitBuy = [];
    this.hitPvp = null;
    this.hitBack = null;
    this._ensureState();
    this._pushSystemChat(`🪩 ${this._playerName()} Nightclub'a girdi.`);
  }

  onExit() {
    this.dragging = false;
    this._pushSystemChat(`🚪 ${this._playerName()} Nightclub'dan çıktı.`);
  }

  _ensureState() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};

    const next = {
      nightclub: {
        inventory: Array.isArray(nightclub.inventory) ? nightclub.inventory : [],
        lastRaidAt: Number(nightclub.lastRaidAt || 0),
        raidCount: Number(nightclub.raidCount || 0),
        totalSpent: Number(nightclub.totalSpent || 0),
        totalBought: Number(nightclub.totalBought || 0),
      },
    };

    if (p.energy == null || p.energyMax == null) {
      next.player = {
        ...p,
        energy: Number(p.energy ?? 10),
        energyMax: Number(p.energyMax ?? 100),
      };
    }

    this.store.set(next);
  }

  _playerName() {
    const s = this.store.get() || {};
    return String(s?.player?.username || "Player");
  }

  _safe() {
    const s = this.store.get();
    return s?.ui?.safe || { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _showToast(text, ms = 1400) {
    this.toast = text;
    this.toastUntil = Date.now() + ms;
  }

  _getBg() {
    if (typeof this.assets?.getImage === "function") return this.assets.getImage("nightclub");
    if (typeof this.assets?.get === "function") return this.assets.get("nightclub");
    if (this.assets?.images instanceof Map) {
      const entry = this.assets.images.get("nightclub");
      return entry?.img || null;
    }
    return null;
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#130b11";
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

  _pointInRect(px, py, r) {
    return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  _clampScroll(viewH, contentH) {
    const maxScroll = Math.max(0, contentH - viewH);
    if (this.scrollY < 0) this.scrollY = 0;
    if (this.scrollY > maxScroll) this.scrollY = maxScroll;
  }

  _pushSystemChat(text) {
    const s = this.store.get() || {};
    const chat = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    const ts = Date.now();

    chat.push({
      id: `sys_${ts}_${Math.random().toString(36).slice(2, 7)}`,
      type: "system",
      username: "SYSTEM",
      text: String(text || ""),
      ts,
    });

    this.store.set({ chatLog: chat });

    try {
      window.dispatchEvent(
        new CustomEvent("tc:chat:push", {
          detail: {
            id: `sys_${ts}`,
            type: "system",
            username: "SYSTEM",
            text: String(text || ""),
            ts,
          },
        })
      );
    } catch (_) {}

    try {
      const el = document.getElementById("chatMessages");
      if (el) {
        const row = document.createElement("div");
        row.className = "msg";

        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");

        row.innerHTML = `
          <span class="meta">${hh}:${mm}</span>
          <span><b>SYSTEM</b> ${this._escapeHtml(String(text || ""))}</span>
        `;
        el.appendChild(row);
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {}
  }

  _escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _openPvp() {
    try {
      window.dispatchEvent(new Event("tc:openPvp"));
      this._showToast("PvP açıldı");
      this._pushSystemChat(`⚔️ ${this._playerName()} Nightclub içinden PvP başlattı.`);
    } catch (_) {
      this._showToast("PvP açılamadı");
    }
  }

  _applyPoliceRaid(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    const loss = Math.max(4, Math.min(22, Math.ceil(item.energy * 0.8)));
    const nextEnergy = Math.max(0, energy - loss);

    this.store.set({
      player: {
        ...p,
        energy: nextEnergy,
      },
      nightclub: {
        ...nightclub,
        lastRaidAt: Date.now(),
        raidCount: Number(nightclub.raidCount || 0) + 1,
      },
    });

    this._showToast(`🚓 Polis baskını! -${loss} enerji`, 1800);
    this._pushSystemChat(
      `🚓 Polis baskını Nightclub'da patladı. ${this._playerName()} ${loss} enerji kaybetti.`
    );

    return { loss, nextEnergy, energyMax };
  }

  _buy(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};

    const coins = Number(s.coins || 0);
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    if (coins < item.price) {
      this._showToast("Yetersiz yton");
      return;
    }

    const gain = Math.min(item.energy, Math.max(0, energyMax - energy));
    const nextEnergy = Math.min(energyMax, energy + gain);

    const inventory = Array.isArray(nightclub.inventory) ? [...nightclub.inventory] : [];
    inventory.push({
      uid: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      itemId: item.id,
      name: item.name,
      energy: Number(item.energy || 0),
      rarity: item.rarity || "Kulüp",
      buyPrice: Number(item.price || 0),
      marketValue: Number(item.marketValue || item.price || 0),
      source: "nightclub",
      createdAt: Date.now(),
      sellable: true,
      category: "nightclub_girl",
    });

    this.store.set({
      coins: coins - item.price,
      player: {
        ...p,
        energy: nextEnergy,
      },
      nightclub: {
        ...nightclub,
        inventory,
        totalSpent: Number(nightclub.totalSpent || 0) + Number(item.price || 0),
        totalBought: Number(nightclub.totalBought || 0) + 1,
      },
    });

    this._pushSystemChat(
      `💃 ${this._playerName()} ${item.name} satın aldı. (+${gain} enerji / -${item.price} yton)`
    );

    const raidRoll = Math.random();
    if (raidRoll < 0.20) {
      this._applyPoliceRaid(item);
      return;
    }

    this._showToast(`+${gain} enerji / -${item.price} yton`, 1400);
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
    const listY = panelY + 104;
    const listW = panelW - 20;
    const listH = panelH - 114;

    const rowH = 82;
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
        if (this._pointInRect(px, py, this.hitBack)) {
          this.scenes.go("home");
          this.dragging = false;
          this.justDragged = false;
          return;
        }

        if (this._pointInRect(px, py, this.hitPvp)) {
          this._openPvp();
          this.dragging = false;
          this.justDragged = false;
          return;
        }

        for (const hit of this.hitBuy) {
          if (this._pointInRect(px, py, hit)) {
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

    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 14;
    const panelY = safe.y + 88;
    const panelW = safe.w - 28;
    const panelH = safe.h - 160;

    this._roundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fillStyle = "rgba(8,6,10,0.64)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const s = this.store.get() || {};
    const nightclub = s.nightclub || {};
    const coins = Number(s.coins || 0);
    const energy = Number(s?.player?.energy || 0);
    const energyMax = Number(s?.player?.energyMax || 100);
    const invCount = Array.isArray(nightclub.inventory) ? nightclub.inventory.length : 0;
    const raidCount = Number(nightclub.raidCount || 0);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.font = "700 20px system-ui";
    ctx.fillText("Nightclub", panelX + 16, panelY + 28);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,220,120,0.96)";
    ctx.font = "700 12px system-ui";
    ctx.fillText(`YTON: ${coins}`, panelX + panelW - 16, panelY + 24);

    const closeSize = 34;
    this.hitBack = { x: panelX + panelW - closeSize - 12, y: panelY + 12, w: closeSize, h: closeSize };

    this._roundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 11);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 18px system-ui";
    ctx.fillText("X", this.hitBack.x + this.hitBack.w / 2, this.hitBack.y + 23);

    const topBtnY = panelY + 44;
    const pvpW = 124;
    const pvpH = 34;

    this.hitPvp = { x: panelX + panelW - pvpW - 12, y: topBtnY, w: pvpW, h: pvpH };

    this._roundRect(ctx, this.hitPvp.x, this.hitPvp.y, this.hitPvp.w, this.hitPvp.h, 12);
    ctx.fillStyle = "rgba(120,20,20,0.42)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();
    ctx.fillText("⚔ PvP Saldır", this.hitPvp.x + this.hitPvp.w / 2, this.hitPvp.y + 22);

    const listX = panelX + 10;
    const listY = panelY + 88;
    const listW = panelW - 20;
    const listH = panelH - 98;
    const rowH = 82;
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

      this._roundRect(ctx, listX, y, listW, 72, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 14px system-ui";
      ctx.fillText(`💃 ${item.name}`, listX + 12, y + 21);

      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, listX + 12, y + 44);

      ctx.fillStyle = "rgba(255,210,120,0.95)";
      ctx.fillText(`${item.price} yton`, listX + 12, y + 62);

      const bw = 96;
      const bh = 34;
      const bx = listX + listW - bw - 10;
      const by = y + 19;

      this._roundRect(ctx, bx, by, bw, bh, 12);
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 12px system-ui";
      ctx.fillText("Satın Al", bx + bw / 2, by + 21);

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
      const tw = Math.min(280, panelW - 40);
      const th = 36;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 48;

      this._roundRect(ctx, tx, ty, tw, th, 12);
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 12px system-ui";
      ctx.fillText(this.toast, tx + tw / 2, ty + 22);
    }
  }
}
