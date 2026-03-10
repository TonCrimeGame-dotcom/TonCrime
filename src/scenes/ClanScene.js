import { ClanSystem } from "../clan/ClanSystem.js";
import { formatMoney, getRoleLabel, getUpgradeCost, getUpgradeLabel } from "../clan/ClanUtils.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r) {
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r) {
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}

function fitCover(iw, ih, bw, bh) {
  const s = Math.max(bw / Math.max(1, iw), bh / Math.max(1, ih));
  const w = iw * s;
  const h = ih * s;
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

function shortNum(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return `${Math.floor(v)}`;
}

function formatCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const SYMBOLS = {
  punch: {
    key: "punch",
    label: "YUMRUK",
    emoji: "👊",
    color: "#f59e0b",
    damage: 12,
  },
  kick: {
    key: "kick",
    label: "TEKME",
    emoji: "🦵",
    color: "#22c55e",
    damage: 14,
  },
  slap: {
    key: "slap",
    label: "TOKAT",
    emoji: "🖐️",
    color: "#60a5fa",
    damage: 8,
  },
  head: {
    key: "head",
    label: "KAFA",
    emoji: "🧠",
    color: "#ef4444",
    damage: 16,
  },
};

const REEL_KEYS = ["punch", "kick", "slap", "head"];

export class ClanScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.tab = "boss";
    this.buttons = [];

    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.downX = 0;
    this.downY = 0;
    this.startScrollY = 0;
    this.dragMoved = 0;

    this.toast = "";
    this.toastUntil = 0;

    this.reels = [
      { index: 0, visual: 0 },
      { index: 1, visual: 1 },
      { index: 2, visual: 2 },
    ];

    this.spinAnim = null;
    this.lastRaidId = null;
  }

  onEnter() {
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.syncBossReels(true);
  }

  onExit() {
    this.dragging = false;
  }

  getPointer() {
    return (
      this.input?.pointer ||
      this.input?.p ||
      this.input?.mouse ||
      this.input?.state?.pointer ||
      { x: 0, y: 0 }
    );
  }

  justPressed() {
    if (typeof this.input?.justPressed === "function") return !!this.input.justPressed();
    if (typeof this.input?.isJustPressed === "function") {
      return (
        !!this.input.isJustPressed("pointer") ||
        !!this.input.isJustPressed("mouseLeft") ||
        !!this.input.isJustPressed("touch")
      );
    }
    return !!this.input?._justPressed || !!this.input?.mousePressed;
  }

  justReleased() {
    if (typeof this.input?.justReleased === "function") return !!this.input.justReleased();
    if (typeof this.input?.isJustReleased === "function") {
      return (
        !!this.input.isJustReleased("pointer") ||
        !!this.input.isJustReleased("mouseLeft") ||
        !!this.input.isJustReleased("touch")
      );
    }
    return !!this.input?._justReleased || !!this.input?.mouseReleased;
  }

  isDown() {
    if (typeof this.input?.isDown === "function") return !!this.input.isDown();
    return !!this.input?.pointer?.down || !!this.input?.mouseDown;
  }

  wheelDelta() {
    return Number(
      this.input?.wheelDelta ||
        this.input?.mouseWheelDelta ||
        this.input?.state?.wheelDelta ||
        0
    );
  }

  showToast(text, ms = 1600) {
    this.toast = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  goHome() {
    if (this.scenes?.go) this.scenes.go("home");
  }

  getClan() {
    return ClanSystem.getClan(this.store);
  }

  getBoss() {
    return ClanSystem.getBossState(this.store);
  }

  getBossSpinInfo() {
    return ClanSystem.getBossSpinStatus(this.store);
  }

  syncBossReels(force = false) {
    const boss = this.getBoss();
    if (!boss) return;

    if (force || boss.raidId !== this.lastRaidId) {
      this.lastRaidId = boss.raidId || null;
      const keys = boss?.lastResult?.symbols || ["punch", "kick", "slap"];
      this.reels = keys.map((k, i) => {
        const idx = Math.max(0, REEL_KEYS.indexOf(k));
        return { index: idx, visual: idx + i * 0.1 };
      });
      while (this.reels.length < 3) {
        const idx = this.reels.length % REEL_KEYS.length;
        this.reels.push({ index: idx, visual: idx });
      }
    }
  }

  handleSpin() {
    if (this.spinAnim?.active) return;

    const boss = this.getBoss();
    const spinInfo = this.getBossSpinInfo();

    if (!boss) {
      this.showToast("Clan bulunamadı");
      return;
    }

    if (Number(spinInfo?.spinsLeft || 0) <= 0) {
      this.showToast("Spin hakkı bitti");
      return;
    }

    const beforeSymbols = boss?.lastResult?.symbols || ["punch", "kick", "slap"];
    const beforeKeys = beforeSymbols.map((k) => (SYMBOLS[k] ? k : "punch"));

    for (let i = 0; i < 3; i++) {
      const idx = Math.max(0, REEL_KEYS.indexOf(beforeKeys[i] || "punch"));
      this.reels[i].index = idx;
      this.reels[i].visual = idx;
    }

    ClanSystem.spinBoss(this.store);

    const newBoss = this.getBoss();
    const last = newBoss?.lastResult;

    if (!last?.ok) {
      this.showToast(last?.message || "Spin başarısız");
      return;
    }

    const resultKeys = (last.symbols || ["punch", "kick", "slap"]).map((k) =>
      SYMBOLS[k] ? k : "punch"
    );

    const targets = resultKeys.map((k) => Math.max(0, REEL_KEYS.indexOf(k)));

    this.spinAnim = {
      active: true,
      startedAt: performance.now(),
      duration: 1700,
      targets,
      result: last,
    };
  }

  update() {
    const wheel = this.wheelDelta();
    if (wheel) {
      this.scrollY = clamp(this.scrollY + wheel, 0, this.maxScroll);
    }

    const p = this.getPointer();
    const pressed = this.justPressed();
    const released = this.justReleased();
    const down = this.isDown();

    if (pressed) {
      this.dragging = true;
      this.downX = Number(p.x || 0);
      this.downY = Number(p.y || 0);
      this.startScrollY = this.scrollY;
      this.dragMoved = 0;
    }

    if (this.dragging && down) {
      const dy = Number(p.y || 0) - this.downY;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(dy));
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
    }

    if (this.dragging && released) {
      const moved = this.dragMoved > 10;
      if (!moved) this.handleTap(Number(p.x || 0), Number(p.y || 0));
      this.dragging = false;
    }

    if (this.spinAnim?.active) {
      const now = performance.now();
      const elapsed = now - this.spinAnim.startedAt;
      const p = clamp(elapsed / this.spinAnim.duration, 0, 1);

      for (let i = 0; i < this.reels.length; i++) {
        const reel = this.reels[i];
        const target = this.spinAnim.targets[i] || 0;

        const extraTurns = 12 + i * 4;
        const eased = 1 - Math.pow(1 - p, 3);

        const visual = extraTurns * (1 - p) + target + (1 - eased);
        reel.visual = visual;
        reel.index =
          ((Math.floor(visual) % REEL_KEYS.length) + REEL_KEYS.length) % REEL_KEYS.length;
      }

      if (p >= 1) {
        for (let i = 0; i < this.reels.length; i++) {
          const target = this.spinAnim.targets[i] || 0;
          this.reels[i].visual = target;
          this.reels[i].index = target;
        }

        const r = this.spinAnim.result;
        this.spinAnim = null;

        if (r?.damage > 0) {
          this.showToast(`${r.combo || "VURUŞ"} • ${r.damage} HASAR`);
        } else {
          this.showToast("Hasar çıkmadı");
        }
      }
    }

    this.syncBossReels();
  }

  handleTap(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (pointInRect(x, y, b)) {
        b.onClick?.();
        return;
      }
    }
  }

  addButton(rect, onClick) {
    this.buttons.push({ ...rect, onClick });
  }

  drawCard(ctx, x, y, w, h, title, subtitle = "") {
    ctx.fillStyle = "rgba(7,7,10,0.58)";
    fillRR(ctx, x, y, w, h, 18);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    strokeRR(ctx, x, y, w, h, 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px Arial";
    ctx.fillText(title, x + 16, y + 28);

    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "13px Arial";
      ctx.fillText(subtitle, x + 16, y + 48);
    }
  }

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    this.buttons = [];

    const bg =
      this.assets?.get?.("background") ||
      this.assets?.get?.("xxx") ||
      this.assets?.images?.background ||
      this.assets?.images?.xxx ||
      null;

    ctx.clearRect(0, 0, w, h);

    if (bg) {
      const fit = fitCover(bg.width || 1, bg.height || 1, w, h);
      ctx.drawImage(bg, fit.x, fit.y, fit.w, fit.h);
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = "#090909";
      ctx.fillRect(0, 0, w, h);
    }

    const safe = this.store.get()?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(this.store.get()?.ui?.hudReservedTop || 110);

    const panelX = safe.x + 14;
    const panelY = Math.max(72, safe.y + topReserved);
    const panelW = safe.w - 28;
    const panelH = safe.h - topReserved - 26;

    fillRR(ctx, panelX, panelY, panelW, panelH, 22);
    ctx.fillStyle = "rgba(0,0,0,0.44)";
    fillRR(ctx, panelX, panelY, panelW, panelH, 22);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRR(ctx, panelX, panelY, panelW, panelH, 22);

    ctx.fillStyle = "#fff";
    ctx.font = "900 24px Arial";
    ctx.fillText("CLAN", panelX + 16, panelY + 30);

    const clan = this.getClan();
    const clanName = clan?.name || "İsimsiz Clan";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "14px Arial";
    ctx.fillText(clanName, panelX + 16, panelY + 52);

    const backBtn = { x: panelX + panelW - 90, y: panelY + 12, w: 74, h: 32 };
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    fillRR(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRR(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "800 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Geri", backBtn.x + backBtn.w / 2, backBtn.y + 21);
    ctx.textAlign = "left";
    this.addButton(backBtn, () => this.goHome());

    const tabs = [
      { id: "genel", label: "GENEL" },
      { id: "boss", label: "BOSS" },
      { id: "üyeler", label: "ÜYELER" },
      { id: "kasa", label: "KASA" },
      { id: "geliştirme", label: "GELİŞTİRME" },
      { id: "log", label: "LOG" },
    ];

    let tx = panelX + 16;
    const ty = panelY + 68;
    for (const tab of tabs) {
      const tw = Math.max(74, ctx.measureText(tab.label).width + 24);
      ctx.fillStyle =
        this.tab === tab.id ? "rgba(255,190,50,0.22)" : "rgba(255,255,255,0.08)";
      fillRR(ctx, tx, ty, tw, 36, 12);
      ctx.strokeStyle =
        this.tab === tab.id ? "rgba(255,190,50,0.55)" : "rgba(255,255,255,0.10)";
      strokeRR(ctx, tx, ty, tw, 36, 12);

      ctx.fillStyle = this.tab === tab.id ? "#ffd166" : "#fff";
      ctx.font = "800 13px Arial";
      ctx.fillText(tab.label, tx + 12, ty + 23);

      this.addButton({ x: tx, y: ty, w: tw, h: 36 }, () => {
        this.tab = tab.id;
        this.scrollY = 0;
      });

      tx += tw + 8;
    }

    const innerX = panelX + 14;
    const innerY = panelY + 114;
    const innerW = panelW - 28;
    const innerH = panelH - 128;

    ctx.save();
    rr(ctx, innerX, innerY, innerW, innerH, 18);
    ctx.clip();

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(innerX, innerY, innerW, innerH);

    let contentY = innerY + 14 - this.scrollY;

    if (this.tab === "boss") {
      contentY = this.renderBossTab(ctx, innerX + 10, contentY, innerW - 20);
    } else if (this.tab === "genel") {
      contentY = this.renderGeneralTab(ctx, innerX + 10, contentY, innerW - 20);
    } else if (this.tab === "üyeler") {
      contentY = this.renderMembersTab(ctx, innerX + 10, contentY, innerW - 20);
    } else if (this.tab === "kasa") {
      contentY = this.renderBankTab(ctx, innerX + 10, contentY, innerW - 20);
    } else if (this.tab === "geliştirme") {
      contentY = this.renderUpgradeTab(ctx, innerX + 10, contentY, innerW - 20);
    } else if (this.tab === "log") {
      contentY = this.renderLogTab(ctx, innerX + 10, contentY, innerW - 20);
    }

    ctx.restore();

    const contentHeight = Math.max(0, contentY - (innerY + 14 - this.scrollY));
    this.maxScroll = Math.max(0, contentHeight - (innerH - 20));

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 8;
      const trackY = innerY + 8;
      const trackH = innerH - 16;
      const thumbH = Math.max(40, (innerH / Math.max(innerH, contentHeight)) * trackH);
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      fillRR(ctx, trackX, trackY, 4, trackH, 4);
      ctx.fillStyle = "rgba(255,255,255,0.36)";
      fillRR(ctx, trackX, thumbY, 4, thumbH, 4);
    }

    if (this.toast && Date.now() < this.toastUntil) {
      const tw = Math.min(320, panelW - 40);
      const th = 40;
      const tx0 = panelX + (panelW - tw) / 2;
      const ty0 = panelY + panelH - 56;

      ctx.fillStyle = "rgba(0,0,0,0.82)";
      fillRR(ctx, tx0, ty0, tw, th, 12);
      ctx.strokeStyle = "rgba(255,190,50,0.35)";
      strokeRR(ctx, tx0, ty0, tw, th, 12);

      ctx.fillStyle = "#fff";
      ctx.font = "800 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(this.toast, tx0 + tw / 2, ty0 + 25);
      ctx.textAlign = "left";
    }
  }

  renderBossTab(ctx, x, y, w) {
    const clan = this.getClan();
    const boss = this.getBoss();
    const spinInfo = this.getBossSpinInfo();
    const leaderboard = ClanSystem.getBossLeaderboard(this.store) || [];
    const player = this.store.get()?.player || {};

    if (!clan || !boss || !spinInfo) {
      this.drawCard(ctx, x, y, w, 100, "Clan verisi yok", "Önce clan oluştur.");
      return y + 116;
    }

    this.drawCard(ctx, x, y, w, 116, boss.name || "SOKAK KRALI", "Clan Boss Slot");
    const hpPct = clamp(Number(boss.hp || 0) / Math.max(1, Number(boss.maxHp || 1)), 0, 1);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRR(ctx, x + 16, y + 62, w - 32, 18, 9);

    ctx.fillStyle = hpPct > 0.35 ? "#ef4444" : "#f97316";
    fillRR(ctx, x + 16, y + 62, (w - 32) * hpPct, 18, 9);

    ctx.fillStyle = "#fff";
    ctx.font = "700 13px Arial";
    ctx.fillText(
      `HP ${shortNum(boss.hp)} / ${shortNum(boss.maxHp)} • Durum: ${String(
        boss.status || "active"
      ).toUpperCase()}`,
      x + 16,
      y + 96
    );

    y += 132;

    const slotH = 292;
    this.drawCard(ctx, x, y, w, slotH, "BOSS SLOT", "Yumruk • Tekme • Tokat • Kafa");

    const reelGap = 12;
    const reelW = Math.min(116, (w - 64) / 3);
    const reelH = 122;
    const totalW = reelW * 3 + reelGap * 2;
    const rx0 = x + (w - totalW) / 2;
    const ry = y + 62;

    for (let i = 0; i < 3; i++) {
      const reel = this.reels[i] || { index: 0 };
      const key = REEL_KEYS[reel.index] || "punch";
      const s = SYMBOLS[key];
      const rx = rx0 + i * (reelW + reelGap);

      ctx.fillStyle = "rgba(0,0,0,0.50)";
      fillRR(ctx, rx, ry, reelW, reelH, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRR(ctx, rx, ry, reelW, reelH, 18);

      ctx.fillStyle = s.color;
      fillRR(ctx, rx + 10, ry + 10, reelW - 20, reelH - 20, 14);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "700 40px Arial";
      ctx.fillText(s.emoji, rx + reelW / 2, ry + 58);
      ctx.font = "900 13px Arial";
      ctx.fillText(s.label, rx + reelW / 2, ry + 92);
      ctx.font = "700 11px Arial";
      ctx.fillText(`${s.damage} DMG`, rx + reelW / 2, ry + 108);
      ctx.textAlign = "left";
    }

    const spinBtn = {
      x: x + 18,
      y: y + slotH - 64,
      w: w - 36,
      h: 42,
    };

    const disabled =
      !!this.spinAnim?.active ||
      Number(spinInfo.spinsLeft || 0) <= 0 ||
      String(boss.status || "") === "defeated";

    ctx.fillStyle = disabled ? "rgba(255,255,255,0.12)" : "rgba(255,190,50,0.95)";
    fillRR(ctx, spinBtn.x, spinBtn.y, spinBtn.w, spinBtn.h, 14);
    ctx.fillStyle = disabled ? "rgba(255,255,255,0.72)" : "#111";
    ctx.font = "900 17px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      this.spinAnim?.active
        ? "DÖNÜYOR..."
        : `SPIN • ${spinInfo.spinsLeft} HAK • ${spinInfo.energyPerSpin} ENERJİ`,
      spinBtn.x + spinBtn.w / 2,
      spinBtn.y + 26
    );
    ctx.textAlign = "left";

    this.addButton(spinBtn, () => {
      if (!disabled) this.handleSpin();
    });

    y += slotH + 16;

    const last = boss.lastResult || {};
    this.drawCard(ctx, x, y, w, 142, "Son Vuruş", "Son spin sonucu");
    const lastSymbols = last.symbols || ["punch", "kick", "slap"];
    let sx = x + 18;
    for (const key of lastSymbols) {
      const s = SYMBOLS[key] || SYMBOLS.punch;
      ctx.fillStyle = s.color;
      fillRR(ctx, sx, y + 62, 78, 52, 14);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "700 26px Arial";
      ctx.fillText(s.emoji, sx + 39, y + 96);
      ctx.textAlign = "left";
      sx += 90;
    }
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Arial";
    ctx.fillText(`Combo: ${last.combo || "-"}`, x + 18, y + 130);
    ctx.fillText(`Hasar: ${Math.floor(last.damage || 0)}`, x + 220, y + 130);
    ctx.fillText(`Enerji: ${player.energy || 0}/${player.energyMax || 100}`, x + 360, y + 130);

    y += 158;

    this.drawCard(ctx, x, y, w, 134, "Raid Bilgisi", "Genel boss durumu");
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Arial";
    ctx.fillText(`Toplam Hasar: ${shortNum(boss.totalDamage || 0)}`, x + 18, y + 62);
    ctx.fillText(`Toplam Spin: ${shortNum(boss.totalSpins || 0)}`, x + 18, y + 88);
    ctx.fillText(`En İyi Hit: ${shortNum(spinInfo.bestHit || 0)}`, x + 18, y + 114);
    ctx.fillText(`En İyi Combo: ${spinInfo.bestCombo || "-"}`, x + 250, y + 62);

    const leftMs = Number(boss.endsAt || 0) - Date.now();
    ctx.fillText(`Süre: ${formatCountdown(leftMs)}`, x + 250, y + 88);
    ctx.fillText(`Senin Hasarın: ${shortNum(spinInfo.totalDamage || 0)}`, x + 250, y + 114);

    y += 150;

    const boardH = Math.max(110, 72 + leaderboard.length * 38);
    this.drawCard(ctx, x, y, w, boardH, "Boss Liderlik", "En çok hasar verenler");

    let by = y + 58;
    if (!leaderboard.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText("Henüz kayıt yok.", x + 18, by + 6);
    } else {
      leaderboard.forEach((p, i) => {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        fillRR(ctx, x + 12, by - 16, w - 24, 28, 10);

        ctx.fillStyle = "#fff";
        ctx.font = "700 13px Arial";
        ctx.fillText(`#${i + 1} ${p.name || "Player"}`, x + 22, by + 2);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText(`DMG ${shortNum(p.totalDamage || 0)}`, x + 220, by + 2);
        ctx.fillText(`BEST ${shortNum(p.bestHit || 0)}`, x + 360, by + 2);
        by += 38;
      });
    }

    y += boardH + 16;
    return y;
  }

  renderGeneralTab(ctx, x, y, w) {
    const clan = this.getClan();
    if (!clan) {
      this.drawCard(ctx, x, y, w, 90, "Clan yok", "");
      return y + 110;
    }

    this.drawCard(ctx, x, y, w, 176, "Genel Bilgiler", "Clan özeti");
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px Arial";
    ctx.fillText(`Clan Adı: ${clan.name || "-"}`, x + 18, y + 64);
    ctx.fillText(`Tag: ${clan.tag || "-"}`, x + 18, y + 92);
    ctx.fillText(`Seviye: ${Number(clan.level || 1)}`, x + 18, y + 120);
    ctx.fillText(`XP: ${shortNum(clan.xp || 0)} / ${shortNum(clan.xpNext || 0)}`, x + 18, y + 148);
    ctx.fillText(`Power: ${shortNum(clan.power || 0)}`, x + 260, y + 64);
    ctx.fillText(`Sıralama: ${shortNum(clan.rank || 0)}`, x + 260, y + 92);
    ctx.fillText(`Bölge: ${shortNum(clan.territoryCount || 0)}`, x + 260, y + 120);
    ctx.fillText(`Günlük Gelir: ${formatMoney(clan.dailyIncome || 0)}`, x + 260, y + 148);
    return y + 192;
  }

  renderMembersTab(ctx, x, y, w) {
    const clan = this.getClan();
    const members = Array.isArray(clan?.members) ? clan.members : [];

    const h = Math.max(120, 70 + members.length * 44);
    this.drawCard(ctx, x, y, w, h, "Üyeler", "Clan kadrosu");

    let my = y + 58;
    if (!members.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText("Üye yok.", x + 18, my + 6);
      return y + h + 16;
    }

    for (const m of members) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRR(ctx, x + 12, my - 16, w - 24, 30, 10);

      ctx.fillStyle = "#fff";
      ctx.font = "700 13px Arial";
      ctx.fillText(m.name || "Player", x + 22, my + 3);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillText(getRoleLabel(m.role || "member"), x + 180, my + 3);
      ctx.fillText(`Lv.${Number(m.level || 1)}`, x + 300, my + 3);
      ctx.fillText(`Power ${shortNum(m.power || 0)}`, x + 390, my + 3);

      my += 44;
    }

    return y + h + 16;
  }

  renderBankTab(ctx, x, y, w) {
    const clan = this.getClan();

    this.drawCard(ctx, x, y, w, 140, "Clan Kasa", "Ekonomi");
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px Arial";
    ctx.fillText(`Kasa: ${formatMoney(clan?.bank || 0)}`, x + 18, y + 64);
    ctx.fillText(`Günlük Gelir: ${formatMoney(clan?.dailyIncome || 0)}`, x + 18, y + 92);
    ctx.fillText(
      `Kapasite: ${formatMoney(clan?.limits?.vaultCapacity || 0)}`,
      x + 18,
      y + 120
    );

    return y + 156;
  }

  renderUpgradeTab(ctx, x, y, w) {
    const clan = this.getClan();
    const upgrades = clan?.upgrades || {};
    const rows = [
      { key: "memberCap", level: upgrades.memberCap || 0 },
      { key: "vault", level: upgrades.vault || 0 },
      { key: "income", level: upgrades.income || 0 },
      { key: "attack", level: upgrades.attack || 0 },
      { key: "defense", level: upgrades.defense || 0 },
    ];

    const h = 82 + rows.length * 42;
    this.drawCard(ctx, x, y, w, h, "Geliştirmeler", "Aktif clan bonusları");

    let uy = y + 60;
    for (const row of rows) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRR(ctx, x + 12, uy - 16, w - 24, 30, 10);

      ctx.fillStyle = "#fff";
      ctx.font = "700 13px Arial";
      ctx.fillText(`${getUpgradeLabel(row.key)} • Lv.${row.level}`, x + 22, uy + 3);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillText(`Sonraki: ${formatMoney(getUpgradeCost(row.key, row.level))}`, x + 250, uy + 3);

      uy += 42;
    }

    return y + h + 16;
  }

  renderLogTab(ctx, x, y, w) {
    const clan = this.getClan();
    const logs = Array.isArray(clan?.logs) ? clan.logs.slice(0, 20) : [];
    const h = Math.max(120, 72 + logs.length * 38);

    this.drawCard(ctx, x, y, w, h, "Log", "Son clan hareketleri");

    let ly = y + 58;
    if (!logs.length) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText("Log boş.", x + 18, ly + 6);
      return y + h + 16;
    }

    for (const log of logs) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRR(ctx, x + 12, ly - 16, w - 24, 30, 10);

      ctx.fillStyle = "#fff";
      ctx.font = "13px Arial";
      ctx.fillText(log?.text || "-", x + 22, ly + 3);

      ly += 38;
    }

    return y + h + 16;
  }
}
