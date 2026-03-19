import { ClanSystem } from "../clan/ClanSystem.js";

const SYMBOL_ORDER = ["punch", "kick", "slap", "head"];

const SYMBOL_META = {
  punch: { emoji: "👊", label: "YUMRUK", color: "#f59e0b", base: 12 },
  kick: { emoji: "🦵", label: "TEKME", color: "#22c55e", base: 14 },
  slap: { emoji: "🖐️", label: "TOKAT", color: "#60a5fa", base: 8 },
  head: { emoji: "🧠", label: "KAFA", color: "#ef4444", base: 16 },
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function shortNum(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return `${Math.floor(v)}`;
}

function fmtCash(n) {
  return `$${Number(n || 0).toLocaleString("tr-TR")}`;
}

function fmtTimeLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function rr(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, color, lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function safeClanName(clan) {
  if (!clan) return "CLAN";
  if (typeof clan.name === "string" && clan.name.trim()) return clan.name.trim();
  return "CLAN";
}

function getPointer(input) {
  return (
    input?.pointer ||
    input?.p ||
    input?.mouse ||
    input?.state?.pointer ||
    { x: 0, y: 0 }
  );
}

function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") {
    return (
      !!input.isJustPressed("pointer") ||
      !!input.isJustPressed("mouseLeft") ||
      !!input.isJustPressed("touch")
    );
  }
  return !!input?._justPressed || !!input?.mousePressed;
}

function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  if (typeof input?.isJustReleased === "function") {
    return (
      !!input.isJustReleased("pointer") ||
      !!input.isJustReleased("mouseLeft") ||
      !!input.isJustReleased("touch")
    );
  }
  return !!input?._justReleased || !!input?.mouseReleased;
}

function isDown(input) {
  if (typeof input?.isDown === "function") return !!input.isDown();
  return !!input?.pointer?.down || !!input?.mouseDown;
}

function wheelDelta(input) {
  return Number(
    input?.wheelDelta ||
      input?.mouseWheelDelta ||
      input?.state?.wheelDelta ||
      0
  );
}

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

function drawCoverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img) return;
  const iw = Math.max(1, Number(img.width || 1));
  const ih = Math.max(1, Number(img.height || 1));
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export class ClanScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.tab = "genel";
    this.buttons = [];
    this.clickCandidate = false;

    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.dragMoved = 0;
    this.downX = 0;
    this.downY = 0;
    this.startScrollY = 0;

    this.toastText = "";
    this.toastUntil = 0;

    this.flashUntil = 0;
    this.shakeUntil = 0;

    this.reels = this.createReels();
    this.spinState = null;
    this.lastRaidId = null;

    this._bgImg = null;
    this._bgRequested = false;

    this.tabScrollX = 0;
    this.maxTabScrollX = 0;
    this.tabBarRect = null;
    this.tabDragging = false;
    this.tabDownX = 0;
    this.startTabScrollX = 0;
  }

  createReels() {
    return [0, 1, 2].map((lane) => ({
      lane,
      position: lane * 1.17,
      speed: 0,
      targetIndex: 0,
      stopping: false,
      settled: true,
      stopTime: 0,
      finalPosition: null,
    }));
  }

  onEnter() {
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragMoved = 0;
    this.tabScrollX = 0;
    this.maxTabScrollX = 0;
    this.tabBarRect = null;
    this.tabDragging = false;
    this.ensureBackground();
    this.syncBossState(true);
  }

  onExit() {
    this.dragging = false;
  }

  ensureBackground() {
    if (this._bgImg) return this._bgImg;

    const fromAssets =
      getImgSafe(this.assets, "clan") ||
      getImgSafe(this.assets, "clanhub") ||
      getImgSafe(this.assets, "clan_bg") ||
      getImgSafe(this.assets, "Clan-bg") ||
      getImgSafe(this.assets, "background");

    if (fromAssets) {
      this._bgImg = fromAssets;
      return this._bgImg;
    }

    if (!this._bgRequested) {
      this._bgRequested = true;
      try {
        const img = new Image();
        img.src = "./src/assets/Clan-bg.png";
        this._bgImg = img;
      } catch (_) {}
    }

    return this._bgImg;
  }

  getClan() {
    try {
      return ClanSystem.getClan(this.store);
    } catch {
      return null;
    }
  }

  getBoss() {
    try {
      return ClanSystem.getBossState(this.store);
    } catch {
      return null;
    }
  }

  getSpinInfo() {
    try {
      return ClanSystem.getBossSpinStatus(this.store);
    } catch {
      return null;
    }
  }

  getLeaderboard() {
    try {
      return ClanSystem.getBossLeaderboard(this.store) || [];
    } catch {
      return [];
    }
  }
  getPlayer() {
    return this.store?.get?.()?.player || {};
  }

  getPlayerLevel() {
    return Math.max(1, Number(this.getPlayer()?.level || 1));
  }

  getClanUiState() {
    const state = this.store?.get?.() || {};
    return state.clanUi || { invites: [], joinRequests: [], searchResults: [] };
  }

  _patchClanLocal(patch = {}) {
    const state = this.store?.get?.() || {};
    const prev = state.clanLocal || {};
    this.store?.set?.({ clanLocal: { ...prev, ...patch } });
  }

  getEffectiveClan() {
    const live = this.getClan();
    if (live) return live;
    const local = this.store?.get?.()?.clanLocal;
    return local || null;
  }

  createClanAction() {
    const player = this.getPlayer();
    const level = this.getPlayerLevel();
    if (this.getEffectiveClan()) {
      this.showToast('Zaten bir clandasın');
      return;
    }
    if (level < 10) {
      this.showToast('Clan kurmak için level 10 gerekli');
      return;
    }
    const name = String(window.prompt('Clan adı gir:', player.username ? player.username + ' Clan' : 'NEW CLAN') || '').trim();
    if (!name) {
      this.showToast('Clan adı gerekli');
      return;
    }
    const tag = String(window.prompt('Clan tag gir (2-5 karakter):', name.slice(0, 3).toUpperCase()) || '').trim().toUpperCase().slice(0,5);
    if (!tag) {
      this.showToast('Clan tag gerekli');
      return;
    }
    const clan = {
      id: 'clan_' + Date.now(),
      name,
      tag,
      level: 1,
      xp: 0,
      xpNext: 500,
      power: Math.max(100, Number(player.level || 1) * 10),
      rank: 999,
      territoryCount: 0,
      dailyIncome: 0,
      bank: 0,
      members: [{
        id: String(player.id || 'player_main'),
        name: String(player.username || 'Player'),
        role: 'leader',
        level: Number(player.level || 1),
        power: Math.max(100, Number(player.level || 1) * 10),
      }],
      upgrades: { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 },
      logs: [{ text: `${String(player.username || 'Player')} clanı kurdu.` }],
      boss: null,
    };
    this._patchClanLocal(clan);
    this.showToast('Clan kuruldu');
    this.tab = 'genel';
    this.scrollY = 0;
  }

  inviteAction() {
    const clan = this.getEffectiveClan();
    if (!clan) {
      this.showToast('Önce clan kur veya bir clana katıl');
      return;
    }
    const name = String(window.prompt('Davet etmek istediğin oyuncu adı:', '') || '').trim();
    if (!name) return;
    const ui = this.getClanUiState();
    const invites = Array.isArray(ui.invites) ? ui.invites.slice() : [];
    invites.unshift({ id: 'inv_' + Date.now(), name, clanName: clan.name, at: Date.now(), status: 'sent' });
    this.store?.set?.({ clanUi: { ...ui, invites } });
    this.showToast(name + ' için davet gönderildi');
  }

  searchClanAction() {
    const q = String(window.prompt('Clan ara:', '') || '').trim();
    if (!q) return;
    const ui = this.getClanUiState();
    const current = this.getEffectiveClan();
    const base = [
      { id: 'c1', name: 'NEW CLAN', tag: 'CLN', level: 1, power: 100 },
      { id: 'c2', name: 'Street Kings', tag: 'SK', level: 6, power: 840 },
      { id: 'c3', name: 'Red Mafia', tag: 'RM', level: 9, power: 1330 },
      { id: 'c4', name: 'Night Riders', tag: 'NR', level: 4, power: 420 },
    ];
    if (current) {
      base.unshift({ id: current.id || 'mine', name: current.name, tag: current.tag || '-', level: current.level || 1, power: current.power || 0 });
    }
    const searchResults = base.filter(x => (x.name + ' ' + x.tag).toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    this.store?.set?.({ clanUi: { ...ui, searchResults } });
    if (!searchResults.length) {
      this.showToast('Clan bulunamadı');
      return;
    }
    const pick = searchResults[0];
    if (current && (pick.name === current.name || pick.id === current.id)) {
      this.showToast('Zaten bu clandasın');
      return;
    }
    const joinRequests = Array.isArray(ui.joinRequests) ? ui.joinRequests.slice() : [];
    joinRequests.unshift({ id: 'req_' + Date.now(), clanId: pick.id, clanName: pick.name, tag: pick.tag, at: Date.now(), status: 'pending' });
    this.store?.set?.({ clanUi: { ...ui, searchResults, joinRequests } });
    this.showToast(pick.name + ' clanına istek gönderildi');
  }

  showToast(text, ms = 1800) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  addButton(rect, onClick) {
    this.buttons.push({ ...rect, onClick });
  }

  goScene(key) {
    if (this.scenes && typeof this.scenes.go === "function") {
      this.scenes.go(key);
    }
  }

  syncBossState(force = false) {
    const boss = this.getBoss();
    if (!boss) return;

    if (force || boss.raidId !== this.lastRaidId) {
      this.lastRaidId = boss.raidId || null;
      const lastSymbols = boss?.lastResult?.symbols || ["punch", "kick", "slap"];
      this.reels = this.createReels();

      for (let i = 0; i < 3; i++) {
        const idx = Math.max(0, SYMBOL_ORDER.indexOf(lastSymbols[i] || "punch"));
        this.reels[i].position = idx;
        this.reels[i].targetIndex = idx;
        this.reels[i].finalPosition = idx;
      }
    }
  }

  startSpin() {
    if (this.spinState?.active) return;

    const spinInfo = this.getSpinInfo();
    const bossBefore = this.getBoss();

    if (!spinInfo || !bossBefore) {
      this.showToast("Boss verisi bulunamadı");
      return;
    }

    const energyPerSpin = Math.max(
      1,
      Number(spinInfo.energyPerSpin || bossBefore.energyPerSpin || 6)
    );

    const spinsLeft = Math.max(0, Number(spinInfo.spinsLeft || 0));
    const playerEnergy = Number(this.store?.get?.()?.player?.energy || 0);

    if (spinsLeft <= 0) {
      this.showToast("Spin hakkın kalmadı");
      return;
    }

    if (playerEnergy < energyPerSpin) {
      this.showToast(`Yeterli enerji yok (${playerEnergy}/${energyPerSpin})`);
      return;
    }

    try {
      ClanSystem.spinBoss(this.store);
    } catch (err) {
      this.showToast(err?.message || "Spin başarısız");
      return;
    }

    const bossAfter = this.getBoss();
    const result = bossAfter?.lastResult || null;

    if (!result?.ok) {
      this.showToast(result?.message || "Spin başarısız");
      return;
    }

    const targets = (result.symbols || ["punch", "kick", "slap"]).map((key) => {
      const idx = SYMBOL_ORDER.indexOf(key);
      return idx >= 0 ? idx : 0;
    });

    const now = performance.now();

    this.spinState = {
      active: true,
      startedAt: now,
      result,
      targets,
      finished: false,
    };

    for (let i = 0; i < 3; i++) {
      const reel = this.reels[i];
      reel.speed = 1.2 + i * 0.1;
      reel.stopping = false;
      reel.settled = false;
      reel.stopTime = now + 950 + i * 260;
      reel.targetIndex = targets[i];
      reel.finalPosition = null;
    }
  }

  stopReel(reel) {
    if (reel.stopping) return;

    const cycle = SYMBOL_ORDER.length;
    let finalPosition =
      Math.ceil(reel.position / cycle) * cycle + Number(reel.targetIndex || 0);

    while (finalPosition <= reel.position + 0.1) {
      finalPosition += cycle;
    }

    reel.finalPosition = finalPosition;
    reel.stopping = true;
  }

  settleReel(reel) {
    if (typeof reel.finalPosition !== "number") {
      reel.finalPosition = reel.position;
    }

    const diff = reel.finalPosition - reel.position;
    reel.position += diff * 0.18;

    if (Math.abs(diff) < 0.02) {
      reel.position = reel.finalPosition;
      reel.speed = 0;
      reel.stopping = false;
      reel.settled = true;
      reel.finalPosition = null;
    }
  }

  completeSpinIfReady() {
    if (!this.spinState?.active || this.spinState.finished) return;
    const allSettled = this.reels.every((r) => r.settled);
    if (!allSettled) return;

    this.spinState.finished = true;

    const r = this.spinState.result;
    const damage = Number(r?.damage || 0);

    if (damage > 0) {
      this.flashUntil = Date.now() + 220;
      if (damage >= 120 || r?.stun) {
        this.shakeUntil = Date.now() + 320;
      }
      this.showToast(`${r.combo || "VURUŞ"} • ${damage} HASAR`);
    } else {
      this.showToast("Hasar çıkmadı");
    }

    this.syncBossState(true);
    this.spinState.active = false;
  }

  update() {
    const wheel = wheelDelta(this.input);
    if (wheel) {
      this.scrollY = clamp(this.scrollY + wheel, 0, this.maxScroll);
    }

    const pointer = getPointer(this.input);
    const px = Number(pointer.x || 0);
    const py = Number(pointer.y || 0);

    if (justPressed(this.input)) {
      this.dragging = true;
      this.dragMoved = 0;
      this.downX = px;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.startTabScrollX = this.tabScrollX;
      this.clickCandidate = true;
      this.tabDragging = !!(this.tabBarRect && pointInRect(px, py, this.tabBarRect));
    }

    if (this.dragging && isDown(this.input)) {
      const dx = px - this.downX;
      const dy = py - this.downY;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(dx), Math.abs(dy));

      if (this.tabDragging) {
        this.tabScrollX = clamp(this.startTabScrollX - dx, 0, this.maxTabScrollX);
      } else {
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      }

      if (this.dragMoved > 10) {
        this.clickCandidate = false;
      }
    }

    if (this.dragging && justReleased(this.input)) {
      this.dragging = false;
      const wasTabDragging = this.tabDragging;
      this.tabDragging = false;

      if (this.clickCandidate && !wasTabDragging) {
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (pointInRect(px, py, b)) {
            if (typeof b.onClick === 'function') b.onClick();
            break;
          }
        }
      } else if (this.clickCandidate && wasTabDragging) {
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (pointInRect(px, py, b)) {
            if (typeof b.onClick === 'function') b.onClick();
            break;
          }
        }
      }
    }

    if (this.spinState?.active) {
      const now = performance.now();

      for (const reel of this.reels) {
        if (!reel.stopping && now >= reel.stopTime) {
          this.stopReel(reel);
        }

        if (!reel.stopping) {
          reel.position += reel.speed;
          reel.speed = Math.max(0.38, reel.speed * 0.992);
        } else if (!reel.settled) {
          this.settleReel(reel);
        }
      }

      this.completeSpinIfReady();
    }

    this.syncBossState();
  }

  render(ctx, w, h) {
    const cw = Number(w || ctx.canvas?.clientWidth || ctx.canvas?.width || 0);
    const ch = Number(h || ctx.canvas?.clientHeight || ctx.canvas?.height || 0);

    this.buttons = [];
    this.ensureBackground();

    ctx.clearRect(0, 0, cw, ch);

    if (this._bgImg?.complete) {
      drawCoverImage(ctx, this._bgImg, 0, 0, cw, ch, 1);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, ch);
      bg.addColorStop(0, "#110f10");
      bg.addColorStop(0.48, "#0b090a");
      bg.addColorStop(1, "#050505");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cw, ch);
    }

    const warmWash = ctx.createLinearGradient(0, 0, 0, ch);
    warmWash.addColorStop(0, "rgba(0,0,0,0.18)");
    warmWash.addColorStop(0.35, "rgba(0,0,0,0.24)");
    warmWash.addColorStop(1, "rgba(0,0,0,0.56)");
    ctx.fillStyle = warmWash;
    ctx.fillRect(0, 0, cw, ch);

    const vignette = ctx.createRadialGradient(
      cw * 0.5,
      ch * 0.42,
      20,
      cw * 0.5,
      ch * 0.42,
      Math.max(cw, ch) * 0.82
    );
    vignette.addColorStop(0, "rgba(255,170,80,0.04)");
    vignette.addColorStop(0.45, "rgba(0,0,0,0.08)");
    vignette.addColorStop(1, "rgba(0,0,0,0.46)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cw, ch);

    if (Date.now() < this.shakeUntil) {
      const sx = (Math.random() - 0.5) * 6;
      const sy = (Math.random() - 0.5) * 6;
      ctx.save();
      ctx.translate(sx, sy);
      this.renderInner(ctx, cw, ch);
      ctx.restore();
    } else {
      this.renderInner(ctx, cw, ch);
    }

    if (Date.now() < this.flashUntil) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, cw, ch);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      ctx.font = "800 13px Arial";
      const tw = Math.min(cw - 40, Math.max(180, ctx.measureText(this.toastText).width + 34));
      const th = 40;
      const tx = (cw - tw) / 2;
      const ty = ch - 140;

      fillRR(ctx, tx, ty, tw, th, 12, "rgba(0,0,0,0.70)");
      strokeRR(ctx, tx, ty, tw, th, 12, "rgba(255,190,50,0.30)");

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(this.toastText, tx + tw / 2, ty + 25);
      ctx.textAlign = "left";
    }
  }

  renderInner(ctx, w, h) {
    const safe = this.store?.get?.()?.ui?.safe || { x: 0, y: 0, w, h };
    const hudReservedTop = Number(this.store?.get?.()?.ui?.hudReservedTop || 86);
    const bottomReserved = Number(this.store?.get?.()?.ui?.chatReservedBottom || 22);

    const panelX = safe.x + 14;
    const panelY = Math.max(68, safe.y + hudReservedTop);
    const panelW = safe.w - 28;
    const panelH = safe.h - hudReservedTop - Math.max(18, bottomReserved * 0.28);

    fillRR(ctx, panelX, panelY, panelW, panelH, 24, "rgba(6,8,12,0.16)");
    strokeRR(ctx, panelX, panelY, panelW, panelH, 24, "rgba(255,255,255,0.10)");

    const topGlow = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
    topGlow.addColorStop(0, "rgba(255,255,255,0.07)");
    topGlow.addColorStop(0.24, "rgba(255,255,255,0.02)");
    topGlow.addColorStop(1, "rgba(255,255,255,0)");
    fillRR(ctx, panelX + 1, panelY + 1, panelW - 2, Math.max(90, panelH * 0.18), 24, topGlow);

    const clan = this.getEffectiveClan();
    const boss = this.getBoss();
    const spinInfo = this.getSpinInfo();
    const playerLevel = this.getPlayerLevel();
    const hasClan = !!clan;
    const narrow = panelW < 430;

    ctx.fillStyle = "#ffffff";
    ctx.font = narrow ? "900 20px Arial" : "900 22px Arial";
    ctx.fillText("CLAN", panelX + 16, panelY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = narrow ? "13px Arial" : "14px Arial";
    ctx.fillText(hasClan ? safeClanName(clan) : "Henüz clan yok", panelX + 16, panelY + 50);

    const backBtn = { x: panelX + panelW - 52, y: panelY + 8, w: 36, h: 36 };
    fillRR(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 11, "rgba(255,255,255,0.06)");
    strokeRR(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 11, "rgba(255,255,255,0.12)");
    ctx.fillStyle = "#fff";
    ctx.font = "900 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText("X", backBtn.x + backBtn.w / 2, backBtn.y + 24);
    ctx.textAlign = "left";
    this.addButton(backBtn, () => this.goScene("home"));

    const actionY = panelY + 62;
    const actionGap = 8;
    const actionLabels = [
      { id: 'create', label: hasClan ? 'CLAN AKTİF' : (playerLevel >= 10 ? 'CLAN KUR' : 'LVL 10 GEREK'), onClick: () => this.createClanAction() },
      { id: 'invite', label: 'DAVET ET', onClick: () => this.inviteAction() },
      { id: 'search', label: 'CLAN ARA', onClick: () => this.searchClanAction() },
    ];
    let actionX = panelX + 16;
    const availableW = panelW - 32;
    const actionW = Math.floor((availableW - actionGap * 2) / 3);
    for (const item of actionLabels) {
      const rect = { x: actionX, y: actionY, w: actionW, h: 34 };
      const disabled = item.id === 'create' && hasClan;
      fillRR(ctx, rect.x, rect.y, rect.w, rect.h, 12, disabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.10)');
      strokeRR(ctx, rect.x, rect.y, rect.w, rect.h, 12, item.id === 'create' && !hasClan && playerLevel >= 10 ? 'rgba(255,190,50,0.45)' : 'rgba(255,255,255,0.10)');
      ctx.fillStyle = item.id === 'create' && !hasClan && playerLevel >= 10 ? '#ffd166' : '#fff';
      ctx.font = narrow ? '800 11px Arial' : '800 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, rect.x + rect.w / 2, rect.y + 22);
      ctx.textAlign = 'left';
      this.addButton(rect, () => { if (!disabled) item.onClick(); });
      actionX += actionW + actionGap;
    }

    const tabs = [
      { id: "genel", label: "GENEL" },
      { id: "boss", label: "BOSS" },
      { id: "uyeler", label: "ÜYELER" },
      { id: "kasa", label: "KASA" },
      { id: "gelistirme", label: "GELİŞTİRME" },
      { id: "log", label: "LOG" },
    ];

    const ty = panelY + 106;
    const tabViewportW = panelW - 32;
    this.tabBarRect = { x: panelX + 16, y: ty, w: tabViewportW, h: 38 };
    ctx.save();
    rr(ctx, this.tabBarRect.x, this.tabBarRect.y, this.tabBarRect.w, this.tabBarRect.h, 12);
    ctx.clip();

    let tx = panelX + 16 - this.tabScrollX;
    let totalTabsW = 0;
    ctx.font = "800 13px Arial";
    for (const tab of tabs) {
      const tw = Math.max(84, ctx.measureText(tab.label).width + 26);
      totalTabsW += tw + 8;

      fillRR(ctx, tx, ty, tw, 36, 12, this.tab === tab.id ? "rgba(255,190,50,0.20)" : "rgba(255,255,255,0.08)");
      strokeRR(ctx, tx, ty, tw, 36, 12, this.tab === tab.id ? "rgba(255,190,50,0.52)" : "rgba(255,255,255,0.10)");
      ctx.fillStyle = this.tab === tab.id ? "#ffd166" : "#fff";
      ctx.fillText(tab.label, tx + 12, ty + 23);

      this.addButton({ x: tx, y: ty, w: tw, h: 36 }, () => {
        this.tab = tab.id;
        this.scrollY = 0;
      });

      tx += tw + 8;
    }
    ctx.restore();
    this.maxTabScrollX = Math.max(0, totalTabsW - tabViewportW);
    this.tabScrollX = clamp(this.tabScrollX, 0, this.maxTabScrollX);

    const innerX = panelX + 12;
    const innerY = panelY + 154;
    const innerW = panelW - 24;
    const innerH = panelH - 166;

    rr(ctx, innerX, innerY, innerW, innerH, 18);
    ctx.save();
    ctx.clip();

    fillRR(ctx, innerX, innerY, innerW, innerH, 18, "rgba(255,255,255,0.018)");

    const insideOverlay = ctx.createLinearGradient(0, innerY, 0, innerY + innerH);
    insideOverlay.addColorStop(0, "rgba(0,0,0,0.14)");
    insideOverlay.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = insideOverlay;
    ctx.fillRect(innerX, innerY, innerW, innerH);

    let y = innerY + 14 - this.scrollY;

    if (this.tab === "boss") {
      y = this.renderBossTab(ctx, innerX + 8, y, innerW - 16, clan, boss, spinInfo);
    } else if (this.tab === "genel") {
      y = this.renderGeneralTab(ctx, innerX + 8, y, innerW - 16, clan);
    } else if (this.tab === "uyeler") {
      y = this.renderMembersTab(ctx, innerX + 8, y, innerW - 16, clan);
    } else if (this.tab === "kasa") {
      y = this.renderBankTab(ctx, innerX + 8, y, innerW - 16, clan);
    } else if (this.tab === "gelistirme") {
      y = this.renderUpgradeTab(ctx, innerX + 8, y, innerW - 16, clan);
    } else {
      y = this.renderLogTab(ctx, innerX + 8, y, innerW - 16, clan);
    }

    ctx.restore();

    const contentHeight = Math.max(0, y - (innerY + 14 - this.scrollY));
    this.maxScroll = Math.max(0, contentHeight - (innerH - 20));

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 8;
      const trackY = innerY + 8;
      const trackH = innerH - 16;
      const thumbH = Math.max(42, (innerH / Math.max(innerH, contentHeight)) * trackH);
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;

      fillRR(ctx, trackX, trackY, 4, trackH, 3, "rgba(255,255,255,0.10)");
      fillRR(ctx, trackX, thumbY, 4, thumbH, 3, "rgba(255,255,255,0.36)");
    }
  }

  drawCard(ctx, x, y, w, h, title, subtitle = "") {
    fillRR(ctx, x, y, w, h, 18, "rgba(7,7,7,0.22)");
    strokeRR(ctx, x, y, w, h, 18, "rgba(255,255,255,0.07)");

    const shine = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    shine.addColorStop(0, "rgba(255,255,255,0.06)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    fillRR(ctx, x + 1, y + 1, w - 2, Math.max(40, h * 0.34), 18, shine);

    ctx.fillStyle = "#fff";
    ctx.font = "900 16px Arial";
    ctx.fillText(title, x + 16, y + 26);

    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "13px Arial";
      ctx.fillText(subtitle, x + 16, y + 46);
    }
  }

  renderBossTab(ctx, x, y, w, clan, boss, spinInfo) {
    if (!clan || !boss || !spinInfo) {
      this.drawCard(ctx, x, y, w, 96, "Clan verisi yok", "Önce clan oluştur.");
      return y + 112;
    }

    const player = this.store?.get?.()?.player || {};
    const hpPct = clamp(Number(boss.hp || 0) / Math.max(1, Number(boss.maxHp || 1)), 0, 1);

    this.drawCard(ctx, x, y, w, 130, boss.name || "SOKAK KRALI", "Clan Boss Raid");

    ctx.fillStyle = "#fff";
    ctx.font = "700 13px Arial";
    ctx.fillText(
      `Sezon: ${Number(boss.season || 1)}  •  Durum: ${String(boss.status || "active").toUpperCase()}`,
      x + 16,
      y + 68
    );

    fillRR(ctx, x + 16, y + 82, w - 32, 18, 9, "rgba(255,255,255,0.08)");
    fillRR(ctx, x + 16, y + 82, (w - 32) * hpPct, 18, 9, hpPct > 0.3 ? "#ef4444" : "#f97316");

    ctx.fillStyle = "#fff";
    ctx.font = "700 13px Arial";
    ctx.fillText(`HP ${shortNum(boss.hp)} / ${shortNum(boss.maxHp)}`, x + 16, y + 116);

    const leftMs = Number(boss.endsAt || 0) - Date.now();
    ctx.fillText(`Süre ${fmtTimeLeft(leftMs)}`, x + 220, y + 116);
    ctx.fillText(`Sen ${shortNum(spinInfo.totalDamage || 0)} dmg`, x + 360, y + 116);

    y += 146;

    const machineH = 360;
    this.drawCard(ctx, x, y, w, machineH, "BOSS SLOT", "Profesyonel reel engine");

    const machineX = x + 18;
    const machineY = y + 60;
    const machineW = w - 36;
    const machineInnerH = 190;

    fillRR(ctx, machineX, machineY, machineW, machineInnerH, 24, "rgba(14,16,20,0.58)");
    strokeRR(ctx, machineX, machineY, machineW, machineInnerH, 24, "rgba(255,190,50,0.18)", 2);

    fillRR(ctx, machineX + 12, machineY + 12, machineW - 24, 30, 12, "rgba(255,190,50,0.10)");
    ctx.fillStyle = "#ffd166";
    ctx.font = "900 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CLAN BOSS SLOT MACHINE", machineX + machineW / 2, machineY + 31);
    ctx.textAlign = "left";

    const reelGap = 14;
    const reelW = Math.min(120, (machineW - 52 - reelGap * 2) / 3);
    const reelH = 118;
    const reelsTotal = reelW * 3 + reelGap * 2;
    const reelX0 = machineX + (machineW - reelsTotal) / 2;
    const reelY = machineY + 54;
    const centerLineY = reelY + reelH / 2;

    for (let i = 0; i < 3; i++) {
      const rx = reelX0 + i * (reelW + reelGap);
      this.drawSingleReel(ctx, this.reels[i], rx, reelY, reelW, reelH);
    }

    fillRR(ctx, machineX + 10, centerLineY - 22, machineW - 20, 44, 14, "rgba(255,215,90,0.045)");
    strokeRR(ctx, machineX + 10, centerLineY - 22, machineW - 20, 44, 14, "rgba(255,215,90,0.55)", 2);

    const spinBtn = {
      x: x + 20,
      y: y + machineH - 62,
      w: w - 40,
      h: 42,
    };

    const disabled =
      !!this.spinState?.active ||
      Number(spinInfo.spinsLeft || 0) <= 0 ||
      String(boss.status || "") === "defeated";

    fillRR(
      ctx,
      spinBtn.x,
      spinBtn.y,
      spinBtn.w,
      spinBtn.h,
      14,
      disabled ? "rgba(255,255,255,0.12)" : "rgba(255,190,50,0.95)"
    );

    ctx.fillStyle = disabled ? "rgba(255,255,255,0.72)" : "#111";
    ctx.font = "900 16px Arial";
    ctx.textAlign = "center";

    const spinLabel = this.spinState?.active
      ? "DÖNÜYOR..."
      : `SPIN • ${spinInfo.spinsLeft} HAK • ${Number(spinInfo.energyPerSpin || boss.energyPerSpin || 0)} ENERJİ`;

    ctx.fillText(spinLabel, spinBtn.x + spinBtn.w / 2, spinBtn.y + 27);
    ctx.textAlign = "left";

    this.addButton(spinBtn, () => {
      if (!disabled) this.startSpin();
    });

    y += machineH + 16;

    const last = boss.lastResult || {};
    const lastSymbols = Array.isArray(last.symbols) ? last.symbols : ["punch", "kick", "slap"];

    this.drawCard(ctx, x, y, w, 146, "Son Vuruş", "Spin sonucu");

    let sx = x + 18;
    for (let i = 0; i < 3; i++) {
      const sym = SYMBOL_META[lastSymbols[i]] || SYMBOL_META.punch;
      fillRR(ctx, sx, y + 60, 78, 54, 14, sym.color);
      ctx.fillStyle = "#fff";
      ctx.font = "700 26px Arial";
      ctx.textAlign = "center";
      ctx.fillText(sym.emoji, sx + 39, y + 95);
      ctx.textAlign = "left";
      sx += 90;
    }

    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Arial";
    ctx.fillText(`Combo: ${last.combo || "-"}`, x + 18, y + 132);
    ctx.fillText(`Hasar: ${shortNum(last.damage || 0)}`, x + 220, y + 132);
    ctx.fillText(`Enerji: ${player.energy || 0}/${player.energyMax || 100}`, x + 380, y + 132);

    y += 162;

    this.drawCard(ctx, x, y, w, 136, "Raid Bilgisi", "Genel boss durumu");
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Arial";
    ctx.fillText(`Toplam Hasar: ${shortNum(boss.totalDamage || 0)}`, x + 18, y + 62);
    ctx.fillText(`Toplam Spin: ${shortNum(boss.totalSpins || 0)}`, x + 18, y + 90);
    ctx.fillText(`En İyi Hit: ${shortNum(spinInfo.bestHit || 0)}`, x + 18, y + 118);
    ctx.fillText(`En İyi Combo: ${spinInfo.bestCombo || "-"}`, x + 260, y + 62);
    ctx.fillText(`Günlük Limit: ${Number(spinInfo.dailySpinLimit || 0)}`, x + 260, y + 90);
    ctx.fillText(`Kalan Hak: ${Number(spinInfo.spinsLeft || 0)}`, x + 260, y + 118);

    y += 152;

    const board = this.getLeaderboard();
    const boardH = Math.max(110, 72 + board.length * 38);
    this.drawCard(ctx, x, y, w, boardH, "Boss Liderlik", "En çok hasar verenler");

    let by = y + 58;
    if (!board.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText("Henüz kayıt yok.", x + 18, by + 6);
    } else {
      board.forEach((p, i) => {
        fillRR(ctx, x + 12, by - 16, w - 24, 28, 10, "rgba(255,255,255,0.03)");
        ctx.fillStyle = "#fff";
        ctx.font = "700 13px Arial";
        ctx.fillText(`#${i + 1} ${p.name || "Player"}`, x + 22, by + 2);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText(`DMG ${shortNum(p.totalDamage || 0)}`, x + 220, by + 2);
        ctx.fillText(`BEST ${shortNum(p.bestHit || 0)}`, x + 380, by + 2);
        by += 38;
      });
    }

    y += boardH + 16;
    return y;
  }

  drawSingleReel(ctx, reel, x, y, w, h) {
    fillRR(ctx, x, y, w, h, 18, "rgba(5,5,6,0.92)");
    strokeRR(ctx, x, y, w, h, 18, "rgba(255,255,255,0.10)");

    ctx.save();
    rr(ctx, x, y, w, h, 18);
    ctx.clip();

    const cellH = 44;
    const p = reel.position;
    const whole = Math.floor(p);
    const frac = p - whole;
    const startRow = -3;
    const endRow = 3;

    for (let row = startRow; row <= endRow; row++) {
      const symbolIndex =
        ((whole + row) % SYMBOL_ORDER.length + SYMBOL_ORDER.length) % SYMBOL_ORDER.length;
      const key = SYMBOL_ORDER[symbolIndex];
      const sym = SYMBOL_META[key];
      const cy = y + h / 2 + row * cellH - frac * cellH;

      fillRR(ctx, x + 10, cy - 18, w - 20, 36, 12, sym.color);
      ctx.fillStyle = "#fff";
      ctx.font = "700 22px Arial";
      ctx.textAlign = "center";
      ctx.fillText(sym.emoji, x + w / 2, cy + 8);
      ctx.textAlign = "left";
    }

    const gradTop = ctx.createLinearGradient(0, y, 0, y + 32);
    gradTop.addColorStop(0, "rgba(5,5,6,0.95)");
    gradTop.addColorStop(1, "rgba(5,5,6,0)");
    ctx.fillStyle = gradTop;
    ctx.fillRect(x, y, w, 32);

    const gradBottom = ctx.createLinearGradient(0, y + h - 32, 0, y + h);
    gradBottom.addColorStop(0, "rgba(5,5,6,0)");
    gradBottom.addColorStop(1, "rgba(5,5,6,0.95)");
    ctx.fillStyle = gradBottom;
    ctx.fillRect(x, y + h - 32, w, 32);

    ctx.restore();
  }

  renderGeneralTab(ctx, x, y, w, clan) {
    const narrow = w < 430;
    const cardH = narrow ? 254 : 176;
    this.drawCard(ctx, x, y, w, cardH, "Genel Bilgiler", "Clan özeti");
    const leftX = x + 18;
    const rightX = narrow ? leftX : x + Math.floor(w * 0.58);
    let leftY = y + 64;
    let rightY = narrow ? y + 158 : y + 64;
    const lineH = 28;
    const left = [
      `Clan Adı: ${safeClanName(clan)}`,
      `Tag: ${clan?.tag || '-'}`,
      `Seviye: ${Number(clan?.level || 1)}`,
      `XP: ${shortNum(clan?.xp || 0)} / ${shortNum(clan?.xpNext || 0)}`,
    ];
    const right = [
      `Power: ${shortNum(clan?.power || 0)}`,
      `Sıralama: ${shortNum(clan?.rank || 0)}`,
      `Bölge: ${shortNum(clan?.territoryCount || 0)}`,
      `Günlük Gelir: ${fmtCash(clan?.dailyIncome || 0)}`,
    ];
    ctx.fillStyle = '#fff';
    ctx.font = narrow ? '700 14px Arial' : '700 15px Arial';
    for (const row of left) { ctx.fillText(row, leftX, leftY); leftY += lineH; }
    for (const row of right) { ctx.fillText(row, rightX, rightY); rightY += lineH; }

    const ui = this.getClanUiState();
    const reqs = Array.isArray(ui.joinRequests) ? ui.joinRequests.slice(0, 3) : [];
    if (reqs.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.76)';
      ctx.font = '700 13px Arial';
      ctx.fillText('Katılım İstekleri:', x + 18, y + cardH - 26);
      let rx = x + 132;
      for (const r of reqs) {
        const label = `${r.clanName} (${r.status})`;
        ctx.fillText(label, rx, y + cardH - 26);
        rx += Math.min(170, ctx.measureText(label).width + 20);
      }
    }
    return y + cardH + 16;
  }

  renderMembersTab(ctx, x, y, w, clan) {
    const members = Array.isArray(clan?.members) ? clan.members : [];
    const narrow = w < 430;
    const rowH = narrow ? 50 : 42;
    const h = Math.max(120, 70 + members.length * rowH + 56);
    this.drawCard(ctx, x, y, w, h, "Üyeler", "Clan kadrosu");

    let my = y + 58;
    if (!members.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText("Üye yok.", x + 18, my + 6);
    } else {
      for (const m of members) {
        fillRR(ctx, x + 12, my - 16, w - 24, narrow ? 38 : 30, 10, "rgba(255,255,255,0.03)");
        ctx.fillStyle = "#fff";
        ctx.font = "700 13px Arial";
        ctx.fillText(m.name || "Player", x + 22, my + 3);
        if (narrow) {
          ctx.fillStyle = "rgba(255,255,255,0.78)";
          ctx.fillText(`${String(m.role || 'member').toUpperCase()} • Lv.${Number(m.level || 1)} • Power ${shortNum(m.power || 0)}`, x + 22, my + 23);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.78)";
          ctx.fillText(String(m.role || "member").toUpperCase(), x + 190, my + 3);
          ctx.fillText(`Lv.${Number(m.level || 1)}`, x + 310, my + 3);
          ctx.fillText(`Power ${shortNum(m.power || 0)}`, x + 390, my + 3);
        }
        my += rowH;
      }
    }

    const ui = this.getClanUiState();
    const invites = Array.isArray(ui.invites) ? ui.invites.slice(0, 3) : [];
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '700 13px Arial';
    ctx.fillText('Son Davetler', x + 18, y + h - 28);
    let ix = x + 110;
    for (const inv of invites) {
      const label = `${inv.name} (${inv.status})`;
      ctx.fillText(label, ix, y + h - 28);
      ix += Math.min(150, ctx.measureText(label).width + 18);
    }
    return y + h + 16;
  }

  renderBankTab(ctx, x, y, w, clan) {
    const narrow = w < 430;
    this.drawCard(ctx, x, y, w, narrow ? 172 : 138, "Clan Kasa", "Ekonomi");
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px Arial";
    ctx.fillText(`Kasa: ${fmtCash(clan?.bank || 0)}`, x + 18, y + 62);
    ctx.fillText(`Günlük Gelir: ${fmtCash(clan?.dailyIncome || 0)}`, x + 18, y + 90);
    ctx.fillText(`Kapasite: ${fmtCash(clan?.limits?.vaultCapacity || 0)}`, x + 18, y + 118);
    if (narrow) {
      ctx.fillText(`Üye Sayısı: ${Array.isArray(clan?.members) ? clan.members.length : 0}`, x + 18, y + 146);
      return y + 188;
    }
    return y + 154;
  }

  renderUpgradeTab(ctx, x, y, w, clan) {
    const upgrades = clan?.upgrades || {};
    const rows = [
      { label: "Üye Kapasitesi", level: upgrades.memberCap || 0 },
      { label: "Kasa", level: upgrades.vault || 0 },
      { label: "Gelir", level: upgrades.income || 0 },
      { label: "Saldırı", level: upgrades.attack || 0 },
      { label: "Savunma", level: upgrades.defense || 0 },
    ];

    const h = 82 + rows.length * 42;
    this.drawCard(ctx, x, y, w, h, "Geliştirmeler", "Aktif clan bonusları");

    let uy = y + 60;
    for (const row of rows) {
      fillRR(ctx, x + 12, uy - 16, w - 24, 30, 10, "rgba(255,255,255,0.03)");
      ctx.fillStyle = "#fff";
      ctx.font = w < 430 ? '700 12px Arial' : '700 13px Arial';
      ctx.fillText(`${row.label} • Lv.${row.level}`, x + 22, uy + 3);
      uy += 42;
    }

    return y + h + 16;
  }

  renderLogTab(ctx, x, y, w, clan) {
    const logs = Array.isArray(clan?.logs) ? clan.logs.slice(0, 20) : [];
    const h = Math.max(120, 72 + logs.length * 38);
    this.drawCard(ctx, x, y, w, h, "Log", "Son clan hareketleri");

    let ly = y + 58;
    if (!logs.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText("Log boş.", x + 18, ly + 6);
    } else {
      for (const log of logs) {
        fillRR(ctx, x + 12, ly - 16, w - 24, 30, 10, "rgba(255,255,255,0.03)");
        ctx.fillStyle = "#fff";
        ctx.font = "13px Arial";
        ctx.fillText(log?.text || "-", x + 22, ly + 3);
        ly += 38;
      }
    }

    return y + h + 16;
  }
}


export default ClanScene;
