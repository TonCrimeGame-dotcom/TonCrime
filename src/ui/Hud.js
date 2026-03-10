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
    !elEnergyText
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

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  function fmtMMSS(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function syncHudCss() {
    const vw = window.innerWidth || 0;

    if (vw <= 640) {
      row.style.gridTemplateColumns = "1fr";
      row.style.gap = "8px";
      root.style.padding = "10px 10px 0";
      if (elLogo) {
        elLogo.style.height = "44px";
        elLogo.style.margin = "0 auto";
      }
    } else {
      row.style.gridTemplateColumns = "1fr auto 1fr";
      row.style.gap = "10px";
      root.style.padding = "10px 12px 0";
      if (elLogo) {
        elLogo.style.height = "64px";
        elLogo.style.margin = "0";
      }
    }
  }

  function loop() {
    syncHudCss();

    const s = store.get();
    const p = s.player || {};
    const ui = s.ui || {};

    elUsername.textContent = p.username ?? "Player";
    elCoins.textContent = `Coin: ${s.coins ?? 0}`;
    elWeaponName.textContent = p.weaponName ?? "Silah Yok";
    elWeaponBonus.textContent = ` ${p.weaponBonus ?? "+0%"}`;

    const xp = Math.max(0, Number(p.xp || 0));
    const xpToNext = Math.max(1, Number(p.xpToNext || 100));
    elXpFill.style.width = `${Math.max(2, clamp01(xp / xpToNext) * 100)}%`;
    elXpText.textContent = `LVL ${p.level ?? 1} • XP ${xp}/${xpToNext}`;

    const e = Math.max(0, Number(p.energy || 0));
    const eMax = Math.max(1, Number(p.energyMax || 10));
    elEnergyFill.style.width = `${Math.max(2, clamp01(e / eMax) * 100)}%`;

    const interval = Math.max(10_000, Number(p.energyIntervalMs || 300000));
    const lastAt = Number(p.lastEnergyAt || Date.now());
    const now = Date.now();
    const untilNext = e >= eMax ? 0 : Math.max(0, interval - (now - lastAt));
    elEnergyText.textContent = `ENERJİ ${e}/${eMax} • ${e >= eMax ? "FULL" : fmtMMSS(untilNext)}`;

    const safeTop = Number(ui.safe?.y || 0);
    const reservedTop = Math.max(root.offsetHeight + safeTop + 8, 110);

    if (
      Number(ui.hudReservedTop || 0) !== reservedTop
    ) {
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
