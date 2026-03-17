
function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
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

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

function getPlayerAvatar(player) {
  return (
    player?.avatarUrl ||
    player?.avatar ||
    player?.photoUrl ||
    player?.photo_url ||
    player?.telegramPhotoUrl ||
    player?.telegram_photo_url ||
    ""
  );
}

function getInitials(name) {
  const raw = String(name || "").trim();
  if (!raw) return "P";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

function moneyFmt(n, digits = 0) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "0";
}

function makeImage(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}

function drawGlassPanel(ctx, x, y, w, h, r = 22) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(28,33,44,0.42)");
  g.addColorStop(0.25, "rgba(17,21,30,0.26)");
  g.addColorStop(1, "rgba(6,9,14,0.50)");
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  const shine = ctx.createLinearGradient(x, y, x, y + h * 0.38);
  shine.addColorStop(0, "rgba(255,255,255,0.11)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h * 0.34, Math.max(8, r - 2));
}

function drawButtonPlate(ctx, x, y, w, h, accent = "muted") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (accent === "gold") {
    g.addColorStop(0, "rgba(130,94,28,0.68)");
    g.addColorStop(1, "rgba(88,60,15,0.78)");
  } else if (accent === "blue") {
    g.addColorStop(0, "rgba(74,116,196,0.56)");
    g.addColorStop(1, "rgba(23,44,88,0.72)");
  } else if (accent === "green") {
    g.addColorStop(0, "rgba(44,150,116,0.58)");
    g.addColorStop(1, "rgba(19,72,58,0.74)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0.04)");
  }

  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, 16);
  ctx.strokeStyle =
    accent === "gold" ? "rgba(255,211,128,0.28)" :
    accent === "blue" ? "rgba(137,178,255,0.30)" :
    accent === "green" ? "rgba(132,245,208,0.22)" :
    "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
}

