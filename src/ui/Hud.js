export function startHud(store, i18n) {
  const root = document.getElementById("hudTop");
  const row = document.getElementById("hudRow");

  const elUsername = document.getElementById("hudUsername");
  const elCoins = document.getElementById("hudCoins");
  const elWeaponName = document.getElementById("hudWeaponName");
  const elWeaponBonus = document.getElementById("hudWeaponBonus");

  const elXpFill = document.getElementById("hudXpFill");
  const elXpText = document.getElementById("hudXpText");
  const elEnergyFill = document.getElementById("hudEnergyFill");
  const elEnergyText = document.getElementById("hudEnergyText");

  const elLogo = document.getElementById("hudLogo");
  const elCenter = document.getElementById("hudCenter");

  const elAvatar = document.getElementById("hudAvatar");
  const elAvatarImg = document.getElementById("hudAvatarImg");
  const elAvatarFallback = document.getElementById("hudAvatarFallback");

  const elOnlineBadge = document.getElementById("hudOnlineBadge");
  const elPremiumBadge = document.getElementById("hudPremiumBadge");

  if (
    !root || !row || !elUsername || !elCoins || !elWeaponName || !elWeaponBonus ||
    !elXpFill || !elXpText || !elEnergyFill || !elEnergyText ||
    !elAvatar || !elAvatarFallback || !elOnlineBadge || !elPremiumBadge
  ) {
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
    if (!raw) return "P";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return raw.slice(0, 2).toUpperCase();
  }

  function getAvatarUrl(player) {
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

  let walletBtn = document.getElementById("hudWalletBtn");
  let langBtn = document.getElementById("hudLangBtn");

  if (!walletBtn) {
    walletBtn = document.createElement("button");
    walletBtn.id = "hudWalletBtn";
    walletBtn.type = "button";
    walletBtn.setAttribute("aria-label", "Cüzdan");
    walletBtn.textContent = "💳";
    root.appendChild(walletBtn);
  }

  if (!langBtn) {
    langBtn = document.createElement("button");
    langBtn.id = "hudLangBtn";
    langBtn.type = "button";
    root.appendChild(langBtn);
  }

  function bindAvatarImgEventsOnce() {
    if (!elAvatarImg || elAvatarImg.__hudBound) return;
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

  function openProfile(tab = "profile") {
    try {
      const s = store.get() || {};
      store.set({
        ui: {
          ...(s.ui || {}),
          profileTab: tab,
        },
      });
      window.dispatchEvent(new Event("tc:openProfile"));
    } catch (_) {}
  }

  function updateDynamicLabels() {
    const lang = i18n?.getLang?.() || store.get?.()?.lang || "tr";

    if (walletBtn) {
      const walletLabel = i18n?.t?.("hud.wallet", "Cüzdan") || "Cüzdan";
      walletBtn.title = walletLabel;
      walletBtn.setAttribute("aria-label", walletLabel);
    }

    if (elAvatar) {
      elAvatar.title = i18n?.t?.("hud.openProfile", "Profili Aç") || "Profili Aç";
    }

    if (langBtn) {
      langBtn.title = i18n?.t?.("lang.switchTo", lang === "tr" ? "English" : "Türkçe") || "Language";
      langBtn.setAttribute("aria-label", i18n?.t?.("hud.language", "Dil") || "Dil");
      langBtn.textContent = lang === "tr" ? "EN" : "TR";
    }
  }

  function bindClicksOnce() {
    if (!elAvatar.__profileBound) {
      elAvatar.__profileBound = true;
      elAvatar.style.cursor = "pointer";
      elAvatar.title = "Profili Aç";
      elAvatar.addEventListener("click", () => openProfile("profile"));
      elAvatar.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    if (!walletBtn.__walletBound) {
      walletBtn.__walletBound = true;
      walletBtn.addEventListener("click", () => openProfile("wallet"));
      walletBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    if (!langBtn.__langBound) {
      langBtn.__langBound = true;
      langBtn.addEventListener("click", () => {
        const current = i18n?.getLang?.() || store.get?.()?.lang || "tr";
        const next = current === "tr" ? "en" : "tr";
        if (i18n?.setLang) i18n.setLang(next);
        else store.set({ lang: next });
        updateDynamicLabels();
      });
      langBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
  }

  function applyLangButtonStyle() {
    if (!langBtn) return;
    const narrow = window.innerWidth <= 420;
    const mobile = window.innerWidth <= 720;
    const size = narrow ? 34 : (mobile ? 38 : 42);
    const radius = narrow ? 12 : (mobile ? 13 : 14);
    const right = narrow ? 46 : (mobile ? 50 : 56);
    const top = narrow ? "calc(100% + 4px)" : (mobile ? "calc(100% + 5px)" : "calc(100% + 6px)");

    langBtn.style.position = "absolute";
    langBtn.style.right = `${right}px`;
    langBtn.style.top = top;
    langBtn.style.width = `${size}px`;
    langBtn.style.height = `${size}px`;
    langBtn.style.border = "1px solid rgba(255,255,255,0.12)";
    langBtn.style.borderRadius = `${radius}px`;
    langBtn.style.background = "linear-gradient(180deg, rgba(255,200,110,0.18) 0%, rgba(255,160,70,0.10) 100%), rgba(10,12,18,0.82)";
    langBtn.style.color = "rgba(255,245,220,0.98)";
    langBtn.style.font = `${narrow ? 700 : 800} ${narrow ? 10 : 11}px system-ui`;
    langBtn.style.letterSpacing = "0.3px";
    langBtn.style.boxShadow = "0 10px 22px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.10)";
    langBtn.style.backdropFilter = "blur(12px) saturate(1.08)";
    langBtn.style.webkitBackdropFilter = "blur(12px) saturate(1.08)";
    langBtn.style.cursor = "pointer";
    langBtn.style.zIndex = "2";
    langBtn.style.display = "inline-flex";
    langBtn.style.alignItems = "center";
    langBtn.style.justifyContent = "center";
    langBtn.style.padding = "0";
  }

  root.style.zIndex = "5000";
  root.style.opacity = "1";
  root.style.pointerEvents = "auto";
  root.style.left = "max(var(--sal), 0px)";
  root.style.right = "max(var(--sar), 0px)";
  root.style.top = "max(var(--sat), 0px)";

  let lastReservedTop = 0;
  let lastAvatarUrl = "";

  function updateHud() {
    bindAvatarImgEventsOnce();
    bindClicksOnce();
    applyLangButtonStyle();
    updateDynamicLabels();

    const s = store.get() || {};
    const p = s.player || {};
    const ui = s.ui || {};

    const username = String(p.username || "Player").trim() || "Player";
    elUsername.textContent = username;
    elUsername.title = username;

    const yton = Number(s.coins ?? p.coins ?? 0);
    elCoins.textContent = `YTON ${Number.isFinite(yton) ? yton.toLocaleString("tr-TR") : "0"}`;

    const weaponName = String(p.weaponName || "Silah Yok").trim() || "Silah Yok";
    elWeaponName.textContent = weaponName;
    elWeaponName.title = weaponName;

    elWeaponBonus.textContent = "";
    elWeaponBonus.title = "";
    elWeaponBonus.style.display = "none";

    const xp = Math.max(0, Number(p.xp || 0));
    const xpToNext = Math.max(1, Number(p.xpToNext || 100));
    const xpPct = Math.max(3, clamp01(xp / xpToNext) * 100);
    elXpFill.style.width = `${xpPct}%`;
    elXpText.textContent = `LVL ${Number(p.level || 1)} • ${xp}/${xpToNext}`;

    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 10));
    const energyPct = Math.max(3, clamp01(energy / energyMax) * 100);
    elEnergyFill.style.width = `${energyPct}%`;

    const interval = Math.max(10000, Number(p.energyIntervalMs || 300000));
    const lastAt = Number(p.lastEnergyAt || Date.now());
    const now = Date.now();
    const untilNext = energy >= energyMax ? 0 : Math.max(0, interval - (now - lastAt));

    elEnergyText.textContent =
      energy >= energyMax
        ? `ENERGY ${energy}/${energyMax} • FULL`
        : `ENERGY ${energy}/${energyMax} • ${fmtMMSS(untilNext)}`;

    const avatarUrl = getAvatarUrl(p);
    const initials = getInitials(username);
    elAvatarFallback.textContent = initials;

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
    elOnlineBadge.style.display = "inline-flex";
    elPremiumBadge.style.display = isPremium ? "inline-flex" : "none";

    if (elLogo) elLogo.style.display = "block";
    if (elCenter) elCenter.style.display = "flex";

    const safeTop = Number(ui.safe?.y || 0);
    const reservedTop = Math.max(72, root.offsetHeight + safeTop + 6);

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

  updateHud();
}
