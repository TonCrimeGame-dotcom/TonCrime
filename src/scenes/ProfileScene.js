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
    this.activeTab = "profile";
  }

  onEnter() {
    this._ensureAvatarInput();
    this._seedLeaderboard();
    this._dragScroll = null;
    this.scrollY = 0;
    this.scrollMax = 0;
    const uiTab = String(this.store.get()?.ui?.profileTab || "profile");
    this.activeTab = uiTab === "wallet" ? "wallet" : "profile";
  }

  onExit() {
    this._dragScroll = null;
  }

  _toast(text) {
    try {
      window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text } }));
    } catch (_) {}
  }

  _setTab(tab) {
    this.activeTab = tab;
    this.scrollY = 0;
    if (tab === "profile" || tab === "wallet") {
      const s = this.store.get() || {};
      this.store.set({
        ui: {
          ...(s.ui || {}),
          profileTab: tab,
        },
      });
    }
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
            const c = canvas.getContext("2d");
            const scale = Math.max(size / img.width, size / img.height);
            const dw = img.width * scale;
            const dh = img.height * scale;
            const dx = (size - dw) * 0.5;
            const dy = (size - dh) * 0.5;
            c.fillStyle = "#101218";
            c.fillRect(0, 0, size, size);
            c.drawImage(img, dx, dy, dw, dh);
            resolve(canvas.toDataURL("image/webp", 0.86));
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

  getLayout(ctx) {
    const size = canvasCssSize(ctx.canvas);
    const w = size.w;
    const h = size.h;
    const state = this.store.get() || {};
    const safe = state.ui?.safe || { x: 0, y: 0, w, h };
    const mobile = safe.w < 720;
    const hudTop = Number(state.ui?.hudReservedTop || (mobile ? 84 : 96));
    const chatBottom = Number(state.ui?.chatReservedBottom || (mobile ? 74 : 88));
    const side = mobile ? 10 : Math.max(16, Math.floor(safe.w * 0.03));
    const top = Math.max(safe.y + 8, safe.y + hudTop + 6);
    const bottom = safe.y + safe.h - Math.max(8, chatBottom - 8);
    const panelX = safe.x + side;
    const panelY = top;
    const panelW = safe.w - side * 2;
    const panelH = Math.max(320, bottom - top);
    const headerH = mobile ? 74 : 80;
    const heroH = mobile ? 170 : 188;
    const tabsH = mobile ? 42 : 46;
    const contentY = panelY + headerH + heroH + tabsH + 10;
    const contentH = panelY + panelH - contentY - 14;
    return { mobile, w, h, safe, panelX, panelY, panelW, panelH, headerH, heroH, tabsH, contentY, contentH, pad: mobile ? 14 : 18 };
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

  getContentHeight(L) {
    if (this.activeTab === "wallet") return L.mobile ? 420 : 390;
    if (this.activeTab === "ranking") {
      const count = Math.max(6, Math.min(12, (this.store.get()?.pvp?.leaderboard || []).length || 8));
      return 84 + count * (L.mobile ? 52 : 46);
    }
    return L.mobile ? 470 : 430;
  }

  render(ctx) {
    const state = this.store.get() || {};
    const L = this.layout = this.getLayout(ctx);
    this.buttons = [];
    this.scrollArea = null;

    const bg = getImgSafe(this.assets, "clan_bg") || getImgSafe(this.assets, "clan") || getImgSafe(this.assets, "background") || null;
    if (bg && bg.width) {
      const scale = Math.max(L.w / bg.width, L.h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (L.w - dw) * 0.5, (L.h - dh) * 0.5, dw, dh);
    } else {
      ctx.fillStyle = "#0c0908";
      ctx.fillRect(0, 0, L.w, L.h);
    }

    const veil = ctx.createLinearGradient(0, 0, 0, L.h);
    veil.addColorStop(0, "rgba(15,8,6,0.22)");
    veil.addColorStop(0.55, "rgba(12,8,5,0.16)");
    veil.addColorStop(1, "rgba(5,3,2,0.28)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, L.w, L.h);

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

    this.drawHeader(ctx, state, x, y, w, L);
    this.drawHero(ctx, state, x + pad, y + L.headerH, w - pad * 2, L.heroH, L);
    this.drawTabs(ctx, x + pad, y + L.headerH + L.heroH + 8, w - pad * 2, L.tabsH, L);

    const contentX = x + 10;
    const contentY = L.contentY;
    const contentW = w - 20;
    const contentH = L.contentH;
    const totalH = this.getContentHeight(L);

    this.beginScrollArea(ctx, contentX, contentY, contentW, contentH, totalH);
    const drawY = contentY - this.scrollY;

    if (this.activeTab === "wallet") {
      this.drawWalletTab(ctx, state, contentX + 2, drawY + 2, contentW - 6, totalH - 4, L);
    } else if (this.activeTab === "ranking") {
      this.drawRankingTab(ctx, state, contentX + 2, drawY + 2, contentW - 6, totalH - 4, L);
    } else {
      this.drawProfileTab(ctx, state, contentX + 2, drawY + 2, contentW - 6, totalH - 4, L);
    }

    this.endScrollArea(ctx);
    this.drawScrollBar(ctx);
  }

  drawHeader(ctx, state, x, y, w, L) {
    const pad = L.pad;
    const titleX = x + pad;
    const titleY = y + 30;
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `${L.mobile ? 700 : 800} ${L.mobile ? 18 : 22}px system-ui`;
    ctx.fillText("PROFILE", titleX, titleY);
    ctx.fillStyle = "rgba(255,220,170,0.86)";
    ctx.font = `500 ${L.mobile ? 11 : 13}px system-ui`;
    ctx.fillText("TonCrime oyuncu kartı", titleX, titleY + 22);

    const closeSize = L.mobile ? 38 : 42;
    const closeBtn = {
      x: x + w - pad - closeSize,
      y: y + 14,
      w: closeSize,
      h: closeSize,
      onClick: () => this.scenes?.go?.("home"),
    };
    this.buttons.push(closeBtn);
    fillRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(12,12,14,0.42)");
    strokeRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${L.mobile ? 700 : 700} ${L.mobile ? 26 : 28}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawHero(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");
    const username = String(p.username || "Player").trim() || "Player";
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));

    fillRoundRect(ctx, x, y, w, h, 22, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 22, "rgba(255,193,111,0.42)", 1.2);

    const avatarFrameW = L.mobile ? 104 : 132;
    const avatarFrameH = L.mobile ? 116 : 132;
    const avatarFrameX = x + 16;
    const avatarFrameY = y + 16;
    fillRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,182,86,0.18)", 1);

    const avatarX = avatarFrameX + 9;
    const avatarY = avatarFrameY + 9;
    const avatarW = avatarFrameW - 18;
    const avatarH = avatarFrameH - 18;
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
      ctx.font = `900 ${L.mobile ? 32 : 38}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 1);
    }
    ctx.restore();

    fillRoundRect(ctx, avatarFrameX + 8, avatarFrameY + avatarFrameH - 28, 78, 22, 11, "#27d85c");
    ctx.fillStyle = "#08130d";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ONLINE", avatarFrameX + 47, avatarFrameY + avatarFrameH - 17);

    const infoX = avatarFrameX + avatarFrameW + 18;
    const infoY = y + 26;
    const infoW = w - (infoX - x) - 18;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const nameSize = fitFontSize(ctx, username, infoW, L.mobile ? 25 : 32, 18);
    ctx.font = `900 ${nameSize}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    textFit(ctx, username, infoX, infoY + 8, infoW);

    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = `600 ${L.mobile ? 12 : 13}px system-ui`;
    textFit(ctx, clanName, infoX, infoY + 30, infoW);

    const boxY = infoY + 44;
    const boxGap = 8;
    const boxW = Math.floor((infoW - boxGap) / 2);
    const boxH = 46;
    const drawMini = (bx, by, label, value, color = "#f3f6fb") => {
      fillRoundRect(ctx, bx, by, boxW, boxH, 14, "rgba(255,255,255,0.04)");
      strokeRoundRect(ctx, bx, by, boxW, boxH, 14, "rgba(255,255,255,0.08)", 1);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = `600 ${L.mobile ? 10 : 11}px system-ui`;
      ctx.fillText(label, bx + 12, by + 17);
      ctx.fillStyle = color;
      ctx.font = `900 ${L.mobile ? 18 : 20}px system-ui`;
      textFit(ctx, value, bx + 12, by + 37, boxW - 24);
    };

    drawMini(infoX, boxY, "Level", String(level));
    drawMini(infoX + boxW + boxGap, boxY, "Energy", `${energy}/${energyMax}`, "#9be67c");
    drawMini(infoX, boxY + boxH + boxGap, "Rating", String(rating));
    drawMini(infoX + boxW + boxGap, boxY + boxH + boxGap, "Bakiye", moneyFmt(yton), "#f6c46b");
  }

  drawTabs(ctx, x, y, w, h, L) {
    const tabs = [
      { id: "profile", label: "Genel" },
      { id: "wallet", label: "Cüzdan" },
      { id: "ranking", label: "Sıralama" },
    ];
    const gap = 8;
    const tabW = Math.floor((w - gap * (tabs.length - 1)) / tabs.length);

    tabs.forEach((tab, i) => {
      const tx = x + i * (tabW + gap);
      const btn = {
        x: tx,
        y,
        w: tabW,
        h,
        onClick: () => this._setTab(tab.id),
      };
      this.buttons.push(btn);
      const active = this.activeTab === tab.id;
      fillRoundRect(ctx, tx, y, tabW, h, 14, active ? "rgba(243,187,102,0.20)" : "rgba(255,255,255,0.05)");
      strokeRoundRect(ctx, tx, y, tabW, h, 14, active ? "rgba(243,187,102,0.62)" : "rgba(255,255,255,0.10)", 1);
      ctx.fillStyle = active ? "rgba(255,248,236,0.98)" : "rgba(255,255,255,0.82)";
      ctx.font = `700 ${L.mobile ? 12 : 13}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tab.label, tx + tabW / 2, y + h / 2 + 1);
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawCard(ctx, x, y, w, h) {
    fillRoundRect(ctx, x, y, w, h, 18, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 18, "rgba(255,255,255,0.10)", 1);
  }

  drawSimpleMetric(ctx, x, y, w, h, label, value, color = "#f3f6fb") {
    this.drawCard(ctx, x, y, w, h);
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "600 12px system-ui";
    ctx.fillText(label, x + 16, y + 22);
    ctx.fillStyle = color;
    ctx.font = "900 26px system-ui";
    textFit(ctx, value, x + 16, y + 54, w - 32);
  }

  drawProfileTab(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const kd = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? String(wins) : "0.00";

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "800 18px system-ui";
    ctx.fillText("Genel Durum", x + 8, y + 22);
    ctx.fillStyle = "rgba(255,213,156,0.72)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Sade görünüm • taşan yazılar kaldırıldı", x + 8, y + 42);

    const gap = 12;
    const metricW = Math.floor((w - gap) / 2);
    const metricH = 84;
    const row1Y = y + 56;
    const row2Y = row1Y + metricH + gap;

    this.drawSimpleMetric(ctx, x + 8, row1Y, metricW - 8, metricH, "Enerji", `${energy}/${energyMax}`, "#9be67c");
    this.drawSimpleMetric(ctx, x + metricW + gap, row1Y, metricW - 8, metricH, "Rating", String(rating));
    this.drawSimpleMetric(ctx, x + 8, row2Y, metricW - 8, metricH, "W / L", `${wins} / ${losses}`);
    this.drawSimpleMetric(ctx, x + metricW + gap, row2Y, metricW - 8, metricH, "Win Rate", `${winRate}%`, "#f6c46b");

    const statY = row2Y + metricH + 16;
    this.drawCard(ctx, x + 8, statY, w - 16, 82);
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "600 12px system-ui";
    ctx.fillText("K / D", x + 24, statY + 22);
    ctx.fillText("Seviye", x + w * 0.38, statY + 22);
    ctx.fillText("Clan", x + w * 0.66, statY + 22);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 24px system-ui";
    ctx.fillText(kd, x + 24, statY + 56);
    ctx.fillText(String(Math.max(1, Number(p.level || 1))), x + w * 0.38, statY + 56);
    textFit(ctx, String(state?.clan?.name || state?.clan?.tag || "-"), x + w * 0.66, statY + 56, w * 0.24);

    const btnY = statY + 98;
    const btnGap = 12;
    const btnW = Math.floor((w - 16 - btnGap) / 2);
    const editBtn = {
      x: x + 8,
      y: btnY,
      w: btnW,
      h: 52,
      onClick: () => this._fileInput?.click(),
    };
    const tgBtn = {
      x: x + 8 + btnW + btnGap,
      y: btnY,
      w: btnW,
      h: 52,
      onClick: () => openTelegramLink(),
    };
    this.buttons.push(editBtn, tgBtn);

    fillRoundRect(ctx, editBtn.x, editBtn.y, editBtn.w, editBtn.h, 16, "rgba(80,140,255,0.12)");
    strokeRoundRect(ctx, editBtn.x, editBtn.y, editBtn.w, editBtn.h, 16, "rgba(120,170,255,0.26)", 1);
    fillRoundRect(ctx, tgBtn.x, tgBtn.y, tgBtn.w, tgBtn.h, 16, "rgba(243,187,102,0.14)");
    strokeRoundRect(ctx, tgBtn.x, tgBtn.y, tgBtn.w, tgBtn.h, 16, "rgba(243,187,102,0.30)", 1);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 17px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Edit Avatar", editBtn.x + editBtn.w / 2, editBtn.y + editBtn.h / 2 + 1);
    ctx.fillText("Telegram", tgBtn.x + tgBtn.w / 2, tgBtn.y + tgBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawWalletTab(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "800 18px system-ui";
    ctx.fillText("Cüzdan", x + 8, y + 22);
    ctx.fillStyle = "rgba(255,213,156,0.72)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Sade bakiye görünümü", x + 8, y + 42);

    this.drawCard(ctx, x + 8, y + 56, w - 16, 124);
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "600 14px system-ui";
    ctx.fillText("Mevcut Bakiye", x + 28, y + 90);
    ctx.fillStyle = "#f6c46b";
    ctx.font = `900 ${L.mobile ? 34 : 42}px system-ui`;
    textFit(ctx, `${moneyFmt(yton)} YTON`, x + 28, y + 140, w - 56);

    const gap = 12;
    const boxW = Math.floor((w - gap) / 2);
    const boxY = y + 196;
    this.drawSimpleMetric(ctx, x + 8, boxY, boxW - 8, 82, "Seviye", String(level));
    this.drawSimpleMetric(ctx, x + boxW + gap, boxY, boxW - 8, 82, "Enerji", `${energy}/${energyMax}`, "#9be67c");

    const tgBtn = {
      x: x + 8,
      y: boxY + 98,
      w: w - 16,
      h: 52,
      onClick: () => openTelegramLink(),
    };
    this.buttons.push(tgBtn);
    fillRoundRect(ctx, tgBtn.x, tgBtn.y, tgBtn.w, tgBtn.h, 16, "rgba(243,187,102,0.14)");
    strokeRoundRect(ctx, tgBtn.x, tgBtn.y, tgBtn.w, tgBtn.h, 16, "rgba(243,187,102,0.30)", 1);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "800 17px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TonCrime Telegram", tgBtn.x + tgBtn.w / 2, tgBtn.y + tgBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawRankingTab(ctx, state, x, y, w, h, L) {
    this._seedLeaderboard();
    const p = state.player || {};
    const username = String(p.username || "Player").trim() || "Player";
    const pvp = state.pvp || {};
    const leaderboard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0)) : [];
    const list = leaderboard.length ? leaderboard.slice(0, 12) : [{ name: username, wins: 0, losses: 0, rating: Number(pvp.rating || 1000), score: Number(pvp.rating || 1000) }];

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "800 18px system-ui";
    ctx.fillText("Sıralama", x + 8, y + 22);
    ctx.fillStyle = "rgba(255,213,156,0.72)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("En iyi oyuncular", x + 8, y + 42);

    let rowY = y + 58;
    const rowH = L.mobile ? 44 : 40;
    list.forEach((item, i) => {
      const isMe = String(item.name || "") === username;
      this.drawCard(ctx, x + 8, rowY, w - 16, rowH);
      if (isMe) {
        fillRoundRect(ctx, x + 8, rowY, w - 16, rowH, 18, "rgba(243,187,102,0.10)");
      }
      ctx.fillStyle = isMe ? "#ffd494" : "#f3f6fb";
      ctx.font = "800 14px system-ui";
      ctx.fillText(`#${i + 1}`, x + 22, rowY + 25);
      textFit(ctx, String(item.name || "Player"), x + 58, rowY + 25, w - 220);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "700 12px system-ui";
      ctx.fillText(`${Number(item.wins || 0)}W/${Number(item.losses || 0)}L`, x + w - 108, rowY + 24);
      ctx.fillStyle = "#f6c46b";
      ctx.font = "800 14px system-ui";
      ctx.fillText(String(Number(item.rating || 1000)), x + w - 28, rowY + 25);
      ctx.textAlign = "left";
      rowY += rowH + 8;
    });
  }
}
