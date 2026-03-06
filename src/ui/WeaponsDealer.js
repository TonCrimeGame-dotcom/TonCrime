const WEAPONS = [
  // Not: fiyatlar “gerçeğe yakın oran” hissi verecek şekilde; oyunda coin birimi.
  // Bonus: icon görünme süresi uzatma yüzdesi (energy yok).

  { id: "glock_17", name: "Glock 17 (9×19mm)", bonusPct: 18, price: 520 },
  { id: "sig_p320", name: "SIG Sauer P320 (9×19mm)", bonusPct: 20, price: 650 },
  { id: "beretta_92", name: "Beretta 92FS (9×19mm)", bonusPct: 19, price: 640 },
  { id: "colt_1911", name: "Colt 1911 (.45 ACP)", bonusPct: 22, price: 820 },

  { id: "mp5", name: "HK MP5 (9×19mm)", bonusPct: 28, price: 1700 },
  { id: "ump45", name: "HK UMP45 (.45 ACP)", bonusPct: 27, price: 1550 },

  { id: "mossberg_500", name: "Mossberg 500 (12ga)", bonusPct: 25, price: 480 },
  { id: "rem_870", name: "Remington 870 (12ga)", bonusPct: 26, price: 520 },

  { id: "ak47", name: "AK-47 (7.62×39)", bonusPct: 35, price: 1200 },
  { id: "ak74", name: "AK-74 (5.45×39)", bonusPct: 33, price: 1100 },
  { id: "ar15", name: "AR-15 (5.56×45)", bonusPct: 31, price: 980 },
  { id: "m4a1", name: "M4A1 (5.56×45)", bonusPct: 34, price: 1450 },

  { id: "scar_h", name: "FN SCAR-H (7.62×51)", bonusPct: 40, price: 2800 },
  { id: "g3", name: "HK G3 (7.62×51)", bonusPct: 38, price: 1600 },

  { id: "dragunov", name: "Dragunov SVD (7.62×54R)", bonusPct: 44, price: 2100 },
  { id: "m24", name: "Remington M24 (7.62×51)", bonusPct: 43, price: 2400 },

  { id: "rpg7", name: "RPG-7 (Launcher)", bonusPct: 55, price: 4500 },
  { id: "m79", name: "M79 (Launcher)", bonusPct: 50, price: 3800 },

  { id: "minigun", name: "M134 Minigun (7.62×51)", bonusPct: 70, price: 12000 },
  { id: "barrett_m82", name: "Barrett M82 (.50 BMG)", bonusPct: 60, price: 9000 },
];

function fmtPct(p) {
  return `%${p}`;
}
function msFromPct(pct, baseMs = 500) {
  return Math.round(baseMs * (1 + pct / 100));
}

