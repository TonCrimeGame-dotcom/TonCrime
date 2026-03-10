import { ClanSystem } from "../systems/clan/ClanSystem.js";
import {
  formatMoney,
  getRoleLabel,
  getUpgradeCost,
  getUpgradeLabel,
} from "../systems/clan/ClanUtils.js";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export class ClanScene {
  constructor({ engine, sceneManager, assets, input, store, i18n, scenes }) {
    this.engine = engine;
    this.sceneManager = sceneManager || scenes;
    this.assets = assets;
    this.input = input;
    this.store = store;
    this.i18n = i18n;

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
  }

  enter() {
    this.activeTab = "genel";
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
  }

  onEnter() {
    this.enter();
  }

  exit() {}

  onExit() {
    this.exit();
  }

  _go(key) {
    if (this.sceneManager?.go) return this.sceneManager.go(key);
    if (this.sceneManager?.goTo) return this.sceneManager.goTo(key);
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

  _buildStaticButtons(ctx, clan) {
    const L = this._layout(ctx);

    this.buttons = [];
    this.tabButtons = [];

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

    const tabs = ClanSystem.getTabList();
    const tabGap = 10;
    const tabW = Math.min(170, Math.floor((L.pageW - 28 - (tabs.length - 1) * tabGap) / tabs.length));

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
      const btns = [
        { id: "donate_1000", text: "$1.000 YATIR", amount: 1000 },
        { id: "donate_5000", text: "$5.000 YATIR", amount: 5000 },
        { id: "donate_10000", text: "$10.000 YATIR", amount: 10000 },
      ];

      btns.forEach((b, i) => {
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
        rect: { x: L.contentX + L.contentW - 190, y: L.contentY + L.contentH - 58, w: 170, h: 40 },
        text: "ÖRNEK ÜYE EKLE",
        onClick: () => {
          ClanSystem.addMockMember(this.store);
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

    const pointer = this.input?.pointer || this.input?.mouse || { x: 0, y: 0 };
    const justPressed =
      this.input?.justPressed?.() ||
      this.input?.isJustPressed?.("pointer") ||
      this.input?.isJustPressed?.("mouseLeft") ||
      this.input?.mousePressed;

    const isDown =
      this.input?.isDown?.() ||
      this.input?.isPressed?.("pointer") ||
      this.input?.mouseDown ||
      false;

    const justReleased =
      this.input?.justReleased?.() ||
      this.input?.isJustReleased?.("pointer") ||
      this.input?.isJustReleased?.("mouseLeft") ||
      false;

    if (justPressed) {
      this.dragging = true;
      this.downY = pointer.y;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && isDown) {
      const dy = pointer.y - this.downY;
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && justReleased) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      const px = pointer.x;
      const py = pointer.y;

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
  }

  render(ctx) {
    const clan = ClanSystem.getClan(this.store);
    if (!clan) return;

    const L = this._layout(ctx);
    this._buildStaticButtons(ctx, clan);
    this.rowHits = [];

    ctx.clearRect(0, 0, L.safe.w, L.safe.h);
    ctx.fillStyle = "#09101d";
    ctx.fillRect(0, 0, L.safe.w, L.safe.h);

    this.drawPanel(ctx, L.pageX, L.pageY, L.pageW, L.pageH, 22, "#10182c");
    this.drawPanel(ctx, L.pageX + 1, L.pageY + 1, L.pageW - 2, 96, 22, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.fillText(`${clan.name} [${clan.tag}]`, L.pageX + 22, L.pageY + 34);

    ctx.fillStyle = "#9cb2d9";
    ctx.font = "15px Arial";
    ctx.fillText(clan.description || "", L.pageX + 22, L.pageY + 58);

    const statCards = [
      { label: "Seviye", value: String(clan.level) },
      { label: "Güç", value: String(clan.power) },
      { label: "Üye", value: `${clan.members.length}/${clan.limits.members}` },
      { label: "Kasa", value: `$${formatMoney(clan.bank)}` },
    ];

    statCards.forEach((card, i) => {
      const cardW = Math.floor((L.pageW - 44 - 3 * 10) / 4);
      const x = L.pageX + 22 + i * (cardW + 10);
      const y = L.pageY + 64;
      this.drawPanel(ctx, x, y, cardW, 26, 10, "#17233f");
      ctx.fillStyle = "#8ea7d4";
      ctx.font = "12px Arial";
      ctx.fillText(`${card.label}:`, x + 10, y + 17);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial";
      ctx.fillText(card.value, x + Math.min(cardW - 54, 84), y + 17);
    });

    for (const btn of this.buttons) {
      const color =
        btn.id === "leave" ? "#8d2f3c" :
        btn.id === "back" ? "#2c3d63" :
        btn.id.startsWith("upgrade_") ? "#315fbe" :
        "#1d8f5a";
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
    if (this.activeTab === "log") this.renderLogs(ctx, clan, L);

    ctx.restore();
  }

  renderGeneral(ctx, clan, L) {
    const contentH = 540;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW * 0.45, 260, 18, "#121b31");
    this.drawPanel(ctx, L.contentX + L.contentW * 0.45 + 30, y0 + 14, L.contentW * 0.45 - 12, 260, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Clan Bilgisi", L.contentX + 36, y0 + 46);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "18px Arial";
    ctx.fillText(`Sıralama: #${clan.rank}`, L.contentX + 36, y0 + 86);
    ctx.fillText(`Bölge Sayısı: ${clan.territoryCount}`, L.contentX + 36, y0 + 118);
    ctx.fillText(`XP: ${clan.xp} / ${clan.xpNext}`, L.contentX + 36, y0 + 150);
    ctx.fillText(`Savaş Aktif: ${clan.wars.active.length}`, L.contentX + 36, y0 + 182);
    ctx.fillText(`Geçmiş Savaş: ${clan.wars.history.length}`, L.contentX + 36, y0 + 214);

    ctx.fillStyle = "#25365f";
    ctx.fillRect(L.contentX + 36, y0 + 234, 280, 16);
    ctx.fillStyle = "#4f7dd1";
    const ratio = clan.xpNext > 0 ? Math.max(0, Math.min(1, clan.xp / clan.xpNext)) : 0;
    ctx.fillRect(L.contentX + 36, y0 + 234, 280 * ratio, 16);

    const panel2X = L.contentX + L.contentW * 0.45 + 48;
    const leaderCount = clan.members.filter((m) => m.role === "leader").length;
    const officerCount = clan.members.filter((m) => m.role === "officer").length;
    const memberCount = clan.members.filter((m) => m.role === "member").length;
    const onlineCount = clan.members.filter((m) => m.online).length;
    const topContributor = [...clan.members].sort((a, b) => (b.contribution || 0) - (a.contribution || 0))[0];

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
      `En çok katkı: ${topContributor ? `${topContributor.name} ($${formatMoney(topContributor.contribution)})` : "-"}`,
      panel2X,
      y0 + 214
    );
  }

  renderMembers(ctx, clan, L) {
    const rowH = 54;
    const contentH = 90 + clan.members.length * rowH + 90;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW - 36, 62 + clan.members.length * rowH, 18, "#121b31");

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

    clan.members.forEach((member, i) => {
      const y = y0 + 108 + i * rowH;
      ctx.fillStyle = i % 2 === 0 ? "#182444" : "#14203a";
      ctx.fillRect(L.contentX + 28, y - 22, L.contentW - 56, 42);

      ctx.fillStyle = "#ffffff";
      ctx.font = "17px Arial";
      ctx.fillText(member.name, L.contentX + 34, y);
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
          onClick: () => ClanSystem.kickMember(this.store, member.id),
        });
      }
    });
  }

  renderBank(ctx, clan, L) {
    const state = this.store?.get?.() || this.store?.state || {};
    const playerCash = Number(state.player?.cash || 0);

    const contentH = 420;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;

    const leftW = Math.floor((L.contentW - 54) * 0.42);
    const rightW = L.contentW - leftW - 54;

    this.drawPanel(ctx, L.contentX + 18, y0 + 14, leftW, 220, 18, "#121b31");
    this.drawPanel(ctx, L.contentX + leftW + 36, y0 + 14, rightW, 220, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Kasa Durumu", L.contentX + 34, y0 + 46);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "18px Arial";
    ctx.fillText(`Clan Kasası: $${formatMoney(clan.bank)}`, L.contentX + 34, y0 + 84);
    ctx.fillText(`Kasa Kapasitesi: $${formatMoney(clan.limits.vaultCapacity)}`, L.contentX + 34, y0 + 116);
    ctx.fillText(`Oyuncu Parası: $${formatMoney(playerCash)}`, L.contentX + 34, y0 + 148);

    ctx.fillStyle = "#25365f";
    ctx.fillRect(L.contentX + 34, y0 + 172, Math.min(300, leftW - 50), 16);
    ctx.fillStyle = "#53a96f";
    const ratio = clan.limits.vaultCapacity > 0 ? clan.bank / clan.limits.vaultCapacity : 0;
    ctx.fillRect(L.contentX + 34, y0 + 172, Math.min(300, leftW - 50) * Math.max(0, Math.min(1, ratio)), 16);

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
    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW - 36, 470, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText("Geliştirmeler", L.contentX + 34, y0 + 46);

    upgradeTypes.forEach((type, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardW = Math.min(320, Math.floor((L.contentW - 54) / 2));
      const x = L.contentX + 26 + col * (cardW + 18);
      const y = y0 + 84 + row * 110;
      const level = clan.upgrades[type] || 0;
      const cost = getUpgradeCost(type, level);

      this.drawPanel(ctx, x, y, cardW, 88, 14, "#182444");

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Arial";
      ctx.fillText(getUpgradeLabel(type), x + 16, y + 28);

      ctx.fillStyle = "#b8c8ea";
      ctx.font = "16px Arial";
      ctx.fillText(`Seviye: ${level}`, x + 16, y + 52);
      ctx.fillText(`Maliyet: $${formatMoney(cost)}`, x + 16, y + 74);
    });
  }

  renderLogs(ctx, clan, L) {
    const logs = clan.logs || [];
    const contentH = 120 + Math.max(1, logs.length) * 34;
    this.maxScroll = Math.max(0, contentH - L.contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const y0 = L.contentY - this.scrollY;
    this.drawPanel(ctx, L.contentX + 18, y0 + 14, L.contentW - 36, contentH - 20, 18, "#121b31");

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

  drawButton(ctx, rect, text, color = "#2c3d63", fontSize = 16) {
    this.drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, 12, color);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  drawPanel(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
}
