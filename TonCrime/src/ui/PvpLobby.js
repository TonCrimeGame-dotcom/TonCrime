// src/ui/PvpLobby.js

export function startPvpLobby(){

  const status = document.getElementById("pvpStatus");

  const btnAd = document.getElementById("pvpAdBtn");
  const btnCoin = document.getElementById("pvpCoinBtn");

  function setStatus(t){
    if(status) status.textContent = "PvP • " + t;
  }

  function findOpponent(){

    setStatus("Rakip aranıyor...");

    const delay = 2000 + Math.random()*2000;

    setTimeout(()=>{

      const bots = [
        "ShadowWolf",
        "NightTiger",
        "IronFist",
        "DarkHunter",
        "GhostKiller"
      ];

      const name = bots[Math.floor(Math.random()*bots.length)];

      setStatus("Rakip bulundu • " + name);

      window.TonCrimePVP.setOpponent({
        username:name,
        isBot:true
      });

      window.TonCrimePVP.start();

    },delay);

  }

  function startWithEnergy(cost){

    const s = window.tcStore.get();

    if(s.player.energy < cost){
      setStatus("Yetersiz enerji");
      return;
    }

    window.tcStore.update(st=>{
      st.player.energy -= cost;
    });

    findOpponent();

  }

  if(btnAd){
    btnAd.onclick = ()=>{
      startWithEnergy(1);
    };
  }

  if(btnCoin){
    btnCoin.onclick = ()=>{

      const s = window.tcStore.get();

      if(s.coins < 6){
        setStatus("Yetersiz coin");
        return;
      }

      window.tcStore.update(st=>{
        st.coins -= 6;
        st.player.energy -= 1;
      });

      findOpponent();
    };
  }

  window.addEventListener("tc:openPvp",()=>{
    setStatus("Hazır");
  });

}