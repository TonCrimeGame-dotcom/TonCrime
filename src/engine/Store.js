class Store {
  constructor(initialState = {}) {
    this.listeners = new Set();
    this.state = this._mergeDefaults(this._clone(initialState || {}));
  }

  get() {
    return this.state;
  }

  set(patch = {}) {
    const prev = this.state;
    const next = this._deepMerge(this._clone(prev), this._clone(patch || {}));
    this.state = this._mergeDefaults(next);
    this._emit(prev, this.state);
    return this.state;
  }

  replace(nextState = {}) {
    const prev = this.state;
    this.state = this._mergeDefaults(this._clone(nextState || {}));
    this._emit(prev, this.state);
    return this.state;
  }

  subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  _emit(prev, next) {
    for (const fn of this.listeners) {
      try {
        fn(next, prev);
      } catch (_) {}
    }
  }

  _clone(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  }

  _isObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  _deepMerge(base, patch) {
    if (Array.isArray(base) && Array.isArray(patch)) {
      return patch.slice();
    }

    if (!this._isObject(base) || !this._isObject(patch)) {
      return patch;
    }

    for (const key of Object.keys(patch)) {
      const pv = patch[key];
      const bv = base[key];

      if (Array.isArray(pv)) {
        base[key] = pv.slice();
      } else if (this._isObject(pv) && this._isObject(bv)) {
        base[key] = this._deepMerge({ ...bv }, pv);
      } else if (this._isObject(pv)) {
        base[key] = this._deepMerge({}, pv);
      } else {
        base[key] = pv;
      }
    }

    return base;
  }

  _mergeDefaults(state) {
    const now = Date.now();

    const defaults = {
      lang: "tr",

      coins: 100,
      yton: 100,
      cash: 25000,
      premium: false,
      isPremium: false,

      intro: {
        splashSeen: false,
        ageVerified: false,
        profileCompleted: false,
        tutorialSeen: false,
      },

      ui: {
        safe: {
          x: 0,
          y: 0,
          w: typeof window !== "undefined" ? window.innerWidth : 390,
          h: typeof window !== "undefined" ? window.innerHeight : 844,
        },
        hudReservedTop: 110,
        chatReservedBottom: 82,
      },

      player: {
        id: "player_main",
        username: "",
        telegramId: "",
        email: "",
        age: null,

        level: 0,
        xp: 0,
        xpToNext: 0,

        energy: 100,
        energyMax: 100,
        lastEnergyResetKey: "",

        hp: 100,
        hpMax: 100,

        membership: "standard",
        canOwnBusiness: false,
        canWithdraw: false,
        premiumUntil: 0,
      },

      trade: {
        activeTab: "buy",
        selectedBusinessId: null,
        selectedInventoryCategory: "all",
        selectedMarketFilter: "all",
        selectedShopId: null,
        selectedShopItemId: null,
        view: "main",
        toast: null,
        searchQuery: "",
        freeSpinDay: "",
        freeSpinUsed: 0,
        premiumPreviewType: "nightclub",
        lootWheel: {
          mode: "free",
          selectedIndex: 0,
          rotation: 0,
          reward: null,
          updatedAt: 0,
        },
        crateReveal: null,
      },

      wallet: {
        connectedAddress: "",
        walletAddressInput: "",
        tonBalance: 0,
        yton: 100,
        depositAddress: "",
        convertYtonInput: "",
        convertTonInput: "",
        conversionMode: "",
        withdrawTonInput: "",
      },

      inventory: {
        items: [
          {
            id: "inv_energy_whiskey",
            kind: "consumable",
            icon: "E",
            imageSrc: "./src/assets/drink.png",
            name: "Imported Whiskey",
            rarity: "common",
            qty: 4,
            usable: true,
            sellable: true,
            marketable: true,
            energyGain: 10,
            sellPrice: 18,
            marketPrice: 26,
            desc: "Enerji doldurur.",
          },
          {
            id: "inv_vip_girl",
            kind: "girls",
            icon: "SB",
            imageSrc: "./src/assets/g_star1.png",
            name: "Scarlett Blaze",
            rarity: "epic",
            qty: 2,
            usable: true,
            sellable: true,
            marketable: true,
            energyGain: 24,
            sellPrice: 65,
            marketPrice: 90,
            desc: "Kullanildiginda yuksek enerji verir.",
          },
          {
            id: "inv_moon_rocks",
            kind: "goods",
            icon: "GR",
            imageSrc: "./src/assets/weed.png",
            name: "Moon Rocks",
            rarity: "rare",
            qty: 6,
            usable: false,
            sellable: true,
            marketable: true,
            sellPrice: 22,
            marketPrice: 34,
            desc: "Pazarda satilabilir urun.",
          },
          {
            id: "inv_gold_pass",
            kind: "rare",
            icon: "GP",
            imageSrc: "./src/assets/bonus.png",
            name: "Golden Pass",
            rarity: "legendary",
            qty: 1,
            usable: false,
            sellable: true,
            marketable: false,
            sellPrice: 250,
            marketPrice: 0,
            desc: "Nadir etkinlik urunu.",
          },
        ],
      },

      businesses: {
        owned: [],
      },

      market: {
        shops: [
          {
            id: "shop_1",
            businessId: "nb_777",
            type: "nightclub",
            icon: "NB",
            imageKey: "nightclub",
            imageSrc: "./src/assets/nightclub.jpg",
            name: "Red Velvet Club",
            ownerId: "u_777",
            ownerName: "Mert",
            online: true,
            theme: "neon",
            rating: 4.8,
            totalListings: 3,
            totalSold: 28,
            totalRevenue: 1120,
            lastSaleAt: now - 1000 * 60 * 45,
          },
          {
            id: "shop_2",
            businessId: "cf_555",
            type: "coffeeshop",
            icon: "CF",
            imageKey: "coffeeshop",
            imageSrc: "./src/assets/coffeeshop.jpg",
            name: "Green Smoke",
            ownerId: "u_555",
            ownerName: "Ares",
            online: false,
            theme: "green",
            rating: 4.5,
            totalListings: 2,
            totalSold: 19,
            totalRevenue: 860,
            lastSaleAt: now - 1000 * 60 * 125,
          },
          {
            id: "shop_3",
            businessId: "br_222",
            type: "brothel",
            icon: "BR",
            imageKey: "xxx",
            imageSrc: "./src/assets/xxx.jpg",
            name: "Ruby House",
            ownerId: "u_222",
            ownerName: "Selim",
            online: true,
            theme: "red",
            rating: 4.9,
            totalListings: 2,
            totalSold: 33,
            totalRevenue: 2145,
            lastSaleAt: now - 1000 * 60 * 18,
          },
        ],

        listings: [
          {
            id: "list_1",
            shopId: "shop_1",
            icon: "E",
            imageSrc: "./src/assets/street.png",
            itemName: "Street Whiskey",
            rarity: "common",
            stock: 18,
            price: 27,
            energyGain: 7,
            usable: true,
            desc: "Hizli enerji urunu.",
          },
          {
            id: "list_2",
            shopId: "shop_1",
            icon: "CH",
            imageSrc: "./src/assets/club.png",
            itemName: "Club Prosecco",
            rarity: "rare",
            stock: 7,
            price: 45,
            energyGain: 13,
            usable: true,
            desc: "Kulup ici icecek.",
          },
          {
            id: "list_3",
            shopId: "shop_1",
            icon: "PASS",
            imageSrc: "./src/assets/mafia.png",
            itemName: "Blue Venom",
            rarity: "epic",
            stock: 3,
            price: 88,
            energyGain: 13,
            usable: true,
            desc: "Vip kokteyl.",
          },
          {
            id: "list_4",
            shopId: "shop_2",
            icon: "OG",
            imageSrc: "./src/assets/og.png",
            itemName: "OG Kush",
            rarity: "rare",
            stock: 12,
            price: 35,
            energyGain: 11,
            usable: true,
            desc: "Coffeeshop urunu.",
          },
          {
            id: "list_5",
            shopId: "shop_2",
            icon: "MR",
            imageSrc: "./src/assets/diamond.png",
            itemName: "Moon Rocks",
            rarity: "epic",
            stock: 4,
            price: 62,
            energyGain: 18,
            usable: true,
            desc: "Nadir urun.",
          },
          {
            id: "list_6",
            shopId: "shop_3",
            icon: "VIP",
            imageSrc: "./src/assets/g_star1.png",
            itemName: "Scarlett Blaze",
            rarity: "epic",
            stock: 5,
            price: 95,
            energyGain: 22,
            usable: true,
            desc: "Vip servis.",
          },
          {
            id: "list_7",
            shopId: "shop_3",
            icon: "DELUXE",
            imageSrc: "./src/assets/g_star2.png",
            itemName: "Ruby Vane",
            rarity: "legendary",
            stock: 2,
            price: 120,
            energyGain: 26,
            usable: true,
            desc: "Deluxe servis.",
          },
        ],

        salesHistory: [
          { id: "sale_1", shopId: "shop_1", itemName: "Street Whiskey", qty: 8, price: 27, soldAt: now - 1000 * 60 * 180 },
          { id: "sale_2", shopId: "shop_1", itemName: "Club Prosecco", qty: 6, price: 45, soldAt: now - 1000 * 60 * 75 },
          { id: "sale_3", shopId: "shop_2", itemName: "OG Kush", qty: 11, price: 35, soldAt: now - 1000 * 60 * 240 },
          { id: "sale_4", shopId: "shop_2", itemName: "Moon Rocks", qty: 8, price: 55, soldAt: now - 1000 * 60 * 125 },
          { id: "sale_5", shopId: "shop_3", itemName: "Scarlett Blaze", qty: 14, price: 95, soldAt: now - 1000 * 60 * 60 },
          { id: "sale_6", shopId: "shop_3", itemName: "Ruby Vane", qty: 19, price: 110, soldAt: now - 1000 * 60 * 18 },
        ],
      },

      stars: {
        owned: {},
        selectedId: null,
        lastClaimTs: {},
        twinBonusClaimed: {},
      },

      missions: {
        dailyAdsWatched: 0,
        dailyAdsMax: 20,
        invites: 0,
        completed: {},
        claimed: {},
      },

      dailyLogin: {
        lastClaimKey: "",
        streak: 0,
        pending: false,
        pendingKey: "",
        pendingReward: 0,
        pendingStreak: 0,
      },

      pvp: {
        wins: 0,
        losses: 0,
        rating: 1000,
        currentOpponent: null,
      },

      bots: [],

      botState: {
        enabled: false,
        bootstrapped: false,
        lastPresenceAt: 0,
        lastMarketAt: 0,
        lastChatAt: 0,
      },

      settings: {
        music: true,
        sfx: true,
        vibration: true,
      },
    };

    const merged = this._deepMerge(this._clone(defaults), state || {});

    if (!merged.intro) merged.intro = {};
    if (!merged.player) merged.player = {};
    if (!merged.trade) merged.trade = {};
    if (!merged.wallet) merged.wallet = {};
    if (!merged.dailyLogin) merged.dailyLogin = {};
    if (!merged.inventory) merged.inventory = { items: [] };
    if (!Array.isArray(merged.inventory.items)) merged.inventory.items = [];
    if (!merged.businesses) merged.businesses = { owned: [] };
    if (!Array.isArray(merged.businesses.owned)) merged.businesses.owned = [];
    if (!merged.market) merged.market = { shops: [], listings: [], salesHistory: [] };
    if (!Array.isArray(merged.market.shops)) merged.market.shops = [];
    if (!Array.isArray(merged.market.listings)) merged.market.listings = [];
    if (!Array.isArray(merged.market.salesHistory)) merged.market.salesHistory = [];
    merged.bots = [];
    merged.botState = {
      enabled: false,
      bootstrapped: false,
      lastPresenceAt: 0,
      lastMarketAt: 0,
      lastChatAt: 0,
    };

    if (typeof merged.wallet.tonBalance !== "number") merged.wallet.tonBalance = 0;
    if (typeof merged.wallet.connectedAddress !== "string") merged.wallet.connectedAddress = "";
    if (typeof merged.wallet.walletAddressInput !== "string") {
      merged.wallet.walletAddressInput = merged.wallet.connectedAddress || "";
    }
    if (typeof merged.wallet.conversionMode !== "string") merged.wallet.conversionMode = "";

    const intro = merged.intro;
    intro.splashSeen = !!intro.splashSeen;
    intro.ageVerified = !!intro.ageVerified;
    intro.profileCompleted = !!intro.profileCompleted;
    intro.tutorialSeen = !!intro.tutorialSeen;

    const dailyLogin = merged.dailyLogin;
    dailyLogin.lastClaimKey = String(dailyLogin.lastClaimKey || "");
    dailyLogin.streak = Math.max(0, Number(dailyLogin.streak || 0));
    dailyLogin.pending = !!dailyLogin.pending;
    dailyLogin.pendingKey = String(dailyLogin.pendingKey || "");
    dailyLogin.pendingReward = Math.max(0, Number(dailyLogin.pendingReward || 0));
    dailyLogin.pendingStreak = Math.max(0, Number(dailyLogin.pendingStreak || 0));

    const rawCoins = Number(
      merged.coins ??
      merged.yton ??
      merged.wallet.yton ??
      defaults.coins
    );
    const normalizedCoins = Number.isFinite(rawCoins) ? Math.max(0, rawCoins) : defaults.coins;
    merged.coins = normalizedCoins;
    merged.yton = normalizedCoins;
    merged.wallet.yton = normalizedCoins;

    const player = merged.player;
    const rawLevel = Number(player.level);
    player.level = Number.isFinite(rawLevel) ? Math.max(0, Math.floor(rawLevel)) : 0;
    const rawXp = Number(player.xp || 0);
    player.xp = Number.isFinite(rawXp) ? Math.max(0, rawXp) : 0;

    const starterXpTrack =
      player.level === 0 &&
      Number(player.xp || 0) <= 0 &&
      Number(player.xpToNext || 0) <= 0;

    if (starterXpTrack) {
      player.xpToNext = 0;
    } else {
      player.xpToNext = Math.max(1, Number(player.xpToNext || 100));
    }

    const rawEnergyMax = Number(player.energyMax || defaults.player.energyMax);
    player.energyMax = Math.min(100, Math.max(1, Number.isFinite(rawEnergyMax) ? rawEnergyMax : defaults.player.energyMax));
    const rawEnergy = Number(player.energy || 0);
    player.energy = Number.isFinite(rawEnergy)
      ? Math.max(0, Math.min(player.energyMax, rawEnergy))
      : 0;
    if (typeof player.lastEnergyResetKey !== "string") {
      player.lastEnergyResetKey = "";
    }

    const playerName = String(player.username || "Player");
    const econUnlocked = !!(merged.premium || merged.isPremium) || Number(player.level ?? 0) >= 50;
    player.membership = econUnlocked && (merged.premium || merged.isPremium) ? "premium" : (player.membership || "standard");
    player.canOwnBusiness = econUnlocked;
    player.canWithdraw = econUnlocked;

    for (const biz of merged.businesses.owned) {
      if (!biz.ownerName) biz.ownerName = playerName;
      if (!biz.ownerId) biz.ownerId = String(merged.player.id || "player_main");
      if (!biz.icon) biz.icon = this._businessIcon(biz.type);
      const bizImg = this._businessImageData(biz.type);
      if (bizImg.imageKey) biz.imageKey = bizImg.imageKey;
      if (bizImg.imageSrc) biz.imageSrc = bizImg.imageSrc;
      if (!Array.isArray(biz.products)) biz.products = [];
      if (!Array.isArray(biz.pendingProduction)) biz.pendingProduction = [];
      for (const product of biz.products) {
        this._normalizeTradeItem(product, biz.type);
      }
    }

    for (const item of merged.inventory.items) {
      this._normalizeTradeItem(item, item.type || item.businessType || "");
    }

    for (const shop of merged.market.shops) {
      if (!shop.icon) shop.icon = this._businessIcon(shop.type);
      const art = this._businessImageData(shop.type);
      if (art.imageKey) shop.imageKey = art.imageKey;
      if (art.imageSrc) shop.imageSrc = art.imageSrc;
      if (typeof shop.totalListings !== "number") {
        shop.totalListings = merged.market.listings.filter((x) => x.shopId === shop.id).length;
      }
      if (typeof shop.totalSold !== "number") {
        shop.totalSold = merged.market.salesHistory
          .filter((x) => x.shopId === shop.id)
          .reduce((sum, row) => sum + Number(row.qty || 0), 0);
      }
      if (typeof shop.totalRevenue !== "number") {
        shop.totalRevenue = merged.market.salesHistory
          .filter((x) => x.shopId === shop.id)
          .reduce((sum, row) => sum + Number(row.qty || 0) * Number(row.price || 0), 0);
      }
      if (typeof shop.lastSaleAt !== "number") {
        shop.lastSaleAt = merged.market.salesHistory
          .filter((x) => x.shopId === shop.id)
          .reduce((max, row) => Math.max(max, Number(row.soldAt || 0)), 0);
      }
    }

    for (const listing of merged.market.listings) {
      const shop = merged.market.shops.find((x) => x.id === listing.shopId);
      this._normalizeTradeItem(listing, shop?.type || listing.type || "");
    }

    for (const sale of merged.market.salesHistory) {
      const shop = merged.market.shops.find((x) => x.id === sale.shopId);
      sale.itemName = this._canonicalMarketItemName(sale.itemName || sale.name || "", shop?.type || sale.type || "");
    }

    return merged;
  }

  _canonicalMarketItemName(name, type = "") {
    const original = String(name || "").trim();
    const raw = original.toLowerCase();
    const kind = String(type || "").toLowerCase();
    if (/(vip companion|vip girl|companion)/.test(raw)) return "Scarlett Blaze";
    if (/(deluxe service|deluxe)/.test(raw)) return "Ruby Vane";
    if (/(elite service|elite escort|elite)/.test(raw)) return "Luna Hart";
    if (kind === "brothel" && /(service|escort|girl)/.test(raw)) return "Scarlett Blaze";
    return original;
  }

  _normalizeTradeItem(item, type = "") {
    if (!item || typeof item !== "object") return item;

    const normalizedName = this._canonicalMarketItemName(item.itemName || item.name || "", type || item.type || "");
    if (normalizedName) {
      if (Object.prototype.hasOwnProperty.call(item, "itemName")) item.itemName = normalizedName;
      if (Object.prototype.hasOwnProperty.call(item, "name")) item.name = normalizedName;
    }

    const art = this._itemImageData(item.itemName || item.name || "", type || item.type || "");
    if (!item.imageSrc && item.image) item.imageSrc = item.image;
    if (art.imageKey) item.imageKey = art.imageKey;
    if (art.imageSrc) item.imageSrc = art.imageSrc;
    return item;
  }

  _businessImageData(type) {
    switch (type) {
      case "nightclub":
        return { imageKey: "nightclub", imageSrc: "./src/assets/nightclub.jpg" };
      case "coffeeshop":
        return { imageKey: "coffeeshop", imageSrc: "./src/assets/coffeeshop.jpg" };
      case "brothel":
        return { imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg" };
      case "blackmarket":
        return { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" };
      default:
        return { imageKey: "", imageSrc: "" };
    }
  }

  _itemImageData(name, type = "") {
    const raw = String(name || "").toLowerCase();
    if (/(street whiskey|night whiskey|black whiskey|whiskey)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/street.png" };
    if (/(club prosecco|club champagne|premium champagne|champagne|drink)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/club.png" };
    if (/(blue venom|venom)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/mafia.png" };
    if (/(white widow)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/white.png" };
    if (/(og kush|kush)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/og.png" };
    if (/(moon rocks|weed)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/diamond.png" };
    if (/(scarlett blaze|scarlett)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/g_star1.png" };
    if (/(ruby vane|ruby)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/g_star2.png" };
    if (/(luna hart|luna)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/g_star3.png" };
    if (/(vip companion|vip girl|companion)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/g_star1.png" };
    if (/(deluxe service|deluxe)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/g_star2.png" };
    if (/(elite service|elite escort|elite)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/g_star3.png" };
    if (/(service|escort|girl)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/girl.png" };
    if (/(golden pass|vip pass|pass)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/bonus.png" };
    if (/(crate|sandik)/.test(raw)) return { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" };
    return this._businessImageData(type);
  }

  _businessIcon(type) {
    switch (type) {
      case "nightclub":
        return "NB";
      case "coffeeshop":
        return "CF";
      case "brothel":
        return "BR";
      case "blackmarket":
        return "MK";
      default:
        return "BIZ";
    }
  }
}

export { Store };
export default Store;
