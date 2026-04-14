import { openExternalWallet, WALLET_APP_URL } from "../walletBridge.js?v=20260413-wallet-1";

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
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(v) ? 0 : 3,
  });
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
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 6,
  });
}

const YTON_TO_TON_RATE = 0.001;
const TON_TO_YTON_RATE = 1000;

function roundYtonAmount(value, fractionDigits = 3) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** fractionDigits;
  return Math.round((numeric + Number.EPSILON) * factor) / factor;
}

function roundTonAmount(value, fractionDigits = 6) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** fractionDigits;
  return Math.round((numeric + Number.EPSILON) * factor) / factor;
}

const PROFILE_TEXT = {
  tr: {
    tabProfile: "Genel",
    tabWallet: "Harici Cuzdan",
    tabRanking: "Siralama",
    tabRivals: "Rakipler",
    heroLevel: "Level",
    heroClan: "Clan",
    heroEnergy: "Enerji",
    heroRating: "Rating",
    noClan: "No Clan",
    online: "ONLINE",
    profileEnergy: "Enerji",
    profileReady: "Hazir durum",
    profileRating: "Rating",
    profilePvpValue: "PvP degeri",
    profileMatch: "Mac",
    profileWinRate: "{rate}% win rate",
    profileStatus: "Durum",
    profileActive: "TonCrime aktif",
    actions: "Islemler",
    editAvatar: "Avatar Duzenle",
    telegram: "TonCrime Telegram",
    rankingTitle: "Siralama",
    rankingSub: "PvP kayitlari",
    rivalsTitle: "Rakip Profilleri",
    rivalsSub: "Arena Rakipleri, Black Market Rivals ve sokak kayitlari",
  },
  en: {
    tabProfile: "Profile",
    tabWallet: "External Wallet",
    tabRanking: "Ranking",
    tabRivals: "Rivals",
    heroLevel: "Level",
    heroClan: "Clan",
    heroEnergy: "Energy",
    heroRating: "Rating",
    noClan: "No Clan",
    online: "ONLINE",
    profileEnergy: "Energy",
    profileReady: "Ready status",
    profileRating: "Rating",
    profilePvpValue: "PvP score",
    profileMatch: "Matches",
    profileWinRate: "{rate}% win rate",
    profileStatus: "Status",
    profileActive: "TonCrime active",
    actions: "Actions",
    editAvatar: "Edit Avatar",
    telegram: "TonCrime Telegram",
    rankingTitle: "Ranking",
    rankingSub: "PvP records",
    rivalsTitle: "Rival Profiles",
    rivalsSub: "Arena Rivals, Black Market Rivals, and street records",
  },
};

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
    this._sceneInputs = null;
    this._canvasRect = null;
    this.activeTab = "profile";
  }

  onEnter() {
    this._destroySceneInputs();
    this._ensureAvatarInput();
    this._syncYtonMirror();
    this._ensureWalletState();
    this._seedLeaderboard();
    const uiTab = String(this.store.get()?.ui?.profileTab || "profile");
    this.activeTab = ["profile", "wallet", "ranking", "rivals"].includes(uiTab) ? uiTab : "profile";
    this.scrollY = 0;
    this.scrollMax = 0;
    this._dragScroll = null;
  }

  onExit() {
    this._dragScroll = null;
    this._hideSceneInputs();
    this._destroySceneInputs();
  }

  _lang() {
    return this.store?.get?.()?.lang === "en" ? "en" : "tr";
  }

  _text(key, fallback = "") {
    const lang = this._lang();
    return (
      PROFILE_TEXT?.[lang]?.[key] ??
      PROFILE_TEXT?.tr?.[key] ??
      fallback ??
      key
    );
  }

  _format(key, vars = {}, fallback = "") {
    let text = this._text(key, fallback);
    for (const [name, value] of Object.entries(vars || {})) {
      text = text.replaceAll(`{${name}}`, String(value ?? ""));
    }
    return text;
  }

  _ui(trText, enText) {
    return this._lang() === "en" ? enText : trText;
  }

  _toast(text) {
    try {
      window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text } }));
    } catch (_) {}
  }

  async _openExternalWallet(params = {}) {
    this._toast(this._ui("Harici cuzdan hazirlaniyor", "Preparing external wallet"));
    const result = await openExternalWallet({ source: "profile", ...params });
    if (!result?.opened) {
      this._toast(this._ui("Cuzdan penceresi acilamadi", "Wallet window could not be opened"));
      return;
    }
    if (!result.signed) {
      this._toast(this._ui("Cuzdan acildi, oturum icin Telegram girisi gerekebilir", "Wallet opened, Telegram sign-in may be required"));
    }
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

  _selectRivalProfile(id) {
    const rivalId = String(id || "").trim();
    if (!rivalId) return;
    const s = this.store.get() || {};
    this.store.set({
      ui: {
        ...(s.ui || {}),
        selectedRivalProfileId: rivalId,
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
        this._toast(this._ui("Avatar guncellendi", "Avatar updated"));
      } catch (err) {
        console.error("[ProfileScene] avatar upload error:", err);
        this._toast(this._ui("Avatar yuklenemedi", "Avatar upload failed"));
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
    if (!wallet.tonBalance) wallet.tonBalance = 0;
    if (!wallet.walletAddressInput) wallet.walletAddressInput = wallet.connectedAddress || "";
    if (!wallet.convertYtonInput) wallet.convertYtonInput = "";
    if (!wallet.convertTonInput) wallet.convertTonInput = "";
    if (!['toTon', 'toYton'].includes(wallet.conversionMode)) wallet.conversionMode = '';
    if (!wallet.withdrawTonInput) wallet.withdrawTonInput = "";
    if (!wallet.lastConvertedYton) wallet.lastConvertedYton = 0;
    if (!wallet.lastConvertedTon) wallet.lastConvertedTon = 0;
    if (!wallet.lastReverseConvertedTon) wallet.lastReverseConvertedTon = 0;
    if (!wallet.lastReverseConvertedYton) wallet.lastReverseConvertedYton = 0;
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

  _syncYtonMirror() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nextCoins = Number(s.coins ?? p.coins ?? 0);
    const normalizedCoins = Number.isFinite(nextCoins) ? Math.max(0, nextCoins) : 0;
    const currentYton = Number(s.yton);
    const currentPlayerCoins = Number(p.coins);
    if (currentYton === normalizedCoins && currentPlayerCoins === normalizedCoins) return;

    this.store.set({
      yton: normalizedCoins,
      player: {
        ...p,
        coins: normalizedCoins,
      },
    });
  }

  _getPlayerYtonBalance() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const balance = Number(s.coins ?? p.coins ?? s.yton ?? 0);
    return Number.isFinite(balance) ? Math.max(0, balance) : 0;
  }

  _setPlayerYtonBalance(value) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const next = roundYtonAmount(Math.max(0, Number(value || 0)));
    this.store.set({
      yton: next,
      coins: next,
      player: {
        ...p,
        coins: next,
      },
    });
  }

  _getWalletTonBalance() {
    const wallet = this._walletState();
    const balance = Number(wallet.tonBalance || 0);
    return Number.isFinite(balance) ? Math.max(0, balance) : 0;
  }

  _ensureSceneInputs() {
    if (this._sceneInputs) return this._sceneInputs;
    const baseStyle = {
      position: 'fixed',
      display: 'none',
      zIndex: '8000',
      pointerEvents: 'auto',
      boxSizing: 'border-box',
      borderRadius: '16px',
      border: '1px solid rgba(243,187,102,0.28)',
      background: 'rgba(20,12,10,0.74)',
      color: '#fff8ee',
      padding: '0 16px',
      outline: 'none',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
    };
    const createInput = (key, placeholder, inputMode = 'text') => {
      const el = document.createElement('input');
      el.type = 'text';
      el.inputMode = inputMode;
      el.dataset.tcProfileInput = '1';
      el.placeholder = placeholder;
      Object.assign(el.style, baseStyle);
      el.autocomplete = 'off';
      el.spellcheck = false;
      el.addEventListener('input', () => this._setWallet({ [key]: el.value }));
      el.addEventListener('focus', () => {
        el.style.border = '1px solid rgba(243,187,102,0.62)';
        el.style.boxShadow = '0 0 0 1px rgba(243,187,102,0.16), inset 0 1px 0 rgba(255,255,255,0.05)';
      });
      el.addEventListener('blur', () => {
        el.style.border = '1px solid rgba(243,187,102,0.28)';
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
      });
      ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown'].forEach((evt) => {
        el.addEventListener(evt, (e) => e.stopPropagation(), { passive: true });
      });
      document.body.appendChild(el);
      return el;
    };
    this._sceneInputs = {
      walletAddressInput: createInput('walletAddressInput', 'EQ... veya UQ...', 'text'),
      convertYtonInput: createInput('convertYtonInput', 'YTON miktarı', 'decimal'),
      convertTonInput: createInput('convertTonInput', 'TON miktarı', 'decimal'),
      withdrawTonInput: createInput('withdrawTonInput', 'Çekilecek TON miktarı', 'decimal'),
    };
    return this._sceneInputs;
  }

  _hideSceneInputs() {
    if (!this._sceneInputs) return;
    Object.values(this._sceneInputs).forEach((el) => {
      if (!el) return;
      if (document.activeElement === el) {
        try { el.blur(); } catch (_) {}
      }
      el.style.display = 'none';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
    });
  }

  _beginSceneInputFrame() {
    this._visibleSceneInputs = new Set();
  }

  _endSceneInputFrame() {
    if (!this._sceneInputs) return;
    const visible = this._visibleSceneInputs || new Set();
    for (const [key, el] of Object.entries(this._sceneInputs)) {
      if (!visible.has(key) && el) {
        if (document.activeElement === el) {
          try { el.blur(); } catch (_) {}
        }
        el.style.display = 'none';
        el.style.left = '-9999px';
        el.style.top = '-9999px';
      }
    }
    this._visibleSceneInputs = null;
  }

  _destroySceneInputs() {
    if (this._sceneInputs) {
      Object.values(this._sceneInputs).forEach((el) => {
        try { el?.remove?.(); } catch (_) {}
      });
    }
    const staleInputs = document.querySelectorAll('input[data-tc-profile-input="1"]');
    staleInputs.forEach((el) => {
      try { el?.remove?.(); } catch (_) {}
    });
    this._sceneInputs = null;
    this._visibleSceneInputs = null;
  }

  _showSceneInput(key, x, y, w, h, value, placeholder = '') {
    const inputs = this._ensureSceneInputs();
    const el = inputs[key];
    const rect = this._canvasRect;
    const area = this.scrollArea;
    if (!el || !rect || !area) return;
    const visibleTop = area.y + 2;
    const visibleBottom = area.y + area.h - 2;
    if (y + h < visibleTop || y > visibleBottom) {
      el.style.display = 'none';
      return;
    }
    if (document.activeElement !== el && el.value !== String(value ?? '')) {
      el.value = String(value ?? '');
    }
    if (this._visibleSceneInputs) this._visibleSceneInputs.add(key);
    el.placeholder = placeholder;
    el.style.display = 'block';
    el.style.left = `${Math.round(rect.left + x)}px`;
    el.style.top = `${Math.round(rect.top + y)}px`;
    el.style.width = `${Math.max(120, Math.round(w))}px`;
    el.style.height = `${Math.max(40, Math.round(h))}px`;
  }

  _connectWallet() {
    const wallet = this._walletState();
    const address = String(wallet.walletAddressInput || wallet.connectedAddress || '').trim();
    if (!address) {
      this._toast(this._ui('Once cuzdan adresini yaz', 'Enter a wallet address first'));
      return;
    }
    if (!isLikelyTonAddress(address)) {
      this._toast(this._ui('Gecerli bir TON cuzdan adresi gir', 'Enter a valid TON wallet address'));
      return;
    }
    this._setWallet({ connectedAddress: address, walletAddressInput: address, withdrawTargetAddress: address });
    this._toast(
      wallet.connectedAddress
        ? this._ui('Cuzdan adresi guncellendi', 'Wallet address updated')
        : this._ui('Cuzdan baglandi', 'Wallet connected')
    );
  }

  _disconnectWallet() {
    this._setWallet({ connectedAddress: '', walletAddressInput: '', withdrawTargetAddress: '' });
    this._toast(this._ui('Cuzdan baglantisi kaldirildi', 'Wallet disconnected'));
  }

  _useAllConvertibleYton() {
    const balance = this._getPlayerYtonBalance();
    this._setWallet({ convertYtonInput: balance > 0 ? String(balance) : '' });
  }

  _convertYtonToTon() {
    const s = this.store.get() || {};
    const wallet = this._walletState();
    const player = s.player || {};
    const ytonBalance = this._getPlayerYtonBalance();
    const raw = String(wallet.convertYtonInput || '').trim();
    const amountYton = parseTonAmount(raw);
    if (!Number.isFinite(amountYton)) {
      this._toast(this._ui('Gecerli bir YTON miktari gir', 'Enter a valid YTON amount'));
      return;
    }
    if (amountYton <= 0) {
      this._toast(this._ui('Donusum miktari 0dan buyuk olmali', 'Conversion amount must be greater than 0'));
      return;
    }
    if (amountYton > ytonBalance) {
      this._toast(this._ui('Kasadaki YTON bakiyen yetersiz', 'Not enough YTON balance'));
      return;
    }
    const convertedTon = roundTonAmount(amountYton * YTON_TO_TON_RATE);
    if (convertedTon <= 0) {
      this._toast(this._ui('Miktar cok kucuk, daha buyuk bir YTON gir', 'Amount is too small, enter a larger YTON value'));
      return;
    }
    const nextYton = roundYtonAmount(Math.max(0, ytonBalance - amountYton));
    const nextTon = roundTonAmount(this._getWalletTonBalance() + convertedTon);
    this.store.set({
      yton: nextYton,
      coins: nextYton,
      player: {
        ...player,
        coins: nextYton,
      },
      wallet: {
        ...wallet,
        tonBalance: nextTon,
        convertYtonInput: '',
        lastConvertedYton: amountYton,
        lastConvertedTon: convertedTon,
      },
    });
    this._toast(
      this._ui(
        `${tonFmt(amountYton)} YTON, ${tonFmt(convertedTon)} TON oldu`,
        `${tonFmt(amountYton)} YTON became ${tonFmt(convertedTon)} TON`
      )
    );
  }

  _useAllTonBalance() {
    const balance = this._getWalletTonBalance();
    this._setWallet({ convertTonInput: balance > 0 ? String(balance) : '' });
  }

  _convertTonToYton() {
    const s = this.store.get() || {};
    const wallet = this._walletState();
    const player = s.player || {};
    const tonBalance = this._getWalletTonBalance();
    const raw = String(wallet.convertTonInput || '').trim();
    const amountTon = parseTonAmount(raw);
    if (!Number.isFinite(amountTon)) {
      this._toast(this._ui('Gecerli bir TON miktari gir', 'Enter a valid TON amount'));
      return;
    }
    if (amountTon <= 0) {
      this._toast(this._ui('Donusum miktari 0dan buyuk olmali', 'Conversion amount must be greater than 0'));
      return;
    }
    if (amountTon > tonBalance) {
      this._toast(this._ui('TON bakiyen yetersiz', 'Not enough TON balance'));
      return;
    }
    const convertedYton = roundYtonAmount(amountTon * TON_TO_YTON_RATE);
    const nextTon = roundTonAmount(Math.max(0, tonBalance - amountTon));
    const nextYton = roundYtonAmount(this._getPlayerYtonBalance() + convertedYton);
    this.store.set({
      yton: nextYton,
      coins: nextYton,
      player: {
        ...player,
        coins: nextYton,
      },
      wallet: {
        ...wallet,
        tonBalance: nextTon,
        convertTonInput: '',
        lastReverseConvertedTon: amountTon,
        lastReverseConvertedYton: convertedYton,
      },
    });
    this._toast(
      this._ui(
        `${tonFmt(amountTon)} TON, ${tonFmt(convertedYton)} YTON oldu`,
        `${tonFmt(amountTon)} TON became ${tonFmt(convertedYton)} YTON`
      )
    );
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
      this._toast(this._ui("TON adresi kopyalandi", "TON address copied"));
    } catch (_) {
      this._toast(this._ui("Adres kopyalanamadi", "Address could not be copied"));
    }
  }

  _confirmInvestmentPaid() {
    const wallet = this._walletState();
    const amountTon = Math.max(0, Number(wallet.selectedInvestmentTon || 0));
    if (!amountTon) {
      this._toast(this._ui("Once yatirim limiti sec", "Select an investment tier first"));
      return;
    }
    if (String(wallet.investmentStep || "") === "confirmed") {
      this._toast(this._ui("Bu yatirim zaten onaylandi", "This investment is already confirmed"));
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
    this._toast(this._ui("Yatirim onayi alindi", "Investment confirmation received"));
  }

  _requestWithdraw() {
    const wallet = this._walletState();
    const targetAddress = String(wallet.connectedAddress || wallet.walletAddressInput || '').trim();
    if (!targetAddress) {
      this._toast(this._ui('Once bagli cuzdan adresi gir ve kaydet', 'Enter and save a connected wallet address first'));
      return;
    }
    if (!isLikelyTonAddress(targetAddress)) {
      this._toast(this._ui('Gecerli bir TON cuzdan adresi gir', 'Enter a valid TON wallet address'));
      return;
    }

    const amountTon = parseTonAmount(wallet.withdrawTonInput);
    if (!Number.isFinite(amountTon)) {
      this._toast(this._ui('Gecerli bir TON miktari gir', 'Enter a valid TON amount'));
      return;
    }
    if (amountTon < 0.5 || amountTon > 100) {
      this._toast(this._ui('Cekim limiti 0.5 TON ile 100 TON arasinda olmali', 'Withdrawal limit must be between 0.5 TON and 100 TON'));
      return;
    }
    const tonBalance = this._getWalletTonBalance();
    if (amountTon > tonBalance) {
      this._toast(this._ui('TON bakiyen yetersiz', 'Not enough TON balance'));
      return;
    }

    const requestId = `WD-${Date.now().toString(36).toUpperCase()}`;
    const withdraws = Array.isArray(wallet.withdraws) ? wallet.withdraws.slice() : [];
    withdraws.unshift({
      id: requestId,
      amountTon,
      address: targetAddress,
      status: 'pending_review',
      createdAt: Date.now(),
    });

    const nextTon = roundTonAmount(Math.max(0, tonBalance - amountTon));
    this._setWallet({
      tonBalance: nextTon,
      connectedAddress: targetAddress,
      walletAddressInput: targetAddress,
      withdrawPending: true,
      withdrawRequestedAt: Date.now(),
      withdrawAmountTon: amountTon,
      withdrawTargetAddress: targetAddress,
      withdrawRequestId: requestId,
      withdrawTonInput: '',
      withdraws,
    });

    try {
      window.tcActivityFeed?.push?.({
        event: "withdraw",
        actor: String(this.getState?.()?.player?.username || "Player").trim() || "Player",
        amountTon,
      });
    } catch (_) {}

    this._toast(this._ui('Cekim talebi olusturuldu', 'Withdrawal request created'));
  }

  _botProfiles(state = this.getState()) {
    try {
      const engineList = window.tcBotEngine?.listProfiles?.();
      if (Array.isArray(engineList) && engineList.length) return engineList.map((bot) => ({ ...bot }));
    } catch (_) {}
    return (Array.isArray(state?.bots) ? state.bots : [])
      .filter((bot) => bot && (bot.isBot || bot.isRival || bot.group || bot.kind))
      .map((bot) => ({ ...bot }));
  }

  _selectedRival(state, bots) {
    const pvp = state?.pvp || {};
    const ui = state?.ui || {};
    const selectedId = String(
      ui.selectedRivalProfileId ||
      ui.selectedBotProfileId ||
      pvp.currentOpponentProfileId ||
      pvp.currentOpponent?.id ||
      pvp.currentOpponentProfile?.id ||
      ""
    ).trim();
    const list = Array.isArray(bots) ? bots : [];
    const direct = selectedId
      ? list.find((bot) => String(bot.id || "").trim() === selectedId || String(bot.username || "").trim() === selectedId)
      : null;
    if (direct) return direct;
    if (pvp.currentOpponentProfile?.username) return pvp.currentOpponentProfile;
    if (pvp.currentOpponent?.username) return pvp.currentOpponent;
    return list[0] || null;
  }

  _rivalSortValue(bot) {
    if (bot?.kind === "blackMarket") return 0;
    if (bot?.kind === "arena") return 1;
    return 2;
  }

  _seedLeaderboard() {
    try {
      const s = this.store.get() || {};
      const pvp = { ...(s.pvp || {}) };
      const p = s.player || {};
      const username = String(p.username || "Player").trim() || "Player";
      const selfId = String(p.telegramId || p.id || "player_main").trim() || "player_main";
      const board = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.map((x) => ({ ...x })) : [];
      const rivalRows = this._botProfiles(s)
        .slice()
        .sort((a, b) => Number(b.rating || b.rank || 0) - Number(a.rating || a.rank || 0))
        .slice(0, 40)
        .map((bot) => {
          const botWins = Math.max(0, Number(bot.wins || 0));
          const botLosses = Math.max(0, Number(bot.losses || 0));
          const botRating = Math.max(100, Number(bot.rating || bot.rank || 1000));
          return {
            id: String(bot.id || bot.username || ""),
            name: String(bot.username || bot.name || "Rival"),
            wins: botWins,
            losses: botLosses,
            rating: botRating,
            score: botRating + botWins * 8,
            group: bot.group || "",
            premium: !!bot.premium,
            isRival: true,
            updatedAt: Date.now(),
          };
        });
      const rivalIds = new Set(rivalRows.map((row) => row.id).filter(Boolean));
      const wins = Math.max(0, Number(pvp.wins || 0));
      const losses = Math.max(0, Number(pvp.losses || 0));
      const rating = Math.max(0, Number(pvp.rating || 1000));
      const score = rating + wins * 8;
      const next = board.filter((x) => {
        if (!x) return false;
        const rowId = String(x.id || x.telegram_id || x.telegramId || "").trim();
        if (x.isRival || rivalIds.has(rowId)) return false;
        if (rowId) return rowId !== selfId;
        return String(x.name || "") !== username;
      });
      next.push({
        id: selfId,
        name: username,
        wins,
        losses,
        rating,
        score,
        updatedAt: Date.now(),
      });
      next.push(...rivalRows);
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
    const walletMode = this.activeTab === "wallet";
    const hudTop = Number(state.ui?.hudReservedTop || (mobile ? 84 : 96));
    const chatBottom = Number(state.ui?.chatReservedBottom || (mobile ? 74 : 88));
    const side = mobile ? 10 : Math.max(16, Math.floor(safe.w * 0.03));
    const top = Math.max(safe.y + 8, safe.y + hudTop + 6);
    const bottom = safe.y + safe.h - Math.max(8, chatBottom - 8);
    const panelX = safe.x + side;
    const panelY = top;
    const panelW = safe.w - side * 2;
    const panelH = Math.max(340, bottom - top);
    const headerH = mobile ? 50 : 54;
    const heroVisible = !walletMode;
    const heroH = heroVisible ? (mobile ? 152 : 166) : 0;
    const heroGap = heroVisible ? 8 : 2;
    const tabH = mobile ? 36 : 40;
    const contentGap = walletMode ? 10 : 14;
    const contentY = panelY + headerH + heroH + heroGap + tabH + contentGap;
    const contentH = panelY + panelH - contentY - 14;

    return {
      mobile,
      walletMode,
      heroVisible,
      w,
      h,
      safe,
      panelX,
      panelY,
      panelW,
      panelH,
      headerH,
      heroH,
      heroGap,
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
      return layout.mobile ? 720 : 620;
    }
    if (tab === "ranking") {
      const board = Array.isArray(state?.pvp?.leaderboard) ? state.pvp.leaderboard : [];
      return 70 + Math.max(6, Math.min(12, board.length || 6)) * (layout.mobile ? 52 : 48);
    }
    if (tab === "rivals") {
      const bots = this._botProfiles(state);
      const rows = Math.max(8, Math.min(layout.mobile ? 18 : 16, bots.length || 8));
      return (layout.mobile ? 420 : 380) + rows * (layout.mobile ? 82 : 74);
    }
    return layout.mobile ? 448 : 332;
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
    this._canvasRect = ctx?.canvas?.getBoundingClientRect?.() || null;
    this._beginSceneInputFrame();

    this.drawBackground(ctx, L.w, L.h);
    this.drawShell(ctx, state, L);
    this._endSceneInputFrame();
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
    if (L.heroVisible) this.drawHero(ctx, state, L);
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
    else if (this.activeTab === "rivals") this.drawRivalsContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);
    else this.drawProfileContent(ctx, state, viewportX + 2, drawY + 2, viewportW - 6, contentH - 4, L);

    this.endScrollArea(ctx);
    this.drawScrollBar(ctx);
  }

  drawHeader(ctx, L) {
    const closeSize = L.mobile ? 38 : 42;
    const closeBtn = {
      x: L.panelX + L.panelW - L.pad - closeSize,
      y: L.panelY + 10,
      w: closeSize,
      h: closeSize,
      onClick: () => this.scenes?.go?.("home"),
    };
    this.buttons.push(closeBtn);
    fillRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 14, "rgba(12,12,14,0.26)");
    strokeRoundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 14, "rgba(255,255,255,0.10)", 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${L.mobile ? 24 : 28}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
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
    const clanName = String(state?.clan?.name || state?.clan?.tag || this._text("noClan"));
    const username = String(p.username || "Player").trim() || "Player";
    const level = Math.max(0, Number(p.level ?? 0));
    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Math.min(100, Number(p.energyMax || 100)));
    const rating = Math.max(0, Number(pvp.rating || 1000));

    fillRoundRect(ctx, x, y, w, h, 22, "rgba(10,12,16,0.18)");
    strokeRoundRect(ctx, x, y, w, h, 22, "rgba(255,193,111,0.24)", 1);

    const avatarFrameX = x + 16;
    const avatarFrameY = y + 14;
    const avatarFrameW = L.mobile ? 90 : 104;
    const avatarFrameH = L.mobile ? 90 : 104;

    fillRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,255,255,0.04)");
    strokeRoundRect(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18, "rgba(255,182,86,0.14)", 1);

    const avatarX = avatarFrameX + 7;
    const avatarY = avatarFrameY + 7;
    const avatarW = avatarFrameW - 14;
    const avatarH = avatarFrameH - 14;
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
      ctx.font = `900 ${L.mobile ? 28 : 32}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 1);
    }
    ctx.restore();

    const statusW = L.mobile ? 66 : 76;
    fillRoundRect(ctx, avatarFrameX + 6, avatarFrameY + avatarFrameH - 23, statusW, 18, 9, "rgba(39,216,92,0.96)");
    ctx.fillStyle = "#08130d";
    ctx.font = `900 ${L.mobile ? 10 : 11}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this._text("online"), avatarFrameX + 6 + statusW / 2, avatarFrameY + avatarFrameH - 14);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,213,156,0.70)";
    ctx.font = `600 ${L.mobile ? 11 : 12}px Georgia, "Times New Roman", serif`;
    ctx.fillText(this._text("heroClan"), avatarFrameX + 2, avatarFrameY + avatarFrameH + 18);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `700 ${L.mobile ? 14 : 16}px Georgia, "Times New Roman", serif`;
    textFit(ctx, clanName, avatarFrameX + 2, avatarFrameY + avatarFrameH + 38, avatarFrameW + 12);

    const infoX = avatarFrameX + avatarFrameW + 18;
    const infoY = avatarFrameY + 2;
    const infoW = w - (infoX - x) - 16;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `700 ${L.mobile ? 20 : 28}px Georgia, "Times New Roman", serif`;
    textFit(ctx, username, infoX, infoY + 20, infoW);

    const drawStatLine = (sx, sy, sw, label, value) => {
      ctx.fillStyle = "rgba(255,213,156,0.70)";
      ctx.font = `600 ${L.mobile ? 10 : 11}px system-ui`;
      textFit(ctx, label, sx, sy, sw);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = `700 ${L.mobile ? 16 : 18}px Georgia, "Times New Roman", serif`;
      textFit(ctx, value, sx, sy + 20, sw);
    };

    if (L.mobile) {
      drawStatLine(infoX, infoY + 48, infoW, this._text("heroLevel"), String(level));
      drawStatLine(infoX, infoY + 78, infoW, this._text("heroEnergy"), `${energy}/${energyMax}`);
      drawStatLine(infoX, infoY + 108, infoW, this._text("heroRating"), String(rating));
    } else {
      const statGap = 18;
      const statW = Math.max(90, Math.floor((infoW - statGap) / 2));
      drawStatLine(infoX, infoY + 52, statW, this._text("heroLevel"), String(level));
      drawStatLine(infoX + statW + statGap, infoY + 52, statW, this._text("heroRating"), String(rating));
      drawStatLine(infoX, infoY + 92, infoW, this._text("heroEnergy"), `${energy}/${energyMax}`);
    }
  }

  drawTabs(ctx, L) {
    const x = L.panelX + L.pad;
    const y = L.panelY + L.headerH + L.heroH + (L.heroGap || 2);
    const w = L.panelW - L.pad * 2;
    const gap = 8;
    const tabs = [
      { id: "profile", label: this._text("tabProfile") },
      { id: "wallet", label: this._text("tabWallet") },
      { id: "ranking", label: this._text("tabRanking") },
      { id: "rivals", label: this._text("tabRivals") },
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
      ctx.font = `700 ${L.mobile && tabW < 76 ? 11 : L.mobile ? 12 : 13}px system-ui`;
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
    const energyMax = Math.max(1, Math.min(100, Number(p.energyMax || 100)));
    const rating = Math.max(0, Number(pvp.rating || 1000));

    const gap = 12;
    const cardX = x + 8;
    const fullW = w - 16;
    const colW = Math.floor((fullW - gap) / 2);

    const drawStat = (sx, sy, sw, title, value, sub) => {
      this.drawCard(ctx, sx, sy, sw, 80);
      ctx.fillStyle = "rgba(255,213,156,0.78)";
      ctx.font = "500 12px system-ui";
      textFit(ctx, title, sx + 16, sy + 24, sw - 32);
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = `700 ${L.mobile ? 28 : 30}px Georgia, "Times New Roman", serif`;
      textFit(ctx, value, sx + 16, sy + 56, sw - 32);
      if (sub) {
        ctx.fillStyle = "rgba(255,255,255,0.66)";
        ctx.font = "500 11px system-ui";
        textFit(ctx, sub, sx + 16, sy + 72, sw - 32);
      }
    };

    let actionsY = y + 8;
    if (L.mobile) {
      drawStat(cardX, actionsY, fullW, this._text("profileEnergy"), `${energy}/${energyMax}`, this._text("profileReady"));
      drawStat(cardX, actionsY + 92, fullW, this._text("profileRating"), String(rating), this._text("profilePvpValue"));
      drawStat(
        cardX,
        actionsY + 184,
        fullW,
        this._text("profileMatch"),
        `${wins}-${losses}`,
        this._format("profileWinRate", { rate: winRate })
      );
      actionsY += 288;
    } else {
      drawStat(cardX, actionsY, colW, this._text("profileEnergy"), `${energy}/${energyMax}`, this._text("profileReady"));
      drawStat(cardX + colW + gap, actionsY, colW, this._text("profileRating"), String(rating), this._text("profilePvpValue"));
      drawStat(
        cardX,
        actionsY + 92,
        fullW,
        this._text("profileMatch"),
        `${wins}-${losses}`,
        this._format("profileWinRate", { rate: winRate })
      );
      actionsY += 196;
    }

    this.drawSectionTitle(ctx, this._text("actions"), null, cardX, actionsY + 12, fullW);

    const btnGap = 12;
    const btnW = L.mobile ? fullW : Math.floor((fullW - btnGap) / 2);
    const btnH = 46;
    const editBtn = { x: cardX, y: actionsY + 28, w: btnW, h: btnH, onClick: () => this._fileInput?.click() };
    const tgBtn = {
      x: L.mobile ? cardX : cardX + btnW + btnGap,
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

    drawBtn(editBtn, this._text("editAvatar"));
    drawBtn(tgBtn, this._text("telegram"));

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawWalletContent(ctx, state, x, y, w, h, L) {
    const t = (tr, en) => this._ui(tr, en);
    const ytonBalance = this._getPlayerYtonBalance();
    const fullW = w - 16;
    const cardX = x + 8;
    const innerX = cardX + 16;
    const innerW = fullW - 32;
    const cardGap = 16;
    let cy = y + 8;

    const drawActionBtn = (btn, label, tone = "gold") => {
      fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, tone === "soft" ? "rgba(255,255,255,0.08)" : "rgba(243,187,102,0.16)");
      strokeRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, tone === "soft" ? "rgba(255,255,255,0.16)" : "rgba(243,187,102,0.38)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = `800 ${L.mobile ? 13 : 15}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      textFit(ctx, label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, btn.w - 22);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    };

    const drawCardHead = (title, sub, y0) => {
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = `900 ${L.mobile ? 18 : 22}px system-ui`;
      textFit(ctx, title, innerX, y0 + 34, innerW);
      ctx.fillStyle = "rgba(255,213,156,0.78)";
      ctx.font = "500 12px system-ui";
      wrapText(ctx, sub, innerW, 3).forEach((line, idx) => ctx.fillText(line, innerX, y0 + 56 + idx * 15));
    };

    this.drawCard(ctx, cardX, cy, fullW, 174);
    drawCardHead(
      t("Harici Cuzdan Merkezi", "External Wallet Hub"),
      t(
        "TON yatirma, cekim ve crypto alim-satim islemleri Telegram disindaki guvenli cuzdan alaninda acilir.",
        "TON deposit, withdrawal, and crypto trading open in the secure wallet area outside Telegram."
      ),
      cy
    );
    const openBtn = { x: innerX, y: cy + 104, w: innerW, h: 46, onClick: () => void this._openExternalWallet({ intent: "wallet" }) };
    this.buttons.push(openBtn);
    drawActionBtn(openBtn, t("Harici Cuzdani Ac", "Open External Wallet"));
    cy += 174 + cardGap;

    const colGap = 12;
    const colW = Math.floor((innerW - colGap) / 2);
    const modeH = L.mobile ? 230 : 210;
    this.drawCard(ctx, cardX, cy, fullW, modeH);
    drawCardHead(
      t("Iki Ekonomi Modu", "Two Economy Modes"),
      t("Stars ve harici cuzdan akislarini ayri tutuyoruz; Stars cekime donusmez.", "Stars and external wallet flows stay separate; Stars never become withdrawable."),
      cy
    );

    const drawMode = (x0, title, lines, accent) => {
      const boxY = cy + 86;
      const boxH = modeH - 106;
      fillRoundRect(ctx, x0, boxY, colW, boxH, 18, "rgba(255,255,255,0.045)");
      strokeRoundRect(ctx, x0, boxY, colW, boxH, 18, accent, 1);
      ctx.fillStyle = "rgba(255,255,255,0.98)";
      ctx.font = "900 14px system-ui";
      textFit(ctx, title, x0 + 14, boxY + 26, colW - 28);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "600 11px system-ui";
      lines.forEach((line, idx) => textFit(ctx, line, x0 + 14, boxY + 52 + idx * 18, colW - 28));
    };
    drawMode(
      innerX,
      "STARS",
      [
        t("Cekim yok", "No withdrawal"),
        t("Premium var", "Premium available"),
        t("Daha dusuk level eslesme", "Lower-level matching"),
      ],
      "rgba(120,210,255,0.28)"
    );
    drawMode(
      innerX + colW + colGap,
      "WALLET",
      [
        t("Cekim var", "Withdrawal available"),
        t("Premium var", "Premium available"),
        t("Islemler harici domainde", "Actions on external domain"),
      ],
      "rgba(243,187,102,0.34)"
    );
    cy += modeH + cardGap;

    this.drawCard(ctx, cardX, cy, fullW, 146);
    drawCardHead(
      t("Telegram Icindeki Guvenli Sinir", "Safe Boundary Inside Telegram"),
      t(
        "Bu ekranda sadece yonlendirme var. TON bakiyesi, cekim formu ve odeme onayi Telegram icinde islenmez.",
        "This screen only routes out. TON balance, withdrawal forms, and payment confirmation are not handled inside Telegram."
      ),
      cy
    );
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 11px system-ui";
    textFit(ctx, t(`Oyun YTON bakiyesi: ${moneyFmt(ytonBalance)} YTON`, `Game YTON balance: ${moneyFmt(ytonBalance)} YTON`), innerX, cy + 104, innerW);
    textFit(ctx, WALLET_APP_URL, innerX, cy + 124, innerW);
  }

  drawRivalsContent(ctx, state, x, y, w, h, L) {
    const bots = this._botProfiles(state);
    const selected = this._selectedRival(state, bots);
    const t = (tr, en) => this._ui(tr, en);
    const fullW = w - 16;
    const cardX = x + 8;
    const innerX = cardX + 16;
    const innerW = fullW - 32;

    this.drawSectionTitle(ctx, this._text("rivalsTitle"), this._text("rivalsSub"), cardX, y + 20, fullW);
    let cy = y + 50;

    if (!bots.length) {
      this.drawCard(ctx, cardX, cy, fullW, 94);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 16px system-ui";
      textFit(ctx, t("Rakip kayitlari hazirlaniyor", "Rival records are being prepared"), innerX, cy + 34, innerW);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = "500 12px system-ui";
      textFit(ctx, t("Motor acildiginda profiller burada gorunecek.", "Profiles will appear here when the engine starts."), innerX, cy + 58, innerW);
      return;
    }

    const counts = {
      blackMarket: bots.filter((bot) => bot.kind === "blackMarket").length,
      arena: bots.filter((bot) => bot.kind === "arena").length,
      weak: bots.filter((bot) => bot.kind !== "blackMarket" && bot.kind !== "arena").length,
    };
    const summaryGap = 8;
    const summaryW = Math.floor((fullW - summaryGap * 2) / 3);
    this.drawInfoMini(ctx, cardX, cy, summaryW, 52, "Black Market", String(counts.blackMarket));
    this.drawInfoMini(ctx, cardX + summaryW + summaryGap, cy, summaryW, 52, t("Arena", "Arena"), String(counts.arena));
    this.drawInfoMini(ctx, cardX + (summaryW + summaryGap) * 2, cy, summaryW, 52, t("Sokak", "Street"), String(counts.weak));
    cy += 68;

    const feature = selected || bots[0];
    const wins = Math.max(0, Number(feature?.wins || 0));
    const losses = Math.max(0, Number(feature?.losses || 0));
    const total = wins + losses;
    const winRate = total ? Math.round((wins / total) * 100) : 0;
    const businesses = Array.isArray(feature?.businesses) ? feature.businesses : [];
    const businessText = businesses.length
      ? businesses.slice(0, 2).map((biz) => `${biz.name || "Business"} L${Number(biz.level || 1)}`).join(" / ")
      : t("Bina kaydi yok", "No building record");
    const statusText = feature?.online !== false
      ? "ONLINE"
      : t(`Son ${Math.max(1, Number(feature?.lastSeenMinutes || 1))} dk`, `${Math.max(1, Number(feature?.lastSeenMinutes || 1))}m ago`);
    const featuredH = L.mobile ? 244 : 198;
    const strong = feature?.kind === "blackMarket" || feature?.kind === "arena";

    this.drawCard(ctx, cardX, cy, fullW, featuredH);
    fillRoundRect(ctx, cardX + 1, cy + 1, fullW - 2, featuredH - 2, 17, strong ? "rgba(130,40,20,0.10)" : "rgba(43,110,68,0.08)");

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.font = `700 ${L.mobile ? 19 : 22}px Georgia, "Times New Roman", serif`;
    textFit(ctx, String(feature?.username || feature?.name || "Rival"), innerX, cy + 30, innerW - 116);

    const chipW = L.mobile ? 86 : 104;
    fillRoundRect(ctx, cardX + fullW - chipW - 14, cy + 14, chipW, 26, 13, feature?.online !== false ? "rgba(65,215,112,0.18)" : "rgba(255,255,255,0.08)");
    strokeRoundRect(ctx, cardX + fullW - chipW - 14, cy + 14, chipW, 26, 13, feature?.online !== false ? "rgba(65,215,112,0.36)" : "rgba(255,255,255,0.14)", 1);
    ctx.fillStyle = feature?.online !== false ? "rgba(143,255,176,0.96)" : "rgba(255,255,255,0.70)";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(statusText, cardX + fullW - chipW / 2 - 14, cy + 27);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "rgba(255,213,156,0.82)";
    ctx.font = "700 12px system-ui";
    textFit(ctx, String(feature?.group || t("Kayitli Rakip", "Registered Rival")), innerX, cy + 52, innerW);

    const facts = [
      `${t("Clan", "Clan")}: ${feature?.clanName || feature?.clan || t("Yok", "None")}`,
      `${t("Silah", "Weapon")}: ${feature?.weaponName || t("Kayitli", "Registered")}`,
      feature?.premium ? "Premium" : t("Standart", "Standard"),
    ].join(" | ");
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 12px system-ui";
    textFit(ctx, facts, innerX, cy + 74, innerW);

    const noteLines = wrapText(
      ctx,
      String(feature?.profileNote || t("PvP kaydi ve gecmis maclari hazir.", "PvP record and match history are ready.")),
      innerW,
      2
    );
    noteLines.forEach((line, idx) => ctx.fillText(line, innerX, cy + 98 + idx * 15));

    ctx.fillStyle = "rgba(255,213,156,0.76)";
    ctx.font = "500 11px system-ui";
    textFit(ctx, `${t("Bina", "Building")}: ${businessText}`, innerX, cy + (L.mobile ? 132 : 128), innerW);

    const stats = [
      [t("Level", "Level"), String(Number(feature?.level || 0))],
      ["Rating", String(Number(feature?.rating || feature?.rank || 1000))],
      [t("Kayit", "Record"), `${wins}W/${losses}L`],
      ["Win", `${winRate}%`],
    ];
    const cols = L.mobile ? 2 : 4;
    const statGap = 8;
    const statW = Math.floor((innerW - statGap * (cols - 1)) / cols);
    const statY = cy + (L.mobile ? 150 : 146);
    stats.forEach(([label, value], idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      this.drawInfoMini(ctx, innerX + col * (statW + statGap), statY + row * 46, statW, 38, label, value);
    });
    cy += featuredH + 18;

    this.drawSectionTitle(
      ctx,
      t("Rakip Kayitlari", "Rival Records"),
      t("Son eslesmeler ayrilir; ayni rakip surekli gelmez.", "Recent matches are separated so the same rival is not repeated."),
      cardX,
      cy + 8,
      fullW
    );
    cy += 38;

    const selectedId = String(feature?.id || "").trim();
    const list = bots
      .slice()
      .sort((a, b) => {
        const aSelected = selectedId && String(a.id || "") === selectedId ? -1 : 0;
        const bSelected = selectedId && String(b.id || "") === selectedId ? -1 : 0;
        if (aSelected !== bSelected) return aSelected - bSelected;
        const kindDiff = this._rivalSortValue(a) - this._rivalSortValue(b);
        if (kindDiff) return kindDiff;
        return Number(b.rating || b.rank || 0) - Number(a.rating || a.rank || 0);
      })
      .slice(0, L.mobile ? 18 : 16);

    list.forEach((bot) => {
      const rowH = L.mobile ? 74 : 66;
      const rowSelected = selectedId && String(bot.id || "") === selectedId;
      const btn = { x: cardX, y: cy, w: fullW, h: rowH, onClick: () => this._selectRivalProfile(bot.id || bot.username) };
      this.buttons.push(btn);
      this.drawCard(ctx, cardX, cy, fullW, rowH);
      if (rowSelected) fillRoundRect(ctx, cardX + 1, cy + 1, fullW - 2, rowH - 2, 17, "rgba(243,187,102,0.12)");

      const rowInnerW = fullW - 32;
      const rating = Number(bot.rating || bot.rank || 1000);
      const rowWins = Math.max(0, Number(bot.wins || 0));
      const rowLosses = Math.max(0, Number(bot.losses || 0));
      const recent = (Array.isArray(bot.recentMatches) ? bot.recentMatches : [])
        .slice(0, 4)
        .map((match) => String(match?.result || "").toLowerCase() === "win" ? "W" : "L")
        .join(" ");
      const bizCount = Array.isArray(bot.businesses) ? bot.businesses.length : 0;
      const rowFacts = [
        bot.group || t("Kayitli Rakip", "Registered Rival"),
        `${t("Clan", "Clan")} ${bot.clan || "-"}`,
        bot.premium ? "Premium" : t("Standart", "Standard"),
        bizCount ? `${bizCount} ${t("bina", "building")}` : t("kayitli", "registered"),
      ].join(" | ");

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = rowSelected ? "#ffd494" : "rgba(255,255,255,0.96)";
      ctx.font = "700 15px system-ui";
      textFit(ctx, String(bot.username || bot.name || "Rival"), innerX, cy + 25, rowInnerW - 92);
      ctx.fillStyle = "rgba(255,213,156,0.76)";
      ctx.font = "500 11px system-ui";
      textFit(ctx, rowFacts, innerX, cy + 44, rowInnerW - 20);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "500 10px system-ui";
      textFit(ctx, `${t("Gecmis", "History")}: ${recent || "-"} | ${rowWins}W/${rowLosses}L`, innerX, cy + 61, rowInnerW - 20);

      ctx.textAlign = "right";
      ctx.fillStyle = "#f6c46b";
      ctx.font = "800 14px system-ui";
      ctx.fillText(String(rating), cardX + fullW - 18, cy + 25);
      ctx.fillStyle = "rgba(255,255,255,0.66)";
      ctx.font = "600 10px system-ui";
      ctx.fillText(`L${Number(bot.level || 0)}`, cardX + fullW - 18, cy + 44);
      ctx.textAlign = "left";
      cy += rowH + 8;
    });
  }

  drawRankingContent(ctx, state, x, y, w, h, L) {
    const p = state.player || {};
    const username = String(p.username || "Player").trim() || "Player";
    const selfId = String(p.telegramId || p.id || "player_main").trim() || "player_main";
    const board = Array.isArray(state?.pvp?.leaderboard) ? state.pvp.leaderboard.slice() : [];
    board.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const list = board.length ? board.slice(0, 12) : [{ name: username, wins: 0, losses: 0, rating: 1000, score: 1000 }];

    this.drawSectionTitle(ctx, this._text("rankingTitle"), this._text("rankingSub"), x + 8, y + 20, w - 16);
    let rowY = y + 40;

    list.forEach((item, index) => {
      const rowH = L.mobile ? 44 : 40;
      const itemId = String(item.id || item.telegram_id || item.telegramId || "").trim();
      const isMe = itemId ? itemId === selfId : String(item.name || "") === username;
      this.drawCard(ctx, x + 8, rowY, w - 16, rowH);
      if (isMe) fillRoundRect(ctx, x + 8, rowY, w - 16, rowH, 18, "rgba(243,187,102,0.10)");
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = isMe ? "#ffd494" : "rgba(255,255,255,0.96)";
      ctx.font = "700 14px system-ui";
      ctx.fillText(`#${index + 1}`, x + 22, rowY + 25);
      textFit(ctx, String(item.name || item.username || "Player"), x + 62, rowY + 25, w - 220);
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
