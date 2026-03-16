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

function fitText(ctx, text, maxW, startSize, minSize = 9, weight = 900) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px system-ui`;
    if (ctx.measureText(String(text || "")).width <= maxW) return size;
    size -= 1;
  }
  return minSize;
}

function drawCover(ctx, img, x, y, w, h) {
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

export class MissionsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = [];
    this.toastText = "";
    this.toastUntil = 0;

    this._bound = false;
    this._dailyChecked = false;

    this.telegramGroups = [
      { id: "tg_main", title: "TONCRIME ANA GRUP", subtitle: "+50 yton", url: "https://t.me/toncrime" },
      { id: "tg_news", title: "TONCRIME HABERLER", subtitle: "+50 yton", url: "https://t.me/toncrime_news" },
      { id: "tg_chat", title: "TONCRIME SOHBET", subtitle: "+50 yton", url: "https://t.me/toncrime_chat" },
      { id: "tg_event", title: "TONCRIME ETKİNLİK", subtitle: "+50 yton", url: "https://t.me/toncrime_events" },
    ];

    this.referralRewards = [
      { target: 1, reward: "100 YTON HEDİYE", type: "coins", amount: 100 },
      { target: 5, reward: "500 YTON HEDİYE", type: "coins", amount: 500 },
      { target: 10, reward: "ORTA KALİTE SİLAH", type: "weapon", weaponName: "Orta Kalite Silah", weaponBonus: "+12%" },
      { target: 100, reward: "YÜKSEK KALİTE AĞIR SİLAH", type: "weapon", weaponName: "Ağır Silah", weaponBonus: "+28%" },
      { target: 1000, reward: "PREMIUM ÜYELİK", type: "premium" },
    ];
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.hit = [];
    this._ensureState();
    this._bindEvents();
    this._applyDailyLogin();
  }

  onExit() {
    this.dragging = false;
  }

  _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _showToast(text, ms = 1400) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _safeRect() {
    const s = this.store.get();
    const safe = s?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _getBg() {
    if (typeof this.assets?.getImage === "function") {
      return this.assets.getImage("missions") || this.assets.getImage("background");
    }
    if (typeof this.assets?.get === "function") {
      return this.assets.get("missions") || this.assets.get("background");
    }
    return this.assets?.images?.missions || this.assets?.images?.background || null;
  }

  _ensureState() {
    const s = this.store.get() || {};
    const missions = s.missions || {};
    const dailyLogin = s.dailyLogin || {};

    this.store.set({
      missions: {
        ...missions,
        lastDayKey: missions.lastDayKey || null,
        iqArenaPlayedToday: Number(missions.iqArenaPlayedToday || 0),
        iqArenaClaimedToday: !!missions.iqArenaClaimedToday,
        cageFightPlayedToday: Number(missions.cageFightPlayedToday || 0),
        cageFightClaimedToday: !!missions.cageFightClaimedToday,
        adsWatchedToday: Number(missions.adsWatchedToday || 0),
        adsEnergyGivenToday: Number(missions.adsEnergyGivenToday || 0),
        buildingEnergyToday: Number(missions.buildingEnergyToday || 0),
        buildingClaimedToday: !!missions.buildingClaimedToday,
        telegramJoinedMap: { ...(missions.telegramJoinedMap || {}) },
        telegramClaimedMap: { ...(missions.telegramClaimedMap || {}) },
        referrals: Number(missions.referrals || 0),
        referralClaimedMap: { ...(missions.referralClaimedMap || {}) },
      },
      dailyLogin: {
        ...dailyLogin,
        lastClaimDay: dailyLogin.lastClaimDay || null,
        streak: Number(dailyLogin.streak || 0),
        totalClaims: Number(dailyLogin.totalClaims || 0),
        weeklyClaimDay: dailyLogin.weeklyClaimDay || null,
      },
    });

    this._resetDailyIfNeeded();
  }

  _resetDailyIfNeeded() {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    const today = this._todayKey();
    if (missions.lastDayKey === today) return;

    missions.lastDayKey = today;
    missions.iqArenaPlayedToday = 0;
    missions.iqArenaClaimedToday = false;
    missions.cageFightPlayedToday = 0;
    missions.cageFightClaimedToday = false;
    missions.adsWatchedToday = 0;
    missions.adsEnergyGivenToday = 0;
    missions.buildingEnergyToday = 0;
    missions.buildingClaimedToday = false;

    this.store.set({ missions });
  }

  _applyDailyLogin() {
    if (this._dailyChecked) return;
    this._dailyChecked = true;

    const s = this.store.get();
    const daily = { ...(s.dailyLogin || {}) };
    const today = this._todayKey();
    if (daily.lastClaimDay === today) return;

    const lastDate = daily.lastClaimDay ? new Date(`${daily.lastClaimDay}T00:00:00`) : null;
    const currentDate = new Date(`${today}T00:00:00`);
    const diffDays = lastDate ? Math.round((currentDate - lastDate) / 86400000) : null;

    if (diffDays === 1) daily.streak = Number(daily.streak || 0) + 1;
    else daily.streak = 1;

    daily.lastClaimDay = today;
    daily.totalClaims = Number(daily.totalClaims || 0) + 1;

    let coinsAdd = 30;
    if (daily.streak % 7 === 0 && daily.weeklyClaimDay !== today) {
      coinsAdd += 70;
      daily.weeklyClaimDay = today;
    }

    this.store.set({
      coins: Number(s.coins || 0) + coinsAdd,
      dailyLogin: daily,
    });

    this._showToast(daily.streak % 7 === 0 ? "+30 yton +70 yton" : "+30 yton");
  }

  _bindEvents() {
    if (this._bound) return;
    this._bound = true;

    this._onIqArenaPlayed = () => this._incMission("iqArenaPlayedToday", 1, 20);
    this._onCageFightPlayed = () => this._incMission("cageFightPlayedToday", 1, 20);
    this._onReferral = (ev) => this._incMission("referrals", Number(ev?.detail?.count || 1));
    this._onBuildingPurchase = (ev) => this._incMission("buildingEnergyToday", Number(ev?.detail?.energy || 0), 100);
    this._onTelegramJoin = (ev) => {
      const id = String(ev?.detail?.id || "").trim();
      if (!id) return;
      const s = this.store.get();
      const missions = { ...(s.missions || {}) };
      missions.telegramJoinedMap = { ...(missions.telegramJoinedMap || {}), [id]: true };
      this.store.set({ missions });
    };

    window.addEventListener("tc:missions:iqArenaPlayed", this._onIqArenaPlayed);
    window.addEventListener("tc:missions:cageFightPlayed", this._onCageFightPlayed);
    window.addEventListener("tc:missions:referral", this._onReferral);
    window.addEventListener("tc:missions:buildingPurchase", this._onBuildingPurchase);
    window.addEventListener("tc:missions:telegramJoin", this._onTelegramJoin);

    window.addEventListener("tc:pvp:win", this._onIqArenaPlayed);
    window.addEventListener("tc:pvp:lose", this._onIqArenaPlayed);
  }

  _incMission(key, add = 1, cap = null) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    const next = Number(missions[key] || 0) + Number(add || 0);
    missions[key] = cap == null ? next : Math.min(cap, next);
    this.store.set({ missions });
  }

  _grantEnergy(n) {
    const s = this.store.get();
    const p = { ...(s.player || {}) };
    const max = Math.max(1, Number(p.energyMax || 100));
    p.energy = clamp(Number(p.energy || 0) + Number(n || 0), 0, max);
    this.store.set({ player: p });
  }

  _taskList() {
    const s = this.store.get();
    const m = s.missions || {};
    const daily = s.dailyLogin || {};

    return [
      {
        key: "daily_login",
        title: "GÜNLÜK GİRİŞ",
        desc: "Her gün +30 yton. 7 gün seri girişte +70 yton bonus.",
        progress: daily.lastClaimDay === this._todayKey() ? 1 : 0,
        max: 1,
        reward: "+30 yton / 7 gün +70 yton",
        claimed: daily.lastClaimDay === this._todayKey(),
        claimable: false,
        kind: "info",
      },
      {
        key: "ads",
        title: "REKLAM İZLEME",
        desc: "Günlük 20 reklam. Her reklam 1 enerji verir.",
        progress: Number(m.adsWatchedToday || 0),
        max: 20,
        reward: "+1 enerji / reklam",
        claimed: false,
        claimable: Number(m.adsWatchedToday || 0) < 20,
        actionLabel: "İZLE",
      },
      {
        key: "iq_arena",
        title: "GÜNLÜK IQ ARENA",
        desc: "20 oyun oyna ve ödülü al.",
        progress: Number(m.iqArenaPlayedToday || 0),
        max: 20,
        reward: "+60 yton",
        claimed: !!m.iqArenaClaimedToday,
        claimable: Number(m.iqArenaPlayedToday || 0) >= 20 && !m.iqArenaClaimedToday,
        actionLabel: m.iqArenaClaimedToday ? "ALINDI" : Number(m.iqArenaPlayedToday || 0) >= 20 ? "AL" : "OYNA",
      },
      {
        key: "cage_fight",
        title: "GÜNLÜK KAFES DÖVÜŞÜ",
        desc: "20 oyun oyna ve ödülü al.",
        progress: Number(m.cageFightPlayedToday || 0),
        max: 20,
        reward: "+60 yton",
        claimed: !!m.cageFightClaimedToday,
        claimable: Number(m.cageFightPlayedToday || 0) >= 20 && !m.cageFightClaimedToday,
        actionLabel: m.cageFightClaimedToday ? "ALINDI" : Number(m.cageFightPlayedToday || 0) >= 20 ? "AL" : "OYNA",
      },
      {
        key: "building_buy",
        title: "BİNALARDAN SATIN ALIM",
        desc: "Binalardan toplam 100 enerji al.",
        progress: Number(m.buildingEnergyToday || 0),
        max: 100,
        reward: "+50 yton",
        claimed: !!m.buildingClaimedToday,
        claimable: Number(m.buildingEnergyToday || 0) >= 100 && !m.buildingClaimedToday,
        actionLabel: m.buildingClaimedToday ? "ALINDI" : Number(m.buildingEnergyToday || 0) >= 100 ? "AL" : "TAKİP",
      },
    ];
  }

  _claimTask(key) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    let coins = Number(s.coins || 0);
    let player = { ...(s.player || {}) };
    let premium = !!s.premium;

    if (key === "iq_arena" && Number(missions.iqArenaPlayedToday || 0) >= 20 && !missions.iqArenaClaimedToday) {
      missions.iqArenaClaimedToday = true;
      coins += 60;
    } else if (key === "cage_fight" && Number(missions.cageFightPlayedToday || 0) >= 20 && !missions.cageFightClaimedToday) {
      missions.cageFightClaimedToday = true;
      coins += 60;
    } else if (key === "building_buy" && Number(missions.buildingEnergyToday || 0) >= 100 && !missions.buildingClaimedToday) {
      missions.buildingClaimedToday = true;
      coins += 50;
    } else {
      return;
    }

    this.store.set({ coins, missions, player, premium });
    this._showToast("Ödül alındı");
  }

  _watchAd() {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    if (Number(missions.adsWatchedToday || 0) >= 20) {
      this._showToast("Bugün reklam limiti dolu");
      return;
    }

    missions.adsWatchedToday = Number(missions.adsWatchedToday || 0) + 1;
    missions.adsEnergyGivenToday = Number(missions.adsEnergyGivenToday || 0) + 1;
    this.store.set({ missions });
    this._grantEnergy(1);
    this._showToast("+1 enerji");
  }

  _joinTelegram(id, url) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    missions.telegramJoinedMap = { ...(missions.telegramJoinedMap || {}), [id]: true };
    this.store.set({ missions });

    try {
      if (url) window.open(url, "_blank");
    } catch (_) {}

    this._showToast("Telegram görevi işaretlendi");
  }

  _claimTelegram(id) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    const joined = !!missions.telegramJoinedMap?.[id];
    const claimed = !!missions.telegramClaimedMap?.[id];
    if (!joined || claimed) return;

    missions.telegramClaimedMap = { ...(missions.telegramClaimedMap || {}), [id]: true };
    this.store.set({
      missions,
      coins: Number(s.coins || 0) + 50,
    });
    this._showToast("+50 yton");
  }

  _claimReferral(target) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    const claimedMap = { ...(missions.referralClaimedMap || {}) };
    const current = Number(missions.referrals || 0);
    if (current < target || claimedMap[target]) return;

    let patch = {
      missions: {
        ...missions,
        referralClaimedMap: { ...claimedMap, [target]: true },
      },
    };

    if (target === 1) patch.coins = Number(s.coins || 0) + 100;
    if (target === 5) patch.coins = Number(s.coins || 0) + 500;
    if (target === 10) {
      patch.player = {
        ...(s.player || {}),
        weaponName: "Orta Kalite Silah",
        weaponBonus: "+12%",
      };
    }
    if (target === 100) {
      patch.player = {
        ...(s.player || {}),
        weaponName: "Yüksek Kalite Ağır Silah",
        weaponBonus: "+28%",
      };
    }
    if (target === 1000) patch.premium = true;

    this.store.set(patch);
    this._showToast("Davet ödülü alındı");
  }

  _simulateOpenPvp(mode) {
    try {
      if (mode === "iq") window.dispatchEvent(new CustomEvent("tc:missions:openMode", { detail: { mode: "iq" } }));
      if (mode === "cage") window.dispatchEvent(new CustomEvent("tc:missions:openMode", { detail: { mode: "cage" } }));
      window.dispatchEvent(new Event("tc:openPvp"));
    } catch (_) {}
  }

  _goBack() {
    try {
      this.scenes.go("home");
      return;
    } catch (_) {}

    try {
      window.location.href = "./index.html";
    } catch (_) {}
  }

  update() {
    this._resetDailyIfNeeded();

    const px = this.input.pointer?.x || 0;
    const py = this.input.pointer?.y || 0;

    if (this.input.justPressed()) {
      this.dragging = true;
      this.downY = py;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input.isDown()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input.justReleased()) {
      this.dragging = false;
      if (!this.clickCandidate) return;

      for (const h of this.hit) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.type === "close") return this._goBack();
        if (h.type === "watchAd") return this._watchAd();
        if (h.type === "claimTask") return this._claimTask(h.key);
        if (h.type === "openPvp") return this._simulateOpenPvp(h.mode);
        if (h.type === "joinTelegram") return this._joinTelegram(h.id, h.url);
        if (h.type === "claimTelegram") return this._claimTelegram(h.id);
        if (h.type === "claimReferral") return this._claimReferral(h.target);
      }
    }
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);
    const safe = this._safeRect();
    const bg = this._getBg();

    const isSmall = safe.w <= 430;
    const panelX = safe.x + (isSmall ? 8 : 12);
    const panelY = Math.max(safe.y + 76, 76);
    const panelW = safe.w - (isSmall ? 16 : 24);
    const panelH = safe.h - (isSmall ? 146 : 154);
    const pad = isSmall ? 10 : 14;
    const gap = isSmall ? 8 : 10;
    const listX = panelX + pad;
    const listY = panelY + 64;
    const listW = panelW - pad * 2;
    const listH = panelH - 78;

    this.hit = [];

    ctx.clearRect(0, 0, W, H);
    drawCover(ctx, bg, 0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.54)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(7,10,16,0.76)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 18);

    const titleSize = fitText(ctx, "GÖREVLER", panelW - 120, isSmall ? 20 : 22, 16);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${titleSize}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("GÖREVLER", panelX + pad, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `${isSmall ? 10 : 11}px system-ui`;
    ctx.fillText("PvP sayfa yapısına uyumlu • mobil optimize", panelX + pad, panelY + 46);

    const closeRect = { x: panelX + panelW - 42, y: panelY + 12, w: 30, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, closeRect.x + 0.5, closeRect.y + 0.5, closeRect.w - 1, closeRect.h - 1, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2 + 0.5);
    this.hit.push({ type: "close", rect: closeRect });

    const tasks = this._taskList();
    const s = this.store.get();
    const missions = s.missions || {};
    const daily = s.dailyLogin || {};
    const streak = Number(daily.streak || 0);

    const blocks = [];
    blocks.push({ type: "loginSummary", h: isSmall ? 88 : 96 });
    blocks.push({ type: "tasks", task: tasks[1], h: isSmall ? 106 : 98 });
    blocks.push({ type: "tasks", task: tasks[2], h: isSmall ? 106 : 98 });
    blocks.push({ type: "tasks", task: tasks[3], h: isSmall ? 106 : 98 });
    blocks.push({ type: "tasks", task: tasks[4], h: isSmall ? 106 : 98 });
    blocks.push({ type: "telegramBox", h: isSmall ? 214 : 202 });
    blocks.push({ type: "referralBox", h: isSmall ? 242 : 228 });

    const contentH = blocks.reduce((sum, b) => sum + b.h, 0) + (blocks.length - 1) * gap + 6;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    let y = listY - this.scrollY;
    for (const block of blocks) {
      if (block.type === "loginSummary") {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "#fff";
        ctx.font = `900 ${isSmall ? 14 : 15}px system-ui`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("GÜNLÜK GİRİŞ", listX + 12, y + 22);

        ctx.fillStyle = "rgba(255,255,255,0.74)";
        ctx.font = `${isSmall ? 11 : 12}px system-ui`;
        ctx.fillText("Bugün: +30 yton", listX + 12, y + 42);
        ctx.fillText(`7 Gün Seri: +70 yton`, listX + 12, y + 60);
        ctx.fillText(`Aktif Seri: ${streak} gün`, listX + 12, y + 78);

        const pillW = isSmall ? 132 : 150;
        const pillH = 34;
        const pillX = listX + listW - pillW - 12;
        const pillY = y + 24;
        const claimedToday = daily.lastClaimDay === this._todayKey();

        ctx.fillStyle = claimedToday ? "rgba(32,120,58,0.82)" : "rgba(242,211,107,0.20)";
        fillRoundRect(ctx, pillX, pillY, pillW, pillH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        strokeRoundRect(ctx, pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${isSmall ? 11 : 12}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(claimedToday ? "BUGÜN ALINDI" : "HAZIR", pillX + pillW / 2, pillY + pillH / 2 + 0.5);
      }

      if (block.type === "tasks") {
        const t = block.task;
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        const rightW = isSmall ? 82 : 88;
        const textMaxW = listW - rightW - 28;
        const tSize = fitText(ctx, t.title, textMaxW, isSmall ? 13 : 14, 11);
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${tSize}px system-ui`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(t.title, listX + 12, y + 22);

        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = `${isSmall ? 10 : 11}px system-ui`;
        const desc = String(t.desc || "");
        ctx.fillText(desc, listX + 12, y + 42);
        ctx.fillText(`${t.progress}/${t.max}`, listX + 12, y + 60);
        ctx.fillText(t.reward, listX + 12, y + 78);

        const barX = listX + 12;
        const barY = y + block.h - 22;
        const barW = listW - rightW - 26;
        const barH = 10;
        const ratio = clamp(Number(t.progress || 0) / Math.max(1, Number(t.max || 1)), 0, 1);

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, barX, barY, barW, barH, 6);
        ctx.fillStyle = ratio >= 1 ? "rgba(86,208,122,0.92)" : "rgba(255,185,74,0.92)";
        fillRoundRect(ctx, barX, barY, Math.max(8, barW * ratio), barH, 6);

        const btnRect = { x: listX + listW - rightW, y: y + block.h / 2 - 18, w: rightW - 12, h: 36 };
        const label = t.actionLabel || (t.claimed ? "ALINDI" : t.claimable ? "AL" : "BEKLİYOR");
        let fill = "rgba(255,255,255,0.08)";
        if (label === "İZLE" || label === "OYNA") fill = "rgba(255,185,74,0.18)";
        if (label === "AL") fill = "rgba(86,208,122,0.22)";
        if (label === "ALINDI") fill = "rgba(32,120,58,0.82)";

        ctx.fillStyle = fill;
        fillRoundRect(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        strokeRoundRect(ctx, btnRect.x + 0.5, btnRect.y + 0.5, btnRect.w - 1, btnRect.h - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${isSmall ? 11 : 12}px system-ui`;
        ctx.fillText(label, btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2 + 0.5);

        if (t.key === "ads" && !t.claimed) this.hit.push({ type: "watchAd", rect: btnRect });
        if (t.key === "iq_arena") {
          if (t.claimable) this.hit.push({ type: "claimTask", key: t.key, rect: btnRect });
          else if (!t.claimed) this.hit.push({ type: "openPvp", mode: "iq", rect: btnRect });
        }
        if (t.key === "cage_fight") {
          if (t.claimable) this.hit.push({ type: "claimTask", key: t.key, rect: btnRect });
          else if (!t.claimed) this.hit.push({ type: "openPvp", mode: "cage", rect: btnRect });
        }
        if (t.key === "building_buy" && t.claimable) this.hit.push({ type: "claimTask", key: t.key, rect: btnRect });
      }

      if (block.type === "telegramBox") {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "#fff";
        ctx.font = `900 ${isSmall ? 14 : 15}px system-ui`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("TELEGRAM GRUPLARINA KATIL", listX + 12, y + 22);

        const innerX = listX + 10;
        const innerY = y + 34;
        const innerW = listW - 20;
        const rowH = 38;
        const rowGap = 8;

        for (let i = 0; i < this.telegramGroups.length; i++) {
          const item = this.telegramGroups[i];
          const ry = innerY + i * (rowH + rowGap);
          const joined = !!missions.telegramJoinedMap?.[item.id];
          const claimed = !!missions.telegramClaimedMap?.[item.id];

          ctx.fillStyle = "rgba(255,255,255,0.06)";
          fillRoundRect(ctx, innerX, ry, innerW, rowH, 12);
          ctx.strokeStyle = "rgba(255,255,255,0.10)";
          strokeRoundRect(ctx, innerX + 0.5, ry + 0.5, innerW - 1, rowH - 1, 12);

          ctx.fillStyle = "#fff";
          ctx.font = `800 ${isSmall ? 10 : 11}px system-ui`;
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(item.title, innerX + 10, ry + 16);
          ctx.fillStyle = "rgba(255,255,255,0.70)";
          ctx.font = `${isSmall ? 9 : 10}px system-ui`;
          ctx.fillText(item.subtitle, innerX + 10, ry + 30);

          const btnW = 72;
          const joinRect = { x: innerX + innerW - btnW * 2 - 12, y: ry + 5, w: btnW, h: 28 };
          const claimRect = { x: innerX + innerW - btnW, y: ry + 5, w: btnW, h: 28 };

          ctx.fillStyle = joined ? "rgba(32,120,58,0.82)" : "rgba(255,185,74,0.18)";
          fillRoundRect(ctx, joinRect.x, joinRect.y, joinRect.w, joinRect.h, 10);
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, joinRect.x + 0.5, joinRect.y + 0.5, joinRect.w - 1, joinRect.h - 1, 10);
          ctx.fillStyle = "#fff";
          ctx.font = `900 ${isSmall ? 10 : 11}px system-ui`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(joined ? "KATILDI" : "KATIL", joinRect.x + joinRect.w / 2, joinRect.y + joinRect.h / 2 + 0.5);

          ctx.fillStyle = claimed ? "rgba(32,120,58,0.82)" : joined ? "rgba(86,208,122,0.22)" : "rgba(255,255,255,0.08)";
          fillRoundRect(ctx, claimRect.x, claimRect.y, claimRect.w, claimRect.h, 10);
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, claimRect.x + 0.5, claimRect.y + 0.5, claimRect.w - 1, claimRect.h - 1, 10);
          ctx.fillStyle = "#fff";
          ctx.fillText(claimed ? "ALINDI" : joined ? "AL" : "BEKLİYOR", claimRect.x + claimRect.w / 2, claimRect.y + claimRect.h / 2 + 0.5);

          if (!joined) this.hit.push({ type: "joinTelegram", id: item.id, url: item.url, rect: joinRect });
          if (joined && !claimed) this.hit.push({ type: "claimTelegram", id: item.id, rect: claimRect });
        }
      }

      if (block.type === "referralBox") {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "#fff";
        ctx.font = `900 ${isSmall ? 14 : 15}px system-ui`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("DAVET ÖDÜLLERİ", listX + 12, y + 22);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `${isSmall ? 10 : 11}px system-ui`;
        ctx.fillText(`Toplam davet: ${Number(missions.referrals || 0)}`, listX + 12, y + 40);

        const innerX = listX + 10;
        const innerY = y + 52;
        const innerW = listW - 20;
        const rowH = 30;
        const rowGap = 8;

        for (let i = 0; i < this.referralRewards.length; i++) {
          const item = this.referralRewards[i];
          const claimed = !!missions.referralClaimedMap?.[item.target];
          const ready = Number(missions.referrals || 0) >= item.target;
          const ry = innerY + i * (rowH + rowGap);

          ctx.fillStyle = "rgba(255,255,255,0.06)";
          fillRoundRect(ctx, innerX, ry, innerW, rowH, 10);
          ctx.strokeStyle = "rgba(255,255,255,0.10)";
          strokeRoundRect(ctx, innerX + 0.5, ry + 0.5, innerW - 1, rowH - 1, 10);

          ctx.fillStyle = "#fff";
          ctx.font = `800 ${isSmall ? 10 : 11}px system-ui`;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`${item.target} KİŞİ DAVET`, innerX + 10, ry + rowH / 2 + 0.5);

          ctx.fillStyle = "rgba(255,255,255,0.72)";
          ctx.font = `${isSmall ? 9 : 10}px system-ui`;
          ctx.textAlign = "left";
          ctx.fillText(item.reward, innerX + Math.max(90, innerW * 0.36), ry + rowH / 2 + 0.5);

          const btnRect = { x: innerX + innerW - 76, y: ry + 3, w: 68, h: rowH - 6 };
          ctx.fillStyle = claimed ? "rgba(32,120,58,0.82)" : ready ? "rgba(86,208,122,0.22)" : "rgba(255,255,255,0.08)";
          fillRoundRect(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, 9);
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, btnRect.x + 0.5, btnRect.y + 0.5, btnRect.w - 1, btnRect.h - 1, 9);
          ctx.fillStyle = "#fff";
          ctx.font = `900 ${isSmall ? 10 : 11}px system-ui`;
          ctx.textAlign = "center";
          ctx.fillText(claimed ? "ALINDI" : ready ? "AL" : "KİLİTLİ", btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2 + 0.5);

          if (ready && !claimed) this.hit.push({ type: "claimReferral", target: item.target, rect: btnRect });
        }
      }

      y += block.h + gap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 6;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(38, (listH / contentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(trackX, trackY, 3, trackH);
      ctx.fillStyle = "rgba(255,185,74,0.88)";
      ctx.fillRect(trackX, thumbY, 3, thumbH);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 24, Math.max(170, ctx.measureText(this.toastText).width + 32));
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 12;
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      fillRoundRect(ctx, tx, ty, tw, th, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, th - 1, 12);
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${isSmall ? 11 : 12}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2 + 0.5);
    }
  }
}
