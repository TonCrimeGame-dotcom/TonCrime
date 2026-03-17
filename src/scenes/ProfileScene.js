import { supabase } from "../supabase.js";

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

function drawPanelGradient(ctx, x, y, w, h, c1, c2, r) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, r);
}

function drawInnerGlow(ctx, x, y, w, h, color, blur = 16) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, 18);
  ctx.restore();
}

function drawTopHighlight(ctx, x, y, w, h, r) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.35, "rgba(255,255,255,0.035)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, r);
}

function drawCornerPlate(ctx, x, y, size, corner) {
  ctx.save();
  ctx.translate(x, y);

  if (corner === "tr") {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  } else if (corner === "bl") {
    ctx.translate(0, size);
    ctx.scale(1, -1);
  } else if (corner === "br") {
    ctx.translate(size, size);
    ctx.scale(-1, -1);
  }

  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 12);
  ctx.lineTo(12, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(size - 16, 16);
  ctx.lineTo(16, 16);
  ctx.lineTo(16, size - 16);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#6d737f");
  g.addColorStop(0.25, "#2f3541");
  g.addColorStop(1, "#141820");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawHeaderPlate(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#363842");
  g.addColorStop(0.25, "#1b1f27");
  g.addColorStop(1, "#0f1218");
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, 8);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);

  const shine = ctx.createLinearGradient(x, y, x, y + h * 0.6);
  shine.addColorStop(0, "rgba(255,255,255,0.16)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h * 0.5, 8);
}

function drawSlicedBarEnd(ctx, x, y, w, h, rightSide = false) {
  ctx.save();
  if (rightSide) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + 18);
  ctx.lineTo(x + 18, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - 18, y + h);
  ctx.closePath();

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#2a2d34");
  g.addColorStop(1, "#0f1218");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
  ctx.restore();
}

function drawMetalTile(ctx, x, y, w, h, radius = 18) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#2a2d36");
  g.addColorStop(0.18, "#191c24");
  g.addColorStop(1, "#0b0e14");
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, radius);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);

  const inner = ctx.createLinearGradient(x, y, x, y + h * 0.42);
  inner.addColorStop(0, "rgba(255,255,255,0.10)");
  inner.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = inner;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h * 0.35, radius);

  ctx.strokeStyle = "rgba(255,170,80,0.08)";
  strokeRoundRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(8, radius - 5));
}

function drawButtonPlate(ctx, x, y, w, h, accent = "amber") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#3a3e47");
  g.addColorStop(0.18, "#1b1f27");
  g.addColorStop(1, "#0d1017");
  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, 14);

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 14);

  const inner = ctx.createLinearGradient(x, y, x, y + h * 0.46);
  inner.addColorStop(0, "rgba(255,255,255,0.15)");
  inner.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = inner;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h * 0.42, 13);

  const color =
    accent === "red"
      ? "rgba(255,88,88,0.78)"
      : accent === "blue"
      ? "rgba(90,170,255,0.72)"
      : "rgba(255,182,74,0.85)";

  const ag = ctx.createLinearGradient(x, 0, x + w, 0);
  ag.addColorStop(0, "rgba(255,255,255,0)");
  ag.addColorStop(0.5, color);
  ag.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = ag;
  fillRoundRect(ctx, x + 20, y + h - 4, w - 40, 2, 1);
}

