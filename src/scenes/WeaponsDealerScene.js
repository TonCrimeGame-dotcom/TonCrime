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

function coverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img) return;
  const iw = img.width || img.naturalWidth || 1;
  const ih = img.height || img.naturalHeight || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.globalAlpha = prev;
}

function iconMsFromPct(pct, baseMs = 500) {
  const p = clamp(Number(pct) || 0, 0, 250);
  return Math.round(baseMs * (1 + p / 100));
}

function shortNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function fitText(ctx, text, maxW, startSize, minSize = 10, weight = 900) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px system-ui`;
    if (ctx.measureText(text).width <= maxW) return size;
    size -= 1;
  }
  return minSize;
}

function wrapLines(ctx, text, maxW, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (!line || ctx.measureText(candidate).width <= maxW) {
      line = candidate;
      continue;
    }

    lines.push(line);
    line = words[i];

    if (lines.length === maxLines - 1) {
      let tail = line;
      for (let j = i + 1; j < words.length; j++) tail += ` ${words[j]}`;
      while (ctx.measureText(`${tail}…`).width > maxW && tail.length > 1) {
        tail = tail.slice(0, -1).trimEnd();
      }
      lines.push(words.length > i + 1 ? `${tail}…` : tail);
      return lines;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

const WEAPONS = [
  { id: "glock_17", name: "Glock 17 (9×19mm)", bonusPct: 18, price: 520, tier: "Yan Silah", label: "Başlangıç", accent: "#d8aa59" },
  { id: "sig_p320", name: "SIG Sauer P320 (9×19mm)", bonusPct: 20, price: 650, tier: "Yan Silah", label: "Dengeli", accent: "#d8aa59" },
  { id: "beretta_92fs", name: "Beretta 92FS (9×19mm)", bonusPct: 19, price: 640, tier: "Yan Silah", label: "Stabil", accent: "#d8aa59" },
  { id: "colt_1911", name: "Colt 1911 (.45 ACP)", bonusPct: 22, price: 820, tier: "Yan Silah", label: "Ağır Vuruş", accent: "#d8aa59" },

  { id: "mossberg_500", name: "Mossberg 500 (12ga)", bonusPct: 25, price: 480, tier: "Pompalı", label: "Yakın Menzil", accent: "#d8aa59" },
  { id: "rem_870", name: "Remington 870 (12ga)", bonusPct: 26, price: 520, tier: "Pompalı", label: "Yakın Menzil", accent: "#d8aa59" },

  { id: "mp5", name: "HK MP5 (9×19mm)", bonusPct: 28, price: 1700, tier: "SMG", label: "Hızlı", accent: "#cf954e" },
  { id: "ump45", name: "HK UMP45 (.45 ACP)", bonusPct: 27, price: 1550, tier: "SMG", label: "Kontrollü", accent: "#cf954e" },

  { id: "ar15", name: "AR-15 (5.56×45)", bonusPct: 31, price: 980, tier: "Tüfek", label: "Orta Seviye", accent: "#cf954e" },
  { id: "ak74", name: "AK-74 (5.45×39)", bonusPct: 33, price: 1100, tier: "Tüfek", label: "Orta Seviye", accent: "#cf954e" },
  { id: "ak47", name: "AK-47 (7.62×39)", bonusPct: 35, price: 1200, tier: "Tüfek", label: "Güçlü", accent: "#cf954e" },
  { id: "m4a1", name: "M4A1 (5.56×45)", bonusPct: 34, price: 1450, tier: "Tüfek", label: "Dengeli", accent: "#cf954e" },

  { id: "g3", name: "HK G3 (7.62×51)", bonusPct: 38, price: 1600, tier: "Ağır Tüfek", label: "Yüksek Bonus", accent: "#c98244" },
  { id: "scar_h", name: "FN SCAR-H (7.62×51)", bonusPct: 40, price: 2800, tier: "Ağır Tüfek", label: "Yüksek Bonus", accent: "#c98244" },

  { id: "svd", name: "Dragunov SVD (7.62×54R)", bonusPct: 44, price: 2100, tier: "Keskin Nişancı", label: "Premium", accent: "#c46f3d" },
  { id: "m24", name: "Remington M24 (7.62×51)", bonusPct: 43, price: 2400, tier: "Keskin Nişancı", label: "Premium", accent: "#c46f3d" },

  { id: "m79", name: "M79 (Launcher)", bonusPct: 50, price: 3800, tier: "Launcher", label: "Epic", accent: "#b85d35" },
  { id: "rpg7", name: "RPG-7 (Launcher)", bonusPct: 55, price: 4500, tier: "Launcher", label: "Epic", accent: "#b85d35" },

  { id: "barrett_m82", name: "Barrett M82 (.50 BMG)", bonusPct: 60, price: 9000, tier: "Heavy", label: "Legend", accent: "#ad4d2f" },
  { id: "m134", name: "M134 Minigun (7.62×51)", bonusPct: 70, price: 12000, tier: "Heavy", label: "Legend", accent: "#ad4d2f" },
];

export class WeaponsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = [];
    this.toastText = "";
    this.toastUntil = 0;
  }

  onEnter() {
    this._ensureWeaponsState();
    this._syncFromEquipped();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hit = [];
  }

  onExit() {
    this.dragging = false;
  }

  _safeRect(w, h) {
    const s = this.store.get();
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    return {
      x: safe.x + 10,
      y: safe.y + topReserved,
      w: safe.w - 20,
      h: safe.h - topReserved - bottomReserved - 10,
    };
  }

  _showToast(text, ms = 1500) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _ensureWeaponsState() {
    const s = this.store.get();
    const player = s.player || {};
    const weapons = s.weapons || {};

    this.store.set({
      player: {
        ...player,
        weaponName: player.weaponName || "Silah Yok",
        weaponBonus: player.weaponBonus || "+0%",
        weaponIconBonusPct: Number(player.weaponIconBonusPct || 0),
        weaponIconVisibleMs: Number(player.weaponIconVisibleMs || 500),
        weaponTickSlowFactor: Number(player.weaponTickSlowFactor || 1),
        weaponTimeScale: Number(player.weaponTimeScale || 1),
      },
      weapons: {
        owned: weapons.owned || {},
        equippedId: weapons.equippedId || null,
      },
    });
  }

  _getCoins() {
    return Number(this.store.get()?.coins || 0);
  }

  _setCoins(nextCoins) {
    this.store.set({ coins: Math.max(0, Math.floor(Number(nextCoins) || 0)) });
  }

  _currentWeaponsState() {
    const s = this.store.get();
    return s.weapons || { owned: {}, equippedId: null };
  }

  _currentEquippedItem() {
    const w = this._currentWeaponsState();
    return WEAPONS.find((x) => x.id === w.equippedId) || null;
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
          weaponIconVisibleMs: 500,
          weaponTickSlowFactor: 1,
          weaponTimeScale: 1,
        },
      });
      return;
    }

    const pct = Number(itemOrNull.bonusPct || 0);
    const visibleMs = iconMsFromPct(pct, 500);
    const slowFactor = Number((1 + pct / 100).toFixed(2));

    this.store.set({
      player: {
        ...p,
        weaponName: itemOrNull.name,
        weaponBonus: `+%${pct}`,
        weaponIconBonusPct: pct,
        weaponIconVisibleMs: visibleMs,
        weaponTickSlowFactor: slowFactor,
        weaponTimeScale: slowFactor,
      },
    });
  }

  _syncFromEquipped() {
    this._ensureWeaponsState();
    this._applyEquippedToPlayer(this._currentEquippedItem());
  }

  _buyOrEquip(weaponId) {
    this._ensureWeaponsState();

    const s = this.store.get();
    const weapons = s.weapons || { owned: {}, equippedId: null };
    const item = WEAPONS.find((x) => x.id === weaponId);
    if (!item) return;

    const owned = !!weapons.owned?.[weaponId];

    if (!owned) {
      const coins = this._getCoins();
      if (coins < item.price) {
        this._showToast("Yetersiz yton");
        return;
      }

      this._setCoins(coins - item.price);

      this.store.set({
        weapons: {
          owned: { ...(weapons.owned || {}), [weaponId]: true },
          equippedId: weaponId,
        },
      });

      this._applyEquippedToPlayer(item);
      this._showToast(`${item.name} satın alındı ve kuşanıldı`);
      return;
    }

    if (weapons.equippedId === weaponId) {
      this._showToast("Bu silah zaten seçili");
      return;
    }

    this.store.set({
      weapons: {
        owned: { ...(weapons.owned || {}) },
        equippedId: weaponId,
      },
    });

    this._applyEquippedToPlayer(item);
    this._showToast(`${item.name} kuşanıldı`);
  }

  _unequip() {
    this._ensureWeaponsState();

    const weapons = this._currentWeaponsState();
    if (!weapons.equippedId) {
      this._showToast("Zaten silah seçili değil");
      return;
    }

    this.store.set({
      weapons: {
        owned: { ...(weapons.owned || {}) },
        equippedId: null,
      },
    });

    this._applyEquippedToPlayer(null);
    this._showToast("Silah çıkarıldı");
  }

  update() {
    const p = this.input.pointer || { x: 0, y: 0 };

    if (this.input.justPressed()) {
      this.dragging = true;
      this.downY = p.y;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input.isDown()) {
      const dy = p.y - this.downY;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input.justReleased()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      for (let i = this.hit.length - 1; i >= 0; i--) {
        const h = this.hit[i];
        if (!pointInRect(p.x, p.y, h.rect)) continue;

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

  render(ctx, w, h) {
    const s = this.store.get();
    const safe = this._safeRect(w, h);
    const isMobile = safe.w <= 520;
    const isTiny = safe.w <= 400;
    const weaponsState = s.weapons || { owned: {}, equippedId: null };
    const equipped = this._currentEquippedItem();

    const bg =
      getImgSafe(this.assets, "weapons_bg") ||
      getImgSafe(this.assets, "weapons") ||
      getImgSafe(this.assets, "background");

    ctx.clearRect(0, 0, w, h);

    if (bg) {
      coverImage(ctx, bg, 0, 0, w, h, 1);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    const bgOverlay = ctx.createLinearGradient(0, 0, 0, h);
    bgOverlay.addColorStop(0, "rgba(6,6,9,0.40)");
    bgOverlay.addColorStop(0.35, "rgba(8,7,6,0.55)");
    bgOverlay.addColorStop(1, "rgba(4,4,5,0.78)");
    ctx.fillStyle = bgOverlay;
    ctx.fillRect(0, 0, w, h);

    this.hit = [];

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    ctx.fillStyle = "rgba(8,8,10,0.24)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 22);
    ctx.strokeStyle = "rgba(255,194,96,0.22)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 22);

    const headerH = isTiny ? 112 : 122;
    const infoH = isTiny ? 66 : (isMobile ? 74 : 84);
    const footerH = isTiny ? 58 : 64;
    const listGap = 10;

    const headerRect = { x: panelX + 10, y: panelY + 10, w: panelW - 20, h: headerH };
    const infoRect = { x: panelX + 10, y: headerRect.y + headerRect.h + 10, w: panelW - 20, h: infoH };
    const listRect = {
      x: panelX + 10,
      y: infoRect.y + infoRect.h + 10,
      w: panelW - 20,
      h: Math.max(140, panelH - headerH - infoH - footerH - 50),
    };
    const footerRect = {
      x: panelX + 10,
      y: listRect.y + listRect.h + 10,
      w: panelW - 20,
      h: footerH,
    };

    const glassFill = "rgba(12,12,15,0.46)";
    const glassStroke = "rgba(255,255,255,0.10)";

    ctx.fillStyle = glassFill;
    fillRoundRect(ctx, headerRect.x, headerRect.y, headerRect.w, headerRect.h, 20);
    ctx.strokeStyle = glassStroke;
    strokeRoundRect(ctx, headerRect.x + 0.5, headerRect.y + 0.5, headerRect.w - 1, headerRect.h - 1, 20);

    ctx.fillStyle = glassFill;
    fillRoundRect(ctx, infoRect.x, infoRect.y, infoRect.w, infoRect.h, 18);
    ctx.strokeStyle = glassStroke;
    strokeRoundRect(ctx, infoRect.x + 0.5, infoRect.y + 0.5, infoRect.w - 1, infoRect.h - 1, 18);

    ctx.fillStyle = "rgba(10,10,12,0.50)";
    fillRoundRect(ctx, listRect.x, listRect.y, listRect.w, listRect.h, 18);
    ctx.strokeStyle = "rgba(255,194,96,0.18)";
    strokeRoundRect(ctx, listRect.x + 0.5, listRect.y + 0.5, listRect.w - 1, listRect.h - 1, 18);

    ctx.fillStyle = glassFill;
    fillRoundRect(ctx, footerRect.x, footerRect.y, footerRect.w, footerRect.h, 18);
    ctx.strokeStyle = glassStroke;
    strokeRoundRect(ctx, footerRect.x + 0.5, footerRect.y + 0.5, footerRect.w - 1, footerRect.h - 1, 18);

    const backW = isTiny ? 76 : 84;
    const backH = 34;
    const backRect = { x: headerRect.x + 10, y: headerRect.y + 10, w: backW, h: backH };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 12);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Geri", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2);
    this.hit.push({ type: "back", rect: backRect });

    const coinW = isTiny ? 92 : 112;
    const coinH = 34;
    const coinRect = {
      x: headerRect.x + headerRect.w - coinW - 10,
      y: headerRect.y + 10,
      w: coinW,
      h: coinH,
    };
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    fillRoundRect(ctx, coinRect.x, coinRect.y, coinRect.w, coinRect.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, coinRect.x + 0.5, coinRect.y + 0.5, coinRect.w - 1, coinRect.h - 1, 12);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
    ctx.fillText(`${shortNum(s.coins || 0)} yton`, coinRect.x + coinRect.w / 2, coinRect.y + coinRect.h / 2);

    const titleX = backRect.x;
    const titleY = headerRect.y + 58;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `900 ${isTiny ? 18 : 22}px system-ui`;
    ctx.fillText("PvP • Silah Seç", titleX, titleY);

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = `${isTiny ? 11 : 12}px system-ui`;
    const headerTextMaxW = headerRect.w - 24;
    const headerDescLines = wrapLines(
      ctx,
      "Silah bonusu tüm PvP ikon sürelerini yavaşlatır ve avantaj sağlar.",
      headerTextMaxW,
      isTiny ? 2 : 1
    );
    const headerLineH = isTiny ? 14 : 15;
    for (let i = 0; i < headerDescLines.length; i++) {
      ctx.fillText(headerDescLines[i], titleX, titleY + 24 + i * headerLineH);
    }

    const heroTag1 = { x: titleX, y: titleY + 34 + headerDescLines.length * headerLineH, w: isTiny ? 104 : 116, h: 28 };
    const heroTag2 = { x: heroTag1.x + heroTag1.w + 8, y: heroTag1.y, w: isTiny ? 132 : 156, h: 28 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, heroTag1.x, heroTag1.y, heroTag1.w, heroTag1.h, 14);
    fillRoundRect(ctx, heroTag2.x, heroTag2.y, heroTag2.w, heroTag2.h, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    strokeRoundRect(ctx, heroTag1.x + 0.5, heroTag1.y + 0.5, heroTag1.w - 1, heroTag1.h - 1, 14);
    strokeRoundRect(ctx, heroTag2.x + 0.5, heroTag2.y + 0.5, heroTag2.w - 1, heroTag2.h - 1, 14);
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${isTiny ? 10 : 11}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PvP merkezi", heroTag1.x + heroTag1.w / 2, heroTag1.y + heroTag1.h / 2);
    ctx.fillText("İkon süresi yavaşlatma", heroTag2.x + heroTag2.w / 2, heroTag2.y + heroTag2.h / 2);

    const effectPct = Number(s.player?.weaponIconBonusPct || 0);
    const effectMs = Number(s.player?.weaponIconVisibleMs || iconMsFromPct(effectPct));
    const effectSlow = Number(s.player?.weaponTickSlowFactor || 1);

    const unW = isTiny ? 92 : 104;
    const unH = 34;
    const unRect = { x: infoRect.x + infoRect.w - unW - 12, y: infoRect.y + infoRect.h / 2 - unH / 2, w: unW, h: unH };
    const infoTextX = infoRect.x + 14;
    const infoTextMaxW = Math.max(120, unRect.x - infoTextX - 12);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    const equippedTitle = equipped ? equipped.name : "Silah seçili değil";
    const equippedTitleSize = fitText(ctx, equippedTitle, infoTextMaxW, isTiny ? 14 : 15, 11, 900);
    ctx.font = `900 ${equippedTitleSize}px system-ui`;
    ctx.fillText(equippedTitle, infoTextX, infoRect.y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = `${isTiny ? 10 : 11}px system-ui`;
    const infoLine = `Aktif bonus: +%${effectPct} • ikon ~${effectMs}ms • zaman x${effectSlow.toFixed(2)}`;
    const infoLines = wrapLines(ctx, infoLine, infoTextMaxW, isTiny ? 2 : 1);
    const infoBaseY = infoRect.y + (isTiny ? 42 : 46);
    const infoLineH = isTiny ? 13 : 14;
    for (let i = 0; i < infoLines.length; i++) {
      ctx.fillText(infoLines[i], infoTextX, infoBaseY + i * infoLineH);
    }
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, unRect.x, unRect.y, unRect.w, unRect.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, unRect.x + 0.5, unRect.y + 0.5, unRect.w - 1, unRect.h - 1, 12);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Silah Çıkar", unRect.x + unRect.w / 2, unRect.y + unRect.h / 2);
    this.hit.push({ type: "unequip", rect: unRect });

    const rowGap = 10;
    const rowH = isTiny ? 108 : 112;
    const contentH = WEAPONS.length * rowH + (WEAPONS.length - 1) * rowGap + 20;
    this.maxScroll = Math.max(0, contentH - listRect.h + 10);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    roundRectPath(ctx, listRect.x, listRect.y, listRect.w, listRect.h, 18);
    ctx.clip();

    let y = listRect.y + 10 - this.scrollY;
    for (const item of WEAPONS) {
      const owned = !!weaponsState.owned?.[item.id];
      const active = weaponsState.equippedId === item.id;

      const rowRect = { x: listRect.x + 10, y, w: listRect.w - 20, h: rowH };
      const rowGradient = ctx.createLinearGradient(rowRect.x, rowRect.y, rowRect.x + rowRect.w, rowRect.y + rowRect.h);
      rowGradient.addColorStop(0, active ? "rgba(255,194,96,0.16)" : "rgba(0,0,0,0.22)");
      rowGradient.addColorStop(1, active ? "rgba(255,140,66,0.14)" : "rgba(255,255,255,0.03)");
      ctx.fillStyle = rowGradient;
      fillRoundRect(ctx, rowRect.x, rowRect.y, rowRect.w, rowRect.h, 16);
      ctx.strokeStyle = active ? "rgba(255,194,96,0.34)" : "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w - 1, rowRect.h - 1, 16);

      const tagRect = { x: rowRect.x + 12, y: rowRect.y + 12, w: isTiny ? 78 : 88, h: 22 };
      ctx.fillStyle = `${item.accent}33`;
      fillRoundRect(ctx, tagRect.x, tagRect.y, tagRect.w, tagRect.h, 11);
      ctx.strokeStyle = `${item.accent}88`;
      strokeRoundRect(ctx, tagRect.x + 0.5, tagRect.y + 0.5, tagRect.w - 1, tagRect.h - 1, 11);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${isTiny ? 9 : 10}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.tier, tagRect.x + tagRect.w / 2, tagRect.y + tagRect.h / 2);

      const btnW = isTiny ? 92 : 108;
      const btnH = 36;
      const btnRect = {
        x: rowRect.x + rowRect.w - btnW - 12,
        y: rowRect.y + rowRect.h / 2 - btnH / 2,
        w: btnW,
        h: btnH,
      };

      const textMaxW = btnRect.x - (rowRect.x + 12) - 12;
      const nameSize = fitText(ctx, item.name, textMaxW, isTiny ? 14 : 15, 11, 900);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${nameSize}px system-ui`;
      ctx.fillText(item.name, rowRect.x + 12, rowRect.y + 52);

      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = `${isTiny ? 11 : 12}px system-ui`;
      ctx.fillText(`Güç: +%${item.bonusPct}  (ikon ~${iconMsFromPct(item.bonusPct)}ms)`, rowRect.x + 12, rowRect.y + 76);
      ctx.fillText(`Fiyat: ${shortNum(item.price)} yton  •  ${item.label}`, rowRect.x + 12, rowRect.y + 96);

      const btnGrad = ctx.createLinearGradient(btnRect.x, btnRect.y, btnRect.x, btnRect.y + btnRect.h);
      if (!owned) {
        btnGrad.addColorStop(0, "rgba(174,128,56,0.95)");
        btnGrad.addColorStop(1, "rgba(95,69,29,0.92)");
      } else if (active) {
        btnGrad.addColorStop(0, "rgba(100,100,110,0.92)");
        btnGrad.addColorStop(1, "rgba(46,46,52,0.92)");
      } else {
        btnGrad.addColorStop(0, "rgba(88,88,96,0.92)");
        btnGrad.addColorStop(1, "rgba(34,34,40,0.92)");
      }

      ctx.fillStyle = btnGrad;
      fillRoundRect(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      strokeRoundRect(ctx, btnRect.x + 0.5, btnRect.y + 0.5, btnRect.w - 1, btnRect.h - 1, 12);

      ctx.fillStyle = "#fff";
      ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(!owned ? "Satın Al" : active ? "Seçili" : "Kuşan", btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);

      this.hit.push({ type: "action", id: item.id, rect: btnRect });

      y += rowH + rowGap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = listRect.x + listRect.w - 6;
      const trackY = listRect.y + 8;
      const trackH = listRect.h - 16;
      const thumbH = Math.max(40, trackH * (listRect.h / contentH));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, trackX, trackY, 4, trackH, 2);
      ctx.fillStyle = "rgba(255,185,84,0.86)";
      fillRoundRect(ctx, trackX, thumbY, 4, thumbH, 2);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `900 ${isTiny ? 13 : 14}px system-ui`;
    ctx.fillText(`Aktif Etki: 500ms → ${effectMs}ms  (+%${effectPct})`, footerRect.x + 12, footerRect.y + 26);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = `${isTiny ? 10 : 12}px system-ui`;
    const footerText = isTiny ? "Mobil kaydırma aktif." : "PvP sahnesi mantığı gibi panel + kart düzeni kullanıldı. Mobil kaydırma aktif.";
    ctx.fillText(footerText, footerRect.x + 12, footerRect.y + 48);

    if (this.toastText && Date.now() < this.toastUntil) {
      ctx.font = "900 12px system-ui";
      const tw = Math.min(panelW - 40, Math.max(180, ctx.measureText(this.toastText).width + 34));
      const th = 40;
      const tx = panelX + (panelW - tw) / 2;
      const ty = footerRect.y - th - 10;

      ctx.fillStyle = "rgba(0,0,0,0.82)";
      fillRoundRect(ctx, tx, ty, tw, th, 12);
      ctx.strokeStyle = "rgba(255,194,96,0.30)";
      strokeRoundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, th - 1, 12);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2);
    }
  }
}
