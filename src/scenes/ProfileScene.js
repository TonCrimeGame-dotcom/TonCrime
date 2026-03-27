
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, lw = 1) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function drawTextLines(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

function getImgSafe(assets, key) {
  if (!assets || !key) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

function getPlayerAvatar(player) {
  return String(
    player?.avatarUrl ||
    player?.avatar ||
    player?.photoUrl ||
    player?.photo_url ||
    player?.telegramPhotoUrl ||
    player?.telegram_photo_url ||
    ""
  ).trim();
}

function getInitials(name) {
  const raw = String(name || "").trim();
  if (!raw) return "TC";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

function moneyFmt(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toLocaleString("tr-TR") : "0";
}

function textFit(ctx, text, maxWidth, startSize, weight = 900, family = "system-ui") {
  let size = startSize;
  while (size > 11) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return 11;
}

function makeImage(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}

function getTelegramUrl() {
  return "https://t.me/TonCrimeEu";
}

function openTelegramLink() {
  const url = getTelegramUrl();
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return;
    }
  } catch (_) {}
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (_) {
    location.href = url;
  }
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
    this.hitWalletTab = null;
    this.hitProfileTab = null;
    this.hitTelegram = null;
    this.hitBoardClose = null;

    this._avatarUrl = "";
    this._avatarImg = null;
    this._fileInput = null;
    this.showLeaderboard = false;
  }

  onEnter() {
    this._ensureAvatarInput();
    this._seedLeaderboard();
    this.showLeaderboard = false;
  }

  onExit() {
    this.showLeaderboard = false;
  }

  _toast(text) {
    try {
      window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text } }));
    } catch (_) {}
  }

  _ensureAvatarInput() {
    if (this._fileInput) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await this._compressImage(file);
        const s = this.store.get() || {};
        const p = s.player || {};
        this.store.set({
          player: {
            ...p,
            avatarUrl: dataUrl,
          },
        });
        this._avatarUrl = "";
        this._avatarImg = null;
        this._toast("Avatar güncellendi");
      } catch (err) {
        console.error("[ProfileScene] avatar upload error:", err);
        this._toast("Avatar yüklenemedi");
      } finally {
        input.value = "";
      }
    });
    document.body.appendChild(input);
    this._fileInput = input;
  }

  _compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("read_error"));
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const size = 256;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            const scale = Math.max(size / img.width, size / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            const dx = (size - dw) * 0.5;
            const dy = (size - dh) * 0.5;
            ctx.fillStyle = "#101218";
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, dx, dy, dw, dh);
            let out = canvas.toDataURL("image/webp", 0.86);
            if (out.length > 360000) out = canvas.toDataURL("image/jpeg", 0.84);
            resolve(out);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("image_decode_error"));
        img.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  _seedLeaderboard() {
    try {
      const s = this.store.get() || {};
      const pvp = { ...(s.pvp || {}) };
      const p = s.player || {};
      const username = String(p.username || "Player").trim() || "Player";
      const board = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.map((x) => ({ ...x })) : [];
      const wins = Math.max(0, Number(pvp.wins || 0));
      const losses = Math.max(0, Number(pvp.losses || 0));
      const rating = Math.max(0, Number(pvp.rating || 1000));
      const score = rating + wins * 8;
      const next = board.filter((x) => x && String(x.name || "") !== username);
      next.push({
        id: String(p.telegramId || p.id || "player_main"),
        name: username,
        wins,
        losses,
        rating,
        score,
        updatedAt: Date.now(),
      });
      next.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      this.store.set({
        pvp: {
          ...pvp,
          leaderboard: next.slice(0, 50),
        },
      });
    } catch (err) {
      console.warn("[ProfileScene] leaderboard seed failed:", err);
    }
  }

  update() {
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;
    if (!this.input.justReleased()) return;

    if (this.showLeaderboard) {
      if (this.hitBoardClose && pointInRect(px, py, this.hitBoardClose)) {
        this.showLeaderboard = false;
        return;
      }
    }

    if (this.hitBack && pointInRect(px, py, this.hitBack)) {
      this.scenes.go("home");
      return;
    }
    if (this.hitClose && pointInRect(px, py, this.hitClose)) {
      this.scenes.go("home");
      return;
    }
    if (this.hitEditAvatar && pointInRect(px, py, this.hitEditAvatar)) {
      this._fileInput?.click();
      return;
    }
    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      this._seedLeaderboard();
      this.showLeaderboard = true;
      return;
    }
    if (this.hitTelegram && pointInRect(px, py, this.hitTelegram)) {
      openTelegramLink();
      return;
    }
    if (this.hitProfileTab && pointInRect(px, py, this.hitProfileTab)) {
      const s = this.store.get() || {};
      this.store.set({ ui: { ...(s.ui || {}), profileTab: "profile" } });
      return;
    }
    if (this.hitWalletTab && pointInRect(px, py, this.hitWalletTab)) {
      const s = this.store.get() || {};
      this.store.set({ ui: { ...(s.ui || {}), profileTab: "wallet" } });
      return;
    }
  }

  render(ctx, w, h) {
    const state = this.store.get() || {};
    const p = state.player || {};
    const pvp = state.pvp || {};
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };
    const requestedTab = String(state?.ui?.profileTab || "profile");

    const bg = getImgSafe(this.assets, "background") || getImgSafe(this.assets, "trade") || getImgSafe(this.assets, "pvp_bg") || null;
    if (bg && bg.width) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (w - dw) * 0.5, (h - dh) * 0.5, dw, dh);
    } else {
      ctx.fillStyle = "#0a0d13";
      ctx.fillRect(0, 0, w, h);
    }

    const veil = ctx.createLinearGradient(0, 0, 0, h);
    veil.addColorStop(0, "rgba(15,10,9,0.42)");
    veil.addColorStop(0.55, "rgba(8,12,18,0.54)");
    veil.addColorStop(1, "rgba(2,4,8,0.72)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(860, safe.w - 28);
    const panelH = Math.min(760, safe.h - 34);
    const panelX = safe.x + (safe.w - panelW) * 0.5;
    const panelY = safe.y + 12;

    const shellGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    shellGrad.addColorStop(0, "rgba(18,14,16,0.84)");
    shellGrad.addColorStop(0.48, "rgba(10,14,22,0.88)");
    shellGrad.addColorStop(1, "rgba(5,8,14,0.94)");
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 24, shellGrad);
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 24, "rgba(255,180,94,0.18)", 1.2);

    const gloss = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH * 0.42);
    gloss.addColorStop(0, "rgba(255,255,255,0.12)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    fillRoundRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH * 0.36, 24, gloss);

    const innerPad = 14;
    const innerX = panelX + innerPad;
    const innerY = panelY + innerPad;
    const innerW = panelW - innerPad * 2;
    const innerH = panelH - innerPad * 2;

    const headH = 62;
    const headGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + headH);
    headGrad.addColorStop(0, "rgba(20,24,34,0.84)");
    headGrad.addColorStop(1, "rgba(8,10,16,0.92)");
    fillRoundRect(ctx, innerX, innerY, innerW, headH, 18, headGrad);
    strokeRoundRect(ctx, innerX, innerY, innerW, headH, 18, "rgba(255,255,255,0.10)", 1);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 30px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText("PROFILE", innerX + innerW * 0.46, innerY + headH / 2);
    ctx.fillStyle = "#f1ad58";
    ctx.fillText(requestedTab === "wallet" ? "WALLET" : "TONCRIME", innerX + innerW * 0.64, innerY + headH / 2);

    const tabW = 112;
    const tabH = 34;
    const tabsY = innerY + headH + 10;
    this.hitProfileTab = { x: innerX + 6, y: tabsY, w: tabW, h: tabH };
    this.hitWalletTab = { x: innerX + 6 + tabW + 10, y: tabsY, w: tabW, h: tabH };

    const drawTab = (r, active, label) => {
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 14, active ? "rgba(255,176,82,0.18)" : "rgba(255,255,255,0.05)");
      strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 14, active ? "rgba(255,176,82,0.62)" : "rgba(255,255,255,0.10)", 1);
      ctx.fillStyle = active ? "#ffd494" : "rgba(255,255,255,0.82)";
      ctx.font = "800 14px system-ui";
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    };
    drawTab(this.hitProfileTab, requestedTab !== "wallet", "Profil");
    drawTab(this.hitWalletTab, requestedTab === "wallet", "Cüzdan");

    this.hitClose = { x: innerX + innerW - 44, y: innerY + 10, w: 32, h: 32 };
    fillRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10, "rgba(255,255,255,0.06)");
    strokeRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10, "rgba(255,255,255,0.12)", 1);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("×", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + this.hitClose.h / 2 + 1);

    const contentX = innerX;
    const contentY = tabsY + tabH + 12;
    const contentW = innerW;
    const contentH = innerH - headH - tabH - 26;

    const username = String(p.username || "Player").trim() || "Player";
    const playerId = String(p.telegramId || p.id || window.tcGetProfileKey?.() || "guest");
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));
    const totalFight = wins + losses;
    const winRate = totalFight > 0 ? Math.round((wins / totalFight) * 100) : 0;
    const kdText = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? String(wins) : "0.00";
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const leaderboard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)) : [];
    const myRank = Math.max(1, leaderboard.findIndex((x) => String(x.name || "") === username) + 1 || 1);

    if (requestedTab === "wallet") {
      const cardX = contentX;
      const cardY = contentY;
      const cardW = contentW;
      const cardH = contentH;
      const g = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      g.addColorStop(0, "rgba(17,19,28,0.88)");
      g.addColorStop(1, "rgba(6,9,14,0.96)");
      fillRoundRect(ctx, cardX, cardY, cardW, cardH, 20, g);
      strokeRoundRect(ctx, cardX, cardY, cardW, cardH, 20, "rgba(255,255,255,0.10)", 1);

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "900 28px system-ui";
      ctx.fillStyle = "#f3f6fb";
      ctx.fillText("CÜZDAN", cardX + 28, cardY + 34);
      ctx.font = "700 13px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText("YTON bakiyesi ve topluluk erişimi", cardX + 28, cardY + 58);

      fillRoundRect(ctx, cardX + 22, cardY + 90, cardW - 44, 120, 18, "rgba(255,174,80,0.10)");
      strokeRoundRect(ctx, cardX + 22, cardY + 90, cardW - 44, 120, 18, "rgba(255,184,90,0.22)", 1);
      ctx.font = "800 14px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillText("Mevcut Bakiye", cardX + 42, cardY + 122);
      ctx.font = "900 38px system-ui";
      ctx.fillStyle = "#f6c46b";
      ctx.fillText(`${moneyFmt(yton)} YTON`, cardX + 42, cardY + 162);

      fillRoundRect(ctx, cardX + 22, cardY + 228, cardW - 44, 136, 18, "rgba(255,255,255,0.04)");
      strokeRoundRect(ctx, cardX + 22, cardY + 228, cardW - 44, 136, 18, "rgba(255,255,255,0.08)", 1);
      ctx.font = "900 18px system-ui";
      ctx.fillStyle = "#f3f6fb";
      ctx.fillText("Oyuncu Bilgisi", cardX + 42, cardY + 258);
      ctx.font = "700 13px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(`Oyuncu: ${username}`, cardX + 42, cardY + 292);
      ctx.fillText(`Enerji: ${energy}/${energyMax}`, cardX + 42, cardY + 318);
      ctx.fillText(`Seviye: ${level} • Rating: ${rating}`, cardX + 42, cardY + 344);

      this.hitTelegram = { x: cardX + 22, y: cardY + 386, w: Math.min(240, cardW - 44), h: 54 };
      fillRoundRect(ctx, this.hitTelegram.x, this.hitTelegram.y, this.hitTelegram.w, this.hitTelegram.h, 16, "rgba(255,176,82,0.16)");
      strokeRoundRect(ctx, this.hitTelegram.x, this.hitTelegram.y, this.hitTelegram.w, this.hitTelegram.h, 16, "rgba(255,176,82,0.36)", 1);
      ctx.fillStyle = "#f7d28f";
      ctx.font = "900 18px system-ui";
      ctx.fillText("TonCrime Telegram", this.hitTelegram.x + 22, this.hitTelegram.y + this.hitTelegram.h / 2);
      ctx.font = "700 12px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText("Topluluğa git", this.hitTelegram.x + this.hitTelegram.w - 86, this.hitTelegram.y + this.hitTelegram.h / 2 + 1);

      this.hitBack = { x: contentX, y: panelY + panelH - 54, w: 96, h: 36 };
      fillRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 14, "rgba(255,255,255,0.08)");
      strokeRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 14, "rgba(255,255,255,0.12)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "900 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("← Geri", this.hitBack.x + this.hitBack.w / 2, this.hitBack.y + this.hitBack.h / 2 + 1);
      return;
    }

    const heroH = 176;
    const heroX = contentX;
    const heroY = contentY;
    const heroW = contentW;
    const heroGrad = ctx.createLinearGradient(heroX, heroY, heroX, heroY + heroH);
    heroGrad.addColorStop(0, "rgba(19,21,30,0.86)");
    heroGrad.addColorStop(1, "rgba(8,10,16,0.94)");
    fillRoundRect(ctx, heroX, heroY, heroW, heroH, 18, heroGrad);
    strokeRoundRect(ctx, heroX, heroY, heroW, heroH, 18, "rgba(255,255,255,0.10)", 1);

    const avatarFrameX = heroX + 18;
    const avatarFrameY = heroY + 18;
    const avatarFrameW = 138;
    const avatarFrameH = 122;
    fillRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,182,86,0.18)", 1);

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
      const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX, avatarY + avatarH);
      avGrad.addColorStop(0, "#323744");
      avGrad.addColorStop(1, "#171b24");
      ctx.fillStyle = avGrad;
      ctx.fillRect(avatarX, avatarY, avatarW, avatarH);
      ctx.fillStyle = "#f1f3f7";
      ctx.font = "900 38px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 1);
    }
    ctx.restore();
    strokeRoundRect(ctx, avatarX, avatarY, avatarW, avatarH, 14, "rgba(255,255,255,0.10)", 1);

    fillRoundRect(ctx, avatarFrameX + 10, avatarFrameY + avatarFrameH - 30, 82, 22, 11, "#27d85c");
    ctx.fillStyle = "#08130d";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ONLINE", avatarFrameX + 51, avatarFrameY + avatarFrameH - 19);

    const infoX = avatarFrameX + avatarFrameW + 22;
    const infoY = heroY + 24;
    const infoW = heroW - (infoX - heroX) - 18;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const nameSize = textFit(ctx, username, infoW - 20, 30, 900);
    ctx.font = `900 ${nameSize}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(username, infoX, infoY + 2);

    ctx.font = "700 14px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.52)";
    const idText = `#${playerId}`;
    const shortId = ctx.measureText(idText).width > infoW - 10 ? `#${playerId.slice(0, 28)}` : idText;
    ctx.fillText(shortId, infoX, infoY + 32);

    const statTop = infoY + 52;
    fillRoundRect(ctx, infoX, statTop, infoW, 78, 16, "rgba(255,255,255,0.04)");
    strokeRoundRect(ctx, infoX, statTop, infoW, 78, 16, "rgba(255,255,255,0.08)", 1);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(infoX + infoW * 0.5, statTop + 12);
    ctx.lineTo(infoX + infoW * 0.5, statTop + 66);
    ctx.stroke();

    ctx.fillStyle = "#f1b24e";
    ctx.font = "800 18px system-ui";
    ctx.fillText("Level", infoX + 20, statTop + 24);
    ctx.fillText("Energy", infoX + infoW * 0.5 + 20, statTop + 24);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 22px system-ui";
    ctx.fillText(String(level), infoX + 98, statTop + 24);
    ctx.fillStyle = "#9be67c";
    ctx.fillText(`${energy}/${energyMax}`, infoX + infoW * 0.5 + 108, statTop + 24);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "800 18px system-ui";
    ctx.fillText("Clan", infoX + 20, statTop + 56);
    ctx.fillText("YTON", infoX + infoW * 0.5 + 20, statTop + 56);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = `900 ${textFit(ctx, clanName, infoW * 0.5 - 100, 22)}px system-ui`;
    ctx.fillText(clanName, infoX + 82, statTop + 56);
    ctx.fillStyle = "#f6c46b";
    ctx.font = "900 22px system-ui";
    ctx.fillText(moneyFmt(yton), infoX + infoW * 0.5 + 92, statTop + 56);

    const cardsGap = 14;
    const cardW = (contentW - cardsGap * 2) / 3;
    const cardsY = heroY + heroH + 16;
    const statCardH = 184;
    const metricH = 102;
    const buttonsY = cardsY + statCardH + 16 + metricH + 18;

    const drawCard = (x, title, sub, topValue, botValue, icon) => {
      fillRoundRect(ctx, x, cardsY, cardW, statCardH, 18, "rgba(10,14,22,0.82)");
      strokeRoundRect(ctx, x, cardsY, cardW, statCardH, 18, "rgba(255,255,255,0.08)", 1);
      ctx.fillStyle = "#f3f6fb";
      ctx.font = "900 18px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(title, x + 18, cardsY + 26);
      ctx.font = "700 13px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.fillText(sub, x + 18, cardsY + 48);
      fillRoundRect(ctx, x + 18, cardsY + 70, cardW - 36, 58, 16, "rgba(255,176,82,0.08)");
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.font = "900 38px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(icon, x + cardW / 2, cardsY + 100);
      ctx.font = "900 30px system-ui";
      ctx.fillStyle = "#f3f6fb";
      ctx.fillText(topValue, x + cardW / 2, cardsY + 148);
      ctx.font = "800 15px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(botValue, x + cardW / 2, cardsY + 170);
    };

    const businessesOwned = Array.isArray(state?.businesses?.owned) ? state.businesses.owned.length : 0;
    const inventoryList = Array.isArray(state?.inventory?.items) ? state.inventory.items : [];
    const inventoryItems = inventoryList.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)), 0);
    drawCard(contentX, "BUSINESSES", "İşletme sahipliği", String(businessesOwned), "Owned", "▦");
    drawCard(contentX + cardW + cardsGap, "INVENTORY", "Envanter durumu", String(inventoryItems), "Items", "▤");
    drawCard(contentX + (cardW + cardsGap) * 2, "PVP STATS", "Rekabet profili", `${wins}-${losses}`, "Win / Loss", "☠");

    const metricX = contentX;
    const metricY = cardsY + statCardH + 16;
    fillRoundRect(ctx, metricX, metricY, contentW, metricH, 18, "rgba(10,14,22,0.82)");
    strokeRoundRect(ctx, metricX, metricY, contentW, metricH, 18, "rgba(255,255,255,0.08)", 1);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(metricX + contentW / 3, metricY + 16);
    ctx.lineTo(metricX + contentW / 3, metricY + metricH - 16);
    ctx.moveTo(metricX + contentW * 2 / 3, metricY + 16);
    ctx.lineTo(metricX + contentW * 2 / 3, metricY + metricH - 16);
    ctx.stroke();

    const mx1 = metricX + contentW / 6;
    const mx2 = metricX + contentW / 2;
    const mx3 = metricX + contentW * 5 / 6;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = "700 13px system-ui";
    ctx.fillText("Win Rate", mx1, metricY + 26);
    ctx.fillText("Kill / Death", mx2, metricY + 26);
    ctx.fillText("Top Rank", mx3, metricY + 26);
    ctx.fillStyle = "#f6be62";
    ctx.font = "900 28px system-ui";
    ctx.fillText(`${winRate}%`, mx1, metricY + 62);
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(kdText, mx2, metricY + 62);
    ctx.fillStyle = "#f6be62";
    ctx.fillText(`#${myRank}`, mx3, metricY + 62);

    const btnGap = 18;
    const btnW = (contentW - btnGap) / 2;
    const btnH = 56;
    this.hitEditAvatar = { x: contentX, y: buttonsY, w: btnW, h: btnH };
    this.hitLeaderboard = { x: contentX + btnW + btnGap, y: buttonsY, w: btnW, h: btnH };
    const drawBtn = (r, accent, label) => {
      fillRoundRect(ctx, r.x, r.y, r.w, r.h, 16, accent === "gold" ? "rgba(255,176,82,0.14)" : "rgba(80,140,255,0.14)");
      strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 16, accent === "gold" ? "rgba(255,176,82,0.34)" : "rgba(120,170,255,0.34)", 1);
      ctx.fillStyle = "#f3f6fb";
      ctx.font = "900 18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    };
    drawBtn(this.hitEditAvatar, "blue", "📷  Edit Avatar");
    drawBtn(this.hitLeaderboard, "gold", "🏆  Leaderboard");

    this.hitTelegram = { x: contentX + contentW - 210, y: heroY + 122, w: 190, h: 40 };
    fillRoundRect(ctx, this.hitTelegram.x, this.hitTelegram.y, this.hitTelegram.w, this.hitTelegram.h, 14, "rgba(255,176,82,0.12)");
    strokeRoundRect(ctx, this.hitTelegram.x, this.hitTelegram.y, this.hitTelegram.w, this.hitTelegram.h, 14, "rgba(255,176,82,0.26)", 1);
    ctx.fillStyle = "#f6cf8d";
    ctx.font = "800 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("TonCrime Telegram", this.hitTelegram.x + this.hitTelegram.w / 2, this.hitTelegram.y + this.hitTelegram.h / 2 + 1);

    this.hitBack = { x: contentX, y: panelY + panelH - 54, w: 96, h: 36 };
    fillRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 14, "rgba(255,255,255,0.08)");
    strokeRoundRect(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, 14, "rgba(255,255,255,0.12)", 1);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 14px system-ui";
    ctx.fillText("← Geri", this.hitBack.x + this.hitBack.w / 2, this.hitBack.y + this.hitBack.h / 2 + 1);

    if (this.showLeaderboard) {
      const ovW = Math.min(520, contentW - 28);
      const ovH = Math.min(460, contentH - 30);
      const ovX = panelX + (panelW - ovW) * 0.5;
      const ovY = panelY + 96;
      fillRoundRect(ctx, ovX, ovY, ovW, ovH, 20, "rgba(8,10,16,0.96)");
      strokeRoundRect(ctx, ovX, ovY, ovW, ovH, 20, "rgba(255,176,82,0.24)", 1);
      ctx.textAlign = "left";
      ctx.fillStyle = "#f3f6fb";
      ctx.font = "900 24px system-ui";
      ctx.fillText("Leaderboard", ovX + 22, ovY + 34);
      ctx.font = "700 12px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.fillText("Kayıtlar PvP sonuçlarından otomatik beslenir", ovX + 22, ovY + 56);
      this.hitBoardClose = { x: ovX + ovW - 48, y: ovY + 14, w: 30, h: 30 };
      fillRoundRect(ctx, this.hitBoardClose.x, this.hitBoardClose.y, this.hitBoardClose.w, this.hitBoardClose.h, 10, "rgba(255,255,255,0.06)");
      strokeRoundRect(ctx, this.hitBoardClose.x, this.hitBoardClose.y, this.hitBoardClose.w, this.hitBoardClose.h, 10, "rgba(255,255,255,0.10)", 1);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "900 18px system-ui";
      ctx.fillText("×", this.hitBoardClose.x + 15, this.hitBoardClose.y + 15);

      const list = leaderboard.length ? leaderboard.slice(0, 10) : [{ name: username, wins, losses, rating, score: rating + wins * 8 }];
      const rowH = 34;
      let rowY = ovY + 84;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const isMe = String(item.name || "") === username;
        fillRoundRect(ctx, ovX + 16, rowY, ovW - 32, rowH, 12, isMe ? "rgba(255,176,82,0.14)" : "rgba(255,255,255,0.04)");
        strokeRoundRect(ctx, ovX + 16, rowY, ovW - 32, rowH, 12, isMe ? "rgba(255,176,82,0.22)" : "rgba(255,255,255,0.05)", 1);
        ctx.textAlign = "left";
        ctx.fillStyle = isMe ? "#ffd494" : "#f3f6fb";
        ctx.font = "800 14px system-ui";
        ctx.fillText(`#${i + 1}`, ovX + 30, rowY + 22);
        ctx.fillText(String(item.name || "Player"), ovX + 72, rowY + 22);
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText(`${Number(item.wins || 0)}W/${Number(item.losses || 0)}L`, ovX + ovW - 138, rowY + 22);
        ctx.fillStyle = "#f6c46b";
        ctx.fillText(String(Number(item.rating || 1000)), ovX + ovW - 34, rowY + 22);
        rowY += rowH + 8;
      }
    }
  }
}
