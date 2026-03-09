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
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function shortAddr(addr) {
  const s = String(addr || "").trim();
  if (!s) return "Bağlı değil";
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}...${s.slice(-6)}`;
}
function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}
function fmtDate(ts) {
  const n = Number(ts || 0);
  if (!n) return "-";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("tr-TR");
}
function calcWinRate(w, l) {
  const total = Number(w || 0) + Number(l || 0);
  if (!total) return 0;
  return Math.round((Number(w || 0) / total) * 100);
}

export class ProfileScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;
    this.mode = "owner";
    this.tab = "general";
    this.hit = [];
  }

  onEnter(data = {}) {
    this.mode = data?.mode === "public" ? "public" : "owner";
    this.tab = data?.tab || "general";
    this.ensureState();
  }

  ensureState() {
    const s = this.store.get();
    const p = s.player || {};
    const profile = s.profile || {};
    const leaderboard = s.leaderboard || {};
    const finance = s.finance || {};
    const pvpHistory = Array.isArray(s.pvpHistory) ? s.pvpHistory : [];
    const weapons = s.weapons || { owned: {}, equippedId: null };
    const stars = s.stars || { owned: {}, selectedId: null };

    const tgId = String(p.telegramId || profile.telegramId || "");
    const username = String(p.username || "Player");
    const generatedId = `TC-${String(tgId || username.replace(/\s+/g, "").toUpperCase()).slice(0, 10) || "PLAYER"}`;

    this.store.set({
      profile: {
        id: profile.id || generatedId,
        avatar: profile.avatar || "😈",
        bio: profile.bio || "TonCrime sokaklarında aktif.",
        isPublic: profile.isPublic !== false,
        telegramId: tgId,
        walletAddress: profile.walletAddress || "",
        premiumType: profile.premiumType || (s.premium ? "premium" : "none"),
        premiumUntil: Number(profile.premiumUntil || 0),
        joinedAt: Number(profile.joinedAt || Date.now())
      },
      leaderboard: {
        rankGlobal: Number(leaderboard.rankGlobal || 0),
        rankWeekly: Number(leaderboard.rankWeekly || 0),
        pvpWins: Number(leaderboard.pvpWins || 0),
        pvpLosses: Number(leaderboard.pvpLosses || 0)
      },
      finance: {
        tonBalance: Number(finance.tonBalance || 0),
        ytonBalance: Number(finance.ytonBalance || 0),
        totalIncomeTon: Number(finance.totalIncomeTon || 0),
        totalExpenseTon: Number(finance.totalExpenseTon || 0),
        totalIncomeYton: Number(finance.totalIncomeYton || 0),
        totalExpenseYton: Number(finance.totalExpenseYton || 0),
        history: Array.isArray(finance.history) ? finance.history : []
      },
      pvpHistory,
      weapons,
      stars
    });
  }

  tabs() {
    return [
      { key: "general", label: "Genel" },
      { key: "inventory", label: "Envanter" },
      { key: "leaderboard", label: "Liderlik" },
      { key: "wallet", label: "Cüzdan" },
      { key: "premium", label: "Premium" },
      { key: "finance", label: "Finans" },
      { key: "pvp", label: "PvP" }
    ];
  }

  update() {
    const p = this.input.pointer || { x: 0, y: 0 };
    if (!this.input.justReleased()) return;

    for (const h of this.hit) {
      if (!pointInRect(p.x, p.y, h.rect)) continue;

      if (h.type === "back") {
        this.scenes.go("home");
        return;
      }
      if (h.type === "mode") {
        this.mode = this.mode === "owner" ? "public" : "owner";
        return;
      }
      if (h.type === "tab") {
        this.tab = h.key;
        return;
      }
      if (h.type === "togglePublic") {
        const s = this.store.get();
        const pr = s.profile || {};
        this.store.set({ profile: { ...pr, isPublic: !pr.isPublic } });
        return;
      }
      if (h.type === "premium") {
        const s = this.store.get();
        const pr = s.profile || {};
        const next = !s.premium;
        this.store.set({
          premium: next,
          profile: {
            ...pr,
            premiumType: next ? "premium" : "none",
            premiumUntil: next ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0
          }
        });
        return;
      }
      if (h.type === "walletConnect") {
        window.tcWallet?.open?.();
        return;
      }
      if (h.type === "walletDisconnect") {
        window.tcWallet?.disconnect?.();
        return;
      }
    }
  }

  drawChip(ctx, rect, label, value, active = false) {
    ctx.fillStyle = active ? "rgba(242,211,107,0.18)" : "rgba(255,255,255,0.06)";
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.strokeStyle = active ? "rgba(242,211,107,0.42)" : "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 14);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textAlign = "left";
    ctx.font = "12px system-ui";
    ctx.fillText(label, rect.x + 12, rect.y + 18);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui";
    ctx.fillText(value, rect.x + 12, rect.y + 40);
  }

  drawRow(ctx, x, y, w, label, value) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, 44, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, 43, 12);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textAlign = "left";
    ctx.font = "13px system-ui";
    ctx.fillText(label, x + 12, y + 18);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(value, x + 12, y + 34);
  }

  render(ctx, w, h) {
    this.hit = [];

    const s = this.store.get();
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w, h };
    const player = s.player || {};
    const profile = s.profile || {};
    const lb = s.leaderboard || {};
    const finance = s.finance || {};
    const pvpHistory = Array.isArray(s.pvpHistory) ? s.pvpHistory : [];
    const weapons = s.weapons || { owned: {}, equippedId: null };
    const stars = s.stars || { owned: {}, selectedId: null };
    const bg = this.assets?.getImage?.("background");

    if (bg) ctx.drawImage(bg, 0, 0, w, h);
    else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = "rgba(4,6,12,0.82)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 14;
    const panelY = safe.y + 14;
    const panelW = safe.w - 28;
    const panelH = safe.h - 28;

    ctx.fillStyle = "rgba(0,0,0,0.48)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 22);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 22);

    const backRect = { x: panelX + 12, y: panelY + 12, w: 72, h: 34 };
    const modeRect = { x: panelX + panelW - 132, y: panelY + 12, w: 120, h: 34 };
    this.hit.push({ type: "back", rect: backRect }, { type: "mode", rect: modeRect });

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 12);
    fillRoundRect(ctx, modeRect.x, modeRect.y, modeRect.w, modeRect.h, 12);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 14px system-ui";
    ctx.fillText("← Geri", backRect.x + backRect.w / 2, backRect.y + 22);
    ctx.fillText(this.mode === "owner" ? "Açık Profil" : "Sahip Görünümü", modeRect.x + modeRect.w / 2, modeRect.y + 22);

    const avatarSize = clamp(panelW * 0.18, 74, 104);
    const avatarX = panelX + 18;
    const avatarY = panelY + 60;

    ctx.fillStyle = "rgba(242,211,107,0.14)";
    fillRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 22);
    ctx.strokeStyle = "rgba(242,211,107,0.36)";
    strokeRoundRect(ctx, avatarX + 0.5, avatarY + 0.5, avatarSize - 1, avatarSize - 1, 22);

    ctx.font = `${Math.floor(avatarSize * 0.52)}px system-ui`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(profile.avatar || "😈", avatarX + avatarSize / 2, avatarY + avatarSize * 0.66);

    const infoX = avatarX + avatarSize + 16;

    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px system-ui";
    ctx.fillText(player.username || "Player", infoX, avatarY + 28);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "13px system-ui";
    ctx.fillText(profile.id || "TC-PLAYER", infoX, avatarY + 50);
    ctx.fillText(profile.bio || "-", infoX, avatarY + 70);

    const premiumRect = {
      x: panelX + panelW - 116,
      y: avatarY + 8,
      w: 98,
      h: 28
    };
    ctx.fillStyle = s.premium ? "rgba(242,211,107,0.18)" : "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, premiumRect.x, premiumRect.y, premiumRect.w, premiumRect.h, 999);
    ctx.strokeStyle = s.premium ? "rgba(242,211,107,0.40)" : "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, premiumRect.x + 0.5, premiumRect.y + 0.5, premiumRect.w - 1, premiumRect.h - 1, 999);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(s.premium ? "PREMIUM" : "STANDARD", premiumRect.x + premiumRect.w / 2, premiumRect.y + 18);

    const chipY = avatarY + avatarSize + 14;
    const chipGap = 10;
    const chipW = Math.floor((panelW - 36 - chipGap * 2) / 3);

    this.drawChip(ctx, { x: panelX + 18, y: chipY, w: chipW, h: 52 }, "Level", String(player.level || 1), true);
    this.drawChip(ctx, { x: panelX + 18 + chipW + chipGap, y: chipY, w: chipW, h: 52 }, "Coin", fmtNum(s.coins || 0));
    this.drawChip(ctx, { x: panelX + 18 + (chipW + chipGap) * 2, y: chipY, w: chipW, h: 52 }, "PvP", `${fmtNum(lb.pvpWins || 0)}W / ${fmtNum(lb.pvpLosses || 0)}L`);

    const tabsY = chipY + 66;
    const tabs = this.tabs();
    const tabGap = 8;
    const tabW = Math.floor((panelW - 36 - tabGap * (tabs.length - 1)) / tabs.length);

    tabs.forEach((tab, i) => {
      const r = {
        x: panelX + 18 + i * (tabW + tabGap),
        y: tabsY,
        w: tabW,
        h: 34
      };
      this.hit.push({ type: "tab", key: tab.key, rect: r });

      ctx.fillStyle = this.tab === tab.key ? "rgba(242,211,107,0.20)" : "rgba(255,255,255,0.06)";
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.strokeStyle = this.tab === tab.key ? "rgba(242,211,107,0.42)" : "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 12);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 12px system-ui";
      ctx.fillText(tab.label, r.x + r.w / 2, r.y + 21);
    });

    const contentX = panelX + 18;
    const contentY = tabsY + 48;
    const contentW = panelW - 36;
    const contentH = panelH - (contentY - panelY) - 18;

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    fillRoundRect(ctx, contentX, contentY, contentW, contentH, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, contentX + 0.5, contentY + 0.5, contentW - 1, contentH - 1, 16);

    const rowX = contentX + 14;
    const rowW = contentW - 28;
    const publicMode = this.mode === "public";

    if (this.tab === "general") {
      this.drawRow(ctx, rowX, contentY + 14, rowW, "Oyuncu ID", profile.id || "-");
      this.drawRow(ctx, rowX, contentY + 66, rowW, "Seviye / XP", `LVL ${player.level || 1} • ${fmtNum(player.xp || 0)}/${fmtNum(player.xpToNext || 100)} XP`);
      this.drawRow(ctx, rowX, contentY + 118, rowW, "Seçili Silah", player.weaponName || "Silah Yok");
      this.drawRow(ctx, rowX, contentY + 170, rowW, "Leaderboard", `Global #${fmtNum(lb.rankGlobal || 0)} • Haftalık #${fmtNum(lb.rankWeekly || 0)}`);
      this.drawRow(ctx, rowX, contentY + 222, rowW, "Profil Görünürlüğü", `${profile.isPublic ? "Herkese Açık" : "Gizli"} • ${publicMode ? "Public görünüm" : "Sahip görünüm"}`);

      if (!publicMode) {
        const toggleRect = { x: rowX, y: contentY + 278, w: rowW, h: 40 };
        this.hit.push({ type: "togglePublic", rect: toggleRect });
        ctx.fillStyle = "rgba(242,211,107,0.16)";
        fillRoundRect(ctx, toggleRect.x, toggleRect.y, toggleRect.w, toggleRect.h, 12);
        ctx.strokeStyle = "rgba(242,211,107,0.36)";
        strokeRoundRect(ctx, toggleRect.x + 0.5, toggleRect.y + 0.5, toggleRect.w - 1, toggleRect.h - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 14px system-ui";
        ctx.fillText(profile.isPublic ? "Profili Gizliye Al" : "Profili Herkese Aç", toggleRect.x + toggleRect.w / 2, toggleRect.y + 25);
      }
    }

    if (this.tab === "inventory") {
      const weaponCount = Object.keys(weapons.owned || {}).length;
      const starCount = Object.keys(stars.owned || {}).length;

      this.drawRow(ctx, rowX, contentY + 14, rowW, "Avatar", profile.avatar || "😈");
      this.drawRow(ctx, rowX, contentY + 66, rowW, "Silah Envanteri", `${weaponCount} adet • Seçili: ${player.weaponName || "Silah Yok"}`);
      this.drawRow(ctx, rowX, contentY + 118, rowW, "Yıldız / Koleksiyon", `${starCount} adet • Seçili: ${stars.selectedId || "Yok"}`);
      this.drawRow(ctx, rowX, contentY + 170, rowW, "Enerji", `${fmtNum(player.energy || 0)} / ${fmtNum(player.energyMax || 10)}`);
      this.drawRow(ctx, rowX, contentY + 222, rowW, "Premium İçerik", s.premium ? "Açık" : "Kapalı");
    }

    if (this.tab === "leaderboard") {
      const wins = Number(lb.pvpWins || 0);
      const losses = Number(lb.pvpLosses || 0);

      this.drawRow(ctx, rowX, contentY + 14, rowW, "Global Sıra", `#${fmtNum(lb.rankGlobal || 0)}`);
      this.drawRow(ctx, rowX, contentY + 66, rowW, "Haftalık Sıra", `#${fmtNum(lb.rankWeekly || 0)}`);
      this.drawRow(ctx, rowX, contentY + 118, rowW, "Galibiyet", fmtNum(wins));
      this.drawRow(ctx, rowX, contentY + 170, rowW, "Mağlubiyet", fmtNum(losses));
      this.drawRow(ctx, rowX, contentY + 222, rowW, "Kazanma Oranı", `%${calcWinRate(wins, losses)}`);
    }

    if (this.tab === "wallet") {
      if (publicMode) {
        this.drawRow(ctx, rowX, contentY + 14, rowW, "Cüzdan", "Gizli");
        this.drawRow(ctx, rowX, contentY + 66, rowW, "Durum", "Sadece profil sahibi görür");
      } else {
        this.drawRow(ctx, rowX, contentY + 14, rowW, "Bağlı Adres", shortAddr(profile.walletAddress));
        this.drawRow(ctx, rowX, contentY + 66, rowW, "TON Bakiye", `${finance.tonBalance || 0} TON`);
        this.drawRow(ctx, rowX, contentY + 118, rowW, "YTON Bakiye", `${finance.ytonBalance || 0} YTON`);
        this.drawRow(ctx, rowX, contentY + 170, rowW, "Çekim Durumu", profile.walletAddress ? "Cüzdan bağlı" : "Cüzdan bağlantısı bekleniyor");

        const connectRect = { x: rowX, y: contentY + 226, w: rowW, h: 42 };
        this.hit.push({ type: profile.walletAddress ? "walletDisconnect" : "walletConnect", rect: connectRect });

        ctx.fillStyle = "rgba(242,211,107,0.16)";
        fillRoundRect(ctx, connectRect.x, connectRect.y, connectRect.w, connectRect.h, 12);
        ctx.strokeStyle = "rgba(242,211,107,0.36)";
        strokeRoundRect(ctx, connectRect.x + 0.5, connectRect.y + 0.5, connectRect.w - 1, connectRect.h - 1, 12);

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 14px system-ui";
        ctx.fillText(profile.walletAddress ? "Cüzdan Bağlantısını Kaldır" : "TON Cüzdanı Bağla", connectRect.x + connectRect.w / 2, connectRect.y + 26);
      }
    }

    if (this.tab === "premium") {
      this.drawRow(ctx, rowX, contentY + 14, rowW, "Paket", s.premium ? "Premium" : "Standart");
      this.drawRow(ctx, rowX, contentY + 66, rowW, "Durum", s.premium ? "Aktif" : "Kapalı");
      this.drawRow(ctx, rowX, contentY + 118, rowW, "Bitiş", s.premium ? fmtDate(profile.premiumUntil) : "-");
      this.drawRow(ctx, rowX, contentY + 170, rowW, "Açıklama", s.premium ? "Premium ayrıcalıkları açık." : "Premium satın alınabilir.");

      if (!publicMode) {
        const btnRect = { x: rowX, y: contentY + 224, w: rowW, h: 42 };
        this.hit.push({ type: "premium", rect: btnRect });

        ctx.fillStyle = "rgba(242,211,107,0.16)";
        fillRoundRect(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, 12);
        ctx.strokeStyle = "rgba(242,211,107,0.36)";
        strokeRoundRect(ctx, btnRect.x + 0.5, btnRect.y + 0.5, btnRect.w - 1, btnRect.h - 1, 12);

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 14px system-ui";
        ctx.fillText(s.premium ? "Premium'u Kapat (Test)" : "Premium'u Aç (Test)", btnRect.x + btnRect.w / 2, btnRect.y + 26);
      }
    }

    if (this.tab === "finance") {
      if (publicMode) {
        this.drawRow(ctx, rowX, contentY + 14, rowW, "Finans", "Gizli");
        this.drawRow(ctx, rowX, contentY + 66, rowW, "Not", "Gelir-gider detayları sadece profil sahibine görünür.");
      } else {
        this.drawRow(ctx, rowX, contentY + 14, rowW, "Toplam TON Gelir", `${finance.totalIncomeTon || 0} TON`);
        this.drawRow(ctx, rowX, contentY + 66, rowW, "Toplam TON Gider", `${finance.totalExpenseTon || 0} TON`);
        this.drawRow(ctx, rowX, contentY + 118, rowW, "Toplam YTON Gelir", `${finance.totalIncomeYton || 0} YTON`);
        this.drawRow(ctx, rowX, contentY + 170, rowW, "Toplam YTON Gider", `${finance.totalExpenseYton || 0} YTON`);

        const last = Array.isArray(finance.history) && finance.history.length ? finance.history[0] : null;
        this.drawRow(ctx, rowX, contentY + 222, rowW, "Son Hareket", last ? `${last.label || last.type || "İşlem"} • ${fmtDate(last.ts)}` : "Henüz kayıt yok");
      }
    }

    if (this.tab === "pvp") {
      const rows = publicMode ? 4 : 5;
      const visible = pvpHistory.slice(0, rows);

      if (!visible.length) {
        this.drawRow(ctx, rowX, contentY + 14, rowW, "Kayıt", "Henüz PvP geçmişi yok");
      } else {
        visible.forEach((match, i) => {
          const result = match.result === "win" ? "Kazandı" : "Kaybetti";
          const opp = match.opponentName || "Rakip";
          const reward = match.rewardCoin ? ` • +${match.rewardCoin} coin` : "";
          this.drawRow(ctx, rowX, contentY + 14 + i * 52, rowW, `${i + 1}. Maç`, `${result} • ${opp}${reward}`);
        });
      }
    }
  }
}