function drawBadgeChip(ctx, x, y, w, h, fill, text, textColor = "#fff") {
  ctx.fillStyle = fill;
  fillRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = textColor;
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

function drawBusinessArtwork(ctx, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#191d28");
  bg.addColorStop(1, "#10131a");
  ctx.fillStyle = bg;
  fillRoundRect(ctx, x, y, w, h, 10);

  const glow = ctx.createRadialGradient(x + w * 0.5, y + h * 0.58, 4, x + w * 0.5, y + h * 0.58, w * 0.7);
  glow.addColorStop(0, "rgba(255,154,70,0.20)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  fillRoundRect(ctx, x, y, w, h, 10);

  const baseY = y + h * 0.74;

  ctx.fillStyle = "#1f2630";
  fillRoundRect(ctx, x + w * 0.08, y + h * 0.34, w * 0.42, h * 0.38, 6);

  ctx.fillStyle = "#242c37";
  fillRoundRect(ctx, x + w * 0.46, y + h * 0.28, w * 0.34, h * 0.44, 6);

  ctx.fillStyle = "#0f1319";
  fillRoundRect(ctx, x + w * 0.20, y + h * 0.50, w * 0.10, h * 0.22, 4);

  ctx.fillStyle = "#ffb347";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      fillRoundRect(
        ctx,
        x + w * (0.12 + c * 0.10),
        y + h * (0.40 + r * 0.12),
        w * 0.06,
        h * 0.07,
        2
      );
    }
  }

  ctx.fillStyle = "#84c8ff";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      fillRoundRect(
        ctx,
        x + w * (0.54 + c * 0.10),
        y + h * (0.38 + r * 0.14),
        w * 0.07,
        h * 0.08,
        2
      );
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  strokeRoundRect(ctx, x + w * 0.08, y + h * 0.34, w * 0.42, h * 0.38, 6);
  strokeRoundRect(ctx, x + w * 0.46, y + h * 0.28, w * 0.34, h * 0.44, 6);

  ctx.strokeStyle = "rgba(255,170,80,0.35)";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.82, y + h * 0.18);
  ctx.quadraticCurveTo(x + w * 0.96, y + h * 0.24, x + w * 0.92, y + h * 0.54);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, baseY);
  ctx.lineTo(x + w * 0.94, baseY);
  ctx.stroke();
}

function drawCrateArtwork(ctx, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#1a1c24");
  bg.addColorStop(1, "#0f1218");
  ctx.fillStyle = bg;
  fillRoundRect(ctx, x, y, w, h, 10);

  const g = ctx.createLinearGradient(x, y + h * 0.18, x, y + h * 0.82);
  g.addColorStop(0, "#b88338");
  g.addColorStop(0.5, "#7f5428");
  g.addColorStop(1, "#4a311d");

  ctx.fillStyle = g;
  fillRoundRect(ctx, x + w * 0.20, y + h * 0.32, w * 0.60, h * 0.38, 8);

  ctx.fillStyle = "#d6a65b";
  fillRoundRect(ctx, x + w * 0.20, y + h * 0.22, w * 0.60, h * 0.12, 7);

  ctx.fillStyle = "rgba(255,235,190,0.30)";
  fillRoundRect(ctx, x + w * 0.31, y + h * 0.32, w * 0.06, h * 0.38, 3);
  fillRoundRect(ctx, x + w * 0.63, y + h * 0.32, w * 0.06, h * 0.38, 3);

  ctx.fillStyle = "#efd29a";
  fillRoundRect(ctx, x + w * 0.47, y + h * 0.42, w * 0.08, h * 0.11, 3);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(x + w * 0.20, y + h * 0.32, w * 0.60, h * 0.38);

  const light = ctx.createRadialGradient(x + w * 0.5, y + h * 0.45, 4, x + w * 0.5, y + h * 0.45, w * 0.5);
  light.addColorStop(0, "rgba(255,187,95,0.24)");
  light.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = light;
  fillRoundRect(ctx, x, y, w, h, 10);
}

