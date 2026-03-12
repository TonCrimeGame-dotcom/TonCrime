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

function buildAvatarCache(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}

/* ===== ICON DRAW HELPERS ===== */

function drawSoftGlow(ctx, x, y, w, h, color) {
  ctx.save();
  const g = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    8,
    x + w / 2,
    y + h / 2,
    Math.max(w, h) * 0.7
  );
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - w * 0.15, y - h * 0.15, w * 1.3, h * 1.3);
  ctx.restore();
}

function drawBuildingIcon(ctx, x, y, w, h) {
  ctx.save();
  drawSoftGlow(ctx, x, y, w, h, "rgba(255,80,60,0.10)");

  const base = ctx.createLinearGradient(x, y, x, y + h);
  base.addColorStop(0, "#3c4658");
  base.addColorStop(1, "#171d28");

  ctx.fillStyle = base;
  fillRoundRect(ctx, x + w * 0.18, y + h * 0.18, w * 0.64, h * 0.64, 10);

  ctx.fillStyle = "#242c39";
  fillRoundRect(ctx, x + w * 0.30, y + h * 0.05, w * 0.40, h * 0.18, 8);

  ctx.fillStyle = "#0f141d";
  fillRoundRect(ctx, x + w * 0.42, y + h * 0.56, w * 0.16, h * 0.26, 6);

  const winCols = [0.28, 0.46, 0.64];
  const winRows = [0.28, 0.42, 0.56];
  ctx.fillStyle = "#7ed5ff";
  for (const cy of winRows) {
    for (const cx of winCols) {
      fillRoundRect(ctx, x + w * cx, y + h * cy, w * 0.08, h * 0.08, 3);
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, x + w * 0.18, y + h * 0.18, w * 0.64, h * 0.64, 10);
  ctx.restore();
}

function drawCrateIcon(ctx, x, y, w, h) {
  ctx.save();
  drawSoftGlow(ctx, x, y, w, h, "rgba(255,170,70,0.12)");

  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, "#7f6348");
  body.addColorStop(1, "#3d2c20");

  ctx.fillStyle = body;
  fillRoundRect(ctx, x + w * 0.16, y + h * 0.24, w * 0.68, h * 0.52, 10);

  ctx.fillStyle = "#a88663";
  fillRoundRect(ctx, x + w * 0.16, y + h * 0.16, w * 0.68, h * 0.16, 8);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  fillRoundRect(ctx, x + w * 0.30, y + h * 0.24, w * 0.08, h * 0.52, 5);
  fillRoundRect(ctx, x + w * 0.62, y + h * 0.24, w * 0.08, h * 0.52, 5);

  ctx.fillStyle = "#ceb08a";
  fillRoundRect(ctx, x + w * 0.45, y + h * 0.38, w * 0.10, h * 0.16, 5);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  strokeRoundRect(ctx, x + w * 0.16, y + h * 0.24, w * 0.68, h * 0.52, 10);
  ctx.restore();
}

