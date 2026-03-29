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

function tonFmt(n) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toFixed(2).replace(/\.00$/, "") : "0";
}

function fitFontSize(ctx, text, maxWidth, startSize, minSize = 12, weight = 900) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px system-ui`;
    if (ctx.measureText(String(text || "")).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
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
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
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

function makeImage(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}

function shortAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Bağlı değil";
  if (raw.length <= 18) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-5)}`;
}

function openTelegramLink() {
  const url = "https://t.me/TonCrimeEu";
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

const INVESTMENT_PLANS = [
  { id: "safe", label: "Safe", depositYton: 100, days: 3, roiPct: 8 },
  { id: "pro", label: "Pro", depositYton: 250, days: 5, roiPct: 15 },
  { id: "elite", label: "Elite", depositYton: 500, days: 7, roiPct: 25 },
];

export class ProfileScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.buttons = [];
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
    this._ensureWalletState();
    this._tickWalletTimers();
    const uiTab = String(this.store.get()?.ui?.profileTab || "profile");
    this.activeTab = ["profile", "wallet", "ranking"].includes(uiTab) ? uiTab : "profile";
    this.scrollY = 0;
    this.scrollMax = 0;
    this._dragScroll = null;
  }

  onExit() {
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
        this.store.set({ player: { ...p, avatarUrl: dataUrl } });
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
      this.store.set({ pvp: { ...pvp, leaderboard: next.slice(0, 50) } });
    } catch (err) {
      console.warn("[ProfileScene] leaderboard seed failed:", err);
    }
  }

  _ensureWalletState() {
    const state = this.store.get() || {};
    const wallet = state.wallet || {};
    const next = {
      connected: !!wallet.connected,
      provider: String(wallet.provider || "TON Wallet"),
      address: String(wallet.address || ""),
      tonBalance: Math.max(0, Number(wallet.tonBalance || 0)),
      withdrawRequests: Array.isArray(wallet.withdrawRequests) ? wallet.withdrawRequests.map((x) => ({ ...x })) : [],
      investments: Array.isArray(wallet.investments) ? wallet.investments.map((x) => ({ ...x })) : [],
    };
    if (JSON.stringify(next) !== JSON.stringify(wallet || {})) {
      this.store.set({ wallet: next });
    }
  }

  _tickWalletTimers() {
    this._ensureWalletState();
    const state = this.store.get() || {};
    const wallet = { ...(state.wallet || {}) };
    let changed = false;
    const now = Date.now();

    wallet.withdrawRequests = (wallet.withdrawRequests || []).map((req) => {
      if (req.status === "pending" && now - Number(req.createdAt || 0) > 24 * 60 * 60 * 1000) {
        changed = true;
        return { ...req, status: "completed" };
      }
      return req;
    });

    wallet.investments = (wallet.investments || []).map((inv) => {
      if (inv.status === "active" && now >= Number(inv.endsAt || 0)) {
        changed = true;
        return { ...inv, status: "ready" };
      }
      return inv;
    });

    if (changed) this.store.set({ wallet });
  }

  _setTab(tab) {
    this.activeTab = tab;
    this.scrollY = 0;
    const s = this.store.get() || {};
    this.store.set({ ui: { ...(s.ui || {}), profileTab: tab } });
  }

  _generateWalletAddress() {
    const state = this.store.get() || {};
    const seed = String(state.player?.telegramId || state.player?.id || window.tcGetProfileKey?.() || Date.now());
    const cleaned = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const core = (cleaned + "TONCRIMEWALLET0000000000").slice(0, 30);
    return `UQ${core}`;
  }

  _connectWallet() {
    this._ensureWalletState();
    const state = this.store.get() || {};
    const wallet = { ...(state.wallet || {}) };
    if (wallet.connected && wallet.address) {
      this._toast("Cüzdan zaten bağlı");
      return;
    }
    wallet.connected = true;
    wallet.provider = "TON Wallet";
    wallet.address = this._generateWalletAddress();
    this.store.set({ wallet });
    try {
      window.dispatchEvent(new CustomEvent("tc:wallet-connect", { detail: { provider: wallet.provider, address: wallet.address } }));
    } catch (_) {}
    this._toast("Cüzdan bağlandı");
  }

  _disconnectWallet() {
    this._ensureWalletState();
    const state = this.store.get() || {};
    const wallet = { ...(state.wallet || {}) };
    wallet.connected = false;
    wallet.address = "";
    wallet.provider = "TON Wallet";
    this.store.set({ wallet });
    try {
      window.dispatchEvent(new CustomEvent("tc:wallet-disconnect"));
    } catch (_) {}
    this._toast("Cüzdan bağlantısı kaldırıldı");
  }

  _convertYtonToTon(ratio) {
    this._ensureWalletState();
    const state = this.store.get() || {};
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? state.player?.coins ?? 0));
    const wallet = { ...(state.wallet || {}) };
    const amountYton = Math.floor(yton * ratio);
    if (amountYton < 1) {
      this._toast("Çevrilecek YTON yok");
      return;
    }
    const amountTon = Number((amountYton * 0.01).toFixed(2));
    wallet.tonBalance = Number((Number(wallet.tonBalance || 0) + amountTon).toFixed(2));
    const nextYton = Math.max(0, yton - amountYton);
    if (typeof state.yton !== "undefined") this.store.set({ yton: nextYton, wallet });
    else this.store.set({ coins: nextYton, wallet });
    this._toast(`${amountYton} YTON → ${tonFmt(amountTon)} TON çevrildi`);
  }

  _requestWithdrawal(amountTon) {
    this._ensureWalletState();
    const state = this.store.get() || {};
    const wallet = { ...(state.wallet || {}) };
    if (!wallet.connected || !wallet.address) {
      this._toast("Önce cüzdan bağla");
      return;
    }
    const tonBalance = Math.max(0, Number(wallet.tonBalance || 0));
    if (tonBalance < amountTon) {
      this._toast("Yetersiz TON bakiye");
      return;
    }
    wallet.tonBalance = Number((tonBalance - amountTon).toFixed(2));
    wallet.withdrawRequests = [
      {
        id: `wd_${Date.now()}`,
        amountTon,
        address: wallet.address,
        createdAt: Date.now(),
        status: "pending",
      },
      ...(wallet.withdrawRequests || []),
    ].slice(0, 12);
    this.store.set({ wallet });
    try {
      window.dispatchEvent(new CustomEvent("tc:withdraw-request", { detail: { amountTon, address: wallet.address } }));
    } catch (_) {}
    this._toast(`Çekim talebi oluşturuldu • ${tonFmt(amountTon)} TON`);
  }

  _startInvestment(planId) {
    this._ensureWalletState();
    const plan = INVESTMENT_PLANS.find((x) => x.id === planId);
    if (!plan) return;
    const state = this.store.get() || {};
    const wallet = { ...(state.wallet || {}) };
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? state.player?.coins ?? 0));
    if (yton < plan.depositYton) {
      this._toast("Yetersiz YTON bakiye");
      return;
    }

    const nextYton = yton - plan.depositYton;
    const payoutYton = Math.round(plan.depositYton * (1 + plan.roiPct / 100));
    wallet.investments = [
      {
        id: `inv_${Date.now()}_${plan.id}`,
        planId: plan.id,
        label: plan.label,
        depositYton: plan.depositYton,
        payoutYton,
        days: plan.days,
        roiPct: plan.roiPct,
        createdAt: Date.now(),
        endsAt: Date.now() + plan.days * 24 * 60 * 60 * 1000,
        status: "active",
      },
      ...(wallet.investments || []),
    ].slice(0, 12);

    if (typeof state.yton !== "undefined") this.store.set({ yton: nextYton, wallet });
    else this.store.set({ coins: nextYton, wallet });
    this._toast(`${plan.label} yatırım planı başlatıldı`);
  }

  _collectInvestment(investmentId) {
    this._ensureWalletState();
    const state = this.store.get() || {};
    const wallet = { ...(state.wallet || {}) };
    const index = (wallet.investments || []).findIndex((x) => x.id === investmentId && x.status === "ready");
    if (index < 0) return;
    const inv = wallet.investments[index];
    wallet.investments[index] = { ...inv, status: "collected", collectedAt: Date.now() };
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? state.player?.coins ?? 0));
    const nextYton = yton + Number(inv.payoutYton || 0);
    if (typeof state.yton !== "undefined") this.store.set({ yton: nextYton, wallet });
    else this.store.set({ coins: nextYton, wallet });
    this._toast(`${moneyFmt(inv.payoutYton)} YTON yatırımı toplandı`);
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
    const tabsH = mobile ? 40 : 44;
    const contentY = panelY + headerH + heroH + tabsH + 12;
    const contentH = panelY + panelH - contentY - 14;
    return { mobile, w, h, safe, panelX, panelY, panelW, panelH, headerH, heroH, tabsH, contentY, contentH, pad: mobile ? 14 : 18 };
  }

  update() {
    this._tickWalletTimers();

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
    if (this.activeTab === "wallet") return L.mobile ? 860 : 720;
    if (this.activeTab === "ranking") {
      const count = Math.max(6, Math.min(12, (this.store.get()?.pvp?.leaderboard || []).length || 8));
      return 72 + count * (L.mobile ? 54 : 48);
    }
    return L.mobile ? 360 : 320;
  }

  render(ctx) {
    const state = this.store.get() || {};
    const L = this.getLayout(ctx);
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

    this.drawHeader(ctx, x, y, w, L);
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

  drawHeader(ctx, x, y, w, L) {
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
    const username = String(p.username || "Player").trim() || "Player";
    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const rating = Math.max(0, Number(pvp.rating || 1000));

    fillRoundRect(ctx, x, y, w, h, 22, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 22, "rgba(255,193,111,0.42)", 1.2);

    const avatarFrameW = L.mobile ? 98 : 128;
    const avatarFrameH = L.mobile ? 112 : 128;
    const avatarFrameX = x + 14;
    const avatarFrameY = y + 16;
    fillRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,182,86,0.18)", 1);

    const avatarX = avatarFrameX + 8;
    const avatarY = avatarFrameY + 8;
    const avatarW = avatarFrameW - 16;
    const avatarH = avatarFrameH - 16;
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

    const infoX = avatarFrameX + avatarFrameW + 16;
    const infoY = y + 28;
    const infoW = w - (infoX - x) - 16;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const nameSize = fitFontSize(ctx, username, infoW, L.mobile ? 24 : 30, 18);
    ctx.font = `900 ${nameSize}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    textFit(ctx, username, infoX, infoY + 4, infoW);

    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = `600 ${L.mobile ? 12 : 13}px system-ui`;
    textFit(ctx, clanName, infoX, infoY + 28, infoW);

    const boxGap = 8;
    const boxW = Math.floor((infoW - boxGap) / 2);
    const boxH = L.mobile ? 42 : 46;
    const row1Y = infoY + 40;
    const row2Y = row1Y + boxH + boxGap;
    this.drawMiniBox(ctx, infoX, row1Y, boxW, boxH, "Level", String(level));
    this.drawMiniBox(ctx, infoX + boxW + boxGap, row1Y, boxW, boxH, "Energy", `${energy}/${energyMax}`);
    this.drawMiniBox(ctx, infoX, row2Y, boxW, boxH, "Rating", String(rating));
    this.drawMiniBox(ctx, infoX + boxW + boxGap, row2Y, boxW, boxH, "Clan", clanName);
  }

  drawMiniBox(ctx, x, y, w, h, label, value) {
    fillRoundRect(ctx, x, y, w, h, 14, "rgba(255,255,255,0.04)");
    strokeRoundRect(ctx, x, y, w, h, 14, "rgba(255,255,255,0.08)", 1);
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "600 10px system-ui";
    textFit(ctx, label, x + 10, y + 14, w - 20);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = `900 ${h < 44 ? 16 : 18}px system-ui`;
    textFit(ctx, value, x + 10, y + h - 10, w - 20);
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
      const btn = { x: tx, y, w: tabW, h, onClick: () => this._setTab(tab.id) };
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

  drawSectionTitle(ctx, title, sub, x, y, w) {
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "700 18px system-ui";
    textFit(ctx, title, x, y, w);
    if (!sub) return;
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "500 12px system-ui";
    textFit(ctx, sub, x, y + 18, w);
  }

  drawPrimaryButton(ctx, rect, label, fill = "rgba(243,187,102,0.18)", stroke = "rgba(243,187,102,0.40)", fontSize = 12) {
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12, fill);
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12, stroke, 1);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `700 ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawProfileTab(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));
    const fights = wins + losses;
    const winRate = fights > 0 ? Math.round((wins / fights) * 100) : 0;
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");

    this.drawSectionTitle(ctx, "Genel", "Sade oyuncu özeti.", x + 8, y + 18, w - 16);

    this.drawCard(ctx, x + 8, y + 42, w - 16, 110);
    const colGap = 10;
    const boxW = Math.floor((w - 16 - colGap) / 2);
    this.drawMiniBox(ctx, x + 18, y + 58, boxW, 38, "Bakiye", `${moneyFmt(yton)} YTON`);
    this.drawMiniBox(ctx, x + 18 + boxW + colGap, y + 58, boxW, 38, "Silah", String(p.weaponName || "Silah Yok"));
    this.drawMiniBox(ctx, x + 18, y + 102, boxW, 38, "Clan", clanName);
    this.drawMiniBox(ctx, x + 18 + boxW + colGap, y + 102, boxW, 38, "Kayıt", `${wins}-${losses}`);

    const metricsY = y + 166;
    this.drawCard(ctx, x + 8, metricsY, w - 16, 110);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(x + w / 3, metricsY + 18);
    ctx.lineTo(x + w / 3, metricsY + 92);
    ctx.moveTo(x + (w * 2) / 3, metricsY + 18);
    ctx.lineTo(x + (w * 2) / 3, metricsY + 92);
    ctx.stroke();

    const c1 = x + w / 6;
    const c2 = x + w / 2;
    const c3 = x + (w * 5) / 6;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "600 12px system-ui";
    ctx.fillText("Win Rate", c1, metricsY + 28);
    ctx.fillText("Rating", c2, metricsY + 28);
    ctx.fillText("Seviye", c3, metricsY + 28);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = `900 ${L.mobile ? 24 : 28}px system-ui`;
    ctx.fillText(`${winRate}%`, c1, metricsY + 70);
    ctx.fillText(String(rating), c2, metricsY + 70);
    ctx.fillText(String(Math.max(1, Number(p.level || 1))), c3, metricsY + 70);
    ctx.textAlign = "left";

    const btnY = metricsY + 124;
    const btnGap = 12;
    const btnW = Math.floor((w - 16 - btnGap) / 2);
    const editBtn = { x: x + 8, y: btnY, w: btnW, h: 46, onClick: () => this._fileInput?.click() };
    const tgBtn = { x: x + 8 + btnW + btnGap, y: btnY, w: btnW, h: 46, onClick: () => openTelegramLink() };
    this.buttons.push(editBtn, tgBtn);
    this.drawPrimaryButton(ctx, editBtn, "Avatar Değiştir", "rgba(90,140,255,0.14)", "rgba(120,170,255,0.34)");
    this.drawPrimaryButton(ctx, tgBtn, "Telegram", "rgba(243,187,102,0.16)", "rgba(243,187,102,0.34)");
  }

  drawWalletTab(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const wallet = state.wallet || {};
    const yton = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const tonBalance = Math.max(0, Number(wallet.tonBalance || 0));
    const connected = !!wallet.connected;
    const address = shortAddress(wallet.address);
    const requests = Array.isArray(wallet.withdrawRequests) ? wallet.withdrawRequests.slice(0, 3) : [];
    const investments = Array.isArray(wallet.investments) ? wallet.investments.slice(0, 3) : [];

    this.drawSectionTitle(ctx, "Cüzdan", "TON dönüşüm, bağlama, çekim ve yatırım.", x + 8, y + 18, w - 16);

    this.drawCard(ctx, x + 8, y + 42, w - 16, 118);
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "600 12px system-ui";
    ctx.fillText("1 YTON = 0.01 TON", x + 22, y + 66);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = `900 ${L.mobile ? 34 : 40}px system-ui`;
    ctx.fillText(`${moneyFmt(yton)} YTON`, x + 22, y + 112);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 12px system-ui";
    ctx.fillText(`TON cüzdanı: ${tonFmt(tonBalance)} TON`, x + 22, y + 136);

    const topBtnY = y + 174;
    const btnGap = 8;
    const convW = Math.floor((w - 16 - btnGap * 2) / 3);
    const convButtons = [
      { label: "25% Çevir", ratio: 0.25 },
      { label: "50% Çevir", ratio: 0.5 },
      { label: "Tümünü", ratio: 1 },
    ];
    convButtons.forEach((item, i) => {
      const btn = {
        x: x + 8 + i * (convW + btnGap),
        y: topBtnY,
        w: convW,
        h: 38,
        onClick: () => this._convertYtonToTon(item.ratio),
      };
      this.buttons.push(btn);
      this.drawPrimaryButton(ctx, btn, item.label, "rgba(243,187,102,0.14)", "rgba(243,187,102,0.32)", L.mobile ? 11 : 12);
    });

    const connectY = topBtnY + 52;
    this.drawCard(ctx, x + 8, connectY, w - 16, 116);
    this.drawSectionTitle(ctx, connected ? "Bağlı Cüzdan" : "Cüzdan Bağlama", connected ? address : "Sabit kayıt için bağlantı aktif edilir.", x + 22, connectY + 22, w - 160);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 12px system-ui";
    ctx.fillText(connected ? `Sağlayıcı: ${wallet.provider || "TON Wallet"}` : "TON cüzdanın profile sabitlenir.", x + 22, connectY + 72);

    const connectBtn = {
      x: x + w - 132,
      y: connectY + 34,
      w: 104,
      h: 34,
      onClick: () => (connected ? this._disconnectWallet() : this._connectWallet()),
    };
    this.buttons.push(connectBtn);
    this.drawPrimaryButton(ctx, connectBtn, connected ? "Bağlantıyı Kes" : "Cüzdan Bağla", connected ? "rgba(255,255,255,0.08)" : "rgba(243,187,102,0.16)", connected ? "rgba(255,255,255,0.16)" : "rgba(243,187,102,0.34)", L.mobile ? 10 : 11);

    const withdrawY = connectY + 130;
    this.drawCard(ctx, x + 8, withdrawY, w - 16, 166);
    this.drawSectionTitle(ctx, "Çekim Talebi", "Bağlı cüzdana TON çekim isteği bırak.", x + 22, withdrawY + 22, w - 44);

    const wdGap = 8;
    const wdW = Math.floor((w - 16 - wdGap * 2) / 3);
    [1, 5, 10].forEach((amount, i) => {
      const btn = {
        x: x + 8 + i * (wdW + wdGap),
        y: withdrawY + 54,
        w: wdW,
        h: 36,
        onClick: () => this._requestWithdrawal(amount),
      };
      this.buttons.push(btn);
      this.drawPrimaryButton(ctx, btn, `${amount} TON`, "rgba(255,255,255,0.06)", "rgba(255,255,255,0.12)", L.mobile ? 11 : 12);
    });

    let reqY = withdrawY + 104;
    if (!requests.length) {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "500 12px system-ui";
      ctx.fillText("Henüz çekim talebi yok.", x + 22, reqY + 12);
    } else {
      requests.forEach((req, index) => {
        const rowY = reqY + index * 18;
        ctx.fillStyle = req.status === "completed" ? "#9be67c" : "rgba(255,255,255,0.72)";
        ctx.font = "500 12px system-ui";
        textFit(ctx, `${tonFmt(req.amountTon)} TON • ${req.status === "completed" ? "tamamlandı" : "bekliyor"}`, x + 22, rowY + 12, w - 44);
      });
    }

    const investY = withdrawY + 180;
    this.drawCard(ctx, x + 8, investY, w - 16, 278);
    this.drawSectionTitle(ctx, "Yatırım", "YTON ile plan başlat, süre dolunca getiriyi topla.", x + 22, investY + 22, w - 44);

    const planGap = 10;
    const planW = L.mobile ? w - 16 : Math.floor((w - 16 - planGap * 2) / 3);
    INVESTMENT_PLANS.forEach((plan, i) => {
      const px = L.mobile ? x + 8 : x + 8 + i * (planW + planGap);
      const py = L.mobile ? investY + 54 + i * 72 : investY + 54;
      this.drawCard(ctx, px, py, planW, 62);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 14px system-ui";
      ctx.fillText(plan.label, px + 14, py + 22);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = "500 11px system-ui";
      ctx.fillText(`${plan.depositYton} YTON • ${plan.days} gün • +%${plan.roiPct}`, px + 14, py + 40);
      const btn = { x: px + planW - 86, y: py + 15, w: 72, h: 30, onClick: () => this._startInvestment(plan.id) };
      this.buttons.push(btn);
      this.drawPrimaryButton(ctx, btn, "Başlat", "rgba(243,187,102,0.16)", "rgba(243,187,102,0.32)", 11);
    });

    const listY = L.mobile ? investY + 54 + INVESTMENT_PLANS.length * 72 : investY + 130;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 12px system-ui";
    ctx.fillText("Aktif / Hazır yatırımlar", x + 22, listY + 4);

    if (!investments.length) {
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "500 12px system-ui";
      ctx.fillText("Aktif yatırım yok.", x + 22, listY + 28);
    } else {
      investments.forEach((inv, i) => {
        const rowY = listY + 20 + i * 42;
        this.drawCard(ctx, x + 18, rowY, w - 36, 34);
        ctx.fillStyle = "rgba(255,255,255,0.90)";
        ctx.font = "600 12px system-ui";
        textFit(ctx, `${inv.label} • ${moneyFmt(inv.depositYton)} → ${moneyFmt(inv.payoutYton)} YTON`, x + 30, rowY + 22, w - 170);
        ctx.fillStyle = inv.status === "ready" ? "#9be67c" : inv.status === "collected" ? "rgba(255,255,255,0.55)" : "rgba(255,213,156,0.76)";
        ctx.font = "600 11px system-ui";
        ctx.fillText(inv.status === "ready" ? "Hazır" : inv.status === "collected" ? "Toplandı" : `${inv.days} gün`, x + w - 136, rowY + 22);
        if (inv.status === "ready") {
          const btn = { x: x + w - 94, y: rowY + 4, w: 70, h: 26, onClick: () => this._collectInvestment(inv.id) };
          this.buttons.push(btn);
          this.drawPrimaryButton(ctx, btn, "Topla", "rgba(255,255,255,0.08)", "rgba(255,255,255,0.14)", 11);
        }
      });
    }
  }

  drawRankingTab(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const username = String(p.username || "Player").trim() || "Player";
    const pvp = state.pvp || {};
    const leaderboard = Array.isArray(pvp.leaderboard)
      ? pvp.leaderboard.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      : [];
    const list = leaderboard.length
      ? leaderboard.slice(0, 12)
      : [{ name: username, wins: Number(pvp.wins || 0), losses: Number(pvp.losses || 0), rating: Number(pvp.rating || 1000), score: Number(pvp.rating || 1000) }];

    this.drawSectionTitle(ctx, "Sıralama", "PvP sonuçlarına göre güncel liste.", x + 8, y + 18, w - 16);

    let rowY = y + 44;
    list.forEach((item, index) => {
      this.drawCard(ctx, x + 8, rowY, w - 16, 40);
      const isMe = String(item.name || "") === username;
      ctx.fillStyle = isMe ? "#ffd494" : "rgba(255,255,255,0.96)";
      ctx.font = "700 13px system-ui";
      ctx.fillText(`#${index + 1}`, x + 22, rowY + 24);
      textFit(ctx, String(item.name || "Player"), x + 60, rowY + 24, w - 240);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "500 12px system-ui";
      ctx.fillText(`${Number(item.wins || 0)}W/${Number(item.losses || 0)}L`, x + w - 152, rowY + 24);
      ctx.fillStyle = "#f6c46b";
      ctx.font = "700 13px system-ui";
      ctx.fillText(String(Number(item.rating || 1000)), x + w - 72, rowY + 24);
      rowY += 48;
    });
  }
}
