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
      .replace(/[ç]/g, "c")
      .replace(/[ğ]/g, "g")
      .replace(/[ıİ]/g, "i")
      .replace(/[ö]/g, "o")
      .replace(/[ş]/g, "s")
      .replace(/[ü]/g, "u")
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

    if (equippedId) candidates.push(...makeAssetCandidates(equippedId));

    const aliasMap = {
      "silah_yok": ["weapon_none", "weapon-empty", "weapon_none_icon"],
      "hk_mp5_9_19mm": ["mp5", "hk_mp5"],
      "glock_17_9_19mm": ["glock_17", "glock17", "glock"],
      "sig_sauer_p320_9_19mm": ["sig_p320", "p320"],
      "beretta_92fs_9_19mm": ["beretta_92fs", "beretta92fs", "beretta"],
      "colt_1911_45_acp": ["colt_1911", "colt1911", "1911"],
      "mossberg_500_12ga": ["mossberg_500", "mossberg500"],
      "remington_870_12ga": ["rem_870", "remington_870", "rem870"],
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
    const radius = narrow ? 12 : (mobile ? 13 : 14);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.border = "1px solid rgba(255,235,205,0.15)";
    el.style.borderRadius = `${radius}px`;
    el.style.background = "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,220,170,0.10) 22%, rgba(29,34,43,0.92) 100%)";
    el.style.backdropFilter = "blur(12px) saturate(1.08)";
    el.style.webkitBackdropFilter = "blur(12px) saturate(1.08)";
    el.style.color = "rgba(255,248,236,0.98)";
    el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,200,120,0.05), 0 8px 18px rgba(0,0,0,0.22)";
    el.style.cursor = "pointer";
    el.style.display = "inline-flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.padding = "0";
    el.style.overflow = "hidden";
    el.style.flex = "0 0 auto";
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
            <stop offset="0%" stop-color="#ffe0a4"/>
            <stop offset="100%" stop-color="#d79b43"/>
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="9.5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,231,197,0.18)"/>
        <path fill="url(#tcTgGrad)" d="M17.92 7.08c.4-.16.78.18.68.61l-1.95 8.78c-.12.55-.74.77-1.17.43l-2.72-2.13-1.37 1.32c-.4.38-1.06.17-1.16-.37l-.75-3.09-2.42-.9c-.56-.21-.58-.99-.03-1.23l10.89-3.42Z"/>
        <path fill="rgba(39,21,6,0.55)" d="m10.38 13.08 4.86-4.02c.29-.24.02-.41-.31-.2l-5.95 3.59.64 2.58.76-1.95Z"/>
      </svg>`;
    buttonTray.appendChild(telegramBtn);
  }

  if (!langBtn) {
    langBtn = document.createElement("button");
    langBtn.id = "hudLangBtn";
    langBtn.type = "button";
    langBtn.textContent = "EN";
    langBtn.setAttribute("aria-label", "Dil");
    buttonTray.appendChild(langBtn);
  }

  if (!walletBtn) {
    walletBtn = document.createElement("button");
    walletBtn.id = "hudWalletBtn";
    walletBtn.type = "button";
    walletBtn.setAttribute("aria-label", "Cüzdan");
    walletBtn.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 1 1 0 2H6.5a.5.5 0 0 0 0 1H19a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-9Zm12.75 5.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"/></svg>`;
    buttonTray.appendChild(walletBtn);
  } else if (walletBtn.parentElement !== buttonTray) {
    buttonTray.appendChild(walletBtn);
  }

  if (buttonTray) {
    [telegramBtn, langBtn, walletBtn].forEach((btn) => {
      if (btn && btn.parentElement !== buttonTray) buttonTray.appendChild(btn);
    });
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

  function updateDynamicLabels() {
    const lang = i18n?.getLang?.() || store.get?.()?.lang || "tr";

    if (walletBtn) {
      const walletLabel = i18n?.t?.("hud.wallet", "Cüzdan") || "Cüzdan";
      walletBtn.title = walletLabel;
      walletBtn.setAttribute("aria-label", walletLabel);
    }

    if (telegramBtn) {
      telegramBtn.title = "Telegram";
      telegramBtn.setAttribute("aria-label", "Telegram");
    }

    if (elAvatar) {
      elAvatar.title = i18n?.t?.("hud.openProfile", "Profili Aç") || "Profili Aç";
    }

    if (langBtn) {
      langBtn.title = i18n?.t?.("lang.switchTo", lang === "tr" ? "English" : "Türkçe") || "Language";
      langBtn.setAttribute("aria-label", i18n?.t?.("hud.language", "Dil") || "Dil");
      langBtn.textContent = lang === "tr" ? "EN" : "TR";
      langBtn.style.font = `${window.innerWidth <= 420 ? 800 : 900} ${window.innerWidth <= 420 ? 10 : 11}px system-ui`;
      langBtn.style.letterSpacing = "0.3px";
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
  }

  function applyButtonsStyle() {
    const narrow = window.innerWidth <= 420;
    const mobile = window.innerWidth <= 720;
    const size = narrow ? 34 : (mobile ? 38 : 42);
    const gap = narrow ? 6 : 8;

    if (buttonTray) {
      buttonTray.style.position = "absolute";
      buttonTray.style.right = `${narrow ? 8 : 12}px`;
      buttonTray.style.top = `${narrow ? 12 : 14}px`;
      buttonTray.style.display = "inline-flex";
      buttonTray.style.flexDirection = "row";
      buttonTray.style.alignItems = "center";
      buttonTray.style.justifyContent = "center";
      buttonTray.style.flexWrap = "nowrap";
      buttonTray.style.gap = `${gap}px`;
      buttonTray.style.padding = `${narrow ? 7 : 9}px`;
      buttonTray.style.borderRadius = `${narrow ? 18 : 20}px`;
      buttonTray.style.border = "1px solid rgba(255,235,205,0.16)";
      buttonTray.style.background = "linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,228,186,0.09) 18%, rgba(31,36,45,0.94) 100%)";
      buttonTray.style.backdropFilter = "blur(14px) saturate(1.06)";
      buttonTray.style.webkitBackdropFilter = "blur(14px) saturate(1.06)";
      buttonTray.style.boxShadow = "0 14px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(255,186,102,0.05)";
      buttonTray.style.zIndex = "6";
      buttonTray.style.minHeight = `${size + (narrow ? 14 : 18)}px`;
      buttonTray.style.pointerEvents = "auto";
    }

    applyButtonChrome(telegramBtn, { size });
    telegramBtn.style.color = "#e7be77";

    applyButtonChrome(langBtn, { size });

    applyButtonChrome(walletBtn, { size });
    walletBtn.style.color = "rgba(255,222,175,0.96)";
    walletBtn.style.font = "inherit";
    walletBtn.style.lineHeight = "1";
  }

  root.style.zIndex = "5000";
  root.style.opacity = "1";
  root.style.pointerEvents = "auto";
  root.style.left = "max(var(--sal), 0px)";
  root.style.right = "max(var(--sar), 0px)";
  root.style.top = "max(var(--sat), 0px)";
  root.style.overflow = "visible";

  let lastReservedTop = 0;
  let lastAvatarUrl = "";

  function hideDefaultMiniIcons() {
    try {
      const direct = [elCoins?.previousElementSibling, elWeaponName?.previousElementSibling];
      direct.forEach((el) => {
        if (!el) return;
        if (el.classList?.contains("hudMiniIcon") || /^[Y⚔💰🔫]$/.test(String(el.textContent || "").trim())) {
          el.style.display = "none";
          el.style.width = "0";
          el.style.margin = "0";
          el.style.padding = "0";
        }
      });

      root.querySelectorAll?.(".hudMiniIcon, [data-hud-mini-icon]").forEach((el) => {
        if (!el || el === document.getElementById("hudCoinsAssetImg") || el === document.getElementById("hudWeaponAssetImg")) return;
        const txt = String(el.textContent || "").trim();
        if (!txt || /^[Y⚔💰🔫]$/.test(txt) || el.classList.contains("hudMiniIcon")) {
          el.style.display = "none";
          el.style.width = "0";
          el.style.margin = "0";
          el.style.padding = "0";
        }
      });
    } catch (_) {}
  }

  function updateHud() {
    bindAvatarImgEventsOnce();
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

    if (elLogo) elLogo.style.display = "none";
    if (elCenter) elCenter.style.display = "none";

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
