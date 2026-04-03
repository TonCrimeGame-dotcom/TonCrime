import {
  describeRichAdFailure,
  getRichAdsDiagnosticLabel,
  isRecoverableRichAdsSdkFailure,
  playRichRewardedAd,
  warmRichAdsController,
  tryPlayRichRewardedAdImmediately,
} from "../ads/richAds.js?v=20260403-19";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const STARTING_LEVEL = 0;
const STARTING_XP_TO_NEXT = 0;
const DEFAULT_XP_TO_NEXT = 100;
const MAX_PLAYER_ENERGY = 100;

function pointInRect(px, py, rect) {
  return !!rect && px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
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

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, lineWidth = 1) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function fitText(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }

  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }

  ctx.fillText(`${next}...`, x, y);
}

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    lines.push(line);
    line = word;

    if (lines.length >= maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length) {
    let tail = lines[maxLines - 1] || "";
    while (tail.length > 1 && ctx.measureText(`${tail}...`).width > maxWidth) {
      tail = tail.slice(0, -1);
    }
    lines[maxLines - 1] = `${tail}...`;
  }

  return lines;
}

function formatNumber(value, locale) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString(locale) : "0";
}

function normalizeReferralToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function buildReferralLandingUrl(referralCode) {
  try {
    const current = new URL(window.location?.href || "https://toncrime.app");
    current.searchParams.set("ref", referralCode);
    return current.toString();
  } catch (_) {
    return `https://toncrime.app/?ref=${encodeURIComponent(referralCode)}`;
  }
}

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}

  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "readonly");
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return !!copied;
  } catch (_) {
    return false;
  }
}

function getTelegramUrl() {
  return "https://t.me/TonCrimeEu";
}

function openTelegramLink(url = getTelegramUrl()) {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return true;
    }
  } catch (_) {}

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch (_) {}

  return false;
}

const REFERRAL_TIERS = [
  { key: "ref10", threshold: 10, rewardTr: "Dusuk silah bonusu", rewardEn: "Starter weapon bonus" },
  { key: "ref100", threshold: 100, rewardTr: "Orta silah bonusu", rewardEn: "Mid weapon bonus" },
  { key: "ref1000", threshold: 1000, rewardTr: "En guclu silah", rewardEn: "Top weapon reward" },
  { key: "ref5000", threshold: 5000, rewardTr: "Premium", rewardEn: "Premium" },
];

