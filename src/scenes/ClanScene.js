import { ClanSystem } from "../clan/ClanSystem.js";
import {
  formatMoney,
  getRoleLabel,
  getUpgradeCost,
  getUpgradeLabel,
} from "../clan/ClanUtils.js";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export class ClanScene {
  constructor({ engine, sceneManager, assets, input, store, i18n, scenes }) {
    this.engine = engine;
    this.sceneManager = sceneManager || scenes || null;
    this.assets = assets;
    this.input = input;
    this.store = store;
    this.i18n = i18n;
    this.scenes = scenes || sceneManager || null;

    this.activeTab = "genel";

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.buttons = [];
    this.tabButtons = [];
    this.rowHits = [];

    this.bossUi = {
      lastSpinId: null,
      animating: false,
      spinStartAt: 0,
      reelStopAt: [0, 0, 0],
      previewSymbols: ["👊", "🔪", "🔫"],
      finalSymbols: ["?", "?", "?"],
      flashUntil: 0,
      comboText: "",
      damageText: "",
    };
  }

  enter() {
    this.activeTab = "genel";
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
  }

  onEnter() {
    this.enter();
  }

  exit() {}

  onExit() {
    this.exit();
  }

  _go(key) {
    if (this.scenes?.go) {
      this.scenes.go(key);
      return;
    }
    if (this.sceneManager?.go) {
      this.sceneManager.go(key);
      return;
    }
    if (this.sceneManager?.goTo) {
      this.sceneManager.goTo(key);
    }
  }

  _safe(ctx) {
    const s = this.store.get();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);
    return s?.ui?.safe || { x: 0, y: 0, w: W, h: H };
  }

  _layout(ctx) {
    const safe = this._safe(ctx);
    const s = this.store.get();

    const topReserved = Number(s?.ui?.hudReservedTop || 118);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    const pageX = safe.x + 14;
    const pageY = safe.y + topReserved;
    const pageW = safe.w - 28;
    const pageH = Math.max(220, safe.h - topReserved - bottomReserved);

    const headerH = 96;
    const tabsH = 54;
    const contentY = pageY + headerH + tabsH + 12;
    const contentH = Math.max(120, pageH - headerH - tabsH - 12);

    return {
      safe,
      pageX,
      pageY,
      pageW,
      pageH,
      headerH,
      tabsH,
      contentX: pageX,
      contentY,
      contentW: pageW,
      contentH,
    };
  }

  _updateBossAnimation() {
    if (this.activeTab !== "boss") return;

    const boss = ClanSystem.getBoss ? ClanSystem.getBoss(this.store) : null;
    if (!boss) return;

    const lastSpin = boss.lastSpin || null;
    if (lastSpin && lastSpin.id !== this.bossUi.lastSpinId) {
      const now = Date.now();
      this.bossUi.lastSpinId = lastSpin.id;
      this.bossUi.animating = true;
      this.bossUi.spinStartAt = now;
      this.bossUi.reelStopAt = [now + 450, now + 900, now + 1350];
      this.bossUi.finalSymbols = lastSpin.reels?.slice?.(0, 3) || ["?", "?", "?"];
      this.bossUi.comboText = lastSpin.comboName || "";
      this.bossUi.damageText = `${formatMoney(lastSpin.finalDamage || 0)} DMG`;
      this.bossUi.flashUntil = now + 1900;
    }

    if (!this.bossUi.animating) return;

    const now = Date.now();
    const symbolPool = (ClanSystem.getBossSymbols?.() || []).map((x) => x.label).filter(Boolean);
    const fallbackPool = symbolPool.length ? symbolPool : ["👊", "🔪", "🔫", "💣", "🛡️", "☠️", "⭐", "💰"];

    for (let i = 0; i < 3; i++) {
      if (now < this.bossUi.reelStopAt[i]) {
        const seed = Math.floor(now / 70 + i * 17) % fallbackPool.length;
        this.bossUi.previewSymbols[i] = fallbackPool[seed];
      } else {
        this.bossUi.previewSymbols[i] = this.bossUi.finalSymbols[i] || "?";
      }
    }

    if (now >= this.bossUi.reelStopAt[2]) {
      this.bossUi.animating = false;
      this.bossUi.previewSymbols = this.bossUi.finalSymbols.slice(0, 3);
    }
  }

  _buildStaticButtons(ctx, clan) {
    const L = this._layout(ctx);

    this.buttons = [];
    this.tabButtons = [];
    this.rowHits = [];

    this.buttons.push({
      id: "back",
      rect: { x: L.pageX + 14, y: L.pageY + 14, w: 96, h: 34 },
      text: "GERİ",
      onClick: () => this._go("home"),
    });

    this.buttons.push({
      id: "leave",
      rect: { x: L.pageX + L.pageW - 150, y: L.pageY + 14, w: 136, h: 34 },
      text: "CLAN'DAN ÇIK",
      onClick: () => {
        ClanSystem.leaveClan(this.store);
        if (ClanSystem.hasClan(this.store)) {
          this.activeTab = "genel";
          this.scrollY = 0;
        } else {
          this._go("clan_create");
        }
      },
    });

    const tabs = ClanSystem.getTabList
      ? ClanSystem.getTabList()
      : ["genel", "uyeler", "kasa", "gelistirme", "boss", "log"];

    const tabGap = 8;
    const availableW = L.pageW - 28 - (tabs.length - 1) * tabGap;
    const tabW = Math.max(84, Math.floor(availableW / tabs.length));

    tabs.forEach((tab, i) => {
      const x = L.pageX + 14 + i * (tabW + tabGap);
      const y = L.pageY + L.headerH + 8;

      this.tabButtons.push({
        id: `tab_${tab}`,
        tab,
        rect: { x, y, w: tabW, h: 40 },
        text: this.getTabLabel(tab),
        onClick: () => {
          this.activeTab = tab;
          this.scrollY = 0;
        },
      });
    });

    if (!clan) return;

    if (this.activeTab === "kasa") {
      const baseY = L.contentY + L.contentH - 58;
      const startX = L.contentX + 18;
      const donateButtons = [
        { id: "donate_1000", text: "$1.000 YATIR", amount: 1000 },
        { id: "donate_5000", text: "$5.000 YATIR", amount: 5000 },
        { id: "donate_10000", text: "$10.000 YATIR", amount: 10000 },
      ];

      donateButtons.forEach((b, i) => {
        this.buttons.push({
          id: b.id,
          rect: { x: startX + i * 166, y: baseY, w: 150, h: 40 },
          text: b.text,
          onClick: () => {
            ClanSystem.donateToClan(this.store, b.amount);
          },
        });
      });
    }

    if (this.activeTab === "uyeler") {
      this.buttons.push({
        id: "add_mock_member",
        rect: {
          x: L.contentX + L.contentW - 190,
          y: L.contentY + L.contentH - 58,
          w: 170,
          h: 40,
        },
        text: "ÖRNEK ÜYE EKLE",
        onClick: () => {
          if (typeof ClanSystem.addMockMember === "function") {
            ClanSystem.addMockMember(this.store);
          }
        },
      });
    }

    if (this.activeTab === "gelistirme") {
      const upgradeTypes = ["memberCap", "vault", "income", "attack", "defense"];

      upgradeTypes.forEach((type, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cardW = Math.min(320, Math.floor((L.contentW - 54) / 2));
        const x = L.contentX + 18 + col * (cardW + 18);
        const y = L.contentY + 160 + row * 110 - this.scrollY;

        this.buttons.push({
          id: `upgrade_${type}`,
          rect: { x: x + cardW - 130, y: y + 56, w: 110, h: 34 },
          text: "YÜKSELT",
          onClick: () => {
            ClanSystem.upgrade(this.store, type);
          },
        });
      });
    }

    if (this.activeTab === "boss") {
      const boss = ClanSystem.getBoss ? ClanSystem.getBoss(this.store) : null;
      const spinsLeft = ClanSystem.getPlayerBossSpinsLeft
        ? ClanSystem.getPlayerBossSpinsLeft(this.store)
        : 0;

      const machineW = Math.min(760, L.contentW - 36);
      const machineX = L.contentX + (L.contentW - machineW) / 2;

      this.buttons.push({
        id: "boss_spin",
        rect: { x: machineX + machineW - 184, y: L.contentY + 328, w: 160, h: 52 },
        text: boss?.status === "dead" ? "BEKLENİYOR" : `SPIN (${spinsLeft})`,
        onClick: () => {
          if (!boss || boss.status === "dead") return;
          if (typeof ClanSystem.spinBoss === "function") {
            ClanSystem.spinBoss(this.store);
          }
        },
      });
    }
  }

  getTabLabel(tab) {
    switch (tab) {
      case "genel":
        return "GENEL";
      case "uyeler":
        return "ÜYELER";
      case "kasa":
        return "KASA";
      case "gelistirme":
        return "GELİŞTİRME";
      case "boss":
        return "BOSS";
      case "log":
        return "LOG";
      default:
        return String(tab).toUpperCase();
    }
  }

  update() {
    const clan = ClanSystem.getClan(this.store);
    if (!clan) {
      this._go("clan_create");
      return;
    }

    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input?.isDown?.()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input?.justReleased?.()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      for (const btn of [...this.buttons, ...this.tabButtons]) {
        if (btn?.rect && pointInRect(px, py, btn.rect)) {
          btn.onClick?.();
          return;
        }
      }

      for (const hit of this.rowHits) {
        if (pointInRect(px, py, hit.rect)) {
          hit.onClick?.();
          return;
        }
      }
    }

    this._updateBossAnimation();
  }

  render(ctx) {
    const clan = ClanSystem.getClan(this.store);
    if (!clan) return;

    const L = this._layout(ctx);
    this._buildStaticButtons(ctx, clan);

    ctx.clearRect(0, 0, L.safe.w, L.safe.h);
    this.drawBackground(ctx, L.safe.w, L.safe.h);

    this.drawPanel(ctx, L.pageX, L.pageY, L.pageW, L.pageH, 22, "rgba(8,14,26,0.96)");
    this.drawPanel(ctx, L.pageX + 1, L.pageY + 1, L.pageW - 2, 96, 22, "rgba(16,26,48,0.98)");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${clan.name} [${clan.tag}]`, L.pageX + 22, L.pageY + 34);

    ctx.fillStyle = "#9cb2d9";
    ctx.font = "15px Arial";
    ctx.fillText(clan.description || "", L.pageX + 22, L.pageY + 58);

    const statCards = [
      { label: "Seviye", value: String(clan.level || 1) },
      { label: "Güç", value: String(clan.power || 0) },
      { label: "Üye", value: `${(clan.members || []).length}/${clan.limits?.members || 0}` },
      { label: "Kasa", value: `$${formatMoney(clan.bank || 0)}` },
    ];

    statCards.forEach((card, i) => {
      const cardW = Math.floor((L.pageW - 44 - 3 * 10) / 4);
      const x = L.pageX + 22 + i * (cardW + 10);
      const y = L.pageY + 64;

      this.drawPanel(ctx, x, y, cardW, 26, 10, "rgba(27,39,71,0.96)");

      ctx.fillStyle = "#8ea7d4";
      ctx.font = "12px Arial";
      ctx.fillText(`${card.label}:`, x + 10, y + 17);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial";
      ctx.fillText(card.value, x + Math.min(cardW - 54, 84), y + 17);
    });

    for (const btn of this.buttons) {
      const color =
        btn.id === "leave"
          ? "#8d2f3c"
          : btn.id === "back"
          ? "#2c3d63"
          : btn.id === "boss_spin"
          ? "#b6821b"
          : btn.id.startsWith("upgrade_")
          ? "#315fbe"
          : "#1d8f5a";
      this.drawButton(ctx, btn.rect, btn.text, color);
    }

    for (const tab of this.tabButtons) {
      const active = this.activeTab === tab.tab;
      this.drawButton(ctx, tab.rect, tab.text, active ? "#365a98" : "#1b2743");
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(L.contentX, L.contentY, L.contentW, L.contentH);
    ctx.clip();

    if (this.activeTab === "genel") this.renderGeneral(ctx, clan, L);
    if (this.activeTab === "uyeler") this.renderMembers(ctx, clan, L);
    if (this.activeTab === "kasa") this.renderBank(ctx, clan, L);
    if (this.activeTab === "gelistirme") this.renderUpgrades(ctx, clan, L);
    if (this.activeTab === "boss") this.renderBoss(ctx, clan, L);
    if (this.activeTab === "log") this.renderLogs(ctx, clan, L);

    ctx.restore();
  }

  renderGeneral(ctx, clan, L) {
    const contentH = 540;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW * 0.45, 260, 18, "rgba(18,27,49,0.98)");
    this.drawPanel(
      ctx,
      L.contentX + L.contentW * 0.45 + 30,
      y0 + 14,
      L.contentW * 0.45 - 12,
      260,
      18,
      "rgba(18,27,49,0.98)"
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Clan Bilgisi", L.contentX + 36, y0 + 46);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "18px Arial";
    ctx.fillText(`Sıralama: #${clan.rank || 0}`, L.contentX + 36, y0 + 86);
    ctx.fillText(`Bölge Sayısı: ${clan.territoryCount || 0}`, L.contentX + 36, y0 + 118);
    ctx.fillText(`XP: ${clan.xp || 0} / ${clan.xpNext || 0}`, L.contentX + 36, y0 + 150);
    ctx.fillText(`Savaş Aktif: ${(clan.wars?.active || []).length}`, L.contentX + 36, y0 + 182);
    ctx.fillText(`Geçmiş Savaş: ${(clan.wars?.history || []).length}`, L.contentX + 36, y0 + 214);

    ctx.fillStyle = "#25365f";
    ctx.fillRect(L.contentX + 36, y0 + 234, 280, 16);
    ctx.fillStyle = "#4f7dd1";
    const ratio = clan.xpNext > 0 ? Math.max(0, Math.min(1, clan.xp / clan.xpNext)) : 0;
    ctx.fillRect(L.contentX + 36, y0 + 234, 280 * ratio, 16);

    const panel2X = L.contentX + L.contentW * 0.45 + 48;
    const members = clan.members || [];
    const leaderCount = members.filter((m) => m.role === "leader").length;
    const officerCount = members.filter((m) => m.role === "officer").length;
    const memberCount = members.filter((m) => m.role === "member").length;
    const onlineCount = members.filter((m) => m.online).length;
    const topContributor = [...members].sort((a, b) => (b.contribution || 0) - (a.contribution || 0))[0];

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Rol Dağılımı", panel2X, y0 + 46);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "18px Arial";
    ctx.fillText(`Lider: ${leaderCount}`, panel2X, y0 + 86);
    ctx.fillText(`Yardımcı: ${officerCount}`, panel2X, y0 + 118);
    ctx.fillText(`Üye: ${memberCount}`, panel2X, y0 + 150);
    ctx.fillText(`Online: ${onlineCount}`, panel2X, y0 + 182);
    ctx.fillText(
      `En çok katkı: ${
        topContributor ? `${topContributor.name} ($${formatMoney(topContributor.contribution || 0)})` : "-"
      }`,
      panel2X,
      y0 + 214
    );
  }

  renderMembers(ctx, clan, L) {
    const members = clan.members || [];
    const rowH = 54;
    const contentH = 90 + members.length * rowH + 90;

    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    this.drawPanel(
      ctx,
      L.contentX + 18,
      y0 + 14,
      L.contentW - 36,
      62 + members.length * rowH,
      18,
      "rgba(18,27,49,0.98)"
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Üyeler", L.contentX + 34, y0 + 46);

    ctx.fillStyle = "#8ea7d4";
    ctx.font = "16px Arial";
    ctx.fillText("İsim", L.contentX + 34, y0 + 82);
    ctx.fillText("Rol", L.contentX + 210, y0 + 82);
    ctx.fillText("Seviye", L.contentX + 330, y0 + 82);
    ctx.fillText("Güç", L.contentX + 440, y0 + 82);
    ctx.fillText("Katkı", L.contentX + 550, y0 + 82);
    ctx.fillText("Durum", L.contentX + 700, y0 + 82);

    members.forEach((member, i) => {
      const y = y0 + 108 + i * rowH;

      ctx.fillStyle = i % 2 === 0 ? "rgba(24,36,68,0.98)" : "rgba(20,32,58,0.98)";
      ctx.fillRect(L.contentX + 28, y - 22, L.contentW - 56, 42);

      ctx.fillStyle = "#ffffff";
      ctx.font = "17px Arial";
      ctx.fillText(member.name || "-", L.contentX + 34, y);
      ctx.fillText(getRoleLabel(member.role), L.contentX + 210, y);
      ctx.fillText(String(member.level || 1), L.contentX + 330, y);
      ctx.fillText(String(member.power || 0), L.contentX + 440, y);
      ctx.fillText(`$${formatMoney(member.contribution || 0)}`, L.contentX + 550, y);
      ctx.fillText(member.online ? "Online" : "Offline", L.contentX + 700, y);

      if (member.id !== "player_main") {
        const kickRect = { x: L.contentX + L.contentW - 150, y: y - 18, w: 100, h: 34 };
        this.drawButton(ctx, kickRect, "AT", "#8d2f3c", 15);
        this.rowHits.push({
          rect: kickRect,
          onClick: () => {
            if (typeof ClanSystem.kickMember === "function") {
              ClanSystem.kickMember(this.store, member.id);
            }
          },
        });
      }
    });
  }

  renderBank(ctx, clan, L) {
    const state = this.store?.get?.() || {};
    const playerCash = Number(state.player?.cash || 0);

    const contentH = 420;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    const leftW = Math.floor((L.contentW - 54) * 0.42);
    const rightW = L.contentW - leftW - 54;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, leftW, 220, 18, "rgba(18,27,49,0.98)");
    this.drawPanel(ctx, L.contentX + leftW + 36, y0 + 14, rightW, 220, 18, "rgba(18,27,49,0.98)");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Kasa Durumu", L.contentX + 34, y0 + 46);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "18px Arial";
    ctx.fillText(`Clan Kasası: $${formatMoney(clan.bank || 0)}`, L.contentX + 34, y0 + 84);
    ctx.fillText(
      `Kasa Kapasitesi: $${formatMoney(clan.limits?.vaultCapacity || 0)}`,
      L.contentX + 34,
      y0 + 116
    );
    ctx.fillText(`Oyuncu Parası: $${formatMoney(playerCash)}`, L.contentX + 34, y0 + 148);

    ctx.fillStyle = "#25365f";
    ctx.fillRect(L.contentX + 34, y0 + 172, Math.min(300, leftW - 50), 16);
    ctx.fillStyle = "#53a96f";
    const ratio = clan.limits?.vaultCapacity > 0 ? clan.bank / clan.limits.vaultCapacity : 0;
    ctx.fillRect(
      L.contentX + 34,
      y0 + 172,
      Math.min(300, leftW - 50) * Math.max(0, Math.min(1, ratio)),
      16
    );

    const tx = L.contentX + leftW + 54;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Bilgi", tx, y0 + 46);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "17px Arial";
    ctx.fillText("Kasadaki para geliştirmeler için kullanılır.", tx, y0 + 84);
    ctx.fillText("Aşağıdaki butonlarla hızlı bağış yapabilirsin.", tx, y0 + 116);
    ctx.fillText("Kasa doluysa fazla para yatırılmaz.", tx, y0 + 148);
  }

  renderUpgrades(ctx, clan, L) {
    const upgradeTypes = ["memberCap", "vault", "income", "attack", "defense"];
    const contentH = 520;

    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW - 36, 470, 18, "rgba(18,27,49,0.98)");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Geliştirmeler", L.contentX + 34, y0 + 46);

    upgradeTypes.forEach((type, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardW = Math.min(320, Math.floor((L.contentW - 54) / 2));
      const x = L.contentX + 26 + col * (cardW + 18);
      const y = y0 + 84 + row * 110;
      const level = clan.upgrades?.[type] || 0;
      const cost = getUpgradeCost(type, level);

      this.drawPanel(ctx, x, y, cardW, 88, 14, "rgba(24,36,68,0.98)");

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Arial";
      ctx.fillText(getUpgradeLabel(type), x + 16, y + 28);

      ctx.fillStyle = "#b8c8ea";
      ctx.font = "16px Arial";
      ctx.fillText(`Seviye: ${level}`, x + 16, y + 52);
      ctx.fillText(`Maliyet: $${formatMoney(cost)}`, x + 16, y + 74);
    });
  }

  renderBoss(ctx, clan, L) {
    const boss = ClanSystem.getBoss ? ClanSystem.getBoss(this.store) : null;
    const leaderboard = ClanSystem.getBossLeaderboard
      ? ClanSystem.getBossLeaderboard(this.store)
      : [];
    const spinsLeft = ClanSystem.getPlayerBossSpinsLeft
      ? ClanSystem.getPlayerBossSpinsLeft(this.store)
      : 0;

    const contentH = 980;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    if (!boss) {
      this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW - 36, 180, 18, "rgba(18,27,49,0.98)");
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px Arial";
      ctx.fillText("Boss bulunamadı", L.contentX + 36, y0 + 70);
      return;
    }

    const machineW = Math.min(760, L.contentW - 36);
    const machineX = L.contentX + (L.contentW - machineW) / 2;
    const machineY = y0 + 18;
    const machineH = 430;

    this.drawSlotMachineShell(ctx, machineX, machineY, machineW, machineH);

    ctx.fillStyle = "#ffe29d";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BOSS SLOT MACHINE", machineX + machineW / 2, machineY + 42);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText(`${boss.name}`, machineX + machineW / 2, machineY + 76);

    ctx.fillStyle = "#d4c49e";
    ctx.font = "15px Arial";
    ctx.fillText(`Lv.${boss.level || 1} • ${boss.title || "Clan Boss"}`, machineX + machineW / 2, machineY + 98);

    const hpRatio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
    this.drawProgressBar(
      ctx,
      machineX + 34,
      machineY + 116,
      machineW - 68,
      26,
      hpRatio,
      boss.status === "dead" ? "#7a2e2e" : "#b83a3a",
      "rgba(0,0,0,0.40)"
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.fillText(
      `${Number(boss.hp || 0).toLocaleString("tr-TR")} / ${Number(boss.maxHp || 0).toLocaleString("tr-TR")} HP`,
      machineX + machineW / 2,
      machineY + 133
    );

    const reelW = 150;
    const reelH = 120;
    const reelGap = 18;
    const totalReelW = reelW * 3 + reelGap * 2;
    const reelX = machineX + (machineW - totalReelW) / 2;
    const reelY = machineY + 172;

    const symbols = this.bossUi.previewSymbols || ["?", "?", "?"];
    for (let i = 0; i < 3; i++) {
      const x = reelX + i * (reelW + reelGap);
      const activeGlow = this.bossUi.animating && Date.now() < this.bossUi.reelStopAt[i];
      this.drawSingleReel(ctx, x, reelY, reelW, reelH, symbols[i], activeGlow);
    }

    const leverX = machineX + machineW - 58;
    const leverY = machineY + 190;
    this.drawLever(ctx, leverX, leverY, this.bossUi.animating);

    ctx.fillStyle = "#f4e9c8";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Günlük Spin: ${spinsLeft}/${boss.dailySpinLimit || 5}`, machineX + 34, machineY + 322);
    ctx.fillText(`Spin Ücreti: $${formatMoney(boss.dailySpinCostCash || 0)}`, machineX + 34, machineY + 348);
    ctx.fillText(`Toplam Hasar: ${formatMoney(boss.totalDamage || 0)}`, machineX + 34, machineY + 374);

    const comboNow = boss.lastSpin?.comboName || this.bossUi.comboText || "-";
    const dmgNow =
      boss.lastSpin?.finalDamage != null
        ? `${formatMoney(boss.lastSpin.finalDamage || 0)} DMG`
        : this.bossUi.damageText || "-";

    ctx.fillStyle = Date.now() < this.bossUi.flashUntil ? "#ffe27c" : "#f4e9c8";
    ctx.font = "bold 17px Arial";
    ctx.fillText(`Combo: ${comboNow}`, machineX + 300, machineY + 322);
    ctx.fillText(`Hasar: ${dmgNow}`, machineX + 300, machineY + 348);

    if (boss.lastSpin?.bonusCash > 0) {
      ctx.fillText(
        `Bonus Para: $${formatMoney(boss.lastSpin.bonusCash || 0)}`,
        machineX + 300,
        machineY + 374
      );
    }

    if (boss.status === "dead") {
      const remainMs = Math.max(0, Number(boss.respawnAt || 0) - Date.now());
      const min = Math.floor(remainMs / 60000);
      const sec = Math.floor((remainMs % 60000) / 1000);
      ctx.fillStyle = "#ffb4b4";
      ctx.font = "bold 16px Arial";
      ctx.fillText(
        `Boss öldü • Yeniden doğuş: ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
        machineX + 34,
        machineY + 404
      );
    }

    this.drawPanel(ctx, L.contentX + 18, y0 + 472, L.contentW - 36, 188, 18, "rgba(18,27,49,0.98)");
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Ödül ve Savaş Bilgisi", L.contentX + 34, y0 + 504);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "17px Arial";
    ctx.fillText(`Ödül Havuzu: $${formatMoney(boss.rewardPoolCash || 0)}`, L.contentX + 34, y0 + 538);
    ctx.fillText(`Clan XP Ödülü: ${formatMoney(boss.rewardPoolClanXp || 0)}`, L.contentX + 34, y0 + 566);
    ctx.fillText(`Boss Kill Sayısı: ${formatMoney(boss.killCount || 0)}`, L.contentX + 34, y0 + 594);
    ctx.fillText(`Durum: ${boss.status === "dead" ? "ÖLDÜ" : "AKTİF"}`, L.contentX + 34, y0 + 622);

    this.drawPanel(ctx, L.contentX + 18, y0 + 684, L.contentW - 36, 250, 18, "rgba(18,27,49,0.98)");
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Hasar Sıralaması", L.contentX + 34, y0 + 716);

    if (!leaderboard.length) {
      ctx.fillStyle = "#c7d4ee";
      ctx.font = "17px Arial";
      ctx.fillText("Henüz hasar kaydı yok.", L.contentX + 34, y0 + 752);
    } else {
      const show = leaderboard.slice(0, 7);
      show.forEach((row, i) => {
        const ry = y0 + 754 + i * 26;
        ctx.fillStyle = i % 2 === 0 ? "rgba(24,36,68,0.98)" : "rgba(20,32,58,0.98)";
        ctx.fillRect(L.contentX + 28, ry - 18, L.contentW - 56, 22);

        ctx.fillStyle = "#ffffff";
        ctx.font = "16px Arial";
        ctx.fillText(`#${i + 1} ${row.name || "-"}`, L.contentX + 36, ry);
        ctx.fillText(`Dmg: ${formatMoney(row.totalDamage || 0)}`, L.contentX + 290, ry);
        ctx.fillText(`Spin: ${formatMoney(row.spins || 0)}`, L.contentX + 480, ry);
        ctx.fillText(`En İyi: ${formatMoney(row.bestHit || 0)}`, L.contentX + 620, ry);
      });
    }
  }

  renderLogs(ctx, clan, L) {
    const logs = clan.logs || [];
    const contentH = 120 + Math.max(1, logs.length) * 34;

    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW - 36, contentH - 20, 18, "rgba(18,27,49,0.98)");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Son İşlemler", L.contentX + 34, y0 + 46);

    const visible = logs.length ? logs : [{ text: "Henüz log yok." }];

    visible.forEach((log, i) => {
      const y = y0 + 82 + i * 30;
      ctx.fillStyle = "#d5e1f8";
      ctx.font = "17px Arial";
      ctx.fillText(`• ${log.text}`, L.contentX + 34, y);
    });
  }

  drawBackground(ctx, w, h) {
    ctx.fillStyle = "#07101d";
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(18,28,50,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let i = 0; i < w; i += 28) {
      ctx.fillRect(i, 0, 1, h);
    }
    for (let j = 0; j < h; j += 28) {
      ctx.fillRect(0, j, w, 1);
    }
  }

  drawSlotMachineShell(ctx, x, y, w, h) {
    const outer = ctx.createLinearGradient(x, y, x, y + h);
    outer.addColorStop(0, "#6d4d15");
    outer.addColorStop(0.2, "#c79b33");
    outer.addColorStop(0.5, "#5f4212");
    outer.addColorStop(0.8, "#b98926");
    outer.addColorStop(1, "#4b330f");
    ctx.fillStyle = outer;
    this.roundRect(ctx, x, y, w, h, 24);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    this.roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 20);
    ctx.fill();

    const top = ctx.createLinearGradient(x, y, x, y + 110);
    top.addColorStop(0, "rgba(255,255,255,0.18)");
    top.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = top;
    this.roundRect(ctx, x + 12, y + 12, w - 24, 120, 18);
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const bx = x + 24 + i * ((w - 48) / 11);
      const on = Math.floor(Date.now() / 180 + i) % 2 === 0;
      ctx.fillStyle = on ? "#ffd85e" : "rgba(255,216,94,0.28)";
      ctx.beginPath();
      ctx.arc(bx, y + 18, 4.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSingleReel(ctx, x, y, w, h, symbol, activeGlow) {
    const frame = ctx.createLinearGradient(x, y, x, y + h);
    frame.addColorStop(0, "#d7d3c8");
    frame.addColorStop(1, "#868178");
    ctx.fillStyle = frame;
    this.roundRect(ctx, x, y, w, h, 18);
    ctx.fill();

    ctx.fillStyle = activeGlow ? "rgba(255,216,94,0.25)" : "rgba(255,255,255,0.08)";
    this.roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 14);
    ctx.fill();

    ctx.fillStyle = "#11141a";
    this.roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 12);
    ctx.fill();

    if (activeGlow) {
      ctx.strokeStyle = "#ffd85e";
      ctx.lineWidth = 2;
      this.roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 12);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x + 16, y + 18, w - 32, 20);
    ctx.fillRect(x + 16, y + h - 38, w - 32, 14);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 54px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol || "?", x + w / 2, y + h / 2 + 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawLever(ctx, x, y, animating) {
    ctx.fillStyle = "#c79b33";
    this.roundRect(ctx, x, y, 18, 96, 8);
    ctx.fill();

    ctx.fillStyle = "#7c5e1d";
    this.roundRect(ctx, x + 6, y + 12, 6, 68, 3);
    ctx.fill();

    const ballY = animating ? y + 74 : y + 18;
    ctx.fillStyle = "#d64444";
    ctx.beginPath();
    ctx.arc(x + 9, ballY, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(x + 4, ballY - 5, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawProgressBar(ctx, x, y, w, h, ratio, fillColor, bgColor) {
    ctx.fillStyle = bgColor;
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();

    ctx.fillStyle = fillColor;
    this.roundRect(ctx, x, y, Math.max(0, w * ratio), h, h / 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    ctx.stroke();
  }

  drawButton(ctx, rect, text, color = "#2c3d63", fontSize = 16) {
    this.drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, 12, color);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawPanel(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
