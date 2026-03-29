
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
  const elCoinsIcon = elCoins?.closest?.(".line2")?.querySelector?.(".hudMiniIcon") || null;
  const elWeaponIcon = elWeaponName?.closest?.(".line3")?.querySelector?.(".hudMiniIcon") || null;

  if (!root || !row || !shell || !elUsername || !elCoins || !elWeaponName || !elXpFill || !elXpText || !elEnergyFill || !elEnergyText || !elAvatar || !elAvatarImg || !elAvatarFallback) {
    console.warn("[HUD] gerekli HUD elementleri bulunamadı");
    return;
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clamp01 = (n) => clamp(n, 0, 1);

  const YTON_IMAGE_SRC = "./src/assets/yton.png";
  const WEAPON_ASSET_BY_ID = {
    glock_17: "glock.png",
    sig_p320: "sauer.png",
    beretta_92fs: "baretta.png",
    colt_1911: "cold.png",
    mossberg_500: "moss.png",
    rem_870: "reminaton.png",
    mp5: "mp5.png",
    ump45: "ump.png",
    ar15: "ar.png",
    ak74: "ak74.png",
    ak47: "ak47.png",
    m4a1: "m4a1.png",
    g3: "g3.png",
    scar_h: "scar.png",
    svd: "dragunov.png",
    m24: "m24.png",
    m79: "m79.png",
    rpg7: "rpg.png",
    barrett_m82: "barrett.png",
    m134: "m134.png",
  };

  const WEAPON_ASSET_BY_NAME = {
    "glock17919mm": "glock.png",
    "sigsauerp320919mm": "sauer.png",
    "beretta92fs919mm": "baretta.png",
    "colt191145acp": "cold.png",
    "mossberg50012ga": "moss.png",
    "remington87012ga": "reminaton.png",
    "hkmp5919mm": "mp5.png",
    "hkump4545acp": "ump.png",
    "ar1555645": "ar.png",
    "ak7454539": "ak74.png",
    "ak4776239": "ak47.png",
    "m4a155645": "m4a1.png",
    "hkg376251": "g3.png",
    "fnscarh76251": "scar.png",
    "dragunovsvd76254r": "dragunov.png",
    "remingtonm2476251": "m24.png",
    "m79launcher": "m79.png",
    "rpg7launcher": "rpg.png",
    "barrettm8250bmg": "barrett.png",
    "m134minigun76251": "m134.png",
  };

  const WEAPON_IMAGE_HINT_KEYS = [
    "weaponImage",
    "weaponImg",
    "weaponAsset",
    "weaponAssetName",
    "weaponAssetFile",
    "weaponFile",
    "equippedImage",
    "equippedAsset",
    "equippedSkin",
  ];
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


  function normalizeWeaponKey(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function resolveAssetPath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("./") || raw.startsWith("../") || raw.startsWith("/") || raw.startsWith("http")) {
      return raw;
    }
    if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(raw)) {
      return `./src/assets/${raw}`;
    }
    return `./src/assets/${raw}.png`;
  }

  function firstExistingString(values = []) {
    for (const val of values) {
      const text = String(val || "").trim();
      if (text) return text;
    }
    return "";
  }

  function resolveWeaponImage(state) {
    const player = state?.player || {};
    const weapons = state?.weapons || {};
    const weaponName = String(player.weaponName || "").trim();
    const noWeapon = !weaponName || /^silah yok$/i.test(weaponName) || /^no weapon$/i.test(weaponName);
    if (noWeapon) return "";

    const explicit = firstExistingString(
      WEAPON_IMAGE_HINT_KEYS.map((key) => player?.[key]).concat(
        WEAPON_IMAGE_HINT_KEYS.map((key) => weapons?.[key])
      )
    );
    if (explicit) return resolveAssetPath(explicit);

    const equippedId = String(weapons.equippedId || player.weaponId || "").trim();
    if (equippedId && WEAPON_ASSET_BY_ID[equippedId]) {
      return resolveAssetPath(WEAPON_ASSET_BY_ID[equippedId]);
    }

    const normalizedName = normalizeWeaponKey(weaponName);
    if (normalizedName && WEAPON_ASSET_BY_NAME[normalizedName]) {
      return resolveAssetPath(WEAPON_ASSET_BY_NAME[normalizedName]);
    }

    return "";
  }
  function ensureMiniVisual(el, className = "") {
    if (!el) return null;
    el.classList.add("hudMiniVisual");
    if (className) el.classList.add(className);

    let img = el.querySelector("img");
    if (!img) {
      el.textContent = "";
      img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      el.appendChild(img);
    }

    return { wrap: el, img };
  }

  function setMiniVisual(target, src, title = "") {
    if (!target?.wrap || !target?.img) return;
    target.wrap.title = title || "";

    if (!target.img.__hudVisualBound) {
      target.img.__hudVisualBound = true;
      target.img.addEventListener("error", () => {
        target.wrap.classList.add("is-empty");
        target.img.removeAttribute("src");
      });
      target.img.addEventListener("load", () => {
        target.wrap.classList.remove("is-empty");
      });
    }

    if (src) {
      if (target.img.getAttribute("src") !== src) {
        target.img.src = src;
      }
      target.wrap.classList.remove("is-empty");
      return;
    }

    target.img.removeAttribute("src");
    target.wrap.classList.add("is-empty");
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

  const coinsVisual = ensureMiniVisual(elCoinsIcon, "hudMiniVisualYton");
  const weaponVisual = ensureMiniVisual(elWeaponIcon, "hudMiniVisualWeapon");

  const { walletBtn, telegramBtn } = makeActionDock();

  if (elLogo) elLogo.style.display = "none";
  if (elCenter) elCenter.style.display = "none";
  row.dataset.centerHidden = "1";
  if (coinsVisual?.wrap) coinsVisual.wrap.setAttribute("aria-hidden", "true");
  if (weaponVisual?.wrap) weaponVisual.wrap.setAttribute("aria-hidden", "true");

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
    elCoins.textContent = Number.isFinite(yton) ? yton.toLocaleString("tr-TR") : "0";
    setMiniVisual(coinsVisual, YTON_IMAGE_SRC, "YTON");

    const weaponName = String(p.weaponName || "Silah Yok").trim() || "Silah Yok";
    elWeaponName.textContent = weaponName;
    setMiniVisual(weaponVisual, resolveWeaponImage(s), weaponName);
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
