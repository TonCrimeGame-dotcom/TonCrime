(function () {
  const TOKEN_KEY = "toncrime_wallet_token_v1";
  const BACKENDS = [
    window.TONCRIME_BACKEND_URL,
    window.__TONCRIME_BACKEND_URL__,
    "https://toncrime.onrender.com",
  ].filter(Boolean).map((item) => String(item).replace(/\/+$/, ""));

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = String(value ?? "");
  }

  function fmtNumber(value, suffix) {
    const n = Number(value || 0);
    const text = Number.isFinite(n)
      ? n.toLocaleString("tr-TR", { maximumFractionDigits: 6 })
      : "0";
    return suffix ? `${text} ${suffix}` : text;
  }

  function readToken() {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get("tc_wallet_token") || params.get("token") || "").trim();
    if (token) {
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch (_) {}
      params.delete("tc_wallet_token");
      params.delete("token");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash || ""}`;
      try { window.history.replaceState(null, "", next); } catch (_) {}
      return token;
    }
    try { return String(sessionStorage.getItem(TOKEN_KEY) || "").trim(); } catch (_) { return ""; }
  }

  async function fetchWalletSession(token) {
    let lastErr = null;
    for (const base of BACKENDS) {
      try {
        const url = new URL("/public/wallet/session", `${base}/`);
        const res = await fetch(url.toString(), {
          cache: "no-store",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          lastErr = new Error(json?.error || `HTTP ${res.status}`);
          continue;
        }
        return json;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("backend unavailable");
  }

  function renderLocked() {
    setText("walletStatus", "Telegram oyunundan Harici Cuzdani Ac butonuyla giris yap");
    setText("walletTotal", "Oturum yok");
    setText("walletWithdrawable", "Oturum yok");
    setText("walletPending", "Oturum yok");
    setText("walletLast", "-");
    setText("walletIdentity", "-");
    setText("walletMarketToday", "Canli baglanti bekleniyor");
    setText("walletDailyLimit", "-");
  }

  function renderSession(json) {
    const profile = json?.profile || {};
    const wallet = json?.wallet || {};
    const tonLive = !!wallet.ledger_live;
    setText("walletStatus", tonLive ? "Canli TON bagli" : "Profil bagli / TON verisi yok");
    setText("walletTotal", `${fmtNumber(wallet.yton_balance, "YTON")} oyun bakiyesi`);
    setText("walletWithdrawable", tonLive ? fmtNumber(wallet.withdrawable_ton, "TON") : "Canli TON yok");
    setText("walletPending", tonLive ? fmtNumber(wallet.pending_ton, "TON") : "Canli TON yok");
    setText("walletLast", tonLive && wallet.last_activity_at ? new Date(wallet.last_activity_at).toLocaleString("tr-TR") : "TON ledger bagli degil");
    setText("walletIdentity", profile.username ? `@${profile.username}` : String(profile.telegram_id || "-"));
    setText("walletMarketToday", tonLive ? "Canli hesaplama sonraki adimda" : "TON ledger aktif degil");
    setText("walletDailyLimit", tonLive ? fmtNumber(wallet.daily_withdraw_limit_ton, "TON") : "Aktif degil");
  }

  async function boot() {
    const token = readToken();
    if (!token) {
      renderLocked();
      return;
    }

    setText("walletStatus", "Oturum dogrulaniyor...");
    try {
      const json = await fetchWalletSession(token);
      renderSession(json);
      window.tcWalletSession = json;
    } catch (err) {
      console.warn("[TonCrime Wallet] session failed:", err);
      renderLocked();
      setText("walletStatus", "Oturum dogrulanamadi, oyundan tekrar ac");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
