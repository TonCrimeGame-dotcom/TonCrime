export class Store {
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
    return () => this.listeners.delete(fn);
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
    if (Array.isArray(base) && Array.isArray(patch)) return patch.slice();
    if (!this._isObject(base) || !this._isObject(patch)) return patch;

    for (const k of Object.keys(patch)) {
      const pv = patch[k];
      const bv = base[k];

      if (Array.isArray(pv)) {
        base[k] = pv.slice();
      } else if (this._isObject(pv) && this._isObject(bv)) {
        base[k] = this._deepMerge({ ...bv }, pv);
      } else if (this._isObject(pv)) {
        base[k] = this._deepMerge({}, pv);
      } else {
        base[k] = pv;
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
        safe: { x: 0, y: 0, w: 390, h: 844 },
        hudReservedTop: 110,
        chatReservedBottom: 82,
      },

      player: {
        username: "Player",
        telegramId: "",
        level: 50,
        xp: 0,
        xpToNext: 100,
        energy: 70,
        energyMax: 100,
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
      },

      inventory: {
        items: [
          {
            id: "inv_energy_whiskey",
            kind: "consumable",
            icon: "🥃",
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
                name: "White Widow",
                rarity: "rare",
                qty: 14,
                price: 36,
                energyGain: 12,
                desc: "Enerji için kullanılabilir.",
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
    };

    return this._deepMerge(this._clone(defaults), state || {});
  }
}
