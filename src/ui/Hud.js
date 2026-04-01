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

  const elAvatarWrap = document.getElementById("hudAvatarWrap");
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
    console.warn("[HUD] gerekli HUD elementleri bulunamadi");
    return;
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clamp01 = (n) => clamp(n, 0, 1);
  const TELEGRAM_URL = "https://t.me/TonCrimeEu";

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

  function normalizeAssetName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[\u00E7]/g, "c")
      .replace(/[\u011F]/g, "g")
      .replace(/[\u0131\u0130]/g, "i")
      .replace(/[\u00F6]/g, "o")
      .replace(/[\u015F]/g, "s")
      .replace(/[\u00FC]/g, "u")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function uniq(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function makeAssetCandidates(name) {
    const raw = String(name || "").trim();
    const norm = normalizeAssetName(raw);
    const base = uniq([
      raw,
      raw.toLowerCase(),
      norm,
      norm.replace(/_+/g, "-"),
      norm.replace(/_/g, ""),
    ]);
    const out = [];
    const exts = ["png", "webp", "jpg", "jpeg"];
    for (const item of base) {
      for (const ext of exts) {
        out.push(`./src/assets/${item}.${ext}`);
        out.push(`./assets/${item}.${ext}`);
      }
    }
    return uniq(out);
  }

  function weaponAssetCandidates(player, state) {
    const equippedId = String(state?.weapons?.equippedId || "").trim();
    const weaponName = String(player?.weaponName || "").trim();
    const candidates = [];

    const aliasMap = {
      "silah_yok": ["weapon_none", "weapon-empty", "weapon_none_icon"],
      "hk_mp5_9_19mm": ["mp5", "hk_mp5"],
      "glock_17_9_19mm": ["glock_17", "glock17", "glock"],
      "sig_sauer_p320_9_19mm": ["sig_p320", "p320", "sauer"],
      "sig_p320": ["sauer"],
      "beretta_92fs_9_19mm": ["beretta_92fs", "beretta92fs", "beretta", "baretta"],
      "beretta_92fs": ["baretta"],
      "colt_1911_45_acp": ["colt_1911", "colt1911", "1911"],
      "mossberg_500_12ga": ["mossberg_500", "mossberg500"],
      "remington_870_12ga": ["rem_870", "remington_870", "rem870", "reminaton"],
      "rem_870": ["reminaton"],
      "hk_ump45_45_acp": ["ump45", "hk_ump45"],
      "ar_15_5_56_45": ["ar15", "ar_15"],
      "ak_74_5_45_39": ["ak74", "ak_74"],
      "ak_47_7_62_39": ["ak47", "ak_47"],
      "m4a1_5_56_45": ["m4a1", "m4"],
      "hk_g3_7_62_51": ["g3", "hk_g3"],
      "fn_scar_h_7_62_51": ["scar_h", "scarh", "scar"],
      "dragunov_svd_7_62_54r": ["svd", "dragunov_svd", "dragunov"],
      "remington_m24_7_62_51": ["m24", "remington_m24"],
      "m79_launcher": ["m79"],
      "rpg_7_launcher": ["rpg7", "rpg_7"],
      "barrett_m82_50_bmg": ["barrett_m82", "m82", "barrett"],
      "m134_minigun_7_62_51": ["m134", "minigun"],
    };

    if (equippedId) {
      candidates.push(...makeAssetCandidates(equippedId));
      const equippedNorm = normalizeAssetName(equippedId);
      (aliasMap[equippedNorm] || []).forEach((alias) => candidates.push(...makeAssetCandidates(alias)));
    }

    if (weaponName) {
      candidates.push(...makeAssetCandidates(weaponName));
      const norm = normalizeAssetName(weaponName);
      (aliasMap[norm] || []).forEach((alias) => candidates.push(...makeAssetCandidates(alias)));
    }

    if (!candidates.length) candidates.push(...makeAssetCandidates("weapon_none"));
    return uniq(candidates);
  }

  function applyButtonChrome(el, opts = {}) {
    const narrow = window.innerWidth <= 420;
    const mobile = window.innerWidth <= 720;
    const size = opts.size || (narrow ? 34 : (mobile ? 38 : 42));
    const width = opts.width || size;
    const radius = narrow ? 12 : (mobile ? 13 : 14);
    const paddingX = opts.paddingX || 0;
    el.style.position = "static";
    el.style.width = `${width}px`;
    el.style.minWidth = `${width}px`;
    el.style.height = `${size}px`;
    el.style.minHeight = `${size}px`;
    el.style.border = "none";
    el.style.borderRadius = `${radius}px`;
    el.style.background = "linear-gradient(180deg, rgba(255,225,160,0.34) 0%, rgba(188,121,43,0.24) 44%, rgba(71,39,17,0.62) 100%)";
    el.style.color = "#f2c56d";
    el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,210,150,0.08), 0 8px 18px rgba(0,0,0,0.20)";
    el.style.backdropFilter = "blur(14px) saturate(1.2)";
    el.style.webkitBackdropFilter = "blur(14px) saturate(1.2)";
    el.style.cursor = "pointer";
    el.style.display = "inline-flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.padding = `0 ${paddingX}px`;
    el.style.overflow = "hidden";
    el.style.flex = "0 0 auto";
    el.style.appearance = "none";
    el.style.webkitAppearance = "none";
    el.style.margin = "0";
  }

  function ensureInlineImage(spanId, targetEl, candidates, alt, size = 15) {
    if (!targetEl?.parentElement) return null;
    let img = document.getElementById(spanId);
    if (!img) {
      img = document.createElement("img");
      img.id = spanId;
      img.alt = alt || "";
      img.decoding = "async";
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.objectFit = "contain";
      img.style.display = "inline-block";
      img.style.verticalAlign = "middle";
      img.style.marginRight = "6px";
      img.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.45))";
      targetEl.parentElement.insertBefore(img, targetEl);
    }

    const sources = uniq(candidates);
    const key = sources.join("|");
    if (img.dataset.key === key) return img;
    img.dataset.key = key;
    img.dataset.idx = "0";

    img.onerror = () => {
      const idx = Number(img.dataset.idx || 0) + 1;
      if (idx >= sources.length) {
        img.style.display = "none";
        return;
      }
      img.dataset.idx = String(idx);
      img.src = sources[idx];
    };
    img.onload = () => {
      img.style.display = "inline-block";
    };

    if (sources[0]) {
      img.style.display = "inline-block";
      img.src = sources[0];
    } else {
      img.style.display = "none";
    }
    return img;
  }

  let walletBtn = document.getElementById("hudWalletBtn");
  let langBtn = document.getElementById("hudLangBtn");
  let telegramBtn = document.getElementById("hudTelegramBtn");
  let premiumBtn = document.getElementById("hudPremiumBtn");
  let buttonTray = document.getElementById("hudActionTray");

  if (!buttonTray) {
    buttonTray = document.createElement("div");
    buttonTray.id = "hudActionTray";
    root.appendChild(buttonTray);
  }

  if (!telegramBtn) {
    telegramBtn = document.createElement("button");
    telegramBtn.id = "hudTelegramBtn";
    telegramBtn.type = "button";
    telegramBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <defs>
          <linearGradient id="tcTgGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f7d389"/>
            <stop offset="100%" stop-color="#d89a4a"/>
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="rgba(9,12,18,0.22)"/>
        <path fill="url(#tcTgGrad)" d="M18.32 6.38 5.75 11.23c-.86.34-.85.82-.15 1.03l3.22 1 1.24 3.98c.16.46.08.64.58.64.39 0 .56-.18.78-.4l1.57-1.53 3.27 2.41c.6.33 1.03.16 1.18-.56l2.27-10.73c.2-.89-.31-1.29-1.39-.69Zm-1.87 2.12-6.17 5.56-.24 2.34-.86-2.8 7.27-4.93c.32-.23.06-.36-.24-.17Z"/>
      </svg>`;
    buttonTray.appendChild(telegramBtn);
  }

  if (!langBtn) {
    langBtn = document.createElement("button");
    langBtn.id = "hudLangBtn";
    langBtn.type = "button";
    buttonTray.appendChild(langBtn);
  }

  if (!walletBtn) {
    walletBtn = document.createElement("button");
    walletBtn.id = "hudWalletBtn";
    walletBtn.type = "button";
    walletBtn.setAttribute("aria-label", "Wallet");
    walletBtn.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 1 1 0 2H6.5a.5.5 0 0 0 0 1H19a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Zm12.75 5.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"/></svg>`;
    buttonTray.appendChild(walletBtn);
  } else if (walletBtn.parentElement !== buttonTray) {
    buttonTray.appendChild(walletBtn);
  }

  if (!premiumBtn) {
    premiumBtn = document.createElement("button");
    premiumBtn.id = "hudPremiumBtn";
    premiumBtn.type = "button";
    premiumBtn.textContent = "PREMIUM";
    root.appendChild(premiumBtn);
  } else if (premiumBtn.parentElement !== root) {
    root.appendChild(premiumBtn);
  }

  [telegramBtn, walletBtn, langBtn].forEach((btn) => {
    if (btn) buttonTray.appendChild(btn);
  });

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
    try {
      const tg = window.Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(TELEGRAM_URL);
        return;
      }
    } catch (_) {}
    try {
      window.open(TELEGRAM_URL, "_blank", "noopener,noreferrer");
    } catch (_) {
      window.location.href = TELEGRAM_URL;
    }
  }

  function openTradePremium() {
    try {
      const s = store.get() || {};
      store.set({
        trade: {
          ...(s.trade || {}),
          activeTab: "premium",
          view: "main",
          selectedShopId: null,
          selectedBusinessId: null,
        },
      });
    } catch (_) {}

    try {
      const scenes = window.tcScenes;
      if (scenes && typeof scenes.go === "function") {
        scenes.go("trade");
      }
    } catch (_) {}
  }

  function updateDynamicLabels() {
    const lang = i18n?.getLang?.() || store.get?.()?.lang || "tr";

    if (walletBtn) {
      const walletLabel = i18n?.t?.("hud.wallet", "Wallet") || "Wallet";
      walletBtn.title = walletLabel;
      walletBtn.setAttribute("aria-label", walletLabel);
    }

    if (telegramBtn) {
      telegramBtn.title = "Telegram";
      telegramBtn.setAttribute("aria-label", "Telegram");
    }

    if (elAvatar) {
      elAvatar.title = "Profile";
    }

    if (langBtn) {
      langBtn.title = i18n?.t?.("lang.switchTo", lang === "tr" ? "English" : "Turkce") || "Language";
      langBtn.setAttribute("aria-label", i18n?.t?.("hud.language", "Dil") || "Dil");
      langBtn.textContent = lang === "tr" ? "EN" : "TR";
      langBtn.style.font = `${window.innerWidth <= 420 ? 700 : 800} ${window.innerWidth <= 420 ? 10 : 11}px system-ui`;
      langBtn.style.letterSpacing = "0.3px";
    }

    if (premiumBtn) {
      premiumBtn.title = lang === "tr" ? "Premium avantajlari" : "Premium benefits";
      premiumBtn.setAttribute("aria-label", premiumBtn.title);
      premiumBtn.textContent = "PREMIUM";
      premiumBtn.style.font = `${window.innerWidth <= 420 ? 900 : 800} ${window.innerWidth <= 420 ? 9 : 10}px system-ui`;
      premiumBtn.style.letterSpacing = "0.7px";
    }
  }

  function bindAvatarOpenOnce() {
    const avatarTapTarget = elAvatarWrap || elAvatar;
    if (!avatarTapTarget || avatarTapTarget.__profileWrapBound) return;

    avatarTapTarget.__profileWrapBound = true;
    avatarTapTarget.style.cursor = "pointer";
    avatarTapTarget.title = "Profile";
    avatarTapTarget.tabIndex = 0;
    avatarTapTarget.setAttribute("role", "button");
    avatarTapTarget.setAttribute("aria-label", "Profile");
    avatarTapTarget.addEventListener("click", () => openProfile("profile"));
    avatarTapTarget.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProfile("profile");
      }
    });
    avatarTapTarget.addEventListener("pointerdown", (e) => e.stopPropagation());
    if (elOnlineBadge) elOnlineBadge.style.pointerEvents = "none";
    if (elPremiumBadge) elPremiumBadge.style.pointerEvents = "none";
  }

  function bindClicksOnce() {
    if (!elAvatar.__profileBound) {
      elAvatar.__profileBound = true;
      elAvatar.style.cursor = "pointer";
      elAvatar.title = "Profile";
      elAvatar.addEventListener("click", () => openProfile("profile"));
      elAvatar.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    if (!walletBtn.__walletBound) {
      walletBtn.__walletBound = true;
      walletBtn.addEventListener("click", () => openProfile("wallet"));
      walletBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    }

    if (!telegramBtn.__telegramBound) {
      telegramBtn.__telegramBound = true;
      telegramBtn.addEventListener("click", openTelegram);
      telegramBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
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

    if (!premiumBtn.__premiumBound) {
      premiumBtn.__premiumBound = true;
      premiumBtn.addEventListener("click", openTradePremium);
      premiumBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
  }

  function applyButtonsStyle() {
    const narrow = window.innerWidth <= 420;
    const mobile = window.innerWidth <= 720;
    const size = narrow ? 34 : (mobile ? 38 : 42);
    const gap = narrow ? 6 : 8;
    const trayOffset = narrow ? 4 : 6;

    if (buttonTray) {
      buttonTray.style.position = "absolute";
      buttonTray.style.right = `${narrow ? 8 : 10}px`;
      buttonTray.style.top = `calc(100% + ${trayOffset}px)`;
      buttonTray.style.display = "inline-flex";
      buttonTray.style.flexDirection = "row";
      buttonTray.style.alignItems = "center";
      buttonTray.style.justifyContent = "center";
      buttonTray.style.gap = `${gap}px`;
      buttonTray.style.padding = "0";
      buttonTray.style.borderRadius = "0";
      buttonTray.style.border = "none";
      buttonTray.style.background = "transparent";
      buttonTray.style.boxShadow = "none";
      buttonTray.style.backdropFilter = "none";
      buttonTray.style.webkitBackdropFilter = "none";
      buttonTray.style.zIndex = "2";
      buttonTray.style.minHeight = `${size}px`;
    }

    applyButtonChrome(walletBtn, { size });
    applyButtonChrome(telegramBtn, { size });
    applyButtonChrome(langBtn, { size });
    applyButtonChrome(premiumBtn, {
      size,
      width: narrow ? 78 : (mobile ? 86 : 96),
      paddingX: narrow ? 10 : 12,
    });
    walletBtn.style.font = "inherit";
    walletBtn.style.lineHeight = "1";
    if (premiumBtn) {
      premiumBtn.style.position = "absolute";
      premiumBtn.style.left = `${narrow ? 4 : 8}px`;
      premiumBtn.style.top = `calc(100% + ${trayOffset}px)`;
      premiumBtn.style.zIndex = "2";
      premiumBtn.style.background = "linear-gradient(180deg, rgba(255,235,160,0.92) 0%, rgba(255,191,74,0.94) 36%, rgba(142,64,16,0.96) 100%)";
      premiumBtn.style.color = "#2a1204";
      premiumBtn.style.textShadow = "0 1px 0 rgba(255,255,255,0.28)";
      premiumBtn.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(96,36,8,0.32), 0 10px 18px rgba(255,156,61,0.28)";
    }
  }

  root.style.zIndex = "5000";
  root.style.opacity = "1";
  root.style.pointerEvents = "auto";
  root.style.left = "max(var(--sal), 0px)";
  root.style.right = "max(var(--sar), 0px)";
  root.style.top = "max(var(--sat), 0px)";

  let lastReservedTop = 0;
  let lastAvatarUrl = "";

  function hideDefaultMiniIcons() {
    try {
      const coinIcon = elCoins?.previousElementSibling;
      const weaponIcon = elWeaponName?.previousElementSibling;
      if (coinIcon?.classList?.contains("hudMiniIcon")) coinIcon.style.display = "none";
      if (weaponIcon?.classList?.contains("hudMiniIcon")) weaponIcon.style.display = "none";
    } catch (_) {}
  }

  function updateHud() {
    bindAvatarImgEventsOnce();
    bindAvatarOpenOnce();
    bindClicksOnce();
    applyButtonsStyle();
    updateDynamicLabels();
    hideDefaultMiniIcons();

    const s = store.get() || {};
    const p = s.player || {};
    const ui = s.ui || {};

    const username = String(p.username || "Player").trim() || "Player";
    elUsername.textContent = username;
    elUsername.title = username;

    const yton = Number(s.coins ?? p.coins ?? 0);
    elCoins.textContent = `YTON ${Number.isFinite(yton) ? yton.toLocaleString("tr-TR") : "0"}`;
    ensureInlineImage("hudCoinsAssetImg", elCoins, makeAssetCandidates("yton"), "YTON", 15);

    const weaponName = String(p.weaponName || "Silah Yok").trim() || "Silah Yok";
    elWeaponName.textContent = weaponName;
    elWeaponName.title = weaponName;
    ensureInlineImage("hudWeaponAssetImg", elWeaponName, weaponAssetCandidates(p, s), weaponName, 15);

    elWeaponBonus.textContent = "";
    elWeaponBonus.title = "";
    elWeaponBonus.style.display = "none";

    const level = Math.max(0, Number(p.level ?? 0));
    const xp = Math.max(0, Number(p.xp || 0));
    const starterTrack = level === 0 && xp <= 0 && Number(p.xpToNext || 0) <= 0;
    const xpToNext = starterTrack ? 0 : Math.max(1, Number(p.xpToNext || 100));
    const xpPct = xpToNext > 0 ? Math.max(3, clamp01(xp / xpToNext) * 100) : 0;
    elXpFill.style.width = `${xpPct}%`;
    elXpText.textContent = `LVL ${level} - ${xp}/${xpToNext}`;

    const energy = Math.max(0, Number(p.energy || 0));
    const energyMax = Math.max(1, Math.min(100, Number(p.energyMax || 100)));
    const energyPct = Math.max(3, clamp01(energy / energyMax) * 100);
    elEnergyFill.style.width = `${energyPct}%`;

    elEnergyText.textContent =
      energy >= energyMax
        ? `ENERGY ${energy}/${energyMax} - FULL`
        : `ENERGY ${energy}/${energyMax} - DAILY RESET`;

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

    if (premiumBtn) {
      const pulse = (Math.sin(Date.now() / 210) + 1) / 2;
      premiumBtn.style.display = isPremium ? "none" : "inline-flex";
      premiumBtn.style.opacity = isPremium ? "0" : String(0.82 + pulse * 0.18);
      premiumBtn.style.transform = isPremium ? "translateY(0)" : `translateY(${Math.sin(Date.now() / 420) * -1.4}px) scale(${1 + pulse * 0.035})`;
      premiumBtn.style.filter = isPremium ? "none" : `drop-shadow(0 0 ${8 + pulse * 9}px rgba(255,208,110,${0.28 + pulse * 0.32}))`;
    }

    if (elLogo) elLogo.style.display = "none";
    if (elCenter) elCenter.style.display = "none";

    const safeTop = Number(ui.safe?.y || 0);
    const trayHeight = buttonTray ? buttonTray.offsetHeight + 8 : 0;
    const premiumHeight = premiumBtn && premiumBtn.style.display !== "none" ? premiumBtn.offsetHeight + 8 : 0;
    const reservedTop = Math.max(72, root.offsetHeight + Math.max(trayHeight, premiumHeight) + safeTop + 6);

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
 


