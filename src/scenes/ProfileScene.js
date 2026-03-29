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


function shortAddr(addr) {
  const v = String(addr || '').trim();
  if (!v) return 'Bağlı değil';
  if (v.length <= 18) return v;
  return `${v.slice(0, 8)}...${v.slice(-6)}`;
}

function getProjectTonWalletAddress() {
  return 'UQTONCRIME9x7j4m2p8v6k1a5d3n8q4w7e2r6t9y5u1i3o';
}

function isLikelyTonAddress(addr) {
  const v = String(addr || '').trim();
  if (!v) return false;
  if (v.length < 20 || v.length > 80) return false;
  return /^(UQ|EQ|kQ|0:|ton)/i.test(v);
}

function parseTonAmount(value) {
  const raw = String(value ?? '').replace(',', '.').trim();
  if (!raw) return NaN;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : NaN;
}

function tonFmt(n) {
  const value = Number(n || 0);
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('tr-TR', { maximumFractionDigits: value % 1 ? 2 : 0 });
}

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
    this._ensureWalletState();
    this._seedLeaderboard();
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

  _setTab(tab) {
    this.activeTab = tab;
    this.scrollY = 0;
    const s = this.store.get() || {};
    this.store.set({
      ui: {
        ...(s.ui || {}),
        profileTab: tab,
      },
    });
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

  _ensureWalletState() {
    const s = this.store.get() || {};
    const wallet = { ...(s.wallet || {}) };
    if (!wallet.depositAddress) wallet.depositAddress = getProjectTonWalletAddress();
    if (!wallet.investmentStep) wallet.investmentStep = "idle";
    if (!wallet.selectedInvestmentTon) wallet.selectedInvestmentTon = 0;
    if (typeof wallet.withdrawPending !== "boolean") wallet.withdrawPending = false;
    if (!wallet.withdrawRequestedAt) wallet.withdrawRequestedAt = 0;
    if (!wallet.withdrawAmountTon) wallet.withdrawAmountTon = 0;
    if (!wallet.withdrawTargetAddress) wallet.withdrawTargetAddress = "";
    if (!wallet.withdrawRequestId) wallet.withdrawRequestId = "";
    if (!wallet.connectedAddress) wallet.connectedAddress = "";
    if (!Array.isArray(wallet.investments)) wallet.investments = [];
    if (!Array.isArray(wallet.withdraws)) wallet.withdraws = [];
    if (!wallet.investmentRequestId) wallet.investmentRequestId = "";
    this.store.set({ wallet });
  }

  _walletState() {
    this._ensureWalletState();
    return { ...((this.store.get() || {}).wallet || {}) };
  }

  _setWallet(patch = {}) {
    const s = this.store.get() || {};
    const wallet = { ...((s.wallet || {})), ...patch };
    this.store.set({ wallet });
  }

  _askText(message, defaultValue = "") {
    try {
      if (typeof window?.prompt !== "function") return null;
      return window.prompt(message, defaultValue);
    } catch (_) {
      return null;
    }
  }

  _connectWallet() {
    const wallet = this._walletState();
    const current = String(wallet.connectedAddress || "").trim();
    const answer = this._askText("Bağlamak istediğin TON cüzdan adresini gir.", current);
    if (answer == null) return;
    const address = String(answer || "").trim();
    if (!address) {
      this._toast("Cüzdan adresi girilmedi");
      return;
    }
    if (!isLikelyTonAddress(address)) {
      this._toast("Geçerli bir TON cüzdan adresi gir");
      return;
    }
    this._setWallet({ connectedAddress: address });
    this._toast(current ? "Cüzdan adresi güncellendi" : "Cüzdan bağlandı");
  }

  _disconnectWallet() {
    this._setWallet({ connectedAddress: "" });
    this._toast("Cüzdan bağlantısı kaldırıldı");
  }

  _openInvestmentSelector() {
    this._setWallet({
      investmentStep: "select",
      selectedInvestmentTon: 0,
      investmentConfirmedAt: 0,
      investmentRequestId: "",
    });
  }

  _cancelInvestmentFlow() {
    this._setWallet({
      investmentStep: "idle",
      selectedInvestmentTon: 0,
      investmentConfirmedAt: 0,
      investmentRequestId: "",
    });
  }

  _selectInvestmentAmount(amountTon) {
    const ton = Math.max(0, Number(amountTon || 0));
    this._setWallet({ investmentStep: "payment", selectedInvestmentTon: ton, investmentConfirmedAt: 0 });
  }

  async _copyWalletAddress() {
    const addr = this._walletState().depositAddress || getProjectTonWalletAddress();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(addr);
      this._toast("TON adresi kopyalandı");
    } catch (_) {
      this._toast("Adres kopyalanamadı");
    }
  }

  _confirmInvestmentPaid() {
    const wallet = this._walletState();
    const amountTon = Math.max(0, Number(wallet.selectedInvestmentTon || 0));
    if (!amountTon) {
      this._toast("Önce yatırım limiti seç");
      return;
    }
    if (String(wallet.investmentStep || "") === "confirmed") {
      this._toast("Bu yatırım zaten onaylandı");
      return;
    }

    const requestId = `INV-${Date.now().toString(36).toUpperCase()}`;
    const investments = Array.isArray(wallet.investments) ? wallet.investments.slice() : [];
    investments.unshift({
      id: requestId,
      amountTon,
      address: String(wallet.depositAddress || getProjectTonWalletAddress()),
      status: "pending_review",
      createdAt: Date.now(),
    });

    this._setWallet({
      investmentStep: "confirmed",
      investmentConfirmedAt: Date.now(),
      lastInvestmentTon: amountTon,
      investmentRequestId: requestId,
      investments,
    });
    this._toast("Yatırım onayı alındı");
  }

  _requestWithdraw() {
    const wallet = this._walletState();
    let targetAddress = String(wallet.connectedAddress || wallet.withdrawTargetAddress || "").trim();

    if (!targetAddress) {
      const addrInput = this._askText("Çekimin gönderileceği TON cüzdan adresini gir.", "");
      if (addrInput == null) return;
      targetAddress = String(addrInput || "").trim();
      if (!targetAddress) {
        this._toast("Çekim için cüzdan adresi gerekli");
        return;
      }
    }

    if (!isLikelyTonAddress(targetAddress)) {
      this._toast("Geçerli bir TON cüzdan adresi gir");
      return;
    }

    const amountInput = this._askText(
      "Çekmek istediğin TON miktarını gir. Min 0.5 TON / Max 100 TON",
      wallet.withdrawAmountTon ? String(wallet.withdrawAmountTon) : ""
    );
    if (amountInput == null) return;

    const amountTon = parseTonAmount(amountInput);
    if (!Number.isFinite(amountTon)) {
      this._toast("Geçerli bir TON miktarı gir");
      return;
    }
    if (amountTon < 0.5 || amountTon > 100) {
      this._toast("Çekim limiti 0.5 TON ile 100 TON arasında olmalı");
      return;
    }

    const requestId = `WD-${Date.now().toString(36).toUpperCase()}`;
    const withdraws = Array.isArray(wallet.withdraws) ? wallet.withdraws.slice() : [];
    withdraws.unshift({
      id: requestId,
      amountTon,
      address: targetAddress,
      status: "pending_review",
      createdAt: Date.now(),
    });

    this._setWallet({
      connectedAddress: wallet.connectedAddress || targetAddress,
      withdrawPending: true,
      withdrawRequestedAt: Date.now(),
      withdrawAmountTon: amountTon,
      withdrawTargetAddress: targetAddress,
      withdrawRequestId: requestId,
      withdraws,
    });
    this._toast("Çekim talebi oluşturuldu");
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
    const headerH = mobile ? 64 : 70;
    const heroH = mobile ? 178 : 160;
    const tabH = mobile ? 36 : 40;
    const contentY = panelY + headerH + heroH + tabH + 24;
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
    if (tab === "wallet") {
      const wallet = state?.wallet || {};
      const step = String(wallet.investmentStep || "idle");
      let total = layout.mobile ? 560 : 430;
      total += wallet.withdrawPending ? (layout.mobile ? 96 : 76) : 0;
      if (step === "select") total += layout.mobile ? 250 : 160;
      else if (step === "payment") total += layout.mobile ? 420 : 340;
      else if (step === "confirmed") total += layout.mobile ? 400 : 320;
      else total += 90;
      return total;
    }
    if (tab === "ranking") {
      const board = Array.isArray(state?.pvp?.leaderboard) ? state.pvp.leaderboard : [];
      return 70 + Math.max(6, Math.min(12, board.length || 6)) * (layout.mobile ? 52 : 48);
    }
    return layout.mobile ? 520 : 340;
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
    const L = this.getLayout(ctx);

    this.buttons = [];
    this.scrollArea = null;

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

    this.drawHeader(ctx, L);
    this.drawHero(ctx, state, L);
    this.drawTabs(ctx, L);

    const viewportX = x + 10;
    const viewportY = L.contentY;
    const viewportW = w - 20;
    const viewportH = L.contentH;
    const contentH = this.estimateContentHeight(state, this.activeTab, L);

    this.beginScrollArea(ctx, viewportX, viewportY, viewportW, viewportH, contentH);
    const drawY = viewportY - this.scrollY;

    if (this.activeTab === "wallet") this.drawWalletContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);
    else if (this.activeTab === "ranking") this.drawRankingContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);
    else this.drawProfileContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);

    this.endScrollArea(ctx);
    this.drawScrollBar(ctx);
  }

  drawHeader(ctx, L) {
    const x = L.panelX + L.pad;
    const y = L.panelY + 12;
    const w = L.panelW - L.pad * 2;
    const h = L.headerH - 8;

    fillRoundRect(ctx, x, y, w, h, 18, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 18, "rgba(255,255,255,0.10)", 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `700 ${L.mobile ? 18 : 22}px system-ui`;
    ctx.fillText("PROFILE", x + 16, y + 28);
    ctx.fillStyle = "rgba(255,220,170,0.86)";
    ctx.font = `500 ${L.mobile ? 11 : 13}px system-ui`;
    ctx.fillText("TonCrime oyuncu kartı", x + 16, y + 48);

    const closeSize = L.mobile ? 38 : 42;
    const closeBtn = { x: x + w - closeSize - 10, y: y + 8, w: closeSize, h: closeSize, onClick: () => this.scenes?.go?.("home") };
    this.buttons.push(closeBtn);
    fillRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(12,12,14,0.42)");
    strokeRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${L.mobile ? 24 : 28}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawInfoMini(ctx, x, y, w, h, label, value) {
    const compact = w < 150 || h < 52;
    const labelSize = compact ? 10 : 11;
    const valueSize = compact ? 13 : 16;
    fillRoundRect(ctx, x, y, w, h, 14, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, x, y, w, h, 14, "rgba(255,255,255,0.10)", 1);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = `500 ${labelSize}px system-ui`;
    textFit(ctx, label, x + 10, y + 17, w - 20);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `700 ${valueSize}px system-ui`;
    textFit(ctx, value, x + 10, y + h - 13, w - 20);
  }

  drawHero(ctx, state, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const x = L.panelX + L.pad;
    const y = L.panelY + L.headerH;
    const w = L.panelW - L.pad * 2;
    const h = L.heroH;
    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");
    const username = String(p.username || "Player").trim() || "Player";

    fillRoundRect(ctx, x, y, w, h, 22, "rgba(10,12,16,0.28)");
    strokeRoundRect(ctx, x, y, w, h, 22, "rgba(255,193,111,0.42)", 1.2);

    const avatarFrameX = x + 16;
    const avatarFrameY = y + 16;
    const avatarFrameW = L.mobile ? 98 : 116;
    const avatarFrameH = L.mobile ? 98 : 116;

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
      ctx.font = `900 ${L.mobile ? 30 : 34}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 1);
    }
    ctx.restore();

    fillRoundRect(ctx, avatarFrameX + 8, avatarFrameY + avatarFrameH - 26, 78, 20, 10, "#27d85c");
    ctx.fillStyle = "#08130d";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ONLINE", avatarFrameX + 47, avatarFrameY + avatarFrameH - 16);

    const infoX = avatarFrameX + avatarFrameW + 16;
    const infoY = avatarFrameY + 6;
    const infoW = w - (infoX - x) - 16;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `700 ${L.mobile ? 18 : 28}px system-ui`;
    textFit(ctx, username, infoX, infoY + 18, infoW);

    const gap = L.mobile ? 8 : 10;
    const miniW = Math.floor((infoW - gap) / 2);
    const miniH = L.mobile ? 52 : 48;
    const level = Math.max(1, Number(p.level || 1));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const rating = Math.max(0, Number(pvp.rating || 1000));

    const row1Y = infoY + (L.mobile ? 28 : 34);
    const row2Y = row1Y + miniH + gap;
    this.drawInfoMini(ctx, infoX, row1Y, miniW, miniH, "Level", String(level));
    this.drawInfoMini(ctx, infoX + miniW + gap, row1Y, miniW, miniH, "Enerji", `${energy}/${energyMax}`);
    this.drawInfoMini(ctx, infoX, row2Y, miniW, miniH, "Clan", clanName);
    this.drawInfoMini(ctx, infoX + miniW + gap, row2Y, miniW, miniH, "Rating", String(rating));
  }

  drawTabs(ctx, L) {
    const x = L.panelX + L.pad;
    const y = L.panelY + L.headerH + L.heroH + 8;
    const w = L.panelW - L.pad * 2;
    const gap = 8;
    const tabs = [
      { id: "profile", label: "Genel" },
      { id: "wallet", label: "Cüzdan" },
      { id: "ranking", label: "Sıralama" },
    ];
    const tabW = Math.floor((w - gap * (tabs.length - 1)) / tabs.length);

    tabs.forEach((tab, index) => {
      const tx = x + index * (tabW + gap);
      const btn = { x: tx, y, w: tabW, h: L.tabH, onClick: () => this._setTab(tab.id) };
      this.buttons.push(btn);
      const active = this.activeTab === tab.id;
      fillRoundRect(ctx, tx, y, tabW, L.tabH, 14, active ? "rgba(243,187,102,0.20)" : "rgba(255,255,255,0.05)");
      strokeRoundRect(ctx, tx, y, tabW, L.tabH, 14, active ? "rgba(243,187,102,0.62)" : "rgba(255,255,255,0.10)", 1);
      ctx.fillStyle = active ? "rgba(255,248,236,0.98)" : "rgba(255,255,255,0.82)";
      ctx.font = `700 ${L.mobile ? 12 : 13}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tab.label, tx + tabW / 2, y + L.tabH / 2 + 1);
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

  drawProfileContent(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const pvp = state.pvp || {};
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));
    const totalFight = wins + losses;
    const winRate = totalFight > 0 ? Math.round((wins / totalFight) * 100) : 0;
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 100));
    const rating = Math.max(0, Number(pvp.rating || 1000));

    this.drawSectionTitle(ctx, "Genel Bakış", "Daha sade profil görünümü", x + 8, y + 20, w - 16);

    const gap = 12;
    const colW = L.mobile ? (w - 16) : Math.floor((w - 16 - gap) / 2);
    const row1Y = y + 40;
    const row2Y = row1Y + 92;

    const drawStat = (sx, sy, title, value, sub) => {
      this.drawCard(ctx, sx, sy, colW, 80);
      ctx.fillStyle = "rgba(255,213,156,0.78)";
      ctx.font = "500 12px system-ui";
      textFit(ctx, title, sx + 16, sy + 24, colW - 32);
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = `700 ${L.mobile ? 28 : 30}px system-ui`;
      textFit(ctx, value, sx + 16, sy + 56, colW - 32);
      if (sub) {
        ctx.fillStyle = "rgba(255,255,255,0.66)";
        ctx.font = "500 11px system-ui";
        textFit(ctx, sub, sx + 16, sy + 72, colW - 32);
      }
    };

    if (L.mobile) {
      drawStat(x + 8, row1Y, "Enerji", `${energy}/${energyMax}`, "Hazır durum");
      drawStat(x + 8, row2Y, "Rating", String(rating), "PvP değeri");
      drawStat(x + 8, row2Y + 92, "Maç", `${wins}-${losses}`, `${winRate}% win rate`);
    } else {
      drawStat(x + 8, row1Y, "Enerji", `${energy}/${energyMax}`, "Hazır durum");
      drawStat(x + 8 + colW + gap, row1Y, "Rating", String(rating), "PvP değeri");
      drawStat(x + 8, row2Y, "Maç", `${wins}-${losses}`, `${winRate}% win rate`);
      drawStat(x + 8 + colW + gap, row2Y, "Durum", "ONLINE", "TonCrime aktif");
    }

    const actionsY = L.mobile ? row2Y + 184 : row2Y + 92;
    this.drawSectionTitle(ctx, "İşlemler", null, x + 8, actionsY + 12, w - 16);

    const btnGap = 12;
    const btnW = L.mobile ? (w - 16) : Math.floor((w - 16 - btnGap) / 2);
    const btnH = 46;
    const editBtn = { x: x + 8, y: actionsY + 28, w: btnW, h: btnH, onClick: () => this._fileInput?.click() };
    const tgBtn = {
      x: L.mobile ? x + 8 : x + 8 + btnW + btnGap,
      y: L.mobile ? actionsY + 28 + btnH + 10 : actionsY + 28,
      w: btnW,
      h: btnH,
      onClick: openTelegramLink,
    };
    this.buttons.push(editBtn, tgBtn);

    const drawBtn = (btn, label) => {
      fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, "rgba(243,187,102,0.16)");
      strokeRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, "rgba(243,187,102,0.36)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = `700 ${L.mobile ? 14 : 15}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
    };

    drawBtn(editBtn, "Avatar Düzenle");
    drawBtn(tgBtn, "TonCrime Telegram");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawWalletContent(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const wallet = this._walletState();
    const balance = Math.max(0, Number(state.yton ?? state.coins ?? p.coins ?? 0));
    const tonValue = (balance * 0.01).toFixed(2);
    const connected = String(wallet.connectedAddress || "").trim();
    const step = String(wallet.investmentStep || "idle");
    const address = String(wallet.depositAddress || getProjectTonWalletAddress());
    const latestInvestment = Array.isArray(wallet.investments) && wallet.investments.length ? wallet.investments[0] : null;
    const latestWithdraw = Array.isArray(wallet.withdraws) && wallet.withdraws.length ? wallet.withdraws[0] : null;

    this.drawSectionTitle(ctx, "Cüzdan", "TON işlemleri ve yatırım paneli", x + 8, y + 20, w - 16);

    let cy = y + 42;
    const fullW = w - 16;

    const drawActionBtn = (btn, label, tone = "gold") => {
      fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, tone === "soft" ? "rgba(255,255,255,0.08)" : "rgba(243,187,102,0.16)");
      strokeRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, tone === "soft" ? "rgba(255,255,255,0.16)" : "rgba(243,187,102,0.36)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = `700 ${L.mobile ? 14 : 15}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
    };

    this.drawCard(ctx, x + 8, cy, fullW, 108);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Kasadaki Bakiye", x + 24, cy + 28);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `700 ${L.mobile ? 28 : 34}px system-ui`;
    ctx.fillText(`${moneyFmt(balance)} YTON`, x + 24, cy + 66);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 12px system-ui";
    ctx.fillText(`1 YTON = 0.01 TON  •  Karşılık: ${tonValue} TON`, x + 24, cy + 90);
    cy += 122;

    const walletCardH = L.mobile ? 118 : 96;
    this.drawCard(ctx, x + 8, cy, fullW, walletCardH);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Bağlı TON Cüzdanı", x + 24, cy + 28);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 15px system-ui";
    textFit(ctx, connected ? shortAddr(connected) : "Henüz cüzdan adresi eklenmedi", x + 24, cy + 56, fullW - (L.mobile ? 48 : 170));
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = "500 11px system-ui";
    textFit(ctx, connected ? "Adres kullanıcıdan alınır, otomatik üretilmez." : "Butona basınca adres sorulur, kafasına göre adres yazılmaz.", x + 24, cy + 78, fullW - (L.mobile ? 48 : 170));

    const connectBtn = {
      x: L.mobile ? x + 24 : x + fullW - 124,
      y: L.mobile ? cy + walletCardH - 44 : cy + 22,
      w: L.mobile ? fullW - 32 : 100,
      h: 34,
      onClick: () => this._connectWallet(),
    };
    this.buttons.push(connectBtn);
    drawActionBtn(connectBtn, connected ? "Adresi Değiştir" : "Adres Ekle");
    cy += walletCardH + 14;

    const actionGap = 10;
    const actionW = L.mobile ? fullW : Math.floor((fullW - actionGap) / 2);
    const investBtn = { x: x + 8, y: cy, w: actionW, h: 44, onClick: () => this._openInvestmentSelector() };
    const withdrawBtn = { x: L.mobile ? x + 8 : x + 8 + actionW + actionGap, y: L.mobile ? cy + 54 : cy, w: actionW, h: 44, onClick: () => this._requestWithdraw() };
    this.buttons.push(investBtn, withdrawBtn);
    drawActionBtn(investBtn, "Yatırım Yap");
    drawActionBtn(withdrawBtn, "Çekim Talebi", "soft");
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    cy += L.mobile ? 110 : 58;

    const withdrawCardH = wallet.withdrawPending ? (L.mobile ? 96 : 78) : (L.mobile ? 90 : 72);
    this.drawCard(ctx, x + 8, cy, fullW, withdrawCardH);
    ctx.fillStyle = "rgba(255,213,156,0.78)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Çekim Talebi", x + 24, cy + 26);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 11px system-ui";
    ctx.fillText("Min 0.5 TON • Max 100 TON", x + 24, cy + 44);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 13px system-ui";
    if (wallet.withdrawPending && latestWithdraw) {
      textFit(ctx, `${tonFmt(latestWithdraw.amountTon)} TON • ${shortAddr(latestWithdraw.address)}`, x + 24, cy + (L.mobile ? 67 : 62), fullW - 48);
      if (L.mobile) {
        ctx.fillStyle = "rgba(124,255,170,0.92)";
        ctx.font = "700 11px system-ui";
        textFit(ctx, `Durum: onay bekleniyor • ${wallet.withdrawRequestId || latestWithdraw.id || ''}`, x + 24, cy + 84, fullW - 48);
      }
    } else {
      textFit(ctx, "Butona basınca önce miktar istenir, sonra çekim talebi açılır.", x + 24, cy + (L.mobile ? 67 : 62), fullW - 48);
    }
    cy += withdrawCardH + 14;

    if (step === "select") {
      const blockH = L.mobile ? 254 : 162;
      this.drawCard(ctx, x + 8, cy, fullW, blockH);
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = "700 17px system-ui";
      ctx.fillText("Yatırım Limiti Seç", x + 24, cy + 28);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = "500 12px system-ui";
      ctx.fillText("20 TON • 50 TON • 100 TON seçeneklerinden birini seç", x + 24, cy + 50);

      const options = [20, 50, 100];
      const optGap = 10;
      const optW = L.mobile ? fullW - 32 : Math.floor((fullW - 32 - optGap * 2) / 3);
      const optH = 64;
      options.forEach((amount, idx) => {
        const ox = L.mobile ? x + 24 : x + 24 + idx * (optW + optGap);
        const oy = L.mobile ? cy + 66 + idx * (optH + 10) : cy + 72;
        const btn = { x: ox, y: oy, w: optW, h: optH, onClick: () => this._selectInvestmentAmount(amount) };
        this.buttons.push(btn);
        fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 16, "rgba(255,255,255,0.05)");
        strokeRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 16, "rgba(243,187,102,0.28)", 1);
        ctx.fillStyle = "rgba(255,255,255,0.98)";
        ctx.font = "700 20px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${amount} TON`, btn.x + btn.w / 2, btn.y + btn.h / 2 - 6);
        ctx.fillStyle = "rgba(255,213,156,0.76)";
        ctx.font = "500 11px system-ui";
        ctx.fillText("Limit seç", btn.x + btn.w / 2, btn.y + btn.h / 2 + 16);
      });

      const cancelBtn = { x: x + 24, y: L.mobile ? cy + 66 + options.length * (optH + 10) : cy + 72 + optH + 18, w: L.mobile ? fullW - 32 : 160, h: 40, onClick: () => this._cancelInvestmentFlow() };
      this.buttons.push(cancelBtn);
      drawActionBtn(cancelBtn, "Vazgeç", "soft");
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      return;
    }

    if (step === "payment" || step === "confirmed") {
      const blockH = L.mobile ? 330 : 286;
      this.drawCard(ctx, x + 8, cy, fullW, blockH);
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = "700 17px system-ui";
      ctx.fillText("Yatırım Ödeme Bilgisi", x + 24, cy + 28);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = "500 12px system-ui";
      ctx.fillText(`Seçilen limit: ${Number(wallet.selectedInvestmentTon || 0)} TON`, x + 24, cy + 50);

      this.drawCard(ctx, x + 24, cy + 64, fullW - 32, 84);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = "500 12px system-ui";
      ctx.fillText("TON Cüzdan Adresi", x + 40, cy + 92);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 13px system-ui";
      textFit(ctx, address, x + 40, cy + 118, fullW - 64);

      const copyBtn = { x: x + 24, y: cy + 164, w: L.mobile ? fullW - 32 : 168, h: 42, onClick: () => this._copyWalletAddress() };
      const paidBtn = { x: L.mobile ? x + 24 : x + 202, y: L.mobile ? cy + 214 : cy + 164, w: L.mobile ? fullW - 32 : fullW - 210, h: 42, onClick: () => this._confirmInvestmentPaid() };
      const backBtn = { x: x + 24, y: L.mobile ? cy + 264 : cy + 218, w: L.mobile ? fullW - 32 : 168, h: 38, onClick: () => this._openInvestmentSelector() };
      this.buttons.push(copyBtn, paidBtn, backBtn);
      drawActionBtn(copyBtn, "Adresi Kopyala", "soft");
      drawActionBtn(paidBtn, step === "confirmed" ? "Onay Gönderildi" : "Ödemeyi Yaptım");
      drawActionBtn(backBtn, "Limiti Değiştir", "soft");

      ctx.fillStyle = step === "confirmed" ? "rgba(124,255,170,0.92)" : "rgba(255,255,255,0.70)";
      ctx.font = "500 12px system-ui";
      const msg = step === "confirmed"
        ? `Onay kaydı oluşturuldu${wallet.investmentRequestId ? ` • ${wallet.investmentRequestId}` : ""}`
        : "Ödemeyi yaptıktan sonra Ödemeyi Yaptım butonuna bas.";
      const lines = wrapText(ctx, msg, fullW - 48, 3);
      const msgY = L.mobile ? cy + 314 : cy + 268;
      lines.forEach((line, i) => ctx.fillText(line, x + 24, msgY + i * 16));
      cy += blockH + 14;

      if (latestInvestment) {
        this.drawCard(ctx, x + 8, cy, fullW, 88);
        ctx.fillStyle = "rgba(255,213,156,0.76)";
        ctx.font = "500 12px system-ui";
        ctx.fillText("Son Yatırım Talebi", x + 24, cy + 28);
        ctx.fillStyle = "rgba(255,255,255,0.98)";
        ctx.font = "700 16px system-ui";
        ctx.fillText(`${Number(latestInvestment.amountTon || 0)} TON`, x + 24, cy + 54);
        ctx.fillStyle = "rgba(124,255,170,0.92)";
        ctx.font = "700 12px system-ui";
        ctx.fillText("Durum: ödeme onayı bekleniyor", x + 24, cy + 74);
      }
      return;
    }

    this.drawCard(ctx, x + 8, cy, fullW, 86);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = "700 16px system-ui";
    ctx.fillText("Yatırım Sistemi Hazır", x + 24, cy + 30);
    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "500 12px system-ui";
    ctx.fillText("Yatırım Yap butonuna bas, limit seç, TON adresine gönder ve onayla.", x + 24, cy + 56);
  }

  drawRankingContent(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const username = String(p.username || "Player").trim() || "Player";
    const board = Array.isArray(state?.pvp?.leaderboard) ? state.pvp.leaderboard.slice() : [];
    board.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const list = board.length ? board.slice(0, 12) : [{ name: username, wins: 0, losses: 0, rating: 1000, score: 1000 }];

    this.drawSectionTitle(ctx, "Sıralama", "PvP kayıtları", x + 8, y + 20, w - 16);
    let rowY = y + 40;

    list.forEach((item, index) => {
      const rowH = L.mobile ? 44 : 40;
      const isMe = String(item.name || "") === username;
      this.drawCard(ctx, x + 8, rowY, w - 16, rowH);
      if (isMe) fillRoundRect(ctx, x + 8, rowY, w - 16, rowH, 18, "rgba(243,187,102,0.10)");
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = isMe ? "#ffd494" : "rgba(255,255,255,0.96)";
      ctx.font = "700 14px system-ui";
      ctx.fillText(`#${index + 1}`, x + 22, rowY + 25);
      textFit(ctx, String(item.name || "Player"), x + 62, rowY + 25, w - 220);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "500 12px system-ui";
      ctx.fillText(`${Number(item.wins || 0)}W/${Number(item.losses || 0)}L`, x + w - 110, rowY + 25);
      ctx.fillStyle = "#f6c46b";
      ctx.font = "700 13px system-ui";
      ctx.fillText(String(Number(item.rating || 1000)), x + w - 30, rowY + 25);
      rowY += rowH + 8;
    });

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}
