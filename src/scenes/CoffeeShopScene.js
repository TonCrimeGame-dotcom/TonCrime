// src/scenes/CoffeeShopScene.js

const ITEMS = [
  { id: "amnesia_haze", name: "Amnesia Haze", price: 10, energy: 3, rarity: "common" },
  { id: "white_widow", name: "White Widow", price: 12, energy: 4, rarity: "common" },
  { id: "northern_lights", name: "Northern Lights", price: 14, energy: 5, rarity: "common" },
  { id: "super_skunk", name: "Super Skunk", price: 16, energy: 6, rarity: "common" },
  { id: "purple_haze", name: "Purple Haze", price: 18, energy: 7, rarity: "common" },
  { id: "orange_bud", name: "Orange Bud", price: 20, energy: 8, rarity: "common" },
  { id: "blue_dream", name: "Blue Dream", price: 22, energy: 9, rarity: "rare" },
  { id: "gelato", name: "Gelato", price: 24, energy: 10, rarity: "rare" },
  { id: "gorilla_glue", name: "Gorilla Glue", price: 26, energy: 11, rarity: "rare" },
  { id: "green_crack", name: "Green Crack", price: 28, energy: 12, rarity: "rare" },

  { id: "ak47", name: "AK-47", price: 30, energy: 13, rarity: "rare" },
  { id: "super_silver", name: "Super Silver Haze", price: 32, energy: 14, rarity: "rare" },
  { id: "jack_herer", name: "Jack Herer", price: 34, energy: 15, rarity: "rare" },
  { id: "og_kush", name: "OG Kush", price: 36, energy: 16, rarity: "epic" },
  { id: "girl_scout", name: "Girl Scout Cookies", price: 38, energy: 17, rarity: "epic" },
  { id: "sour_diesel", name: "Sour Diesel", price: 40, energy: 18, rarity: "epic" },
  { id: "zkittlez", name: "Zkittlez", price: 42, energy: 19, rarity: "epic" },
  { id: "wedding_cake", name: "Wedding Cake", price: 44, energy: 20, rarity: "epic" },
  { id: "banana_kush", name: "Banana Kush", price: 46, energy: 21, rarity: "epic" },
  { id: "mimosa", name: "Mimosa", price: 48, energy: 22, rarity: "epic" },

  { id: "choco_haze", name: "Choco Haze", price: 50, energy: 23, rarity: "epic" },
  { id: "rainbow_belts", name: "Rainbow Belts", price: 53, energy: 24, rarity: "epic" },
  { id: "moon_rocks", name: "Moon Rocks", price: 56, energy: 25, rarity: "legendary" },
  { id: "ice_hash", name: "Ice Hash", price: 59, energy: 26, rarity: "legendary" },
  { id: "amsterdam_gold", name: "Amsterdam Gold", price: 62, energy: 27, rarity: "legendary" },
  { id: "black_tuna", name: "Black Tuna", price: 65, energy: 28, rarity: "legendary" },
  { id: "platinum_kush", name: "Platinum Kush", price: 68, energy: 29, rarity: "legendary" },
  { id: "ghost_train", name: "Ghost Train Haze", price: 71, energy: 30, rarity: "legendary" },
  { id: "diamond_resin", name: "Diamond Resin", price: 75, energy: 32, rarity: "legendary" },
  { id: "dam_crown", name: "Dam Crown", price: 80, energy: 35, rarity: "legendary" },
];

const VISITOR_POOL = [
  { id: "v1", name: "Rico", tier: "Sokak", power: 8, rewardMin: 8, rewardMax: 18, avatar: "😎" },
  { id: "v2", name: "Varga", tier: "Sokak", power: 10, rewardMin: 10, rewardMax: 20, avatar: "🧥" },
  { id: "v3", name: "Niko", tier: "Kulüp", power: 13, rewardMin: 14, rewardMax: 24, avatar: "💨" },
  { id: "v4", name: "Milan", tier: "Kulüp", power: 15, rewardMin: 15, rewardMax: 28, avatar: "🕶️" },
  { id: "v5", name: "Sergio", tier: "VIP", power: 18, rewardMin: 20, rewardMax: 34, avatar: "💼" },
  { id: "v6", name: "Dante", tier: "VIP", power: 21, rewardMin: 24, rewardMax: 40, avatar: "🔥" },
  { id: "v7", name: "Klaus", tier: "Elite", power: 24, rewardMin: 28, rewardMax: 46, avatar: "👑" },
  { id: "v8", name: "Roman", tier: "Elite", power: 26, rewardMin: 30, rewardMax: 52, avatar: "💣" },
];

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common":
      return "#9ca3af";
    case "rare":
      return "#58a6ff";
    case "epic":
      return "#c77dff";
    case "legendary":
      return "#ffcc66";
    default:
      return "#9ca3af";
  }
}

