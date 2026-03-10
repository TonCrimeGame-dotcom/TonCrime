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

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
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

    const p = s.player || {};
    const patch = {};
    if (p.energy == null) patch.energy = 10;
    if (p.energyMax == null) patch.energyMax = 10;
    if (p.energyIntervalMs == null) patch.energyIntervalMs = 5 * 60 * 1000;
    if (p.lastEnergyAt == null) patch.lastEnergyAt = Date.now();

    if (Object.keys(patch).length) {
      this.store.set({ player: { ...p, ...patch } });
    }
  }

  _carouselItems() {
    return [
      { id: "missions", titleTR: "Görevler", titleEN: "Missions", sceneKey: "missions" },
      { id: "pvp", titleTR: "PvP", titleEN: "PvP", sceneKey: "pvp" },
      { id: "clan", titleTR: "Clan", titleEN: "Clan", sceneKey: "clanhub" },
      { id: "weapons", titleTR: "Silah Kaçakçısı", titleEN: "Arms Dealer", sceneKey: "weapons" },
      { id: "blackmarket", titleTR: "Black Market", titleEN: "Black Market", sceneKey: "trade" },
      { id: "nightclub", titleTR: "Gece Kulübü", titleEN: "Nightclub", sceneKey: "nightclub" },
      { id: "coffeeshop", titleTR: "Coffeeshop", titleEN: "Coffeeshop", sceneKey: "coffeeshop" },
      { id: "xxx", titleTR: "Genel Ev", titleEN: "Brothel", sceneKey: "xxx" },
    ];
  }
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
      const threshold = 48;

      if (dragDX > threshold) {
        c.index = Math.max(0, c.index - 1);
      } else if (dragDX < -threshold) {
        c.index = Math.min(items.length - 1, c.index + 1);
      }

      if (c.clickCandidate && pointInRect(px, py, this._cardRect)) {
        const item = items[c.index];

        if (item.sceneKey === "pvp" || item.id === "pvp") {
          try {
            window.dispatchEvent(new Event("tc:openPvp"));
          } catch (_) {}
          return;
        }

        try {
          this.scenes.go(item.sceneKey);
        } catch (_) {}
      }
    }
  }

  render(ctx, w, h) {
    const state = this.store.get();
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };

    const topReserved = Number(state?.ui?.hudReservedTop || 118);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    const bg = getImgSafe(this.assets, "background");
    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(0, 0, w, h);

    const carouselTop = safe.y + topReserved;
    const carouselBottom = safe.y + safe.h - bottomReserved;
    const areaH = Math.max(180, carouselBottom - carouselTop);

    const cx = safe.x + safe.w / 2;
    const cy = carouselTop + areaH / 2;

    const items = this._carouselItems();
    const idx = Math.max(0, Math.min(this.carousel.index, items.length - 1));
    this.carousel.index = idx;

    const cardW = Math.min(safe.w * 0.58, 410);
    const cardH = Math.min(areaH * 0.72, 320);
    const sideScale = 0.72;
    const sideW = cardW * sideScale;
    const maxSpacingByScreen = Math.max(cardW * 0.56, safe.w / 2 - sideW / 2 - 8);
    const spacing = Math.min(cardW * 0.88, maxSpacingByScreen);

    const dragDX = this.carousel.dragging
      ? this.carousel.dragNowX - this.carousel.dragStartX
      : 0;

    const getCardImage = (item) => {
      return (
        getImgSafe(this.assets, item.id) ||
        getImgSafe(this.assets, item.sceneKey) ||
        getImgSafe(this.assets, `${item.id}_bg`) ||
        getImgSafe(this.assets, "background")
      );
    };

    const drawCard = (itemIndex) => {
      if (itemIndex < 0 || itemIndex >= items.length) return;

      const item = items[itemIndex];
      const rel = itemIndex - idx;
      const offset = rel * spacing + dragDX;
      const dist = Math.abs(rel);
      const scale = dist === 0 ? 1 : sideScale;

      const w2 = cardW * scale;
      const h2 = cardH * scale;
      let x2 = cx - w2 / 2 + offset;
      const y2 = cy - h2 / 2;

      const minX = safe.x + 4;
      const maxX = safe.x + safe.w - w2 - 4;
      x2 = Math.max(minX, Math.min(maxX, x2));

      ctx.save();
      ctx.globalAlpha = dist === 0 ? 1 : 0.9;

      ctx.fillStyle = "rgba(0,0,0,0.56)";
      fillRoundRect(ctx, x2, y2, w2, h2, 18);

      ctx.save();
      roundRectPath(ctx, x2, y2, w2, h2, 18);
      ctx.clip();

      const img = getCardImage(item);
      if (img) {
        const iw = img.width || 1;
        const ih = img.height || 1;

        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x2, y2, w2, h2);

        const fitPad = dist === 0 ? 10 : 12;
        const fitScale = Math.min((w2 - fitPad * 2) / iw, (h2 - fitPad * 2) / ih);
        const fitW = iw * fitScale;
        const fitH = ih * fitScale;
        const fitX = x2 + (w2 - fitW) / 2;
        const fitY = y2 + (h2 - fitH) / 2;

        ctx.drawImage(img, fitX, fitY, fitW, fitH);

        ctx.fillStyle = dist === 0 ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.18)";
        ctx.fillRect(x2, y2, w2, h2);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(x2, y2, w2, h2);
      }

      const grad = ctx.createLinearGradient(0, y2 + h2 * 0.42, 0, y2 + h2);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = grad;
      ctx.fillRect(x2, y2, w2, h2);

      ctx.restore();

      ctx.strokeStyle =
        dist === 0 ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.14)";
      strokeRoundRect(ctx, x2 + 0.5, y2 + 0.5, w2 - 1, h2 - 1, 18);

      const title = (state.lang ?? "tr") === "tr" ? item.titleTR : item.titleEN;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = dist === 0 ? "700 18px system-ui" : "700 15px system-ui";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 12;
      ctx.fillText(title, x2 + w2 / 2, y2 + h2 - 28);
      ctx.shadowBlur = 0;

      ctx.restore();

      if (itemIndex === idx) {
        this._cardRect = { x: x2, y: y2, w: w2, h: h2 };
      }
    };

    const visibleCards = [idx - 1, idx, idx + 1]
      .filter((i) => i >= 0 && i < items.length)
      .sort((a, b) => {
        const aDepth = Math.abs((a - idx) * spacing + dragDX);
        const bDepth = Math.abs((b - idx) * spacing + dragDX);
        return bDepth - aDepth;
      });

    visibleCards.forEach(drawCard);

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
        i === idx ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.28)";
      ctx.fill();
    }
  }
}
