import { stars } from "../assets/starsData.js";

const COOLDOWN_MS = 60 * 60 * 1000; // 1 saat

function $(sel, root = document) {
  return root.querySelector(sel);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function getStar(id) {
  return stars.find((s) => s.id === id) || null;
}

function ensureStarsState(store) {
  const s = store.get();
  if (!s.stars) {
    store.set({ stars: { owned: {}, selectedId: null, lastClaimTs: {}, twinBonusClaimed: {} } });
  } else {
    store.set({
      stars: {
        owned: s.stars.owned || {},
        selectedId: s.stars.selectedId ?? null,
        lastClaimTs: s.stars.lastClaimTs || {},
        twinBonusClaimed: s.stars.twinBonusClaimed || {},
      },
    });
  }
}

function twinCompleted(storeState, twinId) {
  const owned = storeState.stars?.owned || {};
  const twins = stars.filter((x) => x.twinId === twinId);
  if (twins.length < 2) return false;
  return twins.every((t) => !!owned[t.id]);
}

export function startStarsOverlay(store) {
  ensureStarsState(store);

  // root
  const root = document.createElement("div");
  root.id = "starsOverlay";
  root.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    z-index: 50;
    pointer-events: none;
  `;

  root.innerHTML = `
    <div id="starsOverlayBg" style="
      position:absolute; inset:0;
      background: rgba(0,0,0,.65);
      opacity: 0; transition: opacity .12s ease;
      pointer-events: auto;
    "></div>

    <div id="starsOverlayCard" style="
      position:absolute; left: 50%; top: 52%;
      transform: translate(-50%, -50%);
      width: min(420px, calc(100vw - 24px));
      background: #111;
      border: 1px solid #2a2a2a;
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,.45);
      pointer-events: auto;
      color: #fff;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    ">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div>
          <div id="soName" style="font-size:18px; font-weight:700;">-</div>
          <div id="soMeta" style="font-size:12px; opacity:.8;">-</div>
        </div>
        <button id="soClose" style="
          background:#1c1c1c; color:#fff; border:1px solid #2a2a2a;
          border-radius:10px; padding:8px 10px; cursor:pointer;
        ">X</button>
      </div>

      <div style="margin-top:12px; display:flex; gap:12px; align-items:stretch;">
        <div id="soImg" style="
          width: 120px; height: 120px;
          border-radius: 12px;
          background:#1b1b1b;
          border: 1px solid #2a2a2a;
          overflow:hidden;
          flex: 0 0 auto;
          display:flex; align-items:center; justify-content:center;
          font-size:12px; opacity:.7;
        ">IMG</div>

        <div style="flex:1; min-width:0;">
          <div style="font-size:12px; opacity:.9; margin-bottom:8px;">
            <div>Cost: <b id="soCost">-</b> coin</div>
            <div>Energy Gain: <b id="soEnergy">-</b></div>
            <div>Twin: <b id="soTwin">-</b></div>
          </div>

          <div id="soStatus" style="font-size:12px; opacity:.85; margin-top:6px;">-</div>

          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button id="soBuy" style="
              background:#1f6f2a; color:#fff; border:none;
              border-radius: 10px; padding:10px 12px; cursor:pointer;
              font-weight:700;
            ">BUY</button>

            <button id="soClaim" style="
              background:#1c1c1c; color:#fff; border:1px solid #2a2a2a;
              border-radius: 10px; padding:10px 12px; cursor:pointer;
              font-weight:700;
            ">CLAIM ENERGY</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const bg = $("#starsOverlayBg", root);
  const card = $("#starsOverlayCard", root);

  const soName = $("#soName", root);
  const soMeta = $("#soMeta", root);
  const soCost = $("#soCost", root);
  const soEnergy = $("#soEnergy", root);
  const soTwin = $("#soTwin", root);
  const soStatus = $("#soStatus", root);
  const soImg = $("#soImg", root);

  const btnClose = $("#soClose", root);
  const btnBuy = $("#soBuy", root);
  const btnClaim = $("#soClaim", root);

  let currentId = null;
  let raf = 0;

  function open(starId) {
    currentId = starId;
    root.style.display = "block";
    requestAnimationFrame(() => (bg.style.opacity = "1"));
    tickUI();
  }

  function close() {
    bg.style.opacity = "0";
    cancelAnimationFrame(raf);
    raf = 0;
    currentId = null;
    setTimeout(() => {
      root.style.display = "none";
    }, 130);
  }

  function tickUI() {
    const star = getStar(currentId);
    if (!star) {
      soStatus.textContent = "Star not found";
      return;
    }

    const s = store.get();
    const owned = s.stars?.owned || {};
    const lastClaimTs = s.stars?.lastClaimTs || {};
    const isOwned = !!owned[star.id];

    soName.textContent = star.name;
    soMeta.textContent = `${star.gender.toUpperCase()} • Coins: ${s.coins ?? 0} • Energy: ${s.player?.energy ?? 0}/${s.player?.energyMax ?? 0}`;
    soCost.textContent = String(star.coinValue);
    soEnergy.textContent = String(star.energyGain);
    soTwin.textContent = star.twinId ? star.twinId : "-";

    // image preview (Assets key)
    // (Burada gerçek img tag koymuyoruz; istersen koyarız)
    soImg.textContent = star.gender === "male" ? "MALE" : "FEMALE";

    btnBuy.disabled = isOwned;
    btnBuy.style.opacity = isOwned ? "0.5" : "1";

    // claim cooldown
    const last = Number(lastClaimTs[star.id] || 0);
    const remain = COOLDOWN_MS - (Date.now() - last);
    const canClaim = isOwned && remain <= 0;

    btnClaim.disabled = !canClaim;
    btnClaim.style.opacity = canClaim ? "1" : "0.6";

    if (!isOwned) {
      soStatus.textContent = "Not owned. Buy to unlock.";
    } else if (!canClaim) {
      soStatus.textContent = `Cooldown: ${fmtMs(remain)}`;
    } else {
      soStatus.textContent = "Ready to claim energy!";
    }

    raf = requestAnimationFrame(tickUI);
  }

  function buy() {
    const star = getStar(currentId);
    if (!star) return;

    const s = store.get();
    ensureStarsState(store);
    const ss = store.get(); // after ensure
    const owned = { ...(ss.stars?.owned || {}) };

    if (owned[star.id]) return;
    const coins = Number(ss.coins || 0);
    if (coins < star.coinValue) {
      soStatus.textContent = "Not enough coins.";
      return;
    }

    owned[star.id] = true;

    store.set({
      coins: coins - star.coinValue,
      stars: { ...(ss.stars || {}), owned, selectedId: star.id },
    });

    // twin bonus: set tamamlandıysa 1 kez +2 enerji
    const ns = store.get();
    if (star.twinId && twinCompleted(ns, star.twinId)) {
      const claimed = { ...(ns.stars?.twinBonusClaimed || {}) };
      if (!claimed[star.twinId]) {
        claimed[star.twinId] = true;

        const p = ns.player || {};
        const maxE = Math.max(1, Number(p.energyMax || 10));
        const newE = clamp(Number(p.energy || 0) + 2, 0, maxE);

        store.set({
          player: { ...p, energy: newE },
          stars: { ...(ns.stars || {}), twinBonusClaimed: claimed },
        });
      }
    }
  }

  function claim() {
    const star = getStar(currentId);
    if (!star) return;

    const s = store.get();
    ensureStarsState(store);
    const ss = store.get();

    const owned = ss.stars?.owned || {};
    if (!owned[star.id]) return;

    const lastClaimTs = { ...(ss.stars?.lastClaimTs || {}) };
    const last = Number(lastClaimTs[star.id] || 0);
    const remain = COOLDOWN_MS - (Date.now() - last);
    if (remain > 0) return;

    const p = ss.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 10));
    const newE = clamp(Number(p.energy || 0) + star.energyGain, 0, maxE);

    lastClaimTs[star.id] = Date.now();

    store.set({
      player: { ...p, energy: newE },
      stars: { ...(ss.stars || {}), lastClaimTs },
    });
  }

  btnClose.addEventListener("click", close);
  bg.addEventListener("click", close);
  btnBuy.addEventListener("click", buy);
  btnClaim.addEventListener("click", claim);

  window.addEventListener("tc:stars:open", (e) => {
    const starId = e.detail?.starId;
    if (typeof starId !== "number") return;
    open(starId);
  });

  // ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.style.display === "block") close();
  });
}