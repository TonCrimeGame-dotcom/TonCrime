function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

function moneyFmt(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toLocaleString("tr-TR") : "0";
}

function makeImage(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}

function textFit(ctx, text, maxWidth, startSize, weight = 900, family = "system-ui") {
  let size = startSize;
  while (size > 10) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return 10;
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

function drawSoftGlow(ctx, x, y, w, h, color = "rgba(255,170,80,0.08)", blur = 18) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, 22);
  ctx.restore();
}

function drawDivider(ctx, x1, y1, x2, y2, alpha = 0.12) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawButtonPlate(ctx, x, y, w, h, accent = "muted") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (accent === "gold") {
    g.addColorStop(0, "rgba(177,124,43,0.60)");
    g.addColorStop(1, "rgba(79,49,14,0.74)");
  } else if (accent === "blue") {
    g.addColorStop(0, "rgba(74,116,196,0.56)");
    g.addColorStop(1, "rgba(23,44,88,0.72)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0.04)");
  }

  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, 16);

  ctx.strokeStyle =
    accent === "gold"
      ? "rgba(255,211,128,0.28)"
      : accent === "blue"
      ? "rgba(137,178,255,0.30)"
      : "rgba(255,255,255,0.12)";

  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);

  const shine = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  shine.addColorStop(0, "rgba(255,255,255,0.14)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h * 0.42, 15);
}

function drawBadge(ctx, x, y, w, h, text, type = "green") {
  let fill = "#27d85c";
  let txt = "#ffffff";

  if (type === "gold") {
    fill = "#f1b24e";
    txt = "#2e1d08";
  }

  ctx.fillStyle = fill;
  fillRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = txt;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 11px system-ui";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

function drawBusinessArtwork(ctx, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#171d29");
  bg.addColorStop(1, "#0c1017");
  ctx.fillStyle = bg;
  fillRoundRect(ctx, x, y, w, h, 12);

  ctx.fillStyle = "#232b38";
  fillRoundRect(ctx, x + w * 0.08, y + h * 0.36, w * 0.42, h * 0.36, 6);
  ctx.fillStyle = "#202834";
  fillRoundRect(ctx, x + w * 0.52, y + h * 0.34, w * 0.26, h * 0.36, 6);

  ctx.fillStyle = "#ffb74d";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      fillRoundRect(ctx, x + w * (0.12 + c * 0.10), y + h * (0.41 + r * 0.12), w * 0.05, h * 0.06, 2);
    }
  }

  ctx.fillStyle = "#87c8ff";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      fillRoundRect(ctx, x + w * (0.56 + c * 0.10), y + h * (0.40 + r * 0.13), w * 0.06, h * 0.07, 2);
    }
  }
}

function drawCrateArtwork(ctx, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#1a1d25");
  bg.addColorStop(1, "#0d1118");
  ctx.fillStyle = bg;
  fillRoundRect(ctx, x, y, w, h, 12);

  const wood = ctx.createLinearGradient(x, y + h * 0.18, x, y + h * 0.82);
  wood.addColorStop(0, "#bb8a42");
  wood.addColorStop(0.5, "#805228");
  wood.addColorStop(1, "#4e321d");
  ctx.fillStyle = wood;

  fillRoundRect(ctx, x + w * 0.18, y + h * 0.34, w * 0.64, h * 0.34, 8);
  fillRoundRect(ctx, x + w * 0.18, y + h * 0.22, w * 0.64, h * 0.10, 7);

  ctx.fillStyle = "rgba(255,235,190,0.28)";
  fillRoundRect(ctx, x + w * 0.31, y + h * 0.34, w * 0.06, h * 0.34, 3);
  fillRoundRect(ctx, x + w * 0.63, y + h * 0.34, w * 0.06, h * 0.34, 3);

  ctx.fillStyle = "#f1d39c";
  fillRoundRect(ctx, x + w * 0.47, y + h * 0.44, w * 0.08, h * 0.10, 3);
}

