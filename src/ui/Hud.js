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
  const elCenter = document.getElementById("hudCenter");

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
    !elAvatarFallback ||
    !elOnlineBadge ||
    !elPremiumBadge
  ) {
    console.warn("[HUD] gerekli HUD elementleri bulunamadı");
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

  function updateLogoSize() {
    if (!elLogo || !elCenter || !root) return;

    const hudH = Math.max(48, root.offsetHeight - 14);
    const vw = window.innerWidth || 0;

    let logoH = Math.round(hudH * 0.95);
    if (vw <= 420) logoH = Math.round(hudH * 0.62);
    else if (vw <= 640) logoH = Math.round(hudH * 0.68);
    else if (vw <= 920) logoH = Math.round(hudH * 0.74);

    elLogo.style.height = `${logoH}px`;
    elLogo.style.width = "auto";
    elLogo.style.maxWidth = "100%";
    elLogo.style.objectFit = "contain";

    const centerW = Math.max(logoH + 10, Math.round(logoH * 1.2));
    elCenter.style.width = `${centerW}px`;
    elCenter.style.minWidth = `${centerW}px`;
  }

  let lastReservedTop = 0;
  let lastAvatarUrl = "";
  let imgEventsBound = false;

  function bindAvatarImgEventsOnce() {
    if (!elAvatarImg || imgEventsBound) return;
    imgEventsBound = true;

    elAvatarImg.onload = () => {
      elAvatarImg.style.display = "block";
      elAvatarFallback.style.display = "none";
    };

    elAvatarImg.onerror = () => {
      elAvatarImg.style.display = "none";
      elAvatarFallback.style.display = "grid";
    };
  }

  function loop() {
    bindAvatarImgEventsOnce();

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

    if (elWeaponBonus) {
      elWeaponBonus.textContent = "";
      elWeaponBonus.title = "";
      elWeaponBonus.style.display = "none";
    }

    const xp = Math.max(0, Number(p.xp || 0));
    const xpToNext = Math.max(1, Number(p.xpToNext || 100));
    elXpFill.style.width = `${Math.max(3, clamp01(xp / xpToNext) * 100)}%`;
    elXpText.textContent = `LVL ${Number(p.level || 1)} • ${xp}/${xpToNext}`;

    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Number(p.energyMax || 10));
    elEnergyFill.style.width = `${Math.max(3, clamp01(energy / energyMax) * 100)}%`;

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

    if (elAvatarImg) {
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
    }

    const isPremium = !!(
      p.isPremium ||
      p.premium ||
      s.isPremium ||
      s.premium ||
      p.membership === "premium"
    );

    elOnlineBadge.style.display = "inline-flex";
    elPremiumBadge.style.display = isPremium ? "inline-flex" : "none";

    updateLogoSize();

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

    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", updateLogoSize, { passive: true });
  loop();
}