function drawSkullArtwork(ctx, x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#1b1c22");
  bg.addColorStop(1, "#101218");
  ctx.fillStyle = bg;
  fillRoundRect(ctx, x, y, w, h, 10);

  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x + w * 0.24, y + h * 0.76);
  ctx.lineTo(x + w * 0.76, y + h * 0.22);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.76, y + h * 0.76);
  ctx.lineTo(x + w * 0.24, y + h * 0.22);
  ctx.stroke();

  ctx.fillStyle = "rgba(245,240,232,0.96)";
  ctx.beginPath();
  ctx.arc(x + w * 0.50, y + h * 0.40, w * 0.16, 0, Math.PI * 2);
  ctx.fill();

  fillRoundRect(ctx, x + w * 0.40, y + h * 0.49, w * 0.20, h * 0.12, 5);

  ctx.fillStyle = "#16171d";
  ctx.beginPath();
  ctx.arc(x + w * 0.45, y + h * 0.39, w * 0.028, 0, Math.PI * 2);
  ctx.arc(x + w * 0.55, y + h * 0.39, w * 0.028, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + w * 0.50, y + h * 0.44);
  ctx.lineTo(x + w * 0.47, y + h * 0.49);
  ctx.lineTo(x + w * 0.53, y + h * 0.49);
  ctx.closePath();
  ctx.fill();

  const fire = ctx.createRadialGradient(x + w * 0.50, y + h * 0.52, 4, x + w * 0.50, y + h * 0.52, w * 0.44);
  fire.addColorStop(0, "rgba(255,120,80,0.10)");
  fire.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fire;
  fillRoundRect(ctx, x, y, w, h, 10);
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
    this.hitWalletConnect = null;
    this.hitConvert = null;
    this.hitWithdraw = null;
    this.hitWalletRefresh = null;

    this._avatarUrl = "";
    this._avatarImg = null;
    this.walletConnection = null;
    this.walletLedger = [];
    this.withdrawRequests = [];
    this.walletLoading = false;
  }

  onEnter() {
    this._syncWalletPanel();
  }


  _getTelegramId() {
    const s = this.store.get() || {};
    return String(
      s?.player?.telegramId ||
      window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
      ""
    ).trim();
  }

  async _getProfileId() {
    const telegramId = this._getTelegramId();
    if (!telegramId) throw new Error("telegram_id bulunamadı");

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error("Profil bulunamadı");
    return data.id;
  }

  async _syncWalletPanel() {
    this.walletLoading = true;
    try {
      const profileId = await this._getProfileId();

      const [{ data: walletRows, error: walletErr }, { data: ledgerRows, error: ledgerErr }, { data: withdrawRows, error: withdrawErr }] = await Promise.all([
        supabase
          .from("wallet_connections")
          .select("*")
          .eq("profile_id", profileId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("wallet_ledger")
          .select("*")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("withdraw_requests")
          .select("*")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (walletErr) throw walletErr;
      if (ledgerErr) throw ledgerErr;
      if (withdrawErr) throw withdrawErr;

      this.walletConnection = Array.isArray(walletRows) && walletRows.length ? walletRows[0] : null;
      this.walletLedger = Array.isArray(ledgerRows) ? ledgerRows : [];
      this.withdrawRequests = Array.isArray(withdrawRows) ? withdrawRows : [];
    } catch (err) {
      console.warn("[ProfileScene] wallet sync:", err?.message || err);
      this.walletConnection = null;
      this.walletLedger = [];
      this.withdrawRequests = [];
    } finally {
      this.walletLoading = false;
    }
  }

  async _connectWalletFlow() {
    try {
      const profileId = await this._getProfileId();
      const s = this.store.get() || {};
      const telegramId = this._getTelegramId();
      const username = String(s.player?.username || "Player");

      const provider = window.prompt("Cüzdan markası seç:
Tonkeeper / MyTonWallet / OpenMask", "Tonkeeper");
      if (provider === null) return;

      const walletAddress = window.prompt("Cüzdan adresini gir:", this.walletConnection?.wallet_address || "");
      if (walletAddress === null) return;
      const addr = String(walletAddress || "").trim();
      if (!addr) {
        this._showToast?.("Cüzdan adresi boş olamaz");
        return;
      }

      await supabase
        .from("wallet_connections")
        .update({ is_active: false })
        .eq("profile_id", profileId)
        .eq("is_active", true);

      const { error } = await supabase
        .from("wallet_connections")
        .insert([{
          profile_id: profileId,
          telegram_id: telegramId || null,
          username,
          wallet_provider: String(provider || "Tonkeeper"),
          wallet_address: addr,
          is_active: true,
        }]);
      if (error) throw error;

      this.walletConnection = {
        wallet_provider: String(provider || "Tonkeeper"),
        wallet_address: addr,
        is_active: true,
      };

      this._showToast?.("Cüzdan bağlandı");
      await this._syncWalletPanel();
    } catch (err) {
      console.error("[ProfileScene] wallet connect:", err);
      this._showToast?.(err?.message || "Cüzdan bağlanamadı");
    }
  }

  async _convertYtonFlow() {
    try {
      const s = this.store.get() || {};
      const p = s.player || {};
      const coins = Number(s.coins || 0);
      const rate = 0.05;

      const raw = window.prompt(`Dönüştürülecek YTON miktarı (Bakiye: ${coins})`, "100");
      if (raw === null) return;

      const ytonAmount = Math.max(0, Number(raw || 0));
      if (!ytonAmount) {
        this._showToast?.("Geçersiz miktar");
        return;
      }
      if (ytonAmount > coins) {
        this._showToast?.("Yetersiz YTON");
        return;
      }

      const tonAmount = Number((ytonAmount * rate).toFixed(6));
      const profileId = await this._getProfileId();

      const { error } = await supabase
        .from("wallet_ledger")
        .insert([{
          profile_id: profileId,
          telegram_id: this._getTelegramId() || null,
          username: String(p.username || "Player"),
          entry_type: "convert",
          yton_amount: -ytonAmount,
          ton_amount: tonAmount,
          note: `YTON → TON dönüşümü (${rate})`,
        }]);
      if (error) throw error;

      this.store.set({ coins: coins - ytonAmount });
      this._showToast?.(`Dönüştürüldü: ${ytonAmount} YTON → ${tonAmount} TON`);
      await this._syncWalletPanel();
    } catch (err) {
      console.error("[ProfileScene] convert:", err);
      this._showToast?.(err?.message || "Dönüşüm başarısız");
    }
  }

  async _createWithdrawFlow() {
    try {
      const s = this.store.get() || {};
      const p = s.player || {};
      const coins = Number(s.coins || 0);
      const wallet = this.walletConnection;

      if (!wallet?.wallet_address) {
        this._showToast?.("Önce cüzdan bağla");
        return;
      }

      const raw = window.prompt(`Çekilecek YTON miktarı (Bakiye: ${coins})`, "100");
      if (raw === null) return;

      const ytonAmount = Math.max(0, Number(raw || 0));
      if (!ytonAmount) {
        this._showToast?.("Geçersiz miktar");
        return;
      }
      if (ytonAmount > coins) {
        this._showToast?.("Yetersiz YTON");
        return;
      }

      const rate = 0.05;
      const tonAmount = Number((ytonAmount * rate).toFixed(6));
      const profileId = await this._getProfileId();

      const { error } = await supabase
        .from("withdraw_requests")
        .insert([{
          profile_id: profileId,
          telegram_id: this._getTelegramId() || null,
          username: String(p.username || "Player"),
          wallet_address: wallet.wallet_address,
          yton_amount: ytonAmount,
          ton_amount: tonAmount,
          rate,
          status: "pending",
          note: "ProfileScene çekim talebi",
        }]);
      if (error) throw error;

      this._showToast?.(`Çekim talebi oluşturuldu: ${tonAmount} TON`);
      await this._syncWalletPanel();
    } catch (err) {
      console.error("[ProfileScene] withdraw:", err);
      this._showToast?.(err?.message || "Çekim talebi oluşturulamadı");
    }
  }


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
      console.log("[ProfileScene] edit avatar yakında");
      return;
    }

    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      console.log("[ProfileScene] leaderboard yakında");
      return;
    }

    if (this.hitWalletConnect && pointInRect(px, py, this.hitWalletConnect)) {
      this._connectWalletFlow();
      return;
    }

    if (this.hitConvert && pointInRect(px, py, this.hitConvert)) {
      this._convertYtonFlow();
      return;
    }

    if (this.hitWithdraw && pointInRect(px, py, this.hitWithdraw)) {
      this._createWithdrawFlow();
      return;
    }

    if (this.hitWalletRefresh && pointInRect(px, py, this.hitWalletRefresh)) {
      this._syncWalletPanel();
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
      Math.max(w, h) * 0.76
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,0.16)");
    vignette.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(830, safe.w - 28);
    const panelH = Math.min(720, safe.h - 32);
    const panelX = safe.x + (safe.w - panelW) / 2;
    const panelY = safe.y + 14;

    drawPanelGradient(ctx, panelX, panelY, panelW, panelH, "rgba(38,40,49,0.96)", "rgba(11,13,18,0.98)", 12);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 12);

    drawInnerGlow(ctx, panelX, panelY, panelW, panelH, "rgba(255,170,80,0.06)", 18);

    const innerX = panelX + 10;
    const innerY = panelY + 10;
    const innerW = panelW - 20;
    const innerH = panelH - 20;

    drawPanelGradient(ctx, innerX, innerY, innerW, innerH, "rgba(22,24,31,0.98)", "rgba(8,10,15,0.99)", 10);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, innerX + 0.5, innerY + 0.5, innerW - 1, innerH - 1, 10);

    drawCornerPlate(ctx, panelX + 6, panelY + 6, 28, "tl");
    drawCornerPlate(ctx, panelX + panelW - 34, panelY + 6, 28, "tr");
    drawCornerPlate(ctx, panelX + 6, panelY + panelH - 34, 28, "bl");
    drawCornerPlate(ctx, panelX + panelW - 34, panelY + panelH - 34, 28, "br");

    const headX = innerX + 10;
    const headY = innerY + 8;
    const headW = innerW - 20;
    const headH = 58;

    drawHeaderPlate(ctx, headX, headY, headW, headH);

    drawSlicedBarEnd(ctx, headX + 4, headY + 4, 64, headH - 8, false);
    drawSlicedBarEnd(ctx, headX + headW - 68, headY + 4, 64, headH - 8, true);

    const title1 = "PLAYER";
    const title2 = "PROFILE";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 28px system-ui";
    const totalTitle = `${title1} ${title2}`;
    const totalW = ctx.measureText(totalTitle).width;
    const tX = headX + headW / 2;
    const tY = headY + headH / 2 + 1;

    ctx.fillStyle = "#f2f4f8";
    ctx.fillText(title1, tX - 52, tY);
    ctx.fillStyle = "#f1a54c";
    ctx.fillText(title2, tX + 72, tY);

    const accentLine = ctx.createLinearGradient(headX, 0, headX + headW, 0);
    accentLine.addColorStop(0, "rgba(255,255,255,0)");
    accentLine.addColorStop(0.5, "rgba(255,170,80,0.85)");
    accentLine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = accentLine;
    fillRoundRect(ctx, headX + headW * 0.36, headY + headH - 4, headW * 0.28, 2, 1);

    this.hitClose = { x: headX + headW - 52, y: headY + 9, w: 36, h: 36 };
    drawHeaderPlate(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h);
    ctx.fillStyle = "#f1f3f7";
    ctx.font = "900 22px system-ui";
    ctx.fillText("×", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + this.hitClose.h / 2 + 1);

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

    const inventoryItems = inventoryList.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)), 0);

    const totalInventoryValue = inventoryList.reduce((sum, item) => {
      const price = Number(item.marketPrice || item.sellPrice || item.price || 0);
      const qty = Number(item.qty || 0);
      return sum + Math.max(0, price * qty);
    }, 0);

    const clanName = String(state?.clan?.name || state?.clan?.tag || "No Clan");
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

    const heroX = innerX + 12;
    const heroY = headY + headH + 12;
    const heroW = innerW - 24;
    const heroH = 164;

    drawMetalTile(ctx, heroX, heroY, heroW, heroH, 16);

    const heroInsetX = heroX + 10;
    const heroInsetY = heroY + 10;
    const heroInsetW = heroW - 20;
    const heroInsetH = heroH - 20;

    const heroInsetGrad = ctx.createLinearGradient(heroInsetX, heroInsetY, heroInsetX, heroInsetY + heroInsetH);
    heroInsetGrad.addColorStop(0, "rgba(54,49,52,0.38)");
    heroInsetGrad.addColorStop(0.28, "rgba(32,34,43,0.16)");
    heroInsetGrad.addColorStop(1, "rgba(11,12,18,0.06)");
    ctx.fillStyle = heroInsetGrad;
    fillRoundRect(ctx, heroInsetX, heroInsetY, heroInsetW, heroInsetH, 14);

    const avatarFrameX = heroX + 16;
    const avatarFrameY = heroY + 16;
    const avatarFrameW = 148;
    const avatarFrameH = 132;

    drawMetalTile(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 16);

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
    roundRectPath(ctx, avatarX, avatarY, avatarW, avatarH, 12);
    ctx.clip();

    if (this._avatarImg && this._avatarImg.complete && this._avatarImg.naturalWidth > 0) {
      ctx.drawImage(this._avatarImg, avatarX, avatarY, avatarW, avatarH);
    } else {
      const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX, avatarY + avatarH);
      avGrad.addColorStop(0, "#4b4f5a");
      avGrad.addColorStop(1, "#262a32");
      ctx.fillStyle = avGrad;
      ctx.fillRect(avatarX, avatarY, avatarW, avatarH);

      ctx.fillStyle = "#f1f3f7";
      ctx.font = "900 38px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 2);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, avatarX + 0.5, avatarY + 0.5, avatarW - 1, avatarH - 1, 12);

    if (isPremium) {
      drawBadgeChip(ctx, avatarFrameX - 6, avatarFrameY - 8, 46, 26, "linear-gradient", "VIP");
      const vipX = avatarFrameX - 2;
      const vipY = avatarFrameY - 8;
      const vipW = 42;
      const vipH = 24;
      const g = ctx.createLinearGradient(vipX, vipY, vipX, vipY + vipH);
      g.addColorStop(0, "#ffe7a1");
      g.addColorStop(1, "#ffc54e");
      ctx.fillStyle = g;
      fillRoundRect(ctx, vipX, vipY, vipW, vipH, 8);
      ctx.fillStyle = "#32210a";
      ctx.font = "900 13px system-ui";
      ctx.fillText("VIP", vipX + vipW / 2, vipY + vipH / 2 + 1);
    }

    const onlineW = 84;
    const onlineH = 22;
    const onlineX = avatarFrameX + 10;
    const onlineY = avatarFrameY + avatarFrameH - 30;
    drawBadgeChip(ctx, onlineX, onlineY, onlineW, onlineH, "#27d85c", "ONLINE");

    const infoX = avatarFrameX + avatarFrameW + 20;
    const infoY = heroY + 24;
    const infoW = heroW - (infoX - heroX) - 18;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const nameSize = textFit(ctx, username, infoW * 0.52, 30, 900);
    ctx.font = `900 ${nameSize}px system-ui`;
    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(username, infoX, infoY + 4);

    ctx.font = "700 14px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.46)";
    ctx.fillText(`#${playerId}`, infoX, infoY + 34);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(infoX, infoY + 54);
    ctx.lineTo(infoX + infoW, infoY + 54);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(infoX + infoW * 0.54, infoY + 60);
    ctx.lineTo(infoX + infoW * 0.54, infoY + 112);
    ctx.stroke();

    ctx.fillStyle = "#f1b24e";
    ctx.font = "700 16px system-ui";
    ctx.fillText("◉", infoX, infoY + 78);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "700 17px system-ui";
    ctx.fillText("Level", infoX + 28, infoY + 78);
    ctx.font = "900 20px system-ui";
    ctx.fillText(String(level), infoX + 98, infoY + 78);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "700 19px system-ui";
    ctx.fillText("⚡", infoX + infoW * 0.58, infoY + 78);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "700 17px system-ui";
    ctx.fillText("Energy", infoX + infoW * 0.58 + 38, infoY + 78);
    ctx.font = "900 20px system-ui";
    ctx.fillStyle = "#a7e47e";
    ctx.fillText(`${energy}/${energyMax}`, infoX + infoW * 0.58 + 112, infoY + 78);

    ctx.beginPath();
    ctx.moveTo(infoX, infoY + 100);
    ctx.lineTo(infoX + infoW, infoY + 100);
    ctx.stroke();

    ctx.fillStyle = "#f1b24e";
    ctx.font = "700 16px system-ui";
    ctx.fillText("◉", infoX, infoY + 122);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "700 17px system-ui";
    ctx.fillText("Clan", infoX + 28, infoY + 122);
    ctx.font = "900 19px system-ui";
    ctx.fillText(clanName, infoX + 84, infoY + 122);

    ctx.fillStyle = "#f1b24e";
    ctx.font = "700 18px system-ui";
    ctx.fillText("▣", infoX + infoW * 0.58, infoY + 122);
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "700 17px system-ui";
    ctx.fillText("Total Value", infoX + infoW * 0.58 + 34, infoY + 122);
    ctx.font = "900 19px system-ui";
    ctx.fillText(`${moneyFmt(totalInventoryValue)}`, infoX + infoW * 0.58 + 142, infoY + 122);

    const cardsY = heroY + heroH + 16;
    const cardsGap = 14;
    const cardW = (heroW - cardsGap * 2) / 3;
    const cardH = 192;

    const card1X = heroX;
    const card2X = heroX + cardW + cardsGap;
    const card3X = heroX + (cardW + cardsGap) * 2;

    const drawStatCard = (x, y, title, drawArt, bigLine, smallLineTop = "", smallLineBottom = "") => {
      drawMetalTile(ctx, x, y, cardW, cardH, 16);

      ctx.fillStyle = "#f0f2f6";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 18px system-ui";
      ctx.fillText(title, x + cardW / 2, y + 22);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 38);
      ctx.lineTo(x + cardW - 12, y + 38);
      ctx.stroke();

      const artX = x + 16;
      const artY = y + 46;
      const artW = cardW - 32;
      const artH = 84;

      drawArt(ctx, artX, artY, artW, artH);

      if (smallLineTop) {
        ctx.fillStyle = "#f3f6fb";
        ctx.font = "900 18px system-ui";
        ctx.fillText(smallLineTop, x + cardW / 2, y + 148);
      }

      if (bigLine) {
        ctx.fillStyle = "#f3f6fb";
        ctx.font = "900 22px system-ui";
        ctx.fillText(bigLine, x + cardW / 2, y + 150);
      }

      if (smallLineBottom) {
        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = "700 15px system-ui";
        ctx.fillText(smallLineBottom, x + cardW / 2, y + 174);
      }
    };

    drawStatCard(
      card1X,
      cardsY,
      "BUSINESSES",
      drawBusinessArtwork,
      "",
      `${businessesOwned} Owned`,
      ""
    );

    drawStatCard(
      card2X,
      cardsY,
      "INVENTORY",
      drawCrateArtwork,
      "",
      `${inventoryItems} Items`,
      ""
    );

    drawMetalTile(ctx, card3X, cardsY, cardW, cardH, 16);
    ctx.fillStyle = "#f0f2f6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 18px system-ui";
    ctx.fillText("PVP STATS", card3X + cardW / 2, cardsY + 22);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(card3X + 12, cardsY + 38);
    ctx.lineTo(card3X + cardW - 12, cardsY + 38);
    ctx.stroke();

    drawSkullArtwork(ctx, card3X + 16, cardsY + 46, cardW - 32, 84);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "900 18px system-ui";
    ctx.fillText("WINS", card3X + cardW * 0.34, cardsY + 148);
    ctx.fillText("LOSSES", card3X + cardW * 0.69, cardsY + 148);

    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 20px system-ui";
    ctx.fillText(String(wins), card3X + cardW * 0.34, cardsY + 173);
    ctx.fillText(String(losses), card3X + cardW * 0.69, cardsY + 173);

    const stripY = cardsY + cardH + 16;
    const stripH = 102;

    drawMetalTile(ctx, heroX, stripY, heroW, stripH, 16);

    const col1 = heroX + heroW / 6;
    const col2 = heroX + heroW / 2;
    const col3 = heroX + (heroW * 5) / 6;

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(heroX + heroW / 3, stripY + 16);
    ctx.lineTo(heroX + heroW / 3, stripY + stripH - 16);
    ctx.moveTo(heroX + heroW * 2 / 3, stripY + 16);
    ctx.lineTo(heroX + heroW * 2 / 3, stripY + stripH - 16);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(255,255,255,0.68)";
    ctx.font = "700 13px system-ui";
    ctx.fillText("Win Rate", col1, stripY + 26);
    ctx.fillText("Kill / Death", col2, stripY + 26);
    ctx.fillText("Top Rank", col3, stripY + 26);

    ctx.fillStyle = "#ffbe57";
    ctx.font = "900 28px system-ui";
    ctx.fillText(`${winRate}%`, col1, stripY + 62);

    ctx.fillStyle = "#f3f6fb";
    ctx.fillText(kdText, col2, stripY + 62);

    ctx.fillStyle = "#f7ba58";
    ctx.fillText(`#${topRank}`, col3, stripY + 62);

    ctx.fillStyle = "#f4b454";
    ctx.font = "900 28px system-ui";
    ctx.fillText("♛", col3, stripY + 86);

    const btnY = stripY + stripH + 18;
    const btnGap = 18;
    const btnW = (heroW - btnGap) / 2;
    const btnH = 58;

    this.hitEditAvatar = { x: heroX, y: btnY, w: btnW, h: btnH };
    this.hitLeaderboard = { x: heroX + btnW + btnGap, y: btnY, w: btnW, h: btnH };

    drawButtonPlate(ctx, this.hitEditAvatar.x, this.hitEditAvatar.y, this.hitEditAvatar.w, this.hitEditAvatar.h, "blue");
    drawButtonPlate(ctx, this.hitLeaderboard.x, this.hitLeaderboard.y, this.hitLeaderboard.w, this.hitLeaderboard.h, "amber");

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 18px system-ui";
    ctx.fillText("📷  EDIT AVATAR", this.hitEditAvatar.x + this.hitEditAvatar.w / 2, this.hitEditAvatar.y + this.hitEditAvatar.h / 2 + 1);
    ctx.fillText("🏆  LEADERBOARD", this.hitLeaderboard.x + this.hitLeaderboard.w / 2, this.hitLeaderboard.y + this.hitLeaderboard.h / 2 + 1);


    const walletPanelY = btnY + btnH + 16;
    const walletPanelH = 156;
    drawMetalTile(ctx, heroX, walletPanelY, heroW, walletPanelH, 16);

    const walletTitleX = heroX + 16;
    const walletTitleY = walletPanelY + 22;
    const wallet = this.walletConnection;
    const latestWithdraw = Array.isArray(this.withdrawRequests) && this.withdrawRequests.length ? this.withdrawRequests[0] : null;
    const ledger1 = Array.isArray(this.walletLedger) && this.walletLedger.length ? this.walletLedger[0] : null;
    const ledger2 = Array.isArray(this.walletLedger) && this.walletLedger.length > 1 ? this.walletLedger[1] : null;
    const walletLabel = wallet?.wallet_provider ? `${wallet.wallet_provider}` : "Bağlı cüzdan yok";
    const walletAddress = wallet?.wallet_address ? String(wallet.wallet_address) : "Cüzdan bağlanmadı";

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 15px system-ui";
    ctx.fillText("WALLET & WITHDRAW", walletTitleX, walletTitleY);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText(walletLabel, walletTitleX, walletTitleY + 22);
    ctx.fillText(walletAddress.slice(0, 34), walletTitleX, walletTitleY + 40);

    ctx.fillStyle = "rgba(255,210,120,0.92)";
    ctx.font = "700 12px system-ui";
    ctx.fillText(`1 YTON = 0.05 TON • Son çekim: ${latestWithdraw ? latestWithdraw.status : "-"}`, walletTitleX, walletTitleY + 62);

    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "11px system-ui";
    ctx.fillText(`Son kayıt: ${ledger1 ? `${ledger1.entry_type} ${ledger1.yton_amount || 0} YTON` : "-"}`, walletTitleX, walletTitleY + 86);
    ctx.fillText(`Önceki kayıt: ${ledger2 ? `${ledger2.entry_type} ${ledger2.yton_amount || 0} YTON` : "-"}`, walletTitleX, walletTitleY + 102);

    const actionY1 = walletPanelY + 24;
    const actionY2 = walletPanelY + 72;
    const bw = (heroW - 32 - 12) / 2;
    const leftX = heroX + heroW - bw * 2 - 12;
    const rightX = heroX + heroW - bw;

    this.hitWalletConnect = { x: leftX, y: actionY1, w: bw - 12, h: 34 };
    this.hitWalletRefresh = { x: rightX, y: actionY1, w: bw - 12, h: 34 };
    this.hitConvert = { x: leftX, y: actionY2, w: bw - 12, h: 34 };
    this.hitWithdraw = { x: rightX, y: actionY2, w: bw - 12, h: 34 };

    drawButtonPlate(ctx, this.hitWalletConnect.x, this.hitWalletConnect.y, this.hitWalletConnect.w, this.hitWalletConnect.h, "blue");
    drawButtonPlate(ctx, this.hitWalletRefresh.x, this.hitWalletRefresh.y, this.hitWalletRefresh.w, this.hitWalletRefresh.h, "amber");
    drawButtonPlate(ctx, this.hitConvert.x, this.hitConvert.y, this.hitConvert.w, this.hitConvert.h, "blue");
    drawButtonPlate(ctx, this.hitWithdraw.x, this.hitWithdraw.y, this.hitWithdraw.w, this.hitWithdraw.h, "amber");

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 13px system-ui";
    ctx.fillText(wallet ? "CÜZDAN" : "BAĞLA", this.hitWalletConnect.x + this.hitWalletConnect.w / 2, this.hitWalletConnect.y + this.hitWalletConnect.h / 2 + 1);
    ctx.fillText("YENİLE", this.hitWalletRefresh.x + this.hitWalletRefresh.w / 2, this.hitWalletRefresh.y + this.hitWalletRefresh.h / 2 + 1);
    ctx.fillText("DÖNÜŞTÜR", this.hitConvert.x + this.hitConvert.w / 2, this.hitConvert.y + this.hitConvert.h / 2 + 1);
    ctx.fillText("ÇEKİM", this.hitWithdraw.x + this.hitWithdraw.w / 2, this.hitWithdraw.y + this.hitWithdraw.h / 2 + 1);


    this.hitBack = { x: heroX, y: innerY + innerH - 46, w: 92, h: 34 };
    drawButtonPlate(ctx, this.hitBack.x, this.hitBack.y, this.hitBack.w, this.hitBack.h, "red");
    ctx.fillStyle = "#f3f6fb";
    ctx.font = "900 14px system-ui";
    ctx.fillText("← Geri", this.hitBack.x + this.hitBack.w / 2, this.hitBack.y + this.hitBack.h / 2 + 1);
  }
}
