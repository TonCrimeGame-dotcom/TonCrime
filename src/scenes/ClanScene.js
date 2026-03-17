import { ClanSystem } from "../clan/ClanSystem.js";

const TAB_ITEMS = [
  { id: "genel", label: "GENEL" },
  { id: "boss", label: "BOSS" },
  { id: "uyeler", label: "ÜYELER" },
  { id: "kasa", label: "KASA" },
  { id: "gelistirme", label: "GELİŞTİRME" },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

function fillRR(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, stroke, lw = 1) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}

function shortNum(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return `${Math.floor(v)}`;
}

function fmtCash(n) {
  return `${Number(n || 0).toLocaleString("tr-TR")} yTon`;
}

function safeClanName(clan) {
  const t = String(clan?.name || "").trim();
  return t || "NEW CLAN";
}

function safeClanTag(clan) {
  const t = String(clan?.tag || "").trim();
  return t || "CLN";
}

function getPointer(input) {
  return input?.pointer || input?.p || input?.mouse || input?.state?.pointer || { x: 0, y: 0 };
}

function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  return !!input?._justPressed || !!input?.mousePressed;
}

function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  return !!input?._justReleased || !!input?.mouseReleased;
}

function isDown(input) {
  if (typeof input?.isDown === "function") return !!input.isDown();
  return !!input?.pointer?.down || !!input?.mouseDown;
}

function wheelDelta(input) {
  return Number(input?.wheelDelta || input?.mouseWheelDelta || input?.state?.wheelDelta || 0);
}

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

function drawCoverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img) return;
  const iw = Math.max(1, Number(img.width || img.naturalWidth || 1));
  const ih = Math.max(1, Number(img.height || img.naturalHeight || 1));
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

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxWidth) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function trimToWidth(ctx, text, maxWidth) {
  let out = String(text || "");
  while (out && ctx.measureText(out).width > maxWidth) out = out.slice(0, -1);
  return out === text ? out : `${out.slice(0, -1)}…`;
}

