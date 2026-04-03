function normalizeBusinessType(type = "") {
  return String(type || "").trim().toLowerCase();
}

function normalizeBusinessProductKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cloneProductDef(product = {}) {
  return { ...product };
}

function cloneBusinessDef(def = {}) {
  return {
    ...def,
    products: Array.isArray(def.products) ? def.products.map((item) => cloneProductDef(item)) : [],
  };
}

function productLookupKeys(product = {}) {
  const keys = new Set();
  [
    product?.productKey,
    product?.product_key,
    product?.key,
    product?.itemKey,
    product?.item_key,
    product?.slug,
    product?.name,
    product?.itemName,
    product?.item_name,
    product?.title,
  ].forEach((value) => {
    const normalized = normalizeBusinessProductKey(value);
    if (normalized) keys.add(normalized);
  });
  return [...keys];
}

const BUSINESS_DEFS = {
  nightclub: {
    price: 1000,
    priceYton: 1000,
    dailyProduction: 50,
    nameTr: "Nightclub",
    nameEn: "Nightclub",
    defaultName: "Nightclub",
    theme: "neon",
    icon: "NB",
    imageKey: "nightclub",
    imageSrc: "./src/assets/nightclub.jpg",
    products: [
      { key: "street_whiskey", icon: "SW", imageSrc: "./src/assets/street.png", name: "Street Whiskey", rarity: "common", qty: 0, price: 27, energyGain: 8, desc: "Nightclub urunu." },
      { key: "velvet_gin", icon: "VG", imageSrc: "./src/assets/street.png", name: "Velvet Gin", rarity: "common", qty: 0, price: 29, energyGain: 9, desc: "Bar klasigi." },
      { key: "club_prosecco", icon: "CP", imageSrc: "./src/assets/club.png", name: "Club Prosecco", rarity: "rare", qty: 0, price: 33, energyGain: 11, desc: "Kulup ici icecek." },
      { key: "neon_rum", icon: "NR", imageSrc: "./src/assets/club.png", name: "Neon Rum", rarity: "rare", qty: 0, price: 36, energyGain: 12, desc: "Parlak gece icecegi." },
      { key: "blue_venom", icon: "BV", imageSrc: "./src/assets/mafia.png", name: "Blue Venom", rarity: "epic", qty: 0, price: 40, energyGain: 13, desc: "VIP kokteyl." },
      { key: "midnight_absinthe", icon: "MA", imageSrc: "./src/assets/mafia.png", name: "Midnight Absinthe", rarity: "legendary", qty: 0, price: 47, energyGain: 16, desc: "Gecenin en sert sisesi." },
    ],
  },
  coffeeshop: {
    price: 850,
    priceYton: 850,
    dailyProduction: 50,
    nameTr: "Coffeeshop",
    nameEn: "Coffeeshop",
    defaultName: "Coffeeshop",
    theme: "green",
    icon: "CF",
    imageKey: "coffeeshop",
    imageSrc: "./src/assets/coffeeshop.jpg",
    products: [
      { key: "amnesia_haze", icon: "AH", imageSrc: "./src/assets/white.png", name: "Amnesia Haze", rarity: "common", qty: 0, price: 30, energyGain: 10, desc: "Hafif ama hizli satar." },
      { key: "white_widow", icon: "WW", imageSrc: "./src/assets/white.png", name: "White Widow", rarity: "rare", qty: 0, price: 36, energyGain: 12, desc: "Coffeeshop urunu." },
      { key: "northern_lights", icon: "NL", imageSrc: "./src/assets/og.png", name: "Northern Lights", rarity: "rare", qty: 0, price: 41, energyGain: 14, desc: "Sakin ama degerli." },
      { key: "og_kush", icon: "OG", imageSrc: "./src/assets/og.png", name: "OG Kush", rarity: "epic", qty: 0, price: 48, energyGain: 16, desc: "Klasik kush." },
      { key: "gelato_41", icon: "G4", imageSrc: "./src/assets/diamond.png", name: "Gelato 41", rarity: "epic", qty: 0, price: 55, energyGain: 17, desc: "Tatli ama agir premium urun." },
      { key: "moon_rocks", icon: "MR", imageSrc: "./src/assets/diamond.png", name: "Moon Rocks", rarity: "legendary", qty: 0, price: 62, energyGain: 18, desc: "Nadir urun." },
    ],
  },
  brothel: {
    price: 1200,
    priceYton: 1200,
    dailyProduction: 50,
    nameTr: "Genelev",
    nameEn: "Brothel",
    defaultName: "Brothel",
    theme: "red",
    icon: "BR",
    imageKey: "xxx",
    imageSrc: "./src/assets/xxx.jpg",
    products: [
      { key: "velvet_orchid", icon: "VO", imageSrc: "./src/assets/g_star1.png", name: "Velvet Orchid", rarity: "rare", qty: 0, price: 82, energyGain: 19, desc: "Klasik gece servisi." },
      { key: "scarlett_blaze", icon: "SB", imageSrc: "./src/assets/g_star1.png", name: "Scarlett Blaze", rarity: "epic", qty: 0, price: 95, energyGain: 22, desc: "VIP servis." },
      { key: "jade_noir", icon: "JN", imageSrc: "./src/assets/g_star2.png", name: "Jade Noir", rarity: "epic", qty: 0, price: 108, energyGain: 24, desc: "Sessiz ama pahali servis." },
      { key: "ruby_vane", icon: "RV", imageSrc: "./src/assets/g_star2.png", name: "Ruby Vane", rarity: "legendary", qty: 0, price: 120, energyGain: 26, desc: "Deluxe servis." },
      { key: "ivory_rose", icon: "IR", imageSrc: "./src/assets/g_star3.png", name: "Ivory Rose", rarity: "legendary", qty: 0, price: 134, energyGain: 28, desc: "Nadir premium servis." },
      { key: "luna_hart", icon: "LH", imageSrc: "./src/assets/g_star3.png", name: "Luna Hart", rarity: "legendary", qty: 0, price: 145, energyGain: 30, desc: "Elite servis." },
    ],
  },
  blackmarket: {
    price: 0,
    priceYton: 0,
    dailyProduction: 0,
    nameTr: "Black Market",
    nameEn: "Black Market",
    defaultName: "Black Market",
    theme: "dark",
    icon: "BM",
    imageKey: "blackmarket",
    imageSrc: "./src/assets/BlackMarket.png",
    products: [],
  },
};

