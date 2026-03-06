export function startHud(store) {
  const elUsername = document.getElementById("hudUsername");
  const elCoins = document.getElementById("hudCoins");
  const elWeaponName = document.getElementById("hudWeaponName");
  const elWeaponBonus = document.getElementById("hudWeaponBonus");
  const elXpFill = document.getElementById("hudXpFill");
  const elXpText = document.getElementById("hudXpText");
  const elEnergyFill = document.getElementById("hudEnergyFill");
  const elEnergyText = document.getElementById("hudEnergyText");

  if (
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

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  function fmtMMSS(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function loop() {
    const s = store.get();
    const p = s.player || {};

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

    requestAnimationFrame(loop);
  }

  loop();
      }
