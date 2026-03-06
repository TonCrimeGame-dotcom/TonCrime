function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
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
function fillRoundRect(ctx, x, y, w, h, r) { roundRectPath(ctx, x, y, w, h, r); ctx.fill(); }
function strokeRoundRect(ctx, x, y, w, h, r) { roundRectPath(ctx, x, y, w, h, r); ctx.stroke(); }

const WEAPONS = [
  // Not: Bu “coin ekonomisi” için gerçekçi oran hissi veriyor.
  // Bonus: PvP ikon görünme süresi uzatma (%). Energy vermez.

  { id: "glock_17", name: "Glock 17 (9×19mm)", bonusPct: 18, price: 520 },
  { id: "sig_p320", name: "SIG Sauer P320 (9×19mm)", bonusPct: 20, price: 650 },
  { id: "beretta_92fs", name: "Beretta 92FS (9×19mm)", bonusPct: 19, price: 640 },
  { id: "colt_1911", name: "Colt 1911 (.45 ACP)", bonusPct: 22, price: 820 },

  { id: "mp5", name: "HK MP5 (9×19mm)", bonusPct: 28, price: 1700 },
  { id: "ump45", name: "HK UMP45 (.45 ACP)", bonusPct: 27, price: 1550 },

  { id: "mossberg_500", name: "Mossberg 500 (12ga)", bonusPct: 25, price: 480 },
  { id: "rem_870", name: "Remington 870 (12ga)", bonusPct: 26, price: 520 },

  { id: "ak47", name: "AK-47 (7.62×39)", bonusPct: 35, price: 1200 },
  { id: "ak74", name: "AK-74 (5.45×39)", bonusPct: 33, price: 1100 },
  { id: "ar15", name: "AR-15 (5.56×45)", bonusPct: 31, price: 980 },
  { id: "m4a1", name: "M4A1 (5.56×45)", bonusPct: 34, price: 1450 },

  { id: "g3", name: "HK G3 (7.62×51)", bonusPct: 38, price: 1600 },
  { id: "scar_h", name: "FN SCAR-H (7.62×51)", bonusPct: 40, price: 2800 },

  { id: "svd", name: "Dragunov SVD (7.62×54R)", bonusPct: 44, price: 2100 },
  { id: "m24", name: "Remington M24 (7.62×51)", bonusPct: 43, price: 2400 },

  { id: "m79", name: "M79 (Launcher)", bonusPct: 50, price: 3800 },
  { id: "rpg7", name: "RPG-7 (Launcher)", bonusPct: 55, price: 4500 },

  { id: "barrett_m82", name: "Barrett M82 (.50 BMG)", bonusPct: 60, price: 9000 },
  { id: "m134", name: "M134 Minigun (7.62×51)", bonusPct: 70, price: 12000 },
];

function iconMsFromPct(pct, baseMs = 500) {
  const p = clamp(Number(pct) || 0, 0, 200);
  return Math.round(baseMs * (1 + p / 100));
}

