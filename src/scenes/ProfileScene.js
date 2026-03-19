
import { supabase } from "../supabase.js";

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

function moneyFmt(n, digits = 0) {
  const v = Number(n || 0);
  return Number.isFinite(v)
    ? v.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "0";
}

function makeImage(url) {
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
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

function drawButtonPlate(ctx, x, y, w, h, accent = "muted") {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (accent === "gold") {
    g.addColorStop(0, "rgba(130,94,28,0.68)");
    g.addColorStop(1, "rgba(88,60,15,0.78)");
  } else if (accent === "blue") {
    g.addColorStop(0, "rgba(74,116,196,0.56)");
    g.addColorStop(1, "rgba(23,44,88,0.72)");
  } else if (accent === "green") {
    g.addColorStop(0, "rgba(44,150,116,0.58)");
    g.addColorStop(1, "rgba(19,72,58,0.74)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0.04)");
  }

  ctx.fillStyle = g;
  fillRoundRect(ctx, x, y, w, h, 16);
  ctx.strokeStyle =
    accent === "gold" ? "rgba(255,211,128,0.28)" :
    accent === "blue" ? "rgba(137,178,255,0.30)" :
    accent === "green" ? "rgba(132,245,208,0.22)" :
    "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
}

function fitText(ctx, text, maxWidth, startSize = 24, minSize = 11, weight = 900) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px system-ui`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return minSize;
}

export class ProfileScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.hitClose = null;
    this.hitTabs = [];
    this.hitWalletButtons = [];
    this.hitEditAvatar = null;
    this.hitLeaderboard = null;
    this.hitInboxRows = [];
    this._inboxLoaded = false;
    this._inboxLoading = false;
    this._inboxError = "";
    this._lastInboxSyncAt = 0;

    this._avatarUrl = "";
    this._avatarImg = null;
    this.toastText = "";
    this.toastUntil = 0;
    this._busy = false;

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.dragMoved = 0;
    this.contentRect = null;
    this._inboxReqSeq = 0;
  }

  onEnter() {
    const s = this.store.get() || {};
    const ui = s.ui || {};
    const wallet = s.wallet || {};

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragMoved = 0;
    this.contentRect = null;

    this.store.set({
      ui: {
        ...ui,
        profileTab: ui.profileTab || "profile",
      },
      wallet: {
        connected: !!wallet.connected,
        brand: wallet.brand || "",
        address: wallet.address || "",
        tonBalance: Number(wallet.tonBalance || 0),
        totalConvertedTon: Number(wallet.totalConvertedTon || 0),
        totalWithdrawnTon: Number(wallet.totalWithdrawnTon || 0),
        ledger: Array.isArray(wallet.ledger) ? wallet.ledger : [],
        inbox: Array.isArray(wallet.inbox) ? wallet.inbox : [],
        lastWithdrawStatus: wallet.lastWithdrawStatus || "",
      },
    });
    this._loadInbox(true);
  }

  _showToast(text, ms = 1600) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _profileTab() {
    return String(this.store.get()?.ui?.profileTab || "profile");
  }

  _setProfileTab(tab) {
    const s = this.store.get() || {};
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.dragMoved = 0;
    this.store.set({
      ui: {
        ...(s.ui || {}),
        profileTab: tab,
      },
    });
    if (tab === "inbox") this._loadInbox(true);
  }

  _wallet() {
    return this.store.get()?.wallet || {};
  }

  _inbox() {
    const wallet = this._wallet();
    return Array.isArray(wallet.inbox) ? wallet.inbox : [];
  }

  _setInbox(items = []) {
    const wallet = this._wallet();
    this.store.set({
      wallet: {
        ...wallet,
        inbox: Array.isArray(items) ? items.slice(0, 20) : [],
      },
    });
  }

  async _loadInbox(force = false) {
    const now = Date.now();
    if (this._inboxLoading) return;
    if (!force && this._inboxLoaded && now - this._lastInboxSyncAt < 15000) return;

    const reqSeq = ++this._inboxReqSeq;
    this._inboxLoading = true;
    this._inboxError = "";
    try {
      const profileId = await this._getProfileId();
      const { data, error } = await supabase
        .from("withdraw_requests")
        .select("id,status,ton_amount,yton_amount,wallet_address,admin_note,note,created_at,updated_at,rejected_at,paid_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const inbox = (data || []).map((row) => {
        const status = String(row.status || "pending");
        const ton = Number(row.ton_amount || 0);
        const yton = Number(row.yton_amount || 0);
        const addr = String(row.wallet_address || "");
        const shortAddr = addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : "-";
        let title = "Çekim bekliyor";
        let body = `${moneyFmt(ton, 2)} TON çekim talebin incelemede.`;
        let accent = "blue";
        if (status === "rejected") {
          title = "Çekim reddedildi";
          body = `${moneyFmt(ton, 2)} TON (${moneyFmt(yton)} YTON) çekim talebin reddedildi. ${row.admin_note ? `Sebep: ${row.admin_note}` : ""}`.trim();
          accent = "red";
        } else if (status === "paid") {
          title = "Çekim ödendi";
          body = `${moneyFmt(ton, 2)} TON çekimin ${shortAddr} adresine gönderildi.`;
          accent = "green";
        } else if (status === "processing") {
          title = "Çekim işleniyor";
          body = `${moneyFmt(ton, 2)} TON çekim talebin ödeme sırasına alındı.`;
          accent = "gold";
        }
        return {
          id: row.id,
          type: "withdraw_status",
          status,
          accent,
          title,
          body,
          shortAddr,
          note: String(row.admin_note || row.note || ""),
          at: row.rejected_at || row.paid_at || row.updated_at || row.created_at || new Date().toISOString(),
        };
      });

      if (reqSeq !== this._inboxReqSeq) return;

      const prev = this._inbox();
      const prevMap = new Map(prev.map((item) => [item.id, item.status]));
      const latestRejected = inbox.find((item) => item.status === "rejected" && prevMap.get(item.id) && prevMap.get(item.id) !== "rejected");
      if (latestRejected) {
        this._showToast("Çekim reddedildi • Gelen kutusunu kontrol et", 2600);
      }

      this._setInbox(inbox);

      const latestStatus = inbox[0]?.status || "";
      const wallet = this._wallet();
      this.store.set({
        wallet: {
          ...wallet,
          lastWithdrawStatus: latestStatus || wallet.lastWithdrawStatus || "",
        },
      });

      this._inboxLoaded = true;
      this._lastInboxSyncAt = Date.now();
    } catch (err) {
      if (reqSeq !== this._inboxReqSeq) return;
      console.error("[ProfileScene] inbox load error:", err);
      const msg = String(err?.message || "");
      this._inboxError = msg.includes("Lock broken by another request")
        ? "Mesajlar kısa süreli yoğunluk nedeniyle tekrar deneniyor..."
        : (msg || "Mesajlar yüklenemedi");
    } finally {
      if (reqSeq === this._inboxReqSeq) {
        this._inboxLoading = false;
      }
    }
  }

  _pushWalletLedger(type, amountTon = 0, amountYton = 0, note = "") {
    const s = this.store.get() || {};
    const wallet = this._wallet();
    const ledger = Array.isArray(wallet.ledger) ? wallet.ledger.slice() : [];
    ledger.unshift({
      id: `${type}_${Date.now()}`,
      type,
      amountTon: Number(amountTon || 0),
      amountYton: Number(amountYton || 0),
      note: String(note || ""),
      at: Date.now(),
    });
    this.store.set({
      wallet: {
        ...wallet,
        ledger: ledger.slice(0, 30),
      },
    });
  }

  _telegramId() {
    const s = this.store.get() || {};
    return String(
      s?.player?.telegramId ||
      window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
      ""
    ).trim();
  }

  async _getProfileId() {
    const telegramId = this._telegramId();
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

  async _insertWalletLedger(entryType, tonAmount = 0, ytonAmount = 0, note = "", refId = null) {
    try {
      const profileId = await this._getProfileId();
      const { error } = await supabase.from("wallet_ledger").insert({
        profile_id: profileId,
        entry_type: entryType,
        yton_amount: Number(ytonAmount || 0),
        ton_amount: Number(tonAmount || 0),
        note: String(note || ""),
        ref_id: refId || null,
      });
      if (error) throw error;
    } catch (err) {
      console.error("[ProfileScene] wallet_ledger insert failed:", err);
    }
  }

  async _validateTonWalletAddress(address) {
    const raw = String(address || "").trim();
    if (!raw) throw new Error("TON adresi gerekli");

    const endpoints = [
      String(window.TONCRIME_API_BASE || "").trim(),
      `${window.location.origin}`
    ].filter(Boolean);

    let lastError = null;
    for (const base of endpoints) {
      try {
        const res = await fetch(`${base.replace(/\/$/, "")}/wallet/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: raw }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.valid) {
          throw new Error(json?.error || "Geçersiz TON cüzdan adresi");
        }
        return String(json.wallet_address || raw).trim();
      } catch (err) {
        lastError = err;
      }
    }
    throw new Error(lastError?.message || "TON adresi doğrulanamadı");
  }

  async _connectWallet(brand) {
    if (this._busy) return;
    this._busy = true;
    try {
      const brands = ["Tonkeeper", "MyTonWallet", "OpenMask", "Tonhub"];
      const chosen = brand || window.prompt(`Cüzdan markası seç:\n${brands.join(" / ")}`, "Tonkeeper");
      if (!chosen) return;
      const cleanBrand = String(chosen).trim();
      const address = window.prompt(`${cleanBrand} adresini gir:`, this._wallet().address || "UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
      if (!address) return;
      const normalizedAddress = await this._validateTonWalletAddress(address);

      const s = this.store.get() || {};
      const player = s.player || {};
      const wallet = this._wallet();
      const profileId = await this._getProfileId();

      const payload = {
        profile_id: profileId,
        telegram_id: this._telegramId(),
        username: String(player.username || "Player"),
        wallet_provider: cleanBrand,
        wallet_address: normalizedAddress,
        is_active: true,
      };

      const { error } = await supabase
        .from("wallet_connections")
        .upsert(payload, { onConflict: "profile_id,wallet_address" });

      if (error) throw error;

      this.store.set({
        wallet: {
          ...wallet,
          connected: true,
          brand: cleanBrand,
          address: normalizedAddress,
        },
      });

      this._pushWalletLedger("connect", 0, 0, `${cleanBrand} bağlandı`);
      await this._insertWalletLedger("wallet_connect", 0, 0, `${cleanBrand} bağlandı`);
      this._showToast(`${cleanBrand} bağlandı`);
    } catch (err) {
      console.error("[ProfileScene] connect wallet error:", err);
      this._showToast(err?.message || "Cüzdan bağlanamadı");
    } finally {
      this._busy = false;
    }
  }

  async _convertYtonToTon() {
    if (this._busy) return;
    this._busy = true;
    try {
      const s = this.store.get() || {};
      const currentYton = Number(s.coins || 0);
      const raw = window.prompt("Kaç YTON dönüştürmek istiyorsun?\n1 YTON = 0.05 TON", "100");
      if (raw === null) return;

      const amountYton = Math.max(0, Number(raw));
      if (!amountYton || !Number.isFinite(amountYton)) {
        this._showToast("Geçersiz miktar");
        return;
      }
      if (amountYton > currentYton) {
        this._showToast("Yetersiz YTON");
        return;
      }

      const tonAmount = amountYton * 0.05;
      const wallet = this._wallet();

      this.store.set({
        coins: currentYton - amountYton,
        wallet: {
          ...wallet,
          tonBalance: Number(wallet.tonBalance || 0) + tonAmount,
          totalConvertedTon: Number(wallet.totalConvertedTon || 0) + tonAmount,
        },
      });

      this._pushWalletLedger("convert", tonAmount, amountYton, `${moneyFmt(amountYton)} YTON -> ${moneyFmt(tonAmount, 2)} TON`);
      await this._insertWalletLedger("convert", tonAmount, amountYton, `${moneyFmt(amountYton)} YTON -> ${moneyFmt(tonAmount, 2)} TON`);
      this._showToast(`${moneyFmt(amountYton)} YTON dönüştürüldü`);
    } catch (err) {
      console.error("[ProfileScene] convert error:", err);
      this._showToast(err?.message || "Dönüştürme başarısız");
    } finally {
      this._busy = false;
    }
  }

  async _requestWithdraw() {
    if (this._busy) return;
    this._busy = true;
    try {
      const wallet = this._wallet();
      const balance = Number(wallet.tonBalance || 0);

      const raw = window.prompt(
        `Kaç TON çekmek istiyorsun?
Mevcut TON: ${moneyFmt(balance, 2)}`,
        String(Number(balance || 0).toFixed(2))
      );

      if (raw === null) {
        this._busy = false;
        return;
      }

      const normalizedRaw = String(raw).trim().replace(",", ".");
      const tonAmount = Math.max(0, parseFloat(normalizedRaw));

      if (!tonAmount || !Number.isFinite(tonAmount)) {
        this._showToast("Geçersiz miktar");
        return;
      }

      if (tonAmount > balance) {
        this._showToast("Yetersiz TON bakiye");
        return;
      }

      const targetAddress = wallet.connected && wallet.address
        ? wallet.address
        : window.prompt("Çekim yapılacak TON adresi:", "UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
      if (!targetAddress) return;
      const normalizedAddress = await this._validateTonWalletAddress(targetAddress);

      const s = this.store.get() || {};
      const player = s.player || {};
      const profileId = await this._getProfileId();
      const ytonAmount = tonAmount / 0.05;

      const { data, error } = await supabase
        .from("withdraw_requests")
        .insert({
          profile_id: profileId,
          telegram_id: this._telegramId(),
          username: String(player.username || "Player"),
          wallet_address: normalizedAddress,
          yton_amount: Number(ytonAmount.toFixed(2)),
          ton_amount: Number(tonAmount.toFixed(6)),
          rate: 0.05,
          status: "pending",
          note: "ProfileScene çekim talebi",
        })
        .select()
        .single();

      if (error) throw error;

      this.store.set({
        wallet: {
          ...wallet,
          tonBalance: Math.max(0, balance - tonAmount),
          totalWithdrawnTon: Number(wallet.totalWithdrawnTon || 0) + tonAmount,
          lastWithdrawStatus: "pending",
        },
      });

      this._pushWalletLedger("withdraw", tonAmount, ytonAmount, `Çekim talebi • ${String(normalizedAddress).slice(0, 12)}...`);
      await this._insertWalletLedger("withdraw", tonAmount, ytonAmount, `Withdraw pending • ${String(normalizedAddress).slice(0, 12)}...`, data?.id || null);
      await this._loadInbox(true);
      this._showToast(`${moneyFmt(tonAmount, 2)} TON çekim talebi oluşturuldu`);
    } catch (err) {
      console.error("[ProfileScene] withdraw error:", err);
      this._showToast(err?.message || "Çekim talebi başarısız");
    } finally {
      this._busy = false;
    }
  }

  _contentHeightForTab(state, width) {
    const tab = this._profileTab();
    const isMobile = width < 430;

    if (tab === "wallet") {
      return isMobile ? 520 : 404;
    }

    if (tab === "inbox") {
      const rows = this._inbox();
      const rowH = isMobile ? 72 : 78;
      const gap = 10;
      return 86 + Math.max(1, rows.length || 1) * (rowH + gap) + 12;
    }

    const heroH = isMobile ? 172 : 168;
    const statsH = isMobile ? (90 + 10 + 90 + 14 + 48) : (96 + 110 + 52);
    return heroH + 12 + statsH + 8;
  }

  update() {
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;
    const justPressed = !!this.input?.justPressed?.();
    const isDown = !!this.input?.isDown?.();
    const justReleased = !!this.input?.justReleased?.();

    if (justPressed) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.dragMoved = 0;
    }

    if (this.dragging && isDown) {
      const dy = py - this.downY;
      this.dragMoved = Math.max(this.dragMoved, Math.abs(dy));
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
    }

    if (!justReleased) return;

    const wasTap = this.dragMoved < 10;
    this.dragging = false;

    if (!wasTap) return;

    if (this.hitClose && pointInRect(px, py, this.hitClose)) {
      const s = this.store.get() || {};
      this.store.set({
        ui: {
          ...(s.ui || {}),
          profileTab: "profile",
        },
      });
      this.scenes.go("home");
      return;
    }

    for (const t of this.hitTabs) {
      if (pointInRect(px, py, t.rect)) {
        this._setProfileTab(t.tab);
        return;
      }
    }

    if (this._profileTab() === "wallet") {
      for (const btn of this.hitWalletButtons) {
        if (!pointInRect(px, py, btn.rect)) continue;
        if (btn.action === "connect") { this._connectWallet(btn.brand); return; }
        if (btn.action === "convert") { this._convertYtonToTon(); return; }
        if (btn.action === "withdraw") { this._requestWithdraw(); return; }
      }
      return;
    }

    if (this.hitEditAvatar && pointInRect(px, py, this.hitEditAvatar)) {
      this._showToast("Avatar düzenleme yakında");
      return;
    }

    if (this.hitLeaderboard && pointInRect(px, py, this.hitLeaderboard)) {
      this._showToast("Leaderboard yakında");
      return;
    }
  }

  _drawTextLines(ctx, lines, x, y, lineH, color = "rgba(255,255,255,0.74)", size = 12, weight = 400) {
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${weight} ${size}px system-ui`;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineH);
    }
  }

  _drawTopBar(ctx, x, y, w) {
    drawGlassPanel(ctx, x, y, w, 56, 20);

    ctx.fillStyle = "#f3f6fb";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 18px system-ui";
    const topTitle = this._profileTab() === "wallet" ? "Cüzdan" : this._profileTab() === "inbox" ? "Mesajlar" : "Profil";
    ctx.fillText(topTitle, x + 16, y + 33);

    const tabs = [
      { tab: "profile", label: "Profil" },
      { tab: "wallet", label: "Cüzdan" },
      { tab: "inbox", label: "Mesaj" },
    ];
    this.hitTabs = [];
    let tx = x + 94;
    const tw = clamp(Math.floor((w - 94 - 54 - 16) / 3), 62, 88);
    for (const t of tabs) {
      const rect = { x: tx, y: y + 10, w: tw, h: 32 };
      this.hitTabs.push({ rect, tab: t.tab });
      drawButtonPlate(ctx, rect.x, rect.y, rect.w, rect.h, this._profileTab() === t.tab ? "blue" : "muted");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px system-ui";
      ctx.fillText(t.label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
      tx += tw + 8;
    }

    this.hitClose = { x: x + w - 46, y: y + 10, w: 34, h: 34 };
    drawButtonPlate(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, "muted");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 16px system-ui";
    ctx.fillText("X", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + this.hitClose.h / 2 + 1);
  }

  _drawProfileTab(ctx, x, y, w, h, state) {
    const p = state.player || {};
    const businessesOwned = Array.isArray(state?.businesses?.owned) ? state.businesses.owned.length : 0;
    const inventoryList = Array.isArray(state?.inventory?.items) ? state.inventory.items : [];
    const inventoryItems = inventoryList.reduce((sum, item) => sum + Math.max(0, Number(item.qty || 0)), 0);
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
    const isMobile = w < 430;

    const heroH = isMobile ? 172 : 168;
    drawGlassPanel(ctx, x, y, w, heroH, 22);

    const username = String(p.username || "Player").trim() || "Player";
    const isPremium = !!(state.premium || p.premium || p.isPremium || p.membership === "premium");
    const avatarUrl = getPlayerAvatar(p);
    if (avatarUrl !== this._avatarUrl) {
      this._avatarUrl = avatarUrl;
      this._avatarImg = makeImage(avatarUrl);
    }

    const avatarFrameW = isMobile ? 96 : 108;
    const avatarFrameH = isMobile ? 104 : 112;
    const avatarFrameX = x + 14;
    const avatarFrameY = y + 14;
    drawGlassPanel(ctx, avatarFrameX, avatarFrameY, avatarFrameW, avatarFrameH, 18);

    const avatarX = avatarFrameX + 10;
    const avatarY = avatarFrameY + 10;
    const avatarW = avatarFrameW - 20;
    const avatarH = avatarFrameH - 20;

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
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${isMobile ? 24 : 28}px system-ui`;
      ctx.fillText(getInitials(username), avatarX + avatarW / 2, avatarY + avatarH / 2 + 2);
    }
    ctx.restore();

    if (isPremium) {
      drawButtonPlate(ctx, avatarFrameX + 8, avatarFrameY - 10, 50, 22, "gold");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 11px system-ui";
      ctx.fillText("VIP", avatarFrameX + 33, avatarFrameY + 1);
    }

    const infoX = avatarFrameX + avatarFrameW + 14;
    const infoW = w - (infoX - x) - 14;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${fitText(ctx, username, infoW, isMobile ? 22 : 24, 16, 900)}px system-ui`;
    ctx.fillText(username, infoX, y + 34);

    this._drawTextLines(
      ctx,
      [
        `Seviye ${Math.max(1, Number(p.level || 1))} • Clan ${clanName}`,
        `Enerji ${Number(p.energy || 0)}/${Number(p.energyMax || 100)} • YTON ${moneyFmt(state.coins || 0)}`,
        `İşletme ${businessesOwned} • Envanter ${inventoryItems}`,
        `PvP W/L ${wins}/${losses} • WinRate ${winRate}%`,
      ],
      infoX,
      y + 56,
      18,
      "rgba(255,255,255,0.74)",
      isMobile ? 11 : 12,
      500
    );

    const statsY = y + heroH + 12;
    const gap = 10;
    const smallCardH = 90;
    const titles = [
      ["İşletmeler", `${businessesOwned}`],
      ["Envanter", `${moneyFmt(totalInventoryValue)}`],
      ["PvP", `${wins}/${losses}`],
    ];

    if (isMobile) {
      const cardW = Math.floor((w - gap) / 2);
      for (let i = 0; i < 2; i++) {
        const cx = x + i * (cardW + gap);
        drawGlassPanel(ctx, cx, statsY, cardW, smallCardH, 20);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.textAlign = "center";
        ctx.font = "800 12px system-ui";
        ctx.fillText(titles[i][0], cx + cardW / 2, statsY + 24);
        ctx.fillStyle = "#fff";
        ctx.font = "900 22px system-ui";
        ctx.fillText(titles[i][1], cx + cardW / 2, statsY + 58);
      }
      drawGlassPanel(ctx, x, statsY + smallCardH + gap, w, smallCardH, 20);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.textAlign = "center";
      ctx.font = "800 12px system-ui";
      ctx.fillText(titles[2][0], x + w / 2, statsY + smallCardH + gap + 24);
      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.fillText(titles[2][1], x + w / 2, statsY + smallCardH + gap + 58);

      const btnY = statsY + smallCardH * 2 + gap + 14;
      const btnW = Math.floor((w - gap) / 2);
      this.hitEditAvatar = { x, y: btnY, w: btnW, h: 48 };
      this.hitLeaderboard = { x: x + btnW + gap, y: btnY, w: btnW, h: 48 };
      drawButtonPlate(ctx, this.hitEditAvatar.x, this.hitEditAvatar.y, this.hitEditAvatar.w, this.hitEditAvatar.h, "blue");
      drawButtonPlate(ctx, this.hitLeaderboard.x, this.hitLeaderboard.y, this.hitLeaderboard.w, this.hitLeaderboard.h, "gold");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 15px system-ui";
      ctx.fillText("📷 Avatar", this.hitEditAvatar.x + this.hitEditAvatar.w / 2, this.hitEditAvatar.y + 25);
      ctx.fillText("🏆 Liderlik", this.hitLeaderboard.x + this.hitLeaderboard.w / 2, this.hitLeaderboard.y + 25);
    } else {
      const cardW = Math.floor((w - 24) / 3);
      for (let i = 0; i < 3; i++) {
        const cx = x + i * (cardW + 12);
        drawGlassPanel(ctx, cx, statsY, cardW, 96, 20);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.textAlign = "center";
        ctx.font = "800 12px system-ui";
        ctx.fillText(titles[i][0], cx + cardW / 2, statsY + 26);
        ctx.fillStyle = "#fff";
        ctx.font = "900 22px system-ui";
        ctx.fillText(titles[i][1], cx + cardW / 2, statsY + 62);
      }
      const btnY = statsY + 110;
      const btnW = Math.floor((w - 14) / 2);
      this.hitEditAvatar = { x, y: btnY, w: btnW, h: 52 };
      this.hitLeaderboard = { x: x + btnW + 14, y: btnY, w: btnW, h: 52 };
      drawButtonPlate(ctx, this.hitEditAvatar.x, this.hitEditAvatar.y, this.hitEditAvatar.w, this.hitEditAvatar.h, "blue");
      drawButtonPlate(ctx, this.hitLeaderboard.x, this.hitLeaderboard.y, this.hitLeaderboard.w, this.hitLeaderboard.h, "gold");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 17px system-ui";
      ctx.fillText("📷 Avatar", this.hitEditAvatar.x + this.hitEditAvatar.w / 2, this.hitEditAvatar.y + 27);
      ctx.fillText("🏆 Liderlik", this.hitLeaderboard.x + this.hitLeaderboard.w / 2, this.hitLeaderboard.y + 27);
    }
  }

  _drawWalletTab(ctx, x, y, w, h, state) {
    const wallet = this._wallet();
    const tonRate = 0.05;
    const currentYton = Number(state.coins || 0);
    const availableTon = currentYton * tonRate;
    const soldValue = Number(state.market?.soldYton || 0);
    const boughtValue = Number(state.trade?.totalBoughtYton || 0);
    const wonYton = Number(state.pvp?.wonYton || 0);
    const isMobile = w < 430;

    this.hitWalletButtons = [];

    const topH = isMobile ? 128 : 136;
    drawGlassPanel(ctx, x, y, w, topH, 22);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 18px system-ui";
    ctx.fillText("Cüzdan Yönetimi", x + 16, y + 28);

    const addrText = wallet.connected
      ? `${wallet.brand} • ${String(wallet.address || "").slice(0, isMobile ? 20 : 34)}`
      : "Henüz cüzdan bağlı değil";
    this._drawTextLines(
      ctx,
      [
        addrText,
        `YTON ${moneyFmt(currentYton)} • TON ${moneyFmt(wallet.tonBalance, 2)}`,
        `Çevrilebilir ${moneyFmt(availableTon, 2)} • Çekilen ${moneyFmt(wallet.totalWithdrawnTon, 2)}`,
      ],
      x + 16,
      y + 50,
      18,
      "rgba(255,255,255,0.72)",
      12,
      400
    );

    const brands = ["Tonkeeper", "MyTonWallet", "OpenMask"];
    if (this.maxScroll > 4) {
      ctx.fillStyle = "rgba(255,255,255,0.50)";
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.font = `${isMobile ? 10 : 11}px system-ui`;
      ctx.fillText("Kaydır ↓", x + w - 16, y + 28);
    }
    const brandY = y + (isMobile ? 86 : 98);
    const gap = 8;
    const btnW = Math.floor((w - gap * 2) / 3);
    for (let i = 0; i < 3; i++) {
      const rect = { x: x + i * (btnW + gap), y: brandY, w: btnW, h: 28 };
      this.hitWalletButtons.push({ rect, action: "connect", brand: brands[i] });
      drawButtonPlate(ctx, rect.x, rect.y, rect.w, rect.h, i === 0 ? "gold" : "muted");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${isMobile ? 10 : 12}px system-ui`;
      ctx.fillText(brands[i], rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    }

    const boxY = y + topH + 12;
    const cardH = 144;
    if (isMobile) {
      drawGlassPanel(ctx, x, boxY, w, cardH, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 16px system-ui";
      ctx.fillText("YTON → TON Dönüştür", x + 16, boxY + 26);
      this._drawTextLines(
        ctx,
        [
          "1 YTON = 0.05 TON",
          `Mevcut: ${moneyFmt(currentYton)} YTON`,
          `Tahmini: ${moneyFmt(availableTon, 2)} TON`,
        ],
        x + 16,
        boxY + 48,
        18
      );
      const convertRect = { x: x + 16, y: boxY + 104, w: w - 32, h: 32 };
      this.hitWalletButtons.push({ rect: convertRect, action: "convert" });
      drawButtonPlate(ctx, convertRect.x, convertRect.y, convertRect.w, convertRect.h, "blue");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px system-ui";
      ctx.fillText("Dönüştür", convertRect.x + convertRect.w / 2, convertRect.y + 17);

      const wy = boxY + cardH + 10;
      drawGlassPanel(ctx, x, wy, w, cardH, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 16px system-ui";
      ctx.fillText("Çekim Talebi", x + 16, wy + 26);
      this._drawTextLines(
        ctx,
        [
          "Min / Max limit yok",
          `TON Bakiye: ${moneyFmt(wallet.tonBalance, 2)}`,
          wallet.connected ? "Bağlı adres kullanılacak" : "Adres prompt ile alınacak",
          wallet.lastWithdrawStatus ? `Son durum: ${wallet.lastWithdrawStatus}` : "Son durum: -",
        ],
        x + 16,
        wy + 48,
        18
      );
      const withdrawRect = { x: x + 16, y: wy + 104, w: w - 32, h: 32 };
      this.hitWalletButtons.push({ rect: withdrawRect, action: "withdraw" });
      drawButtonPlate(ctx, withdrawRect.x, withdrawRect.y, withdrawRect.w, withdrawRect.h, "gold");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px system-ui";
      ctx.fillText("Çekim Oluştur", withdrawRect.x + withdrawRect.w / 2, withdrawRect.y + 17);

      const ledgerY = wy + cardH + 10;
      drawGlassPanel(ctx, x, ledgerY, w, 210, 22);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 16px system-ui";
      ctx.fillText("Muhasebe & Rapor", x + 16, ledgerY + 28);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(`Satış ${moneyFmt(soldValue)} • Alış ${moneyFmt(boughtValue)} • Kazanç ${moneyFmt(wonYton)}`, x + 16, ledgerY + 48);
      ctx.fillText(`Dönüşüm ${moneyFmt(wallet.totalConvertedTon / 0.05)} YTON • Çekim ${moneyFmt(wallet.totalWithdrawnTon, 2)} TON`, x + 16, ledgerY + 66);

      const rows = Array.isArray(wallet.ledger) ? wallet.ledger.slice(0, 5) : [];
      const baseY = ledgerY + 90;
      if (!rows.length) {
        ctx.fillStyle = "rgba(255,255,255,0.56)";
        ctx.font = "12px system-ui";
        ctx.fillText("Henüz kayıt yok.", x + 16, baseY);
      } else {
        rows.forEach((row, idx) => {
          const ry = baseY + idx * 22;
          ctx.fillStyle = idx % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
          fillRoundRect(ctx, x + 12, ry - 14, w - 24, 18, 8);
          const d = new Date(Number(row.at || Date.now()));
          const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          ctx.fillStyle = "#fff";
          ctx.font = "10px system-ui";
          ctx.fillText(`${stamp} • ${String(row.type).toUpperCase()} • ${row.note || ""}`, x + 18, ry);
        });
      }
    } else {
      const leftW = Math.floor((w - 14) / 2);
      const rightX = x + leftW + 14;

      drawGlassPanel(ctx, x, boxY, leftW, 146, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 16px system-ui";
      ctx.fillText("YTON → TON Dönüştür", x + 16, boxY + 26);
      this._drawTextLines(
        ctx,
        [
          "1 YTON = 0.05 TON",
          `Mevcut: ${moneyFmt(currentYton)} YTON`,
          `Tahmini: ${moneyFmt(availableTon, 2)} TON`,
        ],
        x + 16,
        boxY + 48,
        20
      );
      const convertRect = { x: x + 16, y: boxY + 102, w: leftW - 32, h: 32 };
      this.hitWalletButtons.push({ rect: convertRect, action: "convert" });
      drawButtonPlate(ctx, convertRect.x, convertRect.y, convertRect.w, convertRect.h, "blue");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px system-ui";
      ctx.fillText("Dönüştür", convertRect.x + convertRect.w / 2, convertRect.y + 17);

      drawGlassPanel(ctx, rightX, boxY, leftW, 146, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 16px system-ui";
      ctx.fillText("Çekim Talebi", rightX + 16, boxY + 26);
      this._drawTextLines(
        ctx,
        [
          "Min / Max limit yok",
          `TON Bakiye: ${moneyFmt(wallet.tonBalance, 2)}`,
          wallet.connected ? "Bağlı adres kullanılacak" : "Adres prompt ile alınacak",
          wallet.lastWithdrawStatus ? `Son durum: ${wallet.lastWithdrawStatus}` : "Son durum: -",
        ],
        rightX + 16,
        boxY + 48,
        20
      );
      const withdrawRect = { x: rightX + 16, y: boxY + 102, w: leftW - 32, h: 32 };
      this.hitWalletButtons.push({ rect: withdrawRect, action: "withdraw" });
      drawButtonPlate(ctx, withdrawRect.x, withdrawRect.y, withdrawRect.w, withdrawRect.h, "gold");
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 13px system-ui";
      ctx.fillText("Çekim Oluştur", withdrawRect.x + withdrawRect.w / 2, withdrawRect.y + 17);

      const ledgerY = boxY + 160;
      drawGlassPanel(ctx, x, ledgerY, w, 220, 22);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 16px system-ui";
      ctx.fillText("Muhasebe & Rapor", x + 16, ledgerY + 28);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`Satılan Ürün: ${moneyFmt(soldValue)} YTON • Alınan Ürün: ${moneyFmt(boughtValue)} YTON • Kazanılan YTON: ${moneyFmt(wonYton)}`, x + 16, ledgerY + 48);
      ctx.fillText(`Dönüştürülen YTON: ${moneyFmt(wallet.totalConvertedTon / 0.05)} • Çekilen TON: ${moneyFmt(wallet.totalWithdrawnTon, 2)}`, x + 16, ledgerY + 66);

      const rows = Array.isArray(wallet.ledger) ? wallet.ledger.slice(0, 5) : [];
      const baseY = ledgerY + 90;
      if (!rows.length) {
        ctx.fillStyle = "rgba(255,255,255,0.56)";
        ctx.font = "12px system-ui";
        ctx.fillText("Henüz kayıt yok. Cüzdan bağla, dönüştür veya çekim yapınca burada görünür.", x + 16, baseY);
      } else {
        rows.forEach((row, idx) => {
          const ry = baseY + idx * 24;
          ctx.fillStyle = idx % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
          fillRoundRect(ctx, x + 12, ry - 14, w - 24, 20, 8);
          const d = new Date(Number(row.at || Date.now()));
          const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          ctx.fillStyle = "#fff";
          ctx.font = "11px system-ui";
          ctx.fillText(`${stamp} • ${String(row.type).toUpperCase()} • ${row.note || ""}`, x + 18, ry);
        });
      }
    }
  }
  _drawInboxTab(ctx, x, y, w, h, state) {
    const rows = this._inbox();
    const isMobile = w < 430;

    drawGlassPanel(ctx, x, y, w, h, 22);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 18px system-ui";
    ctx.fillText("Gelen Kutusu", x + 16, y + 28);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = `${isMobile ? 11 : 12}px system-ui`;
    ctx.fillText("Çekim taleplerinin durumu burada otomatik görünür.", x + 16, y + 48);

    const top = y + 62;
    const usableH = h - 76;
    if (this._inboxLoading) {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "13px system-ui";
      ctx.fillText("Mesajlar yükleniyor...", x + 16, top + 18);
      return;
    }

    if (this._inboxError) {
      ctx.fillStyle = "rgba(255,150,150,0.95)";
      ctx.font = "13px system-ui";
      ctx.fillText(this._inboxError, x + 16, top + 18);
      return;
    }

    if (!rows.length) {
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.font = "13px system-ui";
      ctx.fillText("Henüz mesaj yok. Çekim isteği verdiğinde burada görünür.", x + 16, top + 18);
      return;
    }

    const gap = 10;
    const rowH = isMobile ? 72 : 78;
    rows.forEach((row, idx) => {
      const ry = top + idx * (rowH + gap);
      drawButtonPlate(ctx, x + 12, ry, w - 24, rowH, row.accent || "muted");

      ctx.fillStyle = row.accent === "red" ? "#ffd7d7" : "#ffffff";
      ctx.font = `900 ${isMobile ? 14 : 15}px system-ui`;
      ctx.fillText(row.title || "Mesaj", x + 24, ry + 22);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `${isMobile ? 11 : 12}px system-ui`;
      const body = String(row.body || "");
      const note = row.note ? ` • ${row.note}` : "";
      ctx.fillText((body + note).slice(0, isMobile ? 76 : 122), x + 24, ry + 42);

      const d = new Date(row.at || Date.now());
      const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.font = `${isMobile ? 10 : 11}px system-ui`;
      ctx.fillText(`${stamp} • ${String(row.status || "pending").toUpperCase()}`, x + 24, ry + rowH - 14);
    });
  }


  render(ctx, w, h) {
    const state = this.store.get() || {};
    const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };
    const topReserved = Number(state?.ui?.hudReservedTop || 108);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    const bg = getImgSafe(this.assets, "background") || getImgSafe(this.assets, "trade") || null;
    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 12;
    const panelY = safe.y + topReserved + 8;
    const panelW = safe.w - 24;
    const panelH = safe.h - topReserved - bottomReserved - 18;

    drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 28);
    const innerX = panelX + 12;
    const innerY = panelY + 12;
    const innerW = panelW - 24;
    const innerH = panelH - 24;

    this.hitClose = null;
    this.hitTabs = [];
    this.hitWalletButtons = [];
    this.hitEditAvatar = null;
    this.hitLeaderboard = null;
    this.hitInboxRows = [];

    this._drawTopBar(ctx, innerX, innerY, innerW);

    const contentX = innerX;
    const contentY = innerY + 68;
    const contentW = innerW;
    const contentH = innerH - 68;
    this.contentRect = { x: contentX, y: contentY, w: contentW, h: contentH };
    const contentTotalH = this._contentHeightForTab(state, contentW);
    this.maxScroll = Math.max(0, contentTotalH - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    roundRectPath(ctx, contentX, contentY, contentW, contentH, 20);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    if (this._profileTab() === "wallet") {
      this._drawWalletTab(ctx, contentX, contentY, contentW, Math.max(contentH, contentTotalH), state);
    } else if (this._profileTab() === "inbox") {
      this._drawInboxTab(ctx, contentX, contentY, contentW, Math.max(contentH, contentTotalH), state);
    } else {
      this._drawProfileTab(ctx, contentX, contentY, contentW, Math.max(contentH, contentTotalH), state);
    }

    ctx.restore();

    if (this.maxScroll > 4) {
      const trackW = 4;
      const trackX = panelX + panelW - 8;
      const trackY = contentY + 8;
      const trackH = contentH - 16;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, trackX, trackY, trackW, trackH, 3);
      const thumbH = Math.max(28, trackH * (contentH / Math.max(contentH, contentTotalH)));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      fillRoundRect(ctx, trackX, thumbY, trackW, thumbH, 3);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(300, panelW - 40);
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 12;
      drawGlassPanel(ctx, tx, ty, tw, th, 14);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 12px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2 + 1);
    }
  }
}
