import { supabase } from "./supabase.js";

(function () {
  let selectedMode = "cage";
  let searching = false;
  let opponentData = null;

  const MATCH_TIME = 10000;
  const FOUND_DELAY = 3000;

  function createFakeOpponent() {
    const names = ["ShadowWolf", "NightViper", "IronClaw", "GhostX"];
    return {
      name: names[Math.floor(Math.random() * names.length)],
      level: Math.floor(Math.random() * 10) + 45,
    };
  }

  function startMatchmaking(mode) {
    selectedMode = mode;
    searching = true;
    opponentData = null;

    showMatchUI();
    searchRealPlayer();
  }

  function searchRealPlayer() {
    setTimeout(() => {
      if (!searching) return;

      if (Math.random() < 0.3) {
        opponentFound({
          name: "RealPlayer",
          level: Math.floor(Math.random() * 10) + 45,
        });
      }
    }, 3000);

    setTimeout(() => {
      if (!searching) return;
      opponentFound(createFakeOpponent());
    }, MATCH_TIME);
  }

  function opponentFound(data) {
    searching = false;
    opponentData = data;

    updateFoundUI(data);

    setTimeout(() => {
      startGame();
    }, FOUND_DELAY);
  }

  function startGame() {
    const layer = document.getElementById("pvpLayer");
    if (layer) layer.innerHTML = "";

    window.dispatchEvent(
      new CustomEvent("tc:startMatch", {
        detail: {
          mode: selectedMode,
          opponent: opponentData,
        },
      })
    );
  }

  // UI

  function showMatchUI() {
    const layer = document.getElementById("pvpLayer");
    if (!layer) return;

    layer.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:9999;
      ">
        <div style="
          width:90%;
          max-width:420px;
          padding:24px;
          border-radius:20px;
          background:rgba(10,10,20,0.75);
          backdrop-filter: blur(20px);
          text-align:center;
          color:white;
        ">
          <h2 style="margin-bottom:10px;">Rakip aranıyor</h2>
          <div id="matchStatus">Eşleşme hazırlanıyor...</div>

          <div style="
            margin-top:20px;
            height:6px;
            border-radius:6px;
            background:linear-gradient(90deg,#444,#ffd166,#444);
            background-size:200% 100%;
            animation: loading 1s infinite linear;
          "></div>
        </div>
      </div>
    `;

    injectAnim();
  }

  function updateFoundUI(data) {
    const el = document.getElementById("matchStatus");
    if (!el) return;

    el.innerHTML = `
      <div style="font-size:18px; margin-top:10px;">
        ${data.name} • Lv.${data.level}
      </div>
      <div style="opacity:0.7; margin-top:6px;">
        Maç başlıyor...
      </div>
    `;
  }

  function injectAnim() {
    if (document.getElementById("pvpAnim")) return;

    const style = document.createElement("style");
    style.id = "pvpAnim";
    style.innerHTML = `
      @keyframes loading {
        0% { background-position:0% }
        100% { background-position:200% }
      }
    `;
    document.head.appendChild(style);
  }

  // HOOK
  window.addEventListener("tc:openPvp", () => {
    startMatchmaking("cage");
  });

})();
