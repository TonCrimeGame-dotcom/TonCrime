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
    const defaults = {
      lang: "tr",

      coins: 5000,
      cash: 25000,
      premium: false,

      ui: {
        safe: {
          x: 0,
          y: 0,
          w:
            typeof window !== "undefined"
              ? window.innerWidth
              : 390,
          h:
            typeof window !== "undefined"
              ? window.innerHeight
              : 844,
        },
        hudReservedTop: 110,
        chatReservedBottom: 82,
      },

      player: {
        id: "player_main",
        username: "Player",
        telegramId: "",
        email: "",
        age: 18,

        level: 50,
        xp: 0,
        xpToNext: 100,

        energy: 50,
        energyMax: 50,

        hp: 100,
        hpMax: 100,

        premiumUntil: 0,
      },

      trade: {
        activeTab: "businesses", // businesses | inventory | market
        selectedBusinessId: null,
        selectedInventoryCategory: "all", // all | consumable | girls | goods | rare
        selectedMarketFilter: "all", // all | nightclub | coffeeshop | brothel | blackmarket
        selectedShopId: null,
        selectedShopItemId: null,
        view: "main", // main | shop
        toast: null,
        lootWheel: {
          mode: "free",
          selectedIndex: 0,
          rotation: 0,
          reward: null,
          updatedAt: 0,
        },
        crateReveal: null,
      },

      inventory: {
        items: [
          {
            id: "inv_energy_whiskey",
            kind: "consumable",
            icon: "🥃",
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
            icon: "💋",
            imageKey: "xxx",
            imageSrc: "./src/assets/xxx.jpg",
            name: "VIP Girl",
            rarity: "epic",
            qty: 2,
            usable: true,
            sellable: true,
            marketable: true,
            energyGain: 24,
            sellPrice: 65,
            marketPrice: 90,
            desc: "Kullanıldığında yüksek enerji verir.",
          },
          {
            id: "inv_moon_rocks",
            kind: "goods",
            icon: "🌿",
            imageSrc: "./src/assets/weed.png",
            name: "Moon Rocks",
            rarity: "rare",
            qty: 6,
            usable: false,
            sellable: true,
            marketable: true,
            sellPrice: 22,
            marketPrice: 34,
            desc: "Pazarda satılabilir ürün.",
          },
          {
            id: "inv_gold_pass",
            kind: "rare",
            icon: "👑",
            imageSrc: "./src/assets/bonus.png",
            name: "Golden Pass",
            rarity: "legendary",
            qty: 1,
            usable: false,
            sellable: true,
            marketable: false,
            sellPrice: 250,
            marketPrice: 0,
            desc: "Nadir etkinlik ürünü.",
          },
        ],
      },

      businesses: {
        owned: [
          {
            id: "biz_night_1",
            type: "nightclub",
            icon: "🌃",
            imageKey: "nightclub",
            imageSrc: "./src/assets/nightclub.jpg",
            name: "Velvet Night",
            ownerId: "player_main",
            ownerName: "Player",
            dailyProduction: 50,
            stock: 34,
            theme: "neon",
            products: [
              {
                id: "biz_night_1_whiskey",
                icon: "🥃",
                imageSrc: "./src/assets/drink.png",
                name: "Black Whiskey",
                rarity: "common",
                qty: 16,
                price: 28,
                energyGain: 8,
                desc: "Gece kulübü ürünü.",
              },
              {
                id: "biz_night_1_champ",
                icon: "🍾",
                imageSrc: "./src/assets/drink.png",
                name: "Premium Champagne",
                rarity: "rare",
                qty: 8,
                price: 44,
                energyGain: 14,
                desc: "Daha iyi enerji verir.",
              },
            ],
          },
          {
            id: "biz_coffee_1",
            type: "coffeeshop",
            icon: "🌿",
            imageKey: "coffeeshop",
            imageSrc: "./src/assets/coffeeshop.jpg",
            name: "Amsterdam Dreams",
            ownerId: "player_main",
            ownerName: "Player",
            dailyProduction: 50,
            stock: 41,
            theme: "green",
            products: [
              {
                id: "biz_coffee_1_weed",
                icon: "🍁",
                imageSrc: "./src/assets/weed.png",
                name: "White Widow",
                rarity: "rare",
                qty: 14,
                price: 36,
                energyGain: 12,
                desc: "Enerji için kullanılabilir.",
              },
            ],
          },
          {
            id: "biz_brothel_1",
            type: "brothel",
            icon: "💋",
            imageKey: "xxx",
            imageSrc: "./src/assets/xxx.jpg",
            name: "Ruby House",
            ownerId: "player_main",
            ownerName: "Player",
            dailyProduction: 50,
            stock: 19,
            theme: "red",
            products: [
              {
                id: "biz_brothel_1_vip",
                icon: "🌹",
                imageKey: "xxx",
                imageSrc: "./src/assets/xxx.jpg",
                name: "VIP Companion",
                rarity: "epic",
                qty: 5,
                price: 95,
                energyGain: 22,
                desc: "Yüksek enerji itemi.",
              },
            ],
          },
        ],
      },

      market: {
        shops: [
          {
            id: "shop_1",
            businessId: "nb_777",
            type: "nightclub",
            icon: "🌃",
            imageKey: "nightclub",
            imageSrc: "./src/assets/nightclub.jpg",
            name: "Red Velvet Club",
            ownerId: "u_777",
            ownerName: "Mert",
            online: true,
            theme: "neon",
            rating: 4.8,
            totalListings: 3,
          },
          {
            id: "shop_2",
            businessId: "cf_555",
            type: "coffeeshop",
            icon: "🌿",
            imageKey: "coffeeshop",
            imageSrc: "./src/assets/coffeeshop.jpg",
            name: "Green Smoke",
            ownerId: "u_555",
            ownerName: "Ares",
            online: false,
            theme: "green",
            rating: 4.5,
            totalListings: 2,
          },
          {
            id: "shop_3",
            businessId: "br_222",
            type: "brothel",
            icon: "💋",
            imageKey: "xxx",
            imageSrc: "./src/assets/xxx.jpg",
            name: "Ruby House",
            ownerId: "u_222",
            ownerName: "Selim",
            online: true,
            theme: "red",
            rating: 4.9,
            totalListings: 2,
          },
        ],

        listings: [
          {
            id: "list_1",
            shopId: "shop_1",
            icon: "🥃",
            imageSrc: "./src/assets/drink.png",
            itemName: "Night Whiskey",
            rarity: "common",
            stock: 18,
            price: 27,
            energyGain: 7,
            usable: true,
            desc: "Hızlı enerji ürünü.",
          },
          {
            id: "list_2",
            shopId: "shop_1",
            icon: "🍾",
            imageSrc: "./src/assets/drink.png",
            itemName: "Club Champagne",
            rarity: "rare",
            stock: 7,
            price: 45,
            energyGain: 13,
            usable: true,
            desc: "Lüks içki.",
          },
          {
            id: "list_3",
            shopId: "shop_1",
            icon: "🎟️",
            imageSrc: "./src/assets/bonus.png",
            itemName: "VIP Pass",
            rarity: "epic",
            stock: 3,
            price: 88,
            energyGain: 0,
            usable: false,
            desc: "Özel koleksiyon ürünü.",
          },
          {
            id: "list_4",
            shopId: "shop_2",
            icon: "🍁",
            imageSrc: "./src/assets/weed.png",
            itemName: "OG Kush",
            rarity: "rare",
            stock: 12,
            price: 35,
            energyGain: 11,
            usable: true,
            desc: "Coffeeshop ürünü.",
          },
          {
            id: "list_5",
            shopId: "shop_2",
            icon: "🌿",
            imageSrc: "./src/assets/weed.png",
            itemName: "Moon Rocks",
            rarity: "epic",
            stock: 4,
            price: 62,
            energyGain: 18,
            usable: true,
            desc: "Nadir ürün.",
          },
          {
            id: "list_6",
            shopId: "shop_3",
            icon: "💋",
            imageKey: "xxx",
            imageSrc: "./src/assets/xxx.jpg",
            itemName: "VIP Companion",
            rarity: "epic",
            stock: 5,
            price: 95,
            energyGain: 22,
            usable: true,
            desc: "Yüksek enerji itemi.",
          },
          {
            id: "list_7",
            shopId: "shop_3",
            icon: "🌹",
            imageKey: "xxx",
            imageSrc: "./src/assets/xxx.jpg",
            itemName: "Deluxe Service",
            rarity: "legendary",
            stock: 2,
            price: 160,
            energyGain: 30,
            usable: true,
            desc: "En üst seviye ürün.",
          },
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

      pvp: {
        wins: 0,
        losses: 0,
        rating: 1000,
        currentOpponent: null,
      },

      bots: [
        { id: "bot_shadowwolf", name: "ShadowWolf", online: true, archetype: "trader", coins: 6400, energy: 44, shopId: "bot_shop_shadowwolf", lastSeenAt: Date.now() },
        { id: "bot_nightviper", name: "NightViper", online: false, archetype: "flipper", coins: 5200, energy: 39, shopId: "bot_shop_nightviper", lastSeenAt: Date.now() },
        { id: "bot_ghostmafia", name: "GhostMafia", online: true, archetype: "seller", coins: 7800, energy: 47, shopId: "bot_shop_ghostmafia", lastSeenAt: Date.now() },
        { id: "bot_ricovane", name: "RicoVane", online: false, archetype: "buyer", coins: 5800, energy: 35, shopId: "bot_shop_ricovane", lastSeenAt: Date.now() },
        { id: "bot_ironfist", name: "IronFist", online: true, archetype: "buyer", coins: 6100, energy: 41, shopId: "bot_shop_ironfist", lastSeenAt: Date.now() },
        { id: "bot_voltkral", name: "VoltKral", online: false, archetype: "seller", coins: 4900, energy: 28, shopId: "bot_shop_voltkral", lastSeenAt: Date.now() },
        { id: "bot_slyraven", name: "SlyRaven", online: true, archetype: "trader", coins: 7050, energy: 33, shopId: "bot_shop_slyraven", lastSeenAt: Date.now() },
        { id: "bot_blackmamba", name: "BlackMamba", online: false, archetype: "flipper", coins: 6650, energy: 31, shopId: "bot_shop_blackmamba", lastSeenAt: Date.now() },
      ],

      botState: {
        enabled: true,
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

    if (!merged.player) merged.player = {};
    if (!merged.trade) merged.trade = {};
    if (!merged.inventory) merged.inventory = { items: [] };
    if (!Array.isArray(merged.inventory.items)) merged.inventory.items = [];
    if (!merged.businesses) merged.businesses = { owned: [] };
    if (!Array.isArray(merged.businesses.owned)) merged.businesses.owned = [];
    if (!merged.market) merged.market = { shops: [], listings: [] };
    if (!Array.isArray(merged.market.shops)) merged.market.shops = [];
    if (!Array.isArray(merged.market.listings)) merged.market.listings = [];

    const playerName = String(merged.player.username || "Player");

    for (const biz of merged.businesses.owned) {
      if (!biz.ownerName) biz.ownerName = playerName;
      if (!biz.ownerId) biz.ownerId = String(merged.player.id || "player_main");
      if (!biz.icon) biz.icon = this._businessIcon(biz.type);
      const bizImg = this._businessImageData(biz.type);
      if (!biz.imageKey && bizImg.imageKey) biz.imageKey = bizImg.imageKey;
      if (!biz.imageSrc && bizImg.imageSrc) biz.imageSrc = bizImg.imageSrc;
      if (!Array.isArray(biz.products)) biz.products = [];
      for (const product of biz.products) {
        const art = this._itemImageData(product.name || product.itemName || "", biz.type);
        if (!product.imageKey && art.imageKey) product.imageKey = art.imageKey;
        if (!product.imageSrc && art.imageSrc) product.imageSrc = art.imageSrc;
      }
    }

    for (const item of merged.inventory.items) {
      const art = this._itemImageData(item.name || item.itemName || "", item.type || "");
      if (!item.imageKey && art.imageKey) item.imageKey = art.imageKey;
      if (!item.imageSrc && art.imageSrc) item.imageSrc = art.imageSrc;
    }

    for (const shop of merged.market.shops) {
      if (!shop.icon) shop.icon = this._businessIcon(shop.type);
      const art = this._businessImageData(shop.type);
      if (!shop.imageKey && art.imageKey) shop.imageKey = art.imageKey;
      if (!shop.imageSrc && art.imageSrc) shop.imageSrc = art.imageSrc;
      if (typeof shop.totalListings !== "number") {
        shop.totalListings = merged.market.listings.filter((x) => x.shopId === shop.id).length;
      }
    }

    for (const listing of merged.market.listings) {
      const shop = merged.market.shops.find((x) => x.id === listing.shopId);
      const art = this._itemImageData(listing.itemName || listing.name || "", shop?.type || listing.type || "");
      if (!listing.imageKey && art.imageKey) listing.imageKey = art.imageKey;
      if (!listing.imageSrc && art.imageSrc) listing.imageSrc = art.imageSrc;
    }

    return merged;
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
    if (/(whiskey|champagne|drink)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/drink.png" };
    if (/(moon rocks|og kush|white widow|weed|kush)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/weed.png" };
    if (/(vip companion|deluxe service|vip girl|companion|service)/.test(raw)) return { imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg" };
    if (/(golden pass|vip pass|pass)/.test(raw)) return { imageKey: "", imageSrc: "./src/assets/bonus.png" };
    if (/(crate|sandık)/.test(raw)) return { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" };
    return this._businessImageData(type);
  }

  _businessIcon(type) {
    switch (type) {
      case "nightclub":
        return "🌃";
      case "coffeeshop":
        return "🌿";
      case "brothel":
        return "💋";
      case "blackmarket":
        return "🕶️";
      default:
        return "🏪";
    }
  }
}

export { Store };
export default Store;
