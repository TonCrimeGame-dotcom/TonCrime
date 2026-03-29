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

function textFit(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let t = value;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  ctx.fillText(`${t}…`, x, y);
}

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
    if (lines.length >= maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length) {
    let t = lines[maxLines - 1] || "";
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    lines[maxLines - 1] = `${t}…`;
  }

  return lines;
}

function makeImage(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function fitFontSize(ctx, text, maxWidth, start, min = 11, weight = 900, family = "system-ui") {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(String(text || "")).width <= maxWidth) return size;
    size -= 1;
  }
  return min;
}

function getPointer(input) {
  return input?.pointer || input?.p || input?.mouse || input?.state?.pointer || { x: 0, y: 0 };
}

function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") {
    return !!input.isJustPressed("pointer") || !!input.isJustPressed("mouseLeft") || !!input.isJustPressed("touch");
  }
  return !!input?._justPressed || !!input?.mousePressed;
}

function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  return !!input?._justReleased;
}

function canvasCssSize(canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  if (rect?.width > 0 && rect?.height > 0) {
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  return {
    w: Math.max(1, Math.round((canvas?.width || window.innerWidth) / dpr)),
    h: Math.max(1, Math.round((canvas?.height || window.innerHeight) / dpr)),
  };
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

    this.buttons = [];
    this.layout = null;
    this.scrollArea = null;
    this.scrollY = 0;
    this.scrollMax = 0;
    this._dragScroll = null;

    this._avatarUrl = "";
    this._avatarImg = null;
    this._fileInput = null;
    this.showLeaderboard = false;
    this.hitBoardClose = null;
  }

  onEnter() {
    this._ensureAvatarInput();
    this._seedLeaderboard();
    this.showLeaderboard = false;
    this.scrollY = 0;
    this.scrollMax = 0;
    this._dragScroll = null;
  }

  onExit() {
    this.showLeaderboard = false;
    this._dragScroll = null;
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

  getState() {
    return this.store?.get ? this.store.get() : {};
  }

  getBackgroundImage() {
    return (
      (typeof this.assets?.getImage === "function" && (
        this.assets.getImage("clan_bg") ||
        this.assets.getImage("clan") ||
        this.assets.getImage("background") ||
        this.assets.getImage("pvp_bg")
      )) ||
      this.assets?.images?.clan_bg ||
      this.assets?.images?.clan ||
      this.assets?.images?.background ||
      this.assets?.images?.pvp_bg ||
      null
    );
  }

  getLayout(ctx) {
    const size = canvasCssSize(ctx.canvas);
    const w = size.w;
    const h = size.h;
    const state = this.getState();
    const safe = state.ui?.safe || { x: 0, y: 0, w, h };
    const mobile = safe.w < 760;
    const hudTop = Number(state.ui?.hudReservedTop || (mobile ? 84 : 96));
    const chatBottom = Number(state.ui?.chatReservedBottom || (mobile ? 74 : 88));
    const side = mobile ? 10 : Math.max(16, Math.floor(safe.w * 0.03));
    const top = Math.max(safe.y + 8, safe.y + hudTop + 6);
    const bottom = safe.y + safe.h - Math.max(8, chatBottom - 8);
    const panelX = safe.x + side;
    const panelY = top;
    const panelW = safe.w - side * 2;
    const panelH = Math.max(340, bottom - top);
    const headerH = mobile ? 68 : 74;
    const heroH = mobile ? 174 : 188;
    const tabH = mobile ? 38 : 42;
    const contentY = panelY + headerH + heroH + tabH + 28;
    const contentH = panelY + panelH - contentY - 14;

    return {
      mobile,
      w,
      h,
      safe,
      panelX,
      panelY,
      panelW,
      panelH,
      headerH,
      heroH,
      tabH,
      contentY,
      contentH,
      pad: mobile ? 14 : 18,
    };
  }

  drawBackground(ctx, w, h) {
    const bg = this.getBackgroundImage();
    if (bg?.width && bg?.height) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#130a08";
      ctx.fillRect(0, 0, w, h);
    }

    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(8,5,4,0.22)");
    shade.addColorStop(0.5, "rgba(18,9,5,0.12)");
    shade.addColorStop(1, "rgba(6,3,2,0.28)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  }

  beginScrollArea(ctx, x, y, w, h, contentH) {
    this.scrollMax = Math.max(0, Math.ceil(contentH - h));
    this.scrollY = clamp(this.scrollY, 0, this.scrollMax);
    this.scrollArea = { x, y, w, h };
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.clip();
  }

  endScrollArea(ctx) {
    ctx.restore();
  }

  drawScrollBar(ctx) {
    if (!this.scrollArea || this.scrollMax <= 0) return;
    const { x, y, w, h } = this.scrollArea;
    const trackX = x + w - 5;
    const trackY = y + 8;
    const trackH = h - 16;
    const thumbH = Math.max(36, Math.floor((h / (h + this.scrollMax)) * trackH));
    const travel = Math.max(0, trackH - thumbH);
    const thumbY = trackY + (travel * this.scrollY / Math.max(1, this.scrollMax));
    fillRoundRect(ctx, trackX, trackY, 3, trackH, 3, "rgba(255,255,255,0.10)");
    fillRoundRect(ctx, trackX, thumbY, 3, thumbH, 3, "rgba(245,195,111,0.88)");
  }

  estimateContentHeight(state, tab, layout) {
    if (tab === "wallet") return layout.mobile ? 480 : 420;
    const btnRow = 72;
    const cardRow = layout.mobile ? 440 : 256;
    const metrics = 112;
    const social = 120;
    const about = 120;
    return btnRow + cardRow + metrics + social + about + 40;
  }

  update() {
    const p = getPointer(this.input);
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);
    const isDown = typeof this.input?.isDown === "function" ? !!this.input.isDown() : !!this.input?._pressed;
    const pressed = justPressed(this.input);
    const released = justReleased(this.input);

    if (pressed && this.scrollArea && pointInRect(px, py, this.scrollArea)) {
      this._dragScroll = { startY: py, startScrollY: this.scrollY, moved: 0 };
    }

    if (isDown && this._dragScroll) {
      const dy = py - this._dragScroll.startY;
      this._dragScroll.moved = Math.max(this._dragScroll.moved, Math.abs(dy));
      this.scrollY = clamp(this._dragScroll.startScrollY - dy, 0, this.scrollMax || 0);
    }

    if (released) {
      const drag = this._dragScroll;
      this._dragScroll = null;
      if (drag && drag.moved > 8) return;
    }

    if (!pressed) return;

    for (const btn of this.buttons) {
      if (pointInRect(px, py, btn)) {
        btn.onClick?.();
        return;
      }
    }
  }

  render(ctx, w, h) {
    const state = this.getState();
    const L = this.layout = this.getLayout(ctx);

    this.buttons = [];
    this.scrollArea = null;
    this.hitBoardClose = null;

    this.drawBackground(ctx, L.w, L.h);
    this.drawShell(ctx, state, L);
  }

  drawShell(ctx, state, L) {
    const x = L.panelX;
    const y = L.panelY;
    const w = L.panelW;
    const h = L.panelH;
    const pad = L.pad;

    fillRoundRect(ctx, x, y, w, h, 24, "rgba(18,11,8,0.18)");
    strokeRoundRect(ctx, x, y, w, h, 24, "rgba(243,187,102,0.62)", 1.8);

    const gloss = ctx.createLinearGradient(x, y, x, y + h);
    gloss.addColorStop(0, "rgba(255,255,255,0.07)");
    gloss.addColorStop(1, "rgba(255,255,255,0.02)");
    fillRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, 23, gloss);

    this.drawHeader(ctx, state, L);
    this.drawHero(ctx, state, L);
    this.drawTabs(ctx, state, L);

    const tab = String(state?.ui?.profileTab || "profile");
    const viewportX = x + 10;
    const viewportY = L.contentY;
    const viewportW = w - 20;
    const viewportH = L.contentH;
    const contentH = this.estimateContentHeight(state, tab, L);

    this.beginScrollArea(ctx, viewportX, viewportY, viewportW, viewportH, contentH);
    const drawY = viewportY - this.scrollY;

    if (tab === "wallet") this.drawWalletContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);
    else this.drawProfileContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);

    this.endScrollArea(ctx);
    this.drawScrollBar(ctx);

    if (this.showLeaderboard) {
      this.drawLeaderboardOverlay(ctx, state, L);
    }
  }

  drawHeader(ctx, state, L) {
    const x = L.panelX + L.pad;
    const y = L.panelY + 12;
    const w = L.panelW - L.pad * 2;
    const h = L.headerH - 8;

    fillRoundRect(ctx, x, y, w, h, 18, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 18, "rgba(255,255,255,0.10)", 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `${L.mobile ? 20 : 24}px system-ui`;
    ctx.font = `700 ${L.mobile ? 20 : 24}px system-ui`;
    ctx.fillText("PROFILE", x + 16, y + 28);
    ctx.fillStyle = "rgba(255,220,170,0.86)";
    ctx.font = `500 ${L.mobile ? 12 : 14}px system-ui`;
    ctx.fillText("TonCrime oyuncu kartı", x + 16, y + 50);

    const closeSize = L.mobile ? 38 : 42;
    const closeBtn = {
      x: x + w - closeSize - 10,
      y: y + 10,
      w: closeSize,
      h: closeSize,
      onClick: () => this.scenes?.go?.("home"),
    };
    this.buttons.push(closeBtn);
    fillRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(12,12,14,0.42)");
    strokeRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${L.mobile ? 26 : 28}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawHero(ctx, state, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const x = L.panelX + L.pad;
    const y = L.panelY + L.headerH;
    const w = L.panelW - L.pad * 2;
    const h = L.heroH;

    fillRoundRect(ctx, x, y, w, h, 22, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 22, "rgba(255,193,111,0.42)", 1.2);

    const avatarFrameX = x + 16;
    const avatarFrameY = y + 16;
    const avatarFrameW = L.mobile ? 114 : 136;
    const avatarFrameH = L.mobile ? 118 : 132;

    fillRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,182,86,0.18)", 1);

    const avatarX = avatarFrameX + 10;
    const avatarY = avatarFrameY + 10;
    const avatarW = avatarFrameW - 20;
    const avatarH = avatarFrameH - 20;
    const username = String(p.username || "Player").trim() || "Player";
    const avatarUrl = getPlayerAvatar(p);
    if (avatarUrl !== this._avatarUrl) {
      this._avatarUrl = avatarUrl;
      this._avatarImg = makeImage(avatarUrl);
    }

    ctx.save();
    roundRectPath(ctx, avatarX, avatarY, avatarW, avatarH, 14);
    ctx.clip();
    if (!drawCoverImage(ctx, this._avatarImg, avatarX, avatarY, avatarW, avatarH)) {
      const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX, avatarY + avatarH);
      avGrad.addColorStop(0, "#323744");
      avGrad.addColorStop(1, "#171b24");
      ctx.fillStyle = avGrad;
      ctx.fillRect(avatarX, avatarY, avatarW, avatarH);
      ctx.fillStyle = "#f1f3f7";
      ctx.font = `900 ${L.mobile ? 34 : 38}px system-ui`;
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
    ctx.textBaseline = "middle";
    ctx.fillText("ONLINE", avatarFrameX + 51, avatarFrameY + avatarFrameH - 19);

    const infoX = avatarFrameX + avatarFrameW + 18;
    const infoY = y + 22;
    const infoW = w - (infoX - x) - 16;
    const playerId = String(p.telegramId || p.id || window.tcGetProfileKey?.() || "guest");
    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const nameSize = fitFontSize(ctx, username, infoW - 8, L.mobile ? 28 : 32, 16);
    ctx.font = `900 ${nameSize}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(username, infoX, infoY + 8);

    ctx.font = `500 ${L.mobile ? 12 : 13}px system-ui`;
    ctx.fillStyle = "rgba(255,255,255,0.56)";
    textFit(ctx, `#${playerId}`, infoX, infoY + 32, infoW - 10);

    const statCardY = infoY + 46;
    const gap = 10;
    const cardW = Math.floor((infoW - gap) / 2);
    const cardH = 48;

    this.drawMiniInfo(ctx, infoX, statCardY, cardW, cardH, "Level", String(level), `Rating ${rating}`);
    this.drawMiniInfo(ctx, infoX + cardW + gap, statCardY, cardW, cardH, "Energy", `${energy}/${energyMax}`, "Hazır durum");
    this.drawMiniInfo(ctx, infoX, statCardY + cardH + 10, cardW, cardH, "Clan", clanName, wins + losses > 0 ? `${wins}-${losses} skor` : "Henüz savaş yok");
    this.drawMiniInfo(ctx, infoX + cardW + gap, statCardY + cardH + 10, cardW, cardH, "YTON", moneyFmt(yton), p.weaponName || "Silah Yok");

    const tgBtn = {
      x: infoX,
      y: y + h - 48,
      w: Math.min(220, infoW),
      h: 32,
      onClick: () => openTelegramLink(),
    };
    this.buttons.push(tgBtn);
    fillRoundRect(ctx, tgBtn.x, tgBtn.y, tgBtn.w, tgBtn.h, 12, "rgba(243,187,102,0.16)");
    strokeRoundRect(ctx, tgBtn.x, tgBtn.y, tgBtn.w, tgBtn.h, 12, "rgba(243,187,102,0.36)", 1);
    ctx.fillStyle = "rgba(255,240,218,0.96)";
    ctx.font = `700 ${L.mobile ? 12 : 13}px system-ui`;
    ctx.fillText("TonCrime Telegram", tgBtn.x + 16, tgBtn.y + 21);
  }

  drawMiniInfo(ctx, x, y, w, h, label, value, sub) {
    fillRoundRect(ctx, x, y, w, h, 16, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, x, y, w, h, 16, "rgba(255,255,255,0.10)", 1);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = "500 11px system-ui";
    textFit(ctx, label, x + 12, y + 16, w - 24);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "700 16px system-ui";
    textFit(ctx, value, x + 12, y + 34, w - 24);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 10px system-ui";
    textFit(ctx, sub, x + 12, y + 48, w - 24);
  }

  drawTabs(ctx, state, L) {
    const x = L.panelX + L.pad;
    const y = L.panelY + L.headerH + L.heroH + 10;
    const w = L.panelW - L.pad * 2;
    const tab = String(state?.ui?.profileTab || "profile");
    const tabs = [
      { id: "profile", label: "Genel" },
      { id: "wallet", label: "Cüzdan" },
      { id: "leaderboard", label: "Sıralama" },
    ];
    const gap = 8;
    const tabW = Math.floor((w - gap * (tabs.length - 1)) / tabs.length);

    tabs.forEach((item, index) => {
      const tx = x + index * (tabW + gap);
      const active = (item.id === "leaderboard" ? this.showLeaderboard : tab === item.id);
      const btn = {
        x: tx,
        y,
        w: tabW,
        h: L.tabH,
        onClick: () => {
          if (item.id === "leaderboard") {
            this._seedLeaderboard();
            this.showLeaderboard = true;
            return;
          }
          const s = this.store.get() || {};
          this.store.set({ ui: { ...(s.ui || {}), profileTab: item.id } });
          this.showLeaderboard = false;
          this.scrollY = 0;
        },
      };
      this.buttons.push(btn);
      fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, active ? "rgba(243,187,102,0.20)" : "rgba(255,255,255,0.05)");
      strokeRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, active ? "rgba(243,187,102,0.62)" : "rgba(255,255,255,0.10)", 1);
      ctx.fillStyle = active ? "rgba(255,248,236,0.98)" : "rgba(255,255,255,0.82)";
      ctx.font = `700 ${L.mobile ? 12 : 13}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawSectionTitle(ctx, title, sub, x, y, w) {
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "700 18px system-ui";
    textFit(ctx, title, x, y, w);
    if (!sub) return;
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "500 12px system-ui";
    textFit(ctx, sub, x, y + 18, w);
  }

  drawCard(ctx, x, y, w, h) {
    fillRoundRect(ctx, x, y, w, h, 18, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 18, "rgba(255,255,255,0.10)", 1);
  }

  drawProfileContent(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const businessesOwned = Array.isArray(state?.businesses?.owned) ? state.businesses.owned.length : 0;
    const inventoryList = Array.isArray(state?.inventory?.items) ? state.inventory.items : [];
    const inventoryItems = inventoryList.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)), 0);
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));
    const totalFight = wins + losses;
    const winRate = totalFight > 0 ? Math.round((wins / totalFight) * 100) : 0;
    const kdText = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? String(wins) : "0.00";
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const leaderboard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)) : [];
    const username = String(p.username || "Player").trim() || "Player";
    const myRank = Math.max(1, leaderboard.findIndex((row) => String(row.name || "") === username) + 1 || 1);

    this.drawSectionTitle(ctx, "Profil Özeti", "Clan sayfasındaki sıcak cam tasarım ile sadeleştirildi.", x + 8, y + 20, w - 16);

    const topY = y + 40;
    const gap = 10;

    if (L.mobile) {
      const rowH = 98;
      this.drawStatCard(ctx, x + 8, topY, w - 16, rowH, "Businesses", String(businessesOwned), "Sahip olduğun işletmeler", "▦");
      this.drawStatCard(ctx, x + 8, topY + rowH + 10, w - 16, rowH, "Inventory", String(inventoryItems), "Envanter yoğunluğu", "▤");
      this.drawStatCard(ctx, x + 8, topY + (rowH + 10) * 2, w - 16, rowH, "PVP Record", `${wins}-${losses}`, "Kazanç / kayıp", "☠");
    } else {
      const cardW = Math.floor((w - 16 - gap * 2) / 3);
      const rowH = 172;
      this.drawStatCard(ctx, x + 8, topY, cardW, rowH, "Businesses", String(businessesOwned), "Sahip olduğun işletmeler", "▦");
      this.drawStatCard(ctx, x + 8 + cardW + gap, topY, cardW, rowH, "Inventory", String(inventoryItems), "Envanter yoğunluğu", "▤");
      this.drawStatCard(ctx, x + 8 + (cardW + gap) * 2, topY, cardW, rowH, "PVP Record", `${wins}-${losses}`, "Kazanç / kayıp", "☠");
    }

    const statGridY = L.mobile ? topY + 3 * 108 : topY + 186;
    this.drawCard(ctx, x + 8, statGridY, w - 16, 102);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(x + 8 + (w - 16) / 3, statGridY + 16);
    ctx.lineTo(x + 8 + (w - 16) / 3, statGridY + 86);
    ctx.moveTo(x + 8 + (w - 16) * 2 / 3, statGridY + 16);
    ctx.lineTo(x + 8 + (w - 16) * 2 / 3, statGridY + 86);
    ctx.stroke();

    const mx1 = x + 8 + (w - 16) / 6;
    const mx2 = x + 8 + (w - 16) / 2;
    const mx3 = x + 8 + (w - 16) * 5 / 6;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = "700 13px system-ui";
    ctx.fillText("Win Rate", mx1, statGridY + 26);
    ctx.fillText("K / D", mx2, statGridY + 26);
    ctx.fillText("Top Rank", mx3, statGridY + 26);
    ctx.fillStyle = "#f6be62";
    ctx.font = "900 28px system-ui";
    ctx.fillText(`${winRate}%`, mx1, statGridY + 64);
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(kdText, mx2, statGridY + 64);
    ctx.fillStyle = "#f6be62";
    ctx.fillText(`#${myRank}`, mx3, statGridY + 64);
    ctx.textAlign = "left";

    const btnY = statGridY + 118;
    const btnGap = 12;
    const btnW = Math.floor((w - 16 - btnGap) / 2);
    const editBtn = {
      x: x + 8,
      y: btnY,
      w: btnW,
      h: 48,
      onClick: () => this._fileInput?.click(),
    };
    const boardBtn = {
      x: x + 8 + btnW + btnGap,
      y: btnY,
      w: btnW,
      h: 48,
      onClick: () => {
        this._seedLeaderboard();
        this.showLeaderboard = true;
      },
    };
    this.buttons.push(editBtn, boardBtn);
    this.drawActionButton(ctx, editBtn, "rgba(90,140,255,0.14)", "rgba(120,170,255,0.34)", "📷 Edit Avatar");
    this.drawActionButton(ctx, boardBtn, "rgba(243,187,102,0.14)", "rgba(243,187,102,0.34)", "🏆 Leaderboard");

    const socialY = btnY + 64;
    this.drawCard(ctx, x + 8, socialY, w - 16, 96);
    this.drawSectionTitle(ctx, "Topluluk", "Telegram bağlantısı ve oyuncu kimliği.", x + 22, socialY + 22, w - 44);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 12px system-ui";
    const socialText = wrapText(ctx, `Oyuncu adı ${username} • Silah ${String(p.weaponName || "Silah Yok")} • Rating ${rating}`, w - 200, 2);
    socialText.forEach((line, i) => ctx.fillText(line, x + 22, socialY + 48 + i * 16));

    const tgBtn = {
      x: x + w - 194,
      y: socialY + 28,
      w: 170,
      h: 36,
      onClick: () => openTelegramLink(),
    };
    this.buttons.push(tgBtn);
    this.drawActionButton(ctx, tgBtn, "rgba(243,187,102,0.16)", "rgba(243,187,102,0.34)", "TonCrime Telegram", 13);

    const aboutY = socialY + 110;
    this.drawCard(ctx, x + 8, aboutY, w - 16, 104);
    this.drawSectionTitle(ctx, "Oyuncu Notu", "Bu alan profil kartını daha temiz göstermek için sade tutuldu.", x + 22, aboutY + 22, w - 44);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 12px system-ui";
    const lines = wrapText(ctx, `Seviye ${Math.max(1, Number(p.level || 1))} oyuncu. Enerji ${Math.max(0, Number(p.energy || 0))}/${Math.max(1, Number(p.energyMax || 100))}. Clan ${String(state?.clan?.name || state?.clan?.tag || "bağlı değil")}.`, w - 44, 3);
    lines.forEach((line, i) => ctx.fillText(line, x + 22, aboutY + 48 + i * 16));
  }

  drawWalletContent(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const rating = Math.max(0, Number(state?.pvp?.rating || 1000));
    const username = String(p.username || "Player").trim() || "Player";

    this.drawSectionTitle(ctx, "Cüzdan", "Clan sayfası düzeninde daha sade bakiye görünümü.", x + 8, y + 20, w - 16);

    this.drawCard(ctx, x + 8, y + 42, w - 16, 128);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = "500 13px system-ui";
    ctx.fillText("Mevcut Bakiye", x + 24, y + 72);
    ctx.fillStyle = "#f6c46b";
    ctx.font = `900 ${L.mobile ? 34 : 40}px system-ui`;
    ctx.fillText(`${moneyFmt(yton)} YTON`, x + 24, y + 118);
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Oyuncu ekonomisi bu bakiyeden ilerler.", x + 24, y + 144);

    const statY = y + 184;
    const gap = 10;
    const cardW = L.mobile ? w - 16 : Math.floor((w - 16 - gap * 2) / 3);
    if (L.mobile) {
      this.drawStatCard(ctx, x + 8, statY, cardW, 86, "Oyuncu", username, "Ana profil", "👤");
      this.drawStatCard(ctx, x + 8, statY + 96, cardW, 86, "Enerji", `${energy}/${energyMax}`, "Hazır durum", "⚡");
      this.drawStatCard(ctx, x + 8, statY + 192, cardW, 86, "Rating", String(rating), "PvP değeri", "★");
    } else {
      this.drawStatCard(ctx, x + 8, statY, cardW, 146, "Oyuncu", username, "Ana profil", "👤");
      this.drawStatCard(ctx, x + 8 + cardW + gap, statY, cardW, 146, "Enerji", `${energy}/${energyMax}`, "Hazır durum", "⚡");
      this.drawStatCard(ctx, x + 8 + (cardW + gap) * 2, statY, cardW, 146, "Rating", String(rating), "PvP değeri", "★");
    }

    const tgY = L.mobile ? statY + 298 : statY + 160;
    const tgBtn = {
      x: x + 8,
      y: tgY,
      w: Math.min(240, w - 16),
      h: 48,
      onClick: () => openTelegramLink(),
    };
    this.buttons.push(tgBtn);
    this.drawActionButton(ctx, tgBtn, "rgba(243,187,102,0.16)", "rgba(243,187,102,0.34)", "TonCrime Telegram", 14);
  }

  drawStatCard(ctx, x, y, w, h, title, value, sub, icon) {
    this.drawCard(ctx, x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "700 17px system-ui";
    textFit(ctx, title, x + 16, y + 24, w - 32);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 12px system-ui";
    textFit(ctx, sub, x + 16, y + 44, w - 32);
    fillRoundRect(ctx, x + 16, y + 58, w - 32, Math.min(58, h - 74), 16, "rgba(255,176,82,0.08)");
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x + w / 2, y + Math.min(88, h - 28));
    ctx.font = `900 ${h > 120 ? 28 : 24}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(String(value), x + w / 2, y + h - 24);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawActionButton(ctx, rect, fill, stroke, label, fontSize = 16) {
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, fill);
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, stroke, 1);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = `900 ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawLeaderboardOverlay(ctx, state, L) {
    const p = state.player || {};
    const username = String(p.username || "Player").trim() || "Player";
    const pvp = state.pvp || {};
    const leaderboard = Array.isArray(pvp.leaderboard)
      ? pvp.leaderboard.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      : [];
    const list = leaderboard.length ? leaderboard.slice(0, 10) : [{ name: username, wins: Number(pvp.wins || 0), losses: Number(pvp.losses || 0), rating: Number(pvp.rating || 1000), score: Number(pvp.rating || 1000) }];

    ctx.fillStyle = "rgba(0,0,0,0.36)";
    ctx.fillRect(0, 0, L.w, L.h);

    const ovW = Math.min(520, L.panelW - 30);
    const ovH = Math.min(460, L.panelH - 40);
    const ovX = L.panelX + (L.panelW - ovW) * 0.5;
    const ovY = L.panelY + 20;

    fillRoundRect(ctx, ovX, ovY, ovW, ovH, 20, "rgba(8,10,16,0.96)");
    strokeRoundRect(ctx, ovX, ovY, ovW, ovH, 20, "rgba(255,176,82,0.24)", 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "700 24px system-ui";
    ctx.fillText("Leaderboard", ovX + 22, ovY + 34);
    ctx.font = "500 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.fillText("PvP kayıtları otomatik sıralanır", ovX + 22, ovY + 56);

    const closeBtn = {
      x: ovX + ovW - 48,
      y: ovY + 14,
      w: 30,
      h: 30,
      onClick: () => { this.showLeaderboard = false; },
    };
    this.buttons.push(closeBtn);
    fillRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 10, "rgba(255,255,255,0.06)");
    strokeRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 10, "rgba(255,255,255,0.10)", 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.font = "700 18px system-ui";
    ctx.fillText("×", closeBtn.x + 15, closeBtn.y + 15);

    let rowY = ovY + 84;
    for (let i = 0; i < list.length; i += 1) {
      const item = list[i];
      const isMe = String(item.name || "") === username;
      fillRoundRect(ctx, ovX + 16, rowY, ovW - 32, 34, 12, isMe ? "rgba(255,176,82,0.14)" : "rgba(255,255,255,0.04)");
      strokeRoundRect(ctx, ovX + 16, rowY, ovW - 32, 34, 12, isMe ? "rgba(255,176,82,0.22)" : "rgba(255,255,255,0.05)", 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = isMe ? "#ffd494" : "#f3f6fb";
      ctx.font = "700 14px system-ui";
      ctx.fillText(`#${i + 1}`, ovX + 30, rowY + 22);
      textFit(ctx, String(item.name || "Player"), ovX + 72, rowY + 22, ovW - 250);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "700 13px system-ui";
      ctx.fillText(`${Number(item.wins || 0)}W/${Number(item.losses || 0)}L`, ovX + ovW - 138, rowY + 22);
      ctx.fillStyle = "#f6c46b";
      ctx.fillText(String(Number(item.rating || 1000)), ovX + ovW - 34, rowY + 22);
      rowY += 42;
    }
  }
}
