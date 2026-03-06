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

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAILY_AD_LIMIT = 20;
const AD_REWARD = 10;

const GIFT_WEAPONS = {
  low: { id: "glock_17", name: "Glock 17 (9×19mm)", bonusPct: 18 },
  mid: { id: "ak47", name: "AK-47 (7.62×39)", bonusPct: 35 },
  top: { id: "m134", name: "M134 Minigun (7.62×51)", bonusPct: 70 },
};

export class MissionsScene {
  constructor({ store, input, scenes }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.downY = 0;
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = [];
    this.backHit = null;

    this.toastText = "";
    this.toastUntil = 0;

    this._installMissionHooks();
  }

  onEnter() {
    this._ensureState();
    this._resetDailyIfNeeded();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hit = [];
    this.backHit = null;
  }

  onExit() {}

  _installMissionHooks() {
    if (window.tcMissions) return;

    window.tcMissions = {
      recordAdWatch: (count = 1) => {
        for (let i = 0; i < Math.max(1, Number(count || 1)); i++) {
          this._watchAd();
        }
      },
      addInvites: (count = 1) => {
        this._ensureState();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            invites: Math.max(0, Number(m.invites || 0) + Math.max(1, Number(count || 1))),
          },
        });
      },
      setInvites: (count = 0) => {
        this._ensureState();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            invites: Math.max(0, Number(count || 0)),
          },
        });
      },
      recordPvpPlayed: (count = 1) => {
        this._ensureState();
        this._resetDailyIfNeeded();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            dailyPvpPlayed: Math.max(0, Number(m.dailyPvpPlayed || 0) + Math.max(1, Number(count || 1))),
          },
        });
      },
      recordBuildingUsed: (count = 1) => {
        this._ensureState();
        this._resetDailyIfNeeded();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            dailyBuildingsUsed: Math.max(0, Number(m.dailyBuildingsUsed || 0) + Math.max(1, Number(count || 1))),
          },
        });
      },
      recordLevelUp: (count = 1) => {
        this._ensureState();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            totalLevelUps: Math.max(0, Number(m.totalLevelUps || 0) + Math.max(1, Number(count || 1))),
          },
        });
      },
      completeTelegramGroup: () => {
        this._ensureState();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            telegramGroupJoined: true,
          },
        });
      },
      completeTelegramChannel: () => {
        this._ensureState();
        const s = this.store.get();
        const m = s.missions;
        this.store.set({
          missions: {
            ...m,
            telegramChannelJoined: true,
          },
        });
      },
      resetDaily: () => {
        this._forceDailyReset();
      },
    };
  }

  _safeRect() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _showToast(text, ms = 1200) {
    this.toastText = text;
    this.toastUntil = Date.now() + ms;
  }

  _ensureState() {
    const s = this.store.get();
    const missions = s.missions || {};

    const next = {
      dayKey: missions.dayKey || todayKey(),
      dailyAdsWatched: Number(missions.dailyAdsWatched || 0),
      dailyAdsLimit: Number(missions.dailyAdsLimit || DAILY_AD_LIMIT),
      dailyPvpPlayed: Number(missions.dailyPvpPlayed || 0),
      dailyBuildingsUsed: Number(missions.dailyBuildingsUsed || 0),
      invites: Number(missions.invites || 0),
      totalLevelUps: Number(missions.totalLevelUps || 0),
      telegramGroupJoined: !!missions.telegramGroupJoined,
      telegramChannelJoined: !!missions.telegramChannelJoined,
      claimed: {
        pvp3: !!missions.claimed?.pvp3,
        pvp10: !!missions.claimed?.pvp10,
        building3: !!missions.claimed?.building3,
        building10: !!missions.claimed?.building10,
        lvl5: !!missions.claimed?.lvl5,
        lvl10: !!missions.claimed?.lvl10,
        lvl20: !!missions.claimed?.lvl20,
        tgGroup: !!missions.claimed?.tgGroup,
        tgChannel: !!missions.claimed?.tgChannel,
        invite10: !!missions.claimed?.invite10,
        invite100: !!missions.claimed?.invite100,
        invite1000: !!missions.claimed?.invite1000,
        invite5000: !!missions.claimed?.invite5000,
      },
    };

    if (!s.missions) {
      this.store.set({ missions: next });
    } else {
      this.store.set({ missions: { ...missions, ...next, claimed: next.claimed } });
    }

    const s2 = this.store.get();
    if (!s2.weapons) {
      this.store.set({ weapons: { owned: {}, equippedId: null } });
    }
  }

  _resetDailyIfNeeded() {
    const s = this.store.get();
    const m = s.missions;
    const nowKey = todayKey();

    if (!m || m.dayKey === nowKey) return;

    this.store.set({
      missions: {
        ...m,
        dayKey: nowKey,
        dailyAdsWatched: 0,
        dailyAdsLimit: DAILY_AD_LIMIT,
        dailyPvpPlayed: 0,
        dailyBuildingsUsed: 0,
        claimed: {
          ...m.claimed,
          pvp3: false,
          pvp10: false,
          building3: false,
          building10: false,
        },
      },
    });
  }

  _forceDailyReset() {
    this._ensureState();
    const s = this.store.get();
    const m = s.missions;

    this.store.set({
      missions: {
        ...m,
        dayKey: todayKey(),
        dailyAdsWatched: 0,
        dailyAdsLimit: DAILY_AD_LIMIT,
        dailyPvpPlayed: 0,
        dailyBuildingsUsed: 0,
        claimed: {
          ...m.claimed,
          pvp3: false,
          pvp10: false,
          building3: false,
          building10: false,
        },
      },
    });

    this._showToast("Günlük görevler sıfırlandı");
  }

  _addCoins(amount) {
    const s = this.store.get();
    this.store.set({ coins: Math.max(0, Number(s.coins || 0) + Number(amount || 0)) });
  }

  _giveWeapon(gift) {
    const s = this.store.get();
    const weapons = s.weapons || { owned: {}, equippedId: null };
    const player = s.player || {};

    this.store.set({
      weapons: {
        owned: { ...(weapons.owned || {}), [gift.id]: true },
        equippedId: gift.id,
      },
      player: {
        ...player,
        weaponName: gift.name,
        weaponBonus: `+%${gift.bonusPct}`,
        weaponIconBonusPct: gift.bonusPct,
      },
    });
  }

  _watchAd() {
    this._ensureState();
    this._resetDailyIfNeeded();

    const s = this.store.get();
    const m = s.missions;
    const current = Number(m.dailyAdsWatched || 0);
    const limit = Number(m.dailyAdsLimit || DAILY_AD_LIMIT);

    if (current >= limit) {
      this._showToast("Bugünkü reklam limiti doldu");
      return;
    }

    this.store.set({
      coins: Number(s.coins || 0) + AD_REWARD,
      missions: {
        ...m,
        dailyAdsWatched: current + 1,
      },
    });

    this._showToast(`+${AD_REWARD} YTON`);
  }

  _claimSimple(claimKey, rewardCoins) {
    this._ensureState();
    const s = this.store.get();
    const m = s.missions;

    if (m.claimed?.[claimKey]) {
      this._showToast("Zaten alındı");
      return;
    }

    this.store.set({
      coins: Number(s.coins || 0) + Number(rewardCoins || 0),
      missions: {
        ...m,
        claimed: {
          ...m.claimed,
          [claimKey]: true,
        },
      },
    });

    this._showToast(`+${rewardCoins} YTON`);
  }

  _claimInviteReward(level) {
    this._ensureState();
    const s = this.store.get();
    const m = s.missions;
    const invites = Number(m.invites || 0);

    if (level === 10) {
      if (invites < 10) return this._showToast("10 davet gerekli");
      if (m.claimed?.invite10) return this._showToast("Zaten alındı");
      this._giveWeapon(GIFT_WEAPONS.low);
      const s2 = this.store.get();
      this.store.set({
        missions: {
          ...s2.missions,
          claimed: { ...s2.missions.claimed, invite10: true },
        },
      });
      return this._showToast("Glock 17 verildi");
    }

    if (level === 100) {
      if (invites < 100) return this._showToast("100 davet gerekli");
      if (m.claimed?.invite100) return this._showToast("Zaten alındı");
      this._giveWeapon(GIFT_WEAPONS.mid);
      const s2 = this.store.get();
      this.store.set({
        missions: {
          ...s2.missions,
          claimed: { ...s2.missions.claimed, invite100: true },
        },
      });
      return this._showToast("AK-47 verildi");
    }

    if (level === 1000) {
      if (invites < 1000) return this._showToast("1000 davet gerekli");
      if (m.claimed?.invite1000) return this._showToast("Zaten alındı");
      this._giveWeapon(GIFT_WEAPONS.top);
      const s2 = this.store.get();
      this.store.set({
        missions: {
          ...s2.missions,
          claimed: { ...s2.missions.claimed, invite1000: true },
        },
      });
      return this._showToast("M134 Minigun verildi");
    }

    if (level === 5000) {
      if (invites < 5000) return this._showToast("5000 davet gerekli");
      if (m.claimed?.invite5000) return this._showToast("Zaten alındı");

      this.store.set({
        premium: true,
        missions: {
          ...m,
          claimed: { ...m.claimed, invite5000: true },
        },
      });
      return this._showToast("Premium açıldı");
    }
  }

  _dailyCards() {
    const s = this.store.get();
    const m = s.missions;
    const playerLevel = Number(s.player?.level || 1);

    return [
      {
        type: "header",
        title: "Günlük Görevler",
      },
      {
        type: "ad",
        key: "daily_ads",
        title: "Reklam İzle",
        desc: `Her reklam +${AD_REWARD} YTON • Günlük limit ${m.dailyAdsLimit}`,
        progress: `${m.dailyAdsWatched}/${m.dailyAdsLimit}`,
        actionLabel: m.dailyAdsWatched >= m.dailyAdsLimit ? "Doldu" : `İzle (+${AD_REWARD})`,
        done: m.dailyAdsWatched >= m.dailyAdsLimit,
      },
      {
        type: "claim",
        key: "pvp3",
        title: "3 PvP Oyna",
        desc: "Günlük görev • Ödül: 20 YTON",
        progress: `${m.dailyPvpPlayed}/3`,
        ready: m.dailyPvpPlayed >= 3,
        claimed: !!m.claimed?.pvp3,
        rewardCoins: 20,
        actionLabel: m.claimed?.pvp3 ? "Alındı" : m.dailyPvpPlayed >= 3 ? "Al" : "Bekliyor",
      },
      {
        type: "claim",
        key: "pvp10",
        title: "10 PvP Oyna",
        desc: "Günlük görev • Ödül: 50 YTON",
        progress: `${m.dailyPvpPlayed}/10`,
        ready: m.dailyPvpPlayed >= 10,
        claimed: !!m.claimed?.pvp10,
        rewardCoins: 50,
        actionLabel: m.claimed?.pvp10 ? "Alındı" : m.dailyPvpPlayed >= 10 ? "Al" : "Bekliyor",
      },
      {
        type: "claim",
        key: "building3",
        title: "3 Bina Kullan",
        desc: "Coffeeshop / Nightclub / Silah Kaçakçısı • Ödül: 15 YTON",
        progress: `${m.dailyBuildingsUsed}/3`,
        ready: m.dailyBuildingsUsed >= 3,
        claimed: !!m.claimed?.building3,
        rewardCoins: 15,
        actionLabel: m.claimed?.building3 ? "Alındı" : m.dailyBuildingsUsed >= 3 ? "Al" : "Bekliyor",
      },
      {
        type: "claim",
        key: "building10",
        title: "10 Bina Kullan",
        desc: "Günlük görev • Ödül: 40 YTON",
        progress: `${m.dailyBuildingsUsed}/10`,
        ready: m.dailyBuildingsUsed >= 10,
        claimed: !!m.claimed?.building10,
        rewardCoins: 40,
        actionLabel: m.claimed?.building10 ? "Alındı" : m.dailyBuildingsUsed >= 10 ? "Al" : "Bekliyor",
      },
      {
        type: "header",
        title: "Arkadaş Daveti",
      },
      {
        type: "invite",
        key: "invite10",
        title: "10 Arkadaş Davet Et",
        desc: "Ödül: En düşük silah • Glock 17",
        progress: `${m.invites}/10`,
        ready: m.invites >= 10,
        claimed: !!m.claimed?.invite10,
        inviteLevel: 10,
        actionLabel: m.claimed?.invite10 ? "Alındı" : m.invites >= 10 ? "Al" : "Bekliyor",
      },
      {
        type: "invite",
        key: "invite100",
        title: "100 Arkadaş Davet Et",
        desc: "Ödül: Orta seviye silah • AK-47",
        progress: `${m.invites}/100`,
        ready: m.invites >= 100,
        claimed: !!m.claimed?.invite100,
        inviteLevel: 100,
        actionLabel: m.claimed?.invite100 ? "Alındı" : m.invites >= 100 ? "Al" : "Bekliyor",
      },
      {
        type: "invite",
        key: "invite1000",
        title: "1000 Arkadaş Davet Et",
        desc: "Ödül: En güçlü silah • M134 Minigun",
        progress: `${m.invites}/1000`,
        ready: m.invites >= 1000,
        claimed: !!m.claimed?.invite1000,
        inviteLevel: 1000,
        actionLabel: m.claimed?.invite1000 ? "Alındı" : m.invites >= 1000 ? "Al" : "Bekliyor",
      },
      {
        type: "invite",
        key: "invite5000",
        title: "5000 Arkadaş Davet Et",
        desc: "Ödül: Premium üyelik",
        progress: `${m.invites}/5000`,
        ready: m.invites >= 5000,
        claimed: !!m.claimed?.invite5000,
        inviteLevel: 5000,
        actionLabel: m.claimed?.invite5000 ? "Alındı" : m.invites >= 5000 ? "Al" : "Bekliyor",
      },
      {
        type: "header",
        title: "Level Görevleri",
      },
      {
        type: "claim",
        key: "lvl5",
        title: "Level 5 Ol",
        desc: "Ödül: 25 YTON",
        progress: `${playerLevel}/5`,
        ready: playerLevel >= 5,
        claimed: !!m.claimed?.lvl5,
        rewardCoins: 25,
        actionLabel: m.claimed?.lvl5 ? "Alındı" : playerLevel >= 5 ? "Al" : "Bekliyor",
      },
      {
        type: "claim",
        key: "lvl10",
        title: "Level 10 Ol",
        desc: "Ödül: 75 YTON",
        progress: `${playerLevel}/10`,
        ready: playerLevel >= 10,
        claimed: !!m.claimed?.lvl10,
        rewardCoins: 75,
        actionLabel: m.claimed?.lvl10 ? "Alındı" : playerLevel >= 10 ? "Al" : "Bekliyor",
      },
      {
        type: "claim",
        key: "lvl20",
        title: "Level 20 Ol",
        desc: "Ödül: 150 YTON",
        progress: `${playerLevel}/20`,
        ready: playerLevel >= 20,
        claimed: !!m.claimed?.lvl20,
        rewardCoins: 150,
        actionLabel: m.claimed?.lvl20 ? "Alındı" : playerLevel >= 20 ? "Al" : "Bekliyor",
      },
      {
        type: "header",
        title: "Telegram Görevleri",
      },
      {
        type: "claim",
        key: "tgGroup",
        title: "Telegram Grubuna Katıl",
        desc: "Ödül: 20 YTON",
        progress: m.telegramGroupJoined ? "1/1" : "0/1",
        ready: !!m.telegramGroupJoined,
        claimed: !!m.claimed?.tgGroup,
        rewardCoins: 20,
        actionLabel: m.claimed?.tgGroup ? "Alındı" : m.telegramGroupJoined ? "Al" : "Bekliyor",
      },
      {
        type: "claim",
        key: "tgChannel",
        title: "Telegram Kanalına Katıl",
        desc: "Ödül: 20 YTON",
        progress: m.telegramChannelJoined ? "1/1" : "0/1",
        ready: !!m.telegramChannelJoined,
        claimed: !!m.claimed?.tgChannel,
        rewardCoins: 20,
        actionLabel: m.claimed?.tgChannel ? "Alındı" : m.telegramChannelJoined ? "Al" : "Bekliyor",
      },
    ];
  }

  update() {
    this._ensureState();
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

      if (this.backHit && pointInRect(px, py, this.backHit)) {
        this.scenes.go("home");
        return;
      }

      for (const h of this.hit) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.type === "watchAd") {
          this._watchAd();
          return;
        }

        if (h.type === "claim") {
          const s = this.store.get();
          const m = s.missions;
          if (m.claimed?.[h.key]) {
            this._showToast("Zaten alındı");
            return;
          }
          if (!h.ready) {
            this._showToast("Görev tamamlanmadı");
            return;
          }
          this._claimSimple(h.key, h.rewardCoins);
          return;
        }

        if (h.type === "invite") {
          this._claimInviteReward(h.inviteLevel);
          return;
        }

        if (h.type === "dev") {
          if (h.devAction === "pvp") {
            window.tcMissions?.recordPvpPlayed?.(1);
            this._showToast("PvP +1");
            return;
          }
          if (h.devAction === "building") {
            window.tcMissions?.recordBuildingUsed?.(1);
            this._showToast("Bina +1");
            return;
          }
          if (h.devAction === "invite") {
            window.tcMissions?.addInvites?.(1);
            this._showToast("Davet +1");
            return;
          }
          if (h.devAction === "group") {
            window.tcMissions?.completeTelegramGroup?.();
            this._showToast("Grup tamamlandı");
            return;
          }
          if (h.devAction === "channel") {
            window.tcMissions?.completeTelegramChannel?.();
            this._showToast("Kanal tamamlandı");
            return;
          }
          if (h.devAction === "resetDaily") {
            this._forceDailyReset();
            return;
          }
        }
      }
    }
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);

    const safe = this._safeRect();
    const s = this.store.get();
    const m = s.missions;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < W; i += 32) ctx.fillRect(i, 0, 1, H);
    for (let i = 0; i < H; i += 32) ctx.fillRect(0, i, W, 1);

    const panelX = safe.x + 12;
    const panelY = Math.max(72, safe.y + 74);
    const panelW = safe.w - 24;
    const panelH = safe.h - 150;

    ctx.fillStyle = "rgba(10,10,14,0.85)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 18);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Görevler", panelX + 16, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      `Reklam: ${m.dailyAdsWatched}/${m.dailyAdsLimit} • Coin: ${Number(s.coins || 0)} • Davet: ${Number(m.invites || 0)}`,
      panelX + 16,
      panelY + 48
    );

    const backW = 78;
    const backH = 30;
    const backX = panelX + panelW - backW - 14;
    const backY = panelY + 12;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backX, backY, backW, backH, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    strokeRoundRect(ctx, backX + 0.5, backY + 0.5, backW - 1, backH - 1, 10);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "800 12px system-ui";
    ctx.fillText("Geri", backX + backW / 2, backY + 19);

    const listX = panelX + 10;
    const listY = panelY + 88;
    const listW = panelW - 20;
    const listH = panelH - 100;

    const cards = this._dailyCards();

    const headerGap = 10;
    const sectionH = 28;
    const cardH = 92;

    let contentH = 8;
    for (const c of cards) {
      contentH += c.type === "header" ? sectionH + headerGap : cardH + 10;
    }

    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    this.hit = [];

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    let y = listY + 8 - this.scrollY;

    for (const card of cards) {
      if (card.type === "header") {
        if (y + sectionH >= listY - 20 && y <= listY + listH + 20) {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "900 14px system-ui";
          ctx.textAlign = "left";
          ctx.fillText(card.title, listX + 4, y + 18);
        }
        y += sectionH + headerGap;
        continue;
      }

      const rx = listX;
      const ry = y;
      const rw = listW;
      const rh = cardH;

      if (ry <= listY + listH + 20 && ry + rh >= listY - 20) {
        ctx.fillStyle = card.ready && !card.claimed
          ? "rgba(35,100,50,0.34)"
          : "rgba(255,255,255,0.06)";
        fillRoundRect(ctx, rx, ry, rw, rh, 14);

        ctx.strokeStyle = card.claimed
          ? "rgba(255,255,255,0.10)"
          : card.ready
          ? "rgba(80,220,120,0.35)"
          : "rgba(255,255,255,0.12)";
        strokeRoundRect(ctx, rx + 0.5, ry + 0.5, rw - 1, rh - 1, 14);

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = "800 13px system-ui";
        ctx.fillText(card.title, rx + 12, ry + 22);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "12px system-ui";
        ctx.fillText(card.desc, rx + 12, ry + 42);

        ctx.fillStyle = "rgba(255,214,120,0.96)";
        ctx.font = "800 12px system-ui";
        ctx.fillText(`İlerleme: ${card.progress}`, rx + 12, ry + 64);

        const bw = 116;
        const bh = 34;
        const bx = rx + rw - bw - 12;
        const by = ry + 28;

        const btnRect = { x: bx, y: by, w: bw, h: bh };

        ctx.fillStyle = card.claimed
          ? "rgba(255,255,255,0.06)"
          : card.ready || card.type === "ad"
          ? "rgba(242,211,107,0.18)"
          : "rgba(255,255,255,0.06)";
        fillRoundRect(ctx, bx, by, bw, bh, 12);

        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        strokeRoundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 12);

        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.font = "900 12px system-ui";
        ctx.fillText(card.actionLabel, bx + bw / 2, by + 21);

        if (card.type === "ad") {
          this.hit.push({ type: "watchAd", rect: btnRect });
        } else if (card.type === "claim") {
          this.hit.push({
            type: "claim",
            rect: btnRect,
            key: card.key,
            ready: card.ready,
            rewardCoins: card.rewardCoins,
          });
        } else if (card.type === "invite") {
          this.hit.push({
            type: "invite",
            rect: btnRect,
            inviteLevel: card.inviteLevel,
          });
        }

        // test/dev mini button
        let devText = "";
        let devAction = "";

        if (card.key === "pvp3" || card.key === "pvp10") {
          devText = "Test PvP +1";
          devAction = "pvp";
        } else if (card.key === "building3" || card.key === "building10") {
          devText = "Test Bina +1";
          devAction = "building";
        } else if (
          card.key === "invite10" ||
          card.key === "invite100" ||
          card.key === "invite1000" ||
          card.key === "invite5000"
        ) {
          devText = "Test Davet +1";
          devAction = "invite";
        } else if (card.key === "tgGroup") {
          devText = "Tamamla";
          devAction = "group";
        } else if (card.key === "tgChannel") {
          devText = "Tamamla";
          devAction = "channel";
        }

        if (devText) {
          const dbw = 104;
          const dbh = 26;
          const dbx = rx + rw - dbw - 12;
          const dby = ry + 62;

          ctx.fillStyle = "rgba(255,255,255,0.05)";
          fillRoundRect(ctx, dbx, dby, dbw, dbh, 10);
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, dbx + 0.5, dby + 0.5, dbw - 1, dbh - 1, 10);

          ctx.fillStyle = "rgba(255,255,255,0.80)";
          ctx.font = "800 11px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(devText, dbx + dbw / 2, dby + 17);

          this.hit.push({
            type: "dev",
            rect: { x: dbx, y: dby, w: dbw, h: dbh },
            devAction,
          });
        }
      }

      y += rh + 10;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 6;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(36, (listH / contentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(trackX, trackY, 3, trackH);

      ctx.fillStyle = "rgba(255,255,255,0.34)";
      ctx.fillRect(trackX, thumbY, 3, thumbH);
    }

    // alt mini dev/reset alanı
    const resetW = 118;
    const resetH = 28;
    const resetX = panelX + 14;
    const resetY = panelY + panelH - 38;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, resetX, resetY, resetW, resetH, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, resetX + 0.5, resetY + 0.5, resetW - 1, resetH - 1, 10);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Daily Reset", resetX + resetW / 2, resetY + 18);

    this.hit.push({
      type: "dev",
      rect: { x: resetX, y: resetY, w: resetW, h: resetH },
      devAction: "resetDaily",
    });

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(280, panelW - 36);
      const th = 34;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 46;

      ctx.fillStyle = "rgba(0,0,0,0.76)";
      fillRoundRect(ctx, tx, ty, tw, th, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      strokeRoundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, th - 1, 12);

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "800 12px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + 21);
    }
  }
}