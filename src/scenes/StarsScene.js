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

function drawImageContainTop(ctx, img, x, y, w, h, topBias = 0.12) {
  const iw = img.width || 1;
  const ih = img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const extraH = dh - h;
  const dy = y - extraH * topBias;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawImageCoverRounded(ctx, img, x, y, w, h, radius) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function randomChance(prob) {
  return Math.random() < prob;
}

function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function addInventoryItem(state, item) {
  const items = ensureArray(state.inventory?.items).map((x) => ({ ...x }));
  const existing = items.find(
    (x) =>
      String(x.name || "").toLowerCase() === String(item.name || "").toLowerCase() &&
      String(x.kind || "") === String(item.kind || "")
  );

  if (existing) {
    existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
  } else {
    items.unshift({
      id: item.id || `${item.kind}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      kind: item.kind || "rare",
      icon: item.icon || "🎁",
      name: item.name || "Hediye",
      rarity: item.rarity || "common",
      qty: Number(item.qty || 1),
      usable: !!item.usable,
      sellable: item.sellable !== false,
      marketable: !!item.marketable,
      energyGain: Number(item.energyGain || 0),
      sellPrice: Number(item.sellPrice || 0),
      marketPrice: Number(item.marketPrice || 0),
      desc: item.desc || "",
    });
  }

  return {
    ...(state.inventory || {}),
    items,
  };
}

function getGiftReward() {
  const pool = [
    {
      kind: "girls",
      icon: "💋",
      name: "Club Girl",
      rarity: "rare",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: 16,
      sellPrice: 24,
      marketPrice: 36,
      desc: "Kulüpte tanıştığın özel hediye.",
    },
    {
      kind: "consumable",
      icon: "🥃",
      name: "Premium Whiskey",
      rarity: "common",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: 10,
      sellPrice: 14,
      marketPrice: 22,
      desc: "Hediye içki.",
    },
    {
      kind: "goods",
      icon: "🌿",
      name: "Special Bud",
      rarity: "rare",
      qty: 1,
      usable: false,
      sellable: true,
      marketable: true,
      energyGain: 0,
      sellPrice: 20,
      marketPrice: 30,
      desc: "Gece hediyesi.",
    },
    {
      kind: "rare",
      icon: "📦",
      name: "Mini Crate",
      rarity: "epic",
      qty: 1,
      usable: false,
      sellable: true,
      marketable: true,
      energyGain: 0,
      sellPrice: 32,
      marketPrice: 48,
      desc: "İçeriden gelen gizli kasa.",
    },
  ];

  return { ...pool[randInt(0, pool.length - 1)] };
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
    this._audio = null;
    this._audioStarted = false;
    this._starImageCache = new Map();

    this.toastText = "";
    this.toastUntil = 0;
    this.flashUntil = 0;
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

    this._bgImg = new Image();
    this._bgImg.src = "./src/assets/xxx-bg.png";

    this._primeStarImages();

    try {
      this._audio = new Audio("./src/assets/xxx.mp3");
      this._audio.loop = true;
      this._audio.volume = 0.35;
      this._audio.preload = "auto";
      this._audioStarted = false;
    } catch (_) {
      this._audio = null;
    }
  }

  onExit() {
    this.dragging = false;
    try {
      if (this._audio) {
        this._audio.pause();
        this._audio.currentTime = 0;
      }
    } catch (_) {}
  }

  _primeStarImages() {
    for (const star of stars) {
      this._getStarImage(star);
    }
  }

  _getStarImage(star) {
    const src = String(star?.assetPath || star?.image || "").trim();
    const fallback = String(star?.fallbackImage || stars[0]?.assetPath || "").trim();
    const key = `${src}|${fallback}`;

    if (this._starImageCache.has(key)) {
      return this._starImageCache.get(key);
    }

    const img = new Image();
    img.src = src || fallback;
    img.onerror = () => {
      if (img.src !== fallback && fallback) img.src = fallback;
    };

    this._starImageCache.set(key, img);
    return img;
  }

  _showToast(text, ms = 1800) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _startAudioIfNeeded() {
    if (this._audioStarted || !this._audio) return;
    this._audioStarted = true;
    this._audio.play().catch(() => {});
  }

  _buyService(star) {
    const s = this.store.get();
    const p = { ...(s.player || {}) };

    const cost = Math.max(1, Number(star.coinValue || 0));
    const gainBase = Math.max(1, Number(star.energyGain || 0));

    const coins = Number(s.coins || 0);
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    if (coins < cost) {
      this._showToast("Yetersiz coin");
      return;
    }

    if (energy >= energyMax) {
      this._showToast("Enerji zaten full");
      return;
    }

    let nextCoins = coins - cost;
    let nextEnergy = clamp(energy + gainBase, 0, energyMax);
    let inventory = s.inventory || { items: [] };

    const gotGift = randomChance(0.30);
    const gotBeat = randomChance(0.30);

    let giftText = "";
    let beatText = "";

    if (gotGift) {
      const gift = getGiftReward();
      inventory = addInventoryItem(s, gift);
      giftText = ` • Hediye: ${gift.name}`;
    }

    if (gotBeat) {
      const loseCoins = Math.min(nextCoins, randInt(2, Math.max(4, cost + 4)));
      const loseEnergy = Math.min(nextEnergy, randInt(1, Math.max(2, Math.ceil(gainBase * 0.7))));
      nextCoins = Math.max(0, nextCoins - loseCoins);
      nextEnergy = Math.max(0, nextEnergy - loseEnergy);
      beatText = ` • Dayak: -${loseCoins} coin -${loseEnergy} enerji`;
      this.flashUntil = Date.now() + 220;
    }

    p.energy = nextEnergy;

    this.store.set({
      coins: nextCoins,
      player: p,
      inventory,
    });

    this._showToast(`+${Math.max(0, nextEnergy - energy)} enerji${giftText}${beatText}`, 2400);
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input?.justPressed?.()) {
      this._startAudioIfNeeded();

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
          this._buyService(h.star);
          return;
        }
      }
    }
  }

  render(ctx, w, h) {
    const W = Number(w || ctx.canvas.width || 0);
    const H = Number(h || ctx.canvas.height || 0);

    const s = this.store.get();
    const p = s.player || {};
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w: W, h: H };
    const hudReservedTop = Number(s?.ui?.hudReservedTop || 110);
    const chatReservedBottom = Number(s?.ui?.chatReservedBottom || 82);

    this.hitButtons = [];
    this.hitBack = null;

    ctx.clearRect(0, 0, W, H);

    const bg = this._bgImg;
    if (bg && bg.complete) {
      drawImageContainTop(ctx, bg, 0, 0, W, H, 0.02);
    } else {
      ctx.fillStyle = "#090909";
      ctx.fillRect(0, 0, W, H);
    }

    const bgShade = ctx.createLinearGradient(0, 0, 0, H);
    bgShade.addColorStop(0, "rgba(0,0,0,0.16)");
    bgShade.addColorStop(0.45, "rgba(0,0,0,0.24)");
    bgShade.addColorStop(1, "rgba(0,0,0,0.40)");
    ctx.fillStyle = bgShade;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(
      W * 0.5,
      H * 0.42,
      40,
      W * 0.5,
      H * 0.42,
      Math.max(W, H) * 0.78
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,0.10)");
    vignette.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x + 10;
    const panelY = safe.y + hudReservedTop - 8;
    const panelW = safe.w - 20;
    const panelH = safe.h - hudReservedTop - chatReservedBottom + 6;

    ctx.fillStyle = "rgba(10,10,12,0.20)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 22);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 22);

    const headerH = safe.w <= 420 ? 58 : 66;
    const headerY = panelY + 10;
    const titleX = panelX + 16;
    const titleY = headerY + headerH / 2 + 1;
    const titleFamily = `"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`;

    ctx.fillStyle = "rgba(12,12,14,0.20)";
    fillRoundRect(ctx, panelX + 8, headerY, panelW - 16, headerH, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, panelX + 8, headerY, panelW - 16, headerH, 16);

    const titleSize = safe.w <= 420 ? 28 : 34;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${titleSize}px ${titleFamily}`;
    ctx.fillText("Genel Ev", titleX, titleY);

    const subText = `Coin: ${Number(s.coins || 0)}   •   Enerji: ${Number(p.energy || 0)}/${Number(p.energyMax || 100)}   •   ${stars.length} kişi`;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = `${safe.w <= 420 ? 10 : 11}px system-ui`;
    ctx.fillText(subText, titleX + 4, headerY + headerH - 10);

    const closeSize = safe.w <= 420 ? 40 : 44;
    const closeRect = {
      x: panelX + panelW - closeSize - 16,
      y: headerY + (headerH - closeSize) / 2,
      w: closeSize,
      h: closeSize,
    };
    this.hitBack = closeRect;

    ctx.fillStyle = "rgba(18,18,20,0.58)";
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
    const rowH = isSmall ? 90 : 98;
    const thumb = isSmall ? 58 : 66;
    const btnW = isSmall ? 96 : 112;
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

      ctx.fillStyle = "rgba(8,8,10,0.18)";
      fillRoundRect(ctx, rowRect.x, rowRect.y, rowRect.w, rowRect.h, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      strokeRoundRect(ctx, rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w - 1, rowRect.h - 1, 18);

      const sheen = ctx.createLinearGradient(rowRect.x, rowRect.y, rowRect.x, rowRect.y + rowRect.h);
      sheen.addColorStop(0, "rgba(255,255,255,0.06)");
      sheen.addColorStop(0.35, "rgba(255,255,255,0.02)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      fillRoundRect(ctx, rowRect.x + 1, rowRect.y + 1, rowRect.w - 2, rowRect.h * 0.5, 18);

      const imgX = rowRect.x + 12;
      const imgY = rowRect.y + (rowRect.h - thumb) / 2;
      const imgW = thumb;
      const imgH = thumb;
      const imgRadius = 14;

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      fillRoundRect(ctx, imgX, imgY, imgW, imgH, imgRadius);

      const starImg = this._getStarImage(star);
      const drew = drawImageCoverRounded(ctx, starImg, imgX, imgY, imgW, imgH, imgRadius);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, imgX + 0.5, imgY + 0.5, imgW - 1, imgH - 1, imgRadius);

      if (!drew) {
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${isSmall ? 11 : 12}px system-ui`;
        ctx.fillText(star.assetName || "IMG", imgX + imgW / 2, imgY + imgH / 2);
      }

      const btnX = rowRect.x + rowRect.w - btnW - 12;
      const btnY = rowRect.y + (rowRect.h - btnH) / 2;

      const textX = imgX + imgW + 12;
      const textW = Math.max(60, btnX - textX - 12);

      const nameSize = fitText(
        ctx,
        star.name,
        textW,
        isSmall ? 20 : 24,
        isSmall ? 14 : 16,
        titleFamily,
        700
      );

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 ${nameSize}px ${titleFamily}`;
      ctx.fillText(ellipsisText(ctx, star.name, textW), textX, rowRect.y + 31);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = `${isSmall ? 12 : 13}px system-ui`;
      ctx.fillText(`+Enerji: ${Number(star.energyGain || 0)}`, textX, rowRect.y + 52);

      ctx.fillStyle = "rgba(255,255,255,0.76)";
      ctx.font = `${isSmall ? 11 : 12}px system-ui`;
      ctx.fillText(`Fiyat: ${Number(star.coinValue || 0)} coin`, textX, rowRect.y + 69);
      ctx.fillText(`${star.assetName || "asset"}`, textX, rowRect.y + 84);

      ctx.fillStyle = "rgba(18,18,22,0.70)";
      fillRoundRect(ctx, btnX, btnY, btnW, btnH, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      strokeRoundRect(ctx, btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1, 14);

      const btnGloss = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      btnGloss.addColorStop(0, "rgba(255,255,255,0.10)");
      btnGloss.addColorStop(0.4, "rgba(255,255,255,0.03)");
      btnGloss.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = btnGloss;
      fillRoundRect(ctx, btnX + 1, btnY + 1, btnW - 2, btnH * 0.55, 13);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${isSmall ? 13 : 14}px system-ui`;
      ctx.fillText("SATIN AL", btnX + btnW / 2, btnY + btnH / 2 + 1);

      this.hitButtons.push({
        rect: { x: btnX, y: btnY, w: btnW, h: btnH },
        action: "buy",
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

      const thumbH = Math.max(42, (contentH / totalContentHeight) * trackH);
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;

      ctx.fillStyle = "rgba(255,255,255,0.34)";
      fillRoundRect(ctx, trackX, thumbY, trackW, thumbH, 4);
    }

    if (Date.now() < this.flashUntil) {
      ctx.fillStyle = "rgba(255,70,70,0.12)";
      ctx.fillRect(0, 0, W, H);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      ctx.font = "700 13px system-ui";
      const tw = Math.min(panelW - 28, Math.max(180, ctx.measureText(this.toastText).width + 34));
      const th = 40;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 14;

      ctx.fillStyle = "rgba(10,10,12,0.82)";
      fillRoundRect(ctx, tx, ty, tw, th, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      strokeRoundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, th - 1, 12);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2 + 1);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}