function drawSkullEmblem(ctx, x, y, w, h) {
  ctx.save();
  drawSoftGlow(ctx, x, y, w, h, "rgba(255,70,70,0.14)");

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 3;

  // head
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.40, w * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // jaw
  fillRoundRect(ctx, x + w * 0.40, y + h * 0.50, w * 0.20, h * 0.12, 6);

  // eyes
  ctx.fillStyle = "#141820";
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.39, w * 0.03, 0, Math.PI * 2);
  ctx.arc(x + w * 0.55, y + h * 0.39, w * 0.03, 0, Math.PI * 2);
  ctx.fill();

  // nose
  ctx.beginPath();
  ctx.moveTo(x + w * 0.50, y + h * 0.44);
  ctx.lineTo(x + w * 0.47, y + h * 0.49);
  ctx.lineTo(x + w * 0.53, y + h * 0.49);
  ctx.closePath();
  ctx.fill();

  // crossed bones
  ctx.strokeStyle = "rgba(255,255,255,0.70)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x + w * 0.28, y + h * 0.72);
  ctx.lineTo(x + w * 0.72, y + h * 0.22);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.72, y + h * 0.72);
  ctx.lineTo(x + w * 0.28, y + h * 0.22);
  ctx.stroke();

  const boneEnds = [
    [0.24, 0.76], [0.32, 0.68],
    [0.68, 0.24], [0.76, 0.16],
    [0.24, 0.16], [0.32, 0.24],
    [0.68, 0.68], [0.76, 0.76],
  ];
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  for (const [bx, by] of boneEnds) {
    ctx.beginPath();
    ctx.arc(x + w * bx, y + h * by, w * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMiniStatBadge(ctx, x, y, w, h, accent) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(255,255,255,0.01)");
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, 12);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 12);

  ctx.fillStyle = accent;
  fillRoundRect(ctx, x + 8, y + 8, 4, h - 16, 3);
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

    this._avatarUrlCached = "";
    this._avatarImg = null;
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
      console.log("[ProfileScene] Edit Avatar yakında");
      return;
    }

    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      console.log("[ProfileScene] Leaderboard yakında");
      return;
    }
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const p = state.player || {};
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };

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
      ctx.fillStyle = "#090b11";
      ctx.fillRect(0, 0, w, h);
    }

    // dark cartel atmosphere
    ctx.fillStyle = "rgba(6,7,12,0.72)";
    ctx.fillRect(0, 0, w, h);

    const vignette = ctx.createRadialGradient(
      w * 0.5,
      h * 0.46,
      50,
      w * 0.5,
      h * 0.46,
      Math.max(w, h) * 0.72
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,0.18)");
    vignette.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(760, safe.w - 28);
    const panelH = Math.min(700, safe.h - 34);
    const panelX = safe.x + (safe.w - panelW) / 2;
    const panelY = safe.y + 14;

    // outer cartel frame
    const outerGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    outerGrad.addColorStop(0, "rgba(24,18,22,0.92)");
    outerGrad.addColorStop(1, "rgba(10,11,16,0.96)");
    ctx.fillStyle = outerGrad;
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

    // outer red glow
    ctx.save();
    ctx.shadowColor = "rgba(255,50,50,0.08)";
    ctx.shadowBlur = 26;
    ctx.strokeStyle = "rgba(255,100,80,0.10)";
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH - 2, 28);
    ctx.restore();

    // inner panel
    const innerX = panelX + 8;
    const innerY = panelY + 8;
    const innerW = panelW - 16;
    const innerH = panelH - 16;

    const innerGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerH);
    innerGrad.addColorStop(0, "rgba(19,20,29,0.96)");
    innerGrad.addColorStop(0.5, "rgba(12,13,20,0.97)");
    innerGrad.addColorStop(1, "rgba(9,10,16,0.98)");
    ctx.fillStyle = innerGrad;
    fillRoundRect(ctx, innerX, innerY, innerW, innerH, 22);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, innerX + 0.5, innerY + 0.5, innerW - 1, innerH - 1, 22);

    // subtle top shine
    const shine = ctx.createLinearGradient(innerX, innerY, innerX, innerY + 90);
    shine.addColorStop(0, "rgba(255,255,255,0.055)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    fillRoundRect(ctx, innerX, innerY, innerW, 90, 22);

    /* ===== HEADER ===== */
    const headerX = innerX + 10;
    const headerY = innerY + 10;
    const headerW = innerW - 20;
    const headerH = 64;

    const headerGrad = ctx.createLinearGradient(headerX, headerY, headerX, headerY + headerH);
    headerGrad.addColorStop(0, "rgba(30,22,24,0.94)");
    headerGrad.addColorStop(1, "rgba(15,15,21,0.98)");
    ctx.fillStyle = headerGrad;
    fillRoundRect(ctx, headerX, headerY, headerW, headerH, 18);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, headerX + 0.5, headerY + 0.5, headerW - 1, headerH - 1, 18);

    // center amber line
    const amberLine = ctx.createLinearGradient(headerX, 0, headerX + headerW, 0);
    amberLine.addColorStop(0, "rgba(255,180,80,0)");
    amberLine.addColorStop(0.5, "rgba(255,180,80,0.82)");
    amberLine.addColorStop(1, "rgba(255,180,80,0)");
    ctx.fillStyle = amberLine;
    fillRoundRect(ctx, headerX + headerW * 0.24, headerY + headerH - 4, headerW * 0.52, 2, 1);

    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PROFILE", headerX + headerW / 2, headerY + headerH / 2 + 1);

    this.hitClose = { x: headerX + headerW - 48, y: headerY + 12, w: 34, h: 34 };
    const closeGrad = ctx.createLinearGradient(
      this.hitClose.x,
      this.hitClose.y,
      this.hitClose.x,
      this.hitClose.y + this.hitClose.h
    );
    closeGrad.addColorStop(0, "rgba(255,255,255,0.08)");
    closeGrad.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = closeGrad;
    fillRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, this.hitClose.x + 0.5, this.hitClose.y + 0.5, this.hitClose.w - 1, this.hitClose.h - 1, 10);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("×", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + this.hitClose.h / 2 + 1);

    /* ===== DATA ===== */
    const username = String(p.username || "Player").trim() || "Player";
    const playerId = String(p.telegramId || p.id || "player_main");

    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    const businessesOwned = Array.isArray(state?.businesses?.owned)
      ? state.businesses.owned.length
      : 0;

    const inventoryList = Array.isArray(state?.inventory?.items)
      ? state.inventory.items
      : [];

    const inventoryItems = inventoryList.reduce((sum, item) => {
      return sum + Math.max(0, Number(item.qty || 0));
    }, 0);

    const totalInventoryValue = inventoryList.reduce((sum, item) => {
      const price = Number(item.marketPrice || item.sellPrice || item.price || 0);
      const qty = Number(item.qty || 0);
      return sum + Math.max(0, price * qty);
    }, 0);

    const clanName =
      String(
        state?.clan?.name ||
        state?.clan?.tag ||
        "No Clan"
      );

    const wins = Math.max(0, Number(state?.pvp?.wins || 0));
    const losses = Math.max(0, Number(state?.pvp?.losses || 0));
    const totalFight = wins + losses;
    const winRate = totalFight > 0 ? Math.round((wins / totalFight) * 100) : 0;
    const kdText =
      losses > 0
        ? (wins / losses).toFixed(2)
        : wins > 0
        ? String(wins)
        : "0.00";
    const topRank = clamp(999 - wins, 1, 999);

    const isPremium = !!(
      state.premium ||
      p.premium ||
      p.isPremium ||
      p.membership === "premium"
    );

    /* ===== HERO PROFILE CARD ===== */
    const heroX = innerX + 14;
    const heroY = headerY + headerH + 14;
    const heroW = innerW - 28;
    const heroH = 180;

    const heroGrad = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
    heroGrad.addColorStop(0, "rgba(26,25,36,0.88)");
    heroGrad.addColorStop(1, "rgba(13,14,21,0.94)");
    ctx.fillStyle = heroGrad;
    fillRoundRect(ctx, heroX, heroY, heroW, heroH, 24);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, heroX + 0.5, heroY + 0.5, heroW - 1, heroH - 1, 24);

    const redGlow = ctx.createLinearGradient(heroX, heroY, heroX + heroW, heroY);
    redGlow.addColorStop(0, "rgba(255,90,90,0)");
    redGlow.addColorStop(0.32, "rgba(255,90,90,0.07)");
    redGlow.addColorStop(0.72, "rgba(255,170,90,0.07)");
    redGlow.addColorStop(1, "rgba(255,90,90,0)");
    ctx.fillStyle = redGlow;
    fillRoundRect(ctx, heroX + 2, heroY + 2, heroW - 4, heroH * 0.44, 22);

    // avatar plate
    const avatarPlateX = heroX + 16;
    const avatarPlateY = heroY + 16;
    const avatarPlateW = 132;
    const avatarPlateH = 132;

    const avatarPlateGrad = ctx.createLinearGradient(
      avatarPlateX,
      avatarPlateY,
      avatarPlateX,
      avatarPlateY + avatarPlateH
    );
    avatarPlateGrad.addColorStop(0, "rgba(255,255,255,0.06)");
    avatarPlateGrad.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = avatarPlateGrad;
    fillRoundRect(ctx, avatarPlateX, avatarPlateY, avatarPlateW, avatarPlateH, 18);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, avatarPlateX + 0.5, avatarPlateY + 0.5, avatarPlateW - 1, avatarPlateH - 1, 18);

    const avatarX = avatarPlateX + 8;
    const avatarY = avatarPlateY + 8;
    const avatarS = avatarPlateW - 16;

    const avatarUrl = getPlayerAvatar(p);
    if (avatarUrl !== this._avatarUrlCached) {
      this._avatarUrlCached = avatarUrl;
      this._avatarImg = buildAvatarCache(avatarUrl);
    }

    ctx.save();
    roundRectPath(ctx, avatarX, avatarY, avatarS, avatarS, 16);
    ctx.clip();

    if (this._avatarImg && this._avatarImg.complete && this._avatarImg.naturalWidth > 0) {
      ctx.drawImage(this._avatarImg, avatarX, avatarY, avatarS, avatarS);
    } else {
      const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX, avatarY + avatarS);
      avGrad.addColorStop(0, "#3d404b");
      avGrad.addColorStop(1, "#22232c");
      ctx.fillStyle = avGrad;
      ctx.fillRect(avatarX, avatarY, avatarS, avatarS);

      ctx.fillStyle = "#f3f6fb";
      ctx.font = "900 44px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarS / 2, avatarY + avatarS / 2 + 2);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, avatarX + 0.5, avatarY + 0.5, avatarS - 1, avatarS - 1, 16);

    if (isPremium) {
      const vipX = avatarPlateX - 4;
      const vipY = avatarPlateY - 8;
      const vipW = 48;
      const vipH = 26;
      const vipGrad = ctx.createLinearGradient(vipX, vipY, vipX, vipY + vipH);
      vipGrad.addColorStop(0, "#ffe7a2");
      vipGrad.addColorStop(1, "#ffbe57");
      ctx.fillStyle = vipGrad;
      fillRoundRect(ctx, vipX, vipY, vipW, vipH, 10);
      ctx.fillStyle = "#2d1d08";
      ctx.font = "900 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VIP", vipX + vipW / 2, vipY + vipH / 2 + 1);
    }

    const onlineX = avatarPlateX + 10;
    const onlineY = avatarPlateY + avatarPlateH - 32;
    const onlineW = 76;
    const onlineH = 22;
    ctx.fillStyle = "rgba(32,216,93,0.96)";
    fillRoundRect(ctx, onlineX, onlineY, onlineW, onlineH, 10);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ONLINE", onlineX + onlineW / 2, onlineY + onlineH / 2 + 1);

    // right hero content
    const infoX = avatarPlateX + avatarPlateW + 20;
    const infoY = heroY + 24;
    const infoW = heroW - (infoX - heroX) - 18;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#f5f7fb";
    ctx.font = "900 30px system-ui";
    ctx.fillText(username, infoX, infoY + 4);

    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(`#${playerId}`, infoX, infoY + 34);

    // stat badges
    const badgeGap = 12;
    const badgeW = (infoW - badgeGap) / 2;
    const badgeH = 46;
    const badge1Y = infoY + 58;
    const badge2Y = badge1Y + badgeH + 12;

    const badgeAccent1 = "rgba(255,170,80,0.92)";
    const badgeAccent2 = "rgba(255,95,95,0.92)";
    const badgeAccent3 = "rgba(255,214,112,0.92)";
    const badgeAccent4 = "rgba(255,130,70,0.92)";

    const b1 = { x: infoX, y: badge1Y, w: badgeW, h: badgeH };
    const b2 = { x: infoX + badgeW + badgeGap, y: badge1Y, w: badgeW, h: badgeH };
    const b3 = { x: infoX, y: badge2Y, w: badgeW, h: badgeH };
    const b4 = { x: infoX + badgeW + badgeGap, y: badge2Y, w: badgeW, h: badgeH };

    drawMiniStatBadge(ctx, b1.x, b1.y, b1.w, b1.h, badgeAccent1);
    drawMiniStatBadge(ctx, b2.x, b2.y, b2.w, b2.h, badgeAccent2);
    drawMiniStatBadge(ctx, b3.x, b3.y, b3.w, b3.h, badgeAccent3);
    drawMiniStatBadge(ctx, b4.x, b4.y, b4.w, b4.h, badgeAccent4);

    const drawBadgeText = (r, label, value) => {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "700 11px system-ui";
      ctx.fillText(label, r.x + 18, r.y + 15);

      ctx.fillStyle = "#f3f6fb";
      ctx.font = "900 19px system-ui";
      ctx.fillText(value, r.x + 18, r.y + 31);
    };

    drawBadgeText(b1, "LEVEL", String(level));
    drawBadgeText(b2, "ENERGY", `${energy}/${energyMax}`);
    drawBadgeText(b3, "CLAN", clanName);
    drawBadgeText(b4, "TOTAL VALUE", moneyFmt(totalInventoryValue));

    /* ===== MID TILES ===== */
    const tileGap = 14;
    const tilesY = heroY + heroH + 16;
    const tileW = (heroW - tileGap * 2) / 3;
    const tileH = 172;

    const tiles = [
      {
        x: heroX,
        y: tilesY,
        w: tileW,
        h: tileH,
        title: "BUSINESSES",
        value: String(businessesOwned).padStart(2, "0"),
        label: "Owned Properties",
        accent: "rgba(255,90,90,0.16)",
        icon: "building",
      },
      {
        x: heroX + tileW + tileGap,
        y: tilesY,
        w: tileW,
        h: tileH,
        title: "INVENTORY",
        value: String(inventoryItems),
        label: "Stored Items",
        accent: "rgba(255,170,70,0.16)",
        icon: "crate",
      },
      {
        x: heroX + (tileW + tileGap) * 2,
        y: tilesY,
        w: tileW,
        h: tileH,
        title: "PVP STATS",
        value: `${wins}W`,
        label: `${losses} Losses`,
        accent: "rgba(255,70,70,0.16)",
        icon: "skull",
      },
    ];

    for (const tile of tiles) {
      const tg = ctx.createLinearGradient(tile.x, tile.y, tile.x, tile.y + tile.h);
      tg.addColorStop(0, "rgba(25,25,36,0.94)");
      tg.addColorStop(1, "rgba(11,12,18,0.98)");
      ctx.fillStyle = tg;
      fillRoundRect(ctx, tile.x, tile.y, tile.w, tile.h, 22);

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      strokeRoundRect(ctx, tile.x + 0.5, tile.y + 0.5, tile.w - 1, tile.h - 1, 22);

      const glowBar = ctx.createLinearGradient(tile.x, tile.y, tile.x + tile.w, tile.y);
      glowBar.addColorStop(0, "rgba(255,255,255,0)");
      glowBar.addColorStop(0.4, tile.accent);
      glowBar.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glowBar;
      fillRoundRect(ctx, tile.x + 8, tile.y + 8, tile.w - 16, 24, 10);

      ctx.fillStyle = "#f3f6fb";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 18px system-ui";
      ctx.fillText(tile.title, tile.x + tile.w / 2, tile.y + 22);

      const iconBoxX = tile.x + tile.w * 0.24;
      const iconBoxY = tile.y + 42;
      const iconBoxW = tile.w * 0.52;
      const iconBoxH = 62;

      ctx.fillStyle = "rgba(255,255,255,0.03)";
      fillRoundRect(ctx, iconBoxX, iconBoxY, iconBoxW, iconBoxH, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      strokeRoundRect(ctx, iconBoxX + 0.5, iconBoxY + 0.5, iconBoxW - 1, iconBoxH - 1, 14);

      if (tile.icon === "building") drawBuildingIcon(ctx, iconBoxX, iconBoxY, iconBoxW, iconBoxH);
      if (tile.icon === "crate") drawCrateIcon(ctx, iconBoxX, iconBoxY, iconBoxW, iconBoxH);
      if (tile.icon === "skull") drawSkullEmblem(ctx, iconBoxX, iconBoxY, iconBoxW, iconBoxH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 30px system-ui";
      ctx.fillText(tile.value, tile.x + tile.w / 2, tile.y + 126);

      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "700 14px system-ui";
      ctx.fillText(tile.label, tile.x + tile.w / 2, tile.y + 148);
    }

    /* ===== BOTTOM STATS STRIP ===== */
    const stripY = tilesY + tileH + 16;
    const stripH = 92;

    const stripGrad = ctx.createLinearGradient(heroX, stripY, heroX, stripY + stripH);
    stripGrad.addColorStop(0, "rgba(28,22,25,0.90)");
    stripGrad.addColorStop(1, "rgba(12,13,18,0.96)");
    ctx.fillStyle = stripGrad;
    fillRoundRect(ctx, heroX, stripY, heroW, stripH, 20);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, heroX + 0.5, stripY + 0.5, heroW - 1, stripH - 1, 20);

    const c1 = heroX + heroW / 6;
    const c2 = heroX + heroW / 2;
    const c3 = heroX + (heroW * 5) / 6;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.font = "700 13px system-ui";
    ctx.fillText("WIN RATE", c1, stripY + 22);
    ctx.fillText("K / D", c2, stripY + 22);
    ctx.fillText("TOP RANK", c3, stripY + 22);

    ctx.fillStyle = "#ffbe57";
    ctx.font = "900 28px system-ui";
    ctx.fillText(`${winRate}%`, c1, stripY + 56);

    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(kdText, c2, stripY + 56);

    ctx.fillStyle = "#ffbe57";
    ctx.fillText(`#${topRank}`, c3, stripY + 56);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(heroX + heroW / 3, stripY + 16);
    ctx.lineTo(heroX + heroW / 3, stripY + stripH - 16);
    ctx.moveTo(heroX + (heroW * 2) / 3, stripY + 16);
    ctx.lineTo(heroX + (heroW * 2) / 3, stripY + stripH - 16);
    ctx.stroke();

    /* ===== BUTTONS ===== */
    const btnY = stripY + stripH + 18;
    const btnGap = 14;
    const btnW = (heroW - btnGap) / 2;
    const btnH = 60;

    this.hitEditAvatar = { x: heroX, y: btnY, w: btnW, h: btnH };
    this.hitLeaderboard = { x: heroX + btnW + btnGap, y: btnY, w: btnW, h: btnH };

    const drawActionButton = (r, text, icon, activeAccent) => {
      const bgGrad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      bgGrad.addColorStop(0, "rgba(18,20,30,0.96)");
      bgGrad.addColorStop(1, "rgba(8,9,15,0.99)");
      ctx.fillStyle = bgGrad;
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 18);

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 18);

      const accent = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
      accent.addColorStop(0, "rgba(255,255,255,0)");
      accent.addColorStop(0.5, activeAccent);
      accent.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = accent;
      fillRoundRect(ctx, r.x + 16, r.y + r.h - 4, r.w - 32, 2, 1);

      ctx.fillStyle = "#f3f6fb";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 20px system-ui";
      ctx.fillText(`${icon}  ${text}`, r.x + r.w / 2, r.y + r.h / 2 + 1);
    };

    drawActionButton(this.hitEditAvatar, "EDIT AVATAR", "📷", "rgba(255,95,95,0.85)");
    drawActionButton(this.hitLeaderboard, "LEADERBOARD", "🏆", "rgba(255,180,80,0.85)");

    /* ===== BACK BUTTON ===== */
    this.hitBack = { x: heroX, y: innerY + innerH - 52, w: 102, h: 36 };

    const backGrad = ctx.createLinearGradient(
      this.hitBack.x,
      this.hitBack.y,
      this.hitBack.x,
      this.hitBack.y + this.hitBack.h
    );
    backGrad.addColorStop(0, "rgba(255,255,255,0.06)");
    backGrad.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = backGrad;
    fillRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 14);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, this.hitBack.x + 0.5, this.hitBack.y + 0.5, this.hitBack.w - 1, this.hitBack.h - 1, 14);

    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Geri", this.hitBack.x + this.hitBack.w / 2, this.hitBack.y + this.hitBack.h / 2 + 1);
  }
}
