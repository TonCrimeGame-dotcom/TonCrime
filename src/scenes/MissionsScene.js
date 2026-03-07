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
    return this.assets.images?.missions || this.assets.images?.background || null;
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
    return s.missions || {
      adsWatchedToday: 0,
      adsRewardClaimedToday: false,
      referrals: 0,
      referralMilestonesClaimed: {},
      pvpPlayedToday: 0,
      pvpWinsToday: 0,
      pvpPlayRewardClaimedToday: false,
      pvpWinRewardClaimedToday: false,
      energyRefillsToday: 0,
      energyRewardClaimedToday: false,
      levelRewardClaimed: {},
      telegramJoinRewardClaimed: false,
      lastDayKey: null,
    };
  }

  _taskData() {
    const s = this.store.get();
    const p = s.player || {};
    const m = this._getMissionState();
    const claimedToday = this._getDaily().lastClaimDay === this._todayKey();

    const level = Number(p.level || 1);
    const referrals = Number(m.referrals || 0);

    const referralClaimed = m.referralMilestonesClaimed || {};
    const levelClaimed = m.levelRewardClaimed || {};

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
        desc: "Günlük 20 reklama kadar izle. Tamamlayınca bonus al.",
        progressText: fmtProgress(m.adsWatchedToday, 20),
        progress: Number(m.adsWatchedToday || 0),
        max: 20,
        reward: m.adsRewardClaimedToday ? "Alındı" : "20 reklam = +50 yton",
        claimable: Number(m.adsWatchedToday || 0) >= 20 && !m.adsRewardClaimedToday,
        claimed: !!m.adsRewardClaimedToday,
      },
      {
        key: "ref10",
        title: "Arkadaş Davet • 10",
        desc: "10 arkadaş davet et.",
        progressText: fmtProgress(referrals, 10),
        progress: referrals,
        max: 10,
        reward: referralClaimed[10] ? "Alındı" : "Ödül: En düşük silah",
        claimable: referrals >= 10 && !referralClaimed[10],
        claimed: !!referralClaimed[10],
      },
      {
        key: "ref100",
        title: "Arkadaş Davet • 100",
        desc: "100 arkadaş davet et.",
        progressText: fmtProgress(referrals, 100),
        progress: referrals,
        max: 100,
        reward: referralClaimed[100] ? "Alındı" : "Ödül: Orta seviye silah",
        claimable: referrals >= 100 && !referralClaimed[100],
        claimed: !!referralClaimed[100],
      },
      {
        key: "ref1000",
        title: "Arkadaş Davet • 1000",
        desc: "1000 arkadaş davet et.",
        progressText: fmtProgress(referrals, 1000),
        progress: referrals,
        max: 1000,
        reward: referralClaimed[1000] ? "Alındı" : "Ödül: En güçlü silah",
        claimable: referrals >= 1000 && !referralClaimed[1000],
        claimed: !!referralClaimed[1000],
      },
      {
        key: "ref5000",
        title: "Arkadaş Davet • 5000",
        desc: "5000 arkadaş davet et.",
        progressText: fmtProgress(referrals, 5000),
        progress: referrals,
        max: 5000,
        reward: referralClaimed[5000] ? "Alındı" : "Ödül: Premium",
        claimable: referrals >= 5000 && !referralClaimed[5000],
        claimed: !!referralClaimed[5000],
      },
      {
        key: "pvp_play",
        title: "PvP Oyna",
        desc: "Bugün 5 PvP maçı oyna.",
        progressText: fmtProgress(m.pvpPlayedToday, 5),
        progress: Number(m.pvpPlayedToday || 0),
        max: 5,
        reward: m.pvpPlayRewardClaimedToday ? "Alındı" : "Ödül: +25 yton",
        claimable: Number(m.pvpPlayedToday || 0) >= 5 && !m.pvpPlayRewardClaimedToday,
        claimed: !!m.pvpPlayRewardClaimedToday,
      },
      {
        key: "pvp_win",
        title: "PvP Kazan",
        desc: "Bugün 3 PvP maçı kazan.",
        progressText: fmtProgress(m.pvpWinsToday, 3),
        progress: Number(m.pvpWinsToday || 0),
        max: 3,
        reward: m.pvpWinRewardClaimedToday ? "Alındı" : "Ödül: +40 yton",
        claimable: Number(m.pvpWinsToday || 0) >= 3 && !m.pvpWinRewardClaimedToday,
        claimed: !!m.pvpWinRewardClaimedToday,
      },
      {
        key: "energy_refill",
        title: "Enerji Doldur",
        desc: "Bugün 3 kez enerji doldur.",
        progressText: fmtProgress(m.energyRefillsToday, 3),
        progress: Number(m.energyRefillsToday || 0),
        max: 3,
        reward: m.energyRewardClaimedToday ? "Alındı" : "Ödül: +20 yton",
        claimable: Number(m.energyRefillsToday || 0) >= 3 && !m.energyRewardClaimedToday,
        claimed: !!m.energyRewardClaimedToday,
      },
      {
        key: "level10",
        title: "Level 10 Ol",
        desc: "Karakterini level 10 yap.",
        progressText: fmtProgress(level, 10),
        progress: level,
        max: 10,
        reward: levelClaimed[10] ? "Alındı" : "Ödül: +100 yton",
        claimable: level >= 10 && !levelClaimed[10],
        claimed: !!levelClaimed[10],
      },
      {
        key: "level25",
        title: "Level 25 Ol",
        desc: "Karakterini level 25 yap.",
        progressText: fmtProgress(level, 25),
        progress: level,
        max: 25,
        reward: levelClaimed[25] ? "Alındı" : "Ödül: +250 yton",
        claimable: level >= 25 && !levelClaimed[25],
        claimed: !!levelClaimed[25],
      },
      {
        key: "level50",
        title: "Level 50 Ol",
        desc: "Karakterini level 50 yap.",
        progressText: fmtProgress(level, 50),
        progress: level,
        max: 50,
        reward: levelClaimed[50] ? "Alındı" : "Ödül: +500 yton",
        claimable: level >= 50 && !levelClaimed[50],
        claimed: !!levelClaimed[50],
      },
      {
        key: "telegram_join",
        title: "Telegram Gruplarına Katıl",
        desc: "Topluluk grubuna katılma ödülü.",
        progressText: this._getMissionState().telegramJoinRewardClaimed ? "Tamamlandı" : "Hazır",
        progress: this._getMissionState().telegramJoinRewardClaimed ? 1 : 0,
        max: 1,
        reward: this._getMissionState().telegramJoinRewardClaimed ? "Alındı" : "Ödül: +15 yton",
        claimable: !this._getMissionState().telegramJoinRewardClaimed,
        claimed: !!this._getMissionState().telegramJoinRewardClaimed,
      },
    ];
  }

  _claimMission(key) {
    const s = this.store.get();
    const missions = { ...(s.missions || {}) };
    const weapons = { ...(s.weapons || { owned: {}, equippedId: null }) };
    const player = s.player || {};
    let coins = Number(s.coins || 0);
    let premium = !!s.premium;
    let changed = false;

    missions.referralMilestonesClaimed = { ...(missions.referralMilestonesClaimed || {}) };
    missions.levelRewardClaimed = { ...(missions.levelRewardClaimed || {}) };

    const addWeapon = (id, name, pct) => {
      weapons.owned = { ...(weapons.owned || {}), [id]: true };
      if (!weapons.equippedId) weapons.equippedId = id;
      if (!player.weaponName || player.weaponName === "Silah Yok") {
        player.weaponName = name;
        player.weaponBonus = `+%${pct}`;
        player.weaponIconBonusPct = pct;
      }
    };

    if (key === "ads" && Number(missions.adsWatchedToday || 0) >= 20 && !missions.adsRewardClaimedToday) {
      coins += 50;
      missions.adsRewardClaimedToday = true;
      changed = true;
    }

    if (key === "ref10" && Number(missions.referrals || 0) >= 10 && !missions.referralMilestonesClaimed[10]) {
      missions.referralMilestonesClaimed[10] = true;
      addWeapon("mossberg_500", "Mossberg 500 (12ga)", 25);
      changed = true;
    }

    if (key === "ref100" && Number(missions.referrals || 0) >= 100 && !missions.referralMilestonesClaimed[100]) {
      missions.referralMilestonesClaimed[100] = true;
      addWeapon("ak47", "AK-47 (7.62×39)", 35);
      changed = true;
    }

    if (key === "ref1000" && Number(missions.referrals || 0) >= 1000 && !missions.referralMilestonesClaimed[1000]) {
      missions.referralMilestonesClaimed[1000] = true;
      addWeapon("m134", "M134 Minigun (7.62×51)", 70);
      changed = true;
    }

    if (key === "ref5000" && Number(missions.referrals || 0) >= 5000 && !missions.referralMilestonesClaimed[5000]) {
      missions.referralMilestonesClaimed[5000] = true;
      premium = true;
      changed = true;
    }

    if (key === "pvp_play" && Number(missions.pvpPlayedToday || 0) >= 5 && !missions.pvpPlayRewardClaimedToday) {
      coins += 25;
      missions.pvpPlayRewardClaimedToday = true;
      changed = true;
    }

    if (key === "pvp_win" && Number(missions.pvpWinsToday || 0) >= 3 && !missions.pvpWinRewardClaimedToday) {
      coins += 40;
      missions.pvpWinRewardClaimedToday = true;
      changed = true;
    }

    if (key === "energy_refill" && Number(missions.energyRefillsToday || 0) >= 3 && !missions.energyRewardClaimedToday) {
      coins += 20;
      missions.energyRewardClaimedToday = true;
      changed = true;
    }

    if (key === "level10" && Number(player.level || 0) >= 10 && !missions.levelRewardClaimed[10]) {
      missions.levelRewardClaimed[10] = true;
      coins += 100;
      changed = true;
    }

    if (key === "level25" && Number(player.level || 0) >= 25 && !missions.levelRewardClaimed[25]) {
      missions.levelRewardClaimed[25] = true;
      coins += 250;
      changed = true;
    }

    if (key === "level50" && Number(player.level || 0) >= 50 && !missions.levelRewardClaimed[50]) {
      missions.levelRewardClaimed[50] = true;
      coins += 500;
      changed = true;
    }

    if (key === "telegram_join" && !missions.telegramJoinRewardClaimed) {
      missions.telegramJoinRewardClaimed = true;
      coins += 15;
      changed = true;
    }

    if (!changed) return;

    const patch = {
      coins,
      missions,
      weapons,
      premium,
      player: { ...player },
    };

    this.store.set(patch);

    try {
      window.dispatchEvent(
        new CustomEvent("tc:toast", {
          detail: { text: "Görev ödülü alındı!" },
        })
      );
    } catch (_) {}
  }

  update() {
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

    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x + 12;
    const panelY = Math.max(74, safe.y + 74);
    const panelW = safe.w - 24;
    const panelH = safe.h - 148;

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 18);

    const backRect = { x: panelX + 14, y: panelY + 12, w: 78, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 10);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 12px system-ui";
    ctx.fillText("Geri", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2);
    this.hit = [{ type: "back", rect: backRect }];

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Görevler", panelX + 16, panelY + 64);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("Günlük giriş, PvP, reklam ve davet görevleri", panelX + 16, panelY + 84);

    const listX = panelX + 12;
    const listY = panelY + 100;
    const listW = panelW - 24;
    const listH = panelH - 112;

    const daily = this._getDaily();
    const streak = Number(daily.streak || 0);
    const claimedToday = daily.lastClaimDay === this._todayKey();
    const tasks = this._taskData();

    const blocks = [];
    blocks.push({ type: "summary", h: 134 });
    blocks.push({ type: "title", h: 30, text: "7 Günlük Giriş Takvimi" });
    blocks.push({ type: "grid7", h: 210 });
    blocks.push({ type: "title", h: 30, text: "30 Gün Büyük Ödül" });
    blocks.push({ type: "reward30", h: 112 });
    blocks.push({ type: "title", h: 30, text: "Aktif Görevler" });
    for (const t of tasks) blocks.push({ type: "task", h: 92, task: t });

    const gap = 10;
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
        ctx.font = "900 14px system-ui";
        ctx.fillText("Günlük Giriş Bonus Durumu", listX + 14, y + 22);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "12px system-ui";
        ctx.fillText(`Bugün ödül: ${claimedToday ? "Alındı" : "Hazır"}`, listX + 14, y + 48);
        ctx.fillText(`Aktif seri: ${streak} gün`, listX + 14, y + 68);
        ctx.fillText("İlk 6 gün: her gün 10 yton", listX + 14, y + 88);
        ctx.fillText("7. gün: +40 yton → ilk 7 gün toplam 100 yton", listX + 14, y + 108);

        const pillW = 132;
        const pillH = 34;
        const pillX = listX + listW - pillW - 14;
        const pillY = y + 46;
        ctx.fillStyle = claimedToday ? "rgba(31,111,42,0.85)" : "rgba(242,211,107,0.18)";
        fillRoundRect(ctx, pillX, pillY, pillW, pillH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        strokeRoundRect(ctx, pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 12px system-ui";
        ctx.fillText(claimedToday ? "Bugün Alındı" : "Bugün Hazır", pillX + pillW / 2, pillY + pillH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      if (block.type === "title") {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "900 14px system-ui";
        ctx.fillText(block.text, listX + 2, y + 22);
      }

      if (block.type === "grid7") {
        const cols = 4;
        const cellGap = 10;
        const cellW = Math.floor((listW - cellGap * (cols - 1)) / cols);
        const cellH = 92;

        for (let i = 0; i < 7; i++) {
          const day = i + 1;
          const row = Math.floor(i / cols);
          const col = i % cols;

          const cx = listX + col * (cellW + cellGap);
          const cy = y + row * (cellH + cellGap);

          const done = streak >= day;
          const is7 = day === 7;

          ctx.fillStyle = done
            ? "rgba(31,111,42,0.80)"
            : is7
            ? "rgba(242,211,107,0.12)"
            : "rgba(255,255,255,0.07)";
          fillRoundRect(ctx, cx, cy, cellW, cellH, 14);
          ctx.strokeStyle = is7 ? "rgba(242,211,107,0.42)" : "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, cx + 0.5, cy + 0.5, cellW - 1, cellH - 1, 14);

          ctx.fillStyle = "#fff";
          ctx.font = "900 13px system-ui";
          ctx.fillText(`Gün ${day}`, cx + 10, cy + 20);

          ctx.fillStyle = "rgba(255,255,255,0.78)";
          ctx.font = "12px system-ui";
          if (day === 7) {
            ctx.fillText("+40 yton", cx + 10, cy + 46);
            ctx.fillText("Toplam 100", cx + 10, cy + 66);
          } else {
            ctx.fillText("+10 yton", cx + 10, cy + 56);
          }

          if (done) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.font = "900 18px system-ui";
            ctx.fillText("✓", cx + cellW - 22, cy + 24);
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
        ctx.font = "900 14px system-ui";
        ctx.fillText("30 gün kesintisiz giriş", listX + 14, y + 24);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "12px system-ui";
        ctx.fillText("Ödül: HK MP5 (hafif makineli silah)", listX + 14, y + 50);
        ctx.fillText(`İlerleme: ${Math.min(streak, 30)}/30`, listX + 14, y + 72);
        ctx.fillText(got30 ? "Durum: Alındı" : "Durum: Bekliyor", listX + 14, y + 92);

        const barX = listX + listW - 150;
        const barY = y + 42;
        const barW = 120;
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

        ctx.fillStyle = "#fff";
        ctx.font = "900 13px system-ui";
        ctx.fillText(t.title, listX + 14, y + 22);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "12px system-ui";
        ctx.fillText(t.desc, listX + 14, y + 42);

        const barX = listX + 14;
        const barY = y + 56;
        const barW = listW - 160;
        const barH = 10;

        ctx.fillStyle = "rgba(255,255,255,0.10)";
        fillRoundRect(ctx, barX, barY, barW, barH, 8);
        ctx.fillStyle = t.claimed ? "rgba(31,111,42,0.88)" : "rgba(255,255,255,0.78)";
        fillRoundRect(ctx, barX, barY, Math.max(6, barW * pct(t.progress, t.max)), barH, 8);

        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.font = "11px system-ui";
        ctx.fillText(t.progressText, barX, barY + 24);

        ctx.textAlign = "right";
        ctx.fillText(t.reward, listX + listW - 112, barY + 24);
        ctx.textAlign = "left";

        const btnW = 92;
        const btnH = 34;
        const btnX = listX + listW - btnW - 14;
        const btnY = y + 28;

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
        ctx.font = "900 12px system-ui";
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
