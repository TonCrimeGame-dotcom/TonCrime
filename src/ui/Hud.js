export function startHud(store) {
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
  const elLogoWrap = document.getElementById("hudLogoWrap");

  const elAvatar = document.getElementById("hudAvatar");
  const elAvatarImg = document.getElementById("hudAvatarImg");
  const elAvatarFallback = document.getElementById("hudAvatarFallback");

  const elOnlineBadge = document.getElementById("hudOnlineBadge");
  const elPremiumBadge = document.getElementById("hudPremiumBadge");

  if (
    !root ||
    !row ||
    !elUsername ||
    !elCoins ||
    !elWeaponName ||
    !elWeaponBonus ||
    !elXpFill ||
    !elXpText ||
    !elEnergyFill ||
    !elEnergyText ||
    !elAvatar ||
    !elOnlineBadge ||
    !elPremiumBadge
  ) {
    console.warn("[HUD] index.html HUD elementleri bulunamadı");
    return;
  }

  root.style.zIndex = "5000";
  root.style.opacity = "1";
  root.style.pointerEvents = "auto";
  root.style.left = "max(var(--sal), 0px)";
  root.style.right = "max(var(--sar), 0px)";
  root.style.top = "max(var(--sat), 0px)";

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clamp01 = (n) => clamp(n, 0, 1);

  function fmtMMSS(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function syncHudCss() {
    const vw = window.innerWidth || 0;

    if (vw <= 720) {
      row.style.gridTemplateColumns = "1fr";
      row.style.gap = "8px";
      root.style.padding = "8px 10px 0";

      if (elLogoWrap) elLogoWrap.style.display = "none";
      if (elLogo) {
        elLogo.style.height = "44px";
        elLogo.style.margin = "0 auto";
      }
      return;
    }

    if (vw <= 980) {
      row.style.gridTemplateColumns = "minmax(0,1fr) minmax(120px,auto)";
      row.style.gap = "10px";
      root.style.padding = "10px 12px 0";

      if (elLogoWrap) {
        elLogoWrap.style.display = "flex";
        elLogoWrap.style.gridColumn = "1 / -1";
        elLogoWrap.style.order = "-1";
      }
      if (elLogo) {
        elLogo.style.height = "46px";
        elLogo.style.margin = "0 auto";
      }
      return;
    }

    row.style.gridTemplateColumns = "minmax(0,1fr) auto minmax(0,1.08fr)";
    row.style.gap = "clamp(8px, 1.8vw, 14px)";
    root.style.padding = "clamp(8px, 2.2vw, 14px) clamp(10px, 3vw, 18px) 0";

    if (elLogoWrap) {
      elLogoWrap.style.display = "flex";
      elLogoWrap.style.gridColumn = "auto";
      elLogoWrap.style.order = "0";
    }
    if (elLogo) {
      elLogo.style.height = "clamp(40px, 5.8vw, 68px)";
      elLogo.style.margin = "0";
    }
  }

  function getInitials(name) {
    const raw = String(name || "").trim();
    if (!raw) return "P";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  }

  function pickAvatarUrl(player) {
    return (
      player?.avatarUrl ||
      player?.avatar ||
      player?.photoUrl ||
      player?.photo_url ||
      player?.telegramPhotoUrl ||
      ""
    );
  }

  let lastReservedTop = 0;
  let lastAvatarUrl = "";

  function loop() {
    syncHudCss();

    const s = store.get() || {};
    const p = s.player || {};
    const ui = s.ui || {};

    const username = String(p.username || "Player").trim() || "Player";
    elUsername.textContent = username;
    elUsername.title = username;

    const coins = Number(s.coins || p.coins || 0);
    elCoins.textContent = `YTON ${coins.toLocaleString("tr-TR")}`;

    const weaponName = String(p.weaponName || "Silah Yok").trim() || "Silah Yok";
    const weaponBonusRaw = Number(p.weaponIconBonusPct ?? p.weaponBonusPct ?? 0);
    const weaponBonusText =
      typeof p.weaponBonus === "string" && p.weaponBonus.trim()
        ? p.weaponBonus.trim()
        : `+${weaponBonusRaw}%`;

    elWeaponName.textContent = weaponName;
    elWeaponName.title = weaponName;
    elWeaponBonus.textContent = `• ${weaponBonusText}`;

    const xp = Math.max(0, Number(p.xp || 0));
    const xpToNext = Math.max(1, Number(p.xpToNext || 100));
    elXpFill.style.width = `${Math.max(2, clamp01(xp / xpToNext) * 100)}%`;
    elXpText.textContent = `LVL ${Number(p.level || 1)} • ${xp}/${xpToNext}`;

    const e = Math.max(0, Number(p.energy || 0));
    const eMax = Math.max(1, Number(p.energyMax || 10));
    elEnergyFill.style.width = `${Math.max(2, clamp01(e / eMax) * 100)}%`;

    const interval = Math.max(10000, Number(p.energyIntervalMs || 300000));
    const lastAt = Number(p.lastEnergyAt || Date.now());
    const now = Date.now();
    const untilNext = e >= eMax ? 0 : Math.max(0, interval - (now - lastAt));

    elEnergyText.textContent =
      e >= eMax
        ? `ENERJİ ${e}/${eMax} • FULL`
        : `ENERJİ ${e}/${eMax} • ${fmtMMSS(untilNext)}`;

    const avatarUrl = pickAvatarUrl(p);
    const initials = getInitials(username);

    if (elAvatarFallback) {
      elAvatarFallback.textContent = initials;
    }

    if (elAvatarImg) {
      if (avatarUrl !== lastAvatarUrl) {
        lastAvatarUrl = avatarUrl;
        if (avatarUrl) {
          elAvatarImg.src = avatarUrl;
          elAvatarImg.style.display = "block";
          if (elAvatarFallback) elAvatarFallback.style.display = "none";
        } else {
          elAvatarImg.removeAttribute("src");
          elAvatarImg.style.display = "none";
          if (elAvatarFallback) elAvatarFallback.style.display = "grid";
        }
      }

      elAvatarImg.onerror = () => {
        elAvatarImg.style.display = "none";
        if (elAvatarFallback) elAvatarFallback.style.display = "grid";
      };

      elAvatarImg.onload = () => {
        elAvatarImg.style.display = "block";
        if (elAvatarFallback) elAvatarFallback.style.display = "none";
      };
    }

    const isPremium = !!(
      p.isPremium ||
      p.premium ||
      s.isPremium ||
      s.premium ||
      p.membership === "premium"
    );

    elOnlineBadge.textContent = "● ONLINE";
    elOnlineBadge.style.display = "inline-flex";

    elPremiumBadge.textContent = "PREMIUM";
    elPremiumBadge.style.display = isPremium ? "inline-flex" : "none";

    const safeTop = Number(ui.safe?.y || 0);
    const isMobile = (window.innerWidth || 0) <= 720;
    const minReserved = isMobile ? 112 : 92;
    const extraGap = isMobile ? 6 : 8;
    const reservedTop = Math.max(minReserved, root.offsetHeight + safeTop + extraGap);

    if (Math.abs(lastReservedTop - reservedTop) > 1) {
      lastReservedTop = reservedTop;
      store.set({
        ui: {
          ...ui,
          hudReservedTop: reservedTop,
        },
      });
    }

    requestAnimationFrame(loop);
  }

  syncHudCss();
  loop();
}
