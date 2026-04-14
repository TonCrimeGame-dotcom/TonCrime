import { fetchBackendJson } from "../supabase.js?v=20260408-3";
import {
  STARS_PRODUCTS,
  getStarsProductDescription,
  getStarsProductTitle,
} from "../data/starsCatalog.js?v=20260414-stars-1";
import { applyStarsProductGrantToState, ensureStarsEconomyState } from "../economy/StarsEconomy.js?v=20260414-stars-1";

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
  }

  onExit() {
    this.dragging = false;
    this.buyingProductId = "";
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

  draw(ctx) {
    const state = this.store.get() || {};
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
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

        const badgeSize = 54;
        fillRoundRect(ctx, row.x + 12, row.y + 16, badgeSize, badgeSize, 18, "rgba(255,179,71,0.16)");
        strokeRoundRect(ctx, row.x + 12.5, row.y + 16.5, badgeSize - 1, badgeSize - 1, 18, "rgba(255,195,109,0.38)", 1);
        ctx.fillStyle = "#ffd596";
        ctx.font = "900 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(product.badge || "XTR", row.x + 12 + badgeSize / 2, row.y + 16 + badgeSize / 2);

        const textX = row.x + 80;
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