function clone(v) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
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
    this.tabButtons = [];
    this.contentRect = null;
    this.tabStripRect = null;

    this.scrollY = 0;
    this.maxScroll = 0;
    this.tabScrollX = 0;
    this.tabMaxScroll = 0;

    this.dragging = false;
    this.dragAxis = null;
    this.dragMoved = 0;
    this.downX = 0;
    this.downY = 0;
    this.startScrollY = 0;
    this.startTabScrollX = 0;
    this.clickCandidate = false;

    this.toastText = "";
    this.toastUntil = 0;

    this._bgImg = null;
    this._bgRequested = false;
  }

  onEnter() {
    this.ensureBackground();
    this._ensureClanState();
    this.buttons = [];
    this.tabButtons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragAxis = null;
    this.dragMoved = 0;
  }

  onExit() {
    this.dragging = false;
    this.dragAxis = null;
  }

  ensureBackground() {
    if (this._bgImg) return this._bgImg;
    const fromAssets =
      getImgSafe(this.assets, "clan") ||
      getImgSafe(this.assets, "clanhub") ||
      getImgSafe(this.assets, "clan_bg") ||
      getImgSafe(this.assets, "Clan_bg") ||
      getImgSafe(this.assets, "Clan-bg") ||
      getImgSafe(this.assets, "nightclub") ||
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

  _ensureClanState() {
    const s = this.store.get() || {};
    const player = s.player || {};
    const clanState = clone(s.clan || {});

    if (!Array.isArray(clanState.invites)) clanState.invites = [];
    if (!Array.isArray(clanState.requests)) clanState.requests = [];
    if (!Array.isArray(clanState.searchPool)) {
      clanState.searchPool = [
        { id: "clan_1", name: "WOLFPACK", tag: "WLF", level: 7, power: 1240, members: 16, maxMembers: 24, region: "EU" },
        { id: "clan_2", name: "BLACK TON", tag: "BTN", level: 11, power: 2880, members: 23, maxMembers: 30, region: "TR" },
        { id: "clan_3", name: "STREET KINGS", tag: "SK", level: 5, power: 860, members: 9, maxMembers: 18, region: "US" },
      ];
    }

    if (!clanState.profile) {
      clanState.profile = {
        ownsClan: !!clanState.name,
        role: clanState.name ? "leader" : "none",
      };
    }

    if (!clanState.name) {
      clanState.name = "";
      clanState.tag = "";
      clanState.level = 1;
      clanState.xp = 0;
      clanState.xpNext = 500;
      clanState.power = 0;
      clanState.rank = 999;
      clanState.territoryCount = 0;
      clanState.dailyIncome = 0;
      clanState.bank = 0;
      clanState.logs = clanState.logs || [];
      clanState.members = clanState.members || [];
      clanState.upgrades = clanState.upgrades || { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 };
      clanState.limits = clanState.limits || { vaultCapacity: 5000 };
    }

    if (clanState.name && (!Array.isArray(clanState.members) || !clanState.members.length)) {
      clanState.members = [
        {
          id: String(player.telegramId || player.id || "player_main"),
          name: String(player.username || "Player"),
          role: "leader",
          level: Number(player.level || 1),
          power: Math.max(100, Number(player.level || 1) * 20),
          online: true,
        },
      ];
    }

    if (!clanState.logs) clanState.logs = [];
    if (!clanState.upgrades) clanState.upgrades = { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 };
    if (!clanState.limits) clanState.limits = { vaultCapacity: 5000 };

    this.store.set({ clan: clanState });
  }

  getClan() {
    try {
      const fromSystem = ClanSystem?.getClan?.(this.store);
      if (fromSystem) return fromSystem;
    } catch (_) {}
    return this.store.get()?.clan || null;
  }

  getBoss() {
    try {
      return ClanSystem?.getBossState?.(this.store) || null;
    } catch {
      return null;
    }
  }

  getSpinInfo() {
    try {
      return ClanSystem?.getBossSpinStatus?.(this.store) || null;
    } catch {
      return null;
    }
  }

  getLeaderboard() {
    try {
      return ClanSystem?.getBossLeaderboard?.(this.store) || [];
    } catch {
      return [];
    }
  }

  _player() {
    return this.store.get()?.player || {};
  }

  _setClan(patch) {
    const s = this.store.get() || {};
    this.store.set({ clan: { ...(s.clan || {}), ...patch } });
  }

  _pushClanLog(text) {
    const s = this.store.get() || {};
    const clan = clone(s.clan || {});
    clan.logs = Array.isArray(clan.logs) ? clan.logs.slice(0, 39) : [];
    clan.logs.unshift({ text: String(text || "-"), at: Date.now() });
    this.store.set({ clan });
  }

  showToast(text, ms = 1800) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  addButton(rect, onClick) {
    this.buttons.push({ ...rect, onClick });
  }

  _createClan() {
    const s = this.store.get() || {};
    const player = s.player || {};
    const clan = clone(s.clan || {});

    if (Number(player.level || 1) < 10) {
      this.showToast("Clan kurma seviyesi 10'da açılır");
      return;
    }
    if (String(clan.name || "").trim()) {
      this.showToast("Zaten bir clan içindesin");
      return;
    }

    const name = String(window.prompt("Clan adını gir", "NEW CLAN") || "").trim();
    if (!name) return;
    const tagDefault = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "CLN";
    const tag = String(window.prompt("Clan tag gir", tagDefault) || tagDefault).trim().slice(0, 6).toUpperCase();
    if (!tag) return;

    const myName = String(player.username || "Player");
    const newClan = {
      ...clan,
      id: `clan_${Date.now()}`,
      name,
      tag,
      level: 1,
      xp: 0,
      xpNext: 500,
      power: Math.max(100, Number(player.level || 1) * 20),
      rank: 999,
      territoryCount: 0,
      dailyIncome: 50,
      bank: 0,
      limits: { vaultCapacity: 5000 },
      upgrades: { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 },
      members: [
        {
          id: String(player.telegramId || player.id || "player_main"),
          name: myName,
          role: "leader",
          level: Number(player.level || 1),
          power: Math.max(100, Number(player.level || 1) * 20),
          online: true,
        },
      ],
      invites: clan.invites || [],
      requests: clan.requests || [],
      searchPool: clan.searchPool || [],
      profile: { ownsClan: true, role: "leader" },
      logs: [{ text: `${myName} clan kurdu`, at: Date.now() }],
    };

    this.store.set({ clan: newClan });
    this.tab = "genel";
    this.scrollY = 0;
    this.showToast("Clan kuruldu");
  }

  _inviteMember() {
    const s = this.store.get() || {};
    const clan = clone(s.clan || {});
    if (!String(clan.name || "").trim()) {
      this.showToast("Önce clan kurmalısın");
      return;
    }
    const name = String(window.prompt("Davet etmek istediğin oyuncu adı", "") || "").trim();
    if (!name) return;
    clan.invites = Array.isArray(clan.invites) ? clan.invites : [];
    clan.invites.unshift({ id: `inv_${Date.now()}`, name, state: "sent", at: Date.now() });
    this.store.set({ clan });
    this._pushClanLog(`${name} oyuncusuna davet gönderildi`);
    this.showToast("Davet gönderildi");
  }

  _sendJoinRequest(poolItem) {
    const s = this.store.get() || {};
    const clan = clone(s.clan || {});
    if (String(clan.name || "").trim()) {
      this.showToast("Önce mevcut clandan ayrılmalısın");
      return;
    }
    clan.requests = Array.isArray(clan.requests) ? clan.requests : [];
    const exists = clan.requests.find((x) => x.targetId === poolItem.id);
    if (exists) {
      this.showToast("İstek zaten gönderildi");
      return;
    }
    clan.requests.unshift({
      id: `req_${Date.now()}`,
      targetId: poolItem.id,
      targetName: poolItem.name,
      state: "pending",
      at: Date.now(),
    });
    this.store.set({ clan });
    this.showToast("Katılım isteği gönderildi");
  }

  _applyUpgrade(key) {
    const s = this.store.get() || {};
    const clan = clone(s.clan || {});
    if (!String(clan.name || "").trim()) {
      this.showToast("Önce clan kur");
      return;
    }
    const cost = 250 + Number(clan.upgrades?.[key] || 0) * 150;
    if (Number(clan.bank || 0) < cost) {
      this.showToast("Kasada yeterli yTon yok");
      return;
    }
    clan.bank = Math.max(0, Number(clan.bank || 0) - cost);
    clan.upgrades = clan.upgrades || { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 };
    clan.upgrades[key] = Number(clan.upgrades[key] || 0) + 1;
    if (key === "vault") clan.limits.vaultCapacity += 2000;
    if (key === "income") clan.dailyIncome += 35;
    this.store.set({ clan });
    this._pushClanLog(`Geliştirme yapıldı: ${key}`);
    this.showToast("Geliştirme tamamlandı");
  }

  startSpin() {
    try {
      if (this.getSpinInfo() && this.getBoss() && ClanSystem?.spinBoss) {
        ClanSystem.spinBoss(this.store);
        this.showToast("Boss spin atıldı");
      } else {
        this.showToast("Boss sistemi hazır değil");
      }
    } catch (err) {
      this.showToast(err?.message || "Spin başarısız");
    }
  }

  update() {
    const wheel = wheelDelta(this.input);
    if (wheel) this.scrollY = clamp(this.scrollY + wheel, 0, this.maxScroll);

    const p = getPointer(this.input);
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);

    if (justPressed(this.input)) {
      this.dragging = true;
      this.dragAxis = null;
      this.dragMoved = 0;
      this.downX = px;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.startTabScrollX = this.tabScrollX;
      this.clickCandidate = true;
    }

    if (this.dragging && isDown(this.input)) {
      const dx = px - this.downX;
      const dy = py - this.downY;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(dx) + Math.abs(dy));

      if (!this.dragAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        this.dragAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }

      if (this.dragAxis === "x" && pointInRect(this.downX, this.downY, this.tabStripRect)) {
        this.tabScrollX = clamp(this.startTabScrollX - dx, 0, this.tabMaxScroll);
        this.clickCandidate = false;
      } else if (this.dragAxis === "y") {
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
        if (Math.abs(dy) > 10) this.clickCandidate = false;
      }
    }

    if (this.dragging && justReleased(this.input)) {
      this.dragging = false;
      this.dragAxis = null;
      if (this.clickCandidate) {
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (pointInRect(px, py, b)) {
            if (typeof b.onClick === "function") b.onClick();
            break;
          }
        }
      }
    }
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const clan = this.getClan() || {};
    const boss = this.getBoss();
    const spinInfo = this.getSpinInfo();
    const player = state.player || {};
    const safe = state?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(state?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    this.buttons = [];
    drawCoverImage(ctx, this.ensureBackground(), 0, 0, w, h, 1);
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, "rgba(0,0,0,0.22)");
    fade.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 10;
    const panelY = safe.y + topReserved - 4;
    const panelW = safe.w - 20;
    const panelH = Math.max(260, safe.h - topReserved - bottomReserved + 4);

    fillRR(ctx, panelX, panelY, panelW, panelH, 22, "rgba(8,10,16,0.34)");
    strokeRR(ctx, panelX, panelY, panelW, panelH, 22, "rgba(255,255,255,0.12)", 1);
    fillRR(ctx, panelX + 1, panelY + 1, panelW - 2, 64, 22, "rgba(255,255,255,0.04)");

    const closeRect = { x: panelX + panelW - 50, y: panelY + 14, w: 36, h: 36 };
    fillRR(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 12, "rgba(255,255,255,0.12)");
    strokeRR(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 12, "rgba(255,255,255,0.14)");
    ctx.fillStyle = "#fff";
    ctx.font = "900 20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2 + 1);
    this.addButton(closeRect, () => this.scenes.go("home"));

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.max(18, Math.min(24, panelW * 0.06))}px system-ui`;
    ctx.fillText("CLAN", panelX + 18, panelY + 30);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "13px system-ui";
    ctx.fillText(String(clan.name || "Yeni clan sistemi"), panelX + 18, panelY + 50);

    const actionY = panelY + 72;
    const actionH = 34;
    const createRect = { x: panelX + 16, y: actionY, w: 110, h: actionH };
    const inviteRect = { x: panelX + 134, y: actionY, w: 100, h: actionH };
    const searchRect = { x: panelX + 242, y: actionY, w: 120, h: actionH };

    const canCreate = Number(player.level || 1) >= 10 && !String(clan.name || "").trim();
    this._drawActionBtn(ctx, createRect, canCreate ? "CLAN KUR" : "LVL 10 GEREK", canCreate ? "amber" : "muted");
    this.addButton(createRect, () => { if (canCreate) this._createClan(); else this.showToast("Clan kurma seviyesi 10'da açılır"); });

    const canInvite = !!String(clan.name || "").trim();
    this._drawActionBtn(ctx, inviteRect, "DAVET ET", canInvite ? "blue" : "muted");
    this.addButton(inviteRect, () => { if (canInvite) this._inviteMember(); else this.showToast("Önce clan kur"); });

    this._drawActionBtn(ctx, searchRect, "CLAN ARA", "dark");
    this.addButton(searchRect, () => { this.tab = "uyeler"; this.scrollY = 0; });

    const tabY = panelY + 116;
    const tabH = 38;
    const stripX = panelX + 12;
    const stripW = panelW - 24;
    this.tabStripRect = { x: stripX, y: tabY, w: stripW, h: tabH };

    fillRR(ctx, stripX, tabY, stripW, tabH, 14, "rgba(255,255,255,0.04)");
    strokeRR(ctx, stripX, tabY, stripW, tabH, 14, "rgba(255,255,255,0.08)");

    ctx.save();
    rr(ctx, stripX, tabY, stripW, tabH, 14);
    ctx.clip();

    let tx = stripX + 8 - this.tabScrollX;
    ctx.font = "800 13px system-ui";
    this.tabButtons = [];
    for (const tab of TAB_ITEMS) {
      const tw = Math.max(84, Math.ceil(ctx.measureText(tab.label).width) + 26);
      fillRR(ctx, tx, tabY + 3, tw, tabH - 6, 12, this.tab === tab.id ? "rgba(255,190,50,0.22)" : "rgba(255,255,255,0.08)");
      strokeRR(ctx, tx, tabY + 3, tw, tabH - 6, 12, this.tab === tab.id ? "rgba(255,190,50,0.54)" : "rgba(255,255,255,0.10)");
      ctx.fillStyle = this.tab === tab.id ? "#ffd166" : "#fff";
      ctx.fillText(tab.label, tx + 13, tabY + 25);
      const rect = { x: tx, y: tabY + 3, w: tw, h: tabH - 6 };
      this.tabButtons.push(rect);
      this.addButton(rect, () => { this.tab = tab.id; this.scrollY = 0; });
      tx += tw + 8;
    }
    this.tabMaxScroll = Math.max(0, tx - (stripX + stripW) + this.tabScrollX);
    this.tabScrollX = clamp(this.tabScrollX, 0, Math.max(0, tx - (stripX + stripW) - 8));
    ctx.restore();

    const innerX = panelX + 12;
    const innerY = tabY + tabH + 10;
    const innerW = panelW - 24;
    const innerH = panelH - (innerY - panelY) - 12;
    this.contentRect = { x: innerX, y: innerY, w: innerW, h: innerH };

    fillRR(ctx, innerX, innerY, innerW, innerH, 18, "rgba(5,7,11,0.18)");
    strokeRR(ctx, innerX, innerY, innerW, innerH, 18, "rgba(255,255,255,0.08)");

    ctx.save();
    rr(ctx, innerX, innerY, innerW, innerH, 18);
    ctx.clip();

    let cy = innerY + 12 - this.scrollY;
    const contentX = innerX + 8;
    const contentW = innerW - 16;

    if (this.tab === "genel") cy = this.renderGeneralTab(ctx, contentX, cy, contentW, clan, player);
    else if (this.tab === "boss") cy = this.renderBossTab(ctx, contentX, cy, contentW, clan, boss, spinInfo, player);
    else if (this.tab === "uyeler") cy = this.renderMembersTab(ctx, contentX, cy, contentW, clan, player);
    else if (this.tab === "kasa") cy = this.renderBankTab(ctx, contentX, cy, contentW, clan);
    else cy = this.renderUpgradeTab(ctx, contentX, cy, contentW, clan);

    ctx.restore();

    const contentHeight = Math.max(0, cy - (innerY + 12 - this.scrollY));
    this.maxScroll = Math.max(0, contentHeight - (innerH - 20));
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 7;
      const trackY = innerY + 10;
      const trackH = innerH - 20;
      const thumbH = Math.max(44, trackH * ((innerH - 20) / Math.max(innerH - 20, contentHeight)));
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;
      fillRR(ctx, trackX, trackY, 4, trackH, 3, "rgba(255,255,255,0.10)");
      fillRR(ctx, trackX, thumbY, 4, thumbH, 3, "rgba(255,255,255,0.38)");
    }

    if (Date.now() < this.toastUntil && this.toastText) {
      const tw = Math.min(panelW - 40, Math.max(160, ctx.measureText(this.toastText).width + 34));
      const th = 36;
      const tx2 = panelX + (panelW - tw) / 2;
      const ty2 = panelY + panelH - th - 10;
      fillRR(ctx, tx2, ty2, tw, th, 14, "rgba(0,0,0,0.62)");
      strokeRR(ctx, tx2, ty2, tw, th, 14, "rgba(255,255,255,0.12)");
      ctx.fillStyle = "#fff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx2 + tw / 2, ty2 + th / 2 + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  _drawActionBtn(ctx, r, text, tone = "amber") {
    const fill = tone === "amber"
      ? "rgba(255,190,50,0.22)"
      : tone === "blue"
      ? "rgba(90,170,255,0.18)"
      : tone === "muted"
      ? "rgba(255,255,255,0.08)"
      : "rgba(255,255,255,0.12)";
    const stroke = tone === "amber"
      ? "rgba(255,190,50,0.54)"
      : tone === "blue"
      ? "rgba(90,170,255,0.50)"
      : "rgba(255,255,255,0.14)";
    fillRR(ctx, r.x, r.y, r.w, r.h, 12, fill);
    strokeRR(ctx, r.x, r.y, r.w, r.h, 12, stroke);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawCard(ctx, x, y, w, h, title, subtitle = "") {
    fillRR(ctx, x, y, w, h, 18, "rgba(7,7,7,0.20)");
    strokeRR(ctx, x, y, w, h, 18, "rgba(255,255,255,0.08)");
    const shine = ctx.createLinearGradient(0, y, 0, y + Math.max(40, h * 0.35));
    shine.addColorStop(0, "rgba(255,255,255,0.08)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    fillRR(ctx, x + 1, y + 1, w - 2, Math.max(40, h * 0.30), 18, shine);
    ctx.fillStyle = "#fff";
    ctx.font = "900 16px system-ui";
    ctx.fillText(title, x + 16, y + 26);
    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "13px system-ui";
      ctx.fillText(subtitle, x + 16, y + 46);
    }
  }

  renderGeneralTab(ctx, x, y, w, clan, player) {
    const hasClan = !!String(clan?.name || "").trim();
    if (!hasClan) {
      this.drawCard(ctx, x, y, w, 170, "Clan Merkezi", "Mobil clan sistemi hazır");
      ctx.fillStyle = "#fff";
      ctx.font = "700 14px system-ui";
      const lines = [
        `Seviyen: ${Number(player.level || 1)}`,
        "• Level 10 olunca clan kur açılır.",
        "• Clan adı ve tag girerek kurabilirsin.",
        "• Üyeler sekmesinden clan arayıp katılım isteği gönderebilirsin.",
      ];
      let ly = y + 76;
      for (const line of lines) {
        ctx.fillText(line, x + 18, ly);
        ly += 24;
      }
      return y + 186;
    }

    const cardH = 216;
    this.drawCard(ctx, x, y, w, cardH, "Genel Bilgiler", "Clan özeti");
    const leftX = x + 18;
    const rightX = x + Math.floor(w * 0.56);
    const valueW = Math.max(80, rightX - leftX - 20);
    ctx.font = "700 15px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(trimToWidth(ctx, `Clan Adı: ${safeClanName(clan)}`, valueW), leftX, y + 74);
    ctx.fillText(trimToWidth(ctx, `Tag: ${safeClanTag(clan)}`, valueW), leftX, y + 102);
    ctx.fillText(`Seviye: ${Number(clan?.level || 1)}`, leftX, y + 130);
    ctx.fillText(`XP: ${shortNum(clan?.xp || 0)} / ${shortNum(clan?.xpNext || 0)}`, leftX, y + 158);

    const rightW = w - (rightX - x) - 18;
    ctx.fillText(trimToWidth(ctx, `Power: ${shortNum(clan?.power || 0)}`, rightW), rightX, y + 74);
    ctx.fillText(trimToWidth(ctx, `Sıralama: ${shortNum(clan?.rank || 0)}`, rightW), rightX, y + 102);
    ctx.fillText(trimToWidth(ctx, `Bölge: ${shortNum(clan?.territoryCount || 0)}`, rightW), rightX, y + 130);
    ctx.fillText(trimToWidth(ctx, `Günlük Gelir: ${fmtCash(clan?.dailyIncome || 0)}`, rightW), rightX, y + 158);

    const statsY = y + cardH + 16;
    this.drawCard(ctx, x, statsY, w, 116, "Davet ve Başvurular", "Clan sosyal alanı");
    ctx.font = "13px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(`Gönderilen davet: ${Number(clan?.invites?.length || 0)}`, x + 18, statsY + 74);
    ctx.fillText(`Gönderilen başvuru: ${Number(clan?.requests?.length || 0)}`, x + 18, statsY + 98);
    return statsY + 132;
  }

  renderBossTab(ctx, x, y, w, clan, boss, spinInfo, player) {
    if (!String(clan?.name || "").trim()) {
      this.drawCard(ctx, x, y, w, 96, "Boss verisi yok", "Önce clan oluştur.");
      return y + 112;
    }

    if (!boss || !spinInfo) {
      this.drawCard(ctx, x, y, w, 120, "Boss sistemi", "ClanSystem bağlıysa otomatik çalışır");
      ctx.fillStyle = "rgba(255,255,255,0.84)";
      ctx.font = "13px system-ui";
      ctx.fillText(`Enerji: ${Number(player.energy || 0)} / ${Number(player.energyMax || 100)}`, x + 18, y + 82);
      const btn = { x: x + 18, y: y + 92, w: w - 36, h: 32 };
      this._drawActionBtn(ctx, btn, "SPIN DENE", "amber");
      this.addButton(btn, () => this.startSpin());
      return y + 136;
    }

    const hpPct = clamp(Number(boss.hp || 0) / Math.max(1, Number(boss.maxHp || 1)), 0, 1);
    this.drawCard(ctx, x, y, w, 164, boss.name || "SOKAK KRALI", "Clan Boss Raid");
    ctx.fillStyle = "#fff";
    ctx.font = "700 13px system-ui";
    ctx.fillText(`Sezon: ${Number(boss.season || 1)} • Durum: ${String(boss.status || "active").toUpperCase()}`, x + 16, y + 68);
    fillRR(ctx, x + 16, y + 86, w - 32, 18, 9, "rgba(255,255,255,0.08)");
    fillRR(ctx, x + 16, y + 86, (w - 32) * hpPct, 18, 9, hpPct > 0.3 ? "#ef4444" : "#f97316");
    ctx.fillText(`HP ${shortNum(boss.hp)} / ${shortNum(boss.maxHp)}`, x + 16, y + 118);
    ctx.fillText(`Kalan Hak: ${Number(spinInfo.spinsLeft || 0)}`, x + 16, y + 144);
    ctx.fillText(`Senin Dmg: ${shortNum(spinInfo.totalDamage || 0)}`, x + Math.floor(w * 0.52), y + 118);
    ctx.fillText(`Enerji/Spin: ${Number(spinInfo.energyPerSpin || boss.energyPerSpin || 0)}`, x + Math.floor(w * 0.52), y + 144);

    const spinBtn = { x: x + 16, y: y + 172, w: w - 32, h: 40 };
    this._drawActionBtn(ctx, spinBtn, "BOSS SPIN", "amber");
    this.addButton(spinBtn, () => this.startSpin());

    const board = this.getLeaderboard();
    const topY = y + 228;
    const boardH = Math.max(110, 72 + Math.min(8, board.length || 0) * 36);
    this.drawCard(ctx, x, topY, w, boardH, "Boss Liderlik", "En çok hasar verenler");
    let ly = topY + 62;
    if (!board.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px system-ui";
      ctx.fillText("Henüz kayıt yok.", x + 18, ly);
    } else {
      board.slice(0, 8).forEach((row, i) => {
        fillRR(ctx, x + 12, ly - 18, w - 24, 28, 10, "rgba(255,255,255,0.03)");
        ctx.fillStyle = "#fff";
        ctx.font = "700 13px system-ui";
        ctx.fillText(`#${i + 1} ${trimToWidth(ctx, row.name || "Player", Math.max(90, w * 0.42))}`, x + 20, ly + 1);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText(`DMG ${shortNum(row.totalDamage || 0)}`, x + Math.floor(w * 0.58), ly + 1);
        ly += 36;
      });
    }
    return topY + boardH + 16;
  }

  renderMembersTab(ctx, x, y, w, clan, player) {
    const members = Array.isArray(clan?.members) ? clan.members : [];
    const searchPool = Array.isArray(clan?.searchPool) ? clan.searchPool : [];
    const requestCount = Array.isArray(clan?.requests) ? clan.requests.length : 0;
    const topH = Math.max(140, 72 + members.length * 46);
    this.drawCard(ctx, x, y, w, topH, "Üyeler", "Clan kadrosu");
    let my = y + 62;
    if (!members.length) {
      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "14px system-ui";
      ctx.fillText("Henüz üye yok.", x + 18, my);
    } else {
      for (const m of members) {
        fillRR(ctx, x + 12, my - 18, w - 24, 34, 12, "rgba(255,255,255,0.03)");
        ctx.fillStyle = "#fff";
        ctx.font = "700 13px system-ui";
        const nameW = Math.max(80, w * 0.34);
        ctx.fillText(trimToWidth(ctx, m.name || "Player", nameW), x + 20, my + 2);
        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.fillText(String(m.role || "member").toUpperCase(), x + Math.floor(w * 0.40), my + 2);
        ctx.fillText(`Lv.${Number(m.level || 1)}`, x + Math.floor(w * 0.62), my + 2);
        ctx.fillText(`Power ${shortNum(m.power || 0)}`, x + Math.floor(w * 0.74), my + 2);
        my += 42;
      }
    }

    const searchY = y + topH + 16;
    const searchH = Math.max(170, 84 + searchPool.length * 46);
    this.drawCard(ctx, x, searchY, w, searchH, "Clan Ara", `Gönderilen başvuru: ${requestCount}`);
    let sy = searchY + 66;
    if (!searchPool.length) {
      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "14px system-ui";
      ctx.fillText("Aranacak clan bulunamadı.", x + 18, sy);
    } else {
      for (const c of searchPool) {
        fillRR(ctx, x + 12, sy - 20, w - 24, 36, 12, "rgba(255,255,255,0.03)");
        ctx.fillStyle = "#fff";
        ctx.font = "700 13px system-ui";
        const title = `${c.name} [${c.tag}]`;
        ctx.fillText(trimToWidth(ctx, title, Math.max(90, w * 0.42)), x + 18, sy + 1);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(`Lv.${c.level} • ${c.members}/${c.maxMembers}`, x + Math.floor(w * 0.46), sy + 1);

        const btn = { x: x + w - 116, y: sy - 24, w: 96, h: 28 };
        this._drawActionBtn(ctx, btn, "İSTEK GÖNDER", "blue");
        this.addButton(btn, () => this._sendJoinRequest(c));
        sy += 46;
      }
    }
    return searchY + searchH + 16;
  }

  renderBankTab(ctx, x, y, w, clan) {
    const bank = Number(clan?.bank || 0);
    const income = Number(clan?.dailyIncome || 0);
    const cap = Number(clan?.limits?.vaultCapacity || 0);

    this.drawCard(ctx, x, y, w, 180, "Clan Kasa", "Ekonomi");
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px system-ui";
    ctx.fillText(`Kasa: ${fmtCash(bank)}`, x + 18, y + 70);
    ctx.fillText(`Günlük Gelir: ${fmtCash(income)}`, x + 18, y + 100);
    ctx.fillText(`Kapasite: ${fmtCash(cap)}`, x + 18, y + 130);

    const depositBtn = { x: x + 18, y: y + 146, w: w - 36, h: 34 };
    this._drawActionBtn(ctx, depositBtn, "KASAYA 250 yTon EKLE", "amber");
    this.addButton(depositBtn, () => {
      const s = this.store.get() || {};
      if (Number(s.coins || 0) < 250) return this.showToast("Yetersiz yTon");
      this.store.set({ coins: Number(s.coins || 0) - 250, clan: { ...(s.clan || {}), bank: Number(s.clan?.bank || 0) + 250 } });
      this._pushClanLog("Kasaya 250 yTon yatırıldı");
      this.showToast("Kasa güncellendi");
    });
    return y + 196;
  }

  renderUpgradeTab(ctx, x, y, w, clan) {
    const upgrades = clan?.upgrades || {};
    const rows = [
      { key: "memberCap", label: "Üye Kapasitesi", level: upgrades.memberCap || 0 },
      { key: "vault", label: "Kasa", level: upgrades.vault || 0 },
      { key: "income", label: "Gelir", level: upgrades.income || 0 },
      { key: "attack", label: "Saldırı", level: upgrades.attack || 0 },
      { key: "defense", label: "Savunma", level: upgrades.defense || 0 },
    ];

    const h = 84 + rows.length * 50;
    this.drawCard(ctx, x, y, w, h, "Geliştirmeler", "Aktif clan bonusları");
    let ry = y + 66;
    for (const row of rows) {
      fillRR(ctx, x + 12, ry - 20, w - 24, 38, 12, "rgba(255,255,255,0.03)");
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px system-ui";
      ctx.fillText(`${row.label} • Lv.${row.level}`, x + 18, ry + 1);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      const cost = 250 + Number(row.level || 0) * 150;
      ctx.fillText(`Maliyet ${cost} yTon`, x + Math.floor(w * 0.44), ry + 1);
      const btn = { x: x + w - 104, y: ry - 24, w: 86, h: 28 };
      this._drawActionBtn(ctx, btn, "YÜKSELT", "amber");
      this.addButton(btn, () => this._applyUpgrade(row.key));
      ry += 50;
    }
    return y + h + 16;
  }
}
