
export function startHud(store) {
  const root = document.getElementById("hudTop");
  const row = document.getElementById("hudRow");
  const shell = document.getElementById("hudShell");

  const elUsername = document.getElementById("hudUsername");
  const elCoins = document.getElementById("hudCoins");
  const elWeaponName = document.getElementById("hudWeaponName");
  const elWeaponBonus = document.getElementById("hudWeaponBonus");
  const elXpFill = document.getElementById("hudXpFill");
  const elXpText = document.getElementById("hudXpText");
  const elEnergyFill = document.getElementById("hudEnergyFill");
  const elEnergyText = document.getElementById("hudEnergyText");
  const elAvatar = document.getElementById("hudAvatar");
  const elAvatarImg = document.getElementById("hudAvatarImg");
  const elAvatarFallback = document.getElementById("hudAvatarFallback");
  const elOnlineBadge = document.getElementById("hudOnlineBadge");
  const elPremiumBadge = document.getElementById("hudPremiumBadge");
  const elLogo = document.getElementById("hudLogo");
  const elCenter = document.getElementById("hudCenter");

  if (!root || !row || !shell || !elUsername || !elCoins || !elWeaponName || !elXpFill || !elXpText || !elEnergyFill || !elEnergyText || !elAvatar || !elAvatarImg || !elAvatarFallback) {
    console.warn("[HUD] gerekli HUD elementleri bulunamadı");
    return;
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clamp01 = (n) => clamp(n, 0, 1);

  function fmtMMSS(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function getInitials(name) {
    const raw = String(name || "").trim();
    if (!raw) return "TC";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return raw.slice(0, 2).toUpperCase();
  }

  function getAvatarUrl(player) {
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

  function makeActionDock() {
    let dock = document.getElementById("hudActionDock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "hudActionDock";
      shell.appendChild(dock);
    }

    let walletBtn = document.getElementById("hudWalletBtn");
    if (!walletBtn) {
      walletBtn = document.createElement("button");
      walletBtn.id = "hudWalletBtn";
      walletBtn.type = "button";
      walletBtn.setAttribute("aria-label", "Cüzdan");
      walletBtn.innerHTML = `
        <span class="hudActionIcon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <rect x="10" y="18" width="44" height="28" rx="10" fill="rgba(21,18,16,.88)" stroke="rgba(255,202,116,.75)" stroke-width="3"/>
            <path d="M18 26h28" stroke="rgba(255,202,116,.78)" stroke-width="3" stroke-linecap="round"/>
            <rect x="36" y="26" width="14" height="12" rx="5" fill="rgba(255,184,74,.18)" stroke="rgba(255,202,116,.7)" stroke-width="2"/>
            <circle cx="42" cy="32" r="2.3" fill="#ffd27b"/>
          </svg>
        </span>
      `;
      dock.appendChild(walletBtn);
    }

    let telegramBtn = document.getElementById("hudTelegramBtn");
    if (!telegramBtn) {
      telegramBtn = document.createElement("button");
      telegramBtn.id = "hudTelegramBtn";
      telegramBtn.type = "button";
      telegramBtn.setAttribute("aria-label", "Telegram");
      telegramBtn.innerHTML = `
        <span class="hudActionIcon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="tcTgBg" x1="12" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
                <stop stop-color="#3a2415"/>
                <stop offset="1" stop-color="#18110d"/>
              </linearGradient>
              <linearGradient id="tcTgPlane" x1="24" y1="18" x2="42" y2="46" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ffd27b"/>
                <stop offset="1" stop-color="#f0a84b"/>
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="24" fill="url(#tcTgBg)" stroke="rgba(255,202,116,.78)" stroke-width="3"/>
            <path d="M21 31.5 44.8 21.6c1.7-.7 3.2 1 2.3 2.5L37.8 41.6c-.5.9-1.8 1.1-2.6.4l-6.1-5.3-4.2 3.7c-.8.7-2 .2-2.1-.9l-.6-6.1-4.2-1.3c-1.5-.5-1.5-2.7 0-3.3L21 31.5Z" fill="url(#tcTgPlane)"/>
            <path d="m29 36.7 8.4-8.6" stroke="#2e190d" stroke-width="2.4" stroke-linecap="round"/>
          </svg>
        </span>
      `;
      dock.appendChild(telegramBtn);
    }

    return { dock, walletBtn, telegramBtn };
  }

  function openProfile(tab = "profile") {
    try {
      const s = store.get() || {};
      store.set({
        ui: {
          ...(s.ui || {}),
          profileTab: tab,
        },
      });
    } catch (_) {}

    try {
      const scenes = window.tcScenes;
      if (scenes && typeof scenes.go === "function") {
        scenes.go("profile");
      }
    } catch (_) {}

    try {
      window.dispatchEvent(new Event(tab === "wallet" ? "tc:openWallet" : "tc:openProfile"));
    } catch (_) {}
  }

  function openTelegram() {
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

  const { walletBtn, telegramBtn } = makeActionDock();

  if (elLogo) elLogo.style.display = "none";
  if (elCenter) elCenter.style.display = "none";
  row.dataset.centerHidden = "1";

  if (!elAvatarImg.__hudBound) {
    elAvatarImg.__hudBound = true;
    elAvatarImg.onload = () => {
      elAvatarImg.style.display = "block";
      elAvatarFallback.style.display = "none";
    };
    elAvatarImg.onerror = () => {
      elAvatarImg.style.display = "none";
      elAvatarFallback.style.display = "grid";
    };
  }

  if (!elAvatar.__profileBound) {
    elAvatar.__profileBound = true;
    elAvatar.style.cursor = "pointer";
    elAvatar.title = "Profili Aç";
    elAvatar.addEventListener("click", () => openProfile("profile"));
    elAvatar.addEventListener("pointerdown", (e) => e.stopPropagation(), { capture: true });
  }

  if (!walletBtn.__walletBound) {
    walletBtn.__walletBound = true;
    walletBtn.title = "Cüzdan";
    walletBtn.addEventListener("click", () => openProfile("wallet"));
    walletBtn.addEventListener("pointerdown", (e) => e.stopPropagation(), { capture: true });
  }

  if (!telegramBtn.__telegramBound) {
    telegramBtn.__telegramBound = true;
    telegramBtn.title = "TonCrime Telegram";
    telegramBtn.addEventListener("click", openTelegram);
    telegramBtn.addEventListener("pointerdown", (e) => e.stopPropagation(), { capture: true });
  }

  root.style.zIndex = "5000";
  root.style.opacity = "1";
  root.style.pointerEvents = "auto";

  let lastAvatarUrl = "";
  let lastReservedTop = 0;

  function updateHud() {
    const s = store.get() || {};
    const p = s.player || {};
    const ui = s.ui || {};

    const username = String(p.username || "Player").trim() || "Player";
    elUsername.textContent = username;
    elUsername.title = username;

    const yton = Number(s.yton ?? s.coins ?? p.coins ?? 0);
    elCoins.textContent = `YTON ${Number.isFinite(yton) ? yton.toLocaleString("tr-TR") : "0"}`;

    const weaponName = String(p.weaponName || "Silah Yok").trim() || "Silah Yok";
    elWeaponName.textContent = weaponName;
    if (elWeaponBonus) {
      elWeaponBonus.textContent = "";
      elWeaponBonus.style.display = "none";
    }

    const xp = Math.max(0, Number(p.xp || 0));
    const xpToNext = Math.max(1, Number(p.xpToNext || 100));
    const xpPct = Math.max(4, clamp01(xp / xpToNext) * 100);
    elXpFill.style.width = `${xpPct}%`;
    elXpText.textContent = `LVL ${Number(p.level || 1)} • ${xp}/${xpToNext}`;

    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 10));
    const energyPct = Math.max(4, clamp01(energy / energyMax) * 100);
    elEnergyFill.style.width = `${energyPct}%`;

    const interval = Math.max(10000, Number(p.energyIntervalMs || 300000));
    const lastAt = Number(p.lastEnergyAt || Date.now());
    const now = Date.now();
    const untilNext = energy >= energyMax ? 0 : Math.max(0, interval - (now - lastAt));
    elEnergyText.textContent = energy >= energyMax
      ? `ENERGY ${energy}/${energyMax} • FULL`
      : `ENERGY ${energy}/${energyMax} • ${fmtMMSS(untilNext)}`;

    const avatarUrl = getAvatarUrl(p);
    elAvatarFallback.textContent = getInitials(username);
    if (avatarUrl !== lastAvatarUrl) {
      lastAvatarUrl = avatarUrl;
      if (avatarUrl) {
        elAvatarImg.style.display = "none";
        elAvatarFallback.style.display = "grid";
        elAvatarImg.src = avatarUrl;
      } else {
        elAvatarImg.removeAttribute("src");
        elAvatarImg.style.display = "none";
        elAvatarFallback.style.display = "grid";
      }
    }

    const isPremium = !!(p.isPremium || p.premium || s.isPremium || s.premium || p.membership === "premium");
    if (elOnlineBadge) elOnlineBadge.style.display = "inline-flex";
    if (elPremiumBadge) elPremiumBadge.style.display = isPremium ? "inline-flex" : "none";

    const safeTop = Number(ui.safe?.y || 0);
    const reservedTop = Math.max(58, root.offsetHeight + safeTop + 54);
    if (Math.abs(lastReservedTop - reservedTop) > 1) {
      lastReservedTop = reservedTop;
      store.set({
        ui: {
          ...ui,
          hudReservedTop: reservedTop,
        },
      });
    }

    requestAnimationFrame(updateHud);
  }

  requestAnimationFrame(updateHud);
}
