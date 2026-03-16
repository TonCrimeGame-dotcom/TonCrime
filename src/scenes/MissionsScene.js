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

function wrapText(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxW) line = test;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
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
        key: "daily_login",
        title: "Günlük Giriş",
        desc: "Her gün giriş yap ve seri bonuslarını topla.",
        progressText: claimedToday ? "Tamamlandı" : "Bugün hazır",
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
    const s = this.store.get();
    const player = s.player || {};
    const missions = this._getMissionState();
    const daily = this._getDaily();

    const isMobile = safe.w <= 560;
    const isTiny = safe.w <= 390;

    const outerPad = isTiny ? 8 : 12;
    const shellX = safe.x + outerPad;
    const shellY = safe.y + Math.max(isTiny ? 74 : 82, safe.y + (isTiny ? 74 : 82));
    const shellW = safe.w - outerPad * 2;
    const shellH = safe.h - (isTiny ? 94 : 106);

    const headerH = isMobile ? 108 : 92;
    const contentPad = isTiny ? 10 : 12;
    const sectionGap = isTiny ? 8 : 10;
    const sectionTitleH = 22;

    ctx.clearRect(0, 0, W, H);
    drawCover(ctx, bg, 0, 0, W, H);

    const fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, "rgba(4,6,10,0.48)");
    fade.addColorStop(0.35, "rgba(5,7,12,0.60)");
    fade.addColorStop(1, "rgba(4,5,8,0.82)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(8,10,16,0.74)";
    fillRoundRect(ctx, shellX, shellY, shellW, shellH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, shellX + 0.5, shellY + 0.5, shellW - 1, shellH - 1, 18);

    this.hit = [];

    const backRect = { x: shellX + 10, y: shellY + 10, w: isTiny ? 56 : 62, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 11);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 11);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${isTiny ? 12 : 13}px system-ui`;
    ctx.fillText("← Geri", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2);
    this.hit.push({ type: "back", rect: backRect });

    const titleX = shellX + 12;
    const titleY = shellY + 58;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `900 ${isTiny ? 20 : 22}px system-ui`;
    ctx.fillText("Görev Merkezi", titleX, titleY);
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = `${isTiny ? 11 : 12}px system-ui`;
    ctx.fillText("PvP sayfası gibi kompakt mobil düzen", titleX, titleY + 18);

    const chipAreaY = shellY + 14;
    const chipRight = shellX + shellW - 12;
    const chipGap = 8;
    const chipH = 28;
    const chip2W = isTiny ? 102 : 118;
    const chip1W = isTiny ? 78 : 90;
    const chip2X = chipRight - chip2W;
    const chip1X = chip2X - chipGap - chip1W;

    const levelTxt = `LVL ${Number(player.level || 1)}`;
    const streakTxt = `Seri ${Number(daily.streak || 0)}`;

    ctx.fillStyle = "rgba(255,255,255,0.09)";
    fillRoundRect(ctx, chip1X, chipAreaY, chip1W, chipH, 14);
    fillRoundRect(ctx, chip2X, chipAreaY, chip2W, chipH, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, chip1X + 0.5, chipAreaY + 0.5, chip1W - 1, chipH - 1, 14);
    strokeRoundRect(ctx, chip2X + 0.5, chipAreaY + 0.5, chip2W - 1, chipH - 1, 14);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = `800 ${isTiny ? 11 : 12}px system-ui`;
    ctx.fillText(levelTxt, chip1X + chip1W / 2, chipAreaY + chipH / 2);
    ctx.fillText(streakTxt, chip2X + chip2W / 2, chipAreaY + chipH / 2);

    const listX = shellX + contentPad;
    const listY = shellY + headerH;
    const listW = shellW - contentPad * 2;
    const listH = shellH - headerH - contentPad;

    const tasks = this._taskData();
    const ds = missions.dailyScale || {};
    const summaryCards = [
      { label: "Reklam", value: fmtProgress(missions.adsWatchedToday, ds.adsTarget), tone: "gold" },
      { label: "PvP", value: fmtProgress(missions.pvpPlayedToday, ds.pvpPlayTarget), tone: "blue" },
      { label: "Win", value: fmtProgress(missions.pvpWinsToday, ds.pvpWinTarget), tone: "green" },
      { label: "Enerji", value: fmtProgress(missions.energyRefillsToday, ds.energyTarget), tone: "violet" },
    ];

    const cardCols = isMobile ? 2 : 4;
    const cardGap = 8;
    const summaryH = isMobile ? 90 : 68;
    const summaryCardW = Math.floor((listW - cardGap * (cardCols - 1)) / cardCols);
    const summaryCardH = isMobile ? 40 : 68;

    const blocks = [];
    blocks.push({ type: "summaryRow", h: summaryH });
    blocks.push({ type: "loginBox", h: isMobile ? 94 : 88 });
    blocks.push({ type: "sectionTitle", h: sectionTitleH, text: "Giriş Ödülleri" });
    blocks.push({ type: "dailyGrid", h: isMobile ? 176 : 90 });
    blocks.push({ type: "sectionTitle", h: sectionTitleH, text: "30 Günlük Büyük Ödül" });
    blocks.push({ type: "reward30", h: isMobile ? 108 : 94 });
    blocks.push({ type: "sectionTitle", h: sectionTitleH, text: "Aktif Görevler" });
    for (const t of tasks.slice(1)) blocks.push({ type: "task", h: isMobile ? 128 : 94, task: t });

    const contentH = blocks.reduce((acc, b) => acc + b.h, 0) + (blocks.length - 1) * sectionGap + 8;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    let y = listY + 2 - this.scrollY;

    for (const block of blocks) {
      if (block.type === "summaryRow") {
        for (let i = 0; i < summaryCards.length; i++) {
          const row = isMobile ? Math.floor(i / 2) : 0;
          const col = isMobile ? i % 2 : i;
          const cx = listX + col * (summaryCardW + cardGap);
          const cy = y + row * (summaryCardH + cardGap);
          const card = summaryCards[i];

          ctx.fillStyle =
            card.tone === "gold" ? "rgba(255,197,84,0.13)" :
            card.tone === "blue" ? "rgba(90,142,255,0.13)" :
            card.tone === "green" ? "rgba(61,207,107,0.13)" :
            "rgba(183,108,255,0.13)";
          fillRoundRect(ctx, cx, cy, summaryCardW, summaryCardH, 14);
          ctx.strokeStyle = "rgba(255,255,255,0.10)";
          strokeRoundRect(ctx, cx + 0.5, cy + 0.5, summaryCardW - 1, summaryCardH - 1, 14);

          ctx.fillStyle = "rgba(255,255,255,0.66)";
          ctx.font = `${isTiny ? 10 : 11}px system-ui`;
          ctx.textAlign = "left";
          ctx.fillText(card.label, cx + 12, cy + 16);
          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.font = `900 ${isTiny ? 13 : 14}px system-ui`;
          ctx.fillText(card.value, cx + 12, cy + (isMobile ? 31 : 38));
        }
      }

      if (block.type === "loginBox") {
        const claimedToday = daily.lastClaimDay === this._todayKey();
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `900 ${isTiny ? 14 : 15}px system-ui`;
        ctx.fillText("Günlük giriş bonusu", listX + 14, y + 22);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        const lines = [
          claimedToday ? "Bugünkü giriş ödülü alındı." : "Bugünkü giriş ödülü hazır.",
          `Aktif seri: ${Number(daily.streak || 0)} gün`,
          "İlk 6 gün +10 yton, 7. gün +40 yton, 30. gün HK MP5",
        ];
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], listX + 14, y + 42 + i * 18);
        }

        const pillW = isTiny ? 104 : 118;
        const pillH = 34;
        const pillX = listX + listW - pillW - 12;
        const pillY = y + block.h - pillH - 12;
        ctx.fillStyle = claimedToday ? "rgba(31,111,42,0.90)" : "rgba(255,197,84,0.16)";
        fillRoundRect(ctx, pillX, pillY, pillW, pillH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        strokeRoundRect(ctx, pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1, 12);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(claimedToday ? "Bugün Alındı" : "Bugün Hazır", pillX + pillW / 2, pillY + pillH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      if (block.type === "sectionTitle") {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `900 ${isTiny ? 13 : 14}px system-ui`;
        ctx.fillText(block.text, listX + 2, y + 16);
      }

      if (block.type === "dailyGrid") {
        const cols = isMobile ? 2 : 7;
        const rows = Math.ceil(7 / cols);
        const cellGap = 8;
        const cellW = Math.floor((listW - cellGap * (cols - 1)) / cols);
        const cellH = isMobile ? 84 : 90;
        for (let i = 0; i < 7; i++) {
          const day = i + 1;
          const row = Math.floor(i / cols);
          const col = i % cols;
          const cx = listX + col * (cellW + cellGap);
          const cy = y + row * (cellH + cellGap);
          const done = Number(daily.streak || 0) >= day;
          const is7 = day === 7;

          ctx.fillStyle = done
            ? "rgba(31,111,42,0.82)"
            : is7
            ? "rgba(255,197,84,0.13)"
            : "rgba(255,255,255,0.06)";
          fillRoundRect(ctx, cx, cy, cellW, cellH, 14);
          ctx.strokeStyle = is7 ? "rgba(255,197,84,0.28)" : "rgba(255,255,255,0.10)";
          strokeRoundRect(ctx, cx + 0.5, cy + 0.5, cellW - 1, cellH - 1, 14);

          ctx.fillStyle = "rgba(255,255,255,0.96)";
          ctx.font = `900 ${isTiny ? 12 : 13}px system-ui`;
          ctx.fillText(`Gün ${day}`, cx + 10, cy + 18);
          ctx.fillStyle = "rgba(255,255,255,0.72)";
          ctx.font = `${isTiny ? 10 : 11}px system-ui`;
          ctx.fillText(day === 7 ? "+40 yton" : "+10 yton", cx + 10, cy + 42);
          if (day === 7) ctx.fillText("Toplam 100", cx + 10, cy + 60);
          if (done) {
            ctx.fillStyle = "rgba(255,255,255,0.98)";
            ctx.font = `900 ${isTiny ? 16 : 18}px system-ui`;
            ctx.fillText("✓", cx + cellW - 22, cy + 22);
          }
        }
      }

      if (block.type === "reward30") {
        const got30 = !!daily.got30DayWeapon;
        ctx.fillStyle = got30 ? "rgba(31,111,42,0.82)" : "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `900 ${isTiny ? 14 : 15}px system-ui`;
        ctx.fillText("HK MP5 büyük ödül", listX + 14, y + 22);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        ctx.fillText("30 gün kesintisiz giriş ile açılır.", listX + 14, y + 42);
        ctx.fillText(`Durum: ${got30 ? "Alındı" : "Bekliyor"}`, listX + 14, y + 60);
        ctx.fillText(`İlerleme: ${Math.min(Number(daily.streak || 0), 30)}/30`, listX + 14, y + 78);

        const barX = listX + 14;
        const barY = y + block.h - 22;
        const barW = listW - 28;
        const barH = 10;
        const progress = clamp(Math.min(Number(daily.streak || 0), 30) / 30, 0, 1);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        fillRoundRect(ctx, barX, barY, barW, barH, 8);
        ctx.fillStyle = got30 ? "rgba(255,255,255,0.88)" : "rgba(255,197,84,0.76)";
        fillRoundRect(ctx, barX, barY, Math.max(8, barW * progress), barH, 8);
      }

      if (block.type === "task") {
        const t = block.task;
        const btnW = isTiny ? 96 : 108;
        const btnH = 36;
        const innerPadX = 14;
        const topY = y;

        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, topY, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, topY + 0.5, listW - 1, block.h - 1, 16);

        const titleMaxW = listW - innerPadX * 2 - (isMobile ? 0 : btnW + 12);
        const titleSize = fitText(ctx, t.title, titleMaxW, isTiny ? 14 : 15);
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `900 ${titleSize}px system-ui`;
        ctx.fillText(t.title, listX + innerPadX, topY + 22);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        const descLines = wrapText(ctx, t.desc, listW - innerPadX * 2 - (isMobile ? 0 : btnW + 12));
        for (let i = 0; i < Math.min(descLines.length, 2); i++) {
          ctx.fillText(descLines[i], listX + innerPadX, topY + 42 + i * 14);
        }

        const barX = listX + innerPadX;
        const barY = topY + (isMobile ? 72 : 58);
        const barW = isMobile ? listW - innerPadX * 2 : listW - innerPadX * 2 - btnW - 14;
        const barH = 10;
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        fillRoundRect(ctx, barX, barY, barW, barH, 8);
        ctx.fillStyle = t.claimed ? "rgba(31,111,42,0.88)" : "rgba(255,197,84,0.78)";
        fillRoundRect(ctx, barX, barY, Math.max(6, barW * pct(t.progress, t.max)), barH, 8);

        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        ctx.fillText(t.progressText, barX, barY + 22);

        const rewardText = t.reward;
        const rewardX = listX + innerPadX;
        const rewardY = isMobile ? topY + block.h - 16 : topY + 82;
        const rewardMaxW = isMobile ? listW - innerPadX * 2 - btnW - 10 : listW - innerPadX * 2;
        const rewardSize = fitText(ctx, rewardText, rewardMaxW, isTiny ? 10 : 11, 600);
        ctx.font = `600 ${rewardSize}px system-ui`;
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.fillText(rewardText, rewardX, rewardY);

        const btnX = listX + listW - btnW - 12;
        const btnY = isMobile ? topY + block.h - btnH - 12 : topY + (block.h - btnH) / 2;

        let btnLabel = "Bekliyor";
        let btnColor = "rgba(255,255,255,0.08)";

        if (t.claimed) {
          btnLabel = "Alındı";
          btnColor = "rgba(31,111,42,0.85)";
        } else if (t.claimable) {
          btnLabel = "Ödülü Al";
          btnColor = "rgba(255,197,84,0.18)";
          this.hit.push({ type: "claim", key: t.key, rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
        }

        ctx.fillStyle = btnColor;
        fillRoundRect(ctx, btnX, btnY, btnW, btnH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        strokeRoundRect(ctx, btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1, 12);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `900 ${isTiny ? 11 : 12}px system-ui`;
        ctx.fillText(btnLabel, btnX + btnW / 2, btnY + btnH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      y += block.h + sectionGap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = shellX + shellW - 5;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(34, (listH / contentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      fillRoundRect(ctx, trackX, trackY, 3, trackH, 3);
      ctx.fillStyle = "rgba(255,255,255,0.34)";
      fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 3);
    }
  }
}
