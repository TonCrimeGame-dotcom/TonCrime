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
  while (out.length > 0 && ctx.measureText(out + "â€¦").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "â€¦";
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

function drawImageContainRounded(ctx, img, x, y, w, h, radius, topBias = 0.1) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2 - Math.max(0, h - dh) * topBias;

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

function fmtDiseaseCountdown(ms, lang = "tr") {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (lang === "en") {
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  if (hours > 0) return `${hours} sa ${minutes} dk`;
  if (minutes > 0) return `${minutes} dk ${seconds} sn`;
  return `${seconds} sn`;
}

const STARS_GIFT_CHANCE = 0.15;
const STARS_DISEASE_CHANCE = 0.20;
const STARS_DISEASE_WAIT_MS = 2 * 60 * 60 * 1000;
const STARS_DISEASE_HEAL_COST = 20;

function addInventoryItem(state, item) {
  const items = ensureArray(state.inventory?.items).map((x) => ({ ...x }));
  const existing = items.find(
    (x) =>
      String(x.name || "").toLowerCase() === String(item.name || "").toLowerCase() &&
      String(x.kind || "") === String(item.kind || "")
  );

  if (existing) {
    existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
    if (!existing.imageSrc && item.imageSrc) existing.imageSrc = item.imageSrc;
    if (!existing.imageKey && item.imageKey) existing.imageKey = item.imageKey;
  } else {
    items.unshift({
      id: item.id || `${item.kind}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      kind: item.kind || "rare",
      icon: item.icon || "GIFT",
      name: item.name || "Hediye",
      rarity: item.rarity || "common",
      qty: Number(item.qty || 1),
      usable: !!item.usable,
      sellable: item.sellable !== false,
      marketable: !!item.marketable,
      energyGain: Number(item.energyGain || 0),
      sellPrice: Number(item.sellPrice || 0),
      marketPrice: Number(item.marketPrice || 0),
      imageKey: item.imageKey || "",
      imageSrc: item.imageSrc || item.image || "",
      desc: item.desc || "",
    });
  }

  return {
    ...(state.inventory || {}),
    items,
  };
}

function getGiftReward(star, lang = "tr") {
  const sourceName = String(star?.name || (lang === "en" ? "star girl" : "yildiz kiz"));
  const pool = [
    {
      kind: "girls",
      icon: "gift",
      name: lang === "en" ? "Backstage Pass" : "Sahne Arkasi Gecis",
      rarity: "rare",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: 14,
      sellPrice: 24,
      marketPrice: 36,
      imageSrc: "./src/assets/bonus.png",
      desc: lang === "en" ? `${sourceName} slipped you a backstage pass.` : `${sourceName} sana sahne arkasi gecis verdi.`,
    },
    {
      kind: "consumable",
      icon: "gift",
      name: lang === "en" ? "Velvet Perfume" : "Kadife Parfum",
      rarity: "common",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: 8,
      sellPrice: 14,
      marketPrice: 22,
      imageSrc: "./src/assets/club.png",
      desc: lang === "en" ? `${sourceName} left this behind.` : `${sourceName} bunu geride birakti.`,
    },
    {
      kind: "goods",
      icon: "gift",
      name: lang === "en" ? "Signed Stockings" : "Imzali Corap",
      rarity: "rare",
      qty: 1,
      usable: false,
      sellable: true,
      marketable: true,
      energyGain: 0,
      sellPrice: 20,
      marketPrice: 30,
      imageSrc: "./src/assets/g_star1.png",
      desc: lang === "en" ? `${sourceName} gave you a private souvenir.` : `${sourceName} sana ozel bir hatira verdi.`,
    },
    {
      kind: "rare",
      icon: "gift",
      name: lang === "en" ? "VIP Room Key" : "VIP Oda Anahtari",
      rarity: "epic",
      qty: 1,
      usable: false,
      sellable: true,
      marketable: true,
      energyGain: 0,
      sellPrice: 32,
      marketPrice: 48,
      imageSrc: "./src/assets/bonus.png",
      desc: lang === "en" ? `${sourceName} trusted you with a VIP key.` : `${sourceName} sana VIP oda anahtari verdi.`,
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
    this.hitDiseaseWait = null;
    this.hitDiseasePay = null;

    this._bgImg = null;
    this._audio = null;
    this._audioStarted = false;
    this._starImageCache = new Map();

    this.toastText = "";
    this.toastUntil = 0;
    this.flashUntil = 0;
    this._diseasePrompt = null;
    this._diseaseRecoveredToastAt = 0;
  }

  _lang() {
    return this.i18n?.getLang?.() === "en" ? "en" : "tr";
  }

  _ui(tr, en) {
    return this._lang() === "en" ? en : tr;
  }

  _ensureStarsState() {
    const s = this.store.get() || {};
    const starsState = s.stars || {};
    const nextStars = {
      ...starsState,
      owned: starsState.owned || {},
      selectedId: starsState.selectedId ?? null,
      lastClaimTs: starsState.lastClaimTs || {},
      twinBonusClaimed: starsState.twinBonusClaimed || {},
      diseaseUntil: Number(starsState.diseaseUntil || 0),
      lastDiseaseAt: Number(starsState.lastDiseaseAt || 0),
    };
    this.store.set({ stars: nextStars });
    return nextStars;
  }

  _getDiseaseUntil() {
    return Number(this.store.get()?.stars?.diseaseUntil || 0);
  }

  _isDiseaseLocked(now = Date.now()) {
    return this._getDiseaseUntil() > now;
  }

  _clearDiseaseLock(showToast = true) {
    const s = this.store.get() || {};
    const starsState = s.stars || {};
    if (Number(starsState.diseaseUntil || 0) <= 0) return;
    this.store.set({
      stars: {
        ...starsState,
        diseaseUntil: 0,
      },
    });
    if (showToast) {
      this._showToast(this._ui("Hastalik gecti", "Disease cleared"), 1800);
    }
  }

  _openDiseasePrompt(star) {
    this._diseasePrompt = {
      starId: Number(star?.id || 0),
      starName: String(star?.name || ""),
    };
  }

  _chooseDiseaseWait() {
    const s = this.store.get() || {};
    const starsState = this._ensureStarsState();
    this.store.set({
      stars: {
        ...starsState,
        diseaseUntil: Date.now() + STARS_DISEASE_WAIT_MS,
        lastDiseaseAt: Date.now(),
      },
    });
    this._diseasePrompt = null;
    this._showToast(this._ui("Hastasin. Bekleme basladi.", "You are sick. Wait started."), 2000);
  }

  _chooseDiseaseHealNow() {
    const s = this.store.get() || {};
    const coins = Number(s.coins || 0);
    if (coins < STARS_DISEASE_HEAL_COST) {
      this._showToast(this._ui("Yetersiz yton", "Not enough yton"));
      return;
    }

    const starsState = this._ensureStarsState();
    this.store.set({
      coins: coins - STARS_DISEASE_HEAL_COST,
      stars: {
        ...starsState,
        diseaseUntil: 0,
        lastDiseaseAt: Date.now(),
      },
    });
    this._diseasePrompt = null;
    this._showToast(this._ui("Aninda iyilestin", "You healed instantly"), 1800);
  }

  onEnter() {
    this._ensureStarsState();

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this._diseasePrompt = null;
    this.hitDiseaseWait = null;
    this.hitDiseasePay = null;

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
      this._showToast(this._ui("Yetersiz yton", "Not enough yton"));
      return;
    }

    if (energy >= energyMax) {
      this._showToast(this._ui("Enerji zaten full", "Energy already full"));
      return;
    }

    let nextCoins = coins - cost;
    let nextEnergy = clamp(energy + gainBase, 0, energyMax);
    let inventory = s.inventory || { items: [] };

    const gotGift = randomChance(STARS_GIFT_CHANCE);
    const gotDisease = randomChance(STARS_DISEASE_CHANCE);

    let giftText = "";

    if (gotGift) {
      const gift = getGiftReward(star, this._lang());
      inventory = addInventoryItem(
        {
          ...(s || {}),
          inventory: inventory || s.inventory || { items: [] },
        },
        gift
      );
      giftText = this._ui(` • Hediye: ${gift.name}`, ` • Gift: ${gift.name}`);
    }

    p.energy = nextEnergy;

    this.store.set({
      coins: nextCoins,
      player: p,
      inventory,
    });

    this._showToast(
      this._ui(
        `+${Math.max(0, nextEnergy - energy)} enerji${giftText}`,
        `+${Math.max(0, nextEnergy - energy)} energy${giftText}`
      ),
      2400
    );

    if (gotDisease) {
      this._openDiseasePrompt(star);
      this.flashUntil = Date.now() + 260;
    }
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;
    const now = Date.now();
    const diseaseUntil = this._getDiseaseUntil();

    if (diseaseUntil > 0 && diseaseUntil <= now) {
      if (this._diseaseRecoveredToastAt !== diseaseUntil) {
        this._clearDiseaseLock(true);
        this._diseaseRecoveredToastAt = diseaseUntil;
      }
    }

    if (this._isDiseaseLocked(now)) {
      if (this.input?.justPressed?.()) this._startAudioIfNeeded();
      this.dragging = false;
      this.clickCandidate = false;
      return;
    }

    if (this._diseasePrompt) {
      if (this.input?.justPressed?.()) this._startAudioIfNeeded();
      if (this.input?.justReleased?.()) {
        if (this.hitDiseaseWait && pointInRect(px, py, this.hitDiseaseWait)) {
          this._chooseDiseaseWait();
          return;
        }
        if (this.hitDiseasePay && pointInRect(px, py, this.hitDiseasePay)) {
          this._chooseDiseaseHealNow();
          return;
        }
      }
      return;
    }

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
    this.hitDiseaseWait = null;
    this.hitDiseasePay = null;

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

    const panelX = safe.x + 14;
    const panelY = safe.y + hudReservedTop;
    const panelW = safe.w - 28;
    const panelH = safe.h - hudReservedTop - chatReservedBottom - 10;

    ctx.fillStyle = "rgba(10,8,14,0.62)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 18);

    const titleX = panelX + 16;
    const titleY = panelY + 30;

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 18px system-ui";
    ctx.fillText(this._ui("Genel Ev", "Stars House"), titleX, titleY);

    ctx.fillStyle = "rgba(255,214,160,0.78)";
    ctx.font = "600 12px system-ui";
    ctx.fillText(
      this._ui("Sansini zorla, odul kap, riski gorme.", "Push your luck, grab rewards, dodge the risk."),
      titleX,
      panelY + 48
    );

    const closeRect = {
      x: panelX + panelW - 48,
      y: panelY + 14,
      w: 32,
      h: 32,
    };
    this.hitBack = closeRect;

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    fillRoundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    strokeRoundRect(ctx, closeRect.x + 0.5, closeRect.y + 0.5, closeRect.w - 1, closeRect.h - 1, 10);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 18px system-ui";
    ctx.fillText("X", closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2 + 1);

    const rowGap = 10;
    const listX = panelX + 10;
    const listY = panelY + 66;
    const listW = panelW - 20;
    const listH = panelH - 78;
    const isSmall = safe.w <= 420;
    const contentTop = listY;
    const contentBottom = listY + listH;
    const contentH = listH;

    const rowH = 84;
    const thumbW = 54;
    const thumbH = 60;
    const btnW = 96;
    const btnH = 40;

    const totalContentHeight = stars.length * (rowH + rowGap);
    this.maxScroll = Math.max(0, totalContentHeight - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    roundRectPath(ctx, listX, listY, listW, listH, 16);
    ctx.clip();

    const rowsBg = ctx.createLinearGradient(0, listY, 0, listY + listH);
    rowsBg.addColorStop(0, "rgba(0,0,0,0.14)");
    rowsBg.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = rowsBg;
    ctx.fillRect(listX, listY, listW, listH);

    let y = contentTop - this.scrollY;

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const rowRect = { x: listX, y, w: listW, h: rowH };

      if (rowRect.y > contentBottom + 20 || rowRect.y + rowRect.h < contentTop - 20) {
        y += rowH + rowGap;
        continue;
      }

      ctx.fillStyle = "rgba(0,0,0,0.32)";
      fillRoundRect(ctx, rowRect.x, rowRect.y, rowRect.w, rowRect.h, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      strokeRoundRect(ctx, rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w - 1, rowRect.h - 1, 18);

      const imgX = rowRect.x + 12;
      const imgY = rowRect.y + (rowRect.h - thumbH) / 2;
      const imgW = thumbW;
      const imgH = thumbH;
      const imgRadius = 16;

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      fillRoundRect(ctx, imgX, imgY, imgW, imgH, imgRadius);

      const starImg = this._getStarImage(star);
      const drew = drawImageContainRounded(ctx, starImg, imgX, imgY, imgW, imgH, imgRadius, 0.14);
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

      const nameSize = fitText(ctx, star.name, textW, 17, 13, "system-ui", 900);

      const line1Y = rowRect.y + 22;
      const line2Y = rowRect.y + 40;
      const line3Y = rowRect.y + 58;
      const line4Y = rowRect.y + 74;

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = `900 ${nameSize}px system-ui`;
      ctx.fillText(ellipsisText(ctx, star.name, textW), textX, line1Y);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "12px system-ui";
      ctx.fillText(this._ui(`+Enerji: ${Number(star.energyGain || 0)}`, `+Energy: ${Number(star.energyGain || 0)}`), textX, line2Y);

      ctx.fillStyle = "rgba(255,255,255,0.76)";
      ctx.font = "12px system-ui";
      ctx.fillText(this._ui(`Fiyat: ${Number(star.coinValue || 0)} yton`, `Price: ${Number(star.coinValue || 0)} yton`), textX, line3Y);
      ctx.fillText(`${this._ui("Rarity", "Rarity")}: ${String(star.rarity || "common").toUpperCase()}`, textX, line4Y);

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
      ctx.fillText(this._ui("SATIN AL", "BUY"), btnX + btnW / 2, btnY + btnH / 2 + 1);

      this.hitButtons.push({
        rect: { x: btnX, y: btnY, w: btnW, h: btnH },
        action: "buy",
        star,
      });

      y += rowH + rowGap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackW = 4;
      const trackH = listH - 20;
      const trackX = listX + listW - 5;
      const trackY = listY + 10;

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

    const now = Date.now();
    const diseaseUntil = this._getDiseaseUntil();
    const isDiseaseLocked = diseaseUntil > now;

    if (this._diseasePrompt || isDiseaseLocked) {
      ctx.fillStyle = "rgba(0,0,0,0.64)";
      ctx.fillRect(0, 0, W, H);

      const modalW = Math.min(panelW - 24, 320);
      const modalH = isDiseaseLocked ? 180 : 220;
      const modalX = panelX + (panelW - modalW) / 2;
      const modalY = panelY + (panelH - modalH) / 2;

      ctx.fillStyle = "rgba(14,14,18,0.96)";
      fillRoundRect(ctx, modalX, modalY, modalW, modalH, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      strokeRoundRect(ctx, modalX + 0.5, modalY + 0.5, modalW - 1, modalH - 1, 18);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 20px system-ui";
      ctx.fillText(
        this._ui("Hastalik kaptin aptal", "You caught a disease, idiot"),
        modalX + modalW / 2,
        modalY + 42
      );

      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "13px system-ui";

      if (isDiseaseLocked) {
        const remainText = fmtDiseaseCountdown(diseaseUntil - now, this._lang());
        ctx.fillText(
          this._ui("Oyun kilitli. Bekleme suruyor.", "Game locked. Waiting in progress."),
          modalX + modalW / 2,
          modalY + 82
        );
        ctx.font = "900 26px system-ui";
        ctx.fillStyle = "#ffd36c";
        ctx.fillText(remainText, modalX + modalW / 2, modalY + 124);
        ctx.font = "12px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(
          this._ui("Sure dolana kadar hicbir sey yapamazsin.", "You cannot do anything until the timer ends."),
          modalX + modalW / 2,
          modalY + 154
        );
      } else {
        ctx.fillText(
          this._ui("a) 2 saat bekle  b) 20 yton ode aninda iyiles", "a) Wait 2 hours  b) Pay 20 yton to heal now"),
          modalX + modalW / 2,
          modalY + 82
        );
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "12px system-ui";
        ctx.fillText(
          this._ui("Beklersen oyun bu ekranda kilitlenir.", "If you wait, the game stays locked on this screen."),
          modalX + modalW / 2,
          modalY + 104
        );

        const waitRect = {
          x: modalX + 18,
          y: modalY + modalH - 62,
          w: Math.floor((modalW - 46) / 2),
          h: 42,
        };
        const payRect = {
          x: waitRect.x + waitRect.w + 10,
          y: waitRect.y,
          w: waitRect.w,
          h: waitRect.h,
        };
        this.hitDiseaseWait = waitRect;
        this.hitDiseasePay = payRect;

        ctx.fillStyle = "rgba(28,28,36,0.96)";
        fillRoundRect(ctx, waitRect.x, waitRect.y, waitRect.w, waitRect.h, 14);
        fillRoundRect(ctx, payRect.x, payRect.y, payRect.w, payRect.h, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        strokeRoundRect(ctx, waitRect.x + 0.5, waitRect.y + 0.5, waitRect.w - 1, waitRect.h - 1, 14);
        strokeRoundRect(ctx, payRect.x + 0.5, payRect.y + 0.5, payRect.w - 1, payRect.h - 1, 14);

        ctx.fillStyle = "#ffffff";
        ctx.font = "800 13px system-ui";
        ctx.fillText(this._ui("2 Saat Bekle", "Wait 2 Hours"), waitRect.x + waitRect.w / 2, waitRect.y + 26);
        ctx.fillText(this._ui("20 yton Ode", "Pay 20 Yton"), payRect.x + payRect.w / 2, payRect.y + 26);
      }
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}
