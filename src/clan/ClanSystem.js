import { ClanSystem } from "../clan/ClanSystem.js";

export class ClanScene {
  constructor({ store, input, assets, scenes, i18n }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;
    this.i18n = i18n;

    this.root = null;
  }

  onEnter() {
    const state = this.store.get();
    const clan = ClanSystem.getClan(state);

    this.root = document.createElement("div");
    this.root.id = "clanScene";
    this.root.style.position = "fixed";
    this.root.style.left = "0";
    this.root.style.top = "0";
    this.root.style.width = "100%";
    this.root.style.height = "100%";
    this.root.style.background = "#0b0b0f";
    this.root.style.color = "white";
    this.root.style.zIndex = "50";
    this.root.style.overflowY = "auto";
    this.root.style.fontFamily = "system-ui";

    this.root.innerHTML = `
      <div style="padding:20px;max-width:900px;margin:auto">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h1 style="margin:0">${clan.name}</h1>
          <button id="clanBackBtn">← Ana Menü</button>
        </div>

        <div style="background:#14141a;padding:16px;border-radius:12px;margin-bottom:20px">
          <div><b>Tag:</b> ${clan.tag}</div>
          <div><b>Seviye:</b> ${clan.level}</div>
          <div><b>Üye:</b> ${clan.members.length}/${clan.maxMembers}</div>
          <div><b>Kasa:</b> ${clan.bank || 0} TON</div>
        </div>

        <h2>Üyeler</h2>
        <div id="clanMembers"></div>

        <h2 style="margin-top:30px">Bağış</h2>
        <div style="display:flex;gap:10px;margin-bottom:20px">
          <button id="donate10">+10 TON</button>
          <button id="donate100">+100 TON</button>
        </div>

        <h2>Yükseltmeler</h2>
        <div style="display:flex;gap:10px;margin-bottom:20px">
          <button id="upgradeMembers">Üye Limiti +5</button>
          <button id="upgradeBank">Kasa Bonus</button>
        </div>

        <h2>Aktivite</h2>
        <div id="clanLog" style="background:#14141a;padding:12px;border-radius:10px"></div>

      </div>
    `;

    document.body.appendChild(this.root);

    this.renderMembers(clan);
    this.renderLog(clan);

    document.getElementById("clanBackBtn").onclick = () => {
      this.scenes.go("home");
    };

    document.getElementById("donate10").onclick = () => {
      ClanSystem.donate(this.store, 10);
      this.refresh();
    };

    document.getElementById("donate100").onclick = () => {
      ClanSystem.donate(this.store, 100);
      this.refresh();
    };

    document.getElementById("upgradeMembers").onclick = () => {
      ClanSystem.upgradeMembers(this.store);
      this.refresh();
    };

    document.getElementById("upgradeBank").onclick = () => {
      ClanSystem.upgradeBank(this.store);
      this.refresh();
    };
  }

  renderMembers(clan) {
    const el = document.getElementById("clanMembers");
    el.innerHTML = "";

    clan.members.forEach((m) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.background = "#14141a";
      row.style.padding = "10px";
      row.style.marginBottom = "6px";
      row.style.borderRadius = "8px";

      row.innerHTML = `
        <div>
          <b>${m.name}</b>
          <div style="font-size:12px;opacity:.7">${m.role}</div>
        </div>
        <div>Lv.${m.level}</div>
      `;

      el.appendChild(row);
    });
  }

  renderLog(clan) {
    const log = document.getElementById("clanLog");
    log.innerHTML = "";

    (clan.log || []).slice(-10).reverse().forEach((l) => {
      const row = document.createElement("div");
      row.style.fontSize = "13px";
      row.style.opacity = ".8";
      row.style.marginBottom = "4px";
      row.textContent = l;
      log.appendChild(row);
    });
  }

  refresh() {
    const state = this.store.get();
    const clan = ClanSystem.getClan(state);
    this.renderMembers(clan);
    this.renderLog(clan);
  }

  onExit() {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }
}
