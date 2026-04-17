const STAR_NAMES = [
  "Scarlett", "Monica", "Isabella", "Valentina", "Sofia", "Bianca", "Adriana", "Natalia",
  "Victoria", "Camila", "Vanessa", "Alessia", "Diana", "Elena", "Stella", "Nina",
  "Aurora", "Gabriella", "Luna", "Carmen", "Anastasia", "Sienna", "Violet", "Roxanne",
  "Maya", "Chloe",
];

const BROTHEL_ITEMS = STAR_NAMES.map((name, index) => {
  const n = index + 1;
  const energy = index === 0 ? 5 : 7 + ((n * 7) % 24);
  const price = index === 0 ? 5 : Math.max(8, energy + 2 + ((n * 5) % 18));
  return {
    id: `g_star_${n}`,
    name,
    energy,
    price,
    imageSrc: `./src/assets/g_star${n}.png`,
  };
});

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

function textFit(ctx, text, x, y, maxWidth) {
  let out = String(text || "");
  if (ctx.measureText(out).width <= maxWidth) {
    ctx.fillText(out, x, y);
    return;
  }
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  ctx.fillText(`${out}...`, x, y);
}

function drawCoverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img || !img.complete || !(img.naturalWidth || img.width)) return false;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}

function drawContainImage(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !(img.naturalWidth || img.width)) return false;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  return true;
}

