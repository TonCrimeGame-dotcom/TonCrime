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

function getAssetImageSafe(assets, key) {
  try {
    if (!assets || !key) return null;
    if (typeof assets.get === "function") {
      const img = assets.get(key);
      if (img) return img;
    }
    if (assets.images && assets.images[key]) return assets.images[key];
    if (assets[key]) return assets[key];
    return null;
  } catch (_) {
    return null;
  }
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function ensureMissionDefaults(store) {
  const s = store.get() || {};
  const m = s.missions || {};

  const patch = {
    dailyLoginClaimed: !!m.dailyLoginClaimed,
    streak7Claimed: !!m.streak7Claimed,
    loginStreak: Number(m.loginStreak || 1),

    dailyAdWatched: Number(m.dailyAdWatched || 0),
    dailyAdClaimed: !!m.dailyAdClaimed,

    iqArenaPlayed: Number(m.iqArenaPlayed || 0),
    iqArenaClaimed: !!m.iqArenaClaimed,

    cageFightPlayed: Number(m.cageFightPlayed || 0),
    cageFightClaimed: !!m.cageFightClaimed,

    energyPurchased: Number(m.energyPurchased || 0),
    energyClaimed: !!m.energyClaimed,

    telegramJoined: !!m.telegramJoined,
    telegramClaimed: !!m.telegramClaimed,

    referrals: Number(m.referrals || 0),
    referralClaim1: !!m.referralClaim1,
    referralClaim5: !!m.referralClaim5,
    referralClaim10: !!m.referralClaim10,

    levelClaimedAt: Number(m.levelClaimedAt || 0),
    lastDailyKey: String(m.lastDailyKey || ""),
  };

  if (JSON.stringify(patch) !== JSON.stringify(m)) {
    store.set({ missions: { ...m, ...patch } });
  }
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
    this.downX = 0;
    this.downY = 0;
    this.startScrollY = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = [];
    this.hitBack = null;

    this.toastText = "";
    this.toastUntil = 0;

    this.telegramUrl = "https://t.me/TONCRIME";
    this.inviteUrl = "https://t.me/share/url?url=https://t.me/TONCRIME_BOT";
  }

  onEnter() {
    ensureMissionDefaults(this.store);
    this._ensureDailyState();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hit = [];
    this.hitBack = null;
  }

  _safeRect(w, h) {
    const s = this.store.get() || {};
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    return {
      x: safe.x + 10,
      y: safe.y + topReserved + 4,
      w: safe.w - 20,
      h: safe.h - topReserved - bottomReserved - 14,
    };
  }

  _showToast(text, ms = 1600) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _setMissions(patch = {}) {
    const s = this.store.get() || {};
    const m = s.missions || {};
    this.store.set({
      missions: {
        ...m,
        ...patch,
      },
    });
  }

  _grantCoins(n) {
    const s = this.store.get() || {};
    this.store.set({
      coins: Number(s.coins || 0) + Number(n || 0),
    });
  }

  _grantEnergy(n) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 100));
    const next = clamp(Number(p.energy || 0) + Number(n || 0), 0, maxE);
    this.store.set({
      player: {
        ...p,
        energy: next,
      },
    });
  }

  _grantXP(n) {
    const s = this.store.get() || {};
    const p = s.player || {};

    let xp = Number(p.xp || 0) + Number(n || 0);
    let level = Number(p.level || 1);
    let xpToNext = Math.max(1, Number(p.xpToNext || 100));

    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = 100;
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

  _ensureDailyState() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const today = todayKey();

    if (String(m.lastDailyKey || "") === today) return;

    const nextStreak =
      String(m.lastDailyKey || "") && !m.dailyLoginClaimed
        ? 1
        : clamp(Number(m.loginStreak || 0) + 1, 1, 7);

    this.store.set({
      missions: {
        ...m,
        dailyLoginClaimed: false,
        streak7Claimed: Number(nextStreak) >= 7 ? !!m.streak7Claimed : false,
        loginStreak: nextStreak,
        dailyAdWatched: 0,
        dailyAdClaimed: false,
        iqArenaPlayed: 0,
        iqArenaClaimed: false,
        cageFightPlayed: 0,
        cageFightClaimed: false,
        energyPurchased: 0,
        energyClaimed: false,
        lastDailyKey: today,
      },
    });
  }

  _isRewardedAdAvailable() {
    return (
      !!window?.showRewardedAd ||
      !!window?.tcAds?.showRewarded ||
      !!window?.Telegram?.WebApp?.showPopup
    );
  }

  async _watchAdMission() {
    const s = this.store.get() || {};
    const m = s.missions || {};

    if (Number(m.dailyAdWatched || 0) >= 20) {
      this._showToast("Günlük reklam limiti doldu");
      return;
    }

    let rewarded = false;

    try {
      if (typeof window?.showRewardedAd === "function") {
        const res = await window.showRewardedAd();
        rewarded = !!res || res === undefined;
      } else if (typeof window?.tcAds?.showRewarded === "function") {
        const res = await window.tcAds.showRewarded();
        rewarded = !!res || res === undefined;
      } else {
        rewarded = true;
      }
    } catch (_) {
      rewarded = false;
    }

    if (!rewarded) {
      this._showToast("Reklam tamamlanmadı");
      return;
    }

    const s2 = this.store.get() || {};
    const m2 = s2.missions || {};
    this.store.set({
      missions: {
        ...m2,
        dailyAdWatched: clamp(Number(m2.dailyAdWatched || 0) + 1, 0, 20),
      },
    });
    this._grantEnergy(1);
    this._showToast("+1 enerji kazanıldı");
  }

  _openTelegramTask() {
    const s = this.store.get() || {};
    const m = s.missions || {};

    if (m.telegramClaimed) {
      this._showToast("Telegram ödülü alındı");
      return;
    }

    if (!m.telegramJoined) {
      try {
        window.open(this.telegramUrl, "_blank");
      } catch (_) {}

      this._setMissions({ telegramJoined: true });
      this._showToast("Katılım açıldı, şimdi ödülü al");
      return;
    }

    this._grantCoins(50);
    this._setMissions({
      telegramJoined: true,
      telegramClaimed: true,
    });
    this._showToast("+50 YTON alındı");
  }

  _openInviteTask() {
    try {
      if (navigator.share) {
        navigator
          .share({
            title: "TonCrime",
            text: "TonCrime'e katıl",
            url: this.inviteUrl.replace("https://t.me/share/url?url=", ""),
          })
          .catch(() => {});
      } else {
        window.open(this.inviteUrl, "_blank");
      }
    } catch (_) {}

    this._showToast("Davet bağlantısı açıldı");
  }

  _openPvp(mode) {
    try {
      window.dispatchEvent(
        new CustomEvent("tc:openPvp", {
          detail: {
            mode,
          },
        })
      );
    } catch (_) {}

    if (mode === "iq") {
      this._showToast("IQ Arena açılıyor");
    } else {
      this._showToast("Kafes Dövüşü açılıyor");
    }
  }

  _claim(type) {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const p = s.player || {};

    if (type === "dailyLogin" && !m.dailyLoginClaimed) {
      this._grantCoins(30);
      this._setMissions({ dailyLoginClaimed: true });
      this._showToast("+30 YTON");
      return;
    }

    if (type === "streak7" && Number(m.loginStreak || 0) >= 7 && !m.streak7Claimed) {
      this._grantCoins(70);
      this._setMissions({ streak7Claimed: true });
      this._showToast("7 gün ödülü alındı");
      return;
    }

    if (type === "dailyAd" && Number(m.dailyAdWatched || 0) >= 20 && !m.dailyAdClaimed) {
      this._grantCoins(20);
      this._grantXP(15);
      this._setMissions({ dailyAdClaimed: true });
      this._showToast("Reklam görevi ödülü alındı");
      return;
    }

    if (type === "iqArena" && Number(m.iqArenaPlayed || 0) >= 20 && !m.iqArenaClaimed) {
      this._grantCoins(60);
      this._grantXP(20);
      this._setMissions({ iqArenaClaimed: true });
      this._showToast("IQ Arena ödülü alındı");
      return;
    }

    if (type === "cageFight" && Number(m.cageFightPlayed || 0) >= 20 && !m.cageFightClaimed) {
      this._grantCoins(60);
      this._grantXP(20);
      this._setMissions({ cageFightClaimed: true });
      this._showToast("Kafes Dövüşü ödülü alındı");
      return;
    }

    if (type === "energy" && Number(m.energyPurchased || 0) >= 100 && !m.energyClaimed) {
      this._grantCoins(50);
      this._setMissions({ energyClaimed: true });
      this._showToast("Enerji satın alma ödülü alındı");
      return;
    }

    if (type === "level" && Number(p.level || 1) >= 55 && Number(m.levelClaimedAt || 0) !== 55) {
      this._grantCoins(50);
      this._grantXP(25);
      this._setMissions({ levelClaimedAt: 55 });
      this._showToast("Level ödülü alındı");
      return;
    }

    if (type === "ref1" && Number(m.referrals || 0) >= 1 && !m.referralClaim1) {
      this._grantCoins(100);
      this._setMissions({ referralClaim1: true });
      this._showToast("1 davet ödülü alındı");
      return;
    }

    if (type === "ref5" && Number(m.referrals || 0) >= 5 && !m.referralClaim5) {
      this._grantCoins(500);
      this._setMissions({ referralClaim5: true });
      this._showToast("5 davet ödülü alındı");
      return;
    }

    if (type === "ref10" && Number(m.referrals || 0) >= 10 && !m.referralClaim10) {
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({
        player: {
          ...p2,
          weaponName: "Orta Kalite Silah",
          weaponBonus: "+8%",
        },
      });
      this._setMissions({ referralClaim10: true });
      this._showToast("Orta Kalite Silah alındı");
      return;
    }
  }

  _missionData() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const m = s.missions || {};

    const levelNow = Number(p.level || 1);
    const levelTarget = 55;
    const levelPct = clamp(levelNow / levelTarget, 0, 1);

    return [
      {
        section: "Günlük Görevler",
        cards: [
          {
            key: "dailyLogin",
            title: "Günlük Giriş",
            desc: "Her gün oyuna giriş yap ve ödülünü al.",
            tags: ["Günlük", "+30 YTON"],
            progress: m.dailyLoginClaimed ? 1 : 0,
            max: 1,
            rewardText: m.dailyLoginClaimed ? "Alındı" : "Ödül: +30 YTON",
            buttonLabel: m.dailyLoginClaimed ? "Alındı" : "Al",
            buttonType: "claim",
            claimKey: "dailyLogin",
            disabled: !!m.dailyLoginClaimed,
            claimed: !!m.dailyLoginClaimed,
          },
          {
            key: "streak7",
            title: "7 Gün Sürekli Giriş",
            desc: "7 gün seri giriş yap ve ekstra ödülü aç.",
            tags: ["Seri", "+70 YTON"],
            progress: clamp(Number(m.loginStreak || 0), 0, 7),
            max: 7,
            rewardText: m.streak7Claimed ? "Alındı" : "Ödül: +70 YTON",
            buttonLabel: m.streak7Claimed ? "Alındı" : "Al",
            buttonType: "claim",
            claimKey: "streak7",
            disabled: !!m.streak7Claimed || Number(m.loginStreak || 0) < 7,
            claimed: !!m.streak7Claimed,
          },
          {
            key: "watchAds",
            title: "Reklam İzle",
            desc: "Günlük 20 reklam. Her reklam +1 enerji verir.",
            tags: ["20 Reklam", "+1 Enerji"],
            progress: clamp(Number(m.dailyAdWatched || 0), 0, 20),
            max: 20,
            rewardText: m.dailyAdClaimed ? "Görev ödülü alındı" : "20/20 olunca +20 YTON +15 XP",
            buttonLabel:
              m.dailyAdClaimed
                ? "Alındı"
                : Number(m.dailyAdWatched || 0) >= 20
                ? "Al"
                : "İzle",
            buttonType:
              m.dailyAdClaimed
                ? "done"
                : Number(m.dailyAdWatched || 0) >= 20
                ? "claim"
                : "action",
            action: Number(m.dailyAdWatched || 0) >= 20 ? null : "watchAd",
            claimKey: Number(m.dailyAdWatched || 0) >= 20 ? "dailyAd" : null,
            disabled: !!m.dailyAdClaimed,
            claimed: !!m.dailyAdClaimed,
          },
        ],
      },
      {
        section: "PvP Görevleri",
        cards: [
          {
            key: "iqArena",
            title: "IQ Arena",
            desc: "Günlük 20 oyun oyna ve yüklü ödül al.",
            tags: ["20 Oyun", "+60 YTON"],
            progress: clamp(Number(m.iqArenaPlayed || 0), 0, 20),
            max: 20,
            rewardText: m.iqArenaClaimed ? "Alındı" : "Ödül: +60 YTON",
            buttonLabel:
              m.iqArenaClaimed
                ? "Alındı"
                : Number(m.iqArenaPlayed || 0) >= 20
                ? "Al"
                : "Açık",
            buttonType:
              m.iqArenaClaimed
                ? "done"
                : Number(m.iqArenaPlayed || 0) >= 20
                ? "claim"
                : "action",
            action: Number(m.iqArenaPlayed || 0) >= 20 ? null : "openIqArena",
            claimKey: Number(m.iqArenaPlayed || 0) >= 20 ? "iqArena" : null,
            disabled: !!m.iqArenaClaimed,
            claimed: !!m.iqArenaClaimed,
          },
          {
            key: "cageFight",
            title: "Kafes Dövüşü",
            desc: "Günlük 20 oyun oyna ve ödülünü al.",
            tags: ["20 Oyun", "+60 YTON"],
            progress: clamp(Number(m.cageFightPlayed || 0), 0, 20),
            max: 20,
            rewardText: m.cageFightClaimed ? "Alındı" : "Ödül: +60 YTON",
            buttonLabel:
              m.cageFightClaimed
                ? "Alındı"
                : Number(m.cageFightPlayed || 0) >= 20
                ? "Al"
                : "Açık",
            buttonType:
              m.cageFightClaimed
                ? "done"
                : Number(m.cageFightPlayed || 0) >= 20
                ? "claim"
                : "action",
            action: Number(m.cageFightPlayed || 0) >= 20 ? null : "openCageFight",
            claimKey: Number(m.cageFightPlayed || 0) >= 20 ? "cageFight" : null,
            disabled: !!m.cageFightClaimed,
            claimed: !!m.cageFightClaimed,
          },
        ],
      },
      {
        section: "Ekstra Görevler",
        cards: [
          {
            key: "energyBuy",
            title: "Enerji Satın Al",
            desc: "Binalardan toplam 100 enerji satın al.",
            tags: ["100 Enerji", "+50 YTON"],
            progress: clamp(Number(m.energyPurchased || 0), 0, 100),
            max: 100,
            rewardText: m.energyClaimed ? "Alındı" : "Ödül: +50 YTON",
            buttonLabel: m.energyClaimed ? "Alındı" : Number(m.energyPurchased || 0) >= 100 ? "Al" : "Takipte",
            buttonType: m.energyClaimed ? "done" : Number(m.energyPurchased || 0) >= 100 ? "claim" : "info",
            claimKey: Number(m.energyPurchased || 0) >= 100 ? "energy" : null,
            disabled: !!m.energyClaimed || Number(m.energyPurchased || 0) < 100,
            claimed: !!m.energyClaimed,
          },
          {
            key: "telegram_join",
            title: "Telegram Grupları",
            desc: "Telegram topluluğuna katıl ve tek butonla ödülünü al.",
            tags: ["Sosyal", "+50 YTON"],
            progress: m.telegramClaimed ? 1 : m.telegramJoined ? 1 : 0,
            max: 1,
            rewardText: m.telegramClaimed ? "Alındı" : m.telegramJoined ? "Katılım doğrulandı" : "Telegram görevine katıl",
            buttonLabel: m.telegramClaimed ? "Alındı" : m.telegramJoined ? "Al" : "Katıl",
            buttonType: "telegram",
            disabled: !!m.telegramClaimed,
            claimed: !!m.telegramClaimed,
            joined: !!m.telegramJoined,
          },
          {
            key: "level55",
            title: "Level Ödülü",
            desc: `Seviye ${levelTarget} ol ve seviye bağlantılı ödülü aç.`,
            tags: [`LVL ${levelNow}/${levelTarget}`, "+50 YTON"],
            progress: levelPct,
            max: 1,
            usePercent: true,
            rewardText: Number(m.levelClaimedAt || 0) === 55 ? "Alındı" : "Ödül: +50 YTON +25 XP",
            buttonLabel:
              Number(m.levelClaimedAt || 0) === 55
                ? "Alındı"
                : levelNow >= levelTarget
                ? "Al"
                : "Takipte",
            buttonType:
              Number(m.levelClaimedAt || 0) === 55
                ? "done"
                : levelNow >= levelTarget
                ? "claim"
                : "info",
            claimKey: levelNow >= levelTarget ? "level" : null,
            disabled: Number(m.levelClaimedAt || 0) === 55 || levelNow < levelTarget,
            claimed: Number(m.levelClaimedAt || 0) === 55,
          },
        ],
      },
      {
        section: "Davet Ödülleri",
        cards: [
          {
            key: "invite_info",
            title: "Arkadaş Davet Et",
            desc: "Davet bağlantını paylaş. İlerleme otomatik davet sayısına bağlanır.",
            tags: [`${fmtNum(m.referrals)} Davet`, "Paylaş"],
            progress: 1,
            max: 1,
            rewardText: "Davet bağlantısını paylaş",
            buttonLabel: "Davet",
            buttonType: "action",
            action: "invite",
            disabled: false,
            claimed: false,
          },
          {
            key: "ref1",
            title: "1 Kişi Davet",
            desc: "İlk davet ödülünü aç.",
            tags: ["1 Davet", "+100 YTON"],
            progress: clamp(Number(m.referrals || 0), 0, 1),
            max: 1,
            rewardText: m.referralClaim1 ? "Alındı" : "Ödül: +100 YTON",
            buttonLabel: m.referralClaim1 ? "Alındı" : Number(m.referrals || 0) >= 1 ? "Al" : "Takipte",
            buttonType: m.referralClaim1 ? "done" : Number(m.referrals || 0) >= 1 ? "claim" : "info",
            claimKey: Number(m.referrals || 0) >= 1 ? "ref1" : null,
            disabled: !!m.referralClaim1 || Number(m.referrals || 0) < 1,
            claimed: !!m.referralClaim1,
          },
          {
            key: "ref5",
            title: "5 Kişi Davet",
            desc: "5 davete ulaşıp büyük ödülü al.",
            tags: ["5 Davet", "+500 YTON"],
            progress: clamp(Number(m.referrals || 0), 0, 5),
            max: 5,
            rewardText: m.referralClaim5 ? "Alındı" : "Ödül: +500 YTON",
            buttonLabel: m.referralClaim5 ? "Alındı" : Number(m.referrals || 0) >= 5 ? "Al" : "Takipte",
            buttonType: m.referralClaim5 ? "done" : Number(m.referrals || 0) >= 5 ? "claim" : "info",
            claimKey: Number(m.referrals || 0) >= 5 ? "ref5" : null,
            disabled: !!m.referralClaim5 || Number(m.referrals || 0) < 5,
            claimed: !!m.referralClaim5,
          },
          {
            key: "ref10",
            title: "10 Kişi Davet",
            desc: "10 davet sonrası orta kalite silah kazan.",
            tags: ["10 Davet", "Silah"],
            progress: clamp(Number(m.referrals || 0), 0, 10),
            max: 10,
            rewardText: m.referralClaim10 ? "Silah alındı" : "Ödül: Orta Kalite Silah",
            buttonLabel: m.referralClaim10 ? "Alındı" : Number(m.referrals || 0) >= 10 ? "Al" : "Takipte",
            buttonType: m.referralClaim10 ? "done" : Number(m.referrals || 0) >= 10 ? "claim" : "info",
            claimKey: Number(m.referrals || 0) >= 10 ? "ref10" : null,
            disabled: !!m.referralClaim10 || Number(m.referrals || 0) < 10,
            claimed: !!m.referralClaim10,
          },
        ],
      },
    ];
  }

  update() {
    this._ensureDailyState();

    const p = this.input?.pointer || { x: 0, y: 0 };
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);

    if (this.input.justPressed?.()) {
      this.dragging = true;
      this.downX = px;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging) {
      const dy = py - this.downY;
      this.moved = Math.max(this.moved, Math.abs(dy));

      if (this.moved > 6) {
        this.clickCandidate = false;
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      }
    }

    if (this.input.justReleased?.()) {
      const wasClick = this.clickCandidate && this.moved < 10;
      this.dragging = false;

      if (wasClick) {
        if (this.hitBack && pointInRect(px, py, this.hitBack)) {
          this.scenes.go("home");
          return;
        }

        for (const h of this.hit) {
          if (!pointInRect(px, py, h.rect)) continue;

          if (h.type === "claim") {
            this._claim(h.key);
            return;
          }

          if (h.type === "watchAd") {
            this._watchAdMission();
            return;
          }

          if (h.type === "telegram") {
            this._openTelegramTask();
            return;
          }

          if (h.type === "openIqArena") {
            this._openPvp("iq");
            return;
          }

          if (h.type === "openCageFight") {
            this._openPvp("cage");
            return;
          }

          if (h.type === "invite") {
            this._openInviteTask();
            return;
          }
        }
      }
    }
  }

  render(ctx, w, h) {
    const s = this.store.get() || {};
    const safe = this._safeRect(w, h);

    const bg =
      getAssetImageSafe(this.assets, "missions") ||
      getAssetImageSafe(this.assets, "pvp") ||
      getAssetImageSafe(this.assets, "background");

    if (bg) {
      const scale = Math.max(w / (bg.width || 1), h / (bg.height || 1));
      const dw = (bg.width || 1) * scale;
      const dh = (bg.height || 1) * scale;
      const dx = (w - dw) * 0.5;
      const dy = (h - dh) * 0.5;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#0e0a07";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(6,3,2,0.62)";
    ctx.fillRect(0, 0, w, h);

    this.hit = [];
    this.hitBack = null;

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    ctx.fillStyle = "rgba(12,8,10,0.46)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.strokeStyle = "rgba(255,170,40,0.68)";
    ctx.lineWidth = 1.25;
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 24);

    const headH = Math.min(110, Math.max(94, panelH * 0.16));
    const innerX = panelX + 14;
    const innerW = panelW - 28;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, innerX, panelY + 12, innerW, headH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, innerX, panelY + 12, innerW, headH, 18);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px system-ui";
    ctx.fillText("Görevler", innerX + 16, panelY + 42);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "13px system-ui";
    ctx.fillText("Günlük görevler, sosyal görevler ve davet ödülleri", innerX + 16, panelY + 66);

    const backW = 92;
    const backH = 42;
    const backX = innerX + innerW - backW - 12;
    const backY = panelY + 26;
    this.hitBack = { x: backX, y: backY, w: backW, h: backH };

    ctx.fillStyle = "rgba(34,32,43,0.88)";
    fillRoundRect(ctx, backX, backY, backW, backH, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, backX, backY, backW, backH, 14);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Kapat", backX + backW / 2, backY + backH / 2);

    const s0 = this.store.get() || {};
    const p0 = s0.player || {};
    const m0 = s0.missions || {};
    const levelText = `LVL ${Number(p0.level || 1)}`;
    const xpText = `${fmtNum(p0.xp || 0)}/${fmtNum(p0.xpToNext || 100)} XP`;
    const energyText = `${fmtNum(p0.energy || 0)}/${fmtNum(p0.energyMax || 100)} ENERJİ`;
    const inviteText = `${fmtNum(m0.referrals || 0)} DAVET`;

    const statY = panelY + 82;
    const statGap = 8;
    let statX = innerX + 16;

    const drawChip = (text) => {
      ctx.font = "600 12px system-ui";
      const tw = ctx.measureText(text).width;
      const cw = tw + 24;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      fillRoundRect(ctx, statX, statY, cw, 26, 13);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      strokeRoundRect(ctx, statX, statY, cw, 26, 13);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, statX + cw / 2, statY + 13);
      statX += cw + statGap;
    };

    drawChip(levelText);
    drawChip(xpText);
    drawChip(energyText);
    drawChip(inviteText);

    const contentX = panelX + 10;
    const contentY = panelY + headH + 22;
    const contentW = panelW - 20;
    const contentH = panelH - headH - 32;

    ctx.save();
    roundRectPath(ctx, contentX, contentY, contentW, contentH, 20);
    ctx.clip();

    const groups = this._missionData();

    let y = contentY + 4 - this.scrollY;
    const sectionGap = 12;
    const cardGap = 12;
    const cardH = 136;
    const cardPad = 14;

    for (const group of groups) {
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.font = "700 14px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(group.section, contentX + 8, y + 14);
      y += 28;

      for (const card of group.cards) {
        const x = contentX + 4;
        const w2 = contentW - 8;

        if (y + cardH >= contentY - 10 && y <= contentY + contentH + 10) {
          ctx.fillStyle = "rgba(15,11,16,0.58)";
          fillRoundRect(ctx, x, y, w2, cardH, 18);
          ctx.strokeStyle = "rgba(255,170,40,0.52)";
          ctx.lineWidth = 1;
          strokeRoundRect(ctx, x, y, w2, cardH, 18);

          ctx.fillStyle = "#ffffff";
          ctx.font = "700 16px system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(card.title, x + cardPad, y + 26);

          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.font = "13px system-ui";
          this._drawLine(ctx, card.desc, x + cardPad, y + 47, w2 - 150, 18, 2);

          let tagX = x + cardPad;
          const tagY = y + 74;
          for (const tag of card.tags || []) {
            ctx.font = "600 12px system-ui";
            const tw = ctx.measureText(String(tag)).width;
            const twrap = tw + 20;
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            fillRoundRect(ctx, tagX, tagY, twrap, 24, 12);
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            strokeRoundRect(ctx, tagX, tagY, twrap, 24, 12);
            ctx.fillStyle = "rgba(255,255,255,0.88)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(tag), tagX + twrap / 2, tagY + 12);
            tagX += twrap + 8;
          }

          const progressX = x + cardPad;
          const progressY = y + 108;
          const progressW = w2 - 160;
          const progressH = 10;

          ctx.fillStyle = "rgba(255,255,255,0.08)";
          fillRoundRect(ctx, progressX, progressY, progressW, progressH, 5);

          const ratio = card.usePercent
            ? clamp(Number(card.progress || 0), 0, 1)
            : clamp(Number(card.progress || 0) / Math.max(1, Number(card.max || 1)), 0, 1);

          ctx.fillStyle =
            ratio >= 1
              ? "rgba(76,205,119,0.98)"
              : "rgba(255,172,45,0.98)";
          fillRoundRect(ctx, progressX, progressY, progressW * ratio, progressH, 5);

          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "12px system-ui";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          const progLabel = card.usePercent
            ? `${Math.round(ratio * 100)}%`
            : `${fmtNum(card.progress || 0)}/${fmtNum(card.max || 1)}`;
          ctx.fillText(`${progLabel} • ${card.rewardText}`, progressX, progressY - 6);

          const btnW = 100;
          const btnH = 44;
          const btnX = x + w2 - btnW - 14;
          const btnY = y + 24;

          let btnBg = "rgba(255,255,255,0.08)";
          let btnStroke = "rgba(255,255,255,0.1)";
          let btnText = "rgba(255,255,255,0.88)";

          if (card.claimed || card.buttonType === "done") {
            btnBg = "rgba(35,111,52,0.9)";
            btnStroke = "rgba(92,204,120,0.42)";
            btnText = "#ffffff";
          } else if (card.buttonType === "claim") {
            btnBg = "rgba(255,186,59,0.18)";
            btnStroke = "rgba(255,186,59,0.48)";
            btnText = "#ffffff";
          } else if (card.buttonType === "telegram") {
            btnBg = card.joined ? "rgba(255,186,59,0.18)" : "rgba(88,160,255,0.18)";
            btnStroke = card.joined ? "rgba(255,186,59,0.48)" : "rgba(88,160,255,0.42)";
            btnText = "#ffffff";
          } else if (card.buttonType === "action") {
            btnBg = "rgba(255,255,255,0.1)";
            btnStroke = "rgba(255,255,255,0.14)";
            btnText = "#ffffff";
          } else if (card.buttonType === "info") {
            btnBg = "rgba(255,255,255,0.06)";
            btnStroke = "rgba(255,255,255,0.08)";
            btnText = "rgba(255,255,255,0.52)";
          }

          ctx.fillStyle = btnBg;
          fillRoundRect(ctx, btnX, btnY, btnW, btnH, 16);
          ctx.strokeStyle = btnStroke;
          strokeRoundRect(ctx, btnX, btnY, btnW, btnH, 16);

          ctx.fillStyle = btnText;
          ctx.font = "700 15px system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(card.buttonLabel, btnX + btnW / 2, btnY + btnH / 2);

          if (!card.disabled) {
            if (card.buttonType === "claim" && card.claimKey) {
              this.hit.push({
                type: "claim",
                key: card.claimKey,
                rect: { x: btnX, y: btnY, w: btnW, h: btnH },
              });
            } else if (card.buttonType === "telegram") {
              this.hit.push({
                type: "telegram",
                rect: { x: btnX, y: btnY, w: btnW, h: btnH },
              });
            } else if (card.action === "watchAd") {
              this.hit.push({
                type: "watchAd",
                rect: { x: btnX, y: btnY, w: btnW, h: btnH },
              });
            } else if (card.action === "openIqArena") {
              this.hit.push({
                type: "openIqArena",
                rect: { x: btnX, y: btnY, w: btnW, h: btnH },
              });
            } else if (card.action === "openCageFight") {
              this.hit.push({
                type: "openCageFight",
                rect: { x: btnX, y: btnY, w: btnW, h: btnH },
              });
            } else if (card.action === "invite") {
              this.hit.push({
                type: "invite",
                rect: { x: btnX, y: btnY, w: btnW, h: btnH },
              });
            }
          }
        }

        y += cardH + cardGap;
      }

      y += sectionGap;
    }

    const contentTotal = y - (contentY + 4);
    this.maxScroll = Math.max(0, contentTotal - contentH + 8);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 2) {
      const barW = 4;
      const barX = contentX + contentW - 8;
      const trackY = contentY + 10;
      const trackH = contentH - 20;
      const thumbH = Math.max(44, trackH * (contentH / Math.max(contentH, contentTotal)));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, barX, trackY, barW, trackH, 2);
      ctx.fillStyle = "rgba(255,186,59,0.8)";
      fillRoundRect(ctx, barX, thumbY, barW, thumbH, 2);
    }

    ctx.restore();

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 36, 300);
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 10;

      ctx.fillStyle = "rgba(12,12,16,0.9)";
      fillRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2);
    }
  }

  _drawLine(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
        if (lines.length >= maxLines - 1) break;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);

    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
  }
}
