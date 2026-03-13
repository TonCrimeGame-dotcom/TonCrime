import { stars } from "../assets/starsData.js";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
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

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

function fitText(ctx, text, maxWidth, startSize, minSize, family, weight = 700) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

function ellipsisText(ctx, text, maxWidth) {
  let out = String(text || "");
  if (ctx.measureText(out).width <= maxWidth) return out;
  while (out.length > 0 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

export class StarsScene {
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
    this.startScrollY = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hitButtons = [];
    this.hitBack = null;

    this._bgImg = null;
    this._fallbackBg = null;
  }

  onEnter() {
    const s = this.store.get();

    if (!s.stars) {
      this.store.set({
        stars: {
          owned: {},
          selectedId: null,
          lastClaimTs: {},
          twinBonusClaimed: {},
        },
      });
    }

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;

    this._bgImg =
      getImgSafe(this.assets, "xxx_bg") ||
      getImgSafe(this.assets, "xxx-bg") ||
      getImgSafe(this.assets, "xxx") ||
      null;

    if (!this._bgImg) {
      this._fallbackBg = new Image();
      this._fallbackBg.src = "./src/assets/xxx-bg.png";
      this._bgImg = this._fallbackBg;
    }
  }

  onExit() {
    this.dragging = false;
  }

  buyStar(star) {
    const s = this.store.get();
    const starsState =
      s.stars || { owned: {}, selectedId: null, lastClaimTs: {}, twinBonusClaimed: {} };

    const owned = starsState.owned || {};
    if (owned[star.id]) return true;

    const coins = Number(s.coins || 0);
    const cost = Number(star.coinValue || 0);

    if (coins < cost) {
      try {
        window.dispatchEvent(
          new CustomEvent("tc:toast", { detail: { text: "Yetersiz coin" } })
        );
      } catch (_) {}
      return false;
    }

    this.store.set({
      coins: coins - cost,
      stars: {
        ...starsState,
        owned: {
          ...owned,
          [star.id]: true,
        },
        selectedId: star.id,
      },
    });

    return true;
  }

  selectStar(starId) {
    const s = this.store.get();
    const starsState =
      s.stars || { owned: {}, selectedId: null, lastClaimTs: {}, twinBonusClaimed: {} };

    this.store.set({
      stars: {
        ...starsState,
        selectedId: starId,
      },
    });
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input?.isDown?.()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input?.justReleased?.()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      if (this.hitBack && pointInRect(px, py, this.hitBack)) {
        this.scenes.go("home");
        return;
      }

      for (const h of this.hitButtons) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.action === "buy") {
          this.buyStar(h.star);
          return;
        }

        if (h.action === "select") {
          this.selectStar(h.star.id);
          return;
        }
      }
    }
  }

  render(ctx, w, h) {
    const W = Number(w || ctx.canvas.width || 0);
    const H = Number(h || ctx.canvas.height || 0);

    const s = this.store.get();
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w: W, h: H };
    const hudReservedTop = Number(s?.ui?.hudReservedTop || 110);
    const chatReservedBottom = Number(s?.ui?.chatReservedBottom || 82);

    const owned = s.stars?.owned || {};
    const selectedId = s.stars?.selectedId ?? null;

    this.hitButtons = [];
    this.hitBack = null;

    ctx.clearRect(0, 0, W, H);

    const bg = this._bgImg;
    if (bg && bg.complete) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x + 10;
    const panelY = safe.y + hudReservedTop - 8;
    const panelW = safe.w - 20;
    const panelH = safe.h - hudReservedTop - chatReservedBottom + 6;

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 20);

    const headerH = 64;
    const headerY = panelY + 8;
    const titleX = panelX + 16;
    const titleY = headerY + 36;

    const titleFamily = `"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`;

    ctx.fillStyle = "rgba(0,0,0,0.34)";
    fillRoundRect(ctx, panelX + 8, headerY, panelW - 16, headerH, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, panelX + 8, headerY, panelW - 16, headerH, 16);

    const titleSize = safe.w <= 420 ? 27 : 34;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${titleSize}px ${titleFamily}`;
    ctx.fillText("Genel Ev", titleX, titleY);

    const closeSize = safe.w <= 420 ? 40 : 44;
    const closeRect = {
      x: panelX + panelW - closeSize - 16,
      y: headerY + (headerH - closeSize) / 2,
      w: closeSize,
      h: closeSize,
    };
    this.hitBack = closeRect;

    ctx.fillStyle = "rgba(20,20,20,0.62)";
    fillRoundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    strokeRoundRect(ctx, closeRect.x + 0.5, closeRect.y + 0.5, closeRect.w - 1, closeRect.h - 1, 14);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${safe.w <= 420 ? 22 : 24}px system-ui`;
    ctx.fillText("×", closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2 + 1);

    const contentTop = headerY + headerH + 10;
    const contentBottom = panelY + panelH - 10;
    const contentH = Math.max(120, contentBottom - contentTop);

    const rowGap = 10;
    const listX = panelX + 10;
    const listW = panelW - 20;

    const isSmall = safe.w <= 420;
    const rowH = isSmall ? 82 : 88;
    const thumb = isSmall ? 48 : 58;
    const btnW = isSmall ? 82 : 94;
    const btnH = isSmall ? 38 : 42;

    const totalContentHeight = stars.length * (rowH + rowGap);
    this.maxScroll = Math.max(0, totalContentHeight - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    let y = contentTop - this.scrollY;

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const rowRect = { x: listX, y, w: listW, h: rowH };

      if (rowRect.y > contentBottom + 20 || rowRect.y + rowRect.h < contentTop - 20) {
        y += rowH + rowGap;
        continue;
      }

      const isOwned = !!owned[star.id];
      const isSelected = selectedId === star.id;

      ctx.fillStyle = isSelected
        ? "rgba(255,255,255,0.12)"
        : "rgba(0,0,0,0.34)";
      fillRoundRect(ctx, rowRect.x, rowRect.y, rowRect.w, rowRect.h, 18);

      ctx.strokeStyle = isSelected
        ? "rgba(255,255,255,0.22)"
        : "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      strokeRoundRect(ctx, rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w - 1, rowRect.h - 1, 18);

      const imgX = rowRect.x + 12;
      const imgY = rowRect.y + (rowRect.h - thumb) / 2;
      const imgW = thumb;
      const imgH = thumb;

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, imgX, imgY, imgW, imgH, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      strokeRoundRect(ctx, imgX + 0.5, imgY + 0.5, imgW - 1, imgH - 1, 14);

      const cardImg =
        getImgSafe(this.assets, star.image) ||
        getImgSafe(this.assets, star.id) ||
        null;

      if (cardImg && cardImg.complete) {
        ctx.save();
        roundRectPath(ctx, imgX, imgY, imgW, imgH, 14);
        ctx.clip();
        ctx.drawImage(cardImg, imgX, imgY, imgW, imgH);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, imgX + 4, imgY + 4, imgW - 8, imgH - 8, 10);
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${isSmall ? 14 : 16}px ${titleFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Twin", imgX + imgW / 2, imgY + imgH / 2 + 1);
      }

      const btnX = rowRect.x + rowRect.w - btnW - 12;
      const btnY = rowRect.y + (rowRect.h - btnH) / 2;

      const textX = imgX + imgW + 12;
      const textW = Math.max(60, btnX - textX - 12);

      const nameSize = fitText(
        ctx,
        star.name,
        textW,
        isSmall ? 21 : 25,
        isSmall ? 15 : 16,
        titleFamily,
        700
      );
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 ${nameSize}px ${titleFamily}`;
      ctx.fillText(ellipsisText(ctx, star.name, textW), textX, rowRect.y + 34);

      ctx.fillStyle = "rgba(255,255,255,0.84)";
      ctx.font = `${isSmall ? 12 : 13}px system-ui`;
      ctx.fillText(`+Enerji: ${Number(star.energyGain || 0)}`, textX, rowRect.y + 56);

      ctx.fillStyle = "rgba(255,255,255,0.66)";
      ctx.font = `${isSmall ? 11 : 12}px system-ui`;
      ctx.fillText(
        isOwned ? "Sahip olundu" : `Fiyat: ${Number(star.coinValue || 0)} coin`,
        textX,
        rowRect.y + 73
      );

      ctx.fillStyle = "rgba(22,22,22,0.72)";
      fillRoundRect(ctx, btnX, btnY, btnW, btnH, 14);
      ctx.strokeStyle = isSelected
        ? "rgba(255,255,255,0.28)"
        : "rgba(255,255,255,0.16)";
      strokeRoundRect(ctx, btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1, 14);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${isSmall ? 13 : 14}px system-ui`;
      ctx.fillText(
        isOwned ? (isSelected ? "SEÇİLİ" : "SEÇ") : "SATIN AL",
        btnX + btnW / 2,
        btnY + btnH / 2 + 1
      );

      this.hitButtons.push({
        rect: { x: btnX, y: btnY, w: btnW, h: btnH },
        action: isOwned ? "select" : "buy",
        star,
      });

      y += rowH + rowGap;
    }

    if (this.maxScroll > 0) {
      const trackW = 4;
      const trackH = contentH - 10;
      const trackX = panelX + panelW - 8;
      const trackY = contentTop + 5;

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      fillRoundRect(ctx, trackX, trackY, trackW, trackH, 4);

      const thumbH = Math.max(40, (contentH / totalContentHeight) * trackH);
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;

      ctx.fillStyle = "rgba(255,255,255,0.34)";
      fillRoundRect(ctx, trackX, thumbY, trackW, thumbH, 4);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}
