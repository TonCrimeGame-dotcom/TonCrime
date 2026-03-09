// src/clan/ClanSystem.js

function randCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safePlayer(state) {
  const p = state?.player || {};
  return {
    id: String(p.id || p.telegramId || "player"),
    name: String(p.username || p.name || "Leader"),
    level: Number(p.level || 1),
    power: Number(p.power || 100),
  };
}

function ensureClanShape(clan, state) {
  const me = safePlayer(state);

  if (!clan || typeof clan !== "object") return null;

  clan.id = clan.id || `clan_${Date.now()}`;
  clan.name = clan.name || "New Clan";
  clan.tag = clan.tag || "CLN";
  clan.description = clan.description || "No description yet.";
  clan.level = Number(clan.level || 1);
  clan.xp = Number(clan.xp || 0);
  clan.bank = Number(clan.bank || 0);
  clan.ytonBank = Number(clan.ytonBank || 0);
  clan.energyBank = Number(clan.energyBank || 0);
  clan.maxMembers = Number(clan.maxMembers || 20);
  clan.inviteCode = clan.inviteCode || randCode();

  if (!Array.isArray(clan.members)) clan.members = [];
  if (clan.members.length === 0) {
    clan.members.push({
      id: me.id,
      name: me.name,
      role: "Leader",
      level: me.level,
      power: me.power,
      lastActiveAt: Date.now(),
      contribution: 0,
    });
  }

  if (!Array.isArray(clan.applications)) clan.applications = [];
  if (!Array.isArray(clan.chat)) clan.chat = [];
  if (!Array.isArray(clan.log)) clan.log = [];
  if (!Array.isArray(clan.market)) clan.market = [];

  clan.upgrades = clan.upgrades || {};
  clan.upgrades.memberCap = Number(clan.upgrades.memberCap || 0);
  clan.upgrades.pvpBonus = Number(clan.upgrades.pvpBonus || 0);
  clan.upgrades.energyBonus = Number(clan.upgrades.energyBonus || 0);
  clan.upgrades.tradeBonus = Number(clan.upgrades.tradeBonus || 0);
  clan.upgrades.xpBonus = Number(clan.upgrades.xpBonus || 0);

  clan.stats = clan.stats || {};
  clan.stats.totalDonations = Number(clan.stats.totalDonations || 0);
  clan.stats.totalPvP = Number(clan.stats.totalPvP || 0);
  clan.stats.totalWarWins = Number(clan.stats.totalWarWins || 0);
  clan.stats.totalBossKills = Number(clan.stats.totalBossKills || 0);

  clan.boss = clan.boss || {};
  clan.boss.hp = Number(clan.boss.hp || 500000);
  clan.boss.maxHp = Number(clan.boss.maxHp || 500000);
  clan.boss.damage = clan.boss.damage || {};

  if (clan.war == null) clan.war = null;

  return clan;
}

function saveClan(store, clan) {
  store.set({ clan });
}

