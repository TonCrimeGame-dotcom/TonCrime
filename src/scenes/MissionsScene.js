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

function fmtProgress(cur, max) {
  return `${Math.max(0, Number(cur || 0))}/${Math.max(1, Number(max || 1))}`;
}

function pct(cur, max) {
  const m = Math.max(1, Number(max || 1));
  return clamp(Number(cur || 0) / m, 0, 1);
}

function shortNum(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return `${Math.floor(v)}`;
}

function fitText(ctx, text, maxW, startSize, weight = 900, family = "system-ui") {
  let size = startSize;
  while (size > 9) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(String(text || "")).width <= maxW) return size;
    size -= 1;
  }
  return 9;
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
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.hit = [];
    this._ensureMissionState();
    this._refreshDailyScaling();
  }

  onExit() {}

  _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _safeRect() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _getBg() {
    if (typeof this.assets.getImage === "function") {
      return this.assets.getImage("missions") || this.assets.getImage("background");
    }
    if (typeof this.assets.get === "function") {
      return this.assets.get("missions") || this.assets.get("background");
    }
    return this.assets?.images?.missions || this.assets?.images?.background || null;
  }

  _getDaily() {
    const s = this.store.get();
    return s.dailyLogin || {
      lastClaimDay: null,
      streak: 0,
      totalClaims: 0,
      got30DayWeapon: false,
    };
  }

  _getMissionState() {
    const s = this.store.get();
    return s.missions || {};
  }

  _ensureMissionState() {
    const s = this.store.get();
    const missions = this._getMissionState();
    const today = this._todayKey();

    const patch = {
      adsWatchedToday: Number(missions.adsWatchedToday || 0),
      adsRewardClaimedToday: !!missions.adsRewardClaimedToday,
      referrals: Number(missions.referrals || 0),
      referralMilestonesClaimed: { ...(missions.referralMilestonesClaimed || {}) },
      referralNextTarget: Number(missions.referralNextTarget || 10),

      pvpPlayedToday: Number(missions.pvpPlayedToday || 0),
      pvpWinsToday: Number(missions.pvpWinsToday || 0),
      pvpPlayRewardClaimedToday: !!missions.pvpPlayRewardClaimedToday,
      pvpWinRewardClaimedToday: !!missions.pvpWinRewardClaimedToday,

      energyRefillsToday: Number(missions.energyRefillsToday || 0),
      energyRewardClaimedToday: !!missions.energyRewardClaimedToday,

      levelRewardClaimed: { ...(missions.levelRewardClaimed || {}) },
      levelNextTarget: Number(missions.levelNextTarget || 10),

      telegramJoinRewardClaimed: !!missions.telegramJoinRewardClaimed,

      dailyScale: {
        adsTarget: Number(missions.dailyScale?.adsTarget || 20),
        pvpPlayTarget: Number(missions.dailyScale?.pvpPlayTarget || 5),
        pvpWinTarget: Number(missions.dailyScale?.pvpWinTarget || 3),
        energyTarget: Number(missions.dailyScale?.energyTarget || 3),
        adsReward: Number(missions.dailyScale?.adsReward || 50),
        pvpPlayReward: Number(missions.dailyScale?.pvpPlayReward || 25),
        pvpWinReward: Number(missions.dailyScale?.pvpWinReward || 40),
        energyReward: Number(missions.dailyScale?.energyReward || 20),
      },

      lastDayKey: missions.lastDayKey || null,
      dailyRotation: Number(missions.dailyRotation || 0),
    };

    if (patch.lastDayKey !== today) {
      patch.adsWatchedToday = 0;
      patch.adsRewardClaimedToday = false;
      patch.pvpPlayedToday = 0;
      patch.pvpWinsToday = 0;
      patch.pvpPlayRewardClaimedToday = false;
      patch.pvpWinRewardClaimedToday = false;
      patch.energyRefillsToday = 0;
      patch.energyRewardClaimedToday = false;
      patch.lastDayKey = today;
      patch.dailyRotation = Number(missions.dailyRotation || 0) + 1;
    }

    this.store.set({ missions: patch });
  }

  _refreshDailyScaling() {
    const s = this.store.get();
    const m = this._getMissionState();
    const p = s.player || {};
    const daily = this._getDaily();

    const streak = Number(daily.streak || 0);
    const level = Number(p.level || 1);
    const rotation = Number(m.dailyRotation || 0);

    const difficulty = Math.max(
      0,
      Math.floor(streak / 3) + Math.floor(level / 15) + Math.floor(rotation / 4)
    );

    const dailyScale = {
      adsTarget: clamp(20 + difficulty * 2, 20, 60),
      pvpPlayTarget: clamp(5 + Math.floor(difficulty / 2), 5, 15),
      pvpWinTarget: clamp(3 + Math.floor(difficulty / 3), 3, 10),
      energyTarget: clamp(3 + Math.floor(difficulty / 3), 3, 10),

      adsReward: 50 + difficulty * 10,
      pvpPlayReward: 25 + difficulty * 8,
      pvpWinReward: 40 + difficulty * 10,
      energyReward: 20 + difficulty * 7,
    };

    this.store.set({
      missions: {
        ...m,
        dailyScale,
      },
    });
  }

  _getReferralTarget() {
    const m = this._getMissionState();
    const current = Math.max(10, Number(m.referralNextTarget || 10));
    return current;
  }

  _getLevelTarget() {
    const m = this._getMissionState();
    const current = Math.max(10, Number(m.levelNextTarget || 10));
    return current;
  }

  _taskData() {
    const s = this.store.get();
    const p = s.player || {};
    const m = this._getMissionState();
    const daily = this._getDaily();
    const claimedToday = daily.lastClaimDay === this._todayKey();

    const level = Number(p.level || 1);
    const referrals = Number(m.referrals || 0);

    const referralClaimed = m.referralMilestonesClaimed || {};
    const levelClaimed = m.levelRewardClaimed || {};
    const ds = m.dailyScale || {};

    const referralTarget = this._getReferralTarget();
    const levelTarget = this._getLevelTarget();

    const referralRewardText =
      referralTarget < 100
        ? "Ödül: Düşük seviye silah"
        : referralTarget < 1000
        ? "Ödül: Orta seviye silah"
        : referralTarget < 5000
        ? "Ödül: Güçlü silah"
        : "Ödül: Premium";

    const levelRewardCoins = levelTarget * 10;

    return [
      {
        key: "daily_login",
        title: "Günlük Giriş",
        desc: claimedToday ? "Bugünkü giriş ödülü alındı." : "Bugün giriş yap ve ödülünü al.",
        progressText: claimedToday ? "Tamamlandı" : "Hazır",
        progress: claimedToday ? 1 : 0,
        max: 1,
        reward: "10 yton / 7. gün +40 / 30. gün MP5",
        claimable: false,
        claimed: claimedToday,
      },
      {
        key: "ads",
        title: "Reklam İzle",
        desc: "Hedef her gün artar ve gece yenilenir.",
        progressText: fmtProgress(m.adsWatchedToday, ds.adsTarget),
        progress: Number(m.adsWatchedToday || 0),
        max: Number(ds.adsTarget || 20),
        reward: m.adsRewardClaimedToday ? "Alındı" : `Ödül: +${shortNum(ds.adsReward)} yton`,
        claimable: Number(m.adsWatchedToday || 0) >= Number(ds.adsTarget || 20) && !m.adsRewardClaimedToday,
        claimed: !!m.adsRewardClaimedToday,
      },
      {
        key: "referral_next",
        title: `Arkadaş Davet • ${shortNum(referralTarget)}`,
        desc: "Ödül alındıkça bir sonraki hedef otomatik yükselir.",
        progressText: fmtProgress(referrals, referralTarget),
        progress: referrals,
        max: referralTarget,
        reward: referralClaimed[referralTarget] ? "Alındı" : referralRewardText,
        claimable: referrals >= referralTarget && !referralClaimed[referralTarget],
        claimed: !!referralClaimed[referralTarget],
      },
      {
        key: "pvp_play",
        title: "PvP Oyna",
        desc: "Günlük hedef dinamik şekilde büyür.",
        progressText: fmtProgress(m.pvpPlayedToday, ds.pvpPlayTarget),
        progress: Number(m.pvpPlayedToday || 0),
        max: Number(ds.pvpPlayTarget || 5),
        reward: m.pvpPlayRewardClaimedToday ? "Alındı" : `Ödül: +${shortNum(ds.pvpPlayReward)} yton`,
        claimable:
          Number(m.pvpPlayedToday || 0) >= Number(ds.pvpPlayTarget || 5) &&
          !m.pvpPlayRewardClaimedToday,
        claimed: !!m.pvpPlayRewardClaimedToday,
      },
      {
        key: "pvp_win",
        title: "PvP Kazan",
        desc: "Günlük kazanma görevi ölçekli artar.",
        progressText: fmtProgress(m.pvpWinsToday, ds.pvpWinTarget),
        progress: Number(m.pvpWinsToday || 0),
        max: Number(ds.pvpWinTarget || 3),
        reward: m.pvpWinRewardClaimedToday ? "Alındı" : `Ödül: +${shortNum(ds.pvpWinReward)} yton`,
        claimable:
          Number(m.pvpWinsToday || 0) >= Number(ds.pvpWinTarget || 3) &&
          !m.pvpWinRewardClaimedToday,
        claimed: !!m.pvpWinRewardClaimedToday,
      },
      {
        key: "energy_refill",
        title: "Enerji Doldur",
        desc: "Her yeni gün görev seviyesi artabilir.",
        progressText: fmtProgress(m.energyRefillsToday, ds.energyTarget),
        progress: Number(m.energyRefillsToday || 0),
        max: Number(ds.energyTarget || 3),
        reward: m.energyRewardClaimedToday ? "Alındı" : `Ödül: +${shortNum(ds.energyReward)} yton`,
        claimable:
          Number(m.energyRefillsToday || 0) >= Number(ds.energyTarget || 3) &&
          !m.energyRewardClaimedToday,
        claimed: !!m.energyRewardClaimedToday,
      },
      {
        key: "level_next",
        title: `Level ${levelTarget} Ol`,
        desc: "Ödül alındıkça sonraki level görevi açılır.",
        progressText: fmtProgress(level, levelTarget),
        progress: level,
        max: levelTarget,
        reward: levelClaimed[levelTarget] ? "Alındı" : `Ödül: +${shortNum(levelRewardCoins)} yton`,
        claimable: level >= levelTarget && !levelClaimed[levelTarget],
        claimed: !!levelClaimed[levelTarget],
      },
      {
        key: "telegram_join",
        title: "Telegram Gruplarına Katıl",
        desc: "Topluluk grubuna katılma ödülü.",
        progressText: m.telegramJoinRewardClaimed ? "Tamamlandı" : "Hazır",
        progress: m.telegramJoinRewardClaimed ? 1 : 0,
        max: 1,
        reward: m.telegramJoinRewardClaimed ? "Alındı" : "Ödül: +15 yton",
        claimable: !m.telegramJoinRewardClaimed,
        claimed: !!m.telegramJoinRewardClaimed,
      },
    ];
  }

  _claimMission(key) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    const weapons = { ...(s.weapons || { owned: {}, equippedId: null }) };
    const player = { ...(s.player || {}) };
    let coins = Number(s.coins || 0);
    let premium = !!s.premium;
    let changed = false;

    missions.referralMilestonesClaimed = { ...(missions.referralMilestonesClaimed || {}) };
    missions.levelRewardClaimed = { ...(missions.levelRewardClaimed || {}) };
    missions.dailyScale = { ...(missions.dailyScale || {}) };

    const addWeapon = (id, name, pct) => {
      weapons.owned = { ...(weapons.owned || {}), [id]: true };
      if (!weapons.equippedId) weapons.equippedId = id;
      if (!player.weaponName || player.weaponName === "Silah Yok") {
        player.weaponName = name;
        player.weaponBonus = `+%${pct}`;
        player.weaponIconBonusPct = pct;
      }
    };

    if (
      key === "ads" &&
      Number(missions.adsWatchedToday || 0) >= Number(missions.dailyScale.adsTarget || 20) &&
      !missions.adsRewardClaimedToday
    ) {
      coins += Number(missions.dailyScale.adsReward || 50);
      missions.adsRewardClaimedToday = true;
      changed = true;
    }

    if (key === "referral_next") {
      const target = this._getReferralTarget();
      if (Number(missions.referrals || 0) >= target && !missions.referralMilestonesClaimed[target]) {
        missions.referralMilestonesClaimed[target] = true;

        if (target < 100) addWeapon(`ref_${target}_mossberg`, "Mossberg 500 (12ga)", 25);
        else if (target < 1000) addWeapon(`ref_${target}_ak47`, "AK-47 (7.62×39)", 35);
        else if (target < 5000) addWeapon(`ref_${target}_m134`, "M134 Minigun (7.62×51)", 70);
        else premium = true;

        missions.referralNextTarget =
          target < 10 ? 10 :
          target < 50 ? 50 :
          target < 100 ? 100 :
          target < 250 ? 250 :
          target < 500 ? 500 :
          target < 1000 ? 1000 :
          target < 2500 ? 2500 :
          target < 5000 ? 5000 :
          target + 5000;

        changed = true;
      }
    }

    if (
      key === "pvp_play" &&
      Number(missions.pvpPlayedToday || 0) >= Number(missions.dailyScale.pvpPlayTarget || 5) &&
      !missions.pvpPlayRewardClaimedToday
    ) {
      coins += Number(missions.dailyScale.pvpPlayReward || 25);
      missions.pvpPlayRewardClaimedToday = true;
      changed = true;
    }

    if (
      key === "pvp_win" &&
      Number(missions.pvpWinsToday || 0) >= Number(missions.dailyScale.pvpWinTarget || 3) &&
      !missions.pvpWinRewardClaimedToday
    ) {
      coins += Number(missions.dailyScale.pvpWinReward || 40);
      missions.pvpWinRewardClaimedToday = true;
      changed = true;
    }

    if (
      key === "energy_refill" &&
      Number(missions.energyRefillsToday || 0) >= Number(missions.dailyScale.energyTarget || 3) &&
      !missions.energyRewardClaimedToday
    ) {
      coins += Number(missions.dailyScale.energyReward || 20);
      missions.energyRewardClaimedToday = true;
      changed = true;
    }

    if (key === "level_next") {
      const target = this._getLevelTarget();
      if (Number(player.level || 0) >= target && !missions.levelRewardClaimed[target]) {
        missions.levelRewardClaimed[target] = true;
        coins += target * 10;

        missions.levelNextTarget =
          target < 10 ? 10 :
          target < 25 ? 25 :
          target < 50 ? 50 :
          target < 75 ? 75 :
          target < 100 ? 100 :
          target + 25;

        changed = true;
      }
    }

    if (key === "telegram_join" && !missions.telegramJoinRewardClaimed) {
      missions.telegramJoinRewardClaimed = true;
      coins += 15;
      changed = true;
    }

    if (!changed) return;

    this.store.set({
      coins,
      missions,
      weapons,
      premium,
      player,
    });

    try {
      window.dispatchEvent(
        new CustomEvent("tc:toast", {
          detail: { text: "Görev ödülü alındı!" },
        })
      );
    } catch (_) {}
  }

  update() {
    this._ensureMissionState();

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
        if (pointInRect(px, py, h.rect)) {
          if (h.type === "back") {
            this.scenes.go("home");
            return;
          }
          if (h.type === "claim") {
            this._claimMission(h.key);
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
    const bg = this._getBg();

    const isMobile = safe.w <= 520;
    const isTiny = safe.w <= 390;

    const panelPad = isTiny ? 10 : 12;
    const headerTopPad = isTiny ? 10 : 12;
    const listPad = isTiny ? 8 : 12;
    const gap = isTiny ? 8 : 10;

    const titleSize = isTiny ? 18 : 20;
    const subSize = isTiny ? 11 : 12;
    const blockTitleSize = isTiny ? 13 : 14;
    const cardTitleSize = isTiny ? 12 : 13;
    const cardTextSize = isTiny ? 10 : 12;
    const btnTextSize = isTiny ? 11 : 12;

    ctx.clearRect(0, 0, W, H);

    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.50)";
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x + (isTiny ? 8 : 12);
    const panelY = Math.max(isTiny ? 68 : 74, safe.y + (isTiny ? 68 : 74));
    const panelW = safe.w - (isTiny ? 16 : 24);
    const panelH = safe.h - (isTiny ? 132 : 148);

    ctx.fillStyle = "rgba(0,0,0,0.60)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, isTiny ? 16 : 18);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, isTiny ? 16 : 18);

    const backRect = { x: panelX + panelPad, y: panelY + headerTopPad, w: isTiny ? 68 : 78, h: isTiny ? 28 : 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 10);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${isTiny ? 11 : 12}px system-ui`;
    ctx.fillText("Geri", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2);
    this.hit = [{ type: "back", rect: backRect }];

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `900 ${titleSize}px system-ui`;
    ctx.fillText("Görevler", panelX + panelPad, panelY + (isTiny ? 58 : 64));

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `${subSize}px system-ui`;
    ctx.fillText("Görevler günlük yenilenir ve hedefler zamanla artar", panelX + panelPad, panelY + (isTiny ? 76 : 84));

    const listX = panelX + listPad;
    const listY = panelY + (isTiny ? 90 : 100);
    const listW = panelW - listPad * 2;
    const listH = panelH - (isTiny ? 100 : 112);

    const daily = this._getDaily();
    const streak = Number(daily.streak || 0);
    const claimedToday = daily.lastClaimDay === this._todayKey();
    const tasks = this._taskData();

    const gridCols = safe.w <= 420 ? 2 : 4;
    const gridGap = isTiny ? 8 : 10;
    const gridCellW = Math.floor((listW - gridGap * (gridCols - 1)) / gridCols);
    const gridRows = Math.ceil(7 / gridCols);
    const gridCellH = isTiny ? 80 : 92;
    const gridH = gridRows * gridCellH + (gridRows - 1) * gridGap;

    const blocks = [];
    blocks.push({ type: "summary", h: isTiny ? 142 : 134 });
    blocks.push({ type: "title", h: 30, text: "7 Günlük Giriş Takvimi" });
    blocks.push({ type: "grid7", h: gridH });
    blocks.push({ type: "title", h: 30, text: "30 Gün Büyük Ödül" });
    blocks.push({ type: "reward30", h: isTiny ? 126 : 112 });
    blocks.push({ type: "title", h: 30, text: "Aktif Görevler" });
    for (const t of tasks) blocks.push({ type: "task", h: isMobile ? 118 : 92, task: t });

    const contentH = blocks.reduce((a, b) => a + b.h, 0) + (blocks.length - 1) * gap + 10;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    let y = listY + 4 - this.scrollY;

    for (const block of blocks) {
      if (block.type === "summary") {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `900 ${blockTitleSize}px system-ui`;
        ctx.fillText("Günlük Giriş Bonus Durumu", listX + 14, y + 22);

        const textX = listX + 14;
        const textY = y + 48;

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = `${cardTextSize}px system-ui`;

        if (isMobile) {
          ctx.fillText(`Bugün: ${claimedToday ? "Alındı" : "Hazır"}`, textX, textY);
          ctx.fillText(`Seri: ${streak} gün`, textX, textY + 20);
          ctx.fillText("İlk 6 gün: +10 yton", textX, textY + 40);
          ctx.fillText("7. gün: +40 yton", textX, textY + 60);
          ctx.fillText("30. gün: HK MP5", textX, textY + 80);
        } else {
          ctx.fillText(`Bugün ödül: ${claimedToday ? "Alındı" : "Hazır"}`, textX, textY);
          ctx.fillText(`Aktif seri: ${streak} gün`, textX, textY + 20);
          ctx.fillText("İlk 6 gün: her gün 10 yton", textX, textY + 40);
          ctx.fillText("7. gün: +40 yton → ilk 7 gün toplam 100 yton", textX, textY + 60);
        }

        const pillW = isTiny ? 118 : 132;
        const pillH = isTiny ? 32 : 34;
        const pillX = listX + listW - pillW - 14;
        const pillY = y + (isMobile ? block.h - pillH - 14 : 46);

        ctx.fillStyle = claimedToday ? "rgba(31,111,42,0.85)" : "rgba(242,211,107,0.18)";
        fillRoundRect(ctx, pillX, pillY, pillW, pillH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        strokeRoundRect(ctx, pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(claimedToday ? "Bugün Alındı" : "Bugün Hazır", pillX + pillW / 2, pillY + pillH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      if (block.type === "title") {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `900 ${blockTitleSize}px system-ui`;
        ctx.fillText(block.text, listX + 2, y + 22);
      }

      if (block.type === "grid7") {
        for (let i = 0; i < 7; i++) {
          const day = i + 1;
          const row = Math.floor(i / gridCols);
          const col = i % gridCols;

          const cx = listX + col * (gridCellW + gridGap);
          const cy = y + row * (gridCellH + gridGap);

          const done = streak >= day;
          const is7 = day === 7;

          ctx.fillStyle = done
            ? "rgba(31,111,42,0.80)"
            : is7
            ? "rgba(242,211,107,0.12)"
            : "rgba(255,255,255,0.07)";
          fillRoundRect(ctx, cx, cy, gridCellW, gridCellH, 14);
          ctx.strokeStyle = is7 ? "rgba(242,211,107,0.42)" : "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, cx + 0.5, cy + 0.5, gridCellW - 1, gridCellH - 1, 14);

          ctx.fillStyle = "#fff";
          ctx.font = `900 ${isTiny ? 12 : 13}px system-ui`;
          ctx.fillText(`Gün ${day}`, cx + 10, cy + 18);

          ctx.fillStyle = "rgba(255,255,255,0.78)";
          ctx.font = `${isTiny ? 10 : 12}px system-ui`;

          if (day === 7) {
            ctx.fillText("+40 yton", cx + 10, cy + (isTiny ? 42 : 46));
            ctx.fillText("Toplam 100", cx + 10, cy + (isTiny ? 60 : 66));
          } else {
            ctx.fillText("+10 yton", cx + 10, cy + (isTiny ? 50 : 56));
          }

          if (done) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.font = `900 ${isTiny ? 16 : 18}px system-ui`;
            ctx.fillText("✓", cx + gridCellW - 22, cy + 22);
          }
        }
      }

      if (block.type === "reward30") {
        const got30 = !!daily.got30DayWeapon;

        ctx.fillStyle = got30 ? "rgba(31,111,42,0.78)" : "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "#fff";
        ctx.font = `900 ${blockTitleSize}px system-ui`;
        ctx.fillText("30 gün kesintisiz giriş", listX + 14, y + 24);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = `${cardTextSize}px system-ui`;
        ctx.fillText("Ödül: HK MP5 (hafif makineli silah)", listX + 14, y + 48);
        ctx.fillText(`İlerleme: ${Math.min(streak, 30)}/30`, listX + 14, y + 68);
        ctx.fillText(got30 ? "Durum: Alındı" : "Durum: Bekliyor", listX + 14, y + 88);

        const barX = listX + 14;
        const barY = y + (isMobile ? block.h - 28 : 74);
        const barW = isMobile ? listW - 28 : Math.min(140, listW * 0.32);
        const barH = 14;
        const progress = clamp(Math.min(streak, 30) / 30, 0, 1);

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, barX, barY, barW, barH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        fillRoundRect(ctx, barX, barY, Math.max(8, barW * progress), barH, 8);
      }

      if (block.type === "task") {
        const t = block.task;

        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 14);

        const titleMaxW = isMobile ? listW - 28 : listW - 140;
        const dynamicTitleSize = fitText(ctx, t.title, titleMaxW, cardTitleSize);
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${dynamicTitleSize}px system-ui`;
        ctx.fillText(t.title, listX + 14, y + 20);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `${cardTextSize}px system-ui`;
        ctx.fillText(t.desc, listX + 14, y + 40);

        const barX = listX + 14;
        const barY = y + (isMobile ? 56 : 56);
        const btnW = isMobile ? 84 : 92;
        const btnH = isMobile ? 32 : 34;
        const btnX = listX + listW - btnW - 14;
        const btnY = isMobile ? y + block.h - btnH - 12 : y + 28;
        const rewardRightLimit = btnX - 10;

        const barW = isMobile ? listW - 28 : listW - 160;
        const barH = 10;

        ctx.fillStyle = "rgba(255,255,255,0.10)";
        fillRoundRect(ctx, barX, barY, barW, barH, 8);
        ctx.fillStyle = t.claimed ? "rgba(31,111,42,0.88)" : "rgba(255,255,255,0.78)";
        fillRoundRect(ctx, barX, barY, Math.max(6, barW * pct(t.progress, t.max)), barH, 8);

        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        ctx.fillText(t.progressText, barX, barY + 22);

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        const rewardSize = fitText(ctx, t.reward, rewardRightLimit - barX, isTiny ? 10 : 11, 500);
        ctx.font = `500 ${rewardSize}px system-ui`;
        if (isMobile) {
          ctx.fillText(t.reward, barX, y + block.h - 18);
        } else {
          const tw = ctx.measureText(t.reward).width;
          ctx.fillText(t.reward, rewardRightLimit - tw, barY + 22);
        }

        let btnLabel = "Bekliyor";
        let btnColor = "rgba(255,255,255,0.08)";

        if (t.claimed) {
          btnLabel = "Alındı";
          btnColor = "rgba(31,111,42,0.85)";
        } else if (t.claimable) {
          btnLabel = "Al";
          btnColor = "rgba(242,211,107,0.18)";
          this.hit.push({ type: "claim", key: t.key, rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
        }

        ctx.fillStyle = btnColor;
        fillRoundRect(ctx, btnX, btnY, btnW, btnH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        strokeRoundRect(ctx, btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${btnTextSize}px system-ui`;
        ctx.fillText(btnLabel, btnX + btnW / 2, btnY + btnH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      y += block.h + gap;
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
  }
}
