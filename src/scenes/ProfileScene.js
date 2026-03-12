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

export class ProfileScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.hitBack = null;
    this.hitClose = null;
    this.hitEditAvatar = null;
    this.hitLeaderboard = null;
  }

  onEnter() {}

  update() {
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    if (!this.input.justReleased()) return;

    if (this.hitBack && pointInRect(px, py, this.hitBack)) {
      this.scenes.go("home");
      return;
    }

    if (this.hitClose && pointInRect(px, py, this.hitClose)) {
      this.scenes.go("home");
      return;
    }

    if (this.hitEditAvatar && pointInRect(px, py, this.hitEditAvatar)) {
      console.log("[PROFILE] avatar edit yakında");
      return;
    }

    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      console.log("[PROFILE] leaderboard yakında");
      return;
    }
  }

  render(ctx, w, h) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w, h };

    const bg = this.assets?.getImage?.("background") || this.assets?.get?.("background") || null;

    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#090a0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(3,5,10,0.68)";
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(760, safe.w - 24);
    const panelH = Math.min(650, safe.h - 30);
    const panelX = safe.x + (safe.w - panelW) / 2;
    const panelY = safe.y + 14;

    const headerH = 62;

    ctx.fillStyle = "rgba(8,10,18,0.82)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 24);

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 24);

    // header
    ctx.fillStyle = "rgba(14,16,24,0.92)";
    fillRoundRect(ctx, panelX + 8, panelY + 8, panelW - 16, headerH, 18);

    const headerGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
    headerGrad.addColorStop(0, "rgba(255,255,255,0.03)");
    headerGrad.addColorStop(0.5, "rgba(255,170,70,0.10)");
    headerGrad.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.strokeStyle = headerGrad;
    strokeRoundRect(ctx, panelX + 8.5, panelY + 8.5, panelW - 17, headerH - 1, 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PLAYER PROFILE", panelX + panelW / 2, panelY + 39);

    this.hitClose = { x: panelX + panelW - 64, y: panelY + 16, w: 40, h: 40 };
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    fillRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 12);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "900 24px system-ui";
    ctx.fillText("×", this.hitClose.x + 20, this.hitClose.y + 21);

    // main info block
    const infoX = panelX + 18;
    const infoY = panelY + 86;
    const infoW = panelW - 36;
    const infoH = 146;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, infoX, infoY, infoW, infoH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, infoX + 0.5, infoY + 0.5, infoW - 1, infoH - 1, 20);

    // avatar
    const avatarX = infoX + 14;
    const avatarY = infoY + 14;
    const avatarSize = 108;

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    fillRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 16);

    const avatarUrl = getPlayerAvatar(p);
    const img = (() => {
      if (!avatarUrl) return null;
      const tmp = new Image();
      tmp.src = avatarUrl;
      return tmp;
    })();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      roundRectPath(ctx, avatarX, avatarY, avatarSize, avatarSize, 16);
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      fillRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 16);
      ctx.fillStyle = "#fff";
      ctx.font = "900 34px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initial = String(p.username || "P").trim().slice(0, 1).toUpperCase() || "P";
      ctx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    }

    // premium badge
    const isPremium = !!(s.premium || p.premium || p.isPremium || p.membership === "premium");
    if (isPremium) {
      ctx.fillStyle = "#ffcc52";
      fillRoundRect(ctx, avatarX - 6, avatarY - 8, 42, 26, 10);
      ctx.fillStyle = "#1b1405";
      ctx.font = "900 14px system-ui";
      ctx.fillText("VIP", avatarX + 15, avatarY + 5);
    }

    // online badge
    ctx.fillStyle = "#28d85a";
    fillRoundRect(ctx, avatarX + 8, avatarY + avatarSize - 24, 74, 20, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "900 12px system-ui";
    ctx.fillText("ONLINE", avatarX + 45, avatarY + avatarSize - 14);

    // texts
    const nameX = avatarX + avatarSize + 24;
    const nameY = avatarY + 26;
    const username = String(p.username || "Player").trim() || "Player";
    const playerId = String(p.id || p.telegramId || "player_main");

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 24px system-ui";
    ctx.fillText(username, nameX, nameY);

    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "600 14px system-ui";
    ctx.fillText(`#${playerId}`, nameX, nameY + 30);

    const statTop = infoY + 78;
    const leftColX = nameX;
    const rightColX = infoX + infoW * 0.58;

    const energy = Number(p.energy || 0);
    const energyMax = Number(p.energyMax || 100);
    const level = Number(p.level || 1);

    const clanName =
      s?.clan?.name ||
      s?.clan?.tag ||
      "No Clan";

    const businessesOwned = Array.isArray(s?.businesses?.owned) ? s.businesses.owned.length : 0;
    const inventoryItems = Array.isArray(s?.inventory?.items)
      ? s.inventory.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
      : 0;

    const totalInventoryValue = Array.isArray(s?.inventory?.items)
      ? s.inventory.items.reduce((sum, item) => {
          const price =
            Number(item.marketPrice || item.sellPrice || item.price || 0);
          return sum + price * Number(item.qty || 0);
        }, 0)
      : 0;

    const wins = Number(s?.pvp?.wins || 0);
    const losses = Number(s?.pvp?.losses || 0);
    const totalFight = wins + losses;
    const winRate = totalFight > 0 ? Math.round((wins / totalFight) * 100) : 0;
    const kd = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? String(wins) : "0.00";

    ctx.fillStyle = "#f5f7fb";
    ctx.font = "700 17px system-ui";
    ctx.fillText(`🏅  Level ${level}`, leftColX, statTop);
    ctx.fillText(`⚡  Energy ${energy}/${energyMax}`, rightColX, statTop);

    ctx.fillText(`☀  Clan ${clanName}`, leftColX, statTop + 38);
    ctx.fillText(
      `💰  Total Value ${Number(totalInventoryValue).toLocaleString("tr-TR")}`,
      rightColX,
      statTop + 38
    );

    // cards row
    const cardGap = 14;
    const cardY = infoY + infoH + 16;
    const cardW = (infoW - cardGap * 2) / 3;
    const cardH = 152;

    const cards = [
      {
        x: infoX,
        y: cardY,
        title: "BUSINESSES",
        big: `${businessesOwned}`,
        sub: "Owned",
        icon: "🏢",
      },
      {
        x: infoX + cardW + cardGap,
        y: cardY,
        title: "INVENTORY",
        big: `${inventoryItems}`,
        sub: "Items",
        icon: "📦",
      },
      {
        x: infoX + (cardW + cardGap) * 2,
        y: cardY,
        title: "PVP STATS",
        big: `${wins}`,
        sub: `Wins • ${losses} Losses`,
        icon: "☠",
      },
    ];

    for (const c of cards) {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      fillRoundRect(ctx, c.x, c.y, cardW, cardH, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, c.x + 0.5, c.y + 0.5, cardW - 1, cardH - 1, 18);

      ctx.fillStyle = "#f1f4f8";
      ctx.textAlign = "center";
      ctx.font = "900 17px system-ui";
      ctx.fillText(c.title, c.x + cardW / 2, c.y + 26);

      ctx.font = "900 48px system-ui";
      ctx.fillText(c.icon, c.x + cardW / 2, c.y + 74);

      ctx.font = "900 18px system-ui";
      ctx.fillText(c.big, c.x + cardW / 2, c.y + 116);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "700 14px system-ui";
      ctx.fillText(c.sub, c.x + cardW / 2, c.y + 137);
    }

    // bottom stats row
    const statsY = cardY + cardH + 16;
    const statsH = 88;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    fillRoundRect(ctx, infoX, statsY, infoW, statsH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, infoX + 0.5, statsY + 0.5, infoW - 1, statsH - 1, 18);

    const col1 = infoX + infoW / 6;
    const col2 = infoX + infoW / 2;
    const col3 = infoX + (infoW * 5) / 6;

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 14px system-ui";
    ctx.fillText("Win Rate", col1, statsY + 24);
    ctx.fillText("Kill / Death", col2, statsY + 24);
    ctx.fillText("Top Rank", col3, statsY + 24);

    ctx.fillStyle = "#ffbe57";
    ctx.font = "900 24px system-ui";
    ctx.fillText(`${winRate}%`, col1, statsY + 56);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${wins} / ${losses}`, col2, statsY + 56);

    ctx.fillStyle = "#ffbe57";
    ctx.fillText(`#${clamp(999 - wins, 1, 999)}`, col3, statsY + 56);

    // buttons
    const btnY = statsY + statsH + 18;
    const btnW = (infoW - 14) / 2;
    const btnH = 58;

    this.hitEditAvatar = { x: infoX, y: btnY, w: btnW, h: btnH };
    this.hitLeaderboard = { x: infoX + btnW + 14, y: btnY, w: btnW, h: btnH };
    this.hitBack = { x: panelX + 16, y: panelY + panelH - 54, w: 100, h: 36 };

    const drawBtn = (r, text, icon) => {
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, "rgba(30,34,46,0.95)");
      g.addColorStop(1, "rgba(10,12,18,0.98)");
      ctx.fillStyle = g;
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 18);

      ctx.strokeStyle = "rgba(255,190,90,0.24)";
      strokeRoundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 18);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${icon}  ${text}`, r.x + r.w / 2, r.y + r.h / 2);
    };

    drawBtn(this.hitEditAvatar, "EDIT AVATAR", "📷");
    drawBtn(this.hitLeaderboard, "LEADERBOARD", "🏆");

    // mobile back helper
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    fillRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, this.hitBack.x + 0.5, this.hitBack.y + 0.5, this.hitBack.w - 1, this.hitBack.h - 1, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "800 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("← Geri", this.hitBack.x + this.hitBack.w / 2, this.hitBack.y + this.hitBack.h / 2);
  }
}
