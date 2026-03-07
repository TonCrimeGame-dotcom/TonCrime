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

export class HomeScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.assets = assets;
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.scenes = scenes;

    this.carousel = {
      index: 0,
      dragging: false,
      dragStartX: 0,
      dragNowX: 0,
      lastX: 0,
      moved: 0,
      clickCandidate: false,
    };

    this._cardRect = { x: 0, y: 0, w: 0, h: 0 };
  }

  onEnter() {
    const s = this.store.get();
    if (!s.player) {
      this.store.set({
        player: {
          username: "Player",
          level: 1,
          xp: 30,
          xpToNext: 100,
          weaponName: "Silah Yok",
          weaponBonus: "+0%",
          energy: 10,
          energyMax: 10,
          energyIntervalMs: 5 * 60 * 1000,
          lastEnergyAt: Date.now(),
        },
      });
      return;
    }

    const p = s.player;
    const patch = {};
    if (p.energy == null) patch.energy = 10;
    if (p.energyMax == null) patch.energyMax = 10;
    if (p.energyIntervalMs == null) patch.energyIntervalMs = 5 * 60 * 1000;
    if (p.lastEnergyAt == null) patch.lastEnergyAt = Date.now();
    if (Object.keys(patch).length) this.store.set({ player: { ...p, ...patch } });
  }

  _carouselItems() {
    return [
      { id: "missions", titleTR: "Görevler", titleEN: "Missions", sceneKey: "missions" },
      { id: "pvp", titleTR: "PvP", titleEN: "PvP", sceneKey: "pvp" },
      { id: "weapons", titleTR: "Silah Kaçakçısı", titleEN: "Arms Dealer", sceneKey: "weapons" },
      { id: "nightclub", titleTR: "Gece Kulübü", titleEN: "Nightclub", sceneKey: "nightclub" },
      { id: "coffeeshop", titleTR: "Coffeeshop", titleEN: "Coffeeshop", sceneKey: "coffeeshop" },
      { id: "blackmarket", titleTR: "Ticaret", titleEN: "Trade", sceneKey: "trade" },
      { id: "xxx", titleTR: "Genel Ev", titleEN: "Brothel", sceneKey: "xxx" },
    ];
  }

  update() {
    const c = this.carousel;
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    if (this.input.justPressed()) {
      c.dragging = true;
      c.dragStartX = px;
      c.dragNowX = px;
      c.lastX = px;
      c.moved = 0;
      c.clickCandidate = true;
    }

    if (c.dragging && this.input.isDown()) {
      c.dragNowX = px;
      const dx = c.dragNowX - c.lastX;
      c.lastX = c.dragNowX;
      c.moved += Math.abs(dx);
      if (c.moved > 10) c.clickCandidate = false;
    }

    if (c.dragging && this.input.justReleased()) {
      c.dragging = false;

      const items = this._carouselItems();
      const dragDX = c.dragNowX - c.dragStartX;

      const threshold = 45;
      if (dragDX > threshold) c.index = Math.max(0, c.index - 1);
      else if (dragDX < -threshold) c.index = Math.min(items.length - 1, c.index + 1);

      if (c.clickCandidate && pointInRect(px, py, this._cardRect)) {
        const item = items[c.index];

        if (item.sceneKey === "pvp" || item.id === "pvp") {
          try {
            window.dispatchEvent(new Event("tc:openPvp"));
          } catch {}
          return;
        }

        if (item.sceneKey === "weapons" || item.id === "weapons") {
          try {
            this.scenes.go("weapons");
          } catch (_) {
            const s = this.store.get();
            this.store.set({ coins: (s.coins ?? 0) + 1 });
          }
          return;
        }

        if (item.sceneKey === "trade" || item.id === "blackmarket") {
          try {
            this.scenes.go("trade");
          } catch (_) {
            console.error("Trade scene açılamadı");
          }
          return;
        }

        try {
          this.scenes.go(item.sceneKey);
        } catch (_) {
          const s = this.store.get();
          this.store.set({ coins: (s.coins ?? 0) + 1 });
        }
      }
    }
  }

  render(ctx, w, h) {
    const state = this.store.get();
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };

    const bg = this.assets.getImage("background");
    if (bg) ctx.drawImage(bg, 0, 0, w, h);
    else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);

    const HUD_TOP_RESERVED = 96;
    const CHAT_BOTTOM_RESERVED = 74;

    const carouselTop = safe.y + HUD_TOP_RESERVED;
    const carouselBottom = safe.y + safe.h - CHAT_BOTTOM_RESERVED;

    const areaH = Math.max(160, carouselBottom - carouselTop);
    const cx = safe.x + safe.w / 2;
    const cy = carouselTop + areaH / 2;

    const items = this._carouselItems();
    const idx = this.carousel.index;

    const cardW = Math.min(safe.w * 0.82, 390);
    const cardH = Math.min(areaH * 0.78, 290);

    const spacing = cardW + 28;
    const dragDX = this.carousel.dragging
      ? this.carousel.dragNowX - this.carousel.dragStartX
      : 0;

    const drawCard = (itemIndex) => {
      if (itemIndex < 0 || itemIndex >= items.length) return;

      const item = items[itemIndex];
      const offset = (itemIndex - idx) * spacing + dragDX;

      const dist = Math.abs(itemIndex - idx);
      const scale = dist === 0 ? 1 : 0.92;

      const w2 = cardW * scale;
      const h2 = cardH * scale;
      const x2 = cx - w2 / 2 + offset;
      const y2 = cy - h2 / 2;

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      fillRoundRect(ctx, x2, y2, w2, h2, 18);

      ctx.save();
      roundRectPath(ctx, x2, y2, w2, h2, 18);
      ctx.clip();

      const img = this.assets.getImage(item.id);
      if (img) {
        const s = Math.min(w2 / img.width, h2 / img.height);
        const dw = img.width * s;
        const dh = img.height * s;
        const dx = x2 + (w2 - dw) / 2;
        const dy = y2 + (h2 - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(x2, y2, w2, h2);
      }

      ctx.restore();

      ctx.strokeStyle =
        dist === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
      strokeRoundRect(ctx, x2 + 0.5, y2 + 0.5, w2 - 1, h2 - 1, 18);

      const title = (state.lang ?? "tr") === "tr" ? item.titleTR : item.titleEN;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = dist === 0 ? "18px system-ui" : "16px system-ui";
      ctx.fillText(title, x2 + w2 / 2, y2 + h2 - 22);

      if (itemIndex === idx) {
        this._cardRect = { x: x2, y: y2, w: w2, h: h2 };
      }
    };

    drawCard(idx - 1);
    drawCard(idx);
    drawCard(idx + 1);

    const dotsY = Math.min(carouselBottom - 10, cy + cardH / 2 + 18);
    const dotGap = 10;
    const total = (items.length - 1) * dotGap;
    const startX = cx - total / 2;

    for (let i = 0; i < items.length; i++) {
      ctx.beginPath();
      const dx = startX + i * dotGap;
      ctx.arc(dx, dotsY, 3, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle =
        i === idx ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)";
      ctx.fill();
    }
  }
}
