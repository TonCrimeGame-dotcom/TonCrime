const BOT_NAMES = [
  "ShadowWolf",
  "NightTiger",
  "IronFist",
  "DarkHunter",
  "GhostKiller",
  "BlackViper",
  "SilverFox",
  "RedSkull",
];

const CLANS = ["WLF", "SKL", "DRK", "VIP", "KNG", "NXT"];
const CHAT_LINES = [
  "Pazar bugün çok hareketli.",
  "PvP için rakip aranıyor.",
  "Black Market fiyatları uçuyor.",
  "Gece kulübünde büyük hareket var.",
  "Bugün şanslı hissediyorum.",
  "Clan savaşı yakında başlar.",
];

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeBot(idx, existing = {}) {
  const name = existing.name || existing.username || BOT_NAMES[idx % BOT_NAMES.length] + (idx >= BOT_NAMES.length ? `${idx}` : "");
  return {
    id: existing.id || `bot_${idx}_${name.toLowerCase()}`,
    name,
    username: name,
    clan: existing.clan || choice(CLANS),
    online: typeof existing.online === "boolean" ? existing.online : Math.random() < 0.7,
    premium: typeof existing.premium === "boolean" ? existing.premium : Math.random() < 0.15,
    level: Number(existing.level || (10 + Math.floor(Math.random() * 60))),
    rating: Number(existing.rating || (900 + Math.floor(Math.random() * 1200))),
    wins: Number(existing.wins || Math.floor(Math.random() * 80)),
    losses: Number(existing.losses || Math.floor(Math.random() * 80)),
    isBot: true,
  };
}

function normalizeBots(existing = []) {
  const list = Array.isArray(existing) ? existing : [];
  const bots = [];
  for (let i = 0; i < 12; i++) {
    bots.push(makeBot(i, list[i] || {}));
  }
  return bots;
}

function emitProfiles(bots) {
  try {
    window.dispatchEvent(new CustomEvent("tc:bot:profiles", { detail: { bots } }));
  } catch (_) {}
}

function emitLocalChat(bot, text, type = "chat") {
  try {
    window.dispatchEvent(
      new CustomEvent("tc:chat:local-message", {
        detail: {
          username: bot?.name || "SYSTEM",
          text,
          msg_type: type,
          player_meta: {
            username: bot?.name || "SYSTEM",
            isBot: true,
            online: bot?.online !== false,
            premium: !!bot?.premium,
            clan: bot?.clan || "SYS",
            level: Number(bot?.level || 99),
            rating: Number(bot?.rating || 1000),
            wins: Number(bot?.wins || 0),
            losses: Number(bot?.losses || 0),
          },
        },
      })
    );
  } catch (_) {}
}

export function startBotEngine(store) {
  if (!store || window.__tcBotEngineStarted) return window.__tcBotEngine;
  window.__tcBotEngineStarted = true;

  const existing = store.get?.()?.bots || [];
  const bots = normalizeBots(existing);
  const runtime = {
    presenceTimer: null,
    chatTimer: null,
  };

  store.set({
    bots,
    botState: {
      enabled: true,
      bootstrapped: true,
      lastPresenceAt: Date.now(),
      lastChatAt: Date.now(),
    },
  });

  emitProfiles(bots);

  runtime.presenceTimer = setInterval(() => {
    const current = normalizeBots(store.get?.()?.bots || bots).map((bot) => ({ ...bot }));
    const idx = Math.floor(Math.random() * current.length);
    if (current[idx]) {
      current[idx].online = Math.random() < 0.75;
    }
    store.set({
      bots: current,
      botState: {
        ...(store.get?.()?.botState || {}),
        enabled: true,
        bootstrapped: true,
        lastPresenceAt: Date.now(),
      },
    });
    emitProfiles(current);
  }, 12000);

  runtime.chatTimer = setInterval(() => {
    const current = store.get?.()?.bots || bots;
    const onlineBots = current.filter((b) => b?.online !== false);
    if (!onlineBots.length) return;
    const bot = choice(onlineBots);
    emitLocalChat(bot, choice(CHAT_LINES), Math.random() < 0.2 ? "system" : "chat");
    store.set({
      botState: {
        ...(store.get?.()?.botState || {}),
        enabled: true,
        bootstrapped: true,
        lastChatAt: Date.now(),
      },
    });
  }, 18000);

  const api = {
    stop() {
      clearInterval(runtime.presenceTimer);
      clearInterval(runtime.chatTimer);
    },
    emitProfiles() {
      emitProfiles(store.get?.()?.bots || bots);
    },
  };

  window.__tcBotEngine = api;
  return api;
}

export default startBotEngine;
