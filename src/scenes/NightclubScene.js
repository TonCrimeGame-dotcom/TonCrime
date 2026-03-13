export class NightclubScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.justDragged = false;
    this.maxScroll = 0;

    this.hitBuy = [];
    this.hitPvp = null;
    this.hitBack = null;

    this.toast = "";
    this.toastUntil = 0;

    this._music = null;
    this._musicUnlocked = false;
    this._pvpStartedFromNightclub = false;

    this._onFirstUserGesture = this._onFirstUserGesture.bind(this);
    this._onPvpWin = this._onPvpWin.bind(this);
    this._onPvpLose = this._onPvpLose.bind(this);

    this.items = [
      { id: "nc_alc_01", icon: "🥃", name: "Street Whiskey", energy: 4, price: 12, rarity: "Sokak", marketValue: 18, desc: "Sert viski. Hızlı enerji." },
      { id: "nc_alc_02", icon: "🍺", name: "Dark Lager", energy: 5, price: 14, rarity: "Sokak", marketValue: 20, desc: "Ucuz ama iş görür." },
      { id: "nc_alc_03", icon: "🍷", name: "House Red Wine", energy: 6, price: 17, rarity: "Sokak", marketValue: 24, desc: "Klasik kırmızı şarap." },
      { id: "nc_alc_04", icon: "🍸", name: "Neon Martini", energy: 7, price: 20, rarity: "Sokak", marketValue: 28, desc: "Geceye uygun kokteyl." },
      { id: "nc_alc_05", icon: "🥂", name: "Club Prosecco", energy: 8, price: 23, rarity: "Kulüp", marketValue: 33, desc: "Hafif lüks enerji içkisi." },
      { id: "nc_alc_06", icon: "🍹", name: "Tropical Mix", energy: 9, price: 26, rarity: "Kulüp", marketValue: 38, desc: "Tatlı ama etkili." },
      { id: "nc_alc_07", icon: "🥃", name: "Oak Reserve", energy: 10, price: 29, rarity: "Kulüp", marketValue: 43, desc: "Meşe fıçı aromalı viski." },
      { id: "nc_alc_08", icon: "🍾", name: "Velvet Champagne", energy: 11, price: 33, rarity: "Kulüp", marketValue: 48, desc: "Kulübün imza şampanyası." },
      { id: "nc_alc_09", icon: "🍷", name: "Midnight Merlot", energy: 12, price: 36, rarity: "Kulüp", marketValue: 53, desc: "Koyu ve yumuşak içim." },
      { id: "nc_alc_10", icon: "🍸", name: "Blue Venom", energy: 13, price: 40, rarity: "VIP", marketValue: 59, desc: "VIP katın ünlü kokteyli." },
      { id: "nc_alc_11", icon: "🥂", name: "Gold Spark", energy: 14, price: 44, rarity: "VIP", marketValue: 65, desc: "Altın pullu premium köpük." },
      { id: "nc_alc_12", icon: "🍺", name: "Imperial Stout", energy: 15, price: 48, rarity: "VIP", marketValue: 71, desc: "Yoğun ve ağır bira." },
      { id: "nc_alc_13", icon: "🥃", name: "Black Barrel", energy: 16, price: 52, rarity: "VIP", marketValue: 77, desc: "Yüksek dereceli viski." },
      { id: "nc_alc_14", icon: "🍾", name: "Diamond Brut", energy: 17, price: 56, rarity: "VIP", marketValue: 84, desc: "Daha sert premium köpük." },
      { id: "nc_alc_15", icon: "🍸", name: "Crimson Kiss", energy: 18, price: 61, rarity: "Elite", marketValue: 91, desc: "Elite kokteyl serisi." },
      { id: "nc_alc_16", icon: "🍷", name: "Royal Cabernet", energy: 19, price: 66, rarity: "Elite", marketValue: 98, desc: "Uzun yıllanmış şarap." },
      { id: "nc_alc_17", icon: "🥂", name: "Imperial Rosé", energy: 20, price: 71, rarity: "Elite", marketValue: 106, desc: "Pazar değeri yüksek." },
      { id: "nc_alc_18", icon: "🍹", name: "Electric Sunset", energy: 21, price: 76, rarity: "Elite", marketValue: 114, desc: "Nadir gece kokteyli." },
      { id: "nc_alc_19", icon: "🥃", name: "Smoked Bourbon", energy: 22, price: 82, rarity: "Elite", marketValue: 123, desc: "Duman aromalı bourbon." },
      { id: "nc_alc_20", icon: "🍾", name: "Velour Prestige", energy: 23, price: 88, rarity: "Legend", marketValue: 132, desc: "Legend sınıfı şampanya." },
      { id: "nc_alc_21", icon: "🍸", name: "Phantom Dry", energy: 24, price: 94, rarity: "Legend", marketValue: 141, desc: "Nadir dry martini." },
      { id: "nc_alc_22", icon: "🥂", name: "Crystal Reserve", energy: 25, price: 101, rarity: "Legend", marketValue: 151, desc: "Saf premium seri." },
      { id: "nc_alc_23", icon: "🥃", name: "King's Cask", energy: 26, price: 108, rarity: "Legend", marketValue: 162, desc: "Koleksiyonluk fıçı seçkisi." },
      { id: "nc_alc_24", icon: "🍷", name: "Velvet Noir", energy: 27, price: 115, rarity: "Legend", marketValue: 173, desc: "En pahalı kırmızı." },
      { id: "nc_alc_25", icon: "🍾", name: "Obsidian Gold", energy: 28, price: 123, rarity: "Mythic", marketValue: 185, desc: "Çok nadir kulüp şişesi." },
      { id: "nc_alc_26", icon: "🍸", name: "Night Crown", energy: 29, price: 131, rarity: "Mythic", marketValue: 197, desc: "Özel menü kokteyli." },
      { id: "nc_alc_27", icon: "🥂", name: "Saint Royale", energy: 30, price: 140, rarity: "Mythic", marketValue: 210, desc: "Özel etkinlik serisi." },
      { id: "nc_alc_28", icon: "🥃", name: "Mafia Reserve", energy: 31, price: 149, rarity: "Mythic", marketValue: 224, desc: "Ağır premium viski." },
      { id: "nc_alc_29", icon: "🍾", name: "TonCrime Luxe", energy: 33, price: 159, rarity: "Mythic", marketValue: 239, desc: "TonCrime özel seri." },
      { id: "nc_alc_30", icon: "🥂", name: "Black Diamond Brut", energy: 35, price: 170, rarity: "Mythic", marketValue: 255, desc: "En üst seviye şişe." },
    ];
  }

  onEnter() {
    this.scrollY = 0;
    this.dragging = false;
    this.justDragged = false;
    this.hitBuy = [];
    this.hitPvp = null;
    this.hitBack = null;

    this._ensureState();
    this._setupMusic();
    this._playMusic();
    this._bindEvents();

    this._pushSystemChat(`🪩 ${this._playerName()} Nightclub'a girdi.`);
  }

  onExit() {
    this.dragging = false;
    this._pauseMusic();
    this._unbindEvents();
    this._pushSystemChat(`🚪 ${this._playerName()} Nightclub'dan çıktı.`);
  }

  _ensureState() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};
    const inventory = s.inventory || {};
    const pvp = s.pvp || {};

    this.store.set({
      player: {
        ...p,
        energy: Number(p.energy ?? 10),
        energyMax: Number(p.energyMax ?? 100),
      },
      inventory: {
        ...inventory,
        items: Array.isArray(inventory.items) ? inventory.items : [],
      },
      pvp: {
        wins: Number(pvp.wins || 0),
        losses: Number(pvp.losses || 0),
        rating: Number(pvp.rating || 1000),
        currentOpponent: pvp.currentOpponent || null,
        leaderboard: Array.isArray(pvp.leaderboard) ? pvp.leaderboard : [],
        history: Array.isArray(pvp.history) ? pvp.history : [],
      },
      nightclub: {
        totalSpent: Number(nightclub.totalSpent || 0),
        totalBought: Number(nightclub.totalBought || 0),
        lastRaidAt: Number(nightclub.lastRaidAt || 0),
        raidCount: Number(nightclub.raidCount || 0),
        inventoryBought: Number(nightclub.inventoryBought || 0),
        pvpWins: Number(nightclub.pvpWins || 0),
        pvpLosses: Number(nightclub.pvpLosses || 0),
        lastPvpAt: Number(nightclub.lastPvpAt || 0),
      },
    });
  }

  _bindEvents() {
    window.addEventListener("pointerdown", this._onFirstUserGesture, { passive: true });
    window.addEventListener("touchstart", this._onFirstUserGesture, { passive: true });
    window.addEventListener("tc:pvp:win", this._onPvpWin);
    window.addEventListener("tc:pvp:lose", this._onPvpLose);
  }

  _unbindEvents() {
    window.removeEventListener("pointerdown", this._onFirstUserGesture);
    window.removeEventListener("touchstart", this._onFirstUserGesture);
    window.removeEventListener("tc:pvp:win", this._onPvpWin);
    window.removeEventListener("tc:pvp:lose", this._onPvpLose);
  }

  _onFirstUserGesture() {
    this._musicUnlocked = true;
    this._playMusic();
  }

  _setupMusic() {
    if (this._music) return;

    try {
      this._music = new Audio("./src/assets/club.mp3");
      this._music.loop = true;
      this._music.volume = 0.38;
      this._music.preload = "auto";
    } catch (_) {
      this._music = null;
    }
  }

  _playMusic() {
    if (!this._music) return;
    if (!this._musicUnlocked) return;

    const state = this.store.get() || {};
    const musicEnabled = state?.settings?.music !== false;

    if (!musicEnabled) return;

    this._music.play().catch(() => {});
  }

  _pauseMusic() {
    try {
      this._music?.pause();
    } catch (_) {}
  }

  _onPvpWin(ev) {
    if (!this._pvpStartedFromNightclub) return;
    this._pvpStartedFromNightclub = false;
    this._applyPvpResult("win", ev?.detail || {});
  }

  _onPvpLose(ev) {
    if (!this._pvpStartedFromNightclub) return;
    this._pvpStartedFromNightclub = false;
    this._applyPvpResult("lose", ev?.detail || {});
  }

  _applyPvpResult(result, detail = {}) {
    const s = this.store.get() || {};
    const pvp = s.pvp || {};
    const nightclub = s.nightclub || {};
    const playerName = this._playerName();
    const opponentName = String(detail?.opponent?.username || "Rakip");
    const now = Date.now();

    const wins = Number(pvp.wins || 0) + (result === "win" ? 1 : 0);
    const losses = Number(pvp.losses || 0) + (result === "lose" ? 1 : 0);
    const ratingChange = result === "win" ? 14 : -10;
    const rating = Math.max(0, Number(pvp.rating || 1000) + ratingChange);

    const prevBoard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.map((x) => ({ ...x })) : [];
    const prevHistory = Array.isArray(pvp.history) ? pvp.history.map((x) => ({ ...x })) : [];

    let meEntry = prevBoard.find((x) => x.id === "player_main");
    if (!meEntry) {
      meEntry = {
        id: "player_main",
        username: playerName,
        wins: 0,
        losses: 0,
        rating: Number(pvp.rating || 1000),
        source: "nightclub",
      };
      prevBoard.push(meEntry);
    }

    meEntry.username = playerName;
    meEntry.wins = wins;
    meEntry.losses = losses;
    meEntry.rating = rating;
    meEntry.source = "nightclub";

    prevBoard.sort((a, b) => {
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.wins || 0) - Number(a.wins || 0);
    });

    const rankedBoard = prevBoard.slice(0, 50).map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));

    prevHistory.unshift({
      id: `nightclub_pvp_${now}`,
      result,
      opponent: opponentName,
      ts: now,
      source: "nightclub",
      ratingAfter: rating,
    });

    this.store.set({
      pvp: {
        ...pvp,
        wins,
        losses,
        rating,
        currentOpponent: detail?.opponent || null,
        leaderboard: rankedBoard,
        history: prevHistory.slice(0, 30),
      },
      nightclub: {
        ...nightclub,
        pvpWins: Number(nightclub.pvpWins || 0) + (result === "win" ? 1 : 0),
        pvpLosses: Number(nightclub.pvpLosses || 0) + (result === "lose" ? 1 : 0),
        lastPvpAt: now,
      },
    });

    if (result === "win") {
      this._showToast(`🏆 PvP kazandın • ${opponentName}`, 1800);
      this._pushSystemChat(`🏆 ${playerName}, ${opponentName} karşısında PvP kazandı.`);
    } else {
      this._showToast(`💥 PvP kaybettin • ${opponentName}`, 1800);
      this._pushSystemChat(`💥 ${playerName}, ${opponentName} karşısında PvP kaybetti.`);
    }
  }

  _playerName() {
    const s = this.store.get() || {};
    return String(s?.player?.username || "Player");
  }

  _safe() {
    const s = this.store.get() || {};
    return s?.ui?.safe || {
      x: 0,
      y: 0,
      w: window.innerWidth || 390,
      h: window.innerHeight || 844,
    };
  }

  _showToast(text, ms = 1400) {
    this.toast = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _getBg() {
    if (typeof this.assets?.getImage === "function") return this.assets.getImage("nightclub");
    if (typeof this.assets?.get === "function") return this.assets.get("nightclub");
    if (this.assets?.images instanceof Map) {
      const entry = this.assets.images.get("nightclub");
      return entry?.img || null;
    }
    return this.assets?.images?.nightclub || null;
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _fillRoundRect(ctx, x, y, w, h, r) {
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  _strokeRoundRect(ctx, x, y, w, h, r) {
    this._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }

  _pointInRect(px, py, r) {
    return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  _fmt(n) {
    return Number(n || 0).toLocaleString("tr-TR");
  }

  _rarityColor(rarity) {
    switch (String(rarity || "").toLowerCase()) {
      case "sokak":
        return "#b0b6c2";
      case "kulüp":
        return "#7fd0ff";
      case "vip":
        return "#ff9ecb";
      case "elite":
        return "#c77dff";
      case "legend":
        return "#ffc86b";
      case "mythic":
        return "#ff6b6b";
      default:
        return "#ffffff";
    }
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#130b11";
      ctx.fillRect(x, y, w, h);
      return;
    }

    const iw = img.width || img.naturalWidth || 1;
    const ih = img.height || img.naturalHeight || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  _clampScroll(viewH, contentH) {
    this.maxScroll = Math.max(0, contentH - viewH);
    if (this.scrollY < 0) this.scrollY = 0;
    if (this.scrollY > this.maxScroll) this.scrollY = this.maxScroll;
  }

  _escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _pushSystemChat(text) {
    const s = this.store.get() || {};
    const chat = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    const ts = Date.now();

    chat.push({
      id: `sys_${ts}_${Math.random().toString(36).slice(2, 7)}`,
      type: "system",
      username: "SYSTEM",
      text: String(text || ""),
      ts,
    });

    this.store.set({ chatLog: chat });

    try {
      window.dispatchEvent(
        new CustomEvent("tc:chat:push", {
          detail: {
            id: `sys_${ts}`,
            type: "system",
            username: "SYSTEM",
            text: String(text || ""),
            ts,
          },
        })
      );
    } catch (_) {}

    try {
      const el = document.getElementById("chatMessages");
      if (el) {
        const row = document.createElement("div");
        row.className = "msg";

        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");

        row.innerHTML = `
          <span class="meta">${hh}:${mm}</span>
          <span><b>SYSTEM</b> ${this._escapeHtml(String(text || ""))}</span>
        `;
        el.appendChild(row);
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {}
  }

  _mergeInventoryItem(item) {
    const s = this.store.get() || {};
    const inventory = s.inventory || {};
    const items = Array.isArray(inventory.items) ? inventory.items.map((x) => ({ ...x })) : [];

    const existing = items.find(
      (x) =>
        String(x.name || "").toLowerCase() === String(item.name || "").toLowerCase() &&
        String(x.rarity || "").toLowerCase() === String(item.rarity || "").toLowerCase()
    );

    if (existing) {
      existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
      existing.marketPrice = Math.max(Number(existing.marketPrice || 0), Number(item.marketPrice || 0));
      existing.sellPrice = Math.max(Number(existing.sellPrice || 0), Number(item.sellPrice || 0));
      existing.energyGain = Math.max(Number(existing.energyGain || 0), Number(item.energyGain || 0));
    } else {
      items.unshift({ ...item });
    }

    this.store.set({
      inventory: {
        ...inventory,
        items,
      },
    });
  }

_openPvp() {
  try {
    this.scenes.go("pvp");
    this._showToast("PvP açıldı");
    this._pushSystemChat(`⚔️ ${this._playerName()} Nightclub içinden PvP başlattı.`);
  } catch (_) {
    this._showToast("PvP açılamadı");
  }
}

  _applyPoliceRaid(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};

    const energy = Number(p.energy || 0);
    const lossEnergy = Math.max(4, Math.min(22, Math.ceil(Number(item.energy || 0) * 0.8)));
    const lossCoins = Math.max(3, Math.floor(Number(item.price || 0) * 0.18));

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - lossCoins),
      player: {
        ...p,
        energy: Math.max(0, energy - lossEnergy),
      },
      nightclub: {
        ...nightclub,
        lastRaidAt: Date.now(),
        raidCount: Number(nightclub.raidCount || 0) + 1,
      },
    });

    this._showToast(`🚓 Polis baskını! -${lossEnergy} enerji / -${lossCoins} yton`, 1800);
    this._pushSystemChat(
      `🚓 Polis baskını Nightclub'da patladı. ${this._playerName()} ${lossEnergy} enerji ve ${lossCoins} yton kaybetti.`
    );
  }

  _buy(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};
    const coins = Number(s.coins || 0);

    if (coins < Number(item.price || 0)) {
      this._showToast("Yetersiz yton");
      return;
    }

    const inventoryItem = {
      id: `inv_nightclub_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "consumable",
      icon: item.icon || "🍾",
      name: item.name,
      rarity: item.rarity || "Kulüp",
      qty: 1,
      usable: true,
      sellable: true,
      marketable: true,
      energyGain: Number(item.energy || 0),
      sellPrice: Math.max(1, Math.floor(Number(item.price || 0) * 0.68)),
      marketPrice: Number(item.marketValue || item.price || 0),
      desc: item.desc || "Nightclub ürünü.",
      source: "nightclub",
      category: "alcohol",
      createdAt: Date.now(),
    };

    this.store.set({
      coins: coins - Number(item.price || 0),
      nightclub: {
        ...nightclub,
        totalSpent: Number(nightclub.totalSpent || 0) + Number(item.price || 0),
        totalBought: Number(nightclub.totalBought || 0) + 1,
        inventoryBought: Number(nightclub.inventoryBought || 0) + 1,
      },
    });

    this._mergeInventoryItem(inventoryItem);

    this._showToast(`${item.name} envantere eklendi`, 1500);
    this._pushSystemChat(
      `🍾 ${this._playerName()} ${item.name} satın aldı. (-${item.price} yton / envantere eklendi)`
    );

    if (Math.random() < 0.20) {
      this._applyPoliceRaid(item);
    }
  }

  update() {
    const safe = this._safe();
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    const topReserved = Number(this.store.get()?.ui?.hudReservedTop || 82);
    const bottomReserved = Number(this.store.get()?.ui?.chatReservedBottom || 82);

    const panelX = safe.x + 14;
    const panelY = safe.y + topReserved;
    const panelW = safe.w - 28;
    const panelH = safe.h - topReserved - bottomReserved - 10;

    const listX = panelX + 10;
    const listY = panelY + 104;
    const listW = panelW - 20;
    const listH = panelH - 116;

    const rowH = 84;
    const contentH = this.items.length * (rowH + 10);

    this._clampScroll(listH, contentH);

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.justDragged = false;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this._musicUnlocked = true;
      this._playMusic();
    }

    if (this.dragging && this.input?.isDown?.()) {
      const dy = py - this.downY;
      if (Math.abs(dy) > 6) this.justDragged = true;
      this.scrollY = this.startScrollY - dy;
      this._clampScroll(listH, contentH);
    }

    if (this.dragging && this.input?.justReleased?.()) {
      if (!this.justDragged) {
        if (this._pointInRect(px, py, this.hitBack)) {
          this.scenes.go("home");
          this.dragging = false;
          this.justDragged = false;
          return;
        }

        if (this._pointInRect(px, py, this.hitPvp)) {
          this._openPvp();
          this.dragging = false;
          this.justDragged = false;
          return;
        }

        for (const hit of this.hitBuy) {
          if (this._pointInRect(px, py, hit.rect)) {
            this._buy(hit.item);
            break;
          }
        }
      }

      this.dragging = false;
      this.justDragged = false;
    }
  }

  render(ctx, w, h) {
    const safe = this._safe();
    const bg = this._getBg();

    this.hitBuy = [];
    this.hitPvp = null;
    this.hitBack = null;

    this._drawCover(ctx, bg, 0, 0, w, h);

    const overlay = ctx.createLinearGradient(0, 0, 0, h);
    overlay.addColorStop(0, "rgba(8,0,14,0.40)");
    overlay.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, w, h);

    const state = this.store.get() || {};
    const nightclub = state.nightclub || {};
    const pvp = state.pvp || {};
    const coins = Number(state.coins || 0);
    const energy = Number(state?.player?.energy || 0);
    const energyMax = Math.max(1, Number(state?.player?.energyMax || 100));
    const topReserved = Number(state?.ui?.hudReservedTop || 82);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    const panelX = safe.x + 14;
    const panelY = safe.y + topReserved;
    const panelW = safe.w - 28;
    const panelH = safe.h - topReserved - bottomReserved - 10;

    ctx.fillStyle = "rgba(10,8,14,0.62)";
    this._fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    this._strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 18);

    const titleX = panelX + 16;
    const titleY = panelY + 30;

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Nightclub", titleX, titleY);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "13px system-ui";
    ctx.fillText("Alkol satın al, envantere at, PvP risk al.", titleX, titleY + 22);

    this.hitBack = { x: panelX + 14, y: panelY + 52, w: 86, h: 32 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    this._fillRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    this._strokeRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 13px system-ui";
    ctx.fillText("← Geri", this.hitBack.x + 16, this.hitBack.y + 21);

    const rightInfoX = panelX + panelW - 170;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd36c";
    ctx.font = "900 12px system-ui";
    ctx.fillText(`YTON: ${this._fmt(coins)}`, rightInfoX, panelY + 24);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`Enerji: ${energy}/${energyMax}`, rightInfoX, panelY + 42);

    ctx.fillStyle = "rgba(255,165,165,0.95)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(
      `PvP: ${this._fmt(pvp.wins)}W / ${this._fmt(pvp.losses)}L`,
      rightInfoX,
      panelY + 60
    );

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText(
      `Envanter alım: ${this._fmt(nightclub.inventoryBought || 0)}`,
      rightInfoX,
      panelY + 78
    );

    this.hitPvp = { x: panelX + panelW - 126, y: panelY + 48, w: 104, h: 34 };
    const pvpGrad = ctx.createLinearGradient(this.hitPvp.x, this.hitPvp.y, this.hitPvp.x, this.hitPvp.y + this.hitPvp.h);
    pvpGrad.addColorStop(0, "rgba(170,34,46,0.72)");
    pvpGrad.addColorStop(1, "rgba(104,16,24,0.82)");
    ctx.fillStyle = pvpGrad;
    this._fillRoundRect(ctx, this.hitPvp.x, this.hitPvp.y, this.hitPvp.w, this.hitPvp.h, 12);
    ctx.strokeStyle = "rgba(255,180,180,0.22)";
    this._strokeRoundRect(ctx, this.hitPvp.x, this.hitPvp.y, this.hitPvp.w, this.hitPvp.h, 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("⚔ PvP Saldır", this.hitPvp.x + this.hitPvp.w / 2, this.hitPvp.y + 22);

    const listX = panelX + 10;
    const listY = panelY + 104;
    const listW = panelW - 20;
    const listH = panelH - 116;

    ctx.save();
    this._roundRect(ctx, listX, listY, listW, listH, 16);
    ctx.clip();

    const rowsBg = ctx.createLinearGradient(0, listY, 0, listY + listH);
    rowsBg.addColorStop(0, "rgba(0,0,0,0.14)");
    rowsBg.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = rowsBg;
    ctx.fillRect(listX, listY, listW, listH);

    let rowY = listY + 6 - this.scrollY;
    const rowH = 84;
    const gap = 10;

    for (const item of this.items) {
      if (rowY + rowH < listY - 20) {
        rowY += rowH + gap;
        continue;
      }
      if (rowY > listY + listH + 20) break;

      ctx.fillStyle = "rgba(0,0,0,0.32)";
      this._fillRoundRect(ctx, listX + 2, rowY, listW - 4, rowH, 16);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      this._strokeRoundRect(ctx, listX + 2, rowY, listW - 4, rowH, 16);

      const rarity = String(item.rarity || "");
      const rColor = this._rarityColor(rarity);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(item.icon || "🍾", listX + 14, rowY + 26);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px system-ui";
      ctx.fillText(item.name, listX + 50, rowY + 22);

      ctx.fillStyle = rColor;
      ctx.font = "800 11px system-ui";
      ctx.fillText(`Sınıf: ${rarity}`, listX + 50, rowY + 40);

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, listX + 50, rowY + 58);

      ctx.fillStyle = "#ffd36c";
      ctx.font = "12px system-ui";
      ctx.fillText(`${item.price} yton`, listX + 150, rowY + 58);

      ctx.fillStyle = "rgba(255,194,224,0.90)";
      ctx.fillText(`Pazar: ${item.marketValue} yton`, listX + 230, rowY + 58);

      const buyRect = { x: listX + listW - 112, y: rowY + 18, w: 96, h: 40 };
      this.hitBuy.push({ rect: buyRect, item });

      const buyGrad = ctx.createLinearGradient(buyRect.x, buyRect.y, buyRect.x, buyRect.y + buyRect.h);
      buyGrad.addColorStop(0, "rgba(28,28,36,0.92)");
      buyGrad.addColorStop(1, "rgba(10,10,14,0.96)");
      ctx.fillStyle = buyGrad;
      this._fillRoundRect(ctx, buyRect.x, buyRect.y, buyRect.w, buyRect.h, 16);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      this._strokeRoundRect(ctx, buyRect.x, buyRect.y, buyRect.w, buyRect.h, 16);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "900 14px system-ui";
      ctx.fillText("Satın Al", buyRect.x + buyRect.w / 2, buyRect.y + 24);

      rowY += rowH + gap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = listX + listW - 5;
      const trackY = listY + 10;
      const trackH = listH - 20;
      const thumbH = Math.max(40, (listH / (this.maxScroll + listH)) * trackH);
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      this._fillRoundRect(ctx, trackX, trackY, 4, trackH, 3);
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      this._fillRoundRect(ctx, trackX, thumbY, 4, thumbH, 3);
    }

    if (this.toast && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 24, Math.max(180, ctx.measureText(this.toast).width + 36));
      const th = 42;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 14;

      ctx.fillStyle = "rgba(0,0,0,0.78)";
      this._fillRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      this._strokeRoundRect(ctx, tx, ty, tw, th, 14);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(this.toast, tx + tw / 2, ty + 25);
    }
  }
}

