function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
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

function drawCoverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.globalAlpha = prev;
}

function getAssetImageSafe(assets, key) {
  if (!assets) return null;
  try {
    if (typeof assets.getImage === "function") {
      const a = assets.getImage(key);
      if (a) return a;
    }
    if (typeof assets.get === "function") {
      const a = assets.get(key);
      if (a) return a;
    }
    if (assets.images?.[key]) return assets.images[key];
    if (assets[key]) return assets[key];
  } catch (_) {}
  return null;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 2 && ctx.measureText(last + "…").width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + (last.endsWith("…") ? "" : "…");
  }

  return lines;
}

function ensureMissionDefaults(store) {
  const s = store.get() || {};
  const m = s.missions || {};

  const patch = {
    dailyAdWatched: Number(m.dailyAdWatched || 0),
    dailyAdClaimed: !!m.dailyAdClaimed,

    referrals: Number(m.referrals || 0),
    referralClaim10: !!m.referralClaim10,
    referralClaim100: !!m.referralClaim100,
    referralClaim1000: !!m.referralClaim1000,
    referralClaim5000: !!m.referralClaim5000,

    pvpPlayed: Number(m.pvpPlayed || 0),
    pvpClaimed: !!m.pvpClaimed,

    energyRefillUsed: Number(m.energyRefillUsed || 0),
    energyClaimed: !!m.energyClaimed,

    telegramJoined: !!m.telegramJoined,
    telegramClaimed: !!m.telegramClaimed,

    levelClaimedAt: Number(m.levelClaimedAt || 0),
    lastDailyKey: String(m.lastDailyKey || ""),
  };

  store.set({ missions: { ...m, ...patch } });
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
    this.tapCandidate = false;

    this.hit = [];
    this.hitBack = null;

    this.toastText = "";
    this.toastUntil = 0;

    this.telegramUrl = "https://t.me/TONCRIME";
    this.inviteUrl = "https://t.me/share/url?url=https://t.me/TONCRIME_BOT";
  }

  onEnter() {
    ensureMissionDefaults(this.store);
    this._ensureDailyReset();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.hit = [];
    this.hitBack = null;
  }

  _safeRect(w, h) {
    const s = this.store.get() || {};
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    return {
      x: safe.x + 12,
      y: safe.y + topReserved + 6,
      w: safe.w - 24,
      h: safe.h - topReserved - bottomReserved - 12,
    };
  }

  _showToast(text, ms = 1600) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _ensureDailyReset() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const today = dayKey();
    if (m.lastDailyKey === today) return;

    this.store.set({
      missions: {
        ...m,
        dailyAdWatched: 0,
        dailyAdClaimed: false,
        pvpPlayed: 0,
        pvpClaimed: false,
        energyRefillUsed: 0,
        energyClaimed: false,
        lastDailyKey: today,
      },
    });
  }

  _grantCoins(n) {
    const s = this.store.get() || {};
    this.store.set({ coins: Number(s.coins || 0) + Number(n || 0) });
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

  async _watchAd() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    if (Number(m.dailyAdWatched || 0) >= 20) {
      this._showToast("Günlük reklam limiti doldu");
      return;
    }

    let ok = false;

    try {
      if (typeof window?.showRewardedAd === "function") {
        const r = await window.showRewardedAd();
        ok = !!r || r === undefined;
      } else if (typeof window?.tcAds?.showRewarded === "function") {
        const r = await window.tcAds.showRewarded();
        ok = !!r || r === undefined;
      } else {
        ok = true;
      }
    } catch (_) {
      ok = false;
    }

    if (!ok) {
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
    this._showToast("+1 enerji");
  }

  _openInvite() {
    try {
      const rawUrl = "https://t.me/TONCRIME_BOT";
      if (navigator.share) {
        navigator.share({
          title: "TonCrime",
          text: "TonCrime'e katıl",
          url: rawUrl,
        }).catch(() => {});
      } else {
        window.open(this.inviteUrl, "_blank");
      }
    } catch (_) {}

    this._showToast("Davet bağlantısı açıldı");
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
      this._showToast("Katılım açıldı");
      return;
    }

    this._grantCoins(20);
    this._setMissions({
      telegramJoined: true,
      telegramClaimed: true,
    });
    this._showToast("+20 coin");
  }

  _openPvp() {
    try {
      window.dispatchEvent(new CustomEvent("tc:openPvp", { detail: { source: "missions" } }));
    } catch (_) {}
    this._showToast("PvP açılıyor");
  }

  _claim(type) {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const p = s.player || {};

    if (type === "dailyAd" && Number(m.dailyAdWatched || 0) >= 20 && !m.dailyAdClaimed) {
      this._grantCoins(20);
      this._grantXP(10);
      this._setMissions({ dailyAdClaimed: true });
      this._showToast("Reklam ödülü alındı");
      return;
    }

    if (type === "pvp" && Number(m.pvpPlayed || 0) >= 3 && !m.pvpClaimed) {
      this._grantCoins(15);
      this._grantXP(20);
      this._setMissions({ pvpClaimed: true });
      this._showToast("PvP ödülü alındı");
      return;
    }

    if (type === "energy" && Number(m.energyRefillUsed || 0) >= 1 && !m.energyClaimed) {
      this._grantCoins(10);
      this._grantEnergy(10);
      this._setMissions({ energyClaimed: true });
      this._showToast("Enerji ödülü alındı");
      return;
    }

    if (type === "level" && Number(p.level || 1) >= 55 && Number(m.levelClaimedAt || 0) !== 55) {
      this._grantCoins(50);
      this._grantXP(25);
      this._setMissions({ levelClaimedAt: 55 });
      this._showToast("Level ödülü alındı");
      return;
    }

    if (type === "ref10" && Number(m.referrals || 0) >= 10 && !m.referralClaim10) {
      this._setMissions({ referralClaim10: true });
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({
        player: {
          ...p2,
          weaponName: "Başlangıç Bıçağı",
          weaponBonus: "+3%",
        },
      });
      this._showToast("10 davet ödülü alındı");
      return;
    }

    if (type === "ref100" && Number(m.referrals || 0) >= 100 && !m.referralClaim100) {
      this._setMissions({ referralClaim100: true });
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({
        player: {
          ...p2,
          weaponName: "Orta Seviye Silah",
          weaponBonus: "+8%",
        },
      });
      this._showToast("100 davet ödülü alındı");
      return;
    }

    if (type === "ref1000" && Number(m.referrals || 0) >= 1000 && !m.referralClaim1000) {
      this._setMissions({ referralClaim1000: true });
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({
        player: {
          ...p2,
          weaponName: "En Güçlü Silah",
          weaponBonus: "+18%",
        },
      });
      this._showToast("1000 davet ödülü alındı");
      return;
    }

    if (type === "ref5000" && Number(m.referrals || 0) >= 5000 && !m.referralClaim5000) {
      this._setMissions({ referralClaim5000: true });
      this.store.set({ premium: true });
      this._showToast("5000 davet ödülü alındı");
    }
  }

  _cards() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const p = s.player || {};

    return [
      {
        key: "ads",
        title: `Günlük Reklam İzle (${fmtNum(m.dailyAdWatched)}/20)`,
        desc: "Her reklam +1 enerji verir. 20 reklama ulaştığında görev ödülü açılır.",
        reward: m.dailyAdClaimed ? "Ödül alındı" : "Ödül: +20 coin • +10 XP",
        tags: ["Reklam", "Enerji"],
        buttonLabel: m.dailyAdClaimed
          ? "Alındı"
          : Number(m.dailyAdWatched || 0) >= 20
          ? "Ödülü Al"
          : "İzle",
        buttonKind: m.dailyAdClaimed ? "done" : Number(m.dailyAdWatched || 0) >= 20 ? "claim" : "action",
        action: m.dailyAdClaimed
          ? null
          : Number(m.dailyAdWatched || 0) >= 20
          ? "claim:dailyAd"
          : "watchAd",
        progress: clamp(Number(m.dailyAdWatched || 0) / 20, 0, 1),
      },
      {
        key: "invite",
        title: `Arkadaş Davet (${fmtNum(m.referrals)})`,
        desc: "Davet bağlantını paylaş. Davet sayısı backend bağlanınca otomatik ilerler.",
        reward: "Eşikler: 10 • 100 • 1000 • 5000",
        tags: ["Davet", "Referral"],
        buttonLabel: "Davet Et",
        buttonKind: "action",
        action: "invite",
        progress: clamp(Number(m.referrals || 0) / 10, 0, 1),
      },
      {
        key: "pvp",
        title: `PvP Oyna (${fmtNum(m.pvpPlayed)}/3)`,
        desc: "3 maç tamamla. PvP butonu görev sayfasından direkt açılır.",
        reward: m.pvpClaimed ? "Ödül alındı" : "              Ödül: +15 coin • +20 XP",
        tags: ["PvP", "Maç"],
        buttonLabel: m.pvpClaimed
          ? "Alındı"
          : Number(m.pvpPlayed || 0) >= 3
          ? "Ödülü Al"
          : "Oyna",
        buttonKind: m.pvpClaimed ? "done" : Number(m.pvpPlayed || 0) >= 3 ? "claim" : "action",
        action: m.pvpClaimed
          ? null
          : Number(m.pvpPlayed || 0) >= 3
          ? "claim:pvp"
          : "openPvp",
        progress: clamp(Number(m.pvpPlayed || 0) / 3, 0, 1),
      },
      {
        key: "energy",
        title: `Enerji Doldur (${Math.min(1, Number(m.energyRefillUsed || 0))}/1)`,
        desc: "Bir kez enerji dolumu yap. Enerji satın alma tarafı bağlanınca otomatik ilerler.",
        reward: m.energyClaimed ? "Ödül alındı" : "Ödül: +10 coin • +10 enerji",
        tags: ["Enerji", "Bina"],
        buttonLabel: m.energyClaimed
          ? "Alındı"
          : Number(m.energyRefillUsed || 0) >= 1
          ? "Ödülü Al"
          : "Takipte",
        buttonKind: m.energyClaimed ? "done" : Number(m.energyRefillUsed || 0) >= 1 ? "claim" : "info",
        action: m.energyClaimed
          ? null
          : Number(m.energyRefillUsed || 0) >= 1
          ? "claim:energy"
          : null,
        progress: clamp(Number(m.energyRefillUsed || 0), 0, 1),
      },
      {
        key: "level",
        title: `Level Görevi (Seviye ${fmtNum(p.level)}/55)`,
        desc: "55 level ve üstü olduğunda ödül açılır.",
        reward: Number(m.levelClaimedAt || 0) === 55 ? "Ödül alındı" : "Ödül: +50 coin • +25 XP",
        tags: ["Level", "XP"],
        buttonLabel: Number(m.levelClaimedAt || 0) === 55
          ? "Alındı"
          : Number(p.level || 1) >= 55
          ? "Ödülü Al"
          : "Takipte",
        buttonKind: Number(m.levelClaimedAt || 0) === 55
          ? "done"
          : Number(p.level || 1) >= 55
          ? "claim"
          : "info",
        action: Number(m.levelClaimedAt || 0) === 55
          ? null
          : Number(p.level || 1) >= 55
          ? "claim:level"
          : null,
        progress: clamp(Number(p.level || 1) / 55, 0, 1),
      },
      {
        key: "telegram",
        title: "Telegram Grubuna Katıl",
        desc: "Tek butonlu akış: önce katıl, sonra aynı buton ödülü al haline döner.",
        reward: m.telegramClaimed ? "Ödül alındı" : "Ödül: +20 coin",
        tags: ["Telegram", "Sosyal"],
        buttonLabel: m.telegramClaimed ? "Alındı" : m.telegramJoined ? "Al" : "Katıl",
        buttonKind: m.telegramClaimed ? "done" : m.telegramJoined ? "claim" : "telegram",
        action: m.telegramClaimed ? null : "telegram",
        progress: m.telegramClaimed ? 1 : m.telegramJoined ? 1 : 0,
      },
      {
        key: "refThresholds",
        title: "Davet Eşik Ödülleri",
        desc: "Aşağıdaki ödüller davet sayısına göre açılır.",
        reward: "10 / 100 / 1000 / 5000",
        tags: ["Ödül", "Eşik"],
        buttonLabel: "Detay",
        buttonKind: "info",
        action: null,
        progress: clamp(Number(m.referrals || 0) / 5000, 0, 1),
        extraRows: [
          {
            text: `10 davet → ${m.referralClaim10 ? "Alındı" : "Başlangıç Bıçağı"}`,
            action: m.referralClaim10 ? null : Number(m.referrals || 0) >= 10 ? "claim:ref10" : null,
            label: m.referralClaim10 ? "Alındı" : Number(m.referrals || 0) >= 10 ? "Al" : "Kilitli",
            kind: m.referralClaim10 ? "done" : Number(m.referrals || 0) >= 10 ? "claim" : "info",
          },
          {
            text: `100 davet → ${m.referralClaim100 ? "Alındı" : "Orta Seviye Silah"}`,
            action: m.referralClaim100 ? null : Number(m.referrals || 0) >= 100 ? "claim:ref100" : null,
            label: m.referralClaim100 ? "Alındı" : Number(m.referrals || 0) >= 100 ? "Al" : "Kilitli",
            kind: m.referralClaim100 ? "done" : Number(m.referrals || 0) >= 100 ? "claim" : "info",
          },
          {
            text: `1000 davet → ${m.referralClaim1000 ? "Alındı" : "En Güçlü Silah"}`,
            action: m.referralClaim1000 ? null : Number(m.referrals || 0) >= 1000 ? "claim:ref1000" : null,
            label: m.referralClaim1000 ? "Alındı" : Number(m.referrals || 0) >= 1000 ? "Al" : "Kilitli",
            kind: m.referralClaim1000 ? "done" : Number(m.referrals || 0) >= 1000 ? "claim" : "info",
          },
          {
            text: `5000 davet → ${m.referralClaim5000 ? "Alındı" : "Premium"}`,
            action: m.referralClaim5000 ? null : Number(m.referrals || 0) >= 5000 ? "claim:ref5000" : null,
            label: m.referralClaim5000 ? "Alındı" : Number(m.referrals || 0) >= 5000 ? "Al" : "Kilitli",
            kind: m.referralClaim5000 ? "done" : Number(m.referrals || 0) >= 5000 ? "claim" : "info",
          },
        ],
      },
    ];
  }

  update() {
    this._ensureDailyReset();

    const p = this.input?.pointer || { x: 0, y: 0 };
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);

    if (this.input.justPressed?.()) {
      this.dragging = true;
      this.downX = px;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.tapCandidate = true;
    }

    if (this.dragging) {
      const dy = py - this.downY;
      this.moved = Math.max(this.moved, Math.abs(dy));

      if (this.moved > 6) {
        this.tapCandidate = false;
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      }
    }

    if (this.input.justReleased?.()) {
      const wasTap = this.tapCandidate && this.moved < 10;
      this.dragging = false;

      if (!wasTap) return;

      if (this.hitBack && pointInRect(px, py, this.hitBack)) {
        this.scenes.go("home");
        return;
      }

      for (const h of this.hit) {
        if (!pointInRect(px, py, h.rect)) continue;

        if (h.type === "watchAd") {
          this._watchAd();
          return;
        }

        if (h.type === "invite") {
          this._openInvite();
          return;
        }

        if (h.type === "telegram") {
          this._openTelegramTask();
          return;
        }

        if (h.type === "openPvp") {
          this._openPvp();
          return;
        }

        if (h.type === "claim") {
          this._claim(h.key);
          return;
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
      drawCoverImage(ctx, bg, 0, 0, w, h, 1);
    } else {
      ctx.fillStyle = "#0b0a0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    this.hit = [];
    this.hitBack = null;

    ctx.fillStyle = "rgba(12,8,10,0.34)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.strokeStyle = "rgba(255,173,58,0.6)";
    ctx.lineWidth = 1.2;
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 24);

    const headerH = 108;
    const innerX = panelX + 14;
    const innerW = panelW - 28;

    ctx.fillStyle = "rgba(255,255,255,0.045)";
    fillRoundRect(ctx, innerX, panelY + 12, innerW, headerH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, innerX, panelY + 12, innerW, headerH, 18);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px system-ui";
    ctx.fillText("Görevler", innerX + 16, panelY + 42);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "13px system-ui";
    ctx.fillText("Günlük görevler, sosyal görevler ve davet ödülleri", innerX + 16, panelY + 65);

    const backW = 92;
    const backH = 42;
    const backX = innerX + innerW - backW - 12;
    const backY = panelY + 24;
    this.hitBack = { x: backX, y: backY, w: backW, h: backH };

    ctx.fillStyle = "rgba(30,28,38,0.9)";
    fillRoundRect(ctx, backX, backY, backW, backH, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, backX, backY, backW, backH, 14);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Kapat", backX + backW / 2, backY + backH / 2);

    const state = this.store.get() || {};
    const p = state.player || {};
    const m = state.missions || {};

    const chips = [
      `LVL ${fmtNum(p.level || 1)}`,
      `${fmtNum(p.energy || 0)}/${fmtNum(p.energyMax || 100)} EN`,
      `${fmtNum(m.referrals || 0)} DAVET`,
    ];

    let chipX = innerX + 16;
    const chipY = panelY + 82;
    for (const chip of chips) {
      ctx.font = "600 12px system-ui";
      const tw = ctx.measureText(chip).width;
      const cw = tw + 22;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      fillRoundRect(ctx, chipX, chipY, cw, 24, 12);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      strokeRoundRect(ctx, chipX, chipY, cw, 24, 12);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(chip, chipX + cw / 2, chipY + 12);
      chipX += cw + 8;
    }

    const contentX = panelX + 10;
    const contentY = panelY + headerH + 20;
    const contentW = panelW - 20;
    const contentH = panelH - headerH - 30;

    ctx.save();
    roundRectPath(ctx, contentX, contentY, contentW, contentH, 18);
    ctx.clip();

    const cards = this._cards();
    let y = contentY + 4 - this.scrollY;
    const gap = 14;

    for (const card of cards) {
      const x = contentX + 4;
      const w2 = contentW - 8;
      const hasExtra = Array.isArray(card.extraRows) && card.extraRows.length > 0;
      const cardH = hasExtra ? 220 : 126;

      if (y + cardH >= contentY - 12 && y <= contentY + contentH + 12) {
        ctx.fillStyle = "rgba(13,10,16,0.56)";
        fillRoundRect(ctx, x, y, w2, cardH, 20);
        ctx.strokeStyle = "rgba(255,170,40,0.50)";
        ctx.lineWidth = 1;
        strokeRoundRect(ctx, x, y, w2, cardH, 20);

        const pad = 14;
        const btnW = 104;
        const btnH = 42;
        const btnX = x + w2 - btnW - 14;
        const btnY = y + 18;

        const textRightGap = 14;
        const textMaxW = w2 - btnW - pad * 2 - textRightGap - 18;

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "700 16px system-ui";
        ctx.fillText(card.title, x + pad, y + 28);

        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.font = "13px system-ui";
        const descLines = wrapLines(ctx, card.desc, textMaxW, 2);
        for (let i = 0; i < descLines.length; i++) {
          ctx.fillText(descLines[i], x + pad, y + 50 + i * 16);
        }

        let tagX = x + pad;
        const tagY = y + 76;
        for (const tag of card.tags || []) {
          ctx.font = "600 11px system-ui";
          const tw = ctx.measureText(String(tag)).width;
          const chipW = tw + 18;
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          fillRoundRect(ctx, tagX, tagY, chipW, 22, 11);
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          strokeRoundRect(ctx, tagX, tagY, chipW, 22, 11);
          ctx.fillStyle = "rgba(255,255,255,0.90)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(tag), tagX + chipW / 2, tagY + 11);
          tagX += chipW + 7;
        }

        const barX = x + pad;
        const barY = y + 104;
        const barW = w2 - pad * 2;
        const barH = 8;

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fillStyle = "rgba(255,176,44,0.98)";
        fillRoundRect(ctx, barX, barY, barW * clamp(card.progress || 0, 0, 1), barH, 4);

        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "12px system-ui";
        ctx.fillText(card.reward, x + pad, y + 96);

        let btnBg = "rgba(255,255,255,0.08)";
        let btnStroke = "rgba(255,255,255,0.12)";
        let btnText = "#ffffff";

        if (card.buttonKind === "done") {
          btnBg = "rgba(31,111,42,0.88)";
          btnStroke = "rgba(102,208,120,0.45)";
        } else if (card.buttonKind === "claim") {
          btnBg = "rgba(255,186,59,0.18)";
          btnStroke = "rgba(255,186,59,0.50)";
        } else if (card.buttonKind === "telegram") {
          btnBg = "rgba(88,160,255,0.18)";
          btnStroke = "rgba(88,160,255,0.45)";
        } else if (card.buttonKind === "info") {
          btnBg = "rgba(255,255,255,0.05)";
          btnStroke = "rgba(255,255,255,0.08)";
          btnText = "rgba(255,255,255,0.55)";
        }

        ctx.fillStyle = btnBg;
        fillRoundRect(ctx, btnX, btnY, btnW, btnH, 15);
        ctx.strokeStyle = btnStroke;
        strokeRoundRect(ctx, btnX, btnY, btnW, btnH, 15);
        ctx.fillStyle = btnText;
        ctx.font = "700 14px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(card.buttonLabel, btnX + btnW / 2, btnY + btnH / 2);

        if (card.action) {
          if (card.action === "watchAd") {
            this.hit.push({ type: "watchAd", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action === "invite") {
            this.hit.push({ type: "invite", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action === "telegram") {
            this.hit.push({ type: "telegram", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action === "openPvp") {
            this.hit.push({ type: "openPvp", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action.startsWith("claim:")) {
            this.hit.push({
              type: "claim",
              key: card.action.replace("claim:", ""),
              rect: { x: btnX, y: btnY, w: btnW, h: btnH },
            });
          }
        }

        if (hasExtra) {
          let rowY = y + 122;
          for (const row of card.extraRows) {
            const rx = x + 12;
            const rw = w2 - 24;
            const rh = 21;

            ctx.fillStyle = "rgba(255,255,255,0.04)";
            fillRoundRect(ctx, rx, rowY, rw, rh, 10);
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            strokeRoundRect(ctx, rx, rowY, rw, rh, 10);

            const smallBtnW = 72;
            const smallBtnH = 25;
            const smallBtnX = rx + rw - smallBtnW - 8;
            const smallBtnY = rowY - 2;

            ctx.fillStyle = "rgba(255,255,255,0.78)";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = "12px system-ui";
            ctx.fillText(row.text, rx + 10, rowY + rh / 2);

            let sbg = "rgba(255,255,255,0.05)";
            let sstroke = "rgba(255,255,255,0.08)";
            let stext = "rgba(255,255,255,0.55)";

            if (row.kind === "done") {
              sbg = "rgba(31,111,42,0.88)";
              sstroke = "rgba(102,208,120,0.45)";
              stext = "#ffffff";
            } else if (row.kind === "claim") {
              sbg = "rgba(255,186,59,0.18)";
              sstroke = "rgba(255,186,59,0.50)";
              stext = "#ffffff";
            }

            ctx.fillStyle = sbg;
            fillRoundRect(ctx, smallBtnX, smallBtnY, smallBtnW, smallBtnH, 12);
            ctx.strokeStyle = sstroke;
            strokeRoundRect(ctx, smallBtnX, smallBtnY, smallBtnW, smallBtnH, 12);
            ctx.fillStyle = stext;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "700 12px system-ui";
            ctx.fillText(row.label, smallBtnX + smallBtnW / 2, smallBtnY + smallBtnH / 2);

            if (row.action && row.action.startsWith("claim:")) {
              this.hit.push({
                type: "claim",
                key: row.action.replace("claim:", ""),
                rect: { x: smallBtnX, y: smallBtnY, w: smallBtnW, h: smallBtnH },
              });
            }

            rowY += 30;
          }
        }
      }

      y += cardH + gap;
    }

    const totalContent = y - (contentY + 4);
    this.maxScroll = Math.max(0, totalContent - contentH + 8);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 2) {
      const trackX = contentX + contentW - 6;
      const trackY = contentY + 8;
      const trackH = contentH - 16;
      const thumbH = Math.max(42, trackH * (contentH / Math.max(contentH, totalContent)));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, trackX, trackY, 4, trackH, 2);
      ctx.fillStyle = "rgba(255,176,44,0.86)";
      fillRoundRect(ctx, trackX, thumbY, 4, thumbH, 2);
    }

    ctx.restore();

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 36, 280);
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 10;

      ctx.fillStyle = "rgba(10,10,14,0.92)";
      fillRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 13px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2);
    }
  }
}
