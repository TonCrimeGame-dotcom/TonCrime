import { fetchBackendJson } from "../supabase.js?v=20260408-3";

const STARS_PRODUCTS = [
  {
    id: "premium_lifetime",
    titleTr: "Premium Uyelik",
    titleEn: "Premium Membership",
    descriptionTr: "Cekilemeyen oyun ici premium, level 50 ve isletme acma hakki.",
    descriptionEn: "Non-withdrawable in-game premium, level 50, and business unlock.",
    priceStars: 499,
    badge: "PREMIUM",
    imageSrc: "./src/assets/prestige.png",
    imageMode: "contain",
    grant: { premium: true, levelAtLeast: 50, canOwnBusiness: true, canWithdraw: false },
  },
  {
    id: "energy_full",
    titleTr: "Full Enerji",
    titleEn: "Full Energy",
    descriptionTr: "Enerjini maksimuma doldurur. Cekim veya TON degeri vermez.",
    descriptionEn: "Refills energy to max. Does not grant withdrawal or TON value.",
    priceStars: 35,
    badge: "ENERGY",
    imageSrc: "./src/assets/bonus.png",
    imageMode: "contain",
    grant: { fullEnergy: true },
  },
  {
    id: "yton_1000",
    titleTr: "1000 Oyun YTON",
    titleEn: "1000 Game YTON",
    descriptionTr: "Sadece oyun icinde harcanan, cekilemeyen YTON paketi.",
    descriptionEn: "A non-withdrawable YTON pack for in-game use only.",
    priceStars: 99,
    badge: "YTON",
    imageSrc: "./src/assets/yton.png",
    imageMode: "contain",
    grant: { yton: 1000, withdrawable: false },
  },
  {
    id: "match_assist_10",
    titleTr: "10 Kolay Eslesme Hakki",
    titleEn: "10 Easier Match Tickets",
    descriptionTr: "PvP bot eslesmelerinde daha dusuk seviye rakip ihtimalini artirir.",
    descriptionEn: "Increases the chance of lower-level bot opponents in PvP.",
    priceStars: 75,
    badge: "MATCH",
    imageSrc: "./src/assets/pvp.jpg",
    imageMode: "cover",
    grant: { easyMatchTickets: 10 },
  },
  {
    id: "gold_badge",
    titleTr: "Altin Profil Rozeti",
    titleEn: "Gold Profile Badge",
    descriptionTr: "Profilinde gorunen kozmetik rozet. Ekonomik veya cekilebilir deger vermez.",
    descriptionEn: "Cosmetic profile badge. No economic or withdrawable value.",
    priceStars: 55,
    badge: "GOLD",
    imageSrc: "./src/assets/crown.png",
    imageMode: "contain",
    grant: { cosmeticBadge: "gold" },
  },
];

function getStarsProductTitle(product, lang = "tr") {
  if (!product) return "";
  return lang === "en" ? product.titleEn : product.titleTr;
}

function getStarsProductDescription(product, lang = "tr") {
  if (!product) return "";
  return lang === "en" ? product.descriptionEn : product.descriptionTr;
}

function ensureStarsEconomyState(state = {}) {
  const stars = state.stars || {};
  return {
    ...stars,
    owned: stars.owned || {},
    selectedId: stars.selectedId ?? null,
    lastClaimTs: stars.lastClaimTs || {},
    twinBonusClaimed: stars.twinBonusClaimed || {},
    diseaseUntil: Number(stars.diseaseUntil || 0),
    lastDiseaseAt: Number(stars.lastDiseaseAt || 0),
    purchases: Array.isArray(stars.purchases) ? stars.purchases : [],
    easyMatchTickets: Math.max(0, Number(stars.easyMatchTickets || 0)),
    cosmetics: { ...(stars.cosmetics || {}) },
    economyMode: "stars",
  };
}