export class WeaponsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = []; // {id, type, rect}
  }

  onEnter() {
    const s = this.store.get();
    if (!s.weapons) {
      this.store.set({ weapons: { owned: {}, equippedId: null } });
    }
    // scroll reset (istersen kaldır)
    this.scrollY = 0;
  }

  onExit() {}

  _ensureWeaponsState() {
    const s = this.store.get();
    if (!s.weapons) this.store.set({ weapons: { owned: {}, equippedId: null } });
  }

  _getCoins() {
    const s = this.store.get();
    return Number(s.coins || 0);
  }

  _setCoins(n) {
    const next = Math.max(0, Math.floor(Number(n) || 0));
    this.store.set({ coins: next });
  }

  _applyEquippedToPlayer(itemOrNull) {
    const s = this.store.get();
    const p = s.player || {};
    if (!itemOrNull) {
      this.store.set({
        player: {
          ...p,
          weaponName: "Silah Yok",
          weaponBonus: "+0%",
          weaponIconBonusPct: 0,
        },
      });
      return;
    }
    this.store.set({
      player: {
        ...p,
        weaponName: itemOrNull.name,
        weaponBonus: `+%${itemOrNull.bonusPct}`,
        weaponIconBonusPct: Number(itemOrNull.bonusPct) || 0,
      },
    });
  }

  _buyOrEquip(weaponId) {
    this._ensureWeaponsState();
    const s = this.store.get();
    const w = s.weapons || { owned: {}, equippedId: null };
    const item = WEAPONS.find(x => x.id === weaponId);
    if (!item) return;

    const owned = !!w.owned?.[weaponId];
    if (!owned) {
      const coins = this._getCoins();
      if (coins < item.price) {
        // basit geri bildirim: console + mini status
        console.log("[WEAPONS] Yetersiz coin");
        return;
      }
      this._setCoins(coins - item.price);

      const nextWeapons = {
        owned: { ...(w.owned || {}), [weaponId]: true },
        equippedId: weaponId,
      };
      this.store.set({ weapons: nextWeapons });
      this._applyEquippedToPlayer(item);
      return;
    }

    // owned -> equip
    this.store.set({ weapons: { owned: { ...(w.owned || {}) }, equippedId: weaponId } });
    this._applyEquippedToPlayer(item);
  }

  _unequip() {
    this._ensureWeaponsState();
    const s = this.store.get();
    const w = s.weapons || { owned: {}, equippedId: null };
    this.store.set({ weapons: { ...w, equippedId: null } });
    this._applyEquippedToPlayer(null);
  }

  update() {
    const p = this.input.pointer || { x: 0, y: 0 };

    if (this.input.justPressed()) {
      this.dragging = true;
      this.downY = p.y;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input.isDown()) {
      const dy = p.y - this.downY;
      this.scrollY = this.startScroll + dy; // sürükle -> liste kayar
      this.moved += Math.abs(dy);
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input.justReleased()) {
      this.dragging = false;

      // click
      if (this.clickCandidate) {
        for (const h of this.hit) {
          if (pointInRect(p.x, p.y, h.rect)) {
            if (h.type === "back") {
              this.scenes.go("home");
              return;
            }
            if (h.type === "unequip") {
              this._unequip();
              return;
            }
            if (h.type === "action") {
              this._buyOrEquip(h.id);
              return;
            }
          }
        }
      }
    }
  }

  render(ctx, w, h) {
    const s = this.store.get();
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w, h };

    // BG
    const img =
      (typeof this.assets.getImage === "function" ? this.assets.getImage("weapons_bg") : null) ||
      this.assets.images?.weapons_bg;

    if (img) {
      const scale = Math.max(w / (img.width || 1), h / (img.height || 1));
      const dw = (img.width || 1) * scale;
      const dh = (img.height || 1) * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    // okunurluk
    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, w, h);

    // layout
    const pad = 14;
    const top = safe.y + 10;
    const left = safe.x + pad;
    const right = safe.x + safe.w - pad;

    const headerH = 88;
    const footerH = 64;

    const listTop = top + headerH;
    const listBottom = safe.y + safe.h - footerH - 10;
    const listH = Math.max(120, listBottom - listTop);

    // hit reset
    this.hit.length = 0;

    // HEADER panel
    const hx = left;
    const hy = top;
    const hw = right - left;
    const hh = headerH;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    fillRoundRect(ctx, hx, hy, hw, hh, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, hx + 0.5, hy + 0.5, hw - 1, hh - 1, 16);

    // Back button
    const backR = { x: hx + 10, y: hy + 10, w: 82, h: 34 };
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    fillRoundRect(ctx, backR.x, backR.y, backR.w, backR.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, backR.x + 0.5, backR.y + 0.5, backR.w - 1, backR.h - 1, 12);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Geri", backR.x + backR.w / 2, backR.y + backR.h / 2);
    this.hit.push({ type: "back", rect: backR });

    // Title
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 16px system-ui";
    ctx.fillText("Silah Kaçakçısı", hx + 104, hy + 30);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText("Bonus: PvP ikon süresi uzar • Energy yok", hx + 104, hy + 52);

    // Coins box
    const coins = Number(s.coins || 0);
    const coinsR = { x: hx + hw - 118, y: hy + 10, w: 108, h: 34 };
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    fillRoundRect(ctx, coinsR.x, coinsR.y, coinsR.w, coinsR.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, coinsR.x + 0.5, coinsR.y + 0.5, coinsR.w - 1, coinsR.h - 1, 12);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${coins} coin`, coinsR.x + coinsR.w / 2, coinsR.y + coinsR.h / 2);

    // Equipped info + Unequip
    const weaponsState = s.weapons || { owned: {}, equippedId: null };
    const eq = WEAPONS.find(x => x.id === weaponsState.equippedId) || null;

    const eqText = eq ? `Seçili: ${eq.name} (+%${eq.bonusPct} → ${iconMsFromPct(eq.bonusPct)}ms)` : "Seçili: -";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px system-ui";
    ctx.fillText(eqText, hx + 12, hy + 78);

    const unR = { x: hx + hw - 138, y: hy + 48, w: 128, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    fillRoundRect(ctx, unR.x, unR.y, unR.w, unR.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, unR.x + 0.5, unR.y + 0.5, unR.w - 1, unR.h - 1, 12);
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Silahı Çıkar", unR.x + unR.w / 2, unR.y + unR.h / 2);
    this.hit.push({ type: "unequip", rect: unR });

    // LIST panel
    const lx = left;
    const ly = listTop;
    const lw = right - left;
    const lh = listH;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    fillRoundRect(ctx, lx, ly, lw, lh, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, lx + 0.5, ly + 0.5, lw - 1, lh - 1, 16);

    // scroll limits
    const rowH = 76;
    const innerPad = 10;
    const contentH = WEAPONS.length * (rowH + 10) + innerPad;
    const minScroll = Math.min(0, lh - contentH);
    this.scrollY = clamp(this.scrollY, minScroll, 0);

    // clipping
    ctx.save();
    roundRectPath(ctx, lx, ly, lw, lh, 16);
    ctx.clip();

    // draw rows
    let y = ly + innerPad + this.scrollY;
    for (const item of WEAPONS) {
      const owned = !!weaponsState.owned?.[item.id];
      const equipped = weaponsState.equippedId === item.id;

      const rx = lx + 10;
      const ry = y;
      const rw = lw - 20;
      const rh = rowH;

      // row bg
      ctx.fillStyle = equipped ? "rgba(242,211,107,0.14)" : "rgba(0,0,0,0.30)";
      fillRoundRect(ctx, rx, ry, rw, rh, 14);
      ctx.strokeStyle = equipped ? "rgba(242,211,107,0.30)" : "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, rx + 0.5, ry + 0.5, rw - 1, rh - 1, 14);

      // name
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "900 13px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.name, rx + 12, ry + 26);

      // stats
      const ms = iconMsFromPct(item.bonusPct);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`Güç: +%${item.bonusPct} (ikon ~${ms}ms)`, rx + 12, ry + 48);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(`Fiyat: ${item.price} coin`, rx + 12, ry + 66);

      // action button
      const btnW = 110;
      const btnH = 34;
      const btnR = { x: rx + rw - btnW - 12, y: ry + (rh - btnH) / 2, w: btnW, h: btnH };

      const label = owned ? (equipped ? "Seçili" : "Tak") : "Satın Al";
      ctx.fillStyle = owned ? "rgba(255,255,255,0.07)" : "rgba(242,211,107,0.18)";
      fillRoundRect(ctx, btnR.x, btnR.y, btnR.w, btnR.h, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      strokeRoundRect(ctx, btnR.x + 0.5, btnR.y + 0.5, btnR.w - 1, btnR.h - 1, 12);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "900 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, btnR.x + btnR.w / 2, btnR.y + btnR.h / 2);

      // hit
      this.hit.push({ type: "action", id: item.id, rect: btnR });

      y += rowH + 10;
    }

    ctx.restore();

    // FOOTER (test ipucu)
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const fx = left, fy = safe.y + safe.h - footerH - 8, fw = right - left, fh = footerH;
    fillRoundRect(ctx, fx, fy, fw, fh, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, fx + 0.5, fy + 0.5, fw - 1, fh - 1, 16);

    const pct = Number(s.player?.weaponIconBonusPct || 0);
    const effMs = iconMsFromPct(pct);
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`Aktif Etki: 500ms → ${effMs}ms  (+%${pct})`, fx + 12, fy + 28);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText(`Test: PvP aç → ikonların ekranda kalma süresini fark et.`, fx + 12, fy + 50);
  }
}