function randInt(min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function chance(v) {
  return Math.random() < v;
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

export class CoffeeShopScene {
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
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hitButtons = [];
    this.backHit = null;

    this.toastText = "";
    this.toastUntil = 0;

    this.music = null;
    this.musicStarted = false;

    this.smoke = [];
    this.jointFx = [];

    this.blurUntil = 0;
    this.slowUntil = 0;
    this.flashUntil = 0;
    this.lastFrameAt = 0;
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hitButtons = [];
    this.backHit = null;
    this.toastText = "";
    this.toastUntil = 0;
    this.blurUntil = 0;
    this.slowUntil = 0;
    this.flashUntil = 0;
    this.lastFrameAt = performance.now();

    this._ensureState();
    this._seedSmoke(20);
    this._ensureMusic();
  }

  onExit() {
    this.dragging = false;
    if (this.music) {
      try {
        this.music.pause();
      } catch (_) {}
    }
  }

  _ensureState() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const missions = s.missions || {};
    const inventory = s.inventory || {};
    const cs = s.coffeeshop || {};

    const visitors =
      Array.isArray(cs.visitors) && cs.visitors.length
        ? cs.visitors
        : this._freshVisitors();

   

  _freshVisitors() {
    const shuffled = [...VISITOR_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4).map((v) => ({
      ...v,
      hp: 100,
      mood: ["Calm", "High", "Aggro", "Watching"][randInt(0, 3)],
      online: true,
    }));
  }

  _playerName() {
    const s = this.store.get() || {};
    return String(s.player?.username || "Player");
  }

  _ensureMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;

    try {
      this.music = new Audio("./src/assets/reggae.mp3");
      this.music.loop = true;
      this.music.volume = 0.28;

      const play = () => {
        if (!this.music) return;
        this.music.play().catch(() => {});
        window.removeEventListener("pointerdown", play);
        window.removeEventListener("touchstart", play);
        window.removeEventListener("click", play);
      };

      window.addEventListener("pointerdown", play, { passive: true, once: true });
      window.addEventListener("touchstart", play, { passive: true, once: true });
      window.addEventListener("click", play, { passive: true, once: true });
    } catch (_) {}
  }

  _safeRect() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _getBg() {
    if (typeof this.assets?.getImage === "function") {
      return this.assets.getImage("coffeeshop_bg") || this.assets.getImage("coffeeshop");
    }
    if (typeof this.assets?.get === "function") {
      return this.assets.get("coffeeshop_bg") || this.assets.get("coffeeshop");
    }
    return this.assets?.images?.coffeeshop_bg || this.assets?.images?.coffeeshop || null;
  }

  _rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(x, y, w, h);
      return;
    }

    const iw = img.width || 1;
    const ih = img.height || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  _showToast(text, ms = 1600) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _seedSmoke(count) {
    this.smoke = [];
    const safe = this._safeRect();

    for (let i = 0; i < count; i++) {
      this.smoke.push({
        x: safe.x + Math.random() * safe.w,
        y: safe.y + Math.random() * safe.h,
        r: 18 + Math.random() * 42,
        alpha: 0.05 + Math.random() * 0.08,
        vx: -0.12 + Math.random() * 0.24,
        vy: -0.15 - Math.random() * 0.3,
        life: 0.4 + Math.random() * 1.1,
      });
    }
  }

  _spawnSmokeBurst(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      this.smoke.push({
        x,
        y,
        r: 12 + Math.random() * 20,
        alpha: 0.12 + Math.random() * 0.10,
        vx: -0.4 + Math.random() * 0.8,
        vy: -0.7 - Math.random() * 0.7,
        life: 0.8 + Math.random() * 1.2,
      });
    }
  }

  _spawnJointFx(x, y) {
    this.jointFx.push({
      x,
      y,
      vy: -0.55,
      life: 1,
      rot: -0.12 + Math.random() * 0.24,
      scale: 1.05 + Math.random() * 0.18,
    });
  }

  _updateFx() {
    const now = performance.now();
    let dt = this.lastFrameAt ? (now - this.lastFrameAt) / 16.6667 : 1;
    this.lastFrameAt = now;
    dt = clamp(dt, 0.4, 2.2);

    if (Date.now() < this.slowUntil) dt *= 0.45;

    const safe = this._safeRect();

    for (const s of this.smoke) {
      s.x += s.vx * dt * 2.2;
      s.y += s.vy * dt * 2.2;
      s.r += 0.04 * dt * 10;
      s.life -= 0.0038 * dt * 10;

      if (s.life <= 0 || s.y + s.r < safe.y - 30) {
        s.x = safe.x + Math.random() * safe.w;
        s.y = safe.y + safe.h + Math.random() * 24;
        s.r = 18 + Math.random() * 42;
        s.alpha = 0.05 + Math.random() * 0.08;
        s.vx = -0.12 + Math.random() * 0.24;
        s.vy = -0.15 - Math.random() * 0.3;
        s.life = 0.6 + Math.random() * 1.1;
      }
    }

    for (let i = this.jointFx.length - 1; i >= 0; i--) {
      const fx = this.jointFx[i];
      fx.y += fx.vy * dt * 3.5;
      fx.life -= 0.012 * dt;
      if (fx.life <= 0) this.jointFx.splice(i, 1);
    }
  }

  _applyToleranceEnergy(itemEnergy, uses) {
    if (uses < 10) return itemEnergy;
    return Math.max(1, Math.floor(itemEnergy * 0.7));
  }

  _gainXp(amount) {
    const s = this.store.get();
    const p = { ...(s.player || {}) };

    let xp = Number(p.xp || 0) + Number(amount || 0);
    let level = Math.max(1, Number(p.level || 1));
    let xpToNext = Math.max(100, Number(p.xpToNext || 100));

    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
    }

    this.store.set({
      player: {
        ...p,
        xp,
        level,
        xpToNext,
      },
    });
  }

  _addInventoryItem(item) {
    const s = this.store.get();
    const inv = (s.inventory?.items || []).map((x) => ({ ...x }));

    const existing = inv.find(
      (x) =>
        String(x.name || "").toLowerCase() === String(item.name || "").toLowerCase() &&
        String(x.kind || "") === String(item.kind || "")
    );

    if (existing) {
      existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
    } else {
      inv.unshift({
        id: item.id || makeId("inv"),
        kind: item.kind || "goods",
        icon: item.icon || "📦",
        name: item.name || "Item",
        rarity: item.rarity || "common",
        qty: Number(item.qty || 1),
        usable: !!item.usable,
        sellable: item.sellable !== false,
        marketable: item.marketable !== false,
        energyGain: Number(item.energyGain || 0),
        sellPrice: Number(item.sellPrice || 0),
        marketPrice: Number(item.marketPrice || 0),
        desc: item.desc || "",
        source: item.source || "coffeeshop",
      });
    }

    this.store.set({
      inventory: {
        ...(s.inventory || {}),
        items: inv,
      },
    });
  }

  _makeWeedInventoryItem(item) {
    return {
      id: makeId("weed"),
      kind: "goods",
      icon: "🌿",
      name: item.name,
      rarity: item.rarity || "common",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: Number(item.energy || 0),
      sellPrice: Math.max(1, Math.floor(Number(item.price || 0) * 0.65)),
      marketPrice: Number(item.price || 0),
      desc: "Coffeeshop ürünü. İster kullan ister pazarda sat.",
      source: "coffeeshop",
    };
  }

  _giftPool() {
    return [
      {
        kind: "girls",
        icon: "💋",
        name: "VIP Girl",
        rarity: "epic",
        qty: 1,
        usable: true,
        sellable: true,
        marketable: true,
        energyGain: 22,
        sellPrice: 65,
        marketPrice: 92,
        desc: "İçeride tanıştığın özel hediye.",
        source: "coffeeshop_gift",
      },
      {
        kind: "consumable",
        icon: "🍾",
        name: "Premium Champagne",
        rarity: "rare",
        qty: 1,
        usable: true,
        sellable: true,
        marketable: true,
        energyGain: 14,
        sellPrice: 28,
        marketPrice: 44,
        desc: "İçeriden gelen alkollü hediye.",
        source: "coffeeshop_gift",
      },
      {
        kind: "goods",
        icon: "🌿",
        name: "Moon Rocks",
        rarity: "rare",
        qty: 1,
        usable: true,
        sellable: true,
        marketable: true,
        energyGain: 18,
        sellPrice: 22,
        marketPrice: 34,
        desc: "İçeridekilerden gelen ot hediyesi.",
        source: "coffeeshop_gift",
      },
      {
        kind: "rare",
        icon: "📦",
        name: "Mystery Crate",
        rarity: "legendary",
        qty: 1,
        usable: false,
        sellable: true,
        marketable: true,
        energyGain: 0,
        sellPrice: 55,
        marketPrice: 78,
        desc: "Rastgele içerik veren kasa hediyesi.",
        source: "coffeeshop_gift",
      },
    ];
  }

  _maybeGift() {
    if (!chance(0.30)) return null;

    const gift = this._giftPool()[randInt(0, this._giftPool().length - 1)];
    this._addInventoryItem({ ...gift, id: makeId("gift") });

    const s = this.store.get();
    const cs = s.coffeeshop || {};

    this.store.set({
      coffeeshop: {
        ...cs,
        giftsClaimed: Number(cs.giftsClaimed || 0) + 1,
      },
    });

    return gift;
  }

  _applySecurityBeat() {
    if (!chance(0.30)) return null;

    const s = this.store.get();
    const p = s.player || {};
    const cs = s.coffeeshop || {};

    const coinLoss = Math.min(Number(s.coins || 0), randInt(6, 24));
    const energyLoss = Math.min(Number(p.energy || 0), randInt(5, 16));

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - coinLoss),
      player: {
        ...p,
        energy: Math.max(0, Number(p.energy || 0) - energyLoss),
      },
      coffeeshop: {
        ...cs,
        securityHits: Number(cs.securityHits || 0) + 1,
      },
    });

    this.blurUntil = Date.now() + 2200;
    this.slowUntil = Date.now() + 1500;
    this.flashUntil = Date.now() + 220;

    return { coinLoss, energyLoss };
  }

  _buyUse(item, hitRect = null) {
    const s = this.store.get();
    const coins = Number(s.coins || 0);
    const p = s.player || {};
    const cs = s.coffeeshop || {};

    if (coins < Number(item.price || 0)) {
      this._showToast("Yetersiz yton");
      return;
    }

    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    let usedFromShop = true;
    let toast = "";

    const uses = Number(p.coffeeshopUses || 0) + 1;
    const tolerant = uses >= 10;
    const adjustedEnergy = this._applyToleranceEnergy(Number(item.energy || 0), uses);

    if (energy >= energyMax) {
      usedFromShop = false;

      this.store.set({
        coins: coins - Number(item.price || 0),
        player: {
          ...p,
          coffeeshopUses: uses,
          coffeeshopTolerance: tolerant ? 1 : 0,
        },
        coffeeshop: {
          ...cs,
          totalSpent: Number(cs.totalSpent || 0) + Number(item.price || 0),
          totalBought: Number(cs.totalBought || 0) + 1,
        },
      });

      this._addInventoryItem(this._makeWeedInventoryItem(item));
      toast = "Enerji full, ürün envantere eklendi.";
    } else {
      const gain = Math.min(adjustedEnergy, energyMax - energy);

      this.store.set({
        coins: coins - Number(item.price || 0),
        player: {
          ...p,
          energy: energy + gain,
          coffeeshopUses: uses,
          coffeeshopTolerance: tolerant ? 1 : 0,
        },
        coffeeshop: {
          ...cs,
          totalSpent: Number(cs.totalSpent || 0) + Number(item.price || 0),
          totalBought: Number(cs.totalBought || 0) + 1,
        },
      });

      toast = tolerant
        ? `Bağışıklık aktif: +${gain} enerji`
        : `+${gain} enerji / -${item.price} yton`;
    }

    if (hitRect) {
      this._spawnJointFx(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.45);
      this._spawnSmokeBurst(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.45, 6);
    }

    const gift = this._maybeGift();
    const beat = this._applySecurityBeat();

    if (gift && beat) {
      this._showToast(
        `🎁 ${gift.name} geldi ama güvenlik dövdü: -${beat.energyLoss} enerji / -${beat.coinLoss} yton`,
        2400
      );
    } else if (gift) {
      this._showToast(`🎁 Hediye geldi: ${gift.name}`, 2200);
    } else if (beat) {
      this._showToast(
        `Güvenliklerden dayak yedin! -${beat.energyLoss} enerji / -${beat.coinLoss} yton`,
        2200
      );
    } else {
      this._showToast(toast, usedFromShop ? 1600 : 1800);
    }
  }

  _buyInventory(item, hitRect = null) {
    const s = this.store.get();
    const coins = Number(s.coins || 0);
    const p = s.player || {};
    const cs = s.coffeeshop || {};

    if (coins < Number(item.price || 0)) {
      this._showToast("Yetersiz yton");
      return;
    }

    this.store.set({
      coins: coins - Number(item.price || 0),
      coffeeshop: {
        ...cs,
        totalSpent: Number(cs.totalSpent || 0) + Number(item.price || 0),
        totalBought: Number(cs.totalBought || 0) + 1,
      },
      player: {
        ...p,
      },
    });

    this._addInventoryItem(this._makeWeedInventoryItem(item));

    if (hitRect) {
      this._spawnJointFx(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.45);
      this._spawnSmokeBurst(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.45, 5);
    }

    const gift = this._maybeGift();
    const beat = this._applySecurityBeat();

    if (gift && beat) {
      this._showToast(
        `🌿 Envantere eklendi. 🎁 ${gift.name} geldi ama dayak yedin.`,
        2400
      );
    } else if (gift) {
      this._showToast(`🌿 Envantere eklendi. 🎁 ${gift.name} hediyesi geldi.`, 2200);
    } else if (beat) {
      this._showToast(
        `Envantere eklendi ama güvenlik dövdü: -${beat.energyLoss} enerji / -${beat.coinLoss} yton`,
        2200
      );
    } else {
      this._showToast("Ürün envantere eklendi", 1800);
    }
  }

  _recordCoffeeshopPvp(visitor, didWin, scoreDelta, rewardCoins) {
    const s = this.store.get();
    const p = s.player || {};
    const missions = s.missions || {};
    const cs = s.coffeeshop || {};
    const playerName = this._playerName();

    const playerPatch = {
      ...p,
      pvpPlayed: Number(p.pvpPlayed || 0) + 1,
      coffeeshopPvpPlayed: Number(p.coffeeshopPvpPlayed || 0) + 1,
      coffeeshopScore: Number(p.coffeeshopScore || 0) + Number(scoreDelta || 0),
      pvpWins: Number(p.pvpWins || 0) + (didWin ? 1 : 0),
      pvpLosses: Number(p.pvpLosses || 0) + (didWin ? 0 : 1),
      coffeeshopPvpWins: Number(p.coffeeshopPvpWins || 0) + (didWin ? 1 : 0),
      coffeeshopPvpLosses: Number(p.coffeeshopPvpLosses || 0) + (didWin ? 0 : 1),
    };

    
  _attackVisitor(visitor, hitRect = null) {
    const s = this.store.get();
    const p = s.player || {};
    const cs = s.coffeeshop || {};

    const attackCost = 6;
    const curEnergy = Number(p.energy || 0);

    if (curEnergy < attackCost) {
      this._showToast(`PvP için ${attackCost} enerji lazım`);
      return;
    }

    let winChance = 0.48 + Number(p.level || 1) * 0.004 - Number(visitor.power || 0) * 0.006;
    winChance = clamp(winChance, 0.20, 0.82);

    const didWin = Math.random() < winChance;
    const scoreGain = didWin ? randInt(16, 34) : -randInt(6, 14);

    let nextCoins = Number(s.coins || 0);
    let nextEnergy = Math.max(0, curEnergy - attackCost);
    let rewardCoins = 0;
    let loseCoins = 0;

    if (didWin) {
      rewardCoins = randInt(visitor.rewardMin || 8, visitor.rewardMax || 20);
      nextCoins += rewardCoins;
      this._gainXp(randInt(8, 16));
      this.flashUntil = Date.now() + 180;
      this._showToast(
        `⚔️ ${visitor.name} yenildi! +${rewardCoins} yton / skor +${scoreGain}`,
        2200
      );
    } else {
      const extraEnergyLoss = randInt(4, 11);
      loseCoins = Math.min(nextCoins, randInt(4, 18));
      nextCoins = Math.max(0, nextCoins - loseCoins);
      nextEnergy = Math.max(0, nextEnergy - extraEnergyLoss);
      this.blurUntil = Date.now() + 1400;
      this.slowUntil = Date.now() + 900;
      this._showToast(
        `💥 ${visitor.name} seni dağıttı! -${loseCoins} yton / -${extraEnergyLoss} enerji`,
        2200
      );
    }

    const visitors = (cs.visitors || []).map((x) => ({ ...x }));
    const idx = visitors.findIndex((x) => String(x.id) === String(visitor.id));
    if (idx >= 0) {
      visitors[idx].mood = didWin ? "Shaken" : "Mocking";
      visitors[idx].power = clamp(Number(visitors[idx].power || 0) + (didWin ? 1 : 0), 6, 30);
    }

    this.store.set({
      coins: nextCoins,
      player: {
        ...p,
        energy: nextEnergy,
      },
      coffeeshop: {
        ...cs,
        visitors,
      },
    });

    this._recordCoffeeshopPvp(visitor, didWin, scoreGain, rewardCoins);

    if (hitRect) {
      this._spawnSmokeBurst(hitRect.x + hitRect.w * 0.5, hitRect.y + hitRect.h * 0.5, didWin ? 8 : 6);
    }
  }

  update() {
    this._updateFx();

    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
      this._ensureMusic();
    }

    if (this.dragging && this.input?.isDown?.()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input?.justReleased?.()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      if (this.backHit && pointInRect(px, py, this.backHit)) {
        this.scenes.go("home");
        return;
      }

      for (const h of this.hitButtons) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.action === "buy_use") {
          this._buyUse(h.item, h.rect);
          return;
        }

        if (h.action === "buy_inventory") {
          this._buyInventory(h.item, h.rect);
          return;
        }

        if (h.action === "attack") {
          this._attackVisitor(h.visitor, h.rect);
          return;
        }

        if (h.action === "refresh_visitors") {
          const s = this.store.get();
          this.store.set({
            coffeeshop: {
              ...(s.coffeeshop || {}),
              visitors: this._freshVisitors(),
            },
          });
          this._showToast("İçerideki tipler değişti", 1400);
          return;
        }
      }
    }
  }

  _drawSmoke(ctx) {
    for (const s of this.smoke) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(210,255,210,${s.alpha * s.life})`);
      g.addColorStop(0.45, `rgba(180,220,180,${s.alpha * 0.55 * s.life})`);
      g.addColorStop(1, `rgba(120,160,120,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawJointFx(ctx) {
    for (const fx of this.jointFx) {
      ctx.save();
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.rot);
      ctx.scale(fx.scale, fx.scale);
      ctx.globalAlpha = Math.max(0, fx.life);

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;

      const bodyW = 34;
      const bodyH = 8;

      const grad = ctx.createLinearGradient(-bodyW / 2, 0, bodyW / 2, 0);
      grad.addColorStop(0, "rgba(214,196,156,0.98)");
      grad.addColorStop(0.35, "rgba(236,222,185,0.98)");
      grad.addColorStop(0.7, "rgba(205,186,145,0.98)");
      grad.addColorStop(1, "rgba(176,156,120,0.98)");

      ctx.fillStyle = grad;
      this._rr(ctx, -bodyW / 2, -bodyH / 2, bodyW, bodyH, 4);
      ctx.fill();

      ctx.strokeStyle = "rgba(120,90,55,0.18)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.lineTo(8, 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(245,235,210,0.95)";
      this._rr(ctx, -bodyW / 2 - 3, -bodyH / 2, 7, bodyH, 2.5);
      ctx.fill();

      ctx.fillStyle = "rgba(78,92,48,0.95)";
      ctx.beginPath();
      ctx.ellipse(bodyW / 2 - 1, 0, 4.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const ember = ctx.createRadialGradient(bodyW / 2 + 2, 0, 0, bodyW / 2 + 2, 0, 7);
      ember.addColorStop(0, "rgba(255,235,180,1)");
      ember.addColorStop(0.35, "rgba(255,150,40,0.95)");
      ember.addColorStop(0.7, "rgba(255,70,10,0.7)");
      ember.addColorStop(1, "rgba(255,70,10,0)");
      ctx.fillStyle = ember;
      ctx.beginPath();
      ctx.arc(bodyW / 2 + 2, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      const smokeAlpha = Math.max(0, fx.life * 0.45);
      for (let i = 0; i < 3; i++) {
        const sx = bodyW / 2 + 5 + i * 2;
        const sy = -6 - i * 6;
        const sr = 4 + i * 2.5;

        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        sg.addColorStop(0, `rgba(230,235,230,${smokeAlpha * 0.55})`);
        sg.addColorStop(0.45, `rgba(190,205,190,${smokeAlpha * 0.28})`);
        sg.addColorStop(1, "rgba(190,205,190,0)");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _drawButton(ctx, rect, text, variant = "ghost") {
    let fill = "rgba(0,0,0,0.42)";
    let stroke = "rgba(255,255,255,0.16)";
    let txt = "rgba(255,255,255,0.96)";

    if (variant === "green") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(34,110,60,0.86)");
      g.addColorStop(1, "rgba(18,70,38,0.92)");
      fill = g;
      stroke = "rgba(120,255,170,0.38)";
    } else if (variant === "gold") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(135,96,26,0.84)");
      g.addColorStop(1, "rgba(88,61,14,0.92)");
      fill = g;
      stroke = "rgba(255,214,120,0.34)";
      txt = "#fff4db";
    } else if (variant === "red") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(138,48,48,0.85)");
      g.addColorStop(1, "rgba(92,28,28,0.92)");
      fill = g;
      stroke = "rgba(255,140,140,0.34)";
    }

    this._rr(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = txt;
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);

    const safe = this._safeRect();
    const bg = this._getBg();

    ctx.clearRect(0, 0, W, H);

    if (Date.now() < this.blurUntil) {
      ctx.save();
      ctx.filter = "blur(5px) saturate(1.08) brightness(1.03)";
      this._drawCover(ctx, bg, -10, -10, W + 20, H + 20);
      ctx.restore();
    } else {
      this._drawCover(ctx, bg, 0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, W, H);

    if (Date.now() < this.flashUntil) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    this._drawSmoke(ctx);

    const panelX = safe.x + 12;
    const panelY = Math.max(72, safe.y + 74);
    const panelW = Math.max(220, safe.w - 24);
    const panelH = Math.max(260, safe.h - 150);

    this._rr(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.fillStyle = "rgba(7,7,7,0.58)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Amsterdam Coffeeshop", panelX + 16, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText("Satın al • envantere at • içeridekilere saldır", panelX + 16, panelY + 48);

    const s = this.store.get();
    const coins = Number(s.coins || 0);
    const player = s.player || {};
    const cs = s.coffeeshop || {};

    const energy = Number(player.energy || 0);
    const energyMax = Number(player.energyMax || 100);
    const uses = Number(player.coffeeshopUses || 0);
    const tolerant = uses >= 10;
  

    ctx.fillStyle = "rgba(255,214,120,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`YTON: ${fmtNum(coins)}`, panelX + 16, panelY + 70);

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(`Enerji: ${fmtNum(energy)}/${fmtNum(energyMax)}`, panelX + 122, panelY + 70);

    ctx.fillStyle = tolerant ? "rgba(140,255,160,0.96)" : "rgba(255,255,255,0.70)";
    ctx.fillText(`Bağışıklık: ${tolerant ? "AKTİF" : `${uses}/10`}`, panelX + 260, panelY + 70);

    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(
      `Profil PvP: ${fmtNum(player.coffeeshopPvpWins || 0)}W / ${fmtNum(player.coffeeshopPvpLosses || 0)}L`,
      panelX + 16,
      panelY + 88
    );

    ctx.fillText(
      `Skor: ${fmtNum(player.coffeeshopScore || 0)}${meRow ? ` • Sıra: #${lb.indexOf(meRow) + 1}` : ""}`,
      panelX + 190,
      panelY + 88
    );

    const backW = 78;
    const backH = 30;
    const backX = panelX + panelW - backW - 14;
    const backY = panelY + 12;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };
    this._drawButton(ctx, this.backHit, "Geri");

    const contentX = panelX + 10;
    const contentY = panelY + 102;
    const contentW = panelW - 20;
    const contentH = panelH - 114;

    const visitors = Array.isArray(cs.visitors) ? cs.visitors : [];
  

    const visitorSectionH = 150;
    const leaderboardSectionH = 138;
    const rowH = 86;
    const productSectionTop = visitorSectionH + leaderboardSectionH + 30;
    const productListH = ITEMS.length * rowH;

    const fullContentH = productSectionTop + productListH + 20;
    this.maxScroll = Math.max(0, fullContentH - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    this.hitButtons = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    if (Date.now() < this.slowUntil) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(contentX, contentY, contentW, contentH);
      ctx.restore();
    }

    let y = contentY - this.scrollY;

    // Visitors header
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("İçeridekiler • Sadece bina içi PvP", contentX + 2, y + 14);

    const refreshRect = { x: contentX + contentW - 104, y: y - 10, w: 96, h: 28 };
    this.hitButtons.push({ rect: refreshRect, action: "refresh_visitors" });
    this._drawButton(ctx, refreshRect, "Tipleri Yenile", "ghost");

    y += 24;

    const visitorGap = 8;
    const visitorCardW = Math.floor((contentW - visitorGap * 3) / 4);

    for (let i = 0; i < 4; i++) {
      const v = visitors[i];
      if (!v) continue;

      const x = contentX + i * (visitorCardW + visitorGap);
      const h = 104;

      this._rr(ctx, x, y, visitorCardW, h, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "900 22px system-ui";
      ctx.fillText(v.avatar || "😶", x + 12, y + 28);

      ctx.font = "900 12px system-ui";
      ctx.fillText(v.name, x + 44, y + 20);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(`${v.tier} • Power ${fmtNum(v.power)}`, x + 44, y + 38);
      ctx.fillText(`Mood: ${v.mood}`, x + 12, y + 58);

      const atkRect = { x: x + 12, y: y + 68, w: visitorCardW - 24, h: 26 };
      this.hitButtons.push({ rect: atkRect, action: "attack", visitor: v });
      this._drawButton(ctx, atkRect, "Saldır", "red");
    }

    y += visitorSectionH;

   
    // Product header
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Ürünler • Kullan veya Envantere At", contentX + 2, y + 14);
    y += 24;

    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      const rowY = y + i * rowH;

      if (rowY > contentY + contentH + 12 || rowY + 72 < contentY - 12) continue;

      this._rr(ctx, contentX, rowY, contentW, 72, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "900 13px system-ui";
      ctx.fillText(item.name, contentX + 12, rowY + 20);

      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 11px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), contentX + 12, rowY + 38);

      const previewEnergy = this._applyToleranceEnergy(item.energy, uses + 1);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${previewEnergy} enerji`, contentX + 92, rowY + 38);

      ctx.fillStyle = "rgba(255,214,120,0.96)";
      ctx.fillText(`${item.price} yton`, contentX + 168, rowY + 38);

      const useRect = { x: contentX + contentW - 196, y: rowY + 19, w: 88, h: 34 };
      const invRect = { x: contentX + contentW - 98, y: rowY + 19, w: 88, h: 34 };

      this.hitButtons.push({ rect: useRect, action: "buy_use", item });
      this.hitButtons.push({ rect: invRect, action: "buy_inventory", item });

      this._drawButton(ctx, useRect, "Kullan", "green");
      this._drawButton(ctx, invRect, "Envanter", "gold");
    }

    ctx.restore();

    this._drawJointFx(ctx);

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 6;
      const trackY = contentY;
      const trackH = contentH;
      const thumbH = Math.max(36, (contentH / fullContentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(trackX, trackY, 3, trackH);

      ctx.fillStyle = "rgba(255,255,255,0.34)";
      ctx.fillRect(trackX, thumbY, 3, thumbH);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(360, panelW - 36);
      const th = 40;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 52;

      this._rr(ctx, tx, ty, tw, th, 12);
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "800 12px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + 24);
      ctx.textAlign = "left";
    }

    if (Date.now() < this.slowUntil) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