function drawSkullArtwork(ctx, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#191c23");
  bg.addColorStop(1, "#0d1016");
  ctx.fillStyle = bg;
  fillRoundRect(ctx, x, y, w, h, 12);

  ctx.strokeStyle = "rgba(255,255,255,0.46)";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x + w * 0.24, y + h * 0.76);
  ctx.lineTo(x + w * 0.76, y + h * 0.24);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.76, y + h * 0.76);
  ctx.lineTo(x + w * 0.24, y + h * 0.24);
  ctx.stroke();

  ctx.fillStyle = "rgba(245,240,232,0.96)";
  ctx.beginPath();
  ctx.arc(x + w * 0.50, y + h * 0.40, w * 0.16, 0, Math.PI * 2);
  ctx.fill();

  fillRoundRect(ctx, x + w * 0.40, y + h * 0.50, w * 0.20, h * 0.11, 5);

  ctx.fillStyle = "#16171d";
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.40, w * 0.026, 0, Math.PI * 2);
  ctx.arc(x + w * 0.55, y + h * 0.40, w * 0.026, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.50, y + h * 0.45);
  ctx.lineTo(x + w * 0.47, y + h * 0.50);
  ctx.lineTo(x + w * 0.53, y + h * 0.50);
  ctx.closePath();
  ctx.fill();
}

function drawStatCard(ctx, x, y, w, h, title, value1, value2, art = "default") {
  drawGlassPanel(ctx, x, y, w, h, 20);

  const artX = x + 14;
  const artY = y + 14;
  const artW = w - 28;
  const artH = 74;

  if (art === "business") drawBusinessArtwork(ctx, artX, artY, artW, artH);
  else if (art === "crate") drawCrateArtwork(ctx, artX, artY, artW, artH);
  else if (art === "skull") drawSkullArtwork(ctx, artX, artY, artW, artH);
  else drawGlassPanel(ctx, artX, artY, artW, artH, 14);

  ctx.fillStyle = "#f3f6fb";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "900 12px system-ui";
  ctx.fillText(title, x + w / 2, y + 122);

  ctx.font = "900 18px system-ui";
  ctx.fillText(String(value1), x + w / 2, y + 146);

  if (value2 != null && value2 !== "") {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "800 12px system-ui";
    ctx.fillText(String(value2), x + w / 2, y + 165);
  }

  ctx.textAlign = "left";
}