export const ClanSystem = {
  hasClan(store) {
    const s = store.get();
    return !!s.clan;
  },

  getClan(state) {
    return ensureClanShape(state?.clan || null, state);
  },

  createClan(store, name, tag) {
    const s = store.get();
    const me = safePlayer(s);

    let clanName = name;
    let clanTag = tag;
    let description = "Şehirde güç kurmak isteyen aktif ekip.";

    if (name && typeof name === "object") {
      clanName = name.name || "New Clan";
      clanTag = name.tag || "CLN";
      description = name.description || description;
    }

    clanName = String(clanName || "New Clan").trim();
    clanTag = String(clanTag || "CLN").trim().toUpperCase().slice(0, 5);

    const clan = ensureClanShape(
      {
        id: `clan_${Date.now()}`,
        name: clanName,
        tag: clanTag,
        description,
        level: 1,
        xp: 0,
        bank: 0,
        ytonBank: 0,
        energyBank: 0,
        maxMembers: 20,
        inviteCode: randCode(),
        members: [
          {
            id: me.id,
            name: me.name,
            role: "Leader",
            level: me.level,
            power: me.power,
            lastActiveAt: Date.now(),
            contribution: 0,
          },
        ],
        applications: [],
        upgrades: {
          memberCap: 0,
          pvpBonus: 0,
          energyBonus: 0,
          tradeBonus: 0,
          xpBonus: 0,
        },
        chat: [],
        log: [`Clan kuruldu: ${clanName}`],
        boss: {
          hp: 500000,
          maxHp: 500000,
          damage: {},
        },
        market: [],
        stats: {
          totalDonations: 0,
          totalPvP: 0,
          totalWarWins: 0,
          totalBossKills: 0,
        },
        war: null,
      },
      s
    );

    saveClan(store, clan);
    return clan;
  },

  leaveClan(store, playerId) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return;

    const pid = String(playerId || safePlayer(s).id);
    const leaving = clan.members.find((m) => String(m.id) === pid);
    clan.members = clan.members.filter((m) => String(m.id) !== pid);

    clan.log.push(
      leaving ? `${leaving.name} klanı terk etti` : "Bir üye klanı terk etti"
    );

    if (clan.members.length === 0) {
      store.set({ clan: null });
      return;
    }

    const hasLeader = clan.members.some((m) => m.role === "Leader");
    if (!hasLeader) clan.members[0].role = "Leader";

    saveClan(store, clan);
  },

  addMember(store, player) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan || !player) return false;
    if (clan.members.length >= clan.maxMembers) return false;

    const id = String(player.id || player.telegramId || `p_${Date.now()}`);
    if (clan.members.some((m) => String(m.id) === id)) return false;

    clan.members.push({
      id,
      name: String(player.name || player.username || "Member"),
      role: String(player.role || "Member"),
      level: Number(player.level || 1),
      power: Number(player.power || 100),
      lastActiveAt: Date.now(),
      contribution: Number(player.contribution || 0),
    });

    clan.log.push(`${player.name || player.username || "Bir üye"} klana katıldı`);
    saveClan(store, clan);
    return true;
  },

  promote(store, playerId) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return;

    const m = clan.members.find((x) => String(x.id) === String(playerId));
    if (!m) return;

    m.role = "Officer";
    clan.log.push(`${m.name} terfi etti`);
    saveClan(store, clan);
  },

  kick(store, playerId) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return;

    const m = clan.members.find((x) => String(x.id) === String(playerId));
    clan.members = clan.members.filter((x) => String(x.id) !== String(playerId));

    clan.log.push(m ? `${m.name} klandan atıldı` : "Bir üye klandan atıldı");

    if (clan.members.length > 0 && !clan.members.some((x) => x.role === "Leader")) {
      clan.members[0].role = "Leader";
    }

    saveClan(store, clan);
  },

  donate(store, amount, type = "ton") {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const val = Number(amount || 0);
    if (val <= 0) return false;

    const kind = String(type || "ton").toLowerCase();

    if (kind === "ton") clan.bank += val;
    else if (kind === "yton") clan.ytonBank += val;
    else if (kind === "energy") clan.energyBank += val;
    else clan.bank += val;

    const xpBonusMul = 1 + clan.upgrades.xpBonus * 0.1;
    const gainedXp = Math.round(val * xpBonusMul);

    clan.stats.totalDonations += val;
    clan.xp += gainedXp;

    const me = safePlayer(s);
    const member = clan.members.find((m) => String(m.id) === me.id);
    if (member) {
      member.contribution = Number(member.contribution || 0) + val;
      member.lastActiveAt = Date.now();
    }

    clan.log.push(`+${val} ${kind.toUpperCase()} bağış yapıldı`);

    while (clan.xp >= clan.level * 1000) {
      clan.xp -= clan.level * 1000;
      clan.level += 1;
      clan.log.push(`Clan level up → ${clan.level}`);
    }

    saveClan(store, clan);
    return true;
  },

  upgradeMembers(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const cost = clan.level * 500 + clan.upgrades.memberCap * 250;
    if (clan.bank < cost) return false;

    clan.bank -= cost;
    clan.maxMembers += 5;
    clan.upgrades.memberCap += 1;
    clan.log.push("Üye limiti yükseltildi");
    saveClan(store, clan);
    return true;
  },

  upgradePvP(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const cost = 800 + clan.upgrades.pvpBonus * 400;
    if (clan.bank < cost) return false;

    clan.bank -= cost;
    clan.upgrades.pvpBonus += 1;
    clan.log.push("PvP bonusu yükseldi");
    saveClan(store, clan);
    return true;
  },

  upgradeEnergy(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const cost = 600 + clan.upgrades.energyBonus * 300;
    if (clan.bank < cost) return false;

    clan.bank -= cost;
    clan.upgrades.energyBonus += 1;
    clan.log.push("Enerji bonusu yükseldi");
    saveClan(store, clan);
    return true;
  },

  upgradeTrade(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const cost = 900 + clan.upgrades.tradeBonus * 450;
    if (clan.bank < cost) return false;

    clan.bank -= cost;
    clan.upgrades.tradeBonus += 1;
    clan.log.push("Trade bonusu yükseldi");
    saveClan(store, clan);
    return true;
  },

  generateInvite(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return "";

    clan.inviteCode = randCode();
    saveClan(store, clan);
    return clan.inviteCode;
  },

  applyClan(store, player) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan || !player) return false;

    const id = String(player.id || player.telegramId || `app_${Date.now()}`);
    if (clan.applications.some((x) => String(x.id) === id)) return false;

    clan.applications.push({
      id,
      name: String(player.name || player.username || "Applicant"),
      level: Number(player.level || 1),
      power: Number(player.power || 100),
    });

    clan.log.push(`${player.name || player.username || "Bir oyuncu"} başvurdu`);
    saveClan(store, clan);
    return true;
  },

  acceptApplication(store, playerId) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const idx = clan.applications.findIndex(
      (x) => String(x.id) === String(playerId)
    );
    if (idx < 0) return false;
    if (clan.members.length >= clan.maxMembers) return false;

    const p = clan.applications[idx];
    clan.applications.splice(idx, 1);

    clan.members.push({
      id: p.id,
      name: p.name,
      role: "Member",
      level: Number(p.level || 1),
      power: Number(p.power || 100),
      lastActiveAt: Date.now(),
      contribution: 0,
    });

    clan.log.push(`${p.name} kabul edildi`);
    saveClan(store, clan);
    return true;
  },

  sendChat(store, msg) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const text = String(msg || "").trim();
    if (!text) return false;

    const me = safePlayer(s);
    clan.chat.push({
      id: `chat_${Date.now()}`,
      name: me.name,
      msg: text,
      ts: Date.now(),
    });

    if (clan.chat.length > 100) clan.chat.shift();

    saveClan(store, clan);
    return true;
  },

  calcPower(clanLike) {
    const clan = ensureClanShape(clanLike, { player: {} });
    if (!clan) return 0;

    let total = 0;
    clan.members.forEach((m) => {
      total += Number(m.level || 1) * 100 + Number(m.power || 0);
    });

    total += clan.level * 1000;
    total += Math.floor(clan.stats.totalDonations);
    total += clan.upgrades.pvpBonus * 500;
    total += clan.upgrades.energyBonus * 300;
    total += clan.upgrades.tradeBonus * 400;
    total += clan.stats.totalWarWins * 1500;
    total += clan.stats.totalBossKills * 1000;

    return total;
  },

  leaderboard(store) {
    const s = store.get();
    const myClan = s.clan ? [ensureClanShape(s.clan, s)] : [];
    const other = Array.isArray(s.allClans) ? s.allClans.slice() : [];

    const list = [...myClan, ...other].filter(Boolean);

    list.sort((a, b) => this.calcPower(b) - this.calcPower(a));
    return list.slice(0, 50);
  },

  attackBoss(store, dmg = 1000) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const damage = clamp(Number(dmg || 0), 1, 100000);
    const me = safePlayer(s);

    clan.boss.hp -= damage;
    clan.boss.damage[me.id] = Number(clan.boss.damage[me.id] || 0) + damage;

    if (clan.boss.hp <= 0) {
      clan.log.push("Clan boss öldürüldü");
      clan.bank += 1000;
      clan.stats.totalBossKills += 1;
      clan.boss.hp = clan.boss.maxHp;
      clan.boss.damage = {};
    }

    saveClan(store, clan);
    return true;
  },

  addMarketItem(store, item) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan || !item) return false;

    clan.market.push({
      id: `market_${Date.now()}`,
      name: String(item.name || "Unknown Item"),
      price: Number(item.price || 0),
      seller: String(item.seller || safePlayer(s).name),
      qty: Number(item.qty || 1),
    });

    clan.log.push("Market item eklendi");
    saveClan(store, clan);
    return true;
  },

  buyMarketItem(store, index) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    const idx = Number(index);
    const item = clan.market[idx];
    if (!item) return false;

    clan.bank += Number(item.price || 0);
    clan.market.splice(idx, 1);
    clan.log.push("Market item satıldı");
    saveClan(store, clan);
    return true;
  },

  startWar(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    clan.war = {
      enemy: "Shadow Syndicate",
      power: 200000,
      reward: 1200,
      progress: 0,
      target: 10000,
      status: "active",
      startedAt: Date.now(),
    };

    clan.log.push("Clan war başladı");
    saveClan(store, clan);
    return true;
  },

  attackWar(store, amount = 500) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan || !clan.war || clan.war.status !== "active") return false;

    const hit = clamp(Number(amount || 0), 1, 100000);
    clan.war.progress += hit;

    if (clan.war.progress >= clan.war.target) {
      clan.war.status = "won";
      clan.bank += Number(clan.war.reward || 0);
      clan.stats.totalWarWins += 1;
      clan.log.push(`Clan war kazanıldı (+${clan.war.reward} TON)`);
    }

    saveClan(store, clan);
    return true;
  },

  resetWar(store) {
    const s = store.get();
    const clan = ensureClanShape(s.clan, s);
    if (!clan) return false;

    clan.war = null;
    clan.log.push("Clan war sıfırlandı");
    saveClan(store, clan);
    return true;
  },
};
