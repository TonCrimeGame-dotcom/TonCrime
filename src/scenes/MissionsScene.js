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

function drawCover(ctx, img, x, y, w, h) {
  if (!img) {
    ctx.fillStyle = "#0b0b0f";
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
    if (typeof this.assets?.getImage === "function") {
      return this.assets.getImage("missions") || this.assets.getImage("background");
    }
    if (typeof this.assets?.get === "function") {
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
    return Math.max(10, Number(m.referralNextTarget || 10));
  }

  _getLevelTarget() {
    const m = this._getMissionState();
    return Math.max(10, Number(m.levelNextTarget || 10));
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
        key: "ads",
        title: "Günlük Reklam İzle",
        desc: "Hedef gece yenilenir ve seviye arttıkça yükselir.",
        progressText: fmtProgress(m.adsWatchedToday, ds.adsTarget),
        progress: Number(m.adsWatchedToday || 0),
        max: Number(ds.adsTarget || 20),
        reward: m.adsRewardClaimedToday ? "Alındı" : `+${shortNum(ds.adsReward)} yton`,
        claimable: Number(m.adsWatchedToday || 0) >= Number(ds.adsTarget || 20) && !m.adsRewardClaimedToday,
        claimed: !!m.adsRewardClaimedToday,
        cta: "İlerle",
      },
      {
        key: "referral_next",
        title: `Arkadaş Davet • ${shortNum(referralTarget)}`,
        desc: "Ödül alınca sonraki hedef otomatik açılır.",
        progressText: fmtProgress(referrals, referralTarget),
        progress: referrals,
        max: referralTarget,
        reward: referralClaimed[referralTarget] ? "Alındı" : referralRewardText,
        claimable: referrals >= referralTarget && !referralClaimed[referralTarget],
        claimed: !!referralClaimed[referralTarget],
        cta: "Davet",
      },
      {
        key: "pvp_play",
        title: "PvP Oyna",
        desc: "Günlük maç görevi. Hedef dinamik büyür.",
        progressText: fmtProgress(m.pvpPlayedToday, ds.pvpPlayTarget),
        progress: Number(m.pvpPlayedToday || 0),
        max: Number(ds.pvpPlayTarget || 5),
        reward: m.pvpPlayRewardClaimedToday ? "Alındı" : `+${shortNum(ds.pvpPlayReward)} yton`,
        claimable:
          Number(m.pvpPlayedToday || 0) >= Number(ds.pvpPlayTarget || 5) &&
          !m.pvpPlayRewardClaimedToday,
        claimed: !!m.pvpPlayRewardClaimedToday,
        cta: "Maça Git",
      },
      {
        key: "pvp_win",
        title: "PvP Kazan",
        desc: "Kazanma görevi de günlük olarak yenilenir.",
        progressText: fmtProgress(m.pvpWinsToday, ds.pvpWinTarget),
        progress: Number(m.pvpWinsToday || 0),
        max: Number(ds.pvpWinTarget || 3),
        reward: m.pvpWinRewardClaimedToday ? "Alındı" : `+${shortNum(ds.pvpWinReward)} yton`,
        claimable:
          Number(m.pvpWinsToday || 0) >= Number(ds.pvpWinTarget || 3) &&
          !m.pvpWinRewardClaimedToday,
        claimed: !!m.pvpWinRewardClaimedToday,
        cta: "Savaş",
      },
      {
        key: "energy_refill",
        title: "Enerji Doldur",
        desc: "Enerji doldurma hedefi her yeni gün sıfırlanır.",
        progressText: fmtProgress(m.energyRefillsToday, ds.energyTarget),
        progress: Number(m.energyRefillsToday || 0),
        max: Number(ds.energyTarget || 3),
        reward: m.energyRewardClaimedToday ? "Alındı" : `+${shortNum(ds.energyReward)} yton`,
        claimable:
          Number(m.energyRefillsToday || 0) >= Number(ds.energyTarget || 3) &&
          !m.energyRewardClaimedToday,
        claimed: !!m.energyRewardClaimedToday,
        cta: "Doldur",
      },
      {
        key: "level_next",
        title: `Level ${levelTarget} Ol`,
        desc: "Level ödülü alındığında yeni eşik açılır.",
        progressText: fmtProgress(level, levelTarget),
        progress: level,
        max: levelTarget,
        reward: levelClaimed[levelTarget] ? "Alındı" : `+${shortNum(levelRewardCoins)} yton`,
        claimable: level >= levelTarget && !levelClaimed[levelTarget],
        claimed: !!levelClaimed[levelTarget],
        cta: "Seviye",
      },
      {
        key: "telegram_join",
        title: "Telegram Grubuna Katıl",
        desc: claimedToday ? "Topluluk ödülü tek seferliktir." : "Katılım simülasyonu ile ödülü al.",
        progressText: m.telegramJoinRewardClaimed ? "Tamamlandı" : "Hazır",
        progress: m.telegramJoinRewardClaimed ? 1 : 0,
        max: 1,
        reward: m.telegramJoinRewardClaimed ? "Alındı" : "+15 yton",
        claimable: !m.telegramJoinRewardClaimed,
        claimed: !!m.telegramJoinRewardClaimed,
        cta: "Katıl",
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
      window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text: "Görev ödülü alındı!" } }));
    } catch (_) {}
  }

  _missionCta(task) {
    if (task.claimed) return "Alındı";
    if (task.claimable) return "Ödülü Al";
    return task.cta || "Detay";
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

      for (let i = this.hit.length - 1; i >= 0; i--) {
        const h = this.hit[i];
        if (!pointInRect(px, py, h.rect)) continue;

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

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);
    const state = this.store.get() || {};
    const safe = this._safeRect();
    const bg = this._getBg();

    const topReserved = Number(state?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);
    const isNarrow = safe.w <= 420;
    const isTiny = safe.w <= 380;

    const sidePad = isTiny ? 10 : 12;
    const shellX = safe.x + sidePad;
    const shellY = safe.y + topReserved + 8;
    const shellW = safe.w - sidePad * 2;
    const shellH = Math.max(180, safe.h - topReserved - bottomReserved - 16);

    const headerH = isTiny ? 72 : 78;
    const listPad = isTiny ? 8 : 10;
    const listX = shellX + listPad;
    const listY = shellY + headerH + 8;
    const listW = shellW - listPad * 2;
    const listH = shellH - headerH - 16;

    ctx.clearRect(0, 0, W, H);
    drawCover(ctx, bg, 0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.50)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(10,12,18,0.72)";
    fillRoundRect(ctx, shellX, shellY, shellW, shellH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, shellX + 0.5, shellY + 0.5, shellW - 1, shellH - 1, 20);

    const shine = ctx.createLinearGradient(shellX, shellY, shellX, shellY + shellH * 0.38);
    shine.addColorStop(0, "rgba(255,255,255,0.08)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    fillRoundRect(ctx, shellX, shellY, shellW, shellH, 20);

    const backRect = { x: shellX + 10, y: shellY + 12, w: isTiny ? 74 : 84, h: 32 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 11);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 11);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${isTiny ? 12 : 13}px system-ui`;
    ctx.fillText("← Geri", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2 + 0.5);
    this.hit = [{ type: "back", rect: backRect }];

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `900 ${isTiny ? 22 : 24}px system-ui`;
    ctx.fillText("Görevler", shellX + 12, shellY + 58);

    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = `${isTiny ? 11 : 12}px system-ui`;
    ctx.fillText("PvP sayfası gibi tek kolon mobil düzen", shellX + 12, shellY + headerH - 10);

    const daily = this._getDaily();
    const streak = Number(daily.streak || 0);
    const claimedToday = daily.lastClaimDay === this._todayKey();
    const tasks = this._taskData();

    const blocks = [];
    blocks.push({ type: "hero", h: isNarrow ? 126 : 114 });
    blocks.push({ type: "milestones", h: isNarrow ? 118 : 108 });
    for (const task of tasks) blocks.push({ type: "task", h: isNarrow ? 138 : 122, task });

    const gap = 10;
    const contentH = blocks.reduce((sum, b) => sum + b.h, 0) + Math.max(0, blocks.length - 1) * gap;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    let y = listY - this.scrollY;

    for (const block of blocks) {
      if (block.type === "hero") {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, listX, y, listW, block.h, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 18);

        ctx.fillStyle = "#fff";
        ctx.font = `900 ${isTiny ? 14 : 15}px system-ui`;
        ctx.fillText("Günlük Bonus Durumu", listX + 14, y + 22);

        const chipW = isTiny ? 112 : 126;
        const chipH = 30;
        const chipX = listX + listW - chipW - 12;
        const chipY = y + 12;
        ctx.fillStyle = claimedToday ? "rgba(31,111,42,0.88)" : "rgba(242,211,107,0.18)";
        fillRoundRect(ctx, chipX, chipY, chipW, chipH, 999);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        strokeRoundRect(ctx, chipX + 0.5, chipY + 0.5, chipW - 1, chipH - 1, 999);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(claimedToday ? "Bugün Alındı" : "Bugün Hazır", chipX + chipW / 2, chipY + chipH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.font = `${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(`Seri giriş: ${streak} gün`, listX + 14, y + 50);
        ctx.fillText("İlk 6 gün: +10 yton", listX + 14, y + 70);
        ctx.fillText("7. gün: +40 yton", listX + 14, y + 90);
        ctx.fillText("30. gün büyük ödül: HK MP5", listX + 14, y + 110);
      }

      if (block.type === "milestones") {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        fillRoundRect(ctx, listX, y, listW, block.h, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 18);

        ctx.fillStyle = "#fff";
        ctx.font = `900 ${isTiny ? 14 : 15}px system-ui`;
        ctx.fillText("Giriş Takvimi Özeti", listX + 14, y + 22);

        const cols = 3;
        const innerGap = 8;
        const cellW = Math.floor((listW - 28 - innerGap * (cols - 1)) / cols);
        const cellY = y + 34;
        const items = [
          { t: "1-6 Gün", s: "+10 yton" },
          { t: "7. Gün", s: "+40 yton" },
          { t: "30. Gün", s: daily.got30DayWeapon ? "MP5 alındı" : `${Math.min(streak, 30)}/30` },
        ];

        for (let i = 0; i < items.length; i++) {
          const bx = listX + 14 + i * (cellW + innerGap);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          fillRoundRect(ctx, bx, cellY, cellW, 58, 14);
          ctx.strokeStyle = i === 1 ? "rgba(242,211,107,0.34)" : "rgba(255,255,255,0.10)";
          strokeRoundRect(ctx, bx + 0.5, cellY + 0.5, cellW - 1, 58 - 1, 14);
          ctx.fillStyle = "#fff";
          ctx.font = `900 ${fitText(ctx, items[i].t, cellW - 18, isTiny ? 11 : 12)}px system-ui`;
          ctx.fillText(items[i].t, bx + 10, cellY + 20);
          ctx.fillStyle = "rgba(255,255,255,0.72)";
          ctx.font = `${isTiny ? 10 : 11}px system-ui`;
          ctx.fillText(items[i].s, bx + 10, cellY + 40);
        }
      }

      if (block.type === "task") {
        const t = block.task;
        const titleRightPad = 110;
        const btnW = isTiny ? 94 : 102;
        const btnH = 34;
        const btnX = listX + listW - btnW - 14;
        const btnY = y + block.h - btnH - 14;
        const progX = listX + 14;
        const progW = listW - btnW - 38;

        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 18);

        const titleSize = fitText(ctx, t.title, listW - titleRightPad, isTiny ? 15 : 17);
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${titleSize}px system-ui`;
        ctx.fillText(t.title, listX + 14, y + 24);

        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = `${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(t.desc, listX + 14, y + 46);

        const progLabel = t.progressText;
        const rewardText = `Ödül: ${t.reward}`;

        ctx.fillStyle = "rgba(255,255,255,0.12)";
        fillRoundRect(ctx, progX, y + 58, progW, 10, 999);
        const fillW = t.claimed ? progW : Math.max(8, progW * pct(t.progress, t.max));
        ctx.fillStyle = t.claimed ? "rgba(31,111,42,0.90)" : "rgba(255,255,255,0.78)";
        fillRoundRect(ctx, progX, y + 58, fillW, 10, 999);

        ctx.fillStyle = "rgba(255,255,255,0.84)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        ctx.fillText(progLabel, progX, y + 84);

        ctx.fillStyle = "rgba(255,255,255,0.74)";
        const rewardSize = fitText(ctx, rewardText, listW - 28, isTiny ? 10 : 11, 600);
        ctx.font = `600 ${rewardSize}px system-ui`;
        ctx.fillText(rewardText, progX, y + 104);

        let btnColor = "rgba(255,255,255,0.08)";
        if (t.claimed) btnColor = "rgba(31,111,42,0.88)";
        else if (t.claimable) btnColor = "rgba(242,211,107,0.18)";

        ctx.fillStyle = btnColor;
        fillRoundRect(ctx, btnX, btnY, btnW, btnH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        strokeRoundRect(ctx, btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(this._missionCta(t), btnX + btnW / 2, btnY + btnH / 2 + 0.5);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        if (t.claimable) {
          this.hit.push({ type: "claim", key: t.key, rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
        }
      }

      y += block.h + gap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = shellX + shellW - 5;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(42, (listH / contentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      fillRoundRect(ctx, trackX, trackY, 3, trackH, 999);
      ctx.fillStyle = "rgba(255,255,255,0.34)";
      fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 999);
    }
  }
}
