// src/clan/ClanSystem.js

function randCode(len = 6) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

export const ClanSystem = {

  /* -------------------------------
     BASIC
  --------------------------------*/

  hasClan(store) {
    const s = store.get();
    return !!s.clan;
  },

  getClan(state) {
    return state.clan || null;
  },

  createClan(store, name, tag) {
    const s = store.get();

    const clan = {
      id: "clan_" + Date.now(),

      name,
      tag,

      level: 1,
      xp: 0,

      bank: 0,

      maxMembers: 20,

      inviteCode: randCode(),

      members: [
        {
          id: s.player?.id || "player",
          name: s.player?.username || "Leader",
          role: "Leader",
          level: s.player?.level || 1,
          power: 100
        }
      ],

      applications: [],

      upgrades: {
        memberCap: 0,
        pvpBonus: 0,
        energyBonus: 0
      },

      chat: [],

      log: ["Clan kuruldu"],

      boss: {
        hp: 500000,
        maxHp: 500000,
        damage: {}
      },

      market: [],

      stats: {
        totalDonations: 0,
        totalPvP: 0
      }
    };

    store.set({ clan });
  },

  leaveClan(store, playerId) {
    const s = store.get();
    const clan = s.clan;
    if (!clan) return;

    clan.members = clan.members.filter(m => m.id !== playerId);

    clan.log.push("Bir üye klanı terk etti");

    store.set({ clan });
  },

  /* -------------------------------
     MEMBERS
  --------------------------------*/

  addMember(store, player) {
    const s = store.get();
    const clan = s.clan;
    if (!clan) return;

    if (clan.members.length >= clan.maxMembers) return;

    clan.members.push(player);

    clan.log.push(player.name + " klana katıldı");

    store.set({ clan });
  },

  promote(store, playerId) {
    const s = store.get();
    const clan = s.clan;

    const m = clan.members.find(x => x.id === playerId);
    if (!m) return;

    m.role = "Officer";

    clan.log.push(m.name + " terfi etti");

    store.set({ clan });
  },

  kick(store, playerId) {
    const s = store.get();
    const clan = s.clan;

    clan.members = clan.members.filter(x => x.id !== playerId);

    clan.log.push("Bir üye atıldı");

    store.set({ clan });
  },

  /* -------------------------------
     DONATIONS
  --------------------------------*/

  donate(store, amount, type = "ton") {
    const s = store.get();
    const clan = s.clan;
    if (!clan) return;

    clan.bank += amount;

    clan.stats.totalDonations += amount;

    clan.xp += amount;

    clan.log.push("+" + amount + " " + type + " bağış");

    if (clan.xp > clan.level * 1000) {
      clan.level++;
      clan.log.push("Clan level up → " + clan.level);
    }

    store.set({ clan });
  },

  /* -------------------------------
     UPGRADES
  --------------------------------*/

  upgradeMembers(store) {
    const s = store.get();
    const clan = s.clan;

    const cost = clan.level * 500;

    if (clan.bank < cost) return;

    clan.bank -= cost;

    clan.maxMembers += 5;

    clan.upgrades.memberCap++;

    clan.log.push("Üye limiti yükseltildi");

    store.set({ clan });
  },

  upgradePvP(store) {
    const s = store.get();
    const clan = s.clan;

    const cost = 800;

    if (clan.bank < cost) return;

    clan.bank -= cost;

    clan.upgrades.pvpBonus++;

    clan.log.push("PvP bonusu yükseldi");

    store.set({ clan });
  },

  /* -------------------------------
     INVITE
  --------------------------------*/

  generateInvite(store) {
    const s = store.get();
    const clan = s.clan;

    clan.inviteCode = randCode();

    store.set({ clan });

    return clan.inviteCode;
  },

  applyClan(store, player) {
    const s = store.get();
    const clan = s.clan;

    clan.applications.push(player);

    store.set({ clan });
  },

  acceptApplication(store, playerId) {
    const s = store.get();
    const clan = s.clan;

    const p = clan.applications.find(x => x.id === playerId);
    if (!p) return;

    clan.applications = clan.applications.filter(x => x.id !== playerId);

    clan.members.push(p);

    clan.log.push(p.name + " kabul edildi");

    store.set({ clan });
  },

  /* -------------------------------
     CHAT
  --------------------------------*/

  sendChat(store, msg) {
    const s = store.get();
    const clan = s.clan;

    clan.chat.push({
      name: s.player.username,
      msg,
      ts: Date.now()
    });

    if (clan.chat.length > 100) clan.chat.shift();

    store.set({ clan });
  },

  /* -------------------------------
     POWER
  --------------------------------*/

  calcPower(clan) {

    let p = 0;

    clan.members.forEach(m => {
      p += (m.level || 1) * 100 + (m.power || 0);
    });

    p += clan.level * 1000;

    p += clan.stats.totalDonations;

    return p;
  },

  /* -------------------------------
     LEADERBOARD
  --------------------------------*/

  leaderboard(store) {

    const s = store.get();

    const clans = s.allClans || [];

    clans.sort((a, b) => {

      return ClanSystem.calcPower(b) - ClanSystem.calcPower(a);

    });

    return clans.slice(0, 50);
  },

  /* -------------------------------
     BOSS
  --------------------------------*/

  attackBoss(store, dmg = 1000) {

    const s = store.get();
    const clan = s.clan;

    clan.boss.hp -= dmg;

    const pid = s.player.id || "player";

    clan.boss.damage[pid] = (clan.boss.damage[pid] || 0) + dmg;

    if (clan.boss.hp <= 0) {

      clan.log.push("Clan boss öldürüldü");

      clan.bank += 1000;

      clan.boss.hp = clan.boss.maxHp;

      clan.boss.damage = {};

    }

    store.set({ clan });
  },

  /* -------------------------------
     MARKET
  --------------------------------*/

  addMarketItem(store, item) {

    const s = store.get();
    const clan = s.clan;

    clan.market.push(item);

    clan.log.push("Market item eklendi");

    store.set({ clan });
  },

  buyMarketItem(store, index) {

    const s = store.get();
    const clan = s.clan;

    const item = clan.market[index];

    if (!item) return;

    clan.bank += item.price;

    clan.market.splice(index, 1);

    clan.log.push("Market item satıldı");

    store.set({ clan });
  }

};