function applyStarsProductGrantToState(state = {}, product, payment = {}) {
  if (!product?.id) return state;

  const now = Date.now();
  const grant = product.grant || {};
  const player = { ...(state.player || {}) };
  const stars = ensureStarsEconomyState(state);
  const wallet = { ...(state.wallet || {}) };
  const currentCoins = Math.max(0, Number(state.coins ?? state.yton ?? wallet.yton ?? 0));
  let nextCoins = currentCoins;

  if (Number(grant.yton || 0) > 0) nextCoins += Number(grant.yton || 0);

  if (grant.fullEnergy) {
    const maxEnergy = Math.max(1, Number(player.energyMax || 100));
    player.energy = maxEnergy;
  }

  if (grant.premium) {
    player.membership = "premium";
    player.premium = true;
    player.isPremium = true;
    player.canOwnBusiness = !!grant.canOwnBusiness;
    player.canWithdraw = false;
    if (Number(grant.levelAtLeast || 0) > 0) {
      player.level = Math.max(Number(player.level || 0), Number(grant.levelAtLeast || 0));
    }
  }

  if (Number(grant.easyMatchTickets || 0) > 0) {
    stars.easyMatchTickets = Math.max(0, Number(stars.easyMatchTickets || 0)) + Number(grant.easyMatchTickets || 0);
  }

  if (grant.cosmeticBadge) {
    stars.cosmetics = { ...(stars.cosmetics || {}), badge: String(grant.cosmeticBadge) };
  }

  return {
    ...state,
    coins: nextCoins,
    yton: nextCoins,
    premium: !!(state.premium || grant.premium),
    isPremium: !!(state.isPremium || grant.premium),
    player,
    wallet: {
      ...wallet,
      yton: nextCoins,
      tonBalance: 0,
      starsWithdrawable: false,
    },
    stars: {
      ...stars,
      purchases: [
        {
          id: `stars_${product.id}_${now}`,
          productId: product.id,
          priceStars: Number(product.priceStars || 0),
          currency: "XTR",
          withdrawable: false,
          source: "telegram_stars",
          status: payment.status || "paid",
          chargeId: payment.chargeId || "",
          createdAt: now,
        },
        ...(stars.purchases || []),
      ].slice(0, 80),
      lastPurchaseAt: now,
      lastProductId: product.id,
    },
  };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, lw = 1) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function fitText(ctx, text, maxWidth, startSize, minSize, family = "system-ui", weight = 800) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(String(text || "")).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

function textFit(ctx, text, x, y, maxWidth) {
  let out = String(text || "");
  if (ctx.measureText(out).width <= maxWidth) {
    ctx.fillText(out, x, y);
    return;
  }
  while (out.length > 0 && ctx.measureText(out + "...").width > maxWidth) out = out.slice(0, -1);
  ctx.fillText(out + "...", x, y);
}

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function drawCoverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}

function drawContainImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}

function getTelegramWebApp() {
  try { return window.Telegram?.WebApp || null; } catch (_) { return null; }
}