export class MissionsScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.hitBack = null;
    this.hitButtons = [];
    this.scrollArea = null;
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragStartY = 0;
    this.dragStartScrollY = 0;
    this.justDragged = false;

    this.adBusy = false;
    this.toastText = "";
    this.toastUntil = 0;
    this.consumeNextRelease = false;
    this.removeInputClickListener = null;
  }

  onEnter() {
    this._ensureState();
    this._syncDailyAdReward();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.justDragged = false;
    this.hitButtons = [];
    this.hitBack = null;
    this.scrollArea = null;
    if (!this.removeInputClickListener && typeof this.input?.onClick === "function") {
      this.removeInputClickListener = this.input.onClick(({ x, y }) => {
        this._handleImmediateGestureClick(x, y);
      });
    }
    void warmRichAdsController(5200).catch(() => null);
  }

  onExit() {
    this.dragging = false;
    this.justDragged = false;
    if (this.removeInputClickListener) {
      this.removeInputClickListener();
      this.removeInputClickListener = null;
    }
  }

  _lang() {
    return this.i18n?.getLang?.() === "en" ? "en" : "tr";
  }

  _ui(tr, en) {
    return this._lang() === "en" ? en : tr;
  }

  _locale() {
    return this._lang() === "en" ? "en-US" : "tr-TR";
  }

  _showToast(text, ms = 1800) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _playerState() {
    const s = this.store.get() || {};
    return { ...(s.player || {}) };
  }

  _missionsState() {
    const s = this.store.get() || {};
    return { ...(s.missions || {}) };
  }

  _setMissions(patch) {
    const s = this.store.get() || {};
    this.store.set({
      missions: {
        ...(s.missions || {}),
        ...(patch || {}),
      },
    });
  }

  _setPlayer(patch) {
    const s = this.store.get() || {};
    this.store.set({
      player: {
        ...(s.player || {}),
        ...(patch || {}),
      },
    });
  }

  _ensureState() {
    const s = this.store.get() || {};
    const missions = s.missions || {};
    const player = s.player || {};

    this.store.set({
      player: {
        ...player,
        level: Math.max(STARTING_LEVEL, Number(player.level ?? STARTING_LEVEL)),
        xp: Number(player.xp || 0),
        xpToNext:
          Math.max(STARTING_LEVEL, Number(player.level ?? STARTING_LEVEL)) === STARTING_LEVEL &&
          Number(player.xp || 0) <= 0 &&
          Number(player.xpToNext || 0) <= 0
            ? STARTING_XP_TO_NEXT
            : Math.max(1, Number(player.xpToNext || DEFAULT_XP_TO_NEXT)),
        energy: Number(player.energy || 0),
        energyMax: Math.max(1, Math.min(MAX_PLAYER_ENERGY, Number(player.energyMax || MAX_PLAYER_ENERGY))),
      },
      missions: {
        dailyAdWatched: Math.max(0, Number(missions.dailyAdWatched || 0)),
        dailyAdClaimed: !!missions.dailyAdClaimed,
        referrals: Math.max(0, Number(missions.referrals || 0)),
        referralClaim10: !!missions.referralClaim10,
        referralClaim100: !!missions.referralClaim100,
        referralClaim1000: !!missions.referralClaim1000,
        referralClaim5000: !!missions.referralClaim5000,
        pvpPlayed: Math.max(0, Number(missions.pvpPlayed || 0)),
        pvpClaimed: !!missions.pvpClaimed,
        energyRefillUsed: Math.max(0, Number(missions.energyRefillUsed || 0)),
        energyClaimed: !!missions.energyClaimed,
        telegramJoined: !!missions.telegramJoined,
        telegramClaimed: !!missions.telegramClaimed,
        levelClaimedAt: Math.max(0, Number(missions.levelClaimedAt || 0)),
        lastDailyKey: String(missions.lastDailyKey || ""),
      },
    });
  }

  _grantCoins(amount) {
    const s = this.store.get() || {};
    this.store.set({ coins: Number(s.coins || 0) + Number(amount || 0) });
  }

  _grantXP(amount) {
    const s = this.store.get() || {};
    const player = s.player || {};

    let xp = Number(player.xp || 0) + Number(amount || 0);
    let level = Math.max(STARTING_LEVEL, Number(player.level ?? STARTING_LEVEL));
    let xpToNext =
      level === STARTING_LEVEL && Number(player.xp || 0) <= 0 && Number(player.xpToNext || 0) <= 0
        ? DEFAULT_XP_TO_NEXT
        : Math.max(1, Number(player.xpToNext || DEFAULT_XP_TO_NEXT));

    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = DEFAULT_XP_TO_NEXT;
    }

    this._setPlayer({ xp, level, xpToNext });
  }

  _fillEnergyToMax() {
    const player = this._playerState();
    this._setPlayer({
      energy: Math.max(1, Math.min(MAX_PLAYER_ENERGY, Number(player.energyMax || MAX_PLAYER_ENERGY))),
      lastEnergyAt: Date.now(),
    });
  }

  _grantEnergy(amount) {
    const player = this._playerState();
    const maxEnergy = Math.max(1, Math.min(MAX_PLAYER_ENERGY, Number(player.energyMax || MAX_PLAYER_ENERGY)));
    const nextEnergy = clamp(Number(player.energy || 0) + Number(amount || 0), 0, maxEnergy);
    this._setPlayer({ energy: nextEnergy, lastEnergyAt: Date.now() });
  }

  _syncDailyAdReward() {
    const missions = this._missionsState();
    if (missions.dailyAdClaimed || Number(missions.dailyAdWatched || 0) < 20) return;
    this._claim("dailyAd", { silent: true });
  }

  _handleAdPlaybackResult(played) {
    const diag = getRichAdsDiagnosticLabel(played);
    if (isRecoverableRichAdsSdkFailure(played)) {
      const detail = describeRichAdFailure(played, "unknown");
      this._showToast(
        this._ui(
          `[${diag}] RichAds gecici hata verdi, reklam sayilmadi: ${detail}`,
          `[${diag}] RichAds had a temporary error, the ad was not counted: ${detail}`
        ),
        3200
      );
      return;
    }

    if (!played?.ok) {
      const detail = describeRichAdFailure(played, "unknown");
      if (played?.reason === "controller_missing" || played?.reason === "method_missing") {
        this._showToast(
          this._ui(`[${diag}] RichAds hazir degil: ${detail}`, `[${diag}] RichAds is not ready: ${detail}`),
          2600
        );
        return;
      }
      if (played?.reason === "not_completed") {
        this._showToast(this._ui(`[${diag}] Reklam tamamlanmadi: ${detail}`, `[${diag}] Ad was not completed: ${detail}`), 2400);
        return;
      }
      console.warn("[TonCrime] RichAds video error:", detail, played?.error || played?.result || played);
      this._showToast(
        this._ui(`[${diag}] Reklam acilamadi: ${detail}`, `[${diag}] Ad failed: ${detail}`),
        2800
      );
      return;
    }

    const current = this._missionsState();
    const nextCount = clamp(Number(current.dailyAdWatched || 0) + 1, 0, 20);
    this._setMissions({ dailyAdWatched: nextCount });

    if (nextCount >= 20) {
      this._claim("dailyAd");
    } else {
      this._showToast(
        this._ui(`Reklam sayildi (${nextCount}/20).`, `Ad counted (${nextCount}/20).`)
      );
    }
  }

  _runAdPlayback(playPromise) {
    if (!playPromise) return;

    this.adBusy = true;
    this._showToast(this._ui("Reklam yukleniyor...", "Loading ad..."), 1400);

    Promise.resolve(playPromise)
      .then((played) => {
        this._handleAdPlaybackResult(played);
      })
      .catch((error) => {
        console.warn("[TonCrime] MissionsScene rewarded ad fatal:", error);
        this._showToast(
          this._ui(
            `Reklam acilamadi: ${String(error?.message || error || "unknown")}`,
            `Ad failed: ${String(error?.message || error || "unknown")}`
          ),
          2800
        );
      })
      .finally(() => {
        this.adBusy = false;
      });
  }

  _handleImmediateGestureClick(px, py) {
    const adButton = this.hitButtons.find(
      (button) => button?.action === "watchAd" && pointInRect(px, py, button.rect)
    );
    if (!adButton) return;

    const immediatePlay = tryPlayRichRewardedAdImmediately();
    this.consumeNextRelease = true;
    if (immediatePlay) {
      this._runAdPlayback(immediatePlay);
      return;
    }

    this.adBusy = true;
    this._showToast(
      this._ui(
        "RichAds hazirlaniyor, reklam icin tekrar dokun.",
        "RichAds is getting ready. Tap again to open the ad."
      ),
      2200
    );
    Promise.resolve(warmRichAdsController(5200, { forceFresh: true }))
      .catch(() => null)
      .finally(() => {
        this.adBusy = false;
      });
  }

  _buildReferralShareMeta() {
    const player = this._playerState();
    const username = String(player.username || "").trim() || "player";
    const referralCode = normalizeReferralToken(player.telegramId || player.id || username || "toncrime");
    const inviteUrl = buildReferralLandingUrl(referralCode || "toncrime");
    return {
      referralCode: referralCode || "toncrime",
      inviteUrl,
      shareText: this._ui(
        `${username} seni TonCrime'a davet ediyor. Gel ve birlikte kara pazari fethedelim.`,
        `${username} invited you to TonCrime. Join up and take over the black market together.`
      ),
    };
  }

  _claim(type, opts = {}) {
    const silent = !!opts.silent;
    const missions = this._missionsState();
    const player = this._playerState();

    if (type === "dailyAd" && missions.dailyAdWatched >= 20 && !missions.dailyAdClaimed) {
      this._setMissions({ dailyAdClaimed: true });
      this._fillEnergyToMax();
      if (!silent) {
        this._showToast(
          this._ui("20/20 tamamlandi. Enerji tamamen doldu.", "20/20 complete. Energy is now full."),
          2300
        );
      }
      return true;
    }

    if (type === "ref10" && missions.referrals >= 10 && !missions.referralClaim10) {
      this._setMissions({ referralClaim10: true });
      this._setPlayer({ weaponName: "Baslangic Bicagi", weaponBonus: "+3%" });
      if (!silent) this._showToast(this._ui("10 davet odulu alindi.", "10 referral reward claimed."));
      return true;
    }

    if (type === "ref100" && missions.referrals >= 100 && !missions.referralClaim100) {
      this._setMissions({ referralClaim100: true });
      this._setPlayer({ weaponName: "Orta Seviye Silah", weaponBonus: "+8%" });
      if (!silent) this._showToast(this._ui("100 davet odulu alindi.", "100 referral reward claimed."));
      return true;
    }

    if (type === "ref1000" && missions.referrals >= 1000 && !missions.referralClaim1000) {
      this._setMissions({ referralClaim1000: true });
      this._setPlayer({ weaponName: "En Guclu Silah", weaponBonus: "+18%" });
      if (!silent) this._showToast(this._ui("1000 davet odulu alindi.", "1000 referral reward claimed."));
      return true;
    }

    if (type === "ref5000" && missions.referrals >= 5000 && !missions.referralClaim5000) {
      const s = this.store.get() || {};
      this.store.set({
        premium: true,
        missions: {
          ...(s.missions || {}),
          referralClaim5000: true,
        },
      });
      if (!silent) this._showToast(this._ui("Premium odulu acildi.", "Premium reward unlocked."));
      return true;
    }

    if (type === "pvp" && missions.pvpPlayed >= 3 && !missions.pvpClaimed) {
      this._setMissions({ pvpClaimed: true });
      this._grantCoins(15);
      this._grantXP(20);
      if (!silent) this._showToast(this._ui("PvP odulu alindi.", "PvP reward claimed."));
      return true;
    }

    if (type === "energy" && missions.energyRefillUsed >= 1 && !missions.energyClaimed) {
      this._setMissions({ energyClaimed: true });
      this._grantCoins(10);
      this._grantEnergy(10);
      if (!silent) this._showToast(this._ui("Enerji odulu alindi.", "Energy reward claimed."));
      return true;
    }

    if (type === "telegram" && missions.telegramJoined && !missions.telegramClaimed) {
      this._setMissions({ telegramClaimed: true });
      this._grantCoins(20);
      if (!silent) this._showToast(this._ui("Telegram odulu alindi.", "Telegram reward claimed."));
      return true;
    }

    if (type === "level" && Number(player.level ?? STARTING_LEVEL) >= 55 && Number(missions.levelClaimedAt || 0) !== 55) {
      this._setMissions({ levelClaimedAt: 55 });
      this._grantCoins(50);
      this._grantXP(25);
      if (!silent) this._showToast(this._ui("Level odulu alindi.", "Level reward claimed."));
      return true;
    }

    return false;
  }

  async _watchAd() {
    if (this.adBusy) return;

    const missions = this._missionsState();
    if (missions.dailyAdClaimed) {
      this._showToast(
        this._ui("Bugunku reklam gorevi tamamlandi.", "Today's ad mission is already complete.")
      );
      return;
    }

    if (missions.dailyAdWatched >= 20) {
      this._claim("dailyAd");
      return;
    }

    this._runAdPlayback(playRichRewardedAd());
  }

  _shareReferral() {
    const meta = this._buildReferralShareMeta();
    const shareUrl =
      `https://t.me/share/url?url=${encodeURIComponent(meta.inviteUrl)}` +
      `&text=${encodeURIComponent(meta.shareText)}`;
    const opened = openTelegramLink(shareUrl);
    if (!opened) {
      this._showToast(this._ui("Paylasim penceresi acilamadi.", "Share sheet could not be opened."), 2200);
      return;
    }

    const missions = this._missionsState();
    const nextCount = Number(missions.referrals || 0) + 1;
    this._setMissions({ referrals: nextCount });
    this._showToast(
      this._ui(`Davet linki paylasildi (${nextCount}).`, `Invite link shared (${nextCount}).`),
      2200
    );
  }

  async _copyReferralLink() {
    const meta = this._buildReferralShareMeta();
    const copied = await copyTextToClipboard(meta.inviteUrl);
    if (copied) {
      this._showToast(this._ui("Davet linki kopyalandi.", "Invite link copied."), 2200);
      return;
    }
    this._showToast(this._ui("Link kopyalanamadi.", "Invite link could not be copied."), 2200);
  }

  _simulatePvp() {
    const missions = this._missionsState();
    this._setMissions({ pvpPlayed: Math.min(3, Number(missions.pvpPlayed || 0) + 1) });
    this._showToast(this._ui("PvP ilerlemesi +1.", "PvP progress +1."));
  }

  _simulateEnergyRefill() {
    this._setMissions({ energyRefillUsed: 1 });
    this._showToast(this._ui("Enerji dolumu sayildi.", "Energy refill counted."));
  }

  _joinTelegram() {
    openTelegramLink(getTelegramUrl());
    this._setMissions({ telegramJoined: true });
    this._showToast(this._ui("Telegram gorevi acildi.", "Telegram mission unlocked."));
  }

  _handleAction(action) {
    if (!action) return;

    if (action === "back") {
      this.scenes?.go?.("home");
      return;
    }

    if (action === "watchAd") {
      this._watchAd();
      return;
    }

    if (action === "shareReferral") {
      this._shareReferral();
      return;
    }

    if (action === "copyReferral") {
      this._copyReferralLink();
      return;
    }

    if (action === "simulatePvp") {
      this._simulatePvp();
      return;
    }

    if (action === "simulateEnergy") {
      this._simulateEnergyRefill();
      return;
    }

    if (action === "joinTelegram") {
      this._joinTelegram();
      return;
    }

    if (action.startsWith("claim:")) {
      const claimed = this._claim(action.slice(6));
      if (!claimed) {
        this._showToast(this._ui("Kosullar henuz saglanmadi.", "Requirements are not met yet."));
      }
    }
  }

  update() {
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    if (this.input.justPressed()) {
      this.justDragged = false;
      if (this.scrollArea && pointInRect(px, py, this.scrollArea)) {
        this.dragging = true;
        this.dragStartY = py;
        this.dragStartScrollY = this.scrollY;
      } else {
        this.dragging = false;
      }
    }

    if (this.dragging && this.input.isDown()) {
      const delta = py - this.dragStartY;
      if (Math.abs(delta) > 8) this.justDragged = true;
      this.scrollY = clamp(this.dragStartScrollY - delta, 0, this.maxScroll);
    }

    if (!this.input.justReleased()) return;

    const dragged = this.justDragged;
    this.dragging = false;
    this.justDragged = false;

    if (this.consumeNextRelease) {
      this.consumeNextRelease = false;
      return;
    }

    if (dragged) return;

    if (this.hitBack && pointInRect(px, py, this.hitBack)) {
      this._handleAction("back");
      return;
    }

    for (const item of this.hitButtons) {
      if (pointInRect(px, py, item.rect)) {
        this._handleAction(item.action);
        return;
      }
    }
  }

  _drawButton(ctx, rect, label, options = {}) {
    const disabled = !!options.disabled;
    const soft = !!options.soft;
    const accent = options.accent || "#f2c16d";

    fillRoundRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      14,
      disabled
        ? "rgba(255,255,255,0.07)"
        : soft
          ? "rgba(255,255,255,0.10)"
          : "rgba(242,193,109,0.22)"
    );
    strokeRoundRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      14,
      disabled
        ? "rgba(255,255,255,0.08)"
        : soft
          ? "rgba(255,255,255,0.14)"
          : "rgba(242,193,109,0.40)",
      1
    );

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = disabled ? "rgba(255,255,255,0.45)" : soft ? "#ffffff" : accent;
    ctx.font = "700 13px system-ui";
    fitText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, rect.w - 18);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawProgressBar(ctx, x, y, w, h, progress, fillColor) {
    fillRoundRect(ctx, x, y, w, h, h / 2, "rgba(255,255,255,0.08)");
    const inner = clamp(progress, 0, 1);
    if (inner <= 0) return;

    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, "#fff1cc");
    fillRoundRect(ctx, x, y, Math.max(h, w * inner), h, h / 2, gradient);
  }

  _drawHero(ctx, x, y, w, player, missions) {
    const energy = Math.max(0, Number(player.energy || 0));
    const energyMax = Math.max(1, Number(player.energyMax || 100));
    const progress = clamp(Number(missions.dailyAdWatched || 0) / 20, 0, 1);
    const heroH = 146;
    const locale = this._locale();

    fillRoundRect(ctx, x, y, w, heroH, 22, "rgba(18,9,6,0.54)");
    strokeRoundRect(ctx, x, y, w, heroH, 22, "rgba(242,193,109,0.28)", 1.1);

    const leftW = Math.max(180, Math.floor(w * 0.58));
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 22px system-ui";
    fitText(ctx, this._ui("Gorev Merkezi", "Mission Center"), x + 20, y + 30, leftW - 8);

    ctx.fillStyle = "rgba(255,224,180,0.86)";
    ctx.font = "500 13px system-ui";
    fitText(
      ctx,
      this._ui(
        "20 reklam tamamlandiginda enerji tamamen dolar.",
        "Finish 20 ads to instantly refill your energy."
      ),
      x + 20,
      y + 52,
      leftW
    );

    const progressY = y + 76;
    this._drawProgressBar(ctx, x + 20, progressY, leftW, 12, progress, "#f2c16d");

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 13px system-ui";
    fitText(
      ctx,
      this._ui(
        `Gunluk reklam: ${Number(missions.dailyAdWatched || 0)}/20`,
        `Daily ads: ${Number(missions.dailyAdWatched || 0)}/20`
      ),
      x + 20,
      progressY + 30,
      leftW
    );

    const chipW = 132;
    const chipH = 44;
    const chipGap = 10;
    const chipX = x + w - chipW - 18;
    const energyChipY = y + 20;
    const rewardChipY = energyChipY + chipH + chipGap;

    fillRoundRect(ctx, chipX, energyChipY, chipW, chipH, 16, "rgba(255,255,255,0.08)");
    strokeRoundRect(ctx, chipX, energyChipY, chipW, chipH, 16, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "rgba(255,220,170,0.76)";
    ctx.font = "600 11px system-ui";
    ctx.fillText(this._ui("Enerji", "Energy"), chipX + 14, energyChipY + 18);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 16px system-ui";
    ctx.fillText(`${formatNumber(energy, locale)}/${energyMax}`, chipX + 14, energyChipY + 35);

    fillRoundRect(ctx, chipX, rewardChipY, chipW, chipH, 16, "rgba(255,255,255,0.08)");
    strokeRoundRect(ctx, chipX, rewardChipY, chipW, chipH, 16, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "rgba(255,220,170,0.76)";
    ctx.font = "600 11px system-ui";
    ctx.fillText(this._ui("Bugunku odul", "Today reward"), chipX + 14, rewardChipY + 18);
    ctx.fillStyle = missions.dailyAdClaimed ? "#7ef0b3" : "#ffffff";
    ctx.font = "800 14px system-ui";
    ctx.fillText(
      missions.dailyAdClaimed ? this._ui("Tamamlandi", "Completed") : this._ui("Full enerji", "Full energy"),
      chipX + 14,
      rewardChipY + 35
    );

    return heroH;
  }

  _drawCard(ctx, x, y, w, card, isMobile) {
    const pad = 18;
    const innerW = w - pad * 2;
    const buttonH = 40;
    const buttonCount = card.buttons?.length || 0;
    const buttonGap = 10;
    const columns = isMobile ? 1 : buttonCount > 2 ? 2 : Math.min(2, buttonCount || 1);
    const buttonRows = buttonCount ? Math.ceil(buttonCount / columns) : 0;
    const progressVisible = typeof card.progress === "number";
    const progressBlockH = progressVisible ? 42 : 0;
    const buttonBlockH = buttonCount ? buttonRows * buttonH + Math.max(0, buttonRows - 1) * buttonGap : 0;
    const bodyBlockH = card.description ? 34 : 0;
    const rewardBlockH = card.reward ? 30 : 0;
    const statusBlockH = card.status ? 26 : 0;
    const cardH = 63 + bodyBlockH + rewardBlockH + progressBlockH + statusBlockH + buttonBlockH + 18;

    fillRoundRect(ctx, x, y, w, cardH, 20, "rgba(7,7,10,0.48)");
    strokeRoundRect(ctx, x, y, w, cardH, 20, card.stroke || "rgba(255,255,255,0.12)", 1);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 19px system-ui";
    fitText(ctx, card.title, x + pad, y + 28, innerW - 100);

    if (card.badge) {
      const badgeText = String(card.badge);
      const badgeW = Math.min(148, Math.max(70, ctx.measureText(badgeText).width + 24));
      const badgeX = x + w - badgeW - pad;
      const badgeY = y + 12;
      fillRoundRect(ctx, badgeX, badgeY, badgeW, 28, 14, "rgba(242,193,109,0.14)");
      strokeRoundRect(ctx, badgeX, badgeY, badgeW, 28, 14, "rgba(242,193,109,0.30)", 1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f8d08e";
      ctx.font = "700 12px system-ui";
      fitText(ctx, badgeText, badgeX + badgeW / 2, badgeY + 15, badgeW - 18);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    let cy = y + 54;

    if (card.description) {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "13px system-ui";
      const lines = wrapText(ctx, card.description, innerW, 2);
      lines.forEach((line, index) => ctx.fillText(line, x + pad, cy + index * 16));
      cy += bodyBlockH;
    }

    if (card.reward) {
      ctx.fillStyle = "rgba(255,216,164,0.82)";
      ctx.font = "12px system-ui";
      const lines = wrapText(ctx, card.reward, innerW, 2);
      lines.forEach((line, index) => ctx.fillText(line, x + pad, cy + index * 15));
      cy += rewardBlockH;
    }

    if (progressVisible) {
      this._drawProgressBar(ctx, x + pad, cy, innerW, 12, card.progress, card.progressColor || "#f2c16d");
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 12px system-ui";
      fitText(ctx, card.progressLabel || "", x + pad, cy + 29, innerW);
      cy += progressBlockH;
    }

    if (card.status) {
      ctx.fillStyle = card.statusColor || "rgba(255,255,255,0.68)";
      ctx.font = "600 12px system-ui";
      const lines = wrapText(ctx, card.status, innerW, 2);
      lines.forEach((line, index) => ctx.fillText(line, x + pad, cy + index * 15));
      cy += statusBlockH;
    }

    const buttons = Array.isArray(card.buttons) ? card.buttons.filter(Boolean) : [];
    const buttonW = columns <= 0 ? innerW : Math.floor((innerW - (columns - 1) * buttonGap) / columns);

    buttons.forEach((button, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rect = {
        x: x + pad + col * (buttonW + buttonGap),
        y: cy + row * (buttonH + buttonGap),
        w: buttonW,
        h: buttonH,
      };

      this._drawButton(ctx, rect, button.label, {
        disabled: button.disabled,
        soft: button.soft,
        accent: button.accent,
      });

      if (!button.disabled && button.action) {
        this.hitButtons.push({ rect, action: button.action });
      }
    });

    return cardH;
  }

  _buildCards(player, missions) {
    const referralLeft = REFERRAL_TIERS.filter((tier) => !missions[`referralClaim${tier.threshold}`]).length;
    const dailyDone = !!missions.dailyAdClaimed;
    const dailyCount = clamp(Number(missions.dailyAdWatched || 0), 0, 20);

    return [
      {
        title: this._ui("Gunluk Reklam Izle", "Daily Ad Mission"),
        badge: `${dailyCount}/20`,
        description: this._ui(
          "Her basarili RichAds videosu sayilir. 20 reklam tamamlaninca enerji tamamen dolar.",
          "Every completed RichAds video counts. Finish 20 ads to fully refill energy."
        ),
        reward: this._ui("Odul: Full enerji", "Reward: Full energy"),
        progress: dailyCount / 20,
        progressLabel: this._ui(`${dailyCount} / 20 tamamlandi`, `${dailyCount} / 20 completed`),
        progressColor: "#f2c16d",
        status: dailyDone
          ? this._ui("Bugunku reklam gorevi tamamlandi.", "Today's ad mission is complete.")
          : this.adBusy
            ? this._ui("Video aciliyor...", "Opening video...")
            : this._ui("Izlenen reklamlar yalnizca basariyla tamamlaninca sayilir.", "Ads count only after successful completion."),
        statusColor: dailyDone ? "#7ef0b3" : "rgba(255,255,255,0.68)",
        buttons: [
          {
            label: dailyDone
              ? this._ui("Tamamlandi", "Completed")
              : this.adBusy
                ? this._ui("Yukleniyor...", "Loading...")
                : this._ui("Reklam Izle", "Watch Ad"),
            action: "watchAd",
            disabled: dailyDone || this.adBusy,
          },
        ],
        stroke: "rgba(242,193,109,0.24)",
      },
      {
        title: this._ui("Arkadas Davet", "Invite Friends"),
        badge: String(Number(missions.referrals || 0)),
        description: this._ui(
          "10 / 100 / 1000 / 5000 esikleri ayrik oduller acar.",
          "Thresholds at 10 / 100 / 1000 / 5000 unlock separate rewards."
        ),
        reward: this._ui(
          "Oduller: baslangic silahi, orta silah, en guclu silah ve premium.",
          "Rewards: starter weapon, mid weapon, top weapon and premium."
        ),
        status: this._ui(
          `${referralLeft} odul seviyesi ve paylasim linkin hazir.`,
          `${referralLeft} reward tier(s) are ready and your invite link is live.`
        ),
        buttons: [
          {
            label: this._ui("Davet Et", "Invite"),
            action: "shareReferral",
          },
          {
            label: this._ui("Linki Kopyala", "Copy Link"),
            action: "copyReferral",
            soft: true,
          },
        ],
      },
      {
        title: this._ui("PvP Oyna", "Play PvP"),
        badge: `${Math.min(3, Number(missions.pvpPlayed || 0))}/3`,
        description: this._ui(
          "3 PvP testi sonrasinda odul alinabilir.",
          "The reward unlocks after 3 PvP attempts."
        ),
        reward: missions.pvpClaimed
          ? this._ui("Odul alindi", "Reward claimed")
          : this._ui("Odul: +15 coin ve +20 XP", "Reward: +15 coins and +20 XP"),
        progress: Math.min(3, Number(missions.pvpPlayed || 0)) / 3,
        progressLabel: this._ui(
          `${Math.min(3, Number(missions.pvpPlayed || 0))} / 3 mac`,
          `${Math.min(3, Number(missions.pvpPlayed || 0))} / 3 matches`
        ),
        buttons: [
          {
            label: this._ui("Mac +1", "Match +1"),
            action: "simulatePvp",
          },
          {
            label: missions.pvpClaimed ? this._ui("Alindi", "Claimed") : this._ui("Odulu Al", "Claim"),
            action: "claim:pvp",
            disabled: missions.pvpClaimed || Number(missions.pvpPlayed || 0) < 3,
            soft: true,
          },
        ],
      },
      {
        title: this._ui("Enerji Doldur", "Refill Energy"),
        badge: `${Math.min(1, Number(missions.energyRefillUsed || 0))}/1`,
        description: this._ui(
          "Bir kez enerji dolumu yap ve gorevi tamamla.",
          "Use one energy refill to complete this mission."
        ),
        reward: missions.energyClaimed
          ? this._ui("Odul alindi", "Reward claimed")
          : this._ui("Odul: +10 coin ve +10 enerji", "Reward: +10 coins and +10 energy"),
        progress: Math.min(1, Number(missions.energyRefillUsed || 0)),
        progressLabel: this._ui(
          `${Math.min(1, Number(missions.energyRefillUsed || 0))} / 1 dolum`,
          `${Math.min(1, Number(missions.energyRefillUsed || 0))} / 1 refill`
        ),
        buttons: [
          {
            label: this._ui("Dolum Yap", "Refill"),
            action: "simulateEnergy",
          },
          {
            label: missions.energyClaimed ? this._ui("Alindi", "Claimed") : this._ui("Odulu Al", "Claim"),
            action: "claim:energy",
            disabled: missions.energyClaimed || Number(missions.energyRefillUsed || 0) < 1,
            soft: true,
          },
        ],
      },
      {
        title: this._ui("Level Gorevi", "Level Mission"),
        badge: `${Math.max(STARTING_LEVEL, Number(player.level ?? STARTING_LEVEL))}/55`,
        description: this._ui(
          "55 level ve uzeri odulu acar.",
          "Reach level 55 or above to unlock the reward."
        ),
        reward: Number(missions.levelClaimedAt || 0) === 55
          ? this._ui("Odul alindi", "Reward claimed")
          : this._ui("Odul: +50 coin ve +25 XP", "Reward: +50 coins and +25 XP"),
        progress: clamp(Number(player.level ?? STARTING_LEVEL) / 55, 0, 1),
        progressLabel: this._ui(
          `Seviye ${Math.max(STARTING_LEVEL, Number(player.level ?? STARTING_LEVEL))} / 55`,
          `Level ${Math.max(STARTING_LEVEL, Number(player.level ?? STARTING_LEVEL))} / 55`
        ),
        buttons: [
          {
            label: Number(missions.levelClaimedAt || 0) === 55 ? this._ui("Alindi", "Claimed") : this._ui("Odulu Al", "Claim"),
            action: "claim:level",
            disabled: Number(missions.levelClaimedAt || 0) === 55 || Number(player.level ?? STARTING_LEVEL) < 55,
          },
        ],
      },
      {
        title: this._ui("Telegram Grubuna Katil", "Join Telegram Group"),
        badge: missions.telegramJoined ? this._ui("Acik", "Open") : this._ui("Kapali", "Locked"),
        description: this._ui(
          "Telegram grubunu ac, sonra odulu al.",
          "Open the Telegram group, then claim the reward."
        ),
        reward: missions.telegramClaimed
          ? this._ui("Odul alindi", "Reward claimed")
          : this._ui("Odul: +20 coin", "Reward: +20 coins"),
        status: missions.telegramJoined
          ? this._ui("Grup baglantisi acildi.", "Group link opened.")
          : this._ui("TonCrime Telegram baglantisi kullanilir.", "Uses the TonCrime Telegram link."),
        buttons: [
          {
            label: this._ui("Telegram Ac", "Open Telegram"),
            action: "joinTelegram",
          },
          {
            label: missions.telegramClaimed ? this._ui("Alindi", "Claimed") : this._ui("Odulu Al", "Claim"),
            action: "claim:telegram",
            disabled: missions.telegramClaimed || !missions.telegramJoined,
            soft: true,
          },
        ],
      },
      {
        title: this._ui("Davet Odulleri", "Referral Rewards"),
        badge: `${Math.min(Number(missions.referrals || 0), 5000)}/5000`,
        description: this._ui(
          "Esiklere ulastiginda ilgili odul butonu acilir.",
          "Each reward button unlocks when its threshold is reached."
        ),
        reward: this._ui(
          "10, 100, 1000 ve 5000 esikleri ayri ayri alinabilir.",
          "Threshold rewards at 10, 100, 1000 and 5000 can each be claimed once."
        ),
        buttons: REFERRAL_TIERS.map((tier) => ({
          label: missions[`referralClaim${tier.threshold}`]
            ? this._ui(`${tier.threshold} Alindi`, `${tier.threshold} Claimed`)
            : `${tier.threshold} - ${this._ui(tier.rewardTr, tier.rewardEn)}`,
          action: `claim:${tier.key}`,
          disabled: missions[`referralClaim${tier.threshold}`] || Number(missions.referrals || 0) < tier.threshold,
          soft: missions[`referralClaim${tier.threshold}`] || Number(missions.referrals || 0) < tier.threshold,
        })),
      },
    ];
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const player = state.player || {};
    const missions = state.missions || {};
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };
    const topReserved = Number(state?.ui?.hudReservedTop || 118);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);
    const isMobile = safe.w < 720;

    const bg = getImgSafe(this.assets, "missions") || getImgSafe(this.assets, "background");
    const paintedBg = bg ? drawCoverImage(ctx, bg, 0, 0, w, h) : false;
    if (!paintedBg) {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(9,6,5,0.48)");
    shade.addColorStop(0.42, "rgba(8,6,8,0.70)");
    shade.addColorStop(1, "rgba(6,6,10,0.88)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 12;
    const panelY = safe.y + topReserved + 8;
    const panelW = Math.max(280, safe.w - 24);
    const panelH = Math.max(260, safe.h - topReserved - bottomReserved - 18);

    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 26, "rgba(11,9,12,0.34)");
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 26, "rgba(242,193,109,0.24)", 1.2);

    const headerX = panelX + 16;
    const headerY = panelY + 14;
    const backRect = { x: panelX + panelW - 92 - 16, y: headerY + 4, w: 92, h: 36 };
    this.hitBack = backRect;

    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 14, "rgba(255,255,255,0.10)");
    strokeRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 14, "rgba(255,255,255,0.16)", 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 14px system-ui";
    ctx.fillText(this._ui("Geri", "Back"), backRect.x + backRect.w / 2, backRect.y + backRect.h / 2 + 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${isMobile ? 24 : 28}px system-ui`;
    fitText(ctx, this._ui("Gorevler", "Missions"), headerX, headerY + 70, panelW - 40);

    ctx.fillStyle = "rgba(255,224,180,0.76)";
    ctx.font = "500 13px system-ui";
    fitText(
      ctx,
      this._ui("RichAds baglantili gorev akisi", "RichAds-connected mission flow"),
      headerX,
      headerY + 92,
      panelW - 40
    );

    const contentX = panelX + 16;
    const contentY = panelY + 110;
    const contentW = panelW - 32;
    const contentH = panelH - 126;
    this.scrollArea = { x: contentX, y: contentY, w: contentW, h: contentH };
    this.hitButtons = [];

    ctx.save();
    roundRectPath(ctx, contentX, contentY, contentW, contentH, 18);
    ctx.clip();

    let cursorY = contentY - this.scrollY;
    cursorY += this._drawHero(ctx, contentX, cursorY, contentW, player, missions) + 14;

    const cards = this._buildCards(player, missions);
    cards.forEach((card) => {
      cursorY += this._drawCard(ctx, contentX, cursorY, contentW, card, isMobile) + 14;
    });

    ctx.restore();

    const contentHeight = Math.max(contentH, cursorY - (contentY - this.scrollY));
    this.maxScroll = Math.max(0, contentHeight - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 0) {
      const barX = panelX + panelW - 8;
      const barY = contentY + 4;
      const barH = contentH - 8;
      const thumbH = Math.max(52, Math.round((contentH / contentHeight) * barH));
      const thumbY = barY + Math.round((this.scrollY / this.maxScroll) * Math.max(0, barH - thumbH));

      fillRoundRect(ctx, barX, barY, 4, barH, 2, "rgba(255,255,255,0.08)");
      fillRoundRect(ctx, barX, thumbY, 4, thumbH, 2, "rgba(242,193,109,0.72)");
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const toastW = Math.min(panelW - 36, Math.max(220, ctx.measureText(this.toastText).width + 40));
      const toastH = 42;
      const toastX = panelX + (panelW - toastW) / 2;
      const toastY = panelY + panelH - toastH - 16;
      fillRoundRect(ctx, toastX, toastY, toastW, toastH, 16, "rgba(10,10,12,0.86)");
      strokeRoundRect(ctx, toastX, toastY, toastW, toastH, 16, "rgba(255,255,255,0.12)", 1);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 13px system-ui";
      fitText(ctx, this.toastText, toastX + toastW / 2, toastY + toastH / 2 + 1, toastW - 20);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }
}
