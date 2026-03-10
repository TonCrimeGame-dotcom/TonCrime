import { ClanSystem } from "../clan/ClanSystem.js";
import {
  formatMoney,
  getRoleLabel,
  getUpgradeCost,
  getUpgradeLabel,
} from "../clan/ClanUtils.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function fitCover(iw, ih, bw, bh) {
  const s = Math.max(bw / Math.max(1, iw), bh / Math.max(1, ih));
  const w = iw * s;
  const h = ih * s;
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

function formatTimeLeft(ms) {
  const n = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function shortNumber(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
}

function safePlayerName(store) {
  const s = store?.get?.() || {};
  return s?.player?.name || s?.player?.username || "Player";
}

const SLOT_SYMBOLS = {
  punch: {
    key: "punch",
    label: "YUMRUK",
    short: "YMR",
    emoji: "👊",
    baseDamage: 12,
    accent: "#f59e0b",
  },
  kick: {
    key: "kick",
    label: "TEKME",
    short: "TKM",
    emoji: "🦵",
    baseDamage: 14,
    accent: "#22c55e",
  },
  slap: {
    key: "slap",
    label: "TOKAT",
    short: "TKT",
    emoji: "🖐️",
    baseDamage: 8,
    accent: "#60a5fa",
  },
  head: {
    key: "head",
    label: "KAFA",
    short: "KFA",
    emoji: "🧠",
    baseDamage: 16,
    accent: "#ef4444",
  },
};

const SLOT_ORDER = ["punch", "kick", "slap", "head"];

export class ClanScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.tab = "genel";
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.dragMoved = 0;
    this.downX = 0;
    this.downY = 0;
    this.startScrollY = 0;

    this.toastText = "";
    this.toastUntil = 0;

    this.reels = [
      { index: 0, offset: 0 },
      { index: 1, offset: 0 },
      { index: 2, offset: 0 },
    ];
    this.spinAnim = null;
    this.flashUntil = 0;
    this.lastBossRaidId = null;
  }

  onEnter() {
    this.buttons = [];
    this.scrollY = 0;
    this.maxScroll = 0;
    this.syncBossVisualState(true);
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

  isDown() {
    if (typeof this.input?.isDown === "function") return !!this.input.isDown();
    return !!this.input?.pointer?.down || !!this.input?.mouseDown;
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

  mouseWheelDelta() {
    const raw =
      this.input?.wheelDelta ||
      this.input?.mouseWheelDelta ||
      this.input?.state?.wheelDelta ||
      0;
    return Number(raw || 0);
  }

  getClan() {
    return ClanSystem.getClan(this.store);
  }

  getBoss() {
    return ClanSystem.getBossState(this.store);
  }

  showToast(text, ms = 1800) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  syncBossVisualState(force = false) {
    const boss = this.getBoss();
    if (!boss) return;

    if (boss.raidId !== this.lastBossRaidId || force) {
      this.lastBossRaidId = boss.raidId || null;
      const symbols = boss?.lastResult?.symbols || ["punch", "kick", "slap"];
      this.reels = symbols.map((key, i) => ({
        index: Math.max(0, SLOT_ORDER.indexOf(key)),
        offset: 0,
        lane: i,
      }));
      while (this.reels.length < 3) {
        this.reels.push({ index: this.reels.length % SLOT_ORDER.length, offset: 0 });
      }
    }
  }

  spinBoss() {
    if (this.spinAnim?.active) return;

    const before = this.getBoss();
    const spins = Number(before?.spinsLeft || 0);
    if (spins <= 0) {
      this.showToast("Spin hakkı kalmadı");
      return;
    }

    let result = null;
    try {
      result = ClanSystem.spinBoss(this.store);
    } catch (err) {
      this.showToast(err?.message || "Spin başarısız");
      return;
    }

    const symbols = result?.symbols || ["punch", "kick", "slap"];
    const targets = symbols.map((key) => Math.max(0, SLOT_ORDER.indexOf(key)));

    this.spinAnim = {
      active: true,
      startedAt: performance.now(),
      duration: 1800,
      settleDuration: 420,
      targets,
      result,
    };

    this.flashUntil = Date.now() + 250;
  }

  update(dt) {
    const wheel = this.mouseWheelDelta();
    if (wheel) {
      this.scrollY = clamp(this.scrollY + wheel, 0, this.maxScroll);
    }

    const p = this.getPointer();
    const down = this.isDown();

    if (this.justPressed()) {
      this.dragging = true;
      this.dragMoved = 0;
      this.downX = p.x;
      this.downY = p.y;
      this.startScrollY = this.scrollY;
    }

    if (this.dragging && down) {
      const dy = p.y - this.downY;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(dy));
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
    }

    if (this.dragging && this.justReleased()) {
      const moved = this.dragMoved > 10;
      if (!moved) this.handleTap(p.x, p.y);
      this.dragging = false;
    }

    if (this.spinAnim?.active) {
      const now = performance.now();
      const t = now - this.spinAnim.startedAt;
      const progress = Math.min(1, t / this.spinAnim.duration);

      for (let i = 0; i < this.reels.length; i++) {
        const reel = this.reels[i];
        const stopAt = this.spinAnim.targets[i] || 0;

        const baseTurns = 14 + i * 5;
        const eased = 1 - Math.pow(1 - progress, 3);
        const pos = baseTurns * (1 - progress) + stopAt + (1 - eased) * 1.5;
        reel.offset = pos;
        reel.index = ((Math.floor(pos) % SLOT_ORDER.length) + SLOT_ORDER.length) % SLOT_ORDER.length;
      }

      if (progress >= 1) {
        for (let i = 0; i < this.reels.length; i++) {
          this.reels[i].offset = this.spinAnim.targets[i] || 0;
          this.reels[i].index = this.spinAnim.targets[i] || 0;
        }

        const r = this.spinAnim.result;
        this.spinAnim.active = false;
        this.spinAnim = null;

        if (r?.jackpot) {
          this.showToast(`JACKPOT! ${r.damage} hasar`);
        } else if (r?.damage > 0) {
          this.showToast(`${r.damage} hasar verildi`);
        } else {
          this.showToast("Zayıf vuruş");
        }
      }
    }

    this.syncBossVisualState();
  }

  handleTap(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (pointInRect(x, y, b)) {
        if (typeof b.onClick === "function") b.onClick();
        return;
      }
    }
  }

  pushButton(rect, onClick) {
    this.buttons.push({ ...rect, onClick });
  }

  draw(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    this.buttons.length = 0;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const bg =
      this.assets?.get?.("home_bg") ||
      this.assets?.get?.("xxx") ||
      this.assets?.get?.("stars_bg") ||
      null;

    if (bg) {
      const fit = fitCover(bg.width || 1, bg.height || 1, w, h);
      ctx.drawImage(bg, fit.x, fit.y, fit.w, fit.h);
      ctx.fillStyle = "rgba(0,0,0,0.70)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = "#090909";
      ctx.fillRect(0, 0, w, h);
    }

    if (Date.now() < this.flashUntil) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, 0, w, h);
    }

    const top = 92;
    const left = 24;
    const right = w - 24;
    const contentW = right - left;

    ctx.fillStyle = "#fff";
    ctx.font = "900 30px Arial";
    ctx.fillText("CLAN", left, 46);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "15px Arial";
    const clan = this.getClan();
    ctx.fillText(clan?.name || "İsimsiz Clan", left, 70);

    const tabs = ["genel", "boss", "üyeler", "kasa", "geliştirme", "log"];
    const tabY = top;
    const tabH = 40;
    let tx = left;
    for (const tab of tabs) {
      const tw = Math.max(76, ctx.measureText(tab.toUpperCase()).width + 26);
      ctx.fillStyle = this.tab === tab ? "rgba(255,180,0,0.22)" : "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, tx, tabY, tw, tabH, 12);
      ctx.strokeStyle = this.tab === tab ? "rgba(255,190,40,0.55)" : "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      strokeRoundRect(ctx, tx, tabY, tw, tabH, 12);

      ctx.fillStyle = this.tab === tab ? "#ffd166" : "#e5e7eb";
      ctx.font = "800 14px Arial";
      ctx.fillText(tab.toUpperCase(), tx + 14, tabY + 25);

      this.pushButton({ x: tx, y: tabY, w: tw, h: tabH }, () => {
        this.tab = tab;
        this.scrollY = 0;
      });

      tx += tw + 10;
    }

    const panelY = tabY + tabH + 16;
    const panelH = h - panelY - 24;

    ctx.save();
    roundRectPath(ctx, left, panelY, contentW, panelH, 22);
    ctx.clip();

    ctx.fillStyle = "rgba(8,8,10,0.82)";
    ctx.fillRect(left, panelY, contentW, panelH);

    const innerX = left + 18;
    let y = panelY + 18 - this.scrollY;
    const maxY = panelY + panelH - 18;

    if (this.tab === "boss") {
      y = this.drawBossTab(ctx, innerX, y, contentW - 36, maxY);
    } else {
      y = this.drawOtherTab(ctx, innerX, y, contentW - 36, maxY);
    }

    ctx.restore();

    const contentHeight = Math.max(0, y - (panelY + 18 - this.scrollY));
    this.maxScroll = Math.max(0, contentHeight - (panelH - 36));

    if (this.maxScroll > 0) {
      const barH = Math.max(50, (panelH - 16) * ((panelH - 16) / (contentHeight + 1)));
      const trackY = panelY + 8;
      const trackH = panelH - 16;
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const barY = trackY + (trackH - barH) * ratio;

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, right - 8, trackY, 4, trackH, 3);
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      fillRoundRect(ctx, right - 8, barY, 4, barH, 3);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(w - 40, ctx.measureText(this.toastText).width + 36);
      const tx0 = (w - tw) / 2;
      const ty0 = h - 86;
      ctx.fillStyle = "rgba(10,10,12,0.92)";
      fillRoundRect(ctx, tx0, ty0, tw, 42, 14);
      ctx.strokeStyle = "rgba(255,180,0,0.35)";
      strokeRoundRect(ctx, tx0, ty0, tw, 42, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "700 15px Arial";
      ctx.fillText(this.toastText, tx0 + 18, ty0 + 26);
    }

    ctx.restore();
  }

  drawCard(ctx, x, y, w, h, title, subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, h, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, x, y, w, h, 18);

    ctx.fillStyle = "#fff";
    ctx.font = "800 18px Arial";
    ctx.fillText(title, x + 16, y + 28);

    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "14px Arial";
      ctx.fillText(subtitle, x + 16, y + 50);
    }
  }

  drawBossTab(ctx, x, y, w) {
    const boss = this.getBoss();
    const clan = this.getClan();
    const playerName = safePlayerName(this.store);

    this.drawCard(
      ctx,
      x,
      y,
      w,
      108,
      boss?.name || "Clan Boss",
      "Slot makinesini döndür, ikon kombinasyonlarına göre boss'a hasar ver."
    );

    const hpPct = clamp((boss?.hp || 0) / Math.max(1, boss?.maxHp || 1), 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, x + 16, y + 68, w - 32, 18, 9);
    ctx.fillStyle = hpPct > 0.4 ? "#ef4444" : "#f97316";
    fillRoundRect(ctx, x + 16, y + 68, (w - 32) * hpPct, 18, 9);

    ctx.fillStyle = "#fff";
    ctx.font = "700 13px Arial";
    ctx.fillText(`HP: ${shortNumber(boss?.hp || 0)} / ${shortNumber(boss?.maxHp || 0)}`, x + 16, y + 100);

    y += 124;

    const slotH = 290;
    this.drawCard(ctx, x, y, w, slotH, "BOSS SLOT", "Yumruk, tekme, tokat, kafa");

    const reelW = Math.min(118, (w - 68) / 3);
    const reelGap = 12;
    const reelsTotal = reelW * 3 + reelGap * 2;
    const reelX = x + (w - reelsTotal) / 2;
    const reelY = y + 62;
    const reelH = 120;

    for (let i = 0; i < 3; i++) {
      const rx = reelX + i * (reelW + reelGap);

      ctx.fillStyle = "rgba(0,0,0,0.42)";
      fillRoundRect(ctx, rx, reelY, reelW, reelH, 20);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, rx, reelY, reelW, reelH, 20);

      const reel = this.reels[i] || { index: 0, offset: 0 };
      const symbolIndex =
        ((Math.round(reel.offset || reel.index || 0) % SLOT_ORDER.length) + SLOT_ORDER.length) %
        SLOT_ORDER.length;
      const symbolKey = SLOT_ORDER[symbolIndex];
      const symbol = SLOT_SYMBOLS[symbolKey];

      ctx.fillStyle = symbol.accent;
      fillRoundRect(ctx, rx + 10, reelY + 10, reelW - 20, reelH - 20, 18);

      ctx.fillStyle = "#fff";
      ctx.font = "700 42px Arial";
      ctx.textAlign = "center";
      ctx.fillText(symbol.emoji, rx + reelW / 2, reelY + 62);

      ctx.font = "900 14px Arial";
      ctx.fillText(symbol.label, rx + reelW / 2, reelY + 94);
      ctx.textAlign = "left";
    }

    const spinBtn = {
      x: x + 18,
      y: y + slotH - 68,
      w: w - 36,
      h: 44,
    };

    const disabled = !!this.spinAnim?.active || Number(boss?.spinsLeft || 0) <= 0;
    ctx.fillStyle = disabled ? "rgba(255,255,255,0.12)" : "rgba(255,180,0,0.92)";
    fillRoundRect(ctx, spinBtn.x, spinBtn.y, spinBtn.w, spinBtn.h, 14);

    ctx.fillStyle = disabled ? "rgba(255,255,255,0.65)" : "#111";
    ctx.font = "900 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      this.spinAnim?.active ? "DÖNÜYOR..." : `SPIN (${boss?.spinsLeft || 0} hak)`,
      spinBtn.x + spinBtn.w / 2,
      spinBtn.y + 28
    );
    ctx.textAlign = "left";

    this.pushButton(spinBtn, () => {
      if (!disabled) this.spinBoss();
    });

    y += slotH + 16;

    this.drawCard(ctx, x, y, w, 142, "Son Sonuç", "Son spin bilgisi");
    const last = boss?.lastResult || null;
    const symbols = last?.symbols || ["punch", "kick", "slap"];

    let sx = x + 18;
    for (const key of symbols) {
      const sym = SLOT_SYMBOLS[key] || SLOT_SYMBOLS.punch;
      ctx.fillStyle = sym.accent;
      fillRoundRect(ctx, sx, y + 62, 76, 52, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "700 26px Arial";
      ctx.textAlign = "center";
      ctx.fillText(sym.emoji, sx + 38, y + 34 + 28);
      ctx.textAlign = "left";
      sx += 88;
    }

    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Arial";
    ctx.fillText(`Hasar: ${Math.floor(last?.damage || 0)}`, x + 18, y + 126);
    ctx.fillText(`Oyuncu: ${last?.playerName || playerName}`, x + 136, y + 126);
    ctx.fillText(`Combo: ${last?.comboLabel || "-"}`, x + 320, y + 126);

    y += 158;

    this.drawCard(ctx, x, y, w, 156, "Raid Bilgisi", "Clan toplam performansı");
    const totalDamage = Number(clan?.bossStats?.totalDamage || 0);
    const todayDamage = Number(clan?.bossStats?.todayDamage || 0);
    const highestHit = Number(clan?.bossStats?.highestHit || 0);

    ctx.fillStyle = "#fff";
    ctx.font = "700 15px Arial";
    ctx.fillText(`Toplam hasar: ${shortNumber(totalDamage)}`, x + 18, y + 60);
    ctx.fillText(`Bugünkü hasar: ${shortNumber(todayDamage)}`, x + 18, y + 88);
    ctx.fillText(`En yüksek vuruş: ${shortNumber(highestHit)}`, x + 18, y + 116);
    ctx.fillText(`Sen: ${playerName}`, x + 18, y + 144);

    y += 172;
    return y;
  }

  drawOtherTab(ctx, x, y, w) {
    const clan = this.getClan();

    if (this.tab === "genel") {
      this.drawCard(ctx, x, y, w, 164, "Clan Genel", "Temel bilgiler");
      ctx.fillStyle = "#fff";
      ctx.font = "700 15px Arial";
      ctx.fillText(`Clan adı: ${clan?.name || "-"}`, x + 18, y + 62);
      ctx.fillText(`Seviye: ${Number(clan?.level || 1)}`, x + 18, y + 90);
      ctx.fillText(`Üye sayısı: ${Number(clan?.memberCount || 1)}`, x + 18, y + 118);
      ctx.fillText(`Kasa: ${formatMoney(Number(clan?.bank || 0))}`, x + 18, y + 146);
      y += 180;
    } else if (this.tab === "üyeler") {
      const members = Array.isArray(clan?.members) ? clan.members : [];
      this.drawCard(ctx, x, y, w, 72 + members.length * 42, "Üyeler", "Clan kadrosu");

      let my = y + 60;
      for (const m of members) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        fillRoundRect(ctx, x + 12, my, w - 24, 32, 10);
        ctx.fillStyle = "#fff";
        ctx.font = "700 14px Arial";
        ctx.fillText(m.name || "Player", x + 24, my + 21);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(getRoleLabel(m.role || "member"), x + 220, my + 21);
        my += 42;
      }
      y = my + 12;
    } else if (this.tab === "kasa") {
      this.drawCard(ctx, x, y, w, 132, "Clan Kasa", "Bağış ve rezerv");
      ctx.fillStyle = "#fff";
      ctx.font = "700 15px Arial";
      ctx.fillText(`Toplam bakiye: ${formatMoney(Number(clan?.bank || 0))}`, x + 18, y + 62);
      ctx.fillText(`Günlük gelir: ${formatMoney(Number(clan?.dailyIncome || 0))}`, x + 18, y + 90);
      ctx.fillText(`Yedek fon: ${formatMoney(Number(clan?.reserve || 0))}`, x + 18, y + 118);
      y += 148;
    } else if (this.tab === "geliştirme") {
      const upgrades = Array.isArray(clan?.upgrades) ? clan.upgrades : [];
      const cardH = 80 + upgrades.length * 48;
      this.drawCard(ctx, x, y, w, cardH, "Geliştirmeler", "Aktif clan bonusları");

      let uy = y + 60;
      for (const up of upgrades) {
        const label = getUpgradeLabel(up.id);
        const cost = getUpgradeCost(up.id, Number(up.level || 0));
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        fillRoundRect(ctx, x + 12, uy, w - 24, 36, 10);
        ctx.fillStyle = "#fff";
        ctx.font = "700 14px Arial";
        ctx.fillText(`${label} Lv.${Number(up.level || 0)}`, x + 24, uy + 23);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(`Sonraki: ${formatMoney(cost)}`, x + 220, uy + 23);
        uy += 48;
      }
      y = uy + 12;
    } else if (this.tab === "log") {
      const logs = Array.isArray(clan?.logs) ? clan.logs.slice(0, 20) : [];
      const cardH = 80 + logs.length * 40;
      this.drawCard(ctx, x, y, w, cardH, "Log", "Son clan hareketleri");
      let ly = y + 58;
      for (const log of logs) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        fillRoundRect(ctx, x + 12, ly, w - 24, 30, 10);
        ctx.fillStyle = "#fff";
        ctx.font = "13px Arial";
        ctx.fillText(log?.text || "-", x + 24, ly + 20);
        ly += 40;
      }
      y = ly + 12;
    }

    return y;
  }
}