export class StarsScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.toastText = "";
    this.toastUntil = 0;
    this.buyingProductId = "";
    this.bg = null;
    this.productImages = new Map();
  }

  _lang() {
    return this.i18n?.getLang?.() === "en" ? "en" : "tr";
  }

  _ui(tr, en) {
    return this._lang() === "en" ? en : tr;
  }

  _showToast(text, ms = 2200) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
    try {
      window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text: this.toastText } }));
    } catch (_) {}
  }

  _ensureState() {
    const state = this.store.get() || {};
    this.store.set({ stars: ensureStarsEconomyState(state) });
  }

  onEnter() {
    this._ensureState();
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.bg = new Image();
    this.bg.src = "./src/assets/pvp-bg.png";
    STARS_PRODUCTS.forEach((product) => this._productImage(product));
  }

  onExit() {
    this.dragging = false;
    this.buyingProductId = "";
  }

  _productImage(product) {
    const src = String(product?.imageSrc || "").trim();
    if (!src) return null;
    if (!this.productImages.has(src)) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { img._ready = true; };
      img.onerror = () => { img._failed = true; };
      img.src = src;
      this.productImages.set(src, img);
    }
    const img = this.productImages.get(src);
    return img && !img._failed ? img : null;
  }

  _drawProductVisual(ctx, product, x, y, size) {
    const img = this._productImage(product);
    fillRoundRect(ctx, x, y, size, size, 18, "rgba(255,179,71,0.10)");
    strokeRoundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 18, "rgba(255,195,109,0.26)", 1);

    ctx.save();
    roundRectPath(ctx, x + 2, y + 2, size - 4, size - 4, 16);
    ctx.clip();
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, "rgba(255,225,156,0.12)");
    grad.addColorStop(1, "rgba(20,11,7,0.58)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, size, size);

    const pad = product?.imageMode === "cover" ? 0 : Math.max(7, Math.round(size * 0.12));
    const drawn = product?.imageMode === "cover"
      ? drawCoverImage(ctx, img, x + 2, y + 2, size - 4, size - 4, 0.96)
      : drawContainImage(ctx, img, x + pad, y + pad, size - pad * 2, size - pad * 2, 0.96);

    if (!drawn) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, size, size);
    }

    const shade = ctx.createLinearGradient(0, y, 0, y + size);
    shade.addColorStop(0, "rgba(255,255,255,0.08)");
    shade.addColorStop(0.62, "rgba(0,0,0,0.00)");
    shade.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, size, size);
    ctx.restore();
  }

  _grantProduct(product, payment = {}) {
    const current = this.store.get() || {};
    this.store.set(applyStarsProductGrantToState(current, product, payment));
    this._showToast(
      this._ui(
        `${getStarsProductTitle(product, "tr")} teslim edildi. Cekim hakki vermez.`,
        `${getStarsProductTitle(product, "en")} delivered. It does not grant withdrawal.`
      ),
      2600
    );
  }

  async _buyProduct(product) {
    if (!product?.id || this.buyingProductId) return;
    this.buyingProductId = product.id;

    const tg = getTelegramWebApp();
    const canDevGrant = String(localStorage.getItem("toncrime_stars_dev_grant") || "") === "1";

    try {
      if (!tg?.openInvoice && !canDevGrant) {
        this._showToast(this._ui("Telegram Stars odemesi sadece Telegram icinde acilir", "Telegram Stars payment opens only inside Telegram"));
        return;
      }

      if (canDevGrant && !tg?.openInvoice) {
        this._grantProduct(product, { status: "dev_grant" });
        return;
      }

      this._showToast(this._ui("Stars odeme penceresi hazirlaniyor", "Preparing Stars payment"), 1800);
      const json = await fetchBackendJson("/public/stars/invoice", {
        method: "POST",
        body: JSON.stringify({ product_id: product.id }),
      });
      const invoiceLink = String(json?.invoice_link || "").trim();
      if (!invoiceLink) throw new Error("invoice link missing");

      await new Promise((resolve) => {
        tg.openInvoice(invoiceLink, (status) => {
          if (status === "paid") {
            this._grantProduct(product, { status: "paid", chargeId: "client_paid" });
          } else if (status === "cancelled" || status === "failed") {
            this._showToast(this._ui("Stars odemesi tamamlanmadi", "Stars payment was not completed"));
          }
          resolve(status);
        });
      });
    } catch (err) {
      console.error("[StarsScene] payment failed:", err);
      this._showToast(err?.message || this._ui("Stars odemesi baslatilamadi", "Stars payment could not start"));
    } finally {
      this.buyingProductId = "";
    }
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;
    const isDown = !!this.input?.pointer?.down;

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
    }

    if (this.dragging && isDown) {
      this.scrollY = clamp(this.startScrollY - (py - this.downY), 0, this.maxScroll);
    }

    if (this.input?.justReleased?.()) {
      const moved = Math.abs(py - this.downY);
      this.dragging = false;
      if (moved > 10) return;

      for (const btn of this.buttons) {
        if (pointInRect(px, py, btn.rect)) {
          if (btn.action === "close") this.scenes?.go?.("home");
          if (btn.action === "buy") void this._buyProduct(btn.product);
          return;
        }
      }
    }
  }

  render(ctx, w, h) {
    this.draw(ctx, w, h);
  }

  draw(ctx, viewW, viewH) {
    const state = this.store.get() || {};
    const w = Math.max(1, Number(viewW || window.innerWidth || ctx.canvas.width || 1));
    const h = Math.max(1, Number(viewH || window.innerHeight || ctx.canvas.height || 1));
    const safe = state.ui?.safe || { x: 0, y: 0, w, h };
    const hudTop = Number(state.ui?.hudReservedTop || 98);
    const chatBottom = Number(state.ui?.chatReservedBottom || 64);
    const lang = this._lang();
    const starsState = ensureStarsEconomyState(state);

    this.buttons = [];
    ctx.clearRect(0, 0, w, h);
    if (!drawCoverImage(ctx, this.bg, 0, 0, w, h, 1)) {
      ctx.fillStyle = "#130d08";
      ctx.fillRect(0, 0, w, h);
    }
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, "rgba(10,6,3,0.34)");
    fade.addColorStop(1, "rgba(10,6,3,0.82)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    const side = safe.w <= 430 ? 12 : 22;
    const panelX = safe.x + side;
    const panelY = safe.y + Math.max(8, hudTop - 4);
    const panelW = safe.w - side * 2;
    const panelBottom = safe.y + safe.h - Math.max(10, chatBottom - 6);
    const panelH = Math.max(320, panelBottom - panelY);
    const innerX = panelX + 16;
    const innerW = panelW - 32;

    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 24, "rgba(13,10,10,0.70)");
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 24, "rgba(255,195,109,0.22)", 1);

    const closeRect = { x: panelX + panelW - 48, y: panelY + 14, w: 32, h: 32 };
    this.buttons.push({ rect: closeRect, action: "close" });
    fillRoundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 10, "rgba(255,255,255,0.10)");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 18px system-ui";
    ctx.fillText("X", closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2 + 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff6de";
    ctx.font = `900 ${safe.w <= 430 ? 22 : 28}px system-ui`;
    textFit(ctx, this._ui("Telegram Stars Magazasi", "Telegram Stars Shop"), innerX, panelY + 38, innerW - 44);
    ctx.fillStyle = "rgba(255,216,160,0.80)";
    ctx.font = "700 12px system-ui";
    textFit(
      ctx,
      this._ui("Cekilemeyen oyun ici avantajlar. TON, crypto veya cekim hakki vermez.", "Non-withdrawable in-game benefits. No TON, crypto, or withdrawal rights."),
      innerX,
      panelY + 60,
      innerW
    );

    const summaryY = panelY + 76;
    const summaryH = 74;
    fillRoundRect(ctx, innerX, summaryY, innerW, summaryH, 18, "rgba(255,255,255,0.055)");
    strokeRoundRect(ctx, innerX + 0.5, summaryY + 0.5, innerW - 1, summaryH - 1, 18, "rgba(255,195,109,0.18)", 1);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 13px system-ui";
    textFit(ctx, this._ui(`Oyun YTON: ${Math.floor(Number(state.coins || 0)).toLocaleString("tr-TR")}`, `Game YTON: ${Math.floor(Number(state.coins || 0)).toLocaleString("tr-TR")}`), innerX + 14, summaryY + 25, innerW - 28);
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "700 11px system-ui";
    textFit(ctx, this._ui(`Kolay eslesme hakki: ${Math.floor(Number(starsState.easyMatchTickets || 0))}`, `Easier match tickets: ${Math.floor(Number(starsState.easyMatchTickets || 0))}`), innerX + 14, summaryY + 47, innerW - 28);
    textFit(ctx, this._ui("Stars ile alinan YTON sadece oyun icidir.", "YTON bought with Stars is in-game only."), innerX + 14, summaryY + 64, innerW - 28);

    const listY = summaryY + summaryH + 14;
    const listH = panelY + panelH - listY - 14;
    const rowGap = 12;
    const rowH = safe.w <= 430 ? 136 : 124;
    const contentH = STARS_PRODUCTS.length * rowH + Math.max(0, STARS_PRODUCTS.length - 1) * rowGap;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    roundRectPath(ctx, innerX, listY, innerW, listH, 18);
    ctx.clip();

    let y = listY - this.scrollY;
    for (const product of STARS_PRODUCTS) {
      const row = { x: innerX, y, w: innerW, h: rowH };
      if (row.y + row.h >= listY - 20 && row.y <= listY + listH + 20) {
        const busy = this.buyingProductId === product.id;
        fillRoundRect(ctx, row.x, row.y, row.w, row.h, 20, "rgba(0,0,0,0.34)");
        strokeRoundRect(ctx, row.x + 0.5, row.y + 0.5, row.w - 1, row.h - 1, 20, "rgba(255,195,109,0.18)", 1);

        const badgeSize = safe.w <= 430 ? 72 : 76;
        const badgeX = row.x + 12;
        const badgeY = row.y + (row.h - badgeSize) / 2;
        this._drawProductVisual(ctx, product, badgeX, badgeY, badgeSize);

        const textX = badgeX + badgeSize + 16;
        const btnW = safe.w <= 430 ? 98 : 116;
        const btnH = 42;
        const btnX = row.x + row.w - btnW - 12;
        const textW = Math.max(90, btnX - textX - 12);
        const title = getStarsProductTitle(product, lang);
        const desc = getStarsProductDescription(product, lang);
        const titleSize = fitText(ctx, title, textW, 17, 13);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${titleSize}px system-ui`;
        textFit(ctx, title, textX, row.y + 28, textW);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "600 11px system-ui";
        wrapText(ctx, desc, textW, 3).forEach((line, idx) => ctx.fillText(line, textX, row.y + 50 + idx * 16));
        ctx.fillStyle = "rgba(255,213,156,0.82)";
        ctx.font = "900 12px system-ui";
        ctx.fillText(`${Number(product.priceStars || 0)} Stars`, textX, row.y + row.h - 18);

        const btn = { x: btnX, y: row.y + (row.h - btnH) / 2, w: btnW, h: btnH };
        this.buttons.push({ rect: btn, action: "buy", product });
        fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, busy ? "rgba(255,255,255,0.08)" : "rgba(255,179,71,0.18)");
        strokeRoundRect(ctx, btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1, 14, "rgba(255,195,109,0.38)", 1);
        ctx.fillStyle = "#fff6de";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 12px system-ui";
        ctx.fillText(busy ? this._ui("ACILIYOR", "OPENING") : this._ui("STARS ILE AL", "BUY STARS"), btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
      }
      y += rowH + rowGap;
    }
    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = innerX + innerW - 5;
      const trackY = listY + 10;
      const trackH = listH - 20;
      fillRoundRect(ctx, trackX, trackY, 3, trackH, 3, "rgba(255,255,255,0.10)");
      const thumbH = Math.max(38, (listH / Math.max(listH, contentH)) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));
      fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 3, "rgba(255,195,109,0.72)");
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(innerW, 420);
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 58;
      fillRoundRect(ctx, tx, ty, tw, 42, 14, "rgba(0,0,0,0.72)");
      strokeRoundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, 41, 14, "rgba(255,195,109,0.24)", 1);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 12px system-ui";
      textFit(ctx, this.toastText, tx + tw / 2, ty + 22, tw - 24);
    }
  }
}