export function startWeaponsDealer({ store, i18n }) {
  // Panel
  const el = document.createElement("div");
  el.id = "weaponsDealer";
  el.style.cssText = `
    position: fixed;
    left: 0; top: 0;
    width: 100vw; height: 100vh;
    z-index: 9998;
    display: none;
    pointer-events: auto;
  `;

  // İç kart/panel
  el.innerHTML = `
    <div id="wdCard" style="
      position:absolute;
      left: 50%; top: 50%;
      transform: translate(-50%,-50%);
      width: min(92vw, 420px);
      height: min(78vh, 720px);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.72);
      backdrop-filter: blur(8px);
      box-shadow: 0 14px 40px rgba(0,0,0,0.45);
      overflow: hidden;
      display:flex;
      flex-direction:column;
    ">
      <div style="
        padding: 12px 14px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        border-bottom: 1px solid rgba(255,255,255,0.10);
      ">
        <div>
          <div style="font-weight:900; font-size:14px; color:rgba(255,255,255,0.92);">Silah Kaçakçısı</div>
          <div style="font-size:12px; color:rgba(255,255,255,0.70);">Bonus: ikon süresi uzar • Energy yok</div>
        </div>
        <button id="wdClose" style="
          appearance:none;
          border:1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.9);
          border-radius: 12px;
          height: 34px;
          padding: 0 12px;
          font-weight: 900;
          cursor:pointer;
        ">Kapat</button>
      </div>

      <div id="wdTop" style="padding: 10px 14px; display:flex; gap:10px; align-items:center;">
        <div style="flex:1; font-size:12px; color:rgba(255,255,255,0.8);">
          Seçili silah PvP ikonunu daha uzun gösterir.
        </div>
        <div id="wdCoins" style="
          font-size:12px;
          font-weight:900;
          color: rgba(255,255,255,0.9);
          border:1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.35);
          border-radius: 12px;
          padding: 7px 10px;
        ">0 coin</div>
      </div>

      <div id="wdList" style="
        flex:1;
        overflow:auto;
        padding: 0 10px 12px 10px;
      "></div>

      <div style="
        padding: 10px 14px;
        border-top: 1px solid rgba(255,255,255,0.10);
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap: 10px;
      ">
        <div id="wdEquipped" style="font-size:12px; color:rgba(255,255,255,0.75);">
          Seçili: -
        </div>
        <button id="wdUnequip" style="
          appearance:none;
          border:1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.9);
          border-radius: 12px;
          height: 34px;
          padding: 0 12px;
          font-weight: 900;
          cursor:pointer;
        ">Silahı Çıkar</button>
      </div>
    </div>
  `;

  document.body.appendChild(el);

  function ensureState() {
    const s = store.get();
    if (!s.weapons) {
      store.set({ weapons: { owned: {}, equippedId: null } });
    }
  }

  function getCoins(s) {
    // Proje standardına göre: state.coins
    return Number(s.coins || 0);
  }

  function setCoins(next) {
    store.set({ coins: Math.max(0, Math.floor(next)) });
  }

  function render() {
    ensureState();
    const s = store.get();
    const w = s.weapons || { owned: {}, equippedId: null };
    const coins = getCoins(s);

    const wdCoins = el.querySelector("#wdCoins");
    const wdList = el.querySelector("#wdList");
    const wdEquipped = el.querySelector("#wdEquipped");

    wdCoins.textContent = `${coins} coin`;

    const eq = WEAPONS.find(x => x.id === w.equippedId);
    wdEquipped.textContent = eq ? `Seçili: ${eq.name} ( +${fmtPct(eq.bonusPct)} )` : "Seçili: -";

    wdList.innerHTML = WEAPONS.map(item => {
      const owned = !!w.owned?.[item.id];
      const equipped = w.equippedId === item.id;

      const ms = msFromPct(item.bonusPct, 500);

      const actionLabel = owned ? (equipped ? "Seçili" : "Tak") : "Satın Al";
      const disabled = owned && equipped;

      return `
        <div style="
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.30);
          border-radius: 14px;
          padding: 10px 10px;
          margin: 10px 4px 0 4px;
          display:flex;
          gap: 10px;
          align-items:center;
        ">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:900; font-size:13px; color:rgba(255,255,255,0.92); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${item.name}
            </div>
            <div style="font-size:12px; color:rgba(255,255,255,0.72); margin-top:4px;">
              Güç: +${fmtPct(item.bonusPct)} (ikon: ~${ms}ms)
              • Fiyat: <span style="font-weight:900; color:rgba(255,255,255,0.9)">${item.price}</span> coin
            </div>
          </div>

          <button
            data-wd-action="${item.id}"
            style="
              appearance:none;
              border:1px solid rgba(255,255,255,0.16);
              background: ${owned ? "rgba(255,255,255,0.08)" : "rgba(242,211,107,0.18)"};
              color: rgba(255,255,255,0.92);
              border-radius: 12px;
              height: 34px;
              padding: 0 12px;
              font-weight: 900;
              cursor:pointer;
              opacity: ${disabled ? 0.55 : 1};
            "
            ${disabled ? "disabled" : ""}
          >${actionLabel}</button>
        </div>
      `;
    }).join("");
  }

  function open() {
    ensureState();
    el.style.display = "block";
    render();
  }

  function close() {
    el.style.display = "none";
  }

  el.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.id === "wdClose") close();

    if (t.id === "wdUnequip") {
      const s = store.get();
      ensureState();
      store.set({ weapons: { ...(s.weapons || {}), equippedId: null } });
      render();
    }

    const id = t.getAttribute("data-wd-action");
    if (!id) return;

    ensureState();
    const s = store.get();
    const w = s.weapons || { owned: {}, equippedId: null };
    const item = WEAPONS.find(x => x.id === id);
    if (!item) return;

    const coins = getCoins(s);

    const owned = !!w.owned?.[id];
    if (!owned) {
      if (coins < item.price) {
        // basit toast/alert
        window.dispatchEvent(new CustomEvent("tc:toast", { detail: { text: "Yetersiz coin." } }));
        return;
      }
      setCoins(coins - item.price);
      store.set({
        weapons: {
          owned: { ...(w.owned || {}), [id]: true },
          equippedId: id,
        },
      });
      render();
      return;
    }

    // owned: equip
    store.set({
      weapons: {
        owned: { ...(w.owned || {}) },
        equippedId: id,
      },
    });
    render();
  });

  // dışarıdan kontrol
  return { open, close, render, WEAPONS };
}