export class ProfileScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.hitClose = null;
    this.hitTabs = [];
    this.hitWalletButtons = [];
    this.hitEditAvatar = null;
    this.hitLeaderboard = null;

    this._avatarUrl = "";
    this._avatarImg = null;
    this.toastText = "";
    this.toastUntil = 0;
  }

  onEnter() {
    const s = this.store.get() || {};
    const ui = s.ui || {};
    const wallet = s.wallet || {};
    this.store.set({
      ui: {
        ...ui,
        profileTab: ui.profileTab || "profile",
      },
      wallet: {
        connected: !!wallet.connected,
        brand: wallet.brand || "",
        address: wallet.address || "",
        tonBalance: Number(wallet.tonBalance || 0),
        totalConvertedTon: Number(wallet.totalConvertedTon || 0),
        totalWithdrawnTon: Number(wallet.totalWithdrawnTon || 0),
        ledger: Array.isArray(wallet.ledger) ? wallet.ledger : [],
      },
    });
  }

  _showToast(text, ms = 1600) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _profileTab() {
    return String(this.store.get()?.ui?.profileTab || "profile");
  }

  _setProfileTab(tab) {
    const s = this.store.get() || {};
    this.store.set({
      ui: {
        ...(s.ui || {}),
        profileTab: tab,
      },
    });
  }

  _wallet() {
    return this.store.get()?.wallet || {};
  }

  _pushWalletLedger(type, amountTon = 0, amountYton = 0, note = "") {
    const s = this.store.get() || {};
    const wallet = this._wallet();
    const ledger = Array.isArray(wallet.ledger) ? wallet.ledger.slice() : [];
    ledger.unshift({
      id: `${type}_${Date.now()}`,
      type,
      amountTon: Number(amountTon || 0),
      amountYton: Number(amountYton || 0),
      note: String(note || ""),
      at: Date.now(),
    });
    this.store.set({
      wallet: {
        ...wallet,
        ledger: ledger.slice(0, 30),
      },
    });
  }

  _connectWallet(brand) {
    const brands = ["Tonkeeper", "MyTonWallet", "OpenMask", "Tonhub"];
    const chosen = brand || window.prompt(`Cüzdan markası seç:\n${brands.join(" / ")}`, "Tonkeeper");
    if (!chosen) return;
    const cleanBrand = String(chosen).trim();
    const address = window.prompt(`${cleanBrand} adresini gir:`, this._wallet().address || "UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    if (!address) return;

    const s = this.store.get() || {};
    const wallet = this._wallet();
    this.store.set({
      wallet: {
        ...wallet,
        connected: true,
        brand: cleanBrand,
        address: String(address).trim(),
      },
    });
    this._pushWalletLedger("connect", 0, 0, `${cleanBrand} bağlandı`);
    this._showToast(`${cleanBrand} bağlandı`);
  }

  _convertYtonToTon() {
    const s = this.store.get() || {};
    const currentYton = Number(s.coins || 0);
    const raw = window.prompt("Kaç YTON dönüştürmek istiyorsun?\n1 YTON = 0.05 TON", "100");
    if (raw === null) return;
    const amountYton = Math.max(0, Number(raw));
    if (!amountYton || !Number.isFinite(amountYton)) {
      this._showToast("Geçersiz miktar");
      return;
    }
    if (amountYton > currentYton) {
      this._showToast("Yetersiz YTON");
      return;
    }

    const tonAmount = amountYton * 0.05;
    const wallet = this._wallet();
    this.store.set({
      coins: currentYton - amountYton,
      wallet: {
        ...wallet,
        tonBalance: Number(wallet.tonBalance || 0) + tonAmount,
        totalConvertedTon: Number(wallet.totalConvertedTon || 0) + tonAmount,
      },
    });
    this._pushWalletLedger("convert", tonAmount, amountYton, `${moneyFmt(amountYton)} YTON -> ${moneyFmt(tonAmount, 2)} TON`);
    this._showToast(`${moneyFmt(amountYton)} YTON dönüştürüldü`);
  }

  _requestWithdraw() {
    const wallet = this._wallet();
    const balance = Number(wallet.tonBalance || 0);
    const raw = window.prompt(`Kaç TON çekmek istiyorsun?\nMevcut TON: ${moneyFmt(balance, 2)}`, moneyFmt(balance, 2));
    if (raw === null) return;
    const tonAmount = Math.max(0, Number(raw));
    if (!tonAmount || !Number.isFinite(tonAmount)) {
      this._showToast("Geçersiz miktar");
      return;
    }
    if (tonAmount > balance) {
      this._showToast("Yetersiz TON bakiye");
      return;
    }
    const targetAddress = wallet.connected && wallet.address
      ? wallet.address
      : window.prompt("Çekim yapılacak TON adresi:", "UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    if (!targetAddress) return;

    const s = this.store.get() || {};
    this.store.set({
      wallet: {
        ...wallet,
        tonBalance: balance - tonAmount,
        totalWithdrawnTon: Number(wallet.totalWithdrawnTon || 0) + tonAmount,
      },
    });
    this._pushWalletLedger("withdraw", tonAmount, 0, `Çekim talebi • ${String(targetAddress).slice(0, 10)}...`);
    this._showToast(`${moneyFmt(tonAmount, 2)} TON çekim talebi oluşturuldu`);
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;
    if (!this.input?.justReleased?.()) return;

    if (this.hitClose && pointInRect(px, py, this.hitClose)) {
      const s = this.store.get() || {};
      this.store.set({
        ui: {
          ...(s.ui || {}),
          profileTab: "profile",
        },
      });
      this.scenes.go("home");
      return;
    }

    for (const t of this.hitTabs) {
      if (pointInRect(px, py, t.rect)) {
        this._setProfileTab(t.tab);
        return;
      }
    }

    if (this._profileTab() === "wallet") {
      for (const btn of this.hitWalletButtons) {
        if (!pointInRect(px, py, btn.rect)) continue;
        if (btn.action === "connect") return this._connectWallet(btn.brand);
        if (btn.action === "convert") return this._convertYtonToTon();
        if (btn.action === "withdraw") return this._requestWithdraw();
      }
      return;
    }

    if (this.hitEditAvatar && pointInRect(px, py, this.hitEditAvatar)) {
      this._showToast("Avatar düzenleme yakında");
      return;
    }

    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      this._showToast("Leaderboard yakında");
      return;
    }
  }

  _drawTopBar(ctx, x, y, w) {
    drawGlassPanel(ctx, x, y, w, 56, 20);

    ctx.fillStyle = "#f3f6fb";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 18px system-ui";
    ctx.fillText(this._profileTab() === "wallet" ? "Cüzdan" : "Profil", x + 16, y + 33);

    const tabs = [
      { tab: "profile", label: "Profil" },
      { tab: "wallet", label: "Cüzdan" },
    ];
    this.hitTabs = [];
    let tx = x + 98;
    for (const t of tabs) {
      const rect = { x: tx, y: y + 10, w: 88, h: 32 };
      this.hitTabs.push({ rect, tab: t.tab });
      drawButtonPlate(ctx, rect.x, rect.y, rect.w, rect.h, this._profileTab() === t.tab ? "blue" : "muted");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px system-ui";
      ctx.fillText(t.label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
      tx += 96;
    }

    this.hitClose = { x: x + w - 46, y: y + 10, w: 34, h: 34 };
    drawButtonPlate(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, "muted");
    ctx.fillStyle = "#fff";
    ctx.fillText("X", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + this.hitClose.h / 2 + 1);
  }

  _drawProfileTab(ctx, x, y, w, h, state) {
    const p = state.player || {};
    const businessesOwned = Array.isArray(state?.businesses?.owned) ? state.businesses.owned.length : 0;
    const inventoryList = Array.isArray(state?.inventory?.items) ? state.inventory.items : [];
    const inventoryItems = inventoryList.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)), 0);
    const totalInventoryValue = inventoryList.reduce((sum, item) => {
      const price = Number(item.marketPrice || item.sellPrice || item.price || 0);
      const qty = Number(item.qty || 0);
      return sum + Math.max(0, price * qty);
    }, 0);
    const clanName = String(state?.clan?.name || state?.clan?.tag || "NEW CLAN");
    const wins = Math.max(0, Number(state?.pvp?.wins || 0));
    const losses = Math.max(0, Number(state?.pvp?.losses || 0));
    const totalFight = wins + losses;
    const winRate = totalFight > 0 ? Math.round((wins / totalFight) * 100) : 0;

    const heroH = 166;
    drawGlassPanel(ctx, x, y, w, heroH, 22);

    const avatarFrameX = x + 16;
    const avatarFrameY = y + 16;
    const avatarFrameW = 108;
    const avatarFrameH = 112;
    drawGlassPanel(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18);

    const username = String(p.username || "Player").trim() || "Player";
    const isPremium = !!(state.premium || p.premium || p.isPremium || p.membership === "premium");
    const avatarUrl = getPlayerAvatar(p);
    if (avatarUrl !== this._avatarUrl) {
      this._avatarUrl = avatarUrl;
      this._avatarImg = makeImage(avatarUrl);
    }

    const avatarX = avatarFrameX + 10;
    const avatarY = avatarFrameY + 10;
    const avatarW = avatarFrameW - 20;
    const avatarH = avatarFrameH - 20;

    ctx.save();
    roundRectPath(ctx, avatarX, avatarY, avatarW, avatarH, 14);
    ctx.clip();
    if (this._avatarImg && this._avatarImg.complete && this._avatarImg.naturalWidth > 0) {
      ctx.drawImage(this._avatarImg, avatarX, avatarY, avatarW, avatarH);
    } else {
      const ag = ctx.createLinearGradient(avatarX, avatarY, avatarX, avatarY + avatarH);
      ag.addColorStop(0, "#535966");
      ag.addColorStop(1, "#2a303a");
      ctx.fillStyle = ag;
      ctx.fillRect(avatarX, avatarY, avatarW, avatarH);
      ctx.fillStyle = "#f2f4f8";
      ctx.font = "900 28px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 2);
    }
    ctx.restore();

    if (isPremium) {
      drawButtonPlate(ctx, avatarFrameX + 8, avatarFrameY - 10, 50, 22, "gold");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 11px system-ui";
      ctx.fillText("VIP", avatarFrameX + 33, avatarFrameY + 1);
    }

    const infoX = avatarFrameX + avatarFrameW + 18;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = "900 24px system-ui";
    ctx.fillText(username, infoX, y + 36);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText(`Seviye ${Math.max(1, Number(p.level || 1))} • Clan ${clanName}`, infoX, y + 58);
    ctx.fillText(`Enerji ${Number(p.energy || 0)}/${Number(p.energyMax || 100)} • YTON ${moneyFmt(state.coins || 0)}`, infoX, y + 76);
    ctx.fillText(`İşletme ${businessesOwned} • Envanter ${inventoryItems}`, infoX, y + 94);
    ctx.fillText(`PvP W/L ${wins}/${losses} • WinRate ${winRate}%`, infoX, y + 112);

    const statsY = y + heroH + 14;
    const cardW = Math.floor((w - 24) / 3);
    const titles = [
      ["İşletmeler", `${businessesOwned}`],
      ["Envanter Değeri", `${moneyFmt(totalInventoryValue)}`],
      ["PvP Gücü", `${wins} / ${losses}`],
    ];
    for (let i = 0; i < 3; i++) {
      const cx = x + i * (cardW + 12);
      drawGlassPanel(ctx, cx, statsY, cardW, 96, 20);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.textAlign = "center";
      ctx.font = "800 12px system-ui";
      ctx.fillText(titles[i][0], cx + cardW / 2, statsY + 26);
      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.fillText(titles[i][1], cx + cardW / 2, statsY + 62);
    }

    const btnY = statsY + 110;
    const btnW = Math.floor((w - 14) / 2);
    this.hitEditAvatar = { x, y: btnY, w: btnW, h: 52 };
    this.hitLeaderboard = { x: x + btnW + 14, y: btnY, w: btnW, h: 52 };
    drawButtonPlate(ctx, this.hitEditAvatar.x, this.hitEditAvatar.y, this.hitEditAvatar.w, this.hitEditAvatar.h, "blue");
    drawButtonPlate(ctx, this.hitLeaderboard.x, this.hitLeaderboard.y, this.hitLeaderboard.w, this.hitLeaderboard.h, "gold");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 17px system-ui";
    ctx.fillText("📷 Avatar", this.hitEditAvatar.x + this.hitEditAvatar.w / 2, this.hitEditAvatar.y + 27);
    ctx.fillText("🏆 Liderlik", this.hitLeaderboard.x + this.hitLeaderboard.w / 2, this.hitLeaderboard.y + 27);
  }

  _drawWalletTab(ctx, x, y, w, h, state) {
    const wallet = this._wallet();
    const p = state.player || {};
    const tonRate = 0.05;
    const currentYton = Number(state.coins || 0);
    const availableTon = currentYton * tonRate;
    const soldValue = Number(state.market?.soldYton || 0);
    const boughtValue = Number(state.trade?.totalBoughtYton || 0);
    const wonYton = Number(state.pvp?.wonYton || 0);

    this.hitWalletButtons = [];

    drawGlassPanel(ctx, x, y, w, 136, 22);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 18px system-ui";
    ctx.fillText("Cüzdan Yönetimi", x + 16, y + 28);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText(wallet.connected ? `${wallet.brand} • ${wallet.address}` : "Henüz cüzdan bağlı değil", x + 16, y + 50);
    ctx.fillText(`YTON ${moneyFmt(currentYton)} • Çevrilebilir TON ${moneyFmt(availableTon, 2)} • TON Bakiye ${moneyFmt(wallet.tonBalance, 2)}`, x + 16, y + 70);
    ctx.fillText(`Toplam Çevrilen ${moneyFmt(wallet.totalConvertedTon, 2)} TON • Toplam Çekilen ${moneyFmt(wallet.totalWithdrawnTon, 2)} TON`, x + 16, y + 90);

    const btnY = y + 98;
    const btnW = Math.floor((w - 24) / 3);
    const brands = ["Tonkeeper", "MyTonWallet", "OpenMask"];
    for (let i = 0; i < 3; i++) {
      const rect = { x: x + i * (btnW + 12), y: btnY, w: btnW, h: 28 };
      this.hitWalletButtons.push({ rect, action: "connect", brand: brands[i] });
      drawButtonPlate(ctx, rect.x, rect.y, rect.w, rect.h, i === 0 ? "gold" : "muted");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 12px system-ui";
      ctx.fillText(brands[i], rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    }

    const boxY = y + 150;
    const leftW = Math.floor((w - 14) / 2);
    const rightX = x + leftW + 14;

    drawGlassPanel(ctx, x, boxY, leftW, 146, 20);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 16px system-ui";
    ctx.fillText("YTON → TON Dönüştür", x + 16, boxY + 26);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("1 YTON = 0.05 TON", x + 16, boxY + 48);
    ctx.fillText(`Mevcut: ${moneyFmt(currentYton)} YTON`, x + 16, boxY + 68);
    ctx.fillText(`Tahmini: ${moneyFmt(availableTon, 2)} TON`, x + 16, boxY + 88);
    const convertRect = { x: x + 16, y: boxY + 102, w: leftW - 32, h: 32 };
    this.hitWalletButtons.push({ rect: convertRect, action: "convert" });
    drawButtonPlate(ctx, convertRect.x, convertRect.y, convertRect.w, convertRect.h, "blue");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 13px system-ui";
    ctx.fillText("Dönüştür", convertRect.x + convertRect.w / 2, convertRect.y + 17);

    drawGlassPanel(ctx, rightX, boxY, leftW, 146, 20);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 16px system-ui";
    ctx.fillText("Çekim Talebi", rightX + 16, boxY + 26);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("Min / Max limit yok", rightX + 16, boxY + 48);
    ctx.fillText(`TON Bakiye: ${moneyFmt(wallet.tonBalance, 2)}`, rightX + 16, boxY + 68);
    ctx.fillText(wallet.connected ? "Bağlı adres kullanılacak" : "Adres prompt ile alınacak", rightX + 16, boxY + 88);
    const withdrawRect = { x: rightX + 16, y: boxY + 102, w: leftW - 32, h: 32 };
    this.hitWalletButtons.push({ rect: withdrawRect, action: "withdraw" });
    drawButtonPlate(ctx, withdrawRect.x, withdrawRect.y, withdrawRect.w, withdrawRect.h, "gold");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 13px system-ui";
    ctx.fillText("Çekim Oluştur", withdrawRect.x + withdrawRect.w / 2, withdrawRect.y + 17);

    const ledgerY = boxY + 160;
    drawGlassPanel(ctx, x, ledgerY, w, 220, 22);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 16px system-ui";
    ctx.fillText("Muhasebe & Rapor", x + 16, ledgerY + 28);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText(`Satılan Ürün: ${moneyFmt(soldValue)} YTON • Alınan Ürün: ${moneyFmt(boughtValue)} YTON • Kazanılan YTON: ${moneyFmt(wonYton)}`, x + 16, ledgerY + 48);
    ctx.fillText(`Dönüştürülen YTON: ${moneyFmt(wallet.totalConvertedTon / 0.05)} • Çekilen TON: ${moneyFmt(wallet.totalWithdrawnTon, 2)}`, x + 16, ledgerY + 66);

    const rows = Array.isArray(wallet.ledger) ? wallet.ledger.slice(0, 5) : [];
    const baseY = ledgerY + 90;
    if (!rows.length) {
      ctx.fillStyle = "rgba(255,255,255,0.56)";
      ctx.font = "12px system-ui";
      ctx.fillText("Henüz kayıt yok. Cüzdan bağla, dönüştür veya çekim yapınca burada görünür.", x + 16, baseY);
    } else {
      rows.forEach((row, idx) => {
        const ry = baseY + idx * 24;
        ctx.fillStyle = idx % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
        fillRoundRect(ctx, x + 12, ry - 14, w - 24, 20, 8);
        const d = new Date(Number(row.at || Date.now()));
        const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        ctx.fillStyle = "#fff";
        ctx.font = "11px system-ui";
        ctx.fillText(`${stamp} • ${String(row.type).toUpperCase()} • ${row.note || ""}`, x + 18, ry);
      });
    }
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };
    const topReserved = Number(state?.ui?.hudReservedTop || 108);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    const bg = getImgSafe(this.assets, "background") || getImgSafe(this.assets, "trade") || null;
    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 12;
    const panelY = safe.y + topReserved + 8;
    const panelW = safe.w - 24;
    const panelH = safe.h - topReserved - bottomReserved - 18;

    drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 28);
    const innerX = panelX + 12;
    const innerY = panelY + 12;
    const innerW = panelW - 24;
    const innerH = panelH - 24;

    this.hitClose = null;
    this.hitTabs = [];
    this.hitWalletButtons = [];
    this.hitEditAvatar = null;
    this.hitLeaderboard = null;

    this._drawTopBar(ctx, innerX, innerY, innerW);

    const contentX = innerX;
    const contentY = innerY + 68;
    const contentW = innerW;
    const contentH = innerH - 68;

    if (this._profileTab() === "wallet") {
      this._drawWalletTab(ctx, contentX, contentY, contentW, contentH, state);
    } else {
      this._drawProfileTab(ctx, contentX, contentY, contentW, contentH, state);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(300, panelW - 40);
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 12;
      drawGlassPanel(ctx, tx, ty, tw, th, 14);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 12px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2 + 1);
    }
  }
}