export class BrothelScene {
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
    this.toast = "";
    this.toastUntil = 0;
    this.images = new Map();
    this.bg = null;
  }

  onEnter() {
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.bg = this._asset("xxx_bg") || this._asset("xxx") || this._loadImage("bg", "./src/assets/xxx-bg.png");
    BROTHEL_ITEMS.forEach((item) => this._loadImage(item.id, item.imageSrc));
  }

  onExit() {
    this.dragging = false;
  }

  _lang() {
    return this.i18n?.getLang?.() === "en" ? "en" : "tr";
  }

  _ui(tr, en) {
    return this._lang() === "en" ? en : tr;
  }

  _asset(key) {
    try {
      if (typeof this.assets?.getImage === "function") return this.assets.getImage(key);
      if (typeof this.assets?.get === "function") return this.assets.get(key);
    } catch (_) {}
    return null;
  }

  _loadImage(key, src) {
    const safeKey = String(key || src || "");
    if (!safeKey) return null;
    if (!this.images.has(safeKey)) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { img._ready = true; };
      img.onerror = () => { img._failed = true; };
      img.src = src;
      this.images.set(safeKey, img);
    }
    const img = this.images.get(safeKey);
    return img && !img._failed ? img : null;
  }

  _showToast(text, ms = 1600) {
    this.toast = String(text || "");
    this.toastUntil = Date.now() + ms;
    try {
      window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text: this.toast } }));
    } catch (_) {}
  }

  _buy(item) {
    if (!item) return;
    const state = this.store.get() || {};
    const player = state.player || {};
    const coins = Math.max(0, Number(state.coins ?? state.yton ?? 0));
    const price = Math.max(0, Number(item.price || 0));
    const energy = Math.max(0, Number(player.energy || 0));
    const energyMax = Math.max(1, Number(player.energyMax || 100));

    if (energy >= energyMax) {
      this._showToast(this._ui("Enerjin zaten full", "Energy is already full"));
      return;
    }

    if (coins < price) {
      this._showToast(this._ui("Yetersiz YTON", "Not enough YTON"));
      return;
    }

    const nextEnergy = Math.min(energyMax, energy + Math.max(0, Number(item.energy || 0)));
    const gained = Math.max(0, nextEnergy - energy);
    const nextCoins = Math.max(0, coins - price);

    this.store.set({
      coins: nextCoins,
      yton: nextCoins,
      wallet: {
        ...(state.wallet || {}),
        yton: nextCoins,
      },
      player: {
        ...player,
        energy: nextEnergy,
        lastEnergyAt: Date.now(),
      },
    });

    this._showToast(this._ui(`${item.name}: +${gained} enerji`, `${item.name}: +${gained} energy`));
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
    }

    if (this.dragging && this.input?.isDown?.()) {
      this.scrollY = clamp(this.startScrollY - (py - this.downY), 0, this.maxScroll);
    }

    if (this.input?.justReleased?.()) {
      const moved = Math.abs(py - this.downY);
      this.dragging = false;
      if (moved > 10) return;

      for (const btn of this.buttons) {
        if (!pointInRect(px, py, btn.rect)) continue;
        if (btn.action === "back") this.scenes?.go?.("home");
        if (btn.action === "buy") this._buy(btn.item);
        return;
      }
    }
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const safe = state.ui?.safe || { x: 0, y: 0, w, h };
    const hudTop = Number(state.ui?.hudReservedTop || 108);
    const chatBottom = Number(state.ui?.chatReservedBottom || 72);
    const coins = Math.max(0, Number(state.coins ?? state.yton ?? 0));
    const player = state.player || {};
    const energy = Math.max(0, Number(player.energy || 0));
    const energyMax = Math.max(1, Number(player.energyMax || 100));

    this.buttons = [];
    ctx.clearRect(0, 0, w, h);

    const bg = this._asset("xxx_bg") || this._asset("xxx") || this.bg;
    if (!drawCoverImage(ctx, bg, 0, 0, w, h, 1)) {
      ctx.fillStyle = "#10070b";
      ctx.fillRect(0, 0, w, h);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, h);
    overlay.addColorStop(0, "rgba(8,4,8,0.42)");
    overlay.addColorStop(0.45, "rgba(20,8,12,0.56)");
    overlay.addColorStop(1, "rgba(2,3,6,0.88)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, w, h);

    const side = safe.w <= 430 ? 12 : 22;
    const panelX = safe.x + side;
    const panelY = safe.y + Math.max(8, hudTop - 6);
    const panelW = safe.w - side * 2;
    const panelBottom = safe.y + safe.h - Math.max(12, chatBottom - 4);
    const panelH = Math.max(320, panelBottom - panelY);
    const innerX = panelX + 14;
    const innerW = panelW - 28;

    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 22, "rgba(8,8,12,0.62)");
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 22, "rgba(255,175,192,0.20)");

    const backRect = { x: panelX + panelW - 46, y: panelY + 12, w: 32, h: 32 };
    this.buttons.push({ rect: backRect, action: "back" });
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 8, "rgba(255,255,255,0.09)");
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 8, "rgba(255,255,255,0.10)");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 18px system-ui";
    ctx.fillText("X", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2 + 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff4f6";
    ctx.font = `900 ${safe.w <= 430 ? 23 : 29}px system-ui`;
    textFit(ctx, this._ui("Genelev", "Brothel"), innerX, panelY + 38, innerW - 46);

    ctx.fillStyle = "rgba(255,220,226,0.76)";
    ctx.font = "700 12px system-ui";
    textFit(
      ctx,
      this._ui(`Enerji ${Math.floor(energy)}/${Math.floor(energyMax)} - YTON ${Math.floor(coins).toLocaleString("tr-TR")}`, `Energy ${Math.floor(energy)}/${Math.floor(energyMax)} - YTON ${Math.floor(coins).toLocaleString("tr-TR")}`),
      innerX,
      panelY + 59,
      innerW
    );

    const listY = panelY + 76;
    const listH = panelY + panelH - listY - 14;
    const compact = innerW <= 360;
    const rowH = compact ? 118 : 106;
    const rowGap = 10;
    const contentH = BROTHEL_ITEMS.length * rowH + (BROTHEL_ITEMS.length - 1) * rowGap;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    roundRectPath(ctx, innerX, listY, innerW, listH, 16);
    ctx.clip();

    let y = listY - this.scrollY;
    for (const item of BROTHEL_ITEMS) {
      const row = { x: innerX, y, w: innerW, h: rowH };
      if (row.y + row.h >= listY - 24 && row.y <= listY + listH + 24) {
        fillRoundRect(ctx, row.x, row.y, row.w, row.h, 16, "rgba(0,0,0,0.34)");
        strokeRoundRect(ctx, row.x + 0.5, row.y + 0.5, row.w - 1, row.h - 1, 16, "rgba(255,185,204,0.18)");

        const imgSize = compact ? 78 : 74;
        const imgX = row.x + 12;
        const imgY = row.y + (row.h - imgSize) / 2;
        fillRoundRect(ctx, imgX, imgY, imgSize, imgSize, 14, "rgba(255,255,255,0.06)");
        ctx.save();
        roundRectPath(ctx, imgX, imgY, imgSize, imgSize, 14);
        ctx.clip();
        const img = this._loadImage(item.id, item.imageSrc);
        if (!drawContainImage(ctx, img, imgX + 3, imgY + 3, imgSize - 6, imgSize - 6)) {
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(imgX, imgY, imgSize, imgSize);
        }
        ctx.restore();
        strokeRoundRect(ctx, imgX + 0.5, imgY + 0.5, imgSize - 1, imgSize - 1, 14, "rgba(255,255,255,0.10)");

        const textX = imgX + imgSize + 12;
        const btnW = compact ? 74 : 86;
        const btnH = 32;
        const btnX = row.x + row.w - btnW - 12;
        const textW = Math.max(82, btnX - textX - 10);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#fff";
        ctx.font = "900 17px system-ui";
        textFit(ctx, item.name, textX, row.y + 30, textW);

        ctx.fillStyle = "rgba(255,220,226,0.76)";
        ctx.font = "700 12px system-ui";
        textFit(ctx, this._ui(`+${item.energy} enerji`, `+${item.energy} energy`), textX, row.y + 54, textW);

        ctx.fillStyle = "rgba(255,230,180,0.86)";
        ctx.font = "900 12px system-ui";
        textFit(ctx, `${item.price} YTON`, textX, row.y + 76, textW);

        const buyRect = { x: btnX, y: row.y + (row.h - btnH) / 2, w: btnW, h: btnH };
        this.buttons.push({ rect: buyRect, action: "buy", item });
        const affordable = coins >= item.price && energy < energyMax;
        fillRoundRect(ctx, buyRect.x, buyRect.y, buyRect.w, buyRect.h, 8, affordable ? "rgba(255,190,104,0.16)" : "rgba(255,255,255,0.06)");
        strokeRoundRect(ctx, buyRect.x + 0.5, buyRect.y + 0.5, buyRect.w - 1, buyRect.h - 1, 8, affordable ? "rgba(255,215,150,0.28)" : "rgba(255,255,255,0.08)");
        ctx.fillStyle = affordable ? "#fff0c8" : "rgba(255,255,255,0.46)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 11px system-ui";
        ctx.fillText(this._ui("AL", "BUY"), buyRect.x + buyRect.w / 2, buyRect.y + buyRect.h / 2 + 1);
      }
      y += rowH + rowGap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = innerX + innerW - 5;
      const trackY = listY + 10;
      const trackH = listH - 20;
      fillRoundRect(ctx, trackX, trackY, 3, trackH, 3, "rgba(255,255,255,0.10)");
      const thumbH = Math.max(36, (listH / Math.max(listH, contentH)) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));
      fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 3, "rgba(255,196,210,0.62)");
    }

    if (this.toast && Date.now() < this.toastUntil) {
      const tw = Math.min(innerW, 340);
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 54;
      fillRoundRect(ctx, tx, ty, tw, 38, 12, "rgba(0,0,0,0.70)");
      strokeRoundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, 37, 12, "rgba(255,185,204,0.18)");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 12px system-ui";
      textFit(ctx, this.toast, tx + tw / 2, ty + 21, tw - 24);
    }
  }
}

export default BrothelScene;