export function getBusinessCatalog() {
  return Object.fromEntries(
    Object.entries(BUSINESS_DEFS).map(([type, def]) => [type, cloneBusinessDef(def)])
  );
}

export function getBusinessDef(type = "") {
  const def = BUSINESS_DEFS[normalizeBusinessType(type)];
  return def ? cloneBusinessDef(def) : null;
}

export function getBusinessProductPool(type = "") {
  return getBusinessDef(type)?.products || [];
}

export function sortBusinessProductsByCatalog(products = [], type = "") {
  const def = BUSINESS_DEFS[normalizeBusinessType(type)];
  const order = new Map(
    (def?.products || []).map((product, index) => [normalizeBusinessProductKey(product.key || product.name), index])
  );

  return [...(products || [])].sort((left, right) => {
    const leftKey = productLookupKeys(left)[0] || "";
    const rightKey = productLookupKeys(right)[0] || "";
    const leftOrder = order.has(leftKey) ? order.get(leftKey) : Number.MAX_SAFE_INTEGER;
    const rightOrder = order.has(rightKey) ? order.get(rightKey) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left?.name || left?.itemName || leftKey).localeCompare(
      String(right?.name || right?.itemName || rightKey),
      "en"
    );
  });
}

export function mergeProductsWithCatalog(products = [], type = "", { makeId = null } = {}) {
  const def = BUSINESS_DEFS[normalizeBusinessType(type)];
  const safeProducts = Array.isArray(products) ? products.map((item) => ({ ...item })) : [];
  if (!def) return safeProducts;

  const consumed = new Set();
  const merged = [];

  def.products.forEach((catalogProduct, index) => {
    const catalogKeys = new Set(productLookupKeys(catalogProduct));
    const existingIndex = safeProducts.findIndex((product, productIndex) => {
      if (consumed.has(productIndex)) return false;
      return productLookupKeys(product).some((key) => catalogKeys.has(key));
    });
    const existing = existingIndex >= 0 ? safeProducts[existingIndex] : null;
    if (existingIndex >= 0) consumed.add(existingIndex);

    const nextId = existing?.id || (typeof makeId === "function" ? String(makeId(catalogProduct, index) || "") : "");
    const nextQty = Math.max(
      0,
      Number(existing?.qty ?? existing?.quantity ?? existing?.stock_qty ?? catalogProduct?.qty ?? 0)
    );

    const item = {
      ...(existing || {}),
      ...catalogProduct,
      id: nextId,
      key: catalogProduct.key,
      productKey: catalogProduct.key,
      qty: nextQty,
      price: Math.max(1, Number(catalogProduct.price || existing?.price || 1)),
      energyGain: Math.max(0, Number(catalogProduct.energyGain ?? existing?.energyGain ?? 0)),
      desc: String(catalogProduct.desc || existing?.desc || existing?.description || ""),
    };

    if (!item.id) delete item.id;
    merged.push(item);
  });

  safeProducts.forEach((product, index) => {
    if (!consumed.has(index)) merged.push({ ...product });
  });

  return sortBusinessProductsByCatalog(merged, type);
}

export { normalizeBusinessProductKey, normalizeBusinessType };
