import { ClanSystem } from "../systems/clan/ClanSystem.js";
import {
  formatMoney,
  getRoleLabel,
  getUpgradeCost,
  getUpgradeLabel,
} from "../systems/clan/ClanUtils.js";

export class ClanScene {
  constructor({ engine, sceneManager, assets, input, store, i18n }) {
    this.engine = engine;
    this.sceneManager = sceneManager;
    this.assets = assets;
    this.input = input;
    this.store = store;
    this.i18n = i18n;

    this.buttons = [];
    this.tabButtons = [];
    this.activeTab = "genel";
  }

  enter() {
    this.activeTab = "genel";
    this.rebuildUi();
  }

  exit() {}

  rebuildUi() {
    this.buttons = [
      {
        id: "back",
        x: 30,
        y: 24,
        w: 130,
        h: 42,
        text: "GERİ",
        onClick: () => this.sceneManager.goTo("home"),
      },
      {
        id: "leave",
        x: 830,
        y: 24,
        w: 160,
        h: 42,
        text: "CLAN'DAN ÇIK",
        onClick: () => {
          ClanSystem.leaveClan(this.store);
          if (ClanSystem.hasClan(this.store)) {
            this.rebuildUi();
          } else {
            this.sceneManager.goTo("clan_create");
          }
        },
      },
    ];

    const tabs = ClanSystem.getTabList();
    this.tabButtons = tabs.map((tab, i) => ({
      id: `tab_${tab}`,
      tab,
      x: 40 + i * 190,
      y: 150,
      w: 170,
      h: 42,
      text: this.getTabLabel(tab),
      onClick: () => {
        this.activeTab = tab;
        this.rebuildUi();
      },
    }));

    const clan = ClanSystem.getClan(this.store);
    if (!clan) return;

    if (this.activeTab === "kasa") {
      this.buttons.push(
        {
          id: "donate_1000",
          x: 60,
          y: 560,
          w: 180,
          h: 50,
          text: "$1.000 YATIR",
          onClick: () => {
            ClanSystem.donateToClan(this.store, 1000);
            this.rebuildUi();
          },
        },
        {
          id: "donate_5000",
          x: 260,
          y: 560,
          w: 180,
          h: 50,
          text: "$5.000 YATIR",
          onClick: () => {
            ClanSystem.donateToClan(this.store, 5000);
            this.rebuildUi();
          },
        },
        {
          id: "donate_10000",
          x: 460,
          y: 560,
          w: 200,
          h: 50,
          text: "$10.000 YATIR",
          onClick: () => {
            ClanSystem.donateToClan(this.store, 10000);
            this.rebuildUi();
          },
        }
      );
    }

    if (this.activeTab === "gelistirme") {
      const upgradeTypes = ["memberCap", "vault", "income", "attack", "defense"];
      upgradeTypes.forEach((type, i) => {
        const row = i % 3;
        const col = Math.floor(i / 3);
        const x = 60 + row * 300;
        const y = 320 + col * 100;

        this.buttons.push({
          id: `upgrade_${type}`,
          x,
          y,
          w: 240,
          h: 56,
          text: `${getUpgradeLabel(type)} YÜKSELT`,
          onClick: () => {
            ClanSystem.upgrade(this.store, type);
            this.rebuildUi();
          },
        });
      });
    }

    if (this.activeTab === "uyeler") {
      this.buttons.push({
        id: "add_mock_member",
        x: 760,
        y: 560,
        w: 220,
        h: 50,
        text: "ÖRNEK ÜYE EKLE",
        onClick: () => {
          ClanSystem.addMockMember(this.store);
          this.rebuildUi();
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
      case "log":
        return "LOG";
      default:
        return tab.toUpperCase();
    }
  }

  update() {
    const clan = ClanSystem.getClan(this.store);
    if (!clan) {
      this.sceneManager.goTo("clan_create");
      return;
    }

    const pointer = this.input?.pointer || this.input?.mouse || null;
    const pressed =
      this.input?.isJustPressed?.("pointer") ||
      this.input?.isJustPressed?.("mouseLeft") ||
      this.input?.mousePressed;

    if (pointer && pressed) {
      const px = pointer.x;
      const py = pointer.y;

      for (const btn of [...this.buttons, ...this.tabButtons]) {
        if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
          btn.onClick?.();
          return;
        }
      }

      if (this.activeTab === "uyeler") {
        const member = this.findKickTarget(px, py);
        if (member) {
          ClanSystem.kickMember(this.store, member.id);
          this.rebuildUi();
          return;
        }
      }
    }
  }

  findKickTarget(px, py) {
    const clan = ClanSystem.getClan(this.store);
    if (!clan) return null;

    const startX = 60;
    const startY = 240;
    const rowH = 52;

    for (let i = 0; i < clan.members.length; i++) {
      const y = startY + i * rowH;
      const kickX = 850;
      const kickY = y + 8;
      const kickW = 110;
      const kickH = 34;

      if (px >= kickX && px <= kickX + kickW && py >= kickY && py <= kickY + kickH) {
        return clan.members[i];
      }
    }

    return null;
  }

  render(ctx) {
    const clan = ClanSystem.getClan(this.store);
    if (!clan) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.fillStyle = "#09101d";
    ctx.fillRect(0, 0, w, h);

    this.drawPanel(ctx, 20, 18, w - 40, 100, 22, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px Arial";
    ctx.fillText(`${clan.name} [${clan.tag}]`, 50, 62);

    ctx.fillStyle = "#9cb2d9";
    ctx.font = "20px Arial";
    ctx.fillText(clan.description, 50, 95);

    for (const btn of this.buttons) {
      this.drawButton(ctx, btn, btn.id === "leave" ? "#8d2f3c" : btn.id === "back" ? "#2c3d63" : "#1d8f5a");
    }

    for (const tab of this.tabButtons) {
      const active = this.activeTab === tab.tab;
      this.drawButton(ctx, tab, active ? "#365a98" : "#1b2743");
    }

    this.drawTopStats(ctx, clan);

    if (this.activeTab === "genel") this.renderGeneral(ctx, clan);
    if (this.activeTab === "uyeler") this.renderMembers(ctx, clan);
    if (this.activeTab === "kasa") this.renderBank(ctx, clan);
    if (this.activeTab === "gelistirme") this.renderUpgrades(ctx, clan);
    if (this.activeTab === "log") this.renderLogs(ctx, clan);
  }

  drawTopStats(ctx, clan) {
    const cards = [
      { label: "Seviye", value: String(clan.level) },
      { label: "Güç", value: String(clan.power) },
      { label: "Üye", value: `${clan.members.length}/${clan.limits.members}` },
      { label: "Kasa", value: `$${formatMoney(clan.bank)}` },
      { label: "Günlük Gelir", value: `$${formatMoney(clan.dailyIncome)}` },
    ];

    cards.forEach((card, i) => {
      const x = 40 + i * 190;
      const y = 210;
      const w = 170;
      const h = 88;

      this.drawPanel(ctx, x, y, w, h, 16, "#16213c");
      ctx.fillStyle = "#8ea7d4";
      ctx.font = "18px Arial";
      ctx.fillText(card.label, x + 18, y + 30);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px Arial";
      ctx.fillText(card.value, x + 18, y + 66);
    });
  }

  renderGeneral(ctx, clan) {
    this.drawPanel(ctx, 40, 320, 450, 300, 18, "#121b31");
    this.drawPanel(ctx, 520, 320, 460, 300, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Clan Bilgisi", 60, 360);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "20px Arial";
    ctx.fillText(`Sıralama: #${clan.rank}`, 60, 405);
    ctx.fillText(`Bölge Sayısı: ${clan.territoryCount}`, 60, 440);
    ctx.fillText(`XP: ${clan.xp} / ${clan.xpNext}`, 60, 475);
    ctx.fillText(`Savaş Aktif: ${clan.wars.active.length}`, 60, 510);
    ctx.fillText(`Geçmiş Savaş: ${clan.wars.history.length}`, 60, 545);

    ctx.fillStyle = "#25365f";
    ctx.fillRect(60, 570, 360, 18);
    ctx.fillStyle = "#4f7dd1";
    const ratio = clan.xpNext > 0 ? Math.max(0, Math.min(1, clan.xp / clan.xpNext)) : 0;
    ctx.fillRect(60, 570, 360 * ratio, 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Rol Dağılımı", 540, 360);

    const leaderCount = clan.members.filter((m) => m.role === "leader").length;
    const officerCount = clan.members.filter((m) => m.role === "officer").length;
    const memberCount = clan.members.filter((m) => m.role === "member").length;
    const onlineCount = clan.members.filter((m) => m.online).length;

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "20px Arial";
    ctx.fillText(`Lider: ${leaderCount}`, 540, 405);
    ctx.fillText(`Yardımcı: ${officerCount}`, 540, 440);
    ctx.fillText(`Üye: ${memberCount}`, 540, 475);
    ctx.fillText(`Online: ${onlineCount}`, 540, 510);

    const topContributor = [...clan.members].sort((a, b) => (b.contribution || 0) - (a.contribution || 0))[0];
    ctx.fillText(
      `En çok katkı: ${topContributor ? `${topContributor.name} ($${formatMoney(topContributor.contribution)})` : "-"}`,
      540,
      545
    );
  }

  renderMembers(ctx, clan) {
    this.drawPanel(ctx, 40, 320, 940, 300, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Üyeler", 60, 360);

    ctx.fillStyle = "#8ea7d4";
    ctx.font = "18px Arial";
    ctx.fillText("İsim", 60, 400);
    ctx.fillText("Rol", 260, 400);
    ctx.fillText("Seviye", 400, 400);
    ctx.fillText("Güç", 520, 400);
    ctx.fillText("Katkı", 650, 400);
    ctx.fillText("Durum", 790, 400);

    const startY = 425;
    const rowH = 52;

    clan.members.forEach((member, i) => {
      const y = startY + i * rowH;

      ctx.fillStyle = i % 2 === 0 ? "#182444" : "#14203a";
      ctx.fillRect(55, y - 24, 910, 42);

      ctx.fillStyle = "#ffffff";
      ctx.font = "18px Arial";
      ctx.fillText(member.name, 60, y);
      ctx.fillText(getRoleLabel(member.role), 260, y);
      ctx.fillText(String(member.level || 1), 400, y);
      ctx.fillText(String(member.power || 0), 520, y);
      ctx.fillText(`$${formatMoney(member.contribution || 0)}`, 650, y);
      ctx.fillText(member.online ? "Online" : "Offline", 790, y);

      if (member.id !== "player_main") {
        this.drawButton(
          ctx,
          {
            x: 850,
            y: y - 18,
            w: 110,
            h: 34,
            text: "AT",
          },
          "#8d2f3c",
          16
        );
      }
    });
  }

  renderBank(ctx, clan) {
    const state = this.store?.get?.() || this.store?.state || {};
    const playerCash = Number(state.player?.cash || 0);

    this.drawPanel(ctx, 40, 320, 420, 220, 18, "#121b31");
    this.drawPanel(ctx, 490, 320, 490, 220, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Kasa Durumu", 60, 360);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "20px Arial";
    ctx.fillText(`Clan Kasası: $${formatMoney(clan.bank)}`, 60, 405);
    ctx.fillText(`Kasa Kapasitesi: $${formatMoney(clan.limits.vaultCapacity)}`, 60, 440);
    ctx.fillText(`Oyuncu Parası: $${formatMoney(playerCash)}`, 60, 475);

    ctx.fillStyle = "#25365f";
    ctx.fillRect(60, 500, 320, 18);
    ctx.fillStyle = "#53a96f";
    const ratio = clan.limits.vaultCapacity > 0 ? clan.bank / clan.limits.vaultCapacity : 0;
    ctx.fillRect(60, 500, 320 * Math.max(0, Math.min(1, ratio)), 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Bilgi", 510, 360);

    ctx.fillStyle = "#c7d4ee";
    ctx.font = "20px Arial";
    ctx.fillText("Kasadaki para geliştirmeler için kullanılır.", 510, 405);
    ctx.fillText("Aşağıdaki butonlarla hızlı bağış yapabilirsin.", 510, 440);
    ctx.fillText("Kasa doluysa fazla para yatırılmaz.", 510, 475);

    for (const btn of this.buttons.filter((b) => b.id.startsWith("donate_"))) {
      this.drawButton(ctx, btn, "#1d8f5a");
    }
  }

  renderUpgrades(ctx, clan) {
    this.drawPanel(ctx, 40, 320, 940, 300, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Geliştirmeler", 60, 360);

    const upgradeTypes = ["memberCap", "vault", "income", "attack", "defense"];

    upgradeTypes.forEach((type, i) => {
      const row = i % 3;
      const col = Math.floor(i / 3);
      const x = 60 + row * 300;
      const y = 390 + col * 100;
      const level = clan.upgrades[type] || 0;
      const cost = getUpgradeCost(type, level);

      this.drawPanel(ctx, x, y, 240, 76, 14, "#182444");

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px Arial";
      ctx.fillText(getUpgradeLabel(type), x + 16, y + 26);

      ctx.fillStyle = "#b8c8ea";
      ctx.font = "18px Arial";
      ctx.fillText(`Seviye: ${level}`, x + 16, y + 50);
      ctx.fillText(`Maliyet: $${formatMoney(cost)}`, x + 16, y + 72);
    });

    for (const btn of this.buttons.filter((b) => b.id.startsWith("upgrade_"))) {
      this.drawButton(ctx, btn, "#315fbe");
    }
  }

  renderLogs(ctx, clan) {
    this.drawPanel(ctx, 40, 320, 940, 300, 18, "#121b31");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Son İşlemler", 60, 360);

    const logs = clan.logs || [];
    const visible = logs.slice(0, 8);

    visible.forEach((log, i) => {
      const y = 400 + i * 28;
      ctx.fillStyle = "#d5e1f8";
      ctx.font = "18px Arial";
      ctx.fillText(`• ${log.text}`, 60, y);
    });

    if (!visible.length) {
      ctx.fillStyle = "#d5e1f8";
      ctx.font = "18px Arial";
      ctx.fillText("Henüz log yok.", 60, 400);
    }
  }

  drawButton(ctx, btn, color = "#2c3d63", fontSize = 18) {
    this.drawPanel(ctx, btn.x, btn.y, btn.w, btn.h, 12, color);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
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