export class ProfileScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.hitClose = null;
    this.hitEditAvatar = null;
    this.hitLeaderboard = null;

    this._avatarUrl = "";
    this._avatarImg = null;
  }

  onEnter() {}

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (!this.input?.justReleased?.()) return;

    if (this.hitClose && pointInRect(px, py, this.hitClose)) {
      this.scenes.go("home");
      return;
    }

    if (this.hitEditAvatar && pointInRect(px, py, this.hitEditAvatar)) {
      console.log("[ProfileScene] edit avatar yakında");
      return;
    }

    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      console.log("[ProfileScene] leaderboard yakında");
      return;
    }
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const p = state.player || {};
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };
    const topReserved = Number(state?.ui?.hudReservedTop || 108);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    const bg =
      getImgSafe(this.assets, "background") ||
      getImgSafe(this.assets, "trade") ||
      null;

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
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(
      w * 0.5,
      h * 0.44,
      30,
      w * 0.5,
      h * 0.44,
      Math.max(w, h) * 0.80
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,0.18)");
    vignette.addColorStop(1, "rgba(0,0,0,0.60)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 12;
    const panelY = safe.y + topReserved + 8;
    const panelW = safe.w - 24;
    const panelH = safe.h - topReserved - bottomReserved - 18;

    drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 28);
    drawSoftGlow(ctx, panelX, panelY, panelW, panelH, "rgba(255,170,80,0.05)", 22);

    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#ff9d4d";
    fillRoundRect(ctx, panelX + panelW - 120, panelY + 18, 82, 82, 28);
    ctx.fillStyle = "#3c79ff";
    fillRoundRect(ctx, panelX + 24, panelY + panelH - 140, 98, 98, 28);
    ctx.restore();

    const innerX = panelX + 14;
    const innerY = panelY + 14;
    const innerW = panelW - 28;
    const innerH = panelH - 28;

    drawGlassPanel(ctx, innerX, innerY, innerW, innerH, 22);

    const username = String(p.username || "Player").trim() || "Player";
    const playerId = String(p.telegramId || p.id || "test_user");
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    const businessesOwned = Array.isArray(state?.businesses?.owned)
      ? state.businesses.owned.length
      : 0;

    const inventoryList = Array.isArray(state?.inventory?.items)
      ? state.inventory.items
      : [];

    const inventoryItems = inventoryList.reduce(
      (sum, item) => sum + Math.max(0, Number(item.qty || 0)),
      0
    );

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
    const kdText = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? String(wins) : "0.00";
    const topRank = clamp(999 - wins, 1, 999);

    const isPremium = !!(
      state.premium ||
      p.premium ||
      p.isPremium ||
      p.membership === "premium"
    );

    const heroX = innerX + 8;
    const heroY = innerY + 8;
    const heroW = innerW - 16;
    const heroH = 158;

    drawGlassPanel(ctx, heroX, heroY, heroW, heroH, 22);

    this.hitClose = {
      x: heroX + heroW - 48,
      y: heroY + 12,
      w: 36,
      h: 36
    };
    drawButtonPlate(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, "muted");

    ctx.fillStyle = "#f1f3f7";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 20px system-ui";
    ctx.fillText("X", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + this.hitClose.h / 2 + 1);

    const avatarFrameX = heroX + 16;
    const avatarFrameY = heroY + 16;
    const avatarFrameW = 108;
    const avatarFrameH = 112;

    drawGlassPanel(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18);

    const avatarX = avatarFrameX + 10;
    const avatarY = avatarFrameY + 10;
    const avatarW = avatarFrameW - 20;
    const avatarH = avatarFrameH - 20;

    const avatarUrl = getPlayerAvatar(p);
    if (avatarUrl !== this._avatarUrl) {
      this._avatarUrl = avatarUrl;
      this._avatarImg = makeImage(avatarUrl);
    }

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

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, avatarX + 0.5, avatarY + 0.5, avatarW - 1, avatarH - 1, 14);

    if (isPremium) {
      drawBadge(ctx, avatarFrameX + 8, avatarFrameY - 10, 42, 22, "VIP", "gold");
    }

    drawBadge(ctx, avatarFrameX + 8, avatarFrameY + avatarFrameH - 24, 70, 20, "ONLINE", "green");

    const infoX = avatarFrameX + avatarFrameW + 18;
    const infoY = heroY + 24;
    const infoW = heroW - (infoX - heroX) - 18;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const nameSize = textFit(ctx, username, infoW * 0.65, 28, 900);
    ctx.font = `900 ${nameSize}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(username, infoX, infoY + 12);

    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(`#${playerId}`, infoX, infoY + 36);

    drawDivider(ctx, infoX, infoY + 52, infoX + infoW, infoY + 52, 0.11);
    drawDivider(ctx, infoX + infoW * 0.52, infoY + 58, infoX + infoW * 0.52, infoY + 110, 0.11);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "900 16px system-ui";
    ctx.fillText("◉", infoX, infoY + 78);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 16px system-ui";
    ctx.fillText("Level", infoX + 26, infoY + 78);
    ctx.font = "900 18px system-ui";
    ctx.fillText(String(level), infoX + 96, infoY + 78);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "900 18px system-ui";
    ctx.fillText("⚡", infoX + infoW * 0.58, infoY + 78);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 16px system-ui";
    ctx.fillText("Energy", infoX + infoW * 0.58 + 34, infoY + 78);
    ctx.fillStyle = "#aef38a";
    ctx.font = "900 18px system-ui";
    ctx.fillText(`${energy}/${energyMax}`, infoX + infoW * 0.58 + 112, infoY + 78);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "900 16px system-ui";
    ctx.fillText("◉", infoX, infoY + 110);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 16px system-ui";
    ctx.fillText("Clan", infoX + 26, infoY + 110);
    ctx.font = "900 16px system-ui";
    ctx.fillText(clanName, infoX + 82, infoY + 110);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "900 16px system-ui";
    ctx.fillText("◉", infoX + infoW * 0.58, infoY + 110);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 16px system-ui";
    ctx.fillText("Total Value", infoX + infoW * 0.58 + 34, infoY + 110);
    ctx.font = "900 16px system-ui";
    ctx.fillText(moneyFmt(totalInventoryValue), infoX + infoW * 0.58 + 138, infoY + 110);

    const cardsY = heroY + heroH + 14;
    const cardGap = 12;
    const cardW = Math.floor((innerW - 16 - cardGap * 2) / 3);
    const cardH = 192;

    const card1X = innerX + 8;
    const card2X = card1X + cardW + cardGap;
    const card3X = card2X + cardW + cardGap;

    drawStatCard(ctx, card1X, cardsY, cardW, cardH, "BUSINESSES", `${businessesOwned} Owned`, "", "business");
    drawStatCard(ctx, card2X, cardsY, cardW, cardH, "INVENTORY", `${inventoryItems} Items`, "", "crate");

    drawGlassPanel(ctx, card3X, cardsY, cardW, cardH, 20);
    ctx.fillStyle = "#f3f6fb";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 12px system-ui";
    ctx.fillText("PVP STATS", card3X + cardW / 2, cardsY + 122);
    drawSkullArtwork(ctx, card3X + 14, cardsY + 14, cardW - 28, 74);
    ctx.font = "900 16px system-ui";
    ctx.fillText("WINS   LOSSES", card3X + cardW / 2, cardsY + 146);
    ctx.font = "900 18px system-ui";
    ctx.fillText(`${wins}      ${losses}`, card3X + cardW / 2, cardsY + 168);

    const statsY = cardsY + cardH + 14;
    const statsH = 84;
    const statsX = innerX + 8;
    const statsW = innerW - 16;

    drawGlassPanel(ctx, statsX, statsY, statsW, statsH, 20);

    const col1 = statsX + statsW / 6;
    const col2 = statsX + statsW / 2;
    const col3 = statsX + statsW * 5 / 6;

    drawDivider(ctx, statsX + statsW / 3, statsY + 14, statsX + statsW / 3, statsY + statsH - 14, 0.10);
    drawDivider(ctx, statsX + statsW * 2 / 3, statsY + 14, statsX + statsW * 2 / 3, statsY + statsH - 14, 0.10);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "800 12px system-ui";
    ctx.fillText("Win Rate", col1, statsY + 22);
    ctx.fillText("Kill / Death", col2, statsY + 22);
    ctx.fillText("Top Rank", col3, statsY + 22);

    ctx.fillStyle = "#ffbf55";
    ctx.font = "900 22px system-ui";
    ctx.fillText(`${winRate}%`, col1, statsY + 58);

    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(kdText, col2, statsY + 58);

    ctx.fillStyle = "#ffbf55";
    ctx.fillText(`#${topRank}`, col3, statsY + 52);
    ctx.font = "900 18px system-ui";
    ctx.fillText("♛", col3, statsY + 72);

    const btnY = statsY + statsH + 16;
    const btnGap = 16;
    const btnW = Math.floor((statsW - btnGap) / 2);
    const btnH = 54;

    this.hitEditAvatar = { x: statsX, y: btnY, w: btnW, h: btnH };
    this.hitLeaderboard = { x: statsX + btnW + btnGap, y: btnY, w: btnW, h: btnH };

    drawButtonPlate(ctx, this.hitEditAvatar.x, this.hitEditAvatar.y, this.hitEditAvatar.w, this.hitEditAvatar.h, "blue");
    drawButtonPlate(ctx, this.hitLeaderboard.x, this.hitLeaderboard.y, this.hitLeaderboard.w, this.hitLeaderboard.h, "gold");

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 18px system-ui";
    ctx.fillText("📷  EDIT AVATAR", this.hitEditAvatar.x + this.hitEditAvatar.w / 2, this.hitEditAvatar.y + this.hitEditAvatar.h / 2 + 1);
    ctx.fillText("🏆  LEADERBOARD", this.hitLeaderboard.x + this.hitLeaderboard.w / 2, this.hitLeaderboard.y + this.hitLeaderboard.h / 2 + 1);
  }
}
