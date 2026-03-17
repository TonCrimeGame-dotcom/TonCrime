export class NightclubScene {
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

    this.items = [
      { id: "nc_alc_01", icon: "🥃", name: "Street Whiskey", energy: 4, price: 12, rarity: "common" },
      { id: "nc_alc_02", icon: "🍺", name: "Dark Lager", energy: 5, price: 14, rarity: "common" },
      { id: "nc_alc_03", icon: "🍷", name: "House Red Wine", energy: 6, price: 17, rarity: "common" },
      { id: "nc_alc_04", icon: "🍸", name: "Neon Martini", energy: 7, price: 20, rarity: "common" },
      { id: "nc_alc_05", icon: "🥂", name: "Club Prosecco", energy: 8, price: 23, rarity: "rare" },
      { id: "nc_alc_06", icon: "🍹", name: "Tropical Mix", energy: 9, price: 26, rarity: "rare" },
      { id: "nc_alc_07", icon: "🥃", name: "Oak Reserve", energy: 10, price: 29, rarity: "rare" },
      { id: "nc_alc_08", icon: "🍾", name: "Velvet Champagne", energy: 11, price: 33, rarity: "rare" },
      { id: "nc_alc_09", icon: "🍷", name: "Midnight Merlot", energy: 12, price: 36, rarity: "rare" },
      { id: "nc_alc_10", icon: "🍸", name: "Blue Venom", energy: 13, price: 40, rarity: "epic" },
      { id: "nc_alc_11", icon: "🥂", name: "Gold Spark", energy: 14, price: 44, rarity: "epic" },
      { id: "nc_alc_12", icon: "🍺", name: "Imperial Stout", energy: 15, price: 48, rarity: "epic" },
      { id: "nc_alc_13", icon: "🥃", name: "Black Barrel", energy: 16, price: 52, rarity: "epic" },
      { id: "nc_alc_14", icon: "🍾", name: "Diamond Brut", energy: 17, price: 56, rarity: "epic" },
      { id: "nc_alc_15", icon: "🍸", name: "Crimson Kiss", energy: 18, price: 61, rarity: "epic" },
      { id: "nc_alc_16", icon: "🍷", name: "Royal Cabernet", energy: 19, price: 66, rarity: "epic" },
      { id: "nc_alc_17", icon: "🥂", name: "Imperial Rosé", energy: 20, price: 71, rarity: "epic" },
      { id: "nc_alc_18", icon: "🍹", name: "Electric Sunset", energy: 21, price: 76, rarity: "epic" },
      { id: "nc_alc_19", icon: "🥃", name: "Smoked Bourbon", energy: 22, price: 82, rarity: "legendary" },
      { id: "nc_alc_20", icon: "🍾", name: "Velour Prestige", energy: 23, price: 88, rarity: "legendary" },
      { id: "nc_alc_21", icon: "🍸", name: "Phantom Dry", energy: 24, price: 94, rarity: "legendary" },
      { id: "nc_alc_22", icon: "🥂", name: "Crystal Reserve", energy: 25, price: 101, rarity: "legendary" },
      { id: "nc_alc_23", icon: "🥃", name: "King's Cask", energy: 26, price: 108, rarity: "legendary" },
      { id: "nc_alc_24", icon: "🍷", name: "Velvet Noir", energy: 27, price: 115, rarity: "legendary" },
      { id: "nc_alc_25", icon: "🍾", name: "Obsidian Gold", energy: 28, price: 123, rarity: "mythic" },
      { id: "nc_alc_26", icon: "🍸", name: "Night Crown", energy: 29, price: 131, rarity: "mythic" },
      { id: "nc_alc_27", icon: "🥂", name: "Saint Royale", energy: 30, price: 140, rarity: "mythic" },
      { id: "nc_alc_28", icon: "🥃", name: "Mafia Reserve", energy: 31, price: 149, rarity: "mythic" },
      { id: "nc_alc_29", icon: "🍾", name: "TonCrime Luxe", energy: 33, price: 159, rarity: "mythic" },
      { id: "nc_alc_30", icon: "🥂", name: "Black Diamond Brut", energy: 35, price: 170, rarity: "mythic" },
    ];

    this.visitorsBase = [
      { id: "blade", name: "Blade", tier: "Sokak", power: 9, rewardMin: 10, rewardMax: 20, avatar: "🕴️" },
      { id: "zane", name: "Zane", tier: "Sokak", power: 11, rewardMin: 12, rewardMax: 22, avatar: "💣" },
      { id: "scar", name: "Scar", tier: "VIP", power: 16, rewardMin: 18, rewardMax: 30, avatar: "🔪" },
      { id: "vito", name: "Vito", tier: "VIP", power: 19, rewardMin: 22, rewardMax: 34, avatar: "🥷" },
      { id: "ross", name: "Ross", tier: "Elite", power: 22, rewardMin: 26, rewardMax: 42, avatar: "🧤" },
      { id: "nero", name: "Nero", tier: "Elite", power: 25, rewardMin: 30, rewardMax: 48, avatar: "👑" },
      { id: "ghost", name: "Ghost", tier: "Mythic", power: 28, rewardMin: 34, rewardMax: 55, avatar: "☠️" },
      { id: "onyx", name: "Onyx", tier: "Mythic", power: 30, rewardMin: 38, rewardMax: 60, avatar: "🦂" },
    ];
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
    this._pushSystemChat(`🪩 ${this._playerName()} Nightclub'a girdi.`);
  }

  onExit() {
    this.dragging = false;
    if (this.music) {
      try { this.music.pause(); } catch (_) {}
    }
  }

  _ensureState() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const inventory = s.inventory || {};
    const pvp = s.pvp || {};
    const nightclub = s.nightclub || {};

    const visitors = Array.isArray(nightclub.visitors) && nightclub.visitors.length ? nightclub.visitors : this._freshVisitors();
    const notices = Array.isArray(nightclub.notices) ? nightclub.notices : [];

    this.store.set({
      inventory: { ...inventory, items: Array.isArray(inventory.items) ? inventory.items : [] },
      pvp: {
        ...pvp,
        wins: Number(pvp.wins || 0),
        losses: Number(pvp.losses || 0),
        rating: Number(pvp.rating || 1000),
        currentOpponent: pvp.currentOpponent || null,
      },
      player: {
        ...p,
        level: Math.max(1, Number(p.level || 1)),
        xp: Number(p.xp || 0),
        xpToNext: Math.max(100, Number(p.xpToNext || 100)),
        energy: Number(p.energy || 0),
        energyMax: Math.max(10, Number(p.energyMax || 100)),
      },
      nightclub: {
        ...nightclub,
        visitors,
        notices,
        totalSpent: Number(nightclub.totalSpent || 0),
        totalBought: Number(nightclub.totalBought || 0),
        inventoryBought: Number(nightclub.inventoryBought || 0),
        theftEvents: Number(nightclub.theftEvents || 0),
        pvpWins: Number(nightclub.pvpWins || 0),
        pvpLosses: Number(nightclub.pvpLosses || 0),
      },
    });
  }

  _freshVisitors() {
    return [...this.visitorsBase].sort(() => Math.random() - 0.5).slice(0, 4).map((v) => ({
      ...v,
      mood: ["Drunk", "Watching", "Aggro", "VIP Table"][Math.floor(Math.random() * 4)],
    }));
  }

  _playerName() { const s = this.store.get() || {}; return String(s.player?.username || "Player"); }
  _safeRect() { const safe = this.store.get()?.ui?.safe; return safe && Number.isFinite(safe.w) && Number.isFinite(safe.h) ? safe : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }; }

  _getBg() {
    if (typeof this.assets?.getImage === "function") return this.assets.getImage("nightclub_bg") || this.assets.getImage("nightclub");
    if (typeof this.assets?.get === "function") return this.assets.get("nightclub_bg") || this.assets.get("nightclub");
    return this.assets?.images?.nightclub_bg || this.assets?.images?.nightclub || null;
  }

  _ensureMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    try {
      this.music = new Audio("./src/assets/club.mp3");
      this.music.loop = true;
      this.music.volume = 0.30;
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

  _showToast(text, ms = 1700) { this.toastText = String(text || ""); this.toastUntil = Date.now() + ms; }

  _pushSystemChat(text) {
    const s = this.store.get() || {};
    const chatLog = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    const item = { id: `sys_${Date.now()}_${Math.floor(Math.random() * 99999)}`, type: "system", username: "SYSTEM", text: String(text || ""), ts: Date.now() };
    chatLog.push(item);
    this.store.set({ chatLog });
    try { window.dispatchEvent(new CustomEvent("tc:chat:push", { detail: item })); } catch (_) {}
  }

  _pushNotice(text) {
    const s = this.store.get() || {};
    const nightclub = s.nightclub || {};
    const notices = Array.isArray(nightclub.notices) ? nightclub.notices.map((x) => ({ ...x })) : [];
    notices.unshift({ id: `notice_${Date.now()}`, text: String(text || ""), ts: Date.now() });
    this.store.set({ nightclub: { ...nightclub, notices: notices.slice(0, 3) } });
  }

  _seedSmoke(count) {
    this.smoke = [];
    const safe = this._safeRect();
    for (let i = 0; i < count; i++) {
      this.smoke.push({ x: safe.x + Math.random() * safe.w, y: safe.y + Math.random() * safe.h, r: 18 + Math.random() * 42, alpha: 0.04 + Math.random() * 0.08, vx: -0.10 + Math.random() * 0.20, vy: -0.12 - Math.random() * 0.28, life: 0.4 + Math.random() * 1.1 });
    }
  }

  _updateFx() {
    const now = performance.now();
    let dt = this.lastFrameAt ? (now - this.lastFrameAt) / 16.6667 : 1;
    this.lastFrameAt = now;
    dt = Math.max(0.4, Math.min(2.2, dt));
    const safe = this._safeRect();
    for (const s of this.smoke) {
      s.x += s.vx * dt * 2.0;
      s.y += s.vy * dt * 2.0;
      s.r += 0.04 * dt * 10;
      s.life -= 0.0038 * dt * 10;
      if (s.life <= 0 || s.y + s.r < safe.y - 30) {
        s.x = safe.x + Math.random() * safe.w;
        s.y = safe.y + safe.h + Math.random() * 24;
        s.r = 18 + Math.random() * 42;
        s.alpha = 0.04 + Math.random() * 0.08;
        s.vx = -0.10 + Math.random() * 0.20;
        s.vy = -0.12 - Math.random() * 0.28;
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
    while (xp >= xpToNext) { xp -= xpToNext; level += 1; }
    this.store.set({ player: { ...p, xp, level, xpToNext } });
  }

  _addInventoryItem(item) {
    const s = this.store.get() || {};
    const inventory = s.inventory || {};
    const items = Array.isArray(inventory.items) ? inventory.items.map((x) => ({ ...x })) : [];
    const existing = items.find((x) => String(x.name || "").toLowerCase() === String(item.name || "").toLowerCase() && String(x.kind || "") === String(item.kind || ""));
    if (existing) existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
    else items.unshift({ ...item });
    this.store.set({ inventory: { ...inventory, items } });
  }

  _alcoholInventoryItem(item) {
    return {
      id: `night_item_${item.id}_${Date.now()}`,
      kind: "consumable",
      icon: item.icon || "🍾",
      name: item.name,
      rarity: item.rarity || "common",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: Number(item.energy || 0),
      sellPrice: Math.max(1, Math.floor(Number(item.price || 0) * 0.65)),
      marketPrice: Number(item.price || 0),
      desc: "Nightclub ürünü.",
      source: "nightclub",
    };
  }

  _maybeGift() {
    if (!chance(0.26)) return null;
    const pool = [
      { kind: "consumable", icon: "🍾", name: "Premium Champagne", rarity: "rare", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 14, sellPrice: 28, marketPrice: 44, desc: "VIP masa hediyesi.", source: "nightclub_gift" },
      { kind: "consumable", icon: "🥃", name: "Black Barrel", rarity: "epic", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 18, sellPrice: 38, marketPrice: 58, desc: "Bar arkasından düştü.", source: "nightclub_gift" },
      { kind: "rare", icon: "📦", name: "Mystery Crate", rarity: "legendary", qty: 1, usable: false, sellable: true, marketable: true, energyGain: 0, sellPrice: 55, marketPrice: 78, desc: "Kulüp kasası hediyesi.", source: "nightclub_gift" },
    ];
    const gift = pool[Math.floor(Math.random() * pool.length)];
    this._addInventoryItem({ ...gift, id: `gift_${Date.now()}` });
    this._pushSystemChat(`🎁 ${this._playerName()} Nightclub içinde hediye buldu: ${gift.name}`);
    this._pushNotice(`🎁 Hediye: ${gift.name}`);
    return gift;
  }

  _maybeCrowdTheft(source = "crowd") {
    if (!chance(0.26)) return null;
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};
    const energyLoss = Math.min(Number(p.energy || 0), Math.floor(4 + Math.random() * 15));
    const coinLoss = Math.min(Number(s.coins || 0), Math.floor(7 + Math.random() * 30));
    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - coinLoss),
      player: { ...p, energy: Math.max(0, Number(p.energy || 0) - energyLoss) },
      nightclub: { ...nightclub, theftEvents: Number(nightclub.theftEvents || 0) + 1 },
    });
    this.blurUntil = Date.now() + 1500;
    this.flashUntil = Date.now() + 220;
    const text = `🥊 Gece kulübünde kavga çıktı (${source}) • -${energyLoss} enerji / -${coinLoss} yton`;
    this._pushSystemChat(text);
    this._pushNotice(text);
    return { energyLoss, coinLoss };
  }

  _recordGlobalPvp(visitor, didWin, ratingDelta) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const pvp = s.pvp || {};
    const nightclub = s.nightclub || {};
    this.store.set({
      pvp: { ...pvp, currentOpponent: visitor.name, wins: Number(pvp.wins || 0) + (didWin ? 1 : 0), losses: Number(pvp.losses || 0) + (didWin ? 0 : 1), rating: Math.max(0, Number(pvp.rating || 1000) + Number(ratingDelta || 0)) },
      player: { ...p, pvpPlayed: Number(p.pvpPlayed || 0) + 1, pvpWins: Number(p.pvpWins || 0) + (didWin ? 1 : 0), pvpLosses: Number(p.pvpLosses || 0) + (didWin ? 0 : 1) },
      nightclub: { ...nightclub, pvpWins: Number(nightclub.pvpWins || 0) + (didWin ? 1 : 0), pvpLosses: Number(nightclub.pvpLosses || 0) + (didWin ? 0 : 1) },
    });
    try { window.dispatchEvent(new Event(didWin ? "tc:pvp:win" : "tc:pvp:lose")); } catch (_) {}
  }

  _buy(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};
    const price = Number(item.price || 0);
    if (Number(s.coins || 0) < price) {
      this._showToast("Yetersiz yton");
      return;
    }

    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    this.store.set({
      coins: Number(s.coins || 0) - price,
      nightclub: { ...nightclub, totalSpent: Number(nightclub.totalSpent || 0) + price, totalBought: Number(nightclub.totalBought || 0) + 1, inventoryBought: Number(nightclub.inventoryBought || 0) + (energy >= energyMax ? 1 : 0) },
    });

    if (energy >= energyMax) {
      this._addInventoryItem(this._alcoholInventoryItem(item));
      this._showToast(`${item.name} envantere eklendi`, 1800);
      this._pushSystemChat(`🍾 ${this._playerName()} ${item.name} aldı ve envantere attı.`);
      this._pushNotice(`🍾 Envantere gitti: ${item.name}`);
    } else {
      const gain = Math.min(Number(item.energy || 0), energyMax - energy);
      this.store.set({ player: { ...this.store.get().player, energy: energy + gain } });
      this._gainXp(1 + Math.floor(gain / 8));
      this._showToast(`+${gain} enerji / -${price} yton`, 1700);
      this._pushSystemChat(`🥂 ${this._playerName()} ${item.name} kullandı. +${gain} enerji`);
      this._pushNotice(`🥂 ${item.name} kullanıldı (+${gain})`);
    }

    const gift = this._maybeGift();
    const theft = this._maybeCrowdTheft("satın alım");
    if (gift && theft) this._showToast(`🎁 ${gift.name} geldi ama içeride soyuldun`, 2400);
    else if (gift) this._showToast(`🎁 Hediye geldi: ${gift.name}`, 2200);
    else if (theft) this._showToast(`- ${theft.energyLoss} enerji / -${theft.coinLoss} yton`, 2200);
  }

  _attack(visitor) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};
    const attackCost = 7;
    if (Number(p.energy || 0) < attackCost) {
      this._showToast(`PvP için ${attackCost} enerji lazım`);
      return;
    }

    let winChance = 0.46 + Number(p.level || 1) * 0.004 - Number(visitor.power || 0) * 0.006;
    winChance = Math.max(0.20, Math.min(0.82, winChance));
    const didWin = Math.random() < winChance;
    const ratingDelta = didWin ? (12 + Math.floor(Math.random() * 15)) : -(8 + Math.floor(Math.random() * 10));

    let nextCoins = Number(s.coins || 0);
    let nextEnergy = Math.max(0, Number(p.energy || 0) - attackCost);

    if (didWin) {
      const rewardCoins = visitor.rewardMin + Math.floor(Math.random() * (visitor.rewardMax - visitor.rewardMin + 1));
      nextCoins += rewardCoins;
      this._gainXp(8 + Math.floor(Math.random() * 8));
      this._showToast(`⚔️ ${visitor.name} yenildi! +${rewardCoins} yton`, 2200);
      this._pushSystemChat(`⚔️ ${this._playerName()} Nightclub içinde ${visitor.name}'ı yendi.`);
      this._pushNotice(`⚔️ Kazanıldı: ${visitor.name}`);
    } else {
      const coinLoss = Math.min(nextCoins, 4 + Math.floor(Math.random() * 18));
      const extraEnergyLoss = 4 + Math.floor(Math.random() * 12);
      nextCoins = Math.max(0, nextCoins - coinLoss);
      nextEnergy = Math.max(0, nextEnergy - extraEnergyLoss);
      this.blurUntil = Date.now() + 1400;
      this._showToast(`💥 ${visitor.name} seni dağıttı!`, 2200);
      this._pushSystemChat(`💥 ${this._playerName()} Nightclub içinde ${visitor.name}'a kaybetti.`);
      this._pushNotice(`💥 Kaybedildi: ${visitor.name}`);
    }

    const visitors = Array.isArray(nightclub.visitors) ? nightclub.visitors.map((x) => ({ ...x })) : [];
    const idx = visitors.findIndex((x) => String(x.id) === String(visitor.id));
    if (idx >= 0) {
      visitors[idx].mood = didWin ? "Shaken" : "Laughing";
      visitors[idx].power = Math.max(7, Math.min(34, Number(visitors[idx].power || 0) + (didWin ? 1 : 0)));
    }

    this.store.set({ coins: nextCoins, player: { ...this.store.get().player, energy: nextEnergy }, nightclub: { ...this.store.get().nightclub, visitors } });
    if (chance(0.22)) this._maybeCrowdTheft("pvp");
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
      this.scrollY = Math.max(0, Math.min(this.maxScroll, this.startScroll - dy));
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input?.justReleased?.()) {
      this.dragging = false;
      if (!this.clickCandidate) return;

      if (this.backHit && px >= this.backHit.x && px <= this.backHit.x + this.backHit.w && py >= this.backHit.y && py <= this.backHit.y + this.backHit.h) {
        this._pushSystemChat(`🚪 ${this._playerName()} Nightclub'dan çıktı.`);
        this.scenes.go("home");
        return;
      }

      for (const h of this.hitButtons) {
        if (!(px >= h.rect.x && px <= h.rect.x + h.rect.w && py >= h.rect.y && py <= h.rect.y + h.rect.h)) continue;
        if (h.action === "buy") return this._buy(h.item);
        if (h.action === "attack") return this._attack(h.visitor);
        if (h.action === "refresh") {
          const s = this.store.get() || {};
          const nightclub = s.nightclub || {};
          this.store.set({ nightclub: { ...nightclub, visitors: this._freshVisitors() } });
          this._showToast("İçeridekiler değişti", 1400);
          this._pushNotice("🪩 Yeni tipler içeride");
          if (chance(0.16)) this._maybeCrowdTheft("masa değişimi");
          return;
        }
      }
    }
  }

  _drawSmoke(ctx) {
    for (const s of this.smoke) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(255,205,205,${s.alpha * s.life})`);
      g.addColorStop(0.45, `rgba(255,165,165,${s.alpha * 0.55 * s.life})`);
      g.addColorStop(1, "rgba(160,80,120,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawButton(ctx, rect, text, variant) {
    let fill = "rgba(0,0,0,0.42)";
    let stroke = "rgba(255,255,255,0.16)";
    if (variant === "green") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(120,50,110,0.90)");
      g.addColorStop(1, "rgba(70,24,66,0.95)");
      fill = g;
      stroke = "rgba(255,160,220,0.38)";
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
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _rarityColor(rarity) {
    switch (String(rarity || "").toLowerCase()) {
      case "rare": return "#63a8ff";
      case "epic": return "#cd87ff";
      case "legendary": return "#ffce6a";
      case "mythic": return "#ff7fce";
      default: return "#b8c0cc";
    }
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
      ctx.filter = "blur(5px) saturate(1.10) brightness(1.03)";
      this._drawCover(ctx, bg, -10, -10, W + 20, H + 20);
      ctx.restore();
    } else {
      this._drawCover(ctx, bg, 0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.42)";
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
    ctx.fillStyle = "rgba(7,7,12,0.60)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const s = this.store.get() || {};
    const p = s.player || {};
    const pvp = s.pvp || {};
    const nightclub = s.nightclub || {};

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Nightclub", panelX + 16, panelY + 28);
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText("Satın al • enerji doldur • envantere at • içeridekilere saldır", panelX + 16, panelY + 48);
    ctx.fillStyle = "rgba(255,214,120,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`YTON: ${Number(s.coins || 0).toLocaleString("tr-TR")}`, panelX + 16, panelY + 70);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(`Enerji: ${Number(p.energy || 0).toLocaleString("tr-TR")}/${Number(p.energyMax || 100).toLocaleString("tr-TR")}`, panelX + 120, panelY + 70);
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.fillText(`Genel PvP: ${Number(pvp.wins || 0).toLocaleString("tr-TR")}W / ${Number(pvp.losses || 0).toLocaleString("tr-TR")}L`, panelX + 16, panelY + 88);
    ctx.fillText(`Risk: ${Number(nightclub.theftEvents || 0).toLocaleString("tr-TR")} olay`, panelX + 180, panelY + 88);

    const backW = 78;
    const backH = 30;
    const backX = panelX + panelW - backW - 14;
    const backY = panelY + 12;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };
    this._drawButton(ctx, this.backHit, "X", "ghost");

    const contentX = panelX + 10;
    const contentY = panelY + 102;
    const contentW = panelW - 20;
    const contentH = panelH - 114;

    const notices = Array.isArray(nightclub.notices) ? nightclub.notices : [];
    const visitors = Array.isArray(nightclub.visitors) ? nightclub.visitors : [];

    const noticeSectionH = 86;
    const visitorSectionH = 150;
    const rowH = 86;
    const productSectionTop = noticeSectionH + visitorSectionH + 28;
    const fullContentH = productSectionTop + this.items.length * rowH + 20;

    this.maxScroll = Math.max(0, fullContentH - contentH);
    this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY));
    this.hitButtons = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    let y = contentY - this.scrollY;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Nightclub Akışı", contentX + 2, y + 14);
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
      ctx.fillText("Satın alım, soygun ve PvP olayları burada görünür.", contentX + 12, y + 40);
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
      ctx.fillText(`${v.tier} • Power ${v.power.toLocaleString("tr-TR")}`, x + 44, y + 38);
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

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
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
      ctx.fillText(item.icon || "🍾", contentX + 12, rowY + 20);
      ctx.fillText(item.name, contentX + 38, rowY + 20);
      ctx.fillStyle = this._rarityColor(item.rarity);
      ctx.font = "800 11px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), contentX + 38, rowY + 38);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, contentX + 126, rowY + 38);
      ctx.fillStyle = "rgba(255,214,120,0.96)";
      ctx.fillText(`${item.price} yton`, contentX + 210, rowY + 38);
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
