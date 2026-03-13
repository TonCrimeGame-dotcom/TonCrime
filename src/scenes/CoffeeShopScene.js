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

const VISITORS = [
  { id: "rico", name: "Rico", tier: "Sokak", power: 8, rewardMin: 8, rewardMax: 18, avatar: "😎" },
  { id: "varga", name: "Varga", tier: "Sokak", power: 10, rewardMin: 10, rewardMax: 20, avatar: "🧥" },
  { id: "niko", name: "Niko", tier: "Kulüp", power: 13, rewardMin: 14, rewardMax: 24, avatar: "💨" },
  { id: "milan", name: "Milan", tier: "Kulüp", power: 15, rewardMin: 15, rewardMax: 28, avatar: "🕶️" },
  { id: "sergio", name: "Sergio", tier: "VIP", power: 18, rewardMin: 20, rewardMax: 34, avatar: "💼" },
  { id: "dante", name: "Dante", tier: "VIP", power: 21, rewardMin: 24, rewardMax: 40, avatar: "🔥" },
  { id: "klaus", name: "Klaus", tier: "Elite", power: 24, rewardMin: 28, rewardMax: 46, avatar: "👑" },
  { id: "roman", name: "Roman", tier: "Elite", power: 26, rewardMin: 30, rewardMax: 52, avatar: "💣" },
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

function randInt(min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function chance(rate) {
  return Math.random() < rate;
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999999)}`;
}

function rarityColor(rarity) {
  switch (String(rarity || "").toLowerCase()) {
    case "rare":
      return "#63a8ff";
    case "epic":
      return "#cd87ff";
    case "legendary":
      return "#ffce6a";
    default:
      return "#b8c0cc";
  }
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
    this.blurUntil = 0;
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
    this.flashUntil = 0;
    this.lastFrameAt = performance.now();
    this._ensureState();
    this._seedSmoke(18);
    this._ensureMusic();
    this._pushSystemChat(`☕ ${this._playerName()} Coffeeshop'a girdi.`);
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
    const inventory = s.inventory || {};
    const pvp = s.pvp || {};
    const missions = s.missions || {};
    const cs = s.coffeeshop || {};

    const visitors =
      Array.isArray(cs.visitors) && cs.visitors.length ? cs.visitors : this._freshVisitors();

    const notices = Array.isArray(cs.notices) ? cs.notices : [];

    this.store.set({
      inventory: {
        ...inventory,
        items: Array.isArray(inventory.items) ? inventory.items : [],
      },
      pvp: {
        ...pvp,
        wins: Number(pvp.wins || 0),
        losses: Number(pvp.losses || 0),
        rating: Number(pvp.rating || 1000),
        currentOpponent: pvp.currentOpponent || null,
      },
      missions: {
        ...missions,
        pvpPlayed: Number(missions.pvpPlayed || 0),
      },
      player: {
        ...p,
        level: Math.max(1, Number(p.level || 1)),
        xp: Number(p.xp || 0),
        xpToNext: Math.max(100, Number(p.xpToNext || 100)),
        energy: Number(p.energy || 0),
        energyMax: Math.max(10, Number(p.energyMax || 100)),
        pvpPlayed: Number(p.pvpPlayed || 0),
        pvpWins: Number(p.pvpWins || 0),
        pvpLosses: Number(p.pvpLosses || 0),
        coffeeshopUses: Number(p.coffeeshopUses || 0),
      },
      coffeeshop: {
        ...cs,
        visitors,
        notices,
        giftsClaimed: Number(cs.giftsClaimed || 0),
        securityHits: Number(cs.securityHits || 0),
        totalSpent: Number(cs.totalSpent || 0),
        totalBought: Number(cs.totalBought || 0),
      },
    });
  }

  _freshVisitors() {
    return [...VISITORS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map((v) => ({
        ...v,
        mood: ["Calm", "High", "Aggro", "Watching"][randInt(0, 3)],
      }));
  }

  _playerName() {
    const s = this.store.get() || {};
    return String(s.player?.username || "Player");
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

  _showToast(text, ms = 1700) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _pushSystemChat(text) {
    const s = this.store.get() || {};
    const chatLog = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    const item = {
      id: makeId("sys"),
      type: "system",
      username: "SYSTEM",
      text: String(text || ""),
      ts: Date.now(),
    };

    chatLog.push(item);
    this.store.set({ chatLog });

    try {
      window.dispatchEvent(new CustomEvent("tc:chat:push", { detail: item }));
    } catch (_) {}
  }

  _pushNotice(text) {
    const s = this.store.get() || {};
    const cs = s.coffeeshop || {};
    const notices = Array.isArray(cs.notices) ? cs.notices.map((x) => ({ ...x })) : [];

    notices.unshift({
      id: makeId("notice"),
      text: String(text || ""),
      ts: Date.now(),
    });

    this.store.set({
      coffeeshop: {
        ...cs,
        notices: notices.slice(0, 3),
      },
    });
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

  _updateFx() {
    const now = performance.now();
    let dt = this.lastFrameAt ? (now - this.lastFrameAt) / 16.6667 : 1;
    this.lastFrameAt = now;
    dt = clamp(dt, 0.4, 2.2);

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
  }

  _gainXp(amount) {
    const s = this.store.get() || {};
    const p = { ...(s.player || {}) };

    let xp = Number(p.xp || 0) + Number(amount || 0);
    let level = Math.max(1, Number(p.level || 1));
    const xpToNext = Math.max(100, Number(p.xpToNext || 100));

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
    const s = this.store.get() || {};
    const inventory = s.inventory || {};
    const items = Array.isArray(inventory.items) ? inventory.items.map((x) => ({ ...x })) : [];

    const existing = items.find(
      (x) =>
        String(x.name).toLowerCase() === String(item.name).toLowerCase() &&
        String(x.kind || "") === String(item.kind || "")
    );

    if (existing) {
      existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
    } else {
      items.unshift({
        id: item.id || makeId("inv"),
        kind: item.kind || "goods",
        icon: item.icon || "📦",
        name: item.name || "Item",
        rarity: item.rarity || "common",
        qty: Number(item.qty || 1),
        usable: item.usable !== false,
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
        ...inventory,
        items,
      },
    });
  }

  _weedInventoryItem(item) {
    return {
      id: makeId("weed"),
      kind: "goods",
      icon: "🌿",
      name: item.name,
      rarity: item.rarity,
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: Number(item.energy || 0),
      sellPrice: Math.max(1, Math.floor(Number(item.price || 0) * 0.65)),
      marketPrice: Number(item.price || 0),
      desc: "Coffeeshop ürünü.",
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
        sellPrice: 65,
        marketPrice: 92,
        energyGain: 22,
        desc: "Hediye kadın.",
        source: "coffeeshop_gift",
      },
      {
        kind: "consumable",
        icon: "🍾",
        name: "Premium Champagne",
        rarity: "rare",
        qty: 1,
        usable: true,
        sellPrice: 28,
        marketPrice: 44,
        energyGain: 14,
        desc: "Hediye alkol.",
        source: "coffeeshop_gift",
      },
      {
        kind: "goods",
        icon: "🌿",
        name: "Moon Rocks",
        rarity: "rare",
        qty: 1,
        usable: true,
        sellPrice: 22,
        marketPrice: 34,
        energyGain: 18,
        desc: "Hediye ot.",
        source: "coffeeshop_gift",
      },
      {
        kind: "rare",
        icon: "📦",
        name: "Mystery Crate",
        rarity: "legendary",
        qty: 1,
        usable: false,
        sellPrice: 55,
        marketPrice: 78,
        energyGain: 0,
        desc: "Hediye kasa.",
        source: "coffeeshop_gift",
      },
    ];
  }

  _maybeGift() {
    if (!chance(0.30)) return null;

    const gift = this._giftPool()[randInt(0, this._giftPool().length - 1)];
    this._addInventoryItem({ ...gift, id: makeId("gift") });

    const s = this.store.get() || {};
    const cs = s.coffeeshop || {};

    this.store.set({
      coffeeshop: {
        ...cs,
        giftsClaimed: Number(cs.giftsClaimed || 0) + 1,
      },
    });

    this._pushSystemChat(`🎁 ${this._playerName()} bir hediye buldu: ${gift.name}`);
    this._pushNotice(`🎁 Hediye geldi: ${gift.name}`);

    return gift;
  }

  _maybeSecurityBeat() {
    if (!chance(0.30)) return null;

    const s = this.store.get() || {};
    const p = s.player || {};
    const cs = s.coffeeshop || {};

    const energyLoss = Math.min(Number(p.energy || 0), randInt(5, 16));
    const coinLoss = Math.min(Number(s.coins || 0), randInt(6, 24));

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

    this.blurUntil = Date.now() + 1800;
    this.flashUntil = Date.now() + 220;

    this._pushSystemChat(
      `👮 Güvenlikler ${this._playerName()}'ı dövdü. -${energyLoss} enerji / -${coinLoss} yton`
    );
    this._pushNotice(`👮 Dayak: -${energyLoss} enerji / -${coinLoss} yton`);

    return { energyLoss, coinLoss };
  }

  _recordGlobalPvp(visitor, didWin, ratingDelta) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const pvp = s.pvp || {};
    const missions = s.missions || {};

    this.store.set({
      pvp: {
        ...pvp,
        currentOpponent: visitor.name,
        wins: Number(pvp.wins || 0) + (didWin ? 1 : 0),
        losses: Number(pvp.losses || 0) + (didWin ? 0 : 1),
        rating: Math.max(0, Number(pvp.rating || 1000) + Number(ratingDelta || 0)),
      },
      missions: {
        ...missions,
        pvpPlayed: Number(missions.pvpPlayed || 0) + 1,
      },
      player: {
        ...p,
        pvpPlayed: Number(p.pvpPlayed || 0) + 1,
        pvpWins: Number(p.pvpWins || 0) + (didWin ? 1 : 0),
        pvpLosses: Number(p.pvpLosses || 0) + (didWin ? 0 : 1),
      },
    });

    try {
      window.dispatchEvent(new Event(didWin ? "tc:pvp:win" : "tc:pvp:lose"));
    } catch (_) {}
  }

  _buy(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const cs = s.coffeeshop || {};
    const price = Number(item.price || 0);

    if (Number(s.coins || 0) < price) {
      this._showToast("Yetersiz yton");
      return;
    }

    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const nextUses = Number(p.coffeeshopUses || 0) + 1;

    this.store.set({
      coins: Number(s.coins || 0) - price,
      player: {
        ...p,
        coffeeshopUses: nextUses,
      },
      coffeeshop: {
        ...cs,
        totalSpent: Number(cs.totalSpent || 0) + price,
        totalBought: Number(cs.totalBought || 0) + 1,
      },
    });

    if (energy >= energyMax) {
      this._addInventoryItem(this._weedInventoryItem(item));
      this._showToast(`${item.name} envantere eklendi`, 1800);
      this._pushSystemChat(`📦 ${this._playerName()} ${item.name} aldı ve envantere attı.`);
      this._pushNotice(`📦 Envantere gitti: ${item.name}`);
    } else {
      const gain = Math.min(Number(item.energy || 0), energyMax - energy);

      this.store.set({
        player: {
          ...this.store.get().player,
          energy: energy + gain,
          coffeeshopUses: nextUses,
        },
      });

      this._gainXp(randInt(1, 3));
      this._showToast(`+${gain} enerji / -${price} yton`, 1700);
      this._pushSystemChat(`💨 ${this._playerName()} ${item.name} kullandı. +${gain} enerji`);
      this._pushNotice(`💨 ${item.name} kullanıldı (+${gain})`);
    }

    const gift = this._maybeGift();
    const beat = this._maybeSecurityBeat();

    if (gift && beat) {
      this._showToast(`🎁 ${gift.name} geldi ama dayak yedin`, 2300);
    } else if (gift) {
      this._showToast(`🎁 Hediye geldi: ${gift.name}`, 2200);
    } else if (beat) {
      this._showToast(
        `Güvenlikler dövdü: -${beat.energyLoss} enerji / -${beat.coinLoss} yton`,
        2200
      );
    }
  }

  _attack(visitor) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const cs = s.coffeeshop || {};
    const attackCost = 6;

    if (Number(p.energy || 0) < attackCost) {
      this._showToast(`PvP için ${attackCost} enerji lazım`);
      return;
    }

    let winChance = 0.48 + Number(p.level || 1) * 0.004 - Number(visitor.power || 0) * 0.006;
    winChance = clamp(winChance, 0.20, 0.82);

    const didWin = Math.random() < winChance;
    const ratingDelta = didWin ? randInt(12, 26) : -randInt(8, 18);

    let nextCoins = Number(s.coins || 0);
    let nextEnergy = Math.max(0, Number(p.energy || 0) - attackCost);

    if (didWin) {
      const rewardCoins = randInt(visitor.rewardMin || 8, visitor.rewardMax || 18);
      nextCoins += rewardCoins;
      this._gainXp(randInt(8, 16));
      this._showToast(`⚔️ ${visitor.name} yenildi! +${rewardCoins} yton`, 2200);
      this._pushSystemChat(`⚔️ ${this._playerName()} Coffeeshop içinde ${visitor.name}'ı yendi.`);
      this._pushNotice(`⚔️ Kazanıldı: ${visitor.name}`);
    } else {
      const coinLoss = Math.min(nextCoins, randInt(4, 18));
      const extraEnergyLoss = randInt(4, 11);
      nextCoins = Math.max(0, nextCoins - coinLoss);
      nextEnergy = Math.max(0, nextEnergy - extraEnergyLoss);
      this.blurUntil = Date.now() + 1400;
      this._showToast(`💥 ${visitor.name} seni dağıttı!`, 2200);
      this._pushSystemChat(`💥 ${this._playerName()} Coffeeshop içinde ${visitor.name}'a kaybetti.`);
      this._pushNotice(`💥 Kaybedildi: ${visitor.name}`);
    }

    const visitors = Array.isArray(cs.visitors) ? cs.visitors.map((x) => ({ ...x })) : [];
    const idx = visitors.findIndex((x) => String(x.id) === String(visitor.id));

    if (idx >= 0) {
      visitors[idx].mood = didWin ? "Shaken" : "Mocking";
      visitors[idx].power = clamp(Number(visitors[idx].power || 0) + (didWin ? 1 : 0), 6, 30);
    }

    this.store.set({
      coins: nextCoins,
      player: {
        ...this.store.get().player,
        energy: nextEnergy,
      },
      coffeeshop: {
        ...this.store.get().coffeeshop,
        visitors,
      },
    });

    this._recordGlobalPvp(visitor, didWin, ratingDelta);
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
        this._pushSystemChat(`🚪 ${this._playerName()} Coffeeshop'tan çıktı.`);
        this.scenes.go("home");
        return;
      }

      for (const h of this.hitButtons) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.action === "buy") {
          this._buy(h.item);
          return;
        }

        if (h.action === "attack") {
          this._attack(h.visitor);
          return;
        }

        if (h.action === "refresh") {
          const s = this.store.get() || {};
          const cs = s.coffeeshop || {};
          this.store.set({
            coffeeshop: {
              ...cs,
              visitors: this._freshVisitors(),
            },
          });
          this._showToast("İçeridekiler değişti", 1400);
          this._pushNotice("🚬 Yeni tipler içeride");
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
      g.addColorStop(1, "rgba(120,160,120,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawButton(ctx, rect, text, variant) {
    let fill = "rgba(0,0,0,0.42)";
    let stroke = "rgba(255,255,255,0.16)";
    let txt = "rgba(255,255,255,0.96)";

    if (variant === "green") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(34,110,60,0.86)");
      g.addColorStop(1, "rgba(18,70,38,0.92)");
      fill = g;
      stroke = "rgba(120,255,170,0.38)";
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
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, W, H);
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

    const s = this.store.get() || {};
    const p = s.player || {};
    const pvp = s.pvp || {};
    const cs = s.coffeeshop || {};

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Amsterdam Coffeeshop", panelX + 16, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText("Satın al • envantere otomatik at • içeridekilere saldır", panelX + 16, panelY + 48);

    ctx.fillStyle = "rgba(255,214,120,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`YTON: ${fmtNum(s.coins || 0)}`, panelX + 16, panelY + 70);

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(`Enerji: ${fmtNum(p.energy || 0)}/${fmtNum(p.energyMax || 100)}`, panelX + 120, panelY + 70);

    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(`Genel PvP: ${fmtNum(pvp.wins || 0)}W / ${fmtNum(pvp.losses || 0)}L`, panelX + 16, panelY + 88);
    ctx.fillText(`Rating: ${fmtNum(pvp.rating || 1000)}`, panelX + 180, panelY + 88);

    const backW = 78;
    const backH = 30;
    const backX = panelX + panelW - backW - 14;
    const backY = panelY + 12;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };
    this._drawButton(ctx, this.backHit, "Geri", "ghost");

    const contentX = panelX + 10;
    const contentY = panelY + 102;
    const contentW = panelW - 20;
    const contentH = panelH - 114;

    const notices = Array.isArray(cs.notices) ? cs.notices : [];
    const visitors = Array.isArray(cs.visitors) ? cs.visitors : [];

    const noticeSectionH = 86;
    const visitorSectionH = 150;
    const rowH = 86;
    const productSectionTop = noticeSectionH + visitorSectionH + 28;
    const fullContentH = productSectionTop + ITEMS.length * rowH + 20;

    this.maxScroll = Math.max(0, fullContentH - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);
    this.hitButtons = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    let y = contentY - this.scrollY;

    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Coffeeshop Akışı", contentX + 2, y + 14);
    y += 22;

    this._rr(ctx, contentX, y, contentW, 54, 14);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();

    if (!notices.length) {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "12px system-ui";
      ctx.fillText("Henüz olay yok.", contentX + 12, y + 22);
      ctx.fillText("Satın alım, hediye ve PvP olayları burada görünür.", contentX + 12, y + 40);
    } else {
      for (let i = 0; i < Math.min(2, notices.length); i++) {
        ctx.fillStyle = i === 0 ? "rgba(255,214,120,0.95)" : "rgba(255,255,255,0.72)";
        ctx.font = i === 0 ? "800 11px system-ui" : "11px system-ui";
        ctx.fillText(String(notices[i].text || ""), contentX + 12, y + 20 + i * 18);
      }
    }

    y += noticeSectionH;

    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("İçeridekiler • Sadece bina içi PvP", contentX + 2, y + 14);

    const refreshRect = { x: contentX + contentW - 104, y: y - 10, w: 96, h: 28 };
    this.hitButtons.push({ rect: refreshRect, action: "refresh" });
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

    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Ürünler", contentX + 2, y + 14);
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

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, contentX + 96, rowY + 38);

      ctx.fillStyle = "rgba(255,214,120,0.96)";
      ctx.fillText(`${item.price} yton`, contentX + 180, rowY + 38);

      const buyRect = { x: contentX + contentW - 100, y: rowY + 19, w: 88, h: 34 };
      this.hitButtons.push({ rect: buyRect, action: "buy", item });
      this._drawButton(ctx, buyRect, "Satın Al", "green");
    }

    ctx.restore();

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
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2 + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }
}
